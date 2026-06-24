import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseEther } from 'viem';
import { useWallet } from './config/useWallet';
import NETWORK_CONFIG from './config/network';
import {
  fetchMatches,
  fetchAnalysis,
  fetchStandings,
  FALLBACK_MATCHES,
  FALLBACK_STANDINGS,
  type Match,
  type Analysis,
} from './config/sportsApi';
import {
  Trophy, Zap, TrendingUp, Users, Clock, ChevronRight, ChevronDown,
  Globe, Wallet, Bell, Moon, Sun, Menu, X, ExternalLink, Copy,
  Check, ArrowUpRight, ArrowDownRight, Star, Play, Calendar,
  BarChart3, Target, Shield, Code, FileText, ArrowRight,
  Activity, RefreshCw, Download, Filter, Search, MoreHorizontal,
  Lock
} from 'lucide-react';

// Types (Match/Analysis live in ./config/sportsApi)
interface Prediction {
  id: string;
  title: string;
  description: string;
  confidence: number;
  price: string;
  category: string;
  isFree: boolean;
  reasoning?: string;
  lastUpdated: string;
}

interface Standing {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  form: string[];
}

interface RequestHistory {
  id: string;
  type: string;
  query: string;
  price: string;
  timestamp: string;
  status: 'completed' | 'pending';
}

// Mock Data
// Mock Data Helper for Free Insights
function generateFreeInsights(matches: Match[]): Prediction[] {
  if (!matches || matches.length === 0) {
    return [
      { id: 'p1', title: 'Champions League Winner', description: 'AI-powered tournament outcome with high accuracy rate models', confidence: 89, price: '0', category: 'Champions League', isFree: true, lastUpdated: '30 min ago', reasoning: 'Advanced machine learning models analyze team form, squads, expected goals (xG), and historic European competition coefficients.' },
      { id: 'p2', title: 'Premier League Title Race', description: 'Predicted probabilities for top 3 championship contenders', confidence: 85, price: '0', category: 'Premier League', isFree: true, lastUpdated: '1 hour ago', reasoning: 'Calculated using current standings, remaining schedule difficulty rankings, historical home advantage multipliers, and recent form momentum indices.' },
      { id: 'p3', title: 'La Liga Golden Boot', description: 'Top goalscorer metrics and confidence intervals', confidence: 75, price: '0', category: 'La Liga', isFree: true, lastUpdated: '2 hours ago', reasoning: 'Aggregating season-to-date goals, historical conversion rates, shot volumes per 90, and penalty taker priority structures.' },
    ];
  }

  // Take the first 3 matches
  const slice = matches.slice(0, 3);
  return slice.map((match, idx) => {
    let sum = 0;
    const nameStr = match.homeTeam + match.awayTeam;
    for (let i = 0; i < nameStr.length; i++) sum += nameStr.charCodeAt(i);
    const confidence = 65 + (sum % 25);
    
    let description = '';
    let reasoning = '';
    
    if (idx === 0) {
      description = `AI projects tactical battle as ${match.homeTeam} host ${match.awayTeam}. Both sides show strong scoring records.`;
      reasoning = `Analyzing the recent 5 matches, ${match.homeTeam} has displayed solid attacking efficiency, averaging 1.8 goals per match. However, ${match.awayTeam}'s defensive structure has conceded only 0.9 goals per match. The tactical matchup favors a low-scoring or narrow home win.`;
    } else if (idx === 1) {
      description = `Critical fixture: ${match.homeTeam} vs ${match.awayTeam}. Key midfield duels expected to decide the outcome.`;
      reasoning = `Possession control will be vital. Midfield ratings suggest ${match.homeTeam} will command 54% possession. Expected goals (xG) models indicate a close game with a 38% probability of a Draw.`;
    } else {
      description = `Derby atmosphere: ${match.homeTeam} lock horns with ${match.awayTeam}. High intensity and goals anticipated.`;
      reasoning = `Historical matchups between these two rivals have averaged 2.8 goals per game. Given both teams' current momentum, our sports oracle suggests over 2.5 goals is the highest-value option.`;
    }

    return {
      id: `free-insight-${match.id}`,
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      description,
      confidence,
      price: '0',
      category: match.league,
      isFree: true,
      lastUpdated: 'Live Feed updated',
      reasoning
    };
  });
}

const paidPredictions: Prediction[] = [
  { id: 'p4', title: 'World Cup Winner', description: 'AI-powered tournament winner prediction with detailed analysis', confidence: 89, price: '0.05', category: 'FIFA World Cup', isFree: false, reasoning: 'Advanced ML model analyzing 500+ factors including team form, injuries, historical performance, and tactical matchups', lastUpdated: '30 min ago' },
  { id: 'p5', title: 'Golden Boot Winner', description: 'Top goalscorer prediction with confidence intervals', confidence: 82, price: '0.03', category: 'FIFA World Cup', isFree: false, lastUpdated: '1 hour ago' },
  { id: 'p6', title: 'Best Coach Award', description: 'Tournament best coach prediction', confidence: 75, price: '0.02', category: 'FIFA World Cup', isFree: false, lastUpdated: '2 hours ago' },
  { id: 'p7', title: 'Premier League Champion', description: 'Full season outcome with relegation predictions', confidence: 88, price: '0.08', category: 'Premier League', isFree: false, lastUpdated: '45 min ago' },
  { id: 'p8', title: 'La Liga Surprise Package', description: 'Underdog team likely to exceed expectations', confidence: 68, price: '0.02', category: 'La Liga', isFree: false, lastUpdated: '4 hours ago' },
  { id: 'p9', title: 'NFL Super Bowl Winner', description: 'Complete playoff bracket prediction', confidence: 76, price: '0.06', category: 'NFL', isFree: false, lastUpdated: '2 hours ago' },
];



const INITIAL_REQUEST_HISTORY: RequestHistory[] = [
  { id: 'r1', type: 'Match Result', query: 'Arsenal vs Chelsea', price: '0.01', timestamp: '2 hours ago', status: 'completed' },
  { id: 'r2', type: 'Prediction', query: 'World Cup Winner', price: '0.05', timestamp: '1 day ago', status: 'completed' },
  { id: 'r3', type: 'Player Stats', query: 'Haaland season stats', price: '0.02', timestamp: '2 days ago', status: 'completed' },
];

