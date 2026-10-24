/**
 * Media tab (boards TV2MobLiveMedia, TV2MobDoneMedia; web reference te-w2 `teMediaHtml`): the tournament's photos, add a
 * photo (camera or library), remove, an empty state and the server's "limit reached" refusal. No API exposes the size or
 * count limits and the video flag, so the app hard-codes none and shows the server's coded error; video upload is not
 * built (te-a2 scope). The board's filters (All, Photos, Videos, Mine) are not built: the list route returns only a total.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { deleteTournamentMedia, getTournamentMedia, uploadTournamentMedia } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { MediaItem } from '../../../../types/tournamentTabs';
import { toHttpsUrl } from '../../../../utils/httpsUrl';
import { isPickerCancelled, pickImage } from '../../../../utils/imagePicker';
import { mediaErrorKey, mediaErrorMessage } from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import { CameraIcon, TrashIcon } from '../../../icons/ActionIcons';
import { CardHead, EmptyLine, TabCard } from './parts';

const PAGE = 24;
const TILE_GAP = spacing.sm;
const ICON_BOX = 36;

export default function MediaTab({ tournamentId, canAdd }: { tournamentId: string; canAdd: boolean }): React.JSX.Element {
  const t = useT();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(
    async (offset: number): Promise<void> => {
      try {
        const page = await withCorrelationId(correlationId => getTournamentMedia(tournamentId, { limit: PAGE, offset }, { correlationId }));
        setItems(previous => (offset === 0 ? page.items : [...previous, ...page.items]));
        setTotal(page.total);
        setStatus('ready');
      } catch {
        setStatus(previous => (previous === 'ready' ? previous : 'error'));
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const pick = async (source: 'camera' | 'library'): Promise<void> => {
    try {
      const image = await pickImage(source, t('mob.tournament.media.title'), null);
      if (!image) {
        return;
      }
      setBusy(true);
      setMessage(null);
      await withCorrelationId(correlationId =>
        uploadTournamentMedia(tournamentId, { uri: image.path, name: image.filename, type: image.mime }, { correlationId }),
      );
      setMessage({ text: t('mob.tournament.media.added'), ok: true });
      await load(0);
    } catch (e) {
      if (isPickerCancelled(e)) {
        return;
      }
      const key = mediaErrorKey(e);
      setMessage({ text: key ? t(key) : mediaErrorMessage(e) ?? t('mob.tournament.media.err.failed'), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const choose = (): void => {
    Alert.alert(t('mob.tournament.media.add_photo'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.create_group.take_photo'), onPress: () => pick('camera') },
      { text: t('mob.create_group.choose_photo'), onPress: () => pick('library') },
    ]);
  };

  const remove = (item: MediaItem): void => {
    Alert.alert(t('mob.tournament.media.remove_confirm'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      {
        text: t('mob.tournament.media.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await withCorrelationId(correlationId => deleteTournamentMedia(tournamentId, item.id, { correlationId }));
            setMessage({ text: t('mob.tournament.media.removed'), ok: true });
            await load(0);
          } catch {
            setMessage({ text: t('mob.tournament.media.err.failed'), ok: false });
          }
        },
      },
    ]);
  };

  return (
    <View testID="tournament-media">
      {canAdd ? (
        <TabCard style={styles.addCard}>
          <View style={styles.cameraBox}>
            <CameraIcon size={22} color={colors.white} />
          </View>
          <Text style={styles.addTitle}>{t('mob.tournament.media.add_photo')}</Text>
          <Button label={t('mob.tournament.media.upload')} onPress={choose} loading={busy} style={styles.upload} testID="media-upload" />
          <Text style={styles.note}>{t('mob.tournament.media.who_note')}</Text>
        </TabCard>
      ) : null}
      {message ? (
        <Text style={[styles.message, message.ok ? styles.ok : styles.bad]} accessibilityRole="alert" testID="media-message">
          {message.text}
        </Text>
      ) : null}
      <TabCard>
        <CardHead title={t('mob.tournament.media.gallery_title')} badge={t('mob.tournament.media.items', { count: total })} />
        {status === 'loading' ? <ActivityIndicator color={dash.brand} style={styles.loading} testID="media-loading" /> : null}
        {status === 'error' ? <EmptyLine text={t('mob.tournament.media.err.failed')} /> : null}
        {status === 'ready' && items.length === 0 ? <EmptyLine text={t('mob.tournament.media.empty')} /> : null}
        <View style={styles.grid}>
          {items.map(item => (
            <View key={item.id} style={styles.tile} testID={`media-${item.id}`}>
              <Image
                source={{ uri: toHttpsUrl(item.url) ?? item.url }}
                style={styles.image}
                accessibilityLabel={t(item.kind === 'video' ? 'mob.tournament.media.video_a11y' : 'mob.tournament.media.photo_a11y', { name: item.uploaded_by ?? '' })}
              />
              {item.can_remove ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.tournament.media.remove')}
                  onPress={() => remove(item)}
                  style={styles.remove}
                  testID={`media-remove-${item.id}`}
                >
                  <TrashIcon size={16} color={colors.white} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
        {items.length < total ? (
          <Pressable accessibilityRole="button" onPress={() => load(items.length)} style={styles.more} testID="media-more">
            <Text style={styles.moreText}>{t('mob.tournament.media.show_all', { count: total })}</Text>
          </Pressable>
        ) : null}
      </TabCard>
    </View>
  );
}

const styles = StyleSheet.create({
  addCard: { alignItems: 'center', borderStyle: 'dashed' },
  cameraBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addTitle: { ...typography.h3, color: dash.text, marginTop: spacing.sm },
  upload: { marginTop: spacing.sm, alignSelf: 'stretch' },
  note: { ...typography.caption, color: dash.textMuted, textAlign: 'center', marginTop: spacing.sm },
  message: { ...typography.bodyBold, marginBottom: spacing.sm },
  ok: { color: colors.successDark },
  bad: { color: colors.error },
  loading: { marginVertical: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -TILE_GAP / 2 },
  tile: { width: '50%', aspectRatio: 1, padding: TILE_GAP / 2 },
  image: { flex: 1, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: dash.cardBorder, backgroundColor: dash.skeleton },
  remove: { position: 'absolute', top: TILE_GAP, right: TILE_GAP, width: ICON_BOX, height: ICON_BOX, borderRadius: ICON_BOX / 2, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { ...typography.bodyBold, color: dash.brand },
});
