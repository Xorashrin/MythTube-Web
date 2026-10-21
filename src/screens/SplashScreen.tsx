import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { MLogo } from '../components/Logo';
import type { RootStackParamList } from '../navigation/types';
import { useApp } from '../state/AppState';
import { colors, motion } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const { state } = useApp();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 500, easing: motion.decelerate, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(scale, { toValue: 5, duration: 450, easing: Easing.bezier(0.4, 0, 1, 1), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, [opacity, scale, glow]);

  useEffect(() => {
    if (!state.hydrated) return;
    const timer = setTimeout(() => navigation.replace('Main'), 1100);
    return () => clearTimeout(timer);
  }, [state.hydrated, navigation]);

  const glowStyle = {
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }],
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <MLogo size={120} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: colors.red },
});
