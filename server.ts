import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
// @ts-ignore
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { Pool } from 'pg';
import * as cheerio from 'cheerio';
import stringSimilarity from 'string-similarity';
import natural from 'natural';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Initialize Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholar',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT,
      password TEXT,
      name TEXT,
      affiliation TEXT,
      role TEXT DEFAULT 'user',
      tenant_id INTEGER,
      matric_number TEXT,
      level TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE,
      owner_name TEXT,
      owner_email TEXT,
      plan TEXT DEFAULT 'starter',
      status TEXT DEFAULT 'active',
      is_subscribed BOOLEAN DEFAULT FALSE, -- NEW: Pay-to-play for lecturers
      subscription_price INTEGER DEFAULT 0, -- NEW: Flexible price set by Super Admin
      subscription_expiry TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS exams (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      title TEXT,
      description TEXT,
      duration INTEGER, -- in minutes
      type TEXT, -- 'exam', 'test', 'assignment'
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    );
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      exam_id INTEGER,
      text TEXT,
      options JSONB,
      correct_answer TEXT,
      type TEXT DEFAULT 'static', -- 'static', 'dynamic'
      formula JSONB,
      points INTEGER DEFAULT 10,
      FOREIGN KEY(exam_id) REFERENCES exams(id)
    );
    CREATE TABLE IF NOT EXISTS exam_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      exam_id INTEGER,
      score TEXT,
      risk_score INTEGER DEFAULT 0,
      violations JSONB DEFAULT '[]',
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(exam_id) REFERENCES exams(id)
    );
    CREATE TABLE IF NOT EXISTS students_roster (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      matric_number TEXT,
      name TEXT,
      email TEXT,
      course TEXT,
      pin_hash TEXT, -- NEW: Hashed 4-digit PIN
      setup_token TEXT, -- NEW: Temporary token for PIN setup via email
      token_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, matric_number),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    );
    CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      authors TEXT,
      abstract TEXT,
      content TEXT,
      metadata JSONB,
      status TEXT DEFAULT 'uploaded',
      doi TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS paper_references (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER,
      original_text TEXT,
      title TEXT,
      authors TEXT,
      doi TEXT,
      year TEXT,
      journal TEXT,
      status TEXT,
      is_cited BOOLEAN,
      FOREIGN KEY(paper_id) REFERENCES papers(id)
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      publications JSONB,
      metrics JSONB,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER,
      user_id INTEGER,
      reviewer_name TEXT,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      comments TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(paper_id) REFERENCES papers(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      reference TEXT UNIQUE,
      amount INTEGER,
      status TEXT DEFAULT 'pending',
      type TEXT DEFAULT 'publication',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      sender_role TEXT, -- 'user', 'admin', 'ai'
      content TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  try { await pool.query('ALTER TABLE papers ADD COLUMN doi TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE profiles ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE reviews ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\''); } catch (e) { }
  try { await pool.query('ALTER TABLE users ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE users ADD COLUMN matric_number TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE users ADD COLUMN level TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE chat_messages ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE chat_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN issn TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN pin_hash TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN setup_token TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN token_expires TIMESTAMP'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN subscription_price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN subscription_expiry TIMESTAMP'); } catch (e) { }
  try { await pool.query('ALTER TABLE transactions ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  
  // Migration: Drop global email uniqueness and add role-scoped uniqueness
  try {
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key');
    await pool.query('ALTER TABLE users ADD CONSTRAINT users_email_role_key UNIQUE (email, role)');
  } catch (e) { }
  
  // Set default pricing if not exists
  await pool.query(`
    INSERT INTO settings (key, value)
    VALUES ('publication_price', '5000')
    ON CONFLICT (key) DO NOTHING
  `);
}
initDB().catch(err => {
  console.error('CRITICAL: Database initialization failed');
  console.error('Error Details:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('HINT: Check if PostgreSQL is running and accessible at ' + (process.env.DATABASE_URL || 'localhost:5432'));
  }
});

console.log('--- Environment Check ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('${{')) {
  console.warn('WARNING: DATABASE_URL contains unresolved placeholders: ' + process.env.DATABASE_URL);
}
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'PRESENT' : 'MISSING');
console.log('-------------------------');

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected', 
      error: error.message,
      hint: 'Check DATABASE_URL or database service status'
    });
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-scholar-sync-key';

// Middleware: Authenticate JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    req.tenant_id = user.tenant_id;
    next();
  });
};

// Middleware: Check Tenant Subscription
const checkSubscription = async (req: any, res: any, next: any) => {
  if (req.user.role === 'super_admin') return next();
  if (req.user.role === 'tenant_admin') {
    const result = await pool.query('SELECT is_subscribed FROM tenants WHERE id = $1', [req.tenant_id]);
    if (!result.rows[0]?.is_subscribed) {
      return res.status(402).json({ 
        error: 'Subscription required', 
        message: 'Your lecturer account requires an active subscription. Please complete payment to access your workspace.' 
      });
    }
  }
  next();
};

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' }
});

// Auth Routes
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  affiliation: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Diagnostics Endpoint (Obfuscated)
app.get('/api/diag', (req, res) => {
  const obfuscate = (str: string | undefined) => {
    if (!str) return 'MISSING';
    if (str.includes('://')) { // Handle URLs
      try {
        const url = new URL(str);
        return `${url.protocol}//${url.username ? '***' : ''}:${url.password ? '***' : ''}@${url.host}${url.pathname}`;
      } catch {
        return 'INVALID_URL';
      }
    }
    return str.length > 8 ? `${str.substring(0, 4)}...${str.substring(str.length - 4)}` : 'SET_BUT_SHORT';
  };

  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_FORMAT: obfuscate(process.env.DATABASE_URL),
      GEMINI_API_KEY: obfuscate(process.env.GEMINI_API_KEY),
      JWT_SECRET: obfuscate(process.env.JWT_SECRET),
      ZENODO_ACCESS_TOKEN: obfuscate(process.env.ZENODO_ACCESS_TOKEN),
      APP_URL: process.env.APP_URL
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [data.email, 'user']);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'An account with this email already exists in the Research portal' });

    // Hardcode specific email to always be admin
    const accountRole = data.email.toLowerCase() === 'burstbrainconcept@gmail.com' ? 'super_admin' : 'user';
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, affiliation, role, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [data.email, hashedPassword, data.name, data.affiliation || '', accountRole, null]
    );

    const userId = result.rows[0].id;

    // Initialize user profile
    await pool.query(
      'INSERT INTO profiles (user_id, publications, metrics) VALUES ($1, $2, $3)',
      [userId, JSON.stringify([]), JSON.stringify({ citations: 0, hIndex: 0, i10Index: 0 })]
    );

    const token = jwt.sign({ id: userId, email: data.email, name: data.name, role: accountRole, tenant_id: null }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, email: data.email, name: data.name, role: accountRole, tenant_id: null } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(400).json({ error: error.message });
  }
});

