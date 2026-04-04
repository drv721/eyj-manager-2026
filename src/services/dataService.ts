import Papa from 'papaparse';
import { Player, HistoricalStanding, FaabEntry, LeagueDetails, LiveCategoryStanding, LeaguePlayer, TransactionEntry, TransactionType, PlayerStat, PlayerProjection } from '../types';
import { TEAM_ABBREV } from '../constants';

export type DataType = 'roster' | 'standings' | 'faab' | 'transactions' | 'statcast' | 'stuff' | 'leagueroster' | 'freeagents' | 'stats' | 'projections' | 'unknown';

/**
 * Detects the data type by inspecting CSV column headers — filename-independent.
 */
export function detectDataType(csvText: string): { type: DataType; rowCount: number; confidence: 'high' | 'low' } {
  // CBS multi-team league roster: contains " Batters" section headers
  if (csvText.includes(' Batters\n') || csvText.includes(' Batters\r')) {
    return { type: 'leagueroster', rowCount: csvText.split('\n').length, confidence: 'high' };
  }

  // CBS free agent / available players list
  // Handles: "Available Batters", "Free Agents Year to Date", "Free Agent Pitchers Year to Date"
  if (csvText.includes('Available Batters') || csvText.includes('Available Pitchers') ||
      csvText.includes('FA Batters') || csvText.includes('FA Pitchers') ||
      csvText.match(/^Free Agent(s| Pitchers| Batters)/m)) {
    return { type: 'freeagents', rowCount: csvText.split('\n').length, confidence: 'high' };
  }

  const lines = csvText.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { type: 'unknown', rowCount: 0, confidence: 'low' };

  const headers = lines[0].split(/,|\t/).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rowCount = lines.length - 1;

  // FanGraphs Stuff+ / Pitching+ — very specific column names
  if (headers.some(h => ['stuff+', 'k/9+', 'k%+', 'era-', 'fip-', 'xfip-', 'pitching+', 'location+', 'bb/9+'].includes(h))) {
    return { type: 'stuff', rowCount, confidence: 'high' };
  }

  // Baseball Savant / Statcast
  if (headers.some(h => ['avg_hit_speed', 'barrel_fls_percent', 'brl_percent', 'est_woba', 'xwoba'].includes(h) || h.includes('exit_velocity'))) {
    return { type: 'statcast', rowCount, confidence: 'high' };
  }

  // Roster — contract column is a strong signal
  if (headers.includes('contract') || (headers.some(h => ['salary', 'price'].includes(h)) && headers.some(h => ['position', 'pos'].includes(h)))) {
    return { type: 'roster', rowCount, confidence: 'high' };
  }

  // CBS league transaction log: Date, Team, Players, Effective
  if (headers.includes('date') && headers.includes('team') && headers.includes('players') && headers.includes('effective')) {
    return { type: 'transactions', rowCount, confidence: 'high' };
  }

  // FAAB bid log
  if (headers.some(h => ['bid', 'winning bid', 'winning_bid', 'amount'].includes(h)) && headers.some(h => h.includes('player') || h.includes('name'))) {
    return { type: 'faab', rowCount, confidence: 'high' };
  }
  if (headers.some(h => h.includes('transaction') || h.includes('waiver') || h.includes('runner'))) {
    return { type: 'faab', rowCount, confidence: 'high' };
  }

  // Standings
  if ((headers.includes('year') || headers.some(h => ['rank', 'place', 'pos'].includes(h))) && headers.some(h => ['points', 'pts', 'total'].includes(h))) {
    return { type: 'standings', rowCount, confidence: 'high' };
  }

  // FanGraphs Steamer / ZiPS projections: has playerid + projected counting stats
  // FanGraphs batting projections: playerid + woba/fip present
  if (headers.includes('playerid') && headers.some(h => ['woba', 'fip', 'xfip', 'wrc+'].includes(h))) {
    return { type: 'projections', rowCount, confidence: 'high' };
  }

  // CBS YTD stats export (batting): has AVG, OBP, SLG, HR but no playerid, no Stuff+
  // CBS YTD stats export (pitching): has ERA, WHIP, IP, K but no playerid, no Stuff+
  const isCBSBatting  = headers.some(h => ['avg','obp','slg'].includes(h)) && headers.some(h => ['hr','rbi'].includes(h)) && !headers.includes('playerid') && !headers.includes('era');
  const isCBSPitching = headers.some(h => ['era','whip','ip'].includes(h)) && !headers.includes('playerid') && !headers.some(h => ['stuff+','pitching+'].includes(h));
  if (isCBSBatting || isCBSPitching) {
    return { type: 'stats', rowCount, confidence: 'high' };
  }

  // Low-confidence guesses from generic stat columns
  if (headers.some(h => ['era', 'whip', 'ip', 'fip'].includes(h)) && headers.some(h => ['name', 'player'].includes(h))) {
    return { type: 'stuff', rowCount, confidence: 'low' };
  }
  if (headers.some(h => ['avg', 'hr', 'rbi', 'obp', 'slg'].includes(h)) && headers.some(h => ['name', 'player'].includes(h))) {
    return { type: 'statcast', rowCount, confidence: 'low' };
  }
  if (headers.some(h => ['salary', 'price'].includes(h)) && headers.some(h => ['name', 'player'].includes(h))) {
    return { type: 'roster', rowCount, confidence: 'low' };
  }

  return { type: 'unknown', rowCount, confidence: 'low' };
}

