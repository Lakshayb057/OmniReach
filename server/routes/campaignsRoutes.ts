import express from 'express';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { 
  emitBroadcastUpdate, 
  processBroadcast, 
  requestPauseBroadcast, 
  requestResumeBroadcast 
} from '../services/worker';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `b.company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `b.company_name = $${startingIndex}`, params: [compName] };
}

// 1. List Campaigns with Gateway & Template details (Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';

    const result = await query(
      `SELECT b.*, 
              wg.name as whatsapp_gateway_name, wg.quality_rating as whatsapp_quality,
              eg.name as email_gateway_name,
              wt.name as whatsapp_template_name,
              et.name as email_template_name,
              u.full_name as creator_name
       FROM campaign_broadcasts b
       LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
       LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
       LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
       LEFT JOIN campaign_templates et ON b.email_template_id = et.id
       LEFT JOIN users u ON b.created_by = u.id
       ${whereClause}
       ORDER BY b.created_at DESC`,
      compCond.params
    );

    const enriched = result.rows.map((b) => {
      let countdownSeconds = 0;
      if (b.status === 'scheduled' && b.scheduled_at) {
        const diffMs = new Date(b.scheduled_at).getTime() - Date.now();
        countdownSeconds = Math.max(0, Math.floor(diffMs / 1000));
        if (isNaN(countdownSeconds)) countdownSeconds = 0;
      }
      return {
        ...b,
        countdownSeconds,
        isCooldownActive: b.cooldown_until ? new Date(b.cooldown_until).getTime() > Date.now() : false,
      };
    });

    res.json({ success: true, campaigns: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Create Broadcast Campaign from 6-Step Wizard
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const {
    name,
    description,
    channel,
    tags,
    whatsapp_gateway_id,
    whatsapp_phone_number_id,
    email_gateway_id,
    whatsapp_template_id,
    email_template_id,
    audience_filters,
    total_audience,
    execution_mode,
    scheduled_at,
    company_name,
  } = req.body;

  if (!name || !channel) {
    res.status(400).json({ success: false, message: 'Campaign name and channel are required.' });
    return;
  }

  const assignedCompany = req.user?.role === 'superadmin'
    ? (company_name || 'OmniReach Global')
    : (req.user?.company_name || 'Independent Enterprise');

  try {
    const isImmediate = execution_mode === 'immediate' || !scheduled_at;
    const scheduleTime = isImmediate ? new Date() : new Date(scheduled_at);
    const initialStatus = 'scheduled';

    const insertRes = await query(
      `INSERT INTO campaign_broadcasts 
       (name, company_name, description, channel, tags, whatsapp_gateway_id, whatsapp_phone_number_id, email_gateway_id, whatsapp_template_id, email_template_id, audience_filters, total_target_count, status, execution_mode, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        name,
        assignedCompany,
        description || '',
        channel,
        tags || [],
        whatsapp_gateway_id || null,
        whatsapp_phone_number_id || null,
        email_gateway_id || null,
        whatsapp_template_id || null,
        email_template_id || null,
        JSON.stringify(audience_filters || {}),
        parseInt(total_audience, 10) || 0,
        initialStatus,
        execution_mode || 'immediate',
        scheduleTime,
        req.user!.id,
      ]
    );

    const newBroadcast = insertRes.rows[0];

    // If audience was uploaded, link the lead IDs to this broadcast
    if (
      audience_filters &&
      audience_filters.source === 'upload' &&
      Array.isArray(audience_filters.lead_ids) &&
      audience_filters.lead_ids.length > 0
    ) {
      try {
        await query(
          `UPDATE campaign_master_leads 
           SET last_broadcast_id = $1 
           WHERE id = ANY($2::uuid[])`,
          [newBroadcast.id, audience_filters.lead_ids]
        );
        console.log(`[Campaigns] Linked ${audience_filters.lead_ids.length} uploaded leads to broadcast ${newBroadcast.id}`);
      } catch (linkErr) {
        console.warn('Notice linking uploaded leads to broadcast:', linkErr);
      }
    }

    await logAdminAudit(
      req.user!.id,
      'CREATE_CAMPAIGN',
      'campaign_broadcasts',
      newBroadcast.id,
      { name, channel, execution_mode, company: assignedCompany },
      req.ip
    );

    emitBroadcastUpdate({ type: 'CAMPAIGN_CREATED', campaign: newBroadcast });

    res.json({ success: true, campaign: newBroadcast });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Single Campaign Details & Delivery Logs
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const broadcastRes = await query(
      `SELECT b.*, 
              wg.name as whatsapp_gateway_name, 
              eg.name as email_gateway_name,
              wt.name as whatsapp_template_name,
              et.name as email_template_name
       FROM campaign_broadcasts b
       LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
       LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
       LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
       LEFT JOIN campaign_templates et ON b.email_template_id = et.id
       WHERE b.id = $1`,
      [String(id)]
    );

    if (broadcastRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found.' });
      return;
    }

    const campaign = broadcastRes.rows[0];
    if (req.user?.role !== 'superadmin' && campaign.company_name !== req.user?.company_name) {
      res.status(403).json({ success: false, message: 'Access denied to this company campaign.' });
      return;
    }

    res.json({ success: true, campaign });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Get Campaign Logs
