import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from './Img';
import React, { memo, useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { Title } from '../data/types';
import type { ProgressEntry } from '../state/AppState';
import { colors, layout, radius } from '../theme/tokens';
import { useLayout } from '../theme/useLayout';
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
  ItemSeparatorComponent: () => <View style={{ width: GAP }} />,
} as const;

export function RowHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const lay = useLayout();
  return (
    <View style={[styles.header, { paddingHorizontal: lay.gutter }]}>
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
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: GAP }}>
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

export const PosterRow = memo(function PosterRow({ title, items, onPressTitle, width: w, height: h, onSeeAll }: PosterRowProps) {
  const lay = useLayout();
  const width = w ?? lay.poster.width;
  const height = h ?? lay.poster.height;
  const list = useRef<FlatList<Title>>(null);
  const offset = useRef(0);
  const [hover, setHover] = useState(false);
  const step = (dir: 1 | -1) => {
    const next = Math.max(0, offset.current + dir * (lay.content - lay.gutter * 2) * 0.85);
    list.current?.scrollToOffset({ offset: next, animated: true });
  };
  const renderItem = useCallback<ListRenderItem<Title>>(
    ({ item }) => <Poster title={item} width={width} height={height} onPress={onPressTitle} />,
    [width, height, onPressTitle],
  );
  return (
    <View
      style={[styles.row, lay.wide && { marginTop: 28 }]}
      {...({ onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) } as object)}
    >
      <RowHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        ref={list}
        {...listProps}
        contentContainerStyle={{ paddingHorizontal: lay.gutter }}
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={64}
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: width + GAP, offset: (width + GAP) * index, index })}
      />
      {lay.wide && hover ? (
        <>
          <Pressable onPress={() => step(-1)} style={[styles.arrow, { left: 0, height }]}>
            <Ionicons name="chevron-back" size={30} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => step(1)} style={[styles.arrow, { right: 0, height }]}>
            <Ionicons name="chevron-forward" size={30} color={colors.text} />
          </Pressable>
        </>
      ) : null}
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
  const lay = useLayout();
  const renderItem = useCallback<ListRenderItem<ContinueItem>>(
    ({ item }) => {
      const posterUri = item.title.background || item.title.poster;
      return (
        <View style={[styles.continueCard, lay.wide && { width: 260 }]}>
          <Pressable onPress={() => onPlay(item)} style={[styles.continueImage, lay.wide && { height: 146 }]}>
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
    [onPlay, onInfo, onMore, lay.wide],
  );
  return (
    <View style={styles.row}>
      <RowHeader title={title} />
      <FlatList
        {...listProps}
        contentContainerStyle={{ paddingHorizontal: lay.gutter }}
        data={items}
        keyExtractor={(i) => i.title.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: (lay.wide ? 260 : POSTER.width) + GAP, offset: ((lay.wide ? 260 : POSTER.width) + GAP) * index, index })}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  arrow: { position: 'absolute', bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
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
