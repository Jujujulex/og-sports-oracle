// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title 0G Sports Oracle
 * @notice Decentralized sports data and prediction oracle on 0G Network
 * @dev Pay-per-request model with verifiable on-chain data
 * 
 * Integration with 0G:
 * - Uses 0G Storage for historical data persistence
 * - Leverages 0G DA layer for data availability
 * - Can integrate with 0G Compute for AI inference verification
 */

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface I0GStorage {
    function storeData(bytes calldata data) external returns (bytes32 hash);
    function retrieveData(bytes32 hash) external view returns (bytes memory);
}

contract SportsOracle is AccessControl, ReentrancyGuard, Pausable {
    // Roles
    bytes32 public constant ORACLE_NODE = keccak256("ORACLE_NODE");
    bytes32 public constant ADMIN = keccak256("ADMIN");

    // Structs
    struct Sport {
        uint256 id;
        string name;
        bool active;
        uint256 basePrice; // Base price in wei (0G has 18 decimals)
    }

    struct Match {
        uint256 id;
        uint256 sportId;
        string homeTeam;
        string awayTeam;
        uint256 homeScore;
        uint256 awayScore;
        uint256 timestamp;
        MatchStatus status;
        string league;
    }

    struct Prediction {
        uint256 id;
        uint256 sportId;
        string title;
        string description;
        uint256 confidence;
        uint256 price;
        string reasoningHash; // IPFS/0G Storage hash for detailed reasoning
        uint256 timestamp;
        bool active;
    }

    struct DataRequest {
        uint256 id;
        address requester;
        uint256 sportId;
        string queryType;
        uint256 payment;
        uint256 timestamp;
        bool fulfilled;
        string responseData; // Or hash to 0G Storage for large data
    }

    enum MatchStatus { Upcoming, Live, Finished, Postponed, Cancelled }

    // State
    mapping(uint256 => Sport) public sports;
    mapping(uint256 => Match) public matches;
    mapping(uint256 => Prediction) public predictions;
    mapping(uint256 => DataRequest) public requests;
    
    mapping(string => uint256) public sportNameToId;
    mapping(uint256 => uint256[]) public sportMatches;
    mapping(address => uint256[]) public userRequests;
    
    uint256 public sportCount;
    uint256 public matchCount;
    uint256 public predictionCount;
    uint256 public requestCount;
    
    uint256 public treasuryBalance;
    address public treasury;
    I0GStorage public storageContract;

    // Events
    event SportAdded(uint256 indexed sportId, string name, uint256 basePrice);
    event MatchAdded(uint256 indexed matchId, uint256 indexed sportId, string homeTeam, string awayTeam);
    event MatchUpdated(uint256 indexed matchId, MatchStatus status, uint256 homeScore, uint256 awayScore);
    event PredictionCreated(uint256 indexed predictionId, uint256 indexed sportId, string title, uint256 price);
    event PredictionUpdated(uint256 indexed predictionId, uint256 confidence, string reasoningHash);
    event DataRequested(uint256 indexed requestId, address indexed requester, uint256 sportId, string queryType, uint256 payment);
    event DataFulfilled(uint256 indexed requestId, string responseData);
    event PriceUpdated(uint256 indexed sportId, uint256 newPrice);
    event TreasuryWithdrawn(address indexed to, uint256 amount);

    // Modifiers
    modifier onlyOracleNode() {
        require(hasRole(ORACLE_NODE, msg.sender), "Not authorized oracle node");
        _;
    }

    constructor(address _treasury, address _storageContract) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN, msg.sender);
        _grantRole(ORACLE_NODE, msg.sender);
        
        treasury = _treasury;
        storageContract = I0GStorage(_storageContract);
    }

    // ============ Sport Management ============

    function addSport(string calldata name, uint256 basePrice) external onlyRole(ADMIN) {
        sportCount++;
        sports[sportCount] = Sport({
            id: sportCount,
            name: name,
            active: true,
            basePrice: basePrice
        });
        sportNameToId[name] = sportCount;
        emit SportAdded(sportCount, name, basePrice);
    }

    function updateSportPrice(uint256 sportId, uint256 newPrice) external onlyRole(ADMIN) {
        require(sports[sportId].id != 0, "Sport not found");
        sports[sportId].basePrice = newPrice;
        emit PriceUpdated(sportId, newPrice);
    }

    // ============ Match Management (Oracle Nodes) ============

    function addMatch(
        uint256 sportId,
        string calldata homeTeam,
        string calldata awayTeam,
        uint256 timestamp,
        string calldata league
    ) external onlyOracleNode {
        require(sports[sportId].active, "Sport not active");
        
        matchCount++;
        matches[matchCount] = Match({
            id: matchCount,
            sportId: sportId,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            homeScore: 0,
            awayScore: 0,
            timestamp: timestamp,
            status: MatchStatus.Upcoming,
            league: league
        });
        
        sportMatches[sportId].push(matchCount);
        emit MatchAdded(matchCount, sportId, homeTeam, awayTeam);
    }

    function updateMatchResult(
        uint256 matchId,
        MatchStatus status,
        uint256 homeScore,
        uint256 awayScore
    ) external onlyOracleNode {
        require(matches[matchId].id != 0, "Match not found");
        
        Match storage m = matches[matchId];
        m.status = status;
        m.homeScore = homeScore;
        m.awayScore = awayScore;
        
        // Store result in 0G Storage for historical data
        bytes memory matchData = abi.encode(m);
        bytes32 dataHash = storageContract.storeData(matchData);
        
        emit MatchUpdated(matchId, status, homeScore, awayScore);
    }

    // ============ Predictions (AI-powered via 0G Compute) ============

    function createPrediction(
        uint256 sportId,
        string calldata title,
        string calldata description,
        uint256 confidence,
        uint256 price,
        string calldata reasoningHash
    ) external onlyOracleNode {
        require(sports[sportId].active, "Sport not active");
        require(confidence <= 100, "Invalid confidence");
        
        predictionCount++;
        predictions[predictionCount] = Prediction({
            id: predictionCount,
            sportId: sportId,
            title: title,
            description: description,
            confidence: confidence,
            price: price,
            reasoningHash: reasoningHash,
            timestamp: block.timestamp,
            active: true
        });
        
        emit PredictionCreated(predictionCount, sportId, title, price);
    }

    function updatePrediction(
        uint256 predictionId,
        uint256 confidence,
        string calldata reasoningHash
    ) external onlyOracleNode {
        require(predictions[predictionId].active, "Prediction not active");
        
        predictions[predictionId].confidence = confidence;
        predictions[predictionId].reasoningHash = reasoningHash;
        predictions[predictionId].timestamp = block.timestamp;
        
        emit PredictionUpdated(predictionId, confidence, reasoningHash);
    }

    // ============ Data Requests (Pay-per-use) ============

    function requestSportsData(
        uint256 sportId,
        string calldata queryType
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(sports[sportId].active, "Sport not active");
        require(msg.value >= sports[sportId].basePrice, "Insufficient payment");
        
        requestCount++;
        requests[requestCount] = DataRequest({
            id: requestCount,
            requester: msg.sender,
            sportId: sportId,
            queryType: queryType,
            payment: msg.value,
            timestamp: block.timestamp,
            fulfilled: false,
            responseData: ""
        });
        
        userRequests[msg.sender].push(requestCount);
        treasuryBalance += msg.value;
        
        emit DataRequested(requestCount, msg.sender, sportId, queryType, msg.value);
        
        return requestCount;
    }

    function fulfillRequest(
        uint256 requestId,
        string calldata responseData
    ) external onlyOracleNode {
        require(requests[requestId].id != 0, "Request not found");
        require(!requests[requestId].fulfilled, "Already fulfilled");
        
        requests[requestId].fulfilled = true;
        requests[requestId].responseData = responseData;
        
        emit DataFulfilled(requestId, responseData);
    }

    // ============ View Functions ============

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getPrediction(uint256 predictionId) external view returns (Prediction memory) {
        return predictions[predictionId];
    }

    function getUserRequests(address user) external view returns (uint256[] memory) {
        return userRequests[user];
    }

    function getSportMatches(uint256 sportId) external view returns (uint256[] memory) {
        return sportMatches[sportId];
    }

    function getPrice(uint256 sportId) external view returns (uint256) {
        return sports[sportId].basePrice;
    }

    // ============ Treasury ============

    function withdrawTreasury(uint256 amount) external onlyRole(ADMIN) {
        require(amount <= treasuryBalance, "Insufficient balance");
        treasuryBalance -= amount;
        payable(treasury).transfer(amount);
        emit TreasuryWithdrawn(treasury, amount);
    }

    // ============ Emergency ============

    function pause() external onlyRole(ADMIN) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN) {
        _unpause();
    }
}