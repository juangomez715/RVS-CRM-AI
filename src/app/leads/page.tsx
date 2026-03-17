import prisma from '@/lib/db';
import LeadsClient from './LeadsClient';

export default async function LeadsPage() {
    const leads = await prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
    });

    return <LeadsClient leads={leads} />;
}
