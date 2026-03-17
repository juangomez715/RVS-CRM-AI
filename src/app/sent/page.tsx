"use client";
import { useState, useEffect } from 'react';
import { Mail, CheckCheck, Check, MousePointerClick, Reply, AlertTriangle, ShieldX, Loader2 } from 'lucide-react';

type SentMessage = {
    id: string;
    leadName: string;
    to: string;
    subject: string;
    content: string;
    sentAt: string;
    readAt: string | null;
    clickedAt: string | null;
    repliedAt: string | null;
    bouncedAt: string | null;
    spamAt: string | null;
    sender: string;
};

type Stats = {
    total: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
    spamRate: number;
};

export default function SentBoxPage() {
    const [messages, setMessages] = useState<SentMessage[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, openRate: 0, clickRate: 0, replyRate: 0, bounceRate: 0, spamRate: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/sent');
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages);
                    setStats(data.stats);
                }
            } catch (e) {
                console.error('Failed to load sent messages');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Never';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        }).format(new Date(dateString));
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-[#0A0A0A]">
                <Loader2 className="animate-spin text-rvs-red" size={48} />
            </div>
        );
    }

    return (
        <div className="p-8 h-full bg-[#0A0A0A] overflow-y-auto">
            <div className="flex justify-between items-end mb-8 border-b border-rvs-steel/20 pb-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase items-center flex gap-3">
                        <Mail className="text-rvs-red-light" size={32} /> OUTBOX
                    </h1>
                    <p className="text-rvs-steel text-sm font-bold uppercase tracking-widest mt-2">
                        Email Tracking & Delivery Stats — {stats.total} sent
                    </p>
                </div>

                <div className="flex gap-4 flex-wrap justify-end">
                    <div className="bg-rvs-darker border border-rvs-steel/20 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
                            <CheckCheck className="text-blue-400" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Open Rate</p>
                            <p className="text-white font-black">{stats.openRate}%</p>
                        </div>
                    </div>

                    <div className="bg-rvs-darker border border-rvs-steel/20 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-rvs-red-dark/20 flex items-center justify-center">
                            <MousePointerClick className="text-rvs-red-light" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Click Rate</p>
                            <p className="text-white font-black">{stats.clickRate}%</p>
                        </div>
                    </div>

                    <div className="bg-rvs-darker border border-rvs-steel/20 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
                            <Reply className="text-emerald-400" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Reply Rate</p>
                            <p className="text-white font-black">{stats.replyRate}%</p>
                        </div>
                    </div>

                    <div className="bg-rvs-darker border border-rvs-steel/20 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center">
                            <AlertTriangle className="text-orange-400" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Bounce Rate</p>
                            <p className="text-white font-black">{stats.bounceRate}%</p>
                        </div>
                    </div>

                    <div className="bg-rvs-darker border border-rvs-steel/20 p-3 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-rose-500/10 flex items-center justify-center">
                            <ShieldX className="text-rose-500" size={16} />
                        </div>
                        <div>
                            <p className="text-[10px] text-rvs-steel uppercase font-bold tracking-widest">Spam Block</p>
                            <p className="text-white font-black">{stats.spamRate}%</p>
                        </div>
                    </div>
                </div>
            </div>

            {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-40">
                    <Mail size={48} className="text-rvs-steel mb-4" />
                    <p className="text-white font-black uppercase tracking-widest text-sm">No sent messages yet</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className="bg-rvs-dark border border-rvs-steel/20 rounded-xl p-5 hover:border-rvs-steel/50 transition-all flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${msg.sender === 'HUMAN' ? 'bg-rvs-steel/20 text-rvs-chrome' : 'bg-rvs-red-dark/30 text-rvs-red-light'}`}>
                                        Sent by {msg.sender === 'AI_AUTOMATION' ? 'AUTOMATION' : msg.sender}
                                    </span>
                                    <p className="text-sm font-bold text-white tracking-wide">{msg.to}</p>
                                </div>
                                <h3 className="text-lg font-black text-white mb-1">{msg.subject}</h3>
                                <p className="text-sm text-rvs-chrome truncate">{msg.content}</p>
                            </div>

                            <div className="md:w-64 flex flex-col justify-center space-y-3 bg-[#0A0A0A] border-l md:border-l border-t md:border-t-0 border-rvs-steel/10 pt-4 md:pt-0 md:pl-6">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-rvs-steel flex items-center gap-2"><Check size={14} /> Sent</span>
                                    <span className="text-white font-mono">{formatDate(msg.sentAt)}</span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2 text-rvs-steel">
                                        <CheckCheck size={14} className={msg.readAt ? 'text-blue-400' : 'text-rvs-steel/30'} />
                                        Opened
                                    </span>
                                    <span className={`font-mono ${msg.readAt ? 'text-blue-400 font-bold' : 'text-rvs-steel/50'}`}>
                                        {formatDate(msg.readAt)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2 text-rvs-steel">
                                        <MousePointerClick size={14} className={msg.clickedAt ? 'text-rvs-red-light' : 'text-rvs-steel/30'} />
                                        Clicked
                                    </span>
                                    <span className={`font-mono ${msg.clickedAt ? 'text-rvs-red-light font-bold' : 'text-rvs-steel/50'}`}>
                                        {formatDate(msg.clickedAt)}
                                    </span>
                                </div>

                                {msg.repliedAt && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-rvs-steel">
                                            <Reply size={14} className="text-emerald-400" /> Replied
                                        </span>
                                        <span className="font-mono text-emerald-400 font-bold">{formatDate(msg.repliedAt)}</span>
                                    </div>
                                )}

                                {msg.bouncedAt && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-rvs-steel">
                                            <AlertTriangle size={14} className="text-orange-400" /> Bounced
                                        </span>
                                        <span className="font-mono text-orange-400 font-bold">{formatDate(msg.bouncedAt)}</span>
                                    </div>
                                )}

                                {msg.spamAt && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="flex items-center gap-2 text-rvs-steel">
                                            <ShieldX size={14} className="text-rose-500" /> Spam Block
                                        </span>
                                        <span className="font-mono text-rose-500 font-bold">{formatDate(msg.spamAt)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
