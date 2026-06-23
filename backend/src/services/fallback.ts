export interface SlackMessage {
  user?: string;
  text?: string;
  ts: string;
}

export interface SlackMember {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    real_name?: string;
    image_32?: string;
    image_48?: string;
  };
}

// Stopwords helper for finding key topics
const STOPWORDS = new Set([
  'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'on', 'with', 'as', 'at', 'by',
  'an', 'be', 'this', 'are', 'from', 'or', 'you', 'your', 'i', 'we', 'they', 'he', 'she', 'it',
  'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'not', 'what', 'how', 'why',
  'who', 'where', 'when', 'which', 'will', 'would', 'can', 'could', 'should', 'about', 'more',
  'some', 'any', 'there', 'their', 'them', 'if', 'then', 'so', 'me', 'my', 'us', 'our', 'up',
  'down', 'out', 'into', 'over', 'after', 'before', 'just', 'like', 'than', 'only', 'new', 'some',
  'more', 'about', 'get', 'make', 'just', 'need', 'please', 'thanks', 'thank', 'sorry', 'hello',
  'hi', 'hey', 'okay', 'ok', 'good', 'great', 'awesome', 'work', 'working', 'help', 'want', 'think',
  'know', 'see', 'look', 'find', 'take', 'use', 'using', 'used', 'way', 'well', 'much', 'many'
]);

function getWordFrequency(messages: SlackMessage[]): string[] {
  const frequencies: Record<string, number> = {};
  for (const m of messages) {
    if (!m.text) continue;
    const words = m.text.toLowerCase().match(/\b[a-z]{4,15}\b/g) || [];
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      frequencies[w] = (frequencies[w] || 0) + 1;
    }
  }
  return Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function resolveMemberNames(messages: SlackMessage[], members: SlackMember[]): Map<string, string> {
  const memberMap = new Map<string, string>();
  for (const m of members) {
    memberMap.set(m.id, m.profile?.real_name || m.real_name || m.name || m.id);
  }
  return memberMap;
}

export function generateLocalFallbackSummary(
  messages: SlackMessage[],
  channelName: string,
  members: SlackMember[] = []
): string {
  const nameMap = resolveMemberNames(messages, members);
  
  const rawMeaningful = [...messages].reverse().filter(m => m.text && !m.text.includes('joined the channel'));
  const meaningfulMessages = rawMeaningful.map(m => {
    let text = m.text!.trim();
    text = text.replace(/<@([A-Z0-9]+)>/g, (_, id) => nameMap.get(id) || `@${id}`);
    return {
      user: nameMap.get(m.user || '') || m.user || 'Someone',
      text
    };
  }).filter(m => !m.text.startsWith('/') && !m.text.startsWith('\\'));

  if (meaningfulMessages.length === 0) {
    return JSON.stringify({
      conversationOverview: `No active discussion was recorded in the channel #${channelName} during this period.`,
      discussionThemes: [],
      keyDiscussionPoints: [],
      importantInsights: [],
      decisions: ["No explicit decisions were made."],
      actionItems: [],
      risks: ["No blockers identified."],
      participants: [],
      finalOutcome: "No outcomes generated."
    });
  }

  // Keywords and Topics
  const keywords = getWordFrequency(messages);
  const mainTopic = keywords[0] ? keywords[0].toLowerCase() : 'general updates';
  const subTopic = keywords[1] ? keywords[1].toLowerCase() : null;

  const discussionThemes = [
    {
      theme: `${mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1)} Discussion`,
      summary: `Participants discussed details related to ${mainTopic} contexts, aligning on task execution and sharing progress updates.`,
      importance: "High"
    }
  ];

  if (subTopic) {
    discussionThemes.push({
      theme: `${subTopic.charAt(0).toUpperCase() + subTopic.slice(1)} Updates`,
      summary: `The team reviewed information surrounding ${subTopic} context to coordinate dependent tasks and maintain transparency.`,
      importance: "Medium"
    });
  }

  // Conversation Overview
  let conversationOverview = `The discussion primarily centered on ${mainTopic}`;
  if (subTopic) {
    conversationOverview += ` and ${subTopic}`;
  }
  conversationOverview += `. Participants exchanged information regarding project contexts, aligned on work items, and reviewed coordination points.`;

  // Key Discussion Points
  const keyDiscussionPoints = [
    `Context sharing and progress updates related to ${mainTopic}`,
  ];
  if (subTopic) {
    keyDiscussionPoints.push(`Coordination updates and alignment on ${subTopic}`);
  }

  // Important Insights
  const importantInsights: string[] = [];
  const substantive = meaningfulMessages.filter(m => m.text.length > 25);
  substantive.slice(0, 3).forEach(m => {
    let cleanText = m.text.replace(/[.!?]+$/, '');
    if (cleanText.length > 120) cleanText = cleanText.substring(0, 120) + '...';
    importantInsights.push(`The discussion highlighted that ${cleanText.charAt(0).toLowerCase() + cleanText.slice(1)}`);
  });
  if (importantInsights.length === 0) {
    importantInsights.push(`The conversation revealed that team members are aligned on general workspace updates.`);
  }

  // Decisions Made
  const decisions: string[] = [];
  const decisionKeywords = ['agree', 'ok', 'yes', 'sure', 'done', 'approved', 'decided', 'will do'];
  meaningfulMessages.forEach(m => {
    const lower = m.text.toLowerCase();
    if (decisionKeywords.some(kw => lower.includes(kw)) && m.text.length > 15 && m.text.length < 80) {
      decisions.push(`Agreed to: ${m.text.replace(/[.!?]+$/, '')}`);
    }
  });

  // Action Items
  const actionItems: any[] = [];
  const fallbackActions = generateLocalFallbackActionPlans(messages, members);
  fallbackActions.forEach(item => {
    if (item.task && !item.task.includes('No explicit action items')) {
      actionItems.push({
        task: item.task,
        owner: item.owner,
        status: item.status
      });
    }
  });

  // Risks / Blockers
  const risks: string[] = [];
  const blockerKeywords = ['blocker', 'risk', 'delay', 'issue', 'problem', 'waiting', 'stuck', 'error', 'fail', 'broken', 'critical'];
  meaningfulMessages.forEach(m => {
    const lower = m.text.toLowerCase();
    if (blockerKeywords.some(kw => lower.includes(kw)) && m.text.length > 15) {
      risks.push(`Potential project blocker identified: "${m.text.replace(/[.!?]+$/, '')}"`);
    }
  });

  // Participants
  const participants = Array.from(new Set(meaningfulMessages.map(m => m.user)));

  // Final Outcome
  let finalOutcome = `The team successfully established alignment on the primary updates for ${mainTopic}. `;
  finalOutcome += `Next steps were defined to continue execution of outstanding tasks.`;

  return JSON.stringify({
    conversationOverview,
    discussionThemes,
    keyDiscussionPoints,
    importantInsights,
    decisions: decisions.length > 0 ? decisions : ["No explicit decisions were made."],
    actionItems,
    risks: risks.length > 0 ? risks : ["No blockers identified."],
    participants,
    finalOutcome
  });
}

