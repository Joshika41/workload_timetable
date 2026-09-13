import React from 'react';
import type { FacultyWorkloadStatus, PreferenceSubmissionStatus } from '@/lib/workload-types';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';

interface StatusBadgeProps {
  status: FacultyWorkloadStatus | PreferenceSubmissionStatus | 'UNALLOCATED' | 'ALLOCATED' | 'PARTIALLY_ALLOCATED';
  className?: string;
  size?: 'sm' | 'default';
}

export function WorkloadStatusBadge({ status, className = '', size = 'default' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  switch (status) {
    case 'UNDERLOADED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-amber-300 bg-amber-50 text-amber-800 ${sizeClasses} ${className}`}
        >
          <MinusCircle className="size-3 text-amber-600" />
          UNDERLOADED
        </span>
      );

    case 'BALANCED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="size-3 text-emerald-600" />
          BALANCED
        </span>
      );

    case 'OVERLOADED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-rose-300 bg-rose-50 text-rose-800 ${sizeClasses} ${className}`}
        >
          <AlertTriangle className="size-3 text-rose-600" />
          OVERLOADED
        </span>
      );

    case 'SUBMITTED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-blue-300 bg-blue-50 text-blue-800 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="size-3 text-blue-600" />
          SUBMITTED
        </span>
      );

    case 'PENDING':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-slate-300 bg-slate-100 text-slate-700 ${sizeClasses} ${className}`}
        >
          <Clock className="size-3 text-slate-500" />
          PENDING
        </span>
      );

    case 'ALLOCATED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-teal-300 bg-teal-50 text-teal-800 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="size-3 text-teal-600" />
          ALLOCATED
        </span>
      );

    case 'PARTIALLY_ALLOCATED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-sky-300 bg-sky-50 text-sky-800 ${sizeClasses} ${className}`}
        >
          <Clock className="size-3 text-sky-600" />
          PARTIAL
        </span>
      );

    case 'UNALLOCATED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border border-red-200 bg-red-50 text-red-700 ${sizeClasses} ${className}`}
        >
          <AlertCircle className="size-3 text-red-600" />
          UNALLOCATED
        </span>
      );

    default:
      return (
        <Badge variant="outline" className={sizeClasses}>
          {status}
        </Badge>
      );
  }
}
