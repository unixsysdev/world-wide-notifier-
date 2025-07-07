import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FailedJobs = ({ user, isDarkMode, toggleDarkMode, logout, onEditJob, onNavigate }) => {
  const [failedJobs, setFailedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobs, setExpandedJobs] = useState(new Set());

  const [retryingJobs, setRetryingJobs] = useState(new Set());

  useEffect(() => {
    fetchFailedJobs();
  }, []);

  const fetchFailedJobs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/failed-jobs`, {
        params: { resolved: false }
      });
      setFailedJobs(response.data.failed_jobs || []);
    } catch (error) {
      console.error('Error fetching failed jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const editJob = async (jobId, failedJobId) => {
    try {
      console.log('Edit job clicked:', jobId, failedJobId);
      console.log('onEditJob function:', onEditJob);
      
      // First, fetch the job to make sure it exists
      const response = await axios.get(`${API_URL}/jobs/${jobId}`);
      const job = response.data;
      
      console.log('Job data fetched:', job);
      
      // Trigger edit mode - this will show the modal form on current page
      if (onEditJob) {
        console.log('Calling onEditJob with:', job);
        onEditJob(job);
      } else {
        console.error('onEditJob is not defined!');
      }
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
    </div>
  );
};

export default FailedJobs;
