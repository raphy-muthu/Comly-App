/**
 * Edit Profile — persists changes through the backend (mock or Supabase) and
 * syncs the auth store. Profile photo uses expo-image-picker; in real mode the
 * picked image is uploaded to the Supabase Storage `avatars` bucket (see
 * migration 0012) and the public URL is stored, not the local device path.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import {
  Avatar,
  Button,
  Chip,
  IconButton,
  Input,
  Text,
  useToast,
} from '@/components/ui';
import { useUpdateProfile } from '@/hooks';
import { useAuthStore } from '@/stores/authStore';
import { hasSupabaseConfig } from '@/config/env';
import { getSupabase } from '@/services/supabaseClient';
import { JobCategory, JOB_CATEGORIES } from '@/types/domain';
import { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const CATEGORY_KEYS = Object.keys(JOB_CATEGORIES) as JobCategory[];

export function EditProfileScreen() {
  const role = useRoleTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [schoolEmail, setSchoolEmail] = useState(user?.schoolEmail ?? '');
  const [contactMethod, setContactMethod] = useState(
    user?.preferredContactMethod ?? 'text'
  );
  const [preferred, setPreferred] = useState<Set<JobCategory>>(
    new Set(user?.preferredCategories ?? [])
  );

  if (!user) return null;

  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Photo library access is needed to set a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];

      // Mock mode has no Storage to upload to — the local URI is fine for
      // pure UI testing, same as before.
      if (!hasSupabaseConfig) {
        setAvatarUrl(asset.uri);
        return;
      }

      setUploadingPhoto(true);
      try {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const ext = mimeType.split('/')[1] ?? 'jpg';
        // One fixed filename per user (not one per upload) so re-uploading a
        // photo overwrites the old object instead of accumulating orphaned
        // files nothing ever deletes.
        const path = `${user.id}/avatar.${ext}`;

        // React Native's fetch() resolves file:// URIs and its Response
        // implements arrayBuffer(), so this needs no extra file-system
        // dependency to get the picked image's bytes.
        const bytes = await fetch(asset.uri).then((r) => r.arrayBuffer());

        const { error: uploadError } = await getSupabase()
          .storage.from('avatars')
          .upload(path, bytes, { contentType: mimeType, upsert: true });
        if (uploadError) throw uploadError;

        const { data } = getSupabase().storage.from('avatars').getPublicUrl(path);
        // Cache-bust: the path is stable per user, so without this a second
        // upload keeps the same URL and RN's image cache keeps showing the
        // old photo.
        setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      } finally {
        setUploadingPhoto(false);
      }
    } catch (err) {
      console.warn('[Comly] Avatar upload failed:', err);
      toast.error('Could not upload that photo. Please try again.');
    }
  };

  const togglePreferred = (c: JobCategory) =>
    setPreferred((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  const save = () => {
    updateProfile.mutate(
      {
        name: name.trim(),
        avatarUrl,
        phoneNumber: phone.trim() || undefined,
        neighborhood: neighborhood.trim(),
        bio: bio.trim() || undefined,
        schoolEmail: schoolEmail.trim() || undefined,
        preferredContactMethod: contactMethod,
        preferredCategories: Array.from(preferred),
        verification: {
          ...user.verification,
          photoAdded: !!avatarUrl,
          phoneAdded: !!phone.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success('Profile saved.');
          navigation.goBack();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Could not save.'),
      }
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
        <Text variant="headlineMd">Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo */}
        <Pressable
          style={styles.photoWrap}
          onPress={pickPhoto}
          disabled={uploadingPhoto}
        >
          <Avatar uri={avatarUrl} name={name} size={96} />
          <View style={[styles.photoBadge, { backgroundColor: role.accent }]}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={role.onAccent} />
            ) : (
              <Ionicons name="camera" size={14} color={role.onAccent} />
            )}
          </View>
          <Text variant="labelMd" color="textLink" style={styles.photoLabel}>
            {uploadingPhoto
              ? 'Uploading…'
              : avatarUrl
                ? 'Change photo'
                : 'Add a profile photo'}
          </Text>
          <Text variant="caption" color="outline" center>
            A real photo helps neighbors know who they're meeting.
          </Text>
        </Pressable>

        <Input label="Name" value={name} onChangeText={setName} containerStyle={styles.field} />
        <Input
          label="Neighborhood"
          value={neighborhood}
          onChangeText={setNeighborhood}
          icon="location-outline"
          containerStyle={styles.field}
        />
        <Input
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon="call-outline"
          hint="Only shared after a job is accepted."
          containerStyle={styles.field}
        />

        <Text variant="labelMd" color="textSecondary" style={styles.label}>
          PREFERRED CONTACT
        </Text>
        <View style={styles.chips}>
          {(['text', 'phone', 'email'] as const).map((m) => (
            <Chip
              key={m}
              label={m === 'text' ? 'Text' : m === 'phone' ? 'Call' : 'Email'}
              selected={contactMethod === m}
              onPress={() => setContactMethod(m)}
              style={styles.chip}
            />
          ))}
        </View>

        <Input
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          style={styles.multiline}
          optional
          containerStyle={styles.field}
        />

        {user.ageGroup === 'teen' && (
          <Input
            label="School email"
            value={schoolEmail}
            onChangeText={setSchoolEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            icon="school-outline"
            hint="Optional — earns the School Email badge."
            optional
            containerStyle={styles.field}
          />
        )}

        <Text variant="labelMd" color="textSecondary" style={styles.label}>
          PREFERRED CATEGORIES
        </Text>
        <View style={styles.chips}>
          {CATEGORY_KEYS.filter((c) => c !== 'other').map((c) => (
            <Chip
              key={c}
              label={JOB_CATEGORIES[c].label}
              selected={preferred.has(c)}
              onPress={() => togglePreferred(c)}
              style={styles.chip}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Save Profile"
          onPress={save}
          disabled={name.trim().length < 2}
          loading={updateProfile.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.base,
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  photoWrap: { alignItems: 'center', marginBottom: spacing.md },
  photoBadge: {
    position: 'absolute',
    top: 68,
    right: '50%',
    marginRight: -48,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  photoLabel: { marginTop: spacing.sm, marginBottom: 2 },
  field: { marginBottom: spacing.md },
  multiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  label: { marginBottom: spacing.base },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: { marginRight: spacing.base, marginBottom: spacing.base },
  footer: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.card,
  },
});
