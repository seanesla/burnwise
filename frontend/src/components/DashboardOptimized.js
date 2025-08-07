import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { 
  FaFire, FaCloudSun, FaExclamationTriangle, 
  FaCalendarAlt, FaChartLine, FaLeaf 
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

// Memoized stat card component
const StatCard = memo(({ icon: Icon, title, value, trend, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.02 }}
    className="glass-card p-6 flex items-center justify-between"
  >
    <div>
      <p className="text-gray-400 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {trend && (
        <p className={`text-sm mt-2 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </p>
      )}
    </div>
    <Icon className={`text-3xl ${color}`} />
  </motion.div>
));

// Memoized activity item component
const ActivityItem = memo(({ activity }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="p-4 border-l-2 border-fire-orange hover:bg-white/5 transition-colors"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white font-medium">{activity.description}</p>
        <p className="text-gray-400 text-sm">{activity.farm}</p>
      </div>
      <span className="text-gray-500 text-sm">{activity.time}</span>
    </div>
  </motion.div>
));

const DashboardOptimized = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBurns: 0,
    activeFarms: 0,
    weatherScore: 0,
    alerts: 0,
    completedBurns: 0,
    upcomingBurns: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoized fetch functions
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Parallel fetch for better performance
      const [statsResponse, activityResponse] = await Promise.all([
        fetch('/api/analytics/dashboard-stats', {
          headers: { 'Cache-Control': 'max-age=60' }
        }),
        fetch('/api/analytics/recent-activity', {
          headers: { 'Cache-Control': 'max-age=60' }
        })
      ]);

      if (!statsResponse.ok || !activityResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statsData, activityData] = await Promise.all([
        statsResponse.json(),
        activityResponse.json()
      ]);

      setStats(statsData.data || stats);
      setRecentActivity(activityData.data || []);
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Memoized navigation handlers
  const handleNavigate = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  // Memoized stats configuration
  const statsConfig = useMemo(() => [
    {
      icon: FaFire,
      title: 'Total Burn Requests',
      value: stats.totalBurns,
      trend: 12,
      color: 'text-fire-orange'
    },
    {
      icon: FaLeaf,
      title: 'Active Farms',
      value: stats.activeFarms,
      trend: 5,
      color: 'text-green-500'
    },
    {
      icon: FaCloudSun,
      title: 'Weather Score',
      value: `${stats.weatherScore}/100`,
      trend: -3,
      color: 'text-blue-400'
    },
    {
      icon: FaExclamationTriangle,
      title: 'Active Alerts',
      value: stats.alerts,
      trend: 0,
      color: 'text-yellow-500'
    }
  ], [stats]);

  // Memoized quick actions
  const quickActions = useMemo(() => [
    {
      title: 'Submit Burn Request',
      icon: FaFire,
      path: '/request',
      color: 'from-fire-orange to-fire-red'
    },
    {
      title: 'View Schedule',
      icon: FaCalendarAlt,
      path: '/schedule',
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Check Weather',
      icon: FaCloudSun,
      path: '/weather',
      color: 'from-green-500 to-green-600'
    },
    {
      title: 'Analytics',
      icon: FaChartLine,
      path: '/analytics',
      color: 'from-purple-500 to-purple-600'
    }
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-dark">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-dark">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Dashboard Error</h2>
          <p className="text-gray-400">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 px-6 py-2 bg-fire-orange text-white rounded-lg hover:bg-fire-orange-light transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Burn Coordination Dashboard
          </h1>
          <p className="text-gray-400">
            Real-time overview of agricultural burn management
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsConfig.map((stat, index) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 glass-card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Recent Activity
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <ActivityItem key={index} activity={activity} />
                ))
              ) : (
                <p className="text-gray-400 text-center py-8">
                  No recent activity
                </p>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <motion.button
                  key={action.title}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleNavigate(action.path)}
                  className={`w-full p-4 rounded-lg bg-gradient-to-r ${action.color} text-white flex items-center justify-between transition-all duration-200 hover:shadow-lg`}
                >
                  <span className="font-medium">{action.title}</span>
                  <action.icon className="text-xl" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Weather Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Weather Conditions
            </h2>
            <button 
              onClick={() => handleNavigate('/weather')}
              className="text-fire-orange hover:text-fire-orange-light transition-colors"
            >
              View Details →
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Temperature</p>
              <p className="text-2xl font-bold text-white">72°F</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm">Wind Speed</p>
              <p className="text-2xl font-bold text-white">8 mph</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm">Humidity</p>
              <p className="text-2xl font-bold text-white">45%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm">Air Quality</p>
              <p className="text-2xl font-bold text-green-400">Good</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardOptimized;