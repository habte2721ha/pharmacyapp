import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, X, Send, 
  RefreshCw, CheckCircle, AlertTriangle, ArrowRight, CornerDownLeft, 
  Trash2, ShieldCheck, ShoppingCart, Package, DollarSign, ArrowRightLeft,
  ChevronDown, Globe, Maximize2, Minimize2, Check, Copy, Info, AlertCircle, Play
} from 'lucide-react';
import { voiceEngine, VoiceLanguage } from '../../services/voiceAssistantEngine.ts';
import { Medicine, StockItem, Branch, UserRole } from '../../types.ts';

export interface VoiceMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  displayText?: string;
  time: string;
  language: VoiceLanguage;
  action?: string;
  data?: any;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  pendingActionPayload?: any;
  isSpoken?: boolean;
}

interface FloatingVoiceAssistantProps {
  currentUser: any;
  currentBranch?: Branch;
  activeTab: string;
  onNavigate: (tab: string) => void;
  // POS synchronization callbacks
  posCart?: Array<{
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitPrice: number;
    batchId?: string;
    batchNumber?: string;
  }>;
  onUpdatePosCart?: (newCart: any[]) => void;
  onPosCompleteSale?: (saleRecord: any) => void;
  onRefreshData?: () => void;
  // Optional customer mode
  initialMode?: 'staff' | 'customer';
}

