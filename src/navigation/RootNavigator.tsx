import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import AdultContentScreen from '../screens/AdultContentScreen';
import AppSettingsScreen from '../screens/AppSettingsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import LivePlayerScreen from '../screens/LivePlayerScreen';
import MyListScreen from '../screens/MyListScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import PlayerScreen from '../screens/PlayerScreen';
import SearchScreen from '../screens/SearchScreen';
import SplashScreen from '../screens/SplashScreen';
import TitleScreen from '../screens/TitleScreen';
import { colors } from '../theme/tokens';
import { Tabs } from './Tabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// No sign-in, sign-up or profile screens on the web: the app opens straight into the catalog.
export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 180,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Main" component={Tabs} />
      <Stack.Screen name="Title" component={TitleScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} />
      <Stack.Screen name="Live" component={LivePlayerScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="MyList" component={MyListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
      <Stack.Screen name="AdultContent" component={AdultContentScreen} />
    </Stack.Navigator>
  );
}
