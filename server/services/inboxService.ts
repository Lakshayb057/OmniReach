import { query } from '../config/db';
import { emitBroadcastUpdate } from './worker';
import { sendWhatsAppMessage } from './whatsappService';
import { normalizePhone } from './leadsMatcher';
import { advanceJourneyOnUserInput } from './journeyEngine';
import { isOptOutMessage, isOptInMessage } from './antiBanService';
import { logMessagingEvent } from '../utils/logger';

export interface OutboundMessageOptions {
  content: string;
  message_type?: 'text' | 'template' | 'image' | 'video' | 'document' | 'interactive_button' | 'interactive_list';
  template_name?: string;
  template_id?: string;
  media_url?: string;
  buttons_json?: any[];
  isBot?: boolean;
  gateway_id?: string;
}

export interface InboundMessagePayload {
  phone: string;
  text: string;
  contact_name?: string;
  company_name?: string;
  gateway_id?: string;
  whatsapp_message_id?: string;
  media_url?: string;
  message_type?: string;
  button_payload?: string;
}

/**
 * Checks if a 24-hour WhatsApp session window is currently active
 */
export function isSessionActive(sessionExpiresAt: Date | string | null | undefined): boolean {
  if (!sessionExpiresAt) return false;
  const expiryTime = new Date(sessionExpiresAt).getTime();
  return expiryTime > Date.now();
}

/**
 * Calculates milliseconds remaining in the 24-hour WhatsApp session window
 */
export function getSessionRemainingMs(sessionExpiresAt: Date | string | null | undefined): number {
  if (!sessionExpiresAt) return 0;
  const remaining = new Date(sessionExpiresAt).getTime() - Date.now();
  return Math.max(0, remaining);
}

/**
 * Find or create a WhatsApp conversation thread strictly isolated per company
 */
export async function findOrCreateConversation(
  phone: string,
  contactName?: string,
  companyName: string = 'OmniReach Global',
  masterLeadId?: string,
  gatewayId?: string
) {
  const cleanPhone = normalizePhone(phone) || phone;

  // 1. Check existing conversation strictly matching this company
  let convRes = await query(
    `SELECT c.*, u.full_name as assigned_agent_name, ml.urn, ml.fmcb_id, ml.email, ml.city, ml.pan_no
     FROM conversations c
     LEFT JOIN users u ON c.assigned_agent_id = u.id
     LEFT JOIN campaign_master_leads ml ON c.master_lead_id = ml.id
     WHERE c.phone = $1 AND LOWER(TRIM(c.company_name)) = LOWER(TRIM($2))
     ORDER BY c.updated_at DESC LIMIT 1`,
    [cleanPhone, companyName]
  );

  if (convRes.rows.length > 0) {
    if (gatewayId && !convRes.rows[0].last_gateway_id) {
      await query(`UPDATE conversations SET last_gateway_id = $1 WHERE id = $2`, [gatewayId, convRes.rows[0].id]);
      convRes.rows[0].last_gateway_id = gatewayId;
    }
    return convRes.rows[0];
  }

  // 2. Lookup in Master Leads Repository scoped strictly to this company
  let leadId = masterLeadId;
  let resolvedName = contactName || 'WhatsApp Customer';

  if (!leadId) {
    const leadRes = await query(
      `SELECT id, full_name, email, city, pan_no, urn, fmcb_id 
       FROM campaign_master_leads 
       WHERE (phone = $1 OR phone LIKE $2)
         AND (LOWER(TRIM(company_name)) = LOWER(TRIM($3)) OR company_name = 'OmniReach Global' OR company_name IS NULL)
       ORDER BY (LOWER(TRIM(company_name)) = LOWER(TRIM($3))) DESC
       LIMIT 1`,
      [cleanPhone, `%${cleanPhone.slice(-10)}`, companyName]
    );
    if (leadRes.rows.length > 0) {
      leadId = leadRes.rows[0].id;
      resolvedName = leadRes.rows[0].full_name || resolvedName;
    }
  }

  // 3. Insert new conversation with 24-hour window strictly for this company
  const insertRes = await query(
    `INSERT INTO conversations (company_name, master_lead_id, phone, contact_name, status, priority, session_expires_at, unread_count, last_gateway_id)
     VALUES ($1, $2, $3, $4, 'open', 'medium', CURRENT_TIMESTAMP + INTERVAL '24 hours', 0, $5)
     RETURNING *`,
    [companyName, leadId || null, cleanPhone, resolvedName, gatewayId || null]
  );

  return insertRes.rows[0];
}

