# AI Workspace Intelligence Platform

An advanced AI-powered collaboration, analytics, and workflow automation platform built for Slack. The platform indexes conversations, extracts structured insights, and exposes an intelligent suite of analytical views to help teams track decisions, assign tasks, and query workspace knowledge.

---

## 🚀 Key Features

1. **AI Command Center & Semantic Search**
   - RAG-powered message search that fetches relevant transcripts.
   - Provides synthesized natural language summaries, participant lists, and related topics alongside relevance scores.

2. **Workspace Intelligence Dashboard**
   - High-fidelity **Workspace Intelligence Score** ring displaying aggregate team metrics.
   - Real-time **AI Workspace Insights** panel displaying dynamic, context-specific summaries powered by Gemini.

3. **Action Center Kanban Board (`/actions`)**
   - A Kanban-style interface (Pending / In Progress / Completed) tracking task lifecycles.
   - **AI Channel Scanner**: Extracts action plans, assignees, and deadlines directly from any synced Slack channel conversation history.
   - Real Slack avatar integration with initials fallback.

4. **Interactive AI Knowledge Graph (`/knowledge`)**
   - Visual entity mapping using **React Flow**.
   - Spoke-and-hub coordinates connecting People, Topics, Decisions, Tasks, and Projects.
   - **Node Inspector Sidebar** to detail connections and attributes.
   - Full dark/light contrast customization.

5. **AI Workspace Memory (`/memory`)**
   - Conversational search interface that synthesizes workspace questions into structured tabs (Summary, Decisions, Participants, Tasks, Risks, Timeline).

6. **Activity Timeline (`/timeline`)**
   - Vertical chronologically mapped timeline showing channel milestones like deployments, meetings, and bugs.

7. **Upgraded Reports & Recharts Analytics (`/reports`)**
   - High-performance data visualizations tracking volume trends, channel health, and task completion rates.
   - Executive, Team Productivity, Risk, and Project report types.
   - Export reports to clipboard or markdown file download.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js, React, TanStack Query, Recharts, React Flow, Lucide Icons, Tailwind CSS, Framer Motion.
- **Backend**: Express.js, TypeScript, MySQL.
- **AI Models**: Gemini 2.5 Models (2.5-flash / 2.0-flash / 2.5-flash-lite / embedding-2).
- **Integrations**: Slack MCP (Model Context Protocol) stdio client.

---

## ⚙️ Project Setup

### Prerequisites
- Node.js (v18+)
- MySQL Database

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in a `.env` file:
   ```env
   PORT=3001
   DB_HOST=127.0.0.1
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=slack_assistant
   OPENAI_API_KEY=your_gemini_key_or_openai_key
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application will run on `http://localhost:7505`.

---

## 🛡️ License

This project is licensed under the MIT License.
