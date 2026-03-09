import { useTranslation } from 'react-i18next';
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
function getStatusIcon(status: PageProcessingStatus, t: (key: string) => string) {
  switch (status.status) {
    case 'completed':
      if (status.fromCache) {
        return {
          icon: <Database size={18} className="text-blue-500" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          label: t('enhancement.statusCached'),
        };
      }
      return {
        icon: <CheckCircle size={18} className="text-emerald-500" />,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        label: t('enhancement.statusComplete'),
      };
    case 'processing':
      return {
        icon: <Loader2 size={18} className="text-amber-500 animate-spin" />,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        label: t('enhancement.statusProcessing'),
      };
    case 'error':
      return {
        icon: <AlertCircle size={18} className="text-red-500" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        label: t('enhancement.statusError'),
      };
    case 'pending':
    default:
      return {
        icon: <Circle size={18} className="text-slate-600" />,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        label: t('enhancement.statusPending'),
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
  const { t } = useTranslation();
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
              <p className="font-semibold text-amber-800">{t('enhancement.largeFormTitle')}</p>
              <p
                className="text-amber-700 text-sm mt-1"
                dangerouslySetInnerHTML={{ __html: t('enhancement.largeFormMessage', { count: pageCount }) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-black text-lg">
            {percentage === 100 ? t('enhancement.analysisComplete') : t('enhancement.analyzingStructure')}
          </h3>
          <span className="text-sm text-slate-800">{elapsed}</span>
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
          <span
            className="text-slate-900"
            dangerouslySetInnerHTML={{ __html: t('enhancement.pagesComplete', { completed: progress.completedPages, total: progress.totalPages }) }}
          />
          <span className="font-semibold text-blue-600">{percentage}%</span>
        </div>

        {/* Status Summary */}
        <div className="flex gap-4 mt-2 text-xs text-slate-800">
          {processing > 0 && (
            <span className="flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> {t('enhancement.processingCount', { count: processing })}
            </span>
          )}
          {pending > 0 && (
            <span className="flex items-center gap-1">
              <Circle size={12} /> {t('enhancement.pendingCount', { count: pending })}
            </span>
          )}
          {cached > 0 && (
            <span className="flex items-center gap-1">
              <Database size={12} /> {t('enhancement.fromCacheCount', { count: cached })}
            </span>
          )}
          {progress.errorPages > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertCircle size={12} /> {t('enhancement.failedCount', { count: progress.errorPages })}
            </span>
          )}
        </div>
      </div>

      {/* Page List */}
      <div className="px-6 py-4 max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {progress.pageStatuses.map((pageStatus) => {
            const { icon, color, bgColor, label } = getStatusIcon(pageStatus, t);

            return (
              <div
                key={pageStatus.pageNumber}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${bgColor} transition-all duration-300`}
              >
                <div className="flex items-center gap-3">
                  {icon}
                  <span className={`font-medium ${color}`}>
                    {t('enhancement.pageNumber', { number: pageStatus.pageNumber })}
                  </span>
                  <span className="text-slate-800 text-sm">
                    {t('enhancement.fieldCount', { count: pageStatus.fieldCount })}
                  </span>
                </div>
                <span className={`text-sm font-medium ${color}`}>
                  {label}
                  {pageStatus.retryCount > 0 && pageStatus.status === 'error' && (
                    <span className="text-xs ml-1">{t('enhancement.retried')}</span>
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
          <p
            className="text-red-700 text-sm"
            dangerouslySetInnerHTML={{ __html: t('enhancement.errorDetail', { count: progress.errorPages }) }}
          />
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
        <Circle size={18} className="text-slate-600" />
      )}
      <div className="flex-1">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="text-sm font-medium text-slate-900">{percentage}%</span>
    </div>
  );
}
