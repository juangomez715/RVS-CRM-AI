"use client";
import { useState, useEffect, useRef } from 'react';
import { Zap, Plus, Trash2, Sparkles, Clock, Users, ChevronDown, ChevronUp, Loader2, Save, BarChart3, MailSearch, Eye } from 'lucide-react';

interface Step {
    id: string;
    dayOffset: number;
    subject: string;
    content: string;
    isAIGenerated: boolean;
}

interface Sequence {
    id: string;
    name: string;
    goal: string | null;
    isActive: boolean;
    steps: Step[];
    _count?: { steps: number; leads: number };
}

const VARIABLES = [
    { token: '{{first_name}}', label: 'First Name', hint: 'John' },
    { token: '{{full_name}}',  label: 'Full Name',  hint: 'John Doe' },
    { token: '{{company}}',    label: 'Company',    hint: 'Acme Corp' },
    { token: '{{email}}',      label: 'Email',      hint: 'john@acme.com' },
    { token: '{{phone}}',      label: 'Phone',      hint: '+1 555 0100' },
    { token: '{{source}}',     label: 'Source',     hint: 'LinkedIn' },
    { token: '{{score}}',      label: 'AI Score',   hint: '82' },
    { token: '{{status}}',     label: 'Status',     hint: 'Qualified' },
];

const PREVIEW_SAMPLE: Record<string, string> = {
    '{{first_name}}': 'John',
    '{{full_name}}':  'John Doe',
    '{{company}}':    'Acme Corp',
    '{{email}}':      'john@acme.com',
    '{{phone}}':      '+1 555 0100',
    '{{source}}':     'LinkedIn',
    '{{score}}':      '82',
    '{{status}}':     'Qualified',
};

function renderPreview(str: string): string {
    return VARIABLES.reduce(
        (s, v) => s.split(v.token).join(PREVIEW_SAMPLE[v.token] ?? v.token),
        str
    );
}

function insertAtCursor(
    el: HTMLInputElement | HTMLTextAreaElement | null,
    token: string,
    currentValue: string,
    onChange: (val: string) => void
) {
    if (!el) { onChange(currentValue + token); return; }
    const start = el.selectionStart ?? currentValue.length;
    const end   = el.selectionEnd   ?? currentValue.length;
    const next  = currentValue.slice(0, start) + token + currentValue.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
    });
}

// ─── Variable Panel ──────────────────────────────────────────────────────────
interface VariablePanelProps {
    subjectValue: string;
    contentValue: string;
    focusedField: 'subject' | 'content' | null;
    onInsert: (token: string) => void;
    onRemove: (token: string) => void;
}

