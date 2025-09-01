import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import '../styles/BurnRequestForm.css';

const BurnRequestForm = ({ onSubmitSuccess }) => {
  const [formData, setFormData] = useState({
    farm_id: '',
    field_name: '',
    acres: '',
    crop_type: 'wheat',
    burn_date: '',
    time_window_start: '08:00',
    time_window_end: '16:00',
    special_considerations: '',
    contact_method: 'email'
  });

  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState({
    coordinator: 'idle',
    weather: 'idle',
    predictor: 'idle',
    optimizer: 'idle',
    alerts: 'idle'
  });

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/farms`);
      const data = await response.json();
      if (data.success) {
        setFarms(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching farms:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const simulateAgentWorkflow = async () => {
    // Simulate the 5-agent workflow visually
    const agents = ['coordinator', 'weather', 'predictor', 'optimizer', 'alerts'];
    
    for (const agent of agents) {
      setAgentStatus(prev => ({ ...prev, [agent]: 'processing' }));
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing
      setAgentStatus(prev => ({ ...prev, [agent]: 'complete' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Start agent workflow animation
    simulateAgentWorkflow();

    try {
      // Call the actual coordinator endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/burn-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          farm_id: parseInt(formData.farm_id),
          acres: parseFloat(formData.acres),
          field_boundary: {
            type: 'Polygon',
            coordinates: [[
              [-120.5, 37.5],
              [-120.4, 37.5],
              [-120.4, 37.4],
              [-120.5, 37.4],
              [-120.5, 37.5]
            ]]
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Burn request submitted successfully!');
        
        // Show agent results
        toast.success(`Priority Score: ${data.data.priority_score || 'Calculating...'}`);
        
        if (onSubmitSuccess) {
          onSubmitSuccess(data.data);
        }

        // Reset form
        setFormData({
          farm_id: '',
          field_name: '',
          acres: '',
          crop_type: 'wheat',
          burn_date: '',
          time_window_start: '08:00',
          time_window_end: '16:00',
          special_considerations: '',
          contact_method: 'email'
        });
      } else {
        toast.error(data.message || 'Failed to submit burn request');
      }
    } catch (error) {
      console.error('Error submitting burn request:', error);
      toast.error('Failed to connect to coordinator agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="burn-request-form-container">
      <h2 className="form-title">Submit Burn Request</h2>
      
      {/* Agent Status Display */}
      <div className="agent-workflow-status">
        <h3>5-Agent Workflow Status</h3>
        <div className="agent-status-grid">
          <div className={`agent-status agent-coordinator ${agentStatus.coordinator}`}>
            <span className="agent-icon">C</span>
            <span className="agent-name">Coordinator</span>
            <span className="agent-state">{agentStatus.coordinator}</span>
          </div>
          <div className={`agent-status agent-weather ${agentStatus.weather}`}>
            <span className="agent-icon">W</span>
            <span className="agent-name">Weather</span>
            <span className="agent-state">{agentStatus.weather}</span>
          </div>
          <div className={`agent-status agent-predictor ${agentStatus.predictor}`}>
            <span className="agent-icon">P</span>
            <span className="agent-name">Predictor</span>
            <span className="agent-state">{agentStatus.predictor}</span>
          </div>
          <div className={`agent-status agent-optimizer ${agentStatus.optimizer}`}>
            <span className="agent-icon">O</span>
            <span className="agent-name">Optimizer</span>
            <span className="agent-state">{agentStatus.optimizer}</span>
          </div>
          <div className={`agent-status agent-alerts ${agentStatus.alerts}`}>
            <span className="agent-icon">A</span>
            <span className="agent-name">Alerts</span>
            <span className="agent-state">{agentStatus.alerts}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="burn-request-form">
        <div className="form-group">
          <label htmlFor="farm_id">Farm</label>
          <select
            id="farm_id"
            name="farm_id"
            value={formData.farm_id}
            onChange={handleChange}
            required
          >
            <option value="">Select a farm</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>
                {farm.name} - {farm.owner_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="field_name">Field Name</label>
          <input
            type="text"
            id="field_name"
            name="field_name"
            value={formData.field_name}
            onChange={handleChange}
            placeholder="e.g., North Field Section A"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="acres">Acres</label>
            <input
              type="number"
              id="acres"
              name="acres"
              value={formData.acres}
              onChange={handleChange}
              min="1"
              max="10000"
              step="0.1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="crop_type">Crop Type</label>
            <select
              id="crop_type"
              name="crop_type"
              value={formData.crop_type}
              onChange={handleChange}
              required
            >
              <option value="rice">Rice</option>
              <option value="wheat">Wheat</option>
              <option value="corn">Corn</option>
              <option value="barley">Barley</option>
              <option value="oats">Oats</option>
              <option value="sorghum">Sorghum</option>
              <option value="cotton">Cotton</option>
              <option value="soybeans">Soybeans</option>
              <option value="sunflower">Sunflower</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="burn_date">Requested Burn Date</label>
          <input
            type="date"
            id="burn_date"
            name="burn_date"
            value={formData.burn_date}
            onChange={handleChange}
            min={new Date().toISOString().split('T')[0]}
            max={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="time_window_start">Start Time</label>
            <input
              type="time"
              id="time_window_start"
              name="time_window_start"
              value={formData.time_window_start}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="time_window_end">End Time</label>
            <input
              type="time"
              id="time_window_end"
              name="time_window_end"
              value={formData.time_window_end}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="special_considerations">Special Considerations (Optional)</label>
          <textarea
            id="special_considerations"
            name="special_considerations"
            value={formData.special_considerations}
            onChange={handleChange}
            rows="3"
            placeholder="Any special requirements or concerns..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="contact_method">Preferred Contact Method</label>
          <select
            id="contact_method"
            name="contact_method"
            value={formData.contact_method}
            onChange={handleChange}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="both">Both</option>
          </select>
        </div>

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Processing with 5-Agent System...' : 'Submit Burn Request'}
        </button>
      </form>

      {/* Vector Search Indicator */}
      <div className="vector-info">
        <p className="vector-note">
          This form triggers TiDB vector search with:
        </p>
        <ul className="vector-list">
          <li>128-dimensional weather pattern matching</li>
          <li>64-dimensional smoke dispersion vectors</li>
          <li>32-dimensional terrain analysis</li>
          <li>VEC_COSINE_DISTANCE similarity search</li>
        </ul>
      </div>
    </div>
  );
};

export default BurnRequestForm;