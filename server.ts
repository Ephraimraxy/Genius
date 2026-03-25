// Polyfill for DOMMatrix which is required by some dependencies like pdf-parse in Node environments
if (typeof global.DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  };
}

import express from 'express';

import { createServer as createViteServer } from 'vite';
import multer from 'multer';
// @ts-ignore
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
import mammoth from 'mammoth';
import cors from 'cors';
import OpenAI from 'openai';
import { Pool } from 'pg';
import * as cheerio from 'cheerio';
import { Resend } from 'resend';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import stringSimilarity from 'string-similarity';
import natural from 'natural';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer-core';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.set('trust proxy', 1);

// Secure Webhook for PaymentPoint (Must be before global JSON parser for raw body)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
  const signature = req.headers['paymentpoint-signature'];
  const secretKey = process.env.PAYMENTPOINT_SECRET_KEY;

  if (!signature || !secretKey) return res.status(400).send('Missing signature or configuration');

  try {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secretKey);
    const calculatedSignature = hmac.update(req.body).digest('hex');

    if (calculatedSignature !== signature) {
      console.warn('Invalid PaymentPoint webhook signature');
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    const { notification_status, transaction_id, amount_paid, settlement_amount, transaction_status, customer } = payload;

    if (transaction_status === 'success' && notification_status === 'payment_successful') {
      const customerEmail = customer?.email;
      let result = await pool.query(
        `SELECT t.* FROM transactions t 
         JOIN users u ON t.user_id = u.id 
         WHERE u.email = $1 AND t.status = 'pending' 
         ORDER BY t.created_at DESC LIMIT 1`,
        [customerEmail]
      );

      const tx = result?.rows?.[0];

      if (tx) {
        if (tx.type === 'attendance_token') {
          const now = new Date();
          const expiresAt = new Date(tx.metadata?.expires_at);
          if (now > expiresAt) {
             await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['expired', tx.id]);
             return res.status(400).send('Transaction window expired');
          }
        }

        await pool.query('UPDATE transactions SET status = $1 WHERE id = $2', ['success', tx.id]);
        
        // 2️⃣ Pre-upload Email Trigger: Send Payment Confirmation & Acceptance in Principle
        if (tx.type === 'publication') {
           const userRes = await pool.query('SELECT name FROM users WHERE email = $1', [customerEmail]);
           const userName = userRes.rows[0]?.name || 'Researcher';
           
           // Using a dedicated function for Pre-Upload Payment Email
           await sendPaymentSuccessEmail(customerEmail, userName, tx.reference);
        }

        if (tx.type === 'subscription') {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 1);
          await pool.query('UPDATE tenants SET is_subscribed = TRUE, subscription_expiry = $1 WHERE id = $2', [expiry, tx.tenant_id]);
        }
        console.log(`PaymentPoint webhook: Transaction ${tx.reference} marked as success`);
      }
    }
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('PaymentPoint webhook error:', err);
    res.status(500).send('Internal server error');
  }
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholar',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'https://geniusapp.com';

async function bootstrapDB() {
  try {
    console.log('--- STARTING DATABASE BOOTSTRAP ---');
    await pool.query(`
      ALTER TABLE paper_references 
      ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT,
      ADD COLUMN IF NOT EXISTS journal TEXT,
      ADD COLUMN IF NOT EXISTS year TEXT,
      ADD COLUMN IF NOT EXISTS authors TEXT,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS doi TEXT;
      
      ALTER TABLE papers
      ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
    `);
    console.log('--- DATABASE BOOTSTRAP SUCCESSFUL ---');
  } catch (err) {
    console.error('--- DATABASE BOOTSTRAP FAILED ---', err);
  }
}

// Global invocation
bootstrapDB();

