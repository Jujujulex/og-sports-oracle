import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseEther } from 'viem';
import { useWallet } from './config/useWallet';
import NETWORK_CONFIG from './config/network';
import {
  fetchMatches,
  fetchAnalysis,
  FALLBACK_MATCHES,
  type Match,
  type Analysis,
} from './config/sportsApi';
import {
  Trophy, Zap, TrendingUp, Users, Clock, ChevronRight, ChevronDown,
  Globe, Wallet, Bell, Moon, Sun, Menu, X, ExternalLink, Copy,
  Check, ArrowUpRight, ArrowDownRight, Star, Play, Calendar,
  BarChart3, Target, Shield, Code, FileText, ArrowRight,
  Activity, RefreshCw, Download, Filter, Search, MoreHorizontal
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
const freePredictions: Prediction[] = [
  { id: 'p1', title: 'World Cup Quarterfinalists', description: 'Predicted teams advancing to quarter-finals', confidence: 78, price: '0', category: 'FIFA World Cup', isFree: true, reasoning: 'Based on group stage performance and historical data', lastUpdated: '2 hours ago' },
  { id: 'p2', title: 'Premier League Top 4', description: 'Likely Champions League qualifiers', confidence: 85, price: '0', category: 'Premier League', isFree: true, lastUpdated: '1 hour ago' },
  { id: 'p3', title: 'NBA MVP Contender', description: 'Top 3 candidates for Most Valuable Player', confidence: 72, price: '0', category: 'NBA', isFree: true, lastUpdated: '3 hours ago' },
];

const paidPredictions: Prediction[] = [
  { id: 'p4', title: 'World Cup Winner', description: 'AI-powered tournament winner prediction with detailed analysis', confidence: 89, price: '0.05', category: 'FIFA World Cup', isFree: false, reasoning: 'Advanced ML model analyzing 500+ factors including team form, injuries, historical performance, and tactical matchups', lastUpdated: '30 min ago' },
  { id: 'p5', title: 'Golden Boot Winner', description: 'Top goalscorer prediction with confidence intervals', confidence: 82, price: '0.03', category: 'FIFA World Cup', isFree: false, lastUpdated: '1 hour ago' },
  { id: 'p6', title: 'Best Coach Award', description: 'Tournament best coach prediction', confidence: 75, price: '0.02', category: 'FIFA World Cup', isFree: false, lastUpdated: '2 hours ago' },
  { id: 'p7', title: 'Premier League Champion', description: 'Full season outcome with relegation predictions', confidence: 88, price: '0.08', category: 'Premier League', isFree: false, lastUpdated: '45 min ago' },
  { id: 'p8', title: 'La Liga Surprise Package', description: 'Underdog team likely to exceed expectations', confidence: 68, price: '0.02', category: 'La Liga', isFree: false, lastUpdated: '4 hours ago' },
  { id: 'p9', title: 'NFL Super Bowl Winner', description: 'Complete playoff bracket prediction', confidence: 76, price: '0.06', category: 'NFL', isFree: false, lastUpdated: '2 hours ago' },
];

const standings: Standing[] = [
  { rank: 1, team: 'Arsenal', played: 20, won: 15, drawn: 3, lost: 2, points: 48, form: ['W', 'W', 'D', 'W', 'W'] },
  { rank: 2, team: 'Man City', played: 20, won: 14, drawn: 4, lost: 2, points: 46, form: ['W', 'D', 'W', 'W', 'D'] },
  { rank: 3, team: 'Liverpool', played: 20, won: 13, drawn: 5, lost: 2, points: 44, form: ['W', 'W', 'W', 'D', 'W'] },
  { rank: 4, team: 'Aston Villa', played: 20, won: 12, drawn: 4, lost: 4, points: 40, form: ['D', 'W', 'W', 'L', 'W'] },
  { rank: 5, team: 'Tottenham', played: 20, won: 11, drawn: 3, lost: 6, points: 36, form: ['L', 'W', 'W', 'D', 'L'] },
];

const requestHistory: RequestHistory[] = [
  { id: 'r1', type: 'Match Result', query: 'Arsenal vs Chelsea', price: '0.01', timestamp: '2 hours ago', status: 'completed' },
  { id: 'r2', type: 'Prediction', query: 'World Cup Winner', price: '0.05', timestamp: '1 day ago', status: 'completed' },
  { id: 'r3', type: 'Player Stats', query: 'Haaland season stats', price: '0.02', timestamp: '2 days ago', status: 'completed' },
];

const sports = [
  { id: 'all', name: 'All Sports', icon: Globe, color: 'var(--accent)' },
  { id: 'football', name: 'Football', icon: Trophy, color: 'var(--accent)' },
  { id: 'basketball', name: 'Basketball', icon: Target, color: 'var(--accent-orange)' },
  { id: 'american-football', name: 'NFL', icon: Shield, color: 'var(--accent-blue)' },
];

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
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dataRequestKind, setDataRequestKind] = useState('Match Result');

  // Live sports data
  const [matches, setMatches] = useState<Match[]>(FALLBACK_MATCHES);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('fallback');

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

  const loadMatches = async () => {
    setMatchesLoading(true);
    const { matches: data, source } = await fetchMatches();
    setMatches(data);
    setDataSource(source);
    setMatchesLoading(false);
  };

  // Load real fixtures on mount, then refresh every 60s for live scores.
  useEffect(() => {
    loadMatches();
    const interval = setInterval(loadMatches, 60_000);
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
    setTxStatus('idle');
    setTxHash('');
    setTxError('');
  };

  // The price (in $0G) for whatever the modal is currently requesting.
  const activePrice = selectedPrediction ? selectedPrediction.price : '0.01';

  const handleConfirmAndPay = async () => {
    setTxError('');
    setTxStatus('pending');
    try {
      const recipient = NETWORK_CONFIG.contracts.sportsOracle;
      const hash = await wallet.sendPayment(recipient, parseEther(activePrice));
      setTxHash(hash);
      setTxStatus('success');
    } catch (err: any) {
      // 4001 = user rejected the transaction in their wallet.
      setTxError(
        err?.code === 4001
          ? 'Transaction rejected in wallet.'
          : err?.message ?? 'Transaction failed.'
      );
      setTxStatus('error');
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
                onClick={() => { setRequestType('match'); setShowRequestModal(true); }}
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
                  : 'Live API unavailable — showing demo data'
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
                  onClick={() => { setRequestType('match'); setShowRequestModal(true); }}
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
              className="glass rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-all"
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
          <div>
            <h2 className="text-2xl font-bold">Premier League Standings</h2>
            <p className="text-sm text-[var(--muted)]">2024/25 Season</p>
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
                      {requestHistory.map((req) => (
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

              {!connected ? (
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
                        <label className="text-sm text-[var(--muted)] mb-2 block">Select Match</label>
                        <select className="w-full bg-transparent border border-[var(--border)] rounded-lg px-3 py-2">
                          <option>Arsenal vs Chelsea</option>
                          <option>Real Madrid vs Barcelona</option>
                          <option>Lakers vs Celtics</option>
                        </select>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--accent)]/10">
                        <span className="text-sm">Estimated Cost</span>
                        <span className="font-bold text-[var(--accent)]">0.01 $0G</span>
                      </div>
                    </div>
                  )}

                  {txStatus === 'success' ? (
                    <div className="mt-6 text-center space-y-3">
                      <div className="flex items-center justify-center gap-2 text-[var(--accent)]">
                        <Check className="w-5 h-5" />
                        <span className="font-medium">Payment confirmed on 0G</span>
                      </div>
                      <a
                        href={`${NETWORK_CONFIG.testnet.blockExplorerUrls[0]}/tx/${txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--accent)] underline break-all"
                      >
                        View transaction <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={closeRequestModal}
                        className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent)]/90 transition-colors"
                      >
                        Done
                      </button>
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
    </div>
  );
}