/**
 * Parses a CSV string directly (without fetching). Useful when you already have the text.
 */
export function parseCSVText(csvText: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cleanData = (results.data as any[]).filter(row => {
          const values = Object.values(row);
          return values.length > 0 && values.some(v => v !== null && v !== '');
        });
        resolve(cleanData);
      },
      error: (error: any) => reject(error)
    });
  });
}

export interface ParsedData {
  standings?: HistoricalStanding[];
  roster?: Player[];
  faab?: FaabEntry[];
  statcast?: any[];
  leagueDetails?: LeagueDetails;
}

/**
 * Extracts categories from the overall.csv file (which has multiple tables)
 */
export function extractCategoriesFromOverall(csvText: string): { batting: string[], pitching: string[] } {
  const batting: string[] = [];
  const pitching: string[] = [];
  
  const lines = csvText.split('\n');
  let currentSection: 'batting' | 'pitching' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'Batting Breakdown') {
      currentSection = 'batting';
      continue;
    }
    if (line === 'Pitching Breakdown') {
      currentSection = 'pitching';
      continue;
    }
    
    if (currentSection && line.startsWith('Team,')) {
      const headers = line.split(',');
      // The category is the second header (e.g., Team,HR,Pts,Dif -> HR)
      if (headers.length >= 2) {
        const cat = headers[1].trim();
        if (cat && cat !== 'Pts' && cat !== 'Dif') {
          if (currentSection === 'batting') batting.push(cat);
          else pitching.push(cat);
        }
      }
    }
  }
  
  return { batting, pitching };
}

/**
 * Extracts roster rules and FAAB budget from the roster overview file.
 * Returns faabBudget as null if no FAB balance line is found.
 */
export function extractRosterRulesFromRoster(csvText: string): { rules: any, salaryCap: number, faabBudget: number | null } {
  const lines = csvText.split('\n');
  let rules = { active: 22, reserve: 5, injured: 3, minors: 6 };
  let salaryCap = 260; // Default
  let faabBudget: number | null = null;

  for (let line of lines) {
    if (line.includes('Active:') && line.includes('Reserve:') && line.includes('Salary:')) {
      // Example: Active: 22 Reserve: 5 Injured: 3 Minors: 6 Active Salary: 217.00 Total Salary: 280.00
      const activeMatch = line.match(/Active:\s*(\d+)/);
      const reserveMatch = line.match(/Reserve:\s*(\d+)/);
      const injuredMatch = line.match(/Injured:\s*(\d+)/);
      const minorsMatch = line.match(/Minors:\s*(\d+)/);

      if (activeMatch) rules.active = parseInt(activeMatch[1]);
      if (reserveMatch) rules.reserve = parseInt(reserveMatch[1]);
      if (injuredMatch) rules.injured = parseInt(injuredMatch[1]);
      if (minorsMatch) rules.minors = parseInt(minorsMatch[1]);
    }

    // Parse FAAB / FAB budget lines
    // Common CBS formats: "FAB Budget: 92.00", "FAB: 92", "FAAB: 92.00", "Free Agent Budget: 92.00"
    const fabMatch = line.match(/(?:FAB(?:AB)?(?:\s+Budget)?|Free\s+Agent\s+Budget|Available\s+FAB|FAB\s+Remaining)[:\s]+([\d.]+)/i);
    if (fabMatch) {
      const val = parseFloat(fabMatch[1]);
      if (!isNaN(val)) faabBudget = val;
    }
  }

  return { rules, salaryCap, faabBudget };
}

