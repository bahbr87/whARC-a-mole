// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameCredits
 * @dev Contract for managing game credits - players buy credits upfront,
 * then consume them per click without needing wallet signatures
 */
contract GameCredits is Ownable, ReentrancyGuard {
    IERC20 public usdcToken;
    
    // Cost per click in USDC (6 decimals) - 0.005 USDC = 5000 (with 6 decimals)
    uint256 public constant CLICK_COST = 5000; // 0.005 USDC per click
    
    // Price per credit (in USDC with 6 decimals)
    // 1 credit = 1 click, so 1 credit = 0.005 USDC
    // 1000 credits = 5 USDC
    uint256 public constant CREDIT_PRICE = 5000; // 0.005 USDC per credit
    
    // Mapping: player => credit balance
    mapping(address => uint256) public credits;
    
    // Mapping: player => total credits purchased (for tracking)
    mapping(address => uint256) public totalCreditsPurchased;
    
    // Mapping: player => total clicks consumed (for tracking)
    mapping(address => uint256) public totalClicksConsumed;
    
    // Mapping: authorized contracts that can consume credits
    mapping(address => bool) public authorizedConsumers;
    
    // Total revenue from credit sales
    uint256 public totalRevenue;
    
    event CreditsPurchased(
        address indexed player,
        uint256 amount,
        uint256 creditsReceived,
        uint256 totalCost
    );
    
    event CreditsConsumed(
        address indexed player,
        uint256 clickCount,
        uint256 creditsUsed,
        uint256 remainingCredits
    );
    
    event CreditsRefunded(
        address indexed player,
        uint256 credits,
        uint256 usdcRefunded
    );
    
    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }
    
    /**
     * @dev Authorize a contract to consume credits
     */
    function authorizeConsumer(address consumer) external onlyOwner {
        authorizedConsumers[consumer] = true;
    }
    
    /**
     * @dev Revoke authorization for a contract
     */
    function revokeConsumer(address consumer) external onlyOwner {
        authorizedConsumers[consumer] = false;
    }
    
    /**
     * @dev Purchase credits with USDC
     * @param creditAmount Number of credits to purchase
     */
    function purchaseCredits(uint256 creditAmount) external nonReentrant {
        require(creditAmount > 0, "Credit amount must be greater than 0");
        require(creditAmount <= 5000, "Max 5000 credits per purchase"); // Prevent abuse
        
        uint256 totalCost = creditAmount * CREDIT_PRICE;
        
        // Transfer USDC from player to contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), totalCost),
            "USDC transfer failed"
        );
        
        // Add credits to player's balance
        credits[msg.sender] += creditAmount;
        totalCreditsPurchased[msg.sender] += creditAmount;
        totalRevenue += totalCost;
        
        emit CreditsPurchased(msg.sender, creditAmount, creditAmount, totalCost);
    }
    
    /**
     * @dev Consume credits for clicks (called by authorized game contract or owner)
     * This function can be called without user signature if called by authorized contract
     * @param player Address of the player
     * @param clickCount Number of clicks to consume
     */
    function consumeCredits(address player, uint256 clickCount) external {
        // Only allow owner or authorized consumers to call this
        require(
            msg.sender == owner() || authorizedConsumers[msg.sender],
            "Not authorized"
        );
        
        require(clickCount > 0, "Click count must be greater than 0");
        
        uint256 creditsNeeded = clickCount * (CLICK_COST / CREDIT_PRICE); // Should be 1:1
        require(creditsNeeded == clickCount, "Credit calculation error");
        
        require(credits[player] >= creditsNeeded, "Insufficient credits");
        
        // Deduct credits
        credits[player] -= creditsNeeded;
        totalClicksConsumed[player] += clickCount;
        
        emit CreditsConsumed(player, clickCount, creditsNeeded, credits[player]);
    }
    
    /**
     * @dev Consume credits for clicks (self-service version - requires user signature)
     * This is a fallback if we want users to manually consume credits
     * @param clickCount Number of clicks to consume
     */
    function consumeCreditsSelf(uint256 clickCount) external nonReentrant {
        require(clickCount > 0, "Click count must be greater than 0");
        
        uint256 creditsNeeded = clickCount;
        require(credits[msg.sender] >= creditsNeeded, "Insufficient credits");
        
        // Deduct credits
        credits[msg.sender] -= creditsNeeded;
        totalClicksConsumed[msg.sender] += clickCount;
        
        emit CreditsConsumed(msg.sender, clickCount, creditsNeeded, credits[msg.sender]);
    }
    
    /**
     * @dev Get player's credit balance
     */
    function getCredits(address player) external view returns (uint256) {
        return credits[player];
    }
    
    /**
     * @dev Calculate cost to purchase credits
     */
    function calculatePurchaseCost(uint256 creditAmount) external pure returns (uint256) {
        return creditAmount * CREDIT_PRICE;
    }
    
    /**
     * @dev Withdraw collected revenue (owner only)
     */
    function withdrawRevenue() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No revenue to withdraw");
        
        require(
            usdcToken.transfer(owner(), balance),
            "USDC transfer failed"
        );
    }
    
    /**
     * @dev Refund unused credits (optional feature)
     * @param creditAmount Number of credits to refund
     */
    function refundCredits(uint256 creditAmount) external nonReentrant {
        require(creditAmount > 0, "Credit amount must be greater than 0");
        require(credits[msg.sender] >= creditAmount, "Insufficient credits to refund");
        
        uint256 usdcRefund = creditAmount * CREDIT_PRICE;
        
        // Deduct credits
        credits[msg.sender] -= creditAmount;
        
        // Refund USDC
        require(
            usdcToken.transfer(msg.sender, usdcRefund),
            "USDC transfer failed"
        );
        
        emit CreditsRefunded(msg.sender, creditAmount, usdcRefund);
    }
}

