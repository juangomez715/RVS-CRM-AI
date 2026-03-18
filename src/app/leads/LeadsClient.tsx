"use client";
import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Plus, X, Mail, Phone, Building, Bot, Target, Loader2, Sparkles, MessageSquare, History, Upload, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

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

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_COLORS: Record<string, string> = {
    New: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Contacted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    Qualified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Meeting: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Closed: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const ALL_STATUSES = ['All', 'New', 'Contacted', 'Qualified', 'Meeting', 'Closed'];
const ALL_SOURCES = ['All', 'manual', 'csv_import', 'n8n', 'n8n_bulk', 'apollo'];

export default function LeadsClient({ leads: initialLeads }: { leads: Lead[] }) {
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: initialLeads.length, pages: 1 });
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sourceFilter, setSourceFilter] = useState("All");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Create lead form state
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newCompany, setNewCompany] = useState('');
    const [newSource, setNewSource] = useState('manual');
    const [newStatus, setNewStatus] = useState('New');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // CSV import state
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ created: number; skipped: number; message: string } | null>(null);
    const [importError, setImportError] = useState('');

    const fetchLeads = async (page = 1, search = searchQuery, status = statusFilter, source = sourceFilter) => {
        setIsLoadingLeads(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: '50',
                ...(search && { search }),
                ...(status !== 'All' && { status }),
                ...(source !== 'All' && { source }),
            });
            const res = await fetch(`/api/leads?${params}`);
            if (res.ok) {
                const data = await res.json();
                setLeads(data.leads || data);
                if (data.pagination) setPagination(data.pagination);
            }
        } catch (e) {
            console.error("Failed to fetch leads");
        } finally {
            setIsLoadingLeads(false);
        }
    };

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => fetchLeads(1, searchQuery, statusFilter, sourceFilter), 300);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, statusFilter, sourceFilter]);

    const handleViewLead = async (lead: Lead) => {
        setIsLoadingDetails(true);
        setSelectedLead(lead);
        try {
            const res = await fetch(`/api/leads/${lead.id}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedLead(data);
            }
        } catch (e) {
            console.error("Failed to load lead details");
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleCreateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) { setCreateError('Name is required'); return; }
        setIsCreating(true);
        setCreateError('');
        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, email: newEmail, phone: newPhone, company: newCompany, source: newSource, status: newStatus })
            });
            const data = await res.json();
            if (res.ok) {
                setLeads([data, ...leads]);
                setShowCreateModal(false);
                setNewName(''); setNewEmail(''); setNewPhone(''); setNewCompany('');
                setNewSource('manual'); setNewStatus('New');
            } else {
                setCreateError(data.error || 'Failed to create lead');
            }
        } catch {
            setCreateError('Network error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCsvImport = async () => {
        if (!csvFile) return;
        setIsImporting(true);
        setImportError('');
        setImportResult(null);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            const res = await fetch('/api/leads/csv', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setImportResult(data);
                await fetchLeads(1);
            } else {
                setImportError(data.error || 'Import failed');
            }
        } catch {
            setImportError('Network error during import');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="p-8 pb-20 flex relative h-full overflow-hidden bg-[#0A0A0A]">
            {/* Main list */}
            <div className={`flex-1 transition-all duration-300 pr-4 overflow-y-auto custom-scrollbar ${selectedLead ? 'xl:mr-[450px]' : ''}`}>
                <div className="flex justify-between items-end mb-6 border-b border-rvs-steel/20 pb-4">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg flex items-center gap-3">
                            <Target className="text-rvs-red-light" size={32} /> Leads Directory
                        </h1>
                        <p className="text-rvs-steel text-[10px] font-black uppercase tracking-widest mt-2">
                            {pagination.total.toLocaleString()} total leads
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 rvs-glass text-rvs-chrome px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all ${showFilters ? 'border-rvs-red/40 text-rvs-red-light' : 'border-white/5 hover:border-white/20'}`}
                        >
                            <Filter size={14} /> Filters
                        </button>
                        <button
                            onClick={() => setShowCsvModal(true)}
                            className="flex items-center gap-2 rvs-glass text-emerald-400 px-4 py-2 rounded-lg font-black uppercase tracking-widest text-[10px] border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
                        >
                            <Upload size={14} /> Import CSV
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 bg-rvs-red text-white px-5 py-2.5 rounded-lg font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-rvs-red-light transition-all"
                        >
                            <Plus size={14} /> New Lead
                        </button>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="mb-4 p-4 rvs-glass rounded-xl border border-rvs-steel/20 space-y-3">
                        <div>
                            <p className="text-[9px] font-black text-rvs-steel uppercase tracking-widest mb-2">Status</p>
                            <div className="flex flex-wrap gap-2">
                                {ALL_STATUSES.map(s => (
                                    <button key={s} onClick={() => setStatusFilter(s)}
                                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded border transition-all ${statusFilter === s ? 'bg-rvs-red/20 border-rvs-red/40 text-rvs-red-light' : 'border-rvs-steel/20 text-rvs-steel hover:border-white/20 hover:text-white'}`}
                                    >{s}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-rvs-steel uppercase tracking-widest mb-2">Source</p>
                            <div className="flex flex-wrap gap-2">
                                {ALL_SOURCES.map(s => (
                                    <button key={s} onClick={() => setSourceFilter(s)}
                                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded border transition-all ${sourceFilter === s ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'border-rvs-steel/20 text-rvs-steel hover:border-white/20 hover:text-white'}`}
                                    >{s}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="rvs-glass border border-rvs-steel/20 rounded-2xl shadow-2xl overflow-hidden relative bg-black/40">
                    <div className="p-5 border-b border-rvs-steel/10 flex items-center gap-4 bg-white/5">
                        <Search size={18} className="text-rvs-steel" />
                        <input
                            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="SEARCH BY NAME, EMAIL, ORGANIZATION..."
                            className="bg-transparent border-none text-white focus:outline-none focus:ring-0 w-full text-[10px] font-black tracking-widest placeholder:text-rvs-steel/50"
                        />
                        {isLoadingLeads && <Loader2 size={16} className="animate-spin text-rvs-steel shrink-0" />}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/40 border-b border-rvs-steel/10">
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Lead Identity</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Organization</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Source</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em]">Status</th>
                                    <th className="p-5 text-[10px] font-black text-rvs-steel uppercase tracking-[0.2em] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.length === 0 && (
                                    <tr><td colSpan={5} className="p-12 text-center text-rvs-steel/40 text-[10px] uppercase font-black tracking-widest">No leads found</td></tr>
                                )}
                                {leads.map((lead) => (
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
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded text-rvs-steel border border-white/5">{lead.source || 'unknown'}</span>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[lead.status] || 'bg-white/5 text-white/40 border-white/10'}`}>
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

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="p-4 border-t border-rvs-steel/10 flex items-center justify-between bg-black/20">
                            <span className="text-[10px] font-black text-rvs-steel uppercase tracking-widest">
                                Page {pagination.page} of {pagination.pages} ({pagination.total.toLocaleString()} leads)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={pagination.page <= 1}
                                    onClick={() => fetchLeads(pagination.page - 1)}
                                    className="p-2 rounded border border-rvs-steel/20 text-rvs-steel hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => fetchLeads(pagination.page + 1)}
                                    className="p-2 rounded border border-rvs-steel/20 text-rvs-steel hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inspect Panel */}
            <div className={`fixed top-0 right-0 h-full w-full xl:w-[450px] bg-rvs-darker border-l border-rvs-steel/20 shadow-[-30px_0_60px_rgba(0,0,0,0.8)] transform transition-transform duration-500 z-50 flex flex-col ${selectedLead ? 'translate-x-0' : 'translate-x-full'}`}>
                {selectedLead && (
                    <>
                        <div className="p-8 border-b border-rvs-steel/20 flex justify-between items-center bg-[#070707] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rvs-red-dark rounded-full blur-[60px] opacity-10"></div>
                            <div className="z-10">
                                <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase">Intelligence Profile</h2>
                                <p className="text-[9px] text-rvs-steel font-black uppercase mt-1">ID: {selectedLead.id}</p>
                            </div>
                            <button onClick={() => setSelectedLead(null)} className="text-rvs-steel hover:text-white transition-colors z-10 p-2 bg-white/5 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-black/20">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{selectedLead.name}</h3>
                                    <div className="flex items-center gap-2 text-rvs-chrome text-xs font-black uppercase tracking-widest mt-1">
                                        <Building size={14} className="text-rvs-red-light" /> {selectedLead.company || 'INDEPENDENT'}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${STATUS_COLORS[selectedLead.status] || 'bg-white/5 border-white/10'}`}>
                                        <Target size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{selectedLead.status}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${selectedLead.aiStatus === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                        <Bot size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">AI: {selectedLead.aiStatus}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scoring */}
                            <div className="bg-gradient-to-br from-rvs-dark to-black border border-rvs-red-dark/30 rounded-2xl p-6 relative overflow-hidden">
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                                    <h4 className="text-[10px] font-black text-rvs-red-light uppercase tracking-widest flex items-center gap-2">
                                        <Bot size={14} /> AI Qualification
                                    </h4>
                                    <div className="text-3xl font-black text-white font-mono flex items-baseline gap-1">
                                        {selectedLead.score || 0}
                                        <span className="text-[10px] text-rvs-steel opacity-40">/100</span>
                                    </div>
                                </div>
                                <p className="text-xs text-rvs-chrome/90 leading-relaxed font-medium italic bg-white/5 p-4 rounded-xl border border-white/5">
                                    "{selectedLead.aiNotes || 'No AI analysis available.'}"
                                </p>
                            </div>

                            {/* Interaction History */}
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
                                                        <span className="text-[9px] font-black text-rvs-steel/40 font-mono">{new Date(int.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-[11px] text-rvs-chrome/80 leading-relaxed">{int.content.slice(0, 500)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                        <p className="text-[10px] text-rvs-steel uppercase font-black tracking-widest opacity-40">No interactions logged</p>
                                    </div>
                                )}
                            </div>

                            {/* Contact Details */}
                            <div className="grid grid-cols-1 gap-4">
                                {selectedLead.email && (
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                        <Mail size={16} className="text-blue-400" />
                                        <div>
                                            <p className="text-[8px] font-black text-rvs-steel uppercase tracking-[0.2em] mb-0.5">Email</p>
                                            <p className="text-xs font-mono text-white select-all">{selectedLead.email}</p>
                                        </div>
                                    </div>
                                )}
                                {selectedLead.phone && (
                                    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                        <Phone size={16} className="text-emerald-400" />
                                        <div>
                                            <p className="text-[8px] font-black text-rvs-steel uppercase tracking-[0.2em] mb-0.5">Phone</p>
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

            {/* Create Lead Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-rvs-darker border border-rvs-steel/20 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-rvs-steel/20 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest">New Lead</h2>
                                <p className="text-[10px] text-rvs-steel uppercase tracking-widest mt-1">Manual Entry</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-rvs-steel hover:text-white p-2"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateLead} className="p-6 space-y-4">
                            {createError && (
                                <p className="text-[10px] text-red-400 font-black uppercase bg-red-500/10 border border-red-500/30 p-3 rounded">{createError}</p>
                            )}
                            <div>
                                <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Name *</label>
                                <input required type="text" value={newName} onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Email</label>
                                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                        className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Phone</label>
                                    <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                                        className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Company</label>
                                <input type="text" value={newCompany} onChange={e => setNewCompany(e.target.value)}
                                    className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Source</label>
                                    <select value={newSource} onChange={e => setNewSource(e.target.value)}
                                        className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono">
                                        <option value="manual">Manual</option>
                                        <option value="apollo">Apollo</option>
                                        <option value="linkedin">LinkedIn</option>
                                        <option value="referral">Referral</option>
                                        <option value="website">Website</option>
                                        <option value="event">Event</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Status</label>
                                    <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                                        className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2.5 text-sm text-white focus:outline-none focus:border-rvs-red font-mono">
                                        {['New', 'Contacted', 'Qualified', 'Meeting', 'Closed'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 border border-rvs-steel/30 text-rvs-steel rounded-lg font-black text-[10px] uppercase tracking-widest hover:border-white hover:text-white transition-all">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isCreating}
                                    className="flex-1 py-3 bg-rvs-red text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-rvs-red-light transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    {isCreating ? 'Creating...' : 'Create Lead'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CSV Import Modal */}
            {showCsvModal && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => { setShowCsvModal(false); setImportResult(null); setImportError(''); setCsvFile(null); }}>
                    <div className="bg-rvs-darker border border-rvs-steel/20 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-rvs-steel/20 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest">CSV Import</h2>
                                <p className="text-[10px] text-rvs-steel uppercase tracking-widest mt-1">Bulk lead ingestion</p>
                            </div>
                            <button onClick={() => { setShowCsvModal(false); setImportResult(null); setImportError(''); setCsvFile(null); }} className="text-rvs-steel hover:text-white p-2"><X size={18} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-black/40 border border-rvs-steel/20 rounded-lg p-4 text-[10px] text-rvs-steel font-mono space-y-1">
                                <p className="text-white font-black uppercase tracking-widest mb-2">Required CSV columns:</p>
                                <p>• <span className="text-emerald-400">name</span> (required)</p>
                                <p>• email, phone, company, source (optional)</p>
                                <p>• Max 100,000 rows per file, 10MB limit</p>
                                <p>• Duplicate emails are skipped automatically</p>
                            </div>

                            {importResult ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
                                    <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
                                    <p className="text-emerald-400 font-black uppercase tracking-widest text-sm">{importResult.created} leads imported</p>
                                    <p className="text-rvs-steel text-[10px] mt-1">{importResult.skipped} skipped (duplicates)</p>
                                    <button onClick={() => { setShowCsvModal(false); setImportResult(null); setCsvFile(null); }}
                                        className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all">
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div
                                        className="border-2 border-dashed border-rvs-steel/30 rounded-xl p-8 text-center cursor-pointer hover:border-rvs-red/40 transition-all"
                                        onClick={() => csvInputRef.current?.click()}
                                    >
                                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                                        <Upload size={28} className={`mx-auto mb-3 ${csvFile ? 'text-emerald-400' : 'text-rvs-steel/40'}`} />
                                        {csvFile ? (
                                            <div>
                                                <p className="text-emerald-400 font-black text-sm">{csvFile.name}</p>
                                                <p className="text-rvs-steel text-[10px] mt-1">{(csvFile.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-rvs-steel font-black uppercase tracking-widest text-[10px]">Click to select CSV file</p>
                                                <p className="text-rvs-steel/40 text-[9px] mt-1">or drag and drop</p>
                                            </div>
                                        )}
                                    </div>

                                    {importError && (
                                        <p className="text-[10px] text-red-400 font-black uppercase bg-red-500/10 border border-red-500/30 p-3 rounded">{importError}</p>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => { setShowCsvModal(false); setCsvFile(null); }}
                                            className="flex-1 py-3 border border-rvs-steel/30 text-rvs-steel rounded-lg font-black text-[10px] uppercase tracking-widest hover:border-white hover:text-white transition-all">
                                            Cancel
                                        </button>
                                        <button onClick={handleCsvImport} disabled={!csvFile || isImporting}
                                            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            {isImporting ? 'Importing...' : 'Import'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
