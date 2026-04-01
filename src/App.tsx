import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  ArrowLeftRight,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  History,
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
import { Player, HistoricalStanding, FaabEntry, LeagueDetails, LiveCategoryStanding, LeaguePlayer, TransactionEntry } from './types';

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
  detectDataType,
  parseCSVText,
  DataType
} from './services/dataService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manage' | 'trades' | 'analytics' | 'data' | 'strategy'>(() => {
    try {
      const t = localStorage.getItem('eyj_activeTab');
      const valid = ['dashboard', 'manage', 'trades', 'analytics', 'data', 'strategy'];
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

  // Central handler: apply parsed data by type. Used by both auto-load and manual import.
  const applyParsedData = (type: DataType, rawData: any[], csvText: string) => {
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

  const handleResetData = () => {
    ['eyj_roster','eyj_standings','eyj_faab','eyj_statcast','eyj_stuff','eyj_leagueDetails','eyj_categoryStandings','eyj_leagueroster','eyj_transactions','eyj_freeagents','eyj_timestamps'].forEach(k => localStorage.removeItem(k));
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
            label="Strategy Lab" 
          />
          <NavItem 
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')} 
            icon={<TrendingUp size={18} />} 
            label="Analytics" 
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
            <span className="text-[10px] uppercase opacity-50">FAAB Budget</span>
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
            />
          )}
          {activeTab === 'trades' && (
            <TradesView
              key="trades"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
              categoryStandings={parsedCategoryStandings}
              leagueRoster={leagueRoster}
            />
          )}
          {activeTab === 'strategy' && (
            <StrategyLabView
              key="strategy"
              parsedRoster={parsedRoster}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsView
              key="analytics"
              categoryStandings={parsedCategoryStandings}
              faabBudget={faabBudget}
            />
          )}
          {activeTab === 'data' && (
            <DataView
              key="data"
              onDataLoaded={applyParsedData}
              onResetData={handleResetData}
              onClearFreeAgents={() => { setFreeAgents([]); localStorage.removeItem('eyj_freeagents'); }}
              dataTimestamps={dataTimestamps}
              parsedRoster={parsedRoster}
              parsedStandings={parsedStandings}
              parsedFaab={parsedFaab}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
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

function DashboardView({ standings, leagueDetails }: { standings: HistoricalStanding[], leagueDetails: LeagueDetails | null, key?: any }) {
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

        {/* Key Risks */}
        <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl">Critical Risks</h3>
            <AlertTriangle size={18} className="text-[#F27D26]" />
          </div>
          <div className="flex flex-col gap-4">
            <RiskItem title="Iglesias Role" desc="Robert Suarez lurking in ATL. Monitor SV." />
            <RiskItem title="Senga/Boyd Health" desc="Fragile SP core. Depth needed." />
            <RiskItem title="Abreu Bridge" desc="Hader returns mid-April. SV will dry up." />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Trades */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <h3 className="font-serif italic text-xl mb-6">Pending Transactions</h3>
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl border border-dashed border-black/20 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">WTF Deal (Contingent)</p>
                <p className="text-xs opacity-60">Out: Adolis Garcia • In: Shane Smith, Lazaro Montes</p>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase font-bold tracking-tighter">Waiting</span>
            </div>
            <div className="p-4 rounded-xl border border-dashed border-black/20 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">Confederation Deal</p>
                <p className="text-xs opacity-60">Out: Ryan Weathers • In: Tyler Soderstrom</p>
              </div>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded uppercase font-bold tracking-tighter">Ready</span>
            </div>
          </div>
        </div>

        {/* Historical Trend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl">Historical Trend</h3>
            <History size={18} className="opacity-30" />
          </div>
          <div className="h-32 flex items-end gap-2">
            {standings.map((h, i) => (
              <div key={`${h.year}-${i}`} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-[#141414] rounded-t-sm transition-all hover:bg-[#F27D26]" 
                  style={{ height: `${(h.totalPts / 60) * 100}%` }}
                />
                <span className="text-[10px] font-mono opacity-50">{h.year}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RiskItem({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="border-l-2 border-[#F27D26] pl-4 py-1">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-xs opacity-60">{desc}</p>
    </div>
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

// ─── Roster Management Mega-Tab ───────────────────────────────────────────────

function ManageView({
  roster, leagueDetails, faabBudget, onBudgetChange,
  parsedFaab, transactions, categoryStandings, leagueRoster, freeAgents, dataTimestamps,
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
  key?: any;
}) {
  const [section, setSection] = useState<'roster' | 'keepers' | 'adddrop' | 'minors'>('roster');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const LUXURY_TAX = 400;
  const AUCTION_CAP = 260;

  const activePlayers  = roster.filter(p => !p.isMinor && !p.isReserve);
  const reservePlayers = roster.filter(p => p.isReserve && !p.isMinor);
  const minorPlayers   = roster.filter(p => p.isMinor);
  const activeSalary   = roster.filter(p => !p.isMinor).reduce((s, p) => s + p.salary, 0);

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
            value: `${activePlayers.length + reservePlayers.length} active`,
            sub: `${minorPlayers.length} in minors`,
            alert: false,
            alertMsg: '',
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
              { label: 'Active Batters', players: activePlayers.filter(p => !p.pos.some(pp => ['SP','RP','P'].includes(pp))) },
              { label: 'Active Pitchers', players: activePlayers.filter(p => p.pos.some(pp => ['SP','RP','P'].includes(pp))) },
              { label: 'Reserve', players: reservePlayers },
            ].map(group => (
              group.players.length > 0 && (
                <div key={group.label} className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-black/5 flex justify-between items-center">
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">{group.label}</p>
                    <p className="text-[10px] opacity-40">{group.players.length} players · ${group.players.reduce((s,p)=>s+p.salary,0)} salary</p>
                  </div>
                  {group.players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                      className={`w-full flex items-center gap-3 px-5 py-3 border-b border-black/5 last:border-0 hover:bg-[#F8F8F8] transition-colors text-left ${selectedPlayer?.id === p.id ? 'bg-[#FFF4EC]' : ''}`}
                    >
                      <span className="text-[10px] font-bold text-center bg-black/5 rounded px-1.5 py-0.5 w-14 shrink-0">{p.pos.join('/')}</span>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      <span className="text-[10px] opacity-40 shrink-0">{p.team}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.contract.startsWith('K') || p.contract.startsWith('F') ? 'bg-[#F27D26]/10 text-[#F27D26]' : p.contract.startsWith('M') ? 'bg-purple-100 text-purple-700' : 'bg-black/5 opacity-60'}`}>{p.contract}</span>
                      <span className="font-mono text-sm w-10 text-right shrink-0">${p.salary}</span>
                      <ChevronDown size={14} className={`opacity-30 shrink-0 transition-transform ${selectedPlayer?.id === p.id ? 'rotate-180' : ''}`} />
                    </button>
                  ))}
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
type PlayerType = 'sp' | 'rp' | 'power' | 'speed';
type BidTier = 'stash' | 'streamer' | 'contributor' | 'starter';

function inferPlayerType(pos: string[]): PlayerType {
  if (pos.includes('SP')) return 'sp';
  if (pos.includes('RP') || pos.includes('P')) return 'rp';
  if (pos.includes('C') || pos.includes('1B') || pos.includes('3B') || pos.includes('DH')) return 'power';
  return 'speed';
}

function deriveAvailablePlayers(freeAgents: LeaguePlayer[], leagueRoster: Record<string, LeaguePlayer[]> | null): LeaguePlayer[] {
  if (freeAgents.length > 0) return freeAgents;
  return [];
}

function AddDropPanel({
  faabBudget, onBudgetChange, roster, freeAgents, leagueRoster, categoryStandings, transactions, dataTimestamps,
}: {
  faabBudget: number; onBudgetChange: (n: number) => void;
  roster: Player[]; freeAgents: LeaguePlayer[];
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  categoryStandings: LiveCategoryStanding[] | null;
  transactions: TransactionEntry[] | null;
  dataTimestamps: Record<string, string>;
}) {
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<LeaguePlayer | null>(null);
  const [playerType, setPlayerType] = useState<PlayerType>('sp');
  const [bidTier, setBidTier]   = useState<BidTier>('contributor');
  const [showDropdown, setShowDropdown] = useState(false);

  const available = deriveAvailablePlayers(freeAgents, leagueRoster);
  const hasFAList = freeAgents.length > 0;

  const filtered = search.length >= 2
    ? available.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const handleSelect = (p: LeaguePlayer) => {
    setSelected(p);
    setSearch(p.name);
    setPlayerType(inferPlayerType(p.pos));
    setShowDropdown(false);
  };

  // Bid calc (simplified version of FAABView logic)
  const TIER_LABELS: Record<BidTier, string> = { stash: 'Stash', streamer: 'Streamer', contributor: 'Contributor', starter: 'Starter' };
  const BASE_BIDS: Record<PlayerType, Record<BidTier, number>> = {
    sp:    { stash: 5,  streamer: 12, contributor: 22, starter: 38 },
    rp:    { stash: 8,  streamer: 15, contributor: 25, starter: 40 },
    power: { stash: 5,  streamer: 10, contributor: 20, starter: 35 },
    speed: { stash: 6,  streamer: 12, contributor: 22, starter: 36 },
  };

  const weakCats = categoryStandings
    ? categoryStandings.filter(c => c.myRank > 8).map(c => c.category)
    : [];
  const urgencyMult = weakCats.length >= 3 ? 1.15 : weakCats.length >= 1 ? 1.07 : 1.0;
  const baseBid = BASE_BIDS[playerType][bidTier];
  const bid = Math.min(faabBudget - 1, Math.round(baseBid * urgencyMult));

  // Drop candidates: lowest-value active non-keeper players
  const activePlayers = roster.filter(p => !p.isMinor && !p.isReserve);
  const dropCandidates = activePlayers
    .filter(p => !p.contract.match(/^(K[123]|F)$/))
    .map(p => ({
      player: p,
      projValue: KEEPER_PROJECTIONS[p.name] ?? Math.round(p.salary * 0.7),
      overpaid: p.salary - (KEEPER_PROJECTIONS[p.name] ?? Math.round(p.salary * 0.7)),
    }))
    .sort((a, b) => b.overpaid - a.overpaid)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bid Calculator */}
      <div className="flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
          <h3 className="font-serif italic text-xl mb-4">FAAB Bid Calculator</h3>

          <div className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={hasFAList ? 'Search free agents...' : 'Upload FA list in Data tab first'}
              className="w-full border border-black/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F27D26]"
            />
            {showDropdown && filtered.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden">
                {filtered.map(p => (
                  <button key={p.name} onMouseDown={() => handleSelect(p)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8F8F8] text-left">
                    <span className="text-[10px] font-bold bg-black/5 rounded px-1.5 py-0.5">{p.pos.join('/')}</span>
                    <span className="text-sm flex-1">{p.name}</span>
                    <span className="text-[10px] opacity-40">{p.mlbTeam}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Player type */}
            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 font-bold tracking-widest">Player Type</p>
              <div className="grid grid-cols-2 gap-1">
                {(['sp','rp','power','speed'] as PlayerType[]).map(t => (
                  <button key={t} onClick={() => setPlayerType(t)} className={`py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${playerType === t ? 'bg-[#141414] text-white' : 'bg-black/5 hover:bg-black/10'}`}>
                    {t === 'sp' ? 'SP' : t === 'rp' ? 'RP' : t === 'power' ? 'Power' : 'Speed'}
                  </button>
                ))}
              </div>
            </div>
            {/* Bid tier */}
            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 font-bold tracking-widest">Role</p>
              <div className="flex flex-col gap-1">
                {(['stash','streamer','contributor','starter'] as BidTier[]).map(t => (
                  <button key={t} onClick={() => setBidTier(t)} className={`py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${bidTier === t ? 'bg-[#F27D26] text-white' : 'bg-black/5 hover:bg-black/10'}`}>
                    {TIER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#141414] text-white rounded-xl p-4 text-center">
            <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Suggested Bid</p>
            <p className="font-mono text-5xl font-bold text-[#F27D26]">${bid}</p>
            <p className="text-[10px] opacity-40 mt-1">{selected?.name || 'Player'} · {playerType.toUpperCase()} · {TIER_LABELS[bidTier]}</p>
            {weakCats.length > 0 && <p className="text-[10px] text-yellow-400 mt-1">+urgency boost ({weakCats.slice(0,3).join(', ')} weak)</p>}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t border-black/5">
            <span className="text-[10px] opacity-50">FAAB Budget</span>
            <EditableSidebarValue value={faabBudget} onChange={onBudgetChange} prefix="$" />
          </div>
        </div>
      </div>

      {/* Drop Candidates */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
        <h3 className="font-serif italic text-xl mb-1">Drop Candidates</h3>
        <p className="text-xs opacity-50 mb-4">Non-keeper players sorted by salary vs. projected value</p>
        <div className="flex flex-col gap-2">
          {dropCandidates.map(({ player: p, projValue, overpaid }) => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-[#F8F8F8] rounded-xl">
              <span className="text-[10px] font-bold bg-white rounded px-1.5 py-0.5 border border-black/5">{p.pos.join('/')}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-[10px] opacity-40">{p.team}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm">${p.salary}</p>
                <p className={`text-[10px] font-bold ${overpaid > 5 ? 'text-red-500' : overpaid > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                  {overpaid > 0 ? `$${overpaid} over` : `$${Math.abs(overpaid)} under`}
                </p>
              </div>
            </div>
          ))}
          {dropCandidates.length === 0 && (
            <p className="text-sm opacity-40 text-center py-4">All non-keeper players look reasonably priced</p>
          )}
        </div>
        <p className="text-[10px] opacity-30 mt-4 italic">*Based on KEEPER_PROJECTIONS. K/F contract players excluded.</p>
      </div>
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

function TradesView({
  roster,
  categoryStandings,
  leagueRoster,
}: {
  roster: Player[];
  categoryStandings: LiveCategoryStanding[] | null;
  leagueRoster: Record<string, LeaguePlayer[]> | null;
  key?: any;
}) {
  const ALL_TEAMS = Object.keys(ABBREV_TO_FULLNAME).sort();
  const [team1, setTeam1] = useState('EYJ');
  const [team2, setTeam2] = useState('');
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
}

const DATA_TYPES: Exclude<DataType, 'unknown'>[] = ['leagueroster', 'freeagents', 'roster', 'standings', 'transactions', 'faab', 'statcast', 'stuff'];
const TYPE_LABELS: Record<DataType, string> = {
  leagueroster: 'League Rosters (All Teams)',
  freeagents: 'Available Players (FA List)',
  roster: 'My Roster',
  standings: 'Standings',
  transactions: 'Transaction Log',
  faab: 'FAAB Bid Log',
  statcast: 'Statcast',
  stuff: 'Stuff+',
  unknown: '? Unknown',
};

function StrategyLabView({
  parsedRoster,
  parsedStatcast,
  parsedStuff,
}: {
  parsedRoster: Player[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  key?: any;
}) {
  const topEV = parsedStatcast ? [...parsedStatcast].sort((a, b) => (b.ev || 0) - (a.ev || 0)).slice(0, 3) : [];
  const topBarrel = parsedStatcast ? [...parsedStatcast].sort((a, b) => (b.barrelRate || 0) - (a.barrelRate || 0)).slice(0, 3) : [];
  const topStuff = parsedStuff ? [...parsedStuff].sort((a, b) => (b.stuffPlus || 0) - (a.stuffPlus || 0)).slice(0, 3) : [];

  const effectiveRoster = parsedRoster && parsedRoster.length > 0 ? parsedRoster : INITIAL_ROSTER;
  const lastN = (name: string) => name.toLowerCase().split(' ').slice(-1)[0].replace(/[^a-z]/g, '');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header>
        <h2 className="text-4xl font-serif italic mb-2">Strategy Lab</h2>
        <p className="text-sm opacity-60">Cap efficiency · process metrics · regression signals</p>
      </header>

      <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">Cap &amp; Market Efficiency</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SGP Heatmap */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl">SGP Heatmap (Efficiency)</h3>
            <BarChart3 size={18} className="opacity-30" />
          </div>
          <div className="flex flex-col gap-4">
            {SGP_HEATMAP.map((item, i) => (
              <div key={`${item.category}-${i}`} className="flex items-center gap-4">
                <div className="w-12 text-xs font-bold opacity-60">{item.category}</div>
                <div className="flex-1 h-8 bg-[#F8F8F8] rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all ${item.difficulty === 'Easy' ? 'bg-green-500' : item.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${(item.pointsToGain / 5) * 100}%` }}
                  />
                  <span className="absolute inset-y-0 left-4 flex items-center text-[10px] font-mono font-bold">
                    +{item.pointsToGain} Pts
                  </span>
                </div>
                <div className="w-20 text-[10px] font-bold uppercase tracking-tighter text-right opacity-50">{item.difficulty}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs opacity-50 italic">*HR is the most efficient category to target. Standings are tightly clustered in the 140-160 range.</p>
        </div>

        {/* Process Leaders */}
        <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl">Process Leaders</h3>
            <Zap size={18} className="text-[#F27D26]" />
          </div>
          <div className="flex flex-col gap-6">
            {parsedStatcast && parsedStatcast.length > 0 ? (
              <>
                <div>
                  <p className="text-[10px] uppercase opacity-50 mb-2">Top Exit Velocity (EV)</p>
                  <div className="flex flex-col gap-2">
                    {topEV.map((p, i) => (
                      <div key={`ev-${i}`} className="flex justify-between items-center">
                        <span className="text-sm font-bold">{p.player || p.name}</span>
                        <span className="font-mono text-[#F27D26]">{p.ev} mph</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-50 mb-2">Barrel Rate Leaders</p>
                  <div className="flex flex-col gap-2">
                    {topBarrel.map((p, i) => (
                      <div key={`barrel-${i}`} className="flex justify-between items-center">
                        <span className="text-sm font-bold">{p.player || p.name}</span>
                        <span className="font-mono text-[#F27D26]">{p.barrelRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-[10px] uppercase opacity-50 mb-2">Barrel Rate (90th Pct)</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">Kazuma Okamoto</span>
                    <span className="font-mono text-[#F27D26]">12.5%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-50 mb-2">Plate Discipline</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">Xavier Edwards</span>
                    <span className="font-mono text-[#F27D26]">85</span>
                  </div>
                </div>
              </>
            )}
            {parsedStuff && parsedStuff.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase opacity-50 mb-2">Stuff+ Leaders</p>
                <div className="flex flex-col gap-2">
                  {topStuff.map((p, i) => (
                    <div key={`stuff-${i}`} className="flex justify-between items-center">
                      <span className="text-sm font-bold">{p.player || p.name}</span>
                      <span className="font-mono text-[#F27D26]">{p.stuffPlus}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase opacity-50 mb-2">Stuff+ (Pitching+)</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">Garrett Crochet</span>
                  <span className="font-mono text-[#F27D26]">125</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regression Watch */}
      {(parsedStuff || parsedStatcast) && (
        <>
        <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold -mb-4">Process Metrics</p>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-serif italic text-xl">Regression Watch</h3>
            <span className="text-[10px] opacity-40 italic">Your roster vs. process metrics</span>
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
              {effectiveRoster
                .filter(p => p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos)) && !p.isMinor)
                .map(p => {
                  const match = parsedStuff.find(d => lastN(d.name) === lastN(p.name));
                  if (!match || (!match.stuffPlus && !match.pitchingPlus)) return null;
                  const gap = (match.pitchingPlus || 0) - (match.stuffPlus || 0);
                  const sig = gap > 8  ? { label: 'Sell window',  cls: 'text-orange-600 bg-orange-50' }
                            : gap < -8 ? { label: 'Buy low',      cls: 'text-green-700 bg-green-50'  }
                            :            { label: 'On track',     cls: 'text-gray-500 bg-gray-50'    };
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
                }).filter(Boolean)}
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
              {effectiveRoster
                .filter(p => !p.pos.some(pos => ['SP', 'RP', 'P'].includes(pos)) && !p.isMinor)
                .map(p => {
                  const match = parsedStatcast.find(d => lastN(d.name) === lastN(p.name));
                  if (!match || (!match.ev && !match.xwoba)) return null;
                  const xw = match.xwoba || 0;
                  const sig = xw > 0.380 ? { label: 'Elite process',  cls: 'text-green-700 bg-green-50'   }
                            : xw > 0.340 ? { label: 'Above avg',       cls: 'text-emerald-600 bg-emerald-50'}
                            : xw > 0.300 ? { label: 'Average',         cls: 'text-gray-500 bg-gray-50'     }
                            :              { label: 'Below avg',        cls: 'text-orange-600 bg-orange-50' };
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
                }).filter(Boolean)}
            </div>
          )}
        </div>
        </>
      )}

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

function AnalyticsView({ categoryStandings, faabBudget }: { categoryStandings: LiveCategoryStanding[] | null; faabBudget: number; key?: any }) {
  // Manual/fallback mode: user can enter their own rank per category
  const [manualRanks, setManualRanks] = useState<Record<string, number>>(
    Object.fromEntries(CATEGORY_PROJECTIONS.map(p => [p.cat, 6]))
  );
  const TOTAL_TEAMS = 12;

  // Build the display rows — prefer live data, fall back to manual
  const rows = CATEGORY_PROJECTIONS.map(proj => {
    const live = categoryStandings?.find(c => c.category === proj.cat);
    const denom = SGP_DENOMINATORS.find(s => s.cat === proj.cat);
    const rank = live ? live.myRank : (manualRanks[proj.cat] ?? 6);
    const pts = live ? live.myPts : (TOTAL_TEAMS - rank + 1);
    const ptsToNext = live ? live.ptsGapToNext : (rank > 1 ? 1 : 0);
    const ptsToFirst = live ? live.ptsGapToFirst : (rank - 1);

    return {
      cat: proj.cat,
      value: proj.value,
      rank,
      pts,
      ptsToNext,
      ptsToFirst,
      denomCost: denom?.denom ?? null,
      isLive: !!live,
    };
  });

  const batting  = rows.filter(r => ['HR','OBP','R','RBI','SB'].includes(r.cat));
  const pitching = rows.filter(r => ['ERA','INN','K','S','WHIP'].includes(r.cat));

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

  const GapTable = ({ label, data }: { label: string; data: typeof rows }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
        <h3 className="font-serif italic text-xl">{label}</h3>
        {!categoryStandings && (
          <span className="text-[10px] opacity-40 italic">Estimated — upload standings CSV for live data</span>
        )}
        {categoryStandings && (
          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Live</span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_1.2fr] gap-2 px-6 py-2 bg-[#F8F8F8] border-b border-black/10">
        <span className="col-header">Category</span>
        <span className="col-header">Rank</span>
        <span className="col-header">Pts</span>
        <span className="col-header">Gap Up</span>
        <span className="col-header">1 pt costs</span>
      </div>
      {data.map(r => (
        <div
          key={r.cat}
          className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr_1.2fr] gap-2 px-6 py-3 border-b border-black/5 items-center hover:bg-[#F8F8F8] transition-colors"
        >
          <span className="text-sm font-bold">{r.cat}</span>
          <div className="flex flex-col gap-1">
            <RankBar rank={r.rank} total={TOTAL_TEAMS} />
            {!categoryStandings && (
              <input
                type="number"
                min={1}
                max={TOTAL_TEAMS}
                value={manualRanks[r.cat] ?? 6}
                onChange={e => setManualRanks(prev => ({ ...prev, [r.cat]: Number(e.target.value) }))}
                className="w-10 text-[10px] font-mono border-b border-black/20 bg-transparent outline-none"
              />
            )}
          </div>
          <span className="font-mono text-sm">{r.pts.toFixed(1)}</span>
          <span className={`font-mono text-sm font-bold ${r.ptsToNext > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {r.ptsToNext > 0 ? `−${r.ptsToNext.toFixed(1)}` : '#1'}
          </span>
          <span className="text-xs opacity-60 font-mono">
            {r.denomCost != null
              ? `${r.denomCost} ${r.cat}`
              : '—'}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">SGP Gap Analysis</h2>
          <p className="text-sm opacity-60">Where you stand · what it costs to move up</p>
        </div>
      </header>

      <GapTable label="Batting" data={batting} />
      <GapTable label="Pitching" data={pitching} />

      {/* Supporting data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <h3 className="font-serif italic text-xl mb-4">SGP Denominators</h3>
          <p className="text-xs opacity-50 mb-4">Stats needed to gain 1 roto point in each category</p>
          <div className="grid grid-cols-2 gap-3">
            {SGP_DENOMINATORS.map((sgp, i) => (
              <div key={`${sgp.cat}-${i}`} className="flex justify-between items-center p-3 bg-[#F8F8F8] rounded-lg">
                <span className="text-xs font-bold opacity-60">{sgp.cat}</span>
                <span className="font-mono text-sm">{sgp.denom}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg">
          <h3 className="font-serif italic text-xl mb-1">FAAB Budget</h3>
          <p className="text-[10px] uppercase opacity-50 mb-5 tracking-widest">EYJ · $120 Starting</p>
          <div className="flex items-end gap-3 mb-4">
            <span className="font-mono text-5xl font-bold text-[#F27D26]">${faabBudget}</span>
            <span className="text-sm opacity-50 mb-1">remaining</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[#F27D26] rounded-full transition-all"
              style={{ width: `${(faabBudget / 120) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] opacity-50">
            <span>${120 - faabBudget} spent</span>
            <span>$120 total</span>
          </div>
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-[10px] uppercase opacity-50 mb-3 tracking-widest">League Draft Budgets</p>
            <div className="flex flex-col gap-1">
              {TEAM_BUDGETS.sort((a, b) => b.budget - a.budget).map((team, i) => (
                <div key={`${team.team}-${i}`} className="flex justify-between items-center px-2 py-1.5 hover:bg-white/5 rounded transition-colors">
                  <span className={`text-xs ${team.team === 'EYJ' ? 'font-bold text-[#F27D26]' : 'opacity-70'}`}>{team.team}</span>
                  <span className="font-mono text-xs opacity-70">${team.budget}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Data View ───────────────────────────────────────────────────────────────

function DataView({
  onDataLoaded,
  onResetData,
  onClearFreeAgents,
  dataTimestamps,
  parsedRoster,
  parsedStandings,
  parsedFaab,
  parsedStatcast,
  parsedStuff,
  leagueRoster,
  freeAgents,
  transactions,
}: {
  onDataLoaded: (type: DataType, rawData: any[], csvText: string) => void;
  onResetData: () => void;
  onClearFreeAgents?: () => void;
  dataTimestamps: Record<string, string>;
  parsedRoster: Player[] | null;
  parsedStandings: HistoricalStanding[] | null;
  parsedFaab: FaabEntry[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
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

  const stageFiles = async (files: FileList | File[]) => {
    const newStaged: StagedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.match(/\.(csv|txt)$/i)) continue;
      const csvText = await file.text();
      const { type, rowCount, confidence } = detectDataType(csvText);
      newStaged.push({
        id: `${Date.now()}-${i}`,
        name: file.name,
        csvText,
        rawFile: file,
        detectedType: type,
        assignedType: type === 'unknown' ? 'leagueroster' : type,
        rowCount,
        confidence,
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
      const csvText = await file.text();
      try {
        const rawData = await parseCSVText(csvText);
        onDataLoaded(forceType, rawData, csvText);
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
      onDataLoaded(staged.assignedType, rawData, staged.csvText);
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

  const hasAnyData = !!(parsedRoster || parsedStandings || parsedFaab || parsedStatcast || parsedStuff || leagueRoster || freeAgents.length > 0 || transactions);

  const dataStatus = [
    { key: 'leagueroster', label: 'League Rosters', active: !!leagueRoster, count: leagueRoster ? `${Object.keys(leagueRoster).length} teams` : null },
    { key: 'freeagents',   label: 'Available Players', active: freeAgents.length > 0, count: freeAgents.length > 0 ? `${freeAgents.length} players` : null },
    { key: 'standings',    label: 'Standings',      active: !!parsedStandings, count: null },
    { key: 'transactions', label: 'Transactions',   active: !!transactions, count: transactions ? `${transactions.length} entries` : null },
    { key: 'statcast',     label: 'Statcast',       active: !!parsedStatcast, count: parsedStatcast ? `${parsedStatcast.length} players` : null },
    { key: 'stuff',        label: 'Stuff+',         active: !!parsedStuff, count: parsedStuff ? `${parsedStuff.length} pitchers` : null },
  ] as const;

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
      label: 'Statcast (Baseball Savant)',
      desc: 'Leaderboards → Statcast Batting. Filter to min 100 PA. Export CSV.',
      icon: '⚾',
    },
    {
      type: 'stuff' as DataType,
      label: 'Stuff+ / Pitching+ (FanGraphs)',
      desc: 'Leaders → Pitching → "+ Stats" preset. Min 10 IP. Export CSV.',
      icon: '🔥',
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {dataStatus.map(({ key, label, active, count }) => (
          <div key={key} className={`p-4 rounded-xl border flex flex-col gap-2 ${active ? 'bg-green-50 border-green-200' : 'bg-white border-black/5'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-black/15'}`} />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-60">{active ? 'Live' : 'None'}</span>
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
                  <p className="text-xs font-bold truncate">{staged.name}</p>
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
          {EXT_SOURCES.map(src => {
            const loaded = dataStatus.find(d => d.key === src.type)?.active;
            const ts = dataTimestamps[src.type];
            return (
              <div key={src.type} className={`bg-white rounded-2xl border p-5 flex gap-4 ${loaded ? 'border-green-200' : 'border-black/5'}`}>
                <span className="text-2xl shrink-0">{src.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold">{src.label}</p>
                    {loaded && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">✓ Loaded</span>}
                  </div>
                  <p className="text-xs opacity-60 leading-relaxed mb-2">{src.desc}</p>
                  {loaded && ts && <p className="text-[10px] opacity-40 font-mono mb-2">{formatTs(ts)}</p>}
                  <button
                    onClick={() => openForcedUpload(src.type, true)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors ${loaded ? 'bg-black/5 text-black/50 hover:bg-black/10' : 'bg-[#F27D26] text-white hover:bg-[#d96a1d]'}`}
                  >
                    {loaded ? 'Re-upload' : 'Upload CSV'}
                  </button>
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

