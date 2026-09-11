import express from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import {
  initBaileysSession,
  getBaileysSession,
  getAllBaileysSessions,
  requestBaileysPairingCode,
  sendBaileysMessage,
  disconnectBaileysSession,
} from '../services/baileysService';
import {
  DEFAULT_ANTI_BAN_SETTINGS,
  ANTI_BAN_PRESETS,
  getDailySendCount,
} from '../services/antiBanService';

const router = express.Router();

/**
 * 1. List all in-memory Baileys sessions & statuses
 */
router.get('/sessions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const sessions = getAllBaileysSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 2. Get status & QR code for a specific Baileys gateway
 */
router.get('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const session = getBaileysSession(String(id));
    const gw = gwRes.rows[0];

    res.json({
      success: true,
      gatewayId: id,
      companyName: gw.company_name,
      status: session ? session.status : (gw.status_details?.status === 'CONNECTED' ? 'connected' : 'disconnected'),
      phoneNumber: session?.phoneNumber || gw.status_details?.phone || gw.credentials?.display_phone_number || null,
      pushName: session?.pushName || gw.status_details?.push_name || null,
      connectedAt: session?.connectedAt || gw.status_details?.connected_at || null,
      hasQr: !!session?.qrCodeDataUrl,
      qrCodeDataUrl: session?.qrCodeDataUrl || null,
      pairingCode: session?.pairingCode || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 3. Connect / initialize Baileys socket for a gateway
 */
router.post('/:id/connect', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { phone_number } = req.body;

  try {
    const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const gw = gwRes.rows[0];
    if (gw.type !== 'whatsapp_baileys') {
      res.status(400).json({ success: false, message: 'Gateway is not a WhatsApp Baileys gateway.' });
      return;
    }

    const session = await initBaileysSession(
      String(id),
      gw.company_name,
      phone_number ? { phoneNumberForPairing: phone_number } : {}
    );

    res.json({
      success: true,
      message: 'Baileys session initialization started.',
      status: session.status,
      qrCodeDataUrl: session.qrCodeDataUrl,
      pairingCode: session.pairingCode,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 4. Request 8-digit Pairing Code (Direct WhatsApp linking without camera scan)
 */
router.post('/:id/pairing-code', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { phone_number } = req.body;

  if (!phone_number) {
    res.status(400).json({ success: false, message: 'Phone number with country code is required (e.g. 919876543210).' });
    return;
  }

  try {
    const gwRes = await query('SELECT * FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const gw = gwRes.rows[0];
    const code = await requestBaileysPairingCode(String(id), phone_number, gw.company_name);

    res.json({
      success: true,
      pairingCode: code,
      phoneNumber: phone_number,
      message: `Pairing Code generated: ${code}. Enter this in WhatsApp > Linked Devices > Link with phone number.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 5. Send Test Diagnostic WhatsApp Message via Baileys
 */
router.post('/:id/test-message', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { recipient_phone, message } = req.body;

  if (!recipient_phone) {
    res.status(400).json({ success: false, message: 'Recipient phone number is required.' });
    return;
  }

  try {
    const testText = message || '🚀 OmniReach Baileys WhatsApp Gateway test message! Socket connection verified.';
    const sendResult = await sendBaileysMessage(String(id), recipient_phone, { text: testText });

    if (sendResult.success) {
      res.json({
        success: true,
        messageId: sendResult.messageId,
        message: `Diagnostic test message delivered to ${recipient_phone} via Baileys socket!`,
      });
    } else {
      res.status(400).json({
        success: false,
        message: sendResult.error || 'Failed to dispatch test message.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 6. Disconnect / Unlink Baileys Session
 */
router.post('/:id/disconnect', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { purge_auth = true } = req.body;

  try {
    await disconnectBaileysSession(String(id), purge_auth);
    res.json({
      success: true,
      message: 'Baileys gateway session disconnected and unlinked.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 7. Get Anti-Ban Protection Settings for a Baileys Gateway
 */
router.get('/:id/anti-ban', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const gwRes = await query('SELECT id, credentials FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const savedSettings = gwRes.rows[0].credentials?.anti_ban_settings || {};
    const antiBanSettings = {
      ...DEFAULT_ANTI_BAN_SETTINGS,
      ...savedSettings,
    };

    const dailySentCount = getDailySendCount(String(id));

    res.json({
      success: true,
      settings: antiBanSettings,
      presets: ANTI_BAN_PRESETS,
      dailySentCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 8. Update Anti-Ban Protection Settings for a Baileys Gateway
 */
router.post('/:id/anti-ban', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { settings } = req.body;

  if (!settings) {
    res.status(400).json({ success: false, message: 'Settings payload is required.' });
    return;
  }

  try {
    const gwRes = await query('SELECT id, credentials FROM gateways_config WHERE id = $1', [String(id)]);
    if (gwRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Gateway not found.' });
      return;
    }

    const currentCreds = gwRes.rows[0].credentials || {};
    const updatedCreds = {
      ...currentCreds,
      anti_ban_settings: {
        ...DEFAULT_ANTI_BAN_SETTINGS,
        ...(currentCreds.anti_ban_settings || {}),
        ...settings,
      },
    };

    await query(
      `UPDATE gateways_config 
       SET credentials = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [JSON.stringify(updatedCreds), String(id)]
    );

    res.json({
      success: true,
      message: 'Anti-ban protection settings updated successfully.',
      settings: updatedCreds.anti_ban_settings,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
