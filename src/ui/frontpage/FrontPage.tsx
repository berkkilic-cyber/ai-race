import { useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, type TextStyle } from 'react-native';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import type { ContentPack, GameState } from '@/engine';

import { trackFrontPageOpen } from '../analytics/daily';
import { mixColor } from '../color';
import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { regionFills } from '../map/mapColors';
import { MapShapes } from '../start/MapShapes';
import { useShare } from '../share/useShare';
import { colors, fonts, layer, spacing, type } from '../theme';
import { buildFrontPage, type FrontPage as FrontPageData } from './logic';
import type { RunStory } from './story';

/**
 * The end-of-run front page: a full-screen in-tree overlay (never a native Modal) laid out
 * like a newspaper, made to be screenshotted in landscape. The paper holds only the page;
 * Close, Share and the "Screenshot to share" hint sit outside it, so a screenshot of the
 * paper is clean. Type: the platform serif for the masthead and the stories (no font file
 * is added), the theme's heavy condensed news face for the headlines. Headlines keep their
 * written case: upper-casing would put Turkish dotted capitals into English lab names.
 */
export interface FrontPageProps {
  visible: boolean;
  state: GameState;
  pack: ContentPack;
  geometry: MapGeometry;
  story: RunStory | null;
  dailyNumber?: number;
  /** The share text (the same as the end screen's). */
  shareText: string;
  onClose: () => void;
}

/** The platform's own serif: Georgia on iOS and the web, Noto Serif ("serif") on Android. */
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", Times, serif' });
/** Newsprint: the theme's paper warmed a touch. */
const PAPER = mixColor(colors.newsPaper, colors.amber, 0.07);
const INK = colors.newsInk;
const RULE = colors.newsInk;
/** Width of the column with Close and Share beside the paper (wide). */
const RAIL = 116;

const finite = (v: number, d: number) => (Number.isFinite(v) && v > 0 ? v : d);