export async function fetchAndParseCSV<T>(filename: string): Promise<T[]> {
  const response = await fetch(`/data/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}`);
  }
  const csvText = await response.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimiter: "", // Auto-detect delimiter (handles tabs, semicolons, etc.)
      complete: (results) => {
        // Filter out empty rows or rows that are just headers repeated
        const cleanData = results.data.filter((row: any) => {
          const values = Object.values(row);
          return values.length > 0 && values.some(v => v !== null && v !== '');
        });
        resolve(cleanData as T[]);
      },
      error: (error: any) => {
        reject(error);
      }
    });
  });
}

/**
 * Maps raw Statcast CSV data
 */
export function mapStatcastData(rawData: any[]): any[] {
  return rawData.map((row) => {
    let name = 'Unknown';
    if (row.player_name) {
      name = row.player_name;
    } else if (row.last_name && row.first_name) {
      name = `${row.first_name} ${row.last_name}`;
    } else {
      name = row.Player || row.name || row.Name || row['Player Name'] || 'Unknown';
    }

    return {
      name,
      team: row.team || row.Tm || row.Team || 'Unknown',
      ev: Number(row.avg_hit_speed || row.ev || row.EV || 0),
      barrelRate: Number(row.barrel_fls_percent || row.brl_percent || row['Brl%'] || 0),
      xwoba: Number(row.est_woba || row.xwoba || row.xwOBA || 0)
    };
  }).filter(p => p.name !== 'Unknown');
}

/**
 * Maps raw FanGraphs Stuff+ or Pitching Leaders data
 */
export function mapStuffData(rawData: any[]): any[] {
  return rawData.map((row) => {
    const stuffPlus = Number(row['Stuff+'] || row.stuff_plus || row.Stuff || 0);
    const locationPlus = Number(row['Location+'] || row.location_plus || row.Location || 0);
    const pitchingPlus = Number(row['Pitching+'] || row.pitching_plus || row.Pitching || 0);
    
    // Fallback for "+ Stats" or other leaderboards if Stuff+ is missing
    // We'll use K/9+ or K%+ as a proxy for "Stuff" if the actual Stuff+ column is missing
    const kPlus = Number(row['K/9+'] || row['K%+'] || 0);
    const eraMinus = Number(row['ERA-'] || 0);
    
    return {
      name: row.Name || row.name || row.player_name || 'Unknown',
      team: row.Team || row.team || row.Tm || 'Unknown',
      stuffPlus: stuffPlus || kPlus, // Use K/9+ as proxy if Stuff+ is missing
      locationPlus: locationPlus || (eraMinus > 0 ? 200 - eraMinus : 0), // Use ERA- as proxy for performance
      pitchingPlus: pitchingPlus || (kPlus > 0 && eraMinus > 0 ? (kPlus + (200 - eraMinus)) / 2 : 0)
    };
  }).filter(p => p.name !== 'Unknown' && (p.stuffPlus > 0 || p.pitchingPlus > 0));
}

/**
 * Maps raw CBS/generic CSV data to our Player type
 */
export function mapRosterData(rawData: any[]): Player[] {
  return rawData.map((row, index) => ({
    id: row.id || `p-${index}`,
    name: row.Player || row.name || row.Name || row['Player Name'] || 'Unknown',
    pos: (row.Position || row.pos || row.Pos || '').split(',').map((s: string) => s.trim()),
    team: row.Team || row.team || row.Tm || 'FA',
    contract: row.Contract || row.contract || row.Status || 'N',
    salary: Number(row.Salary || row.salary || row.Price || 0),
    notes: row.Notes || row.notes || '',
    isMinor: row.Minor === true || row.isMinor === true || row.Status === 'Minor',
    isReserve: row.Reserve === true || row.isReserve === true || row.Status === 'Reserve'
  }));
}

/**
 * Maps raw standings CSV data to our HistoricalStanding type
 */
