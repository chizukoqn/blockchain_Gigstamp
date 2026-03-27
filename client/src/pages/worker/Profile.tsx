/**
 * Worker Profile Page
 * Shows worker profile, rating, and account details
 * Design: Modern Minimalism - Clean profile display with stats
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { BottomNav } from '@/components/BottomNav';
import { User, LogOut, Copy, Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatRating } from '@/lib/status';
import { getContract } from '@/lib/blockchain';

type ScoreHistoryItem = {
  delta: number;
  reason: string;
  timestamp: number;
};

type BadgeItem = {
  type: number;
  jobId: string;
  timestamp: number;
  note: string;
};

export default function WorkerProfile() {
  const [, setLocation] = useLocation();
  const { currentUser, logout, getWorkerStats, getWorkerJobs } = useApp();
  const [copied, setCopied] = useState(false);
  const [reputation, setReputation] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryItem[]>([]);
  const [badges, setBadges] = useState<BadgeItem[]>([]);

  if (!currentUser) {
    return null;
  }

  const stats = getWorkerStats(currentUser.id);
  const jobs = getWorkerJobs(currentUser.id);
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentUser.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  useEffect(() => {
    let mounted = true;
    const loadOnchainProfile = async () => {
      try {
        const contract = await getContract();
        if (!contract || !mounted) return;

        const score = Number(await contract.reputationScore(currentUser.address));
        const badgeData = await contract.getBadges(currentUser.address);
        const scoreLogs = await contract.queryFilter(
          contract.filters.ScoreChanged(currentUser.address)
        );

        const scoreItems: ScoreHistoryItem[] = [];
        for (const log of scoreLogs) {
          const oldScore = Number(log.args?.oldScore ?? 0);
          const newScore = Number(log.args?.newScore ?? 0);
          const delta = newScore - oldScore;
          const reason = String(log.args?.reason ?? '');
          const block = await log.getBlock();
          scoreItems.push({
            delta,
            reason,
            timestamp: Number(block?.timestamp ?? 0),
          });
        }

        const badgeItems: BadgeItem[] = (badgeData[0] || []).map((type: bigint, idx: number) => ({
          type: Number(type),
          jobId: String((badgeData[1] || [])[idx] ?? ''),
          timestamp: Number((badgeData[2] || [])[idx] ?? 0),
          note: String((badgeData[3] || [])[idx] ?? ''),
        }));

        if (!mounted) return;
        setReputation(score);
        setScoreHistory(scoreItems.reverse());
        setBadges(badgeItems.reverse());
      } catch (err) {
        console.error('Failed to load on-chain profile:', err);
      }
    };

    loadOnchainProfile();
    return () => {
      mounted = false;
    };
  }, [currentUser.address]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6 max-w-2xl">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Worker</h2>
              <p className="text-sm text-gray-600">Account ID: {currentUser.id}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div>
              <p className="text-sm text-gray-600 mb-1">Jobs Completed</p>
              <p className="text-2xl font-bold text-gray-900">{completedJobs}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Jobs Applied</p>
              <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Reputation Score</p>
              <p className="text-2xl font-bold text-gray-900">{reputation ?? '—'}</p>
            </div>
          </div>

          {/* Rating */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <p className="text-sm text-gray-600">Average Rating</p>
            </div>
            {stats.ratingCount > 0 ? (
              <>
                <p className="text-3xl font-bold text-gray-900">
                  {formatRating(stats.averageRating)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on {stats.ratingCount} review{stats.ratingCount !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <p className="text-lg text-gray-600">No rating yet</p>
            )}
          </div>

          {/* Address */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Wallet Address</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <code className="text-sm font-mono text-gray-900 flex-1 break-all">
                {currentUser.address}
              </code>
              <button
                onClick={handleCopyAddress}
                className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Badges</h3>
          {badges.length === 0 ? (
            <p className="text-sm text-gray-600">No badges yet.</p>
          ) : (
            <div className="space-y-2">
              {badges.map((badge, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">{badge.note}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Type #{badge.type} · Job #{badge.jobId} · {new Date(badge.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reputation History */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Reputation History</h3>
          {scoreHistory.length === 0 ? (
            <p className="text-sm text-gray-600">No score changes yet.</p>
          ) : (
            <div className="space-y-2">
              {scoreHistory.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.reason}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(item.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${item.delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {item.delta >= 0 ? '+' : ''}
                    {item.delta}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}
