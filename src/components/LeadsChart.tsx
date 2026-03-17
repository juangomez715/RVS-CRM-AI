"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
    data: { name: string; leads: number }[];
}

export function LeadsChart({ data }: Props) {
    return (
        <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={data}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D31313" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#D31313" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333333" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#757575', fontSize: 12, fontWeight: 'bold' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#757575', fontSize: 12, fontWeight: 'bold' }} dx={-10} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#121212', borderRadius: '8px', border: '1px solid #333', color: '#fff' }}
                        itemStyle={{ color: '#D31313', fontWeight: 'bold' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="leads"
                        stroke="#D31313"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorLeads)"
                        activeDot={{ r: 6, fill: '#FF4D4D', strokeWidth: 0 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