export function mapStandingsData(rawData: any[]): HistoricalStanding[] {
  return rawData.map((row) => ({
    year: Number(row.Year || row.year || 0),
    rank: Number(row.Rank || row.rank || row.Pos || row.Place || 0),
    totalPts: Number(row.Points || row.totalPts || row.Pts || row.Total || 0),
    batting: Number(row.Batting || row.batting || 0),
    pitching: Number(row.Pitching || row.pitching || 0)
  })).filter(s => s.year > 0 || s.rank > 0 || s.totalPts > 0);
}

/**
 * Maps raw FAAB CSV data to our FaabEntry type
 */
export function mapFaabData(rawData: any[]): FaabEntry[] {
  return rawData.map((row) => ({
    date: row.Date || row.date || row.Time || row['Transaction Date'] || row.Transaction || row.Action || '',
    player: row.Player || row.player || row.Name || row['Player Name'] || 'Unknown',
    team: row.Team || row.team || row.Owner || row['Owner Name'] || 'Unknown',
    bid: Number(row.Bid || row.bid || row.Amount || row['Winning Bid'] || row.Price || 0),
    result: (row.Result || row.result || row.Outcome || row.Status || 'Lost').toString().toLowerCase().includes('won') || (row.Result || row.result || row.Outcome || row.Status || '').toString().toLowerCase().includes('success') ? 'Won' : 'Lost',
    runnerUpBid: Number(row.RunnerUpBid || row.runnerUpBid || row['Runner Up Bid'] || row['Second Bid'] || 0)
  }));
}

/**
 * Classifies a CBS transaction action string into a TransactionType.
 */
function classifyAction(action: string): TransactionType {
  const a = action.toLowerCase();
  if (a.includes('traded')) return 'Trade';
  if (a.includes('added') || a.includes('activated from free')) return 'Add';
  if (a.includes('dropped')) return 'Drop';
  if (a.includes('waiver') || a.includes('claimed')) return 'Waiver';
  if (a.includes('moved') || a.includes('benched') || a.includes('activated') || a.includes('sent to') || a.includes('ir')) return 'Roster Move';
  return 'Other';
}

/**
 * Maps CBS "all transactions" CSV (Date, Team, Players, Effective) into flat TransactionEntry rows.
 * Each multi-player cell is split into individual entries.
 */
export function mapTransactionData(rawData: any[]): TransactionEntry[] {
  const out: TransactionEntry[] = [];
  for (const row of rawData) {
    const date      = String(row.Date || row.date || '').trim();
    const team      = String(row.Team || row.team || '').trim();
    const players   = String(row.Players || row.players || '').trim();
    const effective = String(row.Effective || row.effective || '').trim();
    if (!players) continue;

    // Each player action is on its own line within the cell
    const lines = players.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Format: "Player Name POS | MLB  - Action text"
      const dashIdx = line.lastIndexOf(' - ');
      const action  = dashIdx >= 0 ? line.slice(dashIdx + 3).trim() : '';
      const playerPart = dashIdx >= 0 ? line.slice(0, dashIdx) : line;
      const pipeIdx = playerPart.indexOf(' | ');
      const player  = pipeIdx >= 0 ? playerPart.slice(0, pipeIdx).trim() : playerPart.trim();

      // Strip trailing position abbreviations from player name
      const name = player.replace(/\s+(?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P)(?:,(?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P))*$/, '').trim();
      if (!name || name.length < 2) continue;

      out.push({ date, team, player: name, action, type: classifyAction(action), effective });
    }
  }
  return out;
}

/**
 * Parses a CBS multi-team league roster CSV into a map of abbrev → players.
 * Handles multi-line quoted cells by using PapaParser for row splitting.
 */
