import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { SheetItem } from '../components/ListItems';
import { Poster, POSTER } from '../components/Poster';
import { RowHeader } from '../components/Rows';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { Title } from '../data/types';
import { resolveTitle, rowsByKey, useRows } from '../services/catalog';
import { useRootNav } from '../navigation/types';
import { useApp } from '../state/AppState';
import { Page } from '../components/Page';
import { colors, layout } from '../theme/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const RECOMMENDED = rowsByKey('cm-movies');

function MenuRow({ icon, color, label, detail, onPress }: { icon: IoniconName; color: string; label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed ? { backgroundColor: colors.surface1 } : null]}>
      <View style={[styles.menuIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt weight="bold" size={16}>
          {label}
        </Txt>
        {detail ? (
          <Txt size={12} color={colors.textDim} style={{ marginTop: 2 }}>
            {detail}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
    </Pressable>
  );
}

function SharedRow({ title, items, onPress, onSeeAll }: { title: string; items: Title[]; onPress: (t: Title) => void; onSeeAll?: () => void }) {
  return (
    <View style={{ marginTop: 26 }}>
      <RowHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: 8 }}
        renderItem={({ item }) => (
          <View style={{ width: POSTER.width }}>
            <Poster title={item} onPress={onPress} />
            <Pressable
              onPress={() => Share.share({ message: `Check out "${item.name}" on MythTube` }).catch(() => undefined)}
              style={styles.share}
            >
              <Ionicons name="paper-plane-outline" size={16} color={colors.text} />
              <Txt weight="medium" size={12} style={{ marginLeft: 6 }}>
                Share
              </Txt>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

export default function MyNetflixScreen() {
  const nav = useRootNav();
  const { activeProfile, profileData } = useApp();
  const [menu, setMenu] = useState(false);
  const { rows } = useRows(RECOMMENDED);
  const recommended = rows.flatMap((r) => r.items).slice(0, 12);
  const open = useCallback((t: Title) => nav.navigate('Title', { id: t.id }), [nav]);

  const liked = Object.entries(profileData.ratings)
    .filter(([, r]) => r !== 'down')
    .map(([id]) => resolveTitle(id));
  const myList = profileData.myList.map(resolveTitle);

  return (
    <View style={styles.root}>
      <Page>
      <ScreenHeader title="My MythTube" actions={['search', 'menu']} onMenu={() => setMenu(true)} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {activeProfile ? (
          <View style={styles.profile}>
            <Avatar profile={activeProfile} size={72} radius={6} />
            <View style={styles.profileName}>
              <Txt weight="bold" size={20}>
                {activeProfile.name}
              </Txt>
            </View>
          </View>
        ) : null}

        <MenuRow icon="notifications" color={colors.red} label="Notifications" detail="Live news channels"
          onPress={() => nav.navigate('Notifications')} />
        {/* Adult Content entry point (requirement 9) */}
        <MenuRow
          icon="flame"
          color="#9B2C5A"
          label="Adult Content"
          detail="18+"
          onPress={() => nav.navigate('AdultContent')}
        />

        {liked.length > 0 ? <SharedRow title="TV Shows & Movies You've Liked" items={liked} onPress={open} /> : null}
        {myList.length > 0 ? <SharedRow title="My List" items={myList} onPress={open} onSeeAll={() => nav.navigate('MyList')} /> : null}
        {recommended.length > 0 ? <SharedRow title="Recommended For You" items={recommended} onPress={open} /> : null}
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)}>
        <SheetItem label="App Settings" icon="settings-outline" onPress={() => { setMenu(false); nav.navigate('AppSettings'); }} />
      </Sheet>
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  profile: { alignItems: 'center', paddingVertical: 18 },
  profileName: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.gutter + 4, paddingVertical: 12 },
  menuIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
