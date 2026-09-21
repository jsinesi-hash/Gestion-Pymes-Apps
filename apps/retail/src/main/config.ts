// packages/client/src/main/config.ts
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { TerminalConfig } from '@ferreteria/shared';
import { resolveTerminalConfig } from '@ferreteria/shared';

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

export function loadTerminalConfig(): TerminalConfig {
  let existing: TerminalConfig | null = null;
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      existing = JSON.parse(raw) as TerminalConfig;
    } catch {
      existing = null;
    }
  }
  const config = resolveTerminalConfig(existing);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  return config;
}
