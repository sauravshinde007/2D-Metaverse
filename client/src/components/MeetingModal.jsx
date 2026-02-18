import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Mic, MicOff, Video, VideoOff } from 'lucide-react';

const MeetingModal = () => {
    const [zone, setZone] = useState(null); // { zoneId, zoneName }
    const [meetingUrl, setMeetingUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

    useEffect(() => {
        const handleEnter = (e) => {
            console.log("Entered meeting zone:", e.detail);
            setZone(e.detail);
            setMeetingUrl(null);
            setError(null);
        };

        const handleLeave = (e) => {
            console.log("Left meeting zone:", e.detail);
            setZone(null);
            setMeetingUrl(null);
            setError(null);
        };

        window.addEventListener('enter-meeting-zone', handleEnter);
        window.addEventListener('leave-meeting-zone', handleLeave);

        return () => {
            window.removeEventListener('enter-meeting-zone', handleEnter);
            window.removeEventListener('leave-meeting-zone', handleLeave);
        };
    }, []);

    const startMeeting = async () => {
        if (!zone) return;
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${serverUrl}/api/meeting/create`, {
                roomId: zone.zoneId
            });

            if (response.data && response.data.url) {
                setMeetingUrl(response.data.url);
                window.dispatchEvent(new CustomEvent('meeting-status-change', { detail: { active: true } }));
            } else {
                setError("Failed to get meeting URL");
            }
        } catch (err) {
            console.error("Meeting error:", err);
            setError(
                "Error starting meeting: " +
                (err.response?.data?.error || err.message)
            );
        } finally {
            setLoading(false);
        }
    };

    const closeMeeting = () => {
        if (meetingUrl) {
            if (window.confirm("Disconnect from meeting?")) {
                setMeetingUrl(null);
                window.dispatchEvent(new CustomEvent('meeting-status-change', { detail: { active: false } }));
            }
        } else {
            setZone(null);
        }
    };

    if (!zone) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            {/* Modal Container - pointer-events-auto to capture clicks */}
            <div className={`bg-black/90 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/10 
                            ${meetingUrl ? 'w-[90%] h-[90%]' : 'w-full max-w-md'} 
                            pointer-events-auto flex flex-col relative transition-all duration-300`}>

                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🎥 {zone.zoneName || "Meeting Room"}
                    </h2>

                    {/* Only show close button if url is set, or allow closing the prompt too? 
                        If we close prompt while in zone, how to get it back?
                        Maybe we don't allow closing the prompt completely, just the call. 
                    */}
                    <button
                        onClick={closeMeeting}
                        className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                        title={meetingUrl ? "Leave Meeting" : "Dismiss"}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-900/50 rounded-xl overflow-hidden relative">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3 text-white">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                            <div>Setting up secure line...</div>
                        </div>
                    ) : meetingUrl ? (
                        <iframe
                            src={meetingUrl}
                            className="w-full h-full border-0"
                            allow="camera; microphone; fullscreen; display-capture; autoplay"
                            title="Daily Meeting"
                        />
                    ) : (
                        <div className="text-center p-8 w-full">
                            <h3 className="text-2xl font-bold text-white mb-4">
                                Ready to join?
                            </h3>
                            <p className="text-gray-400 mb-8">
                                You are in a designated meeting area.
                                <br />
                                <span className="text-xs opacity-70">Up to 4 participants allowed.</span>
                            </p>

                            {error && (
                                <div className="bg-red-500/20 text-red-200 p-3 rounded-lg mb-4 text-sm border border-red-500/30">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={startMeeting}
                                className="w-full px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 
                                         text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 
                                         transform hover:scale-[1.02] transition-all duration-200"
                            >
                                Enter Meeting Room
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeetingModal;
