import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  LogIn,
  LogOut,
  CalendarDays,
  BriefcaseBusiness,
  CheckSquare,
  Plus,
  Sparkles,
} from 'lucide-react';

type TaskStatus = 'Not Started' | 'Ongoing' | 'Overdue' | 'Completed';

interface PortalProjectMini {
  id: string;
  name: string;
  client_name?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

const STATUS_BADGE: Record<TaskStatus, string> = {
  'Not Started': 'border-border bg-muted text-muted-foreground',
  Ongoing: 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Overdue: 'border-destructive/20 bg-destructive/10 text-destructive',
  Completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const bentoContainerMotion = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.04,
    },
  },
};

const bentoCardMotion = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
};

const bentoTransition = {
  duration: 0.32,
  ease: 'easeOut' as const,
};

function FlipInfoCard({
  front,
  back,
  actionLabel,
  onAction,
  className = '',
}: {
  front: React.ReactNode;
  back: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!flipped) return;

    const timeout = window.setTimeout(() => {
      setFlipped(false);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [flipped]);

  return (
    <motion.div
      variants={bentoCardMotion}
      transition={bentoTransition}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={`relative [perspective:1200px] ${className}`}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.42, ease: 'easeInOut' }}
        className="relative h-full min-h-inherit w-full [transform-style:preserve-3d]"
      >
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className="absolute inset-0 h-full w-full overflow-hidden rounded-3xl border border-border bg-card p-3 text-left outline-none [backface-visibility:hidden] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5"
        >
          {front}
        </button>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped(false)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setFlipped(false);
            }
          }}
          className="absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-3 text-left outline-none [backface-visibility:hidden] [transform:rotateY(180deg)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5"
        >
          <div>{back}</div>

          {actionLabel && onAction && (
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                onAction();
              }}
              className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-xl bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-9 sm:text-xs"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function todayDateString(): string {
  return new Date().toLocaleDateString('en-CA');
}

