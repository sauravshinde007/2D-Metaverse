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

  const toggleMute = () => {
    const newMutedState = !isMuted;
    peerService.setAudioMuted(newMutedState);
    setIsMuted(newMutedState);
  };

  const toggleVideo = () => {
    const newVideoState = !isVideoEnabled;
    // Set local state
    setIsVideoEnabled(newVideoState);
    // Tell peer service to enable/disable tracks
    peerService.setVideoEnabled(newVideoState);

    // Explicitly log the change for debugging
    console.log(`🎥 Toggled Video: ${newVideoState ? 'ON' : 'OFF'}`);
    socketService.emitVideoStatus(newVideoState);
  };

  // Robust media initialization
  const initializeMedia = async (shouldEnableVideo = false) => {
    try {
      console.log('🎤 Initializing media...');

      // Request both audio and video
      await peerService.getUserMedia({
        audio: true,
        video: { width: 320, height: 240 } // Request low-res video
      });

      setIsConnected(true);

      // Set initial states
      // Audio is on by default when joining
      setIsMuted(false);
      peerService.setAudioMuted(false);

      // Video depends on which button was clicked
      if (shouldEnableVideo) {
        setIsVideoEnabled(true);
        peerService.setVideoEnabled(true);
        socketService.emitVideoStatus(true);
      } else {
        setIsVideoEnabled(false);
        peerService.setVideoEnabled(false);
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
      initializeMedia(false); // Join with Audio only
    } else {
      toggleMute();
    }
  };

  const handleVideoClick = () => {
    if (!isConnected) {
      initializeMedia(true); // Join with Video + Audio
    } else {
      toggleVideo();
    }
  };

  const testConnection = () => {
    console.log('🧪 === CONNECTION TEST ===');
    console.log('Microphone enabled:', isConnected);
    console.log('Video enabled:', isVideoEnabled);
    console.log('PeerService.peer:', peerService.peer);
    console.log('PeerService.localStream:', peerService.localStream);
    console.log('Active calls:', peerService.getActiveCalls());
    console.log('Remote streams:', peerService.getRemoteStreams().length);
    console.log('Is muted:', isMuted);
    console.log('Is transmitting:', isTransmitting);
    if (window.game?.scene?.scenes[0]) {
      const scene = window.game.scene.scenes[0];
      console.log('Current nearby players:', Array.from(scene.currentNearbyPlayers || []));
      console.log('All players in scene:', Object.keys(scene.players || {}));
    }
    console.log('=========================');
  };

  return (
    <div className="voice-chat-container">

      {/* Avatar */}
      <div className="avatar-display">
        {user?.username?.[0]?.toUpperCase() || '?'}
        {isConnected && <div className="online-indicator"></div>}
      </div>

      {/* Microphone Button */}
      <button
        className={`mic-button ${isConnected && !isMuted ? 'active' : 'muted'}`}
        onClick={handleMicClick}
        title={isConnected ? (isMuted ? 'Unmute' : 'Mute') : 'Join Audio'}
      >
        <img
          src={isConnected && !isMuted ? '/icons/mic-active.png' : '/icons/mic-muted.png'}
          alt="Microphone"
          className="mic-icon"
        />
      </button>

      {/* Camera Button (uses props) */}
      <button
        className={`mic-button ${isVideoEnabled ? 'active' : 'muted'}`}
        onClick={handleVideoClick}
        title={isConnected ? (isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On') : 'Join with Video'}
      >
        <img
          src={isVideoEnabled ? '/icons/camera-on.png' : '/icons/camera-off.png'}
          alt={isVideoEnabled ? 'Camera On' : 'Camera Off'}
          className="mic-icon"
        />
      </button>

      {/* Test Button */}
      <button
        onClick={testConnection}
        className="mic-button debug-button"
        title="Test Connection (Check Console)"
      >
        🧪
      </button>

      {/* Permission Warning */}
      {micPermission === 'denied' && (
        <div className="permission-warning">
          ⚠️ Mic Denied
        </div>
      )}
    </div>
  );
}