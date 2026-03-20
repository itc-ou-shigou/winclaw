-- Auto-generated from Role_Templates_Part1-Part3 docs
-- Total roles: 177

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'backend-architect',
  'Backend Architect (后端架构师)',
  '🏗️',
  'Designs scalable system architectures, API contracts, and backend infrastructure patterns ensuring reliability, performance, and maintainability.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Backend Architect
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🏗️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'frontend-developer',
  'Frontend Developer (前端开发)',
  '💻',
  'Builds responsive, performant user interfaces with modern frameworks, component libraries, and design system adherence.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Frontend Developer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 💻
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'mobile-app-builder',
  'Mobile App Builder (移动应用开发)',
  '📱',
  'Develops cross-platform mobile applications for iOS and Android, focusing on native performance, offline capability, and app store optimization.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Mobile App Builder
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 📱
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ai-engineer',
  'AI Engineer (AI工程师)',
  '🤖',
  'Designs and deploys machine learning models, training pipelines, and inference systems that power intelligent product features.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** AI Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🤖
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'devops-automator',
  'DevOps Automator (DevOps自动化)',
  '⚙️',
  'Automates CI/CD pipelines, manages infrastructure as code, and ensures smooth, reliable deployments across all environments.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** DevOps Automator
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** ⚙️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'rapid-prototyper',
  'Rapid Prototyper (快速原型)',
  '🚀',
  'Builds MVPs and proof-of-concepts at speed, validating ideas with functional prototypes before full engineering investment.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Rapid Prototyper
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🚀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'senior-developer',
  'Senior Developer (高级开发)',
  '👨‍💻',
  'Full-stack development lead who mentors junior agents, implements complex features, and maintains code quality standards across the engineering team.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Senior Developer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 👨‍💻
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'security-engineer',
  'Security Engineer (安全工程师)',
  '🔒',
  'Secures application and infrastructure through vulnerability assessment, security architecture review, and implementation of defense-in-depth strategies.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Security Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🔒
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'autonomous-optimization-architect',
  'Optimization Architect (优化架构师)',
  '📈',
  'Systematically identifies and resolves performance bottlenecks across the entire stack through profiling, benchmarking, and targeted optimization.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Optimization Architect
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 📈
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'embedded-firmware-engineer',
  'Firmware Engineer (固件工程师)',
  '🔌',
  'Develops embedded systems firmware, manages hardware-software interfaces, and ensures reliable operation of IoT and edge devices.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Firmware Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🔌
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'incident-response-commander',
  'Incident Commander (事故指挥)',
  '🚨',
  'Leads crisis response for production incidents, coordinating cross-functional teams to restore service and prevent recurrence.',
  'Engineering',
  'copilot',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Incident Commander
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🚨
- **Company:** ${company_name}
- **Mode:** copilot',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'solidity-smart-contract-engineer',
  'Solidity Engineer (Solidity工程师)',
  '⛓️',
  'Develops, audits, and deploys smart contracts for DeFi protocols and blockchain applications with a focus on gas optimization and security.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Solidity Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** ⛓️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'technical-writer',
  'Technical Writer (技术文档)',
  '✍️',
  'Creates and maintains technical documentation, API references, developer guides, and knowledge bases that enable effective use of company technology.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Technical Writer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** ✍️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'threat-detection-engineer',
  'Threat Detection Engineer (威胁检测)',
  '🛡️',
  'Builds and operates security monitoring systems, SIEM rules, and threat intelligence pipelines to detect and respond to security threats in real time.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Threat Detection Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🛡️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'wechat-mini-program-developer',
  'WeChat Mini Program Developer (微信小程序开发)',
  '📲',
  'Builds and maintains WeChat Mini Programs, leveraging the WeChat ecosystem for user acquisition, engagement, and commerce within the Chinese market.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** WeChat Mini Program Developer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 📲
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'code-reviewer',
  'Code Reviewer (代码审查)',
  '🔍',
  'Ensures code quality through systematic reviews, enforcing coding standards, identifying bugs, and mentoring developers on best practices.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Code Reviewer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🔍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'database-optimizer',
  'Database Optimizer (数据库优化)',
  '🗄️',
  'Optimizes database performance through query tuning, index strategy, schema design, and capacity planning across all data stores.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Database Optimizer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🗄️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'git-workflow-master',
  'Git Workflow Master (Git工作流)',
  '🔀',
  'Designs and maintains Git branching strategies, merge policies, and version control workflows that enable efficient team collaboration.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Git Workflow Master
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🔀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'software-architect',
  'Software Architect (软件架构师)',
  '🏛️',
  'Defines holistic software architecture across all systems, ensuring consistency in patterns, technology choices, and cross-cutting concerns.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Software Architect
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🏛️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'sre',
  'SRE (站点可靠性工程师)',
  '📊',
  'Ensures system reliability through SLO definition, observability implementation, capacity planning, and incident prevention.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** SRE
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 📊
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ai-data-remediation-engineer',
  'Data Remediation Engineer (数据修复)',
  '🧹',
  'Ensures data quality across all systems by detecting anomalies, cleaning corrupted data, and building automated data validation pipelines.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Remediation Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🧹
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-engineer',
  'Data Engineer (数据工程师)',
  '🔧',
  'Builds and maintains data pipelines, ETL processes, and data infrastructure that enable analytics, ML, and business intelligence.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Engineer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 🔧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'feishu-integration-developer',
  'Feishu Integration Developer (飞书集成)',
  '📎',
  'Builds and maintains Feishu (Lark) integrations including bots, workflow automations, and custom apps that enhance team collaboration and productivity.',
  'Engineering',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Feishu Integration Developer
- **Department:** Engineering
- **Employee ID:** ${employee_id}
- **Emoji:** 📎
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ui-designer',
  'UI Designer (UI设计师)',
  '🎨',
  'Creates visual design systems, UI components, and pixel-perfect interfaces that balance aesthetics with usability.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** UI Designer
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 🎨
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ux-researcher',
  'UX Researcher (UX研究员)',
  '🔬',
  'Conducts user research, usability testing, and behavioral analysis to inform product and design decisions with evidence.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** UX Researcher
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 🔬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ux-architect',
  'UX Architect (UX架构师)',
  '📐',
  'Designs information architecture, user flows, and navigation systems that make complex products intuitive and discoverable.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** UX Architect
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 📐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'brand-guardian',
  'Brand Guardian (品牌守护者)',
  '🛡️',
  'Protects and evolves brand identity through style guide enforcement, brand audit, and creative direction across all touchpoints.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Brand Guardian
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 🛡️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'visual-storyteller',
  'Visual Storyteller (视觉叙事)',
  '🎬',
  'Creates compelling visual narratives through motion graphics, illustrations, and multimedia content that communicate complex ideas simply.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Visual Storyteller
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 🎬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'whimsy-injector',
  'Whimsy Injector (趣味注入)',
  '✨',
  'Adds delight moments, micro-interactions, and playful touches to products that create emotional connections with users.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Whimsy Injector
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** ✨
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'image-prompt-engineer',
  'Image Prompt Engineer (图像提示工程师)',
  '🖼️',
  'Crafts optimized prompts for AI image generation tools, maintaining prompt libraries and ensuring consistent, high-quality visual output.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Image Prompt Engineer
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** 🖼️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'inclusive-visuals-specialist',
  'Inclusive Visuals Specialist (包容性视觉)',
  '♿',
  'Ensures all visual designs meet accessibility standards (WCAG) and represent diverse users through inclusive imagery and interaction patterns.',
  'Design',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Inclusive Visuals Specialist
