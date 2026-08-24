// WebRTC & Teleconsultation Video / Audio Synchronization Engine

export interface SignalMessage {
  id?: string;
  sender: 'customer' | 'pharmacist';
  type: 'offer' | 'answer' | 'candidate' | 'frame' | 'status' | 'ping' | 'pong';
  data: any;
  timestamp?: number;
  seq?: number;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

// Global AudioContext singleton to preserve unlocked state across all user interactions
let sharedAudioCtx: AudioContext | null = null;

export const getSharedAudioContext = (): AudioContext | null => {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
};

// Call on any user action (button click, tap, enter call) to unlock browser audio autoplay
export const unlockAudio = () => {
  try {
    const ctx = getSharedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  } catch (e) {}
};

// Automatically listen for user gestures to unlock audio context globally
if (typeof window !== 'undefined') {
  const unlockEvents = ['click', 'touchstart', 'mousedown', 'keydown', 'pointerdown'];
  const handleInteraction = () => {
    unlockAudio();
  };
  unlockEvents.forEach(evt => window.addEventListener(evt, handleInteraction, { passive: true }));
}

// Ensures audio and video HTML elements start playback reliably even if browser autoplay restrictions exist
export const ensureMediaElementPlayback = (el: HTMLMediaElement | null) => {
  if (!el) return;
  unlockAudio();
  try {
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const onUserInteract = () => {
          unlockAudio();
          el.play().catch(() => {});
          window.removeEventListener('click', onUserInteract);
          window.removeEventListener('touchstart', onUserInteract);
          window.removeEventListener('pointerdown', onUserInteract);
        };
        window.addEventListener('click', onUserInteract, { once: true, passive: true });
        window.addEventListener('touchstart', onUserInteract, { once: true, passive: true });
        window.addEventListener('pointerdown', onUserInteract, { once: true, passive: true });
      });
    }
  } catch (e) {}
};

// Loud, resonant multi-tone alert chime for incoming calls & consultation requests
export const playIncomingCallChime = () => {
  try {
    unlockAudio();
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    // Sequence of 4 ringing harmony notes (E5 -> G#5 -> B5 -> E6)
    const tones = [
      { freq: 659.25, start: 0.0, dur: 0.28, gain: 0.65 },
      { freq: 830.61, start: 0.14, dur: 0.32, gain: 0.75 },
      { freq: 987.77, start: 0.28, dur: 0.45, gain: 0.85 },
      { freq: 1318.51, start: 0.44, dur: 0.75, gain: 0.9 }
    ];

    tones.forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, now + t.start);
      
      // Dynamic bell envelope
      gain.gain.setValueAtTime(0.001, now + t.start);
      gain.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.start + t.dur);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now + t.start);
      osc.stop(now + t.start + t.dur + 0.05);
    });
  } catch (err) {
    console.warn('Audio chime warning:', err);
  }
};

// Call Connected positive chime (upward major chord)
export const playCallConnectedChime = () => {
  try {
    unlockAudio();
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.6, now);
    masterGain.connect(ctx.destination);

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.4, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.35);
    });
  } catch (err) {}
};

// Message notification sound (loud, crisp high-definition double bubble chime)
export const playMessageNotificationSound = () => {
  try {
    unlockAudio();
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.8, now);
    masterGain.connect(ctx.destination);
    
    // First high ping
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.09);
    gain1.gain.setValueAtTime(0.7, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.19);

    // Second chime chord
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.11);
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.22); // A6
    gain2.gain.setValueAtTime(0.8, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.11);
    osc2.stop(now + 0.36);
  } catch (err) {
    console.warn('Notification sound error:', err);
  }
};

// Text to Speech for Sonan AI Pharmacist Voice Guidance
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    try {
      cachedVoices = window.speechSynthesis.getVoices() || [];
    } catch (e) {}
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export const speakTextWithVoice = (text: string, onEnd?: () => void) => {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const cleanText = text
      .replace(/[*#_`~[\]]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/ETB/g, 'Ethiopian Birr')
      .replace(/[💊💄🩺💰✅👋•]/g, '')
      .replace(/\n+/g, '. ')
      .slice(0, 500);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.volume = 1.0;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith('en') && (
        v.name.includes('Natural') || 
        v.name.includes('Google') || 
        v.name.includes('Samantha') || 
        v.name.includes('Jenny') ||
        v.name.includes('Female')
      )
    ) || voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
    if (onEnd) onEnd();
  }
};

