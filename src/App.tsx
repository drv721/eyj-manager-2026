import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  DollarSign,
  ChevronRight,
  Target,
  Zap,
  BarChart3,
  Database,
  Loader2,
  X,
  Key,
  Pencil,
  ExternalLink,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  INITIAL_ROSTER,
  CATEGORY_PROJECTIONS,
  TEAM_BUDGETS,
  HISTORICAL_STANDINGS,
  SGP_DENOMINATORS,
  ADVANCED_METRICS,
  SGP_HEATMAP,
  KEEPER_PROJECTIONS,
  TEAM_ABBREV,
  ABBREV_TO_FULLNAME,
  MINOR_LEAGUE_PICKS,
} from './constants';
import { Player, HistoricalStanding, FaabEntry, LeagueDetails, LiveCategoryStanding, LeaguePlayer, TransactionEntry, TradeLogEntry, FaabBidEntry, PlayerStat, PlayerProjection, FGBatterSeason, FGPitcherSeason, SparkScore, FadeScore } from './types';

import {
  mapRosterData,
  mapStandingsData,
  mapFaabData,
  mapTransactionData,
  mapStatcastData,
  mapStuffData,
  extractCategoriesFromOverall,
  extractRosterRulesFromRoster,
  parseCategoryStandings,
  parseLeagueRoster,
  parseFreeAgents,
  parseCBSStats,
  parseSteamerProjections,
  parseFGBatting,
  parseFGPitching,
  detectDataType,
  parseCSVText,
  DataType
} from './services/dataService';

