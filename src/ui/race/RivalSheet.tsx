import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { lineStyles, Note, SectionTitle } from '../explain/Lines';
import { t } from '../i18n';
import { Icon } from '../icons';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, type, voice } from '../theme';
import { rivalDetail, type RivalDetail } from './logic';

/** One rival: home, status, where it is strong, how it compares, and whether the player can buy it out now. */
export function RivalSheet({ labId, onClose }: { labId: string | null; onClose: () => void }) {
  const json = useGameStore((s) => (s.state && labId ? JSON.stringify(rivalDetail(s.state, s.pack, labId)) : ''));
  const detail = json ? (JSON.parse(json) as RivalDetail | null) : null;
  return (
    <Sheet visible={!!detail} onClose={onClose} title={detail?.name} maxHeight="90%" testID="rival-sheet">
      {detail ? <RivalBody detail={detail} /> : null}
    </Sheet>
  );
}

function RivalBody({ detail }: { detail: RivalDetail }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const buy = () => {
    const state = useGameStore.getState().state;
    if (state) dispatch({ type: 'acquireRival', labId: state.playerLabId, targetLabId: detail.labId });
  };
  return (
    <View style={styles.body}>
      <View style={styles.head}>
        <View style={[styles.swatch, { backgroundColor: detail.color }]} />
        <View style={styles.flex}>
          <Text style={lineStyles.body}>{t('ui.race.detail.home', { region: detail.home })}</Text>
          <Text style={lineStyles.dim}>{detail.statusText}</Text>
        </View>
      </View>

      <SectionTitle>{t('ui.race.detail.buyout')}</SectionTitle>
      <Note tone={detail.buyout.ok ? 'info' : 'bad'} testID="rival-buyout">
        <View style={styles.line}>
          <Icon name={detail.buyout.ok ? 'check' : 'lock'} size={16} color={detail.buyout.ok ? colors.good : colors.bad} />
          <Text style={[lineStyles.body, styles.flex]}>{detail.buyout.text}</Text>
        </View>
      </Note>
      {detail.buyout.ok ? <Button label={t('ui.race.detail.buy', { price: detail.buyout.price })} variant="primary" onPress={buy} testID="rival-buy" /> : null}

      <SectionTitle>{t('ui.race.detail.strong')}</SectionTitle>
      {detail.strongIn.length === 0 ? <Text style={lineStyles.dim}>{t('ui.race.detail.noRegions')}</Text> : null}
      <View style={styles.chips}>
        {detail.strongIn.map((r) => (
          <View key={r} style={[styles.chip, { borderColor: detail.color }]}>
            <Text style={styles.chipText}>{r}</Text>
          </View>
        ))}
      </View>

      <SectionTitle>{t('ui.race.detail.ahead')}</SectionTitle>
      {detail.ahead.length === 0 ? <Text style={lineStyles.dim}>{t('ui.race.detail.aheadNothing')}</Text> : null}
      {detail.ahead.map((line) => (
        <View key={line} style={styles.line}>
          <Text style={[styles.arrow, { color: colors.bad }]}>▲</Text>
          <Text style={[lineStyles.body, styles.flex]}>{line}</Text>
        </View>
      ))}
      {detail.behind.length > 0 ? <SectionTitle>{t('ui.race.detail.behind')}</SectionTitle> : null}
      {detail.behind.map((line) => (
        <View key={line} style={styles.line}>
          <Text style={[styles.arrow, { color: colors.goodText }]}>▼</Text>
          <Text style={[lineStyles.body, styles.flex]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.s },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  swatch: { width: 14, height: 34, borderRadius: radius.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.s, paddingVertical: 2 },
  chipText: { ...voice.bodyStrong, color: colors.text, fontSize: type.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  arrow: { fontSize: 10, width: 14, textAlign: 'center' },
});
