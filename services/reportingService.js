const { exec } = require('child_process');
const fs = require('fs');
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
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(__dirname, '..');
    
    // Construct the Slither command with necessary options
    const slitherCommand = `slither "${contractPath}" --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/" --exclude-dependencies --exclude-informational --exclude-low --exclude-optimization --exclude naming-convention`;

    // Set environment variables for the child process
    const env = {
      ...process.env,
      SOLC_VERSION: '0.8.20'
    };

    exec(slitherCommand, { cwd: projectRoot, env: env }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Slither execution error: ${error}`);
        console.error(`Stderr: ${stderr}`);
        resolve({ error: error.message, stderr });
        return;
      }
      
      const formattedReport = formatSlitherReport(stdout);
      resolve(formattedReport);
    });
  });
}

function formatSlitherReport(stdout) {
  const vulnerabilities = [];
  const lines = stdout.split('\n');
  let currentVulnerability = null;

  for (const line of lines) {
    if (line.startsWith('INFO:Detectors:')) {
      if (currentVulnerability) {
        vulnerabilities.push(currentVulnerability);
      }
      currentVulnerability = {
        type: line.substring('INFO:Detectors:'.length).trim(),
        description: '',
        severity: getSeverity(line),
        suggestedFix: ''
      };
    } else if (currentVulnerability && line.trim() !== '') {
      currentVulnerability.description += line.trim() + '\n';
    }
  }

  if (currentVulnerability) {
    vulnerabilities.push(currentVulnerability);
  }

  return { vulnerabilities };
}

function getSeverity(line) {
  if (line.includes('High')) return 'High';
  if (line.includes('Medium')) return 'Medium';
  return 'Low';
}

async function sendNotification(subject, message, attachmentPath) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: subject,
    text: message,
    attachments: [
      {
        filename: 'aderyn_report.md',
        path: attachmentPath
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

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const schemaPath = path.resolve(__dirname, '../db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error initializing database:', err);
        reject(err);
      } else {
        console.log('Database initialized successfully');
        resolve();
      }
    });
  });
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
  initializeDatabase
};
