/**
 * EquipmentBadge — shows whether equipment is provided for a job. Surfaced on
 * job cards, detail, and the apply screen so helpers know before applying.
 */

import { Chip } from '@/components/ui/Chip';
import { EquipmentStatus, EQUIPMENT_LABELS } from '@/types/domain';

export interface EquipmentBadgeProps {
  status: EquipmentStatus;
}

const ICONS: Record<EquipmentStatus, string> = {
  yes: 'construct-outline',
  no: 'briefcase-outline',
  some: 'build-outline',
  not_needed: 'checkmark-circle-outline',
};

export function EquipmentBadge({ status }: EquipmentBadgeProps) {
  return (
    <Chip
      label={EQUIPMENT_LABELS[status]}
      tone="neutral"
      icon={ICONS[status] as any}
    />
  );
}
