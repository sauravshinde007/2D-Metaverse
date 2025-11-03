// client/src/services/peerService.js
import Peer from 'peerjs';

class PeerService {
  constructor() {
    this.peer = null;
    this.localStream = null;
    this.activeCalls = new Map(); // Map of peerId -> call object
    this.onCallReceivedCallback = null;
    this.onStreamReceivedCallback = null;
    this.onCallEndedCallback = null;
  }

  /**
   * Initialize PeerJS connection
   * @param {string} userId - Unique user ID (socket ID)
   */
  async initialize(userId) {
    // Don't re-initialize if already connected
    if (this.peer && !this.peer.destroyed) {
      console.log('⚠️ PeerJS already initialized');
      return this.peer.id;
    }

    return new Promise((resolve, reject) => {
      try {
        // Connect to PeerJS server running on your backend
        this.peer = new Peer(userId, {
          host: 'localhost', // Change this to your server host in production
          port: 3001,
          path: '/peerjs', // Path matches the Express mount point
          secure: false,
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
          
          // Handle specific error types
          if (error.type === 'network' || error.type === 'server-error') {
            console.error('⚠️ Cannot connect to PeerJS server. Make sure server is running on port 3001');
          } else if (error.type === 'peer-unavailable') {
            console.error('⚠️ Remote peer is not available');
          }
          
          // Don't reject immediately on network errors, try to reconnect
          if (error.type !== 'network') {
            reject(error);
          }
        });

        // Listen for incoming calls
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
   * @param {boolean} video - Enable video
   * @param {boolean} audio - Enable audio
   */
  async getUserMedia(video = false, audio = true) {
    try {
      console.log('Requesting media with constraints:', { video, audio });
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
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
      
      if (this.onStreamReceivedCallback) {
        this.onStreamReceivedCallback(remotePeerId, remoteStream);
      }
    });

    call.on('close', () => {
      console.log('📴 Call closed with:', remotePeerId);
      this.activeCalls.delete(remotePeerId);
      
      if (this.onCallEndedCallback) {
        this.onCallEndedCallback(remotePeerId);
      }
    });

    call.on('error', (error) => {
      console.error('Call error with', remotePeerId, ':', error);
      this.activeCalls.delete(remotePeerId);
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
      
      if (this.onStreamReceivedCallback) {
        this.onStreamReceivedCallback(call.peer, remoteStream);
      }
    });

    call.on('close', () => {
      console.log('📴 Call closed with:', call.peer);
      this.activeCalls.delete(call.peer);
      
      if (this.onCallEndedCallback) {
        this.onCallEndedCallback(call.peer);
      }
    });

    call.on('error', (error) => {
      console.error('Call error with', call.peer, ':', error);
      this.activeCalls.delete(call.peer);
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
  }

  /**
   * Mute/unmute local audio
   * @param {boolean} muted 
   */
  setAudioMuted(muted) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Set callback for when stream is received
   * @param {Function} callback 
   */
  onStreamReceived(callback) {
    this.onStreamReceivedCallback = callback;
  }

  /**
   * Set callback for when call ends
   * @param {Function} callback 
   */
  onCallEnded(callback) {
    this.onCallEndedCallback = callback;
  }

  /**
   * Get list of active call peer IDs
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.keys());
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
  }
}

export default new PeerService();
