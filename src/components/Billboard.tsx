import { Image } from './Img';
import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Title } from '../data/types';
import { useLayout } from '../theme/useLayout';
import { colors, radius } from '../theme/tokens';
import { Button } from './Buttons';
import { Txt } from './Txt';

interface BillboardProps {
  title: Title;
  inMyList: boolean;
  onPlay: () => void;
  onToggleList: () => void;
  onOpen: () => void;
}

export const Billboard = memo(function Billboard({ title, inMyList, onPlay, onToggleList, onOpen }: BillboardProps) {
  const lay = useLayout();
  const width = Math.min(lay.content, 1400) - lay.gutter * 2;
  const height = lay.wide ? Math.min(560, Math.round(width * 0.42)) : Math.round(width * 1.42);
  const heroImage = title.background || title.poster;
  return (
    <Pressable onPress={onOpen} style={[styles.card, { width, height }, lay.wide && { alignSelf: 'flex-start', marginLeft: lay.gutter }]}>
      <Image source={heroImage ? { uri: heroImage } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} locations={[0.4, 0.62, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, lay.wide && { alignItems: 'flex-start', paddingHorizontal: 24, paddingBottom: 40 }]}>
        <Txt weight="display" size={lay.wide ? 72 : 58} lineHeight={lay.wide ? 70 : 56} align={lay.wide ? 'left' : 'center'} numberOfLines={2} spacing={1}>
          {title.name.toUpperCase()}
        </Txt>
        <Txt weight="medium" size={14} color={colors.text90} align={lay.wide ? 'left' : 'center'} style={styles.moods} numberOfLines={1}>
          {[title.kind === 'series' ? 'Series' : 'Movie', ...title.genres.slice(0, 3)].join('  •  ')}
        </Txt>
        <View style={[styles.buttons, lay.wide && { alignSelf: 'flex-start', marginTop: 8 }]}>
          <Button label="Play" icon="play" variant="white" onPress={onPlay} style={[styles.button, lay.wide && { flex: 0, width: 160 }]} />
          <Button label="My List" icon={inMyList ? 'checkmark' : 'add'} variant="glass" onPress={onToggleList} style={[styles.button, lay.wide && { flex: 0, width: 160 }]} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  content: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  kicker: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  moods: { marginTop: 6, marginBottom: 14 },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  button: { flex: 1 },
});
