import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, Play, 
  HelpCircle, CheckCircle, ArrowRight, CornerDownLeft, Command,
  Terminal, User, Compass, Globe, ShoppingCart, Package, DollarSign,
  ArrowRightLeft, ShieldCheck, RefreshCw, Send, Check, AlertTriangle,
  Info, Award, Zap, Cpu, Activity
} from 'lucide-react';
import { voiceEngine, VoiceLanguage } from '../services/voiceAssistantEngine.ts';
import { Branch, UserRole } from '../types.ts';

interface VoiceAssistancePanelProps {
  currentUser?: any;
  currentBranch?: Branch;
  onNavigate: (tab: string) => void;
  onToggleTheme: (theme: 'light' | 'dark') => void;
  onToggleMaximize: () => void;
  activeTheme: 'light' | 'dark';
  onRefreshData?: () => void;
}

interface CommandCategory {
  categoryName: string;
  categoryAmharic: string;
  categoryOromo: string;
  icon: any;
  color: string;
  items: {
    commandEn: string;
    commandAm: string;
    commandOm: string;
    descriptionEn: string;
    descriptionAm: string;
    descriptionOm: string;
    actionType: string;
  }[];
}

export default function VoiceAssistancePanel({
  currentUser,
  currentBranch,
  onNavigate,
  onToggleTheme,
  onToggleMaximize,
  activeTheme,
  onRefreshData
}: VoiceAssistancePanelProps) {
  const [language, setLanguage] = useState<VoiceLanguage>('en');
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'copilot' | 'catalog' | 'diagnostics'>('copilot');

  const [activeConfirmation, setActiveConfirmation] = useState<any | null>(null);

  const [history, setHistory] = useState<Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    displayText?: string;
    time: string;
    language: VoiceLanguage;
    action?: string;
    data?: any;
    requiresConfirmation?: boolean;
  }>>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'AI Voice Assistant Ready. Speak naturally in English or Amharic.',
      displayText: '👋 **Sonan Pharmacy AI Voice Copilot initialized.**\nPress the microphone or select any command below to test live speech recognition and natural language processing.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: 'en'
    }
  ]);

  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    voiceEngine.setConfig({
      language,
      isMuted,
      onListeningChange: (listening) => {
        setIsListening(listening);
        if (!listening) setInterimTranscript('');
      },
      onTranscriptChange: (interim, final) => {
        setInterimTranscript(interim);
        if (final && final.trim()) {
          handleExecuteCommand(final.trim());
        }
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
      onError: (err) => {
        setErrorMessage(err);
        setIsListening(false);
      }
    });
  }, [language, isMuted]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isProcessing]);

  const toggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      voiceEngine.stopListening();
    } else {
      voiceEngine.startListening();
    }
  };

  const handleExecuteCommand = async (queryText: string) => {
    if (!queryText.trim() || isProcessing) return;
    voiceEngine.stopListening();
    setTextInput('');
    setInterimTranscript('');
    setIsProcessing(true);
    setErrorMessage(null);

    const userMsg = {
      id: 'u_' + Date.now(),
      sender: 'user' as const,
      text: queryText,
      displayText: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language
    };
    setHistory(prev => [...prev, userMsg]);

    try {
      const payload: any = {
        text: queryText,
        language,
        mode: currentUser?.role === 'customer' ? 'customer' : 'staff',
        userRole: currentUser?.role || 'cashier',
        userId: currentUser?.id || 'admin',
        userName: currentUser?.name || 'Operator',
        branchId: currentBranch?.id || 'b1',
        pendingAction: activeConfirmation
      };

      const res = await fetch('/api/voice-assistant/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.requiresConfirmation && result.pendingActionPayload) {
        setActiveConfirmation(result.pendingActionPayload);
      } else {
        setActiveConfirmation(null);
      }

      if (result.action === 'navigate' && result.navTarget) {
        onNavigate(result.navTarget);
      }

      if (result.action === 'transfer_execute' && onRefreshData) {
        onRefreshData();
      }

      const aiMsg = {
        id: 'ai_' + Date.now(),
        sender: 'assistant' as const,
        text: result.spokenText,
        displayText: result.displayText || result.spokenText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: result.language || language,
        action: result.action,
        data: result.data,
        requiresConfirmation: result.requiresConfirmation
      };

      setHistory(prev => [...prev, aiMsg]);

      if (!isMuted && result.spokenText) {
        voiceEngine.speak(result.spokenText, result.language || language);
      }
    } catch (e: any) {
      console.error('Error executing voice command:', e);
      setHistory(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: 'Error processing command. Please try again.',
          displayText: '⚠️ **Error processing command.** Please check connection.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const commandCategories: CommandCategory[] = [
    {
      categoryName: 'Product & Drug Discovery',
      categoryAmharic: 'የመድኃኒት ፍለጋ እና መረጃ',
      categoryOromo: 'Barbaacha Qorichaa fi Odeeffannoo',
      icon: Package,
      color: 'from-blue-600 to-indigo-600',
      items: [
        {
          commandEn: 'Do you have Panadol?',
          commandAm: 'ፓናዶል አለ?',
          commandOm: 'Panadool qabduu?',
          descriptionEn: 'Instant availability, current retail price, and location batch lookup.',
          descriptionAm: 'የመድኃኒት ክምችት፣ ዋጋ እና መገኛ ማረጋገጫ።',
          descriptionOm: 'Argama qorichaa, gatii fi bakka kuusaa mirkaneessuu.',
          actionType: 'Stock & Price Lookup'
        },
        {
          commandEn: 'Search for Amoxicillin 500mg',
          commandAm: 'አሞክሲሲሊን 500 ሚሊ ግራም ፈልግ',
          commandOm: 'Amoksiisiiliin 500mg barbaadi',
          descriptionEn: 'Queries exact and generic chemical matches with dosage specs.',
          descriptionAm: 'የተለየ መጠን እና ኬሚካላዊ ይዘት ፍለጋ።',
          descriptionOm: 'Hamma fi qabiyyee qorichaa adda baasanii barbaaduu.',
          actionType: 'Dosage Search'
        },
        {
          commandEn: 'Show me Antibiotics / Cosmetics',
          commandAm: 'አንቲባዮቲክስ መድኃኒቶችን አሳየኝ',
          commandOm: 'Qorichoota Antibaayootiksii natti agarsiisi',
          descriptionEn: 'Lists all 14 official subcategories and medicine entries.',
          descriptionAm: 'ምድቦችን እና ንዑስ ምድቦችን በሙሉ መዘርዘር።',
          descriptionOm: 'Gareewwan qorichaa 14 hunda tarreessuu.',
          actionType: 'Category Filter'
        },
        {
          commandEn: 'Find products containing Paracetamol',
          commandAm: 'ፓራሲታሞል ያለባቸውን መድኃኒቶች ፈልግ',
          commandOm: 'Qoricha Paaraasitaamool qabu barbaadi',
          descriptionEn: 'Generics and active ingredient composition search.',
          descriptionAm: 'ተመሳሳይ ይዘት ያላቸው መድኃኒቶች ፍለጋ።',
          descriptionOm: 'Qorichoota qabiyyee walfakkaataa qaban barbaaduu.',
          actionType: 'Generic Matching'
        },
        {
          commandEn: 'How many boxes of Metformin in Main Pharmacy?',
          commandAm: 'በዋናው ቅርንጫፍ ስንት ሜትፎርሚን አለ?',
          commandOm: 'Damee guddaa keessa Meetfoormiin meeqatu jira?',
          descriptionEn: 'Branch-specific real-time stock balance query.',
          descriptionAm: 'የቅርንጫፍ ክምችት መጠን ጥያቄ።',
          descriptionOm: 'Hamma qoricha damee murtaa\'e keessa jiru beekuu.',
          actionType: 'Branch Stock'
        }
      ]
    },
    {
      categoryName: 'Point-of-Sale (POS) Commands',
      categoryAmharic: 'የሽያጭ መቆጣጠሪያ (POS) ትዕዛዞች',
      categoryOromo: 'Ajajoota Gurgurtaa (POS)',
      icon: ShoppingCart,
      color: 'from-emerald-600 to-teal-600',
      items: [
        {
          commandEn: 'Add 2 Panadol to the sale',
          commandAm: 'ሁለት ፓናዶል ወደ ሽያጭ ጨምር',
          commandOm: 'Panadool lama gara gurgurtaatti dabali',
          descriptionEn: 'Adds product directly into active POS register cart.',
          descriptionAm: 'እቃዎችን በቀጥታ ወደ ሽያጭ ቅርጫት ማስገባት።',
          descriptionOm: 'Qoricha kallattiin gara guurii gurgurtaatti dabaluu.',
          actionType: 'Cart Add'
        },
        {
          commandEn: 'Remove 1 item / Clear the cart',
          commandAm: 'የሽያጭ ቅርጫቱን አጽዳ',
          commandOm: 'Guurii gurgurtaa haqi',
          descriptionEn: 'Empties active POS cart or decrements item line.',
          descriptionAm: 'የተመረጡ እቃዎችን መሰረዝ ወይም ማጽዳት።',
          descriptionOm: 'Qoricha filatame guurii keessaa balleessuu.',
          actionType: 'Cart Mutation'
        },
        {
          commandEn: 'Show the total / What is the bill amount?',
          commandAm: 'የሽያጭ ድምር ስንት ነው?',
          commandOm: 'Ida\'amni gatii meeqa?',
          descriptionEn: 'Calculates subtotal, VAT, discounts, and payable total in ETB.',
          descriptionAm: 'የግብር እና አጠቃላይ የክፍያ ድምር ማሳወቅ።',
          descriptionOm: 'Ida\'ama gatii fi gibira waliigalaa herreguu.',
          actionType: 'Cart Calculation'
        },
        {
          commandEn: 'Apply 10 percent discount',
          commandAm: 'አስር ፐርሰንት ቅናሽ አድርግ',
          commandOm: 'Hir\'isa dhibbeentaa 10 godhi',
          descriptionEn: 'Applies promotional discounts with validation.',
          descriptionAm: 'የዋጋ ቅናሽ መተግበር።',
          descriptionOm: 'Gatii gurgurtaa irratti hir\'isa taasisuu.',
          actionType: 'Discount'
        },
        {
          commandEn: 'Complete the sale / Checkout in Cash',
          commandAm: 'ሽያጩን በጥሬ ገንዘብ ጨርስ',
          commandOm: 'Gurgurtaa maallaqa callaan xumuri',
          descriptionEn: 'Requires audible or click confirmation before transaction commit.',
          descriptionAm: 'ማረጋገጫ ከጠየቀ በኋላ ሽያጩን ማጠናቀቅ።',
          descriptionOm: 'Mirkaneeffannaa booda gurgurtaa xumuruu.',
          actionType: 'Protected Checkout'
        }
      ]
    },
    {
      categoryName: 'Inventory & Expiry Intelligence',
      categoryAmharic: 'የክምችት እና የአገልግሎት ዘመን ቁጥጥር',
      categoryOromo: 'Hordoffii Kuusaa fi Yeroo Darbiinsaa',
      icon: ShieldCheck,
      color: 'from-amber-600 to-orange-600',
      items: [
        {
          commandEn: 'Show low-stock medicines',
          commandAm: 'ዝቅተኛ ክምችት ያላቸውን መድኃኒቶች አሳየኝ',
          commandOm: 'Qorichoota kuusaan isaanii xiqqaate natti agarsiisi',
          descriptionEn: 'Surfaces items below reorder threshold with suppliers.',
          descriptionAm: 'የአደጋ ደረጃ ላይ ያሉ ክምችቶችን ማሳወቅ።',
          descriptionOm: 'Qorichoota dhumachaa jiran adda baasuu.',
          actionType: 'Reorder Alert'
        },
        {
          commandEn: 'Which products will expire in 30 days?',
          commandAm: 'በሚቀጥሉት ሰላሳ ቀናት ውስጥ የሚያልቁ መድኃኒቶች የትኞቹ ናቸው?',
          commandOm: 'Qorichoonni guyyoota 30 keessatti yeroon darbu kami?',
          descriptionEn: 'Scans batch expiry dates and flags urgent batches.',
          descriptionAm: 'የአገልግሎት ዘመናቸው ሊያበቃ የተቃረቡ መድኃኒቶች ዝርዝር።',
          descriptionOm: 'Qorichoota yeroon tajaajila isaanii dhumuuf dhiyaate beeksisuu.',
          actionType: 'Expiry Audit'
        },
        {
          commandEn: 'Transfer 10 Amoxicillin to Piassa Branch',
          commandAm: 'አስር አሞክሲሲሊን ወደ ፒያሳ ቅርንጫፍ አስተላልፍ',
          commandOm: 'Amoksiisiiliin 10 gara damee Piyaasaatti dabarsi',
          descriptionEn: 'Generates inter-branch transfer draft with confirmation gate.',
          descriptionAm: 'የቅርንጫፎች የክምችት ዝውውር መፍጠር።',
          descriptionOm: 'Qoricha damee tokko irraa gara kaaniitti dabarsuu.',
          actionType: 'Stock Transfer'
        }
      ]
    },
    {
      categoryName: 'Financial & Management Audits',
      categoryAmharic: 'የፋይናንስ እና የአስተዳደር ሪፖርቶች',
      categoryOromo: 'Gabaasa Faayinaansii fi Bulchiinsaa',
      icon: DollarSign,
      color: 'from-purple-600 to-indigo-700',
      items: [
        {
          commandEn: "What are today's sales and profit?",
          commandAm: 'የዛሬ ሽያጭ እና ትርፍ ስንት ነው?',
          commandOm: 'Gurgurtaan fi bu\'aan har\'aa meeqa?',
          descriptionEn: 'Real-time sales revenue, COGS, gross margin, and net profit.',
          descriptionAm: 'የዕለቱ ገቢ፣ ወጪ እና የተጣራ ትርፍ ማጠቃለያ።',
          descriptionOm: 'Gurgurtaa fi bu\'aa qulqulluu har\'aa beeksisuu.',
          actionType: 'Financial KPI'
        },
        {
          commandEn: 'Show top selling products this month',
          commandAm: 'በዚህ ወር በብዛት የተሸጡ መድኃኒቶችን አሳየኝ',
          commandOm: 'Qorichoota ji\'a kana baay\'inaan gurguraman natti agarsiisi',
          descriptionEn: 'Volume and revenue leaderboards.',
          descriptionAm: 'ከፍተኛ ሽያጭ የተመዘገበባቸው እቃዎች።',
          descriptionOm: 'Qorichoota sadarkaa duraa irratti gurguraman tarreessuu.',
          actionType: 'Analytics'
        },
        {
          commandEn: 'What are today expenses?',
          commandAm: 'የዛሬ ወጪዎች ስንት ናቸው?',
          commandOm: 'Baasiin har\'aa meeqa?',
          descriptionEn: 'Itemized operational overhead expenses.',
          descriptionAm: 'የተመዘገቡ የፋርማሲ ወጪዎች ዝርዝር።',
          descriptionOm: 'Baasii faarmaasii har\'aa tarreessuu.',
          actionType: 'Expense Tracking'
        }
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Background ambient decorative rings */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-32 -bottom-16 w-64 h-64 rounded-full bg-teal-400/10 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Natural Voice Assistant Engine
              </span>
              <span className="px-3 py-1 text-xs font-bold bg-white/10 text-white rounded-full border border-white/20">
                🇬🇧 English • 🇪🇹 አማርኛ • 🌳 Afaan Oromoo
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              AI Pharmacy Voice Command Center
            </h1>
            <p className="text-sm text-emerald-100/80 leading-relaxed">
              Control sales, search real-time stock balances, inspect expiry batches, check financial profits, and assist patients using hands-free natural voice interaction.
            </p>
          </div>

          {/* Quick Voice State Indicator and Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
            {/* Language Switch */}
            <button
              onClick={() => setLanguage(l => l === 'en' ? 'am' : (l === 'am' ? 'om' : 'en'))}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5 border border-white/20 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-emerald-300" />
              <span>
                {language === 'en' ? 'English (US)' : (language === 'am' ? 'አማርኛ (ኢትዮጵያ)' : 'Afaan Oromoo')}
              </span>
            </button>

            {/* Mute Toggle */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) voiceEngine.stopSpeaking();
              }}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isMuted 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
            </button>

            {/* Main Microphone Action */}
            <button
              onClick={toggleListening}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-400/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-105'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Stop Listening' : 'Start Speaking'}</span>
            </button>
          </div>
        </div>

        {/* Live Audio Status Strip */}
        {(isListening || isSpeaking || interimTranscript) && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs animate-fadeIn">
            <div className="flex items-center gap-3">
              {isListening && (
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  <span>Listening: {interimTranscript ? `"${interimTranscript}"` : 'Awaiting speech...'}</span>
                </div>
              )}
              {isSpeaking && (
                <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <span>Synthesizing voice response...</span>
                </div>
              )}
            </div>
            {isSpeaking && (
              <button
                onClick={() => voiceEngine.stopSpeaking()}
                className="px-2 py-1 rounded-lg bg-red-500/30 text-red-200 hover:bg-red-500/50 text-[11px] font-bold transition-colors"
              >
                Stop Audio
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'copilot'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Interactive Voice Sandbox</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Command className="w-4 h-4" />
          <span>Command Reference & Capabilities</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'diagnostics'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Voice & NLP Diagnostics</span>
        </button>
      </div>

      {/* TAB 1: INTERACTIVE VOICE SANDBOX */}
      {activeTab === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Interactive Chat Window */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col h-[560px] overflow-hidden">
            
            {/* Terminal Header */}
            <div className="p-4 bg-gray-50 dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-slate-300">
                  Voice Execution Feed & Confirmation Stream
                </span>
              </div>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                {history.length} events
              </span>
            </div>

            {/* Conversation Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 mb-1 px-1">
                    {msg.sender === 'user' ? 'Voice / Text Input' : 'Sonan AI Engine'} • {msg.time}
                  </span>
                  
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl shadow-xs text-sm ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-100 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-line leading-relaxed">
                      {msg.displayText || msg.text}
                    </div>

                    {/* Confirmation Dialog Box */}
                    {msg.requiresConfirmation && activeConfirmation && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Confirmation Gate Active</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleExecuteCommand(language === 'am' ? 'አዎ' : 'Yes, proceed')}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                          >
                            Confirm Action
                          </button>
                          <button
                            onClick={() => handleExecuteCommand(language === 'am' ? 'ሰርዝ' : 'Cancel')}
                            className="py-1.5 px-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-xs font-semibold hover:bg-gray-300 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold py-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing natural voice query...</span>
                </div>
              )}
              <div ref={historyEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex items-center gap-2">
              <button
                onClick={toggleListening}
                disabled={isProcessing}
                className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-400/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecuteCommand(textInput);
                }}
                className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-2xl px-3 py-2 border border-gray-200 dark:border-slate-700"
              >
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type a voice command (e.g., 'Do you have Panadol?' or 'የዛሬ ሽያጭ ስንት ነው?')"
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing}
                  className="p-1.5 rounded-xl bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

          {/* Quick Simulation Clickable Cards */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span>Simulate Common Voice Prompts</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                Click any of the pre-tested natural language phrases to execute immediate NLP intent extraction.
              </p>

              <div className="space-y-2 pt-2">
                {[
                  { 
                    en: 'Do you have Panadol?', 
                    am: 'ፓናዶል አለ?', 
                    om: 'Panadool qabduu?' 
                  },
                  { 
                    en: 'Search for Amoxicillin 500mg', 
                    am: 'አሞክሲሲሊን 500 ሚሊ ግራም ፈልግ', 
                    om: 'Amoksiisiiliin 500mg barbaadi' 
                  },
                  { 
                    en: "What are today's sales and profit?", 
                    am: 'የዛሬ ሽያጭ እና ትርፍ ስንት ነው?', 
                    om: 'Gurgurtaan fi bu\'aan har\'aa meeqa?' 
                  },
                  { 
                    en: 'Show low-stock medicines', 
                    am: 'ዝቅተኛ ክምችት ያላቸውን መድኃኒቶች አሳየኝ', 
                    om: 'Qorichoota kuusaan isaanii xiqqaate natti agarsiisi' 
                  },
                  { 
                    en: 'Which products expire in 30 days?', 
                    am: 'በሚቀጥሉት ሰላሳ ቀናት ውስጥ የሚያልቁ መድኃኒቶች የትኞቹ ናቸው?', 
                    om: 'Qorichoonni guyyoota 30 keessatti yeroon darbu kami?' 
                  },
                  { 
                    en: 'Add 2 Panadol to the sale', 
                    am: 'ሁለት ፓናዶል ወደ ሽያጭ ጨምር', 
                    om: 'Panadool lama gara gurgurtaatti dabali' 
                  },
                  { 
                    en: 'Show the total', 
                    am: 'የሽያጭ ድምር ስንት ነው?', 
                    om: 'Ida\'amni gatii meeqa?' 
                  },
                  { 
                    en: 'Complete the sale', 
                    am: 'ሽያጩን ጨርስ', 
                    om: 'Gurgurtaa xumuri' 
                  }
                ].map((item, idx) => {
                  const activePrompt = language === 'am' ? item.am : (language === 'om' ? item.om : item.en);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleExecuteCommand(activePrompt)}
                      className="w-full text-left p-3 rounded-2xl bg-gray-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-gray-200 dark:border-slate-700/80 hover:border-emerald-400 transition-all text-xs font-semibold text-gray-800 dark:text-slate-200 flex items-center justify-between group cursor-pointer"
                    >
                      <span>{activePrompt}</span>
                      <Play className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: COMMAND REFERENCE & CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {commandCategories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col"
                >
                  <div className={`p-4 bg-gradient-to-r ${cat.color} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm leading-tight">
                          {language === 'om' ? cat.categoryOromo : (language === 'am' ? cat.categoryAmharic : cat.categoryName)}
                        </h3>
                        <p className="text-xs text-white/80">
                          {language === 'om' ? cat.categoryName : (language === 'am' ? cat.categoryName : cat.categoryAmharic)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                      {cat.items.length} commands
                    </span>
                  </div>

                  <div className="p-4 divide-y divide-gray-100 dark:divide-slate-800 flex-1 space-y-3">
                    {cat.items.map((cmd, cIdx) => (
                      <div key={cIdx} className="pt-3 first:pt-0 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                            "{cmd.commandEn}"
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                            {cmd.actionType}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                          🇪🇹 "{cmd.commandAm}"
                        </p>
                        <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                          🌳 "{cmd.commandOm}"
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500">
                          {language === 'om' ? cmd.descriptionOm : (language === 'am' ? cmd.descriptionAm : cmd.descriptionEn)}
                        </p>
                        <button
                          onClick={() => handleExecuteCommand(language === 'om' ? cmd.commandOm : (language === 'am' ? cmd.commandAm : cmd.commandEn))}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <span>Execute Command</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DIAGNOSTICS & SAFETY RULES */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4 md:col-span-2">
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Voice AI Guardrails & Role-Based Security</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/70 space-y-1">
                <span className="font-bold text-gray-900 dark:text-white">Strict Inventory Grounding</span>
                <p className="text-gray-500 dark:text-slate-400 leading-relaxed">
                  The AI assistant never hallucinates stock quantities, prices, or batch records. Every voice response is generated directly from live system database snapshots.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/70 space-y-1">
                <span className="font-bold text-gray-900 dark:text-white">Role-Based Access Enforcement</span>
                <p className="text-gray-500 dark:text-slate-400 leading-relaxed">
                  Financial profit reports and high-level admin settings are strictly blocked when queried by Cashier or Customer roles.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/70 space-y-1">
                <span className="font-bold text-gray-900 dark:text-white">Mandatory Confirmation Gates</span>
                <p className="text-gray-500 dark:text-slate-400 leading-relaxed">
                  Sales completion and inter-branch stock transfers require explicit confirmation (verbal or button click) before database writes occur.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/70 space-y-1">
                <span className="font-bold text-gray-900 dark:text-white">Medical Triage & Safety Disclaimer</span>
                <p className="text-gray-500 dark:text-slate-400 leading-relaxed">
                  Customer health queries always include safety advice and recommend in-person pharmacist or doctor consultation.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Engine Status</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span className="text-gray-500 dark:text-slate-400">Web Speech API</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Supported
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span className="text-gray-500 dark:text-slate-400">Speech Synthesis (TTS)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Active
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span className="text-gray-500 dark:text-slate-400">Natural Language Model</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Gemini Flash 3.7 + Rule Engine
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-800">
                <span className="text-gray-500 dark:text-slate-400">Supported Languages</span>
                <span className="font-bold text-gray-800 dark:text-slate-200">
                  en-US, am-ET, om-ET (Afaan Oromoo)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
