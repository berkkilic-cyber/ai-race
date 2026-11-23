import { StyleSheet, Text, View } from 'react-native';

import { labRepTotal, markRaceNoteSeen, raceBoostLeftMs } from '@/idle';

import { Button } from '../components/Button';
import { garageNow } from '../garage/clock';
import { useGarageStore } from '../garage/store';
import { fmtTime } from '../garage/text';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { cased } from '../locale/casing';
import { colors, flatShadow, radius, shape, spacing, type, voice } from '../theme';
import { LabRepBadge } from './LabRepBadge';
import { fmtRep } from './text';

/** Height of the Garage ticker band the note stays above. */
const TICKER_CLEARANCE = 44;

function dismiss(): void {
  const store = useGarageStore.getState();
  const s = store.state;
  if (!s) return;
  const next = markRaceNoteSeen(s);
  if (next === s) return;
  useGarageStore.setState({ state: next });
  store.save(true);
}

/**
 * "From your last race": a small card over the lab the first time the Garage opens after a
 * race granted it something (Lab Rep and the blueprints boost), with the Lab Rep badge.
 * Hidden while a full-screen card (away report, launch, ship day) is up; gone once dismissed.
 * Mounted once in GarageScreen.
 */
export function GarageRaceNote() {
  const last = useGarageStore((s) => s.state?.race?.last ?? null);
  const blocked = useGarageStore((s) => !!s.state?.offline || s.launch !== null || s.shipDay !== null || s.stageCard !== null);
  const insets = useInsets();
  if (!last || last.seen || blocked) return null;
  const state = useGarageStore.getState().state!;
  const content = useGarageStore.getState().content;
  const left = raceBoostLeftMs(state, garageNow());
  const mult = content.raceReward?.boostMult ?? 1;
  return (
    <View style={[styles.card, { left: insets.left + spacing.m, bottom: insets.bottom + TICKER_CLEARANCE }]} testID="garage-race-note">
      <Text style={styles.title}>{cased(styles.title, t('ui.meta.note.title'))}</Text>
      <Text style={styles.body}>{t(last.won ? 'ui.meta.note.win' : 'ui.meta.note.lose', { rep: fmtRep(last.rep) })}</Text>
      {last.boostMs > 0 ? <Text style={styles.boost}>{left > 0 ? t('ui.meta.note.boost', { mult, time: fmtTime(left) }) : t('ui.meta.note.boostOver')}</Text> : null}
      <View style={styles.row}>
        <LabRepBadge total={labRepTotal(state)} style={styles.badge} />
        <Button label={t('ui.meta.note.dismiss')} variant="primary" compact onPress={dismiss} style={styles.button} testID="garage-race-note-ok" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 330,
    maxWidth: '46%',
    padding: spacing.m,
    gap: spacing.xs,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
    borderWidth: shape.panel === 'sticker' ? shape.outline : 1,
    borderColor: colors.player,
    ...flatShadow(),
  },
  title: { ...voice.calmLabel, color: colors.playerText, fontSize: type.xs },
  body: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, lineHeight: 18 },
  boost: { ...voice.body, color: colors.goodText, fontSize: type.xs + 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  badge: { flex: 1 },
  button: { minHeight: 40, minWidth: 84 },
});
