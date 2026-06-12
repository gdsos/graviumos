import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  LockKeyhole,
  Pencil,
  Save,
} from 'lucide-react';
import { DateInput } from '@/components/common/DateInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { PaymentGate } from '../types';

type FinancePaymentGateDisplayStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'overpaid'
  | 'cancelled'
  | 'received'
  | 'overdue'
  | string;

type FinancePaymentGateDisplay = {
  status: FinancePaymentGateDisplayStatus;
  requiredAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
};

interface PaymentGateBarProps {
  paymentGates: PaymentGate[];
  financePaymentStatuses?: Record<string, FinancePaymentGateDisplay>;
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

function formatDate(dateString?: string) {
  if (!dateString) return 'Not set';

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatPaymentStatus(status?: FinancePaymentGateDisplayStatus) {
  if (status === 'paid' || status === 'received') return 'Paid';
  if (status === 'partial') return 'Partial';
  if (status === 'overpaid') return 'Overpaid';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'overdue') return 'Overdue';

  return 'Pending';
}

function getPaymentVariant(status?: FinancePaymentGateDisplayStatus) {
  if (status === 'paid' || status === 'received') return 'success';
  if (status === 'overdue' || status === 'cancelled') return 'danger';
  if (status === 'partial' || status === 'overpaid') return 'warning';

  return 'outline';
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
  financePaymentStatuses = {},
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
            <StatusBadge variant="outline">Finance Linked</StatusBadge>
          </div>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Payment gates show scheduled collection stages. Collection status is managed from Finance.
          </p>
        </div>

        {onUpdateDueDate ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {onAutoAssignDueDates ? (
              <button
                type="button"
                onClick={onAutoAssignDueDates}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
              >
                <CalendarClock className="h-4 w-4" />
                Auto Assign Dates
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowGateDateControls(current => !current)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90 sm:w-auto"
            >
              {showGateDateControls ? (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Gate Dates</span>
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  <span>Edit Gate Dates</span>
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>

      {showGateDateControls && onUpdateDueDate ? (
        <div className="border-b border-border bg-background/70 px-4 py-4 sm:px-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {paymentGates.map(paymentGate => (
              <label key={paymentGate.id} className="grid gap-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {paymentGate.title}
                </span>
                <DateInput
                  value={paymentGate.dueDate ?? ''}
                  onChange={value => onUpdateDueDate(paymentGate.id, value)}
                  placeholder="Select due date"
                  popoverMode="fixed"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-4">
        {paymentGates.map((paymentGate, index) => {
          const financeStatus = financePaymentStatuses[paymentGate.id];
          const displayStatus = financeStatus?.status ?? paymentGate.status;
          const isCollected =
            displayStatus === 'paid' || displayStatus === 'received';
          const Icon = isCollected ? CheckCircle2 : CircleDashed;
          const accent = getGateAccent(index);

          return (
            <article
              key={paymentGate.id}
              className="relative flex min-h-full flex-col overflow-hidden rounded-2xl border border-border bg-background p-4"
            >
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`}
              />

              <div className="min-h-[7rem]">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Gate {index + 1}
                      </p>

                      <StatusBadge variant={getPaymentVariant(displayStatus)}>
                        {formatPaymentStatus(displayStatus)}
                      </StatusBadge>
                    </div>

                    <h3 className="mt-1 line-clamp-2 text-base font-semibold text-foreground">
                      {paymentGate.title}
                    </h3>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {paymentGate.description}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-border bg-card p-3">
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3">
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="min-w-max text-right text-sm font-semibold text-foreground">
                    {formatINR(financeStatus?.requiredAmount ?? paymentGate.amount)}
                  </dd>

                  <dt className="text-xs text-muted-foreground">Due Date</dt>
                  <dd className="min-w-max text-right text-sm font-medium text-foreground">
                    {formatDate(paymentGate.dueDate)}
                  </dd>

                  <dt className="text-xs text-muted-foreground">Blocks</dt>
                  <dd className="min-w-max text-right text-sm font-medium text-foreground">
                    {paymentGate.blocksWorkPackageIds.length} work package(s)
                  </dd>
                </dl>
              </div>

              <div className="mt-auto pt-4">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Finance Status</span>
                    </span>

                    <StatusBadge variant={getPaymentVariant(displayStatus)}>
                      {formatPaymentStatus(displayStatus)}
                    </StatusBadge>
                  </div>

                  {financeStatus ? (
                    <div className="mt-3 grid grid-cols-2 divide-x divide-border text-xs">
                      <div className="min-w-0 pr-3">
                        <p className="font-semibold text-muted-foreground">
                          Collected
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(financeStatus.collectedAmount)}
                        </p>
                      </div>

                      <div className="min-w-0 pl-3 text-right">
                        <p className="font-semibold text-muted-foreground">
                          Outstanding
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-amber-600 dark:text-amber-300">
                          {formatINR(financeStatus.outstandingAmount)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      Waiting for Finance sync. Payment marking is handled from Finance.
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
