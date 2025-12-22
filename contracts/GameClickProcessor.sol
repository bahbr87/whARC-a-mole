// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./GameCredits.sol";

/**
 * @title GameClickProcessor
 * @dev Contract that processes game clicks and consumes credits
 * This contract is authorized to consume credits on behalf of players
 */
contract GameClickProcessor is Ownable {
    GameCredits public gameCredits;
    
    // Mapping: authorized game contracts => allowed
    mapping(address => bool) public authorizedGames;
    
    event ClickProcessed(
        address indexed player,
        bytes32 indexed sessionId,
        uint256 clickCount,
        uint256 creditsConsumed
    );
    
    constructor(address _gameCredits) Ownable(msg.sender) {
        require(_gameCredits != address(0), "Invalid GameCredits address");
        gameCredits = GameCredits(_gameCredits);
    }
    
    /**
     * @dev Initialize - authorize this contract in GameCredits
     * Must be called after deployment to enable credit consumption
     */
    function initialize() external onlyOwner {
        gameCredits.authorizeConsumer(address(this));
    }
    
    /**
     * @dev Authorize a game contract to process clicks
     */
    function authorizeGame(address gameContract) external onlyOwner {
        authorizedGames[gameContract] = true;
    }
    
    /**
     * @dev Revoke authorization for a game contract
     */
    function revokeGame(address gameContract) external onlyOwner {
        authorizedGames[gameContract] = false;
    }
    
    /**
     * @dev Process clicks for a player (consumes credits)
     * This can be called by authorized game contracts without user signature
     * @param player Address of the player
     * @param sessionId Game session identifier
     * @param clickCount Number of clicks to process
     */
    function processClicks(
        address player,
        bytes32 sessionId,
        uint256 clickCount
    ) external {
        require(authorizedGames[msg.sender] || msg.sender == owner(), "Not authorized");
        require(clickCount > 0, "Click count must be greater than 0");
        
        // Consume credits (this will revert if insufficient)
        gameCredits.consumeCredits(player, clickCount);
        
        emit ClickProcessed(player, sessionId, clickCount, clickCount);
    }
    
    /**
     * @dev Batch process clicks for multiple players (for efficiency)
     */
    function batchProcessClicks(
        address[] calldata players,
        bytes32[] calldata sessionIds,
        uint256[] calldata clickCounts
    ) external {
        require(authorizedGames[msg.sender] || msg.sender == owner(), "Not authorized");
        require(
            players.length == sessionIds.length && players.length == clickCounts.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < players.length; i++) {
            if (clickCounts[i] > 0) {
                gameCredits.consumeCredits(players[i], clickCounts[i]);
                emit ClickProcessed(players[i], sessionIds[i], clickCounts[i], clickCounts[i]);
            }
        }
    }
}

