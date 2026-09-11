import axios from 'axios';
import { query } from '../config/db';
import { sendWhatsAppMessage } from './whatsappService';
import { sendEmailMessage } from './emailService';
import { LeadContext } from './tokenService';
import { emitBroadcastUpdate } from './worker';

// Helper: Extract JSON value via dot-notation path (e.g. "data.user.status" or "status")
export function extractJsonPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

// Dynamic Token & Variable Resolver: replaces {{name}}, {{phone}}, {{variables.varName}}, {{varName}}, etc.
export function resolveJourneyVariables(templateStr: string, lead: LeadContext, variables: Record<string, any> = {}): string {
  if (!templateStr) return '';

  let result = templateStr;

  // Standard Lead attributes
  result = result.replace(/\{\{\s*name\s*\}\}|\{name\}/gi, lead.full_name || 'Customer');
  result = result.replace(/\{\{\s*contact\s*\}\}|\{\{\s*phone\s*\}\}|\{contact\}|\{phone\}/gi, lead.phone || '');
  result = result.replace(/\{\{\s*mail\s*\}\}|\{\{\s*email\s*\}\}|\{mail\}|\{email\}/gi, lead.email || '');
  result = result.replace(/\{\{\s*urn\s*\}\}|\{urn\}/gi, lead.urn || '');
  result = result.replace(/\{\{\s*fmcb_id\s*\}\}|\{fmcb_id\}/gi, lead.fmcb_id || '');
  result = result.replace(/\{\{\s*id\s*\}\}|\{id\}/gi, lead.id || '');

  // Variables in variables_json (e.g. {{loan_amount}}, {{pan_no}}, {{variables.status}})
  Object.keys(variables).forEach((key) => {
    const val = typeof variables[key] === 'object' ? JSON.stringify(variables[key]) : String(variables[key] ?? '');
    const regex1 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{\\{\\s*variables\\.${key}\\s*\\}\\}`, 'gi');
    const regex3 = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex1, val).replace(regex2, val).replace(regex3, val);
  });

  return result;
}

// Evaluate condition expression
export function evaluateCondition(config: any, lead: LeadContext, variables: Record<string, any>, clickHistoryCount: number): boolean {
  const condType = config.condition_type || 'VARIABLE_MATCH';

  if (condType === 'LINK_CLICKED' || condType === 'whatsapp_clicked') {
    return clickHistoryCount > 0;
  }

  const variableName = config.variable_name || config.field || '';
  const operator = config.operator || '==';
  const targetValue = config.target_value !== undefined ? String(config.target_value).trim().toLowerCase() : '';

  // Get actual variable value
  let actualRaw = variables[variableName] !== undefined ? variables[variableName] : (lead as any)[variableName];
  if (actualRaw === undefined && variableName.includes('.')) {
    actualRaw = extractJsonPath(variables, variableName);
  }

  const actualValue = actualRaw !== undefined ? String(actualRaw).trim().toLowerCase() : '';

  switch (operator) {
    case '==':
    case 'equals':
      return actualValue === targetValue;
    case '!=':
    case 'not_equals':
      return actualValue !== targetValue;
    case '>':
      return parseFloat(actualValue) > parseFloat(targetValue);
    case '>=':
      return parseFloat(actualValue) >= parseFloat(targetValue);
    case '<':
      return parseFloat(actualValue) < parseFloat(targetValue);
    case '<=':
      return parseFloat(actualValue) <= parseFloat(targetValue);
    case 'contains':
      return actualValue.includes(targetValue);
    case 'exists':
      return actualRaw !== undefined && actualRaw !== null && actualRaw !== '';
    default:
      return actualValue === targetValue;
  }
}

// Autonomous Step-by-Step Journey Processing Worker
export async function processJourneyEnrollments() {
  try {
    const enrollments = await query(
      `SELECT e.*, j.nodes_json, j.edges_json, j.name as journey_name, j.company_name as journey_company_name,
              l.full_name as lead_name, l.phone as lead_phone, l.email as lead_email, l.urn as lead_urn, l.fmcb_id as lead_fmcb_id,
              l.city as lead_city, l.pan_no as lead_pan, l.whatsapp_optin as lead_whatsapp_optin, l.email_optin as lead_email_optin
       FROM journey_enrollments e
       JOIN journeys j ON e.journey_id = j.id
       JOIN campaign_master_leads l ON e.master_lead_id = l.id
       WHERE e.status = 'in_progress' 
          AND j.status = 'active'
          AND e.next_execution_at <= CURRENT_TIMESTAMP
       LIMIT 50`
    );

    for (const enrollment of enrollments.rows) {
      await executeEnrollmentStep(enrollment);
    }
  } catch (err) {
    console.error('Error in processJourneyEnrollments worker:', err);
  }
}

export async function executeEnrollmentStep(enrollment: any) {
  try {
    const nodes: any[] = typeof enrollment.nodes_json === 'string' ? JSON.parse(enrollment.nodes_json) : (enrollment.nodes_json || []);
    const edges: any[] = typeof enrollment.edges_json === 'string' ? JSON.parse(enrollment.edges_json) : (enrollment.edges_json || []);
    let variables: Record<string, any> = typeof enrollment.variables_json === 'string' ? JSON.parse(enrollment.variables_json) : (enrollment.variables_json || {});

    const currentNode = nodes.find((n: any) => n.id === enrollment.current_node_id);
    if (!currentNode) {
      await query(`UPDATE journey_enrollments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [enrollment.id]);
      return;
    }

    const leadContext: LeadContext = {
      id: enrollment.master_lead_id,
      urn: enrollment.lead_urn || 'URN-LEAD',
      fmcb_id: enrollment.lead_fmcb_id || 'FMCB00001',
      full_name: enrollment.lead_name || 'Customer',
      phone: enrollment.lead_phone,
      email: enrollment.lead_email,
    };

    const compName = enrollment.journey_company_name || 'OmniReach Global';

    // 1. PROMPT / USER INPUT NODE: Sends prompt and PAUSES for inbound response
    if (currentNode.type === 'prompt_input' || currentNode.type === 'user_input') {
      if (enrollment.lead_whatsapp_optin === false) {
        console.log(`🛑 Anti-Ban: Suppressing Journey prompt_input for opted-out contact ${enrollment.lead_phone}`);
        await logJourneyStep(
          enrollment.journey_id,
          enrollment.id,
          currentNode.id,
          currentNode.type,
          'Suppressed: Contact opted-out of WhatsApp communications',
          'whatsapp',
          'suppressed'
        );
        const outgoingEdge = edges.find((e: any) => e.source === currentNode.id);
        if (outgoingEdge) {
          await query(
            `UPDATE journey_enrollments 
             SET current_node_id = $1, next_execution_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [outgoingEdge.target, enrollment.id]
          );
        } else {
          await query(`UPDATE journey_enrollments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [enrollment.id]);
        }
        return;
      }

      const promptText = resolveJourneyVariables(currentNode.config?.prompt_text || currentNode.config?.body || 'Please provide information:', leadContext, variables);

      // Resolve company WhatsApp Gateway
      const waGw = await query(
        `SELECT id, credentials, type FROM gateways_config 
         WHERE (company_name = $1 OR company_name = 'OmniReach Global') 
           AND type LIKE 'whatsapp%' AND is_active = true 
         ORDER BY (company_name = $1) DESC, is_default DESC LIMIT 1`,
        [compName]
      );
      const waCredentials = waGw.rows[0]?.credentials || {};
      const waType = waGw.rows[0]?.type || 'whatsapp_meta';
      const waId = waGw.rows[0]?.id;

      await sendWhatsAppMessage(
        enrollment.lead_phone,
        { body_content: promptText, header_content: currentNode.config?.header_text },
        leadContext,
        waCredentials,
        enrollment.journey_id,
        waType,
        waId
      );

      // Also create/sync to inbox conversation so agent can view bot prompt
      await query(
        `INSERT INTO conversations (company_name, master_lead_id, phone, contact_name, status, last_message_text, last_message_at, session_expires_at)
         VALUES ($1, $2, $3, $4, 'bot_handling', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
         ON CONFLICT (phone) DO UPDATE 
         SET status = 'bot_handling', last_message_text = $5, last_message_at = CURRENT_TIMESTAMP, session_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
        [compName, enrollment.master_lead_id, enrollment.lead_phone, leadContext.full_name, promptText.slice(0, 500)]
      );

      await logJourneyStep(
        enrollment.journey_id,
        enrollment.id,
        currentNode.id,
        currentNode.type,
        `Sent User Prompt: "${promptText.slice(0, 60)}..." (Awaiting Reply)`,
        'whatsapp',
        'waiting_input',
        { prompt: promptText, target_variable: currentNode.config?.variable_name || 'user_response' }
      );

      // Node waits for input: push execution far into future or wait for advanceJourneyOnUserInput
      await query(
        `UPDATE journey_enrollments 
         SET next_execution_at = CURRENT_TIMESTAMP + INTERVAL '7 days', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [enrollment.id]
      );
      return;
    }

    // 2. WHATSAPP ACTION NODE
    if (currentNode.type === 'action_whatsapp') {
      if (enrollment.lead_whatsapp_optin === false) {
        console.log(`🛑 Anti-Ban: Suppressing Journey action_whatsapp for opted-out contact ${enrollment.lead_phone}`);
        await logJourneyStep(
          enrollment.journey_id,
          enrollment.id,
          currentNode.id,
          currentNode.type,
          'Suppressed: Contact opted-out of WhatsApp communications',
          'whatsapp',
          'suppressed'
        );
        const outgoingEdge = edges.find((e: any) => e.source === currentNode.id);
        if (outgoingEdge) {
          await query(
            `UPDATE journey_enrollments 
             SET current_node_id = $1, next_execution_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [outgoingEdge.target, enrollment.id]
          );
        } else {
          await query(`UPDATE journey_enrollments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [enrollment.id]);
        }
        return;
      }
      const messageBody = resolveJourneyVariables(currentNode.config?.body || '', leadContext, variables);
      const headerText = currentNode.config?.header_text ? resolveJourneyVariables(currentNode.config.header_text, leadContext, variables) : undefined;

      const waGw = await query(
        `SELECT id, credentials, type FROM gateways_config 
         WHERE (company_name = $1 OR company_name = 'OmniReach Global') 
           AND type LIKE 'whatsapp%' AND is_active = true 
         ORDER BY (company_name = $1) DESC, is_default DESC LIMIT 1`,
        [compName]
      );
      const waCredentials = waGw.rows[0]?.credentials || {};
      const waType = waGw.rows[0]?.type || 'whatsapp_meta';
      const waId = waGw.rows[0]?.id;

      await sendWhatsAppMessage(
        enrollment.lead_phone,
        {
          body_content: messageBody,
          header_content: headerText,
          meta_template_name: currentNode.config?.template_name,
        },
        leadContext,
        waCredentials,
        enrollment.journey_id,
        waType,
        waId
      );

      await logJourneyStep(
        enrollment.journey_id,
        enrollment.id,
        currentNode.id,
        currentNode.type,
        'Sent WhatsApp Message',
        'whatsapp',
        'success',
        { body: messageBody }
      );
    }

    // 3. EMAIL ACTION NODE
    if (currentNode.type === 'action_email' && enrollment.lead_email) {
      const subject = resolveJourneyVariables(currentNode.config?.subject || 'Important Notice', leadContext, variables);
      const emailHtml = resolveJourneyVariables(currentNode.config?.body || '<p>Enterprise Update</p>', leadContext, variables);

      const emailGw = await query(
        `SELECT credentials, type FROM gateways_config 
         WHERE (company_name = $1 OR company_name = 'OmniReach Global') 
           AND type LIKE 'email%' AND is_active = true 
         ORDER BY (company_name = $1) DESC, is_default DESC LIMIT 1`,
        [compName]
      );
      const emailCredentials = emailGw.rows[0]?.credentials || {};
      const emailGwType = emailGw.rows[0]?.type || 'email_ses';

      await sendEmailMessage(
        enrollment.lead_email,
        { email_subject: subject, email_html: emailHtml },
        leadContext,
        emailCredentials,
        emailGwType,
        enrollment.journey_id
      );

      await logJourneyStep(
        enrollment.journey_id,
        enrollment.id,
        currentNode.id,
        currentNode.type,
        'Sent Email Message',
        'email',
        'success',
        { subject }
      );
    }

    // 4. ACTION API NODE (External HTTP API Call & JSON Path Variable Mapping)
    if (currentNode.type === 'action_api' || currentNode.type === 'api_node') {
      const apiUrl = resolveJourneyVariables(currentNode.config?.url || '', leadContext, variables);
      const method = (currentNode.config?.method || 'POST').toUpperCase();
      let reqBody: any = null;

      if (currentNode.config?.body_json) {
        const resolvedBodyStr = resolveJourneyVariables(
          typeof currentNode.config.body_json === 'string' ? currentNode.config.body_json : JSON.stringify(currentNode.config.body_json),
          leadContext,
          variables
        );
        try {
          reqBody = JSON.parse(resolvedBodyStr);
        } catch {
          reqBody = resolvedBodyStr;
        }
      }

      let apiResponseData: any = {};
      let apiStatus = 'success';

      try {
        if (apiUrl) {
          const res = await axios({
            method,
            url: apiUrl,
            data: reqBody,
            headers: currentNode.config?.headers || { 'Content-Type': 'application/json' },
            timeout: 10000,
          });
          apiResponseData = res.data;
        } else {
          // Simulation fallback for internal / mocked nodes
          apiResponseData = {
            status: 'approved',
            lead_id: `LEAD-${Date.now().toString().slice(-4)}`,
            credit_score: 780,
            assigned_agent: 'Agent_Concierge',
          };
        }

        // Map response fields into variables_json using mappings (e.g. { "lead_id": "data.id", "status": "status" })
        const mappings = currentNode.config?.response_mappings || { status: 'status', lead_id: 'lead_id' };
        Object.keys(mappings).forEach((targetVar) => {
          const jsonPath = mappings[targetVar];
          const extractedVal = extractJsonPath(apiResponseData, jsonPath);
          if (extractedVal !== undefined) {
            variables[targetVar] = extractedVal;
          }
        });

        // Store full response under api_response
        variables.api_response = apiResponseData;

        await logJourneyStep(
          enrollment.journey_id,
          enrollment.id,
          currentNode.id,
          currentNode.type,
          `Executed API Call: ${method} ${apiUrl || 'Mock Internal API'}`,
          'api',
          'success',
          { url: apiUrl, response: apiResponseData, updated_variables: variables }
        );
      } catch (apiErr: any) {
        apiStatus = 'failed';
        variables.api_error = apiErr.message;
        await logJourneyStep(
          enrollment.journey_id,
          enrollment.id,
          currentNode.id,
          currentNode.type,
          `API Call Failed: ${apiErr.message}`,
          'api',
          'failed',
          { error: apiErr.message }
        );
      }
    }

    // 5. BOT-TO-HUMAN HANDOVER NODE: Transfers directly to WhatsApp Live Chat Inbox
    if (currentNode.type === 'action_handover' || currentNode.type === 'bot_handover') {
      const reason = currentNode.config?.reason || 'Transferred by automated journey flow';
      const assignedAgentId = currentNode.config?.agent_id || null;
      const priority = currentNode.config?.priority || 'high';

      // Update or create open conversation in Live Chat Inbox
      await query(
        `INSERT INTO conversations (company_name, master_lead_id, phone, contact_name, status, priority, assigned_agent_id, session_expires_at)
         VALUES ($1, $2, $3, $4, 'open', $5, $6, CURRENT_TIMESTAMP + INTERVAL '24 hours')
         ON CONFLICT (phone) DO UPDATE 
         SET status = 'open', priority = $5, assigned_agent_id = COALESCE($6, conversations.assigned_agent_id), session_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
        [compName, enrollment.master_lead_id, enrollment.lead_phone, leadContext.full_name, priority, assignedAgentId]
      );

      // Insert system transfer notice into message stream
      const convRes = await query(`SELECT id FROM conversations WHERE phone = $1 LIMIT 1`, [enrollment.lead_phone]);
      if (convRes.rows.length > 0) {
        await query(
          `INSERT INTO chat_messages (conversation_id, direction, sender_type, sender_name, message_type, content, status)
           VALUES ($1, 'outbound', 'system', 'Journey Flow', 'note', $2, 'read')`,
          [convRes.rows[0].id, `🤖 Live Agent Handover Triggered: ${reason}`]
        );

        emitBroadcastUpdate({
          type: 'CONVERSATION_HANDOVER',
          conversation_id: convRes.rows[0].id,
          reason,
        });
      }

      await logJourneyStep(
        enrollment.journey_id,
        enrollment.id,
        currentNode.id,
        currentNode.type,
        `Handed over to Live Chat Inbox (Priority: ${priority})`,
        'inbox',
        'success',
        { reason, priority }
      );
    }

    // 6. UPDATE LEAD / CRM ACTION NODE
    if (currentNode.type === 'action_update_lead') {
      const updateFields = currentNode.config?.fields || {};
      if (updateFields.pan_no) {
        const val = resolveJourneyVariables(updateFields.pan_no, leadContext, variables);
        await query(`UPDATE campaign_master_leads SET pan_no = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [val, enrollment.master_lead_id]);
      }
      if (updateFields.city) {
        const val = resolveJourneyVariables(updateFields.city, leadContext, variables);
        await query(`UPDATE campaign_master_leads SET city = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [val, enrollment.master_lead_id]);
      }
    }

    // UPDATE VARIABLES ON ENROLLMENT
    await query(
      `UPDATE journey_enrollments 
       SET variables_json = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(variables), enrollment.id]
    );

    // DETERMINE NEXT EDGE / TRANSITION
    const outgoingEdges = edges.filter((e: any) => e.from === currentNode.id || e.source === currentNode.id);
    if (outgoingEdges.length === 0 || currentNode.type === 'goal') {
      // Complete journey enrollment
      await query(
        `UPDATE journey_enrollments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [enrollment.id]
      );
      await query(
        `UPDATE journeys 
         SET stats_json = jsonb_set(
           COALESCE(stats_json, '{}'::jsonb), 
           '{completed}', 
           to_jsonb(COALESCE((stats_json->>'completed')::int, 0) + 1)
         )
         WHERE id = $1`,
        [enrollment.journey_id]
      );
      return;
    }

    let nextEdge = outgoingEdges[0];
    let nextExecutionDelayMinutes = 0;

    // Condition Branching Logic
    if (currentNode.type === 'condition') {
      const clickCheck = await query(
        `SELECT count(*) FROM ctr_clicks WHERE master_lead_id = $1 AND created_at >= $2`,
        [enrollment.master_lead_id, enrollment.created_at]
      );
      const clickCount = parseInt(clickCheck.rows[0]?.count || '0');

      const isTrue = evaluateCondition(currentNode.config, leadContext, variables, clickCount);

      const yesEdge = outgoingEdges.find(
        (e: any) =>
          (e.label && (e.label.toLowerCase().includes('yes') || e.label.toLowerCase().includes('true') || e.label.toLowerCase().includes('approved'))) ||
          (e.to && (e.to.includes('yes') || e.to.includes('true') || e.to.includes('approved'))) ||
          (e.target && (e.target.includes('yes') || e.target.includes('true') || e.target.includes('approved')))
      );

      const noEdge = outgoingEdges.find(
        (e: any) =>
          (e.label && (e.label.toLowerCase().includes('no') || e.label.toLowerCase().includes('false') || e.label.toLowerCase().includes('declined'))) ||
          (e.to && (e.to.includes('no') || e.to.includes('false') || e.to.includes('declined'))) ||
          (e.target && (e.target.includes('no') || e.target.includes('false') || e.target.includes('declined')))
      );

      nextEdge = isTrue ? (yesEdge || outgoingEdges[0]) : (noEdge || outgoingEdges[1] || outgoingEdges[0]);
    }

    const nextTargetId = nextEdge.to || nextEdge.target;
    const nextNode = nodes.find((n: any) => n.id === nextTargetId);

    // Delay Node Handling
    if (nextNode && nextNode.type === 'delay') {
      const val = parseFloat(nextNode.config?.value) || 1;
      const unit = (nextNode.config?.delay_type || 'HOURS').toUpperCase();
      if (unit === 'MINUTES') nextExecutionDelayMinutes = val;
      else if (unit === 'HOURS') nextExecutionDelayMinutes = val * 60;
      else if (unit === 'DAYS') nextExecutionDelayMinutes = val * 60 * 24;
    }

    const nextExecTimestamp = new Date(Date.now() + nextExecutionDelayMinutes * 60 * 1000);

    await query(
      `UPDATE journey_enrollments 
       SET current_node_id = $1, next_execution_at = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [nextTargetId, nextExecTimestamp.toISOString(), enrollment.id]
    );

    // If no delay required, immediately cascade to next node
    if (nextExecutionDelayMinutes === 0 && nextNode && nextNode.type !== 'prompt_input') {
      const updatedEnrollment = {
        ...enrollment,
        current_node_id: nextTargetId,
        variables_json: variables,
      };
      await executeEnrollmentStep(updatedEnrollment);
    }
  } catch (err) {
    console.error('Error executing journey step:', err);
  }
}

