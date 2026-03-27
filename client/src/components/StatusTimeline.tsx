/**
 * StatusTimeline Component
 * Shows job lifecycle progression from Created to Completed
 * Design: Modern Minimalism - Visual progress indicator with clear stages
 */

import { Fragment } from 'react';
import { JobStatus } from '@/types';
import { getStatusTimeline, getStatusIndex, getStatusLabel } from '@/lib/status';
import { Check } from 'lucide-react';

interface StatusTimelineProps {
  currentStatus: JobStatus;
}

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  const timeline = getStatusTimeline();
  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className="w-full">
      {/* Circles + connector segments */}
      <div className="flex items-center w-full">
        {timeline.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <Fragment key={status}>
              <div className="w-10 flex flex-col items-center">
                {/* Status Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </div>
              </div>

              {/* Connector segment (only colored for completed steps) */}
              {index < timeline.length - 1 && (
                <div
                  className={`flex-1 h-1 rounded-full ${
                    index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Labels row */}
      <div className="flex w-full justify-between mt-2">
        {timeline.map((status, index) => {
          const isCurrent = index === currentIndex;

          return (
            <div key={status} className="flex-1 text-center">
              <span
                className={`text-xs font-medium text-center leading-tight ${
                  isCurrent ? 'text-blue-600 font-semibold' : 'text-gray-500'
                }`}
              >
                {getStatusLabel(status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
