import prisma from '@/lib/db';
import { LeadsChart } from '@/components/LeadsChart';
import { Activity, MailCheck, ShieldCheck, Target, Users, MessageSquare, Calendar, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
    const totalLeads = await prisma.lead.count();
    const totalAgents = await prisma.agent.count({ where: { isActive: true } });
    const outreachSent = await prisma.interaction.count({
        where: { sender: { in: ['AI', 'HUMAN', 'AI_AUTOMATION'] } }
    });

    // Lead funnel metrics
    const newLeads = await prisma.lead.count({ where: { status: 'New' } });
    const contactedLeads = await prisma.lead.count({ where: { status: 'Contacted' } });
    const qualifiedLeads = await prisma.lead.count({ where: { status: 'Qualified' } });
    const meetingLeads = await prisma.lead.count({ where: { status: 'Meeting' } });
    const closedLeads = await prisma.lead.count({ where: { status: 'Closed' } });

    // Responded = leads that replied (have at least one LEAD-sender interaction)
    const respondedLeads = await prisma.lead.count({
        where: { interactions: { some: { sender: 'LEAD' } } }
    });

    // Source breakdown
    const sourceBreakdown = await prisma.lead.groupBy({
        by: ['source'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
    });

    // Calculate Last 7 Days Lead Generation dynamically
    const today = new Date();
    const chartData = [];

    for (let i = 6; i >= 0; i--) {
        const dateStart = new Date(today);
        dateStart.setDate(today.getDate() - i);
        dateStart.setHours(0, 0, 0, 0);

        const dateEnd = new Date(dateStart);
        dateEnd.setHours(23, 59, 59, 999);

        const count = await prisma.lead.count({
            where: { createdAt: { gte: dateStart, lt: dateEnd } }
        });

        const dayName = dateStart.toLocaleDateString('en-US', { weekday: 'short' });
        chartData.push({ name: dayName, leads: count });
    }

    const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;
    const responseRate = contactedLeads > 0 ? Math.round((respondedLeads / contactedLeads) * 100) : 0;

    return (
        <div className="p-8 pb-20 overflow-y-auto h-full custom-scrollbar bg-[#0A0A0A]">
            <div className="flex justify-between items-end mb-8 border-b border-rvs-steel/20 pb-4">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg flex items-center gap-3">
                        <Activity className="text-rvs-red-light" size={32} /> Central Metrics
                    </h1>
                    <p className="text-rvs-steel text-sm font-bold uppercase tracking-widest mt-2">Live Production Analytics Data</p>
                </div>
            </div>

            {/* Top KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="rvs-card p-5 rounded-xl shadow-2xl relative overflow-hidden border border-blue-500/20 bg-blue-500/5">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Leads</h3>
                        <Target size={14} className="text-blue-500" />
                    </div>
                    <p className="text-4xl font-black text-white">{totalLeads.toLocaleString()}</p>
                    <p className="text-[9px] text-rvs-steel uppercase tracking-widest mt-2 pt-2 border-t border-blue-500/20">System Total</p>
                </div>
                <div className="rvs-card p-5 rounded-xl shadow-2xl relative overflow-hidden border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Agents</h3>
                        <ShieldCheck size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-4xl font-black text-white">{totalAgents}</p>
                    <p className="text-[9px] text-emerald-400 uppercase tracking-widest mt-2 pt-2 border-t border-emerald-500/20">AI Online</p>
                </div>
                <div className="rvs-card p-5 rounded-xl shadow-2xl relative overflow-hidden border border-purple-500/20 bg-purple-500/5">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Emails Sent</h3>
                        <MailCheck size={14} className="text-purple-500" />
                    </div>
                    <p className="text-4xl font-black text-white">{outreachSent.toLocaleString()}</p>
                    <p className="text-[9px] text-rvs-steel uppercase tracking-widest mt-2 pt-2 border-t border-purple-500/20">SMTP Routed</p>
                </div>
                <div className="rvs-card p-5 rounded-xl shadow-2xl relative overflow-hidden border border-orange-500/20 bg-orange-500/5">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Conversion Rate</h3>
                        <TrendingUp size={14} className="text-orange-500" />
                    </div>
                    <p className="text-4xl font-black text-white">{conversionRate}%</p>
                    <p className="text-[9px] text-rvs-steel uppercase tracking-widest mt-2 pt-2 border-t border-orange-500/20">{closedLeads} Closed</p>
                </div>
            </div>

            {/* Lead Funnel */}
            <div className="rvs-card p-6 rounded-xl shadow-2xl border border-rvs-steel/20 mb-6 bg-black/60">
                <h2 className="text-xs font-black text-white tracking-widest uppercase mb-5 flex items-center gap-2">
                    <Users size={14} className="text-rvs-red-light" /> Lead Conversion Funnel
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {[
                        { label: 'New', count: newLeads, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
                        { label: 'Contacted', count: contactedLeads, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
                        { label: 'Responded', count: respondedLeads, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' },
                        { label: 'Qualified', count: qualifiedLeads, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                        { label: 'Meeting', count: meetingLeads, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
                        { label: 'Closed', count: closedLeads, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
                    ].map(({ label, count, color, bg }) => (
                        <div key={label} className={`p-4 rounded-xl border ${bg} text-center`}>
                            <p className={`text-3xl font-black ${color}`}>{count.toLocaleString()}</p>
                            <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${color} opacity-80`}>{label}</p>
                            {totalLeads > 0 && (
                                <p className="text-[8px] text-rvs-steel/60 mt-1">{Math.round((count / totalLeads) * 100)}%</p>
                            )}
                        </div>
                    ))}
                </div>
                {contactedLeads > 0 && (
                    <div className="mt-4 pt-4 border-t border-rvs-steel/10 flex gap-6 text-[10px] font-black uppercase tracking-widest">
                        <span className="text-cyan-400">Response Rate: {responseRate}%</span>
                        <span className="text-purple-400">Meeting Rate: {contactedLeads > 0 ? Math.round((meetingLeads / contactedLeads) * 100) : 0}%</span>
                        <span className="text-orange-400">Close Rate: {qualifiedLeads > 0 ? Math.round((closedLeads / qualifiedLeads) * 100) : 0}%</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* 7-Day Chart */}
                <div className="xl:col-span-2 rvs-card p-8 rounded-xl shadow-2xl border border-rvs-steel/20 relative overflow-hidden bg-black/60">
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10">
                        <h2 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center gap-2">
                            <Target size={14} className="text-blue-400" /> 7-Day Inbound Generation Velocity
                        </h2>
                        <LeadsChart data={chartData} />
                    </div>
                </div>

                {/* Source Breakdown */}
                <div className="rvs-card p-6 rounded-xl shadow-2xl border border-rvs-steel/20 bg-black/60">
                    <h2 className="text-xs font-black text-white tracking-widest uppercase mb-5 flex items-center gap-2">
                        <MessageSquare size={14} className="text-rvs-red-light" /> Lead Sources
                    </h2>
                    <div className="space-y-3">
                        {sourceBreakdown.length === 0 ? (
                            <p className="text-[10px] text-rvs-steel/40 uppercase tracking-widest">No data yet</p>
                        ) : sourceBreakdown.map((s) => {
                            const pct = totalLeads > 0 ? Math.round((s._count.id / totalLeads) * 100) : 0;
                            return (
                                <div key={s.source || 'unknown'}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{s.source || 'unknown'}</span>
                                        <span className="text-[10px] font-black text-rvs-steel">{s._count.id.toLocaleString()} ({pct}%)</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-rvs-red-dark to-rvs-red rounded-full" style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-5 pt-4 border-t border-rvs-steel/10">
                        <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-rvs-steel" />
                            <span className="text-[9px] font-black text-rvs-steel uppercase tracking-widest">Today: {chartData[chartData.length - 1]?.leads || 0} new leads</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
