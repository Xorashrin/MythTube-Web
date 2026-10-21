import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PickerList } from '../components/ListItems';
import { GENRES } from '../data/types';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

const HOME = 'Home';

export default function CategoriesScreen({ navigation, route }: Props) {
  const current = route.params?.current ?? HOME;
  return (
    <View style={styles.root}>
      <PickerList
        options={[HOME, 'My List', '18+ Adult Content', ...GENRES]}
        selected={current}
        onClose={() => navigation.goBack()}
        onSelect={(value) => {
          if (value === 'My List') {
            navigation.goBack();
            navigation.navigate('MyList');
            return;
          }
          if (value === '18+ Adult Content') {
            navigation.goBack();
            navigation.navigate('AdultContent');
            return;
          }
          navigation.navigate('Main', { screen: 'Home', params: { genre: value === HOME ? undefined : value } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.overlay },
});
