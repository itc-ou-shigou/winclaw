# Markdown to HTML Conversion Guide

When publishing to platforms that require HTML (e.g., Blogger), convert markdown using these rules:

## Conversion Rules

| Markdown | HTML |
|----------|------|
| `# H1` | `<h1>H1</h1>` |
| `## H2` | `<h2>H2</h2>` |
| `### H3` | `<h3>H3</h3>` |
| `**bold**` | `<strong>bold</strong>` |
| `*italic*` | `<em>italic</em>` |
| `[text](url)` | `<a href="url" target="_blank">text</a>` |
| `` `code` `` | `<code>code</code>` |
| `- item` | `<ul><li>item</li></ul>` |
| `1. item` | `<ol><li>item</li></ol>` |
| `> quote` | `<blockquote>quote</blockquote>` |
| `---` | `<hr>` |
| ` ```code``` ` | `<pre><code>code</code></pre>` |
| `![alt](src)` | `<img src="src" alt="alt">` |

## Blogger-Specific Notes

- Blogger strips `class` attributes — don't rely on CSS classes
- Use `<br>` for line breaks within paragraphs
- `<pre><code>` blocks preserve whitespace for code
- Keep HTML simple — avoid nested divs, custom styles
- Images: use external URLs (Blogger's image upload requires manual interaction)
- Tables: Blogger supports basic `<table>` but styling is limited

## JavaScript Helper (in-browser conversion)

```javascript
function markdownToSimpleHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
}
```
