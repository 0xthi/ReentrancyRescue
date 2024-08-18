// Required for file system operations
const fs = require('fs');
const hre = require("hardhat");

async function main() {
  // Get the contract factory for VulnerableBankV1
  const VulnerableBankV1 = await hre.ethers.getContractFactory("VulnerableBankV1");

  // Deploy the contract
  const vulnerableBankV1 = await VulnerableBankV1.deploy();
  await vulnerableBankV1.deploy();

  // Console log the deployed contract address
  console.log(`VulnerableBankV1 deployed to: ${vulnerableBankV1.address}`);

  // Save the deployed contract address to addresses.json
  const addresses = {
    VulnerableBankV1: vulnerableBankV1.address
  };

  fs.writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));

  console.log('Deployed contract address saved to addresses.json');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
