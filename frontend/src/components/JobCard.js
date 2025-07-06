import React from 'react';
import { formatTimeAgoLocal } from '../utils/timeUtils';

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

  // Helper function for outcome colors (used in expanded details)
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

  // Use timezone-aware time formatting
  const formatTimeAgo = formatTimeAgoLocal;

  return (
    <div className={`border border-gray-200 dark:border-gray-600 rounded-lg p-5 relative overflow-hidden transition-all duration-700 ease-in-out transform ${
      job.current_stage === 'completed' 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 scale-95 opacity-75' 
        : job.current_stage === 'failed'
        ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 scale-95 opacity-75'
        : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 scale-100 opacity-100 hover:scale-105'
    } ${job.current_stage === 'finalizing' ? 'animate-pulse' : ''}`}>
      {/* Animated background for running state */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 animate-pulse"></div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{job.job_name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(job.current_stage)} ${
                job.current_stage === 'finalizing' || job.current_stage === 'completed' 
                  ? 'animate-pulse' 
                  : job.current_stage === 'failed' 
                  ? 'animate-bounce' 
                  : 'animate-pulse'
              }`}>
                {job.current_stage === 'completed' && '✅ '}
                {job.current_stage === 'failed' && '❌ '}
                {job.current_stage === 'finalizing' && '🏁 '}
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
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {job.analysis_details.map((detail, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-600 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 mr-4">
                      <div className="text-sm text-blue-600 dark:text-blue-300 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded mb-2 break-all">
                        🌐 {detail.source_url}
                      </div>
                      {detail.content_preview && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded border mb-2 max-h-16 overflow-y-auto font-mono">
                          {detail.content_preview}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                        detail.relevance_score >= detail.threshold_score 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        Score: {detail.relevance_score}/{detail.threshold_score}
                      </span>
                      {detail.alert_generated && (
                        <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                          🚨 Alert Generated!
                        </span>
                      )}
                      {detail.below_threshold && (
                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-3 py-1 rounded-full font-medium">
                          📉 Below Threshold
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {detail.title && (
                      <div>
                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">AI Title</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{detail.title}</div>
                      </div>
                    )}
                    
                    {detail.summary && (
                      <div>
                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">AI Summary</div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">{detail.summary}</div>
                      </div>
                    )}
                    
                    {detail.reasoning && (
                      <div>
                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">AI Reasoning</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-2 rounded border">
                          {detail.reasoning}
                        </div>
                      </div>
                    )}
                    
                    {detail.content_length && (
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <span>📄 Content: {detail.content_length.toLocaleString()} chars</span>
                        {detail.processed_at && <span>⏰ {formatTimeAgo(detail.processed_at)}</span>}
                        {detail.processing_time_seconds && <span>⚡ {detail.processing_time_seconds.toFixed(1)}s</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 dark:text-gray-500 text-sm">
                <span className={`text-4xl block mb-3 ${
                  job.current_stage === 'analyzing' ? 'animate-spin' : 
                  job.current_stage === 'scraping' ? 'animate-pulse' : ''
                }`}>
                  {job.current_stage === 'initializing' && '🔄'}
                  {job.current_stage === 'scraping' && '🌐'}
                  {job.current_stage === 'analyzing' && '🧠'}
                  {job.current_stage === 'finalizing' && '🏁'}
                  {!['initializing', 'scraping', 'analyzing', 'finalizing'].includes(job.current_stage) && '⚡'}
                </span>
                <div className="font-medium text-base mb-2">
                  {job.current_stage === 'initializing' && 'Initializing job execution...'}
                  {job.current_stage === 'scraping' && 'Scraping sources for content...'}
                  {job.current_stage === 'analyzing' && 'AI analyzing content for insights...'}
                  {job.current_stage === 'finalizing' && 'Finalizing results and generating alerts...'}
                  {!['initializing', 'scraping', 'analyzing', 'finalizing'].includes(job.current_stage) && 'Processing job data...'}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Analysis results will appear here as sources are processed
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobCard;