import { useState } from 'react';
import { supabase, formatINR } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlertTriangle,
  Calculator,
  CheckCircle,
  CreditCard,
  Download,
  FileText,
  FolderKanban,
  Info,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { DateInput } from '../../components/common/DateInput';

// ——— Types ————————————————————————————————————————————————————————————————————

type ReportKey = 'leads' | 'projects' | 'financials' | 'payroll';

interface ReportState {
  loading: boolean;
  success: string;
  error: string;
}

const defaultReportState: ReportState = {
  loading: false,
  success: '',
  error: '',
};

// ——— CSV Helper ———————————————————————————————————————————————————————————————

function objectsToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(',')),
  ];
  return lines.join('\n');
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();

    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const REPORT_PDF_BRAND = {
  wordmarkPath: '/brand/gravium-wordmark-light.png',
  wordmarkWidth: 42,
  wordmarkHeight: 10,
};

const REPORT_PDF_CURRENCY_COLUMNS = new Set([
  'Revenue',
  'Est. COGS',
  'Est. Profit',
  'Actual COGS (Expenses)',
  'Net Profit',
  'Design Fee',
  'Total Cash Received',
  'Outstanding',
  'Base Salary',
  'KPI Incentive',
  'TDS Deduction',
  'PF Deduction',
  'ESI Deduction',
  'Professional Tax',
  'Total Deductions',
  'Net Salary',
]);

function formatPdfCell(value: unknown, column?: string): string {
  if (value == null) return '';

  if (typeof value === 'number') {
    const formatted = value.toLocaleString('en-IN');
    return column && REPORT_PDF_CURRENCY_COLUMNS.has(column) ? `INR ${formatted}` : formatted;
  }

  return String(value);
}

