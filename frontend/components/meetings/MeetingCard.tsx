'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, Clock, ArrowRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useRealtimeStatus } from '@/lib/hooks/useRealtimeStatus';
import { formatDuration } from '@/lib/utils';
import { MeetingWithCounts } from '@/types';

const PLATFORM_CONFIG = {
  zoom:        { label: 'Zoom',         color: 'bg-blue-100 text-blue-700'   },
  google_meet: { label: 'Google Meet',  color: 'bg-green-100 text-green-700' },
};

interface MeetingCardProps {
  readonly meeting: MeetingWithCounts;
}

function statusAccentClass(status: MeetingWithCounts['status']): string {
  if (status === 'complete')  return 'bg-gradient-to-r from-emerald-400 to-teal-400';
  if (status === 'failed')    return 'bg-gradient-to-r from-red-400 to-rose-400';
  if (status === 'scheduled') return 'bg-gradient-to-r from-slate-200 to-slate-300';
  return 'bg-gradient-to-r from-violet-400 to-indigo-400';
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const liveStatus = useRealtimeStatus(meeting.id, meeting.status);
  const platform = meeting.platform ? PLATFORM_CONFIG[meeting.platform] : null;

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <div className="card-lift group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">

        {/* Top accent bar — colour shifts by status */}
        <div className={`h-1 w-full ${statusAccentClass(liveStatus)}`} />

        <div className="flex flex-1 flex-col gap-4 p-5">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {meeting.title ?? 'Untitled meeting'}
            </h3>
            <StatusBadge status={liveStatus} className="shrink-0" />
          </div>

          {/* Platform chip + time */}
          <div className="flex items-center gap-2">
            {platform && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${platform.color}`}>
                {platform.label}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(meeting.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Stats row */}
          <div className="mt-auto flex items-center gap-4 border-t border-border/50 pt-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 text-violet-400" />
              {formatDuration(meeting.duration_seconds)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckSquare className="h-3 w-3 text-violet-400" />
              {meeting.action_item_count} action item{meeting.action_item_count === 1 ? '' : 's'}
            </span>
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
          </div>
        </div>
      </div>
    </Link>
  );
}
