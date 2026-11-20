import * as cap from './glyphs/capability';
import * as ch from './glyphs/channels';
import * as ui from './glyphs/interface';
import * as obj from './glyphs/mapObjects';
import * as m from './glyphs/moments';
import * as reach from './glyphs/reach';
import * as res from './glyphs/resources';
import * as shadow from './glyphs/shadow';
import type { IconName } from './names';
import type { Glyph } from './types';

/** Name → drawing. Typed as a full record so a missing drawing fails the typecheck. */
export const registry: Record<IconName, Glyph> = {
  hype: res.Hype,
  cash: res.Cash,
  compute: res.Compute,
  tier: res.ModelTier,
  users: res.Users,
  datacentre: res.DataCentre,
  regulation: res.Regulation,
  backlash: res.Backlash,
  'rival-agi': res.RivalAgi,
  'world-share': res.WorldShare,

  'cap-model-1': cap.Model1,
  'cap-gpu-lease': cap.GpuLease,
  'cap-model-2': cap.Model2,
  'cap-safety-team': cap.SafetyTeam,
  'cap-gpu-megadeal': cap.GpuMegadeal,
  'cap-model-3': cap.Model3,
  'cap-interpretability': cap.Interpretability,
  'cap-own-chips': cap.OwnChips,
  'cap-model-4': cap.Model4,
  'cap-alignment': cap.Alignment,
  'cap-robotics': cap.Robotics,
  'cap-model-5': cap.Model5,

  'reach-app': reach.ReachApp,
  'reach-api': reach.ReachApi,
  'reach-social': reach.ReachSocial,
  'reach-loc-spanish': reach.LocSpanish,
  'reach-enterprise': reach.ReachEnterprise,
  'reach-media': reach.ReachMedia,
  'reach-loc-asia': reach.LocAsia,
  'reach-partnerships': reach.ReachPartnerships,
  'reach-pr': reach.ReachPr,
  'reach-compliance': reach.ReachCompliance,
  'reach-government': reach.ReachGovernment,
  'reach-superapp': reach.ReachSuperapp,

  'shadow-benchmarks': shadow.Benchmarks,
  'shadow-lobbying': shadow.Lobbying,
  'shadow-astroturf': shadow.Astroturf,
  'shadow-poaching': shadow.Poaching,
  'shadow-donations': shadow.Donations,
  'shadow-demos': shadow.Demos,
  'shadow-nda': shadow.Nda,
  'shadow-revolving-door': shadow.RevolvingDoor,
  'shadow-bot-farm': shadow.BotFarm,
  'shadow-ma-team': shadow.MaTeam,
  'shadow-capture': shadow.Capture,
  'shadow-hostile': shadow.Hostile,

  megaphone: m.MegaphoneMoment,
  star: m.StarMoment,
  chip: m.Chip,
  document: m.DocumentMoment,
  gavel: res.Regulation,
  recruiter: m.Recruiter,
  thermometer: m.Thermometer,
  camera: m.CameraMoment,
  speech: m.Speech,
  crowd: m.Crowd,
  trophy: m.Trophy,
  mortarboard: m.Mortarboard,
  heart: m.Heart,
  bug: m.Bug,
  bolt: m.Bolt,

  'gpu-crate': obj.GpuCrate,
  'rack-1': obj.Rack1,
  'rack-2': obj.Rack2,
  'rack-3': obj.Rack3,
  robot: obj.Robot,
  lobbyist: obj.Lobbyist,
  'undersea-cable': obj.UnderseaCable,
  launch: obj.Launch,

  'channel-ocean': ch.Ocean,
  'channel-language': ch.Language,
  'channel-strict': ch.Strict,
  'channel-viral': ch.Viral,
  'channel-open': ch.Open,

  map: ui.MapIcon,
  trees: ui.Trees,
  news: ui.News,
  race: ui.Race,
  regions: ui.Regions,
  info: ui.Info,
  lock: ui.Lock,
  check: ui.Check,
  close: ui.Close,
  help: ui.Help,
  settings: ui.Settings,
};

export const fallbackGlyph: Glyph = ui.Fallback;
