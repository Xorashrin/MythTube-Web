import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ChannelLogo } from '../components/ChannelLogo';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt } from '../components/Txt';
import { newsChannels, type Channel } from '../data/channels';
import type { RootStackParamList } from '../navigation/types';
import { colors, layout } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

/** Live news channels (route name "Notifications" kept for navigation back-compat). */
export default function NotificationsScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const news = useMemo(() => newsChannels(60), []);
  const tile = Math.min(160, Math.floor((width - layout.gutter * 2 - 8 * 3) / 4));
  const openChannel = (c: Channel) => navigation.navigate('Live', { channelId: c.id, filter: 'News' });

  return (
    <View style={styles.root}>
      <ScreenHeader title="News" back />
      <ScrollView>
        <View style={styles.sectionHeader}>
          <Txt weight="bold" size={18}>Live News Channels</Txt>
          <Txt size={12} color={colors.textDim} style={{ marginTop: 4 }}>
            {news.length} channels
          </Txt>
        </View>
        <FlatList
          horizontal
          data={news}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.newsRow}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable onPress={() => openChannel(item)} style={({ pressed }) => [{ width: tile }, pressed ? { opacity: 0.7 } : null]}>
              <ChannelLogo channel={item} size={tile} />
              <Txt weight="medium" size={11} numberOfLines={2} style={{ marginTop: 6 }}>
                {item.name}
              </Txt>
              <View style={styles.meta}>
                <View style={styles.liveDot} />
                <Txt size={9} color={colors.textDim} numberOfLines={1}>
                  {item.country}
                  {item.quality ? ` • ${item.quality}` : ''}
                </Txt>
              </View>
            </Pressable>
          )}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sectionHeader: { paddingHorizontal: layout.gutter, paddingTop: 18, paddingBottom: 12 },
  newsRow: { paddingHorizontal: layout.gutter, gap: 10, paddingBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.red, marginRight: 4 },
});
