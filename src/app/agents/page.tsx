"use client";
import { useState, useEffect } from 'react';
import { Sparkles, Save, ServerCrash, Database, Cpu, Settings, Activity, Plus, Loader2, Trash2, Cloud, Zap, AlertTriangle } from 'lucide-react';

type Agent = {
    id: string;
    name: string;
    tone: string;
    systemPrompt: string;
    llmModel: string;
    knowledgeBase: string | null;
    isActive: boolean;
};

type OllamaModel = {
    name: string;
    size: string;
    family: string;
};

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [ollamaEnabled, setOllamaEnabled] = useState(false);
    const [togglingOllama, setTogglingOllama] = useState(false);
    const [openrouterConfigured, setOpenrouterConfigured] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [tone, setTone] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [selectedModel, setSelectedModel] = useState('qwen3.5:0.8b');
    const [knowledgeBase, setKnowledgeBase] = useState('');

    // Testing & UI State
    const [testMessage, setTestMessage] = useState('Reply to this lead: "I saw your ad but I am not sure if my clinic is a good fit."');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [agentsRes, modelsRes, statusRes] = await Promise.all([
                    fetch('/api/agents'),
                    fetch('/api/agents/models'),
                    fetch('/api/ai/status'),
                ]);

                if (agentsRes.ok) {
                    const data = await agentsRes.json();
                    setAgents(data);
                    if (data.length > 0) selectAgent(data[0]);
                }

                if (modelsRes.ok) {
                    const data = await modelsRes.json();
                    setModels(data.models || []);
                }

                if (statusRes.ok) {
                    const data = await statusRes.json();
                    setOllamaEnabled(data.ollamaEnabled);
                    setOpenrouterConfigured(data.openrouterConfigured);
                }
            } catch (e) {
                console.error("Failed to load Agents data");
            } finally {
                setIsFetchingData(false);
            }
        };
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectAgent = (agent: Agent) => {
        setSelectedAgentId(agent.id);
        setName(agent.name);
        setTone(agent.tone);
        setSystemPrompt(agent.systemPrompt);
        setSelectedModel(agent.llmModel);
        setKnowledgeBase(agent.knowledgeBase || '');
        setResponse('');
    };

    const handleCreateNew = () => {
        setSelectedAgentId('new');
        setName('New Agent');
        setTone('Neutral');
        setSystemPrompt('You are a helpful assistant.');
        setSelectedModel(models.length > 0 ? models[0].name : 'qwen3.5:0.8b');
        setKnowledgeBase('');
        setResponse('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedAgentId === 'new' ? undefined : selectedAgentId,
                    name, tone, systemPrompt,
                    llmModel: selectedModel,
                    knowledgeBase,
                    isActive: true
                })
            });
            const savedItem = await res.json();

            if (selectedAgentId === 'new') {
                setAgents([savedItem, ...agents]);
                setSelectedAgentId(savedItem.id);
            } else {
                setAgents(agents.map(a => a.id === savedItem.id ? savedItem : a));
            }
        } catch (error) {
            console.error("Failed to save agent", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (agentId: string, agentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete agent "${agentName}"? This cannot be undone.`)) return;

        setDeletingId(agentId);
        try {
            const res = await fetch(`/api/agents?id=${agentId}`, { method: 'DELETE' });
            if (res.ok) {
                const remaining = agents.filter(a => a.id !== agentId);
                setAgents(remaining);
                if (selectedAgentId === agentId) {
                    if (remaining.length > 0) selectAgent(remaining[0]);
                    else setSelectedAgentId(null);
                }
            }
        } catch (error) {
            console.error("Failed to delete agent", error);
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleOllama = async () => {
        setTogglingOllama(true);
        try {
            const res = await fetch('/api/ai/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ollamaEnabled: !ollamaEnabled })
            });
            if (res.ok) {
                const data = await res.json();
                setOllamaEnabled(data.ollamaEnabled);
                // Refresh models if enabling
                if (data.ollamaEnabled) {
                    const modelsRes = await fetch('/api/agents/models');
                    if (modelsRes.ok) {
                        const mdata = await modelsRes.json();
                        setModels(mdata.models || []);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to toggle Ollama", e);
        } finally {
            setTogglingOllama(false);
        }
    };

    const handleTest = async () => {
        setIsLoading(true);
        setResponse('');
        try {
            const finalPrompt = `${systemPrompt}\n\n[Knowledge Base Context]:\n${knowledgeBase}`;
            const res = await fetch('/api/agents/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: finalPrompt, message: testMessage, model: selectedModel })
            });
            const data = await res.json();
            setResponse(res.ok ? data.response : `Error: ${data.error}`);
        } catch (error) {
            setResponse("Fatal Error: Could not connect to the Engine.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetchingData) {
        return (
            <div className="p-8 h-full bg-[#0A0A0A] flex justify-center items-center">
                <Loader2 className="animate-spin text-rvs-red" size={48} />
            </div>
        );
    }

    const activeProvider = ollamaEnabled ? 'ollama' : openrouterConfigured ? 'openrouter' : 'none';

    return (
        <div className="p-8 pb-20 flex flex-col xl:flex-row gap-8">
            {/* Left side: Agents List */}
            <div className="flex-[0.8] flex flex-col h-[calc(100vh-8rem)]">
                <div className="flex justify-between items-end mb-6 border-b border-rvs-steel/20 pb-4 shrink-0">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg">AI Agents</h1>
                        <p className="text-rvs-steel text-sm font-medium">Administrator Tuning Studio</p>
                    </div>
                    <button
                        onClick={handleCreateNew}
                        className="bg-gradient-to-r from-rvs-red-dark to-rvs-red text-white px-5 py-2 rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg shadow-rvs-red-dark/30 hover:shadow-rvs-red-dark/60 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> New Agent
                    </button>
                </div>

                {/* AI Provider Status Bar */}
                <div className={`mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 shrink-0 ${
                    activeProvider === 'openrouter' ? 'bg-blue-500/5 border-blue-500/20' :
                    activeProvider === 'ollama' ? 'bg-emerald-500/5 border-emerald-500/20' :
                    'bg-red-500/5 border-red-500/20'
                }`}>
                    <div className="flex items-center gap-2">
                        {activeProvider === 'openrouter' && <Cloud size={14} className="text-blue-400" />}
                        {activeProvider === 'ollama' && <Zap size={14} className="text-emerald-400" />}
                        {activeProvider === 'none' && <AlertTriangle size={14} className="text-red-400" />}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            activeProvider === 'openrouter' ? 'text-blue-400' :
                            activeProvider === 'ollama' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                            {activeProvider === 'openrouter' && 'OpenRouter (Free Tier) — Cloud AI Active'}
                            {activeProvider === 'ollama' && 'Ollama — Local Inference Active'}
                            {activeProvider === 'none' && 'No AI Provider Configured'}
                        </span>
                    </div>
                    <button
                        onClick={handleToggleOllama}
                        disabled={togglingOllama}
                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded border transition-all flex items-center gap-1 ${
                            ollamaEnabled
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                                : 'bg-white/5 text-rvs-steel border-rvs-steel/20 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                        } disabled:opacity-50`}
                    >
                        {togglingOllama ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                        {ollamaEnabled ? 'Disable Ollama' : 'Enable Ollama'}
                    </button>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1 pb-10 pr-2">
                    {agents.length === 0 && selectedAgentId !== 'new' && (
                        <div className="text-center p-8 bg-rvs-darker border border-rvs-steel/10 rounded-xl">
                            <p className="text-rvs-steel text-sm tracking-widest uppercase mb-2 font-bold">No Agents Found</p>
                            <p className="text-xs text-rvs-steel/60">Create a new agent to get started.</p>
                        </div>
                    )}

                    {selectedAgentId === 'new' && (
                        <div className="rvs-glass p-6 rounded-xl border-l-[4px] border-t-rvs-steel/20 border-r-rvs-steel/20 border-b-rvs-steel/20 border-l-rvs-red shadow-xl">
                            <h3 className="text-xl font-black text-white tracking-widest uppercase mb-1">New Agent*</h3>
                            <p className="text-xs text-rvs-steel/80 italic">Unsaved draft</p>
                        </div>
                    )}

                    {agents.map((agent) => {
                        const isSelected = selectedAgentId === agent.id;
                        return (
                            <div
                                key={agent.id}
                                onClick={() => selectAgent(agent)}
                                className={`rvs-glass p-6 rounded-xl border-l-[4px] ${isSelected ? 'border-t-rvs-steel/20 border-r-rvs-steel/20 border-b-rvs-steel/20 border-l-emerald-400 bg-emerald-500/5' : 'border-rvs-steel/20'} shadow-xl cursor-pointer hover:bg-rvs-red-dark/5 transition-all group`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-black text-white tracking-widest uppercase mb-1 truncate">{agent.name}</h3>
                                        <p className="text-xs text-rvs-steel font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                            Tone: <span className="text-white bg-rvs-dark px-2 py-0.5 rounded">{agent.tone}</span>
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                                            <Cpu size={12} /> {agent.llmModel}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${agent.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-400/30' : 'bg-rvs-darker text-rvs-steel border-rvs-steel/20'}`}>
                                            {agent.isActive ? 'Online' : 'Offline'}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(agent.id, agent.name, e)}
                                            disabled={deletingId === agent.id}
                                            className="text-[9px] font-black uppercase px-2 py-1 rounded border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {deletingId === agent.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right side: Prompt Tuning Studio */}
            <div className="flex-[1.2] rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl flex flex-col h-[calc(100vh-8rem)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-emerald-500 rounded-full mix-blend-screen filter blur-[100px] opacity-5 pointer-events-none"></div>

                <div className="p-8 border-b border-rvs-steel/20 flex flex-col gap-2 shrink-0 relative bg-rvs-darker shadow-md z-10">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-3">
                            <Settings className="text-emerald-400" size={20} /> Tuning Studio
                        </h2>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 text-xs text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-black uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {isSaving ? 'Saving...' : 'Save Config'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar pb-10">

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-3 flex block">Internal Name</label>
                            <input
                                type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-black/50 text-white text-sm font-mono border border-rvs-steel/20 rounded p-3 focus:border-emerald-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-3 flex block">Response Tone</label>
                            <input
                                type="text" value={tone} onChange={e => setTone(e.target.value)}
                                placeholder="e.g. Formal, Friendly, Consultative"
                                className="w-full bg-black/50 text-white text-sm font-mono border border-rvs-steel/20 rounded p-3 focus:border-emerald-400 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-5">
                        <label className="text-xs font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Cpu size={16} className="text-emerald-400" /> Language Model
                            {ollamaEnabled && models.length > 0 ? (
                                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-black ml-2">Ollama Connected</span>
                            ) : (
                                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-black ml-2">OpenRouter (Cloud)</span>
                            )}
                        </label>
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-black text-white text-sm font-mono border border-emerald-500/30 rounded p-3 focus:border-emerald-400 focus:outline-none shadow-inner"
                        >
                            {ollamaEnabled && models.length > 0 ? (
                                models.map((m) => (
                                    <option key={m.name} value={m.name}>{m.name} ({m.size}) — Local</option>
                                ))
                            ) : (
                                <>
                                    <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free) — OpenRouter</option>
                                    <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free) — OpenRouter</option>
                                    <option value="google/gemma-2-9b-it:free">Gemma 2 9B (Free) — OpenRouter</option>
                                    <option value="qwen/qwen-2-7b-instruct:free">Qwen2 7B (Free) — OpenRouter</option>
                                </>
                            )}
                        </select>
                        <p className="mt-2 text-xs text-rvs-steel/60 font-mono">
                            {ollamaEnabled ? 'Local inference — requires Ollama running at localhost:11434' : 'Cloud inference via OpenRouter free tier — no local GPU needed'}
                        </p>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label className="block text-xs font-black text-rvs-steel uppercase tracking-widest mb-3">
                            System Core (Instruction Prompt)
                        </label>
                        <textarea
                            value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                            className="w-full bg-black/30 border border-rvs-steel/30 rounded-lg p-4 text-sm text-rvs-chrome focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 resize-none h-32 font-mono"
                            placeholder="Inject personality directives..."
                        />
                    </div>

                    {/* Knowledge Base */}
                    <div>
                        <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-3 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Database size={14} className="text-blue-400" /> RAG Knowledge Base</span>
                            <span className="text-[10px] text-blue-300 font-bold px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/20">Context Injection</span>
                        </label>
                        <textarea
                            value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)}
                            className="w-full bg-black/20 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-100 focus:outline-none focus:border-blue-400 resize-none h-24 font-mono"
                            placeholder="Provide product specs, FAQ, or training data so the AI knows how to reply accurately."
                        />
                    </div>

                    {/* Testing Area */}
                    <div className="bg-rvs-darker/80 p-6 rounded-lg border border-purple-500/20 mt-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 rounded-full mix-blend-screen filter blur-[60px] opacity-10 pointer-events-none"></div>

                        <label className="block text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-purple-500/20 pb-3">
                            <Sparkles size={16} /> Inference Debugger Sandbox
                        </label>

                        <label className="block text-[10px] font-black text-rvs-steel uppercase tracking-widest mb-2">Simulated Lead Message:</label>
                        <textarea
                            value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
                            className="w-full bg-black/80 border border-rvs-steel/20 rounded-lg p-3 text-sm text-white focus:outline-none resize-none h-20 font-mono mb-4 focus:border-purple-400"
                        />

                        <button
                            onClick={handleTest} disabled={isLoading}
                            className="w-full bg-purple-600 text-white font-black tracking-widest uppercase py-3 rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 flex justify-center items-center gap-3 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-400/50"
                        >
                            {isLoading ? <><Loader2 size={16} className="animate-spin" /> Querying Model...</> : <><ServerCrash size={16} /> Execute Test Generation</>}
                        </button>
                    </div>

                    {/* Output */}
                    <div className="pt-2">
                        <label className="block text-xs font-black text-rvs-steel uppercase tracking-widest mb-2 border-b border-rvs-steel/10 pb-2 flex justify-between">
                            Agent Output Stream
                            {isLoading && <span className="text-purple-400 flex items-center gap-1"><Sparkles size={12} className="animate-pulse" /> Connecting...</span>}
                        </label>
                        <div className={`w-full bg-black/80 border rounded-lg p-5 text-sm font-mono min-h-[120px] whitespace-pre-wrap leading-relaxed shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] ${isLoading ? 'animate-pulse text-rvs-steel border-rvs-steel/20' : 'text-emerald-400 border-emerald-500/30 font-bold'}`}>
                            {response || <span className="text-rvs-steel/30 italic opacity-50 font-sans">Signal awaiting execution...</span>}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
