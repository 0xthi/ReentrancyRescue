// scripts/deploy.js

const fs = require('fs');
const { ethers, upgrades } = require("hardhat");

async function main() {
  // Get the contract factory for VulnerableBankV1
  const VulnerableBankV1 = await ethers.getContractFactory("VulnerableBankV1");

  // Deploy the UUPS proxy for the VulnerableBankV1 contract
  const vulnerableBankV1Proxy = await upgrades.deployProxy(
    VulnerableBankV1, 
    [], 
    { 
      initializer: "initialize",
      kind: "uups",
    }
  );

  // Wait for the proxy deployment to complete
  await vulnerableBankV1Proxy.waitForDeployment();

  // Retrieve the proxy address asynchronously
  const proxyAddress = await vulnerableBankV1Proxy.getAddress();
  console.log(`VulnerableBankV1 UUPS Proxy deployed to: ${proxyAddress}`);
  
  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`Implementation address: ${implementationAddress}`);
  
  // Save addresses to addresses.json
  const addresses = {
    VulnerableBankV1UUPSProxy: proxyAddress,
    VulnerableBankV1Implementation: implementationAddress
  };

  fs.writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));

  console.log('Deployed contract addresses saved to addresses.json');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