function formatTime(iso: string | null): string {
  if (!iso) return '-';

  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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

function getTaskDueDistance(deadline: string | null) {
  if (!deadline) return Number.POSITIVE_INFINITY;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);

  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function formatTaskDueLabel(deadline: string | null) {
  if (!deadline) return 'No deadline';

  const days = getTaskDueDistance(deadline);

  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';

  return `Due in ${days}d`;
}

function KpiScoreCircle({ score }: { score: number }) {
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  let ringColor = '#16a34a';

  if (score < 5) ringColor = '#dc2626';
  else if (score < 7.5) ringColor = '#d97706';

  return (
    <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />

        <circle
          cx="50"
          cy="50"
          r={radius}
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
        <span className="text-4xl font-semibold leading-none" style={{ color: ringColor }}>
          {score.toFixed(1)}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">/ 10</span>
      </div>
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
  return (
    <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[status]}`}
      >
        {status}
      </span>

      <div className="mt-4 flex items-end justify-between gap-3 sm:mt-5">
        <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {count}
        </span>

        <span className="text-xs text-muted-foreground">
          task{count !== 1 ? 's' : ''}
        </span>
      </div>

    </div>
  );
}

interface PortalQuickAction {
  label: string;
  icon: typeof Bell;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

function MobilePagerDots({
  count,
  activeIndex,
  onChange,
}: {
  count: number;
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  if (count <= 1) return null;

  return (
    <div className="mt-2 flex items-center justify-center gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(index)}
          aria-label={`Go to item ${index + 1}`}
          className={`h-1.5 rounded-full transition-all ${
            index === activeIndex
              ? 'w-5 bg-foreground'
              : 'w-1.5 bg-foreground/25 hover:bg-foreground/40'
          }`}
        />
      ))}
    </div>
  );
}

function SwipeCarouselCard({
  children,
  activeIndex,
  count,
  onChange,
  className = '',
}: {
  children: React.ReactNode;
  activeIndex: number;
  count: number;
  onChange: (index: number) => void;
  className?: string;
}) {
  const goToIndex = (direction: number) => {
    if (count <= 1) return;

    const nextIndex = activeIndex + direction;

    if (nextIndex < 0) {
      onChange(count - 1);
      return;
    }

    if (nextIndex >= count) {
      onChange(0);
      return;
    }

    onChange(nextIndex);
  };

  return (
    <motion.div
      key={activeIndex}
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      drag={count > 1 ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.04}
      onDragEnd={(_, info) => {
        const swipePower = Math.abs(info.offset.x) * info.velocity.x;

        if (info.offset.x < -36 || swipePower < -900) {
          goToIndex(1);
        }

        if (info.offset.x > 36 || swipePower > 900) {
          goToIndex(-1);
        }
      }}
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl touch-pan-y select-none ${count > 1 ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}

function FloatingPortalActionDock({ actions }: { actions: PortalQuickAction[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      setOpen(false);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [open]);

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] right-6 z-[80] md:bottom-8 md:right-8">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="mb-3 max-h-[70vh] w-[14.5rem] overflow-y-auto rounded-3xl border border-white/18 bg-[#4F4E4D]/58 p-2 shadow-2xl shadow-black/22 backdrop-blur-sm dark:border-white/10 dark:bg-black/60"
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />

            <div className="relative z-10 space-y-1.5">
              <div className="px-2 pb-1 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/55 dark:text-white/50">
                  Quick Actions
                </p>
              </div>

              {actions.map(action => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    onClick={async () => {
                      if (action.disabled) return;

                      setOpen(false);
                      await action.onClick();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-2xl border border-black/10 bg-black/6 px-3 py-2.5 text-left text-black transition-colors hover:bg-black/12 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/14 dark:bg-white/9 dark:text-white dark:hover:bg-white/16"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/8 dark:bg-white/12">
                      <Icon size={15} />
                    </span>

                    <span className="truncate text-sm font-semibold">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen(current => !current)}
        whileTap={{ scale: 0.94 }}
        animate={open ? { rotate: 45 } : { rotate: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative ml-auto flex h-13 w-13 items-center justify-center overflow-hidden rounded-full border border-white/18 bg-[#4F4E4D]/54 text-black shadow-2xl shadow-black/22 backdrop-blur-sm transition-colors hover:bg-[#4F4E4D]/62 supports-[backdrop-filter]:bg-[#4F4E4D]/48 dark:border-white/10 dark:bg-black/60 dark:text-white dark:hover:bg-black/70"
        aria-expanded={open}
        aria-label="Toggle portal quick actions"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/24 dark:via-white/6" />
        <Sparkles size={19} className="relative z-10" />
      </motion.button>
    </div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const { profile, userDepartments } = useAuth();

  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [locationStamp, setLocationStamp] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<PortalProjectMini[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<TaskStatus, number>>({
    'Not Started': 0,
    Ongoing: 0,
    Overdue: 0,
    Completed: 0,
  });
  const [tasksLoading, setTasksLoading] = useState(true);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [mobileProjectIndex, setMobileProjectIndex] = useState(0);
  const [mobileDeadlineIndex, setMobileDeadlineIndex] = useState(0);
  const [mobileProjectFlipped, setMobileProjectFlipped] = useState(false);
  const [mobileDeadlineFlipped, setMobileDeadlineFlipped] = useState(false);

  const resolveLocation = useCallback((): Promise<string> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve('Location not available');
        return;
      }

      setLocationLoading(true);

      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords;

          try {
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );

            const data = await response.json();

            setLocationLoading(false);
            resolve(
              `${data.locality || data.city || 'Unknown area'}, ${
                data.principalSubdivision || data.countryName
              }`
            );
          } catch (error) {
            setLocationLoading(false);
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

  useEffect(() => {
    resolveLocation().then(loc => setLocationStamp(loc));
  }, [resolveLocation]);

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

  const handleCheckIn = async () => {
    if (!profile) return;
    if (attendance?.check_in) return;

    setAttendanceError('');
    setCheckingIn(true);

    const loc = await resolveLocation();
    const now = new Date().toISOString();

    const { error } = await supabase.from('attendance').upsert(
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

  useEffect(() => {
    if (!profile) return;

    (async () => {
      setTasksLoading(true);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
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

      const taskRows = (data as Task[]) || [];
      setAssignedTasks(taskRows);

      const projectIds = Array.from(
        new Set(
          taskRows
            .map(task => task.project_id)
            .filter((projectId): projectId is string => Boolean(projectId))
        )
      );

      if (projectIds.length > 0) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, client_name, status, start_date, end_date')
          .in('id', projectIds);

        setAssignedProjects((projectData as PortalProjectMini[]) || []);
      } else {
        setAssignedProjects([]);
      }

      for (const task of taskRows) {
        const effective = calcEffectiveStatus(task);
        counts[effective]++;
      }

      setTaskCounts(counts);
      setTasksLoading(false);
    })();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    (async () => {
      setAnnouncementsLoading(true);

      const deptIds = profile.department_ids || [];

      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const relevant = (data as Announcement[])
          .filter(announcement => {
            if (announcement.target_type === 'company') return true;

            if (announcement.target_type === 'department' && announcement.target_department_id) {
              return deptIds.includes(announcement.target_department_id);
            }

            return false;
          })
          .slice(0, 5);

        setAnnouncements(relevant);
      }

      setAnnouncementsLoading(false);
    })();
  }, [profile]);

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

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);

    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, is_read: true } : notification
      )
    );
  };

  const activeTasks = useMemo(
    () =>
      assignedTasks
        .filter(task => task.status !== 'Completed')
        .sort((a, b) => {
          const statusWeight = (task: Task) => {
            const effective = calcEffectiveStatus(task);

            if (effective === 'Overdue') return 0;
            if (effective === 'Ongoing') return 1;
            return 2;
          };

          const weightDiff = statusWeight(a) - statusWeight(b);

          if (weightDiff !== 0) return weightDiff;

          return getTaskDueDistance(a.deadline) - getTaskDueDistance(b.deadline);
        }),
    [assignedTasks]
  );

  const nextActionTask = activeTasks[0] || null;

  const dueSoonTasks = useMemo(
    () =>
      assignedTasks
        .filter(task => task.status !== 'Completed' && task.deadline)
        .sort((a, b) => getTaskDueDistance(a.deadline) - getTaskDueDistance(b.deadline))
        .slice(0, 4),
    [assignedTasks]
  );

  const projectMiniCards = useMemo(
    () =>
      assignedProjects
        .map(project => {
          const activeCount = assignedTasks.filter(
            task => task.project_id === project.id && task.status !== 'Completed'
          ).length;

          const nextDeadline = assignedTasks
            .filter(task => task.project_id === project.id && task.status !== 'Completed' && task.deadline)
            .sort((a, b) => getTaskDueDistance(a.deadline) - getTaskDueDistance(b.deadline))[0]?.deadline || null;

          return {
            ...project,
            activeCount,
            nextDeadline,
          };
        })
        .sort((a, b) => b.activeCount - a.activeCount)
        .slice(0, 3),
    [assignedProjects, assignedTasks]
  );

  useEffect(() => {
    setMobileProjectIndex(current =>
      Math.min(current, Math.max(projectMiniCards.length - 1, 0))
    );
  }, [projectMiniCards.length]);

  useEffect(() => {
    setMobileDeadlineIndex(current =>
      Math.min(current, Math.max(dueSoonTasks.length - 1, 0))
    );
  }, [dueSoonTasks.length]);

  useEffect(() => {
    setMobileProjectFlipped(false);
  }, [mobileProjectIndex]);

  useEffect(() => {
    setMobileDeadlineFlipped(false);
  }, [mobileDeadlineIndex]);

  const activeMobileProject = projectMiniCards[mobileProjectIndex] || null;
  const activeMobileDeadline = dueSoonTasks[mobileDeadlineIndex] || null;

  const isCheckedIn = !!attendance?.check_in;
  const isCheckedOut = !!attendance?.check_out;
  const attendanceComplete = isCheckedIn && isCheckedOut;

  const portalQuickActions = useMemo<PortalQuickAction[]>(
    () => [
      {
        label: 'Add Task',
        icon: Plus,
        onClick: () => navigate('/portal/tasks?action=create'),
      },
      {
        label: 'My Tasks',
        icon: CheckSquare,
        onClick: () => navigate('/portal/tasks'),
      },
      {
        label: 'My Projects',
        icon: BriefcaseBusiness,
        onClick: () => navigate('/portal/projects'),
      },
    ],
    [navigate]
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-32 sm:px-6 lg:px-8 lg:pb-10">
      <div className="mb-5 border-b border-border pb-5 sm:mb-8 sm:pb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              Employee Portal
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
              {profile?.full_name?.split(' ')[0] || 'there'}
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              Your workday overview, attendance status, assigned tasks, and latest updates.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {userDepartments.length > 0 ? (
              userDepartments.map(department => (
                <span
                  key={department.id}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  {department.code} - {department.name}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                No department assigned
              </span>
            )}
          </div>
        </div>
      </div>

      <motion.div
        variants={bentoContainerMotion}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-12"
      >
<motion.div
          variants={bentoCardMotion}
          transition={bentoTransition}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          className="col-span-2 rounded-3xl border border-border bg-card p-3.5 sm:p-5 lg:col-span-12 xl:col-span-9"
        >
          <div className="mb-3 flex items-start justify-between gap-3 sm:mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Attendance
            </p>

            <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground sm:text-base">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />

              <span>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </div>
          </div>

          {attendanceError && (
            <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">
                Attendance error
              </p>

              <p className="mt-1 text-xs text-destructive/80">
                {attendanceError}
              </p>
            </div>
          )}

          {attendanceLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background p-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading attendance...
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem] sm:items-stretch">
              <div className="rounded-2xl border border-border bg-background p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Checked In
                    </p>

                    <div className="mt-2 flex items-center gap-2 sm:mt-3">
                      <ArrowRight
                        className={`h-4 w-4 ${
                          isCheckedIn ? 'text-emerald-500' : 'text-muted-foreground'
                        }`}
                      />

                      <p
                        className={`text-base font-semibold ${
                          isCheckedIn ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {isCheckedIn ? formatTime(attendance!.check_in) : '-'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Checked Out
                    </p>

                    <div className="mt-2 flex items-center gap-2 sm:mt-3">
                      <ArrowLeft
                        className={`h-4 w-4 ${
                          isCheckedOut ? 'text-blue-500' : 'text-muted-foreground'
                        }`}
                      />

                      <p
                        className={`text-base font-semibold ${
                          isCheckedOut ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {isCheckedOut ? formatTime(attendance!.check_out) : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:mt-4">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />

                  <p className="truncate text-xs text-muted-foreground">
                    {locationLoading
                      ? 'Getting location...'
                      : locationStamp || attendance?.location_stamp || 'Location not available'}
                  </p>
                </div>
              </div>

              {attendanceComplete ? (
                <div className="flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center sm:min-h-24 sm:py-4">
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />

                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Complete
                  </p>
                </div>
              ) : !isCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="flex min-h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary/90 disabled:translate-y-0 disabled:opacity-50 sm:min-h-24 sm:gap-2 sm:py-4"
                >
                  <LogIn className="h-5 w-5" />
                  {checkingIn ? 'Checking...' : 'Check In'}
                </button>
              ) : (
                <button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  className="flex min-h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 shadow-lg shadow-amber-500/10 transition-transform hover:-translate-y-0.5 hover:bg-amber-500/15 disabled:translate-y-0 disabled:opacity-50 dark:text-amber-300 sm:min-h-24 sm:gap-2 sm:py-4"
                >
                  <LogOut className="h-5 w-5" />
                  {checkingOut ? 'Checking...' : 'Check Out'}
                </button>
              )}
            </div>
          )}
        </motion.div>

<FlipInfoCard
          className="col-span-1 min-h-[11rem] sm:min-h-[13rem] lg:col-span-3"
          front={
            <div className="flex h-full items-center justify-center">
              <KpiScoreCircle score={profile?.kpi_score ?? 0} />
            </div>
          }
          back={
            <div className="flex h-full flex-col justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                KPI Details
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {(profile?.kpi_score ?? 0).toFixed(1)} / 10
              </h2>

              <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted-foreground sm:text-sm">
                {(profile?.kpi_score ?? 0) >= 8
                  ? 'Excellent performance. Keep the momentum steady.'
                  : (profile?.kpi_score ?? 0) >= 6
                    ? 'Good work. Timely completions will improve this further.'
                    : 'Focus on current tasks, deadlines, and work updates.'}
              </p>
            </div>
          }
        />

<FlipInfoCard
          className="col-span-1 min-h-[11rem] sm:min-h-[13rem] lg:col-span-4"
          actionLabel="Open My Tasks"
          onAction={() => navigate('/portal/tasks')}
          front={
            <div className="flex h-full flex-col justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Next Action
              </p>

              {tasksLoading ? (
                <div className="mt-4 h-16 animate-pulse rounded-2xl border border-border bg-muted/40" />
              ) : nextActionTask ? (
                <div>
                  <p className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
                    {nextActionTask.title}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_BADGE[calcEffectiveStatus(nextActionTask)]
                      }`}
                    >
                      {calcEffectiveStatus(nextActionTask)}
                    </span>

                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {formatTaskDueLabel(nextActionTask.deadline)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  No active task
                </p>
              )}

              <p className="text-[10px] text-muted-foreground">
                Tap for details
              </p>
            </div>
          }
          back={
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                Task Details
              </p>

              <p className="mt-2 line-clamp-4 text-xs leading-5 text-muted-foreground sm:text-sm">
                {nextActionTask
                  ? 'Open My Tasks to update status, review deadline, or continue the task.'
                  : 'New assignments will appear here when they are added.'}
              </p>
            </div>
          }
        />

        <motion.div
          variants={bentoCardMotion}
          transition={bentoTransition}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          className="col-span-2 rounded-3xl border border-border bg-card p-4 sm:p-5 lg:col-span-8"
        >
          <div className="mb-4 flex items-center justify-between gap-4 sm:mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Workload
              </p>

              <h2 className="mt-2 text-lg font-semibold text-foreground">
                My Tasks
              </h2>
            </div>

            <p className="text-xs text-muted-foreground">
              Total: {tasksLoading ? '...' : Object.values(taskCounts).reduce((a, b) => a + b, 0)}
            </p>
          </div>

          {tasksLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {(['Not Started', 'Ongoing', 'Overdue', 'Completed'] as TaskStatus[]).map(status => (
                <div
                  key={status}
                  className="h-24 animate-pulse rounded-2xl border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {(['Not Started', 'Ongoing', 'Overdue', 'Completed'] as TaskStatus[]).map(status => (
                <TaskSummaryCard key={status} status={status} count={taskCounts[status]} />
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          variants={bentoCardMotion}
          transition={bentoTransition}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          className="col-span-1 flex aspect-square flex-col self-start rounded-3xl border border-border bg-card p-3.5 sm:p-4 lg:col-span-3 xl:col-span-3"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Projects
            </p>

            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {projectMiniCards.length}
            </span>
          </div>

          {tasksLoading ? (
            <div className="min-h-0 flex-1 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ) : activeMobileProject ? (
            <SwipeCarouselCard
              activeIndex={mobileProjectIndex}
              count={projectMiniCards.length}
              onChange={setMobileProjectIndex}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl [perspective:1000px]">
                <motion.div
                  animate={{ rotateY: mobileProjectFlipped ? 180 : 0 }}
                  transition={{ duration: 0.36, ease: 'easeInOut' }}
                  className="relative h-full w-full [transform-style:preserve-3d]"
                >
                  <button
                    type="button"
                    onClick={() => setMobileProjectFlipped(true)}
                    className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border border-border bg-background p-3 text-left outline-none [backface-visibility:hidden] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4"
                  >
                    <div>
                      <p className="line-clamp-2 text-base font-semibold leading-tight text-foreground">
                        {activeMobileProject.name}
                      </p>

                      {activeMobileProject.client_name && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                          {activeMobileProject.client_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {activeMobileProject.activeCount} task{activeMobileProject.activeCount !== 1 ? 's' : ''}
                      </span>

                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {activeMobileProject.nextDeadline
                          ? formatTaskDueLabel(activeMobileProject.nextDeadline)
                          : 'No deadline'}
                      </p>
                    </div>
                  </button>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setMobileProjectFlipped(false)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setMobileProjectFlipped(false);
                      }
                    }}
                    className="absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between rounded-2xl border border-border bg-background p-3 outline-none [backface-visibility:hidden] [transform:rotateY(180deg)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Project
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">
                        {activeMobileProject.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        navigate(`/portal/projects?projectId=${activeMobileProject.id}`);
                      }}
                      className="inline-flex h-8 w-full items-center justify-center rounded-xl bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Open Project
                    </button>
                  </div>
                </motion.div>
              </div>
            </SwipeCarouselCard>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center rounded-2xl border border-dashed border-border bg-background p-3 sm:p-4">
              <p className="text-sm font-semibold text-foreground">
                No projects
              </p>

              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                Linked projects will appear here.
              </p>
            </div>
          )}

          <MobilePagerDots
            count={projectMiniCards.length}
            activeIndex={mobileProjectIndex}
            onChange={setMobileProjectIndex}
          />
        </motion.div>

        <motion.div
          variants={bentoCardMotion}
          transition={bentoTransition}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          className="col-span-1 flex aspect-square flex-col self-start rounded-3xl border border-border bg-card p-3.5 sm:p-4 lg:col-span-3 xl:col-span-3"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Deadlines
            </p>

            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>

          {tasksLoading ? (
            <div className="min-h-0 flex-1 animate-pulse rounded-2xl border border-border bg-muted/40" />
          ) : activeMobileDeadline ? (
            <SwipeCarouselCard
              activeIndex={mobileDeadlineIndex}
              count={dueSoonTasks.length}
              onChange={setMobileDeadlineIndex}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl [perspective:1000px]">
                <motion.div
                  animate={{ rotateY: mobileDeadlineFlipped ? 180 : 0 }}
                  transition={{ duration: 0.36, ease: 'easeInOut' }}
                  className="relative h-full w-full [transform-style:preserve-3d]"
                >
                  <button
                    type="button"
                    onClick={() => setMobileDeadlineFlipped(true)}
                    className={`absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-3 text-left outline-none [backface-visibility:hidden] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4 ${
                      calcEffectiveStatus(activeMobileDeadline) === 'Overdue'
                        ? 'border-destructive/20 bg-destructive/10'
                        : 'border-border bg-background'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground sm:text-base">
                        {activeMobileDeadline.title}
                      </p>

                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {calcEffectiveStatus(activeMobileDeadline)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_BADGE[calcEffectiveStatus(activeMobileDeadline)]
                        }`}
                      >
                        {formatTaskDueLabel(activeMobileDeadline.deadline)}
                      </span>
                    </div>
                  </button>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setMobileDeadlineFlipped(false)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setMobileDeadlineFlipped(false);
                      }
                    }}
                    className="absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between rounded-2xl border border-border bg-background p-3 outline-none [backface-visibility:hidden] [transform:rotateY(180deg)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Task
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">
                        {activeMobileDeadline.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        navigate(`/portal/tasks?taskId=${activeMobileDeadline.id}`);
                      }}
                      className="inline-flex h-8 w-full items-center justify-center rounded-xl bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Open Task
                    </button>
                  </div>
                </motion.div>
              </div>
            </SwipeCarouselCard>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col justify-center rounded-2xl border border-dashed border-border bg-background p-3 sm:p-4">
              <p className="text-sm font-semibold text-foreground">
                No deadlines
              </p>

              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                Pending deadlines will appear here.
              </p>
            </div>
          )}

          <MobilePagerDots
            count={dueSoonTasks.length}
            activeIndex={mobileDeadlineIndex}
            onChange={setMobileDeadlineIndex}
          />
        </motion.div>

        <motion.div
          variants={bentoCardMotion}
          transition={bentoTransition}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          className="col-span-2 rounded-3xl border border-border bg-card p-4 sm:p-5 lg:col-span-4"
        >
          <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Updates
              </p>

              <h2 className="mt-2 text-lg font-semibold text-foreground">
                Today
              </h2>
            </div>

            <p className="shrink-0 text-xs text-muted-foreground">
              {announcementsLoading || notifsLoading
                ? 'Loading...'
                : `${notifications.filter(notification => !notification.is_read).length} unread`}
            </p>
          </div>

          {announcementsLoading || notifsLoading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(item => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-2xl border border-border bg-muted/40"
                />
              ))}
            </div>
          ) : announcements.length === 0 && notifications.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background p-6 text-center">
              <Info className="h-5 w-5 text-muted-foreground" />

              <div>
                <p className="text-sm font-medium text-foreground">
                  No updates for now
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  New announcements and task notifications will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {announcements.slice(0, 1).map(announcement => (
                <div
                  key={`announcement-${announcement.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                >
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {announcement.title}
                      </p>

                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                        {announcement.target_type === 'company' ? 'Company' : 'Dept'}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {announcement.content}
                    </p>
                  </div>

                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelativeDate(announcement.created_at)}
                  </p>
                </div>
              ))}

              {notifications.slice(0, announcements.length > 0 ? 3 : 4).map(notification => (
                <button
                  key={`notification-${notification.id}`}
                  type="button"
                  onClick={() => !notification.is_read && markRead(notification.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    notification.is_read
                      ? 'border-border bg-background opacity-70'
                      : 'border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/15'
                  }`}
                >
                  <Bell
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      notification.is_read ? 'text-muted-foreground' : 'text-blue-500'
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {notification.title}
                    </p>

                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeDate(notification.created_at)}
                    </p>

                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                </button>
              ))}

              {announcements.length === 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />

                  <p className="text-xs text-muted-foreground">
                    No announcements today.
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      <FloatingPortalActionDock actions={portalQuickActions} />
    </div>
  );
}
