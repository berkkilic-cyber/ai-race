/**
 * The run menu: reachable at any time during a race from one small button (the left rail in
 * wide mode, the top bar in narrow mode), and from the device back gesture or button. Opening
 * it pauses the game; tapping outside or Resume closes it and gives the speed back.
 * Options: Resume; Save and quit (run kept, back to the start screen); Restart (same seed and
 * setup, confirmed); Abandon run (confirmed, save discarded).
 *
 * The host (RunMenuHost, mounted once in the shell) also runs the autosave (runSave.ts) while
 * the race screen is up. Drawn in the tree (Overlay), never a native Modal.
 */
import * as Router from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { create } from 'zustand';

import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { layoutModeFor, useLayoutMode } from '../hooks/useLayoutMode';
import { Icon } from '../icons';
import { labName, t } from '../i18n';
import { useGameStore, type Speed } from '../store/game';
import { clearRunSave, restartSetup, saveCurrentRun, startAutosave } from '../store/runSave';
import { useTutorialStore } from '../tutorial/store';
import { colors, flatShadow, layer, layout, radius, shape, spacing, touch, type, voice } from '../theme';

type Confirm = null | 'restart' | 'abandon';

/**
 * expo-router's usePreventRemove, or a no-op where the router is mocked without it (tests that
 * render the shell). Picked once at load, so the hook order never changes between renders.
 */
const usePreventRemove: (prevent: boolean, callback: () => void) => void =
  typeof (Router as { usePreventRemove?: unknown }).usePreventRemove === 'function' ? Router.usePreventRemove : () => undefined;

interface RunMenuStore {
  open: boolean;
  /** Speed before the menu paused the run. */
  prevSpeed: Speed;
  confirm: Confirm;
}

export const useRunMenuStore = create<RunMenuStore>()(() => ({ open: false, prevSpeed: 1, confirm: null }));

/** Opens the menu and pauses the run (no-op without a run in progress or when already open). */
export function openRunMenu(): void {
  const menu = useRunMenuStore.getState();
  const game = useGameStore.getState();
  if (menu.open || game.state?.status !== 'running') return;
  useRunMenuStore.setState({ open: true, prevSpeed: game.speed, confirm: null });
  game.setSpeed(0);
}

/**
 * Closes the menu and gives the speed back: the speed before it opened, or 1x when that was
 * paused (Resume means play), unless a tutorial caption holds the pause (it resumes itself).
 */
export function closeRunMenu(): void {
  const menu = useRunMenuStore.getState();
  if (!menu.open) return;
  useRunMenuStore.setState({ open: false, confirm: null });
  const holdPause = useTutorialStore.getState().showing;
  const speed: Speed = menu.prevSpeed > 0 || holdPause ? menu.prevSpeed : 1;
  if (useGameStore.getState().state?.status === 'running') useGameStore.getState().setSpeed(speed);
}

/** Closes without touching the speed (the run is being left or replaced). */
function dismissRunMenu(): void {
  useRunMenuStore.setState({ open: false, confirm: null });
}

export interface RunMenuButtonProps {
  /** 'rail': the wide-mode left rail (renders nothing in narrow mode); 'bar': the narrow top bar (nothing in wide mode). */
  placement: 'rail' | 'bar';
}

/** The one small button that opens the run menu. */
export function RunMenuButton({ placement }: RunMenuButtonProps) {
  const wide = useLayoutMode() === 'wide';
  if ((placement === 'rail') !== wide) return null;
  return (
    <Pressable
      onPress={openRunMenu}
      style={({ pressed }) => [placement === 'rail' ? styles.railButton : styles.barButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('ui.sprint.menu.a11y')}
      hitSlop={placement === 'bar' ? 6 : 0}
      testID="run-menu-button"
    >
      <Icon name="settings" size={18} color={colors.dim} accent={colors.dim} />
      {placement === 'rail' ? (
        <Text style={styles.railLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {t('ui.sprint.menu.button')}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * ORCHESTRATOR SLOT: settings rows from other tasks (sound, language) are mounted here, one
 * element per row, e.g. `[<SoundRow key="sound" />, <LanguageRow key="lang" />]`. The section
 * (with its "Settings" heading) shows only when the list is not empty.
 */
const SETTINGS_ROWS: ReactNode[] = [];

function SettingsSlot() {
  if (SETTINGS_ROWS.length === 0) return <View testID="run-menu-settings-slot" />;
  return (
    <View style={styles.settings} testID="run-menu-settings-slot">
      <Text style={styles.settingsTitle}>{t('ui.sprint.menu.settings')}</Text>
      {SETTINGS_ROWS}
    </View>
  );
}

/**
 * Mount once in the race shell, after the content: the menu overlay, the autosave, and the
 * back gesture / button opening the menu instead of leaving the race.
 */
export function RunMenuHost() {
  const open = useRunMenuStore((s) => s.open);
  const running = useGameStore((s) => s.state?.status === 'running');

  useEffect(() => startAutosave(), []);
  // Other pausers (tutorial captions, moment coach lines) give their speed back when they end;
  // while the menu is open that would run the game under it. Hold the pause, and remember the
  // speed they wanted for Resume.
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.speed > 0 && s.speed !== prev.speed && useRunMenuStore.getState().open) {
          useRunMenuStore.setState({ prevSpeed: s.speed });
          s.setSpeed(0);
        }
      }),
    [],
  );
  // Leaving the screen: never leave the menu open (and the run paused) behind.
  useEffect(() => () => dismissRunMenu(), []);

  // Back gesture / navigation back while a run is on: open the menu instead. Native only: on
  // web the hook also adds a "leave site?" prompt to every reload and link (the run is saved on
  // pagehide there instead).
  usePreventRemove(running && Platform.OS !== 'web', () => openRunMenu());
  // Android back with nothing to go back to (the race replaced the start screen) would close the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useGameStore.getState().state?.status !== 'running') return false;
      if (useRunMenuStore.getState().open) closeRunMenu();
      else openRunMenu();
      return true;
    });
    return () => sub.remove();
  }, []);

  return <RunMenuOverlay visible={open && running} />;
}

