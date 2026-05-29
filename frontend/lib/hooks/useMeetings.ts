'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MeetingWithCounts } from '@/types';

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      const { data, error: dbError } = await supabase
        .from('meetings')
        .select(`
          *,
          action_items(count)
        `)
        .order('created_at', { ascending: false });

      if (dbError) throw new Error(dbError.message);

      const mapped: MeetingWithCounts[] = (data ?? []).map((row) => ({
        ...row,
        action_item_count: (row.action_items as unknown as Array<{ count: number }>)[0]?.count ?? 0,
      }));

      setMeetings(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  return { meetings, loading, error, refetch: fetchMeetings };
}
