import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Settings from './Settings';
import APIManagement from './APIManagement';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const MainApp = () => {
  const { user, logout, isAuthenticated, loading } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [userSubscription, setUserSubscription] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('/alerts')) return 'alerts';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/programmer')) return 'api';
    return 'dashboard';
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sources: '',
    prompt: '',
    frequency_minutes: 60,
    threshold_score: 75,
    notification_channel_ids: [],
    alert_cooldown_minutes: 60,
    max_alerts_per_hour: 5,
    repeat_frequency_minutes: 60,
    max_repeats: 5,
    require_acknowledgment: true
  });

  const [editingJob, setEditingJob] = useState(null);
  const [selectedJobFilter, setSelectedJobFilter] = useState(null);
  const [jobSearchQuery, setJobSearchQuery] = useState('');

  // Dark mode state (with localStorage persistence)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  // Apply dark mode on mount
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Handle view changes with URL updates
  const handleViewChange = (view) => {
    setCurrentView(view);
    const newPath = view === 'dashboard' ? '/' : 
                   view === 'api' ? '/programmer' : `/${view}`;
    window.history.pushState(null, '', newPath);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.includes('/alerts')) handleViewChange('alerts');
      else if (path.includes('/settings')) handleViewChange('settings');
      else if (path.includes('/programmer')) handleViewChange('api');
      else setCurrentView('dashboard');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      fetchAlerts();
      fetchChannels();
      fetchSubscription();
    }
  }, [isAuthenticated]);

  // Refetch alerts when subscription data is loaded to apply proper limits
  useEffect(() => {
    if (isAuthenticated && userSubscription) {
      fetchAlerts();
    }
  }, [userSubscription]);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_URL}/jobs?limit=1000`);
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      // Set alert limit based on user tier
      let alertLimit = 100; // Default for free and premium
      if (userSubscription?.tier === 'premium_plus') {
        alertLimit = 10000; // Effectively unlimited for premium plus
      }
      
      const response = await axios.get(`${API_URL}/alerts?limit=${alertLimit}`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API_URL}/notification-channels`);
      setChannels(response.data);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription`);
      setUserSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };



  const acknowledgeAlert = async (alertId) => {
    try {
      const response = await axios.post(`${API_URL}/alerts/${alertId}/acknowledge`);
      console.log('Alert acknowledged successfully:', response.data);
      // Refresh alerts to show updated status
      fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      
      if (error.response?.status === 401) {
        alert('Authentication failed. Please login again.');
        logout();
      } else if (error.response?.status === 404) {
        alert('Alert not found or already processed.');
        fetchAlerts(); // Refresh to update the view
      } else {
        const errorMessage = error.response?.data?.detail || 'Failed to acknowledge alert';
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  // Bulk operations
  const [selectedAlerts, setSelectedAlerts] = useState([]);

  const toggleAlertSelection = (alertId) => {
    setSelectedAlerts(prev => 
      prev.includes(alertId) 
        ? prev.filter(id => id !== alertId)
        : [...prev, alertId]
    );
  };



  const deselectAllAlerts = () => {
    setSelectedAlerts([]);
  };

  const bulkAcknowledgeAlerts = async () => {
    if (selectedAlerts.length === 0) {
      alert('Please select alerts to acknowledge');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/alerts/bulk-acknowledge`, {
        alert_ids: selectedAlerts
      });
      
      const { acknowledged, failed } = response.data;
      
      if (acknowledged > 0) {
        alert(`✅ Successfully acknowledged ${acknowledged} alerts${failed > 0 ? `, ${failed} failed` : ''}`);
      } else {
        alert('⚠️ No alerts were acknowledged');
      }
      
      setSelectedAlerts([]);
      fetchAlerts();
    } catch (error) {
      console.error('Error bulk acknowledging alerts:', error);
      
      if (error.response?.status === 401) {
        alert('Authentication failed. Please login again.');
        logout();
      } else if (error.response?.status === 422) {
        alert('Invalid request format. Please try again.');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.detail || 'Bad request';
        alert(`Error: ${errorMessage}`);
      } else {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to acknowledge alerts';
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const showPlanSelection = () => {
    setShowPlanModal(true);
  };

  const handleUpgrade = async (tier = 'premium') => {
    try {
      const response = await axios.post(`${API_URL}/subscription/upgrade`, { tier });
      const { checkout_url } = response.data;
      
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start upgrade process. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    // For now, just redirect to Settings where subscription management is available
    handleViewChange('settings');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const jobData = {
        name: formData.name,
        description: formData.description,
        sources: formData.sources.split('\n').filter(url => url.trim()),
        prompt: formData.prompt,
        frequency_minutes: parseInt(formData.frequency_minutes),
        threshold_score: parseInt(formData.threshold_score),
        notification_channel_ids: formData.notification_channel_ids,
        alert_cooldown_minutes: parseInt(formData.alert_cooldown_minutes),
        max_alerts_per_hour: parseInt(formData.max_alerts_per_hour),
        repeat_frequency_minutes: parseInt(formData.repeat_frequency_minutes || 60),
        max_repeats: parseInt(formData.max_repeats || 5),
        require_acknowledgment: formData.require_acknowledgment !== false
      };

      if (editingJob) {
        await axios.put(`${API_URL}/jobs/${editingJob.id}`, jobData);
      } else {
        await axios.post(`${API_URL}/jobs`, jobData);
      }
      
      // Reset form and refresh jobs
      setFormData({
        name: '',
        description: '',
        sources: '',
        prompt: '',
        frequency_minutes: 60,
        threshold_score: 75,
        notification_channel_ids: [],
        alert_cooldown_minutes: 60,
        max_alerts_per_hour: 5,
        repeat_frequency_minutes: 60,
        max_repeats: 5,
        require_acknowledgment: true
      });
      // Reset form
      setFormData({
        name: '',
        description: '',
        sources: '',
        prompt: '',
        frequency_minutes: 60,
        threshold_score: 75,
        notification_channel_ids: [],
        alert_cooldown_minutes: 60,
        max_alerts_per_hour: 5,
        repeat_frequency_minutes: 60,
        max_repeats: 5,
        require_acknowledgment: true
      });
      setShowCreateForm(false);
      setEditingJob(null);
      fetchJobs();
      
    } catch (error) {
      console.error('Error saving job:', error);
      
      let errorMessage = 'Failed to save job. Please try again.';
      
      if (error.response?.status === 403) {
        errorMessage = error.response.data.detail || 'Permission denied. Check your subscription limits.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Job not found. It may have been deleted.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      alert(errorMessage);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleChannelSelectionChange = (channelId) => {
    const currentSelected = formData.notification_channel_ids;
    const newSelected = currentSelected.includes(channelId)
      ? currentSelected.filter(id => id !== channelId)
      : [...currentSelected, channelId];
    
    setFormData({
      ...formData,
      notification_channel_ids: newSelected
    });
  };

  const deleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/jobs/${jobId}`);
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job');
    }
  };

  const editJob = (job) => {
    setEditingJob(job);
    setFormData({
      name: job.name,
      description: job.description || '',
      sources: job.sources.join('\n'),
      prompt: job.prompt,
      frequency_minutes: job.frequency_minutes,
      threshold_score: job.threshold_score,
      notification_channel_ids: job.notification_channel_ids || [],
      alert_cooldown_minutes: job.alert_cooldown_minutes || 60,
      max_alerts_per_hour: job.max_alerts_per_hour || 5,
      repeat_frequency_minutes: job.repeat_frequency_minutes || 60,
      max_repeats: job.max_repeats || 5,
      require_acknowledgment: job.require_acknowledgment !== false
    });
    setShowCreateForm(true);
  };

  const pauseResumeJob = async (jobId, isActive) => {
    try {
      const action = isActive ? 'pause' : 'resume';
      await axios.post(`${API_URL}/jobs/${jobId}/${action}`);
      alert(`✅ Job ${isActive ? 'paused' : 'resumed'} successfully!`);
      fetchJobs();
    } catch (error) {
      console.error(`Error ${isActive ? 'pausing' : 'resuming'} job:`, error);
      alert(`❌ Failed to ${isActive ? 'pause' : 'resume'} job`);
    }
  };

  const duplicateJob = async (jobId) => {
    try {
      const response = await axios.post(`${API_URL}/jobs/${jobId}/duplicate`);
      alert(`✅ Job duplicated! New job ID: ${response.data.id}`);
      fetchJobs();
    } catch (error) {
      console.error('Error duplicating job:', error);
      alert('❌ Failed to duplicate job');
    }
  };

  const runJobNow = async (jobId) => {
    try {
      await axios.post(`${API_URL}/jobs/${jobId}/run-now`);
      alert('✅ Job queued for immediate execution!');
      fetchJobs();
    } catch (error) {
      console.error('Error running job now:', error);
      alert('❌ Failed to run job immediately');
    }
  };

  const viewLastRun = async (jobId) => {
    try {
      const response = await axios.get(`${API_URL}/jobs/${jobId}/latest-run`);
      const runData = response.data.latest_run;
      if (runData) {
        const status = runData.status || 'unknown';
        const sourcesProcessed = runData.sources_processed || 0;
        const alertsGenerated = runData.alerts_generated || 0;
        const startedAt = runData.started_at ? new Date(runData.started_at).toLocaleString() : 'Unknown';
        const errorMsg = runData.error_message ? `\nError: ${runData.error_message}` : '';
        
        // Extract LLM analysis results
        let analysisInfo = "\n\n⚠️ No analysis summary available - this may be an older job run";
        if (runData.analysis_summary) {
          try {
            const analysis = typeof runData.analysis_summary === "string" 
              ? JSON.parse(runData.analysis_summary) 
              : runData.analysis_summary;
            
            if (analysis.analysis_details && analysis.analysis_details.length > 0) {
              analysisInfo = "\n\n🤖 COMPLETE LLM ANALYSIS:\n" + "=".repeat(50) + "\n";
              analysis.analysis_details.forEach((result, idx) => {
                analysisInfo += `\n📍 SOURCE ${idx + 1}: ${result.source_url}\n`;
                analysisInfo += `🎯 RELEVANCE SCORE: ${result.relevance_score || "N/A"}/${result.threshold_score || "N/A"}\n`;
                analysisInfo += `📰 TITLE: ${result.title || "N/A"}\n`;
                analysisInfo += `📝 SUMMARY: ${result.summary || "N/A"}\n🚨 ALERT: ${result.alert_generated ? "GENERATED" : "NOT GENERATED"}\n⏰ ANALYZED: ${new Date(result.processed_at).toLocaleString()}\n${"-".repeat(50)}\n`;
              });
            }
          } catch (e) {
            analysisInfo = `\n\n🤖 RAW ANALYSIS DATA:\n${JSON.stringify(runData.analysis_summary, null, 2)}`;
          }
        }
        
        alert(`📊 Latest Job Run:\n\n🔍 JOB STATUS: ${status.toUpperCase()}\n📅 STARTED: ${startedAt}\n✅ COMPLETED: ${runData.completed_at ? new Date(runData.completed_at).toLocaleString() : "Still running"}\n🔗 SOURCES PROCESSED: ${sourcesProcessed}\n🚨 ALERTS GENERATED: ${alertsGenerated}${errorMsg}${analysisInfo}`);
      } else {
        alert('No runs found for this job yet.');
      }
    } catch (error) {
      console.error('Error fetching job run:', error);
      alert('❌ Failed to fetch job run info');
    }
  };
  const getJobAlerts = (jobId) => {
    return alerts.filter(alert => alert.job_id === jobId);
  };

  const getJobUnacknowledgedAlerts = (jobId) => {
    return alerts.filter(alert => alert.job_id === jobId && !alert.is_acknowledged);
  };

  // Filter jobs based on search query
  const filteredJobs = jobs.filter(job => {
    const searchTerm = jobSearchQuery.toLowerCase();
    return job.name.toLowerCase().includes(searchTerm) || 
           (job.description && job.description.toLowerCase().includes(searchTerm));
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (currentView === 'settings') {
    return <Settings 
      user={user} 
      logout={logout} 
      userSubscription={userSubscription} 
      setCurrentView={handleViewChange} 
      currentView={currentView}
      alerts={alerts}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
      onBack={() => handleViewChange('dashboard')} 
    />;
  }

  if (currentView === 'api') {
    return <APIManagement 
      user={user} 
      logout={logout} 
      userSubscription={userSubscription} 
      setCurrentView={handleViewChange} 
      currentView={currentView}
      alerts={alerts}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
      onBack={() => handleViewChange('dashboard')} 
    />;
  }

  // Filter alerts based on selected job
  const filteredAlerts = selectedJobFilter 
    ? alerts.filter(alert => alert.job_id === selectedJobFilter)
    : alerts;

  // Find the selected job name for display
  const selectedJob = selectedJobFilter 
    ? jobs.find(job => job.id === selectedJobFilter)
    : null;

  if (currentView === 'alerts') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Navigation Header */}
        <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Monitoring</h1>
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      handleViewChange('dashboard');
                      setSelectedJobFilter(null);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'dashboard' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleViewChange('alerts')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'alerts' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                    }`}
                  >
                    Alerts
                    {alerts.filter(a => !a.is_acknowledged).length > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {alerts.filter(a => !a.is_acknowledged).length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleViewChange('settings')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'settings' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                    }`}
                  >
                    Settings
                  </button>
                  <button
                    onClick={() => handleViewChange('api')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'api' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                    }`}
                  >
                    API
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">Welcome, {user?.name}</span>
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isDarkMode ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">🚨 Alert Management</h2>
              {selectedJob && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full font-medium">
                    Filtered by: {selectedJob.name}
                  </span>
                  <button
                    onClick={() => setSelectedJobFilter(null)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Show All Alerts
                  </button>
                </div>
              )}
              {selectedAlerts.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{selectedAlerts.length} selected</span>
                  <button
                    onClick={bulkAcknowledgeAlerts}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Acknowledge Selected
                  </button>
                  <button
                    onClick={deselectAllAlerts}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {filteredAlerts.filter(alert => !alert.is_acknowledged).length > 0 && (
                <button
                  onClick={() => {
                    const unacknowledgedAlerts = filteredAlerts.filter(alert => !alert.is_acknowledged);
                    setSelectedAlerts(unacknowledgedAlerts.map(alert => alert.id));
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Select All {selectedJob ? 'from this Job' : 'Unacknowledged'}
                </button>
              )}
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredAlerts.length} {selectedJob ? `alerts from "${selectedJob.name}"` : 'total alerts'}
                </div>
                {userSubscription && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium capitalize">{userSubscription.tier}</span> Plan
                    {userSubscription.tier === 'free' && (
                      <span className="ml-2">({userSubscription.daily_alert_count}/{userSubscription.alert_limit} alerts today)</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {alertsLoading ? (
            <div className="text-center py-12">
              <div className="text-xl">Loading alerts...</div>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    {selectedJob ? `No alerts for "${selectedJob.name}"` : 'No alerts yet'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedJob 
                      ? 'This job hasn\'t generated any alerts yet.'
                      : 'Alerts will appear here when your monitoring jobs detect relevant changes.'
                    }
                  </p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`bg-white dark:bg-gray-800 overflow-hidden shadow-lg rounded-xl border-l-4 transition-all hover:shadow-xl ${
                      alert.is_acknowledged 
                        ? 'border-green-400' 
                        : alert.relevance_score >= 80 
                          ? 'border-red-400' 
                          : alert.relevance_score >= 60 
                            ? 'border-yellow-400' 
                            : 'border-blue-400'
                    } ${selectedAlerts.includes(alert.id) ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="px-6 py-6">
                      <div className="flex items-start space-x-4">
                        {/* Selection checkbox */}
                        {!alert.is_acknowledged && (
                          <div className="flex-shrink-0 mt-1">
                            <input
                              type="checkbox"
                              checked={selectedAlerts.includes(alert.id)}
                              onChange={() => toggleAlertSelection(alert.id)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {alert.title}
                              </h3>
                              <div className="flex items-center space-x-3 mb-3">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  alert.relevance_score >= 80 
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                    : alert.relevance_score >= 60 
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                }`}>
                                  🎯 Score: {alert.relevance_score}/100
                                </span>
                                {alert.is_acknowledged && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    ✅ Acknowledged
                                  </span>
                                )}
                                <span className="text-sm text-gray-500">
                                  📅 {new Date(alert.created_at).toLocaleDateString()} ⏰ {new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex-shrink-0">
                              {!alert.is_acknowledged && (
                                <button
                                  onClick={() => acknowledgeAlert(alert.id)}
                                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-md hover:shadow-lg"
                                >
                                  ✅ Acknowledge
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">📄 Alert Summary</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{alert.content}</p>
                          </div>
                          
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                              <span className="font-semibold text-blue-800">💼 Job:</span>
                              <span className="text-blue-700">{alert.job_name}</span>
                            </div>
                            
                            {alert.source_url && (
                              <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
                                <span className="font-semibold text-purple-800">🔗 Source:</span>
                                <a 
                                  href={alert.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-purple-700 hover:text-purple-900 truncate underline"
                                  title={alert.source_url}
                                >
                                  {alert.source_url.length > 40 ? alert.source_url.substring(0, 40) + '...' : alert.source_url}
                                </a>
                              </div>
                            )}
                            
                            {alert.repeat_count > 0 && (
                              <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
                                <span className="font-semibold text-orange-800">🔄 Repeated:</span>
                                <span className="text-orange-700">{alert.repeat_count} times</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors">
        <div className="text-xl text-gray-900 dark:text-white">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Navigation Header */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Monitoring</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => handleViewChange('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleViewChange('alerts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'alerts' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                  }`}
                >
                  Alerts
                  {alerts.filter(a => !a.is_acknowledged).length > 0 && (
                    <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {alerts.filter(a => !a.is_acknowledged).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleViewChange('settings')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'settings' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                  }`}
                >
                  Settings
                </button>
                <button
                  onClick={() => handleViewChange('api')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'api' 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' 
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors'
                  }`}
                >
                  API
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-300">Welcome, {user?.name}</span>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Overview Stats */}
        <div className="mb-12">
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 rounded-3xl p-8 border border-blue-100 dark:border-gray-700 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                <span className="mr-3 text-3xl">🚀</span>
                <div>
                  <div>AI Monitoring Dashboard</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 font-normal">Welcome back, {user?.name}!</div>
                </div>
              </h1>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 flex items-center space-x-2 text-sm"
              >
                <span className="text-lg">➕</span>
                <span>Create New Job</span>
              </button>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-xl">
                    <span className="text-3xl">💼</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{jobs.length}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Active Jobs</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-100 dark:bg-red-900 p-3 rounded-xl">
                    <span className="text-3xl">🚨</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{alerts.length}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Total Alerts</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-xl">
                    <span className="text-3xl">⚠️</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{alerts.filter(alert => !alert.is_acknowledged).length}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Pending</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl ${userSubscription?.tier === 'free' ? 'bg-yellow-100 dark:bg-yellow-900' : 'bg-green-100 dark:bg-green-900'}`}>
                    <span className="text-3xl">{userSubscription?.tier === 'free' ? '🆓' : '⭐'}</span>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white capitalize">{userSubscription?.tier || 'Free'}</div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Current Plan</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Plan Info and Upgrade Section */}
            {userSubscription && (
              <div className="mt-6 flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  {userSubscription.tier === 'free' && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Usage:</span> {userSubscription.daily_alert_count}/{userSubscription.alert_limit} alerts today
                    </div>
                  )}
                </div>
                <div className="flex space-x-3">
                  {userSubscription.tier === 'free' ? (
                    <button
                      onClick={showPlanSelection}
                      className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-2 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      🚀 Upgrade Plan
                    </button>
                  ) : (
                    <button
                      onClick={handleManageSubscription}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      ⚙️ Manage Subscription
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Jobs Section Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <span className="mr-2">💼</span> Your Monitoring Jobs
          </h2>
          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search jobs..."
                value={jobSearchQuery}
                onChange={(e) => setJobSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm w-64"
              />
              {jobSearchQuery && (
                <button
                  onClick={() => setJobSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2 shadow-md hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredJobs.length} of {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} {jobSearchQuery ? 'found' : 'configured'}
            </div>
          </div>
        </div>

        {/* Create Job Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full z-50 backdrop-blur-sm">
            <div className="relative top-10 mx-auto p-0 border-0 w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-2xl rounded-2xl bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-2xl">
                  <h3 className="text-2xl font-bold text-white flex items-center">
                    <span className="mr-3">{editingJob ? '✏️' : '🚀'}</span> 
                    {editingJob ? 'Edit Monitoring Job' : 'Create New Monitoring Job'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="text-white hover:text-gray-200 transition-colors duration-200 p-2 rounded-full hover:bg-white hover:bg-opacity-20"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 border border-blue-100 dark:border-gray-600">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                      <span className="mr-2">📝</span> Basic Information
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Job Name *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Description</label>
                        <input
                          type="text"
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sources and Monitoring */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 border border-blue-100 dark:border-gray-600">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                      <span className="mr-2">🔍</span> Sources & Monitoring
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Sources (one per line) *</label>
                        <textarea
                          name="sources"
                          value={formData.sources}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                          rows="3"
                          placeholder="https://example.com/news&#10;https://another-site.com/feed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Analysis Prompt *</label>
                        <textarea
                          name="prompt"
                          value={formData.prompt}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                          rows="3"
                          placeholder="Analyze this content for anything that could impact oil prices..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Frequency and Thresholds */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 border border-blue-100 dark:border-gray-600">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                      <span className="mr-2">⏱️</span> Frequency & Thresholds
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                          Check Frequency (minutes)
                          {userSubscription && (
                            <span className="text-xs text-gray-500 block">
                              (min: {userSubscription.min_frequency_minutes})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          name="frequency_minutes"
                          value={formData.frequency_minutes}
                          onChange={handleInputChange}
                          min={userSubscription?.min_frequency_minutes || 5}
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                        {userSubscription?.tier === 'free' && (
                          <p className="mt-1 text-xs text-gray-500">
                            Free tier: Hourly checks minimum. Upgrade for minute-level monitoring.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Alert Threshold (0-100)</label>
                        <input
                          type="number"
                          name="threshold_score"
                          value={formData.threshold_score}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                          Alert Cooldown (minutes)
                          <span className="text-xs text-gray-500 block">
                            (prevent duplicates)
                          </span>
                        </label>
                        <input
                          type="number"
                          name="alert_cooldown_minutes"
                          value={formData.alert_cooldown_minutes}
                          onChange={handleInputChange}
                          min="1"
                          max="1440"
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                          Max Alerts/Hour
                          <span className="text-xs text-gray-500 block">
                            (rate limiting)
                          </span>
                        </label>
                        <input
                          type="number"
                          name="max_alerts_per_hour"
                          value={formData.max_alerts_per_hour}
                          onChange={handleInputChange}
                          min="1"
                          max="60"
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Notification Settings */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-700 rounded-xl p-6 border border-blue-100 dark:border-gray-600">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                      <span className="mr-2">🔔</span> Notification Settings
                    </h4>
                    
                    {/* Notification Channel Selection */}
                    {channels.length > 0 ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Notification Channels
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {channels.map((channel) => (
                            <div key={channel.id} className="flex items-center p-2 border dark:border-gray-600 rounded-md dark:bg-gray-700">
                              <input
                                type="checkbox"
                                id={`channel-${channel.id}`}
                                checked={formData.notification_channel_ids.includes(channel.id)}
                                onChange={() => handleChannelSelectionChange(channel.id)}
                                className="mr-3"
                              />
                              <label htmlFor={`channel-${channel.id}`} className="text-sm text-gray-700 dark:text-gray-200 flex-1">
                                <span className="font-medium capitalize">{channel.channel_type}</span>
                                <span className="text-gray-500 dark:text-gray-400 block text-xs">
                                  {channel.config.email ? channel.config.email : 
                                   channel.config.webhook_url ? channel.config.webhook_url.substring(0, 40) + '...' : 
                                   'Not configured'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Select which channels to send alerts to. You can configure channels in Settings.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No notification channels configured</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Go to Settings to set up email, Teams, or other notification channels
                        </p>
                      </div>
                    )}

                    {/* Repeat Settings */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                          Repeat Frequency (minutes)
                          <span className="text-xs text-gray-500 block">
                            (if not acknowledged)
                          </span>
                        </label>
                        <input
                          type="number"
                          name="repeat_frequency_minutes"
                          value={formData.repeat_frequency_minutes || 60}
                          onChange={handleInputChange}
                          min="5"
                          max="1440"
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                          Max Repeats
                          <span className="text-xs text-gray-500 block">
                            (before stopping)
                          </span>
                        </label>
                        <input
                          type="number"
                          name="max_repeats"
                          value={formData.max_repeats || 5}
                          onChange={handleInputChange}
                          min="0"
                          max="20"
                          className="mt-1 block w-full border-2 border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
                        />
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="require_acknowledgment"
                          checked={formData.require_acknowledgment !== false}
                          onChange={(e) => setFormData({...formData, require_acknowledgment: e.target.checked})}
                          className="mr-2"
                        />
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Require Acknowledgment
                          <span className="text-xs text-gray-500 block">
                            (enable repeat notifications)
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 -mx-8 -mb-8 px-8 py-6 rounded-b-xl">
                    <button
                      type="button"
                      onClick={() => {
                      setShowCreateForm(false);
                      setEditingJob(null);
                      setFormData({
                        name: '',
                        description: '',
                        sources: '',
                        prompt: '',
                        frequency_minutes: 60,
                        threshold_score: 75,
                        notification_channel_ids: [],
                        alert_cooldown_minutes: 60,
                        max_alerts_per_hour: 5,
                        repeat_frequency_minutes: 60,
                        max_repeats: 5,
                        require_acknowledgment: true
                      });
                    }}
                      className="px-6 py-3 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-all duration-200 font-medium border border-gray-300 dark:border-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
{editingJob ? 'Update Job' : 'Create Job'}
                    </button>
                  </div>
                </form>
                </div></div>
            </div>
          </div>
        )}

        {/* Jobs List with Alert Integration */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredJobs.map((job) => {
            const jobAlerts = getJobAlerts(job.id);
            const unacknowledgedAlerts = getJobUnacknowledgedAlerts(job.id);
            
            return (
              <div key={job.id} className="bg-white dark:bg-gray-800 overflow-hidden shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
                {/* Header with gradient */}
                <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white truncate">{job.name}</h3>
                    <div className="flex items-center space-x-2">
                      {unacknowledgedAlerts.length > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                          {unacknowledgedAlerts.length}
                        </span>
                      )}
                      <div className={`w-3 h-3 rounded-full ${job.is_active ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    </div>
                  </div>
                  {job.description && (
                    <p className="text-blue-100 text-sm mt-2 line-clamp-2">{job.description}</p>
                  )}
                </div>

                <div className="px-6 py-6">
                  {/* Job Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🔗</span>
                        <div>
                          <div className="text-2xl font-bold text-blue-800">{job.sources.length}</div>
                          <div className="text-xs text-blue-600 font-medium">Sources</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">⏱️</span>
                        <div>
                          <div className="text-2xl font-bold text-green-800">{job.frequency_minutes}m</div>
                          <div className="text-xs text-green-600 font-medium">Check Freq</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <div className="text-2xl font-bold text-purple-800">{job.threshold_score}</div>
                          <div className="text-xs text-purple-600 font-medium">Threshold</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🚨</span>
                        <div>
                          <div className="text-2xl font-bold text-orange-800">{jobAlerts.length}</div>
                          <div className="text-xs text-orange-600 font-medium">Total Alerts</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alert Status Bar */}
                  {jobAlerts.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alert Status</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{jobAlerts.length} total</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${jobAlerts.length > 0 ? ((jobAlerts.length - unacknowledgedAlerts.length) / jobAlerts.length) * 100 : 0}%`
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>✅ {jobAlerts.length - unacknowledgedAlerts.length} Acknowledged</span>
                        <span>⚠️ {unacknowledgedAlerts.length} Pending</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Recent Alerts Preview */}
                  {jobAlerts.length > 0 && (
                    <div className="mt-6 border-t dark:border-gray-600 pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="mr-2">🚨</span> Recent Alerts ({jobAlerts.length})
                      </h4>
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar" style={{scrollbarWidth: 'thin', scrollbarColor: '#CBD5E0 #F7FAFC'}}>
                        {jobAlerts.slice(0, 5).map((alert) => (
                          <div key={alert.id} className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-sm ${
                            alert.is_acknowledged 
                              ? 'bg-green-50 dark:bg-green-900 border-green-400 dark:border-green-600' 
                              : alert.relevance_score >= 80 
                                ? 'bg-red-50 dark:bg-red-900 border-red-400 dark:border-red-600' 
                                : alert.relevance_score >= 60 
                                  ? 'bg-yellow-50 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-600' 
                                  : 'bg-blue-50 dark:bg-blue-900 border-blue-400 dark:border-blue-600'
                          }`}>
                            <div className="flex justify-between items-start space-x-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h5 className="font-medium text-gray-900 dark:text-white text-sm truncate">{alert.title}</h5>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    alert.relevance_score >= 80 
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                                      : alert.relevance_score >= 60 
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  }`}>
                                    {alert.relevance_score}
                                  </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed line-clamp-2">
                                  {alert.content.length > 120 ? alert.content.substring(0, 120) + '...' : alert.content}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-gray-400 dark:text-gray-500 text-xs">
                                    {new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                  {alert.is_acknowledged && (
                                    <span className="inline-flex items-center text-xs text-green-600">
                                      <span className="mr-1">✓</span> Acknowledged
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                {!alert.is_acknowledged && (
                                  <button
                                    onClick={() => acknowledgeAlert(alert.id)}
                                    className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors font-medium"
                                  >
                                    <span className="mr-1">✓</span> Ack
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {jobAlerts.length > 5 && (
                        <button
                          onClick={() => {
                            setSelectedJobFilter(job.id);
                            handleViewChange('alerts');
                          }}
                          className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          View all {jobAlerts.length} alerts →
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* New Job Management Buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-3 mt-6">
                    <button
                      onClick={() => runJobNow(job.id)}
                      className="inline-flex items-center justify-center px-2 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                    >
                      <span className="mr-1">⚡</span> Run Now
                    </button>
                    <button
                      onClick={() => pauseResumeJob(job.id, job.is_active)}
                      className={`inline-flex items-center justify-center px-2 py-2 rounded-lg transition-colors text-xs font-medium ${
                        job.is_active 
                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:hover:bg-yellow-800" 
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800"
                      }`}
                    >
                      <span className="mr-1">{job.is_active ? "⏸️" : "▶️"}</span> 
                      {job.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => duplicateJob(job.id)}
                      className="inline-flex items-center justify-center px-2 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-medium"
                    >
                      <span className="mr-1">📋</span> Duplicate
                    </button>
                    <button
                      onClick={() => viewLastRun(job.id)}
                      className="inline-flex items-center justify-center px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
                    >
                      <span className="mr-1">📈</span> Last Run
                    </button>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-600">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedJobFilter(job.id);
                          handleViewChange('alerts');
                        }}
                        className="inline-flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm font-medium"
                      >
                        <span className="mr-1">👁️</span> View Alerts
                      </button>
                      <button
                        onClick={() => editJob(job)}
                        className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        <span className="mr-1">✏️</span> Edit
                      </button>
                    </div>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="inline-flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors text-sm font-medium"
                    >
                      <span className="mr-1">🗑️</span> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredJobs.length === 0 && jobs.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-700 rounded-3xl p-12 border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-8xl mb-6">🎯</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Monitoring Jobs Yet</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Start monitoring your important sources by creating your first job. It only takes a minute!
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex items-center space-x-3 mx-auto text-lg"
              >
                <span className="text-2xl">🚀</span>
                <span>Create Your First Job</span>
              </button>
            </div>
          </div>
        )}

        {filteredJobs.length === 0 && jobs.length > 0 && (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-700 rounded-3xl p-12 border-2 border-dashed border-gray-300 dark:border-gray-600">
              <div className="text-8xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Jobs Found</h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                No jobs match your search for "{jobSearchQuery}". Try a different search term.
              </p>
              <button
                onClick={() => setJobSearchQuery('')}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex items-center space-x-2 mx-auto"
              >
                <span className="text-xl">🔄</span>
                <span>Clear Search</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border dark:border-gray-600 w-11/12 md:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Choose Your Plan</h3>
              
              <div className="space-y-4">
                {/* Premium Plan */}
                <div className="border dark:border-gray-600 rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">Premium</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Perfect for regular monitoring</p>
                      <ul className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <li>• 100 alerts per day</li>
                        <li>• 10 minute minimum frequency</li>
                        <li>• All notification channels</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">$10</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">per month</div>
                      <button
                        onClick={() => {
                          setShowPlanModal(false);
                          handleUpgrade('premium');
                        }}
                        className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                      >
                        Select Premium
                      </button>
                    </div>
                  </div>
                </div>

                {/* Premium Plus Plan */}
                <div className="border dark:border-gray-600 rounded-lg p-4 hover:border-purple-500 dark:hover:border-purple-400 transition-colors border-purple-300 bg-purple-50 dark:bg-purple-900">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Premium Plus</h4>
                        <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">BEST VALUE</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">For power users and teams</p>
                      <ul className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <li>• Unlimited alerts</li>
                        <li>• 1 minute minimum frequency</li>
                        <li>• Priority support</li>
                        <li>• Advanced analytics</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">$15</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">per month</div>
                      <button
                        onClick={() => {
                          setShowPlanModal(false);
                          handleUpgrade('premium_plus');
                        }}
                        className="mt-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded"
                      >
                        Select Premium Plus
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4 mt-6 border-t">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
