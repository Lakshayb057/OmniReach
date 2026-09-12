import { WASocket } from '@whiskeysockets/baileys';
import { query } from '../config/db';

export interface AntiBanSettings {
  profile: 'warmup' | 'balanced' | 'high_throughput' | 'custom';
  min_delay_seconds: number;
  max_delay_seconds: number;
  batch_size: number;
  batch_cooldown_seconds: number;
  daily_send_limit: number;
  simulate_human_typing: boolean;
  preflight_number_check: boolean;
  polymorphic_anti_hash: boolean;
  auto_opt_out_on_stop: boolean;
  append_opt_out_footer: boolean;
}

export const ANTI_BAN_PRESETS: Record<'warmup' | 'balanced' | 'high_throughput', AntiBanSettings> = {
  warmup: {
    profile: 'warmup',
    min_delay_seconds: 8,
    max_delay_seconds: 18,
    batch_size: 15,
    batch_cooldown_seconds: 120,
    daily_send_limit: 40,
    simulate_human_typing: true,
    preflight_number_check: true,
    polymorphic_anti_hash: true,
    auto_opt_out_on_stop: true,
    append_opt_out_footer: true,
  },
  balanced: {
    profile: 'balanced',
    min_delay_seconds: 4,
    max_delay_seconds: 10,
    batch_size: 25,
    batch_cooldown_seconds: 60,
    daily_send_limit: 150,
    simulate_human_typing: true,
    preflight_number_check: true,
    polymorphic_anti_hash: true,
    auto_opt_out_on_stop: true,
    append_opt_out_footer: false,
  },
  high_throughput: {
    profile: 'high_throughput',
    min_delay_seconds: 2,
    max_delay_seconds: 6,
    batch_size: 40,
    batch_cooldown_seconds: 45,
    daily_send_limit: 400,
    simulate_human_typing: true,
    preflight_number_check: true,
    polymorphic_anti_hash: true,
    auto_opt_out_on_stop: true,
    append_opt_out_footer: false,
  },
};

export const DEFAULT_ANTI_BAN_SETTINGS: AntiBanSettings = ANTI_BAN_PRESETS.balanced;

// In-memory tracker for daily sends per gateway (flushed / backed by DB)
const dailySendCounts: Map<string, { date: string; count: number }> = new Map();

/**
 * Parses and expands nested spintax expressions: {Hi|Hello|Hey}
 */
export function parseSpintax(text: string): string {
  if (!text || !text.includes('{')) return text;
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches = true;
  let result = text;
  let iterations = 0;
  
  while (matches && iterations < 10) {
    iterations++;
    const prev = result;
    result = result.replace(spintaxRegex, (_, match) => {
      const choices = match.split('|');
      const chosen = choices[Math.floor(Math.random() * choices.length)];
      return chosen !== undefined ? chosen : '';
    });
    matches = prev !== result;
  }
  return result;
}

/**
 * Invisible Zero-Width Characters for Polymorphic Anti-Hash Protection.
 * \u200B = Zero Width Space
 * \u200C = Zero Width Non-Joiner
 * \u200D = Zero Width Joiner
 * \uFEFF = Zero Width No-Break Space
 */
const ZERO_WIDTH_CHARS = ['\u200B', '\u200C', '\u200D', '\uFEFF'];

/**
 * Injects invisible zero-width variations into text.
 * The human user sees the exact same message, but WhatsApp server computes a 100% unique cryptographic SHA-256 hash.
 */
export function applyPolymorphicVariation(text: string): string {
  if (!text) return text;
  
  // 1. Generate a randomized combination of invisible chars at the end
  const suffixLen = Math.floor(Math.random() * 3) + 2;
  let invisibleSuffix = '';
  for (let i = 0; i < suffixLen; i++) {
    invisibleSuffix += ZERO_WIDTH_CHARS[Math.floor(Math.random() * ZERO_WIDTH_CHARS.length)];
  }

  // 2. Interleave randomized invisible zero-width space in one or two spaces
  const words = text.split(' ');
  if (words.length > 2) {
    const targetIdx = Math.floor(Math.random() * (words.length - 1));
    const randomChar = ZERO_WIDTH_CHARS[Math.floor(Math.random() * ZERO_WIDTH_CHARS.length)];
    words[targetIdx] = words[targetIdx] + randomChar;
    return words.join(' ') + invisibleSuffix;
  }

  return text + invisibleSuffix;
}

/**
 * Checks if incoming text is an unsubscribe / opt-out command
 */
export function isOptOutMessage(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toUpperCase();
  const optOutKeywords = [
    'STOP',
    'UNSUBSCRIBE',
    'OPTOUT',
    'OPT-OUT',
    'OPT OUT',
    'CANCEL',
    'REMOVE',
    'DONT MESSAGE',
    'DON\'T MESSAGE',
    'STOP MESSAGING',
    'QUIT',
    'NO THANKS',
    'LEAVE',
    'BLOCK',
    'NOT INTERESTED',
  ];
  return optOutKeywords.includes(clean) || clean === 'STOP.' || clean === 'UNSUBSCRIBE.';
}

/**
 * Checks if incoming text is a re-subscribe / opt-in command
 */
