import { Server as SocketIOServer } from 'socket.io';
import { query, pool } from '../config/db';
import { sendWhatsAppMessage } from './whatsappService';
import { sendEmailMessage } from './emailService';
import { LeadContext } from './tokenService';
import {
  calculatePacingDelay,
  checkAndIncrementDailyCount,
  DEFAULT_ANTI_BAN_SETTINGS,
  AntiBanSettings,
} from './antiBanService';

let ioInstance: SocketIOServer | null = null;
let isWorkerRunning = false;

export function setSocketIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function emitBroadcastUpdate(data: any) {
  if (ioInstance) {
    ioInstance.emit('BROADCAST_UPDATED', data);
  }
}

import { processJourneyEnrollments } from './journeyEngine';

/**
 * 5-second Poller Worker Loop
 */
export function startBackgroundWorker(intervalMs: number = 5000) {
  console.log('⚡ Background Dispatch Worker initialized (5s poller)...');
  
  setInterval(async () => {
    if (isWorkerRunning) return;
    try {
      isWorkerRunning = true;
      await checkAndRunScheduledBroadcasts();
      await processJourneyEnrollments();
    } catch (err) {
      console.error('Worker run cycle error:', err);
    } finally {
      isWorkerRunning = false;
    }
  }, intervalMs);
}

/**
 * Checks for scheduled broadcasts ready for execution
 */
export async function checkAndRunScheduledBroadcasts() {
  const readyBroadcasts = await query(
    `SELECT b.*, 
            wg.credentials as whatsapp_credentials, wg.type as whatsapp_gateway_type, wg.id as whatsapp_gateway_id,
            eg.credentials as email_credentials, eg.type as email_gateway_type,
            wt.name as wt_name, wt.meta_template_name, wt.meta_language, wt.header_type as wt_header_type, wt.header_content as wt_header_content, wt.body_content as wt_body_content, wt.footer_content as wt_footer_content, wt.buttons_json as wt_buttons,
            et.name as et_name, et.email_subject, et.email_html, et.body_content as et_body_content
     FROM campaign_broadcasts b
     LEFT JOIN gateways_config wg ON b.whatsapp_gateway_id = wg.id
     LEFT JOIN gateways_config eg ON b.email_gateway_id = eg.id
     LEFT JOIN campaign_templates wt ON b.whatsapp_template_id = wt.id
     LEFT JOIN campaign_templates et ON b.email_template_id = et.id
     WHERE b.status = 'scheduled' AND b.scheduled_at <= CURRENT_TIMESTAMP
     ORDER BY b.scheduled_at ASC
     LIMIT 5`
  );

  for (const broadcast of readyBroadcasts.rows) {
    await processBroadcast(broadcast);
  }
}

/**
 * Processes a single broadcast batch
 */
