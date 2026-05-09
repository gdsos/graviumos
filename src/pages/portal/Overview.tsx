import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  type Announcement,
  type Notification,
  type Task,
  type Attendance,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bell,
  Check,
  Clock,
  Info,
  MapPin,
  Megaphone,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

// ——— Constants ——————————————————————————————————————————————————————————————

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

const STATUS_BADGE: Record<TaskStatus, string> = {
  'Not Started': 'bg-slate-100 text-slate-700',
  Ongoing: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-700',
  Completed: 'bg-green-100 text-green-700',
};

// ——— Helpers ——————————————————————————————————————————————————————————————————

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
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

// ——— Sub-components ———————————————————————————————————————————————————————————

function KpiScoreCircle({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  let ringColor = '#16a34a'; // green
  if (score < 5) ringColor = '#dc2626'; // red
  else if (score < 7.5) ringColor = '#d97706'; // amber

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#e2e8f0"
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
            className="text-xs text-slate-500 mt-0.5"
            style={{ fontFamily: FONT }}
          >
            / 10
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-600" style={{ fontFamily: FONT }}>
        KPI Score
      </p>
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
    'Not Started': 'bg-white border-slate-200',
    Ongoing: 'bg-blue-50 border-slate-200',
    Overdue: 'bg-red-50 border-slate-200',
    Completed: 'bg-green-50 border-slate-200',
  };

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${bg[status]}`}>
      <span
        className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${STATUS_BADGE[status]}`}
      >
        {status}
      </span>
      <span
        className="text-2xl font-bold mt-1"
        style={{ fontFamily: FONT, color: '#2563eb' }}
      >
        {count}
      </span>
      <p
        className="text-xs text-slate-500"
        style={{ fontFamily: FONT }}
      >
        task{count !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ——— Main Component ———————————————————————————————————————————————————————————

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

  // ——— Geolocation —————————————————————————————————————————————————————————

  const resolveLocation = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve('Location not available');
        return;
      }

      setLocationLoading(true);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;

          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );

            const data = await response.json();

            setLocationLoading(false);

            // readable place name
            resolve(
              `${data.locality || data.city || 'Unknown area'}, ${data.principalSubdivision || data.countryName
              }`
            );
          } catch (error) {
            setLocationLoading(false);

            // fallback to coordinates
            resolve(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        },

        () => {
          setLocationLoading(false);
          resolve('Location not available');
        },

        {
          enableHighAccuracy: true,
          timeout: 10000,
        }
      );
    });
  }, []);

  // Get location on mount for display
  useEffect(() => {
    resolveLocation().then(loc => setLocationStamp(loc));
  }, [resolveLocation]);

  // ——— Fetch today's attendance ————————————————————————————————————————————

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

  // ——— Attendance actions ——————————————————————————————————————————————————

  const handleCheckIn = async () => {
    if (!profile) return;
    if (attendance?.check_in) return;
    setAttendanceError('');
    setCheckingIn(true);
    const loc = await resolveLocation();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('attendance')
      .upsert(
        {
          employee_id: profile.id,
          date: todayDateString(),
          check_in: now,
          status: 'Present',
          location_stamp: loc,
          admin_override: false,
          notes: '',
        },
        {
          onConflict: 'employee_id,date',
        }
      );
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

  // ——— Fetch tasks summary ——————————————————————————————————————————————————

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('status, deadline, completed_at')
        .eq('assigned_to', profile.id);

      if (error) {
        console.error(error);
        setTasksLoading(false);
        return;
      }

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

  // ——— Fetch announcements ——————————————————————————————————————————————————

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

  // ——— Fetch notifications ——————————————————————————————————————————————————

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

  // ——— Mark notification as read —————————————————————————————————————————

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  // ——— Attendance state derived ——————————————————————————————————————————

  const isCheckedIn = !!(attendance?.check_in);
  const isCheckedOut = !!(attendance?.check_out);
  const attendanceComplete = isCheckedIn && isCheckedOut;

  // ——— Render ———————————————————————————————————————————————————————————————

  return (
    <div className="max-w-7xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p
            className="text-slate-500"
            style={{ fontFamily: FONT }}
          >
            Here's your personal workspace overview
          </p>
        </div>
        {/* Department badges */}
        <div className="flex flex-wrap gap-2">
          {userDepartments.map(dept => (
            <span
              key={dept.id}
              className="px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700"
            >
              {dept.code} · {dept.name}
            </span>
          ))}
        </div>
      </div>

      {/* —— Row 1: KPI + Attendance ———————————————————————————————————————— */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-5">
        {/* KPI Score Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center gap-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: FONT }}>
            Performance Score
          </h3>
          <KpiScoreCircle score={profile?.kpi_score ?? 0} />
          <p
            className="text-xs text-slate-500 text-center"
            style={{ fontFamily: FONT }}
          >
            {(profile?.kpi_score ?? 0) >= 8
              ? 'Excellent performance — keep it up!'
              : (profile?.kpi_score ?? 0) >= 6
              ? 'Good work — a little more to excel'
              : 'Room for improvement — reach out for support'}
          </p>
        </div>

        {/* Attendance Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 md:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ fontFamily: FONT }}>
              Today's Attendance
            </h3>
            <p
              className="text-xs text-slate-500"
              style={{ fontFamily: FONT }}
>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {attendanceError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-900">
                Attendance error
              </p>
              <p className="text-sm text-red-700 mt-1">
                {attendanceError}
              </p>
            </div>
          )}

          {attendanceLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Clock className="w-4 h-4 text-slate-400" />
              <p
                className="text-slate-500"
                style={{ fontFamily: FONT }}
              >
                Loading attendance…
              </p>
            </div>
          ) : (
            <>
              {/* Check-in / Check-out time display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1 bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <p
                      className="text-[11px] uppercase tracking-wider text-slate-500"
                      style={{ fontFamily: FONT }}
                    >
                    Check-In
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                      <ArrowRight
                        className={`w-4 h-4 ${isCheckedIn ? 'text-green-600' : 'text-slate-400'
                          }`}
                      />
                      <p
                        className={`text-base font-semibold ${isCheckedIn ? 'text-green-600' : 'text-slate-500'
                          }`}
                        style={{ fontFamily: FONT }}
                      >
                      {isCheckedIn ? formatTime(attendance!.check_in) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p
                    className="text-[11px] uppercase tracking-wider text-slate-500"
                    style={{ fontFamily: FONT }}
                  >
                    Check-Out
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                      <ArrowLeft
                        className={`w-4 h-4 ${isCheckedOut ? 'text-blue-600' : 'text-slate-400'
                          }`}
                      />
                      <p
                        className={`text-base font-semibold ${isCheckedOut ? 'text-blue-600' : 'text-slate-500'
                          }`}
                        style={{ fontFamily: FONT }}
                      >
                        {isCheckedOut ? formatTime(attendance!.check_out) : '—'}
                      </p>
                  </div>
                </div>
              </div>

              {/* Location stamp */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <MapPin className="w-4 h-4 text-slate-500" />
                  <p
                    className="text-xs text-slate-500"
                    style={{ fontFamily: FONT }}
                  >
                  {locationLoading ? 'Getting location…' : (locationStamp || attendance?.location_stamp || 'Location not available')}
                </p>
              </div>

              {/* Action buttons */}
                <div className="w-full">
                  {attendanceComplete ? (
                    <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-slate-200">
                      <Check className="w-4 h-4 text-green-600" />
                      <p
                        className="text-sm font-semibold text-green-600"
                        style={{ fontFamily: FONT }}
                      >
                        Attendance Complete
                      </p>
                    </div>
                  ) : !isCheckedIn ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={checkingIn}
                      className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {checkingIn ? 'Checking...' : 'Check In'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckOut}
                      disabled={checkingOut}
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 font-medium"
                    >
                      {checkingOut ? 'Checking...' : 'Check Out'}
                    </button>
                  )}
                </div>
            </>
          )}
        </div>
      </div>

      {/* —— Row 2: Task Summary ————————————————————————————————————————————— */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: FONT }}>
            My Tasks
          </h3>
          <p
            className="text-xs text-slate-500"
            style={{ fontFamily: FONT }}
          >
            Total: {tasksLoading ? '…' : Object.values(taskCounts).reduce((a, b) => a + b, 0)}
          </p>
        </div>

        {tasksLoading ? (
          <div className="flex gap-4">
            {(['Not Started', 'Ongoing', 'Overdue', 'Completed'] as TaskStatus[]).map(s => (
              <div key={s} className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 h-20 animate-pulse" />
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

      {/* —— Row 3: Announcements + Notifications ——————————————————————————— */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-slate-700" />
            <h3 className="text-lg font-semibold" style={{ fontFamily: FONT }}>
              Announcements
            </h3>
          </div>

          {announcementsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Info className="w-5 h-5 text-slate-400" />
              <p className="text-sm text-slate-500" style={{ fontFamily: FONT }}>
                No announcements right now
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {announcements.map(ann => (
                <div
                  key={ann.id}
                  className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex flex-col gap-1 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ fontFamily: FONT }}>
                      {ann.title}
                    </p>
                    <span className="px-2 py-1 text-xs rounded-md bg-slate-100 text-slate-600">
                      {ann.target_type === 'company' ? 'Company' : 'Dept'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500" style={{ fontFamily: FONT }}>
                    {ann.content.length > 120 ? ann.content.slice(0, 120) + '…' : ann.content}
                  </p>
                  <p className="text-xs text-slate-500" style={{ fontFamily: FONT }}>
                    {formatRelativeDate(ann.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-700" />
            <h3 className="text-lg font-semibold" style={{ fontFamily: FONT }}>
              Recent Notifications
            </h3>
          </div>

          {notifsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <Bell className="w-5 h-5 text-slate-400" />
              <p className="text-sm text-slate-500" style={{ fontFamily: FONT }}>
                No notifications yet
              </p>
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
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-blue-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <Bell
                      className={`w-4 h-4 ${notif.is_read ? 'text-slate-400' : 'text-blue-500'
                        }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ fontFamily: FONT }}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500" style={{ fontFamily: FONT }}>
                      {notif.message.length > 80 ? notif.message.slice(0, 80) + '…' : notif.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <p className="text-xs text-slate-500" style={{ fontFamily: FONT }}>
                      {formatRelativeDate(notif.created_at)}
                    </p>
                    {!notif.is_read && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-500"
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



