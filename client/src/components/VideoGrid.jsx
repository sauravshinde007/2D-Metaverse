import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import socketService from '../services/socketService';
import '../styles/videogrid.css';

const MAX_REMOTE_VIDEOS = 4;
const ANIMATION_DURATION = 300; // ms, matches CSS

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

const VideoPlayer = ({ stream, peerId, isVideoEnabledBySignaling, isExiting }) => {
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
    const handleMute = () => checkVideoState();
    const handleUnmute = () => checkVideoState();

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
    // Only update if different to avoid flickering
    if (hasVideo && videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
    }
  }, [hasVideo, stream, peerId]);

  if (!hasVideo && !isExiting) {
    // Render nothing if no valid video track logic
    // UNLESS we are exiting, where we might want to fade out whatever state we had
    if (!isExiting) return null;
  }

  return (
    <div className={`video-container ${isExiting ? 'exiting' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-element"
        style={{ opacity: hasVideo ? 1 : 0 }} // Smooth fade in/out of video content itself
      />
      <span className="peer-id-label">{username}</span>
    </div>
  );
};

export default function VideoGrid({ isVideoEnabled }) {
  const [displayStreams, setDisplayStreams] = useState([]); // { peerId, stream, isExiting, exitStart }
  const [videoStatusMap, setVideoStatusMap] = useState({});
  const [localStream, setLocalStream] = useState(null);

  useEffect(() => {
    if (peerService.localStream) {
      setLocalStream(peerService.localStream);
    }
  }, [isVideoEnabled]); // Update if this changes, though peerService stream is stable-ish

  useEffect(() => {
    const handleVideoStatus = ({ id, videoEnabled }) => {
      setVideoStatusMap(prev => ({
        ...prev,
        [id]: videoEnabled
      }));
    };

    socketService.onPlayerVideoStatus(handleVideoStatus);

    return () => {
      // socketService.offPlayerVideoStatus(handleVideoStatus);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      // Get current active streams from service
      const activeData = peerService.getRemoteStreams().slice(0, MAX_REMOTE_VIDEOS);
      const activeMap = new Map(activeData); // peerId -> stream

      setDisplayStreams(prev => {
        const next = [];
        const now = Date.now();
        const processedIds = new Set();
        let hasChanges = false;

        // 1. Process previous items (Handle Exit/Rescue/Keep)
        prev.forEach(item => {
          if (activeMap.has(item.peerId)) {
            // Still active - KEEP
            // Check if we need to "Rescue" from exiting state
            if (item.isExiting) {
              next.push({
                peerId: item.peerId,
                stream: activeMap.get(item.peerId),
                isExiting: false,
                exitStart: null
              });
              hasChanges = true;
            } else {
              // Nothing changed, preserve ref
              next.push(item);
            }
            processedIds.add(item.peerId);
          } else {
            // Not active - handle EXIT
            if (item.isExiting) {
              // Already exiting. Check time.
              if (now - item.exitStart < ANIMATION_DURATION) {
                next.push(item); // Keep processing animation
              } else {
                // Timeout done, drop it.
                hasChanges = true;
              }
            } else {
              // Newly missing. Mark exiting.
              next.push({ ...item, isExiting: true, exitStart: now });
              hasChanges = true;
            }
          }
        });

        // 2. Process NEW items (Remaining in activeMap)
        activeMap.forEach((stream, peerId) => {
          if (!processedIds.has(peerId)) {
            next.push({ peerId, stream, isExiting: false, exitStart: null });
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    };

    const interval = setInterval(update, 100); // Poll for smooth frame updates
    return () => clearInterval(interval);
  }, []);

  // Determine if we are in "Proximity Mode" (active remote video calls)
  const isProximityMode = displayStreams.length > 0;

  // Check if grid is entirely in exiting state (everyone left)
  const isGridExiting = isProximityMode && displayStreams.every(s => s.isExiting);

  // Dispatch event to World.js to control avatar bubble
  useEffect(() => {
    const event = new CustomEvent('proximity-video-active', { detail: isProximityMode });
    window.dispatchEvent(event);
  }, [isProximityMode]);

  return (
    <div className="remote-video-grid-container">
      {/*
        Render Local Video if:
        1. We are in proximity mode (rendering remote videos)
        2. Local video is enabled
      */}
      {isProximityMode && isVideoEnabled && localStream && (
        <div className={`video-container ${isGridExiting ? 'exiting' : ''}`}>
          <video
            ref={ref => { if (ref && ref.srcObject !== localStream) ref.srcObject = localStream; }}
            autoPlay
            playsInline
            muted // ALWAYS mute local video
            className="video-element"
            style={{ opacity: 1 }}
          />
          <span className="peer-id-label">You</span>
        </div>
      )}

      {displayStreams.map(({ peerId, stream, isExiting }) => (
        <VideoPlayer
          key={peerId}
          peerId={peerId}
          stream={stream}
          isVideoEnabledBySignaling={!!videoStatusMap[peerId]}
          isExiting={isExiting}
        />
      ))}
    </div>
  );
}