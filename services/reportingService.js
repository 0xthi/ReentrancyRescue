const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();

// Configure email service (replace with your actual email configuration)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Initialize SQLite database
const dbPath = path.resolve(__dirname, '../db/reentrancy_rescue.db');
const db = new sqlite3.Database(dbPath);

async function generateSlitherReport(contractPath) {
  try {
    const slitherReportPath = path.resolve(__dirname, '../reports/slither_console_report.json');

    // Delete the existing file if it exists
    try {
      await fs.access(slitherReportPath);
      await fs.unlink(slitherReportPath);
    } catch (error) {
      // File doesn't exist, no need to delete
    }

    const slitherCommand = `slither ${contractPath} --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/" --exclude-dependencies --exclude-informational --exclude-low --exclude-optimization --exclude naming-convention --json ${slitherReportPath} --json-types detectors`;

    return new Promise((resolve, reject) => {
      exec(slitherCommand, async (error, stdout, stderr) => {
        if (error) {
          console.error(`Error generating Slither report: ${error.message}`);
          // Check if the report file was generated despite the error
          try {
            await fs.access(slitherReportPath);
            console.log(`Slither report generated despite error: ${slitherReportPath}`);
            return resolve(slitherReportPath);
          } catch (accessError) {
            return reject(error);
          }
        }

        try {
          // Parse the JSON output
          const jsonOutput = JSON.parse(stdout);
          
          // Write the parsed JSON to a file
          await fs.writeFile(slitherReportPath, JSON.stringify(jsonOutput, null, 2));
          
          console.log(`Slither report generated: ${slitherReportPath}`);
          resolve(slitherReportPath);
        } catch (parseError) {
          console.error(`Error parsing Slither output: ${parseError.message}`);
          reject(parseError);
        }
      });
    });
  } catch (error) {
    console.error(`Error in generateSlitherReport: ${error.message}`);
    throw error;
  }
}

function formatSlitherReport(stdout) {
  const vulnerabilities = [];
  const lines = stdout.split('\n');
  let currentVulnerability = null;

  for (const line of lines) {
    if (line.startsWith('INFO:Detectors:')) {
      if (currentVulnerability && currentVulnerability.type.toLowerCase().includes('reentrancy')) {
        vulnerabilities.push(currentVulnerability);
      }
      currentVulnerability = {
        type: line.substring('INFO:Detectors:'.length).trim(),
        description: '',
        severity: getSeverity(line)
      };
    } else if (currentVulnerability && line.trim() !== '') {
      currentVulnerability.description += line.trim() + '\n';
    }
  }

  if (currentVulnerability && currentVulnerability.type.toLowerCase().includes('reentrancy')) {
    vulnerabilities.push(currentVulnerability);
  }

  return { vulnerabilities };
}

function getSeverity(line) {
  if (line.includes('High')) return 'High';
  if (line.includes('Medium')) return 'Medium';
  return 'Low';
}

async function sendNotification(subject, message, slitherReportPath) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: subject,
    text: message,
    attachments: [
      {
        filename: 'slither_report.json',
        path: slitherReportPath
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully');
  } catch (error) {
    console.error('Error sending notification email:', error);
  }
}

async function logReentrancyEvent(userAddress, stolenAmount, txHash, blockNumber) {
  return new Promise((resolve, reject) => {
    let sql, params;

    if (txHash && blockNumber) {
      sql = `INSERT INTO reentrancy_reports (user_address, stolen_amount, transaction_hash, block_number) 
             VALUES (?, ?, ?, ?)`;
      params = [userAddress, stolenAmount, txHash, blockNumber];
    } else if (txHash) {
      sql = `INSERT INTO reentrancy_reports (user_address, stolen_amount, transaction_hash) 
             VALUES (?, ?, ?)`;
      params = [userAddress, stolenAmount, txHash];
    } else {
      sql = `INSERT INTO reentrancy_reports (user_address, stolen_amount) 
             VALUES (?, ?)`;
      params = [userAddress, stolenAmount];
    }

    db.run(sql, params, function(err) {
      if (err) {
        console.error('Error logging reentrancy event:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

function logVulnerability(contractAddress, vulnerabilityType, severity, description, suggestedFix) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO vulnerability_reports 
                 (contract_address, vulnerability_type, severity, description, suggested_fix) 
                 VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [contractAddress, vulnerabilityType, severity, description, suggestedFix], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function logPerformanceMetric(metricName, metricValue) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO performance_metrics (metric_name, metric_value) VALUES (?, ?)`;
    db.run(sql, [metricName, metricValue], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function logPauseEvent(initiatedBy, reason, success, timeToPause) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO pause_events (initiated_by, reason, success, time_to_pause) 
                 VALUES (?, ?, ?, ?)`;
    db.run(sql, [initiatedBy, reason, success, timeToPause], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function logMonitoredTransaction(txHash, fromAddress, toAddress, value, functionCalled, arguments) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO monitored_transactions 
                 (transaction_hash, from_address, to_address, value, function_called, arguments) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [txHash, fromAddress, toAddress, value, functionCalled, arguments], function(err) {
      if (err) {
        console.error('Error inserting monitored transaction:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Function to get reports (you can add more specific queries as needed)
function getReentrancyReports() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM reentrancy_reports ORDER BY timestamp DESC", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initializeDatabase() {
  try {
    const schemaPath = path.resolve(__dirname, '../db/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing database:', err);
        throw err;
      } else {
        console.log('Database initialized successfully');
      }
    });
  } catch (error) {
    console.error(`Error in initializeDatabase: ${error.message}`);
    throw error;
  }
}

async function generateConciseReport(contractAddress) {
  const reentrancyReports = await getReentrancyReports();
  const totalStolenAmount = reentrancyReports.reduce((sum, report) => sum + report.stolen_amount, 0);
  
  const pauseStatus = await getPauseStatus(contractAddress);

  return {
    reentrancyReports,
    totalStolenAmount,
    pauseStatus
  };
}

async function getPauseStatus(contractAddress) {
  const WEBSOCKET_RPC_URL = process.env.WEBSOCKET_RPC_URL;
  const provider = new ethers.WebSocketProvider(WEBSOCKET_RPC_URL);

  const artifactPath = path.resolve(__dirname, '../artifacts/contracts/VulnerableBankV1.sol/VulnerableBankV1.json');
  const contractJson = JSON.parse(await fs.readFile(artifactPath, 'utf-8'));
  const abi = contractJson.abi;

  const contract = new ethers.Contract(contractAddress, abi, provider);
  return await contract.paused();
}

async function sendConciseNotification(contractAddress) {
  const report = await generateConciseReport(contractAddress);
  const subject = `Reentrancy Alert for ${contractAddress}`;
  const message = `
Reentrancy Reports:
${report.reentrancyReports.map(r => `- Transaction: ${r.transaction_hash}, Stolen: ${r.stolen_amount}`).join('\n')}

Total Stolen Amount: ${report.totalStolenAmount}

Contract Pause Status: ${report.pauseStatus ? 'Paused' : 'Active'}
  `;

  await sendNotification(subject, message);
}

module.exports = {
  generateSlitherReport,
  sendNotification,
  logReentrancyEvent,
  logVulnerability,
  logPerformanceMetric,
  logPauseEvent,
  logMonitoredTransaction,
  getReentrancyReports,
  initializeDatabase,
  sendConciseNotification,
  getPauseStatus
};
