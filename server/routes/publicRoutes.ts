import express from 'express';
import { query } from '../config/db';
import { emitBroadcastUpdate } from '../services/worker';
import { normalizePhone } from '../services/leadsMatcher';

const router = express.Router();

// 1. Universal CTR Click Tracking Engine: /api/c/t/:broadcastId/:masterLeadId
router.get('/c/t/:broadcastId/:masterLeadId', async (req, res): Promise<void> => {
  const { broadcastId, masterLeadId } = req.params;
  const destinationUrl = (req.query.url as string) || 'https://omnireach.io';

  try {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Record CTR Click Log
    await query(
      `INSERT INTO ctr_clicks (broadcast_id, master_lead_id, destination_url, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        broadcastId !== 'general' ? broadcastId : null,
        masterLeadId !== 'general' ? masterLeadId : null,
        destinationUrl,
        String(ipAddress),
        userAgent,
      ]
    );

    // Increment Broadcast CTR Metric
    if (broadcastId && broadcastId !== 'general') {
      await query(
        `UPDATE campaign_broadcasts 
         SET total_clicks = total_clicks + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [broadcastId]
      );
    }

    // Increment Lead Click Metric
    if (masterLeadId && masterLeadId !== 'general') {
      await query(
        `UPDATE campaign_master_leads 
         SET clicked_count = clicked_count + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [masterLeadId]
      );
    }

    emitBroadcastUpdate({
      type: 'CTR_CLICK_RECORDED',
      broadcastId,
      masterLeadId,
      destinationUrl,
    });

    // 302 Redirect to destination
    res.redirect(destinationUrl);
  } catch (err: any) {
    console.error('CTR Tracking Error:', err);
    res.redirect(destinationUrl);
  }
});

// 2. Get Public Lead Preferences Info
router.get('/public/lead-info', async (req, res): Promise<void> => {
  const { lead_id, phone, email } = req.query;

  try {
    let result;
    if (lead_id) {
      result = await query(
        'SELECT id, full_name, phone, email, whatsapp_optin, email_optin FROM campaign_master_leads WHERE id = $1',
        [lead_id]
      );
    } else if (phone) {
      const normalized = normalizePhone(String(phone)) || String(phone);
      result = await query(
        'SELECT id, full_name, phone, email, whatsapp_optin, email_optin FROM campaign_master_leads WHERE phone = $1 OR phone LIKE $2',
        [normalized, `%${String(phone).slice(-10)}`]
      );
    } else if (email) {
      result = await query(
        'SELECT id, full_name, phone, email, whatsapp_optin, email_optin FROM campaign_master_leads WHERE LOWER(email) = LOWER($1)',
        [String(email).trim()]
      );
    }

    if (!result || result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    res.json({ success: true, lead: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Update Communication Preferences (Contact Center Portal)
router.post('/public/update-preferences', async (req, res): Promise<void> => {
  const { lead_id, whatsapp_optin, email_optin, reason } = req.body;

  if (!lead_id) {
    res.status(400).json({ success: false, message: 'lead_id is required.' });
    return;
  }

  try {
    const updateRes = await query(
      `UPDATE campaign_master_leads 
       SET whatsapp_optin = COALESCE($1, whatsapp_optin),
           email_optin = COALESCE($2, email_optin),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, full_name, phone, email, whatsapp_optin, email_optin`,
      [
        whatsapp_optin !== undefined ? Boolean(whatsapp_optin) : null,
        email_optin !== undefined ? Boolean(email_optin) : null,
        lead_id,
      ]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    emitBroadcastUpdate({ type: 'PREFERENCES_UPDATED', lead: updateRes.rows[0] });

    res.json({
      success: true,
      message: 'Your communication preferences have been updated successfully.',
      lead: updateRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Universal 1-Click Unsubscribe
router.post('/public/unsubscribe-1click', async (req, res): Promise<void> => {
  const { lead_id, phone, email, broadcast_id } = req.body;

  if (!lead_id && !phone && !email) {
    res.status(400).json({ success: false, message: 'lead_id, phone, or email is required.' });
    return;
  }

  try {
    let whereClause = '';
    const params: any[] = [];

    if (lead_id) {
      params.push(lead_id);
      whereClause = 'id = $1';
    } else if (phone) {
      const normalized = normalizePhone(String(phone)) || String(phone);
      params.push(normalized, `%${String(phone).slice(-10)}`);
      whereClause = '(phone = $1 OR phone LIKE $2)';
    } else if (email) {
      params.push(String(email).trim().toLowerCase());
      whereClause = 'LOWER(email) = $1';
    }

    const updateRes = await query(
      `UPDATE campaign_master_leads 
       SET whatsapp_optin = false,
           email_optin = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE ${whereClause}
       RETURNING id, full_name, phone, email`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    if (broadcast_id) {
      await query(
        `UPDATE campaign_broadcasts 
         SET total_suppressed = total_suppressed + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [broadcast_id]
      );
    }

    emitBroadcastUpdate({ type: 'ONE_CLICK_UNSUBSCRIBE', lead: updateRes.rows[0] });

    res.json({
      success: true,
      message: 'You have been successfully unsubscribed from all OmniReach promotional and broadcast communications.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
