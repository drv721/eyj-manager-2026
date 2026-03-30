import { 
  Player, 
  CategoryProjection, 
  SGPDenominator, 
  TeamBudget, 
  HistoricalStanding,
  AdvancedMetric,
  SGPHeatmap,
  OwnerBehavior
} from './types';

export const INITIAL_ROSTER: Player[] = [
  // Batters
  { id: '1', name: 'Alejandro Kirk', pos: ['C'], team: 'TOR', contract: 'K1', salary: 2, notes: 'Keeper yr 1' },
  { id: '2', name: 'Agustin Ramirez', pos: ['C'], team: 'NYY', contract: 'K1', salary: 4, notes: 'Keeper yr 1' },
  { id: '3', name: 'Josh Naylor', pos: ['1B'], team: 'CLE', contract: 'K3', salary: 10, notes: 'Keeper yr 3' },
  { id: '4', name: 'Xavier Edwards', pos: ['2B', 'SS'], team: 'MIA', contract: 'N', salary: 3, notes: 'MIA everyday SS/2B, elite SB' },
  { id: '5', name: 'Kazuma Okamoto', pos: ['3B'], team: 'TOR', contract: 'N', salary: 9, notes: 'TOR, power upside' },
  { id: '6', name: 'CJ Abrams', pos: ['SS'], team: 'WAS', contract: 'K2', salary: 7, notes: 'Keeper yr 2' },
  { id: '7', name: 'Willy Adames', pos: ['SS', 'MI'], team: 'SF', contract: 'K1', salary: 7, notes: 'Keeper yr 1, SF' },
  { id: '8', name: 'Freddie Freeman', pos: ['1B', 'CI'], team: 'LAD', contract: 'N', salary: 40, notes: 'LAD anchor' },
  { id: '9', name: 'Randy Arozarena', pos: ['OF'], team: 'SEA', contract: 'N', salary: 31, notes: 'SEA' },
  { id: '10', name: 'Byron Buxton', pos: ['OF'], team: 'MIN', contract: 'K1', salary: 14, notes: 'Keeper yr 1, MIN' },
  { id: '11', name: 'Pete Crow-Armstrong', pos: ['OF'], team: 'CHC', contract: 'K1', salary: 6, notes: 'CHC, day-1 callup from MiLB' },
  { id: '12', name: 'Jarren Duran', pos: ['OF'], team: 'BOS', contract: 'N', salary: 27, notes: 'BOS' },
  { id: '13', name: 'Adolis Garcia', pos: ['OF'], team: 'PHI', contract: 'N', salary: 9, notes: 'PHI, uncertain role' },
  { id: '14', name: 'Colton Cowser', pos: ['OF'], team: 'BAL', contract: 'K1', salary: 6, notes: 'BAL reserve', isReserve: true },
  { id: '15', name: 'Spencer Steer', pos: ['1B', '2B', '3B', 'OF'], team: 'CIN', contract: 'N', salary: 3, notes: 'CIN multi-pos', isReserve: true },
  
  // Pitchers
  { id: '16', name: 'Garrett Crochet', pos: ['SP'], team: 'BOS', contract: 'K2', salary: 6, notes: 'BOS ace, best contract in league' },
  { id: '17', name: 'Kevin Gausman', pos: ['SP'], team: 'TOR', contract: 'K2', salary: 3, notes: 'TOR' },
  { id: '18', name: 'Ranger Suarez', pos: ['SP'], team: 'PHI', contract: 'N', salary: 10, notes: 'BOS' },
  { id: '19', name: 'Matthew Boyd', pos: ['SP'], team: 'CHC', contract: 'N', salary: 11, notes: 'CHC, injury risk' },
  { id: '20', name: 'Kodai Senga', pos: ['SP'], team: 'NYM', contract: 'N', salary: 11, notes: 'NYM, injury risk' },
  { id: '21', name: 'Raisel Iglesias', pos: ['RP'], team: 'ATL', contract: 'N', salary: 16, notes: 'ATL closer (~28 SV proj)' },
  { id: '22', name: 'Daniel Palencia', pos: ['RP'], team: 'CHC', contract: 'N', salary: 20, notes: 'CHC closer (~28 SV proj)' },
  { id: '23', name: 'Bryan Abreu', pos: ['RP', 'P'], team: 'HOU', contract: 'N', salary: 5, notes: 'HOU bridge closer' },
  { id: '24', name: 'Ryan Weathers', pos: ['SP', 'P'], team: 'NYY', contract: 'N', salary: 8, notes: 'NYY rotation' },

  // Minors
  { id: '25', name: 'Cade Horton', pos: ['SP'], team: 'CHC', contract: 'M', salary: 0, notes: 'CHC, activating Day 1', isMinor: true },
  { id: '26', name: 'Hagen Smith', pos: ['SP'], team: 'CHW', contract: 'M', salary: 0, notes: 'CHW prospect', isMinor: true },
  { id: '27', name: 'Kyle Manzardo', pos: ['1B'], team: 'CLE', contract: 'M2', salary: 5, notes: 'CLE', isMinor: true },
  { id: '28', name: 'Brooks Lee', pos: ['SS'], team: 'MIN', contract: 'M', salary: 0, notes: 'MIN', isMinor: true },
  { id: '29', name: 'Jett Williams', pos: ['SS'], team: 'MIL', contract: 'M', salary: 0, notes: 'MIL', isMinor: true },
  { id: '30', name: 'Braden Montgomery', pos: ['OF'], team: 'CHW', contract: 'M', salary: 0, notes: 'CHW', isMinor: true },
];

