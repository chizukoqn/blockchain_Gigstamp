/**
 * Status utilities for GigStamp
 */

import { JobStatus } from '@/types';

function normalizeStatus(status: JobStatus): string {
  // existing UI: accepted ~= IN_PROGRESS
  if (status === 'accepted') return 'IN_PROGRESS';
  if (status === 'created') return 'CREATED';
  if (status === 'funded') return 'FUNDED';
  if (status === 'submitted') return 'SUBMITTED';
  if (status === 'completed') return 'COMPLETED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'disputed') return 'DISPUTED';
  if (status === 'resolved') return 'RESOLVED';
  return status;
}

export function getStatusLabel(status: JobStatus): string {
  switch (normalizeStatus(status)) {
    case 'CREATED':
      return 'Created';
    case 'FUNDED':
      return 'Funded';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'SUBMITTED':
      return 'Submitted';
    case 'DISPUTED':
      return 'Disputed';
    case 'RESOLVED':
      return 'Resolved';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return String(status);
  }
}

export function getStatusColor(status: JobStatus): string {
  switch (normalizeStatus(status)) {
    case 'CREATED':
      return 'bg-indigo-100 text-indigo-800';
    case 'FUNDED':
      return 'bg-blue-100 text-blue-800';
    case 'IN_PROGRESS':
      return 'bg-orange-100 text-orange-800';
    case 'SUBMITTED':
      return 'bg-purple-100 text-purple-800';
    case 'DISPUTED':
      return 'bg-red-100 text-red-800';
    case 'RESOLVED':
      return 'bg-amber-100 text-amber-900';
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-gray-200 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusTimeline(): JobStatus[] {
  // Keep existing UI flow; dispute is an exceptional state rendered inline.
  return ['created', 'funded', 'accepted', 'submitted', 'completed'];
}

export function getStatusIndex(status: JobStatus): number {
  const timeline = getStatusTimeline();
  const idx = timeline.indexOf(status);
  if (idx >= 0) return idx;

  // Map exceptional statuses to nearest milestone to avoid breaking timeline UI.
  const normalized = normalizeStatus(status);
  if (normalized === 'IN_PROGRESS') return timeline.indexOf('accepted');
  if (normalized === 'SUBMITTED' || normalized === 'DISPUTED') return timeline.indexOf('submitted');
  if (normalized === 'RESOLVED' || normalized === 'COMPLETED') return timeline.indexOf('completed');
  if (normalized === 'CANCELLED') return timeline.indexOf('created');
  return 0;
}

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} ETH`;
}

export function formatDate(dateString: string): string {
  const trimmed = String(dateString ?? '').trim();
  if (!trimmed) return '—';

  // If we stored deadline as "seconds remaining", show a countdown instead of a date.
  // We treat small numeric values as duration seconds.
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds)) {
      // Heuristic: large values are likely unix seconds since epoch.
      if (seconds >= 1_000_000_000) {
        const date = new Date(seconds * 1000);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }

      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;

      if (h > 0) return `${h}h ${m}m ${s}s left`;
      if (m > 0) return `${m}m ${s}s left`;
      return `${s}s left`;
    }
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRating(rating: number): string {
  return rating.toFixed(1);
}
