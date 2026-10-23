/**
 * Objectionable-text check — the app's copy of the database filter (0035).
 *
 * The database is what enforces it: a trigger refuses offensive text in job
 * posts, applications, reviews and profiles, whatever the client does. This
 * copy exists for the one place that trigger can't explain itself: sign-up,
 * where the profile row is created inside Supabase Auth's own transaction and
 * any error reaches the app only as "Database error saving new user". The
 * form checks first so the person sees what to fix.
 *
 * OBJECTIONABLE_PATTERNS must match objectionable_patterns() in the
 * migration exactly; contentFilter.test.ts compares the two.
 */

export const OBJECTIONABLE_PATTERNS: readonly string[] = [
  // strong profanity
  'f+u+c+k+(s|ed|er|ers|ing|in|face|head|wit)?',
  'm+o+t+h+e+r+f+u+c+k+(er|ers|ing|in)?',
  'f+c+k+',
  'f+u+k+',
  'sh+i+t+(s|ty|ting|ter|head|hole|bag)?',
  'b+i+t+c+h+(es|y|ing)?',
  'c+u+n+t+s?',
  'a+s+s+h+o+l+e+s?',
  'd+i+c+k+h+e+a+d+s?',
  'b+a+s+t+a+r+d+s?',
  'c+o+c+k+s+u+c+k+e+r+s?',
  'tw+a+t+s?',
  'w+a+n+k+e+r+s?',
  'j+a+c+k+a+s+s+(es)?',
  'd+u+m+b+a+s+s+(es)?',
  'd+o+u+c+h+e+(bag|bags|s)?',
  'w+h+o+r+e+s?',
  's+l+u+t+s?',
  // slurs
  'n+i+g+g+(a|ah|as|az|er|ers|uh)',
  'f+a+g+(s|got|gots|gy)?',
  'r+e+t+a+r+d+(s|ed)?',
  'k+i+k+e+s?',
  'c+h+i+n+k+s?',
  'w+e+t+b+a+c+k+s?',
  'g+o+o+k+s?',
  'tr+a+n+n+(y|ies)',
  'b+e+a+n+e+r+s?',
  'r+a+g+h+e+a+d+s?',
  't+o+w+e+l+h+e+a+d+s?',
  // explicit sexual content
  'p+o+r+n+(o|s|hub)?',
  'n+u+d+e+s',
  'b+l+o+w+j+o+b+s?',
  'h+a+n+d+j+o+b+s?',
  'b+o+o+b+s',
  't+i+t+s',
  'd+i+l+d+o+s?',
  'o+n+l+y+f+a+n+s',
  'h+o+r+n+y',
  's+e+x+t+(s|ing)?',
  // self-harm taunts
  'k+i+l+l+ +y+o+u+r+ *s+e+l+f+',
  'k+y+s',
];

/** Same message the database raises, so both paths read the same. */
export const OBJECTIONABLE_TEXT_MESSAGE = 'Please remove offensive language and try again.';

// Mirrors translate(lower(text), '@4$5!1|03', 'aassiiioe') in SQL.
const SWAPS: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  $: 's',
  '5': 's',
  '!': 'i',
  '1': 'i',
  '|': 'i',
  '0': 'o',
  '3': 'e',
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[@4$5!1|03]/g, (c) => SWAPS[c]);
}

// Postgres \y and JavaScript \b are both word boundaries between [A-Za-z0-9_]
// and anything else, which is all these ASCII patterns need.
const MATCHER = new RegExp(`\\b(${OBJECTIONABLE_PATTERNS.join('|')})\\b`);

export function containsObjectionableText(text: string | null | undefined): boolean {
  if (!text) return false;
  return MATCHER.test(normalize(text));
}
