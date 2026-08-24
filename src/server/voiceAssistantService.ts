import { GoogleGenAI, Type } from '@google/genai';
import { DbSchema, loadDb, saveDb } from './db.ts';
import { Medicine, StockItem, Sale, SaleItem, Branch, UserRole, Customer, Expense, AuditLog, StockTransfer } from '../types.ts';
import { logToAuditTrail } from './migrationService.ts';

// Helper to generate unique IDs
const generateId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).substring(2, 7)}`;
};

export interface VoiceAssistantRequest {
  text: string;
  language?: 'en' | 'am' | 'om';
  mode?: 'staff' | 'customer';
  userRole?: string;
  userId?: string;
  userName?: string;
  branchId?: string;
  activeTab?: string;
  currentCart?: Array<{
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitPrice: number;
    batchId?: string;
    batchNumber?: string;
  }>;
  vatPercent?: number;
  discountAmount?: number;
  pendingAction?: {
    actionType: 'complete_sale' | 'transfer_stock' | 'cancel_sale';
    payload: any;
  } | null;
  confirmed?: boolean;
}

export interface VoiceAssistantResponse {
  action: 
    | 'search_result' 
    | 'product_detail'
    | 'pos_add' 
    | 'pos_remove' 
    | 'pos_update_qty' 
    | 'pos_set_vat' 
    | 'pos_set_discount' 
    | 'pos_show_total' 
    | 'pos_confirm_sale' 
    | 'pos_execute_sale' 
    | 'pos_cancel_sale' 
    | 'inventory_report' 
    | 'financial_report' 
    | 'branch_stock' 
    | 'transfer_confirm' 
    | 'transfer_execute' 
    | 'navigate' 
    | 'customer_consultation' 
    | 'general_info'
    | 'permission_denied'
    | 'error';
  spokenText: string;
  displayText: string;
  language: 'en' | 'am' | 'om';
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  pendingActionPayload?: any;
  data?: any;
  updatedCart?: any[];
  executionSuccess?: boolean;
  navTarget?: string;
}

/**
 * Main processor for Voice Assistant commands
 */
export async function processVoiceCommand(
  req: VoiceAssistantRequest,
  db: DbSchema
): Promise<VoiceAssistantResponse> {
  const text = (req.text || '').trim();
  const lang = detectLanguage(text, req.language);
  const mode = req.mode || (req.userRole === 'customer' ? 'customer' : 'staff');
  const role = req.userRole || 'cashier';
  const branchId = req.branchId || 'b1';
  const branch: Branch = db.branches.find(b => b.id === branchId) || db.branches[0] || { id: 'b1', name: 'Sonan Pharmacy Main Branch', code: 'SP-MAIN', address: 'Addis Ababa, Ethiopia', phone: '+251911000000' };

  if (!text) {
    const defaultSpoken = lang === 'am'
      ? 'እባክዎ ትዕዛዝዎን ይናገሩ ወይም ይፃፉ።'
      : (lang === 'om' ? 'Mee ajaja keessan dubbadhaa yookaan barreessaa.' : 'Please say or type your command.');

    return {
      action: 'general_info',
      spokenText: defaultSpoken,
      displayText: defaultSpoken,
      language: lang
    };
  }

  // 1. Check if user is confirming or canceling a pending confirmation (e.g., Sale completion or Stock transfer)
  if (req.pendingAction) {
    const isYes = isAffirmative(text);
    const isNo = isNegative(text);

    if (isYes) {
      if (req.pendingAction.actionType === 'complete_sale') {
        return executePosSale(req.pendingAction.payload, db, lang, req.userId, req.userName);
      }
      if (req.pendingAction.actionType === 'transfer_stock') {
        return executeStockTransfer(req.pendingAction.payload, db, lang, req.userId, req.userName, role);
      }
      if (req.pendingAction.actionType === 'cancel_sale') {
        return {
          action: 'pos_cancel_sale',
          spokenText: lang === 'am' 
            ? 'የሽያጭ ትዕዛዙ ተሰርዟል።' 
            : (lang === 'om' ? 'Gurgurtaan haqameera.' : 'The current sale has been cancelled and cart is cleared.'),
          displayText: lang === 'am' 
            ? 'የሽያጭ ትዕዛዙ ተሰርዟል። የዕቃ ቅርጫቱ ጸድቷል።' 
            : (lang === 'om' ? 'Gurgurtaan haqameera. Qorichi gurgurtaa keessaa qulqullaa\'eera.' : 'Sale transaction cancelled. Cart cleared.'),
          language: lang,
          updatedCart: []
        };
      }
    } else if (isNo) {
      return {
        action: 'general_info',
        spokenText: lang === 'am' 
          ? 'ትዕዛዙ ተሰርዟል።' 
          : (lang === 'om' ? 'Hojichi haqameera.' : 'Operation cancelled.'),
        displayText: lang === 'am' 
          ? 'ትዕዛዙ ተሰርዟል።' 
          : (lang === 'om' ? 'Hojichi maamilaan haqameera.' : 'Operation cancelled by user.'),
        language: lang,
        pendingActionPayload: null
      };
    }
  }

  // 2. Customer Mode: Restrict to public search, OTC availability, general advice with safety boundaries
  if (mode === 'customer' || role === 'customer') {
    return handleCustomerInquiry(text, db, lang, branch);
  }

  // 3. Fast Intent Parsing for Staff Mode
  // Check Navigation Commands
  const navMatch = checkNavigationIntent(text);
  if (navMatch) {
    const spokenNav = lang === 'am'
      ? `ወደ ${navMatch.nameAm} እየቀየርኩ ነው።`
      : (lang === 'om' ? `Gara ${navMatch.nameOm}tti jijjiiraa jira.` : `Navigating to ${navMatch.nameEn}.`);

    const displayNav = lang === 'am'
      ? `ወደ ${navMatch.nameAm} ተቀይሯል።`
      : (lang === 'om' ? `Gara **${navMatch.nameOm}**tti jijjiirameera.` : `Navigated to **${navMatch.nameEn}**.`);

    return {
      action: 'navigate',
      navTarget: navMatch.tab,
      spokenText: spokenNav,
      displayText: displayNav,
      language: lang
    };
  }

  // Check POS Specific Commands (if in POS context or explicit POS command)
  const posIntent = checkPosIntent(text, req, db, lang, branchId);
  if (posIntent) {
    return posIntent;
  }

  // Check Financial Queries (Role check: Admin / Manager / Pharmacist)
  const financialIntent = checkFinancialIntent(text, db, lang, branchId, role, branch);
  if (financialIntent) {
    return financialIntent;
  }

  // Check Inventory Queries
  const inventoryIntent = checkInventoryIntent(text, db, lang, branchId, branch);
  if (inventoryIntent) {
    return inventoryIntent;
  }

  // Check Branch / Transfer Queries
  const branchIntent = checkBranchAndTransferIntent(text, db, lang, branchId, role, branch);
  if (branchIntent) {
    return branchIntent;
  }

  // Check Direct Product Search
  const searchIntent = checkProductSearchIntent(text, db, lang, branchId);
  if (searchIntent) {
    return searchIntent;
  }

  // 4. Fallback to Gemini 3.7 Flash NLP engine for nuanced clinical interpretation & multi-step voice commands
  return handleGeminiVoiceAssistant(req, db, lang, branch, role);
}

/**
 * Amharic language detection helper
 */
function isAmharicText(text: string): boolean {
  // Ethiopic Unicode Range: \u1200-\u137F
  return /[\u1200-\u137F]/.test(text);
}

/**
 * Afaan Oromoo language detection helper
 */
function isAfanOromoText(text: string): boolean {
  const lower = text.toLowerCase();
  const oromoKeywords = [
    'jiraa', 'jiruu', 'qabduu', 'barbaadi', 'agarsiisi', 'gurgurtaa', 'qoricha', 'qorichoota',
    'gatii', 'meeqa', 'dabali', 'hir\'isi', 'hirisi', 'haqi', 'xumuri', 'dhumachaa', 'har\'aa', 'haraa',
    'eeyyee', 'lakkii', 'lakki', 'baasii', 'bu\'aa', 'buaa', 'galii', 'daashboordii', 'kuusaa',
    'damee', 'dhukkubbi', 'dhukkuba', 'garaa', 'mataa', 'ho\'a', 'hoa', 'qufaa', 'utalloo', 'tajaajila',
    'waliigala', 'kilaayentii', 'maamila', 'bittaa', 'jijjiirraa', 'kaffaltii', 'itti fufi', 'dhiisi',
    'tokko', 'lama', 'sadii', 'afur', 'shan', 'ja\'a', 'torba', 'saddeet', 'sagal', 'kudhan'
  ];
  return oromoKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Language resolver
 */
function detectLanguage(text: string, requestedLang?: 'en' | 'am' | 'om'): 'en' | 'am' | 'om' {
  if (requestedLang) return requestedLang;
  if (isAmharicText(text)) return 'am';
  if (isAfanOromoText(text)) return 'om';
  return 'en';
}

/**
 * Affirmative detection ("yes", "confirm", "ok", "አዎ", "እሺ", "ጨርስ", "eeyyee", "tole", etc.)
 */
function isAffirmative(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === 'yes' ||
    lower.startsWith('yes') ||
    lower.includes('confirm') ||
    lower.includes('complete') ||
    lower.includes('proceed') ||
    lower.includes('ok') ||
    lower.includes('sure') ||
    lower.includes('አዎ') ||
    lower.includes('እሺ') ||
    lower.includes('ጨርስ') ||
    lower.includes('ፈጽም') ||
    lower.includes('ይሁን') ||
    lower.includes('eeyyee') ||
    lower.includes('eeyyeen') ||
    lower.includes('tole') ||
    lower.includes('hayyee') ||
    lower.includes('toles') ||
    lower.includes('itti fufi') ||
    lower.includes('raawwadhu') ||
    lower.includes('sirriidha')
  );
}

/**
 * Negative detection ("no", "cancel", "stop", "አይ", "ሰርዝ", "ተወው", "lakkii", "dhiisi", etc.)
 */
function isNegative(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === 'no' ||
    lower.startsWith('no') ||
    lower.includes('cancel') ||
    lower.includes('stop') ||
    lower.includes('abort') ||
    lower.includes('don\'t') ||
    lower.includes('አይ') ||
    lower.includes('አይደለም') ||
    lower.includes('ሰርዝ') ||
    lower.includes('ተወው') ||
    lower.includes('አቁም') ||
    lower.includes('lakkii') ||
    lower.includes('lakki') ||
    lower.includes('dhiisi') ||
    lower.includes('haqi') ||
    lower.includes('hin barbaadu') ||
    lower.includes('hin ta\'u')
  );
}

/**
 * Navigation Intent
 */
function checkNavigationIntent(text: string): { tab: string; nameEn: string; nameAm: string; nameOm: string } | null {
  const lower = text.toLowerCase();
  
  if (lower.includes('dashboard') || lower.includes('ዳሽቦርድ') || lower.includes('ዋና ገጽ') || lower.includes('daashboordii') || lower.includes('fuula duraa')) {
    return { tab: 'dashboard', nameEn: 'Dashboard', nameAm: 'ዳሽቦርድ', nameOm: 'Daashboordii' };
  }
  if (lower.includes('pos') || lower.includes('point of sale') || lower.includes('sales register') || lower.includes('የሽያጭ መመዝገቢያ') || lower.includes('መሸጫ') || lower.includes('gurgurtaa') || lower.includes('bakka gurgurtaa')) {
    return { tab: 'pos', nameEn: 'POS Sales Register', nameAm: 'የሽያጭ መመዝገቢያ', nameOm: 'Galmee Gurgurtaa POS' };
  }
  if (lower.includes('inventory') || lower.includes('stock management') || lower.includes('ዕቃ መጋዘን') || lower.includes('ኢንቨንቶሪ') || lower.includes('kuusaa') || lower.includes('istookii')) {
    return { tab: 'inventory', nameEn: 'Inventory Management', nameAm: 'የመድኃኒት ክምችት', nameOm: 'Bulchiinsa Kuusaa Qorichaa' };
  }
  if (lower.includes('bin card') || lower.includes('ቢን ካርድ') || lower.includes('biin kaardii')) {
    return { tab: 'bincards', nameEn: 'Bin Cards', nameAm: 'ቢን ካርዶች', nameOm: 'Kaardii Kuusaa (Bin Card)' };
  }
  if (lower.includes('transfer') || lower.includes('ትራንስፈር') || lower.includes('ዝውውር') || lower.includes('jijjiirraa') || lower.includes('dabarsi')) {
    return { tab: 'transfers', nameEn: 'Stock Transfers', nameAm: 'የመድኃኒት ዝውውር', nameOm: 'Jijjiirraa Qorichaa Damee' };
  }
  if (lower.includes('purchase') || lower.includes('purchase order') || lower.includes('ግዢ') || lower.includes('bittaa') || lower.includes('ajaja bittaa')) {
    return { tab: 'purchases', nameEn: 'Purchase Orders', nameAm: 'የግዢ ትዕዛዞች', nameOm: 'Ajaja Bittaa' };
  }
  if (lower.includes('customer') || lower.includes('loyalty') || lower.includes('ደንበኞች') || lower.includes('maamiltoota') || lower.includes('kilaayentii')) {
    return { tab: 'customers', nameEn: 'Customers & Loyalty', nameAm: 'ደንበኞች', nameOm: 'Maamiltoota' };
  }
  if (lower.includes('financial') || lower.includes('profit') || lower.includes('ገንዘብ ነክ') || lower.includes('ሪፖርት') || lower.includes('faayinaansii') || lower.includes('bu\'aa') || lower.includes('galii')) {
    return { tab: 'financials', nameEn: 'Financial Reports', nameAm: 'የፋይናንስ ሪፖርት', nameOm: 'Gabaasa Faayinaansii' };
  }
  if (lower.includes('expense') || lower.includes('ወጪዎች') || lower.includes('baasii')) {
    return { tab: 'expenses', nameEn: 'Expenses Registry', nameAm: 'የወጪ መዝገብ', nameOm: 'Galmee Baasii' };
  }
  if (lower.includes('note') || lower.includes('ማስታወሻ') || lower.includes('yaadannoo')) {
    return { tab: 'notes', nameEn: 'Pharmacy Notes', nameAm: 'ማስታወሻዎች', nameOm: 'Yaadannoowwan' };
  }
  if (lower.includes('backup') || lower.includes('ዳታ ባክአፕ') || lower.includes('baakaappii')) {
    return { tab: 'backup', nameEn: 'Backup & Restore', nameAm: 'ዳታ መጠባበቂያ', nameOm: 'Kuusaa Bakka Buusuu (Backup)' };
  }
  if (lower.includes('teleconsult') || lower.includes('ቴሌኮንሰልቴሽን') || lower.includes('konsaltaashinii')) {
    return { tab: 'teleconsultation', nameEn: 'Teleconsultation', nameAm: 'የኦንላይን ህክምና ምክክር', nameOm: 'Gorsa Fayyaa Sararaarraa' };
  }
  if (lower.includes('online order') || lower.includes('የኦንላይን ትዕዛዝ') || lower.includes('ajaja sararaarraa')) {
    return { tab: 'online-orders', nameEn: 'Online Orders', nameAm: 'የኦንላይን ትዕዛዞች', nameOm: 'Ajajawwan Sararaarraa' };
  }
  return null;
}

/**
 * POS Intent Processing
 */
function checkPosIntent(
  text: string, 
  req: VoiceAssistantRequest, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  branchId: string
): VoiceAssistantResponse | null {
  const lower = text.toLowerCase();
  const currentCart = req.currentCart || [];

  // 1. "Complete the sale" / "ሽያጩን ጨርስ" / "gurgurtaa xumuri"
  if (
    lower.includes('complete the sale') ||
    lower.includes('complete sale') ||
    lower.includes('checkout') ||
    lower.includes('finish sale') ||
    lower.includes('ሽያጩን ጨርስ') ||
    lower.includes('ሽያጭ ፈጽም') ||
    lower.includes('gurgurtaa xumuri') ||
    lower.includes('gurgurtaa raawwadhu')
  ) {
    if (currentCart.length === 0) {
      const emptySpoken = lang === 'am'
        ? 'የዕቃ ቅርጫቱ ባዶ ነው። እባክዎ መጀመሪያ መድኃኒት ይጨምሩ።'
        : (lang === 'om' ? 'Gurgurtaan kun duwwaadha. Mee dura qoricha gara gurgurtaatti dabalaa.' : 'The POS cart is empty. Please add items to the sale first.');

      return {
        action: 'general_info',
        spokenText: emptySpoken,
        displayText: emptySpoken,
        language: lang
      };
    }

    // Calculate total with VAT and discount
    const subtotal = currentCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const discount = req.discountAmount || 0;
    const vatPct = req.vatPercent !== undefined ? req.vatPercent : 0;
    const discounted = Math.max(0, subtotal - discount);
    const vatAmount = (discounted * vatPct) / 100;
    const total = discounted + vatAmount;

    const formattedTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let spoken = `The total is ${formattedTotal} Ethiopian Birr. Do you want to complete the sale?`;
    let display = `🛒 **Sale Checkout Confirmation**\n* Items in Cart: **${currentCart.length}**\n* Grand Total: **${formattedTotal} ETB**\n\nPlease confirm: Say **"Yes, complete the sale"** or click below.`;

    if (lang === 'am') {
      spoken = `ጠቅላላ ድምሩ ${formattedTotal} የኢትዮጵያ ብር ነው። ሽያጩን ማጠናቀቅ ይፈልጋሉ?`;
      display = `🛒 **የሽያጭ ማጠቃለያ ማረጋገጫ**\n* የዕቃዎች ብዛት: **${currentCart.length}**\n* ድምር: **${formattedTotal} ETB**\n\nሽያጩን ለመፈጸም **"አዎ"** ወይም **"ሽያጩን ጨርስ"** ይበሉ።`;
    } else if (lang === 'om') {
      spoken = `Ida'amni waliigalaa Qarshii ${formattedTotal} dha. Gurgurtaa xumuruu barbaadduu?`;
      display = `🛒 **Mirkaneessa Gurgurtaa POS**\n* Baay'ina Qorichaa: **${currentCart.length}**\n* Ida'ama Waliigalaa: **${formattedTotal} ETB**\n\nGurgurtaa xumuruuf **"Eeyyee"** yookaan **"Gurgurtaa xumuri"** jedhaa.`;
    }

    return {
      action: 'pos_confirm_sale',
      spokenText: spoken,
      displayText: display,
      language: lang,
      requiresConfirmation: true,
      confirmationPrompt: spoken,
      pendingActionPayload: {
        actionType: 'complete_sale',
        payload: {
          branchId,
          items: currentCart,
          vatPercent: vatPct,
          discount: discount,
          total: total
        }
      }
    };
  }

  // 2. "Cancel this sale" / "Clear cart" / "ሽያጩን ሰርዝ" / "gurgurtaa haqi"
  if (
    lower.includes('cancel this sale') ||
    lower.includes('cancel sale') ||
    lower.includes('clear cart') ||
    lower.includes('empty cart') ||
    lower.includes('ሽያጩን ሰርዝ') ||
    lower.includes('ቅርጫት አፅዳ') ||
    lower.includes('gurgurtaa haqi') ||
    lower.includes('gurgurtaa dhiisi')
  ) {
    const cancelSpoken = lang === 'am'
      ? 'የሽያጭ ትዕዛዙ ተሰርዟል። የዕቃ ቅርጫቱ ጸድቷል።'
      : (lang === 'om' ? 'Gurgurtaan haqameera. Qorichi gurgurtaa keessaa qulqullaa\'eera.' : 'Sale transaction cancelled. Cart cleared.');

    const cancelDisplay = lang === 'am'
      ? 'የሽያጭ ትዕዛዙ ተሰርዟል።'
      : (lang === 'om' ? 'Gurgurtaan haqameera.' : 'Sale transaction cancelled. Cart has been emptied.');

    return {
      action: 'pos_cancel_sale',
      spokenText: cancelSpoken,
      displayText: cancelDisplay,
      language: lang,
      updatedCart: []
    };
  }

  // 3. "Show the total" / "ስንት ነው ድምሩ?" / "ida'amni meeqa"
  if (
    lower.includes('show the total') ||
    lower.includes('show total') ||
    lower.includes('what is the total') ||
    lower.includes('how much is the total') ||
    lower.includes('ስንት ነው ድምሩ') ||
    lower.includes('ጠቅላላ ድምር') ||
    lower.includes('ida\'amni meeqa') ||
    lower.includes('waliigala meeqa')
  ) {
    const subtotal = currentCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const formattedTotal = subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let totalSpoken = `The current sale total is ${formattedTotal} Ethiopian Birr across ${currentCart.length} items.`;
    if (lang === 'am') {
      totalSpoken = `የአሁኑ የሽያጭ ድምር ${formattedTotal} የኢትዮጵያ ብር ነው።`;
    } else if (lang === 'om') {
      totalSpoken = `Ida'amni gurgurtaa amma jiru Qarshii ${formattedTotal} dha (${currentCart.length} qoricha).`;
    }

    return {
      action: 'pos_show_total',
      spokenText: totalSpoken,
      displayText: `💰 **Current POS Total**: **${formattedTotal} ETB** (${currentCart.length} items in cart).`,
      language: lang,
      data: { subtotal, itemCount: currentCart.length }
    };
  }

  // 4. "Apply zero VAT" / "Apply 15% VAT" / "ቫት 0 አድርግ"
  if (lower.includes('zero vat') || lower.includes('0% vat') || lower.includes('no vat') || lower.includes('ቫት 0') || lower.includes('ያለ ቫት') || lower.includes('vaat 0')) {
    const vatSpoken = lang === 'am'
      ? 'ዜሮ ፐርሰንት ቫት ተተግብሯል።'
      : (lang === 'om' ? 'Vaatiin dhibbeentaa 0% hojiirra ooleera.' : 'Zero VAT applied to the sale.');

    let vatDisp = '✅ **Zero VAT (0%)** applied to transaction.';
    if (lang === 'am') vatDisp = '✅ **ዜሮ ቫት (0%)** ለሽያጩ ተተግብሯል።';
    if (lang === 'om') vatDisp = '✅ **Vaatii 0%** gurgurtaadhaaf hojiirra ooleera.';

    return {
      action: 'pos_set_vat',
      spokenText: vatSpoken,
      displayText: vatDisp,
      language: lang,
      data: { vatPercent: 0 }
    };
  }
  if (lower.includes('15% vat') || lower.includes('standard vat') || lower.includes('15 ፐርሰንት ቫት') || lower.includes('vaat 15')) {
    const vatSpoken = lang === 'am'
      ? '15 ፐርሰንት መደበኛ ቫት ተተግብሯል።'
      : (lang === 'om' ? 'Vaatiin dhibbeentaa 15% hojiirra ooleera.' : 'Standard 15% VAT applied to the sale.');

    let vatDisp = '✅ **Standard VAT (15%)** applied to transaction.';
    if (lang === 'am') vatDisp = '✅ **መደበኛ 15% ቫት** ለሽያጩ ተተግብሯል።';
    if (lang === 'om') vatDisp = '✅ **Vaatii Idilee 15%** gurgurtaadhaaf hojiirra ooleera.';

    return {
      action: 'pos_set_vat',
      spokenText: vatSpoken,
      displayText: vatDisp,
      language: lang,
      data: { vatPercent: 15 }
    };
  }

  // 5. "Add [quantity] [Medicine Name] to sale" / "ጨምር" / "dabali"
  if (lower.startsWith('add ') || lower.includes(' add ') || lower.includes('ጨምር') || lower.includes('አስገባ') || lower.includes('dabali') || lower.includes('galchi')) {
    const parsedAdd = extractProductAndQuantity(text, db, branchId);
    if (parsedAdd) {
      const { medicine, quantity, stockItem } = parsedAdd;
      
      if (!stockItem || stockItem.quantity <= 0) {
        const outSpoken = lang === 'am'
          ? `${medicine.name} በቅርንጫፍ ውስጥ በቂ ክምችት የለም።`
          : (lang === 'om' ? `${medicine.name} damee kana keessatti dhumateera.` : `${medicine.name} is currently out of stock in this branch.`);

        let outDisp = `⚠️ **Out of Stock**: **${medicine.name}** has 0 units available in this branch.`;
        if (lang === 'am') outDisp = `⚠️ **በክምችት የለም**: **${medicine.name}** በዚህ ቅርንጫፍ ውስጥ አልቋል።`;
        if (lang === 'om') outDisp = `⚠️ **Kuusaa keessa hin jiru**: **${medicine.name}** damee kana keessatti dhumateera.`;

        return {
          action: 'general_info',
          spokenText: outSpoken,
          displayText: outDisp,
          language: lang
        };
      }

      const availableQty = stockItem.quantity;
      const addQty = Math.min(quantity, availableQty);
      const unitPrice = stockItem.sellingPrice || medicine.price || 0;
      
      // Update cart
      const existingIdx = currentCart.findIndex(c => c.medicineId === medicine.id);
      let newCart = [...currentCart];
      if (existingIdx >= 0) {
        newCart[existingIdx] = {
          ...newCart[existingIdx],
          quantity: newCart[existingIdx].quantity + addQty
        };
      } else {
        newCart.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          quantity: addQty,
          unitPrice: unitPrice,
          batchId: stockItem.id,
          batchNumber: stockItem.batchNumber || 'BN-STD'
        });
      }

      const totalItemPrice = (unitPrice * addQty).toLocaleString('en-US');
      const cartTotal = newCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toLocaleString('en-US');

      let spoken = `${addQty} ${medicine.name} added to the sale. The current total is ${cartTotal} Ethiopian Birr.`;
      if (lang === 'am') {
        spoken = `${addQty} ${medicine.name} ወደ ሽያጭ ተጨምሯል። የአሁኑ ድምር ${cartTotal} የኢትዮጵያ ብር ነው።`;
      } else if (lang === 'om') {
        spoken = `${addQty} ${medicine.name} gara gurgurtaatti dabalameera. Ida'amni amma Qarshii ${cartTotal} dha.`;
      }

      let display = `✅ **Added to Cart**: **${addQty}x ${medicine.name}** @ ${unitPrice} ETB each.\n* Current Cart Total: **${cartTotal} ETB** (${newCart.length} items)`;
      if (lang === 'am') {
        display = `✅ **ወደ ቅርጫት ተጨምሯል**: **${addQty}x ${medicine.name}** (በአንድ ፍሬ ${unitPrice} ብር)\n* አጠቃላይ የቅርጫት ድምር: **${cartTotal} ብር** (${newCart.length} እቃዎች)`;
      } else if (lang === 'om') {
        display = `✅ **Gara Gurgurtaatti Dabalameera**: **${addQty}x ${medicine.name}** (Tokkoon ${unitPrice} ETB)\n* Ida'ama Ammaa: **${cartTotal} ETB** (${newCart.length} qoricha)`;
      }

      return {
        action: 'pos_add',
        spokenText: spoken,
        displayText: display,
        language: lang,
        updatedCart: newCart,
        data: {
          addedItem: {
            medicineId: medicine.id,
            medicineName: medicine.name,
            quantity: addQty,
            unitPrice: unitPrice
          },
          cartTotal: cartTotal
        }
      };
    }
  }

  // 6. "Remove [Medicine Name]" / "አውጣ" / "haqi"
  if (lower.startsWith('remove ') || lower.includes(' remove ') || lower.includes('አውጣ') || lower.includes('ቀንስ') || lower.includes('haqi') || lower.includes('hir\'isi')) {
    const medMatch = findMedicineInText(text, db.medicines);
    if (medMatch) {
      const remainingCart = currentCart.filter(c => c.medicineId !== medMatch.id);
      const newTotal = remainingCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toLocaleString('en-US');
      
      let removeSpoken = `${medMatch.name} has been removed from the sale.`;
      if (lang === 'am') {
        removeSpoken = `${medMatch.name} ከሽያጩ ተወግዷል።`;
      } else if (lang === 'om') {
        removeSpoken = `${medMatch.name} gurgurtaa keessaa haqameera.`;
      }

      let removeDisp = `🗑️ **Removed**: **${medMatch.name}** was removed from the cart. New Total: **${newTotal} ETB**.`;
      if (lang === 'am') {
        removeDisp = `🗑️ **ተወግዷል**: **${medMatch.name}** ከቅርጫቱ ወጥቷል። አዲስ ድምር: **${newTotal} ብር**።`;
      } else if (lang === 'om') {
        removeDisp = `🗑️ **Haqameera**: **${medMatch.name}** gurgurtaa keessaa ba'eera. Ida'ama Haaraa: **${newTotal} ETB**.`;
      }

      return {
        action: 'pos_remove',
        spokenText: removeSpoken,
        displayText: removeDisp,
        language: lang,
        updatedCart: remainingCart
      };
    }
  }

  // 7. "Change the quantity to [number]" / "Change quantity of [Med] to [number]" / "baay'ina jijjiiri"
  if (lower.includes('change quantity') || lower.includes('change the quantity') || lower.includes('set quantity') || lower.includes('መጠኑን ወደ') || lower.includes('baay\'ina')) {
    const qtyMatch = text.match(/\b(\d+)\b/) || text.match(/(one|two|three|four|five|six|seven|eight|nine|ten|tokko|lama|sadii|afur|shan|ja\'a|jaa|torba|saddeet|sagal|kudhan|አንድ|ሁለት|ሦስት|አራት|አምስት|ስድስት|ሰባት|ስምንት|ዘጠኝ|አሥር)/i);
    const newQty = qtyMatch ? parseWordNumber(qtyMatch[0]) : 1;
    const medMatch = findMedicineInText(text, db.medicines) || (currentCart.length > 0 ? db.medicines.find(m => m.id === currentCart[currentCart.length - 1].medicineId) : null);

    if (medMatch && currentCart.some(c => c.medicineId === medMatch.id)) {
      const updated = currentCart.map(item => {
        if (item.medicineId === medMatch.id) {
          return { ...item, quantity: newQty };
        }
        return item;
      });
      const newTotal = updated.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0).toLocaleString('en-US');

      let qtySpoken = `Quantity for ${medMatch.name} changed to ${newQty}. Total is ${newTotal} Ethiopian Birr.`;
      if (lang === 'am') {
        qtySpoken = `የ${medMatch.name} መጠን ወደ ${newQty} ተቀይሯል።`;
      } else if (lang === 'om') {
        qtySpoken = `Baay'inni ${medMatch.name} gara ${newQty}tti jijjiirameera. Ida'amni Qarshii ${newTotal} dha.`;
      }

      let qtyDisp = `✏️ **Updated**: **${medMatch.name}** quantity set to **${newQty}**. Cart Total: **${newTotal} ETB**.`;
      if (lang === 'am') {
        qtyDisp = `✏️ **ተስተካክሏል**: የ**${medMatch.name}** መጠን ወደ **${newQty}** ተቀይሯል። የቅርጫት ድምር: **${newTotal} ብር**።`;
      } else if (lang === 'om') {
        qtyDisp = `✏️ **Sirreeffameera**: Baay'inni **${medMatch.name}** gara **${newQty}**tti jijjiirameera. Ida'amni: **${newTotal} ETB**.`;
      }

      return {
        action: 'pos_update_qty',
        spokenText: qtySpoken,
        displayText: qtyDisp,
        language: lang,
        updatedCart: updated
      };
    }
  }

  return null;
}