export function parseLeagueRoster(csvText: string): Record<string, LeaguePlayer[]> {
  const POSITIONS = new Set(['C','1B','2B','3B','SS','MI','CI','OF','DH','SP','RP','P']);
  const POS_RE = /\s+((?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P)(?:,(?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P))*)$/;

  const result: Record<string, LeaguePlayer[]> = {};

  // Use PapaParser to handle quoted multi-line cells correctly
  const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: false, dynamicTyping: false });
  const rows = parsed.data as string[][];

  let currentAbbrev: string | null = null;
  let currentStatus: LeaguePlayer['status'] = 'active';

  for (const row of rows) {
    const firstVal = (row[0] || '').trim();

    // Detect team section headers: "EffYouJobu Batters" / "EffYouJobu Pitchers"
    if (row.slice(1).every(v => !v || !String(v).trim())) {
      // Sub-section markers (can appear inside a team block)
      if (firstVal === 'Reserves') { currentStatus = 'reserve'; continue; }
      if (firstVal === 'Injured')  { currentStatus = 'injured'; continue; }
      if (firstVal === 'Minors')   { currentStatus = 'minor';   continue; }

      // Team section header: "TeamName Batters" or "TeamName Pitchers"
      const isBatters  = firstVal.endsWith(' Batters');
      const isPitchers = firstVal.endsWith(' Pitchers');
      if (isBatters || isPitchers) {
        const teamPart = firstVal.replace(/ (Batters|Pitchers)$/, '').trim();
        const normStr  = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        // 1) Exact match
        let abbrev: string | undefined = TEAM_ABBREV[teamPart];
        if (!abbrev) {
          // 2) Fuzzy match (handles spacing / punctuation variants)
          const entry = Object.entries(TEAM_ABBREV).find(([k]) => normStr(k) === normStr(teamPart));
          if (entry) abbrev = entry[1];
        }
        if (!abbrev) {
          // 3) Fallback: derive abbreviation from the team name itself
          abbrev = teamPart.replace(/\s+/g, '').slice(0, 6).toUpperCase();
        }
        currentAbbrev = abbrev;
        currentStatus = 'active';
        if (!result[abbrev]) result[abbrev] = [];
      }
      continue;
    }

    if (!currentAbbrev) continue;
    if (!POSITIONS.has(firstVal)) continue;

    const playerRaw = String(row[1] || '').trim();
    const salary    = parseFloat(String(row[8] || '0')) || 0;
    const contract  = String(row[9] || '').trim() || 'N';

    // Parse "Cal Raleigh C,DH | SEA " → name="Cal Raleigh", mlbTeam="SEA"
    const pipeIdx = playerRaw.indexOf(' | ');
    const mlbTeam    = pipeIdx >= 0 ? playerRaw.slice(pipeIdx + 3).trim() : '';
    const nameAndPos = pipeIdx >= 0 ? playerRaw.slice(0, pipeIdx) : playerRaw;
    const posMatch   = nameAndPos.match(POS_RE);
    const name       = (posMatch ? nameAndPos.slice(0, posMatch.index) : nameAndPos).trim();
    const pos        = posMatch ? posMatch[1].split(',') : [firstVal];

    if (!name || name.length < 2 || name === 'Pos' || name === 'Players') continue;

    result[currentAbbrev].push({ name, pos, mlbTeam, salary, contract, status: currentStatus });
  }

  return result;
}

// Normalize CBS-exported category names to internal names
const CBS_CAT_MAP: Record<string, string> = {
  'Saves': 'S', 'SV': 'S', 'SVS': 'S',
  'Innings': 'INN', 'IP': 'INN', 'Inn': 'INN', 'Innings Pitched': 'INN',
  'Strikeouts': 'K', 'SO': 'K',
  'Stolen Bases': 'SB',
  'Home Runs': 'HR',
  'Runs Batted In': 'RBI',
  'On-Base Pct': 'OBP', 'On Base Pct': 'OBP', 'On Base %': 'OBP', 'On-Base %': 'OBP',
  'Earned Run Avg': 'ERA', 'Earned Run Average': 'ERA',
  'Walks+Hits/IP': 'WHIP', 'Walks + Hits / IP': 'WHIP', 'BB+H/IP': 'WHIP',
};

/**
 * Parses a CBS-style "overall standings" CSV that contains multiple per-category sub-tables.
 * Format expected:
 *   Batting Breakdown
 *   Team,HR,Pts,Dif
 *   Reaper Crew,45,8.0,3.5
 *   EYJ,40,5.0,0.5
 *   ...
 *   Team,OBP,Pts,Dif
 *   ...
 *   Pitching Breakdown
 *   Team,ERA,Pts,Dif
 *   ...
 *
 * Falls back gracefully if format differs — returns empty array rather than throwing.
 */
