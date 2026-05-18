import { useEffect, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  Mail,
  Pencil,
  Phone,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { Vendor } from '../types';
import {
  vendorAvailabilityLabels,
  vendorCategoryLabels,
  vendorStatusLabels,
} from '../data';

interface VendorCardProps {
  vendor: Vendor;
  onEdit?: (vendor: Vendor) => void;
  onDelete?: (vendor: Vendor) => void;
}

function getAvailabilityVariant(availability: Vendor['availability']) {
  if (availability === 'available') return 'success';
  if (availability === 'busy') return 'warning';
  return 'muted';
}

function formatCategoryLabel(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getStatusVariant(status: Vendor['status']) {
  if (status === 'active') return 'success';
  if (status === 'blacklisted') return 'danger';
  return 'muted';
}

function isMobileViewport() {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(max-width: 1023px)').matches;
}

export function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  const [isMobileContactOpen, setIsMobileContactOpen] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const categoryLabel =
    vendorCategoryLabels[vendor.category] ?? formatCategoryLabel(vendor.category);

  useEffect(() => {
    if (!isMobileContactOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isMobileViewport()) return;

      const target = event.target as Node | null;

      if (target && cardRef.current?.contains(target)) return;

      setIsMobileContactOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileContactOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (!isMobileViewport()) {
        setIsMobileContactOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleCardClick = () => {
    if (!isMobileViewport()) return;

    setIsMobileContactOpen(current => !current);
  };

  return (
    <article
      ref={cardRef}
      onClick={handleCardClick}
      className="relative grid cursor-pointer gap-3 bg-card px-4 py-4 text-card-foreground transition hover:bg-muted/25 lg:cursor-default lg:grid-cols-[minmax(240px,1.15fr)_minmax(220px,1fr)_minmax(220px,1fr)_170px] lg:items-center lg:gap-4"
    >
      <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs font-medium text-foreground lg:hidden">
        <Star className="h-3.5 w-3.5 fill-current" />
        {vendor.rating.toFixed(1)}
      </div>

      <div className="min-w-0 pr-16 lg:pr-0">
        <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
          {vendor.name}
        </h3>

        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <div className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs font-medium text-foreground lg:flex">
            <Star className="h-3.5 w-3.5 fill-current" />
            {vendor.rating.toFixed(1)}
          </div>

          <span className="flex min-w-0 items-center gap-1.5">
            <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{categoryLabel}</span>
          </span>
        </div>

        {isMobileContactOpen && (
          <div className="mt-2 grid min-w-0 gap-1 text-xs text-muted-foreground lg:hidden">
            {vendor.email && (
              <div className="flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{vendor.email}</span>
              </div>
            )}

            <div className="flex min-w-0 items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{vendor.contactPerson}</span>
              <span className="shrink-0 text-muted-foreground/60">|</span>
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{vendor.phone}</span>
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge variant={getStatusVariant(vendor.status)}>
            {vendorStatusLabels[vendor.status]}
          </StatusBadge>

          <StatusBadge variant={getAvailabilityVariant(vendor.availability)}>
            {vendorAvailabilityLabels[vendor.availability]}
          </StatusBadge>
        </div>
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 text-sm leading-5 text-muted-foreground lg:line-clamp-1">
          {vendor.scopeOfWork}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {vendor.assignedProjectCount} assigned project
          {vendor.assignedProjectCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="hidden min-w-0 gap-1.5 text-sm text-muted-foreground lg:grid">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />
          <span className="truncate">{vendor.contactPerson}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Phone className="h-4 w-4 shrink-0" />
          <span className="truncate">{vendor.phone}</span>
        </div>

        {vendor.email && (
          <div className="flex min-w-0 items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-2 gap-2"
        onClick={event => event.stopPropagation()}
      >
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(vendor)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition hover:bg-muted"
            aria-label={`Edit ${vendor.name}`}
          >
            <Pencil className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Edit</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(vendor)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"
            aria-label={`Delete ${vendor.name}`}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Delete</span>
          </button>
        )}
      </div>
    </article>
  );
}
