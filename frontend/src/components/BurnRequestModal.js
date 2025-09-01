import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './BurnRequestModal.css';

const BurnRequestModal = ({ farms, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    farm_id: farms[0]?.farm_id || '',
    crop_type: 'wheat',
    acreage: 50,
    requested_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    requested_window_start: '08:00',
    requested_window_end: '12:00',
    reason: 'Agricultural field preparation'
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/burn-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Burn request created! ID: ${result.data?.burn_request_id || 'N/A'}`);
        onSuccess(result.data);
      } else {
        toast.error(result.error || 'Failed to create burn request');
        if (result.details) {
          result.details.forEach(detail => {
            toast.error(`${detail.field}: ${detail.message}`);
          });
        }
      }
    } catch (error) {
      console.error('Error submitting burn request:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-content burn-request-modal"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2>Request Agricultural Burn</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <form onSubmit={handleSubmit} className="burn-request-form">
            <div className="form-group">
              <label htmlFor="farm_id">Select Farm</label>
              <select
                id="farm_id"
                name="farm_id"
                value={formData.farm_id}
                onChange={handleChange}
                required
              >
                <option value="">-- Select Farm --</option>
                {farms.map(farm => (
                  <option key={farm.farm_id} value={farm.farm_id}>
                    {farm.farm_name} ({farm.owner_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="crop_type">Crop Type</label>
                <select
                  id="crop_type"
                  name="crop_type"
                  value={formData.crop_type}
                  onChange={handleChange}
                  required
                >
                  <option value="wheat">Wheat</option>
                  <option value="rice">Rice</option>
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

              <div className="form-group">
                <label htmlFor="acreage">Acreage</label>
                <input
                  type="number"
                  id="acreage"
                  name="acreage"
                  value={formData.acreage}
                  onChange={handleChange}
                  min="1"
                  max="10000"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="requested_date">Requested Burn Date</label>
              <input
                type="date"
                id="requested_date"
                name="requested_date"
                value={formData.requested_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="requested_window_start">Start Time</label>
                <input
                  type="time"
                  id="requested_window_start"
                  name="requested_window_start"
                  value={formData.requested_window_start}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="requested_window_end">End Time</label>
                <input
                  type="time"
                  id="requested_window_end"
                  name="requested_window_end"
                  value={formData.requested_window_end}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason for Burn</label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows="3"
                placeholder="Describe the purpose of this burn..."
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Processing...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BurnRequestModal;