import { useState, useEffect, useCallback } from 'react';
import { encodeFunctionData } from 'viem';
import NETWORK_CONFIG from './network';

// Minimal ABI for the one payable entrypoint the frontend calls.
const ORACLE_ABI = [
  {
    name: 'requestSportsData',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'sportId', type: 'uint256' },
      { name: 'queryType', type: 'string' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// Minimal EIP-1193 provider typing so we don't need wagmi/ethers just to connect.
interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const { chainId, chainName, nativeCurrency, rpcUrls, blockExplorerUrls } =
  NETWORK_CONFIG.testnet;

// 0G chain id as the 0x-prefixed hex string wallets expect.
const HEX_CHAIN_ID = `0x${chainId.toString(16)}`;

const ADD_CHAIN_PARAMS = {
  chainId: HEX_CHAIN_ID,
  chainName,
  nativeCurrency,
  rpcUrls,
  blockExplorerUrls,
};

/** Prompt the wallet to switch to the 0G chain, adding it first if unknown. */
async function ensureChain(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEX_CHAIN_ID }],
    });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet. Add it, then it becomes active.
    if (err?.code === 4902 || err?.data?.originalError?.code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [ADD_CHAIN_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

export interface WalletState {
  address: string | null;
  shortAddress: string;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToOgChain: () => Promise<void>;
  /**
   * Pay the SportsOracle contract for a data request via the payable
   * requestSportsData(sportId, queryType) entrypoint. Returns the tx hash.
   * Throws on rejection/revert.
   */
  requestData: (sportId: bigint, queryType: string, amountWei: bigint) => Promise<string>;
}

const shorten = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = typeof window !== 'undefined' ? window.ethereum : undefined;

  // Restore an already-authorized session and subscribe to wallet events.
  useEffect(() => {
    if (!provider) return;

    provider
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0) setAddress(list[0]);
      })
      .catch(() => {});

    provider
      .request({ method: 'eth_chainId' })
      .then((id) => setCurrentChainId(id as string))
      .catch(() => {});

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts.length > 0 ? accounts[0] : null);
    };
    const handleChainChanged = (id: string) => setCurrentChainId(id);

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    setError(null);

    if (!provider) {
      setError('No EVM wallet found. Please install MetaMask.');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (accounts.length > 0) setAddress(accounts[0]);

      await ensureChain(provider);
      const id = (await provider.request({ method: 'eth_chainId' })) as string;
      setCurrentChainId(id);
    } catch (err: any) {
      // 4001 = user rejected the request.
      if (err?.code === 4001) {
        setError('Connection request rejected.');
      } else {
        setError(err?.message ?? 'Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [provider]);

  const switchToOgChain = useCallback(async () => {
    if (!provider) return;
    setError(null);
    try {
      await ensureChain(provider);
      const id = (await provider.request({ method: 'eth_chainId' })) as string;
      setCurrentChainId(id);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to switch network.');
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    // EIP-1193 has no programmatic disconnect; clear local state.
    setAddress(null);
    setError(null);
  }, []);

  const requestData = useCallback(
    async (sportId: bigint, queryType: string, amountWei: bigint): Promise<string> => {
      if (!provider) throw new Error('No wallet connected.');
      if (!address) throw new Error('Connect your wallet first.');
      // Make sure the call runs on the 0G chain, not whatever was selected.
      await ensureChain(provider);
      // Encode the payable requestSportsData call so the contract doesn't
      // revert (a plain value transfer has no payable receiver here).
      const data = encodeFunctionData({
        abi: ORACLE_ABI,
        functionName: 'requestSportsData',
        args: [sportId, queryType],
      });
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: NETWORK_CONFIG.contracts.sportsOracle,
            value: `0x${amountWei.toString(16)}`,
            data,
          },
        ],
      })) as string;
      return txHash;
    },
    [provider, address]
  );

  return {
    address,
    shortAddress: address ? shorten(address) : '',
    isConnected: !!address,
    isCorrectChain: currentChainId?.toLowerCase() === HEX_CHAIN_ID.toLowerCase(),
    isConnecting,
    error,
    connect,
    disconnect,
    switchToOgChain,
    requestData,
  };
}

export default useWallet;
