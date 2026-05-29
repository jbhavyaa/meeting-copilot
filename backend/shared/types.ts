// Re-exports the canonical types so Lambda code imports from one place.
// Frontend and backend share the same domain model — keep these in sync with
// frontend/types/index.ts if you diverge the packages.

export type {
  Meeting,
  MeetingStatus,
  Platform,
  Profile,
  Transcript,
  TranscriptSpeaker,
  TranscriptSpeakerSegment,
  MeetingSummary,
  ActionItem,
  ActionItemPriority,
  ActionItemStatus,
  ProcessingPipeline,
  WhisperTranscript,
  ClaudeActionItem,
  ClaudeProcessingResult,
  RecallBotStatus,
  RecallRecording,
  JiraIssueResponse,
  GoogleCalendarEvent,
  RecallWebhookEvent,
} from '../../frontend/types/index';
