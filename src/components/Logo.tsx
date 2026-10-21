import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';
import { Txt } from './Txt';

// Geometry of tools/make_icons.py (624-unit tall mark): two dark bars plus two red diagonals.
const BAR = '#B1060F';
const W = 432;
const H = 624;
const BAR_W = 112;
const DIAG_H = 440;
const DIAG_LEN = Math.hypot(160, DIAG_H);
const DIAG_THICK = BAR_W * Math.cos(Math.atan2(160, DIAG_H));
const DIAG_ANGLE = (Math.atan2(160, DIAG_H) * 180) / Math.PI;

export function MLogo({ size = 28 }: { size?: number }) {
  const s = size / H;
  const diag = (cx: number, deg: number) => ({
    position: 'absolute' as const,
    width: DIAG_THICK * s,
    height: DIAG_LEN * s,
    left: cx * s - (DIAG_THICK * s) / 2,
    top: (DIAG_H / 2) * s - (DIAG_LEN * s) / 2,
    backgroundColor: colors.red,
    transform: [{ rotate: `${deg}deg` }],
  });
  return (
    <View style={{ width: W * s, height: H * s }}>
      <View style={[styles.bar, { left: 0, width: BAR_W * s, height: H * s }]} />
      <View style={[styles.bar, { right: 0, width: BAR_W * s, height: H * s }]} />
      <View style={{ position: 'absolute', left: 0, top: 0, width: W * s, height: DIAG_H * s, overflow: 'hidden' }}>
        <View style={diag(136, -DIAG_ANGLE)} />
        <View style={diag(296, DIAG_ANGLE)} />
      </View>
    </View>
  );
}

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <View>
      <Txt weight="display" size={size} color={colors.red} spacing={1.5} lineHeight={size * 1.05}>
        MYTHTUBE
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, backgroundColor: BAR },
});
