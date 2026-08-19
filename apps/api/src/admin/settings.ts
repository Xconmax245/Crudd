import { db } from '@crudd/database';
import type { PlatformSettings } from '@crudd/shared';

/**
 * Platform settings (directive #25) are stored as a single JSON row in
 * platform_settings under the key "platform". Defaults are applied for any
 * missing fields so the API always returns a complete, typed object.
 */

const SETTINGS_KEY = 'platform';

export const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'CRUDD',
  publicAppUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  adminAppUrl: process.env.ADMIN_URL ?? 'http://localhost:3002',
  defaultTimerSeconds: 15,
  defaultMaxPlayers: 8,
  maxQuestionCount: 50,
  minQuestionsForPublication: 1,
  requireExplanations: false,
  requireSources: false,
};

export async function getSettings(): Promise<PlatformSettings> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(row.value as Partial<PlatformSettings>) };
}

export async function saveSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await db.platformSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next as any },
    create: { key: SETTINGS_KEY, value: next as any },
  });
  return next;
}
