import {
  asksForModalities,
  CollaborationRequest,
  FIELD_LIMITS,
  GOAL_LABELS,
  inOrder,
  MODALITIES,
  MODALITY_LABELS,
  Role,
  ROLE_LABELS,
  ROLES,
} from './request';

/** Opening this URL lets a signed-in GitHub user review and post a pre-filled issue on MEDS-DEV. */
export const MEDS_DEV_NEW_ISSUE_URL = 'https://github.com/Medical-Event-Data-Standard/MEDS-DEV/issues/new';

/** GitHub rejects overly long URLs, so stay well below the roughly 8 KB its servers accept. */
export const MAX_ISSUE_URL_LENGTH = 6000;

/** Some mail clients, such as Outlook on Windows, cut off mailto: links at around 2,000 characters. */
export const MAX_MAILTO_URL_LENGTH = 1800;

const ELLIPSIS = '…';
// Follows the [Dataset]/[Task]/[Model] prefixes of the MEDS-DEV issue templates; "Other" adds nothing.
const TITLE_NAMES: Record<Role, string | null> = {
  dataset: 'Dataset',
  task: 'Task',
  model: 'Model',
  other: null,
};
// When a URL is too long, these fields are shortened in this order, each only as far as needed.
const SHORTENED_FIELDS = ['message', 'link', 'name'] as const;

/** Shortens `text` to at most `max` characters (code points), marking the cut with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + ELLIPSIS;
}

/** Collapses whitespace, including newlines, so pasted text stays on one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Trims the free-text fields and caps them at `FIELD_LIMITS`. */
function capped(request: CollaborationRequest): CollaborationRequest {
  return {
    ...request,
    name: truncate(oneLine(request.name), FIELD_LIMITS.name),
    link: truncate(oneLine(request.link), FIELD_LIMITS.link),
    message: truncate(request.message.trim(), FIELD_LIMITS.message),
  };
}

/** Joins words as "A", "A & B" or "A, B & C". */
function joinWithAnd(words: string[]): string {
  if (words.length <= 2) return words.join(' & ');
  return `${words.slice(0, -1).join(', ')} & ${words[words.length - 1]}`;
}

function buildTitle(request: CollaborationRequest, tag: string): string {
  const names = inOrder(ROLES, request.roles).flatMap(role => TITLE_NAMES[role] ?? []);
  const prefix = names.length > 0 ? `${joinWithAnd(names)}: ` : '';
  return `${tag} ${prefix}${capped(request).name}`;
}

/** For example "[Collaboration] Dataset & Model: MIMIC-IV", or "[Collaboration] MIMIC-IV" for "Other" alone. */
export function buildIssueTitle(request: CollaborationRequest): string {
  return buildTitle(request, '[Collaboration]');
}

/** The issue title with a tag that says where the email comes from, e.g. "[MEDS-DEV collaboration] Task: …". */
export function buildMailSubject(request: CollaborationRequest): string {
  return buildTitle(request, '[MEDS-DEV collaboration]');
}

/** The answers as [question, answer] pairs, in form order; the answer is null when left empty. */
function answers(request: CollaborationRequest): [string, string | null][] {
  const { name, link, message } = capped(request);
  // A list, because some labels contain commas.
  const modalities = inOrder(MODALITIES, request.modalities)
    .map(modality => `- ${MODALITY_LABELS[modality]}`)
    .join('\n');
  return [
    [
      'Roles',
      inOrder(ROLES, request.roles)
        .map(role => ROLE_LABELS[role])
        .join(', '),
    ],
    ['Name', name],
    ['Link', link || null],
    ['What I would like to do', GOAL_LABELS[request.goal]],
    // Only dataset and model owners are asked about the kinds of data, so others get no such section.
    ...(asksForModalities(request.roles)
      ? [['Kinds of data', modalities || null] as [string, string | null]]
      : []),
    ['Message', message || null],
  ];
}

/** Formats the answers like a GitHub issue form, so maintainers can read them at a glance. */
export function buildIssueBody(request: CollaborationRequest, sourceUrl?: string): string {
  const body = answers(request)
    .map(([question, answer]) => `### ${question}\n\n${answer ?? '_No response_'}`)
    .join('\n\n');
  return sourceUrl ? `${body}\n\n---\n\nSent with the [collaboration request form](${sourceUrl}).` : body;
}

/** The same answers as `buildIssueBody`, as plain text for an email, with \n line breaks. */
export function buildMailBody(request: CollaborationRequest, sourceUrl?: string): string {
  const body = answers(request)
    .map(([question, answer]) => `${question}:\n${answer ?? 'No response'}`)
    .join('\n\n');
  return sourceUrl ? `${body}\n\n---\nSent with the collaboration request form: ${sourceUrl}` : body;
}

/** The full email as text to paste into any mail app: address, subject and body, without length limits. */
export function buildEmailText(
  request: CollaborationRequest,
  { to, sourceUrl }: { to: string; sourceUrl?: string }
): string {
  return `To: ${to}\nSubject: ${buildMailSubject(request)}\n\n${buildMailBody(request, sourceUrl)}`;
}

/**
 * Returns `toUrl(request)` with the free-text fields capped at `FIELD_LIMITS`. If the URL is still longer
 * than `maxLength` (percent-encoding can make non-ASCII text up to 12 times longer), shortens the message,
 * then the link, then the name, each to the longest prefix that fits.
 */
function fitUrl(
  request: CollaborationRequest,
  toUrl: (request: CollaborationRequest) => string,
  maxLength: number
): string {
  let fitted = capped(request);
  for (const field of SHORTENED_FIELDS) {
    const chars = Array.from(fitted[field]);
    if (toUrl(fitted).length <= maxLength) break;
    if (chars.length === 0) continue;

    // Binary search for the longest prefix that fits; if none does, keep just the ellipsis and move on.
    const withPrefix = (length: number) => ({
      ...fitted,
      [field]: chars.slice(0, length).join('') + ELLIPSIS,
    });
    let [low, high] = [0, chars.length - 1];
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (toUrl(withPrefix(mid)).length <= maxLength) low = mid;
      else high = mid - 1;
    }
    fitted = withPrefix(low);
  }
  return toUrl(fitted);
}

/** Builds the URL of a new MEDS-DEV issue pre-filled with `request`, at most `maxLength` characters long. */
export function buildIssueUrl(
  request: CollaborationRequest,
  { sourceUrl, maxLength = MAX_ISSUE_URL_LENGTH }: { sourceUrl?: string; maxLength?: number } = {}
): string {
  return fitUrl(
    request,
    fitted =>
      `${MEDS_DEV_NEW_ISSUE_URL}?title=${encodeURIComponent(buildIssueTitle(fitted))}` +
      `&body=${encodeURIComponent(buildIssueBody(fitted, sourceUrl))}`,
    maxLength
  );
}

/**
 * Builds a mailto: URL that opens an email to `to` pre-filled with `request`, at most `maxLength` characters
 * long. Line breaks are CRLF, as RFC 6068 asks, and spaces are encoded as %20, never as +.
 */
export function buildMailtoUrl(
  request: CollaborationRequest,
  { to, sourceUrl, maxLength = MAX_MAILTO_URL_LENGTH }: { to: string; sourceUrl?: string; maxLength?: number }
): string {
  return fitUrl(
    request,
    fitted =>
      `mailto:${to}?subject=${encodeURIComponent(buildMailSubject(fitted))}` +
      `&body=${encodeURIComponent(buildMailBody(fitted, sourceUrl).replace(/\r\n|\r|\n/g, '\r\n'))}`,
    maxLength
  );
}