export const stopVoiceSpeech = () => {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch (err) {}
};

/**
 * Creates a high-fidelity animated synthetic canvas stream and WebAudio audio track
 * Ensures video and audio call ALWAYS work reliably even when hardware cameras/mics are
 * unavailable, denied by browser permission, or running inside restricted iframes.
 */
export const createSyntheticMediaStream = (
  displayName: string, 
  role: 'pharmacist' | 'customer'
): MediaStream => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let animFrameId: number;
  let startTime = Date.now();

  const drawFrame = () => {
    if (!ctx) return;
    const now = Date.now();
    const elapsed = (now - startTime) / 1000;

    // Dark sleek background
    const bgGradient = ctx.createLinearGradient(0, 0, 640, 480);
    if (role === 'pharmacist') {
      bgGradient.addColorStop(0, '#0f172a');
      bgGradient.addColorStop(0.5, '#1e1b4b');
      bgGradient.addColorStop(1, '#090d16');
    } else {
      bgGradient.addColorStop(0, '#042f2e');
      bgGradient.addColorStop(0.5, '#064e3b');
      bgGradient.addColorStop(1, '#022c22');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 640, 480);

    // Subtle pulsating radial aura
    const pulseSize = 140 + Math.sin(elapsed * 2.5) * 18;
    const auraGradient = ctx.createRadialGradient(320, 220, 20, 320, 220, pulseSize);
    if (role === 'pharmacist') {
      auraGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
      auraGradient.addColorStop(0.7, 'rgba(147, 51, 234, 0.15)');
      auraGradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
    } else {
      auraGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
      auraGradient.addColorStop(0.7, 'rgba(5, 150, 105, 0.15)');
      auraGradient.addColorStop(1, 'rgba(4, 47, 46, 0)');
    }
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(320, 220, pulseSize, 0, Math.PI * 2);
    ctx.fill();

    // Central Avatar Ring
    ctx.beginPath();
    ctx.arc(320, 220, 75, 0, Math.PI * 2);
    ctx.fillStyle = role === 'pharmacist' ? '#581c87' : '#065f46';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = role === 'pharmacist' ? '#c084fc' : '#34d399';
    ctx.stroke();

    // Icon or Initial in center
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (displayName || (role === 'pharmacist' ? 'Sonan Pharmacist' : 'Patient')).charAt(0).toUpperCase();
    ctx.fillText(initial, 320, 220);

    // Role Badge Banner
    ctx.fillStyle = role === 'pharmacist' ? 'rgba(147, 51, 234, 0.9)' : 'rgba(5, 150, 105, 0.9)';
    ctx.beginPath();
    ctx.roundRect(200, 310, 240, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(role === 'pharmacist' ? '👨‍⚕️ SONAN PHARMACY' : '🩺 TELECONSULT PATIENT', 320, 327);

    // Name Label
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(displayName || (role === 'pharmacist' ? 'Sonan Pharmacist' : 'Patient'), 320, 370);

    // Dynamic Live Waveform Bars at bottom
    const barCount = 18;
    const barWidth = 10;
    const spacing = 6;
    const startX = 320 - ((barCount * (barWidth + spacing)) / 2);
    for (let i = 0; i < barCount; i++) {
      const h = 12 + Math.abs(Math.sin(elapsed * 4 + i * 0.45)) * 32;
      const x = startX + i * (barWidth + spacing);
      const y = 430 - h;
      ctx.fillStyle = role === 'pharmacist' ? '#a855f7' : '#10b981';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, 4);
      ctx.fill();
    }

    // Top Header Status: LIVE HD 60FPS
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 160, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(36, 35, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LIVE TELECONSULT', 48, 38);

    // Virtual Camera Indicator
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(460, 20, 160, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('HD VIRTUAL CAMERA', 605, 38);

    animFrameId = requestAnimationFrame(drawFrame);
  };

  animFrameId = requestAnimationFrame(drawFrame);

  // Capture canvas video stream
  let stream: MediaStream;
  if ((canvas as any).captureStream) {
    stream = (canvas as any).captureStream(25);
  } else {
    // Fallback: create empty stream
    stream = new MediaStream();
  }

  // Create an audio track using WebAudio Analyser & Oscillator
  const audioCtx = getSharedAudioContext();
  if (audioCtx) {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const dest = audioCtx.createMediaStreamDestination();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // very quiet/inaudible but active track
      
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      
      dest.stream.getAudioTracks().forEach(track => {
        stream.addTrack(track);
      });
    } catch (e) {
      console.warn('Synthetic audio track error:', e);
    }
  }

  // When all tracks are stopped, cancel canvas animation loop
  const origStop = stream.getVideoTracks()[0]?.stop;
  if (stream.getVideoTracks()[0]) {
    stream.getVideoTracks()[0].stop = function() {
      cancelAnimationFrame(animFrameId);
      if (origStop) origStop.call(this);
    };
  }

  return stream;
};

