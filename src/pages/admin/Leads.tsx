import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase, type Lead, type Profile, LEAD_SOURCES } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, ArrowRight, Mail, Phone, ChevronDown, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PhoneNumberInput } from '../../components/common/PhoneNumberInput';

const STATUS_VARIANTS: Record<string, 'info' | 'outline' | 'success' | 'danger' | 'warning' | 'muted'> = {
  Open: 'info',
  Qualified: 'outline',
  Converted: 'success',
  Rejected: 'danger',
  Ghosted: 'warning',
};

interface LeadWithProfile extends Lead {
  assignee?: Profile;
}

interface LeadsProps {
  eyebrow?: string;
  portalMode?: boolean;
}

export default function Leads({
  eyebrow = 'Marketing & Sales',
  portalMode = false,
}: LeadsProps = {}) {
  const { profile, departments, isAdmin, isDeptHead, isMS } = useAuth();
  const [leads, setLeads] = useState<LeadWithProfile[]>([]);
  const [msMembers, setMsMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [conversionNotice, setConversionNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<LeadWithProfile | null>(null);
  const [error, setError] = useState('');

  const msDept = departments.find(d => d.code === 'MS');

  const [form, setForm] = useState({
    name: '', contact_email: '', contact_phone: '',
    lead_source: 'Other', lead_source_custom: '',
    assigned_to: '', notes: '', status: 'Open',
  });

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const assigneeIds = [...new Set(data.map((l: Lead) => l.assigned_to).filter(Boolean))];
    let assignees: Profile[] = [];
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, department_ids')
        .in('id', assigneeIds as string[]);
      assignees = (profiles as Profile[]) || [];
    }

    const enriched = data.map((l: Lead) => ({
      ...l,
      assignee: assignees.find(a => a.id === l.assigned_to),
    }));
    setLeads(enriched);
    setLoading(false);
  }, []);

  const fetchMSMembers = useCallback(async () => {
    if (!msDept) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, department_ids, is_active')
      .contains('department_ids', [msDept.id])
      .eq('is_active', true);
    setMsMembers((data as Profile[]) || []);
  }, [msDept]);

  useEffect(() => {
    fetchLeads();
    fetchMSMembers();
  }, [fetchLeads, fetchMSMembers]);

  const openCreate = () => {
    setEditingLead(null);
    setForm({ name: '', contact_email: '', contact_phone: '', lead_source: 'Other', lead_source_custom: '', assigned_to: '', notes: '', status: 'Open' });
    setShowModal(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name, contact_email: lead.contact_email, contact_phone: lead.contact_phone,
      lead_source: lead.lead_source, lead_source_custom: lead.lead_source_custom,
      assigned_to: lead.assigned_to || '', notes: lead.notes, status: lead.status,
    });
    setShowModal(true);
  };

  const deleteProjectRequestNotifications = async (lead: Pick<Lead, 'id' | 'name'>) => {
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

  const createProjectRequestNotifications = async (lead: Lead) => {
    await deleteProjectRequestNotifications(lead);

    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'super_admin');

    if (adminError) {
      setError(adminError.message);
      return false;
    }

    const notifications = (admins || []).map(admin => ({
      user_id: admin.id,
      title: 'Project Creation Request',
      message: `${lead.name} is ready for project approval.`,
      type: 'project' as const,
      is_read: false,
      link: `/admin/projects?requestId=${lead.id}`,
    }));

    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notificationError) {
        setError(notificationError.message);
        return false;
      }
    }

    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConversionNotice('');

    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      created_by: profile?.id,
    };

    let savedLead: Lead | null = null;
    let err;

    if (editingLead) {
      const { data, error: updateError } = await supabase
        .from('leads')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingLead.id)
        .select()
        .maybeSingle();

      err = updateError;
      savedLead = (data as Lead | null) || null;
    } else {
      const { data, error: insertError } = await supabase
        .from('leads')
        .insert(payload)
        .select()
        .maybeSingle();

      err = insertError;
      savedLead = (data as Lead | null) || null;
    }

    if (err) {
      setError(err.message);
      return;
    }

    if (savedLead) {
      if (savedLead.status === 'Converted' && !savedLead.converted_project_id) {
        const requestCreated = await createProjectRequestNotifications(savedLead);

        if (!requestCreated) return;

        setConversionNotice('Project Creation request has been sent.');
      } else if (editingLead?.status === 'Converted' && savedLead.status !== 'Converted') {
        const notificationsDeleted = await deleteProjectRequestNotifications(savedLead);

        if (!notificationsDeleted) return;
      }
    }

    setShowModal(false);
    fetchLeads();
  };

  function canDeleteLead(lead: LeadWithProfile) {
    const isConvertedLead =
      lead.status === 'Converted' || Boolean(lead.converted_project_id);

    if (isConvertedLead) {
      return isAdmin();
    }

    return isAdmin() || (isDeptHead() && isMS());
  }

  const openDeleteLeadModal = (lead: LeadWithProfile) => {
    if (!canDeleteLead(lead)) {
      setError('Converted leads can only be deleted by an Admin.');
      return;
    }

    setDeleteTarget(lead);
  };

  const deleteLeadRelatedNotifications = async (lead: LeadWithProfile) => {
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

  const handleConfirmDeleteLead = async () => {
    if (!deleteTarget) return;

    setError('');

    if (!canDeleteLead(deleteTarget)) {
      setError('Converted leads can only be deleted by an Admin.');
      setDeleteTarget(null);
      return;
    }

    const notificationsDeleted = await deleteLeadRelatedNotifications(deleteTarget);

    if (!notificationsDeleted) return;

    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', deleteTarget.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setDeleteTarget(null);
    fetchLeads();
  };

  const canDelete = isAdmin() || (isDeptHead() && isMS());
  const openLeadCount = leads.filter(lead => lead.status === 'Open').length;
  const convertedLeadCount = leads.filter(lead => lead.status === 'Converted').length;
  const headerAction = (
    <Button onClick={openCreate} className="h-10 justify-center gap-2">
      <Plus size={16} />
      Add Lead
    </Button>
  );

  return (
    <div
      className={
        portalMode
          ? 'mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10'
          : 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'
      }
    >
      {conversionNotice && (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {conversionNotice}
        </div>
      )}

      {portalMode ? (
        <div className="mb-8 border-b border-border pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                {eyebrow}
              </p>

              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Leads
              </h1>

              <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                Manage client enquiries, assignments, and CRM pipeline status.
              </p>
            </div>

            {headerAction}
          </div>
        </div>
      ) : (
        <PageHeader
          eyebrow={eyebrow}
          title="Leads"
          description="Manage client enquiries, assignments, and CRM pipeline status."
          actions={headerAction}
        />
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <SectionCard className="shadow-none">
          <div>
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {leads.length}
            </p>
          </div>
        </SectionCard>

        <SectionCard className="shadow-none">
          <div>
            <p className="text-sm text-muted-foreground">Open Leads</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {openLeadCount}
            </p>
          </div>
        </SectionCard>

        <SectionCard className="col-span-2 shadow-none md:col-span-1">
          <div>
            <p className="text-sm text-muted-foreground">Converted Leads</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {convertedLeadCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ready for project conversion
            </p>
          </div>
        </SectionCard>
      </div>

      {loading ? (
        <SectionCard className="shadow-none">
          <div className="flex min-h-48 items-center justify-center">
            <span className="text-sm text-muted-foreground">Loading leads...</span>
          </div>
        </SectionCard>
      ) : leads.length === 0 ? (
        <EmptyState
          icon={ArrowRight}
          title="No leads yet"
          description="Add your first lead to start tracking enquiries and follow-ups."
          action={
            <Button onClick={openCreate} className="flex items-center gap-2">
              <Plus size={16} />
              Add Lead
            </Button>
          }
        />
      ) : (
        <>
          {/* ✅ MOBILE CARDS */}
              <div className="md:hidden space-y-3">
                {leads.map(lead => (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {lead.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>

                      <StatusBadge
                        variant={STATUS_VARIANTS[lead.status] || 'muted'}
                        className="ml-2 shrink-0"
                      >
                        {lead.status}
                      </StatusBadge>
                    </div>

                    {/* Contact */}
                    {(lead.contact_phone || lead.contact_email) && (
                      <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                        {lead.contact_phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {lead.contact_phone}
                          </span>
                        )}
                        {lead.contact_email && (
                          <span className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{lead.contact_email}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Meta and actions */}
                    <div className="mt-4 flex items-end justify-between">
                      {/* Meta */}
                      <div className="text-xs space-y-1">
                        <div>
                          <span className="text-muted-foreground">Source: </span>
                          <span className="font-medium text-foreground">
                            {lead.lead_source === 'Other' && lead.lead_source_custom
                              ? lead.lead_source_custom
                              : lead.lead_source}
                          </span>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Assigned: </span>
                          <span className="font-medium text-foreground">
                            {lead.assignee?.full_name || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Actions (tight + aligned) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(lead)}
                          className="p-2 rounded-md hover:bg-muted transition"
                        >
                          <Edit2 size={16} className="text-muted-foreground" />
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => openDeleteLeadModal(lead)}
                            className="p-2 rounded-md hover:bg-destructive/10 text-red-600 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

          {/* ✅ DESKTOP TABLE (UNCHANGED STRUCTURE) */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Name', 'Contact', 'Source', 'Status', 'Assigned To', 'Date', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left">
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                          {h}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-foreground">
                          {lead.name}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {lead.contact_email && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{lead.contact_email}</span>
                            </span>
                          )}
                          {lead.contact_phone && (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {lead.contact_phone}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs">
                          {lead.lead_source === 'Other' && lead.lead_source_custom
                            ? lead.lead_source_custom
                            : lead.lead_source}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge variant={STATUS_VARIANTS[lead.status] || 'muted'}>
                          {lead.status}
                        </StatusBadge>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs">
                          {lead.assignee?.full_name || '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(lead.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(lead)}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                          >
                            <Edit2 size={16} className="text-muted-foreground" />
                          </button>

                          {canDelete && (
                            <button
                              onClick={() => openDeleteLeadModal(lead)}
                              className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] pt-4 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[calc(100vh-7.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[90vh]">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
            </div>
            <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive">Error</p>
                  <p className="mt-1 text-sm text-destructive/80">{error}</p>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-6">
                <div className="grid grid-cols-1 gap-4">
                <FormField label="Name *">
                  <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="form-input" />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Email">
                    <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      className="form-input" />
                  </FormField>
                  <FormField label="Phone">
                    <PhoneNumberInput
                      value={form.contact_phone}
                      onChange={value => setForm(current => ({ ...current, contact_phone: value }))}
                    />
                  </FormField>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Lead Source">
                    <SuggestionSelect
                      value={form.lead_source}
                      options={LEAD_SOURCES.map(source => ({ value: source, label: source }))}
                      onChange={value => setForm(f => ({ ...f, lead_source: value }))}
                    />
                  </FormField>
                  {form.lead_source === 'Other' && (
                    <FormField label="Custom Source">
                      <input type="text" value={form.lead_source_custom} onChange={e => setForm(f => ({ ...f, lead_source_custom: e.target.value }))}
                        className="form-input" placeholder="Specify source" />
                    </FormField>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Status">
                    <SuggestionSelect
                      value={form.status}
                      options={['Open', 'Qualified', 'Converted', 'Rejected', 'Ghosted'].map(status => ({ value: status, label: status }))}
                      onChange={value => setForm(f => ({ ...f, status: value }))}
                    />
                  </FormField>
                  <FormField label="Assign To (MS only)">
                    <SuggestionSelect
                      value={form.assigned_to}
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...msMembers.map(member => ({
                          value: member.id,
                          label: member.full_name || member.email,
                        })),
                      ]}
                      onChange={value => setForm(f => ({ ...f, assigned_to: value }))}
                    />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} className="form-input resize-none" />
                </FormField>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-card px-5 py-4 sm:ml-auto sm:flex sm:w-auto sm:min-w-[17rem]">
                <ModalActionButton onClick={() => setShowModal(false)}>
                  Cancel
                </ModalActionButton>
                <ModalActionButton type="submit" variant="primary">
                  {editingLead ? 'Save Changes' : 'Create Lead'}
                </ModalActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Lead confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold text-foreground">
              Delete lead?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This will remove {deleteTarget.name}. Related project request notifications will also be cleared.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <ModalActionButton onClick={() => setDeleteTarget(null)}>
                Cancel
              </ModalActionButton>

              <ModalActionButton onClick={handleConfirmDeleteLead} variant="primary">
                Delete Lead
              </ModalActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ModalActionButtonVariant = 'primary' | 'secondary';

function ModalActionButton({
  children,
  type = 'button',
  variant = 'secondary',
  onClick,
}: {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  variant?: ModalActionButtonVariant;
  onClick?: () => void;
}) {
  const variantClass =
    variant === 'primary'
      ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90'
      : 'border-border bg-background text-foreground hover:bg-muted';

  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-0 text-center text-sm font-medium leading-none transition-colors ${variantClass}`}
    >
      {children}
    </button>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

interface SuggestionSelectOption {
  value: string;
  label: string;
}

function SuggestionSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SuggestionSelectOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find(option => option.value === value);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return;

    setMenuRect(rect);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setMenuRect(null);
  };

  const menu =
    isOpen && menuRect && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[90]" onMouseDown={closeMenu}>
            <div
              className="fixed max-h-60 overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
              style={{
                top: menuRect.bottom + 8,
                left: menuRect.left,
                width: menuRect.width,
              }}
              onMouseDown={event => event.stopPropagation()}
            >
              {options.map(option => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      closeMenu();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                      isSelected ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={isOpen ? closeMenu : openMenu}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition hover:bg-muted/40 focus:border-foreground"
      >
        <span className={selectedOption ? 'truncate' : 'truncate text-muted-foreground'}>
          {selectedOption?.label || 'Select'}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {menu}
    </>
  );
}
