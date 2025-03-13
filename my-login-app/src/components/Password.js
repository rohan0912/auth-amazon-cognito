// src/components/Password.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Auth.css'; // Reusing the same styles as Login
import logo from '../assets/logo1.png';

const Password = () => {
  const [formData, setFormData] = useState({
    email: '',
    code: '',
    newPassword: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 for email input, 2 for code + new password
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/forgot-password', { email: formData.email });
      setMessage(response.data.message);
      setStep(2); // Move to the next step
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/reset-password', {
        email: formData.email,
        code: formData.code,
        newPassword: formData.newPassword,
      });
      setMessage(response.data.message);
      setTimeout(() => navigate('/login'), 2000); // Redirect to login after success
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={logo} alt="Logo" className="login-logo" />
        
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        
        {step === 1 ? (
          <form onSubmit={handleForgotPassword}>
            <input
              type="email"
              className="login-input"
              placeholder="Email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <input
              type="text"
              className="login-input"
              placeholder="Verification Code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
            />
            <input
              type="password"
              className="login-input"
              placeholder="New Password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              required
            />
            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Reset Password'}
            </button>
          </form>
        )}
        
        <div className="additional-links">
          <p><Link to="/login">Back to Login</Link></p>
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

export default Password;