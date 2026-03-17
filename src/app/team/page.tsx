"use client";
import { useState, useEffect } from 'react';
import { Shield, KeyRound, UserPlus, Users, Pencil, Trash2, Check, X, Loader2, AlertTriangle } from 'lucide-react';

type UserAccount = {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
};

export default function TeamPage() {
    const [users, setUsers] = useState<UserAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Form inputs
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("STAFF");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const loadUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                setErrorMsg("Unauthorized. You must be an administrator.");
            }
        } catch (error) {
            setErrorMsg("Failed to connect to directory.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const resetForm = () => {
        setEditingUser(null);
        setName("");
        setEmail("");
        setRole("STAFF");
        setPassword("");
        setConfirmPassword("");
        setErrorMsg("");
        setShowModal(false);
    };

    const handleEdit = (u: UserAccount) => {
        setEditingUser(u);
        setName(u.name);
        setEmail(u.email);
        setRole(u.role);
        setPassword("");
        setConfirmPassword("");
        setShowModal(true);
    };

    const handleDelete = async (id: string, currentRole: string) => {
        if (currentRole === 'ADMIN' && users.filter(u => u.role === 'ADMIN').length === 1) {
            alert("Cannot delete the last remaining internal ADMIN account.");
            return;
        }

        if (confirm("Permanently revoke and delete this account?")) {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== id));
            } else {
                const err = await res.json();
                alert(err.error);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!editingUser && (!password || password !== confirmPassword)) {
            setErrorMsg("Passwords must match for new accounts.");
            return;
        }

        if (editingUser && password && password !== confirmPassword) {
            setErrorMsg("New passwords do not match.");
            return;
        }

        const payload = { name, email, role, password };

        if (editingUser) {
            // Update mode
            const res = await fetch(`/api/users/${editingUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                loadUsers();
                resetForm();
            } else {
                setErrorMsg("Failed to update user.");
            }
        } else {
            // Create mode
            const res = await fetch(`/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                loadUsers();
                resetForm();
            } else {
                const err = await res.json();
                setErrorMsg(err.error || "Failed to create user.");
            }
        }
    };

    return (
        <div className="p-8 h-full bg-[#0A0A0A] overflow-y-auto w-full custom-scrollbar">
            <div className="mb-8 border-b border-rvs-steel/20 pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase items-center flex gap-3">
                        <KeyRound className="text-blue-400" size={32} /> IAM & Access Control
                    </h1>
                    <p className="text-rvs-steel text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                        <Shield size={14} className="text-emerald-400" /> Administrative Area
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2 transition-all"
                >
                    <UserPlus size={16} /> Provision Root / Staff Account
                </button>
            </div>

            {errorMsg && !showModal && (
                <div className="mb-6 p-4 rounded-lg bg-rvs-red-dark/20 border border-rvs-red-light/50 flex flex-col gap-2 relative shadow-[inset_0_0_15px_rgba(211,19,19,0.3)] text-red-100 items-center justify-center">
                    <AlertTriangle size={32} className="text-red-400" />
                    <p className="font-bold tracking-widest uppercase text-sm mt-2 text-center">{errorMsg}</p>
                </div>
            )}

            {!isLoading && users.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {users.map(user => (
                        <div key={user.id} className="bg-rvs-darker border border-rvs-steel/20 rounded-xl overflow-hidden shadow-xl relative group">
                            <div className={`absolute top-0 left-0 w-full h-1 ${user.role === 'ADMIN' ? 'bg-emerald-400' : 'bg-blue-500'}`}></div>

                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${user.role === 'ADMIN' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                                        <Users className={user.role === 'ADMIN' ? 'text-emerald-400' : 'text-blue-400'} size={24} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest font-mono border px-3 py-1 rounded-full ${user.role === 'ADMIN' ? 'text-emerald-400 border-emerald-500/30' : 'text-blue-400 border-blue-500/30'}`}>
                                        {user.role} ROLE
                                    </span>
                                </div>

                                <h3 className="text-lg font-black text-white uppercase tracking-widest">{user.name}</h3>
                                <p className="text-sm text-rvs-steel font-mono">{user.email}</p>

                                <div className="mt-6 pt-4 border-t border-rvs-steel/10 flex justify-between gap-2">
                                    <button onClick={() => handleEdit(user)} className="flex-1 rvs-glass hover:bg-rvs-steel/10 text-rvs-chrome text-[10px] py-2 rounded-lg font-black tracking-widest uppercase flex items-center justify-center gap-1 transition-colors">
                                        <Pencil size={12} /> Edit / Reset Pass
                                    </button>
                                    <button onClick={() => handleDelete(user.id, user.role)} className="px-4 rvs-glass text-rvs-steel hover:bg-rvs-red-dark hover:text-white rounded-lg transition-colors border border-transparent hover:border-rvs-red flex items-center justify-center">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center items-center h-40">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                </div>
            )}

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-rvs-darker border border-rvs-steel/20 rounded-xl w-full max-w-md overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 right-1/4 w-40 h-40 bg-blue-500 rounded-full mix-blend-screen filter blur-[60px] opacity-10 pointer-events-none"></div>

                        <div className="flex justify-between items-center p-6 border-b border-rvs-steel/10 bg-[#0A0A0A]">
                            <h2 className="text-lg font-black tracking-widest uppercase text-white">
                                {editingUser ? 'Edit User Credentials' : 'Provision User Account'}
                            </h2>
                            <button onClick={resetForm} className="text-rvs-steel hover:text-white"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="text-[10px] bg-rvs-red-dark/20 text-red-200 border border-rvs-red/30 p-2 rounded uppercase font-bold tracking-widest text-center">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-2 block">Full Name</label>
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/50 text-white text-sm border border-rvs-steel/20 rounded p-2 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-2 block">Company Email</label>
                                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/50 text-white text-sm border border-rvs-steel/20 rounded p-2 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-black text-rvs-steel uppercase tracking-widest mb-2 block">Root Role Level</label>
                                <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-black text-white text-sm border border-rvs-steel/20 rounded p-2 focus:border-blue-500 focus:outline-none">
                                    <option value="STAFF">STAFF (No Config Access)</option>
                                    <option value="ADMIN">ADMIN (Full Sandbox & Tuning)</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-rvs-steel/10 mt-4">
                                <label className="text-xs font-black text-white uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <KeyRound size={12} className="text-blue-400" /> Authentication Control
                                </label>
                                <p className="text-[10px] text-rvs-steel uppercase tracking-widest mb-4">
                                    {editingUser ? "Leave blank to keep existing password" : "Raw master password assignment"}
                                </p>

                                <div className="space-y-3">
                                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} className="w-full bg-black/50 text-white text-sm border border-rvs-steel/20 rounded p-2 focus:border-blue-500 focus:outline-none" />
                                    <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} className="w-full bg-black/50 text-white text-sm border border-rvs-steel/20 rounded p-2 focus:border-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <button type="submit" className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-black uppercase tracking-widest text-xs shadow-lg transition-colors flex justify-center items-center gap-2">
                                <Check size={16} /> {editingUser ? 'Force Commit Changes' : 'Execute Provision'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