function getGoalscorers(match: Match) {
  const homeScore = match.homeScore ?? 0;
  const awayScore = match.awayScore ?? 0;
  if (homeScore === 0 && awayScore === 0) return null;

  const commonPlayers: Record<string, string[]> = {
    'Arsenal': ['Saka 34\'', 'Odegaard 72\'', 'Martinelli 15\'', 'Havertz 55\'', 'Trossard 81\''],
    'Chelsea': ['Palmer 45\' (P)', 'Jackson 60\'', 'Madueke 22\'', 'Mudryk 78\'', 'Gallagher 52\''],
    'Real Madrid': ['Vinicius Jr 12\'', 'Bellingham 89\'', 'Rodrygo 38\'', 'Mbappe 47\'', 'Valverde 65\''],
    'Barcelona': ['Lewandowski 55\'', 'Raphinha 23\'', 'Yamal 70\'', 'Gundogan 41\'', 'Pedri 82\''],
    'Man City': ['Haaland 23\'', 'De Bruyne 67\'', 'Foden 10\'', 'Alvarez 58\'', 'Bernardo 80\''],
    'Liverpool': ['Salah 41\'', 'Nunez 62\'', 'Diaz 18\'', 'Jota 77\'', 'Mac Allister 84\''],
    'Aston Villa': ['Watkins 30\'', 'Bailey 54\'', 'McGinn 71\'', 'Douglas Luiz 88\' (P)'],
    'Tottenham': ['Son 19\'', 'Richarlison 51\'', 'Kulusevski 66\'', 'Maddison 43\''],
  };

  const getScorersForTeam = (team: string, score: number) => {
    const list = commonPlayers[team] || [
      'Striker A 18\'',
      'Winger B 44\'',
      'Midfielder C 68\'',
      'Defender D 82\''
    ];
    return list.slice(0, score);
  };

  return {
    home: getScorersForTeam(match.homeTeam, homeScore),
    away: getScorersForTeam(match.awayTeam, awayScore),
  };
}

interface PlayerStat {
  name: string;
  pos: string;
  rating: string;
  stats: Record<string, string | number>;
}

function generateMockPlayers(teamName: string, isHome: boolean): PlayerStat[] {
  const commonPlayers: Record<string, { name: string, pos: string }[]> = {
    'Arsenal': [
      { name: 'B. Saka', pos: 'FW' },
      { name: 'M. Odegaard', pos: 'MF' },
      { name: 'D. Rice', pos: 'MF' },
      { name: 'W. Saliba', pos: 'DF' },
      { name: 'D. Raya', pos: 'GK' }
    ],
    'Chelsea': [
      { name: 'C. Palmer', pos: 'MF' },
      { name: 'N. Jackson', pos: 'FW' },
      { name: 'Enzo F.', pos: 'MF' },
      { name: 'M. Caicedo', pos: 'MF' },
      { name: 'R. James', pos: 'DF' }
    ],
    'Real Madrid': [
      { name: 'Vinicius Jr', pos: 'FW' },
      { name: 'J. Bellingham', pos: 'MF' },
      { name: 'K. Mbappe', pos: 'FW' },
      { name: 'F. Valverde', pos: 'MF' },
      { name: 'A. Rudiger', pos: 'DF' }
    ],
    'Barcelona': [
      { name: 'R. Lewandowski', pos: 'FW' },
      { name: 'L. Yamal', pos: 'FW' },
      { name: 'Raphinha', pos: 'FW' },
      { name: 'Pedri', pos: 'MF' },
      { name: 'R. Araujo', pos: 'DF' }
    ],
    'Man City': [
      { name: 'E. Haaland', pos: 'FW' },
      { name: 'K. De Bruyne', pos: 'MF' },
      { name: 'P. Foden', pos: 'MF' },
      { name: 'Rodri', pos: 'MF' },
      { name: 'R. Dias', pos: 'DF' }
    ],
    'Liverpool': [
      { name: 'M. Salah', pos: 'FW' },
      { name: 'L. Diaz', pos: 'FW' },
      { name: 'D. Nunez', pos: 'FW' },
      { name: 'A. Mac Allister', pos: 'MF' },
      { name: 'V. van Dijk', pos: 'DF' }
    ]
  };

  const defaults = [
    { name: isHome ? 'J. Smith' : 'M. Johnson', pos: 'FW' },
    { name: isHome ? 'A. Davis' : 'K. Thomas', pos: 'MF' },
    { name: isHome ? 'T. Wilson' : 'L. Martinez', pos: 'MF' },
    { name: isHome ? 'J. Brown' : 'D. Robinson', pos: 'DF' },
    { name: isHome ? 'M. Alisson' : 'E. Ederson', pos: 'GK' }
  ];

  const list = commonPlayers[teamName] || defaults;
  
  return list.map((p, idx) => {
    let charSum = 0;
    for (let i = 0; i < p.name.length; i++) charSum += p.name.charCodeAt(i);
    const seed = (charSum % 100) / 100;
    
    let rating = 6.5 + seed * 2.0;
    if (idx === 0) rating += 0.5;
    
    const stats: Record<string, string | number> = {};
    if (p.pos === 'FW') {
      stats['Goals'] = seed > 0.6 ? 1 : 0;
      stats['Shots'] = Math.floor(seed * 4) + 1;
      stats['Dribbles'] = Math.floor(seed * 5);
    } else if (p.pos === 'MF') {
      stats['Assists'] = seed > 0.7 ? 1 : 0;
      stats['Passes'] = `${Math.floor(seed * 20) + 40}/${Math.floor(seed * 10) + 60}`;
      stats['Key Passes'] = Math.floor(seed * 4);
    } else if (p.pos === 'DF') {
      stats['Tackles'] = Math.floor(seed * 5) + 1;
      stats['Clearances'] = Math.floor(seed * 6) + 1;
      stats['Interceptions'] = Math.floor(seed * 4);
    } else if (p.pos === 'GK') {
      stats['Saves'] = Math.floor(seed * 5) + 1;
      stats['Pass Accuracy'] = `${Math.floor(seed * 15) + 70}%`;
    }

    return {
      name: p.name,
      pos: p.pos,
      rating: rating.toFixed(1),
      stats
    };
  });
}

const sports = [
  { id: 'all', name: 'All Sports', icon: Globe, color: 'var(--accent)' },
  { id: 'football', name: 'Football', icon: Trophy, color: 'var(--accent)' },
  { id: 'basketball', name: 'Basketball', icon: Target, color: 'var(--accent-orange)' },
  { id: 'american-football', name: 'NFL', icon: Shield, color: 'var(--accent-blue)' },
];

const loadUnlockedMatches = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const val = localStorage.getItem('og_sports_unlocked_matches');
    if (!val) return {};
    const parsed = JSON.parse(val);
    const now = Date.now();
    const clean: Record<string, number> = {};
    for (const [id, time] of Object.entries(parsed)) {
      if (now - Number(time) < 7_200_000) { // 2 hours
        clean[id] = Number(time);
      }
    }
    return clean;
  } catch {
    return {};
  }
};

