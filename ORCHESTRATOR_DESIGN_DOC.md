# VANTA Core — Orchestrator Design Document

**Version:** 1.0  
**Date:** March 26, 2026  
**Status:** 🟡 Ready for Redesign  
**Audience:** UI/UX Designer, Product Designer

---

## 1. Executive Summary

### What is VANTA Core?

VANTA Core is an **autonomous security engagement engine** that simulates penetration testing workflows using AI agents. It orchestrates multi-phase security assessments (reconnaissance → scanning → enumeration → exploit simulation) with built-in policy gating, audit trails, and quality evaluation.

### Core Value Proposition

| For | Value |
|-----|-------|
| **Security Teams** | Automated pentest simulation, continuous security validation |
| **MSSPs** | Scalable engagement delivery, reduced manual effort |
| **Enterprises** | Continuous security posture assessment, compliance evidence |

### Current State

- ✅ **Backend:** Fully functional (Node.js + TypeScript)
- ✅ **AI Engine:** ReAct loop with tool orchestration
- ✅ **Database:** Neon PostgreSQL (14 tables)
- 🔴 **Frontend:** None (API-only, CLI-driven)
- 🔴 **Dashboard:** Command Center exists but basic

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VANTA CORE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Planner    │───▶│  AgentBrain  │───▶│  Evaluator   │               │
│  │  (Recon)     │    │  (Executor)  │    │  (Quality)   │               │
│  └──────────────┘    └──────┬───────┘    └──────────────┘               │
│                             │                                            │
│                             ▼                                            │
│                    ┌────────────────┐                                    │
│                    │ ToolRegistry   │                                    │
│                    │ - Subfinder    │                                    │
│                    │ - Nmap         │                                    │
│                    │ - Nuclei       │                                    │
│                    │ - HTTPx        │                                    │
│                    │ - Claude Code  │                                    │
│                    └────────┬───────┘                                    │
│                             │                                            │
│                             ▼                                            │
│                    ┌────────────────┐                                    │
│                    │ PolicyEngine   │                                    │
│                    │ (Risk Gating)  │                                    │
│                    └────────┬───────┘                                    │
│                             │                                            │
│           ┌─────────────────┼─────────────────┐                         │
│           │                 │                 │                         │
│           ▼                 ▼                 ▼                         │
│    ┌────────────┐   ┌────────────┐   ┌────────────┐                    │
│    │  Session   │   │   Audit    │   │   Phase    │                    │
│    │    Lane    │   │   Service  │   │  Contracts │                    │
│    │   Queue    │   │            │   │            │                    │
│    └─────┬──────┘   └─────┬──────┘   └─────┬──────┘                    │
│          │                │                │                            │
│          └────────────────┼────────────────┘                            │
│                           │                                             │
│                           ▼                                             │
│                  ┌─────────────────┐                                    │
│                  │   Neon DB       │                                    │
│                  │   (PostgreSQL)  │                                    │
│                  └─────────────────┘                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Breakdown

| Component | File | Responsibility | Lines |
|-----------|------|----------------|-------|
| **Orchestrator** | `src/orchestrator.ts` | Main loop, agent coordination | ~350 |
| **AgentBrain** | `src/agent/agent-brain.ts` | ReAct loop, tool execution | ~500 |
| **ToolRegistry** | `src/tools/tool-registry.ts` | Tool registration, execution | ~250 |
| **PolicyEngine** | `src/policy/policy-engine.ts` | Risk evaluation, gating | ~200 |
| **SessionLaneQueue** | `src/queue/session-lane.queue.ts` | Phase isolation, task queue | ~220 |
| **AuditService** | `src/audit/audit.service.ts` | Audit trail, compliance | ~120 |
| **Planner** | `src/planner/` | Engagement planning | TBD |
| **Evaluator** | `src/evaluator/` | Output quality grading | TBD |

---

## 3. User Journeys

### 3.1 Primary User Personas

| Persona | Role | Goals | Pain Points |
|---------|------|-------|-------------|
| **Security Manager (Sarah)** | MSSP delivery lead | Run 10+ engagements/week, deliver reports fast | Manual tool orchestration, inconsistent quality |
| **CISO (David)** | Enterprise security head | Continuous security validation, board reporting | Lack of visibility, no audit trail |
| **Pentester (Alex)** | Security consultant | Automate recon, focus on high-value findings | Repetitive manual work, tool sprawl |