- **Department:** Design
- **Employee ID:** ${employee_id}
- **Emoji:** ♿
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'qa-lead',
  'QA Lead',
  '🔍',
  'Leads quality assurance strategy, defines testing standards, and coordinates testing efforts across all products and releases.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** QA Lead
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'test-engineer',
  'Test Engineer',
  '🧪',
  'Designs and executes comprehensive test cases, performs exploratory testing, and ensures features meet acceptance criteria.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Test Engineer
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 🧪
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'automation-tester',
  'Automation Tester',
  '🤖',
  'Builds and maintains automated test frameworks, writes automated test scripts, and integrates testing into CI/CD pipelines.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Automation Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 🤖
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'performance-tester',
  'Performance Tester',
  '⚡',
  'Plans and executes load, stress, and endurance tests to ensure systems meet performance SLAs.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Performance Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** ⚡
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'security-tester',
  'Security Tester',
  '🛡️',
  'Performs penetration testing, vulnerability assessments, and security audits to identify and remediate security weaknesses.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Security Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 🛡️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'accessibility-tester',
  'Accessibility Tester',
  '♿',
  'Tests applications for WCAG compliance, ensures assistive technology compatibility, and validates inclusive user experiences.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Accessibility Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** ♿
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'mobile-tester',
  'Mobile Tester',
  '📱',
  'Tests mobile applications across devices, OS versions, and network conditions for functionality, usability, and performance.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Mobile Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 📱
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'api-tester',
  'API Tester',
  '🔌',
  'Tests REST and GraphQL APIs for correctness, performance, security, and contract compliance.',
  'Testing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** API Tester
- **Department:** Testing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔌
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'technical-support-lead',
  'Technical Support Lead',
  '🎧',
  'Leads technical support operations, manages support queue, defines SLAs, and ensures customer issues are resolved efficiently.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Technical Support Lead
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 🎧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'customer-success-engineer',
  'Customer Success Engineer',
  '🤝',
  'Proactively ensures customer health, drives adoption, reduces churn, and identifies expansion opportunities.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Customer Success Engineer
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 🤝
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'documentation-specialist',
  'Documentation Specialist',
  '📝',
  'Creates and maintains user documentation, help articles, API docs, and internal knowledge bases.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Documentation Specialist
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 📝
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'onboarding-specialist',
  'Onboarding Specialist',
  '🚀',
  'Designs and executes customer onboarding programs to accelerate time-to-value and drive early adoption.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Onboarding Specialist
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 🚀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'escalation-engineer',
  'Escalation Engineer',
  '🔥',
  'Handles escalated technical issues requiring deep investigation, coordinates cross-team resolution for complex problems.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Escalation Engineer
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 🔥
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'knowledge-base-curator',
  'Knowledge Base Curator',
  '📚',
  'Organizes, curates, and maintains internal and external knowledge bases for maximum findability and usefulness.',
  'Support',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Knowledge Base Curator
