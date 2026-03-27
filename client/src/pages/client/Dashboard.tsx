/**
 * Client Dashboard Page
 * Shows client's posted jobs and job management options
 * Design: Modern Minimalism - Card-based job list with clear actions
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { Plus, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { currentUser, getJobsByClient } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'startTime'>('createdAt');

  if (!currentUser) {
    return null;
  }

  const jobs = getJobsByClient(currentUser.id);
  const filteredJobs = useMemo(() => {
    let result = statusFilter === 'all' 
      ? [...jobs] 
      : jobs.filter((job) => String(job.status).toUpperCase() === statusFilter);

    // Sort logic
    result.sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      return dateB - dateA; // Descending (Newest first)
    });

    return result;
  }, [jobs, statusFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your posted jobs and track progress
              </p>
            </div>
            <Button
              onClick={() => setLocation('/client/create-job')}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Job</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="FUNDED">Funded</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DISPUTED">Disputed</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            >
              <option value="createdAt">Newest First</option>
              <option value="startTime">Execution Date</option>
            </select>
          </div>
        </div>
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              No jobs yet
            </h2>
            <p className="text-gray-600 mb-6">
              Create your first job to get started.
            </p>
            <Button
              onClick={() => setLocation('/client/create-job')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Create Job
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/client/job/${job.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        Job #{job.id.slice(0, 6).toUpperCase()}
                      </h3>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {job.description}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Pay: </span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(job.pay)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Start Date: </span>
                        <span className="font-semibold text-gray-900">
                          {formatDateTime(job.startTime)}
                        </span>
                      </div>
                      {job.workerAddress && (
                        <div>
                          <span className="text-gray-500">Worker: </span>
                          <span className="font-semibold text-gray-900">
                            {job.workerAddress.slice(0, 6)}...{job.workerAddress.slice(-4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
