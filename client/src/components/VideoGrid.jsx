import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import socketService from '../services/socketService';
import '../styles/videogrid.css';

const MAX_REMOTE_VIDEOS = 4;

function getUsernameFromPeerId(peerId) {
  try {
    const worldScene = window._phaserGame?.scene.getScene('WorldScene');
    if (worldScene && worldScene.playerUsernames) {
      const username = worldScene.playerUsernames.get(peerId);
      return username || peerId.slice(0, 6) + '...';
    }
  } catch (e) {
    console.error("Error getting username from Phaser scene:", e);
  }
  return peerId.slice(0, 6) + '...';
}

const VideoPlayer = ({ stream, peerId, isVideoEnabledBySignaling }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const username = getUsernameFromPeerId(peerId);

  // 1. Monitor stream state (tracks, mute/unmute)
  useEffect(() => {
    if (!stream) return;

    const checkVideoState = () => {
      const videoTracks = stream.getVideoTracks();
      const videoTrack = videoTracks[0];

      // Robust check: active ONLY if:
      // 1. Track exists
      // 2. Track is not muted (WebRTC level)
      // 3. Signaling says it should be enabled (Server level truth)
      // Note: isVideoEnabledBySignaling defaults to false if not yet received, preventing black box on join.
      const isVideoActive = videoTrack && !videoTrack.muted && isVideoEnabledBySignaling;

      setHasVideo(prev => {
        if (prev !== isVideoActive) {
          return isVideoActive;
        }
        return prev;
      });
    };

    // Check immediately
    checkVideoState();

    // Track listeners
    const handleTrackChange = () => checkVideoState();
    const handleMute = () => {
      // console.log(`🎥 Stream ${stream.id} MUTED`);
      checkVideoState();
    };
    const handleUnmute = () => {
      // console.log(`🎥 Stream ${stream.id} UNMUTED`);
      checkVideoState();
    };

    // Safety check: sometimes events don't fire reliably
    const checkInterval = setInterval(checkVideoState, 1000);

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);

    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
      track.addEventListener('mute', handleMute);
      track.addEventListener('unmute', handleUnmute);
      track.addEventListener('ended', handleTrackChange);
    });

    return () => {
      clearInterval(checkInterval);
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
      videoTracks.forEach(track => {
        track.removeEventListener('mute', handleMute);
        track.removeEventListener('unmute', handleUnmute);
        track.removeEventListener('ended', handleTrackChange);
      });
    };
  }, [stream, isVideoEnabledBySignaling]);

  // 2. Attach stream to DOM when visible
  useEffect(() => {
    if (hasVideo && videoRef.current && stream) {
      // Only update if different to avoid flickering
      if (videoRef.current.srcObject !== stream) {
        // console.log(`🎥 Attaching stream ${stream.id} to video element for ${peerId}`);
        videoRef.current.srcObject = stream;
      }
    }
  }, [hasVideo, stream, peerId]); // Re-run if these change

  if (!hasVideo) {
    // Render nothing if no valid video track logic
    return null;
  }

  return (
    <div className="video-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-element"
      />
      <span className="peer-id-label">{username}</span>
    </div>
  );
};

export default function VideoGrid() {
  const [remoteStreams, setRemoteStreams] = useState([]);
  // Map peerId -> boolean
  const [videoStatusMap, setVideoStatusMap] = useState({});

  useEffect(() => {
    const handleVideoStatus = ({ id, videoEnabled }) => {
      setVideoStatusMap(prev => ({
        ...prev,
        [id]: videoEnabled
      }));
    };

    socketService.onPlayerVideoStatus(handleVideoStatus);

    // Also listen for initial players list (if it contains video status) - though 'players' socket event is handled in World.js usually.
    // We might need to ask World.js or just wait for updates.
    // For robustness, let's just listen.

    return () => {
      // cleanup (we don't have an off method for specific callback in current wrapper easily unless added, 
      // but adding a remove-listener usage is good practice)
      // socketService.offPlayerVideoStatus(handleVideoStatus); // Not implemented yet
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const streams = peerService.getRemoteStreams();
      const limitedStreams = streams.slice(0, MAX_REMOTE_VIDEOS);

      setRemoteStreams(prev => {
        // Create maps of IDs to compare
        const prevIds = prev.map(p => p[0]).join(',');
        const newIds = limitedStreams.map(p => p[0]).join(',');

        if (prevIds !== newIds) return limitedStreams;
        return prev;
      });

      // Fallback: Just update if lengths differ at least, usually handled above
      if (limitedStreams.length !== remoteStreams.length) {
        setRemoteStreams(limitedStreams);
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [remoteStreams]);

  return (
    <div className="remote-video-grid-container">
      {remoteStreams.map(([peerId, stream]) => (
        <VideoPlayer
          key={peerId}
          peerId={peerId}
          stream={stream}
          isVideoEnabledBySignaling={!!videoStatusMap[peerId]}
        />
      ))}
    </div>
  );
}