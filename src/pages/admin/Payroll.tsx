import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Calculator,
  Printer,
  Edit3,
  FileText,
  Pencil,
  Share2,
  User,
  X,
} from 'lucide-react';
import {
  supabase,
  formatINR,
  type Profile,
  type Payroll,
  type Attendance,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';

// ——— Types ————————————————————————————————————————————————————————————————————

type AttendanceStatus = Attendance['status'];

interface EmployeeWithDepts extends Profile {
  departmentNames: string[];
}

interface AttendanceSummary {
  employee: EmployeeWithDepts;
  daysPresent: number;
  daysAbsent: number;
  daysLeave: number;
  daysWeekendHoliday: number;
}

interface PayrollRow {
  employee: EmployeeWithDepts;
  record: Payroll | null;
  calculated: {
    base: number;
    kpiIncentive: number;
    tds: number;
    pf: number;
    esi: number;
    profTax: number;
    net: number;
  };
}

interface OverrideForm {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}

// ——— Constants ————————————————————————————————————————————————————————————————

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'Present',
  'Absent',
  'Weekend',
  'Public Holiday',
  'On Approved-Leave',
];

const STATUS_TONES: Record<Payroll['status'], 'warning' | 'info' | 'success'> = {
  Draft: 'warning',
  Processed: 'info',
  Paid: 'success',
};

// ——— Calculation helper ———————————————————————————————————————————————————————

function calculatePayroll(emp: Profile) {
  const base = emp.base_salary ?? 0;
  const kpiScore = emp.kpi_score ?? 0;
  const kpiIncentive = (kpiScore / 10) * base * 0.1;
  const tds = emp.tds_enabled ? base * 0.1 : 0;
  const pf = emp.pf_enabled ? base * 0.12 : 0;
  const esi = emp.esi_enabled ? base * 0.0075 : 0;
  const profTax = emp.professional_tax_enabled ? 200 : 0;
  const net = base + kpiIncentive - tds - pf - esi - profTax;
  return { base, kpiIncentive, tds, pf, esi, profTax, net };
}

