import { memo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  autoBuyActive,
  mechanicOn,
  mechanicStage,
  modelSlots,
  staffEffects,
  trainingStatus,
  STAFF_LANES,
  type GarageContent,
  type GarageState,
  type ModelCandidate,
  type StaffLane,
} from '@/idle';

import { Button } from '../components/Button';
import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { buyHaptic, successHaptic } from './haptics';
import { useGarage, useNowEvery } from './hooks';
import { modelDesc, modelName, rarityName, rarityRank, traitLine } from './labText';
import { useGarageStore, type GarageStore } from './store';
import { fmtMult, fmtTime, gt } from './text';

const selKey = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  const tr = st.training;
  return `${st.stage}|${tr.charges}|${tr.nextChargeAt}|${tr.candidates?.map((c) => c.uid).join(',') ?? ''}|${st.models.map((m) => m.uid).join(',')}|${st.staff.research},${st.staff.product},${st.staff.safety}|${st.autoBuy}`;
};
const same = (v: string) => v;

const RARITY_COLORS = [colors.dim, colors.info, colors.playerText, colors.amber];

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  );
}

function Locked({ stage, content }: { stage: number; content: GarageContent }) {
  const def = content.stages?.[stage];
  if (!def) return null;
  return (
    <View style={styles.lockedRow}>
      <Icon name="lock" size={14} color={colors.dim} />
      <Text style={styles.small}>{t('ui.garage.lab.unlocksAt', { stage: gt(def.nameKey) })}</Text>
    </View>
  );
}

function Traits({ m }: { m: ModelCandidate }) {
  const lines = [...m.boons.map((b) => traitLine(b.trait, b.value)), ...(m.drawback ? [traitLine(m.drawback.trait, m.drawback.value)] : [])];
  return (
    <View style={styles.traits}>
      {lines.map((l, i) => (
        <Text key={i} style={[styles.trait, l.good ? styles.traitGood : styles.traitBad]} numberOfLines={1}>
          {l.text}
        </Text>
      ))}
    </View>
  );
}

function ModelHead({ m }: { m: ModelCandidate }) {
  const rank = rarityRank(m.rarity);
  return (
    <View style={styles.modelHead}>
      <Text style={styles.modelName} numberOfLines={1}>
        {modelName(m)}
      </Text>
      <Text style={[styles.rarity, { color: RARITY_COLORS[Math.min(rank, RARITY_COLORS.length - 1)], borderColor: RARITY_COLORS[Math.min(rank, RARITY_COLORS.length - 1)] }]} numberOfLines={1}>
        {rarityName(m.rarity)}
      </Text>
    </View>
  );
}

