import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  MeetingStatus,
  WhisperTranscript,
  ClaudeProcessingResult,
  ActionItem,
  Profile,
} from '../../../shared/types';
import { logger } from '../../../shared/logger';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    // Service role key bypasses RLS — only used server-side in Lambda
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

export async function updateMeetingStatus(
  meetingId: string,
  status: MeetingStatus,
  error?: string
): Promise<void> {
  try {
    const update: Record<string, unknown> = { status };
    if (error) update.error_message = error;
    if (status === 'recording') update.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') update.ended_at = new Date().toISOString();

    const { error: dbError } = await getClient()
      .from('meetings')
      .update(update)
      .eq('id', meetingId);

    if (dbError) throw new Error(dbError.message);
    logger.info('Updated meeting status', { meetingId, status });
  } catch (error) {
    throw new Error(
      `updateMeetingStatus failed for "${meetingId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function saveTranscript(
  meetingId: string,
  transcript: WhisperTranscript
): Promise<void> {
  try {
    const { error } = await getClient().from('transcripts').insert({
      meeting_id: meetingId,
      full_text: transcript.full_text,
      speakers: transcript.speakers,
      word_count: transcript.word_count,
    });

    if (error) throw new Error(error.message);

    // Persist duration on the parent meeting row at the same time
    await getClient()
      .from('meetings')
      .update({ duration_seconds: transcript.duration_seconds })
      .eq('id', meetingId);

    logger.info('Saved transcript', { meetingId, wordCount: transcript.word_count });
  } catch (error) {
    throw new Error(
      `saveTranscript failed for "${meetingId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function saveMeetingResults(
  meetingId: string,
  result: ClaudeProcessingResult
): Promise<ActionItem[]> {
  try {
    const supabase = getClient();

    const { error: summaryError } = await supabase.from('meeting_summaries').insert({
      meeting_id: meetingId,
      summary: result.summary,
      key_decisions: result.key_decisions,
      follow_up_email: result.follow_up_email,
    });

    if (summaryError) throw new Error(`Summary insert: ${summaryError.message}`);

    const actionItemRows = result.action_items.map((item) => ({
      meeting_id: meetingId,
      title: item.title,
      description: item.description,
      assignee: item.assignee,
      due_date: item.due_date,
      priority: item.priority,
      status: 'pending' as const,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('action_items')
      .insert(actionItemRows)
      .select();

    if (itemsError) throw new Error(`Action items insert: ${itemsError.message}`);

    logger.info('Saved meeting results', {
      meetingId,
      actionItemCount: insertedItems?.length ?? 0,
    });

    return (insertedItems ?? []) as ActionItem[];
  } catch (error) {
    throw new Error(
      `saveMeetingResults failed for "${meetingId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getMeetingById(meetingId: string): Promise<{ meeting: { id: string; user_id: string; recall_bot_id: string | null; platform: string | null; title: string | null; started_at: string | null; created_at: string } }> {
  try {
    const { data, error } = await getClient()
      .from('meetings')
      .select('id, user_id, recall_bot_id, platform, title, started_at, created_at')
      .eq('id', meetingId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Meeting "${meetingId}" not found`);

    return { meeting: data };
  } catch (error) {
    throw new Error(
      `getMeetingById failed for "${meetingId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getProfileByUserId(userId: string): Promise<Profile> {
  try {
    const { data, error } = await getClient()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Profile for user "${userId}" not found`);

    return data as Profile;
  } catch (error) {
    throw new Error(
      `getProfileByUserId failed for "${userId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getMeetingByBotId(
  botId: string
): Promise<{ id: string; user_id: string } | null> {
  try {
    const { data, error } = await getClient()
      .from('meetings')
      .select('id, user_id')
      .eq('recall_bot_id', botId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ?? null;
  } catch (error) {
    throw new Error(
      `getMeetingByBotId failed for bot "${botId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function updateActionItemTicket(
  actionItemId: string,
  ticketId: string,
  ticketUrl: string
): Promise<void> {
  try {
    const { error } = await getClient()
      .from('action_items')
      .update({
        jira_ticket_id: ticketId,
        jira_ticket_url: ticketUrl,
        status: 'ticket_created',
      })
      .eq('id', actionItemId);

    if (error) throw new Error(error.message);
  } catch (error) {
    throw new Error(
      `updateActionItemTicket failed for "${actionItemId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function markActionItemFailed(actionItemId: string): Promise<void> {
  try {
    const { error } = await getClient()
      .from('action_items')
      .update({ status: 'failed' })
      .eq('id', actionItemId);

    if (error) throw new Error(error.message);
  } catch (error) {
    throw new Error(
      `markActionItemFailed failed for "${actionItemId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createScheduledMeeting(
  userId: string,
  recallBotId: string,
  platform: 'zoom' | 'google_meet',
  title: string,
  scheduledStart: string
): Promise<void> {
  try {
    const { error } = await getClient().from('meetings').insert({
      user_id: userId,
      recall_bot_id: recallBotId,
      platform,
      title,
      started_at: scheduledStart,
      status: 'scheduled',
    });

    if (error) throw new Error(error.message);
    logger.info('Created scheduled meeting', { userId, recallBotId, platform });
  } catch (error) {
    throw new Error(
      `createScheduledMeeting failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
