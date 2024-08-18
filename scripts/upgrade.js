// scripts/upgrade.js

async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Upgrading contract with the account:", deployer.address);
  
    // The address of the proxy contract
    const proxyAddress = "0xYourProxyAddress";
  
    // Deploy the new implementation
    const VulnerableBankV2 = await ethers.getContractFactory("VulnerableBankV2");
    const newImplementation = await VulnerableBankV2.deploy();
    await newImplementation.deployed();
  
    console.log("New implementation deployed to:", newImplementation.address);
  
    // Upgrade the proxy to use the new implementation
    const proxy = await ethers.getContractAt("VulnerableBankV1", proxyAddress);
    await proxy.upgradeTo(newImplementation.address);
  
    console.log("Contract upgraded to new implementation");
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  