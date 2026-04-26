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
  type Project,
  type Task,
  type Subtask,
  type ProjectExpense,
  type ProjectCashReceived,
  formatINR,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AdminProjects from '../admin/Projects';

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';
type StatusFilter = 'All' | Project['status'];

interface TaskWithDetails extends Task {
  subtasks: Subtask[];
  effectiveStatus: TaskStatus;
  overdueByDays?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

const STATUS_FILTER_OPTIONS: StatusFilter[] = ['All', 'Active', 'Completed', 'On Hold', 'Cancelled'];

const STATUS_TAG_COLOR: Record<string, Parameters<typeof PTag>[0]['color']> = {
  Active: 'notification-success-soft',
  Completed: 'notification-info-soft',
  'On Hold': 'notification-warning-soft',
  Cancelled: 'notification-error-soft',
};

const TASK_STATUS_VARIANT: Record<TaskStatus, Parameters<typeof PTag>[0]['variant']> = {
  'Not Started': 'secondary',
  Ongoing: 'info',
  Overdue: 'error',
  Completed: 'success',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) return 'Overdue';
  return task.status;
}

function calcOverdueDays(task: Task): number | undefined {
  if (task.status !== 'Completed' || !task.deadline || !task.completed_at) return undefined;
  const diff = Math.floor(
    (new Date(task.completed_at).getTime() - new Date(task.deadline).getTime()) / 86400000
  );
  return diff > 0 ? diff : undefined;
}

function calcSubtaskProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;
  return Math.round((subtasks.filter(s => s.is_completed).length / subtasks.length) * 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProgressBar({ value }: { value: number }) {
  const color = value === 100 ? '#2e7d32' : value >= 75 ? '#0288d1' : '#ed6c02';
  return (
    <div className="w-full bg-contrast-low/30 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${value}%`,
          background: color,
        }}
      />
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function PortalProjects() {
  const { isFinance, isDeptHead } = useAuth();

  // Finance department heads get the full admin Projects view
  if (isFinance() && isDeptHead()) {
    return <AdminProjects />;
  }

  return <PortalProjectsView />;
}

// ─── Employee Portal Projects View ────────────────────────────────────────────

function PortalProjectsView() {
  const { userDepartments, isFinance, isAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [error, setError] = useState('');

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTasks, setDetailTasks] = useState<TaskWithDetails[]>([]);
  const [expenses, setExpenses] = useState<ProjectExpense[]>([]);
  const [cashReceived, setCashReceived] = useState<ProjectCashReceived[]>([]);
  const [detailTab, setDetailTab] = useState<'tasks' | 'financials'>('tasks');
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const showFinancials = isFinance() || isAdmin();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setProjects((data as Project[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchProjectDetail = useCallback(
    async (project: Project) => {
      setDetailLoading(true);
      const userDeptIds = (userDepartments || []).map(d => d.id);

      let taskQuery = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (!isAdmin() && userDeptIds.length > 0) {
        taskQuery = taskQuery.in('department_id', userDeptIds);
      }

      const { data: tasksData } = await taskQuery;

      let enrichedTasks: TaskWithDetails[] = [];
      if (tasksData && (tasksData as Task[]).length > 0) {
        const taskIds = (tasksData as Task[]).map(t => t.id);
        const { data: subtasksData } = await supabase
          .from('subtasks')
          .select('*')
          .in('task_id', taskIds);

        const subtaskMap: Record<string, Subtask[]> = {};
        if (subtasksData) {
          for (const sub of subtasksData as Subtask[]) {
            if (!subtaskMap[sub.task_id]) subtaskMap[sub.task_id] = [];
            subtaskMap[sub.task_id].push(sub);
          }
        }

        enrichedTasks = (tasksData as Task[]).map(t => ({
          ...t,
          subtasks: subtaskMap[t.id] || [],
          effectiveStatus: calcEffectiveStatus(t),
          overdueByDays: calcOverdueDays(t),
        }));
      }

      setDetailTasks(enrichedTasks);

      if (showFinancials) {
        const [expRes, cashRes] = await Promise.all([
          supabase
            .from('project_expenses')
            .select('*')
            .eq('project_id', project.id)
            .order('expense_date', { ascending: false }),
          supabase
            .from('project_cash_received')
            .select('*')
            .eq('project_id', project.id)
            .order('received_date', { ascending: false }),
        ]);
        setExpenses((expRes.data as ProjectExpense[]) || []);
        setCashReceived((cashRes.data as ProjectCashReceived[]) || []);
      }

      setDetailLoading(false);
    },
    [userDepartments, isAdmin, showFinancials]
  );

  const openDetail = (project: Project) => {
    setSelectedProject(project);
    setDetailTab('tasks');
    setDetailTasks([]);
    setExpenses([]);
    setCashReceived([]);
    setSelectedTask(null);
    fetchProjectDetail(project);
    setShowDetailModal(true);
  };

  const filteredProjects = projects.filter(p =>
    statusFilter === 'All' ? true : p.status === statusFilter
  );

  const calcFinancials = (project: Project) => {
    const revenue = project.revenue ?? 0;
    const estimatedCogs = project.estimated_cogs ?? 0;
    const actualCogs = expenses.reduce((s, x) => s + (x.amount ?? 0), 0);
    const netProfit = revenue - actualCogs;
    const designFeePct = project.design_fee_pct ?? 15;
    const designFee = (designFeePct / 100) * revenue;
    const incentive = 0.2 * netProfit;
    const commission = 0.015 * netProfit;
    const totalCashReceived = cashReceived.reduce((s, x) => s + (x.amount ?? 0), 0);
    const estimatedProfit = revenue - estimatedCogs;
    return {
      revenue, estimatedCogs, actualCogs, netProfit,
      designFeePct, designFee, incentive, commission,
      totalCashReceived, estimatedProfit,
    };
  };

  return (
    <div className="max-w-7xl mx-auto" style={{ fontFamily: FONT }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Projects</PHeading>
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>
            Browse all company projects
            {!showFinancials && ' — financial details visible to Finance team only'}
          </PText>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === opt
                  ? 'bg-primary text-background-base border-primary'
                  : 'bg-canvas border-contrast-low text-contrast-medium hover:text-primary hover:border-primary'
              }`}
              style={{ fontFamily: FONT }}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} className="mb-4" />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>Loading projects…</PText>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-surface rounded-2xl border border-contrast-low gap-3">
          <PIcon name="highway" size="large" color="contrast-low" />
          <PText color="contrast-medium" style={{ fontFamily: FONT }}>No projects found for this filter</PText>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
            const estProfit = (project.revenue ?? 0) - (project.estimated_cogs ?? 0);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => openDetail(project)}
                className="text-left bg-surface rounded-2xl border-2 border-contrast-low hover:border-primary focus:outline-none focus:border-primary transition-colors p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <PText size="small" weight="semi-bold" className="flex-1 line-clamp-2" style={{ fontFamily: FONT }}>
                    {project.name}
                  </PText>
                  <PTag color={STATUS_TAG_COLOR[project.status] || 'background-surface'} compact>{project.status}</PTag>
                </div>

                <div className="flex items-center gap-1.5">
                  <PIcon name="user" size="x-small" color="contrast-medium" />
                  <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>{project.client}</PText>
                </div>

                {project.description && (
                  <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {project.description}
                  </PText>
                )}

                {(project.start_date || project.end_date) && (
                  <div className="flex items-center gap-3">
                    {project.start_date && (
                      <div className="flex items-center gap-1">
                        <PIcon name="calendar" size="x-small" color="contrast-low" />
                        <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>{formatDate(project.start_date)}</PText>
                      </div>
                    )}
                    {project.start_date && project.end_date && (
                      <PIcon name="arrow-compact-right" size="x-small" color="contrast-low" />
                    )}
                    {project.end_date && (
                      <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>{formatDate(project.end_date)}</PText>
                    )}
                  </div>
                )}

                {showFinancials && (
                  <div className="flex items-center justify-between pt-2 border-t border-contrast-low">
                    <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>Revenue</PText>
                    <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>{formatINR(project.revenue ?? 0)}</PText>
                    <PText size="xx-small" color={estProfit >= 0 ? 'notification-success' : 'notification-error'} style={{ fontFamily: FONT }}>
                      {estProfit >= 0 ? '+' : ''}{formatINR(estProfit)}
                    </PText>
                  </div>
                )}

                <div className="flex items-center justify-end mt-auto">
                  <div className="flex items-center gap-1 text-xs text-contrast-medium" style={{ fontFamily: FONT }}>
                    View details
                    <PIcon name="arrow-head-right" size="x-small" color="contrast-medium" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <PModal
          open={showDetailModal}
          onDismiss={() => setShowDetailModal(false)}
          aria={{ 'aria-label': 'Project detail' }}
          style={{ '--p-modal-width': 'clamp(360px, 65vw, 860px)' } as React.CSSProperties}
        >
          <PHeading slot="header" size="large" tag="h2">{selectedProject.name}</PHeading>

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <PTag color={STATUS_TAG_COLOR[selectedProject.status] || 'background-surface'}>{selectedProject.status}</PTag>
              <div className="flex items-center gap-1.5">
                <PIcon name="user" size="x-small" color="contrast-medium" />
                <PText size="small" color="contrast-medium" style={{ fontFamily: FONT }}>{selectedProject.client}</PText>
              </div>
              {(selectedProject.start_date || selectedProject.end_date) && (
                <div className="flex items-center gap-1.5">
                  <PIcon name="calendar" size="x-small" color="contrast-medium" />
                  <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                    {formatDate(selectedProject.start_date)} — {formatDate(selectedProject.end_date)}
                  </PText>
                </div>
              )}
            </div>

            {selectedProject.description && (
              <div className="bg-canvas rounded-xl border border-contrast-low px-4 py-3">
                <PText size="small" color="contrast-high" style={{ fontFamily: FONT }}>{selectedProject.description}</PText>
              </div>
            )}

            {showFinancials && (
              <div className="flex gap-1 bg-surface rounded-xl border border-contrast-low p-1">
                {(['tasks', 'financials'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                      detailTab === tab
                        ? 'bg-primary text-background-base'
                        : 'text-contrast-medium hover:text-primary hover:bg-canvas'
                    }`}
                    style={{ fontFamily: FONT }}
                  >
                    {tab === 'financials' ? 'Financials' : 'Project Tasks'}
                  </button>
                ))}
              </div>
            )}

            {detailLoading ? (
              <div className="flex items-center justify-center h-32">
                <PText color="contrast-medium" style={{ fontFamily: FONT }}>Loading…</PText>
              </div>
            ) : (
              <>
                {(detailTab === 'tasks' || !showFinancials) && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>Project Tasks</PText>
                      <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                        {!isAdmin() ? `Showing your department's tasks` : `${detailTasks.length} tasks`}
                      </PText>
                    </div>

                    {detailTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 bg-canvas rounded-xl border-2 border-dashed border-contrast-low gap-2">
                        <PIcon name="list" size="medium" color="contrast-low" />
                        <PText color="contrast-medium" style={{ fontFamily: FONT }}>No tasks for your department in this project</PText>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {detailTasks.map(task => {
                          const progress = task.subtasks.length > 0 ? calcSubtaskProgress(task.subtasks) : task.progress;
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}
                              className="w-full text-left bg-canvas rounded-xl border border-contrast-low hover:border-primary transition-colors px-4 py-3 flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <PText size="small" weight="semi-bold" className="flex-1 line-clamp-2" style={{ fontFamily: FONT }}>{task.title}</PText>
                                <PTag variant={TASK_STATUS_VARIANT[task.effectiveStatus]} compact>
                                  {task.effectiveStatus === 'Completed' && task.overdueByDays
                                    ? `Completed (${task.overdueByDays}d late)`
                                    : task.effectiveStatus}
                                </PTag>
                              </div>
                              <div className="flex items-center gap-3">
                                <ProgressBar value={progress} />
                                <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>{progress}%</PText>
                              </div>
                              {task.deadline && (
                                <div className="flex items-center gap-1">
                                  <PIcon name="calendar" size="x-small" color="contrast-low" />
                                  <PText size="xx-small" color="contrast-low" style={{ fontFamily: FONT }}>Due {formatDate(task.deadline)}</PText>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {showFinancials && detailTab === 'financials' && (() => {
                  const f = calcFinancials(selectedProject);
                  return (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Revenue', value: formatINR(f.revenue) },
                          { label: 'Estimated COGS', value: formatINR(f.estimatedCogs) },
                          { label: 'Actual COGS', value: formatINR(f.actualCogs), sub: 'Sum of logged expenses' },
                          { label: 'Net Profit', value: formatINR(f.netProfit), highlight: true, sub: 'Revenue − Actual COGS' },
                        ].map(card => (
                          <div key={card.label} className={`rounded-xl border p-4 flex flex-col gap-1 ${card.highlight ? 'border-primary bg-surface' : 'border-contrast-low bg-canvas'}`}>
                            <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>{card.label}</PText>
                            <PText size="medium" weight="semi-bold" style={{ fontFamily: FONT }}>{card.value}</PText>
                            {card.sub && <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>{card.sub}</PText>}
                          </div>
                        ))}
                      </div>

                      <div className="bg-surface rounded-xl border border-contrast-low p-4">
                        <PText size="x-small" weight="semi-bold" className="mb-3" style={{ fontFamily: FONT }}>Derived Figures</PText>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: `Design Fee (${f.designFeePct}%)`, value: formatINR(f.designFee) },
                            { label: 'Incentive (20%)', value: formatINR(f.incentive) },
                            { label: 'Commission (1.5%)', value: formatINR(f.commission) },
                          ].map(card => (
                            <div key={card.label} className="rounded-xl border border-contrast-low bg-canvas p-3 flex flex-col gap-1">
                              <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>{card.label}</PText>
                              <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>{card.value}</PText>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-surface rounded-xl border border-contrast-low p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>Total Cash Received</PText>
                            <PText size="medium" weight="semi-bold" color="notification-success" style={{ fontFamily: FONT }}>{formatINR(f.totalCashReceived)}</PText>
                          </div>
                          <div className="text-right">
                            <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>Outstanding</PText>
                            <PText size="medium" weight="semi-bold" color={f.revenue - f.totalCashReceived > 0 ? 'notification-warning' : 'notification-success'} style={{ fontFamily: FONT }}>
                              {formatINR(Math.max(0, f.revenue - f.totalCashReceived))}
                            </PText>
                          </div>
                        </div>
                      </div>

                      {expenses.length > 0 && (
                        <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
                          <div className="px-4 py-3 border-b border-contrast-low">
                            <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>Expenses ({expenses.length})</PText>
                          </div>
                          <div className="divide-y divide-contrast-low">
                            {expenses.map(exp => (
                              <div key={exp.id} className="flex items-center justify-between px-4 py-2">
                                <div>
                                  <PText size="x-small" style={{ fontFamily: FONT }}>{exp.description}</PText>
                                  <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>{formatDate(exp.expense_date)}</PText>
                                </div>
                                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>{formatINR(exp.amount)}</PText>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <div slot="footer" className="flex justify-end">
            <PButton type="button" variant="secondary" onClick={() => setShowDetailModal(false)}>Close</PButton>
          </div>
        </PModal>
      )}

      {/* Task Detail Mini Modal */}
      {selectedTask && (
        <PModal
          open={showTaskModal}
          onDismiss={() => setShowTaskModal(false)}
          aria={{ 'aria-label': 'Task detail' }}
          style={{ '--p-modal-width': 'clamp(320px, 45vw, 600px)' } as React.CSSProperties}
        >
          <PHeading slot="header" size="large" tag="h2">{selectedTask.title}</PHeading>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <PTag variant={TASK_STATUS_VARIANT[selectedTask.effectiveStatus]}>
                {selectedTask.effectiveStatus === 'Completed' && selectedTask.overdueByDays
                  ? `Completed (Overdue by ${selectedTask.overdueByDays} days)`
                  : selectedTask.effectiveStatus}
              </PTag>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>Deadline</PText>
                <PText size="small" style={{ fontFamily: FONT }}>{formatDate(selectedTask.deadline)}</PText>
              </div>
              {selectedTask.completed_at && (
                <div>
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" style={{ fontFamily: FONT }}>Completed</PText>
                  <PText size="small" style={{ fontFamily: FONT }}>{formatDate(selectedTask.completed_at)}</PText>
                </div>
              )}
            </div>

            {selectedTask.description && (
              <div className="bg-canvas rounded-xl border border-contrast-low px-4 py-3">
                <PText size="small" style={{ fontFamily: FONT }}>{selectedTask.description}</PText>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>Progress</PText>
                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                  {selectedTask.subtasks.length > 0 ? calcSubtaskProgress(selectedTask.subtasks) : selectedTask.progress}%
                </PText>
              </div>
              <ProgressBar value={selectedTask.subtasks.length > 0 ? calcSubtaskProgress(selectedTask.subtasks) : selectedTask.progress} />
            </div>

            {selectedTask.subtasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT }}>
                  Subtasks ({selectedTask.subtasks.filter(s => s.is_completed).length}/{selectedTask.subtasks.length})
                </PText>
                <div className="flex flex-col gap-1.5">
                  {selectedTask.subtasks.map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-canvas border border-contrast-low">
                      <PIcon name={sub.is_completed ? 'check' : 'close'} size="x-small" color={sub.is_completed ? 'notification-success' : 'contrast-low'} />
                      <PText size="small" color={sub.is_completed ? 'contrast-medium' : 'primary'} className={sub.is_completed ? 'line-through' : ''} style={{ fontFamily: FONT }}>
                        {sub.title}
                      </PText>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div slot="footer" className="flex justify-end">
            <PButton type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>Close</PButton>
          </div>
        </PModal>
      )}
    </div>
  );
}
