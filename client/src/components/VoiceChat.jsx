// client/src/components/VoiceChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import '../styles/voicechat.css';

export default function VoiceChat() {
  const [isMuted, setIsMuted] = useState(false);
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

    // Check if microphone is already enabled
    if (peerService.localStream) {
      setMicEnabled(true);
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
    }, 500); // Check more frequently for better responsiveness

    return () => {
      clearInterval(interval);
    };
  }, [isMuted, micEnabled]);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    peerService.setAudioMuted(newMutedState);
    setIsMuted(newMutedState);
  };

  const enableMicrophone = async () => {
    try {
      console.log('🎤 Enabling microphone...');
      await peerService.getUserMedia(false, true);
      setMicEnabled(true);
      console.log('✅ Microphone enabled via UI');
      console.log('📊 Microphone Details:');
      console.log('  - Has local stream:', !!peerService.localStream);
      console.log('  - Has peer:', !!peerService.peer);
      console.log('  - Peer ID:', peerService.peer?.id);
      if (peerService.localStream) {
        const audioTracks = peerService.localStream.getAudioTracks();
        console.log('  - Audio tracks:', audioTracks.length);
        if (audioTracks.length > 0) {
          console.log('  - Track label:', audioTracks[0].label);
          console.log('  - Track enabled:', audioTracks[0].enabled);
        }
      }
    } catch (error) {
      console.error('Failed to enable microphone:', error);
      if (error.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please allow access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone.');
      } else {
        alert('Failed to access microphone: ' + error.message);
      }
    }
  };

  const testConnection = () => {
    console.log('🧪 === CONNECTION TEST ===');
    console.log('Microphone enabled:', micEnabled);
    console.log('PeerService.peer:', peerService.peer);
    console.log('PeerService.localStream:', peerService.localStream);
    console.log('Active calls:', peerService.getActiveCalls());
    console.log('Is muted:', isMuted);
    console.log('Is transmitting:', isTransmitting);
    
    // Check if game scene is accessible
    if (window.game?.scene?.scenes[0]) {
      const scene = window.game.scene.scenes[0];
      console.log('Current nearby players:', Array.from(scene.currentNearbyPlayers || []));
      console.log('All players in scene:', Object.keys(scene.players || {}));
    }
    console.log('=========================');
  };

  return (
    <div className="voice-chat-container">
      <div className="voice-chat-header">
        <span className="voice-chat-title">🎙️ Proximity Voice</span>
        {activeCalls.length > 0 && (
          <span className="active-calls-badge">{activeCalls.length}</span>
        )}
      </div>
      
      <div className="voice-chat-controls">
        {!micEnabled ? (
          <button 
            className="mic-button enable"
            onClick={enableMicrophone}
            title="Click to enable microphone"
          >
            🎤
            <div style={{ fontSize: '10px', marginTop: '5px' }}>Click to Enable</div>
          </button>
        ) : (
          <>
            <button 
              className={`mic-button ${isMuted ? 'muted' : 'active'}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            
            {/* Transmission Status Indicator */}
            <div className="transmission-status">
              {isTransmitting ? (
                <div className="status-transmitting">
                  <div className="pulse-dot"></div>
                  <span>📡 Transmitting to {activeCalls.length} player{activeCalls.length !== 1 ? 's' : ''}</span>
                </div>
              ) : activeCalls.length > 0 ? (
                <div className="status-muted">
                  <span>🔇 Muted ({activeCalls.length} nearby)</span>
                </div>
              ) : (
                <div className="status-ready">
                  <span>
                    {peerService.localStream 
                      ? '✓ Ready (no players nearby)' 
                      : '⚠️ Mic not enabled'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Debug Info */}
            <div style={{ fontSize: '10px', marginTop: '5px', color: '#888', textAlign: 'center' }}>
              Active calls: {activeCalls.length} | 
              Stream: {peerService.localStream ? '✓' : '✗'} | 
              Peer: {peerService.peer ? '✓' : '✗'}
            </div>
            
            {/* Test Button */}
            <button 
              onClick={testConnection}
              style={{
                marginTop: '8px',
                padding: '5px 10px',
                fontSize: '11px',
                background: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              🧪 Test Connection (Check Console)
            </button>
          </>
        )}
        
        {micPermission === 'denied' && (
          <div className="permission-warning">
            ⚠️ Microphone access denied
          </div>
        )}
      </div>

    </div>
  );
}
