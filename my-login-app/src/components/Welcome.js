// src/components/Welcome.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Welcome.css';
import logo from '../assets/logo.jpg';

const Welcome = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const idToken = localStorage.getItem('idToken');
      const accessToken = localStorage.getItem('accessToken');
      
      // Check if either token is missing
      if (!idToken || !accessToken) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await axios.get('/protected', {
          headers: {
            Authorization: `Bearer ${idToken}`, // Send idToken in Authorization header
            'X-Access-Token': accessToken       // Send accessToken in X-Access-Token header
          }
        });
        
        setUserData(response.data.user);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to fetch user data. You may need to log in again.');
        localStorage.removeItem('idToken');
        localStorage.removeItem('accessToken');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    navigate('/login');
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  if (loading) {
    return (
      <div className="welcome-container">
        <div className="welcome-box">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="welcome-container">
        <div className="welcome-box">
          <h2>Error</h2>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-container">
      <div className="welcome-box">
        <img src={logo} alt="Logo" className="login-logo" />
        
        {userData && (
          <div className="user-info">
            <h3>User Information</h3>
            <pre>{JSON.stringify(userData, null, 2)}</pre>
          </div>
        )}
    
        <button onClick={handleProfileClick} className="profile-button">
          View/Edit Profile
        </button>
        
        <button onClick={handleLogout} className="logout-button">
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Welcome;