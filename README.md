# Meeting Copilot

An AI-powered personal assistant that auto-joins your Zoom and Google Meet calls, transcribes them, and produces summaries, action items, Jira tickets, and a follow-up email — all visible in a live dashboard.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Google Calendar                                                       │
│  push notification ──► calendar-webhook Lambda                       │
│                              │                                        │
│                              ▼                                        │
│                    Recall.ai bot scheduled                            │
│                    Meeting row created (status: scheduled)            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Recall.ai webhook (bot.done)                                         │
│  ──► webhook-receiver Lambda                                          │
│          │  HMAC validated                                            │
│          ▼                                                            │
│       SQS FIFO queue  ──►  pipeline-processor Lambda                 │
│                                                                       │
│  Pipeline steps:                                                      │
│  1. Download audio from Recall → S3                                   │
│  2. AssemblyAI transcription (speaker diarisation, auto language)     │
│  3. Claude API → summary + action items + email draft                 │
│  4. Save everything to Supabase (triggers Realtime → frontend)        │
│  5. Create Jira tickets                                               │
│  6. Send follow-up email via Resend                                   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Next.js dashboard (Vercel or self-hosted)                            │
│  Supabase Realtime subscription → live status updates                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## One-time setup (follow in this exact order)

### 1. Prerequisites

- Node.js 20+
- AWS CLI configured (`aws configure`)
- AWS CDK CLI: `npm install -g aws-cdk`

### 2. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
3. In **Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
4. In **Authentication → Providers**, enable **Google** and paste your Google OAuth credentials (see step 4 below)

### 3. Google OAuth & Calendar

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `https://your-project-id.supabase.co/auth/v1/callback` as an authorised redirect URI
4. Enable the **Google Calendar API** in your project
5. Copy the Client ID and Secret into Supabase → Authentication → Google provider

### 4. Recall.ai

1. Sign up at [recall.ai](https://www.recall.ai) and grab your **API key**
2. In the Recall dashboard, create a webhook pointing to:
   `https://<api-gateway-url>/api/meeting-ended`
3. Set `bot.done` as the event type
4. Note the webhook secret Recall generates → `RECALL_WEBHOOK_SECRET`

### 5. AssemblyAI (transcription — free tier: 100 hours/month)

1. Sign up at [assemblyai.com](https://www.assemblyai.com)
2. Dashboard → API Keys → copy your key → `ASSEMBLYAI_API_KEY`

### 6. Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) → **API Keys**
2. Create a key → `ANTHROPIC_API_KEY`

### 7. Resend

1. Sign up at [resend.com](https://resend.com) and create an API key → `RESEND_API_KEY`
2. Verify your sending domain in Resend
3. Update the `from` address in `backend/lambdas/pipeline-processor/services/emailService.ts`

### 8. Jira

1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and create a token
2. Enter your Jira domain, email, and token in the app Settings page after you've deployed the frontend

### 9. Store secrets in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name meeting-copilot/secrets \
  --secret-string '{
    "RECALL_API_KEY": "...",
    "RECALL_WEBHOOK_SECRET": "...",
    "ANTHROPIC_API_KEY": "...",
    "ASSEMBLYAI_API_KEY": "...",
    "SUPABASE_URL": "...",
    "SUPABASE_SERVICE_ROLE_KEY": "...",
    "RESEND_API_KEY": "...",
    "GOOGLE_CALENDAR_WEBHOOK_TOKEN": "some-random-string"
  }'
```

### 10. Deploy AWS infrastructure

```bash
cd infrastructure
npm install
# Bootstrap CDK in your account (first time only)
cdk bootstrap
# Deploy all stacks (Storage + Api — no EC2 needed)
cdk deploy --all
```

After deploy, note the outputs:
- `MeetingCopilotStorage.ProcessingQueueUrl`
- `MeetingCopilotApi.ApiUrl`

### 11. Deploy the frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in the three Supabase values
npm install
npm run dev          # local development
# OR deploy to Vercel:
npx vercel --prod
```

Set the three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in your Vercel project settings.

### 12. Register Google Calendar webhook

After deploying the frontend and signing in, make a one-time call to register your calendar for push notifications:

```bash
curl -X POST https://www.googleapis.com/calendar/v3/calendars/primary/events/watch \
  -H "Authorization: Bearer <your-google-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "unique-channel-id",
    "type": "web_hook",
    "address": "https://<api-gateway-url>/api/calendar-webhook",
    "token": "<your-GOOGLE_CALENDAR_WEBHOOK_TOKEN>",
    "params": { "ttl": "2592000" }
  }'
```

---

## Running locally

```bash
# Frontend
cd frontend && npm install && npm run dev

# There is no local Lambda emulator included.
# Use the real AWS deployment for end-to-end testing,
# or mock the Recall webhook with curl:
curl -X POST https://<api-gateway-url>/api/meeting-ended \
  -H "Content-Type: application/json" \
  -H "x-recall-signature: sha256=<computed-hmac>" \
  -d '{"event":"bot.done","data":{"bot_id":"<your-bot-id>","status":{"code":"done","message":null}}}'
```

---

## Project structure

```
meeting-copilot/
├── frontend/           Next.js 14 dashboard
├── backend/
│   ├── lambdas/        Three Lambda functions (webhook-receiver, pipeline-processor, calendar-webhook)
│   └── shared/         Types, secrets helper, logger
├── infrastructure/     AWS CDK (TypeScript)
└── supabase/
    └── migrations/     Postgres schema + RLS policies
```
