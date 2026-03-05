---
name: blog-publisher
description: Publish blog posts and articles to multiple platforms (Qiita, CSDN, Blogger, Hatena Blog, Dev.to, Medium, Zenn, Note.com) using Claude in Chrome. Given a topic or draft content, generates platform-optimized articles in the specified language and publishes them via browser automation. Supports Japanese, Chinese, and English. Use when user wants to write and publish blog posts or promotional articles.
metadata: { "winclaw": { "emoji": "📝", "requires": { "mcpServers": ["Claude in Chrome"] } } }
---

# Blog Publisher

Publish blog posts to multiple platforms via Claude in Chrome browser automation.

## Prerequisites

- **Claude in Chrome** extension installed and connected
- User must be **logged in** to target platforms before invoking this skill
- Target platform tabs should be accessible (not blocked by extension safety rules)

## Supported Platforms

| Platform | Language | Editor Type | Post URL |
|----------|----------|-------------|----------|
| Qiita | Japanese | CodeMirror 6 (contenteditable `.cm-content`) | `https://qiita.com/drafts/new` |
| CSDN | Chinese | cledit (`pre.editor__inner` contenteditable) | `https://editor.csdn.net/md` |
| Blogger | Japanese/Any | iframe + HTML textarea | `https://www.blogger.com/blog/posts/<blogId>` |
| Hatena Blog | Japanese | textarea | Dashboard → New post |
| Dev.to | English | textarea/markdown | `https://dev.to/new` |
| Zenn | Japanese | textarea/markdown | `https://zenn.dev/articles/new` |
| Note.com | Japanese | contenteditable | `https://note.com/new` |
| Medium | English | contenteditable ProseMirror | `https://medium.com/new-story` |

## Workflow

### Step 1: Determine task parameters

Ask or infer from context:

1. **Topic / Content** — What to write about. Can be:
   - A topic string (e.g., "WinClaw AI testing feature")
   - A reference file path (e.g., `README.ja.md`)
   - An existing draft file (e.g., `promo/reddit-japanese.md`)
2. **Target platforms** — Which platforms to publish to
3. **Language** — Japanese (ja), Chinese (zh), English (en)
4. **Tone** — User perspective / technical tutorial / announcement / review
5. **Special instructions** — URL preferences, keywords, tags

### Step 2: Generate content

If content is not provided, generate a platform-appropriate blog post:

- **Title**: Attention-grabbing, include key terms, platform conventions (e.g., Qiita uses `【】` brackets)
- **Body**: Markdown format, structured with headers, code blocks, lists
- **Tags**: Platform-specific tags (Qiita: 5 tags max; CSDN: auto-detected)
- **Length**: 2000-6000 characters depending on platform

### Step 3: Publish via browser automation

Use the platform-specific editor guide below.

### Step 4: Verify publication

After publishing, confirm:
- Page navigated away from editor (to article view or post list)
- Title visible in published state
- URL of published article captured and returned to user

---

## Platform Editor Guides

### Qiita (`qiita.com`)

**Navigate to**: `https://qiita.com/drafts/new` (new) or `https://qiita.com/drafts/<id>/edit` (edit)

**Editor structure**:
- Title: `input[placeholder]` (first input on page)
- Tags: Tag input component — add via clicking tag input area and typing
- Content: CodeMirror 6 editor — `.cm-content` (contenteditable div)

**Insert content**:
```javascript
// 1. Set title
const titleInput = document.querySelector('input[placeholder]');
Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  .set.call(titleInput, 'Your Title');
titleInput.dispatchEvent(new Event('input', { bubbles: true }));

// 2. Add tags (click tag input, type tag name, press Enter for each)
// Use keyboard automation: find tag input, click, type, Enter

// 3. Set content — focus and use insertText
const cmContent = document.querySelector('.cm-content');
cmContent.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, markdownContent);
```

**Publish**:
```javascript
// Find and click the publish button
const buttons = Array.from(document.querySelectorAll('button'));
// For new post: "記事を投稿する"
// For edit: "記事を更新する"
const publishBtn = buttons.find(b =>
  b.textContent.includes('投稿する') || b.textContent.includes('更新する')
);
publishBtn.click();
```

**Tags interaction** (Qiita-specific):
```javascript
// Tags use a custom component. Type tag and press Enter:
// 1. Find the tag input area
const tagInputs = document.querySelectorAll('input');
// The tag input is typically the 2nd or 3rd input
// 2. Focus, type tag name, dispatch Enter key
```

---

### CSDN (`csdn.net`)

**Navigate to**: `https://editor.csdn.net/md` (new post)

**Editor structure**:
- Title: `input.article-bar__title` or `input[placeholder*="标题"]`
- Content: `pre.editor__inner` (contenteditable with cledit)

