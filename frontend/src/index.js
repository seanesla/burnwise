import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/z-index-scale.css'; // Fix cursor flickering and z-index conflicts
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);