/**
 * Financial Queries Processing
 */
function checkFinancialIntent(
  text: string, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  branchId: string, 
  role: string,
  branch: Branch
): VoiceAssistantResponse | null {
  const lower = text.toLowerCase();

  // Role validation: Cashier / Customer cannot view deep profit reports
  const isFinancialQuery = (
    lower.includes('today\'s sales') ||
    lower.includes('todays sales') ||
    lower.includes('today sales') ||
    lower.includes('today\'s profit') ||
    lower.includes('todays profit') ||
    lower.includes('net profit') ||
    lower.includes('this month\'s revenue') ||
    lower.includes('this month revenue') ||
    lower.includes('compare this month') ||
    lower.includes('stock value') ||
    lower.includes('inventory value') ||
    lower.includes('today\'s expenses') ||
    lower.includes('የዛሬ ሽያጭ') ||
    lower.includes('የዛሬ ትርፍ') ||
    lower.includes('የወሩ ገቢ') ||
    lower.includes('የክምችት ዋጋ') ||
    lower.includes('የዛሬ ወጪ') ||
    lower.includes('gurgurtaa har\'aa') ||
    lower.includes('bu\'aa har\'aa') ||
    lower.includes('galii ji\'aa') ||
    lower.includes('gatii kuusaa') ||
    lower.includes('baasii har\'aa')
  );

  if (!isFinancialQuery) return null;

  if (role === 'cashier' && (lower.includes('profit') || lower.includes('net profit') || lower.includes('ትርፍ') || lower.includes('bu\'aa'))) {
    const deniedSpoken = lang === 'am' 
      ? 'ይቅርታ፣ የትርፍ ሪፖርቶችን ለማየት የአስተዳዳሪ ወይም የማኔጀር ፈቃድ ያስፈልጋል።' 
      : (lang === 'om' ? 'Dhiifama, gabaasa bu\'aa qulqulluu arguuf hayyama Manajeraa ykn Admin barbaachisa.' : 'Access restricted. Manager or Admin authorization is required to view net profit reports.');

    return {
      action: 'permission_denied',
      spokenText: deniedSpoken,
      displayText: '🔒 **Access Denied**: Net profit and executive margin reports require **Manager** or **Admin** privileges.',
      language: lang
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

  // Calculate real metrics from database
  const branchSales = db.sales.filter(s => (s.branchId === branchId || s.branchId === 'all' || !s.branchId));
  const todaySales = branchSales.filter(s => s.date === todayStr);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  
  // Calculate cost of goods sold (COGS) for today's sales
  let todayCost = 0;
  for (const s of todaySales) {
    for (const item of s.items) {
      const stock = db.stockItems.find(st => st.batchNumber === item.batchNumber && st.medicineId === item.medicineId) || db.stockItems.find(st => st.medicineId === item.medicineId);
      const unitCost = stock?.buyingPrice || (item.unitPrice * 0.7);
      todayCost += (unitCost * item.quantity);
    }
  }

  // Today's expenses
  const branchExpenses = (db.expenses || []).filter(e => (e.branchId === branchId || e.branchId === 'all' || !e.branchId));
  const todayExpenses = branchExpenses.filter(e => e.date === todayStr).reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayNetProfit = Math.max(0, todayRevenue - todayCost - todayExpenses);

  // Month revenue & comparison
  const monthSales = branchSales.filter(s => (s.date || '').startsWith(thisMonthPrefix));
  const monthRevenue = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // Stock Asset Valuation at cost
  const branchStock = db.stockItems.filter(st => (st.branchId === branchId || st.branchId === 'all' || !st.branchId));
  const totalStockValue = branchStock.reduce((sum, st) => sum + ((st.buyingPrice || 0) * (st.quantity || 0)), 0);
  const totalStockRetailValue = branchStock.reduce((sum, st) => sum + ((st.sellingPrice || 0) * (st.quantity || 0)), 0);

  if (lower.includes('profit') || lower.includes('ትርፍ') || lower.includes('bu\'aa')) {
    let spoken = `Today, ${branch.name} has total sales of ETB ${todayRevenue.toLocaleString('en-US')} and a calculated net profit of ETB ${todayNetProfit.toLocaleString('en-US')}.`;
    if (lang === 'am') {
      spoken = `ዛሬ በ${branch.name} አጠቃላይ ሽያጭ ${todayRevenue.toLocaleString('en-US')} የኢትዮጵያ ብር ሲሆን፣ የተጣራ ትርፍ ደግሞ ${todayNetProfit.toLocaleString('en-US')} የኢትዮጵያ ብር ነው።`;
    } else if (lang === 'om') {
      spoken = `Har'a ${branch.name} keessatti gurgurtaan waliigalaa Qarshii ${todayRevenue.toLocaleString('en-US')} yoo ta'u, bu'aan qulqulluun Qarshii ${todayNetProfit.toLocaleString('en-US')} dha.`;
    }

    const display = `📊 **Daily Financial Snapshot (${branch.name})**\n` +
      `* **Selected Period**: Today (${todayStr})\n` +
      `* **Total Sales Revenue**: **ETB ${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}** (${todaySales.length} transactions)\n` +
      `* **Cost of Goods Sold (COGS)**: ETB ${todayCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `* **Operating Expenses**: ETB ${todayExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
      `* **Calculated Net Profit**: **ETB ${todayNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n` +
      `* **Currency**: Ethiopian Birr (ETB)`;

    return {
      action: 'financial_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: {
        branch: branch.name,
        date: todayStr,
        revenue: todayRevenue,
        cogs: todayCost,
        expenses: todayExpenses,
        netProfit: todayNetProfit,
        salesCount: todaySales.length
      }
    };
  }

  if (lower.includes('stock value') || lower.includes('inventory value') || lower.includes('የክምችት ዋጋ') || lower.includes('gatii kuusaa')) {
    let spoken = `The total stock asset valuation at cost for ${branch.name} is ETB ${totalStockValue.toLocaleString('en-US')}.`;
    if (lang === 'am') {
      spoken = `በ${branch.name} ያለው የክምችት ጠቅላላ የግዢ ዋጋ ${totalStockValue.toLocaleString('en-US')} የኢትዮጵያ ብር ነው።`;
    } else if (lang === 'om') {
      spoken = `Gatiin kuusaa qorichaa ${branch.name} gatii bittaatiin Qarshii ${totalStockValue.toLocaleString('en-US')} dha.`;
    }

    const display = `📦 **Inventory Asset Valuation (${branch.name})**\n` +
      `* **Valuation at Cost (Buying Price)**: **ETB ${totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n` +
      `* **Valuation at Retail (Selling Price)**: **ETB ${totalStockRetailValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n` +
      `* **Total Tracked Batches**: ${branchStock.length} items`;

    return {
      action: 'financial_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { costValue: totalStockValue, retailValue: totalStockRetailValue, batchCount: branchStock.length }
    };
  }

  if (lower.includes('expense') || lower.includes('ወጪ') || lower.includes('baasii')) {
    let spoken = `Today's recorded operating expenses for ${branch.name} are ETB ${todayExpenses.toLocaleString('en-US')}.`;
    if (lang === 'am') {
      spoken = `የዛሬ የወጪ መጠን ${todayExpenses.toLocaleString('en-US')} የኢትዮጵያ ብር ነው።`;
    } else if (lang === 'om') {
      spoken = `Baasiin hojii har'aa ${branch.name} Qarshii ${todayExpenses.toLocaleString('en-US')} dha.`;
    }

    const display = `💸 **Today's Expenses (${branch.name})**\n` +
      `* **Total Expenses Today**: **ETB ${todayExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}**\n` +
      `* **Date**: ${todayStr}`;

    return {
      action: 'financial_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { todayExpenses }
    };
  }

  // Default: Today's / Month's Sales
  let spoken = `Today, ${branch.name} has total sales of ETB ${todayRevenue.toLocaleString('en-US')} across ${todaySales.length} transactions, and this month's revenue is ETB ${monthRevenue.toLocaleString('en-US')}.`;
  if (lang === 'am') {
    spoken = `ዛሬ በ${branch.name} አጠቃላይ ሽያጭ ${todayRevenue.toLocaleString('en-US')} የኢትዮጵያ ብር ሲሆን፣ የዚህ ወር ገቢ ${monthRevenue.toLocaleString('en-US')} የኢትዮጵያ ብር ነው።`;
  } else if (lang === 'om') {
    spoken = `Har'a ${branch.name} keessatti gurgurtaan waliigalaa Qarshii ${todayRevenue.toLocaleString('en-US')} (gurgurtaa ${todaySales.length}), galiin ji'a kanaa ammoo Qarshii ${monthRevenue.toLocaleString('en-US')} dha.`;
  }

  const display = `📈 **Sales Summary (${branch.name})**\n` +
    `* **Today's Total Sales**: **ETB ${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}** (${todaySales.length} sales)\n` +
    `* **Month-to-Date Revenue**: **ETB ${monthRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}** (${monthSales.length} sales)\n` +
    `* **Currency**: Ethiopian Birr (ETB)`;

  return {
    action: 'financial_report',
    spokenText: spoken,
    displayText: display,
    language: lang,
    data: { todayRevenue, monthRevenue, todayCount: todaySales.length, monthCount: monthSales.length }
  };
}

/**
 * Inventory Queries Processing
 */
function checkInventoryIntent(
  text: string, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  branchId: string, 
  branch: Branch
): VoiceAssistantResponse | null {
  const lower = text.toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. "How many items are in stock?" / "ስንት መድኃኒቶች አሉ?" / "qorichi meeqa jira"
  if (lower.includes('how many items are in stock') || lower.includes('how many items in stock') || lower.includes('total stock') || lower.includes('ስንት መድኃኒቶች አሉ') || lower.includes('qorichi meeqa jira') || lower.includes('kuusaa keessa')) {
    const branchStock = db.stockItems.filter(st => (st.branchId === branchId || st.branchId === 'all' || !st.branchId) && !st.isDamaged);
    const totalUnits = branchStock.reduce((sum, st) => sum + (st.quantity || 0), 0);
    const uniqueMedicines = new Set(branchStock.map(st => st.medicineId)).size;

    let spoken = `There are currently ${totalUnits.toLocaleString('en-US')} total units across ${uniqueMedicines} unique products in stock at ${branch.name}.`;
    if (lang === 'am') {
      spoken = `በ${branch.name} ውስጥ ${totalUnits.toLocaleString('en-US')} አጠቃላይ የመድኃኒት ፍሬዎች እና ${uniqueMedicines} የተለያዩ መድኃኒቶች በክምችት ይገኛሉ።`;
    } else if (lang === 'om') {
      spoken = `${branch.name} keessatti qorichoota adda addaa ${uniqueMedicines} fi waliigala unitiin ${totalUnits.toLocaleString('en-US')} kuusaa keessa jiru.`;
    }

    const display = `📦 **Inventory Stock Summary (${branch.name})**\n` +
      `* **Total Units in Stock**: **${totalUnits.toLocaleString('en-US')} units**\n` +
      `* **Unique Products Tracked**: **${uniqueMedicines}**\n` +
      `* **Active Batches**: ${branchStock.length}`;

    return {
      action: 'inventory_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { totalUnits, uniqueMedicines, batchCount: branchStock.length }
    };
  }

  // 2. "Show low-stock medicines" / "Show cosmetics with low stock" / "ዝቅተኛ ክምችት" / "dhumataa jiru"
  if (lower.includes('low stock') || lower.includes('low-stock') || lower.includes('ዝቅተኛ ክምችት') || lower.includes('ያለቁ መድኃኒቶች') || lower.includes('dhumataa jiru') || lower.includes('kuusaa xiqqaate')) {
    const isCosmetics = lower.includes('cosmetic') || lower.includes('ኮስሞቲክስ') || lower.includes('koosmeetiksii');
    
    // Find medicines that have total quantity <= minStockLevel
    const lowStockList: Array<{ name: string; category: string; currentQty: number; minStock: number; unit: string }> = [];

    for (const med of db.medicines) {
      if (isCosmetics && med.category?.toLowerCase() !== 'cosmetics') continue;
      
      const stockEntries = db.stockItems.filter(st => st.medicineId === med.id && (st.branchId === branchId || st.branchId === 'all' || !st.branchId));
      const totalQty = stockEntries.reduce((sum, st) => sum + (st.quantity || 0), 0);
      const minStock = med.minStockLevel || 10;

      if (totalQty <= minStock) {
        lowStockList.push({
          name: med.name,
          category: med.category || 'General',
          currentQty: totalQty,
          minStock: minStock,
          unit: med.unit || 'pcs'
        });
      }
    }

    lowStockList.sort((a, b) => a.currentQty - b.currentQty);
    const topLow = lowStockList.slice(0, 8);

    if (topLow.length === 0) {
      let spoken = `All ${isCosmetics ? 'cosmetics' : 'medicines'} are currently well-stocked with no low-stock alerts.`;
      if (lang === 'am') {
        spoken = `በ${branch.name} ምንም ዝቅተኛ ክምችት ያለው ${isCosmetics ? 'ኮስሞቲክስ' : 'መድኃኒት'} የለም። ሁሉም በቂ ነው።`;
      } else if (lang === 'om') {
        spoken = `${branch.name} keessatti qorichi kuusaan isaa dhumataa jiru hin jiru. Hundi gahaadha.`;
      }
      
      return {
        action: 'inventory_report',
        spokenText: spoken,
        displayText: `✅ **Stock Healthy**: No low-stock items detected in ${branch.name}.`,
        language: lang
      };
    }

    const itemsSummary = topLow.map(item => `${item.name} (${item.currentQty} ${item.unit})`).join(', ');
    let spoken = `Found ${lowStockList.length} low-stock ${isCosmetics ? 'cosmetics' : 'items'} in ${branch.name}. Notable items include: ${itemsSummary}.`;
    if (lang === 'am') {
      spoken = `በ${branch.name} ውስጥ ${lowStockList.length} ዝቅተኛ ክምችት ያላቸው እቃዎች አሉ። ከነዚህም: ${topLow.slice(0, 3).map(i => i.name).join(', ')} ይገኙበታል።`;
    } else if (lang === 'om') {
      spoken = `${branch.name} keessatti qorichootni ${lowStockList.length} kuusaan isaanii xiqqaateera: ${topLow.slice(0, 3).map(i => i.name).join(', ')}.`;
    }

    const display = `⚠️ **Low Stock Alert (${branch.name})**\nFound **${lowStockList.length}** items at or below reorder threshold:\n\n` +
      topLow.map((item, idx) => `${idx + 1}. **${item.name}** — Available: **${item.currentQty} ${item.unit}** (Min Target: ${item.minStock})`).join('\n');

    return {
      action: 'inventory_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { lowStockCount: lowStockList.length, items: topLow }
    };
  }

  // 3. "Which products expire soon?" / "Search expired products" / "የሚያልቁ መድኃኒቶች" / "yeroon darbu"
  if (lower.includes('expire soon') || lower.includes('expired') || lower.includes('near expiry') || lower.includes('የሚያልቁ') || lower.includes('ጊዜያቸው ያለፈ') || lower.includes('yeroon darbu') || lower.includes('yeroon darbe')) {
    const isAlreadyExpired = lower.includes('search expired') || lower.includes('expired products') || lower.includes('ጊዜያቸው ያለፈ') || lower.includes('yeroon darbe');
    
    // Near expiry: next 90 days
    const ninetyDaysAhead = new Date();
    ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);
    const ninetyDaysStr = ninetyDaysAhead.toISOString().split('T')[0];

    const branchStock = db.stockItems.filter(st => (st.branchId === branchId || st.branchId === 'all' || !st.branchId) && st.quantity > 0 && st.expiryDate);

    let matched: Array<{ name: string; batchNumber: string; expiryDate: string; quantity: number }> = [];

    if (isAlreadyExpired) {
      matched = branchStock
        .filter(st => st.expiryDate < todayStr)
        .map(st => {
          const med = db.medicines.find(m => m.id === st.medicineId);
          return {
            name: med?.name || 'Unknown',
            batchNumber: st.batchNumber || 'N/A',
            expiryDate: st.expiryDate,
            quantity: st.quantity
          };
        });
    } else {
      matched = branchStock
        .filter(st => st.expiryDate >= todayStr && st.expiryDate <= ninetyDaysStr)
        .map(st => {
          const med = db.medicines.find(m => m.id === st.medicineId);
          return {
            name: med?.name || 'Unknown',
            batchNumber: st.batchNumber || 'N/A',
            expiryDate: st.expiryDate,
            quantity: st.quantity
          };
        });
    }

    matched.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    if (matched.length === 0) {
      let spoken = isAlreadyExpired ? 'No expired products found in active inventory.' : 'No products are expiring within the next 90 days.';
      if (lang === 'am') {
        spoken = isAlreadyExpired ? 'ምንም ጊዜያቸው ያለፈባቸው መድኃኒቶች አልተገኙም።' : 'በሚቀጥሉት 90 ቀናት ውስጥ የሚያልቁ መድኃኒቶች የሉም።';
      } else if (lang === 'om') {
        spoken = isAlreadyExpired ? 'Qorichi yeroon isaa darbe kuusaa keessatti hin argamne.' : 'Qorichi guyyoota 90 keessatti yeroon isaa darbu hin jiru.';
      }
      
      return {
        action: 'inventory_report',
        spokenText: spoken,
        displayText: `✅ **Inventory Safe**: ${spoken}`,
        language: lang
      };
    }

    let spoken = `Found ${matched.length} ${isAlreadyExpired ? 'expired' : 'near-expiry'} batches in ${branch.name}. First item: ${matched[0].name}, expiring on ${matched[0].expiryDate}.`;
    if (lang === 'am') {
      spoken = `${matched.length} ${isAlreadyExpired ? 'ጊዜያቸው ያለፈባቸው' : 'በቅርቡ የሚያልቁ'} መድኃኒቶች ተገኝተዋል። የመጀመሪያው ${matched[0].name} ነው።`;
    } else if (lang === 'om') {
      spoken = `Qorichootni ${matched.length} ${isAlreadyExpired ? 'yeroon isaanii darbe' : 'yeroon dhiyaate'} argamaniiru. Inni duraa: ${matched[0].name} (${matched[0].expiryDate}).`;
    }

    const display = `⏳ **${isAlreadyExpired ? 'Expired Stock' : 'Near-Expiry Items'} (${branch.name})**\nTotal Batches: **${matched.length}**\n\n` +
      matched.slice(0, 8).map((item, idx) => `${idx + 1}. **${item.name}** (Batch: ${item.batchNumber}) — **${item.quantity} units** | Expiry: **${item.expiryDate}**`).join('\n');

    return {
      action: 'inventory_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { count: matched.length, items: matched.slice(0, 10) }
    };
  }

  // 4. "What products were added today?" / "ዛሬ የተጨመሩ መድኃኒቶች" / "har'a dabalame"
  if (lower.includes('added today') || lower.includes('new products today') || lower.includes('ዛሬ የተጨመሩ') || lower.includes('har\'a dabalame')) {
    const todayAdded = db.medicines.filter(m => (m as any).createdAt && (m as any).createdAt.startsWith(todayStr));
    
    if (todayAdded.length === 0) {
      let spoken = 'No new products were registered in the item master today.';
      if (lang === 'am') spoken = 'ዛሬ የተጨመረ አዲስ መድኃኒት የለም።';
      if (lang === 'om') spoken = 'Har\'a qorichi haaraan hin galmoofne.';

      return {
        action: 'inventory_report',
        spokenText: spoken,
        displayText: `ℹ️ ${spoken}`,
        language: lang
      };
    }

    const names = todayAdded.map(m => m.name).join(', ');
    let spoken = `Today, ${todayAdded.length} new products were added: ${names}.`;
    if (lang === 'am') spoken = `ዛሬ ${todayAdded.length} አዳዲስ መድኃኒቶች ተመዝግበዋል: ${names}።`;
    if (lang === 'om') spoken = `Har'a qorichootni haaraa ${todayAdded.length} galmaa'aniiru: ${names}.`;

    const display = `✨ **Products Registered Today (${todayStr})**\n` +
      todayAdded.map((m, idx) => `${idx + 1}. **${m.name}** — Category: ${m.category || 'General'} | Price: ${m.price} ETB`).join('\n');

    return {
      action: 'inventory_report',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: { count: todayAdded.length, products: todayAdded }
    };
  }

  return null;
}

/**
 * Branch & Stock Transfer Processing
 */
function checkBranchAndTransferIntent(
  text: string, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  currentBranchId: string, 
  role: string,
  currentBranch: Branch
): VoiceAssistantResponse | null {
  const lower = text.toLowerCase();

  // 1. "Check [Product] availability in all branches" / "Check stock of Augmentin in branch two" / "damee hunda keessatti"
  if (lower.includes('all branches') || lower.includes('branch two') || lower.includes('branch 2') || lower.includes('branch three') || lower.includes('branch 3') || lower.includes('በሁሉም ቅርንጫፎች') || lower.includes('ቅርንጫፍ ሁለት') || lower.includes('damee hunda') || lower.includes('damee 2') || lower.includes('damee lama')) {
    const medMatch = findMedicineInText(text, db.medicines);
    if (medMatch) {
      const branchBreakdown = db.branches.map(b => {
        const stockItems = db.stockItems.filter(st => st.medicineId === medMatch.id && st.branchId === b.id && !st.isDamaged);
        const qty = stockItems.reduce((sum, st) => sum + (st.quantity || 0), 0);
        return {
          branchName: b.name,
          quantity: qty,
          code: b.code
        };
      });

      const totalAcrossAll = branchBreakdown.reduce((sum, b) => sum + b.quantity, 0);

      let spoken = `${medMatch.name} has a total of ${totalAcrossAll} units across all branches. ${branchBreakdown.map(b => `${b.branchName}: ${b.quantity}`).join(', ')}.`;
      if (lang === 'am') {
        spoken = `${medMatch.name} በሁሉም ቅርንጫፎች በድምሩ ${totalAcrossAll} ፍሬዎች ይገኛሉ።`;
      } else if (lang === 'om') {
        spoken = `${medMatch.name} dameewwan hunda keessatti waliigala unitiin ${totalAcrossAll} jira.`;
      }

      const display = `🏥 **Multi-Branch Stock Availability: ${medMatch.name}**\n* **Total System-Wide Stock**: **${totalAcrossAll} ${medMatch.unit || 'units'}**\n\n` +
        branchBreakdown.map(b => `* **${b.branchName}** (${b.code}): **${b.quantity} ${medMatch.unit || 'units'}**`).join('\n');

      return {
        action: 'branch_stock',
        spokenText: spoken,
        displayText: display,
        language: lang,
        data: { medicine: medMatch.name, total: totalAcrossAll, branches: branchBreakdown }
      };
    }
  }

  // 2. "Transfer [qty] [Product] to branch two" / "ትራንስፈር አድርግ" / "dabarsi"
  if (lower.startsWith('transfer ') || lower.includes('transfer ') || lower.includes('አዛውር') || lower.includes('ትራንስፈር') || lower.includes('dabarsi') || lower.includes('jijjiirraa')) {
    // Check permission: Cashiers cannot transfer stock
    if (role === 'cashier' || role === 'customer') {
      const deniedSpoken = lang === 'am'
        ? 'ይቅርታ፣ የመድኃኒት ዝውውር ለማድረግ የማኔጀር ወይም የአስተዳዳሪ ፈቃድ ያስፈልጋል።'
        : (lang === 'om' ? 'Dhiifama, jijjiirraa qorichaa raawwachuuf hayyama Manajeraa barbaachisa.' : 'Stock transfers require Manager or Admin authorization.');

      return {
        action: 'permission_denied',
        spokenText: deniedSpoken,
        displayText: '🔒 **Permission Denied**: Stock transfers require **Manager** or **Admin** privileges.',
        language: lang
      };
    }

    const parsed = extractProductAndQuantity(text, db, currentBranchId);
    if (parsed) {
      const { medicine, quantity, stockItem } = parsed;
      
      // Determine target branch
      let targetBranch = db.branches.find(b => b.id !== currentBranchId);
      if (lower.includes('branch two') || lower.includes('branch 2') || lower.includes('ቅርንጫፍ ሁለት') || lower.includes('damee 2') || lower.includes('b2')) {
        targetBranch = db.branches.find(b => b.id === 'b2') || targetBranch;
      } else if (lower.includes('branch three') || lower.includes('branch 3') || lower.includes('ቅርንጫፍ ሦስት') || lower.includes('damee 3') || lower.includes('b3')) {
        targetBranch = db.branches.find(b => b.id === 'b3') || targetBranch;
      }

      if (!targetBranch) {
        return {
          action: 'error',
          spokenText: 'Target branch not found.',
          displayText: 'Target branch not found.',
          language: lang
        };
      }

      if (!stockItem || stockItem.quantity < quantity) {
        let lowSpoken = `Insufficient stock in ${currentBranch.name}. Available is only ${stockItem ? stockItem.quantity : 0} units.`;
        if (lang === 'am') {
          lowSpoken = `በቂ ${medicine.name} በ${currentBranch.name} ውስጥ የለም። ያለው መጠን ${stockItem ? stockItem.quantity : 0} ብቻ ነው።`;
        } else if (lang === 'om') {
          lowSpoken = `${currentBranch.name} keessatti ${medicine.name} gahaan hin jiru. Kan jiru unitiin ${stockItem ? stockItem.quantity : 0} qofa.`;
        }

        return {
          action: 'error',
          spokenText: lowSpoken,
          displayText: `⚠️ **Insufficient Stock**: Only **${stockItem ? stockItem.quantity : 0}** units available to transfer.`,
          language: lang
        };
      }

      let spoken = `Transfer ${quantity} ${medicine.name} from ${currentBranch.name} to ${targetBranch.name}. Do you want to proceed with this stock transfer?`;
      if (lang === 'am') {
        spoken = `${quantity} ${medicine.name} ከ${currentBranch.name} ወደ ${targetBranch.name} ለማዛወር ይፈልጋሉ?`;
      } else if (lang === 'om') {
        spoken = `${medicine.name} ${quantity} ${currentBranch.name} irraa gara ${targetBranch.name}tti dabarsuu barbaadduu?`;
      }

      const display = `🔄 **Confirm Stock Transfer**\n* **Medicine**: **${medicine.name}**\n* **Quantity**: **${quantity} ${medicine.unit || 'units'}**\n* **From**: ${currentBranch.name}\n* **To**: **${targetBranch.name}**\n\nSay **"Yes, proceed"** to confirm transfer.`;

      return {
        action: 'transfer_confirm',
        spokenText: spoken,
        displayText: display,
        language: lang,
        requiresConfirmation: true,
        confirmationPrompt: spoken,
        pendingActionPayload: {
          actionType: 'transfer_stock',
          payload: {
            sourceBranchId: currentBranchId,
            targetBranchId: targetBranch.id,
            medicineId: medicine.id,
            medicineName: medicine.name,
            quantity: quantity,
            stockItemId: stockItem.id
          }
        }
      };
    }
  }

  return null;
}

/**
 * Product Search Intent
 */
function checkProductSearchIntent(
  text: string, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  branchId: string
): VoiceAssistantResponse | null {
  const lower = text.toLowerCase();

  // Queries like: "Do you have Panadol?", "Search for Amoxicillin 500mg", "Show me cosmetics", "Find products containing Paracetamol", "How many Panadol are available?", "What is the price of Augmentin?"
  const isSearchQuery = (
    lower.startsWith('do you have ') ||
    lower.startsWith('search ') ||
    lower.startsWith('search for ') ||
    lower.startsWith('find ') ||
    lower.startsWith('show me ') ||
    lower.startsWith('how many ') ||
    lower.startsWith('what is the price of ') ||
    lower.startsWith('price of ') ||
    lower.includes('አለዎት') ||
    lower.includes('ፈልግ') ||
    lower.includes('ዋጋው ስንት ነው') ||
    lower.includes('ስንት አለ') ||
    lower.includes('jiraa') ||
    lower.includes('barbaadi') ||
    lower.includes('gatiin meeqa') ||
    lower.includes('meeqatu jira')
  );

  // If looking for category (e.g. "Show me cosmetics")
  if (lower.includes('cosmetics') || lower.includes('ኮስሞቲክስ') || lower.includes('koosmeetiksii')) {
    const cosmetics = db.medicines.filter(m => m.category?.toLowerCase() === 'cosmetics');
    const displayList = cosmetics.slice(0, 6).map((c, idx) => {
      const stock = db.stockItems.filter(st => st.medicineId === c.id && (st.branchId === branchId || st.branchId === 'all' || !st.branchId));
      const qty = stock.reduce((sum, st) => sum + (st.quantity || 0), 0);
      return `${idx + 1}. **${c.name}** — ${qty} in stock @ **${c.price} ETB**`;
    }).join('\n');

    let spoken = `Found ${cosmetics.length} cosmetic products in stock. Top items include ${cosmetics.slice(0, 3).map(c => c.name).join(', ')}.`;
    if (lang === 'am') {
      spoken = `${cosmetics.length} የኮስሞቲክስ ምርቶች ተገኝተዋል።`;
    } else if (lang === 'om') {
      spoken = `Oomishaaleen koosmeetiksii ${cosmetics.length} kuusaa keessatti argamaniiru.`;
    }

    return {
      action: 'search_result',
      spokenText: spoken,
      displayText: `💄 **Cosmetics Catalog** (${cosmetics.length} total items)\n\n${displayList}`,
      language: lang,
      data: { products: cosmetics }
    };
  }

  // Look for generic ingredient search (e.g., "Find products containing Paracetamol")
  if (lower.includes('containing ') || lower.includes('generic ') || lower.includes('ያለበት') || lower.includes('kan qabu')) {
    const ingredient = lower.replace(/.*containing\s+/i, '').replace(/.*generic\s+/i, '').replace(/.*ያለበት\s+/i, '').replace(/.*kan qabu\s+/i, '').trim();
    if (ingredient.length >= 3) {
      const matchingMeds = db.medicines.filter(m => 
        (m.genericName && m.genericName.toLowerCase().includes(ingredient)) ||
        (m.description && m.description.toLowerCase().includes(ingredient)) ||
        (m.name && m.name.toLowerCase().includes(ingredient))
      );

      if (matchingMeds.length > 0) {
        let spoken = `Found ${matchingMeds.length} products containing ${ingredient}: ${matchingMeds.map(m => m.name).join(', ')}.`;
        if (lang === 'am') {
          spoken = `${ingredient} የያዙ ${matchingMeds.length} መድኃኒቶች ተገኝተዋል: ${matchingMeds.map(m => m.name).join(', ')}።`;
        } else if (lang === 'om') {
          spoken = `Qorichootni ${ingredient} qaban ${matchingMeds.length} argamaniiru: ${matchingMeds.map(m => m.name).join(', ')}.`;
        }

        const display = `🧪 **Products Containing "${ingredient}"**\n\n` +
          matchingMeds.map((m, idx) => {
            const stock = db.stockItems.filter(st => st.medicineId === m.id && (st.branchId === branchId || st.branchId === 'all' || !st.branchId));
            const qty = stock.reduce((sum, st) => sum + (st.quantity || 0), 0);
            return `${idx + 1}. **${m.name}** (${m.genericName || 'Generic'}) — Stock: **${qty} ${m.unit || 'units'}** | Price: **${m.price} ETB**`;
          }).join('\n');

        return {
          action: 'search_result',
          spokenText: spoken,
          displayText: display,
          language: lang,
          data: { products: matchingMeds }
        };
      }
    }
  }

  // Search specific medicine name
  const medMatch = findMedicineInText(text, db.medicines);
  if (medMatch) {
    const branchStock = db.stockItems.filter(st => st.medicineId === medMatch.id && (st.branchId === branchId || st.branchId === 'all' || !st.branchId) && !st.isDamaged);
    const availableQty = branchStock.reduce((sum, st) => sum + (st.quantity || 0), 0);
    const price = medMatch.price || (branchStock[0]?.sellingPrice) || 0;
    const unit = medMatch.unit || 'tablet';
    const primaryBatch = branchStock[0];

    let spoken = '';
    if (availableQty > 0) {
      if (lang === 'am') {
        spoken = `አዎ። ${medMatch.name} ይገኛል። በክምችት ${availableQty} ${unit}ዎች ያሉ ሲሆን፣ የመሸጫ ዋጋው በአንድ ${unit} ${price} የኢትዮጵያ ብር ነው።`;
      } else if (lang === 'om') {
        spoken = `Eeyyee, ${medMatch.name} ni jira. Kuusaa keessa ${availableQty} ${unit} tu jira, gatiin gurgurtaa tokko Qarshii ${price} dha.`;
      } else {
        spoken = `Yes. ${medMatch.name} is available. There are ${availableQty} ${unit}s in stock, and the selling price is ${price} Ethiopian Birr per ${unit}.`;
      }
    } else {
      if (lang === 'am') {
        spoken = `ይቅርታ፣ ${medMatch.name} በአሁኑ ወቅት በክምችት አልቋል።`;
      } else if (lang === 'om') {
        spoken = `Dhiifama, ${medMatch.name} yeroo ammaa damee kana keessatti dhumateera.`;
      } else {
        spoken = `Sorry, ${medMatch.name} is currently out of stock in this branch.`;
      }
    }

    const display = `💊 **${medMatch.name}**\n` +
      `* **Generic Name**: ${medMatch.genericName || 'N/A'}\n` +
      `* **Category / Subcategory**: ${medMatch.category || 'General'} ${medMatch.subCategory ? `(${medMatch.subCategory})` : ''}\n` +
      `* **Available Quantity**: **${availableQty} ${unit}s** in branch\n` +
      `* **Selling Price**: **${price} ETB** per ${unit}\n` +
      (primaryBatch ? `* **Batch Number**: ${primaryBatch.batchNumber || 'N/A'} | Expiry: ${primaryBatch.expiryDate || 'N/A'}\n` : '') +
      `* **Dosage Form**: ${medMatch.dosageForm || 'Standard'}`;

    return {
      action: 'product_detail',
      spokenText: spoken,
      displayText: display,
      language: lang,
      data: {
        medicine: medMatch,
        availableQty,
        price,
        batches: branchStock
      }
    };
  }

  return null;
}

/**
 * Customer Inquiry & Safety Assistant
 */
async function handleCustomerInquiry(
  text: string, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  branch: Branch
): Promise<VoiceAssistantResponse> {
  const lower = text.toLowerCase();

  // 1. Safety Check: Immediate Emergency Symptoms Escalation
  if (
    lower.includes('chest pain') ||
    lower.includes('heart attack') ||
    lower.includes('cannot breathe') ||
    lower.includes('difficulty breathing') ||
    lower.includes('severe bleeding') ||
    lower.includes('poison') ||
    lower.includes('anaphylaxis') ||
    lower.includes('የደረት ሕመም') ||
    lower.includes('መተንፈስ አቃተኝ') ||
    lower.includes('ከባድ ደም መፍሰስ') ||
    lower.includes('dhukkuba qomaa') ||
    lower.includes('hafuura baafachuu') ||
    lower.includes('dhiigni dhangala\'uu')
  ) {
    let spoken = 'Emergency Warning: This appears to be a potentially life-threatening medical emergency. Please call local emergency medical services or proceed to the nearest emergency room immediately!';
    if (lang === 'am') {
      spoken = 'አስቸኳይ ማስጠንቀቂያ: ይህ ለሕይወት አስጊ ድንገተኛ የሕክምና ሁኔታ ሊሆን ይችላል። እባክዎ በአስቸኳይ ወደ ቅርብ ሆስፒታል ይሂዱ ወይም 907 የድንገተኛ አደጋ ጥሪ ያድርጉ!';
    } else if (lang === 'om') {
      spoken = 'Akeekkachiisa Hatattamaa: Kun balaa lubbuu ta\'uu danda\'a. Mee hatattamaan hospitaala dhiyoo jiru dhaqaa yookaan bilbila balaa hatattamaa 907 bilbilaa!';
    }

    const display = `🚨 **EMERGENCY MEDICAL WARNING**\n\n` +
      `This appears to be a severe or life-threatening symptom. **Do not wait.**\n\n` +
      `* **Immediate Action**: Contact emergency medical services immediately or visit the nearest hospital emergency room.\n` +
      `* **Emergency Hotline (Ethiopia)**: **907** / **911**\n` +
      `* **Safety Protocol**: The AI Voice Assistant does not diagnose or manage acute medical emergencies.`;

    return {
      action: 'customer_consultation',
      spokenText: spoken,
      displayText: display,
      language: lang
    };
  }

  // 2. Delivery & Services Questions
  if (lower.includes('deliver') || lower.includes('delivery') || lower.includes('ማድረስ') || lower.includes('ዴሊቨሪ') || lower.includes('geessuu')) {
    let spoken = `Yes, Sonan Pharmacy offers fast door-to-door delivery throughout Addis Ababa. You can place your order online through our customer store.`;
    if (lang === 'am') {
      spoken = `አዎ፣ ሶናን ፋርማሲ በአዲስ አበባ እና በአቅራቢያው ባሉ አካባቢዎች ፈጣን የማድረስ (Delivery) አገልግሎት ይሰጣል። በድረ-ገጻችን ላይ በቀጥታ ማዘዝ ይችላሉ።`;
    } else if (lang === 'om') {
      spoken = `Eeyyee, Faarmaasiin Sonaan Finfinnee fi naannoo isheetti tajaajila dhiheessii ariifataa (Delivery) kenna. Sararaarraan ajajuu dandeessu.`;
    }

    return {
      action: 'customer_consultation',
      spokenText: spoken,
      displayText: `🚚 **Pharmacy Delivery Service**\n* Delivery available across Addis Ababa within 1–3 hours.\n* Free delivery for orders above 1,000 ETB.\n* Call hotline or order directly online.`,
      language: lang
    };
  }

  // 3. Fallback to Gemini 3.7 Flash with Strict Clinical Pharmacy Guardrails
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Offline customer search
    const searchRes = checkProductSearchIntent(text, db, lang, branch.id);
    if (searchRes) return searchRes;

    let defSpoken = 'Welcome to Sonan Pharmacy. For clinical advice and prescription medicines, please consult our licensed pharmacist.';
    if (lang === 'am') defSpoken = 'እንኳን ወደ ሶናን ፋርማሲ በደህና መጡ። ለተጨማሪ የሕክምና ምክክር እባክዎ ፋርማሲስታችንን ያነጋግሩ።';
    if (lang === 'om') defSpoken = 'Baga gara Faarmaasii Sonaan nagaan dhuftan. Gorsa yaalaaf ogeessa faarmaasii keenya mariisisaa.';

    return {
      action: 'customer_consultation',
      spokenText: defSpoken,
      displayText: `🏥 **Sonan Pharmacy Patient Helpdesk**\nPlease speak with our on-duty pharmacist for personalized healthcare recommendations.`,
      language: lang
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    // Provide simplified product catalog to Gemini so it only answers with real DB items
    const catalogSummary = db.medicines.slice(0, 60).map(m => {
      const stock = db.stockItems.filter(st => st.medicineId === m.id && (st.branchId === branch.id || st.branchId === 'all' || !st.branchId));
      const qty = stock.reduce((sum, st) => sum + (st.quantity || 0), 0);
      return {
        name: m.name,
        generic: m.genericName,
        category: m.category,
        price: m.price,
        stock: qty,
        unit: m.unit
      };
    });

    const langName = lang === 'am' ? 'Amharic (አማርኛ)' : (lang === 'om' ? 'Afaan Oromoo' : 'English');

    const systemInstruction = `You are the AI Pharmacy Customer Assistant for Sonan Pharmacy (Addis Ababa, Ethiopia).
Your goal is to answer customer questions politely, accurately, and safely.

MANDATORY LANGUAGE RULE:
- The user has selected the language: ${langName}.
- You MUST write BOTH "spokenText" AND "displayText" ENTIRELY in ${langName}.
- If the language is Amharic (አማርኛ), write ALL explanations, titles, bullet points, and spoken responses in genuine Amharic script (ፊደል). Do NOT reply in English.
- If the language is Afaan Oromoo, write ALL explanations and spoken responses in Afaan Oromoo.
- Even if the customer typed in English or mixed terms, your response MUST be in ${langName}.

CRITICAL MEDICAL SAFETY BOUNDARIES:
1. NEVER diagnose diseases or medical conditions.
2. NEVER prescribe prescription medicines (antibiotics, controlled substances, systemic steroids).
3. NEVER recommend dangerous dosages.
4. NEVER advise customers to discontinue prescribed therapies.
5. ALWAYS encourage customers to consult a licensed pharmacist or physician for diagnosis.
6. For product availability and prices, ONLY reference items that exist in the provided LIVE DATABASE CATALOG. Never invent or hallucinate products or prices.

LIVE DATABASE CATALOG:
${JSON.stringify(catalogSummary)}`;

    const prompt = `Customer inquiry: "${text}".
Please return a JSON object with:
- "spokenText": concise natural response to be spoken aloud (max 2 sentences) ENTIRELY in ${langName}.
- "displayText": formatted markdown text for screen display with safety advice disclaimer written ENTIRELY in ${langName}.
- "suggestedProducts": array of product names from live database that match.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            spokenText: { type: Type.STRING },
            displayText: { type: Type.STRING },
            suggestedProducts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['spokenText', 'displayText']
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');

    let fallbackSp = 'Please consult our licensed pharmacist for medical guidance.';
    if (lang === 'am') fallbackSp = 'ስለጤናዎ ተጨማሪ ምክር ለማግኘት እባክዎ ፋርማሲስታችንን ያማክሩ።';
    if (lang === 'om') fallbackSp = 'Gorsa yaalaaf ogeessa faarmaasii keenya mariisisaa.';

    let fallbackDisp = '🏥 **Sonan Pharmacy Patient Helpdesk**\nPlease speak with our on-duty pharmacist for personalized healthcare recommendations.';
    if (lang === 'am') fallbackDisp = '🏥 **የሶናን ፋርማሲ ታካሚ መረጃ**\nለተጨማሪ የሕክምና ምክክር እና መመሪያ እባክዎ በስራ ላይ ያሉትን ፋርማሲስታችንን ያነጋግሩ።';
    if (lang === 'om') fallbackDisp = '🏥 **Gorsa Fayyaa Faarmaasii Sonaan**\nGorsa dhuunfaa fi qorichaa argachuuf ogeessa faarmaasii keenya mariisisaa.';

    return {
      action: 'customer_consultation',
      spokenText: parsed.spokenText || fallbackSp,
      displayText: parsed.displayText || fallbackDisp,
      language: lang,
      data: { suggestedProducts: parsed.suggestedProducts || [] }
    };
  } catch (err: any) {
    console.error('Gemini Customer Consultation Error:', err);
    let errSp = 'Could not process request at this moment. Please speak directly with our pharmacist.';
    let errDisp = '🏥 **Patient Consultation**: Please speak directly with our pharmacist.';
    if (lang === 'am') {
      errSp = 'ይቅርታ፣ ጥያቄዎን ለማስተናገድ አልተቻለም። እባክዎ ፋርማሲስታችንን በቀጥታ ያነጋግሩ።';
      errDisp = '🏥 **የፋርማሲ ምክክር**: እባክዎ በስራ ላይ ያሉትን ፋርማሲስታችንን በቀጥታ ያነጋግሩ።';
    }
    if (lang === 'om') {
      errSp = 'Dhiifama, yeroo ammaa gaaffii keessan adeemsisuun hin danda\'amne. Ogeessa faarmaasii haasofsiisaa.';
      errDisp = '🏥 **Gorsa Faarmaasii**: Mee ogeessa faarmaasii keenya kallattiin haasofsiisaa.';
    }

    return {
      action: 'customer_consultation',
      spokenText: errSp,
      displayText: errDisp,
      language: lang
    };
  }
}

/**
 * Handle complex Staff voice commands with Gemini 3.7 Flash
 */
async function handleGeminiVoiceAssistant(
  req: VoiceAssistantRequest,
  db: DbSchema,
  lang: 'en' | 'am' | 'om',
  branch: Branch,
  role: string
): Promise<VoiceAssistantResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    let defSpoken = 'I did not catch that command. Try asking for product availability, POS actions, or daily sales.';
    let defDisplay = 'Please try commands such as *"Do you have Panadol?"*, *"Show today\'s sales"*, *"Add 2 to sale"*, or *"Check low-stock"*.';
    
    if (lang === 'am') {
      defSpoken = 'ይቅርታ፣ ትዕዛዝዎን አልተረዳሁትም። እባክዎ እንደ "ፓናዶል አለ?" ወይም "የዛሬ ሽያጭ" ያሉ ትዕዛዞችን ይጠቀሙ።';
      defDisplay = 'እባክዎ ትዕዛዝዎን በግልጽ ይናገሩ (ለምሳሌ: *"ፓናዶል አለ?"*, *"የዛሬ ሽያጭ"*, *"መድኃኒት ወደ ሽያጭ ጨምር"*).';
    } else if (lang === 'om') {
      defSpoken = 'Dhiifama, ajaja keessan hin hubanne. Mee qoricha barbaaduu, gurgurtaa POS, yookaan gurgurtaa har\'aa gaafadhaa.';
      defDisplay = 'Mee ajaja ifaa dubbadhaa (fkn: *"Panadool qabduu?"*, *"Gurgurtaa har\'aa"*, *"Panadool 2 gara gurgurtaatti dabali"*).';
    }

    return {
      action: 'general_info',
      spokenText: defSpoken,
      displayText: defDisplay,
      language: lang
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const productsCatalog = db.medicines.slice(0, 50).map(m => ({
      id: m.id,
      name: m.name,
      generic: m.genericName,
      category: m.category,
      price: m.price,
      unit: m.unit
    }));

    const langName = lang === 'am' ? 'Amharic (አማርኛ)' : (lang === 'om' ? 'Afaan Oromoo' : 'English');

    const systemInstruction = `You are the AI Voice Copilot for Sonan Pharmacy ERP (${branch.name}).
You assist staff with product queries, POS transactions, inventory checks, financial overviews, and system navigation.
User role: ${role}. Selected Language: ${langName}.

MANDATORY LANGUAGE RULE:
- The user has selected the language: ${langName}.
- You MUST write BOTH "spokenText" AND "displayText" ENTIRELY in ${langName}.
- If the language is Amharic (አማርኛ), write ALL explanations, titles, bullet points, numbers/prices context, and spoken responses in genuine Amharic script (ፊደል). Do NOT reply in English.
- If the language is Afaan Oromoo, write ALL explanations, status, and spoken responses in Afaan Oromoo.
- Even if the staff member typed or spoke in English or shorthand terms (e.g. "check paracetamol"), your response MUST be in ${langName}.

STRICT RULES:
1. NEVER hallucinate stock, prices, or inventory quantities.
2. If the user asks to add or manipulate POS items, return action 'pos_add' with structured item info.
3. If the user is a cashier, reject queries for confidential net profit or admin configuration.
4. Spoken text MUST be short, professional, and clear in ${langName}.
5. Format display text with readable markdown in ${langName}.

PHARMACY DATABASE EXCERPT:
${JSON.stringify(productsCatalog)}`;

    const prompt = `Staff voice command: "${req.text}".
Context: Active Cart has ${req.currentCart?.length || 0} items.
Return a structured JSON with:
- "action": string ('search_result' | 'pos_add' | 'inventory_report' | 'financial_report' | 'general_info')
- "spokenText": concise text to be spoken out loud ENTIRELY in ${langName}
- "displayText": markdown formatted text for the UI written ENTIRELY in ${langName}
- "data": optional extracted entity payload`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING },
            spokenText: { type: Type.STRING },
            displayText: { type: Type.STRING }
          },
          required: ['action', 'spokenText', 'displayText']
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');

    return {
      action: (parsed.action as any) || 'general_info',
      spokenText: parsed.spokenText || (lang === 'am' ? 'ትዕዛዙ ተፈጽሟል።' : (lang === 'om' ? 'Ajajni raawwatameera.' : 'Command processed.')),
      displayText: parsed.displayText || parsed.spokenText,
      language: lang
    };
  } catch (err: any) {
    console.error('Gemini Voice Assistant Error:', err);
    // Graceful intelligent fallback without crashing
    const searchMatch = findMedicineInText(req.text, db.medicines);
    if (searchMatch) {
      const branchStock = db.stockItems.filter(st => st.medicineId === searchMatch.id && (st.branchId === branch.id || st.branchId === 'all' || !st.branchId));
      const qty = branchStock.reduce((sum, st) => sum + (st.quantity || 0), 0);
      const price = searchMatch.price || (branchStock[0]?.sellingPrice) || 0;
      
      let spoken = `${searchMatch.name} has ${qty} units in stock priced at ${price} Ethiopian Birr.`;
      let disp = `💊 **${searchMatch.name}**\n* Category: ${searchMatch.category || 'General'}\n* In-Stock: **${qty} ${searchMatch.unit || 'units'}**\n* Price: **${price} ETB**`;
      
      if (lang === 'am') {
        spoken = `${searchMatch.name} በክምችት ${qty} ፍሬዎች ያሉ ሲሆን፣ ዋጋው ${price} የኢትዮጵያ ብር ነው።`;
        disp = `💊 **${searchMatch.name}**\n* ምድብ: ${searchMatch.category || 'አጠቃላይ'}\n* ያለ ክምችት: **${qty} ${searchMatch.unit || 'ፍሬ'}**\n* የመሸጫ ዋጋ: **${price} ብር**`;
      } else if (lang === 'om') {
        spoken = `${searchMatch.name} kuusaa keessatti unitiin ${qty} kan jiru yoo ta'u, gatiin isaa Qarshii ${price} dha.`;
        disp = `💊 **${searchMatch.name}**\n* Garee: ${searchMatch.category || 'Waliigala'}\n* Hanga Kuusaa: **${qty} ${searchMatch.unit || 'unitii'}**\n* Gatii: **${price} ETB**`;
      }

      return {
        action: 'search_result',
        spokenText: spoken,
        displayText: disp,
        language: lang,
        data: { medicine: searchMatch, availableQty: qty, price }
      };
    }

    let fallbackSpoken = 'Command received. You can ask for drug availability, POS actions, daily sales, or stock transfers.';
    let fallbackDisplay = '💡 **AI Voice Copilot**\nTry asking: *"Do you have Panadol?"*, *"What are today\'s sales and profit?"*, or *"Add 2 Panadol to sale"*.';

    if (lang === 'am') {
      fallbackSpoken = 'ትዕዛዝዎ ተቀብሏል። እባክዎ እንደ "ፓናዶል አለ?"፣ "የዛሬ ሽያጭ" ወይም "መድኃኒት ወደ ሽያጭ ጨምር" ያሉ ትዕዛዞችን ይናገሩ።';
      fallbackDisplay = '💡 **ትዕዛዝ ተቀብሏል**\nእንደ *"ፓናዶል አለ?"*፣ *"የዛሬ ሽያጭ ስንት ነው?"*፣ ወይም *"2 ፓናዶል ወደ ሽያጭ ጨምር"* ያሉ ትዕዛዞችን በድምፅ ወይም በጽሁፍ ይጠቀሙ።';
    } else if (lang === 'om') {
      fallbackSpoken = 'Ajajni keessan dhiyaateera. Argama qorichaa, ajaja gurgurtaa, ykn gurgurtaa har\'aa gaafachuu dandeessu.';
      fallbackDisplay = '💡 **AI Voice Copilot**\nMee akkana jedhaa: *"Panadool qabduu?"*, *"Gurgurtaa fi bu\'aan har\'aa meeqa?"*, yookaan *"Panadool 2 gara gurgurtaatti dabali"*.';
    }

    return {
      action: 'general_info',
      spokenText: fallbackSpoken,
      displayText: fallbackDisplay,
      language: lang
    };
  }
}

