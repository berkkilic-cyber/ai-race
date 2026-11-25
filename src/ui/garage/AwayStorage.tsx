import { memo } from 'react';
import { create } from 'zustand';
import { Pressable, StyleSheet, View } from 'react-native';

import { HOUR_MS, awayStorage, storageReachHours, upgradeDef, type GarageContent, type GarageState, type StorageNext, type StorageSource } from '@/idle';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { fmtHours } from '../format';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmtPct, fmtTime, generationLabel, gt } from './text';

/** Segments shown at most (one per hour). */
const MAX_SEGMENTS = 14;

export interface StorageBarProps {
  /** Capacity in hours (filled-in outline segments). */
  capHours: number;
  /** Segments drawn in all (the capacity the content can reach); at least capHours. */
  maxHours: number;
  /** 0..1 of the capacity filled (a return), or undefined for capacity only. */
  fill?: number;
  height?: number;
  testID?: string;
}

/**
 * The away-storage bar: one segment per hour. Segments within the capacity are outlined
 * (lit), the rest dim (storage still to earn). With `fill`, the earned part of the
 * capacity is solid: a full bar means the lab stopped earning.
 */
export function StorageBar({ capHours, maxHours, fill, height = 10, testID }: StorageBarProps) {
  const cap = Number.isFinite(capHours) ? Math.max(0, capHours) : 0;
  const total = Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(Math.max(cap, Number.isFinite(maxHours) ? maxHours : 0))));
  const f = fill === undefined || !Number.isFinite(fill) ? 0 : Math.max(0, Math.min(1, fill));
  const filledHours = f * cap;
  const segs = [];
  for (let i = 0; i < total; i++) {
    const inCap = i < cap;
    const part = Math.max(0, Math.min(1, filledHours - i));
    const full = f >= 1 && inCap;
    segs.push(
      <View key={i} style={[styles.seg, { height }, inCap ? styles.segCap : styles.segLocked]}>
        {part > 0 && inCap ? <View style={[styles.segFill, { width: `${Math.round(Math.min(part, cap - i) * 100)}%` }, full && styles.segFull]} /> : null}
      </View>,
    );
  }
  return (
    <View style={styles.bar} testID={testID}>
      {segs}
    </View>
  );
}

/** One source of storage in words. */
function sourceName(src: StorageSource, content: GarageContent): string {
  switch (src.kind) {
    case 'base':
      return t('ui.garage.storage.src.base');
    case 'upgrade': {
      const def = upgradeDef(content, src.id);
      return def ? gt(def.nameKey) : src.id;
    }
    case 'generation': {
      const i = content.generations.findIndex((g) => g.id === src.id);
      return i >= 0 ? generationLabel(i, content) : src.id;
    }
    case 'model':
      return t('ui.garage.storage.src.model');
    case 'perk': {
      const p = content.labRep.perks.find((x) => x.id === src.id);
      return p?.nameKey ? gt(p.nameKey) : src.id;
    }
    case 'paradigm':
      return t('ui.garage.storage.src.paradigm');
    case 'paid':
      return t('ui.garage.storage.src.paid');
  }
}

/** The next way to raise storage in words ("Next: A Bigger Hard Drive adds 1 h"). */
export function nextStorageText(next: StorageNext | null, content: GarageContent): string {
  if (!next) return t('ui.garage.storage.maxed');
  if (next.kind === 'upgrade') {
    const def = upgradeDef(content, next.id);
    return t('ui.garage.storage.next', {
      name: def ? gt(def.nameKey) : next.id,
      hours: fmtHours(next.hours),
    });
  }
  const perk = content.labRep.perks.find((p) => p.id === next.id);
  return t('ui.garage.storage.nextPerk', {
    rep: next.cost,
    hours: fmtHours(next.hours),
    name: perk?.nameKey ? gt(perk.nameKey) : next.id,
  });
}

/** Capacity and reach in hours for a state (the reach includes anything past the content's fixed sources). */
export function storageHours(state: GarageState, content: GarageContent): { st: ReturnType<typeof awayStorage>; capHours: number; maxHours: number } {
  const st = awayStorage(state, content);
  const capHours = st.capMs / HOUR_MS;
  return {
    st,
    capHours,
    maxHours: Math.max(
      capHours,
      storageReachHours(
        content,
        st.sources.filter((x) => x.kind === 'paradigm').reduce((s, x) => s + x.hours, 0),
      ),
    ),
  };
}

/** Whether the storage sheet is open (the chip in the header opens it; the sheet sits at the screen's root). */
const useStorageSheet = create<{ open: boolean }>()(() => ({ open: false }));