export const CATEGORY_PROJECTIONS: CategoryProjection[] = [
  { cat: 'SB', value: 160, rank: '#1–2' },
  { cat: 'HR', value: 150, rank: 'Mid' },
  { cat: 'R', value: 850, rank: 'Top 4' },
  { cat: 'RBI', value: 800, rank: 'Mid' },
  { cat: 'OBP', value: 0.320, rank: 'Mid' },
  { cat: 'S', value: 52, rank: 'Mid — fragile' },
  { cat: 'ERA', value: 3.75, rank: 'Top 3' },
  { cat: 'WHIP', value: 1.22, rank: 'Top 3' },
  { cat: 'K', value: 800, rank: 'Mid' },
  { cat: 'INN', value: 1100, rank: 'Mid' },
];

export const SGP_DENOMINATORS: SGPDenominator[] = [
  { cat: 'HR', denom: 38.34 },
  { cat: 'OBP', denom: 0.0105 },
  { cat: 'R', denom: 87.39 },
  { cat: 'RBI', denom: 84.99 },
  { cat: 'SB', denom: 18.13 },
  { cat: 'S', denom: 12.60 },
  { cat: 'ERA', denom: 0.32 },
  { cat: 'INN', denom: 78.23 },
  { cat: 'K', denom: 119.86 },
  { cat: 'WHIP', denom: 0.054 },
];

export const TEAM_BUDGETS: TeamBudget[] = [
  { team: 'Reaper Crew', budget: 217 },
  { team: 'Get Fistered', budget: 210 },
  { team: 'CONFAN', budget: 196 },
  { team: 'O\'Doyle Rules', budget: 203 },
  { team: 'EYJ', budget: 207 },
  { team: 'Wallace', budget: 167 },
  { team: 'Five Point Palm', budget: 167 },
  { team: 'Free Avon Barksdale', budget: 149 },
  { team: 'Rips & Runs', budget: 118 },
  { team: 'Left Coast', budget: 117 },
  { team: 'NOMAAM', budget: 108 },
  { team: '22 Samurai', budget: 96 },
];

export const HISTORICAL_STANDINGS: HistoricalStanding[] = [
  { year: 2021, rank: 12, totalPts: 15.0, batting: 9.0, pitching: 6.0 },
  { year: 2022, rank: 11, totalPts: 36.0, batting: 21.0, pitching: 15.0 },
  { year: 2023, rank: 12, totalPts: 28.0, batting: 15.0, pitching: 13.0 },
  { year: 2024, rank: 12, totalPts: 33.5, batting: 10.0, pitching: 23.5 },
  { year: 2025, rank: 9, totalPts: 50.5, batting: 14.5, pitching: 36.0 },
];

export const ADVANCED_METRICS: AdvancedMetric[] = [
  { playerId: '16', stuffPlus: 128, pitchingPlus: 112 }, // Crochet
  { playerId: '17', stuffPlus: 105, pitchingPlus: 108 }, // Gausman
  { playerId: '11', barrelRate: 14.2, plateDiscipline: 78 }, // PCA
  { playerId: '4', barrelRate: 2.1, plateDiscipline: 92 }, // Edwards
];

