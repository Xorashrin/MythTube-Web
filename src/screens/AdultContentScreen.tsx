import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ChannelRow } from '../components/ChannelRow';
import { Poster } from '../components/Poster';
import { PosterRow, SkeletonRow } from '../components/Rows';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt } from '../components/Txt';
import { adultChannels, type Channel } from '../data/channels';
import type { Title } from '../data/types';
import { ADULT_ROWS, loadAdultPage, useRows } from '../services/catalog';
import type { RootStackParamList } from '../navigation/types';
import { useLayout } from '../theme/useLayout';
import { colors, layout } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AdultContent'>;

const AGE_GATE_KEY = 'mythtube:adult-confirmed-v1';

/** 18+ section: live feeds plus an endlessly paged library from southfreak.in, behind a one-time age confirmation. */
export default function AdultContentScreen({ navigation }: Props) {
  const lay = useLayout();
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const channels = useMemo(() => adultChannels(), []);
  const { rows } = useRows(ADULT_ROWS, confirmed);
  const cell = lay.cell;

  useEffect(() => {
    AsyncStorage.getItem(AGE_GATE_KEY)
      .then((ok) => setConfirmed(ok === '1'))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  const more = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const next = await loadAdultPage(page);
      setItems((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...next.filter((t) => !seen.has(t.id))];
      });
      if (next.length < 30) setDone(true);
      setPage((p) => p + 1);
    } catch {
      // keep what is loaded; the user can scroll again to retry
    } finally {
      setLoading(false);
    }
  }, [loading, done, page]);

  useEffect(() => {
    if (confirmed && items.length === 0) more();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const confirm = async () => {
    await AsyncStorage.setItem(AGE_GATE_KEY, '1').catch(() => undefined);
    setConfirmed(true);
  };

  if (checking) return <View style={styles.root} />;

  if (!confirmed) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Adult Content" back />
        <View style={styles.gateRoot}>
          <Txt weight="bold" size={22} align="center">Adults Only (18+)</Txt>
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 12, paddingHorizontal: 16 }}>
            This section contains mature content. By continuing, you confirm that you are at least 18 years old and that viewing such material is legal in your jurisdiction.
          </Txt>
          <View style={styles.gateButtons}>
            <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => navigation.goBack()}>
              <Txt weight="bold" size={14}>Take me back</Txt>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSolid]} onPress={confirm}>
              <Txt weight="bold" size={14} color={colors.bg}>I'm 18 or older</Txt>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const openChannel = (c: Channel) => navigation.navigate('Live', { channelId: c.id, filter: 'Adult' });

  return (
    <View style={styles.root}>
      <ScreenHeader title="Adult Content" back />
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        key={`grid-${lay.columns}`}
        numColumns={lay.columns}
        columnWrapperStyle={[styles.row, { paddingHorizontal: lay.gutter }]}
        contentContainerStyle={styles.grid}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        initialNumToRender={9}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ paddingBottom: 8 }}>
            {channels.length > 0 ? <ChannelRow title="🔴 Live Channels" items={channels} onPressChannel={openChannel} /> : null}
            {rows.map((r) =>
              r.items.length === 0 ? (
                r.loading ? <SkeletonRow key={r.def.key} title={r.def.title} /> : null
              ) : (
                <PosterRow key={r.def.key} title={r.def.title} items={r.items} onPressTitle={(t) => navigation.navigate('Title', { id: t.id })} />
              ),
            )}
            <View style={styles.header}>
              <Txt weight="bold" size={16}>Latest Uploads (southfreak.in)</Txt>
            </View>
          </View>
        }
        ListFooterComponent={loading ? <ActivityIndicator color={colors.text} style={{ padding: 20 }} /> : undefined}
        renderItem={({ item }) => (
          <View style={{ width: cell }}>
            <Poster title={item} width={cell} height={Math.round(cell * 1.45)} onPress={(t) => navigation.navigate('Title', { id: t.id })} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  gateRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  gateButtons: { flexDirection: 'row', gap: 12, marginTop: 28 },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, minWidth: 130, alignItems: 'center' },
  btnOutline: { borderWidth: 1, borderColor: colors.text },
  btnSolid: { backgroundColor: colors.text },
  header: { paddingHorizontal: layout.gutter, paddingTop: 24, paddingBottom: 8 },
  grid: { paddingBottom: 30, gap: 8 },
  row: { gap: 8, paddingHorizontal: layout.gutter },
});
