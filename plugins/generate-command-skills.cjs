#!/usr/bin/env node
/**
 * Generate WinClaw skill files from Claude/Cowork plugin commands
 * 
 * This script reads plugin commands from C:\work\winclaw\plugins\*\commands\*.md
 * and generates corresponding SKILL.md files that WinClaw can automatically load.
 */

const fs = require('fs');
const path = require('path');

const PLUGINS_ROOT = 'C:\\work\\winclaw\\plugins';
const OUTPUT_DIR = 'C:\\Users\\USER\\.winclaw\\skills\\plugin-commands';

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---')) return {};
  
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) return {};
  
  const block = content.slice(4, endIndex);
  const frontmatter = {};
  
  for (const line of block.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      frontmatter[key] = value;
    }
  }
  
  return frontmatter;
}

/**
 * Strip frontmatter from content
 */
function stripFrontmatter(content) {
  if (!content.startsWith('---')) return content;
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) return content;
  return content.slice(endIndex + 5);
}

/**
 * Check if directory is a Claude plugin
 */
function isClaudePlugin(dir) {
  const pluginJson = path.join(dir, '.claude-plugin', 'plugin.json');
  const commandsDir = path.join(dir, 'commands');
  const skillsDir = path.join(dir, 'skills');
  
  return fs.existsSync(pluginJson) || 
         (fs.existsSync(commandsDir) && fs.existsSync(skillsDir));
}

/**
 * Load commands from a plugin directory
 */
function loadPluginCommands(pluginDir) {
  const commandsDir = path.join(pluginDir, 'commands');
  const commands = [];
  
  if (!fs.existsSync(commandsDir)) return commands;
  
  const files = fs.readdirSync(commandsDir);
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    const filePath = path.join(commandsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const body = stripFrontmatter(content);
      
      commands.push({
        name: path.basename(file, '.md'),
        description: frontmatter.description || '',
        argumentHint: frontmatter['argument-hint'],
        content: body,
        sourcePath: filePath,
        pluginName: path.basename(pluginDir),
      });
    } catch (e) {
      // Skip files that can't be read
    }
  }
  
  return commands;
}

/**
 * Generate skill file content for a plugin command
 */
function generateSkillFile(command) {
  const frontmatter = {
    name: command.name,
    description: command.description || `Execute /${command.name} command from ${command.pluginName} plugin`,
  };
  
  const skillContent = `---
name: ${frontmatter.name}
description: "${frontmatter.description.replace(/"/g, '\\"')}"
metadata: { "winclaw": { "emoji": "🔌", "category": "plugin-command" } }
---

# /${command.name}

> Plugin: **${command.pluginName}**${command.argumentHint ? `  \n> Usage: \`/${command.name} ${command.argumentHint}\`` : ''}

${command.content}

## Usage

\`\`\`
/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ''}
\`\`\`

## Source

- Plugin: \`${command.pluginName}\`
- File: \`${path.relative(PLUGINS_ROOT, command.sourcePath)}\`
`;
  
  return skillContent;
}

/**
 * Main
 */
function main() {
  console.log('WinClaw Plugin Commands → Skills Generator');
  console.log('==========================================');
  console.log('');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Created:', OUTPUT_DIR);
  }
  
  // Clear existing generated skills
  const existingFiles = fs.readdirSync(OUTPUT_DIR);
  for (const file of existingFiles) {
    if (file.endsWith('.md')) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
  }
  console.log('Cleared existing skills');
  
  // Scan plugins
  let totalCommands = 0;
  const subdirs = fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true });
  
  for (const dirent of subdirs) {
    if (!dirent.isDirectory()) continue;
    if (dirent.name.startsWith('.')) continue;
    
    const pluginPath = path.join(PLUGINS_ROOT, dirent.name);
    
    if (!isClaudePlugin(pluginPath)) continue;
    
    console.log(`Scanning plugin: ${dirent.name}`);
    
    const commands = loadPluginCommands(pluginPath);
    
    for (const cmd of commands) {
      const skillContent = generateSkillFile(cmd);
      const skillPath = path.join(OUTPUT_DIR, `${cmd.name}.md`);
      
      fs.writeFileSync(skillPath, skillContent);
      console.log(`  Generated: ${cmd.name}`);
      totalCommands++;
    }
  }
  
  console.log('');
  console.log(`Generated ${totalCommands} plugin command skills`);
  console.log(`Output: ${OUTPUT_DIR}`);
  
  // Update config to include the generated skills directory
  const configPath = 'C:\\Users\\USER\\.winclaw\\winclaw.json';
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (!config.skills) config.skills = {};
    if (!config.skills.load) config.skills.load = {};
    if (!config.skills.load.extraDirs) config.skills.load.extraDirs = [];
    
    // Add generated skills directory if not present
    if (!config.skills.load.extraDirs.includes(OUTPUT_DIR)) {
      config.skills.load.extraDirs.push(OUTPUT_DIR);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log('');
      console.log('Added to config:', OUTPUT_DIR);
    }
  } catch (e) {
    console.error('Failed to update config:', e.message);
  }
  
  console.log('');
  console.log('Done!');
}

main();
