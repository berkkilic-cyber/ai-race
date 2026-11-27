import { getMusicState, MUSIC_VOLUME, resetMusicForTests, setMusic, setMusicForPath, trackForPath } from '../music';
import { useFeelSettings } from '../settings';

interface FakePlayer {
  volume: number;
  loop: boolean;
  playing: boolean;
  plays: number;
  play(): void;
  pause(): void;
  remove(): void;
}

function fakeAudio() {
  const made: FakePlayer[] = [];
  const mod = {
    createAudioPlayer(): FakePlayer {
      const p: FakePlayer = {
        volume: 1,
        loop: false,
        playing: false,
        plays: 0,
        play() {
          this.playing = true;
          this.plays += 1;
        },
        pause() {
          this.playing = false;
        },
        remove() {},
      };
      made.push(p);
      return p;
    },
  };
  return { made, loader: () => mod };
}

describe('music', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useFeelSettings.setState({ music: true });
  });
  afterEach(() => {
    resetMusicForTests();
    jest.useRealTimers();
  });

  it('maps routes to tracks', () => {
    expect(trackForPath('/')).toBe('garage');
    expect(trackForPath('/garage')).toBe('garage');
    expect(trackForPath('/game')).toBe('race');
    expect(trackForPath('/game/trees')).toBe('race');
    expect(trackForPath('/end')).toBe('race');
    expect(trackForPath('/dev/icons')).toBe('keep');
  });

  it('fades a looping track in to the music volume', () => {
    const audio = fakeAudio();
    resetMusicForTests(audio.loader);
    setMusic('garage');
    jest.advanceTimersByTime(2000);
    expect(audio.made).toHaveLength(1);
    const p = audio.made[0]!;
    expect(p.loop).toBe(true);
    expect(p.playing).toBe(true);
    expect(p.plays).toBe(1);
    expect(p.volume).toBeCloseTo(MUSIC_VOLUME);
    expect(getMusicState().levels.garage).toBe(1);
    // Once the fade is over nothing runs any more.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cross-fades when the mode changes and pauses the old track', () => {
    const audio = fakeAudio();
    resetMusicForTests(audio.loader);
    setMusicForPath('/garage');
    jest.advanceTimersByTime(2000);
    setMusicForPath('/game');
    jest.advanceTimersByTime(350);
    const [garage, race] = audio.made as [FakePlayer, FakePlayer];
    expect(garage.playing).toBe(true);
    expect(race.playing).toBe(true);
    expect(garage.volume).toBeLessThan(MUSIC_VOLUME);
    expect(race.volume).toBeGreaterThan(0);
    jest.advanceTimersByTime(2000);
    expect(garage.playing).toBe(false);
    expect(race.volume).toBeCloseTo(MUSIC_VOLUME);
    // A route that names no track keeps what is playing.
    setMusicForPath('/dev/icons');
    jest.advanceTimersByTime(2000);
    expect(race.playing).toBe(true);
  });

  it('goes quiet when the music setting is off, and comes back', () => {
    const audio = fakeAudio();
    resetMusicForTests(audio.loader);
    useFeelSettings.setState({ music: false });
    setMusic('race');
    jest.advanceTimersByTime(2000);
    expect(getMusicState().audible).toBeNull();
    expect(audio.made.every((p) => !p.playing)).toBe(true);
    useFeelSettings.setState({ music: true });
    setMusic(null);
    setMusic('race');
    jest.advanceTimersByTime(2000);
    expect(audio.made.some((p) => p.playing)).toBe(true);
  });

  it('is silent and harmless without an audio module', () => {
    resetMusicForTests(() => null);
    expect(() => {
      setMusic('race');
      jest.advanceTimersByTime(2000);
    }).not.toThrow();
    expect(getMusicState().wanted).toBe('race');
  });
});