export function isOptInMessage(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toUpperCase();
  const optInKeywords = ['START', 'SUBSCRIBE', 'UNBLOCK', 'RESUME', 'JOIN', 'YES'];
  return optInKeywords.includes(clean);
}

/**
 * Standard automatic opt-out confirmation message
 */
export const OPT_OUT_CONFIRMATION_TEXT = 
  '✅ You have been successfully unsubscribed from WhatsApp notifications. You will receive no further messages. Reply START at any time to resume.';

/**
 * Standard automatic opt-in confirmation message
 */
export const OPT_IN_CONFIRMATION_TEXT = 
  '🎉 Welcome back! You have successfully re-subscribed to WhatsApp notifications.';

/**
 * Pre-flight verification: Check if number exists on WhatsApp before dispatching.
 * Eliminates probe bans caused by contacting unregistered numbers.
 */
export async function validateNumberOnWhatsApp(
  sock: WASocket,
  phone: string
): Promise<{ exists: boolean; jid?: string }> {
  try {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 9) {
      return { exists: false };
    }

    // Call Baileys onWhatsApp API
    const results = await sock.onWhatsApp(cleanPhone);
    if (results && results.length > 0 && results[0].exists) {
      return { exists: true, jid: results[0].jid };
    }
    return { exists: false };
  } catch (err: any) {
    // If check fails due to temporary socket latency, assume true to not block legitimate sends
    console.warn(`⚠️ onWhatsApp pre-flight check warning for ${phone}:`, err.message);
    return { exists: true };
  }
}

/**
 * Realistic Human Presence Simulation:
 * Sets user available -> Subscribes to chat -> Composing (typing) -> Human delay -> Paused
 */
export async function simulateHumanPresence(
  sock: WASocket,
  jid: string,
  textLength: number,
  options: { minTypingMs?: number; maxTypingMs?: number } = {}
): Promise<void> {
  const minMs = options.minTypingMs || 1000;
  const maxMs = options.maxTypingMs || 3500;

  // Calculate typing delay proportional to message length (~20ms per character)
  const calculatedTypingTime = Math.min(maxMs, Math.max(minMs, textLength * 20));
  const humanTypingJitter = Math.floor(Math.random() * 500);
  const totalTypingTime = calculatedTypingTime + humanTypingJitter;

  try {
    // 1. Mark presence available
    await sock.sendPresenceUpdate('available');

    // 2. Subscribe to recipient presence
    await sock.presenceSubscribe(jid).catch(() => {});

    // 3. Send "composing" status (Typing...)
    await sock.sendPresenceUpdate('composing', jid);

    // 4. Wait realistic human typing duration
    await new Promise((resolve) => setTimeout(resolve, totalTypingTime));

    // 5. Briefly pause before clicking send
    await sock.sendPresenceUpdate('paused', jid);
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.floor(Math.random() * 200)));
  } catch (e: any) {
    // Presence simulation should never crash the message flow
    console.warn('Presence simulation warning:', e.message);
  }
}

/**
 * Calculates randomized human pacing delay in milliseconds
 */
export function calculatePacingDelay(settings: Partial<AntiBanSettings> = {}): number {
  const minSec = settings.min_delay_seconds !== undefined ? settings.min_delay_seconds : 4;
  const maxSec = settings.max_delay_seconds !== undefined ? settings.max_delay_seconds : 10;
  const actualMin = Math.min(minSec, maxSec);
  const actualMax = Math.max(minSec, maxSec);

  const delaySec = actualMin + Math.random() * (actualMax - actualMin);
  return Math.round(delaySec * 1000);
}

/**
 * Checks and increments daily send count for a gateway.
 * Returns { allowed: boolean, currentCount: number, limit: number }
 */
export async function checkAndIncrementDailyCount(
  gatewayId: string,
  dailyLimit: number
): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  const todayStr = new Date().toISOString().split('T')[0];
  let entry = dailySendCounts.get(gatewayId);

  if (!entry || entry.date !== todayStr) {
    // Attempt to query database for today's count
    try {
      const res = await query(
        `SELECT COUNT(*) as count 
         FROM campaign_logs cl
         JOIN campaign_broadcasts b ON cl.broadcast_id = b.id
         WHERE b.whatsapp_gateway_id = $1 
           AND cl.status = 'delivered'
           AND cl.created_at >= CURRENT_DATE`,
        [gatewayId]
      );
      const dbCount = parseInt(res.rows[0]?.count || '0', 10);
      entry = { date: todayStr, count: dbCount };
    } catch {
      entry = { date: todayStr, count: 0 };
    }
    dailySendCounts.set(gatewayId, entry);
  }

  if (dailyLimit > 0 && entry.count >= dailyLimit) {
    return { allowed: false, currentCount: entry.count, limit: dailyLimit };
  }

  entry.count++;
  dailySendCounts.set(gatewayId, entry);
  return { allowed: true, currentCount: entry.count, limit: dailyLimit };
}

/**
 * Get current day's send count for a gateway
 */
export function getDailySendCount(gatewayId: string): number {
  const todayStr = new Date().toISOString().split('T')[0];
  const entry = dailySendCounts.get(gatewayId);
  if (entry && entry.date === todayStr) {
    return entry.count;
  }
  return 0;
}
