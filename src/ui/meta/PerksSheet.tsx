import { StyleSheet, Switch, View } from 'react-native';

import { Text } from '../locale/Text';

import type { LabPerkDef } from '@/idle';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { garageContent } from '../garage/content';
import { t } from '../i18n';
import { cased } from '../locale/casing';
import { colors, radius, shape, spacing, type, voice } from '../theme';
import { LabRepBadge } from './LabRepBadge';
import { isPowerPerk, labRepLevel } from './logic';
import { useMetaStore } from './store';
import { perkEffectShort, perkName, perkQuip } from './text';

export interface PerksSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Opens the Garage (the sheet closes first). */
  onGarage?: () => void;
}

type Status = 'earned' | 'next' | 'later';

function PerkRow({ perk, status }: { perk: LabPerkDef; status: Status }) {
  const color = perk.effect.kind === 'frame' ? perk.effect.color : undefined;
  return (
    <View style={[styles.row, status === 'later' && styles.later]} testID={`perk-${perk.id}`}>
      <View style={[styles.rep, status === 'earned' && styles.repEarned, status === 'next' && styles.repNext]}>
        <Text style={[styles.repText, status === 'earned' && styles.repTextEarned]}>{perk.rep}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          {color ? <View style={[styles.swatch, { borderColor: color }]} /> : null}
          <Text style={styles.name} numberOfLines={1}>
            {perkName(perk)}
          </Text>
          <Text style={[styles.effect, isPowerPerk(perk) ? styles.effectPower : null]} numberOfLines={1}>
            {perkEffectShort(perk)}
          </Text>
        </View>
        <Text style={styles.quip} numberOfLines={2}>
          {perkQuip(perk)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Lab Rep perks: the badge, the switch to play without perks, every perk on the ladder
 * (earned, the next one, later ones) and a way to the Garage.
 */
export function PerksSheet({ visible, onClose, onGarage }: PerksSheetProps) {
  const labRep = useMetaStore((s) => s.labRep);
  const perksOn = useMetaStore((s) => s.perksOn);
  const content = garageContent();
  const { level, next } = labRepLevel(content, labRep);
  const perks = content.labRep.perks;
  const statusOf = (p: LabPerkDef): Status => (p.rep <= level ? 'earned' : p === next ? 'next' : 'later');
  const groups: { status: Status; list: LabPerkDef[] }[] = (['earned', 'next', 'later'] as const).map((status) => ({ status, list: perks.filter((p) => statusOf(p) === status) }));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.meta.sheet.title')} safeArea testID="perks-sheet">
      <View style={styles.wrap}>
        <LabRepBadge total={labRep} />
        <Text style={styles.body}>{level < 1 ? t('ui.meta.sheet.zero') : t('ui.meta.sheet.body')}</Text>
        {level >= 1 ? (
          <View style={styles.toggle}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>{t('ui.meta.sheet.toggle')}</Text>
              <Text style={styles.toggleHint}>{t('ui.meta.sheet.toggleHint')}</Text>
            </View>
            <Switch
              value={perksOn}
              onValueChange={(on) => useMetaStore.getState().setPerksOn(on)}
              accessibilityLabel={t('ui.meta.sheet.toggle')}
              trackColor={{ true: colors.player, false: colors.raised }}
              testID="perks-switch"
            />
          </View>
        ) : null}
        {groups.map(({ status, list }) =>
          list.length === 0 ? null : (
            <View key={status} style={styles.group}>
              <Text style={styles.groupTitle}>{cased(styles.groupTitle, t(`ui.meta.sheet.${status}`))}</Text>
              {list.map((p) => (
                <PerkRow key={p.id} perk={p} status={status} />
              ))}
            </View>
          ),
        )}
        <View style={styles.buttons}>
          {onGarage ? <Button label={t('ui.meta.sheet.garage')} variant="secondary" compact onPress={onGarage} style={styles.button} testID="perks-garage" /> : null}
          <Button label={t('ui.meta.sheet.done')} variant="primary" compact onPress={onClose} style={styles.button} testID="perks-done" />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.m },
  body: { ...voice.body, color: colors.dim, fontSize: type.s, lineHeight: 19 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.m,
    borderRadius: radius.s,
    backgroundColor: colors.raised,
    borderWidth: shape.hairline,
    borderColor: colors.border,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  toggleHint: { ...voice.body, color: colors.dim, fontSize: type.xs },
  group: { gap: spacing.s },
  groupTitle: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  row: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  later: { opacity: 0.55 },
  rep: { width: 30, height: 22, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  repEarned: { backgroundColor: colors.player, borderColor: colors.player },
  repNext: { borderColor: colors.player },
  repText: { ...voice.bodyStrong, color: colors.dim, fontSize: type.xs },
  repTextEarned: { color: colors.onPlayer },
  rowBody: { flex: 1, gap: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 2 },
  name: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  effect: { ...voice.body, color: colors.dim, fontSize: type.xs, marginLeft: 'auto', flexShrink: 0 },
  effectPower: { color: colors.goodText },
  quip: { ...voice.body, color: colors.dim, fontSize: type.xs, lineHeight: 16 },
  buttons: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.xs },
  button: { flex: 1, minHeight: 44 },
});
