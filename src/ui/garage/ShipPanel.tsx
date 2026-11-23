import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { labPerks, nextLabPerk, prestigePreview, type LabPerkDef } from '@/idle';

import { Button } from '../components/Button';
import { fmtCash } from '../format';
import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { successHaptic } from './haptics';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, generationLabel, gt } from './text';

const selKey = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  const p = prestigePreview(st, s.content);
  return `${st.generation}:${st.hype}:${st.labRep}:${p.canShip}:${p.gain}:${Math.floor(p.progress * 100)}`;
};
const same = (v: string) => v;

/** A perk's line with its amount formatted for its kind. */
export function perkText(p: LabPerkDef): string {
  const a = p.effect.amount;
  const amount = p.effect.kind === 'startCash' ? fmtCash(a) : p.effect.kind === 'startHype' ? String(a) : `${Math.round(a * 100)}%`;
  return gt(p.textKey, { amount });
}

/** "Ship a model": what you have, what you gain and the button that starts ship day; Lab Rep below. */
export const ShipPanel = memo(function ShipPanel() {
  useGarage(selKey, same);
  const { state, content } = useGarageStore.getState();
  if (!state) return null;
  const p = prestigePreview(state, content);
  const next = content.generations[p.nextGeneration];
  const perks = labPerks(content, state.labRep);
  const upcoming = nextLabPerk(content, state.labRep);
  return (
    <View style={styles.wrap} testID="garage-ship">
      <Text style={styles.current}>{t('ui.garage.ship.current', { model: generationLabel(state.generation) })}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{t('ui.garage.ship.next')}</Text>
        <Text style={styles.model} numberOfLines={2}>
          {generationLabel(p.nextGeneration)}
        </Text>
        {next ? <Text style={styles.unlock}>{t('ui.garage.ship.unlocks', { text: gt(next.unlockKey) })}</Text> : null}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(p.progress * 100)}%` }]} />
        </View>
        <Text style={styles.small}>{t('ui.garage.ship.progress', { have: fmt(state.genLifetime), need: fmt(p.needed) })}</Text>
        <View style={styles.gainRow}>
          <Icon name="star" size={18} color={colors.text} accent={colors.player} />
          <Text style={styles.gain}>{t('ui.garage.ship.gain', { hype: p.gain })}</Text>
          <Text style={styles.small}>{t('ui.garage.ship.mult', { now: fmtMult(p.multNow), after: fmtMult(p.multAfter) })}</Text>
        </View>
        <Text style={styles.small}>{t('ui.garage.ship.resets')}</Text>
        <View style={styles.buttons}>
          <Button
            label={content.shipDay ? t('ui.garage.ship.startDay') : t('ui.garage.ship.button')}
            sublabel={p.canShip ? t('ui.garage.ship.gain', { hype: p.gain }) : t('ui.garage.ship.notYet', { amount: fmt(Math.max(0, p.needed - state.genLifetime)) })}
            variant="primary"
            disabled={!p.canShip}
            onPress={() => {
              const store = useGarageStore.getState();
              if (content.shipDay) store.openShipDay();
              else if (store.ship(false)) successHaptic();
            }}
            style={styles.ship}
            testID="garage-ship-button"
          />
        </View>
      </View>
      <View style={styles.card} testID="garage-labrep">
        <Text style={styles.label}>{t('ui.garage.labRep.title', { rep: state.labRep })}</Text>
        <Text style={styles.small}>{t('ui.garage.labRep.body')}</Text>
        {perks.length === 0 ? <Text style={styles.small}>{t('ui.garage.labRep.none')}</Text> : null}
        {perks.map((perk) => (
          <View key={perk.id} style={styles.perk}>
            <Icon name="check" size={14} color={colors.goodText} />
            <Text style={styles.perkText}>{perkText(perk)}</Text>
          </View>
        ))}
        {upcoming ? (
          <View style={styles.perk}>
            <Icon name="lock" size={14} color={colors.dim} />
            <Text style={[styles.perkText, styles.dim]}>
              {perkText(upcoming)} · {t('ui.garage.labRep.next', { rep: upcoming.rep })}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.small, styles.dim]}>{t('ui.garage.labRep.soon')}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.s },
  current: { ...voice.calmLabel, color: colors.dim, marginLeft: spacing.xs },
  card: {
    gap: spacing.xs,
    padding: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
  },
  label: { ...voice.calmLabel, color: colors.dim },
  model: { ...voice.calmHeading, color: colors.text, fontSize: type.l },
  unlock: { ...voice.bodyStrong, color: colors.playerText, fontSize: type.s },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden', marginTop: spacing.xs, borderWidth: shape.panel === 'sticker' ? 1 : 0, borderColor: colors.outline },
  fill: { height: '100%', backgroundColor: colors.player },
  small: { ...voice.body, ...tabular, color: colors.dim, fontSize: type.xs + 1, lineHeight: 16 },
  gainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.xs },
  gain: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: type.l },
  buttons: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.s },
  ship: { minWidth: 150 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  perkText: { ...voice.body, color: colors.text, fontSize: type.xs + 1, flexShrink: 1 },
  dim: { color: colors.dim },
});
