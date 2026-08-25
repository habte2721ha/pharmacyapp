import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Calendar, Users, CheckCircle2, AlertCircle, Play, Square,
  Plus, Edit, Trash2, Download, Printer, Filter, Search, RefreshCw,
  Settings, Check, X, Shield, Building, ChevronRight, UserCheck,
  Briefcase, Laptop, Smartphone, AlertTriangle, FileSpreadsheet, Timer
} from 'lucide-react';
import { Branch, User, StaffAttendance, AttendanceSettings, UserRole } from '../types.ts';

interface StaffAttendancePanelProps {
  currentUser: any;
  branches: Branch[];
  users: User[];
  onDataChanged?: () => void;
}

export default function StaffAttendancePanel({
  currentUser,
  branches,
  users,
  onDataChanged
}: StaffAttendancePanelProps) {
  const [attendanceList, setAttendanceList] = useState<StaffAttendance[]>([]);
  const [settings, setSettings] = useState<AttendanceSettings>({
    enabled: true,
    standardWorkHoursPerDay: 8,
    shiftStartTime: '08:30',
    shiftEndTime: '17:30',
    lateGraceMinutes: 15,
    autoClockOutOnLogout: true,
    allowManualClockIn: true,
    overtimeThresholdHours: 8
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string>('');
  const [actionErrorMsg, setActionErrorMsg] = useState<string>('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateRangeMode, setDateRangeMode] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Modals state
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<StaffAttendance | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [quickClockActionLoading, setQuickClockActionLoading] = useState<boolean>(false);

  // Manual Punch Form
  const [punchForm, setPunchForm] = useState<{
    userId: string;
    branchId: string;
    date: string;
    loginTime: string;
    logoutTime: string;
    status: StaffAttendance['status'];
    shiftType: StaffAttendance['shiftType'];
    notes: string;
  }>({
    userId: '',
    branchId: 'b1',
    date: new Date().toISOString().split('T')[0],
    loginTime: '08:30 AM',
    logoutTime: '',
    status: 'present',
    shiftType: 'Morning',
    notes: ''
  });

  const isAdminOrManager = useMemo(() => {
    if (!currentUser) return false;
    const role = currentUser.role || '';
    return role === UserRole.SUPER_ADMIN || role === 'Super Administrator' || role === 'Admin' || role === 'Branch Manager' || role === 'Manager';
  }, [currentUser]);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setActionErrorMsg(msg);
      setTimeout(() => setActionErrorMsg(''), 4000);
    } else {
      setActionSuccessMsg(msg);
      setTimeout(() => setActionSuccessMsg(''), 4000);
    }
  };

  // Fetch Attendance & Settings from Server
  const fetchAttendanceData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [attRes, setRes] = await Promise.all([
        fetch('/api/attendance'),
        fetch('/api/attendance/settings')
      ]);

      if (attRes.ok) {
        const attData = await attRes.json();
        setAttendanceList(Array.isArray(attData) ? attData : []);
      }
      if (setRes.ok) {
        const setData = await setRes.json();
        if (setData) setSettings(setData);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
    } finally {
      if (!silent) setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, []);

  // Check if current user is active on duty
  const currentUserActiveShift = useMemo(() => {
    if (!currentUser) return null;
    return attendanceList.find(r => r.userId === currentUser.id && (!r.logoutTime || r.logoutTime === ''));
  }, [attendanceList, currentUser]);

  // Handle Quick Clock In for logged in user
  const handleQuickClockIn = async () => {
    if (!currentUser) return;
    setQuickClockActionLoading(true);
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          branchId: currentUser.branchId || 'b1',
          operatorId: currentUser.id,
          device: 'Direct Web Punch',
          notes: 'Clocked in manually via attendance console.'
        })
      });

      if (res.ok) {
        showToast(`Clock-in recorded successfully for ${currentUser.name}!`);
        await fetchAttendanceData(true);
        if (onDataChanged) onDataChanged();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to clock in.', true);
      }
    } catch (err) {
      showToast('Network error processing clock in.', true);
    } finally {
      setQuickClockActionLoading(false);
    }
  };

  // Handle Quick Clock Out for logged in user or specific record
  const handleClockOutRecord = async (attendanceId?: string, targetUserId?: string) => {
    setQuickClockActionLoading(true);
    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId,
          userId: targetUserId || currentUser?.id,
          operatorId: currentUser?.id,
          notes: 'Shift signed off and clocked out.'
        })
      });

      if (res.ok) {
        showToast('Shift signed off and clocked out successfully!');
        await fetchAttendanceData(true);
        if (onDataChanged) onDataChanged();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to clock out.', true);
      }
    } catch (err) {
      showToast('Network error processing clock out.', true);
    } finally {
      setQuickClockActionLoading(false);
    }
  };

  // Handle Manual Save / Edit Shift
  const handleSavePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchForm.userId) {
      showToast('Please select a staff member.', true);
      return;
    }

    try {
      const targetUser = users.find(u => u.id === punchForm.userId);
      const branchObj = branches.find(b => b.id === punchForm.branchId);

      const payload = {
        userId: punchForm.userId,
        userName: targetUser?.name || targetUser?.username || 'Staff Member',
        userRole: targetUser?.role || 'Staff',
        branchId: punchForm.branchId,
        branchName: branchObj?.name || 'Main Branch',
        date: punchForm.date,
        loginTime: punchForm.loginTime,
        logoutTime: punchForm.logoutTime || '',
        status: punchForm.status,
        shiftType: punchForm.shiftType,
        method: 'manual' as const,
        notes: punchForm.notes
      };

      if (editingRecord) {
        const res = await fetch(`/api/attendance/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: payload, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast('Attendance record updated successfully.');
          setShowManualModal(false);
          setEditingRecord(null);
          await fetchAttendanceData(true);
          if (onDataChanged) onDataChanged();
        } else {
          showToast('Failed to update record.', true);
        }
      } else {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attendance: payload, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast('New attendance record added successfully.');
          setShowManualModal(false);
          await fetchAttendanceData(true);
          if (onDataChanged) onDataChanged();
        } else {
          showToast('Failed to create attendance record.', true);
        }
      }
    } catch (err) {
      showToast('Error saving attendance record.', true);
    }
  };

  // Delete Attendance Record
  const handleDeleteRecord = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the attendance log for ${name}?`)) return;
    try {
      const res = await fetch(`/api/attendance/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        showToast('Attendance record deleted.');
        await fetchAttendanceData(true);
        if (onDataChanged) onDataChanged();
      } else {
        showToast('Failed to delete record.', true);
      }
    } catch (err) {
      showToast('Network error deleting record.', true);
    }
  };

  // Save Attendance Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/attendance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, operatorId: currentUser?.id })
      });
      if (res.ok) {
        showToast('Attendance configuration updated successfully.');
        setShowSettingsModal(false);
        if (onDataChanged) onDataChanged();
      } else {
        showToast('Failed to update settings.', true);
      }
    } catch (err) {
      showToast('Error saving configuration.', true);
    }
  };

  // Filtered attendance list
  const filteredAttendance = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const d = new Date();
    const sevenDaysAgoStr = new Date(d.setDate(d.getDate() - 7)).toISOString().split('T')[0];
    const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    return attendanceList.filter(item => {
      // Date range filtering
      if (dateRangeMode === 'today' && item.date !== todayStr) return false;
      if (dateRangeMode === 'week' && item.date < sevenDaysAgoStr) return false;
      if (dateRangeMode === 'month' && item.date < monthStartStr) return false;

      // Custom date filter if specific date is picked
      if (dateFilter && dateRangeMode === 'today' && item.date !== dateFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && item.branchId !== branchFilter) return false;

      // Status filter
      if (statusFilter === 'active' && Boolean(item.logoutTime)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'active' && item.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.userName?.toLowerCase().includes(q);
        const matchesCode = item.employeeCode?.toLowerCase().includes(q);
        const matchesRole = item.userRole?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesRole && !matchesNotes) return false;
      }

      return true;
    });
  }, [attendanceList, dateRangeMode, dateFilter, branchFilter, statusFilter, searchQuery]);

  // Active staff on duty right now
  const activeDutyList = useMemo(() => {
    return attendanceList.filter(r => !r.logoutTime || r.logoutTime === '');
  }, [attendanceList]);

  // KPI Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceList.filter(r => r.date === todayStr);
    const activeCount = activeDutyList.length;
    const presentTodayCount = todayRecords.length;
    const lateTodayCount = todayRecords.filter(r => r.status === 'late').length;
    
    // Total hours in filtered view
    const totalMinutes = filteredAttendance.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    return {
      activeCount,
      presentTodayCount,
      lateTodayCount,
      totalHours
    };
  }, [attendanceList, activeDutyList, filteredAttendance]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredAttendance.length === 0) {
      showToast('No records to export.', true);
      return;
    }
    const headers = ['Date', 'Employee Name', 'Employee Code', 'Role', 'Branch', 'Clock In', 'Clock Out', 'Duration (Mins)', 'Duration (Hours)', 'Status', 'Method', 'Device', 'Notes'];
    const rows = filteredAttendance.map(r => [
      `"${r.date}"`,
      `"${r.userName || ''}"`,
      `"${r.employeeCode || ''}"`,
      `"${r.userRole || ''}"`,
      `"${r.branchName || ''}"`,
      `"${r.loginTime || ''}"`,
      `"${r.logoutTime || 'Active On Duty'}"`,
      r.durationMinutes || 0,
      ((r.durationMinutes || 0) / 60).toFixed(2),
      `"${r.status}"`,
      `"${r.method}"`,
      `"${r.device || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sonan_Staff_Attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Timesheet exported to CSV successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert / Toast Notifications */}
      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg('')} className="p-1 hover:bg-rose-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner & Live Shift Punch Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                <Clock className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Staff Attendance &amp; Timesheets
              </h2>
              {settings.enabled ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Auto-Mark on Login Active
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Auto-Mark Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300 max-w-2xl">
              Real-time check-in tracker, automated shift logging on staff sign-in and sign-out, punctuality monitoring, and compliant timesheet records.
            </p>
          </div>

          {/* User Quick Punch Console */}
          <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-4 rounded-xl border border-white/15 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">Your Shift Status</div>
              {currentUserActiveShift ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-sm font-bold text-emerald-300">
                    On Duty (Clocked in: {currentUserActiveShift.loginTime})
                  </span>
                </div>
              ) : (
                <div className="text-sm font-medium text-slate-300 mt-0.5">
                  Not clocked in currently
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentUserActiveShift ? (
                <button
                  type="button"
                  disabled={quickClockActionLoading}
                  onClick={() => handleClockOutRecord(currentUserActiveShift.id, currentUser?.id)}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Clock Out Shift</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={quickClockActionLoading}
                  onClick={handleQuickClockIn}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Clock In Now</span>
                </button>
              )}

              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  title="Configure Attendance Settings"
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">On Duty Now</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5 flex items-center gap-2">
              {stats.activeCount}
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">Present Today</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
              {stats.presentTodayCount}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">Late Arrivals Today</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.lateTodayCount}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-slate-400">Filtered Shift Hours</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
              {stats.totalHours} <span className="text-xs font-normal text-gray-500">hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time On-Duty Staff Roster */}
      {activeDutyList.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Live Active Staff on Duty ({activeDutyList.length})
              </h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Shift started upon system login
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeDutyList.map(rec => (
              <div 
                key={rec.id} 
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm shrink-0 border border-emerald-200 dark:border-emerald-700">
                    {(rec.userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      {rec.userName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      <span>{rec.userRole}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{rec.branchName || 'Main Branch'}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                      Clocked In: <span className="font-semibold text-gray-700 dark:text-slate-300">{rec.loginTime}</span> ({rec.shiftType || 'Morning'})
                    </div>
                  </div>
                </div>

                {isAdminOrManager && (
                  <button
                    type="button"
                    onClick={() => handleClockOutRecord(rec.id, rec.userId)}
                    title="Sign Off Shift for this staff"
                    className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold transition shrink-0 ml-2"
                  >
                    Clock Out
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Attendance Register Controls & Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-850 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, code, role, or notes..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Actions: Add Manual Punch, Export, Print, Refresh */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setPunchForm({
                      userId: users[0]?.id || '',
                      branchId: branches[0]?.id || 'b1',
                      date: new Date().toISOString().split('T')[0],
                      loginTime: '08:30 AM',
                      logoutTime: '05:30 PM',
                      status: 'present',
                      shiftType: 'Morning',
                      notes: 'Manual timesheet entry.'
                    });
                    setShowManualModal(true);
                  }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Manual Shift Entry</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-gray-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs font-semibold border border-gray-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSyncing(true);
                  fetchAttendanceData();
                }}
                title="Refresh Attendance Data"
                className="p-2 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg border border-gray-300 dark:border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Selectors & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Range Presets */}
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDateRangeMode('today')}
                className={`px-3 py-1 rounded-md transition ${dateRangeMode === 'today' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('week')}
                className={`px-3 py-1 rounded-md transition ${dateRangeMode === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'}`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('month')}
                className={`px-3 py-1 rounded-md transition ${dateRangeMode === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'}`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateRangeMode('all')}
                className={`px-3 py-1 rounded-md transition ${dateRangeMode === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900'}`}
              >
                All Records
              </button>
            </div>

            {/* Branch Selector */}
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Status Selector */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="py-1.5 px-3 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active On Duty (Open)</option>
              <option value="present">Present (On-Time)</option>
              <option value="late">Late Arrival</option>
              <option value="completed">Completed Shift</option>
              <option value="overtime">Overtime</option>
              <option value="half_day">Half Day</option>
            </select>

            {dateRangeMode === 'today' && (
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="py-1 px-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 font-medium"
              />
            )}
          </div>
        </div>

        {/* Attendance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100/80 dark:bg-slate-800/80 text-gray-600 dark:text-slate-400 text-xs uppercase font-bold border-b border-gray-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Date &amp; Shift</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status &amp; Method</th>
                <th className="py-3 px-4">Notes / Device</th>
                {isAdminOrManager && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-gray-800 dark:text-slate-200 font-medium">
              {filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrManager ? 9 : 8} className="py-12 text-center text-gray-400 dark:text-slate-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No attendance records match the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map(item => {
                  const isActive = !item.logoutTime || item.logoutTime === '';
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition">
                      {/* Staff Member */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {(item.userName || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {item.userName}
                              {isActive && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active on duty"></span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              {item.employeeCode || 'EMP'} • {item.userRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4 text-xs font-semibold text-gray-700 dark:text-slate-300">
                        {item.branchName || 'Main Branch'}
                      </td>

                      {/* Date & Shift */}
                      <td className="py-3 px-4">
                        <div className="text-xs font-bold text-gray-900 dark:text-white">{item.date}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">{item.shiftType || 'Morning'} Shift</div>
                      </td>

                      {/* Clock In */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {item.loginTime}
                        </span>
                      </td>

                      {/* Clock Out */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Active On Duty
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600 dark:text-rose-400 text-xs">
                            {item.logoutTime}
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 text-xs font-semibold">
                        {item.durationMinutes ? (
                          <span>
                            {(item.durationMinutes / 60).toFixed(1)} hrs
                            <span className="text-[11px] text-gray-400 dark:text-slate-500 ml-1">({item.durationMinutes}m)</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 italic">In progress...</span>
                        )}
                      </td>

                      {/* Status & Method */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {item.status === 'present' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              On-Time
                            </span>
                          )}
                          {item.status === 'late' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Late Check-In
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Completed
                            </span>
                          )}
                          {item.status === 'overtime' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Overtime
                            </span>
                          )}
                          {item.status === 'half_day' && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                              Half Day
                            </span>
                          )}

                          <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">
                            {item.method === 'auto_login' ? '⚡ Auto Login' : '✍️ Manual Punch'}
                          </span>
                        </div>
                      </td>

                      {/* Notes / Device */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-xs text-gray-600 dark:text-slate-300 truncate" title={item.notes}>
                          {item.notes || '—'}
                        </div>
                        {item.device && (
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <Laptop className="w-3 h-3 shrink-0" />
                            <span>{item.device}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      {isAdminOrManager && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isActive && (
                              <button
                                type="button"
                                onClick={() => handleClockOutRecord(item.id, item.userId)}
                                title="Clock out staff"
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecord(item);
                                setPunchForm({
                                  userId: item.userId,
                                  branchId: item.branchId,
                                  date: item.date,
                                  loginTime: item.loginTime,
                                  logoutTime: item.logoutTime || '',
                                  status: item.status,
                                  shiftType: item.shiftType || 'Morning',
                                  notes: item.notes || ''
                                });
                                setShowManualModal(true);
                              }}
                              title="Edit Attendance Entry"
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(item.id, item.userName)}
                              title="Delete Record"
                              className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Shift Entry / Edit Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <span>{editingRecord ? 'Edit Attendance Record' : 'Manual Shift Entry'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setEditingRecord(null);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePunch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Staff Member *
                </label>
                <select
                  value={punchForm.userId}
                  onChange={e => {
                    const u = users.find(x => x.id === e.target.value);
                    setPunchForm(prev => ({
                      ...prev,
                      userId: e.target.value,
                      branchId: (u?.branchId && u.branchId !== 'all') ? u.branchId : prev.branchId
                    }));
                  }}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  required
                >
                  <option value="">-- Select Staff Member --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Branch *
                  </label>
                  <select
                    value={punchForm.branchId}
                    onChange={e => setPunchForm(prev => ({ ...prev, branchId: e.target.value }))}
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Shift Date *
                  </label>
                  <input
                    type="date"
                    value={punchForm.date}
                    onChange={e => setPunchForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Clock In Time *
                  </label>
                  <input
                    type="text"
                    value={punchForm.loginTime}
                    onChange={e => setPunchForm(prev => ({ ...prev, loginTime: e.target.value }))}
                    placeholder="e.g. 08:30 AM"
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Clock Out Time (Optional)
                  </label>
                  <input
                    type="text"
                    value={punchForm.logoutTime}
                    onChange={e => setPunchForm(prev => ({ ...prev, logoutTime: e.target.value }))}
                    placeholder="e.g. 05:30 PM (leave empty if active)"
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Shift Type
                  </label>
                  <select
                    value={punchForm.shiftType}
                    onChange={e => setPunchForm(prev => ({ ...prev, shiftType: e.target.value as any }))}
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Afternoon">Afternoon Shift</option>
                    <option value="Night">Night Shift</option>
                    <option value="Full Day">Full Day Shift</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={punchForm.status}
                    onChange={e => setPunchForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    <option value="present">Present (On-Time)</option>
                    <option value="late">Late Arrival</option>
                    <option value="completed">Completed</option>
                    <option value="overtime">Overtime</option>
                    <option value="half_day">Half Day</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                  Reason / Shift Notes
                </label>
                <textarea
                  rows={2}
                  value={punchForm.notes}
                  onChange={e => setPunchForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Dispensary shift, overtime authorized by Manager..."
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-md"
                >
                  {editingRecord ? 'Save Changes' : 'Record Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <span>Attendance Tracking Settings</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Primary Toggle */}
              <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    Auto-mark Attendance on Login &amp; Logout
                  </div>
                  <div className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                    Automatically clocks in staff upon successful sign in and signs off shift upon logout.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={e => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={settings.shiftStartTime}
                    onChange={e => setSettings(prev => ({ ...prev, shiftStartTime: e.target.value }))}
                    className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Late Grace Period
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={settings.lateGraceMinutes}
                      onChange={e => setSettings(prev => ({ ...prev, lateGraceMinutes: Number(e.target.value) || 0 }))}
                      className="w-full p-2.5 pr-12 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">mins</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Standard Daily Hours
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={settings.standardWorkHoursPerDay}
                      onChange={e => setSettings(prev => ({ ...prev, standardWorkHoursPerDay: Number(e.target.value) || 8 }))}
                      className="w-full p-2.5 pr-12 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">hrs</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase mb-1">
                    Overtime Threshold
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="16"
                      value={settings.overtimeThresholdHours}
                      onChange={e => setSettings(prev => ({ ...prev, overtimeThresholdHours: Number(e.target.value) || 8 }))}
                      className="w-full p-2.5 pr-12 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-sm font-medium text-gray-900 dark:text-white"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">hrs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-md"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
