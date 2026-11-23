import { StyleSheet, View } from 'react-native';

import { labPerks } from '@/idle';

import { PLACEMENTS, useAdStore } from '../ads';
import { Sheet } from '../components/Sheet';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { useGarageStore } from './store';
import { fmt, fmtTime, gt } from './text';
import { perkText } from './ShipPanel';

/** Lifetime stats, achievements (secret ones hidden until earned), Lab Rep perks and ad counts. */
export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useGarageStore((s) => (visible ? s.state : null));
  const content = useGarageStore((s) => s.content);
  const adStats = useAdStore((s) => s.stats);
  if (!visible || !state) return <Sheet visible={false} onClose={onClose} />;
  const st = state.stats;
  const rows: [string, string][] = [
    [t('ui.garage.stats.taps'), fmt(st.taps)],
    [t('ui.garage.stats.tokensAllTime'), fmt(st.tokensAllTime)],
    [t('ui.garage.stats.modelsShipped'), String(st.modelsShipped)],
    [t('ui.garage.stats.hype'), fmt(state.hype)],
    [t('ui.garage.stats.bestCombo'), String(st.bestCombo)],
    [t('ui.garage.stats.goldenCaught'), String(st.goldenCaught)],
    [t('ui.garage.stats.incidentsFixed'), String(st.incidentsFixed)],
    [t('ui.garage.stats.offlineTokens'), fmt(st.offlineTokens)],
    [t('ui.garage.stats.playTime'), fmtTime(st.playMs)],
  ];
  const have = content.achievements.filter((a) => state.achievements.includes(a.id)).length;
  return (
    <Sheet visible onClose={onClose} title={t('ui.garage.stats.title')} safeArea testID="garage-stats-sheet">
      <View style={styles.grid}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.section}>{t('ui.garage.ach.title', { have, total: content.achievements.length })}</Text>
      <View style={styles.achs}>
        {content.achievements.map((a) => {
          const got = state.achievements.includes(a.id);
          const hidden = a.secret && !got;
          return (
            <View key={a.id} style={[styles.ach, !got && styles.achOff]} testID={`ach-${a.id}`}>
              <Icon name={hidden ? 'lock' : a.icon} size={20} color={got ? colors.text : colors.dim} accent={colors.player} />
              <View style={styles.achTexts}>
                <Text style={[styles.achName, !got && styles.dim]} numberOfLines={1}>
                  {hidden ? t('ui.garage.ach.secret') : gt(a.nameKey)}
                </Text>
                <Text style={styles.achDesc} numberOfLines={2}>
                  {hidden ? t('ui.garage.ach.hidden') : gt(a.descKey)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.section}>{t('ui.garage.labRep.title', { rep: state.labRep })}</Text>
      {labPerks(content, state.labRep).length === 0 ? <Text style={styles.small}>{t('ui.garage.labRep.none')}</Text> : null}
      {labPerks(content, state.labRep).map((p) => (
        <Text key={p.id} style={styles.small}>
          · {perkText(p)}
        </Text>
      ))}
      <Text style={styles.section}>{t('ui.ads.stats.title')}</Text>
      {PLACEMENTS.map((p) => (
        <View key={p} style={styles.adRow}>
          <Text style={styles.small} numberOfLines={1}>
            {t(`ui.ads.name.${p}`)}
          </Text>
          <Text style={[styles.small, styles.adNums]} numberOfLines={1}>
            {t('ui.ads.stats.row', { requested: adStats[p].requested, shown: adStats[p].shown, rewarded: adStats[p].rewarded + adStats[p].granted })}
          </Text>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  stat: { width: '47%', padding: spacing.s, backgroundColor: colors.raised, borderRadius: radius.s },
  statValue: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: type.l },
  statLabel: { ...voice.body, color: colors.dim, fontSize: type.xs },
  section: { ...voice.calmLabel, color: colors.dim, marginTop: spacing.m },
  achs: { gap: spacing.xs },
  ach: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: spacing.s, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border },
  achOff: { borderStyle: 'dashed' },
  achTexts: { flex: 1 },
  achName: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  achDesc: { ...voice.body, color: colors.dim, fontSize: type.xs },
  dim: { color: colors.dim },
  small: { ...voice.body, color: colors.text, fontSize: type.xs + 1, flexShrink: 1 },
  adRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
  adNums: { ...tabular, color: colors.dim },
});
