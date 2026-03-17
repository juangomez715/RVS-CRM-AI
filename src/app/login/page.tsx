"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (res.ok) {
                window.location.href = '/dashboard';
            } else {
                const data = await res.json();
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-rvs-dark relative overflow-hidden">
            {/* Background Gradient matching the app */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#910000_0%,#1a1a1a_45%,#0A0A0A_100%)]"></div>

            {/* Glow Effect */}
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-rvs-red-dark rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none animate-pulse"></div>

            <div className="rvs-glass border border-rvs-steel/20 rounded-2xl shadow-2xl p-10 w-full max-w-md relative z-10 flex flex-col pt-12">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black tracking-widest text-white uppercase drop-shadow-lg mb-2">RVS CRM</h1>
                    <p className="text-rvs-steel text-xs font-bold uppercase tracking-widest">Authorized Personnel Only</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-6">
                    {error && (
                        <div className="bg-rvs-red-dark/20 border border-rvs-red-light/50 text-rvs-red-light px-4 py-3 rounded-lg text-sm font-semibold tracking-wide text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-black text-rvs-steel uppercase tracking-widest mb-2">Email Identity</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-rvs-darker/80 border border-rvs-steel/30 rounded-lg p-4 text-sm text-rvs-chrome focus:outline-none focus:border-rvs-red-light focus:ring-1 focus:ring-rvs-red-light transition-all"
                            placeholder="admin@rvs.com or staff@rvs.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-rvs-steel uppercase tracking-widest mb-2">Passcode</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-rvs-darker/80 border border-rvs-steel/30 rounded-lg p-4 text-sm text-rvs-chrome focus:outline-none focus:border-rvs-red-light focus:ring-1 focus:ring-rvs-red-light transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-rvs-red-dark to-rvs-red text-white font-black tracking-widest uppercase py-4 rounded-lg hover:shadow-[0_0_20px_rgba(211,19,19,0.5)] transition-all disabled:opacity-50 mt-4"
                    >
                        {isLoading ? 'Authenticating...' : 'Establish Uplink'}
                    </button>
                </form>

                <p className="text-center text-rvs-steel/50 text-[10px] uppercase font-bold tracking-widest mt-8">
                    System v2.0 - Encrypted Connection
                </p>
            </div>
        </div>
    );
}
