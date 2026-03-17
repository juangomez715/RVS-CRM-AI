"use client";
import { useState, useEffect, useRef } from 'react';
import { Mail, Linkedin, PauseCircle, PlayCircle, Send, Bot, Sparkles, Loader2, User, RefreshCw, CloudDownload } from 'lucide-react';

type Interaction = {
    id: string;
    channel: string;
    sender: 'AI' | 'LEAD' | 'HUMAN' | 'AI_AUTOMATION' | 'System_Draft';
    content: string;
    createdAt: string;
};

type LeadConversation = {
    id: string;
    name: string;
    company: string;
    email: string | null;
    aiStatus: 'ACTIVE' | 'PAUSED';
    interactions: Interaction[];
};

export default function InboxPage() {
    const [leads, setLeads] = useState<LeadConversation[]>([]);
    const [selectedLead, setSelectedLead] = useState<LeadConversation | null>(null);
    const [draft, setDraft] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        loadInbox();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [selectedLead?.interactions]);

    const loadInbox = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/inbox');
            if (res.ok) {
                const data = await res.json();
                setLeads(data);
                // Keep the same lead selected if it exists after reload
                if (selectedLead) {
                    const updated = data.find((l: any) => l.id === selectedLead.id);
                    if (updated) setSelectedLead(updated);
                } else if (data.length > 0) {
                    setSelectedLead(data[0]);
                }
            }
        } catch (e) {
            console.error("Failed to fetch inbox data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSyncGmail = async () => {
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const res = await fetch('/api/inbox/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncMessage(data.message);
                if (data.synced > 0) await loadInbox();
            } else {
                setSyncMessage(data.error || 'Sync failed.');
            }
        } catch {
            setSyncMessage('Network error during sync.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncMessage(''), 4000);
        }
    };

    const handleSelect = (lead: LeadConversation) => {
        setSelectedLead(lead);
        setDraft('');
    };

    const generateDraft = async () => {
        if (!selectedLead || selectedLead.interactions.length === 0) return;
        setIsDrafting(true);

        const context = selectedLead.interactions
            .filter(i => i.sender !== 'System_Draft')
            .map(m => `${m.sender}: ${m.content}`).join('\n');

        try {
            const res = await fetch('/api/ai/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context, leadName: selectedLead.name })
            });
            const data = await res.json();
            if (res.ok) {
                setDraft(data.draft.trim());
            }
        } catch (e) {
            setDraft("Error generating draft.");
        } finally {
            setIsDrafting(false);
        }
    };

    const handleSend = async () => {
        if (!selectedLead || !draft || isSending) return;
        setIsSending(true);

        try {
            const res = await fetch('/api/inbox/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: selectedLead.id,
                    content: draft
                })
            });

            if (res.ok) {
                const newMsg = await res.json();
                // Update local state immediately
                const updatedLead = {
                    ...selectedLead,
                    interactions: [...selectedLead.interactions, newMsg]
                };
                setSelectedLead(updatedLead);
                setLeads(leads.map(l => l.id === selectedLead.id ? updatedLead : l));
                setDraft('');
            } else {
                const err = await res.json();
                alert(err.error || "Failed to send message.");
            }
        } catch (e) {
            alert("Network error while sending.");
        } finally {
            setIsSending(false);
        }
    };

    const toggleAIStatus = async () => {
        if (!selectedLead) return;
        const newStatus = selectedLead.aiStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        
        try {
            // Reusing Leads API or a dedicated status API
            const res = await fetch(`/api/leads/${selectedLead.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiStatus: newStatus })
            });

            if (res.ok) {
                const updated = { ...selectedLead, aiStatus: newStatus as 'ACTIVE' | 'PAUSED' };
                setSelectedLead(updated);
                setLeads(leads.map(l => l.id === selectedLead.id ? updated : l));
            }
        } catch (e) {
            console.error("Failed to toggle AI status");
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-[#0A0A0A]">
                <Loader2 className="animate-spin text-rvs-red" size={48} />
            </div>
        );
    }

    return (
        <div className="flex h-full pb-20 overflow-hidden bg-[#0A0A0A]">
            {/* Sidebar: Leads List */}
            <div className="w-1/3 border-r border-rvs-steel/20 bg-rvs-darker/50 flex flex-col h-full">
                <div className="p-6 border-b border-rvs-steel/20 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg">Inbox</h1>
                        <p className="text-rvs-steel text-[10px] font-bold uppercase tracking-widest">REAL-TIME TRAFFIC</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSyncGmail} disabled={isSyncing} title="Sync Gmail inbox" className="text-rvs-steel hover:text-blue-400 transition-colors disabled:opacity-50">
                            {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <CloudDownload size={18} />}
                        </button>
                        <button onClick={loadInbox} className="text-rvs-steel hover:text-white transition-colors">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                    {syncMessage && (
                        <div className="absolute top-20 left-4 right-4 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded z-50">
                            {syncMessage}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {leads.length === 0 && (
                        <div className="p-10 text-center opacity-40">
                            <p className="text-xs text-white uppercase font-black tracking-widest">No active conversations</p>
                        </div>
                    )}
                    {leads.map((lead) => {
                        const lastMsg = lead.interactions[lead.interactions.length - 1];
                        return (
                            <div
                                key={lead.id}
                                onClick={() => handleSelect(lead)}
                                className={`p-5 border-b border-rvs-steel/10 cursor-pointer transition-all relative ${selectedLead?.id === lead.id ? 'bg-rvs-red-dark/10 border-l-4 border-l-rvs-red' : 'hover:bg-white/5'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-black text-white text-sm uppercase tracking-wider">{lead.name}</span>
                                    <span className="text-rvs-steel text-xs">
                                        {lead.interactions[0]?.channel === 'LinkedIn' ? <Linkedin size={14} className="text-blue-500" /> : <Mail size={14} className="text-orange-500" />}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[11px] text-rvs-chrome/80 truncate w-3/4 font-mono italic">
                                        {lastMsg?.sender === 'LEAD' ? '← ' : '→ '}
                                        {lastMsg?.content.replace(/Subject:.*\n\n/, '').slice(0, 60)}...
                                    </p>
                                    {lead.aiStatus === 'ACTIVE' ? (
                                        <Bot size={14} className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                    ) : (
                                        <User size={14} className="text-white/40" />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main Chat Area */}
            {selectedLead ? (
                <div className="flex-1 flex flex-col relative">
                    {/* Header */}
                    <div className="h-24 border-b border-rvs-steel/20 flex items-center justify-between p-8 bg-rvs-darker shadow-xl z-20">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black text-white tracking-wider uppercase">{selectedLead.name}</h2>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${selectedLead.aiStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/50 border-white/10'}`}>
                                    {selectedLead.aiStatus === 'ACTIVE' ? 'ROUTED BY AI' : 'HUMAN CONTROL'}
                                </span>
                            </div>
                            <p className="text-[10px] text-rvs-steel font-black tracking-widest uppercase mt-1">{selectedLead.company} | {selectedLead.email}</p>
                        </div>

                        <button 
                            onClick={toggleAIStatus}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all shadow-lg ${selectedLead.aiStatus === 'ACTIVE' ? 'bg-red-600/10 text-red-500 border-red-500/40 hover:bg-red-600 hover:text-white' : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'}`}
                        >
                            {selectedLead.aiStatus === 'ACTIVE' ? (
                                <><PauseCircle size={14} /> Kill AI (Take Over)</>
                            ) : (
                                <><PlayCircle size={14} /> Resume AI Flow</>
                            )}
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-10 overflow-y-auto space-y-8 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-repeat">
                        {selectedLead.interactions.map((msg) => {
                            const isLead = msg.sender === 'LEAD';
                            const isAI = msg.sender === 'AI' || msg.sender === 'AI_AUTOMATION';
                            const isDraft = msg.sender === 'System_Draft';
                            
                            if (isDraft) return (
                                <div key={msg.id} className="flex justify-center my-6">
                                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 max-w-lg text-center backdrop-blur-sm">
                                        <p className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                                            <Sparkles size={12} /> AI Thought / Background Draft
                                        </p>
                                        <p className="text-xs text-purple-200/60 italic leading-relaxed">{msg.content.replace('[AUTO-DRAFTED BY ', '').replace(']', '')}</p>
                                    </div>
                                </div>
                            );

                            return (
                                <div key={msg.id} className={`flex ${isLead ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[70%] p-5 rounded-2xl shadow-2xl relative ${isLead
                                        ? 'bg-rvs-darker border border-rvs-steel/20 text-rvs-chrome rounded-tl-none'
                                        : isAI
                                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 rounded-tr-none border-l-[4px] border-l-emerald-500'
                                            : 'bg-white text-black font-medium rounded-tr-none'
                                        }`}>
                                        <div className={`flex items-center gap-2 mb-2 text-[9px] font-black uppercase tracking-widest ${isLead ? 'text-rvs-steel' : isAI ? 'text-emerald-400' : 'text-black/60'}`}>
                                            {isAI ? <Bot size={12} /> : isLead ? <User size={12} /> : <User size={12} />}
                                            {msg.sender.replace('_', ' ')} • {msg.createdAt}
                                        </div>
                                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isAI ? 'font-mono' : ''}`}>
                                            {msg.content.replace(/Subject:.*\n\n/, '')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-8 bg-rvs-darker border-t border-rvs-steel/20 backdrop-blur-xl flex flex-col gap-4 z-20">
                        {selectedLead.aiStatus === 'ACTIVE' && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-30 flex items-center justify-center p-8 group">
                                <div className="text-center bg-rvs-dark border border-rvs-red/30 p-6 rounded-xl shadow-2xl scale-95 group-hover:scale-100 transition-transform">
                                    <Bot size={32} className="text-rvs-red-light mx-auto mb-3 animate-pulse" />
                                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1">AI Protocol Interlock Active</p>
                                    <p className="text-[10px] text-rvs-steel mb-4 uppercase">Manual transmission disabled while AI is routing.</p>
                                    <button onClick={toggleAIStatus} className="bg-rvs-red text-white px-6 py-2 rounded font-black text-[10px] uppercase hover:bg-rvs-red-light transition-colors">Emergency Take-over</button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-end gap-3">
                            <div className="flex-1 bg-black/50 border border-rvs-steel/30 rounded-xl p-3 focus-within:border-emerald-500/50 transition-all shadow-inner">
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="Execute manual response..."
                                    className="w-full bg-transparent border-none text-white focus:outline-none focus:ring-0 text-sm resize-none h-24 py-1 custom-scrollbar leading-relaxed"
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={generateDraft}
                                    disabled={isDrafting}
                                    className={`p-4 rounded-xl bg-rvs-darker border border-rvs-steel/30 transition-all ${isDrafting ? 'animate-pulse text-emerald-400' : 'hover:border-emerald-400 hover:text-emerald-400 text-rvs-steel'} shadow-lg`}
                                    title="Consult AI Copilot"
                                >
                                    {isDrafting ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                                </button>

                                <button 
                                    onClick={handleSend}
                                    disabled={!draft || isSending}
                                    className="p-4 rounded-xl bg-emerald-600 text-white font-black transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-30 shadow-lg"
                                >
                                    {isSending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[#070707] relative overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-rvs-red-dark/10 rounded-full blur-[150px] pointer-events-none"></div>
                    <div className="text-center z-10 px-10">
                        <div className="w-24 h-24 bg-rvs-darker border border-rvs-steel/10 rounded-3xl flex items-center justify-center mb-6 mx-auto shadow-2xl">
                            <Mail size={40} className="text-rvs-steel opacity-20" />
                        </div>
                        <h3 className="text-xl font-black text-white tracking-[0.3em] uppercase mb-2">Zero Comms</h3>
                        <p className="text-xs text-rvs-steel font-medium uppercase tracking-widest max-w-xs mx-auto leading-relaxed">Select a secure conversation thread from the lateral node directory to initiate manual override.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
