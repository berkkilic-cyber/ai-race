import { StyleSheet, Switch, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, spacing, type, voice } from '../theme';
import { feedback } from './cues';
import { useFeelSettings } from './settings';

function Row({ label, hint, value, onChange, testID }: { label: string; hint: string; value: boolean; onChange: (on: boolean) => void; testID: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} testID={testID} trackColor={{ true: colors.player, false: colors.raised }} />
    </View>
  );
}

/** Sound, music and haptics switches, for any settings panel (Garage settings; the race's run menu at merge). */
export function SoundSettingsRows() {
  const sound = useFeelSettings((s) => s.sound);
  const haptics = useFeelSettings((s) => s.haptics);
  const music = useFeelSettings((s) => s.music);
  return (
    <View style={styles.rows} testID="feel-settings">
      <Row
        label={t('ui.feel.sound')}
        hint={t('ui.feel.soundHint')}
        value={sound}
        onChange={(on) => {
          useFeelSettings.getState().setSound(on);
          if (on) feedback('tap');
        }}
        testID="feel-sound"
      />
      <Row
        label={t('ui.feel.music')}
        hint={t('ui.feel.musicHint')}
        value={music}
        onChange={(on) => {
          useFeelSettings.getState().setMusic(on);
          feedback('tap');
        }}
        testID="feel-music"
      />
      <Row
        label={t('ui.feel.haptics')}
        hint={t('ui.feel.hapticsHint')}
        value={haptics}
        onChange={(on) => {
          useFeelSettings.getState().setHaptics(on);
          if (on) feedback('tap');
        }}
        testID="feel-haptics"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: spacing.m },
  text: { flex: 1 },
  label: { ...voice.bodyStrong, color: colors.text, fontSize: type.m },
  hint: { ...voice.body, color: colors.dim, fontSize: type.xs },
});
