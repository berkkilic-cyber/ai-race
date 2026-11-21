import { StyleSheet, Text, View } from 'react-native';

import { getReachableRegions, type ContentPack, type GameState } from '@/engine';

import { Icon } from '../../icons';
import { colors, spacing, type, voice } from '../../theme';
import { reachText } from './reach';

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
