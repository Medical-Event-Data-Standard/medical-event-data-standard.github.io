import { CollaborationRequest, FIELD_LIMITS, GOAL_LABELS, Role, ROLE_LABELS } from './request';

/** Opening this URL lets a signed-in GitHub user review and post a pre-filled issue on MEDS-DEV. */
export const MEDS_DEV_NEW_ISSUE_URL = 'https://github.com/Medical-Event-Data-Standard/MEDS-DEV/issues/new';

/** GitHub rejects overly long URLs, so stay well below the roughly 8 KB its servers accept. */
export const MAX_ISSUE_URL_LENGTH = 6000;

const ELLIPSIS = '…';
const NO_RESPONSE = '_No response_';
const TITLE_PREFIXES: Record<Role, string> = {
  dataset: 'Dataset: ',
  task: 'Task: ',
  model: 'Model: ',
  other: '',
};

/** Shortens `text` to at most `max` characters (code points), marking the cut with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + ELLIPSIS;
}

/** Collapses whitespace, including newlines, so pasted text stays on one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function buildIssueTitle(request: CollaborationRequest): string {
  return `[Collaboration] ${TITLE_PREFIXES[request.role]}${truncate(oneLine(request.name), FIELD_LIMITS.name)}`;
}

/** Formats the answers like a GitHub issue form, so maintainers can read them at a glance. */
export function buildIssueBody(request: CollaborationRequest, sourceUrl?: string): string {
  const link = truncate(oneLine(request.link), FIELD_LIMITS.link);
  const message = truncate(request.message.trim(), FIELD_LIMITS.message);
  const sections: [string, string][] = [
    ['Role', ROLE_LABELS[request.role]],
    ['Name', truncate(oneLine(request.name), FIELD_LIMITS.name)],
    ['Link', link || NO_RESPONSE],
    ['What I would like to do', GOAL_LABELS[request.goal]],
    ['Message', message || NO_RESPONSE],
  ];
  const body = sections.map(([heading, value]) => `### ${heading}\n\n${value}`).join('\n\n');
  return sourceUrl ? `${body}\n\n---\n\nSent with the [collaboration request form](${sourceUrl}).` : body;
}

/**
 * Builds the URL of a new MEDS-DEV issue pre-filled with `request`. Free-text fields are capped at
 * `FIELD_LIMITS`; if the encoded URL is still longer than `maxLength` (percent-encoding can make
 * non-ASCII text up to 12 times longer), the message is shortened further until it fits.
 */
export function buildIssueUrl(
  request: CollaborationRequest,
  { sourceUrl, maxLength = MAX_ISSUE_URL_LENGTH }: { sourceUrl?: string; maxLength?: number } = {}
): string {
  const title = encodeURIComponent(buildIssueTitle(request));
  const urlWith = (message: string) =>
    `${MEDS_DEV_NEW_ISSUE_URL}?title=${title}&body=${encodeURIComponent(
      buildIssueBody({ ...request, message }, sourceUrl)
    )}`;

  const message = truncate(request.message.trim(), FIELD_LIMITS.message);
  const url = urlWith(message);
  if (url.length <= maxLength || !message) return url;

  // Binary search for the longest message prefix that still fits.
  const chars = Array.from(message);
  let [low, high] = [0, chars.length - 1];
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (urlWith(chars.slice(0, mid).join('') + ELLIPSIS).length <= maxLength) low = mid;
    else high = mid - 1;
  }
  return urlWith(chars.slice(0, low).join('') + ELLIPSIS);
}
