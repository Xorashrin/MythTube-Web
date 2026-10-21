// Thin wrapper over React Native's Image (Fresco: memory + disk cache on Android) that keeps the
// props the app already uses, so no extra image library has to ship in the APK.
import React from 'react';
import { Image as RNImage, type ImageProps, type ImageResizeMode, type ImageSourcePropType } from 'react-native';

type Fit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

interface Props extends Omit<ImageProps, 'source' | 'resizeMode'> {
  source?: ImageSourcePropType | string | null;
  contentFit?: Fit;
  /** Fade-in duration in ms. */
  transition?: number;
  cachePolicy?: string;
  recyclingKey?: string;
}

const MODES: Record<Fit, ImageResizeMode> = { cover: 'cover', contain: 'contain', fill: 'stretch', none: 'center', 'scale-down': 'contain' };

export function Image({ source, contentFit = 'cover', transition = 0, cachePolicy: _cache, recyclingKey: _key, ...rest }: Props) {
  const src = typeof source === 'string' ? { uri: source } : source;
  if (!src) return null;
  return <RNImage {...rest} source={src} resizeMode={MODES[contentFit]} fadeDuration={transition} />;
}
