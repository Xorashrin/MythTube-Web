import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Buttons';
import { Chip } from '../components/Chip';
import { SheetItem } from '../components/ListItems';
import { Poster } from '../components/Poster';
import { ScreenHeader } from '../components/ScreenHeader';
import { Sheet } from '../components/Sheet';
import { Txt } from '../components/Txt';
import type { Title } from '../data/types';
import { resolveTitle } from '../services/catalog';
import type { RootStackParamList } from '../navigation/types';
import { progressFor, useApp } from '../state/AppState';
import { useLayout } from '../theme/useLayout';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'MyList'>;
type Filter = 'all' | 'tv' | 'movies' | 'started' | 'not-started';
type Sort = 'Suggested' | 'Date Added to List' | 'Release Date' | 'A - Z';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tv', label: 'TV Shows' },
  { key: 'movies', label: 'Movies' },
  { key: 'started', label: 'Started' },
  { key: 'not-started', label: 'Haven’t started' },
];
const SORTS: Sort[] = ['Suggested', 'Date Added to List', 'Release Date', 'A - Z'];

export default function MyListScreen({ navigation }: Props) {
  const lay = useLayout();
  const { profileData, toggleMyList, showToast } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('Date Added to List');
  const [sortOpen, setSortOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const cell = lay.cell;

  const items = useMemo(() => {
    let list: Title[] = profileData.myList.map(resolveTitle);
    list = list.filter((t) => {
      const started = !!progressFor(profileData, t.id);
      switch (filter) {
        case 'tv':
          return t.kind === 'series';
        case 'movies':
          return t.kind === 'movie';
        case 'started':
          return started;
        case 'not-started':
          return !started;
        default:
          return true;
      }
    });
    if (sort === 'A - Z') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'Release Date') list = [...list].sort((a, b) => b.year - a.year);
    if (sort === 'Suggested') list = [...list].sort((a, b) => Number(!!b.imdbRating) - Number(!!a.imdbRating));
    return list;
  }, [profileData, filter, sort]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="My List"
        back
        left={
          <View style={styles.headerLeft}>
            <Txt weight="bold" size={18} style={{ flex: 1 }}>
              My List
            </Txt>
            {profileData.myList.length > 0 ? (
              <Pressable hitSlop={10} onPress={() => setEditing((e) => !e)}>
                <Txt weight="bold" size={15}>
                  {editing ? 'Done' : 'Edit'}
                </Txt>
              </Pressable>
            ) : null}
          </View>
        }
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filter !== 'all' ? <Chip icon="close" onPress={() => setFilter('all')} /> : null}
          {FILTERS.filter((f) => filter === 'all' || f.key === filter).map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
          <Chip label={sort} caret onPress={() => setSortOpen(true)} />
        </ScrollView>
      </View>

      {profileData.myList.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="add-circle-outline" size={64} color={colors.textDim} />
          <Txt weight="bold" size={20} align="center" style={{ marginTop: 16 }}>
            Your list is empty
          </Txt>
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 8, marginBottom: 24 }}>
            Add movies & TV shows to your list so you can easily find them later.
          </Txt>
          <Button label="Find Something to Watch" variant="white" onPress={() => navigation.navigate('Main', { screen: 'Home' })} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Txt weight="bold" size={20} align="center">
            Nothing came up
          </Txt>
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
            Try different filters to find what you’re looking for.
          </Txt>
        </View>
      ) : (
        <FlatList
          data={items}
          key={`grid-${lay.columns}`}
          numColumns={lay.columns}
          keyExtractor={(t) => t.id}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: lay.gutter }}
          contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View>
              <Poster title={item} width={cell} height={cell * 1.45} onPress={(t) => (editing ? undefined : navigation.navigate('Title', { id: t.id }))} />
              {editing ? (
                <Pressable
                  hitSlop={6}
                  style={styles.remove}
                  onPress={() => {
                    toggleMyList(item.id);
                    showToast('Removed from your list');
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Txt weight="bold" size={16} style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
          Sort by
        </Txt>
        {SORTS.map((s) => (
          <SheetItem
            key={s}
            label={s}
            icon={s === sort ? 'checkmark' : 'ellipse-outline'}
            onPress={() => {
              setSort(s);
              setSortOpen(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chips: { gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 80 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