export const SGP_HEATMAP: SGPHeatmap[] = [
  { category: 'SB', pointsToGain: 2.5, difficulty: 'Easy' },
  { category: 'S', pointsToGain: 1.5, difficulty: 'Medium' },
  { category: 'HR', pointsToGain: 0.5, difficulty: 'Hard' },
  { category: 'ERA', pointsToGain: 1.0, difficulty: 'Medium' },
];

// Projected 2026 auction values for keeper-eligible players.
// Used as starting point in the Keeper Calculator — all are editable in-app.
export const KEEPER_PROJECTIONS: Record<string, number> = {
  // Catchers
  'Alejandro Kirk': 10,
  'Agustin Ramirez': 9,
  // Infield
  'Josh Naylor': 16,
  'CJ Abrams': 28,
  'Willy Adames': 19,
  'Kyle Manzardo': 11,
  // Outfield
  'Byron Buxton': 20,
  'Pete Crow-Armstrong': 15,
  'Colton Cowser': 13,
  // Pitching
  'Garrett Crochet': 42,
  'Kevin Gausman': 17,
  // Minors (projected value once promoted)
  'Cade Horton': 11,
  'Hagen Smith': 5,
  'Brooks Lee': 5,
  'Jett Williams': 4,
  'Braden Montgomery': 3,
};

// Full team name (as it appears in CBS CSV) → short abbreviation used in pick tables
export const TEAM_ABBREV: Record<string, string> = {
  'Confederation of American Natives': 'CONFAN',
  'EffYouJobu': 'EYJ',
  'Five Point Palm Exploding Heart Technique': 'FPPEHT',
  'Free Avon Barksdale': 'FAB',
  'Get Fistered': 'KingFist',
  'National Organization of Men Against Amazonian Masterhood': 'NOMAAM',
  "O'Doyle Rules": 'ODR',
  'Rips&Runs': 'RR',
  'The 22 Samurai': '22Samurai',
  'The Left Coast': 'TLC',
  'The Reaper Crew': 'TRC',
  'Where the F is Wallace': 'WTF',
};

export const ABBREV_TO_FULLNAME: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_ABBREV).map(([k, v]) => [v, k])
);

// MINOR_LEAGUE_PICKS[abbrev][year] = [r1count, r2count, r3count]
// 2029–2030 have no R3 yet — represented as 0
export const MINOR_LEAGUE_PICKS: Record<string, Record<number, number[]>> = {
  CONFAN:   { 2026:[0,1,0], 2027:[0,1,0], 2028:[0,0,1], 2029:[1,1,0], 2030:[1,1,0] },
  EYJ:      { 2026:[2,2,1], 2027:[2,0,1], 2028:[2,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  FPPEHT:   { 2026:[0,1,2], 2027:[0,1,1], 2028:[1,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  FAB:      { 2026:[2,0,0], 2027:[1,2,1], 2028:[2,2,1], 2029:[1,1,0], 2030:[1,1,0] },
  KingFist: { 2026:[0,1,1], 2027:[0,0,1], 2028:[0,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  NOMAAM:   { 2026:[0,0,3], 2027:[0,1,2], 2028:[1,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  ODR:      { 2026:[3,0,1], 2027:[2,2,1], 2028:[1,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  RR:       { 2026:[1,2,1], 2027:[0,1,1], 2028:[1,1,0], 2029:[1,1,0], 2030:[1,1,0] },
  '22Samurai': { 2026:[0,1,2], 2027:[1,0,2], 2028:[0,1,2], 2029:[1,1,0], 2030:[1,1,0] },
  TLC:      { 2026:[2,1,0], 2027:[2,1,0], 2028:[1,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  TRC:      { 2026:[0,2,1], 2027:[1,1,1], 2028:[1,1,1], 2029:[1,1,0], 2030:[1,1,0] },
  WTF:      { 2026:[2,1,0], 2027:[3,2,1], 2028:[2,1,1], 2029:[1,1,0], 2030:[1,1,0] },
};

export const OWNER_BEHAVIORS: OwnerBehavior[] = [
  { team: 'Reaper Crew', aggression: 85, preferredCategories: ['HR', 'RBI'] },
  { team: 'Get Fistered', aggression: 40, preferredCategories: ['OBP', 'WHIP'] },
  { team: 'EYJ', aggression: 65, preferredCategories: ['SB', 'K'] },
];
