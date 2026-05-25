import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

type CalendarView = 'days' | 'months' | 'years';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateValue(value: string): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function formatDateValue(value: string): string {
  const date = parseDateValue(value);
  if (!date) return '';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leadingBlankCount = firstDay.getDay();

  return {
    leadingBlankCount,
    days: Array.from({ length: lastDay.getDate() }, (_, index) => new Date(year, month, index + 1)),
  };
}

function getYearRange(year: number) {
  const start = Math.floor(year / 12) * 12;

  return Array.from({ length: 12 }, (_, index) => start + index);
}

export function DateInput({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className = '',
}: DateInputProps) {
  const selectedDate = parseDateValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('days');
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const rootRef = useRef<HTMLDivElement | null>(null);

  const monthDays = useMemo(() => getMonthDays(viewDate), [viewDate]);
  const yearRange = useMemo(() => getYearRange(viewDate.getFullYear()), [viewDate]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setCalendarView('days');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [value]);

  const openPicker = () => {
    if (disabled) return;

    setIsOpen(current => {
      const next = !current;
      if (next) setCalendarView('days');
      return next;
    });
  };

  const goToPrevious = () => {
    if (calendarView === 'years') {
      setViewDate(current => new Date(current.getFullYear() - 12, current.getMonth(), 1));
      return;
    }

    if (calendarView === 'months') {
      setViewDate(current => new Date(current.getFullYear() - 1, current.getMonth(), 1));
      return;
    }

    setViewDate(current => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNext = () => {
    if (calendarView === 'years') {
      setViewDate(current => new Date(current.getFullYear() + 12, current.getMonth(), 1));
      return;
    }

    if (calendarView === 'months') {
      setViewDate(current => new Date(current.getFullYear() + 1, current.getMonth(), 1));
      return;
    }

    setViewDate(current => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const selectDate = (date: Date) => {
    onChange(toDateValue(date));
    setIsOpen(false);
    setCalendarView('days');
  };

  const selectToday = () => {
    const today = new Date();
    setViewDate(today);
    onChange(toDateValue(today));
    setIsOpen(false);
    setCalendarView('days');
  };

  const selectMonth = (monthIndex: number) => {
    setViewDate(current => new Date(current.getFullYear(), monthIndex, 1));
    setCalendarView('days');
  };

  const selectYear = (year: number) => {
    setViewDate(current => new Date(year, current.getMonth(), 1));
    setCalendarView('months');
  };

  const getHeaderLabel = () => {
    if (calendarView === 'years') {
      return `${yearRange[0]} - ${yearRange[yearRange.length - 1]}`;
    }

    if (calendarView === 'months') {
      return String(viewDate.getFullYear());
    }

    return viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const handleHeaderClick = () => {
    if (calendarView === 'days') {
      setCalendarView('months');
      return;
    }

    if (calendarView === 'months') {
      setCalendarView('years');
    }
  };

  const todayValue = toDateValue(new Date());

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className="form-input flex h-10 w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ? formatDateValue(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-12 z-50 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-3">
            <button
              type="button"
              onClick={goToPrevious}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleHeaderClick}
              className="rounded-lg px-3 py-1 text-sm font-semibold text-foreground transition hover:bg-muted"
              title={calendarView === 'years' ? 'Year range' : 'Change month or year'}
            >
              {getHeaderLabel()}
            </button>

            <button
              type="button"
              onClick={goToNext}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {calendarView === 'days' && (
            <>
              <div className="grid grid-cols-7 gap-1 px-3 pt-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 p-3">
                {Array.from({ length: monthDays.leadingBlankCount }).map((_, index) => (
                  <div key={`blank-${index}`} />
                ))}

                {monthDays.days.map(date => {
                  const dateValue = toDateValue(date);
                  const isSelected = value === dateValue;
                  const isToday = todayValue === dateValue;

                  return (
                    <button
                      key={dateValue}
                      type="button"
                      onClick={() => selectDate(date)}
                      className={`flex h-9 items-center justify-center rounded-lg text-sm font-medium transition ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : isToday
                            ? 'border border-border bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {calendarView === 'months' && (
            <div className="grid grid-cols-3 gap-2 p-3">
              {MONTH_LABELS.map((month, index) => {
                const isSelected =
                  selectedDate?.getFullYear() === viewDate.getFullYear() &&
                  selectedDate?.getMonth() === index;

                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => selectMonth(index)}
                    className={`h-10 rounded-xl text-sm font-medium transition ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          )}

          {calendarView === 'years' && (
            <div className="grid grid-cols-3 gap-2 p-3">
              {yearRange.map(year => {
                const isSelected = selectedDate?.getFullYear() === year;

                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    className={`h-10 rounded-xl text-sm font-medium transition ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={selectToday}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
