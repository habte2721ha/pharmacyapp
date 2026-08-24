import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Filter, ShieldAlert, CheckCircle2, 
  MapPin, Phone, Mail, Clock, X, Plus, Minus, ArrowRight,
  Upload, Sparkles, AlertCircle, Store, Tag, Camera, Check, FileText, ChevronLeft, ChevronRight,
  Share2, Copy, Send, ExternalLink, MessageSquare, Share,
  PackageCheck, Truck, DollarSign, Mic, MicOff, Volume2, VolumeX, RefreshCw,
  Video, Play, Maximize2, Film, Stethoscope, VideoOff, PhoneCall, PhoneOff, User, Bot, UserCheck, Pill, ShieldCheck
} from 'lucide-react';
import { Medicine, TeleconsultationSession, TeleconsultationMessage } from '../types.ts';
import GoogleMapLocationPicker from './GoogleMapLocationPicker';
import { 
  TeleconsultRTCManager, 
  speakTextWithVoice, 
  stopVoiceSpeech, 
  playMessageNotificationSound, 
  playIncomingCallChime, 
  unlockAudio, 
  ensureMediaElementPlayback,
  acquireMediaStream
} from '../utils/teleconsultWebrtc';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PublicCustomerStoreProps {
  onBackToApp?: () => void;
}

interface CartItem {
  medicine: Medicine & { availableQuantity?: number; inStock?: boolean };
  quantity: number;
}

const COSMETICS_SUBCATEGORIES = [
  'Shampoo',
  'Conditioner',
  'Body Wash',
  'Skin Care',
  'Kids Product',
  'Soap',
  'Hair Treatment',
  'Parfum',
  'Deodorant',
  'Stick and Roll Body Deodorants',
  'Oral Care',
  'Sunscreen',
  'Vitamins and Supplement',
  'Hair Product'
];

const MEDICINE_SUBCATEGORIES = [
  'Antibiotics',
  'Cardiovascular',
  'Antiprotozoal',
  'Deworming',
  'Pain Relievers & Analgesics',
  'First Aid & Antiseptics',
  'Cold, Flu & Allergy',
  'Chronic Care',
  'Gastrointestinal & Digestive',
  'Eye & Ear Care',
  'Inhalers & Respiratory',
  'Prescription Medicine',
  'OTC Medicine'
];

export const isCosmeticsItem = (item: any): boolean => {
  if (!item) return false;
  if (item.productType === 'cosmetics' || item.productType === 'cosmetic') return true;
  if (item.category) {
    const cat = item.category.toLowerCase().trim();
    if (
      cat.includes('cosmetic') ||
      cat.includes('skincare') ||
      cat.includes('skin care') ||
      cat.includes('beauty') ||
      cat.includes('hair') ||
      cat.includes('perfume') ||
      cat.includes('deodorant') ||
      cat.includes('makeup') ||
      cat.includes('sunscreen') ||
      cat.includes('oral care') ||
      cat.includes('personal care')
    ) {
      return true;
    }
    if (COSMETICS_SUBCATEGORIES.some(sc => sc.toLowerCase() === cat)) {
      return true;
    }
  }
  return false;
};

