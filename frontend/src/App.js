import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Map from './components/Map';
import Schedule from './components/Schedule';
import AlertsPanel from './components/AlertsPanel';
import Navigation from './components/Navigation';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Navigation />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<Map />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/alerts" element={<AlertsPanel />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
}

export default App;