/**
 * Update message delivery / read status receipt without downgrading
 */
export async function updateMessageReceiptStatus(
  whatsappMessageId: string,
  newStatus: 'sent' | 'delivered' | 'read' | 'failed'
) {
  if (!whatsappMessageId) return null;

  const rank: Record<string, number> = {
    failed: 0,
    queued: 1,
    sent: 2,
    delivered: 3,
    read: 4,
  };

  const currentRes = await query(
    `SELECT cm.*, c.company_name, c.phone 
     FROM chat_messages cm
     JOIN conversations c ON cm.conversation_id = c.id
     WHERE cm.whatsapp_message_id = $1
     LIMIT 1`,
    [whatsappMessageId]
  );

  if (currentRes.rows.length === 0) return null;

  const currentMsg = currentRes.rows[0];
  const currentRank = rank[currentMsg.status] || 0;
  const targetRank = rank[newStatus] || 0;

  // Only advance status (e.g. sent -> delivered -> read). Do not downgrade read -> delivered.
  if (targetRank <= currentRank && currentMsg.status !== 'queued') {
    return currentMsg;
  }

  const updateRes = await query(
    `UPDATE chat_messages 
     SET status = $1 
     WHERE id = $2 
     RETURNING *`,
    [newStatus, currentMsg.id]
  );

  const updatedMsg = updateRes.rows[0];

  // Broadcast live status update to all connected inbox clients
  emitBroadcastUpdate({
    type: 'INBOX_MESSAGE_STATUS',
    conversation_id: updatedMsg.conversation_id,
    message_id: updatedMsg.id,
    whatsapp_message_id: whatsappMessageId,
    status: newStatus,
    company_name: currentMsg.company_name,
  });

  logMessagingEvent({
    action: 'STATUS_CHANGE',
    phone: currentMsg.phone,
    companyName: currentMsg.company_name,
    status: newStatus,
    messageId: whatsappMessageId,
  });

  return updatedMsg;
}

/**
 * Ingest an incoming message from a customer (via Webhook, Simulator, or live API)
 */
