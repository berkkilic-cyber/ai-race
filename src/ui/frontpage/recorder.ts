/**
 * Records the story (./story.ts) of the run in the game store, for the end screen's front
 * page and share text. One store subscription, O(1) per tick plus new news items. The story
 * is written to storage now and then (every STORY_WRITE_TICKS ticks of play, on going to the
 * background and when the run leaves the store), so a resumed run keeps its early history.
 */
import { AppState } from 'react-native';

import type { GameState } from '@/engine';

import { useGameStore } from '../store/game';
import { readValue, writeValue } from '../tutorial/storage';
import { createRecorder, observe, type RunStory, type StoryRecorder } from './story';

export const STORY_KEY = 'ai-race.story.v1';
/** Ticks of play between story writes. */
export const STORY_WRITE_TICKS = 120;

let recorder: StoryRecorder | null = null;
let stored: RunStory | null = null;
let writtenTick = -1;

function write(): void {
  if (!recorder) return;
  writtenTick = recorder.story.lastTick;
  stored = recorder.story;
  void writeValue(STORY_KEY, JSON.stringify(recorder.story)).catch(() => undefined);
}

/** Feeds a state to the recorder, starting a new story for a new run (or a restart). Exported for tests. */
export function recordState(state: GameState | null): void {
  if (!state) {
    if (recorder && recorder.story.lastTick !== writtenTick) write();
    return;
  }
  const { pack } = useGameStore.getState();
  if (!recorder || recorder.story.seed !== state.seed || state.tick < recorder.story.lastTick) {
    recorder = createRecorder(state, stored);
    writtenTick = -1;
  }
  observe(recorder, state, pack);
  if (state.status === 'running' && recorder.story.lastTick - writtenTick >= STORY_WRITE_TICKS) write();
}

/** The story of this finished or running state (null when the recorder followed another run). */
export function storyFor(state: GameState | null): RunStory | null {
  if (!state || !recorder || recorder.story.seed !== state.seed) return null;
  return recorder.story;
}

/** Tests: forget everything. */
export function resetRecorder(): void {
  recorder = null;
  stored = null;
  writtenTick = -1;
}

void readValue(STORY_KEY)
  .then((text) => {
    if (!text || stored) return;
    try {
      const parsed = JSON.parse(text) as RunStory;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.lead)) stored = parsed;
    } catch {
      // a broken story is simply not used
    }
  })
  .catch(() => undefined);

useGameStore.subscribe((s, prev) => {
  if (s.state !== prev.state) recordState(s.state);
});

AppState.addEventListener('change', (next) => {
  if (next === 'background' || next === 'inactive') write();
});
