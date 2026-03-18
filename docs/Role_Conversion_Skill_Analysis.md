# Role Conversion Skill Analysis / 角色转换技能分析

> **Source**: [agency-agents](https://github.com/msitarzewski/agency-agents) — 163 AI agent role definitions across 12 departments
> **Target**: GRC role template system (8 MD files per role: AGENTS, TASKS, TOOLS, HEARTBEAT, USER, SOUL, IDENTITY, BOOTSTRAP)
> **Goal**: Extract common skills that can be shared as WinClaw plugins across multiple roles
> **Date**: 2026-03-15

---

## 1. Executive Summary / 执行摘要

This document presents a systematic analysis of 163 AI agent role definitions from the agency-agents repository, organized across 12 departments. The objective is to identify **extractable, reusable skills** that can be packaged as WinClaw plugins and shared across multiple GRC role templates.

本文档对 agency-agents 仓库中 12 个部门的 163 个 AI 代理角色定义进行了系统分析。目标是识别**可提取、可复用的技能**，将其打包为 WinClaw 插件，在多个 GRC 角色模板间共享使用。

### Methodology / 方法论

1. **Role Inventory** — Cataloged all 163 agent roles by department, responsibilities, and required capabilities.
2. **Capability Extraction** — Identified discrete, tool-like capabilities referenced across role definitions.
3. **Cross-Role Frequency Analysis** — Counted how many roles reference each capability to determine priority tiers.
4. **Skill Consolidation** — Grouped related capabilities into 28 distinct skills (S01–S28).
5. **Priority Tiering** — Ranked skills into P0/P1/P2/P3 based on cross-role coverage.

1. **角色清单** — 按部门、职责和所需能力对所有 163 个代理角色进行编目。
2. **能力提取** — 识别跨角色定义引用的离散、工具化能力。
3. **跨角色频率分析** — 统计每项能力被引用的角色数量以确定优先级。
4. **技能整合** — 将相关能力归纳为 28 个独立技能 (S01–S28)。
5. **优先级分层** — 根据跨角色覆盖率将技能分为 P0/P1/P2/P3 四级。

### Key Findings / 主要发现

| Tier | Skills | Roles Served (each) | Coverage |
|------|--------|---------------------|----------|
| P0 — Critical | 4 skills (S01–S04) | 40+ roles | ~80% of all roles |
| P1 — High | 7 skills (S05–S11) | 12–25 roles | ~50% of all roles |
| P2 — Medium | 7 skills (S12–S18) | 8–20 roles | ~30% of all roles |
| P3 — Specialized | 10 skills (S19–S28) | 3–8 roles | Domain-specific |

**Total**: 28 extractable skills covering 163 roles across 12 departments.

---

## 2. GRC Built-in Tools (Available to ALL Roles) / GRC 内置工具（所有角色可用）

Every GRC role template automatically has access to the following built-in tools. These do **not** need to be packaged as plugins — they are part of the GRC core platform.

每个 GRC 角色模板自动拥有以下内置工具的访问权限。这些工具**无需**打包为插件——它们是 GRC 核心平台的一部分。

| Tool / 工具 | Description / 描述 | Usage / 用途 |
|---|---|---|
| `grc_task` | Create tasks / 创建任务 | Delegate work to other agents or request deliverables. 向其他代理委派工作或请求交付物。 |
| `grc_task_update` | Update task status/progress / 更新任务状态与进度 | Report progress percentage, add notes, change status. 报告进度百分比，添加备注，变更状态。 |
| `grc_task_complete` | Mark task complete with deliverables / 完成任务并附交付物 | Submit final output with attachments or structured data. 提交最终输出及附件或结构化数据。 |
| `grc_task_accept` | Accept tasks assigned by others / 接受他人分配的任务 | Acknowledge and commit to assigned work. 确认并承诺执行分配的工作。 |
| `grc_task_reject` | Reject tasks with reason / 拒绝任务并说明原因 | Decline tasks outside scope or capacity with justification. 拒绝超出范围或能力的任务并说明理由。 |
| `sessions_send` | A2A agent-to-agent communication / A2A 代理间通信 | Direct messaging between agents for coordination. 代理间直接消息传递以协调工作。 |
| `web_fetch` | Fetch web content / 获取网页内容 | Retrieve URLs, APIs, RSS feeds for information gathering. 检索 URL、API、RSS 源以收集信息。 |
| Expense requests | Via task system (category="expense") / 通过任务系统 | Submit expense requests routed through approval workflow. 提交经费申请并通过审批流程。 |

### Design Principle / 设计原则

Skills (plugins) **extend** the built-in tools — they do not replace them. A `skill-data-analysis` plugin, for example, uses `web_fetch` internally to pull data sources, and `grc_task_complete` to deliver analysis results.

技能（插件）**扩展**内置工具——而非替代。例如 `skill-data-analysis` 插件内部使用 `web_fetch` 拉取数据源，使用 `grc_task_complete` 交付分析结果。

---

## 3. Extractable Common Skills / 可提取的共通技能

### P0 — Critical (Serve 40+ Roles Each) / 核心技能

These four skills are foundational and appear across the vast majority of roles. Implementing them first maximizes cross-role value.

这四项技能是基础性的，出现在绝大多数角色中。优先实现它们可最大化跨角色价值。

---

#### S01: Data Analysis & Reporting / 数据分析与报告

**Plugin**: `skill-data-analysis`
**Estimated Role Coverage**: 55+ roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| SQL Query Execution | Run SELECT queries against configured data sources; parameterized queries only. 对配置的数据源执行 SELECT 查询；仅限参数化查询。 |
| Statistical Analysis | Descriptive stats, correlation, regression, hypothesis testing. 描述性统计、相关性、回归、假设检验。 |
| Dashboard Generation | Create structured JSON dashboard definitions (charts, KPIs, tables). 创建结构化 JSON 仪表板定义（图表、KPI、表格）。 |
| Anomaly Detection | Z-score, IQR, moving average deviation alerts. Z 分数、四分位距、移动平均偏差警报。 |
| Data Transformation | ETL-style pipelines: filter, aggregate, pivot, join. ETL 风格管道：过滤、聚合、透视、连接。 |

**Slash Commands / 斜杠命令**:
- `/analyze-data` — Run analysis on a dataset with specified metrics
- `/generate-dashboard` — Create a dashboard definition from data
- `/detect-anomalies` — Scan data for outliers and anomalies
- `/query-data` — Execute a parameterized query

**Used By Departments / 使用部门**:
Engineering (all), Product (all), Marketing Analytics, Finance (all), Support Analytics, Sales Pipeline, DevOps/SRE

---

#### S02: Content Generation & Writing / 内容生成与写作

**Plugin**: `skill-content-generation`
**Estimated Role Coverage**: 50+ roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Multi-Format Content | Blog posts, social posts, email copy, ad copy, scripts, whitepapers. 博客、社交帖子、邮件文案、广告文案、脚本、白皮书。 |
| Copywriting | Persuasive writing, headlines, CTAs, value propositions. 说服性写作、标题、CTA、价值主张。 |
| Brand Voice Compliance | Style guide enforcement, tone checking, terminology consistency. 风格指南执行、语气检查、术语一致性。 |
| Localization Support | Multi-language adaptation with cultural context awareness. 多语言适配及文化语境感知。 |
| Content Repurposing | Transform long-form into social snippets, summaries, threads. 将长篇内容转化为社交片段、摘要、帖子串。 |

**Slash Commands / 斜杠命令**:
- `/generate-content` — Create content in specified format and tone
- `/check-brand-voice` — Validate content against brand guidelines
- `/repurpose-content` — Transform content across formats
- `/localize-content` — Adapt content for target locale

**Used By Departments / 使用部门**:
Marketing (all), Design (content-related), Product (docs, release notes), Support (KB articles), Sales (proposals, outreach), HR (job descriptions, policies)

---

#### S03: Web Research & Intelligence / 网络调研与情报

**Plugin**: `skill-web-research`
**Estimated Role Coverage**: 45+ roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Competitive Analysis | Track competitor products, pricing, features, positioning. 跟踪竞争对手产品、定价、功能、定位。 |
| Market Research | Industry trends, TAM/SAM/SOM, market sizing. 行业趋势、TAM/SAM/SOM、市场规模评估。 |
| Trend Monitoring | Real-time tracking of news, social mentions, technology shifts. 实时跟踪新闻、社交提及、技术变化。 |
| Source Verification | Cross-reference claims, fact-checking, citation generation. 交叉验证声明、事实核查、引文生成。 |
| OSINT Collection | Structured open-source intelligence gathering and synthesis. 结构化开源情报收集与综合。 |

**Slash Commands / 斜杠命令**:
- `/research-topic` — Deep research on a specified topic
- `/competitive-analysis` — Analyze competitors in a market segment
- `/monitor-trends` — Set up trend monitoring for keywords/topics
- `/verify-sources` — Fact-check and verify claims with citations

**Used By Departments / 使用部门**:
Marketing (all strategy/content), Sales (all), Product (all), Engineering (technology evaluation), Support (solutions research), Finance (market intelligence)

---

#### S04: Document Generation / 文档生成

**Plugin**: `skill-document-generation`
**Estimated Role Coverage**: 42+ roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| PDF Generation | Reports, invoices, certificates, compliance documents. 报告、发票、证书、合规文档。 |
| DOCX Creation | Proposals, contracts, SOWs, policy documents. 提案、合同、SOW、政策文档。 |
| XLSX/CSV Export | Data tables, financial models, inventory lists. 数据表、财务模型、库存清单。 |
| PPTX Slides | Pitch decks, status reports, training materials. 演示文稿、状态报告、培训材料。 |
| Template Engine | Merge data into predefined templates with variable substitution. 将数据合并到预定义模板中并进行变量替换。 |

**Slash Commands / 斜杠命令**:
- `/generate-pdf` — Create a PDF document from structured data
- `/generate-report` — Create a formatted report (auto-detect best format)
- `/export-data` — Export data to XLSX/CSV
- `/create-slides` — Generate presentation slides

**Used By Departments / 使用部门**:
Finance (all reports), Sales (proposals, contracts), Marketing (materials, decks), HR (offer letters, policies), Legal (compliance docs), Product (PRDs, specs), Engineering (architecture docs)

---

### P1 — High Priority (Serve 12–25 Roles Each) / 高优先技能

---

#### S05: Code Analysis & Review / 代码分析与审查

**Plugin**: `skill-code-analysis`
**Estimated Role Coverage**: 25 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Static Analysis | Lint, complexity metrics (cyclomatic, cognitive), code smells. Lint、复杂度指标（圈复杂度、认知复杂度）、代码异味。 |
| Security Scanning | SAST patterns, dependency vulnerability checks, secret detection. SAST 模式、依赖漏洞检查、密钥检测。 |
| Best Practice Checks | Language-specific idioms, design pattern adherence, naming conventions. 语言特定习惯用法、设计模式遵守、命名规范。 |
| Code Review Automation | PR diff analysis, review comment generation, approval recommendations. PR 差异分析、审查评论生成、批准建议。 |
| Refactoring Suggestions | Dead code detection, DRY violations, abstraction opportunities. 死代码检测、DRY 违反、抽象机会。 |

**Slash Commands / 斜杠命令**:
- `/analyze-code` — Run static analysis on a codebase or file
- `/review-pr` — Generate code review for a pull request
- `/scan-security` — Run security-focused code scan
- `/suggest-refactor` — Identify refactoring opportunities

**Used By Departments / 使用部门**:
Engineering (all roles), Testing (all), DevOps, Security

---

#### S06: SEO & Search Optimization / SEO 搜索优化

**Plugin**: `skill-seo`
**Estimated Role Coverage**: 18 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Technical SEO Audit | Crawlability, indexation, structured data, Core Web Vitals. 可抓取性、索引、结构化数据、核心 Web 指标。 |
| Keyword Research | Search volume, difficulty, intent classification, gap analysis. 搜索量、难度、意图分类、差距分析。 |
| Content Optimization | Title tags, meta descriptions, heading hierarchy, internal linking. 标题标签、元描述、标题层级、内部链接。 |
| SERP Analysis | Featured snippets, PAA, competitor ranking tracking. 精选摘要、PAA、竞争对手排名跟踪。 |
| Baidu/Local SEO | China-specific optimization, local search, map listings. 中国特定优化、本地搜索、地图列表。 |

**Slash Commands / 斜杠命令**:
- `/seo-audit` — Run technical SEO audit on a URL
- `/keyword-research` — Research keywords for a topic/niche
- `/optimize-content` — SEO-optimize a piece of content
- `/track-rankings` — Monitor search rankings for keywords

**Used By Departments / 使用部门**:
Marketing (SEO specialist, content creator, growth hacker, Baidu SEO, all content roles), Product (landing pages)

---

#### S07: Project & Task Management / 项目任务管理

**Plugin**: `skill-project-management`
**Estimated Role Coverage**: 20 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| RICE Scoring | Reach, Impact, Confidence, Effort prioritization framework. 到达率、影响、信心、努力优先级框架。 |
| Sprint Planning | Story point estimation, velocity tracking, sprint capacity. 故事点估算、速率跟踪、冲刺容量。 |
| Capacity Planning | Resource allocation, utilization rates, bottleneck identification. 资源分配、利用率、瓶颈识别。 |
| Dependency Tracking | Critical path analysis, blocker detection, gantt visualization. 关键路径分析、阻碍检测、甘特图可视化。 |
| Retrospective Analysis | Sprint metrics, improvement tracking, team health indicators. 冲刺指标、改进跟踪、团队健康指标。 |

**Slash Commands / 斜杠命令**:
- `/plan-sprint` — Generate sprint plan from backlog
- `/rice-score` — Calculate RICE score for features
- `/capacity-plan` — Analyze team capacity and allocation
- `/track-dependencies` — Map and monitor task dependencies

**Used By Departments / 使用部门**:
Product (PM, product manager), Engineering (lead, architect), Design (studio producer), Marketing (campaign manager)

---

#### S08: Financial Analysis & Modeling / 财务分析与建模

**Plugin**: `skill-financial-analysis`
**Estimated Role Coverage**: 15 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| NPV/IRR Calculations | Net present value, internal rate of return, payback period. 净现值、内部收益率、投资回收期。 |
| Budget Variance Analysis | Actual vs. planned, trend analysis, forecast adjustments. 实际与计划对比、趋势分析、预测调整。 |
| Financial Forecasting | Revenue projections, cost modeling, scenario analysis. 收入预测、成本建模、情景分析。 |
| P&L Analysis | Profit and loss breakdown, margin analysis, cost allocation. 损益分解、利润率分析、成本分配。 |
| Unit Economics | CAC, LTV, churn rate, cohort analysis. CAC、LTV、流失率、群组分析。 |

**Slash Commands / 斜杠命令**:
- `/financial-model` — Build or update a financial model
- `/budget-analysis` — Analyze budget variance
- `/forecast-revenue` — Generate revenue forecast
- `/unit-economics` — Calculate unit economics metrics

**Used By Departments / 使用部门**:
Finance (all), Sales (pipeline, account strategist), Support (finance tracker), Product (business case analysis)

---

#### S09: Security Auditing & Compliance / 安全审计与合规

**Plugin**: `skill-security-audit`
**Estimated Role Coverage**: 14 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| STRIDE Threat Modeling | Systematic threat identification across 6 categories. 跨 6 个类别的系统性威胁识别。 |
| OWASP Assessment | Top 10 vulnerability checking, remediation guidance. Top 10 漏洞检查、修复指导。 |
| Compliance Frameworks | SOC2, ISO 27001, HIPAA, PCI-DSS audit checklists. SOC2、ISO 27001、HIPAA、PCI-DSS 审计清单。 |
| Vulnerability Scanning | CVE database lookup, dependency audit, patch prioritization. CVE 数据库查找、依赖审计、补丁优先级。 |
| Security Policy Review | Policy gap analysis, access control review, incident response evaluation. 政策差距分析、访问控制审查、事件响应评估。 |

**Slash Commands / 斜杠命令**:
- `/threat-model` — Generate STRIDE threat model
- `/security-scan` — Run security vulnerability scan
- `/compliance-check` — Audit against compliance framework
- `/assess-owasp` — OWASP Top 10 assessment

**Used By Departments / 使用部门**:
Engineering (security engineer, threat detection), Blockchain (security auditor), Legal (compliance auditor), DevOps (infrastructure security)

---

#### S10: Performance Testing & Monitoring / 性能测试与监控

**Plugin**: `skill-performance-testing`
**Estimated Role Coverage**: 13 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Load Testing | Concurrent user simulation, throughput measurement, stress testing. 并发用户模拟、吞吐量测量、压力测试。 |
| Core Web Vitals | LCP, FID, CLS measurement and optimization recommendations. LCP、FID、CLS 测量及优化建议。 |
| APM Integration | Application performance monitoring, trace analysis, bottleneck identification. 应用性能监控、链路分析、瓶颈识别。 |
| Benchmarking | Before/after comparison, baseline establishment, regression detection. 前后对比、基线建立、回归检测。 |
| SLA Monitoring | Uptime tracking, latency percentiles, error rate alerting. 运行时间跟踪、延迟百分位、错误率告警。 |

**Slash Commands / 斜杠命令**:
- `/load-test` — Configure and analyze load test results
- `/web-vitals` — Measure Core Web Vitals for a URL
- `/benchmark` — Run performance benchmark comparison
- `/sla-report` — Generate SLA compliance report

**Used By Departments / 使用部门**:
Engineering (SRE, performance benchmarker, backend architect), DevOps (all), Testing (performance tester)

---

#### S11: User Research & Feedback / 用户研究与反馈

**Plugin**: `skill-user-research`
**Estimated Role Coverage**: 12 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Survey Design & Analysis | Question design, response analysis, statistical significance. 问卷设计、回复分析、统计显著性。 |
| Persona Creation | Data-driven persona development, behavioral segmentation. 数据驱动的用户画像开发、行为分层。 |
| Usability Testing | Task completion analysis, heuristic evaluation, think-aloud synthesis. 任务完成分析、启发式评估、出声思维法综合。 |
| Sentiment Analysis | NPS, CSAT, review mining, social listening synthesis. NPS、CSAT、评论挖掘、社交聆听综合。 |
| Journey Mapping | Touchpoint analysis, pain point identification, opportunity mapping. 触点分析、痛点识别、机会映射。 |

**Slash Commands / 斜杠命令**:
- `/design-survey` — Create a research survey
- `/build-persona` — Generate user persona from data
- `/analyze-sentiment` — Run sentiment analysis on feedback
- `/map-journey` — Create user journey map

**Used By Departments / 使用部门**:
Product (UX researcher, product manager), Design (UX architect), Support (feedback synthesizer, voice of customer), Marketing (market research)

---

### P2 — Medium Priority (Serve 8–20 Roles Each) / 中优先技能

---

#### S12: API Testing & Integration / API 测试与集成

**Plugin**: `skill-api-testing`
**Estimated Role Coverage**: 12 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| REST/GraphQL Testing | Endpoint validation, response schema checking, status code verification. 端点验证、响应模式检查、状态码验证。 |
| Contract Testing | Provider/consumer contract validation, breaking change detection. 提供者/消费者契约验证、破坏性变更检测。 |
| API Mocking | Mock server generation, fixture management, test isolation. 模拟服务器生成、测试数据管理、测试隔离。 |
| Performance Profiling | Latency measurement, rate limit testing, payload optimization. 延迟测量、速率限制测试、负载优化。 |
| Documentation Generation | OpenAPI/Swagger spec generation, example request/response creation. OpenAPI/Swagger 规范生成、示例请求/响应创建。 |

**Slash Commands**: `/test-api`, `/mock-api`, `/validate-contract`, `/generate-api-docs`

**Used By**: Engineering (API tester, backend developer, sales engineer, integration specialist)

---

#### S13: CI/CD Pipeline Management / CI/CD 管道管理

**Plugin**: `skill-cicd`
**Estimated Role Coverage**: 10 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Build Automation | Build configuration, artifact management, caching strategies. 构建配置、制品管理、缓存策略。 |
| Deployment Orchestration | Blue/green, canary, rolling deployments. 蓝绿部署、金丝雀部署、滚动部署。 |
| Rollback Management | Automated rollback triggers, health check integration. 自动回滚触发、健康检查集成。 |
| Pipeline Optimization | Parallel stages, dependency caching, build time reduction. 并行阶段、依赖缓存、构建时间缩短。 |
| Environment Management | Staging/production parity, feature flag integration. 预发/生产一致性、特性开关集成。 |

**Slash Commands**: `/configure-pipeline`, `/deploy`, `/rollback`, `/optimize-build`

**Used By**: DevOps (all), Engineering (lead, SRE), Testing (CI integration)

---

#### S14: Social Media Management / 社交媒体管理

**Plugin**: `skill-social-media`
**Estimated Role Coverage**: 15 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Multi-Platform Posting | Twitter/X, LinkedIn, Instagram, TikTok, Douyin, Bilibili, WeChat, Xiaohongshu. 多平台发布。 |
| Content Scheduling | Calendar management, optimal timing, timezone handling. 日历管理、最佳时间、时区处理。 |
| Engagement Tracking | Likes, shares, comments, click-through rates, follower growth. 点赞、分享、评论、点击率、粉丝增长。 |
| Hashtag Strategy | Trend analysis, hashtag research, branded hashtag tracking. 趋势分析、标签研究、品牌标签跟踪。 |
| Community Management | Comment moderation, DM templates, crisis response playbooks. 评论审核、私信模板、危机应对手册。 |

**Slash Commands**: `/schedule-post`, `/track-engagement`, `/analyze-hashtags`, `/moderate-comments`

**Used By**: Marketing (all social media roles — Twitter, TikTok, Instagram, LinkedIn, Douyin, Bilibili, Xiaohongshu, WeChat)

---

#### S15: Sales Pipeline & CRM / 销售管道与 CRM

**Plugin**: `skill-sales-pipeline`
**Estimated Role Coverage**: 12 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Lead Scoring | Multi-signal scoring, intent data integration, MQL/SQL classification. 多信号评分、意图数据集成、MQL/SQL 分类。 |
| Deal Tracking | Stage progression, win probability, close date forecasting. 阶段推进、赢单概率、预计关闭日期。 |
| Pipeline Forecasting | Weighted pipeline, commit vs. upside, quarterly projections. 加权管道、确定 vs. 上行、季度预测。 |
| Account Planning | Strategic account mapping, stakeholder analysis, expansion plays. 战略客户映射、利益相关者分析、扩展策略。 |
| Activity Tracking | Call logs, email tracking, meeting notes, next-step automation. 通话记录、邮件跟踪、会议记录、下一步自动化。 |

**Slash Commands**: `/score-lead`, `/forecast-pipeline`, `/plan-account`, `/track-deal`

**Used By**: Sales (all roles — SDR, AE, account strategist, sales engineer, presales)

---

#### S16: Design System & UI Components / 设计系统与 UI 组件

**Plugin**: `skill-design-system`
**Estimated Role Coverage**: 10 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Component Library | Component inventory, usage tracking, deprecation management. 组件库存、使用跟踪、弃用管理。 |
| Design Tokens | Color, typography, spacing, elevation token management. 颜色、排版、间距、层级令牌管理。 |
| Accessibility Checks | WCAG contrast ratios, focus management, ARIA validation. WCAG 对比度、焦点管理、ARIA 验证。 |
| Responsive Audit | Breakpoint testing, fluid layout verification, touch target sizing. 断点测试、流式布局验证、触摸目标尺寸。 |
| Pattern Documentation | Usage guidelines, do/don't examples, code snippets. 使用指南、示例、代码片段。 |

**Slash Commands**: `/audit-components`, `/check-tokens`, `/test-responsive`, `/document-pattern`

**Used By**: Design (UI designer, UX architect, brand guardian), Engineering (frontend), Product (design system)

---

#### S17: Legal & Compliance Checking / 法律合规检查

**Plugin**: `skill-legal-compliance`
**Estimated Role Coverage**: 10 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| GDPR Assessment | Data processing audit, consent management, DPIA support. 数据处理审计、同意管理、DPIA 支持。 |
| Privacy Policy Review | Policy completeness, regulatory alignment, gap identification. 政策完整性、法规一致性、差距识别。 |
| Contract Review | Clause extraction, risk flagging, term comparison. 条款提取、风险标记、条款对比。 |
| Regulatory Monitoring | Regulation change tracking, impact assessment, deadline management. 法规变更跟踪、影响评估、截止日期管理。 |
| Compliance Reporting | Audit trail generation, evidence collection, status dashboards. 审计轨迹生成、证据收集、状态仪表板。 |

**Slash Commands**: `/gdpr-check`, `/review-contract`, `/compliance-report`, `/monitor-regulations`

**Used By**: Legal (compliance checker), Healthcare (HIPAA compliance), Government (presales), Finance (regulatory), HR (employment law)

---

#### S18: Email & Campaign Automation / 邮件与营销自动化

**Plugin**: `skill-email-automation`
**Estimated Role Coverage**: 8 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Drip Campaigns | Sequence design, trigger configuration, branch logic. 序列设计、触发配置、分支逻辑。 |
| A/B Testing | Subject line, content, send time testing and analysis. 主题行、内容、发送时间测试与分析。 |
| List Management | Segmentation, hygiene, suppression, opt-in/out compliance. 分层、清洗、抑制、订阅合规。 |
| Deliverability | SPF/DKIM/DMARC checking, bounce management, sender reputation. SPF/DKIM/DMARC 检查、退信管理、发送者声誉。 |
| Analytics | Open rate, CTR, conversion tracking, revenue attribution. 打开率、点击率、转化跟踪、收入归因。 |

**Slash Commands**: `/create-campaign`, `/ab-test`, `/check-deliverability`, `/campaign-analytics`

**Used By**: Marketing (growth hacker, outbound strategist, private domain operator, email marketing), Sales (outbound SDR)

---

### P3 — Specialized (Serve 3–8 Roles Each) / 专业技能

---

#### S19: Video & Multimedia Production / 视频多媒体制作

**Plugin**: `skill-video-production`
**Estimated Role Coverage**: 8 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Video Editing Guidance | Cut lists, transition recommendations, pacing analysis. 剪辑列表、转场建议、节奏分析。 |
| Thumbnail Creation | Template-based thumbnail design, A/B testing recommendations. 基于模板的缩略图设计、A/B 测试建议。 |
| Livestream Setup | OBS/streaming configuration, overlay design, chat moderation. OBS/流媒体配置、叠加层设计、聊天审核。 |
| Script Writing | Video scripts, teleprompter formatting, timing estimation. 视频脚本、提词器格式化、时间估算。 |
| Platform Optimization | Format/resolution/aspect ratio per platform (TikTok 9:16, YouTube 16:9). 按平台优化格式/分辨率/宽高比。 |

**Slash Commands**: `/video-script`, `/thumbnail-design`, `/livestream-config`, `/optimize-format`

**Used By**: Marketing (TikTok, Douyin, Bilibili, short-video coach, livestream commerce), Content (video roles)

---

#### S20: Cloud Infrastructure Management / 云基础设施管理

**Plugin**: `skill-cloud-infra`
**Estimated Role Coverage**: 7 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Multi-Cloud Management | AWS, GCP, Azure resource provisioning and management. AWS、GCP、Azure 资源配置与管理。 |
| Kubernetes Operations | Cluster management, pod scheduling, service mesh configuration. 集群管理、Pod 调度、服务网格配置。 |
| Infrastructure as Code | Terraform/Pulumi plan review, drift detection, module design. Terraform/Pulumi 计划审查、漂移检测、模块设计。 |
| Cost Optimization | Reserved instance analysis, right-sizing, spot instance strategy. 预留实例分析、规模调整、竞价实例策略。 |
| Disaster Recovery | Backup verification, failover testing, RTO/RPO planning. 备份验证、故障转移测试、RTO/RPO 规划。 |

**Slash Commands**: `/infra-plan`, `/k8s-status`, `/cost-optimize`, `/dr-test`

**Used By**: DevOps (all), Engineering (SRE, infrastructure maintainer), Architecture

---

#### S21: ML/AI Model Operations / ML/AI 模型运维

**Plugin**: `skill-mlops`
**Estimated Role Coverage**: 6 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Model Training | Hyperparameter tuning, training pipeline orchestration, experiment tracking. 超参数调优、训练管道编排、实验跟踪。 |
| Model Evaluation | Metrics computation (accuracy, F1, AUC), bias detection, fairness audit. 指标计算（准确率、F1、AUC）、偏差检测、公平性审计。 |
| Model Deployment | Serving configuration, A/B model testing, shadow deployment. 服务配置、A/B 模型测试、影子部署。 |
| Feature Engineering | Feature store management, feature importance analysis, drift detection. 特征存储管理、特征重要性分析、漂移检测。 |
| Model Monitoring | Prediction quality tracking, data drift alerting, retraining triggers. 预测质量跟踪、数据漂移告警、重训练触发。 |

**Slash Commands**: `/train-model`, `/evaluate-model`, `/deploy-model`, `/monitor-drift`

**Used By**: Engineering (AI engineer, model QA, data engineer, ML platform)

---

#### S22: Paid Advertising Management / 付费广告管理

**Plugin**: `skill-paid-ads`
**Estimated Role Coverage**: 6 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| PPC Campaign Management | Google Ads, Bing Ads campaign structure, keyword bidding. Google Ads、Bing Ads 广告系列结构、关键词出价。 |
| Programmatic Advertising | DSP configuration, audience targeting, frequency capping. DSP 配置、受众定向、频次控制。 |
| Social Ads | Facebook/Instagram, LinkedIn, Twitter ad management. Facebook/Instagram、LinkedIn、Twitter 广告管理。 |
| Bid Optimization | Automated bidding strategy, ROAS targeting, budget pacing. 自动出价策略、ROAS 目标、预算调配。 |
| Attribution Modeling | Multi-touch attribution, channel mix analysis, incrementality testing. 多触点归因、渠道组合分析、增量测试。 |

**Slash Commands**: `/create-campaign-ad`, `/optimize-bids`, `/attribution-report`, `/audience-target`

**Used By**: Marketing (paid media buyer, programmatic specialist, performance marketer, social ads manager)

---

#### S23: Workflow & Process Automation / 工作流程自动化

**Plugin**: `skill-workflow-automation`
**Estimated Role Coverage**: 6 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| RPA Design | Bot workflow design, exception handling, schedule management. 机器人流程设计、异常处理、调度管理。 |
| Integration Orchestration | Multi-system coordination, data sync, webhook management. 多系统协调、数据同步、Webhook 管理。 |
| Trigger Management | Event-driven automation, condition evaluation, cascade control. 事件驱动自动化、条件评估、级联控制。 |
| Process Mining | Workflow analysis, bottleneck detection, optimization recommendations. 流程分析、瓶颈检测、优化建议。 |
| Governance | Automation inventory, compliance checking, audit logging. 自动化清单、合规检查、审计日志。 |

**Slash Commands**: `/design-workflow`, `/configure-trigger`, `/mine-process`, `/audit-automation`

**Used By**: Engineering (workflow architect, automation governance), Product (experiment tracker), Operations

---

#### S24: Database Administration / 数据库管理

**Plugin**: `skill-database-admin`
**Estimated Role Coverage**: 5 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Query Optimization | EXPLAIN analysis, index recommendations, query rewriting. EXPLAIN 分析、索引建议、查询重写。 |
| Schema Design | Normalization, denormalization decisions, migration planning. 规范化、反规范化决策、迁移规划。 |
| Migration Management | Version-controlled migrations, rollback scripts, data backfill. 版本控制迁移、回滚脚本、数据回填。 |
| Backup & Recovery | Backup strategy, point-in-time recovery, cross-region replication. 备份策略、时间点恢复、跨区域复制。 |
| Performance Tuning | Connection pooling, buffer management, lock contention analysis. 连接池、缓冲区管理、锁争用分析。 |

**Slash Commands**: `/optimize-query`, `/design-schema`, `/plan-migration`, `/backup-status`

**Used By**: Engineering (database optimizer, data engineer, backend architect)

---

#### S25: Accessibility Auditing / 无障碍审计

**Plugin**: `skill-accessibility`
**Estimated Role Coverage**: 5 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| WCAG 2.2 Compliance | Level A/AA/AAA testing, success criteria verification. A/AA/AAA 级测试、成功标准验证。 |
| Screen Reader Testing | ARIA role validation, reading order, live region behavior. ARIA 角色验证、阅读顺序、实时区域行为。 |
| Color Contrast | Contrast ratio calculation, color blindness simulation, palette suggestions. 对比度计算、色盲模拟、调色板建议。 |
| Keyboard Navigation | Focus order, trap detection, shortcut conflicts. 焦点顺序、陷阱检测、快捷键冲突。 |
| Inclusive Design | Content readability, cognitive load assessment, plain language scoring. 内容可读性、认知负荷评估、简明语言评分。 |

**Slash Commands**: `/wcag-audit`, `/contrast-check`, `/keyboard-test`, `/readability-score`

**Used By**: Design (accessibility auditor, inclusive visuals), Engineering (UI developer), Product (UX)

---

#### S26: Blockchain & Web3 / 区块链与 Web3

**Plugin**: `skill-blockchain`
**Estimated Role Coverage**: 5 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Smart Contract Audit | Reentrancy, overflow, access control, gas optimization review. 重入、溢出、访问控制、Gas 优化审查。 |
| ZK Proof Analysis | Circuit design review, proof verification, trusted setup validation. 电路设计审查、证明验证、可信设置验证。 |
| DeFi Protocol Analysis | TVL tracking, yield strategy evaluation, risk assessment. TVL 跟踪、收益策略评估、风险评估。 |
| Token Economics | Supply dynamics, distribution analysis, incentive modeling. 供应动态、分配分析、激励建模。 |
| On-Chain Analytics | Transaction pattern analysis, wallet clustering, MEV detection. 交易模式分析、钱包聚类、MEV 检测。 |

**Slash Commands**: `/audit-contract`, `/analyze-defi`, `/token-economics`, `/onchain-analytics`

**Used By**: Engineering (Solidity engineer, blockchain security, ZK steward), Finance (crypto analysis)

---

#### S27: Spatial Computing & XR / 空间计算与 XR

**Plugin**: `skill-spatial-computing`
**Estimated Role Coverage**: 4 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| ARKit/RealityKit | Scene understanding, anchor management, hand tracking. 场景理解、锚点管理、手部追踪。 |
| Spatial UI Design | 3D layout systems, gaze interaction, depth management. 3D 布局系统、注视交互、深度管理。 |
| 3D Interaction | Gesture recognition, physics simulation, haptic feedback design. 手势识别、物理模拟、触觉反馈设计。 |
| Performance Optimization | Draw call reduction, LOD management, thermal throttling mitigation. Draw Call 减少、LOD 管理、热节流缓解。 |
| Cross-Platform | visionOS, Meta Quest, WebXR compatibility layers. visionOS、Meta Quest、WebXR 兼容层。 |

**Slash Commands**: `/spatial-design`, `/ar-prototype`, `/xr-performance`, `/3d-interaction`

**Used By**: Engineering (all spatial computing roles — visionOS, XR interaction, spatial UI)

---

#### S28: Game Engine Development / 游戏引擎开发

**Plugin**: `skill-game-engine`
**Estimated Role Coverage**: 3 roles

| Capability / 能力 | Detail / 详情 |
|---|---|
| Unity Development | C# scripting, DOTS/ECS, Addressables, custom editor tools. C# 脚本、DOTS/ECS、Addressables、自定义编辑器工具。 |
| Unreal Engine | Blueprint/C++ integration, Nanite/Lumen, GAS framework. Blueprint/C++ 集成、Nanite/Lumen、GAS 框架。 |
| Godot | GDScript/C# optimization, scene tree architecture, signal patterns. GDScript/C# 优化、场景树架构、信号模式。 |
| Game Systems | Inventory, dialogue, save/load, state machines, AI behavior trees. 背包、对话、存读档、状态机、AI 行为树。 |
| Multiplayer | Netcode, state synchronization, lag compensation, matchmaking. 网络代码、状态同步、延迟补偿、匹配系统。 |

**Slash Commands**: `/unity-assist`, `/unreal-assist`, `/godot-assist`, `/game-system-design`

**Used By**: Engineering (Unity developer, Unreal specialist, Godot developer)

---

## 4. Skill-to-Role Mapping Matrix / 技能角色映射矩阵

The following matrix shows which skills are used by each department. A filled cell indicates the skill is relevant to one or more roles in that department.

下表展示每个部门使用的技能。填充的单元格表示该技能与该部门的一个或多个角色相关。

| Skill | Eng | Test | DevOps | Product | Design | Marketing | Sales | Finance | Support | Legal | HR | Specialized |
|-------|-----|------|--------|---------|--------|-----------|-------|---------|---------|-------|----|-------------|
| **S01** Data Analysis | X | X | X | X | . | X | X | X | X | . | . | . |
| **S02** Content Gen | . | . | . | X | X | X | X | . | X | . | X | . |
| **S03** Web Research | X | . | . | X | . | X | X | X | X | . | . | . |
| **S04** Doc Generation | X | . | . | X | . | X | X | X | . | X | X | . |
| **S05** Code Analysis | X | X | X | . | . | . | . | . | . | . | . | . |
| **S06** SEO | . | . | . | X | . | X | . | . | . | . | . | . |
| **S07** Project Mgmt | X | . | . | X | X | X | . | . | . | . | . | . |
| **S08** Financial | . | . | . | X | . | . | X | X | X | . | . | . |
| **S09** Security | X | . | X | . | . | . | . | . | . | X | . | X |
| **S10** Performance | X | X | X | . | . | . | . | . | . | . | . | . |
| **S11** User Research | . | . | . | X | X | X | . | . | X | . | . | . |
| **S12** API Testing | X | X | . | . | . | . | X | . | . | . | . | . |
| **S13** CI/CD | X | X | X | . | . | . | . | . | . | . | . | . |
| **S14** Social Media | . | . | . | . | . | X | . | . | . | . | . | . |
| **S15** Sales Pipeline | . | . | . | . | . | . | X | . | . | . | . | . |
| **S16** Design System | X | . | . | X | X | . | . | . | . | . | . | . |
| **S17** Legal Compliance | . | . | . | . | . | . | . | X | . | X | X | X |
| **S18** Email Automation | . | . | . | . | . | X | X | . | . | . | . | . |
| **S19** Video Production | . | . | . | . | . | X | . | . | . | . | . | . |
| **S20** Cloud Infra | X | . | X | . | . | . | . | . | . | . | . | . |
| **S21** ML/AI Ops | X | . | . | . | . | . | . | . | . | . | . | . |
| **S22** Paid Ads | . | . | . | . | . | X | . | . | . | . | . | . |
| **S23** Workflow Auto | X | . | . | X | . | . | . | . | . | . | . | . |
| **S24** Database Admin | X | . | . | . | . | . | . | . | . | . | . | . |
| **S25** Accessibility | X | . | . | X | X | . | . | . | . | . | . | . |
| **S26** Blockchain | X | . | . | . | . | . | . | X | . | . | . | . |
| **S27** Spatial XR | X | . | . | . | . | . | . | . | . | . | . | . |
| **S28** Game Engine | X | . | . | . | . | . | . | . | . | . | . | . |

**Legend / 图例**: `X` = Skill used by 1+ roles in department | `.` = Not applicable

### Department Skill Count Summary / 部门技能数量汇总

| Department / 部门 | Skill Count / 技能数 | Key Skills / 核心技能 |
|---|---|---|
| Engineering | 18 | S01, S03, S04, S05, S09, S10, S12, S13, S20, S21, S24 |
| Testing | 5 | S01, S05, S10, S12, S13 |
| DevOps | 5 | S01, S05, S09, S10, S13, S20 |
| Product | 9 | S01, S02, S03, S04, S06, S07, S08, S11, S16, S25 |
| Design | 5 | S02, S07, S11, S16, S25 |
| Marketing | 10 | S01, S02, S03, S04, S06, S07, S11, S14, S18, S19, S22 |
| Sales | 6 | S01, S02, S03, S04, S12, S15, S18 |
| Finance | 5 | S01, S03, S04, S08, S17, S26 |
| Support | 5 | S01, S02, S03, S08, S11 |
| Legal | 3 | S04, S09, S17 |
| HR | 3 | S02, S04, S17 |
| Specialized | 3 | S09, S17, S27, S28 |

---

## 5. WinClaw Plugin Architecture / WinClaw 插件架构

### Plugin Structure / 插件结构

Each extractable skill becomes a WinClaw plugin. Plugins follow a standardized structure:

每个可提取的技能成为一个 WinClaw 插件。插件遵循标准化结构：

```
winclaw-plugins/
  skill-data-analysis/          # S01
    manifest.json               # Plugin metadata, commands, dependencies
    commands/
      analyze-data.ts           # /analyze-data implementation
      generate-dashboard.ts     # /generate-dashboard implementation
      detect-anomalies.ts       # /detect-anomalies implementation
      query-data.ts             # /query-data implementation
    schemas/
      input.json                # Input validation schemas
      output.json               # Output format schemas
    README.md                   # Usage documentation
  skill-content-generation/     # S02
    ...
  skill-web-research/           # S03
    ...
```

### Plugin Naming Convention / 插件命名规范

| Pattern / 模式 | Example / 示例 |
|---|---|
| Plugin directory | `skill-{skill-id}` → `skill-data-analysis` |
| Plugin package | `@winclaw/skill-{skill-id}` → `@winclaw/skill-data-analysis` |
| Slash command prefix | `/{action}-{noun}` → `/analyze-data` |
| Manifest ID | `skill.{skill-id}` → `skill.data-analysis` |

### manifest.json Schema / manifest.json 模式

```json
{
  "id": "skill.data-analysis",
  "name": "Data Analysis & Reporting",
  "version": "1.0.0",
  "description": "SQL queries, statistics, dashboards, anomaly detection",
  "tier": "P0",
  "skillCode": "S01",
  "commands": [
    {
      "name": "analyze-data",
      "description": "Run analysis on a dataset with specified metrics",
      "input_schema": "./schemas/analyze-data-input.json",
      "output_schema": "./schemas/analyze-data-output.json"
    }
  ],
  "dependencies": {
    "grc_built_in": ["web_fetch", "grc_task_complete"],
    "plugins": []
  },
  "compatible_roles": ["*"],
  "min_grc_version": "2.0.0"
}
```

### GRC Role Template Integration / GRC 角色模板集成

Each role's `TOOLS.md` file references both GRC built-in tools and relevant skill plugins:

每个角色的 `TOOLS.md` 文件同时引用 GRC 内置工具和相关技能插件：

```markdown
# TOOLS.md — Marketing Content Creator

## Built-in Tools (GRC Core)
- grc_task — Create and delegate tasks
- grc_task_update — Update task progress
- grc_task_complete — Deliver completed work
- sessions_send — Communicate with other agents
- web_fetch — Retrieve web content

## Skill Plugins
- skill-content-generation (S02) — /generate-content, /check-brand-voice, /repurpose-content
- skill-web-research (S03) — /research-topic, /competitive-analysis
- skill-seo (S06) — /keyword-research, /optimize-content
- skill-social-media (S14) — /schedule-post, /track-engagement
- skill-document-generation (S04) — /generate-pdf, /create-slides
```

### Composability / 可组合性

Skills are designed to be composed together. A single agent action may invoke multiple skills in sequence:

技能设计为可组合使用。单个代理动作可以按顺序调用多个技能：

```
User Request: "Create an SEO-optimized blog post about cloud security trends"

1. skill-web-research → /research-topic "cloud security trends 2026"
2. skill-seo → /keyword-research "cloud security"
3. skill-content-generation → /generate-content (type=blog, keywords=..., research=...)
4. skill-seo → /optimize-content (content=...)
5. skill-document-generation → /generate-pdf (content=..., format=blog)
6. grc_task_complete → deliver final output
```

---

## 6. Implementation Roadmap / 实施路线图

### Phase Overview / 阶段概览

```
Week 1-2   ████████░░░░░░░░░░  Phase 1: P0 Core Skills + 9 Existing Roles
Week 3-4   ████████████████░░  Phase 2: P1 Skills + Eng/Test/Support (37 roles)
Week 5-6   ████████████████░░  Phase 3: P2 Skills + Marketing/Sales (41 roles)
Week 7-8   ████████████████░░  Phase 4: Design/Product/PM/Specialized (43 roles)
Week 9+    ██████████████████  Phase 5: P3 Niche Domain Skills
```

---

### Phase 1 (Week 1–2): P0 Core Skills + Existing 9 GRC Roles / 核心技能 + 现有 9 个 GRC 角色

**Objective / 目标**: Implement the 4 most impactful skills and validate against existing GRC role templates.

实现最具影响力的 4 项技能并针对现有 GRC 角色模板进行验证。

| Task / 任务 | Detail / 详情 | Est. / 估时 |
|---|---|---|
| Implement S01: Data Analysis | SQL engine, stats library, dashboard JSON schema | 3 days |
| Implement S02: Content Generation | Multi-format templates, brand voice engine | 3 days |
| Implement S03: Web Research | Research pipeline, source verification, caching | 2 days |
| Implement S04: Document Generation | PDF/DOCX/XLSX/PPTX rendering engines | 3 days |
| Validate against 9 existing roles | Update TOOLS.md for each, integration testing | 3 days |

**Exit Criteria / 退出标准**:
- All 4 P0 plugins pass unit and integration tests
- 9 existing GRC roles' TOOLS.md updated with plugin references
- Plugin composability demonstrated with end-to-end workflow

---

### Phase 2 (Week 3–4): P1 Skills + Engineering/Testing/Support Roles / P1 技能 + 工程/测试/支持角色

**Objective / 目标**: Implement 7 P1 skills and convert 37 engineering, testing, and support roles.

实现 7 项 P1 技能并转换 37 个工程、测试和支持角色。

| Task / 任务 | Detail / 详情 | Est. / 估时 |
|---|---|---|
| Implement S05: Code Analysis | AST parsing, security rules, review engine | 2 days |
| Implement S06: SEO | Crawler, keyword DB, optimization rules | 2 days |
| Implement S07: Project Management | RICE calculator, sprint planner, gantt engine | 2 days |
| Implement S08: Financial Analysis | NPV/IRR calculator, forecasting models | 2 days |
| Implement S09: Security Audit | STRIDE framework, OWASP rules, CVE lookup | 2 days |
| Implement S10: Performance Testing | Load test harness, vitals measurement | 1 day |
| Implement S11: User Research | Survey engine, sentiment analyzer | 1 day |
| Convert 37 roles (8 MD files each) | AGENTS, TASKS, TOOLS, HEARTBEAT, USER, SOUL, IDENTITY, BOOTSTRAP | 4 days |

**Role Conversion Breakdown / 角色转换明细**:
- Engineering: ~20 roles (frontend, backend, full-stack, architecture, infrastructure, etc.)
- Testing: ~8 roles (QA, automation, performance, API, security testing, etc.)
- Support: ~9 roles (L1/L2/L3 support, KB management, analytics, escalation, etc.)

---

### Phase 3 (Week 5–6): P2 Skills + Marketing/Sales/Paid Media Roles / P2 技能 + 营销/销售/付费媒体角色

**Objective / 目标**: Implement 7 P2 skills and convert 41 marketing, sales, and paid media roles.

实现 7 项 P2 技能并转换 41 个营销、销售和付费媒体角色。

| Task / 任务 | Detail / 详情 | Est. / 估时 |
|---|---|---|
| Implement S12: API Testing | REST/GraphQL test runner, contract validator | 1 day |
| Implement S13: CI/CD | Pipeline configurator, deployment orchestrator | 1 day |
| Implement S14: Social Media | Multi-platform API adapters, scheduler | 2 days |
| Implement S15: Sales Pipeline | Lead scoring model, forecasting engine | 2 days |
| Implement S16: Design System | Component auditor, token manager | 1 day |
| Implement S17: Legal Compliance | GDPR checklist engine, contract parser | 1 day |
| Implement S18: Email Automation | Campaign builder, A/B test framework | 1 day |
| Convert 41 roles (8 MD files each) | Full template generation with skill assignments | 5 days |

**Role Conversion Breakdown / 角色转换明细**:
- Marketing: ~22 roles (content, social, SEO, growth, brand, analytics, China market, etc.)
- Sales: ~12 roles (SDR, AE, solutions engineer, account strategist, presales, etc.)
- Paid Media: ~7 roles (PPC, programmatic, social ads, attribution, etc.)

---

### Phase 4 (Week 7–8): Design/Product/PM/Specialized Roles / 设计/产品/项目管理/专业角色

**Objective / 目标**: Convert remaining 43 roles across Design, Product, PM, and specialized departments.

转换设计、产品、项目管理和专业部门的剩余 43 个角色。

| Task / 任务 | Detail / 详情 | Est. / 估时 |
|---|---|---|
| Convert Design roles (~10) | UI, UX, brand, accessibility, motion, illustration | 2 days |
| Convert Product roles (~12) | PM, analyst, growth, pricing, localization | 2 days |
| Convert PM/Operations roles (~8) | Scrum master, release manager, capacity planner | 2 days |
| Convert Specialized roles (~13) | Healthcare, government, education, nonprofit verticals | 2 days |
| Cross-role integration testing | Verify A2A communication between converted roles | 2 days |

---

### Phase 5 (Week 9+): P3 Niche Domain Skills / P3 小众领域技能

**Objective / 目标**: Implement specialized skills for niche domains. These are lower priority as they serve fewer roles.

实现小众领域的专业技能。优先级较低，因为服务的角色较少。

| Task / 任务 | Skills / 技能 | Est. / 估时 |
|---|---|---|
| Media & Video | S19: Video Production | 3 days |
| Infrastructure | S20: Cloud Infra, S24: Database Admin | 3 days |
| AI/ML | S21: MLOps | 3 days |
| Advertising | S22: Paid Ads | 2 days |
| Automation | S23: Workflow Automation | 2 days |
| Accessibility | S25: Accessibility Auditing | 2 days |
| Blockchain | S26: Blockchain & Web3 | 3 days |
| Spatial/XR | S27: Spatial Computing | 3 days |
| Game Dev | S28: Game Engine | 3 days |

**Total Phase 5 Estimate**: ~24 days (can be parallelized across teams)

---

## 7. Recommendations / 建议

### Strategic Recommendations / 战略建议

1. **Start with P0 skills** — S01 through S04 collectively serve 40+ roles each, covering ~80% of all agent roles. Implementing these first provides the highest return on investment.

   **从 P0 技能开始** — S01 到 S04 各覆盖 40+ 角色，约占所有角色的 80%。优先实现这些技能可获得最高投资回报。

2. **Dual-reference TOOLS.md** — Each role's TOOLS.md should clearly separate GRC built-in tools from skill plugins. Built-in tools are always available; plugins are loaded on demand.

   **TOOLS.md 双重引用** — 每个角色的 TOOLS.md 应清楚区分 GRC 内置工具和技能插件。内置工具始终可用；插件按需加载。

3. **Composable skill architecture** — A role can combine any number of skills. The Marketing Content Creator might use S02 + S03 + S06 + S14, while the Sales Engineer uses S01 + S03 + S04 + S12. Skills should be independent and stateless.

   **可组合技能架构** — 一个角色可以组合任意数量的技能。营销内容创作者可能使用 S02 + S03 + S06 + S14，而销售工程师使用 S01 + S03 + S04 + S12。技能应独立且无状态。

4. **Role-specific tool configuration** — Within the skill framework, allow per-role configuration. For example, S01 (Data Analysis) for a Finance role might default to financial datasets, while for an Engineering role it defaults to system metrics.

   **角色特定工具配置** — 在技能框架内允许按角色配置。例如，财务角色的 S01（数据分析）可能默认使用财务数据集，而工程角色默认使用系统指标。

### Technical Recommendations / 技术建议

5. **Plugin versioning** — Use semantic versioning for all plugins. Role templates should specify minimum compatible versions to prevent breaking changes.

   **插件版本控制** — 对所有插件使用语义化版本控制。角色模板应指定最低兼容版本以防止破坏性变更。

6. **Lazy loading** — Only load plugins when a role is activated. A node running 5 roles should only have the union of their required plugins in memory.

   **延迟加载** — 仅在角色激活时加载插件。运行 5 个角色的节点应仅在内存中保留其所需插件的并集。

7. **Shared data layer** — P0 skills (especially S01 and S03) should share a common data caching layer to avoid redundant web fetches and database queries across roles on the same node.

   **共享数据层** — P0 技能（尤其是 S01 和 S03）应共享公共数据缓存层，以避免同一节点上跨角色的冗余网络请求和数据库查询。

8. **Telemetry per skill** — Track which skills are most used, which commands are most called, and which role-skill combinations are most active. This data informs future optimization priorities.

   **按技能遥测** — 跟踪哪些技能使用最多、哪些命令调用最频繁、哪些角色-技能组合最活跃。这些数据为未来的优化优先级提供依据。

### Process Recommendations / 流程建议

9. **Incremental validation** — After each phase, validate converted roles by running them through standard task scenarios. Do not proceed to the next phase until the current phase passes validation.

   **增量验证** — 每个阶段完成后，通过标准任务场景运行已转换角色进行验证。在当前阶段通过验证之前不要进入下一阶段。

10. **Community contribution model** — P3 specialized skills (S26–S28) are candidates for community-contributed plugins, as they serve niche domains and benefit from domain expert input.

    **社区贡献模式** — P3 专业技能（S26–S28）适合作为社区贡献的插件，因为它们服务于小众领域并受益于领域专家的输入。

---

*Document generated: 2026-03-15*
*Source repository: [agency-agents](https://github.com/msitarzewski/agency-agents)*
*Target system: GRC Role Template System + WinClaw Plugin Architecture*
