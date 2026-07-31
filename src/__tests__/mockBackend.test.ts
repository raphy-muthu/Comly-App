/**
 * Mock backend business rules — the accept/decline lifecycle, contact unlock
 * authorization, listing limits, and duplicate-application guard. These mirror
 * the server-side rules enforced by migration 0004 in production.
 *
 * Note: the backend is intentionally stateful per session, so these tests run
 * as one ordered sequence.
 */

import { mockBackend } from '@/services/mockBackend';
import { LimitError } from '@/services/types';

describe('mock backend marketplace loop', () => {
  it('keeps contact locked until an acceptance happens', async () => {
    // Seeded as status=accepted but with no contactUnlockedAt: still locked.
    expect(await mockBackend.getJobContact('j_grocery_sarah')).toBeNull();
  });

  it('lets the owner decline an application', async () => {
    await mockBackend.declineApplication('j_snow_sarah', 'app_3');
    const apps = await mockBackend.listApplicationsForJob('j_snow_sarah');
    expect(apps.find((a) => a.id === 'app_3')?.status).toBe('declined');
  });

  it('accepts atomically: winner accepted, rest not selected, contact unlocked', async () => {
    await mockBackend.acceptApplication('j_snow_sarah', 'app_2');

    const job = await mockBackend.getJob('j_snow_sarah');
    expect(job?.status).toBe('accepted');
    expect(job?.assignedHelperId).toBe('u_diego');
    expect(job?.contactUnlockedAt).toBeTruthy();

    const apps = await mockBackend.listApplicationsForJob('j_snow_sarah');
    expect(apps.find((a) => a.id === 'app_2')?.status).toBe('accepted');
    expect(apps.find((a) => a.id === 'app_1')?.status).toBe('not_selected');
  });

  it('reveals the accepted helper contact to the owner after acceptance', async () => {
    const contact = await mockBackend.getJobContact('j_snow_sarah');
    expect(contact?.name).toBe('Diego Ramirez');
    expect(contact?.phoneNumber).toBe('(610) 555-0188');
  });

  it('refuses to accept twice', async () => {
    await expect(
      mockBackend.acceptApplication('j_snow_sarah', 'app_1')
    ).rejects.toThrow(/outcome/i);
  });

  it('blocks duplicate applications to the same job', async () => {
    await mockBackend.applyToJob({ jobId: 'j_shovel_walkway', message: 'Hi!' });
    await expect(
      mockBackend.applyToJob({ jobId: 'j_shovel_walkway', message: 'Hi again!' })
    ).rejects.toThrow(/already applied/i);
  });

  it('enforces the 3-active-listing limit', async () => {
    const base = {
      category: 'errands' as const,
      description: 'test',
      pay: 10,
      payType: 'fixed' as const,
      neighborhood: 'Bryn Mawr',
      scheduledFor: 'Flexible',
      isTimeFlexible: true,
      estimatedDuration: '1 hour',
      safetyTier: 'teen_safe' as const,
      requiresAdultSupervision: false,
      equipmentStatus: 'not_needed' as const,
      communityTags: [],
    };
    // Session user already has 2 active listings — one more is allowed…
    await mockBackend.createJob({ ...base, title: 'Third active listing' });
    // …and the fourth must be rejected.
    await expect(
      mockBackend.createJob({ ...base, title: 'Fourth active listing' })
    ).rejects.toThrow(LimitError);
  });
});
