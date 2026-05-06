import { useState, useEffect, useCallback } from 'react';
import { supabase, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PButton, PHeading, PInlineNotification, PModal, PTag, PText, PIcon, PSwitch } from '@/components/ui/porsche';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

// ——— Types ———————————————————————————————————————————————————————————————————

interface ProfileWithDepts extends Profile {
  departmentNames: string[];
}

interface EmployeeForm {
  full_name: string;
  email: string;
  password: string;
  role: 'department_head' | 'employee';
  department_ids: string[];
  base_salary: string;
  phone: string;
  address: string;
  tds_enabled: boolean;
  pf_enabled: boolean;
  esi_enabled: boolean;
  professional_tax_enabled: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  department_head: 'Dept. Head',
  employee: 'Employee',
};

const ROLE_COLORS: Record<string, Parameters<typeof PTag>[0]['color']> = {
  super_admin: 'notification-error-soft',
  department_head: 'notification-warning-soft',
  employee: 'notification-info-soft',
};

const EMPTY_FORM: EmployeeForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'employee',
  department_ids: [],
  base_salary: '',
  phone: '',
  address: '',
  tds_enabled: false,
  pf_enabled: false,
  esi_enabled: false,
  professional_tax_enabled: false,
};

// ——— Employee Code Generation —————————————————————————————————————————————————

async function generateEmployeeCode(deptCode: string): Promise<string> {
  const year = new Date().getFullYear();

  const { data: existing } = await supabase
    .from('employee_code_sequences')
    .select('last_number')
    .eq('dept_code', deptCode)
    .eq('year', year)
    .maybeSingle();

  const nextNumber = (existing?.last_number ?? 0) + 1;

  await supabase
    .from('employee_code_sequences')
    .upsert(
      { dept_code: deptCode, year, last_number: nextNumber },
      { onConflict: 'dept_code,year' }
    );

  return `GDS${year}${deptCode}${nextNumber}`;
}