export default function PublicCustomerStore({ onBackToApp }: PublicCustomerStoreProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [catalogItems, setCatalogItems] = useState<(Medicine & { availableQuantity?: number; inStock?: boolean })[]>([]);
  const [institution, setInstitution] = useState<{ name: string; address: string; phone: string; email: string; logoUrl?: string }>({
    name: 'Sonan Pharmacy',
    address: '',
    phone: '',
    email: '',
    logoUrl: ''
  });

  const cleanInstPhone = (institution.phone || '').replace(/[^0-9]/g, '');
  const waBaseUrl = cleanInstPhone ? `https://wa.me/${cleanInstPhone}` : 'https://wa.me/';
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'medicine' | 'cosmetics'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState(false);

  // Price Sorting & Range Filtering states
  const [sortOption, setSortOption] = useState<'default' | 'newest' | 'refilled' | 'price_asc' | 'price_desc' | 'name_asc'>('default');
  const [specialFilter, setSpecialFilter] = useState<'all' | 'newly_added' | 'refilled'>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [pricePreset, setPricePreset] = useState<string>('all');

  // Promotional Video states
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [selectedPromoVideo, setSelectedPromoVideo] = useState<any | null>(null);
  const [showPromoVideoModal, setShowPromoVideoModal] = useState(false);
  const [showPromoBanner, setShowPromoBanner] = useState(true);

  // Selective Popup Items states
  const [selectivePopupConfig, setSelectivePopupConfig] = useState<{
    enabled: boolean;
    popupTitle?: string;
    popupSubtitle?: string;
    autoShowDelaySeconds?: number;
    showOncePerSession?: boolean;
    items?: any[];
  } | null>(null);
  const [showSelectivePopupModal, setShowSelectivePopupModal] = useState(false);
  const [selectedPopupIndex, setSelectedPopupIndex] = useState(0);
  const [popupToastMsg, setPopupToastMsg] = useState<string | null>(null);

  // Cart & Order states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDirectPrescriptionModal, setShowDirectPrescriptionModal] = useState(false);

  // Camera & Photo Capture states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  
  // Selected Detail Modal state
  const [selectedDetailItem, setSelectedDetailItem] = useState<Medicine | null>(null);

  // Checkout Form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [prescriptionImage, setPrescriptionImage] = useState<string>('');
  const [prescriptionFileName, setPrescriptionFileName] = useState<string>('');

  // Teleconsultation & AI Assistant states
  const [showConsultationHubModal, setShowConsultationHubModal] = useState(false);
  const [consultationTab, setConsultationTab] = useState<'ai' | 'teleconsultation'>('ai');

  // AI Chatbot State
  const [aiMessages, setAiMessages] = useState<Array<{ 
    sender: 'user' | 'ai'; 
    text: string; 
    suggestTeleconsultation?: boolean; 
    suggestedProducts?: any[];
    totalPrice?: number;
    timestamp: string 
  }>>([
    {
      sender: 'ai',
      text: "👋 **Hello! I am your Sonan Pharmacy AI.**\n\nI can help you with:\n1. 💊 **Drug & Medicine Information:** Uses, generic & brand names, approved dosages, food & administration timing, side effects, warnings, interactions, and storage.\n2. 💄 **Cosmetics & Personal Care:** Skincare & haircare benefits, step-by-step application routines, suitable skin/hair types, ingredients, and precautions.\n3. 📦 **Live Pharmacy Stock Checking:** Real-time stock availability, quantities, and unexpired batch verification.\n4. 💰 **Price & Total Cost Calculation:** Instant unit pricing and total cost calculation (*Selling Price × Requested Quantity*) in ETB.\n5. 🛒 **Multiple Item Orders:** Instant order breakdown tables with item subtotals and grand total calculations.\n\n*How can I assist you with your health, medication, or cosmetics today?*",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);
  const [autoSpeakAi, setAutoSpeakAi] = useState(false);

  const handleTestSoundAndVoice = () => {
    playIncomingCallChime();
    setTimeout(() => {
      speakTextWithVoice("Hello! Sound is working. I am your Sonan Pharmacy AI. How can I assist with your medication or cosmetics today?", () => {
        setSpeakingMsgIndex(null);
      });
    }, 450);
  };

  // Teleconsultation Request State
  const [teleTopic, setTeleTopic] = useState<'Usage & Dosage' | 'Side Effects' | 'Drug Interactions' | 'Prescription Inquiry' | 'Chronic Care' | 'General Consultation'>('Usage & Dosage');
  const [teleType, setTeleType] = useState<'chat' | 'video'>('chat');
  const [teleCustName, setTeleCustName] = useState('');
  const [teleCustPhone, setTeleCustPhone] = useState('');
  const [teleCustEmail, setTeleCustEmail] = useState('');
  const [teleInitialMessage, setTeleInitialMessage] = useState('');
  const [activeTeleSession, setActiveTeleSession] = useState<TeleconsultationSession | null>(null);
  const [isRequestingTele, setIsRequestingTele] = useState(false);
  const [teleMsgText, setTeleMsgText] = useState('');

  // Customer Video Call controls
  const [custVideoActive, setCustVideoActive] = useState(false);
  const [custVideoMuted, setCustVideoMuted] = useState(false);
  const [custAudioMuted, setCustAudioMuted] = useState(false);
  const [custVirtualCamera, setCustVirtualCamera] = useState(false);
  const [custMediaNotice, setCustMediaNotice] = useState<string | null>(null);
  const [custRemoteFrameUrl, setCustRemoteFrameUrl] = useState<string | null>(null);
  const [custVideoLayout, setCustVideoLayout] = useState<'pip' | 'split'>('pip');
  const [custLocalAudioLevel, setCustLocalAudioLevel] = useState(0);
  const [custRemoteAudioLevel, setCustRemoteAudioLevel] = useState(0);
  const [hasCustRemoteVideoTrack, setHasCustRemoteVideoTrack] = useState(false);
  const custLocalVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const custRemoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const custRemoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const custLocalStreamRef = React.useRef<MediaStream | null>(null);
  const custRtcManagerRef = React.useRef<TeleconsultRTCManager | null>(null);

  // Poll active teleconsultation session if present
  useEffect(() => {
    let interval: any = null;
    if (activeTeleSession?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/teleconsultations');
          if (res.ok) {
            const list: TeleconsultationSession[] = await res.json();
            const found = list.find(s => s.id === activeTeleSession.id);
            if (found) {
              setActiveTeleSession(found);
              if (found.type === 'video' && !custVideoActive) {
                setCustVideoActive(true);
              }
            }
          }
        } catch (err) {
          console.warn('Error polling teleconsultation session:', err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTeleSession?.id, custVideoActive]);

  // Setup customer WebRTC & media stream synchronization
  useEffect(() => {
    let isCancelled = false;

    if (activeTeleSession?.id && activeTeleSession?.type === 'video' && custVideoActive) {
      unlockAudio();
      const rtc = new TeleconsultRTCManager(activeTeleSession.id, 'customer');
      custRtcManagerRef.current = rtc;

      rtc.onRemoteStream((stream) => {
        if (custRemoteVideoRef.current) {
          custRemoteVideoRef.current.srcObject = stream;
          ensureMediaElementPlayback(custRemoteVideoRef.current);
        }
        if (custRemoteAudioRef.current) {
          custRemoteAudioRef.current.srcObject = stream;
          custRemoteAudioRef.current.muted = false;
          custRemoteAudioRef.current.volume = 1.0;
          ensureMediaElementPlayback(custRemoteAudioRef.current);
        }
        const hasVideo = stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
        setHasCustRemoteVideoTrack(hasVideo);
      });

      rtc.onRemoteFrame((dataUrl) => {
        setCustRemoteFrameUrl(dataUrl);
      });

      rtc.onAudioLevel(({ local, remote }) => {
        setCustLocalAudioLevel(local);
        setCustRemoteAudioLevel(remote);
      });

      acquireMediaStream({
        role: 'customer',
        displayName: activeTeleSession.customerName || 'Patient',
        forceVirtual: custVirtualCamera
      }).then(({ stream, isVirtualCamera: wasVirtual, errorMessage }) => {
        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        custLocalStreamRef.current = stream;
        setCustVirtualCamera(wasVirtual);
        if (errorMessage) {
          setCustMediaNotice(errorMessage);
        } else {
          setCustMediaNotice(null);
        }

        stream.getVideoTracks().forEach(t => { t.enabled = !custVideoMuted; });
        stream.getAudioTracks().forEach(t => { t.enabled = !custAudioMuted; });

        if (custLocalVideoRef.current) {
          custLocalVideoRef.current.srcObject = stream;
          ensureMediaElementPlayback(custLocalVideoRef.current);
        }
        rtc.setLocalStream(stream);
      }).catch((err) => {
        console.warn('Customer stream acquisition error:', err);
      });

      return () => {
        isCancelled = true;
        rtc.destroy();
        custRtcManagerRef.current = null;
        if (custLocalStreamRef.current) {
          custLocalStreamRef.current.getTracks().forEach(track => track.stop());
          custLocalStreamRef.current = null;
        }
        if (custLocalVideoRef.current) {
          custLocalVideoRef.current.srcObject = null;
        }
        if (custRemoteVideoRef.current) {
          custRemoteVideoRef.current.srcObject = null;
        }
        if (custRemoteAudioRef.current) {
          custRemoteAudioRef.current.srcObject = null;
        }
      };
    } else {
      if (custRtcManagerRef.current) {
        custRtcManagerRef.current.destroy();
        custRtcManagerRef.current = null;
      }
      if (custLocalStreamRef.current) {
        custLocalStreamRef.current.getTracks().forEach(track => track.stop());
        custLocalStreamRef.current = null;
      }
      if (custLocalVideoRef.current) {
        custLocalVideoRef.current.srcObject = null;
      }
    }
  }, [activeTeleSession?.id, activeTeleSession?.type, custVideoActive, custVirtualCamera]);

  // Sync customer mute toggles
  useEffect(() => {
    if (custLocalStreamRef.current) {
      custLocalStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !custVideoMuted; });
      if (custRtcManagerRef.current) {
        custRtcManagerRef.current.sendPeerStatus(!custVideoMuted, !custAudioMuted);
      }
    }
  }, [custVideoMuted]);

  useEffect(() => {
    if (custLocalStreamRef.current) {
      custLocalStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !custAudioMuted; });
      if (custRtcManagerRef.current) {
        custRtcManagerRef.current.sendPeerStatus(!custVideoMuted, !custAudioMuted);
      }
    }
  }, [custAudioMuted]);

  const handleSendAiMessage = async (msgText?: string) => {
    const textToSend = msgText || aiInputText.trim();
    if (!textToSend || isAiThinking) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text: textToSend, timestamp: timeStr };

    setAiMessages(prev => [...prev, userMsg]);
    if (!msgText) setAiInputText('');
    setIsAiThinking(true);

    try {
      const historyPayload = aiMessages.map(m => ({
        sender: m.sender === 'user' ? 'user' : 'model',
        text: m.text
      }));

      const res = await fetch('/api/chat/customer-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload
        })
      });

      if (res.ok) {
        const data = await res.json();
        playMessageNotificationSound();
        const replyText = (data.reply && data.reply.trim().length > 0)
          ? data.reply
          : `👋 **Sonan Pharmacy AI**\n\nI have reviewed your query regarding medications and cosmetics. For detailed advice, dosages, or to order products, feel free to ask about any specific symptoms or medications!`;

        const newAiMsg = {
          sender: 'ai' as const,
          text: replyText,
          suggestTeleconsultation: data.suggestTeleconsultation,
          suggestedProducts: data.suggestedProducts || [],
          totalPrice: data.totalPrice,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setAiMessages(prev => {
          const updated = [...prev, newAiMsg];
          if (autoSpeakAi) {
            setTimeout(() => {
              speakTextWithVoice(newAiMsg.text, () => setSpeakingMsgIndex(null));
              setSpeakingMsgIndex(updated.length - 1);
            }, 250);
          }
          return updated;
        });
      } else {
        playMessageNotificationSound();
        const fallbackMsg = {
          sender: 'ai' as const,
          text: "👋 **Sonan Pharmacy AI**\n\nI am ready to help you with medication dosages, administration timing, side effects, precautions, cosmetic routines, and product pricing. How can I assist you?",
          suggestTeleconsultation: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setAiMessages(prev => [...prev, fallbackMsg]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setAiMessages(prev => [...prev, {
        sender: 'ai',
        text: "👋 **Sonan Pharmacy AI**\n\nI am ready to assist with clinical guidance. If you need immediate prescription dispensing or a live video consultation, please switch to the Live Teleconsultation tab above!",
        suggestTeleconsultation: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleRequestTeleconsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teleCustName.trim() || !teleCustPhone.trim()) {
      alert('Please enter your full name and contact phone number.');
      return;
    }

    setIsRequestingTele(true);

    try {
      const res = await fetch('/api/teleconsultations/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: teleCustName.trim(),
          customerPhone: teleCustPhone.trim(),
          customerEmail: teleCustEmail.trim(),
          type: teleType,
          topic: teleTopic,
          initialMessage: teleInitialMessage.trim()
        })
      });

      if (res.ok) {
        const sessionData: TeleconsultationSession = await res.json();
        setActiveTeleSession(sessionData);
        if (sessionData.type === 'video') {
          setCustVideoActive(true);
        }
      } else {
        alert('Failed to launch teleconsultation request. Please try calling the pharmacy directly.');
      }
    } catch (err) {
      console.error('Error launching teleconsultation:', err);
      alert('Network error. Please try again or call our hotline.');
    } finally {
      setIsRequestingTele(false);
    }
  };

  const handleSendTeleMessage = async () => {
    if (!activeTeleSession?.id || !teleMsgText.trim()) return;

    const textToSend = teleMsgText.trim();
    setTeleMsgText('');

    try {
      const res = await fetch(`/api/teleconsultations/${activeTeleSession.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: 'customer',
          senderName: activeTeleSession.customerName,
          text: textToSend
        })
      });

      if (res.ok) {
        const updatedSession: TeleconsultationSession = await res.json();
        setActiveTeleSession(updatedSession);
      }
    } catch (err) {
      console.error('Error sending customer teleconsultation message:', err);
    }
  };

  // Customer AI Voice Assistance states
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAiResponse, setVoiceAiResponse] = useState("Hello! I'm your AI Pharmacy & Cosmetics Assistant. Tap the microphone and speak your query or request!");
  const [voiceQueryText, setVoiceQueryText] = useState('');
  const [isTtsActive, setIsTtsActive] = useState(true);
  const voiceRecognitionRef = React.useRef<any>(null);

  // Text To Speech Narrator
  const speakVoiceResponse = (text: string) => {
    if (!isTtsActive) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const engVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en'));
      if (engVoice) utterance.voice = engVoice;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error', err);
    }
  };

  // Process Voice Query Logic
  const handleProcessCustomerVoiceQuery = (rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return;

    let responseMsg = '';

    if (query.includes('prescription') || query.includes('doctor') || query.includes('photo') || query.includes('rx') || query.includes('upload') || query.includes('paper')) {
      setShowDirectPrescriptionModal(true);
      setShowVoiceModal(false);
      responseMsg = "Opening the order by prescription photo screen. You can snap or upload any doctor prescription photo or document.";
    } else if (query.includes('cosmetic') || query.includes('shampoo') || query.includes('beauty') || query.includes('skin') || query.includes('soap') || query.includes('lotion')) {
      setSelectedType('cosmetics');
      setSelectedCategory('all');
      setSearchQuery('');
      responseMsg = "Switched catalog view to Cosmetics. Browse shampoos, skincare, soaps, and beauty products!";
    } else if (query.includes('medicine') || query.includes('drug') || query.includes('pharmacy') || query.includes('antibiotic') || query.includes('pill') || query.includes('tablet')) {
      setSelectedType('medicine');
      setSelectedCategory('all');
      setSearchQuery('');
      responseMsg = "Switched catalog view to Medicines. Browse pharmaceuticals and healthcare supplies.";
    } else if (query.includes('cart') || query.includes('basket') || query.includes('checkout') || query.includes('my items')) {
      setShowCartDrawer(true);
      responseMsg = `Opening your shopping cart. You currently have ${totalCartItemsCount} items with subtotal ${cartSubtotal.toLocaleString()} ETB.`;
    } else if (query.includes('map') || query.includes('location') || query.includes('address') || query.includes('where') || query.includes('find store')) {
      setShowMapPicker(true);
      responseMsg = institution.address 
        ? `Our pharmacy is located at ${institution.address}${institution.phone ? ` (Phone: ${institution.phone})` : ''}. I've opened the map for your delivery location pin!`
        : `Our pharmacy is ${institution.name || 'Sonan Pharmacy'}${institution.phone ? ` (Phone: ${institution.phone})` : ''}. I've opened the map for your delivery location pin!`;
    } else if (query.includes('all') || query.includes('catalog') || query.includes('reset') || query.includes('show all')) {
      setSelectedType('all');
      setSelectedCategory('all');
      setSearchQuery('');
      responseMsg = "Showing all medicines and cosmetics in the pharmacy store catalog.";
    } else {
      // Perform automatic search across store medicines
      setSearchQuery(rawQuery);
      const matches = catalogItems.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query) ||
        (m.genericName && m.genericName.toLowerCase().includes(query)) ||
        (m.description && m.description.toLowerCase().includes(query))
      );

      if (matches.length > 0) {
        responseMsg = `I found ${matches.length} matching item${matches.length > 1 ? 's' : ''} for "${rawQuery}" in our pharmacy catalog!`;
      } else {
        responseMsg = `I searched for "${rawQuery}". Showing all available store items. You can also upload a doctor prescription photo if you can't find a specific medicine.`;
      }
    }

    setVoiceAiResponse(responseMsg);
    speakVoiceResponse(responseMsg);
  };

  // Start Voice Listening
  const startCustomerVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice speech recognition is not natively supported in this browser. You can type your query in the Voice AI text box below!');
      return;
    }

    try {
      if (voiceRecognitionRef.current) {
        voiceRecognitionRef.current.stop();
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setVoiceTranscript('Listening... Speak your query clearly!');
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        setVoiceTranscript(`"${spoken}"`);
        handleProcessCustomerVoiceQuery(spoken);
        setIsVoiceListening(false);
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsVoiceListening(false);
        setVoiceTranscript('Microphone listening paused. Click the mic to speak again or type below.');
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      voiceRecognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsVoiceListening(false);
    }
  };
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);
  const [showShareStoreMenu, setShowShareStoreMenu] = useState(false);

  // Order Tracking states
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackOrderQuery, setTrackOrderQuery] = useState('');
  const [trackingResults, setTrackingResults] = useState<any[] | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const handleTrackOrderSearch = async (queryToSearch?: string) => {
    const query = (queryToSearch !== undefined ? queryToSearch : trackOrderQuery).trim();
    if (!query) {
      setTrackError('Please enter an order number or phone number.');
      return;
    }
    setTrackLoading(true);
    setTrackError('');
    try {
      const res = await fetch(`/api/public/orders/track?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTrackingResults(data.orders);
      } else {
        setTrackingResults([]);
        setTrackError(data.error || 'No purchase order found matching this reference number or phone.');
      }
    } catch (err) {
      console.error(err);
      setTrackError('Failed to check order status. Please check your connection.');
    } finally {
      setTrackLoading(false);
    }
  };

  // Camera Control Functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      setCameraStream(stream);
      setShowCameraModal(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 300);
    } catch (err) {
      console.error('Direct camera stream failed:', err);
      // Fallback: trigger native phone camera input
      const input = document.getElementById('phone-camera-file-input') as HTMLInputElement;
      if (input) input.click();
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const captureCameraPhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setPrescriptionImage(dataUrl);
        stopCamera();
      }
    }
  };

  // Sharing Helper Methods
  const getStoreUrl = () => {
    return `${window.location.origin}${window.location.pathname}?view=catalog`;
  };

  const getReceiptText = (order: any) => {
    if (!order) return '';
    const itemLines = (order.items || []).map((i: any) => `- ${i.medicineName || 'Item'}: ${i.quantity} x ${i.unitPrice} ETB = ${i.totalPrice} ETB`).join('\n');
    return `🛍️ *${institution.name || 'Pharmacy Online Order Receipt'}*\n` +
      `-----------------------------------\n` +
      `📋 Order Number: #${order.orderNumber}\n` +
      `👤 Customer: ${order.customerName}\n` +
      `📞 Phone: ${order.customerPhone}\n` +
      `📍 Delivery Address: ${order.deliveryAddress}\n` +
      `💵 Total Amount: ${order.totalAmount?.toLocaleString()} ETB\n` +
      `-----------------------------------\n` +
      `Items Ordered:\n${itemLines}\n` +
      `-----------------------------------\n` +
      `Order Catalog Link: ${getStoreUrl()}`;
  };

  const shareOrderToWhatsApp = (order: any) => {
    const text = getReceiptText(order);
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOrderToTelegram = (order: any) => {
    const text = getReceiptText(order);
    const url = getStoreUrl();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOrderToFacebook = (order: any) => {
    const url = getStoreUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOrderToTwitter = (order: any) => {
    const text = `I placed order #${order.orderNumber} at ${institution.name}! Total: ${order.totalAmount} ETB.`;
    const url = getStoreUrl();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOrderToEmail = (order: any) => {
    const subject = `Order Receipt #${order.orderNumber} - ${institution.name}`;
    const body = getReceiptText(order);
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const shareOrderNative = async (order: any) => {
    const text = getReceiptText(order);
    const url = getStoreUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Order #${order.orderNumber} Receipt`,
          text: text,
          url: url
        });
      } catch (err) {
        console.error('Share cancelled or failed:', err);
      }
    } else {
      copyOrderReceipt(order);
    }
  };

  const copyOrderReceipt = (order: any) => {
    const text = getReceiptText(order);
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const copyStoreLink = () => {
    navigator.clipboard.writeText(getStoreUrl());
    setCopiedStoreLink(true);
    setTimeout(() => setCopiedStoreLink(false), 2500);
  };

  const shareStoreToSocial = (platform: 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'email' | 'native') => {
    const url = getStoreUrl();
    const text = `🛍️ Browse medicine and cosmetics catalog at ${institution.name}! Order online for fast home delivery:`;
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'email') {
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Online Pharmacy & Cosmetics Store - ' + institution.name)}&body=${encodeURIComponent(text + '\n' + url)}`, '_blank');
    } else if (platform === 'native') {
      if (navigator.share) {
        navigator.share({ title: institution.name, text, url }).catch(() => {});
      } else {
        copyStoreLink();
      }
    }
  };

  // Customer Analytics & Visit Tracker
  const trackVisitorBeacon = (action: string, details?: string) => {
    try {
      let visitorId = localStorage.getItem('sonan_visitor_id');
      if (!visitorId) {
        visitorId = `vid_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
        localStorage.setItem('sonan_visitor_id', visitorId);
      }

      // Detect device type & browser
      const ua = navigator.userAgent || '';
      let device = 'Desktop';
      if (/tablet|ipad|playbook|silk/i.test(ua)) device = 'Tablet';
      else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle/i.test(ua)) device = 'Mobile';

      let browser = 'Chrome';
      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
      else if (ua.includes('Edg')) browser = 'Edge';
      else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Other';

      let os = 'Windows';
      if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
      else if (ua.includes('Linux')) os = 'Linux';

      fetch('/api/analytics/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          page: window.location.pathname || '/store',
          action,
          device,
          browser,
          os,
          referrer: document.referrer || '',
          details: details || ''
        })
      }).catch(() => {});
    } catch (e) {}
  };

  // Fetch store promotional videos
  const fetchPromos = async () => {
    try {
      const res = await fetch('/api/public/promos');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.promoVideos) && data.promoVideos.length > 0) {
          setPromoVideos(data.promoVideos);
          setSelectedPromoVideo(data.promoVideos[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch promotional videos:', err);
    }
  };

  // Fetch customer selective popup config & items
  const fetchSelectivePopups = async () => {
    try {
      const res = await fetch('/api/public/selective-popups');
      if (res.ok) {
        const data = await res.json();
        if (data && data.enabled && Array.isArray(data.items) && data.items.length > 0) {
          const activeItems = data.items.filter((it: any) => it.active !== false);
          if (activeItems.length > 0) {
            setSelectivePopupConfig({
              ...data,
              items: activeItems
            });

            // Auto trigger popup modal based on config delay and session storage setting
            const alreadyShown = sessionStorage.getItem('sonan_selective_popup_shown');
            if (!alreadyShown || !data.showOncePerSession) {
              const delayMs = (data.autoShowDelaySeconds ?? 2) * 1000;
              setTimeout(() => {
                setShowSelectivePopupModal(true);
                sessionStorage.setItem('sonan_selective_popup_shown', 'true');
              }, delayMs);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch selective popups:', err);
    }
  };

  // Fetch catalog from backend API
  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const url = selectedBranchId && selectedBranchId !== 'all' 
        ? `/api/public/catalog?branchId=${selectedBranchId}` 
        : '/api/public/catalog';
      const [res, instRes] = await Promise.all([
        fetch(url),
        fetch('/api/settings/institution').catch(() => null)
      ]);
      if (res.ok) {
        const data = await res.json();
        setCatalogItems(data.items || []);
        if (data.institution) setInstitution(data.institution);
        if (data.branches) setBranches(data.branches);
      } else {
        setError('Failed to load store catalog. Please try refreshing.');
      }
      if (instRes && instRes.ok) {
        const instData = await instRes.json();
        if (instData) {
          setInstitution({
            name: instData.name || 'Sonan Pharmacy',
            address: instData.address || '',
            phone: instData.phone || '',
            email: instData.email || '',
            logoUrl: instData.logoUrl || ''
          });
        }
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchPromos();
    fetchSelectivePopups();
    trackVisitorBeacon('Visited Online Store', `Store Loaded (Branch: ${selectedBranchId})`);
  }, [selectedBranchId]);

  // Get active subcategories based on selected product type (Medicine vs Cosmetics)
  const activeSubcategories = selectedType === 'cosmetics'
    ? COSMETICS_SUBCATEGORIES
    : selectedType === 'medicine'
    ? MEDICINE_SUBCATEGORIES
    : Array.from(
        new Set([
          ...COSMETICS_SUBCATEGORIES,
          ...MEDICINE_SUBCATEGORIES,
          ...catalogItems.map(i => i.category).filter(Boolean)
        ])
      );

  // Filter & sort items by category, search, stock, price range, special tags (newly added / refilled), and sort option
  const filteredItems = catalogItems
    .filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.genericName && item.genericName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const itemIsCosmetic = isCosmeticsItem(item);
      const itemProductType = itemIsCosmetic ? 'cosmetics' : 'medicine';
      const matchesType = selectedType === 'all' || itemProductType === selectedType;
      
      let matchesCategory = true;
      if (selectedCategory !== 'all') {
        const selCatLower = selectedCategory.toLowerCase();
        const itemCatLower = (item.category || '').toLowerCase();
        const itemNameLower = item.name.toLowerCase();
        const itemDescLower = (item.description || '').toLowerCase();
        const itemGenericLower = (item.genericName || '').toLowerCase();

        matchesCategory = 
          itemCatLower === selCatLower ||
          itemCatLower.includes(selCatLower) ||
          itemNameLower.includes(selCatLower) ||
          itemDescLower.includes(selCatLower) ||
          itemGenericLower.includes(selCatLower) ||
          selCatLower.split(' ').some(w => w.length > 2 && (
            itemCatLower.includes(w) ||
            itemNameLower.includes(w) ||
            itemDescLower.includes(w)
          ));
      }

      const matchesStock = !inStockOnly || (item.inStock ?? (item.availableQuantity ?? 0) > 0);

      const itemPrice = Number(item.price) || 0;
      const minP = minPrice !== '' ? Number(minPrice) : null;
      const maxP = maxPrice !== '' ? Number(maxPrice) : null;

      const matchesMinPrice = minP === null || itemPrice >= minP;
      const matchesMaxPrice = maxP === null || itemPrice <= maxP;

      const matchesSpecialFilter = 
        specialFilter === 'all' ||
        (specialFilter === 'newly_added' && (item.isNewArrival || (item.createdAtTimestamp && item.createdAtTimestamp > 0))) ||
        (specialFilter === 'refilled' && (item.isRefilled || (item.lastRefilledTimestamp && item.lastRefilledTimestamp > 0)));

      return matchesSearch && matchesType && matchesCategory && matchesStock && matchesMinPrice && matchesMaxPrice && matchesSpecialFilter;
    })
    .sort((a, b) => {
      if (sortOption === 'newest') {
        return (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0);
      }
      if (sortOption === 'refilled') {
        return (b.lastRefilledTimestamp || 0) - (a.lastRefilledTimestamp || 0);
      }
      if (sortOption === 'price_asc') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }
      if (sortOption === 'price_desc') {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (specialFilter === 'newly_added') {
        return (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0);
      }
      if (specialFilter === 'refilled') {
        return (b.lastRefilledTimestamp || 0) - (a.lastRefilledTimestamp || 0);
      }
      return 0;
    });

  // Cart helpers
  const addToCart = (item: Medicine & { availableQuantity?: number; totalQuantity?: number; inStock?: boolean }) => {
    const qty = item.availableQuantity ?? item.totalQuantity ?? 0;
    if ((item.inStock === false) || qty <= 0) {
      alert(`Sorry, "${item.name}" is currently SOLD OUT.`);
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.medicine.id === item.id);
      if (existing) {
        if (qty > 0 && existing.quantity >= qty) {
          alert(`Maximum available stock (${qty}) reached for "${item.name}".`);
          return prev;
        }
        return prev.map(c => c.medicine.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { medicine: item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (medicineId: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(c => {
          if (c.medicine.id === medicineId) {
            const medObj = c.medicine as (Medicine & { availableQuantity?: number; totalQuantity?: number });
            const qty = medObj.availableQuantity ?? medObj.totalQuantity ?? 9999;
            const newQty = c.quantity + delta;
            if (delta > 0 && qty > 0 && newQty > qty) {
              alert(`Only ${qty} units available in stock.`);
              return c;
            }
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const totalCartItemsCount = cart.reduce((acc, c) => acc + c.quantity, 0);
  const cartSubtotal = cart.reduce((acc, c) => acc + c.medicine.price * c.quantity, 0);
  const hasPrescriptionItemInCart = cart.some(c => c.medicine.isPrescriptionRequired);

  // Handle Prescription Image & Document file upload
  const handlePrescriptionUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        alert('File size is over 25MB. Please select a file or photo under 25MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionImage(reader.result as string);
        setPrescriptionFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Order to backend API
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      alert('Please fill in your name, phone number, and delivery address.');
      return;
    }
    if (cart.length === 0) {
      alert('Your order cart is empty.');
      return;
    }
    if (hasPrescriptionItemInCart && !prescriptionImage) {
      if (!confirm('Your order includes prescription medicines. If you do not attach a doctor prescription image now, our pharmacist will require seeing it upon delivery. Proceed?')) {
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        deliveryAddress: deliveryAddress.trim(),
        notes: orderNotes.trim(),
        branchId: selectedBranchId !== 'all' ? selectedBranchId : 'b1',
        prescriptionImage: prescriptionImage || undefined,
        items: cart.map(c => ({
          medicineId: c.medicine.id,
          quantity: c.quantity
        }))
      };

      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCompletedOrder(data.order);
        setCart([]);
        setShowOrderModal(false);
      } else {
        alert(data.error || 'Failed to place order. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while placing order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handlePlacePrescriptionQuoteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      alert('Please fill in your name, phone number, and delivery address.');
      return;
    }
    if (!prescriptionImage) {
      alert('Please attach or snap a photo of your doctor\'s prescription.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        deliveryAddress: deliveryAddress.trim(),
        notes: orderNotes.trim() ? `[PRESCRIPTION QUOTE REQUEST]: ${orderNotes.trim()}` : '[PRESCRIPTION QUOTE REQUEST]',
        branchId: selectedBranchId !== 'all' ? selectedBranchId : 'b1',
        prescriptionImage: prescriptionImage,
        isPrescriptionQuoteRequest: true,
        items: [
          {
            medicineId: 'presc_quote_req',
            medicineName: "Doctor's Prescription Order (Awaiting Price Quote)",
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            category: 'Prescription'
          }
        ]
      };

      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setCompletedOrder(data.order);
        setShowDirectPrescriptionModal(false);
      } else {
        alert(data.error || 'Failed to place prescription order. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while placing prescription order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans">

      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Pharmacy Branding */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            {institution.logoUrl ? (
              <img
                src={institution.logoUrl}
                alt={institution.name || 'Institution Logo'}
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-1 shadow-sm shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                <Store className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h1 className="text-sm sm:text-lg md:text-xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent truncate">
                  {institution.name || 'Sonan Pharmacy & Healthcare'}
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-300/40 shrink-0">
                  Online Store
                </span>
              </div>
              {(institution.address || institution.phone) && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                  {institution.address && (
                    <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-emerald-600 shrink-0" /> {institution.address}</span>
                  )}
                  {institution.address && institution.phone && (
                    <span className="hidden md:inline">•</span>
                  )}
                  {institution.phone && (
                    <a href={`tel:${institution.phone}`} className="hidden md:flex items-center gap-1 hover:text-emerald-600 transition">
                      <Phone className="w-3 h-3 text-emerald-600 shrink-0" /> {institution.phone}
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Action Bar, Share Store & Cart Toggle */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 ml-auto shrink-0">
            {/* Quick Mobile Contact Shortcuts */}
            <div className="flex sm:hidden items-center gap-1">
              <a
                href={`tel:${institution.phone}`}
                className="p-2 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl bg-slate-100 dark:bg-slate-800 transition"
                title="Call Pharmacy Hotline"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
              </a>
              <a
                href={`${waBaseUrl}?text=${encodeURIComponent(`Hello ${institution.name}, I would like to place an order.`)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-emerald-700 dark:text-emerald-300 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 transition"
                title="Chat on WhatsApp"
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              </a>
            </div>

            {/* Branch Selector (Desktop) */}
            {branches.length > 0 && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="hidden lg:block text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Pickup Branches</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {/* Selective Customer Popups Header Button (Desktop) */}
            {selectivePopupConfig?.enabled && selectivePopupConfig?.items && selectivePopupConfig.items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPopupIndex(0);
                  setShowSelectivePopupModal(true);
                }}
                className="hidden sm:flex px-3 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-extrabold text-xs items-center space-x-1.5 transition shadow-sm cursor-pointer"
                title="View Selective Customer Deals & Popups"
              >
                <Sparkles className="w-3.5 h-3.5 fill-white text-white" />
                <span>Special Deals ({selectivePopupConfig.items.length})</span>
              </button>
            )}

            {/* Promo Video Header Button (Desktop) */}
            {promoVideos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!selectedPromoVideo && promoVideos.length > 0) {
                    setSelectedPromoVideo(promoVideos[0]);
                  }
                  setShowPromoVideoModal(true);
                }}
                className="hidden md:flex px-3 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-xl font-extrabold text-xs items-center space-x-1.5 transition shadow-sm cursor-pointer"
                title="Watch Store Promotional Video"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Promo Video</span>
              </button>
            )}

            {/* Track Order Status Button (Desktop) */}
            <button
              type="button"
              onClick={() => {
                setShowTrackModal(true);
                if (trackOrderQuery && trackingResults === null) {
                  handleTrackOrderSearch(trackOrderQuery);
                }
              }}
              className="hidden sm:flex px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-xl font-bold text-xs items-center space-x-1.5 transition shadow-sm cursor-pointer"
              title="Track Purchase Order Status"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Track Order</span>
            </button>

            {/* AI Pharmacist & Teleconsultation Header Button (Desktop) */}
            <button
              type="button"
              onClick={() => setShowConsultationHubModal(true)}
              className="hidden sm:flex px-3.5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl font-black text-xs items-center space-x-1.5 transition shadow-md cursor-pointer"
              title="Speak to Licensed Pharmacist or Ask AI Assistant"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>AI & Teleconsult</span>
            </button>

            {/* Share Store Link Dropdown / Button */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setShowShareStoreMenu(!showShareStoreMenu)}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition shadow-sm"
                title="Share Store Link"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>

              {showShareStoreMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Share Store Catalog</span>
                    <button onClick={() => setShowShareStoreMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { shareStoreToSocial('whatsapp'); setShowShareStoreMenu(false); }}
                      className="p-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => { shareStoreToSocial('telegram'); setShowShareStoreMenu(false); }}
                      className="p-2 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 transition"
                    >
                      <Send className="w-3.5 h-3.5 text-sky-500" />
                      <span>Telegram</span>
                    </button>

                    <button
                      onClick={() => { shareStoreToSocial('facebook'); setShowShareStoreMenu(false); }}
                      className="p-2 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 transition"
                    >
                      <Share2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Facebook</span>
                    </button>

                    <button
                      onClick={() => { shareStoreToSocial('twitter'); setShowShareStoreMenu(false); }}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold flex items-center space-x-1.5 transition"
                    >
                      <Share className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                      <span>Twitter / X</span>
                    </button>

                    <button
                      onClick={() => { shareStoreToSocial('email'); setShowShareStoreMenu(false); }}
                      className="p-2 col-span-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1.5 transition"
                    >
                      <Mail className="w-3.5 h-3.5 text-amber-600" />
                      <span>Send via Email</span>
                    </button>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => { copyStoreLink(); setShowShareStoreMenu(false); }}
                      className="w-full py-2 px-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-[11px] flex items-center justify-center space-x-1.5 transition"
                    >
                      {copiedStoreLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedStoreLink ? 'Store Link Copied!' : 'Copy Direct Store Link'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setShowCartDrawer(true)}
              className="relative flex items-center space-x-1.5 sm:space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm transition shadow-sm"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {totalCartItemsCount > 0 && (
                <span className="bg-white text-emerald-700 text-[11px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-inner">
                  {totalCartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Sleek Mobile Horizontal Quick Action Strip */}
        <div className="sm:hidden border-t border-slate-200/80 dark:border-slate-800 px-3 py-2 bg-slate-50/90 dark:bg-slate-900/90 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setShowDirectPrescriptionModal(true)}
            className="px-2.5 py-1 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
          >
            <Camera className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Order by Rx Photo
          </button>
          <button
            type="button"
            onClick={() => setShowConsultationHubModal(true)}
            className="px-2.5 py-1 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
          >
            <Stethoscope className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> AI Pharmacist
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTrackModal(true);
              if (trackOrderQuery && trackingResults === null) {
                handleTrackOrderSearch(trackOrderQuery);
              }
            }}
            className="px-2.5 py-1 bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-400/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
          >
            <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> Track Order
          </button>
          {selectivePopupConfig?.enabled && selectivePopupConfig?.items && selectivePopupConfig.items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedPopupIndex(0);
                setShowSelectivePopupModal(true);
              }}
              className="px-2.5 py-1 bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-400/30 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
            >
              <Sparkles className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Deals ({selectivePopupConfig.items.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: institution.name || 'Sonan Pharmacy',
                  url: window.location.href
                }).catch(() => copyStoreLink());
              } else {
                copyStoreLink();
              }
            }}
            className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 active:scale-95 transition"
          >
            <Share2 className="w-3 h-3 text-slate-500" /> Share Store
          </button>
        </div>
      </header>

      {/* Hero Welcome Announcement */}
      <section className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white py-8 px-4 sm:px-6 lg:px-8 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Direct Fast Home Delivery & Store Pickup</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Order Genuine Medicines & Premium Cosmetics
            </h2>
            <p className="text-sm text-emerald-100/80 max-w-2xl">
              Browse our live catalog, upload prescriptions, and order online in minutes. Safe, verified pharmaceutical care delivered straight to your door.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 text-xs text-emerald-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-white">Store Order Hours</p>
                <p className="text-emerald-200">24/7 Online Order Reception</p>
              </div>
            </div>

            <button
              onClick={() => setShowDirectPrescriptionModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer border border-amber-300/30"
            >
              <Camera className="w-4 h-4" />
              <span>⚡ Order by Prescription Photo</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pop-up Promotional Video Banner (Above Catalog) */}
      {promoVideos.length > 0 && showPromoBanner && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-2 border-amber-500/50 p-4 sm:p-5 text-white shadow-2xl">
            {/* Background ambient glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
              
              {/* Left Side Info */}
              <div className="space-y-2 text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Official Store Video Promotion</span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                  {selectedPromoVideo?.title || promoVideos[0]?.title}
                </h3>
                {selectedPromoVideo?.description && (
                  <p className="text-xs text-slate-300 line-clamp-2 max-w-xl">
                    {selectedPromoVideo.description}
                  </p>
                )}
                <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <button
                    onClick={() => {
                      if (!selectedPromoVideo && promoVideos.length > 0) {
                        setSelectedPromoVideo(promoVideos[0]);
                      }
                      setShowPromoVideoModal(true);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600 hover:from-amber-600 hover:to-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer border border-amber-300/40 transform hover:scale-105"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Watch Full Promotional Video</span>
                  </button>
                  <span className="text-[11px] text-amber-200/80 font-medium flex items-center gap-1">
                    <Maximize2 className="w-3 h-3 text-amber-400" /> Click to open full video view
                  </span>
                </div>
              </div>

              {/* Right Side Video Preview Thumbnail / Mini Player */}
              <div 
                onClick={() => {
                  if (!selectedPromoVideo && promoVideos.length > 0) {
                    setSelectedPromoVideo(promoVideos[0]);
                  }
                  setShowPromoVideoModal(true);
                }}
                className="relative group cursor-pointer rounded-2xl overflow-hidden border-2 border-amber-400/30 bg-black/80 shadow-2xl w-full md:w-80 shrink-0 aspect-video flex items-center justify-center"
              >
                {(selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.startsWith('data:video') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.endsWith('.mp4') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.endsWith('.webm') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.includes('googleapis') ? (
                  <video 
                    src={selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl} 
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-indigo-900 flex items-center justify-center text-xs text-slate-300 font-bold p-3 text-center">
                    🎬 {selectedPromoVideo?.title || promoVideos[0]?.title}
                  </div>
                )}

                {/* Hover Play Overlay */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-2xl group-hover:scale-110 transition border-2 border-white/40">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-extrabold text-white flex items-center gap-1 border border-white/20">
                  <Maximize2 className="w-3 h-3 text-amber-400" /> Enlarge Video
                </span>
              </div>

              {/* Close/Dismiss Banner Button */}
              <button
                onClick={() => setShowPromoBanner(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Dismiss Banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full pb-28 sm:pb-12">
        
        {/* Controls, Filters & Search */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 mb-8">
          
          {/* Top Row: Search & Product Type Tabs */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input with Voice Search AI button */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search medicine, cosmetic, generic name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-20 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowVoiceModal(true);
                    startCustomerVoiceRecognition();
                  }}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  title="Customer Voice AI Assistant"
                >
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                </button>
              </div>
            </div>

            {/* Main Category Tabs: Medicine vs Cosmetics */}
            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
              <button
                onClick={() => { setSelectedType('all'); setSelectedCategory('all'); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  selectedType === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => { setSelectedType('medicine'); setSelectedCategory('all'); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  selectedType === 'medicine'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Medicines</span>
                <span className="text-[10px] opacity-80 font-normal">💊</span>
              </button>
              <button
                onClick={() => { setSelectedType('cosmetics'); setSelectedCategory('all'); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 ${
                  selectedType === 'cosmetics'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Cosmetics & Skincare</span>
                <span className="text-[10px] opacity-80 font-normal">🧴</span>
              </button>
            </div>
          </div>

          {/* Catalog Highlights Row: Newly Added & Refilled Products */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Catalog Highlights:
              </span>
              <button
                onClick={() => {
                  setSpecialFilter('all');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  specialFilter === 'all'
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => {
                  setSpecialFilter('newly_added');
                  setSortOption('newest');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                  specialFilter === 'newly_added'
                    ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <span>✨ Newly Added Products</span>
              </button>
              <button
                onClick={() => {
                  setSpecialFilter('refilled');
                  setSortOption('refilled');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                  specialFilter === 'refilled'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200/60'
                }`}
              >
                <span>🔄 Recently Refilled / Restocked</span>
              </button>
            </div>
            {specialFilter !== 'all' && (
              <button
                onClick={() => {
                  setSpecialFilter('all');
                  setSortOption('default');
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 shrink-0 cursor-pointer ml-auto"
              >
                <X className="w-3 h-3" /> Reset Highlights
              </button>
            )}
          </div>

          {/* Subcategories Pills & In-Stock Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            
            {/* Subcategory Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1 shrink-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600" /> 
                {selectedType === 'cosmetics' ? 'Cosmetics Categories:' : selectedType === 'medicine' ? 'Medicine Categories:' : 'Subcategories:'}
              </span>
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                All Subcategories
              </button>
              {activeSubcategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    const isCosSub = COSMETICS_SUBCATEGORIES.some(sc => sc.toLowerCase() === cat.toLowerCase());
                    const isMedSub = MEDICINE_SUBCATEGORIES.some(sc => sc.toLowerCase() === cat.toLowerCase());
                    if (isCosSub && selectedType === 'medicine') {
                      setSelectedType('cosmetics');
                    } else if (isMedSub && selectedType === 'cosmetics') {
                      setSelectedType('medicine');
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* In-stock checkbox */}
            <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer font-medium ml-auto">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* Price Range Filter & Sorting Toolbar */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left side: Price Presets & Range Inputs */}
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <span className="font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Price Filter (ETB):
              </span>

              {/* Price Range Presets */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                {[
                  { id: 'all', label: 'All Prices', min: '', max: '' },
                  { id: '0-100', label: '< 100 ETB', min: '0', max: '100' },
                  { id: '100-500', label: '100 - 500 ETB', min: '100', max: '500' },
                  { id: '500-1000', label: '500 - 1,000 ETB', min: '500', max: '1000' },
                  { id: '1000+', label: '1,000+ ETB', min: '1000', max: '' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setPricePreset(preset.id);
                      setMinPrice(preset.min);
                      setMaxPrice(preset.max);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 cursor-pointer ${
                      pricePreset === preset.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Min / Max Inputs */}
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="number"
                  placeholder="Min ETB"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPricePreset('custom');
                  }}
                  className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  placeholder="Max ETB"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPricePreset('custom');
                  }}
                  className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {(minPrice !== '' || maxPrice !== '' || pricePreset !== 'all') && (
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setPricePreset('all');
                  }}
                  className="text-[11px] font-bold text-red-500 hover:text-red-600 dark:text-red-400 flex items-center gap-0.5 ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear Price Filter
                </button>
              )}
            </div>

            {/* Right side: Sort Selector */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-bold text-slate-500 dark:text-slate-400 shrink-0">
                Sort By:
              </span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="default">Default Order</option>
                <option value="newest">✨ Newly Added Products First</option>
                <option value="refilled">🔄 Recently Refilled Products First</option>
                <option value="price_asc">Price: Low to High 🏷️↑</option>
                <option value="price_desc">Price: High to Low 🏷️↓</option>
                <option value="name_asc">Product Name: A to Z 🔤</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading store products catalog...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl text-center max-w-md mx-auto my-12">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-3">{error}</p>
            <button
              onClick={fetchCatalog}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty Search Results */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No Products Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              We couldn't find any products matching your search or active filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedType('all'); setSelectedCategory('all'); setInStockOnly(false); }}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.medicine.id === item.id);
              const isCosmetic = isCosmeticsItem(item);
              const isInStock = item.inStock ?? (item.availableQuantity ?? 0) > 0;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
                >
                  {/* Top Image Box */}
                  <div 
                    onClick={() => setSelectedDetailItem(item)}
                    className="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center cursor-pointer"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-850 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-4xl mb-2">{isCosmetic ? '🧴' : '💊'}</span>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.category || (isCosmetic ? 'Cosmetics' : 'Medicine')}</span>
                      </div>
                    )}

                    {/* Hover Overlay Button */}
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white px-3 py-1.5 rounded-full text-xs font-black shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> View Details
                      </span>
                    </div>

                    {/* Product Badges (Type, Newly Added, Refilled) */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start pointer-events-none z-10">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border shadow-sm ${
                        isCosmetic
                          ? 'bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-300/50'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300/50'
                      }`}>
                        {isCosmetic ? 'Cosmetics' : 'Medicine'}
                      </span>

                      {item.isNewArrival && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500 text-white shadow-sm flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Newly Added</span>
                        </span>
                      )}

                      {item.isRefilled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-blue-600 text-white shadow-sm flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          <span>Refilled</span>
                        </span>
                      )}
                    </div>

                    {/* Prescription Required Pill */}
                    {item.isPrescriptionRequired && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 pointer-events-none z-10">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Rx Required</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div onClick={() => setSelectedDetailItem(item)} className="cursor-pointer">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {item.name}
                        </h3>
                      </div>

                      {(item.isNewArrival || item.isRefilled) && (
                        <div className="flex flex-wrap items-center gap-1 mb-1.5">
                          {item.isNewArrival && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" /> New Arrival
                            </span>
                          )}
                          {item.isRefilled && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 text-blue-500" /> Restocked
                            </span>
                          )}
                        </div>
                      )}

                      {item.genericName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic mb-2">
                          {item.genericName}
                        </p>
                      )}

                      {item.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Footer Info & Pricing */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-400 font-medium block">Price / {item.unit || 'Unit'}</span>
                          <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                            {item.price.toLocaleString()} <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ETB</span>
                          </span>
                        </div>

                        {/* Stock status indicator */}
                        <div className="text-right">
                          {isInStock ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> In Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2.5 py-0.5 rounded-md uppercase tracking-wide border border-red-200 dark:border-red-900/50">
                              SOLD OUT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Add / Quantity Control */}
                      {inCart ? (
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/50 p-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                            {inCart.quantity} in Cart
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold hover:bg-emerald-700 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={!isInStock}
                          onClick={() => addToCart(item)}
                          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
                            isInStock
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 cursor-not-allowed font-extrabold uppercase'
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{isInStock ? 'Add to Order Cart' : 'SOLD OUT'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Drawer Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Your Order Cart</h3>
                <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold px-2 py-0.5 rounded-full">
                  {cart.length} item(s)
                </span>
              </div>
              <button
                onClick={() => setShowCartDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Items Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-semibold mb-1">Your cart is currently empty</p>
                  <p className="text-xs text-slate-500">Browse available medicines & cosmetics to add items.</p>
                </div>
              ) : (
                <>
                  {hasPrescriptionItemInCart && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Prescription Required Item Included</span>
                        <span>Your cart contains prescription items. You will be prompted to upload a photo of your doctor's prescription during checkout.</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {cart.map(c => (
                      <div
                        key={c.medicine.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                            {c.medicine.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {c.medicine.price.toLocaleString()} ETB x {c.quantity}
                          </p>
                          <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {(c.medicine.price * c.quantity).toLocaleString()} ETB
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                          <button
                            onClick={() => updateCartQuantity(c.medicine.id, -1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold px-1 min-w-[18px] text-center">
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(c.medicine.id, 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer Summary & Checkout Trigger */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-3">
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span>Cart Subtotal:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{cartSubtotal.toLocaleString()} ETB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Estimate:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Calculated on Call</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>Total Amount:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{cartSubtotal.toLocaleString()} ETB</span>
                  </div>
                </div>

                <button
                  onClick={() => { setShowCartDrawer(false); setShowOrderModal(true); }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Customer Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Order Placement Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileText className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="font-extrabold text-base">Complete Customer Order</h3>
                  <p className="text-xs text-emerald-100">Enter your details for delivery and confirmation</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handlePlaceOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              {/* Guest Quick Notice */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Fast Guest Order:</span> No registration, username, or password required! Just enter your name, phone number, and delivery address below.
                </div>
              </div>

              {/* Order Summary Box */}
              <div className="bg-slate-50 dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span>Ordered Items ({totalCartItemsCount}):</span>
                  <span>{cartSubtotal.toLocaleString()} ETB</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {cart.map(c => `${c.medicine.name} (x${c.quantity})`).join(', ')}
                </div>
              </div>

              {/* Prescription Attachment Section */}
              {hasPrescriptionItemInCart && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Camera className="w-4 h-4 text-amber-600" />
                    <span>Upload Doctor's Prescription (File or Direct Camera Photo)</span>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Attach a clear photo or document of your prescription for pharmacy verification.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{prescriptionImage ? 'Change File' : 'Upload File / Photo'}</span>
                      <input
                        type="file"
                        accept="*/*"
                        onChange={handlePrescriptionUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Snap Phone Camera Photo</span>
                    </button>

                    <input
                      type="file"
                      id="phone-camera-file-input"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePrescriptionUpload}
                      className="hidden"
                    />

                    {prescriptionImage && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 ml-auto">
                        <Check className="w-4 h-4" /> Attached!
                      </span>
                    )}
                  </div>

                  {prescriptionImage && (
                    <div className="mt-2 h-24 w-36 rounded-xl border border-amber-300 overflow-hidden bg-slate-100 shadow-sm relative group">
                      <img src={prescriptionImage} alt="Prescription Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPrescriptionImage('')}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow hover:bg-red-700 text-[10px]"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Customer Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (for Order Delivery Confirmation) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +251 911 223 344"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Delivery Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Subcity & Delivery Address / Landmark *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-extrabold transition cursor-pointer border border-emerald-300/40"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Set on Google Map</span>
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Bole Subcity, Woreda 03, near Medhanialem Church, House #104"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Special Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Notes / Special Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please deliver after 2 PM or call before arrival"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
                >
                  {submittingOrder ? (
                    <span>Submitting Order...</span>
                  ) : (
                    <>
                      <span>Submit Order to Pharmacy</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Confirmation Success Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in duration-200">
            
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Order Successfully Placed</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                Order #{completedOrder.orderNumber}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Thank you, <span className="font-bold text-slate-700 dark:text-slate-200">{completedOrder.customerName}</span>! Our pharmacy team has received your order.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl text-left text-xs space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Phone:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Address:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{completedOrder.deliveryAddress}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-300">Total Amount:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{completedOrder.totalAmount?.toLocaleString()} ETB</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              📞 Our pharmacist will call you at <strong className="text-slate-700 dark:text-slate-200">{completedOrder.customerPhone}</strong> shortly to confirm item dispatch and delivery time.
            </p>

            {/* Share Order Receipt Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block text-left">
                Share Order Receipt / Confirmation
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => shareOrderToWhatsApp(completedOrder)}
                  className="py-2 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-emerald-200 dark:border-emerald-800/60"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareOrderToTelegram(completedOrder)}
                  className="py-2 px-2.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-sky-200 dark:border-sky-800/60"
                >
                  <Send className="w-3.5 h-3.5 text-sky-500" />
                  <span>Telegram</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareOrderToFacebook(completedOrder)}
                  className="py-2 px-2.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-blue-200 dark:border-blue-800/60"
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Facebook</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareOrderToEmail(completedOrder)}
                  className="py-2 px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-amber-200 dark:border-amber-800/60"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-600" />
                  <span>Email Receipt</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => shareOrderNative(completedOrder)}
                  className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  <span>More Sharing Options</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyOrderReceipt(completedOrder)}
                  className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition shrink-0"
                  title="Copy Full Receipt Text"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReceipt ? 'Copied!' : 'Copy Receipt'}</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrackOrderQuery(completedOrder.orderNumber);
                  handleTrackOrderSearch(completedOrder.orderNumber);
                  setShowTrackModal(true);
                }}
                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition shadow"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Track Order Status</span>
              </button>

              <button
                type="button"
                onClick={() => setCompletedOrder(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition"
              >
                Back to Store
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Order by Prescription Photo Modal */}
      {showDirectPrescriptionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Camera className="w-6 h-6 text-amber-200" />
                <div>
                  <h3 className="font-extrabold text-base">Order Direct by Prescription Photo</h3>
                  <p className="text-xs text-amber-100">Upload prescription & receive price quote directly</p>
                </div>
              </div>
              <button
                onClick={() => setShowDirectPrescriptionModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePlacePrescriptionQuoteOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>How it works:</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  1. Snap or upload your paper prescription photo.<br/>
                  2. Enter your delivery address & contact details.<br/>
                  3. Our licensed pharmacist will review your prescription and reply with a complete price quote!
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <label className="cursor-pointer inline-flex items-center space-x-2 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition">
                    <Upload className="w-4 h-4" />
                    <span>{prescriptionImage ? 'Change Image File' : 'Upload Prescription File'}</span>
                    <input
                      type="file"
                      accept="*/*"
                      onChange={handlePrescriptionUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Direct Camera Photo</span>
                  </button>
                </div>

                {prescriptionImage && (
                  <div className="mt-2 h-36 w-full rounded-xl border border-amber-300 overflow-hidden bg-slate-100 dark:bg-slate-900 relative group p-2 flex items-center justify-center">
                    {prescriptionImage.startsWith('data:application/pdf') ? (
                      <div className="text-center p-2">
                        <FileText className="w-10 h-10 text-amber-600 mx-auto mb-1" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate max-w-xs">
                          {prescriptionFileName || 'PDF Prescription Document Attached'}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-extrabold">Ready for Pharmacist Review</span>
                      </div>
                    ) : (
                      <img src={prescriptionImage} alt="Prescription Attachment" className="w-full h-full object-contain bg-slate-900/5 rounded-lg" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setPrescriptionImage(''); setPrescriptionFileName(''); }}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full shadow hover:bg-red-700 text-xs cursor-pointer z-10"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Customer Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (for Quote & Delivery) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +251 911 223 344"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Delivery Address */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Delivery Address *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 rounded-lg text-[11px] font-extrabold transition cursor-pointer border border-amber-300/40"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Set on Google Map</span>
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Bole Subcity, Woreda 03, House #124, Addis Ababa"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Notes / Medicine Quantities (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Need 1 month supply of medicine #2 on prescription"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectPrescriptionModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder || !prescriptionImage}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-2"
                >
                  {submittingOrder ? (
                    <span>Submitting Order...</span>
                  ) : (
                    <>
                      <span>Submit for Price Quote</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Video Camera Capture Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 max-w-lg w-full text-white space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Snap Prescription Camera Photo</h3>
              </div>
              <button onClick={stopCamera} className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureCameraPhoto}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-lg flex items-center justify-center space-x-2"
              >
                <Camera className="w-4 h-4" />
                <span>Snap Photo Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Purchase Order Status Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <PackageCheck className="w-6 h-6 text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Track Purchase Order Status</h3>
                  <p className="text-xs text-indigo-200">Enter your order reference number or registered phone number</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {/* Order Search Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTrackOrderSearch();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Enter Order # (e.g. ORD-123456) or Phone Number"
                    value={trackOrderQuery}
                    onChange={(e) => setTrackOrderQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-2xl shadow-md transition flex items-center space-x-2 shrink-0 cursor-pointer"
                >
                  {trackLoading ? (
                    <span>Searching...</span>
                  ) : (
                    <>
                      <span>Track Order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {trackError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{trackError}</span>
                </div>
              )}

              {/* Order Tracking Results List */}
              {trackingResults && trackingResults.length > 0 && (
                <div className="space-y-6">
                  {trackingResults.map((ord: any) => {
                    const statusSteps = [
                      { key: 'Pending', label: 'Order Received', desc: 'Received & Pending Review' },
                      { key: 'Quote Sent', label: 'Price Quoted', desc: 'Pharmacy Price Sent' },
                      { key: 'Confirmed', label: 'Confirmed', desc: 'Preparing & Processing' },
                      { key: 'Dispatched', label: 'Dispatched', desc: 'Out for Delivery / Pickup' },
                      { key: 'Completed', label: 'Completed', desc: 'Delivered & Completed' },
                    ];

                    // Helper to compute progress step level
                    const getStepIndex = (status: string) => {
                      switch (status) {
                        case 'Pending': return 0;
                        case 'Quote Sent': return 1;
                        case 'Confirmed': return 2;
                        case 'Dispatched': return 3;
                        case 'Completed': return 4;
                        case 'Cancelled': return -1;
                        default: return 0;
                      }
                    };

                    const currentStepIdx = getStepIndex(ord.status);
                    const isCancelled = ord.status === 'Cancelled';

                    return (
                      <div
                        key={ord.id}
                        className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 space-y-5 shadow-sm"
                      >
                        {/* Order Summary Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-base font-black text-slate-900 dark:text-white">
                                Order #{ord.orderNumber}
                              </span>
                              {isCancelled ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200">
                                  Cancelled
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  {ord.status}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>Placed: {new Date(ord.createdAt).toLocaleString()}</span>
                              <span>•</span>
                              <span>Customer: {ord.customerName} ({ord.customerPhone})</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">Total Amount</span>
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                              {(ord.quotedPrice || ord.totalAmount || 0).toLocaleString()} ETB
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Steps Bar */}
                        {!isCancelled && (
                          <div className="py-2">
                            <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 block mb-3 uppercase tracking-wider">
                              Order Status Tracker Progress
                            </span>
                            
                            <div className="grid grid-cols-5 gap-1 text-center relative">
                              {statusSteps.map((step, idx) => {
                                const isDone = currentStepIdx > idx;
                                const isCurrent = currentStepIdx === idx;
                                return (
                                  <div key={step.key} className="flex flex-col items-center relative z-10">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                                        isDone
                                          ? 'bg-emerald-600 text-white'
                                          : isCurrent
                                          ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950'
                                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                      }`}
                                    >
                                      {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1.5 leading-tight ${
                                      isCurrent
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : isDone
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-400'
                                    }`}>
                                      {step.label}
                                    </span>
                                    <span className="text-[9px] text-slate-400 hidden sm:block mt-0.5">
                                      {step.desc}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Price Quote / Admin Response Box if available */}
                        {(ord.quotedPrice || ord.adminNotes || ord.status === 'Quote Sent') && (
                          <div className="p-3.5 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800/80 rounded-2xl space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-extrabold text-teal-900 dark:text-teal-200">
                              <span className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-teal-600" /> Pharmacy Price Quote Response:
                              </span>
                              <span className="px-2 py-0.5 bg-teal-600 text-white rounded-lg text-[11px]">
                                {ord.quotedPrice ? `${ord.quotedPrice.toLocaleString()} ETB` : 'Quote Issued'}
                              </span>
                            </div>
                            {ord.adminNotes && (
                              <p className="text-xs text-teal-800 dark:text-teal-300 font-medium">
                                💬 Note: {ord.adminNotes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Order Items Table */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 space-y-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                            Order Items ({ord.items?.length || 0})
                          </span>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {ord.items?.map((item: any, i: number) => (
                              <div key={i} className="py-2 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                                    {item.quantity}x
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{item.medicineName}</p>
                                    <p className="text-[10px] text-slate-400">{item.category || 'Medicine'}</p>
                                  </div>
                                </div>
                                <div className="text-right font-bold text-slate-700 dark:text-slate-300">
                                  {item.unitPrice > 0 ? `${(item.unitPrice * item.quantity).toLocaleString()} ETB` : 'Price on Quote'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Prescription Photo Attachment if present */}
                        {ord.prescriptionImage && (
                          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                              <Camera className="w-4 h-4 text-amber-600" />
                              <span>Attached Doctor's Prescription</span>
                            </div>
                            <a
                              href={ord.prescriptionImage}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> View Prescription
                            </a>
                          </div>
                        )}

                        {/* Delivery Address */}
                        <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                          <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">Delivery Address:</span>
                            <span>{ord.deliveryAddress}</span>
                          </div>
                        </div>

                        {/* Quick Action Contacts */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={`${waBaseUrl}?text=${encodeURIComponent(`Hello ${institution.name}, I am checking status on my Order #${ord.orderNumber}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-emerald-200 dark:border-emerald-800/60"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp Pharmacy</span>
                          </a>

                          <a
                            href={`tel:${institution.phone}`}
                            className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            <span>Call Pharmacy</span>
                          </a>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Footer Close */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setShowTrackModal(false)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Tracking
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Sleek Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-2 shadow-2xl sm:hidden grid grid-cols-5 gap-1 items-center">
        {/* Catalog Home */}
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setSelectedCategory('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center justify-center py-1 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition"
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold leading-none">Catalog</span>
        </button>

        {/* Snap Rx Upload */}
        <button
          type="button"
          onClick={() => setShowDirectPrescriptionModal(true)}
          className="flex flex-col items-center justify-center py-1 text-amber-600 dark:text-amber-400 active:scale-95 transition"
        >
          <Camera className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold leading-none">Snap Rx</span>
        </button>

        {/* Teleconsult & AI Hub */}
        <button
          type="button"
          onClick={() => setShowConsultationHubModal(true)}
          className="flex flex-col items-center justify-center py-1 text-emerald-600 dark:text-emerald-400 active:scale-95 transition"
        >
          <Stethoscope className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold leading-none">Consult</span>
        </button>

        {/* Track Order */}
        <button
          type="button"
          onClick={() => setShowTrackModal(true)}
          className="flex flex-col items-center justify-center py-1 text-indigo-600 dark:text-indigo-400 active:scale-95 transition"
        >
          <PackageCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-bold leading-none">Track</span>
        </button>

        {/* Cart Drawer */}
        <button
          type="button"
          onClick={() => setShowCartDrawer(true)}
          className="flex flex-col items-center justify-center py-1 text-emerald-700 dark:text-emerald-300 relative active:scale-95 transition"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            {totalCartItemsCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[15px] text-center shadow-sm">
                {totalCartItemsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold leading-none">Cart</span>
        </button>
      </div>

      {/* Customer Voice Assistance AI Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/30 rounded-xl border border-emerald-400/30">
                  <Sparkles className="w-5 h-5 text-emerald-300 animate-spin" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    Customer Voice Assistant AI
                    <span className="px-2 py-0.5 bg-emerald-500/40 border border-emerald-300/40 text-[10px] rounded-full uppercase tracking-wider">Live</span>
                  </h3>
                  <p className="text-xs text-emerald-200">Speak or write to search medicines, cosmetics & upload prescriptions</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (voiceRecognitionRef.current) voiceRecognitionRef.current.stop();
                  try { window.speechSynthesis.cancel(); } catch(e){}
                  setShowVoiceModal(false);
                }}
                className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Mic Visualizer / Listening Sphere */}
              <div className="text-center py-4 space-y-3">
                <button
                  type="button"
                  onClick={startCustomerVoiceRecognition}
                  className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                    isVoiceListening 
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 animate-bounce ring-8 ring-red-300 dark:ring-red-900/50 text-white' 
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:scale-105 ring-4 ring-emerald-200 dark:ring-emerald-900/40 text-white'
                  }`}
                >
                  {isVoiceListening ? <Mic className="w-10 h-10 animate-pulse" /> : <Mic className="w-10 h-10" />}
                </button>

                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    {isVoiceListening ? 'Listening... Speak now!' : 'Tap Microphone to Speak'}
                  </span>
                  {voiceTranscript && (
                    <p className="text-xs italic text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl max-w-sm mx-auto">
                      {voiceTranscript}
                    </p>
                  )}
                </div>
              </div>

              {/* Voice AI Response Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> AI Assistant Response:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTtsActive(!isTtsActive)}
                    className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                      isTtsActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                    title="Toggle Text-to-Speech Voice Audio"
                  >
                    {isTtsActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{isTtsActive ? 'Audio ON' : 'Mute'}</span>
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  {voiceAiResponse}
                </p>
              </div>

              {/* Quick Spoken Command Chips */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Quick Voice Action Examples:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '🔍 Search Paracetamol', query: 'Search Paracetamol' },
                    { label: '💄 Browse Cosmetics', query: 'Show Cosmetics' },
                    { label: '💊 Browse Medicines', query: 'Show Medicines' },
                    { label: '📸 Order by Prescription Photo', query: 'Order prescription' },
                    { label: '🛍️ View Shopping Cart', query: 'Open cart' },
                    { label: '📍 Store Location & Map', query: 'Where is the store location?' }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        setVoiceTranscript(`"${chip.query}"`);
                        handleProcessCustomerVoiceQuery(chip.query);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-100 dark:bg-slate-800 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fallback Text Input Query */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (voiceQueryText.trim()) {
                    setVoiceTranscript(`"${voiceQueryText.trim()}"`);
                    handleProcessCustomerVoiceQuery(voiceQueryText.trim());
                    setVoiceQueryText('');
                  }
                }}
                className="flex items-center space-x-2 pt-2"
              >
                <input
                  type="text"
                  placeholder="Or type voice query here..."
                  value={voiceQueryText}
                  onChange={(e) => setVoiceQueryText(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 bg-white/10 rounded-xl text-xl">
                  {selectedDetailItem.productType === 'cosmetics' ? '🧴' : '💊'}
                </span>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg line-clamp-1">
                    {selectedDetailItem.name}
                  </h3>
                  <p className="text-xs text-emerald-200 font-medium">
                    {selectedDetailItem.productType === 'cosmetics' ? 'Cosmetics & Beauty Product' : 'Pharmaceutical Product'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="p-2 text-slate-300 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              
              {/* Image & Basic Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Photo Display */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-64 sm:h-72 flex items-center justify-center">
                  {selectedDetailItem.imageUrl ? (
                    <img
                      src={selectedDetailItem.imageUrl}
                      alt={selectedDetailItem.name}
                      className="w-full h-full object-contain p-2"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-2">
                      <span className="text-6xl block">
                        {isCosmeticsItem(selectedDetailItem) ? '🧴' : '💊'}
                      </span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        {selectedDetailItem.category || 'Pharmacy Item'}
                      </span>
                    </div>
                  )}

                  {/* Prescription Requirement Badge */}
                  {selectedDetailItem.isPrescriptionRequired && (
                    <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full shadow flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Doctor Prescription Required</span>
                    </div>
                  )}
                </div>

                {/* Core Specifications */}
                <div className="space-y-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300/50 inline-block mb-2">
                      {selectedDetailItem.category || (isCosmeticsItem(selectedDetailItem) ? 'Cosmetics' : 'General Medicine')}
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
                      {selectedDetailItem.name}
                    </h2>
                    {selectedDetailItem.genericName && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic font-medium mt-1">
                        Generic / Brand Name: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedDetailItem.genericName}</span>
                      </p>
                    )}
                  </div>

                  {/* Pricing & Stock Card */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Price / {selectedDetailItem.unit || 'Unit'}</span>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {selectedDetailItem.price.toLocaleString()} <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ETB</span>
                      </span>
                    </div>

                    <div>
                      {((selectedDetailItem as any).inStock ?? ((selectedDetailItem as any).availableQuantity ?? 0) > 0) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-300/50">
                          <CheckCircle2 className="w-4 h-4" /> Available In Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/80 px-3 py-1 rounded-full border border-red-300/50 uppercase">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Identifiers */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Packaging Unit</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{selectedDetailItem.unit || 'Strip / Bottle'}</span>
                    </div>
                    {selectedDetailItem.barcode && (
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">SKU / Barcode</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{selectedDetailItem.barcode}</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Detailed Item Description & Pharmacy Notes */}
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    Detailed Product Description
                  </h4>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {selectedDetailItem.description ? (
                    <p className="whitespace-pre-line font-medium text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                      {selectedDetailItem.description}
                    </p>
                  ) : (
                    <p className="italic text-slate-500">
                      High-quality {isCosmeticsItem(selectedDetailItem) ? 'cosmetics and personal care product' : 'healthcare and pharmaceutical item'} supplied directly from authentic distributors for {institution.name}.
                    </p>
                  )}

                  {/* Structured Usage & Safety Guidelines - Only for Medicine */}
                  {!isCosmeticsItem(selectedDetailItem) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700/80">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="font-black text-[11px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                          💊 Dosage & Administration
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Take as prescribed by a licensed medical practitioner or according to the enclosed patient leaflet.
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                        <span className="font-black text-[11px] text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                          🌡️ Storage & Precaution
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          Store in a cool, dry place below 25°C away from direct sunlight. Keep out of reach of children.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer Cart Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              {(() => {
                const inCart = cart.find(c => c.medicine.id === selectedDetailItem.id);
                const isInStock = (selectedDetailItem as any).inStock ?? ((selectedDetailItem as any).availableQuantity ?? 0) > 0;

                if (inCart) {
                  return (
                    <div className="flex items-center justify-between w-full bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-2xl border border-emerald-200 dark:border-emerald-800/80">
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(selectedDetailItem.id, -1)}
                          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black hover:bg-slate-100 shadow-sm cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-base font-black text-emerald-800 dark:text-emerald-200">
                          {inCart.quantity} in Shopping Cart
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(selectedDetailItem.id, 1)}
                          className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black hover:bg-emerald-700 shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailItem(null);
                          setShowCartDrawer(true);
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer"
                      >
                        <span>View Cart ({cartSubtotal.toLocaleString()} ETB)</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center justify-between w-full gap-4">
                    <div>
                      <span className="text-[11px] text-slate-400 font-bold block">Total Price:</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {selectedDetailItem.price.toLocaleString()} ETB
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!isInStock}
                      onClick={() => addToCart(selectedDetailItem)}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center space-x-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item to Cart</span>
                    </button>
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Google Map Location Picker Modal */}
      {showMapPicker && (
        <GoogleMapLocationPicker
          initialAddress={deliveryAddress}
          onSelectLocation={(data) => setDeliveryAddress(data.address)}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* Full View Promotional Video Modal Overlay */}
      {showPromoVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 animate-in fade-in">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0 text-white my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  Official Store Promotion Video
                </h3>
              </div>
              <button
                onClick={() => setShowPromoVideoModal(false)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Multiple Videos Tabs if > 1 */}
            {promoVideos.length > 1 && (
              <div className="flex items-center gap-2 p-3 px-6 bg-slate-950/40 border-b border-slate-800 overflow-x-auto">
                {promoVideos.map((vid, idx) => (
                  <button
                    key={vid.id || idx}
                    onClick={() => setSelectedPromoVideo(vid)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition shrink-0 cursor-pointer ${
                      selectedPromoVideo?.id === vid.id
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    🎬 Video #{idx + 1}: {vid.title}
                  </button>
                ))}
              </div>
            )}

            {/* Video Player Display */}
            <div className="relative bg-black aspect-video w-full flex items-center justify-center overflow-hidden">
              {(selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.startsWith('data:video') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.endsWith('.mp4') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.endsWith('.webm') || (selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl)?.includes('googleapis') ? (
                <video
                  src={selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain max-h-[65vh]"
                />
              ) : (
                <iframe
                  src={selectedPromoVideo?.videoUrl || promoVideos[0]?.videoUrl}
                  className="w-full h-full min-h-[45vh]"
                  title={selectedPromoVideo?.title || 'Promotional Video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {/* Video Details & Call to Action Footer */}
            <div className="p-4 sm:p-5 px-6 bg-slate-950 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="font-bold text-sm sm:text-base text-white">
                  {selectedPromoVideo?.title || promoVideos[0]?.title}
                </h4>
                {(selectedPromoVideo?.description || promoVideos[0]?.description) && (
                  <p className="text-xs text-slate-400 max-w-xl">
                    {selectedPromoVideo?.description || promoVideos[0]?.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setShowPromoVideoModal(false);
                  window.scrollTo({ top: 500, behavior: 'smooth' });
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-xl transition flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shop Featured Products Now</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Selective Customer Popup Modal */}
      {showSelectivePopupModal && selectivePopupConfig?.enabled && selectivePopupConfig?.items && selectivePopupConfig.items.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-300 dark:border-amber-700/60 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Banner */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                    {selectivePopupConfig.popupTitle || "🔥 Today's Special Deals & Featured Highlights!"}
                  </h3>
                  <p className="text-[11px] text-amber-100/90 font-medium">
                    {selectivePopupConfig.popupSubtitle || "Handpicked health & cosmetic offers chosen for you"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSelectivePopupModal(false)}
                className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-amber-100 hover:text-white transition cursor-pointer shrink-0"
                title="Close Deal Window"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Popup Item Display Content */}
            {(() => {
              const currentItem = selectivePopupConfig.items[selectedPopupIndex] || selectivePopupConfig.items[0];
              if (!currentItem) return null;

              // Find associated medicine in catalog if linked
              const linkedMed = catalogItems.find(m => m.id === currentItem.medicineId || currentItem.medicine?.id === m.id) || currentItem.medicine;
              const displayPrice = currentItem.price ?? linkedMed?.price ?? 0;
              const origPrice = currentItem.originalPrice ?? (linkedMed?.price ? Math.round(linkedMed.price * 1.25) : undefined);
              const isAvailable = currentItem.inStock !== false && (linkedMed ? (linkedMed.inStock !== false && (linkedMed.availableQuantity ?? 1) > 0) : true);

              const handleAddPopupItemToCart = () => {
                let medToCart: Medicine = linkedMed ? { ...linkedMed } : {
                  id: currentItem.id,
                  name: currentItem.title,
                  price: displayPrice,
                  category: currentItem.subtitle || 'Special Deal',
                  inStock: true,
                  availableQuantity: 99,
                  imageUrl: currentItem.imageUrl,
                  description: currentItem.description
                };

                // Override price with custom popup promo price if specified
                if (currentItem.price !== undefined) {
                  medToCart.price = currentItem.price;
                }

                addToCart(medToCart);
                setPopupToastMsg(`"${currentItem.title}" added to your cart!`);
                setTimeout(() => setPopupToastMsg(null), 3000);
              };

              return (
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
                  
                  {/* Toast notification inside popup */}
                  {popupToastMsg && (
                    <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {popupToastMsg}
                      </span>
                      <button 
                        onClick={() => {
                          setShowSelectivePopupModal(false);
                          setShowCartDrawer(true);
                        }}
                        className="underline text-amber-200 hover:text-white text-[11px] font-extrabold cursor-pointer"
                      >
                        View Cart & Checkout &rarr;
                      </button>
                    </div>
                  )}

                  {/* Top Item Header & Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {currentItem.badge && (
                      <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-full text-xs font-black flex items-center gap-1 shadow-xs">
                        <Tag className="w-3.5 h-3.5 text-amber-600" /> {currentItem.badge}
                      </span>
                    )}

                    {selectivePopupConfig.items.length > 1 && (
                      <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        Special Offer {selectedPopupIndex + 1} of {selectivePopupConfig.items.length}
                      </span>
                    )}
                  </div>

                  {/* Main Product Card Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60">
                    
                    {/* Image / Thumbnail Container */}
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-inner group">
                      {currentItem.imageUrl || linkedMed?.imageUrl ? (
                        <img 
                          src={currentItem.imageUrl || linkedMed?.imageUrl} 
                          alt={currentItem.title}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="p-6 text-center space-y-2">
                          <Store className="w-12 h-12 text-amber-500 mx-auto" />
                          <span className="text-xs text-slate-400 font-extrabold block">Certified Quality Product</span>
                        </div>
                      )}

                      {/* Discount percentage tag overlay */}
                      {origPrice && displayPrice && origPrice > displayPrice && (
                        <div className="absolute top-2 left-2 bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md border border-rose-400/50">
                          -{Math.round((1 - displayPrice / origPrice) * 100)}% OFF
                        </div>
                      )}
                    </div>

                    {/* Product Details & Call to Action */}
                    <div className="space-y-3.5">
                      <div>
                        {currentItem.subtitle && (
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block">
                            {currentItem.subtitle}
                          </span>
                        )}
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                          {currentItem.title}
                        </h2>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                        {currentItem.description || linkedMed?.description || 'Exclusive promotional deal curated for our online pharmacy & beauty customers.'}
                      </p>

                      {/* Pricing Block */}
                      <div className="flex items-baseline gap-2.5 pt-1">
                        <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          ETB {displayPrice}
                        </span>
                        {origPrice && origPrice > displayPrice && (
                          <span className="text-sm font-bold text-slate-400 line-through">
                            ETB {origPrice}
                          </span>
                        )}
                      </div>

                      {/* Stock Status Badge */}
                      <div className="text-[11px] font-bold">
                        {isAvailable ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> In Stock & Ready for Express Delivery
                          </span>
                        ) : (
                          <span className="text-rose-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Currently Out of Stock
                          </span>
                        )}
                      </div>

                      {/* Add to Cart CTA Button */}
                      <button
                        type="button"
                        disabled={!isAvailable}
                        onClick={handleAddPopupItemToCart}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-amber-300/40 transform active:scale-95"
                      >
                        <ShoppingBag className="w-4 h-4 fill-white" />
                        <span>{currentItem.ctaText || 'Add Special Deal to Cart'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Carousel Pagination Controls if multiple items */}
                  {selectivePopupConfig.items.length > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPopupIndex(prev => prev > 0 ? prev - 1 : selectivePopupConfig.items.length - 1)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Previous Offer
                      </button>

                      <div className="flex items-center gap-1.5">
                        {selectivePopupConfig.items.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedPopupIndex(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition cursor-pointer ${
                              selectedPopupIndex === idx ? 'bg-amber-500 w-5' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPopupIndex(prev => prev < selectivePopupConfig.items.length - 1 ? prev + 1 : 0)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        Next Offer <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span className="text-[11px] font-medium text-slate-400">
                ✨ Verified store promotion • Certified Ethiopian pharmacy inventory
              </span>
              <button
                type="button"
                onClick={() => setShowSelectivePopupModal(false)}
                className="px-4 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
              >
                Close & Continue Shopping
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Teleconsultation & AI Pharmacist Hub Modal */}
      {showConsultationHubModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2">
                    Pharmacy Clinical Consultation Hub
                    <span className="px-2 py-0.5 bg-emerald-500/30 border border-emerald-400/30 text-[10px] rounded-full uppercase tracking-wider font-bold">
                      Licensed
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Instant AI Pharmacist Guidance & Direct Live Teleconsultation with Pharmacists
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConsultationHubModal(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 p-1.5 gap-1">
              <button
                type="button"
                onClick={() => setConsultationTab('ai')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  consultationTab === 'ai'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Bot className="w-4 h-4 text-emerald-600" />
                <span>🤖 AI Pharmacist Assistant</span>
              </button>

              <button
                type="button"
                onClick={() => setConsultationTab('teleconsultation')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  consultationTab === 'teleconsultation'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Video className="w-4 h-4 text-purple-600" />
                <span>💬/📹 Licensed Pharmacist Call</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {consultationTab === 'ai' ? (
                /* AI Assistant Body */
                <div className="flex flex-col h-[480px]">
                  {/* Voice & Sound Control Header */}
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestSoundAndVoice}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        title="Click to test audio chime and clear AI voice synthesis"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>🔊 Test Audio & Voice</span>
                      </button>
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium hidden sm:inline">
                        Clear sound & voice enabled
                      </span>
                    </div>

                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoSpeakAi}
                        onChange={(e) => setAutoSpeakAi(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span>Auto-Read Answers (Voice)</span>
                    </label>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[11px]">
                    <span className="text-slate-400 font-bold shrink-0">Popular Inquiries:</span>
                    {[
                      "📦 I need 3 boxes of Paracetamol",
                      "🛒 2 Paracetamol and 1 Omeprazole",
                      "💊 Amoxicillin: Dosage, food timing & interactions",
                      "🩺 Omeprazole: Uses, administration & precautions",
                      "🧴 Sunscreen SPF 50+ and skincare routine",
                      "💆 Leave-In Conditioner & Hair Growth Oil routine"
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendAiMessage(chip)}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 rounded-lg shrink-0 font-medium border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Chat Thread */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 my-2">
                    {aiMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold">
                          <span>{msg.sender === 'user' ? 'You' : 'Sonan Pharmacy AI'}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                          {msg.sender === 'ai' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (speakingMsgIndex === index) {
                                  stopVoiceSpeech();
                                  setSpeakingMsgIndex(null);
                                } else {
                                  stopVoiceSpeech();
                                  speakTextWithVoice(msg.text);
                                  setSpeakingMsgIndex(index);
                                }
                              }}
                              className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                              title={speakingMsgIndex === index ? "Stop voice audio" : "Listen / Read aloud"}
                            >
                              {speakingMsgIndex === index ? (
                                <>
                                  <VolumeX className="w-3 h-3 text-red-500 animate-pulse" />
                                  <span className="text-[9px] text-red-500 font-semibold">Stop Voice</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">🔊 Listen Audio</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className={`p-3.5 rounded-2xl max-w-[92%] text-xs leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-emerald-600 text-white rounded-br-none'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                        }`}>
                          {msg.sender === 'user' ? (
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          ) : (
                            <div className="markdown-body space-y-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:text-emerald-700 dark:[&_h3]:text-emerald-400 [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:font-bold [&_table]:w-full [&_table]:my-2 [&_table]:border-collapse [&_table]:border [&_table]:border-slate-300 dark:[&_table]:border-slate-700 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-900 [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-slate-700 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-bold [&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-slate-700 [&_td]:px-2.5 [&_td]:py-1.5">
                              <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                            </div>
                          )}

                          {/* Suggested In-Stock Products in Sonan Pharmacy */}
                          {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <Pill className="w-3.5 h-3.5" /> Recommended In-Stock Products:
                                </span>
                                {msg.totalPrice !== undefined && (
                                  <span className="text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                    Total: {msg.totalPrice.toLocaleString()} ETB
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {msg.suggestedProducts.map((p, pIdx) => {
                                  // Find in catalogItems state if available
                                  const catalogMed = catalogItems.find(m => m.id === p.id || m.name.toLowerCase() === p.name.toLowerCase()) || {
                                    id: p.id || `sug-${pIdx}`,
                                    name: p.name,
                                    genericName: p.genericName || '',
                                    category: p.category || 'General',
                                    subCategory: p.subCategory || '',
                                    price: p.price || 0,
                                    buyingPrice: p.price ? p.price * 0.7 : 0,
                                    isPrescriptionRequired: p.rx === 'Prescription Required',
                                    productType: p.type || 'medicine',
                                    stock: p.stock ?? 10
                                  } as Medicine;

                                  return (
                                    <div 
                                      key={pIdx}
                                      className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-1.5"
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-1">
                                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs line-clamp-1">
                                            {p.name}
                                          </span>
                                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                                            {p.price} ETB
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 block line-clamp-1">
                                          {p.category} {p.subCategory ? `• ${p.subCategory}` : ''}
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => addToCart(catalogMed)}
                                        className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Add to Cart</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {msg.suggestTeleconsultation && (
                            <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col gap-2 text-amber-900 dark:text-amber-200">
                              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                <span>Need Direct Licensed Pharmacist Advice?</span>
                              </div>
                              <p className="text-[11px]">
                                You can connect directly with our on-duty licensed pharmacist via Live Chat or Video Call right now.
                              </p>
                              <button
                                type="button"
                                onClick={() => setConsultationTab('teleconsultation')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm w-fit cursor-pointer"
                              >
                                📹 Connect with Licensed Pharmacist
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isAiThinking && (
                      <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-2xl w-fit border border-slate-200 dark:border-slate-700">
                        <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
                        <span className="text-xs text-slate-500 font-medium">Sonan Pharmacy AI is reviewing clinical data and inventory...</span>
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={aiInputText}
                      onChange={e => setAiInputText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSendAiMessage();
                      }}
                      placeholder="Ask about medicine usage, side effects, hair care..."
                      className="flex-1 text-xs px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendAiMessage()}
                      disabled={!aiInputText.trim() || isAiThinking}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                </div>
              ) : (
                /* Teleconsultation Form / Active Call */
                <div>
                  {!activeTeleSession ? (
                    <form onSubmit={handleRequestTeleconsultation} className="space-y-4">
                      <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs flex items-start gap-2.5">
                        <Stethoscope className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <p>Speak directly with a licensed pharmacist at {institution.name} regarding usage, dosage, side effects, or drug interactions.</p>
                          <p className="mt-1 font-bold flex items-center gap-1.5">
                            <span>Direct Pharmacy Hotline:</span>
                            <a 
                              href={`tel:${institution.phone}`} 
                              className="underline text-purple-800 dark:text-purple-300 hover:text-purple-950 font-extrabold flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 inline" /> {institution.phone}
                            </a>
                          </p>
                        </div>
                      </div>

                      {/* Consultation Type Toggle */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Consultation Option:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setTeleType('chat')}
                            className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                              teleType === 'chat'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <MessageSquare className="w-4 h-4" /> Live Pharmacist Chat
                          </button>

                          <button
                            type="button"
                            onClick={() => setTeleType('video')}
                            className={`p-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                              teleType === 'video'
                                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            <Video className="w-4 h-4" /> Live Video Call
                          </button>
                        </div>
                      </div>

                      {/* Topic Selector */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Consultation Topic:
                        </label>
                        <select
                          value={teleTopic}
                          onChange={(e: any) => setTeleTopic(e.target.value)}
                          className="w-full text-xs p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-semibold"
                        >
                          <option value="Usage & Dosage">Usage & Precise Dosage</option>
                          <option value="Side Effects">Side Effects & Adverse Reactions</option>
                          <option value="Drug Interactions">Drug Interactions & Safety</option>
                          <option value="Prescription Inquiry">Prescription / Doctor Note Inquiry</option>
                          <option value="Chronic Care">Chronic Disease Medication Management</option>
                          <option value="General Consultation">General Medicine or Cosmetics Guidance</option>
                        </select>
                      </div>

                      {/* Name & Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Your Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={teleCustName}
                            onChange={e => setTeleCustName(e.target.value)}
                            placeholder="e.g. Almaz Bekele"
                            className="w-full text-xs p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Phone Number *
                          </label>
                          <input
                            type="text"
                            required
                            value={teleCustPhone}
                            onChange={e => setTeleCustPhone(e.target.value)}
                            placeholder="e.g. +251-911-223344"
                            className="w-full text-xs p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      {/* Initial Question */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Question or Medication Details:
                        </label>
                        <textarea
                          rows={3}
                          value={teleInitialMessage}
                          onChange={e => setTeleInitialMessage(e.target.value)}
                          placeholder="Describe your medication question, side effect concerns, or prescription details..."
                          className="w-full text-xs p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isRequestingTele}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>{isRequestingTele ? 'Requesting Connection...' : `Connect ${teleType === 'video' ? 'Live Video Call' : 'Live Chat'} with Pharmacist`}</span>
                      </button>
                    </form>
                  ) : (
                    /* Active Customer Teleconsultation View */
                    <div className="flex flex-col h-[460px]">
                      {/* Active Session Status Bar & Mode Switcher */}
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{activeTeleSession.status === 'active' ? '🟢 CONNECTED' : '⏳ IN QUEUE'}</span>
                          <span>•</span>
                          <span>Pharmacist: {activeTeleSession.pharmacistName || 'Awaiting Pharmacist...'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeTeleSession.type === 'chat' ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/teleconsultations/${activeTeleSession.id}/type`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ type: 'video', requesterName: activeTeleSession.customerName, requesterRole: 'customer' })
                                });
                                setCustVideoActive(true);
                              }}
                              className="text-[10px] px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Video className="w-3 h-3 text-purple-600" /> Start Video
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                await fetch(`/api/teleconsultations/${activeTeleSession.id}/type`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ type: 'chat', requesterName: activeTeleSession.customerName, requesterRole: 'customer' })
                                });
                                setCustVideoActive(false);
                              }}
                              className="text-[10px] px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3 text-blue-600" /> Chat Only
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveTeleSession(null)}
                            className="text-[10px] text-slate-500 underline font-bold hover:text-slate-800 ml-1"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      {/* Customer Two-Way Video Call View */}
                      {activeTeleSession.type === 'video' && custVideoActive && (
                        <div className="bg-slate-950 rounded-2xl p-3 text-white mb-3 relative flex flex-col min-h-60 border border-slate-800">
                          {/* Layout Bar */}
                          <div className="flex items-center justify-between text-[11px] mb-2 text-slate-400 flex-wrap gap-1.5">
                            <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                              <span>LIVE PHARMACIST VIDEO CALL</span>
                              {custVirtualCamera ? (
                                <span className="bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-sky-500/30">
                                  Virtual HD
                                </span>
                              ) : (
                                <span className="bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-emerald-500/30">
                                  Webcam Live
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCustVirtualCamera(prev => !prev)}
                                className="text-[10px] text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded cursor-pointer border border-slate-700"
                                title="Toggle Physical Webcam / Virtual HD Camera"
                              >
                                <Sparkles className="w-2.5 h-2.5 inline mr-1 text-purple-400" />
                                {custVirtualCamera ? 'Use Webcam' : 'Use Virtual Cam'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (custRtcManagerRef.current) {
                                    custRtcManagerRef.current.createAndSendOffer(true);
                                  }
                                }}
                                className="text-[10px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                                title="Re-sync connection"
                              >
                                <RefreshCw className="w-2.5 h-2.5 inline" /> Re-sync
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustVideoLayout(prev => prev === 'pip' ? 'split' : 'pip')}
                                className="text-[10px] text-slate-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded cursor-pointer"
                              >
                                {custVideoLayout === 'pip' ? 'Side-by-Side' : 'Picture-in-Picture'}
                              </button>
                            </div>
                          </div>

                          {custMediaNotice && (
                            <div className="mb-2 p-1.5 bg-sky-950/80 border border-sky-800 text-sky-200 rounded-lg text-[10px] flex items-center justify-between">
                              <span className="truncate mr-1">{custMediaNotice}</span>
                              <button
                                type="button"
                                onClick={() => setCustVirtualCamera(false)}
                                className="px-1.5 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[9px] font-bold shrink-0 cursor-pointer"
                              >
                                Retry Webcam
                              </button>
                            </div>
                          )}

                          {/* Video Stage */}
                          <div className={`relative flex-1 rounded-xl overflow-hidden min-h-44 ${custVideoLayout === 'split' ? 'grid grid-cols-2 gap-2' : ''}`}>
                            {/* 1. Pharmacist Feed (Remote) */}
                            <div className="bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center h-full">
                              {/* Remote Audio element */}
                              <audio ref={custRemoteAudioRef} autoPlay playsInline className="absolute w-0 h-0 opacity-0 pointer-events-none -z-50" />

                              {/* Remote direct WebRTC video */}
                              <video
                                ref={custRemoteVideoRef}
                                autoPlay
                                playsInline
                                className={`w-full h-full object-cover ${hasCustRemoteVideoTrack ? 'block' : 'hidden'}`}
                              />

                              {/* Frame synchronization fallback */}
                              {!hasCustRemoteVideoTrack && custRemoteFrameUrl && (
                                <img
                                  src={custRemoteFrameUrl}
                                  alt="Pharmacist Live Feed"
                                  className="w-full h-full object-cover"
                                />
                              )}

                              {/* Fallback placeholder */}
                              {!hasCustRemoteVideoTrack && !custRemoteFrameUrl && (
                                <div className="text-center p-3">
                                  <div className="w-12 h-12 rounded-full bg-purple-600/30 text-purple-300 font-bold text-lg mx-auto flex items-center justify-center border border-purple-500/40 mb-1.5">
                                    👨‍⚕️
                                  </div>
                                  <h5 className="font-bold text-xs text-white">{activeTeleSession.pharmacistName || `${institution.name} Pharmacist`}</h5>
                                  <p className="text-[10px] text-purple-400">Connecting Pharmacist Voice &amp; Video...</p>
                                </div>
                              )}

                              <div className="absolute top-2 left-2 bg-slate-900/85 px-2 py-0.5 rounded text-[9px] text-purple-300 font-bold border border-purple-500/30">
                                🛡️ Pharmacist: {activeTeleSession.pharmacistName || `${institution.name} Pharmacist`}
                              </div>

                              {/* Pharmacist Voice Volume Bar */}
                              <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] text-slate-300 flex items-center gap-1.5 border border-slate-700">
                                <Volume2 className={`w-3 h-3 ${custRemoteAudioLevel > 10 ? 'text-purple-400 animate-pulse' : 'text-slate-400'}`} />
                                <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-purple-400 transition-all duration-75"
                                    style={{ width: `${Math.min(100, custRemoteAudioLevel * 1.5)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* 2. Customer Local Webcam Feed */}
                            <div className={`bg-slate-900 rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center ${
                              custVideoLayout === 'pip'
                                ? 'absolute bottom-2 right-2 w-32 h-24 z-20 shadow-xl border-2 border-emerald-500'
                                : 'h-full'
                            }`}>
                              <video
                                ref={custLocalVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${custVideoMuted ? 'hidden' : 'block'}`}
                              />
                              {custVideoMuted && (
                                <div className="text-center p-2">
                                  <VideoOff className="w-6 h-6 text-slate-500 mx-auto mb-0.5" />
                                  <p className="text-[9px] text-slate-400">Camera Off</p>
                                </div>
                              )}
                              <div className="absolute top-1 left-1 bg-slate-900/80 px-1.5 py-0.5 rounded text-[8px] text-emerald-300 font-bold">
                                You
                              </div>

                              {/* Customer Local Mic Meter */}
                              <div className="absolute bottom-1 left-1 bg-slate-900/80 px-1 py-0.5 rounded text-[8px] flex items-center gap-1">
                                <Mic className={`w-2.5 h-2.5 ${custAudioMuted ? 'text-red-400' : custLocalAudioLevel > 10 ? 'text-emerald-400' : 'text-slate-400'}`} />
                                <div className="w-6 h-0.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-400"
                                    style={{ width: `${custAudioMuted ? 0 : Math.min(100, custLocalAudioLevel * 1.5)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Customer Controls */}
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCustVideoMuted(!custVideoMuted);
                                if (custRtcManagerRef.current) {
                                  custRtcManagerRef.current.sendPeerStatus(custVideoMuted, !custAudioMuted);
                                }
                              }}
                              className={`p-1.5 rounded-full text-xs cursor-pointer ${
                                custVideoMuted ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                              }`}
                              title={custVideoMuted ? 'Turn on camera' : 'Turn off camera'}
                            >
                              {custVideoMuted ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustAudioMuted(!custAudioMuted);
                                if (custRtcManagerRef.current) {
                                  custRtcManagerRef.current.sendPeerStatus(!custVideoMuted, custAudioMuted);
                                }
                              }}
                              className={`p-1.5 rounded-full text-xs cursor-pointer ${
                                custAudioMuted ? 'bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                              }`}
                              title={custAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                            >
                              {custAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Messages List */}
                      <div className="flex-1 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                        {activeTeleSession.messages.map((msg) => {
                          const isUser = msg.sender === 'customer';
                          const isSys = msg.sender === 'system';

                          if (isSys) {
                            return (
                              <div key={msg.id} className="text-center my-1">
                                <span className="px-2.5 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-medium inline-block">
                                  {msg.text}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mb-0.5">
                                <span>{msg.senderName}</span>
                                <span>•</span>
                                <span>{msg.timestamp}</span>
                              </div>

                              <div className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-sm ${
                                isUser
                                  ? 'bg-emerald-600 text-white rounded-br-none'
                                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                              }`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                {msg.medicationMentioned && (
                                  <div className="mt-1.5 p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 rounded text-[11px] font-bold">
                                    💊 Pharmacist Recommended: {msg.medicationMentioned}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Customer Message Input */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={teleMsgText}
                          onChange={e => setTeleMsgText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSendTeleMessage();
                          }}
                          placeholder="Type your message to the licensed pharmacist..."
                          className="flex-1 text-xs px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleSendTeleMessage}
                          disabled={!teleMsgText.trim()}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {institution.logoUrl && (
              <img src={institution.logoUrl} alt={institution.name} className="w-6 h-6 object-contain rounded bg-white p-0.5 border border-slate-200 dark:border-slate-700" referrerPolicy="no-referrer" />
            )}
            <p>© {new Date().getFullYear()} {institution.name}. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center space-x-4">
            {institution.address && (
              <>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-emerald-600" /> {institution.address}</span>
                <span>•</span>
              </>
            )}
            {institution.phone && (
              <>
                <a href={`tel:${institution.phone}`} className="flex items-center gap-1 hover:text-emerald-600 transition">
                  <Phone className="w-3 h-3 text-emerald-600" /> {institution.phone}
                </a>
                <span>•</span>
              </>
            )}
            {institution.email && (
              <>
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(institution.email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 underline transition cursor-pointer"
                >
                  <Mail className="w-3 h-3 text-emerald-600" /> {institution.email}
                </a>
                <span>•</span>
              </>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              Software by Sonan
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
