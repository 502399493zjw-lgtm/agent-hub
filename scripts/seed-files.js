#!/usr/bin/env node
/**
 * Seed file trees into all existing assets in the DB.
 * Run after the DB has been created with the new `files` column.
 * Usage: node scripts/seed-files.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'hub.db');
const db = new Database(DB_PATH);

// Check if files column exists
const tableInfo = db.pragma('table_info(assets)');
const hasFiles = tableInfo.some(col => col.name === 'files');
if (!hasFiles) {
  console.log('Adding files column to assets table...');
  db.exec("ALTER TABLE assets ADD COLUMN files TEXT NOT NULL DEFAULT '[]'");
}

// File tree templates by asset type
function skillFiles(assetName) {
  const className = assetName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return [
    { name: 'src', type: 'directory', children: [
      { name: 'index.ts', type: 'file', size: 1800 + Math.floor(Math.random() * 800),
        content: `// ${className} - Main skill entry point\nimport { SkillContext } from '@openclaw/sdk';\n\nexport default class ${className}Skill {\n  async execute(ctx: SkillContext) {\n    const input = ctx.getInput();\n    // Process skill logic\n    const result = await this.process(input);\n    return ctx.reply(result);\n  }\n\n  private async process(input: string): Promise<string> {\n    // Implementation\n    return input;\n  }\n}` },
      { name: 'api.ts', type: 'file', size: 1200 + Math.floor(Math.random() * 600) },
      { name: 'types.ts', type: 'file', size: 400 + Math.floor(Math.random() * 300),
        content: `export interface ${className}Config {\n  apiKey?: string;\n  timeout?: number;\n  maxRetries?: number;\n}\n\nexport interface ${className}Result {\n  success: boolean;\n  data: unknown;\n  error?: string;\n}` },
    ]},
    { name: 'tests', type: 'directory', children: [
      { name: 'index.test.ts', type: 'file', size: 800 + Math.floor(Math.random() * 500) },
      { name: 'api.test.ts', type: 'file', size: 600 + Math.floor(Math.random() * 400) },
    ]},
    { name: 'package.json', type: 'file', size: 350 + Math.floor(Math.random() * 100),
      content: `{\n  "name": "@openclaw/${assetName}",\n  "version": "1.0.0",\n  "main": "dist/index.js",\n  "scripts": {\n    "build": "tsc",\n    "test": "jest"\n  },\n  "dependencies": {\n    "@openclaw/sdk": "^1.0.0"\n  }\n}` },
    { name: 'SKILL.md', type: 'file', size: 2000 + Math.floor(Math.random() * 1000) },
    { name: 'tsconfig.json', type: 'file', size: 240 + Math.floor(Math.random() * 60) },
    { name: 'README.md', type: 'file', size: 3500 + Math.floor(Math.random() * 1500) },
  ];
}

function configFiles(assetName, subtype) {
  const mainFile = subtype === 'persona' ? 'persona.yml' : 
                   subtype === 'routing' ? 'routing.yml' :
                   subtype === 'model' ? 'model-config.yml' :
                   subtype === 'scope' ? 'scope.yml' : 'config.yml';
  return [
    { name: mainFile, type: 'file', size: 800 + Math.floor(Math.random() * 500),
      content: `# ${assetName} Configuration\n# Type: ${subtype || 'general'}\n\nname: ${assetName}\nversion: 1.0.0\n\nsettings:\n  enabled: true\n  priority: normal\n  timeout: 30s` },
    { name: 'SOUL.md', type: 'file', size: 1500 + Math.floor(Math.random() * 1000),
      content: `# ${assetName}\n\n## 核心定义\n\n此配置定义了 Agent 的核心行为参数。\n\n## 使用说明\n\n安装后自动生效，可通过 YAML 文件自定义调整。` },
    { name: 'examples', type: 'directory', children: [
      { name: 'greeting.md', type: 'file', size: 400 + Math.floor(Math.random() * 300) },
      { name: 'style-guide.md', type: 'file', size: 600 + Math.floor(Math.random() * 400) },
      { name: 'advanced.md', type: 'file', size: 500 + Math.floor(Math.random() * 300) },
    ]},
    { name: 'README.md', type: 'file', size: 2500 + Math.floor(Math.random() * 1000) },
    { name: 'schema.json', type: 'file', size: 600 + Math.floor(Math.random() * 200) },
  ];
}

function pluginFiles(assetName) {
  const className = assetName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return [
    { name: 'src', type: 'directory', children: [
      { name: 'index.ts', type: 'file', size: 2500 + Math.floor(Math.random() * 1000),
        content: `// ${className} Plugin\nimport { PluginBase, PluginContext } from '@openclaw/plugin-sdk';\n\nexport default class ${className}Plugin extends PluginBase {\n  name = '${assetName}';\n\n  async onLoad(ctx: PluginContext) {\n    console.log('Plugin loaded:', this.name);\n    await this.initBridge(ctx);\n  }\n\n  async onUnload() {\n    console.log('Plugin unloaded:', this.name);\n  }\n\n  private async initBridge(ctx: PluginContext) {\n    // Setup bridge connection\n  }\n}` },
      { name: 'bridge.ts', type: 'file', size: 1800 + Math.floor(Math.random() * 600) },
      { name: 'types.ts', type: 'file', size: 600 + Math.floor(Math.random() * 300) },
      { name: 'utils.ts', type: 'file', size: 500 + Math.floor(Math.random() * 400) },
    ]},
    { name: 'config', type: 'directory', children: [
      { name: 'default.json', type: 'file', size: 400 + Math.floor(Math.random() * 200),
        content: `{\n  "plugin": "${assetName}",\n  "enabled": true,\n  "settings": {\n    "autoConnect": true,\n    "retryAttempts": 3,\n    "timeout": 5000\n  }\n}` },
    ]},
    { name: 'package.json', type: 'file', size: 380 + Math.floor(Math.random() * 80) },
    { name: 'README.md', type: 'file', size: 3500 + Math.floor(Math.random() * 1500) },
    { name: 'LICENSE', type: 'file', size: 1080 },
  ];
}

function triggerFiles(assetName) {
  return [
    { name: 'trigger.yml', type: 'file', size: 600 + Math.floor(Math.random() * 400),
      content: `# ${assetName} Trigger Configuration\n\nname: ${assetName}\ntype: event\n\non:\n  event: custom\n  conditions:\n    - type: match\n      pattern: ".*"\n\nactions:\n  - handler: default\n    params:\n      notify: true` },
    { name: 'handler.ts', type: 'file', size: 1200 + Math.floor(Math.random() * 600),
      content: `// ${assetName} trigger handler\nimport { TriggerContext, TriggerEvent } from '@openclaw/triggers';\n\nexport async function handle(ctx: TriggerContext, event: TriggerEvent) {\n  console.log('Trigger fired:', event.type);\n  // Process trigger event\n  await ctx.dispatch(event.payload);\n}` },
    { name: 'tests', type: 'directory', children: [
      { name: 'handler.test.ts', type: 'file', size: 900 + Math.floor(Math.random() * 400) },
    ]},
    { name: 'README.md', type: 'file', size: 1800 + Math.floor(Math.random() * 600) },
  ];
}

function channelFiles(assetName) {
  const className = assetName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return [
    { name: 'src', type: 'directory', children: [
      { name: 'index.ts', type: 'file', size: 2200 + Math.floor(Math.random() * 700),
        content: `// ${className} Channel Adapter\nimport { ChannelBase, Message, ChannelConfig } from '@openclaw/channels';\n\nexport default class ${className}Channel extends ChannelBase {\n  async connect(config: ChannelConfig) {\n    // Establish connection\n    console.log('Connecting to ${assetName}...');\n  }\n\n  async send(message: Message) {\n    // Send message through channel pipeline\n    const formatted = await this.format(message);\n    return this.dispatch(formatted);\n  }\n\n  async receive(): Promise<Message> {\n    // Listen for incoming messages\n    return this.pipeline.next();\n  }\n}` },
      { name: 'pipeline.ts', type: 'file', size: 2800 + Math.floor(Math.random() * 600) },
      { name: 'formatters.ts', type: 'file', size: 900 + Math.floor(Math.random() * 300) },
    ]},
    { name: 'config.json', type: 'file', size: 350 + Math.floor(Math.random() * 100),
      content: `{\n  "channel": "${assetName}",\n  "version": "1.0.0",\n  "pipeline": {\n    "inbound": ["parse", "validate", "transform"],\n    "outbound": ["format", "encode", "send"]\n  }\n}` },
    { name: 'README.md', type: 'file', size: 3000 + Math.floor(Math.random() * 1200) },
  ];
}

function templateFiles(assetName) {
  return [
    { name: 'template.yml', type: 'file', size: 1800 + Math.floor(Math.random() * 600),
      content: `# ${assetName} Template\n\nname: ${assetName}\nversion: 1.0.0\ndescription: Agent template with pre-configured components\n\ncomponents:\n  skills:\n    - weather-query\n    - web-search\n  channels:\n    - discord-bridge\n  config:\n    persona: default-persona\n    routing: smart-router` },
    { name: 'SOUL.md', type: 'file', size: 1300 + Math.floor(Math.random() * 500),
      content: `# ${assetName}\n\n你是一个基于此模板创建的 AI Agent。\n\n## 核心能力\n- 多渠道通信\n- 智能任务路由\n- 上下文感知\n\n## 使用方式\n直接对话即可，模板已预配置所有必要组件。` },
    { name: 'skills', type: 'directory', children: [
      { name: 'default-skills.yml', type: 'file', size: 450 + Math.floor(Math.random() * 200) },
      { name: 'optional-skills.yml', type: 'file', size: 350 + Math.floor(Math.random() * 200) },
    ]},
    { name: 'config', type: 'directory', children: [
      { name: 'defaults.json', type: 'file', size: 500 + Math.floor(Math.random() * 200) },
    ]},
    { name: 'README.md', type: 'file', size: 2800 + Math.floor(Math.random() * 800) },
  ];
}

// Get all assets and update their files
const assets = db.prepare('SELECT id, name, type, config_subtype FROM assets').all();

const updateStmt = db.prepare('UPDATE assets SET files = ? WHERE id = ?');

const updateAll = db.transaction((rows) => {
  for (const row of rows) {
    let files;
    switch (row.type) {
      case 'skill':
        files = skillFiles(row.name);
        break;
      case 'config':
        files = configFiles(row.name, row.config_subtype);
        break;
      case 'plugin':
        files = pluginFiles(row.name);
        break;
      case 'trigger':
        files = triggerFiles(row.name);
        break;
      case 'channel':
        files = channelFiles(row.name);
        break;
      case 'template':
        files = templateFiles(row.name);
        break;
      default:
        files = [{ name: 'README.md', type: 'file', size: 2048 }];
    }
    updateStmt.run(JSON.stringify(files), row.id);
  }
});

updateAll(assets);
console.log(`Updated ${assets.length} assets with file trees.`);

db.close();
