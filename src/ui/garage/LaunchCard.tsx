import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Button } from '../components/Button';
import { Stamp } from '../components/Deco';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { colors, flatShadow, layer, spacing, type, voice } from '../theme';
import { useGarageStore } from './store';
import { generationLabel, gt } from './text';

/** The tabloid launch headline after shipping a model. */
export function LaunchCard() {
  const launch = useGarageStore((s) => s.launch);
  const content = useGarageStore((s) => s.content);
  const insets = useInsets();
  if (!launch) return null;
  const named = content.generations[launch.generation];
  const headline = named ? gt(named.headlineKey) : gt(content.endlessHeadlineKey, { n: launch.generation + 1 });
  const close = () => useGarageStore.getState().dismissLaunch();
  return (
    <Overlay visible layer={layer.event} onRequestClose={close} testID="garage-launch">
      <Pressable style={[styles.scrim, { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.m, paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl }]} onPress={close} accessibilityLabel={t('ui.garage.launch.continue')}>
        <Animated.View entering={ZoomIn.duration(260)} style={styles.paper}>
          <Stamp text={t('ui.garage.launch.kicker')} rotate={-4} size={16} />
          <Text style={styles.headline} testID="garage-launch-headline">
            {headline}
          </Text>
          <View style={styles.rule} />
          <Text style={styles.sub}>{t('ui.garage.launch.sub', { model: generationLabel(launch.generation), hype: launch.gain })}</Text>
          {named ? <Text style={styles.sub}>{t('ui.garage.ship.unlocks', { text: gt(named.unlockKey) })}</Text> : null}
          <Button label={t('ui.garage.launch.continue')} variant="ink" onPress={close} style={styles.button} testID="garage-launch-continue" />
        </Animated.View>
      </Pressable>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  paper: { maxWidth: 560, width: '100%', backgroundColor: colors.newsPaper, padding: spacing.l, gap: spacing.s, transform: [{ rotate: '-1deg' }], ...flatShadow(6, colors.newsInk) },
  headline: { ...voice.loudHeadline, color: colors.newsInk, fontSize: 34, lineHeight: 36 },
  rule: { height: 2, backgroundColor: colors.newsInk },
  sub: { ...voice.loudBody, color: colors.newsDim, fontSize: type.s },
  button: { alignSelf: 'flex-start', marginTop: spacing.s },
});
