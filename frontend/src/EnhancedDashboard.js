import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const EnhancedDashboard = ({ user, userSubscription, jobs, alerts, setShowCreateForm }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [runningJobs, setRunningJobs] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch enhanced dashboard stats
      const [statsResponse, runningResponse, historyResponse] = await Promise.all([
        axios.get(`${API_URL}/dashboard/live-stats`, { headers }),
        axios.get(`${API_URL}/dashboard/running-jobs`, { headers }),
        axios.get(`${API_URL}/dashboard/job-execution-history`, { headers, params: { limit: 10 } })
      ]);

      setDashboardData(statsResponse.data);
      setRunningJobs(runningResponse.data.running_jobs || []);
      setExecutionHistory(historyResponse.data.execution_history || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching enhanced dashboard data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 5 seconds if enabled
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

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

  const getStageColor = (stage) => {
    switch (stage) {
      case 'initializing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'scraping': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'analyzing': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'finalizing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'processing': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getOutcomeColor = (outcomeType) => {
    switch (outcomeType) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatEstimatedTime = (estimation) => {
    if (!estimation) return null;
    const minutes = Math.floor(estimation.estimated_remaining_seconds / 60);
    const seconds = estimation.estimated_remaining_seconds % 60;
    return minutes > 0 ? `~${minutes}m ${seconds}s` : `~${seconds}s`;
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <span className="mr-3 text-3xl">🚀</span>
          <div>
            <div>AI Monitoring Dashboard</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 font-normal">Welcome back, {user?.name}!</div>
          </div>
        </h1>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
            </button>
          </div>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 flex items-center space-x-2 text-sm"
          >
            <span className="text-lg">➕</span>
            <span>Create New Job</span>
          </button>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Configured Jobs */}
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

        {/* Active Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900 p-2 rounded-xl">
              <span className="text-xl">✅</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.active || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Active</div>
            </div>
          </div>
        </div>

        {/* Currently Running - THE STAR! */}
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
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-red-500 animate-pulse"></div>
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

        {/* Pending Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-xl">
              <span className="text-xl">⚠️</span>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.alerts?.unacknowledged || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Pending</div>
            </div>
          </div>
        </div>

        {/* Subscription Tier */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${userSubscription?.tier === 'free' ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-purple-100 dark:bg-purple-900'}`}>
              <span className="text-xl">{userSubscription?.tier === 'free' ? '🆓' : '⭐'}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800 dark:text-white capitalize">{userSubscription?.tier || 'Free'}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Plan</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Running Jobs Section - THIS IS THE GOOD STUFF! */}
      {runningJobs.length > 0 && (
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
              <div key={job.run_id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden">
                {/* Animated background for running state */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 animate-pulse"></div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{job.job_name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(job.current_stage)} animate-pulse`}>
                          {job.current_stage.charAt(0).toUpperCase() + job.current_stage.slice(1)}
                        </span>
                        {job.stage_details?.current_operation && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded-full">
                            {job.stage_details.current_operation}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center space-x-1">
                          <span>⏱️</span>
                          <span>Runtime: {formatDuration(job.runtime_seconds)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>🌐</span>
                          <span>Sources: {job.sources_processed}/{job.sources_total}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>🚨</span>
                          <span>Alerts: {job.alerts_generated}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span>📊</span>
                          <span>{job.completion_percentage}% complete</span>
                        </div>
                      </div>

                      {/* Enhanced Progress Bar with stage indicators */}
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>Progress</span>
                          <div className="flex items-center space-x-2">
                            <span>{job.completion_percentage}%</span>
                            {job.estimated_completion && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                ETA: {formatEstimatedTime(job.estimated_completion)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 relative">
                          <div
                            className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                            style={{ width: `${job.completion_percentage}%` }}
                          >
                            <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                          </div>
                          {/* Stage markers */}
                          <div className="absolute top-0 left-0 right-0 h-3 flex">
                            <div className="flex-1 border-r border-white border-opacity-50"></div>
                            <div className="flex-1 border-r border-white border-opacity-50"></div>
                            <div className="flex-1"></div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>Init</span>
                          <span>Scraping</span>
                          <span>Analyzing</span>
                          <span>Done</span>
                        </div>
                      </div>

                      {/* Current source being processed */}
                      {job.stage_details?.current_source && (
                        <div className="mb-3 p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Currently Processing:</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            🌐 {job.stage_details.current_source}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => toggleJobExpansion(job.run_id)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium text-sm whitespace-nowrap bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all"
                    >
                      {expandedJobs.has(job.run_id) ? '🔼 Hide Details' : '🔽 Show Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details with enhanced analysis */}
                {expandedJobs.has(job.run_id) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Job Configuration */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                          <span className="mr-2">⚙️</span>
                          Job Configuration
                        </h5>
                        <div className="space-y-1 text-sm">
                          <div><span className="font-medium">Threshold:</span> {job.threshold_score}</div>
                          <div><span className="font-medium">Prompt:</span> {job.job_prompt}</div>
                          <div><span className="font-medium">Sources Total:</span> {job.sources_total}</div>
                        </div>
                      </div>

                      {/* Execution Stats */}
                      <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <h5 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                          <span className="mr-2">📈</span>
                          Execution Stats
                        </h5>
                        <div className="space-y-1 text-sm">
                          <div><span className="font-medium">Started:</span> {formatTimeAgo(job.started_at)}</div>
                          {job.estimated_completion && (
                            <div><span className="font-medium">Avg/Source:</span> {job.estimated_completion.avg_time_per_source}s</div>
                          )}
                          <div><span className="font-medium">Stage:</span> {job.stage_details?.current_operation || 'Processing...'}</div>
                        </div>
                      </div>
                    </div>

                    <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <span className="mr-2">🔍</span>
                      Analysis Results ({job.analysis_details?.length || 0} processed)
                    </h4>
                    {job.analysis_details && job.analysis_details.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {job.analysis_details.map((detail, index) => (
                          <div key={index} className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-4">
                                🌐 {detail.source_url}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getOutcomeColor(detail.outcome_type)}`}>
                                  {detail.stage_outcome}
                                </span>
                                {detail.alert_generated && (
                                  <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                                    🚨 Alert!
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">
                              <div className="font-medium">{detail.title}</div>
                              <div className="text-gray-600 dark:text-gray-400 mt-1">{detail.summary}</div>
                            </div>
                            {detail.processed_at && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Processed: {formatTimeAgo(detail.processed_at)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="text-gray-400 dark:text-gray-500 text-sm">
                          <span className="text-2xl block mb-2 animate-spin">⚡</span>
                          {job.current_stage === 'initializing' && 'Initializing job execution...'}
                          {job.current_stage === 'scraping' && 'Scraping sources for content...'}
                          {job.current_stage === 'analyzing' && 'Analyzing content with AI...'}
                          {job.current_stage === 'finalizing' && 'Finalizing results...'}
                          {!['initializing', 'scraping', 'analyzing', 'finalizing'].includes(job.current_stage) && 'Processing job data...'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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

export default EnhancedDashboard;