/**
 * Role-based accent theming. Shifts the app's accent + gradient by active role:
 * customers lean violet (brand — "post & manage"), helpers lean green
 * ("earn & find"), admins use slate for the moderation console. Threaded
 * through Button, HeroCard, ScoreRing, the tab bar, etc. so switching roles
 * re-tints the whole interface.
 */

import { Role } from '@/types/domain';
import { colors, gradients } from './colors';

export interface RoleTheme {
  accent: string;
  accentSoft: string; // tinted background for chips/icon wells
  onAccent: string;
  gradient: readonly [string, string]; // CTAs / hero / brand moments
}

const THEMES: Record<Role, RoleTheme> = {
  customer: {
    accent: colors.primaryContainer, // brand violet — "post & manage"
    accentSoft: colors.brandSoft,
    onAccent: colors.onPrimary,
    gradient: gradients.brand, // violet
  },
  helper: {
    accent: colors.tertiaryContainer, // green — "earn & find"
    accentSoft: colors.successSoft,
    onAccent: colors.onTertiary,
    gradient: gradients.leaf, // green
  },
  admin: {
    accent: '#1e293b', // slate-800
    accentSoft: '#e2e8f0',
    onAccent: '#ffffff',
    gradient: ['#334155', '#1e293b'] as const, // slate
  },
};

export function getRoleTheme(role: Role): RoleTheme {
  return THEMES[role];
}
