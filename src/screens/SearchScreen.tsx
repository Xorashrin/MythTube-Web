import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, TextInput, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChannelLogo } from '../components/ChannelLogo';
import { Image } from '../components/Img';
import { categoryOf, Poster } from '../components/Poster';
import { Txt } from '../components/Txt';
import { searchChannels } from '../data/channels';
import { findEpisode, type Title } from '../data/types';
import type { RootStackParamList } from '../navigation/types';
import { ANIME_ROWS, loadDetail, rowsByKey, searchAll, useRows } from '../services/catalog';
import { warmUp } from '../services/playback';
import { addHistory, clearHistory, getHistory, parseQuery, removeHistory, suggest, type Suggestion } from '../services/searchTools';
import { useLayout } from '../theme/useLayout';
import { colors, font, radius } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const RECOMMENDED_ROWS = rowsByKey('cm-series', 'cm-movies');
const ANIME_RECOMMENDED = ANIME_ROWS.slice(1, 3);

function matchKind(t: Title, kind?: 'movie' | 'series' | 'anime') {
  if (!kind) return true;
  if (kind === 'anime') return t.source === 'anilist';
  return t.kind === kind && t.source !== 'anilist';
}

export default function SearchScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const lay = useLayout();
  const scope = route.params;
  const [query, setQuery] = useState('');
  // Typing stays responsive; network search runs on the debounced value.
  const deferred = useDeferredValue(query);
  const [results, setResults] = useState<Title[]>([]);
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(true);
  const { rows } = useRows(scope?.kind === 'anime' ? ANIME_RECOMMENDED : RECOMMENDED_ROWS);

  const parsed = useMemo(() => parseQuery(deferred), [deferred]);
  const scopeLabel = scope?.live ? 'live TV' : scope?.genre ?? (scope?.kind === 'series' ? 'TV shows' : scope?.kind === 'movie' ? 'movies' : scope?.kind === 'anime' ? 'anime' : undefined);

  const recommended = useMemo(() => {
    const all = rows.flatMap((r) => r.items);
    return all
      .filter((t) => matchKind(t, scope?.kind) && (!scope?.genre || t.genres.some((g) => g.toLowerCase() === scope.genre!.toLowerCase())))
      .slice(0, 30);
  }, [rows, scope?.kind, scope?.genre]);

  useEffect(() => {
    getHistory().then(setHistory);
  }, []);

  // Next-word / full-title suggestions while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || scope?.live) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      suggest(q, history).then((s) => !cancelled && setSuggestions(s));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, history, scope?.live]);

  // Search runs on the title part only, so "bachelor point season 1 ep 10" looks up "bachelor point".
  useEffect(() => {
    const q = parsed.text;
    if (q.length < 2 || scope?.live) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchAll(q)
        .then((found) => {
          if (cancelled) return;
          const scoped = found.filter(
            (t) => matchKind(t, scope?.kind) && (!scope?.genre || t.genres.some((g) => g.toLowerCase() === scope.genre!.toLowerCase())),
          );
          setResults(scoped);
          if (scoped[0] && !scoped[0].nsfw) warmUp(scoped[0]);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsed.text, scope?.kind, scope?.genre, scope?.live]);

  const channels = useMemo(() => (scope?.live ? searchChannels(deferred, 24) : []), [deferred, scope?.live]);
  const hasQuery = deferred.trim().length > 0;
  const cell = lay.cell;

  // "Season 1 episode 10" typed after a series name: offer the exact episode and season.
  const series = useMemo(() => (parsed.season || parsed.episode ? results.find((t) => t.kind === 'series') : undefined), [parsed, results]);

  const remember = useCallback(async (text: string) => {
    setHistory(await addHistory(text));
  }, []);

  const open = useCallback(
    (t: Title, season?: number) => {
      Keyboard.dismiss();
      remember(query || t.name);
      navigation.navigate('Title', { id: t.id, season });
    },
    [navigation, query, remember],
  );

  const playEpisode = useCallback(
    async (t: Title, season: number, episode: number) => {
      Keyboard.dismiss();
      remember(query);
      const full = await loadDetail(t.id);
      const hit = full.seasons.find((s) => s.number === season)?.episodes.find((e) => e.number === episode);
      if (hit) navigation.navigate('Player', { id: t.id, episodeId: hit.id });
      else navigation.navigate('Title', { id: t.id, season });
    },
    [navigation, query, remember],
  );

  const renderRecommended = useCallback<ListRenderItem<Title>>(
    ({ item }) => (
      <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.recRow, pressed ? { backgroundColor: colors.surface2 } : null]}>
        <View style={styles.recThumb}>
          <Image source={item.background || item.poster} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} />
        </View>
        <Txt weight="medium" size={14} numberOfLines={2} style={styles.recTitle}>
          {item.name}
        </Txt>
        <Pressable hitSlop={10} onPress={() => navigation.navigate('Player', { id: item.id })}>
          <Ionicons name="play-circle-outline" size={34} color={colors.text} />
        </Pressable>
      </Pressable>
    ),
    [open, navigation],
  );

  const renderResult = useCallback<ListRenderItem<Title>>(
    ({ item }) => <Poster title={item} width={cell} height={Math.round(cell * 1.45)} label={categoryOf(item)} onPress={(t) => open(t, parsed.season)} />,
    [cell, open, parsed.season],
  );

  const showSuggestions = focused && suggestions.length > 0 && query.trim().length >= 2;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        {scopeLabel ? (
          <View style={styles.scope}>
            <Txt weight="semibold" size={12}>In {scopeLabel}</Txt>
          </View>
        ) : null}
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={scopeLabel ? `Search ${scopeLabel}…` : 'Try "Bachelor Point season 1 ep 10"'}
          placeholderTextColor={colors.textDim}
          selectionColor={colors.text}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            remember(query);
          }}
        />
        {searching ? <ActivityIndicator size="small" color={colors.textDim} style={{ marginRight: 8 }} /> : null}
        {query.length > 0 ? (
          <Pressable hitSlop={8} onPress={() => setQuery('')}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {showSuggestions ? (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <Pressable
              key={`${s.kind}:${s.text}`}
              onPress={() => {
                const { season, episode } = parseQuery(query);
                const suffix = season ? ` season ${season}${episode ? ` ep ${episode}` : ''}` : '';
                setQuery(`${s.text}${suffix}`);
                Keyboard.dismiss();
                remember(s.text);
              }}
              style={({ pressed }) => [styles.suggestRow, pressed ? { backgroundColor: colors.surface2 } : null]}
            >
              <Ionicons name={s.kind === 'history' ? 'time-outline' : 'search-outline'} size={18} color={colors.textDim} />
              <Txt size={14} numberOfLines={1} style={{ flex: 1, marginLeft: 12 }}>{s.text}</Txt>
              <Pressable hitSlop={8} onPress={() => setQuery(s.text + ' ')}>
                <Ionicons name="arrow-up-outline" size={18} color={colors.textDim} style={{ transform: [{ rotate: '-45deg' }] }} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!hasQuery ? (
        <FlatList
          key="recommended"
          data={recommended}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          windowSize={7}
          ListHeaderComponent={
            <View>
              {history.length > 0 && !scope?.live ? (
                <View>
                  <View style={styles.historyHead}>
                    <Txt weight="bold" size={18}>Recent searches</Txt>
                    <Pressable
                      hitSlop={8}
                      onPress={async () => {
                        await clearHistory();
                        setHistory([]);
                      }}
                    >
                      <Txt weight="semibold" size={13} color={colors.textMuted}>Clear</Txt>
                    </Pressable>
                  </View>
                  {history.slice(0, 8).map((h) => (
                    <Pressable key={h} onPress={() => setQuery(h)} style={({ pressed }) => [styles.suggestRow, pressed ? { backgroundColor: colors.surface2 } : null]}>
                      <Ionicons name="time-outline" size={18} color={colors.textDim} />
                      <Txt size={14} numberOfLines={1} style={{ flex: 1, marginLeft: 12 }}>{h}</Txt>
                      <Pressable hitSlop={10} onPress={async () => setHistory(await removeHistory(h))}>
                        <Ionicons name="close" size={18} color={colors.textDim} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {!scope?.live ? (
                <Txt weight="bold" size={18} style={styles.section}>
                  {scopeLabel ? `Popular in ${scopeLabel}` : 'Recommended TV Shows & Movies'}
                </Txt>
              ) : (
                <Txt size={14} color={colors.textMuted} style={styles.section}>Type a channel name, country or category.</Txt>
              )}
            </View>
          }
          renderItem={renderRecommended}
        />
      ) : results.length === 0 && channels.length === 0 && searching ? (
        <View key="busy" style={styles.empty}>
          <ActivityIndicator color={colors.text} />
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 14 }}>Searching all sources…</Txt>
        </View>
      ) : results.length === 0 && channels.length === 0 ? (
        <View key="empty" style={styles.empty}>
          <Txt weight="bold" size={20} align="center">Nothing matched “{parsed.text || deferred}”.</Txt>
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 10 }}>
            {scopeLabel ? `Nothing in ${scopeLabel} matches yet. Try a shorter name or search everywhere from Home.` : 'Try a shorter name or another spelling.'}
          </Txt>
        </View>
      ) : (
        <FlatList
          key={`results-grid-${lay.columns}`}
          data={results}
          keyExtractor={(t) => t.id}
          numColumns={lay.columns}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          columnWrapperStyle={[styles.gridRow, { paddingHorizontal: lay.gutter }]}
          contentContainerStyle={styles.grid}
          initialNumToRender={12}
          ListHeaderComponent={
            <View>
              {series && (parsed.season || parsed.episode) ? (
                <View style={styles.jump}>
                  <Txt weight="bold" size={15} numberOfLines={1}>{series.name}</Txt>
                  <View style={styles.jumpRow}>
                    {parsed.episode ? (
                      <Pressable style={[styles.jumpBtn, { backgroundColor: colors.text }]} onPress={() => playEpisode(series, parsed.season ?? 1, parsed.episode!)}>
                        <Ionicons name="play" size={16} color="#000000" />
                        <Txt weight="bold" size={13} color="#000000" style={{ marginLeft: 6 }}>
                          Play S{parsed.season ?? 1} · E{parsed.episode}
                        </Txt>
                      </Pressable>
                    ) : null}
                    <Pressable style={[styles.jumpBtn, { backgroundColor: colors.surface5 }]} onPress={() => open(series, parsed.season ?? 1)}>
                      <Ionicons name="list" size={16} color={colors.text} />
                      <Txt weight="bold" size={13} style={{ marginLeft: 6 }}>
                        {parsed.season ? `Season ${parsed.season} episodes` : 'All episodes'}
                      </Txt>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {channels.length > 0 ? (
                <>
                  <Txt weight="bold" size={18} style={styles.section}>Live TV</Txt>
                  <FlatList
                    horizontal
                    data={channels}
                    keyExtractor={(c) => c.id}
                    keyboardShouldPersistTaps="handled"
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.channelRow}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => {
                          Keyboard.dismiss();
                          remember(query);
                          navigation.navigate('Live', { channelId: item.id });
                        }}
                        style={{ width: cell }}
                      >
                        <ChannelLogo channel={item} size={cell} />
                        <Txt weight="medium" size={12} numberOfLines={1} style={{ marginTop: 6 }}>
                          {item.name}
                        </Txt>
                      </Pressable>
                    )}
                  />
                </>
              ) : null}
              {results.length > 0 ? <Txt weight="bold" size={18} style={styles.section}>Movies & TV</Txt> : null}
            </View>
          }
          renderItem={renderResult}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  scope: { backgroundColor: colors.surface5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface5,
  },
  input: { flex: 1, color: colors.text, fontFamily: font.regular, fontSize: 15, marginHorizontal: 10, paddingVertical: 0 },
  suggestions: { marginHorizontal: 12, marginTop: 4, backgroundColor: colors.surface1, borderRadius: radius.sm, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginTop: 18, marginBottom: 4 },
  section: { paddingHorizontal: 12, marginTop: 20, marginBottom: 10 },
  recRow: { height: 76, marginBottom: 8, flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  recThumb: { width: 140, height: 76, backgroundColor: colors.surface2, borderTopRightRadius: radius.sm, borderBottomRightRadius: radius.sm, overflow: 'hidden' },
  recTitle: { flex: 1, marginHorizontal: 12 },
  empty: { paddingHorizontal: 32, paddingTop: 80 },
  grid: { gap: 8, paddingBottom: 30 },
  gridRow: { gap: 8, paddingHorizontal: 12 },
  channelRow: { gap: 8, paddingHorizontal: 12 },
  jump: { marginHorizontal: 12, marginTop: 14, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface2 },
  jumpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  jumpBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 38, borderRadius: radius.sm },
});
