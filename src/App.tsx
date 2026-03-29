import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  ArrowLeftRight,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Info,
  History,
  Target,
  Zap,
  BarChart3,
  Database,
  Loader2,
  X,
  Key,
  Pencil
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
  OWNER_BEHAVIORS,
  KEEPER_PROJECTIONS
} from './constants';
import { Player, HistoricalStanding, FaabEntry, LeagueDetails, LiveCategoryStanding } from './types';

import {
  mapRosterData,
  mapStandingsData,
  mapFaabData,
  mapStatcastData,
  mapStuffData,
  extractCategoriesFromOverall,
  extractRosterRulesFromRoster,
  parseCategoryStandings,
  detectDataType,
  parseCSVText,
  DataType
} from './services/dataService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'roster' | 'keepers' | 'faab' | 'trades' | 'analytics' | 'owners' | 'strategy'>('dashboard');
  const [parsedRoster, setParsedRoster] = useState<Player[] | null>(null);
  const [parsedStandings, setParsedStandings] = useState<HistoricalStanding[] | null>(null);
  const [parsedFaab, setParsedFaab] = useState<FaabEntry[] | null>(null);
  const [parsedStatcast, setParsedStatcast] = useState<any[] | null>(null);
  const [parsedStuff, setParsedStuff] = useState<any[] | null>(null);
  const [parsedLeagueDetails, setParsedLeagueDetails] = useState<LeagueDetails | null>(null);
  const [parsedCategoryStandings, setParsedCategoryStandings] = useState<LiveCategoryStanding[] | null>(null);
  const [faabBudget, setFaabBudget] = useState(92);

  // Central handler: apply parsed data by type. Used by both auto-load and manual import.
  const applyParsedData = (type: DataType, rawData: any[], csvText: string) => {
    if (type === 'roster') {
      setParsedRoster(mapRosterData(rawData));
      const { rules, salaryCap } = extractRosterRulesFromRoster(csvText);
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
  useEffect(() => { localStorage.setItem('eyj_faabBudget', String(faabBudget)); }, [faabBudget]);

  const handleResetData = () => {
    ['eyj_roster','eyj_standings','eyj_faab','eyj_statcast','eyj_stuff','eyj_leagueDetails','eyj_categoryStandings'].forEach(k => localStorage.removeItem(k));
    setParsedRoster(null);
    setParsedStandings(null);
    setParsedFaab(null);
    setParsedStatcast(null);
    setParsedStuff(null);
    setParsedLeagueDetails(null);
    setParsedCategoryStandings(null);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-[#141414] text-[#E4E3E0] p-6 flex flex-col gap-8">
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
            active={activeTab === 'roster'}
            onClick={() => setActiveTab('roster')}
            icon={<Users size={18} />}
            label="Roster"
          />
          <NavItem
            active={activeTab === 'keepers'}
            onClick={() => setActiveTab('keepers')}
            icon={<Key size={18} />}
            label="Keeper Calculator"
          />
          <NavItem
            active={activeTab === 'faab'}
            onClick={() => setActiveTab('faab')}
            icon={<DollarSign size={18} />}
            label="FAAB & Waivers"
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
            active={activeTab === 'owners'} 
            onClick={() => setActiveTab('owners')} 
            icon={<Info size={18} />} 
            label="Owner Profiles" 
          />
        </div>

        <div className="mt-auto pt-8 border-t border-white/10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] uppercase opacity-50">FAAB Budget</span>
            <EditableSidebarValue value={faabBudget} onChange={setFaabBudget} prefix="$" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase opacity-50">Salary Cap</span>
            <span className="font-mono text-lg">${(parsedLeagueDetails?.salaryCap ?? 260) - 1} / ${parsedLeagueDetails?.salaryCap ?? 260}</span>
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
          {activeTab === 'roster' && (
            <RosterView
              key="roster"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
            />
          )}
          {activeTab === 'keepers' && (
            <KeeperView
              key="keepers"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
              leagueDetails={parsedLeagueDetails}
            />
          )}
          {activeTab === 'faab' && (
            <FAABView
              key="faab"
              faabBudget={faabBudget}
              onBudgetChange={setFaabBudget}
              parsedFaab={parsedFaab}
              categoryStandings={parsedCategoryStandings}
            />
          )}
          {activeTab === 'trades' && (
            <TradesView
              key="trades"
              roster={(parsedRoster && parsedRoster.length > 0) ? parsedRoster : INITIAL_ROSTER}
              categoryStandings={parsedCategoryStandings}
            />
          )}
          {activeTab === 'strategy' && (
            <StrategyLabView
              key="strategy"
              onDataLoaded={applyParsedData}
              onResetData={handleResetData}
              parsedRoster={parsedRoster}
              parsedStandings={parsedStandings}
              parsedFaab={parsedFaab}
              parsedStatcast={parsedStatcast}
              parsedStuff={parsedStuff}
              leagueDetails={parsedLeagueDetails}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsView
              key="analytics"
              categoryStandings={parsedCategoryStandings}
            />
          )}
          {activeTab === 'owners' && <OwnersView key="owners" />}
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

function RosterView({ roster }: { roster: Player[], key?: any }) {
  const [filter, setFilter] = useState<'all' | 'batters' | 'pitchers' | 'minors'>('all');
  
  const players = roster.filter(p => {
    if (filter === 'minors') return p.isMinor;
    if (filter === 'batters') return !p.isMinor && !['SP', 'RP', 'P'].some(pos => p.pos.includes(pos));
    if (filter === 'pitchers') return !p.isMinor && ['SP', 'RP', 'P'].some(pos => p.pos.includes(pos));
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-center">
        <h2 className="text-4xl font-serif italic">Roster Management</h2>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-black/5">
          {(['all', 'batters', 'pitchers', 'minors'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-tighter transition-all ${
                filter === f ? 'bg-[#141414] text-white' : 'hover:bg-black/5 opacity-60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="data-row bg-[#F8F8F8] border-b border-black/10">
          <span className="col-header">Pos</span>
          <span className="col-header">Player</span>
          <span className="col-header">Contract</span>
          <span className="col-header">Salary</span>
          <span className="col-header">Notes</span>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {players.map((p, i) => (
            <div key={`${p.id}-${i}`} className="data-row group">
              <span className="text-xs font-bold opacity-60">{p.pos.join('/')}</span>
              <span className="text-sm font-medium">{p.name}</span>
              <span className="data-value text-xs">{p.contract}</span>
              <span className="data-value text-xs">${p.salary}</span>
              <span className="text-xs opacity-50 italic group-hover:opacity-100">{p.notes}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
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

type PlayerType = 'closer' | 'sp' | 'power' | 'speed' | 'rp';
type BidTier = 'impact' | 'contributor' | 'flyer';

const BID_BASE: Record<PlayerType, Record<BidTier, number>> = {
  closer:      { impact: 25, contributor: 15, flyer: 5  },
  sp:          { impact: 20, contributor: 11, flyer: 3  },
  power:       { impact: 22, contributor: 13, flyer: 4  },
  speed:       { impact: 20, contributor: 11, flyer: 3  },
  rp:          { impact: 10, contributor:  6, flyer: 2  },
};

const TYPE_CATEGORY: Record<PlayerType, string> = {
  closer: 'SV', sp: 'ERA', power: 'HR', speed: 'SB', rp: 'ERA',
};

function calcBid(
  type: PlayerType,
  tier: BidTier,
  budget: number,
  standings: LiveCategoryStanding[] | null
): { min: number; suggested: number; max: number; reason: string } {
  const base = BID_BASE[type][tier];
  const cat = TYPE_CATEGORY[type];
  const standing = standings?.find(c => c.category === cat);
  const urgency = standing && standing.myRank > 8 ? 1.4
                : standing && standing.myRank > 6 ? 1.2
                : 1.0;
  const raw = base * urgency;
  const capped = Math.min(raw, budget * 0.5);
  const reason = urgency > 1.2
    ? `+${Math.round((urgency - 1) * 100)}% urgency: ranked #${standing?.myRank} in ${cat}`
    : urgency > 1
    ? `+${Math.round((urgency - 1) * 100)}% moderate need in ${cat}`
    : `Standard market rate`;

  return {
    min: Math.max(1, Math.floor(capped * 0.75)),
    suggested: Math.round(capped),
    max: Math.min(budget, Math.ceil(capped * 1.3)),
    reason,
  };
}

function FAABView({
  faabBudget,
  onBudgetChange,
  parsedFaab,
  categoryStandings,
}: {
  faabBudget: number;
  onBudgetChange: (n: number) => void;
  parsedFaab: FaabEntry[] | null;
  categoryStandings: LiveCategoryStanding[] | null;
  key?: any;
}) {
  const [playerType, setPlayerType] = useState<PlayerType>('sp');
  const [bidTier, setBidTier]       = useState<BidTier>('contributor');
  const [playerName, setPlayerName] = useState('');

  const bid = calcBid(playerType, bidTier, faabBudget, categoryStandings);
  const spentPct = 100 - (faabBudget / 100) * 100;

  const TYPE_LABELS: Record<PlayerType, string> = {
    closer: 'Closer', sp: 'SP', power: 'Power bat', speed: 'Speed/OBP', rp: 'Setup RP',
  };
  const TIER_LABELS: Record<BidTier, string> = {
    impact: 'Impact (season-long)', contributor: 'Contributor', flyer: 'Flyer / spot',
  };

  // Derive dynamic waiver priorities from category standings
  const priorities: string[] = categoryStandings
    ? categoryStandings
        .filter(c => c.myRank > 7)
        .sort((a, b) => b.myRank - a.myRank)
        .slice(0, 3)
        .map(c => `Ranked #${c.myRank} in ${c.category} — target ${c.category} producers on wire.`)
    : [
        'Prioritize SP depth to cover Senga/Boyd injury risk.',
        'Save FAAB for mid-season closer churn (Suarez watch in ATL).',
        'Monitor 3B market if Okamoto struggles early.',
      ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">FAAB & Waivers</h2>
          <p className="text-sm opacity-60">Bid calculator · waiver priorities · transaction log</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-50 mb-1">Remaining Budget</p>
          <div className="flex items-center gap-1 justify-end">
            <span className="font-mono text-3xl">$</span>
            <input
              type="number"
              value={faabBudget}
              onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 0) onBudgetChange(n); }}
              className="font-mono text-3xl w-20 bg-transparent border-b-2 border-[#F27D26] outline-none text-right"
            />
          </div>
          <div className="w-24 h-1 bg-black/10 rounded-full mt-2 ml-auto">
            <div className="h-full bg-[#F27D26] rounded-full" style={{ width: `${100 - Math.min(spentPct, 100)}%` }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bid Calculator */}
        <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-serif italic text-xl">Bid Calculator</h3>
            <DollarSign size={18} className="text-[#F27D26]" />
          </div>

          <div className="flex flex-col gap-4 mb-6">
            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Player</p>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Player name..."
                className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F27D26] placeholder:opacity-30"
              />
            </div>

            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Type</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_LABELS) as PlayerType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setPlayerType(t)}
                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                      playerType === t ? 'bg-[#F27D26] text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Impact Level</p>
              <div className="flex flex-col gap-1">
                {(Object.keys(TIER_LABELS) as BidTier[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setBidTier(t)}
                    className={`text-xs font-medium px-3 py-2 rounded-lg text-left transition-all ${
                      bidTier === t ? 'bg-[#F27D26]/20 border border-[#F27D26]/50' : 'hover:bg-white/5'
                    }`}
                  >
                    {TIER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-[10px] uppercase opacity-50 mb-3 tracking-widest">
              {playerName || 'Player'} · {TYPE_LABELS[playerType]} · {TIER_LABELS[bidTier]}
            </p>
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[10px] opacity-40">Range</p>
                <p className="font-mono text-sm">${bid.min} – ${bid.max}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-40">Suggested</p>
                <p className="font-mono text-3xl text-[#F27D26]">${bid.suggested}</p>
              </div>
            </div>
            <p className="text-[10px] opacity-50 italic">{bid.reason}</p>
          </div>
        </div>

        {/* Waiver Priorities */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <h3 className="font-serif italic text-xl mb-5">
            Waiver Priorities
            {categoryStandings && (
              <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold not-italic">Live</span>
            )}
          </h3>
          <ul className="flex flex-col gap-4">
            {priorities.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <ChevronRight size={16} className="text-[#F27D26] shrink-0 mt-0.5" />
                <span className="opacity-80">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Transaction Log */}
      {parsedFaab && parsedFaab.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/5">
            <h3 className="font-serif italic text-xl">Transaction Log <span className="text-sm opacity-40 font-sans not-italic">({parsedFaab.length})</span></h3>
          </div>
          <div className="grid grid-cols-[1.5fr_0.8fr_1fr_0.6fr_0.6fr] gap-2 px-6 py-2 bg-[#F8F8F8] border-b border-black/10 text-[10px]">
            <span className="col-header">Player</span>
            <span className="col-header">Date</span>
            <span className="col-header">Team</span>
            <span className="col-header">Bid</span>
            <span className="col-header">Result</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {parsedFaab.slice(0, 50).map((entry, i) => (
              <div key={i} className="grid grid-cols-[1.5fr_0.8fr_1fr_0.6fr_0.6fr] gap-2 px-6 py-2.5 border-b border-black/5 items-center hover:bg-[#F8F8F8] transition-colors">
                <span className="text-sm font-medium">{entry.player}</span>
                <span className="text-xs opacity-50 font-mono">{entry.date}</span>
                <span className="text-xs opacity-70">{entry.team}</span>
                <span className="font-mono text-sm">${entry.bid}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                  entry.result === 'Won' ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-50'
                }`}>
                  {entry.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Trade Analyzer ───────────────────────────────────────────────────────────
// Stat profiles used to estimate each player's SGP contribution.
// Keys are player names; values are partial category contributions per season.
const PLAYER_SGP_PROFILES: Record<string, Partial<Record<string, number>>> = {
  'Freddie Freeman':        { HR: 22, R: 90, RBI: 95, SB: 5,  AVG: 0.282 },
  'Randy Arozarena':        { HR: 18, R: 78, RBI: 72, SB: 22, AVG: 0.256 },
  'Jarren Duran':           { HR: 16, R: 85, RBI: 68, SB: 28, AVG: 0.274 },
  'CJ Abrams':              { HR: 14, R: 82, RBI: 58, SB: 40, AVG: 0.262 },
  'Willy Adames':           { HR: 22, R: 70, RBI: 80, SB: 6,  AVG: 0.245 },
  'Kazuma Okamoto':         { HR: 28, R: 68, RBI: 85, SB: 2,  AVG: 0.258 },
  'Xavier Edwards':         { HR: 2,  R: 72, RBI: 40, SB: 42, AVG: 0.278 },
  'Garrett Crochet':        { ERA: 3.20, WHIP: 1.10, K: 220, W: 14, SV: 0 },
  'Kevin Gausman':          { ERA: 3.55, WHIP: 1.15, K: 185, W: 12, SV: 0 },
  'Raisel Iglesias':        { ERA: 2.90, WHIP: 1.05, K: 70,  W: 4,  SV: 28 },
  'Daniel Palencia':        { ERA: 3.10, WHIP: 1.12, K: 68,  W: 4,  SV: 28 },
  'Bryan Abreu':            { ERA: 3.40, WHIP: 1.18, K: 65,  W: 3,  SV: 12 },
  'Adolis Garcia':          { HR: 24, R: 72, RBI: 80, SB: 8,  AVG: 0.242 },
  'Josh Naylor':            { HR: 22, R: 68, RBI: 82, SB: 2,  AVG: 0.262 },
  'Byron Buxton':           { HR: 22, R: 70, RBI: 70, SB: 12, AVG: 0.252 },
  'Pete Crow-Armstrong':    { HR: 18, R: 78, RBI: 68, SB: 18, AVG: 0.258 },
  'Colton Cowser':          { HR: 16, R: 70, RBI: 62, SB: 8,  AVG: 0.250 },
  'Ranger Suarez':          { ERA: 3.70, WHIP: 1.22, K: 155, W: 11, SV: 0 },
  'Matthew Boyd':           { ERA: 3.90, WHIP: 1.25, K: 160, W: 10, SV: 0 },
  'Kodai Senga':            { ERA: 3.60, WHIP: 1.15, K: 175, W: 10, SV: 0 },
};

const BATTING_CATS  = ['HR', 'R', 'RBI', 'SB', 'AVG'];
const PITCHING_CATS = ['ERA', 'WHIP', 'K', 'W', 'SV'];
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

function TradesView({
  roster,
  categoryStandings,
}: {
  roster: Player[];
  categoryStandings: LiveCategoryStanding[] | null;
  key?: any;
}) {
  const allNames = roster.map(p => p.name);
  const [giving,  setGiving]  = useState<string[]>([]);
  const [getting, setGetting] = useState<string[]>([]);
  const [opponent, setOpponent] = useState('');

  const deltas = (giving.length > 0 || getting.length > 0)
    ? sgpDelta(giving, getting, categoryStandings)
    : [];

  const netSGP    = deltas.reduce((s, d) => s + d.delta, 0);
  const gains     = deltas.filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta);
  const losses    = deltas.filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta);
  const hasData   = giving.length > 0 && getting.length > 0;

  const verdict = !hasData ? null
    : netSGP >  0.8  ? { label: 'Strong Accept', cls: 'bg-green-100 text-green-800'  }
    : netSGP >  0.2  ? { label: 'Slight Win',    cls: 'bg-emerald-100 text-emerald-700' }
    : netSGP > -0.2  ? { label: 'Roughly Fair',  cls: 'bg-yellow-100 text-yellow-800' }
    : netSGP > -0.8  ? { label: 'Slight Loss',   cls: 'bg-orange-100 text-orange-700' }
    :                  { label: 'Pass',           cls: 'bg-red-100 text-red-700'       };

  const keeperNote = (name: string) => {
    const p = roster.find(r => r.name === name);
    if (!p) return null;
    if (p.contract.startsWith('M')) return `$${p.salary} Minor`;
    if (p.contract.startsWith('K')) return `$${p.salary} ${p.contract} keeper`;
    return `$${p.salary} (auction)`;
  };

  const PlayerPicker = ({
    label,
    selected,
    onChange,
  }: {
    label: string;
    selected: string[];
    onChange: (names: string[]) => void;
  }) => (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-widest opacity-50 mb-3 font-bold">{label}</p>
      <div className="flex flex-col gap-2">
        {selected.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={name}
              onChange={e => {
                const next = [...selected];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 text-sm border border-black/10 rounded-lg px-3 py-2 bg-[#F8F8F8] focus:outline-none focus:border-[#F27D26]"
            >
              <option value="">— pick player —</option>
              {allNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={() => onChange(selected.filter((_, j) => j !== i))}
              className="text-black/30 hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {/* Also allow typing names not on roster */}
        <button
          onClick={() => onChange([...selected, ''])}
          className="text-[10px] uppercase font-bold tracking-widest opacity-50 hover:opacity-100 text-left transition-opacity"
        >
          + Add player
        </button>
      </div>
      {selected.filter(Boolean).map(name => {
        const note = keeperNote(name);
        return note ? (
          <p key={name} className="text-[10px] opacity-40 mt-1">{name}: {note}</p>
        ) : null;
      })}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header>
        <h2 className="text-4xl font-serif italic mb-2">Trade Analyzer</h2>
        <p className="text-sm opacity-60">SGP-weighted delta · keeper implications · verdict</p>
      </header>

      {/* Builder */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <PlayerPicker label="You give" selected={giving} onChange={setGiving} />

          <div className="flex flex-col items-center gap-2 pt-6 shrink-0">
            <ArrowLeftRight size={28} className="text-[#F27D26]" />
            <input
              value={opponent}
              onChange={e => setOpponent(e.target.value)}
              placeholder="vs. Team..."
              className="text-[10px] font-bold text-center w-24 border-b border-black/20 bg-transparent outline-none focus:border-[#F27D26] placeholder:opacity-40"
            />
          </div>

          <PlayerPicker label="You receive" selected={getting} onChange={setGetting} />
        </div>
      </div>

      {/* Results */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SGP breakdown */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-black/5">
            <h3 className="font-serif italic text-xl mb-5">SGP Category Impact</h3>
            {deltas.length === 0 ? (
              <p className="text-sm opacity-40 italic">No stat profiles found for selected players — add them to PLAYER_SGP_PROFILES in constants.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {[...gains, ...losses].map(d => {
                  const pct = Math.min(Math.abs(d.delta) / 2, 1) * 100;
                  return (
                    <div key={d.cat} className="flex items-center gap-3">
                      <span className="w-12 text-xs font-bold opacity-60">{d.cat}</span>
                      <div className="flex-1 h-6 bg-[#F8F8F8] rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${d.delta > 0 ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-mono font-bold">
                          {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)} SGP
                        </span>
                      </div>
                      {d.context === 'Need' && (
                        <span className="text-[10px] text-red-500 font-bold uppercase w-12 shrink-0">Need</span>
                      )}
                      {d.context === 'Strong' && (
                        <span className="text-[10px] text-green-600 font-bold uppercase w-12 shrink-0">Strong</span>
                      )}
                    </div>
                  );
                })}
                <div className="mt-2 pt-4 border-t border-black/5 flex justify-between items-center">
                  <span className="text-sm font-bold">Net SGP</span>
                  <span className={`font-mono text-lg font-bold ${netSGP > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {netSGP > 0 ? '+' : ''}{netSGP.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Verdict */}
          <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-lg flex flex-col gap-5">
            <h3 className="font-serif italic text-xl">Verdict</h3>
            {verdict && (
              <span className={`text-sm font-bold px-4 py-2 rounded-full w-fit ${verdict.cls}`}>
                {verdict.label}
              </span>
            )}
            <div>
              <p className="text-[10px] uppercase opacity-50 mb-2 tracking-widest">Keeper Impact</p>
              {getting.filter(Boolean).map(name => {
                const p = roster.find(r => r.name === name);
                const note = keeperNote(name);
                if (!p) return null;
                return (
                  <div key={name} className="text-sm mb-1">
                    <span className="font-bold">{name}</span>
                    <span className="opacity-50 ml-1">{note}</span>
                  </div>
                );
              })}
              {getting.filter(Boolean).every(n => !roster.find(r => r.name === n)) && (
                <p className="text-xs opacity-40 italic">No keeper data — player not on roster</p>
              )}
            </div>
            {!categoryStandings && (
              <p className="text-[10px] opacity-40 italic mt-auto">
                Upload standings CSV to weight verdict by your category needs.
              </p>
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

const DATA_TYPES: Exclude<DataType, 'unknown'>[] = ['roster', 'standings', 'faab', 'statcast', 'stuff'];
const TYPE_LABELS: Record<DataType, string> = {
  roster: 'Roster',
  standings: 'Standings',
  faab: 'FAAB Log',
  statcast: 'Statcast',
  stuff: 'Stuff+',
  unknown: '? Unknown',
};

function StrategyLabView({
  onDataLoaded,
  onResetData,
  parsedRoster,
  parsedStandings,
  parsedFaab,
  parsedStatcast,
  parsedStuff,
  leagueDetails
}: {
  onDataLoaded: (type: DataType, rawData: any[], csvText: string) => void;
  onResetData: () => void;
  parsedRoster: Player[] | null;
  parsedStandings: HistoricalStanding[] | null;
  parsedFaab: FaabEntry[] | null;
  parsedStatcast: any[] | null;
  parsedStuff: any[] | null;
  leagueDetails: LeagueDetails | null;
  key?: any;
}) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteType, setPasteType] = useState<Exclude<DataType, 'unknown'>>('stuff');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'stearns' | 'sarris'>('stearns');

  const topEV = parsedStatcast ? [...parsedStatcast].sort((a, b) => (b.ev || 0) - (a.ev || 0)).slice(0, 3) : [];
  const topBarrel = parsedStatcast ? [...parsedStatcast].sort((a, b) => (b.barrelRate || 0) - (a.barrelRate || 0)).slice(0, 3) : [];
  const topStuff = parsedStuff ? [...parsedStuff].sort((a, b) => (b.stuffPlus || 0) - (a.stuffPlus || 0)).slice(0, 3) : [];

  const effectiveRoster = parsedRoster && parsedRoster.length > 0 ? parsedRoster : INITIAL_ROSTER;
  const lastN = (name: string) => name.toLowerCase().split(' ').slice(-1)[0].replace(/[^a-z]/g, '');

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
        assignedType: type === 'unknown' ? 'stuff' : type,
        rowCount,
        confidence,
      });
    }
    setStagedFiles(prev => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">Strategy Lab</h2>
          <p className="text-sm opacity-60">Advanced Process Metrics & Market Efficiency</p>
        </div>
        <div className="flex gap-2">
          {(['stearns', 'sarris'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest transition-all ${
                mode === m
                  ? m === 'stearns' ? 'bg-[#F27D26] text-white' : 'bg-[#141414] text-white'
                  : 'bg-white/60 text-black/50 hover:text-black/80'
              }`}
            >
              {m} Mode
            </button>
          ))}
        </div>
      </header>

      {/* Data Status Bar */}
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-wrap gap-6 items-center">
        {[
          { label: 'Roster', active: !!parsedRoster },
          { label: 'Standings', active: !!parsedStandings },
          { label: 'FAAB Logs', active: !!parsedFaab },
          { label: 'Statcast', active: !!parsedStatcast },
          { label: 'Stuff+', active: !!parsedStuff },
          { label: 'League Details', active: !!leagueDetails },
        ].map(({ label, active }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-yellow-500 opacity-50'}`} />
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">{label}:</span>
            <span className="text-[10px] font-mono">{active ? 'Live' : 'Mock'}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-[10px] opacity-40 italic">*Strategy engine prioritizes live CSV data over mock projections.</span>
          {(parsedRoster || parsedStandings || parsedFaab || parsedStatcast || parsedStuff) && (
            <button onClick={onResetData} className="text-[10px] uppercase font-bold tracking-widest text-red-400 hover:text-red-300 transition-colors">
              Reset Data
            </button>
          )}
        </div>
      </div>

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

      {/* Regression Watch — Sarris mode shows this prominently, Stearns mode folds it below */}
      {(parsedStuff || parsedStatcast) && (
        <div className={`bg-white p-6 rounded-2xl shadow-sm border border-black/5 ${mode === 'stearns' ? 'order-last' : ''}`}>
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Efficiency */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <h3 className="font-serif italic text-xl mb-6">Market Efficiency (Owner Behavior)</h3>
          <div className="flex flex-col gap-4">
            {OWNER_BEHAVIORS.map((owner, i) => (
              <div key={`${owner.team}-${i}`} className="p-4 rounded-xl bg-[#F8F8F8] flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold">{owner.team}</p>
                  <p className="text-[10px] opacity-60">Targets: {owner.preferredCategories.join(', ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase opacity-50">Aggression</p>
                  <p className={`font-mono font-bold ${owner.aggression > 80 ? 'text-red-500' : 'text-green-600'}`}>
                    {owner.aggression}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Import */}
        <div className="bg-[#F27D26] text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Database size={24} />
            <h3 className="font-serif italic text-xl">Import Data</h3>
          </div>
          <p className="text-sm mb-4 opacity-90">
            Drop any CSV — type is detected from column headers, not filename.
          </p>

          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.txt"
          />

          {/* Drop Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragOver ? 'border-white bg-white/20' : 'border-white/30 hover:border-white/60 hover:bg-white/5'}`}
          >
            <Database size={22} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold uppercase tracking-widest">Drop CSVs here</p>
            <p className="text-[10px] opacity-60 mt-1">or click to browse — any filename works</p>
          </div>

          {/* Staged Files */}
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
                    <p className="text-[10px] opacity-50">{staged.rowCount} rows</p>
                  </div>
                  {staged.confidence === 'low' && (
                    <span className="text-yellow-300 text-[10px] font-bold shrink-0" title="Low confidence — please verify type">!</span>
                  )}
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

          {/* Data Guide */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <p className="text-[10px] uppercase opacity-50 mb-3 tracking-widest">Data Sources</p>
            <div className="flex flex-col gap-3 text-[10px]">
              <div>
                <p className="font-bold text-white/90">Baseball Savant (Statcast)</p>
                <p className="opacity-60 leading-relaxed">Leaderboards → Statcast → Batting or Exit Velocity. Export CSV.</p>
              </div>
              <div>
                <p className="font-bold text-white/90">FanGraphs (Stuff+)</p>
                <p className="opacity-60 leading-relaxed">Leaders → Pitching → "+ Stats" preset. Export CSV.</p>
              </div>
              <div>
                <p className="font-bold text-white/90">CBS / League Site</p>
                <p className="opacity-60 leading-relaxed">Export Standings, Rosters, and Transaction History (FAAB).</p>
              </div>
            </div>
          </div>
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

// ─── Keeper Calculator ────────────────────────────────────────────────────────

type KeeperItem = {
  player: Player;
  projValue: number;
  discount: number;
  keeping: boolean;
};

function KeeperView({ roster, leagueDetails }: { roster: Player[]; leagueDetails: LeagueDetails | null; key?: any }) {
  const salaryCap = leagueDetails?.salaryCap || 260;
  const activeRosterSize = leagueDetails?.rosterRules.active || 22;

  const [projections, setProjections] = useState<Record<string, number>>(() =>
    Object.fromEntries(roster.map(p => [p.name, KEEPER_PROJECTIONS[p.name] ?? 0]))
  );
  const [keepDecisions, setKeepDecisions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      roster
        .filter(p => p.contract.startsWith('K') || p.contract.startsWith('M'))
        .map(p => [p.name, true])
    )
  );
  const [sortBy, setSortBy] = useState<'discount' | 'salary' | 'value'>('discount');

  const buildItems = (players: Player[]): KeeperItem[] =>
    players
      .map(p => ({
        player: p,
        projValue: projections[p.name] ?? 0,
        discount: (projections[p.name] ?? 0) - p.salary,
        keeping: keepDecisions[p.name] ?? true,
      }))
      .sort((a, b) =>
        sortBy === 'salary' ? a.player.salary - b.player.salary :
        sortBy === 'value'  ? b.projValue - a.projValue :
        b.discount - a.discount
      );

  const kItems  = buildItems(roster.filter(p => p.contract.startsWith('K')));
  const mItems  = buildItems(roster.filter(p => p.contract.startsWith('M')));
  const allKept = [...kItems, ...mItems].filter(k => k.keeping);

  const totalKeeperSalary = allKept.reduce((s, k) => s + k.player.salary, 0);
  const remainingCap      = salaryCap - totalKeeperSalary;
  const auctionSpots      = Math.max(0, activeRosterSize - allKept.length);
  const avgPerSpot        = auctionSpots > 0 ? remainingCap / auctionSpots : 0;
  const totalDiscount     = kItems.filter(k => k.keeping).reduce((s, k) => s + Math.max(0, k.discount), 0);

  const verdict = (item: KeeperItem, isMinors: boolean) => {
    if (isMinors)            return { label: 'Auto-Keep',    cls: 'text-green-700 bg-green-50'   };
    if (item.discount >= 15) return { label: 'Strong Keep',  cls: 'text-green-700 bg-green-50'   };
    if (item.discount >= 5)  return { label: 'Keep',         cls: 'text-emerald-600 bg-emerald-50'};
    if (item.discount >= 0)  return { label: 'Borderline',   cls: 'text-yellow-700 bg-yellow-50' };
    return                          { label: 'Release',      cls: 'text-red-600 bg-red-50'       };
  };

  const Row = ({ item, isMinors }: { item: KeeperItem; isMinors: boolean }) => {
    const v = verdict(item, isMinors);
    return (
      <div className={`keeper-row group ${!item.keeping ? 'opacity-35' : ''}`}>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={item.keeping}
            onChange={e => setKeepDecisions(prev => ({ ...prev, [item.player.name]: e.target.checked }))}
            className="w-4 h-4 accent-[#F27D26] cursor-pointer"
          />
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{item.player.name}</p>
          <p className="text-[10px] opacity-40">{item.player.pos.join('/')} · {item.player.team}</p>
        </div>
        <span className="text-xs font-bold opacity-50">{item.player.contract}</span>
        <span className="font-mono text-sm">${item.player.salary}</span>
        <EditableValue
          value={item.projValue}
          onChange={v => setProjections(prev => ({ ...prev, [item.player.name]: v }))}
        />
        <span className={`font-mono text-sm font-bold ${item.discount >= 10 ? 'text-green-600' : item.discount >= 0 ? 'text-yellow-600' : 'text-red-500'}`}>
          {item.discount > 0 ? '+' : ''}{item.discount}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${v.cls}`}>{v.label}</span>
      </div>
    );
  };

  const TableShell = ({ title, items, isMinors }: { title: string; items: KeeperItem[]; isMinors: boolean }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-black/5 flex justify-between items-center">
        <h3 className="font-serif italic text-xl">{title} <span className="text-sm opacity-40 font-sans not-italic">({items.length})</span></h3>
        {!isMinors && <p className="text-[10px] opacity-40 italic">Click projected value to edit</p>}
      </div>
      <div className="keeper-row bg-[#F8F8F8] border-b border-black/10">
        <span />
        <span className="col-header">Player</span>
        <span className="col-header">Yr</span>
        <span className="col-header">Keep $</span>
        <span className="col-header">Proj $</span>
        <span className="col-header">+/−</span>
        <span className="col-header">Verdict</span>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {items.map((item, i) => <Row key={`${item.player.id}-${i}`} item={item} isMinors={isMinors} />)}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-serif italic mb-2">Keeper Calculator</h2>
          <p className="text-sm opacity-60">Cap impact · keeper discount · auction budget</p>
        </div>
        <div className="flex gap-2">
          {(['discount', 'salary', 'value'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                sortBy === s ? 'bg-[#141414] text-white' : 'bg-white border border-black/10 opacity-60 hover:opacity-100'
              }`}
            >
              {s === 'discount' ? 'By Discount' : s === 'salary' ? 'By Salary' : 'By Value'}
            </button>
          ))}
        </div>
      </header>

      {/* Cap Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141414] text-white p-5 rounded-2xl">
          <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Keeper Salary</p>
          <p className="text-3xl font-mono">${totalKeeperSalary}</p>
          <p className="text-[10px] opacity-40 mt-1">of ${salaryCap} cap</p>
        </div>
        <div className={`p-5 rounded-2xl border ${remainingCap < 60 ? 'bg-red-50 border-red-200' : 'bg-white border-black/5'}`}>
          <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Auction Budget</p>
          <p className={`text-3xl font-mono ${remainingCap < 60 ? 'text-red-600' : ''}`}>${remainingCap}</p>
          <p className="text-[10px] opacity-40 mt-1">for {auctionSpots} remaining spots</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-black/5">
          <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Avg Per Spot</p>
          <p className="text-3xl font-mono">${avgPerSpot.toFixed(0)}</p>
          <p className="text-[10px] opacity-40 mt-1">{auctionSpots} open auction slots</p>
        </div>
        <div className="bg-[#F27D26] text-white p-5 rounded-2xl">
          <p className="text-[10px] uppercase opacity-50 mb-1 tracking-widest">Total Discount</p>
          <p className="text-3xl font-mono">+${totalDiscount}</p>
          <p className="text-[10px] opacity-40 mt-1">vs. open auction prices</p>
        </div>
      </div>

      <TableShell title="Active Keepers" items={kItems} isMinors={false} />
      {mItems.length > 0 && <TableShell title="Minor League Keepers" items={mItems} isMinors={true} />}
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

function AnalyticsView({ categoryStandings }: { categoryStandings: LiveCategoryStanding[] | null; key?: any }) {
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

  const batting  = rows.filter(r => ['HR','R','RBI','SB','AVG','OBP'].includes(r.cat));
  const pitching = rows.filter(r => ['ERA','WHIP','K','W','SV','INN'].includes(r.cat));

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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
          <h3 className="font-serif italic text-xl mb-4">Auction Budgets</h3>
          <div className="flex flex-col gap-1">
            {TEAM_BUDGETS.sort((a, b) => b.budget - a.budget).map((team, i) => (
              <div key={`${team.team}-${i}`} className="flex justify-between items-center px-3 py-2 hover:bg-[#F8F8F8] rounded transition-colors">
                <span className={`text-sm ${team.team === 'EYJ' ? 'font-bold text-[#F27D26]' : ''}`}>{team.team}</span>
                <span className="font-mono text-sm">${team.budget}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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

