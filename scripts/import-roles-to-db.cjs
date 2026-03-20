const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const JSON_FILE = path.join(__dirname, 'role-templates-import.json');
const DB_URL = 'mysql://root:Admin123@13.78.81.86:18306/grc-server';

// Which file to process (pass as arg: part1, part2m, part2d, part3, or all)
const ARG = process.argv[2] || 'all';

const PART_RANGES = {
  part1: { start: 0, end: 45, label: 'Part1 (Engineering/Design/Testing/Support)' },
  part2m: { start: 45, end: 97, label: 'Part2 (Marketing/Sales/Product/PM)' },
  part2d: { start: 97, end: 127, label: 'Part2 (Data/Business/Operations)' },
  part3: { start: 127, end: 177, label: 'Part3 (GameDev/Spatial/Specialized)' },
  all: { start: 0, end: 177, label: 'All Parts' },
};

(async () => {
  const roles = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const range = PART_RANGES[ARG];
  if (!range) {
    console.error(`Unknown part: ${ARG}. Use: part1, part2m, part2d, part3, or all`);
    process.exit(1);
  }

  const subset = roles.slice(range.start, range.end);
  console.log(`Importing: ${range.label} (${subset.length} roles)`);

  const conn = await mysql.createConnection(DB_URL);

  let ok = 0, skip = 0, err = 0;
  for (const role of subset) {
    try {
      await conn.execute(
        `INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
          agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name), emoji = VALUES(emoji), description = VALUES(description),
          department = VALUES(department), mode = VALUES(mode),
          agents_md = VALUES(agents_md), soul_md = VALUES(soul_md),
          identity_md = VALUES(identity_md), user_md = VALUES(user_md),
          tools_md = VALUES(tools_md), heartbeat_md = VALUES(heartbeat_md),
          bootstrap_md = VALUES(bootstrap_md), tasks_md = VALUES(tasks_md)`,
        [
          role.id, role.name, role.emoji || '', (role.description || '').substring(0, 500),
          role.department || '', role.mode || 'autonomous',
          role.agents_md || '', role.soul_md || '', role.identity_md || '',
          role.user_md || '', role.tools_md || '', role.heartbeat_md || '',
          role.bootstrap_md || '', role.tasks_md || '',
        ]
      );
      ok++;
    } catch (e) {
      console.error(`  ERR: ${role.id} — ${e.message.substring(0, 80)}`);
      err++;
    }
  }

  await conn.end();
  console.log(`Done: ${ok} inserted/updated, ${err} errors`);
})().catch(e => console.error(e.message));
