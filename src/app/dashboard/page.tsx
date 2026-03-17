import prisma from '@/lib/db';
import { LeadsChart } from '@/components/LeadsChart';
import { Activity, MailCheck, ShieldCheck, Target } from 'lucide-react';

export default async function DashboardPage() {
    const totalLeads = await prisma.lead.count();
    const totalAgents = await prisma.agent.count({ where: { isActive: true } });
    const outreachSent = await prisma.interaction.count({
        where: { sender: { in: ['AI', 'HUMAN', 'AI_AUTOMATION'] } }
    });
    const qualifiedLeads = await prisma.lead.count({ where: { status: 'Qualified' } });

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
            where: {
                createdAt: {
                    gte: dateStart,
                    lt: dateEnd
                }
            }
        });

        const dayName = dateStart.toLocaleDateString('en-US', { weekday: 'short' });
        chartData.push({ name: dayName, leads: count });
    }

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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Total Leads */}
                <div className="rvs-card p-6 rounded-xl shadow-2xl relative overflow-hidden group border border-blue-500/20 bg-blue-500/5">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400 group-hover:h-full transition-all duration-500 opacity-10"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Sourced Leads</h3>
                        <Target size={16} className="text-blue-500" />
                    </div>
                    <p className="text-4xl font-black text-white relative z-10">{totalLeads}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-rvs-steel">
                        <span>System Total</span>
                        <span className="text-blue-400">{qualifiedLeads} Qualified</span>
                    </div>
                </div>

                {/* Active Agents */}
                <div className="rvs-card p-6 rounded-xl shadow-2xl relative overflow-hidden group border border-emerald-500/20 bg-emerald-500/5">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-emerald-400 group-hover:h-full transition-all duration-500 opacity-10"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Active AI Agents</h3>
                        <ShieldCheck size={16} className="text-emerald-500" />
                    </div>
                    <p className="text-4xl font-black text-white relative z-10">{totalAgents}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-rvs-steel">
                        <span>Ollama Inference Node</span>
                        <span className="text-emerald-400">Online</span>
                    </div>
                </div>

                {/* Outreach / Emails Sent */}
                <div className="rvs-card p-6 rounded-xl shadow-2xl relative overflow-hidden group border border-purple-500/20 bg-purple-500/5">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-purple-400 group-hover:h-full transition-all duration-500 opacity-10"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest">Sent Transmissions</h3>
                        <MailCheck size={16} className="text-purple-500" />
                    </div>
                    <p className="text-4xl font-black text-white relative z-10">{outreachSent}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-purple-500/20 text-[10px] font-black uppercase tracking-widest text-rvs-steel">
                        <span>SMTP Shield Envelope</span>
                        <span className="text-purple-400">Routed</span>
                    </div>
                </div>

                {/* Score Avg / Velocity */}
                <div className="rvs-card p-6 rounded-xl shadow-2xl relative overflow-hidden group border border-orange-500/20 bg-orange-500/5">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-orange-400 group-hover:h-full transition-all duration-500 opacity-10"></div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xs font-black text-orange-400 uppercase tracking-widest">Lead Qualification Rate</h3>
                        <Activity size={16} className="text-orange-500" />
                    </div>
                    <p className="text-4xl font-black text-white relative z-10">{totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0}%</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-orange-500/20 text-[10px] font-black uppercase tracking-widest text-rvs-steel">
                        <span>AI Inference Graded</span>
                        <span className="text-orange-400">Realtime</span>
                    </div>
                </div>
            </div>

            <div className="rvs-card p-8 rounded-xl shadow-2xl border border-rvs-steel/20 mt-8 relative overflow-hidden bg-black/60">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10 pointer-events-none"></div>
                <div className="relative z-10">
                    <h2 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center gap-2">
                        <Target size={14} className="text-blue-400" /> 7-Day Inbound Generation Velocity
                    </h2>
                    <LeadsChart data={chartData} />
                </div>
            </div>
        </div>
    );
}