/**
 * Intelligent Media Stream Acquisition with Guaranteed Fallback
 * Attempts real camera & mic; seamlessly falls back to synthetic video/audio
 * if permission is denied or no physical hardware camera/mic is connected.
 */
export const acquireMediaStream = async (options: {
  role: 'pharmacist' | 'customer';
  displayName: string;
  forceVirtual?: boolean;
}): Promise<{
  stream: MediaStream;
  isVirtualCamera: boolean;
  isVirtualMic: boolean;
  errorMessage?: string;
}> => {
  const { role, displayName, forceVirtual } = options;

  if (forceVirtual) {
    const syntheticStream = createSyntheticMediaStream(displayName, role);
    return { stream: syntheticStream, isVirtualCamera: true, isVirtualMic: true };
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // 1. Try Full Hardware Video + Audio
    try {
      const fullStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      return { stream: fullStream, isVirtualCamera: false, isVirtualMic: false };
    } catch (fullErr: any) {
      console.warn('Real camera+mic acquisition note:', fullErr?.message || fullErr);

      // 2. Try Audio-only + Synthetic Video
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        const synthetic = createSyntheticMediaStream(displayName, role);
        const hybridStream = new MediaStream();
        
        // Add synthetic video track
        synthetic.getVideoTracks().forEach(t => hybridStream.addTrack(t));
        // Add real audio track
        audioStream.getAudioTracks().forEach(t => hybridStream.addTrack(t));

        return { 
          stream: hybridStream, 
          isVirtualCamera: true, 
          isVirtualMic: false,
          errorMessage: 'Webcam not detected or blocked; using HD Virtual Camera with live microphone.'
        };
      } catch (audioErr: any) {
        console.warn('Microphone also unavailable; using complete HD Virtual Feed.');
      }
    }
  }

  // 3. Complete Synthetic Fallback (guaranteed to succeed anywhere)
  const fallbackSynthetic = createSyntheticMediaStream(displayName, role);
  return {
    stream: fallbackSynthetic,
    isVirtualCamera: true,
    isVirtualMic: true,
    errorMessage: 'Camera/Mic not accessible in current environment; active in HD Virtual Avatar Mode.'
  };
};

export class TeleconsultRTCManager {
  public sessionId: string;
  public role: 'customer' | 'pharmacist';
  private polite: boolean;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: any = null;
  private heartbeatInterval: any = null;
  private frameInterval: any = null;
  private audioAnalyserInterval: any = null;
  private lastSignalSeq = 0;
  private startTime = Date.now() - 4000;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private processedSignalIds = new Set<string>();
  
  // Perfect Negotiation state flags
  private makingOffer = false;
  private isSettingRemoteAnswerPending = false;
  
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onRemoteFrameCallback: ((dataUrl: string) => void) | null = null;
  private onPeerStatusCallback: ((status: { video?: boolean; audio?: boolean; connected?: boolean; isVirtual?: boolean }) => void) | null = null;
  private onAudioLevelCallback: ((levels: { local: number; remote: number }) => void) | null = null;
  
  private canvas: HTMLCanvasElement | null = null;
  private tempVideo: HTMLVideoElement | null = null;
  private localAudioNode: AnalyserNode | null = null;
  private remoteAudioNode: AnalyserNode | null = null;
  private localSourceNode: MediaStreamAudioSourceNode | null = null;
  private remoteSourceNode: MediaStreamAudioSourceNode | null = null;
  private remoteSilentGain: GainNode | null = null;

