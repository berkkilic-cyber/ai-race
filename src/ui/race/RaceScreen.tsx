import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pctText } from '../format';
import { Icon } from '../icons';
import { t } from '../i18n';
import { type GameStore } from '../store/game';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { PanelDeco } from '../components/Deco';
import { Bar } from './Bar';
import { raceView, sortRows, type RaceRow, type RaceSort, type RaceView, type WinBar } from './logic';
import { RivalSheet } from './RivalSheet';
import { shareSamples, useShareSampler } from './trend';
import { useTabStore } from '../shell/tabActive';

/** Formatted view as a string: the tab re-renders only when something it shows changes. */
const selectView = (s: GameStore): string => (s.state ? JSON.stringify(raceView(s.state, s.pack, shareSamples())) : '');

/**
 * Race tab: the three ways to win as progress bars, then one row per lab (colour, name,
 * home, world share and users, AGI, model tier, data centres and compute, status, trend).
 * Tapping a rival opens what it is good at and whether the player can buy it out now.
 */
export function RaceScreen() {
  useShareSampler();
  const json = useTabStore(selectView);
  const [sort, setSort] = useState<RaceSort>('share');
  const [rival, setRival] = useState<string | null>(null);
  const close = useCallback(() => setRival(null), []);
  if (!json) return null;
  const view = JSON.parse(json) as RaceView;
  const rows = sortRows(view.rows, sort);
  return (
    <View style={styles.root} testID="race-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>{t('ui.race.howToWin')}</Text>
        <View style={styles.wins}>
          {view.wins.map((win) => (
            <WinCard key={win.id} win={win} />
          ))}
        </View>
        <Text style={styles.lose}>{t('ui.race.lose')}</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.heading, styles.flex]}>{t('ui.race.standings')}</Text>
          <SortToggle sort={sort} onSort={setSort} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.table}>
            <HeaderRow />
            {rows.map((row) => (
              <StandingRowView key={row.labId} row={row} onPress={row.isPlayer ? undefined : () => setRival(row.labId)} />
            ))}
          </View>
        </ScrollView>
      </ScrollView>
      <RivalSheet labId={rival} onClose={close} />
    </View>
  );
}

function WinCard({ win }: { win: WinBar }) {
  return (
    <View style={styles.card} testID={`win-${win.id}`}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {win.title}
        </Text>
        <Text style={styles.cardValue}>{pctText(Math.floor(win.value * 100))}</Text>
      </View>
      <Bar value={win.value} color={colors.player} marker={win.rival} markerColor={win.rivalColor} height={8} />
      <Text style={styles.caption} numberOfLines={2}>
        {win.caption}
      </Text>
      {shape.panel === 'ticks' || shape.panel === 'bracket' ? <PanelDeco /> : null}
    </View>
  );
}

