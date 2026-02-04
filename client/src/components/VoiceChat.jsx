// client/src/components/VoiceChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import socketService from '../services/socketService';
import '../styles/voicechat.css';
import { useAuth } from '../context/AuthContext';

// Accept props for video state
export default function VoiceChat({ isVideoEnabled, setIsVideoEnabled }) {
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  // Renamed micEnabled to isConnected to better reflect state (we can be connected but muted)
  const [isConnected, setIsConnected] = useState(false);
  const [activeCalls, setActiveCalls] = useState([]);
  const [micPermission, setMicPermission] = useState('pending');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleReaction = (emoji) => {
    socketService.emitReaction(emoji);
    setShowEmojiPicker(false);
  };

  useEffect(() => {
    // Check microphone permission status
    const checkPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' });
        setMicPermission(result.state);

        result.addEventListener('change', () => {
          setMicPermission(result.state);
        });
      } catch (error) {
        console.log('Permission API not supported');
      }
    };
    checkPermission();

    // Check if media is already enabled
    if (peerService.localStream) {
      setIsConnected(true);
      // Sync prop state with stream state on initial load
      const videoTrack = peerService.localStream.getVideoTracks()[0];
      if (videoTrack) {
        setIsVideoEnabled(videoTrack.enabled);
      }
    }

    // Update active calls and transmission status periodically
    const interval = setInterval(() => {
      const calls = peerService.getActiveCalls();
      setActiveCalls(calls);

      // Check if we're transmitting (have active calls and mic is enabled and not muted)
      setIsTransmitting(calls.length > 0 && peerService.localStream && !isMuted);

      // Check if stream exists
      if (peerService.localStream && !isConnected) {
        setIsConnected(true);
      }

    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isMuted, isConnected, setIsVideoEnabled]);

  const toggleMute = async () => {
    // Current state: isMuted (Audio OFF). 
    // Target state: !isMuted (Audio ON).

    // Logic: If currently muted (Audio OFF), we want to ENABLE.
    const enable = isMuted;

    await peerService.setAudioEnabled(enable);
    setIsMuted(!enable);
  };

  const toggleVideo = async () => {
    const newVideoState = !isVideoEnabled;
    // Set local state
    setIsVideoEnabled(newVideoState);
    // Tell peer service to enable/disable tracks
    await peerService.setVideoEnabled(newVideoState);

    // Explicitly log the change for debugging
    console.log(`🎥 Toggled Video: ${newVideoState ? 'ON' : 'OFF'}`);
    socketService.emitVideoStatus(newVideoState);
  };

  // Robust media initialization
  const initializeMedia = async (constraints) => {
    try {
      console.log('🎤 Initializing media...', constraints);

      // Request media
      await peerService.getUserMedia(constraints);

      setIsConnected(true);

      // Set initial states based on what we requested
      if (constraints.audio) {
        setIsMuted(false);
        // peerService.setAudioEnabled(true); // Already active from getUserMedia
      } else {
        setIsMuted(true);
      }

      if (constraints.video) {
        setIsVideoEnabled(true);
        socketService.emitVideoStatus(true);
      } else {
        setIsVideoEnabled(false);
        socketService.emitVideoStatus(false);
      }

      console.log('✅ Media enabled via UI');
    } catch (error) {
      console.error('Failed to enable media:', error);
      if (error.name === 'NotAllowedError') {
        alert('Media permissions denied. Please allow access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone or camera found.');
      } else {
        alert('Failed to access media: ' + error.message);
      }
    }
  };

  // Handlers for the buttons
  const handleMicClick = () => {
    if (!isConnected) {
      // Join with Audio ONLY
      initializeMedia({ audio: true });
    } else {
      toggleMute();
    }
  };

  const handleVideoClick = () => {
    if (!isConnected) {
      // Join with Video ONLY
      initializeMedia({ video: { width: 320, height: 240 } });
    } else {
      toggleVideo();
    }
  };

  return (
    <div className="voice-chat-container">

      {/* Avatar */}
      {/* Avatar */}
      <div className="avatar-display">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt="Me"
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          />
        ) : (
          user?.username?.[0]?.toUpperCase() || '?'
        )}
        <div className="online-indicator"></div>
      </div>

      {/* Microphone Button */}
      <button
        className={`mic-button ${isConnected && !isMuted ? 'active' : 'muted'}`}
        onClick={handleMicClick}
        title={isConnected ? (isMuted ? 'Unmute' : 'Mute') : 'Join Audio'}
      >
        {isConnected && !isMuted ? (
          <svg className="mic-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg className="mic-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* Camera Button (uses props) */}
      <button
        className={`mic-button ${isVideoEnabled ? 'active' : 'muted'}`}
        onClick={handleVideoClick}
        title={isConnected ? (isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On') : 'Join with Video'}
      >
        {isVideoEnabled ? (
          <svg className="mic-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg className="mic-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>

      {/* Reaction Button */}
      <div style={{ position: 'relative' }}>
        <button
          className="mic-button muted"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Send Reaction"
        >
          <span style={{ fontSize: '20px' }}>😀</span>
        </button>

        {showEmojiPicker && (
          <div className="emoji-picker" style={{
            position: 'absolute',
            bottom: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(18, 18, 30, 0.95)',
            border: '1px solid rgba(63, 63, 92, 0.85)',
            borderRadius: '12px',
            padding: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
            width: 'max-content'
          }}>
            {['😀', '😂', '😍', '😢', '👏', '👎', '🎉', '🔥', '👋'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '5px',
                  transition: 'transform 0.1s'
                }}
                onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
                onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Permission Warning */}
      {micPermission === 'denied' && (
        <div className="permission-warning">
          ⚠️ Mic Denied
        </div>
      )}
    </div>
  );
}