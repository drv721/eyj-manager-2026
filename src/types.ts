export type ContractType = 'K1' | 'K2' | 'K3' | 'N' | 'M' | 'M2';

export interface Player {
  id: string;
  name: string;
  pos: string[];
  team: string;
  contract: ContractType;
  salary: number;
  notes?: string;
  isMinor?: boolean;
  isReserve?: boolean;
  isIL?: boolean;
}

export interface CategoryProjection {
  cat: string;
  value: number;
  rank: string;
}

export interface SGPDenominator {
  cat: string;
  denom: number;
}

export interface TeamBudget {
  team: string;
  budget: number;
}

export interface AdvancedMetric {
  playerId: string;
  stuffPlus?: number;
  pitchingPlus?: number;
  barrelRate?: number;
  plateDiscipline?: number; // 0-100 scale
}

export interface SGPHeatmap {
  category: string;
  pointsToGain: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface OwnerBehavior {
  team: string;
  aggression: number; // 0-100
  preferredCategories: string[];
}

export interface HistoricalStanding {
  year: number;
  rank: number;
  totalPts: number;
  batting: number;
  pitching: number;
}

export interface FaabEntry {
  date: string;
  player: string;
  team: string;
  bid: number;
  result: 'Won' | 'Lost';
  runnerUpBid?: number;
}

export interface LiveCategoryStanding {
  category: string;
  type: 'batting' | 'pitching';
  myValue: number | null;   // EYJ's raw stat value in this category
  myPts: number;            // EYJ's points earned
  myRank: number;           // 1-based rank (−1 if not found)
  leaderPts: number;        // Max points available in category
  totalTeams: number;
  ptsGapToNext: number;     // Points needed to pass the team directly above
  ptsGapToFirst: number;    // Points needed to reach #1
}

export type TransactionType = 'Trade' | 'Add' | 'Drop' | 'Waiver' | 'Roster Move' | 'Other';

export interface TransactionEntry {
  date: string;
  team: string;
  player: string;
  action: string;
  type: TransactionType;
  effective: string;
}

export interface LeaguePlayer {
  name: string;
  pos: string[];
  mlbTeam: string;
  salary: number;
  contract: string;
  status: 'active' | 'reserve' | 'injured' | 'minor';
}

export interface TradeLogEntry {
  id: string;
  date: string;
  counterTeam: string;
  giving: string[];    // player names and/or pick labels
  receiving: string[];
  status: 'exploring' | 'offered' | 'received' | 'accepted' | 'declined';
  notes: string;
  salaryNet: number;   // net salary impact for EYJ (positive = taking on salary)
}

export interface FaabBidEntry {
  id: string;
  date: string;
  player: string;
  position: string;
  bidAmount: number;
  status: 'exploring' | 'placed' | 'accepted' | 'failed';
  finalPrice?: number;
  notes: string;
}

/** CBS YTD stats export — batters and pitchers merged into one array */
export interface PlayerStat {
  name: string;
  team: string;
  pos: string;
  games: number;
  isPitcher: boolean;
  // batting
  ab?: number;
  avg?: number;
  obp?: number;
  slg?: number;
  hr?: number;
  r?: number;
  rbi?: number;
  sb?: number;
  bb?: number;
  strikeoutsB?: number; // batter Ks
  // pitching
  ip?: number;
  era?: number;
  whip?: number;
  wins?: number;
  losses?: number;
  saves?: number;
  holds?: number;
  strikeoutsP?: number; // pitcher Ks
  qualityStarts?: number;
  gs?: number;
}

/** Steamer / FanGraphs RoS projections */
export interface PlayerProjection {
  name: string;
  team: string;
  isPitcher: boolean;
  // batting projections
  projG?: number;
  projAb?: number;
  projHr?: number;
  projR?: number;
  projRbi?: number;
  projSb?: number;
  projAvg?: number;
  projObp?: number;
  projSlg?: number;
  projOps?: number;
  projWoba?: number;
  // pitching projections
  projIp?: number;
  projGs?: number;
  projEra?: number;
  projWhip?: number;
  projK?: number;
  projW?: number;
  projSv?: number;
  projFip?: number;
  projXfip?: number;
}

export interface LeagueDetails {
  battingCategories: string[];
  pitchingCategories: string[];
  rosterRules: {
    active: number;
    reserve: number;
    injured: number;
    minors: number;
  };
  salaryCap: number;
}

/** FanGraphs Batting Dashboard — one row per player per season */
export interface FGBatterSeason {
  name: string;
  team: string;
  season: number;
  g: number;
  pa: number;
  hr: number;
  r: number;
  rbi: number;
  sb: number;
  bbPct: number;   // decimal, e.g. 0.183
  kPct: number;    // decimal, e.g. 0.221
  iso: number;
  babip: number;
  avg: number;
  obp: number;
  slg: number;
  woba: number;
  xwoba: number;
  wrcPlus: number;
  war: number;
}

/** FanGraphs Pitching Advanced (ERA-, FIP-, xFIP-, SIERA) — one row per player per season */
export interface FGPitcherSeason {
  name: string;
  team: string;
  season: number;
  kPct: number;    // decimal
  bbPct: number;   // decimal
  kMinusBBPct: number; // decimal
  era: number;
  fip: number;
  xfip: number;
  siera: number;
  eraMinus: number;
  fipMinus: number;
  xfipMinus: number;
  whip: number;
  babip: number;
  lobPct: number;  // decimal
}

/**
 * SPARK score — breakout trajectory (best for ages 19-27; age pillar zeroed without age data)
 * score 0-100, higher = more likely to break out / improve
 */
export interface SparkScore {
  name: string;
  isPitcher: boolean;
  score: number;  // 0-100
  tier: 'Breakout' | 'Building' | 'Developing' | 'Watch';
  pillars: {
    stuff: number;        // raw talent / metrics above average
    performance: number;  // recent production vs expectation
    access: number;       // playing time / opportunity
  };
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  topReason: string;
}

/**
 * FADE score — decline risk (most meaningful for ages 30+; age pillar zeroed without age data)
 * score 0-100, higher = more decline risk
 */
export interface FadeScore {
  name: string;
  isPitcher: boolean;
  score: number;  // 0-100
  tier: 'Sell High' | 'Monitor' | 'Hold' | 'Stable';
  pillars: {
    forceErosion: number;      // velocity / stuff declining
    disciplineDecay: number;   // BB% rising, K% falling
    efficiencyCollapse: number; // ERA rising above FIP/xFIP; hard contact rising
  };
  topReason: string;
}
