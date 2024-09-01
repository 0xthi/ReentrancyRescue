CREATE TABLE IF NOT EXISTS reentrancy_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_address TEXT NOT NULL,
    stolen_amount TEXT NOT NULL,
    transaction_hash TEXT,
    block_number INTEGER
);

CREATE TABLE IF NOT EXISTS vulnerability_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    contract_address TEXT NOT NULL,
    vulnerability_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_fix TEXT
);

CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pause_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    initiated_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    time_to_pause REAL
);

CREATE TABLE IF NOT EXISTS monitored_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    transaction_hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value TEXT NOT NULL,
    function_called TEXT,
    arguments TEXT
);