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
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Initialize WebSocket provider
const provider = new ethers.WebSocketProvider(ALCHEMY_WEBSOCKET_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

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

  provider.on('pending', async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (tx && tx.to === proxyAddress && tx.data && tx.data.length > 2) {
        // Try to parse the transaction
        let decodedTx = null;
        try {
          decodedTx = iface.parseTransaction({ data: tx.data });
        } catch (parseError) {
          console.error(`Failed to parse transaction data for txHash: ${txHash}`, parseError);
        }

        if (decodedTx) {
          // Check if the transaction is calling the `withdraw` function
          let withdrawCount = 0;
          if (decodedTx.name === "withdraw") {
            withdrawCount += 1;
          }

          // If more than one withdraw event is detected, pause the contract
          if (withdrawCount > 1) {
            console.log('More than one withdraw function call detected. Pausing contract...');

            // Create the transaction to pause the contract
            const pauseTx = {
              to: proxyAddress, // Contract address from addresses.json
              data: iface.encodeFunctionData("pause") // use encodeFunctionData to encode the pause function call
            };

            // Create a Flashbots bundle
            const bundle = await flashbotsProvider.signBundle([
              {
                signer: wallet,
                transaction: pauseTx
              }
            ]);

            const signedBundle = await flashbotsProvider.sendBundle(bundle, await provider.getBlockNumber() + 1);
            const response = await signedBundle.wait();

            if (response === 0) {
              console.log('Transaction included successfully!');
            } else {
              console.log('Transaction failed');
            }
          }
        } else {
          console.log(`Transaction ${txHash} did not match expected function signatures.`);
        }
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  });

  console.log('Mempool monitoring started...');
}

main().catch(console.error);
