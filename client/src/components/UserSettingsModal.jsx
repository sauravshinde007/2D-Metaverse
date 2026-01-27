import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function UserSettingsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const { user, token, setUser } = useAuth();
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

    // Pre-fill fields
    useEffect(() => {
        if (user) {
            setEmail(user.email || "");
            setUsername(user.username || "");
        }
    }, [user, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const response = await axios.put(
                `${serverUrl}/api/users/update-profile`,
                { email, username },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Update local user state
            const updatedUser = { ...user, ...response.data.user };
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));

            setMessage("Profile updated successfully!");

            // Close after short delay
            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Profile Settings</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username Input */}
                    <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">
                            Username
                        </label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-[#9b99fe]"
                            placeholder="username"
                        />
                    </div>

                    {/* Email Input */}
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
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>
    );
}
