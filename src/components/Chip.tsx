import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/tokens';
import { Txt } from './Txt';

interface ChipProps {
  label?: string;
  onPress?: () => void;
  selected?: boolean;
  caret?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  emoji?: string;
  solid?: boolean;
}

export function Chip({ label, onPress, selected, caret, icon, emoji, solid }: ChipProps) {
  const filled = solid && selected;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        label ? styles.withLabel : styles.iconOnly,
        filled ? styles.solid : selected ? styles.selected : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={colors.text} /> : null}
      {emoji ? <Txt size={13}>{emoji} </Txt> : null}
      {label ? (
        <Txt weight="medium" size={14} color={filled ? '#000000' : colors.text}>
          {label}
        </Txt>
      ) : null}
      {caret ? <Ionicons name="chevron-down" size={14} color={filled ? '#000000' : colors.text} style={{ marginLeft: 4 }} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  withLabel: { paddingHorizontal: 14 },
  iconOnly: { width: 32 },
  selected: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.18)' },
  solid: { backgroundColor: colors.text, borderColor: colors.text },
});
