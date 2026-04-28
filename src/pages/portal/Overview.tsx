import { useState, useEffect, useCallback } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
  PInlineNotification,
} from '@porsche-design-system/components-react';
import {
  supabase,
  type Announcement,
  type Notification,
  type Task,
  type Attendance,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "inherit";

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

const STATUS_TAG_VARIANT: Record<TaskStatus, Parameters<typeof PTag>[0]['variant']> = {
  'Not Started': 'secondary',
  Ongoing: 'info',
  Overdue: 'error',
  Completed: 'success',
};

const NOTIF_TYPE_ICON: Record<string, Parameters<typeof PIcon>[0]['name']> = {
  info: 'information',
  task: 'list',
  announcement: 'news',
  approval: 'check',
  project: 'configurate',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function calcEffectiveStatus(task: Task): TaskStatus {
  if (task.status === 'Completed') return 'Completed';
  if (task.deadline && new Date(task.deadline) < new Date()) return 'Overdue';
  return task.status;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiScoreCircle({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  let ringColor = 'var(--p-color-notification-success)';
  if (score < 5) ringColor = 'var(--p-color-notification-error)';
  else if (score < 7.5) ringColor = 'var(--p-color-notification-warning)';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="var(--p-color-contrast-low)"
            strokeWidth="8"
            opacity="0.25"
          />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold leading-none"
            style={{ fontFamily: FONT, color: ringColor }}
          >
            {score.toFixed(1)}
          </span>
          <span
            className="text-xs text-contrast-medium mt-0.5"
            
          >
            / 10
          </span>
        </div>
      </div>
      <PText size="x-small" color="contrast-medium" >
        KPI Score
      </PText>
    </div>
  );
}

function TaskSummaryCard({
  status,
  count,
}: {
  status: TaskStatus;
  count: number;
}) {
  const bg: Record<TaskStatus, string> = {
    'Not Started': 'bg-surface border-contrast-low',
    Ongoing: 'bg-info-soft border-contrast-low',
    Overdue: 'bg-error-soft border-contrast-low',
    Completed: 'bg-success-soft border-contrast-low',
  };

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${bg[status]}`}>
      <PTag variant={STATUS_TAG_VARIANT[status]} compact>
        {status}
      </PTag>
      <span
        className="text-2xl font-bold mt-1"
        style={{ fontFamily: FONT, color: 'var(--p-color-primary)' }}
      >
        {count}
      </span>
      <PText size="xx-small" color="contrast-medium" >
        task{count !== 1 ? 's' : ''}
      </PText>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Overview() {
  const { profile, userDepartments } = useAuth();

  // Attendance
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [locationStamp, setLocationStamp] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // Tasks summary
  const [taskCounts, setTaskCounts] = useState<Record<TaskStatus, number>>({
    'Not Started': 0,
    Ongoing: 0,
    Overdue: 0,
    Completed: 0,
  });
  const [tasksLoading, setTasksLoading] = useState(true);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);

  // ─── Geolocation ─────────────────────────────────────────────────────────

  const resolveLocation = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve('Location not available');
        return;
      }
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          resolve(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          setLocationLoading(false);
        },
        () => {
          resolve('Location not available');
          setLocationLoading(false);
        },
        { timeout: 6000 }
      );
    });
  }, []);

  // Get location on mount for display
  useEffect(() => {
    resolveLocation().then(loc => setLocationStamp(loc));
  }, [resolveLocation]);

  // ─── Fetch today's attendance ────────────────────────────────────────────

  const fetchAttendance = useCallback(async () => {
    if (!profile) return;
    setAttendanceLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('date', todayDateString())
      .maybeSingle();
    setAttendance(data as Attendance | null);
    setAttendanceLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // ─── Attendance actions ──────────────────────────────────────────────────

  const handleCheckIn = async () => {
    if (!profile) return;
    setAttendanceError('');
    setCheckingIn(true);
    const loc = await resolveLocation();
    const now = new Date().toISOString();
    const { error } = await supabase.from('attendance').insert({
      employee_id: profile.id,
      date: todayDateString(),
      check_in: now,
      status: 'Present',
      location_stamp: loc,
      admin_override: false,
      notes: '',
    });
    setCheckingIn(false);
    if (error) {
      setAttendanceError(error.message);
    } else {
      setLocationStamp(loc);
      fetchAttendance();
    }
  };

  const handleCheckOut = async () => {
    if (!profile || !attendance) return;
    setAttendanceError('');
    setCheckingOut(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('attendance')
      .update({ check_out: now, updated_at: now })
      .eq('id', attendance.id);
    setCheckingOut(false);
    if (error) {
      setAttendanceError(error.message);
    } else {
      fetchAttendance();
    }
  };

  // ─── Fetch tasks summary ──────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setTasksLoading(true);
      const { data } = await supabase
        .from('tasks')
        .select('status, deadline, completed_at')
        .eq('assigned_to', profile.id);

      const counts: Record<TaskStatus, number> = {
        'Not Started': 0,
        Ongoing: 0,
        Overdue: 0,
        Completed: 0,
      };
      if (data) {
        for (const t of data as Pick<Task, 'status' | 'deadline' | 'completed_at'>[]) {
          const effective = calcEffectiveStatus(t as Task);
          counts[effective]++;
        }
      }
      setTaskCounts(counts);
      setTasksLoading(false);
    })();
  }, [profile]);

  // ─── Fetch announcements ──────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setAnnouncementsLoading(true);
      const deptIds = profile.department_ids || [];

      // Fetch company-wide + dept-specific announcements
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const relevant = (data as Announcement[]).filter(a => {
          if (a.target_type === 'company') return true;
          if (a.target_type === 'department' && a.target_department_id) {
            return deptIds.includes(a.target_department_id);
          }
          return false;
        }).slice(0, 5);
        setAnnouncements(relevant);
      }
      setAnnouncementsLoading(false);
    })();
  }, [profile]);

  // ─── Fetch notifications ──────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setNotifsLoading(true);
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications((data as Notification[]) || []);
      setNotifsLoading(false);
    })();
  }, [profile]);

  // ─── Mark notification as read ─────────────────────────────────────────

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  // ─── Attendance state derived ──────────────────────────────────────────

  const isCheckedIn = !!(attendance?.check_in);
  const isCheckedOut = !!(attendance?.check_out);
  const attendanceComplete = isCheckedIn && isCheckedOut;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto" >
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </PHeading>
          <PText color="contrast-medium" >
            Here's your personal workspace overview
          </PText>
        </div>
        {/* Department badges */}
        <div className="flex flex-wrap gap-2">
          {userDepartments.map(dept => (
            <PTag key={dept.id} color="background-surface">
              {dept.code} · {dept.name}
            </PTag>
          ))}
        </div>
      </div>

      {/* ── Row 1: KPI + Attendance ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">
        {/* KPI Score Card */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6 flex flex-col items-center gap-4">
          <PHeading tag="h3" size="small" >
            Performance Score
          </PHeading>
          <KpiScoreCircle score={profile?.kpi_score ?? 0} />
          <PText size="x-small" color="contrast-medium" className="text-center" >
            {(profile?.kpi_score ?? 0) >= 8
              ? 'Excellent performance — keep it up!'
              : (profile?.kpi_score ?? 0) >= 6
              ? 'Good work — a little more to excel'
              : 'Room for improvement — reach out for support'}
          </PText>
        </div>

        {/* Attendance Card */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6 flex flex-col gap-4 md:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between">
            <PHeading tag="h3" size="small" >
              Today's Attendance
            </PHeading>
            <PText size="x-small" color="contrast-medium" >
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </PText>
          </div>

          {attendanceError && (
            <PInlineNotification
              heading="Attendance error"
              description={attendanceError}
              state="error"
              dismissButton={false}
            />
          )}

          {attendanceLoading ? (
            <div className="flex items-center gap-2 py-4">
              <PIcon name="clock" size="small" color="contrast-low" />
              <PText color="contrast-medium" >Loading attendance…</PText>
            </div>
          ) : (
            <>
              {/* Check-in / Check-out time display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 bg-canvas rounded-xl border border-contrast-low p-4">
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" >
                    Check-In
                  </PText>
                  <div className="flex items-center gap-2 mt-1">
                    <PIcon
                      name="arrow-right"
                      size="small"
                      color={isCheckedIn ? 'notification-success' : 'contrast-low'}
                    />
                    <PText
                      size="medium"
                      weight="semi-bold"
                      color={isCheckedIn ? 'notification-success' : 'contrast-medium'}
                      
                    >
                      {isCheckedIn ? formatTime(attendance!.check_in) : '—'}
                    </PText>
                  </div>
                </div>
                <div className="flex flex-col gap-1 bg-canvas rounded-xl border border-contrast-low p-4">
                  <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" >
                    Check-Out
                  </PText>
                  <div className="flex items-center gap-2 mt-1">
                    <PIcon
                      name="arrow-left"
                      size="small"
                      color={isCheckedOut ? 'notification-info' : 'contrast-low'}
                    />
                    <PText
                      size="medium"
                      weight="semi-bold"
                      color={isCheckedOut ? 'notification-info' : 'contrast-medium'}
                      
                    >
                      {isCheckedOut ? formatTime(attendance!.check_out) : '—'}
                    </PText>
                  </div>
                </div>
              </div>

              {/* Location stamp */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-canvas border border-contrast-low">
                <PIcon name="geo-localization" size="x-small" color="contrast-medium" />
                <PText size="x-small" color="contrast-medium" >
                  {locationLoading ? 'Getting location…' : (locationStamp || attendance?.location_stamp || 'Location not available')}
                </PText>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                {attendanceComplete ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-soft border border-contrast-low">
                    <PIcon name="check" size="small" color="notification-success" />
                    <PText size="small" weight="semi-bold" color="notification-success" >
                      Attendance Complete
                    </PText>
                  </div>
                ) : !isCheckedIn ? (
                  <PButton
                    icon="arrow-right"
                    onClick={handleCheckIn}
                    loading={checkingIn}
                  >
                    Check In
                  </PButton>
                ) : (
                  <PButton
                    icon="arrow-left"
                    variant="secondary"
                    onClick={handleCheckOut}
                    loading={checkingOut}
                  >
                    Check Out
                  </PButton>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Task Summary ───────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-contrast-low p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <PHeading tag="h3" size="small" >
            My Tasks
          </PHeading>
          <PText size="x-small" color="contrast-medium" >
            Total: {tasksLoading ? '…' : Object.values(taskCounts).reduce((a, b) => a + b, 0)}
          </PText>
        </div>

        {tasksLoading ? (
          <div className="flex gap-4">
            {(['Not Started', 'Ongoing', 'Overdue', 'Completed'] as TaskStatus[]).map(s => (
              <div key={s} className="flex-1 rounded-xl border border-contrast-low bg-canvas p-3 h-20 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['Not Started', 'Ongoing', 'Overdue', 'Completed'] as TaskStatus[]).map(s => (
              <TaskSummaryCard key={s} status={s} count={taskCounts[s]} />
            ))}
          </div>
        )}
      </div>

      {/* ── Row 3: Announcements + Notifications ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Announcements */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <PIcon name="news" size="small" color="contrast-high" />
            <PHeading tag="h3" size="small" >
              Announcements
            </PHeading>
          </div>

          {announcementsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-canvas animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <PIcon name="information" size="medium" color="contrast-low" />
              <PText color="contrast-medium" >
                No announcements right now
              </PText>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {announcements.map(ann => (
                <div
                  key={ann.id}
                  className="rounded-xl bg-canvas border border-contrast-low px-4 py-3 flex flex-col gap-1 hover:border-contrast-medium transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <PText size="small" weight="semi-bold" >
                      {ann.title}
                    </PText>
                    <PTag
                      color={ann.target_type === 'company' ? 'background-surface' : 'notification-info-soft'}
                      compact
                    >
                      {ann.target_type === 'company' ? 'Company' : 'Dept'}
                    </PTag>
                  </div>
                  <PText size="x-small" color="contrast-medium" >
                    {ann.content.length > 120 ? ann.content.slice(0, 120) + '…' : ann.content}
                  </PText>
                  <PText size="xx-small" color="contrast-low" >
                    {formatRelativeDate(ann.created_at)}
                  </PText>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <PIcon name="bell" size="small" color="contrast-high" />
            <PHeading tag="h3" size="small" >
              Recent Notifications
            </PHeading>
          </div>

          {notifsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-canvas animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <PIcon name="bell" size="medium" color="contrast-low" />
              <PText color="contrast-medium" >
                No notifications yet
              </PText>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => !notif.is_read && markRead(notif.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${
                    notif.is_read
                      ? 'bg-canvas border-contrast-low opacity-60'
                      : 'bg-info-soft border-contrast-low hover:border-contrast-medium'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <PIcon
                      name={NOTIF_TYPE_ICON[notif.type] || 'information'}
                      size="x-small"
                      color={notif.is_read ? 'contrast-medium' : 'notification-info'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <PText size="x-small" weight="semi-bold" >
                      {notif.title}
                    </PText>
                    <PText size="xx-small" color="contrast-medium" >
                      {notif.message.length > 80 ? notif.message.slice(0, 80) + '…' : notif.message}
                    </PText>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <PText size="xx-small" color="contrast-low" >
                      {formatRelativeDate(notif.created_at)}
                    </PText>
                    {!notif.is_read && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: 'var(--p-color-notification-info)' }}
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
