require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { 
  generateSlitherReport,
  sendNotification,
  logReentrancyEvent,
  logVulnerability,
  logPerformanceMetric,
  logPauseEvent,
  logMonitoredTransaction,
  initializeDatabase
} = require('./reportingService');

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

const WEBSOCKET_RPC_URL = process.env.WEBSOCKET_RPC_URL;
const PRIVATE_KEY_1 = process.env.PRIVATE_KEY_1;

const provider = new ethers.WebSocketProvider(WEBSOCKET_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY_1, provider);

let isPaused = false;
let isPausePending = false;

let potentialReentrancyAttacks = new Map();

async function main() {
  await initializeDatabase();
  const iface = new ethers.Interface(abi);
  const proxyAddress = addresses.VulnerableBankV1UUPSProxy;
  const contract = new ethers.Contract(proxyAddress, abi, provider);

  console.log('Reentrancy Detection monitoring started...');

  // Map to store the last withdraw event timestamp by user
  const lastWithdrawTimestampByUser = new Map();

  // Listen for all events from the contract
  contract.on("*", (event) => {
    const eventName = event.eventName;
    const formattedArgs = event.args.map(arg => {
      if (typeof arg === 'bigint') {
        return ethers.formatEther(arg);
      }
      return arg.toString();
    });

    // Attempt to get transaction hash and block number
    const txHash = event.log?.transactionHash || event.transactionHash;
    const blockNumber = event.log?.blockNumber || event.blockNumber;

    switch (eventName) {
      case "Deposit":
        console.log(`Deposit event detected: User ${formattedArgs[0]} deposited ${formattedArgs[1]} ETH`);
        if (txHash) {
          logMonitoredTransaction(txHash, event.args[0], proxyAddress, formattedArgs[1], "deposit", "")
            .catch(error => console.error('Error logging monitored transaction:', error));
        } else {
          console.log('Skipping transaction logging: No transaction hash available');
        }
        break;
      case "Withdraw":
        console.log(`Withdraw event detected: User ${formattedArgs[0]} withdrew ${formattedArgs[1]} ETH`);
        if (txHash) {
          logMonitoredTransaction(txHash, event.args[0], proxyAddress, formattedArgs[1], "withdraw", "")
            .catch(error => console.error('Error logging monitored transaction:', error));
        }
        checkForReentrancy(formattedArgs[0], event.args[1], txHash, blockNumber);
        break;
      case "Paused":
        console.log(`Contract paused by ${formattedArgs[0]}`);
        isPaused = true;
        isPausePending = false;
        logPauseEvent(formattedArgs[0], "Potential reentrancy attack", true, Date.now() - pauseStartTime);
        break;
      case "Unpaused":
        console.log(`Contract unpaused by ${formattedArgs[0]}`);
        isPaused = false;
        break;

      default:
        console.log(`${eventName} event detected:`, formattedArgs.join(', '));
    }
  });

  async function checkForReentrancy(user, amount, txHash, blockNumber) {
    const currentTimestamp = Date.now();
    const lastTimestamp = lastWithdrawTimestampByUser.get(user) || 0;

    if (currentTimestamp - lastTimestamp < 1000 && !isPaused && !isPausePending) {
      const stolenAmount = ethers.formatEther(amount);
      
      // Update potential reentrancy attacks map
      if (potentialReentrancyAttacks.has(user)) {
        const currentAmount = potentialReentrancyAttacks.get(user);
        potentialReentrancyAttacks.set(user, currentAmount + parseFloat(stolenAmount));
      } else {
        potentialReentrancyAttacks.set(user, parseFloat(stolenAmount));
      }

      // Log the reentrancy event with available information
      await logReentrancyEvent(user, stolenAmount, txHash, blockNumber);

      // If this is the first detection or it's been more than 5 seconds since the last alert, print the combined alert
      if (potentialReentrancyAttacks.size === 1 || currentTimestamp - lastAlertTimestamp > 5000) {
        console.log('\n' + '='.repeat(50));
        console.log('\x1b[31m%s\x1b[0m', 'POTENTIAL REENTRANCY ATTACK(S) DETECTED');
        for (const [attackUser, attackAmount] of potentialReentrancyAttacks) {
          console.log('\x1b[33m%s\x1b[0m', `User: ${attackUser}`);
          console.log('\x1b[33m%s\x1b[0m', `Total amount potentially stolen: ${attackAmount.toFixed(5)} ETH`);
        }
        console.log('='.repeat(50) + '\n');

        lastAlertTimestamp = currentTimestamp;
        potentialReentrancyAttacks.clear();

        // Generate Slither report and send notification only once
        const contractPath = path.resolve(__dirname, '../contracts/VulnerableBankV1.sol');
        const slitherReport = await generateSlitherReport(contractPath);

        // Log vulnerabilities from Slither report
        if (slitherReport.vulnerabilities) {
          for (const vulnerability of slitherReport.vulnerabilities) {
            await logVulnerability(
              proxyAddress,
              vulnerability.type,
              vulnerability.severity,
              vulnerability.description,
              vulnerability.suggestedFix
            );
          }
        }

        // Send notification
        const subject = 'Reentrancy Attack(s) Detected - Contract Paused';
        const message = `Potential reentrancy attack(s) detected. The contract has been paused.\n\nSlither Report:\n${JSON.stringify(slitherReport, null, 2)}`;
        await sendNotification(subject, message);

        pauseStartTime = Date.now();
        await pauseContract();
      }
    }

    // Update the last withdraw timestamp for the user
    lastWithdrawTimestampByUser.set(user, currentTimestamp);
  }

  // Monitor pending transactions
  provider.on('pending', async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx || tx.to !== proxyAddress) return;

      console.log('-----------------------------------');
      console.log(`Transaction detected: ${txHash}`);
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);

      try {
        const decodedInput = iface.parseTransaction({ data: tx.data });
        console.log(`Function called: ${decodedInput.name}`);
        const args = decodedInput.args.length > 0 ? decodedInput.args.map(arg => arg.toString()).join(', ') : 'No arguments';
        console.log(`Arguments: ${args}`);

        // Log monitored transaction
        await logMonitoredTransaction(
          txHash,
          tx.from,
          tx.to,
          ethers.formatEther(tx.value),
          decodedInput.name,
          args
        );
      } catch (decodeError) {
        console.log('Could not decode transaction data');
        console.log('Raw transaction data:', tx.data);
      }

      console.log('-----------------------------------');
    } catch (error) {
      console.error('Error processing transaction:', error);
    }
  });

  // Log performance metrics every 5 minutes
  setInterval(async () => {
    const blockNumber = await provider.getBlockNumber();
    await logPerformanceMetric('current_block_number', blockNumber);

    const gasPrice = await provider.getGasPrice();
    await logPerformanceMetric('current_gas_price', ethers.formatUnits(gasPrice, 'gwei'));
  }, 5 * 60 * 1000);
}

let pauseStartTime;
let lastAlertTimestamp = 0;

async function pauseContract() {
  if (isPausePending) {
    console.log('Pause already pending, skipping additional pause attempt');
    return;
  }

  console.log('Attempting to pause the contract...');
  isPausePending = true;
  pauseStartTime = Date.now();

  const proxyAddress = addresses.VulnerableBankV1UUPSProxy;
  const contract = new ethers.Contract(proxyAddress, abi, wallet);

  try {
    const pauseTx = await contract.pause();
    console.log('Pause transaction sent:', pauseTx.hash);

    const receipt = await pauseTx.wait();
    console.log(`Pause transaction mined in block ${receipt.blockNumber}`);

    const timeToPause = (Date.now() - pauseStartTime) / 1000; // Convert to seconds
    await logPauseEvent(wallet.address, 'Potential reentrancy attack', true, timeToPause);
  } catch (error) {
    console.error('Error sending pause transaction:', error);
    isPausePending = false;
    await logPauseEvent(wallet.address, 'Potential reentrancy attack', false, (Date.now() - pauseStartTime) / 1000);
  }
}

main().catch(console.error);

