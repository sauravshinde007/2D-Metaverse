import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Mic, MicOff, VideoIcon, VideoOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';

const MeetingModal = () => {
    const { token } = useAuth();
    const [zone, setZone] = useState(null); // { zoneId, zoneName }
    const [meetingToken, setMeetingToken] = useState(null);
    const [meetingUrl, setMeetingUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recordId, setRecordId] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);

    const serverUrl = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3001';

    useEffect(() => {
        const handleEnter = (e) => {
            console.log("Entered meeting zone:", e.detail);
            setZone(e.detail);
            setMeetingToken(null);
            setMeetingUrl(null);
            setError(null);
        };

        const handleLeave = (e) => {
            console.log("Left meeting zone:", e.detail);
            setZone(null);
            setMeetingToken(null);
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
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data && response.data.token) {
                setMeetingToken(response.data.token);
                setMeetingUrl(response.data.url);
                window.dispatchEvent(new CustomEvent('meeting-status-change', { detail: { active: true } }));

                try {
                    const trackRes = await axios.post(`${serverUrl}/api/meeting/join`, {
                        roomName: response.data.roomName || zone.zoneName || zone.zoneId
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (trackRes.data.recordId) {
                        setRecordId(trackRes.data.recordId);
                    }

                    if (trackRes.data.sessionId) {
                        const currentSessionId = trackRes.data.sessionId;
                        try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            streamRef.current = stream;

                            const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
                            mediaRecorderRef.current = mediaRecorder;

                            mediaRecorder.ondataavailable = async (e) => {
                                if (e.data.size > 0 && currentSessionId) {
                                    const formData = new FormData();
                                    formData.append('audioFile', e.data, 'chunk.webm');
                                    formData.append('sessionId', currentSessionId);

                                    try {
                                        await axios.post(`${serverUrl}/api/meeting/transcribe`, formData, {
                                            headers: {
                                                Authorization: `Bearer ${token}`,
                                                'Content-Type': 'multipart/form-data'
                                            }
                                        });
                                    } catch (err) {
                                        console.error("Audio chunk upload failed:", err);
                                    }
                                }
                            };

                            window._meetingActive = true;
                            // Start continuously emitting uninterrupted audio chunks every 10 seconds
                            mediaRecorder.start(10000);

                        } catch (err) {
                            console.error("Failed to start MediaRecorder for MOM:", err);
                        }
                    }

                } catch (e) {
                    console.error("Failed to track meeting join:", e);
                }
            } else {
                setError("Failed to get meeting token");
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

    const closeMeeting = async () => {
        if (meetingToken) {
            if (window.confirm("Disconnect from meeting?")) {
                setMeetingToken(null);
                setMeetingUrl(null);
                window._meetingActive = false;
                window.dispatchEvent(new CustomEvent('meeting-status-change', { detail: { active: false } }));

                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                }

                if (recordId) {
                    try {
                        await axios.post(`${serverUrl}/api/meeting/leave`, { recordId }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        setRecordId(null);
                    } catch (e) {
                        console.error("Failed to track meeting leave:", e);
                    }
                }
            }
        } else {
            setZone(null);
        }
    };

    if (!zone) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            {/* Modal Container */}
            <div className={`bg-black/90 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/10 
                            ${meetingToken ? 'w-[90%] h-[90%]' : 'w-full max-w-md'} 
                            pointer-events-auto flex flex-col relative transition-all duration-300`}>

                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        🎥 {zone.zoneName || "Meeting Room"}
                    </h2>
                    <button
                        onClick={closeMeeting}
                        className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                        title={meetingToken ? "Leave Meeting" : "Dismiss"}
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
                    ) : meetingToken ? (
                        <div className="w-full h-full" data-lk-theme="default">
                            <LiveKitRoom
                                video={true}
                                audio={true}
                                token={meetingToken}
                                serverUrl={meetingUrl}
                                onDisconnected={closeMeeting}
                            >
                                <VideoConference />
                                <RoomAudioRenderer />
                            </LiveKitRoom>
                        </div>
                    ) : (
                        <div className="text-center p-8 w-full">
                            <h3 className="text-2xl font-bold text-white mb-4">
                                Ready to join?
                            </h3>
                            <p className="text-gray-400 mb-8">
                                You are in a designated meeting area.
                                <br />
                                <span className="text-xs opacity-70">Secured via LiveKit.</span>
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
