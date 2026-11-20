import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ContentPack } from '@/engine';

import { Button } from '../components/Button';
import { t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, touch, type } from '../theme';

/** Default home: the first region no rival starts in. */
export function defaultHomeRegion(pack: ContentPack): string {
  return (pack.regions.find((r) => !pack.rivals.some((rv) => rv.homeRegion === r.id)) ?? pack.regions[0]).id;
}

/** Placeholder start screen: lab name, founder, home region, Found the lab. `/?autostart=1` starts at once. */
export function StartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ autostart?: string; seed?: string }>();
  const pack = useGameStore((s) => s.pack);
  const newGame = useGameStore((s) => s.newGame);
  const [name, setName] = useState('');
  const [founderId, setFounderId] = useState(pack.founders[0].id);
  const [home, setHome] = useState(() => defaultHomeRegion(pack));

  const found = (overrides?: { seed?: number }) => {
    newGame({ playerName: name.trim() || t('ui.start.defaultName'), founderId, homeRegion: home, ...overrides });
    router.replace('/game');
  };

  useEffect(() => {
    if (params.autostart === '1') {
      const seed = params.seed ? Number(params.seed) : undefined;
      newGame({
        playerName: t('ui.start.defaultName'),
        founderId: pack.founders[0].id,
        homeRegion: defaultHomeRegion(pack),
        ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      });
      router.replace('/game');
    }
  }, [params.autostart, params.seed, newGame, pack, router]);

  const regions = pack.regions.slice().sort((a, b) => t(a.nameKey).localeCompare(t(b.nameKey)));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('ui.start.title')}</Text>

        <Text style={styles.label}>{t('ui.start.labName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('ui.start.defaultName')}
          placeholderTextColor={colors.dim}
          maxLength={32}
          autoCorrect={false}
          testID="start-name"
        />

        <Text style={styles.label}>{t('ui.start.founder')}</Text>
        {pack.founders.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFounderId(f.id)}
            style={[styles.option, founderId === f.id && styles.selected]}
            accessibilityRole="radio"
            accessibilityState={{ selected: founderId === f.id }}
            testID={`founder-${f.id}`}
          >
            <Text style={styles.optionTitle}>{t(f.nameKey)}</Text>
            <Text style={styles.optionDesc}>{t(f.descKey)}</Text>
          </Pressable>
        ))}

        <Text style={styles.label}>{t('ui.start.home')}</Text>
        <View style={styles.regions}>
          {regions.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => setHome(r.id)}
              style={[styles.chip, home === r.id && styles.selected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: home === r.id }}
            >
              <Text style={[styles.chipText, home === r.id && styles.chipTextSelected]}>{t(r.nameKey)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t('ui.start.found')} variant="primary" onPress={() => found()} testID="start-found" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.l, gap: spacing.s, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '800', marginBottom: spacing.s },
  label: { color: colors.dim, fontSize: type.s, marginTop: spacing.m, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    minHeight: touch,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: type.m,
    paddingHorizontal: spacing.m,
  },
  option: { backgroundColor: colors.surface, borderRadius: radius.s, borderWidth: 1, borderColor: colors.border, padding: spacing.m, gap: 2 },
  selected: { borderColor: colors.player, backgroundColor: colors.raised },
  optionTitle: { color: colors.text, fontSize: type.m, fontWeight: '700' },
  optionDesc: { color: colors.dim, fontSize: type.s },
  regions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: {
    minHeight: touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.m,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontSize: type.s },
  chipTextSelected: { color: colors.player, fontWeight: '700' },
  footer: { padding: spacing.l, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
});
