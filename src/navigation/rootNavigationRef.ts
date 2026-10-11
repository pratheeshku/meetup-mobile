/**
 * Ref for the navigator that hosts `Completion` — the signed-in root stack
 * (`Tabs` + `Completion`) or the Auth stack. Kept separate from
 * `navigationRef`, which stays on the tab navigator so Home / Groups /
 * Tournaments routing is unchanged.
 *
 * Completion payloads are not stored here. They live in memory in
 * `showCompletion.ts` and are never written to AsyncStorage.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export type CompletionHostParamList = {
  Tabs: undefined;
  Completion: undefined;
  Login: { successMessage?: string; email?: string } | undefined;
  Register: undefined;
  Verify: { email: string; explanation?: string };
  ForgotPassword: { email?: string } | undefined;
};

export const rootNavigationRef = createNavigationContainerRef<CompletionHostParamList>();
