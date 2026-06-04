// Feature flags — set to true only when Google OAuth verification is approved
// Calendar auto-scheduling requires calendar.readonly and calendar.events scopes
// which need Google verification before public users can grant them
export const FEATURES = {
  CALENDAR_AUTO_SCHEDULE: false,
} as const;