export default function FloatingVoiceAssistant({
  currentUser,
  currentBranch,
  activeTab,
  onNavigate,
  posCart = [],
  onUpdatePosCart,
  onPosCompleteSale,
  onRefreshData,
  initialMode
}: FloatingVoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'staff' | 'customer'>(() => {
    if (initialMode) return initialMode;
    return currentUser?.role === 'customer' ? 'customer' : 'staff';
  });
  const [language, setLanguage] = useState<VoiceLanguage>('en');
  const [isMuted, setIsMuted] = useState(false);
  
  // Voice engine states
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeConfirmation, setActiveConfirmation] = useState<any | null>(null);

  const [messages, setMessages] = useState<VoiceMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: language === 'am' 
        ? 'እንኳን ወደ ሶናን ፋርማሲ AI የድምፅ ረዳት በደህና መጡ! ማይክሮፎኑን ተጭነው ይናገሩ ወይም ከታች ይፃፉ።'
        : (language === 'om' 
          ? 'Baga nagaan gara gargaaraa sagalee AI Faarmaasii Sonaan dhuftan! Maaykirofoonii cuqaasuun haasa\'aa yookiin barreessaa.'
          : 'Welcome to Sonan Pharmacy AI Voice Assistant! Click the microphone to speak or type your command below.'),
      displayText: language === 'am'
        ? '👋 **እንኳን ወደ ሶናን ፋርማሲ AI የድምፅ ረዳት በደህና መጡ!**\nመድኃኒቶችን መፈለግ፣ የሽያጭ ትዕዛዝ ማስተዳደር፣ የክምችት እና የፋይናንስ ሪፖርቶችን በድምፅ መጠየቅ ይችላሉ።'
        : (language === 'om'
          ? '👋 **Baga nagaan gara AI Copilot Faarmaasii Sonaan dhuftan!**\nQoricha barbaaduu, gurgurtaa POS to\'achuu, fi gabaasa kuusaa sagaleedhaan gaafachuu dandeessu.'
          : '👋 **Welcome to Sonan Pharmacy AI Copilot!**\nYou can search products, control POS sales, check real-time stock, and review daily sales and profit using natural voice.'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: 'en'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync engine configuration
  useEffect(() => {
    voiceEngine.setConfig({
      language,
      isMuted,
      onListeningChange: (listening) => {
        setIsListening(listening);
        if (!listening) {
          setInterimTranscript('');
        }
      },
      onTranscriptChange: (interim, final) => {
        setInterimTranscript(interim);
        if (final && final.trim()) {
          handleSendCommand(final.trim());
        }
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
      onError: (err) => {
        setErrorMessage(err);
        setIsListening(false);
        setTimeout(() => setErrorMessage(null), 5000);
      }
    });
  }, [language, isMuted]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isProcessing]);

  // Toggle listening
  const toggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      voiceEngine.stopListening();
    } else {
      voiceEngine.startListening();
    }
  };

  // Process text or voice input
  const handleSendCommand = async (queryText: string) => {
    if (!queryText || isProcessing) return;
    voiceEngine.stopListening();
    setTextInput('');
    setInterimTranscript('');
    setIsProcessing(true);
    setErrorMessage(null);

    const userMsg: VoiceMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: queryText,
      displayText: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const payload: any = {
        text: queryText,
        language,
        mode,
        userRole: currentUser?.role || 'cashier',
        userId: currentUser?.id || 'guest',
        userName: currentUser?.name || 'User',
        branchId: currentBranch?.id || 'b1',
        activeTab,
        currentCart: posCart,
        pendingAction: activeConfirmation
      };

      const res = await fetch('/api/voice-assistant/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const result = await res.json();

      // Handle confirmations
      if (result.requiresConfirmation && result.pendingActionPayload) {
        setActiveConfirmation(result.pendingActionPayload);
      } else {
        setActiveConfirmation(null);
      }

      // Handle POS Cart mutations
      if (result.updatedCart !== undefined && onUpdatePosCart) {
        onUpdatePosCart(result.updatedCart);
      }

      // Handle Sale Completion execution
      if (result.action === 'pos_execute_sale' && result.data?.sale && onPosCompleteSale) {
        onPosCompleteSale(result.data.sale);
        if (onRefreshData) onRefreshData();
      }

      // Handle Navigation
      if (result.action === 'navigate' && result.navTarget) {
        onNavigate(result.navTarget);
      }

      // Handle Stock transfers / changes refresh
      if (result.action === 'transfer_execute' && onRefreshData) {
        onRefreshData();
      }

      const aiMsg: VoiceMessage = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: result.spokenText,
        displayText: result.displayText || result.spokenText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: result.language || language,
        action: result.action,
        data: result.data,
        requiresConfirmation: result.requiresConfirmation,
        confirmationPrompt: result.confirmationPrompt,
        pendingActionPayload: result.pendingActionPayload
      };

      setMessages(prev => [...prev, aiMsg]);

      // Speak response out loud
      if (!isMuted && result.spokenText) {
        voiceEngine.speak(result.spokenText, result.language || language);
      }
    } catch (err: any) {
      console.error('Voice Assistant Query failed:', err);
      const errorText = language === 'am' 
        ? 'ይቅርታ፣ ትዕዛዝዎን ለማስኬድ አልተቻለም። እባክዎ ደግመው ይሞክሩ።'
        : (language === 'om'
          ? 'Dhiifama, ajaja keessan adeemsisuun hin danda\'amne. Mee irra deebi\'aa yaalaa.'
          : 'Sorry, I encountered an error processing your request. Please try again.');

      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: errorText,
          displayText: `⚠️ ${errorText}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPending = (confirmed: boolean) => {
    if (!activeConfirmation) return;
    let confirmText = 'Yes, proceed and complete';
    if (confirmed) {
      if (language === 'am') confirmText = 'አዎ፣ ሽያጩን ጨርስ';
      else if (language === 'om') confirmText = 'Eeyyee, gurgurtaa xumuri';
      else confirmText = 'Yes, proceed and complete';
    } else {
      if (language === 'am') confirmText = 'አይ፣ ሰርዝ';
      else if (language === 'om') confirmText = 'Lakki, haqi';
      else confirmText = 'No, cancel operation';
    }
    handleSendCommand(confirmText);
  };

  const handleQuickPrompt = (prompt: string) => {
    handleSendCommand(prompt);
  };

  const handleReplayAudio = (text: string, lang: VoiceLanguage) => {
    voiceEngine.speak(text, lang);
  };

  // Quick suggestions based on role & mode
  const quickPrompts = mode === 'customer' ? [
    { 
      label: language === 'am' ? 'ፓናዶል አለዎት?' : (language === 'om' ? 'Panadool qabduu?' : 'Do you have Panadol?'), 
      prompt: language === 'am' ? 'ፓናዶል አለዎት?' : (language === 'om' ? 'Panadool qabduu?' : 'Do you have Panadol?') 
    },
    { 
      label: language === 'am' ? 'የራስ ምታት መድኃኒት' : (language === 'om' ? 'Qoricha bowwoo mataa' : 'Medicine for headache'), 
      prompt: language === 'am' ? 'የራስ ምታት መድኃኒት አለዎት?' : (language === 'om' ? 'Qoricha bowwoo mataa qabduu?' : 'Do you have medicine for headache?') 
    },
    { 
      label: language === 'am' ? 'የደረቅ ቆዳ ምርቶች' : (language === 'om' ? 'Qoricha gogaa goggogaa' : 'Products for dry skin'), 
      prompt: language === 'am' ? 'የደረቅ ቆዳ ምርቶች አሉ?' : (language === 'om' ? 'Qorichi gogaa goggogaa jiraa?' : 'What products do you have for dry skin?') 
    },
    { 
      label: language === 'am' ? 'የማድረስ አገልግሎት' : (language === 'om' ? 'Tajaajila geejjibaa (Delivery)' : 'Do you deliver?'), 
      prompt: language === 'am' ? 'መድኃኒት ወደ ቤት ታደርሳላችሁ?' : (language === 'om' ? 'Qoricha gara manaatti ni geessituu?' : 'Do you deliver medicines?') 
    }
  ] : [
    { 
      label: language === 'am' ? 'ፓናዶል አለ?' : (language === 'om' ? 'Panadool ni jiraa?' : 'Do you have Panadol?'), 
      prompt: language === 'am' ? 'ፓናዶል አለ?' : (language === 'om' ? 'Panadool ni jiraa?' : 'Do you have Panadol?') 
    },
    { 
      label: language === 'am' ? 'የዛሬ ሽያጭ እና ትርፍ' : (language === 'om' ? 'Gurgurtaa fi bu\'aa har\'aa' : "Today's sales & profit"), 
      prompt: language === 'am' ? 'የዛሬ ሽያጭ እና ትርፍ ስንት ነው?' : (language === 'om' ? 'Gurgurtaan fi bu\'aan har\'aa meeqa?' : "What are today's sales and profit?") 
    },
    { 
      label: language === 'am' ? 'ዝቅተኛ ክምችት መድኃኒቶች' : (language === 'om' ? 'Qoricha kuusaan xiqqaate' : 'Show low stock'), 
      prompt: language === 'am' ? 'ዝቅተኛ ክምችት ያላቸውን መድኃኒቶች አሳየኝ' : (language === 'om' ? 'Qorichoota kuusaan isaanii xiqqaate natti agarsiisi' : 'Show low-stock medicines') 
    },
    { 
      label: language === 'am' ? '2 ፓናዶል ወደ ሽያጭ ጨምር' : (language === 'om' ? 'Panadool lama dabali' : 'Add 2 Panadol to sale'), 
      prompt: language === 'am' ? 'ሁለት ፓናዶል ወደ ሽያጭ ጨምር' : (language === 'om' ? 'Panadool lama gara gurgurtaatti dabali' : 'Add two Panadol to the sale') 
    },
    { 
      label: language === 'am' ? 'የሽያጭ ድምር ስንት ነው?' : (language === 'om' ? 'Ida\'amni gatii meeqa?' : 'Show the total'), 
      prompt: language === 'am' ? 'የሽያጭ ድምር ስንት ነው?' : (language === 'om' ? 'Ida\'amni gatii meeqa?' : 'Show the total') 
    },
    { 
      label: language === 'am' ? 'ሽያጩን ጨርስ' : (language === 'om' ? 'Gurgurtaa xumuri' : 'Complete the sale'), 
      prompt: language === 'am' ? 'ሽያጩን ጨርስ' : (language === 'om' ? 'Gurgurtaa xumuri' : 'Complete the sale') 
    },
    { 
      label: language === 'am' ? 'በቅርቡ የሚያልቁ መድኃኒቶች' : (language === 'om' ? 'Qoricha yeroon darbuuf jedhu' : 'Which products expire soon?'), 
      prompt: language === 'am' ? 'በቅርቡ የሚያልቁ መድኃኒቶች የትኞቹ ናቸው?' : (language === 'om' ? 'Qorichoonni dhiyootti yeroon isaanii darbu kami?' : 'Which products expire soon?') 
    }
  ];

  return (
    <div id="sonan-floating-voice-assistant" className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
      
      {/* Expanded Voice Assistant Window */}
      {isOpen && (
        <div 
          className={`mb-4 w-[92vw] sm:w-[480px] ${
            isExpanded ? 'sm:w-[700px] h-[82vh]' : 'h-[580px]'
          } max-h-[85vh] bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-fadeIn backdrop-blur-xl`}
        >
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 dark:from-emerald-950 dark:to-teal-950 p-4 text-white flex items-center justify-between border-b border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 dark:bg-emerald-500/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base leading-tight tracking-tight text-white">
                    {mode === 'customer' ? 'Sonan Pharmacy Patient Assistant' : 'AI Pharmacy Voice Copilot'}
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-400/20 text-emerald-200 rounded-full border border-emerald-300/30">
                    Live DB
                  </span>
                </div>
                <p className="text-xs text-emerald-100/80 font-medium">
                  {currentBranch?.name || 'Sonan Pharmacy'} • {language === 'am' ? 'አማርኛ ድጋፍ' : (language === 'om' ? 'Afaan Oromoo' : 'English & Amharic')}
                </p>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1.5">
              {/* Language Switcher */}
              <button
                onClick={() => setLanguage(l => l === 'en' ? 'am' : (l === 'am' ? 'om' : 'en'))}
                title="Switch Language (English / አማርኛ / Afaan Oromoo)"
                className="px-2.5 py-1 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 border border-white/20"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-300" />
                <span>{language === 'en' ? 'EN' : (language === 'am' ? 'አማ' : 'ORO')}</span>
              </button>

              {/* Mute/Unmute Toggle */}
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (!isMuted) voiceEngine.stopSpeaking();
                }}
                title={isMuted ? 'Unmute Audio Responses' : 'Mute Audio Responses'}
                className={`p-2 rounded-xl transition-colors ${
                  isMuted 
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' 
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
              </button>

              {/* Expand / Minimize Window */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Standard Window' : 'Expand Window'}
                className="hidden sm:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  voiceEngine.stopListening();
                  voiceEngine.stopSpeaking();
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-500/40 text-white transition-colors border border-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mode Switcher Bar */}
          {currentUser?.role !== 'customer' && (
            <div className="bg-emerald-50 dark:bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Assistant Mode:
              </span>
              <div className="flex items-center gap-1 bg-gray-200/70 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setMode('staff')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'staff'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  👨‍⚕️ Staff Copilot
                </button>
                <button
                  onClick={() => setMode('customer')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'customer'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  🧑 Customer Helpdesk
                </button>
              </div>
            </div>
          )}

          {/* Voice State Visualizer & Live Waves Banner */}
          {(isListening || isSpeaking || interimTranscript) && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border-b border-emerald-500/20 px-4 py-2.5 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-3">
                {isListening && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <div className="flex items-center gap-0.5 h-4 ml-1">
                      <span className="w-1 bg-emerald-500 h-3 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 bg-emerald-500 h-4 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 bg-emerald-500 h-2 rounded-full animate-bounce [animation-delay:300ms]" />
                      <span className="w-1 bg-emerald-500 h-4 rounded-full animate-bounce [animation-delay:200ms]" />
                    </div>
                  </div>
                )}

                {isSpeaking && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <div className="flex items-center gap-0.5 h-4 ml-1">
                      <span className="w-1 bg-blue-500 h-4 rounded-full animate-bounce [animation-delay:50ms]" />
                      <span className="w-1 bg-blue-500 h-2 rounded-full animate-bounce [animation-delay:250ms]" />
                      <span className="w-1 bg-blue-500 h-3 rounded-full animate-bounce [animation-delay:100ms]" />
                    </div>
                  </div>
                )}

                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 truncate max-w-[280px]">
                  {isListening 
                    ? (interimTranscript ? `"${interimTranscript}"` : (language === 'am' ? 'እየሰማሁ ነው... ይናገሩ' : (language === 'om' ? 'Dhaggeeffachaan jira... haasa\'aa' : 'Listening... speak clearly')))
                    : (isSpeaking ? (language === 'am' ? 'መልስ እየተነገረ ነው...' : (language === 'om' ? 'Deebiin dubbatamaa jira...' : 'Speaking response...')) : '')
                  }
                </span>
              </div>

              {/* Stop speaking control */}
              {isSpeaking && (
                <button
                  onClick={() => voiceEngine.stopSpeaking()}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors flex items-center gap-1 border border-red-300/40"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/40 px-4 py-2 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          {/* Conversation History Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} transition-all`}
              >
                {/* Sender Badge */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                  <span>{msg.sender === 'user' ? 'You' : 'Sonan AI Assistant'}</span>
                  <span>•</span>
                  <span>{msg.time}</span>
                  {msg.sender === 'assistant' && !isMuted && (
                    <button
                      onClick={() => handleReplayAudio(msg.text, msg.language)}
                      title="Replay Voice Response"
                      className="ml-1 text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Replay</span>
                    </button>
                  )}
                </div>

                {/* Message Bubble Card */}
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 shadow-sm text-sm ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/80 text-gray-800 dark:text-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* Markdown / Display Text formatting */}
                  <div className="whitespace-pre-line leading-relaxed space-y-1">
                    {msg.displayText || msg.text}
                  </div>

                  {/* Structured Product Results Display Card */}
                  {msg.action === 'product_detail' && msg.data?.medicine && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/80 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {msg.data.medicine.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {msg.data.price} ETB
                        </span>
                      </div>
                      
                      {currentUser?.role !== 'customer' && (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => handleSendCommand(`Add 1 ${msg.data.medicine.name} to the sale`)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Add 1 to POS</span>
                          </button>

                          <button
                            onClick={() => onNavigate('inventory')}
                            className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>View in Inventory</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Confirmation Box */}
                  {msg.requiresConfirmation && activeConfirmation && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-xl flex flex-col gap-2.5">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Action Confirmation Required</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConfirmPending(true)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <Check className="w-4 h-4" />
                          <span>{language === 'am' ? 'አዎ፣ ፈጽም' : (language === 'om' ? 'Eeyyee, Raawwadhu' : 'Yes, Confirm')}</span>
                        </button>
                        <button
                          onClick={() => handleConfirmPending(false)}
                          className="py-2 px-3 rounded-xl bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 text-gray-700 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          <span>{language === 'am' ? 'ሰርዝ' : (language === 'om' ? 'Haqi' : 'Cancel')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Processing Indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium py-1 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{language === 'am' ? 'ትዕዛዙ እየተሰራ ነው...' : (language === 'om' ? 'Ajajni adeemsifamaa jira...' : 'Processing voice command...')}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Voice Suggestions Carousel */}
          <div className="bg-gray-50 dark:bg-slate-950 px-3 py-2 border-t border-gray-100 dark:border-slate-800 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              {language === 'am' ? 'ፈጣን ትዕዛዝ:' : (language === 'om' ? 'Ajaja saffisaa:' : 'Try:')}
            </span>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(qp.prompt)}
                disabled={isProcessing}
                className="shrink-0 px-2.5 py-1 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700/80 transition-colors shadow-2xs"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Bottom Voice & Text Input Controls */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center gap-2">
            
            {/* Big Accessible Microphone Button */}
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              title={isListening ? 'Stop Listening' : 'Start Voice Listening'}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-400/40 scale-105'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-105 active:scale-95'
              }`}
            >
              {isListening ? (
                <MicOff className="w-6 h-6 animate-bounce" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>

            {/* Text Input Fallback Bar */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCommand(textInput);
              }}
              className="flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800/90 rounded-2xl px-3 py-1.5 border border-gray-200 dark:border-slate-700/80 focus-within:border-emerald-500 transition-colors"
            >
              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  language === 'am'
                    ? 'ትዕዛዝ ይፃፉ ወይም ማይኩን ይጫኑ...'
                    : (language === 'om' 
                      ? 'Ajaja barreessaa ykn maayikii cuqaasaa...'
                      : (mode === 'customer' ? 'Ask about medicines, prices, or advice...' : 'Search medicine, POS commands, sales total...'))
                }
                className="w-full bg-transparent text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!textInput.trim() || isProcessing}
                className="p-1.5 rounded-xl bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Clear History Button */}
            <button
              onClick={() => {
                setMessages([]);
                setActiveConfirmation(null);
              }}
              title="Clear Conversation"
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Floating Trigger Action Button (FAB) */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && !isListening) {
            // Optional: Start listening on click if preferred
          }
        }}
        id="btn-floating-voice-assistant"
        className={`relative group p-4 rounded-3xl transition-all duration-300 shadow-2xl flex items-center gap-3 border ${
          isOpen
            ? 'bg-slate-900 dark:bg-emerald-950 text-white border-emerald-500/40 ring-4 ring-emerald-500/20'
            : isListening
              ? 'bg-red-500 text-white border-red-400 animate-pulse ring-8 ring-red-400/30 scale-110'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/40 hover:scale-105 hover:shadow-emerald-500/25 ring-4 ring-emerald-500/10'
        }`}
      >
        <div className="relative">
          <Mic className={`w-6 h-6 ${isListening ? 'animate-bounce' : ''}`} />
          {/* Animated sound ripple dot */}
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-300 rounded-full animate-ping" />
        </div>

        {/* Text Label on Hover or in Mobile */}
        <span className="font-bold text-sm tracking-tight pr-1 hidden sm:inline">
          {isListening 
            ? (language === 'am' ? 'እየሰማሁ ነው...' : (language === 'om' ? 'Dhaggeeffachaan jira...' : 'Listening...')) 
            : (language === 'am' ? 'AI የድምፅ ረዳት' : (language === 'om' ? 'Gargaaraa Sagalee AI' : 'AI Voice Assistant'))
          }
        </span>

        {/* Language Badge */}
        <span className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-black/20 text-white border border-white/20 uppercase">
          {language === 'en' ? 'EN' : (language === 'am' ? 'አማ' : 'ORO')}
        </span>
      </button>

    </div>
  );
}
