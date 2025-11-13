// client/src/components/VoiceChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import '../styles/voicechat.css';
import { useAuth } from '../context/AuthContext';

// Accept props for video state
export default function VoiceChat({ isVideoEnabled, setIsVideoEnabled }) {
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  // We no longer manage video state here; it's passed in as a prop.
  const [activeCalls, setActiveCalls] = useState([]);
  const [micPermission, setMicPermission] = useState('pending');
  const [micEnabled, setMicEnabled] = useState(false);
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
      setMicEnabled(true);
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
      if (peerService.localStream && !micEnabled) {
        setMicEnabled(true);
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [isMuted, micEnabled, setIsVideoEnabled]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    peerService.setAudioMuted(newMutedState);
    setIsMuted(newMutedState);
  };

  const toggleVideo = () => {
    const newVideoState = !isVideoEnabled;
    peerService.setVideoEnabled(newVideoState);
    // Call the setter prop from Metaverse.jsx
    setIsVideoEnabled(newVideoState);
  };

  const enableMedia = async () => {
    try {
      console.log('🎤 Enabling media (audio & video)...');
      
      // Request both audio and video
      await peerService.getUserMedia({ 
        audio: true, 
        video: { width: 320, height: 240 } // Request low-res video
      });
      
      setMicEnabled(true); // This state now means "media is enabled"
      setIsVideoEnabled(false); // Video is disabled by default
      console.log('✅ Media enabled via UI');
      console.log('📊 Media Details:');
      console.log('  - Has local stream:', !!peerService.localStream);
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

  const testConnection = () => {
    console.log('🧪 === CONNECTION TEST ===');
    console.log('Microphone enabled:', micEnabled);
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
        {micEnabled && <div className="online-indicator"></div>}
      </div>

      {/* Microphone Button */}
      <button
        className={`mic-button ${micEnabled && !isMuted ? 'active' : 'muted'}`}
        onClick={micEnabled ? toggleMute : enableMedia} // Calls enableMedia
        title={micEnabled ? (isMuted ? 'Unmute' : 'Mute') : 'Enable Media'}
      >
        <img 
          src={micEnabled && !isMuted ? '/icons/mic-active.png' : '/icons/mic-muted.png'} 
          alt={micEnabled && !isMuted ? 'Microphone Active' : 'Microphone Muted'} 
          className="mic-icon"
        />
      </button>

      {/* Camera Button (uses props) */}
      <button 
        className={`mic-button ${isVideoEnabled ? 'active' : 'muted'}`}
        onClick={toggleVideo}
        title={isVideoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
        disabled={!micEnabled} // Can't turn on video if media isn't enabled
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