/**
 * Client Job Detail Page
 * Shows full job details with actions (Fund, Approve, Feedback)
 * Design: Modern Minimalism - Full-width detail view with status timeline
 */

import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTimeline } from '@/components/StatusTimeline';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { ArrowLeft, MapPin, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { getContract } from '@/lib/blockchain';
import { buildEvidencePayload, hashEvidencePayload } from '@/lib/evidence';
import { ethers } from 'ethers';
import { WorkerProfile } from '@/components/WorkerProfile';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { translations } from '@/lib/translations';

export default function ClientJobDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/client/job/:jobId');
  const { getJobById, updateJobStatus, submitFeedback, feedbacks, setDisputeEvidence, setDisputeInitiator, setDisputeVoters, addNotification, currentUser, language } = useApp();
  const t = translations[language];
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [disputeEvidenceText, setDisputeEvidenceText] = useState('');
  const [disputeEvidenceImages, setDisputeEvidenceImages] = useState<string[]>([]);
  const [disputeUploading, setDisputeUploading] = useState(false);

  const contractRef = useRef<any>(null);

  if (!match) {
    return null;
  }

  const job = getJobById(params?.jobId);
  const existingFeedback = job ? feedbacks.find((f) => f.jobId === job.id) : undefined;
  const normalizedStatus = useMemo(() => {
    if (!job) return '';
    if (job.status === 'accepted') return 'ACCEPTED';
    if (typeof job.status === 'string') return job.status.toUpperCase();
    return String(job.status);
  }, [job]);

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.job_not_found}</h1>
          <Button
            onClick={() => setLocation('/client/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t.back}
          </Button>
        </div>
      </div>
    );
  }

  const handleFundJob = async () => {
    if (job.status !== 'created') return;
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID. Please re-create this job.');
      return;
    }

    setTxLoading('Waiting for wallet confirmation...');
    try {
      const contract = await getContractOnce();
      if (!contract) {
        toast.error('Contract unavailable');
        return;
      }

      const signerAddress = String(await contract.runner.getAddress()).toLowerCase();
      if (signerAddress !== job.clientAddress.toLowerCase()) {
        toast.error('Please switch MetaMask to the client wallet that created this job.');
        return;
      }

      const confirmFund = window.confirm(
        `Confirm funding from wallet ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)} for job #${job.id.slice(0, 6).toUpperCase()}`
      );
      if (!confirmFund) return;

      const payWei = ethers.parseEther(job.pay.toString());
      const tx = await contract.fundJob(BigInt(job.onchainJobId), { value: payWei });
      await tx.wait();
      updateJobStatus(job.id, 'funded');
      toast.success('Job funded! Workers can now apply.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to fund job');
    } finally {
      setTxLoading(null);
    }
  };

  const handleApproveJob = () => {
    if (job.status === 'submitted') {
      setShowFeedback(true);
    }
  };

  const handleSubmitFeedback = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
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

      const tx = await contract.approveJob(
        BigInt(job.onchainJobId),
        Number(rating),
        comment || ''
      );
      await tx.wait();

      submitFeedback(job.id, rating, comment, evidenceImages);
      toast.success('Feedback submitted! Job completed and worker paid.');
      setShowFeedback(false);
      setRating(0);
      setComment('');
      setEvidenceImages([]);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to approve job');
    } finally {
      setTxLoading(null);
    }
  };

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  const getOnchainJobId = () => {
    if (!job.onchainJobId) {
      toast.error('Missing on-chain job ID');
      return null;
    }
    return BigInt(job.onchainJobId);
  };

  const handleCancelJob = async () => {
    const onchainJobId = getOnchainJobId();
    if (onchainJobId === null) return;
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const onchainJob = await contract.jobs(onchainJobId);
      const onchainStatus = Number(onchainJob.status ?? onchainJob[11]);
      const startTime = Number(onchainJob.startTime ?? onchainJob[3]);
      const endTime = Number(onchainJob.endTime ?? onchainJob[4]);
      const tolerance = Number(onchainJob.tolerance ?? onchainJob[5]);
      const submittedAt = Number(onchainJob.submittedAt ?? onchainJob[10]);
      const nowSec = Math.floor(Date.now() / 1000);
      const signerAddress = String(await contract.runner.getAddress()).toLowerCase();
      const isClientSigner = signerAddress === String(job.clientAddress).toLowerCase();

      let tx: any;
      let nextStatus: 'cancelled' | 'completed' = 'cancelled';
      let successMessage = 'Job cancelled and refunded to client.';
      if (onchainStatus === 1) {
        tx = await contract.cancelJob(onchainJobId);
      } else if (onchainStatus === 2) {
        if (nowSec > startTime + tolerance) {
          tx = await contract.cancelIfNotStarted(onchainJobId);
        } else {
          if (!isClientSigner) {
            toast.error('Only client can cancel before timeout.');
            return;
          }
          tx = await contract.cancelJob(onchainJobId);
        }
      } else if (onchainStatus === 3) {
        if (nowSec < endTime + tolerance) {
          toast.error('Too early to cancel: submit timeout not reached.');
          return;
        }
        tx = await contract.cancelIfNotSubmitted(onchainJobId);
      } else if (onchainStatus === 4) {
        const approveTimeout = Number(await contract.APPROVE_TIMEOUT());
        if (nowSec < submittedAt + approveTimeout) {
          toast.error('Too early for auto release.');
          return;
        }
        tx = await contract.autoReleaseIfNotApproved(onchainJobId);
        nextStatus = 'completed';
        successMessage = 'Auto release executed. Worker paid.';
      } else {
        toast.error(`Cannot cancel in current on-chain status (${onchainStatus}).`);
        return;
      }

      await tx.wait();
      updateJobStatus(job.id, nextStatus);
      toast.success(successMessage);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to cancel job');
    } finally {
      setTxLoading(null);
    }
  };

  const handleCancelIfNotStarted = async () => {
    const onchainJobId = getOnchainJobId();
    if (onchainJobId === null) return;
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.cancelIfNotStarted(onchainJobId);
      await tx.wait();
      updateJobStatus(job.id, 'cancelled');
      toast.success('Job cancelled: worker did not start in time.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Too early or action failed');
    } finally {
      setTxLoading(null);
    }
  };

  const handleCancelIfNotSubmitted = async () => {
    const onchainJobId = getOnchainJobId();
    if (onchainJobId === null) return;
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.cancelIfNotSubmitted(onchainJobId);
      await tx.wait();
      updateJobStatus(job.id, 'cancelled');
      toast.success('Job cancelled: worker did not submit in time.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Too early or action failed');
    } finally {
      setTxLoading(null);
    }
  };

  const handleAutoReleaseIfNotApproved = async () => {
    const onchainJobId = getOnchainJobId();
    if (onchainJobId === null) return;
    setTxLoading('Processing transaction...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.autoReleaseIfNotApproved(onchainJobId);
      await tx.wait();
      updateJobStatus(job.id, 'completed');
      toast.success('Auto-released payment to worker.');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Too early or action failed');
    } finally {
      setTxLoading(null);
    }
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
      const onchainJobId = getOnchainJobId();
      if (onchainJobId === null) return;
      const payload = buildEvidencePayload(disputeEvidenceText, disputeEvidenceImages);
      const evidenceHash = hashEvidencePayload(payload);
      const tx = await contract.raiseDispute(onchainJobId, evidenceHash);
      await tx.wait();

      // Fetch newly selected voters to notify them immediately
      const voters: string[] = await contract.getDisputeVoters(onchainJobId);
      const cleanVoters = voters.filter((v: string) => v !== '0x0000000000000000000000000000000000000000');
      
      setDisputeEvidence(job.id, evidenceHash, disputeEvidenceText, disputeEvidenceImages);
      setDisputeInitiator(job.id, currentUser?.address || '');
      if (cleanVoters.length > 0) {
        setDisputeVoters(job.id, cleanVoters);
      }

      // Notify the worker
      if (job.workerAddress) {
        addNotification({
          type: 'dispute_raised',
          jobId: job.id,
          message: `Client đã mở khiếu nại (dispute) cho Job #${job.id.slice(0, 6).toUpperCase()}`,
          targetAddress: job.workerAddress,
        });
      }

      toast.success('Dispute raised');
      setDisputeEvidenceText('');
      setDisputeEvidenceImages([]);
      updateJobStatus(job.id, 'disputed' as any);
      
      // Redirect to the new dispute page
      setLocation(`/dispute/${job.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to raise dispute');
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
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

      const newImages = await Promise.all(files.map(readFileAsDataUrl));
      setEvidenceImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload images');
    } finally {
      setEvidenceUploading(false);
      // Allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleRemoveEvidenceImage = (index: number) => {
    setEvidenceImages((prev) => prev.filter((_, i) => i !== index));
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

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/client/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 leading-tight">
                {job.title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                  ID {job.id.slice(0, 6).toUpperCase()}
                </span>
                <StatusBadge status={job.status} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6 max-w-2xl">
        {/* Status Timeline */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.job_progress}</h2>
          <StatusTimeline currentStatus={job.status} />
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.job_details_title}</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">{t.job_pay_amount} (ETH)</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(job.pay)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">{t.job_start_date}</p>
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
                <p className="text-sm text-gray-600">{t.job_tolerance}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {job.tolerance}s
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">{t.job_location}</p>
                <p className="text-lg font-semibold text-gray-900">
                  {job.location || t.unknown}
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

        {/* Worker Submission */}
        {job.status === 'submitted' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t.job_worker_submission}</h2>

            {job.submissionDescription && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-800">{job.submissionDescription}</p>
              </div>
            )}

            {job.submissionEvidenceImages?.length ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">{t.job_submission_evidence}</p>
                <div className="grid grid-cols-2 gap-2">
                  {job.submissionEvidenceImages.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`submission-evidence-${idx}`}
                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Worker Info */}
        {job.workerAddress && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 px-2">{t.job_assigned_worker}</h2>
            <WorkerProfile workerAddress={job.workerAddress} />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {job.status === 'created' && (
            <div className="flex gap-3">
              <Button
                onClick={handleFundJob}
                disabled={!!txLoading}
                className="flex-[2] h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {txLoading ? txLoading : t.job_fund_btn}
              </Button>
              <Button
                onClick={handleCancelJob}
                disabled={!!txLoading}
                variant="outline"
                className="flex-1 h-12 border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold rounded-lg"
              >
                Cancel
              </Button>
            </div>
          )}

          {(normalizedStatus === 'FUNDED' || normalizedStatus === 'ACCEPTED' || normalizedStatus === 'IN_PROGRESS') && (
            <div className="space-y-3">
              <Button
                onClick={handleCancelJob}
                disabled={!!txLoading}
                className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {txLoading ? txLoading : 'Cancel Job'}
              </Button>
              <p className="text-xs text-gray-500 text-center italic">
                Note: Job can only be cancelled after deadlines if worker fails to start/submit.
              </p>
            </div>
          )}

          {job.status === 'submitted' && (
            <>
              {!showFeedback ? (
                <Button
                  onClick={handleApproveJob}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                >
                  {t.job_rate_worker}
                </Button>
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {t.job_rate_worker}
                  </h3>

                  {/* Star Rating */}
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-3xl transition-colors ${
                          star <= rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <textarea
                    placeholder={t.job_feedback_optional}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
                  />

                {/* Evidence Images */}
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {t.job_submission_evidence}
                    </h4>
                    <p className="text-xs text-gray-500">
                      (1 hoặc nhiều ảnh)
                    </p>
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
                            alt={`evidence-${idx}`}
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

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowFeedback(false)}
                      variant="outline"
                      className="flex-1 h-11 rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={!!txLoading}
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                      {txLoading ? txLoading : t.job_submit_feedback}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleAutoReleaseIfNotApproved}
                disabled={!!txLoading}
                variant="outline"
                className="w-full h-12 rounded-lg disabled:opacity-50"
              >
                {txLoading ? txLoading : 'Timeout: Auto Release If Not Approved'}
              </Button>
            </>
          )}

          {job.status === 'completed' && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200 text-center">
              <p className="text-green-800 font-semibold">
                {t.job_completed_rated}
              </p>

              {existingFeedback && (
                <div className="mt-3 text-left">
                  <p className="text-sm text-green-900">
                    {t.job_rating}: {existingFeedback.rating}/5
                  </p>
                  {existingFeedback.comment && (
                    <p className="text-sm text-green-900 mt-1">
                      {existingFeedback.comment}
                    </p>
                  )}
                  {existingFeedback.evidenceImages?.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {existingFeedback.evidenceImages.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt={`feedback-evidence-${idx}`}
                          className="w-full h-24 object-cover rounded-lg border border-green-200"
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Dispute: Raise Dispute */}
          {(normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'SUBMITTED') && (
            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-200 space-y-4 shadow-sm">
              <h3 className="text-lg font-bold text-orange-900 border-b border-orange-200 pb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t.job_raise_dispute}
              </h3>
              <p className="text-sm text-orange-800/80 mb-4">
                {t.job_provide_evidence_desc}
              </p>

              <textarea
                value={disputeEvidenceText}
                onChange={(e) => setDisputeEvidenceText(e.target.value)}
                placeholder="Evidence text (optional)"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white bg-white/50 transition-all resize-none mb-3 shadow-inner"
              />

              <div className="space-y-3">
                <label className="block">
                  <span className="sr-only">Choose evidence photo</span>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-300 border-dashed rounded-xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all">
                    <Upload className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-bold text-orange-600">Choose Evidence Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={disputeUploading}
                      onChange={handleDisputeEvidenceImagesChange}
                      className="hidden"
                    />
                  </div>
                </label>

                {disputeEvidenceImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {disputeEvidenceImages.map((src, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={src}
                          alt={`dispute-evidence-${idx}`}
                          className="w-full h-28 object-cover rounded-xl border border-orange-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDisputeImage(idx)}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleRaiseDispute}
                disabled={!!txLoading}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20"
              >
                {txLoading ? txLoading : t.job_raise_dispute}
              </Button>
            </div>
          )}


          {/* Dispute: Active or Resolved banner */}
          {(normalizedStatus === 'DISPUTED' || normalizedStatus === 'RESOLVED') && (
            <div className={`rounded-2xl p-6 border ${
              normalizedStatus === 'RESOLVED' 
                ? 'bg-amber-50 border-amber-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className={`text-lg font-semibold ${
                    normalizedStatus === 'RESOLVED' ? 'text-amber-900' : 'text-red-900'
                  }`}>
                    {normalizedStatus === 'RESOLVED' ? 'Dispute Resolved' : 'Dispute Active'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    normalizedStatus === 'RESOLVED' ? 'text-amber-800' : 'text-red-800'
                  }`}>
                    {normalizedStatus === 'RESOLVED' 
                      ? 'This dispute has been settled.' 
                      : 'This job is currently under formal dispute.'}
                  </p>
                </div>
                <Button 
                  onClick={() => setLocation(`/dispute/${job.id}`)}
                  variant="outline"
                  className={normalizedStatus === 'RESOLVED' 
                    ? 'border-amber-300 text-amber-900 hover:bg-amber-100' 
                    : 'border-red-300 text-red-900 hover:bg-red-100'
                  }
                >
                  View Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