export function parseCategoryStandings(
  csvText: string,
  myTeamIdentifiers: string[] = ['EYJ', 'EffYouJobu', 'Eff You Jobu', 'effyoujobu']
): LiveCategoryStanding[] {
  const lines = csvText.split('\n');
  const results: LiveCategoryStanding[] = [];

  let section: 'batting' | 'pitching' | null = null;
  let currentCat: string | null = null;
  let currentRows: { team: string; value: number; pts: number }[] = [];

  const flush = () => {
    if (!currentCat || currentRows.length === 0 || !section) return;

    const byPts = [...currentRows].sort((a, b) => b.pts - a.pts);
    const myRow = currentRows.find(r =>
      myTeamIdentifiers.some(id => r.team.toLowerCase().includes(id.toLowerCase()))
    );
    const myRank = myRow ? byPts.findIndex(r => r.team === myRow.team) + 1 : -1;
    const leaderPts = byPts[0]?.pts ?? 0;
    const abovePts  = myRank > 1 ? (byPts[myRank - 2]?.pts ?? 0) : leaderPts;

    results.push({
      category:      currentCat,
      type:          section,
      myValue:       myRow?.value ?? null,
      myPts:         myRow?.pts ?? 0,
      myRank,
      leaderPts,
      totalTeams:    currentRows.length,
      ptsGapToNext:  myRank > 1 ? Math.max(0, abovePts - (myRow?.pts ?? 0)) : 0,
      ptsGapToFirst: Math.max(0, leaderPts - (myRow?.pts ?? 0)),
    });

    currentRows = [];
    currentCat  = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line === 'Batting Breakdown')  { flush(); section = 'batting';  continue; }
    if (line === 'Pitching Breakdown') { flush(); section = 'pitching'; continue; }
    if (!section) continue;

    // New category sub-table header: "Team,HR,Pts,Dif"
    if (line.toLowerCase().startsWith('team,')) {
      flush();
      const parts = line.split(',');
      const rawCat = parts[1]?.trim();
      if (rawCat && rawCat !== 'Pts' && rawCat !== 'Dif') {
        currentCat = CBS_CAT_MAP[rawCat] ?? rawCat;
      }
      continue;
    }

    // Data row
    if (currentCat) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const team  = parts[0]?.trim();
        const value = parseFloat(parts[1]) || 0;
        const pts   = parseFloat(parts[2]) || 0;
        if (team && team.toLowerCase() !== 'team') {
          currentRows.push({ team, value, pts });
        }
      }
    }
  }
  flush();

  return results;
}

/**
 * Parses a CBS "Free Agents" / "Available Players" export CSV.
 *
 * CBS FA exports two different column layouts:
 *
 * Legacy (league-roster style):
 *   Col 0 = Position (e.g. "OF"), Col 1 = "Name POS | TEAM"
 *
 * Standard FA export (what CBS actually produces):
 *   Row 1  = Title line  e.g. "Free Agents Year to Date MLB Scoring Categories"
 *   Row 2  = Header      e.g. "Avail,Player,HR,OBP,..."
 *   Data rows: Col 0 = availability e.g. "W ( 4/2)", Col 1 = "Name POS | TEAM"
 */
