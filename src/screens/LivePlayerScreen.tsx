import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChannelLogo } from '../components/ChannelLogo';
import { Txt } from '../components/Txt';
import { WebVideo, type WebVideoHandle } from '../components/WebVideo';
import { filterChannels, getChannel, neighbor } from '../data/channels';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Live'>;

const LOAD_TIMEOUT_MS = 14000;
const FITS = ['contain', 'cover', 'fill'] as const;

export default function LivePlayerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const channel = getChannel(route.params.channelId);
  const list = useMemo(() => filterChannels(route.params.filter ?? 'All'), [route.params.filter]);
  const sources = useMemo(() => (channel ? Array.from(new Set([channel.url, ...channel.fallbacks].filter(Boolean))) : []), [channel]);
  const video = useRef<WebVideoHandle | null>(null);

  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fit, setFit] = useState(0);

  // New channel: start again from its first source.
  useEffect(() => {
    setIndex(0);
    setFailed(false);
    setReady(false);
  }, [channel?.id]);

  const nextSource = useCallback(() => {
    setReady(false);
    setIndex((i) => {
      if (i + 1 < sources.length) return i + 1;
      setFailed(true);
      return i;
    });
  }, [sources.length]);

  useEffect(() => {
    if (ready || failed || sources.length === 0) return;
    const timer = setTimeout(nextSource, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, failed, index, nextSource, sources.length]);

  useEffect(() => {
    if (!visible || drawer) return;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [visible, drawer]);

  useEffect(() => {
    const onMove = () => setVisible(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f') video.current?.toggleFullscreen();
      else if (e.key === 'm') setMuted((m) => !m);
      else if (e.key === 'Escape' && !document.fullscreenElement) navigation.goBack();
      setVisible(true);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [navigation]);

  const zap = (step: 1 | -1) => {
    const target = channel ? neighbor(list, channel.id, step) : undefined;
    if (target) navigation.replace('Live', { channelId: target.id, filter: route.params.filter });
  };

  const url = sources[index];
  const source = useMemo(() => (url ? { url, hls: !/\.(mp4|webm|mkv)(\?|$)/i.test(url) } : null), [url]);

  if (!channel) {
    return (
      <View style={[styles.root, styles.center]}>
        <Txt weight="bold" size={18}>This channel is no longer available.</Txt>
        <Pressable onPress={() => navigation.goBack()} style={styles.button}>
          <Txt weight="bold" color="#000000">Go back</Txt>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebVideo
        ref={video}
        source={failed ? null : source}
        fit={FITS[fit]}
        rate={1}
        volume={1}
        muted={muted}
        startAt={0}
        onReady={() => setReady(true)}
        onTime={() => undefined}
        onPlayingChange={() => undefined}
        onBuffering={() => undefined}
        onEnded={nextSource}
        onError={nextSource}
        onTracks={() => undefined}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible((v) => !v)} />

      {!ready && !failed ? (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color={colors.red} />
          <Txt size={12} color={colors.textMuted} style={{ marginTop: 8 }}>
            Tuning in… source {index + 1} of {sources.length}
          </Txt>
        </View>
      ) : null}

      {failed ? (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
          <Ionicons name="tv-outline" size={48} color={colors.textMuted} />
          <Txt weight="bold" size={16} style={{ marginTop: 12 }}>This channel is not streaming right now.</Txt>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <Pressable onPress={() => { setIndex(0); setFailed(false); }} style={styles.button}>
              <Txt weight="bold" color="#000000">Retry</Txt>
            </Pressable>
            <Pressable onPress={() => zap(1)} style={[styles.button, { backgroundColor: colors.red }]}>
              <Txt weight="bold">Next channel</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}

      {visible ? (
        <>
          <View style={[styles.top, { paddingTop: insets.top + 12, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
            <Pressable hitSlop={12} onPress={() => navigation.goBack()} style={styles.circle}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, marginHorizontal: 14 }}>
              <Txt weight="bold" size={16} numberOfLines={1}>{channel.name}</Txt>
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Txt size={11} color={colors.textMuted}>LIVE • {channel.country} • {channel.category}</Txt>
              </View>
            </View>
            <Pressable hitSlop={10} onPress={() => setMuted((m) => !m)} style={styles.circle}>
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setFit((f) => (f + 1) % FITS.length)} style={[styles.circle, { marginLeft: 8 }]}>
              <Ionicons name="expand-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => video.current?.toggleFullscreen()} style={[styles.circle, { marginLeft: 8 }]}>
              <Ionicons name="scan-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={10} onPress={() => setDrawer((d) => !d)} style={[styles.circle, { marginLeft: 8 }]}>
              <Ionicons name="list" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.zap} pointerEvents="box-none">
            <Pressable hitSlop={16} onPress={() => zap(-1)} style={styles.zapBtn}>
              <Ionicons name="play-skip-back" size={30} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={16} onPress={() => zap(1)} style={styles.zapBtn}>
              <Ionicons name="play-skip-forward" size={30} color={colors.text} />
            </Pressable>
          </View>
        </>
      ) : null}

      {drawer ? (
        <View style={[styles.drawer, { paddingTop: insets.top + 12 }]}>
          <Txt weight="bold" size={16} style={{ paddingHorizontal: 16, marginBottom: 8 }}>Channels</Txt>
          <FlatList
            data={list}
            keyExtractor={(c) => c.id}
            initialNumToRender={14}
            windowSize={5}
            initialScrollIndex={Math.max(0, list.findIndex((c) => c.id === channel.id) - 2)}
            getItemLayout={(_, i) => ({ length: 64, offset: 64 * i, index: i })}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setDrawer(false);
                  navigation.replace('Live', { channelId: item.id, filter: route.params.filter });
                }}
                style={[styles.drawerRow, item.id === channel.id ? { backgroundColor: colors.surface4 } : null]}
              >
                <View style={{ width: 70 }}>
                  <ChannelLogo channel={item} size={64} />
                </View>
                <Txt size={13} numberOfLines={2} style={{ flex: 1, marginLeft: 10 }}>{item.name}</Txt>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center', ...StyleSheet.absoluteFill },
  button: { backgroundColor: colors.text, borderRadius: 6, paddingHorizontal: 20, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingBottom: 12 },
  circle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginRight: 6 },
  zap: { position: 'absolute', left: 0, right: 0, top: '42%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28 },
  zapBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, backgroundColor: 'rgba(15,15,15,0.97)' },
  drawerRow: { height: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
});
