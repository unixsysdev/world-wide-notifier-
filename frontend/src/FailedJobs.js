import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FailedJobs = ({ user, isDarkMode, toggleDarkMode, logout, onEditJob, onNavigate }) => {
  const [failedJobs, setFailedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [retryingJobs, setRetryingJobs] = useState(new Set());
  
  // Failed Jobs Edit Form State
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [channels, setChannels] = useState([]);
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

  useEffect(() => {
    fetchFailedJobs();
    fetchChannels();
  }, []);

  const fetchFailedJobs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/failed-jobs`, {
        params: { resolved: false }
      });
      
      // Deduplicate failed jobs by grouping similar failures
      const rawFailedJobs = response.data.failed_jobs || [];
      const deduplicatedJobs = deduplicateFailedJobs(rawFailedJobs);
      
      setFailedJobs(deduplicatedJobs);
    } catch (error) {
      console.error('Error fetching failed jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Deduplicate failed jobs by grouping similar failures
  const deduplicateFailedJobs = (jobs) => {
    const groupedJobs = new Map();
    
    jobs.forEach(job => {
      // Create a unique key for grouping similar failures
      const groupKey = `${job.job_id}-${job.source_url}-${job.failure_stage}-${job.error_message}`;
      
      if (groupedJobs.has(groupKey)) {
        const existingGroup = groupedJobs.get(groupKey);
        existingGroup.occurrence_count += 1;
        existingGroup.duplicate_ids.push(job.id);
        existingGroup.total_retry_count += job.retry_count;
        
        // Keep the most recent failure as the main record
        if (new Date(job.created_at) > new Date(existingGroup.created_at)) {
          existingGroup.created_at = job.created_at;
          existingGroup.last_retry_at = job.last_retry_at;
        }
      } else {
        // First occurrence of this type of failure
        groupedJobs.set(groupKey, {
          ...job,
          occurrence_count: 1,
          duplicate_ids: [job.id], // Track all IDs for bulk operations
          total_retry_count: job.retry_count,
          group_key: groupKey
        });
      }
    });
    
    return Array.from(groupedJobs.values());
  };

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API_URL}/notification-channels`);
      setChannels(response.data);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const editJob = async (jobId, failedJobId) => {
    try {
      console.log('Edit job clicked:', jobId, failedJobId);
      
      // First, fetch the job to make sure it exists
      const response = await axios.get(`${API_URL}/jobs/${jobId}`);
      const job = response.data;
      
      console.log('Job data fetched:', job);
      
      // Set up the edit form with job data
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
      setShowEditForm(true);
    } catch (error) {
      console.error('Error editing job:', error);
      if (error.response?.status === 404) {
        alert('❌ Job not found. It may have been deleted.');
      } else {
        alert('❌ Failed to edit job');
      }
    }
  };

  const retryJob = async (failedJobId) => {
    try {
      setRetryingJobs(prev => new Set(prev).add(failedJobId));
      
      // Mark as deleted and retry
      await axios.post(`${API_URL}/failed-jobs/${failedJobId}/mark-deleted`);
      const response = await axios.post(`${API_URL}/failed-jobs/${failedJobId}/retry`);
      
      alert(`✅ ${response.data.message}`);
      
      // Remove from local state immediately
      setFailedJobs(prev => prev.filter(fj => fj.id !== failedJobId));
    } catch (error) {
      console.error('Error retrying job:', error);
      alert('❌ Failed to retry job');
    } finally {
      setRetryingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(failedJobId);
        return newSet;
      });
    }
  };

  const deleteFailedJob = async (failedJobId) => {
    if (!window.confirm('Are you sure you want to permanently delete this failed job record?')) {
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/failed-jobs/${failedJobId}`);
      alert('✅ Failed job record deleted successfully');
      
      // Remove from local state
      setFailedJobs(prev => prev.filter(fj => fj.id !== failedJobId));
    } catch (error) {
      console.error('Error deleting failed job:', error);
      alert('❌ Failed to delete failed job record');
    }
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

      await axios.put(`${API_URL}/jobs/${editingJob.id}`, jobData);
      
      alert('✅ Job updated successfully!');
      
      // Reset form and close modal
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
      setShowEditForm(false);
      setEditingJob(null);
      
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



  const toggleExpanded = (jobId) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getStageIcon = (stage) => {
    switch (stage) {
      case 'scraping': return '🌐';
      case 'analysis': return '🧠';
      case 'alert_creation': return '🚨';
      default: return '❓';
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'scraping': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'analysis': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'alert_creation': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-xl text-gray-900 dark:text-white">Loading failed jobs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <span className="mr-3">🔧</span>
          Failed Jobs Investigation
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchFailedJobs}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Active Failed Jobs
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {failedJobs.length} jobs need attention
              </p>
            </div>
            <div className="text-4xl">
              🚨
            </div>
          </div>
        </div>
      </div>

      {/* Failed Jobs List */}
      {failedJobs.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-12 shadow-md">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Failed Jobs!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Great! All your jobs are running smoothly.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {failedJobs.map((job) => (
            <div key={job.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {job.job_name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(job.failure_stage)}`}>
                        {getStageIcon(job.failure_stage)} {job.failure_stage.replace('_', ' ')}
                      </span>
                      {job.occurrence_count > 1 && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          🔢 {job.occurrence_count} occurrences
                        </span>
                      )}
                      {job.resolved && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ✅ Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>📅 {new Date(job.created_at).toLocaleDateString()}</span>
                      <span>⏰ {new Date(job.created_at).toLocaleTimeString()}</span>
                      <span>🔄 Retries: {job.retry_count}</span>
                      {job.last_retry_at && (
                        <span>📌 Last retry: {new Date(job.last_retry_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleExpanded(job.id)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      {expandedJobs.has(job.id) ? '🔼' : '🔽'}
                    </button>
                  </div>
                </div>

                {/* Source URL */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source URL:</div>
                  <a 
                    href={job.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm break-all"
                  >
                    {job.source_url}
                  </a>
                </div>

                {/* Error Message */}
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 rounded-lg border border-red-200 dark:border-red-700">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error Message:</div>
                  <div className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {job.error_message}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedJobs.has(job.id) && (
                  <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    {/* Job Details */}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Job Configuration:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Prompt:</span>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">{job.job_prompt}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Threshold:</span>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">{job.threshold_score}</p>
                        </div>
                      </div>
                    </div>

                    {/* Error Details */}
                    {job.error_details && (
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Technical Details:</h4>
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                          <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(job.error_details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Resolution Info */}
                    {job.resolved && (
                      <div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg border border-green-200 dark:border-green-700">
                        <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Resolution:</div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          Resolved by {job.resolved_by} on {new Date(job.resolved_at).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {!job.resolved && (
                  <div className="flex space-x-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => retryJob(job.id)}
                      disabled={retryingJobs.has(job.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        retryingJobs.has(job.id)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {retryingJobs.has(job.id) ? '🔄 Retrying...' : '🔄 Retry Job'}
                    </button>
                    <button
                      onClick={() => editJob(job.job_id, job.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      ✏️ Edit & Fix Job
                    </button>
                    <button
                      onClick={() => deleteFailedJob(job.id)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      🗑️ Delete Record
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Job: {editingJob?.name}
                </h2>
                <button
                  onClick={() => setShowEditForm(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Job Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sources (one per line)
                  </label>
                  <textarea
                    name="sources"
                    value={formData.sources}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows="5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Analysis Prompt
                  </label>
                  <textarea
                    name="prompt"
                    value={formData.prompt}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    rows="4"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Frequency (minutes)
                    </label>
                    <input
                      type="number"
                      name="frequency_minutes"
                      value={formData.frequency_minutes}
                      onChange={handleInputChange}
                      min="5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alert Threshold (0-100)
                    </label>
                    <input
                      type="number"
                      name="threshold_score"
                      value={formData.threshold_score}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alert Cooldown (minutes)
                    </label>
                    <input
                      type="number"
                      name="alert_cooldown_minutes"
                      value={formData.alert_cooldown_minutes}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Alerts per Hour
                    </label>
                    <input
                      type="number"
                      name="max_alerts_per_hour"
                      value={formData.max_alerts_per_hour}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Repeat Frequency (minutes)
                    </label>
                    <input
                      type="number"
                      name="repeat_frequency_minutes"
                      value={formData.repeat_frequency_minutes}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Repeats
                    </label>
                    <input
                      type="number"
                      name="max_repeats"
                      value={formData.max_repeats}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="require_acknowledgment"
                      checked={formData.require_acknowledgment}
                      onChange={(e) => setFormData({...formData, require_acknowledgment: e.target.checked})}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Require manual acknowledgment</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notification Channels
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                    {channels.map(channel => (
                      <label key={channel.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.notification_channel_ids.includes(channel.id)}
                          onChange={() => handleChannelSelectionChange(channel.id)}
                          className="mr-2"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                            {channel.name || channel.config?.email || 'Unnamed'} ({channel.type || 'Unknown'})
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {channel.config?.email || channel.config?.webhook_url || 'Not configured'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    Update Job
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FailedJobs;