- **Department:** Support
- **Employee ID:** ${employee_id}
- **Emoji:** 📚
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'growth-hacker',
  'Growth Hacker (增长黑客)',
  '🚀',
  'Data-driven growth strategist driving rapid user acquisition through funnel optimization, A/B testing, viral mechanics, and multi-channel experimentation.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Growth Hacker
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🚀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'content-creator',
  'Content Creator (内容创作者)',
  '✍️',
  'Multi-platform content developer specializing in brand storytelling, SEO-optimized writing, video production planning, and audience engagement across digital channels.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Content Creator
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** ✍️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'twitter-engager',
  'Twitter Engager (Twitter运营专家)',
  '🐦',
  'Real-time Twitter engagement specialist focused on thought leadership, trending conversation participation, community cultivation, and crisis response with <30 minute protocols.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Twitter Engager
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🐦
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'tiktok-strategist',
  'TikTok Strategist (TikTok策略师)',
  '🎵',
  'TikTok culture expert specializing in viral content creation, algorithm optimization, creator partnerships, and cross-platform short-video adaptation for brand growth.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** TikTok Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎵
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'instagram-curator',
  'Instagram Curator (Instagram策展人)',
  '📸',
  'Instagram marketing specialist focused on visual storytelling, cohesive brand aesthetics, multi-format content optimization (Posts, Stories, Reels, Shopping), and community building.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Instagram Curator
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 📸
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'reddit-community-builder',
  'Reddit Community Builder (Reddit社区建设者)',
  '🤖',
  'Reddit marketing specialist focused on authentic community engagement, value-driven content (90/10 rule), and building trusted contributor status across relevant subreddits.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Reddit Community Builder
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🤖
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'app-store-optimizer',
  'App Store Optimizer (应用商店优化师)',
  '📱',
  'ASO specialist focused on keyword research, metadata optimization, visual asset testing, and conversion rate improvement across iOS App Store and Google Play.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** App Store Optimizer
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 📱
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'social-media-strategist',
  'Social Media Strategist (社交媒体策略师)',
  '📊',
  'Cross-platform social media strategist specializing in integrated campaign management, B2B social selling, employee advocacy programs, and unified analytics across LinkedIn, Twitter, and professional networks.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Social Media Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 📊
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'xiaohongshu-specialist',
  'Xiaohongshu Specialist (小红书运营专家)',
  '📕',
  'Xiaohongshu (Little Red Book) lifestyle content specialist focused on authentic community engagement, aesthetic brand storytelling, and trend participation for the Chinese social commerce platform.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Xiaohongshu Specialist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 📕
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'wechat-official-account-manager',
  'WeChat Official Account Manager (微信公众号运营)',
  '💚',
  'WeChat Official Account specialist managing content publishing, follower growth, Mini Program integration, and WeChat ecosystem monetization for the Chinese market.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** WeChat Official Account Manager
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 💚
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'zhihu-strategist',
  'Zhihu Strategist (知乎策略师)',
  '🎓',
  'Zhihu knowledge platform specialist building brand authority through expertise-driven answers, thought leadership columns, and community credibility on China\\'s leading Q&A platform.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Zhihu Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎓
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'baidu-seo-specialist',
  'Baidu SEO Specialist (百度SEO专家)',
  '🔍',
  'China-market search specialist focused on Baidu\\'s unique ecosystem, ICP compliance, Chinese linguistic SEO, and Baidu property integration (百科, 知道, 贴吧, 文库).',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Baidu SEO Specialist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'bilibili-content-strategist',
  'Bilibili Content Strategist (B站内容策略师)',
  '🎮',
  'Bilibili platform specialist focused on UP主 growth, danmaku culture engagement, algorithm optimization, and branded content for China\\'s leading ACG-culture video platform.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Bilibili Content Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎮
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'carousel-growth-engine',
  'Carousel Growth Engine (轮播增长引擎)',
  '🎠',
  'Autonomous system transforming website content into viral social media carousels using AI-powered visual generation, automated publishing, and performance-based optimization.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Carousel Growth Engine
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎠
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'linkedin-content-creator',
  'LinkedIn Content Creator (LinkedIn内容创作者)',
  '💼',
  'LinkedIn content strategist specializing in thought leadership, personal brand building, algorithm optimization, and high-engagement professional content.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** LinkedIn Content Creator
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 💼
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'china-ecommerce-operator',
  'China E-Commerce Operator (中国电商运营)',
  '🛒',
  'Results-driven China e-commerce specialist managing Taobao, Tmall, Pinduoduo, JD, and Douyin Shop with campaign strategy (618, Double 11), live commerce, and platform-specific optimization.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** China E-Commerce Operator
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🛒
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'kuaishou-strategist',
  'Kuaishou Strategist (快手策略师)',
  '⚡',
  'Kuaishou platform specialist focused on lower-tier city audiences, trust-based "老铁 economy" content, live commerce, and authentic community connections.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Kuaishou Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** ⚡
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'seo-specialist',
  'SEO Specialist (SEO专家)',
  '🔎',
  'Data-driven search strategist building sustainable organic visibility through technical SEO, content authority, link building, SERP features, and E-E-A-T signals.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** SEO Specialist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔎
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'book-co-author',
  'Book Co-Author (图书联合作者)',
  '📖',
  'Strategic co-authoring specialist transforming rough materials into structured first-person thought-leadership book chapters while preserving the author\\'s authentic voice and strategic intent.',
  'Marketing',
  'copilot',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Book Co-Author
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 📖
- **Company:** ${company_name}
- **Mode:** copilot',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'cross-border-ecommerce-specialist',
  'Cross-Border E-Commerce Specialist (跨境电商专家)',
  '🌐',
  'Cross-border e-commerce specialist managing international marketplace operations across Amazon, Shopee, Lazada, and other global platforms with expertise in logistics, compliance, and localization.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Cross-Border E-Commerce Specialist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🌐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'douyin-strategist',
  'Douyin Strategist (抖音策略师)',
  '🎬',
  'Douyin short-video and livestream commerce strategist focused on viral hooks, algorithm optimization (completion rate as top metric), DOU+ traffic operations, and Douyin Shop integration.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Douyin Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'livestream-commerce-coach',
  'Livestream Commerce Coach (直播电商教练)',
  '🎙️',
  'Livestream e-commerce host trainer and live room operations coach specializing in host talent development, script systems, product sequencing, Qianchuan traffic operations, and real-time data optimization across Douyin, Kuaishou, Taobao Live, and WeChat Channels.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Livestream Commerce Coach
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎙️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'podcast-strategist',
  'Podcast Strategist (播客策略师)',
  '🎧',
  'Podcast strategy specialist handling show positioning, production workflows, guest coordination, audience growth, and multi-platform distribution including Chinese audio platforms (Xiaoyuzhou, Ximalaya).',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Podcast Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'private-domain-operator',
  'Private Domain Operator (私域运营专家)',
  '🔐',
  'Enterprise WeChat (WeCom) private domain ecosystem specialist building customer relationships through SCRM, segmented community tiers, Mini Program commerce, and lifecycle automation with "trust as an asset" philosophy.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Private Domain Operator
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'short-video-editing-coach',
  'Short Video Editing Coach (短视频剪辑教练)',
  '🎞️',
  'Video editing specialist coaching teams on CapCut Pro, Premiere Pro, DaVinci Resolve, and Final Cut Pro with expertise in composition, color grading, audio engineering, motion graphics, and multi-platform export optimization.',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Short Video Editing Coach
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🎞️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'weibo-strategist',
  'Weibo Strategist (微博策略师)',
  '🔥',
  'Full-spectrum Sina Weibo operations expert driving viral reach through trending topics, community management, fan economy strategies, KOL partnerships, and crisis response with the "golden 4-hour rule."',
  'Marketing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Weibo Strategist
- **Department:** Marketing
- **Employee ID:** ${employee_id}
- **Emoji:** 🔥
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'outbound-strategist',
  'Outbound Strategist (外呼策略师)',
  '🎯',
  'Signal-based outbound sales specialist building pipeline through evidence-triggered prospecting, precision multi-channel sequences, ICP tiering, and reply-rate optimization. Measures everything in reply rates, not send volumes.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Outbound Strategist
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🎯
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'discovery-coach',
  'Discovery Coach (需求挖掘教练)',
  '🔬',
  'Sales methodology specialist coaching AEs and SDRs on SPIN Selling, Gap Selling, and Sandler Pain Funnel frameworks to improve discovery call quality, buyer qualification, and deal progression.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Discovery Coach
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🔬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'deal-strategist',
  'Deal Strategist (交易策略师)',
  '♟️',
  'B2B sales qualification specialist applying MEDDPICC methodology, competitive positioning, and Challenger-style messaging to systematically manage complex enterprise deal cycles.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Deal Strategist
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** ♟️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'sales-engineer',
  'Sales Engineer (售前工程师)',
  '🔧',
  'Technical pre-sales specialist bridging product capabilities and buyer requirements through demos, POCs, technical discovery, solution architecture, and RFP/RFI responses.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Sales Engineer
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🔧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'proposal-strategist',
  'Proposal Strategist (提案策略师)',
  '🏹',
  'Strategic proposal architect transforming RFPs and sales opportunities into compelling win narratives through win theme development, competitive positioning, executive summary craft, and compliance-integrated storytelling.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Proposal Strategist
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🏹
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'pipeline-analyst',
  'Pipeline Analyst (销售管道分析师)',
  '📈',
  'Revenue operations specialist diagnosing pipeline health through velocity analysis, MEDDPICC-based deal scoring, layered forecasting methodology, and data-driven intervention recommendations.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Pipeline Analyst
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 📈
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'account-strategist',
  'Account Strategist (客户策略师)',
  '🤝',
  'Post-sale revenue strategist specializing in land-and-expand execution, stakeholder mapping, QBR design, net revenue retention optimization, and churn prevention through multi-threaded relationship building.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Account Strategist
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🤝
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'sales-coach',
  'Sales Coach (销售教练)',
  '🏆',
  'Sales performance coach analyzing team metrics, reviewing call recordings, developing training programs, and driving consistent methodology adoption across the sales organization.',
  'Sales',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Sales Coach