/**
 * Execute POS Sale Transaction
 */
function executePosSale(
  payload: any, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  userId?: string, 
  userName?: string
): VoiceAssistantResponse {
  const { branchId, items, vatPercent, discount, total } = payload;
  const branch = db.branches.find(b => b.id === branchId) || db.branches[0];
  const cashier = db.users.find(u => u.id === userId) || db.users[0];

  const branchSales = db.sales.filter(s => s.branchId === branch.id);
  const maxSerial = branchSales.reduce((max, s) => (s.serialNumber || 0) > max ? (s.serialNumber || 0) : max, 0);
  const serialNumber = maxSerial + 1;
  const branchPrefix = (branch.code || branch.id).toUpperCase().replace(/\s+/g, '-');
  const invoiceNumber = `REC-${branchPrefix}-${serialNumber}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const saleItems: SaleItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const med = db.medicines.find(m => m.id === item.medicineId);
    let stockItem = db.stockItems.find(st => st.id === item.batchId) || db.stockItems.find(st => st.medicineId === item.medicineId && st.quantity >= item.quantity);

    if (stockItem) {
      stockItem.quantity = Math.max(0, stockItem.quantity - item.quantity);
      if (stockItem.dispensaryQuantity !== undefined && stockItem.dispensaryQuantity > 0) {
        stockItem.dispensaryQuantity = Math.max(0, stockItem.dispensaryQuantity - item.quantity);
      }
    }

    const itemSubtotal = item.unitPrice * item.quantity;
    subtotal += itemSubtotal;

    saleItems.push({
      id: generateId('item'),
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: 0,
      vatAmount: 0,
      total: itemSubtotal,
      batchNumber: stockItem?.batchNumber || 'DEFAULT',
      expiryDate: stockItem?.expiryDate || ''
    });
  }

  const finalTotal = total || subtotal;

  const saleRecord: Sale = {
    id: generateId('sale'),
    invoiceNumber,
    serialNumber,
    branchId: branch.id,
    branchName: branch.name,
    cashierId: cashier.id,
    cashierName: userName || cashier.name,
    customerName: 'Walk-In Customer (Voice Sale)',
    date: todayStr,
    time: nowTime,
    items: saleItems,
    subtotal: subtotal,
    discount: discount || 0,
    vatPercent: vatPercent || 0,
    vat: 0,
    total: finalTotal,
    paymentMethod: 'Cash',
    status: 'Completed'
  };

  db.sales.unshift(saleRecord);

  // Add audit trail log
  const auditEntry: AuditLog = {
    id: generateId('log'),
    date: todayStr,
    time: nowTime,
    userId: cashier.id,
    username: userName || cashier.name,
    role: 'Cashier',
    action: 'VOICE_POS_SALE_COMPLETED',
    branchId: branch.id,
    branchName: branch.name,
    ipAddress: '127.0.0.1',
    details: `Voice Assistant completed sale #${invoiceNumber} for ${finalTotal} ETB (${saleItems.length} items)`
  };
  db.auditLogs.unshift(auditEntry);
  logToAuditTrail(`Voice Assistant completed sale #${invoiceNumber} for ${finalTotal} ETB.`);

  saveDb(db);

  const formattedTotal = finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
  let spoken = `Sale completed successfully. Invoice number is ${invoiceNumber}. Total received is ${formattedTotal} Ethiopian Birr.`;
  if (lang === 'am') {
    spoken = `ሽያጩ በተሳካ ሁኔታ ተጠናቋል። ደረሰኝ ቁጥር ${invoiceNumber}። አጠቃላይ ድምር ${formattedTotal} የኢትዮጵያ ብር።`;
  } else if (lang === 'om') {
    spoken = `Gurgurtaan milkaa'inaan xumurameera. Lakkoofsi nagahee ${invoiceNumber}. Ida'amni Qarshii ${formattedTotal} dha.`;
  }

  const display = `🎉 **Sale Completed Successfully!**\n\n` +
    `* **Invoice Number**: \`${invoiceNumber}\`\n` +
    `* **Grand Total**: **${formattedTotal} ETB**\n` +
    `* **Items Count**: ${saleItems.length}\n` +
    `* **Branch**: ${branch.name}\n` +
    `* **Cashier**: ${userName || cashier.name}\n` +
    `* **Inventory**: Stock deducted and bin cards updated in real time.`;

  return {
    action: 'pos_execute_sale',
    spokenText: spoken,
    displayText: display,
    language: lang,
    executionSuccess: true,
    updatedCart: [],
    data: { sale: saleRecord }
  };
}