// ——— Sub-components ———————————————————————————————————————————————————————————

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'info' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : tone === 'info'
          ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
          : tone === 'danger'
            ? 'border-destructive/20 bg-destructive/10 text-destructive'
            : 'border-border bg-background text-muted-foreground';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function InlineNotice({
  tone,
  title,
  description,
  onDismiss,
}: {
  tone: 'error' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  onDismiss?: () => void;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-destructive/20 bg-destructive/10 text-destructive'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : tone === 'success'
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-border bg-card text-card-foreground';

  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${toneClass}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border">
        {cols.map(header => (
          <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {header}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
  );
}

interface PayslipProps {
  open: boolean;
  onDismiss: () => void;
  employee: EmployeeWithDepts | null;
  record: Payroll | null;
  month: number;
  year: number;
}

function PayslipModal({ open, onDismiss, employee, record, month, year }: PayslipProps) {
  if (!employee) return null;

  const calc = record
    ? {
        base: record.base_salary,
        kpiIncentive: record.kpi_incentive,
        tds: record.tds_deduction,
        pf: record.pf_deduction,
        esi: record.esi_deduction,
        profTax: record.professional_tax_deduction,
        net: record.net_salary,
      }
    : calculatePayroll(employee);

  const totalEarnings = calc.base + calc.kpiIncentive;
  const totalDeductions = calc.tds + calc.pf + calc.esi + calc.profTax;

  const generatePayslipHtml = () => {
    const empName = employee?.full_name || 'Employee';
    const empCode = employee?.employee_code || '-';
    const empDept = employee?.departmentNames?.join(', ') || '-';
    const empEmail = employee?.email || '-';
    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return `
      <div style="font-family: 'Neue Montreal', Arial, sans-serif; color: #000000; width: 760px; background: #ffffff; padding: 40px; box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid #E5E5E5; margin-bottom: 24px;">
          <div>
            <img src="/brand/gravium-wordmark-light.png" alt="GRAVIUM" style="width: 155px; height: auto; display: block;" />
          </div>
          <div style="text-align: right;">
            <div style="font-size: 28px; line-height: 1; font-weight: 800; letter-spacing: -0.03em;">Payslip</div>
            <div style="font-size: 12px; color: #6B6A69; margin-top: 8px;">Pay Period - <span style="font-weight: 700; color: #000000;">${MONTH_NAMES[month - 1]} ${year}</span></div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #F5F5F5; padding: 18px; border: 1px solid #E5E5E5; border-radius: 14px; margin-bottom: 28px;">
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Employee Name</div><div style="font-weight: 700; margin-top: 4px;">${empName}</div></div>
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Employee Code</div><div style="font-weight: 700; margin-top: 4px;">${empCode}</div></div>
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Department</div><div style="margin-top: 4px;">${empDept}</div></div>
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Email</div><div style="margin-top: 4px;">${empEmail}</div></div>
          ${record ? `
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Days Present</div><div style="margin-top: 4px;">${record.days_present}</div></div>
          <div><div style="font-size: 10px; color: #6B6A69; text-transform: uppercase; letter-spacing: 0.8px;">Days Absent</div><div style="margin-top: 4px;">${record.days_absent}</div></div>
          ` : ''}
        </div>

        <div style="font-weight: 700; text-transform: uppercase; font-size: 12px; color: #6B6A69; margin-bottom: 10px; letter-spacing: 1px;">Earnings</div>
        <div style="border: 1px solid #E5E5E5; border-radius: 14px; overflow: hidden; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>Base Salary</span><span style="font-weight: 700;">${fmt(calc.base)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>KPI Incentive</span><span style="font-weight: 700;">${fmt(calc.kpiIncentive)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 14px 16px; background: #F5F5F5; font-weight: 700;"><span>Total Earnings</span><span>${fmt(totalEarnings)}</span></div>
        </div>

        <div style="font-weight: 700; text-transform: uppercase; font-size: 12px; color: #6B6A69; margin-bottom: 10px; letter-spacing: 1px;">Deductions</div>
        <div style="border: 1px solid #E5E5E5; border-radius: 14px; overflow: hidden; margin-bottom: 28px;">
          ${calc.tds > 0 ? `<div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>TDS (10%)</span><span>- ${fmt(calc.tds)}</span></div>` : ''}
          ${calc.pf > 0 ? `<div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>PF (12%)</span><span>- ${fmt(calc.pf)}</span></div>` : ''}
          ${calc.esi > 0 ? `<div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>ESI (0.75%)</span><span>- ${fmt(calc.esi)}</span></div>` : ''}
          ${calc.profTax > 0 ? `<div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span>Professional Tax</span><span>- ${fmt(calc.profTax)}</span></div>` : ''}
          ${totalDeductions === 0 ? `<div style="display: flex; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid #E5E5E5;"><span style="color: #6B6A69;">No deductions applicable</span><span>-</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; padding: 14px 16px; background: #F5F5F5; font-weight: 700;"><span>Total Deductions</span><span>- ${fmt(totalDeductions)}</span></div>
        </div>

        <div style="border: 2px solid #000000; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; border-radius: 16px;">
          <span style="font-size: 18px; font-weight: 700;">Net Salary</span>
          <span style="font-size: 28px; font-weight: 800;">${fmt(calc.net)}</span>
        </div>
      </div>
    `;
  };

  const handlePrintPayslip = () => {
    const htmlContent = generatePayslipHtml();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Payslip - ${employee?.full_name || 'Employee'}</title>
        <style>
          body { margin: 0; padding: 32px; background: #ffffff; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleSharePayslip = async () => {
    const htmlContent = generatePayslipHtml();
    const fullHtml = `<html><body>${htmlContent}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const fileName = `payslip-${employee?.full_name?.replace(/\s+/g, '-').toLowerCase() || 'employee'}-${MONTH_NAMES[month - 1]}-${year}.html`;
    const file = new File([blob], fileName, { type: 'text/html' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `Payslip - ${employee?.full_name || 'Employee'}`,
          text: `Payslip for ${MONTH_NAMES[month - 1]} ${year}`,
          files: [file],
        });
        return;
      } catch {
        // Fall back to download.
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={open ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm' : 'hidden'}>
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Payslip</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {employee.full_name || 'Employee'} - {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close payslip"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-4 sm:p-5">
          <div id="payslip-print-area" className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-white p-6 text-[#111827] shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] pb-5">
              <div>
                <img
                  src="/brand/gravium-wordmark-light.png"
                  alt="GRAVIUM"
                  className="h-auto w-36 object-contain"
                />
              </div>

              <div className="text-right">
                <p className="text-2xl font-black leading-none tracking-[-0.03em] text-[#111827]">
                  Payslip
                </p>
                <p className="mt-2 text-xs text-[#6B7280]">
                  Pay Period - <span className="font-bold text-[#111827]">{MONTH_NAMES[month - 1]} {year}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Employee Name</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{employee.full_name || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Employee Code</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{employee.employee_code || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Department</p>
                <p className="mt-1 text-sm text-[#111827]">{employee.departmentNames.join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Email</p>
                <p className="mt-1 break-all text-sm text-[#111827]">{employee.email}</p>
              </div>
              {record && (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Days Present</p>
                    <p className="mt-1 text-sm text-[#111827]">{record.days_present}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">Days Absent</p>
                    <p className="mt-1 text-sm text-[#111827]">{record.days_absent}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#4B5563]">Earnings</p>
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                  <span>Base Salary</span>
                  <span className="font-bold">{formatINR(calc.base)}</span>
                </div>
                <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                  <span>KPI Incentive</span>
                  <span className="font-bold">{formatINR(calc.kpiIncentive)}</span>
                </div>
                <div className="flex justify-between bg-[#F3F4F6] px-4 py-3 text-sm font-bold">
                  <span>Total Earnings</span>
                  <span>{formatINR(totalEarnings)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#4B5563]">Deductions</p>
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                {calc.tds > 0 && (
                  <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                    <span>TDS (10%)</span>
                    <span>- {formatINR(calc.tds)}</span>
                  </div>
                )}
                {calc.pf > 0 && (
                  <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                    <span>PF (12%)</span>
                    <span>- {formatINR(calc.pf)}</span>
                  </div>
                )}
                {calc.esi > 0 && (
                  <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                    <span>ESI (0.75%)</span>
                    <span>- {formatINR(calc.esi)}</span>
                  </div>
                )}
                {calc.profTax > 0 && (
                  <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm">
                    <span>Professional Tax</span>
                    <span>- {formatINR(calc.profTax)}</span>
                  </div>
                )}
                {totalDeductions === 0 && (
                  <div className="flex justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm text-[#6B7280]">
                    <span>No deductions applicable</span>
                    <span>-</span>
                  </div>
                )}
                <div className="flex justify-between bg-[#F3F4F6] px-4 py-3 text-sm font-bold">
                  <span>Total Deductions</span>
                  <span>- {formatINR(totalDeductions)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-xl border-2 border-[#111827] px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#6B7280]">Net Salary</p>
                <p className="mt-1 text-xs text-[#6B7280]">Amount payable for {MONTH_NAMES[month - 1]} {year}</p>
              </div>
              <p className="text-xl font-black tracking-tight text-[#111827]">{formatINR(calc.net)}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrintPayslip}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleSharePayslip}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PayrollPage() {
  const { profile: currentProfile, departments, isAdmin, isFinance } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [filterDeptId, setFilterDeptId] = useState<string>('all');

  const [employees, setEmployees] = useState<EmployeeWithDepts[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<Payroll[]>([]);
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);

  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Processing state: employeeId -> boolean
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // Edit payroll modal
  const [editRecord, setEditRecord] = useState<Payroll | null>(null);
  const [editForm, setEditForm] = useState({
    base_salary: '',
    kpi_incentive: '',
    tds_deduction: '',
    pf_deduction: '',
    esi_deduction: '',
    professional_tax_deduction: '',
    status: 'Processed' as Payroll['status'],
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Payslip modal
  const [payslipEmployee, setPayslipEmployee] = useState<EmployeeWithDepts | null>(null);
  const [payslipRecord, setPayslipRecord] = useState<Payroll | null>(null);

  // Attendance override modal
  const [showOverride, setShowOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState<OverrideForm>({
    employeeId: '',
    date: '',
    status: 'Present',
  });
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  // ——— Access guard ——————————————————————————————————————————————————————————

  const hasAccess = isAdmin() || isFinance();

  // ——— Fetch employees ———————————————————————————————————————————————————————

  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (err || !data) {
      setLoadingEmployees(false);
      return;
    }

    const enriched: EmployeeWithDepts[] = (data as Profile[]).map(emp => ({
      ...emp,
      departmentNames: (emp.department_ids ?? [])
        .map(id => departments.find(d => d.id === id)?.name ?? '')
        .filter(Boolean),
    }));
    setEmployees(enriched);
    setLoadingEmployees(false);
  }, [departments]);

  // ——— Fetch payroll for selected period —————————————————————————————————————

  const fetchPayroll = useCallback(async () => {
    setLoadingPayroll(true);
    const { data, error: err } = await supabase
      .from('payroll')
      .select('*')
      .eq('month', selectedMonth)
      .eq('year', selectedYear);

    if (!err && data) setPayrollRecords(data as Payroll[]);
    setLoadingPayroll(false);
  }, [selectedMonth, selectedYear]);

  // ——— Fetch attendance for selected period ——————————————————————————————————

  const fetchAttendance = useCallback(async () => {
    setLoadingAttendance(true);
    // Date range for the selected month
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const endDate = new Date(selectedYear, selectedMonth, 0);
    const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const { data, error: err } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDateStr);

    if (!err && data) setAttendanceData(data as Attendance[]);
    setLoadingAttendance(false);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (departments.length > 0) fetchEmployees();
  }, [fetchEmployees, departments]);

  useEffect(() => {
    fetchPayroll();
    fetchAttendance();
  }, [fetchPayroll, fetchAttendance]);

  // ——— Attendance summaries ——————————————————————————————————————————————————

  const attendanceSummaries: AttendanceSummary[] = employees
    .filter(emp => filterDeptId === 'all' || emp.department_ids?.includes(filterDeptId))
    .map(emp => {
      const empAttendance = attendanceData.filter(a => a.employee_id === emp.id);
      return {
        employee: emp,
        daysPresent: empAttendance.filter(a => a.status === 'Present').length,
        daysAbsent: empAttendance.filter(a => a.status === 'Absent').length,
        daysLeave: empAttendance.filter(a => a.status === 'On Approved-Leave').length,
        daysWeekendHoliday: empAttendance.filter(
          a => a.status === 'Weekend' || a.status === 'Public Holiday'
        ).length,
      };
    });

  // ——— Payroll rows ——————————————————————————————————————————————————————————

  const payrollRows: PayrollRow[] = employees
    .filter(emp => filterDeptId === 'all' || emp.department_ids?.includes(filterDeptId))
    .map(emp => {
      const record = payrollRecords.find(r => r.employee_id === emp.id) ?? null;
      return {
        employee: emp,
        record,
        calculated: calculatePayroll(emp),
      };
    });

  // ——— Process payroll ————————————————————————————————————————————————————————

  const handleProcess = async (emp: EmployeeWithDepts) => {
    setProcessing(p => ({ ...p, [emp.id]: true }));
    setError('');

    const calc = calculatePayroll(emp);
    const summary = attendanceSummaries.find(s => s.employee.id === emp.id);
    const daysPresent = summary?.daysPresent ?? 0;
    const daysAbsent = summary?.daysAbsent ?? 0;

    const existing = payrollRecords.find(r => r.employee_id === emp.id);

    const payload = {
      employee_id: emp.id,
      month: selectedMonth,
      year: selectedYear,
      base_salary: calc.base,
      kpi_incentive: Math.round(calc.kpiIncentive),
      tds_deduction: Math.round(calc.tds),
      pf_deduction: Math.round(calc.pf),
      esi_deduction: Math.round(calc.esi),
      professional_tax_deduction: calc.profTax,
      net_salary: Math.round(calc.net),
      days_present: daysPresent,
      days_absent: daysAbsent,
      status: 'Processed' as Payroll['status'],
      payslip_generated: false,
    };

    let err;
    if (existing) {
      ({ error: err } = await supabase.from('payroll').update(payload).eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('payroll').insert(payload));
    }

    if (err) {
      setError(`Failed to process payroll for ${emp.full_name}: ${err.message}`);
    } else {
      setSuccessMsg(`Payroll processed for ${emp.full_name}.`);
      await fetchPayroll();
    }
    setProcessing(p => ({ ...p, [emp.id]: false }));
  };

  // ——— Mark as paid ————————————————————————————————————————————————————————————

  const handleMarkPaid = async (record: Payroll) => {
    setProcessing(p => ({ ...p, [record.employee_id]: true }));
    setError('');

    const { error: err } = await supabase
      .from('payroll')
      .update({ status: 'Paid' as Payroll['status'] })
      .eq('id', record.id);

    if (err) {
      setError(`Failed to mark payroll as paid: ${err.message}`);
    } else {
      setSuccessMsg('Payroll marked as paid.');
      await fetchPayroll();
    }
    setProcessing(p => ({ ...p, [record.employee_id]: false }));
  };

  // ——— Open edit modal —————————————————————————————————————————————————————————

  const openEdit = (record: Payroll) => {
    setEditRecord(record);
    setEditForm({
      base_salary: String(record.base_salary),
      kpi_incentive: String(record.kpi_incentive),
      tds_deduction: String(record.tds_deduction),
      pf_deduction: String(record.pf_deduction),
      esi_deduction: String(record.esi_deduction),
      professional_tax_deduction: String(record.professional_tax_deduction),
      status: record.status,
    });
    setEditError('');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    setEditSaving(true);
    setEditError('');

    const base = parseFloat(editForm.base_salary) || 0;
    const kpi = parseFloat(editForm.kpi_incentive) || 0;
    const tds = parseFloat(editForm.tds_deduction) || 0;
    const pf = parseFloat(editForm.pf_deduction) || 0;
    const esi = parseFloat(editForm.esi_deduction) || 0;
    const profTax = parseFloat(editForm.professional_tax_deduction) || 0;
    const net = base + kpi - tds - pf - esi - profTax;

    const { error: err } = await supabase
      .from('payroll')
      .update({
        base_salary: base,
        kpi_incentive: kpi,
        tds_deduction: tds,
        pf_deduction: pf,
        esi_deduction: esi,
        professional_tax_deduction: profTax,
        net_salary: net,
        status: editForm.status,
      })
      .eq('id', editRecord.id);

    if (err) {
      setEditError(err.message);
    } else {
      setEditRecord(null);
      setSuccessMsg('Payroll entry updated.');
      await fetchPayroll();
    }
    setEditSaving(false);
  };

  // ——— Generate payslip ————————————————————————————————————————————————————————

  const handleGeneratePayslip = async (emp: EmployeeWithDepts, record: Payroll | null) => {
    setPayslipEmployee(emp);
    setPayslipRecord(record);

    if (record) {
      await supabase.from('payroll').update({ payslip_generated: true }).eq('id', record.id);
      setPayrollRecords(prev =>
        prev.map(r => (r.id === record.id ? { ...r, payslip_generated: true } : r))
      );
    }
  };

  // ——— Attendance override ——————————————————————————————————————————————————————

  const openOverride = (emp: EmployeeWithDepts) => {
    const today = new Date();
    const defaultDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
      Math.min(today.getDate(), new Date(selectedYear, selectedMonth, 0).getDate())
    ).padStart(2, '0')}`;
    setOverrideForm({ employeeId: emp.id, date: defaultDate, status: 'Present' });
    setOverrideError('');
    setShowOverride(true);
  };

  const handleOverrideSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.date || !overrideForm.employeeId) return;
    setOverrideSaving(true);
    setOverrideError('');

    // Check if record exists for that date
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', overrideForm.employeeId)
      .eq('date', overrideForm.date)
      .maybeSingle();

    let err;
    if (existing) {
      ({ error: err } = await supabase
        .from('attendance')
        .update({ status: overrideForm.status, admin_override: true })
        .eq('id', existing.id));
    } else {
      ({ error: err } = await supabase.from('attendance').insert({
        employee_id: overrideForm.employeeId,
        date: overrideForm.date,
        status: overrideForm.status,
        admin_override: true,
        location_stamp: '',
        notes: 'Admin override',
      }));
    }

    if (err) {
      setOverrideError(err.message);
    } else {
      setShowOverride(false);
      setSuccessMsg('Attendance overridden successfully.');
      await fetchAttendance();
    }
    setOverrideSaving(false);
  };

  // ——— Access denied ————————————————————————————————————————————————————————————

  if (!currentProfile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto mt-20 max-w-xl px-4">
        <InlineNotice
          tone="error"
          title="Access Denied"
          description="You do not have permission to view this page. Only Finance department members or Super Admins can access Payroll."
        />
      </div>
    );
  }

  const isLoading = loadingEmployees || loadingPayroll || loadingAttendance;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <PageHeader
        eyebrow="Finance"
        title="Payroll"
        description="Manage employee salaries, attendance summaries, payroll processing, and payslips."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={event => setSelectedMonth(Number(event.target.value))}
              className="form-input h-10 text-sm"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>{name}</option>
              ))}
            </select>
            <input
              type="number"
              value={selectedYear}
              min={2020}
              max={2099}
              onChange={event => setSelectedYear(Number(event.target.value))}
              className="form-input h-10 w-24 text-sm"
            />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterDeptId('all')}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            filterDeptId === 'all'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          All Departments
        </button>

        {departments.map(department => (
          <button
            key={department.id}
            type="button"
            onClick={() => setFilterDeptId(department.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filterDeptId === department.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {department.code}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4">
          <InlineNotice tone="error" title="Error" description={error} onDismiss={() => setError('')} />
        </div>
      )}

      {successMsg && (
        <div className="mb-4">
          <InlineNotice tone="success" title="Success" description={successMsg} onDismiss={() => setSuccessMsg('')} />
        </div>
      )}

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading payroll data...</p>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Attendance Summary - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>

            {attendanceSummaries.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <User className="h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No employees found.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <TableHead cols={['Employee', 'Departments', 'Present', 'Absent', 'Leave', 'Weekend/Holiday', 'Actions']} />
                    <tbody>
                      {attendanceSummaries.map(summary => (
                        <tr key={summary.employee.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
                                {(summary.employee.full_name || summary.employee.email || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{summary.employee.full_name || '-'}</p>
                                <p className="text-xs text-muted-foreground">{summary.employee.employee_code || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {summary.employee.departmentNames.length > 0 ? (
                                summary.employee.departmentNames.map(name => (
                                  <span key={name} className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                                    {name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3"><Badge tone="success">{summary.daysPresent}</Badge></td>
                          <td className="px-4 py-3"><Badge tone={summary.daysAbsent > 0 ? 'danger' : 'default'}>{summary.daysAbsent}</Badge></td>
                          <td className="px-4 py-3"><Badge tone={summary.daysLeave > 0 ? 'warning' : 'default'}>{summary.daysLeave}</Badge></td>
                          <td className="px-4 py-3"><Badge tone="info">{summary.daysWeekendHoliday}</Badge></td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openOverride(summary.employee)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Override
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Salary Table - {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>

            {payrollRows.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <Calculator className="h-7 w-7 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No employees found.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <TableHead
                      cols={[
                        'Employee',
                        'Base Salary',
                        'KPI Incentive',
                        'TDS',
                        'PF',
                        'ESI',
                        'Prof. Tax',
                        'Net Salary',
                        'Status',
                        'Actions',
                      ]}
                    />
                    <tbody>
                      {payrollRows.map(row => {
                        const { employee, record, calculated } = row;
                        const displayCalc = record
                          ? {
                              base: record.base_salary,
                              kpiIncentive: record.kpi_incentive,
                              tds: record.tds_deduction,
                              pf: record.pf_deduction,
                              esi: record.esi_deduction,
                              profTax: record.professional_tax_deduction,
                              net: record.net_salary,
                            }
                          : calculated;
                        const isProcessing = processing[employee.id] ?? false;

                        return (
                          <tr key={employee.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
                                  {(employee.full_name || employee.email || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">{employee.full_name || '-'}</p>
                                  <p className="text-xs text-muted-foreground">{employee.employee_code || '-'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-foreground">{formatINR(displayCalc.base)}</td>
                            <td className={`px-4 py-3 ${displayCalc.kpiIncentive > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                              {formatINR(displayCalc.kpiIncentive)}
                            </td>
                            <td className={`px-4 py-3 ${displayCalc.tds > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {displayCalc.tds > 0 ? `- ${formatINR(displayCalc.tds)}` : '-'}
                            </td>
                            <td className={`px-4 py-3 ${displayCalc.pf > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {displayCalc.pf > 0 ? `- ${formatINR(displayCalc.pf)}` : '-'}
                            </td>
                            <td className={`px-4 py-3 ${displayCalc.esi > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {displayCalc.esi > 0 ? `- ${formatINR(displayCalc.esi)}` : '-'}
                            </td>
                            <td className={`px-4 py-3 ${displayCalc.profTax > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {displayCalc.profTax > 0 ? `- ${formatINR(displayCalc.profTax)}` : '-'}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">{formatINR(displayCalc.net)}</td>
                            <td className="px-4 py-3">
                              {record ? (
                                <Badge tone={STATUS_TONES[record.status]}>{record.status}</Badge>
                              ) : (
                                <Badge>-</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-nowrap items-center gap-1">
                                {(!record || record.status === 'Draft') && (
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleProcess(employee)}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isProcessing && <Spinner />}
                                    {record ? 'Re-Process' : 'Process'}
                                  </button>
                                )}

                                {record && record.status === 'Processed' && (
                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleMarkPaid(record)}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isProcessing && <Spinner />}
                                    Mark Paid
                                  </button>
                                )}

                                {record && (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(record)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    title="Edit payroll"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleGeneratePayslip(employee, record)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Generate payslip"
                                >
                                  <FileText className={`h-4 w-4 ${record?.payslip_generated ? 'text-emerald-600 dark:text-emerald-300' : ''}`} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Edit Payroll Entry</h2>
              <button
                type="button"
                onClick={() => setEditRecord(null)}
                disabled={editSaving}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5">
                <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>

                {editError && (
                  <div className="mb-4">
                    <InlineNotice tone="error" title="Error" description={editError} />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Base Salary (?)">
                    <input type="number" min="0" step="1" value={editForm.base_salary} onChange={event => setEditForm(form => ({ ...form, base_salary: event.target.value }))} className="form-input" />
                  </FormField>
                  <FormField label="KPI Incentive (?)">
                    <input type="number" min="0" step="1" value={editForm.kpi_incentive} onChange={event => setEditForm(form => ({ ...form, kpi_incentive: event.target.value }))} className="form-input" />
                  </FormField>
                  <FormField label="TDS Deduction (?)">
                    <input type="number" min="0" step="1" value={editForm.tds_deduction} onChange={event => setEditForm(form => ({ ...form, tds_deduction: event.target.value }))} className="form-input" />
                  </FormField>
                  <FormField label="PF Deduction (?)">
                    <input type="number" min="0" step="1" value={editForm.pf_deduction} onChange={event => setEditForm(form => ({ ...form, pf_deduction: event.target.value }))} className="form-input" />
                  </FormField>
                  <FormField label="ESI Deduction (?)">
                    <input type="number" min="0" step="1" value={editForm.esi_deduction} onChange={event => setEditForm(form => ({ ...form, esi_deduction: event.target.value }))} className="form-input" />
                  </FormField>
                  <FormField label="Professional Tax (?)">
                    <input type="number" min="0" step="1" value={editForm.professional_tax_deduction} onChange={event => setEditForm(form => ({ ...form, professional_tax_deduction: event.target.value }))} className="form-input" />
                  </FormField>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
                  <span className="text-sm text-muted-foreground">Computed Net Salary</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatINR(
                      (parseFloat(editForm.base_salary) || 0) +
                        (parseFloat(editForm.kpi_incentive) || 0) -
                        (parseFloat(editForm.tds_deduction) || 0) -
                        (parseFloat(editForm.pf_deduction) || 0) -
                        (parseFloat(editForm.esi_deduction) || 0) -
                        (parseFloat(editForm.professional_tax_deduction) || 0)
                    )}
                  </span>
                </div>

                <div className="mt-4">
                  <FormField label="Status">
                    <select
                      value={editForm.status}
                      onChange={event => setEditForm(form => ({ ...form, status: event.target.value as Payroll['status'] }))}
                      className="form-input"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Processed">Processed</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </FormField>
                </div>
              </div>

              <div className="flex shrink-0 flex-col justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  disabled={editSaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {editSaving && <Spinner />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Override Attendance</h2>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                disabled={overrideSaving}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleOverrideSave} className="flex flex-col gap-4 p-5">
              <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>

              {overrideError && <InlineNotice tone="error" title="Error" description={overrideError} />}

              <FormField label="Employee">
                <select
                  value={overrideForm.employeeId}
                  onChange={event => setOverrideForm(form => ({ ...form, employeeId: event.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="">Select employee...</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email} ({employee.employee_code || '-'})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date">
                <input
                  type="date"
                  value={overrideForm.date}
                  min={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`}
                  max={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
                    new Date(selectedYear, selectedMonth, 0).getDate()
                  ).padStart(2, '0')}`}
                  onChange={event => setOverrideForm(form => ({ ...form, date: event.target.value }))}
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="Attendance Status">
                <select
                  value={overrideForm.status}
                  onChange={event => setOverrideForm(form => ({ ...form, status: event.target.value as AttendanceStatus }))}
                  className="form-input"
                >
                  {ATTENDANCE_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </FormField>

              <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowOverride(false)}
                  disabled={overrideSaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {overrideSaving && <Spinner />}
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PayslipModal
        open={!!payslipEmployee}
        onDismiss={() => { setPayslipEmployee(null); setPayslipRecord(null); }}
        employee={payslipEmployee}
        record={payslipRecord}
        month={selectedMonth}
        year={selectedYear}
      />
    </div>
  );
}
