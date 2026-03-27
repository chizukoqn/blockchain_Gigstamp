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
import { jobIdToUint256 } from '@/lib/evidence';

export default function ClientJobDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/client/job/:jobId');
  const { getJobById, updateJobStatus, submitFeedback, feedbacks, setDisputeEvidence, setCounterEvidence } = useApp();
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [disputeEvidenceText, setDisputeEvidenceText] = useState('');
  const [disputeEvidenceImages, setDisputeEvidenceImages] = useState<string[]>([]);
  const [disputeUploading, setDisputeUploading] = useState(false);

  const [counterEvidenceText, setCounterEvidenceText] = useState('');
  const [counterEvidenceImages, setCounterEvidenceImages] = useState<string[]>([]);
  const [counterUploading, setCounterUploading] = useState(false);

  const contractRef = useRef<any>(null);

  if (!match) {
    return null;
  }

  const job = getJobById(params?.jobId);
  const existingFeedback = job ? feedbacks.find((f) => f.jobId === job.id) : undefined;
  const normalizedStatus = useMemo(() => {
    if (!job) return '';
    // accepted ~= IN_PROGRESS
    if (job.status === 'accepted') return 'IN_PROGRESS';
    if (typeof job.status === 'string') return job.status.toUpperCase();
    return String(job.status);
  }, [job]);

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job not found</h1>
          <Button
            onClick={() => setLocation('/client/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Back to Dashboard
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

      const payWei = BigInt(Math.round(job.pay * 1e18));
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

  const handleSubmitFeedback = () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    submitFeedback(job.id, rating, comment, evidenceImages);
    toast.success('Feedback submitted! Job completed.');
    setShowFeedback(false);
    setRating(0);
    setComment('');
    setEvidenceImages([]);
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
      const onchainJobId = jobIdToUint256(job.id);
      const payload = buildEvidencePayload(disputeEvidenceText, disputeEvidenceImages);
      const evidenceHash = hashEvidencePayload(payload);
      const tx = await contract.raiseDispute(onchainJobId, evidenceHash);
      await tx.wait();
      toast.success('Dispute raised');
      setDisputeEvidence(job.id, evidenceHash, disputeEvidenceText, disputeEvidenceImages);
      setDisputeEvidenceText('');
      setDisputeEvidenceImages([]);
      updateJobStatus(job.id, 'disputed' as any);
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
      const onchainJobId = jobIdToUint256(job.id);
      const payload = buildEvidencePayload(counterEvidenceText, counterEvidenceImages);
      const counterHash = hashEvidencePayload(payload);
      const tx = await contract.submitCounterEvidence(onchainJobId, counterHash);
      await tx.wait();
      toast.success('Counter evidence submitted');
      setCounterEvidence(job.id, counterHash, counterEvidenceText, counterEvidenceImages);
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
      const onchainJobId = jobIdToUint256(job.id);
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
      const onchainJobId = jobIdToUint256(job.id);
      const tx = await contract.resolveDispute(onchainJobId);
      await tx.wait();
      toast.success('Dispute resolved');
      updateJobStatus(job.id, 'resolved' as any);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.shortMessage || err?.message || 'Failed to resolve dispute');
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
        {/* Status Timeline */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Progress</h2>
          <StatusTimeline currentStatus={job.status} />
        </div>

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

        {/* Worker Submission */}
        {job.status === 'submitted' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Work Submitted</h2>

            {job.submissionDescription && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-800">{job.submissionDescription}</p>
              </div>
            )}

            {job.submissionEvidenceImages?.length ? (
              <div>
                <p className="text-sm text-gray-600 mb-2">Minh chứng ảnh</p>
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
          <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned Worker</h2>
            <p className="text-gray-700 font-mono">
              {job.workerAddress}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {job.status === 'created' && (
            <Button
              onClick={handleFundJob}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              Fund Job
            </Button>
          )}

          {job.status === 'submitted' && (
            <>
              {!showFeedback ? (
                <Button
                  onClick={handleApproveJob}
                  className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                >
                  Approve & Rate
                </Button>
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Rate the Worker
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
                    placeholder="Share your feedback (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
                  />

                {/* Evidence Images */}
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Minh chứng ảnh
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
                      className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg"
                    >
                      Submit Feedback
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {job.status === 'completed' && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200 text-center">
              <p className="text-green-800 font-semibold">
                Job completed and rated
              </p>

              {existingFeedback && (
                <div className="mt-3 text-left">
                  <p className="text-sm text-green-900">
                    Rating: {existingFeedback.rating}/5
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
                {/* Winner data not available in current UI state */}
                Winner: (not available)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
