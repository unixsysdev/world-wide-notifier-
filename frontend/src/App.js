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
  const [userSubscription, setUserSubscription] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
    threshold_score: 75
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      fetchAlerts();
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
      const response = await axios.get(`${API_URL}/alerts?limit=50`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setAlertsLoading(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const jobData = {
        ...formData,
        sources: formData.sources.split('\n').filter(url => url.trim()),
        frequency_minutes: parseInt(formData.frequency_minutes),
        threshold_score: parseInt(formData.threshold_score)
      };

      await axios.post(`${API_URL}/jobs`, jobData);
      
      // Reset form and refresh jobs
      setFormData({
        name: '',
        description: '',
        sources: '',
        prompt: '',
        frequency_minutes: 60,
        threshold_score: 75
      });
      setShowCreateForm(false);
      fetchJobs();
      
    } catch (error) {
      console.error('Error creating job:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
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
                  Alerts {alerts.filter(a => !a.is_acknowledged).length > 0 && (
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
                {userSubscription.tier === 'free' && (
                  <button
                    onClick={() => setCurrentView('upgrade')}
                    className="text-sm bg-gradient-to-r from-purple-500 to-blue-600 text-white px-3 py-1 rounded-full hover:from-purple-600 hover:to-blue-700"
                  >
                    Upgrade to Premium
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Frequency (minutes)
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
                          Free tier: Daily checks only. Upgrade for minute-level monitoring.
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

        {/* Jobs List */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {job.name}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    job.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {job.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <p className="mt-2 text-sm text-gray-600">{job.description}</p>
                
                <div className="mt-4 space-y-2 text-sm text-gray-500">
                  <div>Sources: {job.sources.length}</div>
                  <div>Frequency: {job.frequency_minutes} minutes</div>
                  <div>Threshold: {job.threshold_score}/100</div>
                </div>
                
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
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-12">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No monitoring jobs</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new monitoring job.</p>
          </div>
        )}
      </div>
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
