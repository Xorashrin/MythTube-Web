import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme/tokens';
import { Txt } from './Txt';

interface State {
  failed: boolean;
  attempt: number;
}

/** Last line of defense: a render error shows a recovery screen instead of closing the app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Render error caught by ErrorBoundary', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <View style={styles.root}>
          <Txt weight="bold" size={20} align="center">Something went wrong</Txt>
          <Txt size={14} color={colors.textMuted} align="center" style={{ marginTop: 10 }}>
            The app recovered from an unexpected error. Your list, history and downloads are safe.
          </Txt>
          <Pressable onPress={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))} style={styles.button}>
            <Txt weight="bold" size={15} color="#000000">Try again</Txt>
          </Pressable>
        </View>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  button: { marginTop: 24, backgroundColor: colors.text, borderRadius: 6, paddingHorizontal: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
});
