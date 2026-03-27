/**
 * StatusBadge Component
 * Displays job status with appropriate color coding
 * Design: Modern Minimalism - Clean status indicators with distinct colors
 */

import { JobStatus } from '@/types';
import { getStatusLabel, getStatusColor } from '@/lib/status';

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = getStatusLabel(status);
  const colorClass = getStatusColor(status);

  return (
    <span className={`status-badge ${colorClass} ${className}`}>
      {label}
    </span>
  );
}