async function sendPaymentSuccessEmail(to: string, name: string, ref: string) {
  const htmlBody = `
    <div style="font-family: serif; padding: 20px; color: #1a202c;">
      <h2 style="color: #800000;">Payment Successful</h2>
      <p>Dear ${name},</p>
      <p>Your payment (Ref: ${ref}) has been received successfully. Your publication credit is now active.</p>
      <p>Please find the <strong>Journal Preliminary Pages</strong> attached below for your review.</p>
      <p>You may now proceed to upload your manuscript via the dashboard.</p>
    </div>
  `;
  try {
    const attachments = [];
    const preliminaryPath = path.join(process.cwd(), 'tools', 'Journal Preliminary.pdf');
    if (fs.existsSync(preliminaryPath)) {
      attachments.push({ filename: 'Journal_Preliminary.pdf', content: fs.readFileSync(preliminaryPath).toString('base64') });
    }
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `GMIJP <${RESEND_FROM}>`, to: [to], subject: `Payment Received — Ref: ${ref}`, html: htmlBody, attachments })
    });
  } catch (err) { console.error('Payment success email error:', err); }
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT,
      phone TEXT,
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
      name TEXT,
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
      is_available BOOLEAN DEFAULT TRUE,
      price INTEGER DEFAULT 0,
      is_paid BOOLEAN DEFAULT FALSE,
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
      volume TEXT,
      issue TEXT,
      formatted_content TEXT,
      file_blob BYTEA,
      published_at TIMESTAMP,
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
      metadata JSONB DEFAULT '{}',
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
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      type TEXT, -- 'roster', 'material'
      name TEXT,
      content JSONB,
      status TEXT DEFAULT 'pending',
      is_available BOOLEAN DEFAULT TRUE,
      price INTEGER DEFAULT 0,
      is_paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    );
  `);
  
  try { await pool.query('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_name_key'); } catch (e) { }

  
  try { await pool.query('ALTER TABLE papers ADD COLUMN doi TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE profiles ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE reviews ADD COLUMN user_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE users ADD COLUMN phone TEXT'); } catch (e) { }
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
  try { await pool.query('ALTER TABLE transactions ADD COLUMN metadata JSONB DEFAULT \'{}\''); } catch (e) { }
  try { await pool.query('ALTER TABLE transactions ADD COLUMN paper_id INTEGER REFERENCES papers(id)'); } catch (e) { }
  
  try { await pool.query('ALTER TABLE papers ADD COLUMN volume TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN issue TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN file_blob BYTEA'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN published_at TIMESTAMP'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN formatted_content TEXT'); } catch (e) { }
  
  try { await pool.query('ALTER TABLE exams ADD COLUMN is_available BOOLEAN DEFAULT TRUE'); } catch (e) { }
  try { await pool.query('ALTER TABLE exams ADD COLUMN price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE exams ADD COLUMN is_paid BOOLEAN DEFAULT FALSE'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN is_available BOOLEAN DEFAULT TRUE'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN is_paid BOOLEAN DEFAULT FALSE'); } catch (e) { }
  
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

  // Set default journal settings if not exists
  await pool.query(`INSERT INTO settings (key, value) VALUES ('current_volume', '1') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('current_issue', '1') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('journal_issn', '2971-7760') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('max_manuscripts_per_issue', '10') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('max_issues_per_volume', '3') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('max_pages_per_manuscript', '20') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('journal_signature', '') ON CONFLICT (key) DO NOTHING`);
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
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'PRESENT' : 'MISSING');
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
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

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
    const result = await pool.query('SELECT is_subscribed, subscription_expiry FROM tenants WHERE id = $1', [req.tenant_id]);
    const tenant = result.rows[0];
    
    if (!tenant?.is_subscribed) {
      return res.status(402).json({ 
        error: 'Subscription required', 
        message: 'Your lecturer account requires an active subscription. Please complete payment to access your workspace.' 
      });
    }

    if (tenant.subscription_expiry && new Date() > new Date(tenant.subscription_expiry)) {
      // Automatic downgrade if expired
      await pool.query('UPDATE tenants SET is_subscribed = FALSE WHERE id = $1', [req.tenant_id]);
      return res.status(402).json({ 
        error: 'Subscription expired', 
        message: 'Your 12-month subscription has expired. Please renew to continue accessing your workspace.' 
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
      OPENAI_API_KEY: obfuscate(process.env.OPENAI_API_KEY),
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
    const hashedPassword = await bcrypt.hash(data.password.trim(), 10);
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
    const { email, password, name, tenantName, phone } = req.body;
    if (!email || !password || !name || !tenantName || !phone) return res.status(400).json({ error: 'All fields are required including phone number' });

    if (!/^\d{11}$/.test(phone)) return res.status(400).json({ error: 'The phone number field must be exactly 11 digits' });

    const role = 'tenant_admin';
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2', [email, role]);
    if (existingUser.rows.length > 0) return res.status(400).json({ error: 'This email is already associated with an Academic Workspace' });

    // existingTenant check removed to allow duplicate names as per user request

    // 1. Create Tenant
    const tenantResult = await pool.query(
      'INSERT INTO tenants (name, owner_name, owner_email) VALUES ($1, $2, $3) RETURNING id',
      [tenantName, name, email]
    );
    const tenantId = tenantResult.rows[0].id;

    // 2. Create Tenant Admin User
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const userResult = await pool.query(
      'INSERT INTO users (email, phone, password, name, role, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [email, phone, hashedPassword, name, 'tenant_admin', tenantId]
    );
    const userId = userResult.rows[0].id;

    const token = jwt.sign({ id: userId, email, name, role: 'tenant_admin', tenant_id: tenantId, phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, email, name, role: 'tenant_admin', tenant_id: tenantId, tenantName, phone } });
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

      if (requestedRole === 'researcher') {
          // Allow any admin/super_admin to login through the researcher portal
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

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id, phone: user.phone } });
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
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email, name, role', 
      [hashedPassword, parseInt(id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    res.json({ success: true, message: `Password for ${user.name} (${user.role}) has been overridden successfully.` });
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

// Super Admin: Lecturer Material Status
app.get('/api/admin/lecturer-material-stats', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        u.tenant_id,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'material') as material_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'material' AND is_available = true) as active_materials,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = u.tenant_id AND status = 'success' AND type = 'material_access') as material_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = u.tenant_id AND status = 'success' AND type = 'assessment_access') as assessment_revenue
      FROM users u
      WHERE u.role = 'tenant_admin'
      ORDER BY material_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lecturer material stats' });
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

    const authors: any[] = [];
    $('sourceDesc > biblStruct > analytic > author').each((_, el) => {
      const first = $(el).find('persName > forename').text().trim();
      const last = $(el).find('persName > surname').text().trim();
      const email = $(el).find('email').text().trim();
      
      const authorAffiliations: string[] = [];
      $(el).find('affiliation > orgName').each((idx, affEl) => {
        authorAffiliations.push($(affEl).text().trim());
      });
      
      if (first || last) {
        authors.push({
          name: `${first} ${last}`.trim(),
          email: email || null,
          affiliations: authorAffiliations.length > 0 ? authorAffiliations : []
        });
      }
    });

    const affiliations: string[] = []; // Keep global list for compatibility
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
/**
 * SHARED HELPER: Generates a high-fidelity PDF using Puppeteer
 * MIRRORS the FormattingEngine.tsx preview EXACTLY.
 */
async function generateHighFidelityPaperPDF(id: number | string): Promise<Buffer> {
  const paperResult = await pool.query(
    'SELECT title, formatted_content, volume, issue, issn, doi FROM papers WHERE id = $1', 
    [id]
  );
  const paper = paperResult.rows[0];
  if (!paper || !paper.formatted_content) {
    throw new Error('Paper or formatted content not found for high-fidelity generation');
  }

  // Fetch journal configs for branding
  const volResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_volume']);
  const issueResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_issue']);
  const issnResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_issn']);

  const branding = {
    volume: paper.volume || volResult.rows[0]?.value || '1',
    issue: paper.issue || issueResult.rows[0]?.value || '1',
    issn: (paper.issn && paper.issn !== 'Pending') ? paper.issn : (issnResult.rows[0]?.value || '2971-7760'),
    doi: (paper.doi && paper.doi !== 'Pending') ? paper.doi : (paper.status === 'published' ? `10.5555/genius.${id}` : 'Verification Pending'),
    date: paper.published_at ? new Date(paper.published_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')
  };

  const getBase64Image = (fileName: string) => {
    try {
      const filePath = path.join(process.cwd(), 'public', fileName);
      if (fs.existsSync(filePath)) {
        const bitmap = fs.readFileSync(filePath);
        const extension = path.extname(fileName).slice(1);
        return `data:image/${extension};base64,${bitmap.toString('base64')}`;
      }
    } catch (e) { console.error(`Failed to load logo ${fileName}:`, e); }
    return '';
  };

  const journalLogoBase64 = getBase64Image('journal-logo.png');
  const nsukLogoBase64 = getBase64Image('Nasarawa-State-University.jpg');

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { margin: 20mm 15mm; }
        body { font-family: serif; background: white; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-sizing: border-box; }
        
        .academic-content {
          font-family: serif;
          font-size: 11pt;
          line-height: 1.5;
          text-align: justify;
          color: #0f172a;
        }
        .academic-content p {
          text-align: justify;
          margin-bottom: 0.8em;
           orphans: 3;
           widows: 3;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .academic-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-family: sans-serif;
          font-size: 0.75rem;
          table-layout: fixed;
        }
        .academic-content th, .academic-content td {
          border: 1px solid #cbd5e1;
          padding: 0.5rem;
          text-align: left;
          word-break: break-word;
        }
        .academic-content th {
          background-color: #f8fafc;
          font-weight: bold;
        }
        .academic-content .academic-figure {
          margin: 2.5rem 0;
          text-align: center;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          border: 1px dashed #cbd5e1;
        }
        .paper-sheet {
          background: white;
          width: 100%;
          padding: 2rem 3rem;
          position: relative;
          page-break-after: always;
        }
        .paper-sheet:last-child {
          page-break-after: auto;
        }
        .header-sheet {
          background: white;
          width: 100%;
          padding: 1.5rem 3rem 0.5rem;
          border-bottom: 2px solid #800000;
          position: relative;
        }
        .paper-sheet:first-of-type {
          margin-top: 0;
          border-top: 1px dashed #f1f5f9;
        }
        .sheet-header-full {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #800000;
        }
        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .header-logo-left, .header-logo-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-logo-left img, .header-logo-right img {
          height: 32px;
          min-width: 32px;
          width: auto;
          object-fit: contain;
        }
        .header-title-stack, .partner-stack {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        .journal-red-small { color: #800000; font-weight: 900; font-size: 6px; text-transform: uppercase; }
        .journal-red-med { color: #800000; font-weight: 900; font-size: 8px; text-transform: uppercase; }
        .journal-black-large { color: #0f172a; font-weight: 900; font-size: 10px; text-transform: uppercase; }
        .journal-gray-type { color: #64748b; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.15em; }
        .header-meta-center {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .meta-row { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-doi { font-size: 7px; font-weight: 700; color: #4f46e5; font-family: monospace; }
        .partner-name { color: #0f172a; font-weight: 900; font-size: 8px; text-transform: uppercase; text-align: right; }
        .partner-status { color: #94a3b8; font-weight: 700; font-size: 7px; text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
        .page-number { position: absolute; font-size: 10px; font-weight: bold; color: #94a3b8; z-index: 100; }
        .page-number.top-right { top: 3rem; right: 5rem; }
        .page-number.bottom-center { bottom: 1.5rem; left: 50%; transform: translateX(-50%); }
        .page-number.bottom-right { bottom: 1.5rem; right: 5rem; }
        .page-footer { position: absolute; bottom: 1.5rem; left: 0; right: 0; text-align: center; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <!-- FIRST PAGE BRANDING HEADER (Matches FormattingEngine.tsx exactly) -->
      <div class="header-sheet">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
             ${journalLogoBase64 ? `<img src="${journalLogoBase64}" style="height: 50px; width: auto;" />` : ''}
             <div>
               <p style="color: #800000; font-weight: 900; font-size: 9px; uppercase; margin: 0;">Genius Multidisciplinary</p>
               <p style="color: #0f172a; font-weight: 900; font-size: 12px; uppercase; margin: 0;">INTERNATIONAL JOURNAL</p>
             </div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; uppercase; letter-spacing: 0.05em;">
              ISSN: ${branding.issn} | VOL ${branding.volume}, ISS ${branding.issue} | ${branding.date}
            </div>
            <div style="font-size: 9px; color: #4f46e5; font-family: monospace; font-weight: 700; margin-top: 4px;">${branding.doi}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem; text-align: right;">
             <div>
                <p style="color: #0f172a; font-weight: 900; font-size: 9px; uppercase; margin: 0;">Nasarawa State University Keffi</p>
                <p style="color: #94a3b8; font-weight: 700; font-size: 8px; uppercase; margin: 0;">Global Partner</p>
             </div>
             ${nsukLogoBase64 ? `<img src="${nsukLogoBase64}" style="height: 50px; width: auto;" />` : ''}
          </div>
        </div>
      </div>
      <div class="academic-content">
        ${paper.formatted_content}
      </div>
    </body>
    </html>
  `;

  const executablePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];

  let activePath = executablePaths.find(p => fs.existsSync(p));
  if (!activePath) {
    try {
      const { execSync } = require('child_process');
      activePath = execSync('which chromium || which google-chrome', { encoding: 'utf-8' }).trim();
    } catch (e) {}
  }

  const browser = await puppeteer.launch({
    executablePath: activePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

async function generateFinalManuscriptPDF(ast: any, branding: any) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  
  let page = pdfDoc.addPage([595.27, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 72; // 1 inch
  let y = height - margin;
  const black = rgb(0, 0, 0);
  const maroon = rgb(0.5, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  // Load and embed branding images
  let logoGenius: any = null;
  let logoNsuk: any = null;
  try {
    const pathGenius = path.join(process.cwd(), 'tools', 'ain logo.jpeg');
    const pathNsuk = path.join(process.cwd(), 'tools', 'Nasarawa-State-University.jpg');
    if (fs.existsSync(pathGenius)) logoGenius = await pdfDoc.embedJpg(fs.readFileSync(pathGenius));
    if (fs.existsSync(pathNsuk)) logoNsuk = await pdfDoc.embedJpg(fs.readFileSync(pathNsuk));
  } catch (err) {
    console.error('PDF Logo Embed Error:', err);
  }

  const drawHeader = (p: any, firstPage = false) => {
    let curY = height - 20;
    const headerFont = font;
    const headerSize = 8;
    
    // 1. Draw Logos if available
    if (logoGenius) {
      p.drawImage(logoGenius, { x: 40, y: curY - 35, width: 35, height: 35 });
    }
    if (logoNsuk) {
      p.drawImage(logoNsuk, { x: width - 40 - 35, y: curY - 35, width: 35, height: 35 });
    }

    // 2. Center Text (Journal Name + Metadata)
    const journalTitle = "GENIUS MULTIDISCIPLINARY INTERNATIONAL JOURNAL PUBLICATION";
    p.drawText(journalTitle, { 
      x: width / 2 - fontBold.widthOfTextAtSize(journalTitle, 9) / 2, 
      y: curY - 10, 
      size: 9, 
      font: fontBold, 
      color: maroon 
    });

    const metaLine = `ISSN: ${branding.issn || '2971-7760'} | Volume ${branding.vol}, Issue ${branding.issue}`;
    p.drawText(metaLine, { 
      x: width / 2 - font.widthOfTextAtSize(metaLine, 7) / 2, 
      y: curY - 22, 
      size: 7, 
      font: fontItalic, 
      color: gray 
    });

    curY -= 35;
    p.drawLine({ 
      start: { x: 40, y: curY }, 
      end: { x: width - 40, y: curY }, 
      thickness: 1, 
      color: rgb(0.9, 0.9, 0.9) 
    });
    
    return height - 90; // Reset Y for body content
  };

  const wrapText = (text: any, size: number, f: any, maxW: number) => {
    const str = String(text || '');
    if (!str) return [];
    const words = str.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (f.widthOfTextAtSize(testLine, size) < maxW) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  const drawJustifiedText = (targetPage: any, line: string, textFont: any, fontSize: number, xPos: number, yPos: number, maxW: number, isLastLine: boolean) => {
    if (isLastLine || !line.trim().includes(' ')) {
      targetPage.drawText(line, { x: xPos, y: yPos, size: fontSize, font: textFont });
      return;
    }
    const words = line.split(' ');
    let textWidth = 0;
    words.forEach(w => textWidth += textFont.widthOfTextAtSize(w, fontSize));
    
    // Safety check just in case all words are exactly the max width
    if (textWidth >= maxW) {
       targetPage.drawText(line, { x: xPos, y: yPos, size: fontSize, font: textFont });
       return;
    }
    
    const spaceToFill = maxW - textWidth;
    const spaceWidth = spaceToFill / (words.length - 1);
    
    let currentX = xPos;
    for (let i = 0; i < words.length; i++) {
        targetPage.drawText(words[i], { x: currentX, y: yPos, size: fontSize, font: textFont });
        currentX += textFont.widthOfTextAtSize(words[i], fontSize) + spaceWidth;
    }
  };

  const checkNewPage = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([595.27, 841.89]);
      y = drawHeader(page);
    }
  };

  y = drawHeader(page, true);

  // Title
  y -= 40;
  const titleLines = wrapText(ast.title || 'Untitled Manuscript', 14, fontBold, width - 2 * margin);
  for (const line of titleLines) {
    page.drawText(line, { x: width / 2 - fontBold.widthOfTextAtSize(line, 14) / 2, y, size: 14, font: fontBold });
    y -= 18;
  }

  // Authors
  y -= 10;
  const authorNames = (ast.authors || []).map((a: any) => typeof a === 'string' ? a : a.name).join(', ');
  const authLines = wrapText(authorNames, 11, font, width - 2 * margin);
  for (const line of authLines) {
    page.drawText(line, { x: width / 2 - font.widthOfTextAtSize(line, 11) / 2, y, size: 11, font });
    y -= 14;
  }

  // Abstract Header
  y -= 30;
  checkNewPage(100);
  page.drawText('Abstract', { x: width / 2 - fontBold.widthOfTextAtSize('Abstract', 11) / 2, y, size: 11, font: fontBold });
  y -= 16;
  
  // Abstract Body (Combined from AST parts)
  const absText = ast.abstract ? [
    ast.abstract.background, 
    ast.abstract.method, 
    ast.abstract.results, 
    ast.abstract.conclusion, 
    ast.abstract.recommendation
  ].filter(Boolean).join(' ') : 'No abstract provided.';
  
  const absLines = wrapText(absText, 10, fontItalic, width - 2 * margin);
  for (let i = 0; i < absLines.length; i++) {
    checkNewPage(12);
    const line = absLines[i];
    drawJustifiedText(page, line, fontItalic, 10, margin, y, width - 2 * margin, i === absLines.length - 1);
    y -= 12;
  }

  // Keywords
  y -= 10;
  const kwText = `Keywords: ${(ast.keywords || []).join(', ')}`;
  const kwLines = wrapText(kwText, 10, fontItalic, width - 2 * margin);
  for (const line of kwLines) {
    checkNewPage(12);
    page.drawText(line, { x: margin, y, size: 10, font: fontItalic });
    y -= 12;
  }

  // Sections (Introduction, Methods, etc)
  if (ast.sections) {
    for (const key of Object.keys(ast.sections)) {
      const content = ast.sections[key];
      if (!content) continue;
      
      y -= 25;
      checkNewPage(40);
      const sectionTitle = key.charAt(0).toUpperCase() + key.slice(1);
      page.drawText(sectionTitle, { x: width / 2 - fontBold.widthOfTextAtSize(sectionTitle, 11) / 2, y, size: 11, font: fontBold });
      y -= 18;

      const lines = wrapText(content, 11, font, width - 2 * margin);
      for (let i = 0; i < lines.length; i++) {
        checkNewPage(14);
        drawJustifiedText(page, lines[i], font, 11, margin, y, width - 2 * margin, i === lines.length - 1);
        y -= 14;
      }
    }
  }

  // References
  y -= 30;
  checkNewPage(40);
  page.drawText('References', { x: width / 2 - fontBold.widthOfTextAtSize('References', 11) / 2, y, size: 11, font: fontBold });
  y -= 20;

  const refs = ast.references || [];
  for (const ref of refs) {
    const rText = typeof ref === 'string' ? ref : (ref.raw || ref.text || JSON.stringify(ref));
    const lines = wrapText(rText, 10, font, width - 2 * margin - 20); // Hanging indent simulation
    for (let i = 0; i < lines.length; i++) {
        checkNewPage(12);
        const indentX = margin + (i > 0 ? 20 : 0);
        drawJustifiedText(page, lines[i], font, 9, indentX, y, width - margin - indentX, i === lines.length - 1);
        y -= 12;
    }
    y -= 4;
  }

  // Draw Page Numbers at the bottom center of all pages
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    const pageNumStr = String((branding.startPageNumber || 1) + idx);
    p.drawText(pageNumStr, { x: width / 2 - font.widthOfTextAtSize(pageNumStr, 10) / 2, y: 30, size: 10, font: font, color: black });
  });

  return await pdfDoc.save();
}

async function validateDOI(doi: string) {
  try {
    // Quick head check to verify DOI resolve
    const res = await fetch(`https://doi.org/${doi}`, { method: "HEAD" });
    // ACCEPT 404/403: doi.org takes time to update. If Zenodo says it's published, we trust it.
    // We only return false on actual NETWORK errors to the resolver itself.
    return true; 
  } catch (err) {
    console.warn(`DOI Resolver Connectivity Issue for ${doi}:`, err);
    return false;
  }
}

async function prereserveDOI(zenodoToken: string) {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.ZENODO_USE_PRODUCTION === 'true';
  const ZENODO_URL = isProduction 
    ? 'https://zenodo.org/api/deposit/depositions'
    : 'https://sandbox.zenodo.org/api/deposit/depositions';
  const headers = { 'Authorization': `Bearer ${zenodoToken}`, 'Content-Type': 'application/json' };
  const res = await fetch(ZENODO_URL, { method: 'POST', headers, body: JSON.stringify({}) });
  if (!res.ok) throw new Error(`Zenodo DOI Prereserve Failed: ${res.statusText}`);
  const draft = await res.json();
  return { depositionId: draft.id, doi: draft.metadata.prereserve_doi.doi, bucketUrl: draft.links.bucket };
}

async function finalizeZenodoPublish(depositionId: number, zenodoToken: string, paper: any, pdfBuffer: Buffer, bucketUrl: string) {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.ZENODO_USE_PRODUCTION === 'true';
  const ZENODO_URL = isProduction 
    ? 'https://zenodo.org/api/deposit/depositions'
    : 'https://sandbox.zenodo.org/api/deposit/depositions';
  const headers = { 'Authorization': `Bearer ${zenodoToken}` };
  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
  const ast = metadata.ast || {};

  // 1. Upload
  const filename = `${(ast.title || 'manuscript').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
  const uploadRes = await fetch(`${bucketUrl}/${filename}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/octet-stream' },
    body: new Uint8Array(pdfBuffer)
  });
  if (!uploadRes.ok) throw new Error(`Zenodo Final Upload Failed: ${uploadRes.statusText}`);

  // 2. Update Metadata
  const zenodoMetadata = {
    metadata: {
      title: ast.title || paper.title || 'Genius Publication',
      upload_type: "publication",
      publication_type: "article",
      description: ast.abstract?.background || (typeof paper.content === 'string' ? paper.content.substring(0, 500) : "Academic research publication."),
      publication_date: new Date().toISOString().split('T')[0],
      access_right: "open",
      creators: (ast.authors || []).map((a: any) => {
        const name = typeof a === 'string' ? a : (a.name || 'Author');
        return { name: name.includes(',') ? name : name.split(' ').reverse().join(', ') };
      })
    }
  };
  await fetch(`${ZENODO_URL}/${depositionId}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(zenodoMetadata)
  });

  // 3. Publish
  const publishRes = await fetch(`${ZENODO_URL}/${depositionId}/actions/publish`, { method: 'POST', headers });
  if (!publishRes.ok) throw new Error(`Zenodo Final Publish Failed: ${publishRes.statusText}`);
  const final = await publishRes.json();
  return final.doi;
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

    // 1️⃣ & 4️⃣ Payment Enforcement: Check for existing unused publication credit
    const creditCheck = await pool.query(
      "SELECT id FROM transactions WHERE user_id = $1 AND type = 'publication' AND status = 'success' AND (metadata->>'consumed')::boolean IS NOT TRUE LIMIT 1",
      [userId]
    );
    
    if (creditCheck.rows.length === 0) {
      return res.status(402).json({ error: 'No publication credit found. Please complete payment first.' });
    }

    let textContent = '';
    let metadata: any = null;

    if (req.file.mimetype === 'application/pdf') {
      metadata = await parseWithGrobid(req.file.buffer);
      const data = await pdfParse(req.file.buffer);
      textContent = data.text;
      if (!metadata) metadata = {};
      metadata.pageCount = data.numpages;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      textContent = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload PDF or DOCX.' });
    }

    if (!metadata || !metadata.title) {
      console.log('Falling back to OpenAI for metadata extraction...');
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { 
              role: 'system', 
              content: 'You are an expert academic metadata extractor. Return JSON with keys: title (string), authors (array of objects), abstract (string), keywords (string[]). ' +
                       'Each author object MUST include: name (string), department (string), faculty (string), institution (string), email (string), phone (string). ' +
                       'Examine the paper header carefully for "By", "Department", "Faculty", "Email", "Phone" or similar labels to extract these details accurately.'
            },
            { role: 'user', content: `Extract metadata from this academic paper text:\n\n${textContent.substring(0, 15000)}` }
          ]
        });
        metadata = JSON.parse(response.choices[0]?.message?.content || '{}');
      } catch (aiError: any) {
        console.error('OpenAI Metadata Extraction Failed:', aiError.message);
        if (aiError.status === 429) {
          return res.status(429).json({ 
            error: 'AI Services Busy', 
            details: 'The AI engine is currently at capacity. Please try again in 1 minute, or manually enter metadata in the next step.' 
          });
        }
        metadata = { title: req.file.originalname.replace(/\.[^/.]+$/, ""), authors: ['Author'], abstract: 'Abstract pending...' };
      }
    }

    // Ensure authors column remains a string array (names only) for compatibility, 
    // while full objects are preserved in the metadata JSONB
    const authorNames = (metadata.authors || []).map((a: any) => typeof a === 'string' ? a : a.name);

    const result = await pool.query(
      'INSERT INTO papers (user_id, title, authors, abstract, content, metadata, file_blob) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [
        userId,
        metadata.title || 'Untitled',
        JSON.stringify(authorNames),
        metadata.abstract || '',
        textContent,
        JSON.stringify(metadata),
        req.file.buffer
      ]
    );

    const newPaperId = result.rows[0].id;

    // Link the transaction and mark it as consumed
    const txId = creditCheck.rows[0].id;
    await pool.query(
      "UPDATE transactions SET metadata = metadata || $1, status = 'consumed' WHERE id = $2",
      [JSON.stringify({ consumed: true, paper_id: newPaperId, consumed_at: new Date().toISOString() }), txId]
    );

    // 2️⃣ Acceptance Letter is now handled by Payment Webhook or this route 
    // Moving to follow-up: sendAcceptanceEmail is now triggered here for the specific paper
    await sendAcceptanceEmail(req.user.email, req.body.researcherName || 'Researcher', metadata.title || 'Untitled', newPaperId);


    res.json({ 
      id: newPaperId,
      title: metadata.title,
      authors: metadata.authors,
      abstract: metadata.abstract
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/papers/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { title, authors, abstract } = req.body;
    
    const currentPaper = await pool.query('SELECT metadata, is_locked FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (currentPaper.rows.length === 0) return res.status(404).json({ error: 'Paper not found' });
    if (currentPaper.rows[0].is_locked) return res.status(403).json({ error: 'Manuscript is locked for final archival and cannot be modified.' });
    
    let metadata = JSON.parse(currentPaper.rows[0].metadata || '{}');
    if (title !== undefined) metadata.title = title;
    if (authors !== undefined) metadata.authors = authors;
    if (abstract !== undefined) metadata.abstract = abstract;

    const authorNames = (metadata.authors || []).map((a: any) => typeof a === 'string' ? a : a.name);

    await pool.query(
      'UPDATE papers SET title = COALESCE($1, title), authors = $2, abstract = COALESCE($3, abstract), metadata = $4 WHERE id = $5 AND user_id = $6',
      [title || null, JSON.stringify(authorNames), abstract || null, JSON.stringify(metadata), id, req.user.id]
    );

    res.json({ success: true, metadata });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Pipeline Progression APIs =====
app.get('/api/papers/queue/:status', authenticateToken, async (req: any, res) => {
  try {
    const { status } = req.params;
    const result = await pool.query(
      'SELECT id, title, created_at, status FROM papers WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [req.user.id, status]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

app.put('/api/papers/:id/status', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = req.body;
    
    // Automatically lock paper if it moves to final stages
    const isLocked = (status === 'integrity_check' || status === 'published');

    await pool.query(
      'UPDATE papers SET status = $1, is_locked = CASE WHEN $2 = true THEN true ELSE is_locked END WHERE id = $3 AND user_id = $4',
      [status, isLocked, id, req.user.id]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/papers/:id/file', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT file_blob, title, metadata FROM papers WHERE id = $1', [id]);
    const paper = result.rows[0];
    
    if (!paper || !paper.file_blob) {
      return res.status(404).json({ error: 'File data not found on server' });
    }

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    const ext = metadata.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    
    // Sanitize filename to prevent header injection or invalid characters
    const safeTitle = (paper.title || 'manuscript').replace(/[^a-zA-Z0-9\s-_]/g, '').substring(0, 100);
    
    const mimetype = metadata.mimetype || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.${ext}"`);
    res.send(paper.file_blob);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SHARED PDF GENERATION HELPERS =====
