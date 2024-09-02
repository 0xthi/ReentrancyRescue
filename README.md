# Reentrancy Rescue

This project is designed to detect and report reentrancy vulnerabilities in Solidity smart contracts. It uses a combination of Slither analysis, database storage, and email notification to identify and report these vulnerabilities. Tested in Sepolia testnet.

## Features

- **Slither Analysis**: Utilizes Slither, a static analysis tool for Solidity, to detect reentrancy vulnerabilities.
- **Database Storage**: Stores detected vulnerabilities in an SQLite database for future reference.
- **Email Notification**: Sends email notifications to specified addresses when reentrancy vulnerabilities are detected.
- **Mempool Monitoring**: Monitors the mempool for transactions that are likely to be reentrancy attacks.

## Getting Started

### Prerequisites

- Node.js (v14.0 or later recommended)
- npm (v6.0 or later recommended)
- Solidity compiler (v0.8.0 or later recommended)
- Slither (latest version recommended)
- Any RPC provider for Ethereum, BSC, Polygon, etc.

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Thileepan-Ilankumaran/reentrancy-rescue.git
   ```

2. Install dependencies:
   ```
   cd reentrancy-rescue
   ```
   ```
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```
     PRIVATE_KEY_1=''
     PRIVATE_KEY_2=''
     ETHERSCAN_API_KEY=
     BNB_API_KEY=
     HTTPS_RPC_URL='https://'
     WEBSOCKET_RPC_URL='wss://'
     EMAIL_USER=@gmail.com
     EMAIL_PASS=xxxx xxxx xxxx xxxx
     NOTIFICATION_EMAIL=@gmail.com

     ```

### Usage

1. Compile and test contracts:
   ```
   npx hardhat compile
   ```
   ```
   npx hardhat test
   ```

2. Deploy and verifycontracts:
   ```
   npx hardhat run scripts/deploy.js --network <network_name>
   ```
   ```
   npx hardhat verify --network <network_name> <contract_address>
   ```

3. Start monitoring script:
    Run monitor script and ReentrancyAttack at simulatenous time
   ```
   npx hardhat run services/mempool-monitor.js --network <network_name>
   ```
   ```
   npx hardhat run test/ReentrancyAttack.t.js --network <network_name>
   ```
   
4. Reports can be found at services/reports

5. Database can be found at services/db/reentrancy_rescue.db

### DEMO VIDEO :- https://www.loom.com/share/766c8bbf68624a148a7f35e08d3f2b8e?sid=7be8c033-5d9d-48eb-9715-7a105750fa7c
