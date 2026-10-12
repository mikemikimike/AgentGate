exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, goal TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE TABLE policies (
      version INT PRIMARY KEY, yaml TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE TABLE models (
      version TEXT PRIMARY KEY, path TEXT NOT NULL, sha256 TEXT NOT NULL,
      calibration JSONB, active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    CREATE TABLE decisions (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      tool TEXT NOT NULL,
      args_redacted JSONB, args_sha256 TEXT NOT NULL,
      prompt_tokens INT,
      heads JSONB NOT NULL,
      verdict TEXT NOT NULL CHECK (verdict IN ('allow','ask','deny')),
      reason_codes TEXT[] NOT NULL DEFAULT '{}',
      policy_version INT REFERENCES policies(version),
      model_version TEXT REFERENCES models(version),
      model_ms INT, total_ms INT, error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ON decisions (session_id, created_at);
    CREATE INDEX ON decisions (tool, verdict, created_at);
    
    CREATE TABLE approvals (
      id TEXT PRIMARY KEY,
      decision_id TEXT REFERENCES decisions(id),
      status TEXT NOT NULL CHECK (status IN ('pending','approved','denied','expired')),
      reviewer TEXT, note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), decided_at TIMESTAMPTZ
    );
    
    CREATE TABLE labels (
      id BIGSERIAL PRIMARY KEY,
      decision_id TEXT REFERENCES decisions(id),
      source TEXT NOT NULL CHECK (source IN ('approval','manual','benchmark')),
      label JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Append-only constraints for decisions via trigger or grants (app role)
    -- In v1, we assume the API only INSERTs.
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE labels;
    DROP TABLE approvals;
    DROP TABLE decisions;
    DROP TABLE models;
    DROP TABLE policies;
    DROP TABLE sessions;
  `);
};