export async function saveInboundMessage(payload: InboundMessagePayload) {
  const cleanPhone = normalizePhone(payload.phone) || payload.phone;
  let company = payload.company_name;

  // Enforce company from gateway if gateway_id is provided
  if (payload.gateway_id) {
    const gwRes = await query('SELECT company_name FROM gateways_config WHERE id = $1', [payload.gateway_id]);
    if (gwRes.rows.length > 0 && gwRes.rows[0].company_name) {
      company = gwRes.rows[0].company_name;
    }
  }

  if (!company) {
    company = 'OmniReach Global';
  }

  // 1. Find or create conversation strictly for this company
  const conv = await findOrCreateConversation(cleanPhone, payload.contact_name, company, undefined, payload.gateway_id);

  const wamid = payload.whatsapp_message_id || `wamid_in_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const msgType = payload.message_type || 'text';
  const content = payload.text || payload.button_payload || '';

  // 2. Insert message into chat_messages
  const msgRes = await query(
    `INSERT INTO chat_messages (conversation_id, whatsapp_message_id, direction, sender_type, sender_name, message_type, content, media_url, status)
     VALUES ($1, $2, 'inbound', 'customer', $3, $4, $5, $6, 'delivered')
     RETURNING *`,
    [conv.id, wamid, conv.contact_name, msgType, content, payload.media_url || null]
  );

  const newMsg = msgRes.rows[0];

  logMessagingEvent({
    action: 'INBOUND_RECEIVED',
    phone: cleanPhone,
    companyName: company,
    messageId: wamid,
    textSnippet: content,
  });

  // 3. Anti-Ban Opt-out / Opt-in detection
  const isStop = isOptOutMessage(content);
  const isStart = isOptInMessage(content);

  if (isStop) {
    console.log(`🛑 Anti-Ban: Inbound STOP detected from ${cleanPhone}. Suppressing WhatsApp opt-in.`);
    if (conv.master_lead_id) {
      await query(
        `UPDATE campaign_master_leads 
         SET whatsapp_optin = false, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [conv.master_lead_id]
      );
    } else {
      await query(
        `UPDATE campaign_master_leads 
         SET whatsapp_optin = false, updated_at = CURRENT_TIMESTAMP 
         WHERE phone = $1 OR phone LIKE $2`,
        [cleanPhone, `%${cleanPhone.slice(-10)}`]
      );
    }

    await query(
      `UPDATE conversations 
       SET last_message_text = $1,
           last_message_at = CURRENT_TIMESTAMP,
           status = 'resolved',
           tags = array_append(array_remove(tags, 'opted_out'), 'opted_out'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [content.slice(0, 500), conv.id]
    );
  } else if (isStart) {
    console.log(`✅ Anti-Ban: Inbound START detected from ${cleanPhone}. Restoring WhatsApp opt-in.`);
    if (conv.master_lead_id) {
      await query(
        `UPDATE campaign_master_leads 
         SET whatsapp_optin = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [conv.master_lead_id]
      );
    } else {
      await query(
        `UPDATE campaign_master_leads 
         SET whatsapp_optin = true, updated_at = CURRENT_TIMESTAMP 
         WHERE phone = $1 OR phone LIKE $2`,
        [cleanPhone, `%${cleanPhone.slice(-10)}`]
      );
    }

    await query(
      `UPDATE conversations 
       SET last_message_text = $1,
           last_message_at = CURRENT_TIMESTAMP,
           status = 'open',
           tags = array_remove(tags, 'opted_out'),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [content.slice(0, 500), conv.id]
    );
  } else {
    // Refresh 24-Hour window & reopen if resolved
    const newStatus = conv.status === 'resolved' ? 'open' : conv.status;
    await query(
      `UPDATE conversations 
       SET last_message_text = $1,
           last_message_at = CURRENT_TIMESTAMP,
           session_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours',
           unread_count = unread_count + 1,
           status = $2,
           last_gateway_id = COALESCE($3, last_gateway_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [content.slice(0, 500), newStatus, payload.gateway_id || null, conv.id]
    );
  }

  // 4. Check if a Journey is waiting for user input on this contact (skip if customer sent STOP)
  if (conv.master_lead_id && !isStop) {
    try {
      await advanceJourneyOnUserInput(conv.master_lead_id, content);
    } catch (jErr) {
      console.error('Error advancing journey on user input:', jErr);
    }
  }

  // 5. Broadcast real-time Socket.IO events
  emitBroadcastUpdate({
    type: 'INBOX_MESSAGE_RECEIVED',
    conversation_id: conv.id,
    message: newMsg,
    phone: cleanPhone,
    contact_name: conv.contact_name,
    gateway_id: payload.gateway_id,
    company_name: company,
  });

  emitBroadcastUpdate({
    type: 'CONVERSATION_UPDATED',
    conversation_id: conv.id,
    company_name: company,
  });

  return { conversation: conv, message: newMsg };
}

/**
 * Send an outbound reply from an agent or bot
 */
