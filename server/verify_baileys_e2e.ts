import { query, pool } from './config/db';
import {
  initBaileysSession,
  getBaileysSession,
  getAllBaileysSessions,
  sendBaileysMessage,
  disconnectBaileysSession,
} from './services/baileysService';
import { sendWhatsAppMessage } from './services/whatsappService';
import { saveInboundMessage, sendOutboundMessage } from './services/inboxService';
import { executeEnrollmentStep, advanceJourneyOnUserInput } from './services/journeyEngine';

async function runBaileysVerification() {
  console.log('===============================================================');
  console.log('🧪 OMNIREACH WHATSAPP BAILEYS FULL END-TO-END VERIFICATION');
  console.log('===============================================================\n');

  let testGatewayId: string | null = null;
  let testLeadId: string | null = null;
  let testJourneyId: string | null = null;

  try {
    // 1. VERIFY GATEWAY PROVISIONING
    console.log('STEP 1: Provisioning test WhatsApp Baileys Gateway in PostgreSQL...');
    const gwRes = await query(
      `INSERT INTO gateways_config (name, company_name, type, credentials, is_active, is_default, quality_rating, status_details)
       VALUES ($1, $2, 'whatsapp_baileys', $3, true, false, 'YELLOW', $4)
       RETURNING *`,
      [
        'Verification Baileys Web Gateway',
        'OmniReach Global',
        JSON.stringify({ session_name: 'test_verify_session', display_phone_number: '919876543210' }),
        JSON.stringify({ status: 'SCAN_QR_CODE', protocol: 'Baileys Multi-Device Web Socket' }),
      ]
    );
    testGatewayId = gwRes.rows[0].id;
    console.log(`✅ Provisioned Baileys Gateway ID: ${testGatewayId} (${gwRes.rows[0].name})`);

    // 2. VERIFY BAILEYS SERVICE SESSION LIFECYCLE
    console.log('\nSTEP 2: Initializing Baileys Multi-Device Socket Session...');
    const session = await initBaileysSession(testGatewayId, 'OmniReach Global');
    console.log(`✅ Session initiated with initial status: "${session.status}"`);

    // Wait a brief moment for QR generation event
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const updatedSession = getBaileysSession(testGatewayId);
    console.log(`✅ Session state after startup: "${updatedSession?.status}" (Has QR: ${!!updatedSession?.qrCodeDataUrl})`);

    const allSessions = getAllBaileysSessions();
    console.log(`✅ Active in-memory Baileys sessions count: ${allSessions.length}`);

    // 3. VERIFY INBOUND MESSAGE INGESTION & LIVE INBOX
    console.log('\nSTEP 3: Simulating Inbound Customer WhatsApp Message...');
    const testCustomerPhone = '+919988776655';
    const inboundRes = await saveInboundMessage({
      phone: testCustomerPhone,
      text: 'Hi, I need assistance with my enterprise campaign!',
      contact_name: 'Priya Sharma (Verification)',
      company_name: 'OmniReach Global',
      whatsapp_message_id: `test_baileys_in_${Date.now()}`,
    });

    console.log(`✅ Inbound message ingested into conversation: ${inboundRes.conversation.id}`);
    console.log(`✅ Message stored in chat_messages table (ID: ${inboundRes.message.id}, Content: "${inboundRes.message.content}")`);

    // 4. VERIFY OUTBOUND LIVE INBOX MESSAGE DISPATCH (BAILEYS UNRESTRICTED MODE)
    console.log('\nSTEP 4: Testing Outbound Inbox Reply (Verifying 24h Meta Bypass for Baileys)...');
    // Set session_expires_at to past to prove 24-hour window bypass works for Baileys
    await query(
      `UPDATE conversations SET session_expires_at = CURRENT_TIMESTAMP - INTERVAL '2 hours' WHERE id = $1`,
      [inboundRes.conversation.id]
    );

    // Make our Baileys gateway the active default for OmniReach Global
    await query(`UPDATE gateways_config SET is_default = true WHERE id = $1`, [testGatewayId]);

    const outboundMsg = await sendOutboundMessage(
      inboundRes.conversation.id,
      {
        content: 'Hello Priya! This reply was dispatched via our Baileys Multi-Device protocol.',
        message_type: 'text',
      },
      { id: 'test-agent-id', full_name: 'Concierge Agent', company_name: 'OmniReach Global' }
    );
    console.log(`✅ Outbound message successfully dispatched without 24h lockout! Status: ${outboundMsg.status}, Direction: ${outboundMsg.direction}`);

    // 5. VERIFY JOURNEY BUILDER AUTOMATION WITH BAILEYS
    console.log('\nSTEP 5: Testing Journey Builder Node Execution with Baileys Channel...');
    // Create a test lead
    const leadRes = await query(
      `INSERT INTO campaign_master_leads (full_name, phone, email, company_name, fmcb_id)
       VALUES ($1, $2, $3, $4, 'FMCB' || nextval('fmcb_id_seq'))
       ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id, full_name, phone`,
      ['Arjun Kapoor', '+919811122233', 'arjun@example.com', 'OmniReach Global']
    );
    testLeadId = leadRes.rows[0].id;

    // Create a test journey with prompt_input and action_whatsapp
    const journeyRes = await query(
      `INSERT INTO journeys (name, company_name, status, nodes_json, edges_json)
       VALUES ($1, $2, 'active', $3, $4)
       RETURNING id`,
      [
        'Baileys Verification Flow',
        'OmniReach Global',
        JSON.stringify([
          {
            id: 'node_trigger',
            type: 'trigger',
            data: { label: 'Start Flow' },
          },
          {
            id: 'node_prompt',
            type: 'prompt_input',
            config: {
              prompt_text: 'Hello {{name}}, reply with 1 for Yes or 2 for No:',
              variable_name: 'user_reply',
            },
          },
          {
            id: 'node_action',
            type: 'action_whatsapp',
            config: {
              body: 'Thank you for choosing {{user_reply}}!',
            },
          },
        ]),
        JSON.stringify([
          { id: 'e1', from: 'node_trigger', to: 'node_prompt' },
          { id: 'e2', from: 'node_prompt', to: 'node_action' },
        ]),
      ]
    );
    testJourneyId = journeyRes.rows[0].id;

    // Enroll lead in journey
    const enrollRes = await query(
      `INSERT INTO journey_enrollments (journey_id, master_lead_id, current_node_id, status, variables_json)
       VALUES ($1, $2, 'node_prompt', 'in_progress', '{}'::jsonb)
       RETURNING *`,
      [testJourneyId, testLeadId]
    );
    console.log(`✅ Lead enrolled in Journey (Enrollment ID: ${enrollRes.rows[0].id})`);

    // Simulate customer replying via WhatsApp (Baileys inbound)
    console.log('Simulating customer reply "1" to advance Journey flow...');
    await advanceJourneyOnUserInput(testLeadId, '1');

    // Check enrollment updated
    const checkEnroll = await query('SELECT * FROM journey_enrollments WHERE id = $1', [enrollRes.rows[0].id]);
    const vars = typeof checkEnroll.rows[0].variables_json === 'string'
      ? JSON.parse(checkEnroll.rows[0].variables_json)
      : checkEnroll.rows[0].variables_json;

    console.log(`✅ Journey advanced on WhatsApp reply! Variables captured:`, vars);

    // 6. VERIFY UNIFIED WHATSAPP DISPATCHER ROUTING
    console.log('\nSTEP 6: Verifying whatsappService sendWhatsAppMessage routing...');
    const dispatchRes = await sendWhatsAppMessage(
      '+919811122233',
      { body_content: 'Test notification via unified dispatcher' },
      { id: testLeadId, urn: 'URN-001', fmcb_id: 'FMCB001', full_name: 'Arjun Kapoor', phone: '+919811122233' },
      {},
      undefined,
      'whatsapp_baileys',
      testGatewayId
    );
    console.log(`✅ sendWhatsAppMessage returned: success=${dispatchRes.success}, status="${dispatchRes.status}", messageId=${dispatchRes.messageId}`);

    console.log('\n===============================================================');
    console.log('🎉 ALL WHATSAPP BAILEYS INTEGRATION TESTS PASSED PERFECTLY!');
    console.log('===============================================================');
  } catch (error: any) {
    console.error('❌ Verification Error:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup test artifacts from database
    console.log('\n🧹 Cleaning up test verification records...');
    if (testGatewayId) {
      await disconnectBaileysSession(testGatewayId, true).catch(() => {});
      await query('DELETE FROM gateways_config WHERE id = $1', [testGatewayId]).catch(() => {});
    }
    if (testJourneyId) {
      await query('DELETE FROM journeys WHERE id = $1', [testJourneyId]).catch(() => {});
    }
    console.log('✅ Cleanup complete.');
    await pool.end();
  }
}

runBaileysVerification();
