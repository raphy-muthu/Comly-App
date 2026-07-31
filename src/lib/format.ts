/**
 * Small display formatters shared across screens.
 */

import { Job, PayType } from '@/types/domain';

/** "$35 fixed" / "$25/hr" */
export function formatPay(pay: number, type: PayType): string {
  const amount = `$${pay}`;
  return type === 'hourly' ? `${amount}/hr` : `${amount} fixed`;
}

/** Short pay label without the qualifier: "$35" / "$25/hr" */
export function formatPayShort(pay: number, type: PayType): string {
  return type === 'hourly' ? `$${pay}/hr` : `$${pay}`;
}

/** "0.8 mi" / "2.4 mi" */
export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}

/** Relative time like "2h ago", "4h ago", "Yesterday". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** "Posted 2h ago" convenience for the feed. */
export function postedAgo(job: Pick<Job, 'createdAt'>): string {
  return `Posted ${timeAgo(job.createdAt)}`;
}
