import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '../icons';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import type { DescribedLine } from './describe';

/** Small capitals heading of a panel section. */
export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** A described line: a coloured mark and the sentence, green when it helps the player, red when it hurts. */
export function ToneLine({ line }: { line: DescribedLine }) {
  const good = line.tone === 'good';
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: good ? colors.good : colors.bad }]} />
      <Text style={[styles.text, { color: good ? colors.goodText : colors.bad }]}>{line.text}</Text>
    </View>
  );
}

/** A requirement: tick or cross, the sentence, and where to get it when missing. */
export function TickLine({ met, text, help }: { met: boolean; text: string; help?: string }) {
  return (
    <View style={styles.row} accessibilityLabel={`${met ? '✓' : '✗'} ${text}${help ? `. ${help}` : ''}`}>
      <View style={[styles.tick, { borderColor: met ? colors.good : colors.bad }]}>
        <Icon name={met ? 'check' : 'close'} size={12} color={met ? colors.good : colors.bad} strokeWidth={2.6} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.text, { color: met ? colors.text : colors.bad }]}>{text}</Text>
        {help && !met ? <Text style={styles.help}>{help}</Text> : null}
      </View>
    </View>
  );
}

/** An icon, a caption and a value on the right (income lines, compute sources). */
export function ValueLine({ icon, text, value, tone, accent }: { icon?: IconName | (string & {}); text: string; value?: string; tone?: 'good' | 'bad' | 'dim'; accent?: string }) {
  const color = tone === 'good' ? colors.goodText : tone === 'bad' ? colors.bad : colors.text;
  return (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={18} color={colors.text} accent={accent ?? colors.player} /> : null}
      <Text style={[styles.text, styles.flex, { color: colors.text }]}>{text}</Text>
      {value ? <Text style={[styles.value, { color }]}>{value}</Text> : null}
    </View>
  );
}

/** A boxed note: the important sentence of a panel (bad = red frame). */
export function Note({ tone = 'info', children, testID }: { tone?: 'info' | 'bad'; children: ReactNode; testID?: string }) {
  return (
    <View style={[styles.note, { borderColor: tone === 'bad' ? colors.bad : colors.border }]} testID={testID}>
      {children}
    </View>
  );
}

export const lineStyles = StyleSheet.create({
  body: { ...voice.body, color: colors.text, fontSize: type.s, lineHeight: 18 },
  dim: { ...voice.body, color: colors.dim, fontSize: type.xs + 1, lineHeight: 16 },
  strong: { ...voice.bodyStrong, color: colors.text, fontSize: type.m, lineHeight: 20 },
  bad: { ...voice.bodyStrong, color: colors.bad, fontSize: type.s + 1, lineHeight: 19 },
});

const styles = StyleSheet.create({
  section: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs, letterSpacing: 0.6, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 22 },
  flex: { flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
  text: { ...voice.bodyStrong, flex: 1, fontSize: type.s, lineHeight: 18 },
  help: { ...voice.body, color: colors.dim, fontSize: type.xs + 1, lineHeight: 15 },
  tick: { width: 18, height: 18, borderWidth: 1.5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  value: { ...voice.calmNumber, fontSize: type.s, ...tabular },
  note: { borderWidth: shape.outline, borderRadius: radius.s, padding: spacing.m, gap: spacing.xs, backgroundColor: colors.raised },
});
