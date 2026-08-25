import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, DollarSign, Calculator, Calendar, FileText, Plus, CheckCircle2, 
  Trash2, Edit, Download, Printer, ArrowRight, ShieldCheck, AlertCircle, 
  CreditCard, Search, RefreshCw, X, Building, Check, Clock, TrendingUp,
  Receipt, UserPlus, FileSpreadsheet, Eye, ChevronRight, HelpCircle
} from 'lucide-react';
import { 
  Branch, User, PayrollProfile, PayrollRun, PayrollRecord, SalaryAdvance 
} from '../types.ts';
import StaffAttendancePanel from './StaffAttendancePanel.tsx';

// Ethiopian Statutory Tax Calculation Engine (Ministry of Revenues / ERCA standard schedule)
export const calculateIncomeTax = (taxableIncome: number): number => {
  if (taxableIncome <= 600) return 0;
  if (taxableIncome <= 1650) return Math.max(0, taxableIncome * 0.10 - 60);
  if (taxableIncome <= 3200) return Math.max(0, taxableIncome * 0.15 - 142.5);
  if (taxableIncome <= 5250) return Math.max(0, taxableIncome * 0.20 - 302.5);
  if (taxableIncome <= 7800) return Math.max(0, taxableIncome * 0.25 - 565);
  if (taxableIncome <= 10900) return Math.max(0, taxableIncome * 0.30 - 955);
  return Math.max(0, taxableIncome * 0.35 - 1500);
};

