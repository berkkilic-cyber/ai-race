import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { buyQuote, generatorRows } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { buyHaptic } from './haptics';
import { useGarage } from './hooks';
import { useGarageStore, type BuyMode, type GarageStore } from './store';
import { fmt, generationLabel, gt } from './text';

interface Row {
  id: string;
  icon: string;
  name: string;
  desc: string;
  owned: number;
  revealed: boolean;
  unlocked: boolean;
  unlockGeneration: number;
  count: number;
  cost: string;
  affordable: boolean;
  rate: string;
}

/** The rows as displayed; the list re-renders only when this text changes. */
function rowsOf(s: GarageStore): Row[] {
  const st = s.state;
  if (!st) return [];
  return generatorRows(st, s.content).map((r) => {
    const q = buyQuote(st, r.def, s.buyMode);
    return {
      id: r.def.id,
      icon: r.def.icon,
      name: gt(r.def.nameKey),
      desc: gt(r.def.descKey),
      owned: r.owned,
      revealed: r.revealed,
      unlocked: r.unlocked,
      unlockGeneration: r.def.unlockGeneration,
      count: q.count,
      cost: fmt(q.cost),
      affordable: st.tokens >= q.cost,
      rate: fmt(r.rate),
    };
  });
}
const keyRows = (rows: Row[]) => rows.map((r) => `${r.id}:${r.owned}:${r.revealed ? 1 : 0}:${r.count}:${r.cost}:${r.affordable ? 1 : 0}:${r.rate}`).join('|');

/** The generator list: owned tiers and the next to buy in full, then a teaser and the next locked tier. */
export const GeneratorList = memo(function GeneratorList() {
  const rows = useGarage(rowsOf, keyRows);
  return (
    <View style={styles.list} testID="garage-generators">
      {rows.map((r) => (r.revealed ? <GeneratorRow key={r.id} row={r} /> : <TeaserRow key={r.id} row={r} />))}
    </View>
  );
});

function GeneratorRow({ row }: { row: Row }) {
  const press = () => {
    if (useGarageStore.getState().buy(row.id)) buyHaptic();
  };
  return (
    <View style={styles.row} testID={`gen-${row.id}`}>
      <View style={styles.iconBox}>
        <Icon name={row.icon} size={26} color={colors.text} accent={colors.player} />
        {row.owned > 0 ? (
          <Text style={styles.owned} numberOfLines={1}>
            {row.owned}
          </Text>
        ) : null}
      </View>
      <View style={styles.texts}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.owned > 0 ? t('ui.garage.rowRate', { amount: row.rate }) : row.desc}
        </Text>
      </View>
      <Pressable
        onPress={press}
        disabled={!row.affordable}
        accessibilityRole="button"
        accessibilityLabel={`${row.name} ${t('ui.garage.buyCount', { count: row.count })}, ${row.cost}`}
        accessibilityState={{ disabled: !row.affordable }}
        style={({ pressed }) => [styles.buy, row.affordable ? styles.buyOn : styles.buyOff, pressed && styles.pressed]}
        testID={`buy-${row.id}`}
      >
        <Text style={[styles.buyCount, row.affordable ? styles.onAccent : styles.dim]}>{t('ui.garage.buyCount', { count: row.count })}</Text>
        <View style={styles.costRow}>
          <Icon name="speech" size={12} color={row.affordable ? colors.onPlayer : colors.dim} />
          <Text style={[styles.cost, row.affordable ? styles.onAccent : styles.dim]} numberOfLines={1}>
            {row.cost}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function TeaserRow({ row }: { row: Row }) {
  return (
    <View style={[styles.row, styles.teaser]} testID={`gen-${row.id}`}>
      <View style={styles.iconBox}>
        <Icon name="lock" size={22} color={colors.dim} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.name, styles.dim]} numberOfLines={1}>
          {row.unlocked ? t('ui.garage.teaser') : row.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.unlocked ? t('ui.garage.teaserHint') : t('ui.garage.locked', { model: generationLabel(row.unlockGeneration) })}
        </Text>
      </View>
    </View>
  );
}

const BUY_MODES: BuyMode[] = [1, 10, 'max'];

/** x1 / x10 / Max. */
export function BuyModeToggle() {
  const mode = useGarageStore((s) => s.buyMode);
  const set = useGarageStore((s) => s.setBuyMode);
  return (
    <View style={styles.modes} accessibilityRole="radiogroup">
      {BUY_MODES.map((m) => {
        const label = m === 'max' ? t('ui.garage.buy.max') : m === 10 ? t('ui.garage.buy.x10') : t('ui.garage.buy.x1');
        const on = m === mode;
        return (
          <Pressable
            key={String(m)}
            onPress={() => set(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('ui.garage.buy.label', { mode: label })}
            hitSlop={5}
            style={[styles.mode, on && styles.modeOn]}
            testID={`buymode-${m}`}
          >
            <Text style={[styles.modeText, on && styles.modeTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: 54,
    paddingLeft: spacing.s,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
  },
  teaser: { backgroundColor: colors.transparent, borderStyle: 'dashed' },
  iconBox: { width: 36, alignItems: 'center' },
  owned: { ...voice.calmNumber, ...tabular, fontSize: type.xs, color: colors.playerText, marginTop: -2 },
  texts: { flex: 1, minWidth: 0 },
  name: { ...voice.bodyStrong, color: colors.text, fontSize: type.s + 1 },
  meta: { ...voice.body, ...tabular, color: colors.dim, fontSize: type.xs + 1 },
  dim: { color: colors.dim },
  onAccent: { color: colors.onPlayer },
  buy: {
    minWidth: 88,
    minHeight: touch,
    paddingHorizontal: spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    borderWidth: shape.panel === 'plain' ? 0 : shape.outline,
  },
  buyOn: { backgroundColor: colors.player, borderColor: shape.panel === 'sticker' ? colors.outline : colors.player, ...flatShadow() },
  buyOff: { backgroundColor: colors.transparent, borderColor: colors.dim, borderStyle: 'dashed', borderWidth: shape.panel === 'plain' ? 1 : shape.outline },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  buyCount: { ...voice.bodyStrong, fontSize: type.xs + 1 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cost: { ...voice.calmNumber, ...tabular, fontSize: type.s },
  modes: { flexDirection: 'row', borderWidth: shape.hairline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border, borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s, overflow: 'hidden' },
  mode: { minWidth: 44, minHeight: 34, paddingHorizontal: spacing.s, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.text },
  modeText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  modeTextOn: { color: colors.bg },
});
