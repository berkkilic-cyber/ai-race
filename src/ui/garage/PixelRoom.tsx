import { memo } from 'react';
import { Image, Platform, StyleSheet, View, type ImageSourcePropType, type ImageStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { allFinite } from '../map/svgSafe';
import { useAmbientClock } from '../motion/ambient';
import { colors } from '../theme';
import { DP_PER_PIXEL as DP, PIXEL_SCENES, ROOM_BANDS, ROOM_H, ROOM_W, type ArtLayer, type ArtScene } from './art/manifest';
import type { PixelLevels } from './pixelLevels';
import { stageColour } from './stageColors';

/**
 * The lab as a pixel-art room (the stages that have art: see scripts/pixel and the Art
 * section of docs/GARAGE.md). The room is one baked image; each generator tier is one
 * image at a fixed slot that changes with its count bucket; a few small loops (a bulb, a
 * mug's steam, typing, fans, LEDs) switch frames on the shared ambient clock in a worklet,
 * so nothing here re-renders while it animates.
 *
 * The art is drawn at DP_PER_PIXEL dp per art pixel, centred and anchored to the bottom
 * of the stage (the model's pedestal stands on the same floor at every size); bands in the
 * room's colours fill a stage that is wider or taller than the art.
 */

/** Web: keep the pixels hard if the browser ever scales an image (the files are already at display size). */
const PIXELATED = (Platform.OS === 'web' ? { imageRendering: 'pixelated' } : {}) as unknown as ImageStyle;

const px = (v: number) => v * DP;

/** One still image at its art position. */
function Still({ src, layer }: { src: ImageSourcePropType; layer: Pick<ArtLayer, 'x' | 'y' | 'w' | 'h'> }) {
  return <Image source={src} style={[{ position: 'absolute', left: px(layer.x), top: px(layer.y), width: px(layer.w), height: px(layer.h) }, PIXELATED]} />;
}

/**
 * A loop: the frames sit side by side in one image; a clipped window shows one at a time,
 * picked from the ambient clock on the UI thread. `phase` keeps loops out of step.
 */
const Loop = memo(function Loop({ src, layer, phase }: { src: ImageSourcePropType; layer: ArtLayer; phase: number }) {
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced && layer.frames > 1);
  const frames = layer.frames;
  const fps = layer.fps;
  const step = px(layer.w);
  const style = useAnimatedStyle(() => {
    const t = clock ? clock.get() : 0;
    const f = frames > 1 && fps > 0 && Number.isFinite(t) ? Math.floor(t * fps + phase) % frames : 0;
    return { transform: [{ translateX: -f * step }] };
  });
  const width = px(layer.w * frames);
  return (
    <View style={{ position: 'absolute', left: px(layer.x), top: px(layer.y), width: px(layer.w), height: px(layer.h), overflow: 'hidden' }}>
      <Animated.View style={[{ width, height: px(layer.h) }, style]}>
        <Image source={src} style={[{ width, height: px(layer.h) }, PIXELATED]} />
      </Animated.View>
    </View>
  );
});

function Layers({ art, levels }: { art: ArtScene; levels: PixelLevels }) {
  return (
    <>
      <Image source={art.room} style={[styles.room, PIXELATED]} />
      {art.order.map((id, i) => {
        const tier = art.tiers[id];
        const src = tier?.levels[Math.min(levels.tiers[tier.of] ?? 0, tier.levels.length - 1)];
        if (!tier || !src) return null;
        return tier.frames > 1 ? <Loop key={id} src={src} layer={tier} phase={i * 0.37} /> : <Still key={id} src={src} layer={tier} />;
      })}
      {art.shelf && art.shelf.levels[levels.shelf] ? <Still src={art.shelf.levels[levels.shelf] as ImageSourcePropType} layer={art.shelf} /> : null}
      {art.ambient.map((a, i) => (
        <Loop key={a.id} src={a.src} layer={a} phase={0.5 + i * 0.29} />
      ))}
    </>
  );
}

/** The whole pixel room behind the stage's controls. */
export const PixelRoom = memo(function PixelRoom({ scene, levels, w, h }: { scene: string; levels: PixelLevels; w: number; h: number }) {
  const art = PIXEL_SCENES[scene];
  if (!art || !allFinite(w, h) || w <= 0 || h <= 0) return null;
  const roomW = px(ROOM_W);
  const roomH = px(ROOM_H);
  // Whole dp so every art pixel lands on whole device pixels.
  const left = Math.round((w - roomW) / 2);
  const top = Math.round(h - roomH);
  const ceiling = stageColour(scene, 'n') ?? colors.chrome;
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, { backgroundColor: ceiling }]} pointerEvents="none" testID={`garage-room-${scene}`}>
      {/* Bands for a stage wider than the art: the wall and the floor run on. */}
      <View style={[styles.band, { top: top + px(ROOM_BANDS.ceiling), height: px(ROOM_BANDS.floor - ROOM_BANDS.ceiling), backgroundColor: stageColour(scene, 'w') ?? ceiling }]} />
      <View style={[styles.band, { top: top + px(ROOM_BANDS.floor), bottom: 0, backgroundColor: stageColour(scene, 'f') ?? ceiling }]} />
      <View style={{ position: 'absolute', left, top, width: roomW, height: roomH }}>
        <Layers art={art} levels={levels} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0 },
  room: { position: 'absolute', left: 0, top: 0, width: ROOM_W * DP, height: ROOM_H * DP },
});