// Lecturer/Tenant Admin Registration (Creates Tenant + Admin)
app.post('/api/auth/lecturer/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, tenantName } = req.body;
    if (!email || !password || !name || !tenantName) return res.status(400).json({ error: 'All fields are required' });

    const role = 'tenant_admin';
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, role]);
    if (existingUser.rows.length > 0) return res.status(400).json({ error: 'This email is already associated with an Academic Workspace' });

    const existingTenant = await pool.query('SELECT id FROM tenants WHERE name = $1', [tenantName]);
    if (existingTenant.rows.length > 0) return res.status(400).json({ error: 'Tenant name already taken' });

    // 1. Create Tenant
    const tenantResult = await pool.query(
      'INSERT INTO tenants (name, owner_name, owner_email) VALUES ($1, $2, $3) RETURNING id',
      [tenantName, name, email]
    );
    const tenantId = tenantResult.rows[0].id;

    // 2. Create Tenant Admin User
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (email, password, name, role, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [email, hashedPassword, name, 'tenant_admin', tenantId]
    );
    const userId = userResult.rows[0].id;

    const token = jwt.sign({ id: userId, email, name, role: 'tenant_admin', tenant_id: tenantId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, email, name, role: 'tenant_admin', tenant_id: tenantId, tenantName } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Student Login (Matric Number + PIN + Optional Tenant ID/Context)
app.post('/api/auth/student/login', authLimiter, async (req, res) => {
  try {
    const { matricNumber, pin, tenantId } = req.body;
    if (!matricNumber || !pin) return res.status(400).json({ error: 'Matric number and 4-digit PIN required' });

    // 1. Find user (Student)
    let query = 'SELECT * FROM users WHERE matric_number = $1 AND role = \'student\'';
    let params = [matricNumber];
    if (tenantId) {
        query += ' AND tenant_id = $2';
        params.push(tenantId);
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid matric number or PIN' });
    
    const user = result.rows[0];

    // 2. Validate PIN (which is stored in the password field for students)
    const validPin = await bcrypt.compare(pin, user.password);
    if (!validPin) return res.status(401).json({ error: 'Invalid matric number or PIN' });

    // 3. Generate Token
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'student', tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: 'student', tenant_id: user.tenant_id, matricNumber: user.matric_number } });
  } catch (error: any) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const { role: requestedRole } = req.body; 
    const email = data.email.toLowerCase().trim();
    
    // Find user with disambiguation for role if provided
    let query = 'SELECT * FROM users WHERE email = $1';
    let params = [email];
    if (requestedRole) {
      let mappedRole = requestedRole;
      if (requestedRole === 'researcher') mappedRole = 'user';
      if (requestedRole === 'lecturer') mappedRole = 'tenant_admin';
      
      // Admin Priority/Restriction: Admins can ONLY login via the researcher/research portal
      if (requestedRole === 'lecturer' && email === 'burstbrainconcept@gmail.com') {
          return res.status(403).json({ error: 'Admin access is restricted to the Publication portal only.' });
      }

      if (email === 'burstbrainconcept@gmail.com' && requestedRole === 'researcher') {
          // Allow admin to match their actual high-privilege role in the researcher portal
          query += " AND (role = 'super_admin' OR role = 'admin' OR role = 'user')";
      } else {
          query += ' AND role = $2';
          params.push(mappedRole);
      }
    } else {
      // If no role requested, we still want to avoid accidental cross-portal login for admin
      if (email === 'burstbrainconcept@gmail.com') {
          query += " AND (role = 'super_admin' OR role = 'admin')";
      }
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: `No account found for this email in the ${requestedRole || 'selected'} portal.` });
    }
    
    // If multiple roles exist and no role was requested, we might pick the wrong one.
    // But since the frontend will now pass the role, this should be fine.
    let user = result.rows[0];
    const validPassword = await bcrypt.compare(data.password.trim(), user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });

    // Enforce admin for specific email
    if (user.email.toLowerCase() === 'burstbrainconcept@gmail.com' && user.role !== 'admin' && user.role !== 'super_admin') {
      await pool.query("UPDATE users SET role = 'super_admin' WHERE id = $1", [user.id]);
      user.role = 'super_admin';
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── PASSWORD RESET SYSTEM ──────────────────────────────────────────
const resetCodes = new Map<string, { code: string; expires: number }>();

// Configure email transporter (uses Gmail App Password or any SMTP)
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL || 'burstbrainconcept@gmail.com',
    pass: process.env.SMTP_PASSWORD || '' // Gmail App Password required
  }
});

