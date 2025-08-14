import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/z-index-scale.css'; // Fix cursor flickering and z-index conflicts
import './styles/overlap-fixes.css'; // Critical fixes for overlapping UI elements
import './styles/slider-fix.css'; // CRITICAL: Fix duplicate slider tracks
import './styles/theme-system.css'; // Theme switching functionality
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);