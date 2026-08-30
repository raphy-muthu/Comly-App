/**
 * Hours/time-of-day advisory for 14-15-year-old helpers.
 *
 * FLSA restricts this bracket to 7am-7pm (7am-9pm during summer, June 1
 * through Labor Day), capped at 3 hours on a school day and 8 otherwise.
 * The app has no school-calendar data for any helper, so "school day" is
 * approximated as any non-summer weekday — a deliberate simplification, not
 * a claim about anyone's actual schedule. sixteen_seventeen has no federal
 * hour restriction at all (only the hazard-tier rule elsewhere applies), so
 * this only ever returns guidance for fourteen_fifteen.
 *
 * Advisory only: nothing here blocks a post or an application. Comly is a
 * matchmaking app with no hour-tracking or payment processing of its own —
 * hard-enforcing hours would be a step toward the kind of control that
 * weakens that posture, the same reasoning behind the no-show strikes system
 * staying admin-confirmed rather than automatic.
 */

import { AgeBracket } from '@/types/domain';

export interface HoursGuidance {
  outsideWindow: boolean;
  windowNote?: string;
  overDurationCap: boolean;
  durationNote?: string;
}

/** First Monday of September for the given year. */
function laborDay(year: number): Date {
  const sept1 = new Date(year, 8, 1);
  const offsetToMonday = (8 - sept1.getDay()) % 7;
  return new Date(year, 8, 1 + offsetToMonday);
}

function calendarDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** FLSA's summer window for 14-15-year-olds: June 1 through Labor Day, inclusive. */
export function isSummer(date: Date): boolean {
  const day = calendarDay(date);
  const juneFirst = new Date(date.getFullYear(), 5, 1);
  const labor = calendarDay(laborDay(date.getFullYear()));
  return day >= juneFirst && day <= labor;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function hoursGuidanceFor(
  ageBracket: AgeBracket,
  scheduledFor: Date,
  durationMinutes: number | undefined
): HoursGuidance | null {
  if (ageBracket !== 'fourteen_fifteen') return null;

  const summer = isSummer(scheduledFor);
  const windowEndHour = summer ? 21 : 19;
  const startHour = scheduledFor.getHours() + scheduledFor.getMinutes() / 60;
  const endHour = durationMinutes != null ? startHour + durationMinutes / 60 : startHour;

  const outsideWindow = startHour < 7 || endHour > windowEndHour;

  let overDurationCap = false;
  let durationNote: string | undefined;
  if (durationMinutes != null) {
    const capMinutes = summer || !isWeekday(scheduledFor) ? 8 * 60 : 3 * 60;
    overDurationCap = durationMinutes > capMinutes;
    if (overDurationCap) {
      durationNote =
        capMinutes === 3 * 60
          ? 'Longer than the typical 3-hour limit for helpers under 16 on a school day (Mon–Fri, non-summer).'
          : 'Longer than the typical 8-hour limit for helpers under 16.';
    }
  }

  return {
    outsideWindow,
    windowNote: outsideWindow
      ? `Outside typical hours for helpers under 16 (7am–${summer ? '9pm in summer' : '7pm'}).`
      : undefined,
    overDurationCap,
    durationNote,
  };
}
