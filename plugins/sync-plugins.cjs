#!/usr/bin/env node
/**
 * WinClaw Plugin Sync Script
 *
 * Scans the plugins directory and generates:
 * 1. PLUGINS-INDEX.json - Plugin command/skill index
 * 2. Updates winclaw.json with extraDirs for skills
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLUGINS_DIR = path.resolve(__dirname);
const CONFIG_PATH = path.join(os.homedir(), '.winclaw', 'winclaw.json');
const INDEX_PATH = path.join(PLUGINS_DIR, 'PLUGINS-INDEX.json');

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return {};

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Remove quotes
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
 * Load plugin manifest
 */
function loadPluginManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');

  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  return {
    name: path.basename(pluginDir),
    description: `Plugin from ${pluginDir}`,
  };
}

/**
 * Load commands from plugin
 */
function loadCommands(pluginDir, prefix) {
  const commandsDir = path.join(pluginDir, 'commands');
  const commands = [];

  if (!fs.existsSync(commandsDir)) return commands;

  const files = fs.readdirSync(commandsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(commandsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const frontmatter = parseFrontmatter(content);

    commands.push({
      name: path.basename(file, '.md'),
      description: frontmatter.description || '',
      argumentHint: frontmatter['argument-hint'],
      file: `${prefix}/commands/${file}`,
    });
  }

  return commands;
}

/**
 * Load skills from plugin
 */
function loadSkills(pluginDir) {
  const skillsDir = path.join(pluginDir, 'skills');
  const skills = [];

  if (!fs.existsSync(skillsDir)) return skills;

  const subdirs = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const dirent of subdirs) {
    if (!dirent.isDirectory()) continue;

    const skillPath = path.join(skillsDir, dirent.name, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      skills.push(dirent.name);
    }
  }

  return skills;
}

/**
 * Load MCP config from plugin
 */
function loadMcpConfig(pluginDir) {
  const mcpPath = path.join(pluginDir, '.mcp.json');

  if (!fs.existsSync(mcpPath)) return [];

  try {
    const content = fs.readFileSync(mcpPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Object.keys(parsed.mcpServers || {});
  } catch (e) {
    return [];
  }
}

/**
 * Process a single plugin directory and collect its data
 */
function processPlugin(pluginPath, pluginId, prefix, plugins, allCommands, skillDirs) {
  console.log('Scanning plugin:', pluginId);

  const manifest = loadPluginManifest(pluginPath);
  const commands = loadCommands(pluginPath, prefix);
  const skills = loadSkills(pluginPath);
  const mcpServers = loadMcpConfig(pluginPath);

  plugins[pluginId] = {
    name: manifest.name || pluginId,
    description: manifest.description || '',
    commands,
    skills,
  };

  if (mcpServers.length > 0) {
    plugins[pluginId].mcpServers = mcpServers;
  }

  // Collect command names
  for (const cmd of commands) {
    allCommands.push(cmd.name);
  }

  // Collect skill directory if it has skills
  if (skills.length > 0) {
    skillDirs.push(path.join(pluginPath, 'skills'));
  }
}

/**
 * Scan all plugins (including nested subdirectories like partner-built/)
 */
function scanPlugins() {
  const plugins = {};
  const allCommands = [];
  const skillDirs = [];

  if (!fs.existsSync(PLUGINS_DIR)) {
    console.log('Plugins directory not found:', PLUGINS_DIR);
    return { plugins, allCommands, skillDirs };
  }

  const subdirs = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });

  for (const dirent of subdirs) {
    if (!dirent.isDirectory()) continue;
    if (dirent.name.startsWith('.')) continue;

    const pluginPath = path.join(PLUGINS_DIR, dirent.name);

    if (isClaudePlugin(pluginPath)) {
      // Direct plugin (e.g., data/, engineering/)
      processPlugin(pluginPath, dirent.name, dirent.name, plugins, allCommands, skillDirs);
    } else {
      // Not a plugin itself — check subdirectories (e.g., partner-built/apollo/)
      try {
        const nested = fs.readdirSync(pluginPath, { withFileTypes: true });
        for (const sub of nested) {
          if (!sub.isDirectory()) continue;
          if (sub.name.startsWith('.')) continue;

          const nestedPath = path.join(pluginPath, sub.name);
          if (isClaudePlugin(nestedPath)) {
            const pluginId = `${dirent.name}/${sub.name}`;
            processPlugin(nestedPath, pluginId, pluginId, plugins, allCommands, skillDirs);
          }
        }
      } catch (e) {
        // Skip non-readable directories
      }
    }
  }

  // Deduplicate commands
  const uniqueCommands = [...new Set(allCommands)];

  return { plugins, allCommands: uniqueCommands, skillDirs };
}

/**
 * Generate plugin index
 */
function generateIndex(plugins, allCommands) {
  return {
    '$schema': './PLUGINS-INDEX.schema.json',
    version: '1.0.0',
    generated: new Date().toISOString(),
    plugins,
    allCommands,
  };
}

/**
 * Update winclaw.json with skill directories
 */
function updateConfig(skillDirs) {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  // Initialize skills.load if not present
  if (!config.skills) config.skills = {};
  if (!config.skills.load) config.skills.load = {};

  // Update extraDirs
  config.skills.load.extraDirs = skillDirs;
  config.skills.load.watch = true;
  config.skills.load.watchDebounceMs = 1000;

  // Note: Do NOT add claudePlugins key - it will cause gateway startup failure
  // The skills.load.extraDirs is sufficient for loading plugin skills

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('Updated:', CONFIG_PATH);
}

/**
 * Main
 */
function main() {
  console.log('WinClaw Plugin Sync');
  console.log('===================');
  console.log('');

  // Scan plugins
  const { plugins, allCommands, skillDirs } = scanPlugins();

  console.log('');
  console.log('Found plugins:', Object.keys(plugins).length);
  console.log('Total commands:', allCommands.length);
  console.log('Skill directories:', skillDirs.length);

  // Generate index
  const index = generateIndex(plugins, allCommands);
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log('');
  console.log('Generated:', INDEX_PATH);

  // Update config
  updateConfig(skillDirs);

  console.log('');
  console.log('Done!');
  console.log('');
  console.log('Available commands:');
  console.log(allCommands.map(c => `  /${c}`).join('\n'));
}

main();
