import React from 'react';
import { Text, type TextProps } from 'react-native';

import { colors, font, type FontWeight } from '../theme/tokens';

export interface TxtProps extends TextProps {
  weight?: FontWeight;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  spacing?: number;
}

export function Txt({ weight = 'regular', size = 14, color = colors.text, align, lineHeight, spacing, style, ...rest }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        {
          fontFamily: font[weight],
          fontSize: size,
          color,
          textAlign: align,
          lineHeight: lineHeight ?? Math.round(size * 1.3),
          letterSpacing: spacing,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}
