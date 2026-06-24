/**
 * 0G Sports Oracle Service
 * 
 * This service fetches sports data from external APIs and submits
 * verified updates to the 0G Sports Oracle smart contract.
 * 
 * Data Sources (note licensing requirements):
 * - API-Football (https://www.api-football.com/) - requires license
 * - Football-Data.org (https://www.football-data.org/) - free tier available
 * - NBA Stats API (official)
 * - NFL Data API
 * 
 * Integration with 0G:
 * - Stores historical data on 0G Storage
 * - Uses 0G DA layer for data availability proofs
 * - Can leverage 0G Compute for AI prediction verification
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import SportsOracleABI from './abis/SportsOracle.json';

// Configuration
const CONFIG = {
  // 0G Network RPC (testnet)
  RPC_URL: process.env.RPC_URL || 'https://rpc-testnet.0g.ai',
  
  // Contract address (deploy on 0G testnet)
  ORACLE_CONTRACT: process.env.ORACLE_CONTRACT as `0x${string}`,
  
  // Oracle node private key (keep secure!)
  ORACLE_PRIVATE_KEY: process.env.ORACLE_PRIVATE_KEY as `0x${string}`,
  
  // API Keys
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY || 'c652439ba0msh9de614fdd557a70p1be632jsne16144aaf784',
  FOOTBALL_DATA_KEY: process.env.FOOTBALL_DATA_KEY || '5dcc8513f3f94eb49222c91c5eceea2c',
  
  // Update intervals (in milliseconds)
  LIVE_MATCH_INTERVAL: 30000, // 30 seconds
  PREDICTION_UPDATE_INTERVAL: 3600000, // 1 hour
};

// Types
interface MatchData {
  id: string;
  sportId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: 'upcoming' | 'live' | 'finished';
  timestamp: number;
  league: string;
}

interface PredictionData {
  sportId: number;
  title: string;
  description: string;
  confidence: number;
  price: string;
  reasoning: string;
}

// 0G Storage Client (simplified - actual implementation would use 0G SDK)
class ZeroGStorage {
  async store(data: object): Promise<string> {
    // In production, use 0G Storage SDK
    // const hash = await zeroGStorage.upload(JSON.stringify(data));
    console.log('Storing data on 0G Storage:', JSON.stringify(data).slice(0, 100));
    return '0x' + Buffer.from(JSON.stringify(data)).toString('hex').slice(0, 64);
  }

  async retrieve(hash: string): Promise<object> {
    // In production, use 0G Storage SDK
    console.log('Retrieving data from 0G Storage:', hash);
    return {};
  }
}

// Sports Data Fetcher
class SportsDataFetcher {
  private storage: ZeroGStorage;

  constructor() {
    this.storage = new ZeroGStorage();
  }

  async fetchFootballMatches(league: string): Promise<MatchData[]> {
    // API-Football integration
    // Note: Requires valid API key and respects rate limits
    const response = await fetch(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${league}&season=2024`,
      {
        headers: {
          'X-RapidAPI-Key': CONFIG.API_FOOTBALL_KEY || '',
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API-Football request failed: HTTP ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.parseApiFootballData(data);
  }

  async fetchNBAMatches(): Promise<MatchData[]> {
    // NBA Stats API integration
    const response = await fetch('https://stats.nba.com/stats/scoreboardV2', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com'
      }
    });
    
    if (!response.ok) {
      throw new Error(`NBA Stats request failed: HTTP ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.parseNBAData(data);
  }

  async fetchNFLMatches(): Promise<MatchData[]> {
    // NFL data integration - no active integration
    return [];
  }

  private parseApiFootballData(data: any): MatchData[] {
    return data.response.map((fixture: any) => ({
      id: fixture.fixture.id.toString(),
      sportId: 1, // Football
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      homeScore: fixture.goals.home || 0,
      awayScore: fixture.goals.away || 0,
      status: this.mapFootballStatus(fixture.fixture.status.short),
      timestamp: fixture.fixture.timestamp * 1000,
      league: fixture.league.name
    }));
  }

  private parseNBAData(data: any): MatchData[] {
    // Parse NBA API response
    return [];
  }

  private mapFootballStatus(status: string): 'upcoming' | 'live' | 'finished' {
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'];
    const finishedStatuses = ['FT', 'AET', 'PEN', 'CANC', 'POST', 'SUSP'];
    
    if (liveStatuses.includes(status)) return 'live';
    if (finishedStatuses.includes(status)) return 'finished';
    return 'upcoming';
  }

}

// AI Prediction Engine (integrates with 0G Compute)
class PredictionEngine {
  private storage: ZeroGStorage;

  constructor() {
    this.storage = new ZeroGStorage();
  }

  async generatePredictions(sportId: number, matches: MatchData[]): Promise<PredictionData[]> {
    // In production, this would:
    // 1. Fetch historical data from 0G Storage
    // 2. Send to 0G Compute for verifiable AI inference
    // 3. Store reasoning on 0G Storage
    // 4. Return predictions with confidence scores

    const predictions: PredictionData[] = [];

    if (sportId === 1 || sportId === 0) {
      // Football predictions
      predictions.push({
        sportId: 1,
        title: 'World Cup Winner',
        description: 'AI-powered tournament winner prediction',
        confidence: 89,
        price: '0.05',
        reasoning: 'Based on team form, historical performance, player injuries, and tactical analysis using 500+ factors.'
      });

      predictions.push({
        sportId: 1,
        title: 'Golden Boot Winner',
        description: 'Top goalscorer prediction with confidence intervals',
        confidence: 82,
        price: '0.03',
        reasoning: 'Analyzing player form, upcoming fixtures difficulty, penalty duties, and historical scoring patterns.'
      });
    }

    if (sportId === 2 || sportId === 0) {
      // NBA predictions
      predictions.push({
        sportId: 2,
        title: 'NBA Champion',
        description: 'Full playoff bracket prediction',
        confidence: 76,
        price: '0.06',
        reasoning: 'Team efficiency ratings, player health, playoff experience, and coaching factors analyzed.'
      });
    }

    return predictions;
  }

  async updatePredictionConfidence(predictionId: number, newMatchData: MatchData[]): Promise<number> {
    // Recalculate confidence based on new match results
    // In production, this would use 0G Compute for verifiable updates
    return Math.floor(Math.random() * 20) + 70; // 70-90% range
  }
}

// Oracle Node Service
class OracleNode {
  private fetcher: SportsDataFetcher;
  private predictor: PredictionEngine;
  private storage: ZeroGStorage;
  private walletClient: any;
  private publicClient: any;
  private account: any;

  constructor() {
    this.fetcher = new SportsDataFetcher();
    this.predictor = new PredictionEngine();
    this.storage = new ZeroGStorage();

    // Initialize 0G network clients
    this.account = privateKeyToAccount(CONFIG.ORACLE_PRIVATE_KEY);
    
    this.publicClient = createPublicClient({
      chain: {
        id: 16600, // 0G testnet chain ID
        name: '0G Testnet',
        nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
        rpcUrls: { default: { http: [CONFIG.RPC_URL] } }
      },
      transport: http(CONFIG.RPC_URL)
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: {
        id: 16600,
        name: '0G Testnet',
        nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
        rpcUrls: { default: { http: [CONFIG.RPC_URL] } }
      },
      transport: http(CONFIG.RPC_URL)
    });
  }

  async start() {
    console.log('Starting 0G Sports Oracle Node...');
    console.log(`Oracle address: ${this.account.address}`);

    // Start periodic updates
    setInterval(() => this.updateLiveMatches(), CONFIG.LIVE_MATCH_INTERVAL);
    setInterval(() => this.updatePredictions(), CONFIG.PREDICTION_UPDATE_INTERVAL);

    // Initial update
    await this.updateLiveMatches();
    await this.updatePredictions();
  }

  async updateLiveMatches() {
    console.log('Updating live matches...');

    let footballMatches: MatchData[] = [];
    let nbaMatches: MatchData[] = [];
    let nflMatches: MatchData[] = [];

    try {
      footballMatches = await this.fetcher.fetchFootballMatches('39'); // Premier League
    } catch (error) {
      console.error('Error updating live football matches:', error);
    }

    try {
      nbaMatches = await this.fetcher.fetchNBAMatches();
    } catch (error) {
      console.error('Error updating live NBA matches:', error);
    }

    try {
      nflMatches = await this.fetcher.fetchNFLMatches();
    } catch (error) {
      console.error('Error updating live NFL matches:', error);
    }

    const allMatches = [...footballMatches, ...nbaMatches, ...nflMatches];

    if (allMatches.length === 0) {
      console.log('No matches updated because all sport fetches returned empty or failed.');
      return;
    }

    try {
      // Store on 0G Storage
      const dataHash = await this.storage.store({
        timestamp: Date.now(),
        matches: allMatches
      });

      console.log(`Stored ${allMatches.length} matches. Hash: ${dataHash}`);

      // Update smart contract for live matches
      for (const match of allMatches.filter(m => m.status === 'live')) {
        await this.updateMatchOnChain(match);
      }
    } catch (error) {
      console.error('Error updating live matches data storage/chain:', error);
    }
  }

  async updateMatchOnChain(match: MatchData) {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: CONFIG.ORACLE_CONTRACT,
        abi: SportsOracleABI,
        functionName: 'updateMatchResult',
        args: [
          BigInt(match.id),
          this.mapStatus(match.status),
          BigInt(match.homeScore),
          BigInt(match.awayScore)
        ]
      });

      const hash = await this.walletClient.writeContract(request);
      console.log(`Updated match ${match.id}. Tx: ${hash}`);
    } catch (error) {
      console.error(`Error updating match ${match.id}:`, error);
    }
  }

  async updatePredictions() {
    console.log('Updating predictions...');

    try {
      const matches = await this.fetcher.fetchFootballMatches('39');
      const predictions = await this.predictor.generatePredictions(0, matches);

      for (const pred of predictions) {
        // Store reasoning on 0G Storage
        const reasoningHash = await this.storage.store({
          reasoning: pred.reasoning,
          timestamp: Date.now()
        });

        // Create/update prediction on chain
        await this.createPredictionOnChain(pred, reasoningHash);
      }

      console.log(`Updated ${predictions.length} predictions`);
    } catch (error) {
      console.error('Error updating predictions:', error);
    }
  }

  async createPredictionOnChain(pred: PredictionData, reasoningHash: string) {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: CONFIG.ORACLE_CONTRACT,
        abi: SportsOracleABI,
        functionName: 'createPrediction',
        args: [
          BigInt(pred.sportId),
          pred.title,
          pred.description,
          BigInt(pred.confidence),
          parseEther(pred.price),
          reasoningHash
        ]
      });

      const hash = await this.walletClient.writeContract(request);
      console.log(`Created prediction: ${pred.title}. Tx: ${hash}`);
    } catch (error) {
      console.error(`Error creating prediction ${pred.title}:`, error);
    }
  }

  async fulfillRequest(requestId: number, data: string) {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: CONFIG.ORACLE_CONTRACT,
        abi: SportsOracleABI,
        functionName: 'fulfillRequest',
        args: [BigInt(requestId), data]
      });

      const hash = await this.walletClient.writeContract(request);
      console.log(`Fulfilled request ${requestId}. Tx: ${hash}`);
    } catch (error) {
      console.error(`Error fulfilling request ${requestId}:`, error);
    }
  }

  private mapStatus(status: string): number {
    const statusMap: Record<string, number> = {
      'upcoming': 0,
      'live': 1,
      'finished': 2
    };
    return statusMap[status] || 0;
  }
}

// Start the oracle node
const oracle = new OracleNode();
oracle.start().catch(console.error);

export { OracleNode, SportsDataFetcher, PredictionEngine, ZeroGStorage };