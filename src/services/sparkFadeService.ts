/**
 * SPARK / FADE scoring engine
 *
 * SPARK (0-100, higher = more breakout trajectory):
 *   S — Stuff / raw metrics above average
 *   P — Performance vs expectation (ERA vs FIP, AVG vs xwOBA-implied, etc.)
 *   A — Access / playing time opportunity
 *   R — Rising trajectory (YoY delta, requires 2 seasons of FG data)
 *   K — Kinetic age adjustment (omitted — no age column in exported CSVs)
 *
 * FADE (0-100, higher = more decline risk):
 *   F — Force erosion (stuff/EV declining)
 *   A — Age attrition (omitted — no age column)
 *   D — Discipline decay (BB% rising, K% for batters rising)
 *   E — Efficiency collapse (ERA above FIP/xFIP gap; xwOBA << wOBA)
 *
 * Both scores are computed WITHOUT age because the FG exports lack an Age column.
 * The tier labels assume "could be any age" — add age filtering in the UI layer.
 */

import { FGBatterSeason, FGPitcherSeason, SparkScore, FadeScore } from '../types';

// ─── helpers ───────────────────────────────────────────────────────────────

/** Clamp a value to [0, 100] */
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Get the two most-recent seasons for a player, sorted desc */
function latestTwo<T extends { season: number }>(rows: T[]): [T | null, T | null] {
  const sorted = [...rows].sort((a, b) => b.season - a.season);
  return [sorted[0] ?? null, sorted[1] ?? null];
}

/** Normalize name for fuzzy matching (lowercase, no punctuation) */
const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');

function findBatterRows(name: string, fgBat: FGBatterSeason[]): FGBatterSeason[] {
  const nn = normName(name);
  return fgBat.filter(r => normName(r.name) === nn);
}

function findPitcherRows(name: string, fgPit: FGPitcherSeason[]): FGPitcherSeason[] {
  const nn = normName(name);
  return fgPit.filter(r => normName(r.name) === nn);
}

// ─── SPARK — batters ────────────────────────────────────────────────────────

function sparkBatter(name: string, rows: FGBatterSeason[]): SparkScore | null {
  const [cur, prev] = latestTwo(rows);
  if (!cur) return null;

  // ── Pillar: Stuff (raw quality) ─────────────────────────────────
  // Use xwOBA as the primary quality signal for batters (higher = better)
  // League avg xwOBA ~ 0.315; elite ~ 0.380+
  let stuffScore = 0;
  const reasons: string[] = [];

  if (cur.xwoba > 0) {
    // Map 0.250 → 0, 0.315 → 50, 0.380+ → 100
    stuffScore = clamp(((cur.xwoba - 0.250) / (0.380 - 0.250)) * 100);
    if (cur.xwoba >= 0.370) reasons.push(`Elite xwOBA ${cur.xwoba.toFixed(3)}`);
    else if (cur.xwoba >= 0.340) reasons.push(`Strong xwOBA ${cur.xwoba.toFixed(3)}`);
  } else if (cur.wrcPlus > 0) {
    // Fallback: wRC+ (100 = league avg)
    stuffScore = clamp(((cur.wrcPlus - 70) / (150 - 70)) * 100);
    if (cur.wrcPlus >= 140) reasons.push(`Elite wRC+ ${cur.wrcPlus}`);
    else if (cur.wrcPlus >= 115) reasons.push(`Above-avg wRC+ ${cur.wrcPlus}`);
  }

  // ── Pillar: Performance vs expectation ──────────────────────────
  // xwOBA >> wOBA implies positive regression coming (performance below true talent)
  // ISO above average (> 0.170) signals raw power
  let perfScore = 50; // default neutral
  if (cur.xwoba > 0 && cur.woba > 0) {
    const gap = cur.xwoba - cur.woba; // positive = xwOBA > wOBA → batter due for improvement
    perfScore = clamp(50 + gap * 500); // ±0.050 gap shifts ±25 pts
    if (gap >= 0.030) reasons.push(`xwOBA>${cur.xwoba.toFixed(3)} leads wOBA${cur.woba.toFixed(3)} (+${(gap*1000).toFixed(0)})`);
  } else if (cur.wrcPlus > 0) {
    perfScore = clamp(((cur.wrcPlus - 70) / (150 - 70)) * 100);
  }

  // Contact quality bonus: low K% and good BB%
  if (cur.kPct > 0 && cur.kPct < 0.18) {
    perfScore = Math.min(100, perfScore + 10);
    if (cur.kPct < 0.15) reasons.push(`Low K% ${(cur.kPct * 100).toFixed(1)}%`);
  }

  // ── Pillar: Access / opportunity ────────────────────────────────
  // PA > 400 full time; 250-400 part time; < 150 risk
  let accessScore = 0;
  if (cur.pa >= 400) accessScore = 90;
  else if (cur.pa >= 300) accessScore = 70;
  else if (cur.pa >= 200) accessScore = 50;
  else if (cur.pa >= 100) accessScore = 30;
  else accessScore = 10;

  // ── Trend (YoY delta) ───────────────────────────────────────────
  let trend: SparkScore['trend'] = 'unknown';
  let trendBonus = 0;
  if (prev && cur.xwoba > 0 && prev.xwoba > 0) {
    const delta = cur.xwoba - prev.xwoba;
    if (delta >= 0.020) { trend = 'improving'; trendBonus = 15; reasons.push(`xwOBA +${(delta*1000).toFixed(0)} YoY`); }
    else if (delta <= -0.020) { trend = 'declining'; trendBonus = -10; }
    else trend = 'stable';
  } else if (prev && cur.wrcPlus > 0 && prev.wrcPlus > 0) {
    const delta = cur.wrcPlus - prev.wrcPlus;
    if (delta >= 15) { trend = 'improving'; trendBonus = 15; reasons.push(`wRC+ +${delta} YoY`); }
    else if (delta <= -15) { trend = 'declining'; trendBonus = -10; }
    else trend = 'stable';
  }

  const score = clamp((stuffScore * 0.40) + (perfScore * 0.35) + (accessScore * 0.25) + trendBonus);

  const tier: SparkScore['tier'] =
    score >= 75 ? 'Breakout' :
    score >= 55 ? 'Building' :
    score >= 35 ? 'Developing' : 'Watch';

  return {
    name, isPitcher: false, score: Math.round(score), tier,
    pillars: { stuff: Math.round(stuffScore), performance: Math.round(perfScore), access: Math.round(accessScore) },
    trend,
    topReason: reasons[0] ?? `xwOBA ${cur.xwoba > 0 ? cur.xwoba.toFixed(3) : 'n/a'} · wRC+ ${cur.wrcPlus || 'n/a'}`,
  };
}

