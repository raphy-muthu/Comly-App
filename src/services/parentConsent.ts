/**
 * Guardian consent — asking a parent to approve a minor helper.
 *
 * The teen names a guardian's email; the guardian gets a one-time link and
 * approves without ever creating an account. This module only *requests* that
 * email. The approval itself happens server-side when the guardian follows the
 * link, so nothing here can grant approval — by design, and enforced by the
 * database (see migration 0019: parent_approved is a pinned column, writable
 * only inside a SECURITY DEFINER routine).
 *
 * Resulting state is read from `UserProfile.parentApprovalStatus`, which the
 * server moves to 'pending' on request and 'approved' on approval — there is
 * no separate client-side status to keep in sync.
 */

import { USE_MOCKS, hasSupabaseConfig } from '@/config/env';
import { getSupabase } from './supabaseClient';

export interface RequestConsentResult {
  ok: boolean;
  /** Human-readable reason when ok is false — safe to show directly. */
  message?: string;
}

export interface ParentConsentService {
  requestApproval(parentEmail: string): Promise<RequestConsentResult>;
}

const delay = <T,>(value: T, ms = 500): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const mockConsent: ParentConsentService = {
  async requestApproval(parentEmail) {
    if (!parentEmail.trim()) {
      return delay({ ok: false, message: 'Enter your parent or guardian’s email.' });
    }
    // Demo mode has no mail server and no guardian to click anything. Say so
    // rather than reporting a send that never happened.
    return delay({
      ok: true,
      message: 'Demo mode: no email is actually sent, and approval stays pending.',
    });
  },
};

const realConsent: ParentConsentService = {
  async requestApproval(parentEmail) {
    try {
      const { data, error } = await getSupabase().functions.invoke('parent-consent', {
        body: { parentEmail: parentEmail.trim() },
      });

      // On a non-2xx, supabase-js sets `data` to null and hands back a
      // FunctionsHttpError whose message is generic. The reason the function
      // actually refused (cooldown, not a minor, email not configured) is in
      // the response body, which has to be read off the attached Response.
      if (error) {
        const detail = await readFunctionError(error);
        return { ok: false, message: detail ?? 'Could not send the approval request.' };
      }

      if ((data as { ok?: boolean })?.ok) return { ok: true };
      return {
        ok: false,
        message:
          (data as { error?: string })?.error ?? 'Could not send the approval request.',
      };
    } catch {
      return { ok: false, message: 'Could not reach the server. Check your connection.' };
    }
  },
};

/**
 * supabase-js wraps a non-2xx function response in a FunctionsHttpError whose
 * body has to be read off the attached Response to get the real message.
 */
async function readFunctionError(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response })?.context;
  if (!res || typeof res.json !== 'function') return null;
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

function resolveConsent(): ParentConsentService {
  if (USE_MOCKS) return mockConsent;
  if (!hasSupabaseConfig) return mockConsent;
  return realConsent;
}

export const parentConsent: ParentConsentService = resolveConsent();
