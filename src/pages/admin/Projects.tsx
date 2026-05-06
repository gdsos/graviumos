import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, type Project, type ProjectExpense, type ProjectCashReceived, formatINR } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import type { Task } from '../../lib/supabase';
import { Plus, Trash2, X, Edit2 } from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-900',
  Completed: 'bg-blue-100 text-blue-900',
  'On Hold': 'bg-amber-100 text-amber-900',
  Cancelled: 'bg-red-100 text-red-900',
};

const PROJECT_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-900 mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

function StatCard({ label, value, currency = true }: { label: string; value: number | string; currency?: boolean }) {
  const displayValue = typeof value === 'number' && currency ? formatINR(value) : value;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-slate-600 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900">{displayValue}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Projects() {
  const location = useLocation();
  const { profile, isAdmin, isFinance, isDeptHead } = useAuth();

  // ─── State ────────────────────────────────────────────────────────────────

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({
    name: '',
    client: '',
    status: 'Active' as const,
    start_date: '',
    end_date: '',
    description: '',
    design_fee_pct: 0,
    revenue: 0,
    estimated_cogs: 0,
  });
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'expenses' | 'cash' | 'tasks'>('overview');
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [cashReceived, setCashReceived] = useState<ProjectCashReceived[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [expenseForm, setExpenseForm] = useState({ expense_date: '', description: '', amount: 0 });
  const [cashForm, setCashForm] = useState({ received_date: '', description: '', amount: 0 });
  const [subError, setSubError] = useState('');
  const [subSaving, setSubSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'expense' | 'cash'; id: string } | null>(null);

  // ─── Permissions ──────────────────────────────────────────────────────────

  const canManage = isAdmin() || isDeptHead();
  const canEditFinancials = isAdmin() || isFinance();
  const canManageSubEntries = canEditFinancials;

  // ─── Calculations ────────────────────────────────────────────────────────

  function calcFinancials(proj: Project) {
    const revenue = proj.revenue || 0;
    const estCogs = proj.estimated_cogs || 0;
    const actualCogs = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = revenue - actualCogs;
    const designFee = (revenue * (proj.design_fee_pct || 0)) / 100;
    const incentive = netProfit > 0 ? netProfit * 0.1 : 0;
    const commission = revenue * 0.025;
    const totalCashReceived = cashReceived.reduce((sum, c) => sum + (c.amount || 0), 0);
    const outstanding = revenue - totalCashReceived;

    return { revenue, estCogs, actualCogs, netProfit, designFee, incentive, commission, totalCashReceived, outstanding };
  }

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!err && data) {
      setProjects(data as Project[]);
    }
    setLoading(false);
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
    setDetailLoading(true);

    const [expensesRes, cashRes, tasksRes] = await Promise.all([
      supabase.from('project_expenses').select('*').eq('project_id', projectId),
      supabase.from('project_cash_received').select('*').eq('project_id', projectId),
      supabase.from('tasks').select('*').eq('project_id', projectId),
    ]);

    if (expensesRes.data) setExpenses((expensesRes.data as ProjectExpense[]) || []);
    if (cashRes.data) setCashReceived((cashRes.data as ProjectCashReceived[]) || []);
    if (tasksRes.data) setTasks((tasksRes.data as Task[]) || []);

    setDetailLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const state = location.state as LocationState | undefined;
    if (state?.fromLead && !editingProject) {
      const fromLead = state.fromLead;
      setForm(f => ({
        ...f,
        name: fromLead.name,
        client: fromLead.contact_email || fromLead.contact_phone || '',
        description: fromLead.notes || '',
      }));
      setShowModal(true);
    }
  }, [location.state, editingProject]);

  // ─── Modal handlers ───────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingProject(null);
    setForm({
      name: '',
      client: '',
      status: 'Active',
      start_date: '',
      end_date: '',
      description: '',
      design_fee_pct: 0,
      revenue: 0,
      estimated_cogs: 0,
    });
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (proj: Project) => {
    setEditingProject(proj);
    setForm({
      name: proj.name,
      client: proj.client || '',
      status: proj.status as typeof form.status,
      start_date: proj.start_date ? new Date(proj.start_date).toISOString().slice(0, 10) : '',
      end_date: proj.end_date ? new Date(proj.end_date).toISOString().slice(0, 10) : '',
      description: proj.description || '',
      design_fee_pct: proj.design_fee_pct || 0,
      revenue: proj.revenue || 0,
      estimated_cogs: proj.estimated_cogs || 0,
    });
    setModalError('');
    setShowModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.client.trim()) {
      setModalError('Project name and client are required.');
      return;
    }

    setSaving(true);
    setModalError('');

    const payload = {
      name: form.name.trim(),
      client: form.client.trim(),
      status: form.status,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      description: form.description.trim(),
      design_fee_pct: form.design_fee_pct,
      revenue: form.revenue,
      estimated_cogs: form.estimated_cogs,
      updated_at: new Date().toISOString(),
    };

    let err;
    if (editingProject) {
      const { error: e } = await supabase.from('projects').update(payload).eq('id', editingProject.id);
      err = e;
    } else {
      const { error: e } = await supabase.from('projects').insert({
        ...payload,
        created_by: profile?.id,
      });
      err = e;
    }

    setSaving(false);
    if (err) {
      setModalError(err.message);
      return;
    }

    setShowModal(false);
    fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    await supabase.from('project_expenses').delete().eq('project_id', id);
    await supabase.from('project_cash_received').delete().eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    setSelectedProject(null);
    setDeleteTarget(null);
    fetchProjects();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !expenseForm.expense_date || !expenseForm.description.trim() || expenseForm.amount <= 0) {
      setSubError('All fields required.');
      return;
    }

    setSubSaving(true);
    const { data, error: err } = await supabase
      .from('project_expenses')
      .insert({
        project_id: selectedProject.id,
        expense_date: new Date(expenseForm.expense_date).toISOString(),
        description: expenseForm.description.trim(),
        amount: expenseForm.amount,
      })
      .select();

    setSubSaving(false);
    if (err) {
      setSubError(err.message);
      return;
    }

    if (data) {
      setExpenses([...expenses, data[0] as ProjectExpense]);
      setExpenseForm({ expense_date: '', description: '', amount: 0 });
      setSubError('');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from('project_expenses').delete().eq('id', id);
    setExpenses(expenses.filter(e => e.id !== id));
    setDeleteTarget(null);
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !cashForm.received_date || !cashForm.description.trim() || cashForm.amount <= 0) {
      setSubError('All fields required.');
      return;
    }

    setSubSaving(true);
    const { data, error: err } = await supabase
      .from('project_cash_received')
      .insert({
        project_id: selectedProject.id,
        received_date: new Date(cashForm.received_date).toISOString(),
        description: cashForm.description.trim(),
        amount: cashForm.amount,
      })
      .select();

    setSubSaving(false);
    if (err) {
      setSubError(err.message);
      return;
    }

    if (data) {
      setCashReceived([...cashReceived, data[0] as ProjectCashReceived]);
      setCashForm({ received_date: '', description: '', amount: 0 });
      setSubError('');
    }
  };

  const handleDeleteCash = async (id: string) => {
    await supabase.from('project_cash_received').delete().eq('id', id);
    setCashReceived(cashReceived.filter(c => c.id !== id));
    setDeleteTarget(null);
  };

  const openDetail = async (proj: Project) => {
    setSelectedProject(proj);
    setDetailTab('overview');
    await fetchProjectDetail(proj.id);
  };

  const closeDetail = () => {
    setSelectedProject(null);
    setExpenses([]);
    setCashReceived([]);
    setTasks([]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const financials = selectedProject ? calcFinancials(selectedProject) : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold mb-1">Projects</h1>
          <p className="text-slate-600">Manage active and past projects</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> New Project
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex gap-6 flex-1 overflow-hidden">
        {/* Left panel: Project list */}
        <div className="flex-1 flex flex-col min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-slate-600">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-slate-600">No projects yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-900">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-900">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-900">Status</th>
                    {canEditFinancials && <th className="text-right px-4 py-3 font-semibold text-slate-900">Revenue</th>}
                    {canEditFinancials && <th className="text-right px-4 py-3 font-semibold text-slate-900">Est. Profit</th>}
                    <th className="text-center px-4 py-3 font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(proj => {
                    const stats = calcFinancials(proj);
                    return (
                      <tr
                        key={proj.id}
                        onClick={() => openDetail(proj)}
                        className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{proj.name}</td>
                        <td className="px-4 py-3 text-slate-600">{proj.client}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${STATUS_COLORS[proj.status]}`}>
                            {proj.status}
                          </span>
                        </td>
                        {canEditFinancials && <td className="px-4 py-3 text-right text-slate-600">{formatINR(stats.revenue)}</td>}
                        {canEditFinancials && <td className="px-4 py-3 text-right text-slate-600">{formatINR(stats.netProfit)}</td>}
                        <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                          {canManage && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(proj); }}
                                className="p-1 hover:bg-blue-100 rounded transition-colors"
                              >
                                <Edit2 size={14} className="text-blue-600" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'project', id: proj.id }); }}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                              >
                                <Trash2 size={14} className="text-red-600" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel: Detail panel */}
        {selectedProject && (
          <div className="w-96 flex flex-col border-l border-slate-200 pl-6 min-h-0">
            {/* Detail header */}
            <div className="pb-4 border-b border-slate-200 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">{selectedProject.name}</h2>
                <p className="text-sm text-slate-600 mt-1">{selectedProject.client}</p>
                {selectedProject.start_date && (
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(selectedProject.start_date).toLocaleDateString()} {selectedProject.end_date ? `- ${new Date(selectedProject.end_date).toLocaleDateString()}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={closeDetail}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-4 pb-3 border-b border-slate-200">
              {(['overview', 'expenses', 'cash', 'tasks'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`text-xs font-semibold px-3 py-2 rounded transition-colors ${
                    detailTab === tab
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto mt-4">
              {detailLoading ? (
                <p className="text-slate-600 text-sm">Loading...</p>
              ) : detailTab === 'overview' && financials ? (
                <div className="flex flex-col gap-6">
                  {canEditFinancials ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <StatCard label="Revenue" value={financials.revenue} />
                        <StatCard label="Est. COGS" value={financials.estCogs} />
                        <StatCard label="Actual COGS" value={financials.actualCogs} />
                        <StatCard label="Net Profit" value={financials.netProfit} />
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <StatCard label="Design Fee" value={financials.designFee} />
                          <StatCard label="Incentive" value={financials.incentive} />
                          <StatCard label="Commission" value={financials.commission} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs text-slate-500">Financials locked for non-finance users</p>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Cash Position</h3>
                      <StatCard label="Total Received" value={financials.totalCashReceived} />
                      <StatCard label="Outstanding" value={financials.outstanding} />
                    </div>
                  </div>

                  {selectedProject.description && (
                    <div className="border-t border-slate-200 pt-4">
                      <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Description</h3>
                      <p className="text-sm text-slate-600">{selectedProject.description}</p>
                    </div>
                  )}
                </div>
              ) : detailTab === 'expenses' ? (
                <div className="flex flex-col gap-4">
                  {canManageSubEntries && (
                    <form onSubmit={handleAddExpense} className="flex flex-col gap-2">
                      <input
                        type="date"
                        value={expenseForm.expense_date}
                        onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={expenseForm.description}
                        onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={expenseForm.amount}
                        onChange={e => setExpenseForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      {subError && <p className="text-xs text-red-600">{subError}</p>}
                      <Button type="submit" size="sm" disabled={subSaving}>
                        Add Expense
                      </Button>
                    </form>
                  )}

                  <div className="flex flex-col gap-2">
                    {expenses.map(exp => (
                      <div key={exp.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <div>
                          <p className="text-xs font-medium">{exp.description}</p>
                          <p className="text-xs text-slate-500">{new Date(exp.expense_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{formatINR(exp.amount)}</p>
                          {canManageSubEntries && (
                            <button
                              onClick={() => setDeleteTarget({ type: 'expense', id: exp.id })}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 size={12} className="text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {expenses.length > 0 && (
                      <div className="flex justify-between items-center p-2 bg-slate-100 rounded font-semibold border-t-2">
                        <p className="text-xs">Total</p>
                        <p className="text-sm">{formatINR(expenses.reduce((sum, e) => sum + e.amount, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : detailTab === 'cash' ? (
                <div className="flex flex-col gap-4">
                  {canManageSubEntries && (
                    <form onSubmit={handleAddCash} className="flex flex-col gap-2">
                      <input
                        type="date"
                        value={cashForm.received_date}
                        onChange={e => setCashForm(f => ({ ...f, received_date: e.target.value }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      <input
                        type="text"
                        placeholder="Description"
                        value={cashForm.description}
                        onChange={e => setCashForm(f => ({ ...f, description: e.target.value }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={cashForm.amount}
                        onChange={e => setCashForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                        className="px-3 py-2 rounded border-2 border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                      />
                      {subError && <p className="text-xs text-red-600">{subError}</p>}
                      <Button type="submit" size="sm" disabled={subSaving}>
                        Add Entry
                      </Button>
                    </form>
                  )}

                  <div className="flex flex-col gap-2">
                    {cashReceived.map(cash => (
                      <div key={cash.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <div>
                          <p className="text-xs font-medium">{cash.description}</p>
                          <p className="text-xs text-slate-500">{new Date(cash.received_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{formatINR(cash.amount)}</p>
                          {canManageSubEntries && (
                            <button
                              onClick={() => setDeleteTarget({ type: 'cash', id: cash.id })}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 size={12} className="text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {cashReceived.length > 0 && (
                      <div className="flex justify-between items-center p-2 bg-slate-100 rounded font-semibold border-t-2">
                        <p className="text-xs">Total Received</p>
                        <p className="text-sm">{formatINR(cashReceived.reduce((sum, c) => sum + c.amount, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : detailTab === 'tasks' ? (
                <div className="flex flex-col gap-2">
                  {tasks.length === 0 ? (
                    <p className="text-xs text-slate-500">No tasks assigned</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 font-semibold text-slate-900">Title</th>
                          <th className="text-left py-2 font-semibold text-slate-900">Status</th>
                          <th className="text-center py-2 font-semibold text-slate-900">Progress</th>
                          <th className="text-left py-2 font-semibold text-slate-900">Deadline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(task => (
                          <tr key={task.id} className="border-b border-slate-200">
                            <td className="py-2 pr-2">{task.title}</td>
                            <td className="py-2 pr-2">
                              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-900">
                                {task.status}
                              </span>
                            </td>
                            <td className="py-2 text-center">{task.progress || 0}%</td>
                            <td className="py-2 pr-2 text-slate-600">
                              {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h2>
            </div>

            <form onSubmit={handleSaveProject} className="flex flex-col gap-4 p-6">
              {modalError && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-900">{modalError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Project Name" required>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                    placeholder="Project name"
                  />
                </FormField>

                <FormField label="Client" required>
                  <input
                    type="text"
                    required
                    value={form.client}
                    onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                    placeholder="Client name"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Status">
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                  >
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>

                <FormField label="Design Fee %">
                  <input
                    type="number"
                    value={form.design_fee_pct}
                    onChange={e => setForm(f => ({ ...f, design_fee_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                    placeholder="0"
                  />
                </FormField>
              </div>

              {canEditFinancials && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Revenue">
                    <input
                      type="number"
                      value={form.revenue}
                      onChange={e => setForm(f => ({ ...f, revenue: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                      placeholder="0"
                    />
                  </FormField>

                  <FormField label="Est. COGS">
                    <input
                      type="number"
                      value={form.estimated_cogs}
                      onChange={e => setForm(f => ({ ...f, estimated_cogs: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
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
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                  />
                </FormField>

                <FormField label="End Date">
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900"
                  />
                </FormField>
              </div>

              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-slate-900 resize-none"
                  placeholder="Optional description"
                />
              </FormField>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : (editingProject ? 'Save Changes' : 'Create Project')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-red-900 mb-2">Delete Confirmation</h3>
              <p className="text-sm text-slate-600 mb-4">
                {deleteTarget.type === 'project'
                  ? 'This action will permanently delete the project and all associated expenses and cash records. This cannot be undone.'
                  : 'This action cannot be undone.'}
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (deleteTarget.type === 'project') {
                      await handleDeleteProject(deleteTarget.id);
                    } else if (deleteTarget.type === 'expense') {
                      await handleDeleteExpense(deleteTarget.id);
                    } else {
                      await handleDeleteCash(deleteTarget.id);
                    }
                  }}
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
