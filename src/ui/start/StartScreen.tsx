import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { Button } from '../components/Button';
import { usePackEntry } from '../hooks/useGame';
import { useInsets } from '../hooks/useInsets';
import { dismissKeyboardOnTap, useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { regionName, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing } from '../theme';
import { FounderStep } from './FounderStep';
import { HowToSheet } from './HowToSheet';
import { defaultHomeRegion, missingText, randomLabName, validateLabName } from './logic';
import { NameStep } from './NameStep';
import { RegionListSheet } from './RegionListSheet';
import { RegionStep } from './RegionStep';
import { StepIndicator } from './StepIndicator';
import { useWide } from './useWide';

const STEP_LABELS = ['ui.start.step.name', 'ui.start.step.founder', 'ui.start.step.region'] as const;
const LAST = STEP_LABELS.length - 1;

/**
 * Start flow in three steps on one route: name, founder, home region, then
 * Found the lab. `/?autostart=1` (optionally `&seed=`) starts a run at once with defaults.
 */
export function StartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ autostart?: string; seed?: string }>();
  const { pack, geometry, labNames } = usePackEntry();
  const newGame = useGameStore((s) => s.newGame);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [founderId, setFounderId] = useState<string | null>(pack.founders[0]?.id ?? null);
  const [home, setHome] = useState<string | null>(null);
  const [howTo, setHowTo] = useState(false);
  const [list, setList] = useState(false);
  const [focus, setFocus] = useState<{ regionId: string; nonce: number } | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const wide = useWide();
  const insets = useInsets();
  const keyboard = useKeyboardVisible();

  useEffect(() => {
    if (params.autostart !== '1') return;
    const seed = params.seed ? Number(params.seed) : undefined;
    newGame({
      playerName: t('ui.start.defaultName'),
      founderId: pack.founders[0].id,
      homeRegion: defaultHomeRegion(pack),
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
    });
    router.replace('/game');
  }, [params.autostart, params.seed, newGame, pack, router]);

  const goTo = useCallback((next: number) => {
    Keyboard.dismiss();
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const nameCheck = validateLabName(name);
  const missing = missingText({ name, founderId, homeRegion: home });

  const found = () => {
    if (missing || !nameCheck.ok || !founderId || !home) return;
    newGame({ playerName: nameCheck.name, founderId, homeRegion: home });
    router.replace('/game');
  };

  const next = () => {
    Keyboard.dismiss();
    if (step === 0 && !nameCheck.ok) return;
    if (step === 1 && !founderId) return;
    if (step < LAST) goTo(step + 1);
    else found();
  };

  let primaryLabel = t('ui.start.next');
  let primarySub: string | undefined;
  let primaryDisabled = false;
  if (step === 0 && !nameCheck.ok) {
    primaryDisabled = true;
    primarySub = missing ?? undefined;
  } else if (step === 1 && !founderId) {
    primaryDisabled = true;
    primarySub = t('ui.start.missing.founder');
  } else if (step === LAST) {
    primaryLabel = t('ui.start.foundLab');
    primaryDisabled = missing !== null;
    const founder = pack.founders.find((f) => f.id === founderId);
    primarySub = missing ?? (founder && home ? t('ui.start.summary', { founder: t(founder.nameKey), region: regionName(home) }) : undefined);
  }

  const pickFromList = (id: string) => {
    Keyboard.dismiss();
    setHome(id);
    setList(false);
    setFocus((f) => ({ regionId: id, nonce: (f?.nonce ?? 0) + 1 }));
  };

  const labels = STEP_LABELS.map((k) => t(k));
  const primary = (
    <Button
      label={primaryLabel}
      sublabel={primarySub}
      variant="primary"
      disabled={primaryDisabled}
      onPress={next}
      style={[styles.primary, wide && styles.primaryWide, step === LAST && styles.found]}
      testID={step === LAST ? 'start-found' : 'start-next'}
    />
  );
  const back = <Button label={t('ui.start.back')} variant="ghost" onPress={() => goTo(step - 1)} style={styles.back} testID="start-back" />;
  const stepView =
    step === 0 ? (
      <NameStep
        name={name}
        onName={setName}
        onDice={() => setName((n) => randomLabName(labNames, n))}
        onHowTo={() => setHowTo(true)}
        onSubmit={next}
        wide={wide}
        compact={wide && keyboard}
      />
    ) : step === 1 ? (
      <FounderStep founders={pack.founders} selected={founderId} onSelect={setFounderId} wide={wide} />
    ) : (
      <RegionStep
        pack={pack}
        geometry={geometry}
        selected={home}
        onSelect={setHome}
        onOpenList={() => setList(true)}
        focus={focus}
        wide={wide}
        action={wide ? primary : undefined}
      />
    );

  // Safe area applied once, explicitly: the background runs to the screen edges, the
  // content sits inside the insets, and the sheets cover the screen with their own
  // content inside the safe area. The keyboard-avoiding view shrinks the content so the
  // field and the Next button stay above the keyboard (in landscape it takes most of the
  // height); a tap on the background dismisses the keyboard.
  return (
    <View style={styles.safe} {...dismissKeyboardOnTap}>
      <View style={[styles.inset, { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left }]}>
        <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
          {wide ? (
            <>
              {step === 0 ? (
                <ScrollView style={styles.scroll} contentContainerStyle={[styles.wideContent, styles.grow]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  {stepView}
                </ScrollView>
              ) : (
                <View style={styles.wideContent}>{stepView}</View>
              )}
              <View style={styles.wideFooter}>
                <View style={styles.side}>{step > 0 ? back : null}</View>
                <StepIndicator labels={labels} step={step} onStep={goTo} compact />
                <View style={[styles.side, styles.sideRight]}>{step < LAST ? primary : null}</View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <StepIndicator labels={labels} step={step} onStep={goTo} />
              </View>
              <ScrollView
                ref={scroll}
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                {stepView}
              </ScrollView>
              <View style={styles.footer}>
                {step > 0 ? back : null}
                {primary}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
      <HowToSheet visible={howTo} onClose={() => setHowTo(false)} />
      <RegionListSheet visible={list} regions={pack.regions} selected={home} onSelect={pickFromList} onClose={() => setList(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  inset: { flex: 1 },
  avoid: { flex: 1 },
  grow: { flexGrow: 1 },
  header: { paddingHorizontal: spacing.l, paddingTop: spacing.m, paddingBottom: spacing.s },
  scroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.xl },
  footer: {
    flexDirection: 'row',
    gap: spacing.s,
    padding: spacing.l,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  back: { minWidth: 96 },
  primary: { flex: 1, minHeight: 52 },
  primaryWide: { flex: 0, minHeight: 48, minWidth: 160 },
  found: { minHeight: 60 },
  wideContent: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.l, paddingBottom: spacing.s },
  wideFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.s,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  side: { width: 200, flexDirection: 'row' },
  sideRight: { justifyContent: 'flex-end' },
});
