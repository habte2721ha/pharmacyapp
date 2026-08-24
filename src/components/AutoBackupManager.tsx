import { useEffect, useState } from 'react';
import { Download, CheckCircle2, X } from 'lucide-react';

interface AutoBackupManagerProps {
  currentUser?: any;
}

export function AutoBackupManager({ currentUser }: AutoBackupManagerProps) {
  const [notification, setNotification] = useState<{ show: boolean; date: string; format: string } | null>(null);

  useEffect(() => {
    const checkAndRunAutoBackup = async () => {
      try {
        const enabled = localStorage.getItem('sonan_auto_daily_backup_enabled') === 'true';
        if (!enabled) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem('sonan_auto_daily_backup_last_date');

        // Check if backup was already downloaded today
        if (lastDate === todayStr) return;

        const schedule = localStorage.getItem('sonan_auto_daily_backup_schedule') || 'on_launch';
        const now = new Date();
        const currentHours = now.getHours();

        // If schedule is 'at_1800' (6:00 PM), wait until 18:00 or later
        if (schedule === 'at_1800' && currentHours < 18) {
          return;
        }

        // Mark as backed up immediately to prevent duplicate requests
        localStorage.setItem('sonan_auto_daily_backup_last_date', todayStr);
        const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);
        localStorage.setItem('sonan_auto_daily_backup_last_time', timeStr);

        const format = localStorage.getItem('sonan_auto_daily_backup_format') || 'json';
        const branch = localStorage.getItem('sonan_auto_daily_backup_branch') || 'all';

        // 1. Log auto-backup on server
        await fetch('/api/backup/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operatorId: currentUser?.id || 'admin',
            type: 'Full',
            scheduleType: 'Automatic Daily'
          })
        });

        // 2. Trigger browser download
        const ext = format === 'sql' ? 'sql' : format === 'csv' ? 'csv' : format === 'xml' ? 'xml' : 'json';
        const downloadUrl = `/api/backup/export?branchId=${branch}&format=${format}`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `sonan_auto_daily_backup_${todayStr}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 3. Show toast notification to user
        setNotification({
          show: true,
          date: todayStr,
          format: format.toUpperCase()
        });

        // Auto hide notification after 10 seconds
        setTimeout(() => {
          setNotification(null);
        }, 10000);

      } catch (err) {
        console.error('Auto Backup Manager error:', err);
      }
    };

    // Run check on initial load
    checkAndRunAutoBackup();

    // Re-check every 5 minutes in case browser stays open until scheduled time
    const interval = setInterval(checkAndRunAutoBackup, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (!notification || !notification.show) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 animate-slide-up flex items-start gap-3">
      <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 shrink-0">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <div className="flex-1 text-xs">
        <div className="font-extrabold text-sm text-emerald-400 flex items-center justify-between">
          <span>Automatic Daily Backup Saved</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-slate-300">
          The daily database backup for <strong>{notification.date}</strong> was automatically downloaded in <strong>{notification.format}</strong> format.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <Download className="h-3 w-3 text-emerald-400" />
          <span>Saved to your browser Downloads folder</span>
        </div>
      </div>
    </div>
  );
}