---

### 3.2 User Journey: Security Manager (Sarah)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SARAH'S ENGAGEMENT WORKFLOW                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CREATE ENGAGEMENT                                                    │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Target: acme-corp.com                                       │     │
│     │ Tier: SMB ($20k)                                            │     │
│     │ Scope: External recon + vulnerability scan                  │     │
│     │ [Create Engagement]                                         │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                          │                                               │
│                          ▼                                               │
│  2. REVIEW PHASE PLAN                                                    │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Phase 1: RECON (Subfinder, HTTPx)                           │     │
│     │   - Find subdomains                                         │     │
│     │   - Identify tech stack                                     │     │
│     │   - Contract: ≥5 subdomains, ≥80% confidence                │     │
│     │                                                             │     │
│     │ Phase 2: SCAN (Nmap, Nuclei)                                │     │
│     │   - Port scan discovered hosts                              │     │
│     │   - Vulnerability templates                                 │     │
│     │   - Contract: All ports, CVSS scoring                       │     │
│     │                                                             │     │
│     │ [Approve Plan]                                              │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                          │                                               │
│                          ▼                                               │
│  3. MONITOR LIVE EXECUTION                                               │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ 🟢 RECON in progress (12 min elapsed)                       │     │
│     │                                                             │     │
│     │ ✅ Subfinder: 8 subdomains found                            │     │
│     │ ✅ HTTPx: 5 web technologies identified                     │     │
│     │ 🟡 Waiting for Evaluator grade...                           │     │
│     │                                                             │     │
│     │ Quality Score: 87/100 (Completeness: 90%, Accuracy: 85%)   │     │
│     │ [View Details] [Pause] [Escalate]                           │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                          │                                               │
│                          ▼                                               │
│  4. REVIEW FINDINGS                                                      │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ 📊 Engagement Summary                                       │     │
│     │                                                             │     │
│     │ 🔴 CRITICAL: 2                                              │     │
│     │ 🟠 HIGH: 5                                                  │     │
│     │ 🟡 MEDIUM: 12                                               │     │
│     │ 🟢 LOW: 8                                                   │     │
│     │                                                             │     │
│     │ [Generate Report] [Export CSV] [Send to Client]             │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.3 User Journey: CISO (David)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DAVID'S DASHBOARD VIEW                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  📊 SECURITY POSTURE OVERVIEW                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  Active Engagements: 3                                          │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │  🟢 acme-corp.com (RECON phase)                                 │    │
│  │  🟡 techstart.io (SCAN phase)                                   │    │
│  │  🔴 finance-app.com (EXPLOIT-SIM - requires approval)           │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  📈 MONTHLY TREND                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  Jan  Feb  Mar  Apr  May  Jun                                   │    │
│  │  ███  ████ █████ ██████ ███████ ████████                        │    │
│  │  2    4    8    12   15    20  (engagements)                     │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ⚠️ REQUIRES ATTENTION                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  🔴 finance-app.com: HIGH-risk tool request (nmap --exploit)    │    │
│  │     Risk Level: HIGH | Phase: EXPLOIT-SIM                       │    │
│  │     [Approve] [Deny] [Request More Info]                        │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  📋 COMPLIANCE AUDIT TRAIL                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  Last 7 days: 847 actions logged                                │    │
│  │  - 100% policy compliance                                       │    │
│  │  - 0 unauthorized actions                                       │    │
│  │  - Full audit trail available for SOC2/ISO27001                 │    │
│  │                                                                  │    │
│  │  [Download Audit Report]                                        │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Current API Endpoints

