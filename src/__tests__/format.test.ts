/**
 * Display formatters.
 */

import {
  formatDistance,
  formatPay,
  formatPayShort,
  timeAgo,
} from '@/lib/format';

describe('pay formatting', () => {
  it('formats fixed and hourly pay', () => {
    expect(formatPay(35, 'fixed')).toBe('$35 fixed');
    expect(formatPay(25, 'hourly')).toBe('$25/hr');
    expect(formatPayShort(35, 'fixed')).toBe('$35');
    expect(formatPayShort(25, 'hourly')).toBe('$25/hr');
  });
});

describe('distance formatting', () => {
  it('renders one decimal place with unit', () => {
    expect(formatDistance(0.6)).toBe('0.6 mi');
    expect(formatDistance(2)).toBe('2.0 mi');
  });
});

describe('timeAgo', () => {
  const minutes = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

  it('covers the relative ladder', () => {
    expect(timeAgo(minutes(0))).toBe('Just now');
    expect(timeAgo(minutes(5))).toBe('5m ago');
    expect(timeAgo(minutes(120))).toBe('2h ago');
    expect(timeAgo(minutes(60 * 24))).toBe('Yesterday');
    expect(timeAgo(minutes(60 * 24 * 3))).toBe('3d ago');
  });
});
