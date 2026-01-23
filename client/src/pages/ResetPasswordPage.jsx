import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

const ResetPasswordPage = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${serverUrl}/api/auth/reset-password`, {
                token,
                newPassword: password,
            });
            setMessage(response.data.message);
            // Optional: redirect after a few seconds
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(
                err.response?.data?.message || "Failed to reset password. Link may have expired."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative bg-gradient-to-b from-[#14141a] via-[#0d0d14] to-black text-[#e6e7ea] overflow-hidden">
            {/* Floating blobs */}
            <div aria-hidden className="pointer-events-none absolute -z-10 inset-0">
                <div className="absolute left-[-8rem] top-[-8rem] w-96 h-96 rounded-[40%_60%_60%_40%] bg-gradient-to-tr from-[#505081] to-[#7272e0] opacity-40 blur-[30px] animate-blob-slow" />
                <div className="absolute right-[-6rem] bottom-[-6rem] w-72 h-72 rounded-[30%_70%_70%_30%] bg-gradient-to-br from-[#44466f] to-[#8b8be0] opacity-35 blur-[28px] animate-blob-fast" />
            </div>

            <Header />

            <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 md:pt-28">
                <Link
                    to="/login"
                    className="inline-flex items-center text-xs md:text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                    <span className="mr-1">&larr;</span> Back to Login
                </Link>
            </div>

            <main className="relative z-10 flex items-center justify-center px-6 py-10 md:py-20">
                <div className="w-full max-w-md">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl shadow-2xl p-6 md:p-8">
                        <h2 className="text-2xl md:text-3xl font-bold mb-2">
                            Set New Password
                            <span className="text-[#9b99fe]">.</span>
                        </h2>
                        <p className="text-sm text-zinc-400 mb-6">
                            Create a new secure password for your account.
                        </p>

                        {message ? (
                            <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-200 text-sm">
                                <p className="font-semibold mb-1">Success!</p>
                                <p>{message}</p>
                                <p className="mt-2 text-xs">Redirecting to login...</p>
                                <Button
                                    className="mt-4 w-full"
                                    variant="primary"
                                    onClick={() => navigate('/login')}
                                >
                                    Login Now
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="password"
                                        className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                                    >
                                        New Password
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#9b99fe] focus:ring-1 focus:ring-[#9b99fe] transition"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="confirmPassword"
                                        className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                                    >
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-[#9b99fe] focus:ring-1 focus:ring-[#9b99fe] transition"
                                        placeholder="••••••••"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/70 rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="w-full mt-2 justify-center text-sm font-medium"
                                    disabled={loading}
                                >
                                    {loading ? "Resetting..." : "Reset Password"}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// Reused Header
function Header() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header className="fixed top-4 left-0 right-0 z-30 px-4">
            <div
                className={cn(
                    "mx-auto max-w-7xl flex items-center justify-between gap-4 rounded-2xl transition-all duration-200 border p-3",
                    scrolled
                        ? "bg-zinc-900/70 border-zinc-800 shadow-lg"
                        : "bg-zinc-900/35 border-zinc-700/70"
                )}
            >
                <Link to="/" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9b99fe] to-[#2bc8b7] shadow-md">
                        <span className="text-sm font-bold text-black">M</span>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold tracking-wide">Metaverse</span>
                        <span className="text-[10px] text-zinc-400 hidden sm:block">
                            Remote Collaboration
                        </span>
                    </div>
                </Link>
            </div>
        </header>
    );
}

export default ResetPasswordPage;
