import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Billboard } from '../components/Billboard';
import { ChannelRow } from '../components/ChannelRow';
import { Chip } from '../components/Chip';
import { SheetItem } from '../components/ListItems';
import { ContinueRow, PosterRow, SkeletonRow, type ContinueItem } from '../components/Rows';
import { HeaderActions } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import { bangladeshChannels, moviesChannels, newsChannels, seriesChannels, sportsChannels, type Channel } from '../data/channels';
import { findEpisode, type Title } from '../data/types';
import { HOME_ROWS, resolveTitle, useRows } from '../services/catalog';
import { warmUp } from '../services/playback';
import { useRootNav, type TabParamList } from '../navigation/types';
import { useApp } from '../state/AppState';
import { colors, layout } from '../theme/tokens';
import { shade } from '../utils/color';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;
type HomeFilter = 'all' | 'tv' | 'movies';

const match = (t: Title, filter: HomeFilter, genre?: string) =>
  (filter === 'all' || (filter === 'tv' ? t.kind === 'series' : t.kind === 'movie')) && (!genre || t.genres.some((g) => g.toLowerCase() === genre.toLowerCase()));

export default function HomeScreen({ route, navigation }: Props) {
  const nav = useRootNav();
  const insets = useSafeAreaInsets();
  const { activeProfile, profileData, toggleMyList, rate, removeProgress, showToast } = useApp();
  const [filter, setFilter] = useState<HomeFilter>('all');
  const [menuItem, setMenuItem] = useState<ContinueItem | null>(null);
  const genre = route.params?.genre;
  const name = activeProfile?.name ?? 'You';
  const { rows, refresh, refreshing } = useRows(HOME_ROWS);

  // Item arrays keep their identity while nothing changed, so untouched rows never re-render.
  const filtered = useRef(new Map<string, { src: Title[]; key: string; out: Title[] }>()).current;
  const visibleRows = useMemo(
    () =>
      rows
        .map((r) => {
          const key = `${filter}|${genre ?? ''}`;
          const hit = filtered.get(r.def.key);
          if (hit && hit.src === r.items && hit.key === key) return { ...r, items: hit.out };
          const out = r.items.filter((t) => match(t, filter, genre));
          filtered.set(r.def.key, { src: r.items, key, out });
          return { ...r, items: out };
        })
        .filter((r) => r.loading || r.items.length > 0),
    [rows, filter, genre, filtered],
  );

  const hero = useMemo<Title | null>(() => {
    const bangla = visibleRows.find((r) => r.def.key === 'bd-bangla')?.items.filter((t) => t.poster || t.background) ?? [];
    if (bangla[0] && filter !== 'tv') return bangla.find((t) => t.imdbRating) ?? bangla[0];
    const pool = visibleRows.flatMap((r) => r.items).filter((t) => (t.background || t.poster) && t.source !== 'anilist');
    const heroPool = pool.filter((t) => t.badge === 'new' || t.imdbRating);
    return heroPool[0] ?? pool[0] ?? null;
  }, [visibleRows]);

  // Find the best server for the featured title in the background so Play starts instantly.
  useEffect(() => {
    if (hero) warmUp(hero);
  }, [hero?.id]);

  const continueItems = useMemo<ContinueItem[]>(
    () =>
      profileData.progress
        .map((entry) => {
          const title = resolveTitle(entry.titleId);
          const ep = entry.episodeId ? findEpisode(title, entry.episodeId) : null;
          return { title, entry, label: ep ? `S${ep.season.number}:E${ep.episode.number}` : undefined };
        })
        .filter((i) => i.title.name !== 'Unavailable title' && match(i.title, filter, genre)),
    [profileData.progress, filter, genre],
  );
  const myListItems = useMemo(
    () => profileData.myList.map(resolveTitle).filter((t) => t.name !== 'Unavailable title' && match(t, filter, genre)),
    [profileData.myList, filter, genre],
  );

  const scrollY = useRef(new Animated.Value(0)).current;
  // The chip row slides away as you scroll down and returns on any upward scroll.
  const chipOffset = useRef(Animated.diffClamp(scrollY, 0, layout.chipRowHeight)).current;

  useEffect(() => {
    scrollY.setValue(0);
  }, [filter, genre, scrollY]);

  const onScroll = useRef(Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })).current;

  const headerTop = insets.top + layout.headerHeight;
  const headerBgStyle = { opacity: scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, 0.97], extrapolate: 'clamp' }) };
  const chipsStyle = {
    opacity: chipOffset.interpolate({ inputRange: [0, layout.chipRowHeight], outputRange: [1, 0] }),
    transform: [{ translateY: chipOffset.interpolate({ inputRange: [0, layout.chipRowHeight], outputRange: [0, -layout.chipRowHeight] }) }],
  };

  const openTitle = useCallback((t: Title) => nav.navigate('Title', { id: t.id }), [nav]);
  const playContinue = useCallback((i: ContinueItem) => nav.navigate('Player', { id: i.title.id, episodeId: i.entry.episodeId }), [nav]);
  const openChannel = useCallback((c: Channel) => nav.navigate('Live', { channelId: c.id, filter: 'All' }), [nav]);
  const liveBd = useMemo(() => bangladeshChannels(40), []);
  const liveMovies = useMemo(() => moviesChannels(20), []);
  const liveSeries = useMemo(() => seriesChannels(15), []);
  const liveNews = useMemo(() => newsChannels(15), []);
  const liveSports = useMemo(() => sportsChannels(15), []);
  // Hardware back first clears an active filter or category instead of leaving the app.
  useFocusEffect(
    useCallback(() => {
      if (filter === 'all' && !genre) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setFilter('all');
        navigation.setParams({ genre: undefined });
        return true;
      });
      return () => sub.remove();
    }, [filter, genre, navigation]),
  );

  const clearFilters = () => {
    setFilter('all');
    navigation.setParams({ genre: undefined });
  };

  const filterLabel = filter === 'tv' ? 'TV Shows' : filter === 'movies' ? 'Movies' : undefined;
  const heading = filterLabel ?? genre ?? `For ${name}`;
  const inMyList = hero ? profileData.myList.includes(hero.id) : false;

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        key={`${filter}-${genre ?? ''}`}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerTop + layout.chipRowHeight + 4, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} progressViewOffset={headerTop + layout.chipRowHeight} />}
      >
        <LinearGradient
          colors={[shade(hero?.tint ?? '#1A1A1A', 0.1), shade(hero?.tint ?? '#1A1A1A', 0.55), colors.bg]}
          locations={[0, 0.5, 1]}
          style={[styles.tint, { height: headerTop + 820 }]}
        />
        {hero ? (
          <Billboard
            title={hero}
            inMyList={inMyList}
            onOpen={() => openTitle(hero)}
            onPlay={() => nav.navigate('Player', { id: hero.id })}
            onToggleList={() => {
              toggleMyList(hero.id);
              showToast(inMyList ? 'Removed from My List' : 'Added to My List');
            }}
          />
        ) : (
          <View style={{ height: 420, marginHorizontal: 16, borderRadius: 12, backgroundColor: colors.surface2 }} />
        )}
        {continueItems.length > 0 ? (
          <ContinueRow title={`Continue Watching for ${name}`} items={continueItems} onPlay={playContinue} onInfo={openTitle} onMore={setMenuItem} />
        ) : null}
        {myListItems.length > 0 ? <PosterRow title="My List" items={myListItems} onPressTitle={openTitle} onSeeAll={() => nav.navigate('MyList')} /> : null}
        {filter === 'all' && !genre ? <ChannelRow title="🇧🇩 Live Bangladeshi TV" items={liveBd} onPressChannel={openChannel} onSeeAll={() => nav.navigate('Main', { screen: 'TV' } as never)} /> : null}
        {visibleRows.map((r) =>
          r.items.length === 0 ? <SkeletonRow key={r.def.key} title={r.def.title} /> : <PosterRow key={r.def.key} title={r.def.title} items={r.items} onPressTitle={openTitle} />,
        )}
        {!filter || filter === 'all' ? (
          <>
            <ChannelRow title="🔴 Live Movie Channels" items={liveMovies} onPressChannel={openChannel} />
            <ChannelRow title="🔴 Live Series Channels" items={liveSeries} onPressChannel={openChannel} />
            <ChannelRow title="🔴 Live News Channels" items={liveNews} onPressChannel={openChannel} onSeeAll={() => nav.navigate('Notifications')} />
            <ChannelRow title="🔴 Live Sports Channels" items={liveSports} onPressChannel={openChannel} onSeeAll={() => nav.navigate('Main', { screen: 'TV' } as never)} />
          </>
        ) : null}
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={[styles.header, { height: headerTop + layout.chipRowHeight }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: shade(hero?.tint ?? '#1A1A1A', 0.6) }, headerBgStyle]} />
        <View style={[styles.headerRow, { marginTop: insets.top }]}>
          <Txt weight="bold" size={22} numberOfLines={1} style={{ flex: 1 }}>
            {heading}
          </Txt>
          <HeaderActions actions={['search']} searchScope={{ genre, kind: filter === 'tv' ? 'series' : filter === 'movies' ? 'movie' : undefined }} />
        </View>
        <Animated.View style={[styles.chips, chipsStyle]}>
          {filter === 'all' && !genre ? (
            <>
              <Chip label="TV Shows" onPress={() => setFilter('tv')} />
              <Chip label="Movies" onPress={() => setFilter('movies')} />
              <Chip label="Categories" caret onPress={() => nav.navigate('Categories', { current: genre })} />
            </>
          ) : (
            <>
              <Chip icon="close" onPress={clearFilters} />
              {filterLabel ? <Chip label={filterLabel} selected /> : null}
              <Chip label={genre ?? 'All Categories'} caret selected={!!genre} onPress={() => nav.navigate('Categories', { current: genre })} />
            </>
          )}
        </Animated.View>
      </View>

      <Sheet visible={menuItem !== null} onClose={() => setMenuItem(null)}>
        {menuItem ? (
          <>
            <Txt weight="bold" size={16} style={styles.sheetTitle} numberOfLines={1}>
              {menuItem.title.name}
              {menuItem.label ? `  ${menuItem.label}` : ''}
            </Txt>
            <SheetItem label="Episodes & Info" icon="information-circle-outline" onPress={() => { setMenuItem(null); openTitle(menuItem.title); }} />
            <SheetItem label="Not for me" icon="thumbs-down-outline" onPress={() => { rate(menuItem.title.id, 'down'); setMenuItem(null); showToast("We won't suggest this again."); }} />
            <SheetItem label="I like this" icon="thumbs-up-outline" onPress={() => { rate(menuItem.title.id, 'up'); setMenuItem(null); showToast("You'll see more like this."); }} />
            <SheetItem label="Love this!" icon="heart-outline" onPress={() => { rate(menuItem.title.id, 'love'); setMenuItem(null); showToast('We know you’re a true fan!'); }} />
            <SheetItem label="Remove From Row" icon="close-circle-outline" destructive onPress={() => { removeProgress(menuItem.title.id); setMenuItem(null); showToast('Removed from Continue Watching'); }} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tint: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  headerRow: { height: layout.headerHeight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.gutter + 4 },
  chips: { height: layout.chipRowHeight, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: layout.gutter + 4 },
  sheetTitle: { paddingHorizontal: 20, paddingVertical: 10 },
});
