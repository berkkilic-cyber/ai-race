import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';

import { getFounderStart } from '@/engine';

import { ModalCard } from '../components/ModalCard';
import { clearRunSave, loadRunSave, restoreRun, type RunSave } from '../store/runSave';
import { ContinueCard } from './ContinueCard';
import { loadRunLengthChoice, runLengthOptions, runLengthParam, saveRunLengthChoice } from './runLength';

import { Button } from '../components/Button';
import { Ground } from '../components/Deco';
import { usePackEntry } from '../hooks/useGame';
import { useInsets } from '../hooks/useInsets';
import { dismissKeyboardOnTap, useKeyboardVisible } from '../hooks/useKeyboardVisible';
import { regionName, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, shape, spacing, type } from '../theme';
import { FounderStep } from './FounderStep';
import { BuildStamp } from '../diagnostics/BuildStamp';
import { HowToSheet } from './HowToSheet';
import { difficultyOptions, difficultyParam, loadDifficultyChoice, saveDifficultyChoice } from './difficulty';
import { defaultHomeRegion, missingText, randomLabName, validateLabName } from './logic';
import { NameStep } from './NameStep';
import { RegionListSheet } from './RegionListSheet';
import { RegionStep } from './RegionStep';
import { StepIndicator } from './StepIndicator';
import { useWide } from './useWide';

/** Runs `go` once `ready` settles (at once without it). */
function enterWhenReady(ready: Promise<unknown> | undefined, go: () => void): Promise<void> {
  if (!ready) {
    go();
    return Promise.resolve();
  }
  return ready.then(go, go);
}

const STEP_LABELS = ['ui.start.step.name', 'ui.start.step.founder', 'ui.start.step.region'] as const;
const LAST = STEP_LABELS.length - 1;

/**
 * Start flow in three steps on one route: name, founder, home region, then
 * Found the lab. `/?autostart=1` (optionally `&seed=`) starts a run at once with defaults.
 */
export interface StartScreenProps {
  /**
   * Resolves once the game screen's code is loaded (web splits routes into chunks); the
   * screen waits for it before navigating so the router never requires a missing chunk.
   */
  beforeEnter?: Promise<unknown>;
}