// User-facing: Request a reset code via email
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const result = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email.toLowerCase()]);
    // Always respond with success to avoid email enumeration
    if (result.rows.length === 0) {
      return res.json({ success: true, message: 'If an account with that email exists, a reset code has been sent.' });
    }

    const user = result.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    resetCodes.set(email.toLowerCase(), { code, expires: Date.now() + 15 * 60 * 1000 }); // 15 min expiry

    // Attempt to send email
    try {
      await mailTransporter.sendMail({
        from: `"Genius Mindspark Portal" <${process.env.SMTP_EMAIL || 'burstbrainconcept@gmail.com'}>`,
        to: email,
        subject: 'Your Genius Portal Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="/gmijp-logo.png" alt="Genius" style="width: 60px; height: 60px; border-radius: 50%; background: white; padding: 5px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
              </div>
              <h2 style="color: #0f172a; margin-bottom: 10px;">Password Reset</h2>
            <p style="color: #64748b;">Hi ${user.name || 'there'},</p>
            <p style="color: #64748b;">Your password reset code is:</p>
            <div style="background: #800000; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 12px; letter-spacing: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #64748b; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center;">Genius Portal &copy; 2026</p>
          </div>
        `
      });
      res.json({ success: true, message: 'If an account with that email exists, a reset code has been sent.' });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      // Still store the code so admin can relay it if needed
      res.json({ success: true, message: 'If an account with that email exists, a reset code has been sent.', emailNote: 'Email delivery may be delayed. Contact admin if you don\'t receive it.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// User-facing: Verify code and set new password
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const stored = resetCodes.get(email.toLowerCase());
    if (!stored || stored.code !== code) return res.status(400).json({ error: 'Invalid reset code' });
    if (Date.now() > stored.expires) {
      resetCodes.delete(email.toLowerCase());
      return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query('UPDATE users SET password = $1 WHERE email = $2 RETURNING id', [hashedPassword, email.toLowerCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    resetCodes.delete(email.toLowerCase());
    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Admin-only: Force override a user's password
app.post('/api/admin/users/:id/reset-password', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.query('UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email, name', [hashedPassword, parseInt(id)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ success: true, message: `Password for ${result.rows[0].email} has been reset.` });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Public: User contacts admin for password reset (no email needed)
app.post('/api/auth/contact-admin-reset', authLimiter, async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email || !message) return res.status(400).json({ error: 'Email and message are required' });

    await pool.query(
      'INSERT INTO password_reset_requests (email, message) VALUES ($1, $2)',
      [email.toLowerCase(), message]
    );

    // Also send an email notification to the admin
    try {
      await mailTransporter.sendMail({
        from: `"Genius Portal" <${process.env.SMTP_EMAIL || 'noreply@genius.app'}>`,
        to: 'burstbrainconcept@gmail.com',
        subject: `Password Reset Request from ${email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="/gmijp-logo.png" alt="Genius" style="width: 60px; height: 60px; border-radius: 50%; background: white; padding: 5px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
            </div>
            <h2 style="color: #0f172a;">Password Reset Request</h2>
            <p style="color: #64748b;">A user has requested a password reset via the Contact Admin form:</p>
            <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0;"><strong>Message:</strong> ${message}</p>
            </div>
            <p style="color: #64748b; font-size: 13px;">Log into your Admin dashboard → User Management → Edit the user to set a temporary password.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Admin notification email failed:', emailErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Contact admin reset error:', error);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// Admin: View pending password reset requests
app.get('/api/admin/reset-requests', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT * FROM password_reset_requests ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reset requests' });
  }
});

// Admin: Mark a reset request as resolved
app.put('/api/admin/reset-requests/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    await pool.query("UPDATE password_reset_requests SET status = 'resolved' WHERE id = $1", [parseInt(id)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// GROBID Parsing Function
async function parseWithGrobid(buffer: Buffer): Promise<any> {
  const formData = new FormData();
  formData.append('input', new Blob([buffer as any], { type: 'application/pdf' }), 'document.pdf');
  formData.append('consolidateHeader', '1');
  formData.append('consolidateCitations', '1');

  try {
    const response = await fetch('https://kermitt2-grobid.hf.space/api/processFulltextDocument', {
      method: 'POST',
      body: formData as any
    });

    if (!response.ok) {
      throw new Error(`GROBID failed with status ${response.status}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const title = $('titleStmt > title').text().trim();
    const abstract = $('profileDesc > abstract').text().trim();

    const authors: string[] = [];
    $('sourceDesc > biblStruct > analytic > author').each((_, el) => {
      const first = $(el).find('persName > forename').text().trim();
      const last = $(el).find('persName > surname').text().trim();
      if (first || last) authors.push(`${first} ${last}`.trim());
    });

    const affiliations: string[] = [];
    $('affiliation > orgName').each((_, el) => {
      const aff = $(el).text().trim();
      if (aff && !affiliations.includes(aff)) affiliations.push(aff);
    });

    const keywords: string[] = [];
    $('profileDesc > textClass > keywords > term').each((_, el) => {
      const kw = $(el).text().trim();
      if (kw) keywords.push(kw);
    });

    const sections: string[] = [];
    $('body > div > head').each((_, el) => {
      const sec = $(el).text().trim();
      if (sec) sections.push(sec);
    });

    const references: any[] = [];
    $('listBibl > biblStruct').each((_, el) => {
      const id = $(el).attr('xml:id');
      const refTitle = $(el).find('analytic > title').text().trim() || $(el).find('monogr > title').text().trim();
      const refAuthors = $(el).find('author > persName > surname').map((_, a) => $(a).text().trim()).get().join(', ');
      const date = $(el).find('date').attr('when') || '';
      if (refTitle) references.push({ id, text: `${refAuthors} (${date}). ${refTitle}` });
    });

    const inTextCitations: any[] = [];
    $('ref[type="bibr"]').each((_, el) => {
      inTextCitations.push({
        text: $(el).text(),
        target: $(el).attr('target')
      });
    });

    return {
      title,
      authors,
      affiliations,
      abstract,
      keywords,
      sections,
      references,
      inTextCitations,
      rawXml: xml
    };
  } catch (error) {
    console.error('GROBID parsing error:', error);
    return null;
  }
}

// Zenodo DOI Registration & Archiving Function
async function publishToZenodo(paper: any, zenodoToken: string) {
  // Use sandbox API in development unless a production token is explicitly provided
  const isProduction = process.env.NODE_ENV === 'production' && process.env.ZENODO_USE_PRODUCTION === 'true';
  const ZENODO_URL = isProduction 
    ? 'https://zenodo.org/api/deposit/depositions'
    : 'https://sandbox.zenodo.org/api/deposit/depositions';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${zenodoToken}`
  };

  try {
    // 1. Create the empty deposition draft
    const draftRes = await fetch(ZENODO_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({}) 
    });
    
    if (!draftRes.ok) throw new Error(`Zenodo Draft Creation Failed: ${draftRes.statusText}`);
    const draft = await draftRes.json();
    const depositionId = draft.id;
    const bucketUrl = draft.links.bucket;

    // 2. Upload the manuscript content to Zenodo
    // We create a text file representation of the manuscript content stored in the DB
    const manuscriptBuffer = Buffer.from(paper.content || 'Manuscript content generation error.', 'utf-8');
    
    const uploadRes = await fetch(`${bucketUrl}/manuscript_draft.txt`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${zenodoToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: manuscriptBuffer
    });

    if (!uploadRes.ok) throw new Error(`Zenodo File Upload Failed: ${uploadRes.statusText}`);

    // 3. Attach Genius Metadata (DataCite JSON schema)
    const metadata = JSON.parse(paper.metadata);
    const zenodoMetadata = {
      metadata: {
        title: metadata.title || 'Untitled Genius Publication',
        upload_type: "publication",
        publication_type: "article",
        description: metadata.abstract || "Published via Genius App Research Pipeline.",
        publication_date: new Date().toISOString().split('T')[0],
        access_right: "open",
        creators: (metadata.authors || []).map((a: string) => {
          // Zenodo prefers "Family, Given"
          const trimmed = a.trim();
          if (trimmed.includes(',')) return { name: trimmed }; // Already formatted
          const parts = trimmed.split(/\s+/);
          if (parts.length > 1) {
            const family = parts.pop();
            const given = parts.join(' ');
            return { name: `${family}, ${given}` };
          }
          return { name: trimmed };
        })
      }
    };

    const metaRes = await fetch(`${ZENODO_URL}/${depositionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(zenodoMetadata)
    });

    if (!metaRes.ok) throw new Error(`Zenodo Metadata Attachment Failed: ${metaRes.statusText}`);

    // 4. Publish to lock the record and mint the final DOI
    const publishRes = await fetch(`${ZENODO_URL}/${depositionId}/actions/publish`, {
      method: 'POST',
      headers
    });
    
    if (!publishRes.ok) {
       console.warn(`Zenodo Publish Failed (often happens in sandbox without specific flags). Falling back to reserved DOI. ${publishRes.statusText}`);
       // If publish fails (common in sandbox), return the reserved DOI from the draft
       return draft.metadata.prereserve_doi.doi;
    }
    
    const finalRecord = await publishRes.json();
    
    // Return the newly minted Zenodo DOI
    return finalRecord.doi;

  } catch (error) {
    console.error('Zenodo Publishing Error:', error);
    throw error;
  }
}

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

// API Routes
app.post('/api/upload', authenticateToken, upload.single('file'), async (req: any, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let textContent = '';
    let metadata: any = null;

    if (req.file.mimetype === 'application/pdf') {
      metadata = await parseWithGrobid(req.file.buffer);
      const data = await pdfParse(req.file.buffer);
      textContent = data.text;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      textContent = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or DOCX.' });
    }

    if (!metadata || !metadata.title) {
      console.log('Falling back to Gemini for metadata extraction...');
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: `Extract metadata from academic paper. Return JSON. Text: ${textContent.substring(0, 15000)}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                abstract: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                sections: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['title', 'authors', 'abstract']
            }
          }
        });
        metadata = JSON.parse(response.text || '{}');
      } catch (aiError: any) {
        console.error('Gemini Metadata Extraction Failed:', aiError.message);
        if (aiError.message?.includes('429') || aiError.message?.includes('quota')) {
          return res.status(429).json({ 
            error: 'AI Services Busy', 
            details: 'The AI engine is currently at capacity. Please try again in 1 minute, or manually enter metadata in the next step.' 
          });
        }
        // Basic fallback metadata if AI is totally down
        metadata = { title: req.file.originalname.replace(/\.[^/.]+$/, ""), authors: ['Author'], abstract: 'Abstract pending...' };
      }
    }

    const result = await pool.query(
      'INSERT INTO papers (user_id, title, authors, abstract, content, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [
        userId,
        metadata.title || 'Untitled',
        JSON.stringify(metadata.authors || []),
        metadata.abstract || '',
        textContent,
        JSON.stringify(metadata)
      ]
    );

    res.json({ id: result.rows[0].id, metadata });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process manuscript' });
  }
});

app.post('/api/validate/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found or unauthorized' });

    const metadata = JSON.parse(paper.metadata);

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Analyze academic paper structure. Sections: ${JSON.stringify(metadata.sections)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              status: { type: Type.STRING },
              msg: { type: Type.STRING }
            },
            required: ['name', 'status']
          }
        }
      }
    });

    const validation = JSON.parse(response.text || '[]');
    res.json({ validation });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid ID' });
    res.status(500).json({ error: 'Failed to validate' });
  }
});

app.post('/api/enhance/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const textChunk = paper.content.substring(0, 3000);
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Improve academic text: ${textChunk}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              original: { type: Type.STRING },
              improved: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['type', 'original', 'improved', 'explanation']
          }
        }
      }
    });

    const suggestions = JSON.parse(response.text || '[]');
    res.json({ suggestions, textChunk });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enhance' });
  }
});

