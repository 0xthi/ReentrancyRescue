require('dotenv').config();
const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
const fs = require('fs');
const path = require('path');

// Load the ABI from the JSON file
const artifactPath = path.resolve(__dirname, '../artifacts/contracts/VulnerableBankV1.sol/VulnerableBankV1.json');
const contractJson = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
const abi = contractJson.abi;

// Load the addresses from addresses.json
const addressesPath = "./addresses.json";
let addresses = {};
if (fs.existsSync(addressesPath)) {
  addresses = JSON.parse(fs.readFileSync(addressesPath));
}

// Alchemy WebSocket URL
const ALCHEMY_WEBSOCKET_URL = process.env.ALCHEMY_WEBSOCKET_URL;
const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1;
const PRIVATE_KEY_2 = process.env.PRIVATE_KEY_2; // Add this line

// Initialize WebSocket provider
const provider = new ethers.WebSocketProvider(ALCHEMY_WEBSOCKET_URL);
const wallet1 = new ethers.Wallet(PRIVATE_KEY_1, provider);
const wallet2 = new ethers.Wallet(PRIVATE_KEY_2, provider); // Add this line

const authSigner = new ethers.Wallet(
  "0x2000000000000000000000000000000000000000000000000000000000000000"
);

async function main() {
  // Initialize Flashbots provider for Sepolia
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    'https://relay-sepolia.flashbots.net',  // Sepolia network URL for Flashbots
    'sepolia'  // Specify the correct network
  );

  const iface = new ethers.Interface(abi);
  const proxyAddress = addresses.VulnerableBankV1UUPSProxy;
  const contract = new ethers.Contract(proxyAddress, abi, provider);
  
  // Connect the contract to the second wallet
  const contractWithSigner = contract.connect(wallet2);

  let lastBalance = await provider.getBalance(proxyAddress);
  const balanceChangeThreshold = ethers.parseEther("0.000005"); // Adjust as needed
  const timeWindow = 1000; // 1 second
  let lastWithdrawalTime = 0;
  let withdrawalCount = 0;

  // Listen for Withdraw events
  contract.on("Withdraw", async (account, amount, event) => {
    const currentTime = Date.now();
    const currentBalance = await provider.getBalance(proxyAddress);
    const balanceChange = lastBalance - currentBalance;

    if (currentTime - lastWithdrawalTime <= timeWindow) {
      withdrawalCount++;
    } else {
      withdrawalCount = 1;
    }

    lastWithdrawalTime = currentTime;

    console.log(`Withdrawal detected from ${account}. Amount: ${ethers.formatEther(amount)} ETH`);
    console.log(`Balance decreased by ${ethers.formatEther(balanceChange)} ETH`);
    console.log(`Withdrawal count in last ${timeWindow}ms: ${withdrawalCount}`);

    if (withdrawalCount >= 2 || balanceChange >= balanceChangeThreshold) {
      console.log('Potential reentrancy attack detected!');
      console.log('Attempting to pause contract...');

      try {
        const pauseTx = await contractWithSigner.pause();
        console.log('Pause transaction submitted:', pauseTx.hash);
        
        const receipt = await pauseTx.wait();
        console.log('Pause transaction confirmed in block:', receipt.blockNumber);
      } catch (error) {
        console.error('Error while attempting to pause the contract:', error);
      }
    }

    lastBalance = currentBalance;
  });

  // Also monitor Deposit events to reset the withdrawal count
  contract.on("Deposit", (account, amount, event) => {
    withdrawalCount = 0;
    console.log(`Deposit detected from ${account}. Amount: ${ethers.formatEther(amount)} ETH`);
  });

  console.log('Contract event monitoring started...');
}

main().catch(console.error);

