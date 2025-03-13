require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const os = require('os');
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require('aws-jwt-verify');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token']
}));

// AWS Cognito Configuration
const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const UserPoolId = process.env.USER_POOL_ID;
const ClientId = process.env.CLIENT_ID;
const ClientSecret = process.env.CLIENT_SECRET;

// Configure Cognito JWT verifiers for both ID and Access tokens
const idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    clientId: process.env.CLIENT_ID,
    tokenUse: 'id',
});

const accessTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: process.env.USER_POOL_ID,
    clientId: process.env.CLIENT_ID,
    tokenUse: 'access',
});

// PostgreSQL Configuration
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: {
      rejectUnauthorized: false  // Use this for development only
    }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Helper function to compute SECRET_HASH
const computeSecretHash = (username, clientId, clientSecret) => {
    return crypto
        .createHmac('SHA256', clientSecret)
        .update(username + clientId)
        .digest('base64');
};

// Enhanced middleware with role checking
const authenticateWithRole = (requiredRoles = []) => {
    return async (req, res, next) => {
        try {
            // First run the standard authentication
            const idToken = req.headers.authorization?.split(' ')[1];
            const accessToken = req.headers['x-access-token'];

            if (!idToken || !accessToken) {
                return res.status(401).json({ error: 'Access denied. Both ID and Access tokens are required.' });
            }

            // Verify tokens
            const decodedIdToken = await idTokenVerifier.verify(idToken);
            const decodedAccessToken = await accessTokenVerifier.verify(accessToken);

            if (decodedIdToken.sub !== decodedAccessToken.sub) {
                return res.status(401).json({ error: 'ID and Access tokens do not match the same user.' });
            }

            // Attach decoded payloads to the request
            req.user = {
                idToken: decodedIdToken,
                accessToken: decodedAccessToken
            };

            // If no specific roles are required, proceed
            if (requiredRoles.length === 0) {
                return next();
            }

            // Check the role in the database
            const query = 'SELECT role FROM users WHERE sub = $1';
            const { rows } = await pool.query(query, [decodedAccessToken.sub]);
            
            if (rows.length === 0) {
                return res.status(404).json({ error: 'User not found in database.' });
            }

            const userRole = rows[0].role;
            
            // Check if the user has one of the required roles
            if (requiredRoles.includes(userRole)) {
                return next();
            } else {
                return res.status(403).json({ error: 'Insufficient permissions.' });
            }
        } catch (err) {
            console.error('JWT Authentication Error:', err);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'One or both tokens have expired.' });
            }
            return res.status(401).json({ error: 'Invalid token(s).' });
        }
    };
};

// Database Initialization Endpoint (Run once to create tables)
app.post('/init-db', async (req, res) => {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                sub VARCHAR(255) UNIQUE,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                cognito_status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        res.status(200).json({ message: 'Database initialized successfully' });
    } catch (err) {
        console.error('Database initialization error:', err);
        res.status(500).json({ error: 'Failed to initialize database' });
    }
});

