import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function UserSettingsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const { user, token, setUser } = useAuth();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

    // Pre-fill email if exists (but likely it's null for legacy users)
    useEffect(() => {
        if (user?.email) {
            setEmail(user.email);
        }
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const response = await axios.put(
                `${serverUrl}/api/users/update-email`,
                { email },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local user state
            setUser({ ...user, email: response.data.email });
            localStorage.setItem("user", JSON.stringify({ ...user, email: response.data.email }));

            setMessage("Email updated/added successfully!");

            // Close after short delay
            setTimeout(() => {
                onClose(); // Parent might need to know
            }, 1500);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to update email.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Account Settings</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">&times;</button>
                </div>

                <p className="text-sm text-zinc-400 mb-6">
                    {user?.email
                        ? "Update your email address to ensure you can recover your account."
                        : "⚠️ Your account has no email! Add one now to enable password recovery."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-[#9b99fe]"
                            placeholder="you@example.com"
                        />
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {message && <p className="text-sm text-green-400">{message}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-[#9b99fe] px-4 py-2 text-sm font-semibold text-black hover:bg-[#8886fc] disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save Email"}
                    </button>
                </form>
            </div>
        </div>
    );
}