async function downloadReportPDF({
  title,
  dateRange,
  rows,
  filename,
}: {
  title: string;
  dateRange: string;
  rows: Record<string, unknown>[];
  filename: string;
}) {
  if (rows.length === 0) {
    throw new Error('No rows available for PDF export.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const wordmark = await loadImageAsDataUrl(REPORT_PDF_BRAND.wordmarkPath);

  const headerTop = 11;
  const headerRight = pageWidth - 14;

  if (wordmark) {
    doc.addImage(
      wordmark,
      'PNG',
      14,
      headerTop,
      REPORT_PDF_BRAND.wordmarkWidth,
      REPORT_PDF_BRAND.wordmarkHeight,
    );
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('GRAVIUM', 14, headerTop + 7);
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.text(title, headerRight, headerTop + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Date Range: ${dateRange}`, headerRight, headerTop + 11, { align: 'right' });
  doc.text(`Generated: ${generatedAt}`, headerRight, headerTop + 16, { align: 'right' });

  doc.setDrawColor(230, 230, 230);
  doc.line(14, 33, pageWidth - 14, 33);

  const columns = Object.keys(rows[0]);
  const body = rows.map(row => columns.map(column => formatPdfCell(row[column], column)));

  autoTable(doc, {
    head: [columns],
    body,
    startY: 42,
    margin: { left: 14, right: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [47, 47, 47],
      textColor: [245, 245, 245],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  });

  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Gravium Design Studio - Internal Report', 14, pageHeight - 10);
    doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 34, pageHeight - 10);
  }

  doc.save(filename);
}


// ——— Main Component ———————————————————————————————————————————————————————————

export default function Reports() {
  const { isAdmin, isFinance } = useAuth();
  const canAccessSensitive = isAdmin() || isFinance();

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const [states, setStates] = useState<Record<ReportKey, ReportState>>({
    leads: { ...defaultReportState },
    projects: { ...defaultReportState },
    financials: { ...defaultReportState },
    payroll: { ...defaultReportState },
  });

  const setReportState = (key: ReportKey, patch: Partial<ReportState>) => {
    setStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  // —— Date range end-of-day —————————————————————————————————————————————————

  const rangeEnd = endDate ? `${endDate}T23:59:59` : undefined;
  const rangeStart = startDate ? `${startDate}T00:00:00` : undefined;

  const fetchReportRows = async (key: ReportKey): Promise<Record<string, unknown>[]> => {
    if (key === 'leads') {
      let query = supabase
        .from('leads')
        .select('name, contact_email, contact_phone, lead_source, lead_source_custom, status, assigned_to, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: leads, error: leadsErr } = await query;
      if (leadsErr) throw new Error(leadsErr.message);
      if (!leads || leads.length === 0) throw new Error('No leads found for the selected date range.');

      const assigneeIds = [...new Set(leads.map(lead => lead.assigned_to).filter(Boolean))];
      const assigneeMap: Record<string, string> = {};

      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assigneeIds as string[]);

        (profiles || []).forEach((profile: { id: string; full_name: string }) => {
          assigneeMap[profile.id] = profile.full_name;
        });
      }

      return leads.map(lead => ({
        Name: lead.name,
        Email: lead.contact_email || '',
        Phone: lead.contact_phone || '',
        Source: lead.lead_source === 'Other' && lead.lead_source_custom ? lead.lead_source_custom : (lead.lead_source || ''),
        Status: lead.status,
        'Assigned To': lead.assigned_to ? (assigneeMap[lead.assigned_to] || lead.assigned_to) : '',
        Date: lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN') : '',
      }));
    }

    if (key === 'projects') {
      let query = supabase
        .from('projects')
        .select('name, client, status, revenue, estimated_cogs, design_fee_pct, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: projects, error: projErr } = await query;
      if (projErr) throw new Error(projErr.message);
      if (!projects || projects.length === 0) throw new Error('No projects found for the selected date range.');

      return projects.map(project => {
        const revenue = project.revenue ?? 0;
        const cogs = project.estimated_cogs ?? 0;

        return {
          Name: project.name,
          Client: project.client,
          Status: project.status,
          Revenue: revenue,
          'Est. COGS': cogs,
          'Est. Profit': revenue - cogs,
          'Design Fee %': project.design_fee_pct ?? 0,
          Date: project.created_at ? new Date(project.created_at).toLocaleDateString('en-IN') : '',
        };
      });
    }

    if (key === 'financials') {
      let query = supabase
        .from('projects')
        .select('id, name, client, status, revenue, estimated_cogs, design_fee_pct, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: projects, error: projErr } = await query;
      if (projErr) throw new Error(projErr.message);
      if (!projects || projects.length === 0) throw new Error('No projects found for the selected date range.');

      const projectIds = projects.map(project => project.id);

      const { data: expenses, error: expErr } = await supabase
        .from('project_expenses')
        .select('project_id, amount')
        .in('project_id', projectIds);
      if (expErr) throw new Error(expErr.message);

      const { data: cashReceived, error: cashErr } = await supabase
        .from('project_cash_received')
        .select('project_id, amount')
        .in('project_id', projectIds);
      if (cashErr) throw new Error(cashErr.message);

      const expenseByProject: Record<string, number> = {};
      (expenses || []).forEach((expense: { project_id: string; amount: number }) => {
        expenseByProject[expense.project_id] = (expenseByProject[expense.project_id] || 0) + (expense.amount ?? 0);
      });

      const cashByProject: Record<string, number> = {};
      (cashReceived || []).forEach((cash: { project_id: string; amount: number }) => {
        cashByProject[cash.project_id] = (cashByProject[cash.project_id] || 0) + (cash.amount ?? 0);
      });

      return projects.map(project => {
        const revenue = project.revenue ?? 0;
        const estimatedCogs = project.estimated_cogs ?? 0;
        const actualCogs = expenseByProject[project.id] ?? 0;
        const totalCash = cashByProject[project.id] ?? 0;

        return {
          Name: project.name,
          Client: project.client,
          Status: project.status,
          Revenue: revenue,
          'Est. COGS': estimatedCogs,
          'Actual COGS (Expenses)': actualCogs,
          'Net Profit': revenue - actualCogs,
          'Design Fee': ((project.design_fee_pct ?? 0) / 100) * revenue,
          'Total Cash Received': totalCash,
          Outstanding: Math.max(0, revenue - totalCash),
          Date: project.created_at ? new Date(project.created_at).toLocaleDateString('en-IN') : '',
        };
      });
    }

    let query = supabase
      .from('payroll')
      .select('employee_id, month, year, base_salary, kpi_incentive, tds_deduction, pf_deduction, esi_deduction, professional_tax_deduction, net_salary, days_present, days_absent, status')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    const startYear = startDate ? new Date(startDate).getFullYear() : undefined;
    const endYear = endDate ? new Date(endDate).getFullYear() : undefined;
    const startMonth = startDate ? new Date(startDate).getMonth() + 1 : undefined;
    const endMonth = endDate ? new Date(endDate).getMonth() + 1 : undefined;

    if (startYear !== undefined) query = query.gte('year', startYear);
    if (endYear !== undefined) query = query.lte('year', endYear);

    const { data: payroll, error: payrollErr } = await query;
    if (payrollErr) throw new Error(payrollErr.message);
    if (!payroll || payroll.length === 0) throw new Error('No payroll records found for the selected period.');

    const filtered = payroll.filter(record => {
      if (startYear !== undefined && endYear !== undefined && startYear === endYear) {
        return record.month >= (startMonth ?? 1) && record.month <= (endMonth ?? 12);
      }

      if (record.year === startYear && startMonth !== undefined) return record.month >= startMonth;
      if (record.year === endYear && endMonth !== undefined) return record.month <= endMonth;

      return true;
    });

    if (filtered.length === 0) throw new Error('No payroll records found for the selected period.');

    const employeeIds = [...new Set(filtered.map(record => record.employee_id).filter(Boolean))];
    const employeeMap: Record<string, string> = {};

    if (employeeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', employeeIds as string[]);

      (profiles || []).forEach((profile: { id: string; full_name: string }) => {
        employeeMap[profile.id] = profile.full_name;
      });
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return filtered.map(record => {
      const totalDeductions =
        (record.tds_deduction ?? 0) +
        (record.pf_deduction ?? 0) +
        (record.esi_deduction ?? 0) +
        (record.professional_tax_deduction ?? 0);

      return {
        'Employee Name': record.employee_id ? (employeeMap[record.employee_id] || record.employee_id) : '',
        Month: monthNames[(record.month ?? 1) - 1] || '',
        Year: String(record.year ?? ''),
        'Base Salary': record.base_salary ?? 0,
        'KPI Incentive': record.kpi_incentive ?? 0,
        'TDS Deduction': record.tds_deduction ?? 0,
        'PF Deduction': record.pf_deduction ?? 0,
        'ESI Deduction': record.esi_deduction ?? 0,
        'Professional Tax': record.professional_tax_deduction ?? 0,
        'Total Deductions': totalDeductions,
        'Net Salary': record.net_salary ?? 0,
        'Days Present': record.days_present ?? 0,
        'Days Absent': record.days_absent ?? 0,
        Status: record.status ?? '',
      };
    });
  };


  // —— Leads Export ——————————————————————————————————————————————————————————

  const exportLeads = async () => {
    setReportState('leads', { loading: true, success: '', error: '' });
    try {
      let query = supabase
        .from('leads')
        .select('name, contact_email, contact_phone, lead_source, lead_source_custom, status, assigned_to, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: leads, error: leadsErr } = await query;
      if (leadsErr) throw new Error(leadsErr.message);
      if (!leads || leads.length === 0) throw new Error('No leads found for the selected date range.');

      // Fetch assignee names
      const assigneeIds = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))];
      const assigneeMap: Record<string, string> = {};
      if (assigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', assigneeIds as string[]);
        (profiles || []).forEach((p: { id: string; full_name: string }) => {
          assigneeMap[p.id] = p.full_name;
        });
      }

      const rows = leads.map(l => ({
        Name: l.name,
        Email: l.contact_email || '',
        Phone: l.contact_phone || '',
        Source: l.lead_source === 'Other' && l.lead_source_custom ? l.lead_source_custom : (l.lead_source || ''),
        Status: l.status,
        'Assigned To': l.assigned_to ? (assigneeMap[l.assigned_to] || l.assigned_to) : '',
        Date: l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN') : '',
      }));

      const csv = objectsToCSV(rows);
      downloadCSV(csv, `leads-report-${startDate}-to-${endDate}.csv`);
      setReportState('leads', { loading: false, success: `Exported ${rows.length} lead(s) successfully.`, error: '' });
    } catch (e) {
      setReportState('leads', { loading: false, success: '', error: (e as Error).message });
    }
  };

  // —— Projects Export ———————————————————————————————————————————————————————

  const exportProjects = async () => {
    setReportState('projects', { loading: true, success: '', error: '' });
    try {
      let query = supabase
        .from('projects')
        .select('name, client, status, revenue, estimated_cogs, design_fee_pct, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: projects, error: projErr } = await query;
      if (projErr) throw new Error(projErr.message);
      if (!projects || projects.length === 0) throw new Error('No projects found for the selected date range.');

      const rows = projects.map(p => {
        const revenue = p.revenue ?? 0;
        const cogs = p.estimated_cogs ?? 0;
        const profit = revenue - cogs;
        return {
          Name: p.name,
          Client: p.client,
          Status: p.status,
          Revenue: revenue,
          'Est. COGS': cogs,
          'Est. Profit': profit,
          'Design Fee %': p.design_fee_pct ?? 0,
          Date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '',
        };
      });

      const csv = objectsToCSV(rows);
      downloadCSV(csv, `projects-report-${startDate}-to-${endDate}.csv`);
      setReportState('projects', { loading: false, success: `Exported ${rows.length} project(s) successfully.`, error: '' });
    } catch (e) {
      setReportState('projects', { loading: false, success: '', error: (e as Error).message });
    }
  };

  // —— Financials Export —————————————————————————————————————————————————————

  const exportFinancials = async () => {
    setReportState('financials', { loading: true, success: '', error: '' });
    try {
      let query = supabase
        .from('projects')
        .select('id, name, client, status, revenue, estimated_cogs, design_fee_pct, created_at')
        .order('created_at', { ascending: false });

      if (rangeStart) query = query.gte('created_at', rangeStart);
      if (rangeEnd) query = query.lte('created_at', rangeEnd);

      const { data: projects, error: projErr } = await query;
      if (projErr) throw new Error(projErr.message);
      if (!projects || projects.length === 0) throw new Error('No projects found for the selected date range.');

      // Fetch expenses for all matching projects
      const projectIds = projects.map(p => p.id);
      const { data: expenses, error: expErr } = await supabase
        .from('project_expenses')
        .select('project_id, amount')
        .in('project_id', projectIds);
      if (expErr) throw new Error(expErr.message);

      // Fetch cash received
      const { data: cashReceived, error: cashErr } = await supabase
        .from('project_cash_received')
        .select('project_id, amount')
        .in('project_id', projectIds);
      if (cashErr) throw new Error(cashErr.message);

      // Aggregate per project
      const expenseByProject: Record<string, number> = {};
      (expenses || []).forEach((e: { project_id: string; amount: number }) => {
        expenseByProject[e.project_id] = (expenseByProject[e.project_id] || 0) + (e.amount ?? 0);
      });

      const cashByProject: Record<string, number> = {};
      (cashReceived || []).forEach((c: { project_id: string; amount: number }) => {
        cashByProject[c.project_id] = (cashByProject[c.project_id] || 0) + (c.amount ?? 0);
      });

      const rows = projects.map(p => {
        const revenue = p.revenue ?? 0;
        const estimatedCogs = p.estimated_cogs ?? 0;
        const actualCogs = expenseByProject[p.id] ?? 0;
        const totalCash = cashByProject[p.id] ?? 0;
        const profit = revenue - actualCogs;
        const designFee = ((p.design_fee_pct ?? 0) / 100) * revenue;
        const outstanding = Math.max(0, revenue - totalCash);

        return {
          Name: p.name,
          Client: p.client,
          Status: p.status,
          Revenue: revenue,
          'Est. COGS': estimatedCogs,
          'Actual COGS (Expenses)': actualCogs,
          'Net Profit': profit,
          'Design Fee': designFee,
          'Total Cash Received': totalCash,
          Outstanding: outstanding,
          Date: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '',
        };
      });

      const csv = objectsToCSV(rows);
      downloadCSV(csv, `financials-report-${startDate}-to-${endDate}.csv`);
      const totalRev = rows.reduce((s, r) => s + (r.Revenue as number), 0);
      setReportState('financials', { loading: false, success: `Exported ${rows.length} project(s). Total revenue: ${formatINR(totalRev)}.`, error: '' });
    } catch (e) {
      setReportState('financials', { loading: false, success: '', error: (e as Error).message });
    }
  };

  // —— Payroll Export ————————————————————————————————————————————————————————

  const exportPayroll = async () => {
    setReportState('payroll', { loading: true, success: '', error: '' });
    try {
      // Filter by year range derived from date inputs
      const startYear = startDate ? new Date(startDate).getFullYear() : undefined;
      const endYear = endDate ? new Date(endDate).getFullYear() : undefined;
      const startMonth = startDate ? new Date(startDate).getMonth() + 1 : undefined;
      const endMonth = endDate ? new Date(endDate).getMonth() + 1 : undefined;

      let query = supabase
        .from('payroll')
        .select('employee_id, month, year, base_salary, kpi_incentive, tds_deduction, pf_deduction, esi_deduction, professional_tax_deduction, net_salary, days_present, days_absent, status')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (startYear !== undefined) query = query.gte('year', startYear);
      if (endYear !== undefined) query = query.lte('year', endYear);

      const { data: payroll, error: payrollErr } = await query;
      if (payrollErr) throw new Error(payrollErr.message);
      if (!payroll || payroll.length === 0) throw new Error('No payroll records found for the selected period.');

      // Filter by month within the year range
      const filtered = payroll.filter(r => {
        if (startYear !== undefined && endYear !== undefined && startYear === endYear) {
          return r.month >= (startMonth ?? 1) && r.month <= (endMonth ?? 12);
        }
        if (r.year === startYear && startMonth !== undefined) return r.month >= startMonth;
        if (r.year === endYear && endMonth !== undefined) return r.month <= endMonth;
        return true;
      });

      if (filtered.length === 0) throw new Error('No payroll records found for the selected period.');

      // Fetch employee names
      const employeeIds = [...new Set(filtered.map(r => r.employee_id).filter(Boolean))];
      const employeeMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', employeeIds as string[]);
        (profiles || []).forEach((p: { id: string; full_name: string }) => {
          employeeMap[p.id] = p.full_name;
        });
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const rows = filtered.map(r => {
        const totalDeductions = (r.tds_deduction ?? 0) + (r.pf_deduction ?? 0) + (r.esi_deduction ?? 0) + (r.professional_tax_deduction ?? 0);
        return {
          'Employee Name': r.employee_id ? (employeeMap[r.employee_id] || r.employee_id) : '',
          Month: monthNames[(r.month ?? 1) - 1] || '',
          Year: String(r.year ?? ''),
          'Base Salary': r.base_salary ?? 0,
          'KPI Incentive': r.kpi_incentive ?? 0,
          'TDS Deduction': r.tds_deduction ?? 0,
          'PF Deduction': r.pf_deduction ?? 0,
          'ESI Deduction': r.esi_deduction ?? 0,
          'Professional Tax': r.professional_tax_deduction ?? 0,
          'Total Deductions': totalDeductions,
          'Net Salary': r.net_salary ?? 0,
          'Days Present': r.days_present ?? 0,
          'Days Absent': r.days_absent ?? 0,
          Status: r.status ?? '',
        };
      });

      const csv = objectsToCSV(rows);
      downloadCSV(csv, `payroll-report-${startDate}-to-${endDate}.csv`);
      setReportState('payroll', { loading: false, success: `Exported ${rows.length} payroll record(s) successfully.`, error: '' });
    } catch (e) {
      setReportState('payroll', { loading: false, success: '', error: (e as Error).message });
    }
  };

  // ——— Report Cards Config ——————————————————————————————————————————————————

  const exportReportPdf = async (card: { key: ReportKey; label: string }) => {
    setReportState(card.key, { loading: true, success: '', error: '' });

    try {
      const rows = await fetchReportRows(card.key);

      await downloadReportPDF({
        title: card.label,
        dateRange: `${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}`,
        rows,
        filename: `${card.key}-report-${startDate}-to-${endDate}.pdf`,
      });

      setReportState(card.key, {
        loading: false,
        success: `Exported ${rows.length} row(s) as PDF successfully.`,
        error: '',
      });
    } catch (error) {
      setReportState(card.key, {
        loading: false,
        success: '',
        error: (error as Error).message,
      });
    }
  };

  const reportCards: {
    key: ReportKey;
    label: string;
    description: string;
    icon: string;
    columns: string[];
    onExport: () => Promise<void>;
    onExportPdf: () => Promise<void>;
    restricted: boolean;
  }[] = [
    {
      key: 'leads',
      label: 'Leads Report',
      description: 'All CRM leads with contact info, source, status and assignee.',
      icon: 'arrow-right',
      columns: ['Name', 'Email', 'Phone', 'Source', 'Status', 'Assigned To', 'Date'],
      onExport: exportLeads,
      onExportPdf: () => exportReportPdf({ key: 'leads', label: 'Leads Report' }),
      restricted: false,
    },
    {
      key: 'projects',
      label: 'Projects Report',
      description: 'Projects list with client, status, revenue and estimated profit.',
      icon: 'configurate',
      columns: ['Name', 'Client', 'Status', 'Revenue', 'Est. COGS', 'Est. Profit', 'Date'],
      onExport: exportProjects,
      onExportPdf: () => exportReportPdf({ key: 'projects', label: 'Projects Report' }),
      restricted: false,
    },
    {
      key: 'financials',
      label: 'Financials Report',
      description: 'Full financial breakdown including actual COGS from expenses and cash received.',
      icon: 'calculator',
      columns: ['Name', 'Client', 'Revenue', 'Actual COGS', 'Net Profit', 'Design Fee', 'Cash Received', 'Outstanding'],
      onExport: exportFinancials,
      onExportPdf: () => exportReportPdf({ key: 'financials', label: 'Financials Report' }),
      restricted: true,
    },
    {
      key: 'payroll',
      label: 'Payroll Report',
      description: 'Employee payroll with salary components, deductions, and net pay.',
      icon: 'purchase',
      columns: ['Employee', 'Month', 'Year', 'Base', 'Incentive', 'Deductions', 'Net Salary', 'Status'],
      onExport: exportPayroll,
      onExportPdf: () => exportReportPdf({ key: 'payroll', label: 'Payroll Report' }),
      restricted: true,
    },
  ];

  // ——— Render ———————————————————————————————————————————————————————————————

  const reportIconMap: Record<ReportKey, typeof FileText> = {
    leads: FileText,
    projects: FolderKanban,
    financials: Calculator,
    payroll: CreditCard,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <PageHeader
        eyebrow="Admin Reports"
        title="Reports"
        description="Export data as CSV for the selected date range."
      />

      <section className="mb-6 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Date Range Filter</h2>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="grid min-w-0 gap-1.5 sm:min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              From
            </span>
            <DateInput
              value={startDate}
              onChange={setStartDate}
              placeholder="Select start date"
            />
          </label>

          <label className="grid min-w-0 gap-1.5 sm:min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              To
            </span>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              placeholder="Select end date"
            />
          </label>

          {startDate && endDate && (
            <p className="text-xs text-muted-foreground sm:pb-2">
              {new Date(startDate).toLocaleDateString('en-IN')} - {new Date(endDate).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reportCards.map(card => {
          const isLocked = card.restricted && !canAccessSensitive;
          const state = states[card.key];
          const ReportIcon = reportIconMap[card.key];

          return (
            <article
              key={card.key}
              className={`flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm ${
                isLocked ? 'opacity-70' : ''
              }`}
            >
              <div className="flex-1 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                    <ReportIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{card.label}</h3>

                      {card.restricted && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <Lock className="h-3 w-3" />
                          Restricted
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {card.columns.map(col => (
                    <span
                      key={col}
                      className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {(state.success || state.error) && (
                <div className="space-y-2 px-4 pb-3 sm:px-5">
                  {state.success && (
                    <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold">Export Successful</p>
                        <p className="mt-0.5 text-xs leading-5">{state.success}</p>
                        <button
                          type="button"
                          onClick={() => setReportState(card.key, { success: '' })}
                          className="mt-2 text-xs font-semibold underline-offset-4 hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {state.error && (
                    <div className="flex gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold">Export Failed</p>
                        <p className="mt-0.5 text-xs leading-5">{state.error}</p>
                        <button
                          type="button"
                          onClick={() => setReportState(card.key, { error: '' })}
                          className="mt-2 text-xs font-semibold underline-offset-4 hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-border bg-background px-4 py-4 sm:px-5">
                {isLocked ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Only Super Admins and Finance team members can access this report.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={card.onExport}
                      disabled={!startDate || !endDate || state.loading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {state.loading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Export CSV
                    </button>

                    <button
                      type="button"
                      onClick={card.onExportPdf}
                      disabled={!startDate || !endDate || state.loading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {state.loading ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Export PDF
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div className="mt-6 flex gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground">CSV Format</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Use CSV for spreadsheet analysis and PDF for branded report sharing. Currency values in CSV exports are exported as raw numbers.
          </p>
        </div>
      </div>
    </div>
  );

}



