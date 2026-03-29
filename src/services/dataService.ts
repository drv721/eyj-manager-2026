import Papa from 'papaparse';
import { Player, HistoricalStanding, FaabEntry, LeagueDetails, LiveCategoryStanding } from '../types';

export type DataType = 'roster' | 'standings' | 'faab' | 'statcast' | 'stuff' | 'unknown';

/**
 * Detects the data type by inspecting CSV column headers — filename-independent.
 */
export function detectDataType(csvText: string): { type: DataType; rowCount: number; confidence: 'high' | 'low' } {
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

  // FAAB / transactions
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
 * Extracts roster rules from the roster overview file
 */
export function extractRosterRulesFromRoster(csvText: string): { rules: any, salaryCap: number } {
  const lines = csvText.split('\n');
  let rules = { active: 22, reserve: 5, injured: 3, minors: 6 };
  let salaryCap = 260; // Default
  
  for (let line of lines) {
    if (line.includes('Active:') && line.includes('Reserve:') && line.includes('Salary:')) {
      // Example: Active: 22 Reserve: 5 Injured: 3 Minors: 6 Active Salary: 217.00 Total Salary: 280.00
      const activeMatch = line.match(/Active:\s*(\d+)/);
      const reserveMatch = line.match(/Reserve:\s*(\d+)/);
      const injuredMatch = line.match(/Injured:\s*(\d+)/);
      const minorsMatch = line.match(/Minors:\s*(\d+)/);
      const totalSalaryMatch = line.match(/Total Salary:\s*([\d.]+)/);
      
      if (activeMatch) rules.active = parseInt(activeMatch[1]);
      if (reserveMatch) rules.reserve = parseInt(reserveMatch[1]);
      if (injuredMatch) rules.injured = parseInt(injuredMatch[1]);
      if (minorsMatch) rules.minors = parseInt(minorsMatch[1]);
      // If total salary is listed, maybe that's the cap or current total. 
      // Usually cap is 260. 
    }
  }
  
  return { rules, salaryCap };
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
  myTeamName = 'EYJ'
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
      r.team.toLowerCase().includes(myTeamName.toLowerCase())
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
      const cat = parts[1]?.trim();
      if (cat && cat !== 'Pts' && cat !== 'Dif') currentCat = cat;
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