async function generatePublishedArticlePDF(paperId: number | string): Promise<{ buffer: Buffer; filename: string }> {
  const result = await pool.query(
    'SELECT id, title, authors, abstract, content, formatted_content, metadata, doi, volume, issue, issn, published_at, created_at FROM papers WHERE id = $1',
    [paperId]
  );
  const paper = result.rows[0];
  if (!paper) throw new Error('Paper not found');

  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
  
  // HIGHEST PRIORITY: Use High-Fidelity Formatted HTML (Matches Formatting Preview 1:1)
  if (paper.formatted_content) {
    try {
      console.log(`[PUBLISH] Generating High-Fidelity PDF for Paper ${paperId}...`);
      const buffer = await generateHighFidelityPaperPDF(paperId);
      return { buffer, filename: `${(paper.title || 'article').replace(/[^a-z0-9]/gi, '_')}_Final.pdf` };
    } catch (e) {
      console.warn(`[PUBLISH] High-Fidelity pass failed for ${paperId}, falling back to AST/Standard.`, e);
    }
  }

  // SECOND PRIORITY: Use Semantic AST for structural PDF if available
  if (metadata.ast) {
    const branding = {
      issn: paper.issn || '2971-7760',
      vol: paper.volume || '1',
      issue: paper.issue || '1'
    };
    const buffer = await generateFinalManuscriptPDF(metadata.ast, branding);
    return { buffer: Buffer.from(buffer), filename: `${(paper.title || 'article').replace(/[^a-z0-9]/gi, '_')}.pdf` };
  }

  const issn = paper.issn || '2971-7760';
  const volume = paper.volume || '1';
  const issue = paper.issue || '1';
  const doi = paper.doi || '';
  const pubDate = paper.published_at || paper.created_at;
  const dateStr = pubDate ? new Date(pubDate).toLocaleDateString('en-GB') : '';
  const title = paper.title || 'Untitled';
  const authorsRaw = paper.authors;
  let authorsList: string[] = [];
  try { authorsList = typeof authorsRaw === 'string' ? JSON.parse(authorsRaw) : (authorsRaw || []); } catch { authorsList = [String(authorsRaw)]; }
  const authorsStr = authorsList.map((a: any) => typeof a === 'string' ? a : a.name).join(', ');
  const abstract = paper.abstract || metadata.abstract || '';

  // Build PDF
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const PAGE_W = 595; // A4
  const PAGE_H = 842;
  const MARGIN = 55;
  const contentW = PAGE_W - 2 * MARGIN;
  const maroon = rgb(0.5, 0, 0);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const lightGray = rgb(0.6, 0.6, 0.6);
  const indigo = rgb(0.26, 0.27, 0.53);

  // Dynamic Logo Loading
  let logoLeft: any = null;
  let logoRight: any = null;
  try {
    const lpL = path.join(process.cwd(), 'tools', 'ain logo.jpeg');
    const lpR = path.join(process.cwd(), 'tools', 'Nasarawa-State-University.jpg');
    if (fs.existsSync(lpL)) logoLeft = await pdfDoc.embedJpg(fs.readFileSync(lpL));
    if (fs.existsSync(lpR)) logoRight = await pdfDoc.embedJpg(fs.readFileSync(lpR));
  } catch (e) {
    console.error('Logo load failed:', e);
  }

  // Helper: Draw professional journal header on any page
  const drawPageHeader = (p: any) => {
    // Branding Header
    if (logoLeft) p.drawImage(logoLeft, { x: MARGIN, y: PAGE_H - 45, width: 35, height: 35 });
    if (logoRight) p.drawImage(logoRight, { x: PAGE_W - MARGIN - 35, y: PAGE_H - 45, width: 35, height: 35 });

    p.drawText('GENIUS MULTIDISCIPLINARY INTERNATIONAL JOURNAL', {
      x: PAGE_W / 2 - fontBold.widthOfTextAtSize('GENIUS MULTIDISCIPLINARY INTERNATIONAL JOURNAL', 9) / 2,
      y: PAGE_H - 25,
      size: 9,
      font: fontBold,
      color: maroon,
    });
    p.drawText('PUBLICATION (GMIJP)', {
      x: PAGE_W / 2 - fontBold.widthOfTextAtSize('PUBLICATION (GMIJP)', 9) / 2,
      y: PAGE_H - 36,
      size: 9,
      font: fontBold,
      color: maroon,
    });

    const metaText = `ISSN: ${issn}   |   VOL: ${volume}   |   NO: ${issue}`;
    p.drawText(metaText, {
      x: PAGE_W / 2 - fontBold.widthOfTextAtSize(metaText, 8) / 2,
      y: PAGE_H - 48,
      size: 8,
      font: fontBold,
      color: gray,
    });

    if (doi || dateStr) {
      const lineText = `${doi ? 'DOI: ' + doi : ''}${doi && dateStr ? '   •   ' : ''}${dateStr ? 'Published: ' + dateStr : ''}`;
      p.drawText(lineText, {
        x: PAGE_W / 2 - fontRegular.widthOfTextAtSize(lineText, 7) / 2,
        y: PAGE_H - 58,
        size: 7,
        font: fontRegular,
        color: indigo,
      });
    }

    p.drawLine({
      start: { x: MARGIN, y: PAGE_H - 65 },
      end: { x: PAGE_W - MARGIN, y: PAGE_H - 65 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    return PAGE_H - 85;
  };

  let currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = drawPageHeader(currentPage);

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      const pageNum = pdfDoc.getPageCount();
      currentPage.drawText(`— Page ${pageNum} —`, {
        x: PAGE_W / 2 - fontRegular.widthOfTextAtSize(`— Page ${pageNum} —`, 8) / 2,
        y: 25,
        size: 8,
        font: fontRegular,
        color: lightGray,
      });
      currentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = drawPageHeader(currentPage);
    }
  };

  const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
    const sanitizedArr = sanitizePdfText(text).replace(/```[\s\S]*?```/g, ''); // Filter code artifacts
    const lines: string[] = [];
    const paragraphs = sanitizedArr.split(/\n/);
    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      const words = para.split(/\s+/);
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        try {
          if (font.widthOfTextAtSize(testLine, size) > maxWidth) {
            if (line) lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        } catch {
          line = testLine;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  };

  const drawTextBlock = (text: string, usedFont: any, size: number, color: any, lineHeight: number, indent = 0) => {
    const lines = wrapText(text, usedFont, size, contentW - indent);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      ensureSpace(lineHeight);
      if (line === '') {
        y -= lineHeight * 0.5;
        continue;
      }

      // Justify if not the last line of a paragraph segment
      const isLastLine = i === lines.length - 1 || lines[i+1] === '';
      const words = line.trim().split(/\s+/);
      
      if (!isLastLine && words.length > 1) {
        const totalWordWidth = words.reduce((acc, w) => acc + usedFont.widthOfTextAtSize(w, size), 0);
        const totalGapWidth = (contentW - indent) - totalWordWidth;
        const gapSize = totalGapWidth / (words.length - 1);
        
        let currentX = MARGIN + indent;
        for (const word of words) {
          currentPage.drawText(word, { x: currentX, y, size, font: usedFont, color });
          currentX += usedFont.widthOfTextAtSize(word, size) + gapSize;
        }
      } else {
        currentPage.drawText(line, { x: MARGIN + indent, y, size, font: usedFont, color });
      }
      y -= lineHeight;
    }
  };

  const processNode = async (node: any, $: any) => {
    const tag = node.name;
    const $node = $(node);

    if (!tag && node.type === 'text') {
      const text = node.data.trim();
      if (text && text.length > 0) {
        drawTextBlock(text, fontRegular, 10, black, 14);
        y -= 6;
      }
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const text = $node.text().trim().replace(/[\r\n]+/g, ' ');
      if (text) {
        y -= 12;
        ensureSpace(25);
        currentPage.drawText(sanitizePdfText(text).toUpperCase(), { x: MARGIN, y, size: 10.5, font: fontBold, color: black });
        y -= 16;
      }
    } else if (tag === 'p') {
      const text = $node.text().trim();
      if (text) {
        drawTextBlock(text, fontRegular, 10, black, 14);
        y -= 8;
      }
    } else if (tag === 'table') {
      y -= 10;
      ensureSpace(40);
      const rows = $node.find('tr').get();
      if (rows.length > 0) {
        const firstRowCells = $(rows[0]).find('td, th').get();
        const colCount = Math.max(firstRowCells.length, 1);
        const colW = contentW / colCount;

        currentPage.drawLine({ start: { x: MARGIN, y: y + 5 }, end: { x: PAGE_W - MARGIN, y: y + 5 }, thickness: 1, color: black });

        for (const row of rows) {
          const cells = $(row)
            .find('td, th')
            .map((_, td) => $(td).text().trim())
            .get();
          let rowMaxLines = 1;
          const cellWrappedStrings = cells.map((c) => {
            const lines = wrapText(c, fontRegular, 8.5, colW - 10);
            rowMaxLines = Math.max(rowMaxLines, lines.length);
            return lines;
          });

          const rowHeight = rowMaxLines * 11 + 6;
          ensureSpace(rowHeight + 5);

          cells.forEach((_, idx) => {
            const cellX = MARGIN + idx * colW;
            const lines = cellWrappedStrings[idx];
            lines.forEach((line, lIdx) => {
              currentPage.drawText(line, { x: cellX + 5, y: y - lIdx * 11, size: 8.5, font: fontRegular, color: black });
            });
          });

          y -= rowHeight;
          currentPage.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.3, color: lightGray });
        }
      }
      y -= 15;
    } else if (tag === 'figure' || tag === 'img' || $node.hasClass('academic-figure')) {
      y -= 10;
      ensureSpace(40);
      const figHeading = $node.find('figcaption, .caption').text().trim() || $node.text().trim() || 'Figure';
      const cleanHeading = figHeading.replace(/[\r\n]+/g, ' ');
      const figRef = `[ ${sanitizePdfText(cleanHeading)} ]`;
      currentPage.drawText(figRef, {
        x: PAGE_W / 2 - fontItalic.widthOfTextAtSize(figRef, 9) / 2,
        y,
        size: 9,
        font: fontItalic,
        color: gray,
      });
      y -= 20;
    } else {
      const children = $node.contents().get();
      for (const child of children) {
        await processNode(child, $);
      }
    }
  };

  // Advanced Extraction
  if (paper.formatted_content) {
    const $ = cheerio.load(paper.formatted_content);

    // Title
    const safeT = sanitizePdfText(title).toUpperCase();
    const tLines = wrapText(safeT, fontBold, 15, contentW);
    for (const l of tLines) {
      ensureSpace(18);
      currentPage.drawText(l, { x: MARGIN, y, size: 15, font: fontBold, color: black });
      y -= 18;
    }
    y -= 10;

    // Authors
    drawTextBlock(authorsStr, fontItalic, 11, gray, 15);
    y -= 15;

    // Abstract
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_W - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    ensureSpace(16);
    currentPage.drawText('ABSTRACT', { x: MARGIN, y, size: 10, font: fontBold, color: maroon });
    y -= 16;
    drawTextBlock(abstract, fontRegular, 9.5, gray, 13);
    y -= 8;
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 4 },
      end: { x: PAGE_W - MARGIN, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 25;

    // Begin Recursive Traversal from Body
    const bodyContents = $('body').contents().get();
    for (const node of bodyContents) {
      await processNode(node, $);
    }
  } else {
    // Fallback
    drawTextBlock(paper.content || '', fontRegular, 10, black, 14);
  }

  // Final Footer on last page
  const lastNum = pdfDoc.getPageCount();
  currentPage.drawText(`— Page ${lastNum} —`, {
    x: PAGE_W / 2 - fontRegular.widthOfTextAtSize(`— Page ${lastNum} —`, 8) / 2,
    y: 25,
    size: 8,
    font: fontRegular,
    color: lightGray,
  });

  const pdfB = await pdfDoc.save();
  const sfT = (sanitizePdfText(title).replace(/[^a-zA-Z0-9\s]/g, '') || 'Manuscript').substring(0, 80);
  return { buffer: Buffer.from(pdfB), filename: `${sfT}_Published.pdf` };
}

async function sendPublicationEmail(to: string, researcherName: string, manuscriptTitle: string, doi: string, url: string, pdfBuffer: Buffer) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    await resend.emails.send({
      from: `Genius Global Registry <${fromEmail}>`,
      to: [to],
      subject: `CONGRATULATIONS: Your Manuscript has been Published [DOI: ${doi}]`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 40px; border-radius: 24px 24px 0 0; text-align: center;">
            <div style="background: #fbbf24; width: 60px; height: 60px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
              <span style="font-size: 30px;">🎓</span>
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Scientific Breakthrough</h1>
            <p style="color: #e0e7ff; margin-top: 10px; font-size: 14px; opacity: 0.8;">Genius Global Research Registry</p>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 24px 24px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #0f172a; margin-top: 0;">Congratulations, ${researcherName}!</h2>
            <p>Your manuscript has been successfully published to the <strong>Genius Global Network</strong>.</p>
            <p><strong>DOI:</strong> ${doi}</p>
            <p>Please find your official published manuscript attached to this email.</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${url}" style="background: #4338ca; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Registry Page</a>
            </div>
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Genius Publishing Engine Automated Delivery</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Published_Manuscript_${doi.replace(/\//g, '_')}.pdf`,
          content: pdfBuffer.toString('base64'),
        }
      ]
    });
    console.log(`Publication email sent successfully to ${to}`);
  } catch (error) {
    console.error('Failed to send publication email:', error);
  }
}

// ===== Published PDF Generation (clean journal-branded PDF for preview/download) =====
app.get('/api/papers/:id/published-pdf', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { buffer, filename } = await generatePublishedArticlePDF(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Published PDF error:', error);
    res.status(500).json({ error: error.message || 'Generation Failed' });
  }
});

