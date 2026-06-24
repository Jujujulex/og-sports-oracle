# 0G Sports Oracle

Decentralized sports data and AI-powered prediction oracle on 0G Network.

## 🌐 Testnet Deployment

The app is configured for **0G Testnet**:

| Parameter | Value |
|-----------|-------|
| Chain ID | 16600 |
| RPC | https://rpc-testnet.0g.ai |
| Explorer | https://explorer-testnet.0g.ai |
| Faucet | https://faucet.0g.ai |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Get Testnet Tokens

Visit [0G Faucet](https://faucet.0g.ai) to get testnet $0G tokens.

### 4. Run Development Server

```bash
npm run dev
```

### 5. Deploy to Testnet

```bash
npx tsx scripts/deploy.ts
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Sports APIs   │────▶│   Oracle Node    │────▶│  0G Storage     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Smart Contract  │
                        │  (0G Testnet)    │
                        └──────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Frontend     │     │  Developer    │     │  Other        │
│  (React App)  │     │  API          │     │  dApps         │
└───────────────┘     └───────────────┘     └───────────────┘
```

## Smart Contract Integration

### Request Sports Data

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISportsOracle {
    function requestSportsData(
        uint256 sportId,
        string calldata queryType
    ) external payable returns (uint256 requestId);
}

contract MyDApp {
    ISportsOracle public oracle;
    
    constructor(address _oracle) {
        oracle = ISportsOracle(_oracle);
    }
    
    function fetchMatchResult(uint256 matchId) external payable {
        // Pay 0.01 $0G for match data
        oracle.requestSportsData{value: 0.01 ether}(1, "match_result");
    }
}
```

## API Reference

| Endpoint | Method | Description | Price |
|----------|--------|-------------|-------|
| `/v1/matches/live` | GET | Live match scores | 0.01 $0G |
| `/v1/matches/:id` | GET | Single match details | 0.01 $0G |
| `/v1/players/:id/stats` | GET | Player statistics | 0.02 $0G |
| `/v1/predictions/:id` | GET | Detailed prediction | 0.03-0.08 $0G |

## License

MIT License