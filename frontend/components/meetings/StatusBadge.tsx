import { cn } from '@/lib/utils';
import { MeetingStatus } from '@/types';

const STATUS_CONFIG: Record<MeetingStatus, { label: string; className: string; pulse: boolean }> = {
  scheduled:    { label: 'Scheduled',    className: 'bg-slate-100 text-slate-600 border-slate-200',         pulse: false },
  recording:    { label: 'Recording',    className: 'bg-violet-100 text-violet-700 border-violet-200',       pulse: true  },
  processing:   { label: 'Processing',   className: 'bg-violet-100 text-violet-700 border-violet-200',       pulse: true  },
  transcribing: { label: 'Transcribing', className: 'bg-indigo-100 text-indigo-700 border-indigo-200',       pulse: true  },
  analysing:    { label: 'Analysing',    className: 'bg-purple-100 text-purple-700 border-purple-200',       pulse: true  },
  complete:     { label: 'Complete',     className: 'bg-emerald-100 text-emerald-700 border-emerald-200',    pulse: false },
  failed:       { label: 'Failed',       className: 'bg-red-100 text-red-600 border-red-200',               pulse: false },
};

interface StatusBadgeProps {
  readonly status: MeetingStatus;
  readonly className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        config.className,
        className
      )}
    >
      {config.pulse ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      )}
      {config.label}
    </span>
  );
}
