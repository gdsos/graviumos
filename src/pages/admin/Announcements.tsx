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
import { supabase, type Announcement, type Department } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "inherit";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5 uppercase tracking-wide"
        style={{ fontFamily: FONT }}
      >
        {label}{required && <span className="text-notification-error ml-0.5">*</span>}
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

  return (
    <span title={d.toLocaleString('en-IN')} style={{ fontFamily: FONT }}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Announcements() {
  const { profile, departments, isAdmin } = useAuth();
  const canManage = isAdmin();

  const [announcements, setAnnouncements] = useState<AnnouncementWithDept[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewAnnouncementForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementWithDept | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

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

    // Enrich with department info
    const deptIds = [...new Set(list.map(a => a.target_department_id).filter(Boolean))];
    let deptMap: Record<string, Department> = {};
    if (deptIds.length > 0) {
      const { data: depts } = await supabase
        .from('departments')
        .select('*')
        .in('id', deptIds as string[]);
      (depts || []).forEach((d: Department) => { deptMap[d.id] = d; });
    }

    // Also use departments already loaded in context
    departments.forEach(d => { deptMap[d.id] = d; });

    const enriched: AnnouncementWithDept[] = list.map(a => ({
      ...a,
      department: a.target_department_id ? deptMap[a.target_department_id] : undefined,
    }));

    setAnnouncements(enriched);
    setLoading(false);
  }, [departments]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // ── Expand/collapse ───────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Create Announcement ───────────────────────────────────────────────────

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
      .insert(payload)
      .select('id')
      .single();

    if (insertErr) {
      setModalError(insertErr.message);
      setSaving(false);
      return;
    }

    // ── Insert notification records ───────────────────────────────────────

    try {
      let targetUserIds: string[] = [];

      if (form.target_type === 'company') {
        // All active users
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_active', true);
        targetUserIds = ((allProfiles || []) as { id: string }[]).map(p => p.id);
      } else if (form.target_type === 'department' && form.target_department_id) {
        // Users in the selected department
        const { data: deptProfiles } = await supabase
          .from('profiles')
          .select('id')
          .contains('department_ids', [form.target_department_id])
          .eq('is_active', true);
        targetUserIds = ((deptProfiles || []) as { id: string }[]).map(p => p.id);
      }

      // Exclude the creator from notifications
      targetUserIds = targetUserIds.filter(id => id !== profile?.id);

      if (targetUserIds.length > 0) {
        const notifications = targetUserIds.map(userId => ({
          user_id: userId,
          title: form.title.trim(),
          message: form.content.trim().slice(0, 200),
          type: 'announcement' as const,
          is_read: false,
          link: `/admin/announcements`,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } catch {
      // Notifications are best-effort; don't block the flow
    }

    setSaving(false);
    setShowModal(false);
    setNotification({ type: 'success', message: `Announcement "${form.title}" published successfully.` });
    fetchAnnouncements();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

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

    setNotification({ type: 'success', message: `Announcement deleted.` });
    setAnnouncements(prev => prev.filter(a => a.id !== deleteTarget.id));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Announcements</PHeading>
          <PText color="contrast-medium">
            {canManage
              ? 'Post and manage company-wide or department-specific announcements.'
              : 'Stay updated with the latest company news and notices.'}
          </PText>
        </div>
        {canManage && (
          <PButton icon="add" onClick={openCreate}>
            New Announcement
          </PButton>
        )}
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mb-6">
          <PInlineNotification
            heading={notification.type === 'success' ? 'Success' : 'Error'}
            description={notification.message}
            state={notification.type === 'success' ? 'success' : 'error'}
            dismissButton
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <PText color="contrast-medium">Loading announcements…</PText>
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-surface rounded-xl border border-contrast-low">
          <PIcon name="information" size="large" color="contrast-low" />
          <PText color="contrast-medium" className="mt-3">No announcements yet.</PText>
          {canManage && (
            <PButton variant="tertiary" icon="add" onClick={openCreate} className="mt-3">
              Post the first announcement
            </PButton>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map(announcement => {
            const isExpanded = expandedIds.has(announcement.id);
            const isLong = announcement.content.length > 200;
            const preview = isLong && !isExpanded
              ? announcement.content.slice(0, 200).trimEnd() + '…'
              : announcement.content;

            const isCompanyWide = announcement.target_type === 'company';

            return (
              <div
                key={announcement.id}
                className="bg-surface rounded-xl border border-contrast-low overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Card header */}
                <div
                  className="px-5 pt-5 pb-3 cursor-pointer select-none"
                  onClick={() => isLong && toggleExpand(announcement.id)}
                  role={isLong ? 'button' : undefined}
                  tabIndex={isLong ? 0 : undefined}
                  onKeyDown={e => { if (isLong && (e.key === 'Enter' || e.key === ' ')) toggleExpand(announcement.id); }}
                  aria-expanded={isLong ? isExpanded : undefined}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-notification-info-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                        <PIcon name="information" size="x-small" color="notification-info" />
                      </div>
                      <div className="min-w-0">
                        <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }} className="leading-snug">
                          {announcement.title}
                        </PText>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <PTag
                            color={isCompanyWide ? 'notification-info-soft' : 'notification-warning-soft'}
                          >
                            {isCompanyWide
                              ? 'Company-wide'
                              : announcement.department?.name ?? 'Department'}
                          </PTag>
                          <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                            <RelativeTime date={announcement.created_at} />
                          </PText>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isLong && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpand(announcement.id); }}
                          className="p-1.5 rounded hover:bg-canvas transition-colors"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <PIcon
                            name={isExpanded ? 'arrow-head-up' : 'arrow-head-down'}
                            size="x-small"
                            color="contrast-medium"
                          />
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(announcement); }}
                          className="p-1.5 rounded hover:bg-notification-error-soft transition-colors"
                          title="Delete announcement"
                        >
                          <PIcon name="delete" size="x-small" color="notification-error" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content body */}
                <div className="px-5 pb-5">
                  <div
                    className="bg-canvas rounded-lg p-4 border border-contrast-low"
                    style={{ fontFamily: FONT }}
                  >
                    <PText size="small" color="contrast-medium" style={{ fontFamily: FONT, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {preview}
                    </PText>
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(announcement.id)}
                        className="mt-2 text-xs font-medium text-primary hover:underline transition-colors"
                        style={{ fontFamily: FONT }}
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Announcement Modal ────────────────────────────────────────── */}
      <PModal
        open={showModal}
        onDismiss={() => !saving && setShowModal(false)}
        heading="New Announcement"
        aria={{ 'aria-label': 'Create announcement' }}
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          {modalError && (
            <PInlineNotification
              heading="Please fix the following"
              description={modalError}
              state="error"
              dismissButton={false}
            />
          )}

          {/* Title */}
          <FormField label="Title" required>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="form-input"
              placeholder="e.g. Office closed on Monday"
              maxLength={200}
            />
          </FormField>

          {/* Content */}
          <FormField label="Content" required>
            <textarea
              required
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={5}
              className="form-input resize-none"
              placeholder="Write the full announcement here…"
            />
          </FormField>

          {/* Target type */}
          <FormField label="Audience">
            <div className="flex flex-col gap-2.5 pt-1">
              <label
                className="flex items-center gap-2.5 cursor-pointer group"
                style={{ fontFamily: FONT }}
              >
                <input
                  type="radio"
                  name="target_type"
                  value="company"
                  checked={form.target_type === 'company'}
                  onChange={() => setForm(f => ({ ...f, target_type: 'company', target_department_id: '' }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-contrast-high group-hover:text-primary transition-colors">
                  Company-wide — visible to all employees
                </span>
              </label>
              <label
                className="flex items-center gap-2.5 cursor-pointer group"
                style={{ fontFamily: FONT }}
              >
                <input
                  type="radio"
                  name="target_type"
                  value="department"
                  checked={form.target_type === 'department'}
                  onChange={() => setForm(f => ({ ...f, target_type: 'department' }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-contrast-high group-hover:text-primary transition-colors">
                  Department-specific — only visible to selected department
                </span>
              </label>
            </div>
          </FormField>

          {/* Department picker */}
          {form.target_type === 'department' && (
            <FormField label="Select Department" required>
              <select
                required
                value={form.target_department_id}
                onChange={e => setForm(f => ({ ...f, target_department_id: e.target.value }))}
                className="form-input"
              >
                <option value="">Choose a department…</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* Info about notifications */}
          <PInlineNotification
            heading="Notifications will be sent"
            description={
              form.target_type === 'company'
                ? 'All active employees will receive an in-app notification.'
                : form.target_department_id
                  ? `All active members of the selected department will be notified.`
                  : 'Members of the selected department will be notified.'
            }
            state="info"
            dismissButton={false}
          />

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              Cancel
            </PButton>
            <PButton type="submit" loading={saving} icon="bell">
              Publish
            </PButton>
          </div>
        </form>
      </PModal>

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      <PModal
        open={!!deleteTarget}
        onDismiss={() => !deleting && setDeleteTarget(null)}
        heading="Delete Announcement"
        aria={{ 'aria-label': 'Delete announcement confirmation' }}
      >
        <div className="flex flex-col gap-4">
          <PInlineNotification
            heading="This cannot be undone"
            description={`Are you sure you want to delete "${deleteTarget?.title}"? This will permanently remove it for all users.`}
            state="warning"
            dismissButton={false}
          />
          <div className="flex gap-3 justify-end">
            <PButton
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </PButton>
            <PButton
              icon="delete"
              loading={deleting}
              onClick={handleDelete}
            >
              Delete
            </PButton>
          </div>
        </div>
      </PModal>
    </div>
  );
}
