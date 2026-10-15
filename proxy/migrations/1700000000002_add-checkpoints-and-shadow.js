exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Update decisions verdict check constraint to include allow_with_checkpoint
    ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_verdict_check;
    ALTER TABLE decisions ADD CONSTRAINT decisions_verdict_check CHECK (verdict IN ('allow', 'allow_with_checkpoint', 'ask', 'deny'));

    -- 2. Add effects and is_shadow columns to decisions
    ALTER TABLE decisions ADD COLUMN IF NOT EXISTS effects TEXT[] DEFAULT '{}';
    ALTER TABLE decisions ADD COLUMN IF NOT EXISTS is_shadow BOOLEAN DEFAULT false;

    -- 3. Create checkpoints table
    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      decision_id TEXT REFERENCES decisions(id),
      session_id TEXT REFERENCES sessions(id),
      tool TEXT NOT NULL,
      git_commit TEXT,
      git_branch TEXT,
      pre_image_ref TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'reverted', 'failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reverted_at TIMESTAMPTZ,
      details JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_checkpoints_decision ON checkpoints(decision_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS checkpoints;
    ALTER TABLE decisions DROP COLUMN IF EXISTS is_shadow;
    ALTER TABLE decisions DROP COLUMN IF EXISTS effects;
    ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_verdict_check;
    ALTER TABLE decisions ADD CONSTRAINT decisions_verdict_check CHECK (verdict IN ('allow', 'ask', 'deny'));
  `);
};
