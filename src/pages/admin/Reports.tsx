import { useState } from 'react';
import { supabase, formatINR } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PButton, PHeading, PInlineNotification, PText, PIcon } from '@/components/ui/porsche';

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

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

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
          Year: r.year ?? '',
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

  const reportCards: {
    key: ReportKey;
    label: string;
    description: string;
    icon: string;
    columns: string[];
    onExport: () => Promise<void>;
    restricted: boolean;
  }[] = [
    {
      key: 'leads',
      label: 'Leads Report',
      description: 'All CRM leads with contact info, source, status and assignee.',
      icon: 'arrow-right',
      columns: ['Name', 'Email', 'Phone', 'Source', 'Status', 'Assigned To', 'Date'],
      onExport: exportLeads,
      restricted: false,
    },
    {
      key: 'projects',
      label: 'Projects Report',
      description: 'Projects list with client, status, revenue and estimated profit.',
      icon: 'configurate',
      columns: ['Name', 'Client', 'Status', 'Revenue', 'Est. COGS', 'Est. Profit', 'Date'],
      onExport: exportProjects,
      restricted: false,
    },
    {
      key: 'financials',
      label: 'Financials Report',
      description: 'Full financial breakdown including actual COGS from expenses and cash received.',
      icon: 'calculator',
      columns: ['Name', 'Client', 'Revenue', 'Actual COGS', 'Net Profit', 'Design Fee', 'Cash Received', 'Outstanding'],
      onExport: exportFinancials,
      restricted: true,
    },
    {
      key: 'payroll',
      label: 'Payroll Report',
      description: 'Employee payroll with salary components, deductions, and net pay.',
      icon: 'purchase',
      columns: ['Employee', 'Month', 'Year', 'Base', 'Incentive', 'Deductions', 'Net Salary', 'Status'],
      onExport: exportPayroll,
      restricted: true,
    },
  ];

  // ——— Render ———————————————————————————————————————————————————————————————

  return (
    <div className="max-w-5xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="mb-8">
        <PHeading tag="h1" size="x-large" className="mb-1">Reports</PHeading>
        <PText color="contrast-medium">Export data as CSV for the selected date range.</PText>
      </div>

      {/* Date Range Filter */}
      <div className="bg-surface rounded-xl border border-contrast-low p-5 mb-8">
        <PText size="small" weight="semi-bold" className="mb-4">Date Range Filter</PText>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label
              className="text-xs font-medium text-contrast-high uppercase tracking-wide"
              style={{ fontFamily: FONT }}
            >
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label
              className="text-xs font-medium text-contrast-high uppercase tracking-wide"
              style={{ fontFamily: FONT }}
            >
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>
          {startDate && endDate && (
            <PText size="x-small" color="contrast-medium" className="pb-2">
              {new Date(startDate).toLocaleDateString('en-IN')} — {new Date(endDate).toLocaleDateString('en-IN')}
            </PText>
          )}
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reportCards.map(card => {
          const isLocked = card.restricted && !canAccessSensitive;
          const state = states[card.key];

          return (
            <div
              key={card.key}
              className={`bg-surface rounded-xl border border-contrast-low overflow-hidden flex flex-col ${
                isLocked ? 'opacity-60' : ''
              }`}
            >
              {/* Card header */}
              <div className="p-5 flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-canvas border border-contrast-low flex items-center justify-center flex-shrink-0 mt-0.5">
                    <PIcon name={card.icon as Parameters<typeof PIcon>[0]['name']} size="small" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <PText size="small" weight="semi-bold">{card.label}</PText>
                      {card.restricted && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-notification-warning-soft text-notification-warning font-medium" style={{ fontFamily: FONT }}>
                          <PIcon name="lock" size="x-small" color="inherit" />
                          Restricted
                        </span>
                      )}
                    </div>
                    <PText size="x-small" color="contrast-medium">{card.description}</PText>
                  </div>
                </div>

                {/* Columns preview */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {card.columns.map(col => (
                    <span
                      key={col}
                      className="text-xs px-2 py-0.5 rounded bg-canvas border border-contrast-low text-contrast-medium"
                      style={{ fontFamily: FONT }}
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              {state.success && (
                <div className="px-5 pb-3">
                  <PInlineNotification
                    heading="Export Successful"
                    description={state.success}
                    state="success"
                    dismissButton
                    onDismiss={() => setReportState(card.key, { success: '' })}
                  />
                </div>
              )}
              {state.error && (
                <div className="px-5 pb-3">
                  <PInlineNotification
                    heading="Export Failed"
                    description={state.error}
                    state="error"
                    dismissButton
                    onDismiss={() => setReportState(card.key, { error: '' })}
                  />
                </div>
              )}

              {/* Export button */}
              <div className="px-5 pb-5 pt-1 border-t border-contrast-low bg-canvas">
                {isLocked ? (
                  <div className="flex items-center gap-2 py-2">
                    <PIcon name="lock" size="x-small" color="contrast-medium" />
                    <PText size="x-small" color="contrast-medium">
                      Only Super Admins and Finance team members can access this report.
                    </PText>
                  </div>
                ) : (
                  <PButton
                    icon="download"
                    loading={state.loading}
                    onClick={card.onExport}
                    disabled={!startDate || !endDate}
                    className="mt-3"
                    variant="secondary"
                  >
                    Export CSV
                  </PButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global tip */}
      <div className="mt-6">
        <PInlineNotification
          heading="CSV Format"
          description="Reports are exported as comma-separated values (.csv). Open with Excel, Google Sheets, or any spreadsheet tool. Currency values are exported as raw numbers."
          state="info"
          dismissButton={false}
        />
      </div>
    </div>
  );
}



