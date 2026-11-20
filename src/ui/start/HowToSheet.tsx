import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';

export interface HowToSheetProps {
  visible: boolean;
  onClose: () => void;
}

const CARDS = ['spread', 'trees', 'compute', 'meters'] as const;

/** Theme words the how-to cards mention. */
function terms(): Record<string, string> {
  return {
    users: t('term.users'),
    hype: t('term.hype'),
    cash: t('term.cash'),
    compute: t('term.compute'),
    capability: t('term.tree.capability'),
    reach: t('term.tree.reach'),
    shadow: t('term.tree.shadow'),
    regulation: t('term.regulation'),
    backlash: t('term.backlash'),
    rival: t('term.rival'),
  };
}

/** Four short cards on how a run works. */
export function HowToSheet({ visible, onClose }: HowToSheetProps) {
  const params = terms();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.start.howTo')} maxHeight="88%" testID="start-howto">
      {CARDS.map((card, i) => (
        <View key={card} style={styles.card}>
          <View style={styles.num}>
            <Text style={styles.numText}>{i + 1}</Text>
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{t(`ui.start.howTo.${card}.title`, params)}</Text>
            <Text style={styles.body}>{t(`ui.start.howTo.${card}.body`, params)}</Text>
          </View>
        </View>
      ))}
      <Button label={t('ui.start.howTo.close')} variant="primary" onPress={onClose} testID="start-howto-close" />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.m,
    backgroundColor: colors.raised,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
  },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.player, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.onPlayer, fontSize: type.s, fontWeight: '800' },
  text: { flex: 1, gap: spacing.xs },
  title: { color: colors.text, fontSize: type.m, fontWeight: '700' },
  body: { color: colors.dim, fontSize: type.s, lineHeight: 19 },
});
