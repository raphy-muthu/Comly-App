/**
 * Reporting a specific review or application message.
 *
 * App Store guideline 1.2 requires a way to flag objectionable content, and
 * reviews and application messages are content other people wrote. The
 * reports table (0003) ties a report to a user and a job, not to one review
 * or message, so the flagged item is quoted into the description, with its
 * id. That's exactly what a moderator reads in the admin console, and it
 * needs no schema change. Reports are deliberately exempt from the
 * offensive-language filter (0035), so the quote is never refused.
 */

export type ReportedContent = {
  kind: 'review' | 'application';
  id: string;
  text: string;
};

export const REPORTED_CONTENT_LABEL: Record<ReportedContent['kind'], string> = {
  review: 'review',
  application: 'application message',
};

/** Long enough for any real review; keeps a pasted essay from swamping the queue. */
export const MAX_QUOTE_LENGTH = 600;

export function quoteForReport(text: string): string {
  const flat = text.trim().replace(/\s+/g, ' ');
  return flat.length > MAX_QUOTE_LENGTH ? `${flat.slice(0, MAX_QUOTE_LENGTH)}…` : flat;
}

/** The report description: what the reporter wrote, then the item they flagged. */
export function reportDescription(userText: string, content?: ReportedContent): string {
  const own = userText.trim();
  if (!content) return own;
  const quoted = quoteForReport(content.text) || '(no text)';
  return `${own}\n\nReported ${REPORTED_CONTENT_LABEL[content.kind]} (${content.id}): “${quoted}”`;
}
