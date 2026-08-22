/**
 * Authenticated stack — the main tabs plus the modal/detail screens that sit
 * above them.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppStackParamList } from './types';
import { MainTabs } from './MainTabs';
import { JobDetailScreen } from '@/screens/jobs/JobDetailScreen';
import { JobApplicationsScreen } from '@/screens/jobs/JobApplicationsScreen';
import { ApplyToJobScreen } from '@/screens/jobs/ApplyToJobScreen';
import { CreateJobScreen } from '@/screens/jobs/CreateJobScreen';
import { EditJobScreen } from '@/screens/jobs/EditJobScreen';
import { LeaveReviewScreen } from '@/screens/jobs/LeaveReviewScreen';
import { ReportNoShowScreen } from '@/screens/jobs/ReportNoShowScreen';
import { MyListingsScreen } from '@/screens/customer/MyListingsScreen';
import { MyApplicationsScreen } from '@/screens/helper/MyApplicationsScreen';
import { HelperProfileScreen } from '@/screens/shared/HelperProfileScreen';
import { ReportScreen } from '@/screens/shared/ReportScreen';
import { SafetyCenterScreen } from '@/screens/shared/SafetyCenterScreen';
import { HelpSupportScreen } from '@/screens/shared/HelpSupportScreen';
import { EditProfileScreen } from '@/screens/shared/EditProfileScreen';
import { ImpactScreen } from '@/screens/shared/ImpactScreen';
import { AboutScreen } from '@/screens/shared/AboutScreen';
import { AdminScreen } from '@/screens/admin/AdminScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="JobApplications" component={JobApplicationsScreen} />
      <Stack.Screen
        name="ApplyToJob"
        component={ApplyToJobScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="CreateJob"
        component={CreateJobScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditJob"
        component={EditJobScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="LeaveReview"
        component={LeaveReviewScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ReportNoShow"
        component={ReportNoShowScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="MyListings" component={MyListingsScreen} />
      <Stack.Screen name="MyApplications" component={MyApplicationsScreen} />
      <Stack.Screen name="HelperProfile" component={HelperProfileScreen} />
      <Stack.Screen
        name="Report"
        component={ReportScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="SafetyCenter" component={SafetyCenterScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Impact" component={ImpactScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
    </Stack.Navigator>
  );
}
