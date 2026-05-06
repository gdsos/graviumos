import { useState, useEffect, useCallback } from 'react';
import { supabase, type Lead, type Profile, LEAD_SOURCES } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, ArrowRight, Settings } from 'lucide-react';
import { Button } from '../../components/ui/button';

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-slate-50 text-slate-700',
  Qualified: 'bg-blue-50 text-blue-700',
  Converted: 'bg-green-50 text-green-700',
  Rejected: 'bg-red-50 text-red-700',
  Ghosted: 'bg-amber-50 text-amber-700',
};

interface LeadWithProfile extends Lead {
  assignee?: Profile;
}

export default function Leads() {
  const { profile, departments, isAdmin, isDeptHead, isMS } = useAuth();
  const [leads, setLeads] = useState<LeadWithProfile[]>([]);
  const [msMembers, setMsMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertModal, setConvertModal] = useState<Lead | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      created_by: profile?.id,
    };

    let err;
    if (editingLead) {
      const { error: e } = await supabase.from('leads').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingLead.id);
      err = e;
    } else {
      const { error: e } = await supabase.from('leads').insert(payload);
      err = e;
    }

    if (err) { setError(err.message); return; }

    // If converted, show convert modal
    if (form.status === 'Converted' && !editingLead?.converted_project_id) {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(1);
      if (data?.[0]) setConvertModal(data[0] as Lead);
    }

    setShowModal(false);
    fetchLeads();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    fetchLeads();
  };

  const handleConvertToProject = () => {
    if (convertModal) navigate('/admin/projects', { state: { fromLead: convertModal } });
    setConvertModal(null);
  };

  const canDelete = isAdmin() || (isDeptHead() && isMS());

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Leads</h1>
          <span className="text-sm text-slate-600">Manage your CRM pipeline</span>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus size={16} />
          Add Lead
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <span className="text-sm text-slate-600">Loading...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-surface rounded-xl border border-contrast-low">
          <ArrowRight size={40} className="text-slate-300" />
          <span className="text-sm text-slate-600 mt-3">No leads yet. Add your first lead.</span>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-contrast-low">
                  {['Name', 'Contact', 'Source', 'Status', 'Assigned To', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <span className="text-xs text-slate-600 font-semibold uppercase tracking-wide">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold">{lead.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {lead.contact_email && <span className="text-xs text-slate-600 block">{lead.contact_email}</span>}
                        {lead.contact_phone && <span className="text-xs text-slate-600 block">{lead.contact_phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{lead.lead_source === 'Other' && lead.lead_source_custom ? lead.lead_source_custom : lead.lead_source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[lead.status] || 'bg-slate-50 text-slate-700'}`}>{lead.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{lead.assignee?.full_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {new Date(lead.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(lead)} className="p-1.5 rounded hover:bg-contrast-low transition-colors">
                          <Edit2 size={16} className="text-slate-600" />
                        </button>
                        {canDelete && (
                          <button onClick={() => handleDelete(lead.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors text-red-600">
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
      )}

      {/* Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">{editingLead ? 'Edit Lead' : 'Add Lead'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <FormField label="Name *">
                  <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="form-input" />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Email">
                    <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      className="form-input" />
                  </FormField>
                  <FormField label="Phone">
                    <input type="tel" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      className="form-input" />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Lead Source">
                    <select value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))} className="form-input">
                      {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  {form.lead_source === 'Other' && (
                    <FormField label="Custom Source">
                      <input type="text" value={form.lead_source_custom} onChange={e => setForm(f => ({ ...f, lead_source_custom: e.target.value }))}
                        className="form-input" placeholder="Specify source" />
                    </FormField>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Status">
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="form-input">
                      {['Open', 'Qualified', 'Converted', 'Rejected', 'Ghosted'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Assign To (MS only)">
                    <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="form-input">
                      <option value="">Unassigned</option>
                      {msMembers.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                    </select>
                  </FormField>
                </div>
                <FormField label="Notes">
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} className="form-input resize-none" />
                </FormField>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <Button type="submit">
                  {editingLead ? 'Save Changes' : 'Create Lead'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Project modal */}
      {convertModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold">Lead Converted!</h2>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm">The lead has been marked as Converted. Would you like to create a project from this lead?</p>
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setConvertModal(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                  Not Now
                </button>
                <Button onClick={handleConvertToProject} className="flex items-center gap-2">
                  <Settings size={16} />
                  Create Project
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-contrast-high mb-1.5"
        style={{ fontFamily: "'Neue Montreal', sans-serif" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
