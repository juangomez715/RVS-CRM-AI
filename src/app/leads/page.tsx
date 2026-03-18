import LeadsClient from './LeadsClient';

export default function LeadsPage() {
    // Client fetches paginated data directly — no server-side pre-load
    // This prevents loading 1M+ leads into memory on initial render
    return <LeadsClient leads={[]} />;
}
