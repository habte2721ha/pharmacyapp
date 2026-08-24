import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, MessageSquare, PhoneCall, PhoneOff, Mic, MicOff, 
  VideoOff, ShieldCheck, UserCheck, Clock, CheckCircle2, 
  Send, Paperclip, FileText, Pill, AlertCircle, RefreshCw, 
  Search, Plus, Stethoscope, ChevronRight, User, ExternalLink,
  Maximize2, Minimize2, LayoutGrid, Radio, Volume2, Sparkles,
  Share2, Shield, PhoneIncoming, Activity
} from 'lucide-react';
import { TeleconsultationSession, TeleconsultationMessage, Medicine } from '../types';
import { 
  TeleconsultRTCManager, 
  playIncomingCallChime, 
  unlockAudio, 
  ensureMediaElementPlayback, 
  acquireMediaStream 
} from '../utils/teleconsultWebrtc';

interface TeleconsultationManagerProps {
  currentUser?: any;
  initialSessionId?: string | null;
  onClearInitialSessionId?: () => void;
}

export const TeleconsultationManager: React.FC<TeleconsultationManagerProps> = ({ 
  currentUser,
  initialSessionId,
  onClearInitialSessionId
}) => {
  const [sessions, setSessions] = useState<TeleconsultationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId || null);
  const [activeTab, setActiveTab] = useState<'queued' | 'active' | 'completed' | 'all'>('queued');
  const [isPharmacistOnDuty, setIsPharmacistOnDuty] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Pharmacist Chat state
  const [replyText, setReplyText] = useState('');
  const [medsCatalog, setMedsCatalog] = useState<Medicine[]>([]);
  const [selectedMedToAttach, setSelectedMedToAttach] = useState<string>('');
  const [pharmacistNotes, setPharmacistNotes] = useState('');

  // Video Call state
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVirtualCamera, setIsVirtualCamera] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [videoLayout, setVideoLayout] = useState<'split' | 'pip' | 'customerFocus'>('split');
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  
  // Remote Peer Video & Status state
  const [remoteFrameUrl, setRemoteFrameUrl] = useState<string | null>(null);
  const [remotePeerStatus, setRemotePeerStatus] = useState<{ video?: boolean; audio?: boolean; connected?: boolean }>({ video: true, audio: true });
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [hasRemoteVideoTrack, setHasRemoteVideoTrack] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<any>(null);
  const rtcManagerRef = useRef<TeleconsultRTCManager | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const prevQueuedCountRef = useRef<number>(0);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/teleconsultations');
      if (res.ok) {
        const data: TeleconsultationSession[] = await res.json();
        setSessions(data);

        // Check if new queued request came in and play chime
        const currentQueued = data.filter(s => s.status === 'queued').length;
        if (currentQueued > prevQueuedCountRef.current && prevQueuedCountRef.current >= 0) {
          playIncomingCallChime();
        }
        prevQueuedCountRef.current = currentQueued;

        if (!selectedSessionId && data.length > 0) {
          const firstQueued = data.find(s => s.status === 'queued') || data[0];
          setSelectedSessionId(firstQueued.id);
        }
      }
    } catch (err) {
      console.error('Error fetching teleconsultations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicinesCatalog = async () => {
    try {
      const res = await fetch('/api/medicines');
      if (res.ok) {
        const data = await res.json();
        setMedsCatalog(data);
      }
    } catch (err) {
      console.error('Error loading medicines catalog:', err);
    }
  };

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    fetchSessions();
    fetchMedicinesCatalog();
    const interval = setInterval(fetchSessions, 4000);
    return () => clearInterval(interval);
  }, []);

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  useEffect(() => {
    if (selectedSession) {
      setPharmacistNotes(selectedSession.notes || '');
      if (selectedSession.type === 'video') {
        setIsVideoCallActive(true);
        if (selectedSession.status === 'queued') setActiveTab('queued');
        else if (selectedSession.status === 'active') setActiveTab('active');
      }
    }
  }, [selectedSessionId, selectedSession?.type]);

  // Video RTC Setup when Video Call is Active
  useEffect(() => {
    let isCancelled = false;

    if (isVideoCallActive && selectedSessionId) {
      unlockAudio();
      
      // Reset stale signals for clean new call session
      fetch(`/api/teleconsultations/${selectedSessionId}/reset-signals`, { method: 'POST' }).catch(() => {});

      const rtc = new TeleconsultRTCManager(selectedSessionId, 'pharmacist');
      rtcManagerRef.current = rtc;

      rtc.onRemoteStream((stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          ensureMediaElementPlayback(remoteVideoRef.current);
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          ensureMediaElementPlayback(remoteAudioRef.current);
        }
        const hasVideo = stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
        setHasRemoteVideoTrack(hasVideo);
      });

      rtc.onRemoteFrame((dataUrl) => {
        setRemoteFrameUrl(dataUrl);
      });

      rtc.onPeerStatus((status) => {
        setRemotePeerStatus(status);
      });

      rtc.onAudioLevel(({ local, remote }) => {
        setLocalAudioLevel(local);
        setRemoteAudioLevel(remote);
        setIsPatientSpeaking(remote > 12);
      });

      // Acquire media stream (real hardware camera or high fidelity virtual avatar feed)
      acquireMediaStream({
        role: 'pharmacist',
        displayName: currentUser?.name || 'Sonan Pharmacist',
        forceVirtual: isVirtualCamera
      }).then(({ stream, isVirtualCamera: wasVirtual, errorMessage }) => {
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setIsVirtualCamera(wasVirtual);
        if (errorMessage) {
          setMediaNotice(errorMessage);
        } else {
          setMediaNotice(null);
        }

        // Apply initial mute states
        stream.getVideoTracks().forEach(t => { t.enabled = !isVideoMuted; });
        stream.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          ensureMediaElementPlayback(localVideoRef.current);
        }
        rtc.setLocalStream(stream);
      }).catch((err) => {
        console.warn('Error in acquireMediaStream:', err);
      });

      return () => {
        isCancelled = true;
        rtc.destroy();
        rtcManagerRef.current = null;
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
          localStreamRef.current = null;
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null;
        }
      };
    } else {
      if (rtcManagerRef.current) {
        rtcManagerRef.current.destroy();
        rtcManagerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isVideoCallActive, selectedSessionId, isVirtualCamera]);

  // Sync track mute states when toggled
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !isVideoMuted; });
      if (rtcManagerRef.current) {
        rtcManagerRef.current.sendPeerStatus(!isVideoMuted, !isMicMuted);
      }
    }
  }, [isVideoMuted]);

  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !isMicMuted; });
      if (rtcManagerRef.current) {
        rtcManagerRef.current.sendPeerStatus(!isVideoMuted, !isMicMuted);
      }
    }
  }, [isMicMuted]);

  // Call timer
  useEffect(() => {
    if (isVideoCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(callTimerRef.current);
      setCallDurationSeconds(0);
    }
    return () => clearInterval(callTimerRef.current);
  }, [isVideoCallActive]);

  const handleSendMessage = async () => {
    if (!selectedSessionId || !replyText.trim()) return;

    let textToSend = replyText.trim();
    let attachedMedName = '';

    if (selectedMedToAttach) {
      const med = medsCatalog.find(m => m.id === selectedMedToAttach);
      if (med) {
        attachedMedName = med.name;
        textToSend += `\n\n📌 Recommended Medication: **${med.name}** (${med.price} ETB) - In Stock.`;
      }
    }

    try {
      const res = await fetch(`/api/teleconsultations/${selectedSessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'pharmacist',
          senderName: currentUser?.name || 'Sonan Pharmacist',
          text: textToSend,
          medicationMentioned: attachedMedName
        })
      });

      if (res.ok) {
        setReplyText('');
        setSelectedMedToAttach('');
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleUpdateStatus = async (status: 'active' | 'completed' | 'cancelled') => {
    if (!selectedSessionId) return;

    try {
      const res = await fetch(`/api/teleconsultations/${selectedSessionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          pharmacistId: currentUser?.id || 'u_pharm',
          pharmacistName: currentUser?.name || 'Sonan Pharmacist',
          notes: pharmacistNotes
        })
      });

      if (res.ok) {
        if (status === 'active' && selectedSession?.type === 'video') {
          setIsVideoCallActive(true);
        } else if (status === 'completed') {
          setIsVideoCallActive(false);
        }
        fetchSessions();
      }
    } catch (err) {
      console.error('Error updating session status:', err);
    }
  };

  const handleToggleConsultationType = async (type: 'video' | 'chat') => {
    if (!selectedSessionId) return;
    try {
      const res = await fetch(`/api/teleconsultations/${selectedSessionId}/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          requesterName: currentUser?.name || 'Sonan Pharmacist',
          requesterRole: 'pharmacist'
        })
      });
      if (res.ok) {
        if (type === 'video') {
          setIsVideoCallActive(true);
        } else {
          setIsVideoCallActive(false);
        }
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to switch consultation type:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedSessionId) return;
    try {
      await fetch(`/api/teleconsultations/${selectedSessionId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: pharmacistNotes })
      });
      alert('Clinical consultation notes saved successfully to patient record!');
      fetchSessions();
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  const filteredSessions = sessions.filter(s => {
    const matchesTab = activeTab === 'queued' ? s.status === 'queued'
      : activeTab === 'active' ? s.status === 'active'
      : activeTab === 'completed' ? (s.status === 'completed' || s.status === 'cancelled')
      : true;
    
    if (!matchesTab) return false;
    if (!searchFilter.trim()) return true;

    const term = searchFilter.toLowerCase();
    return s.customerName.toLowerCase().includes(term) ||
      s.customerPhone.includes(term) ||
      s.topic.toLowerCase().includes(term);
  });

  const queuedCount = sessions.filter(s => s.status === 'queued').length;
  const activeCount = sessions.filter(s => s.status === 'active').length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().then(() => setIsFullscreenVideo(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreenVideo(false)).catch(() => {});
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-100">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pharmacist Teleconsultation Hub</h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                Two-Way Live Video &amp; Chat
              </span>
              {queuedCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-black bg-amber-500 text-white rounded-full animate-bounce flex items-center gap-1">
                  <PhoneIncoming className="w-3 h-3" />
                  {queuedCount} Waiting
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Direct two-way video calls and live clinical consultation with online customers regarding dosage, contraindications, and product guidance.
            </p>
          </div>
        </div>

        {/* On Duty Toggle & Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => playIncomingCallChime()}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-800 transition cursor-pointer"
            title="Test alert sound for incoming video calls"
          >
            <Volume2 className="w-4 h-4 text-purple-600" />
            <span>Test Sound</span>
          </button>

          <button
            onClick={() => setIsPharmacistOnDuty(!isPharmacistOnDuty)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm cursor-pointer ${
              isPharmacistOnDuty 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isPharmacistOnDuty ? 'bg-emerald-200 animate-pulse' : 'bg-slate-400'}`}></span>
            {isPharmacistOnDuty ? '🟢 Pharmacist On-Duty' : '🔴 Pharmacist Offline'}
          </button>

          <button
            onClick={fetchSessions}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh Requests"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => setActiveTab('queued')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'queued' 
              ? 'bg-amber-500/10 border-amber-500/40 dark:bg-amber-950/30 ring-2 ring-amber-400/20' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Waiting Queue
            </span>
            {queuedCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-amber-500 text-white rounded-full animate-pulse">
                Action Required
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{queuedCount}</span>
            <span className="text-xs text-slate-500">customer requests</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('active')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'active' 
              ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/30 ring-2 ring-emerald-400/20' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Video className="w-4 h-4" /> Active Consultations
            </span>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-500 text-white rounded-full">
                Connected
              </span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{activeCount}</span>
            <span className="text-xs text-slate-500">live calls &amp; chats</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('completed')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            activeTab === 'completed' 
              ? 'bg-blue-500/10 border-blue-500/40 dark:bg-blue-950/30 ring-2 ring-blue-400/20' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Resolved Consultations
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{completedCount}</span>
            <span className="text-xs text-slate-500">completed today</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left List + Right Detail Chat & Video */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left List Pane (4 Cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[540px]">
          {/* Tabs header */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 space-y-2">
            <div className="flex items-center gap-1">
              {(['queued', 'active', 'completed', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg capitalize transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab}
                  {tab === 'queued' && queuedCount > 0 && ` (${queuedCount})`}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, phone, topic..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 p-2 space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No {activeTab} requests found</p>
              </div>
            ) : (
              filteredSessions.map(session => {
                const isSelected = session.id === selectedSessionId;
                const lastMsg = session.messages && session.messages.length > 0 
                  ? session.messages[session.messages.length - 1] 
                  : null;

                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      setSelectedSessionId(session.id);
                      if (onClearInitialSessionId) onClearInitialSessionId();
                    }}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg text-xs ${
                          session.type === 'video' 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        }`}>
                          {session.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[150px]">
                          {session.customerName}
                        </h3>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {session.updatedAt ? session.updatedAt.split(' ')[1] : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[180px]">
                        {session.topic}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                        session.status === 'queued'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 animate-pulse'
                          : session.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {session.status}
                      </span>
                    </div>

                    {lastMsg && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                        "{lastMsg.text}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail & Interaction Pane (8 Cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[540px]">
          {selectedSession ? (
            <>
              {/* Header Bar */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-base">
                    {selectedSession.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base text-slate-900 dark:text-white">{selectedSession.customerName}</h2>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md font-mono">
                        {selectedSession.customerPhone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Topic: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedSession.topic}</span> • Session ID: {selectedSession.id}
                    </p>
                  </div>
                </div>

                {/* Session Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Mode switch */}
                  {selectedSession.type === 'chat' ? (
                    <button
                      onClick={() => handleToggleConsultationType('video')}
                      className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Switch to live video call mode"
                    >
                      <Video className="w-3.5 h-3.5 text-purple-600" /> Switch to Video Call
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleConsultationType('chat')}
                      className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Switch to chat-only mode"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> Switch to Chat Only
                    </button>
                  )}

                  {selectedSession.status === 'queued' && (
                    <button
                      onClick={() => handleUpdateStatus('active')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                    >
                      <UserCheck className="w-4 h-4" /> Accept &amp; Connect
                    </button>
                  )}

                  {selectedSession.type === 'video' && (
                    <button
                      onClick={() => {
                        setIsVideoCallActive(!isVideoCallActive);
                        if (selectedSession.status === 'queued') {
                          handleUpdateStatus('active');
                        }
                      }}
                      className={`px-3.5 py-2 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                        isVideoCallActive
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}
                    >
                      <Video className="w-4 h-4" /> {isVideoCallActive ? 'Active Call Window' : 'Launch Video Call'}
                    </button>
                  )}

                  {selectedSession.status === 'active' && (
                    <button
                      onClick={() => handleUpdateStatus('completed')}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Conclude
                    </button>
                  )}
                </div>
              </div>

              {/* Enhanced Two-Way Video Call Interface Container */}
              {isVideoCallActive && (
                <div 
                  ref={videoContainerRef}
                  className="bg-slate-950 p-4 border-b border-slate-800 text-white relative transition-all"
                >
                  {/* Status Bar */}
                  <div className="flex items-center justify-between mb-3 text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-semibold text-purple-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                      <span>TWO-WAY LIVE VIDEO TELECONSULTATION</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-mono bg-purple-900/60 px-2 py-0.5 rounded text-white">{formatDuration(callDurationSeconds)}</span>
                      {isVirtualCamera ? (
                        <span className="bg-sky-900/60 text-sky-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-sky-500/30">
                          <Sparkles className="w-2.5 h-2.5" /> HD Virtual Feed
                        </span>
                      ) : (
                        <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30">
                          <Video className="w-2.5 h-2.5" /> HD Webcam Live
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsVirtualCamera(prev => !prev)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer border border-slate-700"
                        title="Toggle Hardware Webcam / Virtual HD Camera"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        {isVirtualCamera ? 'Use Physical Webcam' : 'Use Virtual Camera'}
                      </button>

                      <button
                        onClick={() => {
                          if (rtcManagerRef.current) {
                            rtcManagerRef.current.createAndSendOffer(true);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                        title="Re-synchronize Video Stream"
                      >
                        <RefreshCw className="w-3 h-3" /> Re-sync
                      </button>

                      <button
                        onClick={() => setVideoLayout(prev => prev === 'split' ? 'pip' : 'split')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer"
                        title="Toggle Dual Grid / Picture-in-Picture layout"
                      >
                        <LayoutGrid className="w-3 h-3" /> {videoLayout === 'split' ? 'Picture-in-Picture' : 'Side-by-Side'}
                      </button>

                      <button
                        onClick={toggleFullscreen}
                        className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                        title="Toggle Fullscreen"
                      >
                        {isFullscreenVideo ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => setIsVideoCallActive(false)}
                        className="text-slate-400 hover:text-white text-xs underline cursor-pointer ml-2"
                      >
                        Minimize
                      </button>
                    </div>
                  </div>

                  {mediaNotice && (
                    <div className="mb-2 p-2 bg-sky-950/80 border border-sky-800 text-sky-200 rounded-lg text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{mediaNotice}</span>
                      </div>
                      <button
                        onClick={() => setIsVirtualCamera(false)}
                        className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        Retry Camera
                      </button>
                    </div>
                  )}

                  {/* Video Grid (Dual Live Feeds: Customer & Pharmacist) */}
                  <div className={`relative ${videoLayout === 'split' ? 'grid grid-cols-1 md:grid-cols-2 gap-3 h-64' : 'h-64'}`}>
                    {/* 1. Customer Live Video & Audio Feed (Remote) */}
                    <div className="bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center h-full">
                      {/* Audio element ensuring audio stream plays reliably */}
                      <audio ref={remoteAudioRef} autoPlay playsInline className="absolute w-0 h-0 opacity-0 pointer-events-none -z-50" />

                      {/* Direct WebRTC Video stream */}
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${hasRemoteVideoTrack ? 'block' : 'hidden'}`}
                      />

                      {/* Fallback frame synchronization if WebRTC direct video track is connecting */}
                      {!hasRemoteVideoTrack && remoteFrameUrl && (
                        <img 
                          src={remoteFrameUrl} 
                          alt="Patient Live Video Feed"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Avatar placeholder if no video feed yet */}
                      {!hasRemoteVideoTrack && !remoteFrameUrl && (
                        <div className="text-center p-4">
                          <div className={`w-16 h-16 rounded-full bg-emerald-600/30 text-emerald-400 font-bold text-xl mx-auto flex items-center justify-center border border-emerald-500/40 mb-2 ${isPatientSpeaking ? 'ring-4 ring-emerald-400/50 animate-pulse' : ''}`}>
                            {selectedSession.customerName.charAt(0)}
                          </div>
                          <h4 className="font-bold text-sm text-white">{selectedSession.customerName} (Patient)</h4>
                          <p className="text-[11px] text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            Live Audio &amp; Video Connected
                          </p>
                        </div>
                      )}

                      {/* Overlays on Patient Feed */}
                      <div className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-emerald-300 font-bold flex items-center gap-1.5 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Patient: {selectedSession.customerName}
                      </div>

                      {/* Patient Speaking / Mic Audio Level Bar */}
                      <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-slate-300 flex items-center gap-2 border border-slate-700">
                        <Volume2 className={`w-3.5 h-3.5 ${remoteAudioLevel > 10 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-bold">{remotePeerStatus.audio !== false ? 'Voice Active' : 'Patient Muted'}</span>
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden flex items-center">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                            style={{ width: `${Math.min(100, remoteAudioLevel * 1.5)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Pharmacist Local Camera Stream */}
                    <div className={`bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center ${
                      videoLayout === 'pip' 
                        ? 'absolute bottom-3 right-3 w-44 h-32 z-20 shadow-2xl border-2 border-purple-500' 
                        : 'h-full'
                    }`}>
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : 'block'}`}
                      />
                      {isVideoMuted && (
                        <div className="text-center p-4">
                          <VideoOff className="w-10 h-10 text-slate-500 mx-auto mb-1" />
                          <p className="text-xs text-slate-400">Pharmacist Camera Muted</p>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 bg-slate-900/85 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] text-purple-300 font-bold flex items-center gap-1.5 border border-purple-500/30">
                        <Shield className="w-3 h-3 text-purple-400" />
                        Pharmacist (You)
                      </div>

                      {/* Local Mic Volume Level Meter */}
                      <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] text-slate-300 flex items-center gap-1.5 border border-slate-700">
                        <Mic className={`w-3 h-3 ${isMicMuted ? 'text-red-400' : localAudioLevel > 10 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                        <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-75"
                            style={{ width: `${isMicMuted ? 0 : Math.min(100, localAudioLevel * 1.5)}%` }}
                          />
                        </div>
                      </div>

                      {isMicMuted && (
                        <div className="absolute top-2 right-2 bg-red-600/90 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                          Mic Muted
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Call Controls Bar */}
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setIsMicMuted(!isMicMuted);
                        if (rtcManagerRef.current) {
                          rtcManagerRef.current.sendPeerStatus(!isVideoMuted, isMicMuted);
                        }
                      }}
                      className={`p-3 rounded-full transition-all cursor-pointer shadow-md ${
                        isMicMuted ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                      title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    >
                      {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => {
                        setIsVideoMuted(!isVideoMuted);
                        if (rtcManagerRef.current) {
                          rtcManagerRef.current.sendPeerStatus(isVideoMuted, !isMicMuted);
                        }
                      }}
                      className={`p-3 rounded-full transition-all cursor-pointer shadow-md ${
                        isVideoMuted ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                      title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                      {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => {
                        setIsVideoCallActive(false);
                        handleUpdateStatus('completed');
                      }}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full flex items-center gap-2 transition-all shadow-lg cursor-pointer"
                    >
                      <PhoneOff className="w-4 h-4" /> End Video Call
                    </button>
                  </div>
                </div>
              )}

              {/* Chat Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                {selectedSession.messages.map((msg) => {
                  const isPharmacist = msg.sender === 'pharmacist';
                  const isSystem = msg.sender === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="text-center my-2">
                        <span className="px-3 py-1 bg-slate-200/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 rounded-full text-[11px] font-medium inline-block">
                          ℹ️ {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isPharmacist ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400">
                        <span className="font-semibold">{msg.senderName}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div className={`p-3.5 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                        isPharmacist
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        
                        {msg.medicationMentioned && (
                          <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 ${
                            isPharmacist ? 'bg-emerald-700/60 text-emerald-100' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          }`}>
                            <Pill className="w-4 h-4 flex-shrink-0" />
                            <span>Prescription Link: <strong>{msg.medicationMentioned}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clinical Notes Drawer */}
              <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Clinical Consultation Notes (Internal Record)
                  </label>
                  <button
                    onClick={handleSaveNotes}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
                <input
                  type="text"
                  value={pharmacistNotes}
                  onChange={e => setPharmacistNotes(e.target.value)}
                  placeholder="e.g. Advised 500mg Amoxicillin after meals 3x daily. Confirmed no allergy history."
                  className="w-full text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-lg text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Chat Input & Product Attachment Bar */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Pill className="w-3.5 h-3.5 text-emerald-600" /> Link Catalog Item:
                  </span>
                  <select
                    value={selectedMedToAttach}
                    onChange={e => setSelectedMedToAttach(e.target.value)}
                    className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 max-w-xs"
                  >
                    <option value="">-- Optional Medicine / Cosmetic Attachment --</option>
                    {medsCatalog.slice(0, 30).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.price} ETB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type clinical advice or response to patient..."
                    className="flex-1 text-xs p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 resize-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!replyText.trim()}
                    className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Stethoscope className="w-16 h-16 text-emerald-500/40 mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Select a Consultation Request</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose a customer consultation from the queue on the left to begin two-way video calling or live chat.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default TeleconsultationManager;