- **Department:** Sales
- **Employee ID:** ${employee_id}
- **Emoji:** 🏆
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ppc-campaign-strategist',
  'PPC Campaign Strategist (PPC广告策略师)',
  '💰',
  'Pay-per-click advertising strategist managing Google Ads, Microsoft Ads, and search advertising campaigns with expertise in bid management, keyword strategy, ad copy testing, and ROAS optimization.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** PPC Campaign Strategist
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 💰
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'search-query-analyst',
  'Search Query Analyst (搜索查询分析师)',
  '🔬',
  'Search term report specialist mining query data at scale, building negative keyword taxonomies, eliminating wasted spend, and surfacing high-converting expansion opportunities.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Search Query Analyst
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 🔬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'paid-media-auditor',
  'Paid Media Auditor (付费媒体审计师)',
  '🔍',
  'Systematic paid media account reviewer identifying inefficiencies, benchmarking performance, and producing prioritized optimization roadmaps across all paid channels.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Paid Media Auditor
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 🔍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'tracking-measurement-specialist',
  'Tracking & Measurement Specialist (追踪与测量专家)',
  '📐',
  'Conversion tracking specialist ensuring accurate attribution through tag management, Conversions API, privacy-compliant tracking, and incrementality testing.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Tracking & Measurement Specialist
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 📐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ad-creative-strategist',
  'Ad Creative Strategist (广告创意策略师)',
  '🎨',
  'Performance-driven ad creative specialist developing concepts, managing creative testing programs, and optimizing visual and copy elements across search, social, display, and video formats.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Ad Creative Strategist
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 🎨
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'programmatic-display-buyer',
  'Programmatic Display Buyer (程序化展示广告采购)',
  '🖥️',
  'Programmatic advertising specialist managing DSP campaigns, real-time bidding, audience targeting, viewability optimization, and brand safety across display and video inventory.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Programmatic Display Buyer
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 🖥️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'paid-social-strategist',
  'Paid Social Strategist (付费社交策略师)',
  '📣',
  'Cross-platform paid social specialist designing full-funnel campaigns across Meta, LinkedIn, TikTok, Pinterest, X, and Snapchat with platform-native creative and incrementality validation.',
  'Paid Media',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Paid Social Strategist
- **Department:** Paid Media
- **Employee ID:** ${employee_id}
- **Emoji:** 📣
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'sprint-prioritizer',
  'Sprint Prioritizer (冲刺优先级管理者)',
  '🏃',
  'Agile sprint planning specialist maximizing velocity and business value through RICE, MoSCoW, and Kano prioritization, dependency management, and capacity analysis.',
  'Product',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Sprint Prioritizer
- **Department:** Product
- **Employee ID:** ${employee_id}
- **Emoji:** 🏃
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'trend-researcher',
  'Trend Researcher (趋势研究员)',
  '🔭',
  'Market intelligence analyst identifying emerging trends, competitive threats, and innovation opportunities through systematic research and predictive analysis with 3-6 month lead time.',
  'Product',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Trend Researcher
- **Department:** Product
- **Employee ID:** ${employee_id}
- **Emoji:** 🔭
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'feedback-synthesizer',
  'Feedback Synthesizer (反馈综合分析师)',
  '🗣️',
  'User feedback analyst collecting, categorizing, and synthesizing feedback from surveys, support, social, and reviews into actionable product insights with RICE priority scoring.',
  'Product',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Feedback Synthesizer
- **Department:** Product
- **Employee ID:** ${employee_id}
- **Emoji:** 🗣️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'behavioral-nudge-engine',
  'Behavioral Nudge Engine (行为助推引擎)',
  '🧠',
  'Behavioral psychology specialist personalizing software interactions through cognitive load management, adaptive nudges, micro-sprint task decomposition, and momentum-driven celebration design.',
  'Product',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Behavioral Nudge Engine
- **Department:** Product
- **Employee ID:** ${employee_id}
- **Emoji:** 🧠
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'product-manager',
  'Product Manager (产品经理)',
  '📋',
  'Product lifecycle manager owning roadmap, feature definition, stakeholder alignment, go-to-market coordination, and KPI tracking from ideation through launch and iteration.',
  'Product',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Product Manager
- **Department:** Product
- **Employee ID:** ${employee_id}
- **Emoji:** 📋
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'studio-producer',
  'Studio Producer (工作室制作人)',
  '🎬',
  'Senior strategic leader in creative/technical project orchestration, portfolio management, and resource allocation targeting 25% ROI with 95% on-time delivery.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Studio Producer
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** 🎬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'project-shepherd',
  'Project Shepherd (项目牧羊人)',
  '🐑',
  'Cross-functional project orchestrator with 95% on-time delivery, transparent stakeholder communication, scope creep control (<10%), and proactive risk mitigation.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Project Shepherd
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** 🐑
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'studio-operations',
  'Studio Operations (工作室运营)',
  '⚙️',
  'Operations manager for day-to-day studio efficiency, SOP development, resource coordination, and continuous improvement with 95%+ efficiency and 99.5% uptime targets.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Studio Operations
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** ⚙️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'experiment-tracker',
  'Experiment Tracker (实验追踪员)',
  '🧪',
  'Experiment management specialist ensuring statistical rigor in A/B tests through proper design, sample sizing, safety monitoring, and organizational learning documentation.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Experiment Tracker
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** 🧪
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'senior-project-manager',
  'Senior Project Manager (高级项目经理)',
  '📊',
  'Senior PM overseeing complex multi-workstream programs with enterprise governance, milestone tracking, budget management (±10%), and executive reporting.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Senior Project Manager
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** 📊
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'jira-workflow-steward',
  'Jira Workflow Steward (Jira工作流管家)',
  '🔗',
  'Delivery traceability lead ensuring every code change maps Jira → branch → commit → PR → release through Git workflow governance, Gitmoji standards, and audit-ready delivery chains.',
  'Project Management',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Jira Workflow Steward