export async function sendOutboundMessage(
  conversationId: string,
  options: OutboundMessageOptions,
  agentUser?: { id?: string; full_name?: string; company_name?: string }
) {
  // 1. Fetch conversation
  const convRes = await query(
    `SELECT c.*, ml.urn, ml.fmcb_id, ml.full_name as lead_name, ml.email as lead_email 
     FROM conversations c
     LEFT JOIN campaign_master_leads ml ON c.master_lead_id = ml.id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convRes.rows.length === 0) {
    throw new Error('Conversation not found');
  }

  const conv = convRes.rows[0];
  const activeSession = isSessionActive(conv.session_expires_at);

  // 2. Resolve WhatsApp Gateway Credentials & Type (Supports Multi-Gateway Selection)
  let waGw: any = null;
  if (options.gateway_id) {
    const specificGwRes = await query(
      `SELECT id, credentials, type FROM gateways_config WHERE id = $1 AND is_active = true`,
      [options.gateway_id]
    );
    if (specificGwRes.rows.length > 0) {
      waGw = specificGwRes.rows[0];
    }
  }

  if (!waGw) {
    const compName = conv.company_name || agentUser?.company_name || 'OmniReach Global';
    if (conv.last_gateway_id) {
      const prevGwRes = await query(
        `SELECT id, credentials, type FROM gateways_config WHERE id = $1 AND is_active = true`,
        [conv.last_gateway_id]
      );
      if (prevGwRes.rows.length > 0) {
        waGw = prevGwRes.rows[0];
      }
    }
    if (!waGw) {
      const gwRes = await query(
        `SELECT id, credentials, type FROM gateways_config 
         WHERE (company_name = $1 OR company_name = 'OmniReach Global') 
           AND type LIKE 'whatsapp%' AND is_active = true 
         ORDER BY (company_name = $1) DESC, is_default DESC LIMIT 1`,
        [compName]
      );
      waGw = gwRes.rows[0];
    }
  }

  const waCredentials = waGw?.credentials || {};
  const waType = waGw?.type || 'whatsapp_meta';
  const waId = waGw?.id;
  const isBaileys = waType === 'whatsapp_baileys' || waType.includes('baileys');

  // 3. Validate 24-hour session window policy (Only strictly enforced on Meta Cloud API)
  const isTemplateMessage = options.message_type === 'template' || Boolean(options.template_name);

  if (!isBaileys && !activeSession && !isTemplateMessage) {
    throw new Error('24_HOUR_WINDOW_EXPIRED: The 24-hour customer session has expired. You must use an approved WhatsApp Template message to initiate communication on Meta Cloud API.');
  }

  // 4. Dispatch through WhatsApp Service
  const leadContext = {
    id: conv.master_lead_id || conv.id,
    urn: conv.urn || 'URN-WHATSAPP',
    fmcb_id: conv.fmcb_id || 'OMCB00001',
    full_name: conv.contact_name,
    phone: conv.phone,
    email: conv.lead_email,
  };

  const templatePayload = {
    body_content: options.content,
    meta_template_name: options.template_name,
    buttons_json: options.buttons_json,
  };

  const sendResult = await sendWhatsAppMessage(
    conv.phone,
    templatePayload,
    leadContext,
    waCredentials,
    undefined,
    waType,
    waId
  );

  const wamid = sendResult.messageId || `wamid_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const senderType = options.isBot ? 'bot' : 'agent';
  const senderName = options.isBot ? 'OmniReach AI' : (agentUser?.full_name || 'Support Agent');

  // 5. Store message in chat_messages
  const msgRes = await query(
    `INSERT INTO chat_messages (conversation_id, whatsapp_message_id, direction, sender_type, sender_id, sender_name, message_type, content, media_url, template_name, status)
     VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      conv.id,
      wamid,
      senderType,
      agentUser?.id || null,
      senderName,
      options.message_type || 'text',
      options.content,
      options.media_url || null,
      options.template_name || null,
      sendResult.status === 'delivered' ? 'delivered' : 'sent',
    ]
  );

  const newMsg = msgRes.rows[0];

  // 6. Update conversation state (mark unread as 0 since agent responded, preserve gateway used)
  await query(
    `UPDATE conversations 
     SET last_message_text = $1,
         last_message_at = CURRENT_TIMESTAMP,
         unread_count = 0,
         last_gateway_id = COALESCE($3, last_gateway_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [options.content.slice(0, 500), conv.id, waGw?.id || null]
  );

  // 7. Emit real-time events
  emitBroadcastUpdate({
    type: 'INBOX_MESSAGE_SENT',
    conversation_id: conv.id,
    message: newMsg,
    company_name: conv.company_name,
  });

  emitBroadcastUpdate({
    type: 'CONVERSATION_UPDATED',
    conversation_id: conv.id,
    company_name: conv.company_name,
  });

  logMessagingEvent({
    action: 'OUTBOUND_SENT',
    phone: conv.phone,
    companyName: conv.company_name,
    gatewayName: waGw?.name || waType,
    status: newMsg.status,
    messageId: wamid,
    user: agentUser as any,
    textSnippet: options.content,
  });

  return newMsg;
}

/**
 * Add a private internal note to a conversation (visible only to agents)
 */
export async function addPrivateNote(
  conversationId: string,
  noteContent: string,
  agentUser: { id?: string; full_name?: string }
) {
  const msgRes = await query(
    `INSERT INTO chat_messages (conversation_id, direction, sender_type, sender_id, sender_name, message_type, content, status)
     VALUES ($1, 'outbound', 'agent', $2, $3, 'note', $4, 'read')
     RETURNING *`,
    [conversationId, agentUser.id || null, agentUser.full_name || 'Agent', noteContent]
  );

  const note = msgRes.rows[0];

  emitBroadcastUpdate({
    type: 'INBOX_NOTE_ADDED',
    conversation_id: conversationId,
    message: note,
  });

  return note;
}

/**
 * Update conversation status, agent assignment, priority, or tags
 */
export async function updateConversation(
  conversationId: string,
  updates: {
    status?: 'open' | 'bot_handling' | 'pending' | 'resolved';
    assigned_agent_id?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    tags?: string[];
    contact_name?: string;
  },
  agentUser?: any
) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.assigned_agent_id !== undefined) {
    fields.push(`assigned_agent_id = $${idx++}`);
    params.push(updates.assigned_agent_id);
  }
  if (updates.priority !== undefined) {
    fields.push(`priority = $${idx++}`);
    params.push(updates.priority);
  }
  if (updates.tags !== undefined) {
    fields.push(`tags = $${idx++}`);
    params.push(updates.tags);
  }
  if (updates.contact_name !== undefined) {
    fields.push(`contact_name = $${idx++}`);
    params.push(updates.contact_name);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(conversationId);

  const res = await query(
    `UPDATE conversations 
     SET ${fields.join(', ')} 
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  if (res.rows.length > 0) {
    emitBroadcastUpdate({
      type: 'CONVERSATION_UPDATED',
      conversation_id: conversationId,
      updates,
    });
  }

  return res.rows[0];
}

/**
 * Handover conversation from Bot to Human Agent
 */
export async function handoverToHumanAgent(
  conversationId: string,
  targetAgentId?: string,
  handoverReason: string = 'Transferred by automated journey workflow'
) {
  const updatedConv = await updateConversation(conversationId, {
    status: 'open',
    assigned_agent_id: targetAgentId || null,
    priority: 'high',
  });

  // Log system notification message
  await query(
    `INSERT INTO chat_messages (conversation_id, direction, sender_type, sender_name, message_type, content, status)
     VALUES ($1, 'outbound', 'system', 'Workflow Engine', 'note', $2, 'read')`,
    [conversationId, `🤖 Handover: ${handoverReason}`]
  );

  emitBroadcastUpdate({
    type: 'CONVERSATION_HANDOVER',
    conversation_id: conversationId,
    reason: handoverReason,
  });

  return updatedConv;
}

/**
 * Delete a single conversation from the WhatsApp Live Box
 */
export async function deleteConversation(conversationId: string, user?: any) {
  let querySql = `DELETE FROM conversations WHERE id = $1`;
  const params: any[] = [conversationId];

  if (user?.role !== 'superadmin') {
    querySql += ` AND company_name = $2`;
    params.push(user?.company_name || 'Independent Enterprise');
  }

  querySql += ` RETURNING id, company_name, contact_name, phone`;
  const delRes = await query(querySql, params);

  if (delRes.rows.length === 0) {
    throw new Error('Conversation not found or access denied.');
  }

  const deletedConv = delRes.rows[0];

  emitBroadcastUpdate({
    type: 'CONVERSATION_DELETED',
    conversation_id: conversationId,
    company_name: deletedConv.company_name,
  });

  return deletedConv;
}

/**
 * Bulk delete conversations from the WhatsApp Live Box
 */
export async function batchDeleteConversations(conversationIds: string[], user?: any) {
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return { count: 0 };
  }

  let querySql = `DELETE FROM conversations WHERE id = ANY($1::uuid[])`;
  const params: any[] = [conversationIds];

  if (user?.role !== 'superadmin') {
    querySql += ` AND company_name = $2`;
    params.push(user?.company_name || 'Independent Enterprise');
  }

  querySql += ` RETURNING id, company_name`;
  const delRes = await query(querySql, params);

  for (const row of delRes.rows) {
    emitBroadcastUpdate({
      type: 'CONVERSATION_DELETED',
      conversation_id: row.id,
      company_name: row.company_name,
    });
  }

  return { count: delRes.rowCount || delRes.rows.length };
}
