/**
 * The objectionable-text filter: what it catches, what it must let through,
 * and that the app's pattern list is the database's list (0035) exactly.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  OBJECTIONABLE_PATTERNS,
  containsObjectionableText,
} from '@/lib/contentFilter';

describe('containsObjectionableText', () => {
  it.each([
    'This is fucking ridiculous',
    'What a piece of SHIT',
    'f u c k'.replace(/ /g, ''),
    'fuuuuck this',
    'sh1t',
    'you @sshole',
    'stupid b!tch',
    'kill yourself',
    'kys',
    'send nudes',
    'that retard',
  ])('catches %p', (text) => {
    expect(containsObjectionableText(text)).toBe(true);
  });

  it.each([
    'Need help moving a couch and some boxes',
    'Shiitake mushrooms from the farmers market',
    'Spray the fire retardant on the shed',
    'Help with my Scunthorpe United scrapbook',
    'Tutoring for a summa cum laude hopeful',
    'Pick up a package at Dick’s Sporting Goods',
    'Assist with assembling a cocktail table',
    'Mow the lawn and trim the hedges by 3pm',
    'Watch my cat, she is very sweet',
    'Wash the 2 cars, $35 total',
    'Grandma needs help with her new iPhone',
    '',
  ])('lets through %p', (text) => {
    expect(containsObjectionableText(text)).toBe(false);
  });

  it('ignores missing text', () => {
    expect(containsObjectionableText(null)).toBe(false);
    expect(containsObjectionableText(undefined)).toBe(false);
  });
});

describe('pattern list matches the database', () => {
  it('is identical to objectionable_patterns() in migration 0035', () => {
    const sql = readFileSync(
      join(__dirname, '../../supabase/migrations/0035_ai_consent_and_content_filter.sql'),
      'utf8'
    );
    const body = sql.match(/function objectionable_patterns\(\)[\s\S]*?select array\[([\s\S]*?)\]\s*\$\$/);
    expect(body).not.toBeNull();
    const sqlPatterns = [...body![1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]);
    expect(sqlPatterns).toEqual([...OBJECTIONABLE_PATTERNS]);
  });
});
