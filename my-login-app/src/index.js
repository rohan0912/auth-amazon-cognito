import React from 'react';
import ReactDOM from 'react-dom/client'; // Updated import
import App from './App';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:3000';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);