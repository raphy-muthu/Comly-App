/**
 * The guardian-approval email interpolates the helper's display name — text
 * the user controls — into HTML. Unescaped, a name like
 * `<a href="https://evil.example">Tap to approve</a>` becomes a working
 * phishing link inside a genuine Comly email.
 */

import { escapeHtml } from '../../supabase/functions/_shared/html';

describe('escapeHtml', () => {
  it('neutralizes markup in a display name', () => {
    expect(escapeHtml('<a href="https://evil.example">Approve</a>')).toBe(
      '&lt;a href=&quot;https://evil.example&quot;&gt;Approve&lt;/a&gt;'
    );
  });

  it('escapes ampersands first so entities are not double-decoded', () => {
    expect(escapeHtml('Tom & Jerry &lt;3')).toBe('Tom &amp; Jerry &amp;lt;3');
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('leaves ordinary names alone', () => {
    expect(escapeHtml('Jordan Lee')).toBe('Jordan Lee');
  });
});
