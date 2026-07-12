import React from 'react';

interface SlackMrkdwnRendererProps {
  text: string;
  users?: Record<string, any>;
}

/**
 * Escapes characters for plain string rendering inside React elements.
 */
function decodeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/**
 * Parses Slack inline mrkdwn formatting into safe React elements.
 */
export function parseInlineMrkdwn(
  text: string,
  users: Record<string, any> = {},
  keyPrefix: string = ''
): React.ReactNode[] {
  if (!text) return [];

  // Match links, user mentions, channel mentions, bold (*), italics (_), underlines (+), strikethroughs (~), inline code (`)
  const pattern = /(<https?:\/\/[^>|]+(?:\|[^>]+)?>|<@[A-Z0-9]+>|<#[A-Z0-9]+(?:\|[^>]+)?>|\*[^\s*](?:[^*\n]*[^\s*])?\*|_[^\s_](?:[^_\n]*[^\s_])?_|\+[^\s+](?:[^+]*[^\s+])?\+|~[^\s~](?:[^~\n]*[^\s~])?~|`[^`\n]+`)/g;

  const parts = text.split(pattern);
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    if (!part) return;

    const key = `${keyPrefix}-${index}`;

    if (part.startsWith('*') && part.endsWith('*')) {
      const inner = part.slice(1, -1);
      nodes.push(<strong key={key} className="font-bold">{parseInlineMrkdwn(inner, users, key)}</strong>);
    } else if (part.startsWith('_') && part.endsWith('_')) {
      const inner = part.slice(1, -1);
      nodes.push(<em key={key} className="italic">{parseInlineMrkdwn(inner, users, key)}</em>);
    } else if (part.startsWith('+') && part.endsWith('+')) {
      const inner = part.slice(1, -1);
      nodes.push(<u key={key}>{parseInlineMrkdwn(inner, users, key)}</u>);
    } else if (part.startsWith('~') && part.endsWith('~')) {
      const inner = part.slice(1, -1);
      nodes.push(<del key={key} className="line-through">{parseInlineMrkdwn(inner, users, key)}</del>);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      nodes.push(<code className="bg-secondary/20 px-1.5 py-0.5 rounded font-mono text-[11px] text-primary" key={key}>{decodeEntities(inner)}</code>);
    } else if (part.startsWith('<@') && part.endsWith('>')) {
      const uid = part.slice(2, -1);
      const name = users[uid]?.realName || users[uid]?.name || uid;
      nodes.push(
        <span className="slack-mention font-bold text-primary bg-primary/10 px-1 rounded hover:bg-primary/20 transition-colors cursor-pointer" key={key}>
          @{name}
        </span>
      );
    } else if (part.startsWith('<#') && part.endsWith('>')) {
      const inner = part.slice(2, -1);
      const pipeIdx = inner.indexOf('|');
      const name = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : inner;
      nodes.push(
        <span className="slack-mention font-bold text-primary bg-primary/10 px-1 rounded hover:bg-primary/20 transition-colors cursor-pointer" key={key}>
          #{name}
        </span>
      );
    } else if (part.startsWith('<http') && part.endsWith('>')) {
      const inner = part.slice(1, -1);
      const pipeIdx = inner.indexOf('|');
      const url = pipeIdx !== -1 ? inner.slice(0, pipeIdx) : inner;
      const label = pipeIdx !== -1 ? inner.slice(pipeIdx + 1) : url;
      nodes.push(
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold" key={key}>
          {decodeEntities(label)}
        </a>
      );
    } else {
      nodes.push(<span key={key}>{decodeEntities(part)}</span>);
    }
  });

  return nodes;
}

export default function SlackMrkdwnRenderer({ text, users = {} }: SlackMrkdwnRendererProps) {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  
  let currentCodeLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  let currentUlItems: React.ReactNode[] = [];
  let currentOlItems: React.ReactNode[] = [];
  let currentQuoteLines: string[] = [];

  const flushBlocks = (key: string) => {
    if (currentUlItems.length > 0) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 mb-2 text-foreground/90 space-y-1">
          {currentUlItems}
        </ul>
      );
      currentUlItems = [];
    }
    if (currentOlItems.length > 0) {
      blocks.push(
        <ol key={`ol-${key}`} className="list-decimal pl-5 mb-2 text-foreground/90 space-y-1">
          {currentOlItems}
        </ol>
      );
      currentOlItems = [];
    }
    if (currentQuoteLines.length > 0) {
      blocks.push(
        <blockquote key={`quote-${key}`} className="border-l-4 border-primary pl-3 my-2 text-muted-foreground italic bg-secondary/5 py-1 rounded-r-md">
          {currentQuoteLines.map((line, idx) => (
            <div key={idx} className="min-h-[16px]">{parseInlineMrkdwn(line, users, `q-${key}-${idx}`)}</div>
          ))}
        </blockquote>
      );
      currentQuoteLines = [];
    }
  };

  lines.forEach((line, idx) => {
    const key = `block-${idx}`;

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        blocks.push(
          <pre key={`code-${key}`} className="bg-secondary/15 p-3 rounded-lg font-mono text-xs my-2 overflow-x-auto border border-border text-foreground/80 max-w-full">
            <code className={`language-${codeBlockLang}`}>{currentCodeLines.join('\n')}</code>
          </pre>
        );
        currentCodeLines = [];
        inCodeBlock = false;
      } else {
        // Open code block
        flushBlocks(key);
        inCodeBlock = true;
        codeBlockLang = line.replace('```', '').trim() || 'text';
      }
      return;
    }

    if (inCodeBlock) {
      currentCodeLines.push(line);
      return;
    }

    // Bullet items
    const bulletMatch = line.match(/^\s*[•\-*]\s+(.*)$/);
    if (bulletMatch) {
      flushBlocks(key);
      currentUlItems.push(
        <li key={`li-${key}`} className="leading-relaxed">
          {parseInlineMrkdwn(bulletMatch[1], users, key)}
        </li>
      );
      return;
    }

    // Ordered list items
    const orderMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (orderMatch) {
      flushBlocks(key);
      currentOlItems.push(
        <li key={`li-${key}`} className="leading-relaxed">
          {parseInlineMrkdwn(orderMatch[2], users, key)}
        </li>
      );
      return;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      flushBlocks(key);
      currentQuoteLines.push(quoteMatch[1]);
      return;
    }

    // Plain line text
    flushBlocks(key);
    if (line.trim() === '') {
      blocks.push(<div key={`empty-${key}`} className="h-1.5" />);
    } else {
      blocks.push(
        <p key={`p-${key}`} className="mb-1 leading-relaxed text-foreground/90">
          {parseInlineMrkdwn(line, users, key)}
        </p>
      );
    }
  });

  flushBlocks('final');

  return <div className="slack-message-rendered space-y-1">{blocks}</div>;
}