/**
 * Execute Stock Transfer
 */
function executeStockTransfer(
  payload: any, 
  db: DbSchema, 
  lang: 'en' | 'am' | 'om', 
  userId?: string, 
  userName?: string,
  role?: string
): VoiceAssistantResponse {
  const { sourceBranchId, targetBranchId, medicineId, quantity, stockItemId } = payload;
  const src = db.branches.find(b => b.id === sourceBranchId);
  const tgt = db.branches.find(b => b.id === targetBranchId);
  const med = db.medicines.find(m => m.id === medicineId);

  if (!src || !tgt || !med) {
    return {
      action: 'error',
      spokenText: 'Transfer parameters invalid.',
      displayText: 'Transfer parameters invalid.',
      language: lang
    };
  }

  const srcStock = db.stockItems.find(st => st.id === stockItemId) || db.stockItems.find(st => st.medicineId === medicineId && st.branchId === sourceBranchId);
  if (!srcStock || srcStock.quantity < quantity) {
    return {
      action: 'error',
      spokenText: 'Insufficient source stock.',
      displayText: 'Insufficient source stock.',
      language: lang
    };
  }

  // Deduct from source
  srcStock.quantity -= quantity;

  // Add to target
  let tgtStock = db.stockItems.find(st => st.medicineId === medicineId && st.branchId === targetBranchId && st.batchNumber === srcStock.batchNumber);
  if (tgtStock) {
    tgtStock.quantity += quantity;
  } else {
    tgtStock = {
      id: generateId('stk'),
      medicineId: medicineId,
      branchId: targetBranchId,
      batchNumber: srcStock.batchNumber || 'TRF-BATCH',
      quantity: quantity,
      expiryDate: srcStock.expiryDate || '2028-12-31',
      buyingPrice: srcStock.buyingPrice || med.price || 0,
      sellingPrice: srcStock.sellingPrice || med.price || 0,
      supplierId: srcStock.supplierId || 'sup_1',
      isDamaged: false
    };
    db.stockItems.push(tgtStock);
  }

  const transferRecord: StockTransfer = {
    id: generateId('trf'),
    transferNumber: `TRF-${Math.floor(100000 + Math.random() * 900000)}`,
    sourceBranchId,
    sourceBranchName: src.name,
    targetBranchId,
    targetBranchName: tgt.name,
    transferType: 'Internal',
    date: new Date().toISOString().split('T')[0],
    status: 'Completed',
    items: [{
      medicineId: med.id,
      medicineName: med.name,
      quantity: quantity,
      batchNumber: srcStock.batchNumber || 'TRF',
      expiryDate: srcStock.expiryDate || '2028-12-31'
    }],
    requestedBy: userName || 'Admin (Voice Assistant)',
    processedBy: userName || 'Admin (Voice Assistant)',
    notes: 'Executed via Voice Assistant'
  };

  if (!db.stockTransfers) db.stockTransfers = [];
  db.stockTransfers.unshift(transferRecord);

  // Audit log
  db.auditLogs.unshift({
    id: generateId('log'),
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    userId: userId || 'admin',
    username: userName || 'Admin (Voice Assistant)',
    role: 'Admin',
    action: 'VOICE_STOCK_TRANSFER',
    branchId: sourceBranchId,
    branchName: src.name,
    ipAddress: '127.0.0.1',
    details: `Voice Assistant transferred ${quantity}x ${med.name} from ${src.name} to ${tgt.name}`
  });

  saveDb(db);
  logToAuditTrail(`Voice Assistant transferred ${quantity}x ${med.name} from ${src.name} to ${tgt.name}`);

  let spoken = `Stock transfer of ${quantity} ${med.name} to ${tgt.name} completed successfully.`;
  if (lang === 'am') {
    spoken = `${quantity} ${med.name} ከ${src.name} ወደ ${tgt.name} በተሳካ ሁኔታ ተዛውሯል።`;
  } else if (lang === 'om') {
    spoken = `Jijjiirraan qoricha ${med.name} ${quantity} ${src.name} irraa gara ${tgt.name}tti milkaa'inaan raawwatameera.`;
  }

  const display = `📦 **Stock Transfer Completed**\n` +
    `* **Transfer Number**: \`${transferRecord.transferNumber}\`\n` +
    `* **Medicine**: **${med.name}**\n` +
    `* **Quantity**: **${quantity} ${med.unit || 'units'}**\n` +
    `* **From**: ${src.name} (Remaining: ${srcStock.quantity})\n` +
    `* **To**: ${tgt.name} (New Stock: ${tgtStock.quantity})`;

  return {
    action: 'transfer_execute',
    spokenText: spoken,
    displayText: display,
    language: lang,
    executionSuccess: true
  };
}

