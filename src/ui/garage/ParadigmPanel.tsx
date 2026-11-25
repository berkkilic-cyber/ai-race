import { memo } from 'react';
import { create } from 'zustand';
import { StyleSheet, View } from 'react-native';

import { hypeMultiplier, paradigmEffects, paradigmNode, paradigmNodeBlock, paradigmStatus, type GarageContent, type GarageState, type ParadigmNodeDef } from '@/idle';

import { Button } from '../components/Button';
import { ModalCard } from '../components/ModalCard';
import { feedback } from '../feel';
import { fmtNum } from '../format';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, generationLabel, gt } from './text';

const selKey = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  const p = st.paradigm;
  return `${st.generation >= (s.content.paradigm?.minGeneration ?? Infinity) ? 1 : 0}|${Math.floor(st.hype)}|${p?.points ?? 0}|${p?.nodes.length ?? 0}|${p?.autoShip ? 1 : 0}|${p?.count ?? 0}|${st.models.length}`;
};
const same = (v: string) => v;

/** A multiplier's number, short when big: "2.5", "1.2K" (the strings put the × in front). */
function bigMult(m: number): string {
  return m < 1000 ? fmtMult(m) : fmt(m);
}

/** Whether the shift confirmation is open (the panel opens it; the card sits at the screen's root). */
const useConfirm = create<{ open: boolean }>()(() => ({ open: false }));

/** The shift confirmation at the Garage screen's root (a card inside the scrolling panel would scroll away). */
export function ParadigmConfirmHost() {
  const open = useConfirm((s) => s.open);
  const { state, content } = useGarageStore.getState();
  if (!open || !state || !content.paradigm) return null;
  return <ConfirmShift state={state} content={content} onClose={() => useConfirm.setState({ open: false })} />;
}

/** What a shift loses and keeps, said plainly before the player commits. */
function ConfirmShift({ state, content, onClose }: { state: GarageState; content: GarageContent; onClose: () => void }) {
  const st = paradigmStatus(state, content);
  const keeps = paradigmEffects(state, content).keepModels;
  const mult = bigMult(st.multAfter);
  return (
    <ModalCard visible title={t('ui.garage.paradigm.confirmTitle')} tone="bad" onRequestClose={onClose} testID="garage-paradigm-confirm">
      <View style={styles.confirm}>
        <Text style={styles.label}>{t('ui.garage.paradigm.lost')}</Text>
        <Line
          icon="close"
          bad
          text={t('ui.garage.paradigm.lostModels', {
            model: generationLabel(0, content),
          })}
        />
        <Line
          icon="close"
          bad
          text={t('ui.garage.paradigm.lostHype', {
            hype: fmt(state.hype),
            mult: bigMult(hypeMultiplier(state, content)),
          })}
        />
        <Line icon="close" bad text={t('ui.garage.paradigm.lostTokens')} />
        {!keeps && state.models.length > 0 ? (
          <Line
            icon="close"
            bad
            text={t('ui.garage.paradigm.lostKept', {
              count: state.models.length,
            })}
          />
        ) : null}
        <Text style={styles.label}>{t('ui.garage.paradigm.kept')}</Text>
        <Line icon="check" text={t('ui.garage.paradigm.keptRep')} />
        <Line icon="check" text={t('ui.garage.paradigm.keptLab')} />
        {keeps && state.models.length > 0 ? <Line icon="check" text={t('ui.garage.paradigm.keptModels')} /> : null}
        <Line icon="check" text={t('ui.garage.paradigm.keptTree')} />
        <Text style={styles.gainLine}>{t('ui.garage.paradigm.gainLine', { gain: st.gain, after: mult })}</Text>
        <Text style={styles.small}>{t('ui.garage.paradigm.stagesLine')}</Text>
        <View style={styles.buttons}>
          <Button label={t('ui.garage.paradigm.cancel')} variant="secondary" onPress={onClose} testID="garage-paradigm-cancel" />
          <Button
            label={t('ui.garage.paradigm.confirm', { gain: st.gain })}
            variant="danger"
            onPress={() => {
              if (useGarageStore.getState().paradigmShift()) feedback('garageStage');
              onClose();
            }}
            testID="garage-paradigm-yes"
          />
        </View>
      </View>
    </ModalCard>
  );
}

