/**
 * Registration screen (DES-MEETUP-MOBILE.md §4.2; R-012).
 *
 * Password/confirm-password live only in this component's local state
 * for the duration of the active input session (R-111, P10).
 * Confirm-password is a client-side match check only — never sent to
 * the API.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { colors, spacing, typography } from '../theme/tokens';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const { registerWithEmail } = useAuth();

  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (): Promise<void> => {
    setError(null);

    if (!nickname || !email || !password || !confirmPassword) {
      setError('Fill in every field.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWithEmail(email, password, nickname);
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextField
        style={styles.input}
        placeholder="Nickname"
        autoCapitalize="none"
        value={nickname}
        onChangeText={setNickname}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!isSubmitting}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Register"
        onPress={handleRegister}
        loading={isSubmitting}
        style={styles.button}
      />

      <TextLink
        label="Already have an account? Sign In"
        onPress={() => navigation.navigate('Login')}
        disabled={isSubmitting}
        style={styles.link}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: { marginBottom: spacing.md },
  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center' },
});