**Insert content**:
```javascript
// 1. Set title
const titleInput = document.querySelector('.article-bar__title')
  || document.querySelector('input[placeholder*="标题"]');
titleInput.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, 'Your Title');

// 2. Set content
const editor = document.querySelector('pre.editor__inner');
editor.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, markdownContent);
```

**Publish** (two-step):
```javascript
// Step 1: Click "发布文章" text/button to open publish modal
const publishTexts = document.querySelectorAll('p, span, button');
const openModalBtn = Array.from(publishTexts).find(el =>
  el.textContent.trim() === '发布文章'
);
openModalBtn.click();

// Step 2: Wait for modal, then click the red publish button
// After modal opens:
const modalPublishBtn = document.querySelector('.btn-b-red')
  || Array.from(document.querySelectorAll('button')).find(b =>
    b.textContent.includes('发布') && b.classList.contains('btn-b-red')
  );
modalPublishBtn.click();
```

---

### Blogger (`blogger.com`)

**Navigate to**: Go to blog posts page → Click "新しい投稿を作成" or "New post"

**Editor structure**:
- Title: Input with `aria-label="タイトル"` or `aria-label="Title"`
- Content: iframe-based editor (compose mode) or textarea (HTML mode)

**Set title**:
```javascript
const titleInput = document.querySelector('[aria-label="タイトル"]')
  || document.querySelector('[aria-label="Title"]');
titleInput.focus();
document.execCommand('insertText', false, 'Your Title');
```

**Switch to HTML mode** (recommended for markdown-converted HTML):
```javascript
// Find and click the HTML mode toggle button
const allBtns = Array.from(document.querySelectorAll('[role="button"]'));
const htmlBtn = allBtns.find(b =>
  b.textContent.includes('HTML') && b.textContent.includes('書式')
  || b.getAttribute('aria-label')?.includes('HTML')
);
htmlBtn?.click();
```

**Insert HTML content**:
```javascript
// After switching to HTML mode, find the textarea
const textarea = document.querySelector('textarea');
textarea.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, htmlContent);
```

**Publish** (two-step with confirmation dialog):
```javascript
// Step 1: Click "公開" button (role="button" div, not a <button>)
const allRoleBtns = document.querySelectorAll('[role="button"]');
const publishBtn = Array.from(allRoleBtns).find(b => {
  const spans = b.querySelectorAll('span.RveJvd');
  return Array.from(spans).some(s => s.textContent.trim() === '公開');
});
publishBtn.click();

// Step 2: Wait for confirmation dialog "投稿を公開しますか？"
// Then click "確定" button
const confirmBtn = Array.from(document.querySelectorAll('div[role="button"]')).find(b => {
  const spans = b.querySelectorAll('span.RveJvd');
  return Array.from(spans).some(s => s.textContent.trim() === '確定');
});
confirmBtn.click();
```

**Note**: Blogger uses Google Material Design components where buttons are `div[role="button"]` not `<button>`. Always search for `role="button"` elements.

---

### Hatena Blog (`hatenablog.com`)

**Navigate to**: Blog dashboard → New entry

**Editor structure**:
- Title: `input#title` or `input[name="title"]`
- Content: `textarea#body` (markdown mode) or contenteditable (WYSIWYG)

**Insert content**:
```javascript
const title = document.querySelector('#title, input[name="title"]');
title.value = 'Your Title';
title.dispatchEvent(new Event('input', { bubbles: true }));

const body = document.querySelector('#body, textarea[name="body"]');
body.focus();
document.execCommand('selectAll', false, null);
document.execCommand('insertText', false, markdownContent);
```

**Publish**:
```javascript
// Click "公開する" button
const publishBtn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
  .find(b => b.textContent?.includes('公開') || b.value?.includes('公開'));
publishBtn.click();
```

---

### Dev.to (`dev.to`)

**Navigate to**: `https://dev.to/new`

**Editor structure**:
- Title: `textarea#article-form-title` or `textarea[placeholder*="title"]`
- Tags: `input#tag-input`
- Content: `textarea#article_body_markdown`

**Insert content**:
```javascript
const title = document.querySelector('#article-form-title, textarea[placeholder*="title"]');
title.focus();
document.execCommand('insertText', false, 'Your Title');

const body = document.querySelector('#article_body_markdown');
body.focus();
document.execCommand('insertText', false, markdownContent);
```

**Publish**:
```javascript
// Click "Publish" button
const publishBtn = Array.from(document.querySelectorAll('button'))
  .find(b => b.textContent.trim() === 'Publish');
publishBtn.click();
```

---

### Zenn (`zenn.dev`)