/** Training runs: the queue, the next run's timer, the launch button and the three candidates. */
function Training({ state, content, replacing, setReplacing }: { state: GarageState; content: GarageContent; replacing: number | null; setReplacing: (uid: number | null) => void }) {
  const status = trainingStatus(state, content);
  const now = useNowEvery(1000, status.unlocked && status.readyAt > 0);
  if (!status.unlocked) {
    return (
      <Card testID="garage-lab-training">
        <Text style={styles.label}>{t('ui.garage.lab.training')}</Text>
        <Text style={styles.small}>{t('ui.garage.lab.trainingAbout')}</Text>
        <Locked stage={status.unlockStage} content={content} />
      </Card>
    );
  }
  const cands = state.training.candidates;
  const full = state.models.length >= status.slots;
  return (
    <Card testID="garage-lab-training">
      <View style={styles.headRow}>
        <Text style={styles.label}>{t('ui.garage.lab.training')}</Text>
        <View style={styles.pips} accessibilityLabel={t('ui.garage.lab.queue', { have: status.charges, max: status.queueMax })}>
          {Array.from({ length: Math.max(status.queueMax, status.charges) }, (_, i) => (
            <View key={i} style={[styles.pip, i < status.charges && styles.pipOn]} />
          ))}
        </View>
      </View>
      {cands ? (
        <>
          <Text style={styles.small}>{full ? t('ui.garage.lab.pickFull') : t('ui.garage.lab.pick')}</Text>
          {cands.map((m) => (
            <View key={m.uid} style={[styles.cand, replacing === m.uid && styles.candOn]} testID={`garage-candidate-${m.uid}`}>
              <View style={styles.candTexts}>
                <ModelHead m={m} />
                <Text style={styles.desc} numberOfLines={2}>
                  {modelDesc(m)}
                </Text>
                <Traits m={m} />
              </View>
              <Button
                compact
                variant={replacing === m.uid ? 'primary' : 'secondary'}
                label={full ? t('ui.garage.lab.swap') : t('ui.garage.lab.keep')}
                onPress={() => {
                  if (full) setReplacing(replacing === m.uid ? null : m.uid);
                  else if (useGarageStore.getState().keepModel(m.uid)) successHaptic();
                }}
                testID={`garage-keep-${m.uid}`}
              />
              {replacing === m.uid ? (
                <View style={styles.replaceRow}>
                  <Text style={styles.small}>{t('ui.garage.lab.replaceWhich')}</Text>
                  {state.models.map((old) => (
                    <Button
                      key={old.uid}
                      compact
                      variant="danger"
                      label={modelName(old)}
                      onPress={() => {
                        if (useGarageStore.getState().keepModel(m.uid, old.uid)) successHaptic();
                        setReplacing(null);
                      }}
                      testID={`garage-replace-${old.uid}`}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <Button compact variant="ghost" label={t('ui.garage.lab.scrap')} onPress={() => useGarageStore.getState().scrapCandidates()} testID="garage-scrap" />
        </>
      ) : (
        <>
          <Text style={styles.small}>
            {status.charges > 0 ? t('ui.garage.lab.ready', { count: status.charges }) : t('ui.garage.lab.next', { time: fmtTime(Math.max(0, status.readyAt - now)) })}
            {status.charges > 0 && status.readyAt > 0 ? ` · ${t('ui.garage.lab.next', { time: fmtTime(Math.max(0, status.readyAt - now)) })}` : ''}
          </Text>
          <Button
            variant="primary"
            label={t('ui.garage.lab.launch')}
            sublabel={t('ui.garage.lab.launchSub', { count: content.training?.candidates ?? 3 })}
            disabled={status.charges < 1}
            onPress={() => {
              if (useGarageStore.getState().launchTraining()) buyHaptic();
            }}
            testID="garage-launch-training"
          />
        </>
      )}
    </Card>
  );
}

/** The kept models in their slots, the empty ones and how many more the next stage brings. */
function Models({ state, content }: { state: GarageState; content: GarageContent }) {
  const slots = modelSlots(state, content);
  if (!mechanicOn(state, content, 'training')) return null;
  const nextSlots = content.stages?.find((st, i) => i > state.stage && st.modelSlots > slots);
  return (
    <Card testID="garage-lab-models">
      <Text style={styles.label}>{t('ui.garage.lab.models', { used: state.models.length, slots })}</Text>
      {state.models.map((m) => (
        <View key={m.uid} style={styles.model}>
          <View style={styles.candTexts}>
            <ModelHead m={m} />
            <Traits m={m} />
          </View>
        </View>
      ))}
      {Array.from({ length: Math.max(0, slots - state.models.length) }, (_, i) => (
        <View key={`empty${i}`} style={[styles.model, styles.empty]}>
          <Text style={styles.small}>{t('ui.garage.lab.emptySlot')}</Text>
        </View>
      ))}
      {nextSlots ? <Text style={[styles.small, styles.dim]}>{t('ui.garage.lab.moreSlots', { slots: nextSlots.modelSlots, stage: gt(nextSlots.nameKey) })}</Text> : null}
    </Card>
  );
}

const LANE_ICON: Record<StaffLane, string> = { research: 'mortarboard', product: 'cash', safety: 'cap-safety-team' };

/** Pick a lane to take one person from (the fullest other lane) or give one to (the emptiest). */
function donor(state: GarageState, lane: StaffLane): StaffLane | null {
  const others = STAFF_LANES.filter((l) => l !== lane && state.staff[l] > 0).sort((a, b) => state.staff[b] - state.staff[a]);
  return others[0] ?? null;
}
function receiver(state: GarageState, lane: StaffLane): StaffLane {
  return STAFF_LANES.filter((l) => l !== lane).sort((a, b) => state.staff[a] - state.staff[b])[0];
}

/** The three-way staff split: each lane's people, its effect, and + / − (people move between lanes). */
function Staff({ state, content }: { state: GarageState; content: GarageContent }) {
  const cfg = content.staff;
  if (!cfg) return null;
  if (!mechanicOn(state, content, 'staff')) {
    return (
      <Card testID="garage-lab-staff">
        <Text style={styles.label}>{t('ui.garage.lab.staff')}</Text>
        <Text style={styles.small}>{t('ui.garage.lab.staffAbout')}</Text>
        <Locked stage={mechanicStage(content, 'staff')} content={content} />
      </Card>
    );
  }
  const e = staffEffects(state, content);
  const effect: Record<StaffLane, string> = {
    research: t('ui.garage.lab.effect.research', { mult: fmtMult(Math.round(e.trainingSpeed * 100) / 100) }),
    product: t('ui.garage.lab.effect.product', { mult: fmtMult(Math.round(e.production * 100) / 100) }),
    safety: t('ui.garage.lab.effect.safety', { incidents: fmtMult(Math.round(e.incidentFreq * 100) / 100), trust: fmtMult(Math.round(e.trust * 100) / 100) }),
  };
  const warn = state.staff.safety === 0 ? t('ui.garage.lab.warnSafety') : state.staff.product === 0 ? t('ui.garage.lab.warnProduct') : null;
  return (
    <Card testID="garage-lab-staff">
      <Text style={styles.label}>{t('ui.garage.lab.staff')}</Text>
      {STAFF_LANES.map((lane) => {
        const n = state.staff[lane];
        const from = donor(state, lane);
        return (
          <View key={lane} style={styles.lane} testID={`garage-staff-${lane}`}>
            <Icon name={LANE_ICON[lane]} size={18} color={colors.text} accent={colors.player} />
            <View style={styles.laneTexts}>
              <Text style={styles.laneName} numberOfLines={1}>
                {t(`ui.garage.lab.lane.${lane}`)} · {n}
              </Text>
              <View style={styles.laneTrack}>
                <View style={[styles.laneFill, { width: `${Math.round((n / cfg.total) * 100)}%` }]} />
              </View>
              <Text style={styles.small} numberOfLines={1}>
                {effect[lane]}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.step, n < 1 && styles.stepOff, pressed && styles.pressed]}
              disabled={n < 1}
              hitSlop={STEP_SLOP}
              onPress={() => useGarageStore.getState().moveStaff(lane, receiver(state, lane))}
              accessibilityRole="button"
              accessibilityLabel={t('ui.garage.lab.less', { lane: t(`ui.garage.lab.lane.${lane}`) })}
              testID={`garage-staff-${lane}-minus`}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.step, !from && styles.stepOff, pressed && styles.pressed]}
              disabled={!from}
              hitSlop={STEP_SLOP}
              onPress={() => from && useGarageStore.getState().moveStaff(from, lane)}
              accessibilityRole="button"
              accessibilityLabel={t('ui.garage.lab.more', { lane: t(`ui.garage.lab.lane.${lane}`) })}
              testID={`garage-staff-${lane}-plus`}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        );
      })}
      {warn ? <Text style={[styles.small, styles.warn]}>{warn}</Text> : null}
    </Card>
  );
}

/** Helpers: auto-collect (information) and the auto-buy switch. */
function Automation({ state, content }: { state: GarageState; content: GarageContent }) {
  const auto = content.automation;
  if (!auto) return null;
  const collect = mechanicOn(state, content, 'autoCollect');
  const buy = mechanicOn(state, content, 'autoBuy');
  const nextStageIdx = !collect ? mechanicStage(content, 'autoCollect') : !buy ? mechanicStage(content, 'autoBuy') : -1;
  return (
    <Card testID="garage-lab-auto">
      <Text style={styles.label}>{t('ui.garage.lab.helpers')}</Text>
      {collect ? <Text style={styles.small}>{t('ui.garage.lab.autoCollect', { pct: `${Math.round(auto.collectShare * 100)}%` })}</Text> : null}
      {buy ? (
        <Button
          compact
          variant={state.autoBuy ? 'primary' : 'secondary'}
          selected={state.autoBuy}
          label={state.autoBuy ? t('ui.garage.lab.autoBuyOn') : t('ui.garage.lab.autoBuyOff')}
          sublabel={autoBuyActive(state, content) ? t('ui.garage.lab.autoBuyAbout', { pct: `${Math.round(auto.buyBudgetShare * 100)}%` }) : undefined}
          onPress={() => useGarageStore.getState().setAutoBuy(!state.autoBuy)}
          testID="garage-autobuy"
        />
      ) : null}
      {nextStageIdx >= 0 ? <Locked stage={nextStageIdx} content={content} /> : null}
    </Card>
  );
}

/** The Lab tab: training runs, kept models, staff and helpers. */
export const LabPanel = memo(function LabPanel() {
  useGarage(selKey, same);
  const [replacing, setReplacing] = useState<number | null>(null);
  const { state, content } = useGarageStore.getState();
  if (!state) return null;
  const pending = replacing !== null && state.training.candidates?.some((c) => c.uid === replacing) ? replacing : null;
  return (
    <View style={styles.wrap} testID="garage-lab">
      <Training state={state} content={content} replacing={pending} setReplacing={setReplacing} />
      <Models state={state} content={content} />
      <Staff state={state} content={content} />
      <Automation state={state} content={content} />
    </View>
  );
});

/** The steppers draw 40 px square; the slop makes each a 44 px target (the gap between them is wider than the slop). */
const STEP_SLOP = { top: 2, bottom: 2, left: 2, right: 2 };

const styles = StyleSheet.create({
  wrap: { gap: spacing.s },
  card: {
    gap: spacing.xs,
    padding: spacing.s,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...voice.calmLabel, color: colors.dim },
  small: { ...voice.body, ...tabular, color: colors.dim, fontSize: type.xs + 1, lineHeight: 15 },
  dim: { color: colors.dim },
  warn: { color: colors.bad },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 12, height: 12, borderRadius: shape.panel === 'sticker' ? 6 : radius.xs, borderWidth: 1, borderColor: colors.outline },
  pipOn: { backgroundColor: colors.player, borderColor: colors.player },
  cand: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s, padding: spacing.xs, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border, backgroundColor: colors.bg },
  candOn: { borderColor: colors.player },
  replaceRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  candTexts: { flex: 1, minWidth: 0, gap: 1 },
  modelHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  modelName: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  rarity: { ...voice.calmLabel, fontSize: 9, borderWidth: 1, paddingHorizontal: 3, borderRadius: radius.xs },
  desc: { ...voice.body, color: colors.dim, fontSize: type.xs, lineHeight: 14 },
  traits: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.s },
  trait: { ...voice.bodyStrong, ...tabular, fontSize: type.xs },
  traitGood: { color: colors.goodText },
  traitBad: { color: colors.bad },
  model: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 3, borderTopWidth: shape.hairline, borderColor: colors.border },
  empty: { borderStyle: 'dashed', minHeight: 26 },
  lane: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  laneTexts: { flex: 1, minWidth: 0, gap: 1 },
  laneName: { ...voice.bodyStrong, ...tabular, color: colors.text, fontSize: type.s },
  laneTrack: { height: 5, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  laneFill: { height: '100%', backgroundColor: colors.player },
  step: { width: touch - 4, height: touch - 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.s, borderWidth: shape.outline, borderColor: colors.outline },
  stepOff: { opacity: 0.35 },
  stepText: { ...voice.calmNumber, color: colors.text, fontSize: type.l },
  pressed: { opacity: 0.7 },
});
