/**
 * Browse Jobs Page
 * Shows available jobs for workers to apply to
 * Design: Modern Minimalism - Card-based job list with apply buttons
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { BottomNav } from '@/components/BottomNav';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { MapPin, DollarSign, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { getContract } from '@/lib/blockchain';

export default function BrowseJobs() {
  const [, setLocation] = useLocation();
  const { currentUser, getAvailableJobs, applyForJob, getWorkerJobs } = useApp();
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');

  if (!currentUser) {
    return null;
  }

  const availableJobs = getAvailableJobs();
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return availableJobs;
    return availableJobs.filter((job) => String(job.status).toUpperCase() === statusFilter);
  }, [availableJobs, statusFilter]);
  const workerJobs = getWorkerJobs(currentUser.id);
  const appliedJobIds = workerJobs.map((j) => j.id);

  const handleApply = async (jobId: string) => {
    const job = availableJobs.find((j) => j.id === jobId);
    if (!job?.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return;
    }

    try {
      const contract = await getContract();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }

      const tx = await contract.acceptJob(BigInt(job.onchainJobId));
      await tx.wait();

      const success = applyForJob(jobId);
      if (success) {
        setAppliedJobs((prev) => [...prev, jobId]);
        toast.success('Applied successfully! Check your dashboard.');
        setTimeout(() => setLocation('/worker/dashboard'), 1500);
      } else {
        toast.error('Could not apply for this job');
      }
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to apply for job');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <h1 className="text-2xl font-bold text-gray-900">Browse Jobs</h1>
          <p className="text-sm text-gray-600 mt-1">
            {availableJobs.length} jobs available
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className="mb-4">
          <label className="text-sm text-gray-600 mr-2">Filter by status badge</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
          >
            <option value="all">All</option>
            <option value="FUNDED">Funded</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="DISPUTED">Disputed</option>
          </select>
        </div>
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              No jobs available
            </h2>
            <p className="text-gray-600 mb-6">
              Check back later for new opportunities.
            </p>
            <Button
              onClick={() => setLocation('/worker/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Back to Dashboard
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const isApplied = appliedJobIds.includes(job.id);

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-2xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Job #{job.id.slice(0, 6).toUpperCase()}
                        </h3>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {job.description}
                      </p>
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">Pay</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(job.pay)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">Start Date</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {formatDateTime(job.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {job.distance || '2.3 km'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation(`/worker/job/${job.id}`)}
                      variant="outline"
                      className="flex-1 h-10 rounded-lg gap-2"
                    >
                      View Details
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleApply(job.id)}
                      disabled={isApplied}
                      className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApplied ? 'Applied' : 'Apply'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