// SIGNUP ENDPOINT (modified to add database entry)
app.post('/signup', async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide username, email, and password.' });
    }
    
    // Default role if not provided
    const userRole = role || 'user';

    const params = {
        ClientId: ClientId,
        Username: username,
        Password: password,
        SecretHash: computeSecretHash(username, ClientId, ClientSecret),
        UserAttributes: [
            { Name: 'email', Value: email },
            // You can optionally add a custom attribute for role in Cognito
            { Name: 'custom:role', Value: userRole }
        ],
    };

    try {
        // Begin transaction
        const dbClient = await pool.connect();
        
        try {
            await dbClient.query('BEGIN');
            
            // 1. Sign up the user in Cognito
            const command = new SignUpCommand(params);
            const data = await client.send(command);
            
            // 2. Store initial user data in PostgreSQL (without sub ID yet)
            const query = 'INSERT INTO users(username, email, role, cognito_status) VALUES($1, $2, $3, $4) RETURNING *';
            const values = [username, email, userRole, 'UNCONFIRMED'];
            
            const dbResult = await dbClient.query(query, values);
            
            await dbClient.query('COMMIT');
            
            res.status(200).json({ 
                message: 'User signed up successfully. Please check your email for confirmation.', 
                data,
                dbUser: dbResult.rows[0]
            });
        } catch (e) {
            await dbClient.query('ROLLBACK');
            throw e;
        } finally {
            dbClient.release();
        }
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// CONFIRM EMAIL (modified to update database with sub)
app.post('/confirm', async (req, res) => {
    const { username, code, password } = req.body;
    if (!username || !code) {
        return res.status(400).json({ error: 'Please provide username and confirmation code.' });
    }

    const params = {
        ClientId: ClientId,
        ConfirmationCode: code,
        Username: username,
        SecretHash: computeSecretHash(username, ClientId, ClientSecret),
    };

    try {
        // 1. Confirm the signup in Cognito
        const command = new ConfirmSignUpCommand(params);
        await client.send(command);
        
 
        const query = 'UPDATE users SET cognito_status = $1 WHERE username = $2 RETURNING *';
        const values = ['CONFIRMED', username];
        
        const dbResult = await pool.query(query, values);
        
        res.status(200).json({ 
            message: 'Email confirmed successfully. Please login to access your account.', 
            dbUser: dbResult.rows[0]
        });
    } catch (err) {
        console.error('Email Confirmation Error:', err);
        res.status(400).json({ error: err.message });
    }
});

//LOGIN
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Please provide username or email and password.' });
    }

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: ClientId,
        AuthParameters: {
            USERNAME: username,  // This can be either username or email
            PASSWORD: password,
            SECRET_HASH: computeSecretHash(username, ClientId, ClientSecret),
        },
    };

    try {
        // First, authenticate with Cognito
        const command = new InitiateAuthCommand(params);
        const data = await client.send(command);
        const tokens = {
            idToken: data.AuthenticationResult.IdToken,
            accessToken: data.AuthenticationResult.AccessToken,
            refreshToken: data.AuthenticationResult.RefreshToken,
        };

        // Extract sub from the access token
        const decodedAccessToken = await accessTokenVerifier.verify(
            data.AuthenticationResult.AccessToken
        );
        const sub = decodedAccessToken.sub;

        // Begin a transaction for database operations
        const dbClient = await pool.connect();
        try {
            await dbClient.query('BEGIN');

            // Check if user exists in database by either username or email
            const checkQuery = `
                SELECT * FROM users 
                WHERE username = $1 OR email = $1
            `;
            const checkResult = await dbClient.query(checkQuery, [username]);

            if (checkResult.rows.length === 0) {
                // User exists in Cognito but not in our DB, create new entry
                const role = 'user'; // Default role
                const emailFromToken = decodedAccessToken.email || username;
                const actualUsername = decodedAccessToken['cognito:username'] || username;

                // Check if the sub already exists to avoid duplicate key violation
                const subCheckQuery = `
                    SELECT * FROM users WHERE sub = $1
                `;
                const subCheckResult = await dbClient.query(subCheckQuery, [sub]);

                if (subCheckResult.rows.length > 0) {
                    // Sub exists, update the existing record with the new username/email if needed
                    const updateUserQuery = `
                        UPDATE users 
                        SET username = $1, email = $2, cognito_status = $3, updated_at = NOW()
                        WHERE sub = $4
                        RETURNING *
                    `;
                    const updateUserValues = [actualUsername, emailFromToken, 'CONFIRMED', sub];
                    const updateUserResult = await dbClient.query(updateUserQuery, updateUserValues);

                    // Check if profile exists, if not, create it
                    const checkProfileQuery = `
                        SELECT * FROM profile WHERE sub = $1
                    `;
                    const checkProfileResult = await dbClient.query(checkProfileQuery, [sub]);

                    let profile;
                    if (checkProfileResult.rows.length === 0) {
                        const insertProfileQuery = `
                            INSERT INTO profile(sub) 
                            VALUES($1) 
                            RETURNING *
                        `;
                        const insertProfileValues = [sub]; // Placeholder values
                        const insertProfileResult = await dbClient.query(insertProfileQuery, insertProfileValues);
                        profile = insertProfileResult.rows[0];
                    } else {
                        profile = checkProfileResult.rows[0];
                    }

                    await dbClient.query('COMMIT');

                    return res.status(200).json({
                        message: 'Login successful and user updated with existing sub.',
                        tokens,
                        user: updateUserResult.rows[0],
                        profile,
                    });
                } else {
                    // Sub does not exist, insert new user
                    const insertUserQuery = `
                        INSERT INTO users(username, email, sub, role, cognito_status) 
                        VALUES($1, $2, $3, $4, $5) 
                        RETURNING *
                    `;
                    const insertUserValues = [actualUsername, emailFromToken, sub, role, 'CONFIRMED'];
                    const insertUserResult = await dbClient.query(insertUserQuery, insertUserValues);

                    // Insert into profile table for the new user
                    const insertProfileQuery = `
                        INSERT INTO profile(sub) 
                        VALUES($1) 
                        RETURNING *
                    `;
                    const insertProfileValues = [sub]; // Placeholder values
                    const insertProfileResult = await dbClient.query(insertProfileQuery, insertProfileValues);

                    await dbClient.query('COMMIT');

                    return res.status(200).json({
                        message: 'Login successful and user/profile created in database.',
                        tokens,
                        user: insertUserResult.rows[0],
                        profile: insertProfileResult.rows[0],
                    });
                }
            }

            const user = checkResult.rows[0];

            // If sub is missing, update it and create profile if it doesn’t exist
            if (!user.sub) {
                const updateUserQuery = `
                    UPDATE users 
                    SET sub = $1, cognito_status = $2 
                    WHERE (username = $3 OR email = $3) 
                    RETURNING *
                `;
                const updateUserValues = [sub, 'CONFIRMED', username];
                const updateUserResult = await dbClient.query(updateUserQuery, updateUserValues);

                // Check if profile exists, if not, create it
                const checkProfileQuery = `
                    SELECT * FROM profile WHERE sub = $1
                `;
                const checkProfileResult = await dbClient.query(checkProfileQuery, [sub]);

                let profile;
                if (checkProfileResult.rows.length === 0) {
                    const insertProfileQuery = `
                        INSERT INTO profile(sub) 
                        VALUES($1) 
                        RETURNING *
                    `;
                    const insertProfileValues = [sub]; // Placeholder values
                    const insertProfileResult = await dbClient.query(insertProfileQuery, insertProfileValues);
                    profile = insertProfileResult.rows[0];
                } else {
                    profile = checkProfileResult.rows[0];
                }

                await dbClient.query('COMMIT');

                return res.status(200).json({
                    message: 'Login successful and user updated with sub, profile ensured.',
                    tokens,
                    user: updateUserResult.rows[0],
                    profile,
                });
            } else {
                // Fetch the profile for the existing user
                const checkProfileQuery = `
                    SELECT * FROM profile WHERE sub = $1
                `;
                const checkProfileResult = await dbClient.query(checkProfileQuery, [sub]);

                let profile;
                if (checkProfileResult.rows.length === 0) {
                    // If profile doesn't exist, create it
                    const insertProfileQuery = `
                        INSERT INTO profile(sub) 
                        VALUES($1) 
                        RETURNING *
                    `;
                    const insertProfileValues = [sub]; // Placeholder values
                    const insertProfileResult = await dbClient.query(insertProfileQuery, insertProfileValues);
                    profile = insertProfileResult.rows[0];
                } else {
                    profile = checkProfileResult.rows[0];
                }

                await dbClient.query('COMMIT');

                return res.status(200).json({
                    message: 'Login successful.',
                    tokens,
                    user: user,
                    profile,
                });
            }
        } catch (e) {
            await dbClient.query('ROLLBACK');
            throw e;
        } finally {
            dbClient.release();
        }
    } catch (err) {
        console.error('Login Error:', err);
        res.status(400).json({ error: err.message });
    }
});


// FORGOT PASSWORD ENDPOINT (unchanged)
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Please provide an email address.' });
    }

    const params = {
        ClientId: ClientId,
        Username: email,
        SecretHash: computeSecretHash(email, ClientId, ClientSecret),
    };

    try {
        const command = new ForgotPasswordCommand(params);
        const data = await client.send(command);
        res.status(200).json({ message: 'Password reset code sent successfully. Check your email.', data });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// RESET PASSWORD ENDPOINT (unchanged)
app.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ error: 'Please provide email, verification code, and new password.' });
    }

    const params = {
        ClientId: ClientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        SecretHash: computeSecretHash(email, ClientId, ClientSecret),
    };

    try {
        const command = new ConfirmForgotPasswordCommand(params);
        const data = await client.send(command);
        res.status(200).json({ message: 'Password reset successfully.', data });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// User Management Endpoints

// Get current user profile
app.get('/profile', authenticateWithRole(), async (req, res) => {
    try {
        const sub = req.user.accessToken.sub;
        
        // Fetch profile data from the profile table
        const query = 'SELECT first_name, last_name, number, created_at, updated_at FROM profile WHERE sub = $1';
        const { rows } = await pool.query(query, [sub]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found.' });
        }
        
        res.status(200).json({ 
            message: 'Profile retrieved successfully.',
            profile: rows[0]
        });
    } catch (err) {
        console.error('Profile Retrieval Error:', err);
        res.status(500).json({ error: 'Failed to retrieve profile.' });
    }
});

// Update user profile
app.put('/profile', authenticateWithRole(), async (req, res) => {
    const { first_name, last_name, number } = req.body; // Example fields for profile update
    const sub = req.user.accessToken.sub;
    
    try {
        // Update profile data in the profile table
        const query = `
            UPDATE profile 
            SET first_name = $1, last_name = $2, number = $3, updated_at = NOW() 
            WHERE sub = $4 
            RETURNING first_name, last_name, number
        `;
        const { rows } = await pool.query(query, [first_name, last_name, number, sub]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found.' });
        }
        
        res.status(200).json({ 
            message: 'Profile updated successfully.',
            profile: rows[0]
        });
    } catch (err) {
        console.error('Profile Update Error:', err);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// Admin Endpoints

// Get all users (admin only)
app.get('/admin/users', authenticateWithRole(['admin']), async (req, res) => {
    try {
        const query = 'SELECT id, username, email, role, cognito_status, created_at, updated_at FROM users ORDER BY created_at DESC';
        const { rows } = await pool.query(query);
        
        res.status(200).json({ 
            message: 'Users retrieved successfully.',
            users: rows
        });
    } catch (err) {
        console.error('User Retrieval Error:', err);
        res.status(500).json({ error: 'Failed to retrieve users.' });
    }
});

// Update user role (admin only)
app.put('/admin/users/:id/role', authenticateWithRole(['admin']), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Please provide a valid role (user or admin).' });
    }
    
    try {
        const query = 'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, email, role, cognito_status, created_at, updated_at';
        const { rows } = await pool.query(query, [role, id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        
        res.status(200).json({ 
            message: 'User role updated successfully.',
            user: rows[0]
        });
    } catch (err) {
        console.error('Role Update Error:', err);
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});

// Role-based Protected Routes Examples

// Admin only route
app.get('/admin', authenticateWithRole(['admin']), (req, res) => {
    res.status(200).json({ 
        message: 'You have admin access to this protected resource.',
        user: req.user
    });
});

// User or admin route
app.get('/user', authenticateWithRole(['user', 'admin']), (req, res) => {
    res.status(200).json({ 
        message: 'You have user access to this protected resource.',
        user: req.user
    });
});

// General protected route (any authenticated user)
app.get('/protected', authenticateWithRole(), (req, res) => {
    res.status(200).json({ 
        message: 'You have access to this general protected resource.', 
        user: req.user
    });
});

app.get('/health', (req, res) => {
    const healthCheck = {
        status: 'healthy',
        message: 'Server is running properly',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        systemMemory: {
            freeMemory: os.freemem(),
            totalMemory: os.totalmem()
        },
        loadAverage: os.loadavg()
    };

    res.status(200).json(healthCheck);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});