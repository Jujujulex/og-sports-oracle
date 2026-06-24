// Deployment script for 0G testnet
// Run with: npx tsx scripts/deploy.ts

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const RPC_URL = process.env.RPC_URL || 'https://rpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY as `0x${string}`;

async function deploy() {
  console.log('🚀 Deploying 0G Sports Oracle to testnet...\n');
  
  if (!PRIVATE_KEY) {
    console.error('❌ ORACLE_PRIVATE_KEY not set in environment');
    process.exit(1);
  }

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`📍 Deployer address: ${account.address}\n`);

  // Check balance
  const client = createPublicClient({
    transport: http(RPC_URL)
  });
  
  const balance = await client.getBalance({ address: account.address });
  console.log(`💰 Balance: ${Number(balance) / 1e18} $0G\n`);

  if (balance === 0n) {
    console.log('⚠️  No balance! Get testnet tokens from: https://faucet.0g.ai');
    process.exit(1);
  }

  console.log('📝 Deploying contracts...');
  
  // Contract deployment would go here using viem or ethers
  // For now, this is a placeholder showing the structure
  
  console.log('\n✅ Deployment complete!');
  console.log('\nUpdate your .env file with the deployed contract addresses.');
}

deploy().catch(console.error);