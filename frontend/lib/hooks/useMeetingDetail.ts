'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MeetingDetail } from '@/types';

export function useMeetingDetail(meetingId: string) {
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeeting = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      const { data, error: dbError } = await supabase
        .from('meetings')
        .select(`
          *,
          transcript:transcripts(*),
          summary:meeting_summaries(*),
          action_items(*)
        `)
        .eq('id', meetingId)
        .single();

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('Meeting not found');

      setMeeting({
        ...data,
        transcript: Array.isArray(data.transcript) ? data.transcript[0] ?? null : data.transcript,
        summary: Array.isArray(data.summary) ? data.summary[0] ?? null : data.summary,
        action_items: data.action_items ?? [],
      } as MeetingDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchMeeting();
  }, [fetchMeeting]);

  return { meeting, loading, error, refetch: fetchMeeting };
}
