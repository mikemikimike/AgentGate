import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { highlightCodeLine } from '../lib/syntaxHighlight';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'bash',
  filename,
  showLineNumbers
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');
  const shouldShowGutter = showLineNumbers ?? lines.length > 6;

  return (
    <div className="relative group my-12 rounded-[6px] border border-ln bg-bg overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-12 py-7 bg-pn border-b border-ln text-[11px] font-mono">
        <div className="flex items-center gap-8">
          <span className="px-2 py-0.5 rounded-[3px] border border-ln bg-sl text-t3 font-mono text-[10px]">
            {language}
          </span>
          {filename && (
            <span className="text-t2 font-mono text-[11.5px]">{filename}</span>
          )}
        </div>

        <button 
          onClick={copy} 
          aria-label="Copy code to clipboard"
          className="flex items-center gap-6 px-8 py-1 rounded-[4px] bg-rs hover:bg-hv border border-l2 text-t3 hover:text-tx transition-colors text-[11px]"
        >
          {copied ? (
            <Check size={12} className="text-ok" aria-hidden="true" />
          ) : (
            <Copy size={12} aria-hidden="true" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code contents with line gutter and tokenized highlighting */}
      <div className="flex overflow-x-auto text-[12.5px] font-mono leading-[21px] bg-bg">
        {shouldShowGutter && (
          <div 
            aria-hidden="true" 
            className="w-[44px] shrink-0 border-r border-ln py-10 pr-10 text-right select-none text-t3 font-mono text-[11.5px] leading-[21px] bg-pn/40"
          >
            {lines.map((_, i) => (
              <div key={i} className="tabular-nums">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        <pre className="p-10 flex-1 m-0 overflow-x-auto whitespace-pre font-mono text-[12px] leading-[20px] text-t2">
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre min-h-[20px]">
              {highlightCodeLine(line, language)}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
