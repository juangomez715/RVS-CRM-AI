"use client";
import Link from 'next/link';
import { LayoutDashboard, Users, UserCog, Settings, LogOut, MessageSquareText, Send, Zap, Shield, KeyRound, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We fetch the authenticated role from the server-side API
    // because HttpOnly cookies block client read access
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setRole(data.role);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col h-screen w-64 bg-rvs-darker/90 backdrop-blur-xl text-rvs-chrome border-r border-rvs-steel/20 z-50">
      <div className="p-6 flex flex-col items-center border-b border-rvs-steel/20">
        <div className="relative w-48 h-12 mb-2 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="RVS CRM Logo"
            className="max-w-full max-h-full object-contain brightness-0 saturate-100"
            style={{ filter: 'brightness(0) saturate(100%) invert(20%) sepia(87%) saturate(5838%) hue-rotate(352deg) brightness(84%) contrast(100%) drop-shadow(0 4px 6px rgba(211,19,19,0.5))' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-rvs-steel mt-1 uppercase tracking-widest font-bold">Admin Portal</p>
          {loading && <Loader2 size={10} className="animate-spin text-rvs-red-light mt-1" />}
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-6 overflow-y-auto custom-scrollbar">
        <Link href="/dashboard" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
          <LayoutDashboard size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Dashboard</span>
        </Link>
        <Link href="/inbox" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
          <MessageSquareText size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Multichannel Inbox</span>
        </Link>
        <Link href="/sent" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
          <Send size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Sent Box</span>
        </Link>
        <Link href="/sequences" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
          <Zap size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Sequences</span>
        </Link>
        <Link href="/leads" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
          <Users size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Leads Directory</span>
        </Link>

        {role === 'ADMIN' && (
          <div className="pt-6 pb-2">
            <p className="px-3 text-[10px] font-black tracking-widest uppercase text-rvs-steel/50 mb-2">Admin Tools</p>
            <Link href="/agents" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
              <UserCog size={20} className="text-emerald-500/80 group-hover:text-emerald-400 transition-colors" />
              <span className="font-semibold tracking-wide text-sm text-emerald-100/90 group-hover:text-emerald-50">AI Tuning Studio</span>
            </Link>
            <Link href="/team" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
              <KeyRound size={20} className="text-blue-500/80 group-hover:text-blue-400 transition-colors" />
              <span className="font-semibold tracking-wide text-sm text-blue-100/90 group-hover:text-blue-50">Team & Access</span>
            </Link>
            <Link href="/security" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all">
              <Shield size={20} className="text-orange-500/80 group-hover:text-orange-400 transition-colors" />
              <span className="font-semibold tracking-wide text-sm text-orange-100/90 group-hover:text-orange-50">Security Audit Logs</span>
            </Link>
          </div>
        )}

        <Link href="/settings" className="group flex items-center gap-3 px-3 py-3 rounded-md hover:bg-rvs-red-dark/30 hover:text-white transition-all border-t border-rvs-steel/10 mt-2">
          <Settings size={20} className="text-rvs-steel group-hover:text-rvs-red-light transition-colors" />
          <span className="font-semibold tracking-wide text-sm">Integrations Hub</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-rvs-steel/20 bg-rvs-dark">
        <button onClick={handleLogout} className="flex items-center justify-center gap-3 px-3 py-3 w-full rounded-md hover:bg-rvs-red hover:text-white transition-all font-bold text-sm tracking-wider uppercase text-rvs-steel">
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