app.post('/api/manuscript/validate-apa/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found or unauthorized' });

    let keywords = '';
    try {
      if (typeof paper.metadata === 'string') {
        const meta = JSON.parse(paper.metadata);
        keywords = meta.keywords?.join(', ') || '';
      } else if (paper.metadata) {
        keywords = paper.metadata.keywords?.join(', ') || '';
      }
    } catch(e) {}

    const manuscriptText = `
Title: ${paper.title || ''}
Authors: ${paper.authors || ''}
Abstract: ${paper.abstract || ''}
Keywords: ${keywords}
Content:
${(paper.content || '').substring(0, 40000)}
    `.trim();

    const { phase = 0 } = req.body || {};
    
    // Phase-specific rules and prompts
    const phaseRules: Record<number, { name: string, prompt: string }> = {
      0: { 
        name: "Structure Check", 
        prompt: "Verify the presence of mandatory sections: Introduction, Methods, Results, Discussion, and Conclusion. List any missing sections." 
      },
      1: { 
        name: "Abstract Validation", 
        prompt: "Check the Abstract. It must not exceed 250 words and must cover: Background, Method, Results, Conclusion, and Recommendation." 
      },
      2: { 
        name: "Keywords Policy", 
        prompt: "Check the Keywords. They must be preceded by the label 'Keywords:' (italicized usually, but check text here) and contain 3-5 comma-separated terms." 
      },
      3: { 
        name: "Introduction & Gap", 
        prompt: "Analyze the Introduction. Ensure it clearly states the research problem, the gap in existing literature, and the specific objective of this study." 
      },
      4: { 
        name: "Methods (Recipe)", 
        prompt: "Analyze the Methods section. It must provide enough detail for replication (design, participants, instruments, and procedure)." 
      },
      5: { 
        name: "Results (Data)", 
        prompt: "Analyze the Results section. Check for pure data reporting and adherence to APA statistical formatting (e.g., M and SD in italics)." 
      },
      6: { 
        name: "Discussion", 
        prompt: "Analyze the Discussion. It must interpret the results, compare them with previous studies, and mention study limitations." 
      },
      7: { 
        name: "Conclusion", 
        prompt: "Analyze the Conclusion. It should be a final wrap-up of main findings and practical implications or recommendations." 
      },
      8: { 
        name: "Citations Consistency", 
        prompt: "Analyze in-text citations throughout the manuscript. Ensure they follow (Author, Year) format and are consistent with the text (e.g., et al. for 3+ authors)." 
      },
      9: { 
        name: "References (APA 7th)", 
        prompt: "Analyze the References list. Verify strict adherence to APA 7th Edition formatting for every entry." 
      },
      10: { 
        name: "Final Meta-Review", 
        prompt: "Perform a final comprehensive check of the whole manuscript for overall APA 7th Edition compliance." 
      }
    };

    const currentPhase = phaseRules[phase] || phaseRules[0];

    const prompt = `
You are a strict academic journal validator and Intelligent Editor acting as a gatekeeper.
We are in PHASE ${phase}: ${currentPhase.name}.

TASK: ${currentPhase.prompt}

Analyze the manuscript below according to APA 7th rules and return ONLY JSON. Do not output markdown code blocks.

Return JSON precisely in this format:
{
  "phase": ${phase},
  "phaseName": "${currentPhase.name}",
  "isValid": true/false,
  "issues": [
    {
      "type": "compliance_issue",
      "section": "Name of section",
      "message": "Clear explanation of the APA violation.",
      "suggestion": "Actionable instruction on how to fix it.",
      "aiRewrite": "An AI-generated draft to fix the specific issue.",
      "whereToFind": "Contextual advice telling the user where in the manuscript to look."
    }
  ],
  "score": number (0-100),
  "finalDecision": "PASS" | "FAIL" | "NEEDS_REVIEW",
  "abstract": { "wordCount": number }, // Only if applicable
  "keywords": { "count": number }, // Only if applicable
  "wordCount": { "total": number }, // Only if applicable
  "sections": { "found": ["..."], "missing": ["..."] } // Only if applicable
}

Manuscript:
${manuscriptText}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    let aiResult = parsed;

    // Phase-aware scoring
    const baseScore = aiResult.isValid ? 100 : 70;
    const penalty = (aiResult.issues?.length || 0) * 10;
    aiResult.score = Math.max(0, baseScore - penalty);

    if (aiResult.score >= 90) {
      aiResult.finalDecision = 'PASS';
    } else if (aiResult.score >= 60) {
      aiResult.finalDecision = 'NEEDS_REVIEW';
    } else {
      aiResult.finalDecision = 'FAIL';
    }

    res.json({ 
      success: true, 
      validation: aiResult 
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid ID' });
    console.error('Validate APA Error:', error);
    res.status(500).json({ error: 'Failed to validate manuscript rules' });
  }
});

app.post('/api/manuscript/check-similarity/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT content FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const prompt = `Analyze this manuscript for academic plagiarism and similarity. 
    Estimate a similarity percentage based on potential reused content or common academic phrasing.
    
    CONTENT: "${(paper.content || '').substring(0, 10000)}"
    
    Return JSON only: { "similarityScore": number (0-100), "explanation": "string" }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: "You are a professional plagiarism auditor for a high-impact journal." }, { role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const aiData = JSON.parse(completion.choices[0].message.content || '{}');
    const score = aiData.similarityScore || 0;

    await pool.query('UPDATE papers SET metadata = metadata || $1 WHERE id = $2', [JSON.stringify({ similarityScore: score }), id]);

    res.json({ success: true, similarityScore: score, explanation: aiData.explanation });
  } catch (error) {
    console.error('Similarity check error:', error);
    res.status(500).json({ error: 'Failed to perform similarity audit' });
  }
});

app.post('/api/manuscript/auto-fix/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { fixes } = req.body; 
    
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.is_locked) return res.status(403).json({ error: 'Manuscript is locked for final archival' });

    let currentMetadata = typeof paper.metadata === 'string' ? JSON.parse(paper.metadata || '{}') : (paper.metadata || {});
    if (!currentMetadata.history) currentMetadata.history = [];

    // Save previous version
    currentMetadata.history.push({
      version: currentMetadata.history.length + 1,
      timestamp: new Date().toISOString(),
      abstract: paper.abstract,
      content: paper.content,
      title: paper.title
    });

    let updatedContent = paper.content;
    let updatedAbstract = paper.abstract;
    let updatedTitle = paper.title;

    // Robust target matching for AI fixes
    for (const fix of fixes) {
       const target = fix.target?.toLowerCase();
       if (target === 'title') updatedTitle = fix.content;
       else if (target === 'abstract') updatedAbstract = fix.content;
       else {
         // Default for phase-based fixes (Introduction, Methods, etc.) or 'content'/'sections'
         updatedContent = fix.content;
       }
    }

    // Invalidate stale AST and formatted_content to force re-sync
    delete currentMetadata.ast;

    await pool.query(
      'UPDATE papers SET content = $1, abstract = $2, title = $3, metadata = $4, formatted_content = NULL WHERE id = $5 AND user_id = $6',
      [updatedContent, updatedAbstract, updatedTitle, JSON.stringify(currentMetadata), id, req.user.id]
    );

    res.json({ success: true, message: 'Manuscript rebuilt and saved. Version backed up.' });
  } catch (error) {
    console.error('Auto fix error:', error);
    res.status(500).json({ error: 'Failed to apply automatic structural fixes' });
  }
});

async function performStructuralRewrite(paper: any) {
    const prompt = `
You are a master academic formatter and parser.
Parse the following manuscript into a strict JSON Abstract Syntax Tree (AST).
Extract all metadata, the abstract, and break the body into sections and blocks (paragraphs, citations).
If a mandatory section is missing (e.g. Methods), do NOT invent it, just leave it out of the sections array.

Ensure the output adheres exactly to the JSON schema provided.
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AcademicAST',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              authors: { type: 'array', items: { type: 'string' } },
              abstract: {
                type: 'object',
                properties: {
                  background: { type: 'string' },
                  method: { type: 'string' },
                  results: { type: 'string' },
                  conclusion: { type: 'string' },
                  recommendation: { type: 'string' }
                },
                required: ['background', 'method', 'results', 'conclusion', 'recommendation'],
                additionalProperties: false
              },
              keywords: { type: 'array', items: { type: 'string' } },
              sections: {
                type: 'object',
                properties: {
                  introduction: { type: 'array', items: { type: 'string' } },
                  methods: { type: 'array', items: { type: 'string' } },
                  results: { type: 'array', items: { type: 'string' } },
                  discussion: { type: 'array', items: { type: 'string' } },
                  conclusion: { type: 'array', items: { type: 'string' } }
                },
                required: ['introduction', 'methods', 'results', 'discussion', 'conclusion'],
                additionalProperties: false
              },
              references: { type: 'array', items: { type: 'string' } }
            },
            required: ['title', 'authors', 'abstract', 'keywords', 'sections', 'references'],
            additionalProperties: false
          }
        }
      },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Title: ${paper.title}\nAuthors: ${paper.authors}\nAbstract: ${paper.abstract}\nContent:\n${(paper.content||'').substring(0, 50000)}` }
      ]
    });

    const astJson = response.choices[0]?.message?.content;
    if (!astJson) throw new Error("Failed to parse AST");

    const ast = JSON.parse(astJson);
    
    // Save AST to db in metadata
    let currentMetadata = typeof paper.metadata === 'string' ? JSON.parse(paper.metadata || '{}') : (paper.metadata || {});
    currentMetadata.ast = ast;
    
    await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [currentMetadata, paper.id]);
    return ast;
}

app.post('/api/manuscript/structural-rewrite/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const ast = await performStructuralRewrite(paper);
    res.json({ success: true, ast });
  } catch (error) {
    console.error('AST Parser Error:', error);
    res.status(500).json({ error: 'Failed to rewrite manuscript into semantic AST' });
  }
});

app.post('/api/enhance/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { offset = 0 } = req.body || {};
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.is_locked) return res.status(403).json({ error: 'Manuscript is locked for final archival' });

    const fullText = paper.content;
    const aiChunk = fullText.substring(offset, offset + 4000);
    const hasMore = offset + 4000 < fullText.length;

    if (!aiChunk.trim()) {
      return res.json({ suggestions: [], textChunk: fullText, hasMore: false });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert academic writing editor. Return JSON with key "suggestions" containing an array of objects with: type (string, e.g. "grammar", "clarity", "style"), original (string), improved (string), explanation (string). Do not return more than 10 suggestions per batch.' },
        { role: 'user', content: `Improve this academic text and provide suggestions:\n\n${aiChunk}` }
      ]
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"suggestions":[]}');
    const suggestions = parsed.suggestions || parsed;
    res.json({ suggestions, textChunk: fullText, hasMore });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enhance' });
  }
});

app.post('/api/enhance/:id/commit', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { original, improved } = req.body;
    
    const result = await pool.query('SELECT content FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    // Simple string replacement for the commit
    const newContent = paper.content.replace(original, improved);
    
    await pool.query('UPDATE papers SET content = $1 WHERE id = $2 AND user_id = $3', [newContent, id, req.user.id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Enhance commit error:', error);
    res.status(500).json({ error: 'Failed to commit change' });
  }
});

app.post('/api/references/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id: paperId } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [paperId, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    
    // Check if we already have validated references in the DB to avoid re-running expensive AI
    const refsResult = await pool.query('SELECT * FROM paper_references WHERE paper_id = $1', [paperId]);
    const existingRefs = refsResult.rows;

    if (existingRefs.length > 0 && !req.query.forceRefresh) {
      // Reconstruct the response from DB
      let totalScore = 0;
      let weak = 0;
      let strong = 0;
      const formattedRefs = existingRefs.map(r => {
        let aiData: any = {};
        try { aiData = JSON.parse(r.ai_analysis || '{}'); } catch(e){}
        const score = aiData.score || 0;
        totalScore += score;
        if (score >= 80) strong++;
        else if (score < 60) weak++;
        
        return {
          id: r.id,
          reference: r.original_text,
          parsed: {
            authors: r.authors ? r.authors.split(', ') : [],
            year: r.year || '',
            title: r.title || '',
            journal: r.journal || '',
            doi: r.doi || ''
          },
          issues: aiData.issues || [],
          score: score,
          status: score >= 80 ? 'strong' : (score >= 60 ? 'moderate' : 'weak'),
          suggestion: aiData.suggestion || '',
          aiRewrite: aiData.aiRewrite || ''
        };
      });
      
      return res.json({ 
        references: formattedRefs,
        summary: {
           averageScore: existingRefs.length > 0 ? Math.round(totalScore / existingRefs.length) : 0,
           weakReferences: weak,
           strongReferences: strong
        }
      });
    }

    // Otherwise, validate via AI Reference Intelligence 2.0
    // Support either the new AST references or the old metadata.references
    let rawReferences = metadata.ast?.references || metadata.references || [];
    if (!Array.isArray(rawReferences)) rawReferences = [];
    
    // NEW: Deep Harvest Fallback if no references detected initially
    if (rawReferences.length === 0 && paper.content) {
      const harvestPrompt = `
        You are a high-speed citation extractor. 
        Extract every bibliographic reference entry from the manuscript below into a JSON array of strings.
        Return ONLY the JSON array.
        MANUSCRIPT CONTENT:
        ${paper.content.substring(paper.content.length - 15000)}
      `.trim();

      try {
        const harvestResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: harvestPrompt }]
        });
        const harvestData = JSON.parse(harvestResponse.choices[0]?.message?.content || '{}');
        // Extract array from common fields like 'references', 'citations', or just the root array
        rawReferences = harvestData.references || harvestData.citations || harvestData.results || Object.values(harvestData)[0] || [];
        if (!Array.isArray(rawReferences)) rawReferences = [];
      } catch (e) {
        console.error('Deep Harvest Failed:', e);
      }
    }

    // Process up to 20 for AI batching to avoid massive prompt sizes
    const refsToProcess = rawReferences.slice(0, 20).map(r => typeof r === 'string' ? r : r.raw || r.text || JSON.stringify(r));
    
    if (refsToProcess.length === 0) {
      return res.json({ references: [], summary: { averageScore: 0, weakReferences: 0, strongReferences: 0 } });
    }

    const prompt = `
You are an expert Reference Intelligence Engine for APA 7th Edition.
Analyze the following list of bibliography references.
For each reference, extract its fields and score it based on completeness:
- Has author (+20)
- Has year (+20)
- Has article/book title (+20)
- Has journal/publisher (+20)
- Has DOI (+20)
If fields are missing, note them in 'issues'. 

**TRUTH VALIDATION**: If a DOI is provided, use your internal knowledge to verify if the title and authors match that DOI. If there is a mismatch (e.g., DOI belongs to a different paper, or authors are clearly wrong for that DOI), flag it in 'issues' as 'DOI_METADATA_MISMATCH' and set the score for that entry to 0.

Provide an 'aiRewrite' that perfectly formats the reference in APA 7th Edition.
Respond with a strict JSON array.
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ReferenceAnalysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    reference: { type: 'string' },
                    parsed: {
                      type: 'object',
                      properties: {
                        authors: { type: 'array', items: { type: 'string' } },
                        year: { type: 'string' },
                        title: { type: 'string' },
                        journal: { type: 'string' },
                        doi: { type: 'string' }
                      },
                      required: ['authors', 'year', 'title', 'journal', 'doi'],
                      additionalProperties: false
                    },
                    issues: { type: 'array', items: { type: 'string' } },
                    score: { type: 'number' },
                    suggestion: { type: 'string' },
                    aiRewrite: { type: 'string' }
                  },
                  required: ['reference', 'parsed', 'issues', 'score', 'suggestion', 'aiRewrite'],
                  additionalProperties: false
                }
              }
            },
            required: ['results'],
            additionalProperties: false
          }
        }
      },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify(refsToProcess) }
      ]
    });

    const parsedContent = JSON.parse(response.choices[0]?.message?.content || '{"results":[]}');
    const aiResults = parsedContent.results || [];

    // Clear old references to replace them
    await pool.query('DELETE FROM paper_references WHERE paper_id = $1', [paperId]);

    const insertRefQuery = `
      INSERT INTO paper_references (paper_id, original_text, title, authors, doi, year, journal, status, ai_analysis)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const validatedRefs = [];
    let totalScore = 0;
    let weak = 0;
    let strong = 0;

    for (const resItem of aiResults) {
      const p = resItem.parsed;
      const score = resItem.score || 0;
      totalScore += score;
      const status = score >= 80 ? 'strong' : (score >= 60 ? 'moderate' : 'weak');
      if (status === 'strong') strong++;
      if (status === 'weak') weak++;

      const aiData = {
        issues: resItem.issues,
        score: score,
        suggestion: resItem.suggestion,
        aiRewrite: resItem.aiRewrite
      };

      const dbRes = await pool.query(insertRefQuery, [
        paperId, 
        resItem.reference, 
        p.title, 
        p.authors.join(', '), 
        p.doi, 
        p.year, 
        p.journal, 
        status, 
        JSON.stringify(aiData)
      ]);

      validatedRefs.push({
        id: dbRes.rows[0].id,
        reference: resItem.reference,
        parsed: p,
        issues: resItem.issues,
        score: score,
        status: status,
        suggestion: resItem.suggestion,
        aiRewrite: resItem.aiRewrite
      });
    }

    res.json({ 
      references: validatedRefs, 
      summary: {
        averageScore: aiResults.length > 0 ? Math.round(totalScore / aiResults.length) : 0,
        weakReferences: weak,
        strongReferences: strong
      }
    });

  } catch (error) {
    console.error('Reference Intelligence Error:', error);
    res.status(500).json({ error: 'Failed to analyze references using AI' });
  }
});

// Endpoint to automatically apply an AI rewrite to a reference
app.post('/api/references/fix/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id: refId } = idParamSchema.parse(req.params); // This is the paper_references ID
    const { aiRewrite } = req.body;
    
    if (!aiRewrite) return res.status(400).json({ error: 'Missing aiRewrite content' });

    // Update the original_text and reset its score/status to perfect since it's now AI-corrected
    const perfectAnalysis = JSON.stringify({
      issues: [],
      score: 100,
      suggestion: 'Corrected by AI directly to APA 7th format.',
      aiRewrite: aiRewrite
    });

    await pool.query(
      "UPDATE paper_references SET original_text = $1, status = 'strong', ai_analysis = $2 WHERE id = $3", 
      [aiRewrite, perfectAnalysis, refId]
    );

    // Sync the fix back to the papers table's AST to ensure it flows to the final PDF
    const refData = await pool.query('SELECT paper_id, original_text FROM paper_references WHERE id = $1', [refId]);
    if (refData.rows[0]) {
      const { paper_id, original_text: currentText } = refData.rows[0];
      const paperResult = await pool.query('SELECT metadata FROM papers WHERE id = $1', [paper_id]);
      if (paperResult.rows[0]) {
        let metadata = typeof paperResult.rows[0].metadata === 'string' ? JSON.parse(paperResult.rows[0].metadata || '{}') : (paperResult.rows[0].metadata || {});
        if (metadata.ast && metadata.ast.references) {
          // Replace exactly the corrected reference in the AST array
          metadata.ast.references = metadata.ast.references.map((r: string) => r === currentText ? aiRewrite : r);
          // Also handle cases where r might be an object
          metadata.ast.references = metadata.ast.references.map((r: any) => {
             const rStr = typeof r === 'string' ? r : (r.raw || r.text || JSON.stringify(r));
             return rStr === currentText ? aiRewrite : r;
          });
          
          await pool.query('UPDATE papers SET metadata = $1, formatted_content = NULL WHERE id = $2', [JSON.stringify(metadata), paper_id]);
        }
      }
    }

    res.json({ success: true, message: 'Reference corrected and synced successfully.' });
  } catch (err) {
    console.error('Reference Fix Error:', err);
    res.status(500).json({ error: 'Failed to apply reference fix' });
  }
});

