/**
 * The keyword safety floor. It runs in three places — the client's final tier,
 * the mock backend, and the database trigger that actually enforces it — so
 * these tests pin both its behavior and that the SQL copy can't drift.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { keywordTier, SAFETY_KEYWORDS } from '@/lib/safetyKeywords';
import { stricterTier } from '@/types/domain';

describe('keywordTier — word boundaries (regressions)', () => {
  it('does not read "tomorrow" as mowing', () => {
    expect(keywordTier('Walk my dog tomorrow afternoon').tier).toBe('teen_safe');
  });

  it('does not read "begun" as a gun', () => {
    expect(keywordTier('I have begun packing, need help with boxes').tier).toBe('teen_safe');
  });

  it('does not read "price" or "office" as ice', () => {
    expect(keywordTier('Fair price for tidying my home office').tier).toBe('teen_safe');
  });

  it('does not read "driveway" as driving', () => {
    expect(keywordTier('Sweep the driveway').tier).toBe('teen_safe');
  });
});

describe('keywordTier — the rules still fire', () => {
  it.each([
    ['Cut branches with my chainsaw', 'blocked'],
    ['Replace roofing tiles', 'blocked'],
    ['Clean the gutters, bring a ladder', 'eighteen_plus_only'],
    ['Deliveries around town', 'eighteen_plus_only'],
    ['Mowing the front lawn', 'sixteen_plus_only'],
    ['Needs a weed whacker', 'sixteen_plus_only'],
    ['Clear out the basement', 'adult_supervision'],
    ['Shovel snow', 'caution'],
    ['Help me carry groceries', 'caution'],
    ['Algebra homework help', 'teen_safe'],
  ])('%s → %s', (text, tier) => {
    expect(keywordTier(text).tier).toBe(tier);
  });

  it('the most severe match wins', () => {
    expect(keywordTier('Mow the lawn, then fix the roof').tier).toBe('blocked');
  });

  it('reports which term matched', () => {
    expect(keywordTier('Bring a ladder').term?.toLowerCase()).toBe('ladder');
  });
});

describe('stricterTier', () => {
  it('returns whichever tier is more restrictive', () => {
    expect(stricterTier('teen_safe', 'sixteen_plus_only')).toBe('sixteen_plus_only');
    expect(stricterTier('blocked', 'caution')).toBe('blocked');
    expect(stricterTier('caution', 'caution')).toBe('caution');
  });
});

describe('SQL parity', () => {
  it('the database trigger uses exactly the same keyword patterns', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '0027_safety_keyword_floor.sql'),
      'utf8'
    );
    const inSql = [...sql.matchAll(/\('([a-z_]+)'::safety_tier, '([^']+)'\)/g)].map(
      ([, tier, pattern]) => `${tier}:${pattern}`
    );
    const inTs = SAFETY_KEYWORDS.flatMap(({ tier, patterns }) =>
      patterns.map((p) => `${tier}:${p}`)
    );
    expect(inSql.sort()).toEqual(inTs.sort());
  });
});
