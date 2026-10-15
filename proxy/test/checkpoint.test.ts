import { describe, it, expect } from "vitest";
import { isGitRepository, createCheckpoint } from "../src/checkpoint";
import path from "path";
import os from "os";

describe("Checkpoint Engine", () => {
  it("accurately detects git repository status", async () => {
    // Current workspace is a git repository
    const inGit = await isGitRepository(process.cwd());
    expect(inGit).toBe(true);

    // Root / or temp directory is not a git repo
    const notInGit = await isGitRepository(os.tmpdir());
    expect(notInGit).toBe(false);
  });

  it("creates an autonomous checkpoint with git commit pre-image", async () => {
    const chk = await createCheckpoint({
      decisionId: "dec_test123",
      sessionId: "sess_test456",
      tool: "bash",
      actionArgs: { command: "touch /tmp/agent_test.txt" }
    });

    expect(chk.id).toMatch(/^chk_[a-f0-9]{16}$/);
    expect(chk.status).toBe("active");
    expect(chk.decision_id).toBe("dec_test123");
    expect(chk.git_commit).toBeDefined();
    expect(chk.git_branch).toBeDefined();
    expect(chk.pre_image_ref).toBeDefined();
  });
});
