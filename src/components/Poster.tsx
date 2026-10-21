import { Image } from './Img';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Title } from '../data/types';
import { colors, radius } from '../theme/tokens';
import { Txt } from './Txt';

export const POSTER = { width: 110, height: 160 } as const;
export const TALL_POSTER = { width: 146, height: 256 } as const;

const BADGE_LABEL = { new: 'New', 'new-episode': 'New Episode', airing: 'Airing' } as const;

/** Smaller image variants for list-sized posters (saves mobile data and decode time). */
export function thumbUri(uri: string, width: number): string {
  if (width > 170) return uri;
  return uri
    .replace('images.metahub.space/poster/medium/', 'images.metahub.space/poster/small/')
    .replace('image.tmdb.org/t/p/w500/', 'image.tmdb.org/t/p/w342/')
    .replace('/cover/extraLarge/', '/cover/large/');
}

/** Movie / Series / Anime / Adult label shown on search results. */
export function categoryOf(t: Title): string {
  if (t.nsfw) return 'Adult';
  if (t.source === 'anilist') return t.kind === 'movie' ? 'Anime Movie' : 'Anime';
  return t.kind === 'series' ? 'Series' : 'Movie';
}

interface PosterProps {
  title: Title;
  width?: number;
  height?: number;
  onPress?: (title: Title) => void;
  showBadges?: boolean;
  /** Category pill (search results). */
  label?: string;
}

export const Poster = memo(function Poster({ title, width = POSTER.width, height = POSTER.height, onPress, showBadges = true, label }: PosterProps) {
  const raw = title.poster || title.background;
  const uri = raw ? thumbUri(raw, width) : undefined;
  const titleSize = Math.max(12, Math.round(width / 7));
  return (
    <Pressable
      onPress={onPress ? () => onPress(title) : undefined}
      style={({ pressed }) => [styles.frame, { width, height, opacity: pressed ? 0.85 : 1, backgroundColor: title.tint }]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={title.id} />
      ) : null}
      <LinearGradient
        colors={uri ? ['transparent', 'rgba(0,0,0,0.9)'] : ['transparent', 'transparent']}
        locations={[0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {!uri ? (
        <View style={styles.fallback}>
          <Txt weight="display" size={titleSize + 4} lineHeight={titleSize + 4} align="center" numberOfLines={5}>
            {title.name.toUpperCase()}
          </Txt>
        </View>
      ) : null}
      {showBadges && title.badge ? (
        <View style={styles.badge}>
          <Txt weight="bold" size={10} align="center" numberOfLines={1}>
            {BADGE_LABEL[title.badge]}
          </Txt>
        </View>
      ) : null}
      {label ? (
        <View style={styles.label}>
          <Txt weight="bold" size={9}>{label.toUpperCase()}</Txt>
        </View>
      ) : null}
      {showBadges && title.imdbRating ? (
        <View style={styles.rating}>
          <Txt weight="bold" size={10}>★ {title.imdbRating}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: { borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface2 },
  fallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 8 },
  badge: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 3, backgroundColor: colors.red },
  label: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.red, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  rating: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
});
