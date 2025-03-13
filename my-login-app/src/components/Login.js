// src/components/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css';
import logo from '../assets/logo1.png';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/login', formData);
      // Store both tokens in localStorage
      localStorage.setItem('idToken', response.data.tokens.idToken);
      localStorage.setItem('accessToken', response.data.tokens.accessToken);
      navigate('/welcome');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Logo" className="login-logo" />
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="login-input"
            placeholder="Username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
          
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          
          <button 
            type="submit" 
            className="login-button" 
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Log In'}
          </button>
        </form>
        
        <div className="signup-link">
          <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
        </div>
        
        <div className="additional-links">
          <p><Link to="/forgot-password">Forgot Password?</Link></p>
        </div>
      </div>
      
      <div className="login-address">
        <span>Rohan Nair</span>
        <span className="separator">Software Engineer</span>
        <span className="separator">Columbia, MD 21045</span>
      </div>
    </div>
  );
};

export default Login;