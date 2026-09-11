import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  GitFork,
  Users,
  Send,
  FileCode2,
  Cpu,
  LogOut,
  Crown,
  Settings,
  UserCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OmniReachLogo } from '../Brand/OmniReachLogo';
import { ThemeToggle } from '../Theme/ThemeToggle';

export const Sidebar: React.FC = () => {
  const { user, isSuperadmin, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      color: 'text-blue-400',
    },
    {
      label: 'WhatsApp Live Inbox',
      path: '/inbox',
      icon: MessageSquare,
      color: 'text-emerald-400',
    },
    {
      label: 'Journeys Builder',
      path: '/journeys',
      icon: GitFork,
      color: 'text-cyan-400',
    },
    {
      label: 'Master Data Center',
      path: '/leads',
      icon: Users,
      color: 'text-purple-400',
    },
    {
      label: 'Broadcasts Manager',
      path: '/broadcasts',
      icon: Send,
      color: 'text-emerald-400',
    },
    {
      label: 'Templates Studio',
      path: '/templates',
      icon: FileCode2,
      color: 'text-amber-400',
    },
  ];

  // Superadmin Exclusive Direct Sidebar Modules
  if (isSuperadmin) {
    navItems.push({
      label: 'User Management',
      path: '/users',
      icon: UserCheck,
      color: 'text-violet-400',
    });
  }

  // Unified Settings for All (Superadmin sees global vault, Company Admin sees allocated company gateway)
  navItems.push({
    label: isSuperadmin ? 'Superadmin & API Vault' : 'Workspace & API Keys',
    path: '/settings',
    icon: Settings,
    color: 'text-cyan-400',
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-[#080d1a] border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-full select-none z-30 shadow-sm dark:shadow-2xl overflow-hidden transition-colors duration-200">
      {/* Brand Header with Vector Logo */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between shrink-0">
        <NavLink to="/dashboard" className="flex items-center">
          <OmniReachLogo size="md" subtitle="Broadcast Center" />
        </NavLink>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto min-h-0">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          {isSuperadmin ? 'Superadmin Console' : `${user?.company_name || 'Company'} Workspace`}
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-sm dark:shadow-blue-500/10 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#0f172a] border border-transparent'
                }`
              }
            >
              <Icon size={18} className={`shrink-0 transition-colors ${item.color}`} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* User / Superadmin / Company Status Bar & Theme Switcher */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#050811] space-y-2.5 shrink-0 transition-colors duration-200">
        {/* Appearance Mode Switcher */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Appearance</span>
          <ThemeToggle variant="pill" showLabel />
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors duration-200">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 font-bold shadow-md">
              {isSuperadmin ? <Crown size={15} className="text-amber-300" /> : user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1">
                {user?.full_name || 'Admin'}
                {isSuperadmin ? (
                  <span className="text-[8px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 px-1 rounded">
                    SUPERADMIN
                  </span>
                ) : (
                  <span className="text-[8px] font-black bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40 px-1 rounded">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <Building2 size={10} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="truncate text-cyan-700 dark:text-cyan-300 font-semibold">
                  {user?.company_name || (isSuperadmin ? 'OmniReach Global' : 'Assigned Company')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};
