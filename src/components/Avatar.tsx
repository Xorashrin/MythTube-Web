import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { View } from 'react-native';

import type { Profile } from '../data/types';
import { Txt } from './Txt';

interface AvatarProps {
  profile: Pick<Profile, 'id' | 'color' | 'kids'>;
  size: number;
  radius?: number;
}

export const Avatar = memo(function Avatar({ profile, size, radius = 4 }: AvatarProps) {
  if (profile.kids) {
    return (
      <LinearGradient
        colors={['#FF6A3D', '#E5B80B', '#2D6CDF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}
      >
        <Txt weight="black" size={size * 0.3} color="#FFFFFF">
          kids
        </Txt>
      </LinearGradient>
    );
  }
  const eye = { position: 'absolute' as const, top: size * 0.34, width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06, backgroundColor: '#FFFFFF' };
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: profile.color }}>
      <View style={[eye, { left: size * 0.28 }]} />
      <View style={[eye, { right: size * 0.28 }]} />
      <View
        style={{
          position: 'absolute',
          left: size * 0.28,
          top: size * 0.5,
          width: size * 0.44,
          height: size * 0.22,
          borderBottomWidth: Math.max(2, size * 0.07),
          borderLeftWidth: Math.max(2, size * 0.07),
          borderRightWidth: Math.max(2, size * 0.07),
          borderColor: '#FFFFFF',
          borderBottomLeftRadius: size * 0.22,
          borderBottomRightRadius: size * 0.22,
        }}
      />
    </View>
  );
});
