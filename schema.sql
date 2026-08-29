DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS sessions;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  replay_count INTEGER NOT NULL DEFAULT 0,
  custom_status INTEGER,
  custom_body TEXT,
  custom_headers TEXT,
  custom_delay INTEGER DEFAULT 0,
  ip_fingerprint TEXT
);

CREATE TABLE requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  headers TEXT NOT NULL,
  query TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_requests_session_id ON requests(session_id);
CREATE INDEX idx_sessions_ip ON sessions(ip_fingerprint, created_at);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