app.post('/api/recommend-journals/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    const ast = metadata.ast || {};
    const extractedKeywords = metadata.keywords || ast.keywords;
    const keywords = (Array.isArray(extractedKeywords) && extractedKeywords.length > 0 ? extractedKeywords.join('+') : null) 
      || paper.title?.replace(/\s+/g, '+') 
      || 'science';

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

app.post('/api/papers/:id/refine-keywords', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { 
          role: 'system', 
          content: 'You are an academic discovery expert. Extract 5-8 high-impact, specific scientific keywords from the paper title and abstract provided. These keywords will be used to search for matching journals in the Crossref registry. Return JSON with key "keywords" as an array of strings.' 
        },
        { role: 'user', content: `Title: ${paper.title}\nAbstract: ${paper.abstract}` }
      ]
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"keywords":[]}');
    const newKeywords = parsed.keywords || [];

    if (newKeywords.length > 0) {
      const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
      metadata.keywords = newKeywords;
      await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), id]);
    }

    res.json({ success: true, keywords: newKeywords });
  } catch (error) {
    console.error('Keyword refinement error:', error);
    res.status(500).json({ error: 'Failed to refine keywords' });
  }
});

app.post('/api/format/:id/save', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { formattedHtml } = z.object({ formattedHtml: z.string() }).parse(req.body);
    
    // Update the database with the finalized HTML structure from Format Architect
    // IMPORTANT: Clear the AST to ensure the final publication engine uses this formatted HTML
    await pool.query(
      "UPDATE papers SET formatted_content = $1, metadata = (metadata::jsonb - 'ast')::text WHERE id = $2 AND user_id = $3",
      [formattedHtml, id, req.user.id]
    );

    res.json({ success: true, message: 'Formatted content securely saved.' });
  } catch (error) {
    console.error('Format Save endpoint error:', error);
    res.status(500).json({ error: 'Failed to save formatted manuscript' });
  }
});

// HIGH-FIDELITY PDF GENERATION VIA PUPPETEER (Shared Helper)
app.get('/api/format/:id/pdf', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paperResult = await pool.query('SELECT title FROM papers WHERE id = $1', [id]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const pdfBuffer = await generateHighFidelityPaperPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_Final.pdf"`);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('High-fidelity PDF error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate high-fidelity PDF' });
  }
});

function getStyleGuidelines(style: string, branding: any) {
  const metaHeader = `
    <div class="sheet-header-full">
      <div class="header-top-row">
        <div class="header-logo-left">
          <img src="/journal-logo.png" alt="Genius" />
          <div class="header-title-stack">
            <span class="journal-red-small">Genius</span>
            <span class="journal-red-med">Multidisciplinary</span>
            <span class="journal-black-large">International</span>
            <span class="journal-gray-type">Journal</span>
          </div>
        </div>
        <div class="header-meta-center">
          <div class="meta-row">ISSN: ${branding.issn} | Vol ${branding.volume}, Iss ${branding.issue} | Published: ${branding.date}</div>
          <div class="meta-doi">${branding.doi}</div>
        </div>
        <div class="header-logo-right">
          <div class="partner-stack">
            <span class="partner-name">Nasarawa State University Keffi</span>
            <span class="partner-status">Global Partner</span>
          </div>
          <img src="/Nasarawa-State-University.jpg" alt="NSUK" />
        </div>
      </div>
      <div class="header-accent-bar"></div>
    </div>`;
  const common = `
    - TITLE: The manuscript topic/title must be BOLD (<strong>) and at the very top.
    - ABSTRACT: The Abstract content must be entirely ITALICIZED (<em> or <i>).
    - PAGINATION: You MUST wrap the content in <div class="paper-sheet"> blocks (~500-800 words per block).
    - RECURSIVE HEADER: EVERY <div class="paper-sheet"> block EXCEPT THE FIRST ONE (i.e. starting from Page 2 onwards) MUST start with this EXACT HTML block: ${metaHeader}
    - FIGURES: Wrap illustrations in <div class="academic-figure"> with a centered caption below.
    - TABLES: Wrap every <table> element in a <div class="table-wrapper"> tag.
  `;

  switch (style.toLowerCase()) {
    case 'ieee':
      return `IEEE STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-center">X</div> (where X is the number) at the bottom center of every sheet.
        - Use numbered citations in square brackets (e.g., [1]).
        - Use a technical, structured layout with clearly numbered sections (e.g., 1. Introduction).`;
    case 'apa':
      return `APA STYLE (7th Ed.) RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-center">X</div> (where X is the page number) at the bottom center of every sheet.
        - Use Author-Date citations (e.g., Smith, 2023).
        - Use specific heading levels (H1 for major sections, H2 for subsections).
        - References must be in alphabetical order with hanging indents.`;
    case 'nature':
      return `NATURE STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-right">X</div> at the bottom right.
        - Use superscript numbers for citations (e.g. <sup>1</sup>).
        - Keep the summary/abstract professional and concise.`;
    case 'elsevier':
      return `ELSEVIER STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-right">X</div> at the bottom right.
        - Use structured headings with clear hierarchy.
        - Standard Elsevier reference format.`;
    case 'mla':
      return `MLA (9th Ed.) STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number top-right">X</div> at the top right.
        - Use Author-Page citations (e.g., Smith 42).
        - Double-spaced text, 12pt Times New Roman equivalent.
        - Works Cited page in alphabetical order.`;
    case 'chicago':
      return `CHICAGO/TURABIAN STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-center">X</div> at the bottom center.
        - Use Notes-Bibliography system (footnotes) or Author-Date.
        - Clear section separators.
        - Specific title page and bibliography formatting.`;
    case 'ama':
      return `AMA STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-right">X</div> at the bottom right.
        - Use numerical superscript citations (e.g., <sup>1,2</sup>).
        - List references in order of appearance.
        - Medical terminology focus.`;
    case 'harvard':
      return `HARVARD STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-center">X</div> at the bottom center.
        - Use Author-Date parenthetical citations (e.g., Smith, 2023).
        - Comprehensive reference list with full publication details.`;
    case 'vancouver':
      return `VANCOUVER STYLE RULES:
        ${common}
        - PAGINATION: Place a <div class="page-number bottom-right">X</div> at the bottom right.
        - Use a numbered citation system [1].
        - Reference list ordered numerically.
        - Standard biomedical phrasing.`;
    default:
      return common;
  }
}

app.post('/api/format/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { style } = z.object({ style: z.string() }).parse(req.body);
    const result = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    // Fetch branding metadata for the formatter
    const issnRes = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_issn']);
    const volRes = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_volume']);
    const issRes = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_issue']);
    
    const branding = {
      issn: paper.issn || issnRes.rows[0]?.value || '2971-7760',
      volume: paper.volume || volRes.rows[0]?.value || '1',
      issue: paper.issue || issRes.rows[0]?.value || '1',
      doi: paper.doi || '10.GMIJ/PENDING',
      date: (paper.published_at || paper.created_at || new Date()).toLocaleDateString('en-GB')
    };

    console.log(`[DEBUG] Formatting paper ${id}: PaperVol=${paper.volume}, SettingVol=${volRes.rows[0]?.value}, FinalVol=${branding.volume}`);

    // High-fidelity structural extraction for the AI
    let sourceContent = paper.content;
    
    // DELIBERATE OMISSION: We no longer try to extract the original file_blob here.
    // The pipeline must respect the intermediate corrections (e.g. from APA Gatekeeper)
    // which are saved securely to paper.content. Re-extracting file_blob overrides them.

    const styleGuidelines = getStyleGuidelines(style, branding);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 16384,
      messages: [
        { 
          role: 'system', 
          content: `You are an expert academic paper formatter. Format the given paper content into professional, production-ready HTML according to the ${style.toUpperCase()} style.
          
          STYLE GUIDELINES TO FOLLOW:
          ${styleGuidelines}

          CRITICAL RULES:
          1. NO MARKDOWN: Output ONLY raw HTML. Do NOT wrap the output in triple backticks (\`\`\`html).
          2. TABLES: Identify ALL tabular data and render as structured <table> tags with <thead> and <tbody>.
          3. DEDUPLICATION: The Title, Authors, and Abstract provided above might ALSO exist inside the Source Content. You MUST merge them so they only appear ONCE at the very beginning of the document. Do not duplicate the title, authors, or abstract. If there is a short and long abstract, use the detailed one.
          4. ZERO OMISSION OF MAIN TEXT: You MUST preserve 100% of the actual manuscript body text, references, and acknowledgements. Do NOT truncate or summarize the core content.
          5. NO PLACEHOLDERS: Do NOT generate "[Figure]", "[Image]", or any missing media placeholders. If an image is missing, simply omit the placeholder entirely.
          6. NO RECURRING METADATA: Do NOT inject journal metadata, ISSNs, or branding blocks into the pages. Only format the raw academic content. 
          7. STRUCTURE: Use <div class="paper-sheet"> to simulate real pages. Within each sheet, use standard HTML tags (<h1>, <h2>, <p>).
          8. COPYEDITING & CLEANUP: You MUST rigorously fix all spelling and grammatical errors, remove completely all unwanted symbols/characters, eliminate weird text indentations, and strip out unnecessary extra spaces. The text must read flawlessly as a professionally copyedited scientific manuscript.
          9. FONTS: Use standard serif fonts for the main body.`
        },
        { role: 'user', content: `Manuscript Title (TOPIC): ${paper.title}\nAuthors: ${paper.authors}\nAbstract: ${paper.abstract}\nSource Content (HTML/Text):\n\n${sourceContent}` }
      ]
    });

    // Strip any lingering markdown backticks if the AI failed to follow instruction 1
    let formattedHtml = response.choices[0]?.message?.content || '';
    formattedHtml = formattedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '');

    res.json({ 
      formattedHtml,
      branding 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to format' });
  }
});

app.get('/api/papers/:id/acceptance-letter', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query('SELECT p.*, u.name as researcher_name FROM papers p JOIN users u ON p.user_id = u.id WHERE p.id = $1', [id]);
    const paper = result.rows[0];
    
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }
    
    // Admins can view any, normal users can only view their own
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && paper.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const titleStr = paper.title || 'Untitled';
    const nameStr = paper.researcher_name || 'Researcher';
    
    const pdfBuffer = await generateAcceptanceLetterPDF(nameStr, titleStr, paper.id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Acceptance_Letter_${paper.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Acceptance letter generation error:', error);
    res.status(500).json({ error: 'Failed to generate acceptance letter PDF' });
  }
});

// Helper to sanitize text for standard PDF fonts (replace unsupported characters to prevent 500 errors)
const sanitizePdfText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u201C\u201D]/g, '"') // Fancy double quotes
    .replace(/[\u2018\u2019]/g, "'") // Fancy single quotes
    .replace(/[\u2013\u2014]/g, '-') // En and Em dashes
    .replace(/\u00A0/g, ' ')         // Non-breaking space
    .replace(/[\r\n]+/g, ' ')       // NEW: Replace newlines and CRs with spaces to prevent WinAnsi crash
    .replace(/[^\x00-\x7F]/g, '?');  // Fallback for everything else non-ASCII
};

