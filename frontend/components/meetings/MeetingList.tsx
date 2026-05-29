'use client';

import { useMeetings } from '@/lib/hooks/useMeetings';
import { MeetingCard } from './MeetingCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Video } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="flex h-44 flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
      <div className="h-1 w-full animate-pulse bg-gradient-to-r from-violet-100 to-indigo-100" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
        <div className="mt-auto flex gap-4 border-t border-border/50 pt-3">
          <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function MeetingList() {
  const { meetings, loading, error } = useMeetings();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['s1','s2','s3','s4','s5','s6'].map((k) => <SkeletonCard key={k} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={<Video className="h-7 w-7" />}
        title="No meetings yet"
        description="Once a Recall.ai bot joins a call, your meeting recordings will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {meetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} />
      ))}
    </div>
  );
}
