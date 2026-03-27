/**
 * BottomNav Component
 * Mobile-friendly bottom navigation bar
 * Design: Modern Minimalism - Clean navigation with icons
 */

import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { Home, Plus, User, LogOut, Scale, Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

const PUBLIC_ROUTES = ['/', '/login', '/register', '/demo'];

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { currentUser, logout, getUnreadCount } = useApp();

  // Never show on public / auth pages
  if (!currentUser || PUBLIC_ROUTES.includes(location)) {
    return null;
  }

  const isClient = currentUser.role === 'client';
  const unreadCount = getUnreadCount(currentUser.address);

  const navItems: NavItem[] = isClient
    ? [
        { label: 'Home', icon: <Home className="w-5 h-5" />, path: '/client/dashboard' },
        { label: 'Create', icon: <Plus className="w-5 h-5" />, path: '/client/create-job' },
        { label: 'Disputes', icon: <Scale className="w-5 h-5" />, path: '/disputes' },
        { label: 'Notifs', icon: <Bell className="w-5 h-5" />, path: '/notifications', badge: unreadCount },
        { label: 'Profile', icon: <User className="w-5 h-5" />, path: '/client/profile' },
      ]
    : [
        { label: 'Home', icon: <Home className="w-5 h-5" />, path: '/worker/dashboard' },
        { label: 'Browse', icon: <Search className="w-5 h-5" />, path: '/worker/browse-jobs' },
        { label: 'Disputes', icon: <Scale className="w-5 h-5" />, path: '/disputes' },
        { label: 'Notifs', icon: <Bell className="w-5 h-5" />, path: '/notifications', badge: unreadCount },
        { label: 'Profile', icon: <User className="w-5 h-5" />, path: '/worker/profile' },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:hidden z-50">
      <div className="flex items-center justify-between px-2 py-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={`relative flex flex-col items-center gap-1 flex-1 py-1 rounded-xl transition-all duration-200 ${
              location === item.path
                ? 'text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`p-1 duration-200 ${location === item.path ? 'scale-110' : ''}`}>
              {item.icon}
            </div>
            <span className={`text-[10px] font-bold tracking-tight ${location === item.path ? 'opacity-100' : 'opacity-70'}`}>
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-3 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white border-2 border-white">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
            {location === item.path && (
               <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
