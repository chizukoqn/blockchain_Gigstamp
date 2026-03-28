/**
 * Browse Jobs Page
 * Shows available jobs for workers to apply to
 * Design: Modern Minimalism - Card-based job list with apply buttons
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { MapPin, DollarSign, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useMemo, useState } from 'react';
import { translations } from '@/lib/translations';
import { getContract } from '@/lib/blockchain';

export default function BrowseJobs() {
  const [, setLocation] = useLocation();
  const { currentUser, getAvailableJobs, applyForJob, getWorkerJobs, language } = useApp();
  const t = translations[language];
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'startTime'>('createdAt');
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!currentUser) {
    return null;
  }

  const availableJobs = getAvailableJobs();
  
  const filteredJobs = useMemo(() => {
    let result = statusFilter === 'all' 
      ? [...availableJobs] 
      : availableJobs.filter((job) => String(job.status).toUpperCase() === statusFilter);
    
    // Filter out expired jobs (only for those that can be accepted)
    result = result.filter((job) => {
      if (job.status !== 'funded') return true; // Only filter funded jobs that are yet to be accepted
      if (!job.startTime) return true;
      const startTimeSec = Math.floor(new Date(job.startTime).getTime() / 1000);
      return nowSec < startTimeSec + (job.tolerance || 0);
    });

    // Sort logic
    result.sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      return dateB - dateA; // Descending (Newest first)
    });

    return result;
  }, [availableJobs, statusFilter, sortBy, nowSec]);
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
          <h1 className="text-2xl font-bold text-gray-900">{t.nav_browse}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {availableJobs.length} {t.job_available_count}
          </p>
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
              <option value="FUNDED">Funded</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="DISPUTED">Disputed</option>
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
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {t.job_no_available}
            </h2>
            <p className="text-gray-600 mb-6">
              Check back later for new opportunities.
            </p>
            <Button
              onClick={() => setLocation('/worker/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {t.back}
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
                    <div className="flex items-start justify-between w-full">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-xl font-bold text-gray-900 truncate transition-colors">
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            ID {job.id.slice(0, 6).toUpperCase()}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <div className="text-xl font-black text-blue-600 leading-tight">
                          {formatCurrency(job.pay)}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          Reward
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Job Details */}
                  <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">{t.job_pay}</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(job.pay)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">{t.job_start_date}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {formatDateTime(job.startTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">{t.job_location}</p>
                        <p className="font-semibold text-gray-900 text-sm">
                          {job.location || t.unknown}
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
                      {t.job_view_details}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleApply(job.id)}
                      disabled={isApplied}
                      className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApplied ? t.job_applied : t.job_apply}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
