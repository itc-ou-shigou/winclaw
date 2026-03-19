const fs = require('fs');
const path = require('path');

const SKILLS = [
  { dir: 'data-analysis', name: 'data-analysis', desc: 'SQL queries, statistical analysis, dashboard generation, anomaly detection', tags: 'data, analytics, reporting', cmds: '/analyze-data, /generate-dashboard, /detect-anomalies, /query-data' },
  { dir: 'content-generation', name: 'content-generation', desc: 'Blog posts, social media, email newsletters, press releases, case studies', tags: 'content, marketing, writing', cmds: '/draft-content, /generate-variants, /localize-content' },
  { dir: 'web-research', name: 'web-research', desc: 'Competitive intelligence, market research, trend analysis, fact-checking', tags: 'research, intelligence, web', cmds: '/research-topic, /competitive-analysis, /trend-scan' },
  { dir: 'document-generation', name: 'document-generation', desc: 'Proposals, SOWs, reports, presentations, contracts from templates', tags: 'documents, templates, reports', cmds: '/generate-doc, /fill-template, /create-presentation' },
  { dir: 'code-analysis', name: 'code-analysis', desc: 'Static analysis, code review, dependency scanning, tech debt assessment', tags: 'code, engineering, quality', cmds: '/analyze-code, /review-pr, /scan-deps, /assess-debt' },
  { dir: 'seo', name: 'seo', desc: 'Keyword research, on-page optimization, technical SEO audit, rank tracking', tags: 'seo, marketing, search', cmds: '/seo-audit, /keyword-research, /optimize-page' },
  { dir: 'project-management', name: 'project-management', desc: 'Sprint planning, resource allocation, timeline management, risk tracking', tags: 'project, management, planning', cmds: '/plan-sprint, /track-progress, /assess-risks' },
  { dir: 'financial-analysis', name: 'financial-analysis', desc: 'Budget modeling, revenue forecasting, expense tracking, ROI calculation', tags: 'finance, analysis, budgeting', cmds: '/forecast-revenue, /analyze-budget, /calculate-roi' },
  { dir: 'security-audit', name: 'security-audit', desc: 'Vulnerability scanning, penetration testing, compliance checking, threat modeling', tags: 'security, audit, compliance', cmds: '/scan-vulnerabilities, /check-compliance, /model-threats' },
  { dir: 'performance-testing', name: 'performance-testing', desc: 'Load testing, stress testing, performance benchmarking, bottleneck identification', tags: 'performance, testing, engineering', cmds: '/load-test, /benchmark, /find-bottlenecks' },
  { dir: 'user-research', name: 'user-research', desc: 'Survey design, interview analysis, persona creation, journey mapping', tags: 'ux, research, product', cmds: '/create-survey, /analyze-interviews, /build-persona' },
  { dir: 'api-testing', name: 'api-testing', desc: 'Endpoint testing, contract validation, integration testing, mock server generation', tags: 'api, testing, engineering', cmds: '/test-endpoint, /validate-contract, /generate-mocks' },
  { dir: 'cicd', name: 'cicd', desc: 'Pipeline configuration, deployment automation, environment management, rollback procedures', tags: 'cicd, devops, deployment', cmds: '/configure-pipeline, /deploy, /rollback' },
  { dir: 'social-media', name: 'social-media', desc: 'Post scheduling, engagement analytics, influencer identification, campaign management', tags: 'social, marketing, engagement', cmds: '/schedule-posts, /analyze-engagement, /find-influencers' },
  { dir: 'sales-pipeline', name: 'sales-pipeline', desc: 'Lead scoring, deal tracking, forecast modeling, conversion optimization', tags: 'sales, pipeline, crm', cmds: '/score-leads, /forecast-deals, /optimize-conversion' },
  { dir: 'design-system', name: 'design-system', desc: 'Component library management, style guide enforcement, design token management', tags: 'design, ui, components', cmds: '/audit-components, /check-consistency, /manage-tokens' },
  { dir: 'legal-compliance', name: 'legal-compliance', desc: 'Contract review, regulatory compliance checking, policy generation, risk assessment', tags: 'legal, compliance, risk', cmds: '/review-contract, /check-regulation, /generate-policy' },
  { dir: 'email-automation', name: 'email-automation', desc: 'Campaign creation, A/B testing, segmentation, deliverability optimization', tags: 'email, automation, marketing', cmds: '/create-campaign, /ab-test, /optimize-deliverability' },
  { dir: 'video-production', name: 'video-production', desc: 'Script writing, storyboarding, editing workflows, subtitle generation', tags: 'video, production, creative', cmds: '/write-script, /create-storyboard, /generate-subtitles' },
  { dir: 'cloud-infra', name: 'cloud-infra', desc: 'IaC templates, cost optimization, capacity planning, multi-cloud management', tags: 'cloud, infrastructure, devops', cmds: '/generate-iac, /optimize-costs, /plan-capacity' },
  { dir: 'mlops', name: 'mlops', desc: 'Model training pipelines, experiment tracking, model serving, data versioning', tags: 'ml, ai, mlops', cmds: '/train-model, /track-experiment, /deploy-model' },
  { dir: 'paid-ads', name: 'paid-ads', desc: 'Ad copy generation, bid optimization, audience targeting, ROAS analysis', tags: 'ads, marketing, ppc', cmds: '/generate-ad-copy, /optimize-bids, /analyze-roas' },
  { dir: 'workflow-automation', name: 'workflow-automation', desc: 'Process mapping, automation rule creation, integration orchestration', tags: 'automation, workflow, integration', cmds: '/map-process, /create-automation, /orchestrate' },
  { dir: 'database-admin', name: 'database-admin', desc: 'Query optimization, index management, backup procedures, migration planning', tags: 'database, admin, sql', cmds: '/optimize-query, /manage-indexes, /plan-migration' },
  { dir: 'accessibility', name: 'accessibility', desc: 'WCAG audit, screen reader testing, color contrast checking, ARIA validation', tags: 'accessibility, a11y, ux', cmds: '/audit-wcag, /check-contrast, /validate-aria' },
  { dir: 'blockchain', name: 'blockchain', desc: 'Smart contract auditing, gas optimization, DeFi protocol analysis', tags: 'blockchain, web3, smart-contracts', cmds: '/audit-contract, /optimize-gas, /analyze-protocol' },
  { dir: 'spatial-computing', name: 'spatial-computing', desc: 'AR/VR scene setup, 3D asset optimization, spatial interaction design', tags: 'ar, vr, spatial, 3d', cmds: '/setup-scene, /optimize-3d, /design-interaction' },
  { dir: 'game-engine', name: 'game-engine', desc: 'Game logic scripting, physics configuration, asset pipeline management', tags: 'game, engine, unity, unreal', cmds: '/script-logic, /configure-physics, /manage-assets' },
];

const skillsDir = path.resolve(__dirname, '..', 'skills');

for (const s of SKILLS) {
  const dir = path.join(skillsDir, s.dir);

  // SKILL.md
  const skillMd = `---
name: ${s.name}
description: ${s.desc}
tags: [${s.tags}]
---

# ${s.name}

${s.desc}

## Commands
${s.cmds.split(', ').map(c => `- \`${c}\``).join('\n')}
`;

  // index.js
  const indexJs = `// Skill: ${s.name}
// Stub — implement tool handlers here
module.exports = {
  name: "${s.name}",
  version: "0.1.0",
};
`;

  fs.writeFileSync(path.join(dir, 'SKILL.md'), skillMd, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.js'), indexJs, 'utf8');
  console.log(`Created: skills/${s.dir}/`);
}

console.log(`\nDone: ${SKILLS.length} skills created.`);
