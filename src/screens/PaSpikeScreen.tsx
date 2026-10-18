/**
 * pa-spike dev screen (THROWAWAY, `__DEV__` only). Schedule a local
 * notification with Accept (test) / Ignore background actions, then lock the
 * phone and/or kill the app before it fires. See docs/reports/pa-spike-build.md.
 * Dev-only literal strings are deliberate; this screen never ships.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import notifee from 'react-native-notify-kit';
import ScreenContainer from '../components/ScreenContainer';
import { copyTextToClipboard } from '../utils/shareLink';
import { colors, radius, spacing, typography } from '../theme/tokens';
import {
  SPIKE_STATES,
  clearSpikeLog,
  formatLine,
  getSpikeLog,
  handleSpikeEvent,
  scheduleSpikeNotification,
} from '../devspike/paSpike';
import type { SpikeLine, SpikeState } from '../devspike/paSpike';

export default function PaSpikeScreen(): React.JSX.Element {
  const [seconds, setSeconds] = useState('30');
  const [state, setState] = useState<SpikeState>('locked');
  const [authVariant, setAuthVariant] = useState(false);
  const [lines, setLines] = useState<SpikeLine[]>([]);
  const [status, setStatus] = useState('');

  const reload = useCallback(async () => {
    setLines(await getSpikeLog());
  }, []);

  useEffect(() => {
    reload();
    // Foreground presses (app open) go through the same handler.
    const unsubscribe = notifee.onForegroundEvent(async event => {
      if (await handleSpikeEvent(event)) {
        reload();
      }
    });
    return unsubscribe;
  }, [reload]);

  const schedule = async (): Promise<void> => {
    const n = Math.max(5, Number(seconds) || 30);
    try {
      const attempt = await scheduleSpikeNotification(n, state, authVariant ? 'auth' : 'plain');
      setStatus(`Scheduled in ${n}s: ${state} ${authVariant ? 'auth' : 'plain'} attempt #${attempt}`);
    } catch {
      setStatus('Schedule failed');
    }
  };

  const copy = (): void => {
    copyTextToClipboard(lines.map(formatLine).join('\n'));
    setStatus('Copied');
  };

  const clear = async (): Promise<void> => {
    await clearSpikeLog();
    await reload();
    setStatus('Cleared');
  };

  return (
    <ScreenContainer edges="both">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>PA spike (dev only)</Text>

        <Text style={styles.label}>Seconds until it fires</Text>
        <TextInput
          style={styles.input}
          value={seconds}
          onChangeText={setSeconds}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>State you will put the phone in</Text>
        <View style={styles.row}>
          {SPIKE_STATES.map(s => (
            <Pressable
              key={s}
              onPress={() => setState(s)}
              style={[styles.chip, state === s && styles.chipOn]}
            >
              <Text style={[styles.chipText, state === s && styles.chipTextOn]}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>iOS: Accept requires authentication</Text>
          <Switch value={authVariant} onValueChange={setAuthVariant} />
        </View>

        <Pressable style={styles.button} onPress={schedule}>
          <Text style={styles.buttonText}>{`Schedule test notification in ${seconds || '30'} seconds`}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <View style={styles.rowBetween}>
          <Text style={styles.label}>{`Results (${lines.length})`}</Text>
          <Pressable onPress={reload}>
            <Text style={styles.link}>Refresh</Text>
          </Pressable>
        </View>
        {lines.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {formatLine(l)}
          </Text>
        ))}

        <Pressable style={styles.button} onPress={copy}>
          <Text style={styles.buttonText}>Copy results</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={clear}>
          <Text style={styles.buttonSecondaryText}>Clear results and attempt counters</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  title: { ...typography.h2, color: colors.textPrimary },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.body, color: colors.textPrimary },
  chipTextOn: { color: colors.white },
  button: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  buttonText: { ...typography.button, color: colors.white },
  buttonSecondary: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  buttonSecondaryText: { ...typography.body, color: colors.textPrimary },
  status: { ...typography.caption, color: colors.textSecondary },
  link: { ...typography.body, color: colors.primary },
  logLine: { ...typography.caption, color: colors.textPrimary },
});