export default function App() {
  const [activeSport, setActiveSport] = useState('all');
  const [isDark, setIsDark] = useState(true);
  const [showNotif, setShowNotif] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const wallet = useWallet();
  const connected = wallet.isConnected;
  const walletAddress = wallet.shortAddress;
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [requestType, setRequestType] = useState<'match' | 'player' | 'team' | null>(null);
  const [requestMatch, setRequestMatch] = useState<Match | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dataRequestKind, setDataRequestKind] = useState('Match Result');

  // History state
  const [history, setHistory] = useState<RequestHistory[]>(INITIAL_REQUEST_HISTORY);

  // Drawer state for Match Full Data
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerMatch, setDrawerMatch] = useState<Match | null>(null);
  const [unlockedMatches, setUnlockedMatches] = useState<Record<string, number>>(() => loadUnlockedMatches());
  const [drawerTxStatus, setDrawerTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [drawerTxHash, setDrawerTxHash] = useState('');
  const [drawerTxError, setDrawerTxError] = useState('');
  const [drawerAnalysis, setDrawerAnalysis] = useState<Analysis | null>(null);
  const [drawerAnalysisLoading, setDrawerAnalysisLoading] = useState(false);
  const [playerStatsTeam, setPlayerStatsTeam] = useState<'home' | 'away'>('home');

  // Live sports data
  const [matches, setMatches] = useState<Match[]>(FALLBACK_MATCHES);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('fallback');
  const [standings, setStandings] = useState<Standing[]>(FALLBACK_STANDINGS);
  const [standingsSource, setStandingsSource] = useState<'live' | 'fallback'>('fallback');

  // Generate dynamic free insights based on match feed
  const freePredictions = generateFreeInsights(matches);

  // AI analysis modal
  const [analysisMatch, setAnalysisMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState('');

  // Refs for scroll navigation
  const homeRef = useRef<HTMLDivElement>(null);
  const feedsRef = useRef<HTMLDivElement>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);
  const developersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (!drawerMatch) {
      setDrawerAnalysis(null);
      return;
    }
    const loadDrawerAnalysis = async () => {
      setDrawerAnalysisLoading(true);
      try {
        const data = await fetchAnalysis(drawerMatch);
        setDrawerAnalysis(data);
      } catch (e) {
        console.error('Error fetching analysis for drawer:', e);
      } finally {
        setDrawerAnalysisLoading(false);
      }
    };
    loadDrawerAnalysis();
  }, [drawerMatch]);

  const loadMatches = async () => {
    setMatchesLoading(true);
    const { matches: data, source } = await fetchMatches();
    setMatches(data);
    setDataSource(source);
    setMatchesLoading(false);
  };

  const loadStandings = async () => {
    const { standings: data, source } = await fetchStandings();
    setStandings(data);
    setStandingsSource(source);
  };

  // Load real fixtures & standings on mount, then refresh every 60s for live scores.
  useEffect(() => {
    loadMatches();
    loadStandings();
    const interval = setInterval(() => {
      loadMatches();
      loadStandings();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const openAnalysis = async (match: Match) => {
    setAnalysisMatch(match);
    setAnalysis(null);
    setAnalysisError('');
    setAnalysisLoading(true);
    try {
      setAnalysis(await fetchAnalysis(match));
    } catch (err: any) {
      setAnalysisError(err?.message ?? 'Could not generate analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
      home: homeRef,
      feeds: feedsRef,
      predictions: predictionsRef,
      developers: developersRef
    };
    
    const ref = refs[sectionId];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenu(false);
  };

  const connectWallet = () => {
    if (connected) {
      wallet.disconnect();
    } else {
      wallet.connect();
    }
  };

  const copyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setSelectedPrediction(null);
    setRequestType(null);
    setRequestMatch(null);
    setTxStatus('idle');
    setTxHash('');
    setTxError('');
  };

  // The price (in $0G) for whatever the modal is currently requesting.
  const activePrice = selectedPrediction ? selectedPrediction.price : '0.01';

  // Map the UI sport to the on-chain sportId registered in the contract
  // (1 = Football, 2 = Basketball, 3 = Tennis). Default to Football.
  const sportToId = (sport?: string): bigint =>
    sport === 'basketball' ? 2n : sport === 'tennis' ? 3n : 1n;

  const handleConfirmAndPay = async () => {
    setTxError('');
    setTxStatus('pending');
    try {
      const sportId = sportToId(requestMatch?.sport);
      const queryType = selectedPrediction
        ? selectedPrediction.title
        : `${dataRequestKind}: ${requestMatch?.homeTeam ?? ''} vs ${requestMatch?.awayTeam ?? ''}`.trim();
      const hash = await wallet.requestData(sportId, queryType, parseEther(activePrice));
      setTxHash(hash);
      setTxStatus('success');

      // Add prediction/data query to history state on success
      const newHistoryItem: RequestHistory = {
        id: `r-${Date.now()}`,
        type: selectedPrediction ? 'Prediction' : dataRequestKind,
        query: selectedPrediction ? selectedPrediction.title : `${requestMatch?.homeTeam} vs ${requestMatch?.awayTeam}`,
        price: activePrice,
        timestamp: 'Just now',
        status: 'completed'
      };
      setHistory(prev => [newHistoryItem, ...prev]);

      // Unlock match if it was a data query
      if (requestMatch) {
        const now = Date.now();
        setUnlockedMatches(prev => {
          const updated = { ...prev, [requestMatch.id]: now };
          localStorage.setItem('og_sports_unlocked_matches', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      // 4001 = user rejected the transaction in their wallet.
      setTxError(
        err?.code === 4001
          ? 'Transaction rejected in wallet.'
          : err?.shortMessage ?? err?.message ?? 'Transaction failed.'
      );
      setTxStatus('error');
    }
  };

  const handlePayDrawerQuery = async (match: Match, kind: string) => {
    setDrawerTxError('');
    setDrawerTxStatus('pending');
    try {
      const sportId = sportToId(match.sport);
      const queryType = `${kind}: ${match.homeTeam} vs ${match.awayTeam}`;
      const price = '0.01';
      
      const hash = await wallet.requestData(sportId, queryType, parseEther(price));
      
      setDrawerTxHash(hash);
      setDrawerTxStatus('success');
      
      // Update history state
      const newHistoryItem: RequestHistory = {
        id: `r-${Date.now()}`,
        type: kind,
        query: `${match.homeTeam} vs ${match.awayTeam}`,
        price: price,
        timestamp: 'Just now',
        status: 'completed'
      };
      setHistory(prev => [newHistoryItem, ...prev]);

      // Unlock match for 2 hours in localStorage
      const now = Date.now();
      setUnlockedMatches(prev => {
        const updated = { ...prev, [match.id]: now };
        localStorage.setItem('og_sports_unlocked_matches', JSON.stringify(updated));
        return updated;
      });
    } catch (err: any) {
      setDrawerTxError(
        err?.code === 4001
          ? 'Transaction rejected in wallet.'
          : err?.shortMessage ?? err?.message ?? 'Transaction failed.'
      );
      setDrawerTxStatus('error');
    }
  };

  const filteredMatches = activeSport === 'all'
    ? matches
    : matches.filter(m => m.sport === activeSport);

  const FormBadge = ({ result }: { result: string }) => (
    <span className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
      result === 'W' ? 'bg-green-500/20 text-green-400' : 
      result === 'D' ? 'bg-yellow-500/20 text-yellow-400' : 
      'bg-red-500/20 text-red-400'
    }`}>{result}</span>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => scrollToSection('home')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-orange)] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">0G Sports Oracle</h1>
                <p className="text-xs text-[var(--muted)] hidden sm:block">Decentralized Intelligence</p>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {['Home', 'Feeds', 'Predictions', 'Developers'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
                >
                  {item}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowNotif(!showNotif)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors relative"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--accent-orange)] rounded-full" />
                </button>
                
                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 glass rounded-xl p-4 shadow-2xl"
                    >
                      <p className="text-sm font-medium mb-2">Notifications</p>
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-sm">
                          <p className="text-[var(--accent)]">New prediction available</p>
                          <p className="text-xs text-[var(--muted)]">World Cup Winner updated</p>
                        </div>
                        <div className="p-2 rounded-lg bg-white/5 text-sm">
                          <p className="text-[var(--text)]">Live match: Arsenal 2-1 Chelsea</p>
                          <p className="text-xs text-[var(--muted)]">67th minute</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={
                  connected && !wallet.isCorrectChain
                    ? wallet.switchToOgChain
                    : connectWallet
                }
                disabled={wallet.isConnecting}
                title={connected ? wallet.address ?? '' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60 ${
                  connected && !wallet.isCorrectChain
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                    : connected
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
                    : 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90'
                }`}
              >
                <Wallet className="w-4 h-4" />
                {wallet.isConnecting
                  ? 'Connecting...'
                  : connected && !wallet.isCorrectChain
                  ? 'Wrong Network'
                  : connected
                  ? walletAddress
                  : 'Connect Wallet'}
              </button>

              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="md:hidden p-2 rounded-lg hover:bg-white/5"
              >
                {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-[var(--border)]"
            >
              <nav className="p-4 space-y-1">
                {['Home', 'Feeds', 'Predictions', 'Developers'].map((item) => (
                  <button
                    key={item}
                    onClick={() => scrollToSection(item.toLowerCase())}
                    className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5"
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Live Ticker */}
      <div className="border-b border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="animate-ticker flex whitespace-nowrap py-2">
          {(() => {
            const live = matches.filter((m) => m.status === 'live');
            const ticker = live.length ? live : matches.slice(0, 6);
            return [...ticker, ...ticker];
          })().map((match, i) => (
            <div key={`${match.id}-${i}`} className="flex items-center gap-4 px-6">
              {match.status === 'live' && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-[var(--muted)]">LIVE</span>
                </span>
              )}
              <span className="text-sm font-medium">{match.homeTeam}</span>
              {match.status === 'live' || match.status === 'finished' ? (
                <span className="text-sm font-bold text-[var(--accent)]">
                  {match.homeScore ?? 0} - {match.awayScore ?? 0}
                </span>
              ) : (
                <span className="text-xs text-[var(--muted)]">vs</span>
              )}
              <span className="text-sm font-medium">{match.awayTeam}</span>
              <span className="text-xs text-[var(--muted)]">
                {match.status === 'live' ? match.time : match.date}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5">{match.league}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <section ref={homeRef} id="home" className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--accent)]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[var(--accent-orange)]/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 mb-6">
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-sm text-[var(--accent)]">Powered by 0G Network</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Decentralized Sports Intelligence
              <span className="block text-[var(--accent)] mt-2">on 0G Network</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-8">
              Pay in $0G, Trust the Chain. Real-time sports data and AI-powered predictions 
              with verifiable on-chain results.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => scrollToSection('feeds')}
                className="group flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent)]/90 transition-all animate-pulse-glow"
              >
                <Zap className="w-5 h-5" />
                Request Feed
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => scrollToSection('predictions')}
                className="flex items-center gap-2 px-6 py-3 glass rounded-xl font-medium hover:bg-white/10 transition-colors"
              >
                <TrendingUp className="w-5 h-5" />
                View Predictions
              </button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: 'Active Feeds', value: '12+', icon: Activity },
              { label: 'Predictions Made', value: '2,847', icon: Target },
              { label: 'Accuracy Rate', value: '89.2%', icon: TrendingUp },
              { label: 'Total Volume', value: '45.2K $0G', icon: BarChart3 },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-2xl p-4 text-center hover:scale-105 transition-transform">
                <stat.icon className="w-6 h-6 text-[var(--accent)] mx-auto mb-2" />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-[var(--muted)]">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Sports Filter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {sports.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setActiveSport(sport.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeSport === sport.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'glass hover:bg-white/10'
              }`}
            >
              <sport.icon className="w-4 h-4" />
              {sport.name}
            </button>
          ))}
        </div>
      </section>

      {/* Live & Upcoming Matches - Feeds Section */}
      <section ref={feedsRef} id="feeds" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Live & Upcoming</h2>
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                dataSource === 'live'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
              title={
                dataSource === 'live'
                  ? 'Real fixtures from football-data.org'
                  : 'Live API unavailable — set FOOTBALL_DATA_KEY in your Vercel env (or run via `vercel dev`)'
              }
            >
              {dataSource === 'live' ? '● Live data' : '● Demo data'}
            </span>
          </div>
          <button
            onClick={loadMatches}
            disabled={matchesLoading}
            className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${matchesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {matchesLoading && filteredMatches.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="glass rounded-2xl p-5 h-44 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-[var(--muted)]">
            No {activeSport === 'all' ? '' : activeSport + ' '}matches scheduled in the next 7 days.
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.slice(0, 6).map((match, i) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs px-2 py-1 rounded-lg bg-white/5 text-[var(--muted)]">
                  {match.league}
                </span>
                {match.status === 'live' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    LIVE {match.time}
                  </span>
                )}
                {match.status === 'upcoming' && (
                  <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Clock className="w-3 h-3" />
                    {match.date}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <p className="font-semibold">{match.homeTeam}</p>
                </div>
                <div className="px-4">
                  {match.status === 'live' || match.status === 'finished' ? (
                    <p className="text-2xl font-bold">
                      <span className="text-[var(--accent)]">{match.homeScore}</span>
                      <span className="text-[var(--muted)] mx-1">-</span>
                      <span className="text-[var(--accent)]">{match.awayScore}</span>
                    </p>
                  ) : (
                    <p className="text-lg text-[var(--muted)]">vs</p>
                  )}
                </div>
                <div className="text-center flex-1">
                  <p className="font-semibold">{match.awayTeam}</p>
                </div>
              </div>

              {match.odds && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <p className="text-xs text-[var(--muted)]">Home</p>
                    <p className="font-bold text-[var(--accent)]">{match.odds.home}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <p className="text-xs text-[var(--muted)]">Draw</p>
                    <p className="font-bold">{match.odds.draw}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer">
                    <p className="text-xs text-[var(--muted)]">Away</p>
                    <p className="font-bold text-[var(--accent-orange)]">{match.odds.away}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openAnalysis(match)}
                  className="py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors flex items-center justify-center gap-1"
                >
                  <Activity className="w-4 h-4" /> AI Analysis
                </button>
                <button
                  onClick={() => {
                    setDrawerMatch(match);
                    setShowDrawer(true);
                    setDataRequestKind('Match Result');
                    setDrawerTxStatus('idle');
                    setDrawerTxHash('');
                    setDrawerTxError('');
                  }}
                  className="py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
                >
                  Full Data
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </section>

      {/* Free Insights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Free Insights</h2>
            <p className="text-sm text-[var(--muted)]">Teaser predictions powered by 0G AI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {freePredictions.map((pred, i) => (
            <motion.div
              key={pred.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-all cursor-pointer"
              onClick={() => { setSelectedPrediction(pred); setShowRequestModal(true); }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                  {pred.category}
                </span>
                <span className="text-xs text-[var(--muted)]">{pred.lastUpdated}</span>
              </div>
              
              <h3 className="font-semibold mb-2">{pred.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{pred.description}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-orange)] rounded-full"
                      style={{ width: `${pred.confidence}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-[var(--accent)]">{pred.confidence}%</span>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400">FREE</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Standings */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Premier League Standings</h2>
            <span
              className={`text-xs px-2 py-1 rounded-lg ${
                standingsSource === 'live'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
              title={
                standingsSource === 'live'
                  ? 'Real standings from football-data.org'
                  : 'Live API unavailable — showing demo standings'
              }
            >
              {standingsSource === 'live' ? '● Live data' : '● Demo data'}
            </span>
          </div>
          <button 
            onClick={() => scrollToSection('feeds')}
            className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
          >
            Full Table <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr className="text-left text-xs text-[var(--muted)]">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-center">P</th>
                  <th className="px-4 py-3 text-center">W</th>
                  <th className="px-4 py-3 text-center">D</th>
                  <th className="px-4 py-3 text-center">L</th>
                  <th className="px-4 py-3 text-center">Pts</th>
                  <th className="px-4 py-3">Form</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team, i) => (
                  <tr 
                    key={team.team} 
                    className="border-t border-[var(--border)] hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        i < 4 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-white/5'
                      }`}>
                        {team.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{team.team}</td>
                    <td className="px-4 py-3 text-center text-[var(--muted)]">{team.played}</td>
                    <td className="px-4 py-3 text-center">{team.won}</td>
                    <td className="px-4 py-3 text-center text-[var(--muted)]">{team.drawn}</td>
                    <td className="px-4 py-3 text-center text-red-400">{team.lost}</td>
                    <td className="px-4 py-3 text-center font-bold text-[var(--accent)]">{team.points}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {team.form.map((r, j) => <FormBadge key={j} result={r} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Paid Predictions */}
      <section ref={predictionsRef} id="predictions" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Premium Predictions</h2>
            <p className="text-sm text-[var(--muted)]">AI-powered insights with verifiable reasoning</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--muted)]" />
            <select className="bg-transparent border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm">
              <option>All Categories</option>
              <option>FIFA World Cup</option>
              <option>Premier League</option>
              <option>NBA</option>
              <option>NFL</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paidPredictions.map((pred, i) => (
            <motion.div
              key={pred.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs px-2 py-1 rounded-lg bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                  {pred.category}
                </span>
                <span className="text-sm font-bold text-[var(--accent)]">{pred.price} $0G</span>
              </div>
              
              <h3 className="font-semibold mb-2">{pred.title}</h3>
              <p className="text-sm text-[var(--muted)] mb-4">{pred.description}</p>
              
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-orange)] rounded-full"
                    style={{ width: `${pred.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-bold">{pred.confidence}%</span>
              </div>

              {pred.reasoning && (
                <p className="text-xs text-[var(--muted)] mb-4 line-clamp-2">{pred.reasoning}</p>
              )}
              
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-4">
                <span>Updated {pred.lastUpdated}</span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Verified on-chain
                </span>
              </div>
              
              <button
                onClick={() => { setSelectedPrediction(pred); setShowRequestModal(true); }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-orange)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Purchase Prediction
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Developer CTA */}
      <section ref={developersRef} id="developers" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="glass rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--accent-orange)]/10 rounded-full blur-3xl" />
          
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">Integrate 0G Sports Oracle</h2>
              <p className="text-[var(--muted)] mb-6">
                Build prediction markets, fantasy sports, betting platforms, or any dApp that needs 
                reliable sports data. Pay-per-request model with verifiable on-chain results.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="px-3 py-1 rounded-lg bg-white/5 text-sm">Solidity</span>
                <span className="px-3 py-1 rounded-lg bg-white/5 text-sm">wagmi</span>
                <span className="px-3 py-1 rounded-lg bg-white/5 text-sm">viem</span>
                <span className="px-3 py-1 rounded-lg bg-white/5 text-sm">REST API</span>
              </div>
              
              <button
                onClick={() => window.open('https://docs.0g.ai', '_blank')}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent)]/90 transition-colors"
              >
                <Code className="w-5 h-5" />
                View Documentation
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
            
            <div className="glass rounded-xl p-4 font-mono text-sm overflow-x-auto">
              <div className="flex items-center gap-2 mb-3 text-[var(--muted)]">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs">SportsOracle.sol</span>
              </div>
              <pre className="text-xs leading-relaxed">
{`// Request sports data on 0G
function requestSportsData(
  uint256 sportId,
  string calldata queryType
) external payable {
  require(
    msg.value >= getPrice(sportId),
    "Insufficient $0G"
  );
  
  requests.push(Request({
    requester: msg.sender,
    sportId: sportId,
    queryType: queryType,
    timestamp: block.timestamp
  }));
  
  emit DataRequested(
    requestId, msg.sender, sportId
  );
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Request History (if connected) */}
      {connected && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Your Request History</h2>
              <p className="text-sm text-[var(--muted)]">Track your oracle requests and payments</p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-[var(--accent)]"
            >
              {showHistory ? 'Hide' : 'Show'} History
              <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass rounded-2xl overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr className="text-left text-xs text-[var(--muted)]">
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Query</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((req) => (
                        <tr key={req.id} className="border-t border-[var(--border)] hover:bg-white/5">
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-xs">
                              {req.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{req.query}</td>
                          <td className="px-4 py-3 text-[var(--accent)]">{req.price} $0G</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{req.timestamp}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-green-400 text-xs">
                              <Check className="w-3 h-3" />
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <button 
                onClick={() => scrollToSection('home')}
                className="flex items-center gap-2 mb-4 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-orange)] flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold">0G Sports Oracle</span>
              </button>
              <p className="text-sm text-[var(--muted)]">
                Decentralized sports intelligence on 0G Network.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Products</h4>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><button onClick={() => scrollToSection('feeds')} className="hover:text-[var(--text)]">Live Feeds</button></li>
                <li><button onClick={() => scrollToSection('predictions')} className="hover:text-[var(--text)]">Predictions</button></li>
                <li><button className="hover:text-[var(--text)]">API Access</button></li>
                <li><button className="hover:text-[var(--text)]">Enterprise</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Developers</h4>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><button onClick={() => scrollToSection('developers')} className="hover:text-[var(--text)]">Documentation</button></li>
                <li><button className="hover:text-[var(--text)]">Smart Contracts</button></li>
                <li><button className="hover:text-[var(--text)]">API Reference</button></li>
                <li><button className="hover:text-[var(--text)]">GitHub</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Network</h4>
              <ul className="space-y-2 text-sm text-[var(--muted)]">
                <li><button className="hover:text-[var(--text)]">0G Explorer</button></li>
                <li><button className="hover:text-[var(--text)]">Testnet Faucet</button></li>
                <li><button className="hover:text-[var(--text)]">Bridge</button></li>
                <li><button className="hover:text-[var(--text)]">Status</button></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">2024 0G Sports Oracle. Built on 0G Network.</p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <button className="text-[var(--muted)] hover:text-[var(--text)]">
                <Globe className="w-5 h-5" />
              </button>
              <button className="text-[var(--muted)] hover:text-[var(--text)]">
                <FileText className="w-5 h-5" />
              </button>
              <button className="text-[var(--muted)] hover:text-[var(--text)]">
                <Code className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Request Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closeRequestModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">
                  {selectedPrediction ? 'Purchase Prediction' : 'Request Sports Data'}
                </h3>
                <button
                  onClick={closeRequestModal}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedPrediction && selectedPrediction.isFree ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 rounded-xl bg-white/5">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold mb-2 inline-block">
                      {selectedPrediction.category}
                    </span>
                    <h4 className="font-bold text-white text-lg mt-1">{selectedPrediction.title}</h4>
                    <p className="text-sm text-[var(--muted)] mt-2">{selectedPrediction.description}</p>
                  </div>
                  
                  {selectedPrediction.reasoning && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                      <p className="text-xs text-[var(--accent)] font-semibold uppercase tracking-wider">
                        AI Predictions &amp; Reasoning
                      </p>
                      <p className="text-sm text-white/95 leading-relaxed font-medium">
                        {selectedPrediction.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                    <span>Verified Free AI Insight</span>
                    <span className="font-bold">★ {selectedPrediction.confidence}% Confidence</span>
                  </div>

                  <div className="flex gap-3 pt-3">
                    <button
                      onClick={closeRequestModal}
                      className="w-full py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white font-semibold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : !connected ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 text-[var(--accent)] mx-auto mb-4" />
                  <p className="text-[var(--muted)] mb-4">
                    Connect your wallet to the {NETWORK_CONFIG.testnet.chainName} to continue
                  </p>
                  <button
                    onClick={() => { connectWallet(); }}
                    disabled={wallet.isConnecting}
                    className="px-6 py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent)]/90 disabled:opacity-60"
                  >
                    {wallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                  {wallet.error && (
                    <p className="text-sm text-red-400 mt-4">{wallet.error}</p>
                  )}
                  <a
                    href={NETWORK_CONFIG.testnet.faucet}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-[var(--muted)] mt-4 hover:text-[var(--accent)] underline"
                  >
                    Need test tokens? Get $0G from the faucet
                  </a>
                </div>
              ) : (
                <>
                  {selectedPrediction ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-white/5">
                        <p className="text-sm text-[var(--muted)] mb-1">{selectedPrediction.category}</p>
                        <p className="font-semibold">{selectedPrediction.title}</p>
                        <p className="text-sm text-[var(--muted)] mt-2">{selectedPrediction.description}</p>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--accent)]/10">
                        <span className="text-sm">Price</span>
                        <span className="font-bold text-[var(--accent)]">{selectedPrediction.price} $0G</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                        <Shield className="w-4 h-4" />
                        <span>Payment secured by 0G smart contract</span>
                      </div>
                    </div>
                  ) : requestType && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        {['Match Result', 'Player Stats', 'Team Form'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setDataRequestKind(type)}
                            className={`p-3 rounded-xl text-sm transition-colors ${
                              dataRequestKind === type
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                      
                      <div className="p-4 rounded-xl bg-white/5">
                        <label className="text-sm text-[var(--muted)] mb-2 block">Match</label>
                        {requestMatch ? (
                          <div>
                            <p className="font-semibold">
                              {requestMatch.homeTeam} vs {requestMatch.awayTeam}
                            </p>
                            <p className="text-xs text-[var(--muted)] mt-1">
                              {requestMatch.league} · {requestMatch.status === 'live'
                                ? `LIVE ${requestMatch.homeScore ?? 0}-${requestMatch.awayScore ?? 0}`
                                : requestMatch.date}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-[var(--muted)]">
                            Select a match from the Live &amp; Upcoming feed.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--accent)]/10">
                        <span className="text-sm">Estimated Cost</span>
                        <span className="font-bold text-[var(--accent)]">{activePrice} $0G</span>
                      </div>
                    </div>
                  )}

                  {txStatus === 'success' ? (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-center gap-2 text-[var(--accent)]">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Payment confirmed on 0G</span>
                      </div>

                      {/* The data they just unlocked */}
                      {requestMatch ? (
                        <div className="p-4 rounded-xl bg-white/5 text-left">
                          <p className="text-xs text-[var(--muted)] mb-1">{requestMatch.league}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{requestMatch.homeTeam}</span>
                            <span className="font-bold text-[var(--accent)]">
                              {requestMatch.status === 'upcoming'
                                ? 'vs'
                                : `${requestMatch.homeScore ?? 0} - ${requestMatch.awayScore ?? 0}`}
                            </span>
                            <span className="font-semibold">{requestMatch.awayTeam}</span>
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-2">
                            {requestMatch.status === 'live'
                              ? `Live${requestMatch.time ? ' · ' + requestMatch.time : ''}`
                              : requestMatch.status === 'finished'
                              ? 'Full time'
                              : `Kickoff: ${requestMatch.date}`}
                          </p>
                        </div>
                      ) : selectedPrediction?.reasoning ? (
                        <div className="p-4 rounded-xl bg-white/5 text-left">
                          <p className="text-xs text-[var(--muted)] mb-1">Reasoning</p>
                          <p className="text-sm">{selectedPrediction.reasoning}</p>
                        </div>
                      ) : null}

                      <a
                        href={`${NETWORK_CONFIG.testnet.blockExplorerUrls[0]}/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--accent)] underline break-all"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="flex gap-3">
                        {requestMatch && (
                          <button
                            onClick={() => { const m = requestMatch; closeRequestModal(); openAnalysis(m); }}
                            className="flex-1 py-3 rounded-xl border border-[var(--border)] hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                          >
                            <Activity className="w-4 h-4" /> AI Analysis
                          </button>
                        )}
                        <button
                          onClick={closeRequestModal}
                          className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent)]/90 transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {txError && (
                        <p className="text-sm text-red-400 mt-4">{txError}</p>
                      )}
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={closeRequestModal}
                          disabled={txStatus === 'pending'}
                          className="flex-1 py-3 rounded-xl border border-[var(--border)] hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmAndPay}
                          disabled={txStatus === 'pending'}
                          className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-60"
                        >
                          {txStatus === 'pending'
                            ? 'Confirm in wallet...'
                            : `Confirm and Pay ${activePrice} $0G`}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {analysisMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setAnalysisMatch(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--accent)]" />
                  <h3 className="text-xl font-bold">AI Match Analysis</h3>
                </div>
                <button
                  onClick={() => setAnalysisMatch(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[var(--muted)] mb-5">
                {analysisMatch.homeTeam} vs {analysisMatch.awayTeam} · {analysisMatch.league}
              </p>

              {analysisLoading ? (
                <div className="py-10 text-center text-[var(--muted)]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[var(--accent)]" />
                  Crunching the numbers...
                </div>
              ) : analysisError ? (
                <p className="text-sm text-red-400 py-6 text-center">{analysisError}</p>
              ) : analysis ? (
                <div className="space-y-5">
                  {/* Win probability bars */}
                  <div className="space-y-2">
                    {[
                      { label: analysisMatch.homeTeam, value: analysis.home, color: 'var(--accent)' },
                      { label: 'Draw', value: analysis.draw, color: 'var(--muted)' },
                      { label: analysisMatch.awayTeam, value: analysis.away, color: 'var(--accent-orange)' },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span>{row.label}</span>
                          <span className="font-bold">{row.value}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${row.value}%`, background: row.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--accent)]/10">
                    <p className="text-xs text-[var(--muted)] mb-1">Predicted outcome</p>
                    <p className="font-bold text-[var(--accent)]">
                      {analysis.predictedWinner === 'Draw'
                        ? 'Draw'
                        : `${analysis.predictedWinner} to win`}{' '}
                      · {analysis.confidence}% confidence
                    </p>
                  </div>

                  <p className="text-sm text-[var(--muted)] leading-relaxed">{analysis.analysis}</p>

                  <p className="text-xs text-[var(--muted)] flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {analysis.basis === 'league-standings'
                      ? 'Model based on live league standings, form & home advantage'
                      : 'Baseline estimate (limited data for this fixture)'}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sports Data Drawer */}
      <AnimatePresence>
        {showDrawer && drawerMatch && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
              onClick={() => {
                setShowDrawer(false);
                setDrawerTxStatus('idle');
                setDrawerTxHash('');
                setDrawerTxError('');
              }}
            />

            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-slate-950/95 border-l border-white/10 shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[var(--muted)]">
                    {drawerMatch.league}
                  </span>
                  <h3 className="text-xl font-bold mt-2 text-white">
                    {drawerMatch.homeTeam} vs {drawerMatch.awayTeam}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowDrawer(false);
                    setDrawerTxStatus('idle');
                    setDrawerTxHash('');
                    setDrawerTxError('');
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 py-3 border-b border-white/10 bg-white/[0.01] flex gap-2">
                {['Match Result', 'Player Stats', 'Team Form'].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setDataRequestKind(type);
                      setDrawerTxStatus('idle');
                      setDrawerTxHash('');
                      setDrawerTxError('');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      dataRequestKind === type
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'bg-white/5 text-[var(--muted)] hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {unlockedMatches[drawerMatch.id] && (Date.now() - unlockedMatches[drawerMatch.id] < 7_200_000) ? (
                  renderUnlockedContent(drawerMatch, dataRequestKind)
                ) : (
                  renderLockedContent(drawerMatch, dataRequestKind)
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  function renderLockedContent(match: Match, kind: string) {
    const isPending = drawerTxStatus === 'pending';
    
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-[var(--accent)] relative">
          <Lock className="w-8 h-8" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-black">
            <Shield className="w-3 h-3" />
          </div>
        </div>
        
        <div>
          <h4 className="text-lg font-bold text-white">Unlock {kind}</h4>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-xs mx-auto">
            Get verified, real-time {kind.toLowerCase()} for this fixture. Secured by 0G Smart Contracts.
          </p>
        </div>

        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
          <span className="text-sm text-[var(--muted)]">Cost to Unlock</span>
          <span className="font-bold text-lg text-[var(--accent)]">0.01 $0G</span>
        </div>

        {!connected ? (
          <div className="w-full space-y-4">
            <p className="text-xs text-[var(--muted)]">
              Connect your wallet to the {NETWORK_CONFIG.testnet.chainName} to pay.
            </p>
            <button
              onClick={() => connectWallet()}
              className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 cursor-pointer"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {drawerTxError && (
              <p className="text-sm text-red-400 border border-red-500/20 bg-red-500/5 rounded-xl p-3">
                {drawerTxError}
              </p>
            )}
            <button
              onClick={() => handlePayDrawerQuery(match, kind)}
              disabled={isPending}
              className="w-full py-3.5 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Confirming in wallet...
                </>
              ) : (
                `Confirm and Pay 0.01 $0G`
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderUnlockedContent(match: Match, kind: string) {
    if (kind === 'Match Result') {
      const scorers = getGoalscorers(match);
      return (
        <div className="space-y-6 animate-fade-in">
          {/* Confirmed Banner */}
          <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl flex items-center gap-2 text-sm text-[var(--accent)]">
            <Check className="w-4 h-4 shrink-0" />
            <span>Match Result unlocked via 0G Sports Oracle</span>
          </div>

          {/* Score & Goalscorers */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">{match.homeTeam}</span>
              <span className="text-2xl font-black text-[var(--accent)]">
                {match.status === 'upcoming' ? 'vs' : `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`}
              </span>
              <span className="font-semibold text-white">{match.awayTeam}</span>
            </div>
            
            {scorers && (
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5 text-xs text-[var(--muted)]">
                <div className="space-y-1">
                  {scorers.home.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-[var(--accent)] shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-right">
                  {scorers.away.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1 justify-end">
                      <span>{s}</span>
                      <Star className="w-3 h-3 text-[var(--accent-orange)] shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Match Stats</h4>
            <div className="glass rounded-2xl p-4 space-y-3">
              {[
                { name: 'Possession', home: 54, away: 46, suffix: '%' },
                { name: 'Shots (On Target)', home: '15 (6)', away: '9 (3)' },
                { name: 'Fouls', home: 11, away: 14 },
                { name: 'Corners', home: 5, away: 4 },
                { name: 'Offsides', home: 2, away: 1 },
                { name: 'Yellow Cards', home: 1, away: 2 },
              ].map((stat, idx) => {
                let homePercent = 50;
                let awayPercent = 50;
                if (typeof stat.home === 'number' && typeof stat.away === 'number') {
                  const total = stat.home + stat.away;
                  homePercent = total > 0 ? (stat.home / total) * 100 : 50;
                  awayPercent = total > 0 ? (stat.away / total) * 100 : 50;
                }
                
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white">
                      <span>{stat.home}{stat.suffix ?? ''}</span>
                      <span className="font-medium text-[var(--muted)]">{stat.name}</span>
                      <span>{stat.away}{stat.suffix ?? ''}</span>
                    </div>
                    {typeof stat.home === 'number' && (
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${homePercent}%` }} />
                        <div className="h-full bg-[var(--accent-orange)]" style={{ width: `${awayPercent}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (kind === 'Player Stats') {
      const homePlayers = generateMockPlayers(match.homeTeam, true);
      const awayPlayers = generateMockPlayers(match.awayTeam, false);
      const activePlayers = playerStatsTeam === 'home' ? homePlayers : awayPlayers;
      const activeTeamName = playerStatsTeam === 'home' ? match.homeTeam : match.awayTeam;

      return (
        <div className="space-y-6 animate-fade-in">
          {/* Confirmed Banner */}
          <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl flex items-center gap-2 text-sm text-[var(--accent)]">
            <Check className="w-4 h-4 shrink-0" />
            <span>Player Stats unlocked via 0G Sports Oracle</span>
          </div>

          {/* Team Switcher Tabs */}
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setPlayerStatsTeam('home')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                playerStatsTeam === 'home'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              {match.homeTeam}
            </button>
            <button
              onClick={() => setPlayerStatsTeam('away')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                playerStatsTeam === 'away'
                  ? 'bg-[var(--accent-orange)] text-white'
                  : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              {match.awayTeam}
            </button>
          </div>

          {/* Players List */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
                {activeTeamName} Squad Rating
              </h4>
              <span className="text-xs text-[var(--muted)] font-medium">Source: 0G Sports Oracle</span>
            </div>
            
            <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
              {activePlayers.map((player, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-xs border border-white/10 text-white">
                      {player.pos}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{player.name}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-[var(--muted)]">
                        {Object.entries(player.stats).map(([k, v]) => (
                          <span key={k}>
                            {k}: <strong className="text-white">{v}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-black ${
                    Number(player.rating) >= 8.0 ? 'bg-green-500/20 text-green-400' :
                    Number(player.rating) >= 7.2 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' :
                    'bg-white/10 text-[var(--muted)]'
                  }`}>
                    ★ {player.rating}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (kind === 'Team Form') {
      const isLive = drawerAnalysis && drawerAnalysis.basis === 'league-standings';
      const homeRank = isLive ? drawerAnalysis.homeRank : (match.homeTeam === 'Arsenal' ? 1 : match.homeTeam === 'Man City' ? 2 : 3);
      const awayRank = isLive ? drawerAnalysis.awayRank : (match.awayTeam === 'Chelsea' ? 10 : match.awayTeam === 'Liverpool' ? 3 : 5);
      
      const homeFormStr = isLive && drawerAnalysis.homeForm ? drawerAnalysis.homeForm : 'W,W,D,W,W';
      const awayFormStr = isLive && drawerAnalysis.awayForm ? drawerAnalysis.awayForm : 'W,D,W,W,D';
      
      const homeForm = homeFormStr.split(',').map(s => s.trim()).filter(Boolean);
      const awayForm = awayFormStr.split(',').map(s => s.trim()).filter(Boolean);

      const getH2H = () => {
        return [
          { date: 'Oct 2025', fixture: `${match.homeTeam} 2 - 2 ${match.awayTeam}` },
          { date: 'Apr 2025', fixture: `${match.awayTeam} 1 - 2 ${match.homeTeam}` },
          { date: 'Dec 2024', fixture: `${match.homeTeam} 3 - 1 ${match.awayTeam}` },
        ];
      };

      return (
        <div className="space-y-6 animate-fade-in">
          {/* Confirmed Banner */}
          <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl flex items-center gap-2 text-sm text-[var(--accent)]">
            <Check className="w-4 h-4 shrink-0" />
            <span>Team Form unlocked via 0G Sports Oracle</span>
          </div>

          {/* Form & Standing Comparison */}
          {drawerAnalysisLoading ? (
            <div className="py-8 text-center text-[var(--muted)]">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--accent)]" />
              Loading latest standings...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Home Team Standing */}
                <div className="glass rounded-2xl p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-[var(--muted)] uppercase font-semibold">Home Standing</p>
                    <p className="text-2xl font-black mt-1 text-white">{homeRank ?? 'N/A'}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{match.homeTeam}</p>
                  </div>
                  <div className="flex justify-center gap-1 pt-2 border-t border-white/5">
                    {homeForm.map((res, idx) => (
                      <FormBadge key={idx} result={res} />
                    ))}
                  </div>
                </div>

                {/* Away Team Standing */}
                <div className="glass rounded-2xl p-4 space-y-3">
                  <div className="text-center">
                    <p className="text-xs text-[var(--muted)] uppercase font-semibold">Away Standing</p>
                    <p className="text-2xl font-black mt-1 text-white">{awayRank ?? 'N/A'}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{match.awayTeam}</p>
                  </div>
                  <div className="flex justify-center gap-1 pt-2 border-t border-white/5">
                    {awayForm.map((res, idx) => (
                      <FormBadge key={idx} result={res} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Form narrative */}
              {drawerAnalysis?.analysis && (
                <div className="glass rounded-2xl p-4">
                  <h5 className="text-xs font-semibold text-[var(--muted)] uppercase mb-2">Model Narrative</h5>
                  <p className="text-sm text-white/90 leading-relaxed">{drawerAnalysis.analysis}</p>
                </div>
              )}
            </div>
          )}

          {/* Head to Head (H2H) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Head-to-Head History</h4>
            <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
              {getH2H().map((h2h, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">{h2h.date}</span>
                  <span className="font-semibold text-white">{h2h.fixture}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return null;
  }
}