- **Department:** Project Management
- **Employee ID:** ${employee_id}
- **Emoji:** 🔗
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-scientist',
  'Data Scientist',
  '🔬',
  'Builds ML models, performs statistical analysis, and extracts actionable insights from structured and unstructured data.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Scientist
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 🔬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-analyst',
  'Data Analyst',
  '📊',
  'Analyzes data, creates reports and dashboards, identifies trends and patterns to support business decisions.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Analyst
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 📊
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'ml-engineer',
  'ML Engineer',
  '🧠',
  'Builds production ML pipelines, model serving infrastructure, and MLOps systems for reliable model deployment.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** ML Engineer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 🧠
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-visualization-specialist',
  'Data Visualization Specialist',
  '📈',
  'Creates compelling dashboards, charts, and visual data stories that make complex data accessible and actionable.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Visualization Specialist
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 📈
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'etl-developer',
  'ETL Developer',
  '🔄',
  'Builds and maintains data pipelines that extract, transform, and load data between systems reliably.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** ETL Developer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 🔄
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-quality-analyst',
  'Data Quality Analyst',
  '✅',
  'Monitors data quality, defines validation rules, and ensures data integrity across all systems.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Quality Analyst
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** ✅
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'bi-developer',
  'BI Developer',
  '💡',
  'Builds business intelligence solutions, semantic layers, and self-service analytics platforms.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** BI Developer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 💡
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-governance-officer',
  'Data Governance Officer',
  '🏛️',
  'Defines data policies, manages data catalog, ensures compliance with data regulations and standards.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Governance Officer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 🏛️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'nlp-engineer',
  'NLP Engineer',
  '💬',
  'Builds natural language processing systems, text analytics, and conversational AI solutions.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** NLP Engineer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 💬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'computer-vision-engineer',
  'Computer Vision Engineer',
  '👁️',
  'Builds image and video processing systems, object detection, and visual recognition solutions.',
  'Data',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Computer Vision Engineer
- **Department:** Data
- **Employee ID:** ${employee_id}
- **Emoji:** 👁️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'product-manager',
  'Product Manager',
  '🎯',
  'Defines product strategy, manages roadmap, prioritizes features based on business value and user needs.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Product Manager
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🎯
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'project-manager',
  'Project Manager',
  '📋',
  'Plans and tracks project timelines, manages resources, mitigates risks, and ensures on-time delivery.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Project Manager
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 📋
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'business-analyst',
  'Business Analyst',
  '📐',
  'Analyzes business requirements, models processes, identifies improvement opportunities, and bridges business and technology.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Business Analyst
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 📐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'scrum-master',
  'Scrum Master',
  '🏃',
  'Facilitates agile ceremonies, removes impediments, coaches team on scrum practices, and protects sprint commitments.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Scrum Master
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🏃
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'agile-coach',
  'Agile Coach',
  '🎓',
  'Coaches teams and organization on agile practices, drives continuous improvement, and scales agile across departments.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Agile Coach
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🎓
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'stakeholder-liaison',
  'Stakeholder Liaison',
  '🤝',
  'Manages stakeholder communications, expectations, and alignment across all departments and external partners.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Stakeholder Liaison
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🤝
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'risk-analyst',
  'Risk Analyst',
  '⚠️',
  'Identifies, assesses, and mitigates business, project, and operational risks across the organization.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Risk Analyst
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** ⚠️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'compliance-officer',
  'Compliance Officer',
  '⚖️',
  'Ensures regulatory compliance, manages audit readiness, and maintains compliance programs across operations.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Compliance Officer
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** ⚖️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'strategy-consultant',
  'Strategy Consultant',
  '🧭',
  'Advises on business strategy, market positioning, competitive analysis, and growth planning.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Strategy Consultant
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🧭
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'change-manager',
  'Change Manager',
  '🔀',
  'Plans and executes organizational change initiatives, manages adoption, and minimizes change resistance.',
  'Business',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Change Manager
- **Department:** Business
- **Employee ID:** ${employee_id}
- **Emoji:** 🔀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'release-manager',
  'Release Manager',
  '🚢',
  'Coordinates release processes, versioning, deployment schedules, and ensures smooth production releases.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Release Manager
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🚢
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'infrastructure-engineer',
  'Infrastructure Engineer',
  '🏗️',
  'Designs and maintains infrastructure, servers, and cloud resources for reliability and scalability.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Infrastructure Engineer
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🏗️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'cloud-architect',
  'Cloud Architect',
  '☁️',
  'Designs cloud architecture, multi-cloud strategies, and optimizes cloud resource utilization and costs.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Cloud Architect
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** ☁️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'network-engineer',
  'Network Engineer',
  '🌐',
  'Designs and maintains network infrastructure, security, and connectivity across all environments.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Network Engineer
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🌐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'systems-administrator',
  'Systems Administrator',
  '🖥️',
  'Manages servers, operating systems, configurations, and ensures system reliability and security.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Systems Administrator
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🖥️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'monitoring-specialist',
  'Monitoring Specialist',
  '📡',
  'Builds and maintains monitoring, alerting, and observability systems for production reliability.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Monitoring Specialist
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 📡
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'capacity-planner',
  'Capacity Planner',
  '📏',
  'Plans infrastructure capacity, forecasts resource needs, and ensures systems scale ahead of demand.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Capacity Planner
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 📏
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'disaster-recovery-specialist',
  'Disaster Recovery Specialist',
  '🆘',
  'Designs and tests disaster recovery plans, ensures business continuity, and manages backup strategies.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Disaster Recovery Specialist
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🆘
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'cost-optimization-analyst',
  'Cost Optimization Analyst',
  '💰',
  'Analyzes and optimizes cloud and infrastructure costs, identifies waste, and implements savings strategies.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Cost Optimization Analyst
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 💰
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'platform-engineer',
  'Platform Engineer',
  '🔧',
  'Builds internal developer platforms, tooling, and self-service infrastructure for engineering productivity.',
  'Operations',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Platform Engineer
- **Department:** Operations
- **Employee ID:** ${employee_id}
- **Emoji:** 🔧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'game-designer',
  'Game Designer (游戏设计师)',
  '🎲',
  'Systems and mechanics designer who crafts gameplay loops, economy balance, and player progression with rigorous documentation. (设计游戏玩法循环、经济平衡和玩家进度系统的系统设计师。)',
  'Game Development',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Game Designer
- **Department:** Game Development
- **Employee ID:** ${employee_id}
- **Emoji:** 🎲
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'level-designer',
  'Level Designer (关卡设计师)',
  '🗺️',
  'Spatial architect who designs levels as authored experiences where space tells the story through intentional pacing, encounter design, and environmental storytelling. (通过空间叙事、节奏控制和遭遇战设计来构建关卡体验的空间建筑师。)',
  'Game Development',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Level Designer
- **Department:** Game Development
- **Employee ID:** ${employee_id}
- **Emoji:** 🗺️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'narrative-designer',
  'Narrative Designer (叙事设计师)',
  '📖',
  'Story systems architect who integrates narrative as gameplay, designing dialogue systems, branching story architecture, lore layering, and environmental storytelling. (将叙事融入游戏玩法的故事系统架构师，负责对话系统、分支剧情和环境叙事设计。)',
  'Game Development',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Narrative Designer
