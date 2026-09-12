import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { authenticateToken, requireSuperadmin, logAdminAudit, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'broadcast_engine_jwt_secret_superlucky_2026';

// 1. User Login (Superadmin / Company Admin / Operator)
router.post('/login', async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: 'Email and password are required.' });
    return;
  }

  try {
    const userRes = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, company_name: user.company_name },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set 15-Minute HTTP-only & Session Cookies (15 minutes = 900,000 ms)
    const fifteenMinutesMs = 15 * 60 * 1000;
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: fifteenMinutesMs,
    });
    res.cookie('session_active', '1', {
      maxAge: fifteenMinutesMs,
      sameSite: 'lax',
    });

    await logAdminAudit(user.id, 'USER_LOGIN', 'users', user.id, { email: user.email, company: user.company_name }, req.ip);

    res.json({
      success: true,
      token,
      expiresInMinutes: 15,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        company_name: user.company_name || 'OmniReach Global',
        permissions: user.permissions,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// 2. User Logout & Cookie Clearance
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.clearCookie('session_active');
  res.json({ success: true, message: 'Session closed and cookies cleared.' });
});

// 3. Get Current Authenticated Profile
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// 3. List Users / Company Admins / Live Chat Agents
router.get('/users', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { company_name } = req.query;
  try {
    let whereClause = '';
    const params: any[] = [];
    if (req.user?.role === 'superadmin') {
      if (company_name && company_name !== 'all') {
        params.push(company_name);
        whereClause = 'WHERE company_name = $1';
      }
    } else {
      params.push(req.user?.company_name || 'Independent Enterprise');
      whereClause = 'WHERE company_name = $1';
    }

    const result = await query(
      `SELECT id, email, full_name, role, company_name, permissions, is_active, created_at, updated_at 
       FROM users ${whereClause} 
       ORDER BY created_at ASC`,
      params
    );
    res.json({ success: true, users: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Superadmin: Create New Admin with Company Name
router.post('/users', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { email, password, full_name, role, company_name, permissions } = req.body;

  if (!email || !password || !full_name) {
    res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
    return;
  }

  const assignedCompany = (company_name && company_name.trim()) || (role === 'superadmin' ? 'OmniReach Global' : 'Independent Enterprise');

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertRes = await query(
      `INSERT INTO users (email, password_hash, full_name, role, company_name, permissions, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, email, full_name, role, company_name, permissions, is_active, created_at`,
      [
        email.trim().toLowerCase(),
        passwordHash,
        full_name,
        role || 'admin',
        assignedCompany,
        JSON.stringify(permissions || { manage_campaigns: true, manage_leads: true, manage_templates: true }),
      ]
    );

    const newUser = insertRes.rows[0];
    await logAdminAudit(req.user!.id, 'CREATE_ADMIN', 'users', newUser.id, { email: newUser.email, role: newUser.role, company: assignedCompany }, req.ip);

    res.json({ success: true, user: newUser });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(400).json({ success: false, message: 'A user with this email already exists.' });
      return;
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Superadmin: Update Admin Role / Company / Status / Password
router.put('/users/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { full_name, role, company_name, permissions, is_active, password } = req.body;

  try {
    let passwordHashUpdate = '';
    const params: any[] = [full_name, role, company_name, JSON.stringify(permissions || {}), is_active, id];

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      params.push(hash);
      passwordHashUpdate = `, password_hash = $${params.length}`;
    }

    const updateRes = await query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           role = COALESCE($2, role),
           company_name = COALESCE($3, company_name),
           permissions = COALESCE($4, permissions),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
           ${passwordHashUpdate}
       WHERE id = $6
       RETURNING id, email, full_name, role, company_name, permissions, is_active, updated_at`,
      params
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    await logAdminAudit(req.user!.id, 'UPDATE_ADMIN', 'users', String(id), { role, company_name, is_active }, req.ip);

    res.json({ success: true, user: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Superadmin: Delete User & Cascade All Company Data Completely from PostgreSQL
router.delete('/users/:id', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    if (id === req.user!.id) {
      res.status(400).json({ success: false, message: 'You cannot delete your own superadmin account.' });
      return;
    }

    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const targetUser = userRes.rows[0];
    const companyName = targetUser.company_name;

    // If target user is a company tenant user (not OmniReach Global), completely purge all company data
    if (companyName && companyName.trim() !== '' && companyName !== 'OmniReach Global') {
      // 1. Delete journey step logs & enrollments
      await query('DELETE FROM journey_step_logs WHERE journey_id IN (SELECT id FROM journeys WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM journey_enrollments WHERE journey_id IN (SELECT id FROM journeys WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM journeys WHERE company_name = $1', [companyName]);

      // 2. Delete campaign delivery logs & CTR clicks
      await query('DELETE FROM campaign_logs WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM ctr_clicks WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM campaign_broadcasts WHERE company_name = $1', [companyName]);

      // 3. Delete templates
      await query('DELETE FROM campaign_templates WHERE company_name = $1', [companyName]);

      // 4. Delete gateways & API credentials
      await query('DELETE FROM gateways_config WHERE company_name = $1', [companyName]);

      // 5. Delete master leads & associated logs/clicks
      await query('DELETE FROM ctr_clicks WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM campaign_logs WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM journey_enrollments WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [companyName]);
      await query('DELETE FROM campaign_master_leads WHERE company_name = $1', [companyName]);

      // 6. Delete all users belonging to this company (except superadmin)
      await query("DELETE FROM users WHERE company_name = $1 AND role != 'superadmin'", [companyName]);
    } else {
      // Just delete this specific user
      await query('DELETE FROM users WHERE id = $1', [id]);
    }

    await logAdminAudit(req.user!.id, 'DELETE_USER_AND_COMPANY_DATA', 'users', id, { email: targetUser.email, company: companyName }, req.ip);

    res.json({
      success: true,
      message: `User ${targetUser.email} and all data for company '${companyName}' completely removed from database.`,
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Superadmin: Delete Entire Company and All Associated Resources
router.delete('/companies/:company_name', authenticateToken, requireSuperadmin, async (req: AuthenticatedRequest, res): Promise<void> => {
  const company_name = String(req.params.company_name);
  try {
    if (!company_name || company_name === 'OmniReach Global') {
      res.status(400).json({ success: false, message: 'Cannot delete default OmniReach Global system company.' });
      return;
    }

    // 1. Delete journey step logs & enrollments
    await query('DELETE FROM journey_step_logs WHERE journey_id IN (SELECT id FROM journeys WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM journey_enrollments WHERE journey_id IN (SELECT id FROM journeys WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM journeys WHERE company_name = $1', [company_name]);

    // 2. Delete campaign delivery logs & CTR clicks
    await query('DELETE FROM campaign_logs WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM ctr_clicks WHERE broadcast_id IN (SELECT id FROM campaign_broadcasts WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM campaign_broadcasts WHERE company_name = $1', [company_name]);

    // 3. Delete templates
    await query('DELETE FROM campaign_templates WHERE company_name = $1', [company_name]);

    // 4. Delete gateways
    await query('DELETE FROM gateways_config WHERE company_name = $1', [company_name]);

    // 5. Delete master leads & associated logs/clicks
    await query('DELETE FROM ctr_clicks WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM campaign_logs WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM journey_enrollments WHERE master_lead_id IN (SELECT id FROM campaign_master_leads WHERE company_name = $1)', [company_name]);
    await query('DELETE FROM campaign_master_leads WHERE company_name = $1', [company_name]);

    // 6. Delete users
    await query("DELETE FROM users WHERE company_name = $1 AND role != 'superadmin'", [company_name]);

    await logAdminAudit(req.user!.id, 'DELETE_COMPANY_DATA', 'companies', company_name, { company: company_name }, req.ip);

    res.json({
      success: true,
      message: `All data, gateways, templates, broadcasts, contacts, and users for company '${company_name}' completely deleted from PostgreSQL.`,
    });
  } catch (err: any) {
    console.error('Delete company error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Get List of All Distinct Companies in System (for Superadmin Filter & Form Dropdowns)
router.get('/companies', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      res.json({ success: true, companies: [req.user?.company_name || 'OmniReach Global'] });
      return;
    }

    const compRes = await query(`
      SELECT DISTINCT company_name 
      FROM (
        SELECT company_name FROM users WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM gateways_config WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_templates WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_master_leads WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_broadcasts WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM journeys WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT 'OmniReach Global' as company_name
      ) as combined_companies
      ORDER BY company_name ASC
    `);

    const companies = compRes.rows.map((r: any) => r.company_name).filter(Boolean);
    if (!companies.includes('OmniReach Global')) {
      companies.unshift('OmniReach Global');
    }

    res.json({ success: true, companies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Superadmin: Get All Companies with aggregated statistics & counts
router.get('/companies-detailed', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const compRes = await query(`
      SELECT DISTINCT company_name 
      FROM (
        SELECT company_name FROM users WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM gateways_config WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_templates WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_master_leads WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM campaign_broadcasts WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT company_name FROM journeys WHERE company_name IS NOT NULL AND company_name != ''
        UNION
        SELECT 'OmniReach Global' as company_name
      ) as combined_companies
      ORDER BY company_name ASC
    `);

    const detailedCompanies = await Promise.all(
      compRes.rows.map(async (row: any) => {
        const cName = row.company_name;
        const [usersCount, gwCount, tplCount, bcastCount, leadsCount, journeysCount] = await Promise.all([
          query('SELECT COUNT(*) as count FROM users WHERE company_name = $1', [cName]),
          query('SELECT COUNT(*) as count FROM gateways_config WHERE company_name = $1', [cName]),
          query('SELECT COUNT(*) as count FROM campaign_templates WHERE company_name = $1', [cName]),
          query('SELECT COUNT(*) as count FROM campaign_broadcasts WHERE company_name = $1', [cName]),
          query('SELECT COUNT(*) as count FROM campaign_master_leads WHERE company_name = $1', [cName]),
          query('SELECT COUNT(*) as count FROM journeys WHERE company_name = $1', [cName]),
        ]);

        return {
          company_name: cName,
          users_count: parseInt(usersCount.rows[0]?.count || '0', 10),
          gateways_count: parseInt(gwCount.rows[0]?.count || '0', 10),
          templates_count: parseInt(tplCount.rows[0]?.count || '0', 10),
          broadcasts_count: parseInt(bcastCount.rows[0]?.count || '0', 10),
          leads_count: parseInt(leadsCount.rows[0]?.count || '0', 10),
          journeys_count: parseInt(journeysCount.rows[0]?.count || '0', 10),
        };
      })
    );

    res.json({ success: true, companies: detailedCompanies });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. View Admin Audit Logs
router.get('/audit-logs', authenticateToken, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    let whereClause = '';
    const params: any[] = [];
    if (req.user?.role !== 'superadmin') {
      params.push(req.user?.company_name || 'Independent Enterprise');
      whereClause = 'WHERE u.company_name = $1';
    }

    const logsRes = await query(
      `SELECT a.*, u.full_name as user_name, u.email as user_email, u.company_name
       FROM admin_audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ success: true, logs: logsRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
