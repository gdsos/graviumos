import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { ArrowLeft, ChevronDown, ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Lead, type Project } from '../../lib/supabase';
import type { ProjectWorkspaceMode } from './projectTypes';

interface ProjectWorkspaceProps {
  mode: ProjectWorkspaceMode;
}

const STATUS_STYLES: Record<string, string> = {
  Active: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Completed: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'On Hold': 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  Cancelled: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const PROJECT_STATUSES = ['All Statuses', 'Active', 'Completed', 'On Hold', 'Cancelled'] as const;
const PROJECT_FORM_STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled'] as const;

type ProjectStatus = (typeof PROJECT_FORM_STATUSES)[number];
type ProjectStatusFilter = (typeof PROJECT_STATUSES)[number];

type FloatingMenuState =
  | { type: 'status-filter'; top: number; left: number; width: number }
  | { type: 'project-status'; top: number; left: number; width: number }
  | { type: 'project-actions'; top: number; right: number; project: Project };


interface ProjectFormState {
  name: string;
  client: string;
  status: ProjectStatus;
  description: string;
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  name: '',
  client: '',
  status: 'Active',
  description: '',
};

function getProjectStatusClass(status: string | null | undefined) {
  return STATUS_STYLES[status || ''] || 'border-border bg-muted text-muted-foreground';
}

function getProjectFormFromRecord(project: Project): ProjectFormState {
  return {
    name: project.name || '',
    client: project.client || '',
    status: project.status || 'Active',
    description: project.description || '',
  };
}

function getRouteBase(mode: ProjectWorkspaceMode) {
  return mode === 'admin' ? '/admin' : '/portal';
}

function createProjectLinks(mode: ProjectWorkspaceMode, projectId: string) {
  const base = getRouteBase(mode);
  const query = `?projectId=${encodeURIComponent(projectId)}`;

  return [
    {
      label: 'Tasks',
      description: 'Project tasks and execution responsibilities.',
      to: `${base}/tasks${query}`,
    },
    {
      label: 'Cost Estimate',
      description: 'Project-linked estimate workspace.',
      to: `${base}/cost-estimates${query}`,
    },
    {
      label: 'Timeline',
      description: 'Planning, schedule, and execution timeline.',
      to: `${base}/timeline${query}`,
    },
    {
      label: 'Project Finance',
      description: 'Dedicated project accounts workspace.',
      to: `${base}/financials${query}`,
    },
  ];
}

export default function ProjectWorkspace({ mode }: ProjectWorkspaceProps) {
  const { profile, isAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectRequests, setProjectRequests] = useState<Lead[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('All Statuses');
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectForm, setProjectForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [modalError, setModalError] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);

  const isAdminMode = mode === 'admin';
  const canManageProjects = isAdminMode && isAdmin();

  async function fetchProjects() {
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setProjects([]);
    } else {
      setProjects((data || []) as Project[]);
    }

    setLoading(false);
  }

  async function fetchProjectRequests() {
    if (!canManageProjects) {
      setProjectRequests([]);
      return;
    }

    const { data, error: requestError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'Converted')
      .is('converted_project_id', null)
      .order('updated_at', { ascending: false });

    if (requestError) {
      setError(requestError.message);
      setProjectRequests([]);
      return;
    }

    setProjectRequests((data || []) as Lead[]);
  }

  useEffect(() => {
    let isMounted = true;

    async function runFetchProjects() {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
        setProjects([]);
      } else {
        setProjects((data || []) as Project[]);
      }

      if (canManageProjects) {
        const { data: requestData, error: requestError } = await supabase
          .from('leads')
          .select('*')
          .eq('status', 'Converted')
          .is('converted_project_id', null)
          .order('updated_at', { ascending: false });

        if (!requestError) {
          setProjectRequests((requestData || []) as Lead[]);
        }
      }

      setLoading(false);
    }

    void runFetchProjects();

    return () => {
      isMounted = false;
    };
  }, [canManageProjects]);

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return projects.filter(project => {
      const matchesStatus =
        statusFilter === 'All Statuses' || project.status === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      const haystack = [
        project.name,
        project.client,
        project.status,
        project.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [projects, searchTerm, statusFilter]);

  const openStatusFilterMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'status-filter',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  const openProjectStatusMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'project-status',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  const openProjectActionsMenu = (
    event: MouseEvent<HTMLButtonElement>,
    project: Project
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setFloatingMenu({
      type: 'project-actions',
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
      project,
    });
  };


  const openCreateProjectModal = () => {
    if (!canManageProjects) return;

    setEditingProject(null);
    setProjectForm(EMPTY_PROJECT_FORM);
    setModalError('');
    setIsProjectModalOpen(true);
  };

  const openEditProjectModal = (project: Project) => {
    if (!canManageProjects) return;

    setEditingProject(project);
    setProjectForm(getProjectFormFromRecord(project));
    setModalError('');
    setFloatingMenu(null);
    setIsProjectModalOpen(true);
  };

  const closeProjectModal = () => {
    if (isSavingProject) return;

    setIsProjectModalOpen(false);
    setEditingProject(null);
    setProjectForm(EMPTY_PROJECT_FORM);
    setModalError('');
  };

  const updateProjectForm = <Key extends keyof ProjectFormState>(
    key: Key,
    value: ProjectFormState[Key]
  ) => {
    setProjectForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSaveProject = async () => {
    if (!canManageProjects) return;

    const name = projectForm.name.trim();
    const client = projectForm.client.trim();
    const description = projectForm.description.trim();

    if (!name) {
      setModalError('Project name is required.');
      return;
    }

    if (!client) {
      setModalError('Client name is required.');
      return;
    }

    setIsSavingProject(true);
    setModalError('');

    const operationalPayload = {
      name,
      client,
      status: projectForm.status,
      description,
      updated_at: new Date().toISOString(),
    };

    const { data, error: saveError } = editingProject
      ? await supabase
          .from('projects')
          .update(operationalPayload)
          .eq('id', editingProject.id)
          .select()
      : await supabase
          .from('projects')
          .insert({
            ...operationalPayload,
            start_date: null,
            end_date: null,
            revenue: 0,
            estimated_cogs: 0,
            design_fee_pct: 0,
            created_by: profile?.id || null,
          })
          .select();

    setIsSavingProject(false);

    if (saveError) {
      setModalError(saveError.message);
      return;
    }

    const savedProject = data?.[0] as Project | undefined;

    if (savedProject) {
      setProjects(current => {
        if (editingProject) {
          return current.map(project =>
            project.id === savedProject.id ? savedProject : project
          );
        }

        return [savedProject, ...current];
      });

      setSelectedProject(current =>
        current?.id === savedProject.id ? savedProject : current
      );
    } else {
      await fetchProjects();
    }

    closeProjectModal();
  };

  const handleDeleteProject = async () => {
    if (!canManageProjects || !deleteTarget) return;

    const targetId = deleteTarget.id;
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', targetId);

    if (deleteError) {
      setError(deleteError.message);
      setDeleteTarget(null);
      return;
    }

    setProjects(current => current.filter(project => project.id !== targetId));
    setSelectedProject(current => (current?.id === targetId ? null : current));
    setDeleteTarget(null);
    setFloatingMenu(null);
  };


  const deleteProjectRequestNotifications = async (lead: Lead) => {
    const links = [
      `/admin/projects?requestId=${lead.id}`,
      '/admin/projects',
    ];

    const { error: exactDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'project')
      .eq('title', 'Project Creation Request')
      .in('link', links);

    if (exactDeleteError) {
      setError(exactDeleteError.message);
      return false;
    }

    const { error: legacyDeleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'project')
      .eq('title', 'Project Creation Request')
      .ilike('message', `%${lead.name}%`);

    if (legacyDeleteError) {
      setError(legacyDeleteError.message);
      return false;
    }

    return true;
  };

  const handleApproveProjectRequest = async (lead: Lead) => {
    if (!canManageProjects) return;

    setError('');

    const { data, error: createError } = await supabase
      .from('projects')
      .insert({
        name: lead.name,
        client: lead.name,
        status: 'Active',
        description: lead.notes || '',
        start_date: null,
        end_date: null,
        revenue: 0,
        estimated_cogs: 0,
        design_fee_pct: 0,
        created_from_lead_id: lead.id,
        created_by: profile?.id || null,
      })
      .select();

    if (createError) {
      setError(createError.message);
      return;
    }

    const createdProject = data?.[0] as Project | undefined;

    if (!createdProject) {
      await fetchProjects();
      await fetchProjectRequests();
      return;
    }

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        converted_project_id: createdProject.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (leadUpdateError) {
      setError(leadUpdateError.message);
      return;
    }

    await deleteProjectRequestNotifications(lead);

    setProjects(current => [createdProject, ...current]);
    setProjectRequests(current => current.filter(request => request.id !== lead.id));
    setSelectedProject(createdProject);
  };

  const handleDeclineProjectRequest = async (lead: Lead) => {
    if (!canManageProjects) return;

    setError('');

    const { error: leadUpdateError } = await supabase
      .from('leads')
      .update({
        status: 'Qualified',
        converted_project_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    if (leadUpdateError) {
      setError(leadUpdateError.message);
      return;
    }

    const notificationsDeleted = await deleteProjectRequestNotifications(lead);

    if (!notificationsDeleted) return;

    setProjectRequests(current => current.filter(request => request.id !== lead.id));
  };

  const projectModal = isProjectModalOpen && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4 sm:p-6">
          <div>
            <p className="text-lg font-semibold text-foreground">
              {editingProject ? 'Edit Project' : 'Create Project'}
            </p>
          </div>

          <button
            type="button"
            onClick={closeProjectModal}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close project modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {modalError && (
            <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{modalError}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Project Name
              </label>
              <input
                value={projectForm.name}
                onChange={event => updateProjectForm('name', event.target.value)}
                placeholder="Enter project name"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className={editingProject ? '' : 'sm:col-span-2'}>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Client
              </label>
              <input
                value={projectForm.client}
                onChange={event => updateProjectForm('client', event.target.value)}
                placeholder="Client name"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {editingProject && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Project Status
                </label>
                <button
                  type="button"
                  onClick={openProjectStatusMenu}
                  className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
                >
                  <span className="truncate">{projectForm.status}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Notes
              </label>
              <textarea
                value={projectForm.description}
                onChange={event => updateProjectForm('description', event.target.value)}
                placeholder="Optional project notes"
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" variant="outline" onClick={closeProjectModal}>
            Cancel
          </Button>

          <Button type="button" onClick={handleSaveProject} disabled={isSavingProject}>
            {isSavingProject
              ? 'Saving...'
              : editingProject
                ? 'Save Changes'
                : 'Create Project'}
          </Button>
        </div>
      </div>
    </div>
  );

  const deleteDialog = deleteTarget && (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
        <h2 className="text-lg font-semibold text-foreground">
          Delete project?
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This will remove the project. Existing finance migration data should be reviewed before deleting production data.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteProject}
          >
            Delete Project
          </Button>
        </div>
      </div>
    </div>
  );


  const floatingMenuLayer = floatingMenu && (
    <div
      className="fixed inset-0 z-[80]"
      onClick={() => setFloatingMenu(null)}
    >
      {floatingMenu.type === 'status-filter' && (
        <div
          className="fixed max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            left: floatingMenu.left,
            width: floatingMenu.width,
          }}
          onClick={event => event.stopPropagation()}
        >
          {PROJECT_STATUSES.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setFloatingMenu(null);
              }}
              className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                statusFilter === status ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {floatingMenu.type === 'project-status' && (
        <div
          className="fixed max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            left: floatingMenu.left,
            width: floatingMenu.width,
          }}
          onClick={event => event.stopPropagation()}
        >
          {PROJECT_FORM_STATUSES.map(status => (
            <button
              key={status}
              type="button"
              onClick={() => {
                updateProjectForm('status', status);
                setFloatingMenu(null);
              }}
              className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                projectForm.status === status ? 'bg-muted text-foreground' : 'text-muted-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      )}

      {floatingMenu.type === 'project-actions' && (
        <div
          className="fixed w-40 overflow-hidden rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
          style={{
            top: floatingMenu.top,
            right: floatingMenu.right,
          }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEditProjectModal(floatingMenu.project)}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteTarget(floatingMenu.project);
              setFloatingMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );

  if (selectedProject) {
    const projectLinks = createProjectLinks(mode, selectedProject.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedProject(null)}
              className="mb-3 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>

            <h1 className="text-2xl font-semibold text-foreground">
              {selectedProject.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedProject.client || 'Client not set'}
            </p>
          </div>

          {canManageProjects && (
            <Button
              type="button"
              variant="outline"
              onClick={() => openEditProjectModal(selectedProject)}
              className="w-fit gap-2"
            >
              <Pencil className="h-4 w-4" />
              Edit Project
            </Button>
          )}
        </div>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Project Overview
                </h2>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getProjectStatusClass(selectedProject.status)}`}
                >
                  {selectedProject.status || 'Not set'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Client
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {selectedProject.client || 'Not set'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Project Status
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {selectedProject.status || 'Not set'}
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Timeline
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Yet to Approve
                </p>
              </div>
            </div>

            {selectedProject.description && (
              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {selectedProject.description}
                </p>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Linked Workspaces
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {projectLinks.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {link.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {link.description}
                      </p>
                    </div>

                    <ExternalLink
                      size={16}
                      className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {floatingMenuLayer}
        {projectModal}
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-7 border-b border-border pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              {isAdminMode ? 'Admin Operations' : 'Portal Operations'}
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Projects
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Open project-linked workspaces across tasks, estimates, timeline, and finance.
            </p>
          </div>

          {canManageProjects && (
            <Button type="button" onClick={openCreateProjectModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>
      </div>

      {canManageProjects && projectRequests.length > 0 && (
        <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-foreground">
              Project Creation Requests
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Converted leads waiting for Admin approval.
            </p>
          </div>

          <div className="divide-y divide-border">
            {projectRequests.map(request => (
              <div
                key={request.id}
                className="grid gap-3 bg-background px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {request.name}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {request.contact_phone || request.contact_email || 'No contact saved'}
                  </p>
                  {request.notes && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {request.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDeclineProjectRequest(request)}
                    className="h-10 justify-center whitespace-nowrap"
                  >
                    Decline
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleApproveProjectRequest(request)}
                    className="h-10 justify-center whitespace-nowrap"
                  >
                    Approve and Create
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:p-5">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search projects..."
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          <div className="relative w-full md:w-64">
            <button
              type="button"
              onClick={openStatusFilterMenu}
              className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
            >
              <span className="truncate">{statusFilter}</span>
              <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
            </button>
          </div>

          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground md:ml-auto">
            {filteredProjects.length} Projects
          </div>
        </div>

        {error && (
          <div className="border-b border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center p-6">
            <p className="text-sm text-muted-foreground">Loading projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <p className="text-sm font-medium text-foreground">No projects found</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Project
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Client
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Timeline
                    </th>
                    {canManageProjects && (
                      <th className="w-14 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        More
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filteredProjects.map(project => (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <td className="px-5 py-4">
                        <div className="text-left">
                          <p className="font-semibold text-foreground">{project.name}</p>
                          {project.description && (
                            <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        {project.client || 'Not set'}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getProjectStatusClass(project.status)}`}
                        >
                          {project.status || 'Not set'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-muted-foreground">
                        Yet to Approve
                      </td>

                      {canManageProjects && (
                        <td className="relative px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              openProjectActionsMenu(event, project);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Project menu"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredProjects.map(project => (
                <div key={project.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(project)}
                    className="w-full p-4 text-left transition-colors active:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3 pr-12">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {project.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {project.client || 'Client not set'}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${getProjectStatusClass(project.status)}`}
                      >
                        {project.status || 'Not set'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground">
                      Timeline: Yet to Approve
                    </div>
                  </button>

                  {canManageProjects && (
                    <div className="absolute right-4 top-4">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation();
                          openProjectActionsMenu(event, project);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Project menu"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {floatingMenuLayer}
        {projectModal}
      {deleteDialog}
    </div>
  );
}
