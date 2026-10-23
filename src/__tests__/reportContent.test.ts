/**
 * The text a report carries when it's about one review or application
 * message: the reporter's words, then the flagged item quoted with its id.
 */

import { MAX_QUOTE_LENGTH, reportDescription } from '@/lib/reportContent';

describe('reportDescription', () => {
  it("is just the reporter's words for a person or listing report", () => {
    expect(reportDescription('  Rude in person  ')).toBe('Rude in person');
  });

  it('quotes the flagged review with its id', () => {
    expect(
      reportDescription('This is harassment', { kind: 'review', id: 'r_1', text: 'You are useless' })
    ).toBe('This is harassment\n\nReported review (r_1): “You are useless”');
  });

  it('labels application messages and flattens line breaks', () => {
    expect(
      reportDescription('Creepy', { kind: 'application', id: 'a_9', text: 'line one\n\nline two' })
    ).toBe('Creepy\n\nReported application message (a_9): “line one line two”');
  });

  it('caps very long quotes', () => {
    const out = reportDescription('Spam', { kind: 'review', id: 'r_2', text: 'x'.repeat(5000) });
    expect(out).toContain(`“${'x'.repeat(MAX_QUOTE_LENGTH)}…”`);
  });

  it('still records an empty review', () => {
    expect(reportDescription('Fake', { kind: 'review', id: 'r_3', text: '' })).toContain('“(no text)”');
  });
});