// ─── SPARK — pitchers ───────────────────────────────────────────────────────

function sparkPitcher(name: string, rows: FGPitcherSeason[], stuffRows: any[]): SparkScore | null {
  const [cur, prev] = latestTwo(rows);
  if (!cur && stuffRows.length === 0) return null;

  const normN = normName(name);
  const stuffRow = stuffRows.find(r => normName(r.name) === normN);

  // ── Pillar: Stuff ────────────────────────────────────────────────
  let stuffScore = 50;
  const reasons: string[] = [];

  if (stuffRow) {
    const stuffPlus = stuffRow.stuffPlus || stuffRow['Stuff+'] || 0;
    const kPlus = stuffRow['K%+'] || 0;
    if (stuffPlus > 0) {
      // 100 = avg, 120 = elite; map 80-130 → 0-100
      stuffScore = clamp(((stuffPlus - 80) / 50) * 100);
      if (stuffPlus >= 120) reasons.push(`Elite Stuff+ ${stuffPlus}`);
      else if (stuffPlus >= 110) reasons.push(`Above-avg Stuff+ ${stuffPlus}`);
    } else if (kPlus > 0) {
      stuffScore = clamp(((kPlus - 80) / 50) * 100);
    }
  }

  if (cur) {
    // K% is a strong talent signal; above 27% is elite
    if (cur.kPct > 0) {
      const kScore = clamp(((cur.kPct - 0.15) / (0.32 - 0.15)) * 100);
      stuffScore = stuffRow ? (stuffScore + kScore) / 2 : kScore;
      if (cur.kPct >= 0.28) reasons.push(`High K% ${(cur.kPct * 100).toFixed(1)}%`);
    }
  }

  // ── Pillar: Performance vs expectation ──────────────────────────
  // ERA above xFIP/SIERA → due for regression (good for pitcher)
  let perfScore = 50;
  if (cur) {
    const anchor = cur.siera > 0 ? cur.siera : cur.xfip > 0 ? cur.xfip : cur.fip;
    if (anchor > 0 && cur.era > 0) {
      const gap = cur.era - anchor; // positive = ERA above true talent, pitcher due to improve
      perfScore = clamp(50 + gap * 20); // 1.00 ERA gap → +20 pts
      if (gap >= 0.80) reasons.push(`ERA ${cur.era.toFixed(2)} >> xFIP ${anchor.toFixed(2)} (+${gap.toFixed(2)})`);
    }
    // FIP- or xFIP- below 90 is elite
    if (cur.xfipMinus > 0 && cur.xfipMinus < 90) {
      perfScore = Math.max(perfScore, clamp(((120 - cur.xfipMinus) / 50) * 100));
      if (cur.xfipMinus < 85) reasons.push(`Elite xFIP- ${cur.xfipMinus}`);
    }
    // K-BB% — elite is above 18%
    if (cur.kMinusBBPct >= 0.18) {
      perfScore = Math.min(100, perfScore + 10);
      reasons.push(`K-BB% ${(cur.kMinusBBPct * 100).toFixed(1)}%`);
    }
  }

  // ── Pillar: Access / opportunity ────────────────────────────────
  // Use FG IP data if available; SPs with 150+ IP get max access score
  let accessScore = 50; // default: unknown
  if (cur) {
    // FG Pitching Advanced doesn't have IP — proxy via # of rows / games
    // If we have a SIERA (only starters really accumulate meaningful SIERA), bump access
    if (cur.siera > 0) accessScore = 75; // starter likely
    else accessScore = 60; // reliever or part-time
  }
  if (stuffRow) {
    // Stuff+ leaderboard does have IP
    const ip = stuffRow.ip || stuffRow.IP || 0;
    if (ip >= 150) accessScore = 95;
    else if (ip >= 100) accessScore = 80;
    else if (ip >= 50)  accessScore = 60;
    else if (ip >= 20)  accessScore = 40;
  }

  // ── Trend (YoY) ─────────────────────────────────────────────────
  let trend: SparkScore['trend'] = 'unknown';
  let trendBonus = 0;
  if (prev && cur) {
    const anchorCur  = cur.siera > 0  ? cur.siera  : cur.xfip;
    const anchorPrev = prev.siera > 0 ? prev.siera : prev.xfip;
    if (anchorCur > 0 && anchorPrev > 0) {
      const delta = anchorPrev - anchorCur; // positive = got better (lower ERA)
      if (delta >= 0.30) { trend = 'improving'; trendBonus = 15; reasons.push(`xFIP ${delta.toFixed(2)} better YoY`); }
      else if (delta <= -0.30) { trend = 'declining'; trendBonus = -10; }
      else trend = 'stable';
    }
  }

  const score = clamp((stuffScore * 0.40) + (perfScore * 0.35) + (accessScore * 0.25) + trendBonus);
  const tier: SparkScore['tier'] =
    score >= 75 ? 'Breakout' :
    score >= 55 ? 'Building' :
    score >= 35 ? 'Developing' : 'Watch';

  return {
    name, isPitcher: true, score: Math.round(score), tier,
    pillars: { stuff: Math.round(stuffScore), performance: Math.round(perfScore), access: Math.round(accessScore) },
    trend,
    topReason: reasons[0] ?? (cur ? `K% ${(cur.kPct * 100).toFixed(1)}% · xFIP ${cur.xfip > 0 ? cur.xfip.toFixed(2) : 'n/a'}` : 'Stuff+ only'),
  };
}