function RunMenuOverlay({ visible }: { visible: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const wide = layoutModeFor(width, height) === 'wide';
  const confirm = useRunMenuStore((s) => s.confirm);
  const name = useGameStore((s) => (s.state ? labName(s.state.labs[s.state.playerLabId]) : ''));
  const day = useGameStore((s) => (s.state?.tick ?? 0) + 1);

  const saveAndQuit = async () => {
    dismissRunMenu();
    await saveCurrentRun('menu');
    // No run in the store: the shell sends the player to the start screen (useEndNavigation).
    useGameStore.getState().reset();
  };
  const restart = () => {
    const state = useGameStore.getState().state;
    if (!state) return;
    dismissRunMenu();
    void clearRunSave();
    useGameStore.getState().newGame(restartSetup(state));
  };
  const abandon = () => {
    dismissRunMenu();
    void clearRunSave();
    useGameStore.getState().reset();
  };

  const scrim = { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.m, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l };
  const cardSize = wide ? { maxHeight: Math.max(0, height - insets.top - insets.bottom - 2 * spacing.m) } : null;

  let body: ReactNode;
  if (confirm) {
    const k = confirm === 'restart' ? 'restartConfirm' : 'abandonConfirm';
    body = (
      <>
        <Text style={styles.title} accessibilityRole="header">
          {t(`ui.sprint.menu.${k}.title`)}
        </Text>
        <Text style={styles.body}>{t(`ui.sprint.menu.${k}.body`)}</Text>
        <View style={styles.confirmRow}>
          <Button label={t('ui.sprint.menu.cancel')} variant="ghost" onPress={() => useRunMenuStore.setState({ confirm: null })} style={styles.confirmBtn} testID="run-menu-cancel" />
          <Button
            label={t(`ui.sprint.menu.${k}.confirm`)}
            variant={confirm === 'abandon' ? 'danger' : 'primary'}
            onPress={confirm === 'restart' ? restart : abandon}
            style={styles.confirmBtn}
            testID={`run-menu-${confirm}-confirm`}
          />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {t('ui.sprint.menu.title')}
          </Text>
          <Text style={styles.summary} numberOfLines={1}>
            {t('ui.sprint.menu.summary', { lab: name, day })}
          </Text>
        </View>
        <Button label={t('ui.sprint.menu.resume')} variant="primary" onPress={closeRunMenu} style={styles.option} testID="run-menu-resume" />
        <View style={[styles.grid, wide && styles.gridWide]}>
          <Button label={t('ui.sprint.menu.saveQuit')} sublabel={t('ui.sprint.menu.saveQuitHint')} onPress={() => void saveAndQuit()} style={[styles.option, wide && styles.optionWide]} testID="run-menu-save-quit" />
          <Button label={t('ui.sprint.menu.restart')} sublabel={t('ui.sprint.menu.restartHint')} onPress={() => useRunMenuStore.setState({ confirm: 'restart' })} style={[styles.option, wide && styles.optionWide]} testID="run-menu-restart" />
          <Button label={t('ui.sprint.menu.abandon')} sublabel={t('ui.sprint.menu.abandonHint')} variant="ghost" onPress={() => useRunMenuStore.setState({ confirm: 'abandon' })} style={[styles.option, wide && styles.optionWide]} testID="run-menu-abandon" />
        </View>
        <SettingsSlot />
      </>
    );
  }

  return (
    <Overlay visible={visible} layer={layer.event + 5} onRequestClose={confirm ? () => useRunMenuStore.setState({ confirm: null }) : closeRunMenu} testID="run-menu">
      <View style={[styles.scrim, scrim]}>
        {/* Tapping outside the card closes the menu and resumes. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeRunMenu} accessibilityRole="button" accessibilityLabel={t('ui.sprint.menu.resume')} testID="run-menu-scrim" />
        <View style={[styles.card, wide && styles.cardWide, cardSize]}>
          <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>{body}</ScrollView>
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  railButton: { height: layout.railItemHeight, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 'auto', marginBottom: spacing.s },
  railLabel: { ...voice.calmHeading, color: colors.dim, fontSize: 10, lineHeight: type.s + 5, letterSpacing: 0, maxWidth: layout.railWidth - 6, textAlign: 'center' },
  barButton: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    borderTopWidth: 4,
    borderTopColor: colors.player,
    overflow: 'hidden',
    ...flatShadow(),
  },
  cardWide: { maxWidth: 560 },
  content: { padding: spacing.xl, gap: spacing.m },
  contentWide: { padding: spacing.l, gap: spacing.s },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.m },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl },
  summary: { ...voice.body, color: colors.dim, fontSize: type.s, flexShrink: 1 },
  body: { ...voice.body, color: colors.text, fontSize: type.m, lineHeight: 22 },
  grid: { gap: spacing.s },
  gridWide: { flexDirection: 'row' },
  option: { minHeight: 48 },
  optionWide: { flex: 1, minHeight: 64 },
  confirmRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  confirmBtn: { flex: 1, minHeight: 48 },
  settings: { gap: spacing.s, borderTopWidth: shape.hairline, borderColor: colors.border, paddingTop: spacing.s },
  settingsTitle: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
});
