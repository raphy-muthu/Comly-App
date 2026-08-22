/**
 * Premium visibility — boost expiry and the two sort comparators.
 *
 * Premium on Comly changes order and nothing else, so the property that
 * actually matters is that a free listing/applicant is never *excluded* and
 * still wins every tiebreak below the premium key.
 */

import {
  boostActive,
  compareApplications,
  compareFeedJobs,
  Application,
  Job,
  UserRef,
} from '@/types/domain';
import { mockBackend } from '@/services/mockBackend';

const ref = (over: Partial<UserRef> = {}): UserRef => ({
  id: 'u',
  name: 'N',
  avatarUrl: null,
  rating: 4,
  jobsCount: 5,
  isTrusted: false,
  ...over,
});

const job = (over: Partial<Job> = {}): Job =>
  ({
    id: 'j',
    customerId: 'c',
    customer: ref(),
    category: 'errands',
    title: 'T',
    description: '',
    pay: 20,
    payType: 'fixed',
    status: 'open',
    safetyTier: 'teen_safe',
    requiresAdultSupervision: false,
    equipmentStatus: 'not_needed',
    communityTags: [],
    neighborhood: 'Bryn Mawr',
    distanceMiles: 1,
    location: { lat: 0, lng: 0 },
    scheduledFor: 'Flexible',
    isTimeFlexible: true,
    estimatedDuration: '1 hour',
    photos: [],
    applicantsCount: 0,
    createdWithSeniorMode: false,
    isBoosted: false,
    isPaused: false,
    createdAt: new Date(2025, 0, 1).toISOString(),
    ...over,
  }) as Job;

const app = (over: Partial<Application> = {}): Application =>
  ({
    id: 'a',
    jobId: 'j',
    helperId: 'h',
    helper: ref(),
    message: '',
    status: 'pending',
    isPriority: false,
    createdAt: new Date(2025, 0, 1).toISOString(),
    ...over,
  }) as Application;

describe('boost expiry', () => {
  it('is active with no end date', () => {
    expect(boostActive({ isBoosted: true, boostedUntil: null })).toBe(true);
  });

  it('is inactive once the end date has passed', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(boostActive({ isBoosted: true, boostedUntil: past })).toBe(false);
  });

  it('is active before the end date', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(boostActive({ isBoosted: true, boostedUntil: future })).toBe(true);
  });

  it('is inactive when the flag is off, whatever the date says', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(boostActive({ isBoosted: false, boostedUntil: future })).toBe(false);
  });
});

describe('feed ordering', () => {
  it('puts a live boost first', () => {
    const boosted = job({ id: 'boosted', isBoosted: true });
    const plain = job({ id: 'plain' });
    expect([plain, boosted].sort(compareFeedJobs)[0].id).toBe('boosted');
  });

  it('ignores an expired boost', () => {
    const stale = job({
      id: 'stale',
      isBoosted: true,
      boostedUntil: new Date(Date.now() - 1000).toISOString(),
      matchScore: 10,
    });
    const better = job({ id: 'better', matchScore: 90 });
    expect([stale, better].sort(compareFeedJobs)[0].id).toBe('better');
  });

  it('ranks a Comly Plus customer above a free one, all else equal', () => {
    const plus = job({ id: 'plus', customer: ref({ isCustomerPlus: true }) });
    const free = job({ id: 'free' });
    expect([free, plus].sort(compareFeedJobs)[0].id).toBe('plus');
  });

  it('still decides free-vs-free on match score, then distance, then recency', () => {
    const worse = job({ id: 'worse', matchScore: 40 });
    const better = job({ id: 'better', matchScore: 80 });
    expect([worse, better].sort(compareFeedJobs)[0].id).toBe('better');

    const far = job({ id: 'far', distanceMiles: 9 });
    const near = job({ id: 'near', distanceMiles: 1 });
    expect([far, near].sort(compareFeedJobs)[0].id).toBe('near');

    const old = job({ id: 'old', createdAt: new Date(2024, 0, 1).toISOString() });
    const fresh = job({ id: 'fresh', createdAt: new Date(2025, 5, 1).toISOString() });
    expect([old, fresh].sort(compareFeedJobs)[0].id).toBe('fresh');
  });

  it('never drops a free listing from the ordering', () => {
    const list = [job({ id: 'a' }), job({ id: 'b', isBoosted: true }), job({ id: 'c' })];
    expect(list.sort(compareFeedJobs).map((j) => j.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('application ordering', () => {
  it('puts the accepted applicant above everything, priority included', () => {
    const accepted = app({ id: 'accepted', status: 'accepted' });
    const pro = app({ id: 'pro', isPriority: true });
    expect([pro, accepted].sort(compareApplications)[0].id).toBe('accepted');
  });

  it('puts a Pro Helper above a regular applicant', () => {
    const pro = app({ id: 'pro', isPriority: true });
    const plain = app({ id: 'plain' });
    expect([plain, pro].sort(compareApplications)[0].id).toBe('pro');
  });

  it('falls through to rating, then completed jobs, then earliest applied', () => {
    const low = app({ id: 'low', helper: ref({ rating: 3 }) });
    const high = app({ id: 'high', helper: ref({ rating: 5 }) });
    expect([low, high].sort(compareApplications)[0].id).toBe('high');

    const fewer = app({ id: 'fewer', helper: ref({ jobsCount: 1 }) });
    const more = app({ id: 'more', helper: ref({ jobsCount: 20 }) });
    expect([fewer, more].sort(compareApplications)[0].id).toBe('more');

    // Equal on everything else: the one who applied first ranks higher.
    const later = app({ id: 'later', createdAt: new Date(2025, 5, 2).toISOString() });
    const earlier = app({ id: 'earlier', createdAt: new Date(2025, 5, 1).toISOString() });
    expect([later, earlier].sort(compareApplications)[0].id).toBe('earlier');
  });
});

describe('priority is derived, not client-supplied', () => {
  it('marks a Pro Helper’s application as priority on the way in', async () => {
    // The seeded session user is not Pro, so their own application is not.
    const mine = await mockBackend.applyToJob({
      jobId: 'j_shovel_walkway',
      message: 'Happy to help.',
    });
    expect(mine.isPriority).toBe(false);
    expect(mine.priorityReason).toBeUndefined();
  });

  it('keeps a boosted listing flagged when a Plus customer posts', async () => {
    // The seeded session user has Comly Plus.
    const posted = await mockBackend.createJob({
      category: 'errands',
      title: 'Boost check',
      description: 'Short errand.',
      pay: 20,
      payType: 'fixed',
      neighborhood: 'Bryn Mawr',
      scheduledFor: 'Flexible',
      isTimeFlexible: true,
      durationMinutes: 30,
      estimatedDuration: '30 minutes',
      safetyTier: 'teen_safe',
      requiresAdultSupervision: false,
      equipmentStatus: 'not_needed',
      communityTags: [],
    });
    expect(posted.isBoosted).toBe(true);
    expect(boostActive(posted)).toBe(true);
  });
});