function VariablePanel({ subjectValue, contentValue, focusedField, onInsert, onRemove }: VariablePanelProps) {
    const activeValue = focusedField === 'subject' ? subjectValue : contentValue;

    return (
        <div className="flex flex-col bg-black/30 border border-rvs-steel/20 rounded-xl overflow-hidden h-full" style={{ minHeight: '220px' }}>
            <div className="p-3 border-b border-rvs-steel/10 shrink-0">
                <p className="text-[9px] font-black text-rvs-steel uppercase tracking-widest">Variables</p>
                <p className="text-[8px] text-rvs-steel/40 mt-0.5 font-mono">
                    {focusedField ? `↳ inserting in ${focusedField}` : '← focus a field first'}
                </p>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                {VARIABLES.map(v => {
                    const isActive = activeValue.includes(v.token);
                    return (
                        <div
                            key={v.token}
                            onClick={() => isActive ? onRemove(v.token) : onInsert(v.token)}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                                isActive
                                    ? 'bg-rvs-red-dark/15 border-rvs-red-dark/40'
                                    : 'border-transparent hover:bg-white/[0.03] hover:border-rvs-steel/15'
                            }`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-[8px] font-mono text-rvs-chrome leading-tight truncate">{v.token}</p>
                                <p className="text-[7px] text-rvs-steel/50">{v.label}</p>
                            </div>
                            {/* Toggle pill */}
                            <div
                                className="shrink-0 relative rounded-full"
                                style={{
                                    width: '1.75rem',
                                    height: '1rem',
                                    background: isActive ? '#b91c1c' : 'rgba(100,116,139,0.3)',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <span
                                    className="absolute rounded-full bg-white shadow-sm"
                                    style={{
                                        width: '0.75rem',
                                        height: '0.75rem',
                                        top: '0.125rem',
                                        left: isActive ? 'calc(100% - 0.875rem)' : '0.125rem',
                                        transition: 'left 0.15s',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Live Preview Panel ───────────────────────────────────────────────────────
function PreviewPanel({ subject, content }: { subject: string; content: string }) {
    const previewSubject = renderPreview(subject);
    const previewContent = renderPreview(content);
    const empty = !subject && !content;

    return (
        <div className="bg-black/30 border border-rvs-steel/20 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-rvs-steel/10 flex items-center gap-2">
                <Eye size={11} className="text-rvs-red-light" />
                <p className="text-[9px] font-black text-rvs-steel uppercase tracking-widest">Live Preview</p>
                <span className="ml-auto text-[7px] font-mono text-rvs-steel/30">sample data</span>
            </div>
            {empty ? (
                <div className="p-6 flex flex-col items-center justify-center opacity-25 min-h-[80px]">
                    <Eye size={18} className="text-rvs-steel mb-1.5" />
                    <p className="text-[8px] text-rvs-steel font-mono">nothing to preview yet</p>
                </div>
            ) : (
                <div className="p-3 space-y-3">
                    {/* Sample data pills */}
                    <div className="flex flex-wrap gap-1">
                        {VARIABLES.slice(0, 4).map(v => (
                            <span key={v.token} className="text-[7px] font-mono bg-rvs-steel/10 border border-rvs-steel/10 px-1.5 py-0.5 rounded text-rvs-steel/50">
                                {v.label.toLowerCase()}: <span className="text-rvs-chrome/60">{v.hint}</span>
                            </span>
                        ))}
                    </div>
                    {subject && (
                        <div>
                            <p className="text-[8px] font-black text-rvs-steel/40 uppercase tracking-widest mb-1">Subject</p>
                            <div className="bg-black/50 border border-rvs-steel/10 rounded-lg px-3 py-2 text-xs text-white font-mono leading-relaxed break-words">
                                {previewSubject || <span className="opacity-30 italic">empty</span>}
                            </div>
                        </div>
                    )}
                    {content && (
                        <div>
                            <p className="text-[8px] font-black text-rvs-steel/40 uppercase tracking-widest mb-1">Body</p>
                            <div className="bg-black/50 border border-rvs-steel/10 rounded-lg px-3 py-2 text-[10px] text-white/70 font-mono leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar break-words">
                                {previewContent || <span className="opacity-30 italic">empty</span>}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SequencesPage() {
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newGoal, setNewGoal] = useState('');
    // Tracks which step + field is currently focused for variable insertion
    const [activeField, setActiveField] = useState<{ stepId: string; field: 'subject' | 'content' } | null>(null);

    const inputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

    useEffect(() => { loadSequences(); }, []);

    const loadSequences = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/sequences');
            if (res.ok) {
                const data = await res.json();
                setSequences(data);
                if (data.length > 0 && !expandedId) setExpandedId(data[0].id);
            }
        } catch (e) {
            console.error('Failed to load sequences');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id);

    const toggleActive = async (id: string, current: boolean) => {
        await fetch(`/api/sequences/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !current }),
        });
        setSequences(prev => prev.map(s => s.id === id ? { ...s, isActive: !current } : s));
    };

    const addStep = (seqId: string) => {
        setSequences(prev => prev.map(s => {
            if (s.id !== seqId) return s;
            const lastDay = s.steps.length > 0 ? s.steps[s.steps.length - 1].dayOffset : -1;
            return { ...s, steps: [...s.steps, { id: `temp-${Date.now()}`, dayOffset: lastDay + 3, subject: '', content: '', isAIGenerated: false }] };
        }));
    };

    const removeStep = (seqId: string, stepId: string) =>
        setSequences(prev => prev.map(s => s.id === seqId ? { ...s, steps: s.steps.filter(st => st.id !== stepId) } : s));

    const toggleAI = (seqId: string, stepId: string) =>
        setSequences(prev => prev.map(s => s.id === seqId ? { ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, isAIGenerated: !st.isAIGenerated } : st) } : s));

    const updateStepData = (seqId: string, stepId: string, field: 'subject' | 'content' | 'dayOffset', value: string | number) =>
        setSequences(prev => prev.map(s => s.id === seqId ? { ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, [field]: value } : st) } : s));

    const insertVariable = (seqId: string, stepId: string, token: string) => {
        const field = activeField?.stepId === stepId ? activeField.field : 'content';
        const step = sequences.find(s => s.id === seqId)?.steps.find(st => st.id === stepId);
        if (!step) return;
        const ref = inputRefs.current[`${stepId}-${field}`] as HTMLInputElement | HTMLTextAreaElement | null;
        insertAtCursor(ref, token, step[field], val => updateStepData(seqId, stepId, field, val));
    };

    const removeVariable = (seqId: string, stepId: string, token: string) => {
        const field = activeField?.stepId === stepId ? activeField.field : 'content';
        const step = sequences.find(s => s.id === seqId)?.steps.find(st => st.id === stepId);
        if (!step) return;
        updateStepData(seqId, stepId, field, step[field].split(token).join(''));
    };

    const handleSaveSequence = async (id: string) => {
        const seq = sequences.find(s => s.id === id);
        if (!seq) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/sequences/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: seq.name, goal: seq.goal, steps: seq.steps }),
            });
            if (res.ok) await loadSequences();
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSequence = async (id: string) => {
        if (!confirm('Are you sure? This will delete all logic and enrollment statistics for this sequence.')) return;
        await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
        setSequences(sequences.filter(s => s.id !== id));
    };

    const createSequence = async () => {
        if (!newName.trim()) return;
        const res = await fetch('/api/sequences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, goal: newGoal }),
        });
        if (res.ok) {
            const newSeq = await res.json();
            setSequences([newSeq, ...sequences]);
            setNewName(''); setNewGoal(''); setShowNewForm(false);
            setExpandedId(newSeq.id);
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 h-full bg-[#0A0A0A] flex justify-center items-center">
                <Loader2 className="animate-spin text-rvs-red" size={48} />
            </div>
        );
    }

    return (
        <div className="p-8 h-full bg-[#0A0A0A] overflow-y-auto w-full custom-scrollbar">

            {/* Header */}
            <div className="mb-8 border-b border-rvs-steel/20 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
                        <Zap className="text-rvs-red-light" size={32} /> Blast Engines
                    </h1>
                    <p className="text-rvs-steel text-[10px] font-black uppercase tracking-widest mt-2">
                        Configure Automated Transmission Nodes
                    </p>
                </div>
                <button
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="bg-rvs-red-dark text-white px-5 py-3 rounded-lg font-black tracking-widest uppercase text-[10px] hover:bg-rvs-red transition-all flex items-center gap-2 shadow-lg border border-rvs-red/30"
                >
                    <Plus size={14} /> Design Sequence
                </button>
            </div>

            {/* New Sequence Form */}
            {showNewForm && (
                <div className="bg-rvs-darker border border-rvs-red-dark/50 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-white font-black tracking-widest uppercase text-xs mb-4 flex items-center gap-2">
                        <Plus size={14} className="text-rvs-red-light" /> Initializing New Campaign Node
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="text-[9px] text-rvs-steel uppercase font-black tracking-widest block mb-1">Sequence Manifest Name</label>
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Q4 CLINIC OUTREACH"
                                className="w-full bg-black/50 border border-rvs-steel/20 rounded p-3 text-white text-xs font-mono focus:outline-none focus:border-rvs-red-light" />
                        </div>
                        <div>
                            <label className="text-[9px] text-rvs-steel uppercase font-black tracking-widest block mb-1">Primary Objective / Goal</label>
                            <input type="text" value={newGoal} onChange={e => setNewGoal(e.target.value)} placeholder="e.g. Schedule Demo Call"
                                className="w-full bg-black/50 border border-rvs-steel/20 rounded p-3 text-white text-xs font-mono focus:outline-none focus:border-rvs-red-light" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={createSequence} className="bg-rvs-red text-white px-6 py-2.5 rounded font-black text-[10px] uppercase tracking-[0.2em] hover:bg-rvs-red-light transition-all shadow-lg">Deploy Node</button>
                        <button onClick={() => setShowNewForm(false)} className="bg-transparent border border-rvs-steel/20 text-rvs-steel px-6 py-2.5 rounded font-black text-[10px] uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all">Abort</button>
                    </div>
                </div>
            )}

            {/* Sequence Cards */}
            <div className="space-y-6">
                {sequences.length === 0 && (
                    <div className="p-20 text-center border border-dashed border-rvs-steel/20 rounded-2xl opacity-40">
                        <Zap size={48} className="mx-auto mb-4 text-rvs-steel" />
                        <p className="text-xs text-white font-black uppercase tracking-widest">No Sequences Defined</p>
                    </div>
                )}

                {sequences.map(seq => (
                    <div key={seq.id} className={`bg-rvs-darker border transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl ${expandedId === seq.id ? 'border-rvs-red-light/30 ring-1 ring-rvs-red-light/10 scale-[1.01]' : 'border-rvs-steel/20 opacity-80 hover:opacity-100'}`}>

                        {/* Header */}
                        <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5 transition-all bg-gradient-to-r from-transparent to-black/20" onClick={() => toggleExpand(seq.id)}>
                            <div className="flex items-center gap-6">
                                <div className={`w-4 h-4 rounded-full relative ${seq.isActive ? 'bg-emerald-500' : 'bg-rvs-steel/30'}`}>
                                    {seq.isActive && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40"></div>}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-widest mb-1">{seq.name.toUpperCase()}</h3>
                                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-rvs-steel">
                                        <span className="text-rvs-red-light">{seq.goal}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Users size={10} /> {seq._count?.leads || 0} ENROLLED</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1"><Clock size={10} /> {seq.steps.length} STAGES</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={e => { e.stopPropagation(); toggleActive(seq.id, seq.isActive); }}
                                    className={`px-3 py-1.5 border rounded text-[10px] font-black uppercase tracking-widest transition-all ${seq.isActive ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5' : 'text-rvs-steel border-rvs-steel/20'}`}>
                                    {seq.isActive ? 'ACTIVE' : 'PAUSED'}
                                </button>
                                {expandedId === seq.id ? <ChevronUp size={20} className="text-rvs-red-light" /> : <ChevronDown size={20} className="text-rvs-steel" />}
                            </div>
                        </div>

                        {/* Expanded Timeline */}
                        {expandedId === seq.id && (
                            <div className="border-t border-rvs-steel/10 p-8 space-y-8 bg-black/40">
                                <div className="relative">
                                    {seq.steps.length > 0 && (
                                        <div className="absolute left-[23px] top-6 bottom-6 w-1 bg-gradient-to-b from-rvs-red-light/40 to-transparent"></div>
                                    )}

                                    <div className="space-y-10">
                                        {seq.steps.map((step, idx) => (
                                            <div key={step.id} className="flex gap-8 relative group">

                                                {/* Timeline node */}
                                                <div className="flex flex-col items-center pt-2 z-10 shrink-0">
                                                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border-2 transition-all shadow-xl group-hover:scale-110 ${step.isAIGenerated ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' : 'bg-rvs-red-dark/10 border-rvs-red-dark text-rvs-red-light'}`}>
                                                        <span className="text-[8px] font-bold opacity-60">DAY</span>
                                                        <span className="text-base font-black leading-none">{step.dayOffset}</span>
                                                    </div>
                                                </div>

                                                {/* Step Card */}
                                                <div className="flex-1 bg-rvs-dark/40 border border-rvs-steel/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                                    {step.isAIGenerated && <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>}

                                                    {/* Step Header */}
                                                    <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${step.isAIGenerated ? 'bg-purple-500/10 text-purple-400' : 'bg-rvs-red-dark/10 text-rvs-red-light'}`}>
                                                                {step.isAIGenerated ? <Sparkles size={16} /> : <MailSearch size={16} />}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Transmission Phase {idx + 1}</h4>
                                                                <p className="text-[9px] text-rvs-steel uppercase font-mono mt-0.5">Automated Execution Protocol</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button onClick={() => toggleAI(seq.id, step.id)}
                                                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${step.isAIGenerated ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-rvs-dark/80 text-rvs-steel border border-rvs-steel/30 hover:border-white/40'}`}>
                                                                {step.isAIGenerated ? 'AI CO-PILOT ACTIVE' : 'MANUAL TEMPLATE'}
                                                            </button>
                                                            <button onClick={() => removeStep(seq.id, step.id)} className="text-white/20 hover:text-red-500 transition-colors p-1">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* 3-column layout: Editor | Variables | Preview + Config */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                                                        {/* ── Editor (5/12) ── */}
                                                        <div className="lg:col-span-5 space-y-4">
                                                            <div>
                                                                <label className="text-[9px] text-rvs-steel uppercase font-black tracking-widest block mb-1.5 opacity-60">
                                                                    {step.isAIGenerated ? 'AI Re-write Instruction (Ollama Protocol)' : 'Static Subject Line'}
                                                                </label>
                                                                <input
                                                                    ref={el => { inputRefs.current[`${step.id}-subject`] = el; }}
                                                                    type="text"
                                                                    value={step.subject}
                                                                    onChange={e => updateStepData(seq.id, step.id, 'subject', e.target.value)}
                                                                    onFocus={() => setActiveField({ stepId: step.id, field: 'subject' })}
                                                                    placeholder={step.isAIGenerated ? 'e.g. Write a follow-up about {{company}} dental solutions' : 'e.g. Hi {{first_name}}, quick question about {{company}}'}
                                                                    className="w-full bg-black/40 border border-rvs-steel/30 rounded-lg p-3 text-white text-xs font-mono focus:outline-none focus:border-rvs-red-light/50 transition-all shadow-inner"
                                                                />
                                                            </div>

                                                            {!step.isAIGenerated ? (
                                                                <div>
                                                                    <label className="text-[9px] text-rvs-steel uppercase font-black tracking-widest block mb-1.5 opacity-60">Body Template (HTML Support)</label>
                                                                    <textarea
                                                                        ref={el => { inputRefs.current[`${step.id}-content`] = el; }}
                                                                        value={step.content}
                                                                        onChange={e => updateStepData(seq.id, step.id, 'content', e.target.value)}
                                                                        onFocus={() => setActiveField({ stepId: step.id, field: 'content' })}
                                                                        rows={6}
                                                                        placeholder={`Hi {{first_name}},\n\nI noticed {{company}} might benefit from...\n\nBest,`}
                                                                        className="w-full bg-black/40 border border-rvs-steel/30 rounded-lg p-3 text-white text-xs font-mono focus:outline-none focus:border-rvs-red-light/50 resize-none shadow-inner leading-relaxed"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 flex items-start gap-4">
                                                                    <Sparkles size={24} className="text-purple-400 shrink-0 mt-1" />
                                                                    <div>
                                                                        <h5 className="text-[10px] font-black text-purple-300 uppercase tracking-widest mb-1">AI Personalization Logic</h5>
                                                                        <p className="text-[11px] text-purple-200/50 leading-relaxed italic">
                                                                            The system will automatically cross-reference Lead ID notes, recent interactions, and knowledge base documents to craft a unique, human-like response. Variables like <span className="text-purple-300 font-mono">{'{{first_name}}'}</span> and <span className="text-purple-300 font-mono">{'{{company}}'}</span> in the subject will still be replaced.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* ── Variable Panel (3/12) ── */}
                                                        <div className="lg:col-span-3">
                                                            <VariablePanel
                                                                subjectValue={step.subject}
                                                                contentValue={step.content}
                                                                focusedField={activeField?.stepId === step.id ? activeField.field : null}
                                                                onInsert={token => insertVariable(seq.id, step.id, token)}
                                                                onRemove={token => removeVariable(seq.id, step.id, token)}
                                                            />
                                                        </div>

                                                        {/* ── Preview + Config (4/12) ── */}
                                                        <div className="lg:col-span-4 space-y-4">
                                                            <PreviewPanel
                                                                subject={step.subject}
                                                                content={step.isAIGenerated ? '' : step.content}
                                                            />

                                                            {/* Day Offset */}
                                                            <div className="p-4 bg-black/30 border border-rvs-steel/20 rounded-xl">
                                                                <label className="text-[9px] text-rvs-steel uppercase font-black tracking-widest block mb-3">Delay Offset Configuration</label>
                                                                <div className="flex items-end gap-3">
                                                                    <input
                                                                        type="number"
                                                                        value={step.dayOffset}
                                                                        onChange={e => updateStepData(seq.id, step.id, 'dayOffset', parseInt(e.target.value) || 0)}
                                                                        className="w-full bg-rvs-dark/80 border border-rvs-steel/30 rounded-lg p-2.5 text-white text-sm text-center font-black focus:outline-none focus:border-rvs-red-light/50"
                                                                        min={0}
                                                                    />
                                                                    <span className="text-xs font-black text-rvs-steel mb-2.5">DAYS</span>
                                                                </div>
                                                            </div>

                                                            {/* Realtime Tracking */}
                                                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                                                <h5 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                                                    Realtime Tracking <BarChart3 size={12} />
                                                                </h5>
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between items-end border-b border-emerald-500/10 pb-2">
                                                                        <span className="text-[8px] font-black text-emerald-400/60 tracking-widest">OPENS</span>
                                                                        <span className="text-sm font-black text-white">0</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-end">
                                                                        <span className="text-[8px] font-black text-emerald-400/60 tracking-widest">CONVERSION</span>
                                                                        <span className="text-sm font-black text-white">0%</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                    </div>{/* end 3-col grid */}
                                                </div>{/* end Step Card */}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex justify-between items-center gap-4 mt-12 pt-8 border-t border-white/5">
                                    <button onClick={() => handleDeleteSequence(seq.id)}
                                        className="px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                                        Delete Engine
                                    </button>
                                    <div className="flex gap-4">
                                        <button onClick={() => addStep(seq.id)}
                                            className="px-6 py-2.5 bg-rvs-dark border border-rvs-steel/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-white transition-all flex items-center gap-2">
                                            <Plus size={14} /> Attach Stage
                                        </button>
                                        <button onClick={() => handleSaveSequence(seq.id)} disabled={isSaving}
                                            className="px-8 py-2.5 bg-gradient-to-r from-rvs-red-dark to-rvs-red text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:shadow-[0_0_20px_rgba(211,19,19,0.3)] transition-all flex items-center gap-2 disabled:opacity-50">
                                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Commit Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
