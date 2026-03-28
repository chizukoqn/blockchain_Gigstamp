/**
 * Notification Page
 * Hiển thị tất cả thông báo liên quan đến user hiện tại
 * Các loại: job status, dispute raised, selected as voter, dispute resolved
 */

import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { translations } from '@/lib/translations';
import { formatDateTime } from '@/lib/status';
import {
  Bell, CheckCheck, AlertTriangle, Scale, Shield, Briefcase,
  ArrowLeft, Dot
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotificationPage() {
  const [, setLocation] = useLocation();
  const {
    currentUser,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    language,
  } = useApp();
  const t = translations[language];

  if (!currentUser) return null;

  const userNotifs = notifications
    .filter((n) => n.targetAddress.toLowerCase() === currentUser.address.toLowerCase())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const getNotifStyle = (type: string) => {
    switch (type) {
      case 'dispute_raised_against_you':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          iconBg: 'rgba(239,68,68,0.15)',
          iconColor: '#f87171',
          border: 'rgba(239,68,68,0.2)',
        };
      case 'selected_as_voter':
        return {
          icon: <Shield className="w-5 h-5" />,
          iconBg: 'rgba(245,158,11,0.15)',
          iconColor: '#fbbf24',
          border: 'rgba(245,158,11,0.2)',
        };
      case 'dispute_resolved':
        return {
          icon: <Scale className="w-5 h-5" />,
          iconBg: 'rgba(139,92,246,0.15)',
          iconColor: '#a78bfa',
          border: 'rgba(139,92,246,0.2)',
        };
      case 'job_status_changed':
      default:
        return {
          icon: <Briefcase className="w-5 h-5" />,
          iconBg: 'rgba(59,130,246,0.15)',
          iconColor: '#60a5fa',
          border: 'rgba(59,130,246,0.2)',
        };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'dispute_raised_against_you': return t.notif_type_dispute;
      case 'selected_as_voter': return t.notif_type_voter;
      case 'dispute_resolved': return t.notif_type_resolved;
      case 'job_status_changed': return t.notif_type_job;
      default: return t.notif_type_general;
    }
  };

  const handleClick = (notif: any) => {
    markNotificationRead(notif.id);
    if (notif.jobId) {
      // Nếu là dispute notification → tới dispute page
      if (
        notif.type === 'dispute_raised_against_you' ||
        notif.type === 'selected_as_voter' ||
        notif.type === 'dispute_resolved'
      ) {
        setLocation(`/dispute/${notif.jobId}`);
      } else {
        // Job status notification → tới job detail theo role
        const role = currentUser.role;
        setLocation(
          role === 'client'
            ? `/client/job/${notif.jobId}`
            : `/worker/job/${notif.jobId}`
        );
      }
    }
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl border-b border-white/10" style={{ background: 'rgba(15,12,41,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-7 h-7 text-violet-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">{t.notif_title}</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-violet-300">
                    {unreadCount} {t.notif_unread}
                  </p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllNotificationsRead}
                className="text-white/60 hover:text-white hover:bg-white/10 flex items-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                <span className="text-xs">{t.notif_mark_all_read}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {userNotifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Bell className="w-16 h-16 text-white/15 mb-4" />
            <h2 className="text-xl font-semibold text-white/40 mb-2">{t.notif_no_notifs}</h2>
            <p className="text-white/25 text-sm max-w-xs">
              {t.notif_empty_desc}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {userNotifs.map((notif) => {
              const style = getNotifStyle(notif.type);
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className="w-full text-left rounded-2xl p-4 border transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: notif.read ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                    borderColor: notif.read ? 'rgba(255,255,255,0.08)' : style.border,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: style.iconBg, color: style.iconColor }}
                    >
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-white/50">
                          {getTypeLabel(notif.type)}
                        </span>
                        {!notif.read && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: style.iconColor }}
                          />
                        )}
                      </div>
                      <p className="text-sm text-white/85 leading-relaxed mb-2">
                        {notif.message}
                      </p>
                      <p className="text-xs text-white/30">
                        {formatDateTime(notif.timestamp)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notif.read && (
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2"
                        style={{ background: style.iconColor }}
                      />
                    )}
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
