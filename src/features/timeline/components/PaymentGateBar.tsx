import { CheckCircle2, CircleDashed, LockKeyhole, WalletCards } from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { PaymentGate } from '../types';

interface PaymentGateBarProps {
  paymentGates: PaymentGate[];
  onMarkReceived?: (paymentGate: PaymentGate) => void;
  onMarkPending?: (paymentGate: PaymentGate) => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaymentVariant(status: PaymentGate['status']) {
  if (status === 'received') return 'success';
  if (status === 'overdue') return 'danger';
  return 'warning';
}

export function PaymentGateBar({
  paymentGates,
  onMarkReceived,
  onMarkPending,
}: PaymentGateBarProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Payment Gates
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Payment gates linked to process stages. Related work stays blocked until payment is received.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
          <WalletCards className="h-4 w-4" />
          {paymentGates.length} gates
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
          {paymentGates.map((paymentGate, index) => {
            const isReceived = paymentGate.status === 'received';
            const Icon = isReceived ? CheckCircle2 : LockKeyhole;

            return (
              <div
                key={paymentGate.id}
                className="flex min-w-0 h-full flex-col rounded-2xl border border-border bg-background p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {isReceived ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <CircleDashed className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Gate {index + 1}
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {paymentGate.title}
                      </p>
                      {paymentGate.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {paymentGate.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <StatusBadge variant={getPaymentVariant(paymentGate.status)}>
                    {paymentGate.status}
                  </StatusBadge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium text-foreground">
                      {formatINR(paymentGate.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium text-foreground">
                      {paymentGate.dueDate}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Blocks</span>
                    <span className="font-medium text-foreground">
                      {paymentGate.blocksWorkPackageIds.length}
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  {isReceived && onMarkPending ? (
                    <button
                      type="button"
                      onClick={() => onMarkPending(paymentGate)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                    >
                      <Icon className="h-4 w-4" />
                      Unmark
                    </button>
                  ) : !isReceived && onMarkReceived ? (
                    <button
                      type="button"
                      onClick={() => onMarkReceived(paymentGate)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      <Icon className="h-4 w-4" />
                      Mark Received
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
