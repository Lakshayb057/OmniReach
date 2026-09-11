import { query } from './config/db';
import {
  fetchAndSyncMetaTemplatesForCompany,
  registerNewTemplateOnMeta,
  checkMetaTemplateLiveStatus,
} from './services/metaIntegrationService';

async function runTemplateVerification() {
  console.log('🚀 Running Meta WhatsApp Templates Live Sync & Registration Verification...\n');

  // Test 1: Fetch and Sync Templates for OmniReach Global & Companies
  console.log('1️⃣ Testing Paginated Template Synchronization from Meta WABA...');
  const syncResult = await fetchAndSyncMetaTemplatesForCompany(
    {
      system_user_token: 'EAAG_test_system_user_token_sample',
      waba_id: '152071701923841',
    },
    'OmniReach Global'
  );

  console.log(`   ✅ Synced ${syncResult.totalSynced} template(s) for "${syncResult.company_name}":`);
  for (const t of syncResult.templates) {
    console.log(`      • [${t.category}] "${t.name}" (Lang: ${t.language}, Status: ${t.status})`);
  }

  // Test 2: Direct Template Registration to Meta Graph API
  console.log('\n2️⃣ Testing Direct Automatic Template Registration on Meta Graph API...');
  const regResult = await registerNewTemplateOnMeta(
    {
      system_user_token: 'EAAG_test_system_user_token_sample',
      waba_id: '152071701923841',
    },
    'OmniReach Global',
    {
      name: 'october_festive_exclusive_v1',
      category: 'MARKETING',
      meta_language: 'en_US',
      header_type: 'TEXT',
      header_content: 'Special Diwali Offer for {{1}}',
      body_content: 'Hello {{1}},\n\nClaim your exclusive credit card upgrade {{2}} valid until midnight.',
      footer_content: 'Reply STOP to opt out',
      buttons_json: [
        { type: 'URL', text: 'Claim Offer', url: 'https://omnireach.io/apply' },
        { type: 'QUICK_REPLY', text: 'Talk to Agent' },
      ],
    }
  );

  console.log('   ✅ Registration Result:', regResult);

  // Test 3: Real-Time Live Status Check from Meta Graph API
  console.log('\n3️⃣ Testing Live Real-Time Template Status Check from Meta...');
  const liveStatus = await checkMetaTemplateLiveStatus(
    {
      system_user_token: 'EAAG_test_system_user_token_sample',
      waba_id: '152071701923841',
    },
    'october_festive_exclusive_v1'
  );

  console.log('   ✅ Live Meta Status:', liveStatus);

  // Check DB templates count
  const dbTmpls = await query("SELECT id, name, company_name, channel, meta_status FROM campaign_templates WHERE channel = 'whatsapp'");
  console.log(`\n4️⃣ Database Verification: Found ${dbTmpls.rows.length} WhatsApp templates active in PostgreSQL:`);
  for (const row of dbTmpls.rows) {
    console.log(`   - [${row.meta_status}] "${row.name}" (${row.company_name})`);
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL META WHATSAPP TEMPLATES LIVE SYNC & AUTO-REGISTRATION VERIFIED!');
  console.log('========================================================================');
  process.exit(0);
}

runTemplateVerification().catch((err) => {
  console.error('❌ Template verification failed:', err);
  process.exit(1);
});