router.get('/:id/logs', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const isSuper = req.user?.role === 'superadmin';
    const compName = req.user?.company_name;

    const bcastRes = await query('SELECT company_name FROM campaign_broadcasts WHERE id = $1', [String(id)]);
    if (bcastRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found.' });
      return;
    }
    if (!isSuper && bcastRes.rows[0].company_name !== compName) {
      res.status(403).json({ success: false, message: 'Access denied to this campaign logs.' });
      return;
    }

    const logsRes = await query(
      `SELECT l.*, ml.full_name as lead_name, ml.urn as lead_urn, ml.fmcb_id as lead_fmcb_id
       FROM campaign_logs l
       LEFT JOIN campaign_master_leads ml ON l.master_lead_id = ml.id
       WHERE l.broadcast_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [String(id)]
    );

    res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Pause Broadcast (Instant stop with progress saved)
router.post('/:id/pause', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $2';
    const params = req.user?.role === 'superadmin' ? [String(id)] : [String(id), req.user?.company_name];

    // Request worker pause
    requestPauseBroadcast(String(id));

    const updateRes = await query(
      `UPDATE campaign_broadcasts 
       SET status = 'paused', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 ${compCond}
       RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found or access denied.' });
      return;
    }

    emitBroadcastUpdate({ broadcastId: String(id), status: 'paused', message: 'Broadcast paused by user.' });
    await logAdminAudit(req.user!.id, 'PAUSE_CAMPAIGN', 'campaign_broadcasts', String(id), {}, req.ip);

    res.json({ success: true, message: 'Broadcast paused successfully.', campaign: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Resume / Play Broadcast (Picks up from where it left off)
const handleResumeBroadcast = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { id } = req.params;
  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $2';
    const params = req.user?.role === 'superadmin' ? [String(id)] : [String(id), req.user?.company_name];

    requestResumeBroadcast(String(id));

    const updateRes = await query(
      `UPDATE campaign_broadcasts 
       SET status = 'scheduled', scheduled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 ${compCond}
       RETURNING *`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found or access denied.' });
      return;
    }

    emitBroadcastUpdate({ broadcastId: String(id), status: 'scheduled', message: 'Broadcast scheduled for immediate dispatch.' });
    await logAdminAudit(req.user!.id, 'RESUME_CAMPAIGN', 'campaign_broadcasts', String(id), {}, req.ip);

    res.json({ success: true, message: 'Broadcast resumed and queued for immediate dispatch.', campaign: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/:id/resume', authenticateToken, handleResumeBroadcast);
router.post('/:id/play', authenticateToken, handleResumeBroadcast);
router.post('/:id/dispatch-now', authenticateToken, handleResumeBroadcast);
router.post('/:id/run-now', authenticateToken, handleResumeBroadcast);

// 7. Retrigger Broadcast Directly
router.post('/:id/retrigger', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const bRes = await query(`SELECT * FROM campaign_broadcasts WHERE id = $1`, [String(id)]);
    if (bRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Broadcast not found.' });
      return;
    }
    const b = bRes.rows[0];
    if (req.user?.role !== 'superadmin' && b.company_name !== req.user?.company_name) {
      res.status(403).json({ success: false, message: 'Access denied.' });
      return;
    }

    const retriggerName = `${b.name} (Retrigger)`;
    const newBroadcastRes = await query(
      `INSERT INTO campaign_broadcasts 
       (name, company_name, description, channel, tags, whatsapp_gateway_id, whatsapp_phone_number_id, email_gateway_id, whatsapp_template_id, email_template_id, audience_filters, total_target_count, status, execution_mode, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'scheduled', 'immediate', CURRENT_TIMESTAMP, $13)
       RETURNING *`,
      [
        retriggerName,
        b.company_name,
        b.description || '',
        b.channel,
        b.tags || [],
        b.whatsapp_gateway_id,
        b.whatsapp_phone_number_id,
        b.email_gateway_id,
        b.whatsapp_template_id,
        b.email_template_id,
        JSON.stringify(b.audience_filters || {}),
        b.total_target_count || 0,
        req.user!.id,
      ]
    );

    const newBroadcast = newBroadcastRes.rows[0];
    emitBroadcastUpdate({ type: 'CAMPAIGN_CREATED', campaign: newBroadcast });
    await logAdminAudit(req.user!.id, 'RETRIGGER_CAMPAIGN', 'campaign_broadcasts', newBroadcast.id, { originalId: id }, req.ip);

    res.json({ success: true, message: 'Broadcast retriggered as new campaign.', campaign: newBroadcast });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8a. Batch Delete Campaigns (Superadmin Only)
const handleBatchDeleteCampaigns = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { campaign_ids } = req.body;
  if (!Array.isArray(campaign_ids) || campaign_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No campaign IDs provided for deletion.' });
    return;
  }
  try {
    const delRes = await query(`DELETE FROM campaign_broadcasts WHERE id = ANY($1::uuid[])`, [campaign_ids]);
    await logAdminAudit(req.user!.id, 'BATCH_DELETE_CAMPAIGNS', 'campaign_broadcasts', undefined, { count: delRes.rowCount }, req.ip);
    res.json({ success: true, message: `Successfully deleted ${delRes.rowCount || campaign_ids.length} campaign(s).`, count: delRes.rowCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/batch-delete', authenticateToken, requireSuperadmin, handleBatchDeleteCampaigns);
router.post('/batch-delete', authenticateToken, requireSuperadmin, handleBatchDeleteCampaigns);

// 8b. Delete Single Campaign (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM campaign_broadcasts WHERE id = $1`, [String(id)]);
    await logAdminAudit(req.user!.id, 'DELETE_CAMPAIGN', 'campaign_broadcasts', String(id), {}, req.ip);

    res.json({ success: true, message: 'Campaign deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
