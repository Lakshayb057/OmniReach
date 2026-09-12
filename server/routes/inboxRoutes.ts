import express from 'express';
import { query } from '../config/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  saveInboundMessage,
  sendOutboundMessage,
  addPrivateNote,
  updateConversation,
  handoverToHumanAgent,
  isSessionActive,
  getSessionRemainingMs,
  deleteConversation,
  batchDeleteConversations,
  updateMessageReceiptStatus,
} from '../services/inboxService';
import { emitBroadcastUpdate } from '../services/worker';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `LOWER(TRIM(c.company_name)) = LOWER(TRIM($${startingIndex}))`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `LOWER(TRIM(c.company_name)) = LOWER(TRIM($${startingIndex}))`, params: [compName] };
}

// 1. List Conversations with View Filters & Search
router.get('/conversations', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { view = 'all', search, priority } = req.query;

  try {
    const compCond = getCompanyCondition(req, 1);
    const conditions: string[] = [];
    const params: any[] = [...compCond.params];
    let pIdx = params.length + 1;

    if (compCond.clause) {
      conditions.push(compCond.clause);
    }

    // View filters
    if (view === 'mine' && req.user?.id) {
      conditions.push(`c.assigned_agent_id = $${pIdx++}`);
      params.push(req.user.id);
    } else if (view === 'unassigned') {
      conditions.push(`c.assigned_agent_id IS NULL AND c.status != 'resolved'`);
    } else if (view === 'bot_handling') {
      conditions.push(`c.status = 'bot_handling'`);
    } else if (view === 'pending') {
      conditions.push(`c.status = 'pending'`);
    } else if (view === 'resolved') {
      conditions.push(`c.status = 'resolved'`);
    } else if (view === 'urgent') {
      conditions.push(`c.priority = 'urgent' AND c.status != 'resolved'`);
    } else if (view !== 'all_history') {
      // Default 'all' view shows non-resolved conversations first
      // but keeps them accessible
    }

    if (priority && priority !== 'all') {
      conditions.push(`c.priority = $${pIdx++}`);
      params.push(priority);
    }

    if (search) {
      conditions.push(`(c.contact_name ILIKE $${pIdx} OR c.phone ILIKE $${pIdx} OR c.last_message_text ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const listRes = await query(
      `SELECT c.*, 
              u.full_name as assigned_agent_name,
              u.email as assigned_agent_email,
              ml.urn, ml.fmcb_id, ml.email as lead_email, ml.city, ml.pan_no
       FROM conversations c
       LEFT JOIN users u ON c.assigned_agent_id = u.id
       LEFT JOIN campaign_master_leads ml ON c.master_lead_id = ml.id
       ${whereClause}
       ORDER BY 
         (c.priority = 'urgent' AND c.status != 'resolved') DESC,
         c.last_message_at DESC
       LIMIT 100`,
      params
    );

    // Annotate with live 24h window calculation
    const conversations = listRes.rows.map((row) => ({
      ...row,
      is_session_active: isSessionActive(row.session_expires_at),
      session_remaining_ms: getSessionRemainingMs(row.session_expires_at),
    }));

    // Stats summary
    const statsParams: any[] = [];
    let agentFilter = 'FALSE';
    if (req.user?.id) {
      statsParams.push(req.user.id);
      agentFilter = `assigned_agent_id = $${statsParams.length}`;
    }

    const statsCompCond = getCompanyCondition(req, statsParams.length + 1);
    statsParams.push(...statsCompCond.params);

    const countsRes = await query(
      `SELECT 
         count(*) FILTER (WHERE status != 'resolved') as open_count,
         count(*) FILTER (WHERE ${agentFilter} AND status != 'resolved') as mine_count,
         count(*) FILTER (WHERE assigned_agent_id IS NULL AND status != 'resolved') as unassigned_count,
         count(*) FILTER (WHERE status = 'bot_handling') as bot_count,
         count(*) FILTER (WHERE priority = 'urgent' AND status != 'resolved') as urgent_count
       FROM conversations c
       ${statsCompCond.clause ? `WHERE ${statsCompCond.clause}` : ''}`,
      statsParams
    );

    res.json({
      success: true,
      conversations,
      stats: countsRes.rows[0] || {},
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get Single Conversation Stream & Contact Info
router.get('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  try {
    const convRes = await query(
      `SELECT c.*, 
              u.full_name as assigned_agent_name,
              u.email as assigned_agent_email,
              ml.urn, ml.fmcb_id, ml.email as lead_email, ml.city, ml.pan_no,
              ml.whatsapp_optin, ml.email_optin, ml.custom_attributes, ml.clicked_count
       FROM conversations c
       LEFT JOIN users u ON c.assigned_agent_id = u.id
       LEFT JOIN campaign_master_leads ml ON c.master_lead_id = ml.id
       WHERE c.id = $1`,
      [id]
    );

    if (convRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    const row = convRes.rows[0];
    if (req.user?.role !== 'superadmin' && row.company_name && req.user?.company_name) {
      if (row.company_name.trim().toLowerCase() !== req.user.company_name.trim().toLowerCase()) {
        res.status(403).json({ success: false, message: 'Access denied: Conversation belongs to another company.' });
        return;
      }
    }

    const conversation = {
      ...row,
      is_session_active: isSessionActive(row.session_expires_at),
      session_remaining_ms: getSessionRemainingMs(row.session_expires_at),
    };

    // Fetch messages stream
    const msgRes = await query(
      `SELECT * FROM chat_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [id]
    );

    // Reset unread count
    await query(`UPDATE conversations SET unread_count = 0 WHERE id = $1`, [id]);

    // Check active journey enrollment for this contact
    let activeJourney = null;
    if (conversation.master_lead_id) {
      const jRes = await query(
        `SELECT e.*, j.name as journey_name, j.nodes_json
         FROM journey_enrollments e
         JOIN journeys j ON e.journey_id = j.id
         WHERE e.master_lead_id = $1 AND e.status = 'in_progress'
         ORDER BY e.created_at DESC LIMIT 1`,
        [conversation.master_lead_id]
      );
      if (jRes.rows.length > 0) {
        activeJourney = jRes.rows[0];
      }
    }

    res.json({
      success: true,
      conversation,
      messages: msgRes.rows,
      activeJourney,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Send Outbound Reply / Template Message
router.post('/conversations/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { content, message_type, template_name, media_url, buttons_json, is_template, gateway_id } = req.body;

  if (!content && !template_name) {
    res.status(400).json({ success: false, message: 'Message content or template name is required.' });
    return;
  }

  try {
    const newMsg = await sendOutboundMessage(
      String(id),
      {
        content: content || `[Template: ${template_name}]`,
        message_type: is_template ? 'template' : (message_type || 'text'),
        template_name,
        media_url,
        buttons_json,
        gateway_id,
      },
      req.user
    );

    res.json({ success: true, message: newMsg });
  } catch (err: any) {
    const isWindowExpired = err.message?.includes('24_HOUR_WINDOW_EXPIRED');
    res.status(isWindowExpired ? 403 : 500).json({
      success: false,
      message: err.message,
      requires_template: isWindowExpired,
    });
  }
});

// 4. Add Private Internal Agent Note
router.post('/conversations/:id/notes', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content) {
    res.status(400).json({ success: false, message: 'Note content is required.' });
    return;
  }

  try {
    const note = await addPrivateNote(String(id), content, req.user || { id: 'agent', full_name: 'Agent' });
    res.json({ success: true, note });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Update Conversation State (Status, Assignment, Priority, Tags)
router.put('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { status, assigned_agent_id, priority, tags, contact_name } = req.body;

  try {
    const updated = await updateConversation(
      String(id),
      { status, assigned_agent_id, priority, tags, contact_name },
      req.user
    );
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Bot to Human Handover
router.post('/conversations/:id/handover', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { target_agent_id, reason } = req.body;

  try {
    const updated = await handoverToHumanAgent(String(id), target_agent_id, reason || 'Manual agent handover');
    res.json({ success: true, conversation: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Canned Responses / Quick Replies
router.get('/canned-responses', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';
    const cannedRes = await query(
      `SELECT c.* FROM canned_responses c ${whereClause} ORDER BY c.shortcut ASC`,
      compCond.params
    );
    res.json({ success: true, cannedResponses: cannedRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/canned-responses', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { shortcut, title, content, category } = req.body;
  if (!shortcut || !title || !content) {
    res.status(400).json({ success: false, message: 'Shortcut, title, and content are required.' });
    return;
  }

  const assignedCompany = req.user?.company_name || 'OmniReach Global';

  try {
    const cleanShortcut = shortcut.startsWith('/') ? shortcut : `/${shortcut}`;
    const insertRes = await query(
      `INSERT INTO canned_responses (company_name, shortcut, title, content, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [assignedCompany, cleanShortcut, title, content, category || 'general']
    );
    res.json({ success: true, cannedResponse: insertRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/canned-responses/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $2';
    const params = req.user?.role === 'superadmin' ? [id] : [id, req.user?.company_name];
    await query(`DELETE FROM canned_responses WHERE id = $1 ${compCond}`, params);
    res.json({ success: true, message: 'Canned response removed.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Public Inbound WhatsApp Webhook (Gupshup / Meta Cloud API Gateway)
router.post('/webhook', async (req, res): Promise<void> => {
  try {
    const body = req.body;

    // Handle Meta WhatsApp Cloud Webhook Payload format
    const entry = body?.entry?.[0]?.changes?.[0]?.value;

    // Handle Meta Status Updates (Sent, Delivered, Read receipts)
    if (entry?.statuses && entry.statuses.length > 0) {
      for (const st of entry.statuses) {
        const wamid = st.id;
        const status = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
        if (wamid && (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed')) {
          await updateMessageReceiptStatus(wamid, status);
        }
      }
      res.status(200).send('EVENT_RECEIVED');
      return;
    }

    if (entry?.messages && entry.messages.length > 0) {
      const msg = entry.messages[0];
      const senderPhone = msg.from;
      const contactName = entry.contacts?.[0]?.profile?.name || 'Customer';
      let textContent = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '';

      await saveInboundMessage({
        phone: senderPhone,
        text: textContent,
        contact_name: contactName,
        whatsapp_message_id: msg.id,
      });

      res.status(200).send('EVENT_RECEIVED');
      return;
    }

    // Handle Gupshup Inbound Payload format
    if (body?.type === 'message' || body?.payload) {
      const senderPhone = body.sender?.phone || body.payload?.sender?.phone || body.phone;
      const textContent = body.payload?.text || body.payload?.payload?.text || body.text || '';
      const contactName = body.sender?.name || body.name || 'Customer';

      if (senderPhone) {
        await saveInboundMessage({
          phone: senderPhone,
          text: textContent,
          contact_name: contactName,
          whatsapp_message_id: body.payload?.id || body.id,
        });
      }

      res.status(200).send('EVENT_RECEIVED');
      return;
    }

    // Handle direct test simulation payload
    if (body?.phone && body?.text) {
      const result = await saveInboundMessage({
        phone: body.phone,
        text: body.text,
        contact_name: body.contact_name || 'Simulated Customer',
        company_name: body.company_name || 'OmniReach Global',
      });
      res.json({ success: true, result });
      return;
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (err: any) {
    console.error('Webhook ingestion error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Meta Webhook Verification GET
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.META_WEBHOOK_VERIFY_TOKEN || 'omnireach_verify_token')) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// 8. Delete Single Conversation
router.delete('/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const deleted = await deleteConversation(String(id), req.user);
    res.json({ success: true, message: 'Conversation removed from live box.', conversation: deleted });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ success: false, message: err.message });
  }
});

// 9. Bulk Delete Conversations
const handleBatchDeleteConversations = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { conversation_ids } = req.body;
  if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No conversation IDs provided for deletion.' });
    return;
  }
  try {
    const result = await batchDeleteConversations(conversation_ids, req.user);
    res.json({ success: true, message: `Successfully removed ${result.count} conversations.`, count: result.count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/conversations/bulk-delete', authenticateToken, handleBatchDeleteConversations);
router.post('/conversations/bulk-delete', authenticateToken, handleBatchDeleteConversations);

export default router;
