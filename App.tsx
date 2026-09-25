/**
 * Meetup Mobile
 *
 * @format
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthContext';
import ForceUpdateGate from './src/components/ForceUpdateGate';
import { LabelsProvider } from './src/labels/LabelsContext';
import RootNavigator from './src/navigation/RootNavigator';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {/* Outside ForceUpdateGate/AuthProvider: GET /api/labels is
          unauthenticated (§4.9) and independent of session/update-gate
          state, so the fetch starts at true cold start regardless of
          either. */}
      <LabelsProvider>
        <ForceUpdateGate>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ForceUpdateGate>
      </LabelsProvider>
    </SafeAreaProvider>
  );
}

export default App;
