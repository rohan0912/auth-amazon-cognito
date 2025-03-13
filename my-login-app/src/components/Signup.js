// src/components/Signup.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css'; // Using the same CSS file
import logo from '../assets/logo1.png';

// If you have a logo file, import it here
// import logo from '../assets/logo.png';

const Signup = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  
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
      const response = await axios.post('/signup', formData);
      setSuccess(response.data.message);
      setShowConfirmation(true);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during signup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/confirm', {
        username: formData.username,
        code: confirmationCode
      });
      setSuccess(response.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during confirmation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Uncomment if you have a logo */}
        {/* <img src={logo} alt="Logo" className="login-logo" /> */}
        <img src={logo} alt="Logo" className="login-logo" />
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="error-message" style={{color: 'green'}}>{success}</div>}
        
        {!showConfirmation ? (
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
              type="email"
              className="login-input"
              placeholder="Email"
              name="email"
              value={formData.email}
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
              minLength="8"
            />
            
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Sign Up'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmation}>
            <input
              type="text"
              className="login-input"
              placeholder="Confirmation Code"
              name="confirmationCode"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              required
            />
            
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Confirm Email'}
            </button>
          </form>
        )}
        
        <div className="signup-link">
          <p>Already have an account? <Link to="/login">Log in</Link></p>
        </div>
      </div>
      
      <div className="login-address">
        <span>Your Company Name</span>
        <span className="separator">123 Company Street</span>
        <span className="separator">City, State 12345</span>
      </div>
    </div>
  );
};

export default Signup;