export function parseFreeAgents(csvText: string): LeaguePlayer[] {
  const POSITIONS = new Set(['C','1B','2B','3B','SS','MI','CI','OF','DH','SP','RP','P']);
  // Matches trailing position(s) before the " | TEAM" separator
  const POS_RE = /\s+((?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P)(?:,(?:C|1B|2B|3B|SS|MI|CI|OF|DH|SP|RP|P))*)$/;

  const result: LeaguePlayer[] = [];
  const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: false, dynamicTyping: false });
  const rows = parsed.data as string[][];

  // Detect which layout we're dealing with by checking the second column of
  // the first data row.  If col 0 looks like a position code → legacy layout.
  // If col 0 looks like an availability string ("W", "W ( 4/2)", etc.) → FA layout.
  let playerCol = 1; // default: CBS FA export (Avail, Player, ...)
  const firstDataRow = rows.find(r => r.length >= 2 && (r[0] || '').trim());
  if (firstDataRow && POSITIONS.has((firstDataRow[0] || '').trim())) {
    playerCol = 1; // legacy: pos is col 0, player is col 1
  }

  for (const row of rows) {
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    // Skip header / title rows
    if (!col0 || col0.toLowerCase().startsWith('free agent') ||
        col0.toLowerCase() === 'avail' || col0.toLowerCase() === 'pos' ||
        col0.toLowerCase() === 'player') continue;

    // Legacy layout: col 0 is a position code
    if (POSITIONS.has(col0) && playerCol === 1) {
      const playerRaw = col1;
      if (!playerRaw) continue;
      const pipeIdx = playerRaw.indexOf(' | ');
      const mlbTeam = pipeIdx >= 0 ? playerRaw.slice(pipeIdx + 3).trim() : '';
      const nameAndPos = pipeIdx >= 0 ? playerRaw.slice(0, pipeIdx) : playerRaw;
      const posMatch = nameAndPos.match(POS_RE);
      const name = (posMatch ? nameAndPos.slice(0, posMatch.index) : nameAndPos).trim();
      const pos = posMatch ? posMatch[1].split(',') : [col0];
      if (!name || name.length < 2) continue;
      result.push({ name, pos, mlbTeam, salary: 0, contract: 'N', status: 'active' });
      continue;
    }

    // Standard FA export: col 0 is availability ("W ( 4/2)", "FA", etc.), col 1 is player
    // Use tight pattern to avoid matching stat abbreviations like "WHIP", "WAR", etc.
    if (!col0.match(/^W\s*[\(\s]|^FA\b|^Avail\b/i)) continue;

    const playerRaw = col1;
    // Require " | " team separator — filters header rows and junk
    if (!playerRaw || !playerRaw.includes(' | ') || playerRaw.toLowerCase() === 'player') continue;

    const pipeIdx = playerRaw.indexOf(' | ');
    const mlbTeam = pipeIdx >= 0 ? playerRaw.slice(pipeIdx + 3).trim() : '';
    const nameAndPos = pipeIdx >= 0 ? playerRaw.slice(0, pipeIdx) : playerRaw;
    const posMatch = nameAndPos.match(POS_RE);
    const name = (posMatch ? nameAndPos.slice(0, posMatch.index) : nameAndPos).trim();
    const pos = posMatch ? posMatch[1].split(',') : [];

    if (!name || name.length < 2) continue;
    result.push({ name, pos, mlbTeam, salary: 0, contract: 'N', status: 'active' });
  }

  return result;
}

/**
 * Parses a CBS YTD stats export (batting or pitching) into PlayerStat[].
 *
 * CBS batting columns (typical): Player, Pos, Team, G, AB, R, H, 2B, 3B, HR, RBI, SB, CS, BB, SO, AVG, OBP, SLG
 * CBS pitching columns (typical): Player, Pos, Team, G, GS, IP, H, BB, SO, W, L, SV, HLD, ERA, WHIP, QS
 *
 * The parser detects whether a row is a pitcher by the presence of ERA/IP values.
 * Handles both batting and pitching rows so a merged upload works fine too.
 */
export function parseCBSStats(rawData: any[]): PlayerStat[] {
  const results: PlayerStat[] = [];

  for (const row of rawData) {
    const name =
      String(row.Player || row.player || row.Name || row.name || row['Player Name'] || '').trim();
    if (!name || name.length < 2) continue;

    const team  = String(row.Team || row.team || row.Tm || '').trim();
    const pos   = String(row.Pos  || row.pos  || row.Position || '').trim();
    const games = Number(row.G || row.Games || row.games || 0);

    // Detect pitcher by presence of IP / ERA column values
    const hasIP  = row.IP  !== undefined && row.IP  !== null && row.IP  !== '';
    const hasERA = row.ERA !== undefined && row.ERA !== null && row.ERA !== '';
    const isPitcher = hasIP || hasERA ||
      pos.toUpperCase().includes('SP') || pos.toUpperCase() === 'RP' || pos.toUpperCase() === 'P';

    const entry: PlayerStat = { name, team, pos, games, isPitcher };

    if (isPitcher) {
      entry.ip            = Number(row.IP   || row.ip   || 0) || undefined;
      entry.era           = Number(row.ERA  || row.era  || 0) || undefined;
      entry.whip          = Number(row.WHIP || row.whip || 0) || undefined;
      entry.wins          = Number(row.W    || row.Wins || row.wins   || 0) || undefined;
      entry.losses        = Number(row.L    || row.Losses || row.losses || 0) || undefined;
      entry.saves         = Number(row.SV   || row.Saves || row.saves  || 0) || undefined;
      entry.holds         = Number(row.HLD  || row.Holds || row.holds  || row.HD || 0) || undefined;
      entry.strikeoutsP   = Number(row.SO   || row.K    || row.Strikeouts || 0) || undefined;
      entry.qualityStarts = Number(row.QS   || row.qs   || 0) || undefined;
      entry.gs            = Number(row.GS   || row.gs   || 0) || undefined;
    } else {
      entry.ab          = Number(row.AB  || row.ab  || 0) || undefined;
      entry.avg         = Number(row.AVG || row.avg || 0) || undefined;
      entry.obp         = Number(row.OBP || row.obp || 0) || undefined;
      entry.slg         = Number(row.SLG || row.slg || 0) || undefined;
      entry.hr          = Number(row.HR  || row.hr  || 0) || undefined;
      entry.r           = Number(row.R   || row.r   || row.Runs || 0) || undefined;
      entry.rbi         = Number(row.RBI || row.rbi || 0) || undefined;
      entry.sb          = Number(row.SB  || row.sb  || 0) || undefined;
      entry.bb          = Number(row.BB  || row.bb  || row.Walks || 0) || undefined;
      entry.strikeoutsB = Number(row.SO  || row.K   || row.Strikeouts || 0) || undefined;
    }

    results.push(entry);
  }

  return results;
}

