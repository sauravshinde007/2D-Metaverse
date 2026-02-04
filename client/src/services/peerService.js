// client/src/services/peerService.js
import Peer from 'peerjs';

class PeerService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.activeCalls = new Map(); // Map of peerId -> call object
    this.remoteStreams = new Map(); // <-- NEW: Map of peerId -> remote stream
    this.streamReceivedListeners = new Set();
    this.callEndedListeners = new Set();
  }


  async initialize(userId) {
    // Don't re-initialize if already connected
    if (this.peer && !this.peer.destroyed) {
      console.log('⚠️ PeerJS already initialized');
      return this.peer.id;
    }

    // 🔧 Derive host/port/secure from your SOCKET_SERVER_URL
    const socketUrl = import.meta.env.VITE_SOCKET_SERVER_URL;
    const url = new URL(socketUrl);

    const host = url.hostname;                 // e.g. w1npgpv2-3001.inc1.devtunnels.ms or localhost
    const secure = url.protocol === 'https:';  // true for https devtunnel, false for http://localhost
    const port = url.port
      ? Number(url.port)
      : secure
        ? 443
        : 80;                                  // sensible defaults when no port is specified

    console.log('🌐 PeerJS config:', { host, port, secure });

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(userId, {
          host,
          port,
          path: '/peerjs',  // must match server mount
          secure,
          debug: 2,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
            ]
          }
        });

        this.peer.on('open', (id) => {
          console.log('✅ PeerJS connected with ID:', id);
          resolve(id);
        });

        this.peer.on('error', (error) => {
          console.error('❌ PeerJS error:', error);
          console.error('Error type:', error.type);

          if (error.type === 'network' || error.type === 'server-error') {
            console.error('⚠️ Cannot connect to PeerJS server. Check host/port and devtunnel.');
          } else if (error.type === 'peer-unavailable') {
            console.error('⚠️ Remote peer is not available');
          }

          if (error.type !== 'network') {
            reject(error);
          }
        });

        this.peer.on('call', (call) => {
          console.log('📞 Incoming call from:', call.peer);
          this.handleIncomingCall(call);
        });

        this.peer.on('disconnected', () => {
          console.log('⚠️ PeerJS disconnected. Attempting to reconnect...');
          this.peer.reconnect();
        });

        this.peer.on('close', () => {
          console.log('❌ PeerJS connection closed');
        });

      } catch (error) {
        console.error('Failed to initialize PeerJS:', error);
        reject(error);
      }
    });
  }


  /**
   * Get user's media stream (audio/video)
   * @param {Object} constraints - MediaStream constraints object (e.g., { audio: true, video: { ... } })
   */
  // <-- CHANGED: Signature now accepts a constraints object
  async getUserMedia(constraints) {
    try {
      console.log('Requesting media with constraints:', constraints);

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      // <-- CHANGED: Use the constraints object directly
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('✅ Local media stream obtained');
      console.log('Audio tracks:', this.localStream.getAudioTracks().length);
      console.log('Video tracks:', this.localStream.getVideoTracks().length);

      // Verify audio track is enabled
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('Audio track label:', audioTracks[0].label);
        console.log('Audio track enabled:', audioTracks[0].enabled);
        console.log('Audio track ready state:', audioTracks[0].readyState);
      }

      // <-- NEW: Disable video by default so user can enable it manually
      this.setVideoEnabled(false);

      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to get user media:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      throw error;
    }
  }

  /**
   * Call another peer
   * @param {string} remotePeerId - The peer ID to call
   */
  callPeer(remotePeerId) {
    if (!this.peer || !this.localStream) {
      console.error('Peer or local stream not initialized');
      return;
    }

    // Don't call if already in a call with this peer
    if (this.activeCalls.has(remotePeerId)) {
      console.log('Already in call with', remotePeerId);
      return;
    }

    console.log('📞 Calling peer:', remotePeerId);
    const call = this.peer.call(remotePeerId, this.localStream);

    call.on('stream', (remoteStream) => {
      console.log('✅ Received stream from:', remotePeerId);
      this.activeCalls.set(remotePeerId, call);
      this.remoteStreams.set(remotePeerId, remoteStream); // <-- NEW

      this.streamReceivedListeners.forEach(cb => cb(remotePeerId, remoteStream));
    });

    call.on('close', () => {
      console.log('📴 Call closed with:', remotePeerId);
      this.activeCalls.delete(remotePeerId);
      this.remoteStreams.delete(remotePeerId); // <-- NEW

      this.callEndedListeners.forEach(cb => cb(remotePeerId));
    });

    call.on('error', (error) => {
      console.error('Call error with', remotePeerId, ':', error);
      this.activeCalls.delete(remotePeerId);
      this.remoteStreams.delete(remotePeerId); // <-- NEW
    });
  }

  /**
   * Handle incoming call
   * @param {Object} call - PeerJS call object
   */
  handleIncomingCall(call) {
    if (!this.localStream) {
      console.error('No local stream available to answer call');
      return;
    }

    // Don't answer if already in a call with this peer
    if (this.activeCalls.has(call.peer)) {
      console.log('Already in call with', call.peer);
      return;
    }

    console.log('✅ Answering call from:', call.peer);
    call.answer(this.localStream);

    call.on('stream', (remoteStream) => {
      console.log('✅ Received stream from:', call.peer);
      this.activeCalls.set(call.peer, call);
      this.remoteStreams.set(call.peer, remoteStream); // <-- NEW

      this.streamReceivedListeners.forEach(cb => cb(call.peer, remoteStream));
    });

    call.on('close', () => {
      console.log('📴 Call closed with:', call.peer);
      this.activeCalls.delete(call.peer);
      this.remoteStreams.delete(call.peer); // <-- NEW

      this.callEndedListeners.forEach(cb => cb(call.peer));
    });

    call.on('error', (error) => {
      console.error('Call error with', call.peer, ':', error);
      this.activeCalls.delete(call.peer);
      this.remoteStreams.delete(call.peer); // <-- NEW
    });
  }

  /**
   * End call with a specific peer
   * @param {string} peerId 
   */
  endCall(peerId) {
    const call = this.activeCalls.get(peerId);
    if (call) {
      call.close();
      this.activeCalls.delete(peerId);
      this.remoteStreams.delete(peerId); // <-- NEW
      console.log('Ended call with:', peerId);
    }
  }

  /**
   * End all active calls
   */
  endAllCalls() {
    this.activeCalls.forEach((call, peerId) => {
      call.close();
      console.log('Ended call with:', peerId);
    });
    this.activeCalls.clear();
    this.remoteStreams.clear(); // <-- NEW
  }

  /**
   * Mute/unmute local audio
   * @param {boolean} muted 
   */
  // <-- NEW: Function to enable/disable audio with HARD STOP (Hardware check)
  /**
   * Enable/disable local audio
   * @param {boolean} enabled 
   */
  async setAudioEnabled(enabled) {
    if (!this.localStream) {
      // If no stream exists yet, we create a placeholder stream if enabling
      if (enabled) {
        // This is a bit chicken-and-egg. Usually we initialize stream first.
        // But let's assume valid flow is: user calls getUserMedia or we handle it here.
        // If we don't have localStream, we can't add tracks.
        // However, we can create one.
        // For now, assume localStream exists (created by initialize or first action).
        // If not, we might need to rely on the caller to start the stream.
        // But let's fail gracefully or auto-init.
      }
      return;
    }

    if (enabled) {
      // Check if we already have an active live audio track
      const existingTrack = this.localStream.getAudioTracks()[0];
      if (existingTrack && existingTrack.readyState === 'live') {
        existingTrack.enabled = true;
        return;
      }

      // Hardware Request
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = tempStream.getAudioTracks()[0];

        this.localStream.addTrack(newAudioTrack);

        // Update active calls
        this.activeCalls.forEach(call => {
          if (call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            const audioSender = senders.find(s => s.track && s.track.kind === 'audio') ||
              senders.find(s => !s.track && s.track === null); // Reuse empty?

            if (audioSender) {
              audioSender.replaceTrack(newAudioTrack).catch(e => console.error("Replace Audio Track failed", e));
            } else {
              // If we originally joined video-only, we might not have an audio sender.
              // In this case, we'd need to addTrack. PeerJS docs say `call.peerConnection.addTrack`.
              // But doing this mid-call requires renegotiation which PeerJS handles... poorly/manually.
              // For now, assuming standard flow (join with at least one, or relying on replaceTrack).
              // If sender doesn't exist, simple replace won't work.
              // We'll log a warning.
              console.warn("No audio sender found to replace.");
            }
          }
        });
      } catch (err) {
        console.error("Failed to enable audio:", err);
      }

    } else {
      // HARD STOP
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
        track.stop();
        this.localStream.removeTrack(track);
      });

      // Notify peers?
      // Optional: sender.replaceTrack(null)
    }
  }

  // <-- NEW: Function to enable/disable video
  /**
   * Enable/disable local video
   * @param {boolean} enabled 
   */
  async setVideoEnabled(enabled) {
    if (!this.localStream) return;

    if (enabled) {
      // Check if we already have an active live video track
      const existingTrack = this.localStream.getVideoTracks()[0];
      if (existingTrack && existingTrack.readyState === 'live') {
        existingTrack.enabled = true;
        return;
      }

      // If no live track, we need to request a new one from hardware
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = tempStream.getVideoTracks()[0];

        // Add to our persistent local stream
        this.localStream.addTrack(newVideoTrack);

        // Update all active peer connections
        this.activeCalls.forEach(call => {
          if (call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video') ||
              senders.find(s => !s.track && s.track === null); // Reuse empty sender if one was stopped? No, usually track is just non-null.

            if (videoSender) {
              videoSender.replaceTrack(newVideoTrack).catch(err => console.error("ReplaceTrack failed", err));
            } else {
              // If we didn't have a video sender, we'd need to addTrack + renegotiate. 
              // PeerJS makes renegotiation hard. 
              // But since we start with video tracks (even if disabled), sender usually exists.
              console.warn("No video sender found to replace track for peer:", call.peer);
            }
          }
        });

      } catch (err) {
        console.error("Failed to enable video (hardware access):", err);
      }

    } else {
      // Disable video = Stop hardware
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false; // Logic signal
        track.stop(); // Hardware signal (Light OFF)
        this.localStream.removeTrack(track); // Allow GC
      });

      // Update peers to know we stopped sending?
      // replaceTrack(null) is often used to stop sending but keep connection alive
      this.activeCalls.forEach(call => {
        if (call.peerConnection) {
          const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            // confusingly, if we just stop the track, the sender might still hold the reference to the dead track.
            // We don't necessarily need to replace with null if the track is stopped, 
            // but doing so is cleaner.
            // sender.replaceTrack(null); 
            // However, replaceTrack(null) might cause the other end to remove the track entirely.
          }
        }
      });
    }
  }

  /**
   * Set callback for when stream is received
   * @param {Function} callback 
   * @returns {Function} unsubscribe
   */
  onStreamReceived(callback) {
    this.streamReceivedListeners.add(callback);
    return () => this.streamReceivedListeners.delete(callback);
  }

  /**
   * Set callback for when call ends
   * @param {Function} callback 
   * @returns {Function} unsubscribe
   */
  onCallEnded(callback) {
    this.callEndedListeners.add(callback);
    return () => this.callEndedListeners.delete(callback);
  }

  /**
   * Get list of active call peer IDs
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.keys());
  }

  // <-- NEW: Function for React to get all remote streams
  /**
   * Get list of [peerId, remoteStream] pairs
   */
  getRemoteStreams() {
    return Array.from(this.remoteStreams.entries());
  }

  /**
   * Cleanup and destroy peer connection
   */
  destroy() {
    this.endAllCalls();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.streamReceivedListeners.clear();
    this.callEndedListeners.clear();
  }
}

export default new PeerService();