export async function processBroadcast(broadcast: any) {
  console.log(`🚀 Starting dispatch for broadcast: "${broadcast.name}" (ID: ${broadcast.id})`);

  // Update status to processing
  await query(
    `UPDATE campaign_broadcasts 
     SET status = 'processing', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [broadcast.id]
  );

  emitBroadcastUpdate({
    broadcastId: broadcast.id,
    status: 'processing',
    message: `Broadcast "${broadcast.name}" is now processing...`,
  });

  try {
    // 1. Fetch Target Contacts for this broadcast
    let leadsRes = await query(
      `SELECT id, urn, fmcb_id, full_name, phone, email, address, city, pan_no, custom_attributes, whatsapp_optin, email_optin
       FROM campaign_master_leads
       WHERE last_broadcast_id = $1
       ORDER BY created_at ASC`,
      [broadcast.id]
    );

    // If no specific leads linked to this broadcast id, fallback to all active leads
    if (leadsRes.rows.length === 0) {
      leadsRes = await query(
        `SELECT id, urn, fmcb_id, full_name, phone, email, address, city, pan_no, custom_attributes, whatsapp_optin, email_optin
         FROM campaign_master_leads
         ORDER BY created_at ASC
         LIMIT 500`
      );
    }

    const leads: LeadContext[] = leadsRes.rows;
    let whatsappSent = 0;
    let whatsappDelivered = 0;
    let whatsappFailed = 0;
    let emailSent = 0;
    let emailDelivered = 0;
    let emailFailed = 0;
    let totalSuppressed = 0;

    const channel = broadcast.channel; // 'whatsapp', 'email', 'both'

    for (let i = 0; i < leads.length; i++) {
      const lead: any = leads[i];

      // A. WhatsApp Channel Dispatch
      if (channel === 'whatsapp' || channel === 'both') {
        if (!lead.whatsapp_optin) {
          totalSuppressed++;
          await query(
            `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
             VALUES ($1, $2, 'whatsapp', $3, 'suppressed', 'Lead opted-out of WhatsApp communications')`,
            [broadcast.id, lead.id, lead.phone]
          );
        } else {
          // Resolve Anti-Ban settings for Baileys
          const isBaileys = broadcast.whatsapp_gateway_type === 'whatsapp_baileys';
          const antiBanConfig: AntiBanSettings = {
            ...DEFAULT_ANTI_BAN_SETTINGS,
            ...(broadcast.whatsapp_credentials?.anti_ban_settings || {}),
          };

          // 1. Daily Safety Cap check for Baileys
          if (isBaileys && broadcast.whatsapp_gateway_id && antiBanConfig.daily_send_limit > 0) {
            const dailyCheck = await checkAndIncrementDailyCount(
              broadcast.whatsapp_gateway_id,
              antiBanConfig.daily_send_limit
            );
            if (!dailyCheck.allowed) {
              console.warn(`🛑 Anti-Ban: Daily safety limit (${antiBanConfig.daily_send_limit}) reached for Baileys gateway ${broadcast.whatsapp_gateway_id}. Halting message dispatch.`);
              totalSuppressed++;
              await query(
                `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
                 VALUES ($1, $2, 'whatsapp', $3, 'suppressed', $4)`,
                [broadcast.id, lead.id, lead.phone, `Daily safety limit (${antiBanConfig.daily_send_limit} msgs/day) reached. Message suppressed to protect number.`]
              );
              continue;
            }
          }

          const res = await sendWhatsAppMessage(
            lead.phone,
            {
              meta_template_name: broadcast.meta_template_name,
              meta_language: broadcast.meta_language,
              header_type: broadcast.wt_header_type,
              header_content: broadcast.wt_header_content,
              body_content: broadcast.wt_body_content || 'Default notification',
              footer_content: broadcast.wt_footer_content,
              buttons_json: broadcast.wt_buttons,
            },
            lead,
            broadcast.whatsapp_credentials || {},
            broadcast.id,
            broadcast.whatsapp_gateway_type || 'whatsapp_meta',
            broadcast.whatsapp_gateway_id
          );

          // 2. Anti-ban pacing delay and batch cooldowns for Baileys
          if (isBaileys && i < leads.length - 1) {
            const batchSize = antiBanConfig.batch_size || 20;
            const cooldownSec = antiBanConfig.batch_cooldown_seconds || 60;

            if ((i + 1) % batchSize === 0) {
              console.log(`☕ Anti-Ban: Dispatched batch of ${batchSize} messages. Cooling down for ${cooldownSec}s...`);
              emitBroadcastUpdate({
                broadcastId: broadcast.id,
                status: 'cooling_down',
                message: `Anti-Ban Protection: Pausing for ${cooldownSec}s after ${i + 1} messages to safeguard number...`,
              });
              await new Promise((resolve) => setTimeout(resolve, cooldownSec * 1000));
            } else {
              const delayMs = calculatePacingDelay(antiBanConfig);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }

          if (res.status === 'suppressed') {
            totalSuppressed++;
            await query(
              `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
               VALUES ($1, $2, 'whatsapp', $3, 'suppressed', $4)`,
              [broadcast.id, lead.id, lead.phone, res.error || 'Suppressed by anti-ban protection']
            );
          } else if (res.success) {
            whatsappSent++;
            whatsappDelivered++;
            await query(
              `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, meta_message_id)
               VALUES ($1, $2, 'whatsapp', $3, 'delivered', $4)`,
              [broadcast.id, lead.id, lead.phone, res.messageId]
            );
            await query(
              `UPDATE campaign_master_leads 
               SET whatsapp_sent_count = whatsapp_sent_count + 1,
                   whatsapp_delivered_count = whatsapp_delivered_count + 1,
                   last_contacted_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [lead.id]
            );
          } else {
            whatsappFailed++;
            await query(
              `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
               VALUES ($1, $2, 'whatsapp', $3, 'failed', $4)`,
              [broadcast.id, lead.id, lead.phone, res.error]
            );
          }
        }
      }

      // B. Email Channel Dispatch
      if (channel === 'email' || channel === 'both') {
        if (!lead.email) {
          // No email provided
        } else if (!lead.email_optin) {
          totalSuppressed++;
          await query(
            `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
             VALUES ($1, $2, 'email', $3, 'suppressed', 'Lead opted-out of Email communications')`,
            [broadcast.id, lead.id, lead.email]
          );
        } else {
          const res = await sendEmailMessage(
            lead.email,
            {
              email_subject: broadcast.email_subject || 'OmniReach Notification',
              email_html: broadcast.email_html,
              body_content: broadcast.et_body_content,
            },
            lead,
            broadcast.email_credentials || {},
            broadcast.email_gateway_type || 'email_smtp',
            broadcast.id
          );

          if (res.success) {
            emailSent++;
            emailDelivered++;
            await query(
              `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, ses_message_id)
               VALUES ($1, $2, 'email', $3, 'delivered', $4)`,
              [broadcast.id, lead.id, lead.email, res.messageId]
            );
            await query(
              `UPDATE campaign_master_leads 
               SET email_sent_count = email_sent_count + 1,
                   email_delivered_count = email_delivered_count + 1,
                   last_contacted_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [lead.id]
            );
          } else {
            emailFailed++;
            await query(
              `INSERT INTO campaign_logs (broadcast_id, master_lead_id, channel, recipient, status, error_message)
               VALUES ($1, $2, 'email', $3, 'failed', $4)`,
              [broadcast.id, lead.id, lead.email, res.error]
            );
          }
        }
      }

      // Periodic progress emission for live UI feedback
      if ((i + 1) % 10 === 0 || i === leads.length - 1) {
        emitBroadcastUpdate({
          broadcastId: broadcast.id,
          progress: Math.round(((i + 1) / leads.length) * 100),
          processed: i + 1,
          total: leads.length,
        });
      }
    }

    // Set 1-hour cooldown timestamp
    const cooldownTime = new Date(Date.now() + 60 * 60 * 1000);

    const totalDelivered = whatsappDelivered + emailDelivered;
    const totalFailed = whatsappFailed + emailFailed;
    const finalStatus =
      totalDelivered > 0
        ? totalFailed > 0
          ? 'completed_with_errors'
          : 'completed'
        : totalFailed > 0
        ? 'failed'
        : 'completed';

    // Finalize Broadcast Status
    await query(
      `UPDATE campaign_broadcasts 
       SET status = $1,
           completed_at = CURRENT_TIMESTAMP,
           cooldown_until = $2,
           total_target_count = $3,
           whatsapp_sent = $4,
           whatsapp_delivered = $5,
           whatsapp_failed = $6,
           email_sent = $7,
           email_delivered = $8,
           email_failed = $9,
           total_suppressed = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [
        finalStatus,
        cooldownTime,
        leads.length,
        whatsappSent,
        whatsappDelivered,
        whatsappFailed,
        emailSent,
        emailDelivered,
        emailFailed,
        totalSuppressed,
        broadcast.id,
      ]
    );

    if (finalStatus === 'failed') {
      console.error(`❌ Broadcast "${broadcast.name}" failed: All ${totalFailed} recipient dispatches failed. Check gateway credentials.`);
    } else if (finalStatus === 'completed_with_errors') {
      console.warn(`⚠️ Broadcast "${broadcast.name}" completed with warnings: ${totalDelivered} delivered, ${totalFailed} failed.`);
    } else {
      console.log(`✅ Broadcast "${broadcast.name}" completed successfully (${totalDelivered} delivered).`);
    }

    emitBroadcastUpdate({
      broadcastId: broadcast.id,
      status: finalStatus,
      stats: {
        total_target_count: leads.length,
        whatsapp_sent: whatsappSent,
        whatsapp_delivered: whatsappDelivered,
        whatsapp_failed: whatsappFailed,
        email_sent: emailSent,
        email_delivered: emailDelivered,
        email_failed: emailFailed,
        total_suppressed: totalSuppressed,
      },
      message:
        finalStatus === 'failed'
          ? `Broadcast "${broadcast.name}" failed to deliver. Check gateway credentials.`
          : `Broadcast "${broadcast.name}" completed!`,
    });
  } catch (err: any) {
    console.error(`❌ Broadcast "${broadcast.name}" failed:`, err);
    await query(
      `UPDATE campaign_broadcasts SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [broadcast.id]
    );
    emitBroadcastUpdate({
      broadcastId: broadcast.id,
      status: 'failed',
      error: err.message,
    });
  }
}