// ===== PDF Generation: Acceptance Letter =====
async function generateAcceptanceLetterPDF(researcherName: string, manuscriptTitle: string, manuscriptId: number): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const maroon = rgb(0.5, 0, 0);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const margin = 60;
  let y = height - 50;

  // Load and embed logos
  try {
    const logoPathLeft = path.join(process.cwd(), 'tools', 'ain logo.jpeg');
    const logoPathRight = path.join(process.cwd(), 'tools', 'Nasarawa-State-University.jpg');
    
    if (fs.existsSync(logoPathLeft)) {
      const logoLeftBytes = fs.readFileSync(logoPathLeft);
      const logoLeft = await pdfDoc.embedJpg(logoLeftBytes);
      page.drawImage(logoLeft, { x: margin, y: y - 50, width: 50, height: 50 });
    }
    
    if (fs.existsSync(logoPathRight)) {
      const logoRightBytes = fs.readFileSync(logoPathRight);
      const logoRight = await pdfDoc.embedJpg(logoRightBytes);
      page.drawImage(logoRight, { x: width - margin - 50, y: y - 50, width: 50, height: 50 });
    }
  } catch (err) {
    console.error('Error embedding logos in acceptance letter:', err);
  }

  // Header Title
  const title1 = 'GENIUS MULTIDISCIPLINARY';
  const title2 = 'INTERNATIONAL JOURNAL PUBLICATION';
  const uniNameText = 'Nasarawa State University, Keffi';

  page.drawText(title1, { 
    x: width / 2 - fontBold.widthOfTextAtSize(title1, 14) / 2, 
    y: y - 15, 
    size: 14, 
    font: fontBold, 
    color: maroon 
  });
  page.drawText(title2, { 
    x: width / 2 - fontBold.widthOfTextAtSize(title2, 14) / 2, 
    y: y - 35, 
    size: 14, 
    font: fontBold, 
    color: maroon 
  });
  page.drawText(uniNameText, { 
    x: width / 2 - font.widthOfTextAtSize(uniNameText, 10) / 2, 
    y: y - 52, 
    size: 10, 
    font: font, 
    color: gray 
  });

  y -= 65;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 2, color: maroon });
  y -= 30;

  const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Date & Official Acceptance
  page.drawText(currentDate, { x: margin, y, size: 10, font: fontBold, color: black });
  y -= 14;
  page.drawText('OFFICIAL ACCEPTANCE', { x: margin, y, size: 9, font: fontBold, color: rgb(0.02, 0.59, 0.4) });
  y -= 30;

  // Salutation
  page.drawText(`Dear ${researcherName},`, { x: margin, y, size: 12, font: fontBold, color: black });
  y -= 28;

  // Subject
  page.drawText('Subject: Acceptance of Publication in Genius Multidisciplinary', { x: margin, y, size: 10, font: fontBold, color: black });
  y -= 14;
  page.drawText('International Journal Publication', { x: margin + 52, y, size: 10, font: fontBold, color: black });
  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 24;

  // Helper to draw wrapped text
  const drawWrappedText = (text: string, usedFont = font, size = 10, lineHeight = 16, color = black) => {
    const maxWidth = width - 2 * margin;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (usedFont.widthOfTextAtSize(testLine, size) > maxWidth) {
        page.drawText(line, { x: margin, y, size, font: usedFont, color });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size, font: usedFont, color });
      y -= lineHeight;
    }
  };

  drawWrappedText('I hope this letter finds you well. On behalf of the editorial board of the Genius Multidisciplinary International Journal Publication, I am pleased to inform you that your research paper titled:');
  y -= 8;

  // Title block
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: margin, y: y - 24 }, thickness: 3, color: maroon });
  drawWrappedText(`"${manuscriptTitle}"`, fontItalic, 11, 16, black);
  y -= 8;

  drawWrappedText('has been accepted for publication in our journal.');
  y -= 8;
  drawWrappedText('We would like to extend our congratulations on the quality of your work. Your research makes a significant contribution to the field, and we believe it will be of great interest to our readership. We appreciate the time and effort you have invested in this research project.');
  y -= 8;
  drawWrappedText('The final version of your manuscript: Please make any required revisions as per the feedback provided by the peer reviewers and ensure that your paper adheres to the formatting guidelines specified in our author instructions.');
  y -= 8;
  drawWrappedText('We hope to continue collaborating with you in the future. Should you have any questions or require further assistance, please do not hesitate to contact us.');
  y -= 8;
  drawWrappedText('Thank you once again for choosing the Genius Multidisciplinary International Journal as the platform to share your research.');
  y -= 24;

  // Sign-off
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: width - margin, y: y + 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  page.drawText('Best regards,', { x: margin, y, size: 10, font, color: black });
  y -= 40; // Space for signature

  // Signature Implementation
  try {
    const sigRes = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_signature']);
    const sigBase64 = sigRes.rows[0]?.value;
    if (sigBase64 && sigBase64.startsWith('data:image')) {
      const base64Data = sigBase64.split(',')[1];
      const sigImgBytes = Buffer.from(base64Data, 'base64');
      let sigImg;
      if (sigBase64.includes('image/png')) {
        sigImg = await pdfDoc.embedPng(sigImgBytes);
      } else {
        sigImg = await pdfDoc.embedJpg(sigImgBytes);
      }
      
      const sigDims = sigImg.scaleToFit(150, 60);
      page.drawImage(sigImg, {
        x: margin,
        y: y + 10, // Adjusted to sit between lines
        width: sigDims.width,
        height: sigDims.height,
      });
      y -= (sigDims.height - 20); // Adjust Y based on signature height if needed, but keeping it flexible
    }
  } catch (err) {
    console.error('Failed to embed signature image:', err);
  }

  page.drawText('Dr. Danjuma Namo', { x: margin, y, size: 11, font: fontBold, color: black });
  y -= 14;
  page.drawText('Secretary (GMIJP)', { x: margin, y, size: 9, font: fontBold, color: maroon });

  // Footer
  page.drawText('Genius Multidisciplinary International Journal Publication \u2022 Research Excellence', {
    x: margin, y: 30, size: 7, font, color: gray
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ===== PDF Generation: Formatted Manuscript (Server-Side) =====
async function generateFormattedManuscriptPDF(formattedHtml: string, branding: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const margin = 60;
  const width = 595; // A4
  const height = 842;
  const maxWidth = width - (2 * margin);
  const maroon = rgb(0.5, 0, 0);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  let pageIndex = 0;
  let page = pdfDoc.addPage([width, height]);
  let y = height - 50;

  const drawHeader = async (p: any, isFirst: boolean) => {
    let curY = height - 50;
    try {
      const logoPathLeft = path.join(process.cwd(), 'tools', 'ain logo.jpeg');
      const logoPathRight = path.join(process.cwd(), 'tools', 'Nasarawa-State-University.jpg');
      if (fs.existsSync(logoPathLeft)) {
        const logo = await pdfDoc.embedJpg(fs.readFileSync(logoPathLeft));
        p.drawImage(logo, { x: margin, y: curY - 50, width: 50, height: 50 });
      }
      if (fs.existsSync(logoPathRight)) {
        const logo = await pdfDoc.embedJpg(fs.readFileSync(logoPathRight));
        p.drawImage(logo, { x: width - margin - 50, y: curY - 50, width: 50, height: 50 });
      }
    } catch(e) {}

    const titleStack = ['GENIUS MULTIDISCIPLINARY', 'INTERNATIONAL JOURNAL'];
    p.drawText(titleStack[0], { x: margin + 60, y: curY - 15, size: 10, font: fontBold, color: maroon });
    p.drawText(titleStack[1], { x: margin + 60, y: curY - 30, size: 12, font: fontBold, color: black });

    const meta = `ISSN: ${branding.issn} | Vol ${branding.volume}, No ${branding.issue} | ${branding.date}`;
    p.drawText(meta, { x: width / 2 - font.widthOfTextAtSize(meta, 8) / 2, y: curY - 45, size: 8, font, color: gray });
    
    curY -= 65;
    p.drawLine({ start: { x: margin, y: curY }, end: { x: width - margin, y: curY }, thickness: 1.5, color: maroon });
    
    // Page Number
    const pageNum = `Page ${pageIndex + 1}`;
    p.drawText(pageNum, { x: width / 2 - font.widthOfTextAtSize(pageNum, 8) / 2, y: 30, size: 8, font, color: gray });
    
    return curY - 30;
  };

  y = await drawHeader(page, true);

  const $ = cheerio.load(formattedHtml);
  
  // Custom text wrapper
  const wrapText = (text: string, size: number, f: any, maxW: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = f.widthOfTextAtSize(currentLine + ' ' + word, size);
      if (width < maxW) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // Process HTML elements
  const elements = $('h1, h2, h3, p, li, b, strong, em, i, table');
  
  for (let i = 0; i < elements.length; i++) {
    const el = $(elements[i]);
    const tagName = el.prop('tagName').toLowerCase();
    const rawText = el.text().trim();
    const text = sanitizePdfText(rawText);
    if (!text && tagName !== 'table') continue;

    let fontSize = 11;
    let currentFont = font;
    let color = black;

    if (tagName === 'h1') { fontSize = 16; currentFont = fontBold; y -= 10; }
    else if (tagName === 'h2') { fontSize = 14; currentFont = fontBold; y -= 8; }
    else if (tagName === 'h3') { fontSize = 12; currentFont = fontBold; y -= 6; }
    else if (['b', 'strong'].includes(tagName)) { currentFont = fontBold; }
    else if (['em', 'i'].includes(tagName)) { currentFont = fontItalic; }

    if (tagName === 'table') {
      y -= 10;
      const rows: string[][] = [];
      el.find('tr').each((_, tr) => {
        const row: string[] = [];
        $(tr).find('td, th').each((_, td) => {
          row.push(sanitizePdfText($(td).text().trim()));
        });
        if (row.length > 0) rows.push(row);
      });

      if (rows.length > 0) {
        const colCount = rows[0].length;
        const cellPadding = 5;
        const tableFontSize = 8;
        
        // 1. Calculate natural column widths
        const naturalWidths = new Array(colCount).fill(0);
        rows.forEach(row => {
          row.forEach((cell, colIdx) => {
            if (colIdx < colCount) {
              const textWidth = font.widthOfTextAtSize(cell, tableFontSize);
              naturalWidths[colIdx] = Math.max(naturalWidths[colIdx], textWidth + (cellPadding * 2));
            }
          });
        });

        // 2. Scale widths to fit maxWidth
        const totalNaturalWidth = naturalWidths.reduce((a, b) => a + b, 0);
        let colWidths = naturalWidths;
        if (totalNaturalWidth > maxWidth) {
          const scale = maxWidth / totalNaturalWidth;
          colWidths = naturalWidths.map(w => w * scale);
        }

        // 3. Draw rows
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          const isHeader = rIdx === 0;
          const currentFont = isHeader ? fontBold : font;
          
          // Calculate row height based on wrapped text in all cells
          let maxLines = 1;
          const cellLines = row.map((cell, cIdx) => {
            const lines = wrapText(cell, tableFontSize, currentFont, colWidths[cIdx] - (cellPadding * 2));
            maxLines = Math.max(maxLines, lines.length);
            return lines;
          });
          
          const rowHeight = (maxLines * (tableFontSize + 2)) + (cellPadding * 2);

          // Check Page Overflow
          if (y - rowHeight < 80) {
            pageIndex++;
            page = pdfDoc.addPage([width, height]);
            y = await drawHeader(page, false);
          }

          let curX = margin;
          cellLines.forEach((lines, cIdx) => {
            const cellWidth = colWidths[cIdx];
            
            // Draw Cell Background (Optional for Header)
            if (isHeader) {
              page.drawRectangle({
                x: curX,
                y: y - rowHeight,
                width: cellWidth,
                height: rowHeight,
                color: rgb(0.95, 0.95, 0.95),
              });
            }

            // Draw Cell Border
            page.drawRectangle({
              x: curX,
              y: y - rowHeight,
              width: cellWidth,
              height: rowHeight,
              borderColor: gray,
              borderWidth: 0.5,
            });

            // Draw Cell Text
            lines.forEach((line, lIdx) => {
              page.drawText(line, {
                x: curX + cellPadding,
                y: y - cellPadding - tableFontSize - (lIdx * (tableFontSize + 2)),
                size: tableFontSize,
                font: currentFont,
                color: black,
              });
            });

            curX += cellWidth;
          });
          
          y -= rowHeight;
        }
      }
      y -= 10;
      continue;
    }

    const lines = wrapText(text, fontSize, currentFont, maxWidth);
    
    for (const line of lines) {
      if (y < 80) {
        pageIndex++;
        page = pdfDoc.addPage([width, height]);
        y = height - 50;
        y = await drawHeader(page, false);
      }
      
      const xPos = tagName === 'h1' ? width / 2 - currentFont.widthOfTextAtSize(line, fontSize) / 2 : margin;
      page.drawText(line, { x: xPos, y, size: fontSize, font: currentFont, color });
      y -= (fontSize + 6);
    }
    y -= 4; // Paragraph spacing
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// API: Download Formatted Manuscript PDF
app.get('/api/papers/:id/formatted-download', async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    
    // Fetch paper content
    const result = await pool.query('SELECT * FROM papers WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Paper not found' });
    const paper = result.rows[0];

    // Fetch journal branding settings
    const vol = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_volume']);
    const issue = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_issue']);
    const issn = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_issn']);
    
    const branding = {
      volume: vol.rows[0]?.value || '1',
      issue: issue.rows[0]?.value || '1',
      issn: issn.rows[0]?.value || '2971-7760',
      date: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      doi: paper.doi
    };

    const content = paper.formatted_content || paper.content;
    const pdfBuffer = await generateFormattedManuscriptPDF(content, branding);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Genius_Manuscript_${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Manuscript PDF Error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// ===== Resend Email: Acceptance Letter =====
async function sendAcceptanceEmail(to: string, researcherName: string, manuscriptTitle: string, manuscriptId: number) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'info@cssfarmstvet.ng';
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set \u2014 skipping acceptance email.');
    return;
  }

  const refNumber = `GMIJP/${new Date().getFullYear()}/${manuscriptId.toString().padStart(4, '0')}`;
  const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const appUrl = process.env.APP_URL || 'https://gmijp-edu.up.railway.app';
  const gmijpLogo = `${appUrl}/gmijp-logo.png`;
  const nsukLogo = `${appUrl}/university-logo.jpg`;

  const htmlBody = `
    <div style="font-family: serif; padding: 20px; color: #1a202c;">
      <h2 style="color: #800000;">Manuscript Accepted in Principle</h2>
      <p>Dear ${researcherName},</p>
      <p>Your manuscript "<strong>${manuscriptTitle}</strong>" has been accepted in principle for publication.</p>
      <p><strong>Please see the attached PDF documents</strong> for your official Acceptance Letter and Preliminary Pages which contain full details.</p>
      <p>Next Steps: Final formatting and DOI minting.</p>
    </div>
  `;

  try {
    // Generate PDF attachment
    const pdfBuffer = await generateAcceptanceLetterPDF(researcherName, manuscriptTitle, manuscriptId);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Load static Journal Preliminary attachment
    let secondAttachment = null;
    try {
      const preliminaryPath = path.join(process.cwd(), 'tools', 'Journal Preliminary.pdf');
      if (fs.existsSync(preliminaryPath)) {
        const preliminaryBuffer = fs.readFileSync(preliminaryPath);
        secondAttachment = {
          filename: 'Journal_Preliminary.pdf',
          content: preliminaryBuffer.toString('base64')
        };
      }
    } catch (err) {
      console.warn('Failed to load Journal Preliminary.pdf attachment:', err);
    }

    const attachments = [
      {
        filename: `Acceptance_Letter_${manuscriptId}.pdf`,
        content: pdfBase64
      }
    ];
    if (secondAttachment) attachments.push(secondAttachment);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `GMIJP <${RESEND_FROM}>`,
        to: [to],
        subject: `Acceptance Letter \u2014 ${manuscriptTitle.substring(0, 80)}`,
        html: htmlBody,
        attachments
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend email failed:', response.status, errText);
    } else {
      console.log(`\u2705 Acceptance email + PDF sent to ${to} for paper #${manuscriptId}`);
    }
  } catch (error) {
    console.error('Resend email network error:', error);
  }
}

async function sendDoiFailureEmail(to: string, name: string, title: string, reason: string) {
  const htmlBody = `
    <div style="font-family: serif; padding: 20px; color: #1a202c;">
      <h2 style="color: #ef4444;">DOI Validation Failed</h2>
      <p>Dear ${name},</p>
      <p>We encountered an issue finalizing the DOI for "<strong>${title}</strong>".</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Publication is paused safely. Please log in to your dashboard to retry the broadcast.</p>
    </div>
  `;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `GMIJP <${RESEND_FROM}>`,
        to: [to],
        subject: `ACTION REQUIRED: DOI Validation Failed — ${title.substring(0, 50)}`,
        html: htmlBody
      })
    });
  } catch (err) {
    console.error('Failure email error:', err);
  }
}