function SortToggle({ sort, onSort }: { sort: RaceSort; onSort: (s: RaceSort) => void }) {
  return (
    <View style={styles.toggle}>
      {(['share', 'you'] as const).map((s) => (
        <Pressable
          key={s}
          onPress={() => onSort(s)}
          hitSlop={6}
          style={[styles.toggleBtn, sort === s && styles.toggleOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: sort === s }}
          testID={`race-sort-${s}`}
        >
          <Text style={[styles.toggleText, sort === s && styles.toggleTextOn]}>{t(`ui.race.sort.${s}`)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const COL = { lab: 172, share: 140, agi: 104, model: 72, compute: 132, status: 104, trend: 26 } as const;

function HeaderRow() {
  return (
    <View style={[styles.row, styles.headRow]}>
      <Text style={[styles.colHead, { width: COL.lab }]}>{t('ui.race.col.lab')}</Text>
      <Text style={[styles.colHead, { width: COL.share }]}>{t('ui.race.col.share')}</Text>
      <Text style={[styles.colHead, { width: COL.agi }]}>{t('ui.race.col.agi')}</Text>
      <Text style={[styles.colHead, { width: COL.model }]}>{t('ui.race.col.model')}</Text>
      <Text style={[styles.colHead, { width: COL.compute }]} numberOfLines={2}>
        {t('ui.race.col.compute')}
      </Text>
      <Text style={[styles.colHead, { width: COL.status + COL.trend }]}>{t('ui.race.col.status')}</Text>
    </View>
  );
}

const TREND_GLYPH = { up: '▲', down: '▼', flat: '–' } as const;

function StandingRowView({ row, onPress }: { row: RaceRow; onPress?: () => void }) {
  const toneColor = row.statusTone === 'good' ? colors.goodText : row.statusTone === 'bad' ? colors.bad : colors.dim;
  const trendColor = row.trend === 'up' ? colors.goodText : row.trend === 'down' ? colors.bad : colors.dim;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, row.isPlayer && styles.mine, row.out && styles.out, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={t('ui.race.rowA11y', { lab: row.name, share: row.shareText, agi: row.agiText, status: row.statusText })}
      testID={`race-row-${row.labId}`}
    >
      <View style={[styles.cell, styles.labCell, { width: COL.lab }]}>
        <View style={[styles.swatch, { backgroundColor: row.color }]} />
        <View style={styles.flex}>
          <Text style={[styles.name, { color: row.isPlayer ? colors.playerText : row.textColor }]} numberOfLines={1}>
            {row.isPlayer ? `${row.name} (${t('ui.race.you')})` : row.name}
          </Text>
          <Text style={styles.small} numberOfLines={1}>
            {row.home}
          </Text>
        </View>
        {onPress ? <Icon name="info" size={14} color={colors.dim} /> : null}
      </View>
      <View style={[styles.cell, { width: COL.share }]}>
        <Text style={styles.num} numberOfLines={1}>
          {row.shareText}
          <Text style={styles.small}>{` · ${row.usersText}`}</Text>
        </Text>
        <Bar value={row.share} color={row.color} height={5} />
      </View>
      <View style={[styles.cell, { width: COL.agi }]}>
        <Text style={styles.num}>{row.agiText}</Text>
        <Bar value={row.agi} color={row.color} height={5} />
      </View>
      <View style={[styles.cell, { width: COL.model }]}>
        <Text style={styles.num}>{row.tierText}</Text>
        {row.ownedText ? <Text style={[styles.small, { color: colors.bad }]}>{row.ownedText}</Text> : null}
      </View>
      <View style={[styles.cell, styles.inline, { width: COL.compute }]}>
        <Icon name="datacentre" size={13} color={colors.dim} />
        <Text style={styles.num}>{row.dcText}</Text>
      </View>
      <View style={[styles.cell, { width: COL.status }]}>
        <Text style={[styles.status, { color: toneColor }]} numberOfLines={2}>
          {row.statusText}
        </Text>
      </View>
      <View style={[styles.cell, { width: COL.trend }]} accessibilityLabel={t(`ui.race.trend.${row.trend}`)}>
        <Text style={[styles.trend, { color: trendColor }]}>{TREND_GLYPH[row.trend]}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.m, paddingTop: spacing.s, gap: spacing.s },
  heading: { ...voice.calmHeading, color: colors.text, fontSize: shape.capsHeadings ? type.s : type.m },
  wins: { flexDirection: 'row', gap: spacing.s },
  card: {
    flex: 1,
    gap: 5,
    padding: spacing.s,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
    ...flatShadow(2),
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.s },
  cardTitle: { ...voice.bodyStrong, flex: 1, color: colors.text, fontSize: type.s },
  cardValue: { ...voice.calmNumber, color: colors.playerText, fontSize: type.m, ...tabular },
  caption: { ...voice.body, color: colors.dim, fontSize: type.xs, lineHeight: 14 },
  lose: { ...voice.body, color: colors.dim, fontSize: type.xs },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  tableScroll: { flexGrow: 1 },
  table: { flexGrow: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 6, borderWidth: shape.hairline, borderColor: colors.transparent, borderRadius: radius.s },
  headRow: { minHeight: 18 },
  mine: { borderColor: colors.player, backgroundColor: colors.surface },
  out: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  colHead: { ...voice.calmLabel, color: colors.dim, fontSize: 9.5, paddingRight: spacing.s },
  cell: { paddingRight: spacing.s, gap: 3, justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  labCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 24, borderRadius: radius.xs },
  name: { ...voice.bodyStrong, fontSize: type.s },
  small: { ...voice.body, color: colors.dim, fontSize: type.xs - 0.5 },
  num: { ...voice.calmNumber, color: colors.text, fontSize: type.s - 0.5, ...tabular },
  status: { ...voice.bodyStrong, fontSize: type.xs },
  trend: { fontSize: 11, textAlign: 'center' },
  toggle: { flexDirection: 'row', gap: 2 },
  toggleBtn: { minHeight: touch - 12, paddingHorizontal: spacing.s, justifyContent: 'center', borderWidth: shape.hairline, borderColor: colors.border, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.player, borderColor: colors.player },
  toggleText: { ...voice.calmLabel, color: colors.dim, fontSize: 10 },
  toggleTextOn: { color: colors.onPlayer },
});
