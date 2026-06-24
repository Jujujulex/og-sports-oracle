import { createConfig, http } from 'wagmi';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import NETWORK_CONFIG from './network';

// Wagmi configuration for 0G testnet
export const config = createConfig({
  chains: [{
    id: NETWORK_CONFIG.testnet.chainId,
    name: NETWORK_CONFIG.testnet.chainName,
    nativeCurrency: NETWORK_CONFIG.testnet.nativeCurrency,
    rpcUrls: {
      default: { http: NETWORK_CONFIG.testnet.rpcUrls }
    },
    blockExplorers: {
      default: { 
        name: '0G Explorer', 
        url: NETWORK_CONFIG.testnet.blockExplorerUrls[0] 
      }
    }
  }],
  connectors: [
    injected(),
    walletConnect({ projectId: '0g-sports-oracle' }),
    coinbaseWallet({ appName: '0G Sports Oracle' })
  ],
  transports: {
    [NETWORK_CONFIG.testnet.chainId]: http(NETWORK_CONFIG.testnet.rpcUrls[0])
  }
});

export default config;