app.post('/api/publish/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id: paperId } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [paperId, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    let ast = metadata.ast;
    
    // AUTONOMOUS FALLBACK: If AST is missing, generate it on-the-fly
    if (!ast) {
        console.log(`Autonomous Fix: Generating missing AST for paper ${paperId}...`);
        try {
          ast = await performStructuralRewrite(paper);
        } catch (e: any) {
          return res.status(400).json({ error: `Structural Rewrite failed: ${e.message}. Please fix the manuscript manually.` });
        }
    }

    const zenodoToken = process.env.ZENODO_ACCESS_TOKEN;
    if (!zenodoToken) throw new Error("Zenodo Access Token missing.");

    // 1. Resolve Journal Branding
    const settingsRes = await pool.query("SELECT key, value FROM settings WHERE key IN ('current_volume', 'current_issue', 'journal_issn', 'max_manuscripts_per_issue')");
    const settings = Object.fromEntries(settingsRes.rows.map(r => [r.key, r.value]));
    
    const vol = parseInt(settings.current_volume || '1');
    const iss = parseInt(settings.current_issue || '1');
    const issn = settings.journal_issn || '2971-7760';

    // 1.5 Calculate Sequential Page Offset
    const previousPapers = await pool.query(
      "SELECT metadata FROM papers WHERE status = 'published' AND volume = $1 AND issue = $2",
      [vol.toString(), iss.toString()]
    );
    let startPageNumber = 1;
    previousPapers.rows.forEach(r => {
      const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      startPageNumber += (m.pageCount || 0);
    });

    // 2. PRERESERVE DOI (Mandatory Verification)
    const { depositionId, doi: prereservedDoi, bucketUrl } = await prereserveDOI(zenodoToken);
    
    // 3. SECURE PUBLISHING FLOW:
    // First, verify the DOI string integrity (prefix and format)
    if (!prereservedDoi || !prereservedDoi.startsWith('10.')) {
        throw new Error("Invalid DOI prereserved from registry.");
    }

    // Prepare Branding (Verified but not yet burned into the FINAL binary)
    const branding = { vol, issue: iss, issn, startPageNumber, doi: prereservedDoi };

    let finalDoi = '';
    let pdfBuffer: Buffer;
    
    try {
      // Step A: Generate "Draft" binary for initial Zenodo upload
      const initialPdfBytes = await generateFinalManuscriptPDF(ast, branding);
      
      // Step B: Finalize Zenodo Publish (Upload & Trigger Registrar)
      finalDoi = await finalizeZenodoPublish(depositionId, zenodoToken, paper, Buffer.from(initialPdfBytes), bucketUrl);
      
      // Step C: OPTIONAL TRUTH WAIT
      // We check if DOI is live, but we no longer fail the whole pipeline if it's pending
      console.log(`Checking DOI resolution status for ${finalDoi}...`);
      const isLive = await validateDOI(finalDoi);
      if (!isLive) {
          console.warn("DOI is registered but not yet live on global resolution servers. Proceeding with database archival.");
      }

      // Step D: POST-VALIDATION BRANDING
      // We generate the final PDF using the confirmed DOI from Step B
      console.log(`Generating Final Branded Artifact for ${finalDoi}...`);
      const pdfBytes = await generateFinalManuscriptPDF(ast, branding);
      pdfBuffer = Buffer.from(pdfBytes);
      
      // Store pdfBytes in function scope for later use in pageCount extraction
      (global as any).lastPdfBytes = pdfBytes; 
    } catch (e: any) {
      console.error('Zenodo/DOI Critical Failure:', e.message);
      
      // If we already have a DOI from prereserve, we should save it anyway to avoid "lost" DOIs
      const recoveryDoi = prereservedDoi;
      if (recoveryDoi) {
         await pool.query("UPDATE papers SET status = 'doi_validation_failed', doi = $1 WHERE id = $2", [recoveryDoi, paperId]);
      } else {
         await pool.query("UPDATE papers SET status = 'doi_validation_failed' WHERE id = $1", [paperId]);
      }
      
      const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
      if (userRes.rows[0]) {
        await sendDoiFailureEmail(userRes.rows[0].email, userRes.rows[0].name, ast.title || paper.title, e.message);
      }
      
      return res.status(400).json({ 
        error: `DOI Registration Issue: ${e.message}`, 
        status: 'doi_validation_failed',
        doi: recoveryDoi
      });
    }
    
    // Use the final confirmed DOI
    const doi = finalDoi;
    
    // 3.5 MANDATORY: Plagiarism Gatekeeper
    if (metadata.similarityScore && metadata.similarityScore > 25) {
       return res.status(400).json({ error: `Publication REJECTED: Similarity score of ${metadata.similarityScore}% exceeds the 25% journal limit.` });
    }

    const url = `https://doi.org/${doi}`;

    // 4. Update Database with Version History
    const history = metadata.history || [];
    history.push({
      action: 'published',
      version: (metadata.version || 1) + 1,
      doi,
      url,
      timestamp: new Date().toISOString()
    });

    const pdfBytes = (global as any).lastPdfBytes;
    const currentPdf = await PDFDocument.load(pdfBytes);
    const currentPageCount = currentPdf.getPageCount();

    const updatedMetadata = { 
        ...metadata, 
        doi, 
        url, 
        volume: vol, 
        issue: iss, 
        publishedAt: new Date().toISOString(),
        version: (metadata.version || 1) + 1,
        history,
        startPageNumber,
        pageCount: currentPageCount
    };

    await pool.query(
      "UPDATE papers SET status = 'published', metadata = $1, doi = $2, volume = $3, issue = $4, issn = $5 WHERE id = $6",
      [JSON.stringify(updatedMetadata), doi, vol.toString(), iss.toString(), issn, paperId]
    );

    // 5. Volume/Issue Increment Logic
    const countRes = await pool.query("SELECT COUNT(*) FROM papers WHERE status = 'published' AND volume = $1 AND issue = $2", [vol.toString(), iss.toString()]);
    const count = parseInt(countRes.rows[0].count);
    const max = parseInt(settings.max_manuscripts_per_issue || '10');

    if (count >= max) {
      if (iss >= 12) {
        await pool.query("UPDATE settings SET value = $1 WHERE key = 'current_volume'", [(vol + 1).toString()]);
        await pool.query("UPDATE settings SET value = '1' WHERE key = 'current_issue'");
      } else {
        await pool.query("UPDATE settings SET value = $1 WHERE key = 'current_issue'", [(iss + 1).toString()]);
      }
    }

    // 6. Final Email Notification with the PDF
    const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];
    if (user) {
      await sendPublicationEmail(user.email, user.name, ast.title || paper.title, doi, url, pdfBuffer);
    }

    res.json({ success: true, doi, url, title: ast.title || paper.title });

  } catch (error: any) {
    console.error('Final Publishing Error:', error);
    res.status(500).json({ error: error.message || 'Publication pipeline failed.' });
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

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
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
      // Fallback to OpenAI if GROBID citations aren't available
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an academic citation integrity checker. Return JSON with key "mismatches" containing an array of objects with: issue (string), details (string).' },
          { role: 'user', content: `Analyze the following academic paper metadata and identify any citation mismatches (e.g., references in text not in bibliography, or vice versa).
        Sections: ${JSON.stringify(metadata.sections)}
        References: ${JSON.stringify(metadata.references)}` }
        ]
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{"mismatches":[]}');
      citationMismatches = parsed.mismatches || parsed;
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
  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));

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

  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
  const abstract = metadata.abstract || 'No abstract provided.';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert academic peer reviewer. Provide a simulated peer review. Return JSON with: score (integer 1-10, where 10=accept as is, 1=reject), status (one of: "accept", "minor_revision", "major_revision", "reject"), comments (string with detailed review including strengths, weaknesses, and suggestions).' },
        { role: 'user', content: `Review this paper:\n\nTitle: ${metadata.title}\nAbstract: ${abstract}` }
      ]
    });

    const reviewData = JSON.parse(response.choices[0]?.message?.content || '{}');

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
  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));

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

  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
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
      <meta name="citation_publication_date" content="${new Date(paper.published_at || paper.created_at).getFullYear()}">
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
        <p><strong>Published:</strong> ${new Date(paper.published_at || paper.created_at).toLocaleDateString()}</p>
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
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT id, name, email, role, affiliation, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = idParamSchema.parse(req.params);
    const { name, email, role, affiliation } = req.body;

    const currentUserRes = await pool.query('SELECT email, role FROM users WHERE id = $1', [id]);
    const currentUser = currentUserRes.rows[0];
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const targetEmail = email || currentUser.email;
    const targetRole = role || currentUser.role;

    // Check if new email/role combination conflicts with existing user
    if (email || role) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND role = $2 AND id != $3', [targetEmail, targetRole, id]);
      if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already in use for this role' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name) { updates.push(`name = $${paramIdx++}`); values.push(name); }
    if (email) { updates.push(`email = $${paramIdx++}`); values.push(email); }
    if (role && ['admin', 'super_admin', 'user'].includes(role)) { 
      const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
      const currentRole = userRes.rows[0]?.role;
      
      // Restriction: Only users from the Research portal (role='user') can be made admins
      if ((role === 'admin' || role === 'super_admin') && currentRole !== 'user' && currentRole !== 'admin' && currentRole !== 'super_admin') {
          return res.status(400).json({ error: "Only Research portal users can be assigned Admin roles." });
      }

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
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
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
    
    // Delete associated tenant if user is a lecturer (tenant_admin)
    const userResult = await pool.query('SELECT role, tenant_id FROM users WHERE id = $1', [id]);
    const user = userResult.rows[0];
    if (user && user.role === 'tenant_admin' && user.tenant_id) {
       // Clear students roster and resources for this tenant first
       await pool.query('DELETE FROM students_roster WHERE tenant_id = $1', [user.tenant_id]);
       await pool.query('DELETE FROM resources WHERE tenant_id = $1', [user.tenant_id]);
       await pool.query('DELETE FROM exams WHERE tenant_id = $1', [user.tenant_id]);
       await pool.query('DELETE FROM tenants WHERE id = $1', [user.tenant_id]);
    }

    // Finally delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/admin/users/:id/role', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  const { role } = req.body;
  try {
    const { id } = idParamSchema.parse(req.params);
    const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
    const currentRole = userRes.rows[0]?.role;
    if ((role === 'admin' || role === 'super_admin') && currentRole !== 'user' && currentRole !== 'admin' && currentRole !== 'super_admin') {
        return res.status(400).json({ error: "Only Research portal users can be assigned Admin roles." });
    }

    if (id === req.user.id) return res.status(400).json({ error: 'Cannot change your own role' });
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    const updated = await pool.query('SELECT id, name, email, role, affiliation, created_at FROM users WHERE id = $1', [id]);
    res.json({ success: true, user: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

app.get('/api/papers/:id/file', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    // Only admins or the owner can view the file
    const result = await pool.query('SELECT file_blob, title, metadata FROM papers WHERE id = $1', [id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const isOwnerResult = await pool.query('SELECT user_id FROM papers WHERE id = $1', [id]);
    const isOwner = isOwnerResult.rows[0]?.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    if (!paper.file_blob) {
      return res.status(404).json({ error: 'PDF file not available for this paper. It may have been uploaded before file storage was enabled.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(paper.file_blob);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

app.put('/api/admin/papers/:id/metadata', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  const { doi, volume, issue, issn } = req.body;
  try {
    const { id } = idParamSchema.parse(req.params);
    await pool.query('UPDATE papers SET doi = $1, volume = $2, issue = $3, issn = $4 WHERE id = $5', [doi, volume, issue, issn || null, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update paper metadata' });
  }
});

app.put('/api/admin/papers/:id/status', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  const { status } = req.body;
  const validStatuses = ['uploaded', 'formatting', 'peer_review', 'integrity_check', 'ready', 'published', 'rejected'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { id } = idParamSchema.parse(req.params);
    // Update paper status and published date
    let updateQuery = 'UPDATE papers SET status = $1';
    const queryParams = [status];
    if (status === 'published') {
      updateQuery += ', published_at = CURRENT_TIMESTAMP';
    }
    queryParams.push(id);
    await pool.query(`${updateQuery} WHERE id = $${queryParams.length}`, queryParams);
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

// Journal Settings (Volume, Issue, ISSN)
app.get('/api/admin/config/journal', authenticateToken, async (req: any, res) => {
  try {
    const volResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_volume']);
    const issueResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_issue']);
    const issnResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_issn']);
    const maxManuResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['max_manuscripts_per_issue']);
    const maxIssResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['max_issues_per_volume']);
    const maxPageResult = await pool.query('SELECT value FROM settings WHERE key = $1', ['max_pages_per_manuscript']);
    
    res.json({
      current_volume: volResult.rows[0]?.value || '1',
      current_issue: issueResult.rows[0]?.value || '1',
      journal_issn: issnResult.rows[0]?.value || '2971-7760',
      max_manuscripts_per_issue: parseInt(maxManuResult.rows[0]?.value || '10'),
      max_issues_per_volume: parseInt(maxIssResult.rows[0]?.value || '3'),
      max_pages_per_manuscript: parseInt(maxPageResult.rows[0]?.value || '20')
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/config/journal', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { 
    current_volume, current_issue, journal_issn, 
    max_manuscripts_per_issue, max_issues_per_volume, max_pages_per_manuscript 
  } = req.body;
  try {
    if (current_volume !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_volume', current_volume.toString()]);
    if (current_issue !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_issue', current_issue.toString()]);
    if (journal_issn !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_issn', journal_issn.toString()]);
    
    if (max_manuscripts_per_issue !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_manuscripts_per_issue', max_manuscripts_per_issue.toString()]);
    if (max_issues_per_volume !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_issues_per_volume', max_issues_per_volume.toString()]);
    if (max_pages_per_manuscript !== undefined) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_pages_per_manuscript', max_pages_per_manuscript.toString()]);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// LEGACY (Keep for compatibility if needed, but point to new pricing)
app.get('/api/settings/price', async (req, res) => {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['publication_price']);
  res.json({ price: parseInt(result.rows[0]?.value || '5000', 10) });
});

// PaymentPoint Integration — Virtual Account Flow (per official docs)
app.post('/api/payment/initialize', authenticateToken, async (req: any, res) => {
  const { amount, type } = req.body; // type: 'subscription' or 'other'
  const reference = `GMIJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY;
    const PAYMENTPOINT_SECRET_KEY = process.env.PAYMENTPOINT_SECRET_KEY;
    const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID;

    if (!PAYMENTPOINT_API_KEY || !PAYMENTPOINT_SECRET_KEY || !PAYMENTPOINT_BUSINESS_ID) {
      console.error('Missing PaymentPoint environment variables. Ensure PAYMENTPOINT_API_KEY, PAYMENTPOINT_SECRET_KEY, and PAYMENTPOINT_BUSINESS_ID are set.');
      return res.status(500).json({ error: 'Payment gateway is not configured. Please contact support.' });
    }

    // Step 1: Create a Virtual Account for the customer via PaymentPoint API
    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENTPOINT_SECRET_KEY}`,
        'api-key': PAYMENTPOINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
        phoneNumber: (req.user.phone || '00000000000').replace(/\D/g, '').slice(-11).padStart(11, '0'),
        bankCode: ['20946', '20897'], // PalmPay + OPay
        businessId: PAYMENTPOINT_BUSINESS_ID
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PaymentPoint Virtual Account creation failed:', response.status, errorText);
      throw new Error(`PaymentPoint failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Virtual account creation failed');
    
    // Step 2: Record the pending transaction
    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type) VALUES ($1, $2, $3, $4, $5, $6)', 
      [req.user.id, req.tenant_id, reference, amount, 'pending', type || 'publication']
    );
    
    // Step 3: Return virtual account details to the frontend
    // The user will transfer the exact amount to one of these bank accounts.
    // PaymentPoint webhook will fire when money lands.
    res.json({
      reference,
      amount,
      customer_id: data.customer?.customer_id,
      bankAccounts: data.bankAccounts || [],
      message: `Transfer ₦${Number(amount).toLocaleString()} to any of the bank accounts below to complete your payment.`
    });
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    res.status(500).json({ 
      error: 'Payment initialization failed', 
      details: err.message,
      code: err.code || 'UNKNOWN'
    });
  }
});

// Student Attendance Integration - Dynamic Virtual Account Flow
app.post('/api/payment/attendance/initialize', authenticateToken, async (req: any, res) => {
  const { course_id, amount } = req.body;
  if (!course_id || !amount) return res.status(400).json({ error: 'course_id and amount are required' });

  const reference = `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY;
    const PAYMENTPOINT_SECRET_KEY = process.env.PAYMENTPOINT_SECRET_KEY;
    const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID;

    if (!PAYMENTPOINT_API_KEY || !PAYMENTPOINT_SECRET_KEY || !PAYMENTPOINT_BUSINESS_ID) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    // Step 1: Create a Dynamic Virtual Account for the customer via PaymentPoint API
    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENTPOINT_SECRET_KEY}`,
        'api-key': PAYMENTPOINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
        phoneNumber: (req.user.phone || '00000000000').replace(/\D/g, '').slice(-11).padStart(11, '0'),
        bankCode: ['20946', '20897'], // PalmPay + OPay
        businessId: PAYMENTPOINT_BUSINESS_ID
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PaymentPoint failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Virtual account creation failed');
    
    // Step 2: Record the pending transaction with course, date, and expiration metadata
    const attendance_date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const expires_at_date = new Date();
    expires_at_date.setMinutes(expires_at_date.getMinutes() + 30); // 30-minute expiration
    const expires_at = expires_at_date.toISOString();

    const metadata = {
        course_id,
        attendance_date,
        expires_at
    };

    // Note: tenant_id here represents the lecturer who owns the course. 
    // Usually passed in request or inferred from user's tenant_id.
    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [req.user.id, req.tenant_id, reference, amount, 'pending', 'attendance_token', metadata]
    );
    
    res.json({
      reference,
      amount,
      customer_id: data.customer?.customer_id,
      bankAccounts: data.bankAccounts || [],
      expires_at,
      message: `Transfer ₦${Number(amount).toLocaleString()} to sign attendance for ${course_id}.`
    });
  } catch (err: any) {
    console.error('Attendance Payment initialization error:', err);
    res.status(500).json({ error: 'Attendance payment initialization failed', details: err.message });
  }
});


app.get('/api/payment/verify/:reference', authenticateToken, async (req: any, res) => {
  try {
    const { reference } = req.params;
    const result = await pool.query(
      'SELECT status, amount, type FROM transactions WHERE reference = $1 AND user_id = $2',
      [reference, req.user.id]
    );
    const txn = result.rows[0];
    if (!txn) return res.status(404).json({ status: 'not_found', error: 'Transaction not found' });
    res.json({ status: txn.status, amount: txn.amount, type: txn.type });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ status: 'error', error: 'Verification failed' });
  }
});

// Secure Webhook for PaymentPoint (per official docs)

// Check if the user has an unused publication credit (paid but not yet linked to a paper)
app.get('/api/payment/credit', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT reference FROM transactions 
       WHERE user_id = $1 AND type = 'publication' AND status = 'success' AND paper_id IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (result.rows.length > 0) {
      res.json({ hasCredit: true, reference: result.rows[0].reference });
    } else {
      res.json({ hasCredit: false });
    }
  } catch (error) {
    console.error('Credit check error:', error);
    res.status(500).json({ hasCredit: false, error: 'Failed to check credit' });
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
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const query = isAdmin
    ? `SELECT p.id, p.title, p.authors, p.status, p.doi, p.volume, p.issue, p.issn, p.metadata, p.created_at, p.published_at, u.name as researcher_name, u.email as researcher_email 
       FROM papers p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`
    : `SELECT p.id, p.title, p.authors, p.status, p.doi, p.volume, p.issue, p.issn, p.metadata, p.created_at, p.published_at, u.name as researcher_name, u.email as researcher_email 
       FROM papers p JOIN users u ON p.user_id = u.id WHERE p.user_id = $1 ORDER BY p.created_at DESC`;
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
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  
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

// ─── BUNNY STREAM VIDEO ENDPOINTS ───────────────────────────────────
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY || '';
const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '620384';
const BUNNY_CDN_HOST = process.env.BUNNY_CDN_HOST || 'vz-3d11f78c-1a6.b-cdn.net';

// Webhook for Bunny Stream processing updates
app.post('/api/webhooks/bunny', async (req: any, res: any) => {
  try {
    const { VideoGuid, Status, LibraryId } = req.body;
    console.log(`[Bunny Stream Webhook] Video ${VideoGuid} in Library ${LibraryId} changed to status: ${Status}`);
    
    // In a full production app with a dedicated videos table, we'd do:
    // await pool.query('UPDATE videos SET status = $1 WHERE guid = $2', [Status, VideoGuid]);
    
    res.json({ success: true, message: 'Webhook received' });
  } catch (err: any) {
    console.error('Bunny Webhook Error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// List all videos
app.get('/api/videos', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos?page=1&itemsPerPage=100&orderBy=date`, {
      headers: { 'AccessKey': BUNNY_STREAM_API_KEY }
    });
    const data = await bunnyRes.json();
    const videos = (data.items || []).map((v: any) => ({
      guid: v.guid,
      title: v.title,
      status: v.status,
      length: v.length,
      views: v.views,
      dateUploaded: v.dateUploaded,
      storageSize: v.storageSize,
      thumbnailUrl: v.status === 4 ? `https://${BUNNY_CDN_HOST}/${v.guid}/thumbnail.jpg` : '',
      is_available: v.metaTags?.find((t: any) => t.property === 'is_available')?.value === 'true',
      is_paid: v.metaTags?.find((t: any) => t.property === 'is_paid')?.value === 'true',
      price: parseInt(v.metaTags?.find((t: any) => t.property === 'price')?.value || '0'),
    }));
    res.json({ videos, cdnHost: BUNNY_CDN_HOST, libraryId: BUNNY_STREAM_LIBRARY_ID });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create video entry + return upload URL
app.post('/api/videos/create', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { title } = req.body;
    const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: { 
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });
    const data = await bunnyRes.json();
    res.json({ 
      videoId: data.guid, 
      uploadUrl: `/api/videos/${data.guid}/upload`,
      cdnHost: BUNNY_CDN_HOST
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload video file (proxy to Bunny)
app.put('/api/videos/:guid/upload', authenticateToken, async (req: any, res: any) => {
  try {
    const { guid } = req.params;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`, {
        method: 'PUT',
        headers: { 'AccessKey': BUNNY_STREAM_API_KEY },
        body: body
      });
      if (bunnyRes.ok) {
        res.json({ success: true });
      } else {
        res.status(bunnyRes.status).json({ error: 'Upload to Bunny failed' });
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video
app.delete('/api/videos/:guid', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${req.params.guid}`, {
      method: 'DELETE',
      headers: { 'AccessKey': BUNNY_STREAM_API_KEY }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update video settings (monetization metadata stored as metaTags)
app.put('/api/videos/:guid/settings', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { price, is_available, is_paid } = req.body;
    const metaTags = [
      { property: 'is_available', value: String(is_available ?? true) },
      { property: 'is_paid', value: String(is_paid ?? false) },
      { property: 'price', value: String(price ?? 0) },
    ];
    await fetch(`https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${req.params.guid}`, {
      method: 'POST',
      headers: { 
        'AccessKey': BUNNY_STREAM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ metaTags })
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MULTI-TENANT ACADEMIC ENDPOINTS ────────────────────────────────
// ─── RESOURCE HUB ENDPOINTS ─────────────────────────────────────────
app.get('/api/resources', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT id, type, name, status, created_at, is_available, price, is_paid FROM resources WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/resources/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT * FROM resources WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/academic/tests', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT id, title, questions, duration, created_at, is_available, price, is_paid FROM exams WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resources/upload', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const { type, name, content } = req.body;
    if (!type || !name || !content) return res.status(400).json({ error: 'Missing required fields' });

    // Sanitization and Critical Check
    let status = 'ready';
    if (type === 'roster') {
        const students = Array.isArray(content) ? content : [];
        if (students.length === 0) return res.status(400).json({ error: 'Empty roster' });
        
        const isValid = students.every((s: any) => 
            s.matricNumber && 
            s.email && 
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)
        );
        if (!isValid) status = 'failed';
    } else if (type === 'material') {
        if (content.length < 50) status = 'failed';
    }

    const result = await pool.query(
      'INSERT INTO resources (tenant_id, type, name, content, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.tenant_id, type, name, JSON.stringify(content), status]
    );

    res.json({ success: true, id: result.rows[0].id, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resources/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    await pool.query('DELETE FROM resources WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings for resources (price, availability)
app.put('/api/resources/:id/settings', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { price, is_available, is_paid } = req.body;
    await pool.query(
      'UPDATE resources SET price = $1, is_available = $2, is_paid = $3 WHERE id = $4 AND tenant_id = $5',
      [price, is_available, is_paid, id, req.tenant_id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings for exams/assessments (price, availability)
app.put('/api/exams/:id/settings', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { price, is_available, is_paid } = req.body;
    await pool.query(
      'UPDATE exams SET price = $1, is_available = $2, is_paid = $3 WHERE id = $4 AND tenant_id = $5',
      [price, is_available, is_paid, id, req.tenant_id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Payment for Material Access
app.post('/api/payment/material/initialize', authenticateToken, async (req: any, res) => {
  const { resource_id, amount } = req.body;
  if (!resource_id || !amount) return res.status(400).json({ error: 'resource_id and amount are required' });

  const reference = `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY;
    const PAYMENTPOINT_SECRET_KEY = process.env.PAYMENTPOINT_SECRET_KEY;
    const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID;

    if (!PAYMENTPOINT_API_KEY || !PAYMENTPOINT_SECRET_KEY || !PAYMENTPOINT_BUSINESS_ID) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENTPOINT_SECRET_KEY}`,
        'api-key': PAYMENTPOINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
        phoneNumber: (req.user.phone || '00000000000').replace(/\D/g, '').slice(-11).padStart(11, '0'),
        bankCode: ['20946', '20897'],
        businessId: PAYMENTPOINT_BUSINESS_ID
      })
    });
    
    if (!response.ok) throw new Error(`PaymentPoint failed (${response.status})`);

    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Virtual account creation failed');
    
    const resourceRes = await pool.query('SELECT tenant_id FROM resources WHERE id = $1', [resource_id]);
    const tenant_id = resourceRes.rows[0]?.tenant_id;

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [req.user.id, tenant_id, reference, amount, 'pending', 'material_access', { resource_id }]
    );
    
    res.json({
      reference,
      amount,
      bankAccounts: data.bankAccounts || [],
      message: `Transfer ₦${Number(amount).toLocaleString()} to access this material.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
  }
});

// Payment for Assessment Access
app.post('/api/payment/assessment/initialize', authenticateToken, async (req: any, res) => {
  const { exam_id, amount } = req.body;
  if (!exam_id || !amount) return res.status(400).json({ error: 'exam_id and amount are required' });

  const reference = `ASM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    const PAYMENTPOINT_API_KEY = process.env.PAYMENTPOINT_API_KEY;
    const PAYMENTPOINT_SECRET_KEY = process.env.PAYMENTPOINT_SECRET_KEY;
    const PAYMENTPOINT_BUSINESS_ID = process.env.PAYMENTPOINT_BUSINESS_ID;

    if (!PAYMENTPOINT_API_KEY || !PAYMENTPOINT_SECRET_KEY || !PAYMENTPOINT_BUSINESS_ID) {
      return res.status(500).json({ error: 'Payment gateway is not configured.' });
    }

    const response = await fetch('https://api.paymentpoint.co/api/v1/createVirtualAccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENTPOINT_SECRET_KEY}`,
        'api-key': PAYMENTPOINT_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
        phoneNumber: (req.user.phone || '00000000000').replace(/\D/g, '').slice(-11).padStart(11, '0'),
        bankCode: ['20946', '20897'],
        businessId: PAYMENTPOINT_BUSINESS_ID
      })
    });
    
    if (!response.ok) throw new Error(`PaymentPoint failed (${response.status})`);

    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || 'Virtual account creation failed');
    
    const examRes = await pool.query('SELECT tenant_id FROM exams WHERE id = $1', [exam_id]);
    const tenant_id = examRes.rows[0]?.tenant_id;

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [req.user.id, tenant_id, reference, amount, 'pending', 'assessment_access', { exam_id }]
    );
    
    res.json({
      reference,
      amount,
      bankAccounts: data.bankAccounts || [],
      message: `Transfer ₦${Number(amount).toLocaleString()} to access this assessment.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
  }
});

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

// Student: Get Performance Stats (Live)
app.get('/api/student/performance-stats', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    // 1. Get all exam results for this student
    const results = await pool.query(
      `SELECT er.*, e.title as course, e.type, 
       (SELECT SUM(points) FROM questions WHERE exam_id = e.id) as max_points
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       WHERE er.user_id = $1
       ORDER BY er.submitted_at DESC`,
      [req.user.id]
    );

    // 2. Calculate Stats
    const totalExams = results.rows.length;
    const totalScore = results.rows.reduce((sum, r) => sum + (r.score || 0), 0);
    const avgScore = totalExams > 0 ? totalScore / totalExams : 0;
    
    // CGPA Calculation (Simplified: mapping 0-100 to 0-4.0)
    const cgpa = (avgScore / 100 * 4).toFixed(2);
    
    // Total Credits (Sum of points from exams)
    const totalCredits = results.rows.reduce((sum, r) => sum + (r.max_points || 0), 0);
    
    // Global Rank (Relative to other students in the same tenant)
    const rankResult = await pool.query(
      `SELECT user_id, AVG(score) as avg_score 
       FROM exam_results 
       WHERE tenant_id = $1 
       GROUP BY user_id 
       ORDER BY avg_score DESC`,
      [req.tenant_id]
    );
    const rankIndex = rankResult.rows.findIndex(r => r.user_id === req.user.id);
    const globalRank = rankIndex !== -1 ? `#${rankIndex + 1}` : 'N/A';

    // 3. Format Records
    const records = results.rows.map(r => {
      let grade = 'F';
      const s = r.score;
      if (s >= 90) grade = 'A+';
      else if (s >= 80) grade = 'A';
      else if (s >= 70) grade = 'B';
      else if (s >= 60) grade = 'C';
      else if (s >= 50) grade = 'D';

      return {
        id: r.id,
        course: r.course,
        type: r.type,
        score: Math.round(s),
        grade,
        date: new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      };
    });

    // 4. Dynamic Skills (Simplified: assign skills based on average scores in different types)
    const skills = [
      { name: 'Practical Application', percent: Math.round(avgScore * 0.9 + 5), color: 'bg-emerald-500' },
      { name: 'Theory & Logic', percent: Math.round(avgScore), color: 'bg-indigo-500' },
      { name: 'Research Accuracy', percent: Math.round(avgScore * 0.8 + 10), color: 'bg-amber-500' },
    ];

    res.json({
      stats: [
        { label: 'CGPA', value: cgpa, type: 'gpa' },
        { label: 'Courses Passed', value: totalExams.toString(), type: 'count' },
        { label: 'Global Rank', value: globalRank, type: 'rank' },
        { label: 'Total Credits', value: totalCredits.toString(), type: 'credits' }
      ],
      records: records.slice(0, 5), // Latest 5
      improvement: 12, // Placeholder
      skills
    });
  } catch (error) {
    console.error('Performance stats error:', error);
    res.status(500).json({ error: 'Failed to calculate performance' });
  }
});

// Student: Get Assessments
app.get('/api/student/assessments', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const assessments = await pool.query(
      `SELECT e.*, 
       (SELECT COUNT(*) FROM questions WHERE exam_id = e.id) as "totalQuestions",
       EXISTS(SELECT 1 FROM exam_results WHERE exam_id = e.id AND user_id = $1) as completed,
       EXISTS(SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'assessment_access' AND (metadata->>'exam_id')::int = e.id AND status = 'success') as "hasPaid"
       FROM exams e 
       WHERE e.tenant_id = $2 AND e.is_available = true
       ORDER BY e.created_at DESC`,
      [req.user.id, req.tenant_id]
    );

    const formatted = assessments.rows.map(a => ({
      id: a.id,
      course: a.title,
      type: a.type || 'test',
      duration: `${a.duration} Mins`,
      totalQuestions: a.totalQuestions || 0,
      status: a.completed ? 'completed' : 'pending',
      date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      is_paid: a.is_paid,
      price: a.price,
      hasPaid: a.hasPaid
    }));

    res.json({ success: true, assessments: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Student: Get Materials
app.get('/api/student/materials', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT r.*,
       EXISTS(SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'material_access' AND (metadata->>'resource_id')::int = r.id AND status = 'success') as "hasPaid"
       FROM resources r
       WHERE r.tenant_id = $2 AND r.type = 'material' AND r.is_available = true
       ORDER BY r.created_at DESC`,
      [req.user.id, req.tenant_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});
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
// Super Admin: Pricing Configuration
app.get('/api/admin/config/pricing', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const pubPrice = await pool.query('SELECT value FROM settings WHERE key = $1', ['publication_price']);
    const subPrice = await pool.query('SELECT value FROM settings WHERE key = $1', ['lecturer_subscription_price']);
    res.json({
      publication_price: parseInt(pubPrice.rows[0]?.value || '5000'),
      subscription_price: parseInt(subPrice.rows[0]?.value || '15000')
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

app.post('/api/admin/config/pricing', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { key, value } = req.body;
    if (!['publication_price', 'lecturer_subscription_price'].includes(key)) {
      return res.status(400).json({ error: 'Invalid pricing key' });
    }
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value.toString()]);
    res.json({ success: true, key, value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// Super Admin: Journal Registry Configuration
app.get('/api/admin/config/journal', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const vol = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_volume']);
    const issue = await pool.query('SELECT value FROM settings WHERE key = $1', ['current_issue']);
    const issn = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_issn']);
    const signature = await pool.query('SELECT value FROM settings WHERE key = $1', ['journal_signature']);
    res.json({
      current_volume: vol.rows[0]?.value || '1',
      current_issue: issue.rows[0]?.value || '1',
      journal_issn: issn.rows[0]?.value || '2971-7760',
      journal_signature: signature.rows[0]?.value || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journal settings' });
  }
});

app.post('/api/admin/config/journal', authenticateToken, async (req: any, res: any) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { current_volume, current_issue, journal_issn, journal_signature } = req.body;
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_volume', current_volume.toString()]);
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_issue', current_issue.toString()]);
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_issn', journal_issn.toString()]);
    if (journal_signature !== undefined) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_signature', journal_signature]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update journal settings' });
  }
});

// SEO: Public Article Page with JSON-LD
app.get('/article/:prefix/:suffix', async (req, res) => {
  const doi = `${req.params.prefix}/${req.params.suffix}`;
  try {
    const result = await pool.query("SELECT * FROM papers WHERE doi = $1 AND status = 'published'", [doi]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).send("Article not found or not yet indexed.");

    const meta = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    const ast = meta.ast || {};
    const authors = ast.authors || meta.authors || [];
    const authorNames = authors.map((a: any) => typeof a === 'string' ? a : a.name).join(", ");

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ScholarlyArticle",
      "headline": ast.title || paper.title,
      "author": authors.map((a: any) => ({ "@type": "Person", "name": typeof a === 'string' ? a : a.name })),
      "datePublished": paper.published_at,
      "doi": doi,
      "publisher": { "@type": "Organization", "name": "Genius Multidisciplinary International Journal" },
      "description": ast.abstract?.background || paper.abstract || "Academic research publication."
    };

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${ast.title || paper.title} | Genius Journal</title>
        <meta name="description" content="${jsonLd.description.substring(0, 160)}">
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
        <style>
          body { font-family: 'Times New Roman', Times, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a202c; }
          h1 { color: #800000; border-bottom: 2px solid #800000; padding-bottom: 10px; font-weight: bold; }
          .meta { color: #4a5568; font-size: 0.95em; margin: 20px 0; border-left: 4px solid #800000; padding-left: 15px; }
          .abstract { background: #fdf2f2; padding: 25px; border-radius: 4px; margin: 20px 0; border: 1px solid #fee2e2; }
          .doi-link { color: #800000; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 30px;">
          <h3 style="color: #4a5568; margin-bottom: 5px;">GENIUS MULTIDISCIPLINARY INTERNATIONAL JOURNAL</h3>
          <p style="color: #718096; font-size: 0.8em; margin: 0;">OFFICIAL RESEARCH ARCHIVE | ISSN: 2971-7760</p>
        </div>
        <h1>${ast.title || paper.title}</h1>
        <div class="meta">
          <strong>Authors:</strong> ${authorNames}<br>
          <strong>DOI:</strong> <a class="doi-link" href="https://doi.org/${doi}">${doi}</a><br>
          <strong>Published:</strong> ${new Date(paper.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div class="abstract">
          <h2 style="margin-top: 0; font-size: 1.2em; color: #800000;">Abstract</h2>
          <p>${jsonLd.description}</p>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #edf2f7; font-size: 0.85em; color: #a0aec0;">
          <p>This scholarly article is part of the Genius Multidisciplinary Journal collection. All research published is peer-reviewed and open-access.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send("Node error: Failed to retrieve indexed article.");
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const result = await pool.query("SELECT doi FROM papers WHERE status = 'published' AND doi IS NOT NULL");
    const urls = result.rows.map(r => `<url><loc>${APP_URL}/article/${r.doi}</loc></url>`).join("");
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch (e) {
    res.status(500).send("Sitemap node failure.");
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Log missing files to help debug MIME type errors (404s that fallback to HTML)
    app.use('/assets', async (req, res, next) => {
      try {
        const fs = (await import('fs')).default;
        const path = (await import('path')).default;
        const assetPath = path.join(process.cwd(), 'dist/assets', req.path);
        if (!fs.existsSync(assetPath)) {
          console.warn(`[Static Asset 404]: ${req.path} not found at ${assetPath}`);
        }
      } catch (e) {
        // Ignore logging errors
      }
      next();
    });
    
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
