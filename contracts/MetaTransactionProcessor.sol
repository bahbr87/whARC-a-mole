// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./GameCredits.sol";

/**
 * @title MetaTransactionProcessor
 * @dev Processes game clicks via meta-transactions (EIP-712)
 * Users sign messages once, then backend submits transactions without user interaction
 */
contract MetaTransactionProcessor is Ownable, EIP712 {
    using ECDSA for bytes32;
    
    GameCredits public gameCredits;
    
    // EIP-712 type hash for ClickRequest
    bytes32 private constant CLICK_REQUEST_TYPEHASH = 
        keccak256("ClickRequest(address player,bytes32 sessionId,uint256 clickCount,uint256 nonce,uint256 deadline)");
    
    // Mapping: player => nonce (to prevent replay attacks)
    mapping(address => uint256) public nonces;
    
    // Mapping: player => authorized (if user wants to authorize unlimited clicks)
    mapping(address => bool) public authorized;
    
    // Relayer address (backend that submits transactions)
    address public relayer;
    
    event ClickProcessed(
        address indexed player,
        bytes32 indexed sessionId,
        uint256 clickCount,
        uint256 nonce
    );
    
    event PlayerAuthorized(address indexed player, bool authorized);
    
    constructor(
        address _gameCredits,
        address _relayer
    ) EIP712("GameClickProcessor", "1") Ownable(msg.sender) {
        // Note: EIP712 constructor sets up domain separator
        require(_gameCredits != address(0), "Invalid GameCredits address");
        require(_relayer != address(0), "Invalid relayer address");
        gameCredits = GameCredits(_gameCredits);
        relayer = _relayer;
    }
    
    /**
     * @dev Process a click via meta-transaction
     * @param player Address of the player
     * @param sessionId Game session identifier
     * @param clickCount Number of clicks (usually 1)
     * @param signature EIP-712 signature from the player
     */
    function processClick(
        address player,
        bytes32 sessionId,
        uint256 clickCount,
        uint256 deadline,
        bytes memory signature
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        require(clickCount > 0, "Click count must be greater than 0");
        require(clickCount <= 10, "Too many clicks in one transaction"); // Prevent abuse
        
        // Get current nonce
        uint256 currentNonce = nonces[player];
        
        // Recover signature
        bytes32 structHash = keccak256(abi.encode(
            CLICK_REQUEST_TYPEHASH,
            player,
            sessionId,
            clickCount,
            currentNonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        
        require(signer == player, "Invalid signature");
        
        // Increment nonce
        nonces[player]++;
        
        // Consume credits
        gameCredits.consumeCredits(player, clickCount);
        
        emit ClickProcessed(player, sessionId, clickCount, currentNonce);
    }
    
    /**
     * @dev Batch process clicks (for efficiency when needed)
     */
    function batchProcessClicks(
        address[] calldata players,
        bytes32[] calldata sessionIds,
        uint256[] calldata clickCounts,
        uint256[] calldata deadlines,
        bytes[] calldata signatures
    ) external {
        require(
            players.length == sessionIds.length &&
            players.length == clickCounts.length &&
            players.length == deadlines.length &&
            players.length == signatures.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < players.length; i++) {
            // Inline the processClick logic to avoid forward reference
            address player = players[i];
            bytes32 sessionId = sessionIds[i];
            uint256 clickCount = clickCounts[i];
            uint256 deadline = deadlines[i];
            bytes memory signature = signatures[i];
            
            require(block.timestamp <= deadline, "Signature expired");
            require(clickCount > 0, "Click count must be greater than 0");
            require(clickCount <= 10, "Too many clicks in one transaction");
            
            uint256 currentNonce = nonces[player];
            
            bytes32 structHash = keccak256(abi.encode(
                CLICK_REQUEST_TYPEHASH,
                player,
                sessionId,
                clickCount,
                currentNonce,
                deadline
            ));
            
            bytes32 hash = _hashTypedDataV4(structHash);
            address signer = hash.recover(signature);
            
            require(signer == player, "Invalid signature");
            
            nonces[player]++;
            gameCredits.consumeCredits(player, clickCount);
            
            emit ClickProcessed(player, sessionId, clickCount, currentNonce);
        }
    }
    
    /**
     * @dev Authorize unlimited clicks (optional - user can pre-authorize)
     * This allows the relayer to process clicks without individual signatures
     */
    function authorize() external {
        authorized[msg.sender] = true;
        emit PlayerAuthorized(msg.sender, true);
    }
    
    /**
     * @dev Revoke authorization
     */
    function revokeAuthorization() external {
        authorized[msg.sender] = false;
        emit PlayerAuthorized(msg.sender, false);
    }
    
    /**
     * @dev Process click for authorized player (no signature needed)
     */
    function processClickAuthorized(
        address player,
        bytes32 sessionId,
        uint256 clickCount
    ) external {
        require(msg.sender == relayer || msg.sender == owner(), "Not authorized");
        require(authorized[player], "Player not authorized");
        require(clickCount > 0, "Click count must be greater than 0");
        require(clickCount <= 10, "Too many clicks in one transaction");
        
        // Consume credits
        gameCredits.consumeCredits(player, clickCount);
        
        emit ClickProcessed(player, sessionId, clickCount, nonces[player]);
    }
    
    /**
     * @dev Update relayer address
     */
    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "Invalid relayer address");
        relayer = _relayer;
    }
    
    /**
     * @dev Get current nonce for a player
     */
    function getNonce(address player) external view returns (uint256) {
        return nonces[player];
    }
}

