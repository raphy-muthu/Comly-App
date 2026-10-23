/**
 * BlockUserButton — "Block" with a confirmation, for another user's profile
 * or listing. Blocking hides their jobs, applications and reviews from you
 * right away, stops job invites both ways (0015/0028), and files a report so
 * Comly's moderators review them (App Store guideline 1.2). Unblocking lives
 * in the Safety Center.
 */

import { Alert, ViewStyle } from 'react-native';

import { Button, useToast } from '@/components/ui';
import { useBlockUser } from '@/hooks';

interface Props {
  userId: string;
  /** Shown in the confirmation; falls back to "this user". */
  name?: string;
  /** The listing the block came from, attached to the moderators' report. */
  jobId?: string;
  /** Runs after a successful block, e.g. to leave the blocked person's screen. */
  onBlocked?: () => void;
  style?: ViewStyle;
}

export function BlockUserButton({ userId, name, jobId, onBlocked, style }: Props) {
  const block = useBlockUser();
  const toast = useToast();
  const who = name?.trim() || 'this user';

  const confirm = () =>
    Alert.alert(
      `Block ${who}?`,
      "You won't see their jobs, applications or reviews, and neither of you can invite the other to a job. Comly's team will also be notified to review their account. You can unblock them in the Safety Center.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            block.mutate(
              { userId, jobId },
              {
                onSuccess: () => {
                  toast.success(`${name?.trim() || 'User'} blocked. Our team has been notified.`);
                  onBlocked?.();
                },
                onError: () => toast.error('Could not block this user. Please try again.'),
              }
            ),
        },
      ]
    );

  return (
    <Button
      title={`Block ${name?.trim() ? name.trim().split(' ')[0] : 'user'}`}
      variant="ghost"
      size="sm"
      icon="ban-outline"
      onPress={confirm}
      loading={block.isPending}
      style={style}
    />
  );
}
