import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { ingestContactsBatch, RawContactInput } from '../services/leadsMatcher';
import { emitBroadcastUpdate } from '../services/worker';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper to filter by company
function getCompanyCondition(req: AuthenticatedRequest, startingIndex: number): { clause: string; params: any[] } {
  if (req.user?.role === 'superadmin') {
    const { company_name } = req.query;
    if (company_name && company_name !== 'all' && company_name !== 'All Companies (Global)') {
      return { clause: `company_name = $${startingIndex}`, params: [company_name] };
    }
    return { clause: '', params: [] };
  }
  const compName = req.user?.company_name || 'Independent Enterprise';
  return { clause: `company_name = $${startingIndex}`, params: [compName] };
}

// 1. Get Paginated Master Contacts (Company Isolated)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const { search, optin_filter, page = '1', limit = '50' } = req.query;

  try {
    const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const params: any[] = [];
    let whereClauses: string[] = [];

    const compCond = getCompanyCondition(req, params.length + 1);
    if (compCond.clause) {
      whereClauses.push(compCond.clause);
      params.push(...compCond.params);
    }

    if (search && String(search).trim().length > 0) {
      params.push(`%${String(search).trim()}%`);
      whereClauses.push(
        `(full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length} OR urn ILIKE $${params.length} OR fmcb_id ILIKE $${params.length})`
      );
    }

    if (optin_filter === 'whatsapp_optout') {
      whereClauses.push('whatsapp_optin = false');
    } else if (optin_filter === 'email_optout') {
      whereClauses.push('email_optin = false');
    } else if (optin_filter === 'all_optout') {
      whereClauses.push('(whatsapp_optin = false AND email_optin = false)');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) FROM campaign_master_leads ${whereSql}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(parseInt(limit as string, 10), offset);
    const dataRes = await query(
      `SELECT * FROM campaign_master_leads 
       ${whereSql} 
       ORDER BY created_at DESC 
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        totalPages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Upload CSV / Excel or Ingest JSON Contacts
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    let rawContacts: RawContactInput[] = [];
    const broadcastId = req.body.broadcast_id;
    const targetCompany = req.user?.role === 'superadmin' 
      ? (req.body.company_name || 'OmniReach Global') 
      : (req.user?.company_name || 'Independent Enterprise');

    if (req.file) {
      const buffer = req.file.buffer;
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const jsonRows: any[] = xlsx.utils.sheet_to_json(sheet);

      rawContacts = jsonRows.map((row) => ({
        name: row['Full Name'] || row['Name'] || row['name'] || row['full_name'] || 'Customer',
        phone: String(row['Phone'] || row['Contact'] || row['Mobile'] || row['phone'] || row['contact'] || ''),
        email: row['Email'] || row['Mail'] || row['email'] || row['mail'] || '',
        address: row['Address'] || row['City'] || row['address'] || '',
        pan_no: row['PAN'] || row['pan_no'] || row['Pan Number'] || '',
        city: row['City'] || row['city'] || '',
      }));
    } else if (req.body.contacts) {
      rawContacts = Array.isArray(req.body.contacts)
        ? req.body.contacts
        : JSON.parse(req.body.contacts);
    } else {
      res.status(400).json({ success: false, message: 'No file or contacts data provided.' });
      return;
    }

    if (rawContacts.length === 0) {
      res.status(400).json({ success: false, message: 'Uploaded file is empty or invalid.' });
      return;
    }

    const ingestionReport = await ingestContactsBatch(rawContacts, broadcastId, targetCompany);

    await logAdminAudit(
      req.user!.id,
      'INGEST_CONTACTS',
      'campaign_master_leads',
      undefined,
      {
        total: ingestionReport.totalProcessed,
        new: ingestionReport.newInserted,
        updated: ingestionReport.updatedExisting,
        urnMapped: ingestionReport.matchedUrnCount,
        company: targetCompany,
      },
      req.ip
    );

    emitBroadcastUpdate({ type: 'LEADS_UPDATED', report: ingestionReport });

    res.json({
      success: true,
      report: ingestionReport,
      message: `Processed ${ingestionReport.totalProcessed} contacts for ${targetCompany}. ${ingestionReport.newInserted} new, ${ingestionReport.updatedExisting} updated, ${ingestionReport.matchedUrnCount} mapped to OmniReach URNs.`,
    });
  } catch (err: any) {
    console.error('Upload ingestion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Batch Delete Contacts (Superadmin Only)
router.delete('/batch-delete', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { lead_ids } = req.body;
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No contact IDs provided for batch deletion.' });
    return;
  }

  try {
    await query(
      `DELETE FROM campaign_master_leads WHERE id = ANY($1::uuid[])`,
      [lead_ids]
    );

    await logAdminAudit(
      req.user!.id,
      'BATCH_DELETE_CONTACTS',
      'campaign_master_leads',
      undefined,
      { count: lead_ids.length },
      req.ip
    );

    res.json({ success: true, message: `Successfully deleted ${lead_ids.length} contacts.` });
  } catch (err: any) {
    console.error('Batch delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/batch-delete', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { lead_ids } = req.body;
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No contact IDs provided for batch deletion.' });
    return;
  }

  try {
    await query(
      `DELETE FROM campaign_master_leads WHERE id = ANY($1::uuid[])`,
      [lead_ids]
    );

    await logAdminAudit(
      req.user!.id,
      'BATCH_DELETE_CONTACTS',
      'campaign_master_leads',
      undefined,
      { count: lead_ids.length },
      req.ip
    );

    res.json({ success: true, message: `Successfully deleted ${lead_ids.length} contacts.` });
  } catch (err: any) {
    console.error('Batch delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Update Single Contact Preferences / Details
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { whatsapp_optin, email_optin, full_name, metadata_json } = req.body;

  try {
    const compCond = getCompanyCondition(req, 5);
    const extraWhere = compCond.clause ? `AND ${compCond.clause}` : '';

    const updateRes = await query(
      `UPDATE campaign_master_leads 
       SET whatsapp_optin = COALESCE($1, whatsapp_optin),
           email_optin = COALESCE($2, email_optin),
           full_name = COALESCE($3, full_name),
           metadata_json = COALESCE($4, metadata_json),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 ${extraWhere}
       RETURNING *`,
      [whatsapp_optin, email_optin, full_name, metadata_json ? JSON.stringify(metadata_json) : null, String(id), ...compCond.params]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    res.json({ success: true, lead: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Delete Contact (Superadmin Only)
router.delete('/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM campaign_master_leads WHERE id = $1`, [String(id)]);
    res.json({ success: true, message: 'Contact removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Download Sample CSV Template
router.get('/sample-template', (req, res) => {
  const csvContent = 'Full Name,Phone,Email,Address,City,PAN\nRahul Sharma,9876543210,rahul@example.com,Andheri West,Mumbai,ABCPS1234F\nPriya Patel,9812345678,priya@example.com,Koramangala,Bengaluru,XYZPP5678K\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="OmniReach_Contacts_Sample.csv"');
  res.send(csvContent);
});

export default router;
