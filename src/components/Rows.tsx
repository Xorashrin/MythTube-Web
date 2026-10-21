import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from './Img';
import React, { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { Title } from '../data/types';
import type { ProgressEntry } from '../state/AppState';
import { colors, layout, radius } from '../theme/tokens';
import { ProgressBar } from './Buttons';
import { POSTER, Poster } from './Poster';
import { Txt } from './Txt';

const GAP = 8;

const listProps = {
  horizontal: true,
  showsHorizontalScrollIndicator: false,
  initialNumToRender: 5,
  maxToRenderPerBatch: 5,
  windowSize: 5,
  removeClippedSubviews: true,
  contentContainerStyle: { paddingHorizontal: layout.gutter },
  ItemSeparatorComponent: () => <View style={{ width: GAP }} />,
} as const;

export function RowHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.header}>
      <Txt weight="bold" size={17} numberOfLines={1} style={styles.headerTitle}>
        {title}
      </Txt>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
          <Txt weight="medium" size={13} color={colors.textMuted}>
            See All
          </Txt>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonRow({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <RowHeader title={title} />
      <View style={{ flexDirection: 'row', paddingHorizontal: layout.gutter, gap: GAP }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: POSTER.width, height: POSTER.height, borderRadius: radius.sm, backgroundColor: colors.surface2 }} />
        ))}
      </View>
    </View>
  );
}

interface PosterRowProps {
  title: string;
  items: Title[];
  onPressTitle: (t: Title) => void;
  width?: number;
  height?: number;
  onSeeAll?: () => void;
}

export const PosterRow = memo(function PosterRow({ title, items, onPressTitle, width = POSTER.width, height = POSTER.height, onSeeAll }: PosterRowProps) {
  const renderItem = useCallback<ListRenderItem<Title>>(
    ({ item }) => <Poster title={item} width={width} height={height} onPress={onPressTitle} />,
    [width, height, onPressTitle],
  );
  return (
    <View style={styles.row}>
      <RowHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        {...listProps}
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: width + GAP, offset: (width + GAP) * index, index })}
      />
    </View>
  );
});

export interface ContinueItem {
  title: Title;
  entry: ProgressEntry;
  label?: string;
}

interface ContinueRowProps {
  title: string;
  items: ContinueItem[];
  onPlay: (item: ContinueItem) => void;
  onInfo: (t: Title) => void;
  onMore: (item: ContinueItem) => void;
}

const CONTINUE_IMAGE_HEIGHT = 150;

export const ContinueRow = memo(function ContinueRow({ title, items, onPlay, onInfo, onMore }: ContinueRowProps) {
  const renderItem = useCallback<ListRenderItem<ContinueItem>>(
    ({ item }) => {
      const posterUri = item.title.background || item.title.poster;
      return (
        <View style={styles.continueCard}>
          <Pressable onPress={() => onPlay(item)} style={styles.continueImage}>
            <Image source={posterUri ? { uri: posterUri } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" recyclingKey={item.title.id} />
            <View style={styles.playCircle}>
              <Ionicons name="play" size={22} color={colors.text} style={{ marginLeft: 3 }} />
            </View>
            {item.label ? (
              <View style={styles.continueLabel}>
                <Txt weight="semibold" size={11} numberOfLines={1}>
                  {item.label}
                </Txt>
              </View>
            ) : null}
          </Pressable>
          <ProgressBar value={item.entry.position / Math.max(1, item.entry.duration)} height={2} track={colors.surface5} style={{ borderRadius: 0 }} />
          <View style={styles.continueBar}>
            <Pressable onPress={() => onInfo(item.title)} hitSlop={8}>
              <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => onMore(item)} hitSlop={8}>
              <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      );
    },
    [onPlay, onInfo, onMore],
  );
  return (
    <View style={styles.row}>
      <RowHeader title={title} />
      <FlatList
        {...listProps}
        data={items}
        keyExtractor={(i) => i.title.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: POSTER.width + GAP, offset: (POSTER.width + GAP) * index, index })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginTop: 22 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    marginBottom: 10,
  },
  headerTitle: { flex: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  top10Item: { flexDirection: 'row', alignItems: 'flex-end' },
  continueCard: { width: POSTER.width, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface1 },
  continueImage: { height: CONTINUE_IMAGE_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.text,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  continueBar: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
});
