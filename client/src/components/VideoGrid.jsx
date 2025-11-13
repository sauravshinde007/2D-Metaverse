// client/src/components/VideoGrid.jsx
import React, { useState, useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import '../styles/videogrid.css';

const MAX_REMOTE_VIDEOS = 4;

function getUsernameFromPeerId(peerId) {
  try {
    // Access the running Phaser scene
    const worldScene = window._phaserGame?.scene.getScene('WorldScene');
    
    if (worldScene && worldScene.playerUsernames) {
      // Look up the username in the map
      const username = worldScene.playerUsernames.get(peerId);
      return username || peerId.slice(0, 6) + '...'; // Fallback to ID
    }
  } catch (e) {
    console.error("Error getting username from Phaser scene:", e);
  }
  // Default fallback
  return peerId.slice(0, 6) + '...';
}

const VideoPlayer = ({ stream, peerId }) => {
  const videoRef = useRef();
  
  // Get the username using the helper
  const username = getUsernameFromPeerId(peerId);

  useEffect(() => {
    if (videoRef.current && stream) {
      const videoStream = new MediaStream(stream.getVideoTracks());
      videoRef.current.srcObject = videoStream;
    }
  }, [stream]);

  return (
    <div className="video-container">
      <video ref={videoRef} autoPlay playsInline className="video-element" />
      {/* Display the username */}
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

      // Only update state if the list of peers has actually changed
      if (limitedStreams.length !== remoteStreams.length || 
          limitedStreams.some((s, i) => s[0] !== remoteStreams[i]?.[0])) {
         setRemoteStreams(limitedStreams);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [remoteStreams]);

  return (
    <div className="remote-video-grid-container"> 
      {remoteStreams.map(([peerId, stream]) => (
        <VideoPlayer key={peerId} peerId={peerId} stream={stream} />
      ))}
    </div>
  );
}