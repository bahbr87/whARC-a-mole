// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PrizePool is Ownable {
    IERC20 public immutable usdc;

    // prizes[0] = 1º, prizes[1] = 2º, prizes[2] = 3º
    uint256[3] public prizes;

    // day => rank (1,2,3) => winner
    mapping(uint256 => mapping(uint256 => address)) public winners;

    // day => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;

    // day => total players
    mapping(uint256 => uint256) public totalPlayers;

    event WinnersRegistered(uint256 indexed day);
    event PrizeClaimed(uint256 indexed day, address indexed user, uint256 amount);

    constructor(
        address _usdc,
        uint256 _first,
        uint256 _second,
        uint256 _third
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        prizes = [_first, _second, _third];
    }

    /* ========== ADMIN ========== */

    /**
     * @notice Register daily winners (top 3 max)
     * @dev Must be called once per day
     */
    function setDailyWinners(
        uint256 day,
        address[] calldata _winners,
        uint256 _totalPlayers
    ) external onlyOwner {
        require(_winners.length <= 3, "Max 3 winners");
        require(totalPlayers[day] == 0, "Day already finalized");

        totalPlayers[day] = _totalPlayers;

        for (uint256 i = 0; i < _winners.length; i++) {
            winners[day][i + 1] = _winners[i];
        }

        emit WinnersRegistered(day);
    }

    /**
     * @notice Emergency/manual withdraw of remaining USDC
     */
    function withdraw(uint256 amount) external onlyOwner {
        usdc.transfer(owner(), amount);
    }

    /* ========== VIEW ========== */

    function getWinner(uint256 day, uint256 rank)
        external
        view
        returns (address)
    {
        return winners[day][rank];
    }

    function getPrizeForRank(uint256 rank, uint256 players)
        public
        view
        returns (uint256)
    {
        if (rank == 0 || rank > 3) return 0;
        if (rank > players) return 0;
        return prizes[rank - 1];
    }

    function canClaim(uint256 day, address user)
        external
        view
        returns (bool)
    {
        if (claimed[day][user]) return false;

        uint256 players = totalPlayers[day];
        if (players == 0) return false;

        for (uint256 rank = 1; rank <= 3; rank++) {
            if (winners[day][rank] == user) {
                uint256 prize = getPrizeForRank(rank, players);
                return prize > 0;
            }
        }

        return false;
    }

    /* ========== CLAIM ========== */

    function claim(uint256 day) external {
        require(!claimed[day][msg.sender], "Already claimed");

        uint256 players = totalPlayers[day];
        require(players > 0, "Day not finalized");

        uint256 prize;
        bool isWinner = false;

        for (uint256 rank = 1; rank <= 3; rank++) {
            if (winners[day][rank] == msg.sender) {
                prize = getPrizeForRank(rank, players);
                isWinner = true;
                break;
            }
        }

        require(isWinner, "Not a winner");
        require(prize > 0, "No prize");

        claimed[day][msg.sender] = true;
        usdc.transfer(msg.sender, prize);

        emit PrizeClaimed(day, msg.sender, prize);
    }
}
