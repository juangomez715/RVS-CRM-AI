"use client";

import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Lock, Key, Activity, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

type AuditLog = {
    id: string;
    action: string;
    userEmail: string | null;
    ip: string | null;
    details: string | null;
    createdAt: string;
};

export default function SecurityPage() {
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/audit-logs?limit=50');
                if (res.ok) {
                    const data = await res.json();
                    setAuditLogs(data.logs);
                    setTotal(data.total);
                }
            } catch (e) {
                console.error('Failed to load audit logs');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const securityLayers = [
        { name: 'JWT Signed Sessions', status: 'active', icon: Key, description: 'Cryptographic token prevents cookie tampering' },
        { name: 'Brute Force Shield', status: 'active', icon: ShieldAlert, description: 'Max 5 login attempts per IP / 15 min window' },
        { name: 'OWASP Headers', status: 'active', icon: Lock, description: 'XSS, Clickjack, HSTS, CSP protections enabled' },
        { name: 'API Authentication', status: 'active', icon: ShieldCheck, description: 'All API endpoints require valid JWT' },
        { name: 'Audit Trail', status: 'active', icon: Activity, description: 'Every login, action, and failure is logged' },
    ];

    const formatTime = (dateStr: string) => {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit'
        }).format(new Date(dateStr));
    };

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'LOGIN_SUCCESS':
                return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 size={12} />, label: 'Login OK' };
            case 'LOGIN_FAILED':
                return { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: <XCircle size={12} />, label: 'Failed Login' };
            case 'RATE_LIMITED':
                return { color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', icon: <ShieldAlert size={12} />, label: 'Rate Limited' };
            case 'LOGOUT':
                return { color: 'text-rvs-steel bg-rvs-steel/10 border-rvs-steel/20', icon: <Lock size={12} />, label: 'Logout' };
            case 'LEAD_CREATED': case 'LEAD_UPDATED': case 'LEAD_DELETED':
                return { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: <Activity size={12} />, label: action.replace('_', ' ') };
            case 'SEQUENCE_CREATED': case 'SEQUENCE_UPDATED': case 'SEQUENCE_DELETED':
                return { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: <Activity size={12} />, label: action.replace('_', ' ') };
            case 'EMAIL_SENT':
                return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: <CheckCircle2 size={12} />, label: 'Email Sent' };
            case 'EMAIL_BOUNCED':
                return { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: <AlertTriangle size={12} />, label: 'Bounced' };
            case 'EMAIL_SPAM':
                return { color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', icon: <ShieldAlert size={12} />, label: 'Spam' };
            case 'INTEGRATION_SAVED':
                return { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: <Key size={12} />, label: 'Integration' };
            case 'WEBHOOK_N8N': case 'WEBHOOK_INCOMING':
                return { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', icon: <Activity size={12} />, label: 'Webhook' };
            default:
                return { color: 'text-rvs-steel bg-rvs-steel/10 border-rvs-steel/20', icon: <Activity size={12} />, label: action.replace(/_/g, ' ') };
        }
    };

    const failedCount = auditLogs.filter(l => l.action === 'LOGIN_FAILED' || l.action === 'RATE_LIMITED').length;

    return (
        <div className="p-8 h-full bg-[#0A0A0A] overflow-y-auto">
            <div className="flex justify-between items-end mb-8 border-b border-rvs-steel/20 pb-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
                        <Shield className="text-rvs-red-light" size={32} /> Security Center
                    </h1>
                    <p className="text-rvs-steel text-sm font-bold uppercase tracking-widest mt-2">
                        Cybersecurity Layers & Audit Trail
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
                        <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Protection</p>
                        <p className="text-emerald-400 font-black text-lg">5 / 5</p>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg">
                        <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Threats Blocked</p>
                        <p className="text-rose-400 font-black text-lg">{failedCount}</p>
                    </div>
                    <div className="bg-rvs-steel/10 border border-rvs-steel/20 px-4 py-2 rounded-lg">
                        <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Total Events</p>
                        <p className="text-white font-black text-lg">{total}</p>
                    </div>
                </div>
            </div>

            {/* Security Layers Status */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-8">
                {securityLayers.map((layer, idx) => (
                    <div key={idx} className="bg-rvs-darker border border-emerald-500/20 rounded-lg p-4 text-center group hover:border-emerald-500/50 transition-all">
                        <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <layer.icon className="text-emerald-400" size={18} />
                            </div>
                        </div>
                        <p className="text-white font-black text-xs tracking-widest uppercase mb-1">{layer.name}</p>
                        <p className="text-[10px] text-rvs-steel">{layer.description}</p>
                        <div className="mt-2">
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest border border-emerald-500/30 px-2 py-0.5 rounded-full">Active</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Audit Log Table */}
            <div className="bg-rvs-darker border border-rvs-steel/20 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-rvs-steel/10 flex justify-between items-center">
                    <h2 className="text-white font-black tracking-widest uppercase text-sm flex items-center gap-2">
                        <Activity size={16} className="text-rvs-red-light" /> Live Audit Trail
                    </h2>
                    <span className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">
                        {isLoading ? 'Loading...' : `${auditLogs.length} of ${total} events`}
                    </span>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-16">
                        <Loader2 className="animate-spin text-rvs-red" size={32} />
                    </div>
                ) : auditLogs.length === 0 ? (
                    <div className="py-16 text-center opacity-40">
                        <p className="text-xs text-white uppercase font-black tracking-widest">No audit events recorded yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-rvs-steel/5">
                        {auditLogs.map(log => {
                            const badge = getActionBadge(log.action);
                            return (
                                <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-rvs-dark/30 transition-all">
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${badge.color}`}>
                                        {badge.icon} {badge.label}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">{log.details || '—'}</p>
                                    </div>
                                    <div className="text-xs text-rvs-chrome/60 font-mono whitespace-nowrap">
                                        {log.userEmail || '—'}
                                    </div>
                                    <div className="text-xs text-rvs-steel font-mono whitespace-nowrap">
                                        {log.ip || '—'}
                                    </div>
                                    <div className="text-xs text-rvs-steel/50 font-mono whitespace-nowrap flex items-center gap-1">
                                        <Clock size={10} /> {formatTime(log.createdAt)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