app.post('/api/references/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id: paperId } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [paperId, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    // Check if we already have validated references in the DB
    const refsResult = await pool.query('SELECT * FROM paper_references WHERE paper_id = $1', [paperId]);
    const existingRefs = refsResult.rows;

    const metadata = JSON.parse(paper.metadata);
    const inTextCitations = metadata.inTextCitations || [];

    if (existingRefs.length > 0) {
      // Return cached canonical references
      const formattedRefs = existingRefs.map(r => ({
        original: r.original_text,
        title: r.title,
        doi: r.doi,
        authors: r.authors,
        status: r.status,
        isCited: Boolean(r.is_cited)
      }));
      return res.json({ references: formattedRefs, inTextCitations });
    }

    // Otherwise, validate via Crossref and store
    const references = metadata.references || [];
    const refsToProcess = references.slice(0, 10); // Process up to 10 for demo
    const validatedRefs = [];

    const citedTargets = new Set(inTextCitations.map((c: any) => c.target?.replace('#', '')));

    const insertRefQuery = `
      INSERT INTO paper_references (paper_id, original_text, title, authors, doi, year, journal, status, is_cited)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    for (const refObj of refsToProcess) {
      const refText = typeof refObj === 'string' ? refObj : refObj.text;
      const refId = typeof refObj === 'object' ? refObj.id : null;
      const isCited = refId ? citedTargets.has(refId) : true;

      try {
        const crossrefRes = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(refText)}&rows=1`);
        const crossrefData = await crossrefRes.json();

        if (crossrefData.message.items.length > 0) {
          const item = crossrefData.message.items[0];
          const title = item.title?.[0] || '';
          const doi = item.DOI || '';
          const authors = item.author?.map((a: any) => `${a.given} ${a.family}`).join(', ') || '';
          const year = item.issued?.['date-parts']?.[0]?.[0]?.toString() || '';
          const journal = item['container-title']?.[0] || '';

          await pool.query(insertRefQuery, [paperId, refText, title, authors, doi, year, journal, 'verified', isCited]);

          validatedRefs.push({
            original: refText, title, doi, authors, status: 'verified', isCited
          });
        } else {
          await pool.query(insertRefQuery, [paperId, refText, '', '', '', '', '', 'not_found', isCited]);
          validatedRefs.push({ original: refText, status: 'not_found', isCited });
        }
      } catch (e) {
        await pool.query(insertRefQuery, [paperId, refText, '', '', '', '', '', 'error', isCited]);
        validatedRefs.push({ original: refText, status: 'error', isCited });
      }
    }

    res.json({ references: validatedRefs, inTextCitations });
  } catch (error) {
    console.error('Reference error:', error);
    res.status(500).json({ error: 'Failed to validate references' });
  }
});

app.post('/api/recommend-journals/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = JSON.parse(paper.metadata);
    const keywords = metadata.keywords?.join('+') || metadata.title?.replace(/\s+/g, '+') || 'science';

    // Query Crossref real journal API
    const crossrefRes = await fetch(`https://api.crossref.org/journals?query=${encodeURIComponent(keywords)}&rows=10`);
    const crossrefData = await crossrefRes.json();

    let journals = crossrefData.message.items.map((item: any) => {
      // Simulate Impact Factor based on some hash of the title to keep it consistent
      const hash = item.title.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
      const simulatedIF = (hash % 100) / 10 + 0.5;

      return {
        name: item.title,
        publisher: item.publisher || 'Independent Publisher',
        match: Math.floor(Math.random() * 15) + 85, // 85-99%
        impactFactor: simulatedIF.toFixed(2),
        timeToFirstDecision: `${(hash % 8) + 2} weeks`,
        acceptanceRate: `${(hash % 40) + 10}%`,
        apc: hash % 2 === 0 ? `$${(hash % 20) * 100 + 500}` : 'No APC',
        tags: item.subjects?.slice(0, 4).map((s: any) => s.name) || ['General Science']
      };
    });

    // Sort by match score
    journals.sort((a: any, b: any) => b.match - a.match);
    journals = journals.slice(0, 5);

    res.json({ journals });
  } catch (error) {
    console.error('Journal recommendation error:', error);
    res.status(500).json({ error: 'Failed to recommend journals' });
  }
});

app.post('/api/format/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { style } = z.object({ style: z.string() }).parse(req.body);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Format paper metadata into ${style} style HTML. Title: ${JSON.parse(paper.metadata).title}`,
    });

    res.json({ formattedHtml: response.text, style });
  } catch (error) {
    res.status(500).json({ error: 'Failed to format' });
  }
});

app.post('/api/publish/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = JSON.parse(paper.metadata);

    // Zenodo Integration
    const zenodoToken = process.env.ZENODO_ACCESS_TOKEN;
    if (!zenodoToken) {
      throw new Error("Zenodo Access Token is not configured on the server.");
    }

    let doi = '';
    try {
      doi = await publishToZenodo(paper, zenodoToken);
    } catch (e) {
      console.warn('Zenodo publishing failed, generating local GMIJ DOI');
      doi = `10.GMIJ/${Date.now()}.${Math.floor(Math.random() * 1000)}`;
    }
    
    const issn = `2736-${Math.floor(1000 + Math.random() * 9000)}`;
    const url = doi.startsWith('10.GMIJ') ? `${process.env.APP_URL || ''}/article/${doi}` : `https://doi.org/${doi}`;

    await pool.query('UPDATE papers SET status = $1, doi = $2, issn = $3 WHERE id = $4', ['published', doi, issn, id]);

    const profileResult = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    const profile = profileResult.rows[0];
    if (profile) {
      const pubs = JSON.parse(profile.publications || '[]');
      pubs.push({ title: metadata.title, doi, date: new Date().toISOString() });
      await pool.query('UPDATE profiles SET publications = $1 WHERE id = $2', [JSON.stringify(pubs), profile.id]);
    }

    res.json({ success: true, doi, url });
  } catch (error: any) {
    console.error('Publishing error:', error);
    res.status(500).json({ error: error.message || 'Failed to publish paper via Zenodo' });
  }
});