/**
 * Utility: Find medicine by name or generic in text
 */
function findMedicineInText(text: string, medicines: Medicine[]): Medicine | null {
  const lower = text.toLowerCase();
  
  // Sort medicines by name length descending so multi-word matches first (e.g. "Amoxicillin 500mg" before "Amoxicillin")
  const sorted = [...medicines].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

  for (const m of sorted) {
    if (!m.name) continue;
    const mName = m.name.toLowerCase();
    if (lower.includes(mName)) return m;

    // Check single word match (e.g. "Panadol" matching "Panadol Extra 500mg")
    const words = mName.split(/[\s-]+/).filter(w => w.length > 3);
    for (const w of words) {
      if (lower.includes(w)) return m;
    }

    // Check generic name
    if (m.genericName && m.genericName.length > 3) {
      const gName = m.genericName.toLowerCase();
      if (lower.includes(gName)) return m;
    }
  }

  // Common English brand / generic synonym aliases
  const brandAliases: Record<string, string[]> = {
    'panadol': ['panadol', 'paracetamol', 'acetaminophen'],
    'paracetamol': ['paracetamol', 'panadol', 'acetaminophen'],
    'augmentin': ['augmentin', 'amoxicillin / clavulanate', 'amoxicillin clavulanic', 'clavulanate'],
    'amoxicillin': ['amoxicillin', 'amoxil'],
    'amoxil': ['amoxil', 'amoxicillin'],
    'metformin': ['metformin', 'glucophage'],
    'glucophage': ['glucophage', 'metformin'],
    'cipro': ['cipro', 'ciprofloxacin'],
    'ciprofloxacin': ['ciprofloxacin', 'cipro'],
    'flagyl': ['flagyl', 'metronidazole'],
    'metronidazole': ['metronidazole', 'flagyl'],
    'zithromax': ['zithromax', 'azithromycin'],
    'azithromycin': ['azithromycin', 'zithromax'],
    'ibuprofen': ['ibuprofen', 'brufen', 'advil'],
    'advil': ['advil', 'ibuprofen', 'brufen'],
    'brufen': ['brufen', 'ibuprofen'],
    'voltaren': ['voltaren', 'diclofenac'],
    'diclofenac': ['diclofenac', 'voltaren'],
    'omeprazole': ['omeprazole', 'losec', 'prilosec'],
    'atorvastatin': ['atorvastatin', 'lipitor'],
    'lipitor': ['lipitor', 'atorvastatin']
  };

  for (const [aliasKey, synonyms] of Object.entries(brandAliases)) {
    if (lower.includes(aliasKey)) {
      for (const syn of synonyms) {
        const found = medicines.find(m => 
          m.name.toLowerCase().includes(syn) || 
          (m.genericName && m.genericName.toLowerCase().includes(syn)) ||
          (m.description && m.description.toLowerCase().includes(syn))
        );
        if (found) return found;
      }
    }
  }

  // Phonetic/Amharic transliteration common mappings
  const amharicMapping: Record<string, string[]> = {
    'ፓናዶል': ['paracetamol', 'panadol', 'acetaminophen'],
    'ፓራሲታሞል': ['paracetamol', 'panadol', 'acetaminophen'],
    'አሞክሲሲሊን': ['amoxicillin', 'amoxil'],
    'ኦግመንቲን': ['augmentin', 'amoxicillin'],
    'ሜትፎርሚን': ['metformin', 'glucophage'],
    'ሲፕሮፍሎክሳሲን': ['ciprofloxacin', 'cipro'],
    'ሲፕሮ': ['ciprofloxacin', 'cipro'],
    'አዚትሮማይሲን': ['azithromycin', 'zithromax'],
    'ሜትሮኒዳዞል': ['metronidazole', 'flagyl'],
    'ዶክሲሳይክሊን': ['doxycycline'],
    'ቫይታሚን': ['vitamin', 'supplement'],
    'ኢቡፕሮፌን': ['ibuprofen', 'brufen', 'advil'],
    'ኦሜፕራዞል': ['omeprazole', 'losec'],
    'ዲክሎፌናክ': ['diclofenac', 'voltaren'],
    'ሴፍትሪያክሶን': ['ceftriaxone'],
    'አስፕሪን': ['aspirin'],
    'አልኮሆል': ['alcohol', 'surgical spirit'],
    'ሳኒታይዘር': ['sanitizer'],
    'ጋውዝ': ['gauze', 'bandage'],
    'ፋሻ': ['bandage', 'gauze']
  };

  for (const [amText, enKeywords] of Object.entries(amharicMapping)) {
    if (lower.includes(amText)) {
      for (const enKeyword of enKeywords) {
        const found = medicines.find(m => 
          m.name.toLowerCase().includes(enKeyword) || 
          (m.genericName && m.genericName.toLowerCase().includes(enKeyword)) ||
          (m.description && m.description.toLowerCase().includes(enKeyword))
        );
        if (found) return found;
      }
    }
  }

  // Afaan Oromoo health & medicine keyword mappings
  const oromoMapping: Record<string, string[]> = {
    'qoricha mataa': ['paracetamol', 'panadol', 'ibuprofen', 'aspirin'],
    'qoricha garaa': ['omeprazole', 'antacid', 'metronidazole', 'cimetidine'],
    'qoricha qufaa': ['cough syrup', 'amoxicillin', 'azithromycin', 'dextromethorphan'],
    'qoricha utalloo': ['paracetamol', 'antihistamine', 'cetirizine', 'chlorpheniramine'],
    'panadool': ['paracetamol', 'panadol'],
    'parasiitaamool': ['paracetamol', 'panadol'],
    'amooksisiliin': ['amoxicillin', 'amoxil'],
    'ogmantiin': ['augmentin', 'amoxicillin'],
    'siiprooflooksaasiin': ['ciprofloxacin', 'cipro'],
    'siiproo': ['ciprofloxacin', 'cipro'],
    'ibaayibiroofeen': ['ibuprofen', 'brufen'],
    'omeepraazool': ['omeprazole'],
    'vaayitaaminii': ['vitamin', 'supplement'],
    'alkoolii': ['alcohol', 'surgical spirit'],
    'saanitaayizarii': ['sanitizer'],
    'faashaa': ['bandage', 'gauze'],
    'gaawzii': ['gauze', 'bandage']
  };

  for (const [omText, enKeywords] of Object.entries(oromoMapping)) {
    if (lower.includes(omText)) {
      for (const enKeyword of enKeywords) {
        const found = medicines.find(m => 
          m.name.toLowerCase().includes(enKeyword) || 
          (m.genericName && m.genericName.toLowerCase().includes(enKeyword)) ||
          (m.description && m.description.toLowerCase().includes(enKeyword))
        );
        if (found) return found;
      }
    }
  }

  return null;
}

