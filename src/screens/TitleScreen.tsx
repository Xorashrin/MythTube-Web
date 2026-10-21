import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from '../components/Img';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CircleIconButton, IconAction, ProgressBar } from '../components/Buttons';
import { Txt } from '../components/Txt';
import { findEpisode, type Episode, type Title } from '../data/types';
import { loadDetail, resolveTitle } from '../services/catalog';
import { useSourceSearch } from '../services/playback';
import type { RootStackParamList } from '../navigation/types';
import { progressFor, useApp, type Rating } from '../state/AppState';
import { colors, radius } from '../theme/tokens';
import { formatRuntime, seasonsLabel } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Title'>;
type Tab = 'episodes' | 'more' | 'servers';

const RATING_ICON: Record<Rating, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  down: 'thumb-down',
  up: 'thumb-up',
  love: 'thumbs-up-down',
};

function MetaTag({ label }: { label: string }) {
  return (
    <View style={styles.metaTag}>
      <Txt weight="semibold" size={10} color={colors.textSoft}>
        {label}
      </Txt>
    </View>
  );
}

function EpisodeRow({ title, episode, onPlay }: { title: Title; episode: Episode; onPlay: () => void }) {
  const { profileData } = useApp();
  const progress = progressFor(profileData, title.id);
  const watched = progress?.episodeId === episode.id ? progress.position / Math.max(1, progress.duration) : 0;
  return (
    <View style={styles.episode}>
      <View style={styles.episodeTop}>
        <Pressable onPress={onPlay} style={styles.still}>
          <Image source={episode.still ? { uri: episode.still } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          <View style={styles.stillPlay}>
            <Ionicons name="play" size={16} color={colors.text} style={{ marginLeft: 2 }} />
          </View>
          {watched > 0 ? <ProgressBar value={watched} height={3} style={styles.stillProgress} /> : null}
        </Pressable>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Txt weight="medium" size={14} numberOfLines={2}>
            {episode.number}. {episode.name}
          </Txt>
          {episode.runtime > 0 || episode.airDate ? (
            <Txt size={12} color={colors.textDim} style={{ marginTop: 4 }}>
              {episode.runtime > 0 ? `${episode.runtime}m` : new Date(episode.airDate!).toLocaleDateString()}
            </Txt>
          ) : null}
        </View>
              </View>
      {episode.synopsis ? (
        <Txt size={13} color={colors.textMuted} lineHeight={18} numberOfLines={3} style={{ marginTop: 8 }}>
          {episode.synopsis}
        </Txt>
      ) : null}
    </View>
  );
}

export default function TitleScreen({ navigation, route }: Props) {
  const [title, setTitle] = useState<Title>(() => resolveTitle(route.params.id));
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profileData, toggleMyList, rate, showToast } = useApp();

  useEffect(() => {
    let cancelled = false;
    loadDetail(route.params.id).then((t) => !cancelled && setTitle(t));
    return () => {
      cancelled = true;
    };
  }, [route.params.id]);

  const [tab, setTab] = useState<Tab>(title.kind === 'series' ? 'episodes' : 'servers');
  const [seasonNumber, setSeasonNumber] = useState(route.params.season ?? -1);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const progress = progressFor(profileData, title.id);
  const resume = progress?.episodeId ? findEpisode(title, progress.episodeId) : null;
  const first = findEpisode(title);
  const target = resume ?? first;

  // Starts looking for servers as soon as the screen opens, so Play and Download are instant.
  const { engine } = useSourceSearch(title, title.kind === 'series' ? target?.episode : undefined);
  const serverCount = engine.servers.length;
  const inList = profileData.myList.includes(title.id);
  const rating = profileData.ratings[title.id];
  const wantedSeason = seasonNumber >= 0 ? seasonNumber : (target?.season.number ?? title.seasons[0]?.number ?? 1);
  const season = title.seasons.find((s) => s.number === wantedSeason) ?? title.seasons[0];
  const tabs: { key: Tab; label: string }[] = [
    ...(title.kind === 'series' ? [{ key: 'episodes' as const, label: 'Episodes' }] : []),
    { key: 'servers', label: 'Sources' },
  ];

  const play = (episodeId?: string) => {
    navigation.navigate('Player', { id: title.id, episodeId });
  };

  const setRating = (r: Rating) => {
    const next = rating === r ? null : r;
    rate(title.id, next);
    setRatingOpen(false);
    if (next === 'down') showToast("We won't suggest this again.");
    else if (next === 'up') showToast("You'll see more like this.");
    else if (next === 'love') showToast('We know you’re a true fan!');
  };

  const playLabel = progress ? 'Resume' : 'Play';
  const epCode = target ? `S${target.season.number}:E${target.episode.number}` : '';

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }}>
        <Pressable onPress={() => play(target?.episode.id)} style={{ width, height: (width * 9) / 16, backgroundColor: title.tint }}>
          <Image
            source={title.background || title.poster ? { uri: (title.background || title.poster)! } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroPlay}>
            <Ionicons name="play" size={30} color={colors.text} style={{ marginLeft: 4 }} />
          </View>
          <View style={styles.heroActions}>
            <CircleIconButton icon="close" size={32} onPress={() => navigation.goBack()} />
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <Txt weight="extrabold" size={24} lineHeight={30}>
            {title.name}
          </Txt>
          <View style={styles.meta}>
            <Txt size={13} color={colors.textMuted}>{title.year}</Txt>
            <View style={styles.maturity}>
              <Txt weight="semibold" size={11}>{title.maturity}</Txt>
            </View>
            <Txt size={13} color={colors.textMuted}>
              {title.kind === 'series' ? (title.seasons.length ? seasonsLabel(title.seasons.length) : 'Series') : title.runtime ? formatRuntime(title.runtime) : 'Movie'}
            </Txt>
            {title.quality.map((q) => (
              <MetaTag key={q} label={q} />
            ))}
          </View>

          <Button label={playLabel} icon="play" variant="white" onPress={() => play(target?.episode.id)} style={styles.cta} />
          {progress ? (
            <View style={styles.resume}>
              <ProgressBar value={progress.position / Math.max(1, progress.duration)} style={{ flex: 1 }} />
              <Txt size={12} color={colors.textMuted} style={{ marginLeft: 10 }}>
                {Math.max(1, Math.round((progress.duration - progress.position) / 60))}m remaining
              </Txt>
            </View>
          ) : null}

          {resume ? (
            <Txt weight="bold" size={14} style={{ marginTop: 10 }}>
              {epCode} {resume.episode.name}
            </Txt>
          ) : null}

          {title.synopsis ? (
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Txt size={14} lineHeight={20} numberOfLines={expanded ? undefined : 3} style={{ marginTop: 10 }}>
                {title.synopsis}
              </Txt>
            </Pressable>
          ) : null}
          {title.cast.length > 0 ? (
            <Txt size={12} color={colors.textDim} numberOfLines={expanded ? undefined : 1} style={{ marginTop: 10 }}>
              <Txt weight="semibold" size={12} color={colors.textMuted}>Starring: </Txt>
              {title.cast.join(', ')}
            </Txt>
          ) : null}
          {title.creators.length > 0 ? (
            <Txt size={12} color={colors.textDim} numberOfLines={1} style={{ marginTop: 4 }}>
              <Txt weight="semibold" size={12} color={colors.textMuted}>
                {title.source === 'anilist' ? 'Studio: ' : title.kind === 'series' ? 'Creator: ' : 'Director: '}
              </Txt>
              {title.creators.join(', ')}
            </Txt>
          ) : null}

          <View style={styles.actions}>
            <IconAction
              label="My List"
              icon={inList ? 'check' : 'plus'}
              active={inList}
              onPress={() => {
                toggleMyList(title.id);
                showToast(inList ? 'Removed from My List' : 'Added to My List');
              }}
            />
            <View>
              <IconAction label="Rate" icon={rating ? RATING_ICON[rating] : 'thumb-up-outline'} active={!!rating} onPress={() => setRatingOpen((o) => !o)} />
              {ratingOpen ? (
                <View style={styles.ratingPopover}>
                  {(['down', 'up', 'love'] as const).map((r) => (
                    <Pressable key={r} hitSlop={6} onPress={() => setRating(r)} style={[styles.ratingButton, rating === r ? styles.ratingActive : null]}>
                      <MaterialCommunityIcons name={r === 'down' ? 'thumb-down-outline' : r === 'up' ? 'thumb-up-outline' : 'thumbs-up-down-outline'} size={26} color={colors.text} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <IconAction label="Share" icon="send-outline" onPress={() => Share.share({ message: `Check out "${title.name}" on MythTube` }).catch(() => undefined)} />
          </View>
          {ratingOpen ? (
            <View style={styles.ratingLabels}>
              <Txt size={11} color={colors.textMuted}>Not for me</Txt>
              <Txt size={11} color={colors.textMuted}>I like this</Txt>
              <Txt size={11} color={colors.textMuted}>Love this!</Txt>
            </View>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {tabs.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
              <View style={[styles.tabIndicator, tab === t.key ? { backgroundColor: colors.red } : null]} />
              <Txt weight="bold" size={14} color={tab === t.key ? colors.text : colors.textDim}>
                {t.label}
              </Txt>
            </Pressable>
          ))}
        </View>

        {tab === 'episodes' && !season ? (
          <View style={{ paddingVertical: 28, alignItems: 'center' }}>
            {title.detailed ? <Txt size={14} color={colors.textMuted}>No episodes released yet.</Txt> : <ActivityIndicator color={colors.text} />}
          </View>
        ) : null}

        {tab === 'episodes' && season ? (
          <View style={styles.tabBody}>
            {title.seasons.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonChips}>
                {title.seasons.map((sn) => {
                  const active = sn.number === season.number;
                  return (
                    <Pressable key={sn.number} onPress={() => setSeasonNumber(sn.number)} style={[styles.seasonChip, active ? styles.seasonChipActive : null]}>
                      <Txt weight="bold" size={13} color={active ? '#000000' : colors.text}>
                        {sn.number === 0 ? 'Specials' : `Season ${sn.number}`}
                      </Txt>
                      <Txt size={10} color={active ? '#333333' : colors.textDim}>{sn.episodes.length} ep</Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Txt weight="semibold" size={14} style={{ marginBottom: 12 }}>{season.number === 0 ? 'Specials' : `Season ${season.number}`}</Txt>
            )}
            {season.episodes.map((e) => (
              <EpisodeRow key={e.id} title={title} episode={e} onPlay={() => play(e.id)} />
            ))}
          </View>
        ) : null}

        {tab === 'servers' ? (
          <View style={styles.tabBody}>
            {serverCount === 0 && !engine.done ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.text} />
                <Txt size={13} color={colors.textMuted} style={{ marginTop: 10 }}>Finding sources…</Txt>
              </View>
            ) : serverCount === 0 ? (
              <Txt size={14} color={colors.textMuted} style={{ paddingVertical: 20 }}>
                No source has this title right now. New uploads are checked every time you open the app.
              </Txt>
            ) : (
              <>
                <Txt size={12} color={colors.textDim} style={{ marginBottom: 10 }}>
                  {engine.results.length} verified of {serverCount} servers{engine.done ? '' : ' • still searching…'}. The best one is picked automatically.
                </Txt>
                {[...engine.servers]
                  .sort((a, b) => (engine.results.findIndex((r) => r.server.id === a.id) + 1 || 999) - (engine.results.findIndex((r) => r.server.id === b.id) + 1 || 999) || b.rank - a.rank)
                  .slice(0, 40)
                  .map((sv) => {
                    const idx = engine.results.findIndex((r) => r.server.id === sv.id);
                    return (
                      <Pressable key={sv.id} onPress={() => play(target?.episode.id)} style={styles.serverCard}>
                        <View style={styles.serverIconWrap}>
                          <MaterialCommunityIcons name="play-network-outline" size={24} color={idx === 0 ? colors.success : colors.red} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Txt weight="semibold" size={14} numberOfLines={1}>{sv.name}{idx === 0 ? '  • BEST' : ''}</Txt>
                          <Txt size={12} color={colors.textMuted} style={{ marginTop: 2 }}>
                            {[sv.size, sv.detail, idx >= 0 ? 'verified' : ''].filter(Boolean).join(' • ')}
                          </Txt>
                        </View>
                        <Ionicons name="play-circle" size={30} color={colors.text} />
                      </Pressable>
                    );
                  })}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  heroPlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.text,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 10 },
  body: { paddingHorizontal: 12, paddingTop: 12 },
  kicker: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  maturity: { backgroundColor: colors.surface6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 2 },
  metaTag: { borderWidth: 1, borderColor: colors.textDim, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 },
  rank: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  rankBadge: { width: 20, height: 26, backgroundColor: colors.red, borderRadius: 2, justifyContent: 'center' },
  cta: { marginTop: 10 },
  resume: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 28, marginTop: 22 },
  ratingPopover: {
    position: 'absolute',
    bottom: 52,
    left: -60,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface4,
    borderRadius: 40,
    padding: 6,
    elevation: 8,
  },
  ratingButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  ratingActive: { backgroundColor: colors.surface6 },
  ratingLabels: { flexDirection: 'row', justifyContent: 'space-between', width: 220, marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 12, marginTop: 26, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surface5 },
  tab: { paddingBottom: 12 },
  tabIndicator: { height: 4, marginBottom: 12, backgroundColor: 'transparent' },
  tabBody: { paddingHorizontal: 12, paddingTop: 6 },
  seasonChips: { gap: 8, paddingBottom: 14 },
  seasonChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.surface4, alignItems: 'center' },
  seasonChipActive: { backgroundColor: colors.text },
  seasonButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface4,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 14,
  },
  episode: { marginBottom: 22 },
  episodeTop: { flexDirection: 'row', alignItems: 'center' },
  still: { width: 124, height: 70, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  stillPlay: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: colors.text, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  stillProgress: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 },
  dlIcon: { paddingLeft: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trailer: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2 },
  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  serverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
