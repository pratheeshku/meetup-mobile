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
import RootNavigator from './src/navigation/RootNavigator';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ForceUpdateGate>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ForceUpdateGate>
    </SafeAreaProvider>
  );
}

export default App;
