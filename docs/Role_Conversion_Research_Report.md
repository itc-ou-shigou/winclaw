# Role Conversion Research Report — agency-agents → GRC Role Templates
# 角色转换研究报告 — agency-agents → GRC 角色模板

**Created**: 2026-03-15
**Author**: Claude Agent (Research & Planning)
**Source Repository**: https://github.com/msitarzewski/agency-agents (163 roles, 12 divisions)
**Target System**: GRC (WinClaw + A2A multi-agent enterprise platform)
**Related Documents**: GRC_Role_Templates_All_8_Roles.md, Role_Conversion_Skill_Analysis.md

---

## Table of Contents / 目录

1. [Overview / 概述](#1-overview--概述)
2. [GRC 8-File Template Structure / GRC 八文件模板结构](#2-grc-8-file-template-structure--grc-八文件模板结构)
3. [Complete Role Catalog / 完整角色目录](#3-complete-role-catalog--完整角色目录)
4. [Field Mapping / 字段映射](#4-field-mapping--字段映射)
5. [Department Grouping Recommendations / 部门分组建议](#5-department-grouping-recommendations--部门分组建议)
6. [Conversion Strategy / 转换策略](#6-conversion-strategy--转换策略)
7. [Output File Plan / 输出文件计划](#7-output-file-plan--输出文件计划)

---

## 1. Overview / 概述

### Source / 来源

The [agency-agents](https://github.com/msitarzewski/agency-agents) repository contains **163 AI agent role definitions** organized across **12 divisions** (Engineering, Design, Marketing, Sales, Paid Media, Product, Project Management, Testing, Support, Spatial Computing, Game Development, Specialized). Each role is defined as a single Markdown file with sections like "Core Mission," "Core Strengths," "How I Approach," "What I Deliver," "Success Metrics," and "Ask Me About."

该仓库包含 **163 个 AI 代理角色定义**，分布在 **12 个部门**中。每个角色以单个 Markdown 文件定义，包含"核心使命"、"核心能力"、"工作方式"、"交付成果"、"成功指标"和"咨询领域"等章节。

### Target / 目标

GRC (Gateway Role Controller) is the central management system for WinClaw AI employee nodes. Each role in GRC is defined by **8 Markdown configuration files** that are pushed to nodes via SSE. The 8-file structure enables fine-grained control over identity, behavior, collaboration, task execution, and autonomous operation.

GRC 是 WinClaw AI 员工节点的中央管理系统。GRC 中的每个角色由 **8 个 Markdown 配置文件**定义，通过 SSE 推送到节点。八文件结构实现了对身份、行为、协作、任务执行和自主运行的精细控制。

### Purpose / 目的

Expand GRC from **9 built-in roles** (CEO, Strategic Planner, Marketing, Sales, Product Manager, Finance, Engineering Lead, HR, Support) to **150+ roles** covering every major business function, technical specialty, and creative domain. This will make GRC a comprehensive platform for building AI-powered organizations of any size and industry.

将 GRC 从 **9 个内置角色**扩展到 **150+ 个角色**，覆盖所有主要业务功能、技术专业和创意领域。

### Scale / 规模

| Metric / 指标 | Value / 值 |
|---|---|
| Source roles / 源角色数 | 163 |
| Target roles (after dedup) / 目标角色数 | ~150 |
| Files per role / 每角色文件数 | 8 |
| Total MD files to generate / 总 MD 文件数 | ~1,200 |
| Estimated total content / 预计总内容量 | ~600 KB |

---

## 2. GRC 8-File Template Structure / GRC 八文件模板结构

Each GRC role consists of exactly 8 Markdown files. These files are stored in the database and pushed to WinClaw nodes as part of the role configuration. The system uses template variables (`${employee_name}`, `${company_name}`, `${employee_id}`, `${human_name}`) that are interpolated at deployment time.

每个 GRC 角色由 8 个 Markdown 文件组成。这些文件存储在数据库中，作为角色配置的一部分推送到 WinClaw 节点。系统使用模板变量，在部署时进行插值替换。

### 2.1 IDENTITY.md (100–200 chars)

**Purpose**: One-line role statement establishing who the agent is.
**用途**: 一行式角色声明，确立代理身份。

**Required fields**:
- Name (template variable)
- Role title
- Department
- Employee ID (template variable)
- Emoji
- Company (template variable)
- Mode (autonomous / copilot)
- Reports To

**Example pattern**:
```
# IDENTITY
- **Name:** ${employee_name}
- **Role:** Backend Architect
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🏗️
- **Company:** ${company_name}
- **Mode:** autonomous
```

### 2.2 SOUL.md (100–300 chars)

**Purpose**: 2–3 core professional values and decision-making principles.
**用途**: 2–3 个核心专业价值观和决策原则。

**Required sections**:
- Core Principles (3–6 bullet points)
- Expertise areas (5–8 bullet points)
- Decision Framework (3–5 numbered steps)
- Communication Style (3–5 bullet points)
- Boundaries (what the role should NOT do)

**Key design rule**: SOUL.md defines the agent's character and ethical guardrails. It should be role-specific but consistent with company values.

### 2.3 AGENTS.md (1500–2500 chars) — PRIMARY FILE

**Purpose**: Role identity, expertise, collaboration rules, and proactive behavior. This is the most important file — it defines how the agent operates day-to-day.
**用途**: 角色身份、专业能力、协作规则和主动行为。这是最重要的文件。

**Required sections**:
- **Your Role**: Role description, department, core responsibilities
- **Operating Mode (Autonomous)**: Independent decision-making scope
- **Operating Mode (Copilot)**: Human-supervised operation mode
- **Session Startup**: Boot sequence (read SOUL, check TASKS, load memory)
- **Peer Agents**: Which other roles this agent collaborates with via `sessions_send`
- **Meeting Participation**: How to propose agendas, build consensus, document outcomes
- **Proactive Behavior**: Don't wait for tasks — identify gaps, propose initiatives, coordinate with peers
- **Resource Mindset**: Achieving KPIs requires investment — identify tools/services needed, submit expense requests
- **Escalation Rules**: When to escalate to CEO vs. resolve independently
- **A2A Coordination**: Direct reports and lateral collaborators

### 2.4 TASKS.md (SHARED PATTERN — identical across all roles)

**Purpose**: Task lifecycle rules, status flow, review rules, and expense workflow.
**用途**: 任务生命周期规则、状态流转、审查规则和费用工作流。

**This file uses a SHARED template** — the content is identical for all roles:

```
# TASKS

## Status Flow
pending -> in_progress -> review -> approved -> completed
(in_progress -> blocked if stuck; review -> in_progress if rejected)

## Review Rules
- Self-created tasks: CEO review required (no self-approval)
- Assigned tasks: creator/supervisor reviews after completion
- On rejection: read feedback comment, fix issues, resubmit

## Strategic Task Creation
Before creating tasks, consult company strategy:
1. Fetch strategy: GET /a2a/strategy/summary?node_id={your_node_id}
2. Check short-term objectives (current quarter) and KPIs
3. Identify gaps between current progress and targets
4. Discuss with peer agents via sessions_send or meetings
5. Create tasks aligned with strategy using grc_task tool
   - trigger_type: "strategy" or "meeting"
   - Include concrete deliverables and deadlines
   - Align with department budget constraints

## Expense Requests
When achieving a goal requires spending money:
1. Create task with category="expense", expense_amount, expense_currency
2. Justify the expense with expected ROI and KPI impact
3. Task enters admin approval queue — human boss reviews and pays
4. After payment confirmation, proceed with execution
5. Coordinate with finance agent on budget availability

## Continuous Processing
- After completion, next pending task auto-dispatched via SSE
- If no notification, check queue manually
- If queue empty, review strategy and create new tasks

## Quality
- Produce real deliverables, not just status changes
- Save outputs to workspace/ directory
- Include deliverable summary and file paths in result_summary
```

### 2.5 TOOLS.md (700–1100 chars)

**Purpose**: Available tools grouped by category — both GRC built-in tools and role-specific plugins.
**用途**: 按类别分组的可用工具——包括 GRC 内置工具和角色特定插件。

**Always-present categories**:
- **GRC Task Tools**: `grc_task`, `grc_task_update`, `grc_task_complete`, `grc_task_accept`, `grc_task_reject`
- **Expense Requests**: `grc_task` with `category="expense"`, `expense_amount`, `expense_currency`
- **A2A Communication**: `sessions_send`, `web_fetch` (for GRC API endpoints)

**Role-specific additions**: Each role may specify domain-specific plugin commands (e.g., marketing plugin: `/campaign-plan`, `/seo-audit`; engineering plugin: `/deploy`, `/code-review`).

### 2.6 HEARTBEAT.md (800–1300 chars)

**Purpose**: Periodic autonomous behavior — what the agent does when idle.
**用途**: 周期性自主行为——代理空闲时的行为。

**Standard priority order**:
1. Check for pending GRC tasks → execute immediately
2. Check for task feedback (review/rejected) → address immediately
3. If no tasks: fetch strategy, identify department gaps
4. If gaps found: coordinate with peers, create new tasks
5. Produce at least one concrete deliverable per session

**Role-specific additions**: Weekly/monthly cadence items, KPI review, budget utilization checks, proactive resource procurement.

### 2.7 USER.md (500–900 chars)

**Purpose**: Interaction style with human supervisor.
**用途**: 与人类主管的交互风格。

**Required content**:
- How to present reports and summaries
- When to ask for approval vs. act autonomously
- Response format preferences (tables, bullet points, etc.)
- Proactive reporting cadence (daily/weekly/monthly)
- Escalation triggers for human attention

### 2.8 BOOTSTRAP.md (100–300 chars)

**Purpose**: Initial startup checklist when the agent first activates.
**用途**: 代理首次激活时的启动清单。

**Standard pattern**:
1. Fetch company strategy via API
2. Check pending tasks in queue
3. Read SOUL.md and AGENTS.md for role context
4. Introduce self to peer agents via `sessions_send`
5. Begin first task or conduct strategic gap analysis

---

## 3. Complete Role Catalog / 完整角色目录

All 163 roles organized by department. Each entry includes: ID, Name (中文名), Emoji, Department, Recommended Mode, Brief Description.

所有 163 个角色按部门组织。每条包含：ID、名称（中文名）、Emoji、部门、推荐模式、简要描述。

---

### 3.1 Engineering / 工程部 (23 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `backend-architect` | Backend Architect (后端架构师) | 🏗️ | autonomous | System design, API architecture, scalability patterns |
| 2 | `frontend-developer` | Frontend Developer (前端开发) | 💻 | autonomous | UI implementation, component libraries, responsive design |
| 3 | `mobile-app-builder` | Mobile App Builder (移动应用开发) | 📱 | autonomous | iOS/Android development, cross-platform frameworks |
| 4 | `ai-engineer` | AI Engineer (AI工程师) | 🤖 | autonomous | ML model development, training pipelines, inference optimization |
| 5 | `devops-automator` | DevOps Automator (DevOps自动化) | ⚙️ | autonomous | CI/CD pipelines, infrastructure as code, deployment automation |
| 6 | `rapid-prototyper` | Rapid Prototyper (快速原型) | 🚀 | autonomous | Quick proof-of-concepts, MVPs, technology validation |
| 7 | `senior-developer` | Senior Developer (高级开发) | 👨‍💻 | autonomous | Full-stack development, mentoring, technical leadership |
| 8 | `security-engineer` | Security Engineer (安全工程师) | 🔒 | autonomous | Application security, vulnerability assessment, security architecture |
| 9 | `autonomous-optimization-architect` | Optimization Architect (优化架构师) | 📈 | autonomous | Performance optimization, system tuning, efficiency improvements |
| 10 | `embedded-firmware-engineer` | Firmware Engineer (固件工程师) | 🔌 | autonomous | Embedded systems, firmware development, hardware interfaces |
| 11 | `incident-response-commander` | Incident Commander (事故指挥) | 🚨 | copilot | Incident management, crisis response, post-mortem coordination |
| 12 | `solidity-smart-contract-engineer` | Solidity Engineer (Solidity工程师) | ⛓️ | autonomous | Smart contract development, DeFi protocols, blockchain security |
| 13 | `technical-writer` | Technical Writer (技术文档) | ✍️ | autonomous | Documentation, API references, developer guides |
| 14 | `threat-detection-engineer` | Threat Detection (威胁检测) | 🛡️ | autonomous | Security monitoring, threat hunting, SIEM management |
| 15 | `wechat-mini-program-developer` | WeChat Dev (微信小程序开发) | 📲 | autonomous | WeChat Mini Program development, WXML/WXSS, WeChat APIs |
| 16 | `code-reviewer` | Code Reviewer (代码审查) | 🔍 | autonomous | Code quality analysis, best practices enforcement, PR reviews |
| 17 | `database-optimizer` | Database Optimizer (数据库优化) | 🗄️ | autonomous | Query optimization, schema design, database performance tuning |
| 18 | `git-workflow-master` | Git Workflow Master (Git工作流) | 🔀 | autonomous | Version control strategy, branching models, merge conflict resolution |
| 19 | `software-architect` | Software Architect (软件架构师) | 🏛️ | autonomous | System architecture, design patterns, technology selection |
| 20 | `sre` | SRE (站点可靠性工程师) | 📊 | autonomous | Reliability engineering, SLO management, observability |
| 21 | `ai-data-remediation-engineer` | Data Remediation (数据修复) | 🧹 | autonomous | Data quality, data cleaning, pipeline repair |
| 22 | `data-engineer` | Data Engineer (数据工程师) | 🔧 | autonomous | Data pipelines, ETL/ELT, data warehouse architecture |
| 23 | `feishu-integration-developer` | Feishu Integration (飞书集成) | 📎 | autonomous | Feishu/Lark API integration, bot development, workflow automation |

---

### 3.2 Design / 设计部 (8 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `ui-designer` | UI Designer (UI设计师) | 🎨 | autonomous | Visual design, design systems, component specification |
| 2 | `ux-researcher` | UX Researcher (UX研究员) | 🔬 | autonomous | User research, usability testing, persona development |
| 3 | `ux-architect` | UX Architect (UX架构师) | 📐 | autonomous | Information architecture, user flows, interaction design |
| 4 | `brand-guardian` | Brand Guardian (品牌守护者) | 🛡️ | autonomous | Brand consistency, style guide enforcement, brand voice |
| 5 | `visual-storyteller` | Visual Storyteller (视觉叙事) | 🎬 | autonomous | Visual narrative design, motion graphics, presentation design |
| 6 | `whimsy-injector` | Whimsy Injector (趣味注入) | ✨ | autonomous | Delight moments, micro-interactions, personality in design |
| 7 | `image-prompt-engineer` | Image Prompt Engineer (图像提示工程师) | 🖼️ | autonomous | AI image generation prompts, visual asset creation |
| 8 | `inclusive-visuals-specialist` | Inclusive Visuals (包容性视觉) | ♿ | autonomous | Accessibility design, inclusive imagery, WCAG compliance |

---

### 3.3 Marketing / 市场营销部 (26 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `growth-hacker` | Growth Hacker (增长黑客) | 📈 | autonomous | Growth experiments, viral mechanics, acquisition funnels |
| 2 | `content-creator` | Content Creator (内容创作) | ✏️ | autonomous | Blog posts, articles, whitepapers, content strategy |
| 3 | `twitter-engager` | Twitter Engager (Twitter运营) | 🐦 | autonomous | Twitter/X content strategy, engagement, community building |
| 4 | `tiktok-strategist` | TikTok Strategist (TikTok策略) | 🎵 | autonomous | TikTok content strategy, trends, short-form video |
| 5 | `instagram-curator` | Instagram Curator (Instagram策展) | 📸 | autonomous | Instagram visual strategy, stories, reels, hashtag optimization |
| 6 | `reddit-community-builder` | Reddit Community Builder (Reddit社区) | 🔴 | autonomous | Reddit engagement, subreddit strategy, community management |
| 7 | `app-store-optimizer` | App Store Optimizer (应用商店优化) | 📲 | autonomous | ASO, keyword optimization, screenshot design, A/B testing |
| 8 | `social-media-strategist` | Social Media Strategist (社媒策略) | 📱 | autonomous | Cross-platform social strategy, content calendar, analytics |
| 9 | `xiaohongshu-specialist` | Xiaohongshu Specialist (小红书运营) | 📕 | autonomous | Xiaohongshu content strategy, KOL collaboration, e-commerce |
| 10 | `wechat-official-account-manager` | WeChat Account Manager (微信公众号运营) | 💚 | autonomous | WeChat content, follower growth, menu design, mini-programs |
| 11 | `zhihu-strategist` | Zhihu Strategist (知乎策略) | 💡 | autonomous | Zhihu Q&A strategy, thought leadership, brand authority |
| 12 | `baidu-seo-specialist` | Baidu SEO Specialist (百度SEO) | 🔎 | autonomous | Baidu search optimization, SEM, keyword research |
| 13 | `bilibili-content-strategist` | Bilibili Content Strategist (B站内容策略) | 📺 | autonomous | Bilibili video strategy, danmaku culture, UP主 growth |
| 14 | `carousel-growth-engine` | Carousel Growth Engine (轮播增长引擎) | 🎠 | autonomous | Carousel post optimization, swipe-through content design |
| 15 | `linkedin-content-creator` | LinkedIn Content Creator (LinkedIn内容) | 💼 | autonomous | LinkedIn thought leadership, B2B content, professional networking |
| 16 | `china-ecommerce-operator` | China E-commerce Operator (中国电商运营) | 🛒 | autonomous | Tmall/JD/PDD operations, product listings, promotions |
| 17 | `kuaishou-strategist` | Kuaishou Strategist (快手策略) | 📹 | autonomous | Kuaishou content strategy, live streaming, rural market |
| 18 | `seo-specialist` | SEO Specialist (SEO专家) | 🔍 | autonomous | Search engine optimization, technical SEO, link building |
| 19 | `book-co-author` | Book Co-Author (图书协作) | 📚 | autonomous | Book writing assistance, manuscript development, editing |
| 20 | `cross-border-ecommerce-specialist` | Cross-Border E-commerce (跨境电商) | 🌏 | autonomous | Cross-border logistics, international marketplace operations |
| 21 | `douyin-strategist` | Douyin Strategist (抖音策略) | 🎶 | autonomous | Douyin content strategy, algorithm optimization, e-commerce |
| 22 | `livestream-commerce-coach` | Livestream Commerce Coach (直播电商教练) | 🎙️ | autonomous | Live selling techniques, script writing, engagement tactics |
| 23 | `podcast-strategist` | Podcast Strategist (播客策略) | 🎧 | autonomous | Podcast production, distribution, audience growth |
| 24 | `private-domain-operator` | Private Domain Operator (私域运营) | 🔐 | autonomous | Private traffic management, WeChat groups, CRM funnels |
| 25 | `short-video-editing-coach` | Short Video Editing Coach (短视频剪辑教练) | 🎞️ | autonomous | Video editing techniques, pacing, hooks, platform-specific formats |
| 26 | `weibo-strategist` | Weibo Strategist (微博策略) | 🔥 | autonomous | Weibo content strategy, hot search, fan engagement |

---

### 3.4 Sales / 销售部 (8 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `outbound-strategist` | Outbound Strategist (外呼策略) | 📞 | autonomous | Outbound sales campaigns, cold outreach, prospecting |
| 2 | `discovery-coach` | Discovery Coach (发现教练) | 🎯 | autonomous | Discovery call frameworks, qualification, need identification |
| 3 | `deal-strategist` | Deal Strategist (交易策略) | 🤝 | autonomous | Deal structuring, negotiation tactics, closing strategies |
| 4 | `sales-engineer` | Sales Engineer (售前工程师) | 🔧 | autonomous | Technical demos, POC management, solution architecture |
| 5 | `proposal-strategist` | Proposal Strategist (提案策略) | 📋 | autonomous | RFP responses, proposal writing, competitive positioning |
| 6 | `pipeline-analyst` | Pipeline Analyst (管线分析) | 📊 | autonomous | Sales pipeline analysis, forecasting, funnel optimization |
| 7 | `account-strategist` | Account Strategist (客户策略) | 👥 | autonomous | Account planning, expansion strategy, customer success |
| 8 | `sales-coach` | Sales Coach (销售教练) | 🏆 | autonomous | Sales training, methodology coaching, performance improvement |

---

### 3.5 Paid Media / 付费媒体部 (7 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `ppc-campaign-strategist` | PPC Campaign Strategist (PPC策略) | 💰 | autonomous | Pay-per-click campaigns, bid management, budget allocation |
| 2 | `search-query-analyst` | Search Query Analyst (搜索查询分析) | 🔎 | autonomous | Search term analysis, negative keywords, query intent |
| 3 | `paid-media-auditor` | Paid Media Auditor (付费媒体审计) | 📑 | autonomous | Campaign audits, waste identification, optimization recommendations |
| 4 | `tracking-measurement-specialist` | Tracking & Measurement (跟踪与测量) | 📏 | autonomous | Conversion tracking, attribution modeling, analytics setup |
| 5 | `ad-creative-strategist` | Ad Creative Strategist (广告创意策略) | 🎨 | autonomous | Ad copy, creative testing, visual ad design direction |
| 6 | `programmatic-display-buyer` | Programmatic Display Buyer (程序化购买) | 🖥️ | autonomous | Programmatic buying, DSP management, audience targeting |
| 7 | `paid-social-strategist` | Paid Social Strategist (付费社交策略) | 📣 | autonomous | Paid social campaigns, audience segmentation, creative optimization |

---

### 3.6 Product / 产品部 (5 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `sprint-prioritizer` | Sprint Prioritizer (冲刺优先级) | 🏃 | autonomous | Sprint planning, backlog prioritization, capacity planning |
| 2 | `trend-researcher` | Trend Researcher (趋势研究) | 🔭 | autonomous | Market trends, competitive analysis, emerging technology tracking |
| 3 | `feedback-synthesizer` | Feedback Synthesizer (反馈综合) | 🧩 | autonomous | User feedback analysis, feature request categorization, insight extraction |
| 4 | `behavioral-nudge-engine` | Behavioral Nudge Engine (行为助推引擎) | 🧠 | autonomous | Behavioral design, nudge strategies, user engagement mechanics |
| 5 | `product-manager` | Product Manager (产品经理) | 📦 | autonomous | Product roadmap, feature specification, stakeholder alignment |

---

### 3.7 Project Management / 项目管理部 (6 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `studio-producer` | Studio Producer (工作室制作人) | 🎬 | autonomous | Production management, resource allocation, timeline tracking |
| 2 | `project-shepherd` | Project Shepherd (项目牧羊人) | 🐑 | autonomous | Project tracking, risk management, stakeholder communication |
| 3 | `studio-operations` | Studio Operations (工作室运营) | 🏢 | autonomous | Operational efficiency, process optimization, team coordination |
| 4 | `experiment-tracker` | Experiment Tracker (实验追踪) | 🧪 | autonomous | A/B test management, experiment design, results analysis |
| 5 | `senior-project-manager` | Senior Project Manager (高级项目经理) | 📋 | autonomous | Complex project management, cross-team coordination, milestone tracking |
| 6 | `jira-workflow-steward` | Jira Workflow Steward (Jira工作流管家) | 🔄 | autonomous | Jira administration, workflow design, board optimization |

---

### 3.8 Testing / 测试部 (8 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `evidence-collector` | Evidence Collector (证据收集) | 📋 | autonomous | Test evidence gathering, documentation, audit trails |
| 2 | `reality-checker` | Reality Checker (现实检验) | ✅ | autonomous | Assumption validation, fact-checking, claim verification |
| 3 | `test-results-analyzer` | Test Results Analyzer (测试结果分析) | 📊 | autonomous | Test data analysis, trend identification, quality metrics |
| 4 | `performance-benchmarker` | Performance Benchmarker (性能基准) | ⚡ | autonomous | Performance testing, benchmarking, bottleneck identification |
| 5 | `api-tester` | API Tester (API测试) | 🔌 | autonomous | API testing, contract testing, integration validation |
| 6 | `tool-evaluator` | Tool Evaluator (工具评估) | 🛠️ | autonomous | Tool assessment, vendor comparison, technology evaluation |
| 7 | `workflow-optimizer` | Workflow Optimizer (工作流优化) | ⚙️ | autonomous | Process improvement, automation identification, efficiency gains |
| 8 | `accessibility-auditor` | Accessibility Auditor (无障碍审计) | ♿ | autonomous | WCAG compliance testing, accessibility review, remediation guidance |

---

### 3.9 Support / 支持部 (6 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `support-responder` | Support Responder (客服响应) | 💬 | autonomous | Customer support, ticket resolution, knowledge base |
| 2 | `analytics-reporter` | Analytics Reporter (分析报告) | 📈 | autonomous | Data reporting, dashboard creation, metric visualization |
| 3 | `finance-tracker` | Finance Tracker (财务追踪) | 💵 | autonomous | Financial tracking, budget monitoring, expense reporting |
| 4 | `infrastructure-maintainer` | Infrastructure Maintainer (基础设施维护) | 🖧 | autonomous | Infrastructure monitoring, maintenance, capacity planning |
| 5 | `legal-compliance-checker` | Legal Compliance Checker (法律合规检查) | ⚖️ | autonomous | Legal review, compliance checking, regulatory adherence |
| 6 | `executive-summary-generator` | Executive Summary Generator (高管摘要生成) | 📝 | autonomous | Executive reports, board summaries, strategic briefings |

---

### 3.10 Spatial Computing / 空间计算部 (6 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `xr-interface-architect` | XR Interface Architect (XR界面架构师) | 🥽 | autonomous | XR interface design, spatial UI/UX, immersive interaction patterns |
| 2 | `macos-spatial-metal-engineer` | macOS Spatial Metal Engineer (macOS空间Metal工程师) | 🍎 | autonomous | Metal graphics, macOS spatial computing, GPU optimization |
| 3 | `xr-immersive-developer` | XR Immersive Developer (XR沉浸式开发) | 🌐 | autonomous | VR/AR development, 3D rendering, spatial audio |
| 4 | `xr-cockpit-interaction-specialist` | XR Cockpit Interaction (XR座舱交互) | ✈️ | autonomous | Cockpit UI design, heads-up displays, spatial controls |
| 5 | `visionos-spatial-engineer` | visionOS Spatial Engineer (visionOS空间工程师) | 👓 | autonomous | visionOS development, spatial computing, Apple Vision Pro |
| 6 | `terminal-integration-specialist` | Terminal Integration (终端集成) | 🖥️ | autonomous | Terminal-based spatial computing, CLI integration, text UI in XR |

---

### 3.11 Game Development / 游戏开发部 (22 roles)

#### Cross-Engine / 跨引擎 (5 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `game-designer` | Game Designer (游戏设计师) | 🎮 | autonomous | Game mechanics, level flow, player experience design |
| 2 | `level-designer` | Level Designer (关卡设计师) | 🗺️ | autonomous | Level layout, encounter design, environmental storytelling |
| 3 | `narrative-designer` | Narrative Designer (叙事设计师) | 📖 | autonomous | Story structure, dialogue systems, branching narratives |
| 4 | `technical-artist` | Technical Artist (技术美术) | 🎭 | autonomous | Shader development, pipeline tools, art-engineering bridge |
| 5 | `game-audio-engineer` | Game Audio Engineer (游戏音频工程师) | 🔊 | autonomous | Game audio systems, sound design, adaptive music |

#### Unity (4 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 6 | `unity-architect` | Unity Architect (Unity架构师) | 🏗️ | autonomous | Unity project architecture, ECS patterns, performance |
| 7 | `unity-shader-graph-artist` | Unity Shader Graph Artist (Unity着色器图形) | 🌈 | autonomous | Shader Graph, visual effects, material creation |
| 8 | `unity-multiplayer-engineer` | Unity Multiplayer Engineer (Unity多人游戏) | 🌐 | autonomous | Netcode, multiplayer architecture, lobby systems |
| 9 | `unity-editor-tool-developer` | Unity Editor Tool Developer (Unity编辑器工具) | 🔨 | autonomous | Custom editor tools, workflow automation, pipeline extensions |

#### Unreal Engine (4 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 10 | `unreal-systems-engineer` | Unreal Systems Engineer (虚幻系统工程师) | ⚙️ | autonomous | Unreal C++, gameplay systems, engine customization |
| 11 | `unreal-technical-artist` | Unreal Technical Artist (虚幻技术美术) | 🎨 | autonomous | Unreal materials, Niagara VFX, rendering optimization |
| 12 | `unreal-multiplayer-architect` | Unreal Multiplayer Architect (虚幻多人架构师) | 🌍 | autonomous | Dedicated servers, replication, session management |
| 13 | `unreal-world-builder` | Unreal World Builder (虚幻世界构建) | 🏔️ | autonomous | World Partition, landscape, procedural generation |

#### Godot (3 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 14 | `godot-gameplay-scripter` | Godot Gameplay Scripter (Godot游戏脚本) | 📜 | autonomous | GDScript/C#, gameplay programming, scene management |
| 15 | `godot-multiplayer-engineer` | Godot Multiplayer Engineer (Godot多人游戏) | 🔗 | autonomous | Godot networking, ENet, multiplayer synchronization |
| 16 | `godot-shader-developer` | Godot Shader Developer (Godot着色器开发) | ✨ | autonomous | Godot shading language, visual shaders, rendering |

#### Blender (1 role)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 17 | `blender-addon-engineer` | Blender Addon Engineer (Blender插件工程师) | 🧊 | autonomous | Blender Python API, addon development, pipeline tools |

#### Roblox (3 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 18 | `roblox-systems-scripter` | Roblox Systems Scripter (Roblox系统脚本) | 🧱 | autonomous | Luau scripting, game systems, server architecture |
| 19 | `roblox-experience-designer` | Roblox Experience Designer (Roblox体验设计) | 🎢 | autonomous | Roblox experience design, monetization, player engagement |
| 20 | `roblox-avatar-creator` | Roblox Avatar Creator (Roblox头像创作) | 👤 | autonomous | Avatar systems, UGC items, character customization |

#### Platform-Specific (2 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 21 | `game-qa-tester` | Game QA Tester (游戏QA测试) | 🐛 | autonomous | Game testing, bug reproduction, test case design |
| 22 | `game-economy-designer` | Game Economy Designer (游戏经济设计) | 💎 | autonomous | Virtual economy design, monetization, balance tuning |

---

### 3.12 Specialized / 专业角色 (24 roles)

| # | ID | Name (中文名) | Emoji | Mode | Description |
|---|---|---|---|---|---|
| 1 | `agents-orchestrator` | Agents Orchestrator (代理编排) | 🎯 | autonomous | Multi-agent coordination, workflow orchestration, task delegation |
| 2 | `lsp-index-engineer` | LSP Index Engineer (LSP索引工程师) | 📇 | autonomous | Language Server Protocol, code indexing, semantic analysis |
| 3 | `sales-data-extraction-agent` | Sales Data Extraction (销售数据提取) | 📤 | autonomous | CRM data extraction, sales data pipelines, reporting |
| 4 | `data-consolidation-agent` | Data Consolidation (数据整合) | 🔄 | autonomous | Data merging, deduplication, cross-system consolidation |
| 5 | `report-distribution-agent` | Report Distribution (报告分发) | 📨 | autonomous | Automated report generation and distribution, scheduling |
| 6 | `agentic-identity-trust-architect` | Identity Trust Architect (身份信任架构师) | 🔐 | autonomous | Agent identity management, trust frameworks, authentication |
| 7 | `identity-graph-operator` | Identity Graph Operator (身份图谱运营) | 🕸️ | autonomous | Identity resolution, graph databases, entity matching |
| 8 | `accounts-payable-agent` | Accounts Payable (应付账款) | 💳 | autonomous | Invoice processing, payment scheduling, vendor management |
| 9 | `blockchain-security-auditor` | Blockchain Security Auditor (区块链安全审计) | 🔗 | autonomous | Smart contract auditing, DeFi security, vulnerability analysis |
| 10 | `compliance-auditor` | Compliance Auditor (合规审计) | 📜 | autonomous | Regulatory compliance, audit procedures, risk assessment |
| 11 | `cultural-intelligence-strategist` | Cultural Intelligence (文化智能策略) | 🌍 | autonomous | Cross-cultural strategy, localization, cultural adaptation |
| 12 | `developer-advocate` | Developer Advocate (开发者布道师) | 🗣️ | autonomous | Developer relations, community building, technical content |
| 13 | `model-qa-specialist` | Model QA Specialist (模型QA专家) | 🧪 | autonomous | ML model testing, bias detection, quality assurance |
| 14 | `zk-steward` | ZK Steward (零知识证明管家) | 🔏 | autonomous | Zero-knowledge proofs, privacy-preserving computation |
| 15 | `mcp-builder` | MCP Builder (MCP构建) | 🧰 | autonomous | Model Context Protocol servers, tool integration |
| 16 | `document-generator` | Document Generator (文档生成) | 📄 | autonomous | Automated document creation, template management |
| 17 | `automation-governance-architect` | Automation Governance (自动化治理架构师) | 🏛️ | autonomous | Automation policy, governance frameworks, compliance |
| 18 | `corporate-training-designer` | Corporate Training Designer (企业培训设计) | 🎓 | autonomous | Training program design, e-learning, skill assessment |
| 19 | `government-digital-presales-consultant` | Govt Digital Presales (政府数字化售前) | 🏛️ | autonomous | Government digital transformation, presales consulting |
| 20 | `healthcare-marketing-compliance` | Healthcare Marketing Compliance (医疗营销合规) | 🏥 | autonomous | HIPAA compliance, healthcare marketing regulations |
| 21 | `recruitment-specialist` | Recruitment Specialist (招聘专家) | 👔 | autonomous | Talent sourcing, candidate screening, hiring pipeline |
| 22 | `study-abroad-advisor` | Study Abroad Advisor (留学顾问) | 🎓 | autonomous | Study abroad counseling, university matching, application support |
| 23 | `supply-chain-strategist` | Supply Chain Strategist (供应链策略) | 🚚 | autonomous | Supply chain optimization, logistics, inventory management |
| 24 | `workflow-architect` | Workflow Architect (工作流架构师) | 🔧 | autonomous | Workflow design, process automation, system integration |

---

## 4. Field Mapping / 字段映射

This section defines how fields from the agency-agents GitHub format map to GRC's 8-file structure.

本节定义了 agency-agents GitHub 格式中的字段如何映射到 GRC 的八文件结构。

### 4.1 Mapping Table / 映射表

| GitHub Source Field | GRC Target File | Mapping Notes |
|---|---|---|
| **Role Title / Name** | `IDENTITY.md` → Role field | Direct mapping. Use as-is. |
| **Emoji** | `IDENTITY.md` → Emoji field | Direct mapping. |
| **Division** | `IDENTITY.md` → Department field | Map to consolidated GRC department (see Section 5). |
| **Core Mission** / persona statement | `IDENTITY.md` + `SOUL.md` | Split: one-line summary → IDENTITY; values/principles → SOUL. |
| **Core Strengths** / competencies | `SOUL.md` → Expertise section | List as expertise bullet points. |
| **How I Approach** / methodology | `AGENTS.md` → Collaboration & Proactive Behavior | Transform into GRC collaboration rules and proactive patterns. |
| **What I Deliver** / deliverables | `TASKS.md` + `HEARTBEAT.md` | Deliverable types inform HEARTBEAT priorities; TASKS.md uses shared template. |
| **Success Metrics** / KPIs | `HEARTBEAT.md` → Weekly/Monthly cadence | Include as KPI monitoring items in periodic review. |
| **Ask Me About** / expertise topics | `USER.md` → Interaction topics | Map to human supervisor interaction guidance. |
| **Tools / Capabilities** | `TOOLS.md` → Domain plugins | List as role-specific plugin commands. |
| *(no direct mapping)* | `TASKS.md` | **Use shared GRC TASKS pattern** — identical for all roles. |
| *(no direct mapping)* | `BOOTSTRAP.md` | **Use standard GRC bootstrap template** — minor role-specific customization. |

### 4.2 Transformation Rules / 转换规则

1. **Character limits are critical**: IDENTITY (100–200), SOUL (100–300), AGENTS (1500–2500), TOOLS (700–1100), HEARTBEAT (800–1300), USER (500–900), BOOTSTRAP (100–300). TASKS uses the shared template.

2. **Language**: All MD files MUST be in English. Chinese is used only in this planning document.

3. **Template variables**: Always use `${employee_name}`, `${company_name}`, `${employee_id}`, `${human_name}` — never hardcode names.

4. **Mode selection**: Default to `autonomous`. Use `copilot` only for roles that require human judgment for critical decisions (e.g., incident-response-commander, legal-compliance-checker in high-risk domains).

5. **Peer agent references**: Each role must specify 3–5 peer agents it collaborates with via `sessions_send`. Choose logically related roles from the same or adjacent departments.

6. **GRC API references**: All roles must reference the strategy API (`GET /a2a/strategy/summary?node_id={your_node_id}`) and task tools (`grc_task`, `grc_task_update`, etc.).

7. **Expense workflow**: All roles must include expense request capability in TOOLS.md and reference the expense workflow in AGENTS.md.

### 4.3 Content Generation Patterns / 内容生成模式

**IDENTITY.md pattern**:
```markdown
# IDENTITY
- **Name:** ${employee_name}
- **Role:** [Role Title]
- **Department:** [Department]
- **Employee ID:** ${employee_id}
- **Emoji:** [emoji]
- **Company:** ${company_name}
- **Mode:** autonomous
```

**SOUL.md pattern**:
```markdown
# SOUL — [Role Title]

## Core Principles
- [Derived from "Core Mission" — 3-5 values]

## Expertise
- [Derived from "Core Strengths" — 5-8 areas]

## Decision Framework
1. [3-5 decision steps relevant to role]

## Communication Style
- [3-4 communication preferences]
```

**BOOTSTRAP.md pattern**:
```markdown
# BOOTSTRAP

1. Fetch company strategy: GET /a2a/strategy/summary
2. Check pending tasks in GRC task queue
3. Load SOUL.md and AGENTS.md context
4. Introduce self to peer agents: [list 3-5 peer roles]
5. [One role-specific startup action]
```

---

## 5. Department Grouping Recommendations / 部门分组建议

The source repository uses 12 divisions. GRC should consolidate these into fewer, more manageable departments while preserving organizational clarity.

源仓库使用 12 个部门。GRC 应将其整合为更少、更易管理的部门，同时保持组织清晰度。

### 5.1 Recommended Consolidation / 推荐整合方案

| # | GRC Department | Source Divisions | Role Count | Rationale |
|---|---|---|---|---|
| 1 | **Engineering** | Engineering | 23 | Large enough to stand alone. Core technical roles. |
| 2 | **Design** | Design | 8 | Distinct creative discipline. Collaborates with Engineering and Marketing. |
| 3 | **Marketing** | Marketing + Paid Media | 33 | Paid Media is a subset of marketing function. Unified marketing org. |
| 4 | **Sales** | Sales | 8 | Revenue-generating roles with distinct process. |
| 5 | **Product & Operations** | Product + Project Management | 11 | Product and PM share planning/execution focus. Natural alignment. |
| 6 | **Quality Assurance** | Testing | 8 | Testing/QA is a distinct discipline with its own methodology. |
| 7 | **Operations & Support** | Support | 6 | Operational roles supporting the entire organization. |
| 8 | **Interactive & Immersive** | Spatial Computing + Game Development | 28 | Both deal with 3D/spatial/immersive experiences. Shared tech stack. |
| 9 | **Specialized** | Specialized (distributed) | ~24 | Assign each to the most relevant department, or keep as "Special Projects". |

### 5.2 Specialized Role Redistribution / 专业角色再分配

Some "Specialized" roles should be reassigned to functional departments:

| Role | Recommended Department | Reason |
|---|---|---|
| `recruitment-specialist` | HR (create new dept or add to Operations) | Core HR function |
| `accounts-payable-agent` | Finance | Core finance function |
| `compliance-auditor` | Legal / Operations | Compliance function |
| `developer-advocate` | Engineering or Marketing | DevRel bridges both |
| `blockchain-security-auditor` | Engineering | Security specialization |
| `supply-chain-strategist` | Operations & Support | Supply chain management |
| `healthcare-marketing-compliance` | Marketing (specialized) | Industry-specific marketing |
| `government-digital-presales-consultant` | Sales (specialized) | Government sales vertical |
| `corporate-training-designer` | HR / Operations | Training function |
| `study-abroad-advisor` | Special Projects | Niche industry role |
| `agents-orchestrator` | Engineering | Agent infrastructure |
| `mcp-builder` | Engineering | Tool/protocol development |
| `workflow-architect` | Product & Operations | Process design |
| Remaining | Special Projects | Keep as dedicated pool |

---

## 6. Conversion Strategy / 转换策略

### 6.1 Phased Rollout / 分阶段推出

| Phase | Focus | Role Count | Timeline | Priority |
|---|---|---|---|---|
| **Phase 1** | Core Business Roles | ~40 | Week 1–2 | **Critical** — Engineering leads, Sales core, Marketing leads, Product |
| **Phase 2** | Extended Business | ~35 | Week 3–4 | **High** — Full Product/PM, Support, Design, remaining Sales |
| **Phase 3** | Technical Specialties | ~30 | Week 5–6 | **Medium** — QA/Testing, specialized Engineering, Data roles |
| **Phase 4** | Niche Domains | ~45 | Week 7–9 | **Standard** — Game Dev, Spatial Computing, China-specific Marketing |
| **Phase 5** | Specialized One-offs | ~13 | Week 10 | **Low** — Remaining specialized and industry-specific roles |

### 6.2 Phase 1 Detail — Core Business Roles (~40 roles)

**Engineering (10)**:
`backend-architect`, `frontend-developer`, `ai-engineer`, `devops-automator`, `senior-developer`, `security-engineer`, `software-architect`, `sre`, `data-engineer`, `code-reviewer`

**Sales (5)**:
`outbound-strategist`, `deal-strategist`, `sales-engineer`, `pipeline-analyst`, `account-strategist`

**Marketing (12)**:
`growth-hacker`, `content-creator`, `seo-specialist`, `social-media-strategist`, `linkedin-content-creator`, `ppc-campaign-strategist`, `ad-creative-strategist`, `paid-social-strategist`, `tracking-measurement-specialist`, `twitter-engager`, `instagram-curator`, `app-store-optimizer`

**Product & Operations (8)**:
`product-manager`, `sprint-prioritizer`, `trend-researcher`, `feedback-synthesizer`, `senior-project-manager`, `project-shepherd`, `experiment-tracker`, `studio-producer`

**Design (3)**:
`ui-designer`, `ux-researcher`, `ux-architect`

**Support (2)**:
`support-responder`, `analytics-reporter`

### 6.3 Phase 2 Detail — Extended Business (~35 roles)

**Marketing continued (14)**:
`tiktok-strategist`, `reddit-community-builder`, `podcast-strategist`, `search-query-analyst`, `paid-media-auditor`, `programmatic-display-buyer`, `carousel-growth-engine`, `book-co-author`, `xiaohongshu-specialist`, `wechat-official-account-manager`, `zhihu-strategist`, `baidu-seo-specialist`, `bilibili-content-strategist`, `weibo-strategist`

**Sales continued (3)**:
`discovery-coach`, `proposal-strategist`, `sales-coach`

**Design continued (5)**:
`brand-guardian`, `visual-storyteller`, `whimsy-injector`, `image-prompt-engineer`, `inclusive-visuals-specialist`

**Product & Operations continued (5)**:
`behavioral-nudge-engine`, `studio-operations`, `jira-workflow-steward`, `workflow-architect`, `automation-governance-architect`

**Support continued (4)**:
`finance-tracker`, `infrastructure-maintainer`, `legal-compliance-checker`, `executive-summary-generator`

**Specialized (4)**:
`recruitment-specialist`, `accounts-payable-agent`, `compliance-auditor`, `developer-advocate`

### 6.4 Phase 3 Detail — Technical Specialties (~30 roles)

**Engineering (13)**:
`mobile-app-builder`, `rapid-prototyper`, `autonomous-optimization-architect`, `embedded-firmware-engineer`, `incident-response-commander`, `solidity-smart-contract-engineer`, `technical-writer`, `threat-detection-engineer`, `wechat-mini-program-developer`, `database-optimizer`, `git-workflow-master`, `ai-data-remediation-engineer`, `feishu-integration-developer`

**Testing/QA (8)**:
`evidence-collector`, `reality-checker`, `test-results-analyzer`, `performance-benchmarker`, `api-tester`, `tool-evaluator`, `workflow-optimizer`, `accessibility-auditor`

**Specialized (9)**:
`agents-orchestrator`, `lsp-index-engineer`, `mcp-builder`, `model-qa-specialist`, `agentic-identity-trust-architect`, `identity-graph-operator`, `blockchain-security-auditor`, `zk-steward`, `document-generator`

### 6.5 Phase 4 Detail — Niche Domains (~45 roles)

**Game Development (22)**: All 22 game development roles.

**Spatial Computing (6)**: All 6 spatial computing roles.

**China-specific Marketing (7)**:
`douyin-strategist`, `kuaishou-strategist`, `china-ecommerce-operator`, `cross-border-ecommerce-specialist`, `livestream-commerce-coach`, `private-domain-operator`, `short-video-editing-coach`

**Specialized (10)**:
`sales-data-extraction-agent`, `data-consolidation-agent`, `report-distribution-agent`, `cultural-intelligence-strategist`, `corporate-training-designer`, `government-digital-presales-consultant`, `healthcare-marketing-compliance`, `study-abroad-advisor`, `supply-chain-strategist`, `workflow-architect`

### 6.6 Conversion Automation / 转换自动化

GRC already has the `buildRoleGenerationPrompt()` function in `src/shared/llm/prompts.ts` that generates role templates via LLM. The conversion process can leverage this:

1. **Extract** role data from agency-agents Markdown files (parse "Core Mission," "Core Strengths," etc.)
2. **Format** as `roleDescription` input for `buildRoleGenerationPrompt()`
3. **Call** the LLM API to generate the 8-file JSON output
4. **Validate** output against character limits and required sections
5. **Review** critical roles (Phase 1) manually; batch-process Phase 3–5 roles
6. **Insert** into GRC database as role templates

Alternatively, for higher quality, manually craft Phase 1 roles using the existing 9 built-in roles as reference patterns, then use LLM-assisted generation for Phases 2–5.

---

## 7. Output File Plan / 输出文件计划

### 7.1 Planned Output Documents / 计划输出文档

| File | Content | Roles | Status |
|---|---|---|---|
| `Role_Templates_Part1_Engineering_Design_Testing_Support.md` | Full 8-file templates for Engineering, Design, Testing, and Support roles | 45 roles | Planned |
| `Role_Templates_Part2_Marketing_Sales_Product_PM.md` | Full 8-file templates for Marketing, Sales, Product, and Project Management roles | 52 roles | Planned |
| `Role_Templates_Part3_GameDev_Spatial_Specialized.md` | Full 8-file templates for Game Dev, Spatial Computing, and Specialized roles | 52 roles | Planned |
| `Role_Conversion_Skill_Analysis.md` | Skill and capability analysis across all roles | All | Completed |
| `Role_Conversion_Research_Report.md` | This document — planning and analysis | All | **This document** |

### 7.2 File Size Estimates / 文件大小估算

Each role requires approximately 4 KB of MD content across all 8 files. With role header, separators, and formatting:

- Part 1 (45 roles): ~200 KB
- Part 2 (52 roles): ~230 KB
- Part 3 (52 roles): ~230 KB
- Total: ~660 KB

### 7.3 Quality Assurance Checklist / 质量保证清单

For each converted role, verify:

- [ ] All 8 MD files present and non-empty
- [ ] Character limits respected (IDENTITY 100–200, SOUL 100–300, AGENTS 1500–2500, TOOLS 700–1100, HEARTBEAT 800–1300, USER 500–900, BOOTSTRAP 100–300)
- [ ] Template variables used (no hardcoded names)
- [ ] TASKS.md uses shared pattern verbatim
- [ ] TOOLS.md includes all GRC standard tools + role-specific plugins
- [ ] AGENTS.md includes both Autonomous and Copilot mode sections
- [ ] HEARTBEAT.md includes standard priority order + role-specific cadence
- [ ] BOOTSTRAP.md includes strategy fetch and peer introduction
- [ ] Peer agents listed are valid role IDs from the catalog
- [ ] Department assignment matches consolidation plan
- [ ] Mode (autonomous/copilot) is appropriate for the role
- [ ] English language throughout (no Chinese in MD files)

---

## Appendix A: GRC Built-in Role Reference / 附录A：GRC 内置角色参考

The 9 existing GRC built-in roles serve as the quality standard for all conversions:

| # | Role ID | Name | Department | Mode |
|---|---|---|---|---|
| 0 | `ceo` | Chief Executive Officer | Executive Office | copilot |
| 1 | `strategic-planner` | Strategic Planner | Strategy | autonomous |
| 2 | `marketing` | Marketing Manager | Marketing | autonomous |
| 3 | `sales` | Sales Manager | Sales | autonomous |
| 4 | `product-manager` | Product Manager | Product | autonomous |
| 5 | `finance` | Finance Manager | Finance | autonomous |
| 6 | `engineering-lead` | Engineering Lead | Engineering | autonomous |
| 7 | `hr` | HR Manager | Human Resources | autonomous |
| 8 | `support` | Support Manager | Customer Support | autonomous |

These templates are defined in `GRC_Role_Templates_All_8_Roles.md` and demonstrate the expected quality, depth, and formatting for all 8 files.

---

## Appendix B: GRC Prompt System Reference / 附录B：GRC 提示系统参考

The role generation prompt is defined in `src/shared/llm/prompts.ts` → `buildRoleGenerationPrompt()`. Key constraints enforced by this prompt:

- Output must be valid JSON with exactly 8 string fields (`agentsMd`, `tasksMd`, `toolsMd`, `heartbeatMd`, `userMd`, `soulMd`, `identityMd`, `bootstrapMd`)
- Also includes metadata fields: `id`, `name`, `emoji`, `department`, `industry`, `mode`
- Style rules: English, concise, markdown headers, specific API references, concrete tool names
- Mode-specific behavior descriptions required

This prompt can be used directly for automated batch conversion of agency-agents roles into GRC format.

---

*End of document / 文档结束*
