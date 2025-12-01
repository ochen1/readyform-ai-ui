import React from 'react';
import type { EnhancementProgress, PageProcessingStatus } from '../store/types';
import { CheckCircle, Circle, AlertCircle, Loader2, Database } from 'lucide-react';

interface ProcessingProgressProps {
  progress: EnhancementProgress;
  showWarning: boolean;
  pageCount: number;
}

/**
 * Get icon and color for page status
 */
function getStatusIcon(status: PageProcessingStatus) {
  switch (status.status) {
    case 'completed':
      if (status.fromCache) {
        return {
          icon: <Database size={18} className="text-blue-500" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: 'Cached',
        };
      }
      return {
        icon: <CheckCircle size={18} className="text-emerald-500" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        label: 'Complete',
      };
    case 'processing':
      return {
        icon: <Loader2 size={18} className="text-amber-500 animate-spin" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        label: 'Processing',
      };
    case 'error':
      return {
        icon: <AlertCircle size={18} className="text-red-500" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: 'Error',
      };
    case 'pending':
    default:
      return {
        icon: <Circle size={18} className="text-slate-300" />,
        color: 'text-slate-400',
        bgColor: 'bg-slate-50',
        label: 'Pending',
      };
  }
}

/**
 * Calculate progress percentage
 */
function calculateProgress(progress: EnhancementProgress): number {
  if (progress.totalPages === 0) return 0;
  return Math.round((progress.completedPages / progress.totalPages) * 100);
}

/**
 * Format elapsed time
 */
function formatElapsedTime(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
}

/**
 * Processing Progress Component
 * Shows real-time progress of page-by-page enhancement
 */
export function ProcessingProgress({ progress, showWarning, pageCount }: ProcessingProgressProps) {
  const percentage = calculateProgress(progress);
  const elapsed = formatElapsedTime(progress.startTime);
  
  // Count pages by status
  const processing = progress.pageStatuses.filter(p => p.status === 'processing').length;
  const pending = progress.pageStatuses.filter(p => p.status === 'pending').length;
  const cached = progress.pageStatuses.filter(p => p.status === 'completed' && p.fromCache).length;
  
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      {/* Warning Banner for Large Forms */}
      {showWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-800">Large Form Detected</p>
              <p className="text-amber-700 text-sm mt-1">
                This form has <strong>{pageCount} pages</strong> and will take a moment to analyze.
                You can start filling visible fields while we enhance them with AI.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 text-lg">Analyzing Form Structure...</h3>
          <span className="text-sm text-slate-500">{elapsed}</span>
        </div>
        
        {/* Progress Bar */}
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        {/* Progress Stats */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-slate-600">
            <strong>{progress.completedPages}</strong> of <strong>{progress.totalPages}</strong> pages complete
          </span>
          <span className="font-semibold text-blue-600">{percentage}%</span>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          {processing > 0 && (
            <span className="flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> {processing} processing
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1">
              <Circle size={12} /> {pending} pending
            </span>
          )}
          {cached > 0 && (
            <span className="flex items-center gap-1">
              <Database size={12} /> {cached} from cache
            </span>
          )}
          {progress.errorPages > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle size={12} /> {progress.errorPages} failed
            </span>
          )}
        </div>
      </div>
      
      {/* Page List */}
      <div className="px-6 py-4 max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {progress.pageStatuses.map((pageStatus) => {
            const { icon, color, bgColor, label } = getStatusIcon(pageStatus);
            
            return (
              <div
                key={pageStatus.pageNumber}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${bgColor} transition-all duration-300`}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span className={`font-medium ${color}`}>
                    Page {pageStatus.pageNumber}
                  </span>
                  <span className="text-slate-500 text-sm">
                    ({pageStatus.fieldCount} fields)
                  </span>
                </div>
                <span className={`text-sm font-medium ${color}`}>
                  {label}
                  {pageStatus.retryCount > 0 && pageStatus.status === 'error' && (
                    <span className="text-xs ml-1">(retried)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Error Details */}
      {progress.errorPages > 0 && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100">
          <p className="text-red-700 text-sm">
            <strong>{progress.errorPages} page(s)</strong> could not be analyzed. 
            These pages will use basic field information.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact progress indicator for header/sidebar
 */
export function CompactProgress({ progress }: { progress: EnhancementProgress }) {
  const percentage = calculateProgress(progress);
  const processing = progress.pageStatuses.filter(p => p.status === 'processing').length;
  
  return (
    <div className="flex items-center gap-3">
      {processing > 0 ? (
        <Loader2 size={18} className="text-blue-500 animate-spin" />
      ) : progress.completedPages === progress.totalPages ? (
        <CheckCircle size={18} className="text-emerald-500" />
      ) : (
        <Circle size={18} className="text-slate-400" />
      )}
      <div className="flex-1">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600">{percentage}%</span>
    </div>
  );
}