import {
  computeSparkScore,
  computeFadeScore,
} from './services/sparkFadeService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manage' | 'trades' | 'data' | 'strategy'>(() => {
    try {
      const t = localStorage.getItem('eyj_activeTab');
      const valid = ['dashboard', 'manage', 'trades', 'data', 'strategy'];
      if (t && valid.includes(t)) return t as any;
    } catch {}
    return 'dashboard';
  });
  const [parsedRoster, setParsedRoster] = useState<Player[] | null>(null);
  const [parsedStandings, setParsedStandings] = useState<HistoricalStanding[] | null>(null);
  const [parsedFaab, setParsedFaab] = useState<FaabEntry[] | null>(null);
  const [parsedStatcast, setParsedStatcast] = useState<any[] | null>(null);
  const [parsedStuff, setParsedStuff] = useState<any[] | null>(null);
  const [parsedLeagueDetails, setParsedLeagueDetails] = useState<LeagueDetails | null>(null);
  const [parsedCategoryStandings, setParsedCategoryStandings] = useState<LiveCategoryStanding[] | null>(null);
  const [leagueRoster, setLeagueRoster] = useState<Record<string, LeaguePlayer[]> | null>(null);
  const [transactions, setTransactions] = useState<TransactionEntry[] | null>(null);
  const [freeAgents, setFreeAgents] = useState<LeaguePlayer[]>([]);
  const [dataTimestamps, setDataTimestamps] = useState<Record<string, string>>({});
  const [faabBudget, setFaabBudget] = useState(92);
  const [tradeLog, setTradeLog] = useState<TradeLogEntry[]>([]);
  const [faabBidLog, setFaabBidLog] = useState<FaabBidEntry[]>([]);
  const [parsedStats, setParsedStats] = useState<PlayerStat[] | null>(null);
  const [parsedProjections, setParsedProjections] = useState<PlayerProjection[] | null>(null);
  const [parsedFGBat, setParsedFGBat] = useState<FGBatterSeason[]>([]);
  const [parsedFGPit, setParsedFGPit] = useState<FGPitcherSeason[]>([]);

  // Central handler: apply parsed data by type. Used by both auto-load and manual import.
  // season is required for fg-bat / fg-pit (parsed from filename); ignored for all other types.
  const applyParsedData = (type: DataType, rawData: any[], csvText: string, season?: number) => {
    if (type === 'roster') {
      setParsedRoster(mapRosterData(rawData));
      const { rules, salaryCap, faabBudget: parsedFaabBudget } = extractRosterRulesFromRoster(csvText);
      if (parsedFaabBudget !== null) setFaabBudget(parsedFaabBudget);
      setParsedLeagueDetails(prev => ({
        battingCategories: prev?.battingCategories || [],
        pitchingCategories: prev?.pitchingCategories || [],
        rosterRules: rules,
        salaryCap
      }));
    } else if (type === 'standings') {
      setParsedStandings(mapStandingsData(rawData));
      const { batting, pitching } = extractCategoriesFromOverall(csvText);
      if (batting.length > 0 || pitching.length > 0) {
        setParsedLeagueDetails(prev => ({
          battingCategories: batting,
          pitchingCategories: pitching,
          rosterRules: prev?.rosterRules || { active: 22, reserve: 5, injured: 3, minors: 6 },
          salaryCap: prev?.salaryCap || 260
        }));
      }
      const catStandings = parseCategoryStandings(csvText);
      if (catStandings.length > 0) setParsedCategoryStandings(catStandings);
    } else if (type === 'faab') {
      setParsedFaab(mapFaabData(rawData));
    } else if (type === 'statcast') {
      setParsedStatcast(mapStatcastData(rawData));
    } else if (type === 'stuff') {
      setParsedStuff(mapStuffData(rawData));
    } else if (type === 'leagueroster') {
      const lr = parseLeagueRoster(csvText);
      setLeagueRoster(lr);
    } else if (type === 'transactions') {
      setTransactions(mapTransactionData(rawData));
    } else if (type === 'freeagents') {
      const incoming = parseFreeAgents(csvText);
      // Merge with existing list, deduplicating by name — safe to upload batters + pitchers separately or together
      setFreeAgents(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const newPlayers = incoming.filter(p => !existingNames.has(p.name));
        return [...prev, ...newPlayers];
      });
    } else if (type === 'stats') {
      const incoming = parseCBSStats(rawData);
      // Merge batting + pitching uploads — deduplicate by name+isPitcher
      setParsedStats(prev => {
        if (!prev) return incoming;
        const key = (s: PlayerStat) => `${s.name}|${s.isPitcher}`;
        const existingKeys = new Set(prev.map(key));
        return [...prev, ...incoming.filter(s => !existingKeys.has(key(s)))];
      });
    } else if (type === 'projections') {
      const incoming = parseSteamerProjections(rawData);
      setParsedProjections(prev => {
        if (!prev) return incoming;
        const key = (p: PlayerProjection) => `${p.name}|${p.isPitcher}`;
        const existingKeys = new Set(prev.map(key));
        return [...prev, ...incoming.filter(p => !existingKeys.has(key(p)))];
      });
    } else if (type === 'fg-bat') {
      const yr = season ?? new Date().getFullYear();
      const incoming = parseFGBatting(rawData, yr);
      // Merge by {name, season} key — safe to upload multiple years
      setParsedFGBat(prev => {
        const key = (r: FGBatterSeason) => `${r.name.toLowerCase()}|${r.season}`;
        const existingKeys = new Set(prev.map(key));
        return [...prev, ...incoming.filter(r => !existingKeys.has(key(r)))];
      });
    } else if (type === 'fg-pit') {
      const yr = season ?? new Date().getFullYear();
      const incoming = parseFGPitching(rawData, yr);
      setParsedFGPit(prev => {
        const key = (r: FGPitcherSeason) => `${r.name.toLowerCase()}|${r.season}`;
        const existingKeys = new Set(prev.map(key));
        return [...prev, ...incoming.filter(r => !existingKeys.has(key(r)))];
      });
    }
    if (type !== 'unknown') {
      setDataTimestamps(prev => ({ ...prev, [type]: new Date().toISOString() }));
    }
  };

  // Restore persisted data from localStorage on mount
  useEffect(() => {
    try {
      const roster = localStorage.getItem('eyj_roster');
      if (roster) setParsedRoster(JSON.parse(roster));
      const standings = localStorage.getItem('eyj_standings');
      if (standings) setParsedStandings(JSON.parse(standings));
      const faab = localStorage.getItem('eyj_faab');
      if (faab) setParsedFaab(JSON.parse(faab));
      const statcast = localStorage.getItem('eyj_statcast');
      if (statcast) setParsedStatcast(JSON.parse(statcast));
      const stuff = localStorage.getItem('eyj_stuff');
      if (stuff) setParsedStuff(JSON.parse(stuff));
      const details = localStorage.getItem('eyj_leagueDetails');
      if (details) setParsedLeagueDetails(JSON.parse(details));
      const catStandings = localStorage.getItem('eyj_categoryStandings');
      if (catStandings) setParsedCategoryStandings(JSON.parse(catStandings));
      const lr = localStorage.getItem('eyj_leagueroster');
      if (lr) setLeagueRoster(JSON.parse(lr));
      const txns = localStorage.getItem('eyj_transactions');
      if (txns) setTransactions(JSON.parse(txns));
      const fa = localStorage.getItem('eyj_freeagents');
      if (fa) setFreeAgents(JSON.parse(fa));
      const ts = localStorage.getItem('eyj_timestamps');
      if (ts) setDataTimestamps(JSON.parse(ts));
      const budget = localStorage.getItem('eyj_faabBudget');
      if (budget) setFaabBudget(Number(budget));
      const tl = localStorage.getItem('eyj_tradelog');
      if (tl) setTradeLog(JSON.parse(tl));
      const bl = localStorage.getItem('eyj_faabbidlog');
      if (bl) setFaabBidLog(JSON.parse(bl));
      const stats = localStorage.getItem('eyj_stats');
      if (stats) setParsedStats(JSON.parse(stats));
      const projs = localStorage.getItem('eyj_projections');
      if (projs) setParsedProjections(JSON.parse(projs));
      const fgb = localStorage.getItem('eyj_fgbat');
      if (fgb) setParsedFGBat(JSON.parse(fgb));
      const fgp = localStorage.getItem('eyj_fgpit');
      if (fgp) setParsedFGPit(JSON.parse(fgp));
    } catch (err) {
      console.error('Failed to restore from localStorage', err);
    }
  }, []);

  // Persist state to localStorage whenever it changes
  useEffect(() => { if (parsedRoster) localStorage.setItem('eyj_roster', JSON.stringify(parsedRoster)); }, [parsedRoster]);
  useEffect(() => { if (parsedStandings) localStorage.setItem('eyj_standings', JSON.stringify(parsedStandings)); }, [parsedStandings]);
  useEffect(() => { if (parsedFaab) localStorage.setItem('eyj_faab', JSON.stringify(parsedFaab)); }, [parsedFaab]);
  useEffect(() => { if (parsedStatcast) localStorage.setItem('eyj_statcast', JSON.stringify(parsedStatcast)); }, [parsedStatcast]);
  useEffect(() => { if (parsedStuff) localStorage.setItem('eyj_stuff', JSON.stringify(parsedStuff)); }, [parsedStuff]);
  useEffect(() => { if (parsedLeagueDetails) localStorage.setItem('eyj_leagueDetails', JSON.stringify(parsedLeagueDetails)); }, [parsedLeagueDetails]);
  useEffect(() => { if (parsedCategoryStandings) localStorage.setItem('eyj_categoryStandings', JSON.stringify(parsedCategoryStandings)); }, [parsedCategoryStandings]);
  useEffect(() => { if (leagueRoster) localStorage.setItem('eyj_leagueroster', JSON.stringify(leagueRoster)); }, [leagueRoster]);
  useEffect(() => { if (transactions) localStorage.setItem('eyj_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { if (freeAgents.length > 0) localStorage.setItem('eyj_freeagents', JSON.stringify(freeAgents)); }, [freeAgents]);
  useEffect(() => { if (Object.keys(dataTimestamps).length > 0) localStorage.setItem('eyj_timestamps', JSON.stringify(dataTimestamps)); }, [dataTimestamps]);
  useEffect(() => { localStorage.setItem('eyj_faabBudget', String(faabBudget)); }, [faabBudget]);
  useEffect(() => { localStorage.setItem('eyj_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('eyj_tradelog', JSON.stringify(tradeLog)); }, [tradeLog]);
  useEffect(() => { localStorage.setItem('eyj_faabbidlog', JSON.stringify(faabBidLog)); }, [faabBidLog]);
  useEffect(() => { if (parsedStats) localStorage.setItem('eyj_stats', JSON.stringify(parsedStats)); }, [parsedStats]);
  useEffect(() => { if (parsedProjections) localStorage.setItem('eyj_projections', JSON.stringify(parsedProjections)); }, [parsedProjections]);
  useEffect(() => { if (parsedFGBat.length > 0) localStorage.setItem('eyj_fgbat', JSON.stringify(parsedFGBat)); }, [parsedFGBat]);
  useEffect(() => { if (parsedFGPit.length > 0) localStorage.setItem('eyj_fgpit', JSON.stringify(parsedFGPit)); }, [parsedFGPit]);

  const handleResetData = () => {
    ['eyj_roster','eyj_standings','eyj_faab','eyj_statcast','eyj_stuff','eyj_leagueDetails','eyj_categoryStandings','eyj_leagueroster','eyj_transactions','eyj_freeagents','eyj_timestamps','eyj_tradelog','eyj_faabbidlog','eyj_stats','eyj_projections','eyj_fgbat','eyj_fgpit'].forEach(k => localStorage.removeItem(k));
    setTradeLog([]);
    setFaabBidLog([]);
    setParsedStats(null);
    setParsedProjections(null);
    setParsedFGBat([]);
    setParsedFGPit([]);
    setParsedRoster(null);
    setParsedStandings(null);
    setParsedFaab(null);
    setParsedStatcast(null);
    setParsedStuff(null);
    setParsedLeagueDetails(null);
    setParsedCategoryStandings(null);
    setLeagueRoster(null);
    setTransactions(null);
    setFreeAgents([]);
    setDataTimestamps({});
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <nav className="w-full md:w-64 md:h-screen md:overflow-y-auto bg-[#141414] text-[#E4E3E0] p-6 flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif italic text-2xl tracking-tight">EYJ Manager</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-50">Deez Nutz 2026 • Roto</p>
        </div>

        <div className="flex flex-col gap-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
          />
          <NavItem
            active={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
            icon={<LayoutList size={18} />}
            label="Roster Management"
          />
          <NavItem 
            active={activeTab === 'trades'} 
            onClick={() => setActiveTab('trades')} 
            icon={<ArrowLeftRight size={18} />} 
            label="Trades" 
          />
          <NavItem
            active={activeTab === 'strategy'}
            onClick={() => setActiveTab('strategy')}
            icon={<Zap size={18} />}
            label="Strategy"
          />
          <NavItem
            active={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            icon={<Database size={18} />}
            label="Data"
          />
        </div>

        <div className="mt-auto pt-8 border-t border-white/10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase opacity-50">FAAB Budget</span>
              <span className="text-[10px] opacity-25 italic">click to edit</span>
            </div>
            <EditableSidebarValue value={faabBudget} onChange={setFaabBudget} prefix="$" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase opacity-50">Luxury Tax</span>
            <span className={`font-mono text-lg ${((parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER).filter(p => !p.isMinor).reduce((sum, p) => sum + p.salary, 0) > 400 ? 'text-red-400' : ''}`}>
              ${((parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER)
                  .filter(p => !p.isMinor)
                  .reduce((sum, p) => sum + p.salary, 0)} / $400
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardView
              key="dashboard"
              standings={(parsedStandings && parsedStandings.length > 0) ? parsedStandings : HISTORICAL_STANDINGS}
              leagueDetails={parsedLeagueDetails}
              transactions={transactions}
              tradeLog={tradeLog}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
              parsedStats={parsedStats}
              parsedProjections={parsedProjections}
              parsedFGBat={parsedFGBat}
              parsedFGPit={parsedFGPit}
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
            />
          )}
          {activeTab === 'manage' && (
            <ManageView
              key="manage"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
              leagueDetails={parsedLeagueDetails}
              faabBudget={faabBudget}
              onBudgetChange={setFaabBudget}
              parsedFaab={parsedFaab}
              transactions={transactions}
              categoryStandings={parsedCategoryStandings}
              leagueRoster={leagueRoster}
              freeAgents={freeAgents}
              dataTimestamps={dataTimestamps}
              faabBidLog={faabBidLog}
              onSaveFaabBid={(entry) => setFaabBidLog(prev => [entry, ...prev])}
              onUpdateFaabBid={(id, patch) => setFaabBidLog(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))}
              onDeleteFaabBid={(id) => setFaabBidLog(prev => prev.filter(e => e.id !== id))}
              parsedStats={parsedStats}
              parsedProjections={parsedProjections}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
              parsedFGBat={parsedFGBat}
              parsedFGPit={parsedFGPit}
            />
          )}
          {activeTab === 'trades' && (
            <TradesView
              key="trades"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
              categoryStandings={parsedCategoryStandings}
              leagueRoster={leagueRoster}
              tradeLog={tradeLog}
              onSaveTrade={(entry) => setTradeLog(prev => [entry, ...prev])}
              onUpdateTrade={(id, patch) => setTradeLog(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))}
              onDeleteTrade={(id) => setTradeLog(prev => prev.filter(e => e.id !== id))}
            />
          )}
          {activeTab === 'strategy' && (
            <StrategyLabView
              key="strategy"
              parsedRoster={parsedRoster}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
              parsedStats={parsedStats}
              parsedProjections={parsedProjections}
              parsedFGBat={parsedFGBat}
              parsedFGPit={parsedFGPit}
              freeAgents={freeAgents}
              categoryStandings={parsedCategoryStandings}
              transactions={transactions}
              faabBudget={faabBudget}
            />
          )}
          {activeTab === 'data' && (
            <DataView
              key="data"
              onDataLoaded={applyParsedData}
              onResetData={handleResetData}
              onClearFreeAgents={() => { setFreeAgents([]); localStorage.removeItem('eyj_freeagents'); }}
              onClearStats={() => { setParsedStats(null); localStorage.removeItem('eyj_stats'); }}
              onClearProjections={() => { setParsedProjections(null); localStorage.removeItem('eyj_projections'); }}
              onClearFGBat={() => { setParsedFGBat([]); localStorage.removeItem('eyj_fgbat'); }}
              onClearFGPit={() => { setParsedFGPit([]); localStorage.removeItem('eyj_fgpit'); }}
              dataTimestamps={dataTimestamps}
              parsedRoster={parsedRoster}
              parsedStandings={parsedStandings}
              parsedFaab={parsedFaab}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
              parsedStats={parsedStats}
              parsedProjections={parsedProjections}
              parsedFGBat={parsedFGBat}
              parsedFGPit={parsedFGPit}
              leagueRoster={leagueRoster}
              freeAgents={freeAgents}
              transactions={transactions}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
        active ? 'bg-[#F27D26] text-white' : 'hover:bg-white/5 opacity-70 hover:opacity-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DashboardView({ standings, leagueDetails, transactions, tradeLog, parsedStatcast, parsedStuff, parsedStats, parsedProjections, parsedFGBat, parsedFGPit, roster }: {
  standings: HistoricalStanding[];
  leagueDetails: LeagueDetails | null;
  transactions: TransactionEntry[] | null;
  tradeLog: TradeLogEntry[];
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  parsedStats: PlayerStat[] | null;
  parsedProjections: PlayerProjection[] | null;
  parsedFGBat: FGBatterSeason[];
  parsedFGPit: FGPitcherSeason[];
  roster: Player[];
  key?: any;
}) {
  const hasLeagueCategories = leagueDetails && 
    (leagueDetails.battingCategories.length > 0 || leagueDetails.pitchingCategories.length > 0);

  const categories = hasLeagueCategories
    ? [...leagueDetails.battingCategories, ...leagueDetails.pitchingCategories]
    : CATEGORY_PROJECTIONS.map(p => p.cat);

  const projections = categories.map(cat => {
    const existing = CATEGORY_PROJECTIONS.find(p => p.cat === cat);
    if (existing) return existing;
    return { cat, value: '-', rank: 'N/A' };
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">Season Pulse</h2>
          <p className="text-sm opacity-60">March 28, 2026 • Opening Week</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase opacity-50">Projected Rank</p>
            <p className="text-2xl font-mono">#3–4</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Strengths */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl">Category Projections</h3>
            <Target size={18} className="opacity-30" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {projections.map((proj, i) => (
              <div key={`${proj.cat}-${i}`} className="p-4 rounded-xl bg-[#F8F8F8] border border-black/5">
                <p className="text-[10px] uppercase opacity-50 mb-1">{proj.cat}</p>
                <p className="text-lg font-mono mb-1">{proj.value}</p>
                <p className={`text-[10px] font-bold ${proj.rank.includes('Top') || proj.rank.includes('#1') ? 'text-green-600' : 'text-gray-400'}`}>
                  {proj.rank}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Player Signals + Pending Trades row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Player Signals */}
        {(() => {
          const nm = (a: string, b: string) => {
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
            const lastN = (s: string) => norm(s).split(' ').slice(-1)[0];
            return norm(a) === norm(b) || lastN(a) === lastN(b);
          };
          const activePitchers = roster.filter(p => p.pos.some(x => ['SP','RP','P'].includes(x)) && !p.isMinor);
          const activeBatters  = roster.filter(p => !p.pos.some(x => ['SP','RP','P'].includes(x)) && !p.isMinor);

          type Signal = { name: string; label: string; stat: string; dir: 'up' | 'down' };
          const signals: Signal[] = [];

          // ── Pitchers: priority stack ──
          activePitchers.forEach(p => {
            const stuff = parsedStuff?.find(d => nm(d.name, p.name));
            const stat  = parsedStats?.find(d => nm(d.name, p.name) && d.isPitcher);
            const proj  = parsedProjections?.find(d => nm(d.name, p.name) && d.isPitcher);

            // 1. Stuff+ vs Pitching+ gap
            if (stuff?.stuffPlus && stuff?.pitchingPlus) {
              const gap = stuff.pitchingPlus - stuff.stuffPlus;
              if (gap < -8) { signals.push({ name: p.name, label: 'Hold · Upside', stat: `Stuff+ ${stuff.stuffPlus} / Pitch+ ${stuff.pitchingPlus}`, dir: 'up' }); return; }
              if (gap > 8)  { signals.push({ name: p.name, label: 'Sell high', stat: `Pitch+ ${stuff.pitchingPlus}`, dir: 'down' }); return; }
            }
            // 2. ERA vs Steamer projection gap
            if (stat?.era && proj?.projEra && proj.projEra > 0) {
              const diff = stat.era - proj.projEra;
              if (diff > 0.60)  { signals.push({ name: p.name, label: 'ERA regression risk', stat: `ERA ${stat.era.toFixed(2)} vs proj ${proj.projEra.toFixed(2)}`, dir: 'down' }); return; }
              if (diff < -0.60) { signals.push({ name: p.name, label: 'ERA outperforming', stat: `ERA ${stat.era.toFixed(2)} vs proj ${proj.projEra.toFixed(2)}`, dir: 'up' }); return; }
            }
            // 3. Elite Stuff+ alone is worth surfacing on dashboard
            if (stuff?.stuffPlus && stuff.stuffPlus >= 112) {
              signals.push({ name: p.name, label: 'Elite stuff', stat: `Stuff+ ${stuff.stuffPlus}`, dir: 'up' });
            }
          });

          // ── Batters: priority stack ──
          activeBatters.forEach(p => {
            const sc   = parsedStatcast?.find(d => nm(d.name, p.name));
            const stat = parsedStats?.find(d => nm(d.name, p.name) && !d.isPitcher);
            const proj = parsedProjections?.find(d => nm(d.name, p.name) && !d.isPitcher);

            // 1. xwOBA extremes
            if (sc?.xwoba) {
              const xw = sc.xwoba;
              if (xw >= 0.370) { signals.push({ name: p.name, label: 'Elite contact', stat: `xwOBA ${xw.toFixed(3)}`, dir: 'up' }); return; }
              if (xw < 0.295 && xw > 0) { signals.push({ name: p.name, label: 'Weak contact', stat: `xwOBA ${xw.toFixed(3)}`, dir: 'down' }); return; }
            }
            // 2. AVG vs Steamer projection gap
            if (stat?.avg && proj?.projAvg && proj.projAvg > 0) {
              const diff = (stat.avg || 0) - proj.projAvg;
              if (diff > 0.035)  { signals.push({ name: p.name, label: 'Sell high', stat: `AVG ${stat.avg?.toFixed(3)} vs proj ${proj.projAvg.toFixed(3)}`, dir: 'down' }); return; }
              if (diff < -0.035) { signals.push({ name: p.name, label: 'Buy low', stat: `AVG ${stat.avg?.toFixed(3)} vs proj ${proj.projAvg.toFixed(3)}`, dir: 'up' }); return; }
            }
          });

          const upSignals   = signals.filter(s => s.dir === 'up').slice(0, 5);
          const downSignals = signals.filter(s => s.dir === 'down').slice(0, 4);
          const hasData = parsedStuff || parsedStatcast || parsedStats || parsedProjections;

          return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-serif italic text-xl">Player Signals</h3>
                <span className="text-[10px] opacity-40 italic">Stuff+ · Statcast · CBS · Steamer</span>
              </div>
              {signals.length === 0 ? (
                <p className="text-sm opacity-40 italic">
                  {hasData
                    ? 'No strong signals detected for your active roster right now.'
                    : 'Upload Statcast, Stuff+, CBS stats, or Steamer projections in the Data tab to see player signals here.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upSignals.map(s => (
                    <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-black/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-bold text-base leading-none">↑</span>
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-50">{s.stat}</span>
                        <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">{s.label}</span>
                      </div>
                    </div>
                  ))}
                  {downSignals.map(s => (
                    <div key={s.name} className="flex items-center justify-between py-1.5 border-b border-black/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-500 font-bold text-base leading-none">↓</span>
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-50">{s.stat}</span>
                        <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-bold">{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Pending Trades — from trade log */}
        {(() => {
          const STATUS_COLORS: Record<string, string> = {
            offered:  'bg-yellow-100 text-yellow-700',
            received: 'bg-blue-100 text-blue-700',
          };
          const pending = tradeLog.filter(t => t.status === 'offered' || t.status === 'received');
          return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-serif italic text-xl">Pending Trades</h3>
                <ArrowLeftRight size={16} className="opacity-30" />
              </div>
              {pending.length === 0 ? (
                <div className="text-sm opacity-40 italic">
                  <p>No pending trades.</p>
                  <p className="text-xs mt-1">Save trade scenarios with "Offered" or "Received" status in the Trades tab to see them here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pending.map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-[#F8F8F8] border border-black/5">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold opacity-60">vs {t.counterTeam}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                      </div>
                      <p className="text-xs mb-0.5"><span className="opacity-50">Out:</span> {t.giving.join(', ') || '—'}</p>
                      <p className="text-xs"><span className="opacity-50">In:</span> {t.receiving.join(', ') || '—'}</p>
                      {t.notes && <p className="text-[10px] opacity-40 mt-1 italic">{t.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}


// ─── Keeper salary escalation (per league rules) ─────────────────────────────
// $1–9 → +$1, $10–19 → +$2, $20–29 → +$3, $30–39 → +$4, etc.
// K3 → Franchise: salary ≤$25 jumps to $30; salary $26+ → salary + $5
function keeperNextSalary(salary: number, contract?: string): number {
  if (salary === 0) return 5; // minor league call-up cost
  if (contract === 'K3') {
    return salary <= 25 ? 30 : salary + 5;
  }
  const bracket = Math.floor(salary / 10);
  return salary + (bracket + 1);
}

function keeperContractNext(contract: string): string {
  if (contract === 'N')  return 'K1 (if kept)';
  if (contract === 'K1') return 'K2';
  if (contract === 'K2') return 'K3';
  if (contract === 'K3') return 'F (Franchise)';
  if (contract === 'F')  return 'F (Franchise)';
  if (contract === 'M')  return 'M (stays in minors)';
  if (contract === 'M1') return 'M2';
  if (contract === 'M2') return 'K1 or FA';
  if (contract === 'M3') return 'K1';
  return 'N/A';
}

function keeperYearsLeft(contract: string): number {
  if (contract === 'N')  return 3; // N → K1 → K2 → K3
  if (contract === 'K1') return 2; // can keep K2, K3
  if (contract === 'K2') return 1; // can keep K3 only
  if (contract === 'K3') return 0; // must franchise or lose
  if (contract === 'F')  return 99;
  if (contract.startsWith('M')) return 99; // indefinite in minors
  return 0;
}

// ─── Shared player signal utility ────────────────────────────────────────────

// 'up' = green (good), 'down' = orange (sell/concern), 'warn' = yellow (watch), 'neutral' = gray (data shown, no extreme)
type PlayerSignal = { label: string; stat: string; dir: 'up' | 'down' | 'warn' | 'neutral' };

function getPlayerSignal(
  player: Player,
  parsedStuff: any[] | null,
  parsedStatcast: any[] | null,
  parsedStats: PlayerStat[] | null,
  parsedProjections: PlayerProjection[] | null,
  parsedFGBat: FGBatterSeason[] = [],
  parsedFGPit: FGPitcherSeason[] = [],
): PlayerSignal | null {
  const nm = (a: string, b: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
    const lastN = (s: string) => norm(s).split(' ').slice(-1)[0];
    return norm(a) === norm(b) || lastN(a) === lastN(b);
  };
  const isPitcher = player.pos.some(x => ['SP','RP','P'].includes(x));

  if (isPitcher) {
    const stuff = parsedStuff?.find(d => nm(d.name, player.name));
    const stat  = parsedStats?.find(d => nm(d.name, player.name) && d.isPitcher);
    const proj  = parsedProjections?.find(d => nm(d.name, player.name) && d.isPitcher);

    // Priority 1: Stuff+ vs Pitching+ gap (strong signal)
    if (stuff?.stuffPlus && stuff?.pitchingPlus) {
      const gap = stuff.pitchingPlus - stuff.stuffPlus;
      if (gap < -8) return { label: 'Hold · Upside', stat: `Stuff+ ${stuff.stuffPlus} / Pitch+ ${stuff.pitchingPlus}`, dir: 'up' };
      if (gap > 8)  return { label: 'Sell high', stat: `Pitch+ ${stuff.pitchingPlus}`, dir: 'down' };
    }
    // Priority 2: ERA vs projection gap
    if (stat?.era && proj?.projEra && proj.projEra > 0) {
      const diff = stat.era - proj.projEra;
      if (diff > 0.60)  return { label: 'ERA regression risk', stat: `ERA ${stat.era.toFixed(2)} (proj ${proj.projEra.toFixed(2)})`, dir: 'warn' };
      if (diff < -0.60) return { label: 'ERA outperforming', stat: `ERA ${stat.era.toFixed(2)} (proj ${proj.projEra.toFixed(2)})`, dir: 'up' };
    }
    // Fallback: show Stuff+ metric if we have it (color-coded, no threshold required)
    if (stuff?.stuffPlus) {
      const s = stuff.stuffPlus;
      const dir: PlayerSignal['dir'] = s >= 110 ? 'up' : s >= 95 ? 'neutral' : 'warn';
      const label = s >= 110 ? 'Elite stuff' : s >= 95 ? 'Average stuff' : 'Below avg';
      return { label, stat: `Stuff+ ${s}`, dir };
    }
    // Fallback: show ERA from CBS stats
    if (stat?.era && stat.ip && stat.ip > 5) {
      const dir: PlayerSignal['dir'] = stat.era < 3.50 ? 'up' : stat.era > 5.00 ? 'warn' : 'neutral';
      return { label: `ERA ${stat.era.toFixed(2)}`, stat: `${Math.floor(stat.ip)} IP`, dir };
    }
    // Fallback: SPARK score from FG Pitching Advanced
    if (parsedFGPit.length > 0) {
      const spark = computeSparkScore(player.name, true, parsedFGBat, parsedFGPit, parsedStuff ?? []);
      if (spark) {
        const dir: PlayerSignal['dir'] = spark.score >= 70 ? 'up' : spark.score >= 45 ? 'neutral' : 'warn';
        return { label: `${spark.tier} · SPARK ${spark.score}`, stat: spark.topReason, dir };
      }
    }
  } else {
    const sc   = parsedStatcast?.find(d => nm(d.name, player.name));
    const stat = parsedStats?.find(d => nm(d.name, player.name) && !d.isPitcher);
    const proj = parsedProjections?.find(d => nm(d.name, player.name) && !d.isPitcher);

    // Priority 1: xwOBA threshold
    if (sc?.xwoba) {
      const xw = sc.xwoba;
      if (xw >= 0.370) return { label: 'Elite contact', stat: `xwOBA ${xw.toFixed(3)}`, dir: 'up' };
      if (xw < 0.300 && xw > 0) return { label: 'Weak contact', stat: `xwOBA ${xw.toFixed(3)}`, dir: 'warn' };
      // Show the metric even if not extreme
      const dir: PlayerSignal['dir'] = xw >= 0.340 ? 'up' : xw >= 0.310 ? 'neutral' : 'warn';
      return { label: `xwOBA ${xw.toFixed(3)}`, stat: sc.ev ? `EV ${sc.ev.toFixed(1)}` : '', dir };
    }
    // Priority 2: AVG vs projection gap
    if (stat?.avg && proj?.projAvg && proj.projAvg > 0) {
      const diff = (stat.avg || 0) - proj.projAvg;
      if (diff > 0.035)  return { label: 'Sell high', stat: `AVG ${stat.avg?.toFixed(3)} (proj ${proj.projAvg.toFixed(3)})`, dir: 'down' };
      if (diff < -0.035) return { label: 'Buy low', stat: `AVG ${stat.avg?.toFixed(3)} (proj ${proj.projAvg.toFixed(3)})`, dir: 'up' };
    }
    // Fallback: show AVG from CBS if we have it
    if (stat?.avg && stat.ab && stat.ab > 10) {
      const dir: PlayerSignal['dir'] = stat.avg >= 0.280 ? 'up' : stat.avg < 0.220 ? 'warn' : 'neutral';
      return { label: `AVG ${stat.avg.toFixed(3)}`, stat: `${stat.ab} AB`, dir };
    }
    // Fallback: SPARK score from FG Batting Dashboard
    if (parsedFGBat.length > 0) {
      const spark = computeSparkScore(player.name, false, parsedFGBat, parsedFGPit, parsedStuff ?? []);
      if (spark) {
        const dir: PlayerSignal['dir'] = spark.score >= 70 ? 'up' : spark.score >= 45 ? 'neutral' : 'warn';
        return { label: `${spark.tier} · SPARK ${spark.score}`, stat: spark.topReason, dir };
      }
    }
  }
  return null;
}

function SignalChip({ signal }: { signal: PlayerSignal }) {
  const cls = signal.dir === 'up'      ? 'bg-green-50 text-green-700'
            : signal.dir === 'down'    ? 'bg-orange-50 text-orange-700'
            : signal.dir === 'warn'    ? 'bg-yellow-50 text-yellow-700'
            :                            'bg-black/5 text-black/40';
  const arrow = signal.dir === 'up' ? '↑' : signal.dir === 'down' ? '↓' : signal.dir === 'warn' ? '⚠' : '·';
  const titleText = signal.stat ? `${signal.label} — ${signal.stat}` : signal.label;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${cls}`} title={titleText}>
      {arrow} {signal.label}
    </span>
  );
}

// ─── Roster Management Mega-Tab ───────────────────────────────────────────────

function ManageView({
  roster, leagueDetails, faabBudget, onBudgetChange,
  parsedFaab, transactions, categoryStandings, leagueRoster, freeAgents, dataTimestamps,
  faabBidLog, onSaveFaabBid, onUpdateFaabBid, onDeleteFaabBid,
  parsedStats, parsedProjections, parsedStatcast, parsedStuff, parsedFGBat, parsedFGPit,
}: {
  roster: Player[];
  leagueDetails: LeagueDetails | null;
  faabBudget: number;
  onBudgetChange: (n: number) => void;
  parsedFaab: FaabEntry[] | null;
  transactions: TransactionEntry[] | null;
  categoryStandings: LiveCategoryStanding[] | null;
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  freeAgents: LeaguePlayer[];
  dataTimestamps: Record<string, string>;
  faabBidLog: FaabBidEntry[];
  onSaveFaabBid: (entry: FaabBidEntry) => void;
  onUpdateFaabBid: (id: string, patch: Partial<FaabBidEntry>) => void;
  onDeleteFaabBid: (id: string) => void;
  parsedStats: PlayerStat[] | null;
  parsedProjections: PlayerProjection[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  parsedFGBat: FGBatterSeason[];
  parsedFGPit: FGPitcherSeason[];
  key?: any;
}) {
  const [section, setSection] = useState<'roster' | 'keepers' | 'adddrop' | 'minors'>('roster');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const LUXURY_TAX = 400;
  const AUCTION_CAP = 260;

  // Build IL status lookup from leagueRoster['EYJ'] (section-based, most accurate)
  // and fall back to the isIL flag parsed from the user's own roster CSV.
  const eyjLeagueRoster = leagueRoster?.['EYJ'] ?? [];
  const normName = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const leagueILNames = new Set(
    eyjLeagueRoster.filter(lp => lp.status === 'injured').map(lp => normName(lp.name))
  );
  const isIL = (p: Player) => !!p.isIL || leagueILNames.has(normName(p.name));

  const activePlayers  = roster.filter(p => !p.isMinor && !p.isReserve && !isIL(p));
  const ilPlayers      = roster.filter(p => !p.isMinor && !p.isReserve && isIL(p));
  const reservePlayers = roster.filter(p => p.isReserve && !p.isMinor);
  const minorPlayers   = roster.filter(p => p.isMinor);
  const activeSalary   = roster.filter(p => !p.isMinor).reduce((s, p) => s + p.salary, 0);

  // Position coverage: find required positions missing from the active (non-IL) roster
  const REQUIRED_POSITIONS = ['C', 'SS', 'SP'];
  const uncoveredPositions = REQUIRED_POSITIONS.filter(req =>
    !activePlayers.some(p => p.pos.includes(req))
  );
  // Which IL players are responsible for each uncovered slot?
  const ilCovering = (req: string) => ilPlayers.filter(p => p.pos.includes(req)).map(p => p.name);

  // N-contract players are eligible to keep (as K1 next year) — included here
  const keeperEligible = roster.filter(p =>
    p.contract.match(/^(N|K[123]|M[123]?|F)$/)
  );
  const keeperCount = keeperEligible.filter(p => !p.isMinor || p.contract !== 'M').length;
  const totalKeeperCost = keeperEligible
    .filter(p => !p.isMinor)
    .reduce((s, p) => s + keeperNextSalary(p.salary, p.contract), 0);
  const remainingAuctionBudget = AUCTION_CAP - totalKeeperCost;

  const sections = [
    { id: 'roster',   label: 'Roster' },
    { id: 'keepers',  label: 'Keepers' },
    { id: 'adddrop',  label: 'Add / Drop' },
    { id: 'minors',   label: 'Minors' },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
      <header>
        <h2 className="text-4xl font-serif italic mb-1">Roster Management</h2>
        <p className="text-sm opacity-60">Roster · Keeper decisions · FAAB · Minors</p>
      </header>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Luxury Tax',
            value: `$${activeSalary}`,
            sub: `/ $${LUXURY_TAX}`,
            alert: activeSalary > LUXURY_TAX,
            alertMsg: `$${activeSalary - LUXURY_TAX} over — 10% tax next year`,
          },
          {
            label: 'FAAB Remaining',
            value: `$${faabBudget}`,
            sub: `$${120 - faabBudget} spent of $120`,
            alert: faabBudget < 20,
            alertMsg: 'Running low',
          },
          {
            label: 'Keeper Slots',
            value: `${keeperEligible.filter(p => !p.isMinor).length} / 8`,
            sub: `$${totalKeeperCost} cost · $${remainingAuctionBudget} to draft`,
            alert: keeperEligible.filter(p => !p.isMinor).length > 8,
            alertMsg: 'Over keeper limit',
          },
          {
            label: 'Roster',
            value: `${activePlayers.length + reservePlayers.length} active${ilPlayers.length > 0 ? ` · ${ilPlayers.length} IL` : ''}`,
            sub: `${minorPlayers.length} in minors`,
            alert: uncoveredPositions.length > 0,
            alertMsg: uncoveredPositions.map(pos => {
              const covering = ilCovering(pos);
              return covering.length > 0 ? `Need active ${pos} (${covering.join(', ')} on IL)` : `No active ${pos}`;
            }).join(' · '),
          },
        ].map(card => (
          <div key={card.label} className={`p-4 rounded-2xl border ${card.alert ? 'bg-red-50 border-red-200' : 'bg-white border-black/5'} shadow-sm`}>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1">{card.label}</p>
            <p className={`font-mono text-2xl font-bold ${card.alert ? 'text-red-600' : ''}`}>{card.value}</p>
            <p className="text-[10px] opacity-50 mt-0.5">{card.alert ? card.alertMsg : card.sub}</p>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-black/5 rounded-xl p-1 w-fit">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => { setSection(s.id); setSelectedPlayer(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${section === s.id ? 'bg-white shadow-sm text-[#141414]' : 'opacity-50 hover:opacity-80'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Roster section ── */}
      {section === 'roster' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Player list */}
          <div className="flex-1 flex flex-col gap-4">
            {[
              { label: 'Active Batters', players: activePlayers.filter(p => !p.pos.some(pp => ['SP','RP','P'].includes(pp))), ilGroup: false },
              { label: 'Active Pitchers', players: activePlayers.filter(p => p.pos.some(pp => ['SP','RP','P'].includes(pp))), ilGroup: false },
              { label: 'IL', players: ilPlayers, ilGroup: true },
              { label: 'Reserve', players: reservePlayers, ilGroup: false },
            ].map(group => (
              group.players.length > 0 && (
                <div key={group.label} className={`rounded-2xl border overflow-hidden shadow-sm ${group.ilGroup ? 'bg-red-50 border-red-200' : 'bg-white border-black/5'}`}>
                  <div className={`px-5 py-3 border-b flex justify-between items-center ${group.ilGroup ? 'border-red-200' : 'border-black/5'}`}>
                    <p className={`text-[10px] uppercase font-bold tracking-widest ${group.ilGroup ? 'text-red-500' : 'opacity-50'}`}>{group.label}</p>
                    <p className="text-[10px] opacity-40">{group.players.length} players · ${group.players.reduce((s,p)=>s+p.salary,0)} salary</p>
                  </div>
                  {group.players.map(p => {
                    const sig = getPlayerSignal(p, parsedStuff, parsedStatcast, parsedStats, parsedProjections, parsedFGBat, parsedFGPit);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                        className={`w-full flex items-center gap-3 px-5 py-3 border-b last:border-0 hover:bg-black/5 transition-colors text-left ${group.ilGroup ? 'border-red-200' : 'border-black/5'} ${selectedPlayer?.id === p.id ? 'bg-[#FFF4EC]' : ''}`}
                      >
                        <span className="text-[10px] font-bold text-center bg-black/5 rounded px-1.5 py-0.5 w-14 shrink-0">{p.pos.join('/')}</span>
                        <span className="flex-1 text-sm font-medium flex items-center gap-1.5">
                          {p.name}
                          {group.ilGroup && <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">IL</span>}
                        </span>
                        {sig && <SignalChip signal={sig} />}
                        <span className="text-[10px] opacity-40 shrink-0">{p.team}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.contract.startsWith('K') || p.contract.startsWith('F') ? 'bg-[#F27D26]/10 text-[#F27D26]' : p.contract.startsWith('M') ? 'bg-purple-100 text-purple-700' : 'bg-black/5 opacity-60'}`}>{p.contract}</span>
                        <span className="font-mono text-sm w-10 text-right shrink-0">${p.salary}</span>
                        <ChevronDown size={14} className={`opacity-30 shrink-0 transition-transform ${selectedPlayer?.id === p.id ? 'rotate-180' : ''}`} />
                      </button>
                    );
                  })}
                </div>
              )
            ))}
          </div>

          {/* Analysis panel */}
          <div className="lg:w-80 shrink-0">
            {selectedPlayer ? (
              <PlayerAnalysisPanel player={selectedPlayer} />
            ) : (
              <TeamOverviewPanel
                activeSalary={activeSalary}
                faabBudget={faabBudget}
                keeperEligible={keeperEligible}
                totalKeeperCost={totalKeeperCost}
                remainingAuctionBudget={remainingAuctionBudget}
                categoryStandings={categoryStandings}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Keepers section ── */}
      {section === 'keepers' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1">Keeper Slots Used</p>
              <p className="font-mono text-3xl font-bold">{keeperEligible.filter(p=>!p.isMinor).length}<span className="text-sm opacity-40 font-sans font-normal"> / 8</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1">Total Keeper Cost</p>
              <p className="font-mono text-3xl font-bold">${totalKeeperCost}</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${remainingAuctionBudget < 50 ? 'bg-red-50 border-red-200' : 'bg-white border-black/5'}`}>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1">Remaining to Draft</p>
              <p className={`font-mono text-3xl font-bold ${remainingAuctionBudget < 50 ? 'text-red-600' : ''}`}>${remainingAuctionBudget}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-black/5">
              <h3 className="font-serif italic text-xl">Keeper Decisions</h3>
              <p className="text-xs opacity-50 mt-0.5">Salary escalates each year kept. Max 8 keepers + up to 2 franchise players.</p>
            </div>
            <div className="grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr_0.8fr_1fr] gap-2 px-6 py-2 bg-[#F8F8F8] border-b border-black/10 text-[10px] font-bold uppercase tracking-widest opacity-50">
              <span>Player</span><span>Now</span><span>Next Yr</span><span>Contract</span><span>Yrs Left</span><span>Verdict</span>
            </div>
            {keeperEligible.filter(p => !p.isMinor).map(p => {
              const projValue = KEEPER_PROJECTIONS[p.name] ?? p.salary;
              const nextCost  = keeperNextSalary(p.salary, p.contract);
              const discount  = projValue - nextCost;
              const yearsLeft = keeperYearsLeft(p.contract);
              const verdict   = p.contract === 'F' ? { label: 'Franchise', cls: 'bg-yellow-100 text-yellow-800' }
                              : p.contract === 'N'  ? { label: 'Keep Option', cls: 'bg-blue-100 text-blue-700' }
                              : p.contract === 'K3' ? { label: yearsLeft === 0 ? 'Must Decide' : 'Keep', cls: 'bg-orange-100 text-orange-700' }
                              : discount > 12 ? { label: 'Strong Keep', cls: 'bg-green-100 text-green-700' }
                              : discount > 4  ? { label: 'Keep', cls: 'bg-emerald-100 text-emerald-700' }
                              : discount > -4 ? { label: 'Monitor', cls: 'bg-yellow-100 text-yellow-700' }
                              :                 { label: 'Consider Cut', cls: 'bg-red-100 text-red-700' };
              return (
                <div key={p.id} className="grid grid-cols-[1.5fr_0.6fr_0.7fr_0.8fr_0.8fr_1fr] gap-2 px-6 py-3 border-b border-black/5 last:border-0 items-center hover:bg-[#F8F8F8] transition-colors">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-[10px] opacity-40">{p.pos.join('/')} · {p.team}</p>
                  </div>
                  <span className="font-mono text-sm">${p.salary}</span>
                  <span className={`font-mono text-sm font-bold ${discount > 0 ? 'text-green-600' : 'text-red-500'}`}>${nextCost}</span>
                  <span className="text-xs">{keeperContractNext(p.contract)}</span>
                  <span className="text-xs opacity-60">{yearsLeft === 99 ? 'Indefinite' : yearsLeft === 0 ? 'Last year' : `${yearsLeft} more`}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${verdict.cls}`}>{verdict.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs opacity-40 italic">*Keeper costs deducted from $260 auction cap. Salary escalation: $1–9 → +$1, $10–19 → +$2, $20–29 → +$3, $30–39 → +$4, etc.</p>
        </div>
      )}

      {/* ── Add / Drop section ── */}
      {section === 'adddrop' && (
        <AddDropPanel
          faabBudget={faabBudget}
          onBudgetChange={onBudgetChange}
          roster={roster}
          freeAgents={freeAgents}
          leagueRoster={leagueRoster}
          categoryStandings={categoryStandings}
          transactions={transactions}
          dataTimestamps={dataTimestamps}
          faabBidLog={faabBidLog}
          onSaveFaabBid={onSaveFaabBid}
          onUpdateFaabBid={onUpdateFaabBid}
          onDeleteFaabBid={onDeleteFaabBid}
        />
      )}

      {/* ── Minors section ── */}
      {section === 'minors' && (
        <MinorsPanel minors={minorPlayers} />
      )}
    </motion.div>
  );
}

// ─── Team Overview Panel ──────────────────────────────────────────────────────
function TeamOverviewPanel({
  activeSalary, faabBudget, keeperEligible, totalKeeperCost, remainingAuctionBudget, categoryStandings,
}: {
  activeSalary: number; faabBudget: number;
  keeperEligible: Player[]; totalKeeperCost: number; remainingAuctionBudget: number;
  categoryStandings: LiveCategoryStanding[] | null;
}) {
  const LUXURY_TAX = 400;
  const taxPct = Math.min(100, (activeSalary / LUXURY_TAX) * 100);

  return (
    <div className="bg-[#141414] text-white rounded-2xl p-6 flex flex-col gap-5 sticky top-4">
      <div>
        <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Team Overview</p>
        <p className="text-xs opacity-40">Click any player for analysis</p>
      </div>

      {/* Luxury tax bar */}
      <div>
        <div className="flex justify-between text-[10px] opacity-50 mb-1">
          <span>Salary</span><span>${activeSalary} / $400 luxury tax</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${activeSalary > LUXURY_TAX ? 'bg-red-400' : activeSalary > 350 ? 'bg-yellow-400' : 'bg-[#F27D26]'}`} style={{ width: `${taxPct}%` }} />
        </div>
        {activeSalary > LUXURY_TAX && (
          <p className="text-[10px] text-red-400 mt-1">⚠ ${activeSalary - LUXURY_TAX} over luxury tax</p>
        )}
      </div>

      {/* FAAB bar */}
      <div>
        <div className="flex justify-between text-[10px] opacity-50 mb-1">
          <span>FAAB</span><span>${faabBudget} remaining</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#F27D26] rounded-full" style={{ width: `${(faabBudget / 120) * 100}%` }} />
        </div>
      </div>

      {/* Keeper summary */}
      <div className="pt-4 border-t border-white/10">
        <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Keeper Status</p>
        <div className="flex justify-between text-sm mb-1">
          <span className="opacity-70">Slots used</span>
          <span className="font-mono">{keeperEligible.filter(p=>!p.isMinor).length} / 8</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="opacity-70">Total keeper cost</span>
          <span className="font-mono">${totalKeeperCost}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="opacity-70">Left to draft</span>
          <span className={`font-mono font-bold ${remainingAuctionBudget < 50 ? 'text-red-400' : 'text-green-400'}`}>${remainingAuctionBudget}</span>
        </div>
      </div>

      {/* Category outlook */}
      {categoryStandings && categoryStandings.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Category Ranks</p>
          <div className="grid grid-cols-5 gap-1">
            {categoryStandings.map(c => (
              <div key={c.category} className="text-center">
                <p className="text-[10px] opacity-40">{c.category}</p>
                <p className={`text-xs font-mono font-bold ${c.myRank <= 3 ? 'text-green-400' : c.myRank <= 6 ? 'text-yellow-400' : 'text-red-400'}`}>#{c.myRank}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Player Analysis Panel ────────────────────────────────────────────────────
function PlayerAnalysisPanel({ player }: { player: Player }) {
  const projValue = KEEPER_PROJECTIONS[player.name] ?? null;
  const nextCost  = keeperNextSalary(player.salary, player.contract);
  const isKeeper  = player.contract.match(/^(N|K[123]|M[123]?|F)$/);
  const discount  = projValue != null ? projValue - nextCost : null;

  const verdict = !isKeeper ? null
    : player.contract === 'N' ? (
        discount != null && discount > 0
          ? { label: 'Keep Option', cls: 'bg-blue-100 text-blue-700', detail: `If kept → K1 at $${nextCost}. $${discount} discount vs projected $${projValue}.` }
          : { label: 'Keep Option', cls: 'bg-blue-100 text-blue-700', detail: `If kept → K1 at $${nextCost}. Evaluate vs re-auction cost.` }
      )
    : player.contract === 'F' ? { label: 'Franchise', cls: 'bg-yellow-100 text-yellow-800', detail: 'Franchised — keep indefinitely at escalating cost.' }
    : player.isMinor ? { label: 'Keep in Minors', cls: 'bg-purple-100 text-purple-700', detail: 'No cost while in minors system. Call up at $5.' }
    : discount != null && discount > 12 ? { label: 'Strong Keep', cls: 'bg-green-100 text-green-700', detail: `$${discount} discount vs projected value.` }
    : discount != null && discount > 4  ? { label: 'Keep', cls: 'bg-emerald-100 text-emerald-700', detail: `$${discount} discount — solid value.` }
    : discount != null && discount > -4 ? { label: 'Monitor', cls: 'bg-yellow-100 text-yellow-700', detail: 'Near market price. Re-evaluate closer to keeper deadline.' }
    : { label: 'Consider Cut', cls: 'bg-red-100 text-red-700', detail: `Projected at $${projValue ?? '?'}, costs $${nextCost} to keep.` };

  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden sticky top-4">
      <div className="bg-[#141414] text-white p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-serif italic text-xl leading-tight">{player.name}</p>
            <p className="text-xs opacity-50 mt-0.5">{player.pos.join(' / ')} · {player.team}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1 ${player.contract.startsWith('K') || player.contract === 'F' ? 'bg-[#F27D26]/20 text-[#F27D26]' : player.contract.startsWith('M') ? 'bg-purple-500/20 text-purple-300' : 'bg-white/10 text-white/50'}`}>{player.contract}</span>
        </div>
        <p className="font-mono text-3xl font-bold">${player.salary}</p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {verdict && (
          <div className={`rounded-xl p-3 ${verdict.cls}`}>
            <p className="text-xs font-bold mb-0.5">{verdict.label}</p>
            <p className="text-[11px] opacity-80">{verdict.detail}</p>
          </div>
        )}

        {isKeeper && !player.isMinor && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm border-b border-black/5 pb-2">
              <span className="opacity-60">Current salary</span>
              <span className="font-mono">${player.salary}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-black/5 pb-2">
              <span className="opacity-60">{player.contract === 'N' ? 'Keep cost (K1)' : 'Next year cost'}</span>
              <span className="font-mono font-bold">${nextCost}</span>
            </div>
            {projValue != null && (
              <div className="flex justify-between text-sm border-b border-black/5 pb-2">
                <span className="opacity-60">Projected value</span>
                <span className="font-mono">${projValue}</span>
              </div>
            )}
            {discount != null && (
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Discount</span>
                <span className={`font-mono font-bold ${discount > 0 ? 'text-green-600' : 'text-red-500'}`}>{discount > 0 ? '+' : ''}{discount > 0 ? `$${discount}` : `-$${Math.abs(discount)}`}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-2 border-t border-black/5">
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Next contract</span>
            <span className="text-xs">{keeperContractNext(player.contract)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Years remaining</span>
            <span className="text-xs">{keeperYearsLeft(player.contract) === 99 ? 'Indefinite' : keeperYearsLeft(player.contract) === 0 ? 'Last year — decide now' : `${keeperYearsLeft(player.contract)} more`}</span>
          </div>
        </div>

        {player.notes && (
          <div className="bg-[#F8F8F8] rounded-lg p-3">
            <p className="text-[11px] opacity-60 leading-relaxed">{player.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add/Drop Panel ───────────────────────────────────────────────────────────

function inferPositionLabel(pos: string[]): string {
  if (pos.includes('SP')) return 'SP';
  if (pos.includes('RP') || pos.includes('P')) return 'RP';
  if (pos.includes('C')) return 'C';
  if (pos.includes('SS') || pos.includes('2B') || pos.includes('MI')) return 'MI';
  if (pos.includes('OF')) return 'OF';
  if (pos.includes('1B') || pos.includes('3B') || pos.includes('CI') || pos.includes('DH')) return 'CI';
  return pos[0] || '?';
}

// Look up historical bids for a player from the transaction log
function findLeagueBids(name: string, transactions: TransactionEntry[] | null): { team: string; amount: number; date: string }[] {
  if (!transactions) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const results: { team: string; amount: number; date: string }[] = [];
  for (const tx of transactions) {
    if (norm(tx.player).includes(norm(name)) || norm(name).includes(norm(tx.player))) {
      const bidMatch = tx.action.match(/signed for \$?([\d.]+)/i);
      if (bidMatch) {
        results.push({ team: tx.team, amount: parseFloat(bidMatch[1]), date: tx.date });
      }
    }
  }
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4);
}

// Suggest bid based on position type, league market data, and category urgency
function suggestBid(
  pos: string[],
  historicalBids: { amount: number }[],
  weakCats: string[],
  faabBudget: number
): { bid: number; reasoning: string } {
  const urgencyBoost = weakCats.length >= 3 ? 2 : weakCats.length >= 1 ? 1 : 0;

  // If we have league history, base on that
  if (historicalBids.length > 0) {
    const maxPrior = Math.max(...historicalBids.map(b => b.amount));
    const suggested = Math.max(maxPrior + 1 + urgencyBoost, 1);
    const final = Math.min(suggested, faabBudget - 1);
    const reasoning = urgencyBoost > 0
      ? `Prior high bid $${maxPrior} + $${urgencyBoost} urgency (${weakCats[0]} weak)`
      : `Prior high bid in this league was $${maxPrior}`;
    return { bid: final, reasoning };
  }

  // No history — conservative baseline. Don't inflate unknowns.
  // Most players with no bid history are fringe/speculative adds; $1-2 is appropriate.
  const isSP = pos.includes('SP');
  const isRP = pos.includes('RP') || pos.includes('P');
  const base = isSP ? 2 : isRP ? 1 : 1;
  // Urgency only adds $1 max when there's no history — not worth overpaying an unknown
  const urgencyAdd = weakCats.length >= 3 ? 1 : 0;
  const bid = Math.min(base + urgencyAdd, faabBudget - 1);
  const reasoning = urgencyAdd > 0
    ? `No prior bids found · $${base} baseline + $${urgencyAdd} for ${weakCats[0]} need`
    : 'No prior bids found · conservative baseline for unproven adds';
  return { bid, reasoning };
}

const BID_STATUS_LABELS: Record<FaabBidEntry['status'], string> = {
  exploring: 'Exploring', placed: 'Placed', accepted: 'Won', failed: 'Lost',
};
const BID_STATUS_COLORS: Record<FaabBidEntry['status'], string> = {
  exploring: 'bg-gray-100 text-gray-600',
  placed:    'bg-yellow-100 text-yellow-700',
  accepted:  'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-600',
};

function AddDropPanel({
  faabBudget, onBudgetChange, roster, freeAgents, leagueRoster, categoryStandings, transactions, dataTimestamps,
  faabBidLog, onSaveFaabBid, onUpdateFaabBid, onDeleteFaabBid,
}: {
  faabBudget: number; onBudgetChange: (n: number) => void;
  roster: Player[]; freeAgents: LeaguePlayer[];
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  categoryStandings: LiveCategoryStanding[] | null;
  transactions: TransactionEntry[] | null;
  dataTimestamps: Record<string, string>;
  faabBidLog: FaabBidEntry[];
  onSaveFaabBid: (entry: FaabBidEntry) => void;
  onUpdateFaabBid: (id: string, patch: Partial<FaabBidEntry>) => void;
  onDeleteFaabBid: (id: string) => void;
}) {
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<LeaguePlayer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogForm, setShowLogForm]   = useState(false);
  const [logBidAmt, setLogBidAmt]       = useState('');
  const [logStatus, setLogStatus]       = useState<FaabBidEntry['status']>('exploring');
  const [logNotes, setLogNotes]         = useState('');
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editPatch, setEditPatch]       = useState<Partial<FaabBidEntry>>({});

  const available = freeAgents.length > 0 ? freeAgents : [];
  const hasFAList = freeAgents.length > 0;
  const hasTxns   = !!transactions && transactions.length > 0;

  const filtered = search.length >= 2
    ? available.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const handleSelect = (p: LeaguePlayer) => {
    setSelected(p);
    setSearch(p.name);
    setShowDropdown(false);
    setShowLogForm(false);
  };

  const weakCats = categoryStandings
    ? categoryStandings.filter(c => c.myRank > 8).map(c => c.category)
    : [];

  const historicalBids = selected ? findLeagueBids(selected.name, transactions) : [];
  const { bid, reasoning } = selected
    ? suggestBid(selected.pos, historicalBids, weakCats, faabBudget)
    : { bid: 0, reasoning: '' };

  const openLogForm = () => {
    setLogBidAmt(String(bid));
    setLogStatus('exploring');
    setLogNotes('');
    setShowLogForm(true);
  };

  const saveLog = () => {
    if (!selected) return;
    onSaveFaabBid({
      id: `faab-${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      player: selected.name,
      position: inferPositionLabel(selected.pos),
      bidAmount: Number(logBidAmt) || bid,
      status: logStatus,
      notes: logNotes,
    });
    setShowLogForm(false);
    setSelected(null);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
        <h3 className="font-serif italic text-xl mb-4">FAAB Bid Calculator</h3>

        {/* Player search */}
        <div className="relative mb-5">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null); setShowDropdown(true); setShowLogForm(false); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={hasFAList ? 'Search available players...' : 'Upload FA list in Data tab first'}
            className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F27D26]"
          />
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
              {filtered.map(p => (
                <button key={p.name} onMouseDown={() => handleSelect(p)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8F8F8] text-left">
                  <span className="text-[10px] font-bold bg-black/5 rounded px-1.5 py-0.5 shrink-0">{p.pos.join('/')}</span>
                  <span className="text-sm flex-1">{p.name}</span>
                  <span className="text-[10px] opacity-40">{p.mlbTeam}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bid result */}
        {selected ? (
          <>
            <div className="bg-[#141414] text-white rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-serif italic text-lg">{selected.name}</p>
                  <p className="text-[10px] opacity-50">{inferPositionLabel(selected.pos)} · {selected.mlbTeam}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase opacity-50 tracking-widest">Suggested Bid</p>
                  <p className="font-mono text-4xl font-bold text-[#F27D26]">${bid}</p>
                </div>
              </div>
              <p className="text-[10px] opacity-50 leading-relaxed">{reasoning}</p>
              {weakCats.length > 0 && (
                <p className="text-[10px] text-yellow-400 mt-1">Urgency: {weakCats.slice(0,3).join(', ')} weak</p>
              )}
            </div>

            {/* League bid history */}
            {historicalBids.length > 0 ? (
              <div className="bg-[#F8F8F8] rounded-xl p-4 mb-4">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-2">League Bid History</p>
                <div className="flex flex-col gap-1.5">
                  {historicalBids.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="opacity-60">{b.team}</span>
                      <div className="flex items-center gap-2">
                        <span className="opacity-40 text-[10px]">{b.date.split(' ')[0]}</span>
                        <span className="font-mono font-bold">${b.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs opacity-40 italic mb-4">
                {hasTxns ? `No prior bids found for ${selected.name} in transaction history.` : 'Load transaction log in Data tab for bid history.'}
              </p>
            )}

            {/* Log bid */}
            {!showLogForm ? (
              <button onClick={openLogForm} className="text-sm font-bold text-[#F27D26] hover:text-[#d96a1d] transition-colors">
                + Log this bid
              </button>
            ) : (
              <div className="border border-black/10 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Log Bid for {selected.name}</p>
                <div className="flex gap-3 items-center">
                  <label className="text-xs opacity-60 w-16 shrink-0">Amount</label>
                  <input
                    type="number"
                    value={logBidAmt}
                    onChange={e => setLogBidAmt(e.target.value)}
                    className="w-20 border border-black/10 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <label className="text-xs opacity-60 w-16 shrink-0">Status</label>
                  <select value={logStatus} onChange={e => setLogStatus(e.target.value as FaabBidEntry['status'])} className="border border-black/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#F27D26] bg-white">
                    <option value="exploring">Exploring</option>
                    <option value="placed">Placed</option>
                    <option value="accepted">Won</option>
                    <option value="failed">Lost</option>
                  </select>
                </div>
                <div className="flex gap-3 items-center">
                  <label className="text-xs opacity-60 w-16 shrink-0">Notes</label>
                  <input
                    type="text"
                    value={logNotes}
                    onChange={e => setLogNotes(e.target.value)}
                    placeholder="optional"
                    className="flex-1 border border-black/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#F27D26]"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowLogForm(false)} className="text-xs opacity-50 hover:opacity-80 px-3 py-1.5">Cancel</button>
                  <button onClick={saveLog} className="text-xs font-bold bg-[#F27D26] text-white rounded-lg px-4 py-1.5 hover:bg-[#d96a1d] transition-colors">Save</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-[#F8F8F8] rounded-xl p-6 text-center">
            <p className="text-sm opacity-40">Search for a player to see suggested bid and league history</p>
            {!hasTxns && <p className="text-[10px] opacity-30 mt-1">Upload transaction log in Data tab for accurate bid recommendations</p>}
          </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-black/5">
          <span className="text-[10px] opacity-50">FAAB Budget Remaining</span>
          <EditableSidebarValue value={faabBudget} onChange={onBudgetChange} prefix="$" />
        </div>
      </div>

      {/* Bid Log */}
      {faabBidLog.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
          <h3 className="font-serif italic text-xl mb-4">Bid History</h3>
          <div className="flex flex-col gap-2">
            {faabBidLog.map(entry => (
              <div key={entry.id}>
                {editingId === entry.id ? (
                  <div className="border border-[#F27D26]/30 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-sm font-bold flex-1">{entry.player}</span>
                      <select value={editPatch.status ?? entry.status} onChange={e => setEditPatch(p => ({ ...p, status: e.target.value as FaabBidEntry['status'] }))} className="border border-black/10 rounded px-2 py-0.5 text-xs bg-white focus:outline-none">
                        <option value="exploring">Exploring</option>
                        <option value="placed">Placed</option>
                        <option value="accepted">Won</option>
                        <option value="failed">Lost</option>
                      </select>
                      {(editPatch.status ?? entry.status) === 'failed' && (
                        <input type="number" placeholder="Winner paid $" value={editPatch.finalPrice ?? entry.finalPrice ?? ''} onChange={e => setEditPatch(p => ({ ...p, finalPrice: Number(e.target.value) }))} className="w-28 border border-black/10 rounded px-2 py-0.5 text-xs font-mono focus:outline-none" />
                      )}
                    </div>
                    <input type="text" value={editPatch.notes ?? entry.notes} onChange={e => setEditPatch(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" className="border border-black/10 rounded px-2 py-1 text-xs focus:outline-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingId(null); setEditPatch({}); }} className="text-xs opacity-50 hover:opacity-80 px-2 py-1">Cancel</button>
                      <button onClick={() => { onUpdateFaabBid(entry.id, editPatch); setEditingId(null); setEditPatch({}); }} className="text-xs font-bold bg-[#F27D26] text-white rounded px-3 py-1">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 py-2 border-b border-black/5 last:border-0 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{entry.player}</span>
                        <span className="text-[10px] opacity-40">{entry.position}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BID_STATUS_COLORS[entry.status]}`}>{BID_STATUS_LABELS[entry.status]}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs opacity-50">{entry.date}</span>
                        <span className="font-mono text-xs font-bold">${entry.bidAmount}</span>
                        {entry.status === 'failed' && entry.finalPrice && <span className="text-xs opacity-50">• winner: ${entry.finalPrice}</span>}
                        {entry.notes && <span className="text-xs opacity-40 italic">{entry.notes}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => { setEditingId(entry.id); setEditPatch({}); }} className="text-[10px] opacity-50 hover:opacity-100 px-2 py-1 rounded hover:bg-[#F8F8F8]">Edit</button>
                      <button onClick={() => onDeleteFaabBid(entry.id)} className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Minors Panel ─────────────────────────────────────────────────────────────
const PROSPECT_DATA: Record<string, { eta: string; level: string; grade: string; blurb: string; fg: string }> = {
  'Cade Horton':       { eta: '2026', level: 'MLB Ready', grade: 'A-', blurb: 'CHC SP. Top-10 prospect. Upper-90s heat, plus CB. Likely Day 1 starter.', fg: 'https://www.fangraphs.com/players/cade-horton/sa3131453/stats' },
  'Hagen Smith':       { eta: '2026', level: 'AA/MLB',    grade: 'B+', blurb: 'CHW SP. Elite prospect, aggressive promotion likely.', fg: 'https://www.fangraphs.com/players/hagen-smith/sa3131855/stats' },
  'Kyle Manzardo':     { eta: 'Now',  level: 'MLB',       grade: 'B',  blurb: 'CLE 1B. Called up — left-handed bat, solid power upside.', fg: 'https://www.fangraphs.com/players/kyle-manzardo/sa842044/stats' },
  'Brooks Lee':        { eta: '2026', level: 'AAA/MLB',   grade: 'B',  blurb: 'MIN SS. Switch-hitter, hit-tool driven. Near-MLB ready.', fg: 'https://www.fangraphs.com/players/brooks-lee/sa3131415/stats' },
  'Jett Williams':     { eta: '2027', level: 'AA',        grade: 'B',  blurb: 'MIL SS. Plus speed, developing power. Exciting ceiling.', fg: 'https://www.fangraphs.com/players/jett-williams/sa3131851/stats' },
  'Braden Montgomery': { eta: '2027', level: 'A+/AA',     grade: 'B-', blurb: 'CHW OF. 2024 1st-rounder. Raw power, high K-rate to work through.', fg: 'https://www.fangraphs.com/players/braden-montgomery/sa3131866/stats' },
};

function MinorsPanel({ minors }: { minors: Player[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">{minors.length} players in minor league system (max 8)</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {minors.map(p => {
          const data = PROSPECT_DATA[p.name];
          return (
            <div key={p.id} className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="bg-[#141414] text-white px-5 py-4 flex items-start justify-between">
                <div>
                  <p className="font-serif italic text-lg">{p.name}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{p.pos.join('/')} · {p.team} · {p.contract}</p>
                </div>
                {data && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full mt-1 ${
                    data.grade.startsWith('A') ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{data.grade}</span>
                )}
              </div>
              <div className="p-5 flex flex-col gap-3">
                {data ? (
                  <>
                    <div className="flex gap-4 text-xs">
                      <div><span className="opacity-50">Level </span><span className="font-medium">{data.level}</span></div>
                      <div><span className="opacity-50">ETA </span><span className="font-medium">{data.eta}</span></div>
                      <div><span className="opacity-50">Call-up cost </span><span className="font-mono font-bold">${p.salary === 0 ? 5 : p.salary}</span></div>
                    </div>
                    <p className="text-xs opacity-70 leading-relaxed">{data.blurb}</p>
                    <a
                      href={data.fg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#F27D26] hover:text-[#d96a1d] transition-colors"
                    >
                      <ExternalLink size={11} /> View on FanGraphs
                    </a>
                  </>
                ) : (
                  <p className="text-xs opacity-40">No prospect data on file.</p>
                )}
              </div>
            </div>
          );
        })}
        {minors.length === 0 && (
          <div className="col-span-2 bg-white rounded-2xl border border-black/5 p-8 text-center">
            <p className="text-sm opacity-40">No players in minor league system</p>
          </div>
        )}
      </div>
      <p className="text-[10px] opacity-30 italic">*Prospect grades and blurbs are manually maintained. Click FanGraphs links for current stats.</p>
    </div>
  );
}

// ─── FAAB / Waivers ───────────────────────────────────────────────────────────

function EditableSidebarValue({
  value,
  onChange,
  prefix = '',
}: {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft, 10);
          if (!isNaN(n) && n >= 0) onChange(n);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-16 font-mono text-lg bg-transparent border-b border-white/40 outline-none text-right"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="Click to edit"
      className="font-mono text-lg hover:text-[#F27D26] transition-colors"
    >
      {prefix}{value}
    </button>
  );
}

// ─── Trade Analyzer ───────────────────────────────────────────────────────────
// Stat profiles used to estimate each player's SGP contribution.
// Keys are player names; values are partial category contributions per season.
const PLAYER_SGP_PROFILES: Record<string, Partial<Record<string, number>>> = {
  'Freddie Freeman':        { HR: 22, R: 90, RBI: 95, SB: 5,  OBP: 0.384 },
  'Randy Arozarena':        { HR: 18, R: 78, RBI: 72, SB: 22, OBP: 0.335 },
  'Jarren Duran':           { HR: 16, R: 85, RBI: 68, SB: 28, OBP: 0.350 },
  'CJ Abrams':              { HR: 14, R: 82, RBI: 58, SB: 40, OBP: 0.330 },
  'Willy Adames':           { HR: 22, R: 70, RBI: 80, SB: 6,  OBP: 0.328 },
  'Kazuma Okamoto':         { HR: 28, R: 68, RBI: 85, SB: 2,  OBP: 0.330 },
  'Xavier Edwards':         { HR: 2,  R: 72, RBI: 40, SB: 42, OBP: 0.352 },
  'Garrett Crochet':        { ERA: 3.20, WHIP: 1.10, K: 220, INN: 185, S: 0 },
  'Kevin Gausman':          { ERA: 3.55, WHIP: 1.15, K: 185, INN: 165, S: 0 },
  'Raisel Iglesias':        { ERA: 2.90, WHIP: 1.05, K: 70,  INN: 65,  S: 28 },
  'Daniel Palencia':        { ERA: 3.10, WHIP: 1.12, K: 68,  INN: 62,  S: 28 },
  'Bryan Abreu':            { ERA: 3.40, WHIP: 1.18, K: 65,  INN: 58,  S: 12 },
  'Adolis Garcia':          { HR: 24, R: 72, RBI: 80, SB: 8,  OBP: 0.312 },
  'Josh Naylor':            { HR: 22, R: 68, RBI: 82, SB: 2,  OBP: 0.338 },
  'Byron Buxton':           { HR: 22, R: 70, RBI: 70, SB: 12, OBP: 0.318 },
  'Pete Crow-Armstrong':    { HR: 18, R: 78, RBI: 68, SB: 18, OBP: 0.330 },
  'Colton Cowser':          { HR: 16, R: 70, RBI: 62, SB: 8,  OBP: 0.328 },
  'Ranger Suarez':          { ERA: 3.70, WHIP: 1.22, K: 155, INN: 165, S: 0 },
  'Matthew Boyd':           { ERA: 3.90, WHIP: 1.25, K: 160, INN: 160, S: 0 },
  'Kodai Senga':            { ERA: 3.60, WHIP: 1.15, K: 175, INN: 160, S: 0 },
};

const BATTING_CATS  = ['HR', 'OBP', 'R', 'RBI', 'SB'];
const PITCHING_CATS = ['ERA', 'INN', 'K', 'S', 'WHIP'];
const LOWER_IS_BETTER = ['ERA', 'WHIP'];

function sgpDelta(
  giving: string[],
  getting: string[],
  categoryStandings: LiveCategoryStanding[] | null
): { cat: string; delta: number; context: string }[] {
  const cats = [...BATTING_CATS, ...PITCHING_CATS];
  return cats.map(cat => {
    const denom = SGP_DENOMINATORS.find(s => s.cat === cat)?.denom;
    if (!denom) return null;

    const outVal = giving.reduce((s, p) => s + (PLAYER_SGP_PROFILES[p]?.[cat] ?? 0), 0);
    const inVal  = getting.reduce((s, p) => s + (PLAYER_SGP_PROFILES[p]?.[cat] ?? 0), 0);
    const rawDiff = inVal - outVal;
    const sgp = LOWER_IS_BETTER.includes(cat) ? -(rawDiff / denom) : rawDiff / denom;

    if (Math.abs(sgp) < 0.05) return null;

    // Weight delta by how much you need this category (live standings context)
    const standing = categoryStandings?.find(c => c.category === cat);
    const urgency = standing && standing.myRank > 6
      ? 'Need'
      : standing && standing.myRank <= 3
      ? 'Strong'
      : 'OK';

    return { cat, delta: sgp, context: urgency };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
}

type PickSlot = { year: number; round: number };

function pickLabel(p: PickSlot) {
  return `${p.year} R${p.round}`;
}

function allPicksForTeam(abbrev: string): PickSlot[] {
  const teamData = MINOR_LEAGUE_PICKS[abbrev];
  if (!teamData) return [];
  const out: PickSlot[] = [];
  for (const [yr, counts] of Object.entries(teamData)) {
    const year = Number(yr);
    counts.forEach((count, idx) => {
      for (let i = 0; i < count; i++) out.push({ year, round: idx + 1 });
    });
  }
  return out.sort((a, b) => a.year - b.year || a.round - b.round);
}

// Remove one instance of a matching pick from an array
function removePick(arr: PickSlot[], pick: PickSlot): PickSlot[] {
  const idx = arr.findIndex(p => p.year === pick.year && p.round === pick.round);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

// Count remaining available picks (total - selected)
function availablePicks(abbrev: string, selected: PickSlot[]): PickSlot[] {
  let pool = allPicksForTeam(abbrev);
  for (const s of selected) pool = removePick(pool, s);
  return pool;
}

const TRADE_STATUS_LABELS: Record<TradeLogEntry['status'], string> = {
  exploring: 'Exploring', offered: 'Offered', received: 'Received', accepted: 'Accepted', declined: 'Declined',
};
const TRADE_STATUS_COLORS: Record<TradeLogEntry['status'], string> = {
  exploring: 'bg-gray-100 text-gray-600',
  offered:   'bg-yellow-100 text-yellow-700',
  received:  'bg-blue-100 text-blue-700',
  accepted:  'bg-green-100 text-green-700',
  declined:  'bg-red-100 text-red-600',
};

function TradesView({
  roster, categoryStandings, leagueRoster,
  tradeLog, onSaveTrade, onUpdateTrade, onDeleteTrade,
}: {
  roster: Player[];
  categoryStandings: LiveCategoryStanding[] | null;
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  tradeLog: TradeLogEntry[];
  onSaveTrade: (entry: TradeLogEntry) => void;
  onUpdateTrade: (id: string, patch: Partial<TradeLogEntry>) => void;
  onDeleteTrade: (id: string) => void;
  key?: any;
}) {
  const ALL_TEAMS = Object.keys(ABBREV_TO_FULLNAME).sort();
  const [team1, setTeam1] = useState('EYJ');
  const [team2, setTeam2] = useState('');
  const [showSaveForm, setShowSaveForm]   = useState(false);
  const [saveStatus, setSaveStatus]       = useState<TradeLogEntry['status']>('exploring');
  const [saveNotes, setSaveNotes]         = useState('');
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editTradePatch, setEditTradePatch] = useState<Partial<TradeLogEntry>>({});
  const [t1Players, setT1Players] = useState<Set<string>>(new Set());
  const [t2Players, setT2Players] = useState<Set<string>>(new Set());
  const [t1Picks,   setT1Picks]   = useState<PickSlot[]>([]);
  const [t2Picks,   setT2Picks]   = useState<PickSlot[]>([]);
  const [filter1, setFilter1] = useState('');
  const [filter2, setFilter2] = useState('');

  // Clear selections when teams change
  const switchTeam1 = (abbrev: string) => { setTeam1(abbrev); setT1Players(new Set()); setT1Picks([]); setFilter1(''); };
  const switchTeam2 = (abbrev: string) => { setTeam2(abbrev); setT2Players(new Set()); setT2Picks([]); setFilter2(''); };

  const getPlayers = (abbrev: string): LeaguePlayer[] => {
    if (!abbrev) return [];
    if (leagueRoster?.[abbrev]) return leagueRoster[abbrev];
    if (abbrev === 'EYJ') return roster.map(p => ({
      name: p.name, pos: p.pos, mlbTeam: p.team, salary: p.salary, contract: p.contract,
      status: (p.isMinor ? 'minor' : p.isReserve ? 'reserve' : 'active') as LeaguePlayer['status'],
    }));
    return [];
  };

  const toggle = (set: Set<string>, name: string): Set<string> => {
    const next = new Set(set);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  };

  const t1List = getPlayers(team1);
  const t2List = getPlayers(team2);
  const t1Filtered = t1List.filter(p => p.name.toLowerCase().includes(filter1.toLowerCase()));
  const t2Filtered = t2List.filter(p => p.name.toLowerCase().includes(filter2.toLowerCase()));

  const t1SelPlayers = t1List.filter(p => t1Players.has(p.name));
  const t2SelPlayers = t2List.filter(p => t2Players.has(p.name));

  const hasAnything = t1Players.size > 0 || t2Players.size > 0 || t1Picks.length > 0 || t2Picks.length > 0;
  const hasBothSides = (t1Players.size > 0 || t1Picks.length > 0) && (t2Players.size > 0 || t2Picks.length > 0);

  const t1SalaryOut = t1SelPlayers.reduce((s, p) => s + p.salary, 0);
  const t2SalaryIn  = t2SelPlayers.reduce((s, p) => s + p.salary, 0);
  const salaryNet   = t2SalaryIn - t1SalaryOut;

  const giving  = t1SelPlayers.map(p => p.name);
  const getting = t2SelPlayers.map(p => p.name);
  const deltas  = hasBothSides ? sgpDelta(giving, getting, categoryStandings) : [];
  const netSGP  = deltas.reduce((s, d) => s + d.delta, 0);
  const gains   = deltas.filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta);
  const losses  = deltas.filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta);
  const hasSGP  = deltas.length > 0;

  const verdict = !hasBothSides ? null
    : netSGP >  0.8 ? { label: 'Strong Accept', cls: 'bg-green-100 text-green-800' }
    : netSGP >  0.2 ? { label: 'Slight Win',    cls: 'bg-emerald-100 text-emerald-700' }
    : netSGP > -0.2 ? { label: 'Roughly Fair',  cls: 'bg-yellow-100 text-yellow-800' }
    : netSGP > -0.8 ? { label: 'Slight Loss',   cls: 'bg-orange-100 text-orange-700' }
    :                 { label: 'Pass',           cls: 'bg-red-100 text-red-700' };

  const statusColor = (s: LeaguePlayer['status']) =>
    s === 'minor' ? 'text-purple-500' : s === 'injured' ? 'text-red-400' : s === 'reserve' ? 'text-yellow-500' : '';

  const PlayerPanel = ({
    abbrev, players, filtered, selected, onToggle, filter, onFilter, picks, onAddPick, onRemovePick,
  }: {
    abbrev: string; players: LeaguePlayer[]; filtered: LeaguePlayer[]; selected: Set<string>;
    onToggle: (name: string) => void; filter: string; onFilter: (v: string) => void;
    picks: PickSlot[]; onAddPick: (p: PickSlot) => void; onRemovePick: (p: PickSlot) => void;
  }) => {
    const avail = availablePicks(abbrev, picks);
    const grouped = filtered.reduce((acc, p) => {
      const k = p.status === 'active' ? 'Active' : p.status === 'reserve' ? 'Reserve' : p.status === 'injured' ? 'Injured' : 'Minors';
      (acc[k] = acc[k] || []).push(p);
      return acc;
    }, {} as Record<string, LeaguePlayer[]>);

    return (
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {players.length === 0 && abbrev && (
          <p className="text-xs opacity-40 italic">No roster data — upload league roster CSV in Strategy Lab.</p>
        )}
        {players.length > 0 && (
          <>
            <input
              value={filter}
              onChange={e => onFilter(e.target.value)}
              placeholder="Search players..."
              className="text-sm border border-black/10 rounded-lg px-3 py-2 bg-[#F8F8F8] focus:outline-none focus:border-[#F27D26] w-full"
            />
            <div className="max-h-72 overflow-y-auto flex flex-col gap-1 pr-1">
              {(['Active','Reserve','Injured','Minors'] as const).map(grp => {
                const grpPlayers = grouped[grp];
                if (!grpPlayers?.length) return null;
                return (
                  <div key={grp}>
                    <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold px-1 py-1 sticky top-0 bg-white">{grp}</p>
                    {grpPlayers.map(p => (
                      <label key={p.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8F8F8] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.has(p.name)}
                          onChange={() => onToggle(p.name)}
                          className="accent-[#F27D26] shrink-0"
                        />
                        <span className={`text-sm flex-1 ${selected.has(p.name) ? 'font-bold' : ''}`}>{p.name}</span>
                        <span className={`text-[10px] font-mono shrink-0 ${statusColor(p.status)}`}>
                          {p.contract !== 'N' ? p.contract : ''} ${p.salary}
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pick selection */}
        {abbrev && (
          <div>
            <p className="text-[9px] uppercase tracking-widest opacity-40 font-bold mb-1.5">Draft Picks</p>
            {picks.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {picks.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onRemovePick(p)}
                    className="text-[10px] font-bold px-2 py-0.5 bg-[#F27D26] text-white rounded-full flex items-center gap-1"
                  >
                    {pickLabel(p)} <X size={10} />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {avail.length === 0 && picks.length === 0 && (
                <span className="text-[10px] opacity-30 italic">No picks available</span>
              )}
              {avail.filter((p, i, arr) =>
                arr.findIndex(q => q.year === p.year && q.round === p.round) === i
              ).map((p, i) => {
                const cnt = avail.filter(q => q.year === p.year && q.round === p.round).length;
                return (
                  <button
                    key={i}
                    onClick={() => onAddPick(p)}
                    className="text-[10px] font-bold px-2 py-0.5 border border-black/20 rounded-full hover:border-[#F27D26] hover:text-[#F27D26] transition-colors"
                  >
                    {pickLabel(p)}{cnt > 1 ? ` ×${cnt}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header>
        <h2 className="text-4xl font-serif italic mb-2">Trade Analyzer</h2>
        <p className="text-sm opacity-60">Select teams · check players · add picks · get verdict</p>
      </header>

      {!leagueRoster && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3 text-sm text-yellow-800">
          Upload the "League Roster (All Teams)" CSV in Strategy Lab to see all teams' players. EYJ roster is available now.
        </div>
      )}

      {/* Two-panel builder */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Team 1 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-black/5 flex flex-col gap-3">
          <select
            value={team1}
            onChange={e => switchTeam1(e.target.value)}
            className="text-sm font-bold border border-black/10 rounded-lg px-3 py-2 bg-[#F8F8F8] focus:outline-none focus:border-[#F27D26]"
          >
            {ALL_TEAMS.map(a => <option key={a} value={a}>{a} — {ABBREV_TO_FULLNAME[a]}</option>)}
          </select>
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Gives</p>
          <PlayerPanel
            abbrev={team1} players={t1List} filtered={t1Filtered} selected={t1Players}
            onToggle={n => setT1Players(toggle(t1Players, n))}
            filter={filter1} onFilter={setFilter1}
            picks={t1Picks}
            onAddPick={p => setT1Picks([...t1Picks, p])}
            onRemovePick={p => setT1Picks(removePick(t1Picks, p))}
          />
        </div>

        {/* Center arrow */}
        <div className="flex items-center justify-center pt-16">
          <ArrowLeftRight size={28} className="text-[#F27D26]" />
        </div>

        {/* Team 2 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-black/5 flex flex-col gap-3">
          <select
            value={team2}
            onChange={e => switchTeam2(e.target.value)}
            className="text-sm font-bold border border-black/10 rounded-lg px-3 py-2 bg-[#F8F8F8] focus:outline-none focus:border-[#F27D26]"
          >
            <option value="">— Select opponent —</option>
            {ALL_TEAMS.filter(a => a !== team1).map(a => <option key={a} value={a}>{a} — {ABBREV_TO_FULLNAME[a]}</option>)}
          </select>
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Gives</p>
          <PlayerPanel
            abbrev={team2} players={t2List} filtered={t2Filtered} selected={t2Players}
            onToggle={n => setT2Players(toggle(t2Players, n))}
            filter={filter2} onFilter={setFilter2}
            picks={t2Picks}
            onAddPick={p => setT2Picks([...t2Picks, p])}
            onRemovePick={p => setT2Picks(removePick(t2Picks, p))}
          />
        </div>
      </div>

      {/* Summary + Analysis */}
      {hasAnything && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trade summary */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5 flex flex-col gap-4">
            <h3 className="font-serif italic text-xl">Trade Summary</h3>
            {[
              { label: `${team1} gives`, players: t1SelPlayers, picks: t1Picks, salary: t1SalaryOut },
              { label: `${team2 || '?'} gives`, players: t2SelPlayers, picks: t2Picks, salary: t2SalaryIn },
            ].map(side => (
              <div key={side.label}>
                <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold mb-1">{side.label}</p>
                {side.players.map(p => (
                  <div key={p.name} className="flex justify-between text-sm py-0.5">
                    <span>{p.name}</span>
                    <span className="font-mono opacity-60">{p.contract !== 'N' ? `${p.contract} ` : ''}${p.salary}</span>
                  </div>
                ))}
                {side.picks.map((p, i) => (
                  <div key={i} className="text-sm py-0.5 opacity-70">{pickLabel(p)} pick</div>
                ))}
                {side.players.length === 0 && side.picks.length === 0 && (
                  <p className="text-xs opacity-30 italic">Nothing selected</p>
                )}
                {side.players.length > 0 && (
                  <div className="text-xs font-mono font-bold mt-1 opacity-60">Salary: ${side.salary}</div>
                )}
              </div>
            ))}
            <div className="pt-3 border-t border-black/5">
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Salary net (EYJ)</span>
                <span className={`font-mono font-bold ${salaryNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {salaryNet >= 0 ? '+' : ''}${salaryNet}
                </span>
              </div>
            </div>
          </div>

          {/* SGP breakdown */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
            <h3 className="font-serif italic text-xl mb-4">SGP Category Impact</h3>
            {!hasSGP ? (
              <p className="text-sm opacity-40 italic">SGP data available for EYJ players only. Select EYJ as Team 1 for full analysis.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {[...gains, ...losses].map(d => {
                  const pct = Math.min(Math.abs(d.delta) / 2, 1) * 100;
                  return (
                    <div key={d.cat} className="flex items-center gap-3">
                      <span className="w-12 text-xs font-bold opacity-60">{d.cat}</span>
                      <div className="flex-1 h-6 bg-[#F8F8F8] rounded-full overflow-hidden relative">
                        <div className={`h-full rounded-full ${d.delta > 0 ? 'bg-green-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                        <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-mono font-bold">
                          {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)} SGP
                        </span>
                      </div>
                      {d.context === 'Need' && <span className="text-[10px] text-red-500 font-bold uppercase w-12 shrink-0">Need</span>}
                      {d.context === 'Strong' && <span className="text-[10px] text-green-600 font-bold uppercase w-12 shrink-0">Strong</span>}
                    </div>
                  );
                })}
                <div className="mt-2 pt-3 border-t border-black/5 flex justify-between">
                  <span className="text-sm font-bold">Net SGP</span>
                  <span className={`font-mono text-lg font-bold ${netSGP > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {netSGP > 0 ? '+' : ''}{netSGP.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Verdict */}
          <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg flex flex-col gap-4">
            <h3 className="font-serif italic text-xl">Verdict</h3>
            {verdict ? (
              <span className={`text-sm font-bold px-4 py-2 rounded-full w-fit ${verdict.cls}`}>{verdict.label}</span>
            ) : (
              <p className="text-xs opacity-40 italic">Select players or picks on both sides for a verdict.</p>
            )}
            {t2SelPlayers.length > 0 && (
              <div>
                <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Incoming Contracts</p>
                {t2SelPlayers.map(p => (
                  <div key={p.name} className="text-sm mb-1 flex justify-between">
                    <span className="font-bold">{p.name}</span>
                    <span className="opacity-50 font-mono">{p.contract} ${p.salary}</span>
                  </div>
                ))}
              </div>
            )}
            {t2Picks.length > 0 && (
              <div>
                <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Incoming Picks</p>
                {t2Picks.map((p, i) => (
                  <div key={i} className="text-sm opacity-70">{pickLabel(p)}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save to log — shown when both sides have selections */}
      {hasAnything && (
        <div>
          {!showSaveForm ? (
            <button onClick={() => { setSaveStatus('exploring'); setSaveNotes(''); setShowSaveForm(true); }} className="text-sm font-bold text-[#F27D26] hover:text-[#d96a1d] transition-colors">
              + Save to trade log
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 flex flex-col gap-3">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Log This Scenario</p>
              <div className="flex gap-3 items-center flex-wrap">
                <label className="text-xs opacity-60 w-12 shrink-0">Status</label>
                <select value={saveStatus} onChange={e => setSaveStatus(e.target.value as TradeLogEntry['status'])} className="border border-black/10 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:border-[#F27D26]">
                  <option value="exploring">Exploring</option>
                  <option value="offered">Offered</option>
                  <option value="received">Received</option>
                  <option value="accepted">Accepted</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div className="flex gap-3 items-center">
                <label className="text-xs opacity-60 w-12 shrink-0">Notes</label>
                <input type="text" value={saveNotes} onChange={e => setSaveNotes(e.target.value)} placeholder="optional context..." className="flex-1 border border-black/10 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#F27D26]" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowSaveForm(false)} className="text-xs opacity-50 hover:opacity-80 px-3 py-1.5">Cancel</button>
                <button onClick={() => {
                  const givingNames = t1SelPlayers.map(p => p.name).concat(t1Picks.map(p => pickLabel(p)));
                  const receivingNames = t2SelPlayers.map(p => p.name).concat(t2Picks.map(p => pickLabel(p)));
                  onSaveTrade({
                    id: `trade-${Date.now()}`,
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    counterTeam: team2 || '?',
                    giving: givingNames,
                    receiving: receivingNames,
                    status: saveStatus,
                    notes: saveNotes,
                    salaryNet: salaryNet,
                  });
                  setShowSaveForm(false);
                }} className="text-xs font-bold bg-[#F27D26] text-white rounded-lg px-4 py-1.5 hover:bg-[#d96a1d] transition-colors">Save</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trade Log */}
      {tradeLog.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Trade Log</p>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-black/5">
            {tradeLog.map(entry => (
              <div key={entry.id} className="p-4">
                {editingTradeId === entry.id ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-sm font-bold flex-1">vs {entry.counterTeam}</span>
                      <select value={editTradePatch.status ?? entry.status} onChange={e => setEditTradePatch(p => ({ ...p, status: e.target.value as TradeLogEntry['status'] }))} className="border border-black/10 rounded px-2 py-0.5 text-xs bg-white focus:outline-none">
                        <option value="exploring">Exploring</option>
                        <option value="offered">Offered</option>
                        <option value="received">Received</option>
                        <option value="accepted">Accepted</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                    <input type="text" value={editTradePatch.notes ?? entry.notes} onChange={e => setEditTradePatch(p => ({ ...p, notes: e.target.value }))} placeholder="Notes" className="border border-black/10 rounded px-2 py-1 text-xs focus:outline-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingTradeId(null); setEditTradePatch({}); }} className="text-xs opacity-50 hover:opacity-80 px-2 py-1">Cancel</button>
                      <button onClick={() => { onUpdateTrade(entry.id, editTradePatch); setEditingTradeId(null); setEditTradePatch({}); }} className="text-xs font-bold bg-[#F27D26] text-white rounded px-3 py-1">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs opacity-40">{entry.date}</span>
                        <span className="text-sm font-bold">vs {entry.counterTeam}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TRADE_STATUS_COLORS[entry.status]}`}>{TRADE_STATUS_LABELS[entry.status]}</span>
                        {entry.salaryNet !== 0 && (
                          <span className={`text-[10px] font-mono font-bold ${entry.salaryNet > 0 ? 'text-orange-500' : 'text-green-600'}`}>{entry.salaryNet > 0 ? '+' : ''}${entry.salaryNet} salary</span>
                        )}
                      </div>
                      <p className="text-xs"><span className="opacity-40">Out:</span> {entry.giving.join(', ') || '—'}</p>
                      <p className="text-xs"><span className="opacity-40">In:</span> {entry.receiving.join(', ') || '—'}</p>
                      {entry.notes && <p className="text-[10px] opacity-40 italic mt-0.5">{entry.notes}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => { setEditingTradeId(entry.id); setEditTradePatch({}); }} className="text-[10px] opacity-50 hover:opacity-100 px-2 py-1 rounded hover:bg-[#F8F8F8]">Edit</button>
                      <button onClick={() => onDeleteTrade(entry.id)} className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface StagedFile {
  id: string;
  name: string;
  csvText: string;
  rawFile: File;
  detectedType: DataType;
  assignedType: DataType;
  rowCount: number;
  confidence: 'high' | 'low';
  detectedSeason: number | null; // parsed from filename, e.g. "FG Batting Dashboard 2025.csv" → 2025
}

const DATA_TYPES: Exclude<DataType, 'unknown'>[] = ['leagueroster', 'freeagents', 'roster', 'standings', 'transactions', 'faab', 'statcast', 'stuff', 'stats', 'projections', 'fg-bat', 'fg-pit'];
const TYPE_LABELS: Record<DataType, string> = {
  leagueroster: 'League Rosters (All Teams)',
  freeagents: 'Available Players (FA List)',
  roster: 'My Roster',
  standings: 'Standings',
  transactions: 'Transaction Log',
  faab: 'FAAB Bid Log',
  statcast: 'Statcast',
  stuff: 'Stuff+ / Pitching+',
  stats: 'CBS YTD Stats',
  projections: 'Steamer RoS Projections',
  'fg-bat': 'FG Batting Dashboard',
  'fg-pit': 'FG Pitching Advanced',
  unknown: '? Unknown',
};

function StrategyLabView({
  parsedRoster, parsedStatcast, parsedStuff, parsedStats, parsedProjections,
  parsedFGBat, parsedFGPit,
  freeAgents, categoryStandings, transactions, faabBudget,
}: {
  parsedRoster: Player[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  parsedStats: PlayerStat[] | null;
  parsedProjections: PlayerProjection[] | null;
  parsedFGBat: FGBatterSeason[];
  parsedFGPit: FGPitcherSeason[];
  freeAgents: LeaguePlayer[];
  categoryStandings: LiveCategoryStanding[] | null;
  transactions: TransactionEntry[] | null;
  faabBudget: number;
  key?: any;
}) {
  const effectiveRoster = parsedRoster && parsedRoster.length > 0 ? parsedRoster : INITIAL_ROSTER;
  const lastN = (name: string) => name.toLowerCase().split(' ').slice(-1)[0].replace(/[^a-z]/g, '');
  const nameMatch = (a: string, b: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
    return norm(a) === norm(b) || lastN(a) === lastN(b);
  };

  // ── Breakout Radar: FA players with strong underlying metrics ──
  const rosterNames = new Set(effectiveRoster.map(p => p.name.toLowerCase().replace(/[^a-z]/g, '')));
  const isOnRoster = (name: string) => rosterNames.has(name.toLowerCase().replace(/[^a-z]/g, ''));

  // Batters: anchor on xwOBA > .350, enrich with CBS stats and Steamer projections
  const radarBatters = (() => {
    // Collect candidate names from Statcast (quality of contact signal)
    const statcastCandidates = (parsedStatcast || [])
      .filter(d => (d.xwoba || 0) > 0.350 && !isOnRoster(d.name));

    return statcastCandidates.map(d => {
      const fa   = freeAgents.find(p => nameMatch(p.name, d.name));
      if (!fa) return null;
      const stat = parsedStats?.find(s => nameMatch(s.name, d.name) && !s.isPitcher);
      const proj = parsedProjections?.find(s => nameMatch(s.name, d.name) && !s.isPitcher);

      // Build context lines
      const context: string[] = [`xwOBA ${d.xwoba?.toFixed(3)}`];
      if (d.ev) context.push(`EV ${d.ev.toFixed(1)}`);
      if (stat?.avg) context.push(`AVG ${stat.avg.toFixed(3)}`);
      if (stat?.hr)  context.push(`${stat.hr} HR`);
      if (proj?.projHr) context.push(`proj ${proj.projHr} HR RoS`);
      if (proj?.projAvg) context.push(`proj .${Math.round(proj.projAvg * 1000)} AVG`);

      return {
        name: d.name,
        pos: fa.pos.join('/'),
        mlbTeam: fa.mlbTeam,
        stat: context[0],
        context: context.slice(1).join(' · '),
        score: d.xwoba || 0,
      };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score).slice(0, 5) as any[];
  })();

  // Pitchers: anchor on Stuff+ > 108, enrich with CBS stats and Steamer projections
  const radarPitchers = (() => {
    const stuffCandidates = (parsedStuff || [])
      .filter((d: any) => (d.stuffPlus || 0) > 108 && !isOnRoster(d.name));

    return stuffCandidates.map((d: any) => {
      const fa   = freeAgents.find(p => nameMatch(p.name, d.name));
      if (!fa) return null;
      const stat = parsedStats?.find(s => nameMatch(s.name, d.name) && s.isPitcher);
      const proj = parsedProjections?.find(s => nameMatch(s.name, d.name) && s.isPitcher);

      const context: string[] = [`Stuff+ ${d.stuffPlus}`];
      if (d.pitchingPlus) context.push(`Pitch+ ${d.pitchingPlus}`);
      if (stat?.era)  context.push(`ERA ${stat.era.toFixed(2)}`);
      if (stat?.ip)   context.push(`${Math.floor(stat.ip)} IP`);
      if (proj?.projEra) context.push(`proj ERA ${proj.projEra.toFixed(2)}`);
      if (proj?.projIp)  context.push(`proj ${proj.projIp} IP`);

      return {
        name: d.name,
        pos: fa.pos.join('/'),
        mlbTeam: fa.mlbTeam,
        stat: context[0],
        context: context.slice(1).join(' · '),
        score: d.stuffPlus || 0,
      };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score).slice(0, 5) as any[];
  })();

  const weakCatNames = categoryStandings?.filter(c => c.myRank > 8).map(c => c.category) ?? [];

  // ── Rotation Health: your SPs/RPs by Stuff+ ──
  const rotationHealth = effectiveRoster
    .filter(p => p.pos.some(x => ['SP','RP','P'].includes(x)) && !p.isMinor)
    .map(p => {
      const m = parsedStuff?.find(d => nameMatch(d.name, p.name));
      return { player: p, stuffPlus: m?.stuffPlus || null, pitchingPlus: m?.pitchingPlus || null };
    }).sort((a, b) => (b.stuffPlus || 0) - (a.stuffPlus || 0));

  // ── SGP gap analysis (from old Analytics) ──
  const [manualRanks, setManualRanks] = useState<Record<string, number>>(
    Object.fromEntries(CATEGORY_PROJECTIONS.map(p => [p.cat, 6]))
  );
  const TOTAL_TEAMS = 12;
  const sgpRows = CATEGORY_PROJECTIONS.map(proj => {
    const live  = categoryStandings?.find(c => c.category === proj.cat);
    const denom = SGP_DENOMINATORS.find(s => s.cat === proj.cat);
    const rank       = live ? live.myRank     : (manualRanks[proj.cat] ?? 6);
    const pts        = live ? live.myPts      : (TOTAL_TEAMS - rank + 1);
    const ptsToNext  = live ? live.ptsGapToNext  : (rank > 1 ? 1 : 0);
    return { cat: proj.cat, rank, pts, ptsToNext, denomCost: denom?.denom ?? null, isLive: !!live };
  });
  const sgpBatting  = sgpRows.filter(r => ['HR','OBP','R','RBI','SB'].includes(r.cat));
  const sgpPitching = sgpRows.filter(r => ['ERA','INN','K','S','WHIP'].includes(r.cat));

  const RankBar = ({ rank, total }: { rank: number; total: number }) => {
    const pct = rank > 0 ? ((total - rank + 1) / total) * 100 : 50;
    const color = pct >= 75 ? 'bg-green-500' : pct >= 42 ? 'bg-yellow-400' : 'bg-red-400';
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-mono w-8 text-right opacity-60">#{rank}</span>
      </div>
    );
  };

  const GapTable = ({ label, data }: { label: string; data: typeof sgpRows }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
        <h3 className="font-serif italic text-xl">{label}</h3>
        {categoryStandings
          ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Live</span>
          : <span className="text-[10px] opacity-40 italic">Estimated — upload standings CSV for live data</span>}
      </div>
      <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_1.2fr] gap-2 px-6 py-2 bg-[#F8F8F8] border-b border-black/10">
        {['Category','Rank','Pts','Gap Up','1 pt costs'].map(h => <span key={h} className="col-header">{h}</span>)}
      </div>
      {data.map(r => (
        <div key={r.cat} className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_1.2fr] gap-2 px-6 py-3 border-b border-black/5 items-center hover:bg-[#F8F8F8] transition-colors">
          <span className="text-sm font-bold">{r.cat}</span>
          <div className="flex flex-col gap-1">
            <RankBar rank={r.rank} total={TOTAL_TEAMS} />
            {!categoryStandings && (
              <input type="number" min={1} max={TOTAL_TEAMS} value={manualRanks[r.cat] ?? 6}
                onChange={e => setManualRanks(prev => ({ ...prev, [r.cat]: Number(e.target.value) }))}
                className="w-10 text-[10px] font-mono border-b border-black/20 bg-transparent outline-none" />
            )}
          </div>
          <span className="font-mono text-sm">{r.pts.toFixed(1)}</span>
          <span className={`font-mono text-sm font-bold ${r.ptsToNext > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {r.ptsToNext > 0 ? `−${r.ptsToNext.toFixed(1)}` : '#1'}
          </span>
          <span className="text-xs opacity-60 font-mono">{r.denomCost != null ? `${r.denomCost} ${r.cat}` : '—'}</span>
        </div>
      ))}
    </div>
  );

  const minorLeaguers = effectiveRoster.filter(p => p.isMinor);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-8">
      <header>
        <h2 className="text-4xl font-serif italic mb-2">Strategy</h2>
        <p className="text-sm opacity-60">Breakout radar · category gaps · rotation health · call-up watch</p>
      </header>

      {/* ── Breakout Radar ── */}
      <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">Breakout Radar</p>
      <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif italic text-xl">Hidden Gems Available</h3>
          <div className="flex items-center gap-2">
            <Star size={16} className="text-[#F27D26]" />
            {weakCatNames.length > 0 && (
              <span className="text-[10px] text-yellow-400 font-bold">Targeting: {weakCatNames.slice(0,3).join(', ')}</span>
            )}
          </div>
        </div>

        {(radarBatters.length === 0 && radarPitchers.length === 0) && (
          <p className="text-sm opacity-40 italic">
            {(parsedStatcast || parsedStuff)
              ? freeAgents.length === 0
                ? 'Upload your FA list in the Data tab to scan for available gems.'
                : 'No strong-metric players found in your FA list. Try lowering thresholds or refreshing data.'
              : 'Upload Statcast (Savant) and Stuff+ (FanGraphs) in the Data tab to scan the waiver wire.'}
          </p>
        )}

        {radarBatters.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] uppercase opacity-50 mb-3 tracking-widest">Batters — xwOBA &gt; .350</p>
            <div className="flex flex-col gap-2">
              {radarBatters.map((p: any, i: number) => (
                <div key={i} className="py-2 border-b border-white/10 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-[10px] opacity-40">{p.pos}</span>
                      {p.mlbTeam && <span className="text-[10px] opacity-30">{p.mlbTeam}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://www.fangraphs.com/players/${p.name.toLowerCase().replace(/\s+/g,'-')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] opacity-30 hover:opacity-70 underline"
                        onClick={e => e.stopPropagation()}
                      >Schedule ↗</a>
                      <span className="font-mono text-[#F27D26] font-bold text-sm">{p.stat}</span>
                    </div>
                  </div>
                  {p.context && <p className="text-[10px] opacity-40 mt-0.5">{p.context}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {radarPitchers.length > 0 && (
          <div>
            <p className="text-[10px] uppercase opacity-50 mb-3 tracking-widest">Pitchers — Stuff+ &gt; 108</p>
            <div className="flex flex-col gap-2">
              {radarPitchers.map((p: any, i: number) => (
                <div key={i} className="py-2 border-b border-white/10 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{p.name}</span>
                      <span className="text-[10px] opacity-40">{p.pos}</span>
                      {p.mlbTeam && <span className="text-[10px] opacity-30">{p.mlbTeam}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={`https://www.fangraphs.com/players/${p.name.toLowerCase().replace(/\s+/g,'-')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] opacity-30 hover:opacity-70 underline"
                        onClick={e => e.stopPropagation()}
                      >Schedule ↗</a>
                      <span className="font-mono text-[#F27D26] font-bold text-sm">{p.stat}</span>
                    </div>
                  </div>
                  {p.context && <p className="text-[10px] opacity-40 mt-0.5">{p.context}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Category Gap Analysis ── */}
      <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">Category Standing Gaps</p>
      <GapTable label="Batting" data={sgpBatting} />
      <GapTable label="Pitching" data={sgpPitching} />

      {/* ── Rotation Health + Call-Up Watch ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rotation Health */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif italic text-xl">Rotation Health</h3>
            <span className="text-[10px] opacity-40 italic">Stuff+ ranked</span>
          </div>
          {rotationHealth.length === 0 ? (
            <p className="text-sm opacity-40 italic">No pitchers on roster.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rotationHealth.map(({ player, stuffPlus, pitchingPlus }) => {
                const confidence = stuffPlus && stuffPlus > 110 ? 'Start' : stuffPlus && stuffPlus > 95 ? 'Monitor' : stuffPlus ? 'Spot' : null;
                const confCls    = confidence === 'Start' ? 'text-green-700 bg-green-50' : confidence === 'Monitor' ? 'text-yellow-700 bg-yellow-50' : 'text-gray-500 bg-gray-50';
                return (
                  <div key={player.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{player.name}</p>
                      <p className="text-[10px] opacity-40">{player.pos.join('/')} · {player.team}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stuffPlus && <span className="font-mono text-xs opacity-60">Stf+ {stuffPlus}</span>}
                      {pitchingPlus && <span className="font-mono text-xs opacity-40">Pit+ {pitchingPlus}</span>}
                      {confidence
                        ? <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${confCls}`}>{confidence}</span>
                        : <span className="text-[10px] opacity-30 italic">No data</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!parsedStuff && <p className="text-xs opacity-30 italic mt-3">Upload Stuff+ (FanGraphs) for signal-based rankings</p>}
        </div>

        {/* Call-Up Watch */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-serif italic text-xl">Call-Up Watch</h3>
            <span className="text-[10px] opacity-40 italic">M-status players</span>
          </div>
          {minorLeaguers.length === 0 ? (
            <p className="text-sm opacity-40 italic">No M-status players on roster.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {minorLeaguers.map(p => {
                const st = parsedStuff?.find(d => nameMatch(d.name, p.name));
                const sc = parsedStatcast?.find(d => nameMatch(d.name, p.name));
                const signal = st?.stuffPlus && st.stuffPlus > 105 ? `Stuff+ ${st.stuffPlus} — ready` :
                               sc?.xwoba && sc.xwoba > 0.350 ? `xwOBA ${sc.xwoba.toFixed(3)} — promising` : null;
                return (
                  <div key={p.id} className="p-3 rounded-xl bg-[#F8F8F8] border border-black/5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-[10px] opacity-40">{p.pos.join('/')} · {p.team} · {p.contract}</p>
                      </div>
                      <span className="font-mono text-xs opacity-50">${p.salary}</span>
                    </div>
                    {signal && <p className="text-[10px] text-green-700 font-bold mt-1">↑ {signal}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SPARK / FADE Scores ── */}
      {(parsedFGBat.length > 0 || parsedFGPit.length > 0) && (() => {
        type SparkRow = { player: Player; spark: SparkScore | null; fade: FadeScore | null };
        const rows: SparkRow[] = effectiveRoster
          .filter(p => !p.isMinor)
          .map(p => {
            const isPitcher = p.pos.some(x => ['SP','RP','P'].includes(x));
            const spark = computeSparkScore(p.name, isPitcher, parsedFGBat, parsedFGPit, parsedStuff ?? []);
            const fade  = computeFadeScore(p.name, isPitcher, parsedFGBat, parsedFGPit, parsedStuff ?? []);
            return { player: p, spark, fade };
          })
          .filter(r => r.spark || r.fade)
          .sort((a, b) => (b.spark?.score ?? 0) - (a.spark?.score ?? 0));

        if (rows.length === 0) return null;

        const SPARK_TIER_CLS: Record<string, string> = {
          Breakout:   'bg-green-100 text-green-800',
          Building:   'bg-emerald-100 text-emerald-700',
          Developing: 'bg-yellow-100 text-yellow-700',
          Watch:      'bg-gray-100 text-gray-500',
        };
        const FADE_TIER_CLS: Record<string, string> = {
          'Sell High': 'bg-red-100 text-red-700',
          Monitor:     'bg-orange-100 text-orange-700',
          Hold:        'bg-yellow-100 text-yellow-700',
          Stable:      'bg-green-100 text-green-700',
        };

        return (
          <>
            <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">SPARK / FADE Scores</p>
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
                <h3 className="font-serif italic text-xl">SPARK / FADE</h3>
                <span className="text-[10px] opacity-40 italic">FG Batting &amp; Pitching Advanced · multi-year</span>
              </div>
              <div className="grid grid-cols-[1.5fr_0.5fr_1.2fr_1fr_1fr_1.6fr] gap-2 px-6 py-2 bg-[#F8F8F8] border-b border-black/10 text-[10px] font-bold uppercase tracking-widest opacity-50">
                <span>Player</span><span>Pos</span><span>SPARK</span><span>FADE</span><span>Trend</span><span>Top Signal</span>
              </div>
              {rows.map(({ player, spark, fade }) => {
                const trendIcon = spark?.trend === 'improving' ? '↑' : spark?.trend === 'declining' ? '↓' : spark?.trend === 'stable' ? '→' : '?';
                const trendCls  = spark?.trend === 'improving' ? 'text-green-600' : spark?.trend === 'declining' ? 'text-red-500' : 'opacity-40';
                return (
                  <div key={player.id} className="grid grid-cols-[1.5fr_0.5fr_1.2fr_1fr_1fr_1.6fr] gap-2 px-6 py-3 border-b border-black/5 last:border-0 items-center hover:bg-[#F8F8F8] transition-colors">
                    <div>
                      <p className="text-sm font-medium">{player.name}</p>
                      <p className="text-[10px] opacity-40">{player.team}</p>
                    </div>
                    <span className="text-[10px] opacity-60">{player.pos.join('/')}</span>
                    <div className="flex items-center gap-1.5">
                      {spark ? (
                        <>
                          <span className="font-mono text-sm font-bold">{spark.score}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SPARK_TIER_CLS[spark.tier]}`}>{spark.tier}</span>
                        </>
                      ) : <span className="text-[10px] opacity-30 italic">—</span>}
                    </div>
                    <div>
                      {fade ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${FADE_TIER_CLS[fade.tier]}`}>{fade.tier} {fade.score}</span>
                      ) : <span className="text-[10px] opacity-30 italic">—</span>}
                    </div>
                    <span className={`text-sm font-bold ${trendCls}`}>{trendIcon} {spark?.trend ?? '—'}</span>
                    <p className="text-[10px] opacity-60 truncate" title={spark?.topReason ?? fade?.topReason}>{spark?.topReason ?? fade?.topReason ?? '—'}</p>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Regression Watch */}
      <>
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">Regression Watch</p>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-serif italic text-xl">Regression Watch</h3>
            <span className="text-[10px] opacity-40 italic">Your roster vs. Stuff+ / xwOBA</span>
          </div>

          {parsedStuff && (
            <div className="mb-6">
              <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest mb-3">Pitchers — Stuff+ vs. Pitching+</p>
              <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_1fr] gap-2 px-3 py-2 bg-[#F8F8F8] rounded-t-lg border-b border-black/5">
                <span className="col-header">Player</span>
                <span className="col-header">Stuff+</span>
                <span className="col-header">Pitch+</span>
                <span className="col-header">Gap</span>
                <span className="col-header">Signal</span>
              </div>
              {(() => {
                const pitcherRows = effectiveRoster
                  .filter(p => p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos)) && !p.isMinor)
                  .map(p => {
                    const match = parsedStuff.find(d => nameMatch(d.name, p.name));
                    if (!match || (!match.stuffPlus && !match.pitchingPlus)) return null;
                    const gap = (match.pitchingPlus || 0) - (match.stuffPlus || 0);
                    // These are YOUR owned players — label signals from an owner's perspective
                    const sig = gap > 8  ? { label: 'Sell high',     cls: 'text-orange-600 bg-orange-50' }
                              : gap < -8 ? { label: 'Hold · Upside', cls: 'text-green-700 bg-green-50'  }
                              :            { label: 'On track',       cls: 'text-gray-500 bg-gray-50'    };
                    return (
                      <div key={p.id} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_1fr] gap-2 px-3 py-2 border-b border-black/5 last:border-0 items-center hover:bg-[#F8F8F8] transition-colors">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-[10px] opacity-40">{p.pos.join('/')} · {p.team}</p>
                        </div>
                        <span className="font-mono text-sm">{match.stuffPlus || '—'}</span>
                        <span className="font-mono text-sm">{match.pitchingPlus || '—'}</span>
                        <span className={`font-mono text-sm font-bold ${gap > 5 ? 'text-orange-500' : gap < -5 ? 'text-green-600' : 'opacity-40'}`}>
                          {gap > 0 ? '+' : ''}{gap.toFixed(0)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${sig.cls}`}>{sig.label}</span>
                      </div>
                    );
                  }).filter(Boolean);
                return pitcherRows.length > 0 ? pitcherRows : (
                  <div className="px-3 py-6 text-center text-sm opacity-40 italic">
                    No name matches found — pitcher names in your roster may differ from FanGraphs format
                  </div>
                );
              })()}
            </div>
          )}

          {parsedStatcast && (
            <div>
              <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest mb-3">Batters — Exit Velo & xwOBA</p>
              <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_1fr] gap-2 px-3 py-2 bg-[#F8F8F8] rounded-t-lg border-b border-black/5">
                <span className="col-header">Player</span>
                <span className="col-header">EV</span>
                <span className="col-header">Brl%</span>
                <span className="col-header">xwOBA</span>
                <span className="col-header">Signal</span>
              </div>
              {(() => {
                const batterRows = effectiveRoster
                  .filter(p => !p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos)) && !p.isMinor)
                  .map(p => {
                    const match = parsedStatcast.find(d => nameMatch(d.name, p.name));
                    if (!match || (!match.ev && !match.xwoba)) return null;
                    const xw = match.xwoba || 0;
                    const sig = xw > 0.380 ? { label: 'Elite process', cls: 'text-green-700 bg-green-50'    }
                              : xw > 0.340 ? { label: 'Above avg',      cls: 'text-emerald-600 bg-emerald-50' }
                              : xw > 0.300 ? { label: 'Average',        cls: 'text-gray-500 bg-gray-50'      }
                              :              { label: 'Sell high',       cls: 'text-orange-600 bg-orange-50'  };
                    return (
                      <div key={p.id} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr_1fr] gap-2 px-3 py-2 border-b border-black/5 last:border-0 items-center hover:bg-[#F8F8F8] transition-colors">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-[10px] opacity-40">{p.pos.join('/')} · {p.team}</p>
                        </div>
                        <span className="font-mono text-sm">{match.ev ? `${match.ev}` : '—'}</span>
                        <span className="font-mono text-sm">{match.barrelRate ? `${match.barrelRate}%` : '—'}</span>
                        <span className="font-mono text-sm">{xw ? xw.toFixed(3) : '—'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${sig.cls}`}>{sig.label}</span>
                      </div>
                    );
                  }).filter(Boolean);
                return batterRows.length > 0 ? batterRows : (
                  <div className="px-3 py-6 text-center text-sm opacity-40 italic">
                    No name matches found — batter names in your roster may differ from Statcast format
                  </div>
                );
              })()}
            </div>
          )}
          {!parsedStuff && !parsedStatcast && (
            <div className="text-center py-8 opacity-40">
              <p className="text-sm mb-1">No advanced data loaded yet.</p>
              <p className="text-xs">Upload Stuff+ (FanGraphs) and/or Statcast (Baseball Savant) CSVs in the Data tab to see regression signals for your pitchers and hitters.</p>
            </div>
          )}
        </div>
      </>

    </motion.div>
  );
}

function EditableValue({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseInt(draft, 10);
          if (!isNaN(n) && n >= 0) onChange(n);
          setEditing(false);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-14 font-mono text-sm border-b-2 border-[#F27D26] outline-none bg-transparent"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="Click to edit projection"
      className="flex items-center gap-1 font-mono text-sm text-left hover:text-[#F27D26] transition-colors group/edit"
    >
      ${value || '—'}
      <Pencil size={10} className="opacity-0 group-hover/edit:opacity-40 transition-opacity" />
    </button>
  );
}


// ─── Data View ───────────────────────────────────────────────────────────────

function DataView({
  onDataLoaded,
  onResetData,
  onClearFreeAgents,
  onClearStats,
  onClearProjections,
  onClearFGBat,
  onClearFGPit,
  dataTimestamps,
  parsedRoster,
  parsedStandings,
  parsedFaab,
  parsedStatcast,
  parsedStuff,
  parsedStats,
  parsedProjections,
  parsedFGBat,
  parsedFGPit,
  leagueRoster,
  freeAgents,
  transactions,
}: {
  onDataLoaded: (type: DataType, rawData: any[], csvText: string, season?: number) => void;
  onResetData: () => void;
  onClearFreeAgents?: () => void;
  onClearStats?: () => void;
  onClearProjections?: () => void;
  onClearFGBat?: () => void;
  onClearFGPit?: () => void;
  dataTimestamps: Record<string, string>;
  parsedRoster: Player[] | null;
  parsedStandings: HistoricalStanding[] | null;
  parsedFaab: FaabEntry[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  parsedStats: PlayerStat[] | null;
  parsedProjections: PlayerProjection[] | null;
  parsedFGBat: FGBatterSeason[];
  parsedFGPit: FGPitcherSeason[];
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  freeAgents: LeaguePlayer[];
  transactions: TransactionEntry[] | null;
  key?: any;
}) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteType, setPasteType] = useState<Exclude<DataType, 'unknown'>>('leagueroster');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const forcedFileInputRef = useRef<HTMLInputElement>(null);
  const forcedTypeRef = useRef<DataType | null>(null);

  // Strip CBS fantasy export title rows like "All Pitchers Year to Date MLB Standard Categories"
  // that appear as line 1 and confuse PapaParser into treating them as the header.
  const stripCBSTitleRow = (text: string): string =>
    text.replace(/^[^\n]*(?:Year to Date|All (?:Players|Pitchers|Batters))[^\n]*\n?/i, '');

  const stageFiles = async (files: FileList | File[]) => {
    const newStaged: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.match(/\.(csv|txt)$/i)) continue;
      const csvText = stripCBSTitleRow(await file.text());
      const { type, rowCount, confidence } = detectDataType(csvText);
      // Parse year from filename: "FG Batting Dashboard 2025.csv" → 2025
      const yearMatch = file.name.match(/20(2\d)/);
      const detectedSeason = yearMatch ? parseInt(yearMatch[0]) : null;
      newStaged.push({
        id: `${Date.now()}-${i}`,
        name: file.name,
        csvText,
        rawFile: file,
        detectedType: type,
        assignedType: type === 'unknown' ? 'leagueroster' : type,
        rowCount,
        confidence,
        detectedSeason,
      });
    }
    setStagedFiles(prev => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load files immediately with a forced data type — bypasses auto-detection and staging.
  // clearFirst: wipe existing freeagents before loading (used by Re-upload button).
  const loadFilesForced = async (files: FileList | File[], forceType: DataType, clearFirst = false) => {
    if (clearFirst && forceType === 'freeagents') onClearFreeAgents?.();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.match(/\.(csv|txt)$/i)) continue;
      const csvText = stripCBSTitleRow(await file.text());
      const yearMatch = file.name.match(/20(2\d)/);
      const detectedSeason = yearMatch ? parseInt(yearMatch[0]) : undefined;
      try {
        const rawData = await parseCSVText(csvText);
        onDataLoaded(forceType, rawData, csvText, detectedSeason);
      } catch (err) {
        console.error('Forced load failed', err);
      }
    }
    if (forcedFileInputRef.current) forcedFileInputRef.current.value = '';
  };

  const forcedClearRef = useRef(false);

  const openForcedUpload = (type: DataType, clearFirst = false) => {
    forcedTypeRef.current = type;
    forcedClearRef.current = clearFirst;
    forcedFileInputRef.current?.click();
  };

  const handleForcedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && forcedTypeRef.current) {
      loadFilesForced(e.target.files, forcedTypeRef.current, forcedClearRef.current);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) stageFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) stageFiles(e.dataTransfer.files);
  };

  const loadStagedFile = async (staged: StagedFile) => {
    setLoadingIds(prev => new Set(prev).add(staged.id));
    try {
      const rawData = await parseCSVText(staged.csvText);
      onDataLoaded(staged.assignedType, rawData, staged.csvText, staged.detectedSeason ?? undefined);
      setStagedFiles(prev => prev.filter(f => f.id !== staged.id));
    } catch (err) {
      console.error('Load failed', err);
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(staged.id); return s; });
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) return;
    try {
      const rawData = await parseCSVText(pasteContent);
      onDataLoaded(pasteType, rawData, pasteContent);
    } catch (err) {
      console.error('Paste failed', err);
    }
    setShowPasteModal(false);
    setPasteContent('');
  };

  const hasAnyData = !!(parsedRoster || parsedStandings || parsedFaab || parsedStatcast || parsedStuff || parsedStats || parsedProjections || parsedFGBat.length > 0 || parsedFGPit.length > 0 || leagueRoster || freeAgents.length > 0 || transactions);

  // Unique seasons loaded for FG data
  const fgBatSeasons = [...new Set(parsedFGBat.map(r => r.season))].sort().join(', ');
  const fgPitSeasons = [...new Set(parsedFGPit.map(r => r.season))].sort().join(', ');

  const dataStatus = [
    { key: 'leagueroster', label: 'League Rosters', active: !!leagueRoster, count: leagueRoster ? `${Object.keys(leagueRoster).length} teams` : null, onClear: undefined as (() => void) | undefined },
    { key: 'freeagents',   label: 'Available Players', active: freeAgents.length > 0, count: freeAgents.length > 0 ? `${freeAgents.length} players` : null, onClear: onClearFreeAgents },
    { key: 'standings',    label: 'Standings',      active: !!parsedStandings, count: null, onClear: undefined },
    { key: 'transactions', label: 'Transactions',   active: !!transactions, count: transactions ? `${transactions.length} entries` : null, onClear: undefined },
    { key: 'statcast',     label: 'Statcast',       active: !!parsedStatcast, count: parsedStatcast ? `${parsedStatcast.length} players` : null, onClear: undefined },
    { key: 'stuff',        label: 'Stuff+',         active: !!parsedStuff, count: parsedStuff ? `${parsedStuff.length} pitchers` : null, onClear: undefined },
    { key: 'stats',        label: 'CBS YTD Stats',  active: !!parsedStats, count: parsedStats ? `${parsedStats.length} players` : null, onClear: onClearStats },
    { key: 'projections',  label: 'Steamer Proj.',  active: !!parsedProjections, count: parsedProjections ? `${parsedProjections.length} players` : null, onClear: onClearProjections },
    { key: 'fg-bat',       label: 'FG Batting',     active: parsedFGBat.length > 0, count: parsedFGBat.length > 0 ? `${parsedFGBat.length} rows · ${fgBatSeasons}` : null, onClear: onClearFGBat },
    { key: 'fg-pit',       label: 'FG Pitching',    active: parsedFGPit.length > 0, count: parsedFGPit.length > 0 ? `${parsedFGPit.length} rows · ${fgPitSeasons}` : null, onClear: onClearFGPit },
  ];

  const CBS_SOURCES = [
    {
      type: 'leagueroster' as DataType,
      label: 'All-Team Rosters',
      desc: "From CBS: My Team → Roster → Export full league. Contains all 12 teams' rosters, salaries, contract years.",
      icon: '👥',
    },
    {
      type: 'freeagents' as DataType,
      label: 'Available Players (FA List)',
      desc: 'From CBS: Players → Available Players → Export. Required for FAAB bid autocomplete and target lists.',
      icon: '🔍',
    },
    {
      type: 'standings' as DataType,
      label: 'Standings / Overall CSV',
      desc: 'From CBS: Standings → Overall → Export. Enables live category ranks and SGP gap analysis.',
      icon: '📊',
    },
    {
      type: 'transactions' as DataType,
      label: 'Transaction Log',
      desc: 'From CBS: Transactions → All Transactions → Export. Shows adds, drops, trades across the league.',
      icon: '📋',
    },
  ];

  const EXT_SOURCES = [
    {
      type: 'statcast' as DataType,
      label: 'Statcast Batting (Baseball Savant)',
      url: 'https://baseballsavant.mlb.com/statcast_leaderboard',
      steps: [
        '1. Click the link above → Baseball Savant Statcast Leaderboard',
        '2. Set Year = 2026, Player Type = Batter, Min PA = 50',
        '3. Hit Search, then scroll to bottom → "Export to CSV"',
      ],
      icon: '⚾',
    },
    {
      type: 'statcast' as DataType,
      label: 'Statcast Pitching (Baseball Savant)',
      url: 'https://baseballsavant.mlb.com/statcast_leaderboard',
      steps: [
        '1. Click the link above → Baseball Savant Statcast Leaderboard',
        '2. Set Year = 2026, Player Type = Pitcher, Min BF = 30',
        '3. Hit Search, then scroll to bottom → "Export to CSV"',
      ],
      icon: '🎯',
    },
    {
      type: 'stuff' as DataType,
      label: 'Stuff+ / Pitching+ (FanGraphs)',
      url: 'https://www.fangraphs.com/leaders/major-league?pos=p&stats=pit&lg=all&qual=10&type=36',
      steps: [
        '1. Click the link above → FanGraphs Pitching Leaders (+ Stats preset)',
        '2. Set Min IP = 10 in the qualifier dropdown',
        '3. Scroll to bottom → click the CSV export icon',
      ],
      icon: '🔥',
    },
    {
      type: 'stuff' as DataType,
      label: 'xFIP / ERA- Leaders (FanGraphs)',
      url: 'https://www.fangraphs.com/leaders/major-league?pos=p&stats=pit&lg=all&qual=10&type=1',
      steps: [
        '1. Click the link above → FanGraphs Pitching Leaders (Dashboard preset)',
        '2. Confirm Year = 2026, set Min IP = 10',
        '3. Scroll to bottom → click the CSV export icon',
      ],
      icon: '📉',
    },
    {
      type: 'statcast' as DataType,
      label: 'Batting Leaders (FanGraphs)',
      url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&qual=50&type=8',
      steps: [
        '1. Click the link above → FanGraphs Batting Leaders (Advanced preset)',
        '2. Confirm Year = 2026, set Min PA = 50',
        '3. Scroll to bottom → click the CSV export icon',
      ],
      icon: '📈',
    },
    {
      type: 'stats' as DataType,
      label: 'CBS YTD Batting Stats',
      url: 'https://www.cbssports.com/fantasy/baseball/',
      steps: [
        '1. Go to your CBS fantasy league homepage (not the link above — open your league directly)',
        '2. Click "Players" in the top nav → then "Stats" or "Scoring Leaders"',
        '3. Set filter to Batters · Year to Date · All Teams',
        '4. Scroll to bottom → click "Export" or the CSV icon',
        'Note: If the file doesn\'t auto-detect, set type to "CBS YTD Stats" in the dropdown before clicking Load.',
      ],
      icon: '🏟️',
    },
    {
      type: 'stats' as DataType,
      label: 'CBS YTD Pitching Stats',
      url: 'https://www.cbssports.com/fantasy/baseball/',
      steps: [
        '1. Go to your CBS fantasy league homepage (not the link above — open your league directly)',
        '2. Click "Players" → "Stats" or "Scoring Leaders"',
        '3. Set filter to Pitchers · Year to Date · All Teams',
        '4. Scroll to bottom → click "Export" or the CSV icon',
        'Note: Upload batters and pitchers separately — they merge automatically.',
      ],
      icon: '⚡',
    },
    {
      type: 'projections' as DataType,
      label: 'Steamer RoS Batting Projections (FanGraphs)',
      url: 'https://www.fangraphs.com/projections.aspx?pos=all&stats=bat&type=steamerr',
      steps: [
        '1. Click the link above → FanGraphs Steamer Rest-of-Season Batting',
        '2. Make sure all columns are shown (click "Show All" if available)',
        '3. Scroll to bottom → click the CSV export icon',
      ],
      icon: '🔭',
    },
    {
      type: 'projections' as DataType,
      label: 'Steamer RoS Pitching Projections (FanGraphs)',
      url: 'https://www.fangraphs.com/projections.aspx?pos=all&stats=pit&type=steamerr',
      steps: [
        '1. Click the link above → FanGraphs Steamer Rest-of-Season Pitching',
        '2. Make sure all columns are shown (click "Show All" if available)',
        '3. Scroll to bottom → click the CSV export icon',
        'Note: Upload batters and pitchers separately — they merge automatically.',
      ],
      icon: '📡',
    },
    {
      type: 'fg-bat' as DataType,
      label: 'FG Batting Dashboard (SPARK engine)',
      url: 'https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&qual=50&type=8',
      steps: [
        '1. Click the link above → FanGraphs Batting Leaders, Dashboard preset',
        '2. Set Year = 2026 (repeat for 2025, 2024 — each file powers YoY trend)',
        '3. Set Min PA = 50, export CSV',
        'Name each file with the year, e.g. "FG Batting Dashboard 2025.csv" — year auto-detected.',
      ],
      icon: '🔬',
    },
    {
      type: 'fg-pit' as DataType,
      label: 'FG Pitching Advanced (SPARK engine)',
      url: 'https://www.fangraphs.com/leaders/major-league?pos=p&stats=pit&lg=all&qual=30&type=1',
      steps: [
        '1. Click the link above → FanGraphs Pitching Leaders, Advanced preset',
        '2. Set Year = 2026 (repeat for 2025, 2024 — each file powers YoY trend)',
        '3. Set Min IP = 30, export CSV',
        'Name each file with the year, e.g. "FG Pitching Advanced 2025.csv" — year auto-detected.',
      ],
      icon: '🧬',
    },
  ];

  const formatTs = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">Data</h2>
          <p className="text-sm opacity-60">Upload CSVs to power live analysis across all tabs</p>
        </div>
        {hasAnyData && (
          <button
            onClick={onResetData}
            className="text-[10px] uppercase font-bold tracking-widest text-red-400 hover:text-red-300 transition-colors"
          >
            Reset All Data
          </button>
        )}
      </header>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
        {dataStatus.map(({ key, label, active, count, onClear }) => (
          <div key={key} className={`p-4 rounded-xl border flex flex-col gap-2 ${active ? 'bg-green-50 border-green-200' : 'bg-white border-black/5'}`}>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-black/15'}`} />
                <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">{active ? 'Live' : 'None'}</span>
              </div>
              {active && onClear && (
                <button onClick={onClear} className="text-[10px] opacity-30 hover:opacity-70 font-bold ml-auto" title="Clear">×</button>
              )}
            </div>
            <p className="text-xs font-medium leading-tight">{label}</p>
            {active && count && <p className="text-[10px] opacity-50 font-mono">{count}</p>}
            {active && dataTimestamps[key] && (
              <p className="text-[10px] opacity-40 font-mono">{formatTs(dataTimestamps[key])}</p>
            )}
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div className="bg-[#F27D26] text-white p-6 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Database size={22} />
          <h3 className="font-serif italic text-xl">Import Data</h3>
        </div>
        <p className="text-sm mb-5 opacity-90">Drop any CSV — type is auto-detected from column headers, not filename. You can also override the type manually.</p>

        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.txt" />
        <input type="file" multiple className="hidden" ref={forcedFileInputRef} onChange={handleForcedFileChange} accept=".csv,.txt" />

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-white bg-white/20' : 'border-white/30 hover:border-white/60 hover:bg-white/5'}`}
        >
          <Database size={22} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs font-bold uppercase tracking-widest">Drop CSVs here or click to browse</p>
          <p className="text-[10px] opacity-60 mt-1">Accepts .csv or .txt · any filename works</p>
        </div>

        {stagedFiles.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Ready to Import</p>
              <button
                onClick={() => stagedFiles.forEach(f => loadStagedFile(f))}
                className="text-[10px] bg-white text-[#F27D26] font-bold px-3 py-1 rounded uppercase tracking-widest hover:bg-white/90 transition-colors"
              >
                Load All ({stagedFiles.length})
              </button>
            </div>
            {stagedFiles.map(staged => (
              <div key={staged.id} className="bg-black/20 rounded-lg p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate">{staged.name}</p>
                    {staged.detectedSeason && (
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono shrink-0">{staged.detectedSeason}</span>
                    )}
                  </div>
                  <p className="text-[10px] opacity-50">{staged.rowCount} rows · {staged.detectedType === staged.assignedType && staged.confidence !== 'low' ? 'auto-detected' : staged.confidence === 'low' ? '⚠ verify type' : 'type forced'}</p>
                </div>
                <select
                  value={staged.assignedType}
                  onChange={e => setStagedFiles(prev => prev.map(f => f.id === staged.id ? { ...f, assignedType: e.target.value as DataType } : f))}
                  className="text-[10px] bg-black/40 border border-white/20 rounded px-2 py-1 text-white font-bold shrink-0 cursor-pointer"
                >
                  {DATA_TYPES.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
                <button
                  onClick={() => loadStagedFile(staged)}
                  disabled={loadingIds.has(staged.id)}
                  className="text-[10px] bg-white/20 hover:bg-white/30 disabled:opacity-40 rounded px-2 py-1 font-bold uppercase shrink-0 transition-colors flex items-center gap-1"
                >
                  {loadingIds.has(staged.id) ? <Loader2 size={10} className="animate-spin" /> : 'Load'}
                </button>
                <button
                  onClick={() => setStagedFiles(prev => prev.filter(f => f.id !== staged.id))}
                  className="text-white/40 hover:text-white/80 shrink-0 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPasteModal(true)}
          className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
        >
          Paste CSV Instead
        </button>
      </div>

      {/* CBS Sources */}
      <div>
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-4">From CBS Sports</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CBS_SOURCES.map(src => {
            const statusEntry = dataStatus.find(d => d.key === src.type);
            const loaded = statusEntry?.active;
            const count = statusEntry?.count;
            const ts = dataTimestamps[src.type];
            const isFa = src.type === 'freeagents';
            return (
              <div key={src.type} className={`bg-white rounded-2xl border p-5 flex gap-4 ${loaded ? 'border-green-200' : 'border-black/5'}`}>
                <span className="text-2xl shrink-0">{src.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold">{src.label}</p>
                    {loaded && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">✓ {count ?? 'Loaded'}</span>}
                  </div>
                  <p className="text-xs opacity-60 leading-relaxed mb-2">{src.desc}</p>
                  {isFa && loaded && <p className="text-[10px] opacity-50 mb-2">CBS exports batters &amp; pitchers separately — upload both to combine them.</p>}
                  {loaded && ts && <p className="text-[10px] opacity-40 font-mono mb-2">{formatTs(ts)}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openForcedUpload(src.type, !isFa)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors ${loaded ? 'bg-black/5 text-black/50 hover:bg-black/10' : 'bg-[#F27D26] text-white hover:bg-[#d96a1d]'}`}
                    >
                      {isFa && loaded ? 'Add More' : loaded ? 'Re-upload' : 'Upload CSV'}
                    </button>
                    {isFa && loaded && (
                      <button
                        onClick={() => { onClearFreeAgents?.(); openForcedUpload('freeagents', false); }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* External Sources */}
      <div>
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold mb-4">External Sources</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXT_SOURCES.map((src, idx) => {
            const statusEntry = dataStatus.find(d => d.key === src.type);
            const loaded = statusEntry?.active;
            const count  = statusEntry?.count;
            const ts = dataTimestamps[src.type];
            // Types that support multi-upload (merge by key) — show "Add More" button when loaded
            const canAddMore = (['stats', 'projections', 'fg-bat', 'fg-pit'] as DataType[]).includes(src.type) && loaded;
            const clearFn = statusEntry?.onClear;
            return (
              <div key={`${src.type}-${idx}`} className={`bg-white rounded-2xl border p-5 flex gap-4 ${loaded ? 'border-green-200' : 'border-black/5'}`}>
                <span className="text-2xl shrink-0">{src.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold hover:text-[#F27D26] transition-colors flex items-center gap-1 group">
                      {src.label}
                      <ExternalLink size={11} className="opacity-40 group-hover:opacity-80 transition-opacity" />
                    </a>
                    {loaded && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold shrink-0">✓ {count ?? 'Loaded'}</span>}
                  </div>
                  <ol className="flex flex-col gap-1 mb-3">
                    {src.steps.map((step, i) => (
                      <li key={i} className="text-xs opacity-60 leading-relaxed">{step}</li>
                    ))}
                  </ol>
                  {loaded && ts && <p className="text-[10px] opacity-40 font-mono mb-2">{formatTs(ts)}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openForcedUpload(src.type, !canAddMore)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors ${loaded && !canAddMore ? 'bg-black/5 text-black/50 hover:bg-black/10' : 'bg-[#F27D26] text-white hover:bg-[#d96a1d]'}`}
                    >
                      {canAddMore ? 'Add More' : loaded ? 'Re-upload' : 'Upload CSV'}
                    </button>
                    {canAddMore && clearFn && (
                      <button
                        onClick={() => { clearFn(); openForcedUpload(src.type, false); }}
                        className="text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      >
                        Replace
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#141414] border border-white/20 rounded-2xl p-6 w-full max-w-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-serif italic text-xl text-white">Paste CSV Data</h4>
              <button onClick={() => setShowPasteModal(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {DATA_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setPasteType(type)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${pasteType === type ? 'bg-[#F27D26] text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste your CSV data here (including headers)..."
              className="w-full h-64 bg-black/50 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/80 focus:outline-none focus:border-[#F27D26] mb-4 resize-none"
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteContent.trim()}
              className="w-full py-3 bg-[#F27D26] hover:bg-[#d96a1d] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-colors"
            >
              Load Data
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function OwnersView() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header>
        <h2 className="text-4xl font-serif italic mb-2">Owner Profiles</h2>
        <p className="text-sm opacity-60">League Landscape & Competitive Tiers</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <OwnerCard 
          name="Five Point Palm" 
          tier="Tier 1 Pitching" 
          assets="Skenes, Woo, Jhoan Duran" 
          budget={167}
        />
        <OwnerCard 
          name="22 Samurai" 
          tier="Tier 1 Hitting" 
          assets="Ohtani, Vlad, Yamamoto" 
          budget={96}
        />
        <OwnerCard 
          name="Free Avon Barksdale" 
          tier="Tier 1 Hitting" 
          assets="Witt, Alvarez, Harper" 
          budget={149}
        />
        <OwnerCard 
          name="NOMAAM" 
          tier="Tier 1 Hitting" 
          assets="Acuna, Henderson, Schwarber" 
          budget={108}
        />
        <OwnerCard 
          name="WTF" 
          tier="Tier 2 (Rising)" 
          assets="Turner, Shane Smith (Proj)" 
          budget={167}
        />
        <OwnerCard 
          name="EYJ (Me)" 
          tier="Tier 2 Pitching / SB Elite" 
          assets="Crochet, Freeman, Abrams" 
          budget={207}
          isMe
        />
      </div>
    </motion.div>
  );
}

function OwnerCard({ name, tier, assets, budget, isMe }: { name: string, tier: string, assets: string, budget: number, isMe?: boolean }) {
  return (
    <div className={`p-6 rounded-2xl border ${isMe ? 'bg-[#141414] text-white border-transparent' : 'bg-white border-black/5'} shadow-sm`}>
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-serif italic text-lg">{name}</h4>
        <span className="font-mono text-xs opacity-50">${budget}</span>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[10px] uppercase opacity-50 mb-1">Competitive Tier</p>
          <p className="text-sm font-medium">{tier}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase opacity-50 mb-1">Key Assets</p>
          <p className="text-xs opacity-70">{assets}</p>
        </div>
      </div>
    </div>
  );
}