### 4.1 Orchestrator API (Port 39995)

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/status` | GET | System health | - | `{ status, uptime, agents, tasks }` |
| `/api/backlogs` | GET | All agent backlogs | - | `{ larry: {...}, quilly: {...} }` |
| `/api/command` | POST | Create task | `{ command, priority }` | `{ task_id, agent, status }` |
| `/api/engagements` | GET | List engagements | `?status=pending` | `[{ id, target, phase, status }]` |
| `/api/engagements/:id` | GET | Engagement details | - | `{ id, target, findings, audit_log }` |
| `/api/engagements` | POST | Create engagement | `{ target, tier, scope }` | `{ id, status }` |
| `/api/engagements/:id/approve` | POST | Approve phase | `{ phase, approved }` | `{ status }` |
| `/api/findings` | GET | List findings | `?engagement_id=xxx` | `[{ id, title, severity }]` |
| `/api/audit` | GET | Audit log | `?engagement_id=xxx&limit=50` | `[{ action, agent, timestamp }]` |

### 4.2 Command Center API (Port 39993)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard UI (basic HTML) |
| `/api/stats` | GET | System statistics |
| `/api/leads` | GET | Lead pipeline |
| `/api/activity` | GET | Recent activity log |
| `/api/content` | GET | Content calendar |
| `/api/revenue` | GET | Revenue tracking |

---

## 5. Data Models

### 5.1 Core Entities

```typescript
// Engagement (Security Assessment)
interface Engagement {
  id: UUID;
  target_domain: string;
  target_name?: string;
  status: 'pending' | 'recon' | 'scan' | 'enumerate' | 'exploit-sim' | 'complete' | 'failed';
  phase: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  tier: 'SMB' | 'Enterprise' | 'Intelligence' | 'Nation-State';
  price_usd: number;
  created_at: DateTime;
  started_at?: DateTime;
  completed_at?: DateTime;
}

// Finding (Vulnerability/Issue)
interface Finding {
  id: UUID;
  engagement_id: UUID;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cvss_score?: number;
  phase: string;
  evidence: JSON;
  remediation: string;
  status: 'open' | 'mitigated' | 'false-positive';
  created_at: DateTime;
}

// Phase Contract (Negotiated "Done" Criteria)
interface PhaseContract {
  id: UUID;
  engagement_id: UUID;
  phase: string;
  criteria: {
    min_subdomains?: number;
    confidence_threshold?: number;
    min_ports?: number;
  };
  negotiated_at: DateTime;
  completed: boolean;
  graded_at?: DateTime;
  grade_score?: number;
}

