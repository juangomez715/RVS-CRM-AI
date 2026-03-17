"use client";
import { useState, useEffect } from 'react';
import { Search, Filter, Plus, X, Mail, Phone, Building, Calendar, Bot, Target, Loader2, Sparkles, MessageSquare, History } from 'lucide-react';

type Interaction = {
    id: string;
    channel: string;
    sender: string;
    content: string;
    createdAt: Date;
};

type Lead = {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    aiStatus: string;
    score: number | null;
    aiNotes: string | null;
    source: string | null;
    createdAt: Date;
    interactions?: Interaction[];
};

export default function LeadsClient({ leads: initialLeads }: { leads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredLeads = leads.filter(l => 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.company?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleViewLead = async (lead: Lead) => {
        setIsLoadingDetails(true);
        setSelectedLead(lead);
        try {
            // Fetch fresh details with full interaction history
            const res = await fetch(`/api/inbox`); // We use the inbox data map for interactions
            if (res.ok) {
                const allConversations = await res.json();
                const detailedLead = allConversations.find((l: any) => l.id === lead.id);
                if (detailedLead) {
                    setSelectedLead({ ...lead, interactions: detailedLead.interactions });
                }
            }
        } catch (e) {
            console.error("Failed to load lead history");
        } finally {
            setIsLoadingDetails(false);
        }
    };

    return (
        <div className="p-8 pb-20 flex relative h-full overflow-hidden bg-[#0A0A0A]">
            <div className={`flex-1 transition-all duration-300 pr-4 overflow-y-auto custom-scrollbar ${selectedLead ? 'xl:mr-[450px]' : ''}`}>
                <div className="flex justify-between items-end mb-8 border-b border-rvs-steel/20 pb-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg flex items-center gap-3">
                            <Target className="text-rvs-red-light" size={32} /> Leads Directory
                        </h1>
                        <p className="text-rvs-steel text-[10px] font-black uppercase tracking-widest mt-2">Central Node Prospect Database</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 rvs-glass text-rvs-chrome px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] border border-white/5 hover:border-white/20 transition-all">
                            <Filter size={14} /> Filters
                        </button>
                        <button className="flex items-center gap-2 bg-rvs-red text-white px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-rvs-red-light transition-all">
                            <Plus size={14} /> Provision Lead
                        </button>
                    </div>
                </div>

                <div className="rvs-glass border border-rvs-steel/20 rounded-2xl shadow-2xl overflow-hidden relative bg-black/40">
                    <div className="p-5 border-b border-rvs-steel/10 flex items-center gap-4 bg-white/5">
                        <Search size={18} className="text-rvs-steel" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="SEARCH BY IDENTIFIER (NAME, EMAIL, ORG)..."
                            className="bg-transparent border-none text-white focus:outline-none focus:ring-0 w-full text-[10px] font-black tracking-widest placeholder:text-rvs-steel/50"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/40 border-b border-rvs-steel/10">
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Lead Identity</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Organization</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Source Origin</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Processing</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={`border-b border-rvs-steel/5 last:border-0 transition-all group cursor-pointer ${selectedLead?.id === lead.id ? 'bg-rvs-red/10 border-l-[4px] border-l-rvs-red' : 'hover:bg-white/5'}`}
                                        onClick={() => handleViewLead(lead)}
                                    >
                                        <td className="p-5">
                                            <p className="text-white font-black tracking-widest uppercase text-xs">{lead.name}</p>
                                            <p className="text-[10px] text-rvs-steel mt-1 font-mono">{lead.email || lead.phone || 'NO_IDENTIFIER'}</p>
                                        </td>
                                        <td className="p-5 text-rvs-chrome font-black uppercase text-[10px] tracking-widest">{lead.company || '—'}</td>
                                        <td className="p-5">
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded text-rvs-steel border border-white/5">{lead.source}</span>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${lead.status === 'Qualified' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rvs-red/10 text-rvs-red-light border-rvs-red/30'}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right">
                                            <button className="text-[10px] text-rvs-steel uppercase tracking-widest font-black hover:text-white transition-all group-hover:translate-x-1">
                                                INSPECT &rarr;
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Inspect Panel (Slide-out) */}
            <div className={`fixed top-0 right-0 h-full w-full xl:w-[450px] bg-rvs-darker border-l border-rvs-steel/20 shadow-[-30px_0_60px_rgba(0,0,0,0.8)] transform transition-transform duration-500 z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedLead && (
                    <>
                        <div className="p-8 border-b border-rvs-steel/20 flex justify-between items-center bg-[#070707] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rvs-red-dark rounded-full blur-[60px] opacity-10"></div>
                            <div className="z-10">
                                <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase">Intelligence Profile</h2>
                                <p className="text-[9px] text-rvs-steel font-black uppercase mt-1">Lead ID: {selectedLead.id}</p>
                            </div>
                            <button onClick={() => setSelectedLead(null)} className="text-rvs-steel hover:text-white transition-colors z-10 p-2 bg-white/5 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">
                            {/* Header Info */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedLead.name}</h3>
                                    <div className="flex items-center gap-2 text-rvs-chrome text-xs font-black uppercase tracking-widest mt-1">
                                        <Building size={14} className="text-rvs-red-light" /> {selectedLead.company || 'INDEPENDENT'}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 pt-2">
                                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                                        <Target size={12} className="text-rvs-red-light" />
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{selectedLead.status}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${selectedLead.aiStatus === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                        <Bot size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">AI: {selectedLead.aiStatus}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scoring Block */}
                            <div className="bg-gradient-to-br from-rvs-dark to-black border border-rvs-red-dark/30 rounded-2xl p-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Sparkles size={64} /></div>
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                                    <h4 className="text-[10px] font-black text-rvs-red-light uppercase tracking-widest flex items-center gap-2">
                                        <Bot size={14} /> AI Qualification Model
                                    </h4>
                                    <div className="text-3xl font-black text-white font-mono flex items-baseline gap-1">
                                        {selectedLead.score || 0}
                                        <span className="text-[10px] text-rvs-steel font-black uppercase tracking-widest opacity-40">/100pt</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] text-rvs-steel font-black uppercase tracking-widest mb-1 opacity-60">Automated Analysis Report:</p>
                                    <p className="text-xs text-rvs-chrome/90 leading-relaxed font-medium italic bg-white/5 p-4 rounded-xl border border-white/5">
                                        "{selectedLead.aiNotes || 'Initializing lead vectors. Pending qualitative inference scan.'}"
                                    </p>
                                </div>
                            </div>

                            {/* Interaction History Section */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2 border-l-2 border-rvs-red pl-3">
                                    <History size={14} className="text-rvs-red-light" /> Activity Timeline
                                </h4>
                                
                                {isLoadingDetails ? (
                                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-rvs-red" /></div>
                                ) : selectedLead.interactions && selectedLead.interactions.length > 0 ? (
                                    <div className="space-y-4 relative">
                                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-white/5"></div>
                                        {selectedLead.interactions.map((int: any, idx: number) => (
                                            <div key={idx} className="flex gap-4 relative z-10">
                                                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${int.sender === 'LEAD' ? 'bg-rvs-darker border-white/10 text-white' : 'bg-rvs-red/10 border-rvs-red/30 text-rvs-red-light'}`}>
                                                    <MessageSquare size={14} />
                                                </div>
                                                <div className="flex-1 bg-white/5 border border-white/5 rounded-xl p-4">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[9px] font-black text-rvs-steel uppercase tracking-widest">{int.sender} • {int.channel}</span>
                                                        <span className="text-[9px] font-black text-rvs-steel/40 uppercase font-mono">{int.createdAt}</span>
                                                    </div>
                                                    <p className="text-[11px] text-rvs-chrome/80 leading-relaxed">{int.content.slice(0, 500)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                        <p className="text-[10px] text-rvs-steel uppercase font-black tracking-widest opacity-40">Zero interactions logged</p>
                                    </div>
                                )}
                            </div>

                            {/* Contact Details */}
                            <div className="grid grid-cols-1 gap-4">
                                {selectedLead.email && (
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                                        <Mail size={16} className="text-blue-400" />
                                        <div>
                                            <p className="text-[8px] font-black text-rvs-steel uppercase tracking-[0.2em] mb-0.5">Primary Transmission Address</p>
                                            <p className="text-xs font-mono text-white select-all">{selectedLead.email}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedLead.phone && (
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                                        <Phone size={16} className="text-emerald-400" />
                                        <div>
                                            <p className="text-[8px] font-black text-rvs-steel uppercase tracking-[0.2em] mb-0.5">Mobile Encrypted Line</p>
                                            <p className="text-xs font-mono text-white select-all">{selectedLead.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-8 border-t border-rvs-steel/20 bg-[#070707] flex gap-4">
                            <button className="flex-1 bg-transparent border border-rvs-steel/30 text-rvs-steel rounded-xl py-3 font-black text-[10px] uppercase tracking-widest hover:border-white hover:text-white transition-all">
                                Edit Profile
                            </button>
                            <button className="flex-1 bg-gradient-to-r from-rvs-red-dark to-rvs-red text-white rounded-xl py-3 font-black text-[10px] uppercase tracking-[0.2em] hover:shadow-[0_0_20px_rgba(211,19,19,0.3)] transition-all">
                                Initialize Comms
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
