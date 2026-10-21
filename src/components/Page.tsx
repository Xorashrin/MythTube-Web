// Centers page content on wide screens so lines and hero images stay a readable size.
import React from 'react';
import { View } from 'react-native';

export function Page({ children, max = 960 }: { children: React.ReactNode; max?: number }) {
  return <View style={{ flex: 1, width: '100%', maxWidth: max, alignSelf: 'center' }}>{children}</View>;
}
