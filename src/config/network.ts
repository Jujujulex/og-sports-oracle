// 0G Network Configuration
// Testnet configuration for 0G Sports Oracle

export const NETWORK_CONFIG = {
  // 0G Galileo Testnet
  testnet: {
    chainId: 16602,
    chainName: '0G Galileo Testnet',
    nativeCurrency: {
      name: '0G',
      symbol: '0G',
      decimals: 18
    },
    rpcUrls: ['https://evmrpc-testnet.0g.ai'],
    blockExplorerUrls: ['https://chainscan-galileo.0g.ai'],
    faucet: 'https://faucet.0g.ai'
  },
  
  // Contract addresses (override per-environment with VITE_ORACLE_CONTRACT).
  contracts: {
    sportsOracle: (import.meta.env.VITE_ORACLE_CONTRACT ??
      '0xe242d4a4b67e3034f2846250aE4CA8940BC4f356') as `0x${string}`,
    storage: '0x0000000000000000000000000000000000000000' as `0x${string}`
  },
  
  // API endpoints
  api: {
    oracle: 'https://oracle-api-testnet.0g.ai',
    storage: 'https://storage-testnet.0g.ai'
  }
};

// Pricing in $0G (wei)
export const PRICING = {
  matchResult: BigInt('10000000000000000'), // 0.01 $0G
  playerStats: BigInt('20000000000000000'), // 0.02 $0G
  teamForm: BigInt('15000000000000000'),    // 0.015 $0G
  predictionBasic: BigInt('30000000000000000'), // 0.03 $0G
  predictionPremium: BigInt('80000000000000000') // 0.08 $0G
};

export default NETWORK_CONFIG;