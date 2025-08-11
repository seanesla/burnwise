import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Landing from './components/Landing';
import Map from './components/Map';
import Dashboard from './components/Dashboard';
import ImprovedBurnRequestForm from './components/ImprovedBurnRequestForm';
import Schedule from './components/Schedule';
import AlertsPanel from './components/AlertsPanel';
import LogoTester from './components/LogoTester';
import BurnwiseLogoPotraceExact from './components/BurnwiseLogoPotraceExact';
import BurnwiseLogoEvidence from './components/BurnwiseLogoEvidence';
import './styles/App.css';

function AppContent() {
  const location = useLocation();
  const [farms, setFarms] = useState([]);
  const [burnRequests, setBurnRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  
  const showNavbar = location.pathname !== '/';

  useEffect(() => {
    fetchInitialData();
  }, [selectedDate]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [farmsRes, burnsRes] = await Promise.all([
        fetch('http://localhost:5001/api/farms'),
        fetch(`http://localhost:5001/api/burn-requests?date=${selectedDate}`)
      ]);

      const farmsData = await farmsRes.json();
      const burnsData = await burnsRes.json();

      if (farmsData.success) setFarms(farmsData.data);
      if (burnsData.success) setBurnRequests(burnsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBurnRequestSubmit = async (requestData) => {
    try {
      const response = await fetch('http://localhost:5001/api/burn-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      if (result.success) {
        await fetchInitialData();
        return result.data;
      }
      throw new Error(result.error);
    } catch (error) {
      console.error('Error submitting burn request:', error);
      throw error;
    }
  };

  return (
    <div className="App">
      {showNavbar && (
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="logo-link">
              <BurnwiseLogoPotraceExact size={40} animated={false} />
              <h1 className="logo">BURNWISE</h1>
            </Link>
            <ul className="nav-links">
              <li><Link to="/map">Map</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/schedule">Schedule</Link></li>
              <li><Link to="/request-burn">Request Burn</Link></li>
              <li><Link to="/alerts">Alerts</Link></li>
            </ul>
            <div className="date-selector">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </nav>
      )}

      <main className="main-content">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading burn coordination data...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/map" element={
              <Map 
                farms={farms} 
                burnRequests={burnRequests}
                selectedDate={selectedDate}
              />
            } />
            <Route path="/dashboard" element={
              <Dashboard 
                burnRequests={burnRequests}
                selectedDate={selectedDate}
              />
            } />
            <Route path="/schedule" element={
              <Schedule 
                burnRequests={burnRequests}
                selectedDate={selectedDate}
                onRefresh={fetchInitialData}
              />
            } />
            <Route path="/request-burn" element={
              <ImprovedBurnRequestForm 
                farms={farms}
                onSubmit={handleBurnRequestSubmit}
              />
            } />
            <Route path="/alerts" element={
              <AlertsPanel 
                farms={farms}
              />
            } />
            <Route path="/logo-test" element={<LogoTester />} />
            <Route path="/logo-evidence" element={<BurnwiseLogoEvidence />} />
          </Routes>
        )}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4CAF50',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#F44336',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;