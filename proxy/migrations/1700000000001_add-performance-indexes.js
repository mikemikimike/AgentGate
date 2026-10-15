exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_decisions_created_at_desc ON decisions (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_approvals_decision_id ON approvals (decision_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_status_created_at ON approvals (status, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_approvals_status_created_at;
    DROP INDEX IF EXISTS idx_approvals_decision_id;
    DROP INDEX IF EXISTS idx_decisions_created_at_desc;
  `);
};
