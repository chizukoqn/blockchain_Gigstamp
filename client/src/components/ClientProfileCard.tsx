import { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { translations } from '@/lib/translations';
import { getContract } from '@/lib/blockchain';
import { Shield, Briefcase, Award, Clock, User, CheckCircle } from 'lucide-react';

interface ClientProfileCardProps {
  clientAddress: string;
}

const BADGE_NAMES: Record<number, string> = {
  0: 'Abandoned Job',
  1: 'Bad Rating',
  2: 'Lost Dispute',
  3: 'Voted Wrong',
  4: 'Rage Quit',
  5: 'Ignored Submission',
  6: 'Changed Terms',
  7: 'Lost Dispute (Client)',
  8: 'Serial Canceller',
  9: 'Scam Label',
  10: 'Consistently high-rated worker',
  11: 'Reliable Client',
  12: 'Trusted Voter',
};

export function ClientProfileCard({ clientAddress }: ClientProfileCardProps) {
  const { getJobsByClient, language } = useApp();
  const t = translations[language];
  const [reputation, setReputation] = useState<number | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Client stats from local context
  const clientJobs = getJobsByClient(clientAddress);
  const completedJobs = clientJobs.filter(j => j.status === 'completed' || j.status === 'RESOLVED').length;

  useEffect(() => {
    let mounted = true;
    const fetchOnchainData = async () => {
      try {
        const contract = await getContract();
        if (!contract || !mounted) return;

        // Fetch reputation
        const score = await contract.reputationScore(clientAddress);
        if (mounted) setReputation(Number(score));

        // Fetch badges
        const badgeData = await contract.getBadges(clientAddress);
        const [types, , timestamps] = badgeData;
        const bList = (types || []).map((type: any, i: number) => ({
          type: Number(type),
          timestamp: Number(timestamps[i]),
        }));
        if (mounted) setBadges(bList.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 2));

        // Fetch reputation history
        const filter = contract.filters.ScoreChanged(clientAddress);
        const events = await contract.queryFilter(filter, -5000);
        const history = await Promise.all(events.map(async (e: any) => {
          const block = await e.getBlock();
          return {
            oldScore: Number(e.args[1]),
            newScore: Number(e.args[2]),
            delta: Number(e.args[2]) - Number(e.args[1]),
            reason: e.args[3],
            timestamp: block.timestamp,
          };
        }));
        if (mounted) setScoreHistory(history.reverse());
      } catch (err) {
        console.error('Failed to fetch client profile data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchOnchainData();
    return () => { mounted = false; };
  }, [clientAddress]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm animate-pulse">
        <div className="h-6 w-32 bg-gray-100 rounded mb-4" />
        <div className="h-4 w-full bg-gray-100 rounded mb-2" />
      </div>
    );
  }

  const reputationColor = reputation && reputation >= 100 ? 'text-emerald-600' : reputation && reputation >= 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-cyan-100 border border-cyan-200 flex items-center justify-center">
            <User className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-gray-900 font-bold text-lg">{t.profile_client_profile}</h3>
            <p className="text-gray-500 font-mono text-xs">{clientAddress.slice(0, 6)}...{clientAddress.slice(-4)}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${reputationColor}`}>
            {reputation ?? '--'}
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.profile_reputation}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-bold text-gray-900">{clientJobs.length}</span>
          </div>
          <p className="text-[10px] text-gray-500 uppercase font-bold">{t.profile_total_jobs}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-gray-900">{completedJobs}</span>
          </div>
          <p className="text-[10px] text-gray-500 uppercase font-bold">{t.profile_jobs_completed}</p>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
             <Shield className="w-3 h-3" /> {t.profile_latest_badges}
          </h4>
          <div className="flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 text-[10px] font-bold border border-cyan-100">
                {BADGE_NAMES[b.type] || `Badge ${b.type}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reputation History */}
      <div className="mb-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
          <Clock className="w-3 h-3" /> {t.profile_reputation_history}
        </h4>
        <div className="space-y-2">
          {scoreHistory.length > 0 ? (
            scoreHistory.slice(0, showFullHistory ? 10 : 3).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex-1 mr-2">
                  <p className="text-gray-900 font-medium truncate">{item.reason}</p>
                  <p className="text-[10px] text-gray-400">{new Date(item.timestamp * 1000).toLocaleDateString()}</p>
                </div>
                <span className={`font-bold ${item.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {item.delta > 0 ? `+${item.delta}` : item.delta}
                </span>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-gray-400 italic px-1">{t.profile_no_history}</p>
          )}
          {scoreHistory.length > 3 && (
            <button 
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 w-full text-center py-1 mt-1"
            >
              {showFullHistory ? t.profile_show_less : `${t.profile_show_more} (${scoreHistory.length - 3})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
