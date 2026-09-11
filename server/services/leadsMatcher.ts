import { query, pool } from '../config/db';

export interface RawContactInput {
  name?: string;
  phone?: string | number;
  email?: string;
  address?: string;
  pan_no?: string;
  city?: string;
  custom_attributes?: Record<string, any>;
}

export interface IngestionResult {
  totalProcessed: number;
  newInserted: number;
  updatedExisting: number;
  matchedUrnCount: number;
  newFmcbCount: number;
  invalidCount: number;
  errors: { row: number; reason: string; data: any }[];
  leadIds: string[];
}

/**
 * Normalizes phone numbers into standard Indian or international format.
 * Handles scientific exponential notation from Excel (e.g. 9.35017061E+09).
 */
export function normalizePhone(rawPhone: string | number | undefined): string | null {
  if (rawPhone === undefined || rawPhone === null) return null;
  let str = String(rawPhone).trim();
  if (!str) return null;

  // Handle scientific exponential notation from Excel e.g. 9.35017061E+09 or 9.35E9
  if (/[eE][+-]?\d+/.test(str)) {
    const num = Number(str);
    if (!isNaN(num) && isFinite(num)) {
      str = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }

  let digits = str.replace(/\D/g, '');
  if (digits.length === 10) {
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Standard Indian 12-digit format
  } else if (digits.length >= 10 && digits.length <= 15) {
    // Valid international format
  } else {
    return null;
  }
  return digits;
}

/**
 * Validates Email syntax.
 */
export function validateEmail(rawEmail?: string): string | null {
  if (!rawEmail) return null;
  const trimmed = String(rawEmail).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
}

/**
 * Generates next sequential FMCB ID (e.g. FMCB00000001, FMCB00000002...).
 */
export async function getNextFmcbId(): Promise<string> {
  const res = await query(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(fmcb_id, '[^0-9]', '', 'g'), '')::bigint), 0) + 1 as next_id 
    FROM campaign_master_leads
  `);
  const num = parseInt(res.rows[0].next_id, 10);
  return `FMCB${String(num).padStart(8, '0')}`;
}

/**
 * Ingests a batch of raw contact records with zero duplicate upsert,
 * Leads Repository URN lookup, and FMCB ID generation.
 * Supports contacts with Phone only, Email only, or Both.
 * Optimized for ultra-high throughput (lakhs / 100,000+ contacts) using
 * chunked multi-row batch inserts and updates with PostgreSQL sequences.
 */
export async function ingestContactsBatch(
  contacts: RawContactInput[],
  broadcastId?: string,
  companyName: string = 'OmniReach Global'
): Promise<IngestionResult> {
  const result: IngestionResult = {
    totalProcessed: 0,
    newInserted: 0,
    updatedExisting: 0,
    matchedUrnCount: 0,
    newFmcbCount: 0,
    invalidCount: 0,
    errors: [],
    leadIds: [],
  };

  if (!contacts || contacts.length === 0) return result;

  // 1. In-memory validation, normalization, and deduplication across file
  interface CleanContact {
    phone: string | null;
    email: string | null;
    name: string;
    address: string | null;
    pan_no: string | null;
    city: string | null;
    custom_attributes: Record<string, any>;
  }

  const phoneMap = new Map<string, CleanContact>();
  const emailMap = new Map<string, CleanContact>();
  const uniqueContacts: CleanContact[] = [];

  for (let i = 0; i < contacts.length; i++) {
    const item = contacts[i];
    const phone = normalizePhone(item.phone);
    const email = validateEmail(item.email);

    if (!phone && !email) {
      result.invalidCount++;
      if (result.errors.length < 50) {
        result.errors.push({
          row: i + 1,
          reason: 'Invalid contact. Must provide at least a valid phone number (min 10 digits) or valid email address.',
          data: item,
        });
      }
      continue;
    }

    result.totalProcessed++;

    // Check if we already have this contact in our current batch (by phone or email)
    let existingContact: CleanContact | undefined;
    if (phone && phoneMap.has(phone)) {
      existingContact = phoneMap.get(phone);
    } else if (email && emailMap.has(email)) {
      existingContact = emailMap.get(email);
    }

    if (existingContact) {
      // Merge new data if available
      if (phone && !existingContact.phone) {
        existingContact.phone = phone;
        phoneMap.set(phone, existingContact);
      }
      if (email && !existingContact.email) {
        existingContact.email = email;
        emailMap.set(email, existingContact);
      }
      if (item.name && item.name !== 'Customer' && existingContact.name === 'Customer') {
        existingContact.name = item.name;
      }
      if (item.address && !existingContact.address) existingContact.address = item.address;
      if (item.pan_no && !existingContact.pan_no) existingContact.pan_no = item.pan_no;
      if (item.city && !existingContact.city) existingContact.city = item.city;
    } else {
      const newContact: CleanContact = {
        phone: phone || null,
        email: email || null,
        name: item.name || 'Customer',
        address: item.address || null,
        pan_no: item.pan_no || null,
        city: item.city || null,
        custom_attributes: item.custom_attributes || {},
      };
      if (phone) phoneMap.set(phone, newContact);
      if (email) emailMap.set(email, newContact);
      uniqueContacts.push(newContact);
    }
  }

  if (uniqueContacts.length === 0) return result;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure fmcb_id_seq is safely synchronized with highest numerical ID in campaign_master_leads
    // Passing true when COUNT > 0 guarantees nextval will return MAX + 1, avoiding any duplicate key violation!
    await client.query(`
      SELECT setval(
        'fmcb_id_seq', 
        GREATEST(COALESCE((SELECT MAX(NULLIF(regexp_replace(fmcb_id, '[^0-9]', '', 'g'), '')::bigint) FROM campaign_master_leads), 0), 1),
        (SELECT COUNT(*) FROM campaign_master_leads) > 0
      );
    `);

    // Process in chunks of 1,000 contacts for ultra-high speed and low memory
    const CHUNK_SIZE = 1000;

    for (let c = 0; c < uniqueContacts.length; c += CHUNK_SIZE) {
      const chunk = uniqueContacts.slice(c, c + CHUNK_SIZE);
      const chunkPhones = chunk.map((contact) => contact.phone).filter(Boolean) as string[];
      const chunkEmails = chunk.map((contact) => contact.email).filter(Boolean) as string[];

      // 1. Fast Bulk Lookup in Database for Existing Records
      const dbPhoneMap = new Map<string, any>();
      const dbEmailMap = new Map<string, any>();

      if (chunkPhones.length > 0 || chunkEmails.length > 0) {
        const existingRes = await client.query(
          `SELECT id, phone, email, fmcb_id, urn, company_name, full_name, address, pan_no, city
           FROM campaign_master_leads 
           WHERE (phone IS NOT NULL AND phone = ANY($1::varchar[]))
              OR (email IS NOT NULL AND LOWER(email) = ANY($2::varchar[]))`,
          [chunkPhones, chunkEmails.map((e) => e.toLowerCase())]
        );
        for (const row of existingRes.rows) {
          if (row.phone) dbPhoneMap.set(row.phone, row);
          if (row.email) dbEmailMap.set(row.email.toLowerCase(), row);
        }
      }

      // 2. Fast Bulk Lookup in Leads Repository for Ground Truth URN in 1 query
      const repoUrnMap = new Map<string, string>();
      if (chunkPhones.length > 0 || chunkEmails.length > 0) {
        const repoRes = await client.query(
          `SELECT urn, phone, email 
           FROM leads_repository 
           WHERE (phone IS NOT NULL AND phone = ANY($1::varchar[])) 
              OR (email IS NOT NULL AND LOWER(email) = ANY($2::varchar[]))`,
          [chunkPhones, chunkEmails.map((e) => e.toLowerCase())]
        );
        for (const r of repoRes.rows) {
          if (r.phone) repoUrnMap.set(r.phone, r.urn);
          if (r.email) repoUrnMap.set(r.email.toLowerCase(), r.urn);
        }
      }

      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      for (const contact of chunk) {
        const dbRecord = (contact.phone ? dbPhoneMap.get(contact.phone) : null) ||
                         (contact.email ? dbEmailMap.get(contact.email.toLowerCase()) : null);

        const mappedUrn = (contact.phone ? repoUrnMap.get(contact.phone) : null) ||
                          (contact.email ? repoUrnMap.get(contact.email.toLowerCase()) : null) ||
                          dbRecord?.urn || null;

        if (mappedUrn && (!dbRecord || !dbRecord.urn)) {
          result.matchedUrnCount++;
        }

        if (dbRecord) {
          // Existing contact in DB: prepare for update
          toUpdate.push({
            id: dbRecord.id,
            name: contact.name !== 'Customer' ? contact.name : (dbRecord.full_name || 'Customer'),
            phone: contact.phone || dbRecord.phone,
            email: contact.email || dbRecord.email,
            address: contact.address || dbRecord.address,
            pan_no: contact.pan_no || dbRecord.pan_no,
            city: contact.city || dbRecord.city,
            urn: mappedUrn,
            companyName: companyName !== 'OmniReach Global' ? companyName : dbRecord.company_name,
            last_broadcast_id: broadcastId || null,
          });
          result.leadIds.push(dbRecord.id);
        } else {
          // Truly new contact: prepare for insert with next sequential FMCB ID
          toInsert.push({
            urn: mappedUrn,
            companyName,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            address: contact.address,
            pan_no: contact.pan_no,
            city: contact.city,
            custom_attributes: contact.custom_attributes,
            last_broadcast_id: broadcastId || null,
          });
        }
      }

      // Execute Batch Insert
      if (toInsert.length > 0) {
        const insertTuples: string[] = [];
        const insertParams: any[] = [];

        for (let i = 0; i < toInsert.length; i++) {
          const item = toInsert[i];
          const offset = i * 10;
          insertTuples.push(
            `($${offset + 1}, 'FMCB' || LPAD(nextval('fmcb_id_seq')::text, 8, '0'), $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, CURRENT_TIMESTAMP)`
          );
          insertParams.push(
            item.urn,
            item.companyName,
            item.name,
            item.phone,
            item.email,
            item.address,
            item.pan_no,
            item.city,
            JSON.stringify(item.custom_attributes || {}),
            item.last_broadcast_id
          );
        }

        const insertSql = `
          INSERT INTO campaign_master_leads 
          (urn, fmcb_id, company_name, full_name, phone, email, address, pan_no, city, custom_attributes, last_broadcast_id, updated_at)
          VALUES ${insertTuples.join(',\n')}
          RETURNING id
        `;

        const insRes = await client.query(insertSql, insertParams);
        for (const row of insRes.rows) {
          result.leadIds.push(row.id);
        }
        result.newInserted += insRes.rows.length;
        result.newFmcbCount += insRes.rows.length;
      }

      // Execute Batch Update
      if (toUpdate.length > 0) {
        const updateTuples: string[] = [];
        const updateParams: any[] = [];

        for (let i = 0; i < toUpdate.length; i++) {
          const item = toUpdate[i];
          const offset = i * 10;
          updateTuples.push(
            `($${offset + 1}::uuid, $${offset + 2}::text, $${offset + 3}::text, $${offset + 4}::text, $${offset + 5}::text, $${offset + 6}::text, $${offset + 7}::text, $${offset + 8}::text, $${offset + 9}::text, $${offset + 10}::uuid)`
          );
          updateParams.push(
            item.id,
            item.name,
            item.phone,
            item.email,
            item.address,
            item.pan_no,
            item.city,
            item.urn,
            item.companyName,
            item.last_broadcast_id
          );
        }

        const updateSql = `
          UPDATE campaign_master_leads AS m
          SET 
            full_name = COALESCE(NULLIF(v.name, 'Customer'), m.full_name),
            phone = COALESCE(v.phone, m.phone),
            email = COALESCE(v.email, m.email),
            address = COALESCE(v.address, m.address),
            pan_no = COALESCE(v.pan_no, m.pan_no),
            city = COALESCE(v.city, m.city),
            urn = COALESCE(v.urn, m.urn),
            company_name = COALESCE(NULLIF(v.company_name, 'OmniReach Global'), m.company_name),
            last_broadcast_id = COALESCE(v.last_broadcast_id, m.last_broadcast_id),
            updated_at = CURRENT_TIMESTAMP
          FROM (VALUES ${updateTuples.join(',\n')}) AS v(id, name, phone, email, address, pan_no, city, urn, company_name, last_broadcast_id)
          WHERE m.id = v.id
        `;

        await client.query(updateSql, updateParams);
        result.updatedExisting += toUpdate.length;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return result;
}
