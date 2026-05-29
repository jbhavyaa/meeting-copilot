'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MeetingStatus } from '@/types';

export function useRealtimeStatus(meetingId: string, initialStatus: MeetingStatus) {
  const [status, setStatus] = useState<MeetingStatus>(initialStatus);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`meeting-status-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${meetingId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as MeetingStatus | undefined;
          if (newStatus) setStatus(newStatus);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meetingId]);

  return status;
}
