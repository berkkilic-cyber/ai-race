import { readValue, writeValue } from '../../tutorial/storage';
import { FEEL_SETTINGS_KEY, LEGACY_GARAGE_SETTINGS_KEY, resetFeelSettingsForTests, useFeelSettings } from '../settings';

beforeEach(async () => {
  resetFeelSettingsForTests();
  await writeValue(FEEL_SETTINGS_KEY, '');
  await writeValue(LEGACY_GARAGE_SETTINGS_KEY, '');
});

describe('feel settings', () => {
  it('defaults to sound and haptics on', async () => {
    await useFeelSettings.getState().load();
    expect(useFeelSettings.getState()).toMatchObject({ sound: true, haptics: true, loaded: true });
  });

  it('persists changes and reads them back', async () => {
    useFeelSettings.getState().setSound(false);
    expect(JSON.parse((await readValue(FEEL_SETTINGS_KEY))!)).toMatchObject({ sound: false, haptics: true });
    resetFeelSettingsForTests();
    await useFeelSettings.getState().load();
    expect(useFeelSettings.getState().sound).toBe(false);
  });

  it('adopts the Garage’s old haptics flag once, when nothing of its own is saved', async () => {
    await writeValue(LEGACY_GARAGE_SETTINGS_KEY, JSON.stringify({ haptics: false }));
    await useFeelSettings.getState().load();
    expect(useFeelSettings.getState().haptics).toBe(false);
    resetFeelSettingsForTests();
    await writeValue(FEEL_SETTINGS_KEY, JSON.stringify({ sound: true, haptics: true, music: true }));
    await useFeelSettings.getState().load();
    expect(useFeelSettings.getState().haptics).toBe(true);
  });

  it('ignores a corrupt save', async () => {
    await writeValue(FEEL_SETTINGS_KEY, '{nope');
    await useFeelSettings.getState().load();
    expect(useFeelSettings.getState()).toMatchObject({ sound: true, haptics: true });
  });

  it('a change made while loading wins over the saved value', async () => {
    await writeValue(FEEL_SETTINGS_KEY, JSON.stringify({ sound: true }));
    const p = useFeelSettings.getState().load();
    useFeelSettings.getState().setSound(false);
    await p;
    expect(useFeelSettings.getState().sound).toBe(false);
  });
});
