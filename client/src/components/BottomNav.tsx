/**
 * BottomNav Component
 * Mobile-friendly bottom navigation bar
 * Design: Modern Minimalism - Clean navigation with icons
 */

import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { Home, Plus, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

export function BottomNav() {
  const [location, setLocation] = useLocation();
  const { currentUser, logout } = useApp();

  if (!currentUser) {
    return null;
  }

  const isClient = currentUser.role === 'client';

  const navItems: NavItem[] = isClient
    ? [
        { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/client/dashboard' },
        { label: 'Create Job', icon: <Plus className="w-5 h-5" />, path: '/client/create-job' },
        { label: 'Profile', icon: <User className="w-5 h-5" />, path: '/client/profile' },
      ]
    : [
        { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: '/worker/dashboard' },
        { label: 'Browse Jobs', icon: <Plus className="w-5 h-5" />, path: '/worker/browse-jobs' },
        { label: 'Profile', icon: <User className="w-5 h-5" />, path: '/worker/profile' },
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              location === item.path
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}

        {/* Logout Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            setLocation('/');
          }}
          className="flex flex-col items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-50"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs font-medium">Logout</span>
        </Button>
      </div>
    </div>
  );
}
