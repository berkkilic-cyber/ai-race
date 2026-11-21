import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { availableUpgrades, nextUnlocks } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { buyHaptic } from './haptics';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { effectText, fmt, gt, requirementText } from './text';

interface Offer {
  id: string;
  icon: string;
  name: string;
  desc: string;
  effect: string;
  keep: boolean;
  cost: string;
  affordable: boolean;
}

interface Upcoming {
  id: string;
  icon: string;
  name: string;
  requirement: string;
  progress: number;
}

interface View_ {
  offers: Offer[];
  upcoming: Upcoming[];
}

function viewOf(s: GarageStore): View_ {
  const st = s.state;
  if (!st) return { offers: [], upcoming: [] };
  return {
    offers: availableUpgrades(st, s.content).map((u) => ({
      id: u.id,
      icon: u.icon,
      name: gt(u.nameKey),
      desc: gt(u.descKey),
      effect: u.effects.map((e) => effectText(e, s.content)).join(' · '),
      keep: !!u.keep,
      cost: fmt(u.cost),
      affordable: st.tokens >= u.cost,
    })),
    upcoming: nextUnlocks(st, s.content, 3).map((n) => ({ id: n.def.id, icon: n.def.icon, name: gt(n.def.nameKey), requirement: requirementText(n.requirement, s.content), progress: Math.floor(n.progress * 20) / 20 })),
  };
}
const keyView = (v: View_) => `${v.offers.map((o) => `${o.id}${o.affordable ? '+' : '-'}`).join(',')}|${v.upcoming.map((u) => `${u.id}${u.progress}`).join(',')}`;

/** Upgrades on offer (cheapest first) and the next few coming up, with their progress. */
export const UpgradeList = memo(function UpgradeList() {
  const v = useGarage(viewOf, keyView);
  return (
    <View style={styles.list} testID="garage-upgrades">
      {v.offers.length === 0 ? <Text style={styles.empty}>{t('ui.garage.upgrades.empty')}</Text> : null}
      {v.offers.map((o) => (
        <View key={o.id} style={styles.row} testID={`up-${o.id}`}>
          <Icon name={o.icon} size={24} color={colors.text} accent={colors.player} />
          <View style={styles.texts}>
            <Text style={styles.name} numberOfLines={1}>
              {o.name}
            </Text>
            <Text style={styles.effect} numberOfLines={1}>
              {o.effect}
              {o.keep ? ` · ${t('ui.garage.keep')}` : ''}
            </Text>
            <Text style={styles.desc} numberOfLines={1}>
              {o.desc}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (useGarageStore.getState().buyUpgrade(o.id)) buyHaptic();
            }}
            disabled={!o.affordable}
            accessibilityRole="button"
            accessibilityLabel={`${t('ui.garage.upgrades.buy')} ${o.name}, ${o.cost}`}
            accessibilityState={{ disabled: !o.affordable }}
            style={({ pressed }) => [styles.buy, o.affordable ? styles.buyOn : styles.buyOff, pressed && styles.pressed]}
            testID={`buyup-${o.id}`}
          >
            <Icon name="hype" size={12} color={o.affordable ? colors.onPlayer : colors.dim} />
            <Text style={[styles.cost, o.affordable ? styles.onAccent : styles.dim]} numberOfLines={1}>
              {o.cost}
            </Text>
          </Pressable>
        </View>
      ))}
      {v.upcoming.length > 0 ? <Text style={styles.section}>{t('ui.garage.upgrades.next')}</Text> : null}
      {v.upcoming.map((u) => (
        <View key={u.id} style={[styles.row, styles.upcoming]}>
          <Icon name={u.icon} size={20} color={colors.dim} />
          <View style={styles.texts}>
            <Text style={[styles.name, styles.dim]} numberOfLines={1}>
              {u.name}
            </Text>
            <Text style={styles.desc} numberOfLines={1}>
              {u.requirement}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(u.progress * 100)}%` }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  empty: { ...voice.body, color: colors.dim, fontSize: type.s, padding: spacing.m, textAlign: 'center' },
  section: { ...voice.calmLabel, color: colors.dim, marginTop: spacing.s, marginLeft: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: 58,
    paddingLeft: spacing.s,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
  },
  upcoming: { backgroundColor: colors.transparent, borderStyle: 'dashed', minHeight: 48 },
  texts: { flex: 1, minWidth: 0 },
  name: { ...voice.bodyStrong, color: colors.text, fontSize: type.s + 1 },
  effect: { ...voice.bodyStrong, color: colors.playerText, fontSize: type.xs + 1 },
  desc: { ...voice.body, color: colors.dim, fontSize: type.xs },
  dim: { color: colors.dim },
  onAccent: { color: colors.onPlayer },
  buy: {
    minWidth: 80,
    minHeight: touch,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    borderWidth: shape.panel === 'plain' ? 0 : shape.outline,
  },
  buyOn: { backgroundColor: colors.player, borderColor: shape.panel === 'sticker' ? colors.outline : colors.player, ...flatShadow() },
  buyOff: { backgroundColor: colors.transparent, borderColor: colors.dim, borderStyle: 'dashed', borderWidth: shape.panel === 'plain' ? 1 : shape.outline },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  cost: { ...voice.calmNumber, ...tabular, fontSize: type.s },
  track: { height: 4, marginTop: 3, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.dim },
});
