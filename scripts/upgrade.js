// scripts/upgrade.js

const fs = require('fs');
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading contract with the account:", await deployer.getAddress());

  // Load addresses from addresses.json
  const addresses = JSON.parse(fs.readFileSync('addresses.json', 'utf8'));
  const proxyAddress = addresses.VulnerableBankV1UUPSProxy;  // Address of the proxy contract

  // Deploy the new implementation
  const VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");
  const newImplementation = await upgrades.deployProxy(VulnerableBankV2, [], {
    initializer: "initialize",
    kind: "uups",
  });

  // Wait for the new implementation to be deployed
  await newImplementation.waitForDeployment();

  // Retrieve the new implementation address
  const newImplementationAddress = await newImplementation.getAddress();
  console.log("New implementation deployed to:", newImplementationAddress);

  // Upgrade the proxy to use the new implementation
  const upgradedProxy = await upgrades.upgradeProxy(proxyAddress, VulnerableBankV2, {
    kind: "uups"
  });

  // Wait for the upgrade to complete
  await upgradedProxy.waitForDeployment();

  console.log("Contract upgraded to new implementation");

  // Save the new implementation address to addresses.json
  addresses.VulnerableBankV2UUPSProxy = newImplementationAddress;
  fs.writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));

  console.log('Updated contract addresses saved to addresses.json');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
