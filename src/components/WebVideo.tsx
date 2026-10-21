// HTML5 <video> with hls.js for adaptive streams. Everything that needs headers, CORS or https goes through the
// proxy (see services/proxy.ts); plain https files that need nothing are played directly to save proxy bandwidth.
import Hls from 'hls.js';
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { needsProxy, proxied } from '../services/proxy';

export interface WebSource {
  url: string;
  headers?: Record<string, string>;
  hls: boolean;
}

export interface TrackInfo {
  id: number;
  label: string;
}

export interface WebVideoHandle {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setAudioTrack: (id: number) => void;
  setSubtitleTrack: (id: number) => void;
  toggleFullscreen: () => void;
}

interface Props {
  source: WebSource | null;
  fit: 'contain' | 'cover' | 'fill';
  rate: number;
  volume: number;
  muted: boolean;
  /** Seek here as soon as the stream is ready (resume / server switch). */
  startAt: number;
  onReady: (duration: number) => void;
  onTime: (time: number, buffered: number, duration: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onBuffering: (buffering: boolean) => void;
  onEnded: () => void;
  onError: (reason: string) => void;
  onTracks: (audio: TrackInfo[], subtitles: TrackInfo[]) => void;
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export const WebVideo = forwardRef<WebVideoHandle, Props>(function WebVideo(props, ref) {
  const video = useRef<HTMLVideoElement | null>(null);
  const hls = useRef<Hls | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    play: () => void video.current?.play().catch(() => undefined),
    pause: () => video.current?.pause(),
    seek: (t) => {
      if (video.current) video.current.currentTime = Math.max(0, t);
    },
    setAudioTrack: (id) => {
      if (hls.current) hls.current.audioTrack = id;
    },
    setSubtitleTrack: (id) => {
      if (hls.current) hls.current.subtitleTrack = id;
    },
    toggleFullscreen: () => {
      const v = video.current as FullscreenVideo | null;
      if (!v) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
      } else {
        v.webkitEnterFullscreen?.();
      }
    },
  }));

  // Load / replace the source.
  useEffect(() => {
    const el = video.current;
    const { source } = props;
    if (!el) return;
    hls.current?.destroy();
    hls.current = null;
    el.removeAttribute('src');
    el.load();
    if (!source) return;

    const startAt = latest.current.startAt;
    const onMeta = () => {
      if (startAt > 2) el.currentTime = startAt;
      latest.current.onReady(el.duration);
      void el.play().catch(() => latest.current.onPlayingChange(false));
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });

    if (source.hls) {
      if (Hls.isSupported()) {
        const instance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 40,
          // Every request (manifest, keys, segments) goes through the proxy; the manifest URL itself stays original,
          // so relative segment URLs resolve against the real server.
          xhrSetup: (xhr, url) => {
            xhr.open('GET', proxied(url, source.headers, { media: true }), true);
          },
        });
        hls.current = instance;
        instance.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) instance.recoverMediaError();
          else latest.current.onError(`HLS ${data.details}`);
        });
        const tracks = () =>
          latest.current.onTracks(
            instance.audioTracks.map((t, i) => ({ id: i, label: t.name || t.lang || `Track ${i + 1}` })),
            instance.subtitleTracks.map((t, i) => ({ id: i, label: t.name || t.lang || `Track ${i + 1}` })),
          );
        instance.on(Hls.Events.AUDIO_TRACKS_UPDATED, tracks);
        instance.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, tracks);
        instance.loadSource(source.url);
        instance.attachMedia(el);
      } else {
        // Safari without MSE (older iPhones) plays HLS natively; the proxy rewrites the playlist for it.
        el.src = proxied(source.url, source.headers, { media: true, rewrite: true });
      }
    } else {
      el.src = needsProxy(source.url, source.headers) ? proxied(source.url, source.headers, { media: true }) : source.url;
    }
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      hls.current?.destroy();
      hls.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.source?.url, props.source?.hls]);

  useEffect(() => {
    if (video.current) video.current.playbackRate = props.rate;
  }, [props.rate]);
  useEffect(() => {
    if (video.current) {
      video.current.volume = Math.max(0, Math.min(1, props.volume));
      video.current.muted = props.muted;
    }
  }, [props.volume, props.muted]);

  const emitTime = () => {
    const el = video.current;
    if (!el) return;
    const ranges = el.buffered;
    const buffered = ranges.length > 0 ? ranges.end(ranges.length - 1) : 0;
    latest.current.onTime(el.currentTime, buffered, el.duration);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={video}
        playsInline
        preload="auto"
        style={{ width: '100%', height: '100%', objectFit: props.fit === 'fill' ? 'fill' : props.fit, backgroundColor: '#000' }}
        onTimeUpdate={emitTime}
        onDurationChange={emitTime}
        onProgress={emitTime}
        onPlay={() => latest.current.onPlayingChange(true)}
        onPause={() => latest.current.onPlayingChange(false)}
        onWaiting={() => latest.current.onBuffering(true)}
        onPlaying={() => latest.current.onBuffering(false)}
        onCanPlay={() => latest.current.onBuffering(false)}
        onEnded={() => latest.current.onEnded()}
        onError={() => {
          if (!hls.current && latest.current.source) latest.current.onError('Playback error');
        }}
      />
    </View>
  );
});
