import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { SectionLabel, SettingRow, SheetItem } from '../components/ListItems';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { RootStackParamList } from '../navigation/types';
import { clearPersistentCache } from '../services/cache';
import { API_PROXY } from '../services/proxy';
import { LANGUAGES } from '../services/playback';
import { useApp } from '../state/AppState';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

interface Picker {
  title: string;
  options: { label: string; value: string }[];
  current: string;
  onSelect: (v: string) => void;
}

export default function AppSettingsScreen(_props: Props) {
  const { state, toggleSetting, setSetting, showToast } = useApp();
  const s = state.settings;
  const [picker, setPicker] = useState<Picker | null>(null);

  const checkSources = async () => {
    showToast('Checking sources…');
    const targets = ['https://southfreak.club/wp-json/', 'https://graphql.anilist.co', 'https://v3-cinemeta.strem.io/manifest.json', 'https://api.ani.zip/mappings?anilist_id=1'];
    const started = Date.now();
    const ok = await Promise.all(
      targets.map((u) =>
        Promise.race([
          fetch(`${API_PROXY}?url=${encodeURIComponent(u)}`).then((r) => r.ok),
          new Promise<boolean>((r) => setTimeout(() => r(false), 9000)),
        ]).catch(() => false),
      ),
    );
    showToast(`${ok.filter(Boolean).length}/${targets.length} sources online (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="App Settings" back />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionLabel>Playback</SectionLabel>
        <SettingRow
          icon="flash-outline"
          label="Double-Click to Seek"
          description="Double-click the left or right half of the video to jump 10 seconds."
          toggle={s.doubleTapSeek}
          onToggle={() => toggleSetting('doubleTapSeek')}
        />
        <SettingRow icon="play-forward-outline" label="Autoplay Next Episode" toggle={s.autoplayNext} onToggle={() => toggleSetting('autoplayNext')} />
        <SettingRow
          icon="videocam-outline"
          label="Streaming Quality"
          value={s.defaultStreamingQuality.toUpperCase()}
          onPress={() =>
            setPicker({
              title: 'Preferred Streaming Quality',
              current: s.defaultStreamingQuality,
              options: [
                { label: 'Auto (highest available)', value: 'auto' },
                { label: '1080p (Full HD)', value: '1080p' },
                { label: '720p (HD)', value: '720p' },
                { label: '480p (Data Saver)', value: '480p' },
              ],
              onSelect: (v) => setSetting('defaultStreamingQuality', v as typeof s.defaultStreamingQuality),
            })
          }
        />
        <SettingRow
          icon="language-outline"
          label="Preferred Language"
          value={s.preferredLanguage}
          onPress={() =>
            setPicker({
              title: 'Preferred Language',
              current: s.preferredLanguage,
              options: LANGUAGES.map((l) => ({ label: l.label, value: l.label })),
              onSelect: (v) => setSetting('preferredLanguage', v),
            })
          }
        />
        <SettingRow
          icon="cellular-outline"
          label="Data Saver"
          description="Stops background source checks and pre-loading, and keeps streams at 720p or below."
          toggle={s.dataSaver}
          onToggle={() => toggleSetting('dataSaver')}
        />

        <SectionLabel>Diagnostics</SectionLabel>
        <SettingRow icon="speedometer-outline" label="Check Sources" description="Pings the content sources through your proxy and reports how many answer." onPress={checkSources} />
        <SettingRow
          icon="refresh-outline"
          label="Clear Content Cache"
          description="Forces fresh lists from every source on next open."
          onPress={() => clearPersistentCache().then(() => showToast('Cache cleared'))}
        />

        <SectionLabel>About</SectionLabel>
        <SettingRow icon="globe-outline" label="MythTube Web" value="2.0.0 · installable app (PWA)" />
      </ScrollView>
      <Sheet visible={picker !== null} onClose={() => setPicker(null)}>
        {picker ? (
          <>
            <Txt weight="bold" size={16} style={{ paddingHorizontal: 20, paddingVertical: 10 }}>{picker.title}</Txt>
            {picker.options.map((o) => (
              <SheetItem
                key={o.value}
                label={o.label}
                icon={o.value === picker.current ? 'checkmark-circle' : 'ellipse-outline'}
                onPress={() => {
                  picker.onSelect(o.value);
                  setPicker(null);
                }}
              />
            ))}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
