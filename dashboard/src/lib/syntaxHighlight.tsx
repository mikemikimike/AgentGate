import { Fragment, ReactNode } from 'react';

/**
 * Syntax highlighting following DESIGN.md Section 3.1 & 3.3:
 * Keys --nf, strings --ok, numbers --wn.
 * Action values (deny, ask, allow) use normal text color in medium weight, not status colors.
 * Zero hard-coded colors outside the token file.
 */

export function highlightYamlValue(val: string): ReactNode {
  const trimmed = val.trim();
  if (!trimmed) return <span className="text-tx">{val}</span>;

  // Inline mapping: e.g. { head: untrusted_influence, option: likely, gt: 0.50 }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1);
    const parts = inner.split(/,\s*/);
    return (
      <Fragment>
        <span className="text-t3 font-mono">{'{ '}</span>
        {parts.map((p, idx) => {
          const m = p.trim().match(/^((?:"[^"]+"|'[^']+'|[A-Za-z0-9_.*+/-]+):)(\s*)(.*)$/);
          return (
            <Fragment key={idx}>
              {m ? (
                <Fragment>
                  <span className="text-nf font-medium">{m[1]}</span>
                  {m[2]}
                  {highlightYamlValue(m[3])}
                </Fragment>
              ) : (
                highlightYamlValue(p)
              )}
              {idx < parts.length - 1 && <span className="text-t3 font-mono">{', '}</span>}
            </Fragment>
          );
        })}
        <span className="text-t3 font-mono">{' }'}</span>
      </Fragment>
    );
  }

  // Quoted string: --ok
  if (/^["'].*["']$/.test(trimmed)) {
    return <span className="text-ok">{val}</span>;
  }

  // Numeric value: --wn
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return <span className="text-wn tabular-nums font-mono">{val}</span>;
  }

  // Booleans: --wn
  if (/^(true|false|yes|no)$/i.test(trimmed)) {
    return <span className="text-wn font-medium">{val}</span>;
  }

  // Action values (deny, ask, allow) use normal text color in a medium weight, not status colors per spec
  if (trimmed === 'allow' || trimmed === 'ask' || trimmed === 'deny' || trimmed === 'allow_with_checkpoint') {
    return <span className="text-tx font-medium">{val}</span>;
  }

  // Model heads & risk options: clean text
  if (/^(untrusted_influence|goal_alignment|reversibility|external_send)$/.test(trimmed)) {
    return <span className="text-nf font-medium">{val}</span>;
  }
  if (/^(likely|none|possible|irreversible|costly|reversible|aligned|tangential|misaligned)$/.test(trimmed)) {
    return <span className="text-t2">{val}</span>;
  }

  return <span className="text-tx">{val}</span>;
}

export function highlightYamlLine(line: string): ReactNode {
  // Comment line: muted neutral --t3
  if (/^\s*#/.test(line)) {
    return <span className="text-t3 italic">{line}</span>;
  }

  let codePart = line;
  let commentPart = '';
  // Match trailing comment outside quotes
  const commentMatch = line.match(/^((?:[^#"'\\]|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')+?)\s+(#.*)$/);
  if (commentMatch) {
    codePart = commentMatch[1];
    commentPart = commentMatch[2];
  }

  // Key-value pair (with optional leading bullet "- ")
  const kvMatch = codePart.match(/^(\s*(?:-\s+)?)(?:\s*)((?:"[^"]+"|'[^']+'|[A-Za-z0-9_.*+/-]+):)(\s*)(.*)$/);
  if (kvMatch) {
    const [, prefix, key, spacing, rest] = kvMatch;
    return (
      <Fragment>
        {prefix && <span className="text-t3">{prefix}</span>}
        <span className="text-nf font-medium">{key}</span>
        {spacing}
        {rest ? highlightYamlValue(rest) : null}
        {commentPart ? <span className="text-t3 italic">{'  ' + commentPart}</span> : null}
      </Fragment>
    );
  }

  // List item (e.g., "- untrusted_influence")
  const listMatch = codePart.match(/^(\s*-\s+)(.*)$/);
  if (listMatch) {
    const [, prefix, rest] = listMatch;
    return (
      <Fragment>
        <span className="text-t3 font-medium">{prefix}</span>
        {highlightYamlValue(rest)}
        {commentPart ? <span className="text-t3 italic">{'  ' + commentPart}</span> : null}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <span className="text-tx">{codePart}</span>
      {commentPart ? <span className="text-t3 italic">{'  ' + commentPart}</span> : null}
    </Fragment>
  );
}

export function highlightJsonLine(line: string): ReactNode {
  if (/^\s*\/\//.test(line)) {
    return <span className="text-t3 italic">{line}</span>;
  }

  const jsonTokenRegex = /("(\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[[\]{},:])/g;
  let lastIndex = 0;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = jsonTokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`ws-${lastIndex}`} className="text-tx">{line.slice(lastIndex, match.index)}</span>);
    }
    const tok = match[0];
    const key = `tok-${match.index}`;

    if (tok.startsWith('"') && tok.endsWith(':')) {
      nodes.push(<span key={key} className="text-nf font-medium">{tok}</span>);
    } else if (tok.startsWith('"')) {
      if (tok === '"allow"' || tok === '"ask"' || tok === '"deny"') {
        nodes.push(<span key={key} className="text-tx font-medium">{tok}</span>);
      } else {
        nodes.push(<span key={key} className="text-ok">{tok}</span>);
      }
    } else if (/^-?\d+(\.\d+)?$/.test(tok)) {
      nodes.push(<span key={key} className="text-wn tabular-nums font-mono">{tok}</span>);
    } else if (tok === 'true' || tok === 'false') {
      nodes.push(<span key={key} className="text-wn font-medium">{tok}</span>);
    } else if (tok === 'null') {
      nodes.push(<span key={key} className="text-t3">{tok}</span>);
    } else {
      nodes.push(<span key={key} className="text-t3 font-mono">{tok}</span>);
    }
    lastIndex = jsonTokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(<span key={`end-${lastIndex}`} className="text-tx">{line.slice(lastIndex)}</span>);
  }

  return <Fragment>{nodes}</Fragment>;
}

export function highlightBashLine(line: string): ReactNode {
  if (/^\s*#/.test(line)) {
    return <span className="text-t3 italic">{line}</span>;
  }

  const bashTokenRegex = /("[^"]*"|'[^']*'|--?[a-zA-Z0-9_-]+|\b[A-Z0-9_]+=(?=["']?)|\$[A-Za-z0-9_]+|\b(?:docker|node|curl|export|python|uv|git|npm|pnpm|bash|sh|compose|ps|up|run)\b|[|>&]+)/g;
  let lastIndex = 0;
  const nodes: ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = bashTokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`ws-${lastIndex}`} className="text-tx">{line.slice(lastIndex, match.index)}</span>);
    }
    const tok = match[0];
    const key = `tok-${match.index}`;

    if (tok.startsWith('"') || tok.startsWith("'")) {
      nodes.push(<span key={key} className="text-ok">{tok}</span>);
    } else if (tok.startsWith('-')) {
      nodes.push(<span key={key} className="text-t2 font-mono">{tok}</span>);
    } else if (tok.endsWith('=')) {
      nodes.push(<span key={key} className="text-t2 font-mono">{tok}</span>);
    } else if (tok.startsWith('$')) {
      nodes.push(<span key={key} className="text-wn font-mono">{tok}</span>);
    } else if (tok === '|' || tok === '>' || tok === '&' || tok === '&&') {
      nodes.push(<span key={key} className="text-t3 font-bold">{tok}</span>);
    } else {
      nodes.push(<span key={key} className="text-tx font-medium">{tok}</span>);
    }
    lastIndex = bashTokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(<span key={`end-${lastIndex}`} className="text-tx">{line.slice(lastIndex)}</span>);
  }

  return <Fragment>{nodes}</Fragment>;
}

export function highlightCodeLine(line: string, language: string): ReactNode {
  const lang = language.toLowerCase();
  if (lang === 'yaml' || lang === 'yml') {
    return highlightYamlLine(line);
  }
  if (lang === 'json') {
    return highlightJsonLine(line);
  }
  if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
    return highlightBashLine(line);
  }
  return <span className="text-tx">{line}</span>;
}
