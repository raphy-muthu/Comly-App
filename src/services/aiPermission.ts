/**
 * Whether the signed-in person has allowed AI processing (guideline 5.1.2(i)).
 *
 * The real AI service checks this before every network call and uses its
 * on-device fallback otherwise, so no screen can send text to Gemini by
 * forgetting to ask. It starts false and is only set true once the account's
 * saved answer (ai_consents, 0035) has loaded as "yes" — see useAiConsent.
 * The edge functions check the same answer server-side.
 */

let permitted = false;

export function setAiPermitted(value: boolean): void {
  permitted = value;
}

export function aiPermitted(): boolean {
  return permitted;
}
