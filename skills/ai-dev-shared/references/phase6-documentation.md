# Phase 6: Documentation Generation Reference

## Overview

Phase 6 generates 5 Markdown documents and converts them to multi-language PDFs.

## Step 1: Generate 5 MD Documents

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read all project files. Generate a comprehensive USER MANUAL in Markdown. Save to docs/user-manual.md. Include: Introduction, Installation Guide, User Guide with features, FAQ, Troubleshooting.'"

bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read backend/, frontend/, database/. Generate a TECHNICAL GUIDE. Save to docs/technical-guide.md. Include: Architecture Overview, Technology Stack, Backend API, Database Schema, Frontend Structure, Development Guide, Testing Guide.'"

bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read backend/app/api/ and schemas/. Generate API DOCUMENTATION. Save to docs/api-documentation.md. Include: API Overview, All Endpoints with methods/paths/examples, Authentication, Error Responses, cURL examples.'"

bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read project structure and .env.example. Generate DEPLOYMENT GUIDE. Save to docs/deployment-guide.md. Include: Prerequisites, Environment Variables, Database Setup, Backend Deployment, Frontend Deployment, Production Checklist.'"

bash pty:true workdir:$AIDEV_WORKSPACE timeout:600 command:"claude --dangerously-skip-permissions -p 'Read database/schema.sql and backend/app/models/. Generate DATABASE SCHEMA DOCUMENTATION. Save to docs/database-schema.md. Include: Database Overview, All Tables with columns/types/constraints, Relationships, Sample Queries.'"
```

## Step 2: Multi-Language PDF Generation

Target language from `AIDEV_DOC_LANGUAGE` (default: `ja`).

Language mapping: `en` English, `ja` Japanese, `zh-CN` Simplified Chinese, `zh-TW` Traditional Chinese, `ko` Korean, `es` Spanish, `pt` Portuguese, `fr` French, `de` German

```bash
bash pty:true workdir:$AIDEV_WORKSPACE timeout:1800 command:"claude --dangerously-skip-permissions -p 'Read all MD files in docs/. Translate each to ${AIDEV_DOC_LANGUAGE}. Save translated MD to docs/pdfs/. Then convert MD to PDF using available tools (pandoc, weasyprint, or python-pdfkit).'"
```

## Skip Condition

Phase 6 is skipped if `docs/` already contains MD files (resume case).
PDF generation runs regardless if PDFs for the target language don't exist yet.

## Output Files

```
docs/
├── user-manual.md
├── technical-guide.md
├── api-documentation.md
├── deployment-guide.md
├── database-schema.md
└── pdfs/
    ├── user-manual_ja.pdf
    ├── technical-guide_ja.pdf
    ├── api-documentation_ja.pdf
    ├── deployment-guide_ja.pdf
    └── database-schema_ja.pdf
```
