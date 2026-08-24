/**
 * Voice Assistant Speech Engine
 * Supports Web Speech API (SpeechRecognition + SpeechSynthesis)
 * with English ('en-US'), Amharic ('am-ET'), and Afaan Oromoo ('om-ET') support, plus Web Audio sound effects.
 */

export type VoiceLanguage = 'en' | 'am' | 'om';

export interface VoiceEngineConfig {
  language: VoiceLanguage;
  isMuted: boolean;
  onListeningChange?: (isListening: boolean) => void;
  onTranscriptChange?: (interimTranscript: string, finalTranscript?: string) => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  onError?: (error: string) => void;
}

class VoiceAssistantEngine {
  private recognition: any = null;
  private isListening = false;
  private isSpeaking = false;
  private language: VoiceLanguage = 'en';
  private isMuted = false;
  private audioCtx: AudioContext | null = null;
  private callbacks: Partial<VoiceEngineConfig> = {};

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition API is not supported on this browser.');
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.updateRecognitionLanguage();

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onListeningChange?.(true);
        this.playTone(440, 0.08, 'sine'); // chime on start
      };

      this.recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        this.callbacks.onTranscriptChange?.(interim, final);
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.callbacks.onListeningChange?.(false);
        if (event.error !== 'no-speech') {
          this.callbacks.onError?.(`Microphone error: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.callbacks.onListeningChange?.(false);
      };
    } catch (e) {
      console.error('Failed to initialize speech recognition:', e);
    }
  }

  public isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public setConfig(config: Partial<VoiceEngineConfig>) {
    if (config.language && config.language !== this.language) {
      this.language = config.language;
      this.updateRecognitionLanguage();
    }
    if (config.isMuted !== undefined) {
      this.isMuted = config.isMuted;
      if (this.isMuted) {
        this.stopSpeaking();
      }
    }
    this.callbacks = { ...this.callbacks, ...config };
  }

  private updateRecognitionLanguage() {
    if (!this.recognition) return;
    // English (US) vs Amharic (Ethiopia) vs Afaan Oromoo (Ethiopia)
    if (this.language === 'am') {
      this.recognition.lang = 'am-ET';
    } else if (this.language === 'om') {
      this.recognition.lang = 'om-ET';
    } else {
      this.recognition.lang = 'en-US';
    }
  }

  public startListening() {
    if (this.isSpeaking) {
      this.stopSpeaking();
    }

    if (!this.recognition) {
      this.initSpeechRecognition();
      if (!this.recognition) {
        this.callbacks.onError?.('Speech recognition is not supported in this browser. Please use text input.');
        return;
      }
    }

    try {
      this.updateRecognitionLanguage();
      this.recognition.start();
    } catch (e: any) {
      // If already started or aborting
      try {
        this.recognition.stop();
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch {
            // ignore
          }
        }, 150);
      } catch {
        // ignore
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.playTone(330, 0.08, 'sine'); // chime on stop
      } catch (e) {
        console.warn('Error stopping speech recognition:', e);
      }
    }
    this.isListening = false;
    this.callbacks.onListeningChange?.(false);
  }

  public speak(text: string, langOverride?: VoiceLanguage): Promise<void> {
    if (this.isMuted || !text) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        if (!('speechSynthesis' in window)) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();

        const cleanText = text
          .replace(/[*#`_~\[\]()]/g, '')
          .replace(/\bETB\b/g, 'Ethiopian Birr')
          .replace(/\bqty\b/gi, 'quantity')
          .replace(/https?:\/\/\S+/g, '')
          .trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const targetLang = langOverride || this.language;
        if (targetLang === 'am') {
          utterance.lang = 'am-ET';
        } else if (targetLang === 'om') {
          utterance.lang = 'om-ET';
        } else {
          utterance.lang = 'en-US';
        }
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        if (targetLang === 'am') {
          const amVoice = voices.find(v => v.lang.startsWith('am') || v.lang.includes('ETH'));
          if (amVoice) utterance.voice = amVoice;
        } else if (targetLang === 'om') {
          const omVoice = voices.find(v => v.lang.startsWith('om') || v.lang.toLowerCase().includes('oromo'));
          if (omVoice) {
            utterance.voice = omVoice;
          } else {
            // Fallback to clear neutral voice
            const fallbackVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google')));
            if (fallbackVoice) utterance.voice = fallbackVoice;
          }
        } else {
          const enVoice = voices.find(v => (v.lang === 'en-US' || v.lang === 'en-GB') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha')));
          if (enVoice) utterance.voice = enVoice;
        }

        utterance.onstart = () => {
          this.isSpeaking = true;
          this.callbacks.onSpeakingChange?.(true);
        };

        utterance.onend = () => {
          this.isSpeaking = false;
          this.callbacks.onSpeakingChange?.(false);
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn('Speech synthesis error:', e);
          this.isSpeaking = false;
          this.callbacks.onSpeakingChange?.(false);
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis playback failed:', err);
        this.isSpeaking = false;
        this.callbacks.onSpeakingChange?.(false);
        resolve();
      }
    });
  }

  public stopSpeaking() {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    this.isSpeaking = false;
    this.callbacks.onSpeakingChange?.(false);
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.audioCtx) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      }
    } catch {
      // Audio context may be restricted before user gesture
    }
  }
}

export const voiceEngine = new VoiceAssistantEngine();
