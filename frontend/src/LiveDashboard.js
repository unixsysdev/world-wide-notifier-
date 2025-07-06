import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import useWebSocket from './hooks/useWebSocket';
import JobCard from './components/JobCard';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const LiveDashboard = ({ user, userSubscription }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [runningJobs, setRunningJobs] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message) => {
    console.log('Dashboard WebSocket message:', message);
    
    switch (message.type) {
      case 'new_alert':
        // Update dashboard data to reflect new alert count
        setDashboardData(prev => prev ? {
          ...prev,
          alerts: {
            ...prev.alerts,
            total: (prev.alerts?.total || 0) + 1
          }
        } : prev);
        break;
        
      case 'job_execution_update':
        // Update specific running job data
        setRunningJobs(prev => prev.map(job => 
          job.run_id === message.data.run_id 
            ? { ...job, ...message.data }
            : job
        ));
        break;
        
      case 'dashboard_stats_update':
        // Update dashboard statistics
        setDashboardData(prev => ({
          ...prev,
          ...message.data
        }));
        break;
        
      case 'job_status_change':
        // Refresh running jobs when job starts/completes
        fetchRunningJobs();
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
    
    setLastUpdate(Date.now());
  }, []);

  // Initialize WebSocket connection
  const { isConnected, connectionStatus } = useWebSocket(user, handleWebSocketMessage);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.get(`${API_URL}/dashboard/live-stats`, { headers });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchRunningJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.get(`${API_URL}/dashboard/running-jobs`, { headers });
      setRunningJobs(response.data.running_jobs || []);
    } catch (error) {
      console.error('Error fetching running jobs:', error);
    }
  };

  const fetchExecutionHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const response = await axios.get(`${API_URL}/dashboard/job-execution-history`, { headers, params: { limit: 10 } });
      setExecutionHistory(response.data.execution_history || []);
    } catch (error) {
      console.error('Error fetching execution history:', error);
    }
  };

  const fetchAllDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDashboardStats(),
        fetchRunningJobs(),
        fetchExecutionHistory()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDashboardData();
  }, []);

  useEffect(() => {
    // Set up fallback polling - less frequent when WebSocket is connected
    let interval;
    if (autoRefresh) {
      // If WebSocket is connected, poll less frequently (30s) as a fallback
      // If not connected, poll more frequently (5s) for real-time updates
      const pollInterval = isConnected ? 30000 : 5000;
      interval = setInterval(() => {
        if (!isConnected) {
          // Only full refresh when WebSocket is not available
          fetchAllDashboardData();
        } else {
          // Light refresh - just get stats, running jobs update via WebSocket
          fetchDashboardStats();
        }
      }, pollInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isConnected]);

  const toggleJobExpansion = (runId) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedJobs(newExpanded);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return time.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading live dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <span className="mr-3 text-3xl">⚡</span>
          <div>
            <div>Live Execution Monitor</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-normal">Real-time job execution tracking</div>
          </div>
        </h1>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {/* WebSocket connection status */}
            <div className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              isConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}>
              {isConnected ? '🟢 Live' : `🟡 ${connectionStatus}`}
            </div>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                autoRefresh 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Live Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Configured Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-xl">
              <span className="text-xl">📋</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.total || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Jobs</div>
            </div>
          </div>
        </div>

        {/* Active (Enabled) Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-xl">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.active || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Active Jobs</div>
            </div>
          </div>
        </div>

        {/* Currently Running - LIVE EXECUTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-2 right-2">
            <div className={`w-2 h-2 rounded-full ${dashboardData?.jobs?.currently_running > 0 ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`}></div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-xl">
              <span className="text-xl">🏃</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.currently_running || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Executing Now</div>
            </div>
          </div>
          {dashboardData?.jobs?.currently_running > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 animate-pulse"></div>
          )}
        </div>

        {/* Total Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-red-100 dark:bg-red-900 p-2 rounded-xl">
              <span className="text-xl">🚨</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.alerts?.total || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Alerts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Running Jobs Section */}
      {runningJobs.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🏃</span>
            Live Executing Jobs
            <span className="ml-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded-full animate-pulse">
              {runningJobs.length} active
            </span>
          </h2>
          
          <div className="space-y-4">
            {runningJobs.map((job) => (
              <JobCard
                key={job.run_id}
                job={job}
                isExpanded={expandedJobs.has(job.run_id)}
                onToggleExpansion={toggleJobExpansion}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-md border border-gray-100 dark:border-gray-700 text-center">
          <div className="text-gray-400 dark:text-gray-500">
            <span className="text-4xl block mb-3">😴</span>
            <h3 className="text-lg font-medium mb-2">No Jobs Currently Running</h3>
            <p className="text-sm">Your monitoring jobs are idle right now. They will appear here when executing.</p>
          </div>
        </div>
      )}

      {/* 24-Hour Execution Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">📊</span>
          24-Hour Performance
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{dashboardData?.execution_stats?.runs_24h || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total Runs</div>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{dashboardData?.execution_stats?.completed_runs_24h || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Completed</div>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{dashboardData?.execution_stats?.failed_runs_24h || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Failed</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{dashboardData?.execution_stats?.sources_processed_24h || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sources</div>
          </div>
          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dashboardData?.execution_stats?.alerts_generated_24h || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Alerts</div>
          </div>
        </div>
      </div>

      {/* Recent Execution History */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <span className="mr-2">🕒</span>
          Recent Execution History
        </h2>
        
        {executionHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Job Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Sources</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Alerts</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Started</th>
                </tr>
              </thead>
              <tbody>
                {executionHistory.map((run) => (
                  <tr key={run.run_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">{run.job_name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(run.status)}`}>
                        {run.status}
                      </span>
                      {run.error_message && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1" title={run.error_message}>
                          Error: {run.error_message.substring(0, 30)}...
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{formatDuration(run.duration_seconds)}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{run.sources_processed}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{run.alerts_generated}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatTimeAgo(run.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500">
              <span className="text-4xl block mb-3">📊</span>
              <p>No execution history available yet</p>
              <p className="text-sm mt-1">History will appear here once your jobs start running</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveDashboard;
