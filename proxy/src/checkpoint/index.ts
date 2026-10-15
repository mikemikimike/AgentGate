import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { pool } from "../db";
import { generateId } from "../utils/id";

const execAsync = promisify(exec);

export interface CheckpointOptions {
  decisionId: string;
  sessionId?: string;
  tool: string;
  actionArgs?: any;
  workspacePath?: string;
}

export interface CheckpointRecord {
  id: string;
  decision_id: string;
  session_id?: string;
  tool: string;
  git_commit?: string;
  git_branch?: string;
  pre_image_ref?: string;
  status: "active" | "reverted" | "failed";
  created_at: string;
  reverted_at?: string;
  details?: any;
}

/**
 * Checks whether the given directory is inside a Git repository.
 */
export async function isGitRepository(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git rev-parse --is-inside-work-tree", { cwd });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Creates an autonomous checkpoint pre-image before a mutating command runs.
 */
export async function createCheckpoint(options: CheckpointOptions): Promise<CheckpointRecord> {
  const id = generateId("chk");
  const cwd = options.workspacePath || process.env.AG_WORKSPACE_DIR || process.cwd();

  let gitCommit: string | undefined;
  let gitBranch: string | undefined;
  let preImageRef: string | undefined;
  const details: Record<string, any> = { workspace: cwd };

  try {
    const inGit = await isGitRepository(cwd);
    if (inGit) {
      try {
        const { stdout: headCommit } = await execAsync("git rev-parse HEAD", { cwd });
        gitCommit = headCommit.trim();
      } catch (err) {
        // HEAD commit unavailable (e.g. empty git repo)
      }

      try {
        const { stdout: branch } = await execAsync("git rev-parse --abbrev-ref HEAD", { cwd });
        gitBranch = branch.trim();
      } catch (err) {
        // Current branch unavailable
      }

      try {
        // git stash create creates a commit object of dirty changes without modifying git state
        const { stdout: stashSha } = await execAsync(`git stash create "agentgate-pre-image-${id}"`, { cwd });
        const trimmedStash = stashSha.trim();
        preImageRef = trimmedStash.length > 0 ? trimmedStash : gitCommit;
      } catch (err) {
        preImageRef = gitCommit;
      }
    }

    // If tool targets a specific file, snapshot its content into details
    const filePath = options.actionArgs?.path || options.actionArgs?.file_path || options.actionArgs?.target_file;
    if (filePath && typeof filePath === "string" && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        details.target_file = filePath;
        details.pre_content = content;
      } catch (err: any) {
        details.file_read_error = err.message;
      }
    }

    const record: CheckpointRecord = {
      id,
      decision_id: options.decisionId,
      session_id: options.sessionId,
      tool: options.tool,
      git_commit: gitCommit,
      git_branch: gitBranch,
      pre_image_ref: preImageRef,
      status: "active",
      created_at: new Date().toISOString(),
      details
    };

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO checkpoints (id, decision_id, session_id, tool, git_commit, git_branch, pre_image_ref, status, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, options.decisionId, options.sessionId || null, options.tool, gitCommit || null, gitBranch || null, preImageRef || null, "active", JSON.stringify(details)]
        );
      } catch (poolErr: any) {
        // Database offline or in unit tests: record notice in details
        details.db_offline = true;
      }
    }

    return record;
  } catch (err: any) {
    const failedRecord: CheckpointRecord = {
      id,
      decision_id: options.decisionId,
      session_id: options.sessionId,
      tool: options.tool,
      status: "failed",
      created_at: new Date().toISOString(),
      details: { ...details, error: err.message }
    };
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO checkpoints (id, decision_id, session_id, tool, status, details)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, options.decisionId, options.sessionId || null, options.tool, "failed", JSON.stringify(failedRecord.details)]
        );
      } catch (poolErr) {
        // Pool insertion failed; ignore in non-DB environments
      }
    }
    return failedRecord;
  }
}

/**
 * Reverts a checkpoint back to its pre-image state.
 */
export async function revertCheckpoint(id: string, customCwd?: string): Promise<{ success: boolean; checkpoint_id: string; message: string; reverted_at?: string }> {
  if (!pool) {
    throw new Error("Database pool unavailable");
  }

  const res = await pool.query("SELECT * FROM checkpoints WHERE id = $1", [id]);
  if (res.rows.length === 0) {
    throw new Error(`Checkpoint ${id} not found`);
  }

  const chk = res.rows[0];
  if (chk.status === "reverted") {
    return {
      success: true,
      checkpoint_id: id,
      message: "Checkpoint was already reverted",
      reverted_at: chk.reverted_at
    };
  }

  const cwd = customCwd || chk.details?.workspace || process.env.AG_WORKSPACE_DIR || process.cwd();
  let reverted = false;
  let revertMsg = "";

  // 1. If Git pre_image_ref exists, restore files to that commit
  if (chk.pre_image_ref) {
    try {
      await execAsync(`git checkout ${chk.pre_image_ref} -- .`, { cwd });
      reverted = true;
      revertMsg += `Restored workspace to git commit ${chk.pre_image_ref}. `;
    } catch (err: any) {
      revertMsg += `Git rollback failed: ${err.message}. `;
    }
  }

  // 2. If single-file pre_content was saved, restore it
  if (chk.details?.target_file && chk.details?.pre_content !== undefined) {
    try {
      fs.writeFileSync(chk.details.target_file, chk.details.pre_content, "utf-8");
      reverted = true;
      revertMsg += `Restored file ${chk.details.target_file}. `;
    } catch (err: any) {
      revertMsg += `File rollback failed: ${err.message}. `;
    }
  }

  const now = new Date().toISOString();

  if (reverted) {
    await pool.query("UPDATE checkpoints SET status = $1, reverted_at = $2 WHERE id = $3", ["reverted", now, id]);
    return {
      success: true,
      checkpoint_id: id,
      message: revertMsg.trim() || "Checkpoint reverted successfully",
      reverted_at: now
    };
  } else {
    await pool.query("UPDATE checkpoints SET status = $1 WHERE id = $2", ["failed", id]);
    return {
      success: false,
      checkpoint_id: id,
      message: revertMsg.trim() || "No valid pre-image reference available to revert"
    };
  }
}

/**
 * Fetches a single checkpoint by ID.
 */
export async function getCheckpoint(id: string): Promise<CheckpointRecord | null> {
  if (!pool) return null;
  const res = await pool.query("SELECT * FROM checkpoints WHERE id = $1", [id]);
  return res.rows[0] || null;
}

/**
 * Lists recent checkpoints for a session or fleet.
 */
export async function listCheckpoints(sessionId?: string, limit: number = 50): Promise<CheckpointRecord[]> {
  if (!pool) return [];
  if (sessionId) {
    const res = await pool.query("SELECT * FROM checkpoints WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2", [sessionId, limit]);
    return res.rows;
  }
  const res = await pool.query("SELECT * FROM checkpoints ORDER BY created_at DESC LIMIT $1", [limit]);
  return res.rows;
}