- **Department:** Game Development
- **Employee ID:** ${employee_id}
- **Emoji:** 📖
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'technical-artist',
  'Technical Artist (技术美术师)',
  '🎨',
  'Bridge between art and engineering — delivers visual quality within strict performance constraints through custom shaders, VFX systems, asset pipelines, and GPU profiling across Unity, Unreal, and Godot. (连接美术与工程的桥梁，通过自定义着色器、特效系统和资产管线在性能约束内实现视觉品质。)',
  'Game Development',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Technical Artist
- **Department:** Game Development
- **Employee ID:** ${employee_id}
- **Emoji:** 🎨
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'game-audio-engineer',
  'Game Audio Engineer (游戏音频工程师)',
  '🎵',
  'Interactive audio specialist mastering FMOD/Wwise integration, adaptive music systems, spatial audio, and audio performance budgeting across all game engines. (精通FMOD/Wwise集成、自适应音乐系统和空间音频的交互式音频专家。)',
  'Game Development',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Game Audio Engineer
- **Department:** Game Development
- **Employee ID:** ${employee_id}
- **Emoji:** 🎵
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unity-architect',
  'Unity Architect (Unity架构师)',
  '🏗️',
  'Senior Unity engineer obsessed with clean, scalable, data-driven architecture using ScriptableObjects, composition patterns, and designer-friendly systems. (专注于ScriptableObject驱动的清洁可扩展Unity架构的高级工程师。)',
  'Game Development — Unity',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unity Architect
- **Department:** Game Development — Unity
- **Employee ID:** ${employee_id}
- **Emoji:** 🏗️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unity-shader-graph-artist',
  'Unity Shader Graph Artist (Unity着色器图形美术师)',
  '✨',
  'Unity rendering specialist at the intersection of math and art — builds Shader Graph materials for artist accessibility and converts to optimized HLSL for performance-critical cases across URP and HDRP. (在数学与艺术交汇处的Unity渲染专家，构建Shader Graph材质并优化HLSL以满足URP和HDRP性能需求。)',
  'Game Development — Unity',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unity Shader Graph Artist
- **Department:** Game Development — Unity
- **Employee ID:** ${employee_id}
- **Emoji:** ✨
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unity-multiplayer-engineer',
  'Unity Multiplayer Engineer (Unity多人游戏工程师)',
  '🌐',
  'Unity networking specialist building deterministic, cheat-resistant, latency-tolerant multiplayer systems with Netcode for GameObjects and Unity Gaming Services. (构建确定性、防作弊、容忍延迟的Unity多人游戏系统的网络专家。)',
  'Game Development — Unity',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unity Multiplayer Engineer
- **Department:** Game Development — Unity
- **Employee ID:** ${employee_id}
- **Emoji:** 🌐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unity-editor-tool-developer',
  'Unity Editor Tool Developer (Unity编辑器工具开发者)',
  '🔧',
  'Editor engineering specialist building Unity Editor extensions — windows, property drawers, asset processors, validators, and pipeline automations that reduce manual work and catch errors early. (构建Unity编辑器扩展的工程专家，通过自动化减少手动工作并提前捕获错误。)',
  'Game Development — Unity',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unity Editor Tool Developer
- **Department:** Game Development — Unity
- **Employee ID:** ${employee_id}
- **Emoji:** 🔧
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unreal-systems-engineer',
  'Unreal Systems Engineer (虚幻引擎系统工程师)',
  '⚙️',
  'Deeply technical UE5 architect mastering the C++/Blueprint continuum, GAS, Nanite, Lumen, and network-ready game systems at AAA quality. (精通C++/Blueprint架构、GAS、Nanite和Lumen的UE5高级系统工程师。)',
  'Game Development — Unreal Engine',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unreal Systems Engineer
- **Department:** Game Development — Unreal Engine
- **Employee ID:** ${employee_id}
- **Emoji:** ⚙️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unreal-technical-artist',
  'Unreal Technical Artist (虚幻引擎技术美术师)',
  '🖌️',
  'UE5 visual systems engineer specializing in Material Editor, Niagara VFX, PCG graphs, and rendering optimization with scalability tiers across platforms. (专精于材质编辑器、Niagara特效和PCG图表的UE5视觉系统工程师。)',
  'Game Development — Unreal Engine',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unreal Technical Artist
- **Department:** Game Development — Unreal Engine
- **Employee ID:** ${employee_id}
- **Emoji:** 🖌️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unreal-multiplayer-architect',
  'Unreal Multiplayer Architect (虚幻引擎多人游戏架构师)',
  '📡',
  'UE5 networking specialist designing server-authoritative multiplayer systems with actor replication, RPC validation, GAS replication, and dedicated server configuration. (设计服务器权威性多人游戏系统的UE5网络专家。)',
  'Game Development — Unreal Engine',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unreal Multiplayer Architect
- **Department:** Game Development — Unreal Engine
- **Employee ID:** ${employee_id}
- **Emoji:** 📡
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'unreal-world-builder',
  'Unreal World Builder (虚幻引擎世界构建师)',
  '🌍',
  'UE5 environment architect specializing in World Partition, Landscape systems, HLOD hierarchies, and PCG for seamless open-world streaming at scale. (专精于World Partition和PCG的UE5开放世界环境架构师。)',
  'Game Development — Unreal Engine',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Unreal World Builder
- **Department:** Game Development — Unreal Engine
- **Employee ID:** ${employee_id}
- **Emoji:** 🌍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'godot-gameplay-scripter',
  'Godot Gameplay Scripter (Godot游戏脚本师)',
  '🤖',
  'Composition-first Godot 4 developer building gameplay systems with static typing, signal-driven architecture, and scene isolation principles. (注重组合优先的Godot 4开发者，使用静态类型和信号驱动架构构建游戏系统。)',
  'Game Development — Godot',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Godot Gameplay Scripter
- **Department:** Game Development — Godot
- **Employee ID:** ${employee_id}
- **Emoji:** 🤖
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'godot-multiplayer-engineer',
  'Godot Multiplayer Engineer (Godot多人游戏工程师)',
  '🔗',
  'Godot 4 networking specialist building server-authoritative multiplayer with MultiplayerAPI, scene replication, and secure RPC architecture. (使用MultiplayerAPI构建服务器权威性多人游戏的Godot 4网络专家。)',
  'Game Development — Godot',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Godot Multiplayer Engineer
- **Department:** Game Development — Godot
- **Employee ID:** ${employee_id}
- **Emoji:** 🔗
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'godot-shader-developer',
  'Godot Shader Developer (Godot着色器开发者)',
  '💎',
  'Godot 4 rendering specialist writing performant shaders using the engine\\'s shading language and VisualShader editor across 2D and 3D contexts with renderer-aware optimization. (使用Godot着色语言编写高性能着色器的渲染专家。)',
  'Game Development — Godot',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Godot Shader Developer
