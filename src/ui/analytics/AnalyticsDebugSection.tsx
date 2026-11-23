import { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { analyticsErrors, type FunnelRow, type RetentionReport, type TrackedEvent } from '@/analytics';

import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { usePoll, useTouchDebugOn } from '../map/touchDebug';
import { colors, layer, radius, spacing, touch, type } from '../theme';
import { getAnalyticsRuntime } from './install';

/** Events listed in the section. */
export const DEBUG_EVENT_COUNT = 30;
const POLL_MS = 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function fmtSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "14:03:22 node_buy nodeId=x kind=capability" (local clock time). */
export function eventLine(e: TrackedEvent): string {
  const d = new Date(e.t);
  const params = Object.entries(e.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${e.name}${params ? ` ${params}` : ''}`;
}

const flag = (v: boolean | null) => t(v === null ? 'ui.analytics.ahead' : v ? 'ui.analytics.yes' : 'ui.analytics.no');

/** The summary lines of the section (pure, tested). */
export function summaryLines(r: RetentionReport, stored: number, writes: number, errors: number): string[] {
  return [
    t('ui.analytics.install', { id: r.installId, day: r.dayIndex }),
    t('ui.analytics.sessions', { today: r.sessionsToday, total: r.sessions, perDay: r.sessionsPerDay }),
    t('ui.analytics.length', { now: fmtSeconds(r.currentSessionSeconds), avg: fmtSeconds(r.avgSessionSeconds) }),
    t('ui.analytics.returned', { d1: flag(r.returned[1]), d7: flag(r.returned[7]), d30: flag(r.returned[30]) }),
    t('ui.analytics.stored', { count: stored, writes, errors }),
  ];
}

const funnelLine = (row: FunnelRow) => `${t(`ui.analytics.funnel.${row.step}`)}  ${row.sinceInstall === null ? t('ui.analytics.notYet') : `+${fmtSeconds(row.sinceInstall)}`}`;

/** Clipboard on web (no new dependency); the system share sheet on native. */
async function exportLog(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (s: string) => Promise<void> } } }).navigator;
    if (!nav?.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  }
  await Share.share({ message: text });
  return true;
}

/**
 * The debug overlay's Analytics section (long-press the mascot or the build stamp for two
 * seconds): this install's day index, sessions, D1/D7/D30, the first-run funnel with times
 * and the last 30 events, with Copy log. Polls once a second while shown; renders nothing
 * while the overlay is off.
 */
export function AnalyticsDebugSection() {
  const on = useTouchDebugOn();
  if (!on) return null;
  return <Section />;
}

function Section() {
  usePoll(true, POLL_MS);
  const insets = useInsets();
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const rt = getAnalyticsRuntime();
  const report = rt?.session.report() ?? null;
  const events = rt ? rt.buffer.events.slice(-DEBUG_EVENT_COUNT).reverse() : [];
  const copy = () => {
    if (!rt) return;
    exportLog(rt.buffer.toText())
      .then((ok) => setCopied(ok ? 'ok' : 'fail'))
      .catch(() => setCopied('fail'));
  };
  return (
    <View style={[styles.panel, { right: insets.right + spacing.s, top: insets.top + spacing.s, bottom: open ? insets.bottom + spacing.s : undefined }]} testID="analytics-debug">
      <View style={styles.head}>
        <Text style={styles.title}>{t('ui.analytics.title')}</Text>
        {open ? (
          <Pressable onPress={copy} style={styles.btn} accessibilityRole="button" testID="analytics-copy">
            <Text style={styles.btnText}>{copied === 'ok' ? t('ui.analytics.copied') : copied === 'fail' ? t('ui.analytics.copyFailed') : t(Platform.OS === 'web' ? 'ui.analytics.copy' : 'ui.analytics.share')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => setOpen(!open)} style={styles.btn} accessibilityRole="button" testID="analytics-toggle">
          <Text style={styles.btnText}>{t(open ? 'ui.analytics.hide' : 'ui.analytics.show')}</Text>
        </Pressable>
      </View>
      {open ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          {report && rt ? (
            <>
              {summaryLines(report, rt.buffer.events.length, rt.buffer.writes + rt.session.writes(), analyticsErrors()).map((line, i) => (
                <Text key={i} style={styles.line} numberOfLines={1}>
                  {line}
                </Text>
              ))}
              <Text style={styles.sub}>{t('ui.analytics.funnel')}</Text>
              {report.funnel.map((row) => (
                <Text key={row.step} style={[styles.line, row.at === null && styles.dim]} numberOfLines={1}>
                  {funnelLine(row)}
                </Text>
              ))}
            </>
          ) : (
            <Text style={styles.line}>{t('ui.analytics.loading')}</Text>
          )}
          <Text style={styles.sub}>{t('ui.analytics.last', { count: DEBUG_EVENT_COUNT })}</Text>
          {events.length ? (
            events.map((e, i) => (
              <Text key={`${e.t}-${i}`} style={styles.event} numberOfLines={1}>
                {eventLine(e)}
              </Text>
            ))
          ) : (
            <Text style={[styles.line, styles.dim]}>{t('ui.analytics.none')}</Text>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    width: 340,
    maxWidth: '60%',
    padding: spacing.s,
    gap: spacing.xs,
    borderRadius: radius.s,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    zIndex: layer.error - 1,
    elevation: layer.error - 1,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  title: { flex: 1, color: colors.text, fontSize: type.s, fontWeight: '700' },
  btn: { minHeight: touch, paddingHorizontal: spacing.s, justifyContent: 'center', borderRadius: radius.s, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  btnText: { color: colors.text, fontSize: type.xs },
  scroll: { flexGrow: 0 },
  body: { gap: 2 },
  sub: { color: colors.dim, fontSize: type.xs, fontWeight: '700', marginTop: spacing.xs },
  line: { color: colors.text, fontSize: type.xs, lineHeight: 14, fontVariant: ['tabular-nums'] },
  dim: { color: colors.dim },
  event: { color: colors.text, fontSize: type.xs, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
