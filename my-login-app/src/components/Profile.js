// src/components/Profile.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Welcome.css';
import logo from '../assets/logo.jpg';

const Profile = () => {
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    number: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      const idToken = localStorage.getItem('idToken');
      const accessToken = localStorage.getItem('accessToken');
      
      if (!idToken || !accessToken) {
        navigate('/login');
        return;
      }
      
      try {
        const response = await axios.get('/profile', {
          headers: {
            Authorization: `Bearer ${idToken}`,
            'X-Access-Token': accessToken,
          },
        });
        
        setProfileData(response.data.profile);
      } catch (err) {
        console.error('Error fetching profile data:', err);
        setError('Failed to fetch profile data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value,
    });
  };

  const handleSave = async () => {
    const idToken = localStorage.getItem('idToken');
    const accessToken = localStorage.getItem('accessToken');
    
    if (!idToken || !accessToken) {
      navigate('/login');
      return;
    }
    
    try {
      const response = await axios.put('/profile', profileData, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          'X-Access-Token': accessToken,
        },
      });
      
      setProfileData(response.data.profile);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile.');
    }
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
        {isEditing ? (
          <div className="profile-form">
            <label>
              First Name:
              <input
                type="text"
                name="first_name"
                value={profileData.first_name}
                onChange={handleInputChange}
              />
            </label>
            <label>
              Last Name:
              <input
                type="text"
                name="last_name"
                value={profileData.last_name}
                onChange={handleInputChange}
              />
            </label>
            <label>
              Phone Number:
              <input
                type="text"
                name="number"
                value={profileData.number}
                onChange={handleInputChange}
              />
            </label>
            <button onClick={handleSave} className="profile-button">
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="logout-button">
              Cancel
            </button>
          </div>
        ) : (
          <div className="profile-info">
            <p><strong>First Name:</strong> {profileData.first_name}</p>
            <p><strong>Last Name:</strong> {profileData.last_name}</p>
            <p><strong>Phone Number:</strong> {profileData.number}</p>
            <button onClick={() => setIsEditing(true)} className="profile-button">
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;