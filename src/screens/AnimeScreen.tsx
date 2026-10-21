import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Billboard } from '../components/Billboard';
import { Chip } from '../components/Chip';
import { Poster } from '../components/Poster';
import { PosterRow, SkeletonRow } from '../components/Rows';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt } from '../components/Txt';
import type { Title } from '../data/types';
import { useRootNav } from '../navigation/types';
import { ANIME_GENRES, ANIME_ROWS, loadAnimeGenre, useRows } from '../services/catalog';
import { warmUp } from '../services/playback';
import { useApp } from '../state/AppState';
import { colors, layout } from '../theme/tokens';

/** Anime tab: AniList discovery (airing schedule, seasons, rankings, genres). Streams come from the anime plugins. */
export default function AnimeScreen() {
  const nav = useRootNav();
  const { width } = useWindowDimensions();
  const { profileData, toggleMyList, showToast } = useApp();
  const { rows, refresh, refreshing } = useRows(ANIME_ROWS);
  const [genre, setGenre] = useState<string | null>(null);
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const cell = Math.floor((width - layout.gutter * 2 - 16) / 3);

  const openTitle = useCallback((t: Title) => nav.navigate('Title', { id: t.id }), [nav]);

  const hero = useMemo(() => rows.find((r) => r.def.key === 'an-trending')?.items.find((t) => t.background || t.poster), [rows]);
  useEffect(() => {
    if (hero) warmUp(hero);
  }, [hero?.id]);

  const more = useCallback(
    async (reset: boolean) => {
      if (!genre || loading || (done && !reset)) return;
      setLoading(true);
      try {
        const p = reset ? 1 : page;
        const next = await loadAnimeGenre(genre, p);
        setItems((prev) => (reset ? next : [...prev, ...next.filter((n) => !prev.some((x) => x.id === n.id))]));
        setPage(p + 1);
        setDone(next.length < 30);
      } catch {
        // keep what is loaded; scrolling again retries
      } finally {
        setLoading(false);
      }
    },
    [genre, loading, done, page],
  );

  useEffect(() => {
    setItems([]);
    setPage(1);
    setDone(false);
    if (genre) more(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Chip label="All" selected={genre === null} solid onPress={() => setGenre(null)} />
      {ANIME_GENRES.map((g) => (
        <Chip key={g} label={g} selected={genre === g} solid onPress={() => setGenre(g)} />
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Anime" actions={['search']} searchScope={{ kind: 'anime' }} />
      {genre ? (
        <FlatList
          key={`genre-${genre}`}
          data={items}
          keyExtractor={(t) => t.id}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          onEndReached={() => more(false)}
          onEndReachedThreshold={0.6}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={chips}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.text} style={{ padding: 24 }} /> : <View style={{ height: 24 }} />}
          renderItem={({ item }) => <Poster title={item} width={cell} height={Math.round(cell * 1.45)} onPress={openTitle} />}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} />}
        >
          {chips}
          {hero ? (
            <Billboard
              title={hero}
              inMyList={profileData.myList.includes(hero.id)}
              onOpen={() => openTitle(hero)}
              onPlay={() => nav.navigate('Title', { id: hero.id })}
              onToggleList={() => {
                toggleMyList(hero.id);
                showToast(profileData.myList.includes(hero.id) ? 'Removed from My List' : 'Added to My List');
              }}
            />
          ) : (
            <View style={styles.heroSkeleton} />
          )}
          {rows.map((r) =>
            r.items.length === 0 ? (
              r.loading ? <SkeletonRow key={r.def.key} title={r.def.title} /> : null
            ) : (
              <PosterRow key={r.def.key} title={r.def.title} items={r.items} onPressTitle={openTitle} />
            ),
          )}
          {!rows.some((r) => r.items.length > 0) && !rows.some((r) => r.loading) ? (
            <Txt size={14} color={colors.textMuted} align="center" style={{ padding: 32 }}>
              Anime lists could not load. Pull down to retry.
            </Txt>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chips: { gap: 8, paddingHorizontal: layout.gutter, paddingVertical: 10 },
  heroSkeleton: { height: 420, marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface2 },
  grid: { gap: 8, paddingBottom: 24 },
  gridRow: { gap: 8, paddingHorizontal: layout.gutter },
});
