/**
 * Model-supplied pay validation.
 *
 * These cases are not hypothetical. The un-validated version computed the
 * midpoint directly from the model's JSON, and because models routinely emit
 * numbers as strings, `"40" + "65"` concatenated to `"4065"` — turning a $52
 * suggestion into $2033. Nothing threw, so the surrounding try/catch fallback
 * never engaged and the bad figure went straight into the pay field.
 */

import { asPay } from '@/services/ai';

describe('asPay', () => {
  it('accepts plain numbers', () => {
    expect(asPay(40)).toBe(40);
    expect(asPay(52.4)).toBe(52);
  });

  it('accepts numeric strings, which models emit constantly', () => {
    expect(asPay('40')).toBe(40);
    expect(asPay('$45')).toBe(45);
    expect(asPay('60 USD')).toBe(60);
  });

  it('rejects missing or non-numeric values instead of yielding NaN', () => {
    expect(asPay(undefined)).toBeNull();
    expect(asPay(null)).toBeNull();
    expect(asPay('a lot')).toBeNull();
    expect(asPay({})).toBeNull();
    expect(asPay(NaN)).toBeNull();
    expect(asPay(Infinity)).toBeNull();
  });

  it('rejects values outside a plausible odd-job range', () => {
    expect(asPay(0)).toBeNull();
    expect(asPay(-20)).toBeNull();
    // The concatenation artifact that motivated this guard.
    expect(asPay(2033)).toBeNull();
  });

  it('prevents the string-concatenation midpoint bug end to end', () => {
    const min = asPay('40');
    const max = asPay('65');
    expect(min).not.toBeNull();
    expect(max).not.toBeNull();
    // Post-coercion these are real numbers, so the midpoint is arithmetic —
    // not "40" + "65" = "4065".
    expect(Math.round((min! + max!) / 2)).toBe(53);
  });
});
