/**
 * Navigation param lists. Centralized so screens get typed route params and
 * navigation calls are checked.
 */

import { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Public (signed-out) flow: onboarding carousel + auth screens in one stack so
 * the Welcome screen can route straight to Login or Sign Up.
 */
export type PublicStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
  PhoneVerify: { phone?: string } | undefined;
};

export type MainTabsParamList = {
  Home: undefined;
  Jobs: undefined;
  Post: undefined; // intercepted → opens CreateJob modal
  Alerts: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  JobDetail: { jobId: string };
  JobApplications: { jobId: string };
  ApplyToJob: { jobId: string };
  CreateJob: { seniorMode?: boolean } | undefined;
  EditJob: { jobId: string };
  LeaveReview: { jobId: string };
  ReportNoShow: { jobId: string };
  MyListings: undefined;
  MyApplications: undefined;
  HelperProfile: { userId: string };
  Report: { reportedUserId?: string; jobId?: string };
  SafetyCenter: undefined;
  HelpSupport: undefined;
  EditProfile: undefined;
  Impact: undefined;
  About: undefined;
  Admin: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList {}
  }
}
