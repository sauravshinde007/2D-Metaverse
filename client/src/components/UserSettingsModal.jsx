import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { X, Camera, User, Mail, Save, Loader2, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function UserSettingsModal({ isOpen, onClose }) {
    const { user, token, setUser } = useAuth();
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [currentAvatarUrl, setCurrentAvatarUrl] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

    // Reset and Pre-fill fields when modal opens
    useEffect(() => {
        if (isOpen && user) {
            setEmail(user.email || "");
            setUsername(user.username || "");
            setCurrentAvatarUrl(user.avatar || "");
            setPreviewUrl("");
            setSelectedFile(null);
            setMessage("");
            setError("");
        }
    }, [user, isOpen]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Basic validation
            if (file.size > 5 * 1024 * 1024) {
                setError("File size should be less than 5MB");
                return;
            }
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setError("");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("username", username);
            formData.append("email", email);
            if (selectedFile) {
                formData.append("avatar", selectedFile);
            }

            const response = await axios.put(
                `${serverUrl}/api/users/update-profile`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data"
                    }
                }
            );

            // Update local user state
            const updatedUser = { ...user, ...response.data.user };
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser)); // Persist update

            setMessage("Profile updated successfully!");

            // If we're not closing immediately, update the current avatar view to the new one
            if (response.data.user.avatar) {
                setCurrentAvatarUrl(response.data.user.avatar);
                setPreviewUrl("");
                setSelectedFile(null);
            }

            // Optional: Close after delay or let user close
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Helper to get initials
    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : "U";
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6"
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="w-full max-w-5xl h-[85vh] bg-[#0f0f11] rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col md:flex-row relative"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-20 p-2 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        {/* Left Sidebar / Visual Area */}
                        <div className="md:w-1/3 bg-gradient-to-br from-indigo-900/20 via-zinc-900 to-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            {/* Background Elements */}
                            <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                                <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-500 rounded-full blur-[80px]"></div>
                                <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500 rounded-full blur-[80px]"></div>
                            </div>

                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Public Profile</h2>
                                <p className="text-zinc-500 mb-8 text-sm">Manage how you appear to others in the Metaverse.</p>

                                {/* Avatar Upload Section */}
                                <div className="relative group cursor-pointer w-fit mx-auto" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-40 h-40 rounded-full border-4 border-zinc-800 shadow-xl overflow-hidden bg-zinc-800 flex items-center justify-center relative transition-transform transform group-hover:scale-105">
                                        {/* Avatar Logic */}
                                        {previewUrl ? (
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : currentAvatarUrl ? (
                                            <img src={currentAvatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-linear-to-br from-[#9b99fe] to-indigo-600 flex items-center justify-center text-5xl font-bold text-white">
                                                {getInitials(username)}
                                            </div>
                                        )}

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <Camera className="text-white mb-1" size={24} />
                                            <span className="text-xs font-medium text-white">Change Photo</span>
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />

                                <div className="mt-6">
                                    <h3 className="text-xl font-semibold text-white">{username || "User"}</h3>
                                    <p className="text-zinc-500 text-sm mt-1">{email || "No email set"}</p>
                                    <span className="inline-block mt-3 px-3 py-1 bg-zinc-800 rounded-full text-xs font-mono text-zinc-400 border border-zinc-700">
                                        {user?.role?.toUpperCase() || "EMPLOYEE"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Content / Form Area */}
                        <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar">
                            <div className="max-w-xl mx-auto py-8">
                                <h3 className="text-2xl font-bold text-white mb-6 border-b border-zinc-800 pb-4">Account Details</h3>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                            <User size={16} /> Username
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                required
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#9b99fe]/50 focus:border-[#9b99fe] transition-all"
                                                placeholder="Enter your username"
                                            />
                                        </div>
                                        <p className="text-xs text-zinc-600">This is your display name in the virtual world.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                            <Mail size={16} /> Email Address
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#9b99fe]/50 focus:border-[#9b99fe] transition-all"
                                                placeholder="Enter your email"
                                            />
                                        </div>
                                    </div>

                                    {/* Status Messages */}
                                    <div className="min-h-[24px]">
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {error}
                                            </motion.div>
                                        )}
                                        {message && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                                                className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {message}
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-6 flex gap-4">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors flex-1"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-3 rounded-xl bg-[#9b99fe] text-black font-semibold hover:bg-[#8886fc] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-[2] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="animate-spin" size={18} /> Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={18} /> Save Changes
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
