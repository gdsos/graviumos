import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  Pencil,
} from 'lucide-react';

import { DateInput } from '@/components/common/DateInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { PaymentGate } from '../types';

interface PaymentGateBarProps {
  paymentGates: PaymentGate[];
  onMarkReceived?: (paymentGate: PaymentGate) => void;
  onMarkPending?: (paymentGate: PaymentGate) => void;
  onUpdateDueDate?: (paymentGateId: string, dueDate: string) => void;
  onAutoAssignDueDates?: () => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatPaymentStatus(status: PaymentGate['status']) {
  if (status === 'received') return 'Received';
  if (status === 'overdue') return 'Overdue';
  return 'Pending';
}

function getPaymentVariant(status: PaymentGate['status']) {
  if (status === 'received') return 'success';
  if (status === 'overdue') return 'danger';
  return 'warning';
}

function getGateAccent(index: number) {
  const accents = [
    'from-amber-500/20 via-amber-500/8 to-transparent',
    'from-blue-500/20 via-blue-500/8 to-transparent',
    'from-violet-500/20 via-violet-500/8 to-transparent',
    'from-emerald-500/20 via-emerald-500/8 to-transparent',
  ];

  return accents[index % accents.length];
}

export function PaymentGateBar({
  paymentGates,
  onMarkReceived,
  onMarkPending,
  onUpdateDueDate,
  onAutoAssignDueDates,
}: PaymentGateBarProps) {
  const [showGateDateControls, setShowGateDateControls] = useState(false);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Payment Gates
            </h2>
            <StatusBadge variant="outline">
              Timeline Linked
            </StatusBadge>
          </div>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Payment gates control collection stages and keep linked work blocked until the required payment is received.
          </p>
        </div>

        {onUpdateDueDate ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {onAutoAssignDueDates ? (
              <button
                type="button"
                onClick={onAutoAssignDueDates}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted sm:w-fit"
              >
                <CalendarClock className="h-4 w-4" />
                Auto Assign Dates
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowGateDateControls(current => !current)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:w-fit"
            >
              <Pencil className="h-4 w-4" />
              {showGateDateControls ? 'Done Editing' : 'Edit Gate Dates'}
            </button>
          </div>
        ) : null}
      </div>

      {showGateDateControls && onUpdateDueDate ? (
        <div className="border-b border-border bg-muted/20 px-4 py-4 sm:px-5">
          <div className="mb-3 flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              Gate Date Setup
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Adjust the planned collection date for each gate. These dates update the Schedule markers.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {paymentGates.map((paymentGate, index) => (
              <div
                key={`edit-${paymentGate.id}`}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {paymentGate.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatINR(paymentGate.amount)}
                    </p>
                  </div>
                </div>

                <DateInput
                  value={paymentGate.dueDate}
                  onChange={value => onUpdateDueDate(paymentGate.id, value)}
                  placeholder="Select gate date"
                  popoverMode="fixed"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
        {paymentGates.map((paymentGate, index) => {
          const isReceived = paymentGate.status === 'received';
          const Icon = isReceived ? CheckCircle2 : LockKeyhole;

          return (
            <article
              key={paymentGate.id}
              className="relative flex min-w-0 h-full flex-col overflow-hidden rounded-2xl border border-border bg-background p-4"
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getGateAccent(
                  index
                )}`}
              />

              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                    {isReceived ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <CircleDashed className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Gate {index + 1}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {paymentGate.title}
                    </p>
                    {paymentGate.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {paymentGate.description}
                      </p>
                    )}
                  </div>
                </div>

                <StatusBadge variant={getPaymentVariant(paymentGate.status)}>
                  {formatPaymentStatus(paymentGate.status)}
                </StatusBadge>
              </div>

              <div className="rounded-2xl border border-border bg-card/60 p-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-right text-sm font-semibold text-foreground">
                    {formatINR(paymentGate.amount)}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Due Date</span>
                  <span className="text-right text-sm font-medium text-foreground">
                    {formatDate(paymentGate.dueDate)}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Blocks</span>
                  <span className="text-right text-sm font-medium text-foreground">
                    {paymentGate.blocksWorkPackageIds.length} work package(s)
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-4">
                {isReceived && onMarkPending ? (
                  <button
                    type="button"
                    onClick={() => onMarkPending(paymentGate)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                  >
                    <Icon className="h-4 w-4" />
                    Unmark Received
                  </button>
                ) : !isReceived && onMarkReceived ? (
                  <button
                    type="button"
                    onClick={() => onMarkReceived(paymentGate)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    <Icon className="h-4 w-4" />
                    Mark Received
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
