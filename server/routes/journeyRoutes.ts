import express from 'express';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { DEFAULT_ENTERPRISE_JOURNEY_TEMPLATES, triggerJourneyCallback } from '../services/journeyEngine';

const router = express.Router();

function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `j.company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `j.company_name = $${startingIndex}`, params: [compName] };
}

// 1. List All Journeys (Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const compCond = getCompanyCondition(req, 1);
    const whereClause = compCond.clause ? `WHERE ${compCond.clause}` : '';

    const result = await query(
      `SELECT j.*, 
              (SELECT count(*) FROM journey_enrollments WHERE journey_id = j.id AND status = 'in_progress') as active_enrollments,
              (SELECT count(*) FROM journey_enrollments WHERE journey_id = j.id AND status = 'completed') as completed_enrollments
       FROM journeys j
       ${whereClause}
       ORDER BY j.created_at DESC`,
      compCond.params
    );
    res.json({ success: true, journeys: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Get Single Journey Details & Node Execution Logs
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  try {
    const compCond = req.user?.role === 'superadmin' ? '' : 'AND company_name = $2';
    const params = req.user?.role === 'superadmin' ? [String(id)] : [String(id), req.user?.company_name];
    const journeyRes = await query(`SELECT * FROM journeys WHERE id = $1 ${compCond}`, params);
    if (journeyRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Journey not found or access restricted' });
      return;
    }

    const logsRes = await query(
      `SELECT l.*, ml.full_name as lead_name, ml.phone as lead_phone, ml.urn as lead_urn
       FROM journey_step_logs l
       JOIN journey_enrollments e ON l.enrollment_id = e.id
       JOIN campaign_master_leads ml ON e.master_lead_id = ml.id
       WHERE l.journey_id = $1
       ORDER BY l.created_at DESC
       LIMIT 50`,
      [String(id)]
    );

    res.json({
      success: true,
      journey: journeyRes.rows[0],
      logs: logsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Create New Journey
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { name, description, category, trigger_config, nodes_json, edges_json, company_name } = req.body;

  if (!name) {
    res.status(400).json({ success: false, message: 'Journey name is required.' });
    return;
  }

  const assignedCompany = req.user?.role === 'superadmin'
    ? (company_name || 'OmniReach Global')
    : (req.user?.company_name || 'Independent Enterprise');

  try {
    const result = await query(
      `INSERT INTO journeys (name, company_name, description, category, status, trigger_config, nodes_json, edges_json, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        assignedCompany,
        description || null,
        category || 'CUSTOMER_LIFECYCLE',
        JSON.stringify(trigger_config || { type: 'segment_entry' }),
        JSON.stringify(nodes_json || []),
        JSON.stringify(edges_json || []),
        req.user?.id || null,
      ]
    );

    await logAdminAudit(req.user?.id, 'CREATE_JOURNEY', 'journey', result.rows[0].id, { name, company: assignedCompany }, req.ip);

    res.json({ success: true, journey: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Update Existing Journey Flow
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, description, category, status, trigger_config, nodes_json, edges_json } = req.body;

  try {
    const result = await query(
      `UPDATE journeys 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           status = COALESCE($4, status),
           trigger_config = COALESCE($5, trigger_config),
           nodes_json = COALESCE($6, nodes_json),
           edges_json = COALESCE($7, edges_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        name,
        description,
        category,
        status,
        trigger_config ? JSON.stringify(trigger_config) : null,
        nodes_json ? JSON.stringify(nodes_json) : null,
        edges_json ? JSON.stringify(edges_json) : null,
        String(id),
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Journey not found' });
      return;
    }

    await logAdminAudit(req.user?.id, 'UPDATE_JOURNEY', 'journey', String(id), { name }, req.ip);

    res.json({ success: true, journey: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Toggle Journey Status (Active / Paused)
router.post('/:id/toggle-status', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const jRes = await query('SELECT status FROM journeys WHERE id = $1', [String(id)]);
    if (jRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Journey not found' });
      return;
    }

    const newStatus = jRes.rows[0].status === 'active' ? 'paused' : 'active';
    const updateRes = await query(
      `UPDATE journeys SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newStatus, String(id)]
    );

    await logAdminAudit(req.user?.id, 'TOGGLE_JOURNEY_STATUS', 'journey', String(id), { newStatus }, req.ip);

    res.json({ success: true, journey: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Enroll Eligible Company Master Leads into Journey
router.post('/:id/enroll-all-leads', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const journeyRes = await query('SELECT * FROM journeys WHERE id = $1', [String(id)]);
    if (journeyRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Journey not found' });
      return;
    }

    const journey = journeyRes.rows[0];
    const nodes: any[] = typeof journey.nodes_json === 'string' ? JSON.parse(journey.nodes_json) : journey.nodes_json;
    const triggerNode = nodes.find((n: any) => n.type === 'trigger') || nodes[0];

    if (!triggerNode) {
      res.status(400).json({ success: false, message: 'Journey has no initial trigger node configured.' });
      return;
    }

    // Get leads scoped to company (or all if global)
    let leadQuery = 'SELECT id FROM campaign_master_leads WHERE (whatsapp_optin = true OR email_optin = true)';
    const params: any[] = [];
    if (journey.company_name && journey.company_name !== 'OmniReach Global') {
      leadQuery += ' AND company_name = $1';
      params.push(journey.company_name);
    }

    const leadsRes = await query(leadQuery, params);
    let enrolledCount = 0;

    for (const lead of leadsRes.rows) {
      const insRes = await query(
        `INSERT INTO journey_enrollments (journey_id, master_lead_id, current_node_id, status, next_execution_at)
         VALUES ($1, $2, $3, 'in_progress', CURRENT_TIMESTAMP)
         RETURNING id`,
        [String(id), lead.id, triggerNode.id]
      );
      if (insRes.rows.length > 0) enrolledCount++;
    }

    // Update stats
    await query(
      `UPDATE journeys 
       SET stats_json = jsonb_set(
         COALESCE(stats_json, '{}'::jsonb), 
         '{total_enrolled}', 
         to_jsonb(COALESCE((stats_json->>'total_enrolled')::int, 0) + $1)
       )
       WHERE id = $2`,
      [enrolledCount, String(id)]
    );

    res.json({ success: true, message: `Enrolled ${enrolledCount} contacts into ${journey.name}`, enrolledCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7a. Batch Delete Journeys (Superadmin Only)
const handleBatchDeleteJourneys = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { journey_ids } = req.body;
  if (!Array.isArray(journey_ids) || journey_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No journey IDs provided for deletion.' });
    return;
  }
  try {
    const delRes = await query(`DELETE FROM journeys WHERE id = ANY($1::uuid[]) RETURNING id, name`, [journey_ids]);
    await logAdminAudit(req.user?.id, 'BATCH_DELETE_JOURNEYS', 'journey', undefined, { count: delRes.rowCount }, req.ip);

    res.json({ success: true, message: `Successfully deleted ${delRes.rowCount || journey_ids.length} journey workflow(s).`, count: delRes.rowCount });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/batch-delete', authenticateToken, requireSuperadmin, handleBatchDeleteJourneys);
router.post('/batch-delete', authenticateToken, requireSuperadmin, handleBatchDeleteJourneys);

// 7b. Delete Single Journey (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    await query('DELETE FROM journeys WHERE id = $1', [String(id)]);
    await logAdminAudit(req.user?.id, 'DELETE_JOURNEY', 'journey', String(id), {}, req.ip);
    res.json({ success: true, message: 'Journey deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. External CRM Webhook / Callback Event Trigger Endpoint
router.post('/:id/callback', async (req, res): Promise<void> => {
  const { id } = req.params;
  const payload = req.body;

  try {
    const result = await triggerJourneyCallback(String(id), payload, payload.lead_id || payload.phone);
    res.json({ success: true, message: 'Journey triggered via callback payload successfully.', ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Interactive Flow Simulation Endpoint
router.post('/:id/simulate-step', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { lead_context, current_node_id, user_reply, variables = {} } = req.body;

  try {
    const jRes = await query('SELECT * FROM journeys WHERE id = $1', [String(id)]);
    if (jRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Journey not found' });
      return;
    }

    const journey = jRes.rows[0];
    const nodes: any[] = typeof journey.nodes_json === 'string' ? JSON.parse(journey.nodes_json) : journey.nodes_json;
    const edges: any[] = typeof journey.edges_json === 'string' ? JSON.parse(journey.edges_json) : journey.edges_json;

    const node = nodes.find((n: any) => n.id === (current_node_id || nodes[0]?.id));
    if (!node) {
      res.status(400).json({ success: false, message: 'Node not found' });
      return;
    }

    const outgoing = edges.filter((e: any) => e.from === node.id || e.source === node.id);
    const nextNodeId = outgoing[0]?.to || outgoing[0]?.target || null;
    const nextNode = nodes.find((n: any) => n.id === nextNodeId);

    res.json({
      success: true,
      current_node: node,
      next_node: nextNode,
      variables,
      output: {
        action: node.type,
        resolved_title: node.title,
        message: node.config?.body || node.config?.prompt_text || 'Action executed successfully.',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