**Navigate to**: `https://zenn.dev/articles/new`

**Editor structure**:
- Title: `input[placeholder*="タイトル"]`
- Content: `textarea` (main markdown editor)

**Insert content**:
```javascript
const title = document.querySelector('input[placeholder*="タイトル"]');
title.focus();
document.execCommand('insertText', false, 'Your Title');

const body = document.querySelector('textarea');
body.focus();
document.execCommand('insertText', false, markdownContent);
```

---

### Medium (`medium.com`)

**Navigate to**: `https://medium.com/new-story`

**Editor structure**: ProseMirror-based contenteditable

**Insert content**:
```javascript
// Title: first contenteditable paragraph (h3 or p with placeholder)
const titleEl = document.querySelector('[data-testid="storyTitle"], h3[contenteditable]');
titleEl.focus();
document.execCommand('insertText', false, 'Your Title');

// Body: click below title, then insert (Medium converts markdown on paste)
// For best results, type or paste plain text content
```

---

## Content Generation Templates

### Technical blog (user review tone)

```markdown
## はじめに / Introduction

[Problem statement — what pain point does this solve?]

## [Tool Name] とは / What is [Tool Name]?

[Brief description, positioning]

## 使ってみた / How it works

[Step-by-step walkthrough with details]

## なぜ信頼できるのか / Why it's reliable

[Technical reasoning, architecture details]

## 導入方法 / Getting Started

[Installation, configuration, links]

## まとめ / Conclusion

[Summary, call to action]
```

### Announcement / Release post

```markdown
## [Version] リリース / [Version] Released

[What's new — bullet points]

## 主な変更点 / Key Changes

[Detailed descriptions with code/screenshots]

## アップグレード方法 / How to Upgrade

[Steps]

## リンク / Links

[Downloads, docs, changelog]
```

---

## Editing Published Articles

### Qiita edit flow

1. Navigate to `https://qiita.com/drafts/<article-id>/edit`
2. Use API to get current content: `https://qiita.com/api/v2/items/<article-id>`
3. Parse JSON, extract `body` field (raw markdown)
4. Apply modifications
5. Store modified content in `localStorage` for cross-tab transfer
6. In editor tab: select all → `document.execCommand('insertText', false, newContent)`
7. Click "記事を更新する"

### Blogger edit flow

1. Navigate to blog posts list
2. Click the post to edit
3. Switch to HTML mode
4. Select all → insert modified HTML
5. Click "更新" → "確定"

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| CodeMirror content shows only partial text | CM6 virtualizes content — only visible lines render. Use `document.execCommand('selectAll')` + `insertText` to replace all |
| Blogger `<button>` click does nothing | Blogger uses `div[role="button"]`, not `<button>`. Search with `querySelectorAll('[role="button"]')` |
| CSDN publish needs two clicks | First click opens modal, second click (`.btn-b-red`) actually publishes |
| `nativeInputValueSetter` not recognized | Use `document.execCommand('insertText')` instead — works with all editor frameworks |
| Content inserted but editor doesn't detect it | Always use `execCommand('insertText')` — it fires proper input events. Avoid direct `.value =` or `.textContent =` |
| Iframe-based editor inaccessible | Switch to HTML mode first (Blogger, some WordPress), then edit the textarea |
| Platform blocked by extension | Some platforms (e.g., Reddit) are blocked by Claude in Chrome safety rules. Save content to files for manual posting |

## Key Technical Patterns

### Universal content insertion (works with all editors)

```javascript
// This pattern works with CodeMirror, contenteditable, textarea, cledit
element.focus();
document.execCommand('selectAll', false, null);  // select existing content
document.execCommand('insertText', false, newContent);  // replace with new
```

### Cross-tab content transfer (same domain)

```javascript
// Tab A: store content
localStorage.setItem('__blogContent', content);

// Tab B: retrieve and use
const content = localStorage.getItem('__blogContent');
localStorage.removeItem('__blogContent');
```

### Finding buttons by text (Japanese/Chinese/English)

```javascript
// Works for any language
const findButton = (text) => {
  // Check <button> elements
  let btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().includes(text));
  if (btn) return btn;
  // Check role="button" elements (Google/Material Design)
  btn = Array.from(document.querySelectorAll('[role="button"]'))
    .find(b => b.textContent.trim().includes(text));
  return btn;
};
```

## Conversation Guidelines

- Start by asking: "Which platform(s) do you want to publish to?"
- If user provides a topic, generate content in the appropriate language for each platform
- Always verify user is logged in before attempting to publish
- After successful publication, report the published URL
- If a platform is blocked by extension safety rules, save content to `promo/` directory and inform user
- For edits to published articles, use the platform's API where possible to read current content before modifying
