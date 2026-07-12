/**
 * Converts ProseMirror / TipTap JSON document state structure to clean Slack mrkdwn.
 */
export function tiptapJsonToMrkdwn(node: any): string {
  if (!node) return '';

  if (node.type === 'text') {
    let text = node.text || '';
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') {
          text = `*${text}*`;
        } else if (mark.type === 'italic') {
          text = `_${text}_`;
        } else if (mark.type === 'strike') {
          text = `~${text}~`;
        } else if (mark.type === 'code') {
          text = `\`${text}\``;
        } else if (mark.type === 'underline') {
          text = `+${text}+`;
        } else if (mark.type === 'link') {
          const href = mark.attrs?.href || '';
          if (href.startsWith('mention://user/')) {
            const uid = href.replace('mention://user/', '');
            text = `<@${uid}>`;
          } else if (href.startsWith('mention://channel/')) {
            const cid = href.replace('mention://channel/', '');
            text = `<#${cid}>`;
          } else {
            text = `<${href}|${text || href}>`;
          }
        }
      }
    }
    return text;
  }

  if (node.type === 'bulletList') {
    return (node.content?.map((item: any) => `• ${tiptapJsonToMrkdwn(item)}\n`).join('') || '').trim() + '\n';
  }
  
  if (node.type === 'orderedList') {
    return (node.content?.map((item: any, idx: number) => `${idx + 1}. ${tiptapJsonToMrkdwn(item)}\n`).join('') || '').trim() + '\n';
  }

  let childrenText = '';
  if (node.content) {
    childrenText = node.content.map((c: any) => tiptapJsonToMrkdwn(c)).join('');
  }

  switch (node.type) {
    case 'doc':
      return childrenText.trim();
    case 'paragraph':
      return childrenText + '\n';
    case 'blockquote':
      return '\n' + childrenText.split('\n').map(line => `> ${line}`).join('\n') + '\n';
    case 'listItem':
      return childrenText.trim();
    case 'codeBlock': {
      const lang = node.attrs?.language || 'text';
      return `\`\`\`${lang}\n${childrenText}\n\`\`\`\n`;
    }
    case 'hardBreak':
      return '\n';
    default:
      return childrenText;
  }
}
