import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme/tokens';
import { Txt } from './Txt';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ButtonProps {
  label: string;
  onPress?: () => void;
  icon?: IoniconName;
  variant?: 'white' | 'gray' | 'red' | 'glass' | 'outline';
  height?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

const VARIANTS = {
  white: { bg: colors.text, pressed: '#D6D6D6', fg: '#000000', border: 'transparent' },
  gray: { bg: colors.surface4, pressed: colors.surface5, fg: colors.text, border: 'transparent' },
  red: { bg: colors.red, pressed: colors.redPressed, fg: colors.text, border: 'transparent' },
  glass: { bg: colors.glassButton, pressed: 'rgba(109,109,110,0.8)', fg: colors.text, border: 'transparent' },
  outline: { bg: 'transparent', pressed: 'rgba(255,255,255,0.08)', fg: colors.text, border: colors.textDim },
} as const;

export function Button({ label, onPress, icon, variant = 'white', height = 40, style, disabled, loading, children }: ButtonProps) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border, opacity: disabled ? 0.45 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {children}
          {icon ? <Ionicons name={icon} size={height * 0.55} color={v.fg} style={styles.icon} /> : null}
          <Txt weight="bold" size={15} color={v.fg}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

interface ActionProps {
  label: string;
  icon: MciName;
  onPress?: () => void;
  active?: boolean;
  width?: number;
}

/** Icon-over-label action (My List / Rate / Share on details, Remind Me on New & Hot). */
export function IconAction({ label, icon, onPress, active, width = 64 }: ActionProps) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.action, { width, opacity: pressed ? 0.6 : 1 }]}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.text} />
      <Txt size={11} color={active ? colors.text : colors.textMuted} align="center" style={styles.actionLabel} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IoniconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, onPress, size = 24, color = colors.text, style }: IconButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function CircleIconButton({ icon, onPress, size = 32 }: { icon: IoniconName; onPress?: () => void; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.circle, { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={size * 0.6} color={colors.text} />
    </Pressable>
  );
}

export function ProgressBar({ value, height = 3, track = colors.surface6, style }: { value: number; height?: number; track?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height, backgroundColor: track, borderRadius: height }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: colors.red, borderRadius: height }} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  icon: { marginRight: 6 },
  action: { alignItems: 'center' },
  actionLabel: { marginTop: 6 },
  iconButton: { padding: 4 },
  circle: { backgroundColor: 'rgba(40,40,40,0.85)', alignItems: 'center', justifyContent: 'center' },
});