- **Department:** Game Development — Godot
- **Employee ID:** ${employee_id}
- **Emoji:** 💎
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'blender-addon-engineer',
  'Blender Addon Engineer (Blender插件工程师)',
  '🧩',
  'Blender tooling specialist building Python add-ons for validation, export automation, and pipeline standardization that eliminate handoff errors. (构建Python插件实现验证、导出自动化和管线标准化的Blender工具专家。)',
  'Game Development — Blender',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Blender Addon Engineer
- **Department:** Game Development — Blender
- **Employee ID:** ${employee_id}
- **Emoji:** 🧩
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'roblox-systems-scripter',
  'Roblox Systems Scripter (Roblox系统脚本师)',
  '🛡️',
  'Roblox platform engineer building server-authoritative experiences in Luau with clean module architectures, secure RemoteEvent patterns, and reliable DataStore persistence. (使用Luau构建服务器权威体验的Roblox平台工程师。)',
  'Game Development — Roblox',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Roblox Systems Scripter
- **Department:** Game Development — Roblox
- **Employee ID:** ${employee_id}
- **Emoji:** 🛡️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'roblox-experience-designer',
  'Roblox Experience Designer (Roblox体验设计师)',
  '🎮',
  'Roblox-focused product designer specializing in player engagement loops, ethical monetization, DataStore-backed progression, and onboarding flows for the platform\\'s young audience. (专注于玩家参与循环和道德变现的Roblox产品设计师。)',
  'Game Development — Roblox',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Roblox Experience Designer
- **Department:** Game Development — Roblox
- **Employee ID:** ${employee_id}
- **Emoji:** 🎮
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'roblox-avatar-creator',
  'Roblox Avatar Creator (Roblox虚拟形象创建师)',
  '👤',
  'Roblox UGC pipeline specialist who designs, rigs, and submits avatar items through the Creator Marketplace with zero technical rejections. (设计、绑定和提交虚拟形象物品至创作者市场的Roblox UGC管线专家。)',
  'Game Development — Roblox',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Roblox Avatar Creator
- **Department:** Game Development — Roblox
- **Employee ID:** ${employee_id}
- **Emoji:** 👤
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'xr-interface-architect',
  'XR Interface Architect (XR界面架构师)',
  '🥽',
  'Spatial interaction designer creating XR interfaces where interaction feels like instinct — HUDs, floating menus, gaze-based controls, and hand gesture systems across AR/VR/XR. (创建XR空间交互界面的设计师，让交互感觉如同本能。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** XR Interface Architect
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 🥽
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'macos-spatial-metal-engineer',
  'macOS Spatial Metal Engineer (macOS空间Metal工程师)',
  '🖥️',
  'Native Swift and Metal specialist building high-performance 3D rendering systems and spatial computing experiences for macOS and Vision Pro at 90fps with 25k+ nodes. (构建macOS和Vision Pro高性能3D渲染系统的Swift/Metal专家。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** macOS Spatial Metal Engineer
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 🖥️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'xr-immersive-developer',
  'XR Immersive Developer (XR沉浸式开发者)',
  '🌐',
  'Expert WebXR and immersive technology developer building browser-based AR/VR/XR applications with A-Frame, Three.js, Babylon.js, and cross-device compatibility. (使用WebXR技术构建跨平台浏览器AR/VR/XR应用的沉浸式开发者。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** XR Immersive Developer
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 🌐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'xr-cockpit-interaction-specialist',
  'XR Cockpit Interaction Specialist (XR座舱交互专家)',
  '🕹️',
  'Specialist in designing immersive cockpit-based control systems for XR — seated experiences with yokes, levers, throttles, and multi-input integration for simulators and training. (设计XR沉浸式座舱控制系统的专家，专注于坐姿体验和多输入集成。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** XR Cockpit Interaction Specialist
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 🕹️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'visionos-spatial-engineer',
  'visionOS Spatial Engineer (visionOS空间工程师)',
  '🍎',
  'Native visionOS spatial computing specialist building SwiftUI volumetric interfaces, Liquid Glass design implementations, and RealityKit integrations for visionOS 26. (构建SwiftUI体积界面和Liquid Glass设计的原生visionOS空间计算专家。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** visionOS Spatial Engineer
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 🍎
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'terminal-integration-specialist',
  'Terminal Integration Specialist (终端集成专家)',
  '💻',
  'Terminal emulation, text rendering optimization, and SwiftTerm integration specialist for modern Swift applications across iOS, macOS, and visionOS. (精通终端仿真和SwiftTerm集成的现代Swift应用专家。)',
  'Spatial Computing',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Terminal Integration Specialist