// Re-render only when the capacity or the next step changes (never per tick).
const selKey = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  // Only what can change the capacity: upgrades, generation, kept models, Lab Rep, the tree, the paid flag.
  return `${st.upgrades.length}|${st.generation}|${st.models.length}|${st.models[0]?.uid ?? 0}|${Math.floor(st.labRep)}|${st.paradigm?.nodes.length ?? 0}|${st.paidStorage ? 1 : 0}`;
};
const same = (v: string) => v;

/**
 * The compact away-storage chip for the Garage header: an icon, the capacity and the
 * segment bar; tap for what fills it and what raises it.
 */
export const AwayStorageChip = memo(function AwayStorageChip() {
  const key = useGarage(selKey, same);
  const { state, content } = useGarageStore.getState();
  if (!state || !key) return null;
  const { st, capHours, maxHours } = storageHours(state, content);
  const cap = fmtTime(st.capMs);
  return (
    <Pressable
      onPress={() => useStorageSheet.setState({ open: true })}
      accessibilityRole="button"
      accessibilityLabel={t('ui.garage.storage.a11y', {
        cap,
        pct: fmtPct(st.rate),
      })}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      testID="garage-storage"
    >
      <Icon name="document" size={16} color={colors.text} accent={colors.player} />
      <View style={styles.chipBody}>
        <Text style={styles.chipLabel} numberOfLines={1}>
          {t('ui.garage.storage.label')} · <Text style={styles.chipCap}>{cap}</Text>
        </Text>
        <StorageBar capHours={capHours} maxHours={maxHours} height={5} />
      </View>
    </Pressable>
  );
});

/** The away-storage sheet: what fills it and what raises it. Mount once at the Garage screen's root. */
export function AwayStorageSheet() {
  const visible = useStorageSheet((s) => s.open);
  const onClose = () => useStorageSheet.setState({ open: false });
  const { state, content } = useGarageStore.getState();
  if (!state || !visible) return null;
  const { st, capHours, maxHours } = storageHours(state, content);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.garage.storage.title')} testID="garage-storage-sheet">
      <View style={styles.sheet}>
        <Text style={styles.body}>
          {t('ui.garage.storage.body', {
            pct: fmtPct(st.rate),
            cap: fmtTime(st.capMs),
          })}
        </Text>
        <StorageBar capHours={capHours} maxHours={maxHours} height={14} />
        <Text style={styles.label}>{t('ui.garage.storage.sources')}</Text>
        {st.sources.map((src, i) => (
          <View key={`${src.kind}:${src.id}:${i}`} style={styles.row}>
            <Text style={styles.rowName} numberOfLines={1}>
              {sourceName(src, content)}
            </Text>
            <Text style={styles.rowValue}>+{fmtHours(Math.round(src.hours * 10) / 10)}</Text>
          </View>
        ))}
        <Text style={[styles.next, st.next?.available ? styles.nextReady : null]}>{nextStorageText(st.next, content)}</Text>
        {st.next?.kind === 'upgrade' && st.next.available ? (
          <Button
            label={t('ui.garage.offline.openUpgrades')}
            variant="secondary"
            onPress={() => {
              useGarageStore.getState().setTab('upgrades');
              onClose();
            }}
            testID="garage-storage-upgrades"
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 2, alignSelf: 'stretch' },
  seg: {
    flex: 1,
    borderRadius: shape.panel === 'ticks' ? 0 : 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
  segCap: { borderColor: colors.player, backgroundColor: colors.raised },
  segLocked: {
    borderColor: colors.border,
    backgroundColor: colors.transparent,
    opacity: 0.6,
  },
  segFill: { height: '100%', backgroundColor: colors.player },
  segFull: { backgroundColor: colors.amber },
  chip: {
    minHeight: touch,
    minWidth: 112,
    maxWidth: 170,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.s,
    borderRadius: radius.s,
    borderWidth: shape.hairline,
    borderColor: colors.border,
  },
  chipBody: { flex: 1, gap: 3 },
  chipLabel: {
    ...voice.body,
    ...tabular,
    color: colors.dim,
    fontSize: type.xs,
  },
  chipCap: {
    ...voice.bodyStrong,
    ...tabular,
    color: colors.text,
    fontSize: type.xs,
  },
  pressed: { opacity: 0.7 },
  sheet: { gap: spacing.s },
  body: { ...voice.body, color: colors.text, fontSize: type.s },
  label: { ...voice.calmLabel, color: colors.dim, marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.s,
  },
  rowName: {
    ...voice.body,
    color: colors.text,
    fontSize: type.s,
    flexShrink: 1,
  },
  rowValue: {
    ...voice.bodyStrong,
    ...tabular,
    color: colors.goodText,
    fontSize: type.s,
  },
  next: {
    ...voice.body,
    color: colors.dim,
    fontSize: type.s,
    marginTop: spacing.xs,
  },
  nextReady: { color: colors.playerText },
});
