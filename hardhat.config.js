require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
        details: { yul: false },
      },
    },
  },
  
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      mining: {
        auto: false,
        interval: 1000,
      },
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      gasPrice: 20000000000, // Adjust the gasPrice as needed for your tests
      accounts:[process.env.PRIVATE_KEY_1,process.env.PRIVATE_KEY_2],
    },
    bsctest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: "auto",
      accounts: [process.env.PRIVATE_KEY_1,process.env.PRIVATE_KEY_2],
    },
    sepolia: {
      url: process.env.HTTPS_RPC_URL,
      chainId: 11155111,
      gasPrice: "auto", // Example gas price in wei
      accounts:[process.env.PRIVATE_KEY_1,process.env.PRIVATE_KEY_2],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  sourcify: {
    enabled: true
  },
  mocha: {
    timeout: 40000,
  },
}
