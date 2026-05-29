// ─── Database row types ───────────────────────────────────────────────────────

export type MeetingStatus =
  | 'scheduled'
  | 'recording'
  | 'processing'
  | 'transcribing'
  | 'analysing'
  | 'complete'
  | 'failed';

export type Platform = 'zoom' | 'google_meet';

export type ActionItemStatus = 'pending' | 'ticket_created' | 'failed';

export type ActionItemPriority = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  jira_domain: string | null;
  jira_email: string | null;
  jira_api_token: string | null;
  google_calendar_token: GoogleCalendarToken | null;
  follow_up_recipients: string[] | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  recall_bot_id: string | null;
  platform: Platform | null;
  title: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: MeetingStatus;
  error_message: string | null;
  created_at: string;
}

export interface TranscriptSpeakerSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptSpeaker {
  speaker: string;
  segments: TranscriptSpeakerSegment[];
}

export interface Transcript {
  id: string;
  meeting_id: string;
  full_text: string;
  speakers: TranscriptSpeaker[] | null;
  word_count: number | null;
  created_at: string;
}

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  summary: string;
  key_decisions: string[] | null;
  follow_up_email: string | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  due_date: string | null;
  priority: ActionItemPriority | null;
  jira_ticket_id: string | null;
  jira_ticket_url: string | null;
  status: ActionItemStatus;
  created_at: string;
}

// ─── Joined / view types used by the frontend ────────────────────────────────

export interface MeetingWithCounts extends Meeting {
  action_item_count: number;
}

export interface MeetingDetail extends Meeting {
  transcript: Transcript | null;
  summary: MeetingSummary | null;
  action_items: ActionItem[];
}

// ─── SQS / pipeline message payload ──────────────────────────────────────────

export interface ProcessingPipeline {
  meetingId: string;
  botId: string;
  userId: string;
  platform: Platform;
}

// ─── Whisper service response ─────────────────────────────────────────────────

export interface WhisperTranscript {
  full_text: string;
  speakers: TranscriptSpeaker[];
  word_count: number;
  duration_seconds: number;
}

// ─── Claude processing result (structured JSON the model returns) ─────────────

export interface ClaudeActionItem {
  title: string;
  description: string;
  assignee: string | null;
  due_date: string | null;
  priority: ActionItemPriority;
}

export interface ClaudeProcessingResult {
  summary: string;
  key_decisions: string[];
  action_items: ClaudeActionItem[];
  follow_up_email: string;
}

// ─── External API response types ─────────────────────────────────────────────

export interface RecallBotStatus {
  id: string;
  status: {
    code: string;
    message: string | null;
    sub_code: string | null;
    updated_at: string;
  };
  video_url: string | null;
  media_retention_end: string | null;
}

export interface RecallRecording {
  id: string;
  video_url: string;
  start_time: string;
  end_time: string | null;
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
}

export interface GoogleCalendarToken {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  hangoutLink?: string;
}

// ─── Recall.ai webhook payload ────────────────────────────────────────────────

export interface RecallWebhookEvent {
  event: string;
  data: {
    bot_id: string;
    status: {
      code: string;
      message: string | null;
    };
  };
}
