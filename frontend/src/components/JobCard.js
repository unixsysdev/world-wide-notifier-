import React, { useState } from 'react';

const JobCard = ({ job, onToggleExpansion, isExpanded }) => {
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

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden">
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
            onClick={() => onToggleExpansion(job.run_id)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium text-sm whitespace-nowrap bg-white dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all"
          >
            {isExpanded ? '🔼 Hide Details' : '🔽 Show Details'}
          </button>
        </div>
      </div>

      {/* Expanded Details with enhanced analysis */}
      {isExpanded && (
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
  );
};

export default JobCard;
