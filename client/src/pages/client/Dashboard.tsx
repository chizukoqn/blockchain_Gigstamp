/**
 * Client Dashboard Page
 * Shows client's posted jobs and job management options
 * Design: Modern Minimalism - Card-based job list with clear actions
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { BottomNav } from '@/components/BottomNav';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { Plus, ArrowRight } from 'lucide-react';

export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { currentUser, getJobsByClient } = useApp();

  if (!currentUser) {
    return null;
  }

  const jobs = getJobsByClient(currentUser.id);

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
        {jobs.length === 0 ? (
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
            {jobs.map((job) => (
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

      <BottomNav />
    </div>
  );
}
