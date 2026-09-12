import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { query } from '../config/db';
import { authenticateToken, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';
import { 
  ingestContactsBatch, 
  RawContactInput, 
  normalizePhone, 
  validateEmail, 
  getNextFmcbId 
} from '../services/leadsMatcher';
import { buildSearchClauses, getCompanyCondition, buildLeadsWhereClause } from '../utils/searchUtils';
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

// 1. Get Paginated Master Contacts (Ultra-fast parallel query execution with sorting)
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { page = '1', limit = '50', sort_by = 'sr_no', sort_dir = 'ASC' } = req.query;

  try {
    const { whereSql, params } = buildLeadsWhereClause(req);
    console.log(`[LeadsAPI] GET / whereSql: ${whereSql}, params: ${params.length}, search: ${req.query.search}`);
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(500, Math.max(10, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const validSortColumns: Record<string, string> = {
      sr_no: 'sr_no',
      full_name: 'full_name',
      phone: 'phone',
      email: 'email',
      created_at: 'created_at',
      whatsapp_sent_count: 'whatsapp_sent_count',
      email_sent_count: 'email_sent_count',
      last_contacted_at: 'last_contacted_at',
    };

    const sortColumn = validSortColumns[String(sort_by).toLowerCase()] || 'sr_no';
    const sortDirection = String(sort_dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const dataParams = [...params, limitNum, offset];

    // Execute count and paginated select in parallel for maximum throughput
    const [countRes, dataRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM campaign_master_leads ${whereSql}`, params),
      query(
        `SELECT * FROM campaign_master_leads 
         ${whereSql} 
         ORDER BY ${sortColumn} ${sortDirection} 
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err: any) {
    console.error('Error fetching master leads:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Fast audience count and Sr. No boundaries lookup for Campaign Wizard
router.get('/count', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { whereSql, params } = buildLeadsWhereClause(req);

    const r = await query(
      `SELECT COUNT(*) as count, MIN(sr_no) as min_sr_no, MAX(sr_no) as max_sr_no 
       FROM campaign_master_leads ${whereSql}`,
      params
    );

    res.json({
      success: true,
      count: parseInt(r.rows[0]?.count || '0', 10),
      min_sr_no: r.rows[0]?.min_sr_no ? parseInt(r.rows[0].min_sr_no, 10) : 1,
      max_sr_no: r.rows[0]?.max_sr_no ? parseInt(r.rows[0].max_sr_no, 10) : 1,
    });
  } catch (err: any) {
    console.error('Error counting master leads:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Export Filtered Contacts to CSV
router.get('/export', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { whereSql, params } = buildLeadsWhereClause(req);

    // Stream up to 50,000 rows with fast CSV generation
    const exportRes = await query(
      `SELECT sr_no, full_name, phone, email, city, address, pan_no, urn, fmcb_id, company_name,
              whatsapp_optin, email_optin, whatsapp_sent_count, email_sent_count, clicked_count, created_at
       FROM campaign_master_leads 
       ${whereSql} 
       ORDER BY sr_no ASC 
       LIMIT 50000`,
      params
    );

    const rows = exportRes.rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="OmniReach_Master_Contacts_${Date.now()}.csv"`);

    res.write('Sr No,Full Name,Phone,Email,City,Address,PAN,URN,FMCB ID,Company,WhatsApp Optin,Email Optin,WhatsApp Sent,Email Sent,Clicks,Created At\r\n');

    for (const r of rows) {
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const line = [
        r.sr_no,
        escapeCsv(r.full_name),
        escapeCsv(r.phone ? `+${r.phone}` : ''),
        escapeCsv(r.email),
        escapeCsv(r.city),
        escapeCsv(r.address),
        escapeCsv(r.pan_no),
        escapeCsv(r.urn),
        escapeCsv(r.fmcb_id),
        escapeCsv(r.company_name),
        r.whatsapp_optin ? 'YES' : 'NO',
        r.email_optin ? 'YES' : 'NO',
        r.whatsapp_sent_count || 0,
        r.email_sent_count || 0,
        r.clicked_count || 0,
        escapeCsv(r.created_at ? new Date(r.created_at).toISOString() : ''),
      ].join(',');

      res.write(line + '\r\n');
    }

    res.end();
  } catch (err: any) {
    console.error('Master leads export error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Create Single Contact (With Phone Priority Deduplication, auto Sr. No, and URN/FMCB generation)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const {
      full_name,
      phone,
      email,
      city,
      address,
      pan_no,
      whatsapp_optin = true,
      email_optin = true,
      custom_attributes = {},
    } = req.body;

    const cleanPhone = normalizePhone(phone);
    const cleanEmail = validateEmail(email);

    if (!cleanPhone && !cleanEmail) {
      res.status(400).json({
        success: false,
        message: 'At least a valid phone number (10-15 digits) or email address is required.',
      });
      return;
    }

    const company = req.user?.role === 'superadmin'
      ? (req.body.company_name || 'OmniReach Global')
      : (req.user?.company_name || 'Independent Enterprise');

    const cleanName = (full_name && String(full_name).trim()) || 'Valued Customer';
    const cleanCity = city ? String(city).trim() : null;
    const cleanAddress = address ? String(address).trim() : null;
    const cleanPan = pan_no ? String(pan_no).trim().toUpperCase() : null;

    // Highest Priority Deduplication:
    // "most priority is contact no.! if the contact match and email changes update the email first"
    let existingMatch: any = null;

    if (cleanPhone) {
      const matchByPhone = await query(
        `SELECT * FROM campaign_master_leads WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );
      if (matchByPhone.rows.length > 0) {
        existingMatch = matchByPhone.rows[0];
      }
    }

    if (!existingMatch && cleanEmail) {
      const matchByEmail = await query(
        `SELECT * FROM campaign_master_leads WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [cleanEmail]
      );
      if (matchByEmail.rows.length > 0) {
        existingMatch = matchByEmail.rows[0];
      }
    }

    if (existingMatch) {
      // Update existing record, preserving immutable sr_no and urn/fmcb_id
      const updatedRes = await query(
        `UPDATE campaign_master_leads
         SET full_name = CASE WHEN $1 != 'Valued Customer' THEN $1 ELSE full_name END,
             phone = COALESCE($2, phone),
             email = COALESCE($3, email),
             city = COALESCE($4, city),
             address = COALESCE($5, address),
             pan_no = COALESCE($6, pan_no),
             whatsapp_optin = COALESCE($7, whatsapp_optin),
             email_optin = COALESCE($8, email_optin),
             custom_attributes = campaign_master_leads.custom_attributes || $9::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $10
         RETURNING *`,
        [
          cleanName,
          cleanPhone || existingMatch.phone,
          cleanEmail || existingMatch.email,
          cleanCity || existingMatch.city,
          cleanAddress || existingMatch.address,
          cleanPan || existingMatch.pan_no,
          whatsapp_optin !== undefined ? Boolean(whatsapp_optin) : existingMatch.whatsapp_optin,
          email_optin !== undefined ? Boolean(email_optin) : existingMatch.email_optin,
          JSON.stringify(custom_attributes || {}),
          existingMatch.id,
        ]
      );

      res.json({
        success: true,
        action: 'updated',
        lead: updatedRes.rows[0],
        message: `Existing contact (Sr. No #${existingMatch.sr_no}) matched and updated with priority. Zero duplicates created.`,
      });
      return;
    }

    // New Contact Insertion
    // Check Leads Repository for URN
    let assignedUrn: string | null = null;
    if (cleanPhone) {
      const urnRes = await query(
        `SELECT urn FROM leads_repository WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );
      if (urnRes.rows.length > 0) {
        assignedUrn = urnRes.rows[0].urn;
      }
    }
    if (!assignedUrn && cleanEmail) {
      const urnRes = await query(
        `SELECT urn FROM leads_repository WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [cleanEmail]
      );
      if (urnRes.rows.length > 0) {
        assignedUrn = urnRes.rows[0].urn;
      }
    }

    const fmcbId = await getNextFmcbId();

    const insertRes = await query(
      `INSERT INTO campaign_master_leads (
         full_name, phone, email, city, address, pan_no,
         whatsapp_optin, email_optin, company_name,
         urn, fmcb_id, custom_attributes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
       RETURNING *`,
      [
        cleanName,
        cleanPhone,
        cleanEmail,
        cleanCity,
        cleanAddress,
        cleanPan,
        Boolean(whatsapp_optin),
        Boolean(email_optin),
        company,
        assignedUrn,
        fmcbId,
        JSON.stringify(custom_attributes || {}),
      ]
    );

    res.status(201).json({
      success: true,
      action: 'created',
      lead: insertRes.rows[0],
      message: `Contact successfully created with immutable Sr. No #${insertRes.rows[0].sr_no} and FMCB ID ${fmcbId}.`,
    });
  } catch (err: any) {
    console.error('Error creating contact:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Update Single Contact (Full Edit of Name, Phone, Email, City, Address, PAN, Opt-ins)
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const {
    full_name,
    phone,
    email,
    city,
    address,
    pan_no,
    whatsapp_optin,
    email_optin,
    custom_attributes,
  } = req.body;

  try {
    const existing = await query(`SELECT * FROM campaign_master_leads WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    const lead = existing.rows[0];
    if (req.user?.role !== 'superadmin' && req.user?.company_name && lead.company_name !== req.user.company_name) {
      res.status(403).json({ success: false, message: 'Unauthorized: You can only edit contacts belonging to your company.' });
      return;
    }

    const cleanPhone = phone !== undefined ? normalizePhone(phone) : lead.phone;
    const cleanEmail = email !== undefined ? validateEmail(email) : lead.email;

    if (!cleanPhone && !cleanEmail) {
      res.status(400).json({ success: false, message: 'At least one valid phone or email address is required.' });
      return;
    }

    // Check duplicate phone against other contacts
    if (cleanPhone && cleanPhone !== lead.phone) {
      const dupPhone = await query(
        `SELECT id, sr_no FROM campaign_master_leads WHERE phone = $1 AND id != $2 LIMIT 1`,
        [cleanPhone, id]
      );
      if (dupPhone.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `Phone number is already registered to another contact (Sr. No #${dupPhone.rows[0].sr_no}).`,
        });
        return;
      }
    }

    // Check duplicate email against other contacts
    if (cleanEmail && cleanEmail !== lead.email) {
      const dupEmail = await query(
        `SELECT id, sr_no FROM campaign_master_leads WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1`,
        [cleanEmail, id]
      );
      if (dupEmail.rows.length > 0) {
        res.status(400).json({
          success: false,
          message: `Email address is already registered to another contact (Sr. No #${dupEmail.rows[0].sr_no}).`,
        });
        return;
      }
    }

    const updateRes = await query(
      `UPDATE campaign_master_leads 
       SET full_name = COALESCE($1, full_name),
           phone = $2,
           email = $3,
           city = COALESCE($4, city),
           address = COALESCE($5, address),
           pan_no = COALESCE($6, pan_no),
           whatsapp_optin = COALESCE($7, whatsapp_optin),
           email_optin = COALESCE($8, email_optin),
           custom_attributes = COALESCE($9::jsonb, custom_attributes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        full_name !== undefined ? String(full_name).trim() : null,
        cleanPhone,
        cleanEmail,
        city !== undefined ? String(city).trim() : null,
        address !== undefined ? String(address).trim() : null,
        pan_no !== undefined ? String(pan_no).trim().toUpperCase() : null,
        whatsapp_optin !== undefined ? Boolean(whatsapp_optin) : null,
        email_optin !== undefined ? Boolean(email_optin) : null,
        custom_attributes ? JSON.stringify(custom_attributes) : null,
        id,
      ]
    );

    res.json({ success: true, lead: updateRes.rows[0], message: 'Contact updated successfully.' });
  } catch (err: any) {
    console.error('Error updating contact:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Fast Opt-in Toggle
router.post('/optin-toggle', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { lead_id, channel, status } = req.body;
  if (!lead_id || !channel || (channel !== 'whatsapp' && channel !== 'email')) {
    res.status(400).json({ success: false, message: 'Invalid lead_id or channel specified.' });
    return;
  }

  try {
    const existing = await query(`SELECT * FROM campaign_master_leads WHERE id = $1`, [lead_id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    const lead = existing.rows[0];
    if (req.user?.role !== 'superadmin' && req.user?.company_name && lead.company_name !== req.user.company_name) {
      res.status(403).json({ success: false, message: 'Unauthorized.' });
      return;
    }

    const column = channel === 'whatsapp' ? 'whatsapp_optin' : 'email_optin';
    const updated = await query(
      `UPDATE campaign_master_leads SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [Boolean(status), lead_id]
    );

    res.json({ success: true, lead: updated.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Delete Single Contact (Company Scoped & Superadmin)
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await query(`SELECT id, company_name FROM campaign_master_leads WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Contact not found.' });
      return;
    }

    if (req.user?.role !== 'superadmin' && req.user?.company_name && existing.rows[0].company_name !== req.user.company_name) {
      res.status(403).json({ success: false, message: 'Unauthorized: You can only delete contacts belonging to your company.' });
      return;
    }

    await query(`DELETE FROM campaign_master_leads WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Contact removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Batch Delete Contacts (Company Scoped & Superadmin)
const handleBatchDelete = async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { lead_ids } = req.body;
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    res.status(400).json({ success: false, message: 'No contact IDs provided for batch deletion.' });
    return;
  }

  try {
    let deleteQuery = `DELETE FROM campaign_master_leads WHERE id = ANY($1::uuid[])`;
    const params: any[] = [lead_ids];

    if (req.user?.role !== 'superadmin') {
      deleteQuery += ` AND company_name = $2`;
      params.push(req.user?.company_name || 'Independent Enterprise');
    }

    const delRes = await query(deleteQuery, params);

    await logAdminAudit(
      req.user!.id,
      'BATCH_DELETE_CONTACTS',
      'campaign_master_leads',
      undefined,
      { count: delRes.rowCount },
      req.ip
    );

    res.json({ success: true, message: `Successfully deleted ${delRes.rowCount || lead_ids.length} contacts.` });
  } catch (err: any) {
    console.error('Batch delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

router.delete('/batch-delete', authenticateToken, handleBatchDelete);
router.post('/batch-delete', authenticateToken, handleBatchDelete);

// 9. Upload CSV / Excel or Ingest JSON Contacts
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

    res.status(202).json({
      success: true,
      jobId,
      status: 'processing',
      totalRows: rawContacts.length,
      message: `Received ${rawContacts.length.toLocaleString()} contacts. Ingestion started in background.`,
    });

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

// 10. Endpoint to poll job status
router.get('/upload-status/:jobId', authenticateToken, (req: AuthenticatedRequest, res): void => {
  const jobId = String(req.params.jobId);
  const job = activeIngestJobs.get(jobId);
  if (!job) {
    res.status(404).json({ success: false, message: 'Ingestion job not found.' });
    return;
  }
  res.json({ success: true, job });
});

// 11. Download Sample CSV Template
router.get('/sample-template', (req, res) => {
  const csvContent = 'Full Name,Phone,Email,Address,City,PAN\nRahul Sharma,9876543210,rahul@example.com,Andheri West,Mumbai,ABCPS1234F\nPriya Patel,9812345678,priya@example.com,Koramangala,Bengaluru,XYZPP5678K\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="OmniReach_Contacts_Sample.csv"');
  res.send(csvContent);
});

export default router;