export function generateLocalFallbackActionPlans(
  messages: SlackMessage[],
  members: SlackMember[] = []
): any[] {
  const nameMap = resolveMemberNames(messages, members);
  const tasks: any[] = [];
  const actionKeywords = [
    /\b(?:todo|task)\b/i,
    /\b(?:need\s+to|should|must|will)\s+([a-z0-9\s_-]{5,60})/i,
    /\b(?:fix|update|create|add|check|verify|run)\s+([a-z0-9\s_-]{5,60})/i,
  ];

  for (const m of messages) {
    if (!m.text) continue;
    const text = m.text.trim();
    let isAction = false;
    let taskText = '';
    
    if (text.startsWith('- [ ]') || text.toLowerCase().startsWith('todo:') || text.toLowerCase().startsWith('task:')) {
      isAction = true;
      taskText = text.replace(/^(- \[ \]|todo:|task:)\s*/i, '');
    } else {
      for (const rx of actionKeywords) {
        const match = text.match(rx);
        if (match) {
          isAction = true;
          taskText = match[1] ? match[0] : text;
          break;
        }
      }
    }

    if (isAction && taskText) {
      // Find potential owner
      const mentionMatch = text.match(/<@([A-Z0-9]+)>/);
      let owner = 'Unassigned';
      if (mentionMatch) {
        const mentionedId = mentionMatch[1];
        owner = nameMap.get(mentionedId) || `@${mentionedId}`;
      } else if (m.user) {
        owner = nameMap.get(m.user) || m.user;
      }
      
      // Clean task text
      if (taskText.length > 90) {
        taskText = taskText.substring(0, 90) + '...';
      }

      tasks.push({
        task: taskText,
        owner: owner,
        status: 'Pending',
        deadline: text.toLowerCase().includes('today') ? 'Today' : text.toLowerCase().includes('tomorrow') ? 'Tomorrow' : 'TBD'
      });
    }
  }

  // If no tasks found, return a message card
  if (tasks.length === 0) {
    tasks.push({
      task: 'No explicit action items detected in conversation history.',
      owner: 'System',
      status: 'Completed',
      deadline: '—'
    });
  }

  return tasks;
}

export function generateLocalFallbackReport(
  messages: SlackMessage[],
  type: string,
  channelName: string,
  members: SlackMember[] = []
): string {
  const nameMap = resolveMemberNames(messages, members);
  const total = messages.length;
  
  // Calculate unique participants
  const participants = new Set<string>();
  const freq: Record<string, number> = {};
  for (const m of messages) {
    if (m.user) {
      participants.add(m.user);
      freq[m.user] = (freq[m.user] || 0) + 1;
    }
  }

  const sortedContributors = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([userId, count]) => {
      const name = nameMap.get(userId) || userId;
      return `| ${name} | ${count} | ${((count / total) * 100).toFixed(1)}% |`;
    });

  const keywords = getWordFrequency(messages);
  const keywordStr = keywords.map(kw => `* **${kw.toUpperCase()}**`).join('\n');

  const actionItems = generateLocalFallbackActionPlans(messages, members);
  const actionRows = actionItems.map(item => `| ${item.task} | ${item.owner} | ${item.status} | ${item.deadline} |`);

  return `# Workspace Analytics Report - #${channelName}

## 1. Executive Summary
A local analysis was performed on **${total} messages** retrieved from the channel **#${channelName}**. The channel exhibits active participation from **${participants.size} unique contributors**.

---

## 2. Participant Engagement Analysis
Below is the contribution breakdown for this channel based on message frequency:

| Contributor | Total Messages | Contribution Share |
| :--- | :---: | :---: |
${sortedContributors.join('\n') || '| No contributors | 0 | 0% |'}

---

## 3. High-Frequency Discussion Terms
These keywords were identified as central topics of discussion in this time window:
${keywordStr || '* No significant topics extracted.'}

---

## 4. Localized Task Extraction & Action Plans
The following tasks were parsed from conversation patterns:

| Task | Assignee | Status | Deadline |
| :--- | :--- | :---: | :---: |
${actionRows.join('\n') || '| No action items detected | — | — | — |'}

---
*Report Generated on ${new Date().toLocaleString()}*`;
}
