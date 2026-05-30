import { useState, useEffect, useCallback } from 'react';
import type React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { supabase, type Project, type ProjectExpense, type ProjectCashReceived, formatINR } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { DateInput } from '../../components/common/DateInput';
import type { Task, Subtask, Profile } from '../../lib/supabase';
import { Check, ChevronDown, Plus, Trash2, X, Edit2 } from 'lucide-react';
import TaskDetailModal from '../../components/tasks/TaskDetailModal';
import { getPortalDepartmentMemberIds, getProjectAccess } from './projectAccess';
import type { ProjectWorkspaceMode } from './projectTypes';

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

type TaskStatus =
  | 'Not Started'
  | 'Ongoing'
  | 'Overdue'
  | 'Completed';

interface TaskWithDetails extends Task {
  assignee?: Profile;
  subtasks: Subtask[];
  effectiveStatus: TaskStatus;
  overdueByDays?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Completed: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'On Hold': 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const PROJECT_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;

// ─── Helpers ───────────────────────────────────────────────────────────

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) {
    return 'Overdue';
  }
  return (
  ['Not Started', 'Ongoing', 'Completed'].includes(task.status)
    ? (task.status as TaskStatus)
    : 'Not Started'
);
}

function calcOverdueDays(task: Task): number | undefined {
  if (
    task.status !== 'Completed' ||
    !task.deadline ||
    !task.completed_at
  ) {
    return undefined;
  }

  const deadline = new Date(task.deadline);
  const completed = new Date(task.completed_at);

  const diff = Math.floor(
    (completed.getTime() - deadline.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return diff > 0 ? diff : undefined;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormField({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  currency = true,
  valueClassName = '',
}: {
  label: string;
  value: number | string;
  currency?: boolean;
  valueClassName?: string;
}) {
  const displayValue = typeof value === 'number' && currency ? formatINR(value) : value;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>

      <p className={`mt-2 text-base font-semibold text-foreground ${valueClassName}`}>
        {displayValue}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────


interface ProjectOption {
  value: string;
  label: string;
}

function ProjectFormDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
}: {
  value: string;
  options: ProjectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);

  return (
    <div
      className={`relative ${open ? 'z-[120]' : 'z-0'}`}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none"
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[130] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
          {options.map(option => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ProjectWorkspaceProps {
  mode: ProjectWorkspaceMode;
}

export default function ProjectWorkspace({ mode }: ProjectWorkspaceProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
  profile,
  departments,
  isAdmin,
  isFinance,
  isDeptHead,
} = useAuth();

  // ─── State ────────────────────────────────────────────────────────────────

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectExpensesByProjectId, setProjectExpensesByProjectId] = useState<
    Record<string, ProjectExpense[]>
  >({});
  const [projectCashByProjectId, setProjectCashByProjectId] = useState<
    Record<string, ProjectCashReceived[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
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
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [cashReceived, setCashReceived] = useState<ProjectCashReceived[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [expenseForm, setExpenseForm] = useState({ expense_date: '', description: '', amount: 0 });
  const [cashForm, setCashForm] = useState<{
    received_date: string;
    description: string;
    amount: number;
    gst_treatment: 'GST' | 'NO_GST';
  }>({
    received_date: '',
    description: '',
    amount: 0,
    gst_treatment: 'GST',
  });
  const [subError, setSubError] = useState('');
  const [subSaving, setSubSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'project' | 'expense' | 'cash'; id: string } | null>(null);

  // ─── Permissions ──────────────────────────────────────────────────────────

  const access = getProjectAccess({ mode, isAdmin, isFinance, isDeptHead });
  const {
    canManage,
    canEditFinancials,
    canManageSubEntries,
    canViewTasks,
    defaultDetailTab,
  } = access;
  const [detailTab, setDetailTab] = useState<
    'overview' | 'expenses' | 'cash' | 'tasks' | 'timeline'
  >(defaultDetailTab);

  // ─── Calculations ────────────────────────────────────────────────────────

  function calcFinancials(
    proj: Project,
    sourceExpenses: ProjectExpense[] = expenses,
    sourceCashReceived: ProjectCashReceived[] = cashReceived
  ) {
  const grossRevenue = proj.revenue || 0;

  // ─── GST CALCULATION (FIXED - YOUR FINAL VERSION) ───────────────────────

  const gstOnRevenue = grossRevenue * 0.18;

  const gstAdjustment = sourceCashReceived.reduce((sum, c) => {
    const treatment = c.gst_treatment as string;
    if (treatment === 'NO_GST' || treatment === 'NO_GST 0%') {
      return sum + c.amount * 0.18;
    }
    return sum;
  }, 0);

  const gstAmount = gstOnRevenue - gstAdjustment;

  const netRevenue = grossRevenue - gstAmount;

  // ─── COSTS ──────────────────────────────────────────────────────────────

  const actualCogs = sourceExpenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  );

  const estCogs = proj.estimated_cogs || 0;

  // ─── PROFITABILITY ─────────────────────────────────────────────────────

  const netProfit = netRevenue - actualCogs;

  // ─── FEES (BASED ON NET REVENUE - CORRECT BUSINESS LOGIC) ──────────────

  const designFee = (netRevenue * (proj.design_fee_pct || 0)) / 100;

  const incentive = netProfit > 0 ? netProfit * 0.1 : 0;

  const commission = netRevenue * 0.025;

  // ─── CASH FLOW ─────────────────────────────────────────────────────────

  const totalCashReceived = sourceCashReceived.reduce(
    (sum, c) => sum + (c.amount || 0),
    0
  );

  const outstanding = mode === 'admin'
    ? grossRevenue - totalCashReceived
    : netRevenue - totalCashReceived;

  // ─── FINAL RETURN ───────────────────────────────────────────────────────

  return {
    revenue: grossRevenue,

    gstAmount,
    netRevenue,

    estCogs,
    actualCogs,

    netProfit,

    designFee,
    incentive,
    commission,

    totalCashReceived,
    outstanding,
  };
}

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!err && data) {
      const projectRows = data as Project[];
      setProjects(projectRows);

      const projectIds = projectRows.map(project => project.id);

      if (projectIds.length > 0) {
        const [expensesRes, cashRes] = await Promise.all([
          supabase
            .from('project_expenses')
            .select('*')
            .in('project_id', projectIds),
          supabase
            .from('project_cash_received')
            .select('*')
            .in('project_id', projectIds),
        ]);

        const expensesMap: Record<string, ProjectExpense[]> = {};
        const cashMap: Record<string, ProjectCashReceived[]> = {};

        for (const expense of (expensesRes.data || []) as ProjectExpense[]) {
          if (!expensesMap[expense.project_id]) {
            expensesMap[expense.project_id] = [];
          }

          expensesMap[expense.project_id].push(expense);
        }

        for (const cash of (cashRes.data || []) as ProjectCashReceived[]) {
          if (!cashMap[cash.project_id]) {
            cashMap[cash.project_id] = [];
          }

          cashMap[cash.project_id].push(cash);
        }

        setProjectExpensesByProjectId(expensesMap);
        setProjectCashByProjectId(cashMap);
      } else {
        setProjectExpensesByProjectId({});
        setProjectCashByProjectId({});
      }
    }
    setLoading(false);
  }, []);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
  setDetailLoading(true);

    const [expensesRes, cashRes, tasksRes] = await Promise.all([
      supabase
        .from('project_expenses')
        .select('*')
        .eq('project_id', projectId),

      supabase
        .from('project_cash_received')
        .select('*')
        .eq('project_id', projectId),

      (async () => {
        let query = supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId);

        if (mode === 'admin' || isAdmin()) {
          return query.order('created_at', { ascending: false });
        }

        if (isDeptHead()) {
          const uniqueIds = getPortalDepartmentMemberIds(profile, allProfiles);

          if (uniqueIds.length === 0) {
            return query.eq('assigned_to', '___never___');
          }

          return query
            .in('assigned_to', uniqueIds)
            .order('created_at', { ascending: false });
        }

        if (profile?.id) {
          return query
            .eq('assigned_to', profile.id)
            .order('created_at', { ascending: false });
        }

        return query.eq('assigned_to', '___never___');
      })(),
    ]);

  // Expenses
  if (expensesRes.data) {
    setExpenses((expensesRes.data as ProjectExpense[]) || []);
  }

  // Cash
  if (cashRes.data) {
    setCashReceived((cashRes.data as ProjectCashReceived[]) || []);
  }

  // Tasks + Subtasks + Assignees
  if (tasksRes.data) {
    const tasksData = tasksRes.data as Task[];

    const taskIds = tasksData.map(t => t.id);

    // ─── Fetch Subtasks ─────────────────────────────

    let subtaskMap: Record<string, any[]> = {};

    if (taskIds.length > 0) {
      const { data: subtasksData } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', taskIds);

      if (subtasksData) {
        for (const sub of subtasksData) {
          if (!subtaskMap[sub.task_id]) {
            subtaskMap[sub.task_id] = [];
          }

          subtaskMap[sub.task_id].push(sub);
        }
      }
    }

    // ─── Fetch Assignees ────────────────────────────

    const assigneeIds = [
      ...new Set(
        tasksData
          .map(t => t.assigned_to)
          .filter(Boolean)
      ),
    ] as string[];

    let assigneeMap: Record<string, any> = {};

    if (assigneeIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', assigneeIds);

      if (profilesData) {
        for (const p of profilesData) {
          assigneeMap[p.id] = p;
        }
      }
    }

      // ─── Enrich Tasks ───────────────────────────────

      const enrichedTasks: TaskWithDetails[] = tasksData.map(task => ({
        ...task,
        subtasks: subtaskMap[task.id] || [],
        assignee: task.assigned_to
          ? assigneeMap[task.assigned_to]
          : undefined,
        effectiveStatus: calcEffectiveStatus(task),
        overdueByDays: calcOverdueDays(task),
      }));

      setTasks(enrichedTasks);
    }

    setDetailLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (mode !== 'portal') return;

    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*');

      if (data) {
        setAllProfiles(data as Profile[]);
      }
    };

    fetchProfiles();
  }, [mode]);

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
      const newExpense = data[0] as ProjectExpense;
      setExpenses([...expenses, newExpense]);
      setProjectExpensesByProjectId(current => ({
        ...current,
        [newExpense.project_id]: [...(current[newExpense.project_id] || []), newExpense],
      }));
      setExpenseForm({ expense_date: '', description: '', amount: 0 });
      setSubError('');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from('project_expenses').delete().eq('id', id);
    const deletedExpense = expenses.find(expense => expense.id === id);
    setExpenses(expenses.filter(e => e.id !== id));

    if (deletedExpense) {
      setProjectExpensesByProjectId(current => ({
        ...current,
        [deletedExpense.project_id]: (current[deletedExpense.project_id] || []).filter(
          expense => expense.id !== id
        ),
      }));
    }
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
        gst_treatment: cashForm.gst_treatment,
      })
      .select();

    setSubSaving(false);
    if (err) {
      setSubError(err.message);
      return;
    }

    if (data) {
      const newCash = data[0] as ProjectCashReceived;
      setCashReceived([...cashReceived, newCash]);
      setProjectCashByProjectId(current => ({
        ...current,
        [newCash.project_id]: [...(current[newCash.project_id] || []), newCash],
      }));
      setCashForm({
        received_date: '',
        description: '',
        amount: 0,
        gst_treatment: 'GST',
      });
      setSubError('');
    }
  };

  const handleDeleteCash = async (id: string) => {
    await supabase.from('project_cash_received').delete().eq('id', id);
    const deletedCash = cashReceived.find(cash => cash.id === id);
    setCashReceived(cashReceived.filter(c => c.id !== id));

    if (deletedCash) {
      setProjectCashByProjectId(current => ({
        ...current,
        [deletedCash.project_id]: (current[deletedCash.project_id] || []).filter(
          cash => cash.id !== id
        ),
      }));
    }
    setDeleteTarget(null);
  };

  const openDetail = async (proj: Project) => {
    setSelectedProject(proj);
    setDetailTab(defaultDetailTab);
    await fetchProjectDetail(proj.id);
  };

  useEffect(() => {
    const projectId = searchParams.get('projectId');

    if (!projectId || loading || projects.length === 0) return;

    const matchedProject = projects.find(project => project.id === projectId);

    if (matchedProject) {
      void openDetail(matchedProject);

      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('projectId');
        return next;
      }, { replace: true });
    }
  }, [defaultDetailTab, fetchProjectDetail, loading, projects, searchParams, setSearchParams]);

  const closeDetail = () => {
    setSelectedProject(null);
    setExpenses([]);
    setCashReceived([]);
    setTasks([]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const financials = selectedProject ? calcFinancials(selectedProject) : null;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10">
      {/* Header */}
      <div className="mb-8 border-b border-border pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              Gravium OS
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Projects
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Manage active and past projects across design, execution, finance, tasks, and timeline.
            </p>
          </div>

          {canManage && (
            <Button
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium"
            >
              <Plus size={16} />
              New Project
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:overflow-hidden">
        {/* Left panel: Project list */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedProject ? 'hidden lg:flex' : 'flex'
            }`}
        >
          {loading ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6">
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-6">
              <p className="text-sm text-muted-foreground">No projects yet</p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW */}
                  <div
                    className={`flex flex-col gap-4 md:hidden transition-all duration-300 overflow-hidden ${selectedProject ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[5000px] opacity-100'
                      }`}
                  >
                {projects.map(proj => {
                  const stats = calcFinancials(
                    proj,
                    projectExpensesByProjectId[proj.id] || [],
                    projectCashByProjectId[proj.id] || []
                  );

                  return (
                    <div
                      key={proj.id}
                      onClick={() => openDetail(proj)}
                      className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-muted-foreground/35 hover:bg-muted/20"
                    >
                      {/* Top */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {proj.name}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {proj.client}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLORS[proj.status]}`}
                        >
                          {proj.status}
                        </span>
                      </div>

                      {/* Financials */}
                      {canEditFinancials && (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              Revenue
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatINR(stats.revenue)}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                              Profit
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatINR(stats.netProfit)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end gap-2 mt-4">
                        {canManage && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(proj);
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Edit2 size={16} />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: 'project', id: proj.id });
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/15"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW */}
              <div className="hidden overflow-hidden rounded-2xl border border-border bg-card/60 md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Status
                      </th>

                      {canEditFinancials && (
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Revenue
                        </th>
                      )}

                      {canEditFinancials && (
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Est. Profit
                        </th>
                      )}

                      {!selectedProject && (
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {projects.map(proj => {
                      const stats = calcFinancials(
                        proj,
                        projectExpensesByProjectId[proj.id] || [],
                        projectCashByProjectId[proj.id] || []
                      );

                      return (
                        <tr
                          key={proj.id}
                          onClick={() => openDetail(proj)}
                          className="cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {proj.name}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {proj.client}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[proj.status]}`}
                            >
                              {proj.status}
                            </span>
                          </td>

                          {canEditFinancials && (
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {formatINR(stats.revenue)}
                            </td>
                          )}

                          {canEditFinancials && (
                            <td className="px-4 py-3 text-right text-muted-foreground">
                              {formatINR(stats.netProfit)}
                            </td>
                          )}

                          {!selectedProject && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                {canManage && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEdit(proj);
                                      }}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                      <Edit2 size={14} />
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget({ type: 'project', id: proj.id });
                                      }}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Right panel: Detail panel */}
        {selectedProject && (
          <div className="fixed inset-0 z-[80] flex min-h-0 w-full flex-col bg-background px-4 pb-28 pt-5 lg:relative lg:inset-auto lg:z-auto lg:w-[42rem] lg:rounded-2xl lg:border lg:border-border lg:bg-card/60 lg:p-4">
            {/* Detail header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background pb-4 lg:bg-transparent">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Project Details
                </p>

                <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {selectedProject.name}
                </h2>

                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedProject.client}
                </p>

                {selectedProject.start_date && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {new Date(selectedProject.start_date).toLocaleDateString()}{' '}
                    {selectedProject.end_date
                      ? `- ${new Date(selectedProject.end_date).toLocaleDateString()}`
                      : ''}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(selectedProject)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Edit project"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'project',
                          id: selectedProject.id,
                        })
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/15"
                      aria-label="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}

                <button
                  onClick={closeDetail}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close project details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex gap-2 overflow-x-auto border-b border-border pb-3">

              {/* Finance/Admin Only */}
              {canEditFinancials && (
                <>
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${detailTab === 'overview'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                  >
                    Overview
                  </button>

                  <button
                    onClick={() => setDetailTab('expenses')}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${detailTab === 'expenses'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                  >
                    Expenses
                  </button>

                  <button
                    onClick={() => setDetailTab('cash')}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${detailTab === 'cash'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                  >
                    Cash
                  </button>
                </>
              )}

              {/* Everyone gets Timeline */}
              <button
                onClick={() => setDetailTab('timeline')}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${detailTab === 'timeline'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
              >
                Timeline
              </button>

              {/* Tasks ALWAYS LAST */}
              {canViewTasks && (
                <button
                  onClick={() => setDetailTab('tasks')}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${detailTab === 'tasks'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  Tasks
                </button>
              )}

            </div>

            {/* Tab content */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
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
                      <div className="border-t border-border pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Design Fee" value={financials.designFee} />
                            <StatCard label="Incentive" value={financials.incentive} />

                            <StatCard label="Commission" value={financials.commission} />
                            <StatCard label="GST (18%)" value={financials.gstAmount} />
                          </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs text-muted-foreground">Financials locked for non-finance users</p>
                    </div>
                  )}

                    <div className="border-t border-border pt-4">
                      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Cash Position
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        <StatCard
                          label="Total Received"
                          value={financials.totalCashReceived}
                          valueClassName="text-emerald-600"
                        />

                        <StatCard
                          label="Outstanding"
                          value={financials.outstanding}
                          valueClassName="text-amber-600"
                        />
                      </div>
                    </div>

                  {selectedProject.description && (
                    <div className="border-t border-border pt-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Description</h3>
                      <p className="text-sm text-muted-foreground">{selectedProject.description}</p>
                    </div>
                  )}
                </div>
              ) : detailTab === 'expenses' ? (
                <div className="flex flex-col gap-4">
                  {canManageSubEntries && (
                    <form onSubmit={handleAddExpense} className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              Date (DD/MM/YYYY)
                            </span>

                            <DateInput
                              value={expenseForm.expense_date}
                              onChange={value =>
                                setExpenseForm(f => ({
                                  ...f,
                                  expense_date: value,
                                }))
                              }
                              placeholder="Select date"
                              placement="down"
                              popoverMode="fixed"
                            />
                          </div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={expenseForm.description}
                        onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                        className="form-input"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={expenseForm.amount === 0 ? '' : expenseForm.amount}
                            onChange={e =>
                              setExpenseForm(f => ({
                                ...f,
                                amount: e.target.value === '' ? 0 : Number(e.target.value),
                              }))
                            }
                        className="form-input"
                      />
                      {subError && <p className="text-xs text-destructive">{subError}</p>}
                      <Button type="submit" size="sm" disabled={subSaving}>
                        Add Expense
                      </Button>
                    </form>
                  )}

                  <div className="flex flex-col gap-2">
                    {expenses.map(exp => (
                      <div key={exp.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                        <div>
                          <p className="text-xs font-medium">{exp.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{formatINR(exp.amount)}</p>
                          {canManageSubEntries && (
                            <button
                              onClick={() => setDeleteTarget({ type: 'expense', id: exp.id })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {expenses.length > 0 && (
                      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 font-semibold">
                        <p className="text-xs">Total</p>
                        <p className="text-sm font-bold text-red-600">{formatINR(expenses.reduce((sum, e) => sum + e.amount, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : detailTab === 'cash' ? (
                <div className="flex flex-col gap-4">
                  {canManageSubEntries && (
                          <form onSubmit={handleAddCash} className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              {/* Date */}
                              <div className="flex flex-col gap-1 flex-1">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  Date (DD/MM/YYYY)
                                </span>

                                <DateInput
                                  value={cashForm.received_date}
                                  onChange={value =>
                                    setCashForm(f => ({
                                      ...f,
                                      received_date: value,
                                    }))
                                  }
                                  placeholder="Select date"
                                  placement="down"
                                  popoverMode="fixed"
                                />
                              </div>

                              {/* GST Dropdown */}
                              <div className="flex flex-col gap-1 w-40">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                  GST Treatment
                                </span>

                                <ProjectFormDropdown
                                  value={cashForm.gst_treatment}
                                  onChange={value =>
                                    setCashForm(f => ({
                                      ...f,
                                      gst_treatment: value as 'GST' | 'NO_GST',
                                    }))
                                  }
                                  options={[
                                    { value: 'GST', label: 'GST 18%' },
                                    { value: 'NO_GST', label: 'No GST 0%' },
                                  ]}
                                />
                              </div>
                            </div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={cashForm.description}
                        onChange={e => setCashForm(f => ({ ...f, description: e.target.value }))}
                        className="form-input"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                              value={cashForm.amount === 0 ? '' : cashForm.amount}
                              onChange={e =>
                                setCashForm(f => ({
                                  ...f,
                                  amount: e.target.value === '' ? 0 : Number(e.target.value),
                                }))
                              }  
                        className="form-input"
                      />
                      {subError && <p className="text-xs text-destructive">{subError}</p>}
                      <Button type="submit" size="sm" disabled={subSaving}>
                        Add Entry
                      </Button>
                    </form>
                  )}

                  <div className="flex flex-col gap-2">
                    {cashReceived.map(cash => (
                      <div key={cash.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                        <div>
                          <p className="text-xs font-medium">{cash.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(cash.received_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{formatINR(cash.amount)}</p>
                          {canManageSubEntries && (
                            <button
                              onClick={() => setDeleteTarget({ type: 'cash', id: cash.id })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {cashReceived.length > 0 && (
                      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 font-semibold">
                        <p className="text-xs">Total Received</p>
                        <p className="text-sm font-bold text-emerald-600">{formatINR(cashReceived.reduce((sum, c) => sum + c.amount, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : detailTab === 'tasks' && canViewTasks ? (
                <div className="flex flex-col gap-6">
                  {tasks.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No tasks found for this project
                      </p>
                    </div>
                  ) : (
                    <>
                      {(
                        [
                          'Not Started',
                          'Ongoing',
                          'Overdue',
                          'Completed',
                        ] as TaskStatus[]
                      ).map(status => {
                        const filtered = tasks.filter(
                          t => t.effectiveStatus === status
                        );

                        if (filtered.length === 0) return null;

                        return (
                          <div key={status}>
                            {/* Section Header */}
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {status}
                              </h3>

                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                                {filtered.length}
                              </span>
                            </div>

                            {/* Cards */}
                            <div className="flex flex-col gap-3">
                              {filtered.map(task => (
                                <button
                                  key={task.id}
                                  onClick={() => setSelectedTask(task)}
                                  className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/35 hover:bg-muted/20"
                                >
                                  {/* Top */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <h3 className="truncate text-sm font-semibold text-foreground">
                                        {task.title}
                                      </h3>

                                      {task.description && (
                                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                          {task.description}
                                        </p>
                                      )}
                                    </div>

                                    <span
                                      className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${task.effectiveStatus === 'Completed'
                                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                          : task.effectiveStatus === 'Overdue'
                                            ? 'border-destructive/20 bg-destructive/10 text-destructive'
                                            : task.effectiveStatus === 'Ongoing'
                                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                              : 'border-border bg-muted text-muted-foreground'
                                        }`}
                                    >
                                      {task.effectiveStatus}
                                    </span>
                                  </div>

                                  {/* Assignee + Deadline */}
                                  <div className="flex flex-wrap items-center gap-3 mt-3">
                                    {task.assignee && (
                                      <div className="text-[11px] text-muted-foreground">
                                        Assigned to:{' '}
                                        <span className="font-medium">
                                          {task.assignee.full_name}
                                        </span>
                                      </div>
                                    )}

                                    {task.deadline && (
                                      <div className="text-[11px] text-muted-foreground">
                                        Due:{' '}
                                        <span className="font-medium">
                                          {new Date(
                                            task.deadline
                                          ).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}

                                    {task.overdueByDays && (
                                      <div className="text-[11px] font-medium text-destructive">
                                        {task.overdueByDays} day(s) late
                                      </div>
                                    )}
                                  </div>

                                  {/* Subtasks Progress */}
                                  {task.subtasks.length > 0 && (
                                    <div className="mt-3">
                                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                                        <span>Subtasks</span>

                                        <span>
                                          {
                                            task.subtasks.filter(
                                              s => s.is_completed
                                            ).length
                                          }{' '}
                                          / {task.subtasks.length}
                                        </span>
                                      </div>

                                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full bg-primary transition-all"
                                          style={{
                                            width: `${(task.subtasks.filter(
                                              s => s.is_completed
                                            ).length /
                                                task.subtasks.length) *
                                              100
                                              }%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              ) : detailTab === 'timeline' ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-sm text-muted-foreground">
                    Timeline coming soon
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-none border border-border bg-card shadow-2xl sm:rounded-3xl">
            <div className="border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Project Setup
              </p>

              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h2>
            </div>

            <form onSubmit={handleSaveProject} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-5">
                  {modalError && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                      <p className="text-sm text-destructive">{modalError}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Project Name" required>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input"
                        placeholder="Project name"
                      />
                    </FormField>

                    <FormField label="Client" required>
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Status">
                      <ProjectFormDropdown
                        value={form.status}
                        onChange={value =>
                          setForm(f => ({
                            ...f,
                            status: value as typeof form.status,
                          }))
                        }
                        options={PROJECT_STATUSES.map(status => ({
                          value: status,
                          label: status,
                        }))}
                      />
                    </FormField>

                    <FormField label="Design Fee %">
                      <input
                        type="number"
                        value={form.design_fee_pct}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            design_fee_pct: e.target.value === '' ? 0 : Number(e.target.value),
                          }))
                        }
                        className="form-input"
                        placeholder="0"
                      />
                    </FormField>
                  </div>

                  {canEditFinancials && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Revenue">
                        <input
                          type="number"
                          value={form.revenue}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              revenue: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                          className="form-input"
                          placeholder="0"
                        />
                      </FormField>

                      <FormField label="Est. COGS">
                        <input
                          type="number"
                          value={form.estimated_cogs}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              estimated_cogs: e.target.value === '' ? 0 : Number(e.target.value),
                            }))
                          }
                          className="form-input"
                          placeholder="0"
                        />
                      </FormField>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Start Date">
                      <DateInput
                        value={form.start_date}
                        onChange={value =>
                          setForm(f => ({
                            ...f,
                            start_date: value,
                          }))
                        }
                        placeholder="Select start date"
                      />
                    </FormField>

                    <FormField label="End Date">
                      <DateInput
                        value={form.end_date}
                        onChange={value =>
                          setForm(f => ({
                            ...f,
                            end_date: value,
                          }))
                        }
                        placeholder="Select end date"
                      />
                    </FormField>
                  </div>

                  <FormField label="Description">
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={4}
                      className="form-textarea min-h-28 resize-none"
                      placeholder="Optional description"
                    />
                  </FormField>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="h-10 rounded-xl"
                  >
                    Cancel
                  </Button>

                  <Button type="submit" disabled={saving} className="h-10 rounded-xl">
                    {saving
                      ? 'Saving...'
                      : editingProject
                        ? 'Save Changes'
                        : 'Create Project'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
                Delete Confirmation
              </p>

              <h3 className="text-lg font-semibold text-foreground">
                {deleteTarget.type === 'project'
                  ? 'Delete this project?'
                  : deleteTarget.type === 'expense'
                    ? 'Delete this expense?'
                    : 'Delete this cash entry?'}
              </h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                {deleteTarget.type === 'project'
                  ? 'This will permanently delete the project and its associated expense and cash records. This cannot be undone.'
                  : 'This action cannot be undone.'}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="h-10 rounded-xl"
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
                className="h-10 rounded-xl"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <TaskDetailModal
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        departments={departments}
        canManage={canManage}
        onRefresh={() => {
          if (selectedProject) {
            fetchProjectDetail(selectedProject.id);
          }
        }}
      />
    </div>
  );
}
