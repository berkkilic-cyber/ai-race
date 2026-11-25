import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { trackDemoGateSeenOnce } from '../analytics/hooks';
import { t } from '../i18n';
import { cased } from '../locale';
import { Text } from '../locale/Text';
import { colors, shape, type, voice } from '../theme';
import { showDemoGate } from './gate';

/**
 * The Garage's "next stage" goal when that stage is outside the demo: its name and an
 * "In the full game" line; a tap opens the waitlist card.
 */
export function DemoNextStage({ name }: { name: string }) {
  useEffect(() => trackDemoGateSeenOnce('garageStage'), []);
  const title = t('ui.garage.stage.nextName', { name });
  return (
    <Pressable style={styles.goal} onPress={() => showDemoGate('garageStage', { stage: name })} accessibilityRole="button" testID="demo-next-stage">
      <Text style={styles.name} numberOfLines={1}>
        {cased(styles.name, title)}
      </Text>
      <Text style={styles.text} numberOfLines={1}>
        {t('ui.demo.stage.locked')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  goal: { marginTop: 3, paddingTop: 2, borderTopWidth: shape.hairline, borderColor: colors.border },
  name: { ...voice.calmLabel, color: colors.text, fontSize: 10, lineHeight: 13 },
  text: { ...voice.body, color: colors.player, fontSize: type.xs, lineHeight: 13 },
});
