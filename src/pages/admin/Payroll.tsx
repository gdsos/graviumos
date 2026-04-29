import { useState, useEffect, useCallback } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
  PModal,
  PInlineNotification,
} from '@porsche-design-system/components-react';
import {
  supabase,
  formatINR,
  type Profile,
  type Payroll,
  type Attendance,
  type Department,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<Payroll['status'], Parameters<typeof PTag>[0]['color']> = {
  Draft: 'notification-warning-soft',
  Processed: 'notification-info-soft',
  Paid: 'notification-success-soft',
};

// ─── Calculation helper ───────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5"
        style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-contrast-low">
        {cols.map(h => (
          <th key={h} className="px-4 py-3 text-left whitespace-nowrap">
            <PText size="xx-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide">
              {h}
            </PText>
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Payslip Print Modal ──────────────────────────────────────────────────────

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
    const empCode = employee?.employee_code || '—';
    const empDept = employee?.departmentNames?.join(', ') || '—';
    const empEmail = employee?.email || '—';
    const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

    return `
      <div style="font-family: 'Montserrat', Arial, sans-serif; color: #010205; max-width: 700px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 2px solid #010205; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 48px; height: 48px; border-radius: 12px; border: 1px solid #D8D8DB; display: flex; align-items: center; justify-content: center; font-weight: 600;">G</div>
            <div>
              <div style="font-size: 20px; font-weight: 600;">GRAVIUM</div>
              <div style="font-size: 12px; color: #6B6D70;">Payslip</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 600;">${MONTH_NAMES[month - 1]} ${year}</div>
            <div style="font-size: 12px; color: #6B6D70;">Pay Period</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #EEEFF2; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Employee Name</div><div style="font-weight: 600;">${empName}</div></div>
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Employee Code</div><div style="font-weight: 600; font-family: monospace;">${empCode}</div></div>
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Department</div><div>${empDept}</div></div>
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Email</div><div>${empEmail}</div></div>
          ${record ? `
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Days Present</div><div>${record.days_present}</div></div>
          <div><div style="font-size: 10px; color: #6B6D70; text-transform: uppercase; letter-spacing: 0.5px;">Days Absent</div><div>${record.days_absent}</div></div>
          ` : ''}
        </div>

        <div style="font-weight: 600; text-transform: uppercase; font-size: 12px; color: #6B6D70; margin: 16px 0 8px; letter-spacing: 0.5px;">Earnings</div>
        <div style="border: 1px solid #D8D8DB; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>Base Salary</span><span style="font-weight: 600;">${fmt(calc.base)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>KPI Incentive</span><span style="font-weight: 600;">${fmt(calc.kpiIncentive)}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 10px 16px; background: #EEEFF2; font-weight: 600;"><span>Total Earnings</span><span>${fmt(totalEarnings)}</span></div>
        </div>

        <div style="font-weight: 600; text-transform: uppercase; font-size: 12px; color: #6B6D70; margin: 16px 0 8px; letter-spacing: 0.5px;">Deductions</div>
        <div style="border: 1px solid #D8D8DB; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
          ${calc.tds > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>TDS (10%)</span><span>- ${fmt(calc.tds)}</span></div>` : ''}
          ${calc.pf > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>PF (12%)</span><span>- ${fmt(calc.pf)}</span></div>` : ''}
          ${calc.esi > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>ESI (0.75%)</span><span>- ${fmt(calc.esi)}</span></div>` : ''}
          ${calc.profTax > 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span>Professional Tax</span><span>- ${fmt(calc.profTax)}</span></div>` : ''}
          ${totalDeductions === 0 ? `<div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #D8D8DB;"><span style="color: #6B6D70;">No deductions applicable</span><span>—</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; padding: 10px 16px; background: #EEEFF2; font-weight: 600;"><span>Total Deductions</span><span>- ${fmt(totalDeductions)}</span></div>
        </div>

        <div style="border: 2px solid #010205; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-top: 20px; border-radius: 8px;">
          <span style="font-size: 18px; font-weight: 600;">Net Salary</span>
          <span style="font-size: 22px; font-weight: 700;">${fmt(calc.net)}</span>
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
          body { font-family: 'Montserrat', Arial, sans-serif; padding: 40px; color: #010205; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleSharePayslip = async () => {
    const htmlContent = generatePayslipHtml();
    const fullHtml = `
      <html>
      <head>
        <title>Payslip - ${employee?.full_name || 'Employee'}</title>
        <style>
          body { font-family: 'Montserrat', Arial, sans-serif; padding: 40px; color: #010205; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

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
      } catch {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <PModal
      open={open}
      onDismiss={onDismiss}
      heading="Payslip"
      aria={{ 'aria-label': 'Employee payslip' }}
    >
      <div id="payslip-print-area" className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-contrast-low pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-canvas border border-contrast-low flex items-center justify-center flex-shrink-0">
              <PText size="small" weight="semi-bold">G</PText>
            </div>
            <div>
              <PHeading tag="h2" size="medium">GRAVIUM</PHeading>
              <PText size="x-small" color="contrast-medium">Payslip</PText>
            </div>
          </div>
          <div className="text-right">
            <PText size="small" weight="semi-bold">{MONTH_NAMES[month - 1]} {year}</PText>
            <PText size="x-small" color="contrast-medium">Pay Period</PText>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 bg-surface rounded-lg border border-contrast-low p-4">
          <div>
            <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Employee Name</PText>
            <PText size="small" weight="semi-bold">{employee.full_name || '—'}</PText>
          </div>
          <div>
            <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Employee Code</PText>
            <PText size="small" weight="semi-bold" className="font-mono">{employee.employee_code || '—'}</PText>
          </div>
          <div>
            <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Department</PText>
            <PText size="small">{employee.departmentNames.join(', ') || '—'}</PText>
          </div>
          <div>
            <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Email</PText>
            <PText size="small">{employee.email}</PText>
          </div>
          {record && (
            <>
              <div>
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Days Present</PText>
                <PText size="small">{record.days_present}</PText>
              </div>
              <div>
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wide">Days Absent</PText>
                <PText size="small">{record.days_absent}</PText>
              </div>
            </>
          )}
        </div>

        {/* Earnings */}
        <div>
          <PText size="x-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide mb-2">
            Earnings
          </PText>
          <div className="bg-surface rounded-lg border border-contrast-low overflow-hidden">
            <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
              <PText size="small">Base Salary</PText>
              <PText size="small" weight="semi-bold">{formatINR(calc.base)}</PText>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
              <PText size="small">KPI Incentive</PText>
              <PText size="small" weight="semi-bold">{formatINR(calc.kpiIncentive)}</PText>
            </div>
            <div className="flex justify-between px-4 py-2.5 bg-canvas">
              <PText size="small" weight="semi-bold">Total Earnings</PText>
              <PText size="small" weight="semi-bold">{formatINR(totalEarnings)}</PText>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <PText size="x-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide mb-2">
            Deductions
          </PText>
          <div className="bg-surface rounded-lg border border-contrast-low overflow-hidden">
            {calc.tds > 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
                <PText size="small">TDS (10%)</PText>
                <PText size="small">- {formatINR(calc.tds)}</PText>
              </div>
            )}
            {calc.pf > 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
                <PText size="small">PF (12%)</PText>
                <PText size="small">- {formatINR(calc.pf)}</PText>
              </div>
            )}
            {calc.esi > 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
                <PText size="small">ESI (0.75%)</PText>
                <PText size="small">- {formatINR(calc.esi)}</PText>
              </div>
            )}
            {calc.profTax > 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
                <PText size="small">Professional Tax</PText>
                <PText size="small">- {formatINR(calc.profTax)}</PText>
              </div>
            )}
            {totalDeductions === 0 && (
              <div className="flex justify-between px-4 py-2.5 border-b border-contrast-low">
                <PText size="small" color="contrast-medium">No deductions applicable</PText>
                <PText size="small">—</PText>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5 bg-canvas">
              <PText size="small" weight="semi-bold">Total Deductions</PText>
              <PText size="small" weight="semi-bold">- {formatINR(totalDeductions)}</PText>
            </div>
          </div>
        </div>

        {/* Net Salary */}
        <div className="flex items-center justify-between bg-canvas rounded-xl border-2 border-contrast-high px-5 py-4">
          <PHeading tag="h3" size="medium">Net Salary</PHeading>
          <PHeading tag="h3" size="large">{formatINR(calc.net)}</PHeading>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-1">
          <PButton variant="secondary" onClick={onDismiss}>Close</PButton>
          <PButton
            icon="download"
            onClick={handlePrintPayslip}
          >
            Download PDF
          </PButton>
          <PButton
            icon="share"
            onClick={handleSharePayslip}
          >
            Share
          </PButton>
        </div>
      </div>
    </PModal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  // ─── Access guard ──────────────────────────────────────────────────────────

  const hasAccess = isAdmin() || isFinance();

  // ─── Fetch employees ───────────────────────────────────────────────────────

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

  // ─── Fetch payroll for selected period ─────────────────────────────────────

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

  // ─── Fetch attendance for selected period ──────────────────────────────────

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

  // ─── Attendance summaries ──────────────────────────────────────────────────

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

  // ─── Payroll rows ──────────────────────────────────────────────────────────

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

  // ─── Process payroll ────────────────────────────────────────────────────────

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

  // ─── Mark as paid ────────────────────────────────────────────────────────────

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

  // ─── Open edit modal ─────────────────────────────────────────────────────────

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

  // ─── Generate payslip ────────────────────────────────────────────────────────

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

  // ─── Attendance override ──────────────────────────────────────────────────────

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

  // ─── Access denied ────────────────────────────────────────────────────────────

  if (!currentProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <PText color="contrast-medium">Loading…</PText>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-xl mx-auto mt-20">
        <PInlineNotification
          heading="Access Denied"
          description="You do not have permission to view this page. Only Finance department members or Super Admins can access Payroll."
          state="error"
          dismissButton={false}
        />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const isLoading = loadingEmployees || loadingPayroll || loadingAttendance;

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Payroll</PHeading>
          <PText color="contrast-medium">Manage employee salaries and payslips</PText>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Month select */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="form-input text-sm"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          {/* Year input */}
          <input
            type="number"
            value={selectedYear}
            min={2020}
            max={2099}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="form-input text-sm w-24"
          />
        </div>
      </div>

      {/* ── Department filter tabs ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterDeptId('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            filterDeptId === 'all'
              ? 'bg-canvas border-contrast-high text-primary'
              : 'bg-surface border-contrast-low text-contrast-medium hover:border-contrast-medium'
          }`}
        >
          All Departments
        </button>
        {departments.map((dept: Department) => (
          <button
            key={dept.id}
            onClick={() => setFilterDeptId(dept.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filterDeptId === dept.id
                ? 'bg-canvas border-contrast-high text-primary'
                : 'bg-surface border-contrast-low text-contrast-medium hover:border-contrast-medium'
            }`}
          >
            {dept.code}
          </button>
        ))}
      </div>

      {/* ── Global notifications ── */}
      {error && (
        <div className="mb-4">
          <PInlineNotification
            heading="Error"
            description={error}
            state="error"
            dismissButton
            onDismiss={() => setError('')}
          />
        </div>
      )}
      {successMsg && (
        <div className="mb-4">
          <PInlineNotification
            heading="Success"
            description={successMsg}
            state="success"
            dismissButton
            onDismiss={() => setSuccessMsg('')}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <PText color="contrast-medium">Loading payroll data…</PText>
        </div>
      ) : (
        <>
          {/* ── Attendance Overview ─────────────────────────────────────────── */}
          <section className="mb-10">
            <PHeading tag="h2" size="medium" className="mb-4">
              Attendance Overview — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </PHeading>

            {attendanceSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 bg-surface rounded-xl border border-contrast-low">
                <PIcon name="user" size="large" color="contrast-low" />
                <PText color="contrast-medium" className="mt-2">No employees found.</PText>
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <TableHead
                      cols={['Employee', 'Department', 'Present', 'Absent', 'Leave', 'Weekend/Holiday', 'Override']}
                    />
                    <tbody>
                      {attendanceSummaries.map(summary => (
                        <tr
                          key={summary.employee.id}
                          className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-contrast-low flex items-center justify-center flex-shrink-0">
                                <PText size="xx-small" weight="semi-bold">
                                  {(summary.employee.full_name || summary.employee.email || '?')[0].toUpperCase()}
                                </PText>
                              </div>
                              <div>
                                <PText size="small" weight="semi-bold">{summary.employee.full_name || '—'}</PText>
                                <PText size="xx-small" color="contrast-medium" className="font-mono">
                                  {summary.employee.employee_code || '—'}
                                </PText>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {summary.employee.departmentNames.length > 0
                                ? summary.employee.departmentNames.map(n => (
                                    <span key={n} className="text-xs px-2 py-0.5 rounded-full bg-contrast-low text-contrast-high">
                                      {n}
                                    </span>
                                  ))
                                : <PText size="x-small" color="contrast-low">—</PText>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <PTag color="notification-success-soft">{summary.daysPresent}</PTag>
                          </td>
                          <td className="px-4 py-3">
                            <PTag color={summary.daysAbsent > 0 ? 'notification-error-soft' : 'background-surface'}>
                              {summary.daysAbsent}
                            </PTag>
                          </td>
                          <td className="px-4 py-3">
                            <PTag color={summary.daysLeave > 0 ? 'notification-warning-soft' : 'background-surface'}>
                              {summary.daysLeave}
                            </PTag>
                          </td>
                          <td className="px-4 py-3">
                            <PTag color="notification-info-soft">{summary.daysWeekendHoliday}</PTag>
                          </td>
                          <td className="px-4 py-3">
                            <PButton
                              variant="secondary"
                              icon="edit"
                              onClick={() => openOverride(summary.employee)}
                            >
                              Override
                            </PButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── Salary Table ────────────────────────────────────────────────── */}
          <section>
            <PHeading tag="h2" size="medium" className="mb-4">
              Salary Table — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </PHeading>

            {payrollRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 bg-surface rounded-xl border border-contrast-low">
                <PIcon name="calculator" size="large" color="contrast-low" />
                <PText color="contrast-medium" className="mt-2">No employees found.</PText>
              </div>
            ) : (
              <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
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
                          <tr
                            key={employee.id}
                            className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors"
                          >
                            {/* Employee */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-contrast-low flex items-center justify-center flex-shrink-0">
                                  <PText size="xx-small" weight="semi-bold">
                                    {(employee.full_name || employee.email || '?')[0].toUpperCase()}
                                  </PText>
                                </div>
                                <div>
                                  <PText size="small" weight="semi-bold">{employee.full_name || '—'}</PText>
                                  <PText size="xx-small" color="contrast-medium" className="font-mono">
                                    {employee.employee_code || '—'}
                                  </PText>
                                </div>
                              </div>
                            </td>

                            {/* Base Salary */}
                            <td className="px-4 py-3">
                              <PText size="small">{formatINR(displayCalc.base)}</PText>
                            </td>

                            {/* KPI Incentive */}
                            <td className="px-4 py-3">
                              <PText size="small" color={displayCalc.kpiIncentive > 0 ? 'notification-success' : 'contrast-medium'}>
                                {formatINR(displayCalc.kpiIncentive)}
                              </PText>
                            </td>

                            {/* TDS */}
                            <td className="px-4 py-3">
                              <PText size="small" color={displayCalc.tds > 0 ? 'notification-error' : 'contrast-low'}>
                                {displayCalc.tds > 0 ? `- ${formatINR(displayCalc.tds)}` : '—'}
                              </PText>
                            </td>

                            {/* PF */}
                            <td className="px-4 py-3">
                              <PText size="small" color={displayCalc.pf > 0 ? 'notification-error' : 'contrast-low'}>
                                {displayCalc.pf > 0 ? `- ${formatINR(displayCalc.pf)}` : '—'}
                              </PText>
                            </td>

                            {/* ESI */}
                            <td className="px-4 py-3">
                              <PText size="small" color={displayCalc.esi > 0 ? 'notification-error' : 'contrast-low'}>
                                {displayCalc.esi > 0 ? `- ${formatINR(displayCalc.esi)}` : '—'}
                              </PText>
                            </td>

                            {/* Prof Tax */}
                            <td className="px-4 py-3">
                              <PText size="small" color={displayCalc.profTax > 0 ? 'notification-error' : 'contrast-low'}>
                                {displayCalc.profTax > 0 ? `- ${formatINR(displayCalc.profTax)}` : '—'}
                              </PText>
                            </td>

                            {/* Net Salary */}
                            <td className="px-4 py-3">
                              <PText size="small" weight="semi-bold">{formatINR(displayCalc.net)}</PText>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              {record ? (
                                <PTag color={STATUS_COLORS[record.status]}>{record.status}</PTag>
                              ) : (
                                <PTag color="background-surface">—</PTag>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-nowrap">
                                {/* Process button */}
                                {(!record || record.status === 'Draft') && (
                                  <PButton
                                    variant="primary"
                                    loading={isProcessing}
                                    disabled={isProcessing}
                                    onClick={() => handleProcess(employee)}
                                  >
                                    {record ? 'Re-Process' : 'Process'}
                                  </PButton>
                                )}

                                {/* Mark as Paid button — only if record exists and is Processed */}
                                {record && record.status === 'Processed' && (
                                  <PButton
                                    variant="primary"
                                    loading={isProcessing}
                                    disabled={isProcessing}
                                    onClick={() => handleMarkPaid(record)}
                                  >
                                    Mark Paid
                                  </PButton>
                                )}

                                {/* Edit button — only if record exists */}
                                {record && (
                                  <button
                                    onClick={() => openEdit(record)}
                                    className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                                    title="Edit payroll"
                                  >
                                    <PIcon name="edit" size="x-small" />
                                  </button>
                                )}

                                {/* Generate payslip */}
                                <button
                                  onClick={() => handleGeneratePayslip(employee, record)}
                                  className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                                  title="Generate payslip"
                                >
                                  <PIcon name="document" size="x-small" color={record?.payslip_generated ? 'notification-success' : 'inherit'} />
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

      {/* ── Edit Payroll Modal ── */}
      <PModal
        open={!!editRecord}
        onDismiss={() => setEditRecord(null)}
        heading="Edit Payroll Entry"
        aria={{ 'aria-label': 'Edit payroll entry' }}
      >
        <form onSubmit={handleEditSave} className="flex flex-col gap-5">
          <button type="submit" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} aria-hidden="true" tabIndex={-1} />
          {editError && (
            <PInlineNotification
              heading="Error"
              description={editError}
              state="error"
              dismissButton={false}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Base Salary (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.base_salary}
                onChange={e => setEditForm(f => ({ ...f, base_salary: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="KPI Incentive (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.kpi_incentive}
                onChange={e => setEditForm(f => ({ ...f, kpi_incentive: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="TDS Deduction (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.tds_deduction}
                onChange={e => setEditForm(f => ({ ...f, tds_deduction: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="PF Deduction (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.pf_deduction}
                onChange={e => setEditForm(f => ({ ...f, pf_deduction: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="ESI Deduction (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.esi_deduction}
                onChange={e => setEditForm(f => ({ ...f, esi_deduction: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label="Professional Tax (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.professional_tax_deduction}
                onChange={e => setEditForm(f => ({ ...f, professional_tax_deduction: e.target.value }))}
                className="form-input"
              />
            </FormField>
          </div>

          {/* Computed net salary preview */}
          <div className="flex items-center justify-between bg-canvas rounded-lg border border-contrast-low px-4 py-3">
            <PText size="small" color="contrast-medium">Computed Net Salary</PText>
            <PText size="small" weight="semi-bold">
              {formatINR(
                (parseFloat(editForm.base_salary) || 0) +
                  (parseFloat(editForm.kpi_incentive) || 0) -
                  (parseFloat(editForm.tds_deduction) || 0) -
                  (parseFloat(editForm.pf_deduction) || 0) -
                  (parseFloat(editForm.esi_deduction) || 0) -
                  (parseFloat(editForm.professional_tax_deduction) || 0)
              )}
            </PText>
          </div>

          <FormField label="Status">
            <select
              value={editForm.status}
              onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Payroll['status'] }))}
              className="form-input"
            >
              <option value="Draft">Draft</option>
              <option value="Processed">Processed</option>
              <option value="Paid">Paid</option>
            </select>
          </FormField>

          <div className="flex gap-3 justify-end pt-1">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setEditRecord(null)}
              disabled={editSaving}
            >
              Cancel
            </PButton>
            <PButton type="submit" loading={editSaving} disabled={editSaving}>
              Save Changes
            </PButton>
          </div>
        </form>
      </PModal>

      {/* ── Attendance Override Modal ── */}
      <PModal
        open={showOverride}
        onDismiss={() => setShowOverride(false)}
        heading="Override Attendance"
        aria={{ 'aria-label': 'Override attendance' }}
      >
        <form onSubmit={handleOverrideSave} className="flex flex-col gap-5">
          <button type="submit" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} aria-hidden="true" tabIndex={-1} />
          {overrideError && (
            <PInlineNotification
              heading="Error"
              description={overrideError}
              state="error"
              dismissButton={false}
            />
          )}

          <FormField label="Employee">
            <select
              value={overrideForm.employeeId}
              onChange={e => setOverrideForm(f => ({ ...f, employeeId: e.target.value }))}
              className="form-input"
              required
            >
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name || emp.email} ({emp.employee_code || '—'})
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
              onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))}
              className="form-input"
              required
            />
          </FormField>

          <FormField label="Attendance Status">
            <select
              value={overrideForm.status}
              onChange={e => setOverrideForm(f => ({ ...f, status: e.target.value as AttendanceStatus }))}
              className="form-input"
            >
              {ATTENDANCE_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <div className="flex gap-3 justify-end pt-1">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setShowOverride(false)}
              disabled={overrideSaving}
            >
              Cancel
            </PButton>
            <PButton type="submit" loading={overrideSaving} disabled={overrideSaving}>
              Save Override
            </PButton>
          </div>
        </form>
      </PModal>

      {/* ── Payslip Modal ── */}
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
