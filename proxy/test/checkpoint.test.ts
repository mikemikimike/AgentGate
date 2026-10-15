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

  it("snapshots file pre-content for target file within 1MB limit", async () => {
    const tmpFile = path.join(os.tmpdir(), `agentgate_test_${Date.now()}.txt`);
    const fs = await import("fs");
    fs.writeFileSync(tmpFile, "console.log('original code');", "utf-8");

    try {
      const chk = await createCheckpoint({
        decisionId: "dec_file1",
        tool: "file_edit",
        actionArgs: { path: tmpFile, content: "console.log('new code');" }
      });

      expect(chk.details.target_file).toBe(tmpFile);
      expect(chk.details.pre_content).toBe("console.log('original code');");
      expect(chk.details.pre_content_omitted).toBeUndefined();
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it("omits pre_content for target files exceeding 1MB threshold", async () => {
    const tmpLargeFile = path.join(os.tmpdir(), `agentgate_large_${Date.now()}.bin`);
    const fs = await import("fs");
    const largeBuffer = Buffer.alloc(1024 * 1024 + 100); // > 1MB
    fs.writeFileSync(tmpLargeFile, largeBuffer);

    try {
      const chk = await createCheckpoint({
        decisionId: "dec_large1",
        tool: "file_edit",
        actionArgs: { path: tmpLargeFile }
      });

      expect(chk.details.target_file).toBe(tmpLargeFile);
      expect(chk.details.pre_content).toBeUndefined();
      expect(chk.details.pre_content_omitted).toBe(true);
      expect(chk.details.file_size).toBeGreaterThan(1024 * 1024);
    } finally {
      if (fs.existsSync(tmpLargeFile)) fs.unlinkSync(tmpLargeFile);
    }
  });

  it("strictly confines file snapshotting to workspace boundary to prevent traversal", async () => {
    const { isPathWithinWorkspace } = await import("../src/checkpoint");
    const fakeWorkspace = path.resolve("/app/workspace");

    expect(isPathWithinWorkspace("/app/workspace/src/index.ts", fakeWorkspace)).toBe(true);
    expect(isPathWithinWorkspace("/app/workspace/README.md", fakeWorkspace)).toBe(true);
    expect(isPathWithinWorkspace("/etc/passwd", fakeWorkspace)).toBe(false);
    expect(isPathWithinWorkspace("/app/workspace/../../etc/shadow", fakeWorkspace)).toBe(false);

    // Test that createCheckpoint skips out-of-boundary target files
    const chk = await createCheckpoint({
      decisionId: "dec_boundary_test",
      tool: "file_edit",
      workspacePath: os.tmpdir(),
      actionArgs: { path: "/etc/passwd" }
    });

    expect(chk.details.boundary_violation).toBe(true);
    expect(chk.details.skipped_file).toBeDefined();
    expect(chk.details.target_file).toBeUndefined();
  });
});

