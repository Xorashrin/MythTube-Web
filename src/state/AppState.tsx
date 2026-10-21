import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';

import { MAIN_PROFILE_ID, PROFILE_COLOR, type Profile } from '../data/types';
import { setAvailabilityChecks } from '../services/availabilityStore';
import { loadSavedTitles, saveTitles } from '../services/catalog';
import { setDataSaver, setPreferredLanguage } from '../services/playback';

export type Rating = 'down' | 'up' | 'love';

export interface ProgressEntry {
  titleId: string;
  episodeId?: string;
  position: number;
  duration: number;
  updatedAt: number;
}

export interface ProfileData {
  myList: string[];
  ratings: Record<string, Rating>;
  reminders: string[];
  progress: ProgressEntry[];
}

export type VideoQuality = 'auto' | '1080p' | '720p' | '480p';

export interface Settings {
  autoplayNext: boolean;
  doubleTapSeek: boolean;
  defaultStreamingQuality: VideoQuality;
  preferredLanguage: string;
  /** Mobile-data friendly: no background source checks or pre-warming, 720p cap while streaming. */
  dataSaver: boolean;
}

interface State {
  hydrated: boolean;
  creditSeen: boolean;
  profiles: Profile[];
  activeProfileId: string;
  data: ProfileData;
  settings: Settings;
  toast: { id: number; message: string } | null;
}

type Action =
  | { type: 'HYDRATE'; saved: Partial<State> | null }
  | { type: 'CREDIT_SEEN' }
  | { type: 'TOGGLE_MY_LIST'; id: string }
  | { type: 'RATE'; id: string; rating: Rating | null }
  | { type: 'TOGGLE_REMINDER'; id: string }
  | { type: 'SET_PROGRESS'; entry: ProgressEntry }
  | { type: 'REMOVE_PROGRESS'; titleId: string }
  | { type: 'TOGGLE_SETTING'; key: keyof Settings }
  | { type: 'SET_SETTING'; key: keyof Settings; value: Settings[keyof Settings] }
  | { type: 'TOAST'; message: string }
  | { type: 'CLEAR_TOAST'; id: number };

const STORAGE_KEY = 'mythtube-web:v1';

const defaultSettings: Settings = {
  autoplayNext: true,
  doubleTapSeek: true,
  defaultStreamingQuality: 'auto',
  preferredLanguage: 'English',
  dataSaver: false,
};

const initialState: State = {
  hydrated: false,
  creditSeen: false,
  profiles: [{ id: MAIN_PROFILE_ID, name: 'You', color: PROFILE_COLOR }],
  activeProfileId: MAIN_PROFILE_ID,
  data: { myList: [], ratings: {}, reminders: [], progress: [] },
  settings: defaultSettings,
  toast: null,
};

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]);

function withData(state: State, fn: (d: ProfileData) => ProfileData): State {
  return { ...state, data: fn(state.data) };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE': {
      const saved = action.saved ?? {};
      return {
        ...state,
        ...saved,
        data: { ...state.data, ...(saved.data ?? {}) },
        settings: { ...defaultSettings, ...(saved.settings ?? {}) },
        toast: null,
        hydrated: true,
      };
    }
    case 'CREDIT_SEEN':
      return { ...state, creditSeen: true };
    case 'TOGGLE_MY_LIST':
      return withData(state, (d) => ({ ...d, myList: toggle(d.myList, action.id) }));
    case 'RATE':
      return withData(state, (d) => {
        const ratings = { ...d.ratings };
        if (action.rating) ratings[action.id] = action.rating;
        else delete ratings[action.id];
        return { ...d, ratings };
      });
    case 'TOGGLE_REMINDER':
      return withData(state, (d) => ({ ...d, reminders: toggle(d.reminders, action.id) }));
    case 'SET_PROGRESS':
      return withData(state, (d) => ({ ...d, progress: [action.entry, ...d.progress.filter((p) => p.titleId !== action.entry.titleId)].slice(0, 60) }));
    case 'REMOVE_PROGRESS':
      return withData(state, (d) => ({ ...d, progress: d.progress.filter((p) => p.titleId !== action.titleId) }));
    case 'TOGGLE_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: !state.settings[action.key] } };
    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case 'TOAST':
      return { ...state, toast: { id: Date.now(), message: action.message } };
    case 'CLEAR_TOAST':
      return state.toast?.id === action.id ? { ...state, toast: null } : state;
    default:
      return state;
  }
}

interface AppContextValue {
  state: State;
  activeProfile: Profile;
  profileData: ProfileData;
  markCreditSeen: () => void;
  toggleMyList: (id: string) => void;
  rate: (id: string, rating: Rating | null) => void;
  toggleReminder: (id: string) => void;
  setProgress: (entry: ProgressEntry) => void;
  removeProgress: (titleId: string) => void;
  toggleSetting: (key: keyof Settings) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  showToast: (message: string) => void;
  clearToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    loadSavedTitles()
      .then(() => AsyncStorage.getItem(STORAGE_KEY))
      .then((raw) => dispatch({ type: 'HYDRATE', saved: raw ? (JSON.parse(raw) as Partial<State>) : null }))
      .catch(() => dispatch({ type: 'HYDRATE', saved: null }));
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { creditSeen, data, settings } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ creditSeen, data, settings })).catch(() => undefined);
    saveTitles([...data.myList, ...Object.keys(data.ratings), ...data.reminders, ...data.progress.map((p) => p.titleId)]);
  }, [state]);

  useEffect(() => {
    setPreferredLanguage(state.settings.preferredLanguage);
  }, [state.settings.preferredLanguage]);

  useEffect(() => {
    setDataSaver(state.settings.dataSaver);
    setAvailabilityChecks(!state.settings.dataSaver);
  }, [state.settings.dataSaver]);

  const showToast = useCallback((message: string) => dispatch({ type: 'TOAST', message }), []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      activeProfile: state.profiles[0],
      profileData: state.data,
      markCreditSeen: () => dispatch({ type: 'CREDIT_SEEN' }),
      toggleMyList: (id) => dispatch({ type: 'TOGGLE_MY_LIST', id }),
      rate: (id, rating) => dispatch({ type: 'RATE', id, rating }),
      toggleReminder: (id) => dispatch({ type: 'TOGGLE_REMINDER', id }),
      setProgress: (entry) => dispatch({ type: 'SET_PROGRESS', entry }),
      removeProgress: (titleId) => dispatch({ type: 'REMOVE_PROGRESS', titleId }),
      toggleSetting: (key) => dispatch({ type: 'TOGGLE_SETTING', key }),
      setSetting: (key, value) => dispatch({ type: 'SET_SETTING', key, value }),
      showToast,
      clearToast: (id) => dispatch({ type: 'CLEAR_TOAST', id }),
    }),
    [state, showToast],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}

export function progressFor(data: ProfileData, titleId: string): ProgressEntry | undefined {
  return data.progress.find((p) => p.titleId === titleId);
}
