import crypto from 'crypto';
import { query } from './config/db';
import {
  parseSpintax,
  applyPolymorphicVariation,
  isOptOutMessage,
  isOptInMessage,
  calculatePacingDelay,
  checkAndIncrementDailyCount,
  getDailySendCount,
  DEFAULT_ANTI_BAN_SETTINGS,
  ANTI_BAN_PRESETS,
} from './services/antiBanService';
import { sendWhatsAppMessage } from './services/whatsappService';

async function runAntiBanVerification() {
  console.log('================================================================');
  console.log('🛡️ RUNNING WHATSAPP BAILEYS ANTI-BAN PROTECTION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: SPINTAX PARSING
  // ---------------------------------------------------------------------------
  console.log('--- Phase 1: Spintax Engine Testing ---');
  const template = '{Hello|Hi|Greetings} {friend|customer}, {welcome|glad to have you}!';
  const variations = new Set<string>();
  for (let i = 0; i < 20; i++) {
    variations.add(parseSpintax(template));
  }
  assert(variations.size > 1, `Spintax produced multiple distinct variations (${variations.size} unique variations generated)`);
  assert(!parseSpintax(template).includes('{') && !parseSpintax(template).includes('}'), 'Spintax brackets are completely stripped and resolved');

  // ---------------------------------------------------------------------------
  // TEST 2: POLYMORPHIC ANTI-HASH CRYPTOGRAPHIC UNIQUENESS
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 2: Polymorphic SHA-256 Anti-Hash Verification ---');
  const rawText = 'Important update regarding your account limit. Please review immediately.';
  const hashSet = new Set<string>();
  const renderedTexts: string[] = [];

  for (let i = 0; i < 15; i++) {
    const polymorphic = applyPolymorphicVariation(rawText);
    renderedTexts.push(polymorphic);
    const hash = crypto.createHash('sha256').update(polymorphic).digest('hex');
    hashSet.add(hash);
  }

  assert(hashSet.size === 15, `All 15 messages produced 100% unique cryptographic SHA-256 hashes (${hashSet.size}/15 unique hashes)`);
  // Verify clean display: removing invisible zero-width chars yields original text
  const cleaned = renderedTexts[0].replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  assert(cleaned === rawText, 'Visual text content is preserved without visible artifacts for human recipient');

  // ---------------------------------------------------------------------------
  // TEST 3: AUTOMATIC OPT-OUT / OPT-IN DETECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 3: Inbound Opt-Out / Opt-In Keyword Detection ---');
  assert(isOptOutMessage('STOP'), 'Matches "STOP"');
  assert(isOptOutMessage('unsubscribe'), 'Matches case-insensitive "unsubscribe"');
  assert(isOptOutMessage('OPT OUT'), 'Matches "OPT OUT"');
  assert(isOptOutMessage('DONT MESSAGE'), 'Matches "DONT MESSAGE"');
  assert(isOptOutMessage('CANCEL'), 'Matches "CANCEL"');
  assert(!isOptOutMessage('Hello, I want to know more'), 'Does not falsely flag normal customer inquiries');
  assert(isOptInMessage('START'), 'Matches "START"');
  assert(isOptInMessage('SUBSCRIBE'), 'Matches "SUBSCRIBE"');
  assert(isOptInMessage('resume'), 'Matches case-insensitive "resume"');

  // ---------------------------------------------------------------------------
  // TEST 4: DYNAMIC PACING JITTER CALCULATION
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 4: Velocity Pacing & Human Jitter Calculation ---');
  const customSettings = { min_delay_seconds: 5, max_delay_seconds: 12 };
  let allDelaysInRange = true;
  for (let i = 0; i < 20; i++) {
    const delayMs = calculatePacingDelay(customSettings);
    if (delayMs < 5000 || delayMs > 12000) {
      allDelaysInRange = false;
      break;
    }
  }
  assert(allDelaysInRange, 'Pacing calculator generates random delays strictly within min-max bounds (5s-12s)');

  // ---------------------------------------------------------------------------
  // TEST 5: DAILY SAFETY CEILING TRACKER
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 5: Daily Safety Cap Limiter ---');
  const testGwId = `test_gw_${Date.now()}`;
  const limit = 5;
  let allowedCount = 0;
  for (let i = 0; i < 7; i++) {
    const result = await checkAndIncrementDailyCount(testGwId, limit);
    if (result.allowed) {
      allowedCount++;
    }
  }
  assert(allowedCount === 5, `Strictly permitted only 5 sends when daily limit is set to 5 (blocked ${7 - allowedCount} sends)`);
  assert(getDailySendCount(testGwId) === 5, 'Internal counter accurately reports 5 sends for today');

  // ---------------------------------------------------------------------------
  // TEST 6: PRESETS INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 6: Anti-Ban Presets Integrity ---');
  assert(ANTI_BAN_PRESETS.warmup.daily_send_limit === 40, 'Warm-up preset enforces conservative 40/day limit');
  assert(ANTI_BAN_PRESETS.warmup.min_delay_seconds >= 8, 'Warm-up preset enforces slow human delay (>= 8s)');
  assert(ANTI_BAN_PRESETS.balanced.daily_send_limit === 150, 'Balanced preset enforces 150/day standard limit');
  assert(ANTI_BAN_PRESETS.high_throughput.daily_send_limit === 400, 'High-throughput preset caps at 400/day for mature accounts');

  // ---------------------------------------------------------------------------
  // TEST 7: END-TO-END SUPPRESSION ON OPTED-OUT CONTACTS
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 7: Automated Suppression of Opted-Out Leads ---');
  const optedOutLead = {
    id: 'test_lead_uuid',
    urn: 'URN-OPT-OUT',
    fmcb_id: 'FMCB99999',
    full_name: 'John Optout',
    phone: '+919999999999',
    email: 'john@example.com',
    whatsapp_optin: false, // Customer opted out!
  };

  const dispatchResult = await sendWhatsAppMessage(
    optedOutLead.phone,
    { body_content: 'Promotional offer for you!' },
    optedOutLead as any,
    { is_baileys: true },
    undefined,
    'whatsapp_baileys',
    testGwId
  );

  assert(dispatchResult.status === 'suppressed', 'Message to opted-out contact was instantly suppressed');
  assert(!dispatchResult.success, 'Opted-out contact was not messaged (success is false)');

  // ---------------------------------------------------------------------------
  // TEST 8: GATEWAY DATABASE PERSISTENCE OF ANTI-BAN SETTINGS
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 8: Gateway Config Anti-Ban Database Persistence ---');
  const tempGwRes = await query(
    `INSERT INTO gateways_config (name, company_name, type, credentials, is_active, quality_rating)
     VALUES ($1, 'OmniReach Global', 'whatsapp_baileys', $2, true, 'GREEN')
     RETURNING id`,
    [
      `AntiBan Test GW ${Date.now()}`,
      JSON.stringify({
        anti_ban_settings: {
          profile: 'warmup',
          min_delay_seconds: 10,
          max_delay_seconds: 20,
          daily_send_limit: 35,
          simulate_human_typing: true,
          preflight_number_check: true,
          polymorphic_anti_hash: true,
          auto_opt_out_on_stop: true,
        },
      }),
    ]
  );
  const createdGwId = tempGwRes.rows[0].id;

  const readBack = await query('SELECT credentials FROM gateways_config WHERE id = $1', [createdGwId]);
  const savedSettings = readBack.rows[0]?.credentials?.anti_ban_settings;

  assert(savedSettings?.profile === 'warmup', 'Gateway persisted warmup profile');
  assert(savedSettings?.min_delay_seconds === 10, 'Gateway persisted min_delay_seconds = 10');
  assert(savedSettings?.daily_send_limit === 35, 'Gateway persisted daily_send_limit = 35');
  assert(savedSettings?.polymorphic_anti_hash === true, 'Gateway persisted polymorphic_anti_hash = true');

  // Clean up test gateway
  await query('DELETE FROM gateways_config WHERE id = $1', [createdGwId]);

  console.log('\n================================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAntiBanVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