function Line({ icon, text, bad }: { icon: string; text: string; bad?: boolean }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={14} color={bad ? colors.bad : colors.goodText} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

function NodeRow({ def, state, content }: { def: ParadigmNodeDef; state: GarageState; content: GarageContent }) {
  const block = paradigmNodeBlock(state, content, def.id);
  const owned = block === 'owned';
  const needs = block === 'locked' ? def.requires.find((r) => !state.paradigm?.nodes.includes(r)) : undefined;
  const needDef = needs ? paradigmNode(content, needs) : undefined;
  return (
    <View style={[styles.node, owned && styles.nodeOwned, block === 'locked' && styles.nodeLocked]} testID={`paradigm-node-${def.id}`}>
      <Icon name={def.icon} size={20} color={colors.text} accent={owned ? colors.good : colors.player} />
      <View style={styles.nodeText}>
        <Text style={styles.nodeName} numberOfLines={1}>
          {gt(def.nameKey)}
        </Text>
        <Text style={styles.small} numberOfLines={2}>
          {gt(def.descKey)}
        </Text>
        {needDef ? <Text style={styles.small}>{t('ui.garage.paradigm.needs', { name: gt(needDef.nameKey) })}</Text> : null}
      </View>
      {owned ? (
        <Text style={styles.owned}>{t('ui.garage.paradigm.owned')}</Text>
      ) : (
        <Button
          label={t('ui.garage.paradigm.buy', { cost: def.cost })}
          compact
          variant={block ? 'secondary' : 'primary'}
          disabled={!!block}
          onPress={() => {
            if (useGarageStore.getState().buyParadigmNode(def.id)) feedback('garageBuy');
          }}
          testID={`paradigm-buy-${def.id}`}
        />
      )}
    </View>
  );
}

/**
 * The Paradigm Shift section of the Ship tab: what it trades, the currency and its
 * production bonus, the shift button (behind a confirmation that lists what is lost and
 * kept), the auto-ship switch and the tree.
 */
export const ParadigmPanel = memo(function ParadigmPanel() {
  useGarage(selKey, same);
  const { state, content } = useGarageStore.getState();
  const cfg = content.paradigm;
  if (!state || !cfg) return null;
  const st = paradigmStatus(state, content);
  const p = state.paradigm;
  const fx = paradigmEffects(state, content);
  return (
    <View style={styles.wrap} testID="garage-paradigm">
      <View style={[styles.card, st.available && styles.cardReady]}>
        <View style={styles.head}>
          <Icon name="trees" size={20} color={colors.text} accent={colors.player} />
          <Text style={styles.title}>{t('ui.garage.paradigm.title')}</Text>
        </View>
        {p ? (
          <Text style={styles.wallet} testID="garage-paradigm-wallet">
            {t('ui.garage.paradigm.wallet', {
              points: p.points,
              earned: p.earned,
            })}
          </Text>
        ) : null}
        {p ? <Text style={styles.small}>{t('ui.garage.paradigm.mult', { mult: bigMult(st.multNow) })}</Text> : null}
        <Text style={styles.small}>
          {st.available
            ? t('ui.garage.paradigm.readyBody')
            : t('ui.garage.paradigm.lockedBody', {
                model: generationLabel(cfg.minGeneration, content),
              })}
        </Text>
        {st.available ? (
          <>
            <View style={styles.gainRow}>
              <Text style={styles.gain}>{t('ui.garage.paradigm.gain', { gain: st.gain })}</Text>
              <Text style={styles.small}>
                {t('ui.garage.paradigm.gainMult', {
                  now: bigMult(st.multNow),
                  after: bigMult(st.multAfter),
                })}
              </Text>
            </View>
            <Button label={t('ui.garage.paradigm.button')} variant="primary" onPress={() => useConfirm.setState({ open: true })} testID="garage-paradigm-shift" />
          </>
        ) : null}
        {p && p.count > 0 ? <Text style={styles.small}>{t('ui.garage.paradigm.count', { count: fmtNum(p.count, 0) })}</Text> : null}
        {fx.autoShip ? (
          <Button label={t('ui.garage.paradigm.autoShip')} variant={p?.autoShip ? 'primary' : 'secondary'} selected={!!p?.autoShip} compact onPress={() => useGarageStore.getState().setAutoShip(!p?.autoShip)} testID="garage-paradigm-autoship" />
        ) : null}
      </View>
      {!st.available && !p ? null : (
        <View style={styles.card} testID="garage-paradigm-tree">
          <Text style={styles.label}>{t('ui.garage.paradigm.tree')}</Text>
          <Text style={styles.small}>{t('ui.garage.paradigm.treeBody')}</Text>
          {cfg.nodes.map((def) => (
            <NodeRow key={def.id} def={def} state={state} content={content} />
          ))}
        </View>
      )}
    </View>
  );
});

const panel = {
  gap: spacing.xs,
  padding: spacing.m,
  backgroundColor: colors.surface,
  borderRadius: radius.s,
  borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
  borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
} as const;

const styles = StyleSheet.create({
  wrap: { gap: spacing.s },
  card: panel,
  cardReady: { borderColor: colors.player },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.l },
  wallet: {
    ...voice.bodyStrong,
    ...tabular,
    color: colors.playerText,
    fontSize: type.s,
  },
  label: { ...voice.calmLabel, color: colors.dim },
  small: {
    ...voice.body,
    ...tabular,
    color: colors.dim,
    fontSize: type.xs + 1,
    lineHeight: 16,
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    flexWrap: 'wrap',
  },
  gain: {
    ...voice.calmNumber,
    ...tabular,
    color: colors.text,
    fontSize: type.l,
  },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.xs,
    borderTopWidth: shape.hairline,
    borderColor: colors.border,
  },
  nodeOwned: { opacity: 0.85 },
  nodeLocked: { opacity: 0.55 },
  nodeText: { flex: 1, minWidth: 0 },
  nodeName: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  owned: { ...voice.bodyStrong, color: colors.goodText, fontSize: type.xs + 1 },
  confirm: { gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  lineText: {
    ...voice.body,
    color: colors.text,
    fontSize: type.s,
    flexShrink: 1,
  },
  gainLine: {
    ...voice.bodyStrong,
    color: colors.text,
    fontSize: type.s,
    marginTop: spacing.xs,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.s,
    flexWrap: 'wrap',
    marginTop: spacing.s,
  },
});
