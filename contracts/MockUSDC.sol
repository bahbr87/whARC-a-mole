// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing on Arc Network
 * This is a simple ERC20 token with 6 decimals (like real USDC)
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _decimals = 6;
    
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        // Mint 1,000,000 USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens (for testing purposes)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}