/**
 * Called when an incoming WhatsApp customer message arrives.
 * Checks if the contact has an active enrollment paused at a Prompt/Input node,
 * captures their reply into variables, and advances the flow.
 */
export async function advanceJourneyOnUserInput(masterLeadId: string, userReplyText: string) {
  const activeRes = await query(
    `SELECT e.*, j.nodes_json, j.edges_json, j.name as journey_name, j.company_name as journey_company_name,
            l.full_name as lead_name, l.phone as lead_phone, l.email as lead_email, l.urn as lead_urn, l.fmcb_id as lead_fmcb_id
     FROM journey_enrollments e
     JOIN journeys j ON e.journey_id = j.id
     JOIN campaign_master_leads l ON e.master_lead_id = l.id
     WHERE e.master_lead_id = $1 AND e.status = 'in_progress' AND j.status = 'active'
     ORDER BY e.updated_at DESC LIMIT 1`,
    [masterLeadId]
  );

  if (activeRes.rows.length === 0) return;

  const enrollment = activeRes.rows[0];
  const nodes: any[] = typeof enrollment.nodes_json === 'string' ? JSON.parse(enrollment.nodes_json) : enrollment.nodes_json;
  const edges: any[] = typeof enrollment.edges_json === 'string' ? JSON.parse(enrollment.edges_json) : enrollment.edges_json;
  let variables: Record<string, any> = typeof enrollment.variables_json === 'string' ? JSON.parse(enrollment.variables_json) : (enrollment.variables_json || {});

  const currentNode = nodes.find((n: any) => n.id === enrollment.current_node_id);
  if (currentNode && (currentNode.type === 'prompt_input' || currentNode.type === 'user_input')) {
    const targetVar = currentNode.config?.variable_name || 'user_input';
    variables[targetVar] = userReplyText.trim();
    variables['last_user_input'] = userReplyText.trim();

    await logJourneyStep(
      enrollment.journey_id,
      enrollment.id,
      currentNode.id,
      currentNode.type,
      `User Replied: "${userReplyText.slice(0, 40)}" -> saved to variable {{${targetVar}}}`,
      'whatsapp',
      'success',
      { input: userReplyText, variable: targetVar }
    );

    // Transition to next node
    const outgoingEdges = edges.filter((e: any) => e.from === currentNode.id || e.source === currentNode.id);
    if (outgoingEdges.length > 0) {
      const nextTargetId = outgoingEdges[0].to || outgoingEdges[0].target;
      await query(
        `UPDATE journey_enrollments 
         SET current_node_id = $1, variables_json = $2, next_execution_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [nextTargetId, JSON.stringify(variables), enrollment.id]
      );

      // Execute next step immediately
      const updatedEnrollment = {
        ...enrollment,
        current_node_id: nextTargetId,
        variables_json: variables,
      };
      await executeEnrollmentStep(updatedEnrollment);
    }
  }
}

/**
 * Triggers a journey via External Callback / CRM Webhook payload
 */
export async function triggerJourneyCallback(journeyId: string, payload: Record<string, any>, leadPhoneOrId?: string) {
  const jRes = await query('SELECT * FROM journeys WHERE id = $1', [journeyId]);
  if (jRes.rows.length === 0) throw new Error('Journey not found');

  const journey = jRes.rows[0];
  const nodes: any[] = typeof journey.nodes_json === 'string' ? JSON.parse(journey.nodes_json) : journey.nodes_json;
  const triggerNode = nodes.find((n: any) => n.type === 'trigger') || nodes[0];

  if (!triggerNode) throw new Error('Journey has no trigger node');

  // Identify or create lead
  let leadId = payload.lead_id || leadPhoneOrId;
  let phone = payload.phone;

  if (!leadId && phone) {
    const leadRes = await query('SELECT id FROM campaign_master_leads WHERE phone = $1 LIMIT 1', [phone]);
    if (leadRes.rows.length > 0) {
      leadId = leadRes.rows[0].id;
    } else {
      const newLead = await query(
        `INSERT INTO campaign_master_leads (full_name, phone, email, company_name, fmcb_id)
         VALUES ($1, $2, $3, $4, 'FMCB' || nextval('fmcb_id_seq'))
         RETURNING id`,
        [payload.name || 'API Ingested Lead', phone, payload.email || null, journey.company_name]
      );
      leadId = newLead.rows[0].id;
    }
  }

  if (!leadId) throw new Error('Valid master lead or phone number required to enroll');

  // Insert enrollment with callback payload as variables
  const enrollRes = await query(
    `INSERT INTO journey_enrollments (journey_id, master_lead_id, current_node_id, status, variables_json, next_execution_at)
     VALUES ($1, $2, $3, 'in_progress', $4, CURRENT_TIMESTAMP)
     RETURNING id`,
    [journeyId, leadId, triggerNode.id, JSON.stringify(payload)]
  );

  // Update total stats
  await query(
    `UPDATE journeys 
     SET stats_json = jsonb_set(
       COALESCE(stats_json, '{}'::jsonb), 
       '{total_enrolled}', 
       to_jsonb(COALESCE((stats_json->>'total_enrolled')::int, 0) + 1)
     )
     WHERE id = $1`,
    [journeyId]
  );

  // Process first step
  const fullEnrollmentRes = await query(
    `SELECT e.*, j.nodes_json, j.edges_json, j.name as journey_name, j.company_name as journey_company_name,
            l.full_name as lead_name, l.phone as lead_phone, l.email as lead_email, l.urn as lead_urn, l.fmcb_id as lead_fmcb_id
     FROM journey_enrollments e
     JOIN journeys j ON e.journey_id = j.id
     JOIN campaign_master_leads l ON e.master_lead_id = l.id
     WHERE e.id = $1`,
    [enrollRes.rows[0].id]
  );

  if (fullEnrollmentRes.rows.length > 0) {
    await executeEnrollmentStep(fullEnrollmentRes.rows[0]);
  }

  return { success: true, enrollment_id: enrollRes.rows[0].id, lead_id: leadId };
}

// Pre-built Enterprise Multi-Stage Journey Templates
export const DEFAULT_ENTERPRISE_JOURNEY_TEMPLATES: any[] = [];

// Seed templates into DB if empty
export async function seedDefaultJourneys() {
  return;
}

async function logJourneyStep(
  journeyId: string,
  enrollmentId: string,
  nodeId: string,
  nodeType: string,
  actionTaken: string,
  channel: string,
  status: string,
  details: any = {}
) {
  try {
    await query(
      `INSERT INTO journey_step_logs (journey_id, enrollment_id, node_id, node_type, action_taken, channel, status, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [journeyId, enrollmentId, nodeId, nodeType, actionTaken, channel, status, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Failed to log journey step:', err);
  }
}
