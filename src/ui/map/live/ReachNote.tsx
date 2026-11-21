import { StyleSheet, Text, View } from 'react-native';

import { getReachableRegions, type ContentPack, type GameState, type RegionReach } from '@/engine';

import { t } from '../../i18n';
import { Icon } from '../../icons';
import { colors, spacing, type, voice } from '../../theme';
import { barrierIcon, mapLiveConfig } from './config';

/** "A, B or C" with the translated joiner. */
function joinWords(words: readonly string[], joiner: string): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')}${joiner}${words[words.length - 1]}`;
}

function nameOf(pack: ContentPack, list: 'barriers' | 'channels' | 'nodes', id: string): string {
  const def = (pack[list] as { id: string; nameKey: string }[] | undefined)?.find((x) => x.id === id);
  return def ? t(def.nameKey) : id;
}

export interface ReachText {
  kind: 'blocked' | 'next';
  lines: string[];
  icon: string;
}

/** Plain words for why the player cannot spread into a region yet and what unlocks it, or that it is next in line. Pure. */
export function reachText(row: RegionReach | undefined, pack: ContentPack): ReachText | null {
  if (!row || row.present || row.banned) return null;
  const config = mapLiveConfig(pack.id);
  if (row.blockedBy && row.blockedBy.length > 0) {
    const barriers = row.blockedBy.map((b) => nameOf(pack, 'barriers', b));
    const lines = [t('ui.map.reach.blocked', { barriers: joinWords(barriers, t('ui.map.reach.and')) })];
    const unlock = row.unlockedBy ?? {};
    if (row.blockedBy.length === 1) {
      const nodes = (unlock[row.blockedBy[0]] ?? []).map((n) => nameOf(pack, 'nodes', n));
      if (nodes.length > 0) lines.push(t('ui.map.reach.unlock', { nodes: joinWords(nodes, t('ui.map.reach.or')) }));
    } else {
      for (const b of row.blockedBy) {
        const nodes = (unlock[b] ?? []).map((n) => nameOf(pack, 'nodes', n));
        if (nodes.length > 0) lines.push(t('ui.map.reach.unlockOne', { barrier: nameOf(pack, 'barriers', b), nodes: joinWords(nodes, t('ui.map.reach.or')) }));
      }
    }
    lines.push(t('ui.map.reach.slow'));
    return { kind: 'blocked', lines, icon: barrierIcon(config, row.blockedBy[0]) };
  }
  if (row.reachable && row.from) {
    const line = row.channel ? t('ui.map.reach.nextVia', { channel: nameOf(pack, 'channels', row.channel), region: row.from }) : t('ui.map.reach.next', { region: row.from });
    return { kind: 'next', lines: [line], icon: row.channel ? barrierIcon(config, row.channel) : 'users' };
  }
  return null;
}

/** The region panel's reach note: blocked by what and unlocked by which nodes, or spreading here next. */
export function ReachNote({ state, pack, regionId }: { state: GameState; pack: ContentPack; regionId: string }) {
  const row = getReachableRegions(state, pack, state.playerLabId).find((r) => r.regionId === regionId);
  const text = reachText(row, pack);
  if (!text) return null;
  const blocked = text.kind === 'blocked';
  return (
    <View style={[styles.box, blocked ? styles.blocked : styles.next]} testID={blocked ? 'region-reach-blocked' : 'region-reach-next'}>
      <View style={[styles.icon, { backgroundColor: blocked ? colors.alarm : colors.player }]}>
        <Icon name={text.icon} size={16} color={blocked ? colors.newsPaper : colors.onPlayer} strokeWidth={2} />
      </View>
      <View style={styles.texts}>
        {text.lines.map((line, i) => (
          <Text key={i} style={i === 0 ? styles.lead : styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.s, padding: spacing.s, borderWidth: 1 },
  blocked: { borderColor: colors.alarm },
  next: { borderColor: colors.border },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  lead: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  line: { ...voice.body, color: colors.dim, fontSize: type.s - 1 },
});
