/**
 * Auth error translation.
 *
 * These messages are the whole of what a user who can't get in actually sees,
 * so each one is pinned: a raw Supabase string leaking through ("AuthApiError:
 * Invalid login credentials") is a real, if quiet, product failure.
 */

import { friendlyError } from '@/services/auth';

describe('friendlyError', () => {
  it('explains a wrong email/password without naming which was wrong', () => {
    const msg = friendlyError('Invalid login credentials');
    expect(msg).toMatch(/email and password/i);
    // Saying which half was wrong tells an attacker whether an account exists.
    expect(msg).not.toMatch(/password is|no such user|not found/i);
  });

  it('points an unconfirmed user at their inbox', () => {
    expect(friendlyError('Email not confirmed')).toMatch(/inbox|confirm/i);
  });

  it('sends an existing account to log in instead', () => {
    expect(friendlyError('User already registered')).toMatch(/logging in|log in/i);
  });

  it('distinguishes an expired code from a wrong one', () => {
    expect(friendlyError('Token has expired')).toMatch(/expired/i);
    expect(friendlyError('Invalid OTP')).toMatch(/isn’t right|check it/i);
  });

  it('names phone sign-in as unavailable rather than broken', () => {
    expect(friendlyError('Unsupported phone provider')).toMatch(/email instead/i);
  });

  it('treats connectivity failures as retryable', () => {
    expect(friendlyError('Network request failed')).toMatch(/connection/i);
  });

  it('passes through anything it does not recognize', () => {
    expect(friendlyError('Some brand new failure')).toBe('Some brand new failure');
  });
});
