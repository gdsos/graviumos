import { useState, useEffect, useCallback } from 'react';
import { supabase, type Announcement, type Department } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Info, Bell, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

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
      <label className="block text-xs font-medium text-slate-900 mb-1 uppercase tracking-wide">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
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

  return <span title={d.toLocaleString('en-IN')} className="text-xs text-slate-500">{label}</span>;
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
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Announcements</h1>
          <p className="text-sm text-slate-600 max-w-xl">
            {canManage
              ? 'Post and manage company-wide or department-specific announcements.'
              : 'Stay updated with the latest company news and notices.'}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="h-11">
            <Bell size={16} />
            New Announcement
          </Button>
        )}
      </div>

      {notification && (
        <div className={`mb-6 rounded-2xl border px-4 py-4 ${notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <p className="text-sm font-semibold">{notification.type === 'success' ? 'Success' : 'Error'}</p>
          <p className="text-sm mt-1">{notification.message}</p>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center h-48 rounded-3xl border border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600">Loading announcements…</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="grid place-items-center gap-4 h-48 rounded-3xl border border-slate-200 bg-slate-50 text-slate-600">
          <Info size={28} className="text-slate-400" />
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
              <div key={announcement.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Info size={18} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-slate-900 truncate">{announcement.title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={`rounded-full px-2.5 py-1 ${isCompanyWide ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900'}`}>
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
                          className="rounded-full p-2 text-slate-600 hover:bg-slate-100 transition-colors"
                          aria-label={isExpanded ? 'Collapse announcement' : 'Expand announcement'}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setDeleteTarget(announcement)}
                          className="rounded-full p-2 text-red-600 hover:bg-red-100 transition-colors"
                          aria-label="Delete announcement"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                    {preview}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Announcement</h2>
                <p className="text-sm text-slate-600">Create a new message for your organization.</p>
              </div>
              <button onClick={() => !saving && setShowModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 transition-colors">
                <ChevronUp size={18} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-6">
              {modalError && (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  {modalError}
                </div>
              )}
              <FormField label="Title" required>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  placeholder="e.g. Office closed on Monday"
                />
              </FormField>
              <FormField label="Content" required>
                <textarea
                  required
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={5}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none resize-none"
                  placeholder="Write the full announcement here…"
                />
              </FormField>
              <FormField label="Audience">
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-3xl border border-slate-200 px-4 py-3 cursor-pointer text-sm text-slate-900 hover:border-slate-900 transition-colors">
                    <input
                      type="radio"
                      name="target_type"
                      value="company"
                      checked={form.target_type === 'company'}
                      onChange={() => setForm(prev => ({ ...prev, target_type: 'company', target_department_id: '' }))}
                      className="h-4 w-4 accent-slate-900"
                    />
                    <span>Company-wide — visible to all active employees</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-3xl border border-slate-200 px-4 py-3 cursor-pointer text-sm text-slate-900 hover:border-slate-900 transition-colors">
                    <input
                      type="radio"
                      name="target_type"
                      value="department"
                      checked={form.target_type === 'department'}
                      onChange={() => setForm(prev => ({ ...prev, target_type: 'department' }))}
                      className="h-4 w-4 accent-slate-900"
                    />
                    <span>Department-specific — visible only to selected department</span>
                  </label>
                </div>
              </FormField>
              {form.target_type === 'department' && (
                <FormField label="Select department" required>
                  <select
                    required
                    value={form.target_department_id}
                    onChange={e => setForm(prev => ({ ...prev, target_department_id: e.target.value }))}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none"
                  >
                    <option value="">Choose a department…</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                    ))}
                  </select>
                </FormField>
              )}
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {form.target_type === 'company'
                  ? 'All active employees will receive an in-app notification.'
                  : form.target_department_id
                    ? 'All active members of the selected department will be notified.'
                    : 'Members of the selected department will be notified.'}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Bell size={16} />
                  {saving ? 'Publishing...' : 'Publish'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
                <Info size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Delete Announcement</h2>
                <p className="text-sm text-slate-600 mt-1">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Are you sure you want to delete “{deleteTarget.title}”? This will remove it for all users.
            </div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