export function StartScreen({ beforeEnter }: StartScreenProps = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ autostart?: string; seed?: string; difficulty?: string; runLength?: string }>();
  const { pack, geometry, labNames } = usePackEntry();
  const newGame = useGameStore((s) => s.newGame);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [founderId, setFounderId] = useState<string | null>(pack.founders[0]?.id ?? null);
  const [home, setHome] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | undefined>(undefined);
  const [runLength, setRunLength] = useState<string | undefined>(undefined);
  /** The saved run, if any (null: none or not read yet); the Continue card shows until the player picks "new lab". */
  const [save, setSave] = useState<RunSave | null>(null);
  const [showContinue, setShowContinue] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [list, setList] = useState(false);
  const [focus, setFocus] = useState<{ regionId: string; nonce: number } | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const wide = useWide();
  const insets = useInsets();
  const keyboard = useKeyboardVisible();

  // Preselect the remembered level (the easiest before the tutorial is done).
  useEffect(() => {
    let live = true;
    void loadDifficultyChoice(pack).then((id) => {
      if (live) setDifficulty((current) => current ?? id);
    });
    return () => {
      live = false;
    };
  }, [pack]);
  // Preselect the remembered run length (the shortest until a run has been finished) and read the save.
  useEffect(() => {
    let live = true;
    void loadRunLengthChoice(pack).then((id) => {
      if (live) setRunLength((current) => current ?? id);
    });
    void loadRunSave().then((s) => {
      if (live) setSave(s);
    });
    return () => {
      live = false;
    };
  }, [pack]);
  const pickRunLength = useCallback((id: string) => {
    setRunLength(id);
    saveRunLengthChoice(id);
  }, []);
  const continueRun = () => {
    if (!save) return;
    restoreRun(save);
    void enterWhenReady(beforeEnter, () => router.replace('/game'));
  };

  const pickDifficulty = useCallback((id: string) => {
    setDifficulty(id);
    saveDifficultyChoice(id);
  }, []);

  useEffect(() => {
    if (params.autostart !== '1') return;
    const seed = params.seed ? Number(params.seed) : undefined;
    const level = difficultyParam(pack, params.difficulty);
    const length = runLengthParam(pack, params.runLength);
    newGame({
      playerName: t('ui.start.defaultName'),
      founderId: pack.founders[0].id,
      homeRegion: defaultHomeRegion(pack),
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      ...(level ? { difficulty: level } : {}),
      ...(length ? { runLength: length } : {}),
    });
    let live = true;
    void enterWhenReady(beforeEnter, () => {
      if (live) router.replace('/game');
    });
    return () => {
      live = false;
    };
  }, [params.autostart, params.seed, params.difficulty, params.runLength, newGame, pack, router, beforeEnter]);

  const goTo = useCallback((next: number) => {
    Keyboard.dismiss();
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const nameCheck = validateLabName(name);
  const missing = missingText({ name, founderId, homeRegion: home });

  const found = (discardConfirmed = false) => {
    if (missing || !nameCheck.ok || !founderId || !home) return;
    // A saved run is only thrown away once the player says so.
    if (save && !discardConfirmed) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    if (save) {
      void clearRunSave();
      setSave(null);
    }
    newGame({ playerName: nameCheck.name, founderId, homeRegion: home, ...(difficulty ? { difficulty } : {}), ...(runLength ? { runLength } : {}) });
    void enterWhenReady(beforeEnter, () => router.replace('/game'));
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
      <FounderStep
        founders={pack.founders}
        selected={founderId}
        onSelect={setFounderId}
        wide={wide}
        difficulties={difficultyOptions(pack)}
        difficulty={difficulty}
        onDifficulty={pickDifficulty}
        runLengths={runLengthOptions(pack)}
        runLength={runLength}
        onRunLength={pickRunLength}
        starts={Object.fromEntries(pack.founders.map((f) => [f.id, getFounderStart(pack, f.id, difficulty, runLength)]))}
      />
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
      <Ground />
      <View style={[styles.inset, { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left }]}>
        <KeyboardAvoidingView style={styles.avoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
          {save && showContinue ? (
            <ScrollView style={styles.scroll} contentContainerStyle={[wide ? styles.wideContent : styles.content, styles.grow]}>
              <ContinueCard save={save} pack={pack} onContinue={continueRun} onNew={() => setShowContinue(false)} wide={wide} />
            </ScrollView>
          ) : wide ? (
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
      {/* Which build is running (long-press two seconds: touch diagnostics on the map). */}
      <BuildStamp style={[styles.stamp, { top: insets.top + 2, right: insets.right + spacing.s }]} />
      <HowToSheet visible={howTo} onClose={() => setHowTo(false)} />
      <RegionListSheet visible={list} regions={pack.regions} selected={home} onSelect={pickFromList} onClose={() => setList(false)} />
      <ModalCard visible={confirmDiscard} title={t('ui.sprint.discard.title')} tone="bad" onRequestClose={() => setConfirmDiscard(false)} testID="discard-confirm">
        <Text style={styles.discardBody}>
          {save ? t('ui.sprint.discard.body', { lab: save.state.labs[save.state.playerLabId].name, day: save.state.tick + 1 }) : ''}
        </Text>
        <View style={styles.discardRow}>
          <Button label={t('ui.sprint.discard.cancel')} variant="ghost" onPress={() => setConfirmDiscard(false)} style={styles.discardBtn} testID="discard-cancel" />
          <Button label={t('ui.sprint.discard.confirm')} variant="danger" onPress={() => found(true)} style={styles.discardBtn} testID="discard-confirm-button" />
        </View>
      </ModalCard>
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
    borderTopWidth: shape.hairline,
    borderColor: colors.border,
    backgroundColor: colors.chrome,
  },
  side: { width: 200, flexDirection: 'row' },
  sideRight: { justifyContent: 'flex-end' },
  stamp: { position: 'absolute' },
  discardBody: { color: colors.text, fontSize: type.m, lineHeight: 22 },
  discardRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  discardBtn: { flex: 1, minHeight: 48 },
});
