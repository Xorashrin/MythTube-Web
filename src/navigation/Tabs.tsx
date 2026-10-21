import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { CreditPopup } from '../components/CreditPopup';
import HomeScreen from '../screens/HomeScreen';
import MyNetflixScreen from '../screens/MyNetflixScreen';
import AnimeScreen from '../screens/AnimeScreen';
import TvScreen from '../screens/TvScreen';
import { useApp } from '../state/AppState';
import { colors, font } from '../theme/tokens';
import { SIDEBAR_WIDTH, useLayout } from '../theme/useLayout';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

function ProfileTabIcon({ focused }: { focused: boolean }) {
  const { activeProfile } = useApp();
  if (!activeProfile) return <Ionicons name="person-circle-outline" size={26} color={focused ? colors.text : colors.textDim} />;
  return (
    <View style={{ padding: 1.5, borderRadius: 5, borderWidth: 1.5, borderColor: focused ? colors.text : 'transparent' }}>
      <Avatar profile={activeProfile} size={22} radius={3} />
    </View>
  );
}

export function Tabs() {
  const { wide } = useLayout();
  return (
    <>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarStyle: wide
          ? { backgroundColor: '#0b0b0b', borderRightWidth: 0, width: SIDEBAR_WIDTH, paddingTop: 20 }
          : { backgroundColor: 'rgba(0,0,0,0.97)', borderTopWidth: 0, elevation: 0 },
        tabBarLabelStyle: wide ? { fontFamily: font.medium, fontSize: 15 } : { fontFamily: font.medium, fontSize: 10 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} /> }}
      />
      <Tab.Screen
        name="TV"
        component={TvScreen}
        options={{ tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'tv' : 'tv-outline'} size={25} color={color} /> }}
      />
      <Tab.Screen
        name="Anime"
        component={AnimeScreen}
        options={{ tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={color} /> }}
      />
      <Tab.Screen
        name="MyNetflix"
        component={MyNetflixScreen}
        options={{ title: 'My MythTube', tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} /> }}
      />
    </Tab.Navigator>
    <CreditPopup />
    </>
  );
}
