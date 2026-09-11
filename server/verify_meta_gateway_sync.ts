import { query } from './config/db';
import {
  inspectAndFetchMetaPhoneNumbers,
  fetchAndSyncMetaTemplatesForCompany,
} from './services/metaIntegrationService';

async function runVerificationAndUpdate() {
  console.log('🚀 Running Meta WhatsApp Phone Numbers Verification & Database Refresh...\n');

  // Test 1: Full Token Inspection with multi-line discovery
  console.log('1️⃣ Discovering connected WhatsApp Phone Numbers...');
  const inspection = await inspectAndFetchMetaPhoneNumbers(
    'EAAG_test_system_user_permanent_token_sample_12345',
    '152071701923841',
    '109823475919922',
    '152071701923841'
  );

  console.log('   Inspection Valid:', inspection.valid);
  console.log('   Business Name:', inspection.business_name);
  console.log('   Total Phone Numbers Found:', inspection.total_phone_numbers);
  for (const pn of inspection.phone_numbers) {
    console.log(`      • [ID: ${pn.id}] ${pn.display_phone_number} | Name: "${pn.verified_name}" | Status: ${pn.status} | Quality: ${pn.quality_rating} | Default: ${pn.is_default}`);
  }

  if (inspection.phone_numbers.length < 2) {
    throw new Error(`Expected at least 2 connected phone numbers, got ${inspection.phone_numbers.length}`);
  }

  // Update existing whatsapp_meta gateways in DB with all connected phone numbers
  const dbGws = await query("SELECT * FROM gateways_config WHERE type = 'whatsapp_meta'");
  for (const row of dbGws.rows) {
    const creds = row.credentials || {};
    const insp = await inspectAndFetchMetaPhoneNumbers(
      creds.system_user_token || '',
      creds.waba_id,
      creds.phone_number_id,
      creds.business_id
    );

    const updatedCreds = {
      ...creds,
      phone_numbers: insp.phone_numbers,
      display_phone_number: insp.display_phone_number || creds.display_phone_number,
      verified_name: insp.verified_name || creds.verified_name,
      quality_rating: insp.quality_rating || creds.quality_rating,
    };

    await query('UPDATE gateways_config SET credentials = $1, quality_rating = $2 WHERE id = $3', [
      JSON.stringify(updatedCreds),
      updatedCreds.quality_rating,
      row.id,
    ]);

    console.log(`\n✅ Updated existing Gateway ID "${row.id}" (${row.name}) with ${insp.phone_numbers.length} connected lines:`);
    for (const p of insp.phone_numbers) {
      console.log(`   - ${p.display_phone_number} (${p.verified_name})`);
    }
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL CONNECTED META WHATSAPP PHONE LINES VERIFIED & SYNCED IN DATABASE!');
  console.log('========================================================================');
  process.exit(0);
}

runVerificationAndUpdate().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
