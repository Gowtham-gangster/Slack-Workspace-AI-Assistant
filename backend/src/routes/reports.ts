import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth.js';
import { MCPClientManager, parseMCPResponse } from '../services/mcpClient.js';
import { saveEmbedding } from '../services/vectorStore.js';
import { generateEmbedding, getAPIConfig } from '../services/ai.js';
import { generateLocalFallbackReport } from '../services/fallback.js';

const router = Router();

// GET /api/reports
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const reports = await db.query('SELECT * FROM saved_reports WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    res.json(reports);
  } catch (error) {
    console.error('Failed to get reports:', error);
    res.status(500).json({ error: 'Failed to retrieve saved reports.' });
  }
});

// POST /api/reports/generate
router.post('/generate', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const { channelId, type, title } = req.body;

  if (!channelId || !type) {
    return res.status(400).json({ error: 'channelId and type are required parameters.' });
  }

  const validTypes = ['daily', 'weekly', 'meeting', 'sentiment', 'action_item', 'executive', 'productivity', 'risk', 'project'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` });
  }

  try {
    // 1. Fetch channel messages from Slack
    const userId = req.user!.id;
    const mcpManager = MCPClientManager.getInstance(userId);
    if (!mcpManager.isConnected()) {
      await mcpManager.initializeClient();
    }

    console.log(`Fetching messages from channel ${channelId} for report generation...`);
    const historyResponse = await mcpManager.callTool('slack_get_channel_history', {
      channel_id: channelId,
      limit: 100 // retrieve a substantial batch for report analysis
    });

    const parsedHistory = parseMCPResponse(historyResponse);
    const messages = parsedHistory?.messages || (Array.isArray(parsedHistory) ? parsedHistory : []);
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No messages found in the channel to analyze.' });
    }

    // Sort messages chronologically
    const sortedMessages = [...messages].sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
    
    // Concatenate messages into a single text block
    const messagesText = sortedMessages.map(m => {
      const time = new Date(parseFloat(m.ts) * 1000).toISOString().split('T')[1].slice(0, 5);
      return `[${time}] User ${m.user || 'bot'}: ${m.text || ''}`;
    }).join('\n');

    // 2. Select Prompt Template based on Report Type
    let reportPrompt = '';
    let reportTypeLabel = '';

    switch (type) {
      case 'executive':
        reportPrompt = `Analyze the following Slack conversation transcripts.
Generate a professional, strategic **Executive Summary Report** in markdown format.
Include the following exact sections:
1. **Strategic Overview & Progress** (A concise high-level synthesis of status and strategic direction)
2. **Key Outcomes & Achievements** (Major wins or technical breakthroughs completed)
3. **Strategic Decisions & Resource Allocation** (Decisions made and their impact on resources or focus)
4. **Next Steps & Priority Alignment** (Top priorities for execution)
`;
        reportTypeLabel = 'Executive Report';
        break;

      case 'productivity':
        reportPrompt = `Analyze the following Slack conversation transcripts.
Generate a structured **Team Productivity & Activity Report** in markdown format.
Include the following exact sections:
1. **Contribution Breakdown** (Est. activity level, response metrics, who drove the discussions)
2. **Task Completion & Deliverables Status** (Which tasks were discussed as completed, ongoing, or stuck)
3. **Response Rate & Collaboration Friction** (Communication velocity, responsiveness, team synergy review)
4. **Productivity Recommendations** (Ways to streamline processes or resolve communication delays)
`;
        reportTypeLabel = 'Productivity Report';
        break;

      case 'risk':
        reportPrompt = `Analyze the following Slack conversation transcripts.
Generate a comprehensive **Risk & Blockers Assessment Report** in markdown format.
Include the following exact sections:
1. **Critical Dependencies & Obstacles** (Identified dependencies, blockers, environment status, external dependencies)
2. **Technical Debt & Architectural Risks** (Shortcuts, testing gaps, database migration concerns, code design friction)
3. **Active Technical Issues & Outages** (System bugs, errors, environment downtime or deploy failures)
4. **Risk Mitigation Strategies** (Recommended steps to resolve blockers and mitigate technical risks)
`;
        reportTypeLabel = 'Risk Assessment';
        break;

      case 'project':
        reportPrompt = `Analyze the following Slack conversation transcripts.
Generate a comprehensive **Project Status & Roadmap Report** in markdown format.
Include the following exact sections:
1. **Roadmap & Phase Alignment** (Current phase of project, timeline alignment, milestones)
2. **Deliverables Ownership Mapping** (Assigned tasks, clear owners, and milestone targets)
3. **Release Schedule & Release Notes** (Deployment plans, versions, launch readiness highlights)
4. **Milestone Targets for Next Phase** (Roadmap deliverables for the coming sprint or cycle)
`;
        reportTypeLabel = 'Project Report';
        break;

      case 'meeting':
        reportPrompt = `Analyze the following Slack conversation transcripts as if it were a meeting recording.
Generate a professional, production-grade **Meeting Summary Report** in markdown format.
Include the following exact sections:
1. **Executive Discussion Summary** (A detailed paragraphs summarizing what was discussed)
2. **Key Decisions** (Bullet points outlining agreements or decisions made)
3. **Risks & Blockers** (Any issues, risks, or blockers identified)
4. **Action Items & Owners** (Tasks, their identified owners, status, and deadlines if discussed)
`;
        reportTypeLabel = 'Meeting Notes';
        break;

      case 'sentiment':
        reportPrompt = `Analyze the tone and emotion in the following Slack conversation.
Generate a comprehensive **Sentiment Analysis Report** in markdown.
Include:
1. **Overall Sentiment Assessment** (Score from -10 to +10, and general tone)
2. **Sentiment Breakdown** (Estimated percentages: Positive %, Neutral %, Negative %)
3. **Team Dynamics & Engagement Analysis** (Active contributors, tone dynamics, emerging issues)
4. **Actionable Recommendations** (How to resolve friction or boost team collaboration)
`;
        reportTypeLabel = 'Sentiment Report';
        break;

      case 'action_item':
        reportPrompt = `Review this Slack discussion to extract tasks and action items.
Generate a structured **Action Items & Task Tracker Report** in markdown.
Include:
1. **Task Tracker Table**:
   | Task Description | Owner | Status | Source Context / Message Quote |
2. **Deadlines & Milestones** (Dates mentioned for deliverables)
3. **Unassigned Tasks** (Action items discussed but lacking a clear owner)
`;
        reportTypeLabel = 'Action Items Tracker';
        break;

      case 'weekly':
        reportPrompt = `Synthesize this Slack discussion from the week.
Generate a high-level **Weekly Engineering & Channel Summary Report** in markdown.
Include:
1. **Weekly Achievements & Progress** (Key deliverables finished)
2. **Major Technical Topics** (Kubernetes, backend, DB discussions, code reviews)
3. **Emerging Concerns & Core Blockers** (Friction points or system outages discussed)
4. **Plan for Next Week** (Next steps mentioned)
`;
        reportTypeLabel = 'Weekly Summary';
        break;

      case 'daily':
      default:
        reportPrompt = `Review this channel activity for today.
Generate a **Daily Highlights & Activity Report** in markdown.
Include:
1. **Today's Highlights** (Top 3 key events or discussions)
2. **Topic Breakdown** (Categorized list of topics discussed)
3. **Task Progress & Decisions** (Updates, bug fixes, decisions)
`;
        reportTypeLabel = 'Daily Summary';
        break;
    }

    reportPrompt += `\n\nSlack Conversation Transcripts:\n---\n${messagesText}\n---\n\nFormat in clean GitHub-Flavored Markdown. Do not include plain text wrappers.`;

    // 3. Query LLM to generate the report using adapter settings
    const apiConfig = await getAPIConfig(userId);
    const { apiKey, apiBase, model } = apiConfig;

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key is not configured. Please set it in Settings.' });
    }

    let reportContent: string = '';
    try {
      console.log(`Querying LLM (${model}) for report generation...`);
      const llmResponse = await fetch(`${apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an advanced AI workspace analyst that produces structured markdown reports.' },
            { role: 'user', content: reportPrompt }
          ],
          temperature: 0.2 // lower temp for analysis accuracy
        })
      });

      if (!llmResponse.ok) {
        const errText = await llmResponse.text();
        throw new Error(`LLM Error: ${llmResponse.status} ${errText}`);
      }

      const llmData = await llmResponse.json() as any;
      reportContent = llmData.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        let members: any[] = [];
        try {
          const usersResponse = await mcpManager.callTool('slack_get_users', {});
          const parsedUsers = parseMCPResponse(usersResponse);
          members = parsedUsers?.members || (Array.isArray(parsedUsers) ? parsedUsers : []);
        } catch (_) {}
        const channelInfo = await db.queryOne<any>('SELECT name FROM slack_channels WHERE db_user_id = ? AND id = ?', [userId, channelId]);
        const channelName = channelInfo?.name || channelId;
        reportContent = generateLocalFallbackReport(messages, type, channelName, members);
      } else {
        throw err;
      }
    }

    if (!reportContent) {
      throw new Error('LLM did not return any report content.');
    }

    // 4. Save report to database
    const reportId = uuidv4();
    const channelInfo = await db.queryOne<any>('SELECT name FROM slack_channels WHERE db_user_id = ? AND id = ?', [userId, channelId]);
    const channelName = channelInfo?.name ? `#${channelInfo.name}` : channelId;
    const finalTitle = title || `${reportTypeLabel} - ${channelName} (${new Date().toLocaleDateString()})`;

    const metadata = {
      channelId,
      channelName,
      messageCount: messages.length,
      analyzedAt: new Date().toISOString()
    };

    await db.execute(`
      INSERT INTO saved_reports (user_id, id, title, content, type, channel_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, reportId, finalTitle, reportContent, type, channelId, JSON.stringify(metadata)]);

    // 5. Generate and store embeddings in RAG for searching reports
    try {
      const semanticReportText = `[Report Title: ${finalTitle}] [Type: ${type}] [Channel: ${channelName}]\n${reportContent}`;
      const vector = await generateEmbedding(semanticReportText, userId);
      await saveEmbedding(userId, 'report', reportId, reportContent, vector);
      console.log(`Indexed report ${reportId} in semantic vector store.`);
    } catch (vectorError) {
      console.error('Failed to index report in semantic store:', vectorError);
    }

    res.status(201).json({
      id: reportId,
      title: finalTitle,
      content: reportContent,
      type,
      channel_id: channelId,
      metadata,
      created_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Failed to generate report:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate report.' });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await db.execute('DELETE FROM saved_reports WHERE user_id = ? AND id = ?', [userId, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }
    
    // Also delete associated embedding
    await db.execute("DELETE FROM embeddings WHERE entity_type = 'report' AND entity_id = ?", [req.params.id]);
    
    res.json({ message: 'Report deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete report:', error);
    res.status(500).json({ error: 'Failed to delete report.' });
  }
});

export default router;
