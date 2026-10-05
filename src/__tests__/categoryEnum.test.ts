/**
 * The app's category list and the Postgres job_category enum must match.
 *
 * They drifted once already: 0001 created the enum with 8 values while the app
 * grew to 17, and every job in the other 9 categories failed to insert against
 * the real database. Mock mode never touches Postgres enums, so nothing else
 * would catch that. This test reads the migrations directly.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { JOB_CATEGORIES } from '@/types/domain';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

function jobCategoryEnumValues(): Set<string> {
  const values = new Set<string>();
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const created = sql.match(/create type job_category as enum \(([^)]*)\)/i);
    if (created) {
      for (const m of created[1].matchAll(/'([a-z_]+)'/g)) values.add(m[1]);
    }
    for (const m of sql.matchAll(/alter type job_category add value if not exists '([a-z_]+)'/gi)) {
      values.add(m[1]);
    }
  }
  return values;
}

describe('job_category enum', () => {
  it('has a database value for every category the app can post', () => {
    const inDb = jobCategoryEnumValues();
    const missing = Object.keys(JOB_CATEGORIES).filter((c) => !inDb.has(c));
    expect(missing).toEqual([]);
  });
});
