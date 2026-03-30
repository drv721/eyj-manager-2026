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

export interface LeaguePlayer {
  name: string;
  pos: string[];
  mlbTeam: string;
  salary: number;
  contract: string;
  status: 'active' | 'reserve' | 'injured' | 'minor';
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