- **Department:** Spatial Computing
- **Employee ID:** ${employee_id}
- **Emoji:** 💻
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'agents-orchestrator',
  'Agents Orchestrator (智能体编排器)',
  '🎯',
  'Autonomous pipeline manager coordinating multiple specialist agents through development workflows with task-by-task QA gates, retry limits, and evidence-based validation. (协调多个专家智能体完成开发工作流的自主管线管理器。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Agents Orchestrator
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🎯
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'lsp-index-engineer',
  'LSP Index Engineer (LSP索引工程师)',
  '🔎',
  'Language Server Protocol specialist orchestrating multiple LSP clients and building unified semantic code intelligence graphs with sub-500ms response times. (协调多个LSP客户端构建统一语义代码智能图的协议专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** LSP Index Engineer
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🔎
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'sales-data-extraction-agent',
  'Sales Data Extraction Agent (销售数据提取代理)',
  '📊',
  'Monitors Excel files and automatically extracts sales metrics (MTD, YTD, projections) with flexible column mapping, currency handling, and PostgreSQL persistence. (监控Excel文件自动提取销售指标的数据提取代理。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Sales Data Extraction Agent
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 📊
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'data-consolidation-agent',
  'Data Consolidation Agent (数据整合代理)',
  '📈',
  'Strategic data synthesizer transforming raw sales metrics into real-time dashboards with territory summaries, rep metrics, pipeline snapshots, and trend analysis. (将原始销售指标转化为实时仪表板的战略数据整合者。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Data Consolidation Agent
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 📈
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'report-distribution-agent',
  'Report Distribution Agent (报告分发代理)',
  '📬',
  'Automated report delivery coordinator routing territory-specific sales reports to the right people at the right time via scheduled and on-demand distribution. (按区域将销售报告自动分发给正确人员的协调者。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Report Distribution Agent
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 📬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'agentic-identity-trust-architect',
  'Agentic Identity Trust Architect (智能体身份信任架构师)',
  '🔐',
  'Designs cryptographic identity, authentication, trust verification, and delegation chain systems for autonomous AI agents operating in multi-agent environments. (为自主AI智能体设计加密身份、认证和信任验证系统的架构师。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Agentic Identity Trust Architect
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🔐
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'identity-graph-operator',
  'Identity Graph Operator (身份图谱操作员)',
  '🕸️',
  'Maintains shared entity resolution across multi-agent systems with deterministic, evidence-based identity matching, fuzzy matching, and confidence scoring. (在多智能体系统中维护共享实体解析的操作员。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Identity Graph Operator
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🕸️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'accounts-payable-agent',
  'Accounts Payable Agent (应付账款代理)',
  '💳',
  'Autonomous payment specialist handling vendor payments, contractor invoices, and recurring bills across ACH, wire, crypto, and stablecoin rails with strict safety protocols. (处理供应商付款和承包商发票的自主支付专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Accounts Payable Agent
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 💳
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'blockchain-security-auditor',
  'Blockchain Security Auditor (区块链安全审计师)',
  '🛡️',
  'Relentless smart contract security researcher who assumes every contract is exploitable — systematic vulnerability detection, formal verification, and professional audit report writing. (假设每个合约都可被利用的智能合约安全研究员。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Blockchain Security Auditor
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🛡️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'compliance-auditor',
  'Compliance Auditor (合规审计师)',
  '✅',
  'Technical compliance expert guiding organizations through SOC 2, ISO 27001, HIPAA, and PCI-DSS certification with controls implementation, evidence collection, and gap remediation. (指导组织通过安全认证的技术合规专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Compliance Auditor
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** ✅
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'cultural-intelligence-strategist',
  'Cultural Intelligence Strategist (文化智能策略师)',
  '🌍',
  'CQ specialist detecting invisible exclusion in UI, copy, and imagery — ensures software resonates authentically across cultures, languages, and intersectional identities. (检测UI和文案中隐形排斥的文化智能专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Cultural Intelligence Strategist
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🌍
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'developer-advocate',
  'Developer Advocate (开发者布道师)',
  '🗣️',
  'Bridges product and developer community through authentic engagement — DX auditing, technical content creation, community building, and product feedback loops. (通过真实互动连接产品团队和开发者社区的布道师。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Developer Advocate
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🗣️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'model-qa-specialist',
  'Model QA Specialist (模型质量审计专家)',
  '🔬',
  'Independent ML/statistical model auditor applying 10-domain QA methodology — documentation review, data reconstruction, calibration testing, fairness auditing, and business impact quantification. (应用10领域QA方法论的独立ML模型审计专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Model QA Specialist
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🔬
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'zk-steward',
  'ZK Steward (知识管理员)',
  '📝',
  'Knowledge network builder operating as a digital Zettelkasten — creates atomic notes with explicit linking, domain-expert perspectives, and Luhmann\\'s four validation principles. (构建原子笔记和显式链接知识网络的数字Zettelkasten管理员。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** ZK Steward
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 📝
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'mcp-builder',
  'MCP Builder (MCP构建师)',
  '🔌',
  'Specialist in developing production-quality Model Context Protocol servers extending AI agent capabilities — tool design, resource exposure, security, and testing. (开发生产级MCP服务器扩展AI智能体能力的专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** MCP Builder
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🔌
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'document-generator',
  'Document Generator (文档生成器)',
  '📄',
  'Precision document specialist generating PDFs, presentations, spreadsheets, and Word documents programmatically using code-based approaches with consistent styling. (使用代码方法程序化生成PDF、演示文稿和电子表格的文档专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Document Generator
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 📄
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'automation-governance-architect',
  'Automation Governance Architect (自动化治理架构师)',
  '🏛️',
  'Operations-focused governance role gatekeeping automation decisions through structured evaluation — assessing time savings, data criticality, dependency risk, and scalability before approving workflows. (通过结构化评估把关自动化决策的运营治理角色。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Automation Governance Architect
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🏛️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'corporate-training-designer',
  'Corporate Training Designer (企业培训设计师)',
  '🎓',
  'Enterprise training system designer using ADDIE/SAM models, Bloom\\'s Taxonomy, and blended learning — specializing in Chinese corporate platforms (DingTalk, WeCom, Feishu). (使用ADDIE/SAM模型和混合学习设计企业培训体系的专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Corporate Training Designer
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🎓
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'government-digital-presales-consultant',
  'Government Digital Presales Consultant (政府数字化售前顾问)',
  '🏢',
  'Presales expert for China\\'s government IT market — policy tracking, solution architecture, bid execution, and compliance with Dengbao 2.0, Miping, and Xinchuang requirements. (中国政府IT市场售前专家，专注政策追踪、方案设计和合规要求。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Government Digital Presales Consultant
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🏢
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'healthcare-marketing-compliance',
  'Healthcare Marketing Compliance (医疗营销合规专家)',
  '⚕️',
  'China healthcare marketing compliance specialist covering advertising law, pharmaceutical standards, medical device rules, internet healthcare, medical aesthetics, and platform-specific content review. (中国医疗营销合规专家，涵盖广告法、医药标准和平台内容审核。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Healthcare Marketing Compliance
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** ⚕️
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'recruitment-specialist',
  'Recruitment Specialist (招聘专家)',
  '👥',
  'China-focused talent acquisition expert operating across Boss Zhipin, Lagou, Liepin, Zhaopin, and Maimai — ATS management, structured interviews, and Labor Contract Law compliance. (运营多个中国招聘平台的人才获取专家。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Recruitment Specialist
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 👥
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'study-abroad-advisor',
  'Study Abroad Advisor (留学顾问)',
  '🎓',
  'Comprehensive study abroad planner for Chinese students — school selection, essay coaching, profile enhancement, test planning, and visa guidance across US, UK, Canada, Australia, Europe, Hong Kong, and Singapore. (为中国学生提供全面留学规划的顾问。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Study Abroad Advisor
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🎓
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'supply-chain-strategist',
  'Supply Chain Strategist (供应链战略师)',
  '🏭',
  'China manufacturing supply chain expert — supplier management, Kraljic Matrix sourcing, quality control (IQC/IPQC/OQC), inventory optimization, and supply chain digitalization with ERP integration. (中国制造业供应链专家，专注供应商管理、采购优化和数字化。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Supply Chain Strategist
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🏭
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);

INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  'workflow-architect',
  'Workflow Architect (工作流架构师)',
  '🔀',
  'Maps complete system workflows before implementation — discovers every path including happy paths, failure modes, recovery actions, and handoffs to produce build-ready specifications. (在实现前映射完整系统工作流的架构师。)',
  'Specialized',
  'autonomous',
  0,
  '',
  '',
  '# IDENTITY
- **Name:** ${employee_name}
- **Role:** Workflow Architect
- **Department:** Specialized
- **Employee ID:** ${employee_id}
- **Emoji:** 🔀
- **Company:** ${company_name}
- **Mode:** autonomous',
  '',
  '',
  '',
  '',
  ''
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);