// ─── FADE — batters ─────────────────────────────────────────────────────────

function fadeBatter(name: string, rows: FGBatterSeason[]): FadeScore | null {
  const [cur, prev] = latestTwo(rows);
  if (!cur) return null;

  const reasons: string[] = [];

  // ── Force erosion: EV / xwOBA declining ─────────────────────────
  let forceScore = 0;
  if (prev && cur.xwoba > 0 && prev.xwoba > 0) {
    const delta = prev.xwoba - cur.xwoba; // positive = got worse
    if (delta >= 0.030) { forceScore = 80; reasons.push(`xwOBA dropped ${(delta * 1000).toFixed(0)} pts YoY`); }
    else if (delta >= 0.015) { forceScore = 50; reasons.push(`xwOBA -${(delta * 1000).toFixed(0)} YoY`); }
    else if (delta >= 0) forceScore = 20;
    else forceScore = 0; // improving
  } else if (cur.iso > 0) {
    // ISO below 0.120 for a regular is a power erosion flag
    forceScore = cur.iso < 0.120 ? 60 : cur.iso < 0.150 ? 30 : 0;
  }

  // ── Discipline decay: K% rising, BB% falling ────────────────────
  let disciplineScore = 0;
  if (cur.kPct > 0) {
    if (cur.kPct >= 0.28) { disciplineScore += 50; reasons.push(`High K% ${(cur.kPct * 100).toFixed(1)}%`); }
    else if (cur.kPct >= 0.23) disciplineScore += 25;
  }
  if (cur.bbPct > 0 && cur.bbPct < 0.06) {
    disciplineScore += 30; reasons.push(`Low BB% ${(cur.bbPct * 100).toFixed(1)}%`);
  }
  if (prev && cur.kPct > 0 && prev.kPct > 0) {
    const kDelta = cur.kPct - prev.kPct;
    if (kDelta >= 0.03) { disciplineScore = Math.min(100, disciplineScore + 30); reasons.push(`K% +${(kDelta * 100).toFixed(1)}% YoY`); }
  }
  disciplineScore = clamp(disciplineScore);

  // ── Efficiency collapse: wRC+ < 90, wOBA >> xwOBA ───────────────
  let efficiencyScore = 0;
  if (cur.wrcPlus > 0 && cur.wrcPlus < 90) {
    efficiencyScore = clamp(((90 - cur.wrcPlus) / 30) * 80);
    if (cur.wrcPlus < 75) reasons.push(`Low wRC+ ${cur.wrcPlus}`);
  }
  if (cur.woba > 0 && cur.xwoba > 0) {
    const gap = cur.woba - cur.xwoba; // positive = wOBA > xwOBA → luck-driven, likely to regress down
    if (gap >= 0.030) { efficiencyScore = Math.min(100, efficiencyScore + 30); reasons.push(`wOBA${cur.woba.toFixed(3)} >> xwOBA${cur.xwoba.toFixed(3)}`); }
  }
  efficiencyScore = clamp(efficiencyScore);

  const score = clamp((forceScore * 0.40) + (disciplineScore * 0.35) + (efficiencyScore * 0.25));

  const tier: FadeScore['tier'] =
    score >= 70 ? 'Sell High' :
    score >= 45 ? 'Monitor' :
    score >= 25 ? 'Hold' : 'Stable';

  return {
    name, isPitcher: false, score: Math.round(score), tier,
    pillars: { forceErosion: Math.round(forceScore), disciplineDecay: Math.round(disciplineScore), efficiencyCollapse: Math.round(efficiencyScore) },
    topReason: reasons[0] ?? `wRC+ ${cur.wrcPlus || 'n/a'} · K% ${cur.kPct > 0 ? (cur.kPct * 100).toFixed(1) + '%' : 'n/a'}`,
  };
}

// ─── FADE — pitchers ─────────────────────────────────────────────────────────

function fadePitcher(name: string, rows: FGPitcherSeason[], stuffRows: any[]): FadeScore | null {
  const [cur, prev] = latestTwo(rows);
  if (!cur) return null;

  const normN = normName(name);
  const stuffRow = stuffRows.find(r => normName(r.name) === normN);

  const reasons: string[] = [];

  // ── Force erosion: K% declining, Stuff+ declining ───────────────
  let forceScore = 0;
  if (prev && cur.kPct > 0 && prev.kPct > 0) {
    const kDelta = prev.kPct - cur.kPct; // positive = K% dropped = bad
    if (kDelta >= 0.04) { forceScore = 80; reasons.push(`K% dropped ${(kDelta * 100).toFixed(1)}% YoY`); }
    else if (kDelta >= 0.02) { forceScore = 50; reasons.push(`K% -${(kDelta * 100).toFixed(1)}% YoY`); }
    else if (kDelta >= 0) forceScore = 20;
  }
  if (stuffRow) {
    const stuffPlus = stuffRow.stuffPlus || stuffRow['Stuff+'] || 0;
    if (stuffPlus > 0 && stuffPlus < 90) {
      forceScore = Math.max(forceScore, clamp(((90 - stuffPlus) / 20) * 80));
      if (stuffPlus < 85) reasons.push(`Low Stuff+ ${stuffPlus}`);
    }
  }

  // ── Discipline decay: BB% rising ────────────────────────────────
  let disciplineScore = 0;
  if (cur.bbPct >= 0.10) { disciplineScore = 80; reasons.push(`High BB% ${(cur.bbPct * 100).toFixed(1)}%`); }
  else if (cur.bbPct >= 0.08) { disciplineScore = 50; }
  else if (cur.bbPct >= 0.06) { disciplineScore = 20; }
  if (prev && cur.bbPct > 0 && prev.bbPct > 0) {
    const bbDelta = cur.bbPct - prev.bbPct;
    if (bbDelta >= 0.02) { disciplineScore = Math.min(100, disciplineScore + 30); reasons.push(`BB% +${(bbDelta * 100).toFixed(1)}% YoY`); }
  }
  disciplineScore = clamp(disciplineScore);

  // ── Efficiency collapse: ERA well above xFIP/SIERA, LOB% very low ──
  let efficiencyScore = 0;
  const anchor = cur.siera > 0 ? cur.siera : cur.xfip > 0 ? cur.xfip : cur.fip;
  if (anchor > 0 && cur.era > 0) {
    const gap = anchor - cur.era; // positive = ERA better than true talent → risk of regression up
    if (gap >= 0.80) { efficiencyScore = 80; reasons.push(`ERA ${cur.era.toFixed(2)} << xFIP ${anchor.toFixed(2)} (luck-driven)`); }
    else if (gap >= 0.40) efficiencyScore = 50;
    else if (gap <= -0.50) efficiencyScore = 0; // ERA worse than xFIP → already regressing
  }
  // xFIP- above 110 = below-average
  if (cur.xfipMinus > 110) {
    efficiencyScore = Math.max(efficiencyScore, clamp(((cur.xfipMinus - 100) / 30) * 80));
    if (cur.xfipMinus > 120) reasons.push(`xFIP- ${cur.xfipMinus} (below avg)`);
  }
  efficiencyScore = clamp(efficiencyScore);

  const score = clamp((forceScore * 0.40) + (disciplineScore * 0.35) + (efficiencyScore * 0.25));

  const tier: FadeScore['tier'] =
    score >= 70 ? 'Sell High' :
    score >= 45 ? 'Monitor' :
    score >= 25 ? 'Hold' : 'Stable';

  return {
    name, isPitcher: true, score: Math.round(score), tier,
    pillars: { forceErosion: Math.round(forceScore), disciplineDecay: Math.round(disciplineScore), efficiencyCollapse: Math.round(efficiencyScore) },
    topReason: reasons[0] ?? `BB% ${cur.bbPct > 0 ? (cur.bbPct * 100).toFixed(1) + '%' : 'n/a'} · xFIP ${cur.xfip > 0 ? cur.xfip.toFixed(2) : 'n/a'}`,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute SPARK score for a named player.
 * Pass isPitcher=true for pitchers, false for batters.
 * stuffRows is the mapped Stuff+/Pitching+ leaderboard data (any[]).
 */
export function computeSparkScore(
  name: string,
  isPitcher: boolean,
  fgBat: FGBatterSeason[],
  fgPit: FGPitcherSeason[],
  stuffRows: any[],
): SparkScore | null {
  if (isPitcher) {
    const rows = findPitcherRows(name, fgPit);
    return sparkPitcher(name, rows, stuffRows);
  } else {
    const rows = findBatterRows(name, fgBat);
    return sparkBatter(name, rows);
  }
}

/**
 * Compute FADE score for a named player.
 */
export function computeFadeScore(
  name: string,
  isPitcher: boolean,
  fgBat: FGBatterSeason[],
  fgPit: FGPitcherSeason[],
  stuffRows: any[],
): FadeScore | null {
  if (isPitcher) {
    const rows = findPitcherRows(name, fgPit);
    return fadePitcher(name, rows, stuffRows);
  } else {
    const rows = findBatterRows(name, fgBat);
    return fadeBatter(name, rows);
  }
}

/**
 * Batch-compute SPARK scores for a roster.
 * Returns a map of playerName → SparkScore.
 */
export function computeRosterSpark(
  players: Array<{ name: string; pos: string[] }>,
  fgBat: FGBatterSeason[],
  fgPit: FGPitcherSeason[],
  stuffRows: any[],
): Map<string, SparkScore> {
  const out = new Map<string, SparkScore>();
  for (const p of players) {
    const isPitcher = p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos.toUpperCase()));
    const score = computeSparkScore(p.name, isPitcher, fgBat, fgPit, stuffRows);
    if (score) out.set(p.name, score);
  }
  return out;
}

/**
 * Batch-compute FADE scores for a roster.
 * Returns a map of playerName → FadeScore.
 */
export function computeRosterFade(
  players: Array<{ name: string; pos: string[] }>,
  fgBat: FGBatterSeason[],
  fgPit: FGPitcherSeason[],
  stuffRows: any[],
): Map<string, FadeScore> {
  const out = new Map<string, FadeScore>();
  for (const p of players) {
    const isPitcher = p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos.toUpperCase()));
    const score = computeFadeScore(p.name, isPitcher, fgBat, fgPit, stuffRows);
    if (score) out.set(p.name, score);
  }
  return out;
}