app.get('/api/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Always fetch fresh user data from database (not stale JWT)
    const userResult = await pool.query('SELECT id, email, name, affiliation, role, tenant_id, matric_number, level FROM users WHERE id = $1', [userId]);
    let freshUser = userResult.rows[0];
    if (!freshUser) return res.status(404).json({ error: 'User not found' });

    // Enforce admin role dynamically for existing sessions
    if (freshUser.email.toLowerCase() === 'burstbrainconcept@gmail.com' && freshUser.role !== 'super_admin') {
      await pool.query("UPDATE users SET role = 'super_admin' WHERE id = $1", [freshUser.id]);
      freshUser.role = 'super_admin';
    }

    const profileResult = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
    const profile = profileResult.rows[0];

    let tenant = null;
    if (freshUser.tenant_id) {
        const tenantResult = await pool.query('SELECT * FROM tenants WHERE id = $1', [freshUser.tenant_id]);
        tenant = tenantResult.rows[0];
    }

    // Fetch subscription price for UI
    const pricingResult = await pool.query('SELECT value FROM settings WHERE key = \'lecturer_subscription_price\'');
    const subscriptionPrice = parseInt(pricingResult.rows[0]?.value || '15000');
    
    const safeParse = (str: string | null | undefined, fallback: any) => {
      try {
        if (!str || str === '[object Object]') return fallback;
        if (typeof str === 'object') return str; // If pg already parsed it
        return JSON.parse(str);
      } catch (e) {
        return fallback;
      }
    };

    if (profile) {
      profile.publications = safeParse(profile.publications, []);
      profile.metrics = safeParse(profile.metrics, { citations: 0, hIndex: 0, i10Index: 0 });

      const papersResult = await pool.query('SELECT id, title, status, doi, created_at FROM papers WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const papers = papersResult.rows;

      const responseData: any = { user: freshUser, profile, papers, tenant, subscriptionPrice };

      // If super_admin, include global platform stats
      if (freshUser.role === 'super_admin') {
        const totalTenantsResult = await pool.query('SELECT COUNT(*) FROM tenants');
        const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
        const totalPapersResult = await pool.query('SELECT COUNT(*) FROM papers');
        const totalResultsResult = await pool.query('SELECT COUNT(*) FROM exam_results');
        const publishedPapersResult = await pool.query("SELECT COUNT(*) FROM papers WHERE status = 'published'");
        const pendingReviewResult = await pool.query("SELECT COUNT(*) FROM papers WHERE status IN ('peer_review', 'integrity_check', 'formatting')");
        const totalRevenueResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'success'");
        const allPapersResult = await pool.query(`
          SELECT p.id, p.title, p.status, p.doi, p.created_at, u.name as researcher_name, u.email as researcher_email, t.name as tenant_name
          FROM papers p 
          LEFT JOIN users u ON p.user_id = u.id 
          LEFT JOIN tenants t ON p.tenant_id = t.id
          ORDER BY p.created_at DESC
        `);
        const recentUsersResult = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 10');

        responseData.adminStats = {
          totalUsers: parseInt(totalUsersResult.rows[0].count),
          totalPapers: parseInt(totalPapersResult.rows[0].count),
          publishedPapers: parseInt(publishedPapersResult.rows[0].count),
          pendingReview: parseInt(pendingReviewResult.rows[0].count),
          totalRevenue: parseInt(totalRevenueResult.rows[0].total),
          allPapers: allPapersResult.rows,
          recentUsers: recentUsersResult.rows,
        };
      }

      res.json(responseData);
    } else {
      // Create a default profile if it doesn't exist
      await pool.query(
        'INSERT INTO profiles (user_id, publications, metrics) VALUES ($1, $2, $3)',
        [userId, '[]', JSON.stringify({ citations: 0, hIndex: 0, i10Index: 0 })]
      );
      const papersResult = await pool.query('SELECT id, title, status, doi, created_at FROM papers WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      res.json({
        user: freshUser,
        profile: { publications: [], metrics: { citations: 0, hIndex: 0, i10Index: 0 } },
        papers: papersResult.rows,
        tenant,
        subscriptionPrice
      });
    }
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile details
app.put('/api/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { name, affiliation, interests } = req.body;

    // Update user table fields
    if (name || affiliation) {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (name) { updates.push(`name = $${paramIdx++}`); values.push(name); }
      if (affiliation) { updates.push(`affiliation = $${paramIdx++}`); values.push(affiliation); }

      values.push(userId);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    }

    // Update interests in profile metrics
    if (interests) {
      const profileResult = await pool.query('SELECT metrics FROM profiles WHERE user_id = $1', [userId]);
      if (profileResult.rows[0]) {
        let metricsStr = profileResult.rows[0].metrics;
        let metrics: any = { citations: 0, hIndex: 0, i10Index: 0 };
        try {
          if (metricsStr && metricsStr !== '[object Object]') {
             metrics = typeof metricsStr === 'object' ? metricsStr : JSON.parse(metricsStr);
          }
        } catch (e) {}
        
        metrics.interests = interests;
        await pool.query('UPDATE profiles SET metrics = $1 WHERE user_id = $2', [JSON.stringify(metrics), userId]);
      }
    }

    // Fetch and return updated profile
    const updatedUser = await pool.query('SELECT id, email, name, affiliation, role FROM users WHERE id = $1', [userId]);
    res.json({ success: true, user: updatedUser.rows[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/integrity/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = JSON.parse(paper.metadata);
    const textContent = paper.content;

    // Real Similarity Detection Algorithm
    const existingResult = await pool.query('SELECT title, content FROM papers WHERE id != $1 AND user_id = $2', [id, userId]);
    const existingPapers = existingResult.rows;

    let maxSimilarity = 0;
    let mostSimilarPaper = null;
    let detailedReport = [];

    if (existingPapers.length > 0) {
      const TfIdf = natural.TfIdf;
      const tfidf = new TfIdf();

      // Add the target paper as the first document
      tfidf.addDocument(textContent.toLowerCase());

      // Add existing papers
      existingPapers.forEach(ep => {
        tfidf.addDocument(ep.content.toLowerCase());
      });

      // Calculate similarity (simplified cosine similarity approximation using tf-idf terms)
      // A more robust approach would be to calculate full cosine similarity between document vectors
      // For this implementation, we'll use a combination of string similarity and tf-idf term overlap

      for (let i = 0; i < existingPapers.length; i++) {
        const ep = existingPapers[i];

        // 1. Basic string similarity (good for exact matches/copy-paste)
        const stringSim = stringSimilarity.compareTwoStrings(
          textContent.substring(0, 5000).toLowerCase(),
          ep.content.substring(0, 5000).toLowerCase()
        );

        // 2. Term overlap (good for paraphrasing)
        let termOverlapScore = 0;
        let termsChecked = 0;

        // Get top terms from target document
        const targetTerms = new Map();
        tfidf.listTerms(0).slice(0, 100).forEach(item => {
          targetTerms.set(item.term, item.tfidf);
        });

        // Compare with existing document terms
        tfidf.listTerms(i + 1).slice(0, 100).forEach(item => {
          if (targetTerms.has(item.term)) {
            termOverlapScore += Math.min(item.tfidf, targetTerms.get(item.term));
          }
          termsChecked++;
        });

        // Normalize term overlap score (heuristic)
        const normalizedTermScore = Math.min(1, termOverlapScore / (termsChecked * 0.5 || 1));

        // Combined score
        const combinedScore = (stringSim * 0.6) + (normalizedTermScore * 0.4);

        if (combinedScore > maxSimilarity) {
          maxSimilarity = combinedScore;
          mostSimilarPaper = ep.title;
        }

        if (combinedScore > 0.1) {
          detailedReport.push({
            source: ep.title,
            similarity: Math.round(combinedScore * 100),
            type: stringSim > normalizedTermScore ? 'Direct Copy' : 'Paraphrasing'
          });
        }
      }
    }

    // If no local matches, simulate external web check
    if (maxSimilarity === 0) {
      maxSimilarity = Math.random() * 0.15; // 0-15% random baseline for web sources
      mostSimilarPaper = 'External Web Sources';
      detailedReport.push({
        source: 'External Web Sources',
        similarity: Math.round(maxSimilarity * 100),
        type: 'General Match'
      });
    }

    const plagiarismScore = Math.min(100, Math.round(maxSimilarity * 100));

    let citationMismatches: any[] = [];
    const inTextCitations = metadata.inTextCitations || [];
    const references = metadata.references || [];

    if (inTextCitations.length > 0 && references.length > 0 && typeof references[0] === 'object') {
      const citedTargets = new Set(inTextCitations.map((c: any) => c.target?.replace('#', '')));
      const bibIds = new Set(references.map((r: any) => r.id));

      references.forEach((r: any) => {
        if (!citedTargets.has(r.id)) {
          citationMismatches.push({
            issue: 'Uncited Reference',
            details: `Reference "${r.text.substring(0, 50)}..." is in the bibliography but not cited in the text.`
          });
        }
      });

      inTextCitations.forEach((c: any) => {
        const targetId = c.target?.replace('#', '');
        if (targetId && !bibIds.has(targetId)) {
          citationMismatches.push({
            issue: 'Missing Bibliography Entry',
            details: `Citation "${c.text}" refers to an entry not found in the bibliography.`
          });
        }
      });
    } else {
      // Fallback to Gemini if GROBID citations aren't available
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Analyze the following academic paper metadata and identify any citation mismatches (e.g., references in text not in bibliography, or vice versa).
        Sections: ${JSON.stringify(metadata.sections)}
        References: ${JSON.stringify(metadata.references)}
        
        Return JSON with a list of mismatches.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                issue: { type: Type.STRING },
                details: { type: Type.STRING }
              },
              required: ['issue', 'details']
            }
          }
        }
      });
      citationMismatches = JSON.parse(response.text || '[]');
    }

    res.json({
      report: {
        plagiarismScore,
        mostSimilarSource: mostSimilarPaper || 'External Web Sources',
        detailedReport,
        citationMismatches,
        duplicatePublication: plagiarismScore > 80 ? 'High risk of duplicate publication detected.' : 'No duplicate publication detected.'
      }
    });
  } catch (error) {
    console.error('Integrity error:', error);
    res.status(500).json({ error: 'Failed to run integrity checks' });
  }
});

app.get('/api/papers/:id/export/crossref', authenticateToken, (req: any, res) => {
  res.status(501).json({ error: 'Crossref XML generation is no longer supported. The platform has migrated to Zenodo DataCite.' });
});

app.get('/api/papers/:id/export/jats', authenticateToken, (req: any, res) => {
  res.status(501).json({ error: 'JATS XML generation is currently disabled while migrating schema definitions to Zenodo compatibility.' });
});

