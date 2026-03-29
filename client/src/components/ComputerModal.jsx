import React, { useState, useEffect } from "react";
import { X, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ComputerModal = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleOpen = () => {
            setIsOpen(true);
        };

        const handleEscape = (e) => {
            if (e.key === "Escape" && isOpen) {
                handleClose();
            }
        };

        window.addEventListener("open-computer", handleOpen);
        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("open-computer", handleOpen);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    const handleClose = () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent("close-computer"));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full max-w-lg bg-[#0e1116] border border-gray-800 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-gray-100"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#13171f]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                    <Monitor size={20} />
                                </div>
                                <h2 className="text-[16px] font-semibold tracking-tight text-white">Mainframe Terminal</h2>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-gray-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body / Screen content */}
                        <div className="p-6 bg-[#090b0e] h-[280px] font-mono text-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-blue-900/5 pointer-events-none mix-blend-screen"></div>
                            
                            <p className="text-green-500 mb-3 select-none">► System initialized.</p>
                            <p className="text-gray-400 mb-3 select-none">► Connecting to secure intranet...</p>
                            <p className="text-gray-400 mb-6 select-none">► Connection established. Welcome, User.</p>
                            
                            <div className="animate-pulse flex items-center gap-2 text-blue-400 mt-4 select-none">
                                <span className="w-2.5 h-5 bg-blue-500 block"></span>
                            </div>

                            {/* Retro Screen Glare / Scanlines */}
                            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] opacity-30 pointer-events-none"></div>
                            <div className="absolute top-0 left-0 w-full h-[30%] bg-gradient-to-b from-white/5 to-transparent pointer-events-none shadow-[inset_0_20px_20px_rgba(255,255,255,0.02)]"></div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-800 bg-[#13171f] flex justify-between items-center">
                            <p className="text-[13px] text-gray-500 font-medium tracking-tight">
                                Press <kbd className="px-2 py-1 bg-gray-800/80 border border-gray-700 rounded-md text-gray-300 mx-1 shadow-sm font-sans text-xs">ESC</kbd> to exit
                            </p>
                            <button
                                onClick={handleClose}
                                className="px-6 py-2.5 font-medium text-white bg-[#cc0000] rounded-xl hover:bg-[#ff1a1a] transition-all shadow-sm text-sm flex items-center gap-2"
                            >
                                Disconnect
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ComputerModal;
