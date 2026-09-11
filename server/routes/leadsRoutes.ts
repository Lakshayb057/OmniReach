import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { ingestContactsBatch, RawContactInput } from '../services/leadsMatcher';
import { emitBroadcastUpdate } from '../services/worker';

export interface IngestJob {
  jobId: string;
  targetCompany: string;
  totalRows: number;
  processed: number;
  percent: number;
  newInserted: number;
  updatedExisting: number;
  status: 'processing' | 'completed' | 'failed';
  report?: any;
  error?: string;
  startedAt: number;
}

export const activeIngestJobs = new Map<string, IngestJob>();

// Clean up old jobs after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of activeIngestJobs.entries()) {
    if (job.startedAt < oneHourAgo) {
      activeIngestJobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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
      const originalName = req.file.originalname?.toLowerCase() || '';
      const isCsv = originalName.endsWith('.csv') || req.file.mimetype === 'text/csv';

      if (isCsv) {
        try {
          const text = buffer.toString('utf8');
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 1) {
            const headerLine = lines[0];
            const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

            const nameIdx = headers.findIndex((h) => h.includes('name'));
            const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('contact') || h.includes('mobile') || h.includes('number'));
            const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
            const addressIdx = headers.findIndex((h) => h.includes('address'));
            const panIdx = headers.findIndex((h) => h.includes('pan'));
            const cityIdx = headers.findIndex((h) => h.includes('city'));

            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              const cols = line.includes('"')
                ? line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.trim().replace(/^["']|["']$/g, ''))
                : line.split(',').map((c) => c.trim());

              const phone = phoneIdx !== -1 ? (cols[phoneIdx] || '') : '';
              const email = emailIdx !== -1 ? (cols[emailIdx] || '') : '';
              if (!phone && !email) continue;

              rawContacts.push({
                name: (nameIdx !== -1 ? cols[nameIdx] : '') || 'Customer',
                phone: String(phone),
                email: String(email),
                address: (addressIdx !== -1 ? cols[addressIdx] : '') || '',
                pan_no: (panIdx !== -1 ? cols[panIdx] : '') || '',
                city: (cityIdx !== -1 ? cols[cityIdx] : '') || '',
              });
            }
          }
        } catch (e) {
          // Fall back to sheetjs if line parsing encounters edge cases
          rawContacts = [];
        }
      }

      if (rawContacts.length === 0) {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = xlsx.utils.sheet_to_json(sheet);

        rawContacts = jsonRows
          .map((row) => ({
            name: row['Full Name'] || row['Name'] || row['name'] || row['full_name'] || 'Customer',
            phone: String(row['Phone'] || row['Contact'] || row['Mobile'] || row['phone'] || row['contact'] || ''),
            email: String(row['Email'] || row['Mail'] || row['email'] || row['mail'] || ''),
            address: row['Address'] || row['City'] || row['address'] || '',
            pan_no: row['PAN'] || row['pan_no'] || row['Pan Number'] || '',
            city: row['City'] || row['city'] || '',
          }))
          .filter((c) => c.phone || c.email);
      }
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

    const jobId = crypto.randomUUID();
    const userId = req.user!.id;
    const userIp = req.ip;

    const job: IngestJob = {
      jobId,
      targetCompany,
      totalRows: rawContacts.length,
      processed: 0,
      percent: 0,
      newInserted: 0,
      updatedExisting: 0,
      status: 'processing',
      startedAt: Date.now(),
    };
    activeIngestJobs.set(jobId, job);

    // Return immediate HTTP 202 response to prevent any cloud proxy timeout
    res.status(202).json({
      success: true,
      jobId,
      status: 'processing',
      totalRows: rawContacts.length,
      message: `Received ${rawContacts.length.toLocaleString()} contacts. Ingestion started in background.`,
    });

    // Run ingestion in background asynchronously with real-time WebSocket progress updates
    setImmediate(async () => {
      try {
        const ingestionReport = await ingestContactsBatch(
          rawContacts,
          broadcastId,
          targetCompany,
          (prog) => {
            job.processed = prog.processed;
            job.percent = prog.percent;
            job.newInserted = prog.newInserted;
            job.updatedExisting = prog.updatedExisting;

            emitBroadcastUpdate({
              type: 'INGEST_PROGRESS',
              jobId,
              processed: prog.processed,
              total: prog.total,
              percent: prog.percent,
              newInserted: prog.newInserted,
              updatedExisting: prog.updatedExisting,
              status: 'processing',
            });
          }
        );

        job.status = 'completed';
        job.percent = 100;
        job.report = ingestionReport;

        await logAdminAudit(
          userId,
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
          userIp
        );

        emitBroadcastUpdate({
          type: 'INGEST_PROGRESS',
          jobId,
          percent: 100,
          processed: rawContacts.length,
          total: rawContacts.length,
          newInserted: ingestionReport.newInserted,
          updatedExisting: ingestionReport.updatedExisting,
          status: 'completed',
          report: ingestionReport,
        });

        emitBroadcastUpdate({ type: 'LEADS_UPDATED', report: ingestionReport });
      } catch (err: any) {
        console.error('Background ingestion error:', err);
        job.status = 'failed';
        job.error = err.message;
        emitBroadcastUpdate({
          type: 'INGEST_PROGRESS',
          jobId,
          status: 'failed',
          error: err.message,
        });
      }
    });
  } catch (err: any) {
    console.error('Upload ingestion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to poll job status
router.get('/upload-status/:jobId', authenticateToken, (req: AuthenticatedRequest, res): void => {
  const jobId = String(req.params.jobId);
  const job = activeIngestJobs.get(jobId);
  if (!job) {
    res.status(404).json({ success: false, message: 'Ingestion job not found.' });
    return;
  }
  res.json({ success: true, job });
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
