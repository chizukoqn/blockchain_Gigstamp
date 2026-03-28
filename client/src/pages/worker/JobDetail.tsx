/**
 * Worker Job Detail Page
 * Shows job details with apply/submit options
 * Design: Modern Minimalism - Full-width detail view with action buttons
 */

import { Button } from '@/components/ui/button';
import { useLocation, useRoute } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { StatusBadge } from '@/components/StatusBadge';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDateTime } from '@/lib/status';
import { ArrowLeft, MapPin, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { getContract } from '@/lib/blockchain';
import { buildEvidencePayload, hashEvidencePayload } from '@/lib/evidence';
import { WorkerProfile } from '@/components/WorkerProfile';
import { ClientProfileCard } from '@/components/ClientProfileCard';
import { X, Upload } from 'lucide-react';
import { translations } from '@/lib/translations';

export default function WorkerJobDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/worker/job/:jobId');
  const { currentUser, getJobById, applyForJob, getWorkerJobs, submitWork, updateJobStatus, setDisputeEvidence, setDisputeInitiator, setDisputeVoters, addNotification, language } = useApp();
  const t = translations[language];
  
  const [showSubmit, setShowSubmit] = useState(false);
  const [resultDescription, setResultDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceImages, setEvidenceImages] = useState<string[]>([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  
  const [disputeEvidenceText, setDisputeEvidenceText] = useState('');
  const [disputeEvidenceImages, setDisputeEvidenceImages] = useState<string[]>([]);
  const [disputeUploading, setDisputeUploading] = useState(false);
  
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

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t.job_not_found}</h1>
          <Button
            onClick={() => setLocation('/worker/browse-jobs')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {t.back}
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
      
      await contract.acceptJob.staticCall(BigInt(job.onchainJobId));
      
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
      console.log("FULL ERROR:", error);
      const errMsg = error?.reason || error?.shortMessage || error?.message || 'Transaction failed';
      toast.error(errMsg);
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

      if (onchainStatus !== 3) {
        toast.error(onchainStatus === 4 ? 'Job already submitted.' : 'Start the job first.');
        return;
      }

      if (nowSec > endTime + tolerance) {
        toast.error('Submit window expired.');
        return;
      }

      const submitTx = await contract.submitWork(onchainJobId, resultHash);
      await submitTx.wait();

      submitWork(job.id, resultDescription, evidenceImages);
      toast.success('Work submitted!');
      setShowSubmit(false);
      setTimeout(() => setLocation('/worker/dashboard'), 1500);
    } catch (error: any) {
      toast.error(error?.shortMessage || error?.message || 'Failed to submit work');
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async () => {
    if (!job.onchainJobId) return;
    setTxLoading('Starting job...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.startWork(BigInt(job.onchainJobId));
      await tx.wait();
      updateJobStatus(job.id, 'IN_PROGRESS' as any);
      toast.success('Job started!');
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to start job');
    } finally {
      setTxLoading(null);
    }
  };

  const handleTriggerCancelIfNotStarted = async () => {
    if (!job.onchainJobId) return;
    setTxLoading('Triggering timeout...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.cancelIfNotStarted(BigInt(job.onchainJobId));
      await tx.wait();
      updateJobStatus(job.id, 'cancelled');
      toast.success('Job cancelled due to timeout.');
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Action failed');
    } finally {
      setTxLoading(null);
    }
  };

  const handleEvidenceImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setEvidenceUploading(true);
    try {
      const readFile = (f: File) => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      const imgs = await Promise.all(files.map(readFile));
      setEvidenceImages(prev => [...prev, ...imgs]);
    } catch {
      toast.error('Upload failed');
    } finally {
      setEvidenceUploading(false);
    }
  };

  const handleDisputeEvidenceImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setDisputeUploading(true);
    try {
      const readFile = (f: File) => new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(String(reader.result));
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
      const imgs = await Promise.all(files.map(readFile));
      setDisputeEvidenceImages(prev => [...prev, ...imgs]);
    } catch {
      toast.error('Upload failed');
    } finally {
      setDisputeUploading(false);
    }
  };

  const handleRaiseDispute = async () => {
    if (!disputeEvidenceText.trim() && !disputeEvidenceImages.length) {
      toast.error('Provide evidence'); return;
    }
    setTxLoading('Raising dispute...');
    try {
      const contract = await getContractOnce();
      if (!contract || !job.onchainJobId) return;
      const payload = buildEvidencePayload(disputeEvidenceText, disputeEvidenceImages);
      const hash = hashEvidencePayload(payload);
      const onchainJobId = BigInt(job.onchainJobId);
      const evidenceHash = hash;

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

      // Notify the client
      if (job.clientAddress) {
        addNotification({
          type: 'dispute_raised',
          jobId: job.id,
          message: `Worker đã mở khiếu nại (dispute) cho Job #${job.id.slice(0, 6).toUpperCase()}`,
          targetAddress: job.clientAddress,
        });
      }

      toast.success('Dispute raised successfully');
      setDisputeEvidenceText('');
      setDisputeEvidenceImages([]);
      updateJobStatus(job.id, 'disputed' as any);
      
      // Redirect
      setLocation(`/dispute/${job.id}`);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed');
    } finally {
      setTxLoading(null);
    }
  };

  const handleRemoveDisputeImage = (idx: number) => {
    setDisputeEvidenceImages(prev => prev.filter((_, i) => i !== idx));
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
        {/* Detail Cards */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t.job_details_title}</h2>
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 mt-1" />
            <div><p className="text-sm text-gray-600">{t.job_pay}</p><p className="font-semibold">{formatCurrency(job.pay)}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-1" />
            <div><p className="text-sm text-gray-600">{t.job_start_date}</p><p className="font-semibold">{formatDateTime(job.startTime)}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-1" />
            <div><p className="text-sm text-gray-600">End</p><p className="font-semibold">{formatDateTime(job.endTime)}</p></div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-1" />
            <div><p className="text-sm text-gray-600">{t.job_location}</p><p className="font-semibold">{job.location || t.unknown}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
          <p className="text-gray-700">{job.description}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 px-2">Assigned Client</h2>
          <ClientProfileCard clientAddress={job.clientAddress} />
        </div>

        {/* Actions Section */}
        <div className="space-y-4">
          {/* Apply / Start / Submit logic */}
          {job.status === 'funded' && !isApplied && (
            <Button onClick={handleApply} disabled={!!txLoading} className="w-full h-12 bg-blue-600 text-white font-bold rounded-xl">
              {t.job_apply_for}
            </Button>
          )}

          {isApplied && normalizedStatus === 'ACCEPTED' && !showSubmit && (
            <div className="space-y-3">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-900 font-medium">
                  {t.job_deadline_start}: <span className="font-bold">{startDeadlineSec ? formatRemaining(startDeadlineSec) : 'N/A'}</span>
                </p>
                {startDeadlineSec && nowSec > startDeadlineSec ? (
                  <div className="mt-2 text-xs text-rose-600 font-bold uppercase tracking-wider bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Deadline missed. Client may cancel.
                  </div>
                ) : (
                  <Button onClick={handleStartJob} disabled={!!txLoading} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl mt-3 shadow-lg shadow-green-600/20">
                    {txLoading ? 'Starting...' : t.job_start_work}
                  </Button>
                )}
              </div>
            </div>
          )}

          {isApplied && normalizedStatus === 'IN_PROGRESS' && !showSubmit && (
             <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-900 font-medium">
                  {t.job_deadline_submit}: <span className="font-bold">{submitDeadlineSec ? formatRemaining(submitDeadlineSec) : 'N/A'}</span>
                </p>
                {submitDeadlineSec && nowSec > submitDeadlineSec ? (
                  <div className="mt-2 text-xs text-rose-600 font-bold uppercase tracking-wider bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Deadline missed. Payment at risk.
                  </div>
                ) : (
                  <Button onClick={() => setShowSubmit(true)} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl mt-3 shadow-lg shadow-green-600/20">
                    {t.job_submit_work}
                  </Button>
                )}
              </div>
            </div>
          )}

          {showSubmit && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 space-y-5 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">{t.job_submit_work}</h3>
              
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">{t.job_describe_work}</Label>
                <textarea 
                  value={resultDescription} 
                  onChange={e => setResultDescription(e.target.value)}
                  placeholder="Tell the client about your work..."
                  rows={4}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all resize-none shadow-inner"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">Evidence Files</Label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all group">
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                    <span className="text-sm font-bold text-gray-500 group-hover:text-green-700">Choose Evidence Photo</span>
                    <input type="file" multiple onChange={handleEvidenceImagesChange} className="hidden" />
                  </label>

                  {evidenceImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {evidenceImages.map((src, i) => (
                        <div key={i} className="relative group">
                          <img src={src} alt="preview" className="w-full h-28 object-cover rounded-xl border border-gray-100 shadow-sm" />
                          <button 
                            onClick={() => setEvidenceImages(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setShowSubmit(false)} variant="outline" className="flex-1 h-12 rounded-xl border-gray-200">{t.cancel}</Button>
                <Button onClick={handleSubmitWork} disabled={loading} className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/20">
                  {loading ? 'Submitting...' : 'Submit Work'}
                </Button>
              </div>
            </div>
          )}

          {job.status === 'submitted' && isApplied && (
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 text-center font-bold text-blue-800">
              {t.job_work_submitted}
            </div>
          )}

          {/* New Dispute Flow */}
          {(normalizedStatus === 'IN_PROGRESS' || normalizedStatus === 'SUBMITTED') && (
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 space-y-4">
              <h3 className="font-bold text-orange-900 border-b border-orange-200 pb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t.job_raise_dispute}
              </h3>
              <p className="text-sm text-orange-800/80">
                {t.job_provide_evidence_desc}
              </p>
              
              <textarea 
                value={disputeEvidenceText}
                onChange={e => setDisputeEvidenceText(e.target.value)}
                placeholder="Why are you raising a dispute?"
                className="w-full p-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none"
                rows={4}
              />

              <div className="space-y-3">
                <label className="block">
                  <span className="sr-only">Choose evidence photo</span>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-orange-300 border-dashed rounded-xl cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all">
                    <Upload className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-bold text-orange-700">Choose Evidence Photo</span>
                    <input type="file" multiple onChange={handleDisputeEvidenceImagesChange} className="hidden" />
                  </div>
                </label>

                {disputeEvidenceImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {disputeEvidenceImages.map((src, i) => (
                      <div key={i} className="relative group">
                        <img src={src} alt="dispute-preview" className="w-full h-28 object-cover rounded-xl border border-orange-200" />
                        <button 
                          onClick={() => handleRemoveDisputeImage(i)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleRaiseDispute} disabled={!!txLoading} className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-600/20">
                {txLoading || t.job_raise_dispute}
              </Button>
            </div>
          )}


          {/* Dispute Active/Resolved Banner */}
          {(normalizedStatus === 'DISPUTED' || normalizedStatus === 'RESOLVED') && (
            <div className={`p-6 rounded-2xl border flex items-center justify-between ${
              normalizedStatus === 'RESOLVED' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            }`}>
              <div>
                <h3 className="font-bold">{normalizedStatus === 'RESOLVED' ? t.job_dispute_resolved : t.job_dispute_active}</h3>
                <p className="text-sm">{normalizedStatus === 'RESOLVED' ? t.job_case_closed : t.job_dispute_formal}</p>
              </div>
              <Button onClick={() => setLocation(`/dispute/${job.id}`)} variant="outline">{t.job_view_details_btn}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
