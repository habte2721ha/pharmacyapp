import React, { useState } from 'react';
import { Pin, Trash2, Plus, X, MessageSquare, Clock, UserCheck, Send, Lock, Eye, EyeOff, ShieldAlert, Copy, Check, Key } from 'lucide-react';
import { PharmacyNote, User as UserType, UserRole } from '../types.ts';

interface PharmacyNotesProps {
  notes: PharmacyNote[];
  currentUser: UserType | null;
  users?: UserType[];
  onRefreshNotes: () => void;
}

export default function PharmacyNotes({ notes, currentUser, users = [], onRefreshNotes }: PharmacyNotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [color, setColor] = useState('amber');
  const [recipientUserId, setRecipientUserId] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'direct' | 'security'>('all');
  const [revealedOtps, setRevealedOtps] = useState<Record<string, boolean>>({});
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === UserRole.SUPER_ADMIN || String(currentUser?.role) === 'Super Administrator' || String(currentUser?.role) === 'Administrator' || String(currentUser?.role) === 'Admin';
  const userPerms = currentUser?.permissions || [];
  const hasSecurityAccess = isAdmin || userPerms.includes('security_alerts') || userPerms.includes('security') || userPerms.includes('admin');

  const securityNotesCount = hasSecurityAccess ? notes.filter(note => 
    note.authorName === 'System Security Audit' || note.text?.includes('SECURITY ALERT') || note.id?.startsWith('sec_') || note.color === 'red'
  ).length : 0;

  const directMessagesCount = notes.filter(n => n.recipientUserId && n.recipientUserId !== 'all').length;

  const filteredNotes = notes.filter(note => {
    const isSecurityAlert = note.authorName === 'System Security Audit' || note.text?.includes('SECURITY ALERT') || note.id?.startsWith('sec_') || note.color === 'red';
    
    // Security alerts are strictly visible to Administrators or users with explicit security permissions
    if (isSecurityAlert && !hasSecurityAccess) {
      return false;
    }

    if (filterMode === 'security') {
      return hasSecurityAccess && isSecurityAlert;
    }
    if (filterMode === 'direct') {
      return !isSecurityAlert && note.recipientUserId && note.recipientUserId !== 'all';
    }
    return true;
  });

  const toggleOtp = (id: string) => {
    setRevealedOtps(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedOtpId(id);
    setTimeout(() => setCopiedOtpId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (currentUser) {
        requestHeaders['X-User-Role'] = currentUser.role;
        requestHeaders['X-User-Id'] = currentUser.id;
      }

      let recipientName = 'All Users / Everyone';
      if (recipientUserId !== 'all') {
        const targetUser = users.find(u => u.id === recipientUserId);
        if (targetUser) {
          recipientName = `${targetUser.name || targetUser.username} (${targetUser.role})`;
        }
      }

      const res = await fetch('/api/pharmacy-notes', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          text: text.trim(),
          authorName: currentUser?.name || currentUser?.username || 'Anonymous',
          authorId: currentUser?.id,
          role: currentUser?.role || 'Staff',
          color,
          recipientUserId,
          recipientName
        })
      });

      if (res.ok) {
        setText('');
        setRecipientUserId('all');
        setIsAdding(false);
        onRefreshNotes();
      }
    } catch (err) {
      console.error('Failed to pin note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to resolve/remove this message?')) {
      return;
    }
    try {
      const requestHeaders: Record<string, string> = {};
      if (currentUser) {
        requestHeaders['X-User-Role'] = currentUser.role;
        requestHeaders['X-User-Id'] = currentUser.id;
      }
      const res = await fetch(`/api/pharmacy-notes/${id}`, {
        method: 'DELETE',
        headers: requestHeaders
      });
      if (res.ok) {
        onRefreshNotes();
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Color preset mapping for tailwind classes
  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200/60 dark:border-amber-900/40',
      text: 'text-amber-900 dark:text-amber-300',
      badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400'
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-200/60 dark:border-rose-900/40',
      text: 'text-rose-900 dark:text-rose-300',
      badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400'
    },
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-950/20',
      border: 'border-teal-200/60 dark:border-teal-900/40',
      text: 'text-teal-900 dark:text-teal-300',
      badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-400'
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200/60 dark:border-blue-900/40',
      text: 'text-blue-900 dark:text-blue-300',
      badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      border: 'border-purple-200/60 dark:border-purple-900/40',
      text: 'text-purple-900 dark:text-purple-300',
      badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400'
    },
    red: {
      bg: 'bg-rose-100/50 dark:bg-red-950/30',
      border: 'border-red-300 dark:border-red-900',
      text: 'text-red-950 dark:text-red-200 font-semibold',
      badge: 'bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-100'
    }
  };

  return (
    <div className="border-t border-gray-150 dark:border-slate-800 pt-5 space-y-3 font-sans">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-1.5">
          <Pin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 rotate-45 shrink-0" />
          <span className="text-[10px] font-mono uppercase font-bold text-gray-400 dark:text-gray-500 tracking-wider">
            Reminders & Messages
          </span>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
          title="Send message or add reminder"
        >
          {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span>{isAdding ? 'Close' : 'Send Message'}</span>
        </button>
      </div>

      {/* Filter Tabs if direct messages or security alerts exist */}
      <div className="flex flex-wrap gap-1 px-1">
        <button
          type="button"
          onClick={() => setFilterMode('all')}
          className={`text-[9px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${filterMode === 'all' ? 'bg-gray-200 dark:bg-slate-800 text-gray-800 dark:text-slate-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
        >
          All Notes ({notes.length})
        </button>

        {directMessagesCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterMode('direct')}
            className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${filterMode === 'direct' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'}`}
          >
            <Lock className="h-2.5 w-2.5" />
            Direct Messages ({directMessagesCount})
          </button>
        )}

        {securityNotesCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterMode('security')}
            className={`text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer ${filterMode === 'security' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300' : 'text-gray-400 hover:text-rose-600 dark:hover:text-rose-400'}`}
          >
            <ShieldAlert className="h-2.5 w-2.5 text-rose-600" />
            Security Alerts ({securityNotesCount})
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-200 dark:border-slate-850 space-y-2 mx-1 transition-all duration-300 shadow-sm">
          {/* Targeted Recipient Selector */}
          <div>
            <label className="text-[10px] font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1 mb-1">
              <UserCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>Send Message To:</span>
            </label>
            <select
              value={recipientUserId}
              onChange={(e) => setRecipientUserId(e.target.value)}
              className="w-full text-[11px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded p-1.5 outline-none font-semibold text-gray-900 dark:text-slate-100 focus:border-blue-500 cursor-pointer"
            >
              <option value="all">📢 All Users / Everyone (General Shift Note)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  👤 {u.name || u.username} — {u.role} ({u.branchId === 'all' || !u.branchId ? 'All Branches' : u.branchId})
                </option>
              ))}
            </select>
          </div>

          <textarea
            required
            maxLength={220}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={recipientUserId === 'all' ? "Type a general shift reminder..." : "Type a direct message to specific user..."}
            className="w-full text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-800 rounded p-2 outline-none text-gray-850 dark:text-slate-200 focus:border-emerald-500 placeholder-gray-400 resize-none font-sans"
          />
          <div className="text-[9px] text-gray-400 text-right font-mono pr-0.5">
            {220 - text.length} chars remaining
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setColor('amber')}
                className={`h-4 w-4 rounded-full bg-amber-400 border border-amber-500/30 transition-all cursor-pointer ${color === 'amber' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ring-amber-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                title="Amber / General"
              />
              <button
                type="button"
                onClick={() => setColor('blue')}
                className={`h-4 w-4 rounded-full bg-blue-500 border border-blue-600/30 transition-all cursor-pointer ${color === 'blue' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                title="Blue / Direct Message"
              />
              <button
                type="button"
                onClick={() => setColor('purple')}
                className={`h-4 w-4 rounded-full bg-purple-500 border border-purple-600/30 transition-all cursor-pointer ${color === 'purple' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ring-purple-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                title="Purple / Task"
              />
              <button
                type="button"
                onClick={() => setColor('rose')}
                className={`h-4 w-4 rounded-full bg-rose-400 border border-rose-500/30 transition-all cursor-pointer ${color === 'rose' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ring-rose-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                title="Rose / Urgent"
              />
              <button
                type="button"
                onClick={() => setColor('teal')}
                className={`h-4 w-4 rounded-full bg-teal-400 border border-teal-500/30 transition-all cursor-pointer ${color === 'teal' ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 ring-teal-500 scale-110' : 'opacity-70 hover:opacity-100'}`}
                title="Teal / Info"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white font-bold text-[10px] py-1 px-3 rounded shadow-sm flex items-center gap-1 transition-all cursor-pointer"
            >
              <Send className="h-3 w-3" />
              {recipientUserId === 'all' ? 'Pin Note' : 'Send Message'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2 px-1 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-slate-500 border border-dashed border-gray-200 dark:border-slate-800 rounded-lg bg-gray-50/50 dark:bg-slate-900/30">
            <MessageSquare className="h-5 w-5 mx-auto mb-1 text-gray-350 dark:text-slate-700" />
            <p className="text-[10px]">{filterMode === 'direct' ? 'No direct messages.' : 'No active reminders.'}</p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSecAlert = note.authorName === 'System Security Audit' || note.text?.includes('SECURITY ALERT') || note.id?.startsWith('sec_') || note.color === 'red';
            const styles = isSecAlert ? colorMap.red : (colorMap[note.color || 'amber'] || colorMap.amber);
            const isDirect = note.recipientUserId && note.recipientUserId !== 'all';
            const isForMe = note.recipientUserId === currentUser?.id;
            const isFromMe = note.authorId === currentUser?.id;

            // Extract OTP code if present in text
            const codeMatch = note.text?.match(/Code:\s*(\d{6})/i);
            const otpCode = codeMatch ? codeMatch[1] : null;
            const isOtpUnlocked = revealedOtps[note.id];

            return (
              <div
                key={note.id}
                className={`${styles.bg} ${styles.border} border rounded-lg p-2.5 shadow-sm space-y-2 relative group hover:shadow transition-all duration-200`}
              >
                <button
                  onClick={() => handleDelete(note.id)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity p-0.5 rounded cursor-pointer"
                  title="Remove message"
                >
                  <Trash2 className="h-3 w-3" />
                </button>

                {/* Badges */}
                {isSecAlert && (
                  <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                    <span className="bg-rose-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs uppercase tracking-wider">
                      <ShieldAlert className="h-2.5 w-2.5" /> Security Alert
                    </span>
                    {otpCode && (
                      <button
                        type="button"
                        onClick={() => toggleOtp(note.id)}
                        className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1 font-bold text-[9px] cursor-pointer shadow-xs transition-colors"
                      >
                        {isOtpUnlocked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3 text-rose-600 animate-pulse" />}
                        <span>{isOtpUnlocked ? '🔒 Hide OTP' : '👁️ See OTP Code'}</span>
                      </button>
                    )}
                  </div>
                )}

                {isDirect && !isSecAlert && (
                  <div className="flex items-center gap-1 text-[9px] font-bold">
                    {isForMe ? (
                      <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs">
                        <Lock className="h-2.5 w-2.5" /> Direct to You
                      </span>
                    ) : isFromMe ? (
                      <span className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Send className="h-2.5 w-2.5" /> Sent to: {note.recipientName}
                      </span>
                    ) : (
                      <span className="bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-200/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Targeted to: {note.recipientName}
                      </span>
                    )}
                  </div>
                )}

                <p className={`text-[11px] leading-relaxed font-sans pr-3 break-words ${styles.text}`}>
                  {isSecAlert && otpCode && !isOtpUnlocked
                    ? note.text.replace(/Code:\s*\d{6}/i, 'Code: •••••• (LOCKED - Click "See OTP Code" to view)')
                    : note.text}
                </p>

                {/* Unlocked OTP Code Box */}
                {isSecAlert && otpCode && isOtpUnlocked && (
                  <div className="bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 p-2 rounded-md flex items-center justify-between gap-2 mt-1 animate-fade-in">
                    <div className="flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                      <div>
                        <span className="text-[9px] uppercase font-bold text-amber-800 dark:text-amber-300 block">Security Alert Verification OTP</span>
                        <span className="font-mono text-sm font-black text-amber-950 dark:text-amber-200 tracking-wider block">{otpCode}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyCode(otpCode, note.id)}
                      className="bg-amber-700 hover:bg-amber-800 text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedOtpId === note.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedOtpId === note.id ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-1.5 text-[9px]">
                  <div className="leading-tight">
                    <span className="font-bold block text-gray-700 dark:text-slate-250">
                      {note.authorName}
                    </span>
                    <span className="text-gray-400 dark:text-slate-550 font-mono scale-90 origin-left block">
                      {note.role}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-gray-400 dark:text-slate-500 font-mono">
                    <Clock className="h-2.5 w-2.5 shrink-0 text-gray-350 dark:text-slate-600" />
                    <span>
                      {note.date.slice(-5)} {note.time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
