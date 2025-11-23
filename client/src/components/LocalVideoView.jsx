// client/src/components/LocalVideoView.jsx
import React, { useEffect, useRef } from 'react';
import peerService from '../services/peerService';
import '../styles/localvideoview.css'; // We will create this CSS file next

export default function LocalVideoView({ isVisible }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (isVisible && peerService.localStream) {
      // Create a new stream with ONLY the video track
      // This is crucial to prevent audio feedback
      const videoStream = new MediaStream(
        peerService.localStream.getVideoTracks()
      );
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }
    }
  }, [isVisible]); // Re-run when visibility changes

  if (!isVisible) {
    return null; // Don't render anything if video is off
  }

  return (
    <div className="local-video-container">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted // Mute your own video to prevent echo
        className="local-video-element" 
      />
      <span className="local-video-label">Your View</span>
    </div>
  );
}