/**
 * Utility: Extract product and quantity from voice text
 */
function extractProductAndQuantity(
  text: string, 
  db: DbSchema, 
  branchId: string
): { medicine: Medicine; quantity: number; stockItem: StockItem | null } | null {
  const medicine = findMedicineInText(text, db.medicines);
  if (!medicine) return null;

  // Extract quantity number or word
  const numMatch = text.match(/\b(\d+)\b/);
  let quantity = 1;
  if (numMatch) {
    quantity = parseInt(numMatch[1], 10);
  } else {
    const wordNumMatch = text.match(/(one|two|three|four|five|six|seven|eight|nine|ten|tokko|lama|sadii|afur|shan|ja\'a|jaa|torba|saddeet|sagal|kudhan|አንድ|ሁለት|ሦስት|አራት|አምስት|ስድስት|ሰባት|ስምንት|ዘጠኝ|አሥር)/i);
    if (wordNumMatch) {
      quantity = parseWordNumber(wordNumMatch[0]);
    }
  }

  // Find active stock in branch
  const stockItem = db.stockItems.find(st => st.medicineId === medicine.id && (st.branchId === branchId || st.branchId === 'all' || !st.branchId) && !st.isDamaged && st.quantity > 0) || null;

  return { medicine, quantity, stockItem };
}

function parseWordNumber(word: string): number {
  const w = word.toLowerCase().trim();
  switch (w) {
    case 'one': case 'አንድ': case 'tokko': return 1;
    case 'two': case 'ሁለት': case 'lama': return 2;
    case 'three': case 'ሦስት': case 'sadii': return 3;
    case 'four': case 'አራት': case 'afur': return 4;
    case 'five': case 'አምስት': case 'shan': return 5;
    case 'six': case 'ስድስት': case 'ja\'a': case 'jaa': return 6;
    case 'seven': case 'ሰባት': case 'torba': return 7;
    case 'eight': case 'ስምንት': case 'saddeet': return 8;
    case 'nine': case 'ዘጠኝ': case 'sagal': return 9;
    case 'ten': case 'አሥር': case 'kudhan': return 10;
    default: {
      const parsed = parseInt(w, 10);
      return isNaN(parsed) ? 1 : parsed;
    }
  }
}