  constructor(sessionId: string, role: 'customer' | 'pharmacist') {
    this.sessionId = sessionId;
    this.role = role;
    this.polite = role === 'customer';
    this.remoteStream = new MediaStream();

    this.initPeerConnection();
    this.initBroadcastChannel();
    this.initSignalingPoller();
    this.startAudioLevelAnalyzer();
    this.startHeartbeat();
  }

  private initPeerConnection() {
    if (typeof RTCPeerConnection === 'undefined') return;

    try {
      if (this.pc) {
        try { this.pc.close(); } catch (e) {}
      }

      this.pc = new RTCPeerConnection(RTC_CONFIG);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      // Pre-add transceivers with sendrecv to ensure both audio & video m-lines are created
      try {
        this.pc.addTransceiver('audio', { direction: 'sendrecv' });
        this.pc.addTransceiver('video', { direction: 'sendrecv' });
      } catch (e) {}

      // Handle ICE Candidates generated locally
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal('candidate', event.candidate.toJSON ? event.candidate.toJSON() : event.candidate);
        }
      };

      // Handle incoming remote tracks (audio & video)
      this.pc.ontrack = (event) => {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }

        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach(track => {
            if (!this.remoteStream!.getTracks().some(t => t.id === track.id)) {
              this.remoteStream!.addTrack(track);
            }
          });
        } else if (event.track) {
          if (!this.remoteStream.getTracks().some(t => t.id === event.track.id)) {
            this.remoteStream.addTrack(event.track);
          }
        }

        event.track.onunmute = () => {
          if (this.onRemoteStreamCallback && this.remoteStream) {
            this.onRemoteStreamCallback(this.remoteStream);
          }
          this.notifyPeerStatus();
        };
        event.track.onmute = () => {
          this.notifyPeerStatus();
        };
        event.track.onended = () => {
          this.notifyPeerStatus();
        };

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }

        if (event.track.kind === 'audio') {
          this.setupRemoteAudioAnalysis(this.remoteStream);
        }

        this.notifyPeerStatus();
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') {
          playCallConnectedChime();
          this.notifyPeerStatus();
        } else if (state === 'failed' || state === 'disconnected') {
          if (this.role === 'pharmacist') {
            this.createAndSendOffer(true);
          }
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          this.notifyPeerStatus();
        } else if (state === 'failed') {
          if (this.pc && typeof (this.pc as any).restartIce === 'function') {
            (this.pc as any).restartIce();
          } else if (this.role === 'pharmacist') {
            this.createAndSendOffer(true);
          }
        }
      };

      this.pc.onnegotiationneeded = async () => {
        try {
          this.makingOffer = true;
          const offer = await this.pc?.createOffer();
          if (offer && this.pc?.signalingState !== 'closed') {
            await this.pc?.setLocalDescription(offer);
            if (this.pc?.localDescription) {
              this.sendSignal('offer', this.pc.localDescription.toJSON ? this.pc.localDescription.toJSON() : this.pc.localDescription);
            }
          }
        } catch (err) {
          console.warn('WebRTC negotiationneeded offer error:', err);
        } finally {
          this.makingOffer = false;
        }
      };
    } catch (err) {
      console.warn('WebRTC RTCPeerConnection initialization error:', err);
    }
  }

  private notifyPeerStatus() {
    if (!this.onPeerStatusCallback || !this.remoteStream) return;
    this.onPeerStatusCallback({
      connected: true,
      video: this.remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live'),
      audio: this.remoteStream.getAudioTracks().some(t => t.enabled && t.readyState === 'live')
    });
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(`sonan_rtc_${this.sessionId}`);
        this.broadcastChannel.onmessage = (event) => {
          const msg: SignalMessage = event.data;
          if (msg && msg.sender !== this.role) {
            this.handleSignal(msg);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }
  }

  private initSignalingPoller() {
    this.pollInterval = setInterval(async () => {
      try {
        const queryParams = this.lastSignalSeq > 0 
          ? `sinceSeq=${this.lastSignalSeq}&sender=${this.role}` 
          : `since=${this.startTime}&sender=${this.role}`;

        const res = await fetch(`/api/teleconsultations/${this.sessionId}/signals?${queryParams}`);
        if (res.ok) {
          const { signals, peerStatus, peerLatestFrame, maxSeq } = await res.json();
          
          if (peerStatus && this.onPeerStatusCallback) {
            const remoteStatus = this.role === 'pharmacist' 
              ? { video: peerStatus.customerVideo, audio: peerStatus.customerAudio, connected: true }
              : { video: peerStatus.pharmacistVideo, audio: peerStatus.pharmacistAudio, connected: true };
            this.onPeerStatusCallback(remoteStatus);
          }

          if (peerLatestFrame && this.onRemoteFrameCallback) {
            this.onRemoteFrameCallback(peerLatestFrame);
          }

          if (signals && signals.length > 0) {
            for (const sig of signals) {
              if (sig.seq && sig.seq > this.lastSignalSeq) {
                this.lastSignalSeq = sig.seq;
              }
              if (sig.sender !== this.role) {
                this.handleSignal(sig);
              }
            }
          }

          if (maxSeq && maxSeq > this.lastSignalSeq) {
            this.lastSignalSeq = maxSeq;
          }
        }
      } catch (err) {}
    }, 300);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendSignal('ping', { role: this.role, time: Date.now() });
    }, 2000);
  }

  public async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    this.sendPeerStatus(
      !!stream && stream.getVideoTracks().some(t => t.enabled),
      !!stream && stream.getAudioTracks().some(t => t.enabled)
    );

    if (this.pc && stream) {
      const transceivers = this.pc.getTransceivers ? this.pc.getTransceivers() : [];
      const audioTransceiver = transceivers.find(t => t.receiver?.track?.kind === 'audio' || t.sender?.track?.kind === 'audio');
      const videoTransceiver = transceivers.find(t => t.receiver?.track?.kind === 'video' || t.sender?.track?.kind === 'video');

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        if (audioTransceiver && audioTransceiver.sender) {
          try {
            await audioTransceiver.sender.replaceTrack(audioTracks[0]);
            audioTransceiver.direction = 'sendrecv';
          } catch (e) {
            try { this.pc.addTrack(audioTracks[0], stream); } catch (err) {}
          }
        } else {
          try { this.pc.addTrack(audioTracks[0], stream); } catch (err) {}
        }
      }

      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        if (videoTransceiver && videoTransceiver.sender) {
          try {
            await videoTransceiver.sender.replaceTrack(videoTracks[0]);
            videoTransceiver.direction = 'sendrecv';
          } catch (e) {
            try { this.pc.addTrack(videoTracks[0], stream); } catch (err) {}
          }
        } else {
          try { this.pc.addTrack(videoTracks[0], stream); } catch (err) {}
        }
      }

      this.setupLocalAudioAnalysis(stream);

      if (this.role === 'pharmacist') {
        setTimeout(() => {
          this.createAndSendOffer();
        }, 120);
      } else {
        this.sendSignal('ping', { ready: true });
      }
    }

    if (stream && stream.getVideoTracks().length > 0) {
      this.startFrameBroadcaster(stream);
    } else {
      this.stopFrameBroadcaster();
    }
  }

  public async createAndSendOffer(iceRestart = false) {
    if (!this.pc || this.makingOffer) return;
    try {
      this.makingOffer = true;
      const offer = await this.pc.createOffer({
        iceRestart,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      if (this.pc.signalingState === 'closed') return;

      await this.pc.setLocalDescription(offer);
      this.sendSignal('offer', this.pc.localDescription?.toJSON ? this.pc.localDescription.toJSON() : this.pc.localDescription);
    } catch (err) {
      console.warn('Error creating WebRTC offer:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleSignal(msg: SignalMessage) {
    try {
      const sigKey = msg.id || (msg.type + '_' + msg.sender + '_' + (msg.seq || msg.timestamp || ''));
      if (this.processedSignalIds.has(sigKey) && msg.type !== 'frame') {
        return;
      }
      this.processedSignalIds.add(sigKey);
      if (this.processedSignalIds.size > 300) {
        const first = this.processedSignalIds.values().next().value;
        if (first) this.processedSignalIds.delete(first);
      }

      if (msg.type === 'frame' && msg.data) {
        if (this.onRemoteFrameCallback) {
          this.onRemoteFrameCallback(msg.data);
        }
        return;
      }

      if (msg.type === 'status' && msg.data) {
        if (this.onPeerStatusCallback) {
          this.onPeerStatusCallback(msg.data);
        }
        return;
      }

      if (msg.type === 'ping') {
        if (this.role === 'pharmacist' && this.pc && this.pc.signalingState === 'stable') {
          this.createAndSendOffer();
        }
        return;
      }

      if (!this.pc) return;

      if (msg.type === 'offer' && msg.data) {
        const readyForOffer = !this.makingOffer && (this.pc.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
        const offerCollision = !readyForOffer;
        const ignoreOffer = !this.polite && offerCollision;

        if (ignoreOffer) {
          return;
        }

        const offerDesc = new RTCSessionDescription(msg.data);
        if (offerCollision) {
          try {
            await Promise.all([
              this.pc.setLocalDescription({ type: 'rollback' } as any),
              this.pc.setRemoteDescription(offerDesc)
            ]);
          } catch (rbErr) {
            await this.pc.setRemoteDescription(offerDesc);
          }
        } else {
          await this.pc.setRemoteDescription(offerDesc);
        }

        await this.flushPendingCandidates();

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal('answer', this.pc.localDescription?.toJSON ? this.pc.localDescription.toJSON() : this.pc.localDescription);
      } else if (msg.type === 'answer' && msg.data) {
        const answerDesc = new RTCSessionDescription(msg.data);
        if (this.pc.signalingState === 'have-local-offer') {
          this.isSettingRemoteAnswerPending = true;
          try {
            await this.pc.setRemoteDescription(answerDesc);
          } finally {
            this.isSettingRemoteAnswerPending = false;
          }
          await this.flushPendingCandidates();
        }
      } else if (msg.type === 'candidate' && msg.data) {
        const candidateData = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        if (candidateData) {
          if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(candidateData));
            } catch (e) {
              this.pendingCandidates.push(candidateData);
            }
          } else {
            this.pendingCandidates.push(candidateData);
          }
        }
      }
    } catch (err) {
      console.warn('WebRTC handleSignal error:', err);
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) return;
    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {}
      }
    }
  }

  public onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
    if (this.remoteStream && this.remoteStream.getTracks().length > 0) {
      callback(this.remoteStream);
    }
  }

  public onRemoteFrame(callback: (dataUrl: string) => void) {
    this.onRemoteFrameCallback = callback;
  }

  public onPeerStatus(callback: (status: { video?: boolean; audio?: boolean; connected?: boolean; isVirtual?: boolean }) => void) {
    this.onPeerStatusCallback = callback;
  }

  public onAudioLevel(callback: (levels: { local: number; remote: number }) => void) {
    this.onAudioLevelCallback = callback;
  }

  public sendSignal(type: SignalMessage['type'], data: any) {
    const id = `${this.role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msg: SignalMessage = {
      id,
      sender: this.role,
      type,
      data,
      timestamp: Date.now()
    };

    this.processedSignalIds.add(id);

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {}
    }

    fetch(`/api/teleconsultations/${this.sessionId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    }).catch(() => {});
  }

  public sendPeerStatus(videoActive: boolean, audioActive: boolean) {
    fetch(`/api/teleconsultations/${this.sessionId}/peer-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: this.role,
        videoActive,
        audioActive
      })
    }).catch(() => {});
  }

  private startFrameBroadcaster(stream: MediaStream) {
    this.stopFrameBroadcaster();

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 400;
      this.canvas.height = 300;
    }

    if (!this.tempVideo) {
      this.tempVideo = document.createElement('video');
      this.tempVideo.autoplay = true;
      this.tempVideo.playsInline = true;
      this.tempVideo.muted = true;
    }

    this.tempVideo.srcObject = stream;
    this.tempVideo.play().catch(() => {});

    const ctx = this.canvas.getContext('2d');

    let tickCount = 0;
    this.frameInterval = setInterval(() => {
      tickCount++;
      if (this.tempVideo && this.tempVideo.readyState >= 2 && ctx && this.canvas) {
        try {
          ctx.drawImage(this.tempVideo, 0, 0, this.canvas.width, this.canvas.height);
          const frameData = this.canvas.toDataURL('image/jpeg', 0.6);
          
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              sender: this.role,
              type: 'frame',
              data: frameData,
              timestamp: Date.now()
            });
          }

          if (tickCount % 3 === 0) {
            this.sendSignal('frame', frameData);
          }
        } catch (err) {}
      }
    }, 100);
  }

  private stopFrameBroadcaster() {
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    if (this.tempVideo) {
      this.tempVideo.srcObject = null;
    }
  }

  private setupLocalAudioAnalysis(stream: MediaStream) {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const ctx = getSharedAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      if (this.localSourceNode) {
        try { this.localSourceNode.disconnect(); } catch (e) {}
      }

      this.localSourceNode = ctx.createMediaStreamSource(stream);
      this.localAudioNode = ctx.createAnalyser();
      this.localAudioNode.fftSize = 64;
      this.localSourceNode.connect(this.localAudioNode);
    } catch (e) {
      console.warn('Local audio analysis setup error:', e);
    }
  }

  private setupRemoteAudioAnalysis(stream: MediaStream) {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const ctx = getSharedAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      if (this.remoteSourceNode) {
        try { this.remoteSourceNode.disconnect(); } catch (e) {}
      }

      this.remoteSourceNode = ctx.createMediaStreamSource(stream);
      this.remoteAudioNode = ctx.createAnalyser();
      this.remoteAudioNode.fftSize = 64;
      this.remoteSourceNode.connect(this.remoteAudioNode);

      if (!this.remoteSilentGain) {
        this.remoteSilentGain = ctx.createGain();
        this.remoteSilentGain.gain.setValueAtTime(1.0, ctx.currentTime); // Fully audible high-fidelity audio output
        this.remoteSilentGain.connect(ctx.destination);
      }
      this.remoteAudioNode.connect(this.remoteSilentGain);
    } catch (e) {
      console.warn('Remote audio analysis setup error:', e);
    }
  }

  public setSpeakerVolume(volume: number) {
    try {
      const ctx = getSharedAudioContext();
      if (this.remoteSilentGain && ctx) {
        this.remoteSilentGain.gain.setValueAtTime(Math.max(0, Math.min(1.5, volume)), ctx.currentTime);
      }
    } catch (e) {}
  }

  public resumeAudioContext() {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }

  private startAudioLevelAnalyzer() {
    const localData = new Uint8Array(32);
    const remoteData = new Uint8Array(32);

    this.audioAnalyserInterval = setInterval(() => {
      let loc = 0;
      let rem = 0;

      if (this.localAudioNode) {
        try {
          this.localAudioNode.getByteFrequencyData(localData);
          let sum = 0;
          for (let i = 0; i < localData.length; i++) sum += localData[i];
          loc = Math.min(100, Math.round((sum / (localData.length * 255)) * 160));
        } catch (e) {}
      }

      if (this.remoteAudioNode) {
        try {
          this.remoteAudioNode.getByteFrequencyData(remoteData);
          let sum = 0;
          for (let i = 0; i < remoteData.length; i++) sum += remoteData[i];
          rem = Math.min(100, Math.round((sum / (remoteData.length * 255)) * 160));
        } catch (e) {}
      }

      if (this.onAudioLevelCallback) {
        this.onAudioLevelCallback({ local: loc, remote: rem });
      }
    }, 100);
  }

  public destroy() {
    this.stopFrameBroadcaster();
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.audioAnalyserInterval) {
      clearInterval(this.audioAnalyserInterval);
      this.audioAnalyserInterval = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    if (this.localSourceNode) {
      try { this.localSourceNode.disconnect(); } catch (e) {}
      this.localSourceNode = null;
    }
    if (this.remoteSourceNode) {
      try { this.remoteSourceNode.disconnect(); } catch (e) {}
      this.remoteSourceNode = null;
    }
    if (this.remoteSilentGain) {
      try { this.remoteSilentGain.disconnect(); } catch (e) {}
      this.remoteSilentGain = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    this.remoteStream = null;
    this.localStream = null;
  }
}
