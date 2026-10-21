import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/tokens';
import { Txt } from './Txt';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function SheetItem({ label, icon, onPress, destructive }: { label: string; icon?: IoniconName; onPress?: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sheetItem, pressed ? { backgroundColor: colors.surface4 } : null]}>
      {icon ? <Ionicons name={icon} size={22} color={destructive ? colors.redLight : colors.text} style={{ marginRight: 16 }} /> : null}
      <Txt weight="medium" size={15} color={destructive ? colors.redLight : colors.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

interface SettingRowProps {
  label: string;
  value?: string;
  description?: string;
  toggle?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  icon?: IoniconName;
}

export function SettingRow({ label, value, description, toggle, onToggle, onPress, icon }: SettingRowProps) {
  const isSwitch = toggle !== undefined;
  return (
    <Pressable
      onPress={isSwitch ? onToggle : onPress}
      style={({ pressed }) => [styles.setting, pressed ? { backgroundColor: colors.surface2 } : null]}
    >
      {icon ? <Ionicons name={icon} size={22} color={colors.textMuted} style={{ marginRight: 14 }} /> : null}
      <View style={{ flex: 1 }}>
        <Txt weight="medium" size={15}>
          {label}
        </Txt>
        {value ? (
          <Txt size={13} color={colors.textDim} style={{ marginTop: 2 }}>
            {value}
          </Txt>
        ) : null}
        {description ? (
          <Txt size={12} color={colors.textDim} style={{ marginTop: 4 }}>
            {description}
          </Txt>
        ) : null}
      </View>
      {isSwitch ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          trackColor={{ false: colors.surface6, true: colors.blue }}
          thumbColor={colors.text}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      ) : null}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Txt weight="semibold" size={13} color={colors.textDim} spacing={0.5} style={styles.section}>
      {children}
    </Txt>
  );
}

interface PickerListProps {
  options: string[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Netflix-style centered list with a round close button (Categories, Seasons). */
export function PickerList({ options, selected, onSelect, onClose }: PickerListProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.pickerContent, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 140 }]}>
        {options.map((o) => {
          const active = o === selected;
          return (
            <Pressable key={o} onPress={() => onSelect(o)} style={styles.pickerItem} hitSlop={4}>
              <Txt weight={active ? 'bold' : 'medium'} size={active ? 22 : 18} color={active ? colors.text : colors.textMuted} align="center">
                {o}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.closeWrap, { bottom: insets.bottom + 36 }]}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed ? { opacity: 0.8 } : null]}>
          <Ionicons name="close" size={30} color="#000000" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  setting: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, minHeight: 56 },
  section: { paddingHorizontal: 16, marginTop: 24, marginBottom: 6 },
  pickerContent: { alignItems: 'center' },
  pickerItem: { paddingVertical: 14 },
  closeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  close: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