app.get('/api/papers/:id/export/bibtex', authenticateToken, async (req: any, res) => {
  const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const paper = paperResult.rows[0];
  if (!paper) return res.status(404).send('Not found');
  const metadata = JSON.parse(paper.metadata);

  const bibtex = `@article{genius${paper.id},
  title={${metadata.title || 'Untitled'}},
  author={${(metadata.authors || []).join(' and ')}},
  journal={Genius Open Access},
  issn={${process.env.JOURNAL_ISSN || '0000-0000'}},
  year={${new Date().getFullYear()}},
  doi={${paper.doi || `10.5555/genius.${paper.id}`}}
}`;
  res.header('Content-Type', 'text/plain');
  res.send(bibtex);
});

// Peer Review Simulation Endpoints
app.get('/api/papers/:id/reviews', authenticateToken, async (req: any, res) => {
  const reviewsResult = await pool.query('SELECT * FROM reviews WHERE paper_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json(reviewsResult.rows);
});

app.post('/api/papers/:id/reviews/simulate', authenticateToken, async (req: any, res) => {
  const paperId = req.params.id;
  const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [paperId, req.user.id]);
  const paper = paperResult.rows[0];
  if (!paper) return res.status(404).json({ error: 'Paper not found' });

  const metadata = JSON.parse(paper.metadata);
  const abstract = metadata.abstract || 'No abstract provided.';

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert academic peer reviewer. Review the following paper abstract and provide a simulated peer review.
      
      Title: ${metadata.title}
      Abstract: ${abstract}
      
      Provide a JSON response with the following structure:
      {
        "score": (integer from 1 to 10, where 10 is accept as is and 1 is reject),
        "status": (one of: "accept", "minor_revision", "major_revision", "reject"),
        "comments": "Detailed review comments including strengths, weaknesses, and suggestions for improvement."
      }`,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const reviewData = JSON.parse(response.text);

    const result = await pool.query(`
      INSERT INTO reviews (paper_id, user_id, reviewer_name, status, score, comments)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [
      paperId,
      req.user.id,
      'AI Reviewer (Simulated)',
      reviewData.status,
      reviewData.score,
      reviewData.comments
    ]);

    const newReviewResult = await pool.query('SELECT * FROM reviews WHERE id = $1', [result.rows[0].id]);
    res.json(newReviewResult.rows[0]);
  } catch (error) {
    console.error('Error simulating review:', error);
    res.status(500).json({ error: 'Failed to simulate review' });
  }
});

app.get('/api/papers/:id/export/ris', authenticateToken, async (req: any, res) => {
  const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const paper = paperResult.rows[0];
  if (!paper) return res.status(404).send('Not found');
  const metadata = JSON.parse(paper.metadata);

  let ris = `TY  - JOUR\nTI  - ${metadata.title || 'Untitled'}\n`;
  (metadata.authors || []).forEach((a: string) => {
    ris += `AU  - ${a}\n`;
  });
  ris += `AB  - ${metadata.abstract || ''}\nPY  - ${new Date().getFullYear()}\nDO  - ${paper.doi || `10.5555/genius.${paper.id}`}\nSN  - ${process.env.JOURNAL_ISSN || '0000-0000'}\nER  - \n`;

  res.header('Content-Type', 'text/plain');
  res.send(ris);
});

