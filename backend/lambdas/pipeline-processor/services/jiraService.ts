import { ActionItem, Profile, JiraIssueResponse } from '../../../shared/types';
import { logger } from '../../../shared/logger';

const TICKET_CREATE_DELAY_MS = 500;

interface JiraCreateIssueBody {
  fields: {
    project: { key: string };
    summary: string;
    description: {
      type: 'doc';
      version: 1;
      content: Array<{
        type: 'paragraph';
        content: Array<{ type: 'text'; text: string }>;
      }>;
    };
    issuetype: { name: string };
    priority: { name: string };
    assignee?: { name: string };
    duedate?: string;
  };
}

function mapPriority(priority: ActionItem['priority']): string {
  const map: Record<NonNullable<ActionItem['priority']>, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return priority ? map[priority] : 'Medium';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createTicket(
  actionItem: ActionItem,
  profile: Profile,
  jiraProjectKey: string
): Promise<{ ticketId: string; ticketUrl: string }> {
  try {
    if (!profile.jira_domain || !profile.jira_email || !profile.jira_api_token) {
      throw new Error('Jira credentials are not configured on the user profile');
    }

    const apiBase = `https://${profile.jira_domain}/rest/api/3`;
    const credentials = Buffer.from(`${profile.jira_email}:${profile.jira_api_token}`).toString('base64');

    const body: JiraCreateIssueBody = {
      fields: {
        project: { key: jiraProjectKey },
        summary: actionItem.title.slice(0, 255),
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: actionItem.description ?? actionItem.title }],
            },
          ],
        },
        issuetype: { name: 'Task' },
        priority: { name: mapPriority(actionItem.priority) },
        ...(actionItem.assignee ? { assignee: { name: actionItem.assignee } } : {}),
        ...(actionItem.due_date ? { duedate: actionItem.due_date } : {}),
      },
    };

    const response = await fetch(`${apiBase}/issue`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Jira API returned ${response.status}: ${await response.text()}`);
    }

    const issue = (await response.json()) as JiraIssueResponse;
    const ticketUrl = `https://${profile.jira_domain}/browse/${issue.key}`;

    logger.info('Created Jira ticket', { ticketId: issue.key, actionItemId: actionItem.id });
    return { ticketId: issue.key, ticketUrl };
  } catch (error) {
    throw new Error(
      `createTicket failed for action item "${actionItem.id}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createTicketsBatch(
  items: ActionItem[],
  profile: Profile,
  jiraProjectKey: string
): Promise<Array<{ id: string; ticketId: string; ticketUrl: string } | { id: string; error: string }>> {
  const results: Array<{ id: string; ticketId: string; ticketUrl: string } | { id: string; error: string }> = [];

  for (const item of items) {
    try {
      const { ticketId, ticketUrl } = await createTicket(item, profile, jiraProjectKey);
      results.push({ id: item.id, ticketId, ticketUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create Jira ticket', { actionItemId: item.id, error: message });
      results.push({ id: item.id, error: message });
    }

    // Respect Jira's rate limit — 500 ms between each creation
    await sleep(TICKET_CREATE_DELAY_MS);
  }

  return results;
}
