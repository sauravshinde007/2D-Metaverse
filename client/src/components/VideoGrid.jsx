import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
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

const VideoPlayer = ({ stream, peerId }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const username = getUsernameFromPeerId(peerId);

  // 1. Monitor stream state (tracks, mute/unmute)
  useEffect(() => {
    if (!stream) return;

    const checkVideoState = () => {
      const videoTracks = stream.getVideoTracks();
      const videoTrack = videoTracks[0];

      // Robust check: active ONLY if track exists and is NOT muted.
      // We explicitly ignore 'enabled' for remote streams as 'onmute' is the source of truth for remote cam status.
      const isVideoActive = videoTrack && !videoTrack.muted;

      // console.log(`🎥 Stream ${stream.id} checking: Track=${!!videoTrack}, Muted=${videoTrack?.muted}, Active=${isVideoActive}`);

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

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);

    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
      track.addEventListener('mute', handleMute);
      track.addEventListener('unmute', handleUnmute);
      track.addEventListener('ended', handleTrackChange);
    });

    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
      videoTracks.forEach(track => {
        track.removeEventListener('mute', handleMute);
        track.removeEventListener('unmute', handleUnmute);
        track.removeEventListener('ended', handleTrackChange);
      });
    };
  }, [stream]);

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

  useEffect(() => {
    const interval = setInterval(() => {
      const streams = peerService.getRemoteStreams();
      const limitedStreams = streams.slice(0, MAX_REMOTE_VIDEOS);

      // Simple equality check to avoid redundant re-renders
      // (Checking length and peerId of first item is a heuristic, specific map check is better)
      setRemoteStreams(prev => {
        // Create maps of IDs to compare
        const prevIds = prev.map(p => p[0]).join(',');
        const newIds = limitedStreams.map(p => p[0]).join(',');

        if (prevIds !== newIds) return limitedStreams;

        // Also check if stream objects changed reference (rare but possible)
        // or if we want to force updates? usually stream obj ref stays same
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
        <VideoPlayer key={peerId} peerId={peerId} stream={stream} />
      ))}
    </div>
  );
}