import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  PHeading, PText, PButton, PTag, PIcon, PModal, PInlineNotification,
} from '@porsche-design-system/components-react';
import {
  supabase,
  type Project,
  type ProjectExpense,
  type ProjectCashReceived,
  formatINR,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationState {
  fromLead?: {
    id: string;
    name: string;
    contact_email?: string;
    contact_phone?: string;
    notes?: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, Parameters<typeof PTag>[0]['color']> = {
  Active: 'notification-success-soft',
  Completed: 'notification-info-soft',
  'On Hold': 'notification-warning-soft',
  Cancelled: 'notification-error-soft',
};

const PROJECT_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5"
        style={{ fontFamily: FONT }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight ? 'border-primary bg-primary/5' : 'border-contrast-low bg-surface'
      }`}
    >
      <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
        {label}
      </PText>
      <PText size="medium" weight="semi-bold" style={{ fontFamily: FONT }}>
        {value}
      </PText>
      {sub && (
        <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
          {sub}
        </PText>
      )}
    </div>
  );
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  client: '',
  status: 'Active' as Project['status'],
  revenue: '',
  estimated_cogs: '',
  design_fee_pct: '15',
  description: '',
  start_date: '',
  end_date: '',
};

type ProjectForm = typeof emptyForm;

// ─── Sub-entry form state ─────────────────────────────────────────────────────

const emptyExpenseForm = { description: '', amount: '', expense_date: '' };
const emptyCashForm = { description: '', amount: '', received_date: '' };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Projects() {
  const { profile, isAdmin, isFinance } = useAuth();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  // List state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail panel state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'expenses' | 'cash'>('overview');
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [cashReceived, setCashReceived] = useState<ProjectCashReceived[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sub-entry forms
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [cashForm, setCashForm] = useState(emptyCashForm);
  const [subError, setSubError] = useState('');
  const [subSaving, setSubSaving] = useState(false);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setProjects(data as Project[]);
    setLoading(false);
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
    setDetailLoading(true);
    const [expRes, cashRes] = await Promise.all([
      supabase
        .from('project_expenses')
        .select('*')
        .eq('project_id', projectId)
        .order('expense_date', { ascending: false }),
      supabase
        .from('project_cash_received')
        .select('*')
        .eq('project_id', projectId)
        .order('received_date', { ascending: false }),
    ]);
    setExpenses((expRes.data as ProjectExpense[]) || []);
    setCashReceived((cashRes.data as ProjectCashReceived[]) || []);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ── Handle fromLead navigation ────────────────────────────────────────────

  useEffect(() => {
    if (locationState?.fromLead) {
      const lead = locationState.fromLead;
      setForm({
        ...emptyForm,
        name: lead.name || '',
        client: lead.name || '',
        description: lead.notes || '',
      });
      setEditingProject(null);
      setModalError('');
      setShowModal(true);
      // Clear location state so re-render doesn't re-open
      window.history.replaceState({}, '');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Detail panel ──────────────────────────────────────────────────────────

  const openDetail = (project: Project) => {
    setSelectedProject(project);
    setDetailTab('overview');
    setSubError('');
    setExpenseForm(emptyExpenseForm);
    setCashForm(emptyCashForm);
    fetchProjectDetail(project.id);
  };

  const closeDetail = () => {
    setSelectedProject(null);
    setExpenses([]);
    setCashReceived([]);
  };

  // ── Project CRUD ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingProject(null);
    setForm(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setForm({
      name: project.name,
      client: project.client,
      status: project.status,
      revenue: String(project.revenue ?? ''),
      estimated_cogs: String(project.estimated_cogs ?? ''),
      design_fee_pct: String(project.design_fee_pct ?? 15),
      description: project.description ?? '',
      start_date: project.start_date ?? '',
      end_date: project.end_date ?? '',
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSaving(true);

    const payload: Partial<Project> & { created_by?: string | null } = {
      name: form.name.trim(),
      client: form.client.trim(),
      status: form.status,
      revenue: parseFloat(form.revenue) || 0,
      estimated_cogs: parseFloat(form.estimated_cogs) || 0,
      design_fee_pct: parseFloat(form.design_fee_pct) || 15,
      description: form.description.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };

    let err: { message: string } | null = null;

    if (editingProject) {
      const { error } = await supabase
        .from('projects')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingProject.id);
      err = error;
      // Refresh selected project data if detail panel is open
      if (!error && selectedProject?.id === editingProject.id) {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('id', editingProject.id)
          .maybeSingle();
        if (data) setSelectedProject(data as Project);
      }
    } else {
      const insertPayload = {
        ...payload,
        created_by: profile?.id ?? null,
        created_from_lead_id: locationState?.fromLead?.id ?? null,
      };
      const { error } = await supabase.from('projects').insert(insertPayload);
      err = error;
    }

    setSaving(false);

    if (err) {
      setModalError(err.message);
      return;
    }

    setShowModal(false);
    fetchProjects();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('project_expenses').delete().eq('project_id', deleteTarget.id);
    await supabase.from('project_cash_received').delete().eq('project_id', deleteTarget.id);
    await supabase.from('projects').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (selectedProject?.id === deleteTarget.id) closeDetail();
    fetchProjects();
  };

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubError('');
    setSubSaving(true);

    const { error } = await supabase.from('project_expenses').insert({
      project_id: selectedProject.id,
      description: expenseForm.description.trim(),
      amount: parseFloat(expenseForm.amount) || 0,
      expense_date: expenseForm.expense_date,
      created_by: profile?.id ?? null,
    });

    setSubSaving(false);
    if (error) { setSubError(error.message); return; }
    setExpenseForm(emptyExpenseForm);
    fetchProjectDetail(selectedProject.id);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!selectedProject) return;
    await supabase.from('project_expenses').delete().eq('id', id);
    fetchProjectDetail(selectedProject.id);
  };

  // ── Cash Received CRUD ────────────────────────────────────────────────────

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubError('');
    setSubSaving(true);

    const { error } = await supabase.from('project_cash_received').insert({
      project_id: selectedProject.id,
      description: cashForm.description.trim(),
      amount: parseFloat(cashForm.amount) || 0,
      received_date: cashForm.received_date,
      created_by: profile?.id ?? null,
    });

    setSubSaving(false);
    if (error) { setSubError(error.message); return; }
    setCashForm(emptyCashForm);
    fetchProjectDetail(selectedProject.id);
  };

  const handleDeleteCash = async (id: string) => {
    if (!selectedProject) return;
    await supabase.from('project_cash_received').delete().eq('id', id);
    fetchProjectDetail(selectedProject.id);
  };

  // ── Financial calculations ────────────────────────────────────────────────

  const calcFinancials = (project: Project) => {
    const revenue = project.revenue ?? 0;
    const estimatedCogs = project.estimated_cogs ?? 0;
    const actualCogs = expenses.reduce((s, x) => s + (x.amount ?? 0), 0);
    const profitBeforeDesign = revenue - actualCogs;
    const designFeePct = project.design_fee_pct ?? 15;
    const designFee = (designFeePct / 100) * revenue;
    const incentive = 0.2 * profitBeforeDesign;
    const commission = 0.015 * profitBeforeDesign;
    const totalCashReceived = cashReceived.reduce((s, x) => s + (x.amount ?? 0), 0);
    const estimatedProfit = revenue - estimatedCogs;

    return {
      revenue,
      estimatedCogs,
      actualCogs,
      profitBeforeDesign,
      designFeePct,
      designFee,
      incentive,
      commission,
      totalCashReceived,
      estimatedProfit,
    };
  };

  const canEditFinancials = isFinance() || isAdmin();
  const canManageSubEntries = isFinance() || isAdmin();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Projects</PHeading>
          <PText color="contrast-medium">Manage active and past projects</PText>
        </div>
        <PButton icon="add" onClick={openCreate}>New Project</PButton>
      </div>

      {/* Two-panel layout when detail is open */}
      <div className={selectedProject ? 'flex flex-col lg:flex-row gap-6' : ''}>
        {/* ── Project List ─────────────────────────────────────────────────── */}
        <div className={selectedProject ? 'w-full lg:w-1/2 min-w-0' : 'w-full'}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <PText color="contrast-medium">Loading projects…</PText>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 bg-surface rounded-xl border border-contrast-low">
              <PIcon name="highway" size="large" color="contrast-low" />
              <PText color="contrast-medium" className="mt-3">
                No projects yet. Create your first project.
              </PText>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-contrast-low">
                      {['Name', 'Client', 'Status', ...(canEditFinancials ? ['Revenue', 'Est. Profit'] : []), 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left">
                          <PText size="xx-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide">
                            {h}
                          </PText>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(project => {
                      const isSelected = selectedProject?.id === project.id;
                      const estProfit = (project.revenue ?? 0) - (project.estimated_cogs ?? 0);
                      return (
                        <tr
                          key={project.id}
                          onClick={() => isSelected ? closeDetail() : openDetail(project)}
                          className={`border-b border-contrast-low last:border-0 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : 'hover:bg-canvas'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>
                              {project.name}
                            </PText>
                            {project.start_date && (
                              <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                                {new Date(project.start_date).toLocaleDateString('en-IN')}
                              </PText>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <PText size="small" style={{ fontFamily: FONT }}>{project.client}</PText>
                          </td>
                          <td className="px-4 py-3">
                            <PTag color={STATUS_COLORS[project.status] || 'background-surface'}>
                              {project.status}
                            </PTag>
                          </td>
                          {canEditFinancials && (
                            <>
                              <td className="px-4 py-3">
                                <PText size="small" style={{ fontFamily: FONT }}>
                                  {formatINR(project.revenue ?? 0)}
                                </PText>
                              </td>
                              <td className="px-4 py-3">
                                <PText
                                  size="small"
                                  color={estProfit >= 0 ? 'notification-success' : 'notification-error'}
                                  style={{ fontFamily: FONT }}
                                >
                                  {formatINR(estProfit)}
                                </PText>
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={e => openEdit(project, e)}
                                className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                                title="Edit project"
                              >
                                <PIcon name="edit" size="x-small" />
                              </button>
                              {isAdmin() && (
                                <button
                                  onClick={() => setDeleteTarget(project)}
                                  className="p-1.5 rounded hover:bg-notification-error-soft transition-colors"
                                  title="Delete project"
                                >
                                  <PIcon name="delete" size="x-small" color="notification-error" />
                                </button>
                              )}
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
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────────── */}
        {selectedProject && (
          <div className="w-full lg:w-1/2 min-w-0 flex flex-col gap-4">
            {/* Detail header */}
            <div className="bg-surface rounded-xl border border-contrast-low p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <PHeading tag="h2" size="medium" style={{ fontFamily: FONT }}>
                    {selectedProject.name}
                  </PHeading>
                  <PText size="small" color="contrast-medium" style={{ fontFamily: FONT }}>
                    {selectedProject.client}
                  </PText>
                </div>
                <div className="flex items-center gap-2">
                  <PTag color={STATUS_COLORS[selectedProject.status] || 'background-surface'}>
                    {selectedProject.status}
                  </PTag>
                  <button
                    onClick={closeDetail}
                    className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                    title="Close detail"
                  >
                    <PIcon name="close" size="x-small" />
                  </button>
                </div>
              </div>

              {selectedProject.description && (
                <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                  {selectedProject.description}
                </PText>
              )}

              {(selectedProject.start_date || selectedProject.end_date) && (
                <div className="flex gap-4 mt-3">
                  {selectedProject.start_date && (
                    <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                      Start: {new Date(selectedProject.start_date).toLocaleDateString('en-IN')}
                    </PText>
                  )}
                  {selectedProject.end_date && (
                    <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                      End: {new Date(selectedProject.end_date).toLocaleDateString('en-IN')}
                    </PText>
                  )}
                </div>
              )}
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 bg-surface rounded-xl border border-contrast-low p-1">
              {(['overview', 'expenses', 'cash'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setDetailTab(tab); setSubError(''); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                    detailTab === tab
                      ? 'bg-primary text-background-base'
                      : 'text-contrast-medium hover:text-primary hover:bg-canvas'
                  }`}
                  style={{ fontFamily: FONT }}
                >
                  {tab === 'cash' ? 'Cash Received' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-32">
                <PText color="contrast-medium">Loading…</PText>
              </div>
            ) : (
              <>
                {/* ── Overview Tab ──────────────────────────────────────── */}
                {detailTab === 'overview' && (() => {
                  const f = calcFinancials(selectedProject);
                  return (
                    <div className="flex flex-col gap-4">
                      {canEditFinancials ? (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Revenue" value={formatINR(f.revenue)} />
                            <StatCard label="Est. COGS" value={formatINR(f.estimatedCogs)} />
                            <StatCard label="Actual COGS" value={formatINR(f.actualCogs)} sub="Sum of logged expenses" />
                            <StatCard
                              label="Net Profit"
                              value={formatINR(f.profitBeforeDesign)}
                              sub="Revenue − Actual COGS"
                              highlight
                            />
                          </div>
                          <div className="bg-surface rounded-xl border border-contrast-low p-4">
                            <PText size="x-small" weight="semi-bold" className="mb-3" style={{ fontFamily: FONT }}>
                              Derived Figures
                            </PText>
                            <div className="grid grid-cols-3 gap-3">
                              <StatCard
                                label={`Design Fee (${f.designFeePct}%)`}
                                value={formatINR(f.designFee)}
                                sub="% of Revenue"
                              />
                              <StatCard
                                label="Incentive (20%)"
                                value={formatINR(f.incentive)}
                                sub="20% of Profit"
                              />
                              <StatCard
                                label="Commission (1.5%)"
                                value={formatINR(f.commission)}
                                sub="1.5% of Profit"
                              />
                            </div>
                          </div>
                          <div className="bg-surface rounded-xl border border-contrast-low p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                                  Total Cash Received
                                </PText>
                                <PText size="medium" weight="semi-bold" style={{ fontFamily: FONT }}>
                                  {formatINR(f.totalCashReceived)}
                                </PText>
                              </div>
                              <div className="text-right">
                                <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                                  Outstanding
                                </PText>
                                <PText
                                  size="medium"
                                  weight="semi-bold"
                                  color={f.revenue - f.totalCashReceived > 0 ? 'notification-warning' : 'notification-success'}
                                  style={{ fontFamily: FONT }}
                                >
                                  {formatINR(Math.max(0, f.revenue - f.totalCashReceived))}
                                </PText>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-surface rounded-xl border border-contrast-low p-6 flex flex-col items-center gap-2">
                          <PIcon name="lock" size="medium" color="contrast-low" />
                          <PText color="contrast-medium" style={{ fontFamily: FONT }}>
                            Financial details are visible to Finance department only.
                          </PText>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Expenses Tab ──────────────────────────────────────── */}
                {detailTab === 'expenses' && (
                  <div className="flex flex-col gap-4">
                    {canManageSubEntries && (
                      <div className="bg-surface rounded-xl border border-contrast-low p-4">
                        <PText size="x-small" weight="semi-bold" className="mb-3" style={{ fontFamily: FONT }}>
                          Add Expense
                        </PText>
                        <form onSubmit={handleAddExpense} className="flex flex-col gap-3">
                          {subError && (
                            <PInlineNotification
                              heading="Error"
                              description={subError}
                              state="error"
                              dismissButton={false}
                            />
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Description *">
                              <input
                                type="text"
                                required
                                value={expenseForm.description}
                                onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                                className="form-input"
                                placeholder="e.g. Material cost"
                              />
                            </FormField>
                            <FormField label="Amount (₹) *">
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={expenseForm.amount}
                                onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                                className="form-input"
                                placeholder="0"
                              />
                            </FormField>
                          </div>
                          <FormField label="Date *">
                            <input
                              type="date"
                              required
                              value={expenseForm.expense_date}
                              onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                              className="form-input"
                            />
                          </FormField>
                          <div className="flex justify-end">
                            <PButton type="submit" loading={subSaving} icon="add">
                              Add Expense
                            </PButton>
                          </div>
                        </form>
                      </div>
                    )}

                    <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                      {expenses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <PIcon name="document" size="medium" color="contrast-low" />
                          <PText color="contrast-medium" className="mt-2" style={{ fontFamily: FONT }}>
                            No expenses logged yet.
                          </PText>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-contrast-low">
                              {['Date', 'Description', 'Amount', ...(canManageSubEntries ? [''] : [])].map((h, i) => (
                                <th key={i} className="px-4 py-3 text-left">
                                  <PText size="xx-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide">
                                    {h}
                                  </PText>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {expenses.map(exp => (
                              <tr key={exp.id} className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors">
                                <td className="px-4 py-2">
                                  <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                                    {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                                  </PText>
                                </td>
                                <td className="px-4 py-2">
                                  <PText size="x-small" style={{ fontFamily: FONT }}>{exp.description}</PText>
                                </td>
                                <td className="px-4 py-2">
                                  <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                                    {formatINR(exp.amount)}
                                  </PText>
                                </td>
                                {canManageSubEntries && (
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => handleDeleteExpense(exp.id)}
                                      className="p-1 rounded hover:bg-notification-error-soft transition-colors"
                                      title="Delete expense"
                                    >
                                      <PIcon name="delete" size="x-small" color="notification-error" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-contrast-low bg-canvas">
                              <td colSpan={2} className="px-4 py-2">
                                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                                  Total
                                </PText>
                              </td>
                              <td className="px-4 py-2" colSpan={canManageSubEntries ? 2 : 1}>
                                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                                  {formatINR(expenses.reduce((s, x) => s + (x.amount ?? 0), 0))}
                                </PText>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Cash Received Tab ─────────────────────────────────── */}
                {detailTab === 'cash' && (
                  <div className="flex flex-col gap-4">
                    {canManageSubEntries && (
                      <div className="bg-surface rounded-xl border border-contrast-low p-4">
                        <PText size="x-small" weight="semi-bold" className="mb-3" style={{ fontFamily: FONT }}>
                          Add Cash Received
                        </PText>
                        <form onSubmit={handleAddCash} className="flex flex-col gap-3">
                          {subError && (
                            <PInlineNotification
                              heading="Error"
                              description={subError}
                              state="error"
                              dismissButton={false}
                            />
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <FormField label="Description *">
                              <input
                                type="text"
                                required
                                value={cashForm.description}
                                onChange={e => setCashForm(f => ({ ...f, description: e.target.value }))}
                                className="form-input"
                                placeholder="e.g. Milestone 1 payment"
                              />
                            </FormField>
                            <FormField label="Amount (₹) *">
                              <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={cashForm.amount}
                                onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                                className="form-input"
                                placeholder="0"
                              />
                            </FormField>
                          </div>
                          <FormField label="Date *">
                            <input
                              type="date"
                              required
                              value={cashForm.received_date}
                              onChange={e => setCashForm(f => ({ ...f, received_date: e.target.value }))}
                              className="form-input"
                            />
                          </FormField>
                          <div className="flex justify-end">
                            <PButton type="submit" loading={subSaving} icon="add">
                              Add Entry
                            </PButton>
                          </div>
                        </form>
                      </div>
                    )}

                    <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                      {cashReceived.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <PIcon name="purchase" size="medium" color="contrast-low" />
                          <PText color="contrast-medium" className="mt-2" style={{ fontFamily: FONT }}>
                            No payments recorded yet.
                          </PText>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-contrast-low">
                              {['Date', 'Description', 'Amount', ...(canManageSubEntries ? [''] : [])].map((h, i) => (
                                <th key={i} className="px-4 py-3 text-left">
                                  <PText size="xx-small" color="contrast-medium" weight="semi-bold" className="uppercase tracking-wide">
                                    {h}
                                  </PText>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cashReceived.map(entry => (
                              <tr key={entry.id} className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors">
                                <td className="px-4 py-2">
                                  <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                                    {new Date(entry.received_date).toLocaleDateString('en-IN')}
                                  </PText>
                                </td>
                                <td className="px-4 py-2">
                                  <PText size="x-small" style={{ fontFamily: FONT }}>{entry.description}</PText>
                                </td>
                                <td className="px-4 py-2">
                                  <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                                    {formatINR(entry.amount)}
                                  </PText>
                                </td>
                                {canManageSubEntries && (
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => handleDeleteCash(entry.id)}
                                      className="p-1 rounded hover:bg-notification-error-soft transition-colors"
                                      title="Delete entry"
                                    >
                                      <PIcon name="delete" size="x-small" color="notification-error" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-contrast-low bg-canvas">
                              <td colSpan={2} className="px-4 py-2">
                                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                                  Total Received
                                </PText>
                              </td>
                              <td className="px-4 py-2" colSpan={canManageSubEntries ? 2 : 1}>
                                <PText size="x-small" weight="semi-bold" color="notification-success" style={{ fontFamily: FONT }}>
                                  {formatINR(cashReceived.reduce((s, x) => s + (x.amount ?? 0), 0))}
                                </PText>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Create / Edit Project Modal ──────────────────────────────────────── */}
      <PModal
        open={showModal}
        onDismiss={() => !saving && setShowModal(false)}
        heading={editingProject ? 'Edit Project' : 'New Project'}
        aria={{ 'aria-label': 'Project form' }}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {modalError && (
            <PInlineNotification
              heading="Error"
              description={modalError}
              state="error"
              dismissButton={false}
            />
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Project Name *">
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Office Interior — Phase 1"
                />
              </FormField>
              <FormField label="Client *">
                <input
                  type="text"
                  required
                  value={form.client}
                  onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  className="form-input"
                  placeholder="Client name"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Status">
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as Project['status'] }))}
                  className="form-input"
                >
                  {PROJECT_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Design Fee %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.design_fee_pct}
                  onChange={e => setForm(f => ({ ...f, design_fee_pct: e.target.value }))}
                  className="form-input"
                  disabled={!canEditFinancials}
                />
              </FormField>
            </div>

            {canEditFinancials && (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Revenue (₹)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.revenue}
                    onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))}
                    className="form-input"
                    placeholder="0"
                  />
                </FormField>
                <FormField label="Estimated COGS (₹)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.estimated_cogs}
                    onChange={e => setForm(f => ({ ...f, estimated_cogs: e.target.value }))}
                    className="form-input"
                    placeholder="0"
                  />
                </FormField>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date">
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="form-input"
                />
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="form-input"
                />
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="form-input resize-none"
                placeholder="Project scope, notes…"
              />
            </FormField>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              Cancel
            </PButton>
            <PButton type="submit" loading={saving}>
              {editingProject ? 'Save Changes' : 'Create Project'}
            </PButton>
          </div>
        </form>
      </PModal>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      <PModal
        open={!!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        heading="Delete Project"
        aria={{ 'aria-label': 'Delete project confirmation' }}
      >
        <div className="flex flex-col gap-4">
          <PInlineNotification
            heading="This action is permanent"
            description={`All expenses and cash received entries for "${deleteTarget?.name}" will also be deleted. This cannot be undone.`}
            state="warning"
            dismissButton={false}
          />
          <div className="flex gap-3 justify-end">
            <PButton variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </PButton>
            <PButton onClick={handleDelete} icon="delete">
              Delete Project
            </PButton>
          </div>
        </div>
      </PModal>
    </div>
  );
}
