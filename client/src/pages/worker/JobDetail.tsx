/**
 * Worker Job Detail Page
 * Shows job details with apply/submit options
 * Design: Modern Minimalism - Full-width detail view with action buttons
 */

import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { ArrowLeft, MapPin, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { getContract } from '@/lib/blockchain';
import { buildEvidencePayload, hashEvidencePayload } from '@/lib/evidence';

export default function WorkerJobDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/worker/job/:jobId');
  const { currentUser, getJobById, applyForJob, getWorkerJobs, submitWork, updateJobStatus, setDisputeEvidence, setCounterEvidence } = useApp();
  const [showSubmit, setShowSubmit] = useState(false);
  const [resultDescription, setResultDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [disputeEvidenceText, setDisputeEvidenceText] = useState('');
  const [disputeEvidenceImages, setDisputeEvidenceImages] = useState<string[]>([]);
  const [disputeUploading, setDisputeUploading] = useState(false);

  const [counterEvidenceText, setCounterEvidenceText] = useState('');
  const [counterEvidenceImages, setCounterEvidenceImages] = useState<string[]>([]);
  const [counterUploading, setCounterUploading] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const contractRef = useRef<any>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!match || !currentUser) {
    return null;
  }

  const job = getJobById(params?.jobId);
  const workerJobs = getWorkerJobs(currentUser.id);
  const isApplied = workerJobs.some((j) => j.id === job?.id);
  const normalizedStatus = useMemo(() => {
    if (!job) return '';
    if (job.status === 'accepted') return 'ACCEPTED';
    if (typeof job.status === 'string') return job.status.toUpperCase();
    return String(job.status);
  }, [job]);

  const formatRemaining = (targetSec: number) => {
    const diff = targetSec - nowSec;
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const startDeadlineSec =
    Number.isFinite(Date.parse(job?.startTime ?? '')) && job
      ? Math.floor(new Date(job.startTime).getTime() / 1000) + job.tolerance
      : null;
  const submitDeadlineSec =
    Number.isFinite(Date.parse(job?.endTime ?? '')) && job
      ? Math.floor(new Date(job.endTime).getTime() / 1000) + job.tolerance
      : null;

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job not found</h1>
          <Button
            onClick={() => setLocation('/worker/browse-jobs')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Browse
          </Button>
        </div>
      </div>
    );
  }

  const handleApply = async () => {
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return;
    }

    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }

      setTxLoading('Processing transaction...');
      const tx = await contract.acceptJob(BigInt(job.onchainJobId));
      await tx.wait();

      const success = applyForJob(job.id);
      if (success) {
        toast.success('Applied successfully!');
        setTimeout(() => setLocation('/worker/dashboard'), 1000);
      } else {
        toast.error('Could not apply for this job');
      }
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to apply');
      console.error(error);
    } finally {
      setTxLoading(null);
    }
  };

  const handleSubmitWork = async () => {
    if (!resultDescription.trim()) {
      toast.error('Please describe your work');
      return;
    }
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return;
    }

    setLoading(true);
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }

      const onchainJobId = BigInt(job.onchainJobId);
      const resultPayload = buildEvidencePayload(resultDescription, evidenceImages);
      const resultHash = hashEvidencePayload(resultPayload);
      const onchainJob = await contract.jobs(onchainJobId);
      const onchainStatus = Number(onchainJob.status ?? onchainJob[11]);
      const endTime = Number(onchainJob.endTime ?? onchainJob[4]);
      const tolerance = Number(onchainJob.tolerance ?? onchainJob[5]);
      const nowSec = Math.floor(Date.now() / 1000);

      if (onchainStatus !== 3) {
        if (onchainStatus === 4) {
          toast.error('This job is already submitted on-chain.');
        } else {
          toast.error('Please start the job first.');
        }
        return;
      }

      if (nowSec > endTime + tolerance) {
        toast.error('You started too late to submit (submit window expired).');
        return;
      }

      const submitTx = await contract.submitWork(onchainJobId, resultHash);
      await submitTx.wait();

      submitWork(job.id, resultDescription, evidenceImages);
      toast.success('Work submitted! Waiting for approval.');
      setShowSubmit(false);
      setResultDescription('');
      setEvidenceImages([]);
      setTimeout(() => setLocation('/worker/dashboard'), 1500);
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to submit work');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async () => {
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return;
    }

    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }

      const onchainJobId = BigInt(job.onchainJobId);
      const onchainJob = await contract.jobs(onchainJobId);
      const onchainStatus = Number(onchainJob.status ?? onchainJob[11]);
      const startTime = Number(onchainJob.startTime ?? onchainJob[3]);
      const tolerance = Number(onchainJob.tolerance ?? onchainJob[5]);
      const nowSec = Math.floor(Date.now() / 1000);

      if (onchainStatus !== 2) {
        if (onchainStatus === 3) {
          updateJobStatus(job.id, 'IN_PROGRESS' as any);
          toast.success('Job is already started. You can submit now.');
          return;
        }
        toast.error(`Cannot start in current on-chain status (${onchainStatus}).`);
        return;
      }

      if (nowSec > startTime + tolerance) {
        toast.error('You started too late (start window expired).');
        return;
      }

      const tx = await contract.startWork(onchainJobId);
      await tx.wait();
      updateJobStatus(job.id, 'IN_PROGRESS' as any);
      toast.success('Job started. You can submit your work now.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to start job');
    } finally {
      setTxLoading(null);
    }
  };

  const handleTriggerCancelIfNotStarted = async () => {
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return;
    }
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      const tx = await contract.cancelIfNotStarted(BigInt(job.onchainJobId));
      await tx.wait();
      updateJobStatus(job.id, 'cancelled');
      toast.success('Timeout triggered. Job cancelled and refunded to client.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Too early or action failed');
    } finally {
      setTxLoading(null);
    }
  };

  const handleEvidenceImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setEvidenceUploading(true);
    try {
      const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

      const newImages = await Promise.all(files.map(readFileAsDataUrl));
      setEvidenceImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload images');
    } finally {
      setEvidenceUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidenceImage = (index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  const handleRaiseDispute = async () => {
    if (!disputeEvidenceText.trim() && disputeEvidenceImages.length === 0) {
      toast.error('Please provide evidence text and/or images');
      return;
    }
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      const payload = buildEvidencePayload(disputeEvidenceText, disputeEvidenceImages);
      const evidenceHash = hashEvidencePayload(payload);
      if (!job?.onchainJobId) {
        toast.error('Missing on-chain job ID');
        return;
      }
      const onchainJobId = BigInt(job.onchainJobId);
      const tx = await contract.raiseDispute(onchainJobId, evidenceHash);
      await tx.wait();
      toast.success('Dispute raised');
      setDisputeEvidence(job!.id, evidenceHash, disputeEvidenceText, disputeEvidenceImages);
      setDisputeEvidenceText('');
      setDisputeEvidenceImages([]);
      updateJobStatus(job!.id, 'disputed' as any);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to raise dispute');
    } finally {
      setTxLoading(null);
    }
  };

  const handleSubmitCounterEvidence = async () => {
    if (!counterEvidenceText.trim() && counterEvidenceImages.length === 0) {
      toast.error('Please provide counter evidence text and/or images');
      return;
    }
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      const payload = buildEvidencePayload(counterEvidenceText, counterEvidenceImages);
      const counterHash = hashEvidencePayload(payload);
      if (!job?.onchainJobId) {
        toast.error('Missing on-chain job ID');
        return;
      }
      const onchainJobId = BigInt(job.onchainJobId);
      const tx = await contract.submitCounterEvidence(onchainJobId, counterHash);
      await tx.wait();
      toast.success('Counter evidence submitted');
      setCounterEvidence(job!.id, counterHash, counterEvidenceText, counterEvidenceImages);
      setCounterEvidenceText('');
      setCounterEvidenceImages([]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to submit counter evidence');
    } finally {
      setTxLoading(null);
    }
  };

  const handleDisputeEvidenceImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setDisputeUploading(true);
    try {
      const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

      const newImages = await Promise.all(files.map(readFileAsDataUrl));
      setDisputeEvidenceImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload images');
    } finally {
      setDisputeUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveDisputeImage = (index: number) => {
    setDisputeEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCounterEvidenceImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setCounterUploading(true);
    try {
      const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

      const newImages = await Promise.all(files.map(readFileAsDataUrl));
      setCounterEvidenceImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload images');
    } finally {
      setCounterUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCounterImage = (index: number) => {
    setCounterEvidenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVote = async (voteForWorker: boolean) => {
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      if (!job?.onchainJobId) {
        toast.error('Missing on-chain job ID');
        return;
      }
      const onchainJobId = BigInt(job.onchainJobId);
      const tx = await contract.castVote(onchainJobId, voteForWorker);
      await tx.wait();
      toast.success('Vote submitted');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to vote');
    } finally {
      setTxLoading(null);
    }
  };

  const handleResolveDispute = async () => {
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }
      if (!job?.onchainJobId) {
        toast.error('Missing on-chain job ID');
        return;
      }
      const onchainJobId = BigInt(job.onchainJobId);
      const tx = await contract.resolveDispute(onchainJobId);
      await tx.wait();
      toast.success('Dispute resolved');
      updateJobStatus(job!.id, 'resolved' as any);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to resolve dispute');
    } finally {
      setTxLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/worker/browse-jobs')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Job #{job.id.slice(0, 6).toUpperCase()}
              </h1>
              <StatusBadge status={job.status} className="mt-2" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6 max-w-2xl">
        {/* Job Details */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Pay Amount</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(job.pay)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDateTime(job.startTime)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">End Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDateTime(job.endTime)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Tolerance</p>
                <p className="text-lg font-semibold text-gray-900">
                  {job.tolerance}s
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="text-lg font-semibold text-gray-900">
                  {job.location}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
          <p className="text-gray-700 leading-relaxed">{job.description}</p>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Client</h2>
          <p className="text-gray-700 font-mono">
            {job.clientAddress}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {normalizedStatus === 'ACCEPTED' && startDeadlineSec !== null && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <p className="text-sm text-amber-900">
                Time left to start: <span className="font-semibold">{formatRemaining(startDeadlineSec)}</span>
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Deadline: {formatDateTime(new Date(startDeadlineSec * 1000).toISOString())}
              </p>
              {nowSec > startDeadlineSec && (
                <div className="mt-3">
                  <p className="text-xs text-amber-800 mb-2">
                    Start window expired. Timeout is not automatic; anyone can trigger cancellation on-chain.
                  </p>
                  <Button
                    onClick={handleTriggerCancelIfNotStarted}
                    disabled={!!txLoading}
                    variant="outline"
                    className="w-full h-10 rounded-lg disabled:opacity-50"
                  >
                    {txLoading ? txLoading : 'Trigger Timeout Cancel'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {normalizedStatus === 'IN_PROGRESS' && submitDeadlineSec !== null && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <p className="text-sm text-blue-900">
                Time left to submit: <span className="font-semibold">{formatRemaining(submitDeadlineSec)}</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Deadline: {formatDateTime(new Date(submitDeadlineSec * 1000).toISOString())}
              </p>
            </div>
          )}

          {job.status === 'funded' && !isApplied && (
            <Button
              onClick={handleApply}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Apply for This Job
            </Button>
          )}

          {isApplied && normalizedStatus === 'ACCEPTED' && !showSubmit && (
            <Button
              onClick={handleStartJob}
              disabled={!!txLoading}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
            >
              {txLoading ? txLoading : 'Start Job'}
            </Button>
          )}

          {isApplied && normalizedStatus === 'IN_PROGRESS' && !showSubmit && (
            <Button
              onClick={() => setShowSubmit(true)}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
            >
              Submit Work
            </Button>
          )}

          {showSubmit && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Submit Your Work
              </h3>

              <textarea
                placeholder="Describe what you've completed..."
                value={resultDescription}
                onChange={(e) => setResultDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
              />

              {/* Evidence Images */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">Minh chứng ảnh</h4>
                  <p className="text-xs text-gray-500">(1 hoặc nhiều ảnh)</p>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={evidenceUploading}
                  onChange={handleEvidenceImagesChange}
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:text-gray-700 hover:file:bg-gray-50 disabled:opacity-50 mb-3"
                />

                {evidenceImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {evidenceImages.map((src, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={src}
                          alt={`submission-evidence-${idx}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEvidenceImage(idx)}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-gray-200 shadow text-gray-700 hover:bg-gray-50"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowSubmit(false)}
                  variant="outline"
                  className="flex-1 h-11 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitWork}
                  disabled={loading}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Work'}
                </Button>
              </div>
            </div>
          )}

          {job.status === 'submitted' && isApplied && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 text-center">
              <p className="text-blue-800 font-semibold">
                Work submitted! Waiting for client approval.
              </p>
            </div>
          )}

          {job.status === 'completed' && isApplied && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200 text-center">
              <p className="text-green-800 font-semibold">
                Job completed and rated!
              </p>
            </div>
          )}

          {/* Dispute: Raise Dispute */}
          {(normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'SUBMITTED') && (
            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">Raise Dispute</h3>
              <p className="text-sm text-orange-800 mb-4">
                Provide evidence as text, images, or both. We will auto-hash it for on-chain submission.
              </p>

              <textarea
                value={disputeEvidenceText}
                onChange={(e) => setDisputeEvidenceText(e.target.value)}
                placeholder="Evidence text (optional)"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-3"
              />

              <input
                type="file"
                accept="image/*"
                multiple
                disabled={disputeUploading}
                onChange={handleDisputeEvidenceImagesChange}
                className="w-full text-sm text-orange-900 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border file:border-orange-200 file:bg-white file:text-orange-900 hover:file:bg-orange-50 disabled:opacity-50 mb-3"
              />

              {disputeEvidenceImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {disputeEvidenceImages.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={src}
                        alt={`dispute-evidence-${idx}`}
                        className="w-full h-24 object-cover rounded-lg border border-orange-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDisputeImage(idx)}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-orange-200 shadow text-orange-900 hover:bg-orange-50"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleRaiseDispute}
                disabled={!!txLoading}
                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {txLoading ? txLoading : 'Raise Dispute'}
              </Button>
            </div>
          )}

          {/* Dispute: Active block */}
          {normalizedStatus === 'DISPUTED' && (
            <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Dispute Active</h3>
                  <p className="text-sm text-red-800 mt-1">Job is currently in dispute.</p>
                </div>
                {txLoading && (
                  <span className="text-sm font-semibold text-red-900">{txLoading}</span>
                )}
              </div>

              {/* Dispute Info */}
              <div className="bg-white/60 rounded-xl border border-red-100 p-4 mb-4">
                <p className="text-sm text-red-900">
                  <span className="font-semibold">JobId:</span> {job.id}
                </p>
                <p className="text-sm text-red-900 mt-1 break-all">
                  <span className="font-semibold">Client:</span> {job.clientAddress}
                </p>
                <p className="text-sm text-red-900 mt-1 break-all">
                  <span className="font-semibold">Worker:</span> {job.workerAddress || '—'}
                </p>
              </div>

              {/* Counter Evidence */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-900 mb-2">Counter Evidence</h4>
                <textarea
                  value={counterEvidenceText}
                  onChange={(e) => setCounterEvidenceText(e.target.value)}
                  placeholder="Counter evidence text (optional)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-3"
                />

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={counterUploading}
                  onChange={handleCounterEvidenceImagesChange}
                  className="w-full text-sm text-red-900 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border file:border-red-200 file:bg-white file:text-red-900 hover:file:bg-red-50 disabled:opacity-50 mb-3"
                />

                {counterEvidenceImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {counterEvidenceImages.map((src, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={src}
                          alt={`counter-evidence-${idx}`}
                          className="w-full h-24 object-cover rounded-lg border border-red-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCounterImage(idx)}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border border-red-200 shadow text-red-900 hover:bg-red-50"
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  onClick={handleSubmitCounterEvidence}
                  disabled={!!txLoading}
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {txLoading ? txLoading : 'Submit Counter Evidence'}
                </Button>
              </div>

              {/* Voting */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-900 mb-2">Voting</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleVote(true)}
                    disabled={!!txLoading}
                    className="h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    Vote for Worker
                  </Button>
                  <Button
                    onClick={() => handleVote(false)}
                    disabled={!!txLoading}
                    className="h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
                  >
                    Vote for Client
                  </Button>
                </div>
              </div>

              {/* Resolve */}
              <Button
                onClick={handleResolveDispute}
                disabled={!!txLoading}
                className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {txLoading ? txLoading : 'Resolve Dispute'}
              </Button>
            </div>
          )}

          {/* Dispute: Resolved */}
          {normalizedStatus === 'RESOLVED' && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
              <h3 className="text-lg font-semibold text-amber-900">Dispute Resolved</h3>
              <p className="text-sm text-amber-800 mt-2">
                Dispute has been resolved.
              </p>
              <p className="text-sm text-amber-800 mt-2">
                Winner: (not available)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