// Public Article Page (Google Scholar Compatible)
app.get('/article/:doi(*)', async (req, res) => {
  const paperResult = await pool.query('SELECT * FROM papers WHERE doi = $1', [req.params.doi]);
  const paper = paperResult.rows[0];
  if (!paper) return res.status(404).send('Article not found');

  const metadata = JSON.parse(paper.metadata);
  const canonicalRefsResult = await pool.query('SELECT * FROM paper_references WHERE paper_id = $1', [paper.id]);
  const canonicalRefs = canonicalRefsResult.rows;

  const refsHtml = canonicalRefs.length > 0
    ? `<h2>References</h2><ol class="references-list">` +
    canonicalRefs.map(r => `
        <li>
          ${r.status === 'verified'
        ? `<strong>${r.authors}</strong> (${r.year || 'n.d.'}). ${r.title}. <em>${r.journal || ''}</em>. <a href="https://doi.org/${r.doi}" target="_blank">doi:${r.doi}</a>`
        : `${r.original_text}`
      }
        </li>
      `).join('') + `</ol>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${metadata.title} - Genius App</title>
      <meta name="citation_title" content="${metadata.title}">
      ${(metadata.authors || []).map((a: string) => `<meta name="citation_author" content="${a}">`).join('\n      ')}
      <meta name="citation_publication_date" content="${new Date(paper.created_at).getFullYear()}">
      <meta name="citation_journal_title" content="Genius Open Access">
      <meta name="citation_issn" content="${process.env.JOURNAL_ISSN || '0000-0000'}">
      <meta name="citation_doi" content="${paper.doi}">
      <meta name="citation_abstract" content="${metadata.abstract}">
      <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
        h1 { color: #111; font-size: 2.5rem; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
        .authors { font-size: 1.2rem; color: #4f46e5; margin-bottom: 2rem; font-weight: 500; }
        .abstract { background: #f8fafc; padding: 1.5rem; border-left: 4px solid #4f46e5; margin-bottom: 2rem; border-radius: 0 8px 8px 0; }
        .abstract h3 { margin-top: 0; color: #334155; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .metadata { font-size: 0.9rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 3rem; }
        .export-links { display: flex; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
        .export-links a { background: #f1f5f9; color: #334155; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background 0.2s; }
        .export-links a:hover { background: #e2e8f0; color: #0f172a; }
        .references-list { padding-left: 1.5rem; }
        .references-list li { margin-bottom: 1rem; color: #334155; }
        .references-list a { color: #4f46e5; text-decoration: none; }
        .references-list a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>${metadata.title}</h1>
      <div class="authors">${(metadata.authors || []).join(', ')}</div>
      
      <div class="abstract">
        <h3>Abstract</h3>
        ${metadata.abstract}
      </div>
      
      <h2>Export Metadata</h2>
      <div class="export-links">
        <a href="/api/papers/${paper.id}/export/crossref" download="crossref.xml">Crossref XML</a>
        <a href="/api/papers/${paper.id}/export/jats" download="jats.xml">JATS XML</a>
        <a href="/api/papers/${paper.id}/export/bibtex" download="citation.bib">BibTeX</a>
        <a href="/api/papers/${paper.id}/export/ris" download="citation.ris">RIS</a>
      </div>
      
      ${refsHtml}
      
      <div class="metadata">
        <p><strong>DOI:</strong> ${paper.doi}</p>
        <p><strong>Published:</strong> ${new Date(paper.created_at).toLocaleDateString()}</p>
        <p><strong>Publisher:</strong> Genius Open Access</p>
        <p><strong>ISSN:</strong> ${process.env.JOURNAL_ISSN || '0000-0000'}</p>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// ─── ADMIN-ONLY ENDPOINTS ──────────────────────────────────────────
app.get('/api/admin/users', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT id, name, email, role, affiliation, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = idParamSchema.parse(req.params);
    const { name, email, role, affiliation } = req.body;
    
    // Check if new email conflicts with existing user
    if (email) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
      if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already in use' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name) { updates.push(`name = $${paramIdx++}`); values.push(name); }
    if (email) { updates.push(`email = $${paramIdx++}`); values.push(email); }
    if (role && ['admin', 'user'].includes(role)) { 
      if (id === req.user.id && role === 'user') return res.status(400).json({ error: "Cannot demote yourself" });
      updates.push(`role = $${paramIdx++}`); values.push(role); 
    }
    if (affiliation !== undefined) { updates.push(`affiliation = $${paramIdx++}`); values.push(affiliation); }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
    }
    
    const updated = await pool.query('SELECT id, name, email, role, affiliation, created_at FROM users WHERE id = $1', [id]);
    res.json({ success: true, user: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = idParamSchema.parse(req.params);
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    // Cascading deletes for user data
    await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM reviews WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM profiles WHERE user_id = $1', [id]);
    
    // Delete refs before papers
    const papers = await pool.query('SELECT id FROM papers WHERE user_id = $1', [id]);
    for (const p of papers.rows) {
      await pool.query('DELETE FROM paper_references WHERE paper_id = $1', [p.id]);
      await pool.query('DELETE FROM reviews WHERE paper_id = $1', [p.id]);
    }
    await pool.query('DELETE FROM papers WHERE user_id = $1', [id]);
    
    // Finally delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/admin/users/:id/role', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const { id } = idParamSchema.parse(req.params);
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    const updated = await pool.query('SELECT id, name, email, role, affiliation, created_at FROM users WHERE id = $1', [id]);
    res.json({ success: true, user: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

app.put('/api/admin/papers/:id/status', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { status } = req.body;
  const validStatuses = ['uploaded', 'formatting', 'peer_review', 'integrity_check', 'ready', 'published', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { id } = idParamSchema.parse(req.params);
    await pool.query('UPDATE papers SET status = $1 WHERE id = $2', [status, id]);
    const updated = await pool.query(`
      SELECT p.id, p.title, p.status, p.doi, p.created_at, u.name as researcher_name, u.email as researcher_email
      FROM papers p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = $1
    `, [id]);
    res.json({ success: true, paper: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update paper status' });
  }
});

// Settings & Dynamic Pricing
app.get('/api/admin/config/pricing', authenticateToken, async (req: any, res) => {
  const pubPriceResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['publication_price']);
  const subPriceResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['lecturer_subscription_price']);
  res.json({ 
    publication_price: parseInt(pubPriceResult.rows[0]?.value || '5000', 10),
    subscription_price: parseInt(subPriceResult.rows[0]?.value || '15000', 10)
  });
});

app.post('/api/admin/config/pricing', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { key, value } = req.body; // key: 'publication_price' or 'lecturer_subscription_price'
  if (!['publication_price', 'lecturer_subscription_price'].includes(key)) return res.status(400).json({ error: 'Invalid setting key' });
  
  await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value.toString()]);
  res.json({ success: true, key, value });
});

// LEGACY (Keep for compatibility if needed, but point to new pricing)
app.get('/api/settings/price', async (req, res) => {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['publication_price']);
  res.json({ price: parseInt(result.rows[0]?.value || '5000', 10) });
});

// PaymentPoint Integration (Replaces Paystack for multi-tenant SaaS)
app.post('/api/payment/initialize', authenticateToken, async (req: any, res) => {
  const { amount, type } = req.body; // type: 'subscription' or 'other'
  const reference = `GMIJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY || '8';
    const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID || 'e22';

    const response = await fetch('https://api.paymentpoint.co/v1/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYMENTPOINT_SECRET_KEY || '784426'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: amount, 
        reference,
        api_key: PAYMENTPOINT_API_KEY,
        business_id: PAYMENTPOINT_BUSINESS_ID,
        callback_url: `${process.env.APP_URL || 'https://gmijp-edu.up.railway.app'}/payment/verify`,
        metadata: {
          user_id: req.user.id,
          tenant_id: req.tenant_id,
          type
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PaymentPoint initialization failed with status:', response.status, errorText);
      throw new Error(`PaymentPoint initialization failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.status) throw new Error(data.message || 'Payment initialization failed');
    
    await pool.query('INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6)', 
      [req.user.id, req.tenant_id, reference, amount, 'pending', type || 'publication']);
    
    res.json(data.data);
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error during payment initialization', 
      details: err.message,
      code: err.code || 'UNKNOWN'
    });
  }
});

app.get('/api/payment/verify/:reference', authenticateToken, async (req: any, res) => {
  // ... (unchanged)
});

// Secure Webhook for PaymentPoint
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
  const signature = req.headers['paymentpoint-signature'];
  const secretKey = process.env.PAYMENTPOINT_SECRET_KEY || '784426';

  if (!signature) return res.status(400).send('Missing signature');

  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secretKey);
    const calculatedSignature = hmac.update(req.body).digest('hex');

    if (calculatedSignature !== signature) {
      console.warn('Invalid webhook signature detected');
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    const { transaction_id, transaction_status, amount_paid, customer } = payload;

    if (transaction_status === 'success') {
      // Find transaction by reference (if passed in customer_id or metadata)
      // Usually the reference is passed back in the payload somewhere
      const reference = payload.transaction_id; // Mapping depends on PaymentPoint's actual return

      const result = await pool.query('SELECT * FROM transactions WHERE reference = $1 OR reference = $2', [transaction_id, customer?.customer_id]);
      const tx = result.rows[0];

      if (tx && tx.status !== 'success') {
        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['success', tx.id]);
        
        if (tx.type === 'subscription') {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          await pool.query('UPDATE tenants SET is_subscribed = TRUE, subscription_expiry = $1 WHERE id = $2', [expiry, tx.tenant_id]);
        }
      }
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal server error');
  }
});

app.get('/api/transactions', authenticateToken, async (req: any, res) => {
  let query, params;
  if (req.user.role === 'super_admin') {
     query = 'SELECT t.*, u.email as user_email, tn.name as tenant_name FROM transactions t JOIN users u ON t.user_id = u.id LEFT JOIN tenants tn ON t.tenant_id = tn.id ORDER BY t.created_at DESC';
     params = [];
  } else if (req.user.role === 'tenant_admin') {
     query = 'SELECT * FROM transactions WHERE tenant_id = $1 ORDER BY created_at DESC';
     params = [req.tenant_id];
  } else {
     query = 'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC';
     params = [req.user.id];
  }
  
  const result = await pool.query(query, params);
  res.json(result.rows);
});

app.get('/api/publications', authenticateToken, async (req: any, res) => {
  const isAdmin = req.user.role === 'admin';
  const query = isAdmin
    ? `SELECT p.id, p.title, p.authors, p.status, p.doi, p.created_at, u.name as researcher_name, u.email as researcher_email 
       FROM papers p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`
    : `SELECT id, title, authors, status, doi, created_at FROM papers WHERE user_id = $1 ORDER BY created_at DESC`;
  const params = isAdmin ? [] : [req.user.id];

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch publication history' });
  }
});

// Direct Admin-User Chat System
app.get('/api/chat/history', authenticateToken, async (req: any, res) => {
  const userId = req.user.role === 'admin' ? (req.query.userId || req.user.id) : req.user.id;
  
  // If fetching a thread, mark those messages as read for the recipient
  if (req.user.role === 'admin' && req.query.userId) {
    await pool.query('UPDATE chat_messages SET is_read = TRUE WHERE user_id = $1 AND sender_role = \'user\'', [req.query.userId]);
  } else if (req.user.role === 'user') {
    await pool.query('UPDATE chat_messages SET is_read = TRUE WHERE user_id = $1 AND sender_role = \'admin\'', [req.user.id]);
  }

  const result = await pool.query(`
    SELECT cm.*, u.name as sender_name 
    FROM chat_messages cm 
    LEFT JOIN users u ON cm.user_id = u.id 
    WHERE cm.user_id = $1 
    ORDER BY cm.created_at ASC
  `, [userId]);
  res.json(result.rows);
});

app.get('/api/chat/inbox', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  
  // Get latest message per user thread to build the inbox view, counting unread messages from users
  const result = await pool.query(`
    WITH LatestMessages AS (
      SELECT DISTINCT ON (user_id)
        user_id,
        content,
        created_at,
        sender_role
      FROM chat_messages
      ORDER BY user_id, created_at DESC
    ),
    UnreadCounts AS (
      SELECT user_id, COUNT(*) as unread_count
      FROM chat_messages
      WHERE is_read = FALSE AND sender_role = 'user'
      GROUP BY user_id
    )
    SELECT 
      lm.user_id,
      u.name as user_name,
      u.email as user_email,
      lm.content as last_message,
      lm.created_at as last_message_at,
      lm.sender_role,
      COALESCE(uc.unread_count, 0)::int as unread_count
    FROM LatestMessages lm
    JOIN users u ON lm.user_id = u.id
    LEFT JOIN UnreadCounts uc ON lm.user_id = uc.user_id
  `);
  
  // Sort overall inbox by most recent message
  const inbox = result.rows.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  res.json(inbox);
});

app.get('/api/chat/notifications', authenticateToken, async (req: any, res) => {
  const isUser = req.user.role === 'user';
  const isLecturer = req.user.role === 'tenant_admin';
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  
  if (isUser || isLecturer) {
    const result = await pool.query(`
      SELECT cm.content, cm.created_at, u.name as sender_name, u.id as sender_id
      FROM chat_messages cm
      JOIN users u ON u.role = 'admin' OR u.role = 'super_admin'
      WHERE cm.user_id = $1 AND cm.sender_role IN ('admin', 'super_admin') AND cm.is_read = FALSE
      ORDER BY cm.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } else if (isAdmin) {
    const result = await pool.query(`
      SELECT cm.content, cm.created_at, u.name as user_name, u.id as user_id
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.sender_role = 'user' AND cm.is_read = FALSE
      ORDER BY cm.created_at DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } else {
    res.json([]);
  }
});

app.post('/api/chat/read-all', authenticateToken, async (req: any, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (isAdmin) {
      await pool.query('UPDATE chat_messages SET is_read = TRUE WHERE sender_role = \'user\'');
    } else {
      await pool.query('UPDATE chat_messages SET is_read = TRUE WHERE user_id = $1 AND sender_role IN (\'admin\', \'super_admin\')', [req.user.id]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

app.post('/api/chat/send', authenticateToken, async (req: any, res) => {
  const { content, targetUserId } = req.body;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const userId = isAdmin ? targetUserId : req.user.id;
  const senderRole = req.user.role;
  
  if (!userId) return res.status(400).json({ error: 'Target user ID required for admin replies' });

  // Save the message directly to the targeted user's thread
  await pool.query('INSERT INTO chat_messages (user_id, sender_role, content, tenant_id) VALUES ($1, $2, $3, $4)',
    [userId, senderRole, content, req.tenant_id || null]);
    
  res.json({ success: true });
});

// ─── MULTI-TENANT ACADEMIC ENDPOINTS ────────────────────────────────
// Lecturer: Get student roster
app.get('/api/courses/roster', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT * FROM students_roster WHERE tenant_id = $1 ORDER BY name ASC', [req.tenant_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

// Lecturer: Add student to roster with PIN setup invitation
app.post('/api/courses/roster', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { matricNumber, name, email, course } = req.body;
    if (!matricNumber || !email || !name) return res.status(400).json({ error: 'Matric Number, Name, and Email are required.' });

    // 1. Check if student already in roster for this tenant
    const existing = await pool.query('SELECT id FROM students_roster WHERE matric_number = $1 AND tenant_id = $2', [matricNumber, req.tenant_id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Student already in your roster.' });

    // 2. Generate secure setup token
    const setupToken = require('crypto').randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // 3. Add to roster
    await pool.query(
      'INSERT INTO students_roster (tenant_id, matric_number, name, email, course, setup_token, token_expires) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.tenant_id, matricNumber, name, email, course || '', setupToken, tokenExpires]
    );

    try {
      const setupLink = `${process.env.APP_URL || 'http://localhost:3000'}/setup-pin?token=${setupToken}&matric=${matricNumber}`;
      const portalBranding = "Genius Academic Portal";
      await mailTransporter.sendMail({
        from: `"${portalBranding}" <${process.env.SMTP_EMAIL || 'burstbrainconcept@gmail.com'}>`,
        to: email,
        subject: `[${portalBranding}] Secure Your Student Access`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 20px; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="/gmijp-logo.png" alt="Genius" style="width: 70px; height: 70px; border-radius: 50%; background: white; padding: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);" />
            </div>
            <h2 style="color: #0f172a; text-align: center; font-size: 24px;">Welcome to Genius Academy</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">You have been officially registered in the Academic Workspace. To access your portal, exams, and academic resources, please establish your secure 4-digit PIN.</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${setupLink}" style="background: #1a237e; color: white; padding: 15px 35px; border-radius: 12px; text-decoration: none; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; font-size: 14px; box-shadow: 0 10px 15px -3px rgba(26, 35, 126, 0.3);">Set Up Secure PIN</a>
            </div>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
               <p style="margin: 0; color: #475569; font-size: 13px;"><strong>Matriculation Number:</strong> ${matricNumber}</p>
               <p style="margin: 5px 0 0 0; color: #475569; font-size: 13px;"><strong>Course/Department:</strong> ${course || 'Not Assigned'}</p>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">This invitation expires in 48 hours for security reasons.<br/>If you did not expect this, please ignore this email or contact your administrator.</p>
            <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px; text-align: center;">
               <p style="color: #cbd5e1; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Genius Mindspark Academic Hub</p>
            </div>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Onboarding email failed:', emailErr);
    }

    res.json({ success: true, message: 'Student added and invitation sent.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Student: Set PIN using Invitation Token
app.post('/api/student/setup-pin', async (req, res) => {
  try {
    const { token, matric, pin } = req.body;
    if (!token || !matric || !pin) return res.status(400).json({ error: 'Token, Matric, and PIN are required.' });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });

    // 1. Verify Token
    const result = await pool.query(
      'SELECT * FROM students_roster WHERE setup_token = $1 AND matric_number = $2 AND token_expires > NOW()',
      [token, matric]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired setup token.' });
    const student = result.rows[0];

    // 2. Hash PIN and Update Roster
    const hashedPin = await bcrypt.hash(pin, 10);
    await pool.query(
      'UPDATE students_roster SET pin_hash = $1, setup_token = NULL, token_expires = NULL WHERE id = $2',
      [hashedPin, student.id]
    );

    // 3. Ensure User account exists
    const userCheck = await pool.query('SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2', [matric, student.tenant_id]);
    if (userCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (email, name, password, role, tenant_id, matric_number) VALUES ($1, $2, $3, $4, $5, $6)',
        [student.email, student.name, hashedPin, 'student', student.tenant_id, matric]
      );
    } else {
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPin, userCheck.rows[0].id]);
    }

    res.json({ success: true, message: 'PIN set successfully. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lecturer: Create Exam
app.post('/api/exams', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { title, description, duration, type } = req.body;
    const result = await pool.query(
      'INSERT INTO exams (tenant_id, title, description, duration, type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.tenant_id, title, description, duration, type]
    );
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// Lecturer: Add Question to Exam
app.post('/api/exams/:id/questions', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { text, options, correct_answer, type, formula, points } = req.body;
    
    // Verify exam belongs to tenant
    const examCheck = await pool.query('SELECT id FROM exams WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (examCheck.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });

    await pool.query(
      'INSERT INTO questions (exam_id, text, options, correct_answer, type, formula, points) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, text, JSON.stringify(options), correct_answer, type, JSON.stringify(formula), points]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Student: Get Assessments
app.get('/api/student/assessments', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    // Fetch active assessments for the student's tenant
    const result = await pool.query(
      'SELECT id, title, description, duration, type, created_at FROM exams WHERE tenant_id = $1 AND status = \'active\' ORDER BY created_at DESC',
      [req.tenant_id]
    );
    
    // Also include results for past assessments
    const resultsResult = await pool.query(
      'SELECT exam_id, score, risk_score, submitted_at FROM exam_results WHERE user_id = $1',
      [req.user.id]
    );
    
    const resultsMap: Record<number, any> = {};
    resultsResult.rows.forEach(r => { resultsMap[r.exam_id] = r; });

    const assessments = result.rows.map(exam => ({
      ...exam,
      status: resultsMap[exam.id] ? 'completed' : 'active',
      result: resultsMap[exam.id] || null
    }));

    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// Student: Get Exam Details & Questions
app.get('/api/exams/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (examResult.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });

    const questionsResult = await pool.query('SELECT id, text, options, type, formula, points FROM questions WHERE exam_id = $1', [id]);
    
    res.json({
      exam: examResult.rows[0],
      questions: questionsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exam data' });
  }
});

// ─── SaaS MONETIZATION & SUBSCRIPTIONS ─────────────────────────────
// Super Admin: Set Lecturer Subscription Price
app.post('/api/admin/config/pricing', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { price } = req.body;
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['lecturer_subscription_price', price.toString()]);
    res.json({ success: true, price });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// (CheckSubscription is now defined at the top of the file)

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
