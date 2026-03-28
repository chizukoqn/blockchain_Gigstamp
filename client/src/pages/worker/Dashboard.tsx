/**
 * Worker Dashboard Page
 * Shows worker's stats and quick actions
 * Design: Modern Minimalism - Stats cards with clear navigation
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { formatRating } from '@/lib/status';
import { Briefcase, Star, TrendingUp } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useMemo, useRef, useState } from 'react';
import { getContract } from '@/lib/blockchain';
import { toast } from 'sonner';

export default function WorkerDashboard() {
  const [, setLocation] = useLocation();
  const { currentUser, getWorkerStats, getWorkerJobs, jobs: allJobs, language } = useApp();
  const t = translations[language];
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const contractRef = useRef<any>(null);

  if (!currentUser) {
    return null;
  }

  const stats = getWorkerStats(currentUser.id);
  const jobs = getWorkerJobs(currentUser.id);
  const filteredJobs = useMemo(() => {
    if (statusFilter === 'all') return jobs;
    return jobs.filter((job) => String(job.status).toUpperCase() === statusFilter);
  }, [jobs, statusFilter]);
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  const disputedJobs = useMemo(() => {
    return (allJobs || []).filter((j: any) => {
      const s = typeof j.status === 'string' ? j.status.toUpperCase() : String(j.status);
      const isDisputed = s === 'DISPUTED';
      if (!isDisputed) return false;

      // EXCLUDE if user is the worker or client of this job
      const userAddr = currentUser.address.toLowerCase();
      if (j.clientAddress?.toLowerCase() === userAddr) return false;
      if (j.workerAddress?.toLowerCase() === userAddr) return false;

      // INCLUDE ONLY if user is in the voters list
      const isVoter = (j.disputeVoters || []).some(
        (v: string) => v.toLowerCase() === userAddr
      );
      return isVoter;
    });
  }, [allJobs, currentUser.address]);

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  const handleVote = async (jobId: string, voteForWorker: boolean) => {
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      const job = (allJobs || []).find((j: any) => j.id === jobId);
      if (!job?.onchainJobId) {
        toast.error('Missing on-chain job ID');
        return;
      }
      const tx = await contract.castVote(BigInt(job.onchainJobId), voteForWorker);
      await tx.wait();
      toast.success('Vote submitted (rewards will be claimable if applicable)');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to vote');
    } finally {
      setTxLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <h1 className="text-2xl font-bold text-gray-900">{t.dashboard_worker_title}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {t.dashboard_subtitle}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Average Rating */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">{t.dashboard_avg_rating}</h3>
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            {stats.ratingCount > 0 ? (
              <>
                <p className="text-3xl font-bold text-gray-900">
                  {formatRating(stats.averageRating)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {t.dashboard_based_on} {stats.ratingCount} {t.dashboard_reviews}
                </p>
              </>
            ) : (
              <p className="text-lg text-gray-600">{t.dashboard_no_rating}</p>
            )}
          </div>

          {/* Jobs Completed */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">{t.profile_jobs_completed}</h3>
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{completedJobs}</p>
            <p className="text-xs text-gray-500 mt-1">
              {jobs.length} {t.dashboard_total_applied}
            </p>
          </div>

          {/* Active Jobs */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600">{t.dashboard_active_jobs}</h3>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {jobs.filter((j) => j.status !== 'completed').length}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t.dashboard_in_progress}
            </p>
          </div>
        </div>



        {/* CTA Button */}
        <Button
          onClick={() => setLocation('/worker/browse-jobs')}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg mb-6"
        >
          {t.dashboard_browse_cta}
        </Button>

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t.dashboard_recent_jobs}
            </h2>
            <div className="mb-4">
              <label className="text-sm text-gray-600 mr-2">{t.dashboard_filter_status}</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
              >
                <option value="all">All</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="DISPUTED">Disputed</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/worker/job/${job.id}`)}
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      Job #{job.id.slice(0, 6).toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {job.description.slice(0, 50)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${job.pay}</p>
                    <p className="text-xs text-gray-500 capitalize">{job.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
