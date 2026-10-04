// Loose typings for the F1 live-timing feed. Collections may arrive either as
// arrays or as index-keyed objects, so use `list()` before iterating them.

export type Coll<T> = T[] | Record<string, T>;

export interface SessionInfo {
  Meeting?: {
    Key?: number;
    Name?: string;
    OfficialName?: string;
    Location?: string;
    Country?: { Code?: string; Name?: string };
    Circuit?: { Key?: number; ShortName?: string };
  };
  Key?: number;
  Type?: string;
  Name?: string;
  StartDate?: string;
  EndDate?: string;
  GmtOffset?: string;
  Path?: string;
  SessionStatus?: string;
}

export interface Driver {
  RacingNumber: string;
  BroadcastName?: string;
  FullName?: string;
  Tla?: string;
  Line?: number;
  TeamName?: string;
  TeamColour?: string;
  FirstName?: string;
  LastName?: string;
  HeadshotUrl?: string;
  CountryCode?: string;
}

export interface Segment { Status?: number }
export interface Sector {
  Value?: string;
  Status?: number;
  OverallFastest?: boolean;
  PersonalFastest?: boolean;
  Stopped?: boolean;
  PreviousValue?: string;
  Segments?: Coll<Segment>;
}
export interface TimeValue { Value?: string; OverallFastest?: boolean; PersonalFastest?: boolean; Lap?: number }

export interface TimingLine {
  RacingNumber?: string;
  Line?: number;
  Position?: string;
  ShowPosition?: boolean;
  GapToLeader?: string;
  TimeDiffToFastest?: string;
  TimeDiffToPositionAhead?: string;
  IntervalToPositionAhead?: { Value?: string; Catching?: boolean };
  Stats?: Coll<{ TimeDiffToFastest?: string; TimeDifftoPositionAhead?: string }>;
  BestLapTimes?: Coll<TimeValue>;
  InPit?: boolean;
  PitOut?: boolean;
  Retired?: boolean;
  Stopped?: boolean;
  KnockedOut?: boolean;
  Cutoff?: boolean;
  NumberOfLaps?: number;
  NumberOfPitStops?: number;
  Sectors?: Coll<Sector>;
  Speeds?: Record<'I1' | 'I2' | 'FL' | 'ST', TimeValue | undefined>;
  BestLapTime?: TimeValue;
  LastLapTime?: TimeValue;
}

export interface Stint {
  Compound?: string;
  New?: string;
  TotalLaps?: number;
  StartLaps?: number;
  LapTime?: string;
  LapNumber?: number;
}

export interface RcMessage {
  Utc: string;
  Lap?: number;
  Category?: string;
  Flag?: string;
  Scope?: string;
  Sector?: number;
  RacingNumber?: string;
  Mode?: string;
  Status?: string;
  Message: string;
}

export interface Capture { Utc: string; RacingNumber: string; Path: string }

export interface F1State {
  SessionInfo?: SessionInfo;
  DriverList?: Record<string, Driver>;
  TimingData?: { Lines?: Record<string, TimingLine>; SessionPart?: number; Withheld?: boolean };
  TimingAppData?: { Lines?: Record<string, { Stints?: Coll<Stint>; GridPos?: string }> };
  TimingStats?: { Lines?: Record<string, { PersonalBestLapTime?: TimeValue; BestSpeeds?: Record<string, TimeValue> }> };
  RaceControlMessages?: { Messages?: Coll<RcMessage> };
  TeamRadio?: { Captures?: Coll<Capture> };
  TrackStatus?: { Status?: string; Message?: string };
  WeatherData?: Record<string, string>;
  LapCount?: { CurrentLap?: number; TotalLaps?: number };
  ExtrapolatedClock?: { Utc?: string; Remaining?: string; Extrapolating?: boolean };
  SessionStatus?: { Status?: string };
  Heartbeat?: { Utc?: string };
  [topic: string]: unknown;
}

export interface XY { x: number; y: number }
