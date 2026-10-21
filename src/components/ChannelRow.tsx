import { Image } from './Img';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { RowHeader } from './Rows';
import { Txt } from './Txt';
import type { Channel } from '../data/channels';
import { colors, layout, radius } from '../theme/tokens';

interface ChannelRowProps {
  title: string;
  items: Channel[];
  onPressChannel: (c: Channel) => void;
  onSeeAll?: () => void;
}

/**
 * Horizontal scroller showing IPTV channel logos + names.
 * Used by Home, NewHot, News screens to surface real scraped streams.
 */
export const ChannelRow = memo(function ChannelRow({ title, items, onPressChannel, onSeeAll }: ChannelRowProps) {
  const { width } = useWindowDimensions();
  const tile = Math.min(160, Math.floor((width - layout.gutter * 2 - 8 * 2) / 3.2));

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <RowHeader title={title} onSeeAll={onSeeAll} />
      <View style={styles.row}>
        {items.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onPressChannel(c)}
            style={({ pressed }) => [styles.tile, { width: tile }, pressed ? { opacity: 0.7 } : null]}
          >
            <View style={styles.logoWrap}>
              {c.logo ? (
                <Image
                  source={{ uri: c.logo }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  recyclingKey={c.id}
                  transition={120}
                />
              ) : (
                <Txt weight="bold" size={14} color={colors.textDim}>
                  {c.name.slice(0, 2).toUpperCase()}
                </Txt>
              )}
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Txt size={9} weight="bold" color={colors.bg}>
                  LIVE
                </Txt>
              </View>
            </View>
            <Txt weight="medium" size={12} numberOfLines={2} style={styles.name}>
              {c.name}
            </Txt>
            <Txt size={10} color={colors.textDim} numberOfLines={1}>
              {c.country}
              {c.quality ? ` • ${c.quality}` : ''}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: 24 },
  row: { flexDirection: 'row', paddingHorizontal: layout.gutter, gap: 10 },
  tile: { marginRight: 2 },
  logoWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: { marginTop: 6, minHeight: 28 },
  liveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(229,9,20,0.95)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.bg },
});
