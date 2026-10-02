/**
 * Signing in with any address other than a persona must return to the
 * default account. It used to keep whoever signed in last, so after using the
 * teen persona, every later mock sign-in was still the teen.
 */

import { currentMockUser, signInAsMockPersona } from '@/services/mockBackend';

describe('signInAsMockPersona', () => {
  it('switches to the teen persona', () => {
    signInAsMockPersona('teen@example.com');
    expect(currentMockUser().id).toBe('u_jordan');
  });

  it('returns to the default account for any other address', () => {
    signInAsMockPersona('teen@example.com');
    signInAsMockPersona('sarah@example.com');
    expect(currentMockUser().id).toBe('u_sarah');
  });
});
