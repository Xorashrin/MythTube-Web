import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../state/AppState';
import { motion } from '../theme/tokens';
import { Txt } from './Txt';

export function Toast() {
  const { state, clearToast } = useApp();
  const insets = useSafeAreaInsets();
  const visible = useRef(new Animated.Value(0)).current;
  const toast = state.toast;

  useEffect(() => {
    if (!toast) {
      Animated.timing(visible, { toValue: 0, duration: motion.fast, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(visible, { toValue: 1, duration: motion.base, easing: motion.decelerate, useNativeDriver: true }).start();
    const timer = setTimeout(() => clearToast(toast.id), 2400);
    return () => clearTimeout(timer);
  }, [toast, clearToast, visible]);

  const style = {
    opacity: visible,
    transform: [{ translateY: visible.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 76 }, style]}>
      {toast ? (
        <Animated.View style={styles.toast}>
          <Txt weight="semibold" size={14} color="#000000" align="center">
            {toast.message}
          </Txt>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  toast: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 6,
  },
});
