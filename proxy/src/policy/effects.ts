export type Effect = 'read' | 'write' | 'delete' | 'net' | 'exec' | 'privilege' | 'unknown';

export interface CommandEffectAnalysis {
  raw: string;
  effects: Effect[];
  commands: string[];
  binaries: string[];
}

const READ_BINARIES = new Set([
  'ls', 'cat', 'head', 'tail', 'more', 'less', 'grep', 'egrep', 'fgrep',
  'find', 'which', 'whereis', 'whoami', 'id', 'pwd', 'echo', 'printf',
  'env', 'printenv', 'wc', 'uname', 'uptime', 'date', 'ps', 'top',
  'df', 'du', 'stat', 'file', 'readlink', 'diff', 'cmp', 'sort', 'uniq',
  'jq', 'yq', 'tree', 'strings', 'base64', 'md5sum', 'sha256sum'
]);

const WRITE_BINARIES = new Set([
  'touch', 'mkdir', 'cp', 'mv', 'sed', 'awk', 'tee', 'patch', 'tar', 'gzip', 'gunzip', 'unzip', 'zip'
]);

const DELETE_BINARIES = new Set([
  'rm', 'unlink', 'shred', 'truncate', 'rmdir'
]);

const NET_BINARIES = new Set([
  'curl', 'wget', 'nc', 'netcat', 'ssh', 'scp', 'sftp', 'rsync', 'ftp', 'telnet', 'nmap', 'ping', 'traceroute'
]);

const PRIVILEGE_BINARIES = new Set([
  'sudo', 'su', 'chmod', 'chown', 'chgrp', 'setfacl', 'passwd', 'useradd', 'userdel'
]);

const EXEC_BINARIES = new Set([
  'python', 'python3', 'node', 'bash', 'sh', 'zsh', 'ruby', 'perl', 'go', 'cargo',
  'npm', 'npx', 'pnpm', 'yarn', 'make', 'cmake', 'pytest', 'vitest', 'jest'
]);

/**
 * Splits a command string by pipes, logical operators, and semicolons
 */
export function splitCompoundCommand(commandStr: string): string[] {
  if (!commandStr || typeof commandStr !== 'string') return [];
  
  // Normalize escaped characters and split on ;, &&, ||, |, \n
  const parts = commandStr
    .split(/&&|\|\||;|\||\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return parts;
}

/**
 * Extracts binary and arguments from a single command statement
 */
export function parseSingleCommand(cmd: string): { binary: string, args: string[] } {
  const tokens = cmd.trim().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) {
    return { binary: '', args: [] };
  }

  // Handle leading env vars or flags (e.g. FOO=bar ls -la)
  let idx = 0;
  while (idx < tokens.length && tokens[idx].includes('=') && !tokens[idx].startsWith('-')) {
    idx++;
  }

  const binaryToken = tokens[idx] || '';
  const binary = binaryToken.split('/').pop()?.toLowerCase() || '';
  const args = tokens.slice(idx + 1);

  return { binary, args };
}

/**
 * Classifies a specific command and arguments into effect primitives
 */
export function classifyCommand(binary: string, args: string[]): Effect[] {
  if (!binary) return ['unknown'];

  const effects = new Set<Effect>();

  // Special handling for git subcommands
  if (binary === 'git') {
    const sub = args.find(a => !a.startsWith('-'))?.toLowerCase() || '';
    if (['status', 'diff', 'log', 'show', 'branch', 'describe', 'tag', 'rev-parse'].includes(sub)) {
      effects.add('read');
    } else if (['add', 'commit', 'checkout', 'switch', 'merge', 'rebase', 'cherry-pick', 'stash', 'init'].includes(sub)) {
      effects.add('write');
    } else if (['push'].includes(sub)) {
      effects.add('net');
      effects.add('write');
      if (args.some(a => a === '--force' || a === '-f' || a === '--force-with-lease')) {
        effects.add('delete');
      }
    } else if (['pull', 'fetch', 'clone'].includes(sub)) {
      effects.add('net');
      effects.add('write');
    } else if (['rm'].includes(sub)) {
      effects.add('delete');
    } else {
      effects.add('write');
    }
    return Array.from(effects);
  }

  // Base classification
  if (READ_BINARIES.has(binary)) effects.add('read');
  if (WRITE_BINARIES.has(binary)) effects.add('write');
  if (DELETE_BINARIES.has(binary)) effects.add('delete');
  if (NET_BINARIES.has(binary)) effects.add('net');
  if (PRIVILEGE_BINARIES.has(binary)) effects.add('privilege');
  if (EXEC_BINARIES.has(binary)) {
    effects.add('exec');
    // If executing test runners, they primarily read and assert
    if (['pytest', 'vitest', 'jest', 'cargo'].includes(binary) && args.includes('test')) {
      effects.add('read');
    }
  }

  if (effects.size === 0) {
    effects.add('unknown');
  }

  return Array.from(effects);
}

/**
 * Analyzes full command string across pipes and compounds
 */
export function analyzeBashEffects(commandStr: string): CommandEffectAnalysis {
  const parts = splitCompoundCommand(commandStr);
  const allEffects = new Set<Effect>();
  const binaries: string[] = [];

  for (const part of parts) {
    const { binary, args } = parseSingleCommand(part);
    if (binary) {
      binaries.push(binary);
      const effects = classifyCommand(binary, args);
      effects.forEach(e => allEffects.add(e));
    }
  }

  if (allEffects.size === 0) {
    allEffects.add('unknown');
  }

  return {
    raw: commandStr,
    effects: Array.from(allEffects),
    commands: parts,
    binaries
  };
}

/**
 * Classifies any tool call (bash, file, database, mail) into effect primitives
 */
export function classifyToolEffects(tool: string, args: any): Effect[] {
  const lowerTool = tool.toLowerCase();

  // Shell / command tools
  if (['bash', 'bash_exec', 'sh', 'shell', 'exec', 'terminal', 'run_command'].includes(lowerTool) || (args && (args.command || args.cmd))) {
    const cmd = args?.command || args?.cmd || (typeof args === 'string' ? args : '');
    return analyzeBashEffects(cmd).effects;
  }

  // File read tools
  if (lowerTool.includes('read') || lowerTool === 'file_view' || lowerTool === 'cat') {
    return ['read'];
  }

  // File write tools
  if (lowerTool.includes('edit') || lowerTool.includes('write') || lowerTool === 'file_create') {
    return ['write'];
  }

  // File delete tools
  if (lowerTool.includes('delete') || lowerTool.includes('remove')) {
    return ['delete'];
  }

  // Network / Exfil tools
  if (lowerTool.includes('mail') || lowerTool.includes('send') || lowerTool.includes('webhook') || lowerTool.includes('http') || lowerTool.includes('slack')) {
    return ['net'];
  }

  // Database tools
  if (lowerTool.includes('database') || lowerTool.includes('sql') || lowerTool.includes('query')) {
    const q = (args?.query || args?.sql || '').trim().toLowerCase();
    if (q.startsWith('select') || q.startsWith('explain') || q.startsWith('show') || q.startsWith('describe')) {
      return ['read'];
    }
    if (q.startsWith('delete') || q.startsWith('drop') || q.startsWith('truncate')) {
      return ['delete'];
    }
    if (q.startsWith('insert') || q.startsWith('update') || q.startsWith('alter') || q.startsWith('create')) {
      return ['write'];
    }
    return ['write'];
  }

  return ['unknown'];
}