/**
 * Parses a FanGraphs Steamer (or ZiPS) RoS projections CSV into PlayerProjection[].
 *
 * FanGraphs batting columns: Name, Team, G, AB, PA, HR, R, RBI, SB, AVG, OBP, SLG, OPS, wOBA, playerid
 * FanGraphs pitching columns: Name, Team, G, GS, IP, SO, W, SV, ERA, WHIP, FIP, xFIP, playerid
 */
export function parseSteamerProjections(rawData: any[]): PlayerProjection[] {
  const results: PlayerProjection[] = [];

  for (const row of rawData) {
    const name =
      String(row.Name || row.name || row.Player || row.player || row['Player Name'] || '').trim();
    if (!name || name.length < 2) continue;

    const team = String(row.Team || row.team || row.Tm || '').trim();

    // Detect pitcher by IP / ERA / FIP presence
    const hasIP  = row.IP  !== undefined && row.IP  !== null && row.IP  !== '';
    const hasERA = row.ERA !== undefined && row.ERA !== null && row.ERA !== '';
    const hasFIP = row.FIP !== undefined && row.FIP !== null && row.FIP !== '';
    const isPitcher = hasIP || hasERA || hasFIP;

    const entry: PlayerProjection = { name, team, isPitcher };

    if (isPitcher) {
      entry.projIp   = Number(row.IP   || row.ip   || 0) || undefined;
      entry.projGs   = Number(row.GS   || row.gs   || 0) || undefined;
      entry.projEra  = Number(row.ERA  || row.era  || 0) || undefined;
      entry.projWhip = Number(row.WHIP || row.whip || 0) || undefined;
      entry.projK    = Number(row.SO   || row.K    || 0) || undefined;
      entry.projW    = Number(row.W    || row.Wins || row.wins || 0) || undefined;
      entry.projSv   = Number(row.SV   || row.sv   || row.Saves || 0) || undefined;
      entry.projFip  = Number(row.FIP  || row.fip  || 0) || undefined;
      entry.projXfip = Number(row.xFIP || row.xfip || 0) || undefined;
    } else {
      entry.projG    = Number(row.G    || row.g    || 0) || undefined;
      entry.projAb   = Number(row.AB   || row.ab   || 0) || undefined;
      entry.projHr   = Number(row.HR   || row.hr   || 0) || undefined;
      entry.projR    = Number(row.R    || row.r    || row.Runs || 0) || undefined;
      entry.projRbi  = Number(row.RBI  || row.rbi  || 0) || undefined;
      entry.projSb   = Number(row.SB   || row.sb   || 0) || undefined;
      entry.projAvg  = Number(row.AVG  || row.avg  || 0) || undefined;
      entry.projObp  = Number(row.OBP  || row.obp  || 0) || undefined;
      entry.projSlg  = Number(row.SLG  || row.slg  || 0) || undefined;
      entry.projOps  = Number(row.OPS  || row.ops  || 0) || undefined;
      entry.projWoba = Number(row.wOBA || row.woba || 0) || undefined;
    }

    results.push(entry);
  }

  return results;
}
