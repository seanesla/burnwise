import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const Schedule = ({ burnRequests, selectedDate, onRefresh }) => {
  const [optimizing, setOptimizing] = useState(false);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    fetchSchedule();
  }, [selectedDate]);

  const fetchSchedule = async () => {
    try {
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 6);
      
      const response = await fetch(
        `http://localhost:5001/api/schedule/calendar?startDate=${selectedDate}&endDate=${endDate.toISOString().split('T')[0]}`
      );
      
      const data = await response.json();
      if (data.success) {
        setSchedule(data.data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  const runOptimization = async () => {
    setOptimizing(true);
    
    try {
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 3);
      
      const response = await fetch('http://localhost:5001/api/schedule/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: selectedDate,
          endDate: endDate.toISOString().split('T')[0]
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Optimization complete! ${result.data.improvements.conflictsResolved} conflicts resolved`);
        await fetchSchedule();
        await onRefresh();
      } else {
        toast.error('Optimization failed');
      }
    } catch (error) {
      toast.error('Error running optimization');
      console.error('Optimization error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const detectConflicts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/burn-requests/detect-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate })
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.count > 0) {
          toast.error(`${result.count} conflicts detected for ${selectedDate}`);
        } else {
          toast.success('No conflicts detected');
        }
      }
    } catch (error) {
      toast.error('Error detecting conflicts');
      console.error('Error:', error);
    }
  };

  const groupByDate = () => {
    const grouped = {};
    schedule.forEach(item => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item);
    });
    return grouped;
  };

  const groupedSchedule = groupByDate();
  const dates = Object.keys(groupedSchedule).sort();

  return (
    <div className="schedule-container">
      <div className="schedule-header">
        <h2>Burn Schedule Calendar</h2>
        <div className="schedule-actions">
          <button 
            className="btn btn-primary" 
            onClick={runOptimization}
            disabled={optimizing}
          >
            {optimizing ? 'Optimizing...' : 'Run Optimization'}
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={detectConflicts}
          >
            Detect Conflicts
          </button>
        </div>
      </div>

      <div className="schedule-grid">
        {dates.map(date => (
          <div key={date} className="day-column">
            <div className="day-header">
              <h3>{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</h3>
              <p>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              <span className="burn-count">{groupedSchedule[date].length} burns</span>
            </div>
            
            <div className="day-burns">
              {groupedSchedule[date].map(burn => (
                <div key={burn.request_id} className={`burn-card status-${burn.status}`}>
                  <div className="burn-time">
                    {burn.start_time?.substring(0, 5)} - {burn.end_time?.substring(0, 5)}
                  </div>
                  <div className="burn-farm">{burn.farm_name}</div>
                  <div className="burn-details">
                    <span className="burn-area">{burn.area_hectares}ha</span>
                    <span className="burn-crop">{burn.crop_type}</span>
                  </div>
                  <div className={`burn-status ${burn.status}`}>
                    {burn.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .schedule-container {
          padding: 2rem;
          max-width: 1400px;
          margin: 0 auto;
          min-height: 100vh;
          background: linear-gradient(180deg, #000 0%, rgba(10, 10, 10, 0.95) 100%);
          font-family: 'Inter', sans-serif;
          color: white;
        }

        .schedule-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
        }

        .schedule-header h2 {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 900;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(255, 107, 53, 0.3);
        }

        .schedule-actions {
          display: flex;
          gap: 1rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .btn-primary {
          background: linear-gradient(135deg, #ff6b35 0%, #ff5722 100%);
          color: white;
          box-shadow: 0 4px 20px rgba(255, 107, 53, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 40px rgba(255, 107, 53, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(20px);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.4);
          transform: translateY(-2px);
        }

        .schedule-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .day-column {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .day-column:hover {
          transform: translateY(-5px);
          border-color: rgba(255, 107, 53, 0.2);
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4);
        }

        .day-header {
          background: linear-gradient(135deg, #ff6b35 0%, #ff5722 100%);
          color: white;
          padding: 1.5rem 1rem;
          text-align: center;
          position: relative;
        }

        .day-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            circle at 50% 0%,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 70%
          );
        }

        .day-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          position: relative;
          z-index: 1;
        }

        .day-header p {
          margin: 0.25rem 0;
          font-size: 0.9rem;
          opacity: 0.9;
          position: relative;
          z-index: 1;
        }

        .burn-count {
          display: inline-block;
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 15px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-top: 0.5rem;
          position: relative;
          z-index: 1;
        }

        .day-burns {
          padding: 1rem;
        }

        .burn-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-left: 4px solid;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          transition: all 0.3s ease;
        }

        .burn-card:hover {
          transform: translateX(8px);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }

        .burn-card.status-pending {
          border-color: #FFB000;
        }

        .burn-card.status-approved {
          border-color: #ff9800;
        }

        .burn-card.status-scheduled {
          border-color: #ff6b35;
        }

        .burn-card.status-active {
          border-color: #ff5722;
        }

        .burn-card.status-completed {
          border-color: rgba(255, 255, 255, 0.3);
        }

        .burn-time {
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .burn-farm {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .burn-details {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 0.75rem;
        }

        .burn-status {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
          padding: 0.5rem;
          border-radius: 8px;
          letter-spacing: 0.05em;
        }

        .burn-status.pending {
          background: #FFB000;
          color: white;
          box-shadow: 0 2px 8px rgba(255, 176, 0, 0.3);
        }

        .burn-status.approved {
          background: #ff9800;
          color: white;
          box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
        }

        .burn-status.scheduled {
          background: #ff6b35;
          color: white;
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
        }

        .burn-status.active {
          background: #ff5722;
          color: white;
          box-shadow: 0 2px 8px rgba(255, 87, 34, 0.3);
        }

        .burn-status.completed {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
          .schedule-container {
            padding: 1.5rem;
          }
          
          .schedule-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .schedule-actions {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            width: 100%;
            max-width: 300px;
          }
          
          .schedule-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Schedule;