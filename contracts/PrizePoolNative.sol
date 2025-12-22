// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  PrizePool NATIVO para Arc Testnet

  - Usa USDC nativo (saldo da própria rede)

  - NÃO usa ERC20

  - NÃO usa MockUSDC

  - NÃO quebra transferências
*/

contract PrizePoolNative {
    address public owner;

    // day (days since epoch UTC) => rank => winner
    mapping(uint256 => mapping(uint256 => address)) public dailyWinners;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Permite receber USDC nativo diretamente
    receive() external payable {}

    // Registrar vencedores do dia (1º, 2º, 3º)
    function setDailyWinners(
        uint256 day,
        address first,
        address second,
        address third
    ) external onlyOwner {
        dailyWinners[day][1] = first;
        dailyWinners[day][2] = second;
        dailyWinners[day][3] = third;
    }

    // Claim do premio (somente o vencedor pode chamar)
    function claim(uint256 day, uint256 rank, uint256 amount) external {
        require(dailyWinners[day][rank] == msg.sender, "Not the winner");
        require(address(this).balance >= amount, "Insufficient balance");

        // evita double-claim
        dailyWinners[day][rank] = address(0);

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // Owner pode sacar fundos se precisar
    function withdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}




