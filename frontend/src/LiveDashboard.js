import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import useWebSocket from './hooks/useWebSocket';
import JobCard from './components/JobCard';
import { formatTimeAgoLocal, formatLocalDateTime, formatLocalTime, getTimezoneInfo } from './utils/timeUtils';

// Add CSS animations for smooth transitions
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInFadeIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes slideOutFadeOut {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    to {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
  }
  
  @keyframes alertGlow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
    }
    50% {
      box-shadow: 0 0 40px rgba(239, 68, 68, 0.8);
    }
  }
  
  @keyframes stageProgress {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
  
  @keyframes dataFlow {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .job-completing {
    animation: slideOutFadeOut 3s ease-in forwards;
  }
  
  .job-alert-generated {
    animation: alertGlow 2s ease-in-out infinite;
  }
  
  .stage-processing {
    background: linear-gradient(270deg, #3b82f6, #8b5cf6, #06b6d4, #10b981);
    background-size: 400% 400%;
    animation: stageProgress 3s ease infinite;
  }
  
  .data-flowing::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #3b82f6, transparent);
    animation: dataFlow 2s linear infinite;
  }
`;
document.head.appendChild(style);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const LiveDashboard = ({ user, userSubscription }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [runningJobs, setRunningJobs] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());

  // eslint-disable-next-line no-unused-vars
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [selectedJobRun, setSelectedJobRun] = useState(null);
  const [showJobRunModal, setShowJobRunModal] = useState(false);

  // Define fetch functions first to avoid hoisting issues
  const fetchDashboardStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔑 No auth token available for dashboard stats');
        return;
      }
      
      const response = await axios.get(`${API_URL}/dashboard/live-stats`);
      setDashboardData(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('🔑 Auth required for dashboard stats');
      } else {
        console.error('Error fetching dashboard stats:', error);
      }
    }
  }, []);

  const fetchRunningJobs = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔑 No auth token available for running jobs');
        return;
      }
      
      const response = await axios.get(`${API_URL}/dashboard/running-jobs`);
      setRunningJobs(response.data.running_jobs || []);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('🔑 Auth required for running jobs');
      } else {
        console.error('Error fetching running jobs:', error);
      }
    }
  }, []);

  const fetchExecutionHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔑 No auth token available for execution history');
        return;
      }
      
      const response = await axios.get(`${API_URL}/dashboard/job-execution-history`, { params: { limit: 10 } });
      setExecutionHistory(response.data.execution_history || []);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('🔑 Auth required for execution history');
      } else {
        console.error('Error fetching execution history:', error);
      }
    }
  }, []);

  // WebSocket message handler - FIXED to actually update the fucking UI!
  const handleWebSocketMessage = useCallback((message) => {
    console.log('🔥 LIVE UPDATE - WebSocket message received:', message.type, message);
    
    switch (message.type) {
      case 'new_alert':
        console.log('🚨 NEW ALERT - Updating dashboard counts');
        setDashboardData(prev => prev ? {
          ...prev,
          alerts: {
            ...prev.alerts,
            total: (prev.alerts?.total || 0) + 1,
            last_24_hours: (prev.alerts?.last_24_hours || 0) + 1
          }
        } : prev);
        break;
        
      case 'job_execution_update':
        console.log('🏃 JOB UPDATE - Running job state change:', message.data.run_id, message.data);
        setRunningJobs(prev => {
          console.log('👀 Current running jobs before update:', prev.length);
          
          // Check if this job already exists
          const jobExists = prev.some(job => job.run_id === message.data.run_id);
          
          if (!jobExists && message.data.status !== 'completed' && message.data.status !== 'failed') {
            // Add new job if it doesn't exist and isn't already done
            console.log('➕ Adding NEW running job:', message.data.run_id);
            const newJob = {
              ...message.data,
              runtime_seconds: 0,
              completion_percentage: 0,
              sources_processed: 0,
              alerts_generated: 0,
              started_at: new Date().toISOString()
            };
            return [...prev, newJob];
          }
          
          // Update existing job with enhanced stage data
          const updatedJobs = prev.map(job => {
            if (job.run_id === message.data.run_id) {
              console.log('🔄 Updating existing job:', job.run_id, 'from', job.current_stage, 'to', message.data.current_stage);
              
              // Calculate completion percentage based on sources
              const completionPercentage = job.sources_total > 0 
                ? Math.round((message.data.sources_processed || job.sources_processed || 0) / job.sources_total * 100)
                : 0;
              
              // Calculate runtime
              const startTime = new Date(job.started_at || Date.now());
              const runtime = Math.floor((Date.now() - startTime.getTime()) / 1000);
              
              return { 
                ...job, 
                ...message.data,
                completion_percentage: completionPercentage,
                runtime_seconds: runtime,
                // Preserve analysis details if not provided in update
                analysis_details: message.data.analysis_details || job.analysis_details || []
              };
            }
            return job;
          });
          
          console.log('👀 Running jobs after update:', updatedJobs.length);
          return updatedJobs;
        });
        
        // Handle job completion
        if (message.data.status === 'completed' || message.data.status === 'failed') {
          console.log('🏁 Job finishing, scheduling removal in 3 seconds:', message.data.run_id);
          setTimeout(() => {
            setRunningJobs(current => {
              const filtered = current.filter(job => job.run_id !== message.data.run_id);
              console.log('🗑️ Removed completed job, remaining:', filtered.length);
              return filtered;
            });
            // Refresh history to show the completed job
            fetchExecutionHistory();
          }, 3000);
        }
        break;
        
      case 'stage_update':
        console.log('🎭 STAGE UPDATE - Detailed stage progress:', message.data);
        setRunningJobs(prev => {
          return prev.map(job => {
            if (job.run_id === message.data.run_id) {
              console.log('🎬 Updating stage for job:', job.run_id, 'to stage:', message.data.current_stage);
              
              // Calculate runtime
              const startTime = new Date(job.started_at || Date.now());
              const runtime = Math.floor((Date.now() - startTime.getTime()) / 1000);
              
              return {
                ...job,
                current_stage: message.data.current_stage,
                stage_data: message.data.stage_data || {},
                runtime_seconds: runtime,
                last_stage_update: Date.now()
              };
            }
            return job;
          });
        });
        break;
        
      case 'dashboard_stats_update':
        console.log('📊 STATS UPDATE - Dashboard statistics');
        setDashboardData(prev => ({
          ...prev,
          ...message.data
        }));
        break;
        
      case 'job_status_change':
        console.log('🔄 JOB LIFECYCLE - Status change:', message.data);
        if (message.data.status === 'started') {
          console.log('🚀 New job started, fetching running jobs');
          fetchRunningJobs();
        }
        break;
        
      case 'job_removed':
        console.log('🗑️ JOB REMOVED - Removing from UI:', message.data.run_id);
        setRunningJobs(prev => prev.filter(job => job.run_id !== message.data.run_id));
        break;
        
      default:
        console.log('❓ UNKNOWN MESSAGE TYPE:', message.type, message.data);
    }
    
    setLastUpdate(Date.now());
  }, [fetchRunningJobs, fetchExecutionHistory]);

  // Initialize WebSocket connection
  const { isConnected, connectionStatus } = useWebSocket(user, handleWebSocketMessage);

  const fetchAllDashboardData = useCallback(async () => {
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
  }, [fetchDashboardStats, fetchRunningJobs, fetchExecutionHistory]);

  useEffect(() => {
    fetchAllDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log('🔄 Dashboard using intelligent auto-refresh with WebSocket PLUS backup polling');
    
    // Intelligent refresh intervals based on job activity
    const createRefreshInterval = () => {
      const hasActiveJobs = runningJobs.length > 0;
      const hasCompletingJobs = runningJobs.some(job => 
        job.current_stage === 'finalizing' || job.current_stage === 'completed'
      );
      
      // Faster refresh when jobs are completing, slower when idle
      const interval = hasCompletingJobs ? 5000 : hasActiveJobs ? 15000 : 30000;
      
      return setInterval(() => {
        console.log(`🔄 Smart refresh (${interval/1000}s): updating execution history and stats`);
        fetchExecutionHistory(); // Get recent history
        fetchDashboardStats();   // Get 24h performance stats
      }, interval);
    };
    
    // BACKUP MECHANISM - Poll running jobs every 10 seconds if WebSocket seems broken
    const backupJobPolling = setInterval(() => {
      console.log('🔒 BACKUP POLL - Checking for running jobs (WebSocket backup)');
      fetchRunningJobs();
    }, 10000);
    
    const refreshInterval = createRefreshInterval();
    
    return () => {
      clearInterval(refreshInterval);
      clearInterval(backupJobPolling);
    };
  }, [fetchExecutionHistory, fetchDashboardStats, fetchRunningJobs, runningJobs]);

  const toggleJobExpansion = (runId) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedJobs(newExpanded);
  };

  const handleJobRunClick = (run) => {
    setSelectedJobRun(run);
    setShowJobRunModal(true);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  // Use timezone-aware time formatting
  const formatTimeAgo = formatTimeAgoLocal;

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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <span className="mr-2 lg:mr-3 text-2xl lg:text-3xl animate-pulse">⚡</span>
          <div>
            <div className="flex items-center space-x-3">
              <span>Live Execution Monitor</span>
              {runningJobs.length > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {runningJobs.length} active job{runningJobs.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 font-normal">
              Real-time job execution tracking with AI analysis
              {runningJobs.length > 0 && (
                <span className="ml-2 text-blue-600 dark:text-blue-400">
                  • Processing {runningJobs.reduce((sum, job) => sum + (job.sources_total || 0), 0)} sources
                </span>
              )}
            </div>
          </div>
        </h1>
        
        <div className="flex items-center justify-between lg:justify-end gap-2">
          {/* WebSocket connection status */}
          <div className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {isConnected ? '🟢 Live' : `🟡 ${connectionStatus}`}
          </div>
          
          {/* Debug controls */}
          <button
            onClick={() => {
              console.log('🔍 MANUAL DEBUG - Current state:');
              console.log('Running jobs:', runningJobs);
              console.log('WebSocket connected:', isConnected);
              console.log('Last update:', new Date(lastUpdate));
              fetchRunningJobs();
            }}
            className="px-2 py-1 rounded-full text-xs font-medium transition-colors bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            🔍 Debug
          </button>
          
          <button
            onClick={() => {
              console.log('🔄 FORCE REFRESH - Running jobs');
              fetchRunningJobs();
              fetchExecutionHistory();
            }}
            className="px-2 py-1 rounded-full text-xs font-medium transition-colors bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800"
          >
            🔄 Force
          </button>
          
          <button
            onClick={() => {
              const tzInfo = getTimezoneInfo();
              console.log('🕐 TIMEZONE INFO:');
              console.log('Local Time:', tzInfo.localTime);
              console.log('UTC Time:', tzInfo.utcTime);
              console.log('Timezone Offset:', tzInfo.timezoneOffset, 'minutes');
              console.log('Timezone:', tzInfo.timezone);
              console.log('Running Jobs Start Times:');
              runningJobs.forEach(job => {
                console.log(`- ${job.job_name}: Server=${job.started_at}, Local=${formatLocalDateTime(job.started_at)}`);
              });
            }}
            className="px-2 py-1 rounded-full text-xs font-medium transition-colors bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
          >
            🕐 TZ
          </button>
          

        </div>
      </div>

      {/* Live Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Total Configured Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 lg:p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900 p-1.5 lg:p-2 rounded-xl flex-shrink-0">
              <span className="text-lg lg:text-xl">📋</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.total || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Jobs</div>
            </div>
          </div>
        </div>

        {/* Active (Enabled) Jobs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 lg:p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="bg-green-100 dark:bg-green-900 p-1.5 lg:p-2 rounded-xl flex-shrink-0">
              <span className="text-lg lg:text-xl">✅</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.active || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Active Jobs</div>
            </div>
          </div>
        </div>

        {/* Currently Running - LIVE EXECUTION */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 lg:p-4 shadow-md border border-gray-100 dark:border-gray-700 relative overflow-hidden">
          <div className="absolute top-2 right-2">
            <div className={`w-2 h-2 rounded-full ${dashboardData?.jobs?.currently_running > 0 ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`}></div>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="bg-orange-100 dark:bg-orange-900 p-1.5 lg:p-2 rounded-xl flex-shrink-0">
              <span className="text-lg lg:text-xl">🏃</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.jobs?.currently_running || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Executing Now</div>
            </div>
          </div>
          {dashboardData?.jobs?.currently_running > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 animate-pulse"></div>
          )}
        </div>

        {/* Total Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 lg:p-4 shadow-md border border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="bg-red-100 dark:bg-red-900 p-1.5 lg:p-2 rounded-xl flex-shrink-0">
              <span className="text-lg lg:text-xl">🚨</span>
            </div>
            <div className="min-w-0">
              <div className="text-lg lg:text-xl font-bold text-gray-800 dark:text-white">{dashboardData?.alerts?.total || 0}</div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Alerts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Stage Progress Summary */}
      {runningJobs.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-700">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center">
            <span className="mr-2">🎭</span>
            Live Stage Progress
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {['initializing', 'scraping', 'analyzing', 'alert_evaluation', 'creating_alert', 'finalizing'].map(stage => {
              const jobsInStage = runningJobs.filter(job => job.current_stage === stage);
              const stageNames = {
                initializing: '🔄 Initializing',
                scraping: '🌐 Scraping',
                analyzing: '🧠 Analyzing', 
                alert_evaluation: '⚖️ Evaluating',
                creating_alert: '🚨 Creating Alerts',
                finalizing: '🏁 Finalizing'
              };
              
              return (
                <div key={stage} className={`text-center p-3 rounded-lg border transition-all ${
                  jobsInStage.length > 0 
                    ? 'bg-white dark:bg-gray-700 border-blue-300 dark:border-blue-600 shadow-md transform scale-105' 
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 opacity-50'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${
                    jobsInStage.length > 0 
                      ? 'text-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {stageNames[stage]}
                  </div>
                  <div className={`text-xl font-bold ${
                    jobsInStage.length > 0 
                      ? 'text-blue-600 dark:text-blue-400 animate-pulse' 
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {jobsInStage.length}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Running Jobs Section */}
      {runningJobs.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <span className="mr-2">🏃</span>
            Live Executing Jobs
            <span className="ml-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded-full animate-pulse">
              {runningJobs.length} active
            </span>
            <span className="ml-2 text-xs text-gray-500">
              Last update: {formatLocalTime(new Date(lastUpdate).toISOString())}
            </span>
          </h2>
          
          <div className="space-y-4">
            {runningJobs.map((job, index) => (
              <div 
                key={job.run_id}
                className={`transform transition-all duration-700 ease-in-out relative ${
                  job.current_stage === 'completed' || job.current_stage === 'failed' 
                    ? 'job-completing' 
                    : job.current_stage === 'alert_created'
                    ? 'job-alert-generated'
                    : job.current_stage === 'analyzing' || job.current_stage === 'scraping'
                    ? 'data-flowing'
                    : ''
                }`}
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: job.current_stage === 'completed' || job.current_stage === 'failed' 
                    ? 'slideOutFadeOut 3s ease-in forwards' 
                    : 'slideInFadeIn 0.7s ease-out forwards'
                }}
              >
                <JobCard
                  job={job}
                  isExpanded={expandedJobs.has(job.run_id)}
                  onToggleExpansion={toggleJobExpansion}
                />
              </div>
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
        
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
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
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{dashboardData?.alerts?.last_24_hours || 0}</div>
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
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base">Job Name</th>
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base">Status</th>
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base hidden sm:table-cell">Duration</th>
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base hidden md:table-cell">Sources</th>
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base hidden md:table-cell">Alerts</th>
                  <th className="text-left py-2 px-2 lg:py-3 lg:px-4 font-medium text-gray-700 dark:text-gray-300 text-sm lg:text-base">Started</th>
                </tr>
              </thead>
              <tbody>
                {executionHistory.map((run) => (
                  <tr 
                    key={run.run_id} 
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => handleJobRunClick(run)}
                    title="Click to view execution details"
                  >
                    <td className="py-2 px-2 lg:py-3 lg:px-4 text-gray-900 dark:text-white text-sm lg:text-base">
                      <div className="font-medium">{run.job_name}</div>
                      <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDuration(run.duration_seconds)} • {run.sources_processed} sources • {run.alerts_generated} alerts
                      </div>
                    </td>
                    <td className="py-2 px-2 lg:py-3 lg:px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        run.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        run.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        run.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {run.status}
                      </span>
                      {run.error_message && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1" title={run.error_message}>
                          Error: {run.error_message.substring(0, 30)}...
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 lg:py-3 lg:px-4 text-gray-600 dark:text-gray-400 text-sm lg:text-base hidden sm:table-cell">{formatDuration(run.duration_seconds)}</td>
                    <td className="py-2 px-2 lg:py-3 lg:px-4 text-gray-600 dark:text-gray-400 text-sm lg:text-base hidden md:table-cell">{run.sources_processed}</td>
                    <td className="py-2 px-2 lg:py-3 lg:px-4 text-gray-600 dark:text-gray-400 text-sm lg:text-base hidden md:table-cell">{run.alerts_generated}</td>
                    <td className="py-2 px-2 lg:py-3 lg:px-4 text-xs lg:text-sm text-gray-600 dark:text-gray-400">
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

      {/* Job Run Details Modal */}
      {showJobRunModal && selectedJobRun && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 lg:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                Execution Details: {selectedJobRun.job_name}
              </h2>
              <button
                onClick={() => setShowJobRunModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    selectedJobRun.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    selectedJobRun.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    selectedJobRun.status === 'running' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {selectedJobRun.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Duration</label>
                  <p className="text-gray-900 dark:text-white">{formatDuration(selectedJobRun.duration_seconds)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Started At</label>
                  <p className="text-gray-900 dark:text-white">{formatLocalDateTime(selectedJobRun.started_at)}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sources Processed</label>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedJobRun.sources_processed}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Alerts Generated</label>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{selectedJobRun.alerts_generated}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowJobRunModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveDashboard;