export function FrontPage({ visible, state, pack, geometry, story, dailyNumber, shareText, onClose }: FrontPageProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const { share, notice } = useShare();
  const page = useMemo(() => (visible ? buildFrontPage(state, pack, story, dailyNumber !== undefined ? { dailyNumber } : {}) : null), [visible, state, pack, story, dailyNumber]);
  useEffect(() => {
    if (visible) trackFrontPageOpen();
  }, [visible]);
  if (!visible || !page) return null;

  const wide = width > height && width >= 600;
  const paperW = finite(width - insets.left - insets.right - (wide ? RAIL + spacing.m * 3 : spacing.m * 2), 600);
  const paperH = finite(height - insets.top - insets.bottom - spacing.s * 2, 360);
  // Type scales with the paper: designed at 700 x 380 (926 x 428 with side insets).
  const s = Math.min(1.25, Math.max(0.78, Math.min(paperW / 700, paperH / 380)));

  const paper = <Paper page={page} state={state} geometry={geometry} s={s} />;
  const controls = (
    <View style={[styles.rail, !wide && styles.railNarrow]}>
      <Button label={t('ui.front.close')} variant="secondary" compact onPress={onClose} style={styles.railBtn} testID="frontpage-close" />
      <View style={styles.railMid}>
        <Button label={t('ui.front.share')} variant="primary" compact onPress={() => share(shareText, 'frontpage', 'frontpage')} style={styles.railBtn} testID="frontpage-share" />
        {notice ? (
          <Text style={styles.notice} testID="frontpage-notice">
            {t(notice === 'copied' ? 'ui.share.copied' : 'ui.share.failed')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.hint}>{t('ui.front.hint')}</Text>
    </View>
  );

  return (
    <Overlay visible layer={layer.event} onRequestClose={onClose} testID="frontpage">
      <View style={[styles.backdrop, { paddingTop: insets.top + spacing.s, paddingBottom: insets.bottom + spacing.s, paddingLeft: insets.left + spacing.m, paddingRight: insets.right + spacing.m }, !wide && styles.backdropNarrow]}>
        {wide ? (
          <>
            <View style={styles.paperBox}>{paper}</View>
            {controls}
          </>
        ) : (
          <>
            <ScrollView style={styles.paperBox} contentContainerStyle={styles.narrowScroll}>
              {paper}
            </ScrollView>
            {controls}
          </>
        )}
      </View>
    </Overlay>
  );
}

/** The paper itself: everything a screenshot should show and nothing else. */
function Paper({ page, state, geometry, s }: { page: FrontPageData; state: GameState; geometry: MapGeometry; s: number }) {
  const z = (n: number) => Math.round(n * s * 10) / 10;
  const headSize = z([46, 40, 34][page.headlineScale]);
  // Short papers (844 x 390 and smaller) get shorter stories and a shorter market box.
  const short = s < 0.9;
  // The lead story has the middle column, the second the right one above the market box.
  const [first, second] = page.stories;
  const marketRows = page.markets.slice(0, short ? 3 : 4);
  const me = page.markets.find((m) => m.player);
  if (me && !marketRows.includes(me)) marketRows[marketRows.length - 1] = me;
  const fills = useMemo(() => regionFills(state, Object.keys(geometry.regions)), [state, geometry]);
  const [, , vw, vh] = geometry.viewBox;
  const body: TextStyle = { fontFamily: SERIF, fontSize: z(11.5), lineHeight: z(15), color: INK };
  const head: TextStyle = { fontFamily: fonts.newsHeavy, fontWeight: fonts.newsHeavy ? undefined : '800', fontSize: z(18), lineHeight: z(19), color: INK };

  const storyEl = (st: (typeof page.stories)[number] | undefined, lines: number, testID: string, lead = false) =>
    st ? (
      <View style={styles.story} testID={testID}>
        <Text style={lead ? [head, { fontSize: z(23), lineHeight: z(23) }] : head} numberOfLines={lead ? 3 : 2}>
          {st.head}
        </Text>
        <Text style={lead ? [body, { fontSize: z(12.5), lineHeight: z(16.5) }] : body} numberOfLines={lines}>
          {st.body}
        </Text>
      </View>
    ) : null;

  return (
    <View style={[styles.paper, { padding: z(12) }]} testID="frontpage-paper">
      {/* Ears and masthead. */}
      <View style={styles.earRow}>
        <View style={styles.ear}>
          <Text style={[styles.earText, { fontSize: z(8.5) }]} numberOfLines={1}>
            {page.edition}
          </Text>
        </View>
        <Text style={[styles.motto, { fontSize: z(9.5) }]} numberOfLines={1}>
          {page.motto}
        </Text>
        <View style={styles.ear}>
          <Text style={[styles.earText, { fontSize: z(8.5) }]} numberOfLines={1}>
            {page.price}
          </Text>
        </View>
      </View>
      <Text style={[styles.masthead, { fontSize: z(36), lineHeight: z(40) }]} numberOfLines={1} adjustsFontSizeToFit testID="frontpage-masthead">
        {page.paper}
      </Text>
      <View style={styles.ruleThick} />
      <View style={styles.dateRow}>
        <Text style={[styles.dateText, { fontSize: z(9) }]} numberOfLines={1}>
          {page.day}
        </Text>
        <Text style={[styles.dateText, { fontSize: z(9) }]} numberOfLines={1}>
          {page.regionEdition}
        </Text>
      </View>
      <View style={styles.ruleThin} />

      <Text style={[styles.headline, { fontSize: headSize, lineHeight: Math.round(headSize * 0.98) }]} numberOfLines={3} testID="frontpage-headline">
        {page.headline}
      </Text>
      <Text style={[styles.sub, { fontSize: z(13.5), lineHeight: z(17) }]} numberOfLines={2}>
        {page.sub}
      </Text>
      <View style={styles.ruleHair} />
      {/* Three columns: the photo and the weather, the lead story, then the other two. */}
      <View style={styles.columns}>
        <View style={styles.photoCol}>
          <View style={styles.photo}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
              <MapShapes geometry={geometry} fills={fills} />
            </Svg>
          </View>
          <Text style={[styles.caption, { fontSize: z(8.5), lineHeight: z(11) }]} numberOfLines={2}>
            {page.caption}
          </Text>
          <View style={styles.weather} testID="frontpage-weather">
            <Text style={[styles.weatherTitle, { fontSize: z(9) }]}>{page.weatherTitle}</Text>
            {page.weather.map((w) => (
              <View key={w.meter} style={styles.weatherRow}>
                <Text style={[styles.weatherLabel, { fontSize: z(9.5) }]} numberOfLines={1}>
                  {w.label} {w.value}
                </Text>
                <Text style={[styles.weatherCast, { fontSize: z(9.5) }]} numberOfLines={1}>
                  {w.forecast}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.vrule} />
        <View style={styles.col}>{storyEl(first, short ? 7 : 9, 'frontpage-story-1', true)}</View>
        <View style={styles.vrule} />
        <View style={styles.col}>
          {storyEl(second, short ? 4 : 6, 'frontpage-story-2')}
          <View style={styles.flex} />
          <View style={styles.weather} testID="frontpage-markets">
            <Text style={[styles.weatherTitle, { fontSize: z(9) }]}>{page.marketsTitle}</Text>
            {marketRows.map((m, i) => (
              <View key={i} style={styles.weatherRow}>
                <Text style={[styles.marketName, m.player && styles.marketMe, m.out && styles.marketOut, { fontSize: z(9.5) }]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={[styles.weatherLabel, { fontSize: z(9.5) }]}>{m.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.ruleFoot} />
      <Text style={[styles.footer, { fontSize: z(8.5) }]} numberOfLines={1} testID="frontpage-footer">
        {page.footer}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: 'row', gap: spacing.m, backgroundColor: colors.bg },
  backdropNarrow: { flexDirection: 'column' },
  paperBox: { flex: 1 },
  narrowScroll: { flexGrow: 1 },
  paper: { flex: 1, backgroundColor: PAPER, shadowColor: colors.shadow, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  earRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  ear: { borderWidth: 1, borderColor: RULE, paddingHorizontal: 5, paddingVertical: 1, maxWidth: '30%' },
  earText: { fontFamily: SERIF, color: INK, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  motto: { flex: 1, fontFamily: SERIF, fontStyle: 'italic', color: colors.newsDim, textAlign: 'center' },
  masthead: { fontFamily: SERIF, fontWeight: '700', color: INK, textAlign: 'center', letterSpacing: -0.5, marginTop: 2 },
  ruleThick: { height: 3, backgroundColor: RULE, marginTop: 2 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s, paddingVertical: 2 },
  dateText: { fontFamily: SERIF, color: INK, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1 },
  ruleThin: { height: 1, backgroundColor: RULE, marginBottom: 6 },
  ruleFoot: { height: 1, backgroundColor: RULE, marginTop: 5 },
  footer: { fontFamily: SERIF, color: colors.newsDim, textAlign: 'center', letterSpacing: 0.6, marginTop: 2 },
  ruleHair: { height: StyleSheet.hairlineWidth, backgroundColor: RULE, marginVertical: 5 },
  columns: { flex: 1, flexDirection: 'row', gap: 9, minHeight: 0, overflow: 'hidden' },
  col: { flex: 1 },
  flex: { flex: 1, minHeight: 4 },
  vrule: { width: StyleSheet.hairlineWidth, backgroundColor: RULE },
  headline: { fontFamily: fonts.newsHeavy, fontWeight: fonts.newsHeavy ? undefined : '900', color: INK, letterSpacing: -0.3 },
  sub: { fontFamily: SERIF, fontStyle: 'italic', color: INK, marginTop: 3 },
  photoCol: { flex: 1.15, gap: 3 },
  photo: { flex: 1, minHeight: 40, width: '100%', backgroundColor: colors.newsInk, overflow: 'hidden' },
  caption: { fontFamily: SERIF, fontStyle: 'italic', color: colors.newsDim },
  story: { gap: 3 },
  weather: { borderWidth: 1, borderColor: RULE, padding: 5, gap: 2, marginTop: 3 },
  weatherTitle: { fontFamily: SERIF, fontWeight: '700', color: INK, textTransform: 'uppercase', letterSpacing: 0.8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: RULE, paddingBottom: 2, marginBottom: 1 },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weatherLabel: { fontFamily: SERIF, fontWeight: '700', color: INK, flexShrink: 1 },
  weatherCast: { fontFamily: SERIF, fontStyle: 'italic', color: INK, flexShrink: 1, textAlign: 'right' },
  marketName: { fontFamily: SERIF, color: INK, flexShrink: 1 },
  marketMe: { fontWeight: '700' },
  marketOut: { textDecorationLine: 'line-through', color: colors.newsDim },
  rail: { width: RAIL, justifyContent: 'space-between', gap: spacing.m },
  railNarrow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  railMid: { gap: spacing.s },
  railBtn: { minHeight: 44 },
  notice: { color: colors.goodText, fontSize: type.xs, textAlign: 'center' },
  hint: { color: colors.dim, fontSize: type.xs, textAlign: 'center' },
});
