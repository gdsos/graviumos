import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Filter,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { supabase, type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PhoneNumberInput } from '../../components/common/PhoneNumberInput';
import { PAGE_PERMISSION_CONFIGS, getDefaultPagePermissions, normalizePagePermissions, type PageAccess, type PagePermissionKey, type PagePermissions } from '../../lib/pagePermissions';

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
  page_permissions: PagePermissions;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  department_head: 'Dept. Head',
  employee: 'Employee',
};

const ROLE_TONES: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  super_admin: 'danger',
  department_head: 'warning',
  employee: 'info',
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
  page_permissions: {},
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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'danger' | 'warning' | 'info' | 'success' | 'default';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-destructive/20 bg-destructive/10 text-destructive'
      : tone === 'warning'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : tone === 'info'
          ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
          : tone === 'success'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-border bg-background text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function InlineNotice({
  tone,
  title,
  description,
  onDismiss,
}: {
  tone: 'error' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  onDismiss?: () => void;
}) {
  const isError = tone === 'error';
  const isWarning = tone === 'warning';
  const isSuccess = tone === 'success';

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${
        isError
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : isWarning
            ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : isSuccess
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border bg-card text-card-foreground'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

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
  const [permissionsTouched, setPermissionsTouched] = useState(false);

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

  const selectedDepartmentCodes = form.department_ids
    .map(id => departments.find(department => department.id === id)?.code)
    .filter(Boolean) as string[];

  const suggestedPagePermissions = getDefaultPagePermissions({
    role: form.role,
    departmentCodes: selectedDepartmentCodes,
  });

  useEffect(() => {
    if (editingEmployee || permissionsTouched) return;

    setForm(current => ({
      ...current,
      page_permissions: getDefaultPagePermissions({
        role: current.role,
        departmentCodes: current.department_ids
          .map(id => departments.find(department => department.id === id)?.code)
          .filter(Boolean) as string[],
      }),
    }));
  }, [editingEmployee, permissionsTouched, form.role, form.department_ids, departments]);

  const setPagePermission = (key: PagePermissionKey, access: PageAccess) => {
    setPermissionsTouched(true);

    setForm(current => {
      const nextPermissions = {
        ...current.page_permissions,
      };

      if (access === 'hidden') {
        delete nextPermissions[key];
      } else {
        nextPermissions[key] = access;
      }

      return {
        ...current,
        page_permissions: nextPermissions,
      };
    });
  };

  const applySuggestedPagePermissions = () => {
    setPermissionsTouched(true);

    setForm(current => ({
      ...current,
      page_permissions: suggestedPagePermissions,
    }));
  };


  // ——— Modal helpers ———————————————————————————————————————————————————————————

  const openCreate = () => {
    setEditingEmployee(null);
    setPermissionsTouched(false);
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
      page_permissions: normalizePagePermissions(emp.page_permissions),
    });
    setPermissionsTouched(true);
    setError('');
    setDeptHeadWarning('');
    setShowModal(true);
  };

  // ——— Toggle dept selection ———————————————————————————————————————————————————

  const toggleDept = (deptId: string) => {
    setForm(current => {
      const already = current.department_ids.includes(deptId);
      const nextDepartmentIds = already ? [] : [deptId];
      const nextDepartmentCodes = nextDepartmentIds
        .map(id => departments.find(department => department.id === id)?.code)
        .filter(Boolean) as string[];

      return {
        ...current,
        department_ids: nextDepartmentIds,
        page_permissions: getDefaultPagePermissions({
          role: current.role,
          departmentCodes: nextDepartmentCodes,
        }),
      };
    });

    setPermissionsTouched(true);
  };

  // ——— Save (create or update) —————————————————————————————————————————————————

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingEmployee) {
        // UPDATE existing employee
        let employeeCode = editingEmployee.employee_code;

        if (form.department_ids.length > 0) {
          const firstDeptId = form.department_ids[0];
          const dept = departments.find(d => d.id === firstDeptId);

          if (!dept) {
            throw new Error('Selected department not found.');
          }

          const expectedCodePrefix = `GDS${new Date().getFullYear()}${dept.code}`;

          if (!employeeCode || !employeeCode.startsWith(expectedCodePrefix)) {
            employeeCode = await generateEmployeeCode(dept.code);
          }
        }

        const updates: Partial<Profile> = {
          full_name: form.full_name,
          role: editingEmployee.role === 'super_admin' ? 'super_admin' : form.role,
          department_ids: form.department_ids,
          employee_code: employeeCode,
          base_salary: form.base_salary ? parseFloat(form.base_salary) : 0,
          phone: form.phone,
          address: form.address,
          tds_enabled: form.tds_enabled,
          pf_enabled: form.pf_enabled,
          esi_enabled: form.esi_enabled,
          professional_tax_enabled: form.professional_tax_enabled,
          page_permissions: form.page_permissions,
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
          page_permissions: form.page_permissions,
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <PageHeader
        eyebrow="Admin People"
        title="People"
        description="Manage employees, departments, payroll flags, and access."
        actions={
          isAdmin() ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Employee
            </button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterDeptId('all')}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            filterDeptId === 'all'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          All Departments
        </button>

        {departments.map(dept => (
          <button
            key={dept.id}
            type="button"
            onClick={() => setFilterDeptId(dept.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              filterDeptId === dept.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {dept.code}
          </button>
        ))}
      </div>

      {error && !showModal && (
        <div className="mb-4">
          <InlineNotice
            tone="error"
            title="Error"
            description={error}
            onDismiss={() => setError('')}
          />
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading employees...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <User className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No employees found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(emp => (
            <article
              key={emp.id}
              className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition-colors hover:border-muted-foreground/40"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                    <span className="text-sm font-semibold text-foreground">
                      {(emp.full_name || emp.email || '-')[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {emp.full_name || 'Unnamed Employee'}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground">{emp.email}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={ROLE_TONES[emp.role] ?? 'default'}>
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </Badge>
                      <Badge tone={emp.is_active ? 'success' : 'danger'}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {isAdmin() && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleActive(emp)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={emp.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {emp.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(emp)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mb-5 grid grid-cols-2 gap-4">
                <DetailItem label="Employee Code" value={emp.employee_code ?? '-'} />
                <DetailItem
                  label="Base Salary"
                  value={
                    emp.base_salary != null
                      ? `\u20B9${emp.base_salary.toLocaleString('en-IN')}`
                      : '-'
                  }
                />
                <DetailItem label="Phone" value={emp.phone || '-'} />
                <DetailItem label="Status" value={emp.is_active ? 'Active' : 'Inactive'} />
              </div>

              <div className="mb-5">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Departments
                </p>

                <div className="flex flex-wrap gap-2">
                  {emp.departmentNames.length > 0 ? (
                    emp.departmentNames.map(name => (
                      <span
                        key={name}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No departments assigned</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {expandedId === emp.id ? 'Hide Details' : 'View Details'}
                {expandedId === emp.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {expandedId === emp.id && (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Address" value={emp.address || '-'} />
                    <DetailItem
                      label="Joined"
                      value={emp.created_at ? new Date(emp.created_at).toLocaleDateString('en-IN') : '-'}
                    />
                    <DetailItem label="TDS" value={emp.tds_enabled ? 'Enabled' : 'Disabled'} />
                    <DetailItem label="PF" value={emp.pf_enabled ? 'Enabled' : 'Disabled'} />
                    <DetailItem label="ESI" value={emp.esi_enabled ? 'Enabled' : 'Disabled'} />
                    <DetailItem
                      label="Professional Tax"
                      value={emp.professional_tax_enabled ? 'Enabled' : 'Disabled'}
                    />
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                {editingEmployee ? `Edit ${editingEmployee.full_name || 'Employee'}` : 'Add Employee'}
              </h2>
              <button
                type="button"
                onClick={() => { setShowModal(false); setError(''); }}
                disabled={saving}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex max-h-[calc(100vh-8rem)] flex-col">
              <div className="flex-1 overflow-y-auto p-5">
                <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>

                <div className="flex flex-col gap-5">
                  {error && (
                    <InlineNotice
                      tone="error"
                      title="Error"
                      description={error}
                    />
                  )}

                  {deptHeadWarning && (
                    <InlineNotice
                      tone="warning"
                      title="Department Head Conflict"
                      description={deptHeadWarning}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Full Name *">
                      <input
                        type="text"
                        required
                        value={form.full_name}
                        onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))}
                        className="form-input"
                        placeholder="e.g. Rahul Sharma"
                      />
                    </FormField>

                    <FormField label="Role *">
                      <select
                        value={form.role}
                        onChange={event => setForm(current => ({ ...current, role: event.target.value as EmployeeForm['role'] }))}
                        className="form-input"
                      >
                        <option value="employee">Employee</option>
                        <option value="department_head">Department Head</option>
                      </select>
                    </FormField>
                  </div>

                  {!editingEmployee && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Email *">
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
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
                            onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                            className="form-input pr-10"
                            placeholder="Min. 8 characters"
                            autoComplete="new-password"
                            minLength={8}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(value => !value)}
                            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormField>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField label="Phone">
                      <PhoneNumberInput
                        value={form.phone}
                        onChange={value => setForm(current => ({ ...current, phone: value }))}
                      />
                    </FormField>

                    <FormField label={`Base Salary (${'\\u20B9'})`}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.base_salary}
                        onChange={event => setForm(current => ({ ...current, base_salary: event.target.value }))}
                        className="form-input"
                        placeholder="e.g. 50000"
                      />
                    </FormField>
                  </div>

                  <FormField label="Address">
                    <input
                      type="text"
                      value={form.address}
                      onChange={event => setForm(current => ({ ...current, address: event.target.value }))}
                      className="form-input"
                      placeholder="Full address"
                    />
                  </FormField>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Department *
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {departments.map(dept => {
                        const selected = form.department_ids.includes(dept.id);

                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => toggleDept(dept.id)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {dept.code} - {dept.name}
                          </button>
                        );
                      })}
                    </div>

                    {!editingEmployee && form.department_ids.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Filter className="h-3.5 w-3.5" />
                        <span>
                          Employee code preview:{' '}
                          <span className="font-mono font-semibold text-foreground">
                            {generatingCode ? 'Generating...' : previewCode || '-'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Page Permissions
                        </label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Choose which portal pages this user can see or manage.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={applySuggestedPagePermissions}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        Apply Suggested Defaults
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {PAGE_PERMISSION_CONFIGS.map(permission => {
                        const currentAccess = form.page_permissions[permission.key] ?? 'hidden';

                        return (
                          <div
                            key={permission.key}
                            className="rounded-xl border border-border bg-card p-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    {permission.label}
                                  </p>
                                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    {permission.group}
                                  </span>
                                </div>

                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>

                              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1">
                                {(['hidden', 'view', 'manage'] as PageAccess[]).map(access => (
                                  <button
                                    key={access}
                                    type="button"
                                    onClick={() => setPagePermission(permission.key, access)}
                                    className={`h-8 rounded-lg px-2 text-xs font-semibold capitalize transition-colors ${
                                      currentAccess === access
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                  >
                                    {access === 'hidden' ? 'Hide' : access}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Payroll Deductions
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <SwitchField
                        label="TDS"
                        checked={form.tds_enabled}
                        onChange={value => setForm(current => ({ ...current, tds_enabled: value }))}
                      />
                      <SwitchField
                        label="PF"
                        checked={form.pf_enabled}
                        onChange={value => setForm(current => ({ ...current, pf_enabled: value }))}
                      />
                      <SwitchField
                        label="ESI"
                        checked={form.esi_enabled}
                        onChange={value => setForm(current => ({ ...current, esi_enabled: value }))}
                      />
                      <SwitchField
                        label="Prof. Tax"
                        checked={form.professional_tax_enabled}
                        onChange={value => setForm(current => ({ ...current, professional_tax_enabled: value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); }}
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {editingEmployee ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Delete Employee</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                Are you sure you want to delete{' '}
                <strong className="text-foreground">{deleteTarget?.full_name || deleteTarget?.email}</strong>?
                This removes their profile data. Their authentication account will remain until manually removed from Supabase Auth.
              </p>

              <div className="flex flex-col justify-end gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground/60 border-t-transparent" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}

// ??? Sub-components ???????????????????????????????????????????????????????????

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm font-medium text-foreground">
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
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
      role="switch"
      aria-checked={checked}
    >
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'border-primary bg-primary' : 'border-border bg-muted'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
