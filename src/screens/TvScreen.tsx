import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ListRenderItem } from 'react-native';

import { ChannelLogo } from '../components/ChannelLogo';
import { Chip } from '../components/Chip';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt } from '../components/Txt';
import { CHANNEL_FILTERS, filterChannels, type Channel } from '../data/channels';
import { useRootNav } from '../navigation/types';
import { colors, layout } from '../theme/tokens';

const COLUMNS = 3;

export default function TvScreen() {
  const nav = useRootNav();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('All');
  const channels = useMemo(() => filterChannels(filter), [filter]);
  const cell = Math.floor((width - layout.gutter * 2 - 8 * (COLUMNS - 1)) / COLUMNS);

  const renderItem = useCallback<ListRenderItem<Channel>>(
    ({ item }) => (
      <Pressable onPress={() => nav.navigate('Live', { channelId: item.id, filter })} style={({ pressed }) => [{ width: cell, opacity: pressed ? 0.7 : 1 }]}>
        <ChannelLogo channel={item} size={cell} />
        <Txt weight="medium" size={12} numberOfLines={1} style={{ marginTop: 6 }}>
          {item.name}
        </Txt>
        <View style={styles.meta}>
          <View style={styles.liveDot} />
          <Txt size={10} color={colors.textDim} numberOfLines={1}>
            {item.category}
            {item.quality ? ` • ${item.quality}` : ''}
          </Txt>
        </View>
      </Pressable>
    ),
    [cell, nav, filter],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Live TV" actions={['search']} searchScope={{ live: true }} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CHANNEL_FILTERS.map((f) => (
            <Chip key={f} label={f} selected={filter === f} solid onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        key={filter}
        data={channels}
        keyExtractor={(c) => c.id}
        numColumns={COLUMNS}
        renderItem={renderItem}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <Txt size={12} color={colors.textDim} style={styles.count}>
            {channels.length} channels
          </Txt>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chips: { gap: 8, paddingHorizontal: layout.gutter, paddingVertical: 8 },
  grid: { paddingBottom: 30, gap: 16 },
  row: { gap: 8, paddingHorizontal: layout.gutter },
  count: { paddingHorizontal: layout.gutter, marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginRight: 5 },
});
