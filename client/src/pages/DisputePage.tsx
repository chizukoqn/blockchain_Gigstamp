/**
 * Dispute Page – Role-based dispute detail view
 * Hiển thị thông tin dispute và UI khác nhau cho:
 *  - Initiator (người khởi tạo)
 *  - Responder (bên bị dispute)
 *  - Voter (người được chọn vote)
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getContract } from '@/lib/blockchain';
import { buildEvidencePayload, hashEvidencePayload } from '@/lib/evidence';
import { formatDateTime } from '@/lib/status';
import {
  ArrowLeft, Scale, User, Briefcase, Clock, FileText,
  CheckCircle, XCircle, AlertTriangle, ThumbsUp, ThumbsDown,
  Shield, Eye, Upload
} from 'lucide-react';

export default function DisputePage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/dispute/:jobId');
  const {
    currentUser, getJobById, updateJobStatus,
    setCounterEvidence, setDisputeVoters, setDisputeResolved,
    addNotification, notifications,
  } = useApp();

  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [counterText, setCounterText] = useState('');
  const [counterImages, setCounterImages] = useState<string[]>([]);
  const [counterUploading, setCounterUploading] = useState(false);
  const [onchainDispute, setOnchainDispute] = useState<any>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [myVoteChoice, setMyVoteChoice] = useState<boolean | null>(null);
  const contractRef = useRef<any>(null);

  const job = getJobById(params?.jobId ?? '');

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  // Xác định role của user trong dispute này
  const userAddress = currentUser?.address?.toLowerCase() ?? '';
  const isInitiator = useMemo(
    () => job?.disputeInitiator?.toLowerCase() === userAddress,
    [job, userAddress]
  );
  const isInvolved = useMemo(
    () =>
      job?.clientAddress?.toLowerCase() === userAddress ||
      job?.workerAddress?.toLowerCase() === userAddress,
    [job, userAddress]
  );
  const isResponder = useMemo(() => isInvolved && !isInitiator, [isInvolved, isInitiator]);
  const isVoter = useMemo(
    () => job?.disputeVoters?.some((v) => v.toLowerCase() === userAddress) ?? false,
    [job, userAddress]
  );

  const hasVotedAlready = useMemo(() => {
    // Kiểm tra notification "selected_as_voter" đã chuyển thành voted chưa
    // Dùng onchain state nếu có
    if (onchainDispute) {
      // onchainDispute.hasVoted không accessible trực tiếp từ view, dùng local check
    }
    return false; // sẽ bị handle bởi contract revert nếu double vote
  }, [onchainDispute]);

  // Fetch voters + dispute info từ on-chain khi mount
  useEffect(() => {
    if (!job?.onchainJobId) return;

    const fetchOnchain = async () => {
      try {
        const contract = await getContractOnce();
        if (!contract) return;

        const onchainJobId = BigInt(job.onchainJobId!);

        // Fetch voters
        const voters: string[] = await contract.getDisputeVoters(onchainJobId);
        const cleanVoters = voters.filter((v: string) => v !== '0x0000000000000000000000000000000000000000');
        if (cleanVoters.length > 0) {
          setDisputeVoters(job.id, cleanVoters);
        }

        // Fetch dispute data
        const d = await contract.disputes(onchainJobId);
        setOnchainDispute(d);

        // Fetch vote status for current user
        if (currentUser) {
          const voted: boolean = await contract.hasVoted(onchainJobId, currentUser.address);
          setHasVoted(voted);
          if (voted) {
            const choice: boolean = await contract.voteChoice(onchainJobId, currentUser.address);
            setMyVoteChoice(choice);
          }
        }
      } catch (err) {
        console.error('Failed to fetch on-chain dispute data:', err);
      }
    };

    fetchOnchain();
  }, [job?.onchainJobId, currentUser?.address]);

  const handleReplaceVoters = async () => {
    if (!job?.onchainJobId) return;
    setTxLoading('Đang thay thế voter...');
    try {
      const contract = await getContractOnce();
      if (!contract) return;
      const tx = await contract.replaceInactiveVoters(BigInt(job.onchainJobId));
      await tx.wait();
      toast.success('Đã thay thế các voter không hoạt động và reset deadline!');
      // Reload page state
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to replace voters');
    } finally {
      setTxLoading(null);
    }
  };

  const handleCounterImagesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setCounterUploading(true);
    try {
      const readFile = (f: File) =>
        new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(String(reader.result));
          reader.onerror = () => rej(new Error('Failed to read file'));
          reader.readAsDataURL(f);
        });
      const imgs = await Promise.all(files.map(readFile));
      setCounterImages((prev) => [...prev, ...imgs]);
    } catch {
      toast.error('Failed to upload images');
    } finally {
      setCounterUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmitCounter = async () => {
    if (!counterText.trim() && counterImages.length === 0) {
      toast.error('Vui lòng cung cấp nội dung counter evidence');
      return;
    }
    if (!job?.onchainJobId) { toast.error('Missing on-chain job ID'); return; }
    setTxLoading('Đang xử lý giao dịch...');
    try {
      const contract = await getContractOnce();
      if (!contract) { toast.error('Contract unavailable'); return; }
      const payload = buildEvidencePayload(counterText, counterImages);
      const hash = hashEvidencePayload(payload);
      const tx = await contract.submitCounterEvidence(BigInt(job.onchainJobId), hash);
      await tx.wait();
      setCounterEvidence(job.id, hash, counterText, counterImages);
      toast.success('Counter evidence đã được nộp thành công!');
      setCounterText('');
      setCounterImages([]);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to submit counter evidence');
    } finally {
      setTxLoading(null);
    }
  };

  const handleVote = async (voteForWorker: boolean) => {
    if (!job?.onchainJobId) { toast.error('Missing on-chain job ID'); return; }
    setTxLoading('Đang ghi phiếu bầu...');
    try {
      const contract = await getContractOnce();
      if (!contract) { toast.error('Contract unavailable'); return; }
      const tx = await contract.castVote(BigInt(job.onchainJobId), voteForWorker);
      await tx.wait();
      
      setHasVoted(true);
      setMyVoteChoice(voteForWorker);
      toast.success(`Đã vote cho ${voteForWorker ? 'Worker' : 'Client'}!`);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to vote');
    } finally {
      setTxLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!job?.onchainJobId) { toast.error('Missing on-chain job ID'); return; }
    setTxLoading('Đang giải quyết dispute...');
    try {
      const contract = await getContractOnce();
      if (!contract) { toast.error('Contract unavailable'); return; }
      const tx = await contract.resolveDispute(BigInt(job.onchainJobId));
      const receipt = await tx.wait();

      // Tìm event DisputeResolved để lấy workerWon
      let workerWon = false;
      try {
        const iface = contract.interface;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'DisputeResolved') {
              workerWon = parsed.args.workerWon;
              break;
            }
          } catch { /* skip */ }
        }
      } catch { /* fallback */ }

      setDisputeResolved(job.id, workerWon);
      updateJobStatus(job.id, 'resolved' as any);

      // Tạo notification cho cả 3 bên
      const winner = workerWon ? 'Worker' : 'Client';
      const jobShortId = job.id.slice(0, 6).toUpperCase();
      const notifMsg = `Dispute Job #${jobShortId} đã được giải quyết. Bên thắng: ${winner}`;
      [
        job.clientAddress,
        job.workerAddress ?? '',
        ...(job.disputeVoters ?? []),
      ].filter(Boolean).forEach((addr) => {
        addNotification({
          type: 'dispute_resolved',
          jobId: job.id,
          message: notifMsg,
          targetAddress: addr,
        });
      });

      toast.success(`Dispute đã được giải quyết! Bên thắng: ${winner}`);
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Failed to resolve dispute');
    } finally {
      setTxLoading(null);
    }
  };

  if (!match || !currentUser) return null;

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
        <div className="text-center text-white">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h1 className="text-2xl font-bold mb-4">Dispute không tìm thấy</h1>
          <Button onClick={() => setLocation('/disputes')} className="bg-violet-600 hover:bg-violet-700">
            Quay lại Disputes
          </Button>
        </div>
      </div>
    );
  }

  const isDisputed =
    job.status === 'disputed' || job.status === 'DISPUTED' ||
    job.status === 'resolved' || job.status === 'RESOLVED';
  const isResolved = job.status === 'resolved' || job.status === 'RESOLVED' || job.disputeResolved;

  const initiatorIsClient = job.disputeInitiator?.toLowerCase() === job.clientAddress?.toLowerCase();
  const initiatorLabel = initiatorIsClient ? 'Client (Initiator)' : 'Worker (Initiator)';
  const responderLabel = initiatorIsClient ? 'Worker (Responder)' : 'Client (Responder)';

  const yourRoleLabel = isInitiator
    ? '🟢 Bạn là người khởi tạo dispute'
    : isResponder
    ? '🔴 Bạn là bên bị dispute'
    : isVoter
    ? '🟡 Bạn là Voter được chọn'
    : '👁️ Người xem';

  const hasCounterEvidence = job.counterEvidenceText || (job.counterEvidenceImages?.length ?? 0) > 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl border-b border-white/10" style={{ background: 'rgba(15,12,41,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation('/disputes')}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-bold text-white">
                Dispute #{job.id.slice(0, 6).toUpperCase()}
              </h1>
            </div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${
              isResolved
                ? 'bg-green-500/20 text-green-300'
                : 'bg-red-500/20 text-red-300'
            }`}>
              {isResolved ? '✅ Resolved' : '⚖️ Active'}
            </span>
          </div>
          {/* Your Role Badge */}
          <div className="text-xs font-medium text-white/70 bg-white/10 px-3 py-1.5 rounded-full">
            {isInitiator ? '🟢 Initiator' : isResponder ? '🔴 Responder' : isVoter ? '🟡 Voter' : '👁️'}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Role Banner */}
        <div className={`rounded-2xl p-4 border ${
          isInitiator
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : isResponder
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : isVoter
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-white/5 border-white/10 text-white/60'
        }`}>
          <p className="font-semibold">{yourRoleLabel}</p>
          <p className="text-sm opacity-80 mt-0.5">
            {isInitiator && 'Bạn đã khởi tạo dispute này. Xem evidence và resolve khi đủ điều kiện.'}
            {isResponder && 'Bạn bị dispute. Hãy nộp counter evidence để bảo vệ quan điểm của bạn.'}
            {isVoter && 'Bạn được chọn làm voter. Hãy xem xét bằng chứng và bỏ phiếu.'}
          </p>
        </div>

        {/* Job Information */}
        <div className="rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-violet-400" />
            Thông tin Job
          </h2>
          <div className="space-y-3">
            <InfoRow label="Job ID (local)" value={`#${job.id.slice(0, 8).toUpperCase()}`} />
            {job.onchainJobId && (
              <InfoRow label="On-chain Job ID" value={`#${job.onchainJobId}`} />
            )}
            <InfoRow label="Mô tả" value={job.description} />
            <InfoRow label="Ngày tạo job" value={formatDateTime(job.createdAt)} />
            <InfoRow label="Ngày bắt đầu" value={formatDateTime(job.startTime)} />
            <InfoRow label="Ngày kết thúc" value={formatDateTime(job.endTime)} />
            {job.location && <InfoRow label="Địa điểm" value={job.location} />}
          </div>
        </div>

        {/* Participants */}
        <div className="rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-400" />
            Các bên tham gia
          </h2>
          <div className="space-y-3">
            <ParticipantRow
              label="Client"
              address={job.clientAddress}
              badge={initiatorIsClient ? '⚡ Initiator' : undefined}
              isCurrentUser={job.clientAddress?.toLowerCase() === userAddress}
            />
            <ParticipantRow
              label="Worker"
              address={job.workerAddress ?? '—'}
              badge={!initiatorIsClient ? '⚡ Initiator' : undefined}
              isCurrentUser={job.workerAddress?.toLowerCase() === userAddress}
            />
            {job.disputeInitiator && (
              <ParticipantRow
                label="Người khởi tạo dispute"
                address={job.disputeInitiator}
                badge="⚡ Initiator"
                highlight
              />
            )}
            {(job.disputeVoters ?? []).length > 0 && (
              <div>
                <p className="text-sm text-white/50 mb-2">Voters được chọn:</p>
                {(job.disputeVoters ?? []).map((v, i) => (
                  <ParticipantRow
                    key={i}
                    label={`Voter ${i + 1}`}
                    address={v}
                    badge="🗳️ Voter"
                    isCurrentUser={v.toLowerCase() === userAddress}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Evidence Section */}
        <div className="rounded-2xl p-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            Bằng chứng
          </h2>

          {/* Initiator Evidence */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              <p className="text-sm font-semibold text-white/80">{initiatorLabel} – Evidence gốc</p>
            </div>
            {job.disputeEvidenceText ? (
              <div className="rounded-xl p-4 border border-orange-400/20 bg-orange-400/5">
                <p className="text-white/80 text-sm leading-relaxed">{job.disputeEvidenceText}</p>
              </div>
            ) : (
              <div className="rounded-xl p-4 border border-white/10 bg-white/5">
                <p className="text-white/40 text-sm italic">Evidence chỉ lưu on-chain (hash)</p>
                {job.disputeEvidenceHash && (
                  <p className="text-white/30 text-xs font-mono mt-1 break-all">{job.disputeEvidenceHash}</p>
                )}
              </div>
            )}
            {(job.disputeEvidenceImages ?? []).length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {job.disputeEvidenceImages!.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`evidence-${i}`}
                    className="w-full h-28 object-cover rounded-xl border border-orange-400/20"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Counter Evidence */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
              <p className="text-sm font-semibold text-white/80">{responderLabel} – Counter Evidence</p>
            </div>
            {hasCounterEvidence ? (
              <>
                {job.counterEvidenceText && (
                  <div className="rounded-xl p-4 border border-cyan-400/20 bg-cyan-400/5">
                    <p className="text-white/80 text-sm leading-relaxed">{job.counterEvidenceText}</p>
                  </div>
                )}
                {(job.counterEvidenceImages ?? []).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {job.counterEvidenceImages!.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`counter-${i}`}
                        className="w-full h-28 object-cover rounded-xl border border-cyan-400/20"
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl p-4 border border-dashed border-white/20 bg-white/5 text-center">
                <Clock className="w-6 h-6 text-white/30 mx-auto mb-2" />
                <p className="text-white/40 text-sm">Chưa có counter evidence</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Responder: Submit Counter Evidence ── */}
        {isResponder && !isResolved && !hasCounterEvidence && (
          <div className="rounded-2xl p-6 border border-cyan-500/30" style={{ background: 'rgba(6,182,212,0.07)' }}>
            <h3 className="text-lg font-bold text-cyan-300 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Nộp Counter Evidence
            </h3>
            <p className="text-sm text-cyan-200/70 mb-4">
              Cung cấp bằng chứng phản hồi để bảo vệ quan điểm của bạn.
            </p>
            <textarea
              value={counterText}
              onChange={(e) => setCounterText(e.target.value)}
              placeholder="Mô tả phản hồi của bạn..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none mb-3"
            />
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={counterUploading}
              onChange={handleCounterImagesChange}
              className="w-full text-sm text-white/60 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-white/20 file:bg-white/10 file:text-white file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50 mb-3"
            />
            {counterImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {counterImages.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} alt={`counter-preview-${i}`} className="w-full h-24 object-cover rounded-xl border border-cyan-400/20" />
                    <button
                      onClick={() => setCounterImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={handleSubmitCounter}
              disabled={!!txLoading}
              className="w-full h-12 font-semibold rounded-xl disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: 'white' }}
            >
              {txLoading ?? 'Nộp Counter Evidence'}
            </Button>
          </div>
        )}

        {/* ── Voter: Voting Section ── */}
        {isVoter && !isResolved && (
          <div className="rounded-2xl p-6 border border-amber-500/30" style={{ background: 'rgba(245,158,11,0.07)' }}>
            <h3 className="text-lg font-bold text-amber-300 mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Bỏ phiếu
            </h3>
            
            {hasVoted ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-2">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-amber-400" />
                  <div>
                    <p className="text-white font-semibold">Bạn đã hoàn thành vote</p>
                    <p className="text-amber-200/70 text-sm">
                      Bạn đã bầu cho: <span className="font-bold text-amber-300">{myVoteChoice ? 'Worker (Bên nộp Counter Evidence)' : 'Client (Bên khởi tạo)'}</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-amber-200/70 mb-5">
                  Hãy xem xét kỹ bằng chứng từ cả hai bên trước khi bỏ phiếu. Mỗi voter chỉ vote được 1 lần.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleVote(false)}
                    disabled={!!txLoading}
                    className="h-14 rounded-xl font-bold disabled:opacity-50 flex flex-col items-center gap-1 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white' }}
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span className="text-sm">Vote for Client</span>
                  </Button>
                  <Button
                    onClick={() => handleVote(true)}
                    disabled={!!txLoading}
                    className="h-14 rounded-xl font-bold disabled:opacity-50 flex flex-col items-center gap-1 transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span className="text-sm">Vote for Worker</span>
                  </Button>
                </div>
              </>
            )}
            {txLoading && (
              <p className="text-center text-amber-300/70 text-sm mt-3 animate-pulse">{txLoading}</p>
            )}
          </div>
        )}

        {/* ── Initiator / Responder: Action Section ── */}
        {(isInitiator || isResponder) && !isResolved && (
          <div className="space-y-4">
            {/* Resolve Section */}
            <div className="rounded-2xl p-6 border border-violet-500/30" style={{ background: 'rgba(139,92,246,0.07)' }}>
              <h3 className="text-lg font-bold text-violet-300 mb-2">⚖️ Resolve Dispute</h3>
              <p className="text-sm text-violet-200/70 mb-5">
                Chỉ có thể resolve khi: tất cả voter đã bỏ phiếu <strong>HOẶC</strong> đã hết thời gian voting.
              </p>
              <Button
                onClick={handleResolve}
                disabled={!!txLoading}
                className="w-full h-12 font-bold rounded-xl disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white' }}
              >
                {txLoading ?? '⚖️ Resolve Dispute'}
              </Button>
            </div>

            {/* Replace Voters Section - Only if deadline passed */}
            {onchainDispute && Number(onchainDispute.deadline) < Math.floor(Date.now() / 1000) && (
              <div className="rounded-2xl p-6 border border-rose-500/30" style={{ background: 'rgba(244,63,94,0.07)' }}>
                <h3 className="text-lg font-bold text-rose-300 mb-2 items-center flex gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Quá hạn deadline voting
                </h3>
                <p className="text-sm text-rose-200/70 mb-5">
                  Một số voter đã không thực hiện bỏ phiếu đúng hạn. Bạn có thể thay thế họ bằng các voter mới và reset deadline.
                </p>
                <Button
                  onClick={handleReplaceVoters}
                  disabled={!!txLoading}
                  className="w-full h-12 font-bold rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white' }}
                >
                  {txLoading ?? '🔄 Thay thế Voter & Tiếp tục'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Resolved Result Banner ── */}
        {isResolved && (
          <div className={`rounded-2xl p-6 border ${
            job.disputeWorkerWon
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-blue-500/40 bg-blue-500/10'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {job.disputeWorkerWon ? (
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              ) : (
                <CheckCircle className="w-8 h-8 text-blue-400" />
              )}
              <div>
                <h3 className="text-lg font-bold text-white">Dispute Đã Được Giải Quyết</h3>
                <p className={`font-semibold ${job.disputeWorkerWon ? 'text-emerald-300' : 'text-blue-300'}`}>
                  🏆 Bên thắng: {job.disputeWorkerWon ? 'Worker' : 'Client'}
                </p>
              </div>
            </div>
            {job.disputeWorkerWon !== undefined && (
              <div className="rounded-xl p-3 bg-white/10">
                <p className="text-sm text-white/70">
                  {job.disputeWorkerWon
                    ? '✅ Worker thắng — Tiền được chuyển cho Worker'
                    : '✅ Client thắng — Tiền được hoàn lại cho Client'}
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-white/50 flex-shrink-0">{label}</span>
      <span className="text-sm text-white/90 text-right break-all">{value}</span>
    </div>
  );
}

function ParticipantRow({
  label,
  address,
  badge,
  isCurrentUser,
  highlight,
}: {
  label: string;
  address: string;
  badge?: string;
  isCurrentUser?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 border ${
      isCurrentUser
        ? 'border-violet-400/30 bg-violet-400/10'
        : highlight
        ? 'border-orange-400/30 bg-orange-400/10'
        : 'border-white/10 bg-white/5'
    }`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-white/50">{label}</span>
        <div className="flex gap-1">
          {badge && (
            <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{badge}</span>
          )}
          {isCurrentUser && (
            <span className="text-xs bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full">Bạn</span>
          )}
        </div>
      </div>
      <p className="text-sm text-white/80 font-mono break-all">{address}</p>
    </div>
  );
}
