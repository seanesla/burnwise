import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import BurnRequestForm from './BurnRequestForm';

const Dashboard = ({ burnRequests = [], selectedDate = new Date().toISOString().split('T')[0] }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [burnData, setBurnData] = useState(burnRequests);
  const [showBurnForm, setShowBurnForm] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    if (burnRequests.length === 0) {
      fetchBurnRequests();
    }
  }, [selectedDate]);

  const fetchBurnRequests = async () => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/burn-requests?date=${selectedDate}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBurnData(data.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching burn requests:', error);
      setBurnData([]);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5001/api/analytics/dashboard?startDate=${selectedDate}&endDate=${selectedDate}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data);
        }
      }
    } catch (error) {
      toast.error('Failed to load analytics');
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusData = (burnData || []).reduce((acc, req) => {
    const status = req.status;
    const existing = acc.find(item => item.name === status);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: status, value: 1 });
    }
    return acc;
  }, []);

  const COLORS = {
    pending: '#FFB000',
    approved: '#ff9800',
    scheduled: '#ff6b35',
    active: '#ff5722',
    completed: 'rgba(255, 255, 255, 0.3)',
    cancelled: 'rgba(255, 255, 255, 0.2)'
  };

  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    burns: (burnData || []).filter(r => {
      const hour = parseInt(r.requested_start_time?.split(':')[0] || 0);
      return hour === i;
    }).length
  }));

  const cropData = (burnData || []).reduce((acc, req) => {
    const crop = req.crop_type || 'Unknown';
    const existing = acc.find(item => item.crop === crop);
    if (existing) {
      existing.count++;
      existing.area += req.area_hectares || 0;
    } else {
      acc.push({
        crop,
        count: 1,
        area: req.area_hectares || 0
      });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Burn Coordination Dashboard</h2>
        <p>Date: {selectedDate}</p>
        <button 
          onClick={() => setShowBurnForm(!showBurnForm)}
          className="burn-request-toggle"
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #ff6b35 0%, #ff5722 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
        >
          {showBurnForm ? 'Hide Burn Request Form' : '🔥 Submit New Burn Request'}
        </button>
      </div>

      {showBurnForm && (
        <div style={{ marginBottom: '3rem' }}>
          <BurnRequestForm 
            onSubmitSuccess={(data) => {
              setShowBurnForm(false);
              fetchBurnRequests();
              fetchAnalytics();
              toast.success('Burn request processed by 5-agent system!');
            }}
          />
        </div>
      )}

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Burns</h3>
          <div className="metric-value">{analytics?.burns?.total_burns || 0}</div>
          <div className="metric-subtext">
            {analytics?.burns?.upcoming_burns || 0} upcoming
          </div>
        </div>

        <div className="metric-card">
          <h3>Active Conflicts</h3>
          <div className="metric-value conflicts">
            {analytics?.conflicts?.total_conflicts || 0}
          </div>
          <div className="metric-subtext">
            {analytics?.conflicts?.resolved_conflicts || 0} resolved
          </div>
        </div>

        <div className="metric-card">
          <h3>Total Area</h3>
          <div className="metric-value">
            {(analytics?.areas?.total_area_burned || 0).toFixed(1)} ha
          </div>
          <div className="metric-subtext">
            {analytics?.areas?.active_farms || 0} farms
          </div>
        </div>

        <div className="metric-card">
          <h3>Alerts Sent</h3>
          <div className="metric-value">{analytics?.alerts?.total_alerts || 0}</div>
          <div className="metric-subtext">
            {analytics?.alerts?.deliveryRate || 0}% delivered
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Burn Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#999'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Hourly Burn Schedule</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="burns" fill="#ff6b35" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card full-width">
          <h3>Crop Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cropData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="crop" />
              <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
              <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#ff6b35" name="Count" />
              <Bar yAxisId="right" dataKey="area" fill="#FFB000" name="Area (ha)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      <style jsx>{`
        .dashboard {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          min-height: 100vh;
          background: linear-gradient(180deg, #000 0%, rgba(10, 10, 10, 0.95) 100%);
          font-family: 'Inter', sans-serif;
          color: white;
        }

        .dashboard-header {
          margin-bottom: 3rem;
          text-align: center;
        }

        .dashboard-header h2 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(255, 107, 53, 0.3);
        }

        .dashboard-header p {
          font-size: 1.2rem;
          opacity: 0.8;
          color: #ff6b35;
          font-weight: 500;
        }

        .dashboard-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 60vh;
          color: white;
        }

        .dashboard-loading .spinner {
          border-top: 4px solid #ff6b35;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2rem;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle at 50% 0%,
            rgba(255, 107, 53, 0.1) 0%,
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.4s;
        }

        .metric-card:hover {
          transform: translateY(-10px);
          border-color: rgba(255, 107, 53, 0.3);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 40px rgba(255, 107, 53, 0.1);
        }

        .metric-card:hover::before {
          opacity: 1;
        }

        .metric-card h3 {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 600;
        }

        .metric-value {
          font-size: 3rem;
          font-weight: 900;
          color: white;
          line-height: 1;
          margin-bottom: 0.5rem;
        }

        .metric-value.conflicts {
          color: #ff6b35;
          text-shadow: 0 0 20px rgba(255, 107, 53, 0.5);
        }

        .metric-subtext {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .chart-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2rem;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .chart-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle at 50% 0%,
            rgba(255, 107, 53, 0.05) 0%,
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.4s;
        }

        .chart-card:hover {
          transform: translateY(-5px);
          border-color: rgba(255, 107, 53, 0.2);
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
        }

        .chart-card:hover::before {
          opacity: 1;
        }

        .chart-card.full-width {
          grid-column: 1 / -1;
        }

        .chart-card h3 {
          color: white;
          margin-bottom: 1.5rem;
          font-size: 1.3rem;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .dashboard {
            padding: 1.5rem;
          }
          
          .metrics-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          
          .charts-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          
          .metric-card, .chart-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;