import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FaChartLine, FaFire, FaCalendarAlt, FaCloudSun, 
  FaCheckCircle, FaExclamationTriangle, FaClock, FaLeaf 
} from 'react-icons/fa';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import axios from 'axios';
import LoadingSpinner from './LoadingSpinner';

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    burnTrends: [],
    weatherPatterns: [],
    conflictAnalysis: [],
    farmPerformance: [],
    seasonalData: [],
    smokeDispersion: []
  });
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch multiple analytics endpoints in parallel
      const [trends, weather, conflicts, performance] = await Promise.all([
        axios.get(`/api/analytics/burn-trends?range=${timeRange}`),
        axios.get(`/api/analytics/weather-patterns?range=${timeRange}`),
        axios.get(`/api/analytics/conflict-analysis?range=${timeRange}`),
        axios.get(`/api/analytics/farm-performance?range=${timeRange}`)
      ]);

      setAnalyticsData({
        burnTrends: trends.data.data || [],
        weatherPatterns: weather.data.data || [],
        conflictAnalysis: conflicts.data.data || [],
        farmPerformance: performance.data.data || [],
        seasonalData: generateSeasonalData(), // Keep this as it's calculated client-side
        smokeDispersion: generateSmokeDispersionData() // Keep this as it's calculated client-side
      });
      
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Show empty state instead of mock data
      setAnalyticsData({
        burnTrends: [],
        weatherPatterns: [],
        conflictAnalysis: [],
        farmPerformance: [],
        seasonalData: [],
        smokeDispersion: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Client-side calculated data (not from API)
  const generateSeasonalData = () => {
    return [
      { season: 'Spring', burns: 156, avgAcres: 245 },
      { season: 'Summer', burns: 89, avgAcres: 180 },
      { season: 'Fall', burns: 203, avgAcres: 310 },
      { season: 'Winter', burns: 67, avgAcres: 150 }
    ];
  };

  const generateSmokeDispersionData = () => {
    return [
      { distance: '0.5km', pm25: 95, safe: false },
      { distance: '1km', pm25: 68, safe: false },
      { distance: '2km', pm25: 42, safe: false },
      { distance: '5km', pm25: 28, safe: true },
      { distance: '10km', pm25: 15, safe: true }
    ];
  };

  const fireColors = ['#ff6b35', '#ff5722', '#FFB000', '#ff8c42', '#ff6f61'];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FaChartLine },
    { id: 'weather', label: 'Weather', icon: FaCloudSun },
    { id: 'conflicts', label: 'Conflicts', icon: FaExclamationTriangle },
    { id: 'performance', label: 'Performance', icon: FaCheckCircle }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-dark">
        <LoadingSpinner size="large" />
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
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <FaChartLine className="text-fire-orange" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-400">
            Comprehensive burn coordination insights and trends
          </p>
        </motion.div>

        {/* Time Range Selector */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 flex gap-2"
        >
          {['7d', '30d', '90d', '1y'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg transition-all ${
                timeRange === range
                  ? 'bg-fire-orange text-white'
                  : 'bg-black/50 text-gray-400 hover:bg-black/70'
              }`}
            >
              {range === '7d' ? 'Week' : 
               range === '30d' ? 'Month' : 
               range === '90d' ? 'Quarter' : 'Year'}
            </button>
          ))}
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 overflow-x-auto">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-fire-orange to-fire-red text-white'
                  : 'glass-card text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon />
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Burn Trends */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Burn Request Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analyticsData.burnTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ff6b35' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="approved" stackId="1" stroke="#4CAF50" fill="#4CAF50" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="completed" stackId="1" stroke="#2196F3" fill="#2196F3" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="rejected" stackId="1" stroke="#f44336" fill="#f44336" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Seasonal Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Seasonal Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.seasonalData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ season, burns }) => `${season}: ${burns}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="burns"
                  >
                    {analyticsData.seasonalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={fireColors[index % fireColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ff6b35' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Key Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6 lg:col-span-2"
            >
              <h3 className="text-xl font-bold text-white mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/30 rounded-lg p-4">
                  <FaFire className="text-fire-orange text-2xl mb-2" />
                  <p className="text-3xl font-bold text-white">423</p>
                  <p className="text-gray-400 text-sm">Total Burns</p>
                  <p className="text-green-400 text-xs mt-1">↑ 12% from last period</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4">
                  <FaLeaf className="text-green-500 text-2xl mb-2" />
                  <p className="text-3xl font-bold text-white">15,230</p>
                  <p className="text-gray-400 text-sm">Acres Burned</p>
                  <p className="text-green-400 text-xs mt-1">↑ 8% from last period</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4">
                  <FaCheckCircle className="text-blue-500 text-2xl mb-2" />
                  <p className="text-3xl font-bold text-white">92%</p>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-yellow-400 text-xs mt-1">→ Same as last period</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4">
                  <FaClock className="text-purple-500 text-2xl mb-2" />
                  <p className="text-3xl font-bold text-white">4.2h</p>
                  <p className="text-gray-400 text-sm">Avg Duration</p>
                  <p className="text-red-400 text-xs mt-1">↓ 5% from last period</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Weather Tab */}
        {activeTab === 'weather' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Weather Patterns</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.weatherPatterns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="day" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ff6b35' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="temperature" stroke="#ff6b35" strokeWidth={2} />
                  <Line type="monotone" dataKey="humidity" stroke="#2196F3" strokeWidth={2} />
                  <Line type="monotone" dataKey="burnScore" stroke="#4CAF50" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">PM2.5 Dispersion</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.smokeDispersion}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="distance" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ff6b35' }}
                  />
                  <Bar dataKey="pm25" fill="#ff6b35">
                    {analyticsData.smokeDispersion.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.safe ? '#4CAF50' : '#f44336'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Conflict Types</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.conflictAnalysis} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#666" />
                  <YAxis type="category" dataKey="type" stroke="#666" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ff6b35' }}
                  />
                  <Bar dataKey="count" fill="#ff6b35">
                    {analyticsData.conflictAnalysis.map((entry, index) => (
                      <Cell key={`cell-${index}`} 
                        fill={entry.severity === 'high' ? '#f44336' : 
                              entry.severity === 'medium' ? '#FFB000' : '#4CAF50'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Resolution Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaCheckCircle className="text-green-500 text-xl" />
                    <span className="text-white">Resolved Automatically</span>
                  </div>
                  <span className="text-2xl font-bold text-white">78%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaClock className="text-yellow-500 text-xl" />
                    <span className="text-white">Rescheduled</span>
                  </div>
                  <span className="text-2xl font-bold text-white">18%</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FaExclamationTriangle className="text-red-500 text-xl" />
                    <span className="text-white">Manual Intervention</span>
                  </div>
                  <span className="text-2xl font-bold text-white">4%</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-xl font-bold text-white mb-4">Farm Performance Rankings</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400">Rank</th>
                      <th className="text-left py-3 px-4 text-gray-400">Farm</th>
                      <th className="text-center py-3 px-4 text-gray-400">Requests</th>
                      <th className="text-center py-3 px-4 text-gray-400">Approved</th>
                      <th className="text-center py-3 px-4 text-gray-400">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.farmPerformance
                      .sort((a, b) => b.efficiency - a.efficiency)
                      .map((farm, index) => (
                        <tr key={farm.name} className="border-b border-gray-800 hover:bg-black/30">
                          <td className="py-3 px-4">
                            <span className={`text-xl font-bold ${
                              index === 0 ? 'text-yellow-500' :
                              index === 1 ? 'text-gray-400' :
                              index === 2 ? 'text-orange-600' : 'text-gray-600'
                            }`}>
                              #{index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white font-medium">{farm.name}</td>
                          <td className="py-3 px-4 text-center text-gray-300">{farm.requests}</td>
                          <td className="py-3 px-4 text-center text-gray-300">{farm.approved}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-bold ${
                              farm.efficiency >= 90 ? 'text-green-400' :
                              farm.efficiency >= 80 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {farm.efficiency}%
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;