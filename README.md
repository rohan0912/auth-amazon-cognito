# React + Node.js Authentication System with AWS Cognito

This project consists of a **React frontend** and a **Node.js backend** with **AWS Cognito authentication** and **PostgreSQL** for user management.

## Features
- **User Signup & Login** (AWS Cognito)
- **JWT Authentication & Role-based Access**
- **Password Reset & Email Confirmation**
- **PostgreSQL Database Integration**
- **Admin Panel for User Management**
- **Protected Routes Based on User Roles**
- **Health Check Endpoint**

## Technologies Used
### Frontend (React)
- React.js
- React Router
- Axios (for API requests)
- TailwindCSS (for styling)

### Backend (Node.js + Express)
- Express.js
- AWS Cognito SDK
- PostgreSQL (with `pg` library)
- JSON Web Tokens (JWT)
- dotenv (for environment variables)
- CORS & Body Parser

## Getting Started

### 1. Clone the Repository
```sh
git clone https://github.com/yourusername/auth-amazon-cognito.git
cd auth-amazon-cognito
```

### 2. Setup Backend (Node.js + Express)
#### Install Dependencies
```sh
cd backend
npm install
```

#### Configure Environment Variables
Create a `.env` file inside the `backend/` directory and set up:
```env
PORT=3000
AWS_REGION=your-aws-region
USER_POOL_ID=your-cognito-user-pool-id
CLIENT_ID=your-cognito-app-client-id
CLIENT_SECRET=your-cognito-app-client-secret
DB_USER=your-db-user
DB_HOST=your-db-host
DB_NAME=your-db-name
DB_PASSWORD=your-db-password
DB_PORT=5432
```

#### Start the Backend Server
```sh
npm start
```

### 3. Setup Frontend (React)
#### Install Dependencies
```sh
cd my-login-app
npm install
```

#### Start the React App
```sh
npm start
```

### 4. API Endpoints
#### Authentication Routes
- **POST `/signup`** - User Signup
- **POST `/confirm`** - Confirm Email
- **POST `/login`** - User Login
- **POST `/forgot-password`** - Request Password Reset
- **POST `/reset-password`** - Reset Password

#### User Routes
- **GET `/profile`** - Get User Profile
- **PUT `/profile`** - Update Profile

#### Admin Routes
- **GET `/admin/users`** - Get All Users (Admin Only)
- **PUT `/admin/users/:id/role`** - Update User Role (Admin Only)

#### Health Check
- **GET `/health`** - Check Server Health

## Deployment
- Use **AWS EC2** or **Vercel/Netlify** for deployment.
- Ensure **AWS Cognito** and **PostgreSQL** are configured correctly.


## Author
Rohan Nair - [GitHub](https://github.com/rohan0912)

