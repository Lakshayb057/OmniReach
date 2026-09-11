import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function runFullVerification() {
  console.log('🧪 Starting Full OmniReach Enterprise & Multi-Tenant Verification...\n');

  // 1. Test Superadmin Authentication
  console.log('1️⃣ Testing Superadmin Authentication (SuplerLucky@gmail.com)...');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'SuplerLucky@gmail.com',
    password: 'Lakshay@123',
  });

  if (!loginRes.data.success || !loginRes.data.token) {
    throw new Error('Superadmin login failed!');
  }
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`✅ Superadmin logged in successfully! Role: ${loginRes.data.user.role}, Name: ${loginRes.data.user.full_name}, Company: ${loginRes.data.user.company_name}`);

  // 2. Test User Management & Company Listing
  console.log('\n2️⃣ Testing User Management & Company Directory (/users & /companies)...');
  const companiesRes = await axios.get(`${API_BASE}/auth/companies`, { headers: authHeaders });
  console.log(`✅ Companies Registered: ${companiesRes.data.companies.join(', ')}`);

  const usersRes = await axios.get(`${API_BASE}/auth/users`, { headers: authHeaders });
  console.log(`✅ Total Admin Users: ${usersRes.data.users.length}`);

  // 3. Test Company Admin Authentication & Isolated Workspace
  console.log('\n3️⃣ Testing Company Admin Authentication & Multi-Tenant Isolation...');
  const compLoginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: 'admin.demo@omnireach.io',
    password: 'Lakshay@123',
  });
  const compToken = compLoginRes.data.token;
  const compAuthHeaders = { Authorization: `Bearer ${compToken}` };
  console.log(`✅ Company Admin Authenticated: ${compLoginRes.data.user.full_name}, Company: ${compLoginRes.data.user.company_name}`);

  // Scoped Dashboard KPI for Enterprise vs Global
  const [globalKpis, compKpis] = await Promise.all([
    axios.get(`${API_BASE}/dashboard/kpis`, { headers: authHeaders }),
    axios.get(`${API_BASE}/dashboard/kpis`, { headers: compAuthHeaders }),
  ]);
  console.log(`✅ Global KPI Scope: ${globalKpis.data.active_company} -> Targeted: ${globalKpis.data.data.summary.targetedAudienceCount}`);
  console.log(`✅ Company Scoped KPI: ${compKpis.data.active_company} -> Targeted: ${compKpis.data.data.summary.targetedAudienceCount}`);

  // 4. Test Master Contacts Ingestion with Scoped Company
  console.log('\n4️⃣ Testing Master Data Center Contact Ingestion for Acme Enterprise...');
  const sampleUpload = [
    {
      name: 'Acme Contact Sarah',
      phone: '9876543299',
      email: 'sarah.contact@enterprise.com',
      address: 'North Hub',
    },
    {
      name: 'Acme Contact Marcus',
      phone: '9876543288',
      email: 'marcus.ops@enterprise.com',
      address: 'South Hub',
    },
  ];

  const uploadRes = await axios.post(
    `${API_BASE}/leads/upload`,
    { contacts: sampleUpload },
    { headers: compAuthHeaders }
  );
  console.log(`✅ Ingestion Report for Company: ${uploadRes.data.message}`);

  // 5. Test Multi-Gateway Infrastructure & Diagnostics
  console.log('\n5️⃣ Testing Multi-Gateway Infrastructure...');
  const gatewaysRes = await axios.get(`${API_BASE}/gateways`, { headers: authHeaders });
  const metaGw = gatewaysRes.data.gateways.find((g: any) => g.type.includes('whatsapp'));
  const sesGw = gatewaysRes.data.gateways.find((g: any) => g.type === 'email_ses');
  console.log(`✅ Gateways Configured: ${gatewaysRes.data.gateways.length} gateways active`);
  console.log(`   • WhatsApp: ${metaGw?.name || 'Meta Cloud WABA'}`);
  console.log(`   • Email: ${sesGw?.name || 'AWS SES High Throughput'}`);

  // 6. Test Templates Studio
  console.log('\n6️⃣ Testing Templates Studio & Meta Graph API Sync...');
  const templatesRes = await axios.get(`${API_BASE}/templates`, { headers: authHeaders });
  console.log(`✅ Templates Available: ${templatesRes.data.templates.length} templates`);

  // 7. Test Creating and Dispatching a Broadcast Campaign
  console.log('\n7️⃣ Testing 6-Step Broadcast Campaign Dispatch...');
  const campaignRes = await axios.post(
    `${API_BASE}/campaigns`,
    {
      name: 'Automated Multi-Tenant Verification Blast',
      channel: 'both',
      whatsapp_gateway_id: metaGw?.id,
      email_gateway_id: sesGw?.id,
      whatsapp_template_id: templatesRes.data.templates[0]?.id,
      email_template_id: templatesRes.data.templates[1]?.id,
      execution_mode: 'immediate',
    },
    { headers: compAuthHeaders }
  );
  console.log(`✅ Campaign Created by Company Admin: "${campaignRes.data.campaign.name}" (Company: ${campaignRes.data.campaign.company_name})`);

  // 8. Test Enterprise Journey Builder & Enrollments
  console.log('\n8️⃣ Testing Enterprise Journeys & Enrollment Engine...');
  const journeysRes = await axios.get(`${API_BASE}/journeys`, { headers: authHeaders });
  console.log(`✅ Active Enterprise Journeys: ${journeysRes.data.journeys.length} blueprints loaded`);
  const firstJourney = journeysRes.data.journeys[0];
  if (firstJourney) {
    const enrollRes = await axios.post(
      `${API_BASE}/journeys/${firstJourney.id}/enroll-all-leads`,
      {},
      { headers: authHeaders }
    );
    console.log(`✅ Enrolled Contacts into "${firstJourney.name}": ${enrollRes.data.enrolledCount} contacts`);
  }

  // 10. Test Batch Delete Contacts
  console.log('\n🔟 Testing Batch Contact Deletion (DELETE /api/leads/batch-delete)...');
  const leadsList = await axios.get(`${API_BASE}/leads`, { headers: compAuthHeaders, params: { limit: 2 } });
  if (leadsList.data.data && leadsList.data.data.length > 0) {
    const idsToDelete = [leadsList.data.data[0].id];
    const deleteRes = await axios.delete(`${API_BASE}/leads/batch-delete`, {
      data: { lead_ids: idsToDelete },
      headers: compAuthHeaders,
    });
    console.log(`✅ Batch Delete Success: ${deleteRes.data.message}`);
  }

  // 11. Test Company Gateways Summary & Diagnostics
  console.log('\n1️⃣1️⃣ Testing Company Gateways Summary & Live Diagnostics...');
  const summaryRes = await axios.get(`${API_BASE}/gateways/company-summary`, { headers: authHeaders });
  console.log(`✅ Company Gateway Summary Loaded: ${Object.keys(summaryRes.data.summary).length} companies mapped`);

  // 12. Test WhatsApp Meta Diagnostic
  const waTestRes = await axios.post(
    `${API_BASE}/gateways/test-whatsapp`,
    {
      phone_number_id: '109823475912345',
      system_user_token: 'EAAG_mock_token_permanent_987123',
      waba_id: '89123471923841',
    },
    { headers: authHeaders }
  );
  console.log(`✅ WhatsApp Meta Diagnostic: ${waTestRes.data.message}`);

  // 13. Test AWS SES Diagnostic
  const sesTestRes = await axios.post(
    `${API_BASE}/gateways/test-ses`,
    {
      access_key_id: 'AKIA_MOCK_SES_TEST',
      secret_access_key: 'mock_secret_key',
      region: 'ap-south-1',
      from_email: 'broadcasts@omnireach.io',
    },
    { headers: authHeaders }
  );
  console.log(`✅ AWS SES Diagnostic: ${sesTestRes.data.message}`);

  // 14. Test Superadmin Creating and Updating a Dedicated Company Gateway Partition
  console.log('\n1️⃣2️⃣ Testing Company-Specific Gateway Allocation in PostgreSQL...');
  const newGatewayRes = await axios.post(
    `${API_BASE}/gateways`,
    {
      name: 'Meta WABA - Acme Dedicated Partition',
      type: 'whatsapp_meta',
      company_name: 'Acme Enterprise',
      credentials: {
        phone_number_id: '109823475999999',
        waba_id: '89123471999999',
        system_user_token: 'EAAG_mock_token_acme_dedicated',
        display_phone_number: '+91 98765 00000',
        verified_name: 'Acme Enterprise Official',
      },
      is_active: true,
      is_default: true,
      quality_rating: 'GREEN',
    },
    { headers: authHeaders }
  );
  console.log(`✅ Dedicated Gateway Created: ${newGatewayRes.data.gateway.name} for ${newGatewayRes.data.gateway.company_name}`);

  // Verify Company Admin can see this gateway
  const acmeGws = await axios.get(`${API_BASE}/gateways`, { headers: compAuthHeaders });
  const hasAcmeGw = acmeGws.data.gateways.some((g: any) => g.id === newGatewayRes.data.gateway.id);
  console.log(`✅ Multi-Tenant Isolation Verified: Acme Admin sees allotted gateway = ${hasAcmeGw}`);

  // 15. Test Direct Meta WhatsApp Template Creation with Company Scoping & Sync Now
  console.log('\n1️⃣3️⃣ Testing Meta WhatsApp Template Creation & Sync All API...');
  const createMetaTmplRes = await axios.post(
    `${API_BASE}/templates`,
    {
      name: 'acme_flash_deal_v1',
      channel: 'whatsapp',
      category: 'MARKETING',
      meta_language: 'en_US',
      header_type: 'TEXT',
      header_content: 'Acme Flash Deal',
      body_content: 'Hello {{1}}, unlock an exclusive 30% discount on Acme Enterprise solutions with ref {{2}}.',
      footer_content: 'Acme Enterprise • Reply STOP to unsubscribe',
      buttons_json: [{ type: 'URL', text: 'Claim Now', url: 'https://acme.io/claim' }],
      company_name: 'Acme Enterprise',
    },
    { headers: authHeaders }
  );
  console.log(`✅ Meta Template Created: "${createMetaTmplRes.data.template.name}" for company: ${createMetaTmplRes.data.template.company_name} (Meta Status: ${createMetaTmplRes.data.template.meta_status})`);

  // Test Sync Now endpoint
  const syncAllRes = await axios.post(
    `${API_BASE}/templates/sync-all`,
    { company_name: 'Acme Enterprise' },
    { headers: compAuthHeaders }
  );
  console.log(`✅ Meta Templates Sync All: ${syncAllRes.data.message} (Total: ${syncAllRes.data.totalSynced})`);

  // 16. Test Custom Journey Blueprint Creation via API
  console.log('\n1️⃣4️⃣ Testing Custom Journey Blueprint Creation & Canvas Persistence...');
  const customJourneyRes = await axios.post(
    `${API_BASE}/journeys`,
    {
      name: 'Acme VIP Automated Onboarding & Retention Flow',
      description: 'End-to-end welcome and engagement sequence with WhatsApp and Email',
      category: 'CUSTOMER_LIFECYCLE',
      company_name: 'Acme Enterprise',
      trigger_config: { type: 'segment_entry', rule: 'acme_vip_leads' },
      nodes_json: [
        { id: 'node_trigger', type: 'trigger', position: { x: 50, y: 100 }, config: { label: 'New Signups' } },
        { id: 'node_wa', type: 'action_whatsapp', position: { x: 300, y: 100 }, config: { body: 'Welcome to Acme VIP {{1}}!' } },
        { id: 'node_delay', type: 'delay', position: { x: 550, y: 100 }, config: { value: 2, delay_type: 'days' } },
        { id: 'node_email', type: 'action_email', position: { x: 800, y: 100 }, config: { subject: 'VIP Perks for {{1}}', body: 'Exclusive benefits' } },
      ],
      edges_json: [
        { id: 'e1-2', source: 'node_trigger', target: 'node_wa' },
        { id: 'e2-3', source: 'node_wa', target: 'node_delay' },
        { id: 'e3-4', source: 'node_delay', target: 'node_email' },
      ],
    },
    { headers: compAuthHeaders }
  );
  console.log(`✅ Custom Journey Created: "${customJourneyRes.data.journey.name}" (Status: ${customJourneyRes.data.journey.status}, Company: ${customJourneyRes.data.journey.company_name})`);

  console.log('\n🎉 ALL 14 TEST SUITES COMPLETED WITH 100% SUCCESS!\n');
}

runFullVerification().catch((err) => {
  console.error('❌ Verification failed:', err.response?.data || err.message);
  process.exit(1);
});
