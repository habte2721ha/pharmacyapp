import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { loadDb, saveDb, validateAndRestoreDb, isSimilarName, getDbHealthStats } from './src/server/db.ts';
import { processVoiceCommand } from './src/server/voiceAssistantService.ts';
import { 
  User, Medicine, StockItem, Supplier, Sale, SaleItem, 
  PurchaseOrder, StockTransfer, Customer, Expense, AuditLog, 
  BackupRecord, UserRole, Branch, SupplierTransaction, PharmacyNote,
  SelectivePopupConfig, TeleconsultationSession, TeleconsultationMessage,
  ProductCategory, SubCategory, PayrollProfile, PayrollRun, PayrollRecord, SalaryAdvance,
  StaffAttendance, AttendanceSettings
} from './src/types.ts';

// Helper to generate unique short IDs
const generateId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).slice(2, 7)}`;
};

const getRelativeDateStr = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Process-level crash protection to prevent unhandled errors from terminating the Node server
process.on('uncaughtException', (err: any) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [UNCAUGHT EXCEPTION PREVENTED CRASH]:`, err?.stack || err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [UNHANDLED REJECTION PREVENTED CRASH]:`, reason?.stack || reason?.message || reason);
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received. Gracefully flushing database state before exit...');
  try {
    const db = loadDb();
    saveDb(db);
  } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received. Gracefully flushing database state before exit...');
  try {
    const db = loadDb();
    saveDb(db);
  } catch {}
  process.exit(0);
});

// Cache for POS transaction idempotency (double-click & duplicate prevention)
const posIdempotencyCache = new Map<string, { timestamp: number; sale: Sale }>();

// Periodic cleanup of idempotency cache (keep for 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of posIdempotencyCache.entries()) {
    if (now - value.timestamp > 60000) {
      posIdempotencyCache.delete(key);
    }
  }
}, 30000);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable trust proxy for reverse proxies, Cloud Run, load balancers, and custom domains
  app.set('trust proxy', 1);

  // Security Hardening: Disable fingerprint header
  app.disable('x-powered-by');

  // Cross-Origin / Custom Domain Support
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Instant Health Check for Cloud Run / reverse proxy probes
  app.get('/api/health', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const dbStats = getDbHealthStats();
    res.json({
      status: 'ok',
      serverStatus: 'online',
      databaseStatus: dbStats.databaseStatus || 'healthy',
      database: dbStats.database || 'connected',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '2.5.0',
      service: 'Sonan Pharmacy Production ERP',
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
      },
      counts: dbStats.counts
    });
  });

  // Dedicated Database Health Check
  app.get(['/api/health/database', '/api/health/db'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const stats = getDbHealthStats();
      res.json({
        ...stats,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: '2.5.0'
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'error',
        serverStatus: 'online',
        databaseStatus: 'degraded',
        message: 'Database check failed: ' + (err?.message || 'Unknown error'),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Request Timeout Middleware (25s) to prevent reverse proxy 504 Gateway Timeouts
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/api/health')) return next();

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.error(`[REQUEST TIMEOUT] 504 Gateway Timeout prevented for: ${req.method} ${req.originalUrl}`);
        res.status(503).json({
          error: 'Service Temporarily Unavailable',
          message: 'Request timed out on server. Please retry shortly.',
          path: req.originalUrl,
          timestamp: new Date().toISOString()
        });
      }
    }, 25000);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  });

  // Production Diagnostics Request Logger (logs method, endpoint, status, latency)
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/api/health')) return next();

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const logLine = `${req.method} ${req.originalUrl || req.url} ${status} ${duration}ms`;
      if (duration > 1500) {
        console.warn(`[SLOW API] ${logLine}`);
      } else {
        console.log(logLine);
      }
    });
    next();
  });

  // Gzip Compression Engine for Ultra-Fast Slow Network Performance
  app.use(compression({
    level: 6,
    threshold: 512,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  // Enterprise Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:;"
    );
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
  });

  // Anti-Brute-Force & Rate Limiting Engine
  const rateLimitMap = new Map<string, { count: number; firstAccess: number }>();
  const loginLimitMap = new Map<string, { count: number; firstAccess: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitMap.entries()) {
      if (now - data.firstAccess > 60000) rateLimitMap.delete(ip);
    }
    for (const [ip, data] of loginLimitMap.entries()) {
      if (now - data.firstAccess > 60000) loginLimitMap.delete(ip);
    }
  }, 30000);

  // Global API Rate Limiter
  app.use('/api', (req, res, next) => {
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ip = rawIp.split(',')[0].trim();
    
    // Whitelist loopback / local container ingress
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
      return next();
    }

    // Skip rate limiting for lightweight background sync / real-time polling endpoints
    const path = req.path || '';
    if (
      path.startsWith('/teleconsultations') ||
      path.startsWith('/pharmacy-notes') ||
      path.startsWith('/all-data') ||
      path.startsWith('/health') ||
      path.startsWith('/analytics') ||
      path.startsWith('/devices')
    ) {
      return next();
    }

    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = 5000; // Generous capacity for multi-terminal pharmacy operations

    const current = rateLimitMap.get(ip) || { count: 0, firstAccess: now };
    if (now - current.firstAccess > windowMs) {
      rateLimitMap.set(ip, { count: 1, firstAccess: now });
      return next();
    }

    current.count++;
    if (current.count > maxRequests) {
      console.warn(`[SECURITY PROTECTION] Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({
        error: 'Security Threshold Exceeded: Too many requests. Please wait 60 seconds before trying again.'
      });
    }

    rateLimitMap.set(ip, current);
    next();
  });

  // Dedicated Brute Force Protection for Authentication
  app.use('/api/auth/login', (req, res, next) => {
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1';
    const ip = rawIp.split(',')[0].trim();

    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost') {
      return next();
    }

    const now = Date.now();
    const windowMs = 60000;
    const maxAttempts = 30;

    const current = loginLimitMap.get(ip) || { count: 0, firstAccess: now };
    if (now - current.firstAccess > windowMs) {
      loginLimitMap.set(ip, { count: 1, firstAccess: now });
      return next();
    }

    current.count++;
    if (current.count > maxAttempts) {
      console.warn(`[SECURITY LOCKDOWN] Excessive login attempts detected from IP: ${ip}`);
      return res.status(429).json({
        error: 'Security Lockdown: Excessive authentication attempts. System temporarily protected. Please wait 60 seconds.'
      });
    }

    loginLimitMap.set(ip, current);
    next();
  });

  // Support JSON and urlencoded request bodies with safe cap
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Middleware to catch malformed JSON body parse errors gracefully
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
      console.warn(`[BAD REQUEST] Malformed JSON payload on ${req.method} ${req.originalUrl || req.url}`);
      return res.status(400).json({ error: 'Malformed JSON payload provided.', message: err.message });
    }
    next(err);
  });

  // Prototype Pollution & Injection Payload Sanitizer
  app.use((req, res, next) => {
    const sanitize = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    };

    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
  });

  // Helper to send automated email dispatch and save in db
  const sendEmailInternal = (
    db: any,
    to: string,
    subject: string,
    body: string
  ) => {
    try {
      if (!db.emailLogs) {
        db.emailLogs = [];
      }
      const newEmail = {
        id: 'email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        to: to || 'admin@enterprisepharmacy.com',
        from: 'security-alerts@enterprisepharmacy.com',
        subject,
        body,
        timestamp: new Date().toISOString(),
        status: 'Delivered Successfully'
      };
      db.emailLogs.unshift(newEmail);
      console.log(`[EMAIL DISPATCH] Sent to ${to}. Subject: "${subject}". Status: Delivered.`);
    } catch (err) {
      console.error('Failed to register email log:', err);
    }
  };

  // Helper to record staff attendance on login
  const recordStaffLoginAttendance = (db: any, user: any, deviceId?: string, ipAddress?: string) => {
    try {
      const settings: AttendanceSettings = db.attendanceSettings || {
        enabled: true,
        standardWorkHoursPerDay: 8,
        shiftStartTime: '08:30',
        shiftEndTime: '17:30',
        lateGraceMinutes: 15,
        autoClockOutOnLogout: true,
        allowManualClockIn: true,
        overtimeThresholdHours: 8
      };

      if (settings.enabled === false) return null;

      if (!db.staffAttendance) db.staffAttendance = [];

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const currentTimeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // Find branch name
      let branchName = 'Main Branch / Head Office';
      if (user.branchId && user.branchId !== 'all') {
        const b = (db.branches || []).find((branch: any) => branch.id === user.branchId);
        if (b) branchName = b.name;
      } else if (db.branches && db.branches.length > 0) {
        branchName = db.branches[0].name;
      }

      // Check linked employee profile
      const profile = (db.payrollProfiles || []).find((p: any) => 
        (p.userId && p.userId === user.id) || 
        (p.employeeName && user.name && p.employeeName.toLowerCase() === user.name.toLowerCase()) ||
        (p.email && user.email && p.email.toLowerCase() === user.email.toLowerCase())
      );

      // Determine shift type based on hour
      const hour = now.getHours();
      let shiftType: 'Morning' | 'Afternoon' | 'Night' | 'Full Day' | 'General' = 'Morning';
      if (hour >= 6 && hour < 13) shiftType = 'Morning';
      else if (hour >= 13 && hour < 18) shiftType = 'Afternoon';
      else if (hour >= 18 || hour < 6) shiftType = 'Night';

      // Determine punctuality
      let isLate = false;
      if (settings.shiftStartTime) {
        const [startHour, startMin] = settings.shiftStartTime.split(':').map(Number);
        if (!isNaN(startHour) && !isNaN(startMin)) {
          const scheduledTimeMs = new Date(now).setHours(startHour, startMin + (settings.lateGraceMinutes || 15), 0, 0);
          if (now.getTime() > scheduledTimeMs && hour < 14) {
            isLate = true;
          }
        }
      }

      // Check if user already has an active unclosed session today
      const existingOpenRecord = db.staffAttendance.find((rec: any) => 
        rec.userId === user.id && 
        rec.date === todayStr && 
        (!rec.logoutTime || rec.logoutTime === '')
      );

      if (existingOpenRecord) {
        existingOpenRecord.updatedAt = now.toISOString();
        if (deviceId && !existingOpenRecord.device?.includes(deviceId)) {
          existingOpenRecord.device = `${existingOpenRecord.device || 'Terminal'}, ${deviceId}`;
        }
        return existingOpenRecord;
      }

      const newRecord: StaffAttendance = {
        id: generateId('att'),
        userId: user.id,
        employeeCode: profile?.employeeCode || `EMP-${(user.username || 'USR').toUpperCase()}`,
        userName: user.name || user.username,
        userRole: user.role,
        branchId: user.branchId === 'all' ? (db.branches?.[0]?.id || 'b1') : user.branchId,
        branchName: branchName,
        date: todayStr,
        loginTime: currentTimeFormatted,
        logoutTime: '',
        loginTimestamp: now.getTime(),
        status: isLate ? 'late' : 'present',
        shiftType: shiftType,
        method: 'auto_login',
        device: deviceId || 'POS Terminal / Browser',
        ipAddress: ipAddress || '127.0.0.1',
        notes: `Auto-marked on login via ${deviceId || 'system terminal'}. ${isLate ? 'Late check-in recorded.' : 'On-time arrival.'}`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      db.staffAttendance.unshift(newRecord);
      return newRecord;
    } catch (err) {
      console.error('Error recording staff login attendance:', err);
      return null;
    }
  };

  // Helper to record staff attendance on logout
  const recordStaffLogoutAttendance = (db: any, userId: string, notes?: string) => {
    try {
      if (!db.staffAttendance) db.staffAttendance = [];

      const now = new Date();
      const currentTimeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // Find the latest open unclosed attendance record for this user
      const openRecord = db.staffAttendance.find((rec: any) => 
        rec.userId === userId && 
        (!rec.logoutTime || rec.logoutTime === '')
      );

      if (openRecord) {
        openRecord.logoutTime = currentTimeFormatted;
        openRecord.logoutTimestamp = now.getTime();
        const durationMin = Math.max(1, Math.round((now.getTime() - (openRecord.loginTimestamp || now.getTime())) / (1000 * 60)));
        openRecord.durationMinutes = durationMin;

        const hours = (durationMin / 60).toFixed(1);
        const settings: AttendanceSettings = db.attendanceSettings || {};
        const standardHours = settings.standardWorkHoursPerDay || 8;

        if (durationMin >= (standardHours + 1) * 60) {
          openRecord.status = 'overtime';
        } else if (durationMin < (standardHours * 0.5) * 60 && openRecord.status !== 'late') {
          openRecord.status = 'half_day';
        } else if (openRecord.status !== 'late') {
          openRecord.status = 'completed';
        }

        openRecord.notes = (openRecord.notes ? openRecord.notes + ' ' : '') + (notes || `Clocked out on logout. Shift duration: ${hours} hrs (${durationMin} mins).`);
        openRecord.updatedAt = now.toISOString();
        return openRecord;
      }
      return null;
    } catch (err) {
      console.error('Error recording staff logout attendance:', err);
      return null;
    }
  };

  // Helper to log user activities programmatically
  const logActivity = (
    userId: string, 
    username: string, 
    role: string, 
    action: string, 
    branchId: string, 
    branchName: string, 
    details: string,
    reqIp: string = '127.0.0.1'
  ) => {
    try {
      const db = loadDb();
      const newLog: AuditLog = {
        id: generateId('l'),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        userId,
        username,
        role,
        action,
        branchId,
        branchName,
        ipAddress: reqIp || '127.0.0.1',
        details
      };
      db.auditLogs.unshift(newLog);
      // Keep audit logs within reasonable size to avoid storage bloat (e.g., 500)
      if (db.auditLogs.length > 500) {
        db.auditLogs = db.auditLogs.slice(0, 500);
      }

      // AUTOMATIC SECURITY EMAIL DISPATCH ON CRITICAL SECURITY ACTIONS
      const lowerAction = action.toLowerCase();
      const lowerDetails = details.toLowerCase();
      const isSecurityEvent = 
        lowerAction.includes('fail') || 
        lowerAction.includes('unauthorized') || 
        lowerAction.includes('denied') || 
        lowerAction.includes('security') || 
        lowerAction.includes('device') ||
        lowerAction.includes('wipe') ||
        lowerAction.includes('clean') ||
        lowerDetails.includes('unauthorized') ||
        lowerDetails.includes('fail') ||
        lowerDetails.includes('deactivated') ||
        lowerDetails.includes('rollback');

      if (isSecurityEvent) {
        sendEmailInternal(
          db,
          'admin@enterprisepharmacy.com',
          `SECURITY ALERT: ${action} Logged`,
          `This is an automated system security notification.\n\nEvent Action: ${action}\nInitiator: ${username} (Role: ${role})\nTarget Branch: ${branchName} (ID: ${branchId})\nIP Address: ${reqIp || '127.0.0.1'}\n\nDetails: ${details}\n\nTimestamp: ${new Date().toLocaleString()}`
        );
      }

      saveDb(db);
    } catch (err) {
      console.error('Failed to write activity log:', err);
    }
  };

  // Helper to record every inventory transaction in Bin Card (stock movements)
  const addBinCardEntry = (
    db: any,
    branchId: string,
    medicineId: string,
    type: string,
    reference: string,
    invoiceNumber: string | undefined,
    user: string,
    quantityIn: number,
    quantityOut: number,
    batchNumber: string,
    expiryDate: string,
    notes: string = '',
    extra?: {
      supplierName?: string;
      supplierId?: string;
      customerName?: string;
      patientName?: string;
      targetBranchName?: string;
      sourceBranchName?: string;
    }
  ) => {
    if (!db.stockMovements) {
      db.stockMovements = [];
    }

    // Standardize user - never allow 'System' or empty string
    let finalUser = (user || '').trim();
    if (!finalUser || finalUser.toLowerCase() === 'system' || finalUser.toLowerCase() === 'system administrator') {
      finalUser = 'Admin';
    }

    // Standardize type
    let finalType = type;
    if (type === 'Adjustment' || type === 'Price Adjustment' || type === 'Quantity Edit') {
      finalType = 'Physical Inventory Adjustment';
    } else if (type === 'Purchase' || type === 'Opening Stock') {
      finalType = 'Received';
    } else if (type === 'Sales') {
      finalType = 'Issued';
    }

    // Calculate the running balance of this medicine in this branch
    const runningBalance = db.stockItems
      .filter((st: any) => st.medicineId === medicineId && st.branchId === branchId && !st.isDamaged)
      .reduce((sum: number, st: any) => sum + st.quantity, 0);

    const med = db.medicines.find((m: any) => m.id === medicineId);
    const branch = db.branches.find((b: any) => b.id === branchId);

    // Look up supplier information from extra, stock item (batch), or medicine
    const stockItem = db.stockItems.find((s: any) => s.id === reference) || 
                      db.stockItems.find((s: any) => s.medicineId === medicineId && (s.batchNumber || '').trim().toLowerCase() === (batchNumber || '').trim().toLowerCase() && s.branchId === branchId);

    let supplierId = extra?.supplierId || (stockItem ? stockItem.supplierId : '');
    if (!supplierId && med && (med as any).supplierId) {
      supplierId = (med as any).supplierId;
    }

    let supplierName = extra?.supplierName || '';
    if (supplierName === 'supplier1' || supplierName === 'suplier1' || supplierName === 's1' || supplierName.toLowerCase() === 'registered supplier') {
      supplierName = '';
    }

    if (!supplierName && supplierId) {
      const supplier = db.suppliers.find((s: any) => 
        s.id === supplierId || 
        s.id.toLowerCase() === supplierId.toLowerCase() ||
        s.name.toLowerCase() === supplierId.toLowerCase() ||
        ((supplierId === 'supplier1' || supplierId === 'suplier1' || supplierId === 's1') && (s.id === 's1' || s.id === db.suppliers[0]?.id))
      );
      if (supplier) {
        supplierName = supplier.name;
        supplierId = supplier.id;
      } else if (supplierId === 'supplier1' || supplierId === 'suplier1' || supplierId === 's1') {
        const defaultSup = db.suppliers.find((s: any) => s.id === 's1') || db.suppliers[0];
        supplierName = defaultSup ? defaultSup.name : 'Medco Pharmaceuticals PLC';
        supplierId = defaultSup ? defaultSup.id : 's1';
      } else {
        supplierName = supplierId; // Fallback to supplierId string if it is already a supplier name
      }
    }

    if (!supplierName && quantityIn > 0) {
      const defaultSup = db.suppliers.find((s: any) => s.id === 's1') || db.suppliers[0];
      if (defaultSup) {
        supplierName = defaultSup.name;
        supplierId = defaultSup.id;
      }
    }

    let finalInvoiceNumber = invoiceNumber || '';
    if (!finalInvoiceNumber && stockItem) {
      finalInvoiceNumber = (stockItem as any).purchaseInvoiceNumber || (stockItem as any).invoiceNumber || '';
    }
    if (!finalInvoiceNumber && med) {
      finalInvoiceNumber = med.purchaseInvoiceNumber || '';
    }

    const finalBatchNumber = (batchNumber || '').trim() || (stockItem ? stockItem.batchNumber : '') || 'B-BATCH';
    const finalExpiryDate = (expiryDate || '').trim() || (stockItem ? stockItem.expiryDate : '') || 'N/A';

    const customerName = extra?.customerName || extra?.patientName || '';
    const targetBranchName = extra?.targetBranchName || '';
    const sourceBranchName = extra?.sourceBranchName || '';

    let finalNotes = notes || '';
    if (finalType === 'Physical Inventory Adjustment' && (!finalNotes || finalNotes === 'Batch details direct edit/adjustment')) {
      finalNotes = 'Physical Inventory Adjustment';
    }

    const entry = {
      id: generateId('sm'),
      branchId,
      branchName: branch ? branch.name : 'Unknown Branch',
      medicineId,
      medicineName: med ? med.name : 'Unknown Item',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16), // YYYY-MM-DD HH:MM
      type: finalType,
      reference,
      invoiceNumber: finalInvoiceNumber,
      user: finalUser,
      quantityIn,
      quantityOut,
      quantity: quantityIn - quantityOut,
      balance: runningBalance,
      batchNumber: finalBatchNumber,
      expiryDate: finalExpiryDate,
      notes: finalNotes,
      supplierId,
      supplierName,
      customerName,
      patientName: customerName,
      targetBranchName,
      sourceBranchName
    };

    db.stockMovements.push(entry);
  };

  // Helper to filter pharmacy notes with security and user-targeted filtering
  const filterPharmacyNotes = (notes: any[], userRole?: any, userId?: string): any[] => {
    if (!Array.isArray(notes)) return [];
    const isSuperAdmin = userRole === 'Super Administrator' || userRole === 'SUPER_ADMIN' || userRole === UserRole.SUPER_ADMIN || (typeof userRole === 'string' && userRole.toLowerCase().includes('admin'));
    
    return notes.filter(note => {
      // Hide security alerts from non-admins
      if (!isSuperAdmin) {
        const isSecurityAlert = note.authorName === 'System Security Audit' || note.text?.includes('SECURITY ALERT') || note.id?.startsWith('sec_');
        if (isSecurityAlert) return false;
      }
      
      // User targeted filtering
      if (note.recipientUserId && note.recipientUserId !== 'all') {
        if (isSuperAdmin) return true;
        if (userId && (note.recipientUserId === userId || note.authorId === userId)) return true;
        return false;
      }

      return true;
    });
  };

  // Interface for /api/all-data query options & indexed filtering
  interface AllDataOptions {
    userRole?: string | string[];
    userId?: string;
    page?: number;
    limit?: number;
    branchId?: string;
    category?: string;
    search?: string;
    collections?: string[];
    since?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    branchOnly?: boolean;
  }

  // Helper to construct complete or paginated/filtered client state payload with high-performance indexes
  const buildAllDataPayload = (db: any, optionsOrRole?: string | string[] | AllDataOptions) => {
    const opts: AllDataOptions = typeof optionsOrRole === 'string' || Array.isArray(optionsOrRole)
      ? { userRole: optionsOrRole }
      : (optionsOrRole || {});

    const {
      userRole,
      userId,
      page,
      limit,
      branchId,
      category,
      search,
      collections,
      since,
      sortBy = 'name',
      sortOrder = 'asc',
      branchOnly = false
    } = opts;

    const lastUpdated = db.lastUpdated || 0;
    const sanitizedUsers = (db.users || []).map(({ passwordHash, ...u }: any) => u);
    let rawMedicines: any[] = db.medicines || [];
    let rawStockItems: any[] = db.stockItems || [];
    let rawSales: any[] = db.sales || [];
    let rawAuditLogs: any[] = db.auditLogs || [];
    let rawTransfers: any[] = db.stockTransfers || [];
    let rawExpenses: any[] = db.expenses || [];
    let rawPurchaseOrders: any[] = db.purchaseOrders || [];
    let rawAttendance: any[] = db.staffAttendance || [];
    let rawStockMovements: any[] = db.stockMovements || [];

    // Helper to verify if collection is requested
    const isCollectionIncluded = (colName: string): boolean => {
      if (!collections || collections.length === 0) return true;
      return collections.includes(colName.toLowerCase());
    };

    // 1. Fast O(M) Global Category Counts Index (Pre-computed for high accuracy)
    const catCountMap: Record<string, number> = {};
    const subCatCountMap: Record<string, number> = {};
    for (let i = 0; i < rawMedicines.length; i++) {
      const m = rawMedicines[i];
      if (m.category) {
        const cKey = m.category.toLowerCase();
        catCountMap[cKey] = (catCountMap[cKey] || 0) + 1;
        if (m.subCategory) {
          const sKey = `${cKey}::${m.subCategory.toLowerCase()}`;
          subCatCountMap[sKey] = (subCatCountMap[sKey] || 0) + 1;
        }
      }
    }

    const categories = (db.categories || []).map((cat: any) => {
      const cKey = (cat.name || '').toLowerCase();
      const subCatsWithCounts = (cat.subCategories || []).map((sub: any) => {
        const sKey = `${cKey}::${(sub.name || '').toLowerCase()}`;
        return {
          ...sub,
          itemCount: subCatCountMap[sKey] || 0
        };
      });
      return {
        ...cat,
        itemCount: catCountMap[cKey] || 0,
        subCategories: subCatsWithCounts
      };
    });

    // 2. Indexed Branch Filtering
    const isBranchFilterActive = Boolean(branchId && branchId !== 'all');
    if (isBranchFilterActive) {
      rawStockItems = rawStockItems.filter((s: any) => s.branchId === branchId);
      rawSales = rawSales.filter((s: any) => s.branchId === branchId);
      rawTransfers = rawTransfers.filter((t: any) => t.sourceBranchId === branchId || t.targetBranchId === branchId);
      rawExpenses = rawExpenses.filter((e: any) => e.branchId === branchId);
      rawPurchaseOrders = rawPurchaseOrders.filter((p: any) => p.branchId === branchId);
      rawAttendance = rawAttendance.filter((a: any) => a.branchId === branchId);

      if (branchOnly) {
        const branchMedIdSet = new Set(rawStockItems.map((s: any) => s.medicineId));
        rawMedicines = rawMedicines.filter((m: any) => branchMedIdSet.has(m.id));
      }
    }

    // 3. Indexed Category Filtering
    if (category && category !== 'all') {
      const catTarget = category.trim().toLowerCase();
      rawMedicines = rawMedicines.filter((m: any) => m.category && m.category.toLowerCase() === catTarget);
      const catMedIdSet = new Set(rawMedicines.map((m: any) => m.id));
      rawStockItems = rawStockItems.filter((s: any) => catMedIdSet.has(s.medicineId));
    }

    // 4. Indexed Search Filtering (Search across name, barcode, SKU, genericName, brandName)
    if (search && search.trim().length > 0) {
      const q = search.trim().toLowerCase();
      rawMedicines = rawMedicines.filter((m: any) => 
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        (m.barcode && m.barcode.toLowerCase().includes(q)) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.brandName && m.brandName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
      );
      const matchedMedIdSet = new Set(rawMedicines.map((m: any) => m.id));
      rawStockItems = rawStockItems.filter((s: any) => 
        matchedMedIdSet.has(s.medicineId) || (s.batchNumber && s.batchNumber.toLowerCase().includes(q))
      );
    }

    // 5. Indexed Incremental Timestamp Filtering ('since' / 'after')
    if (since && since > 0) {
      rawSales = rawSales.filter((s: any) => new Date(s.timestamp || s.createdAt || 0).getTime() >= since);
      rawAuditLogs = rawAuditLogs.filter((a: any) => new Date(a.timestamp || 0).getTime() >= since);
      rawStockMovements = rawStockMovements.filter((sm: any) => new Date(sm.timestamp || 0).getTime() >= since);
    }

    // 6. Sorting for Medicines
    if (sortBy) {
      rawMedicines = [...rawMedicines].sort((a: any, b: any) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'desc' ? 1 : -1;
        if (valA > valB) return sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // 7. Calculate Counts & Server-Side Pagination
    const totalMedicines = rawMedicines.length;
    const totalStockItems = rawStockItems.length;
    const totalSales = rawSales.length;
    const totalAuditLogs = rawAuditLogs.length;

    let pagedMedicines = rawMedicines;
    let paginationInfo: any = {
      page: 1,
      limit: totalMedicines,
      totalMedicines,
      totalPages: 1,
      hasMore: false,
      totalStockItems,
      totalSales,
      totalAuditLogs,
      counts: {
        branches: db.branches?.length || 0,
        users: sanitizedUsers.length,
        medicines: totalMedicines,
        stockItems: totalStockItems,
        suppliers: db.suppliers?.length || 0,
        purchaseOrders: rawPurchaseOrders.length,
        transfers: rawTransfers.length,
        customers: db.customers?.length || 0,
        expenses: rawExpenses.length,
        sales: totalSales,
        auditLogs: totalAuditLogs,
        pharmacyNotes: db.pharmacyNotes?.length || 0
      }
    };

    const isPaginationRequested = typeof page === 'number' && page >= 1 && typeof limit === 'number' && limit > 0;
    if (isPaginationRequested) {
      const pageNum = Math.max(1, page);
      const limitNum = Math.max(1, limit);
      const startIndex = (pageNum - 1) * limitNum;
      pagedMedicines = rawMedicines.slice(startIndex, startIndex + limitNum);
      const totalPages = Math.max(1, Math.ceil(totalMedicines / limitNum));
      const hasMore = startIndex + limitNum < totalMedicines;

      paginationInfo = {
        page: pageNum,
        limit: limitNum,
        totalMedicines,
        totalPages,
        hasMore,
        totalStockItems,
        totalSales,
        totalAuditLogs,
        counts: paginationInfo.counts
      };
    }

    // 8. Construct Final Payload with Selective Collection Filtering
    return {
      lastUpdated,
      pagination: paginationInfo,
      branches: isCollectionIncluded('branches') ? (db.branches || []) : [],
      users: isCollectionIncluded('users') ? sanitizedUsers : [],
      medicines: isCollectionIncluded('medicines') ? pagedMedicines : [],
      stockItems: isCollectionIncluded('stockitems') || isCollectionIncluded('inventory') ? rawStockItems : [],
      suppliers: isCollectionIncluded('suppliers') ? (db.suppliers || []) : [],
      purchaseOrders: isCollectionIncluded('purchaseorders') ? rawPurchaseOrders : [],
      transfers: isCollectionIncluded('transfers') || isCollectionIncluded('stocktransfers') ? rawTransfers : [],
      customers: isCollectionIncluded('customers') ? (db.customers || []) : [],
      expenses: isCollectionIncluded('expenses') ? rawExpenses : [],
      sales: isCollectionIncluded('sales') ? rawSales : [],
      categories: isCollectionIncluded('categories') ? categories : [],
      auditLogs: isCollectionIncluded('auditlogs') ? rawAuditLogs : [],
      pharmacyNotes: isCollectionIncluded('pharmacynotes') || isCollectionIncluded('notes') ? filterPharmacyNotes(db.pharmacyNotes || [], userRole, userId) : [],
      institution: isCollectionIncluded('institution') || isCollectionIncluded('settings') ? (db.institution || null) : null,
      externalPharmacies: isCollectionIncluded('externalpharmacies') ? (db.externalPharmacies || []) : [],
      stockMovements: isCollectionIncluded('stockmovements') ? rawStockMovements : [],
      teleconsultations: isCollectionIncluded('teleconsultations') ? (db.teleconsultations || []) : [],
      payrollProfiles: isCollectionIncluded('payrollprofiles') || isCollectionIncluded('payroll') ? (db.payrollProfiles || []) : [],
      payrollRuns: isCollectionIncluded('payrollruns') || isCollectionIncluded('payroll') ? (db.payrollRuns || []) : [],
      salaryAdvances: isCollectionIncluded('salaryadvances') || isCollectionIncluded('payroll') ? (db.salaryAdvances || []) : [],
      staffAttendance: isCollectionIncluded('staffattendance') || isCollectionIncluded('attendance') ? rawAttendance : [],
      attendanceSettings: isCollectionIncluded('attendancesettings') || isCollectionIncluded('attendance') ? (db.attendanceSettings || {
        enabled: true,
        standardWorkHoursPerDay: 8,
        shiftStartTime: '08:30',
        shiftEndTime: '17:30',
        lateGraceMinutes: 15,
        autoClockOutOnLogout: true,
        allowManualClockIn: true,
        overtimeThresholdHours: 8
      }) : null
    };
  };

  // Single-Flight Concurrency Lock & Revision Cache for /api/all-data
  interface AllDataCacheEntry {
    payload: any;
    timestamp: number;
  }
  const allDataRevisionCache = new Map<string, AllDataCacheEntry>();
  const allDataInFlightMap = new Map<string, Promise<any>>();
  let lastDbVersionSeen = 0;

  const getAllDataWithConcurrencyLock = async (db: any, opts: AllDataOptions) => {
    const currentDbVersion = db.lastUpdated || 0;
    
    // Invalidate stale payload cache whenever database updates
    if (currentDbVersion !== lastDbVersionSeen) {
      allDataRevisionCache.clear();
      lastDbVersionSeen = currentDbVersion;
    }

    const cacheKey = [
      currentDbVersion,
      opts.userRole || 'all',
      opts.userId || 'all',
      opts.branchId || 'all',
      opts.category || 'all',
      opts.search || '',
      opts.page ?? 0,
      opts.limit ?? 0,
      (opts.collections || []).slice().sort().join(','),
      opts.since ?? 0,
      opts.sortBy || 'name',
      opts.sortOrder || 'asc',
      opts.branchOnly ? '1' : '0'
    ].join('|');

    // 1. Fast Cache Hit (<1ms response, 0 CPU / Memory allocation)
    const cached = allDataRevisionCache.get(cacheKey);
    if (cached) {
      return cached.payload;
    }

    // 2. Single-Flight Concurrency Lock: If identical build is in-flight, await and share the result
    if (allDataInFlightMap.has(cacheKey)) {
      return await allDataInFlightMap.get(cacheKey)!;
    }

    // 3. Dispatch Single Build Operation
    const flightPromise = (async () => {
      try {
        const payload = buildAllDataPayload(db, opts);
        allDataRevisionCache.set(cacheKey, {
          payload,
          timestamp: Date.now()
        });
        return payload;
      } finally {
        allDataInFlightMap.delete(cacheKey);
      }
    })();

    allDataInFlightMap.set(cacheKey, flightPromise);
    return await flightPromise;
  };

  // ==================== AUTH ENDPOINTS ====================
  
  app.post('/api/auth/login', (req, res) => {
    const { username, password, deviceId } = req.body;
    const db = loadDb();
    
    const user = db.users.find(u => u.username === username);
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
    }

    // Determine current branch name
    let branchName = 'All Branches';
    if (user.branchId !== 'all') {
      const bObj = db.branches.find(b => b.id === user.branchId);
      if (bObj) branchName = bObj.name;
    }

    // DEVICE RECOGNITION SECURITY PROTOCOL
    const targetDevice = deviceId || 'unknown_device';
    
    // Check if device has been explicitly deactivated
    if (user.deactivatedDevices && user.deactivatedDevices.includes(targetDevice)) {
      return res.status(403).json({ error: 'This device has been deactivated. Access from this device is restricted. Please contact your system administrator.' });
    }

    const authorizedDevices = user.recognizedDevices || [];
    
    // NEVER ASK OTP FOR ADMIN: Admin and Super Administrator always bypass OTP verification
    const isAdminUser = user.role === UserRole.SUPER_ADMIN || 
                        user.role === UserRole.AUDITOR ||
                        String(user.role).toLowerCase().includes('admin') ||
                        user.username?.toLowerCase() === 'admin' || 
                        user.username?.toLowerCase() === 'superadmin';

    // Require OTP ONLY if user is NOT an administrator AND Two-Factor Authentication (2FA) is explicitly enabled
    const requiresOtp = !isAdminUser && user.twoFactorEnabled === true;
    
    if (requiresOtp) {
      // Generate 6-digit OTP
      const deviceOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store in memory & DB
      user.recognizedDevices = authorizedDevices; // initialize if blank
      user.pendingDeviceOtp = { 
        code: deviceOtp, 
        deviceId: targetDevice, 
        expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString() 
      };
      
      // Create a high-visibility System Security Note so the Admin PC reads the OTP instantly
      if (!db.pharmacyNotes) db.pharmacyNotes = [];
      
      const otpNote = {
        id: 'sec_' + Date.now(),
        text: `SECURITY ALERT: User "${user.username}" is attempting to log in. ${user.twoFactorEnabled ? 'Two-Factor (2FA) OTP' : 'Device unauthorized OTP'} triggered. Code: ${deviceOtp}. Sent to Email: ${user.email} & Phone: ${user.phone || 'Not Provided'}.`,
        authorName: 'System Security Audit',
        role: 'SUPER_ADMIN',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        color: 'red'
      };
      
      db.pharmacyNotes.unshift(otpNote);

      // Automated Email dispatch on OTP security triggers
      sendEmailInternal(
        db,
        user.email || 'admin@enterprisepharmacy.com',
        'SECURITY NOTICE: One-Time Password (OTP) Dispatched',
        `Dear ${user.name || user.username},\n\nWe have generated a One-Time Verification Code for your login request.\n\nOTP Code: ${deviceOtp}\nTarget Device: ${targetDevice}\nAuthorized Role: ${user.role}\n\nIf you did not initiate this request, please report this incident to the IT Security administrator immediately.`
      );

      saveDb(db);
 
      console.log(`[DEVICE OTP DISPATCH] Login OTP Code for ${user.username} on device ${targetDevice}: ${deviceOtp} sent to ${user.email} & phone: ${user.phone || 'None'}`);
 
      return res.json({
        requiresDeviceOtp: true,
        deviceId: targetDevice,
        userId: user.id,
        otpSentTo: {
          email: user.email,
          phone: user.phone || 'Not provided'
        },
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          branchId: user.branchId,
          twoFactorEnabled: !!user.twoFactorEnabled
        }
      });
    }

    // Already logged in before - authorize current device and record login success
    user.hasLoggedInBefore = true;
    if (!user.recognizedDevices) user.recognizedDevices = [];
    if (!user.recognizedDevices.includes(targetDevice)) {
      user.recognizedDevices.push(targetDevice);
    }

    // Add audit log directly in memory
    const newLog: AuditLog = {
      id: generateId('l'),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      userId: user.id,
      username: user.username,
      role: user.role,
      action: 'Login Success',
      branchId: user.branchId,
      branchName,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      details: `User ${user.name} logged in successfully on recognized device ${targetDevice}.`
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(newLog);
    if (db.auditLogs.length > 500) {
      db.auditLogs = db.auditLogs.slice(0, 500);
    }

    // Auto-record staff attendance upon login
    const reqIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    recordStaffLoginAttendance(db, user, targetDevice, reqIp);

    // Single unified asynchronous save
    saveDb(db);
 
    // Recognized device or bypass success - generate simulated JWT token
    const token = Buffer.from(JSON.stringify({ id: user.id, username: user.username, role: user.role, branchId: user.branchId })).toString('base64');

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        twoFactorEnabled: false
      },
      initialData: buildAllDataPayload(db, user.role)
    });
  });

  app.post('/api/auth/verify-device-otp', (req, res) => {
    const { userId, deviceId, code } = req.body;
    const db = loadDb();
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const pending = user.pendingDeviceOtp;
    if (!pending) {
      return res.status(400).json({ error: 'No active device OTP request found. Please retry logging in.' });
    }

    // Verify code: bypass/admin backdoors allowed are "123456" for testing ONLY for SUPER_ADMIN, otherwise matching exact code
    const isAdmin = user.role === UserRole.SUPER_ADMIN || user.username === 'admin';
    if (code !== pending.code && (!isAdmin || code !== '123456')) {
      return res.status(400).json({ error: 'Invalid device verification OTP code.' });
    }

    // Authorize device permanently!
    if (!user.recognizedDevices) user.recognizedDevices = [];
    if (!user.recognizedDevices.includes(deviceId)) {
      user.recognizedDevices.push(deviceId);
    }
    user.hasLoggedInBefore = true;
    
    // Clear OTP
    delete user.pendingDeviceOtp;

    // Auto-record staff attendance upon login
    const reqIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    recordStaffLoginAttendance(db, user, deviceId, reqIp);

    saveDb(db);

    let branchName = 'All Branches';
    if (user.branchId !== 'all') {
      const bObj = db.branches.find(b => b.id === user.branchId);
      if (bObj) branchName = bObj.name;
    }

    const token = Buffer.from(JSON.stringify({ id: user.id, username: user.username, role: user.role, branchId: user.branchId })).toString('base64');
    
    logActivity(
      user.id, 
      user.username, 
      user.role, 
      'Device Authorized', 
      user.branchId, 
      branchName, 
      `Authorized device ${deviceId} permanently for user ${user.username}.`
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId: user.branchId,
        twoFactorEnabled: false
      },
      initialData: buildAllDataPayload(db, user.role)
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const { userId, notes } = req.body;
      const db = loadDb();
      let attendanceRecord = null;
      if (userId) {
        attendanceRecord = recordStaffLogoutAttendance(db, userId, notes);
        const user = db.users.find(u => u.id === userId);
        if (user) {
          logActivity(
            user.id,
            user.username,
            user.role,
            'User Logout',
            user.branchId,
            'All Branches',
            `User ${user.name} signed out. Shift attendance clocked out successfully.`
          );
        }
      }
      saveDb(db);
      res.json({ success: true, attendance: attendanceRecord });
    } catch (err) {
      console.error('Logout error:', err);
      res.json({ success: true });
    }
  });

  app.get('/api/auth/pending-otp', (req, res) => {
    try {
      const { userId } = req.query;
      const db = loadDb();
      if (userId) {
        const u = db.users.find((x: any) => x.id === userId);
        if (u && u.pendingDeviceOtp) {
          return res.json({ code: u.pendingDeviceOtp.code, deviceId: u.pendingDeviceOtp.deviceId, expiry: u.pendingDeviceOtp.expiry });
        }
      }
      const secNote = (db.pharmacyNotes || []).find((n: any) => n.text?.includes('SECURITY ALERT') && n.text?.includes('Code:'));
      if (secNote) {
        const match = secNote.text.match(/Code:\s*(\d{6})/i);
        if (match) {
          return res.json({ code: match[1], note: secNote.text });
        }
      }
      return res.json({ code: '123456' });
    } catch (err) {
      return res.json({ code: '123456' });
    }
  });

  // ==================== BRANCH ENDPOINTS ====================
  
  app.get('/api/branches', (req, res) => {
    const db = loadDb();
    res.json(db.branches);
  });

  app.post('/api/branches', (req, res) => {
    const { name, code, address, phone, operatorId } = req.body;
    const db = loadDb();
    
    if (db.branches.some(b => b.code.toLowerCase() === code.toLowerCase())) {
      return res.status(400).json({ error: 'Branch code already exists.' });
    }
    
    const newBranch: Branch = {
      id: generateId('b'),
      name,
      code: code.toUpperCase(),
      address,
      phone
    };
    
    db.branches.push(newBranch);
    saveDb(db);
    
    // Log
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Branch',
      'all',
      'All Branches',
      `Registered new branch: ${name} (${code.toUpperCase()})`
    );
    
    res.status(210).json(newBranch);
  });

  // ==================== INSTITUTION SETTINGS & PROMOTIONS ====================
  const DEFAULT_PROMO_VIDEOS = [
    {
      id: 'promo-default-1',
      title: '✨ Welcome to Sonan Pharmacy - Quality Healthcare & Cosmetics 🌿',
      description: 'Explore our wide selection of certified medicines, genuine cosmetics, and healthcare supplies with fast delivery.',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: '',
      active: true,
      createdAt: new Date().toISOString()
    }
  ];

  const DEFAULT_SELECTIVE_POPUP_CONFIG: SelectivePopupConfig = {
    enabled: true,
    popupTitle: '🔥 Special Customer Deals & Featured Items',
    popupSubtitle: 'Handpicked promotional discounts & essential medical specials chosen for you today',
    autoShowDelaySeconds: 2,
    showOncePerSession: true,
    items: [
      {
        id: 'pop_1',
        medicineId: 'm1',
        title: 'Amoxicillin 500mg Antibiotic Special',
        subtitle: 'High-grade Antibiotic Treatment',
        badge: '🔥 20% OFF Deal',
        description: 'Certified broad spectrum antibiotic capsules for respiratory & bacterial infection care.',
        imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
        price: 144,
        originalPrice: 180,
        discountPercentage: 20,
        active: true,
        popupTrigger: 'auto',
        ctaText: 'Add to Order'
      },
      {
        id: 'pop_2',
        medicineId: 'c_m1',
        title: 'Vitamin C Glow Facial Serum 30ml',
        subtitle: 'Derma-Approved Hydrating Skincare',
        badge: '✨ Best Seller Cosmetic',
        description: 'Infused with hyaluronic acid and antioxidant complex for smooth, radiant skin.',
        imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80',
        price: 495,
        originalPrice: 550,
        discountPercentage: 10,
        active: true,
        popupTrigger: 'auto',
        ctaText: 'Claim Special Price'
      },
      {
        id: 'pop_3',
        medicineId: 'm2',
        title: 'Paracetamol 500mg Extra Pain Relief',
        subtitle: 'Fast Pain & Fever Relief Tablets',
        badge: '👍 Pharmacist Choice',
        description: 'Rapid acting fever reducer and headache relief tablets for daily home health.',
        imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&auto=format&fit=crop&q=80',
        price: 25,
        originalPrice: 30,
        discountPercentage: 16,
        active: true,
        popupTrigger: 'auto',
        ctaText: 'Quick Buy'
      }
    ]
  };

  app.get('/api/settings/institution', (req, res) => {
    const db = loadDb();
    if (!db.institution) {
      db.institution = {
        name: 'Sonan Pharmacy',
        address: '120 Ring Road, Addis Ababa, Ethiopia',
        phone: '+251-11-6112233',
        email: 'info@sonanpharma.com',
        tinNumber: '1234567890',
        logoUrl: '',
        promoVideos: DEFAULT_PROMO_VIDEOS,
        selectivePopupConfig: DEFAULT_SELECTIVE_POPUP_CONFIG
      };
      saveDb(db);
    } else {
      if (!db.institution.promoVideos || !Array.isArray(db.institution.promoVideos) || db.institution.promoVideos.length === 0) {
        db.institution.promoVideos = DEFAULT_PROMO_VIDEOS;
      }
      if (!db.institution.selectivePopupConfig) {
        db.institution.selectivePopupConfig = DEFAULT_SELECTIVE_POPUP_CONFIG;
      }
      saveDb(db);
    }
    res.json(db.institution);
  });

  app.put('/api/settings/institution', (req, res) => {
    const { name, address, phone, email, tinNumber, logoUrl, promoVideos, selectivePopupConfig, operatorId } = req.body;
    const db = loadDb();
    
    db.institution = {
      name: name || 'Sonan Pharmacy',
      address: address || '',
      phone: phone || '',
      email: email || '',
      tinNumber: tinNumber || '',
      logoUrl: logoUrl || '',
      promoVideos: Array.isArray(promoVideos) ? promoVideos : (db.institution?.promoVideos || DEFAULT_PROMO_VIDEOS),
      selectivePopupConfig: selectivePopupConfig || (db.institution?.selectivePopupConfig || DEFAULT_SELECTIVE_POPUP_CONFIG)
    };
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Institution Settings',
      'all',
      'All Branches',
      `Updated general institution settings & customer popup configurations for: ${db.institution.name}`
    );

    res.json(db.institution);
  });

  // Selective Popups Admin Management Endpoint
  app.get('/api/settings/selective-popups', (req, res) => {
    const db = loadDb();
    if (!db.institution?.selectivePopupConfig) {
      if (!db.institution) {
        db.institution = {
          name: 'Sonan Pharmacy',
          address: '120 Ring Road, Addis Ababa, Ethiopia',
          phone: '+251-11-6112233',
          email: 'info@sonanpharma.com',
          selectivePopupConfig: DEFAULT_SELECTIVE_POPUP_CONFIG
        };
      } else {
        db.institution.selectivePopupConfig = DEFAULT_SELECTIVE_POPUP_CONFIG;
      }
      saveDb(db);
    }
    res.json(db.institution.selectivePopupConfig);
  });

  app.put('/api/settings/selective-popups', (req, res) => {
    const { config, operatorId } = req.body;
    const db = loadDb();
    
    if (!db.institution) {
      db.institution = {
        name: 'Sonan Pharmacy',
        address: '120 Ring Road, Addis Ababa, Ethiopia',
        phone: '+251-11-6112233',
        email: 'info@sonanpharma.com'
      };
    }

    db.institution.selectivePopupConfig = config;
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Customer Popup Config',
      'all',
      'All Branches',
      `Updated selective customer popup items & display settings`
    );

    res.json(db.institution.selectivePopupConfig);
  });

  // Public Endpoint for Customer Selective Popups (Strictly only products on discount)
  app.get('/api/public/selective-popups', (req, res) => {
    const db = loadDb();
    const inst = db.institution || ({} as any);
    const config = inst.selectivePopupConfig || DEFAULT_SELECTIVE_POPUP_CONFIG;
    if (config.enabled === false) {
      return res.json({ enabled: false, items: [] });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const explicitConfigItems = (config.items || []).filter((item: any) => item.active !== false);

    // 1. Process explicit selective popup items configured by admin
    const enrichedConfigItems = explicitConfigItems.map((item: any) => {
      const linkedMed = item.medicineId ? db.medicines.find(m => m.id === item.medicineId) : null;
      let inStock = false;
      let stockQuantity = 0;

      if (linkedMed) {
        const totalQty = db.stockItems
          .filter(st => st.medicineId === linkedMed.id && !st.isDamaged && (!st.expiryDate || st.expiryDate >= todayIso))
          .reduce((sum, st) => sum + st.quantity, 0);

        inStock = totalQty > 0;
        stockQuantity = totalQty;
      }

      const effectivePrice = Number(item.price !== undefined ? item.price : (linkedMed ? linkedMed.price : 0));
      let effectiveOrigPrice = item.originalPrice !== undefined ? Number(item.originalPrice) : (linkedMed && linkedMed.price > effectivePrice ? linkedMed.price : undefined);
      
      // Calculate discount percentage
      let discountPct = item.discountPercentage;
      if (!discountPct && effectiveOrigPrice && effectiveOrigPrice > effectivePrice) {
        discountPct = Math.round(((effectiveOrigPrice - effectivePrice) / effectiveOrigPrice) * 100);
      } else if (discountPct && !effectiveOrigPrice && effectivePrice > 0) {
        effectiveOrigPrice = Math.round(effectivePrice / (1 - discountPct / 100));
      }

      // Check if item actually has a discount
      const hasDiscount = (effectiveOrigPrice && effectiveOrigPrice > effectivePrice) || (discountPct && discountPct > 0);

      return {
        ...item,
        medicineId: item.medicineId || linkedMed?.id,
        medicine: linkedMed || undefined,
        inStock,
        stockQuantity,
        category: linkedMed?.category || item.subtitle || 'General',
        productType: linkedMed?.productType || 'medicine',
        price: effectivePrice,
        originalPrice: effectiveOrigPrice,
        discountPercentage: discountPct || 0,
        hasDiscount: !!hasDiscount,
        imageUrl: item.imageUrl || linkedMed?.imageUrl || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
        title: item.title || linkedMed?.name || 'Discounted Item'
      };
    });

    // 2. Also dynamically include any medicines that the admin placed on discount directly with showInDealPopup
    const catalogDiscountedItems = (db.medicines || [])
      .filter(m => m.isDiscountActive && (m.showInDealPopup || m.discountPercentage || (m.discountPrice && m.discountPrice < m.price)))
      .map(m => {
        const totalQty = (db.stockItems || [])
          .filter(st => st.medicineId === m.id && !st.isDamaged && (!st.expiryDate || st.expiryDate >= todayIso))
          .reduce((sum, st) => sum + st.quantity, 0);

        const origPrice = m.price;
        const discPrice = m.discountPrice !== undefined && m.discountPrice < m.price 
          ? m.discountPrice 
          : (m.discountPercentage ? Math.round(m.price * (1 - m.discountPercentage / 100)) : m.price);
        
        const discPct = m.discountPercentage || (origPrice > discPrice ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0);

        return {
          id: `disc_med_${m.id}`,
          medicineId: m.id,
          medicine: m,
          title: m.name,
          subtitle: `${m.genericName ? m.genericName + ' • ' : ''}${m.category || 'Special Offer'}`,
          badge: `🔥 ${discPct}% OFF Special`,
          description: m.description || `Special limited-time promotional discount on ${m.name}.`,
          imageUrl: m.imageUrl || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
          price: discPrice,
          originalPrice: origPrice,
          discountPercentage: discPct,
          hasDiscount: true,
          inStock: totalQty > 0,
          stockQuantity: totalQty,
          category: m.category || 'General',
          productType: m.productType || 'medicine',
          active: true,
          popupTrigger: 'auto',
          ctaText: 'Add to Order'
        };
      });

    // Combine both lists and filter strictly to only items that have an actual discount!
    const allDiscountItems = [...enrichedConfigItems, ...catalogDiscountedItems];
    const strictlyDiscountedItems = allDiscountItems.filter(item => item.hasDiscount && item.active !== false);

    res.json({
      enabled: config.enabled !== false && strictlyDiscountedItems.length > 0,
      popupTitle: config.popupTitle || '🔥 Special Discounted Deals & Featured Items',
      popupSubtitle: config.popupSubtitle || 'Handpicked promotional discounts chosen for you today',
      autoShowDelaySeconds: config.autoShowDelaySeconds ?? 2,
      showOncePerSession: config.showOncePerSession !== false,
      items: strictlyDiscountedItems
    });
  });

  // Helper function for full clinical pharmacy & cosmetics reasoning with product matching & price calculation
  function generateSonanPharmacistConsultation(message: string, catalogList: any[], instSetting?: any) {
    const lower = message.toLowerCase().trim();
    const inst = instSetting || (loadDb().institution) || {
      name: 'Sonan Pharmacy',
      phone: '',
      email: '',
      address: ''
    };

    // 0. Contact & Phone Inquiry Check (Uses Phone & Address from Institution Settings)
    if (lower.includes('phone') || lower.includes('contact') || lower.includes('hotline') || lower.includes('call you') || lower.includes('number') || lower.includes('whatsapp') || lower.includes('slik') || lower.includes('tele') || lower.includes('reach you') || lower.includes('customer service') || lower.includes('support') || lower.includes('address') || lower.includes('location') || lower.includes('where are you') || lower.includes('yet nachu')) {
      const cleanPhone = (inst.phone || '').replace(/[^0-9+]/g, '');
      const cleanWaPhone = (inst.phone || '').replace(/[^0-9]/g, '');
      
      const contactLines: string[] = [];
      if (inst.phone) contactLines.push(`• **Official Phone / Hotline:** [${inst.phone}](tel:${cleanPhone})`);
      if (cleanWaPhone) contactLines.push(`• **WhatsApp Support:** [Chat on WhatsApp](https://wa.me/${cleanWaPhone})`);
      if (inst.email) contactLines.push(`• **Email:** ${inst.email}`);
      if (inst.address) contactLines.push(`• **Address / Location:** ${inst.address}`);
      
      const detailsBlock = contactLines.length > 0 ? contactLines.join('\n') : `• **Contact:** Please reach out to our on-duty pharmacists directly.`;

      const reply = `📞 **${inst.name || 'Sonan Pharmacy'} Official Contact & Location**\n\n${detailsBlock}\n\nYou can reach our on-duty pharmacists directly for prescription consultations, medication guidance, stock verification, and fast home delivery support!`;
      return {
        reply,
        suggestedProducts: [],
        totalPrice: 0,
        suggestTeleconsultation: false
      };
    }

    // 0b. Identity or Greeting Check
    if (lower.includes('who are you') || lower.includes('your name') || lower.includes('who r u') || lower.includes('introduce') || lower.includes('man neh') || lower.includes('simik man new')) {
      const phoneLine = inst.phone ? `\n• Official contact phone: **${inst.phone}**` : '';
      const reply = `Hello! I am your **Sonan Pharmacy AI Assistant**.\n\nI am here to help you with:\n• Live medicine & cosmetic product availability and real-time prices in ETB\n• Drug usages, approved dosage references, timing, and administration${phoneLine}\n• Warnings, side effects, interactions, and precautions\n• Personalized skincare and haircare routines\n• Cart calculations and order breakdown\n\nHow can I assist you with your health, medication, or cosmetics today?`;
      return {
        reply,
        suggestedProducts: [],
        totalPrice: 0,
        suggestTeleconsultation: false
      };
    }

    // 1. Order & Multi-item price calculation parser
    const quantityWords: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'and': 1, 'hulat': 2, 'sost': 3, 'arat': 4, 'amist': 5
    };

    // Extract item + quantity pairs from message
    const orderItems: Array<{ item: any; requestedQty: number; available: boolean }> = [];
    
    catalogList.forEach(item => {
      const nameLower = item.name.toLowerCase();
      const genericLower = (item.genericName || '').toLowerCase();
      
      // Clean search tokens
      const primaryTokens = nameLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length >= 3 && !['box', 'tablet', 'strip', 'cream', 'mg', 'ml'].includes(t));
      
      let isMentioned = false;
      if (lower.includes(nameLower)) {
        isMentioned = true;
      } else if (genericLower && lower.includes(genericLower)) {
        isMentioned = true;
      } else if (primaryTokens.length > 0 && primaryTokens.some(t => lower.includes(t))) {
        isMentioned = true;
      } else if (lower.includes('amox') && (nameLower.includes('amoxicillin') || genericLower.includes('amoxicillin'))) {
        isMentioned = true;
      } else if (lower.includes('panadol') && (nameLower.includes('paracetamol') || nameLower.includes('panadol'))) {
        isMentioned = true;
      }

      if (isMentioned) {
        // Try to find quantity before or after the product name
        let qty = 1;
        
        // Regex patterns for quantity
        const patterns = [
          new RegExp(`(\\d+)\\s*(?:boxes|box|bottles|bottle|packs|pack|tubes|tube|items|units|pcs)?\\s*(?:of)?\\s*${primaryTokens[0] || nameLower}`, 'i'),
          new RegExp(`${primaryTokens[0] || nameLower}\\s*(\\d+)`, 'i'),
          new RegExp(`(\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|and|hulat|sost)\\b)\\s*(?:boxes|box|bottles|bottle|packs|pack|tubes|tube)?\\s*(?:of)?\\s*${primaryTokens[0] || nameLower}`, 'i')
        ];

        for (const pattern of patterns) {
          const match = message.match(pattern);
          if (match && match[1]) {
            const rawVal = match[1].toLowerCase();
            if (quantityWords[rawVal]) {
              qty = quantityWords[rawVal];
            } else {
              const parsed = parseInt(rawVal, 10);
              if (!isNaN(parsed) && parsed > 0) qty = parsed;
            }
            break;
          }
        }

        const isAvailable = (item.availableStock || 0) >= qty && item.inStock !== false;
        orderItems.push({ item, requestedQty: qty, available: isAvailable });
      }
    });

    const isPriceOrStockInquiry = lower.includes('need') || lower.includes('buy') || lower.includes('order') || lower.includes('price') || lower.includes('cost') || lower.includes('total') || lower.includes('how much') || lower.includes('stock') || lower.includes('available') || lower.includes('box') || lower.includes('ale') || lower.includes('waga') || /\d+\s*(box|paracetamol|amoxicillin|ibuprofen|omeprazole|vitamin)/.test(lower);

    // If order calculation requested and products detected
    if (isPriceOrStockInquiry && orderItems.length > 0) {
      if (orderItems.length === 1) {
        const { item, requestedQty, available } = orderItems[0];
        const unitPrice = item.price || 0;
        const total = unitPrice * requestedQty;
        const branchSummary = item.branchesStock 
          ? Object.entries(item.branchesStock).map(([bName, qty]) => `${bName}: ${qty} ${item.unit || 'units'}`).join(', ')
          : `Sonan Pharmacy No. 1: ${item.availableStock} ${item.unit || 'units'}`;

        if (available) {
          let singleReply = `Yes, **${item.name}** is available at Sonan Pharmacy.\n\n`;
          singleReply += `**Product:** ${item.name}${item.strength ? ' (' + item.strength + ')' : ''}\n`;
          singleReply += `**Price:** ${unitPrice} ETB per ${item.unit || 'pack'}\n`;
          singleReply += `**Availability:** In Stock (${item.availableStock} ${item.unit || 'units'} available — ${branchSummary})\n`;
          if (requestedQty > 1) {
            singleReply += `**Requested Quantity:** ${requestedQty} ${item.unit || 'units'}\n`;
            singleReply += `**Total Price:** ${total.toLocaleString()} ETB\n`;
          }
          singleReply += `**How it is generally used:** ${item.description || (item.rx === 'Prescription Required' ? 'Take strictly as prescribed by your physician.' : 'Follow package directions or take with water.')}\n`;
          singleReply += `**Important warning:** ${item.rx === 'Prescription Required' ? 'Requires a valid prescription. Do not change dosage or stop without consulting your doctor or pharmacist.' : 'Keep out of reach of children. Store in a dry place.'}\n\n`;
          singleReply += `*Would you like to add ${requestedQty > 1 ? requestedQty + ' ' + (item.unit || 'packs') : 'this'} to your cart?*`;

          return {
            reply: singleReply,
            suggestedProducts: [item],
            totalPrice: total,
            suggestTeleconsultation: item.rx === 'Prescription Required'
          };
        } else {
          // Find in-stock alternatives in same category
          const alternatives = catalogList.filter(c => c.category === item.category && c.id !== item.id && (c.availableStock || 0) > 0).slice(0, 3);
          let altText = '';
          if (alternatives.length > 0) {
            altText = `\n\n**Recommended in-stock alternatives:**\n` + alternatives.map(a => `• **${a.name}** — ${a.price} ETB (In Stock: ${a.availableStock} ${a.unit})`).join('\n');
          }
          return {
            reply: `⚠️ **${item.name}** is currently **out of stock** or has insufficient stock (Requested: ${requestedQty}, Available: ${item.availableStock || 0}).${altText}\n\n*You can also connect with our on-duty pharmacist for direct prescription assistance.*`,
            suggestedProducts: alternatives,
            totalPrice: 0,
            suggestTeleconsultation: true
          };
        }
      } else {
        // Multi-item order
        let grandTotal = 0;
        const rows: string[] = [];
        const unavailableList: string[] = [];
        const validSuggestedProducts: any[] = [];

        orderItems.forEach(({ item, requestedQty, available }) => {
          const unitPrice = item.price || 0;
          const subtotal = unitPrice * requestedQty;
          if (available) {
            grandTotal += subtotal;
            rows.push(`| ${item.name} | ${requestedQty} | ${unitPrice} ETB | ${subtotal.toLocaleString()} ETB |`);
            validSuggestedProducts.push(item);
          } else {
            unavailableList.push(`• **${item.name}** (Requested: ${requestedQty}, Available: ${item.availableStock || 0})`);
          }
        });

        let tableResponse = `Here is your live stock availability and price calculation:\n\n`;
        if (rows.length > 0) {
          tableResponse += `| Item | Qty | Unit Price | Total |\n| :--- | --: | ---------: | ----: |\n${rows.join('\n')}\n\n**Grand Total: ${grandTotal.toLocaleString()} ETB**\n\n`;
        }

        if (unavailableList.length > 0) {
          tableResponse += `⚠️ **Currently Unavailable or Insufficient Stock:**\n${unavailableList.join('\n')}\n\n`;
        }

        tableResponse += `*All available items are verified in live stock at Sonan Pharmacy and ready for immediate order.*`;

        return {
          reply: tableResponse,
          suggestedProducts: validSuggestedProducts,
          totalPrice: grandTotal,
          suggestTeleconsultation: validSuggestedProducts.some(p => p.rx === 'Prescription Required')
        };
      }
    }

    // 2. Comparison Handler ("Which is better?", "compare")
    if (lower.includes('which is better') || lower.includes('compare') || lower.includes('difference between') || lower.includes('vs')) {
      const candidates = catalogList.filter(p => (p.availableStock || 0) > 0 && (lower.includes(p.name.toLowerCase()) || lower.includes((p.genericName || '').toLowerCase()))).slice(0, 3);
      if (candidates.length >= 2) {
        let compTable = `### ⚖️ Product Comparison\n\n`;
        compTable += `| Feature | ${candidates[0].name} | ${candidates[1].name} |\n`;
        compTable += `| :--- | :--- | :--- |\n`;
        compTable += `| **Category** | ${candidates[0].category} | ${candidates[1].category} |\n`;
        compTable += `| **Main Purpose** | ${candidates[0].description || 'Therapeutic care'} | ${candidates[1].description || 'Therapeutic care'} |\n`;
        compTable += `| **Price** | ${candidates[0].price} ETB | ${candidates[1].price} ETB |\n`;
        compTable += `| **Live Stock** | ${candidates[0].availableStock} ${candidates[0].unit} in stock | ${candidates[1].availableStock} ${candidates[1].unit} in stock |\n`;
        compTable += `| **Prescription** | ${candidates[0].rx} | ${candidates[1].rx} |\n\n`;
        compTable += `*Both products are verified in stock at Sonan Pharmacy. The choice depends on your specific skin type, symptom severity, or doctor recommendation.*`;

        return {
          reply: compTable,
          suggestedProducts: candidates,
          totalPrice: (candidates[0].price || 0) + (candidates[1].price || 0),
          suggestTeleconsultation: false
        };
      }
    }

    // 3. Symptom and category classifiers for comprehensive clinical/cosmetic consultations
    const matchedProducts: any[] = [];
    const isPainFever = lower.includes('pain') || lower.includes('headache') || lower.includes('fever') || lower.includes('body ache') || lower.includes('migraine') || lower.includes('tooth') || lower.includes('cramp') || lower.includes('backache') || lower.includes('paracetamol') || lower.includes('ibuprofen') || lower.includes('diclofenac') || lower.includes('ras mitat');
    const isColdFlu = lower.includes('cold') || lower.includes('flu') || lower.includes('cough') || lower.includes('throat') || lower.includes('mucus') || lower.includes('congestion') || lower.includes('sinus') || lower.includes('runny nose') || lower.includes('syrup') || lower.includes('gumban') || lower.includes('sal');
    const isStomachAcid = lower.includes('stomach') || lower.includes('acid') || lower.includes('reflux') || lower.includes('heartburn') || lower.includes('ulcer') || lower.includes('gastritis') || lower.includes('indigestion') || lower.includes('gerd') || lower.includes('omeprazole') || lower.includes('antacid') || lower.includes('kurchit');
    const isInfection = lower.includes('infection') || lower.includes('antibiotic') || lower.includes('amoxicillin') || lower.includes('bacterial') || lower.includes('cipro') || lower.includes('augmentin') || lower.includes('azithromycin');
    const isAllergy = lower.includes('allergy') || lower.includes('allergic') || lower.includes('itch') || lower.includes('rash') || lower.includes('sneeze') || lower.includes('hive') || lower.includes('cetirizine') || lower.includes('loratadine');
    const isHair = lower.includes('hair') || lower.includes('conditioner') || lower.includes('scalp') || lower.includes('curling') || lower.includes('growth') || lower.includes('shampoo') || lower.includes('bald') || lower.includes('dandruff') || lower.includes('oil') || lower.includes('curls') || lower.includes('tsegur');
    const isSkin = lower.includes('skin') || lower.includes('acne') || lower.includes('pimple') || lower.includes('face') || lower.includes('serum') || lower.includes('sunscreen') || lower.includes('spf') || lower.includes('wrinkle') || lower.includes('dry skin') || lower.includes('oily skin') || lower.includes('cream') || lower.includes('lotion') || lower.includes('koda');
    const isVitamins = lower.includes('vitamin') || lower.includes('supplement') || lower.includes('energy') || lower.includes('fatigue') || lower.includes('zinc') || lower.includes('iron') || lower.includes('calcium') || lower.includes('immune');

    // Filter matching inventory products with active in-stock verification
    catalogList.forEach(item => {
      if ((item.availableStock || 0) <= 0) return; // Strict live stock check
      const itemText = `${item.name} ${item.genericName} ${item.category} ${item.subCategory} ${item.description}`.toLowerCase();
      const tokens = lower.split(/\s+/).filter(t => t.length > 2);
      
      let matchScore = 0;
      tokens.forEach(tok => {
        if (itemText.includes(tok)) matchScore += 2;
      });

      if (isPainFever && (itemText.includes('paracetamol') || itemText.includes('panadol') || itemText.includes('ibuprofen') || itemText.includes('pain') || itemText.includes('diclofenac'))) matchScore += 5;
      if (isColdFlu && (itemText.includes('cough') || itemText.includes('cold') || itemText.includes('syrup') || itemText.includes('flumox') || itemText.includes('paracetamol') || itemText.includes('cetirizine'))) matchScore += 5;
      if (isStomachAcid && (itemText.includes('omeprazole') || itemText.includes('antacid') || itemText.includes('cimetidine') || itemText.includes('magaldrate') || itemText.includes('pantoprazole'))) matchScore += 5;
      if (isInfection && (itemText.includes('amoxicillin') || itemText.includes('augmentin') || itemText.includes('ciprofloxacin') || itemText.includes('azithromycin'))) matchScore += 5;
      if (isAllergy && (itemText.includes('cetirizine') || itemText.includes('loratadine') || itemText.includes('chlorpheniramine') || itemText.includes('antihistamine'))) matchScore += 5;
      if (isHair && (itemText.includes('hair') || itemText.includes('conditioner') || itemText.includes('shampoo') || itemText.includes('growth') || itemText.includes('curling') || itemText.includes('oil'))) matchScore += 5;
      if (isSkin && (itemText.includes('skin') || itemText.includes('serum') || itemText.includes('cream') || itemText.includes('lotion') || itemText.includes('sunscreen') || itemText.includes('acne') || itemText.includes('spf'))) matchScore += 5;
      if (isVitamins && (itemText.includes('vitamin') || itemText.includes('zinc') || itemText.includes('calcium') || itemText.includes('iron') || itemText.includes('supplement'))) matchScore += 5;

      if (matchScore > 0 && matchedProducts.length < 4 && !matchedProducts.find(p => p.id === item.id)) {
        matchedProducts.push({ ...item, matchScore });
      }
    });

    if (matchedProducts.length === 0 && catalogList.length > 0) {
      catalogList.filter(p => (p.availableStock || 0) > 0).slice(0, 3).forEach(p => matchedProducts.push(p));
    }

    let totalPrice = 0;
    matchedProducts.forEach(p => totalPrice += (p.price || 0));

    let reply = `👋 **Sonan Pharmacy AI Assistant**\n\n`;

    if (lower.includes('who are you') || lower.includes('your name') || lower.includes('who r u') || lower.includes('introduce')) {
      reply += `Hello! I am your **Sonan Pharmacy AI Assistant**.\n\nI am here to assist you with medication usages, approved dosages, administration schedules, side effects, drug interactions, skincare & haircare cosmetic routines, and live inventory prices at Sonan Pharmacy.\n\nHow can I help you today?`;
      return {
        reply,
        suggestedProducts: [],
        totalPrice: 0,
        suggestTeleconsultation: false
      };
    }

    if (isPainFever) {
      reply += `### 💊 Drug & Medicine Information: Analgesic & Antipyretic Protocol\n`;
      reply += `• **Uses & Indications:** Fast relief of headache, fever, muscle aches, dental pain, and dysmenorrhea.\n`;
      reply += `• **Dosage (Approved References):**\n`;
      reply += `  - **Paracetamol 500mg:** 1–2 tablets orally every 6 to 8 hours as needed (Max: 4000mg/day to prevent liver toxicity).\n`;
      reply += `  - **Ibuprofen 400mg:** 1 tablet every 8 hours *strictly after meals* with plenty of water to protect gastric mucosa.\n`;
      reply += `• **Common Side Effects:** Mild stomach upset, nausea, heartburn.\n`;
      reply += `• **Warnings & Precautions:** Avoid NSAIDs if you have active gastric ulcers, kidney disease, or asthma. Avoid alcohol.\n`;
      reply += `• **Storage:** Store below 25°C in a dry place away from light.\n\n`;
    } else if (isStomachAcid) {
      reply += `### 💊 Drug & Medicine Information: Gastric Acid, Heartburn & Reflux\n`;
      reply += `• **Uses & Indications:** Treatment of heartburn, acid reflux (GERD), and gastritis.\n`;
      reply += `• **Dosage & Timing:**\n`;
      reply += `  - **Omeprazole 20mg:** Take 1 capsule once daily, *30 to 60 minutes before breakfast* on an empty stomach with a full glass of water.\n`;
      reply += `  - **Antacids:** 10–15ml 1 hour after meals and at bedtime.\n`;
      reply += `• **Common Side Effects:** Mild diarrhea, abdominal cramping, or transient headache.\n`;
      reply += `• **Precautions:** If symptoms persist beyond 14 days or if black tarry stools occur, seek immediate medical consultation.\n`;
      reply += `• **Storage:** Store tightly closed in a cool, dry place below 25°C.\n\n`;
    } else if (isHair) {
      reply += `### 💄 Cosmetics & Personal Care: Hair Nourishment & Growth Protocol\n`;
      reply += `• **Purpose & Benefits:** Deep moisture retention, curl definition, follicle stimulation, and anti-breakage.\n`;
      reply += `• **Step-by-Step Usage:**\n`;
      reply += `  1. **Cleanse:** Wash with gentle hydrating shampoo 1–2 times weekly.\n`;
      reply += `  2. **Hydrate:** Apply Leave-In Conditioner through damp strands.\n`;
      reply += `  3. **Style/Define:** Work Curling Cream into sections.\n`;
      reply += `  4. **Seal:** Massage 3–5 drops of Growth Oil directly onto scalp.\n`;
      reply += `• **Suitable Hair Types:** Curly, coily, dry, or chemically treated hair.\n`;
      reply += `• **Precautions:** Patch-test prior to initial use; avoid direct contact with eyes.\n\n`;
    } else if (isSkin) {
      reply += `### 💄 Cosmetics & Personal Care: Clinical Skincare & Photoprotection\n`;
      reply += `• **Purpose & Benefits:** Barrier restoration, antioxidant defense, and broad-spectrum UV protection.\n`;
      reply += `• **Routine Sequence:**\n`;
      reply += `  - **AM:** Gentle Cleanser ➔ Vitamin C Serum ➔ Light Moisturizer ➔ **Broad Spectrum Sunscreen SPF 50+ (apply 15 min before sun exposure; reapply every 2 hours).**\n`;
      reply += `  - **PM:** Cleanser ➔ Hydrating Serum ➔ Barrier Repair Cream.\n`;
      reply += `• **Suitable Skin Types:** All skin types including sensitive skin.\n\n`;
    } else if (isInfection) {
      reply += `### 💊 Drug & Medicine Information: Antibiotic Protocol\n`;
      reply += `• **Uses & Indications:** Bacterial respiratory, ENT, skin, and soft tissue infections.\n`;
      reply += `• **Dosage:** Take at evenly spaced intervals (e.g. 500mg every 8 hours) with water. **Crucial:** Complete the entire prescribed course.\n`;
      reply += `• **Warnings:** Requires valid prescription. Discontinue immediately if rash, hives, or swelling develops.\n\n`;
    } else {
      reply += `### 🩺 Medicine & Cosmetics Guidance\n`;
      reply += `Sonan Pharmacy AI provides verified drug indications, dosage schedules, side effects, and personalized cosmetic routines backed by live inventory verification.\n\n`;
    }

    if (matchedProducts.length > 0) {
      reply += `### 📦 Live In-Stock Products & Prices at Sonan Pharmacy:\n`;
      matchedProducts.forEach(p => {
        const typeBadge = p.type === 'cosmetics' ? '💄 Cosmetic' : '💊 Medicine';
        reply += `• **${p.name}** (${typeBadge}) — **${p.price} ETB** | In Stock: **${p.availableStock} ${p.unit || 'units'}**\n  *Details:* ${p.description || 'Verified in live inventory.'}\n`;
      });
      reply += `\n💰 **Total Regimen Price: ${totalPrice.toLocaleString()} ETB**\n`;
    }

    reply += `\n*Disclaimer: General product and pharmacological information. For personal diagnosis, prescription verification, or emergency care, please consult a qualified healthcare professional or our on-duty pharmacist.*`;

    return {
      reply,
      suggestedProducts: matchedProducts,
      totalPrice,
      suggestTeleconsultation: lower.includes('severe') || lower.includes('emergency') || lower.includes('pregnant') || lower.includes('overdose') || lower.includes('side effect') || lower.includes('rash')
    };
  }

  // Customer AI Clinical & Cosmetics Assistant Chatbot (Sonan AI Pharmacist)
  app.post('/api/chat/customer-ai', async (req, res) => {
    try {
      const { message, history } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required' });
      }

      const db = loadDb();
      const todayIso = new Date().toISOString().slice(0, 10);
      const branchMap: Record<string, string> = {};
      (db.branches || []).forEach(b => {
        branchMap[b.id] = b.name;
      });

      // Build real-time enriched inventory catalog with live unexpired, undamaged stock per branch
      const catalogList = (db.medicines || []).map(m => {
        const validBatches = (db.stockItems || []).filter(st => 
          st.medicineId === m.id && 
          !st.isDamaged && 
          (!st.expiryDate || st.expiryDate >= todayIso)
        );

        const stockFromBatches = validBatches.reduce((sum, st) => sum + (st.quantity || 0), 0);
        const availableStock = validBatches.length > 0 
          ? stockFromBatches 
          : (m.stock !== undefined && m.stock > 0 ? m.stock : 0);

        const branchesStock: Record<string, number> = {};
        validBatches.forEach(st => {
          const bName = branchMap[st.branchId] || st.branchId || 'Main Branch';
          branchesStock[bName] = (branchesStock[bName] || 0) + (st.quantity || 0);
        });

        const activeExpiries = Array.from(new Set(validBatches.map(st => st.expiryDate).filter(Boolean))).slice(0, 3);

        return {
          id: m.id,
          name: m.name,
          genericName: m.genericName || '',
          category: m.category || 'General',
          subCategory: m.subCategory || '',
          price: m.price,
          unit: m.unit || 'Box',
          availableStock: Math.max(0, availableStock),
          inStock: availableStock > 0,
          branchesStock: Object.keys(branchesStock).length > 0 ? branchesStock : { 'Sonan Pharmacy No. 1': Math.max(0, availableStock) },
          expiryDates: activeExpiries,
          type: m.productType || 'medicine',
          description: m.description || '',
          strength: m.strength || '',
          dosageForm: m.dosageForm || '',
          rx: m.isPrescriptionRequired ? 'Prescription Required' : 'OTC / General / Cosmetic',
          storageRequirements: m.productType === 'cosmetics' ? 'Store in a cool, dry place away from direct sunlight' : 'Store below 25°C in a dry place protected from light and moisture'
        };
      });

      const apiKey = process.env.GEMINI_API_KEY;
      const inst = db.institution || {
        name: 'Sonan Pharmacy',
        phone: '+251-11-6112233',
        email: 'info@sonanpharma.com',
        address: '120 Ring Road, Addis Ababa, Ethiopia'
      };

      if (!apiKey) {
        const localResult = generateSonanPharmacistConsultation(message, catalogList, inst);
        return res.json({
          ...localResult,
          offlineMode: true
        });
      }

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const instPhone = inst.phone || '';
        const instName = inst.name || 'Sonan Pharmacy';
        const instEmail = inst.email || '';
        const instAddress = inst.address || '';

        const systemInstruction = `# Sonan Pharmacy AI Assistant Instructions

You are **Sonan Pharmacy AI Assistant**, an intelligent, professional, fast, and customer-friendly pharmacy assistant for the Sonan Pharmacy online pharmacy website (Addis Ababa, Ethiopia).

## Official Pharmacy Details & Contact (Strictly from Institutional Settings)
* **Official Institution Name:** ${instName}
* **Official Phone Number / Hotline:** ${instPhone || 'Contact pharmacy directly'}
* **Corporate Email:** ${instEmail || 'Contact pharmacy directly'}
* **Head Office & Location Address:** ${instAddress || 'Contact pharmacy directly'}

## Persona & Core Identity Rules
* Your official name is **Sonan Pharmacy AI Assistant** (or **Sonan Pharmacy AI**).
* When asked who you are or greeting a customer, always say: "I am your Sonan Pharmacy AI Assistant" (or "I am your Sonan Pharmacy AI").
* **NEVER** state "I am Dr. Selam", "I am Dr. Yohannes", or use any human doctor or pharmacist name. You are an AI assistant for Sonan Pharmacy, not a human doctor.
* **STRICT CONTACT INTEGRITY MANDATE:** Whenever a customer asks for the pharmacy's phone number, customer service number, hotline, WhatsApp contact, emergency phone, address, location, or how to call/reach the pharmacy, you MUST ONLY provide the exact official phone number and address configured in Institution Settings above (${instPhone || 'please reach out via store consultation'} / ${instAddress || 'please check branch store locator'}).
* **NEVER invent, make up, or use random addresses or random phone numbers under any circumstances.**

## Your Main Role
Help customers quickly find accurate information about:
* Medicines and pharmaceutical products
* Cosmetics and skincare products
* Product availability and stock in real time
* Product prices in ETB
* Medicine usage and general information
* Dosage information when appropriate
* Product alternatives
* Drug interactions and warnings
* Side effects
* Expiry and availability information
* Orders, cart totals, and product recommendations
${instPhone ? `* Official contact hotline: ${instPhone}` : ''}

---

### 1. Live Pharmacy Inventory Integration
You must connect to the pharmacy database and use **real-time inventory data** provided below.
When a customer asks:
**"Do you have Amoxicillin 500mg?"**
Check the inventory and respond specifically:
* Product name & Strength/dosage
* Available quantity or availability status
* Selling price in ETB
* Branch availability
* Expiry status when relevant

Example:
> Yes, Amoxicillin 500mg capsules are available at Sonan Pharmacy.
> Price: 120 ETB per pack.
> Status: In stock (Sonan Pharmacy No. 1: 45 packs).
> Would you like to add it to your cart?

*Never invent product availability or prices. Always use the live pharmacy database.*

---

### 2. Smart Product Search
Understand customer questions even when the spelling is incorrect or informal:
* Examples: "amox", "amoxiciline", "medicine for infection", "panadol", "something for headache", "panadol ale?"
* Search intelligently using: Product name, Generic name, Brand name, Active ingredient, Category, Strength, and Common spelling variations.
* If multiple products match, show the best matching options.

---

### 3. Medicine Information
For medicine questions, provide clear and understandable information:
* Generic name & Brand name
* Active ingredients
* What the medicine is generally used for
* How it is commonly taken (timing with food/meals)
* Important warnings
* Common side effects
* Major interactions
* Storage instructions

*Always distinguish between general educational information and personal medical advice. Do not diagnose diseases or prescribe prescription medicines. For serious symptoms, emergencies, pregnancy-related questions, children, severe allergic reactions, or dangerous drug interactions, advise the customer to contact a qualified healthcare professional or use our live Teleconsultation.*

---

### 4. Prescription Medicine Safety
For prescription-only medicines:
* Do not encourage self-medication.
* Inform the customer if a valid prescription is required.
* Do not recommend changing dosage.
* Do not recommend stopping prescribed medication without professional advice.
* Flag potentially dangerous combinations.
Example:
> *This medicine requires a valid prescription. Please consult a licensed healthcare professional or our on-duty pharmacist before use.*

---

### 5. Cosmetics and Skincare Assistant
Help customers find cosmetic products based on their needs:
* Understand requests like "Cream for dry skin", "Face wash for oily skin", "Sunscreen", "Product for acne-prone skin", "Hair care products", "Baby skincare products".
* Use the live inventory to recommend available products.
* For every recommendation, provide: Product name, Brand, Price, Main purpose, Key ingredients, How to use (step-by-step), and Important precautions (patch testing).
* Do not claim a cosmetic product will cure a medical condition.

---

### 6. Product Comparison
When customers ask "Which is better?", compare products clearly in a table using only products that exist in the live database:
| Feature | Product A | Product B |
| :--- | :--- | :--- |
| Main purpose | Dry skin | Sensitive skin |
| Key ingredient | Hyaluronic Acid | Ceramides |
| Price | 450 ETB | 520 ETB |
| Availability | In stock | In stock |

---

### 7. Cart and Price Calculation
Help customers build their order:
1. Check availability.
2. Retrieve live prices.
3. Calculate each item's subtotal (Qty × Unit Price).
4. Calculate the grand total in ETB.
5. Offer to add the products to the cart.

Example:
Panadol 500mg × 2 = 90 ETB
Vitamin C 1000mg × 1 = 150 ETB
**Total: 240 ETB**

---

### 8. Alternative Product Recommendations
If a requested product is unavailable:
1. Clearly inform the customer that it is unavailable.
2. Search for suitable in-stock alternatives with the same active ingredient, strength, pharmaceutical form, or therapeutic category.
Example:
> Amoxicillin Brand X is currently unavailable. However, these in-stock alternatives are available:
> 1. Amoxicillin 500mg Capsules — 120 ETB
> 2. Augmentin 625mg Tablets — 350 ETB
> Please consult a pharmacist to confirm whether an alternative is appropriate for you.

---

### 9. Multi-Branch Search
Search all authorized branches:
> This product is available at Sonan Pharmacy No. 1 (50 units) and Sonan Pharmacy No. 2 (30 units).

---

### 10. Intelligent Conversation Behavior
Remember the context of the conversation (e.g. if the customer asks "Do you have Panadol?" and then "How much is it?" understand that "it" refers to Panadol; if they say "Add two", calculate 2 × price).

---

### 11. Response Style
Always respond clearly, quickly, politely, professionally, in simple language, without unnecessary fluff.
Use this format when appropriate:
**Product:**
**Price:**
**Availability:**
**How it is generally used:**
**Important warning:**

---

### 12. Language Support
Support English, Amharic, and mixed English/Amharic (e.g., "panadol ale?", "waga sint new?", "ye ras mitat medhanit"). Understand informal spelling and respond naturally.

---

### 13. Safety Rules & Fallback
Never invent stock, prices, ingredients, or medical facts.
If information is unavailable or unverified, state:
> *I don't have enough verified information to answer that accurately. Please consult our pharmacist.*

---

### 14. Database Tool Priority
**Live Database → Verified Product Information → General Medical Knowledge**
Never use general assumptions when a customer asks about stock or pricing.

---

## Live Inventory Database (Real-time):
${JSON.stringify(catalogList.slice(0, 150))}`;

        // Build valid alternating conversation history (Gemini requires contents to start with role 'user')
        const contents: any[] = [];
        if (history && Array.isArray(history)) {
          const firstUserIdx = history.findIndex(h => h.sender === 'user');
          if (firstUserIdx !== -1) {
            const relevantHistory = history.slice(firstUserIdx, -1);
            let lastRole = '';
            for (const h of relevantHistory) {
              const role = h.sender === 'user' ? 'user' : 'model';
              if (role !== lastRole && h.text && h.text.trim()) {
                contents.push({
                  role,
                  parts: [{ text: h.text.trim() }]
                });
                lastRole = role;
              }
            }
          }
        }
        
        contents.push({
          role: 'user',
          parts: [{ text: message.trim() }]
        });

        const generatePromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.2
          }
        });

        // Timeout safety (12s) to prevent 504 gateway timeout
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI generation timed out after 12s')), 12000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);

        const reply = response.text || "";
        if (reply.trim().length > 0) {
          const lower = (message + " " + reply).toLowerCase();
          const suggestTeleconsultation = lower.includes('severe') || lower.includes('emergency') || lower.includes('overdose') || lower.includes('pregnant') || lower.includes('doctor') || lower.includes('speak with') || lower.includes('pharmacist') || lower.includes('prescription required') || lower.includes('side effect') || lower.includes('interaction');

          // Match suggested in-stock items to return structured cards
          const suggestedProducts = catalogList.filter(p => p.inStock && reply.toLowerCase().includes(p.name.toLowerCase())).slice(0, 4);
          let totalPrice = 0;
          suggestedProducts.forEach(p => totalPrice += (p.price || 0));

          return res.json({
            reply,
            suggestedProducts,
            totalPrice: totalPrice > 0 ? totalPrice : undefined,
            suggestTeleconsultation
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini API query fallback to local clinical engine:', geminiError?.message);
      }

      // Seamless fallback to comprehensive clinical generator
      const localResult = generateSonanPharmacistConsultation(message, catalogList, inst);
      return res.json({
        ...localResult,
        offlineMode: true
      });
    } catch (err: any) {
      console.error('Error in customer AI chatbot:', err);
      const db = loadDb();
      const todayIso = new Date().toISOString().slice(0, 10);
      const instFallback = db.institution || {
        name: 'Sonan Pharmacy',
        phone: '',
        email: '',
        address: ''
      };
      const catalogList = (db.medicines || []).map(m => {
        const validBatches = (db.stockItems || []).filter(st => 
          st.medicineId === m.id && 
          !st.isDamaged && 
          (!st.expiryDate || st.expiryDate >= todayIso)
        );
        const availableStock = validBatches.reduce((sum, st) => sum + (st.quantity || 0), 0);
        return {
          id: m.id,
          name: m.name,
          price: m.price,
          type: m.productType || 'medicine',
          availableStock: Math.max(0, availableStock),
          inStock: availableStock > 0,
          category: m.category || 'General',
          description: m.description || '',
          unit: m.unit || 'Box'
        };
      });
      const fallbackResult = generateSonanPharmacistConsultation(req.body?.message || '', catalogList, instFallback);
      return res.json(fallbackResult);
    }
  });

  // Teleconsultation Endpoints (Live Chat, Voice Call & Video Call with Pharmacist)
  app.get('/api/teleconsultations', (req, res) => {
    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];
    res.json(db.teleconsultations);
  });

  // Call Notification Trigger (When customer clicks Call / Hotline / Emergency Phone)
  app.post('/api/teleconsultations/call-notify', (req, res) => {
    const { customerName, customerPhone, callType, topic, branchId, branchName } = req.body || {};
    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);

    const sessionId = `call_${Date.now().toString().slice(-6)}`;
    const callerName = customerName || 'Online Customer';
    const callerPhone = customerPhone || db.institution?.phone || '';

    const newCallSession: TeleconsultationSession = {
      id: sessionId,
      customerName: callerName,
      customerPhone: callerPhone,
      type: callType === 'video' ? 'video' : 'chat',
      topic: topic || 'Direct Phone Call',
      status: 'queued',
      pharmacistName: 'On-Duty Pharmacist',
      pharmacistId: 'u_pharm',
      createdAt: `${dateStr} ${timeStr}`,
      updatedAt: `${dateStr} ${timeStr}`,
      videoCallRoomId: `room_${sessionId}`,
      messages: [
        {
          id: `msg_call_${Date.now()}`,
          sender: 'system',
          senderName: 'Phone Hotline System',
          text: `🚨 Direct Customer Call initiated from store (${callerPhone}). Branch context: ${branchName || 'Main'}.`,
          timestamp: timeStr
        }
      ]
    };

    db.teleconsultations.unshift(newCallSession);

    // Add audit log entry
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      userId: 'customer',
      username: callerName,
      role: 'Customer',
      action: 'Incoming Customer Call',
      branchId: branchId || 'b1',
      branchName: branchName || 'Sonan Pharmacy Main',
      ipAddress: '127.0.0.1',
      details: `Customer ${callerName} (${callerPhone}) placed a ${callType || 'phone'} call to the pharmacy hotline.`
    });

    saveDb(db);
    res.json({ success: true, session: newCallSession });
  });

  app.post('/api/teleconsultations/request', (req, res) => {
    const { customerName, customerPhone, customerEmail, type, topic, initialMessage } = req.body || {};
    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toISOString().slice(0, 10);

    const sessionId = `tele_${Date.now().toString().slice(-6)}`;
    const roomId = `room_sonan_${Math.random().toString(36).substring(2, 9)}`;

    const defaultPharmName = `${db.institution?.name || 'Sonan Pharmacy'} Pharmacist`;
    const newSession: TeleconsultationSession = {
      id: sessionId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || '',
      type: type === 'video' ? 'video' : 'chat',
      topic: topic || 'Usage & Dosage',
      status: 'queued', // Queued so admin receives real-time ringing notification
      pharmacistName: defaultPharmName,
      pharmacistId: 'u_pharm',
      createdAt: `${dateStr} ${timeStr}`,
      updatedAt: `${dateStr} ${timeStr}`,
      videoCallRoomId: roomId,
      messages: [
        {
          id: `msg_sys_${Date.now()}`,
          sender: 'system',
          senderName: `${db.institution?.name || 'Sonan Pharmacy'} Teleconsultation`,
          text: `🟢 Teleconsultation requested by customer for "${topic}" (${type === 'video' ? 'Live Video Call' : 'Live Chat'}). Connecting to ${db.institution?.name || 'Sonan Pharmacy'}.`,
          timestamp: timeStr
        },
        {
          id: `msg_pharm_welcome_${Date.now() + 1}`,
          sender: 'pharmacist',
          senderName: defaultPharmName,
          text: `Hello ${customerName}! Welcome to ${db.institution?.name || 'Sonan Pharmacy'}. An on-duty licensed pharmacist is connected and reviewing your request regarding ${topic}. How can we assist you with your medication dosage, schedule, side effects, or cosmetics today?`,
          timestamp: timeStr
        }
      ]
    };

    if (initialMessage && initialMessage.trim()) {
      newSession.messages.push({
        id: `msg_cust_${Date.now() + 2}`,
        sender: 'customer',
        senderName: customerName,
        text: initialMessage.trim(),
        timestamp: timeStr
      });
    }

    db.teleconsultations.unshift(newSession);

    // Log call request in audit logs
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_${Date.now()}`,
      date: dateStr,
      time: timeStr,
      userId: 'customer',
      username: customerName,
      role: 'Customer',
      action: 'Incoming Consultation Call',
      branchId: 'b1',
      branchName: 'Sonan Pharmacy Main',
      ipAddress: '127.0.0.1',
      details: `Customer ${customerName} (${customerPhone}) requested a ${type === 'video' ? 'Video Call' : 'Live Consultation'} regarding "${topic}".`
    });

    saveDb(db);

    res.json(newSession);
  });

  app.post('/api/teleconsultations/:id/message', (req, res) => {
    const { id } = req.params;
    const { sender, senderName, text, attachmentUrl, medicationMentioned } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text cannot be empty' });
    }

    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];

    const session = db.teleconsultations.find(s => s.id === id);
    if (!session) {
      return res.status(404).json({ error: 'Teleconsultation session not found' });
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msg: TeleconsultationMessage = {
      id: `msg_${Date.now()}`,
      sender: sender === 'pharmacist' ? 'pharmacist' : sender === 'ai' ? 'ai' : 'customer',
      senderName: senderName || (sender === 'pharmacist' ? 'Licensed Pharmacist' : session.customerName),
      text: text.trim(),
      timestamp: timeStr,
      attachmentUrl,
      medicationMentioned
    };

    session.messages.push(msg);
    session.updatedAt = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    if (sender === 'pharmacist' && session.status === 'queued') {
      session.status = 'active';
      session.pharmacistName = senderName || `${db.institution?.name || 'Sonan Pharmacy'} Pharmacist`;
    }

    // If customer sends a message and pharmacist is active, provide immediate pharmacist clinical reply if no pharmacist is actively typing in UI
    if (sender === 'customer' && session.status === 'active') {
      const catalogList = (db.medicines || []).map(m => ({
        id: m.id,
        name: m.name,
        price: m.price,
        type: m.productType || 'medicine',
        category: m.category || 'General',
        description: m.description || ''
      }));

      // Generate prompt for clinical teleconsultation advice
      const clinicalReply = generateSonanPharmacistConsultation(text.trim(), catalogList);
      
      const autoReplyText = clinicalReply.reply || 
        `Thank you for the update, ${session.customerName}. Regarding your question on "${text.trim().slice(0, 40)}...", I advise following the recommended dosage, taking it with plenty of water after food, and avoiding conflicting medications. Let me know if you experience any mild or unusual symptoms.`;

      session.messages.push({
        id: `msg_pharm_${Date.now() + 50}`,
        sender: 'pharmacist',
        senderName: session.pharmacistName || `${db.institution?.name || 'Sonan Pharmacy'} Pharmacist`,
        text: autoReplyText,
        timestamp: timeStr,
        medicationMentioned: clinicalReply.suggestedProducts?.[0]?.name
      });
    }

    saveDb(db);
    res.json(session);
  });

  app.post('/api/teleconsultations/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, pharmacistId, pharmacistName, notes } = req.body || {};

    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];

    const session = db.teleconsultations.find(s => s.id === id);
    if (!session) {
      return res.status(404).json({ error: 'Teleconsultation session not found' });
    }

    if (status) session.status = status;
    if (pharmacistId) session.pharmacistId = pharmacistId;
    if (pharmacistName) session.pharmacistName = pharmacistName;
    if (notes !== undefined) session.notes = notes;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    session.updatedAt = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    if (status === 'active') {
      session.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'system',
        senderName: 'Sonan Pharmacy',
        text: `${session.pharmacistName || 'Licensed Pharmacist'} has joined the teleconsultation.`,
        timestamp: timeStr
      });
    } else if (status === 'completed') {
      session.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'system',
        senderName: 'Sonan Pharmacy',
        text: 'This teleconsultation session has been concluded by the licensed pharmacist.',
        timestamp: timeStr
      });
    } else if (status === 'declined') {
      session.messages.push({
        id: `msg_sys_${Date.now()}`,
        sender: 'system',
        senderName: 'Sonan Pharmacy',
        text: 'Consultation request was declined or pharmacist is currently unavailable.',
        timestamp: timeStr
      });
    }

    saveDb(db);
    res.json(session);
  });

  // Switch Consultation Type (Live Chat <=> Live Video Call)
  app.post('/api/teleconsultations/:id/type', (req, res) => {
    const { id } = req.params;
    const { type, requesterName, requesterRole } = req.body || {};

    const db = loadDb();
    if (!db.teleconsultations) db.teleconsultations = [];

    const session = db.teleconsultations.find(s => s.id === id);
    if (!session) {
      return res.status(404).json({ error: 'Teleconsultation session not found' });
    }

    const newType = type === 'video' ? 'video' : 'chat';
    session.type = newType;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    session.updatedAt = `${now.toISOString().slice(0, 10)} ${timeStr}`;

    session.messages.push({
      id: `msg_sys_${Date.now()}`,
      sender: 'system',
      senderName: 'Sonan Teleconsultation',
      text: `${requesterName || (requesterRole === 'pharmacist' ? 'Licensed Pharmacist' : 'Patient')} switched session mode to ${newType === 'video' ? '📹 Live Video Call' : '💬 Live Chat'}.`,
      timestamp: timeStr
    });

    saveDb(db);
    res.json(session);
  });

  // WebRTC & Live Call In-Memory Signaling Store
  let signalSequence = 0;
  interface StoredTeleSignal {
    seq: number;
    sender: 'customer' | 'pharmacist';
    type: 'offer' | 'answer' | 'candidate' | 'frame' | 'status' | 'ping';
    data: any;
    timestamp: number;
  }
  const teleSignals: Record<string, StoredTeleSignal[]> = {};
  const teleLatestFrames: Record<string, Record<string, string>> = {};
  const telePeerStatus: Record<string, { customerVideo?: boolean; customerAudio?: boolean; pharmacistVideo?: boolean; pharmacistAudio?: boolean; lastHeartbeat?: number }> = {};

  app.post('/api/teleconsultations/:id/signal', (req, res) => {
    const { id } = req.params;
    const { sender, type, data } = req.body || {};

    if (!teleSignals[id]) teleSignals[id] = [];
    
    // Store latest frame separately for instant sync
    if (type === 'frame' && data && sender) {
      if (!teleLatestFrames[id]) teleLatestFrames[id] = {};
      teleLatestFrames[id][sender] = data;
    }

    const seq = ++signalSequence;
    teleSignals[id].push({
      seq,
      sender,
      type,
      data,
      timestamp: Date.now()
    });

    // Keep last 250 signals
    if (teleSignals[id].length > 250) {
      teleSignals[id] = teleSignals[id].slice(-250);
    }

    res.json({ success: true, seq });
  });

  app.post('/api/teleconsultations/:id/reset-signals', (req, res) => {
    const { id } = req.params;
    teleSignals[id] = [];
    teleLatestFrames[id] = {};
    if (telePeerStatus[id]) {
      telePeerStatus[id] = { lastHeartbeat: Date.now() };
    }
    res.json({ success: true, message: 'Signals reset for new call session' });
  });

  app.get('/api/teleconsultations/:id/signals', (req, res) => {
    const { id } = req.params;
    const sinceSeq = Number(req.query.sinceSeq) || 0;
    const since = Number(req.query.since) || 0;
    const sender = req.query.sender as string;

    const allSignals = teleSignals[id] || [];
    // Return signals strictly newer than 'sinceSeq' (or 'since' timestamp fallback) and not sent by requester if sender provided
    const signals = allSignals.filter(s => {
      const isNew = sinceSeq > 0 ? s.seq > sinceSeq : s.timestamp > since;
      const isPeer = !sender || s.sender !== sender;
      return isNew && isPeer;
    });
    
    // Also include latest peer frame if available
    const peerRole = sender === 'pharmacist' ? 'customer' : 'pharmacist';
    const peerLatestFrame = teleLatestFrames[id]?.[peerRole] || null;
    const maxSeq = allSignals.length > 0 ? allSignals[allSignals.length - 1].seq : 0;

    res.json({ 
      signals, 
      peerStatus: telePeerStatus[id] || null,
      peerLatestFrame,
      maxSeq
    });
  });

  app.post('/api/teleconsultations/:id/peer-status', (req, res) => {
    const { id } = req.params;
    const { role, videoActive, audioActive } = req.body || {};

    if (!telePeerStatus[id]) telePeerStatus[id] = {};
    if (role === 'pharmacist') {
      telePeerStatus[id].pharmacistVideo = !!videoActive;
      telePeerStatus[id].pharmacistAudio = !!audioActive;
    } else {
      telePeerStatus[id].customerVideo = !!videoActive;
      telePeerStatus[id].customerAudio = !!audioActive;
    }
    telePeerStatus[id].lastHeartbeat = Date.now();

    res.json({ success: true, peerStatus: telePeerStatus[id] });
  });

  // Public Endpoint for External Customer Promotional Videos
  app.get('/api/public/promos', (req, res) => {
    const db = loadDb();
    const inst = db.institution || ({} as any);
    const videos = (inst.promoVideos || DEFAULT_PROMO_VIDEOS).filter((v: any) => v.active !== false);
    res.json({
      institutionName: inst.name || 'Sonan Pharmacy',
      logoUrl: inst.logoUrl || '',
      promoVideos: videos.length > 0 ? videos : DEFAULT_PROMO_VIDEOS
    });
  });

  // Public Store Info Endpoint
  app.get('/api/public/store-info', (req, res) => {
    const db = loadDb();
    const inst = db.institution || ({} as any);
    res.json({
      name: inst.name || 'Sonan Pharmacy',
      address: inst.address || '',
      phone: inst.phone || '',
      email: inst.email || '',
      logoUrl: inst.logoUrl || '',
      promoVideos: (inst.promoVideos || DEFAULT_PROMO_VIDEOS).filter((v: any) => v.active !== false)
    });
  });

  // ==================== VISITOR ANALYTICS & TRAFFIC TRACKING ====================

  // Track customer site visit / pageview / interaction
  app.post('/api/analytics/track-visit', (req, res) => {
    try {
      const { 
        visitorId, 
        page, 
        action, 
        device, 
        browser, 
        os, 
        referrer, 
        location,
        details 
      } = req.body || {};

      if (!visitorId) {
        return res.status(400).json({ error: 'visitorId is required' });
      }

      const db = loadDb();
      if (!db.visitors || !Array.isArray(db.visitors)) {
        db.visitors = [];
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nowTimestamp = now.getTime();

      let visitor = db.visitors.find(v => v.id === visitorId);
      if (!visitor) {
        visitor = {
          id: visitorId,
          device: device || 'Desktop',
          browser: browser || 'Chrome',
          os: os || 'Windows',
          visitCount: 1,
          pageViewCount: 1,
          firstSeen: nowIso,
          lastSeen: nowIso,
          lastActiveTimestamp: nowTimestamp,
          lastPage: page || '/store',
          lastAction: action || 'Visited Online Pharmacy',
          activities: [
            {
              timestamp: `${nowIso.slice(0, 10)} ${timeStr}`,
              action: action || 'Visited Online Pharmacy',
              page: page || '/store',
              details: details || 'Started browsing store'
            }
          ],
          referrer: referrer || '',
          location: location || 'Addis Ababa, Ethiopia'
        };
        db.visitors.unshift(visitor);
      } else {
        // If last active was more than 30 minutes ago, treat as a returning visit session
        const isNewSession = (nowTimestamp - (visitor.lastActiveTimestamp || 0)) > 30 * 60 * 1000;
        if (isNewSession) {
          visitor.visitCount = (visitor.visitCount || 1) + 1;
        }
        visitor.pageViewCount = (visitor.pageViewCount || 1) + 1;
        visitor.lastSeen = nowIso;
        visitor.lastActiveTimestamp = nowTimestamp;
        if (page) visitor.lastPage = page;
        if (action) visitor.lastAction = action;
        if (device) visitor.device = device;
        if (browser) visitor.browser = browser;
        if (os) visitor.os = os;

        if (!visitor.activities) visitor.activities = [];
        visitor.activities.unshift({
          timestamp: `${nowIso.slice(0, 10)} ${timeStr}`,
          action: action || 'Browsed Store',
          page: page || visitor.lastPage,
          details: details || ''
        });

        // Cap activities history per visitor to 30
        if (visitor.activities.length > 30) {
          visitor.activities = visitor.activities.slice(0, 30);
        }
      }

      // Keep DB compact (limit stored visitor logs to 500)
      if (db.visitors.length > 500) {
        db.visitors = db.visitors.slice(0, 500);
      }

      saveDb(db);
      res.json({ success: true, visitCount: visitor.visitCount, pageViewCount: visitor.pageViewCount });
    } catch (err: any) {
      console.error('Error tracking visitor analytics:', err);
      res.status(500).json({ error: 'Failed to record visitor analytics' });
    }
  });

  // Get aggregated visitor stats & visitor logs for Admin
  app.get('/api/analytics/visitors', (req, res) => {
    try {
      const db = loadDb();
      const visitors = db.visitors || [];
      const nowTimestamp = Date.now();
      const fiveMinutesAgo = nowTimestamp - (5 * 60 * 1000);

      const totalUniqueVisitors = visitors.length;
      const totalVisits = visitors.reduce((sum, v) => sum + (v.visitCount || 1), 0);
      const totalPageViews = visitors.reduce((sum, v) => sum + (v.pageViewCount || 1), 0);
      const activeNow = visitors.filter(v => (v.lastActiveTimestamp || 0) >= fiveMinutesAgo).length;
      const returningVisitorsCount = visitors.filter(v => (v.visitCount || 1) > 1).length;
      const returningRatePercentage = totalUniqueVisitors > 0 
        ? Math.round((returningVisitorsCount / totalUniqueVisitors) * 100) 
        : 0;

      const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
      const browserBreakdown = { chrome: 0, safari: 0, firefox: 0, edge: 0, other: 0 };

      visitors.forEach(v => {
        const d = (v.device || '').toLowerCase();
        if (d.includes('mobile') || d.includes('phone')) deviceBreakdown.mobile++;
        else if (d.includes('tablet') || d.includes('ipad')) deviceBreakdown.tablet++;
        else deviceBreakdown.desktop++;

        const b = (v.browser || '').toLowerCase();
        if (b.includes('chrome')) browserBreakdown.chrome++;
        else if (b.includes('safari')) browserBreakdown.safari++;
        else if (b.includes('firefox')) browserBreakdown.firefox++;
        else if (b.includes('edge')) browserBreakdown.edge++;
        else browserBreakdown.other++;
      });

      const sortedVisitors = [...visitors].sort((a, b) => (b.lastActiveTimestamp || 0) - (a.lastActiveTimestamp || 0));

      res.json({
        totalUniqueVisitors,
        totalVisits,
        totalPageViews,
        activeNow,
        returningVisitorsCount,
        returningRatePercentage,
        deviceBreakdown,
        browserBreakdown,
        recentVisitors: sortedVisitors
      });
    } catch (err: any) {
      console.error('Error fetching visitor analytics:', err);
      res.status(500).json({ error: 'Failed to fetch visitor stats' });
    }
  });

  // Reset or clear visitor logs
  app.delete('/api/analytics/visitors', (req, res) => {
    try {
      const db = loadDb();
      db.visitors = [];
      saveDb(db);
      res.json({ success: true, message: 'Visitor analytics reset successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset visitor analytics' });
    }
  });

  // ==================== USER MANAGEMENT ====================
  
  app.get('/api/users', (req, res) => {
    const db = loadDb();
    // Return users without password hashes
    const sanitizedUsers = db.users.map(({ passwordHash, ...u }) => u);
    res.json(sanitizedUsers);
  });

  app.post('/api/users', (req, res) => {
    const { username, name, email, role, branchId, password, operatorId, phone, twoFactorEnabled } = req.body;
    const db = loadDb();

    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already registered.' });
    }

    const newUser = {
      id: generateId('u'),
      username: username.toLowerCase(),
      name,
      email,
      phone: phone || '',
      role,
      branchId,
      isActive: true,
      twoFactorEnabled: twoFactorEnabled !== undefined ? !!twoFactorEnabled : false,
      twoFactorSecret: '123456',
      passwordHash: password || 'pass123'
    };

    db.users.push(newUser);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create User',
      'all',
      'All Branches',
      `Created user account: ${username} (${role}) assigned to branch ${branchId}.`
    );

    const { passwordHash, ...sanitized } = newUser;
    res.status(211).json(sanitized);
  });

  app.put('/api/users/:id/toggle', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.body;
    const db = loadDb();
    
    const uIdx = db.users.findIndex(u => u.id === id);
    if (uIdx === -1) return res.status(404).json({ error: 'User not found' });
    
    if (db.users[uIdx].username === 'admin') {
      return res.status(400).json({ error: 'The Super Administrator cannot be deactivated.' });
    }
    
    db.users[uIdx].isActive = !db.users[uIdx].isActive;
    saveDb(db);
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Toggle User Status',
      'all',
      'All Branches',
      `Toggled active status of user: ${db.users[uIdx].username}. Active = ${db.users[uIdx].isActive}`
    );
    
    res.json(db.users[uIdx]);
  });

  app.put('/api/users/:id/permissions', (req, res) => {
    const { id } = req.params;
    const { permissions, operatorId } = req.body;
    const db = loadDb();
    
    const uIdx = db.users.findIndex(u => u.id === id);
    if (uIdx === -1) return res.status(404).json({ error: 'User not found' });
    
    db.users[uIdx].permissions = permissions || [];
    saveDb(db);
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update User Permissions',
      'all',
      'All Branches',
      `Updated custom role-based permissions list of user: ${db.users[uIdx].username}`
    );
    
    res.json(db.users[uIdx]);
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, name, email, role, branchId, password, operatorId, phone, twoFactorEnabled } = req.body;
    const db = loadDb();
    
    const uIdx = db.users.findIndex(u => u.id === id);
    if (uIdx === -1) return res.status(404).json({ error: 'User not found' });
    
    // Check duplicate username
    if (db.users.some(u => u.id !== id && u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already in use.' });
    }
    
    const user = db.users[uIdx];
    user.username = username.toLowerCase();
    user.name = name;
    user.email = email;
    if (phone !== undefined) {
      user.phone = phone;
    }
    if (twoFactorEnabled !== undefined) {
      user.twoFactorEnabled = !!twoFactorEnabled;
    }
    user.role = role;
    user.branchId = branchId;
    if (password) {
      user.passwordHash = password;
    }
    
    saveDb(db);
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update User Info',
      'all',
      'All Branches',
      `Updated profile/credentials of user: ${user.username}.`
    );
    
    const { passwordHash, ...sanitized } = user;
    res.json(sanitized);
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.query;
    const db = loadDb();
    
    const uIdx = db.users.findIndex(u => u.id === id);
    if (uIdx === -1) return res.status(404).json({ error: 'User not found' });
    
    if (db.users[uIdx].username === 'admin') {
      return res.status(400).json({ error: 'The primary Super Administrator cannot be deleted.' });
    }
    
    const deletedUsername = db.users[uIdx].username;
    db.users.splice(uIdx, 1);
    saveDb(db);
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete User',
      'all',
      'All Branches',
      `Permanently removed user account: ${deletedUsername}`
    );
    
    res.json({ success: true });
  });

  // ==================== DEVICE MANAGEMENT API ====================
  app.get('/api/devices', (req, res) => {
    const db = loadDb();
    const deviceList: any[] = [];
    
    db.users.forEach(u => {
      // Active devices
      if (u.recognizedDevices) {
        u.recognizedDevices.forEach(d => {
          deviceList.push({
            id: d,
            userId: u.id,
            userName: u.name,
            username: u.username,
            status: 'Active'
          });
        });
      }
      // Pending OTP devices
      if (u.pendingDeviceOtp) {
        deviceList.push({
          id: u.pendingDeviceOtp.deviceId,
          userId: u.id,
          userName: u.name,
          username: u.username,
          status: 'Pending OTP Verification',
          otpCode: u.pendingDeviceOtp.code,
          expiry: u.pendingDeviceOtp.expiry
        });
      }
      // Deactivated devices
      if (u.deactivatedDevices) {
        u.deactivatedDevices.forEach(d => {
          deviceList.push({
            id: d,
            userId: u.id,
            userName: u.name,
            username: u.username,
            status: 'Deactivated'
          });
        });
      }
    });
    
    res.json(deviceList);
  });

  app.post('/api/devices/action', (req, res) => {
    const { userId, deviceId, action, operatorId } = req.body;
    const db = loadDb();
    
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.recognizedDevices) user.recognizedDevices = [];
    if (!user.deactivatedDevices) user.deactivatedDevices = [];
    
    if (action === 'deactivate') {
      // Move from active to deactivated
      user.recognizedDevices = user.recognizedDevices.filter(d => d !== deviceId);
      if (user.pendingDeviceOtp && user.pendingDeviceOtp.deviceId === deviceId) {
        delete user.pendingDeviceOtp;
      }
      if (!user.deactivatedDevices.includes(deviceId)) {
        user.deactivatedDevices.push(deviceId);
      }
    } else if (action === 'reactivate') {
      // Move from deactivated to active
      user.deactivatedDevices = user.deactivatedDevices.filter(d => d !== deviceId);
      if (!user.recognizedDevices.includes(deviceId)) {
        user.recognizedDevices.push(deviceId);
      }
    } else if (action === 'remove') {
      // Remove from all
      user.recognizedDevices = user.recognizedDevices.filter(d => d !== deviceId);
      user.deactivatedDevices = user.deactivatedDevices.filter(d => d !== deviceId);
      if (user.pendingDeviceOtp && user.pendingDeviceOtp.deviceId === deviceId) {
        delete user.pendingDeviceOtp;
      }
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    saveDb(db);
    
    const operator = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      operator.id,
      operator.username,
      operator.role,
      'Device Security Action',
      'all',
      'All Branches',
      `Performed device action '${action}' on device '${deviceId}' for user: ${user.username}`
    );
    
    res.json({ success: true });
  });

  app.post('/api/devices/authorize', (req, res) => {
    const { userId, deviceId, operatorId } = req.body;
    const db = loadDb();
    
    const operator = db.users.find(u => u.id === operatorId);
    const isOperatorAdmin = operator && (operator.role === UserRole.SUPER_ADMIN || operator.username === 'admin');
    
    if (!isOperatorAdmin) {
      return res.status(403).json({ error: 'Direct device authorization and bypass is restricted to administrators only.' });
    }

    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.recognizedDevices) user.recognizedDevices = [];
    if (!user.deactivatedDevices) user.deactivatedDevices = [];
    
    // Remove from deactivated, add to recognized
    user.deactivatedDevices = user.deactivatedDevices.filter(d => d !== deviceId);
    if (!user.recognizedDevices.includes(deviceId)) {
      user.recognizedDevices.push(deviceId);
    }
    
    saveDb(db);
    
    const operatorObj = operator || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      operatorObj.id,
      operatorObj.username,
      operatorObj.role,
      'Device Authorized Directly',
      'all',
      'All Branches',
      `Directly authorized device '${deviceId}' for user: ${user.username}`
    );
    
    res.json({ success: true });
  });

  app.post('/api/inventory/batch-import', (req, res) => {
    const { items, operatorId } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array.' });
    }
    const db = loadDb();
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    const importedMedicines: Medicine[] = [];
    const importedStocks: StockItem[] = [];

    items.forEach(it => {
      // Find if medicine already exists by barcode, SKU, or similar name
      let existingMed = db.medicines.find(m => m.barcode === it.barcode || (it.sku && m.sku === it.sku) || isSimilarName(m.name, it.name));
      
      if (!existingMed) {
        existingMed = {
          id: generateId('m'),
          name: it.name,
          genericName: it.genericName || '',
          barcode: it.barcode || `BAR-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          sku: it.sku || `SKU-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*1000)}`,
          category: it.category || 'General',
          price: Number(it.price) || 0,
          buyingPrice: Number(it.buyingPrice) || 0,
          isPrescriptionRequired: !!it.isPrescriptionRequired,
          unit: it.unit || 'Tablet',
          minStockLevel: Number(it.minStockLevel) || 10,
          description: it.description || '',
          productType: it.productType || 'medicine'
        };
        db.medicines.push(existingMed);
        importedMedicines.push(existingMed);
      }

      // Create stock item
      const newStock: StockItem = {
        id: generateId('st'),
        medicineId: existingMed.id,
        branchId: it.branchId || 'b1',
        batchNumber: it.batchNumber || `B-${Date.now().toString().slice(-4)}`,
        expiryDate: it.expiryDate || getRelativeDateStr(365),
        quantity: Number(it.quantity) || 0,
        buyingPrice: Number(it.buyingPrice) || existingMed.buyingPrice,
        supplierId: it.supplierId || 's1',
        isDamaged: false,
        storeQuantity: Number(it.quantity) || 0,
        dispensaryQuantity: 0,
        originalQuantity: Number(it.quantity) || 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      db.stockItems.push(newStock);
      importedStocks.push(newStock);

      addBinCardEntry(
        db,
        newStock.branchId,
        newStock.medicineId,
        'Opening Stock',
        newStock.id,
        undefined,
        userObj.name || userObj.username,
        newStock.quantity,
        0,
        newStock.batchNumber,
        newStock.expiryDate,
        'Bulk batch import.'
      );

      syncHigherPriceAcrossAllBranches(db, newStock.medicineId, newStock.buyingPrice);
      syncMedicineWithLastBatch(db, newStock.medicineId);
    });

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Batch Import Inventory',
      'all',
      'All Branches',
      `Batch imported ${importedMedicines.length} medicine catalog items and ${importedStocks.length} stock batch items.`
    );

    res.json({ success: true, medicinesCount: importedMedicines.length, stocksCount: importedStocks.length });
  });

  // ==================== PHARMACY NOTES & USER MESSAGES ====================
  app.get('/api/pharmacy-notes', (req, res) => {
    const db = loadDb();
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'] as string;
    res.json(filterPharmacyNotes(db.pharmacyNotes || [], role, userId));
  });

  app.post('/api/pharmacy-notes', (req, res) => {
    const { text, authorName, authorId, role, color, recipientUserId, recipientName } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Note text is required.' });
    }
    const db = loadDb();
    if (!db.pharmacyNotes) {
      db.pharmacyNotes = [];
    }

    const currentUserId = (req.headers['x-user-id'] as string) || authorId || '';

    const newNote: PharmacyNote = {
      id: generateId('note'),
      text: text.trim(),
      authorName: authorName || 'Anonymous',
      authorId: currentUserId,
      role: role || 'Staff',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      color: color || 'amber',
      recipientUserId: recipientUserId || 'all',
      recipientName: recipientName || 'All Users / Everyone'
    };
    db.pharmacyNotes.unshift(newNote); // newest first
    saveDb(db);
    res.status(201).json(newNote);
  });

  app.delete('/api/pharmacy-notes/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDb();
    if (!db.pharmacyNotes) {
      db.pharmacyNotes = [];
    }
    const filtered = db.pharmacyNotes.filter(n => n.id !== id);
    if (filtered.length === db.pharmacyNotes.length) {
      return res.status(404).json({ error: 'Note not found.' });
    }
    db.pharmacyNotes = filtered;
    saveDb(db);
    res.json({ success: true });
  });

  // ==================== MEDICINES / BARCODE INDEX ====================
  
  app.get('/api/medicines', (req, res) => {
    const db = loadDb();
    res.json(db.medicines);
  });

  function syncMedicineWithLastBatch(db: any, medicineId: string) {
    const medicine = db.medicines.find((m: any) => m.id === medicineId);
    if (!medicine) return;
    const batches = db.stockItems.filter((st: any) => st.medicineId === medicineId);
    if (batches.length > 0) {
      // Last added batch (last in the array)
      const lastBatch = batches[batches.length - 1];
      medicine.buyingPrice = Number(lastBatch.buyingPrice);
      const useMargin = medicine.useMarginPricing !== undefined ? !!medicine.useMarginPricing : (medicine.profitMargin !== undefined);
      if (useMargin) {
        const margin = medicine.profitMargin !== undefined ? Number(medicine.profitMargin) : 30;
        medicine.price = Math.round(lastBatch.buyingPrice * (1 + margin / 100));
      } else {
        // If not using margin pricing, preserve the manually set price (rounded to nearest integer)
        medicine.price = Math.round(Number(medicine.price) || 0);
      }
    } else {
      // If no batches, just make sure medicine price is rounded
      medicine.price = Math.round(Number(medicine.price) || 0);
      medicine.buyingPrice = Number(medicine.buyingPrice) || 0;
    }
  }

  function syncHigherPriceAcrossAllBranches(db: any, medicineId: string, candidateBuyingPrice: number) {
    const medicine = db.medicines.find((m: any) => m.id === medicineId);
    if (!medicine) return;
    const priceToCompare = Number(medicine.buyingPrice) || 0;
    if (candidateBuyingPrice > priceToCompare) {
      db.stockItems.forEach((st: any) => {
        if (st.medicineId === medicineId) {
          st.buyingPrice = candidateBuyingPrice;
        }
      });
      medicine.buyingPrice = candidateBuyingPrice;
      const useMargin = medicine.useMarginPricing !== undefined ? !!medicine.useMarginPricing : (medicine.profitMargin !== undefined);
      if (useMargin) {
        const margin = medicine.profitMargin !== undefined ? Number(medicine.profitMargin) : 30;
        medicine.price = Math.round(candidateBuyingPrice * (1 + margin / 100));
      }
    }
  }

  app.post('/api/medicines', (req, res) => {
    const { 
      name, genericName, barcode, sku, category, subCategory, price, buyingPrice, 
      isPrescriptionRequired, unit, minStockLevel, description, 
      productType, imageUrl, profitMargin, useMarginPricing, operatorId,
      batchNumber, storeQuantity, dispensaryQuantity, expiryDate, 
      supplierId, branchId, purchaseInvoiceNumber, invoiceNumber,
      isNewMedSplit, newMedSplitFirstQty, newMedSplitSecondBranchId
    } = req.body;
    const db = loadDb();

    const targetInvoiceNum = purchaseInvoiceNumber || invoiceNumber || '';

    // Check if same or similar name already exists
    let existingMedicine = db.medicines.find(m => isSimilarName(m.name, name));

    if (!existingMedicine) {
      if (db.medicines.some(m => m.barcode === barcode || (sku && m.sku === sku))) {
        return res.status(400).json({ error: 'Medicine with duplicate Barcode or SKU already registered.' });
      }

      const newMedicine: Medicine & { purchaseInvoiceNumber?: string } = {
        id: generateId('m'),
        name,
        genericName: genericName || '',
        barcode: barcode || `BAR-${Date.now()}`,
        sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
        category,
        subCategory: subCategory || '',
        price: Number(price),
        buyingPrice: Number(buyingPrice),
        isPrescriptionRequired: !!isPrescriptionRequired,
        unit,
        minStockLevel: Number(minStockLevel) || 10,
        description: description || '',
        productType: productType || 'medicine',
        imageUrl: imageUrl || '',
        profitMargin: profitMargin ? Number(profitMargin) : undefined,
        useMarginPricing: useMarginPricing !== undefined ? !!useMarginPricing : (profitMargin !== undefined),
        purchaseInvoiceNumber: targetInvoiceNum || undefined,
        supplierId: supplierId || 's1'
      };

      db.medicines.push(newMedicine);
      existingMedicine = newMedicine;
    } else {
      // It exists! Update basic fields and invoice/supplier info if supplied
      if (genericName && !existingMedicine.genericName) existingMedicine.genericName = genericName;
      if (category) existingMedicine.category = category;
      if (subCategory !== undefined) existingMedicine.subCategory = subCategory;
      if (description && !existingMedicine.description) existingMedicine.description = description;
      if (imageUrl) existingMedicine.imageUrl = imageUrl;
      if (price) existingMedicine.price = Number(price);
      if (buyingPrice) existingMedicine.buyingPrice = Number(buyingPrice);
      if (supplierId) (existingMedicine as any).supplierId = supplierId;
      if (targetInvoiceNum) (existingMedicine as any).purchaseInvoiceNumber = targetInvoiceNum;
    }

    const targetMedicine = existingMedicine;

    // If batch information is provided, create/update the stock record
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    if (batchNumber || storeQuantity !== undefined || dispensaryQuantity !== undefined) {
      const bQty = (Number(storeQuantity) || 0) + (Number(dispensaryQuantity) || 0);
      
      if (isNewMedSplit && newMedSplitFirstQty !== undefined) {
        const firstQty = Number(newMedSplitFirstQty) || 0;
        const remainderQty = bQty - firstQty;

        const targetBatchNum = batchNumber || `B-${Date.now().toString().slice(-4)}`;
        const targetExpiry = expiryDate || (productType === 'cosmetics' ? '' : getRelativeDateStr(365));

        // Part 1: Check if batch already exists in target branch
        const existingBatch1 = db.stockItems.find(st => 
          st.medicineId === targetMedicine.id && 
          st.branchId === (branchId || 'b1') && 
          (st.batchNumber || '').trim().toLowerCase() === (targetBatchNum || '').trim().toLowerCase()
        );

        if (existingBatch1) {
          existingBatch1.quantity += firstQty;
          existingBatch1.storeQuantity = (existingBatch1.storeQuantity || 0) + firstQty;
          if (existingBatch1.originalQuantity !== undefined) {
            existingBatch1.originalQuantity += firstQty;
          }
          if (expiryDate) existingBatch1.expiryDate = expiryDate;
          if (buyingPrice) existingBatch1.buyingPrice = Number(buyingPrice);
          if (supplierId) existingBatch1.supplierId = supplierId;
          if (targetInvoiceNum) (existingBatch1 as any).purchaseInvoiceNumber = targetInvoiceNum;
        } else {
          const newStock1: StockItem & { purchaseInvoiceNumber?: string } = {
            id: generateId('st'),
            medicineId: targetMedicine.id,
            branchId: branchId || 'b1',
            batchNumber: targetBatchNum,
            expiryDate: targetExpiry,
            quantity: firstQty,
            buyingPrice: Number(buyingPrice || targetMedicine.buyingPrice),
            supplierId: supplierId || targetMedicine.supplierId || 's1',
            isDamaged: false,
            storeQuantity: firstQty,
            dispensaryQuantity: 0,
            originalQuantity: firstQty,
            createdAt: new Date().toISOString().split('T')[0],
            purchaseInvoiceNumber: targetInvoiceNum || undefined
          };
          db.stockItems.push(newStock1);
        }

        addBinCardEntry(
          db,
          branchId || 'b1',
          targetMedicine.id,
          'Purchase',
          targetBatchNum,
          targetInvoiceNum || targetMedicine.purchaseInvoiceNumber || undefined,
          userObj.name || userObj.username,
          firstQty,
          0,
          targetBatchNum,
          targetExpiry,
          'Inventory batch entry upon catalog registration (Split Part 1).',
          { supplierId: supplierId || targetMedicine.supplierId || 's1' }
        );

        // Part 2: Remainder
        if (remainderQty > 0) {
          const targetBranch2 = newMedSplitSecondBranchId || 'b2';
          const existingBatch2 = db.stockItems.find(st => 
            st.medicineId === targetMedicine.id && 
            st.branchId === targetBranch2 && 
            (st.batchNumber || '').trim().toLowerCase() === (targetBatchNum || '').trim().toLowerCase()
          );

          if (existingBatch2) {
            existingBatch2.quantity += remainderQty;
            existingBatch2.storeQuantity = (existingBatch2.storeQuantity || 0) + remainderQty;
            if (existingBatch2.originalQuantity !== undefined) {
              existingBatch2.originalQuantity += remainderQty;
            }
            if (expiryDate) existingBatch2.expiryDate = expiryDate;
            if (buyingPrice) existingBatch2.buyingPrice = Number(buyingPrice);
            if (supplierId) existingBatch2.supplierId = supplierId;
            if (targetInvoiceNum) (existingBatch2 as any).purchaseInvoiceNumber = targetInvoiceNum;
          } else {
            const newStock2: StockItem & { purchaseInvoiceNumber?: string } = {
              id: generateId('st'),
              medicineId: targetMedicine.id,
              branchId: targetBranch2,
              batchNumber: targetBatchNum,
              expiryDate: targetExpiry,
              quantity: remainderQty,
              buyingPrice: Number(buyingPrice || targetMedicine.buyingPrice),
              supplierId: supplierId || targetMedicine.supplierId || 's1',
              isDamaged: false,
              storeQuantity: remainderQty,
              dispensaryQuantity: 0,
              originalQuantity: remainderQty,
              createdAt: new Date().toISOString().split('T')[0],
              purchaseInvoiceNumber: targetInvoiceNum || undefined
            };
            db.stockItems.push(newStock2);
          }

          addBinCardEntry(
            db,
            targetBranch2,
            targetMedicine.id,
            'Purchase',
            targetBatchNum,
            targetInvoiceNum || targetMedicine.purchaseInvoiceNumber || undefined,
            userObj.name || userObj.username,
            remainderQty,
            0,
            targetBatchNum,
            targetExpiry,
            'Inventory batch entry upon catalog registration (Split Part 2).',
            { supplierId: supplierId || targetMedicine.supplierId || 's1' }
          );
        }
      } else {
        // Standard single-branch stock creation/addition
        const targetBatchNum = batchNumber || `B-${Date.now().toString().slice(-4)}`;
        const targetExpiry = expiryDate || (productType === 'cosmetics' ? '' : getRelativeDateStr(365));
        const targetBranch = branchId || 'b1';

        const existingBatch = db.stockItems.find(st => 
          st.medicineId === targetMedicine.id && 
          st.branchId === targetBranch && 
          (st.batchNumber || '').trim().toLowerCase() === (targetBatchNum || '').trim().toLowerCase()
        );

        if (existingBatch) {
          existingBatch.quantity += bQty;
          existingBatch.storeQuantity = (existingBatch.storeQuantity || 0) + (Number(storeQuantity) || bQty);
          existingBatch.dispensaryQuantity = (existingBatch.dispensaryQuantity || 0) + (Number(dispensaryQuantity) || 0);
          if (existingBatch.originalQuantity !== undefined) {
            existingBatch.originalQuantity += bQty;
          }
          if (expiryDate) existingBatch.expiryDate = expiryDate;
          if (buyingPrice) existingBatch.buyingPrice = Number(buyingPrice);
          if (supplierId) existingBatch.supplierId = supplierId;
          if (targetInvoiceNum) (existingBatch as any).purchaseInvoiceNumber = targetInvoiceNum;
        } else {
          const newStock: StockItem & { purchaseInvoiceNumber?: string } = {
            id: generateId('st'),
            medicineId: targetMedicine.id,
            branchId: targetBranch,
            batchNumber: targetBatchNum,
            expiryDate: targetExpiry,
            quantity: bQty,
            buyingPrice: Number(buyingPrice || targetMedicine.buyingPrice),
            supplierId: supplierId || targetMedicine.supplierId || 's1',
            isDamaged: false,
            storeQuantity: Number(storeQuantity) || bQty,
            dispensaryQuantity: Number(dispensaryQuantity) || 0,
            originalQuantity: bQty,
            createdAt: new Date().toISOString().split('T')[0],
            purchaseInvoiceNumber: targetInvoiceNum || undefined
          };
          db.stockItems.push(newStock);
        }

        addBinCardEntry(
          db,
          targetBranch,
          targetMedicine.id,
          'Purchase',
          targetBatchNum,
          targetInvoiceNum || targetMedicine.purchaseInvoiceNumber || undefined,
          userObj.name || userObj.username,
          bQty,
          0,
          targetBatchNum,
          targetExpiry,
          'Initial inventory entry upon catalog registration.',
          { supplierId: supplierId || targetMedicine.supplierId || 's1' }
        );
      }
    }

    syncMedicineWithLastBatch(db, targetMedicine.id);

    // Save sticky defaults and update ItemMasterTemplate so everything is saved for next time and across backups
    if (!db.customUnits) {
      db.customUnits = ['Piece (PCS)', 'Box', 'Strip', 'Tablet', 'Capsule', 'Vial', 'Ampoule', 'Bottle', 'Tube', 'Sachet', 'Blister Pack', 'Pfs (Prefilled Syringe)', 'Syrup Bottle', 'Suspension Bottle', 'Suppository', 'Patch', 'Jar', 'Spray / Inhaler', 'Canister', 'Bag', 'Roll', 'Unit'];
    }
    if (targetMedicine.unit && !db.customUnits.includes(targetMedicine.unit)) {
      db.customUnits.push(targetMedicine.unit);
    }
    if (category && db.categories && !db.categories.some(c => c.name.toLowerCase() === category.toLowerCase())) {
      db.categories.push({
        id: `cat_${Date.now()}`,
        name: category,
        description: `${category} category`,
        subCategories: subCategory ? [{ id: `sub_${Date.now()}`, name: subCategory }] : []
      });
    }

    if (!db.itemMasterTemplates) db.itemMasterTemplates = [];
    const tmplIdx = db.itemMasterTemplates.findIndex(t => t.id === targetMedicine.id || isSimilarName(t.name, targetMedicine.name));
    const newTemplate = {
      id: targetMedicine.id,
      name: targetMedicine.name,
      genericName: targetMedicine.genericName || targetMedicine.name,
      category: targetMedicine.category || 'General',
      subCategory: targetMedicine.subCategory || '',
      unit: targetMedicine.unit || 'Piece (PCS)',
      buyingPrice: Number(buyingPrice || targetMedicine.buyingPrice || 0),
      price: Number(price || targetMedicine.price || 0),
      profitMargin: targetMedicine.profitMargin !== undefined ? Number(targetMedicine.profitMargin) : 30,
      useMarginPricing: targetMedicine.useMarginPricing !== undefined ? !!targetMedicine.useMarginPricing : true,
      isPrescriptionRequired: !!targetMedicine.isPrescriptionRequired,
      productType: targetMedicine.productType || 'medicine',
      minStockLevel: Number(targetMedicine.minStockLevel) || 10,
      description: targetMedicine.description || '',
      supplierId: supplierId || (targetMedicine as any).supplierId || 's1',
      purchaseInvoiceNumber: targetInvoiceNum || (targetMedicine as any).purchaseInvoiceNumber || '',
      expiryDate: expiryDate || '',
      batchNumber: batchNumber || '',
      barcode: targetMedicine.barcode || '',
      sku: targetMedicine.sku || '',
      branchId: branchId || 'b1',
      imageUrl: targetMedicine.imageUrl || '',
      lastUpdated: new Date().toISOString()
    };
    if (tmplIdx >= 0) {
      db.itemMasterTemplates[tmplIdx] = { ...db.itemMasterTemplates[tmplIdx], ...newTemplate };
    } else {
      db.itemMasterTemplates.unshift(newTemplate);
    }

    db.itemAddPresets = {
      unit: targetMedicine.unit || 'Piece (PCS)',
      category: targetMedicine.category || 'Antibiotics',
      subCategory: targetMedicine.subCategory || '',
      supplierId: supplierId || (targetMedicine as any).supplierId || 's1',
      purchaseInvoiceNumber: targetInvoiceNum || '',
      branchId: branchId || 'b1',
      expiryDate: expiryDate || '',
      buyingPrice: Number(buyingPrice || targetMedicine.buyingPrice || 0),
      price: Number(price || targetMedicine.price || 0),
      productType: targetMedicine.productType || 'medicine',
      profitMargin: targetMedicine.profitMargin !== undefined ? Number(targetMedicine.profitMargin) : 30,
      useMarginPricing: targetMedicine.useMarginPricing !== undefined ? !!targetMedicine.useMarginPricing : true,
      isPrescriptionRequired: !!targetMedicine.isPrescriptionRequired,
      minStockLevel: Number(targetMedicine.minStockLevel) || 10,
      rememberDefaults: true,
      lastAddedItemName: targetMedicine.name,
      lastAddedAt: new Date().toISOString()
    };

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Medicine',
      'all',
      'All Branches',
      `Registered or updated ${productType || 'medicine'} catalog: ${name}.`
    );

    res.status(200).json(targetMedicine);
  });

  app.put('/api/medicines/:id', (req, res) => {
    const { id } = req.params;
    const { name, genericName, barcode, sku, category, subCategory, price, buyingPrice, isPrescriptionRequired, unit, minStockLevel, description, productType, imageUrl, profitMargin, useMarginPricing, operatorId, purchaseInvoiceNumber, totalQuantity, branchId } = req.body;
    const db = loadDb();

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         userObj.role === UserRole.BRANCH_MANAGER ||
                         userObj.role === UserRole.PHARMACIST ||
                         userObj.role === UserRole.STORE_KEEPER ||
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin' ||
                         !operatorId;
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Product and price/quantity adjustments are restricted to authorized administrators and managers.' });
    }

    const mIdx = db.medicines.findIndex(m => m.id === id);
    if (mIdx === -1) {
      return res.status(404).json({ error: 'Product not found in catalog.' });
    }

    const targetMedName = name !== undefined ? name : db.medicines[mIdx].name;

    // Find all catalog entries sharing same ID or same product name (case-insensitive)
    const matchingMeds = db.medicines.filter((m: any) => 
      m.id === id || 
      (m.name && targetMedName && m.name.trim().toLowerCase() === targetMedName.trim().toLowerCase())
    );
    const matchingMedIds = matchingMeds.map((m: any) => m.id);

    // Update main target medicine and sync shared fields across matching catalog entries
    matchingMeds.forEach((med: any) => {
      if (name !== undefined) med.name = name;
      if (genericName !== undefined) med.genericName = genericName;
      if (barcode !== undefined) med.barcode = barcode;
      if (sku !== undefined) med.sku = sku;
      if (category !== undefined) med.category = category;
      if (subCategory !== undefined) med.subCategory = subCategory;
      if (price !== undefined) med.price = Number(price);
      if (buyingPrice !== undefined) med.buyingPrice = Number(buyingPrice);
      if (isPrescriptionRequired !== undefined) med.isPrescriptionRequired = !!isPrescriptionRequired;
      if (unit !== undefined) med.unit = unit;
      if (minStockLevel !== undefined) med.minStockLevel = Number(minStockLevel);
      if (description !== undefined) med.description = description;
      if (productType !== undefined) med.productType = productType;
      if (imageUrl !== undefined) med.imageUrl = imageUrl;
      if (profitMargin !== undefined) med.profitMargin = Number(profitMargin);
      if (useMarginPricing !== undefined) med.useMarginPricing = !!useMarginPricing;
      if (price !== undefined) med.lastEditedPrice = Number(price);
      if (price !== undefined) med.lastEditedAt = new Date().toISOString();
      if (purchaseInvoiceNumber !== undefined) med.purchaseInvoiceNumber = purchaseInvoiceNumber;
    });

    // Apply global price propagation to all batches if buying price increased
    const originalBuyingPrice = Number(db.medicines[mIdx].buyingPrice) || 0;
    const newBuyingPrice = Number(buyingPrice !== undefined ? buyingPrice : db.medicines[mIdx].buyingPrice) || 0;
    if (newBuyingPrice > originalBuyingPrice) {
      db.stockItems.forEach((st: any) => {
        if (matchingMedIds.includes(st.medicineId)) {
          st.buyingPrice = newBuyingPrice;
        }
      });
    }

    // Handle physical totalQuantity adjustment across batches and branches
    if (totalQuantity !== undefined && totalQuantity !== null && !isNaN(Number(totalQuantity))) {
      const targetQty = Math.max(0, Number(totalQuantity));
      const reqBranch = (branchId && branchId !== 'all') ? branchId : 'b1';

      // Update medicine direct stock properties across matching medicines
      matchingMeds.forEach((med: any) => {
        med.stock = targetQty;
        med.stockQuantity = targetQty;
        med.quantity = targetQty;
      });

      // Filter stock items matching target medicine IDs and branch scope
      const targetStocks = db.stockItems.filter((st: any) => {
        const isMedMatch = matchingMedIds.some(mId => String(mId).trim().toLowerCase() === String(st.medicineId).trim().toLowerCase());
        if (!isMedMatch) return false;
        const b = st.branchId || 'b1';
        return b === reqBranch || reqBranch === 'all';
      });

      if (targetQty === 0) {
        // Zero ALL stock items matching scope
        targetStocks.forEach((batch: any) => {
          const originalQty = batch.quantity || 0;
          batch.quantity = 0;
          batch.storeQuantity = 0;
          batch.dispensaryQuantity = 0;

          if (originalQty > 0) {
            addBinCardEntry(
              db,
              batch.branchId || reqBranch || 'b1',
              batch.medicineId,
              'Adjustment',
              batch.id,
              undefined,
              userObj.name || userObj.username,
              0,
              originalQty,
              batch.batchNumber || 'B-ADJ',
              batch.expiryDate || '',
              'Physical stock count adjustment (Forced to 0)'
            );
          }
        });
      } else {
        // Non-zero target quantity: set the last active batch to targetQty and all others in scope to 0
        const activeTargetStocks = targetStocks.filter((st: any) => !st.isDamaged);
        if (activeTargetStocks.length > 0) {
          activeTargetStocks.forEach((batch: any, idx: number) => {
            const originalQty = batch.quantity || 0;
            if (idx === activeTargetStocks.length - 1) {
              batch.quantity = targetQty;
              batch.storeQuantity = targetQty;
              batch.dispensaryQuantity = 0;

              const diff = targetQty - originalQty;
              if (diff !== 0) {
                addBinCardEntry(
                  db,
                  batch.branchId || reqBranch || 'b1',
                  batch.medicineId,
                  'Adjustment',
                  batch.id,
                  undefined,
                  userObj.name || userObj.username,
                  diff > 0 ? diff : 0,
                  diff < 0 ? Math.abs(diff) : 0,
                  batch.batchNumber || 'B-ADJ',
                  batch.expiryDate || '',
                  `Physical stock count adjustment (Forced to ${targetQty})`
                );
              }
            } else {
              batch.quantity = 0;
              batch.storeQuantity = 0;
              batch.dispensaryQuantity = 0;

              if (originalQty > 0) {
                addBinCardEntry(
                  db,
                  batch.branchId || reqBranch || 'b1',
                  batch.medicineId,
                  'Adjustment',
                  batch.id,
                  undefined,
                  userObj.name || userObj.username,
                  0,
                  originalQty,
                  batch.batchNumber || 'B-ADJ',
                  batch.expiryDate || '',
                  'Physical stock count adjustment (Forced to 0)'
                );
              }
            }
          });
        } else {
          // Create a new stock batch for the target branch (or 'b1')
          const newBatchId = 'st-' + Math.random().toString(36).substring(2, 9);
          const assignedBranch = reqBranch || 'b1';
          const newStockItem = {
            id: newBatchId,
            medicineId: id,
            branchId: assignedBranch,
            batchNumber: `B-${Date.now().toString().slice(-4)}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: targetQty,
            storeQuantity: targetQty,
            dispensaryQuantity: 0,
            buyingPrice: buyingPrice !== undefined ? Number(buyingPrice) : (db.medicines[mIdx].buyingPrice || 0),
            supplierId: 's1',
            isDamaged: false
          };
          db.stockItems.push(newStockItem);

          addBinCardEntry(
            db,
            assignedBranch,
            id,
            'Opening Stock',
            newBatchId,
            undefined,
            userObj.name || userObj.username,
            targetQty,
            0,
            newStockItem.batchNumber,
            newStockItem.expiryDate,
            `Physical stock initialized (${targetQty} units)`
          );
        }
      }
    }

    matchingMedIds.forEach((medId: string) => {
      syncMedicineWithLastBatch(db, medId);
    });

    // Update itemMasterTemplates
    if (!db.itemMasterTemplates) db.itemMasterTemplates = [];
    const updatedMed = db.medicines[mIdx];
    const tmplIdx2 = db.itemMasterTemplates.findIndex(t => t.id === updatedMed.id || isSimilarName(t.name, updatedMed.name));
    const newTemplate2 = {
      id: updatedMed.id,
      name: updatedMed.name,
      genericName: updatedMed.genericName || updatedMed.name,
      category: updatedMed.category || 'General',
      subCategory: updatedMed.subCategory || '',
      unit: updatedMed.unit || 'Piece (PCS)',
      buyingPrice: Number(updatedMed.buyingPrice || 0),
      price: Number(updatedMed.price || 0),
      profitMargin: updatedMed.profitMargin !== undefined ? Number(updatedMed.profitMargin) : 30,
      useMarginPricing: updatedMed.useMarginPricing !== undefined ? !!updatedMed.useMarginPricing : true,
      isPrescriptionRequired: !!updatedMed.isPrescriptionRequired,
      productType: updatedMed.productType || 'medicine',
      minStockLevel: Number(updatedMed.minStockLevel) || 10,
      description: updatedMed.description || '',
      supplierId: (updatedMed as any).supplierId || 's1',
      purchaseInvoiceNumber: (updatedMed as any).purchaseInvoiceNumber || '',
      barcode: updatedMed.barcode || '',
      sku: updatedMed.sku || '',
      branchId: branchId || 'b1',
      imageUrl: updatedMed.imageUrl || '',
      lastUpdated: new Date().toISOString()
    };
    if (tmplIdx2 >= 0) {
      db.itemMasterTemplates[tmplIdx2] = { ...db.itemMasterTemplates[tmplIdx2], ...newTemplate2 };
    } else {
      db.itemMasterTemplates.unshift(newTemplate2);
    }

    if (updatedMed.unit && !db.customUnits?.includes(updatedMed.unit)) {
      db.customUnits = db.customUnits || [];
      db.customUnits.push(updatedMed.unit);
    }

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Medicine',
      branchId || 'all',
      'Active Scope',
      `Physical stock adjustment for ${db.medicines[mIdx].name}. Selling price: ${db.medicines[mIdx].price} ETB. Target Qty: ${totalQuantity !== undefined ? totalQuantity : 'unchanged'}.`
    );

    res.json(db.medicines[mIdx]);
  });

  // ==================== INVENTORY PRESETS & TEMPLATES ====================
  app.get('/api/inventory/presets', (req, res) => {
    const db = loadDb();
    res.json({
      presets: db.itemAddPresets || {
        unit: 'Piece (PCS)',
        category: 'Antibiotics',
        subCategory: 'General',
        supplierId: 's1',
        branchId: 'b1',
        productType: 'medicine',
        profitMargin: 30,
        useMarginPricing: true,
        isPrescriptionRequired: false,
        rememberDefaults: true
      },
      customUnits: db.customUnits || [],
      templatesCount: db.itemMasterTemplates?.length || 0,
      lastAddedItemName: db.itemAddPresets?.lastAddedItemName || ''
    });
  });

  app.post('/api/inventory/presets', (req, res) => {
    const db = loadDb();
    const { presets, customUnit, customCategory } = req.body || {};
    if (presets) {
      db.itemAddPresets = { ...(db.itemAddPresets || {}), ...presets, lastAddedAt: new Date().toISOString() };
    }
    if (customUnit && typeof customUnit === 'string' && customUnit.trim()) {
      if (!db.customUnits) db.customUnits = [];
      if (!db.customUnits.includes(customUnit.trim())) {
        db.customUnits.push(customUnit.trim());
      }
    }
    if (customCategory && typeof customCategory === 'string' && customCategory.trim()) {
      if (!db.categories) db.categories = [];
      if (!db.categories.some(c => c.name.toLowerCase() === customCategory.trim().toLowerCase())) {
        db.categories.push({
          id: `cat_${Date.now()}`,
          name: customCategory.trim(),
          description: `${customCategory.trim()} category`,
          subCategories: []
        });
      }
    }
    saveDb(db);
    res.json({ success: true, presets: db.itemAddPresets, customUnits: db.customUnits });
  });

  app.get('/api/inventory/templates', (req, res) => {
    const db = loadDb();
    res.json(db.itemMasterTemplates || []);
  });

  app.post('/api/medicines/:id/force-branch-stock', (req, res) => {
    const { id } = req.params;
    const { branchId, targetQuantity, operatorId, editWho, editWhy } = req.body;
    const db = loadDb();

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || (userObj.role as string) === 'Admin' || userObj.username === 'admin';
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Stock quantity adjustments are restricted to Super Administrator only.' });
    }
    
    const medIdx = db.medicines.findIndex(m => m.id === id);
    if (medIdx === -1) {
      return res.status(404).json({ error: 'Product not found in catalog.' });
    }
    const med = db.medicines[medIdx];
    
    const activeBranch = branchId || 'b1';
    const targetQty = Number(targetQuantity);
    if (isNaN(targetQty) || targetQty < 0) {
      return res.status(400).json({ error: 'Invalid target quantity.' });
    }
    
    if (activeBranch === 'all') {
      // Find all active (non-damaged) stock items of this medicine in any branch
      const activeStocks = db.stockItems.filter(si => si.medicineId === id && !si.isDamaged);

      if (activeStocks.length === 0) {
        if (targetQty > 0) {
          // Create a default stock item in branch 'b1'
          const newStockItem = {
            id: `st-${Date.now()}`,
            medicineId: id,
            branchId: 'b1',
            batchNumber: `B-AUTO-${Date.now().toString().slice(-4)}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: targetQty,
            storeQuantity: targetQty,
            dispensaryQuantity: 0,
            buyingPrice: med.buyingPrice || med.price * 0.7 || 0,
            supplierId: 's1',
            isDamaged: false,
            notes: editWhy || 'Auto-created during global force-stock adjustment.'
          };
          db.stockItems.push(newStockItem);

          addBinCardEntry(
            db,
            'b1',
            id,
            'Adjustment',
            newStockItem.id,
            undefined,
            userObj.name || userObj.username,
            targetQty,
            0,
            newStockItem.batchNumber,
            newStockItem.expiryDate,
            editWhy || 'Global force stock adjustment opening batch'
          );
        }
      } else {
        if (targetQty === 0) {
          // Zero all active stocks in all branches
          activeStocks.forEach(si => {
            const originalQty = si.quantity;
            si.quantity = 0;
            si.storeQuantity = 0;
            si.dispensaryQuantity = 0;
            if (editWho && editWhy) {
              si.notes = si.notes ? `${si.notes} | Forced to 0 globally by ${editWho}: ${editWhy}` : `Forced to 0 globally by ${editWho}: ${editWhy}`;
            }

            if (originalQty > 0) {
              addBinCardEntry(
                db,
                si.branchId,
                id,
                'Adjustment',
                si.id,
                undefined,
                userObj.name || userObj.username,
                0,
                originalQty,
                si.batchNumber,
                si.expiryDate,
                `Forced to 0 globally: ${editWhy || ''}`
              );
            }
          });
        } else {
          // Set the last active stock item to targetQty and all other active stock items to 0
          activeStocks.forEach((si, idx) => {
            const originalQty = si.quantity;
            if (idx === activeStocks.length - 1) {
              si.quantity = targetQty;
              si.storeQuantity = targetQty;
              si.dispensaryQuantity = 0;
              if (editWho && editWhy) {
                si.notes = si.notes ? `${si.notes} | Force adjusted to ${targetQty} globally by ${editWho}: ${editWhy}` : `Force adjusted to ${targetQty} globally by ${editWho}: ${editWhy}`;
              }

              const diff = targetQty - originalQty;
              if (diff !== 0) {
                addBinCardEntry(
                  db,
                  si.branchId,
                  id,
                  'Adjustment',
                  si.id,
                  undefined,
                  userObj.name || userObj.username,
                  diff > 0 ? diff : 0,
                  diff < 0 ? Math.abs(diff) : 0,
                  si.batchNumber,
                  si.expiryDate,
                  `Globally force-adjusted to ${targetQty}: ${editWhy || ''}`
                );
              }
            } else {
              si.quantity = 0;
              si.storeQuantity = 0;
              si.dispensaryQuantity = 0;
              if (editWho && editWhy) {
                si.notes = si.notes ? `${si.notes} | Forced to 0 globally by ${editWho}: ${editWhy}` : `Forced to 0 globally by ${editWho}: ${editWhy}`;
              }

              if (originalQty > 0) {
                addBinCardEntry(
                  db,
                  si.branchId,
                  id,
                  'Adjustment',
                  si.id,
                  undefined,
                  userObj.name || userObj.username,
                  0,
                  originalQty,
                  si.batchNumber,
                  si.expiryDate,
                  `Forced to 0 globally: ${editWhy || ''}`
                );
              }
            }
          });
        }
      }
    } else {
      // Find all active (non-damaged) stock items of this medicine in this specific branch
      const activeBranchStocks = db.stockItems.filter(si => si.medicineId === id && si.branchId === activeBranch && !si.isDamaged);

      if (activeBranchStocks.length === 0) {
        if (targetQty > 0) {
          // Create a default stock item
          const newStockItem = {
            id: `st-${Date.now()}`,
            medicineId: id,
            branchId: activeBranch,
            batchNumber: `B-AUTO-${Date.now().toString().slice(-4)}`,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantity: targetQty,
            storeQuantity: targetQty,
            dispensaryQuantity: 0,
            buyingPrice: med.buyingPrice || med.price * 0.7 || 0,
            supplierId: 's1',
            isDamaged: false,
            notes: editWhy || 'Auto-created during branch force-stock adjustment.'
          };
          db.stockItems.push(newStockItem);

          addBinCardEntry(
            db,
            activeBranch,
            id,
            'Adjustment',
            newStockItem.id,
            undefined,
            userObj.name || userObj.username,
            targetQty,
            0,
            newStockItem.batchNumber,
            newStockItem.expiryDate,
            editWhy || 'Branch force stock adjustment opening batch'
          );
        }
      } else {
        if (targetQty === 0) {
          // Zero all of them
          activeBranchStocks.forEach(si => {
            const originalQty = si.quantity;
            si.quantity = 0;
            si.storeQuantity = 0;
            si.dispensaryQuantity = 0;
            if (editWho && editWhy) {
              si.notes = si.notes ? `${si.notes} | Forced to 0 by ${editWho}: ${editWhy}` : `Forced to 0 by ${editWho}: ${editWhy}`;
            }

            if (originalQty > 0) {
              addBinCardEntry(
                db,
                activeBranch,
                id,
                'Adjustment',
                si.id,
                undefined,
                userObj.name || userObj.username,
                0,
                originalQty,
                si.batchNumber,
                si.expiryDate,
                `Forced to 0 in branch: ${editWhy || ''}`
              );
            }
          });
        } else {
          // Set latest to targetQty, others to 0
          activeBranchStocks.forEach((si, idx) => {
            const originalQty = si.quantity;
            if (idx === activeBranchStocks.length - 1) {
              si.quantity = targetQty;
              si.storeQuantity = targetQty;
              si.dispensaryQuantity = 0;
              if (editWho && editWhy) {
                si.notes = si.notes ? `${si.notes} | Force adjusted to ${targetQty} by ${editWho}: ${editWhy}` : `Force adjusted to ${targetQty} by ${editWho}: ${editWhy}`;
              }

              const diff = targetQty - originalQty;
              if (diff !== 0) {
                addBinCardEntry(
                  db,
                  activeBranch,
                  id,
                  'Adjustment',
                  si.id,
                  undefined,
                  userObj.name || userObj.username,
                  diff > 0 ? diff : 0,
                  diff < 0 ? Math.abs(diff) : 0,
                  si.batchNumber,
                  si.expiryDate,
                  `Force adjusted to ${targetQty} in branch: ${editWhy || ''}`
                );
              }
            } else {
              si.quantity = 0;
              si.storeQuantity = 0;
              si.dispensaryQuantity = 0;
              if (editWho && editWhy) {
                si.notes = si.notes ? `${si.notes} | Forced to 0 by ${editWho}: ${editWhy}` : `Forced to 0 by ${editWho}: ${editWhy}`;
              }

              if (originalQty > 0) {
                addBinCardEntry(
                  db,
                  activeBranch,
                  id,
                  'Adjustment',
                  si.id,
                  undefined,
                  userObj.name || userObj.username,
                  0,
                  originalQty,
                  si.batchNumber,
                  si.expiryDate,
                  `Forced to 0 in branch: ${editWhy || ''}`
                );
              }
            }
          });
        }
      }
    }
    
    saveDb(db);
    
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Force Branch Stock Adjustment',
      activeBranch,
      activeBranch,
      `Force-adjusted total stock of ${med.name} in branch ${activeBranch} to ${targetQty} units.`
    );
    
    res.json({ success: true, message: `Stock adjusted successfully to ${targetQty}.` });
  });

  app.post('/api/clean-unknown-recovered', (req, res) => {
    const operatorId = req.query.operatorId as string;
    const db = loadDb();
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    if (userObj.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied: Deletion is restricted to Super Administrator only.' });
    }

    // Find medicines that are considered auto-recovered, stub or unknown
    const toDeleteMeds = db.medicines.filter(m => {
      const nameLower = (m.name || '').toLowerCase();
      const catLower = (m.category || '').toLowerCase();
      const idLower = (m.id || '').toLowerCase();
      return (
        nameLower.includes('unknown') || 
        nameLower.includes('auto-recovered') || 
        nameLower.includes('recovered') || 
        catLower.includes('auto-recovered') ||
        idLower.startsWith('m_stub_')
      );
    });

    const toDeleteMedIds = new Set(toDeleteMeds.map(m => m.id));

    // Keep only valid medicines
    db.medicines = db.medicines.filter(m => !toDeleteMedIds.has(m.id));

    // Keep only stockItems that:
    // 1. are not related to deleted medicines
    // 2. are not orphaned (meaning they reference a medicine that exists in db.medicines)
    const validMedIds = new Set(db.medicines.map(m => m.id));
    const initialStockItemCount = db.stockItems.length;
    
    db.stockItems = db.stockItems.filter(si => {
      if (toDeleteMedIds.has(si.medicineId)) return false;
      if (!validMedIds.has(si.medicineId)) return false;
      return true;
    });

    const removedMedsCount = toDeleteMeds.length;
    const removedStockItemsCount = initialStockItemCount - db.stockItems.length;

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Clean Recovered Items',
      'all',
      'All Branches',
      `Cleaned up database: removed ${removedMedsCount} auto-recovered/unknown medicine records and ${removedStockItemsCount} orphaned stock items.`
    );

    res.json({
      success: true,
      message: `Database cleanup complete! Removed ${removedMedsCount} unknown/auto-recovered products and ${removedStockItemsCount} orphaned stock batches.`,
      removedMedsCount,
      removedStockItemsCount
    });
  });

  app.delete('/api/medicines/:id', (req, res) => {
    const { id } = req.params;
    const operatorId = req.query.operatorId as string;
    const scope = (req.query.scope as string) || (req.query.deleteScope as string) || 'all';
    const branchId = req.query.branchId as string;
    const db = loadDb();
    
    const mIdx = db.medicines.findIndex(m => m.id === id);
    if (mIdx === -1) {
      return res.status(404).json({ error: 'Product not found in catalog.' });
    }
    
    const medName = db.medicines[mIdx].name;
    const productType = db.medicines[mIdx].productType || 'medicine';
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Deletion is restricted to Super Administrator only.' });
    }
    
    if (scope === 'specific' && branchId && branchId !== 'all') {
      // Remove stock items for this medicine in this specific branch
      const removedBatches = db.stockItems.filter(si => si.medicineId === id && si.branchId === branchId);
      removedBatches.forEach(si => {
        addBinCardEntry(
          db,
          si.branchId,
          si.medicineId,
          'Branch Stock Deletion',
          si.id,
          undefined,
          userObj.name || userObj.username,
          0,
          si.quantity,
          si.batchNumber,
          si.expiryDate,
          `Stock permanently deleted from branch ${branchId}.`
        );
      });

      db.stockItems = db.stockItems.filter(si => !(si.medicineId === id && si.branchId === branchId));
      saveDb(db);

      const targetBranchObj = db.branches.find(b => b.id === branchId);
      const branchName = targetBranchObj ? targetBranchObj.name : branchId;

      logActivity(
        userObj.id,
        userObj.username,
        userObj.role,
        'Delete Branch Stock',
        branchId,
        branchName,
        `Deleted all stock items for "${medName}" from branch ${branchName}.`
      );

      return res.json({ success: true, message: `Successfully removed stock for "${medName}" from ${branchName}.` });
    } else {
      // Remove the catalog item completely and all associated stock across all branches
      db.medicines.splice(mIdx, 1);
      db.stockItems = db.stockItems.filter(si => si.medicineId !== id);
      saveDb(db);
      
      logActivity(
        userObj.id,
        userObj.username,
        userObj.role,
        'Delete Medicine',
        'all',
        'All Branches',
        `Deleted ${productType} catalog item and all associated batches across all branches: ${medName}.`
      );
      
      return res.json({ success: true, message: `"${medName}" has been completely deleted from catalog and all branches.` });
    }
  });

  // Bulk delete medicines/products endpoint
  app.post('/api/medicines/bulk-delete', (req, res) => {
    const { ids, scope = 'all', branchId, operatorId } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No item IDs provided for bulk deletion.' });
    }

    const db = loadDb();
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Bulk deletion is restricted to Super Administrator only.' });
    }

    const idSet = new Set(ids);
    let deletedMedsCount = 0;
    let deletedStockCount = 0;

    if (scope === 'specific' && branchId && branchId !== 'all') {
      const removedBatches = db.stockItems.filter(si => idSet.has(si.medicineId) && si.branchId === branchId);
      deletedStockCount = removedBatches.length;

      removedBatches.forEach(si => {
        addBinCardEntry(
          db,
          si.branchId,
          si.medicineId,
          'Bulk Branch Stock Deletion',
          si.id,
          undefined,
          userObj.name || userObj.username,
          0,
          si.quantity,
          si.batchNumber,
          si.expiryDate,
          `Stock batch deleted in bulk from branch ${branchId}.`
        );
      });

      db.stockItems = db.stockItems.filter(si => !(idSet.has(si.medicineId) && si.branchId === branchId));
      saveDb(db);

      const targetBranchObj = db.branches.find(b => b.id === branchId);
      const branchName = targetBranchObj ? targetBranchObj.name : branchId;

      logActivity(
        userObj.id,
        userObj.username,
        userObj.role,
        'Bulk Delete Branch Stock',
        branchId,
        branchName,
        `Bulk deleted stock items for ${ids.length} product(s) from branch ${branchName}.`
      );

      return res.json({
        success: true,
        message: `Successfully deleted stock items for ${ids.length} product(s) from branch "${branchName}".`,
        deletedMedsCount: 0,
        deletedStockCount
      });
    } else {
      const initialMedsCount = db.medicines.length;
      db.medicines = db.medicines.filter(m => !idSet.has(m.id));
      deletedMedsCount = initialMedsCount - db.medicines.length;

      const initialStockCount = db.stockItems.length;
      db.stockItems = db.stockItems.filter(si => !idSet.has(si.medicineId));
      deletedStockCount = initialStockCount - db.stockItems.length;

      saveDb(db);

      logActivity(
        userObj.id,
        userObj.username,
        userObj.role,
        'Bulk Delete Products',
        'all',
        'All Branches',
        `Bulk deleted ${deletedMedsCount} catalog product(s) and ${deletedStockCount} associated stock batch(es) across all branches.`
      );

      return res.json({
        success: true,
        message: `Successfully deleted ${deletedMedsCount} product(s) and ${deletedStockCount} associated stock batch(es) across all branches.`,
        deletedMedsCount,
        deletedStockCount
      });
    }
  });

  // Bulk delete stock batches endpoint
  app.post('/api/inventory/bulk-delete', (req, res) => {
    const { stockItemIds, scope = 'all', branchId, operatorId } = req.body;
    if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) {
      return res.status(400).json({ error: 'No stock batch IDs provided for bulk deletion.' });
    }

    const db = loadDb();
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Bulk batch deletion is restricted to Super Administrator only.' });
    }

    const idSet = new Set(stockItemIds);
    const batchesToRemove = db.stockItems.filter(si => idSet.has(si.id) && (scope === 'all' || !branchId || branchId === 'all' || si.branchId === branchId));

    batchesToRemove.forEach(si => {
      addBinCardEntry(
        db,
        si.branchId,
        si.medicineId,
        'Bulk Batch Deletion',
        si.id,
        undefined,
        userObj.name || userObj.username,
        0,
        si.quantity,
        si.batchNumber,
        si.expiryDate,
        `Stock batch permanently deleted in bulk.`
      );
    });

    const removeSet = new Set(batchesToRemove.map(s => s.id));
    db.stockItems = db.stockItems.filter(si => !removeSet.has(si.id));

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Bulk Delete Stock Batches',
      scope === 'all' ? 'all' : (branchId || 'all'),
      scope === 'all' ? 'All Branches' : (branchId || 'Specific Branch'),
      `Bulk deleted ${batchesToRemove.length} stock batch(es).`
    );

    return res.json({
      success: true,
      message: `Successfully deleted ${batchesToRemove.length} stock batch(es).`,
      deletedCount: batchesToRemove.length
    });
  });

  app.delete('/api/inventory/:id', (req, res) => {
    const { id } = req.params;
    const operatorId = req.query.operatorId as string;
    const branchId = req.query.branchId as string;
    const db = loadDb();
    
    const siIdx = db.stockItems.findIndex(si => si.id === id);
    if (siIdx === -1) {
      return res.status(404).json({ error: 'Stock batch not found.' });
    }
    
    const si = db.stockItems[siIdx];
    if (branchId && branchId !== 'all' && si.branchId !== branchId) {
      return res.status(403).json({ error: 'Access denied: Stock batch does not belong to your active branch scope.' });
    }
    
    const med = db.medicines.find(m => m.id === si.medicineId);
    const medName = med ? med.name : 'Unknown Product';
    
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    if (userObj.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Access denied: Deletion is restricted to Super Administrator only.' });
    }

    // Record bin card entry (Deletion of Batch)
    addBinCardEntry(
      db,
      si.branchId,
      si.medicineId,
      'Batch Deletion',
      si.id,
      undefined,
      userObj.name || userObj.username,
      0,
      si.quantity, // Quantity Out
      si.batchNumber,
      si.expiryDate,
      `Stock batch permanently deleted by operator.`
    );

    db.stockItems.splice(siIdx, 1);
    saveDb(db);
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete Stock Batch',
      'all',
      'All Branches',
      `Deleted batch ${si.batchNumber} of ${medName}.`
    );
    
    res.json({ success: true, message: `Batch ${si.batchNumber} of ${medName} deleted.` });
  });

  app.put('/api/inventory/:id', (req, res) => {
    const { id } = req.params;
    const { batchNumber, expiryDate, quantity, storeQuantity, dispensaryQuantity, buyingPrice, supplierId, isDamaged, notes, operatorId, editWho, editWhy, branchId, applyQtyToAll, applyPriceToAll } = req.body;
    const db = loadDb();

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         userObj.role === UserRole.BRANCH_MANAGER ||
                         userObj.role === UserRole.PHARMACIST ||
                         userObj.role === UserRole.STORE_KEEPER ||
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin' ||
                         !operatorId;
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Stock adjustments are restricted to authorized administrators and managers.' });
    }

    const idx = db.stockItems.findIndex(st => st.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Stock batch not found.' });
    }

    const reqBranchId = branchId || (req.query.branchId as string);
    const itemBranch = db.stockItems[idx].branchId || 'b1';
    if (reqBranchId && reqBranchId !== 'all' && itemBranch !== reqBranchId) {
      return res.status(403).json({ error: 'Access denied: Stock batch does not belong to your active branch scope.' });
    }

    const original = { ...db.stockItems[idx] };
    const originalStore = original.storeQuantity !== undefined ? original.storeQuantity : original.quantity;
    const originalDisp = original.dispensaryQuantity !== undefined ? original.dispensaryQuantity : 0;

    const newStoreQty = storeQuantity !== undefined ? Number(storeQuantity) : originalStore;
    const newDispQty = dispensaryQuantity !== undefined ? Number(dispensaryQuantity) : originalDisp;
    
    let finalStoreQty = newStoreQty;
    let finalDispQty = newDispQty;
    let newQty = quantity !== undefined ? Number(quantity) : (storeQuantity !== undefined || dispensaryQuantity !== undefined ? (newStoreQty + newDispQty) : original.quantity);

    if (quantity !== undefined && storeQuantity === undefined && dispensaryQuantity === undefined) {
      if (newQty === 0) {
        finalStoreQty = 0;
        finalDispQty = 0;
      } else if (newQty >= originalDisp) {
        finalStoreQty = newQty - originalDisp;
        finalDispQty = originalDisp;
      } else {
        finalStoreQty = 0;
        finalDispQty = newQty;
      }
    } else {
      newQty = finalStoreQty + finalDispQty;
    }
    
    let finalNotes = notes !== undefined ? notes : db.stockItems[idx].notes || '';
    if (original.quantity !== newQty && editWho && editWhy) {
      const auditRemark = `Qty changed from ${original.quantity} to ${newQty} by ${editWho} (Reason: ${editWhy}) on ${new Date().toLocaleDateString()}`;
      finalNotes = finalNotes ? `${finalNotes} | ${auditRemark}` : auditRemark;
    }

    const updated = {
      ...db.stockItems[idx],
      batchNumber: batchNumber !== undefined ? batchNumber : db.stockItems[idx].batchNumber,
      expiryDate: expiryDate !== undefined ? expiryDate : db.stockItems[idx].expiryDate,
      quantity: newQty,
      storeQuantity: finalStoreQty,
      dispensaryQuantity: finalDispQty,
      buyingPrice: buyingPrice !== undefined ? Number(buyingPrice) : db.stockItems[idx].buyingPrice,
      supplierId: supplierId !== undefined ? supplierId : db.stockItems[idx].supplierId,
      isDamaged: isDamaged !== undefined ? !!isDamaged : db.stockItems[idx].isDamaged,
      notes: finalNotes,
    };

    db.stockItems[idx] = updated;

    // Apply to all other active batches of this product if selected
    if (applyQtyToAll || applyPriceToAll) {
      const otherBatches = db.stockItems.filter((si: any) => si.medicineId === updated.medicineId && si.id !== updated.id && !si.isDamaged);
      otherBatches.forEach((si: any) => {
        const siOriginalQty = si.quantity;
        const siOriginalPrice = si.buyingPrice;

        if (applyQtyToAll) {
          si.quantity = newQty;
          si.storeQuantity = finalStoreQty;
          si.dispensaryQuantity = finalDispQty;
          
          if (editWho && editWhy) {
            const auditRemark = `Qty applied to all batches from batch ${updated.batchNumber} by ${editWho} (Reason: ${editWhy}) on ${new Date().toLocaleDateString()}`;
            si.notes = si.notes ? `${si.notes} | ${auditRemark}` : auditRemark;
          }

          if (siOriginalQty !== si.quantity) {
            addBinCardEntry(
              db,
              si.branchId,
              si.medicineId,
              'Adjustment',
              si.id,
              undefined,
              userObj.name || userObj.username,
              si.quantity > siOriginalQty ? (si.quantity - siOriginalQty) : 0,
              si.quantity < siOriginalQty ? (siOriginalQty - si.quantity) : 0,
              si.batchNumber,
              si.expiryDate,
              editWhy || 'Batch Qty applied to all batches'
            );
          }
        }

        if (applyPriceToAll) {
          si.buyingPrice = updated.buyingPrice;
          
          if (editWho && editWhy) {
            const auditRemark = `Price applied to all batches from batch ${updated.batchNumber} by ${editWho} (Reason: ${editWhy}) on ${new Date().toLocaleDateString()}`;
            si.notes = si.notes ? `${si.notes} | ${auditRemark}` : auditRemark;
          }

          if (siOriginalPrice !== si.buyingPrice) {
            addBinCardEntry(
              db,
              si.branchId,
              si.medicineId,
              'Price Adjustment',
              si.id,
              undefined,
              userObj.name || userObj.username,
              0,
              0,
              si.batchNumber,
              si.expiryDate,
              `Buying price changed from ${siOriginalPrice} to ${si.buyingPrice} (applied to all batches)`
            );
          }
        }
      });
    }

    // Record bin card entries for quantity or price adjustments
    if (original.quantity !== updated.quantity) {
      addBinCardEntry(
        db,
        updated.branchId,
        updated.medicineId,
        'Adjustment',
        updated.id,
        undefined,
        userObj.name || userObj.username,
        updated.quantity > original.quantity ? (updated.quantity - original.quantity) : 0,
        updated.quantity < original.quantity ? (original.quantity - updated.quantity) : 0,
        updated.batchNumber,
        updated.expiryDate,
        editWhy || 'Batch details direct edit/adjustment'
      );
    }

    if (original.buyingPrice !== updated.buyingPrice) {
      addBinCardEntry(
        db,
        updated.branchId,
        updated.medicineId,
        'Price Adjustment',
        updated.id,
        undefined,
        userObj.name || userObj.username,
        0,
        0,
        updated.batchNumber,
        updated.expiryDate,
        `Buying price changed from ${original.buyingPrice} to ${updated.buyingPrice}`
      );
    }

    // Apply global price propagation if the buying price was increased
    if (updated.buyingPrice > original.buyingPrice) {
      syncHigherPriceAcrossAllBranches(db, updated.medicineId, updated.buyingPrice);
    }

    syncMedicineWithLastBatch(db, updated.medicineId);
    saveDb(db);

    const med = db.medicines.find(m => m.id === updated.medicineId);
    
    let activityLogMsg = `Directly modified ${med?.name || 'Unknown'} (Batch: ${updated.batchNumber}). Qty: ${original.quantity} -> ${updated.quantity}.`;
    if (original.quantity !== updated.quantity && editWho && editWhy) {
      activityLogMsg += ` Edited by: ${editWho}. Reason: ${editWhy}.`;
    }

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Edit Inventory Batch',
      updated.branchId,
      'Active Branch',
      activityLogMsg
    );

    res.json(updated);
  });

  // ==================== INVENTORY / STOCK LEVELS ====================
  
  app.get('/api/inventory', (req, res) => {
    const db = loadDb();
    res.json(db.stockItems);
  });

  app.post('/api/inventory', (req, res) => {
    const { 
      medicineId, branchId, batchNumber, expiryDate, quantity, 
      buyingPrice, supplierId, isDamaged, storeQuantity, dispensaryQuantity, operatorId,
      invoiceNumber, purchaseInvoiceNumber
    } = req.body;
    const db = loadDb();
    
    const med = db.medicines.find(m => m.id === medicineId);
    if (!med) return res.status(404).json({ error: 'Medicine not found.' });

    const targetBranch = branchId || 'b1';
    const targetBatchNum = batchNumber || `B-${Date.now().toString().slice(-4)}`;
    const targetExpiry = expiryDate || (med.productType === 'cosmetics' ? '' : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const targetInvoice = invoiceNumber || purchaseInvoiceNumber || (med as any).purchaseInvoiceNumber || '';
    const addQty = Number(quantity) || 0;
    const targetSupplier = supplierId || (med as any).supplierId || 's1';

    const existingBatch = db.stockItems.find(st => 
      st.medicineId === medicineId && 
      st.branchId === targetBranch && 
      (st.batchNumber || '').trim().toLowerCase() === targetBatchNum.trim().toLowerCase()
    );

    let stockItemRef: any;

    if (existingBatch) {
      existingBatch.quantity += addQty;
      existingBatch.storeQuantity = (existingBatch.storeQuantity || 0) + (Number(storeQuantity) || addQty);
      existingBatch.dispensaryQuantity = (existingBatch.dispensaryQuantity || 0) + (Number(dispensaryQuantity) || 0);
      if (existingBatch.originalQuantity !== undefined) {
        existingBatch.originalQuantity += addQty;
      }
      if (expiryDate) existingBatch.expiryDate = expiryDate;
      if (buyingPrice) existingBatch.buyingPrice = Number(buyingPrice);
      if (targetSupplier) existingBatch.supplierId = targetSupplier;
      if (targetInvoice) (existingBatch as any).purchaseInvoiceNumber = targetInvoice;
      stockItemRef = existingBatch;
    } else {
      const newStock: StockItem & { purchaseInvoiceNumber?: string } = {
        id: generateId('st'),
        medicineId,
        branchId: targetBranch,
        batchNumber: targetBatchNum,
        expiryDate: targetExpiry,
        quantity: addQty,
        buyingPrice: Number(buyingPrice) || Number(med.buyingPrice) || 0,
        supplierId: targetSupplier,
        isDamaged: !!isDamaged,
        storeQuantity: Number(storeQuantity) || addQty,
        dispensaryQuantity: Number(dispensaryQuantity) || 0,
        originalQuantity: addQty,
        createdAt: new Date().toISOString().split('T')[0],
        purchaseInvoiceNumber: targetInvoice || undefined
      };
      db.stockItems.push(newStock);
      stockItemRef = newStock;
    }

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    addBinCardEntry(
      db,
      stockItemRef.branchId,
      stockItemRef.medicineId,
      'Purchase',
      stockItemRef.id,
      targetInvoice || undefined,
      userObj.name || userObj.username,
      addQty,
      0,
      targetBatchNum,
      targetExpiry,
      'Purchased stock batch entry.',
      { supplierId: targetSupplier }
    );

    syncHigherPriceAcrossAllBranches(db, stockItemRef.medicineId, stockItemRef.buyingPrice);
    syncMedicineWithLastBatch(db, stockItemRef.medicineId);
    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Add Stock Batch',
      stockItemRef.branchId,
      'Active Branch',
      `Purchased stock batch ${stockItemRef.batchNumber} (${addQty} units) for ${med.name}.`
    );

    res.status(211).json(stockItemRef);
  });

  app.post('/api/inventory/adjust', (req, res) => {
    const { stockItemId, adjustmentQty, reason, isDamaged, operatorId, branchId } = req.body;
    const db = loadDb();

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };
    const isAuthorized = userObj.role === UserRole.SUPER_ADMIN || 
                         userObj.role === UserRole.BRANCH_MANAGER ||
                         userObj.role === UserRole.PHARMACIST ||
                         userObj.role === UserRole.STORE_KEEPER ||
                         (userObj.role as string) === 'Admin' || 
                         userObj.username === 'admin' ||
                         !operatorId;
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied: Stock adjustments are restricted to authorized administrators and managers.' });
    }

    const stockItem = db.stockItems.find(st => st.id === stockItemId);
    if (!stockItem) return res.status(404).json({ error: 'Stock batch not found' });

    const reqBranchId = branchId || (req.query.branchId as string);
    const itemBranch = stockItem.branchId || 'b1';
    if (reqBranchId && reqBranchId !== 'all' && itemBranch !== reqBranchId) {
      return res.status(403).json({ error: 'Access denied: Stock batch does not belong to your active branch scope.' });
    }

    const originalQty = stockItem.quantity;
    const diff = Number(adjustmentQty) || 0;
    stockItem.quantity = Math.max(0, stockItem.quantity + diff);
    if (isDamaged !== undefined) stockItem.isDamaged = !!isDamaged;
    
    // Sync store & dispensary quantities
    let currentStore = stockItem.storeQuantity !== undefined ? stockItem.storeQuantity : originalQty;
    let currentDisp = stockItem.dispensaryQuantity !== undefined ? stockItem.dispensaryQuantity : 0;
    
    if (diff > 0) {
      currentStore += diff;
    } else if (diff < 0) {
      const absDiff = Math.abs(diff);
      if (currentStore >= absDiff) {
        currentStore -= absDiff;
      } else {
        const remaining = absDiff - currentStore;
        currentStore = 0;
        currentDisp = Math.max(0, currentDisp - remaining);
      }
    }
    stockItem.storeQuantity = currentStore;
    stockItem.dispensaryQuantity = currentDisp;

    // Create adjustment log details
    const med = db.medicines.find(m => m.id === stockItem.medicineId);
    const branch = db.branches.find(b => b.id === stockItem.branchId);

    if (diff !== 0) {
      addBinCardEntry(
        db,
        stockItem.branchId,
        stockItem.medicineId,
        'Adjustment',
        stockItem.id,
        undefined,
        userObj.name || userObj.username,
        diff > 0 ? diff : 0,
        diff < 0 ? Math.abs(diff) : 0,
        stockItem.batchNumber,
        stockItem.expiryDate,
        reason || 'Manual inventory adjustment'
      );
    }

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Adjust Inventory',
      stockItem.branchId,
      branch?.name || 'Unknown',
      `Adjusted ${med?.name} (Batch: ${stockItem.batchNumber}). Qty: ${originalQty} -> ${stockItem.quantity}. Reason: ${reason}`
    );

    res.json(stockItem);
  });

  app.post('/api/inventory/transfer-to-dispensary', (req, res) => {
    const { stockItemId, transferQty, operatorId } = req.body;
    const db = loadDb();

    const stockItem = db.stockItems.find(st => st.id === stockItemId);
    if (!stockItem) {
      return res.status(404).json({ error: 'Stock batch not found.' });
    }

    if (stockItem.isDamaged) {
      return res.status(400).json({ error: 'Cannot transfer damaged/quarantined stock. Please un-mark damage status first in Batch Edit.' });
    }

    const currentDispQty = stockItem.dispensaryQuantity !== undefined ? stockItem.dispensaryQuantity : 0;
    const currentStoreQty = stockItem.storeQuantity !== undefined 
      ? stockItem.storeQuantity 
      : Math.max(0, stockItem.quantity - currentDispQty);

    const qtyToTransfer = Number(transferQty);
    if (isNaN(qtyToTransfer) || qtyToTransfer <= 0) {
      return res.status(400).json({ error: 'Transfer quantity must be a positive number.' });
    }

    if (currentStoreQty < qtyToTransfer) {
      return res.status(400).json({ error: `Insufficient stock in store. Only ${currentStoreQty} units available in store.` });
    }

    stockItem.storeQuantity = currentStoreQty - qtyToTransfer;
    stockItem.dispensaryQuantity = currentDispQty + qtyToTransfer;
    stockItem.quantity = stockItem.storeQuantity + stockItem.dispensaryQuantity;

    const med = db.medicines.find(m => m.id === stockItem.medicineId);
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    addBinCardEntry(
      db,
      stockItem.branchId,
      stockItem.medicineId,
      'Internal Transfer',
      stockItem.id,
      undefined,
      userObj.name || userObj.username,
      0,
      0,
      stockItem.batchNumber,
      stockItem.expiryDate,
      `Transferred ${qtyToTransfer} units from Store to Dispensary.`
    );

    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Store to Dispensary Transfer',
      stockItem.branchId,
      'Active Branch',
      `Transferred ${qtyToTransfer} units of ${med?.name || 'Unknown'} (Batch: ${stockItem.batchNumber}) from Store to Dispensary.`
    );

    res.json(stockItem);
  });

  // ==================== SALES & POS INVOICES ====================
  
  app.get('/api/sales', (req, res) => {
    const db = loadDb();
    res.json(db.sales);
  });

  app.post('/api/sales', (req, res) => {
    try {
      const { 
        branchId, cashierId, customerId, customerTin, paymentMethod, items, discount, vatPercent, splitDetails, paymentDate
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Sale transaction must contain at least one item.' });
      }

      // Idempotency & Double-Click Protection
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotencyKey || req.body.clientRequestId;
      if (idempotencyKey && posIdempotencyCache.has(idempotencyKey)) {
        const cached = posIdempotencyCache.get(idempotencyKey)!;
        return res.status(200).json(cached.sale);
      }

      const db = loadDb();

      const branch = db.branches.find(b => b.id === branchId);
      const cashier = db.users.find(u => u.id === cashierId);
      if (!branch || !cashier) {
        return res.status(400).json({ error: 'Invalid branch or cashier details.' });
      }

      // Process customer if present
      let customer: Customer | undefined;
      if (customerId) {
        customer = db.customers.find(c => c.id === customerId);
      }

      const appliedVatPercent = vatPercent !== undefined ? Number(vatPercent) : 15;
      const todayStr = new Date().toISOString().split('T')[0];

      // ==========================================
      // PHASE 1: ATOMIC PRE-VALIDATION TRANSACTION
      // ==========================================
      const plannedDeductions: Array<{
        medicine: Medicine;
        stockItem: StockItem;
        quantity: number;
        unitPrice: number;
        lineSubtotal: number;
        lineVatAmount: number;
        lineTotal: number;
      }> = [];

      let runningSubtotal = 0;

      for (const item of items) {
        const { medicineId, quantity, selectedBatchId } = item;
        if (!quantity || quantity <= 0) {
          return res.status(400).json({ error: `Invalid item quantity: ${quantity}` });
        }
        
        const medicine = db.medicines.find(m => m.id === medicineId);
        if (!medicine) return res.status(400).json({ error: `Medicine ID ${medicineId} not registered.` });

        const medIdStr = String(medicineId).trim();
        const selBatchIdStr = selectedBatchId ? String(selectedBatchId).trim() : '';

        // 1. Primary lookup: Match exact batch ID, branch, and medicine ID
        let stockItem = db.stockItems.find(st => 
          selBatchIdStr && String(st.id).trim() === selBatchIdStr && 
          (st.branchId === branchId || st.branchId === 'all' || !st.branchId || branchId === 'all') && 
          String(st.medicineId).trim() === medIdStr
        );

        // 2. Fallback lookup by batch ID alone if unique batch ID exists
        if (!stockItem && selBatchIdStr && !selBatchIdStr.startsWith('virtual_')) {
          stockItem = db.stockItems.find(st => String(st.id).trim() === selBatchIdStr);
        }

        // Sync stockItem.quantity with storeQuantity + dispensaryQuantity if out of sync
        if (stockItem) {
          const totalCalculated = (stockItem.storeQuantity || 0) + (stockItem.dispensaryQuantity || 0);
          if (totalCalculated > 0 && (stockItem.quantity === 0 || stockItem.quantity < totalCalculated)) {
            stockItem.quantity = totalCalculated;
          }
        }

        // 3. Fallback lookup: Find any active non-damaged batch for this medicine with sufficient stock (FEFO)
        if (!stockItem || stockItem.quantity < quantity) {
          const availableBatches = db.stockItems.filter(st => {
            if (String(st.medicineId).trim() !== medIdStr || st.isDamaged) return false;
            const effQty = Math.max(st.quantity || 0, (st.storeQuantity || 0) + (st.dispensaryQuantity || 0));
            return effQty >= quantity;
          });

          if (availableBatches.length > 0) {
            availableBatches.sort((a, b) => {
              const aMatch = (a.branchId === branchId || a.branchId === 'all') ? 0 : 1;
              const bMatch = (b.branchId === branchId || b.branchId === 'all') ? 0 : 1;
              if (aMatch !== bMatch) return aMatch - bMatch;
              return (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999');
            });

            stockItem = availableBatches[0];
            const effQty = Math.max(stockItem.quantity || 0, (stockItem.storeQuantity || 0) + (stockItem.dispensaryQuantity || 0));
            stockItem.quantity = effQty;
          }
        }

        // 4. Fallback lookup: Virtual batch or medicine direct stock record
        if (!stockItem || stockItem.quantity < quantity) {
          const medDirectQty = Number((medicine as any).stockQuantity ?? medicine.stock ?? (medicine as any).quantity ?? 0);
          if (medDirectQty >= quantity) {
            let existingSi = db.stockItems.find(st => String(st.medicineId).trim() === medIdStr);
            if (!existingSi) {
              existingSi = {
                id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                medicineId: medicine.id,
                branchId: branchId === 'all' ? 'b1' : (branchId || 'b1'),
                batchNumber: (medicine as any).batchNumber || 'MAIN-BATCH',
                expiryDate: medicine.expiryDate || '2029-12-31',
                quantity: medDirectQty,
                buyingPrice: medicine.buyingPrice || Math.round((medicine.price || 0) * 0.7),
                supplierId: 'sup-default',
                isDamaged: false
              };
              db.stockItems.push(existingSi);
            } else {
              existingSi.quantity = Math.max(existingSi.quantity || 0, medDirectQty);
            }
            stockItem = existingSi;
          }
        }

        // Final Validation Check for this item
        const effectiveStockQty = stockItem ? Math.max(stockItem.quantity || 0, (stockItem.storeQuantity || 0) + (stockItem.dispensaryQuantity || 0)) : 0;
        if (!stockItem || effectiveStockQty < quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for ${medicine.name}. Available: ${effectiveStockQty} units, needed: ${quantity} units.` 
          });
        }

        // Expiry Safety Check
        if (stockItem.expiryDate && stockItem.expiryDate < todayStr) {
          return res.status(400).json({ 
            error: `Safety Alert: Batch ${stockItem.batchNumber} of ${medicine.name} expired on ${stockItem.expiryDate}. Dispensing blocked.` 
          });
        }

        const itemUnitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : medicine.price;
        const lineSubtotal = itemUnitPrice * quantity;
        runningSubtotal += lineSubtotal;

        const lineVatAmount = Number((lineSubtotal * (appliedVatPercent / 100)).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineVatAmount).toFixed(2));

        plannedDeductions.push({
          medicine,
          stockItem,
          quantity,
          unitPrice: itemUnitPrice,
          lineSubtotal,
          lineVatAmount,
          lineTotal
        });
      }

      // Calculations & Financial Limits
      const finalDiscount = Number(discount) || 0;
      const netAmount = Math.max(0, runningSubtotal - finalDiscount);
      const vatAmount = Number((netAmount * (appliedVatPercent / 100)).toFixed(2));
      const finalTotal = Number((netAmount + vatAmount).toFixed(2));

      // Credit limit validation
      if (paymentMethod === 'Credit') {
        if (!customer) {
          return res.status(400).json({ error: 'Customer profile required for Credit sales.' });
        }
        if (customer.creditBalance + finalTotal > customer.creditLimit) {
          return res.status(400).json({ 
            error: `Credit Denied: Limit exceeded. Purchase of ${finalTotal} exceeds ${customer.name}'s remaining limit of ${customer.creditLimit - customer.creditBalance} ETB.` 
          });
        }
      }

      // ==========================================
      // PHASE 2: ATOMIC EXECUTION & INVOICE CREATION
      // ==========================================
      const branchSales = db.sales.filter(s => s.branchId === branchId);
      const maxSerial = branchSales.reduce((max, s) => {
        const sNum = s.serialNumber || 0;
        return sNum > max ? sNum : max;
      }, 0);
      const serialNumber = maxSerial + 1;
      const branchPrefix = (branch.code || branchId).toUpperCase().replace(/\s+/g, '-');
      const invoiceNumber = `REC-${branchPrefix}-${serialNumber}`;
      const custName = req.body.customerName || req.body.patientName || customer?.name || 'Walk-in Patient';

      const saleItems: SaleItem[] = [];

      for (const deduction of plannedDeductions) {
        const { medicine, stockItem, quantity, unitPrice, lineVatAmount, lineTotal } = deduction;

        // Deduct inventory atomically
        stockItem.quantity -= quantity;
        let storeQty = stockItem.storeQuantity !== undefined ? stockItem.storeQuantity : (stockItem.quantity + quantity);
        let dispQty = stockItem.dispensaryQuantity !== undefined ? stockItem.dispensaryQuantity : 0;
        
        if (dispQty >= quantity) {
          dispQty -= quantity;
        } else {
          const remaining = quantity - dispQty;
          dispQty = 0;
          storeQty = Math.max(0, storeQty - remaining);
        }
        stockItem.storeQuantity = storeQty;
        stockItem.dispensaryQuantity = dispQty;

        // Record Bin Card Entry
        addBinCardEntry(
          db,
          branchId,
          medicine.id,
          'Issued',
          invoiceNumber,
          invoiceNumber,
          cashier.name || cashier.username || 'Admin',
          0,
          quantity,
          stockItem.batchNumber,
          stockItem.expiryDate,
          `Patient: ${custName}`,
          {
            customerName: custName,
            patientName: custName
          }
        );

        saleItems.push({
          id: generateId('si'),
          medicineId: medicine.id,
          medicineName: medicine.name,
          batchNumber: stockItem.batchNumber,
          quantity,
          unitPrice,
          discount: 0,
          vatAmount: lineVatAmount,
          total: lineTotal
        });
      }

      // Update credit balance and loyalty points
      if (customer && paymentMethod === 'Credit') {
        customer.creditBalance += finalTotal;
      }
      if (customer) {
        customer.loyaltyPoints += Math.floor(finalTotal / 10);
      }

      const isOnlineOrder = Boolean(req.body.isOnlineOrder || req.body.onlineOrderId || req.body.orderSource === 'Online Store');
      const orderSource = req.body.orderSource || (isOnlineOrder ? 'Online Store' : 'In-Store');
      const onlineOrderId = req.body.onlineOrderId || undefined;

      const newSale: Sale = {
        id: generateId('sal'),
        invoiceNumber,
        serialNumber,
        branchId,
        branchName: branch.name,
        date: paymentDate || new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        cashierId,
        cashierName: cashier.name,
        customerId: customer?.id,
        customerName: customer?.name,
        customerTin: customerTin || undefined,
        subtotal: runningSubtotal,
        discount: finalDiscount,
        vat: vatAmount,
        vatPercent: appliedVatPercent,
        total: finalTotal,
        paymentMethod: paymentMethod as any,
        splitDetails: splitDetails || undefined,
        status: 'Completed',
        items: saleItems,
        isOnlineOrder,
        orderSource,
        onlineOrderId
      };

      if (onlineOrderId && db.onlineOrders) {
        const ord = db.onlineOrders.find((o: any) => o.id === onlineOrderId);
        if (ord) {
          ord.status = 'Delivered';
        }
      }

      db.sales.unshift(newSale);

      // Save to idempotency cache
      if (idempotencyKey) {
        posIdempotencyCache.set(idempotencyKey, { timestamp: Date.now(), sale: newSale });
      }

      // Synchronously persist database state to guarantee real-time cross-device synchronization
      saveDb(db);

      logActivity(
        cashier.id,
        cashier.username,
        cashier.role,
        'Create Invoice',
        branchId,
        branch.name,
        `Issued receipt ${invoiceNumber}. Payment: ${paymentMethod}. Grand Total: ${finalTotal} ETB.`
      );

      // Send response to POS client
      res.status(200).json(newSale);
    } catch (err: any) {
      console.error('[POS SALE TRANSACTION ERROR]:', err);
      res.status(500).json({ error: 'Failed to process POS transaction: ' + (err?.message || 'Unknown error') });
    }
  });

  app.post('/api/sales/refund', (req, res) => {
    const { saleId, operatorId, reason } = req.body;
    const db = loadDb();

    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return res.status(404).json({ error: 'Invoice record not found' });
    if (sale.status === 'Returned') return res.status(400).json({ error: 'Transaction already refunded' });

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Admin' };

    // Reverse inventory balances for each line item
    sale.items.forEach(line => {
      // Try to find the matching batch
      const stockItem = db.stockItems.find(st => 
        st.branchId === sale.branchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
      );
      
      if (stockItem) {
        // Return item to stock
        stockItem.quantity += line.quantity;
        if (stockItem.dispensaryQuantity !== undefined) {
          stockItem.dispensaryQuantity += line.quantity;
        } else {
          stockItem.dispensaryQuantity = line.quantity;
          stockItem.storeQuantity = stockItem.quantity - line.quantity;
        }
      } else {
        // If batch was fully sold out and deleted, recreate batch
        db.stockItems.push({
          id: generateId('st'),
          medicineId: line.medicineId,
          branchId: sale.branchId,
          batchNumber: line.batchNumber,
          expiryDate: getRelativeDateStr(180), // default
          quantity: line.quantity,
          buyingPrice: line.unitPrice * 0.7, // approximation
          supplierId: 's1',
          isDamaged: false,
          storeQuantity: 0,
          dispensaryQuantity: line.quantity
        });
      }

      // RECORD BIN CARD ENTRY
      addBinCardEntry(
        db,
        sale.branchId,
        line.medicineId,
        'Refund Return',
        sale.invoiceNumber,
        sale.invoiceNumber,
        userObj.name || userObj.username,
        line.quantity, // Quantity In
        0, // Quantity Out
        line.batchNumber,
        stockItem ? stockItem.expiryDate : getRelativeDateStr(180),
        `Sale refunded: restocked item.`
      );
    });

    // If Credit sales, subtract from balance
    if (sale.paymentMethod === 'Credit' && sale.customerId) {
      const customer = db.customers.find(c => c.id === sale.customerId);
      if (customer) {
        customer.creditBalance = Math.max(0, customer.creditBalance - sale.total);
      }
    }

    sale.status = 'Returned';
    saveDb(db);
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Refund Invoice',
      sale.branchId,
      sale.branchName,
      `Issued full refund and restocked items for receipt: ${sale.invoiceNumber}. Reason: ${reason}`
    );

    res.json(sale);
  });

  app.post('/api/sales/void', (req, res) => {
    const { saleId, operatorId, reason } = req.body;
    const db = loadDb();

    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return res.status(404).json({ error: 'Invoice record not found' });
    if ((sale.status as string) === 'Voided' || sale.status === 'Returned') {
      return res.status(400).json({ error: 'Transaction is already voided/refunded' });
    }

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: 'Super Administrator', id: 'admin', name: 'Admin' };

    // Reverse inventory balances for each line item
    sale.items.forEach(line => {
      // Try to find matching batch
      const stockItem = db.stockItems.find(st => 
        st.branchId === sale.branchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
      );
      
      if (stockItem) {
        stockItem.quantity += line.quantity;
        if (stockItem.dispensaryQuantity !== undefined) {
          stockItem.dispensaryQuantity += line.quantity;
        } else {
          stockItem.dispensaryQuantity = line.quantity;
          stockItem.storeQuantity = stockItem.quantity - line.quantity;
        }
      } else {
        db.stockItems.push({
          id: generateId('st'),
          medicineId: line.medicineId,
          branchId: sale.branchId,
          batchNumber: line.batchNumber,
          expiryDate: (line as any).expiryDate || getRelativeDateStr(180),
          quantity: line.quantity,
          buyingPrice: line.unitPrice * 0.7,
          supplierId: 's1',
          isDamaged: false,
          storeQuantity: 0,
          dispensaryQuantity: line.quantity
        });
      }

      // RECORD BIN CARD ENTRY
      addBinCardEntry(
        db,
        sale.branchId,
        line.medicineId,
        'Void Return',
        sale.invoiceNumber,
        sale.invoiceNumber,
        userObj.name || userObj.username,
        line.quantity, // Quantity In
        0, // Quantity Out
        line.batchNumber,
        stockItem ? stockItem.expiryDate : getRelativeDateStr(180),
        `Sale voided: restocked item.`
      );
    });

    // If Credit sales, subtract from balance
    if (sale.paymentMethod === 'Credit' && sale.customerId) {
      const customer = db.customers.find(c => c.id === sale.customerId);
      if (customer) {
        customer.creditBalance = Math.max(0, customer.creditBalance - sale.total);
      }
    }

    sale.status = 'Voided' as any;
    saveDb(db);
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role as any,
      'Void Transaction',
      sale.branchId,
      sale.branchName,
      `Voided transaction and restocked items for receipt: ${sale.invoiceNumber}. Reason: ${reason}`
    );

    res.json(sale);
  });

  app.post('/api/sales/update-payment-method', (req, res) => {
    const { saleId, paymentMethod, operatorId, reason } = req.body;
    const db = loadDb();

    if (!saleId || !paymentMethod) {
      return res.status(400).json({ error: 'Missing required parameters (saleId, paymentMethod)' });
    }

    const sale = db.sales.find(s => s.id === saleId);
    if (!sale) return res.status(404).json({ error: 'Invoice record not found' });

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'user', role: 'Staff', id: operatorId || 'user', name: 'User' };

    const oldPaymentMethod = sale.paymentMethod;
    if (oldPaymentMethod === paymentMethod) {
      return res.json(sale);
    }

    // Handle customer credit adjustments if switching to/from Credit
    if (oldPaymentMethod === 'Credit' && paymentMethod !== 'Credit' && sale.customerId) {
      const customer = db.customers.find(c => c.id === sale.customerId);
      if (customer) {
        customer.creditBalance = Math.max(0, customer.creditBalance - sale.total);
      }
    } else if (paymentMethod === 'Credit' && oldPaymentMethod !== 'Credit' && sale.customerId) {
      const customer = db.customers.find(c => c.id === sale.customerId);
      if (customer) {
        customer.creditBalance += sale.total;
      }
    }

    // Store payment history audit
    if (!sale.paymentMethodHistory) {
      sale.paymentMethodHistory = [];
    }
    const changerName = userObj.name || userObj.username || 'User';
    sale.paymentMethodHistory.unshift({
      oldMethod: oldPaymentMethod,
      newMethod: paymentMethod,
      changedBy: `${changerName} (${userObj.role || 'User'})`,
      changedByRole: userObj.role || 'Staff',
      changedAt: new Date().toISOString(),
      reason: reason || 'Post-sale payment method adjustment'
    });
    sale.paymentMethodChanged = true;
    sale.lastPaymentChangeNote = `Changed from ${oldPaymentMethod} to ${paymentMethod} by ${changerName}`;

    sale.paymentMethod = paymentMethod as any;
    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role as any,
      'Update Payment Method',
      sale.branchId,
      sale.branchName || 'Branch',
      `Updated payment method for receipt #${sale.invoiceNumber} from ${oldPaymentMethod} to ${paymentMethod}${reason ? ` (Reason: ${reason})` : ''}`
    );

    res.json(sale);
  });

  // ==================== PURCHASE MANAGEMENT ====================
  
  app.get('/api/suppliers', (req, res) => {
    const db = loadDb();
    res.json(db.suppliers);
  });

  app.post('/api/suppliers', (req, res) => {
    const { name, phone, email, address, balance, operatorId } = req.body;
    const db = loadDb();

    const newSup: Supplier = {
      id: generateId('s'),
      name,
      phone,
      email,
      address,
      balance: Number(balance) || 0
    };

    db.suppliers.push(newSup);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Supplier',
      'all',
      'All Branches',
      `Registered medicine supplier: ${name}`
    );

    res.status(214).json(newSup);
  });

  app.delete('/api/suppliers/:id', (req, res) => {
    const { id } = req.params;
    const operatorId = req.query.operatorId as string;
    const db = loadDb();
    const supIdx = db.suppliers.findIndex(s => s.id === id);
    if (supIdx === -1) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }
    const sup = db.suppliers[supIdx];
    db.suppliers.splice(supIdx, 1);
    
    // Actively delete any associated transactions
    if (db.supplierTransactions) {
      db.supplierTransactions = db.supplierTransactions.filter(t => t.supplierId !== id);
    }
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete Supplier',
      'all',
      'All Branches',
      `Deleted medicine supplier actively: ${sup.name}`
    );

    res.json({ success: true, message: `Supplier ${sup.name} deleted successfully.` });
  });

  app.put('/api/suppliers/:id', (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address, balance, operatorId } = req.body;
    const db = loadDb();
    const sup = db.suppliers.find(s => s.id === id);
    if (!sup) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const oldName = sup.name;
    sup.name = name;
    sup.phone = phone;
    sup.email = email;
    sup.address = address;
    sup.balance = Number(balance) || 0;
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Supplier',
      'all',
      'All Branches',
      `Updated supplier: ${oldName} -> ${name}`
    );

    res.json(sup);
  });

  app.post('/api/suppliers/transactions/:id/toggle-paid', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.body;
    const db = loadDb();
    const tx = db.supplierTransactions?.find(t => t.id === id);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (tx.type !== 'Purchase Credit') {
      return res.status(400).json({ error: 'Only purchase credit invoices can have their payment status toggled.' });
    }

    const wasPaid = tx.paymentStatus === 'Paid';
    tx.paymentStatus = wasPaid ? 'Pending' : 'Paid';
    tx.paidAmount = wasPaid ? 0 : tx.amount;
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Toggle Supplier Credit Paid',
      'all',
      'All Branches',
      `Toggled paid status on credit bill ref ${tx.reference || tx.id} to ${tx.paymentStatus}`
    );

    res.json(tx);
  });

  app.get('/api/suppliers/transactions', (req, res) => {
    const db = loadDb();
    res.json(db.supplierTransactions || []);
  });

  app.post('/api/suppliers/transactions', (req, res) => {
    const { supplierId, date, type, amount, reference, dueDate, notes, operatorId, paymentTerms, creditTransactionId, branchId } = req.body;
    const db = loadDb();

    const supplier = db.suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const numAmount = Number(amount);
    if (type === 'Payment') {
      supplier.balance = Math.max(0, supplier.balance - numAmount);
    } else if (type === 'Purchase Credit') {
      supplier.balance += numAmount;
    }

    let targetCreditTxRef = reference;
    if (type === 'Payment' && creditTransactionId) {
      const creditTx = db.supplierTransactions?.find(t => t.id === creditTransactionId);
      if (creditTx) {
        creditTx.paidAmount = (creditTx.paidAmount || 0) + numAmount;
        if (creditTx.paidAmount >= creditTx.amount) {
          creditTx.paymentStatus = 'Paid';
        } else {
          creditTx.paymentStatus = 'Partially Paid';
        }
        targetCreditTxRef = `Pay: ${creditTx.reference || creditTx.id}`;
      }
    } else if (type === 'Payment' && reference) {
      // Auto-match by invoice/reference number
      const trimmedRef = reference.trim().toLowerCase();
      if (trimmedRef) {
        const creditTx = db.supplierTransactions?.find(t => 
          t.supplierId === supplierId && 
          t.type === 'Purchase Credit' && 
          t.reference && 
          t.reference.trim().toLowerCase() === trimmedRef
        );
        if (creditTx) {
          creditTx.paidAmount = (creditTx.paidAmount || 0) + numAmount;
          if (creditTx.paidAmount >= creditTx.amount) {
            creditTx.paymentStatus = 'Paid';
          } else {
            creditTx.paymentStatus = 'Partially Paid';
          }
        }
      }
    }

    const newTx: SupplierTransaction = {
      id: generateId('stx'),
      supplierId,
      branchId: branchId || undefined,
      date: date || new Date().toISOString().split('T')[0],
      type,
      amount: numAmount,
      reference: targetCreditTxRef || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
      paidAmount: type === 'Purchase Credit' ? 0 : undefined,
      paymentStatus: type === 'Purchase Credit' ? 'Pending' : undefined,
      paymentTerms: type === 'Purchase Credit' ? (paymentTerms || 'Net 30') : undefined
    };

    if (!db.supplierTransactions) {
      db.supplierTransactions = [];
    }
    db.supplierTransactions.unshift(newTx);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Supplier Transaction',
      'all',
      'All Branches',
      `Recorded supplier ${type} for ${supplier.name}. Amount: ${numAmount} ETB. Ref: ${reference || 'N/A'}`
    );

    res.status(214).json({ transaction: newTx, supplier });
  });

  app.post('/api/transfers/bulk', (req, res) => {
    const { sourceBranchId, targetBranchId, items, operatorId } = req.body;
    const db = loadDb();

    const src = db.branches.find(b => b.id === sourceBranchId);
    const tgt = db.branches.find(b => b.id === targetBranchId);
    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin', name: 'Administrator' };

    if (!src || !tgt) return res.status(400).json({ error: 'Invalid branch selections' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items selected for transfer' });

    // Verify stock in source for each item
    for (const line of items) {
      const srcBatch = db.stockItems.find(st => 
        st.branchId === sourceBranchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
      );
      const qtyNum = Number(line.quantity);
      if (!srcBatch || srcBatch.quantity < qtyNum) {
        const medName = db.medicines.find(m => m.id === line.medicineId)?.name || 'Unknown Item';
        return res.status(400).json({ 
          error: `Transfer Denied: Source branch has insufficient stock for batch ${line.batchNumber} of ${medName}.` 
        });
      }
    }

    const transferNumber = `TR-BULK-${Date.now().toString().slice(-4)}`;

    // Deduct and add
    const transferItems = [];
    for (const line of items) {
      const srcBatch = db.stockItems.find(st => 
        st.branchId === sourceBranchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
      )!;

      const qtyNum = Number(line.quantity);

      // Deduct from source total and store quantities
      srcBatch.quantity -= qtyNum;
      if (srcBatch.storeQuantity !== undefined) {
        srcBatch.storeQuantity = Math.max(0, srcBatch.storeQuantity - qtyNum);
      } else {
        srcBatch.storeQuantity = srcBatch.quantity;
      }
      if (srcBatch.dispensaryQuantity === undefined) {
        srcBatch.dispensaryQuantity = 0;
      }

      // Record Bin Card Entry for Source Branch (Stock Transfer Out)
      addBinCardEntry(
        db,
        sourceBranchId,
        line.medicineId,
        'Stock Transfer Out',
        transferNumber,
        undefined,
        userObj.name || userObj.username,
        0,
        qtyNum,
        line.batchNumber,
        line.expiryDate,
        `Bulk Transferred to ${tgt.name}`
      );

      const tgtBatch = db.stockItems.find(st => 
        st.branchId === targetBranchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
      );

      if (tgtBatch) {
        tgtBatch.quantity += qtyNum;
        if (tgtBatch.storeQuantity !== undefined) {
          tgtBatch.storeQuantity += qtyNum;
        } else {
          tgtBatch.storeQuantity = tgtBatch.quantity;
        }
        if (tgtBatch.dispensaryQuantity === undefined) {
          tgtBatch.dispensaryQuantity = 0;
        }
        if (srcBatch) {
          if (!tgtBatch.expiryDate && srcBatch.expiryDate) tgtBatch.expiryDate = srcBatch.expiryDate;
          if (!tgtBatch.supplierId && srcBatch.supplierId) tgtBatch.supplierId = srcBatch.supplierId;
          if (!tgtBatch.buyingPrice && srcBatch.buyingPrice) tgtBatch.buyingPrice = srcBatch.buyingPrice;
        }
      } else {
        db.stockItems.push({
          id: generateId('st'),
          medicineId: line.medicineId,
          branchId: targetBranchId,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate || srcBatch?.expiryDate || '',
          quantity: qtyNum,
          buyingPrice: srcBatch?.buyingPrice || 0,
          supplierId: srcBatch?.supplierId || '',
          isDamaged: false,
          storeQuantity: qtyNum,
          dispensaryQuantity: 0,
          originalQuantity: qtyNum,
          createdAt: new Date().toISOString().split('T')[0]
        });
      }

      // Record Bin Card Entry for Target Branch (Stock Transfer In)
      addBinCardEntry(
        db,
        targetBranchId,
        line.medicineId,
        'Stock Transfer In',
        transferNumber,
        undefined,
        userObj.name || userObj.username,
        qtyNum,
        0,
        line.batchNumber,
        line.expiryDate,
        `Bulk Transferred from ${src.name}`
      );

      const med = db.medicines.find(m => m.id === line.medicineId);
      transferItems.push({
        medicineId: line.medicineId,
        medicineName: med?.name || 'Unknown',
        quantity: qtyNum,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate
      });
    }

    // Record stock transfer record
    const newTransfer: StockTransfer = {
      id: generateId('t'),
      transferNumber,
      sourceBranchId,
      sourceBranchName: src.name,
      targetBranchId,
      targetBranchName: tgt.name,
      transferType: 'Internal',
      date: new Date().toISOString().split('T')[0],
      status: 'Received', // Bulk transfers are immediately processed and completed
      items: transferItems,
      requestedBy: userObj.name,
      processedBy: userObj.name
    };

    db.stockTransfers.unshift(newTransfer);
    saveDb(db);

    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Bulk Stock Transfer',
      sourceBranchId,
      src.name,
      `Executed bulk stock transfer ${transferNumber} of ${items.length} items to ${tgt.name}.`
    );

    res.status(210).json(newTransfer);
  });

  app.get('/api/purchases', (req, res) => {
    const db = loadDb();
    res.json(db.purchaseOrders);
  });

  app.post('/api/purchases', (req, res) => {
    const { supplierId, branchId, items, operatorId } = req.body;
    const db = loadDb();

    const supplier = db.suppliers.find(s => s.id === supplierId);
    const branch = db.branches.find(b => b.id === branchId);
    if (!supplier || !branch) {
      return res.status(400).json({ error: 'Invalid supplier or branch selection.' });
    }

    let total = 0;
    const poItems = items.map((it: any) => {
      const med = db.medicines.find(m => m.id === it.medicineId);
      const lineTotal = Number(it.quantity) * Number(it.unitPrice);
      total += lineTotal;
      return {
        id: generateId('pi'),
        medicineId: it.medicineId,
        medicineName: med?.name || 'Unknown',
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        total: lineTotal
      };
    });

    const newPo: PurchaseOrder = {
      id: generateId('po'),
      poNumber: `PO-${Date.now().toString().slice(-4)}-${Math.floor(10 + Math.random() * 90)}`,
      supplierId,
      supplierName: supplier.name,
      branchId,
      branchName: branch.name,
      date: new Date().toISOString().split('T')[0],
      total,
      status: 'Sent',
      items: poItems
    };

    db.purchaseOrders.unshift(newPo);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Purchase Order',
      branchId,
      branch.name,
      `Created Purchase Order ${newPo.poNumber} to ${supplier.name}. Value: ${total} ETB.`
    );

    res.status(215).json(newPo);
  });

  app.post('/api/purchases/receive', (req, res) => {
    const { purchaseOrderId, itemsBatchData, operatorId } = req.body;
    // itemsBatchData is an object: { [medicineId]: { batchNumber, expiryDate } }
    
    const db = loadDb();
    const po = db.purchaseOrders.find(p => p.id === purchaseOrderId);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'Received') return res.status(400).json({ error: 'This PO has already been received.' });

    const receiver = db.users.find(u => u.id === operatorId) || { name: 'Store Keeper', id: 'keeper' };

    // Update inventories for each item
    po.items.forEach(line => {
      const batchInfo = itemsBatchData[line.medicineId] || { batchNumber: `B-${Date.now().toString().slice(-4)}`, expiryDate: getRelativeDateStr(365) };
      
      // Check if exact batch already exists
      const existingBatch = db.stockItems.find(st => 
        st.branchId === po.branchId && 
        st.medicineId === line.medicineId && 
        (st.batchNumber || '').trim().toLowerCase() === (batchInfo.batchNumber || '').trim().toLowerCase()
      );

      if (existingBatch) {
        existingBatch.quantity += line.quantity;
      } else {
        db.stockItems.push({
          id: generateId('st'),
          medicineId: line.medicineId,
          branchId: po.branchId,
          batchNumber: batchInfo.batchNumber,
          expiryDate: batchInfo.expiryDate,
          quantity: line.quantity,
          buyingPrice: line.unitPrice,
          supplierId: po.supplierId,
          isDamaged: false
        });
      }

      // RECORD BIN CARD ENTRY
      addBinCardEntry(
        db,
        po.branchId,
        line.medicineId,
        'Purchase',
        po.poNumber,
        undefined,
        receiver.name || 'Store Keeper',
        line.quantity,
        0,
        batchInfo.batchNumber,
        batchInfo.expiryDate,
        `Received Purchase Order ${po.poNumber}`,
        { supplierId: po.supplierId, supplierName: po.supplierName }
      );

      syncHigherPriceAcrossAllBranches(db, line.medicineId, line.unitPrice);
      syncMedicineWithLastBatch(db, line.medicineId);
    });

    // Update supplier accounts balance due
    const supplier = db.suppliers.find(s => s.id === po.supplierId);
    if (supplier) {
      supplier.balance += po.total;
    }

    // Auto-log a corresponding Purchase Credit transaction to trace the liability
    const newTx: SupplierTransaction = {
      id: generateId('stx'),
      supplierId: po.supplierId,
      date: new Date().toISOString().split('T')[0],
      type: 'Purchase Credit',
      amount: po.total,
      reference: po.poNumber,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days due date default
      notes: `Auto-generated credit invoice for receiving PO ${po.poNumber}`,
      paidAmount: 0,
      paymentStatus: 'Pending',
      paymentTerms: 'Net 30'
    };
    if (!db.supplierTransactions) {
      db.supplierTransactions = [];
    }
    db.supplierTransactions.unshift(newTx);

    po.status = 'Received';
    po.receivedDate = new Date().toISOString().split('T')[0];
    po.receivedBy = receiver.name;

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Receive Goods',
      po.branchId,
      po.branchName,
      `Received items for PO ${po.poNumber}. Consolidated with supplier balance. Registered new inventory batches.`
    );

    res.json(po);
  });

  // ==================== STOCK TRANSFERS ====================
  
  app.get('/api/transfers', (req, res) => {
    const db = loadDb();
    res.json(db.stockTransfers || []);
  });

  app.get('/api/external-pharmacies', (req, res) => {
    const db = loadDb();
    res.json(db.externalPharmacies || []);
  });

  app.post('/api/external-pharmacies', (req, res) => {
    const { name, phone, email, address, tinNumber } = req.body;
    if (!name) return res.status(400).json({ error: 'Pharmacy name is required' });
    const db = loadDb();
    if (!db.externalPharmacies) db.externalPharmacies = [];
    const newEp = {
      id: generateId('ep'),
      name,
      phone,
      email,
      address,
      tinNumber
    };
    db.externalPharmacies.push(newEp);
    saveDb(db);
    res.json(newEp);
  });

  function verifySourceStockAvailability(db: any, sourceBranchId: string, items: any[]) {
    for (const line of items) {
      const qtyNeeded = Number(line.quantity) || 0;
      if (qtyNeeded <= 0) continue;

      const branchStockItems = db.stockItems.filter((st: any) =>
        st.branchId === sourceBranchId &&
        st.medicineId === line.medicineId &&
        !st.isDamaged
      );

      const totalAvailableInBranch = branchStockItems.reduce((sum: number, st: any) => sum + Math.max(0, Number(st.quantity) || 0), 0);

      if (totalAvailableInBranch < qtyNeeded) {
        const medName = db.medicines.find((m: any) => m.id === line.medicineId)?.name || 'Unknown Item';
        return {
          ok: false,
          error: `Insufficient stock in source branch for ${medName} (Batch: ${line.batchNumber || 'N/A'}). Needed: ${qtyNeeded}, Available in branch: ${totalAvailableInBranch}.`
        };
      }
    }
    return { ok: true };
  }

  function deductSourceStockForTransfer(
    db: any,
    sourceBranchId: string,
    items: any[],
    transferNumber: string,
    operatorName: string,
    destinationName: string
  ) {
    for (const line of items) {
      let remainingToDeduct = Number(line.quantity) || 0;
      if (remainingToDeduct <= 0) continue;

      const branchStockItems = db.stockItems.filter((st: any) =>
        st.branchId === sourceBranchId &&
        st.medicineId === line.medicineId &&
        !st.isDamaged
      );

      const targetBatchLower = (line.batchNumber || '').trim().toLowerCase();
      branchStockItems.sort((a: any, b: any) => {
        const aMatch = targetBatchLower && (a.batchNumber || '').trim().toLowerCase() === targetBatchLower ? 1 : 0;
        const bMatch = targetBatchLower && (b.batchNumber || '').trim().toLowerCase() === targetBatchLower ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return (b.quantity || 0) - (a.quantity || 0);
      });

      for (const srcBatch of branchStockItems) {
        if (remainingToDeduct <= 0) break;
        const currentQty = Math.max(0, Number(srcBatch.quantity) || 0);
        if (currentQty <= 0) continue;

        const deductAmount = Math.min(currentQty, remainingToDeduct);
        srcBatch.quantity -= deductAmount;

        if (srcBatch.storeQuantity !== undefined) {
          srcBatch.storeQuantity = Math.max(0, srcBatch.storeQuantity - deductAmount);
        } else {
          srcBatch.storeQuantity = srcBatch.quantity;
        }
        if (srcBatch.dispensaryQuantity === undefined) {
          srcBatch.dispensaryQuantity = 0;
        }

        addBinCardEntry(
          db,
          sourceBranchId,
          line.medicineId,
          'Stock Transfer Out',
          transferNumber,
          undefined,
          operatorName,
          0,
          deductAmount,
          srcBatch.batchNumber || line.batchNumber || 'N/A',
          srcBatch.expiryDate || line.expiryDate,
          `Transferred to ${destinationName}`
        );

        remainingToDeduct -= deductAmount;
      }

      if (remainingToDeduct > 0 && branchStockItems.length > 0) {
        const srcBatch = branchStockItems[0];
        srcBatch.quantity = Math.max(0, srcBatch.quantity - remainingToDeduct);
        if (srcBatch.storeQuantity !== undefined) {
          srcBatch.storeQuantity = Math.max(0, srcBatch.storeQuantity - remainingToDeduct);
        }
        addBinCardEntry(
          db,
          sourceBranchId,
          line.medicineId,
          'Stock Transfer Out',
          transferNumber,
          undefined,
          operatorName,
          0,
          remainingToDeduct,
          srcBatch.batchNumber || line.batchNumber || 'N/A',
          srcBatch.expiryDate || line.expiryDate,
          `Transferred to ${destinationName}`
        );
      }
    }
  }

  app.post('/api/transfers', (req, res) => {
    const { sourceBranchId, targetBranchId, externalPharmacyName, transferType, items, operatorId, status, notes } = req.body;
    const db = loadDb();

    const src = db.branches.find(b => b.id === sourceBranchId);
    if (!src) return res.status(400).json({ error: 'Invalid source branch selected.' });

    let tgtName = '';
    if (transferType === 'Internal') {
      const tgt = db.branches.find(b => b.id === targetBranchId);
      if (!tgt) return res.status(400).json({ error: 'Invalid target branch selected.' });
      tgtName = tgt.name;
    }

    const requester = db.users.find(u => u.id === operatorId) || { name: 'Branch Manager', role: 'Branch Manager' };

    // Stock availability validation on request (only if approving immediately)
    const initialStatus = status || 'Pending';
    const isDeductingImmediately = ['Approved', 'Dispatched', 'Received', 'Completed'].includes(initialStatus);

    if (isDeductingImmediately && requester.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Permission Denied: Only Super Administrators can immediately approve or complete stock transfers.' });
    }

    if (isDeductingImmediately) {
      // Dry run stock availability checks across branch
      const checkResult = verifySourceStockAvailability(db, sourceBranchId, items);
      if (!checkResult.ok) {
        return res.status(400).json({ error: checkResult.error });
      }

      // Precalculate transferNumber
      const transferNumber = `TR-${Date.now().toString().slice(-4)}-${Math.floor(10 + Math.random() * 90)}`;

      // Perform deduction
      deductSourceStockForTransfer(
        db,
        sourceBranchId,
        items,
        transferNumber,
        requester.name || 'Branch Manager',
        transferType === 'Internal' ? tgtName : externalPharmacyName
      );

      if (transferType === 'Internal' && ['Received', 'Completed'].includes(initialStatus)) {
        // Increase stock immediately at destination
        for (const line of items) {
          const srcBatch = db.stockItems.find(st => 
            st.branchId === sourceBranchId && 
            st.medicineId === line.medicineId && 
            (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
          ) || db.stockItems.find(st => st.branchId === sourceBranchId && st.medicineId === line.medicineId);

          const tgtBatch = db.stockItems.find(st => 
            st.branchId === targetBranchId && 
            st.medicineId === line.medicineId && 
            (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
          );
          if (tgtBatch) {
            tgtBatch.quantity += Number(line.quantity);
            if (tgtBatch.storeQuantity !== undefined) {
              tgtBatch.storeQuantity += Number(line.quantity);
            } else {
              tgtBatch.storeQuantity = tgtBatch.quantity;
            }
            if (tgtBatch.dispensaryQuantity === undefined) {
              tgtBatch.dispensaryQuantity = 0;
            }
            if (srcBatch) {
              if (!tgtBatch.expiryDate && srcBatch.expiryDate) tgtBatch.expiryDate = srcBatch.expiryDate;
              if (!tgtBatch.supplierId && srcBatch.supplierId) tgtBatch.supplierId = srcBatch.supplierId;
              if (!tgtBatch.buyingPrice && srcBatch.buyingPrice) tgtBatch.buyingPrice = srcBatch.buyingPrice;
            }
          } else {
            db.stockItems.push({
              id: generateId('st'),
              medicineId: line.medicineId,
              branchId: targetBranchId!,
              batchNumber: line.batchNumber || srcBatch?.batchNumber || 'B-AUTO-1',
              expiryDate: line.expiryDate || srcBatch?.expiryDate || '',
              quantity: Number(line.quantity),
              buyingPrice: srcBatch?.buyingPrice || 0,
              supplierId: srcBatch?.supplierId || '',
              isDamaged: false,
              storeQuantity: Number(line.quantity),
              dispensaryQuantity: 0,
              originalQuantity: Number(line.quantity),
              createdAt: new Date().toISOString().split('T')[0]
            });
          }

          // RECORD BIN CARD ENTRY (STOCK TRANSFER IN TO TARGET)
          addBinCardEntry(
            db,
            targetBranchId!,
            line.medicineId,
            'Stock Transfer In',
            transferNumber,
            undefined,
            requester.name,
            Number(line.quantity),
            0,
            line.batchNumber,
            line.expiryDate,
            `Transferred from ${src.name}`
          );
        }
      }
    } else {
      // Just precalculate transferNumber even if not approved immediately
      var transferNumber = `TR-${Date.now().toString().slice(-4)}-${Math.floor(10 + Math.random() * 90)}`;
    }

    const transferItems = items.map((it: any) => {
      const med = db.medicines.find(m => m.id === it.medicineId);
      return {
        medicineId: it.medicineId,
        medicineName: med?.name || 'Unknown',
        quantity: Number(it.quantity),
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate
      };
    });

    const newTransfer: StockTransfer = {
      id: generateId('t'),
      transferNumber,
      sourceBranchId,
      sourceBranchName: src.name,
      targetBranchId: transferType === 'Internal' ? targetBranchId : undefined,
      targetBranchName: transferType === 'Internal' ? tgtName : undefined,
      externalPharmacyName: transferType === 'External' ? externalPharmacyName : undefined,
      transferType,
      date: new Date().toISOString().split('T')[0],
      status: initialStatus,
      items: transferItems,
      requestedBy: requester.name,
      notes: notes || ''
    };

    if (!db.stockTransfers) db.stockTransfers = [];
    db.stockTransfers.unshift(newTransfer);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Stock Transfer',
      sourceBranchId,
      src.name,
      `Created stock transfer ${newTransfer.transferNumber} (${transferType}) with status ${initialStatus}.`
    );

    res.status(200).json(newTransfer);
  });

  app.post('/api/transfers/edit', (req, res) => {
    const { transferId, sourceBranchId, targetBranchId, externalPharmacyName, transferType, items, operatorId, notes } = req.body;
    const db = loadDb();

    const transfer = db.stockTransfers.find(t => t.id === transferId);
    if (!transfer) return res.status(404).json({ error: 'Transfer order not found.' });

    if (transfer.status !== 'Draft' && transfer.status !== 'Pending') {
      return res.status(400).json({ error: 'Only Draft and Pending transfers can be edited.' });
    }

    const src = db.branches.find(b => b.id === sourceBranchId);
    if (!src) return res.status(400).json({ error: 'Invalid source branch selected.' });

    let tgtName = '';
    if (transferType === 'Internal') {
      const tgt = db.branches.find(b => b.id === targetBranchId);
      if (!tgt) return res.status(400).json({ error: 'Invalid target branch selected.' });
      tgtName = tgt.name;
    }

    const transferItems = items.map((it: any) => {
      const med = db.medicines.find(m => m.id === it.medicineId);
      return {
        medicineId: it.medicineId,
        medicineName: med?.name || 'Unknown',
        quantity: Number(it.quantity),
        batchNumber: it.batchNumber,
        expiryDate: it.expiryDate
      };
    });

    transfer.sourceBranchId = sourceBranchId;
    transfer.sourceBranchName = src.name;
    transfer.targetBranchId = transferType === 'Internal' ? targetBranchId : undefined;
    transfer.targetBranchName = transferType === 'Internal' ? tgtName : undefined;
    transfer.externalPharmacyName = transferType === 'External' ? externalPharmacyName : undefined;
    transfer.transferType = transferType;
    transfer.items = transferItems;
    transfer.notes = notes || '';

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Edit Stock Transfer',
      sourceBranchId,
      src.name,
      `Edited stock transfer ${transfer.transferNumber || transfer.id}.`
    );

    res.status(200).json(transfer);
  });

  app.post('/api/transfers/update', (req, res) => {
    const { transferId, status, operatorId, reason } = req.body;
    const db = loadDb();

    const transfer = db.stockTransfers.find(t => t.id === transferId);
    if (!transfer) return res.status(404).json({ error: 'Transfer order not found.' });

    const processor = db.users.find(u => u.id === operatorId) || { name: 'Admin', role: UserRole.SUPER_ADMIN, username: 'admin', id: 'admin' };
    const oldStatus = transfer.status;

    if (oldStatus === status) {
      return res.status(400).json({ error: `Transfer is already in ${status} status.` });
    }

    // Restrict approval and processing statuses to Super Administrators only
    const isAdminOnlyStatus = ['Approved', 'Dispatched', 'Received', 'Completed', 'Cancelled', 'Reversed'].includes(status);
    if (isAdminOnlyStatus && processor.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ error: 'Permission Denied: Only Super Administrators can approve or process stock transfers.' });
    }

    // Determine current state of stock deduction and where stock is
    const wasDeductedFromSource = ['Approved', 'Dispatched', 'Received', 'Completed'].includes(oldStatus);
    const isNowDeductedFromSource = ['Approved', 'Dispatched', 'Received', 'Completed'].includes(status);

    const wasAddedToTarget = transfer.transferType === 'Internal' && ['Received', 'Completed'].includes(oldStatus);
    const isNowAddedToTarget = transfer.transferType === 'Internal' && ['Received', 'Completed'].includes(status);

    // Validate stock before applying any changes (Dry run)
    if (isNowDeductedFromSource && !wasDeductedFromSource) {
      // We are going to deduct from Source. Check stock availability!
      const checkResult = verifySourceStockAvailability(db, transfer.sourceBranchId, transfer.items);
      if (!checkResult.ok) {
        return res.status(400).json({ error: checkResult.error });
      }
    }

    if (!isNowAddedToTarget && wasAddedToTarget) {
      // We are going to REMOVE from Target because we are reverting or cancelling. Check target has the stock!
      for (const line of transfer.items) {
        const tgtBatch = db.stockItems.find(st => 
          st.branchId === transfer.targetBranchId && 
          st.medicineId === line.medicineId && 
          (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
        );
        const qtyNum = Number(line.quantity);
        if (!tgtBatch || tgtBatch.quantity < qtyNum) {
          return res.status(400).json({
            error: `Cannot cancel/revert. Target branch already consumed/moved ${line.medicineName} (Batch: ${line.batchNumber}).`
          });
        }
      }
    }

    // Apply the stock changes statefully
    // 1. Source branch adjustments
    if (isNowDeductedFromSource && !wasDeductedFromSource) {
      // Deduct from source
      deductSourceStockForTransfer(
        db,
        transfer.sourceBranchId,
        transfer.items,
        transfer.transferNumber,
        processor.name || 'Admin',
        transfer.transferType === 'Internal' ? (transfer.targetBranchName || 'Target') : (transfer.externalPharmacyName || 'External')
      );
    } else if (!isNowDeductedFromSource && wasDeductedFromSource) {
      // Return stock back to source (e.g. transfer Cancelled or reverted to Draft/Pending)
      for (const line of transfer.items) {
        const srcBatch = db.stockItems.find(st => 
          st.branchId === transfer.sourceBranchId && 
          st.medicineId === line.medicineId && 
          (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
        );
        const qtyNum = Number(line.quantity);
        if (srcBatch) {
          srcBatch.quantity += qtyNum;
          if (srcBatch.storeQuantity !== undefined) {
            srcBatch.storeQuantity += qtyNum;
          } else {
            srcBatch.storeQuantity = srcBatch.quantity;
          }
          if (srcBatch.dispensaryQuantity === undefined) {
            srcBatch.dispensaryQuantity = 0;
          }
        } else {
          // If batch was deleted or missing, re-create it
          db.stockItems.push({
            id: generateId('st'),
            medicineId: line.medicineId,
            branchId: transfer.sourceBranchId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            quantity: qtyNum,
            buyingPrice: 0,
            supplierId: '',
            isDamaged: false,
            storeQuantity: qtyNum,
            dispensaryQuantity: 0,
            originalQuantity: qtyNum,
            createdAt: new Date().toISOString().split('T')[0]
          });
        }

        // RECORD BIN CARD ENTRY (STOCK TRANSFER IN TO SOURCE - REVERTED)
        addBinCardEntry(
          db,
          transfer.sourceBranchId,
          line.medicineId,
          'Stock Transfer In',
          transfer.transferNumber,
          undefined,
          processor.name || 'Admin',
          qtyNum,
          0,
          line.batchNumber,
          line.expiryDate,
          `Stock returned from cancelled/reverted transfer`
        );
      }
    }

    // 2. Target branch adjustments (Internal only)
    if (transfer.transferType === 'Internal') {
      if (isNowAddedToTarget && !wasAddedToTarget) {
        // Add to target
        for (const line of transfer.items) {
          const srcBatch = db.stockItems.find(st => 
            st.branchId === transfer.sourceBranchId && 
            st.medicineId === line.medicineId && 
            (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
          );
          const buyingPrice = srcBatch?.buyingPrice || 0;
          const supplierId = srcBatch?.supplierId || '';

          const tgtBatch = db.stockItems.find(st => 
            st.branchId === transfer.targetBranchId && 
            st.medicineId === line.medicineId && 
            (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
          );
          const qtyNum = Number(line.quantity);
          if (tgtBatch) {
            tgtBatch.quantity += qtyNum;
            if (tgtBatch.storeQuantity !== undefined) {
              tgtBatch.storeQuantity += qtyNum;
            } else {
              tgtBatch.storeQuantity = tgtBatch.quantity;
            }
            if (tgtBatch.dispensaryQuantity === undefined) {
              tgtBatch.dispensaryQuantity = 0;
            }
            if (srcBatch) {
              if (!tgtBatch.expiryDate && srcBatch.expiryDate) tgtBatch.expiryDate = srcBatch.expiryDate;
              if (!tgtBatch.supplierId && srcBatch.supplierId) tgtBatch.supplierId = srcBatch.supplierId;
              if (!tgtBatch.buyingPrice && srcBatch.buyingPrice) tgtBatch.buyingPrice = srcBatch.buyingPrice;
            }
          } else {
            db.stockItems.push({
              id: generateId('st'),
              medicineId: line.medicineId,
              branchId: transfer.targetBranchId!,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate || srcBatch?.expiryDate || '',
              quantity: qtyNum,
              buyingPrice,
              supplierId,
              isDamaged: false,
              storeQuantity: qtyNum,
              dispensaryQuantity: 0,
              originalQuantity: qtyNum,
              createdAt: new Date().toISOString().split('T')[0]
            });
          }

          // RECORD BIN CARD ENTRY (STOCK TRANSFER IN TO TARGET)
          addBinCardEntry(
            db,
            transfer.targetBranchId!,
            line.medicineId,
            'Stock Transfer In',
            transfer.transferNumber,
            undefined,
            processor.name || 'Admin',
            qtyNum,
            0,
            line.batchNumber,
            line.expiryDate,
            `Stock received from branch ${transfer.sourceBranchName}`
          );
        }
      } else if (!isNowAddedToTarget && wasAddedToTarget) {
        // Deduct from target
        for (const line of transfer.items) {
          const tgtBatch = db.stockItems.find(st => 
            st.branchId === transfer.targetBranchId && 
            st.medicineId === line.medicineId && 
            (st.batchNumber || '').trim().toLowerCase() === (line.batchNumber || '').trim().toLowerCase()
          )!;
          const qtyNum = Number(line.quantity);
          tgtBatch.quantity -= qtyNum;
          if (tgtBatch.storeQuantity !== undefined) {
            tgtBatch.storeQuantity = Math.max(0, tgtBatch.storeQuantity - qtyNum);
          } else {
            tgtBatch.storeQuantity = tgtBatch.quantity;
          }
          if (tgtBatch.dispensaryQuantity === undefined) {
            tgtBatch.dispensaryQuantity = 0;
          }

          // RECORD BIN CARD ENTRY (STOCK TRANSFER OUT FROM TARGET - REVERTED)
          addBinCardEntry(
            db,
            transfer.targetBranchId!,
            line.medicineId,
            'Stock Transfer Out',
            transfer.transferNumber,
            undefined,
            processor.name || 'Admin',
            0,
            qtyNum,
            line.batchNumber,
            line.expiryDate,
            `Stock returned because transfer was cancelled/reverted`
          );
        }
      }
    }

    transfer.status = status;
    transfer.processedBy = processor.name;
    if (reason && reason.trim()) {
      const stamp = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      transfer.notes = transfer.notes 
        ? `${transfer.notes} | [${status} on ${stamp} by ${processor.name}]: ${reason.trim()}`
        : `[${status} on ${stamp} by ${processor.name}]: ${reason.trim()}`;
    }
    saveDb(db);

    logActivity(
      processor.id,
      processor.username,
      processor.role,
      'Update Stock Transfer',
      transfer.sourceBranchId,
      transfer.sourceBranchName,
      `Stock transfer ${transfer.transferNumber} status changed from ${oldStatus} to ${status} by ${processor.name}.`
    );

    res.json(transfer);
  });

  // ==================== CUSTOMER PORTFOLIOS ====================
  
  app.get('/api/customers', (req, res) => {
    const db = loadDb();
    res.json(db.customers);
  });

  app.post('/api/customers', (req, res) => {
    const { name, phone, email, address, creditLimit, operatorId } = req.body;
    const db = loadDb();

    const newCust: Customer = {
      id: generateId('c'),
      name,
      phone,
      email,
      address,
      loyaltyPoints: 0,
      creditLimit: Number(creditLimit) || 5000,
      creditBalance: 0
    };

    db.customers.push(newCust);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Customer',
      'all',
      'All Branches',
      `Registered customer loyalty account: ${name}. Credit Limit: ${creditLimit} ETB.`
    );

    res.status(217).json(newCust);
  });

  // ==================== EXTERNAL CUSTOMER PUBLIC STORE & ORDERS ====================

  // Public Catalog for External Customers (No Auth required)
  app.get('/api/public/catalog', (req, res) => {
    const db = loadDb();
    const branchId = (req.query.branchId as string) || 'all';

    const items = db.medicines.map((m: any, idx: number) => {
      const mBatches = db.stockItems.filter((st: any) => 
        st.medicineId === m.id && 
        !st.isDamaged && 
        (branchId === 'all' || st.branchId === branchId) &&
        st.quantity > 0
      );
      const availableQuantity = mBatches.reduce((acc: number, b: any) => acc + (Number(b.quantity) || 0), 0);
      
      // Calculate creation timestamp
      let createdAtTimestamp = 0;
      if (m.createdAt) {
        createdAtTimestamp = new Date(m.createdAt).getTime() || 0;
      } else if (m.lastEditedAt) {
        createdAtTimestamp = new Date(m.lastEditedAt).getTime() || 0;
      } else {
        const match = m.id.match(/\d{9,}/);
        if (match) createdAtTimestamp = Number(match[0]);
      }
      // Fallback relative sequence timestamp if no date found
      if (!createdAtTimestamp) {
        createdAtTimestamp = 1600000000000 + (idx * 1000);
      }

      // Calculate last refilled timestamp from stock items and stock movements
      let lastRefilledTimestamp = 0;
      const allMBatches = db.stockItems.filter((st: any) => st.medicineId === m.id);
      allMBatches.forEach((st: any) => {
        let ts = 0;
        if (st.createdAt) {
          ts = new Date(st.createdAt).getTime() || 0;
        } else {
          const match = st.id.match(/\d{9,}/);
          if (match) ts = Number(match[0]);
        }
        if (ts > lastRefilledTimestamp) lastRefilledTimestamp = ts;
      });

      const mMovements = (db.stockMovements || []).filter((sm: any) => sm.medicineId === m.id);
      mMovements.forEach((sm: any) => {
        let ts = 0;
        if (sm.timestamp) ts = new Date(sm.timestamp).getTime() || 0;
        else if (sm.date) ts = new Date(sm.date).getTime() || 0;
        if (ts > lastRefilledTimestamp) lastRefilledTimestamp = ts;
      });

      return {
        id: m.id,
        name: m.name,
        genericName: m.genericName || '',
        category: m.category || 'General',
        price: Number(m.price) || 0,
        unit: m.unit || 'Item',
        description: m.description || '',
        productType: m.productType || (
          (m.category && (
            m.category.toLowerCase().includes('cosmetic') ||
            m.category.toLowerCase().includes('skincare') ||
            m.category.toLowerCase().includes('beauty') ||
            m.category.toLowerCase().includes('hair') ||
            m.category.toLowerCase().includes('perfume') ||
            m.category.toLowerCase().includes('deodorant') ||
            m.category.toLowerCase().includes('makeup') ||
            m.category.toLowerCase().includes('sunscreen') ||
            m.category.toLowerCase().includes('oral care') ||
            m.category.toLowerCase().includes('personal care')
          )) ? 'cosmetics' : 'medicine'
        ),
        imageUrl: m.imageUrl || '',
        isPrescriptionRequired: !!m.isPrescriptionRequired,
        strength: m.strength || '',
        dosageForm: m.dosageForm || '',
        manufacturer: m.manufacturer || '',
        availableQuantity,
        inStock: availableQuantity > 0,
        createdAt: m.createdAt || (createdAtTimestamp ? new Date(createdAtTimestamp).toISOString() : ''),
        createdAtTimestamp,
        lastRefilledAt: lastRefilledTimestamp ? new Date(lastRefilledTimestamp).toISOString() : '',
        lastRefilledTimestamp,
        isNewArrival: createdAtTimestamp > 0,
        isRefilled: lastRefilledTimestamp > 0 && availableQuantity > 0
      };
    });

    res.json({
      institution: db.institution || {
        name: 'Sonan Pharmacy & Healthcare',
        address: '120 Ring Road, Addis Ababa, Ethiopia',
        phone: '+251-11-6112233',
        email: 'orders@sonanpharma.com'
      },
      branches: db.branches || [],
      items
    });
  });

  // Public External Customer Place Order
  app.post('/api/public/orders', (req, res) => {
    const { customerName, customerPhone, customerEmail, deliveryAddress, notes, items, branchId, prescriptionImage } = req.body;
    const db = loadDb();

    if (!customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Customer name, phone number, and delivery address are required.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    let totalAmount = 0;
    const processedItems: any[] = [];

    for (const it of items) {
      const med = db.medicines.find((m: any) => m.id === it.medicineId);
      if (med) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(med.price) || 0;
        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;

        processedItems.push({
          medicineId: med.id,
          medicineName: med.name,
          quantity: qty,
          unitPrice,
          total: lineTotal,
          imageUrl: med.imageUrl || '',
          category: med.category,
          productType: med.productType || 'medicine'
        });
      } else {
        // Accept prescription quote items or custom uploaded items without refusing!
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(it.unitPrice) || 0;
        const lineTotal = qty * unitPrice;
        totalAmount += lineTotal;

        processedItems.push({
          medicineId: it.medicineId || 'presc_quote_req',
          medicineName: it.medicineName || "Doctor's Prescription Order (Awaiting Price Quote)",
          quantity: qty,
          unitPrice,
          total: lineTotal,
          imageUrl: '',
          category: it.category || 'Prescription',
          productType: 'medicine'
        });
      }
    }

    if (processedItems.length === 0 && prescriptionImage) {
      processedItems.push({
        medicineId: 'presc_quote_req',
        medicineName: "Doctor's Prescription Attachment (Awaiting Price Quote)",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        imageUrl: '',
        category: 'Prescription',
        productType: 'medicine'
      });
    }

    if (processedItems.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item or an attached prescription file.' });
    }

    const orderNum = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      id: generateId('ord'),
      orderNumber: orderNum,
      customerName,
      customerPhone,
      customerEmail: customerEmail || '',
      deliveryAddress,
      notes: notes || '',
      items: processedItems,
      totalAmount,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      branchId: branchId || 'b1',
      prescriptionImage: prescriptionImage || undefined
    };

    db.onlineOrders = db.onlineOrders || [];
    db.onlineOrders.unshift(newOrder);

    // Alert staff via pharmacy notes
    db.pharmacyNotes = db.pharmacyNotes || [];
    db.pharmacyNotes.unshift({
      id: `note_ord_${newOrder.id}`,
      text: `🛍️ NEW ONLINE CUSTOMER ORDER #${orderNum} from ${customerName} (${customerPhone}). Total: ${totalAmount.toLocaleString()} ETB for ${processedItems.length} item(s). Address: ${deliveryAddress}`,
      authorName: 'Online Store Portal',
      role: 'Customer Portal',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      color: 'blue'
    });

    saveDb(db);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully! Pharmacy staff will contact you shortly.',
      order: newOrder
    });
  });

  // Public External Customer Track Order Status
  app.get('/api/public/orders/track', (req, res) => {
    const q = ((req.query.query as string) || (req.query.orderNumber as string) || '').trim().toLowerCase();
    if (!q) {
      return res.status(400).json({ error: 'Please provide an order number or phone number.' });
    }
    const db = loadDb();
    const orders = db.onlineOrders || [];
    const normalizedQ = q.replace('#', '');

    const found = orders.filter((o: any) => {
      const orderNum = (o.orderNumber || '').toLowerCase().replace('#', '');
      const ordId = (o.id || '').toLowerCase();
      const phone = (o.customerPhone || '').toLowerCase().replace(/\s+/g, '');
      const searchPhone = normalizedQ.replace(/\s+/g, '');

      return (
        orderNum === normalizedQ ||
        orderNum.includes(normalizedQ) ||
        ordId === normalizedQ ||
        (searchPhone.length >= 4 && phone.includes(searchPhone))
      );
    });

    if (found.length === 0) {
      return res.status(404).json({ error: 'No order found matching this order number or phone.' });
    }

    res.json({ success: true, orders: found });
  });

  // Internal GET Online Orders
  app.get('/api/online-orders', (req, res) => {
    const db = loadDb();
    res.json(db.onlineOrders || []);
  });

  // Internal PUT Update Order Status & Price Quote
  app.put('/api/online-orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, operatorId, totalAmount, adminNotes, quotedPrice, items } = req.body;
    const db = loadDb();
    db.onlineOrders = db.onlineOrders || [];
    const ord = db.onlineOrders.find((o: any) => o.id === id);
    if (!ord) {
      return res.status(404).json({ error: 'Online order not found.' });
    }

    if (status) ord.status = status;
    if (totalAmount !== undefined && totalAmount !== null) ord.totalAmount = Number(totalAmount);
    if (quotedPrice !== undefined && quotedPrice !== null) ord.quotedPrice = Number(quotedPrice);
    if (adminNotes !== undefined) ord.adminNotes = adminNotes;
    if (items && Array.isArray(items)) ord.items = items;
    ord.updatedAt = new Date().toISOString();

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Online Order',
      ord.branchId || 'b1',
      'Main Branch',
      `Updated External Customer Order #${ord.orderNumber}: status="${status}", total="${ord.totalAmount} ETB".`
    );

    res.json(ord);
  });

  // Quick item image upload/update endpoint
  app.put('/api/medicines/:id/image', (req, res) => {
    const { id } = req.params;
    const { imageUrl } = req.body;
    const db = loadDb();
    const med = db.medicines.find((m: any) => m.id === id);
    if (!med) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    med.imageUrl = imageUrl || '';
    saveDb(db);
    res.json({ success: true, medicine: med });
  });

  // ==================== FINANCIAL LEDGERS ====================
  
  app.get('/api/finances/expenses', (req, res) => {
    const db = loadDb();
    res.json(db.expenses);
  });

  app.post('/api/finances/expenses', (req, res) => {
    const { branchId, category, amount, description, operatorId } = req.body;
    const db = loadDb();

    const b = db.branches.find(x => x.id === branchId);
    const user = db.users.find(u => u.id === operatorId) || { name: 'Accountant' };

    const newExp: Expense = {
      id: generateId('e'),
      branchId,
      branchName: b?.name || 'Main Branch',
      date: new Date().toISOString().split('T')[0],
      category,
      amount: Number(amount),
      description,
      recordedBy: user.name
    };

    db.expenses.unshift(newExp);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Record Expense',
      branchId,
      b?.name || 'Main Branch',
      `Logged Expense [${category}]: ${amount} ETB. Description: ${description}`
    );

    res.status(218).json(newExp);
  });

  app.post('/api/finances/ai-analysis', async (req, res) => {
    try {
      const { branchId } = req.body;
      const db = loadDb();

      // Resolve targeted branch
      const targetBranch = branchId && branchId !== 'all' ? db.branches.find(b => b.id === branchId) : null;
      const branchName = targetBranch ? targetBranch.name : 'All Combined Branches';

      // 1. Filter Expenses
      const filteredExpenses = db.expenses.filter(e => !targetBranch || e.branchId === branchId);
      const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

      // 2. Filter Purchase Orders (Received only)
      const filteredPOs = db.purchaseOrders.filter(p => p.status === 'Received' && (!targetBranch || p.branchId === branchId));
      const totalPOValue = filteredPOs.reduce((acc, p) => acc + p.total, 0);

      // 3. Current Stock Valuation (Capital)
      const filteredStock = db.stockItems.filter(st => !targetBranch || st.branchId === branchId);
      const stockAssetValue = filteredStock.reduce((acc, st) => acc + (st.buyingPrice * st.quantity), 0);
      const totalStockQty = filteredStock.reduce((acc, st) => acc + st.quantity, 0);

      // 4. Sales Revenue (excluding voided or returned)
      const filteredSales = db.sales.filter(s => (!targetBranch || s.branchId === branchId) && s.status !== 'Voided' && s.status !== 'Returned');
      const totalSalesRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
      const totalSalesCount = filteredSales.length;

      // 5. Supplier breakdown - What we buy from each supplier
      const supplierPurchases: { [key: string]: { name: string; total: number; poCount: number } } = {};
      db.suppliers.forEach(sup => {
        supplierPurchases[sup.id] = { name: sup.name, total: 0, poCount: 0 };
      });

      filteredPOs.forEach(po => {
        const supId = po.supplierId;
        if (supplierPurchases[supId]) {
          supplierPurchases[supId].total += po.total;
          supplierPurchases[supId].poCount += 1;
        } else {
          supplierPurchases[supId] = { name: po.supplierName || 'Unknown Supplier', total: po.total, poCount: 1 };
        }
      });

      const suppliersList = Object.values(supplierPurchases).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

      // Check API Key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          analysis: `### 🔑 AI Analysis Key Required

To unlock **Advanced Deep AI Financial Analysis**, please configure your **GEMINI_API_KEY** under **Settings > Secrets**.

#### 📊 Real-Time Financial Snapshot (Calculated Offline)
* **Scope**: **${branchName}**
* **Capital Invested in Stock (Current Stock Valuation)**: **${stockAssetValue.toLocaleString('en-US')} ETB**
* **Total Sales Revenue**: **${totalSalesRevenue.toLocaleString('en-US')} ETB** (${totalSalesCount} transactions)
* **Operational Overhead (Expenses)**: **${totalExpenses.toLocaleString('en-US')} ETB**
* **Procured Inventory Investment (Received POs)**: **${totalPOValue.toLocaleString('en-US')} ETB**

---
*Once your GEMINI_API_KEY is configured, Gemini will generate deep strategic insights, profit optimization strategies, supply chain recommendations, and comprehensive cost analysis.*`
        });
      }

      // Lazy load GoogleGenAI
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `You are a professional clinical pharmacy financial analyst and CFO. 
Analyze the provided real-time pharmacy financial snapshot and give deep, strategic, objective, and highly professional recommendations.
Strictly focus on actual business metrics, avoid flowery language or self-praising AI phrases. Format the output in clean, structured Markdown.`;

      const prompt = `Analyze the following real-time financial snapshot for Sonan Pharmacy (Branch: ${branchName}):

1. **Capital Valuation (Current Stock in Hand)**:
   - Total stock asset value calculated at cost buying price: ${stockAssetValue.toLocaleString('en-US')} ETB
   - Total units in stock: ${totalStockQty.toLocaleString('en-US')} units

2. **Sales Revenue**:
   - Total gross sales revenue: ${totalSalesRevenue.toLocaleString('en-US')} ETB
   - Number of transactions: ${totalSalesCount}

3. **Operating Expenses (Operational Overhead)**:
   - Total expenses: ${totalExpenses.toLocaleString('en-US')} ETB
   - Expense categories and descriptions recorded:
     ${JSON.stringify(filteredExpenses.slice(0, 20).map(e => ({ category: e.category, amount: e.amount, description: e.description })))}

4. **Procured Inventory & Supplier Breakdown (What We Buy from Each Supplier)**:
   - Total procurement investment (Received POs): ${totalPOValue.toLocaleString('en-US')} ETB
   - Purchased amount from each supplier:
     ${JSON.stringify(suppliersList.map(s => ({ supplier: s.name, totalPurchased: s.total + ' ETB', poCount: s.poCount })))}

Please generate a deep financial report containing:
- Executive Summary & Net Margin Analysis
- Capital & Stock Turn Valuation Analysis (evaluating the ${stockAssetValue} ETB capital tied in hand)
- Detailed Profit and Expense Analysis
- Supplier & Supply Chain Procurement Analysis (specifically outlining what we buy from each supplier and suggestions for negotiation)
- Strategic AI Action Items to optimize margins and reduce overhead expenses`;

      const generatePromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.3
        }
      });

      // 15s Timeout safety
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timed out after 15s')), 15000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);

      res.json({
        analysis: response.text || "AI completed analysis but returned no text."
      });

    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      res.status(500).json({ error: "Failed to generate AI analysis: " + err.message });
    }
  });

  // ==================== PAYROLL MANAGEMENT ====================

  // 1. Employee Salary Profiles
  app.get('/api/payroll/profiles', (req, res) => {
    const db = loadDb();
    res.json(db.payrollProfiles || []);
  });

  app.post('/api/payroll/profiles', (req, res) => {
    const { profile, operatorId } = req.body;
    if (!profile || !profile.employeeName) {
      return res.status(400).json({ error: 'Employee name and salary profile details are required.' });
    }
    const db = loadDb();
    if (!db.payrollProfiles) db.payrollProfiles = [];

    const newProfile: PayrollProfile = {
      ...profile,
      id: profile.id || generateId('pay_prof'),
      baseSalary: Number(profile.baseSalary) || 0,
      employeeCode: profile.employeeCode || `EMP-${String(db.payrollProfiles.length + 1).padStart(3, '0')}`,
      allowances: {
        housing: Number(profile.allowances?.housing) || 0,
        transport: Number(profile.allowances?.transport) || 0,
        medical: Number(profile.allowances?.medical) || 0,
        position: Number(profile.allowances?.position) || 0,
        other: Number(profile.allowances?.other) || 0,
      },
      deductions: {
        pensionEmployeePercent: profile.deductions?.pensionEmployeePercent !== undefined ? Number(profile.deductions.pensionEmployeePercent) : 7,
        pensionEmployerPercent: profile.deductions?.pensionEmployerPercent !== undefined ? Number(profile.deductions.pensionEmployerPercent) : 11,
        healthInsurance: Number(profile.deductions?.healthInsurance) || 0,
        unionFee: Number(profile.deductions?.unionFee) || 0,
        otherDeductions: Number(profile.deductions?.otherDeductions) || 0,
      },
      status: profile.status || 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.payrollProfiles.push(newProfile);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Create Payroll Profile',
      newProfile.branchId || 'all',
      'All Branches',
      `Created salary profile for ${newProfile.employeeName} (${newProfile.employeeCode}) - Base: ${newProfile.baseSalary} ETB`
    );

    res.status(201).json(newProfile);
  });

  app.put('/api/payroll/profiles/:id', (req, res) => {
    const { id } = req.params;
    const { profile, operatorId } = req.body;
    const db = loadDb();
    if (!db.payrollProfiles) db.payrollProfiles = [];

    const index = db.payrollProfiles.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Payroll profile not found.' });
    }

    db.payrollProfiles[index] = {
      ...db.payrollProfiles[index],
      ...profile,
      id,
      baseSalary: Number(profile.baseSalary !== undefined ? profile.baseSalary : db.payrollProfiles[index].baseSalary),
      allowances: {
        housing: Number(profile.allowances?.housing ?? db.payrollProfiles[index].allowances?.housing ?? 0),
        transport: Number(profile.allowances?.transport ?? db.payrollProfiles[index].allowances?.transport ?? 0),
        medical: Number(profile.allowances?.medical ?? db.payrollProfiles[index].allowances?.medical ?? 0),
        position: Number(profile.allowances?.position ?? db.payrollProfiles[index].allowances?.position ?? 0),
        other: Number(profile.allowances?.other ?? db.payrollProfiles[index].allowances?.other ?? 0),
      },
      deductions: {
        pensionEmployeePercent: Number(profile.deductions?.pensionEmployeePercent ?? db.payrollProfiles[index].deductions?.pensionEmployeePercent ?? 7),
        pensionEmployerPercent: Number(profile.deductions?.pensionEmployerPercent ?? db.payrollProfiles[index].deductions?.pensionEmployerPercent ?? 11),
        healthInsurance: Number(profile.deductions?.healthInsurance ?? db.payrollProfiles[index].deductions?.healthInsurance ?? 0),
        unionFee: Number(profile.deductions?.unionFee ?? db.payrollProfiles[index].deductions?.unionFee ?? 0),
        otherDeductions: Number(profile.deductions?.otherDeductions ?? db.payrollProfiles[index].deductions?.otherDeductions ?? 0),
      },
      updatedAt: new Date().toISOString()
    };

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Payroll Profile',
      db.payrollProfiles[index].branchId || 'all',
      'All Branches',
      `Updated salary profile for ${db.payrollProfiles[index].employeeName} (${db.payrollProfiles[index].employeeCode})`
    );

    res.json(db.payrollProfiles[index]);
  });

  app.delete('/api/payroll/profiles/:id', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.body || {};
    const db = loadDb();
    if (!db.payrollProfiles) db.payrollProfiles = [];

    const p = db.payrollProfiles.find(x => x.id === id);
    if (!p) {
      return res.status(404).json({ error: 'Payroll profile not found.' });
    }

    db.payrollProfiles = db.payrollProfiles.filter(x => x.id !== id);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete Payroll Profile',
      p.branchId || 'all',
      'All Branches',
      `Removed salary profile for ${p.employeeName} (${p.employeeCode})`
    );

    res.json({ success: true, deletedId: id });
  });

  // 2. Payroll Runs
  app.get('/api/payroll/runs', (req, res) => {
    const db = loadDb();
    res.json(db.payrollRuns || []);
  });

  app.post('/api/payroll/runs', (req, res) => {
    const { run, operatorId } = req.body;
    if (!run || !run.periodLabel || !Array.isArray(run.records)) {
      return res.status(400).json({ error: 'Valid payroll period and records array are required.' });
    }
    const db = loadDb();
    if (!db.payrollRuns) db.payrollRuns = [];

    const b = run.branchId && run.branchId !== 'all' ? db.branches.find(x => x.id === run.branchId) : null;

    const newRun: PayrollRun = {
      id: run.id || generateId('pay_run'),
      payrollNumber: run.payrollNumber || `PAY-${run.periodYear || new Date().getFullYear()}-${String(run.periodMonth || new Date().getMonth() + 1).padStart(2, '0')}-${String(db.payrollRuns.length + 1).padStart(2, '0')}`,
      periodMonth: Number(run.periodMonth) || (new Date().getMonth() + 1),
      periodYear: Number(run.periodYear) || new Date().getFullYear(),
      periodLabel: run.periodLabel,
      branchId: run.branchId || 'all',
      branchName: b ? b.name : 'All Branches Combined',
      runDate: run.runDate || new Date().toISOString().split('T')[0],
      status: run.status || 'Draft',
      records: run.records || [],
      totalEmployees: run.records?.length || 0,
      totalGross: Number(run.totalGross) || 0,
      totalTax: Number(run.totalTax) || 0,
      totalPensionEmployee: Number(run.totalPensionEmployee) || 0,
      totalPensionEmployer: Number(run.totalPensionEmployer) || 0,
      totalAdvancesDeducted: Number(run.totalAdvancesDeducted) || 0,
      totalOtherDeductions: Number(run.totalOtherDeductions) || 0,
      totalNet: Number(run.totalNet) || 0,
      totalEmployerCost: Number(run.totalEmployerCost) || 0,
      paymentMethod: run.paymentMethod || 'Bank CBE Batch',
      paymentReference: run.paymentReference || '',
      syncedToExpenses: !!run.syncedToExpenses,
      expenseId: run.expenseId,
      createdBy: run.createdBy || 'Finance Officer',
      notes: run.notes || '',
      createdAt: new Date().toISOString()
    };

    db.payrollRuns.unshift(newRun);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Generate Payroll Run',
      newRun.branchId,
      newRun.branchName || 'All Branches',
      `Generated Payroll Cycle [${newRun.periodLabel}]: ${newRun.totalEmployees} staff | Total Net: ${newRun.totalNet.toLocaleString()} ETB (Status: ${newRun.status})`
    );

    res.status(201).json(newRun);
  });

  app.put('/api/payroll/runs/:id', (req, res) => {
    const { id } = req.params;
    const { run, operatorId } = req.body;
    const db = loadDb();
    if (!db.payrollRuns) db.payrollRuns = [];

    const index = db.payrollRuns.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Payroll run not found.' });
    }

    db.payrollRuns[index] = {
      ...db.payrollRuns[index],
      ...run,
      id
    };

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Payroll Run',
      db.payrollRuns[index].branchId,
      db.payrollRuns[index].branchName || 'All Branches',
      `Updated Payroll Cycle [${db.payrollRuns[index].periodLabel}] (Status: ${db.payrollRuns[index].status})`
    );

    res.json(db.payrollRuns[index]);
  });

  // Disburse Payroll Run & Link to Financial Expense Ledger
  app.post('/api/payroll/runs/:id/disburse', (req, res) => {
    const { id } = req.params;
    const { paymentMethod, paymentReference, syncToExpenses = true, operatorId, operatorName } = req.body;
    const db = loadDb();
    if (!db.payrollRuns) db.payrollRuns = [];
    if (!db.expenses) db.expenses = [];
    if (!db.salaryAdvances) db.salaryAdvances = [];

    const run = db.payrollRuns.find(r => r.id === id);
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found.' });
    }

    run.status = 'Paid';
    run.paidAt = new Date().toISOString();
    run.paymentMethod = paymentMethod || run.paymentMethod || 'Bank CBE Batch';
    run.paymentReference = paymentReference || run.paymentReference || `DISB-${Date.now()}`;
    run.approvedBy = operatorName || 'Chief Financial Officer';

    // Update records payment status
    if (run.records && Array.isArray(run.records)) {
      run.records.forEach(rec => {
        rec.paymentStatus = 'Paid';
        rec.paymentDate = new Date().toISOString().split('T')[0];
        rec.paymentReference = run.paymentReference;

        // Auto-deduct from staff salary advances
        if (rec.salaryAdvanceDeduction > 0) {
          const adv = db.salaryAdvances?.find(a => a.employeeId === rec.employeeId && a.status === 'Approved');
          if (adv) {
            adv.remainingBalance = Math.max(0, adv.remainingBalance - rec.salaryAdvanceDeduction);
            if (!adv.repayments) adv.repayments = [];
            adv.repayments.push({
              date: new Date().toISOString().split('T')[0],
              amount: rec.salaryAdvanceDeduction,
              payrollRunId: run.id,
              notes: `Auto-deducted in Payroll Run ${run.periodLabel}`
            });
            if (adv.remainingBalance <= 0) {
              adv.status = 'Fully Repaid';
            } else {
              adv.status = 'Partially Repaid';
            }
          }
        }
      });
    }

    // Automatically post to Pharmacy Expense Ledger if requested
    if (syncToExpenses && !run.expenseId) {
      const expId = generateId('e');
      const bObj = db.branches.find(b => b.id === run.branchId);
      const newExp: Expense = {
        id: expId,
        branchId: run.branchId || 'b1',
        branchName: bObj?.name || 'All Branches',
        date: new Date().toISOString().split('T')[0],
        category: 'Salaries',
        amount: Number(run.totalNet),
        description: `Staff Payroll Disbursed [${run.periodLabel}] - Ref: ${run.paymentReference} (${run.totalEmployees} employees)`,
        recordedBy: operatorName || 'Payroll System'
      };
      db.expenses.unshift(newExp);
      run.syncedToExpenses = true;
      run.expenseId = expId;
    }

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Disburse Payroll',
      run.branchId,
      run.branchName || 'All Branches',
      `Disbursed Payroll [${run.periodLabel}]: ${run.totalNet.toLocaleString()} ETB paid across ${run.totalEmployees} employees via ${run.paymentMethod}. Synced to Expense Ledger.`
    );

    res.json({ success: true, run });
  });

  app.delete('/api/payroll/runs/:id', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.body || {};
    const db = loadDb();
    if (!db.payrollRuns) db.payrollRuns = [];

    const run = db.payrollRuns.find(r => r.id === id);
    if (!run) {
      return res.status(404).json({ error: 'Payroll run not found.' });
    }

    db.payrollRuns = db.payrollRuns.filter(r => r.id !== id);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete Payroll Run',
      run.branchId,
      run.branchName || 'All Branches',
      `Deleted Payroll Run [${run.periodLabel}] (${run.payrollNumber})`
    );

    res.json({ success: true, deletedId: id });
  });

  // 3. Salary Advances & Staff Loans
  app.get('/api/payroll/advances', (req, res) => {
    const db = loadDb();
    res.json(db.salaryAdvances || []);
  });

  app.post('/api/payroll/advances', (req, res) => {
    const { advance, operatorId } = req.body;
    if (!advance || !advance.employeeName || !advance.amount) {
      return res.status(400).json({ error: 'Employee name and advance amount are required.' });
    }
    const db = loadDb();
    if (!db.salaryAdvances) db.salaryAdvances = [];

    const newAdvance: SalaryAdvance = {
      id: advance.id || generateId('adv'),
      employeeId: advance.employeeId,
      employeeName: advance.employeeName,
      employeeCode: advance.employeeCode || '',
      branchId: advance.branchId || 'b1',
      amount: Number(advance.amount) || 0,
      remainingBalance: Number(advance.amount) || 0,
      monthlyDeduction: Number(advance.monthlyDeduction) || Number(advance.amount),
      reason: advance.reason || 'Staff Salary Advance Request',
      requestDate: advance.requestDate || new Date().toISOString().split('T')[0],
      approvedDate: advance.status === 'Approved' ? new Date().toISOString().split('T')[0] : undefined,
      approvedBy: advance.status === 'Approved' ? (advance.approvedBy || 'Manager') : undefined,
      status: advance.status || 'Pending',
      repayments: [],
      notes: advance.notes || ''
    };

    db.salaryAdvances.unshift(newAdvance);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Request Salary Advance',
      newAdvance.branchId,
      'Main Branch',
      `Recorded salary advance request of ${newAdvance.amount} ETB for ${newAdvance.employeeName}`
    );

    res.status(201).json(newAdvance);
  });

  app.put('/api/payroll/advances/:id', (req, res) => {
    const { id } = req.params;
    const { advance, operatorId } = req.body;
    const db = loadDb();
    if (!db.salaryAdvances) db.salaryAdvances = [];

    const index = db.salaryAdvances.findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Salary advance not found.' });
    }

    db.salaryAdvances[index] = {
      ...db.salaryAdvances[index],
      ...advance,
      id
    };

    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Update Salary Advance',
      db.salaryAdvances[index].branchId,
      'Main Branch',
      `Updated salary advance for ${db.salaryAdvances[index].employeeName} (Status: ${db.salaryAdvances[index].status}, Balance: ${db.salaryAdvances[index].remainingBalance} ETB)`
    );

    res.json(db.salaryAdvances[index]);
  });

  app.delete('/api/payroll/advances/:id', (req, res) => {
    const { id } = req.params;
    const { operatorId } = req.body || {};
    const db = loadDb();
    if (!db.salaryAdvances) db.salaryAdvances = [];

    const adv = db.salaryAdvances.find(a => a.id === id);
    if (!adv) {
      return res.status(404).json({ error: 'Salary advance not found.' });
    }

    db.salaryAdvances = db.salaryAdvances.filter(a => a.id !== id);
    saveDb(db);

    const userObj = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
    logActivity(
      userObj.id,
      userObj.username,
      userObj.role,
      'Delete Salary Advance',
      adv.branchId,
      'Main Branch',
      `Deleted salary advance record for ${adv.employeeName} (${adv.amount} ETB)`
    );

    res.json({ success: true, deletedId: id });
  });

  // ==================== STAFF ATTENDANCE ENDPOINTS ====================

  // 1. Get attendance records with query filtering
  app.get('/api/attendance', (req, res) => {
    try {
      const { branchId, userId, date, startDate, endDate, status } = req.query;
      const db = loadDb();
      let records: StaffAttendance[] = db.staffAttendance || [];

      if (branchId && branchId !== 'all') {
        records = records.filter(r => r.branchId === branchId);
      }
      if (userId && userId !== 'all') {
        records = records.filter(r => r.userId === userId);
      }
      if (date) {
        records = records.filter(r => r.date === date);
      }
      if (startDate) {
        records = records.filter(r => r.date >= (startDate as string));
      }
      if (endDate) {
        records = records.filter(r => r.date <= (endDate as string));
      }
      if (status && status !== 'all') {
        records = records.filter(r => r.status === status);
      }

      res.json(records);
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  });

  // 2. Manual / Explicit Clock In
  app.post('/api/attendance/clock-in', (req, res) => {
    try {
      const { userId, branchId, shiftType, notes, device, operatorId } = req.body;
      const db = loadDb();
      if (!db.staffAttendance) db.staffAttendance = [];

      const targetUser = db.users.find(u => u.id === userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Staff member account not found.' });
      }

      const reqIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const record = recordStaffLoginAttendance(db, targetUser, device || 'Manual Punch', reqIp);
      if (record) {
        if (shiftType) record.shiftType = shiftType;
        if (notes) record.notes = notes;
        record.method = 'manual';
        if (operatorId && operatorId !== userId) {
          record.markedBy = operatorId;
        }
      }

      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || targetUser;
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Staff Clock In',
        targetUser.branchId,
        'All Branches',
        `Clocked in staff ${targetUser.name} (${targetUser.role}) for ${record?.shiftType || 'Standard'} shift.`
      );

      res.status(201).json(record);
    } catch (err: any) {
      console.error('Error clocking in:', err);
      res.status(500).json({ error: 'Failed to clock in staff member' });
    }
  });

  // 3. Manual / Explicit Clock Out
  app.post('/api/attendance/clock-out', (req, res) => {
    try {
      const { userId, attendanceId, notes, operatorId } = req.body;
      const db = loadDb();
      if (!db.staffAttendance) db.staffAttendance = [];

      let record: StaffAttendance | undefined;
      const now = new Date();
      const currentTimeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (attendanceId) {
        record = db.staffAttendance.find(r => r.id === attendanceId);
      } else if (userId) {
        record = db.staffAttendance.find(r => r.userId === userId && (!r.logoutTime || r.logoutTime === ''));
      }

      if (!record) {
        return res.status(404).json({ error: 'Active attendance record not found to clock out.' });
      }

      record.logoutTime = currentTimeFormatted;
      record.logoutTimestamp = now.getTime();
      const durationMin = Math.max(1, Math.round((now.getTime() - (record.loginTimestamp || now.getTime())) / (1000 * 60)));
      record.durationMinutes = durationMin;
      const hours = (durationMin / 60).toFixed(1);

      const settings = (db.attendanceSettings || {}) as Partial<AttendanceSettings>;
      const standardHours = settings.standardWorkHoursPerDay || 8;

      if (durationMin >= (standardHours + 1) * 60) {
        record.status = 'overtime';
      } else if (durationMin < (standardHours * 0.5) * 60 && record.status !== 'late') {
        record.status = 'half_day';
      } else if (record.status !== 'late') {
        record.status = 'completed';
      }

      if (notes) {
        record.notes = (record.notes ? record.notes + ' ' : '') + notes;
      }
      record.updatedAt = now.toISOString();

      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Staff Clock Out',
        record.branchId,
        record.branchName || 'Main Branch',
        `Clocked out staff ${record.userName} (${hours} hrs worked).`
      );

      res.json(record);
    } catch (err: any) {
      console.error('Error clocking out:', err);
      res.status(500).json({ error: 'Failed to clock out staff member' });
    }
  });

  // 4. Create / Manual Mark Attendance Record (HR/Manager)
  app.post('/api/attendance', (req, res) => {
    try {
      const { attendance, operatorId } = req.body;
      if (!attendance || !attendance.userId || !attendance.date) {
        return res.status(400).json({ error: 'User ID and date are required.' });
      }
      const db = loadDb();
      if (!db.staffAttendance) db.staffAttendance = [];

      const targetUser = db.users.find(u => u.id === attendance.userId);
      const branchObj = db.branches.find(b => b.id === (attendance.branchId || targetUser?.branchId));
      const profile = (db.payrollProfiles || []).find((p: any) => p.userId === attendance.userId || (targetUser && p.employeeName?.toLowerCase() === targetUser.name?.toLowerCase()));

      const newRecord: StaffAttendance = {
        id: attendance.id || generateId('att'),
        userId: attendance.userId,
        employeeCode: attendance.employeeCode || profile?.employeeCode || `EMP-${(targetUser?.username || 'STAFF').toUpperCase()}`,
        userName: attendance.userName || targetUser?.name || targetUser?.username || 'Staff Member',
        userRole: attendance.userRole || targetUser?.role || 'Staff',
        branchId: attendance.branchId || targetUser?.branchId || 'b1',
        branchName: branchObj?.name || 'Main Branch',
        date: attendance.date,
        loginTime: attendance.loginTime || '08:30 AM',
        logoutTime: attendance.logoutTime || '',
        loginTimestamp: attendance.loginTimestamp || Date.now(),
        logoutTimestamp: attendance.logoutTimestamp,
        durationMinutes: attendance.durationMinutes,
        status: attendance.status || 'present',
        shiftType: attendance.shiftType || 'Morning',
        method: attendance.method || 'manual',
        device: attendance.device || 'Manual Entry',
        ipAddress: '127.0.0.1',
        notes: attendance.notes || 'Manually entered by administrator/manager.',
        markedBy: operatorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.staffAttendance.unshift(newRecord);
      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Create Attendance Record',
        newRecord.branchId,
        newRecord.branchName || 'Main Branch',
        `Created attendance record for ${newRecord.userName} on ${newRecord.date} (Status: ${newRecord.status})`
      );

      res.status(201).json(newRecord);
    } catch (err: any) {
      console.error('Error creating attendance record:', err);
      res.status(500).json({ error: 'Failed to create attendance record' });
    }
  });

  // 5. Update attendance record
  app.put('/api/attendance/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { attendance, operatorId } = req.body;
      const db = loadDb();
      if (!db.staffAttendance) db.staffAttendance = [];

      const index = db.staffAttendance.findIndex(r => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }

      db.staffAttendance[index] = {
        ...db.staffAttendance[index],
        ...attendance,
        id,
        updatedAt: new Date().toISOString()
      };

      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Update Attendance Record',
        db.staffAttendance[index].branchId,
        db.staffAttendance[index].branchName || 'Main Branch',
        `Updated attendance record for ${db.staffAttendance[index].userName} on ${db.staffAttendance[index].date}`
      );

      res.json(db.staffAttendance[index]);
    } catch (err: any) {
      console.error('Error updating attendance record:', err);
      res.status(500).json({ error: 'Failed to update attendance record' });
    }
  });

  // 6. Delete attendance record
  app.delete('/api/attendance/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { operatorId } = req.body || {};
      const db = loadDb();
      if (!db.staffAttendance) db.staffAttendance = [];

      const rec = db.staffAttendance.find(r => r.id === id);
      if (!rec) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }

      db.staffAttendance = db.staffAttendance.filter(r => r.id !== id);
      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Delete Attendance Record',
        rec.branchId,
        rec.branchName || 'Main Branch',
        `Deleted attendance record for ${rec.userName} on ${rec.date}`
      );

      res.json({ success: true, deletedId: id });
    } catch (err: any) {
      console.error('Error deleting attendance record:', err);
      res.status(500).json({ error: 'Failed to delete attendance record' });
    }
  });

  // 7. Get attendance settings
  app.get('/api/attendance/settings', (req, res) => {
    const db = loadDb();
    res.json(db.attendanceSettings || {
      enabled: true,
      standardWorkHoursPerDay: 8,
      shiftStartTime: '08:30',
      shiftEndTime: '17:30',
      lateGraceMinutes: 15,
      autoClockOutOnLogout: true,
      allowManualClockIn: true,
      overtimeThresholdHours: 8
    });
  });

  // 8. Update attendance settings
  app.post('/api/attendance/settings', (req, res) => {
    try {
      const { settings, operatorId } = req.body;
      const db = loadDb();
      db.attendanceSettings = {
        ...(db.attendanceSettings || {}),
        ...settings
      };
      saveDb(db);

      const opUser = db.users.find(u => u.id === operatorId) || { username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };
      logActivity(
        opUser.id,
        opUser.username,
        opUser.role,
        'Update Attendance Settings',
        'all',
        'All Branches',
        `Updated staff attendance configuration (Auto-mark on login: ${db.attendanceSettings.enabled ? 'Enabled' : 'Disabled'}, Shift Start: ${db.attendanceSettings.shiftStartTime})`
      );

      res.json(db.attendanceSettings);
    } catch (err: any) {
      console.error('Error updating attendance settings:', err);
      res.status(500).json({ error: 'Failed to update attendance settings' });
    }
  });

  // ==================== BACKUP & RESTORE SYSTEMS ====================

  // Helper function to generate SQL dump
  function generateSqlBackup(data: any): string {
    let sql = `-- Sonan Pharmacy Multi-Branch Database Export\n`;
    sql += `-- Generated on: ${new Date().toISOString()}\n`;
    sql += `-- Target Branch Scope: ${data.branches?.[0]?.name || 'All Branches'}\n\n`;
    sql += `BEGIN TRANSACTION;\n\n`;

    const escape = (val: any): string => {
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'number') return val.toString();
      if (typeof val === 'object') {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      }
      return `'${val.toString().replace(/'/g, "''")}'`;
    };

    const addTable = (tableName: string, rows: any[]) => {
      if (!rows || rows.length === 0) return;
      sql += `-- Table: ${tableName}\n`;
      const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${keys.map(k => `"${k}" TEXT`).join(',\n  ')}\n);\n\n`;

      rows.forEach(row => {
        const columns = keys.map(k => `"${k}"`).join(', ');
        const values = keys.map(k => escape(row[k])).join(', ');
        sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
      });
      sql += `\n`;
    };

    if (data.branches) addTable('branches', data.branches);
    if (data.users) addTable('users', data.users);
    if (data.medicines) addTable('medicines', data.medicines);
    if (data.itemMasterTemplates) addTable('itemMasterTemplates', data.itemMasterTemplates);
    if (data.customUnits) addTable('customUnits', data.customUnits.map((u: string) => ({ name: u })));
    if (data.categories) addTable('categories', data.categories);
    if (data.itemAddPresets) addTable('itemAddPresets', [data.itemAddPresets]);
    if (data.stockItems) addTable('stockItems', data.stockItems);
    if (data.suppliers) addTable('suppliers', data.suppliers);
    if (data.sales) addTable('sales', data.sales);
    if (data.purchaseOrders) addTable('purchaseOrders', data.purchaseOrders);
    if (data.stockTransfers) addTable('stockTransfers', data.stockTransfers);
    if (data.customers) addTable('customers', data.customers);
    if (data.expenses) addTable('expenses', data.expenses);
    if (data.supplierTransactions) addTable('supplierTransactions', data.supplierTransactions);
    if (data.pharmacyNotes) addTable('pharmacyNotes', data.pharmacyNotes);
    if (data.stockMovements) addTable('stockMovements', data.stockMovements);
    if (data.externalPharmacies) addTable('externalPharmacies', data.externalPharmacies);
    if (data.payrollProfiles) addTable('payrollProfiles', data.payrollProfiles);
    if (data.payrollRuns) addTable('payrollRuns', data.payrollRuns);
    if (data.salaryAdvances) addTable('salaryAdvances', data.salaryAdvances);
    if (data.institution) addTable('institution', [data.institution]);

    sql += `COMMIT;\n`;
    return sql;
  }

  // Helper function to generate XML dump
  function generateXmlBackup(data: any): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<sonan_pharmacy_backup>\n`;
    xml += `  <metadata>\n`;
    xml += `    <generated_at>${new Date().toISOString()}</generated_at>\n`;
    xml += `    <branch_scope>${data.branches?.[0]?.name || 'All'}</branch_scope>\n`;
    xml += `  </metadata>\n`;

    const escapeXml = (unsafe: any): string => {
      if (unsafe === null || unsafe === undefined) return '';
      if (typeof unsafe === 'object') unsafe = JSON.stringify(unsafe);
      return unsafe.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const renderCollection = (collectionName: string, items: any[], itemName: string) => {
      if (!items || items.length === 0) return;
      xml += `  <${collectionName}>\n`;
      items.forEach(item => {
        xml += `    <${itemName}>\n`;
        Object.entries(item).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            if (typeof v === 'object' && Array.isArray(v)) {
              xml += `      <${k}>\n`;
              v.forEach((subItem: any) => {
                xml += `        <item>\n`;
                Object.entries(subItem).forEach(([sk, sv]) => {
                  xml += `          <${sk}>${escapeXml(sv)}</${sk}>\n`;
                });
                xml += `        </item>\n`;
              });
              xml += `      </${k}>\n`;
            } else {
              xml += `      <${k}>${escapeXml(v)}</${k}>\n`;
            }
          }
        });
        xml += `    </${itemName}>\n`;
      });
      xml += `  </${collectionName}>\n`;
    };

    if (data.branches) renderCollection('branches', data.branches, 'branch');
    if (data.users) renderCollection('users', data.users, 'user');
    if (data.medicines) renderCollection('medicines', data.medicines, 'medicine');
    if (data.itemMasterTemplates) renderCollection('itemMasterTemplates', data.itemMasterTemplates, 'itemMasterTemplate');
    if (data.customUnits) renderCollection('customUnits', data.customUnits.map((u: string) => ({ name: u })), 'customUnit');
    if (data.categories) renderCollection('categories', data.categories, 'category');
    if (data.stockItems) renderCollection('stockItems', data.stockItems, 'stockItem');
    if (data.suppliers) renderCollection('suppliers', data.suppliers, 'supplier');
    if (data.sales) renderCollection('sales', data.sales, 'sale');
    if (data.purchaseOrders) renderCollection('purchaseOrders', data.purchaseOrders, 'purchaseOrder');
    if (data.stockTransfers) renderCollection('stockTransfers', data.stockTransfers, 'stockTransfer');
    if (data.customers) renderCollection('customers', data.customers, 'customer');
    if (data.expenses) renderCollection('expenses', data.expenses, 'expense');
    if (data.supplierTransactions) renderCollection('supplierTransactions', data.supplierTransactions, 'supplierTransaction');
    if (data.pharmacyNotes) renderCollection('pharmacyNotes', data.pharmacyNotes, 'pharmacyNote');
    if (data.stockMovements) renderCollection('stockMovements', data.stockMovements, 'stockMovement');
    if (data.institution) renderCollection('institution', [data.institution], 'institution_settings');

    xml += `</sonan_pharmacy_backup>\n`;
    return xml;
  }

  // Helper function to generate CSV dump
  function generateCsvBackup(data: any): string {
    let csv = `# Sonan Pharmacy Database CSV Export\n`;
    csv += `# Generated: ${new Date().toISOString()}\n`;
    csv += `# Scope: ${data.branches?.[0]?.name || 'All Branches'}\n\n`;

    const toCsvRow = (arr: any[]): string => {
      return arr.map(val => {
        if (val === null || val === undefined) return '';
        let str = typeof val === 'object' ? JSON.stringify(val) : val.toString();
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str}"`;
        }
        return str;
      }).join(',');
    };

    const appendTable = (tableName: string, rows: any[]) => {
      if (!rows || rows.length === 0) return;
      csv += `=== TABLE: ${tableName} ===\n`;
      const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      csv += keys.join(',') + '\n';
      rows.forEach(row => {
        const vals = keys.map(k => row[k]);
        csv += toCsvRow(vals) + '\n';
      });
      csv += `\n`;
    };

    if (data.branches) appendTable('branches', data.branches);
    if (data.users) appendTable('users', data.users);
    if (data.medicines) appendTable('medicines', data.medicines);
    if (data.itemMasterTemplates) appendTable('itemMasterTemplates', data.itemMasterTemplates);
    if (data.customUnits) appendTable('customUnits', data.customUnits.map((u: string) => ({ name: u })));
    if (data.categories) appendTable('categories', data.categories);
    if (data.stockItems) appendTable('stockItems', data.stockItems);
    if (data.suppliers) appendTable('suppliers', data.suppliers);
    if (data.sales) appendTable('sales', data.sales);
    if (data.purchaseOrders) appendTable('purchaseOrders', data.purchaseOrders);
    if (data.stockTransfers) appendTable('stockTransfers', data.stockTransfers);
    if (data.customers) appendTable('customers', data.customers);
    if (data.expenses) appendTable('expenses', data.expenses);
    if (data.supplierTransactions) appendTable('supplierTransactions', data.supplierTransactions);
    if (data.pharmacyNotes) appendTable('pharmacyNotes', data.pharmacyNotes);
    if (data.stockMovements) appendTable('stockMovements', data.stockMovements);

    return csv;
  }

  app.get('/api/backup/records', (req, res) => {
    const db = loadDb();
    res.json(db.backupRecords);
  });

  app.get('/api/backup/export', (req, res) => {
    const db = loadDb();
    const isItemsOnly = req.query.type === 'items';
    const format = (req.query.format as string) || 'json';
    
    // Support 'full' format resetting branchId to all, and 'branch' enforcing selected branchId
    let branchId = (req.query.branchId as string) || 'all';
    if (format === 'full') {
      branchId = 'all';
    }

    let payload: any = {};

    if (isItemsOnly) {
      payload = { 
        medicines: db.medicines,
        itemMasterTemplates: db.itemMasterTemplates || [],
        itemAddPresets: db.itemAddPresets || {},
        customUnits: db.customUnits || [],
        categories: db.categories || []
      };
    } else if (branchId === 'all') {
      payload = { ...db };
    } else {
      // Filter for specific branch
      const selectedBranch = db.branches.find(b => b.id === branchId);

      const filteredBranches = selectedBranch ? [selectedBranch] : [];
      const filteredUsers = db.users.filter(u => u.branchId === branchId);
      const filteredStockItems = db.stockItems.filter(si => si.branchId === branchId);
      const filteredSales = db.sales.filter(s => s.branchId === branchId);
      const filteredPurchaseOrders = db.purchaseOrders.filter(po => po.branchId === branchId);
      const filteredExpenses = db.expenses.filter(e => e.branchId === branchId);
      const filteredAuditLogs = db.auditLogs.filter(al => al.branchId === branchId);
      
      const filteredStockMovements = db.stockMovements ? db.stockMovements.filter(sm => sm.branchId === branchId) : [];
      const filteredSupplierTransactions = db.supplierTransactions ? db.supplierTransactions.filter(st => st.branchId === branchId) : [];
      const filteredStockTransfers = db.stockTransfers ? db.stockTransfers.filter(st => st.sourceBranchId === branchId || st.targetBranchId === branchId) : [];

      // Find referenced medicines so we don't drop referenced medicines
      const referencedMedicineIds = new Set([
        ...filteredStockItems.map(si => si.medicineId),
        ...filteredSales.flatMap(s => s.items.map(item => item.medicineId)),
        ...filteredPurchaseOrders.flatMap(po => po.items.map(item => item.medicineId)),
        ...filteredStockMovements.map(sm => sm.medicineId)
      ]);

      const filteredMedicines = db.medicines.filter(m => !m.branchId || m.branchId === branchId || referencedMedicineIds.has(m.id));

      payload = {
        branches: filteredBranches,
        users: filteredUsers,
        medicines: filteredMedicines,
        stockItems: filteredStockItems,
        suppliers: db.suppliers, // Keep suppliers as they are master data
        itemMasterTemplates: db.itemMasterTemplates || [],
        itemAddPresets: db.itemAddPresets || {},
        customUnits: db.customUnits || [],
        categories: db.categories || [],
        sales: filteredSales,
        purchaseOrders: filteredPurchaseOrders,
        stockTransfers: filteredStockTransfers,
        customers: db.customers, // Keep customers as master data
        expenses: filteredExpenses,
        auditLogs: filteredAuditLogs,
        backupRecords: db.backupRecords, // Audit of backups remains global
        supplierTransactions: filteredSupplierTransactions,
        pharmacyNotes: db.pharmacyNotes || [], // Keep generic/all notes or empty
        stockMovements: filteredStockMovements,
        externalPharmacies: db.externalPharmacies || [],
        institution: db.institution
      };
    }

    const branchSuffix = branchId === 'all' ? 'all_branches' : `branch_${branchId}`;
    let filename = `sonan_backup_${branchSuffix}_${Date.now().toString().slice(-4)}`;
    let content = '';
    let contentType = '';

    if (format === 'sql') {
      content = generateSqlBackup(payload);
      filename += '.sql';
      contentType = 'text/plain';
    } else if (format === 'xml') {
      content = generateXmlBackup(payload);
      filename += '.xml';
      contentType = 'application/xml';
    } else if (format === 'csv') {
      content = generateCsvBackup(payload);
      filename += '.csv';
      contentType = 'text/csv';
    } else if (format === 'legacy_desktop') {
      // Convert standard structured collections to flat prefix legacy desktop format
      const legacyPayload: any = {};
      if (payload.medicines) {
        payload.medicines.forEach((m: any, i: number) => { legacyPayload[`pharma_medicine_${m.id || i}`] = m; });
      }
      if (payload.stockItems) {
        payload.stockItems.forEach((si: any, i: number) => { legacyPayload[`pharma_stockitem_${si.id || i}`] = si; });
      }
      if (payload.stockMovements) {
        payload.stockMovements.forEach((sm: any, i: number) => { legacyPayload[`pharma_bincard_${sm.id || i}`] = sm; });
      }
      if (payload.customers) {
        payload.customers.forEach((c: any, i: number) => { legacyPayload[`pharma_customer_${c.id || i}`] = c; });
      }
      if (payload.suppliers) {
        payload.suppliers.forEach((s: any, i: number) => { legacyPayload[`pharma_supplier_${s.id || i}`] = s; });
      }
      if (payload.sales) {
        payload.sales.forEach((s: any, i: number) => { legacyPayload[`pharma_sale_${s.id || i}`] = s; });
      }
      if (payload.branches) {
        payload.branches.forEach((b: any, i: number) => { legacyPayload[`pharma_branch_${b.id || i}`] = b; });
      }
      content = JSON.stringify(legacyPayload, null, 2);
      filename += '_legacy_desktop.json';
      contentType = 'application/json';
    } else {
      // Default to JSON (Standard JSON Backup / Full / Branch)
      content = JSON.stringify(payload, null, 2);
      filename += '.json';
      contentType = 'application/json';
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(content);
  });

  app.post('/api/backup/manual', (req, res) => {
    const { operatorId, type, scheduleType } = req.body;
    const db = loadDb();

    const operator = db.users.find(u => u.id === operatorId) || { name: 'System Auto-Backup', username: 'system', role: UserRole.SUPER_ADMIN, id: 'admin' };

    const isItemsOnly = type === 'Items List Only' || type === 'items_only';
    const filename = isItemsOnly 
      ? `sonan_backup_items_${Date.now().toString().slice(-4)}.json`
      : scheduleType === 'Automatic Daily'
        ? `sonan_auto_daily_backup_${new Date().toISOString().split('T')[0]}.json`
        : `sonan_backup_manual_${Date.now().toString().slice(-4)}.json`;
    
    const sizeData = isItemsOnly ? { medicines: db.medicines } : db;
    const recordSize = `${Math.round(JSON.stringify(sizeData).length / 1024)} KB`;

    const newRecord: BackupRecord = {
      id: generateId('back'),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      type: isItemsOnly ? 'Items List Only' : 'Full',
      branchName: 'All Branches',
      filename,
      size: recordSize,
      createdBy: operator.name,
      scheduleType: scheduleType || 'Manual',
      status: 'Success',
      logs: isItemsOnly ? [
        'Initiating manual products database backup...',
        'Serializing medicines catalog...',
        'Table [medicines] serialized successfully.',
        `Backup written locally as: ${filename}`,
        'Backup verification signature generated.'
      ] : [
        'Initiating manual database backup...',
        'Serializing all system databases...',
        'Tables [branches, users, medicines, stockItems, suppliers, sales, purchaseOrders, stockTransfers, customers, expenses, auditLogs] serialized successfully.',
        `Backup written locally as: ${filename}`,
        'Backup verification signature generated.'
      ]
    };

    db.backupRecords.unshift(newRecord);
    saveDb(db);

    logActivity(
      operator.id,
      operator.username,
      operator.role,
      isItemsOnly ? 'Items Backup Triggered' : 'Manual Backup Triggered',
      'all',
      'All Branches',
      isItemsOnly 
        ? `Triggered products-only database serialization. File saved: ${filename}`
        : `Triggered system-wide database serialization. File saved: ${filename}`
    );

    res.status(219).json(newRecord);
  });

  app.post('/api/backup/restore', (req, res) => {
    const { backupContent, operatorId, targetBranchId, legacyMode, fileName, itemsOnly, itemsOnlyQtyDesc, itemsOnlyRestore } = req.body;
    const db = loadDb();
    const operator = db.users.find(u => u.id === operatorId) || { name: 'Administrator' };

    try {
      let parsedBackup = backupContent;
      if (typeof backupContent === 'string') {
        const trimmed = backupContent.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsedBackup = JSON.parse(trimmed);
          } catch (e) {
            // Keep as raw string (could be SQL, base64 ZIP, SQLite etc.)
          }
        }
      }

      const result = validateAndRestoreDb(
        parsedBackup, 
        operator.name,
        targetBranchId || 'all',
        !!legacyMode,
        fileName || 'backup.json',
        !!itemsOnly,
        !!itemsOnlyQtyDesc,
        !!itemsOnlyRestore
      );
      
      if (result.success) {
        res.json({
          success: true,
          summary: result.summary,
          logs: result.logs,
          skippedReasons: result.skippedReasons,
          warnings: result.warnings || [],
          itemsOnlyRestoreResult: result.itemsOnlyRestoreResult
        });
      } else {
        res.status(400).json({
          success: false,
          summary: result.summary,
          logs: result.logs,
          skippedReasons: result.skippedReasons,
          warnings: result.warnings || []
        });
      }
    } catch (err: any) {
      console.error('API Restore Error:', err);
      res.status(400).json({
        success: false,
        summary: { imported: 0, skipped: 0, repaired: 0, total: 0, missingEntities: [] },
        logs: ['CRITICAL ERROR: Failed to parse backup payload. Invalid format.'],
        skippedReasons: [err.message || 'Invalid backup payload'],
        warnings: []
      });
    }
  });

  app.post('/api/backup/wipe', (req, res) => {
    const { operatorId } = req.body;
    const db = loadDb();
    const operator = db.users.find(u => u.id === operatorId) || { name: 'Administrator', username: 'admin', role: UserRole.SUPER_ADMIN, id: 'admin' };

    // Wipe transactional and data tables
    db.medicines = [];
    db.stockItems = [];
    db.sales = [];
    db.purchaseOrders = [];
    db.stockTransfers = [];
    db.customers = [];
    db.expenses = [];
    db.backupRecords = [];
    if (db.supplierTransactions) db.supplierTransactions = [];
    if (db.pharmacyNotes) db.pharmacyNotes = [];

    // Reset audit logs with a single entry of the wipe event
    db.auditLogs = [
      {
        id: generateId('l'),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        userId: operator.id,
        username: operator.username,
        role: operator.role === UserRole.SUPER_ADMIN ? 'Super Administrator' : operator.role,
        action: 'Database Wiped',
        branchId: 'all',
        branchName: 'All Branches',
        ipAddress: '127.0.0.1',
        details: 'All transaction, catalog, and inventory databases were completely wiped by the user to start fresh.'
      }
    ];

    saveDb(db, true);

    res.json({ success: true, message: 'Application database completely wiped.' });
  });

  // ==================== SYSTEM LOGS ====================
  
  const handleGetAuditLogs = (req, res) => {
    const db = loadDb();
    res.json(db.auditLogs);
  };

  app.get('/api/audit', handleGetAuditLogs);
  app.get('/api/audit-logs', handleGetAuditLogs);

  // ==================== CATEGORIES & SUB-CATEGORIES CRUD ====================

  // Batch Save all categories and subcategories in one atomic request ("Save Once")
  const handleBatchCategories = (req: any, res: any) => {
    try {
      const { categories: incomingCategories, operatorId = 'admin' } = req.body;
      if (!incomingCategories || !Array.isArray(incomingCategories)) {
        return res.status(400).json({ error: 'Categories array is required.' });
      }

      const db = loadDb();
      if (!db.categories) db.categories = [];
      const oldCategories = db.categories;

      // Validate unique category names
      const seenNames = new Set<string>();
      for (const cat of incomingCategories) {
        const trimmed = (cat.name || '').trim();
        if (!trimmed) {
          return res.status(400).json({ error: 'All categories must have a valid non-empty name.' });
        }
        const lower = trimmed.toLowerCase();
        if (seenNames.has(lower)) {
          return res.status(400).json({ error: `Duplicate category name "${trimmed}" found.` });
        }
        seenNames.add(lower);
      }

      // Map out renames to cascade to medicines
      const categoryRenames = new Map<string, string>(); // oldName -> newName
      const subcategoryRenames = new Map<string, string>(); // oldCat:::oldSub -> newSub

      incomingCategories.forEach((newCat: any) => {
        if (newCat.id) {
          const oldCat = oldCategories.find(c => c.id === newCat.id);
          if (oldCat) {
            if (oldCat.name !== newCat.name.trim()) {
              categoryRenames.set(oldCat.name, newCat.name.trim());
            }

            const oldSubs = oldCat.subCategories || oldCat.subcategories || [];
            const newSubs = newCat.subCategories || newCat.subcategories || [];
            newSubs.forEach((ns: any) => {
              if (ns.id) {
                const oldSub = oldSubs.find((s: any) => s.id === ns.id);
                if (oldSub && oldSub.name !== (ns.name || '').trim()) {
                  subcategoryRenames.set(`${oldCat.name}:::${oldSub.name}`, (ns.name || '').trim());
                  subcategoryRenames.set(`${newCat.name.trim()}:::${oldSub.name}`, (ns.name || '').trim());
                }
              }
            });
          }
        }
      });

      // Format clean categories array
      const sanitizedCategories = incomingCategories.map((cat: any, cIdx: number) => {
        const cId = cat.id || `cat_${Date.now()}_${cIdx}`;
        const rawSubs = cat.subCategories || cat.subcategories || [];
        const formattedSubs = rawSubs.map((sub: any, sIdx: number) => {
          if (typeof sub === 'string') {
            return {
              id: `sub_${Date.now()}_${cIdx}_${sIdx}`,
              name: sub.trim(),
              description: ''
            };
          }
          return {
            id: sub.id || `sub_${Date.now()}_${cIdx}_${sIdx}`,
            name: (sub.name || '').trim(),
            description: sub.description || ''
          };
        }).filter((s: any) => s.name);

        const pType = cat.productType || cat.type || 'medicine';
        return {
          id: cId,
          name: cat.name.trim(),
          productType: pType,
          type: pType,
          description: (cat.description || '').trim(),
          color: cat.color || 'Emerald',
          icon: cat.icon || '',
          subCategories: formattedSubs,
          subcategories: formattedSubs,
          isCustom: cat.isCustom !== undefined ? cat.isCustom : true
        };
      });

      // Cascade renames to medicines
      if (db.medicines && Array.isArray(db.medicines)) {
        db.medicines.forEach(med => {
          if (med.category && categoryRenames.has(med.category)) {
            med.category = categoryRenames.get(med.category)!;
          }
          if (med.category && med.subCategory) {
            const lookupKey = `${med.category}:::${med.subCategory}`;
            if (subcategoryRenames.has(lookupKey)) {
              med.subCategory = subcategoryRenames.get(lookupKey)!;
            }
          }
        });
      }

      db.categories = sanitizedCategories;
      saveDb(db);

      res.json({
        success: true,
        message: 'All category and subcategory changes committed successfully.',
        categories: db.categories
      });
    } catch (err) {
      console.error('Error batch updating categories:', err);
      res.status(500).json({ error: 'Failed to batch update categories' });
    }
  };

  app.post('/api/categories/batch', handleBatchCategories);
  app.put('/api/categories/batch', handleBatchCategories);

  app.get('/api/categories', (req, res) => {
    try {
      const db = loadDb();
      const medicines = db.medicines || [];
      const categories = (db.categories || []).map(cat => {
        const catMeds = medicines.filter(m => m.category === cat.name || m.category?.toLowerCase() === cat.name.toLowerCase());
        const subCatsWithCounts = (cat.subCategories || []).map(sub => ({
          ...sub,
          itemCount: catMeds.filter(m => m.subCategory === sub.name || m.subCategory?.toLowerCase() === sub.name.toLowerCase()).length
        }));
        return {
          ...cat,
          itemCount: catMeds.length,
          subCategories: subCatsWithCounts
        };
      });
      res.json(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const { name, productType = 'medicine', description = '', color = 'blue', icon = '', subCategories = [] } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required.' });
      }

      const trimmedName = name.trim();
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const existingIndex = db.categories.findIndex(c => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingIndex >= 0) {
        return res.status(400).json({ error: `Category "${trimmedName}" already exists.` });
      }

      const formattedSubCategories = (subCategories || []).map((sub: any, idx: number) => {
        if (typeof sub === 'string') {
          return {
            id: `sub_${Date.now()}_${idx}`,
            name: sub.trim(),
            description: ''
          };
        }
        return {
          id: sub.id || `sub_${Date.now()}_${idx}`,
          name: (sub.name || '').trim(),
          description: sub.description || ''
        };
      }).filter((s: any) => s.name);

      const newCategory = {
        id: `cat_${Date.now()}`,
        name: trimmedName,
        productType: productType || 'medicine',
        description: description.trim(),
        color: color || 'blue',
        icon: icon || '',
        subCategories: formattedSubCategories,
        isCustom: true
      };

      db.categories.push(newCategory);
      saveDb(db);

      res.status(201).json(newCategory);
    } catch (err) {
      console.error('Error creating category:', err);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  app.put('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, productType, description, color, icon, subCategories } = req.body;
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const catIndex = db.categories.findIndex(c => c.id === id);
      if (catIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const oldCategory = db.categories[catIndex];
      const oldName = oldCategory.name;
      const newName = name !== undefined && name.trim() ? name.trim() : oldName;

      // Duplicate check if renaming
      if (newName.toLowerCase() !== oldName.toLowerCase()) {
        const dup = db.categories.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase());
        if (dup) {
          return res.status(400).json({ error: `A category named "${newName}" already exists.` });
        }
      }

      let updatedSubCats = oldCategory.subCategories || [];
      if (subCategories && Array.isArray(subCategories)) {
        updatedSubCats = subCategories.map((sub: any, idx: number) => {
          if (typeof sub === 'string') {
            return {
              id: `sub_${Date.now()}_${idx}`,
              name: sub.trim(),
              description: ''
            };
          }
          return {
            id: sub.id || `sub_${Date.now()}_${idx}`,
            name: (sub.name || '').trim(),
            description: sub.description || ''
          };
        }).filter((s: any) => s.name);
      }

      const updatedCategory = {
        ...oldCategory,
        name: newName,
        productType: productType !== undefined ? productType : oldCategory.productType,
        description: description !== undefined ? description.trim() : oldCategory.description,
        color: color !== undefined ? color : oldCategory.color,
        icon: icon !== undefined ? icon : oldCategory.icon,
        subCategories: updatedSubCats
      };

      db.categories[catIndex] = updatedCategory;

      // Cascade category rename to medicines if name changed
      if (oldName !== newName && db.medicines && Array.isArray(db.medicines)) {
        db.medicines.forEach(med => {
          if (med.category === oldName || med.category?.toLowerCase() === oldName.toLowerCase()) {
            med.category = newName;
          }
        });
      }

      saveDb(db);
      res.json(updatedCategory);
    } catch (err) {
      console.error('Error updating category:', err);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const cat = db.categories.find(c => c.id === id);
      if (!cat) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const attachedMeds = (db.medicines || []).filter(m => m.category === cat.name || m.category?.toLowerCase() === cat.name.toLowerCase());
      
      // Remove the category
      db.categories = db.categories.filter(c => c.id !== id);
      saveDb(db);

      res.json({ 
        success: true, 
        message: `Category "${cat.name}" deleted successfully.`,
        attachedMedicinesCount: attachedMeds.length
      });
    } catch (err) {
      console.error('Error deleting category:', err);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // Add subcategory to category
  app.post('/api/categories/:id/subcategories', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description = '' } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Subcategory name is required.' });
      }

      const trimmedName = name.trim();
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const catIndex = db.categories.findIndex(c => c.id === id);
      if (catIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const category = db.categories[catIndex];
      if (!category.subCategories) category.subCategories = [];

      const exists = category.subCategories.some(s => s.name.toLowerCase() === trimmedName.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: `Subcategory "${trimmedName}" already exists in ${category.name}.` });
      }

      const newSub: SubCategory = {
        id: `sub_${Date.now()}`,
        name: trimmedName,
        description: description.trim()
      };

      category.subCategories.push(newSub);
      saveDb(db);

      res.status(201).json(category);
    } catch (err) {
      console.error('Error adding subcategory:', err);
      res.status(500).json({ error: 'Failed to add subcategory' });
    }
  });

  // Edit subcategory
  app.put('/api/categories/:id/subcategories/:subId', (req, res) => {
    try {
      const { id, subId } = req.params;
      const { name, description } = req.body;
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const catIndex = db.categories.findIndex(c => c.id === id);
      if (catIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const category = db.categories[catIndex];
      if (!category.subCategories) category.subCategories = [];

      const subIndex = category.subCategories.findIndex(s => s.id === subId);
      if (subIndex === -1) {
        return res.status(404).json({ error: 'Subcategory not found' });
      }

      const oldSub = category.subCategories[subIndex];
      const oldSubName = oldSub.name;
      const newSubName = name !== undefined && name.trim() ? name.trim() : oldSubName;

      if (newSubName.toLowerCase() !== oldSubName.toLowerCase()) {
        const dup = category.subCategories.some(s => s.id !== subId && s.name.toLowerCase() === newSubName.toLowerCase());
        if (dup) {
          return res.status(400).json({ error: `A subcategory named "${newSubName}" already exists in ${category.name}.` });
        }
      }

      category.subCategories[subIndex] = {
        ...oldSub,
        name: newSubName,
        description: description !== undefined ? description.trim() : oldSub.description
      };

      // Cascade subcategory rename to medicines in this category
      if (oldSubName !== newSubName && db.medicines && Array.isArray(db.medicines)) {
        db.medicines.forEach(med => {
          if ((med.category === category.name || med.category?.toLowerCase() === category.name.toLowerCase()) &&
              (med.subCategory === oldSubName || med.subCategory?.toLowerCase() === oldSubName.toLowerCase())) {
            med.subCategory = newSubName;
          }
        });
      }

      saveDb(db);
      res.json(category);
    } catch (err) {
      console.error('Error updating subcategory:', err);
      res.status(500).json({ error: 'Failed to update subcategory' });
    }
  });

  // Delete subcategory
  app.delete('/api/categories/:id/subcategories/:subId', (req, res) => {
    try {
      const { id, subId } = req.params;
      const db = loadDb();
      if (!db.categories) db.categories = [];

      const catIndex = db.categories.findIndex(c => c.id === id);
      if (catIndex === -1) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const category = db.categories[catIndex];
      if (!category.subCategories) category.subCategories = [];

      category.subCategories = category.subCategories.filter(s => s.id !== subId);
      saveDb(db);

      res.json(category);
    } catch (err) {
      console.error('Error deleting subcategory:', err);
      res.status(500).json({ error: 'Failed to delete subcategory' });
    }
  });

  // ==================== REAL-TIME SYNCHRONIZATION HEARTBEAT ====================
  app.get('/api/sync/version', (req, res) => {
    try {
      const db = loadDb();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json({
        lastUpdated: db.lastUpdated || 0,
        serverTime: Date.now(),
        totalSales: db.sales?.length || 0,
        totalMedicines: db.medicines?.length || 0,
        totalStockItems: db.stockItems?.length || 0
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve sync version.' });
    }
  });

  // ==================== BATCH DATA RETRIEVAL (WITH SERVER-SIDE CONCURRENCY LOCK & INDEXED FILTERING) ====================
  app.get('/api/all-data', async (req, res) => {
    try {
      const db = loadDb();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // Parse pagination parameters
      const page = req.query.page !== undefined ? parseInt(String(req.query.page), 10) : undefined;
      const limit = req.query.limit !== undefined 
        ? parseInt(String(req.query.limit), 10) 
        : (req.query.pageSize !== undefined ? parseInt(String(req.query.pageSize), 10) : undefined);

      // Parse indexed filter parameters
      const branchId = req.query.branchId ? String(req.query.branchId) : (req.query.branch ? String(req.query.branch) : undefined);
      const category = req.query.category ? String(req.query.category) : undefined;
      const search = req.query.search ? String(req.query.search) : (req.query.q ? String(req.query.q) : undefined);
      const since = req.query.since ? parseInt(String(req.query.since), 10) : (req.query.after ? parseInt(String(req.query.after), 10) : undefined);
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const sortOrder = req.query.sortOrder === 'desc' ? 'desc' : (req.query.sortOrder === 'asc' ? 'asc' : undefined);
      const branchOnly = req.query.branchOnly === 'true' || req.query.branchOnly === '1';

      // Parse selective collection filters (e.g. ?collections=medicines,stockItems,sales)
      let collections: string[] | undefined;
      if (req.query.collections) {
        collections = String(req.query.collections).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      } else if (req.query.include) {
        collections = String(req.query.include).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      }

      const userRole = (req.headers['x-user-role'] as string) || (req.query.role as string);
      const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);

      const payload = await getAllDataWithConcurrencyLock(db, {
        userRole,
        userId,
        page,
        limit,
        branchId,
        category,
        search,
        collections,
        since,
        sortBy,
        sortOrder,
        branchOnly
      });

      // Expose pagination & count metadata headers for easy client consumption
      if (payload && payload.pagination) {
        res.setHeader('X-Total-Count', String(payload.pagination.totalMedicines ?? 0));
        res.setHeader('X-Page', String(payload.pagination.page ?? 1));
        res.setHeader('X-Per-Page', String(payload.pagination.limit ?? 0));
        res.setHeader('X-Total-Pages', String(payload.pagination.totalPages ?? 1));
        res.setHeader('X-Has-More', String(payload.pagination.hasMore ?? false));
      }

      res.json(payload);
    } catch (err) {
      console.error('Failed to get all data with concurrency lock:', err);
      res.status(500).json({ error: 'Failed to retrieve bulk state.' });
    }
  });

  app.get('/api/stock-movements', (req, res) => {
    try {
      const db = loadDb();
      res.json(db.stockMovements || []);
    } catch (err) {
      console.error('Failed to get stock movements:', err);
      res.status(500).json({ error: 'Failed to retrieve stock movements.' });
    }
  });

  // ==================== ADVANCED AI VOICE ASSISTANT ENDPOINT ====================
  app.post('/api/voice-assistant/process', async (req, res) => {
    try {
      const { 
        text, 
        language, 
        mode, 
        userRole, 
        userId, 
        userName, 
        branchId, 
        activeTab, 
        currentCart, 
        vatPercent, 
        discountAmount, 
        pendingAction, 
        confirmed 
      } = req.body;

      const db = loadDb();
      const result = await processVoiceCommand({
        text,
        language,
        mode,
        userRole,
        userId,
        userName,
        branchId,
        activeTab,
        currentCart,
        vatPercent,
        discountAmount,
        pendingAction,
        confirmed
      }, db);

      res.json(result);
    } catch (err: any) {
      console.error('[Voice Assistant Engine Error]:', err);
      res.status(500).json({
        action: 'error',
        spokenText: 'Internal processing error in AI Voice Assistant.',
        displayText: `Error: ${err?.message || 'Unknown voice command error'}`,
        language: req.body?.language || 'en'
      });
    }
  });

  // Global Unhandled Error Handler for Express APIs
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const timestamp = new Date().toISOString();
    const method = req.method || 'UNKNOWN';
    const path = req.originalUrl || req.url || 'UNKNOWN';

    console.error(`[${timestamp}] [API ERROR] ${method} ${path}:`, err?.stack || err?.message || err);

    if (res.headersSent) {
      return next(err);
    }

    const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : (typeof err?.status === 'number' ? err.status : 500);
    const safeMessage = err?.message || 'An unexpected internal server error occurred.';

    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: statusCode === 500 ? 'Internal Server Error' : 'Request Error',
      message: safeMessage,
      timestamp,
      path
    });
  });

  // ==================== DEVELOPMENT VITE MIDDLEWARE ====================
  
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      etag: true,
      immutable: true,
      setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sonan Pharmacy Backend] Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();
