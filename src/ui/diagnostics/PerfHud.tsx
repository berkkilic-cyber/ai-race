import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { noteOverlayCommit, startPerfSampling, stopPerfSampling, takePerfSnapshot, type PerfSnapshot } from './perfStats';

/** How often the readout refreshes (one small render each time, left out of the commit rate). */
const REFRESH_MS = 1000;

const ms = (n: number) => (Number.isFinite(n) ? (n < 10 ? n.toFixed(1) : String(Math.round(n))) : '-');

/**
 * A small performance readout for a phone: JS frame rate, slowest JS frame in the last
 * 5 s, React commits per second, the last tick's cost (engine step in brackets, worst in
 * the last second after the slash) and, on web, SVG elements on the page. Shown with the
 * debug overlay (long-press the mascot or the build stamp for 2 s); while it is mounted a
 * requestAnimationFrame loop counts frames and it renders once a second. Takes no touches.
 * Reading the numbers: docs/PERF.md.
 */
export function PerfHud() {
  const [snap, setSnap] = useState<PerfSnapshot | null>(null);
  useEffect(() => {
    startPerfSampling();
    takePerfSnapshot();
    const timer = setInterval(() => setSnap(takePerfSnapshot()), REFRESH_MS);
    return () => {
      clearInterval(timer);
      stopPerfSampling();
    };
  }, []);
  noteOverlayCommit();
  const parts = snap
    ? [
        `${t('ui.debug.perf.fps')} ${Math.round(snap.fps)}`,
        `${t('ui.debug.perf.slowest')} ${ms(snap.slowestMs)}`,
        `${t('ui.debug.perf.commits')} ${snap.commitsPerSec === null ? '-' : ms(snap.commitsPerSec)}`,
        `${t('ui.debug.perf.tick')} ${ms(snap.tickMs)} (${ms(snap.stepMs)}) / ${ms(snap.maxTickMs)}`,
        ...(snap.svg !== null ? [`${t('ui.debug.perf.svg')} ${snap.svg}`] : []),
      ]
    : [t('ui.debug.perf.waiting')];
  return (
    <View style={styles.box} pointerEvents="none" testID="perf-hud">
      <Text style={styles.line} numberOfLines={1}>
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignSelf: 'flex-start', marginTop: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: radius.s, backgroundColor: colors.scrim },
  line: { color: colors.newsPaper, fontSize: type.xs, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