// Audit Log Entry
interface AuditLogEntry {
  id: UUID;
  engagement_id?: UUID;
  agent_name: string;
  action: string;
  tool_used?: string;
  input: JSON;
  output: JSON;
  risk_evaluation: 'ALLOWED' | 'GATED' | 'BLOCKED';
  timestamp: DateTime;
}
```

---

## 6. Current UI/UX Pain Points

### 6.1 What's Missing

| Area | Current State | Desired State |
|------|---------------|---------------|
| **Dashboard** | Basic HTML, no real-time updates | Live WebSocket dashboard with charts |
| **Engagement Creation** | CLI/API only | Visual wizard with scope builder |
| **Live Monitoring** | Poll API manually | Real-time progress, tool output streaming |
| **Findings Review** | JSON API response | Interactive table with filtering, export |
| **Audit Trail** | Raw JSON logs | Timeline view, searchable, filterable |
| **Report Generation** | Manual | One-click PDF/HTML report with branding |
| **Approval Workflow** | API call | Modal with context, approve/deny buttons |
| **Multi-Engagement View** | None | Kanban board or list view |

---

## 7. Design Requirements

### 7.1 Must-Have Screens

| Screen | Purpose | Priority |
|--------|---------|----------|
| **Dashboard** | Overview of all engagements, system health | 🔴 P0 |
| **Engagement Detail** | Single engagement view, live progress | 🔴 P0 |
| **Engagement Wizard** | Create new engagement with scope | 🔴 P0 |
| **Findings View** | List, filter, export findings | 🔴 P0 |
| **Audit Timeline** | Searchable audit trail | 🟡 P1 |
| **Report Builder** | Customize and generate PDF reports | 🟡 P1 |
| **Settings** | API keys, model config, risk thresholds | 🟢 P2 |
| **Approval Queue** | Pending high-risk actions | 🟡 P1 |

### 7.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Security First** | Never expose sensitive data in UI |
| **Real-Time** | WebSocket/SSE for live updates |
| **Actionable** | Every screen should have clear next actions |
| **Audit-Ready** | All actions logged, visible in UI |
| **Enterprise** | Professional, clean, SOC2/ISO27001 aesthetic |
| **Dark Mode** | Security teams prefer dark mode (default) |

### 7.3 Color Palette (Suggested)

```
Primary:     #10B981 (Emerald Green) — Success, safe actions
Secondary:   #6366F1 (Indigo) — Primary buttons, links
Warning:     #F59E0B (Amber) — Medium severity, pending approval
Danger:      #EF4444 (Red) — Critical findings, high-risk actions
Background:  #0F172A (Slate 900) — Dark mode default
Surface:     #1E293B (Slate 800) — Cards, panels
Text:        #F8FAFC (Slate 50) — Primary text
Muted:       #94A3B8 (Slate 400) — Secondary text
```

---

## 8. Competitive Reference

| Tool | What to借鉴 | URL |
|------|------------|-----|
| **Burp Suite** | Findings view, severity coloring | portswigger.net |
| **Nessus** | Report design, executive summaries | tenable.com |
| **Cobalt.io** | Modern pentest platform UX | cobalt.io |
| **Synack** | Crowdsourced pentest dashboard | synack.com |
| **Vanta (compliance)** | Compliance dashboard, audit trail | vanta.com |

---

## 9. Redesign Questions for Designer

### 9.1 Key Decisions

1. **Dashboard Layout:** Single-page app with tabs? Multi-page with sidebar? Kanban board?
2. **Real-Time Updates:** WebSocket? SSE? Polling every 5-10 seconds?
3. **Engagement Creation:** Multi-step wizard? Single-page form? Template-based?
4. **Findings View:** Table with filters? Card-based? Hybrid?
5. **Report Generation:** In-app PDF builder? HTML with print-to-PDF? Export to Word?
6. **Approval Workflow:** Modal popup? Dedicated approval queue page? Inline buttons?

### 9.2 Designer Deliverables

| Deliverable | Format | Deadline |
|-------------|--------|----------|
| **User Flow Diagrams** | Figma/Miro | TBD |
| **Wireframes (Low-Fi)** | Figma | TBD |
| **High-Fi Mockups** | Figma | TBD |
| **Interactive Prototype** | Figma Prototype | TBD |
| **Design System** | Figma Components | TBD |
| **Export Assets** | SVG/PNG | TBD |

---

## 10. Implementation Roadmap

### Phase 1: MVP Dashboard (2 weeks)
- [ ] Dashboard home (engagement overview)
- [ ] Engagement detail view
- [ ] Live progress indicator
- [ ] Basic findings table

### Phase 2: Engagement Management (2 weeks)
- [ ] Engagement wizard
- [ ] Approval workflow
- [ ] Audit timeline
- [ ] Report generation

### Phase 3: Advanced Features (4 weeks)
- [ ] Multi-engagement kanban
- [ ] Custom report builder
- [ ] Team collaboration
- [ ] API key management
- [ ] User auth (JWT)

---

## 11. Files & Resources

### 11.1 Codebase Structure

```
vanta-core/
├── src/
│   ├── orchestrator.ts       # Main entry point
│   ├── agent/
│   │   └── agent-brain.ts    # ReAct loop
│   ├── tools/
│   │   ├── tool-registry.ts
│   │   ├── subfinder.ts
│   │   ├── nmap.ts
│   │   ├── nuclei.ts
│   │   └── httpx.ts
│   ├── policy/
│   │   └── policy-engine.ts  # Risk gating
│   ├── queue/
│   │   └── session-lane.queue.ts
│   ├── audit/
│   │   └── audit.service.ts
│   ├── planner/              # TBD
│   ├── evaluator/            # TBD
│   └── api/                  # TBD (Express routes)
├── infra/
│   └── neon-schema.sql       # Database schema
├── test/
│   └── integration.test.ts
├── package.json
└── tsconfig.json
```

### 11.2 Key Files for Designer

| File | Purpose |
|------|---------|
| `src/orchestrator.ts` | Main logic flow |
| `infra/neon-schema.sql` | Data model reference |
| `PRODUCT_DEFINITION.md` | Business context |
| `vanta_opsec.md` | Security requirements |

---

## 12. Contact & Handoff

### For Questions

| Role | Contact |
|------|---------|
| **Product** | Zaif (Telegram) |
| **Engineering** | Nodevs (AI Agent) |
| **Design** | [Your Designer] |

### Design Handoff Checklist

- [ ] Figma file shared with engineering
- [ ] All screens documented with states (loading, empty, error)
- [ ] Interactive prototype for user testing
- [ ] Design system with reusable components
- [ ] Export assets (icons, logos, illustrations)
- [ ] Developer handoff notes (animations, transitions)

---

**Document Version:** 1.0  
**Last Updated:** March 26, 2026  
**Status:** 🟡 Ready for Designer Review
