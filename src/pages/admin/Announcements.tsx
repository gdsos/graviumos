import { useState, useEffect, useCallback } from 'react';
import { supabase, type Announcement, type Department } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Check, Info, Bell, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';

interface AnnouncementWithDept extends Announcement {
  department?: Department;
}

interface NewAnnouncementForm {
  title: string;
  content: string;
  target_type: 'company' | 'department';
  target_department_id: string;
}

const emptyForm: NewAnnouncementForm = {
  title: '',
  content: '',
  target_type: 'company',
  target_department_id: '',
};

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}{required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function RelativeTime({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let label: string;
  if (diffMins < 1) label = 'just now';
  else if (diffMins < 60) label = `${diffMins}m ago`;
  else if (diffHours < 24) label = `${diffHours}h ago`;
  else if (diffDays === 1) label = 'yesterday';
  else if (diffDays < 7) label = `${diffDays} days ago`;
  else label = d.toLocaleDateString('en-IN');

  return <span title={d.toLocaleString('en-IN')} className="text-xs text-muted-foreground">{label}</span>;
}


interface AnnouncementOption {
  value: string;
  label: string;
}

function AnnouncementDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select',
}: {
  value: string;
  options: AnnouncementOption[];
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
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-foreground transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none"
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

export default function Announcements() {
  const { profile, departments, isAdmin } = useAuth();
  const canManage = isAdmin();

  const [announcements, setAnnouncements] = useState<AnnouncementWithDept[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewAnnouncementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementWithDept | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setNotification({ type: 'error', message: error.message });
      setLoading(false);
      return;
    }

    const list = (data as Announcement[]) || [];
    const deptIds = [...new Set(list.map(a => a.target_department_id).filter(Boolean))];
    let deptMap: Record<string, Department> = {};

    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .in('id', deptIds as string[]);
      (depts || []).forEach((dept: Department) => { deptMap[dept.id] = dept; });
    }

    departments.forEach(d => { deptMap[d.id] = d; });

    setAnnouncements(list.map(a => ({
      ...a,
      department: a.target_department_id ? deptMap[a.target_department_id] : undefined,
    })));
    setLoading(false);
  }, [departments]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setForm(emptyForm);
    setModalError('');
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setModalError('Title is required.'); return; }
    if (!form.content.trim()) { setModalError('Content is required.'); return; }
    if (form.target_type === 'department' && !form.target_department_id) {
      setModalError('Please select a department.');
      return;
    }

    setSaving(true);
    setModalError('');

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      target_type: form.target_type,
      target_department_id: form.target_type === 'department' ? form.target_department_id : null,
      created_by: profile?.id ?? null,
    };

    const { error: insertErr } = await supabase
      .from('announcements')
      .insert(payload);

    if (insertErr) {
      setModalError(insertErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    setNotification({ type: 'success', message: `Announcement "${form.title}" published successfully.` });
    fetchAnnouncements();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error: delErr } = await supabase
      .from('announcements')
      .delete()
      .eq('id', deleteTarget.id);

    setDeleting(false);
    setDeleteTarget(null);

    if (delErr) {
      setNotification({ type: 'error', message: delErr.message });
      return;
    }

    setNotification({ type: 'success', message: 'Announcement deleted.' });
    setAnnouncements(prev => prev.filter(a => a.id !== deleteTarget.id));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8 lg:pb-10">
      <div className="mb-8 border-b border-border pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              Gravium OS
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Announcements
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {canManage
                ? 'Post and manage company-wide or department-specific announcements.'
                : 'Stay updated with the latest company news and notices.'}
            </p>
          </div>

          {canManage && (
            <Button
              onClick={openCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium"
            >
              <Bell size={16} />
              New Announcement
            </Button>
          )}
        </div>
      </div>

      {notification && (
        <div className={`mb-6 rounded-2xl border px-4 py-4 ${notification.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>
          <p className="text-sm font-semibold">{notification.type === 'success' ? 'Success' : 'Error'}</p>
          <p className="text-sm mt-1">{notification.message}</p>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center h-48 rounded-3xl border border-dashed border-border bg-card/50">
          <p className="text-sm text-muted-foreground">Loading announcements…</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="grid place-items-center gap-4 h-48 rounded-3xl border border-dashed border-border bg-card/50 text-muted-foreground">
          <Info size={28} className="text-muted-foreground" />
          <p className="text-sm">No announcements yet.</p>
          {canManage && (
            <Button onClick={openCreate} variant="outline" className="mt-3">
              Post the first announcement
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(announcement => {
            const isExpanded = expandedIds.has(announcement.id);
            const isLong = announcement.content.length > 200;
            const preview = isLong && !isExpanded
              ? announcement.content.slice(0, 200).trimEnd() + '…'
              : announcement.content;
            const isCompanyWide = announcement.target_type === 'company';

            return (
              <div key={announcement.id} className="rounded-3xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Info size={18} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-foreground truncate">{announcement.title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={`rounded-full border px-2.5 py-1 font-semibold ${isCompanyWide ? 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                            {isCompanyWide ? 'Company-wide' : announcement.department?.name ?? 'Department'}
                          </span>
                          <RelativeTime date={announcement.created_at} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(announcement.id)}
                          className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
                          aria-label={isExpanded ? 'Collapse announcement' : 'Expand announcement'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setDeleteTarget(announcement)}
                          className="rounded-full p-2 text-destructive hover:bg-destructive/10 transition-colors"
                          aria-label="Delete announcement"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dashed border-border bg-card/50 p-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
                    {preview}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-none border border-border bg-card shadow-2xl sm:rounded-3xl">
            <div className="border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Announcement Setup
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    New Announcement
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a new message for your organization.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => !saving && setShowModal(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close announcement modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-5">
                  {modalError && (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
                      {modalError}
                    </div>
                  )}

                  <FormField label="Title" required>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                      className="form-input"
                      placeholder="e.g. Office closed on Monday"
                    />
                  </FormField>

                  <FormField label="Content" required>
                    <textarea
                      required
                      value={form.content}
                      onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                      rows={5}
                      className="form-textarea min-h-36 resize-none"
                      placeholder="Write the full announcement here..."
                    />
                  </FormField>

                  <FormField label="Audience">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/40">
                        <input
                          type="radio"
                          name="target_type"
                          value="company"
                          checked={form.target_type === 'company'}
                          onChange={() => setForm(prev => ({ ...prev, target_type: 'company', target_department_id: '' }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>Company-wide</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/40">
                        <input
                          type="radio"
                          name="target_type"
                          value="department"
                          checked={form.target_type === 'department'}
                          onChange={() => setForm(prev => ({ ...prev, target_type: 'department' }))}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>Department-specific</span>
                      </label>
                    </div>
                  </FormField>

                  {form.target_type === 'department' && (
                    <FormField label="Select department" required>
                      <AnnouncementDropdown
                        value={form.target_department_id}
                        onChange={value =>
                          setForm(prev => ({
                            ...prev,
                            target_department_id: value,
                          }))
                        }
                        placeholder="Choose a department..."
                        options={departments.map(dept => ({
                          value: dept.id,
                          label: `${dept.name} (${dept.code})`,
                        }))}
                      />
                    </FormField>
                  )}

                  <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {form.target_type === 'company'
                      ? 'All active employees will receive an in-app notification.'
                      : form.target_department_id
                        ? 'All active members of the selected department will be notified.'
                        : 'Members of the selected department will be notified.'}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-card/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                    className="h-10 rounded-xl"
                  >
                    Cancel
                  </Button>

                  <Button type="submit" disabled={saving} className="h-10 rounded-xl">
                    <Bell size={16} />
                    {saving ? 'Publishing...' : 'Publish'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-destructive">
                Delete Confirmation
              </p>

              <h2 className="text-lg font-semibold text-foreground">
                Delete Announcement?
              </h2>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-muted-foreground">
                This will remove ?{deleteTarget.title}? for all users. This action cannot be undone.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-10 rounded-xl"
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="h-10 rounded-xl"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
