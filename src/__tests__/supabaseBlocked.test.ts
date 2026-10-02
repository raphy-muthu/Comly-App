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
});
