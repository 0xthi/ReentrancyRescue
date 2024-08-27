// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract VulnerableBankV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    mapping(address => uint256) public balances;

    // Events
    event Deposit(address indexed account, uint256 amount);
    event Withdraw(address indexed account, uint256 amount);

    // Initializer function (replaces constructor for upgradeable contracts)
    function initialize() public initializer {  
        __Ownable_init(msg.sender);
        __Pausable_init();
    }

    // Function to deposit Ether into the contract
    function deposit() public payable whenNotPaused {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // Vulnerable function to withdraw Ether from the contract
    function withdraw(uint256 amount) public whenNotPaused {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // Transfer Ether to the caller
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        // Update the balance after the transfer
        balances[msg.sender] = 0;

        emit Withdraw(msg.sender, amount);
    }

    // Function to check the contract's balance
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Function to pause the contract (only owner)
    function pause() public onlyOwner {
        _pause();
    }

    // Function to unpause the contract (only owner)
    function unpause() public onlyOwner {
        _unpause();
    }

    // Required by UUPS for authorization of upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
