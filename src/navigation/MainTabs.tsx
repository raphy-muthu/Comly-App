/**
 * Bottom tab navigator — Home, Jobs, Post, Alerts, Profile.
 *
 * Home and Jobs are role-aware (customer vs helper) via wrapper screens. The
 * center "Post" tab doesn't render a screen; pressing it opens the CreateJob
 * modal on the parent stack.
 */

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { colors, typography } from '@/theme';
import { useRoleTheme } from '@/hooks/useRoleTheme';
import { MainTabsParamList, AppStackParamList } from './types';
import { HomeScreen } from '@/screens/HomeScreen';
import { JobsScreen } from '@/screens/JobsScreen';
import { AlertsScreen } from '@/screens/shared/AlertsScreen';
import { ProfileScreen } from '@/screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Placeholder element; the Post tab is intercepted before it renders.
function Noop() {
  return <View />;
}

const ICONS: Record<
  keyof MainTabsParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Jobs: { active: 'briefcase', inactive: 'briefcase-outline' },
  Post: { active: 'add-circle', inactive: 'add-circle-outline' },
  Alerts: { active: 'notifications', inactive: 'notifications-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function MainTabs() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const roleTheme = useRoleTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: roleTheme.accent,
        tabBarInactiveTintColor: colors.outline,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.divider,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          marginBottom: 6,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const set = ICONS[route.name];
          return (
            <Ionicons
              name={focused ? set.active : set.inactive}
              size={route.name === 'Post' ? 32 : size}
              color={route.name === 'Post' ? roleTheme.accent : color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen
        name="Post"
        component={Noop}
        options={{ tabBarLabel: 'Post' }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('CreateJob');
          },
        }}
      />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
