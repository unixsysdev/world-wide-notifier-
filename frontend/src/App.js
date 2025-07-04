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
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [dataLoading, setDataLoading] = useState(true);

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
          <h2 className="text-2xl font-bold text-gray-900">Your Monitoring Jobs</h2>
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
                      <label className="block text-sm font-medium text-gray-700">Frequency (minutes)</label>
                      <input
                        type="number"
                        name="frequency_minutes"
                        value={formData.frequency_minutes}
                        onChange={handleInputChange}
                        min="5"
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      />
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