// Helper for number formatting
const formatCurrency = (val: number | undefined): string => {
  return (val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface PayrollManagerPanelProps {
  currentUser: any;
  branches: Branch[];
  users: User[];
  onDataChanged?: () => void;
}

export default function PayrollManagerPanel({
  currentUser,
  branches,
  users,
  onDataChanged
}: PayrollManagerPanelProps) {
  const [activeTab, setActiveTab] = useState<'runs' | 'profiles' | 'advances' | 'reports' | 'attendance'>('runs');
  const [loading, setLoading] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [instDetails, setInstDetails] = useState<any>({
    name: 'Sonan Pharmacy',
    address: 'Addis Ababa, Ethiopia',
    phone: '+251-11-6112233',
    tinNumber: '0012938475'
  });

  // Modals state
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<PayrollProfile | null>(null);
  const [showNewRunModal, setShowNewRunModal] = useState<boolean>(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<boolean>(false);
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvance | null>(null);
  const [viewingRun, setViewingRun] = useState<PayrollRun | null>(null);
  const [viewingPayslip, setViewingPayslip] = useState<{ record: PayrollRecord; run: PayrollRun } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');

  // Fetch all payroll data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [profRes, runRes, advRes, instRes] = await Promise.all([
        fetch('/api/payroll/profiles'),
        fetch('/api/payroll/runs'),
        fetch('/api/payroll/advances'),
        fetch('/api/settings/institution')
      ]);

      if (profRes.ok) {
        const profData = await profRes.json();
        setProfiles(Array.isArray(profData) ? profData : []);
      }
      if (runRes.ok) {
        const runData = await runRes.json();
        setRuns(Array.isArray(runData) ? runData : []);
      }
      if (advRes.ok) {
        const advData = await advRes.json();
        setAdvances(Array.isArray(advData) ? advData : []);
      }
      if (instRes.ok) {
        const instData = await instRes.json();
        if (instData) setInstDetails(instData);
      }
    } catch (err) {
      console.error('Error fetching payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  // ==================== PROFILE MANAGEMENT ====================
  const [profileForm, setProfileForm] = useState<Partial<PayrollProfile>>({
    employeeName: '',
    employeeCode: '',
    role: 'Pharmacist',
    branchId: 'b1',
    employmentType: 'Full-time',
    hireDate: new Date().toISOString().split('T')[0],
    phone: '',
    email: '',
    tinNumber: '',
    pensionNumber: '',
    bankName: 'Commercial Bank of Ethiopia (CBE)',
    accountNumber: '',
    baseSalary: 15000,
    allowances: { housing: 0, transport: 0, medical: 0, position: 0, other: 0 },
    deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
    status: 'Active'
  });

  const openNewProfileModal = () => {
    setEditingProfile(null);
    setProfileForm({
      employeeName: '',
      employeeCode: `EMP-${String(profiles.length + 1).padStart(3, '0')}`,
      role: 'Pharmacist',
      branchId: branches[0]?.id || 'b1',
      employmentType: 'Full-time',
      hireDate: new Date().toISOString().split('T')[0],
      phone: '',
      email: '',
      tinNumber: '',
      pensionNumber: '',
      bankName: 'Commercial Bank of Ethiopia (CBE)',
      accountNumber: '',
      baseSalary: 15000,
      allowances: { housing: 0, transport: 0, medical: 0, position: 0, other: 0 },
      deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
      status: 'Active'
    });
    setShowProfileModal(true);
  };

  const openEditProfileModal = (prof: PayrollProfile) => {
    setEditingProfile(prof);
    setProfileForm({
      ...prof,
      allowances: { ...prof.allowances },
      deductions: { ...prof.deductions }
    });
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.employeeName || !profileForm.baseSalary) {
      alert('Please provide staff name and base salary.');
      return;
    }

    try {
      if (editingProfile) {
        const res = await fetch(`/api/payroll/profiles/${editingProfile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: profileForm, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast(`Updated payroll profile for ${profileForm.employeeName}`);
          setShowProfileModal(false);
          fetchData();
          onDataChanged?.();
        }
      } else {
        const res = await fetch('/api/payroll/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: profileForm, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast(`Created payroll profile for ${profileForm.employeeName}`);
          setShowProfileModal(false);
          fetchData();
          onDataChanged?.();
        }
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove payroll profile for "${name}"?`)) return;
    try {
      const res = await fetch(`/api/payroll/profiles/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        showToast(`Profile removed for ${name}`);
        fetchData();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Error deleting profile:', err);
    }
  };

  // Import from existing App Users
  const handleImportFromUsers = async () => {
    const existingNames = new Set(profiles.map(p => p.employeeName.toLowerCase()));
    const unimportedUsers = users.filter(u => !existingNames.has(u.name.toLowerCase()) && u.isActive !== false);

    if (unimportedUsers.length === 0) {
      alert('All active system users are already registered in the Payroll Employee Master.');
      return;
    }

    let addedCount = 0;
    for (const u of unimportedUsers) {
      const newProf: Partial<PayrollProfile> = {
        userId: u.id,
        employeeName: u.name,
        employeeCode: `EMP-${String(profiles.length + addedCount + 1).padStart(3, '0')}`,
        role: u.role || 'Staff',
        branchId: u.branchId || 'b1',
        employmentType: 'Full-time',
        hireDate: new Date().toISOString().split('T')[0],
        email: u.email || '',
        phone: u.phone || '',
        tinNumber: '',
        pensionNumber: '',
        bankName: 'Commercial Bank of Ethiopia (CBE)',
        accountNumber: '',
        baseSalary: u.role === 'Super Administrator' ? 35000 : u.role === 'Pharmacist' ? 24000 : 16000,
        allowances: { housing: 1500, transport: 1000, medical: 500, position: 0, other: 0 },
        deductions: { pensionEmployeePercent: 7, pensionEmployerPercent: 11, healthInsurance: 0, unionFee: 0, otherDeductions: 0 },
        status: 'Active'
      };

      await fetch('/api/payroll/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: newProf, operatorId: currentUser?.id })
      });
      addedCount++;
    }

    showToast(`Successfully imported ${addedCount} user(s) into Payroll Master!`);
    fetchData();
    onDataChanged?.();
  };

  // ==================== NEW PAYROLL RUN BUILDER ====================
  const currentDate = new Date();
  const [runMonth, setRunMonth] = useState<number>(currentDate.getMonth() + 1);
  const [runYear, setRunYear] = useState<number>(currentDate.getFullYear());
  const [runBranchId, setRunBranchId] = useState<string>('all');
  const [runNotes, setRunNotes] = useState<string>('');
  const [runRecords, setRunRecords] = useState<PayrollRecord[]>([]);

  // Generate draft records based on active profiles and salary advances
  const initializeNewRunRecords = () => {
    const targetProfiles = profiles.filter(p => {
      if (p.status !== 'Active') return false;
      if (runBranchId !== 'all' && p.branchId !== 'all' && p.branchId !== runBranchId) return false;
      return true;
    });

    const activeAdvances = advances.filter(a => a.status === 'Approved' && a.remainingBalance > 0);

    const generated: PayrollRecord[] = targetProfiles.map(prof => {
      const totalAllowances = Object.values(prof.allowances || {}).reduce((a, b) => a + Number(b || 0), 0);
      const grossSalary = prof.baseSalary + totalAllowances;
      
      // Pension
      const pensionEmployee = Math.round((prof.baseSalary * (prof.deductions?.pensionEmployeePercent || 7)) / 100);
      const pensionEmployer = Math.round((prof.baseSalary * (prof.deductions?.pensionEmployerPercent || 11)) / 100);

      // Taxable income (Gross minus non-taxable portions if any, base + allowances)
      const taxableIncome = grossSalary;
      const incomeTax = Math.round(calculateIncomeTax(taxableIncome));

      // Advance deduction check
      const staffAdv = activeAdvances.find(a => a.employeeId === prof.id);
      const advanceDeduction = staffAdv ? Math.min(staffAdv.remainingBalance, staffAdv.monthlyDeduction || staffAdv.remainingBalance) : 0;

      // Other deductions
      const otherDed = (prof.deductions?.healthInsurance || 0) + (prof.deductions?.unionFee || 0) + (prof.deductions?.otherDeductions || 0);

      const totalDeductions = incomeTax + pensionEmployee + advanceDeduction + otherDed;
      const netSalary = grossSalary - totalDeductions;
      const employerCost = grossSalary + pensionEmployer;

      return {
        id: `rec_${prof.id}_${Date.now()}`,
        employeeId: prof.id,
        employeeName: prof.employeeName,
        employeeCode: prof.employeeCode,
        role: prof.role,
        branchId: prof.branchId,
        bankName: prof.bankName,
        accountNumber: prof.accountNumber,
        baseSalary: prof.baseSalary,
        allowances: { ...prof.allowances },
        totalAllowances,
        overtimeHours: 0,
        overtimeRate: 0,
        overtimePay: 0,
        bonuses: 0,
        commissions: 0,
        grossSalary,
        taxableIncome,
        incomeTax,
        pensionEmployee,
        pensionEmployer,
        salaryAdvanceDeduction: advanceDeduction,
        otherDeductions: otherDed,
        totalDeductions,
        netSalary,
        employerTotalCost: employerCost,
        paymentStatus: 'Pending'
      };
    });

    setRunRecords(generated);
  };

  const openNewRunModal = () => {
    setRunMonth(currentDate.getMonth() + 1);
    setRunYear(currentDate.getFullYear());
    setRunBranchId('all');
    setRunNotes('');
    initializeNewRunRecords();
    setShowNewRunModal(true);
  };

  useEffect(() => {
    if (showNewRunModal) {
      initializeNewRunRecords();
    }
  }, [runBranchId, profiles, advances]);

  // Record item inline modification in draft modal
  const updateDraftRecord = (recId: string, field: string, val: any) => {
    setRunRecords(prev => prev.map(rec => {
      if (rec.id !== recId) return rec;

      const numVal = Number(val) || 0;
      const updated: any = { ...rec, [field]: numVal };

      // Recalculate overtime pay
      if (field === 'overtimeHours' || field === 'overtimeRate') {
        const hours = Number(updated.overtimeHours) || 0;
        const rate = Number(updated.overtimeRate) || 0;
        updated.overtimePay = Math.round(hours * rate);
      }

      // Recalculate gross
      let allowancesTotal = 0;
      if (updated.allowances && typeof updated.allowances === 'object') {
        const vals = Object.values(updated.allowances) as any[];
        allowancesTotal = vals.reduce((sum: number, val: any): number => sum + (Number(val) || 0), 0);
      }
      updated.totalAllowances = allowancesTotal;
      const baseSal = Number(updated.baseSalary) || 0;
      const overtime = Number(updated.overtimePay) || 0;
      const bonus = Number(updated.bonuses || updated.bonus) || 0;
      const commission = Number(updated.commissions || updated.commission) || 0;
      updated.grossSalary = baseSal + allowancesTotal + overtime + bonus + commission;

      // Recalculate taxes
      updated.taxableIncome = updated.grossSalary;
      updated.incomeTax = Math.round(calculateIncomeTax(updated.taxableIncome));

      // Recalculate deductions & net
      const adv = Number(updated.salaryAdvanceDeduction) || 0;
      const other = Number(updated.otherDeductions) || 0;
      const pensionEmp = Number(updated.pensionEmployee) || 0;
      const pensionEmplr = Number(updated.pensionEmployer) || 0;
      updated.totalDeductions = updated.incomeTax + pensionEmp + adv + other;
      updated.netSalary = updated.grossSalary - updated.totalDeductions;
      updated.totalEmployerCost = updated.grossSalary + pensionEmplr;
      updated.employerTotalCost = updated.totalEmployerCost;

      return updated as PayrollRecord;
    }));
  };

  // Run totals
  const runSummary = useMemo(() => {
    return runRecords.reduce((acc, r) => ({
      totalGross: acc.totalGross + (r.grossSalary || 0),
      totalTax: acc.totalTax + (r.incomeTax || 0),
      totalPensionEmployee: acc.totalPensionEmployee + (r.pensionEmployee || 0),
      totalPensionEmployer: acc.totalPensionEmployer + (r.pensionEmployer || 0),
      totalAdvances: acc.totalAdvances + (r.salaryAdvanceDeduction || 0),
      totalOtherDeductions: acc.totalOtherDeductions + (r.otherDeductions || 0),
      totalNet: acc.totalNet + (r.netSalary || 0),
      totalEmployerCost: acc.totalEmployerCost + (r.totalEmployerCost || r.employerTotalCost || 0)
    }), {
      totalGross: 0,
      totalTax: 0,
      totalPensionEmployee: 0,
      totalPensionEmployer: 0,
      totalAdvances: 0,
      totalOtherDeductions: 0,
      totalNet: 0,
      totalEmployerCost: 0
    });
  }, [runRecords]);

  const handleSaveRun = async (status: 'Draft' | 'Approved') => {
    if (runRecords.length === 0) {
      alert('No employee records found for this payroll run.');
      return;
    }

    const b = branches.find(x => x.id === runBranchId);
    const periodLabel = `${MONTHS[runMonth - 1]} ${runYear}`;

    const newRunPayload: Partial<PayrollRun> = {
      periodMonth: runMonth,
      periodYear: runYear,
      periodLabel,
      branchId: runBranchId,
      branchName: b ? b.name : 'All Branches Combined',
      runDate: new Date().toISOString().split('T')[0],
      status,
      records: runRecords,
      totalEmployees: runRecords.length,
      totalGross: runSummary.totalGross,
      totalTax: runSummary.totalTax,
      totalPensionEmployee: runSummary.totalPensionEmployee,
      totalPensionEmployer: runSummary.totalPensionEmployer,
      totalAdvancesDeducted: runSummary.totalAdvances,
      totalOtherDeductions: runSummary.totalOtherDeductions,
      totalNet: runSummary.totalNet,
      totalEmployerCost: runSummary.totalEmployerCost,
      paymentMethod: 'Bank CBE Batch',
      createdBy: currentUser?.name || 'Chief Accountant',
      notes: runNotes
    };

    try {
      const res = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: newRunPayload, operatorId: currentUser?.id })
      });

      if (res.ok) {
        showToast(`Payroll Cycle [${periodLabel}] created successfully (${status})!`);
        setShowNewRunModal(false);
        fetchData();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Error saving payroll run:', err);
    }
  };

  // Disburse / Pay Payroll Run
  const handleDisburseRun = async (run: PayrollRun) => {
    if (!window.confirm(`Disburse ${formatCurrency(run.totalNet)} ETB for ${run.periodLabel} (${run.totalEmployees} employees)?\n\nThis will mark the payroll cycle as PAID, deduct staff salary advances, and post an automated record to the Pharmacy Expenses Ledger under "Salaries".`)) {
      return;
    }

    try {
      const res = await fetch(`/api/payroll/runs/${run.id}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'Bank CBE Batch',
          syncToExpenses: true,
          operatorId: currentUser?.id,
          operatorName: currentUser?.name
        })
      });

      if (res.ok) {
        showToast(`Disbursed payroll for ${run.periodLabel} & synced to Expense Ledger!`);
        fetchData();
        onDataChanged?.();
        if (viewingRun?.id === run.id) {
          setViewingRun(null);
        }
      }
    } catch (err) {
      console.error('Error disbursing payroll run:', err);
    }
  };

  const handleDeleteRun = async (run: PayrollRun) => {
    if (!window.confirm(`Are you sure you want to delete payroll run "${run.periodLabel}" (${run.payrollNumber})?`)) return;
    try {
      const res = await fetch(`/api/payroll/runs/${run.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        showToast(`Deleted payroll run ${run.periodLabel}`);
        if (viewingRun?.id === run.id) setViewingRun(null);
        fetchData();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Error deleting payroll run:', err);
    }
  };

  // ==================== SALARY ADVANCES ====================
  const [advanceForm, setAdvanceForm] = useState<Partial<SalaryAdvance>>({
    employeeId: '',
    employeeName: '',
    employeeCode: '',
    branchId: 'b1',
    amount: 3000,
    monthlyDeduction: 1500,
    reason: '',
    requestDate: new Date().toISOString().split('T')[0],
    status: 'Approved'
  });

  const openNewAdvanceModal = () => {
    setEditingAdvance(null);
    const firstProf = profiles[0];
    setAdvanceForm({
      employeeId: firstProf?.id || '',
      employeeName: firstProf?.employeeName || '',
      employeeCode: firstProf?.employeeCode || '',
      branchId: firstProf?.branchId || 'b1',
      amount: 3000,
      monthlyDeduction: 1500,
      reason: 'Urgent family medical expense',
      requestDate: new Date().toISOString().split('T')[0],
      status: 'Approved'
    });
    setShowAdvanceModal(true);
  };

  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.employeeId || !advanceForm.amount) {
      alert('Please select an employee and specify advance amount.');
      return;
    }

    try {
      if (editingAdvance) {
        const res = await fetch(`/api/payroll/advances/${editingAdvance.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advance: advanceForm, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast(`Updated salary advance for ${advanceForm.employeeName}`);
          setShowAdvanceModal(false);
          fetchData();
          onDataChanged?.();
        }
      } else {
        const res = await fetch('/api/payroll/advances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advance: advanceForm, operatorId: currentUser?.id })
        });
        if (res.ok) {
          showToast(`Issued advance of ${formatCurrency(Number(advanceForm.amount))} ETB to ${advanceForm.employeeName}`);
          setShowAdvanceModal(false);
          fetchData();
          onDataChanged?.();
        }
      }
    } catch (err) {
      console.error('Error saving advance:', err);
    }
  };

  const handleDeleteAdvance = async (id: string, name: string) => {
    if (!window.confirm(`Delete salary advance for ${name}?`)) return;
    try {
      const res = await fetch(`/api/payroll/advances/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUser?.id })
      });
      if (res.ok) {
        showToast(`Advance record deleted for ${name}`);
        fetchData();
        onDataChanged?.();
      }
    } catch (err) {
      console.error('Error deleting advance:', err);
    }
  };

  // Export payroll run table to CSV
  const exportRunToCSV = (run: PayrollRun) => {
    const headers = [
      'Emp Code', 'Employee Name', 'Role', 'Bank Name', 'Account Number',
      'Base Salary (ETB)', 'Allowances', 'Overtime Pay', 'Bonus', 'Gross Salary',
      'Income Tax (ERCA)', 'Employee Pension 7%', 'Employer Pension 11%',
      'Advance Deducted', 'Other Deductions', 'Net Pay (ETB)', 'Payment Status'
    ];

    const rows = run.records.map(r => [
      `"${r.employeeCode}"`,
      `"${r.employeeName}"`,
      `"${r.role}"`,
      `"${r.bankName || ''}"`,
      `"${r.accountNumber || ''}"`,
      r.baseSalary,
      r.totalAllowances,
      r.overtimePay || 0,
      r.bonuses || 0,
      r.grossSalary,
      r.incomeTax,
      r.pensionEmployee,
      r.pensionEmployer,
      r.salaryAdvanceDeduction || 0,
      r.otherDeductions || 0,
      r.netSalary,
      `"${r.paymentStatus}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payroll_${run.periodLabel.replace(/\s+/g, '_')}_${run.payrollNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bank CBE Transfer Text File Export
  const exportBankTransferFormat = (run: PayrollRun) => {
    const lines = [
      `# COMMERCIAL BANK OF ETHIOPIA - CORPORATE SALARY BATCH DISBURSEMENT`,
      `# Company: ${instDetails.name} (TIN: ${instDetails.tinNumber || 'N/A'})`,
      `# Payroll Cycle: ${run.periodLabel} | Total Net: ${run.totalNet} ETB`,
      `# Date: ${run.runDate}`,
      `# -------------------------------------------------------------`,
      `# AccountNumber,BeneficiaryName,AmountETB,Reference`,
      ...run.records.map(r => `${r.accountNumber || 'CBE-0000000000'},"${r.employeeName}",${r.netSalary},"SALARY ${run.periodLabel}"`)
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CBE_Salary_Batch_${run.periodLabel.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered lists
  const filteredProfiles = profiles.filter(p => {
    const matchSearch = p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        p.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBranch = branchFilter === 'all' || p.branchId === 'all' || p.branchId === branchFilter;
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchBranch && matchStatus;
  });

  const filteredRuns = runs.filter(r => {
    const matchSearch = r.periodLabel.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        r.payrollNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBranch = branchFilter === 'all' || r.branchId === 'all' || r.branchId === branchFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchBranch && matchStatus;
  });

  const filteredAdvances = advances.filter(a => {
    const matchSearch = a.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        a.reason.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBranch = branchFilter === 'all' || a.branchId === branchFilter;
    return matchSearch && matchBranch;
  });

  // Top level stats
  const totalMonthlyBasePayroll = profiles.filter(p => p.status === 'Active').reduce((acc, p) => acc + p.baseSalary, 0);
  const totalActiveStaff = profiles.filter(p => p.status === 'Active').length;
  const totalOutstandingAdvances = advances.filter(a => a.status === 'Approved').reduce((acc, a) => acc + a.remainingBalance, 0);

  return (
    <div id="payroll-manager-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {actionSuccessMessage && (
        <div id="payroll-toast-alert" className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-medium text-sm">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div id="payroll-header-banner" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Pharmacy Payroll & Compensation Engine
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Staff salary structures, Ethiopian statutory income tax, pension calculations, CBE bank batches, and expense automation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            id="btn-new-pay-run"
            onClick={openNewRunModal}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Run New Payroll Cycle
          </button>
          <button
            id="btn-new-salary-profile"
            onClick={openNewProfileModal}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Staff Profile
          </button>
          <button
            id="btn-payroll-refresh"
            onClick={fetchData}
            title="Refresh Payroll Database"
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Bento Grid */}
      <div id="payroll-kpi-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div id="kpi-active-employees" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Staff On Payroll</span>
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalActiveStaff} <span className="text-xs font-normal text-slate-500">Employees</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            Across {branches.length} pharmacy branch branches
          </div>
        </div>

        <div id="kpi-monthly-base-payroll" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly Base Commitment</span>
            <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalMonthlyBasePayroll)} <span className="text-xs font-normal text-slate-500">ETB</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Excluding variable bonuses & overtime
          </div>
        </div>

        <div id="kpi-completed-runs" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Payroll Cycles</span>
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {runs.length} <span className="text-xs font-normal text-slate-500">Runs</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {runs.filter(r => r.status === 'Paid').length} Disbursed & Synced
          </div>
        </div>

        <div id="kpi-advances-outstanding" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Salary Advances Balance</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(totalOutstandingAdvances)} <span className="text-xs font-normal text-slate-500">ETB</span>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-amber-500" />
            Auto-recovered on monthly cycles
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div id="payroll-tab-navigation" className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          id="tab-payroll-runs"
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'runs'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Payroll Runs & Cycles ({runs.length})
        </button>

        <button
          id="tab-salary-profiles"
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'profiles'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Employee Salary Master ({profiles.length})
        </button>

        <button
          id="tab-salary-advances"
          onClick={() => setActiveTab('advances')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'advances'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Staff Salary Advances ({advances.length})
        </button>

        <button
          id="tab-tax-compliance"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Tax (ERCA) & Pension Summary
        </button>

        <button
          id="tab-staff-attendance"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'attendance'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Staff Attendance &amp; Timesheets
        </button>
      </div>

      {/* Filter Bar */}
      <div id="payroll-filter-bar" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="payroll-search-input"
            type="text"
            placeholder={activeTab === 'runs' ? 'Search payroll periods, batch numbers...' : 'Search staff name, code, role...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          id="payroll-branch-filter"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Pharmacy Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {activeTab === 'runs' && (
          <select
            id="payroll-run-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft Only</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid / Disbursed</option>
          </select>
        )}

        {activeTab === 'profiles' && (
          <button
            id="btn-import-users-to-payroll"
            onClick={handleImportFromUsers}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Import From System Users
          </button>
        )}

        {activeTab === 'advances' && (
          <button
            id="btn-new-advance-request"
            onClick={openNewAdvanceModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Issue Salary Advance
          </button>
        )}
      </div>

      {/* ==================== TAB 1: PAYROLL RUNS ==================== */}
      {activeTab === 'runs' && (
        <div id="payroll-runs-section" className="space-y-4">
          {filteredRuns.length === 0 ? (
            <div id="no-payroll-runs" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No Payroll Runs Generated Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Generate your first monthly payroll cycle to calculate base salaries, Ethiopian statutory taxes, pensions, and export CBE bank batch transfers.
              </p>
              <button
                id="btn-empty-create-run"
                onClick={openNewRunModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                <Calculator className="w-4 h-4" />
                Run First Payroll Cycle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRuns.map(run => (
                <div 
                  key={run.id}
                  id={`payroll-run-card-${run.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 shadow-sm transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        {run.periodLabel}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {run.payrollNumber}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        run.status === 'Paid'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : run.status === 'Approved'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {run.status === 'Paid' ? 'Paid & Disbursed' : run.status}
                      </span>
                      {run.syncedToExpenses && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Synced to Expenses
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>Scope: <strong className="text-slate-700 dark:text-slate-300">{run.branchName || 'All Branches'}</strong></span>
                      <span>Staff Count: <strong className="text-slate-700 dark:text-slate-300">{run.totalEmployees}</strong></span>
                      <span>Created On: <strong>{run.runDate}</strong></span>
                      {run.paymentReference && <span>Ref: <strong className="font-mono">{run.paymentReference}</strong></span>}
                    </div>

                    {/* Financial Summary Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Total Gross</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(run.totalGross)} ETB</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-400 block">ERCA Income Tax</span>
                        <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(run.totalTax)} ETB</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] text-slate-400 block">Total Pension (7%+11%)</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(run.totalPensionEmployee + run.totalPensionEmployer)} ETB</span>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">Net Take-Home Pay</span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(run.totalNet)} ETB</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap lg:flex-col items-center lg:items-end gap-2 w-full lg:w-auto">
                    <button
                      id={`btn-view-run-${run.id}`}
                      onClick={() => setViewingRun(run)}
                      className="flex-1 lg:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Full Breakdown ({run.records?.length || 0})
                    </button>

                    <div className="flex items-center gap-2 w-full lg:w-auto">
                      <button
                        id={`btn-export-csv-${run.id}`}
                        onClick={() => exportRunToCSV(run)}
                        title="Download CSV Spreadsheet"
                        className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        CSV
                      </button>

                      <button
                        id={`btn-export-cbe-${run.id}`}
                        onClick={() => exportBankTransferFormat(run)}
                        title="Export CBE Bank Batch Text File"
                        className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <Building className="w-3.5 h-3.5 text-purple-600" />
                        CBE Batch
                      </button>

                      {run.status !== 'Paid' && (
                        <button
                          id={`btn-disburse-${run.id}`}
                          onClick={() => handleDisburseRun(run)}
                          className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Disburse
                        </button>
                      )}

                      <button
                        id={`btn-delete-run-${run.id}`}
                        onClick={() => handleDeleteRun(run)}
                        title="Delete Run"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: EMPLOYEE SALARY PROFILES ==================== */}
      {activeTab === 'profiles' && (
        <div id="payroll-profiles-section" className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table id="payroll-profiles-table" className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Role & Branch</th>
                    <th className="py-3.5 px-4">Base Salary</th>
                    <th className="py-3.5 px-4">Allowances</th>
                    <th className="py-3.5 px-4">Statutory Pension</th>
                    <th className="py-3.5 px-4">Bank & Account</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No employee profiles found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map(prof => {
                      const branch = branches.find(b => b.id === prof.branchId);
                      const totalAllowances = Object.values(prof.allowances || {}).reduce((a, b) => a + Number(b || 0), 0);
                      return (
                        <tr key={prof.id} id={`profile-row-${prof.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{prof.employeeName}</div>
                            <div className="text-xs text-slate-400 font-mono">{prof.employeeCode} {prof.tinNumber ? `| TIN: ${prof.tinNumber}` : ''}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 dark:text-slate-200 font-medium">{prof.role}</div>
                            <div className="text-xs text-slate-400">{branch ? branch.name : 'All Branches'}</div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(prof.baseSalary)} ETB
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                            {totalAllowances > 0 ? (
                              <div>
                                <span className="font-medium">{formatCurrency(totalAllowances)} ETB</span>
                                <span className="block text-[11px] text-slate-400">
                                  {prof.allowances?.housing ? `H:${prof.allowances.housing} ` : ''}
                                  {prof.allowances?.transport ? `T:${prof.allowances.transport} ` : ''}
                                  {prof.allowances?.medical ? `M:${prof.allowances.medical}` : ''}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                            <div>Employee: <strong>{prof.deductions?.pensionEmployeePercent || 7}%</strong></div>
                            <div>Employer: <strong>{prof.deductions?.pensionEmployerPercent || 11}%</strong></div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{prof.bankName || 'CBE'}</div>
                            <div className="text-xs text-slate-400 font-mono">{prof.accountNumber || 'Pending Acc'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                              prof.status === 'Active'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {prof.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5">
                            <button
                              id={`btn-edit-prof-${prof.id}`}
                              onClick={() => openEditProfileModal(prof)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Salary Profile"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              id={`btn-delete-prof-${prof.id}`}
                              onClick={() => handleDeleteProfile(prof.id, prof.employeeName)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Remove Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SALARY ADVANCES ==================== */}
      {activeTab === 'advances' && (
        <div id="payroll-advances-section" className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table id="payroll-advances-table" className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Original Amount</th>
                    <th className="py-3.5 px-4">Remaining Balance</th>
                    <th className="py-3.5 px-4">Monthly Deduction</th>
                    <th className="py-3.5 px-4">Purpose / Reason</th>
                    <th className="py-3.5 px-4">Request Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No staff salary advances recorded.
                      </td>
                    </tr>
                  ) : (
                    filteredAdvances.map(adv => (
                      <tr key={adv.id} id={`advance-row-${adv.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{adv.employeeName}</div>
                          <div className="text-xs text-slate-400 font-mono">{adv.employeeCode}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(adv.amount)} ETB
                        </td>
                        <td className="py-3.5 px-4 font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(adv.remainingBalance)} ETB
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {formatCurrency(adv.monthlyDeduction)} ETB/mo
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {adv.reason}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                          {adv.requestDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            adv.status === 'Approved'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                              : adv.status === 'Fully Repaid'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          }`}>
                            {adv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            id={`btn-delete-adv-${adv.id}`}
                            onClick={() => handleDeleteAdvance(adv.id, adv.employeeName)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Remove Advance Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: TAX & STATUTORY REPORTS ==================== */}
      {activeTab === 'reports' && (
        <div id="payroll-reports-section" className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Ethiopian Ministry of Revenues (ERCA) Tax & Pension Schedule
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Standard personal income tax progressive brackets and pension contribution rates applied across all employee cycles.
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Tax Brackets Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Employment Income Tax Brackets (Monthly)
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/40 text-slate-500">
                    <tr>
                      <th className="p-2.5">Taxable Income Range (ETB)</th>
                      <th className="p-2.5">Tax Rate</th>
                      <th className="p-2.5">Deduction Constant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr><td className="p-2.5">0 – 600</td><td className="p-2.5 font-bold text-emerald-600">0%</td><td className="p-2.5">0.00 ETB</td></tr>
                    <tr><td className="p-2.5">601 – 1,650</td><td className="p-2.5 font-bold">10%</td><td className="p-2.5">60.00 ETB</td></tr>
                    <tr><td className="p-2.5">1,651 – 3,200</td><td className="p-2.5 font-bold">15%</td><td className="p-2.5">142.50 ETB</td></tr>
                    <tr><td className="p-2.5">3,201 – 5,250</td><td className="p-2.5 font-bold">20%</td><td className="p-2.5">302.50 ETB</td></tr>
                    <tr><td className="p-2.5">5,251 – 7,800</td><td className="p-2.5 font-bold">25%</td><td className="p-2.5">565.00 ETB</td></tr>
                    <tr><td className="p-2.5">7,801 – 10,900</td><td className="p-2.5 font-bold">30%</td><td className="p-2.5">955.00 ETB</td></tr>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30"><td className="p-2.5">Over 10,900</td><td className="p-2.5 font-bold text-rose-600">35%</td><td className="p-2.5">1,500.00 ETB</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Pension Contributions */}
              <div className="space-y-4">
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Public/Private Organization Pension Scheme</h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200 dark:border-slate-700">
                    <span>Employee Statutory Contribution:</span>
                    <strong className="text-emerald-600 font-bold">7% of Base Salary</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200 dark:border-slate-700">
                    <span>Pharmacy Employer Contribution:</span>
                    <strong className="text-blue-600 font-bold">11% of Base Salary</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span>Total Monthly Pension Remittance to POPSO:</span>
                    <strong className="text-purple-600 font-bold">18% of Total Base Pay</strong>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2 bg-emerald-50/30 dark:bg-emerald-950/20">
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Automated Expense Ledger Synchronization
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    When you disburse any payroll cycle, the net salaries are automatically posted into your centralized Pharmacy Expenses Ledger under the <strong>"Salaries"</strong> category with institutional reference codes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 5: STAFF ATTENDANCE ==================== */}
      {activeTab === 'attendance' && (
        <div id="payroll-attendance-section" className="space-y-4">
          <StaffAttendancePanel
            currentUser={currentUser}
            branches={branches}
            users={users}
            onDataChanged={onDataChanged}
          />
        </div>
      )}

      {/* ==================== MODAL: ADD / EDIT SALARY PROFILE ==================== */}
      {showProfileModal && (
        <div id="modal-salary-profile" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingProfile ? `Edit Salary Profile: ${editingProfile.employeeName}` : 'Add Employee Salary Profile'}
                </h3>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-5 sm:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Dawit Abebe"
                    value={profileForm.employeeName}
                    onChange={(e) => setProfileForm({ ...profileForm, employeeName: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employee Code / ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-001"
                    value={profileForm.employeeCode}
                    onChange={(e) => setProfileForm({ ...profileForm, employeeCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Pharmacist, Cashier, Store Keeper"
                    value={profileForm.role}
                    onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Branch Scope</label>
                  <select
                    value={profileForm.branchId}
                    onChange={(e) => setProfileForm({ ...profileForm, branchId: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="all">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Base Salary (ETB) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    placeholder="e.g. 25000"
                    value={profileForm.baseSalary}
                    onChange={(e) => setProfileForm({ ...profileForm, baseSalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Employment Status</label>
                  <select
                    value={profileForm.status}
                    onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              {/* Allowances Section */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Monthly Allowances (ETB)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Housing</label>
                    <input
                      type="number"
                      min="0"
                      value={profileForm.allowances?.housing || 0}
                      onChange={(e) => setProfileForm({
                        ...profileForm,
                        allowances: { ...profileForm.allowances, housing: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Transport</label>
                    <input
                      type="number"
                      min="0"
                      value={profileForm.allowances?.transport || 0}
                      onChange={(e) => setProfileForm({
                        ...profileForm,
                        allowances: { ...profileForm.allowances, transport: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Medical</label>
                    <input
                      type="number"
                      min="0"
                      value={profileForm.allowances?.medical || 0}
                      onChange={(e) => setProfileForm({
                        ...profileForm,
                        allowances: { ...profileForm.allowances, medical: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Position / Responsibility</label>
                    <input
                      type="number"
                      min="0"
                      value={profileForm.allowances?.position || 0}
                      onChange={(e) => setProfileForm({
                        ...profileForm,
                        allowances: { ...profileForm.allowances, position: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Banking & Statutory IDs */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Banking & Tax Compliance Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Commercial Bank of Ethiopia (CBE)"
                      value={profileForm.bankName}
                      onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1000192837465"
                      value={profileForm.accountNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, accountNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">TIN Number (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1092837465"
                      value={profileForm.tinNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, tinNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Pension Reg Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2024-001"
                      value={profileForm.pensionNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, pensionNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-salary-profile"
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  {editingProfile ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: NEW PAYROLL RUN BUILDER ==================== */}
      {showNewRunModal && (
        <div id="modal-new-payroll-run" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-600" />
                  Monthly Payroll Cycle Generator
                </h3>
                <p className="text-xs text-slate-500">
                  Auto-calculates Ethiopian income tax brackets, employee 7% pension, and advance recoveries.
                </p>
              </div>
              <button onClick={() => setShowNewRunModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Run Parameters Bar */}
            <div className="bg-slate-50 dark:bg-slate-800/70 p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payroll Month & Year</label>
                <div className="flex gap-2">
                  <select
                    value={runMonth}
                    onChange={(e) => setRunMonth(Number(e.target.value))}
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={runYear}
                    onChange={(e) => setRunYear(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Pharmacy Branch</label>
                <select
                  value={runBranchId}
                  onChange={(e) => setRunBranchId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                >
                  <option value="all">All Pharmacy Branches Combined</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payroll Run Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Regular monthly cycle"
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Records Live Breakdown Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table id="draft-payroll-table" className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-2">Base Salary</th>
                    <th className="py-2.5 px-2">Allowances</th>
                    <th className="py-2.5 px-2">OT & Bonus</th>
                    <th className="py-2.5 px-2">Gross Pay</th>
                    <th className="py-2.5 px-2 text-rose-600">ERCA Tax</th>
                    <th className="py-2.5 px-2">Pension 7%</th>
                    <th className="py-2.5 px-2">Advance Ded.</th>
                    <th className="py-2.5 px-3 text-emerald-600 font-bold">Net Pay (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {runRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No active employee profiles configured for this branch scope.
                      </td>
                    </tr>
                  ) : (
                    runRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{rec.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{rec.role} • {rec.bankName || 'CBE'}</div>
                        </td>
                        <td className="py-2.5 px-2 font-medium">{formatCurrency(rec.baseSalary)}</td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{formatCurrency(rec.totalAllowances)}</td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            placeholder="Bonus"
                            value={rec.bonuses || ''}
                            onChange={(e) => updateDraftRecord(rec.id, 'bonuses', e.target.value)}
                            className="w-16 px-1.5 py-1 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 px-2 font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(rec.grossSalary)}</td>
                        <td className="py-2.5 px-2 text-rose-600 dark:text-rose-400 font-medium">-{formatCurrency(rec.incomeTax)}</td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">-{formatCurrency(rec.pensionEmployee)}</td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min="0"
                            value={rec.salaryAdvanceDeduction || 0}
                            onChange={(e) => updateDraftRecord(rec.id, 'salaryAdvanceDeduction', e.target.value)}
                            className="w-16 px-1.5 py-1 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(rec.netSalary)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Run Totals Footer Bar */}
            <div className="bg-slate-50 dark:bg-slate-800 p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                <div>Total Gross: <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(runSummary.totalGross)} ETB</strong></div>
                <div>Total ERCA Tax: <strong className="text-rose-600">{formatCurrency(runSummary.totalTax)} ETB</strong></div>
                <div>Pension (7%+11%): <strong className="text-slate-800 dark:text-slate-200">{formatCurrency(runSummary.totalPensionEmployee + runSummary.totalPensionEmployer)} ETB</strong></div>
                <div className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">Total Net Pay: {formatCurrency(runSummary.totalNet)} ETB</div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleSaveRun('Draft')}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg transition-colors"
                >
                  Save Draft
                </button>
                <button
                  id="btn-approve-and-save-run"
                  type="button"
                  onClick={() => handleSaveRun('Approved')}
                  className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  Approve Payroll Run
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: FULL RUN BREAKDOWN VIEW ==================== */}
      {viewingRun && (
        <div id="modal-view-run-breakdown" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Payroll Cycle: {viewingRun.periodLabel} ({viewingRun.payrollNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  {viewingRun.branchName} • {viewingRun.totalEmployees} Employees • Status: <strong className="uppercase">{viewingRun.status}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportRunToCSV(viewingRun)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => setViewingRun(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-2">Base Salary</th>
                    <th className="py-2.5 px-2">Allowances</th>
                    <th className="py-2.5 px-2">Gross Pay</th>
                    <th className="py-2.5 px-2 text-rose-600">ERCA Tax</th>
                    <th className="py-2.5 px-2">Pension (7%)</th>
                    <th className="py-2.5 px-2">Advances</th>
                    <th className="py-2.5 px-3 text-emerald-600 font-bold">Net Pay</th>
                    <th className="py-2.5 px-2 text-right">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewingRun.records.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{rec.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{rec.employeeCode} • {rec.bankName || 'CBE'}</div>
                      </td>
                      <td className="py-2.5 px-2">{formatCurrency(rec.baseSalary)}</td>
                      <td className="py-2.5 px-2">{formatCurrency(rec.totalAllowances)}</td>
                      <td className="py-2.5 px-2 font-semibold">{formatCurrency(rec.grossSalary)}</td>
                      <td className="py-2.5 px-2 text-rose-600">-{formatCurrency(rec.incomeTax)}</td>
                      <td className="py-2.5 px-2">-{formatCurrency(rec.pensionEmployee)}</td>
                      <td className="py-2.5 px-2">{rec.salaryAdvanceDeduction ? `-${formatCurrency(rec.salaryAdvanceDeduction)}` : '—'}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(rec.netSalary)}</td>
                      <td className="py-2.5 px-2 text-right">
                        <button
                          onClick={() => setViewingPayslip({ record: rec, run: viewingRun })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded text-[11px] font-semibold"
                        >
                          <FileText className="w-3 h-3" /> Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: PRINTABLE PAYSLIP ==================== */}
      {viewingPayslip && (
        <div id="modal-payslip-view" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{instDetails.name}</h2>
                <p className="text-xs text-slate-500">{instDetails.address} • Phone: {instDetails.phone}</p>
                {instDetails.tinNumber && <p className="text-xs text-slate-500 font-mono">TIN: {instDetails.tinNumber}</p>}
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                  Official Payslip
                </span>
                <p className="text-xs font-semibold text-slate-600 mt-1">{viewingPayslip.run.periodLabel}</p>
              </div>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>Employee Name: <strong>{viewingPayslip.record.employeeName}</strong></div>
              <div>Staff Code: <strong className="font-mono">{viewingPayslip.record.employeeCode}</strong></div>
              <div>Designation: <strong>{viewingPayslip.record.role}</strong></div>
              <div>Bank Account: <strong className="font-mono">{viewingPayslip.record.accountNumber || 'CBE'}</strong></div>
            </div>

            {/* Earnings & Deductions Breakdown */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div className="space-y-1.5 border-r pr-3">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b">Earnings</h4>
                <div className="flex justify-between"><span>Base Salary:</span><strong>{formatCurrency(viewingPayslip.record.baseSalary)}</strong></div>
                <div className="flex justify-between"><span>Allowances:</span><strong>{formatCurrency(viewingPayslip.record.totalAllowances)}</strong></div>
                {viewingPayslip.record.overtimePay > 0 && <div className="flex justify-between"><span>Overtime:</span><strong>{formatCurrency(viewingPayslip.record.overtimePay)}</strong></div>}
                {viewingPayslip.record.bonuses > 0 && <div className="flex justify-between"><span>Bonus:</span><strong>{formatCurrency(viewingPayslip.record.bonuses)}</strong></div>}
                <div className="flex justify-between pt-1 border-t font-bold text-slate-900">
                  <span>Gross Salary:</span><span>{formatCurrency(viewingPayslip.record.grossSalary)} ETB</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] pb-1 border-b">Deductions</h4>
                <div className="flex justify-between text-rose-600"><span>Income Tax (ERCA):</span><strong>-{formatCurrency(viewingPayslip.record.incomeTax)}</strong></div>
                <div className="flex justify-between"><span>Employee Pension (7%):</span><strong>-{formatCurrency(viewingPayslip.record.pensionEmployee)}</strong></div>
                {viewingPayslip.record.salaryAdvanceDeduction > 0 && (
                  <div className="flex justify-between"><span>Advance Repayment:</span><strong>-{formatCurrency(viewingPayslip.record.salaryAdvanceDeduction)}</strong></div>
                )}
                {viewingPayslip.record.otherDeductions > 0 && (
                  <div className="flex justify-between"><span>Other Deductions:</span><strong>-{formatCurrency(viewingPayslip.record.otherDeductions)}</strong></div>
                )}
                <div className="flex justify-between pt-1 border-t font-bold text-rose-700">
                  <span>Total Deductions:</span><span>-{formatCurrency(viewingPayslip.record.totalDeductions)} ETB</span>
                </div>
              </div>
            </div>

            {/* Net Salary Highlight */}
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-800">Net Take-Home Pay</span>
                <span className="block text-[11px] text-emerald-600">Credited to CBE Account</span>
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {formatCurrency(viewingPayslip.record.netSalary)} ETB
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t text-[11px] text-slate-500">
              <div>
                <p className="border-b border-slate-300 pb-6"></p>
                <p className="pt-1 text-center font-medium">Authorized Accountant</p>
              </div>
              <div>
                <p className="border-b border-slate-300 pb-6"></p>
                <p className="pt-1 text-center font-medium">Employee Signature</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Payslip
              </button>
              <button
                onClick={() => setViewingPayslip(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ISSUE SALARY ADVANCE ==================== */}
      {showAdvanceModal && (
        <div id="modal-salary-advance" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Issue Staff Salary Advance
              </h3>
              <button onClick={() => setShowAdvanceModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Employee *</label>
                <select
                  required
                  value={advanceForm.employeeId}
                  onChange={(e) => {
                    const sel = profiles.find(p => p.id === e.target.value);
                    if (sel) {
                      setAdvanceForm({
                        ...advanceForm,
                        employeeId: sel.id,
                        employeeName: sel.employeeName,
                        employeeCode: sel.employeeCode,
                        branchId: sel.branchId
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">-- Choose Employee --</option>
                  {profiles.filter(p => p.status === 'Active').map(p => (
                    <option key={p.id} value={p.id}>{p.employeeName} ({p.employeeCode} - Base: {formatCurrency(p.baseSalary)} ETB)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Advance Amount (ETB) *</label>
                <input
                  type="number"
                  required
                  min="100"
                  step="100"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({
                    ...advanceForm, 
                    amount: Number(e.target.value),
                    monthlyDeduction: advanceForm.monthlyDeduction || Number(e.target.value)
                  })}
                  className="w-full px-3 py-2 font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Auto-Recovery Deduction (ETB)</label>
                <input
                  type="number"
                  required
                  min="100"
                  value={advanceForm.monthlyDeduction}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, monthlyDeduction: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent family expense"
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-3.5 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                >
                  Approve & Issue Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
