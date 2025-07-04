import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Settings from './Settings';
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
  const [currentView, setCurrentView] = useState('dashboard');
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
    max_alerts_per_hour: 5
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      fetchAlerts();
      fetchChannels();
      fetchSubscription();
    }
  }, [isAuthenticated]);

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API_URL}/jobs`);
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_URL}/alerts?limit=100`);
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
      await axios.post(`${API_URL}/alerts/${alertId}/acknowledge`);
      // Refresh alerts to show updated status
      fetchAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('Failed to acknowledge alert');
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
    setCurrentView('settings');
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? It will remain active until the end of your current billing period.')) {
      return;
    }
    
    try {
      const response = await axios.post(`${API_URL}/subscription/cancel`);
      alert(response.data.message);
      fetchSubscription(); // Refresh subscription data
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const jobData = {
        name: formData.name,
        description: formData.description,
        sources: formData.sources.split('
').filter(url => url.trim()),
        prompt: formData.prompt,
        frequency_minutes: parseInt(formData.frequency_minutes),
        threshold_score: parseInt(formData.threshold_score),
        notification_channel_ids: formData.notification_channel_ids,
        alert_cooldown_minutes: parseInt(formData.alert_cooldown_minutes),
        max_alerts_per_hour: parseInt(formData.max_alerts_per_hour)
      };

      await axios.post(`${API_URL}/jobs`, jobData);
      
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
        max_alerts_per_hour: 5
      });
      setShowCreateForm(false);
      fetchJobs();
      
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
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
    try {
      await axios.delete(`${API_URL}/jobs/${jobId}`);
      fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  // Helper function to get alerts for a specific job
  const getJobAlerts = (jobId) => {
    return alerts.filter(alert => alert.job_id === jobId);
  };

  const getJobUnacknowledgedAlerts = (jobId) => {
    return alerts.filter(alert => alert.job_id === jobId && !alert.is_acknowledged);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (currentView === 'settings') {
    return <Settings onBack={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'alerts') {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* Navigation Header */}
        <nav className="bg-white shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <h1 className="text-xl font-bold text-gray-900">AI Monitoring</h1>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setCurrentView('alerts')}
                    className="px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-700"
                  >
                    Alerts
                  </button>
                  <button
                    onClick={() => setCurrentView('settings')}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Settings
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Alert Management</h2>
            <div className="flex space-x-4">
              {userSubscription && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium capitalize">{userSubscription.tier}</span> Plan
                  {userSubscription.tier === 'free' && (
                    <span className="ml-2">({userSubscription.daily_alert_count}/{userSubscription.alert_limit} alerts today)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {alertsLoading ? (
            <div className="text-center py-12">
              <div className="text-xl">Loading alerts...</div>
            </div>
          ) : (
            <div className="grid gap-6">
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Alerts will appear here when your monitoring jobs detect relevant changes.</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`bg-white overflow-hidden shadow rounded-lg border-l-4 ${
                      alert.is_acknowledged 
                        ? 'border-green-400' 
                        : alert.relevance_score >= 80 
                          ? 'border-red-400' 
                          : alert.relevance_score >= 60 
                            ? 'border-yellow-400' 
                            : 'border-blue-400'
                    }`}
                  >
                    <div className="px-4 py-5 sm:p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg leading-6 font-medium text-gray-900">
                            {alert.title}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            alert.relevance_score >= 80 
                              ? 'bg-red-100 text-red-800' 
                              : alert.relevance_score >= 60 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-blue-100 text-blue-800'
                          }`}>
                            Score: {alert.relevance_score}
                          </span>
                          {alert.is_acknowledged && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Acknowledged
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {new Date(alert.created_at).toLocaleDateString()} {new Date(alert.created_at).toLocaleTimeString()}
                          </span>
                          {!alert.is_acknowledged && (
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <p className="mt-2 text-sm text-gray-600">{alert.content}</p>
                      
                      <div className="mt-4 space-y-2 text-sm text-gray-500">
                        <div>Job: {alert.job_name}</div>
                        {alert.source_url && (
                          <div>
                            Source: <a href={alert.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              {alert.source_url}
                            </a>
                          </div>
                        )}
                        {alert.repeat_count > 0 && (
                          <div>Repeated {alert.repeat_count} times</div>
                        )}
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">AI Monitoring</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('alerts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'alerts' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
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
                  onClick={() => setCurrentView('settings')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'settings' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Settings
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Monitoring Jobs</h2>
            {userSubscription && (
              <div className="mt-2 flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  <span className="font-medium capitalize">{userSubscription.tier}</span> Plan
                </span>
                {userSubscription.tier === 'free' && (
                  <span className="text-sm text-gray-600">
                    {userSubscription.daily_alert_count}/{userSubscription.alert_limit} alerts today
                  </span>
                )}
                {userSubscription.tier === 'free' ? (
                  <button
                    onClick={showPlanSelection}
                    className="text-sm bg-gradient-to-r from-purple-500 to-blue-600 text-white px-3 py-1 rounded-full hover:from-purple-600 hover:to-blue-700"
                  >
                    Upgrade Plan
                  </button>
                ) : (
                  <button
                    onClick={handleManageSubscription}
                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full"
                  >
                    Manage Subscription
                  </button>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Create New Job
          </button>
        </div>

        {/* Create Job Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Monitoring Job</h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Job Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows="2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sources (one per line)</label>
                    <textarea
                      name="sources"
                      value={formData.sources}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows="4"
                      placeholder="https://example.com/news&#10;https://another-site.com/feed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Analysis Prompt</label>
                    <textarea
                      name="prompt"
                      value={formData.prompt}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      rows="3"
                      placeholder="Analyze this content for anything that could impact oil prices..."
                    />
                  </div>

                  {/* Notification Channel Selection */}
                  {channels.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notification Channels
                      </label>
                      <div className="space-y-2">
                        {channels.map((channel) => (
                          <div key={channel.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`channel-${channel.id}`}
                              checked={formData.notification_channel_ids.includes(channel.id)}
                              onChange={() => handleChannelSelectionChange(channel.id)}
                              className="mr-2"
                            />
                            <label htmlFor={`channel-${channel.id}`} className="text-sm text-gray-700 capitalize">
                              {channel.channel_type} - {channel.config.email || 'Webhook configured'}
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Select which channels to send alerts to. You can configure channels in Settings.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Check Frequency (minutes)
                        {userSubscription && (
                          <span className="text-xs text-gray-500 ml-1">
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
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      {userSubscription?.tier === 'free' && (
                        <p className="mt-1 text-xs text-gray-500">
                          Free tier: Hourly checks minimum. Upgrade for minute-level monitoring.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Alert Threshold (0-100)</label>
                      <input
                        type="number"
                        name="threshold_score"
                        value={formData.threshold_score}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Alert Frequency Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Alert Cooldown (minutes)
                        <span className="text-xs text-gray-500 ml-1">
                          (prevent duplicate alerts)
                        </span>
                      </label>
                      <input
                        type="number"
                        name="alert_cooldown_minutes"
                        value={formData.alert_cooldown_minutes}
                        onChange={handleInputChange}
                        min="1"
                        max="1440"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum time between alerts for the same content
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Max Alerts Per Hour
                        <span className="text-xs text-gray-500 ml-1">
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
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Maximum alerts per hour to prevent spam
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Create Job
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Jobs List with Alert Integration */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const jobAlerts = getJobAlerts(job.id);
            const unacknowledgedAlerts = getJobUnacknowledgedAlerts(job.id);
            
            return (
              <div key={job.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {job.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {job.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {unacknowledgedAlerts.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {unacknowledgedAlerts.length} New
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="mt-2 text-sm text-gray-600">{job.description}</p>
                  
                  <div className="mt-4 space-y-2 text-sm text-gray-500">
                    <div>Sources: {job.sources.length}</div>
                    <div>Frequency: {job.frequency_minutes} minutes</div>
                    <div>Threshold: {job.threshold_score}/100</div>
                    <div className="flex items-center space-x-4">
                      <span>Total Alerts: {jobAlerts.length}</span>
                      {unacknowledgedAlerts.length > 0 && (
                        <span className="text-red-600 font-medium">
                          {unacknowledgedAlerts.length} Unacknowledged
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Recent Alerts Preview */}
                  {jobAlerts.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Alerts</h4>
                      <div className="space-y-2">
                        {jobAlerts.slice(0, 3).map((alert) => (
                          <div key={alert.id} className={`text-xs p-2 rounded ${
                            alert.is_acknowledged ? 'bg-gray-50' : 'bg-red-50'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium">{alert.title}</div>
                                <div className="text-gray-500 truncate">
                                  {alert.content.substring(0, 80)}...
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  alert.is_acknowledged ? 'bg-green-400' : 'bg-red-400'
                                }`}></span>
                                {!alert.is_acknowledged && (
                                  <button
                                    onClick={() => acknowledgeAlert(alert.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                  >
                                    Ack
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {jobAlerts.length > 3 && (
                        <button
                          onClick={() => setCurrentView('alerts')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                        >
                          View all {jobAlerts.length} alerts →
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No monitoring jobs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new monitoring job.</p>
          </div>
        )}
      </div>

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Your Plan</h3>
              
              <div className="space-y-4">
                {/* Premium Plan */}
                <div className="border rounded-lg p-4 hover:border-blue-500 transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-gray-900">Premium</h4>
                      <p className="text-sm text-gray-600">Perfect for regular monitoring</p>
                      <ul className="mt-2 text-sm text-gray-500">
                        <li>• 100 alerts per day</li>
                        <li>• 10 minute minimum frequency</li>
                        <li>• All notification channels</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">$10</div>
                      <div className="text-sm text-gray-500">per month</div>
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
                <div className="border rounded-lg p-4 hover:border-purple-500 transition-colors border-purple-300 bg-purple-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center">
                        <h4 className="font-semibold text-gray-900">Premium Plus</h4>
                        <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">BEST VALUE</span>
                      </div>
                      <p className="text-sm text-gray-600">For power users and teams</p>
                      <ul className="mt-2 text-sm text-gray-500">
                        <li>• Unlimited alerts</li>
                        <li>• 1 minute minimum frequency</li>
                        <li>• Priority support</li>
                        <li>• Advanced analytics</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">$15</div>
                      <div className="text-sm text-gray-500">per month</div>
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
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
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
