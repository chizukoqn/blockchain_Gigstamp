/**
 * Dispute List Page
 * Hiển thị danh sách các dispute liên quan đến user hiện tại
 * (là client, worker, hoặc voter trong dispute đó)
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { getContract } from '@/lib/blockchain';
import { formatDateTime } from '@/lib/status';
import { Scale, ArrowRight, Clock, CheckCircle, AlertTriangle, User } from 'lucide-react';

export default function DisputeListPage() {
  const [, setLocation] = useLocation();
  const { currentUser, getDisputesForUser, setDisputeVoters, addNotification } = useApp();
  const contractRef = useRef<any>(null);
  const [votersFetched, setVotersFetched] = useState(false);

  const address = currentUser?.address ?? '';
  const disputes = getDisputesForUser(address);

  const getContractOnce = async () => {
    if (contractRef.current) return contractRef.current;
    const c = await getContract();
    if (!c) return null;
    contractRef.current = c;
    return c;
  };

  // Fetch voters on-chain cho tất cả disputed jobs mà user là client/worker
  useEffect(() => {
    if (!currentUser || votersFetched) return;

    const fetchVotersForAll = async () => {
      try {
        const contract = await getContractOnce();
        if (!contract) return;

        // Tất cả jobs đang disputed/resolved mà user có liên quan
        const allDisputedJobs = getDisputesForUser(address);

        for (const job of allDisputedJobs) {
          if (!job.onchainJobId) continue;
          if (job.disputeVoters && job.disputeVoters.length > 0) continue; // đã có

          try {
            const voters: string[] = await contract.getDisputeVoters(BigInt(job.onchainJobId));
            const clean = voters.filter(
              (v: string) => v !== '0x0000000000000000000000000000000000000000'
            );
            if (clean.length > 0) {
              setDisputeVoters(job.id, clean);

              // Tạo notification nếu user là voter
              const isVoter = clean.some(
                (v: string) => v.toLowerCase() === currentUser.address.toLowerCase()
              );
              if (isVoter) {
                addNotification({
                  type: 'selected_as_voter',
                  jobId: job.id,
                  message: `Bạn được chọn làm voter cho dispute của Job #${job.id.slice(0, 6).toUpperCase()}`,
                  targetAddress: currentUser.address,
                });
              }
            }
          } catch {
            // bỏ qua lỗi per-job
          }
        }
      } catch (err) {
        console.error('Failed fetching voters:', err);
      } finally {
        setVotersFetched(true);
      }
    };

    fetchVotersForAll();
  }, [currentUser?.address]);

  if (!currentUser) return null;

  const getRole = (job: any) => {
    const addr = address.toLowerCase();
    const isInitiator = job.disputeInitiator?.toLowerCase() === addr;
    const isClient = job.clientAddress?.toLowerCase() === addr;
    const isWorker = job.workerAddress?.toLowerCase() === addr;
    const isVoter = job.disputeVoters?.some((v: string) => v.toLowerCase() === addr);

    if (isVoter && !isClient && !isWorker) return { label: 'Voter', color: 'amber' };
    if (isInitiator) return { label: 'Initiator', color: 'orange' };
    if (isClient) return { label: 'Client', color: 'blue' };
    if (isWorker) return { label: 'Worker', color: 'emerald' };
    return { label: 'Tham gia', color: 'gray' };
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl border-b border-white/10" style={{ background: 'rgba(15,12,41,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3">
            <Scale className="w-7 h-7 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Disputes của tôi</h1>
              <p className="text-sm text-white/50">
                {disputes.length} dispute liên quan đến bạn
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Scale className="w-16 h-16 text-white/20 mb-4" />
            <h2 className="text-xl font-semibold text-white/50 mb-2">Không có dispute nào</h2>
            <p className="text-white/30 text-sm">
              Bạn chưa tham gia vào bất kỳ dispute nào.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((job) => {
              const role = getRole(job);
              const isResolved =
                job.status === 'resolved' || job.status === 'RESOLVED' || job.disputeResolved;

              const roleColors: Record<string, { bg: string; text: string; border: string }> = {
                amber: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
                orange: { bg: 'rgba(249,115,22,0.12)', text: '#fb923c', border: 'rgba(249,115,22,0.3)' },
                blue: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
                emerald: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
                gray: { bg: 'rgba(107,114,128,0.12)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
              };
              const rc = roleColors[role.color] ?? roleColors.gray;

              return (
                <button
                  key={job.id}
                  onClick={() => setLocation(`/dispute/${job.id}`)}
                  className="w-full text-left rounded-2xl p-5 border transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: isResolved ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Job ID + Status */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-bold">
                          Job #{job.id.slice(0, 6).toUpperCase()}
                        </span>
                        {job.onchainJobId && (
                          <span className="text-white/40 text-xs">(On-chain #{job.onchainJobId})</span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-white/60 line-clamp-2 mb-3">{job.description}</p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap gap-2">
                        {/* Role Badge */}
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}` }}
                        >
                          {role.label === 'Voter' && '🗳️ '}
                          {role.label === 'Initiator' && '⚡ '}
                          {role.label === 'Client' && '👔 '}
                          {role.label === 'Worker' && '🔧 '}
                          {role.label}
                        </span>

                        {/* Status badge */}
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                          style={{
                            background: isResolved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: isResolved ? '#34d399' : '#f87171',
                            border: `1px solid ${isResolved ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          }}
                        >
                          {isResolved ? (
                            <><CheckCircle className="w-3 h-3" /> Resolved</>
                          ) : (
                            <><AlertTriangle className="w-3 h-3" /> Active</>
                          )}
                        </span>

                        {/* Resolved result */}
                        {isResolved && job.disputeWorkerWon !== undefined && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                            🏆 {job.disputeWorkerWon ? 'Worker thắng' : 'Client thắng'}
                          </span>
                        )}
                      </div>

                      {/* Time info */}
                      <div className="flex items-center gap-1 mt-3 text-white/30 text-xs">
                        <Clock className="w-3 h-3" />
                        <span>Cập nhật: {formatDateTime(job.updatedAt)}</span>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-white/30 flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
