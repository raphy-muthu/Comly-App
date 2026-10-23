/**
 * Blocking has to work against the real backend, not only in mock mode.
 * supabaseBackend's feed and recommended-helpers queries never excluded
 * blocked users, so blocking someone changed nothing in production.
 *
 * A small fake Supabase client stands in for the network: it evaluates the
 * eq / neq / is / not-in filters the backend builds, so these tests check the
 * rows that come back, not just which methods were called.
 */

type Row = Record<string, any>;
const mockTables: Record<string, Row[]> = {};

function mockQuery(table: string) {
  let rows = [...(mockTables[table] ?? [])];
  const builder: any = {
    select: () => builder,
    order: () => builder,
    limit: (n: number) => ((rows = rows.slice(0, n)), builder),
    contains: (col: string, vals: any[]) =>
      ((rows = rows.filter((r) => vals.every((v) => (r[col] ?? []).includes(v)))), builder),
    eq: (col: string, v: any) => ((rows = rows.filter((r) => r[col] === v)), builder),
    neq: (col: string, v: any) => ((rows = rows.filter((r) => r[col] !== v)), builder),
    is: (col: string, v: any) => ((rows = rows.filter((r) => (r[col] ?? null) === v)), builder),
    not: (col: string, op: string, list: string) => {
      if (op !== 'in') throw new Error(`fake only supports not-in, got ${op}`);
      const ids = list.replace(/^\(|\)$/g, '').split(',');
      rows = rows.filter((r) => !ids.includes(r[col]));
      return builder;
    },
    // Only the shape listReviews* builds: "reviewer_id.is.null,reviewer_id.not.in.(a,b)".
    or: (expr: string) => {
      const m = expr.match(/^(\w+)\.is\.null,\1\.not\.in\.\((.*)\)$/);
      if (!m) throw new Error(`fake doesn't support or(${expr})`);
      const ids = m[2].split(',');
      rows = rows.filter((r) => r[m[1]] == null || !ids.includes(r[m[1]]));
      return builder;
    },
    insert: (row: Row) => {
      const list = (mockTables[table] ??= []);
      const dup =
        table === 'blocked_users' &&
        list.some((r) => r.user_id === row.user_id && r.blocked_user_id === row.blocked_user_id);
      if (!dup) list.push(row);
      const error = dup ? { code: '23505', message: 'duplicate key' } : null;
      return Promise.resolve({ data: null, error });
    },
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };
  return builder;
}

jest.mock('@/services/supabaseClient', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    from: (table: string) => mockQuery(table),
  }),
}));

import { supabaseBackend } from '@/services/supabaseBackend';

const job = (id: string, customerId: string): Row => ({
  id,
  customer_id: customerId,
  status: 'open',
  deleted_at: null,
  title: id,
  category: 'errands',
  pay: 10,
  pay_type: 'fixed',
  safety_tier: 'teen_safe',
  created_at: '2026-09-01T00:00:00Z',
});

const helper = (id: string, score: number): Row => ({
  id,
  name: id,
  roles: ['helper'],
  reputation_score: score,
  verification_status: {},
});

beforeEach(() => {
  mockTables.jobs = [job('j_ok', 'u_neighbor'), job('j_blocked', 'u_blocked'), job('j_mine', 'me')];
  mockTables.profiles = [helper('u_neighbor', 50), helper('u_blocked', 90), helper('me', 70)];
  mockTables.blocked_users = [{ user_id: 'me', blocked_user_id: 'u_blocked' }];
  mockTables.reports = [];
  mockTables.applications = [
    { id: 'a_ok', job_id: 'j_mine', helper_id: 'u_neighbor', created_at: '2026-09-02T00:00:00Z' },
    { id: 'a_blocked', job_id: 'j_mine', helper_id: 'u_blocked', created_at: '2026-09-02T00:00:00Z' },
  ];
  mockTables.reviews = [
    { id: 'r_ok', reviewee_id: 'u_neighbor', reviewer_id: 'u_other', job_id: 'j_x', ratings: {} },
    { id: 'r_blocked', reviewee_id: 'u_neighbor', reviewer_id: 'u_blocked', job_id: 'j_x', ratings: {} },
    { id: 'r_anon', reviewee_id: 'u_neighbor', reviewer_id: null, job_id: 'j_x', ratings: {} },
  ];
});

describe('blocked users against the real backend', () => {
  it('drops jobs from customers I blocked out of my feed', async () => {
    const ids = (await supabaseBackend.listFeedJobs()).map((j) => j.id);
    expect(ids).toEqual(['j_ok']);
  });

  it('drops helpers I blocked, and myself, from recommendations', async () => {
    const ids = (await supabaseBackend.listRecommendedHelpers()).map((u) => u.id);
    expect(ids).toEqual(['u_neighbor']);
  });

  it('still works when I have blocked nobody', async () => {
    mockTables.blocked_users = [];
    expect((await supabaseBackend.listFeedJobs()).map((j) => j.id).sort()).toEqual([
      'j_blocked',
      'j_ok',
    ]);
  });

  it('drops applicants I blocked from my job', async () => {
    const ids = (await supabaseBackend.listApplicationsForJob('j_mine')).map((a) => a.id);
    expect(ids).toEqual(['a_ok']);
  });

  it("hides reviews written by people I blocked, but keeps reviews with no reviewer", async () => {
    const ids = (await supabaseBackend.listReviewsForUser('u_neighbor')).map((r) => r.id).sort();
    expect(ids).toEqual(['r_anon', 'r_ok']);
  });
});

describe('blocking someone (App Store guideline 1.2)', () => {
  it('records the block and files a report for moderators', async () => {
    await supabaseBackend.blockUser('u_neighbor', { jobId: 'j_ok' });
    expect(mockTables.blocked_users).toContainEqual({ user_id: 'me', blocked_user_id: 'u_neighbor' });
    expect(mockTables.reports).toEqual([
      expect.objectContaining({
        reporter_id: 'me',
        reported_user_id: 'u_neighbor',
        job_id: 'j_ok',
        category: 'other',
        status: 'open',
      }),
    ]);
    // ...and their listing leaves my feed.
    expect((await supabaseBackend.listFeedJobs()).map((j) => j.id)).toEqual([]);
  });

  it('treats blocking someone already blocked as success and still reports', async () => {
    await expect(supabaseBackend.blockUser('u_blocked')).resolves.toBeUndefined();
    expect(mockTables.reports).toHaveLength(1);
  });
});
