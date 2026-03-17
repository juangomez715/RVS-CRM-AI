"use client";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Settings2, Webhook, Bot, Mail, Key, CheckCircle2, XCircle, Linkedin, Shield, Loader2, Save, PlayCircle, SendHorizontal } from 'lucide-react';

export default function SettingsPage() {
    const searchParams = useSearchParams();

    // Status Loading
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Gmail OAuth state
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailEmail, setGmailEmail] = useState('');
    const [gmailMessage, setGmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form states - SMTP Mailbox
    const [mailboxConnected, setMailboxConnected] = useState(false);
    const [smtpHost, setSmtpHost] = useState("");
    const [smtpPort, setSmtpPort] = useState("465");
    const [smtpSecure, setSmtpSecure] = useState(true);
    const [smtpUser, setSmtpUser] = useState("");
    const [smtpPass, setSmtpPass] = useState("");
    const [smtpError, setSmtpError] = useState("");

    // Form states - LinkedIn
    const [linkedinConnected, setLinkedinConnected] = useState(false);
    const [liCookie, setLiCookie] = useState("");
    const [linkedinError, setLinkedinError] = useState("");

    // Deliverability Settings
    const [dailyLimit, setDailyLimit] = useState(150);
    const [warmingActive, setWarmingActive] = useState(true);
    const [delayMin, setDelayMin] = useState(3);
    const [delayMax, setDelayMax] = useState(7);

    // Handle OAuth callback result from URL params
    useEffect(() => {
        const gmailStatus = searchParams.get('gmail');
        const email = searchParams.get('email');
        if (gmailStatus === 'success' && email) {
            setGmailMessage({ type: 'success', text: `Gmail connected: ${email}` });
            setTimeout(() => setGmailMessage(null), 5000);
        } else if (gmailStatus === 'error') {
            const reason = searchParams.get('reason') || 'unknown';
            setGmailMessage({ type: 'error', text: `Gmail connection failed: ${reason}` });
            setTimeout(() => setGmailMessage(null), 6000);
        }
    }, [searchParams]);

    // Initial load configs
    useEffect(() => {
        const fetchIntegrations = async () => {
            try {
                const res = await fetch('/api/integrations');
                const data = await res.json();

                if (Array.isArray(data)) {
                    const mail = data.find(i => i.provider === 'smtp');
                    const linkedin = data.find(i => i.provider === 'linkedin');
                    const gmail = data.find(i => i.provider === 'gmail');
                    if (gmail?.isActive) {
                        setGmailConnected(true);
                        setGmailEmail(gmail.accountId || '');
                    }

                    if (mail) {
                        setMailboxConnected(mail.isActive);
                        if (mail.metadata) {
                            const meta = JSON.parse(mail.metadata);
                            setSmtpHost(meta.host || '');
                            setSmtpPort(meta.port ? String(meta.port) : '465');
                            setSmtpSecure(meta.secure ?? true);
                            setSmtpUser(meta.username || '');
                            setSmtpPass(meta.password ? '*************' : ''); // Hide actual password

                            setDailyLimit(meta.dailyLimit || 150);
                            setWarmingActive(meta.warmingActive ?? true);
                            setDelayMin(meta.delayMin || 3);
                            setDelayMax(meta.delayMax || 7);
                        }
                    }

                    if (linkedin) {
                        setLinkedinConnected(linkedin.isActive);
                        if (linkedin.accessToken) {
                            setLiCookie('*************'); // Mask the li_at cookie visually
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load integrations");
            } finally {
                setIsLoading(false);
            }
        };
        fetchIntegrations();
    }, []);

    const handleDisconnectGmail = async () => {
        if (!confirm('Disconnect Gmail? Email sending will fall back to SMTP.')) return;
        setIsSaving(true);
        try {
            await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'gmail', isActive: false }),
            });
            setGmailConnected(false);
            setGmailEmail('');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyWebhook = () => {
        navigator.clipboard.writeText("http://localhost:3000/api/webhooks/n8n");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTestAndSaveSMTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSmtpError("");

        // If password is still masked from load, we alert them to type the real one if they intend to save over it
        if (smtpPass === '*************') {
            setSmtpError("Please enter the actual App Password to test & re-save.");
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/integrations/verify_smtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    username: smtpUser,
                    password: smtpPass
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMailboxConnected(true);
                setSmtpPass('*************'); // Mask visually again after success
            } else {
                setSmtpError(data.error || "Failed to establish SMTP connection.");
                setMailboxConnected(false);
            }
        } catch (error) {
            setSmtpError("Network error while verifying SMTP.");
            setMailboxConnected(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDisconnectSMTP = async () => {
        if (!confirm("Are you sure you want to completely disconnect your SMTP mapping? Campaigns will fail.")) return;
        setIsSaving(true);
        try {
            await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'smtp', isActive: false })
            });
            setMailboxConnected(false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConnectLinkedIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (liCookie === '*************') return;

        setIsSaving(true);
        setLinkedinError("");
        try {
            const res = await fetch('/api/integrations/linkedin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ liAt: liCookie })
            });
            const data = await res.json();
            if (res.ok) {
                setLinkedinConnected(true);
                setLiCookie('*************');
            } else {
                setLinkedinError(data.error || "Failed to verify LinkedIn session.");
                setLinkedinConnected(false);
            }
        } catch (e) {
            setLinkedinError("Network error while saving LinkedIn session.");
            setLinkedinConnected(false);
        } finally {
            setIsSaving(false);
        }
    };

    const saveDeliverySettings = async () => {
        if (!mailboxConnected) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/integrations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'smtp',
                    settings: { dailyLimit, delayMin, delayMax, warmingActive }
                })
            });
            if (!res.ok) throw new Error('Failed to save');
        } catch (e) {
            console.error('Failed to save delivery settings');
        } finally {
            setIsSaving(false);
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
            <div className="mb-8 border-b border-rvs-steel/20 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase items-center flex gap-3">
                        <Settings2 className="text-rvs-red-light" size={32} /> Central Integrations
                    </h1>
                    <p className="text-rvs-steel text-sm font-bold uppercase tracking-widest mt-2">
                        Manage your infrastructure connections and APIs
                    </p>
                </div>
                {isSaving && (
                    <span className="flex items-center gap-2 text-xs text-emerald-400 uppercase tracking-widest font-black">
                        <Loader2 className="animate-spin" size={14} /> Synchronizing Node...
                    </span>
                )}
            </div>

            {/* Gmail OAuth status toast */}
            {gmailMessage && (
                <div className={`mb-6 flex items-center gap-3 px-5 py-3 rounded-xl border font-black text-xs uppercase tracking-widest ${gmailMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                    {gmailMessage.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {gmailMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* 0. GMAIL OAUTH */}
                <div className="rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl relative overflow-hidden flex flex-col xl:col-span-2">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-red-500 rounded-full mix-blend-screen filter blur-[120px] opacity-10 pointer-events-none"></div>
                    <div className="p-6 border-b border-rvs-steel/20 flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${gmailConnected ? 'bg-emerald-500/10' : 'bg-rvs-dark'} shadow-inner`}>
                                <svg className={`w-6 h-6 ${gmailConnected ? 'text-emerald-400' : 'text-rvs-steel'}`} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.910 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1">Gmail — OAuth 2.0</h2>
                                <p className="text-xs text-rvs-steel/80">Connect your Gmail account securely. No passwords stored — uses Google OAuth.</p>
                            </div>
                        </div>
                        {gmailConnected ? (
                            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 size={12} /> Connected
                            </span>
                        ) : (
                            <span className="bg-rvs-red-dark/10 border border-rvs-red/30 text-rvs-red px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <XCircle size={12} /> Not Connected
                            </span>
                        )}
                    </div>

                    <div className="p-6 flex items-center justify-between gap-6 flex-wrap">
                        {gmailConnected ? (
                            <>
                                <div>
                                    <p className="text-[10px] text-rvs-steel uppercase tracking-widest font-black mb-1">Connected Account</p>
                                    <p className="text-white font-mono text-sm">{gmailEmail}</p>
                                    <p className="text-[10px] text-emerald-400/70 mt-1 uppercase tracking-widest">All outbound emails will route through Gmail API. Inbox replies sync automatically.</p>
                                </div>
                                <button onClick={handleDisconnectGmail} disabled={isSaving} className="px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                    <XCircle size={14} /> Disconnect Gmail
                                </button>
                            </>
                        ) : (
                            <>
                                <div>
                                    <p className="text-[10px] text-rvs-steel uppercase tracking-widest font-black mb-1">How it works</p>
                                    <p className="text-xs text-rvs-chrome/70 max-w-lg leading-relaxed">Click Connect and authorize with your Google account. Emails will be sent via Gmail API (not SMTP) and incoming replies from leads will sync automatically to your Inbox.</p>
                                </div>
                                <a href="/api/auth/google" className="px-6 py-3 bg-white text-gray-900 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-3 hover:bg-gray-100 transition-all shadow-lg whitespace-nowrap">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Connect with Google
                                </a>
                            </>
                        )}
                    </div>
                </div>

                {/* 1. Real SMTP EMAIL AUTHENTICATION */}
                <div className="rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10 pointer-events-none"></div>

                    <div className="p-6 border-b border-rvs-steel/20 flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${mailboxConnected ? 'bg-emerald-500/10' : 'bg-rvs-dark'} shadow-inner`}>
                                <SendHorizontal size={24} className={mailboxConnected ? 'text-emerald-400' : 'text-blue-400'} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-1">SMTP Secure Mailbox</h2>
                                <p className="text-xs text-rvs-steel/80">Google Workspace, Microsoft 365, Zoho Mail Support</p>
                            </div>
                        </div>
                        {mailboxConnected ? (
                            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 size={12} /> Connected & Verified
                            </span>
                        ) : (
                            <span className="bg-rvs-red-dark/10 border border-rvs-red/30 text-rvs-red px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                <XCircle size={12} /> Disconnected
                            </span>
                        )}
                    </div>

                    <div className="flex-1 p-6 z-10 space-y-4">
                        {smtpError && (
                            <div className="text-[10px] font-black tracking-widest uppercase bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded flex items-center gap-2 mb-2">
                                <XCircle size={14} /> {smtpError}
                            </div>
                        )}
                        <form onSubmit={handleTestAndSaveSMTP} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-rvs-steel uppercase tracking-widest block mb-1">SMTP Host (e.g. smtp.gmail.com)</label>
                                <input type="text" required value={smtpHost} onChange={e => setSmtpHost(e.target.value)} disabled={mailboxConnected} className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-400 disabled:opacity-50 font-mono" />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-[0.4]">
                                    <label className="text-[10px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Port</label>
                                    <input type="number" required value={smtpPort} onChange={e => setSmtpPort(e.target.value)} disabled={mailboxConnected} className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-400 disabled:opacity-50 font-mono" />
                                </div>
                                <div className="flex-[0.6] flex items-end mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-white hover:text-blue-400 uppercase tracking-widest transition-colors mb-1">
                                        <input type="checkbox" checked={smtpSecure} onChange={e => setSmtpSecure(e.target.checked)} disabled={mailboxConnected} className="w-4 h-4 accent-blue-500" />
                                        Secure (SSL/TLS)
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-rvs-steel uppercase tracking-widest block mb-1">Email / Username</label>
                                <input type="text" required value={smtpUser} onChange={e => setSmtpUser(e.target.value)} disabled={mailboxConnected} className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-400 disabled:opacity-50 font-mono" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-rvs-steel uppercase tracking-widest block mb-1">16-Digit App Password</label>
                                <input type="password" required value={smtpPass} onChange={e => setSmtpPass(e.target.value)} disabled={mailboxConnected} className="w-full bg-black/60 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-400 disabled:opacity-50 font-mono" />
                                <p className="text-[8px] mt-1 text-rvs-chrome/50 font-mono uppercase">Must use 2FA App Passwords for Google/Microsoft, not your default password.</p>
                            </div>

                            <div className="pt-4 border-t border-rvs-steel/10 flex justify-end gap-3 mt-6">
                                {mailboxConnected ? (
                                    <button type="button" onClick={handleDisconnectSMTP} className="px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-500/20 transition-all">
                                        <XCircle size={14} /> Disconnect Transport
                                    </button>
                                ) : (
                                    <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 transition-all shadow-lg disabled:opacity-50 mb-1">
                                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <PlayCircle size={14} />} Verify & Connect Node
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* Tracking & Data Flow Panel */}
                <div className="space-y-8 flex flex-col">

                    {/* Deliverability Engine */}
                    <div className="rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl p-6 relative overflow-hidden flex-1">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full mix-blend-screen filter blur-[80px] opacity-10 pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-6 border-b border-rvs-steel/20 pb-4">
                            <Shield className="text-emerald-400" size={24} />
                            <div>
                                <h2 className="text-base font-black text-white uppercase tracking-widest mb-1">Deliverability Shield</h2>
                                <p className="text-[10px] text-rvs-steel font-mono uppercase">Warmup & Throttle Control via mailer.ts</p>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-4 bg-black/40 border border-rvs-steel/20 rounded-lg">
                                    <label className="text-[10px] font-black text-rvs-steel uppercase tracking-widest flex items-center justify-between mb-3">
                                        Daily Outbound Target
                                        <span className="text-emerald-400">{dailyLimit} Emails</span>
                                    </label>
                                    <input type="range" min="10" max="500" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} className="w-full accent-emerald-500" />
                                </div>

                                <label className="p-4 bg-black/40 border border-rvs-steel/20 rounded-lg flex flex-col justify-center gap-2 cursor-pointer hover:border-emerald-500/30 transition-colors">
                                    <span className="text-[10px] font-black text-rvs-steel uppercase tracking-widest">Automatic Internal Warming</span>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={warmingActive} onChange={e => setWarmingActive(e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                                        <span className={`text-xs font-black uppercase ${warmingActive ? 'text-emerald-400' : 'text-rvs-steel'}`}>
                                            {warmingActive ? 'Active Protocol' : 'Disabled'}
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div className="p-4 bg-black/40 border border-rvs-steel/20 rounded-lg">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Randomized Human Simulation Delay (Minutes)</h4>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-rvs-steel block mb-1">MINIMUM REST</label>
                                        <input type="number" value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} className="w-full bg-black/80 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none font-mono" />
                                    </div>
                                    <span className="text-rvs-steel mt-5">-</span>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-rvs-steel block mb-1">MAXIMUM REST</label>
                                        <input type="number" value={delayMax} onChange={e => setDelayMax(Number(e.target.value))} className="w-full bg-black/80 border border-rvs-steel/30 rounded p-2 text-sm text-white focus:outline-none font-mono" />
                                    </div>
                                </div>
                                <p className="text-[8px] text-rvs-chrome/50 font-mono mt-3">The Engine pauses at random intervals mimicking human workers to protect SMTP reputation algorithms.</p>
                            </div>

                            <button onClick={saveDeliverySettings} disabled={!mailboxConnected} className="w-full mt-4 flex justify-center items-center gap-2 px-5 py-3 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg font-black tracking-widest text-xs uppercase transition-colors disabled:opacity-50">
                                <Save size={14} /> Refresh Engine Metrics
                            </button>
                        </div>
                    </div>

                    {/* LinkedIn Bypass */}
                    <div className="rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl p-6 relative overflow-hidden h-fit shrink-0">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-[#0A66C2] rounded-full mix-blend-screen filter blur-[80px] opacity-10 pointer-events-none"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <Linkedin className="text-[#0A66C2]" size={20} />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">LinkedIn Proxy Session</h2>
                        </div>
                        <p className="text-[10px] text-rvs-steel uppercase tracking-widest mb-4 font-mono leading-relaxed">
                            To avoid detection and bans, inject your <span className="text-[#0A66C2] bg-[#0A66C2]/10 px-1 rounded font-black">li_at</span> browser cookie to power the headless web scraping logic.
                        </p>

                        <form onSubmit={handleConnectLinkedIn} className="flex flex-col gap-3">
                            <input
                                type="text" placeholder="li_at Header Cookie Value"
                                value={liCookie} onChange={e => setLiCookie(e.target.value)}
                                disabled={linkedinConnected}
                                className="w-full bg-black/80 border border-rvs-steel/30 rounded p-3 text-sm text-white focus:outline-none focus:border-[#0A66C2] font-mono shadow-inner disabled:opacity-50"
                            />
                            {linkedinConnected ? (
                                <div className="flex justify-between items-center bg-[#0A66C2]/10 border border-[#0A66C2]/30 text-[#0A66C2] p-2 rounded-lg">
                                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-2"><CheckCircle2 size={12} /> Cookie active</span>
                                    <button type="button" onClick={async () => {
                                        await fetch('/api/integrations', { method: 'POST', body: JSON.stringify({ provider: 'linkedin', isActive: false }) });
                                        setLinkedinConnected(false); setLiCookie("");
                                    }} className="text-[10px] font-black uppercase px-3 hover:text-white transition-colors">REVOKE</button>
                                </div>
                            ) : (
                                <button type="submit" disabled={isSaving || !liCookie} className="w-full py-2 bg-[#0A66C2] text-white text-[10px] font-black uppercase tracking-widest rounded shadow-lg hover:bg-[#004182] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                    <Key size={12} /> Encrypt & Mount Session
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Ingestion Webhook URL */}
                    <div className="rvs-card border border-rvs-steel/20 rounded-xl shadow-2xl p-6 h-fit shrink-0 bg-rvs-darker">
                        <div className="flex items-center gap-3 mb-4">
                            <Webhook className="text-purple-400" size={20} />
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">n8n Ingestion Webhook</h2>
                        </div>
                        <p className="text-[10px] text-rvs-steel uppercase tracking-widest mb-2 font-mono">POST Payload JSON Payload format to this exact path:</p>
                        <div className="flex gap-2">
                            <input type="text" readOnly value="http://localhost:3000/api/webhooks/n8n" className="flex-1 bg-black text-purple-200 border border-purple-500/30 rounded p-2 text-xs font-mono select-all focus:outline-none" />
                            <button onClick={handleCopyWebhook} className="bg-purple-600 hover:bg-purple-500 transition-colors text-white px-4 py-2 rounded font-bold uppercase tracking-widest text-[#10px] shadow-lg flex items-center gap-1">
                                {copied ? <CheckCircle2 size={14} /> : "Copy"}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
