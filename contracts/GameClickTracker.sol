// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameClickTracker
 * @dev Contract to track game clicks and charge micro-fees per click
 * Uses batch processing to reduce gas costs
 */
contract GameClickTracker is Ownable, ReentrancyGuard {
    IERC20 public usdcToken;
    
    // Fee per click in USDC (6 decimals) - 0.00001 USDC = 10 (with 6 decimals)
    uint256 public constant CLICK_FEE = 10; // 0.00001 USDC
    
    // Mapping: gameSessionId => clickCount
    mapping(bytes32 => uint256) public gameSessions;
    
    // Mapping: player => totalClicks (for tracking)
    mapping(address => uint256) public playerTotalClicks;
    
    // Total fees collected
    uint256 public totalFeesCollected;
    
    event GameSessionStarted(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 timestamp
    );
    
    event ClicksRecorded(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 clickCount,
        uint256 totalFee
    );
    
    event GameSessionCompleted(
        bytes32 indexed sessionId,
        address indexed player,
        uint256 totalClicks,
        uint256 totalFee
    );
    
    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }
    
    /**
     * @dev Record clicks for a game session (batch processing)
     * @param sessionId Unique session identifier
     * @param clickCount Number of clicks to record
     */
    function recordClicks(bytes32 sessionId, uint256 clickCount) external nonReentrant {
        require(clickCount > 0, "Click count must be greater than 0");
        require(clickCount <= 1000, "Too many clicks in one batch"); // Prevent abuse
        
        uint256 totalFee = clickCount * CLICK_FEE;
        
        // Transfer USDC from player to contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), totalFee),
            "USDC transfer failed"
        );
        
        // Update session clicks
        gameSessions[sessionId] += clickCount;
        playerTotalClicks[msg.sender] += clickCount;
        totalFeesCollected += totalFee;
        
        emit ClicksRecorded(sessionId, msg.sender, clickCount, totalFee);
    }
    
    /**
     * @dev Start a new game session
     * @param sessionId Unique session identifier
     */
    function startGameSession(bytes32 sessionId) external {
        require(gameSessions[sessionId] == 0, "Session already exists");
        
        emit GameSessionStarted(sessionId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Complete a game session (optional, for tracking)
     * @param sessionId Unique session identifier
     */
    function completeGameSession(bytes32 sessionId) external {
        uint256 totalClicks = gameSessions[sessionId];
        require(totalClicks > 0, "Session has no clicks");
        
        uint256 totalFee = totalClicks * CLICK_FEE;
        
        emit GameSessionCompleted(sessionId, msg.sender, totalClicks, totalFee);
    }
    
    /**
     * @dev Withdraw collected fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        
        require(
            usdcToken.transfer(owner(), balance),
            "USDC transfer failed"
        );
    }
    
    /**
     * @dev Get click count for a session
     */
    function getSessionClicks(bytes32 sessionId) external view returns (uint256) {
        return gameSessions[sessionId];
    }
    
    /**
     * @dev Calculate fee for a number of clicks
     */
    function calculateFee(uint256 clickCount) external pure returns (uint256) {
        return clickCount * CLICK_FEE;
    }
}