// ——— FormField helper —————————————————————————————————————————————————————————

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium text-contrast-high mb-1.5"
        style={{ fontFamily: "'Neue Montreal', sans-serif" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ——— Main Component ———————————————————————————————————————————————————————————

export default function People() {
  const { profile: _currentUserProfile, departments, isAdmin, suppressAuthChanges } = useAuth();

  const [employees, setEmployees] = useState<ProfileWithDepts[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDeptId, setFilterDeptId] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [previewCode, setPreviewCode] = useState<string>('');
  const [generatingCode, setGeneratingCode] = useState(false);

  // Feedback
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deptHeadWarning, setDeptHeadWarning] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ——— Fetch ——————————————————————————————————————————————————————————————————

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (fetchErr || !data) {
      setLoading(false);
      return;
    }

    const enriched: ProfileWithDepts[] = (data as Profile[]).map(emp => ({
      ...emp,
      departmentNames: (emp.department_ids ?? [])
        .map(id => departments.find(d => d.id === id)?.name ?? '')
        .filter(Boolean),
    }));

    setEmployees(enriched);
    setLoading(false);
  }, [departments]);

  useEffect(() => {
    if (departments.length > 0) fetchEmployees();
  }, [fetchEmployees, departments]);

  // ——— Department head check ———————————————————————————————————————————————————

  const checkDeptHeadConflict = useCallback(
    (newRole: string, selectedDeptIds: string[], excludeId?: string): string => {
      if (newRole !== 'department_head') return '';
      const conflicts: string[] = [];
      for (const deptId of selectedDeptIds) {
        const existing = employees.find(
          emp =>
            emp.role === 'department_head' &&
            emp.department_ids?.includes(deptId) &&
            emp.id !== excludeId
        );
        if (existing) {
          const deptName = departments.find(d => d.id === deptId)?.name ?? deptId;
          conflicts.push(`${deptName} already has ${existing.full_name || existing.email} as head`);
        }
      }
      return conflicts.join('; ');
    },
    [employees, departments]
  );

  // ——— Employee code preview ———————————————————————————————————————————————————

  useEffect(() => {
    if (editingEmployee) { setPreviewCode(''); return; }
    if (form.department_ids.length === 0) { setPreviewCode(''); return; }

    const firstDeptId = form.department_ids[0];
    const dept = departments.find(d => d.id === firstDeptId);
    if (!dept) { setPreviewCode(''); return; }

    const year = new Date().getFullYear();
    // Show a preview without actually incrementing the sequence
    const fetchPreview = async () => {
      setGeneratingCode(true);
      const { data } = await supabase
        .from('employee_code_sequences')
        .select('last_number')
        .eq('dept_code', dept.code)
        .eq('year', year)
        .maybeSingle();
      const nextNumber = (data?.last_number ?? 0) + 1;
      setPreviewCode(`GDS${year}${dept.code}${nextNumber}`);
      setGeneratingCode(false);
    };
    fetchPreview();
  }, [form.department_ids, departments, editingEmployee]);

  // ——— Dept head warning ———————————————————————————————————————————————————————

  useEffect(() => {
    const warning = checkDeptHeadConflict(
      form.role,
      form.department_ids,
      editingEmployee?.id
    );
    setDeptHeadWarning(warning);
  }, [form.role, form.department_ids, editingEmployee, checkDeptHeadConflict]);

  // ——— Modal helpers ———————————————————————————————————————————————————————————

  const openCreate = () => {
    setEditingEmployee(null);
    setForm(EMPTY_FORM);
    setPreviewCode('');
    setError('');
    setDeptHeadWarning('');
    setShowModal(true);
  };

  const openEdit = (emp: Profile) => {
    setEditingEmployee(emp);
    setForm({
      full_name: emp.full_name ?? '',
      email: emp.email ?? '',
      password: '',
      role: emp.role === 'super_admin' ? 'employee' : emp.role,
      department_ids: emp.department_ids ?? [],
      base_salary: emp.base_salary != null ? String(emp.base_salary) : '',
      phone: emp.phone ?? '',
      address: emp.address ?? '',
      tds_enabled: emp.tds_enabled ?? false,
      pf_enabled: emp.pf_enabled ?? false,
      esi_enabled: emp.esi_enabled ?? false,
      professional_tax_enabled: emp.professional_tax_enabled ?? false,
    });
    setError('');
    setDeptHeadWarning('');
    setShowModal(true);
  };

  // ——— Toggle dept selection ———————————————————————————————————————————————————

  const toggleDept = (deptId: string) => {
    setForm(f => {
      const already = f.department_ids.includes(deptId);
      return {
        ...f,
        department_ids: already
          ? f.department_ids.filter(id => id !== deptId)
          : [...f.department_ids, deptId],
      };
    });
  };

  // ——— Save (create or update) —————————————————————————————————————————————————

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingEmployee) {
        // —— UPDATE existing employee ——
        const updates: Partial<Profile> = {
          full_name: form.full_name,
          role: form.role,
          department_ids: form.department_ids,
          base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
          phone: form.phone,
          address: form.address,
          tds_enabled: form.tds_enabled,
          pf_enabled: form.pf_enabled,
          esi_enabled: form.esi_enabled,
          professional_tax_enabled: form.professional_tax_enabled,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', editingEmployee.id);

        if (updateErr) throw new Error(updateErr.message);
      } else {
        // —— CREATE new employee ——
        if (!form.email || !form.password) {
          throw new Error('Email and password are required.');
        }
        if (form.department_ids.length === 0) {
          throw new Error('Please select at least one department.');
        }

        // Generate employee code from first selected department
        const firstDeptId = form.department_ids[0];
        const dept = departments.find(d => d.id === firstDeptId);
        if (!dept) throw new Error('Selected department not found.');

        const employeeCode = await generateEmployeeCode(dept.code);

        // Suppress auth state changes during employee creation to prevent session override
        const unsuppress = suppressAuthChanges();

        // Create auth user via signUp
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.full_name,
              role: form.role,
            },
          },
        });

        if (signUpErr) throw new Error(signUpErr.message);
        if (!signUpData.user) throw new Error('User creation failed — no user returned.');

        // Re-enable auth state change listener now that signUp is done
        unsuppress();

        // Upsert profile row (auth trigger may have created it, so upsert is safe)
        const profilePayload: Partial<Profile> = {
          id: signUpData.user.id,
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          department_ids: form.department_ids,
          employee_code: employeeCode,
          base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
          phone: form.phone,
          address: form.address,
          tds_enabled: form.tds_enabled,
          pf_enabled: form.pf_enabled,
          esi_enabled: form.esi_enabled,
          professional_tax_enabled: form.professional_tax_enabled,
          kpi_score: 0,
          is_active: true,
        };

        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' });

        if (profileErr) throw new Error(profileErr.message);
      }

      setShowModal(false);
      await fetchEmployees();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  // ——— Toggle active ————————————————————————————————————————————————————————————

  const toggleActive = async (emp: Profile) => {
    const { error: toggleErr } = await supabase
      .from('profiles')
      .update({ is_active: !emp.is_active, updated_at: new Date().toISOString() })
      .eq('id', emp.id);

    if (!toggleErr) {
      setEmployees(prev =>
        prev.map(e => (e.id === emp.id ? { ...e, is_active: !emp.is_active } : e))
      );
    }
  };

  // ——— Delete ———————————————————————————————————————————————————————————————————

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    // Remove from profiles (auth user cleanup requires admin edge function or manual action)
    const { error: delErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', deleteTarget.id);

    setDeleting(false);
    setDeleteTarget(null);

    if (delErr) {
      setError(delErr.message);
      return;
    }
    await fetchEmployees();
  };

  // ——— Filtered list ————————————————————————————————————————————————————————————

  const filtered =
    filterDeptId === 'all'
      ? employees
      : employees.filter(emp => emp.department_ids?.includes(filterDeptId));

  // ——— Render ———————————————————————————————————————————————————————————————————

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">People</PHeading>
          <PText color="contrast-medium">Manage employees and their access</PText>
        </div>
        {isAdmin() && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={16} /> Add Employee
          </Button>
        )}
      </div>

      {/* Department filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterDeptId('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            filterDeptId === 'all'
              ? 'bg-canvas border-contrast-high text-primary'
              : 'bg-surface border-contrast-low text-contrast-medium hover:border-contrast-medium'
          }`}
        >
          All Departments
        </button>
        {departments.map(dept => (
          <button
            key={dept.id}
            onClick={() => setFilterDeptId(dept.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filterDeptId === dept.id
                ? 'bg-canvas border-contrast-high text-primary'
                : 'bg-surface border-contrast-low text-contrast-medium hover:border-contrast-medium'
            }`}
          >
            {dept.code}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && !showModal && (
        <div className="mb-4">
          <PInlineNotification
            heading="Error"
            description={error}
            state="error"
            dismissButton
            onDismiss={() => setError('')}
          />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <PText color="contrast-medium">Loading employees…</PText>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-surface rounded-xl border border-contrast-low">
          <PIcon name="user" size="large" color="contrast-low" />
          <PText color="contrast-medium" className="mt-3">
            No employees found.
          </PText>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-contrast-low overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-contrast-low">
                  {['Code', 'Name', 'Email', 'Role', 'Departments', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">
                      <PText
                        size="xx-small"
                        color="contrast-medium"
                        weight="semi-bold"
                        className="uppercase tracking-wide"
                      >
                        {h}
                      </PText>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <>
                    <tr
                      key={emp.id}
                      className="border-b border-contrast-low last:border-0 hover:bg-canvas transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
                    >
                      {/* Code */}
                      <td className="px-4 py-3">
                        <PText size="x-small" color="contrast-medium">
                          {emp.employee_code ?? '—'}
                        </PText>
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-contrast-low flex items-center justify-center flex-shrink-0">
                            <PText size="xx-small" weight="semi-bold">
                              {(emp.full_name || emp.email || '?')[0].toUpperCase()}
                            </PText>
                          </div>
                          <PText size="small" weight="semi-bold">
                            {emp.full_name || '—'}
                          </PText>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3">
                        <PText size="x-small" color="contrast-medium">
                          {emp.email}
                        </PText>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <PTag color={ROLE_COLORS[emp.role] ?? 'background-surface'}>
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </PTag>
                      </td>

                      {/* Departments */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {emp.departmentNames.length > 0 ? (
                            emp.departmentNames.map(n => (
                              <span
                                key={n}
                                className="text-xs px-2 py-0.5 rounded-full bg-contrast-low text-contrast-high"
                              >
                                {n}
                              </span>
                            ))
                          ) : (
                            <PText size="x-small" color="contrast-low">None</PText>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <PTag
                          color={
                            emp.is_active
                              ? 'notification-success-soft'
                              : 'notification-error-soft'
                          }
                        >
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </PTag>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {isAdmin() && (
                            <>
                              <button
                                onClick={() => openEdit(emp)}
                                className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                                title="Edit"
                              >
                                <PIcon name="edit" size="x-small" />
                              </button>
                              <button
                                onClick={() => toggleActive(emp)}
                                className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                                title={emp.is_active ? 'Deactivate' : 'Activate'}
                              >
                                <PIcon
                                  name={emp.is_active ? 'close' : 'check'}
                                  size="x-small"
                                />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(emp)}
                                className="p-1.5 rounded hover:bg-notification-error-soft transition-colors"
                                title="Delete"
                              >
                                <PIcon name="delete" size="x-small" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
                            className="p-1.5 rounded hover:bg-contrast-low transition-colors"
                            title="View details"
                          >
                            <PIcon
                              name={expandedId === emp.id ? 'arrow-head-up' : 'arrow-head-down'}
                              size="x-small"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row — profile details */}
                    {expandedId === emp.id && (
                      <tr key={`${emp.id}-detail`} className="bg-canvas border-b border-contrast-low">
                        <td colSpan={7} className="px-6 py-5">
                          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                            <DetailItem label="Employee Code" value={emp.employee_code ?? '—'} />
                            <DetailItem label="Phone" value={emp.phone || '—'} />
                            <DetailItem label="Address" value={emp.address || '—'} />
                            <DetailItem
                              label="Base Salary"
                              value={
                                emp.base_salary != null
                                  ? `₹${emp.base_salary.toLocaleString('en-IN')}`
                                  : '—'
                              }
                            />
                            <DetailItem label="KPI Score" value={String(emp.kpi_score ?? 0)} />
                            <DetailItem label="TDS" value={emp.tds_enabled ? 'Enabled' : 'Disabled'} />
                            <DetailItem label="PF" value={emp.pf_enabled ? 'Enabled' : 'Disabled'} />
                            <DetailItem label="ESI" value={emp.esi_enabled ? 'Enabled' : 'Disabled'} />
                            <DetailItem
                              label="Prof. Tax"
                              value={emp.professional_tax_enabled ? 'Enabled' : 'Disabled'}
                            />
                            <DetailItem
                              label="Joined"
                              value={
                                emp.created_at
                                  ? new Date(emp.created_at).toLocaleDateString('en-IN')
                                  : '—'
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* —— Add / Edit Modal —— */}
      <PModal
        open={showModal}
        onDismiss={() => { setShowModal(false); setError(''); }}
        heading={editingEmployee ? `Edit ${editingEmployee.full_name || 'Employee'}` : 'Add Employee'}
        aria={{ 'aria-label': 'Employee form' }}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>
          {error && (
            <PInlineNotification
              heading="Error"
              description={error}
              state="error"
              dismissButton={false}
            />
          )}
          {deptHeadWarning && (
            <PInlineNotification
              heading="Department Head Conflict"
              description={deptHeadWarning}
              state="warning"
              dismissButton={false}
            />
          )}

          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name *">
              <input
                type="text"
                required
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="form-input"
                placeholder="e.g. Rahul Sharma"
              />
            </FormField>

            <FormField label="Role *">
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as EmployeeForm['role'] }))}
                className="form-input"
              >
                <option value="employee">Employee</option>
                <option value="department_head">Department Head</option>
              </select>
            </FormField>
          </div>

          {/* Email + password (create only) */}
          {!editingEmployee && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Email *">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="form-input"
                  placeholder="employee@company.com"
                  autoComplete="off"
                />
              </FormField>
              <FormField label="Password *">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="form-input pr-10"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-contrast-low transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <PIcon name={showPassword ? 'view-off' : 'view'} size="x-small" />
                  </button>
                </div>
              </FormField>
            </div>
          )}

          {/* Phone + Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="form-input"
                placeholder="+91 98765 43210"
              />
            </FormField>
            <FormField label="Base Salary (₹)">
              <input
                type="number"
                min="0"
                step="1"
                value={form.base_salary}
                onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))}
                className="form-input"
                placeholder="e.g. 50000"
              />
            </FormField>
          </div>

          <FormField label="Address">
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="form-input"
              placeholder="Full address"
            />
          </FormField>

          {/* Departments */}
          <div>
            <label
              className="block text-xs font-medium text-contrast-high mb-2"
              style={{ fontFamily: "'Neue Montreal', sans-serif" }}
            >
              Departments *
            </label>
            <div className="flex flex-wrap gap-3">
              {departments.map(dept => {
                const selected = form.department_ids.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => toggleDept(dept.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-canvas border-contrast-high text-primary'
                        : 'bg-surface border-contrast-low text-contrast-medium hover:border-contrast-medium'
                    }`}
                  >
                    {dept.code} — {dept.name}
                  </button>
                );
              })}
            </div>
            {/* Employee code preview */}
            {!editingEmployee && form.department_ids.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <PIcon name="filter" size="x-small" color="contrast-medium" />
                <PText size="x-small" color="contrast-medium">
                  Employee code:{' '}
                  <span className="font-mono font-semibold text-contrast-high">
                    {generatingCode ? 'Generating…' : previewCode || '—'}
                  </span>
                </PText>
              </div>
            )}
          </div>

          {/* Tax/deduction toggles */}
          <div>
            <label
              className="block text-xs font-medium text-contrast-high mb-3"
              style={{ fontFamily: "'Neue Montreal', sans-serif" }}
            >
              Payroll Deductions
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SwitchField
                label="TDS"
                checked={form.tds_enabled}
                onChange={v => setForm(f => ({ ...f, tds_enabled: v }))}
              />
              <SwitchField
                label="PF"
                checked={form.pf_enabled}
                onChange={v => setForm(f => ({ ...f, pf_enabled: v }))}
              />
              <SwitchField
                label="ESI"
                checked={form.esi_enabled}
                onChange={v => setForm(f => ({ ...f, esi_enabled: v }))}
              />
              <SwitchField
                label="Prof. Tax"
                checked={form.professional_tax_enabled}
                onChange={v => setForm(f => ({ ...f, professional_tax_enabled: v }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => { setShowModal(false); setError(''); }}
              disabled={saving}
            >
              Cancel
            </PButton>
            <PButton type="submit" loading={saving} disabled={saving}>
              {editingEmployee ? 'Save Changes' : 'Create Employee'}
            </PButton>
          </div>
        </form>
      </PModal>

      {/* —— Delete Confirm Modal —— */}
      <PModal
        open={!!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        heading="Delete Employee"
        aria={{ 'aria-label': 'Delete employee confirmation' }}
      >
        <div className="flex flex-col gap-4">
          <PText>
            Are you sure you want to delete{' '}
            <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>? This removes their
            profile data. Their authentication account will remain until manually removed from
            Supabase Auth.
          </PText>
          <div className="flex gap-3 justify-end">
            <PButton
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </PButton>
            <PButton
              variant="primary"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleting}
            >
              Delete
            </PButton>
          </div>
        </div>
      </PModal>
    </div>
  );
}

// ——— Sub-components ———————————————————————————————————————————————————————————

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm font-medium break-words">
        {value}
      </p>
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-surface border border-contrast-low rounded-lg px-3 py-2">
      <PSwitch
        checked={checked}
        onUpdate={e => onChange((e as CustomEvent<{ checked: boolean }>).detail.checked)}
        hideLabel
      >
        {label}
      </PSwitch>
      <PText size="x-small">{label}</PText>
    </div>
  );
}



