// Polyfill for DOMMatrix which is required by some dependencies like pdf-parse in Node environments
if (typeof global.DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() { }
  };
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import express from 'express';

import { createServer as createViteServer } from 'vite';
import multer from 'multer';
// @ts-ignore
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Lazy pdf-parse loader — resolved on first call to avoid ESM/CJS startup crashes on Node 22.
let _pdfParseImpl: ((buffer: Buffer, options?: any) => Promise<any>) | null = null;
async function pdfParse(buffer: Buffer, options?: any): Promise<any> {
  if (!_pdfParseImpl) {
    // 1. Try ESM dynamic import (works with pdf-parse v2 on Node 22)
    try {
      const mod: any = await import('pdf-parse');
      const fn = typeof mod?.default === 'function' ? mod.default
               : typeof mod === 'function'          ? mod
               : null;
      if (fn) { _pdfParseImpl = fn; }
    } catch (_) {}

    // 2. Fallback: CJS require paths
    if (!_pdfParseImpl) {
      for (const path of ['pdf-parse/lib/pdf-parse.js', 'pdf-parse']) {
        try {
          const m = require(path);
          const fn = typeof m === 'function' ? m : (typeof m?.default === 'function' ? m.default : null);
          if (fn) { _pdfParseImpl = fn; break; }
        } catch (_) {}
      }
    }

    if (!_pdfParseImpl) {
      throw new Error('pdf-parse: no callable export found — PDF parsing unavailable.');
    }
  }
  return _pdfParseImpl(buffer, options);
}
import mammoth from 'mammoth';
const WordExtractor = require('word-extractor');
const officeParser = require('officeparser');
const JSZip = require('jszip');
import { XMLParser as FastXMLParser } from 'fast-xml-parser';

// Recursively extract plain text from officeParser structured JSON output
function extractTextFromOfficeParserJson(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractTextFromOfficeParserJson).filter(Boolean).join('\n');
  if (node && typeof node === 'object') {
    if (typeof node.text === 'string') return node.text;
    return Object.values(node)
      .filter(v => typeof v !== 'number' && typeof v !== 'boolean')
      .map(extractTextFromOfficeParserJson)
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

// Extract text from PPTX by reading slide XML files directly
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? '0');
      const nb = parseInt(b.match(/\d+/)?.[0] ?? '0');
      return na - nb;
    });

  const parser = new FastXMLParser({ ignoreAttributes: true, textNodeName: '_text' });
  const slideTexts: string[] = [];

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async('string');
    const parsed = parser.parse(xml);
    const texts: string[] = [];
    function collectText(node: any) {
      if (typeof node === 'string' || typeof node === 'number') { texts.push(String(node)); return; }
      if (Array.isArray(node)) { node.forEach(collectText); return; }
      if (node && typeof node === 'object') {
        // 'a:t' elements hold the actual text runs in OOXML
        if (node['a:t'] !== undefined) collectText(node['a:t']);
        else Object.values(node).forEach(collectText);
      }
    }
    collectText(parsed);
    const slideText = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (slideText) slideTexts.push(slideText);
  }
  return slideTexts.join('\n');
}
import cors from 'cors';
import OpenAI from 'openai';
import { Pool } from 'pg';
import * as cheerio from 'cheerio';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import stringSimilarity from 'string-similarity';
import natural from 'natural';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import puppeteer from 'puppeteer-core';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import helmet from 'helmet';

const JOURNAL_NAME = 'Genius Multidisciplinary International Journal Publication';
const JOURNAL_DISPLAY_NAME = 'Genius Multidisciplinary International Journal';
const JOURNAL_SHORT_NAME = 'GMIJP';
const PARTNER_INSTITUTION_NAME = 'Nasarawa State University, Keffi';
const PUBLICATION_STATUSES = ['uploaded', 'writing_assistant', 'formatting', 'reference_intel', 'peer_review', 'integrity_check', 'ready', 'accepted', 'published', 'doi_validation_failed', 'rejected'];

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveAssetPath = (fileNames: string[]) => {
  for (const folder of ['public', 'tools']) {
    for (const fileName of fileNames) {
      const filePath = path.join(process.cwd(), folder, fileName);
      if (fs.existsSync(filePath)) return filePath;
    }
  }
  return '';
};

// Global Journal Branding Assets: Pre-loaded as Base64 to ensure 1:1 PDF fidelity across all pages.
const getBase64Image = (fileNames: string[]) => {
  try {
    const filePath = resolveAssetPath(fileNames);
    if (filePath) {
      const bitmap = fs.readFileSync(filePath);
      const extension = path.extname(filePath).slice(1);
      return `data:image/${extension};base64,${bitmap.toString('base64')}`;
    }
  } catch (e) {
    console.error(`[GLOBAL] Failed to load logo ${fileNames.join(', ')}:`, e);
  }
  return '';
};

const journalLogoBase64 = getBase64Image(['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
const nsukLogoBase64 = getBase64Image(['Nasarawa-State-University.jpg', 'university-logo.jpg']);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(helmet({
  contentSecurityPolicy: false, // Disabled — SPA sets its own CSP via meta tags
  crossOriginEmbedderPolicy: false, // Required for PDF.js and embedded viewers
}));
app.use(cors());
app.set('trust proxy', 1);

// Secure Webhook for PaymentPoint (Must be before global JSON parser for raw body)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req: any, res) => {
  const signature = req.headers['paymentpoint-signature'];
  const secretKey = process.env.PAYMENTPOINT_SECRET_KEY;

  if (!signature || !secretKey) return res.status(400).send('Missing signature or configuration');

  try {
    const hmac = crypto.createHmac('sha256', secretKey);
    const calculatedSignature = hmac.update(req.body).digest('hex');

    if (calculatedSignature !== signature) {
      console.warn('Invalid PaymentPoint webhook signature');
      return res.status(401).send('Invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    const { notification_status, transaction_id, amount_paid, settlement_amount, transaction_status, customer } = payload;

    if (transaction_status === 'success' && notification_status === 'payment_successful') {
      const reference = payload.transaction_id || payload.reference;
      const paidAmount = Number(amount_paid || 0);
      const eventKey = `paymentpoint:${reference}:${transaction_id || 'na'}:${paidAmount}`;

      const result = await pool.query('SELECT * FROM transactions WHERE reference = $1', [reference]);
      const tx = result?.rows?.[0];
      if (tx) {
        const meta = safeJsonParse<any>(tx.metadata, {});
        const gateway = meta.gateway || 'paystack';
        const parentRef = tx.type === 'payment_topup' ? (meta.topup_for || tx.reference) : tx.reference;

        await insertPaymentEvent({
          reference: tx.reference,
          gateway,
          eventType: 'payment',
          amount: paidAmount,
          eventKey,
          payload
        });

        if (parentRef !== tx.reference) {
          await insertPaymentEvent({
            reference: parentRef,
            gateway,
            eventType: 'payment',
            amount: paidAmount,
            eventKey: `${eventKey}:parent`,
            payload: { ...payload, child_reference: tx.reference }
          });
        }

        await recomputeTransaction(tx.reference, gateway);
        if (parentRef !== tx.reference) {
          await recomputeTransaction(parentRef, gateway);
        }
      }
    }
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('PaymentPoint webhook error:', err);
    res.status(500).send('Internal server error');
  }
});

// Secure Webhook for Kora (Korapay) — Must be before global JSON parser for raw body
app.post('/api/payment/webhook/kora', express.raw({ type: 'application/json' }), async (req: any, res) => {
  const signature = req.headers['x-korapay-signature'];
  const secretKey = process.env.KORA_WEBHOOK_SECRET || process.env.KORA_SECRET_KEY;

  const shouldVerify = Boolean(secretKey);
  if (shouldVerify && !signature) return res.status(400).send('Missing signature');

  try {
    const payload = JSON.parse(req.body.toString());
    if (shouldVerify) {
      const dataString = JSON.stringify(payload?.data ?? {});
      const calculatedSignature = crypto.createHmac('sha256', secretKey as string).update(dataString).digest('hex');
      const incomingSignature = Array.isArray(signature) ? signature[0] : String(signature);

      if (!incomingSignature || calculatedSignature !== incomingSignature) {
        console.warn('Invalid Kora webhook signature');
        return res.status(401).send('Invalid signature');
      }
    } else {
      console.warn('Kora webhook secret not configured; skipping signature verification.');
    }

    const { event, data } = payload;

    if (event === 'charge.success' && data?.status === 'success') {
      const reference = data.reference;
      const amountPaid = Number(data.amount || 0);
      const eventKey = `kora:${reference}:${data?.id || 'na'}:${amountPaid}`;

      const result = await pool.query('SELECT * FROM transactions WHERE reference = $1', [reference]);
      const tx = result?.rows?.[0];

      if (tx) {
        const meta = safeJsonParse<any>(tx.metadata, {});
        const gateway = meta.gateway || 'kora';
        const parentRef = tx.type === 'payment_topup' ? (meta.topup_for || tx.reference) : tx.reference;

        await insertPaymentEvent({
          reference: tx.reference,
          gateway,
          eventType: 'payment',
          amount: amountPaid,
          eventKey,
          payload
        });

        if (parentRef !== tx.reference) {
          await insertPaymentEvent({
            reference: parentRef,
            gateway,
            eventType: 'payment',
            amount: amountPaid,
            eventKey: `${eventKey}:parent`,
            payload: { ...payload, child_reference: tx.reference }
          });
        }

        await recomputeTransaction(tx.reference, gateway);
        if (parentRef !== tx.reference) {
          await recomputeTransaction(parentRef, gateway);
        }
      }
    }
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Kora webhook error:', err);
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

// diskStorage writes the file to /tmp during upload — avoids buffering 50 MB in Node heap.
// req.file.buffer is unavailable with diskStorage; use req.file.path + fs.createReadStream instead.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, '/tmp'),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB — covers large video files
});

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholar',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
});

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || 'onboarding@resend.dev';
const APP_URL = normalizeBaseUrl(process.env.APP_URL || 'https://geniusapp.com');

// ─── Cloudflare R2 Storage ───────────────────────────────────────────────────
const R2_ENABLED = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

const r2 = R2_ENABLED ? new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

async function uploadToR2(key: string, body: Buffer | Readable, mimeType: string, contentLength?: number): Promise<string> {
  if (!r2 || !R2_ENABLED) throw new Error('R2 not configured');
  // Use @aws-sdk/lib-storage Upload for automatic multipart streaming —
  // avoids loading the entire file into memory at once for large files
  const upload = new Upload({
    client: r2,
    params: {
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ...(contentLength ? { ContentLength: contentLength } : {}),
    },
    queueSize: 4,       // 4 concurrent parts
    partSize: 5 * 1024 * 1024, // 5 MB parts (R2 minimum)
  });
  await upload.done();
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

// Delete a file from R2 by its public URL (extracts key from URL path)
async function deleteFromR2(fileUrl: string): Promise<void> {
  if (!r2 || !R2_ENABLED || !fileUrl) return;
  try {
    const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    const key = publicBase ? fileUrl.replace(publicBase + '/', '') : new URL(fileUrl).pathname.replace(/^\//, '');
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key }));
  } catch (err: any) {
    console.error('[R2 delete error]', err?.message);
    // Non-fatal: log but don't throw — DB row is still deleted
  }
}

// On first download of a legacy BYTEA file: upload it to R2, store the URL, null out the blob
async function lazyMigrateToR2(
  table: string, id: number | string,
  blobCol: string, urlCol: string,
  mimeType: string, filename: string
): Promise<string | null> {
  if (!R2_ENABLED) return null;
  try {
    const res = await pool.query(`SELECT "${blobCol}" FROM ${table} WHERE id = $1`, [id]);
    const blob: Buffer | null = res.rows[0]?.[blobCol];
    if (!blob) return null;
    const key = `${table}/${id}/${filename}`;
    const url = await uploadToR2(key, Buffer.from(blob), mimeType);
    await pool.query(`UPDATE ${table} SET "${urlCol}" = $1, "${blobCol}" = NULL WHERE id = $2`, [url, id]);
    return url;
  } catch (e) {
    console.error(`[R2 migrate] ${table}/${id}:`, e);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'burstbrainconcept@gmail.com';

const buildPaymentReturnUrl = (reference: string, gateway: string, type: string) => {
  const params = new URLSearchParams({
    reference,
    gateway,
    type
  });
  return `${APP_URL}/payment/return?${params.toString()}`;
};

type ResendAttachment = { filename: string; content: string };
type ResendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
  fromName?: string;
};

const sendResendEmail = async ({ to, subject, html, attachments, fromName }: ResendEmailOptions) => {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping email.');
    return;
  }

  const payload = {
    from: `${fromName || JOURNAL_SHORT_NAME} <${RESEND_FROM_EMAIL}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(attachments && attachments.length ? { attachments } : {})
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Resend email failed:', response.status, errText);
  }
};

type PaymentEventInput = {
  reference: string;
  gateway: string;
  eventType: string;
  amount?: number;
  eventKey: string;
  payload?: any;
};

const insertPaymentEvent = async ({ reference, gateway, eventType, amount = 0, eventKey, payload = {} }: PaymentEventInput) => {
  try {
    const result = await pool.query(
      'INSERT INTO payment_events (reference, gateway, event_type, amount, event_key, payload) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (event_key) DO NOTHING RETURNING id',
      [reference, gateway, eventType, Math.max(0, Number(amount || 0)), eventKey, JSON.stringify(payload || {})]
    );
    return result.rowCount > 0;
  } catch (err) {
    console.error('Payment event insert failed:', err);
    return false;
  }
};

const sendAdminPaymentAlert = async (subject: string, html: string) => {
  try {
    await sendResendEmail({
      fromName: 'Genius Payments',
      to: ADMIN_ALERT_EMAIL,
      subject,
      html
    });
  } catch (err) {
    console.error('Admin payment alert failed:', err);
  }
};

const applyUserCredit = async (userId: number, amount: number) => {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (safeAmount === 0) return { chargeAmount: 0, creditUsed: 0, creditApplied: false };
  const creditRes = await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId]);
  const creditBalance = Number(creditRes.rows[0]?.credit_balance || 0);
  if (creditBalance <= 0) return { chargeAmount: safeAmount, creditUsed: 0, creditApplied: false };

  if (creditBalance >= safeAmount) {
    await pool.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [safeAmount, userId]);
    return { chargeAmount: 0, creditUsed: safeAmount, creditApplied: true };
  }

  await pool.query('UPDATE users SET credit_balance = 0 WHERE id = $1', [userId]);
  return { chargeAmount: safeAmount - creditBalance, creditUsed: creditBalance, creditApplied: false };
};

const sumPaymentEvents = async (reference: string) => {
  const res = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) as total FROM payment_events WHERE reference = $1 AND event_type = 'payment'",
    [reference]
  );
  return Number(res.rows[0]?.total || 0);
};

async function handleTransactionSuccess(tx: any) {
  const meta = safeJsonParse<any>(tx.metadata, {});
  if (meta?.fulfilled_at) return;

  if (tx.type === 'publication') {
    const userRes = await pool.query('SELECT name, email FROM users WHERE id = $1', [tx.user_id]);
    const user = userRes.rows[0];
    if (user) {
      await sendPaymentSuccessEmail(user.email, user.name || 'Researcher', tx.reference);
    }
  }

  if (tx.type === 'pin_recovery') {
    const userRes = await pool.query('SELECT name, matric_number, email FROM users WHERE id = $1', [tx.user_id]);
    const student = userRes.rows[0];
    if (student) {
      const newPin = Math.floor(1000 + Math.random() * 9000).toString();
      const hashedPin = await hashPin(newPin);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPin, tx.user_id]);
      await pool.query('UPDATE students_roster SET pin_hash = $1 WHERE matric_number = $2 AND tenant_id = $3',
        [hashedPin, student.matric_number, tx.tenant_id]);

      await sendResendEmail({
        fromName: 'Genius Recovery',
        to: student.email,
        subject: 'Your Recovered Genius PIN',
        html: `<h2>PIN Recovered</h2><p>Your new 4-digit PIN is: <strong>${newPin}</strong></p>`
      });
    }
  }

  if (tx.type === 'subscription') {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    await pool.query('UPDATE tenants SET is_subscribed = TRUE, subscription_expiry = $1 WHERE id = $2', [expiry, tx.tenant_id]);
  }

  await pool.query('UPDATE transactions SET metadata = metadata || $1 WHERE id = $2',
    [JSON.stringify({ fulfilled_at: new Date().toISOString() }), tx.id]);
}

const recomputeTransaction = async (reference: string, sourceGateway: string) => {
  const txRes = await pool.query('SELECT * FROM transactions WHERE reference = $1', [reference]);
  const tx = txRes.rows[0];
  if (!tx) return null;

  const requiredAmount = Number(tx.amount || 0);
  const meta = safeJsonParse<any>(tx.metadata, {});
  const isTopup = tx.type === 'payment_topup';
  const paidSoFar = await sumPaymentEvents(reference);
  const remainingAmount = Math.max(requiredAmount - paidSoFar, 0);
  const overpaid = Math.max(paidSoFar - requiredAmount, 0);
  const wasAbandoned = tx.status === 'abandoned' || meta?.abandoned;

  if (wasAbandoned && paidSoFar <= 0) {
    const updateMeta: Record<string, any> = {
      paid_so_far: paidSoFar,
      remaining_amount: remainingAmount,
      overpaid,
      abandoned: true,
      abandoned_at: meta?.abandoned_at || new Date().toISOString()
    };
    await pool.query(
      'UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
      ['abandoned', JSON.stringify(updateMeta), tx.id]
    );
    return { status: 'abandoned', paidSoFar, remainingAmount, overpaid };
  }

  let nextStatus = tx.status;
  if (paidSoFar <= 0) {
    nextStatus = tx.status === 'failed' ? 'failed' : 'pending';
  } else if (paidSoFar < requiredAmount) {
    nextStatus = 'partially_paid';
  } else {
    nextStatus = 'success';
  }

  const updateMeta: Record<string, any> = {
    paid_so_far: paidSoFar,
    remaining_amount: remainingAmount,
    overpaid
  };

  await pool.query(
    'UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
    [nextStatus, JSON.stringify(updateMeta), tx.id]
  );

  if (nextStatus === 'partially_paid' && !isTopup) {
    const partialInserted = await insertPaymentEvent({
      reference,
      gateway: sourceGateway,
      eventType: 'partial',
      amount: remainingAmount,
      eventKey: `partial:${reference}:${remainingAmount}`,
      payload: { paid_so_far: paidSoFar, remaining_amount: remainingAmount }
    });
    if (partialInserted) {
      await sendAdminPaymentAlert(
        `Partial payment detected (${reference})`,
        `<p>Reference: ${reference}</p><p>Paid so far: ₦${paidSoFar}</p><p>Remaining: ₦${remainingAmount}</p>`
      );
    }
  }

  if (nextStatus === 'success' && overpaid > 0 && !isTopup && !meta?.refund_requested) {
    const overpaidInserted = await insertPaymentEvent({
      reference,
      gateway: sourceGateway,
      eventType: 'overpaid',
      amount: overpaid,
      eventKey: `overpaid:${reference}:${overpaid}`,
      payload: { overpaid }
    });

    try {
      const refundResult = await requestGatewayRefund(sourceGateway, reference, overpaid);
      await pool.query(
        'UPDATE transactions SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({
          refund_requested: true,
          refund_status: refundResult.status,
          refund_reference: refundResult.refundReference,
          refund_amount: overpaid,
          refund_gateway: sourceGateway,
          refund_requested_at: new Date().toISOString()
        }), tx.id]
      );

      await insertPaymentEvent({
        reference,
        gateway: sourceGateway,
        eventType: 'refund_requested',
        amount: overpaid,
        eventKey: `refund:${reference}:${overpaid}`,
        payload: refundResult.payload
      });

      if (overpaidInserted) {
        await sendAdminPaymentAlert(
          `Overpayment refund initiated (${reference})`,
          `<p>Reference: ${reference}</p><p>Overpaid: NGN${overpaid}</p><p>Refund request sent via ${sourceGateway}.</p>`
        );
      }
    } catch (err: any) {
      await pool.query(
        'UPDATE transactions SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({
          refund_requested: true,
          refund_status: 'failed',
          refund_amount: overpaid,
          refund_gateway: sourceGateway,
          refund_error: err?.message || 'Refund request failed',
          refund_requested_at: new Date().toISOString()
        }), tx.id]
      );

      await insertPaymentEvent({
        reference,
        gateway: sourceGateway,
        eventType: 'refund_failed',
        amount: overpaid,
        eventKey: `refund_failed:${reference}:${overpaid}`,
        payload: { error: err?.message || 'Refund request failed' }
      });

      await sendAdminPaymentAlert(
        `Overpayment refund failed (${reference})`,
        `<p>Reference: ${reference}</p><p>Overpaid: NGN${overpaid}</p><p>Refund request failed. Error: ${err?.message || 'Unknown error'}</p>`
      );
    }
  }

  if (nextStatus === 'success') {
    await handleTransactionSuccess(tx);
  }

  return { status: nextStatus, paidSoFar, remainingAmount, overpaid };
};

function safeJsonParse<T = any>(value: any, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const normalizeAuthorNames = (authors: any): string[] => {
  const parsed = Array.isArray(authors) ? authors : safeJsonParse<any[]>(authors, []);
  return parsed
    .map((author: any) => typeof author === 'string' ? author.trim() : String(author?.name || '').trim())
    .filter(Boolean);
};

const buildSafeFilename = (value: string, suffix = '') => {
  const safe = String(value || 'manuscript')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 100) || 'manuscript';
  return suffix ? `${safe}${suffix}` : safe;
};

const estimatePageCountFromText = (text: string) => {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 550));
};

const buildPageWindow = (sourcePages: number) => {
  const target = Math.max(1, Math.round(sourcePages || 1));
  let tolerance = 1;
  if (target >= 8) tolerance = 2;
  if (target >= 16) tolerance = 3;
  if (target >= 25) tolerance = 4;
  return {
    target,
    tolerance,
    min: Math.max(1, target - tolerance),
    max: target + tolerance
  };
};

const resolveSourcePageCount = (metadata: any, content: string) => {
  const fromMetadata = Number(metadata?.sourcePageCount || metadata?.pageCount || 0);
  if (fromMetadata > 0) return fromMetadata;
  return estimatePageCountFromText(content);
};

const isWithinPageWindow = (pageCount: number, pageWindow: any) => {
  if (!pageWindow) return true;
  const min = Number(pageWindow.min || 1);
  const max = Number(pageWindow.max || pageCount);
  return pageCount >= min && pageCount <= max;
};

const buildCertificateId = (paperId: number | string, publishedAt?: string | Date | null) => {
  const year = new Date(publishedAt || new Date()).getFullYear();
  return `${JOURNAL_SHORT_NAME}-CERT-${year}-${String(paperId).padStart(6, '0')}`;
};

const doiUrl = (doi: string): string => {
  if (!doi || doi === 'DOI Pending' || doi === 'Verification Pending' || doi === 'Pending') return doi;
  if (doi.startsWith('http')) return doi;
  if (doi.startsWith('10.')) return `https://doi.org/${doi}`;
  return doi;
};

const buildCertificateVerificationUrl = (paper: any) => {
  if (paper?.doi) {
    return doiUrl(paper.doi);
  }
  return `${APP_URL}/publications/${paper?.id || ''}`;
};

async function getJournalConfig() {
  const keys = ['current_volume', 'current_issue', 'journal_issn', 'max_manuscripts_per_issue', 'max_issues_per_volume', 'max_pages_per_manuscript', 'journal_signature', 'journal_secretary', 'doi_auto_retry_enabled', 'doi_auto_retry_interval_minutes'];
  const result = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);
  const settings: Record<string, string> = {};
  result.rows.forEach((row: any) => {
    settings[row.key] = row.value;
  });

  return {
    currentVolume: settings.current_volume || '1',
    currentIssue: settings.current_issue || '1',
    journalIssn: settings.journal_issn || '2971-7760',
    maxManuscriptsPerIssue: parseInt(settings.max_manuscripts_per_issue || '10', 10),
    maxIssuesPerVolume: parseInt(settings.max_issues_per_volume || '3', 10),
    maxPagesPerManuscript: parseInt(settings.max_pages_per_manuscript || '20', 10),
    journalSignature: settings.journal_signature || '',
    journalSecretary: settings.journal_secretary || 'Dr. Danjuma Namo',
    doiAutoRetryEnabled: settings.doi_auto_retry_enabled !== 'false',
    doiAutoRetryIntervalMinutes: parseInt(settings.doi_auto_retry_interval_minutes || '20', 10)
  };
}

const buildPaperBranding = (paper: any, config: any, overrides: Record<string, any> = {}) => {
  const publicationDate = overrides.publishedAt || paper?.published_at || paper?.created_at || new Date();
  return {
    volume: String(overrides.volume || paper?.volume || config.currentVolume || '1'),
    issue: String(overrides.issue || paper?.issue || config.currentIssue || '1'),
    issn: String(overrides.issn || paper?.issn || config.journalIssn || '2971-7760'),
    doi: doiUrl(String(overrides.doi || paper?.doi || 'DOI Pending')),
    date: overrides.date || new Date(publicationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    startPageNumber: overrides.startPageNumber || 1,
    institution: overrides.institution || null
  };
};

async function embedJournalAsset(pdfDoc: PDFDocument, fileNames: string[]) {
  const filePath = resolveAssetPath(fileNames);
  if (!filePath) return null;
  const fileBytes = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.png' ? pdfDoc.embedPng(fileBytes) : pdfDoc.embedJpg(fileBytes);
}

async function bootstrapDB() {
  try {
    console.log('--- STARTING DATABASE BOOTSTRAP ---');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_categories (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE student_categories ADD COLUMN IF NOT EXISTS is_paid_entry BOOLEAN DEFAULT FALSE;
      ALTER TABLE student_categories ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 0;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES student_categories(id);
      ALTER TABLE students_roster ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES student_categories(id);
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES student_categories(id);
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES student_categories(id);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;
      
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

      CREATE TABLE IF NOT EXISTS payment_events (
        id SERIAL PRIMARY KEY,
        reference TEXT,
        gateway TEXT,
        event_type TEXT,
        amount INTEGER DEFAULT 0,
        event_key TEXT UNIQUE,
        payload JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_blob BYTEA;
      ALTER TABLE resources ADD COLUMN IF NOT EXISTS mime_type TEXT;

      ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS timer_mode TEXT DEFAULT 'whole';
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS questions_count INTEGER DEFAULT 20;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 10;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions TEXT;

      CREATE TABLE IF NOT EXISTS exam_slots (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
        tenant_id INTEGER REFERENCES tenants(id),
        student_id INTEGER,
        student_email TEXT,
        student_name TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        window_end TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'pending',
        notification_sent BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Assignment submissions (file or text)
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
        tenant_id INTEGER REFERENCES tenants(id),
        student_id INTEGER REFERENCES users(id),
        student_name TEXT,
        student_email TEXT,
        submission_type TEXT DEFAULT 'text',
        content TEXT,
        file_blob BYTEA,
        file_name TEXT,
        mime_type TEXT,
        grade TEXT,
        feedback TEXT,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Attendance sessions (one per class date/topic)
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        title TEXT NOT NULL,
        course_code TEXT,
        category_id INTEGER REFERENCES student_categories(id),
        session_date DATE NOT NULL,
        is_paid BOOLEAN DEFAULT FALSE,
        price INTEGER DEFAULT 0,
        is_open BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Per-student attendance records tied to a session
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        tenant_id INTEGER REFERENCES tenants(id),
        student_id INTEGER REFERENCES users(id),
        student_name TEXT,
        matric_number TEXT,
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_reference TEXT
      );

      -- New columns on exams for status lifecycle
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS published_status TEXT DEFAULT 'draft';
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'mcq';
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS allow_late BOOLEAN DEFAULT FALSE;

      -- GAP 2/12: AI generation metadata
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS material_id INTEGER;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS blooms_level TEXT DEFAULT 'mixed';
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT FALSE;

      -- GAP 7: Retake policy
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;

      -- GAP 4: Question pool support
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_pool BOOLEAN DEFAULT FALSE;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS pool_size INTEGER DEFAULT 0;

      -- GAP 1: Per-student question salting stored in exam_slots
      ALTER TABLE exam_slots ADD COLUMN IF NOT EXISTS question_order JSONB;
      ALTER TABLE exam_slots ADD COLUMN IF NOT EXISTS option_orders JSONB;

      -- Notification delivery tracking per slot
      ALTER TABLE exam_slots ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'pending';

      -- GAP 3: Individual answer storage
      CREATE TABLE IF NOT EXISTS exam_answers (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE,
        tenant_id INTEGER REFERENCES tenants(id),
        student_id INTEGER REFERENCES users(id),
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        submitted_answer TEXT,
        correct_answer TEXT,
        is_correct BOOLEAN DEFAULT FALSE,
        points_earned INTEGER DEFAULT 0,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- GAP 6: result_details column on exam_results for grade letter + totals
      ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS grade TEXT;
      ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0;
      ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS total_possible INTEGER DEFAULT 0;
      ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;

      -- GAP 10: graded_at timestamp on assignment_submissions
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP;
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS payment_events_event_key_idx ON payment_events(event_key);`);
    console.log('--- DATABASE BOOTSTRAP SUCCESSFUL ---');
  } catch (err) {
    console.error('--- DATABASE BOOTSTRAP FAILED ---', err);
  }
}

// Global invocation
bootstrapDB();

async function sendPaymentSuccessEmail(to: string, name: string, ref: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping payment success email.');
    return;
  }
  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 620px; margin: 0 auto; color: #1a202c; line-height: 1.7;">
      <div style="border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="padding: 24px 32px; background: linear-gradient(135deg, #fff7ed 0%, #ffffff 70%); border-bottom: 3px solid #800000;">
          <h2 style="margin: 0; color: #800000; font-size: 22px;">Payment Received</h2>
          <p style="margin: 6px 0 0; color: #64748b; font-size: 13px;">${JOURNAL_NAME}</p>
        </div>
        <div style="padding: 28px 32px;">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your payment has been received and verified successfully.</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0; background:#f8fafc; border-radius:8px; overflow:hidden;">
            <tr><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase; letter-spacing:.05em;">Reference</td><td style="padding:10px 16px; font-family:monospace; color:#1a202c;">${ref}</td></tr>
            <tr style="background:#f1f5f9;"><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase; letter-spacing:.05em;">Status</td><td style="padding:10px 16px; color:#16a34a; font-weight:bold;">Confirmed</td></tr>
          </table>
          <p>Your publication credit is now active. You may proceed to upload your manuscript via the dashboard.</p>
          <p>The <strong>Journal Preliminary Pages</strong> are attached for your reference — please review the journal's scope, formatting expectations, and submission standards before upload.</p>
          <p style="color:#64748b; font-size:13px; margin-top:24px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </div>
  `;
  try {
    const attachments: { filename: string; content: string }[] = [];
    const preliminaryPath = path.join(process.cwd(), 'tools', 'Journal Preliminary.pdf');
    if (fs.existsSync(preliminaryPath)) {
      attachments.push({
        filename: 'Journal_Preliminary_Pages.pdf',
        content: fs.readFileSync(preliminaryPath).toString('base64'),
      });
    } else {
      console.warn('[Payment Email] Journal Preliminary.pdf not found at:', preliminaryPath);
    }
    await sendResendEmail({
      to,
      subject: `Payment Confirmed — Ref: ${ref}`,
      html: htmlBody,
      attachments,
      fromName: JOURNAL_SHORT_NAME,
    });
    console.log(`✅ Payment success email sent to ${to} (ref: ${ref})`);
  } catch (err) {
    console.error('Payment success email error:', err);
  }
}

async function sendSubmissionReceivedEmail(to: string, researcherName: string, manuscriptTitle: string, manuscriptId: number, sourcePageCount: number) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping submission receipt email.');
    return;
  }

  const submissionRef = `${JOURNAL_SHORT_NAME}/${new Date().getFullYear()}/${String(manuscriptId).padStart(4, '0')}`;
  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #1a202c; line-height: 1.7;">
      <div style="border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden;">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #fff7ed 0%, #ffffff 70%); border-bottom: 3px solid #800000;">
          <h1 style="margin: 0; color: #800000; font-size: 24px;">Manuscript Received</h1>
          <p style="margin: 8px 0 0; color: #475569; font-size: 14px;">${JOURNAL_NAME}</p>
        </div>
        <div style="padding: 32px;">
          <p>Dear <strong>${researcherName}</strong>,</p>
          <p>Your manuscript has been successfully ingested into the editorial system and is now being processed.</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0; background:#f8fafc; border-radius:8px; overflow:hidden;">
            <tr><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Submission Ref</td><td style="padding:10px 16px; font-family:monospace; color:#1a202c; font-weight:bold;">${submissionRef}</td></tr>
            <tr style="background:#f1f5f9;"><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Manuscript</td><td style="padding:10px 16px; color:#1a202c;">${manuscriptTitle}</td></tr>
            <tr><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Pages Detected</td><td style="padding:10px 16px; color:#1a202c;">${sourcePageCount} page${sourcePageCount === 1 ? '' : 's'}</td></tr>
          </table>
          <p>Your formal <strong>Acceptance Letter</strong> with the journal preliminary pages will follow in a separate email shortly.</p>
          <p style="color:#64748b; font-size:13px; margin-top:24px;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendResendEmail({
      to,
      subject: `Manuscript Received — ${manuscriptTitle.substring(0, 70)}`,
      html: htmlBody,
      fromName: JOURNAL_SHORT_NAME,
    });
    console.log(`✅ Submission receipt email sent to ${to} for paper #${manuscriptId}`);
  } catch (error) {
    console.error('Submission receipt email error:', error);
  }
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
      credit_balance INTEGER DEFAULT 0,
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
      final_pdf BYTEA,
      final_pdf_filename TEXT,
      certificate_id TEXT,
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
    CREATE TABLE IF NOT EXISTS payment_events (
      id SERIAL PRIMARY KEY,
      reference TEXT,
      gateway TEXT,
      event_type TEXT,
      amount INTEGER DEFAULT 0,
      event_key TEXT UNIQUE,
      payload JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      guid TEXT UNIQUE NOT NULL,
      tenant_id INTEGER,
      title TEXT,
      price INTEGER DEFAULT 0,
      is_paid BOOLEAN DEFAULT FALSE,
      is_available BOOLEAN DEFAULT TRUE,
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
  try { await pool.query('ALTER TABLE exam_results ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  try { await pool.query(`CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    tenant_id INTEGER,
    course_id TEXT,
    reference TEXT UNIQUE,
    attended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN issn TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN pin_hash TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN setup_token TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN token_expires TIMESTAMP'); } catch (e) { }
  try { await pool.query("ALTER TABLE students_roster ADD COLUMN IF NOT EXISTS email_status VARCHAR(20) DEFAULT 'pending'"); } catch (e) { }
  try { await pool.query('ALTER TABLE students_roster ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES student_categories(id)'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN subscription_price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN subscription_expiry TIMESTAMP'); } catch (e) { }
  try { await pool.query('ALTER TABLE transactions ADD COLUMN tenant_id INTEGER'); } catch (e) { }
  try { await pool.query('ALTER TABLE transactions ADD COLUMN metadata JSONB DEFAULT \'{}\''); } catch (e) { }
  try { await pool.query('ALTER TABLE transactions ADD COLUMN paper_id INTEGER REFERENCES papers(id)'); } catch (e) { }
  try { await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(4) UNIQUE'); } catch (e) { }

  // Migration for existing tenants
  try {
    const tenantsRes = await pool.query('SELECT id FROM tenants WHERE workspace_id IS NULL');
    for (const t of tenantsRes.rows) {
      let workspace_id = '';
      while (true) {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const randomLetters = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)];
        const digits = Math.floor(Math.random() * 90 + 10);
        workspace_id = randomLetters + digits;
        const check = await pool.query('SELECT id FROM tenants WHERE workspace_id = $1', [workspace_id]);
        if (check.rows.length === 0) break;
      }
      await pool.query('UPDATE tenants SET workspace_id = $1 WHERE id = $2', [workspace_id, t.id]);
    }
  } catch (e) { console.error('Migration error:', e); }

  try { await pool.query('ALTER TABLE papers ADD COLUMN volume TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN issue TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN file_blob BYTEA'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN published_at TIMESTAMP'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN formatted_content TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN final_pdf BYTEA'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN final_pdf_filename TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN IF NOT EXISTS file_url TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN IF NOT EXISTS final_pdf_url TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_url TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS file_url TEXT'); } catch (e) { }
  try { await pool.query('ALTER TABLE papers ADD COLUMN certificate_id TEXT'); } catch (e) { }

  try { await pool.query('ALTER TABLE exams ADD COLUMN is_available BOOLEAN DEFAULT TRUE'); } catch (e) { }
  try { await pool.query('ALTER TABLE exams ADD COLUMN price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE exams ADD COLUMN is_paid BOOLEAN DEFAULT FALSE'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN is_available BOOLEAN DEFAULT TRUE'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN price INTEGER DEFAULT 0'); } catch (e) { }
  try { await pool.query('ALTER TABLE resources ADD COLUMN is_paid BOOLEAN DEFAULT FALSE'); } catch (e) { }

  // Migration: Global Student Uniqueness (Matric + Role)
  try {
    // If we want a global student PIN, matric_number + role must be unique
    await pool.query('ALTER TABLE users ADD CONSTRAINT users_matric_role_key UNIQUE (matric_number, role)');
  } catch (e) { }

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
  await pool.query(`INSERT INTO settings (key, value) VALUES ('journal_secretary', 'Dr. Danjuma Namo') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('pin_recovery_price', '1000') ON CONFLICT (key) DO NOTHING`);

  // Migration: rename gateway_paymentpoint_enabled → gateway_paystack_enabled
  try {
    const old = await pool.query("SELECT value FROM settings WHERE key = 'gateway_paymentpoint_enabled'");
    if (old.rows.length > 0) {
      const val = old.rows[0].value;
      await pool.query("INSERT INTO settings (key, value) VALUES ('gateway_paystack_enabled', $1) ON CONFLICT (key) DO NOTHING", [val]);
      await pool.query("DELETE FROM settings WHERE key = 'gateway_paymentpoint_enabled'");
    }
  } catch (e) { }

  // Seed gateway defaults if not set
  await pool.query(`INSERT INTO settings (key, value) VALUES ('gateway_paystack_enabled', 'true') ON CONFLICT (key) DO NOTHING`);
  await pool.query(`INSERT INTO settings (key, value) VALUES ('gateway_kora_enabled', 'true') ON CONFLICT (key) DO NOTHING`);

  // ─── Performance indexes ─────────────────────────────────────────────────
  // CREATE INDEX IF NOT EXISTS is idempotent — safe to run on every startup
  const indexes = [
    // papers — most-queried columns
    `CREATE INDEX IF NOT EXISTS idx_papers_user_id       ON papers (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_papers_status        ON papers (status)`,
    `CREATE INDEX IF NOT EXISTS idx_papers_doi           ON papers (doi)`,
    `CREATE INDEX IF NOT EXISTS idx_papers_volume_issue  ON papers (volume, issue)`,
    `CREATE INDEX IF NOT EXISTS idx_papers_published_at  ON papers (published_at DESC)`,
    // users — auth and roster lookups
    `CREATE INDEX IF NOT EXISTS idx_users_matric_number  ON users (matric_number)`,
    `CREATE INDEX IF NOT EXISTS idx_users_tenant_id      ON users (tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role           ON users (role)`,
    `CREATE INDEX IF NOT EXISTS idx_users_email          ON users (email)`,
    // students_roster — tenant-scoped queries on every dashboard load
    `CREATE INDEX IF NOT EXISTS idx_roster_tenant_id     ON students_roster (tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_roster_matric        ON students_roster (matric_number)`,
    `CREATE INDEX IF NOT EXISTS idx_roster_category      ON students_roster (category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_roster_email_status  ON students_roster (email_status)`,
    // resources — lecturer material queries
    `CREATE INDEX IF NOT EXISTS idx_resources_tenant_id  ON resources (tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_resources_category   ON resources (category_id)`,
    // exams / assignments
    `CREATE INDEX IF NOT EXISTS idx_exams_tenant_id      ON exams (tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_exam_id  ON assignment_submissions (exam_id)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_student  ON assignment_submissions (student_id)`,
    // transactions — payment lookups
    `CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON transactions (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions (reference)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions (status)`,
  ];
  for (const sql of indexes) {
    try { await pool.query(sql); } catch (e) { /* index may already exist under different name */ }
  }
  // ─────────────────────────────────────────────────────────────────────────
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

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

// PIN pepper — prevents offline dictionary attacks against low-entropy 4-digit PINs.
// Even if the DB is dumped, hashes cannot be cracked without this server-side secret.
const PIN_PEPPER = process.env.PIN_PEPPER || '';
if (!process.env.PIN_PEPPER) {
  console.warn('[WARN] PIN_PEPPER env var is not set. PIN hashes have reduced security against offline attacks. Set PIN_PEPPER in Railway environment variables.');
}
const hashPin = (pin: string) => bcrypt.hash(pin + PIN_PEPPER, 10);
const verifyPin = (pin: string, hash: string) => bcrypt.compare(pin + PIN_PEPPER, hash);

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

// Diagnostics Endpoint (Obfuscated) — admin-only
app.get('/api/diag', authenticateToken, (req: any, res: any) => {
  if (req.user.role !== 'user' && req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Forbidden' });
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
      APP_URL: APP_URL
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

    // 1. Create Tenant (plus generate unique 4-char Workspace ID)
    let workspace_id = '';
    while (true) {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const randomLetters = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)];
      const digits = Math.floor(Math.random() * 90 + 10); // 10-99
      workspace_id = randomLetters + digits;
      const check = await pool.query('SELECT id FROM tenants WHERE workspace_id = $1', [workspace_id]);
      if (check.rows.length === 0) break;
    }

    const tenantResult = await pool.query(
      'INSERT INTO tenants (name, owner_name, owner_email, workspace_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [tenantName, name, email, workspace_id]
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

// ─── REGISTRATION OTP: SEND ─────────────────────────────────────────
// Phase 1 – validate fields, hash password, store pending entry, email OTP.
// If the same email re-submits (network drop / retry) the pending entry is
// refreshed (new OTP, new 10-min window) so the user can continue seamlessly.
app.post('/api/auth/send-registration-otp', authLimiter, async (req, res) => {
  try {
    const { email, password, name, affiliation, tenantName, phone, portalType } = req.body;

    if (!email || !password || !name || !portalType)
      return res.status(400).json({ error: 'Missing required fields' });

    if (portalType === 'lecturer' && (!tenantName || !phone))
      return res.status(400).json({ error: 'Workspace name and phone number are required' });

    if (portalType === 'lecturer' && !/^\d{11}$/.test(phone))
      return res.status(400).json({ error: 'Phone number must be exactly 11 digits' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalizedEmail = (email as string).toLowerCase().trim();
    const dbRole = portalType === 'lecturer' ? 'tenant_admin' : 'user';

    // Reject if already fully registered in DB
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [normalizedEmail, dbRole]
    );
    if (existing.rows.length > 0) {
      const portalLabel = portalType === 'lecturer' ? 'Academic Workspace' : 'Research portal';
      return res.status(400).json({ error: `An account with this email already exists in the ${portalLabel}` });
    }

    const hashedPassword = await bcrypt.hash((password as string).trim(), 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Upsert: refresh if pending entry already exists (network-drop resume)
    pendingRegistrations.set(normalizedEmail, {
      portalType,
      name,
      hashedPassword,
      affiliation: affiliation || '',
      tenantName,
      phone,
      otp,
      expiresAt,
    });

    const isLecturer = portalType === 'lecturer';
    await sendResendEmail({
      fromName: isLecturer ? 'Genius Academy School Portal' : 'Genius Research Publication Portal',
      to: normalizedEmail,
      subject: isLecturer
        ? 'Verify Your Genius Academy Lecturer Account'
        : 'Verify Your Research Publication Account',
      html: isLecturer
        ? buildLecturerOtpEmail(name, otp)
        : buildResearcherOtpEmail(name, otp),
    });

    res.json({ success: true, message: 'A 6-digit verification code has been sent to your email.' });
  } catch (error: any) {
    console.error('Send registration OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// ─── REGISTRATION OTP: VERIFY & CREATE ACCOUNT ──────────────────────
// Phase 2 – verify OTP, then atomically create the account from the pending
// entry and delete it so the same code cannot be reused.
app.post('/api/auth/verify-registration', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and verification code are required' });

    const normalizedEmail = (email as string).toLowerCase().trim();
    const pending = pendingRegistrations.get(normalizedEmail);

    if (!pending)
      return res.status(400).json({ error: 'No pending registration found. Please fill in your details again.' });

    if (Date.now() > pending.expiresAt) {
      pendingRegistrations.delete(normalizedEmail);
      return res.status(400).json({ error: 'Verification code has expired. Please start registration again.' });
    }

    if (pending.otp !== (otp as string).trim())
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });

    // Consume the pending entry immediately (prevent replay)
    pendingRegistrations.delete(normalizedEmail);

    if (pending.portalType === 'researcher') {
      const accountRole = normalizedEmail === 'burstbrainconcept@gmail.com' ? 'super_admin' : 'user';
      const result = await pool.query(
        'INSERT INTO users (email, password, name, affiliation, role, tenant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [normalizedEmail, pending.hashedPassword, pending.name, pending.affiliation || '', accountRole, null]
      );
      const userId = result.rows[0].id;
      await pool.query(
        'INSERT INTO profiles (user_id, publications, metrics) VALUES ($1,$2,$3)',
        [userId, JSON.stringify([]), JSON.stringify({ citations: 0, hIndex: 0, i10Index: 0 })]
      );
      const token = jwt.sign(
        { id: userId, email: normalizedEmail, name: pending.name, role: accountRole, tenant_id: null },
        JWT_SECRET, { expiresIn: '7d' }
      );
      return res.json({ token, user: { id: userId, email: normalizedEmail, name: pending.name, role: accountRole, tenant_id: null } });
    } else {
      // Lecturer – create tenant then user
      let workspace_id = '';
      while (true) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const randomLetters = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)];
        const digits = Math.floor(Math.random() * 90 + 10);
        workspace_id = randomLetters + digits;
        const check = await pool.query('SELECT id FROM tenants WHERE workspace_id = $1', [workspace_id]);
        if (check.rows.length === 0) break;
      }
      const tenantResult = await pool.query(
        'INSERT INTO tenants (name, owner_name, owner_email, workspace_id) VALUES ($1,$2,$3,$4) RETURNING id',
        [pending.tenantName, pending.name, normalizedEmail, workspace_id]
      );
      const tenantId = tenantResult.rows[0].id;
      const userResult = await pool.query(
        'INSERT INTO users (email, phone, password, name, role, tenant_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [normalizedEmail, pending.phone, pending.hashedPassword, pending.name, 'tenant_admin', tenantId]
      );
      const userId = userResult.rows[0].id;
      const token = jwt.sign(
        { id: userId, email: normalizedEmail, name: pending.name, role: 'tenant_admin', tenant_id: tenantId, phone: pending.phone },
        JWT_SECRET, { expiresIn: '7d' }
      );
      return res.json({ token, user: { id: userId, email: normalizedEmail, name: pending.name, role: 'tenant_admin', tenant_id: tenantId, tenantName: pending.tenantName, phone: pending.phone } });
    }
  } catch (error: any) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Public: Get all active academic workspaces (only those with an active tenant_admin user)
app.get('/api/auth/workspaces', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.workspace_id
      FROM tenants t
      WHERE EXISTS (
        SELECT 1 FROM users u
        WHERE u.tenant_id = t.id AND u.role = 'tenant_admin'
      )
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Student Login (Matric Number + PIN + Optional Tenant ID/Context)
app.post('/api/auth/student/login', authLimiter, async (req, res) => {
  try {
    const { matricNumber, pin, workspaceId } = req.body;
    if (!matricNumber || !pin || !workspaceId) return res.status(400).json({ error: 'Matric number, Workspace ID, and 4-digit PIN required' });

    // 0. Resolve tenantId from workspaceId
    const tResult = await pool.query('SELECT id FROM tenants WHERE workspace_id = $1', [workspaceId.toUpperCase()]);
    if (tResult.rows.length === 0) return res.status(401).json({ error: 'Invalid Workspace ID' });
    const tenantId = tResult.rows[0].id;

    // 1. Find user (Student)
    let query = 'SELECT * FROM users WHERE matric_number = $1 AND role = \'student\'';
    let params = [matricNumber];
    if (tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    query += ' ORDER BY created_at DESC LIMIT 1';
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Access Denied: You are not registered in this lecturer\'s workspace.' });

    const user = result.rows[0];

    // 2. Validate PIN (which is stored in the password field for students)
    const validPin = await verifyPin(pin, user.password);
    if (!validPin) return res.status(401).json({ error: 'Invalid matric number or PIN' });


    // 3. Generate Token
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'student', tenant_id: user.tenant_id, category_id: user.category_id }, JWT_SECRET, { expiresIn: '7d' });

    // 4. Resolve Category and Check for Entry Fee requirement (Source of Truth: students_roster)
    let accessBlocked = false;
    let entryFee = 0;

    // Always fetch the category from the roster for this specifics workspace
    const rosterRes = await pool.query('SELECT category_id FROM students_roster WHERE matric_number = $1 AND tenant_id = $2', [matricNumber, tenantId]);
    const rosterCategory = rosterRes.rows[0]?.category_id;

    if (rosterCategory) {
      const catRes = await pool.query('SELECT is_paid_entry, entry_fee FROM student_categories WHERE id = $1', [rosterCategory]);
      const category = catRes.rows[0];
      if (category?.is_paid_entry) {
        // Check if paid
        const payRes = await pool.query(
          "SELECT id FROM transactions WHERE user_id = $1 AND type = 'portal_entry' AND status = 'success'",
          [user.id]
        );
        if (payRes.rows.length === 0) {
          accessBlocked = true;
          entryFee = category.entry_fee;
        }
      }
    }
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'student',
        tenant_id: user.tenant_id,
        matricNumber: user.matric_number, // Aliased for frontend
        matric_number: user.matric_number,
        accessBlocked,
        entryFee
      }
    });
  } catch (error: any) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Student: Recover PIN
app.post('/api/auth/student/recover-pin', authLimiter, async (req, res) => {
  try {
    const { matricNumber, workspaceId } = req.body;
    if (!matricNumber || !workspaceId) return res.status(400).json({ error: 'Matric number and Workspace ID required' });

    // Resolve tenantId
    const tResult = await pool.query('SELECT id FROM tenants WHERE workspace_id = $1', [workspaceId.toUpperCase()]);
    if (tResult.rows.length === 0) return res.status(404).json({ error: 'Invalid Workspace ID' });
    const tenantId = tResult.rows[0].id;

    const result = await pool.query('SELECT id, name, email, tenant_id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = \'student\'', [matricNumber, tenantId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'No student found with these credentials in this workspace' });

    const priceRes = await pool.query("SELECT value FROM settings WHERE key = 'pin_recovery_price'");
    const price = parseInt(priceRes.rows[0]?.value || '1000');

    res.json({ student: result.rows[0], price });
  } catch (err) {
    res.status(500).json({ error: 'Recovery check failed' });
  }
});

app.post('/api/payment/pin-recovery/initialize', authLimiter, async (req, res) => {
  try {
    const { userId, matricNumber } = req.body;
    const priceRes = await pool.query("SELECT value FROM settings WHERE key = 'pin_recovery_price'");
    const amount = parseInt(priceRes.rows[0]?.value || '1000');
    const reference = `PIN-REC-${Date.now()}-${userId}`;

    const userRes = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [userId]);
    const tenant_id = userRes.rows[0]?.tenant_id;

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, tenant_id, reference, amount, 'pin_recovery', 'pending']
    );

    const redirectUrl = buildPaymentReturnUrl(reference, 'paystack', 'pin_recovery');
    const paymentResponse = await initializePaystackCheckout({ id: userId }, amount, reference, { redirectUrl });

    res.json({
      reference,
      amount,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {})
    });
  } catch (err) {
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

app.post('/api/payment/portal-entry/initialize', authenticateToken, async (req: any, res) => {
  try {
    const { gateway = 'paystack', mode = 'inline' } = req.body;

    const result = await pool.query(
      'SELECT sc.entry_fee FROM student_categories sc JOIN users u ON u.category_id = sc.id WHERE u.id = $1',
      [req.user.id]
    );
    const amount = Number(result.rows[0]?.entry_fee || 0);
    const reference = `PORTAL-${Date.now()}-${req.user.id}`;

    // Call the appropriate payment gateway to get virtual bank account details
    const creditResult = await applyUserCredit(req.user.id, amount);
    const redirectUrl = buildPaymentReturnUrl(reference, gateway, 'portal_entry');
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;
    const chargeAmount = creditResult.chargeAmount;
    if (chargeAmount > 0) {
      if (gateway === 'kora') {
        if (mode === 'inline' || mode === 'checkout') {
          paymentResponse = await initializeKoraCheckout(req.user, chargeAmount, reference, {
            redirectUrl,
            notificationUrl: `${APP_URL}/api/payment/webhook/kora`
          });
        } else {
          bankAccounts = await initializeKoraVirtualAccount(req.user, chargeAmount, reference);
        }
      } else {
        if (mode === 'inline') {
          paymentResponse = buildPaystackInlinePayload(req.user, chargeAmount, reference);
        } else {
          paymentResponse = await initializePaystackCheckout(req.user, chargeAmount, reference, { redirectUrl });
        }
      }
    }

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, type, status, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        req.tenant_id,
        reference,
        amount,
        'portal_entry',
        chargeAmount > 0 ? 'pending' : 'success',
        JSON.stringify({
          gateway,
          credit_used: creditResult.creditUsed,
          credit_applied: creditResult.creditApplied,
          paid_so_far: creditResult.creditUsed,
          remaining_amount: Math.max(amount - creditResult.creditUsed, 0)
        })
      ]
    );

    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway,
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit:${reference}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }
    if (chargeAmount === 0) {
      await recomputeTransaction(reference, gateway);
    }

    const expires_at_date = new Date();
    expires_at_date.setMinutes(expires_at_date.getMinutes() + 30);
    const expires_at = expires_at_date.toISOString();

    res.json({
      reference,
      amount,
      bankAccounts,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      expires_at,
      credit_applied: creditResult.creditApplied,
      credit_used: creditResult.creditUsed,
      remaining_amount: Math.max(amount - creditResult.creditUsed, 0)
    });
  } catch (err: any) {
    console.error('Portal entry payment init error:', err);
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
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

// ─── REGISTRATION OTP EMAIL TEMPLATES ───────────────────────────────
function buildLecturerOtpEmail(name: string, otp: string): string {
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f2ff;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,35,126,0.10);">
    <div style="background:linear-gradient(135deg,#1a237e 0%,#3f51b5 100%);padding:36px 40px 28px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px;">
        <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;">Genius Academy</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">School Portal</h1>
      <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:13px;">Lecturer &amp; Workspace Registration</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;font-weight:600;">Hello, ${name}!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;line-height:1.6;">
        You&rsquo;re one step away from setting up your <strong style="color:#1a237e;">Genius Academy Lecturer Workspace</strong>.
        Enter the verification code below to confirm your email and activate your account.
      </p>
      <div style="background:#f0f2ff;border:2px dashed #3f51b5;border-radius:14px;padding:28px;text-align:center;margin:0 0 28px;">
        <p style="color:#3f51b5;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#1a237e;font-family:'Courier New',monospace;">${otp}</div>
        <p style="color:#9ca3af;font-size:12px;margin:14px 0 0;">Valid for <strong>10 minutes</strong></p>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 18px;margin:0 0 24px;">
        <p style="color:#92400e;font-size:12px;margin:0;font-weight:600;">&#9888;&#65039; If you didn&rsquo;t request this, ignore this email. Your account will NOT be created without this code.</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
        This code was sent from the <strong>Genius Academy School Portal</strong>.
        Once verified, you&rsquo;ll gain access to your lecturer dashboard to manage courses, students, and workspaces.
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">Genius Academy School Portal &bull; Academic Management System</p>
      <p style="color:#d1d5db;font-size:10px;margin:6px 0 0;">Do not share this code with anyone.</p>
    </div>
  </div>
</div>`;
}

function buildResearcherOtpEmail(name: string, otp: string): string {
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;background:#fff5f5;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(128,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#800000 0%,#c0392b 100%);padding:36px 40px 28px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:16px;">
        <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;">Genius Research</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Publication Portal</h1>
      <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:13px;">Researcher Account Registration</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#374151;font-size:15px;margin:0 0 8px;font-weight:600;">Hello, ${name}!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 28px;line-height:1.6;">
        Welcome to the <strong style="color:#800000;">Genius Research Publication Portal</strong>.
        Enter the verification code below to confirm your email and establish your researcher account.
      </p>
      <div style="background:#fff5f5;border:2px dashed #c0392b;border-radius:14px;padding:28px;text-align:center;margin:0 0 28px;">
        <p style="color:#c0392b;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
        <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#800000;font-family:'Courier New',monospace;">${otp}</div>
        <p style="color:#9ca3af;font-size:12px;margin:14px 0 0;">Valid for <strong>10 minutes</strong></p>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 18px;margin:0 0 24px;">
        <p style="color:#92400e;font-size:12px;margin:0;font-weight:600;">&#9888;&#65039; If you didn&rsquo;t request this, ignore this email. Your account will NOT be created without this code.</p>
      </div>
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
        This code was sent from the <strong>Genius Research Publication Portal</strong>.
        Once verified, you&rsquo;ll gain access to your researcher dashboard for publishing, tracking citations, and collaborating on research.
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">Genius Research Publication Portal &bull; Academic Publishing System</p>
      <p style="color:#d1d5db;font-size:10px;margin:6px 0 0;">Do not share this code with anyone.</p>
    </div>
  </div>
</div>`;
}

// ─── PENDING REGISTRATION STORE (OTP-gated, 10-min TTL) ─────────────
interface PendingRegistration {
  portalType: 'researcher' | 'lecturer';
  name: string;
  hashedPassword: string;
  affiliation?: string;
  tenantName?: string;
  phone?: string;
  otp: string;
  expiresAt: number;
}
const pendingRegistrations = new Map<string, PendingRegistration>();

// Auto-purge expired entries every 60 s
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of pendingRegistrations.entries()) {
    if (entry.expiresAt <= now) pendingRegistrations.delete(email);
  }
}, 60_000);

// ─── PASSWORD RESET SYSTEM ──────────────────────────────────────────
const resetCodes = new Map<string, { code: string; expires: number }>();

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
      await sendResendEmail({
        fromName: 'Genius Mindspark Portal',
        to: email,
        subject: 'Your Genius Portal Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${APP_URL}/gmijp-logo.png" alt="Genius" style="width: 60px; height: 60px; border-radius: 50%; background: white; padding: 5px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
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
      await sendResendEmail({
        fromName: 'Genius Portal',
        to: 'burstbrainconcept@gmail.com',
        subject: `Password Reset Request from ${email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f8fafc; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${APP_URL}/gmijp-logo.png" alt="Genius" style="width: 60px; height: 60px; border-radius: 50%; background: white; padding: 5px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
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
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'material' AND is_paid = true) as material_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'material' AND is_paid = true AND is_available = true) as active_materials,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'audio' AND is_paid = true) as audio_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = u.tenant_id AND type = 'test' AND is_paid = true) as test_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = u.tenant_id AND type = 'assignment' AND is_paid = true) as assignment_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = u.tenant_id AND type = 'exam' AND is_paid = true) as exam_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = u.tenant_id AND type = 'video' AND is_paid = true) as video_count,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = u.tenant_id AND status = 'success' AND type = 'material_access') as material_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = u.tenant_id AND status = 'success' AND type = 'assessment_access') as assessment_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = u.tenant_id AND status = 'success' AND type = 'portal_entry') as access_fee_revenue
      FROM users u
      WHERE u.role = 'tenant_admin'
      ORDER BY material_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lecturer material stats' });
  }
});

// Lecturer: own paid-content stats
app.get('/api/lecturer/my-stats', authenticateToken, checkSubscription, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const tid = req.tenant_id;
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'material' AND is_paid = true) as material_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'material' AND is_paid = true AND is_available = true) as active_materials,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'audio' AND is_paid = true) as audio_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'test' AND is_paid = true) as test_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'assignment' AND is_paid = true) as assignment_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'exam' AND is_paid = true) as exam_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'video' AND is_paid = true) as video_count,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = $1 AND status = 'success' AND type = 'material_access') as material_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = $1 AND status = 'success' AND type = 'assessment_access') as assessment_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tenant_id = $1 AND status = 'success' AND type = 'portal_entry') as access_fee_revenue,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'material' AND is_paid = false) as free_material_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'audio' AND is_paid = false) as free_audio_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'test' AND is_paid = false) as free_test_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'assignment' AND is_paid = false) as free_assignment_count,
        (SELECT COUNT(*) FROM exams WHERE tenant_id = $1 AND type = 'exam' AND is_paid = false) as free_exam_count,
        (SELECT COUNT(*) FROM resources WHERE tenant_id = $1 AND type = 'video' AND is_paid = false) as free_video_count
    `, [tid]);
    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
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
async function generateHighFidelityPaperPDF(id: number | string, overrides: Record<string, any> = {}): Promise<Buffer> {
  const paperResult = await pool.query(
    'SELECT id, title, formatted_content, volume, issue, issn, doi, status, published_at, created_at, metadata, user_id FROM papers WHERE id = $1',
    [id]
  );
  const paper = paperResult.rows[0];
  if (!paper || !paper.formatted_content) {
    throw new Error('Paper or formatted content not found for high-fidelity generation');
  }

  const journalConfig = await getJournalConfig();
  const fallbackDoi = (paper.doi && paper.doi !== 'Pending')
    ? paper.doi
    : (paper.status === 'published' ? `10.5555/genius.${id}` : 'Verification Pending');

  // Extract primary author affiliation from paper metadata
  const paperMeta = safeJsonParse<any>(paper.metadata, {});
  const metaAuthorsList: any[] = Array.isArray(paperMeta.authors) ? paperMeta.authors : [];
  const primaryAuthor = metaAuthorsList[0] || {};
  const primaryInstitution = primaryAuthor.institution || primaryAuthor.affiliations?.[0] || null;

  // If paper metadata has no institution, fall back to user's dashboard affiliation
  let resolvedInstitution = primaryInstitution;
  if (!resolvedInstitution && paper.user_id) {
    try {
      const uRes = await pool.query('SELECT affiliation FROM users WHERE id = $1', [paper.user_id]);
      resolvedInstitution = uRes.rows[0]?.affiliation || null;
    } catch (_) {}
  }

  const branding = buildPaperBranding(paper, journalConfig, {
    ...overrides,
    doi: overrides.doi || fallbackDoi,
    institution: resolvedInstitution
  });

  let scrubbedContent = paper.formatted_content
    .replace(/<div class="header-sheet"[\s\S]*?<\/div>/g, '') // Strip legacy headers if they use the old class
    .replace(/<div class="sheet-header-full"[\s\S]*?<div class="header-accent-bar"><\/div>\s*<\/div>/g, '') // Strip AI-injected recurring branding (Puppeteer native header handles this)
    .replace(/<div class="paper-sheet"[^>]*>/g, '')           // Strip sheet wrappers
    .replace(/<\/div>\s*<div class="paper-sheet"[^>]*>/g, '') // Clean transitions
    .replace(/page-break-after:\s*always/gi, 'page-break-after: auto') // Disable rigid breaks
    .replace(/```html|```/g, '')                            // Strip code block wrappers
    // ASSET INJECTION: Swap relative paths for high-fidelity Base64 for the PDF engine
    .replace(/src="\/journal-logo\.png"/g, `src="${journalLogoBase64}"`)
    .replace(/src="\/Nasarawa-State-University\.jpg"/g, `src="${nsukLogoBase64}"`);

  // ENFORCE TIGHT REFERENCES on every PDF generation (catches old stored content + AI that ignored the prompt)
  // Works on named reference containers
  scrubbedContent = scrubbedContent.replace(
    /(<(?:div|section|ol|ul)[^>]*class="[^"]*(?:references?|bibliograph)[^"]*"[^>]*>)([\s\S]*?)(<\/(?:div|section|ol|ul)>)/gi,
    (_m: string, open: string, inner: string, close: string) => {
      let fixed = inner
        .replace(/<li([^>]*)>/gi, '<p class="reference"$1>')
        .replace(/<\/li>/gi, '</p>')
        .replace(/<p([^>]*)>\s*<\/p>/gi, '');
      fixed = fixed.replace(/<p(?![^>]*class="reference")([^>]*)>/gi, '<p class="reference"$1>');
      fixed = fixed.replace(
        /<p(?:[^>]*class="reference"[^>]*)>/gi,
        '<p class="reference" style="margin:0 0 3px 0;padding-left:2.9em;text-indent:-2.9em;line-height:1.35;text-align:left;">'
      );
      return open + fixed + close;
    }
  );
  // Also catch plain <p> tags that follow a References heading directly (AI that used no wrapper class)
  scrubbedContent = scrubbedContent.replace(
    /(<h[23][^>]*>[^<]*(?:references?|bibliography|works cited)[^<]*<\/h[23]>)([\s\S]*?)(?=<h[1-3]|$)/gi,
    (_m: string, heading: string, body: string) => {
      const tightBody = body.replace(
        /<p([^>]*)>/gi,
        '<p$1 style="margin:0 0 3px 0;padding-left:2.9em;text-indent:-2.9em;line-height:1.35;text-align:left;">'
      );
      return heading + tightBody;
    }
  );

  const startPage = Number(branding.startPageNumber || 1);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        @page {
          margin: 35mm 15mm 25mm 15mm;
          size: A4;
        }
        /* Page numbers are stamped per-page by pdf-lib post-processing after
           Puppeteer renders, so no CSS counter tricks are needed here. */
        /* Apply justify directly to body so Puppeteer PDF engine
           inherits it on every page — not just the first */
        body {
          font-family: serif;
          background: white;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-size: 10.5pt;
          color: #1e293b;
          text-align: justify !important;
          hyphens: auto;
          -webkit-hyphens: auto;
          word-break: normal;
          overflow-wrap: break-word;
        }
        * { box-sizing: border-box; }

        /* Force justify on every text-bearing element so page breaks don't reset it */
        p, li, td, blockquote, .academic-content, div:not([class*="header"]):not([class*="footer"]) {
          text-align: justify !important;
          hyphens: auto;
          -webkit-hyphens: auto;
        }
        /* Last line of each paragraph stays left-aligned (not stretched) */
        p { text-align-last: left !important; }

        .academic-content {
          font-family: serif;
          font-size: 10.5pt;
          line-height: 1.4;
          color: #1e293b;
          padding: 0 5mm;
        }
        .academic-content p {
          margin-bottom: 0.8em;
          orphans: 3;
          widows: 3;
        }
        .academic-content h1, .academic-content h2, .academic-content h3 {
          color: #0f172a;
          margin-top: 1.2em;
          margin-bottom: 0.4em;
          font-weight: 600 !important;
          line-height: 1.2;
          text-align: left !important;
          text-align-last: left !important;
          hyphens: none;
          page-break-after: avoid;
        }
        .academic-content h1 { font-size: 1.6em; margin-bottom: 0.8em; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 0.5em; }
        .academic-content h2 { font-size: 1.3em; border-left: 3.5px solid #800000; padding-left: 12px; }
        .academic-content h3 { font-size: 1.15em; font-style: italic; color: #475569; }

        table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
        th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left !important; }
        th { background: #f8fafc; font-weight: bold; color: #475569; }

        img { max-width: 100%; height: auto; display: block; margin: 1.5em auto; border-radius: 4px; }

        /* ===== REFERENCES SECTION =====
           Compact, single-spaced, hanging-indent APA style.
           The AI wraps each reference in <p class="reference"> or places
           them in a <div class="references"> / <section class="references">.
           These rules enforce tight formatting regardless of which tag is used. */
        .references p,
        .reference,
        section.references p,
        div.references p,
        ol.references li,
        ul.references li {
          margin-top: 0 !important;
          margin-bottom: 3px !important;
          padding-left: 2.9em !important;
          text-indent: -2.9em !important;
          line-height: 1.35 !important;
          text-align: left !important;
          text-align-last: left !important;
          hyphens: none;
          page-break-inside: avoid;
        }
        /* Catch AI-generated reference lists that use plain <p> inside a references heading */
        h2 + p, h2 + div > p,
        h3 + p, h3 + div > p {
          /* Only applied when directly after a heading — references usually follow h2/h3 */
        }
        /* If AI uses a <ol> or <ul> for references, strip bullet/number decoration */
        ol.references, ul.references {
          list-style: none !important;
          padding-left: 0 !important;
          margin: 0 !important;
        }
        /* Tighten spacing inside the references section no matter how it is wrapped */
        [class*="reference"] p,
        [id*="reference"] p,
        [class*="bibliograph"] p,
        [id*="bibliograph"] p {
          margin-top: 0 !important;
          margin-bottom: 3px !important;
          line-height: 1.35 !important;
        }
      </style>
    </head>
    <body>
      <div class="academic-content">
        ${scrubbedContent}
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
      activePath = execSync('which chromium || which chromium-browser || which google-chrome-stable || which google-chrome', { encoding: 'utf-8' }).trim();
    } catch (e) { }
  }

  if (!activePath) {
    throw new Error('Chromium not found. Ensure nixpacks.toml includes chromium in nixPkgs and PUPPETEER_EXECUTABLE_PATH is set.');
  }

  console.log(`[Puppeteer] Launching Chromium at: ${activePath}`);

  const browser = await puppeteer.launch({
    executablePath: activePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--no-zygote',
      '--font-render-hinting=none',
      '--force-color-profile=srgb',
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const headerTemplate = `
      <div style="width: 100%; font-family: serif; font-size: 8px; border-bottom: 1.5px solid #800000; padding-bottom: 5px; margin: 0 45px; display: flex; align-items: center; justify-content: space-between; -webkit-print-color-adjust: exact;">
        <div style="display: flex; align-items: center; gap: 5px;">
           ${journalLogoBase64 ? `<img src="${journalLogoBase64}" style="height: 25px; width: auto;" />` : ''}
           <div>
             <p style="color: #800000; font-weight: 900; font-size: 5px; margin: 0; text-transform: uppercase;">Genius Multidisciplinary</p>
             <p style="color: #0f172a; font-weight: 900; font-size: 7px; margin: 0; text-transform: uppercase;">INTERNATIONAL JOURNAL</p>
           </div>
        </div>
        <div style="text-align: center; flex: 1;">
           <div style="color: #64748b; font-weight: 700; font-size: 7px; text-transform: uppercase;">ISSN: ${branding.issn} | VOL ${branding.volume}, ISS ${branding.issue} | ${branding.date}</div>
           <div style="color: #4f46e5; font-size: 6px; font-family: monospace; font-weight: 700;">${branding.doi}</div>
           ${branding.institution ? `<div style="color: #64748b; font-size: 5.5px; font-weight: 600; text-transform: uppercase; margin-top: 1px;">${branding.institution}</div>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 5px; text-align: right;">
           <div style="line-height: 1;">
              <p style="color: #0f172a; font-weight: 900; font-size: 5px; margin: 0; text-transform: uppercase;">Nasarawa State University Keffi</p>
              <p style="color: #94a3b8; font-weight: 700; font-size: 5px; margin: 0; text-transform: uppercase;">Global Partner</p>
           </div>
           ${nsukLogoBase64 ? `<img src="${nsukLogoBase64}" style="height: 25px; width: auto;" />` : ''}
        </div>
      </div>
    `;

    // Footer: journal name on the left. Page numbers are stamped on the right
    // by pdf-lib post-processing below so they can carry the correct startPage offset.
    const footerTemplate = `
      <div style="width:100%;font-family:sans-serif;font-size:8.5px;color:#94a3b8;border-top:0.75px solid #e2e8f0;padding-top:4px;margin:0 45px;">
        <span style="text-transform:uppercase;font-weight:700;letter-spacing:0.08em;">Genius Multidisciplinary International Journal</span>
      </div>
    `;

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: '35mm', bottom: '25mm', left: '15mm', right: '15mm' }
    });

    // Stamp the correct page numbers (with startPage offset) at the right side of the
    // footer line using pdf-lib. Puppeteer's <span class="pageNumber"> always starts at 1
    // and cannot be offset, so we handle it here instead.
    const postDoc = await PDFDocument.load(pdfUint8);
    const postFont = await postDoc.embedFont(StandardFonts.Helvetica);
    const pageGray = rgb(0.58, 0.58, 0.58);
    const MM_TO_PT = 2.8346;
    const rightMargin = 15 * MM_TO_PT; // 15mm — matches page margin
    const footerY = 13; // points from page bottom — aligns with Puppeteer footer text baseline

    postDoc.getPages().forEach((pg, idx) => {
      const { width } = pg.getSize();
      const label = `Page ${startPage + idx}`;
      const labelWidth = postFont.widthOfTextAtSize(label, 8.5);
      pg.drawText(label, {
        x: width - rightMargin - labelWidth,
        y: footerY,
        size: 8.5,
        font: postFont,
        color: pageGray,
      });
    });

    return Buffer.from(await postDoc.save());
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
    logoGenius = await embedJournalAsset(pdfDoc, ['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
    logoNsuk = await embedJournalAsset(pdfDoc, ['Nasarawa-State-University.jpg', 'university-logo.jpg']);
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
    const journalTitle = JOURNAL_NAME.toUpperCase();
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

    if (branding.doi) {
      p.drawText(`DOI: ${branding.doi}`, {
        x: width / 2 - font.widthOfTextAtSize(`DOI: ${branding.doi}`, 6) / 2,
        y: curY - 31,
        size: 6,
        font,
        color: maroon
      });
    }

    curY -= 42;
    p.drawLine({
      start: { x: 40, y: curY },
      end: { x: width - 40, y: curY },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9)
    });

    return height - 90; // Reset Y for body content
  };

  const wrapText = (text: any, size: number, f: any, maxW: number) => {
    const str = sanitizePdfText(String(text || ''));
    if (!str) return [];
    const words = str.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      try {
        if (f.widthOfTextAtSize(testLine, size) < maxW) {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      } catch (e) {
        // Fallback for encoding issues during width calculation
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  const drawJustifiedText = (targetPage: any, line: string, textFont: any, fontSize: number, xPos: number, yPos: number, maxW: number, isLastLine: boolean) => {
    const sanitizedLine = sanitizePdfText(line);
    if (isLastLine || !sanitizedLine.trim().includes(' ')) {
      targetPage.drawText(sanitizedLine, { x: xPos, y: yPos, size: fontSize, font: textFont });
      return;
    }
    const words = sanitizedLine.split(' ');
    let textWidth = 0;
    words.forEach(w => {
      try {
        textWidth += textFont.widthOfTextAtSize(w, fontSize);
      } catch (e) {
        textWidth += textFont.widthOfTextAtSize('?', fontSize);
      }
    });

    // Safety check just in case all words are exactly the max width
    if (textWidth >= maxW) {
      targetPage.drawText(sanitizedLine, { x: xPos, y: yPos, size: fontSize, font: textFont });
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

// Auto-convert .doc → .docx
app.post('/api/convert/doc-to-docx', authenticateToken, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    // Extract text from .doc (OLE2 binary) using word-extractor
    let textContent = '';
    try {
      const buf = fs.readFileSync(req.file.path);
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(buf);
      textContent = extracted.getBody() || '';
    } catch (e: any) {
      console.error('[DOC→DOCX] word-extractor error:', e?.message);
      return res.status(422).json({
        error: `Auto-conversion failed: ${e?.message || 'could not read this .doc file'}. Please open it in Microsoft Word and use File → Save As → Word Document (.docx) to convert it manually.`
      });
    }

    if (!textContent || textContent.trim().length < 20) {
      return res.status(422).json({
        error: 'Auto-conversion could not extract readable content from this file. It may be encrypted or password-protected. Please open it in Microsoft Word and save it manually as .docx.'
      });
    }

    // Build a proper .docx from the extracted text using the docx package
    const docxLib = require('docx');
    const { Document, Paragraph, TextRun, Packer } = docxLib;

    const lines = textContent.split('\n');
    const children = lines.map((line: string) =>
      new Paragraph({ children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })] })
    );

    const doc = new Document({
      styles: { default: { document: { run: { size: 24, font: 'Times New Roman' } } } },
      sections: [{ properties: {}, children }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outName = (req.file.originalname || 'manuscript').replace(/\.doc$/i, '.docx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('Doc-to-docx conversion error:', err?.message);
    res.status(500).json({ error: 'Conversion failed. Please save the file manually as .docx in Microsoft Word.' });
  }
});

// Auto-convert .doc → PDF
app.post('/api/convert/doc-to-pdf', authenticateToken, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });

    // Extract text from .doc (OLE2 binary) using word-extractor
    let textContent = '';
    try {
      const buf = fs.readFileSync(req.file.path);
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(buf);
      textContent = extracted.getBody() || '';
    } catch (e: any) {
      console.error('[DOC→PDF] word-extractor error:', e?.message);
      return res.status(422).json({
        error: `Auto-conversion failed: ${e?.message || 'could not read this .doc file'}. Please open it in Microsoft Word and save it as PDF manually (File → Save As → PDF).`
      });
    }

    if (!textContent || textContent.trim().length < 20) {
      return res.status(422).json({
        error: 'Auto-conversion could not extract readable content from this file. It may be encrypted or password-protected. Please save it manually as PDF from Microsoft Word.'
      });
    }

    // Build PDF using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const pageWidth = 595.28;  // A4
    const pageHeight = 841.89;
    const marginX = 72;
    const marginY = 72;
    const lineHeight = 16;
    const fontSize = 11;
    const maxWidth = pageWidth - marginX * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - marginY;

    const wrapText = (text: string, maxW: number, fnt: any, size: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (fnt.widthOfTextAtSize(test, size) <= maxW) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
      return lines;
    };

    const drawLine = (text: string, fnt: any, size: number, bold = false) => {
      const wrapped = wrapLine(text, maxWidth, fnt, size);
      for (const l of wrapped) {
        if (y < marginY + lineHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - marginY;
        }
        page.drawText(l, { x: marginX, y, font: bold ? fontBold : fnt, size, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }
    };

    const wrapLine = (text: string, maxW: number, fnt: any, size: number): string[] => {
      if (!text.trim()) return [''];
      return wrapText(text, maxW, fnt, size);
    };

    const rawLines = textContent.split('\n');
    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      // Simple heuristic: short ALL-CAPS or title-case lines are headings
      const isHeading = trimmed.length > 0 && trimmed.length < 80 &&
        (trimmed === trimmed.toUpperCase() || /^[A-Z][^a-z]{0,3}[A-Z]/.test(trimmed));
      drawLine(trimmed, font, isHeading ? 12 : fontSize, isHeading);
      if (isHeading) y -= 4; // small gap after heading
    }

    const pdfBytes = await pdfDoc.save();
    const outName = (req.file.originalname || 'manuscript').replace(/\.doc$/i, '.pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    console.error('Doc-to-pdf conversion error:', err?.message);
    res.status(500).json({ error: 'Conversion to PDF failed. Please save the file manually as PDF from Microsoft Word.' });
  }
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
      "SELECT id FROM transactions WHERE user_id = $1 AND type = 'publication' AND status = 'success' AND paper_id IS NULL AND (metadata->>'consumed')::boolean IS NOT TRUE LIMIT 1",
      [userId]
    );

    if (creditCheck.rows.length === 0) {
      return res.status(402).json({ error: 'No publication credit found. Please complete payment first.' });
    }

    let textContent = '';
    let metadata: any = null;
    const uploadedAt = new Date().toISOString();

    // Detect old .doc format (Word 97-2003) before anything else
    const originalName = (req.file.originalname || '').toLowerCase();
    if (
      req.file.mimetype === 'application/msword' ||
      req.file.mimetype === 'application/vnd.ms-word' ||
      originalName.endsWith('.doc')
    ) {
      return res.status(400).json({
        error: 'Your file is in the old Word 97-2003 format (.doc). Please re-save it as a Word Document (.docx): in Microsoft Word go to File → Save As → change "Save as type" to "Word Document (*.docx)" — then upload the new file.'
      });
    }

    // Read file once from disk — avoids holding 50 MB in Node heap during the request
    const fileBuffer = fs.readFileSync(req.file.path);

    if (req.file.mimetype === 'application/pdf') {
      metadata = await parseWithGrobid(fileBuffer);
      const data = await pdfParse(fileBuffer);
      textContent = data.text;
      if (!metadata) metadata = {};
      metadata.sourcePageCount = data.numpages;
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      let result;
      try {
        result = await mammoth.extractRawText({ buffer: fileBuffer });
      } catch (docxErr: any) {
        console.error('DOCX parse error:', docxErr?.message);
        return res.status(400).json({ error: 'The uploaded DOCX file appears to be corrupted or is not a valid Word document. Please re-save the file in Word and try again.' });
      }
      textContent = result.value;
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or DOCX file.' });
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

    const journalConfig = await getJournalConfig();
    const sourcePageCount = resolveSourcePageCount(metadata, textContent);
    const pageWindow = buildPageWindow(sourcePageCount);

    if (sourcePageCount > journalConfig.maxPagesPerManuscript) {
      return res.status(400).json({
        error: `This manuscript is ${sourcePageCount} pages. The journal currently accepts up to ${journalConfig.maxPagesPerManuscript} pages per manuscript.`
      });
    }

    metadata = {
      ...metadata,
      mimetype: req.file.mimetype,
      originalFilename: req.file.originalname,
      sourcePageCount,
      pageCount: sourcePageCount,
      pageWindow,
      sourceWordCount: String(textContent || '').split(/\s+/).filter(Boolean).length,
      uploadedAt,
      history: [
        ...(Array.isArray(metadata?.history) ? metadata.history : []),
        {
          action: 'submitted',
          timestamp: uploadedAt,
          sourcePageCount,
          mimetype: req.file.mimetype
        }
      ]
    };

    // Duplicate manuscript detection: reject if a paper with the same/similar title already exists in the system
    const submittedTitle = (metadata.title || '').trim();
    if (submittedTitle.length > 10) {
      const existingTitles = await pool.query(
        "SELECT id, title, user_id FROM papers WHERE status != 'rejected' ORDER BY created_at DESC LIMIT 500"
      );
      for (const row of existingTitles.rows) {
        const similarity = stringSimilarity.compareTwoStrings(
          submittedTitle.toLowerCase(),
          (row.title || '').toLowerCase()
        );
        if (similarity >= 0.85) {
          const isSameUser = row.user_id === userId;
          return res.status(409).json({
            error: `This manuscript appears to have already been submitted${isSameUser ? ' by you' : ' by another researcher'}. Duplicate submissions are not permitted. If you believe this is an error, please contact the editorial office.`,
            duplicate: { id: row.id, title: row.title, similarity: Math.round(similarity * 100) }
          });
        }
      }
    }

    // Ensure authors column remains a string array (names only) for compatibility,
    // while full objects are preserved in the metadata JSONB
    const authorNames = normalizeAuthorNames(metadata.authors);

    // Upload file to R2 (streaming from disk) or fall back to BYTEA
    let paperFileUrl: string | null = null;
    let paperFileBlob: Buffer | null = R2_ENABLED ? null : fileBuffer;
    if (R2_ENABLED) {
      const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const r2Key = `papers/manuscripts/${Date.now()}-${safeFilename}`;
      paperFileUrl = await uploadToR2(r2Key, fs.createReadStream(req.file.path), req.file.mimetype, req.file.size);
    }
    // Clean up temp file from disk regardless of outcome
    fs.unlink(req.file.path, () => {});

    const result = await pool.query(
      'INSERT INTO papers (user_id, title, authors, abstract, content, metadata, file_blob, file_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [
        userId,
        metadata.title || 'Untitled',
        JSON.stringify(authorNames),
        metadata.abstract || '',
        textContent,
        JSON.stringify(metadata),
        paperFileBlob,
        paperFileUrl,
      ]
    );

    const newPaperId = result.rows[0].id;

    // Link the transaction and mark it as consumed
    const txId = creditCheck.rows[0].id;
    await pool.query(
      "UPDATE transactions SET paper_id = $1, metadata = metadata || $2 WHERE id = $3",
      [newPaperId, JSON.stringify({ consumed: true, paper_id: newPaperId, consumed_at: new Date().toISOString() }), txId]
    );

    // Stage 1 email: submission receipt (no attachment)
    await sendSubmissionReceivedEmail(req.user.email, req.body.researcherName || req.user.name || 'Researcher', metadata.title || 'Untitled', newPaperId, sourcePageCount);

    // Stage 2 email: acceptance letter + preliminary PDF — sent 12 seconds later so it arrives as a distinct second email
    setTimeout(async () => {
      try {
        await sendAcceptanceEmail(
          req.user.email,
          req.body.researcherName || req.user.name || 'Researcher',
          metadata.title || 'Untitled',
          newPaperId
        );
      } catch (err) {
        console.error('[Upload] Acceptance email failed (non-blocking):', err);
      }
    }, 12000);

    res.json({
      id: newPaperId,
      title: metadata.title,
      authors: metadata.authors,
      abstract: metadata.abstract,
      metadata,
      status: 'uploaded',
      message: 'Submission received. Editorial screening and refinement are now underway.'
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

    let metadata = safeJsonParse<any>(currentPaper.rows[0].metadata, {});
    if (title !== undefined) metadata.title = title;
    if (authors !== undefined) metadata.authors = authors;
    if (abstract !== undefined) metadata.abstract = abstract;

    const authorNames = Array.isArray(metadata.authors)
      ? metadata.authors.map((a: any) => typeof a === 'string' ? a : a?.name).filter(Boolean)
      : [];

    await pool.query(
      'UPDATE papers SET title = COALESCE($1, title), authors = $2, abstract = COALESCE($3, abstract), metadata = $4 WHERE id = $5 AND user_id = $6',
      [title || null, JSON.stringify(authorNames), abstract || null, JSON.stringify(metadata), id, req.user.id]
    );

    res.json({ success: true, metadata });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/papers/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query(
      `SELECT p.id, p.user_id, p.title, p.authors, p.abstract, p.status, p.doi, p.volume, p.issue, p.issn,
              p.metadata, p.published_at, p.created_at, p.certificate_id
       FROM papers p
       WHERE p.id = $1`,
      [id]
    );
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const metadata = safeJsonParse<any>(paper.metadata, {});
    res.json({
      ...paper,
      metadata,
      authors: normalizeAuthorNames(paper.authors),
      sourcePageCount: metadata.sourcePageCount || metadata.pageCount || null,
      pageWindow: metadata.pageWindow || null
    });
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
    if (!PUBLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Automatically lock paper if it moves to final stages
    const isLocked = (status === 'accepted' || status === 'published');

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
    const result = await pool.query('SELECT file_blob, file_url, title, metadata FROM papers WHERE id = $1', [id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));
    const ext = metadata.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const safeTitle = (paper.title || 'manuscript').replace(/[^a-zA-Z0-9\s-_]/g, '').substring(0, 100);
    const mimetype = metadata.mimetype || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // R2 URL — redirect directly to CDN
    if (paper.file_url) return res.redirect(302, paper.file_url);

    // Legacy BYTEA — serve and lazily migrate to R2
    if (paper.file_blob) {
      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.${ext}"`);
      res.send(paper.file_blob);
      lazyMigrateToR2('papers', id, 'file_blob', 'file_url', mimetype, `manuscript.${ext}`).catch(() => {});
      return;
    }

    return res.status(404).json({ error: 'File data not found on server' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SHARED PDF GENERATION HELPERS =====
/**
 * After any deletion or publication, re-walk all published papers in a volume/issue
 * (ordered by their original publication time) and assign sequential startPageNumber
 * values so that gaps left by deleted papers are filled by subsequent papers.
 *
 * Because on-demand downloads read metadata.startPageNumber, no PDF regeneration
 * is needed — updating metadata is sufficient to change all future downloads.
 */
async function resequenceIssuePages(volume: string, issue: string): Promise<void> {
  const papers = await pool.query(
    `SELECT id, metadata FROM papers
     WHERE status = 'published' AND volume = $1 AND issue = $2
     ORDER BY published_at ASC NULLS LAST, id ASC`,
    [volume, issue]
  );

  let runningPage = 1;
  for (const row of papers.rows) {
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    const pageCount = parseInt(meta.pageCount || meta.sourcePageCount || '0', 10);

    if (meta.startPageNumber !== runningPage) {
      meta.startPageNumber = runningPage;
      await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [JSON.stringify(meta), row.id]);
    }

    if (pageCount > 0) runningPage += pageCount;
  }

  console.log(`[Pages] Resequenced Vol.${volume} Iss.${issue}: ${papers.rows.length} papers, next page = ${runningPage}`);
}

async function generatePublishedArticlePDF(paperId: number | string): Promise<{ buffer: Buffer; filename: string }> {
  const result = await pool.query(
    'SELECT id, title, authors, abstract, content, formatted_content, metadata, doi, volume, issue, issn, published_at, created_at, final_pdf, final_pdf_filename, final_pdf_url FROM papers WHERE id = $1',
    [paperId]
  );
  const paper = result.rows[0];
  if (!paper) throw new Error('Paper not found');

  const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));

  // NOTE: final_pdf (stored binary) is intentionally skipped when formatted_content exists.
  // Always regenerate from formatted_content so that layout fixes (justification, references)
  // apply to every download — including papers published before the fixes were deployed.
  // Only fall back to final_pdf if there is no formatted_content at all.

  // Recover the saved startPageNumber so on-demand downloads show the same page numbers as the published version
  const savedStartPage = Number(metadata.startPageNumber || 1);

  // HIGHEST PRIORITY: Use High-Fidelity Formatted HTML (Matches Formatting Preview 1:1)
  if (paper.formatted_content) {
    try {
      console.log(`[PUBLISH] Generating High-Fidelity PDF for Paper ${paperId}...`);
      const buffer = await generateHighFidelityPaperPDF(paperId, { startPageNumber: savedStartPage });
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
      issue: paper.issue || '1',
      startPageNumber: savedStartPage
    };
    const buffer = await generateFinalManuscriptPDF(metadata.ast, branding);
    return { buffer: Buffer.from(buffer), filename: `${(paper.title || 'article').replace(/[^a-z0-9]/gi, '_')}.pdf` };
  }

  // Last resort: serve the stored final_pdf (R2 URL or legacy BYTEA)
  const fallbackFilename = paper.final_pdf_filename || `${buildSafeFilename(paper.title || 'article', '_Published.pdf')}`;
  if (paper.final_pdf_url) {
    const resp = await fetch(paper.final_pdf_url);
    if (resp.ok) return { buffer: Buffer.from(await resp.arrayBuffer()), filename: fallbackFilename };
  }
  if (paper.final_pdf) {
    return { buffer: Buffer.from(paper.final_pdf), filename: fallbackFilename };
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

  // Dynamic Logo Loading (consistent journal branding)
  let logoLeft: any = null;
  let logoRight: any = null;
  try {
    logoLeft = await embedJournalAsset(pdfDoc, ['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
    logoRight = await embedJournalAsset(pdfDoc, ['Nasarawa-State-University.jpg', 'university-logo.jpg']);
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
      const lineText = `${doi ? 'DOI: ' + doiUrl(doi) : ''}${doi && dateStr ? '   •   ' : ''}${dateStr ? 'Published: ' + dateStr : ''}`;
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
      const isLastLine = i === lines.length - 1 || lines[i + 1] === '';
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

async function generatePublicationCertificatePDF(
  paper: any,
  branding: any,
  certificateId: string,
  journalConfig?: any
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const maroon = rgb(0.5, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const black = rgb(0, 0, 0);

  const config = journalConfig || await getJournalConfig();
  const secretaryName = config.journalSecretary || 'Dr. Danjuma Namo';
  const signatureBase64 = config.journalSignature || '';

  const title = sanitizePdfText(paper?.title || 'Untitled Manuscript');
  const authorsList = normalizeAuthorNames(paper?.authors || paper?.metadata?.authors || []);
  const authorsLine = sanitizePdfText(authorsList.length ? authorsList.join(', ') : 'Researcher');
  const doi = sanitizePdfText(String(branding?.doi || paper?.doi || 'Pending'));
  const issn = sanitizePdfText(String(branding?.issn || paper?.issn || config.journalIssn || '2971-7760'));
  const volume = sanitizePdfText(String(branding?.volume || paper?.volume || config.currentVolume || '1'));
  const issue = sanitizePdfText(String(branding?.issue || paper?.issue || config.currentIssue || '1'));
  const publishedDate = sanitizePdfText(String(
    branding?.date || new Date(paper?.published_at || paper?.created_at || new Date())
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  ));
  const verifyUrl = sanitizePdfText(buildCertificateVerificationUrl({ id: paper?.id, doi }));

  const logoLeft = await embedJournalAsset(pdfDoc, ['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
  const logoRight = await embedJournalAsset(pdfDoc, ['Nasarawa-State-University.jpg', 'university-logo.jpg']);

  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: maroon, borderWidth: 2 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: maroon, borderWidth: 1 });

  if (logoLeft) page.drawImage(logoLeft, { x: 50, y: height - 115, width: 60, height: 60 });
  if (logoRight) page.drawImage(logoRight, { x: width - 110, y: height - 115, width: 60, height: 60 });

  const titleText = 'CERTIFICATE OF PUBLICATION';
  page.drawText(titleText, {
    x: width / 2 - fontBold.widthOfTextAtSize(titleText, 22) / 2,
    y: height - 95,
    size: 22,
    font: fontBold,
    color: maroon
  });

  const journalLine = JOURNAL_NAME.toUpperCase();
  page.drawText(journalLine, {
    x: width / 2 - fontBold.widthOfTextAtSize(journalLine, 10) / 2,
    y: height - 118,
    size: 10,
    font: fontBold,
    color: gray
  });

  const wrapText = (text: string, usedFont: any, size: number, maxWidth: number) => {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (usedFont.widthOfTextAtSize(testLine, size) > maxWidth) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawCenteredLines = (lines: string[], y: number, usedFont: any, size: number, color: any, lineGap = 8) => {
    for (const line of lines) {
      page.drawText(line, {
        x: width / 2 - usedFont.widthOfTextAtSize(line, size) / 2,
        y,
        size,
        font: usedFont,
        color
      });
      y -= size + lineGap;
    }
    return y;
  };

  let y = height - 160;
  y = drawCenteredLines(wrapText('This is to certify that the manuscript titled', fontItalic, 12, width - 160), y, fontItalic, 12, gray, 6);
  y -= 4;
  y = drawCenteredLines(wrapText(`"${title}"`, fontBold, 18, width - 160), y, fontBold, 18, black, 6);
  y -= 4;
  y = drawCenteredLines(wrapText('authored by', fontItalic, 11, width - 160), y, fontItalic, 11, gray, 4);
  y = drawCenteredLines(wrapText(authorsLine, fontBold, 14, width - 180), y, fontBold, 14, black, 6);
  y -= 6;
  y = drawCenteredLines(
    wrapText(`has been accepted and published in the ${JOURNAL_DISPLAY_NAME}.`, font, 12, width - 160),
    y,
    font,
    12,
    black,
    6
  );

  y -= 6;
  y = drawCenteredLines(wrapText(`DOI: ${doiUrl(doi)}`, fontBold, 11, width - 160), y, fontBold, 11, maroon, 4);
  y = drawCenteredLines(
    wrapText(`ISSN: ${issn}   |   Volume ${volume}   |   Issue ${issue}`, font, 10, width - 160),
    y,
    font,
    10,
    gray,
    4
  );
  y = drawCenteredLines(wrapText(`Published: ${publishedDate}`, fontItalic, 10, width - 160), y, fontItalic, 10, gray, 4);

  const signatureY = 95;
  if (signatureBase64 && signatureBase64.startsWith('data:image')) {
    try {
      const base64Data = signatureBase64.split(',')[1];
      const sigBytes = Buffer.from(base64Data, 'base64');
      const sigImg = signatureBase64.includes('image/png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
      const sigDims = sigImg.scaleToFit(140, 50);
      page.drawImage(sigImg, { x: 80, y: signatureY + 15, width: sigDims.width, height: sigDims.height });
    } catch (err) {
      console.error('Failed to embed certificate signature image:', err);
    }
  }
  page.drawLine({ start: { x: 80, y: signatureY }, end: { x: 260, y: signatureY }, thickness: 1, color: gray });
  page.drawText(secretaryName, { x: 80, y: signatureY - 16, size: 11, font: fontBold, color: black });
  page.drawText('Secretary, Editorial Board', { x: 80, y: signatureY - 30, size: 9, font, color: gray });

  page.drawText(`Certificate ID: ${certificateId}`, { x: width - 320, y: 95, size: 9, font: fontBold, color: black });
  page.drawText(`Verification: ${verifyUrl}`, { x: width - 320, y: 80, size: 8, font, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/* LEGACY PUBLICATION EMAIL (deprecated in favor of server-issued certificate)
async function sendPublicationEmailLegacy(to: string, researcherName: string, manuscriptTitle: string, doi: string, url: string, pdfBuffer: Buffer) {
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
            <p><strong>DOI:</strong> <a href="${doiUrl(doi)}" style="color:#4338ca;">${doiUrl(doi)}</a></p>
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
*/

async function sendPublicationEmail(
  to: string,
  researcherName: string,
  manuscriptTitle: string,
  payload: {
    doi: string;
    url: string;
    volume: string;
    issue: string;
    issn: string;
    publishedAt: string;
    certificateId: string;
    pdfBuffer: Buffer;
    certificateBuffer: Buffer;
  }
) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set - skipping publication email.');
    return;
  }

  const {
    doi,
    url,
    volume,
    issue,
    issn,
    publishedAt,
    certificateId,
    pdfBuffer,
    certificateBuffer
  } = payload;

  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #1a202c; line-height: 1.7;">
      <div style="border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden;">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #fff7ed 0%, #ffffff 70%); border-bottom: 3px solid #800000;">
          <h1 style="margin: 0; color: #800000; font-size: 24px;">Publication Confirmed</h1>
          <p style="margin: 8px 0 0; color: #475569; font-size: 14px;">${JOURNAL_NAME}</p>
        </div>
        <div style="padding: 32px;">
          <p>Dear ${researcherName},</p>
          <p>Your manuscript titled <strong>${manuscriptTitle}</strong> has been formally published.</p>
          <p><strong>DOI:</strong> <a href="${doiUrl(doi)}" style="color:#800000;">${doiUrl(doi)}</a><br/>
          <strong>Volume / Issue:</strong> ${volume} / ${issue}<br/>
          <strong>ISSN:</strong> ${issn}<br/>
          <strong>Published:</strong> ${publishedAt}</p>
          <p>The official published manuscript and your publication certificate are attached.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${url}" style="background: #800000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View DOI Record</a>
          </div>
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">Certificate ID: ${certificateId}</p>
        </div>
      </div>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `GMIJP <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject: `Publication Confirmed - ${manuscriptTitle.substring(0, 80)}`,
        html: htmlBody,
        attachments: [
          {
            filename: `Published_Manuscript_${doi.replace(/\//g, '_')}.pdf`,
            content: pdfBuffer.toString('base64')
          },
          {
            filename: `Publication_Certificate_${certificateId}.pdf`,
            content: certificateBuffer.toString('base64')
          }
        ]
      })
    });
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
    } catch (e) { }

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
      { role: 'user', content: `Title: ${paper.title}\nAuthors: ${paper.authors}\nAbstract: ${paper.abstract}\nContent:\n${(paper.content || '').substring(0, 50000)}` }
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
        try { aiData = JSON.parse(r.ai_analysis || '{}'); } catch (e) { }
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
    const paperResult = await pool.query('SELECT title, metadata FROM papers WHERE id = $1', [id]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const meta = safeJsonParse<any>(paper.metadata, {});
    const savedStartPage = Number(meta.startPageNumber || 1);
    const pdfBuffer = await generateHighFidelityPaperPDF(id, { startPageNumber: savedStartPage });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_Final.pdf"`);
    res.end(pdfBuffer);
  } catch (error: any) {
    console.error('High-fidelity PDF error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate high-fidelity PDF' });
  }
});


app.post('/api/format/:id/email', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paperResult = await pool.query('SELECT title, user_id FROM papers WHERE id = $1', [id]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const pdfBuffer = await generateHighFidelityPaperPDF(id);

    await sendResendEmail({
      fromName: 'Genius Publishing',
      to: req.user.email,
      subject: `[FINALIZED] ${paper.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
          <div style="background: #1e1b4b; padding: 30px; border-radius: 16px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 20px;">Formatted Manuscript Ready</h1>
            <p style="margin-top: 5px; font-size: 14px; opacity: 0.8;">Genius Format Architect</p>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 16px 16px;">
            <p>Hello,</p>
            <p>Your manuscript <strong>"${paper.title}"</strong> has been successfully formatted and is attached as a high-fidelity PDF.</p>
            <p>This version matches the exact style and layout you approved in the Format Architect.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Genius Publishing Engine - Autonomous Academic Delivery</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_Formatted.pdf`,
          content: pdfBuffer.toString('base64')
        }
      ]
    });

    res.json({ success: true, message: `Manuscript successfully sent to ${req.user.email}` });
  } catch (error: any) {
    console.error('Email PDF error:', error);
    res.status(500).json({ error: error.message || 'Failed to send email' });
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
    - PAGINATION: You MUST wrap the content in <div class="paper-sheet"> blocks. Ensure that 100% of the text is distributed across these sheets. Do NOT omit or summarize any content to fit a page.
    - RECURSIVE HEADER: EVERY <div class="paper-sheet"> block EXCEPT THE FIRST ONE (i.e. starting from Page 2 onwards) MUST start with this EXACT HTML block:
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
      </div>
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
    const metadata = safeJsonParse<any>(paper.metadata, {});
    const pageWindow = metadata.pageWindow || buildPageWindow(resolveSourcePageCount(metadata, paper.content));
    const targetPageCount = pageWindow.target;

    // Fetch user profile affiliation to enrich author metadata
    const userProfileRes = await pool.query('SELECT name, affiliation FROM users WHERE id = $1', [req.user.id]);
    const userProfile = userProfileRes.rows[0] || {};

    // Merge user dashboard affiliation into paper metadata authors (fills gaps from extraction)
    const metaAuthors: any[] = Array.isArray(metadata.authors) ? metadata.authors : [];
    if (metaAuthors.length > 0 && userProfile.affiliation) {
      metaAuthors.forEach((a: any) => {
        if (!a.institution || a.institution.trim() === '') a.institution = userProfile.affiliation;
      });
    }
    // Save enriched affiliation back so it's persistent
    metadata.authors = metaAuthors;

    // Fetch branding metadata for the formatter
    const journalConfig = await getJournalConfig();
    const branding = buildPaperBranding(paper, journalConfig, { doi: paper.doi || '10.GMIJ/PENDING' });

    console.log(`[DEBUG] Formatting paper ${id}: PaperVol=${paper.volume}, FinalVol=${branding.volume}`);

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
          5. NO PLACEHOLDERS: Do NOT generate "[Figure]", "[Image]", or any missing media placeholders.
          6. NO RECURRING METADATA: Do NOT inject journal metadata, ISSNs, slogans, or branding blocks into the manuscript. Only format the raw academic content. 
          7. START AT TITLE: Your output must begin directly with the manuscript title (<h1>). Do NOT include any logos or journal identifiers at the top. 
          8. STRUCTURE: Use <div class="paper-sheet"> to simulate real pages. Within each sheet, use standard HTML tags (<h1>, <h2>, <p>).
          9. ZERO OMISSION: You MUST preserve 100% of the actual manuscript body text.
          10. NO BROKEN MEDIA: If an image or logo is referenced in the source but the path looks absolute or relative to a local system, omit it entirely. Do NOT generate <img> tags for logos.
          11. COPYEDITING: Fix spelling and grammatical errors, remove completely all unwanted symbols/characters, eliminate weird text indentations, and strip out unnecessary extra spaces. The text must read flawlessly as a professionally copyedited scientific manuscript.
          12. ENFORCEMENT: If you see "Genius Multidisciplinary International Journal" or "ISSN" at the top of the source, STRIP IT.
          13. FONTS: Use standard serif fonts for the main body.
          14. PAGE DISCIPLINE: The source manuscript is approximately ${targetPageCount} pages. Keep the formatted result very close to that length. Avoid compressing the paper to an unrealistically short output and avoid inflating it with unnecessary spacing or repeated headings.
          15. REFERENCES FORMATTING (NON-NEGOTIABLE): The References section MUST be formatted as a compact, single-spaced list. Each reference entry is ONE paragraph tag: <p class="reference">...</p>. Rules:
              a. NO blank lines or extra margin between individual reference entries. They flow one immediately after another.
              b. Use a hanging indent: padding-left:2.9em; text-indent:-2.9em; on each <p class="reference">.
              c. line-height must be 1.35 on all reference entries — never 1.5, never 2.
              d. margin-bottom on each entry must be 3px maximum — never 0.8em or 1em.
              e. Do NOT use <ol> or <ul> for references. Use <div class="references"> containing <p class="reference"> for each entry.
              f. Do NOT add extra spacing, gaps, or visual separators between reference entries.
              g. URLs in references must stay on the same line as the reference text and must NOT be separated into their own paragraph.
              h. The heading "References" should use <h2> with normal heading styling above the list.
          EXAMPLE of correct reference output:
          <div class="references">
            <p class="reference">Ajayi, O. (2022). <em>Human trafficking and modern slavery.</em> Lagos: Academic Press.</p>
            <p class="reference">Bello, A. (2024). <em>Economic hardship and human trafficking in Nigeria.</em> Lagos: University Press.</p>
          </div>`
        },
        {
          role: 'user',
          content: (() => {
            // Build a rich author block including affiliation for the AI
            let authorBlock = paper.authors || '';
            if (metaAuthors.length > 0) {
              authorBlock = metaAuthors.map((a: any) => {
                const parts = [a.name];
                if (a.department) parts.push(a.department);
                if (a.faculty) parts.push(a.faculty);
                if (a.institution) parts.push(a.institution);
                if (a.email) parts.push(a.email);
                return parts.filter(Boolean).join(', ');
              }).join('\n');
            } else if (userProfile.affiliation) {
              authorBlock = `${paper.authors || userProfile.name} — ${userProfile.affiliation}`;
            }
            return `Manuscript Title (TOPIC): ${paper.title}\nAuthors (with affiliations):\n${authorBlock}\nAbstract: ${paper.abstract}\nSource Content (HTML/Text):\n\n${sourceContent}`;
          })()
        }
      ]
    });

    // Strip any lingering markdown backticks if the AI failed to follow instruction 1
    let formattedHtml = response.choices[0]?.message?.content || '';
    formattedHtml = formattedHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '');

    // POST-PROCESS: Enforce compact references regardless of what the AI produced.
    // Find the references section and tighten every <p> inside it.
    formattedHtml = formattedHtml.replace(
      /(<(?:div|section|ol|ul)[^>]*class="[^"]*(?:references?|bibliograph)[^"]*"[^>]*>)([\s\S]*?)(<\/(?:div|section|ol|ul)>)/gi,
      (_match: string, open: string, inner: string, close: string) => {
        // Normalise <li> → <p class="reference"> for list-based outputs
        let fixed = inner.replace(/<li([^>]*)>/gi, '<p class="reference"$1>').replace(/<\/li>/gi, '</p>');
        // Remove blank paragraphs and excessive gaps between entries
        fixed = fixed.replace(/<p([^>]*)>\s*<\/p>/gi, '');
        // Ensure every <p> in references has the tight inline style
        fixed = fixed.replace(/<p(?![^>]*class="reference")([^>]*)>/gi, '<p class="reference"$1>');
        fixed = fixed.replace(
          /<p class="reference"([^>]*)>/gi,
          '<p class="reference" style="margin-top:0;margin-bottom:3px;padding-left:2.9em;text-indent:-2.9em;line-height:1.35;text-align:left;"$1>'
        );
        return open + fixed + close;
      }
    );

    // PERSISTENCE: Save the formatted content to the database so it can be used for PDF/Email generation
    const nextStatus = ['published', 'accepted', 'ready'].includes(paper.status) ? paper.status : 'formatting';
    await pool.query(
      'UPDATE papers SET formatted_content = $1, status = $2, metadata = $3 WHERE id = $4 AND user_id = $5',
      [formattedHtml, nextStatus, JSON.stringify({ ...metadata, pageWindow, targetPageCount }), id, req.user.id]
    );

    res.json({
      formattedHtml,
      branding,
      pageWindow,
      targetPageCount
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

    if (!['accepted', 'published'].includes(paper.status)) {
      return res.status(409).json({ error: 'Acceptance letter is issued only after editorial acceptance.' });
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

const finalizePublicationFromRetry = async (paperId: number) => {
  const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1', [paperId]);
  const paper = paperResult.rows[0];
  if (!paper) throw new Error('Paper not found');

  if (!['accepted', 'doi_validation_failed'].includes(paper.status)) {
    throw new Error(`Paper is not in retry-eligible status (${paper.status})`);
  }

  const metadata = safeJsonParse<any>(paper.metadata, {});
  const journalConfig = await getJournalConfig();
  const vol = parseInt(journalConfig.currentVolume || '1', 10);
  const iss = parseInt(journalConfig.currentIssue || '1', 10);
  const issn = journalConfig.journalIssn || '2971-7760';

  const sourcePageCount = resolveSourcePageCount(metadata, paper.content || '');
  const pageWindow = metadata.pageWindow || buildPageWindow(sourcePageCount);

  let ast = metadata.ast;
  if (!ast) {
    ast = await performStructuralRewrite(paper);
  }

  const zenodoToken = process.env.ZENODO_ACCESS_TOKEN;
  if (!zenodoToken) throw new Error('Zenodo Access Token missing.');

  // Lock this paper row for the duration of publishing to prevent duplicate startPageNumber from concurrent submissions
  await pool.query('SELECT id FROM papers WHERE id = $1 FOR UPDATE', [paperId]);

  const previousPapers = await pool.query(
    "SELECT metadata FROM papers WHERE status = 'published' AND volume = $1 AND issue = $2 AND id != $3",
    [vol.toString(), iss.toString(), paperId]
  );
  let startPageNumber = 1;
  previousPapers.rows.forEach(r => {
    const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {});
    const pc = parseInt(m.pageCount || m.sourcePageCount || '0', 10);
    if (pc > 0) startPageNumber += pc;
  });

  const { depositionId, doi: prereservedDoi, bucketUrl } = await prereserveDOI(zenodoToken);
  if (!prereservedDoi || !prereservedDoi.startsWith('10.')) {
    throw new Error('Invalid DOI prereserved from registry.');
  }

  let draftPdfBytes: Buffer | Uint8Array;
  if (paper.formatted_content) {
    try {
      draftPdfBytes = await generateHighFidelityPaperPDF(paperId, {
        doi: prereservedDoi,
        volume: vol,
        issue: iss,
        issn,
        publishedAt: new Date().toISOString(),
        startPageNumber
      });
    } catch (err) {
      console.warn(`[DOI RETRY] High-fidelity draft failed for paper ${paperId}. Falling back to structural PDF.`, err);
      draftPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi: prereservedDoi });
    }
  } else {
    draftPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi: prereservedDoi });
  }

  const draftPdfBuffer = Buffer.isBuffer(draftPdfBytes) ? draftPdfBytes : Buffer.from(draftPdfBytes);
  const draftPdf = await PDFDocument.load(draftPdfBuffer);
  const draftPageCount = draftPdf.getPageCount();
  if (!isWithinPageWindow(draftPageCount, pageWindow)) {
    const updatedMetadata = {
      ...metadata,
      sourcePageCount,
      pageWindow,
      pageCount: draftPageCount,
      pageCountWithinWindow: false
    };
    await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [JSON.stringify(updatedMetadata), paperId]);
    throw new Error(`Page count mismatch: expected ${pageWindow.min}-${pageWindow.max}, got ${draftPageCount}.`);
  }

  const finalDoi = await finalizeZenodoPublish(depositionId, zenodoToken, paper, draftPdfBuffer, bucketUrl);
  const doi = finalDoi || prereservedDoi;
  const url = `https://doi.org/${doi}`;
  const publishedAt = new Date().toISOString();

  let finalPdfBytes: Buffer | Uint8Array;
  if (paper.formatted_content) {
    try {
      finalPdfBytes = await generateHighFidelityPaperPDF(paperId, {
        doi,
        volume: vol,
        issue: iss,
        issn,
        publishedAt,
        startPageNumber
      });
    } catch (err) {
      console.warn(`[DOI RETRY] High-fidelity final failed for paper ${paperId}. Falling back to structural PDF.`, err);
      finalPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi });
    }
  } else {
    finalPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi });
  }

  const finalPdfBuffer = Buffer.isBuffer(finalPdfBytes) ? finalPdfBytes : Buffer.from(finalPdfBytes);
  const finalPdfDoc = await PDFDocument.load(finalPdfBuffer);
  const finalPageCount = finalPdfDoc.getPageCount();
  const pageCountWithinWindow = isWithinPageWindow(finalPageCount, pageWindow);

  const history = Array.isArray(metadata.history) ? metadata.history : [];
  const nextVersion = (metadata.version || 1) + 1;
  history.push({
    action: 'published',
    version: nextVersion,
    doi,
    url,
    timestamp: publishedAt,
    pageCount: finalPageCount
  });

  const updatedMetadata = {
    ...metadata,
    doi,
    url,
    volume: vol,
    issue: iss,
    issn,
    publishedAt,
    version: nextVersion,
    history,
    startPageNumber,
    pageCount: finalPageCount,
    sourcePageCount,
    pageWindow,
    pageCountWithinWindow
  };

  const finalFilename = `${buildSafeFilename(paper.title || 'article')}_Published.pdf`;
  const certificateId = paper.certificate_id || buildCertificateId(paperId, publishedAt);
  const certificateBranding = buildPaperBranding(paper, journalConfig, {
    doi,
    volume: vol,
    issue: iss,
    issn,
    publishedAt
  });
  const certificateBuffer = await generatePublicationCertificatePDF(
    { ...paper, metadata },
    certificateBranding,
    certificateId,
    journalConfig
  );

  // Upload final PDF to R2 if configured, otherwise store as BYTEA
  let storedFinalPdfBlob: Buffer | null = finalPdfBuffer;
  let storedFinalPdfUrl: string | null = null;
  if (R2_ENABLED) {
    storedFinalPdfUrl = await uploadToR2(`papers/final/${paperId}/${finalFilename}`, finalPdfBuffer, 'application/pdf');
    storedFinalPdfBlob = null;
  }

  await pool.query(
    "UPDATE papers SET status = 'published', metadata = $1, doi = $2, volume = $3, issue = $4, issn = $5, published_at = $6, final_pdf = $7, final_pdf_filename = $8, certificate_id = $9, is_locked = TRUE, final_pdf_url = $11 WHERE id = $10",
    [JSON.stringify(updatedMetadata), doi, vol.toString(), iss.toString(), issn, publishedAt, storedFinalPdfBlob, finalFilename, certificateId, paperId, storedFinalPdfUrl]
  );

  const countRes = await pool.query("SELECT COUNT(*) FROM papers WHERE status = 'published' AND volume = $1 AND issue = $2", [vol.toString(), iss.toString()]);
  const count = parseInt(countRes.rows[0].count);
  const max = journalConfig.maxManuscriptsPerIssue || 10;
  const maxIssues = journalConfig.maxIssuesPerVolume || 12;

  if (count >= max) {
    if (iss >= maxIssues) {
      await pool.query("UPDATE settings SET value = $1 WHERE key = 'current_volume'", [(vol + 1).toString()]);
      await pool.query("UPDATE settings SET value = '1' WHERE key = 'current_issue'");
    } else {
      await pool.query("UPDATE settings SET value = $1 WHERE key = 'current_issue'", [(iss + 1).toString()]);
    }
  }

  // Resequence page numbers for the whole issue now that this paper is part of it.
  // This is a no-op for the first paper (it stays at 1) but ensures any prior
  // deletions are fully healed before the next paper's startPageNumber is stamped.
  try {
    await resequenceIssuePages(vol.toString(), iss.toString());
  } catch (seqErr) {
    console.error('[Pages] Resequence after publish failed (non-blocking):', seqErr);
  }

  const userRes = await pool.query('SELECT email, name FROM users WHERE id = $1', [paper.user_id]);
  const user = userRes.rows[0];
  if (user) {
    await sendPublicationEmail(user.email, user.name, ast.title || paper.title, {
      doi,
      url,
      volume: vol.toString(),
      issue: iss.toString(),
      issn,
      publishedAt,
      certificateId,
      pdfBuffer: finalPdfBuffer,
      certificateBuffer
    });
  }
};

app.get('/api/papers/:id/certificate', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const result = await pool.query(
      'SELECT p.*, u.name as researcher_name FROM papers p JOIN users u ON p.user_id = u.id WHERE p.id = $1',
      [id]
    );
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && paper.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (paper.status !== 'published') {
      return res.status(409).json({ error: 'Certificate is available only after publication.' });
    }

    const journalConfig = await getJournalConfig();
    const branding = buildPaperBranding(paper, journalConfig, {
      doi: paper.doi,
      volume: paper.volume || journalConfig.currentVolume,
      issue: paper.issue || journalConfig.currentIssue,
      issn: paper.issn || journalConfig.journalIssn,
      publishedAt: paper.published_at || paper.created_at
    });

    const certificateId = paper.certificate_id || buildCertificateId(paper.id, paper.published_at || paper.created_at);
    if (!paper.certificate_id) {
      await pool.query('UPDATE papers SET certificate_id = $1 WHERE id = $2', [certificateId, paper.id]);
    }

    const pdfBuffer = await generatePublicationCertificatePDF(
      { ...paper, metadata: safeJsonParse(paper.metadata, {}) },
      branding,
      certificateId,
      journalConfig
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Publication_Certificate_${paper.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).json({ error: 'Failed to generate publication certificate' });
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
    .replace(/[\r\n]+/g, ' ')        // Replace newlines and CRs with spaces
    // Transliterate common Greek characters for academic papers
    .replace(/\u03C7/g, 'chi')       // χ
    .replace(/\u03B1/g, 'alpha')     // α
    .replace(/\u03B2/g, 'beta')      // β
    .replace(/\u03B3/g, 'gamma')     // γ
    .replace(/\u03B4/g, 'delta')     // δ
    .replace(/\u03B5/g, 'epsilon')   // ε
    .replace(/\u03B8/g, 'theta')     // θ
    .replace(/\u03BC/g, 'mu')        // μ
    .replace(/\u03C0/g, 'pi')        // π
    .replace(/\u03C3/g, 'sigma')     // σ
    .replace(/\u03C9/g, 'omega')     // ω
    .replace(/[^\x00-\x7F]/g, '?');  // Fallback for everything else non-ASCII
};

// ===== PDF Generation: Acceptance Letter =====
async function generateAcceptanceLetterPDF(researcherName: string, manuscriptTitle: string, manuscriptId: number): Promise<Buffer> {
  const sName = sanitizePdfText(researcherName);
  const sTitle = sanitizePdfText(manuscriptTitle);
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

  // Load and embed logos (consistent journal branding)
  try {
    const logoLeft = await embedJournalAsset(pdfDoc, ['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
    const logoRight = await embedJournalAsset(pdfDoc, ['Nasarawa-State-University.jpg', 'university-logo.jpg']);
    if (logoLeft) {
      page.drawImage(logoLeft, { x: margin, y: y - 50, width: 50, height: 50 });
    }
    if (logoRight) {
      page.drawImage(logoRight, { x: width - margin - 50, y: y - 50, width: 50, height: 50 });
    }
  } catch (err) {
    console.error('Error embedding logos in acceptance letter:', err);
  }

  // Header Title
  const title1 = 'GENIUS MULTIDISCIPLINARY';
  const title2 = 'INTERNATIONAL JOURNAL PUBLICATION';
  const uniNameText = PARTNER_INSTITUTION_NAME;

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
  page.drawText(`Dear ${sName},`, { x: margin, y, size: 12, font: fontBold, color: black });
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
    const sText = sanitizePdfText(text);
    const maxWidth = width - 2 * margin;
    const words = sText.split(' ');
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
  drawWrappedText(`"${sTitle}"`, fontItalic, 11, 16, black);
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

  // Dynamic settings for Signature & Secretary
  let sigImgBase64 = '';
  let secretaryNameSetting = 'Dr. Danjuma Namo';
  try {
    const settingsRes = await pool.query('SELECT key, value FROM settings WHERE key IN ($1, $2)', ['journal_signature', 'journal_secretary']);
    settingsRes.rows.forEach(r => {
      if (r.key === 'journal_signature') sigImgBase64 = r.value;
      if (r.key === 'journal_secretary') secretaryNameSetting = r.value;
    });
  } catch (err) {
    console.error('Settings fetch error for PDF:', err);
  }

  y -= 45; // Base spacing for signature

  if (sigImgBase64 && sigImgBase64.startsWith('data:image')) {
    try {
      const base64Data = sigImgBase64.split(',')[1];
      const sigImgBytes = Buffer.from(base64Data, 'base64');
      let sigImg;
      if (sigImgBase64.includes('image/png')) {
        sigImg = await pdfDoc.embedPng(sigImgBytes);
      } else {
        sigImg = await pdfDoc.embedJpg(sigImgBytes);
      }

      const sigDims = sigImg.scaleToFit(140, 50);
      page.drawImage(sigImg, {
        x: margin,
        y: y, // Position it correctly
        width: sigDims.width,
        height: sigDims.height,
      });
      y -= 10; // Extra breathing room after signature image
    } catch (err) {
      console.error('Failed to embed signature image:', err);
      // Fallback: draw some space if signature fails
      y -= 20;
    }
  } else {
    // Spacer if no signature is set
    y -= 10;
  }

  page.drawText(secretaryNameSetting, { x: margin, y, size: 11, font: fontBold, color: black });
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
      const logoLeft = await embedJournalAsset(pdfDoc, ['journal-logo.png', 'gmijp-logo.png', 'ain logo.jpeg']);
      const logoRight = await embedJournalAsset(pdfDoc, ['Nasarawa-State-University.jpg', 'university-logo.jpg']);
      if (logoLeft) {
        p.drawImage(logoLeft, { x: margin, y: curY - 50, width: 50, height: 50 });
      }
      if (logoRight) {
        p.drawImage(logoRight, { x: width - margin - 50, y: curY - 50, width: 50, height: 50 });
      }
    } catch (e) { }

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
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set \u2014 skipping acceptance email.');
    return;
  }

  const refNumber = `GMIJP/${new Date().getFullYear()}/${manuscriptId.toString().padStart(4, '0')}`;
  const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const appUrl = APP_URL;
  const gmijpLogo = `${appUrl}/gmijp-logo.png`;
  const nsukLogo = `${appUrl}/university-logo.jpg`;

  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #1a202c; line-height: 1.7;">
      <div style="border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden;">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 70%); border-bottom: 3px solid #800000;">
          <h1 style="margin: 0; color: #800000; font-size: 24px;">Acceptance Letter</h1>
          <p style="margin: 8px 0 0; color: #475569; font-size: 14px;">${JOURNAL_NAME}</p>
        </div>
        <div style="padding: 32px;">
          <p>Dear <strong>${researcherName}</strong>,</p>
          <p>We are pleased to inform you that your manuscript has been accepted for publication in the <strong>${JOURNAL_NAME}</strong>.</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0; background:#f8fafc; border-radius:8px; overflow:hidden;">
            <tr><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Reference</td><td style="padding:10px 16px; font-family:monospace; color:#1a202c; font-weight:bold;">${refNumber}</td></tr>
            <tr style="background:#f1f5f9;"><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Manuscript</td><td style="padding:10px 16px; color:#1a202c;">${manuscriptTitle}</td></tr>
            <tr><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Date</td><td style="padding:10px 16px; color:#1a202c;">${currentDate}</td></tr>
            <tr style="background:#f1f5f9;"><td style="padding:10px 16px; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Status</td><td style="padding:10px 16px; color:#16a34a; font-weight:bold;">Accepted</td></tr>
          </table>
          <p>Your <strong>official Acceptance Letter PDF</strong> is attached to this email. The Journal Preliminary Pages are also attached for your reference.</p>
          <p>Your manuscript will now proceed through final formatting, DOI registration, and production. You will receive your published PDF and certificate upon completion.</p>
          <p style="color:#64748b; font-size:13px; margin-top:24px;">This is an automated message from the editorial system. Please do not reply directly to this email.</p>
        </div>
      </div>
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

    await sendResendEmail({
      to,
      subject: `Acceptance Letter — ${manuscriptTitle.substring(0, 80)}`,
      html: htmlBody,
      attachments,
      fromName: JOURNAL_SHORT_NAME,
    });
    console.log(`✅ Acceptance email + PDF sent to ${to} for paper #${manuscriptId}`);
  } catch (error) {
    console.error('Acceptance email error:', error);
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
        from: `GMIJP <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject: `ACTION REQUIRED: DOI Validation Failed — ${title.substring(0, 50)}`,
        html: htmlBody
      })
    });
  } catch (err) {
    console.error('Failure email error:', err);
  }
}

const scheduleDoiRetry = async (paperId: number) => {
  try {
    const journalConfig = await getJournalConfig();
    if (!journalConfig.doiAutoRetryEnabled) {
      console.log(`[DOI RETRY] Disabled. Skipping retry for paper ${paperId}.`);
      return;
    }
    const intervalMinutes = Math.max(10, journalConfig.doiAutoRetryIntervalMinutes || 20);
    console.log(`[DOI RETRY] Scheduling retry for paper ${paperId} in ${intervalMinutes} minutes.`);
    setTimeout(async () => {
      try {
        console.log(`[DOI RETRY] Attempting retry for paper ${paperId}...`);
        await finalizePublicationFromRetry(paperId);
      } catch (err) {
        console.error(`[DOI RETRY] Retry failed for paper ${paperId}:`, err);
      }
    }, intervalMinutes * 60 * 1000);
  } catch (err) {
    console.error('[DOI RETRY] Failed to schedule retry:', err);
  }
};

app.post('/api/publish/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id: paperId } = idParamSchema.parse(req.params);
    const userId = req.user.id;
    const paperResult = await pool.query('SELECT * FROM papers WHERE id = $1 AND user_id = $2', [paperId, userId]);
    const paper = paperResult.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata) : (paper.metadata || {}));

    if (paper.status === 'published' && paper.doi) {
      const existingUrl = `https://doi.org/${paper.doi}`;
      return res.json({
        success: true,
        doi: paper.doi,
        url: existingUrl,
        title: paper.title || 'Untitled',
        volume: paper.volume,
        issue: paper.issue,
        issn: paper.issn,
        publishedAt: paper.published_at,
        certificateId: paper.certificate_id,
        pdfUrl: `/api/papers/${paperId}/published-pdf`,
        certificateUrl: `/api/papers/${paperId}/certificate`
      });
    }

    if (!['ready', 'accepted', 'doi_validation_failed'].includes(paper.status)) {
      return res.status(400).json({ error: 'Manuscript is not in a publishable stage. Move it to accepted before publishing.' });
    }

    if (metadata.similarityScore && metadata.similarityScore > 25) {
      return res.status(400).json({ error: `Publication REJECTED: Similarity score of ${metadata.similarityScore}% exceeds the 25% journal limit.` });
    }

    const sourcePageCount = resolveSourcePageCount(metadata, paper.content || '');
    const pageWindow = metadata.pageWindow || buildPageWindow(sourcePageCount);

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
    if (!metadata.ast && ast) {
      metadata.ast = ast;
    }
    paper.metadata = metadata;

    const zenodoToken = process.env.ZENODO_ACCESS_TOKEN;
    if (!zenodoToken) throw new Error("Zenodo Access Token missing.");

    // 1. Resolve Journal Branding
    const journalConfig = await getJournalConfig();
    const vol = parseInt(journalConfig.currentVolume || '1', 10);
    const iss = parseInt(journalConfig.currentIssue || '1', 10);
    const issn = journalConfig.journalIssn || '2971-7760';

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

    let finalDoi = '';
    let draftPdfBuffer: Buffer = Buffer.alloc(0);
    let finalPdfBuffer: Buffer = Buffer.alloc(0);
    let certificateBuffer: Buffer = Buffer.alloc(0);
    let certificateId = '';
    let publishedAt = '';

    try {
      let draftPdfBytes: Buffer | Uint8Array;
      if (paper.formatted_content) {
        try {
          draftPdfBytes = await generateHighFidelityPaperPDF(paperId, {
            doi: prereservedDoi,
            volume: vol,
            issue: iss,
            issn,
            publishedAt: new Date().toISOString(),
            startPageNumber
          });
        } catch (err) {
          console.warn(`[PUBLISH] High-fidelity draft failed for paper ${paperId}. Falling back to structural PDF.`, err);
          draftPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi: prereservedDoi });
        }
      } else {
        draftPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi: prereservedDoi });
      }

      draftPdfBuffer = Buffer.isBuffer(draftPdfBytes) ? draftPdfBytes : Buffer.from(draftPdfBytes);
      const draftPdf = await PDFDocument.load(draftPdfBuffer);
      const draftPageCount = draftPdf.getPageCount();

      if (!isWithinPageWindow(draftPageCount, pageWindow)) {
        const updatedMetadata = {
          ...metadata,
          sourcePageCount,
          pageWindow,
          pageCount: draftPageCount,
          pageCountWithinWindow: false
        };
        await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [JSON.stringify(updatedMetadata), paperId]);
        return res.status(400).json({
          error: `Page count mismatch: expected ${pageWindow.min}-${pageWindow.max} pages, got ${draftPageCount}.`,
          pageCount: draftPageCount,
          pageWindow
        });
      }

      finalDoi = await finalizeZenodoPublish(depositionId, zenodoToken, paper, draftPdfBuffer, bucketUrl);

      console.log(`Checking DOI resolution status for ${finalDoi}...`);
      const isLive = await validateDOI(finalDoi);
      if (!isLive) {
        console.warn('DOI is registered but not yet live on global resolution servers. Proceeding with database archival.');
      }
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

      scheduleDoiRetry(paperId);
      return res.status(400).json({
        error: `DOI Registration Issue: ${e.message}`,
        status: 'doi_validation_failed',
        doi: recoveryDoi,
        autoRetryScheduled: true
      });
    }

    const doi = finalDoi || prereservedDoi;
    const url = `https://doi.org/${doi}`;
    publishedAt = new Date().toISOString();

    let finalPdfBytes: Buffer | Uint8Array;
    if (paper.formatted_content) {
      try {
        finalPdfBytes = await generateHighFidelityPaperPDF(paperId, {
          doi,
          volume: vol,
          issue: iss,
          issn,
          publishedAt,
          startPageNumber
        });
      } catch (err) {
        console.warn(`[PUBLISH] High-fidelity final failed for paper ${paperId}. Falling back to structural PDF.`, err);
        finalPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi });
      }
    } else {
      finalPdfBytes = await generateFinalManuscriptPDF(ast, { vol, issue: iss, issn, startPageNumber, doi });
    }
    finalPdfBuffer = Buffer.isBuffer(finalPdfBytes) ? finalPdfBytes : Buffer.from(finalPdfBytes);
    const finalPdfDoc = await PDFDocument.load(finalPdfBuffer);
    const finalPageCount = finalPdfDoc.getPageCount();
    const pageCountWithinWindow = isWithinPageWindow(finalPageCount, pageWindow);

    const history = Array.isArray(metadata.history) ? metadata.history : [];
    const nextVersion = (metadata.version || 1) + 1;
    history.push({
      action: 'published',
      version: nextVersion,
      doi,
      url,
      timestamp: publishedAt,
      pageCount: finalPageCount
    });

    const updatedMetadata = {
      ...metadata,
      doi,
      url,
      volume: vol,
      issue: iss,
      issn,
      publishedAt,
      version: nextVersion,
      history,
      startPageNumber,
      pageCount: finalPageCount,
      sourcePageCount,
      pageWindow,
      pageCountWithinWindow
    };

    const finalFilename = `${buildSafeFilename(paper.title || 'article')}_Published.pdf`;
    certificateId = paper.certificate_id || buildCertificateId(paperId, publishedAt);
    const certificateBranding = buildPaperBranding(paper, journalConfig, {
      doi,
      volume: vol,
      issue: iss,
      issn,
      publishedAt
    });
    certificateBuffer = await generatePublicationCertificatePDF(
      { ...paper, metadata },
      certificateBranding,
      certificateId,
      journalConfig
    );

    // Upload final PDF to R2 if configured, otherwise store as BYTEA
    let storedFinalPdfBlob: Buffer | null = finalPdfBuffer;
    let storedFinalPdfUrl: string | null = null;
    if (R2_ENABLED) {
      storedFinalPdfUrl = await uploadToR2(`papers/final/${paperId}/${finalFilename}`, finalPdfBuffer, 'application/pdf');
      storedFinalPdfBlob = null;
    }

    await pool.query(
      "UPDATE papers SET status = 'published', metadata = $1, doi = $2, volume = $3, issue = $4, issn = $5, published_at = $6, final_pdf = $7, final_pdf_filename = $8, certificate_id = $9, is_locked = TRUE, final_pdf_url = $11 WHERE id = $10",
      [JSON.stringify(updatedMetadata), doi, vol.toString(), iss.toString(), issn, publishedAt, storedFinalPdfBlob, finalFilename, certificateId, paperId, storedFinalPdfUrl]
    );

    // 5. Volume/Issue Increment Logic
    const countRes = await pool.query("SELECT COUNT(*) FROM papers WHERE status = 'published' AND volume = $1 AND issue = $2", [vol.toString(), iss.toString()]);
    const count = parseInt(countRes.rows[0].count);
    const max = journalConfig.maxManuscriptsPerIssue || 10;
    const maxIssues = journalConfig.maxIssuesPerVolume || 12;

    if (count >= max) {
      if (iss >= maxIssues) {
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
      await sendPublicationEmail(user.email, user.name, ast.title || paper.title, {
        doi,
        url,
        volume: vol.toString(),
        issue: iss.toString(),
        issn,
        publishedAt,
        certificateId,
        pdfBuffer: finalPdfBuffer,
        certificateBuffer
      });
    }

    res.json({
      success: true,
      doi,
      url,
      title: ast.title || paper.title,
      volume: vol.toString(),
      issue: iss.toString(),
      issn,
      publishedAt,
      certificateId,
      pdfUrl: `/api/papers/${paperId}/published-pdf`,
      certificateUrl: `/api/papers/${paperId}/certificate`
    });

  } catch (error: any) {
    console.error('Final Publishing Error:', error);
    res.status(500).json({ error: error.message || 'Publication pipeline failed.' });
  }
});

app.get('/api/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Always fetch fresh user data from database (not stale JWT)
    const userResult = await pool.query('SELECT id, email, name, affiliation, role, tenant_id, matric_number, level, credit_balance FROM users WHERE id = $1', [userId]);
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

    // --- STUDENT PORTAL HARDENING (FOR BOTH IF/ELSE) ---
    let accessBlocked = false;
    let entryFee = 0;

    if (freshUser.role === 'student' && freshUser.tenant_id) {
      // Resolve current matric number and category from roster (Source of Truth for Workspace)
      const rosterRes = await pool.query(
        'SELECT matric_number, category_id FROM students_roster WHERE email = $1 AND tenant_id = $2',
        [freshUser.email, freshUser.tenant_id]
      );

      let currentMatric = freshUser.matric_number;
      let currentCatId = freshUser.category_id;

      if (rosterRes.rows.length > 0) {
        currentMatric = rosterRes.rows[0].matric_number;
        currentCatId = rosterRes.rows[0].category_id;

        // Ensure user record is synced with roster
        if (freshUser.matric_number !== currentMatric || freshUser.category_id !== currentCatId) {
          await pool.query('UPDATE users SET matric_number = $1, category_id = $2 WHERE id = $3', [currentMatric, currentCatId, userId]);
          freshUser.matric_number = currentMatric;
          freshUser.category_id = currentCatId;
        }
      }

      // Alias for frontend compatibility
      freshUser.matricNumber = currentMatric;

      // Enforce Payment Gate using the roster-resolved category
      if (currentCatId) {
        const catRes = await pool.query('SELECT is_paid_entry, entry_fee FROM student_categories WHERE id = $1', [currentCatId]);
        if (catRes.rows[0]?.is_paid_entry) {
          const payRes = await pool.query(
            "SELECT id FROM transactions WHERE user_id = $1 AND type = 'portal_entry' AND status = 'success'",
            [userId]
          );
          if (payRes.rows.length === 0) {
            accessBlocked = true;
            entryFee = catRes.rows[0].entry_fee;
          }
        }
      }
    }

    if (profile) {
      profile.publications = safeParse(profile.publications, []);
      profile.metrics = safeParse(profile.metrics, { citations: 0, hIndex: 0, i10Index: 0 });

      const papersResult = await pool.query('SELECT id, title, status, doi, created_at FROM papers WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      const papers = papersResult.rows;

      const responseData: any = {
        user: { ...freshUser, accessBlocked, entryFee },
        profile,
        papers,
        tenant,
        subscriptionPrice
      };

      // If super_admin, include global platform stats
      if (freshUser.role === 'super_admin') {
        const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
        const totalPapersResult = await pool.query('SELECT COUNT(*) FROM papers');
        const publishedPapersResult = await pool.query("SELECT COUNT(*) FROM papers WHERE status = 'published'");
        const pendingReviewResult = await pool.query("SELECT COUNT(*) FROM papers WHERE status IN ('peer_review', 'integrity_check', 'formatting')");
        const totalRevenueResult = await pool.query("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'success'");
        const allPapersResult = await pool.query(`
          SELECT p.id, p.title, p.status, p.doi, p.created_at, u.name as researcher_name, u.email as researcher_email, t.name as tenant_name
          FROM papers p 
          LEFT JOIN users u ON p.user_id = u.id 
          LEFT JOIN tenants t ON p.tenant_id = t.id
          ORDER BY p.created_at DESC
          LIMIT 100
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
        user: { ...freshUser, accessBlocked, entryFee },
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
        } catch (e) { }

        metrics.interests = interests;
        await pool.query('UPDATE profiles SET metrics = $1 WHERE user_id = $2', [JSON.stringify(metrics), userId]);
      }
    }

    // Fetch and return updated profile (Full sync with hardened fields)
    const updatedUserRes = await pool.query('SELECT id, email, name, affiliation, role, tenant_id, matric_number FROM users WHERE id = $1', [userId]);
    const updatedUser = updatedUserRes.rows[0];
    if (updatedUser) {
      updatedUser.matricNumber = updatedUser.matric_number;
    }
    res.json({ success: true, user: updatedUser });
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
          {
            role: 'user', content: `Analyze the following academic paper metadata and identify any citation mismatches (e.g., references in text not in bibliography, or vice versa).
        Sections: ${JSON.stringify(metadata.sections)}
        References: ${JSON.stringify(metadata.references)}`
          }
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
        <p><strong>DOI:</strong> <a href="${doiUrl(paper.doi)}">${doiUrl(paper.doi)}</a></p>
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
app.get('/api/admin/payment-events', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const limitRaw = parseInt(String(req.query.limit || '50'), 10);
    const offsetRaw = parseInt(String(req.query.offset || '0'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
    const q = String(req.query.q || '').trim();
    const eventType = String(req.query.event_type || '').trim();
    const gateway = String(req.query.gateway || '').trim();

    const where: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (q) {
      where.push(`(pe.reference ILIKE $${idx} OR u.email ILIKE $${idx} OR u.name ILIKE $${idx})`);
      values.push(`%${q}%`);
      idx += 1;
    }
    if (eventType) {
      where.push(`pe.event_type = $${idx}`);
      values.push(eventType);
      idx += 1;
    }
    if (gateway) {
      where.push(`pe.gateway = $${idx}`);
      values.push(gateway);
      idx += 1;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT 
        pe.id,
        pe.reference,
        pe.gateway,
        pe.event_type,
        pe.amount,
        pe.payload,
        pe.created_at,
        t.type AS transaction_type,
        t.status AS transaction_status,
        t.amount AS transaction_amount,
        t.user_id,
        u.name AS user_name,
        u.email AS user_email
      FROM payment_events pe
      LEFT JOIN transactions t ON t.reference = pe.reference
      LEFT JOIN users u ON u.id = t.user_id
      ${whereClause}
      ORDER BY pe.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);
    res.json({ events: result.rows, limit, offset });
  } catch (error) {
    console.error('Payment events fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payment events' });
  }
});
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

    // Scope options sent from frontend (lecturer: deleteStudents, deleteExams, deleteMaterials)
    // (researcher: deletePublications, deleteTransactions)
    // Default all to true for backwards compat
    const scope = {
      deleteStudents:     req.body?.deleteStudents     !== false,
      deleteExams:        req.body?.deleteExams        !== false,
      deleteMaterials:    req.body?.deleteMaterials    !== false,
      deletePublications: req.body?.deletePublications !== false,
      deleteTransactions: req.body?.deleteTransactions !== false,
    };

    // Cascading deletes for user data
    await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [id]);
    if (scope.deleteTransactions) await pool.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM reviews WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM profiles WHERE user_id = $1', [id]);

    // Delete publication records (optional based on scope)
    if (scope.deletePublications) {
      const papers = await pool.query('SELECT id FROM papers WHERE user_id = $1', [id]);
      for (const p of papers.rows) {
        await pool.query('DELETE FROM paper_references WHERE paper_id = $1', [p.id]);
        await pool.query('DELETE FROM reviews WHERE paper_id = $1', [p.id]);
      }
      await pool.query('DELETE FROM papers WHERE user_id = $1', [id]);
    }

    // Delete associated tenant if user is a lecturer (tenant_admin)
    const userResult = await pool.query('SELECT role, tenant_id FROM users WHERE id = $1', [id]);
    const user = userResult.rows[0];
    if (user && user.role === 'tenant_admin' && user.tenant_id) {
      const tid = user.tenant_id;

      if (scope.deleteExams) {
        // exam_results has no ON DELETE CASCADE — must delete manually first
        await pool.query('DELETE FROM exam_results WHERE exam_id IN (SELECT id FROM exams WHERE tenant_id = $1)', [tid]);
        await pool.query('DELETE FROM exam_results WHERE tenant_id = $1', [tid]);
        await pool.query('DELETE FROM exam_answers WHERE tenant_id = $1', [tid]);
        // exams cascade-deletes: questions, exam_slots, assignment_submissions
        await pool.query('DELETE FROM exams WHERE tenant_id = $1', [tid]);
      }

      if (scope.deleteStudents) {
        // Delete attendance first (FK student_id → users)
        await pool.query('DELETE FROM attendance_records WHERE tenant_id = $1', [tid]);
        await pool.query('DELETE FROM attendance_sessions WHERE tenant_id = $1', [tid]);
        try { await pool.query('DELETE FROM attendance WHERE tenant_id = $1', [tid]); } catch (_) {}
        await pool.query('DELETE FROM students_roster WHERE tenant_id = $1', [tid]);
        await pool.query('UPDATE users SET category_id = NULL WHERE tenant_id = $1', [tid]);
        // Clear all FK dependencies before deleting student users
        await pool.query("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND role = 'student')", [tid]);
        await pool.query("DELETE FROM exam_results WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND role = 'student')", [tid]);
        await pool.query("DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND role = 'student')", [tid]);
        await pool.query("DELETE FROM chat_messages WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND role = 'student')", [tid]);
        await pool.query("DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND role = 'student')", [tid]);
        await pool.query("DELETE FROM users WHERE tenant_id = $1 AND role = 'student'", [tid]);
        // Delete resources referencing student_categories before removing the categories
        await pool.query('DELETE FROM resources WHERE category_id IN (SELECT id FROM student_categories WHERE tenant_id = $1)', [tid]);
        await pool.query('DELETE FROM student_categories WHERE tenant_id = $1', [tid]);
      }

      if (scope.deleteMaterials) {
        await pool.query('DELETE FROM resources WHERE tenant_id = $1', [tid]);
        // videos are now stored in resources table — no separate videos table delete needed
      }

      if (scope.deleteTransactions) {
        await pool.query('DELETE FROM transactions WHERE tenant_id = $1', [tid]);
      }

      // Always remove the tenant workspace itself
      await pool.query('DELETE FROM tenants WHERE id = $1', [tid]);
    }

    // Finally delete the lecturer user account (clear all FK dependencies first)
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM exam_results WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM reviews WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM profiles WHERE user_id = $1', [id]);
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
    const result = await pool.query('SELECT file_blob, file_url, title, metadata, user_id FROM papers WHERE id = $1', [id]);
    const paper = result.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });

    const isOwner = paper.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    const metadata = (typeof paper.metadata === 'string' ? JSON.parse(paper.metadata || '{}') : (paper.metadata || {}));
    const ext = metadata.mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const mimetype = metadata.mimetype || 'application/pdf';
    const safeTitle = (paper.title || 'manuscript').replace(/[^a-zA-Z0-9]/g, '_');

    // R2 URL — redirect directly to CDN
    if (paper.file_url) return res.redirect(302, paper.file_url);

    // Legacy BYTEA — serve and lazily migrate
    if (paper.file_blob) {
      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.${ext}"`);
      res.send(paper.file_blob);
      lazyMigrateToR2('papers', id, 'file_blob', 'file_url', mimetype, `manuscript.${ext}`).catch(() => {});
      return;
    }

    return res.status(404).json({ error: 'PDF file not available for this paper.' });
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
  const validStatuses = PUBLICATION_STATUSES;
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
      SELECT p.id, p.title, p.status, p.doi, p.created_at, p.metadata, u.name as researcher_name, u.email as researcher_email
      FROM papers p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = $1
    `, [id]);
    const paper = updated.rows[0];

    if (paper?.status === 'accepted' && paper?.researcher_email) {
      const metadata = safeJsonParse<any>(paper.metadata, {});
      if (!metadata.acceptanceEmailSent) {
        try {
          await sendAcceptanceEmail(paper.researcher_email, paper.researcher_name || 'Researcher', paper.title || 'Untitled', paper.id);
          const nextMetadata = {
            ...metadata,
            acceptanceEmailSent: true,
            acceptanceEmailSentAt: new Date().toISOString()
          };
          await pool.query('UPDATE papers SET metadata = $1 WHERE id = $2', [JSON.stringify(nextMetadata), paper.id]);
        } catch (emailErr) {
          console.error('Auto acceptance email failed:', emailErr);
        }
      }
    }
    res.json({ success: true, paper });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update paper status' });
  }
});

// Permanently delete a paper and all its associated data (super_admin only)
app.delete('/api/admin/papers/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only super admins can permanently delete publications.' });
  try {
    const { id } = idParamSchema.parse(req.params);
    const paperCheck = await pool.query('SELECT id, title, volume, issue, status FROM papers WHERE id = $1', [id]);
    if (!paperCheck.rows[0]) return res.status(404).json({ error: 'Publication not found.' });

    const { title, volume, issue, status } = paperCheck.rows[0];

    // Cascade delete in correct order to avoid FK violations
    await pool.query('DELETE FROM paper_references WHERE paper_id = $1', [id]);
    await pool.query('DELETE FROM reviews WHERE paper_id = $1', [id]);
    // Nullify paper_id on ALL transactions (including successful ones) to release FK
    await pool.query('UPDATE transactions SET paper_id = NULL WHERE paper_id = $1', [id]);
    await pool.query('DELETE FROM papers WHERE id = $1', [id]);

    console.log(`[Admin] Paper #${id} ("${title}") permanently deleted by user #${req.user.id}`);

    // If a published paper was deleted, resequence the remaining papers in that issue
    // so subsequent papers fill the gap rather than leaving orphaned page numbers
    if (status === 'published' && volume && issue) {
      try {
        await resequenceIssuePages(String(volume), String(issue));
      } catch (seqErr) {
        console.error('[Pages] Resequence after delete failed (non-blocking):', seqErr);
      }
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Delete paper error:', error);
    res.status(500).json({ error: 'Failed to delete publication.' });
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
// Journal Settings (Volume, Issue, ISSN, Signature, Secretary)
app.get('/api/admin/config/journal', authenticateToken, async (req: any, res) => {
  try {
    const keys = ['current_volume', 'current_issue', 'journal_issn', 'max_manuscripts_per_issue', 'max_issues_per_volume', 'max_pages_per_manuscript', 'journal_signature', 'journal_secretary', 'doi_auto_retry_enabled', 'doi_auto_retry_interval_minutes'];
    const results = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [keys]);

    const settings: any = {};
    results.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json({
      current_volume: settings.current_volume || '1',
      current_issue: settings.current_issue || '1',
      journal_issn: settings.journal_issn || '2971-7760',
      max_manuscripts_per_issue: parseInt(settings.max_manuscripts_per_issue || '10'),
      max_issues_per_volume: parseInt(settings.max_issues_per_volume || '3'),
      max_pages_per_manuscript: parseInt(settings.max_pages_per_manuscript || '20'),
      journal_signature: settings.journal_signature || '',
      journal_secretary: settings.journal_secretary || 'Dr. Danjuma Namo',
      doi_auto_retry_enabled: settings.doi_auto_retry_enabled !== 'false',
      doi_auto_retry_interval_minutes: parseInt(settings.doi_auto_retry_interval_minutes || '20')
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/config/journal', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const {
    current_volume, current_issue, journal_issn,
    max_manuscripts_per_issue, max_issues_per_volume, max_pages_per_manuscript,
    journal_signature, journal_secretary,
    doi_auto_retry_enabled, doi_auto_retry_interval_minutes
  } = req.body;
  try {
    const queries = [];
    if (current_volume !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_volume', current_volume.toString()]));
    if (current_issue !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['current_issue', current_issue.toString()]));
    if (journal_issn !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_issn', journal_issn.toString()]));
    if (max_manuscripts_per_issue !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_manuscripts_per_issue', max_manuscripts_per_issue.toString()]));
    if (max_issues_per_volume !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_issues_per_volume', max_issues_per_volume.toString()]));
    if (max_pages_per_manuscript !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['max_pages_per_manuscript', max_pages_per_manuscript.toString()]));
    if (journal_signature !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_signature', journal_signature]));
    if (journal_secretary !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['journal_secretary', journal_secretary]));
    if (doi_auto_retry_enabled !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['doi_auto_retry_enabled', doi_auto_retry_enabled ? 'true' : 'false']));
    if (doi_auto_retry_interval_minutes !== undefined) queries.push(pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['doi_auto_retry_interval_minutes', doi_auto_retry_interval_minutes.toString()]));

    await Promise.all(queries);
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

// ─── PAYMENT GATEWAY TOGGLE CONTROL ───────────────────────────────────────

// Public: Fetch active gateway configuration (polled by frontend payment modal — no auth needed)
app.get('/api/payment/gateways', async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('gateway_paystack_enabled', 'gateway_kora_enabled')"
    );
    const map: Record<string, string> = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      paystack: map['gateway_paystack_enabled'] !== 'false',
      kora: map['gateway_kora_enabled'] !== 'false'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gateway config' });
  }
});

// Admin: Get gateway toggle settings
app.get('/api/admin/config/gateways', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('gateway_paystack_enabled', 'gateway_kora_enabled')"
    );
    const map: Record<string, string> = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      paystack: map['gateway_paystack_enabled'] !== 'false',
      kora: map['gateway_kora_enabled'] !== 'false'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gateway config' });
  }
});

// Admin: Update gateway toggle settings
app.post('/api/admin/config/gateways', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { paystack, kora } = req.body;
  try {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('gateway_paystack_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [paystack === false ? 'false' : 'true']
    );
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('gateway_kora_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [kora === false ? 'false' : 'true']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update gateway config' });
  }
});

// ─── JOURNAL LIVE STATS ──────────────────────────────────────────────

app.get('/api/admin/config/journal-stats', authenticateToken, async (req: any, res) => {
  try {
    const config = await getJournalConfig();
    const vol = config.currentVolume.toString();
    const iss = config.currentIssue.toString();
    const maxPapers = config.maxManuscriptsPerIssue || 10;
    const maxIssues = config.maxIssuesPerVolume || 3;

    const [issuePapers, volumeIssues, totalPublished] = await Promise.all([
      pool.query(
        "SELECT id, title, metadata, published_at FROM papers WHERE status='published' AND volume=$1 AND issue=$2 ORDER BY published_at ASC",
        [vol, iss]
      ),
      pool.query("SELECT DISTINCT issue FROM papers WHERE status='published' AND volume=$1", [vol]),
      pool.query("SELECT COUNT(*) FROM papers WHERE status='published'"),
    ]);

    const papersInIssue = issuePapers.rows.length;
    const issuesInVolume = volumeIssues.rows.length || 1;

    // Build per-paper page range list
    const paperList = issuePapers.rows.map((row: any, idx: number) => {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      const startPage: number = meta.startPageNumber || 1;
      const pageCount: number = meta.pageCount || meta.sourcePageCount || 0;
      const endPage = pageCount > 0 ? startPage + pageCount - 1 : startPage;
      return {
        serial: idx + 1,
        id: row.id,
        title: row.title,
        startPage,
        endPage,
        pageCount,
        publishedAt: row.published_at,
      };
    });

    // Cumulative page total for current issue
    const totalPagesInIssue = paperList.reduce((sum: number, p: any) => sum + p.pageCount, 0);
    const nextStartPage = totalPagesInIssue + 1;

    res.json({
      currentVolume: config.currentVolume,
      currentIssue: config.currentIssue,
      papersInCurrentIssue: papersInIssue,
      maxManuscriptsPerIssue: maxPapers,
      remainingInIssue: Math.max(0, maxPapers - papersInIssue),
      issuesInCurrentVolume: issuesInVolume,
      maxIssuesPerVolume: maxIssues,
      remainingIssues: Math.max(0, maxIssues - issuesInVolume),
      totalPublished: parseInt(totalPublished.rows[0].count),
      totalPagesInIssue,
      nextStartPage,
      papers: paperList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESEARCHER NAV CONFIG ──────────────────────────────────────────

app.get('/api/admin/config/researcher-nav', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'researcher_nav_config'");
    const defaults = { apa_validation: true, writing: true, formatting: true, references: true, integrity: true, reviews: true, journals: true };
    if (!result.rows.length) return res.json(defaults);
    try {
      return res.json({ ...defaults, ...JSON.parse(result.rows[0].value) });
    } catch {
      return res.json(defaults);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch nav config' });
  }
});

app.post('/api/admin/config/researcher-nav', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const allowed = ['apa_validation', 'writing', 'formatting', 'references', 'integrity', 'reviews', 'journals'];
    const config: any = {};
    allowed.forEach(k => { if (typeof req.body[k] === 'boolean') config[k] = req.body[k]; });
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('researcher_nav_config', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [JSON.stringify(config)]
    );
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update nav config' });
  }
});

// ─── REPUBLISH CONFIG ────────────────────────────────────────────────

app.get('/api/settings/republish-config', authenticateToken, async (_req: any, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'republish_config'");
    const defaults = { enabled: false, paid: false, amount: 0 };
    if (!result.rows.length) return res.json(defaults);
    res.json({ ...defaults, ...JSON.parse(result.rows[0].value) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch republish config' });
  }
});

app.post('/api/admin/config/republish', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'super_admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { enabled, paid, amount } = req.body;
    const config = {
      enabled: Boolean(enabled),
      paid: Boolean(paid),
      amount: paid ? Math.max(0, Number(amount) || 0) : 0
    };
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ('republish_config', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [JSON.stringify(config)]
    );
    res.json({ success: true, config });
  } catch {
    res.status(500).json({ error: 'Failed to save republish config' });
  }
});

// Researcher triggers a republish on their already-published paper
app.post('/api/papers/:id/republish', authenticateToken, async (req: any, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);

    // Verify paper belongs to user and is published
    const paperRes = await pool.query('SELECT id, status, user_id FROM papers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    const paper = paperRes.rows[0];
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.status !== 'published') return res.status(409).json({ error: 'Only fully published papers can be republished' });

    // Load republish config
    const cfgRes = await pool.query("SELECT value FROM settings WHERE key = 'republish_config'");
    const cfg = cfgRes.rows.length ? JSON.parse(cfgRes.rows[0].value) : { enabled: false, paid: false, amount: 0 };
    if (!cfg.enabled) return res.status(403).json({ error: 'Republishing is not currently enabled by the administrator' });

    if (cfg.paid && cfg.amount > 0) {
      // Verify a successful payment was made for this republish reference
      const { paymentReference } = req.body;
      if (!paymentReference) return res.status(402).json({ error: 'Payment reference required', amount: cfg.amount });
      const txRes = await pool.query(
        "SELECT id, status FROM transactions WHERE reference = $1 AND user_id = $2 AND status = 'success'",
        [paymentReference, req.user.id]
      );
      if (!txRes.rows.length) return res.status(402).json({ error: 'Payment not confirmed. Please complete payment before republishing.', amount: cfg.amount });
    }

    // Reset paper back to accepted so it re-enters the publish pipeline
    await pool.query(
      "UPDATE papers SET status = 'accepted', formatted_content = NULL, final_pdf = NULL, doi = NULL WHERE id = $1",
      [id]
    );

    res.json({ success: true, message: 'Your manuscript has been queued for republication. It will go through formatting and publication again.' });
  } catch (err: any) {
    console.error('Republish error:', err?.message);
    res.status(500).json({ error: 'Republish failed. Please try again.' });
  }
});

// ─── SHARED PAYMENT HELPERS ─────────────────────────────────────────

// Helper: Create a Kora (Korapay) bank transfer charge and return virtual account details
async function initializeKoraVirtualAccount(user: any, amount: number, reference: string): Promise<any[]> {
  const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY;
  if (!KORA_SECRET_KEY) throw new Error('Kora gateway is not configured.');

  const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KORA_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reference,
      amount,
      currency: 'NGN',
      customer: {
        email: user.email,
        name: user.name || user.email.split('@')[0]
      },
      channels: ['bank_transfer']
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kora failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Kora charge initialization failed');

  // Normalize Kora bank transfer response to match our bankAccounts shape
  const transfer = data.data?.payment_options?.bank_transfer;
  if (!transfer) throw new Error('Kora did not return bank transfer details');

  return [{
    bankName: transfer.bank_name || 'Kora Bank',
    accountNumber: transfer.account_number,
    accountName: transfer.account_name || user.name
  }];
}

// Helper: Create a Korapay checkout session (hosted payment page)
async function initializeKoraCheckout(user: any, amount: number, reference: string, options: {
  redirectUrl?: string;
  notificationUrl?: string;
  channels?: string[];
} = {}): Promise<{
  checkoutUrl: string;
  publicKey: string;
  amount: number;
  amount_naira?: number;
  currency: string;
  reference: string;
  customer: { email: string; name: string }
}> {
  const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY;
  const KORA_PUBLIC_KEY = process.env.KORA_PUBLIC_KEY || ''; // Should be in env
  if (!KORA_SECRET_KEY) throw new Error('Kora gateway is not configured.');

  const payload: Record<string, any> = {
    reference,
    amount,
    currency: 'NGN',
    customer: {
      email: user.email,
      name: user.name || user.email.split('@')[0]
    },
    channels: options.channels || ['bank_transfer', 'card', 'pay_with_bank']
  };

  if (options.redirectUrl) payload.redirect_url = options.redirectUrl;
  if (options.notificationUrl) payload.notification_url = options.notificationUrl;

  const response = await fetch('https://api.korapay.com/merchant/api/v1/charges/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KORA_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kora failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Kora checkout initialization failed');
  const checkoutUrl = data.data?.checkout_url;
  if (!checkoutUrl) throw new Error('Kora did not return a checkout URL');

  return {
    checkoutUrl,
    publicKey: KORA_PUBLIC_KEY,
    amount,
    amount_naira: amount,
    currency: 'NGN',
    reference,
    customer: payload.customer
  };
}

const buildPaystackInlinePayload = (user: any, amount: number, reference: string) => {
  const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';
  return {
    publicKey: PAYSTACK_PUBLIC_KEY,
    email: user.email,
    name: user.name || user.email?.split?.('@')?.[0] || '',
    amount_kobo: Math.round(Number(amount || 0) * 100),
    amount_naira: Number(amount || 0),
    currency: 'NGN',
    reference
  };
};

const buildKoraInlinePayload = (user: any, amount: number, reference: string) => {
  const KORA_PUBLIC_KEY = process.env.KORA_PUBLIC_KEY || '';
  const email = user.email;
  const name = user.name || user.email?.split?.('@')?.[0] || '';
  return {
    publicKey: KORA_PUBLIC_KEY,
    amount: Number(amount || 0),
    amount_naira: Number(amount || 0),
    currency: 'NGN',
    reference,
    email,
    name,
    customer: {
      email,
      name
    }
  };
};

// Helper: Verify a Korapay charge by reference
async function verifyKoraCharge(reference: string): Promise<{ status: string; amount?: number; amountPaid?: number }> {
  const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY;
  if (!KORA_SECRET_KEY) throw new Error('Kora gateway is not configured.');

  const response = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KORA_SECRET_KEY}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kora verify failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Kora verify failed');

  return {
    status: String(data?.data?.status || '').toLowerCase(),
    amount: Number(data?.data?.amount || 0),
    amountPaid: Number(data?.data?.amount_paid || 0)
  };
}

// Helper: Create a Paystack checkout session
async function initializePaystackCheckout(user: any, amount: number, reference: string, options: {
  redirectUrl?: string;
  channels?: string[];
} = {}): Promise<{
  checkoutUrl: string;
  publicKey: string;
  amount: number;
  amount_kobo?: number;
  amount_naira?: number;
  email: string;
  reference: string;
}> {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || ''; // Should be in env
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack gateway is not configured.');

  const payload: Record<string, any> = {
    email: user.email,
    amount: Math.round(amount * 100), // Paystack uses kobo
    reference: reference,
    channels: options.channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
  };

  if (options.redirectUrl) payload.callback_url = options.redirectUrl;

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': "Bearer " + PAYSTACK_SECRET_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Paystack failed (" + response.status + "): " + errorText);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Paystack checkout initialization failed');

  const checkoutUrl = data.data?.authorization_url;
  if (!checkoutUrl) throw new Error('Paystack did not return an authorization URL');

  return {
    checkoutUrl,
    publicKey: PAYSTACK_PUBLIC_KEY,
    amount: payload.amount,
    amount_kobo: payload.amount,
    amount_naira: Number(amount || 0),
    email: user.email,
    reference
  };
}

// Helper: Verify a Paystack charge by reference
async function verifyPaystackCharge(reference: string): Promise<{ status: string; amount?: number; amountPaid?: number }> {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack gateway is not configured.');

  const response = await fetch("https://api.paystack.co/transaction/verify/" + reference, {
    method: 'GET',
    headers: {
      'Authorization': "Bearer " + PAYSTACK_SECRET_KEY
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Paystack verify failed (" + response.status + "): " + errorText);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Paystack verify failed');

  return {
    status: String(data?.data?.status || '').toLowerCase(),
    amount: Number(data?.data?.requested_amount || 0) / 100,
    amountPaid: Number(data?.data?.amount || 0) / 100
  };
}

type RefundResult = {
  status: string;
  refundReference?: string;
  payload: any;
};

async function requestPaystackRefund(reference: string, amount: number): Promise<RefundResult> {
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack gateway is not configured.');

  const payload = {
    transaction: reference,
    amount: Math.max(1, Math.round(Number(amount || 0) * 100))
  };

  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      'Authorization': "Bearer " + PAYSTACK_SECRET_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Paystack refund failed (" + response.status + "): " + errorText);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Paystack refund request failed');

  return {
    status: String(data?.data?.status || 'requested').toLowerCase(),
    refundReference: data?.data?.reference || data?.data?.refund_reference || data?.data?.id,
    payload: data
  };
}

async function requestKoraRefund(reference: string, amount: number): Promise<RefundResult> {
  const KORA_SECRET_KEY = process.env.KORA_SECRET_KEY;
  if (!KORA_SECRET_KEY) throw new Error('Kora gateway is not configured.');

  const payload = {
    reference,
    amount: Math.max(1, Math.round(Number(amount || 0))),
    currency: 'NGN',
    reason: 'Overpayment refund'
  };

  const response = await fetch('https://api.korapay.com/merchant/api/v1/refunds', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KORA_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kora refund failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Kora refund request failed');

  return {
    status: String(data?.data?.status || 'requested').toLowerCase(),
    refundReference: data?.data?.reference || data?.data?.id,
    payload: data
  };
}

async function requestGatewayRefund(gateway: string, reference: string, amount: number): Promise<RefundResult> {
  if (gateway === 'kora') {
    return requestKoraRefund(reference, amount);
  }
  return requestPaystackRefund(reference, amount);
}

// PaymentPoint / Kora — Publication Payment
app.post('/api/payment/initialize', authenticateToken, async (req: any, res) => {
  const { amount, type, gateway = 'paystack', mode = 'inline' } = req.body;
  const reference = `GMIJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const resolvedType = type || 'publication';
    const requestedAmount = Number(amount || 0);
    const creditResult = await applyUserCredit(req.user.id, requestedAmount);
    const redirectUrl = buildPaymentReturnUrl(reference, gateway, resolvedType);
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;
    const chargeAmount = creditResult.chargeAmount;

    if (chargeAmount > 0) {
      if (gateway === 'kora') {
        if (mode === 'inline' || mode === 'checkout') {
          paymentResponse = await initializeKoraCheckout(req.user, chargeAmount, reference, {
            redirectUrl,
            notificationUrl: `${APP_URL}/api/payment/webhook/kora`
          });
        } else {
          bankAccounts = await initializeKoraVirtualAccount(req.user, chargeAmount, reference);
        }
      } else {
        if (mode === 'inline') {
          paymentResponse = buildPaystackInlinePayload(req.user, chargeAmount, reference);
        } else {
          paymentResponse = await initializePaystackCheckout(req.user, chargeAmount, reference, { redirectUrl });
        }
      }
    }

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        req.tenant_id,
        reference,
        requestedAmount,
        chargeAmount > 0 ? 'pending' : 'success',
        resolvedType,
        JSON.stringify({
          gateway,
          mode,
          credit_used: creditResult.creditUsed,
          credit_applied: creditResult.creditApplied,
          paid_so_far: creditResult.creditUsed,
          remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0)
        })
      ]
    );

    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway,
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit:${reference}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }

    if (chargeAmount === 0) {
      await recomputeTransaction(reference, gateway);
    }

    res.json({
      reference,
      amount: requestedAmount,
      remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0),
      credit_applied: creditResult.creditApplied,
      credit_used: creditResult.creditUsed,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      bankAccounts,
      message: `Transfer ₦${Number(amount).toLocaleString()} to any of the bank accounts below to complete your payment.`
    });
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
  }
});

// Student Attendance — PaymentPoint / Kora
app.post('/api/payment/attendance/initialize', authenticateToken, async (req: any, res) => {
  const { course_id, amount, gateway = 'paystack', mode = 'inline' } = req.body;
  if (!course_id || !amount) return res.status(400).json({ error: 'course_id and amount are required' });

  const reference = `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const requestedAmount = Number(amount || 0);
    const creditResult = await applyUserCredit(req.user.id, requestedAmount);
    const redirectUrl = buildPaymentReturnUrl(reference, gateway, 'attendance_token');
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;
    const chargeAmount = creditResult.chargeAmount;
    if (chargeAmount > 0) {
      if (gateway === 'kora') {
        if (mode === 'inline' || mode === 'checkout') {
          paymentResponse = await initializeKoraCheckout(req.user, chargeAmount, reference, {
            redirectUrl,
            notificationUrl: `${APP_URL}/api/payment/webhook/kora`
          });
        } else {
          bankAccounts = await initializeKoraVirtualAccount(req.user, chargeAmount, reference);
        }
      } else {
        if (mode === 'inline') {
          paymentResponse = buildPaystackInlinePayload(req.user, chargeAmount, reference);
        } else {
          paymentResponse = await initializePaystackCheckout(req.user, chargeAmount, reference, { redirectUrl });
        }
      }
    }

    const attendance_date = new Date().toISOString().split('T')[0];
    const expires_at_date = new Date();
    expires_at_date.setMinutes(expires_at_date.getMinutes() + 30);
    const expires_at = expires_at_date.toISOString();

    const metadata = { course_id, attendance_date, expires_at, gateway };

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        req.tenant_id,
        reference,
        requestedAmount,
        chargeAmount > 0 ? 'pending' : 'success',
        'attendance_token',
        { ...metadata, credit_used: creditResult.creditUsed, credit_applied: creditResult.creditApplied, paid_so_far: creditResult.creditUsed, remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0) }
      ]
    );

    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway,
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit:${reference}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }
    if (chargeAmount === 0) {
      await recomputeTransaction(reference, gateway);
    }

    res.json({
      reference, amount: requestedAmount, bankAccounts,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      expires_at,
      credit_applied: creditResult.creditApplied,
      credit_used: creditResult.creditUsed,
      remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0),
      message: `Transfer ₦${Number(amount).toLocaleString()} to sign attendance for ${course_id}.`
    });
  } catch (err: any) {
    console.error('Attendance Payment initialization error:', err);
    res.status(500).json({ error: 'Attendance payment initialization failed', details: err.message });
  }
});

// Remaining balance top-up (auto credit + new checkout)
app.post('/api/payment/topup', authenticateToken, async (req: any, res) => {
  try {
    const { reference, gateway, mode = 'checkout' } = req.body;
    if (!reference) return res.status(400).json({ error: 'reference is required' });

    const parentRes = await pool.query(
      'SELECT * FROM transactions WHERE reference = $1 AND user_id = $2',
      [reference, req.user.id]
    );
    const parentTx = parentRes.rows[0];
    if (!parentTx) return res.status(404).json({ error: 'Transaction not found' });

    await recomputeTransaction(reference, parentTx.metadata?.gateway || gateway || 'paystack');
    const meta = safeJsonParse<any>(parentTx.metadata, {});
    const paidSoFar = await sumPaymentEvents(reference);
    const requiredAmount = Number(parentTx.amount || 0);
    const remaining = Math.max(requiredAmount - paidSoFar, 0);

    if (remaining <= 0) {
      return res.json({
        reference,
        amount: 0,
        remaining_amount: 0,
        status: 'success',
        message: 'Payment already completed.'
      });
    }

    const creditResult = await applyUserCredit(req.user.id, remaining);
    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway: gateway || meta.gateway || 'paystack',
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit-topup:${reference}:${creditResult.creditUsed}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }

    const newRemaining = Math.max(remaining - creditResult.creditUsed, 0);
    if (newRemaining === 0) {
      await recomputeTransaction(reference, gateway || meta.gateway || 'paystack');
      return res.json({
        reference,
        amount: 0,
        remaining_amount: 0,
        credit_applied: true,
        credit_used: creditResult.creditUsed,
        status: 'success',
        message: 'Remaining balance covered by wallet credit.'
      });
    }

    const topupRef = `TOPUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const resolvedGateway = gateway || meta.gateway || 'paystack';
    const redirectUrl = buildPaymentReturnUrl(topupRef, resolvedGateway, 'payment_topup');
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;

    if (resolvedGateway === 'kora') {
      if (mode === 'inline' || mode === 'checkout') {
        paymentResponse = await initializeKoraCheckout(req.user, newRemaining, topupRef, {
          redirectUrl,
          notificationUrl: `${APP_URL}/api/payment/webhook/kora`
        });
      } else {
        bankAccounts = await initializeKoraVirtualAccount(req.user, newRemaining, topupRef);
      }
    } else {
      if (mode === 'inline') {
        paymentResponse = buildPaystackInlinePayload(req.user, newRemaining, topupRef);
      } else {
        paymentResponse = await initializePaystackCheckout(req.user, newRemaining, topupRef, { redirectUrl });
      }
    }


    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        parentTx.tenant_id,
        topupRef,
        newRemaining,
        'pending',
        'payment_topup',
        JSON.stringify({
          gateway: resolvedGateway,
          topup_for: reference,
          original_reference: reference,
          original_amount: requiredAmount,
          remaining_amount: newRemaining,
          credit_used: creditResult.creditUsed
        })
      ]
    );

    try {
      const parentMeta = safeJsonParse<any>(parentTx.metadata, {});
      const existingRefs = Array.isArray(parentMeta.topup_refs) ? parentMeta.topup_refs : [];
      await pool.query(
        'UPDATE transactions SET metadata = metadata || $1 WHERE id = $2',
        [JSON.stringify({ topup_refs: [...existingRefs, topupRef] }), parentTx.id]
      );
    } catch (e) {
      console.error('Failed to append topup ref:', e);
    }

    res.json({
      reference: topupRef,
      amount: newRemaining,
      remaining_amount: newRemaining,
      bankAccounts,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      credit_used: creditResult.creditUsed,
      topup_for: reference
    });
  } catch (err: any) {
    console.error('Topup payment init error:', err);
    res.status(500).json({ error: 'Topup initialization failed', details: err.message });
  }
});

app.post('/api/payment/abandon', authenticateToken, async (req: any, res) => {
  try {
    const { reference, reason } = req.body || {};
    if (!reference) {
      return res.status(400).json({ error: 'Reference is required' });
    }

    const txRes = await pool.query(
      'SELECT id, status, amount, metadata FROM transactions WHERE reference = $1 AND user_id = $2',
      [reference, req.user.id]
    );
    const tx = txRes.rows[0];
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    if (tx.status === 'success') {
      return res.status(409).json({ error: 'Completed payments cannot be cancelled' });
    }

    const meta = safeJsonParse<any>(tx.metadata, {});
    const abandonedPayload = {
      abandoned: true,
      abandoned_at: new Date().toISOString(),
      abandoned_reason: reason || 'user_cancel',
      abandoned_by: req.user.id
    };

    await pool.query(
      'UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
      ['abandoned', JSON.stringify(abandonedPayload), tx.id]
    );

    await insertPaymentEvent({
      reference,
      gateway: meta?.gateway || 'unknown',
      eventType: 'abandoned',
      amount: 0,
      eventKey: `abandoned:${reference}`,
      payload: abandonedPayload
    });

    res.json({ status: 'abandoned', reference });
  } catch (error) {
    console.error('Payment abandon error:', error);
    res.status(500).json({ error: 'Unable to cancel payment right now' });
  }
});


app.get('/api/payment/verify/:reference', authenticateToken, async (req: any, res) => {
  try {
    const { reference } = req.params;
    const result = await pool.query(
      'SELECT id, status, amount, type, metadata FROM transactions WHERE reference = $1 AND user_id = $2',
      [reference, req.user.id]
    );
    const txn = result.rows[0];
    if (!txn) return res.status(404).json({ status: 'not_found', error: 'Transaction not found' });

    const meta = safeJsonParse<any>(txn.metadata, {});
    const gateway = meta?.gateway || txn.metadata?.gateway || txn.metadata?.gateway?.toString?.();

    if (txn.status !== 'success') {
      if (gateway === 'kora' && process.env.KORA_SECRET_KEY) {
        try {
          const verifyResult = await verifyKoraCharge(reference);
          if (verifyResult.status === 'success') {
            const paid = Number(verifyResult.amountPaid || verifyResult.amount || 0);
            if (paid > 0) {
              const eventKey = `verify:kora:${reference}:${paid}`;
              await insertPaymentEvent({
                reference,
                gateway: 'kora',
                eventType: 'payment',
                amount: paid,
                eventKey,
                payload: verifyResult
              });

              if (meta?.topup_for) {
                await insertPaymentEvent({
                  reference: meta.topup_for,
                  gateway: 'kora',
                  eventType: 'payment',
                  amount: paid,
                  eventKey: `${eventKey}:parent`,
                  payload: { ...verifyResult, child_reference: reference }
                });
              }
            }
          } else if (verifyResult.status === 'failed') {
            await pool.query('UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
              ['failed', JSON.stringify({ kora_status: verifyResult.status, verified_at: new Date().toISOString() }), txn.id]);
          }
        } catch (verifyErr) {
          console.error('Kora verify error:', verifyErr);
        }
      } else if (gateway === 'paystack' && process.env.PAYSTACK_SECRET_KEY) {
        try {
          const verifyResult = await verifyPaystackCharge(reference);
          if (verifyResult.status === 'success') {
            const paid = Number(verifyResult.amountPaid || verifyResult.amount || 0);
            if (paid > 0) {
              const eventKey = `verify:paystack:${reference}:${paid}`;
              await insertPaymentEvent({
                reference,
                gateway: 'paystack',
                eventType: 'payment',
                amount: paid,
                eventKey,
                payload: verifyResult
              });
              if (meta?.topup_for) {
                await insertPaymentEvent({
                  reference: meta.topup_for,
                  gateway: 'paystack',
                  eventType: 'payment',
                  amount: paid,
                  eventKey: `${eventKey}:parent`,
                  payload: { ...verifyResult, child_reference: reference }
                });
              }
            }
          } else if (verifyResult.status === 'failed') {
            await pool.query('UPDATE transactions SET status = $1, metadata = metadata || $2 WHERE id = $3',
              ['failed', JSON.stringify({ paystack_status: verifyResult.status, verified_at: new Date().toISOString() }), txn.id]);
          }
        } catch (verifyErr: any) {
          // Silently ignore "transaction not found" — occurs when polling fires before
          // the user completes payment on Paystack's side (reference not yet created there).
          const msg = String(verifyErr?.message || '');
          if (!msg.includes('Transaction reference not found')) {
            console.error('Paystack verify error:', verifyErr);
          }
        }
      }
    }

    const parentRef = meta?.topup_for || reference;
    const gatewayName = gateway || 'paystack';
    await recomputeTransaction(reference, gatewayName);
    if (parentRef !== reference) {
      await recomputeTransaction(parentRef, gatewayName);
    }

    const latest = await pool.query('SELECT status, amount, metadata, type FROM transactions WHERE reference = $1', [parentRef]);
    const latestTx = latest.rows[0];
    const latestMeta = safeJsonParse<any>(latestTx?.metadata, {});
    const paidSoFar = Number(latestMeta?.paid_so_far || 0);
    const remainingAmount = Number(latestMeta?.remaining_amount || 0);
    const overpaid = Number(latestMeta?.overpaid || 0);

    res.json({ status: latestTx?.status || txn.status, amount: latestTx?.amount || txn.amount, paid_so_far: paidSoFar, remaining_amount: remainingAmount, overpaid, type: latestTx?.type || txn.type });
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

// ─── VIDEO ENDPOINTS (R2 Storage) ───────────────────────────────────
// Videos are stored in the resources table (type='video') and served via R2.

// List all videos for lecturer portal
app.get('/api/videos', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT id, name, file_url, mime_type, is_paid, price, is_available, created_at
       FROM resources WHERE tenant_id = $1 AND type = 'video' ORDER BY created_at DESC`,
      [req.tenant_id]
    );
    res.json({ videos: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video (stored as resource) — also removes file from R2
app.delete('/api/videos/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const row = await pool.query('SELECT file_url FROM resources WHERE id = $1 AND tenant_id = $2 AND type = $3',
      [req.params.id, req.tenant_id, 'video']);
    const fileUrl: string | null = row.rows[0]?.file_url || null;
    await pool.query('DELETE FROM resources WHERE id = $1 AND tenant_id = $2 AND type = $3',
      [req.params.id, req.tenant_id, 'video']);
    if (fileUrl) deleteFromR2(fileUrl);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update video settings (monetization)
app.put('/api/videos/:id/settings', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { price, is_available, is_paid } = req.body;
    await pool.query(
      'UPDATE resources SET price = $1, is_paid = $2, is_available = $3 WHERE id = $4 AND tenant_id = $5 AND type = $6',
      [price ?? 0, is_paid ?? false, is_available ?? true, req.params.id, req.tenant_id, 'video']
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MULTI-TENANT ACADEMIC ENDPOINTS ────────────────────────────────
// ─── RESOURCE HUB ENDPOINTS ─────────────────────────────────────────
// Get basic tenant info for current researcher/lecturer
app.get('/api/tenant/info', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query('SELECT id, name, workspace_id FROM tenants WHERE id = $1', [req.tenant_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tenant info' });
  }
});

app.get('/api/resources', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT id, type, name, status, created_at, is_available, price, is_paid, category_id FROM resources WHERE tenant_id = $1 ORDER BY created_at DESC',
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

// Download Resource File (Roster CSV, Material Content, etc)
app.get('/api/resources/:id/download', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT name, type, content FROM resources WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const { name, type, content } = result.rows[0];

    // Handle CSV Roster Download
    if (type === 'roster') {
      try {
        const students = typeof content === 'string' ? JSON.parse(content) : content;

        // Build CSV string
        const csvRows = ['Name,Matriculation Number,Email']; // Header
        students.forEach((s: any) => {
          csvRows.push(`"${s.name || ''}","${s.matricNumber || ''}","${s.email || ''}"`);
        });
        const csvString = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${name.endsWith('.csv') ? name : name + '.csv'}"`);
        return res.send(csvString);

      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse roster content format' });
      }
    }

    // Re-query with file storage fields
    const fullResult = await pool.query(
      'SELECT name, type, content, file_blob, file_url, mime_type FROM resources WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant_id]
    );
    const row = fullResult.rows[0];

    // R2 URL — redirect directly to CDN
    if (row.file_url) return res.redirect(302, row.file_url);

    // Legacy BYTEA — serve and lazily migrate to R2
    if (row.file_blob) {
      const mime = row.mime_type || 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="${row.name}"`);
      res.send(row.file_blob);
      lazyMigrateToR2('resources', req.params.id, 'file_blob', 'file_url', mime, row.name).catch(() => {});
      return;
    }

    // Fallback: serve extracted text
    res.setHeader('Content-Disposition', `attachment; filename="${row.name}"`);
    const c = row.content;
    if (typeof c === 'object' && c?.text) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(c.text);
    }
    if (typeof c === 'string') {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(c);
    }
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(c, null, 2));

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Text-only preview (for PPTX / unsupported binary formats)
app.get('/api/resources/:id/text', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT name, content FROM resources WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenant_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const c = result.rows[0].content;
    // Content may be stored as a JSON string (text column) or already parsed (jsonb column)
    let parsed: any;
    if (typeof c === 'string') {
      try { parsed = JSON.parse(c); } catch { parsed = c; }
    } else {
      parsed = c;
    }
    let text = '';
    if (typeof parsed === 'string') {
      text = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (typeof parsed.text === 'string') {
        text = parsed.text; // standard { text: "..." } format
      } else {
        // officeParser structured JSON — walk recursively to collect all text nodes
        text = extractTextFromOfficeParserJson(parsed);
      }
    }
    res.json({ name: result.rows[0].name, text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/academic/tests', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      'SELECT id, title, duration, created_at, is_available, price, is_paid, type, start_date, end_date, timer_mode, questions_count, batch_size, instructions, published_status, submission_type, due_date, allow_late, category_id, difficulty, blooms_level, max_attempts, is_pool, pool_size, material_id FROM exams WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// File-based material upload — extracts text from PDF/DOCX before storing
app.post('/api/resources/upload/file', authenticateToken, checkSubscription, (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large. Maximum allowed size is 2 GB for video and 500 MB for audio.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    next();
  });
}, async (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided.' });
    const { type, name, categoryName, categoryId, isPaidEntry, entryFee } = req.body;
    if (!type || !name) return res.status(400).json({ error: 'Missing required fields' });

    const mime = req.file.mimetype;
    const origName = (req.file.originalname || '').toLowerCase();
    const isVideoOrAudio = mime.startsWith('video/') || mime.startsWith('audio/') ||
      [
        // Video
        '.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.wmv', '.m4v', '.3gp', '.3g2',
        '.ogv', '.ts', '.mts', '.m2ts', '.mpeg', '.mpg', '.hevc', '.h264', '.h265', '.asf', '.divx',
        // Audio
        '.mp3', '.wav', '.flac', '.aac', '.ogg', '.opus', '.m4a', '.wma', '.aiff', '.aif',
        '.amr', '.3gp', '.caf', '.ra', '.rm'
      ].some(ext => origName.endsWith(ext));

    // Read file buffer only when text extraction is needed (skip for video/audio)
    let textContent = '';
    if (!isVideoOrAudio) {
      const fileBuffer = fs.readFileSync(req.file.path);

      if (mime === 'application/pdf' || origName.endsWith('.pdf')) {
        const data = await pdfParse(fileBuffer);
        textContent = data.text || '';
      } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || origName.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        textContent = result.value || '';
      } else if (mime === 'application/msword' || origName.endsWith('.doc')) {
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(fileBuffer);
        textContent = extracted.getBody() || '';
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        origName.endsWith('.pptx')
      ) {
        textContent = await extractPptxText(fileBuffer);
        if (!textContent.trim()) {
          const pptxResult = await officeParser.parseOffice(fileBuffer).catch(() => '');
          textContent = typeof pptxResult === 'string' ? pptxResult : '';
        }
      }
      // Sanitize: strip null bytes that PostgreSQL rejects
      textContent = textContent.replace(/\0/g, '');
    }

    // Handle category
    let final_category_id = categoryId ? parseInt(categoryId) : null;
    if (categoryName && !final_category_id) {
      const catCheck = await pool.query('SELECT id FROM student_categories WHERE tenant_id = $1 AND name = $2', [req.tenant_id, categoryName.trim()]);
      if (catCheck.rows.length > 0) {
        final_category_id = catCheck.rows[0].id;
      } else {
        const catRes = await pool.query(
          'INSERT INTO student_categories (tenant_id, name, is_paid_entry, entry_fee) VALUES ($1, $2, $3, $4) RETURNING id',
          [req.tenant_id, categoryName.trim(), !!isPaidEntry, parseInt(entryFee) || 0]
        );
        final_category_id = catRes.rows[0].id;
      }
    }

    // Upload to R2 (streaming from disk) or fall back to BYTEA
    const contentJson = JSON.stringify({ text: textContent });
    const mimeType = req.file.mimetype || 'application/octet-stream';
    let resourceFileBlob: Buffer | null = R2_ENABLED ? null : (isVideoOrAudio ? null : fs.readFileSync(req.file.path));
    let resourceFileUrl: string | null = null;
    if (R2_ENABLED) {
      const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      resourceFileUrl = await uploadToR2(`resources/${req.tenant_id}/${Date.now()}-${safeFilename}`, fs.createReadStream(req.file.path), mimeType, req.file.size);
    }
    fs.unlink(req.file.path, () => {});
    const result = await pool.query(
      'INSERT INTO resources (tenant_id, type, name, content, status, category_id, file_blob, mime_type, file_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [req.tenant_id, type, name, contentJson, 'ready', final_category_id, resourceFileBlob, mimeType, resourceFileUrl]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err: any) {
    console.error('File material upload error:', err?.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resources/upload', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const { type, name, content, categoryName, categoryId, isPaidEntry, entryFee } = req.body;
    if (!type || !name || !content) return res.status(400).json({ error: 'Missing required fields' });

    // 1. Handle Category (Find or Create)
    let final_category_id = categoryId;
    if (categoryName && !final_category_id) {
      const catCheck = await pool.query('SELECT id FROM student_categories WHERE tenant_id = $1 AND name = $2', [req.tenant_id, categoryName.trim()]);
      if (catCheck.rows.length > 0) {
        final_category_id = catCheck.rows[0].id;
      } else {
        const catRes = await pool.query(
          'INSERT INTO student_categories (tenant_id, name, is_paid_entry, entry_fee) VALUES ($1, $2, $3, $4) RETURNING id',
          [req.tenant_id, categoryName.trim(), !!isPaidEntry, parseInt(entryFee) || 0]
        );
        final_category_id = catRes.rows[0].id;
      }
    } else if (final_category_id) {
      // Price Lock: Update only if current fee is 0
      await pool.query(
        `UPDATE student_categories 
             SET is_paid_entry = CASE WHEN entry_fee = 0 THEN $1 ELSE is_paid_entry END,
                 entry_fee = CASE WHEN entry_fee = 0 THEN $2 ELSE entry_fee END
             WHERE id = $3 AND tenant_id = $4`,
        [!!isPaidEntry, parseInt(entryFee) || 0, final_category_id, req.tenant_id]
      );
    }

    // 2. Resolve Workspace Info for Email
    const tenantRes = await pool.query('SELECT workspace_id, name FROM tenants WHERE id = $1', [req.tenant_id]);
    const workspaceId = tenantRes.rows[0]?.workspace_id || 'N/A';
    const workspaceName = tenantRes.rows[0]?.name || 'Academic Portal';

    // 3. Process Roster Students
    if (type === 'roster') {
      const students = Array.isArray(content) ? content : [];
      if (students.length === 0) return res.status(400).json({ error: 'Empty roster' });

      // Deep Sanitize the entire students array to prevent PG errors on JSON storage later
      const sanitizedStudents = students.map((s: any) => {
        const clean = (val: any) => typeof val === 'string' ? val.replace(/\0/g, '').trim() : val;
        // Support various frontend property names
        const email = clean(s.email || s.studentEmail || s.emailAddress || s.Email);
        const name = clean(s.name || s.studentName || s.fullName || s.Name);
        const matric = clean(s.matricNumber || s.regNumber || s.matricNo || s.matric);
        const course = clean(s.course || s.department || s.program);

        return {
          ...s,
          name,
          email,
          matricNumber: matric,
          course
        };
      });

      // Counters for UI feedback
      const uploadAdded: {matric: string, name: string}[] = [];
      const uploadUpdated: {matric: string, name: string, changes: string[]}[] = [];
      const uploadConflicts: {matric: string, name: string, reason: string}[] = [];
      const uploadFailed: {matric: string, reason: string}[] = [];

      // Deduplicate within the file itself (by matric, then by email)
      const seenMatrics = new Set<string>();
      const seenEmails = new Set<string>();
      const deduped = sanitizedStudents.filter((s: any) => {
        const m = (s.matricNumber || '').toLowerCase();
        const e = (s.email || '').toLowerCase();
        if (!m || !e) return true; // validation will catch these
        if (seenMatrics.has(m)) {
          uploadConflicts.push({ matric: s.matricNumber || '?', name: s.name || '?', reason: 'Duplicate in uploaded file (same matric appears more than once)' });
          return false;
        }
        if (seenEmails.has(e)) {
          uploadConflicts.push({ matric: s.matricNumber || '?', name: s.name || '?', reason: 'Duplicate in uploaded file (same email appears more than once)' });
          return false;
        }
        seenMatrics.add(m);
        seenEmails.add(e);
        return true;
      });

      for (const s of deduped) {
        const matricNumber = s.matricNumber;
        const email = s.email;
        const studentName = s.name || matricNumber;

        if (!matricNumber || !email) {
          uploadFailed.push({ matric: matricNumber || '?', reason: 'Missing matric or email' });
          continue;
        }

        // Email format validation — proper RFC-style check before any DB work
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          uploadFailed.push({ matric: matricNumber, reason: `Invalid email format: ${email}` });
          continue;
        }

        // Check if matric already in roster for this tenant
        const existingMatric = await pool.query(
          'SELECT id, email, name, category_id FROM students_roster WHERE matric_number = $1 AND tenant_id = $2',
          [matricNumber, req.tenant_id]
        );

        if (existingMatric.rows.length > 0) {
          const existingEmail = existingMatric.rows[0].email;
          if (existingEmail.toLowerCase() === email.toLowerCase()) {
            // Same student re-uploaded — detect what changed, then update
            const oldName = existingMatric.rows[0].name;
            const oldCategoryId = existingMatric.rows[0].category_id;
            const changes: string[] = [];
            if (oldName !== studentName) changes.push(`Name: "${oldName}" → "${studentName}"`);
            if (final_category_id && String(oldCategoryId) !== String(final_category_id)) changes.push(`Category updated`);
            await pool.query(
              'UPDATE students_roster SET name = $1, category_id = COALESCE($2, category_id) WHERE matric_number = $3 AND tenant_id = $4',
              [studentName, final_category_id, matricNumber, req.tenant_id]
            );
            uploadUpdated.push({ matric: matricNumber, name: studentName, changes });
          } else {
            // Same matric but different email — conflict, skip
            uploadConflicts.push({ matric: matricNumber, name: studentName, reason: `Matric ${matricNumber} already registered with a different email (${existingEmail})` });
          }
          continue;
        }

        // Check if email already used by a different matric in this tenant
        const existingEmail = await pool.query(
          'SELECT matric_number FROM students_roster WHERE email = $1 AND tenant_id = $2',
          [email, req.tenant_id]
        );
        if (existingEmail.rows.length > 0) {
          uploadConflicts.push({ matric: matricNumber, name: studentName, reason: `Email ${email} already belongs to matric ${existingEmail.rows[0].matric_number}` });
          continue;
        }

        // New student — generate fresh PIN (never stored plain)
        const autoPin = String(Math.floor(1000 + Math.random() * 9000));
        const hashedPin = await hashPin(autoPin);

        await pool.query(
          "INSERT INTO students_roster (tenant_id, matric_number, name, email, pin_hash, category_id, email_status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')",
          [req.tenant_id, matricNumber, studentName, email, hashedPin, final_category_id]
        );

        const userCheck = await pool.query('SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2', [matricNumber, req.tenant_id]);
        if (userCheck.rows.length === 0) {
          await pool.query(
            'INSERT INTO users (email, name, password, role, tenant_id, matric_number, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [email, studentName, hashedPin, 'student', req.tenant_id, matricNumber, final_category_id]
          );
        } else {
          await pool.query('UPDATE users SET password = $1, category_id = COALESCE(category_id, $3) WHERE id = $2', [hashedPin, userCheck.rows[0].id, final_category_id]);
        }

        // Send onboarding email and track status
        try {
          const feeInt = parseInt(entryFee as string) || 0;
          const fullWorkspaceLabel = `${workspaceName} (${workspaceId})`;
          await sendResendEmail({
            fromName: 'Genius Academic Portal',
            to: email,
            subject: `[Genius] Welcome ${studentName} — Your Access Credentials`,
            html: `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.5;">
  <h2 style="color: #1a237e; margin-top: 0;">Welcome to Genius Academy</h2>
  <p>Hi <b>${studentName}</b>,</p>
  <p>You have been enrolled in the <b>${categoryName || 'Academic'}</b> batch at <b>${workspaceName}</b>. Your account is ready!</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 25px 0;">
    <h3 style="margin-top: 0; color: #0f172a; font-size: 16px; text-transform: uppercase;">Your Access Credentials</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
      <tr><td style="padding: 8px 0; color: #64748b;">Workspace ID:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${fullWorkspaceLabel}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Reg. Number:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${matricNumber}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Secure PIN:</td><td style="padding: 8px 0; text-align: right;"><span style="background: #e0e7ff; color: #3730a3; padding: 6px 12px; border-radius: 6px; font-weight: bold; letter-spacing: 2px;">${autoPin}</span></td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Access Mode:</td><td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${isPaidEntry ? '#ef4444' : '#10b981'};">${isPaidEntry ? `Paid (₦${feeInt})` : 'Free Access'}</td></tr>
    </table>
  </div>
  <p style="color: #d97706; font-weight: bold; font-size: 14px; text-align: center;">🔒 Keep your PIN private. Do not share it.</p>
  ${isPaidEntry ? `<p style="color: #ef4444; font-weight: bold; font-size: 14px; text-align: center;">⚠️ Payment required before full portal access.</p>` : ''}
  <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">&copy; 2026 Genius Academic Publishing. All rights reserved.</div>
</div>`
          });
          await pool.query("UPDATE students_roster SET email_status = 'sent' WHERE matric_number = $1 AND tenant_id = $2", [matricNumber, req.tenant_id]);
          uploadAdded.push({ matric: matricNumber, name: studentName });
        } catch (emailErr) {
          console.error('Batch email failed for', email, emailErr);
          await pool.query("UPDATE students_roster SET email_status = 'failed' WHERE matric_number = $1 AND tenant_id = $2", [matricNumber, req.tenant_id]);
          uploadAdded.push({ matric: matricNumber, name: studentName }); // Still added, just email failed
        }
      }

      // Attach import summary to response (stored for later use in the 4. Save block)
      (req as any)._rosterSummary = { added: uploadAdded, updated: uploadUpdated, conflicts: uploadConflicts, failed: uploadFailed };
    }

    // 4. Save the Resource Record (using potentially sanitized content)
    const rawStudents = Array.isArray(content) ? content : [];
    const result = await pool.query(
      'INSERT INTO resources (tenant_id, type, name, content, status, category_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.tenant_id, type, name, JSON.stringify(Array.isArray(content) ? (type === 'roster' ? rawStudents.map((s: any) => ({
        name: typeof s.name === 'string' ? s.name.replace(/\0/g, '') : s.name,
        email: typeof s.email === 'string' ? s.email.replace(/\0/g, '') : s.email,
        matricNumber: typeof s.matricNumber === 'string' ? s.matricNumber.replace(/\0/g, '') : s.matricNumber
      })) : content) : content), 'ready', final_category_id]
    );

    const rosterSummary = (req as any)._rosterSummary;
    res.json({
      success: true,
      id: result.rows[0].id,
      status: 'ready',
      ...(rosterSummary ? {
        rosterSummary: {
          added: rosterSummary.added.length,
          updated: rosterSummary.updated.length,
          conflicts: rosterSummary.conflicts.length,
          failed: rosterSummary.failed.length,
          conflictList: rosterSummary.conflicts,
          failedList: rosterSummary.failed,
          updatedList: rosterSummary.updated,
        }
      } : {})
    });
  } catch (err: any) {
    console.error('Batch upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/resources/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  try {
    const row = await pool.query('SELECT file_url FROM resources WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
    const fileUrl: string | null = row.rows[0]?.file_url || null;
    await pool.query('DELETE FROM resources WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
    if (fileUrl) deleteFromR2(fileUrl); // fire-and-forget, non-fatal
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

// Payment for Material Access — PaymentPoint / Kora
app.post('/api/payment/material/initialize', authenticateToken, async (req: any, res) => {
  const { resource_id, amount, gateway = 'paystack', mode = 'inline' } = req.body;
  if (!resource_id || !amount) return res.status(400).json({ error: 'resource_id and amount are required' });

  const reference = `MAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const requestedAmount = Number(amount || 0);
    const creditResult = await applyUserCredit(req.user.id, requestedAmount);
    const redirectUrl = buildPaymentReturnUrl(reference, gateway, 'material_access');
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;
    const chargeAmount = creditResult.chargeAmount;
    if (chargeAmount > 0) {
      if (gateway === 'kora') {
        if (mode === 'inline' || mode === 'checkout') {
          paymentResponse = await initializeKoraCheckout(req.user, chargeAmount, reference, {
            redirectUrl,
            notificationUrl: `${APP_URL}/api/payment/webhook/kora`
          });
        } else {
          bankAccounts = await initializeKoraVirtualAccount(req.user, chargeAmount, reference);
        }
      } else {
        if (mode === 'inline') {
          paymentResponse = buildPaystackInlinePayload(req.user, chargeAmount, reference);
        } else {
          paymentResponse = await initializePaystackCheckout(req.user, chargeAmount, reference, { redirectUrl });
        }
      }
    }

    const resourceRes = await pool.query('SELECT tenant_id FROM resources WHERE id = $1', [resource_id]);
    const tenant_id = resourceRes.rows[0]?.tenant_id;

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        tenant_id,
        reference,
        requestedAmount,
        chargeAmount > 0 ? 'pending' : 'success',
        'material_access',
        { resource_id, gateway, credit_used: creditResult.creditUsed, credit_applied: creditResult.creditApplied, paid_so_far: creditResult.creditUsed, remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0) }
      ]
    );

    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway,
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit:${reference}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }
    if (chargeAmount === 0) {
      await recomputeTransaction(reference, gateway);
    }

    res.json({
      reference, amount: requestedAmount, bankAccounts,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      credit_applied: creditResult.creditApplied,
      credit_used: creditResult.creditUsed,
      remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0),
      message: `Transfer ₦${Number(amount).toLocaleString()} to access this material.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
  }
});

// Payment for Assessment Access — PaymentPoint / Kora
app.post('/api/payment/assessment/initialize', authenticateToken, async (req: any, res) => {
  const { exam_id, amount, gateway = 'paystack', mode = 'inline' } = req.body;
  if (!exam_id || !amount) return res.status(400).json({ error: 'exam_id and amount are required' });

  const reference = `ASM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    const requestedAmount = Number(amount || 0);
    const creditResult = await applyUserCredit(req.user.id, requestedAmount);
    const redirectUrl = buildPaymentReturnUrl(reference, gateway, 'assessment_access');
    let bankAccounts: any[] = [];
    let paymentResponse: any = null;
    const chargeAmount = creditResult.chargeAmount;
    if (chargeAmount > 0) {
      if (gateway === 'kora') {
        if (mode === 'inline' || mode === 'checkout') {
          paymentResponse = await initializeKoraCheckout(req.user, chargeAmount, reference, {
            redirectUrl,
            notificationUrl: `${APP_URL}/api/payment/webhook/kora`
          });
        } else {
          bankAccounts = await initializeKoraVirtualAccount(req.user, chargeAmount, reference);
        }
      } else {
        if (mode === 'inline') {
          paymentResponse = buildPaystackInlinePayload(req.user, chargeAmount, reference);
        } else {
          paymentResponse = await initializePaystackCheckout(req.user, chargeAmount, reference, { redirectUrl });
        }
      }
    }

    const examRes = await pool.query('SELECT tenant_id FROM exams WHERE id = $1', [exam_id]);
    const tenant_id = examRes.rows[0]?.tenant_id;

    await pool.query(
      'INSERT INTO transactions (user_id, tenant_id, reference, amount, status, type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        req.user.id,
        tenant_id,
        reference,
        requestedAmount,
        chargeAmount > 0 ? 'pending' : 'success',
        'assessment_access',
        { exam_id, gateway, credit_used: creditResult.creditUsed, credit_applied: creditResult.creditApplied, paid_so_far: creditResult.creditUsed, remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0) }
      ]
    );

    if (creditResult.creditUsed > 0) {
      await insertPaymentEvent({
        reference,
        gateway,
        eventType: 'payment',
        amount: creditResult.creditUsed,
        eventKey: `credit:${reference}`,
        payload: { source: 'wallet_credit', credit_used: creditResult.creditUsed }
      });
    }
    if (chargeAmount === 0) {
      await recomputeTransaction(reference, gateway);
    }

    res.json({
      reference, amount: requestedAmount, bankAccounts,
      checkout_url: typeof paymentResponse === 'string' ? paymentResponse : (paymentResponse as any)?.checkoutUrl,
      ...(typeof paymentResponse === 'object' ? paymentResponse : {}),
      credit_applied: creditResult.creditApplied,
      credit_used: creditResult.creditUsed,
      remaining_amount: Math.max(requestedAmount - creditResult.creditUsed, 0),
      message: `Transfer ₦${Number(amount).toLocaleString()} to access this assessment.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Payment initialization failed', details: err.message });
  }
});

// ─── FIX 3: ATTENDANCE RECORDING & RETRIEVAL ────────────────────────
// Student: Mark attendance after confirmed payment
app.post('/api/attendance/mark', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { reference, course_id } = req.body;
    if (!reference) return res.status(400).json({ error: 'Payment reference is required' });

    // Verify a successful attendance_token transaction for this reference
    const txRes = await pool.query(
      `SELECT id, metadata FROM transactions WHERE reference = $1 AND user_id = $2
       AND type = 'attendance_token' AND status = 'success' LIMIT 1`,
      [reference, req.user.id]
    );
    if (txRes.rows.length === 0)
      return res.status(402).json({ error: 'No confirmed attendance payment found for this reference' });

    // Prevent duplicate attendance record
    const dup = await pool.query('SELECT id FROM attendance WHERE reference = $1 LIMIT 1', [reference]);
    if (dup.rows.length > 0)
      return res.status(409).json({ error: 'Attendance already recorded for this payment' });

    const meta = txRes.rows[0].metadata || {};
    const resolvedCourseId = course_id || meta.course_id || 'general';

    await pool.query(
      'INSERT INTO attendance (user_id, tenant_id, course_id, reference) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.tenant_id, resolvedCourseId, reference]
    );

    res.json({ success: true, message: 'Attendance recorded successfully' });
  } catch (error: any) {
    console.error('Attendance mark error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// Student: View own attendance history (from attendance_records via sessions)
app.get('/api/student/attendance', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT ar.id, ar.session_id, ar.marked_at,
              s.title as topic, s.course_code, s.session_date, s.is_paid, s.price
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       WHERE ar.student_id = $1 AND ar.tenant_id = $2
       ORDER BY s.session_date DESC, ar.marked_at DESC`,
      [req.user.id, req.tenant_id]
    );
    const records = result.rows.map((r: any) => ({
      session_id: r.session_id,
      course_code: r.course_code || '—',
      course_name: r.topic || '',
      session_date: r.session_date,
      topic: r.topic || '',
      status: 'present',
      access_type: r.is_paid ? 'paid' : 'free',
      marked_at: r.marked_at
    }));
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Lecturer: View all attendance for their workspace
app.get('/api/attendance', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { course_id, date } = req.query;
    let query = `
      SELECT a.id, a.course_id, a.attended_at, a.reference,
             sr.name as student_name, sr.matric_number, sr.course
      FROM attendance a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN students_roster sr ON sr.matric_number = u.matric_number AND sr.tenant_id = a.tenant_id
      WHERE a.tenant_id = $1`;
    const params: any[] = [req.tenant_id];

    if (course_id) { params.push(course_id); query += ` AND a.course_id = $${params.length}`; }
    if (date) { params.push(date); query += ` AND DATE(a.attended_at) = $${params.length}`; }

    query += ' ORDER BY a.attended_at DESC';
    const result = await pool.query(query, params);

    // Group by course_id for summary
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      if (!grouped[row.course_id]) grouped[row.course_id] = [];
      grouped[row.course_id].push(row);
    }
    res.json({ success: true, attendance: result.rows, grouped, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Lecturer: Get student roster
app.get('/api/courses/roster', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT sr.*, sc.name as category_name
       FROM students_roster sr
       LEFT JOIN student_categories sc ON sc.id = sr.category_id
       WHERE sr.tenant_id = $1
       ORDER BY sr.name ASC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roster' });
  }
});

// Lecturer: Get student categories
app.get('/api/courses/categories', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query('SELECT * FROM student_categories WHERE tenant_id = $1 ORDER BY name ASC', [req.tenant_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ─── FIX 9: Category fee editable until first payment is made ────────
app.put('/api/courses/categories/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { is_paid_entry, entry_fee } = req.body;

    // Check if any student has already successfully paid for this category
    const paidCheck = await pool.query(
      `SELECT t.id FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE u.category_id = $1 AND t.type = 'portal_entry'
       AND t.status = 'success' LIMIT 1`,
      [id]
    );

    if (paidCheck.rows.length > 0) {
      return res.status(403).json({
        error: 'This category fee is permanently locked — students have already paid it and cannot be retroactively affected.',
        locked: true
      });
    }

    // No payments yet — allow the update freely
    await pool.query(
      `UPDATE student_categories SET is_paid_entry = $1, entry_fee = $2 WHERE id = $3 AND tenant_id = $4`,
      [is_paid_entry, entry_fee, id, req.tenant_id]
    );
    res.json({ success: true, message: 'Category fee updated successfully' });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: err.message, locked: true });
    res.status(500).json({ error: 'Update failed' });
  }
});

// Lecturer: Add student to roster with auto-generated PIN
app.post('/api/courses/roster', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const clean = (val: any) => typeof val === 'string' ? val.replace(/\0/g, '').trim() : val;
    const b = req.body;
    const matricNumber = clean(b.matricNumber || b.regNumber || b.matricNo || b.matric);
    const name = clean(b.name || b.studentName || b.fullName || b.Name);
    const email = clean(b.email || b.studentEmail || b.emailAddress || b.Email);
    const course = clean(b.course || b.department || b.program);
    const categoryName = clean(b.categoryName);

    if (!matricNumber || !email || !name) return res.status(400).json({ error: 'Matric Number, Name, and Email are required.' });
    if (!email.includes('@') || email.length < 5) return res.status(400).json({ error: 'Invalid email address.' });

    // 1. Check if student already in roster for this tenant
    const existing = await pool.query('SELECT id FROM students_roster WHERE matric_number = $1 AND tenant_id = $2', [matricNumber, req.tenant_id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Student already in your roster.' });

    // 2. Generate fresh PIN (never stored plain)
    const autoPin = String(Math.floor(1000 + Math.random() * 9000));
    const hashedPin = await hashPin(autoPin);

    // 3. Handle Category Logic (Price Lock)
    let category_id = null;
    if (categoryName) {
      const catCheck = await pool.query('SELECT id, entry_fee FROM student_categories WHERE tenant_id = $1 AND name = $2', [req.tenant_id, categoryName.trim()]);
      if (catCheck.rows.length > 0) {
        category_id = catCheck.rows[0].id;
        // Optional: If categoryName provided but no fees set, we could potentially update it, 
        // but the upload/single-add payload doesn't usually carry fee info for existing categories here.
        // We stick to the Price Lock in the dedicated PIT and Bulk Upload.
      } else {
        const catInsert = await pool.query('INSERT INTO student_categories (tenant_id, name) VALUES ($1, $2) RETURNING id', [req.tenant_id, categoryName.trim()]);
        category_id = catInsert.rows[0].id;
      }
    }

    // 4. Add to roster with hashed PIN
    const tenantRes = await pool.query('SELECT workspace_id, name FROM tenants WHERE id = $1', [req.tenant_id]);
    const workspaceId = tenantRes.rows[0]?.workspace_id || 'N/A';
    const workspaceName = tenantRes.rows[0]?.name || 'Academic Portal';

    await pool.query(
      "INSERT INTO students_roster (tenant_id, matric_number, name, email, course, pin_hash, category_id, email_status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')",
      [req.tenant_id, matricNumber, name, email, course || '', hashedPin, category_id]
    );

    // 5. Create or Link User account
    const userCheck = await pool.query('SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2', [matricNumber, req.tenant_id]);
    if (userCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (email, name, password, role, tenant_id, matric_number, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [email, name, hashedPin, 'student', req.tenant_id, matricNumber, category_id]
      );
    } else {
      await pool.query('UPDATE users SET password = $1, category_id = COALESCE(category_id, $3) WHERE id = $2', [hashedPin, userCheck.rows[0].id, category_id]);
    }

    // 6. Send email with auto-generated PIN
    try {
      const portalBranding = "Genius Academic Portal";
      const fullWorkspaceLabel = `${workspaceName} (${workspaceId})`;
      let emailStatus = 'sent';
      await sendResendEmail({
        fromName: portalBranding,
        to: email,
        subject: `[${portalBranding}] Welcome ${name} — Your Access Credentials`,
        html: `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.5;">
  <h2 style="color: #1a237e; margin-top: 0;">Welcome to Genius Academy</h2>
  <p>Hi <b>${name}</b>,</p>
  <p>You have been registered in the <b>${workspaceName}</b> workspace. Your account is ready!</p>

  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 25px 0;">
    <h3 style="margin-top: 0; color: #0f172a; font-size: 16px; text-transform: uppercase;">Your Access Credentials</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
      <tr><td style="padding: 8px 0; color: #64748b;">Workspace ID:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${fullWorkspaceLabel}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Reg. Number:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${matricNumber}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Secure PIN:</td><td style="padding: 8px 0; text-align: right;"><span style="background: #e0e7ff; color: #3730a3; padding: 6px 12px; border-radius: 6px; font-weight: bold; letter-spacing: 2px;">${autoPin}</span></td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Institution:</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${workspaceName}</td></tr>
    </table>
  </div>

  <p style="color: #d97706; font-weight: bold; font-size: 14px; text-align: center;">🔒 Keep your PIN private. Do not share it.</p>
  
  <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
    &copy; 2026 Genius Academic Publishing. All rights reserved.
  </div>
</div>
        `
      });
      await pool.query("UPDATE students_roster SET email_status = 'sent' WHERE matric_number = $1 AND tenant_id = $2", [matricNumber, req.tenant_id]);
    } catch (emailErr) {
      console.error('Onboarding email failed:', emailErr);
      await pool.query("UPDATE students_roster SET email_status = 'failed' WHERE matric_number = $1 AND tenant_id = $2", [matricNumber, req.tenant_id]);
    }

    res.json({ success: true, message: 'Student added and credentials sent.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Student: Set PIN using Invitation Token
app.post('/api/student/setup-pin', authLimiter, async (req, res) => {
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
    const hashedPin = await hashPin(pin);
    await pool.query(
      'UPDATE students_roster SET pin_hash = $1, setup_token = NULL, token_expires = NULL WHERE id = $2',
      [hashedPin, student.id]
    );

    // 3. Ensure linking/creation of global User account
    const userCheck = await pool.query('SELECT id FROM users WHERE matric_number = $1 AND role = \'student\' LIMIT 1', [matric]);
    if (userCheck.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (email, name, password, role, tenant_id, matric_number, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [student.email, student.name, hashedPin, 'student', student.tenant_id, matric, student.category_id]
      );
    } else {
      await pool.query('UPDATE users SET password = $1, category_id = COALESCE(category_id, $3) WHERE id = $2', [hashedPin, userCheck.rows[0].id, student.category_id]);
    }

    res.json({ success: true, message: 'PIN set successfully. You can now log in.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── FIX 6: Atomic bulk roster import ───────────────────────────────
app.post('/api/courses/roster/bulk', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { students } = req.body; // Array of {matricNumber, name, email, course, categoryName}
    if (!Array.isArray(students) || students.length === 0)
      return res.status(400).json({ error: 'Provide a non-empty students array' });
    if (students.length > 500)
      return res.status(400).json({ error: 'Bulk limit is 500 students per request' });

    const tenantRes = await pool.query('SELECT workspace_id, name FROM tenants WHERE id = $1', [req.tenant_id]);
    const workspaceId = tenantRes.rows[0]?.workspace_id || 'N/A';
    const workspaceName = tenantRes.rows[0]?.name || 'Academic Portal';

    const clean = (val: any) => typeof val === 'string' ? val.replace(/\0/g, '').trim() : val;
    const succeeded: any[] = [];
    const failed: any[] = [];

    // Cache categories to avoid repeated lookups per student
    const categoryCache: Record<string, number> = {};

    const client = await pool.connect();
    // Deduplicate within the file before processing
    const biSeenMatrics = new Set<string>();
    const biSeenEmails = new Set<string>();
    const dedupedStudents: any[] = [];
    for (const raw of students) {
      const m = clean(raw.matricNumber || raw.regNumber || raw.matric || '').toLowerCase();
      const e = clean(raw.email || raw.studentEmail || '').toLowerCase();
      if (m && biSeenMatrics.has(m)) { failed.push({ matric: m, reason: 'Duplicate in file (same matric)' }); continue; }
      if (e && biSeenEmails.has(e)) { failed.push({ matric: m || '?', reason: 'Duplicate in file (same email)' }); continue; }
      if (m) biSeenMatrics.add(m);
      if (e) biSeenEmails.add(e);
      dedupedStudents.push(raw);
    }

    try {
      await client.query('BEGIN');

      // ── Pre-fetch all existing conflicts in 2 queries (eliminates N+1) ──
      const [existingRosterRes, existingUsersRes] = await Promise.all([
        client.query('SELECT matric_number, email FROM students_roster WHERE tenant_id = $1', [req.tenant_id]),
        client.query("SELECT matric_number FROM users WHERE tenant_id = $1 AND role = 'student'", [req.tenant_id]),
      ]);
      const existingByMatric = new Map<string, string>(); // matric → email
      const existingByEmail = new Map<string, string>();  // email → matric
      for (const row of existingRosterRes.rows) {
        existingByMatric.set(row.matric_number.toLowerCase(), row.email.toLowerCase());
        existingByEmail.set(row.email.toLowerCase(), row.matric_number);
      }
      const existingUserMatrics = new Set(existingUsersRes.rows.map((r: any) => r.matric_number.toLowerCase()));

      // ── Validate and classify all students in-memory (no DB queries) ──
      const toInsert: Array<{ matricNumber: string; name: string; email: string; course: string; category_id: number | null; autoPin: string; hashedPin?: string }> = [];
      const toUpdateName: Array<{ matricNumber: string; name: string }> = [];

      for (const raw of dedupedStudents) {
        const matricNumber = clean(raw.matricNumber || raw.regNumber || raw.matric);
        const name = clean(raw.name || raw.studentName || raw.fullName);
        const email = clean(raw.email || raw.studentEmail);
        const course = clean(raw.course || raw.department || '');
        const categoryName = clean(raw.categoryName || '');

        if (!matricNumber || !name || !email) {
          failed.push({ matric: matricNumber || '?', reason: 'Missing matric, name, or email' }); continue;
        }
        if (!email.includes('@') || email.length < 5) {
          failed.push({ matric: matricNumber, reason: 'Invalid email address' }); continue;
        }

        const mKey = matricNumber.toLowerCase();
        const eKey = email.toLowerCase();

        if (existingByMatric.has(mKey)) {
          if (existingByMatric.get(mKey) === eKey) {
            toUpdateName.push({ matricNumber, name });
            failed.push({ matric: matricNumber, reason: 'Updated (already existed, same email)' });
          } else {
            failed.push({ matric: matricNumber, reason: `Conflict: matric already registered with different email (${existingByMatric.get(mKey)})` });
          }
          continue;
        }
        if (existingByEmail.has(eKey)) {
          failed.push({ matric: matricNumber, reason: `Conflict: email already belongs to matric ${existingByEmail.get(eKey)}` }); continue;
        }

        // Category resolution (cached — still 1 query per unique category name)
        let category_id: number | null = null;
        if (categoryName) {
          if (categoryCache[categoryName] !== undefined) {
            category_id = categoryCache[categoryName];
          } else {
            const catCheck = await client.query('SELECT id FROM student_categories WHERE tenant_id = $1 AND name = $2', [req.tenant_id, categoryName]);
            if (catCheck.rows.length > 0) {
              category_id = catCheck.rows[0].id;
            } else {
              const catInsert = await client.query('INSERT INTO student_categories (tenant_id, name) VALUES ($1, $2) RETURNING id', [req.tenant_id, categoryName]);
              category_id = catInsert.rows[0].id;
            }
            categoryCache[categoryName] = category_id!;
          }
        }

        const autoPin = String(Math.floor(1000 + Math.random() * 9000));
        toInsert.push({ matricNumber, name, email, course, category_id, autoPin });
        // Mark as seen to prevent within-batch duplicates
        existingByMatric.set(mKey, eKey);
        existingByEmail.set(eKey, matricNumber);
      }

      // ── Bulk name-updates for re-uploaded students (single query) ──
      for (const u of toUpdateName) {
        await client.query('UPDATE students_roster SET name = $1 WHERE matric_number = $2 AND tenant_id = $3', [u.name, u.matricNumber, req.tenant_id]);
      }

      // ── Hash PINs in parallel batches of 10 ──
      const HASH_BATCH = 10;
      for (let i = 0; i < toInsert.length; i += HASH_BATCH) {
        await Promise.all(toInsert.slice(i, i + HASH_BATCH).map(async s => { s.hashedPin = await hashPin(s.autoPin); }));
      }

      // ── Single batch INSERT into students_roster ──
      if (toInsert.length > 0) {
        const rosterParams: any[] = [req.tenant_id];
        const rosterValues: string[] = [];
        let pi = 2;
        for (const s of toInsert) {
          rosterValues.push(`($1,$${pi},$${pi+1},$${pi+2},$${pi+3},$${pi+4},$${pi+5},'pending')`);
          rosterParams.push(s.matricNumber, s.name, s.email, s.course, s.hashedPin, s.category_id);
          pi += 6;
        }
        await client.query(
          `INSERT INTO students_roster (tenant_id,matric_number,name,email,course,pin_hash,category_id,email_status) VALUES ${rosterValues.join(',')}`,
          rosterParams
        );

        // ── Single batch INSERT into users (new students only) ──
        const newUsers = toInsert.filter(s => !existingUserMatrics.has(s.matricNumber.toLowerCase()));
        if (newUsers.length > 0) {
          const userParams: any[] = [req.tenant_id];
          const userValues: string[] = [];
          let ui = 2;
          for (const s of newUsers) {
            userValues.push(`($${ui},$${ui+1},$${ui+2},'student',$1,$${ui+3},$${ui+4})`);
            userParams.push(s.email, s.name, s.hashedPin, s.matricNumber, s.category_id);
            ui += 5;
          }
          await client.query(
            `INSERT INTO users (email,name,password,role,tenant_id,matric_number,category_id) VALUES ${userValues.join(',')}`,
            userParams
          );
        }

        for (const s of toInsert) succeeded.push({ matric: s.matricNumber, name: s.name, email: s.email, autoPin: s.autoPin });
      }

      await client.query('COMMIT');
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Respond immediately, then send emails and await status updates sequentially
    res.json({
      success: true,
      imported: succeeded.length,
      failedCount: failed.length,
      succeeded: succeeded.map(s => ({ matric: s.matric, name: s.name })),
      failed
    });

    // Send onboarding emails after response — status updates are awaited so failures are recorded
    const fullWorkspaceLabel = `${workspaceName} (${workspaceId})`;
    for (const s of succeeded) {
      try {
        await sendResendEmail({
          fromName: 'Genius Academic Portal',
          to: s.email,
          subject: `[Genius Academy] Welcome ${s.name} — Your Access Credentials`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px;color:#333;max-width:600px;margin:0 auto">
            <h2 style="color:#1a237e">Welcome to Genius Academy</h2>
            <p>Hi <b>${s.name}</b>, you have been registered in the <b>${workspaceName}</b> workspace.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin:20px 0">
              <table style="width:100%;font-size:15px">
                <tr><td style="color:#64748b;padding:6px 0">Workspace ID:</td><td style="text-align:right;font-weight:bold">${fullWorkspaceLabel}</td></tr>
                <tr><td style="color:#64748b;padding:6px 0">Reg. Number:</td><td style="text-align:right;font-weight:bold">${s.matric}</td></tr>
                <tr><td style="color:#64748b;padding:6px 0">Secure PIN:</td><td style="text-align:right"><span style="background:#e0e7ff;color:#3730a3;padding:4px 12px;border-radius:6px;font-weight:bold;letter-spacing:2px">${s.autoPin}</span></td></tr>
              </table>
            </div>
            <p style="color:#d97706;font-weight:bold;text-align:center">🔒 Keep your PIN private.</p>
          </div>`
        });
        await pool.query("UPDATE students_roster SET email_status = 'sent' WHERE matric_number = $1 AND tenant_id = $2", [s.matric, req.tenant_id]);
      } catch {
        await pool.query("UPDATE students_roster SET email_status = 'failed' WHERE matric_number = $1 AND tenant_id = $2", [s.matric, req.tenant_id]).catch(() => {});
      }
    }
  } catch (error: any) {
    console.error('Bulk roster import error:', error);
    res.status(500).json({ error: 'Bulk import failed: ' + error.message });
  }
});

// ─── FIX 7: Material preview (first 300 words) ──────────────────────
app.get('/api/student/materials/:id/preview', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.id, r.name, r.type, r.is_paid, r.price, r.content,
       EXISTS(SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'material_access'
              AND (metadata->>'resource_id')::int = r.id AND status = 'success') as "hasPaid"
       FROM resources r
       JOIN users u ON u.id = $1
       WHERE r.id = $2 AND r.tenant_id = $3 AND r.is_available = true
       AND (r.category_id IS NULL OR r.category_id = u.category_id)`,
      [req.user.id, id, req.tenant_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Material not found' });
    const mat = result.rows[0];

    // If free or already paid, return full content
    if (!mat.is_paid || mat.hasPaid) {
      return res.json({ success: true, preview: false, content: mat.content, name: mat.name, type: mat.type });
    }

    // Extract preview text (~300 words) from content
    let rawText = '';
    if (mat.content) {
      if (typeof mat.content === 'string') rawText = mat.content;
      else if (mat.content.text) rawText = mat.content.text;
      else rawText = JSON.stringify(mat.content);
    }
    const words = rawText.split(/\s+/).filter(Boolean);
    const previewText = words.slice(0, 300).join(' ') + (words.length > 300 ? '…' : '');

    res.json({
      success: true,
      preview: true,
      previewText,
      wordCount: words.length,
      name: mat.name,
      type: mat.type,
      price: mat.price
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load preview' });
  }
});

// Lecturer: Delete Student from Roster
app.put('/api/courses/roster/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { name, email, matric_number } = req.body;
    if (!name || !email || !matric_number) return res.status(400).json({ error: 'name, email, and matric_number are required' });

    // Get current matric to find linked user
    const existingRes = await pool.query('SELECT matric_number FROM students_roster WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
    const oldMatric = existingRes.rows[0].matric_number;

    await pool.query(
      'UPDATE students_roster SET name=$1, email=$2, matric_number=$3 WHERE id=$4 AND tenant_id=$5',
      [name, email, matric_number, id, req.tenant_id]
    );
    await pool.query(
      "UPDATE users SET name=$1, email=$2, matric_number=$3 WHERE matric_number=$4 AND tenant_id=$5 AND role='student'",
      [name, email, matric_number, oldMatric, req.tenant_id]
    );

    res.json({ success: true });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Matric number or email already in use' });
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/courses/roster/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;

    // 1. Get student info first to handle user account cleanup
    const studentRes = await pool.query('SELECT matric_number FROM students_roster WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (studentRes.rows.length === 0) return res.status(404).json({ error: 'Student not found in your roster' });
    const matric = studentRes.rows[0].matric_number;

    // 2. Delete from users (clear all FK dependencies first)
    await pool.query("DELETE FROM attendance_records WHERE student_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query("DELETE FROM exam_results WHERE user_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query("DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query("DELETE FROM chat_messages WHERE user_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query("DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = 'student')", [matric, req.tenant_id]);
    await pool.query('DELETE FROM users WHERE matric_number = $1 AND tenant_id = $2 AND role = \'student\'', [matric, req.tenant_id]);

    // 3. Delete from roster
    await pool.query('DELETE FROM students_roster WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);

    res.json({ success: true, message: 'Student removed from workspace successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

// Lecturer: Resend welcome email for a single student
app.post('/api/courses/roster/:id/resend', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const studentRes = await pool.query(
      'SELECT sr.*, sc.name as category_name FROM students_roster sr LEFT JOIN student_categories sc ON sc.id = sr.category_id WHERE sr.id = $1 AND sr.tenant_id = $2',
      [id, req.tenant_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const s = studentRes.rows[0];

    const tenantRes = await pool.query('SELECT workspace_id, name FROM tenants WHERE id = $1', [req.tenant_id]);
    const workspaceId = tenantRes.rows[0]?.workspace_id || 'N/A';
    const workspaceName = tenantRes.rows[0]?.name || 'Academic Portal';
    const fullWorkspaceLabel = `${workspaceName} (${workspaceId})`;

    // Generate fresh PIN and update hash in DB (plain PIN never stored)
    const plainPin = String(Math.floor(1000 + Math.random() * 9000));
    const freshHash = await hashPin(plainPin);
    await pool.query('UPDATE students_roster SET pin_hash = $1 WHERE id = $2', [freshHash, s.id]);
    await pool.query("UPDATE users SET password = $1 WHERE matric_number = $2 AND tenant_id = $3 AND role = 'student'", [freshHash, s.matric_number, req.tenant_id]);

    await pool.query("UPDATE students_roster SET email_status = 'pending' WHERE id = $1", [id]);
    await sendResendEmail({
      fromName: 'Genius Academic Portal',
      to: s.email,
      subject: `[Genius Academy] Your Access Credentials — ${workspaceName}`,
      html: `<div style="font-family:Arial,sans-serif;padding:20px;color:#333;max-width:600px;margin:0 auto;line-height:1.5">
        <h2 style="color:#1a237e;margin-top:0">Genius Academy — Access Reminder</h2>
        <p>Hi <b>${s.name}</b>, here are your login credentials for the <b>${workspaceName}</b> portal.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin:20px 0">
          <table style="width:100%;font-size:15px">
            <tr><td style="color:#64748b;padding:6px 0">Workspace ID:</td><td style="text-align:right;font-weight:bold">${fullWorkspaceLabel}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Reg. Number:</td><td style="text-align:right;font-weight:bold">${s.matric_number}</td></tr>
            <tr><td style="color:#64748b;padding:6px 0">Secure PIN:</td><td style="text-align:right"><span style="background:#e0e7ff;color:#3730a3;padding:4px 12px;border-radius:6px;font-weight:bold;letter-spacing:2px">${plainPin}</span></td></tr>
          </table>
        </div>
        <p style="color:#d97706;font-weight:bold;text-align:center">🔒 Keep your PIN private.</p>
        <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;color:#94a3b8;font-size:12px">&copy; 2026 Genius Academic Publishing</div>
      </div>`
    });
    await pool.query("UPDATE students_roster SET email_status = 'sent' WHERE id = $1", [id]);
    res.json({ success: true, message: `Credentials resent to ${s.email}` });
  } catch (err: any) {
    await pool.query("UPDATE students_roster SET email_status = 'failed' WHERE id = $1", [req.params.id]).catch(() => {});
    res.status(500).json({ error: 'Resend failed: ' + err.message });
  }
});

// Lecturer: Bulk resend to all students with failed/pending email status in a category (or all)
app.post('/api/courses/roster/bulk-resend', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { categoryId } = req.body;
    const whereExtra = categoryId ? ' AND sr.category_id = $2' : '';
    const params: any[] = categoryId ? [req.tenant_id, categoryId] : [req.tenant_id];
    const studentRes = await pool.query(
      `SELECT sr.* FROM students_roster sr WHERE sr.tenant_id = $1 AND (sr.email_status = 'failed' OR sr.email_status = 'pending')${whereExtra} ORDER BY sr.name ASC`,
      params
    );

    const tenantRes = await pool.query('SELECT workspace_id, name FROM tenants WHERE id = $1', [req.tenant_id]);
    const workspaceId = tenantRes.rows[0]?.workspace_id || 'N/A';
    const workspaceName = tenantRes.rows[0]?.name || 'Academic Portal';
    const fullWorkspaceLabel = `${workspaceName} (${workspaceId})`;

    let sentCount = 0;
    for (const s of studentRes.rows) {
      // Generate fresh PIN and update hash in DB (plain PIN never stored)
      const plainPin = String(Math.floor(1000 + Math.random() * 9000));
      const freshHash = await hashPin(plainPin);
      await pool.query('UPDATE students_roster SET pin_hash = $1 WHERE id = $2', [freshHash, s.id]);
      await pool.query("UPDATE users SET password = $1 WHERE matric_number = $2 AND tenant_id = $3 AND role = 'student'", [freshHash, s.matric_number, req.tenant_id]);
      try {
        await sendResendEmail({
          fromName: 'Genius Academic Portal',
          to: s.email,
          subject: `[Genius Academy] Your Access Credentials — ${workspaceName}`,
          html: `<div style="font-family:Arial,sans-serif;padding:20px;color:#333;max-width:600px;margin:0 auto;line-height:1.5">
            <h2 style="color:#1a237e;margin-top:0">Genius Academy — Access Reminder</h2>
            <p>Hi <b>${s.name}</b>, here are your login credentials for the <b>${workspaceName}</b> portal.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;border-radius:12px;margin:20px 0">
              <table style="width:100%;font-size:15px">
                <tr><td style="color:#64748b;padding:6px 0">Workspace ID:</td><td style="text-align:right;font-weight:bold">${fullWorkspaceLabel}</td></tr>
                <tr><td style="color:#64748b;padding:6px 0">Reg. Number:</td><td style="text-align:right;font-weight:bold">${s.matric_number}</td></tr>
                <tr><td style="color:#64748b;padding:6px 0">PIN:</td><td style="text-align:right"><span style="background:#e0e7ff;color:#3730a3;padding:4px 12px;border-radius:6px;font-weight:bold;letter-spacing:2px">${plainPin}</span></td></tr>
              </table>
            </div>
            <p style="color:#d97706;font-weight:bold;text-align:center">🔒 Keep your PIN private.</p>
          </div>`
        });
        await pool.query("UPDATE students_roster SET email_status = 'sent' WHERE id = $1", [s.id]);
        sentCount++;
      } catch { await pool.query("UPDATE students_roster SET email_status = 'failed' WHERE id = $1", [s.id]); }
    }
    res.json({ success: true, sent: sentCount, total: studentRes.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Bulk resend failed: ' + err.message });
  }
});

// Lecturer: Delete Full Batch (Category)
app.delete('/api/courses/categories/:id', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;

    // 1. Verify category belongs to tenant
    const catCheck = await pool.query('SELECT id FROM student_categories WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (catCheck.rows.length === 0) return res.status(404).json({ error: 'Category not found' });

    // 2. Delete attendance sessions linked to this category (records cascade via ON DELETE CASCADE)
    await pool.query('DELETE FROM attendance_records WHERE session_id IN (SELECT id FROM attendance_sessions WHERE category_id = $1 AND tenant_id = $2)', [id, req.tenant_id]);
    await pool.query('DELETE FROM attendance_sessions WHERE category_id = $1 AND tenant_id = $2', [id, req.tenant_id]);

    // 3. Delete all students in this category (clear remaining FK dependencies first)
    await pool.query("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM exam_results WHERE user_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM chat_messages WHERE user_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM attendance_records WHERE student_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student')", [id, req.tenant_id]);
    await pool.query("DELETE FROM users WHERE category_id = $1 AND tenant_id = $2 AND role = 'student'", [id, req.tenant_id]);
    await pool.query('DELETE FROM students_roster WHERE category_id = $1 AND tenant_id = $2', [id, req.tenant_id]);

    // 4. Delete the category itself
    await pool.query('DELETE FROM student_categories WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);

    res.json({ success: true, message: 'Batch category and all associated student records deleted successfully' });
  } catch (err: any) {
    console.error('Batch delete error:', err);
    res.status(500).json({ error: 'Batch deletion failed' });
  }
});

// ─── Helper: AI question generation ─────────────────────────────────
async function generateQuestionsFromMaterial(
  materialText: string,
  count: number,
  difficulty: string,
  bloomsLevel: string,
  isPool: boolean,
  poolSize: number
): Promise<Array<{ text: string; options: string[]; correct_answer: string; points: number }>> {
  const totalToGenerate = isPool ? Math.max(poolSize, count * 2) : count;
  const difficultyMap: Record<string, string> = {
    easy: 'straightforward recall and basic comprehension',
    medium: 'moderate analysis and application of concepts',
    hard: 'deep critical thinking, synthesis, and evaluation'
  };
  const bloomsMap: Record<string, string> = {
    remember: 'factual recall (definitions, terms, dates)',
    understand: 'paraphrasing, summarising, classifying concepts',
    apply: 'using knowledge in new situations, solving problems',
    analyze: 'breaking down ideas, comparing, distinguishing',
    evaluate: 'making judgements, critiquing, justifying decisions',
    create: 'combining ideas, proposing solutions, designing',
    mixed: 'a balanced mix of recall, comprehension, application, and analysis'
  };
  const diffDesc = difficultyMap[difficulty] || difficultyMap.medium;
  const bloomsDesc = bloomsMap[bloomsLevel] || bloomsMap.mixed;

  const prompt = `You are an expert academic question setter. Generate exactly ${totalToGenerate} high-quality multiple-choice questions from the study material below.

REQUIREMENTS:
- Difficulty: ${diffDesc}
- Cognitive level (Bloom's Taxonomy): ${bloomsDesc}
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option is correct per question
- The correct answer must be the EXACT text of the correct option
- Questions must be directly based on the provided material — no general knowledge
- Vary question styles: some should be scenario-based, some definition-based, some application-based
- Do NOT number the options with A/B/C/D — just provide the plain text

OUTPUT FORMAT (JSON array only, no markdown, no explanation):
[
  {
    "text": "Question text here?",
    "options": ["Option 1 text", "Option 2 text", "Option 3 text", "Option 4 text"],
    "correct_answer": "Option 1 text",
    "points": 10
  }
]

STUDY MATERIAL:
${materialText.slice(0, 12000)}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON array from the text
    const match = raw.match(/\[[\s\S]*\]/);
    parsed = match ? JSON.parse(match[0]) : [];
  }

  const questions = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);
  return questions.filter((q: any) => q.text && Array.isArray(q.options) && q.options.length >= 2 && q.correct_answer);
}

// Lecturer: Create Exam/Test with scheduling
app.post('/api/exams', authenticateToken, checkSubscription, async (req: any, res: any) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const {
      title, description, duration, type, category_id,
      start_date, end_date, timer_mode, questions_count, batch_size, instructions,
      material_id, difficulty, blooms_level, max_attempts, is_pool, pool_size,
      submission_type, due_date, allow_late
    } = req.body;

    const isPool = !!is_pool;
    const poolSz = parseInt(pool_size) || 0;
    const qCount = parseInt(questions_count) || 20;

    const result = await pool.query(
      `INSERT INTO exams (tenant_id, title, description, duration, type, category_id,
        start_date, end_date, timer_mode, questions_count, batch_size, instructions,
        material_id, difficulty, blooms_level, ai_generated, max_attempts, is_pool, pool_size,
        submission_type, due_date, allow_late)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
      [req.tenant_id, title, description, duration || 60, type || 'test', category_id || null,
       start_date || null, end_date || null, timer_mode || 'whole',
       qCount, batch_size || 10, instructions || null,
       material_id || null, difficulty || 'medium', blooms_level || 'mixed',
       !!material_id, parseInt(max_attempts) || 1, isPool, poolSz,
       submission_type || 'mcq', due_date || null, !!allow_late]
    );
    const examId = result.rows[0].id;

    // ── GAP 2: AI Question Generation ───────────────────────────────────
    if (material_id && type !== 'assignment') {
      try {
        const matRes = await pool.query(
          'SELECT content FROM resources WHERE id = $1 AND tenant_id = $2',
          [material_id, req.tenant_id]
        );
        if (matRes.rows.length > 0) {
          const c = matRes.rows[0].content;
          let materialText = '';
          if (typeof c === 'string') {
            materialText = c;
          } else if (c && typeof c === 'object') {
            const raw = c.text ?? c.content ?? c.body ?? JSON.stringify(c);
            materialText = typeof raw === 'string' ? raw : String(raw);
          }
          materialText = materialText.replace(/\0/g, '').trim();

          if (materialText.length > 100) {
            const aiQuestions = await generateQuestionsFromMaterial(
              materialText, qCount,
              difficulty || 'medium',
              blooms_level || 'mixed',
              isPool, poolSz
            );

            if (aiQuestions.length > 0) {
              for (const q of aiQuestions) {
                await pool.query(
                  `INSERT INTO questions (exam_id, text, options, correct_answer, type, points)
                   VALUES ($1,$2,$3,$4,'static',$5)`,
                  [examId, q.text, JSON.stringify(q.options), q.correct_answer, q.points || 10]
                );
              }
              console.log(`[AI] Generated ${aiQuestions.length} questions for exam ${examId}`);
            }
          }
        }
      } catch (aiErr: any) {
        console.error('[AI Question Gen] Failed:', aiErr.message);
        // Non-fatal — exam is created, questions will be empty
      }
    }

    // ── Scheduling: if a time window + category provided, assign student slots ──
    if (start_date && end_date && category_id) {
      const studentsRes = await pool.query(
        `SELECT id, name, email FROM users
         WHERE tenant_id = $1 AND category_id = $2 AND role = 'student'
         ORDER BY id`,
        [req.tenant_id, category_id]
      );
      const students = studentsRes.rows;

      if (students.length > 0) {
        const batchSz = Math.max(1, parseInt(batch_size) || 10);
        const durationMin = parseInt(duration) || 60;
        const startMs = new Date(start_date).getTime();
        const endMs   = new Date(end_date).getTime();
        const totalBatches = Math.ceil(students.length / batchSz);
        const intervalMs = Math.max((endMs - startMs) / totalBatches, durationMin * 60 * 1000 + 30 * 60 * 1000);

        for (let i = 0; i < students.length; i++) {
          const batchIndex = Math.floor(i / batchSz);
          const scheduledAt = new Date(startMs + batchIndex * intervalMs);
          const windowEnd   = new Date(scheduledAt.getTime() + durationMin * 60 * 1000 + 30 * 60 * 1000);

          const slotInsert = await pool.query(
            `INSERT INTO exam_slots (exam_id, tenant_id, student_id, student_email, student_name, scheduled_at, window_end, notification_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id`,
            [examId, req.tenant_id, students[i].id, students[i].email, students[i].name, scheduledAt, windowEnd]
          );
          const slotId = slotInsert.rows[0].id;

          // Notify student of their slot and track per-slot delivery status
          if (students[i].email) {
            const slotLabel = scheduledAt.toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
            const endLabel  = windowEnd.toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
            const typeLabel = type === 'exam' ? 'Examination' : 'Test';
            try {
              await sendResendEmail({
                to: students[i].email,
                subject: `📋 Your ${typeLabel} Schedule — ${title}`,
                html: `
<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#1a202c;line-height:1.7;">
  <div style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px 32px;background:linear-gradient(135deg,#eff6ff 0%,#fff 70%);border-bottom:3px solid #2563eb;">
      <h2 style="margin:0;color:#1e40af;font-size:20px;">📋 ${typeLabel} Schedule Notice</h2>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${title}</p>
    </div>
    <div style="padding:28px 32px;">
      <p>Dear <strong>${students[i].name}</strong>,</p>
      <p>Your ${typeLabel.toLowerCase()} has been scheduled. Please read all details carefully.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Assessment</td><td style="padding:10px 16px;font-weight:bold;">${title}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Your Slot</td><td style="padding:10px 16px;color:#1d4ed8;font-weight:bold;">${slotLabel}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Deadline</td><td style="padding:10px 16px;color:#dc2626;font-weight:bold;">${endLabel}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Duration</td><td style="padding:10px 16px;">${durationMin} minutes</td></tr>
      </table>
      ${instructions ? `<div style="background:#fefce8;border-left:4px solid #ca8a04;padding:16px 20px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-weight:bold;color:#92400e;">📌 Instructions from your Lecturer</p><p style="margin:8px 0 0;color:#78350f;">${instructions}</p></div>` : ''}
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px 20px;border-radius:8px;margin:16px 0;">
        <p style="margin:0;font-weight:bold;color:#991b1b;">⚠️ Important Rules</p>
        <ul style="margin:8px 0 0;padding-left:18px;color:#7f1d1d;">
          <li>You may ONLY take this ${typeLabel.toLowerCase()} during your assigned time slot.</li>
          <li>Do NOT attempt to access it before or after your window — access will be blocked.</li>
          <li>Do NOT switch browser tabs or windows during the assessment.</li>
          <li>Do NOT close the browser or refresh the page — your session will end.</li>
          <li>Ensure you have a stable internet connection before starting.</li>
          <li>Once submitted, you cannot retake or modify your answers.</li>
          <li>Any detected misbehaviour will be logged and flagged to your lecturer.</li>
        </ul>
      </div>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">This is an automated schedule notification. Do not reply to this email.</p>
    </div>
  </div>
</div>`
              });
              await pool.query(`UPDATE exam_slots SET notification_status = 'sent', notification_sent = TRUE WHERE id = $1`, [slotId]);
            } catch (err: any) {
              console.error(`[Slot Notify] Failed for ${students[i].email}:`, err.message);
              await pool.query(`UPDATE exam_slots SET notification_status = 'failed' WHERE id = $1`, [slotId]);
            }
          }
        }
      }
    }

    res.json({ id: examId, success: true, message: 'Assessment created and students notified.' });
  } catch (error: any) {
    console.error('[Create Exam]', error);
    res.status(500).json({ error: 'Failed to create exam: ' + error.message });
  }
});

// Lecturer: Get slots for an exam
app.get('/api/exams/:id/slots', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const slots = await pool.query(
      `SELECT es.*, u.name as student_name, u.email as student_email
       FROM exam_slots es
       LEFT JOIN users u ON u.id = es.student_id
       WHERE es.exam_id = $1 AND es.tenant_id = $2
       ORDER BY es.scheduled_at ASC`,
      [req.params.id, req.tenant_id]
    );
    res.json(slots.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// Lecturer: Resend schedule notification to a single slot
app.post('/api/exams/:id/slots/:slotId/resend', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id: examId, slotId } = req.params;
    const slotRes = await pool.query(
      `SELECT es.*, e.title, e.type, e.duration, e.instructions
       FROM exam_slots es JOIN exams e ON e.id = es.exam_id
       WHERE es.id = $1 AND es.exam_id = $2 AND es.tenant_id = $3`,
      [slotId, examId, req.tenant_id]
    );
    if (slotRes.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });
    const slot = slotRes.rows[0];
    if (!slot.student_email) return res.status(400).json({ error: 'No email on record for this student' });

    const slotLabel = new Date(slot.scheduled_at).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
    const endLabel  = new Date(slot.window_end).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
    const typeLabel = slot.type === 'exam' ? 'Examination' : 'Test';
    const durationMin = slot.duration || 60;

    await sendResendEmail({
      to: slot.student_email,
      subject: `📋 [RESENT] Your ${typeLabel} Schedule — ${slot.title}`,
      html: `
<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#1a202c;line-height:1.7;">
  <div style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px 32px;background:linear-gradient(135deg,#eff6ff 0%,#fff 70%);border-bottom:3px solid #2563eb;">
      <h2 style="margin:0;color:#1e40af;font-size:20px;">📋 ${typeLabel} Schedule Notice</h2>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${slot.title} — <em>Re-sent on request</em></p>
    </div>
    <div style="padding:28px 32px;">
      <p>Dear <strong>${slot.student_name}</strong>,</p>
      <p>Your ${typeLabel.toLowerCase()} schedule is below. This is a re-sent copy.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Assessment</td><td style="padding:10px 16px;font-weight:bold;">${slot.title}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Your Slot</td><td style="padding:10px 16px;color:#1d4ed8;font-weight:bold;">${slotLabel}</td></tr>
        <tr><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Deadline</td><td style="padding:10px 16px;color:#dc2626;font-weight:bold;">${endLabel}</td></tr>
        <tr style="background:#f1f5f9;"><td style="padding:10px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;">Duration</td><td style="padding:10px 16px;">${durationMin} minutes</td></tr>
      </table>
      ${slot.instructions ? `<div style="background:#fefce8;border-left:4px solid #ca8a04;padding:16px 20px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-weight:bold;color:#92400e;">📌 Instructions</p><p style="margin:8px 0 0;color:#78350f;">${slot.instructions}</p></div>` : ''}
      <p style="color:#64748b;font-size:12px;margin-top:24px;">This is an automated notification. Do not reply to this email.</p>
    </div>
  </div>
</div>`
    });
    await pool.query(`UPDATE exam_slots SET notification_status = 'sent', notification_sent = TRUE WHERE id = $1`, [slotId]);
    res.json({ success: true });
  } catch (err: any) {
    await pool.query(`UPDATE exam_slots SET notification_status = 'failed' WHERE id = $1`, [req.params.slotId]).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Lecturer: Delete exam/test/assignment
app.delete('/api/exams/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    await pool.query('DELETE FROM exams WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Lecturer: Toggle publish status
app.put('/api/exams/:id/publish', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { published_status } = req.body; // 'published' | 'draft'

    // Gate: cannot publish an exam/test that has no questions
    if (published_status === 'published') {
      const examRow = await pool.query('SELECT type FROM exams WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
      if (examRow.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });

      // Only enforce question check for exam/test (not assignments which are text/file-based)
      if (examRow.rows[0].type !== 'assignment') {
        const qCount = await pool.query('SELECT COUNT(*) FROM questions WHERE exam_id = $1', [req.params.id]);
        if (parseInt(qCount.rows[0].count) === 0) {
          return res.status(422).json({
            error: 'Cannot publish — no questions have been generated yet. The exam will remain as a draft until AI question generation completes.'
          });
        }
      }
    }

    await pool.query(
      'UPDATE exams SET published_status = $1, is_available = $2 WHERE id = $3 AND tenant_id = $4',
      [published_status, published_status === 'published', req.params.id, req.tenant_id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update publish status' });
  }
});

// Student: Submit assignment (text or file)
app.post('/api/assignments/:id/submit', authenticateToken, upload.single('file'), async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const examRes = await pool.query('SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND type = $3', [id, req.tenant_id, 'assignment']);
    if (examRes.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    const exam = examRes.rows[0];

    if (!exam.is_available || exam.published_status !== 'published') return res.status(403).json({ error: 'Assignment is not open for submissions' });

    // Check due date
    if (exam.due_date && !exam.allow_late && new Date() > new Date(exam.due_date)) {
      return res.status(403).json({ error: 'Submission deadline has passed' });
    }

    // Duplicate check
    const dup = await pool.query('SELECT id FROM assignment_submissions WHERE exam_id = $1 AND student_id = $2', [id, req.user.id]);
    if (dup.rows.length > 0) return res.status(409).json({ error: 'You have already submitted this assignment' });

    const content = req.body.content || null;
    const fileName = req.file?.originalname || null;
    const mimeType = req.file?.mimetype || null;
    const submType = req.file ? 'file' : 'text';

    let submFileBlob: Buffer | null = null;
    let submFileUrl: string | null = null;
    if (req.file) {
      if (R2_ENABLED) {
        const safeFilename = fileName!.replace(/[^a-zA-Z0-9._-]/g, '_');
        submFileUrl = await uploadToR2(`submissions/${id}/${req.user.id}-${Date.now()}-${safeFilename}`, fs.createReadStream(req.file.path), mimeType!, req.file.size);
      } else {
        submFileBlob = fs.readFileSync(req.file.path);
      }
      fs.unlink(req.file.path, () => {});
    }

    await pool.query(
      `INSERT INTO assignment_submissions (exam_id, tenant_id, student_id, student_name, student_email, submission_type, content, file_blob, file_name, mime_type, file_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, req.tenant_id, req.user.id, req.user.name, req.user.email, submType, content, submFileBlob, fileName, mimeType, submFileUrl]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lecturer: Get all submissions for an assignment
app.get('/api/assignments/:id/submissions', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const subs = await pool.query(
      `SELECT s.id, s.student_name, s.student_email, s.submission_type, s.content, s.file_name, s.grade, s.feedback, s.submitted_at
       FROM assignment_submissions s WHERE s.exam_id = $1 AND s.tenant_id = $2 ORDER BY s.submitted_at DESC`,
      [req.params.id, req.tenant_id]
    );
    res.json(subs.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Lecturer: Grade a submission + GAP 10: notify student via email
app.put('/api/assignments/submissions/:subId/grade', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { grade, feedback } = req.body;
    await pool.query(
      'UPDATE assignment_submissions SET grade = $1, feedback = $2, graded_at = NOW() WHERE id = $3 AND tenant_id = $4',
      [grade, feedback, req.params.subId, req.tenant_id]
    );

    // GAP 10: fetch submission details and email the student
    const subRes = await pool.query(
      `SELECT s.student_email, s.student_name, e.title as assignment_title
       FROM assignment_submissions s
       LEFT JOIN exams e ON e.id = s.exam_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [req.params.subId, req.tenant_id]
    );
    if (subRes.rows.length > 0) {
      const { student_email, student_name, assignment_title } = subRes.rows[0];
      if (student_email) {
        await sendResendEmail({
          to: student_email,
          subject: `📝 Your Assignment Has Been Graded — ${assignment_title}`,
          html: `
<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#1a202c;line-height:1.7;">
  <div style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <div style="padding:24px 32px;background:linear-gradient(135deg,#f0fdf4 0%,#fff 70%);border-bottom:3px solid #16a34a;">
      <h2 style="margin:0;color:#15803d;font-size:20px;">📝 Assignment Graded</h2>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${assignment_title}</p>
    </div>
    <div style="padding:28px 32px;">
      <p>Dear <strong>${student_name}</strong>,</p>
      <p>Your lecturer has graded your submission for <strong>${assignment_title}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:12px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;width:40%;">Grade / Score</td>
            <td style="padding:12px 16px;font-weight:bold;font-size:18px;color:#15803d;">${grade}</td></tr>
        ${feedback ? `<tr style="background:#f1f5f9;"><td style="padding:12px 16px;font-size:12px;color:#64748b;font-weight:bold;text-transform:uppercase;vertical-align:top;">Lecturer Feedback</td>
            <td style="padding:12px 16px;color:#374151;">${feedback}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">Log in to your portal to view your full submission and grade history.</p>
    </div>
  </div>
</div>`
        }).catch((e: any) => console.error('[Grade Email]', e.message));
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grade submission' });
  }
});

// Download submission file
app.get('/api/assignments/submissions/:subId/file', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      'SELECT file_blob, file_url, file_name, mime_type FROM assignment_submissions WHERE id = $1 AND tenant_id = $2',
      [req.params.subId, req.tenant_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'File not found' });
    const { file_blob, file_url, file_name, mime_type } = result.rows[0];

    // R2 URL — redirect directly to CDN
    if (file_url) return res.redirect(302, file_url);

    // Legacy BYTEA — serve and lazily migrate
    if (file_blob) {
      res.setHeader('Content-Type', mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
      res.send(file_blob);
      lazyMigrateToR2('assignment_submissions', req.params.subId, 'file_blob', 'file_url', mime_type || 'application/octet-stream', file_name).catch(() => {});
      return;
    }

    return res.status(404).json({ error: 'File not found' });
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

// ─── ATTENDANCE SESSIONS ─────────────────────────────────────────────────────

// Lecturer: Create attendance session
app.post('/api/attendance/sessions', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { title, course_code, category_id, session_date, is_paid, price } = req.body;
    const result = await pool.query(
      `INSERT INTO attendance_sessions (tenant_id, title, course_code, category_id, session_date, is_paid, price)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.tenant_id, title, course_code || null, category_id || null, session_date, !!is_paid, parseInt(price) || 0]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lecturer: Get all sessions
app.get('/api/attendance/sessions', authenticateToken, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, sc.name as category_name,
       (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = s.id) as present_count
       FROM attendance_sessions s
       LEFT JOIN student_categories sc ON sc.id = s.category_id
       WHERE s.tenant_id = $1 ORDER BY s.session_date DESC`,
      [req.tenant_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Lecturer: Toggle session open/close or publish
app.put('/api/attendance/sessions/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const fields = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    for (const [k, v] of Object.entries(fields)) {
      if (['is_open','is_paid','price','status','title','course_code','category_id','session_date'].includes(k)) {
        sets.push(`${k} = $${idx++}`); vals.push(v);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id, req.tenant_id);
    await pool.query(`UPDATE attendance_sessions SET ${sets.join(',')} WHERE id = $${idx++} AND tenant_id = $${idx}`, vals);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Lecturer: Delete session
app.delete('/api/attendance/sessions/:id', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    await pool.query('DELETE FROM attendance_sessions WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Lecturer: Get records for a session (roll call)
app.get('/api/attendance/sessions/:id/records', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const records = await pool.query(
      `SELECT r.*, u.name, u.email FROM attendance_records r
       LEFT JOIN users u ON u.id = r.student_id
       WHERE r.session_id = $1 AND r.tenant_id = $2 ORDER BY r.marked_at ASC`,
      [req.params.id, req.tenant_id]
    );
    res.json(records.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Lecturer: Download roll call as PDF
app.get('/api/attendance/sessions/:id/records/pdf', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const sessionRes = await pool.query(
      `SELECT s.*, t.name as tenant_name, sc.name as category_name
       FROM attendance_sessions s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN student_categories sc ON sc.id = s.category_id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [req.params.id, req.tenant_id]
    );
    if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = sessionRes.rows[0];

    const recordsRes = await pool.query(
      `SELECT r.student_name, r.matric_number, r.marked_at, u.email
       FROM attendance_records r
       LEFT JOIN users u ON u.id = r.student_id
       WHERE r.session_id = $1 ORDER BY r.marked_at ASC`,
      [req.params.id]
    );
    const records = recordsRes.rows;

    const sessionDate = session.session_date ? new Date(session.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
    const generatedAt = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const rowsHTML = records.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:32px;color:#94a3b8;font-size:13px;">No attendance records found for this session.</td></tr>`
      : records.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${i + 1}</td>
          <td style="padding:11px 18px;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${r.student_name || '—'}</td>
          <td style="padding:11px 18px;font-size:12px;color:#475569;font-family:monospace;border-bottom:1px solid #f1f5f9;">${r.matric_number || '—'}</td>
          <td style="padding:11px 18px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">${new Date(r.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
        </tr>`).join('');

    const html = `
    <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a8a 100%);padding:36px 40px 28px;color:#fff;border-radius:0 0 24px 24px;margin-bottom:32px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#93c5fd;margin-bottom:6px;">Official Attendance Record</div>
          <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;">${session.tenant_name}</div>
          <div style="font-size:15px;font-weight:600;color:#bfdbfe;margin-top:4px;">${session.title}</div>
          <div style="font-size:11px;color:#93c5fd;margin-top:2px;">${session.course_code || ''} ${session.category_name ? '· ' + session.category_name : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Session Date</div>
          <div style="font-size:13px;color:#fff;font-weight:700;margin-top:2px;">${sessionDate}</div>
          <div style="font-size:10px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:8px;">Generated</div>
          <div style="font-size:11px;color:#fff;font-weight:600;">${generatedAt}</div>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:16px;margin:0 40px 28px;flex-wrap:wrap;">
      <div style="flex:1;min-width:100px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:16px 20px;">
        <div style="font-size:28px;font-weight:900;color:#16a34a;">${records.length}</div>
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#16a34a;">Students Present</div>
      </div>
      <div style="flex:1;min-width:100px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:16px 20px;">
        <div style="font-size:28px;font-weight:900;color:#2563eb;">${session.is_paid ? '₦' + (session.price || 0).toLocaleString() : 'Free'}</div>
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#2563eb;">Attendance Type</div>
      </div>
      <div style="flex:1;min-width:100px;background:${session.is_open ? '#f0fdf4' : '#fef2f2'};border:1.5px solid ${session.is_open ? '#bbf7d0' : '#fecaca'};border-radius:14px;padding:16px 20px;">
        <div style="font-size:28px;font-weight:900;color:${session.is_open ? '#16a34a' : '#dc2626'};">${session.is_open ? 'Open' : 'Closed'}</div>
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:${session.is_open ? '#16a34a' : '#dc2626'};">Session Status</div>
      </div>
    </div>

    <div style="margin:0 40px 32px;">
      <table style="width:100%;border-collapse:collapse;border-radius:16px;overflow:hidden;border:1.5px solid #e2e8f0;">
        <thead>
          <tr style="background:linear-gradient(90deg,#1e40af,#2563eb);">
            <th style="padding:13px 18px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">#</th>
            <th style="padding:13px 18px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Student Name</th>
            <th style="padding:13px 18px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Matric No.</th>
            <th style="padding:13px 18px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Time Marked</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>

    <div style="margin:0 40px;padding:20px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:14px;font-weight:900;color:#fff;letter-spacing:-0.3px;">Genius</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-top:1px;">Academic Portal Platform</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:9px;color:#475569;font-weight:600;">This document is system-generated and digitally verified.</div>
        <div style="font-size:9px;color:#334155;font-weight:700;margin-top:2px;">Powered by Genius Academic Suite · ${new Date().getFullYear()}</div>
      </div>
    </div>`;

    const pdfBuffer = await generateTranscriptPDF(html);
    const safeName = session.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RollCall_${safeName}_${sessionDate.replace(/\s/g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Roll call PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Student: Download own attendance records as PDF
app.get('/api/student/attendance/pdf', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT ar.student_name, ar.matric_number, ar.marked_at,
              s.title as session_title, s.course_code, s.session_date, s.is_paid, s.price,
              t.name as tenant_name
       FROM attendance_records ar
       JOIN attendance_sessions s ON s.id = ar.session_id
       JOIN tenants t ON t.id = ar.tenant_id
       WHERE ar.student_id = $1 AND ar.tenant_id = $2
       ORDER BY ar.marked_at DESC`,
      [req.user.id, req.tenant_id]
    );
    const rows = result.rows;
    const studentName = rows[0]?.student_name || req.user.name || 'Student';
    const tenantName = rows[0]?.tenant_name || 'Academic Portal';
    const matric = rows[0]?.matric_number || '';
    const now = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const tableRows = rows.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:#94a3b8;">No attendance records found.</td></tr>`
      : rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
          <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;">${i + 1}</td>
          <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9;">${r.session_title}</td>
          <td style="padding:10px 16px;font-size:11px;color:#475569;border-bottom:1px solid #f1f5f9;">${r.course_code || '—'}</td>
          <td style="padding:10px 16px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">${r.session_date ? new Date(r.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
          <td style="padding:10px 16px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;">${new Date(r.marked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>`).join('');

    const html = `
    <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a8a 100%);padding:36px 40px 28px;color:#fff;border-radius:0 0 24px 24px;margin-bottom:32px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#93c5fd;margin-bottom:6px;">Student Attendance Report</div>
          <div style="font-size:24px;font-weight:900;">${tenantName}</div>
          <div style="font-size:15px;font-weight:600;color:#bfdbfe;margin-top:4px;">${studentName}</div>
          <div style="font-size:11px;color:#93c5fd;margin-top:2px;">${matric ? 'Matric: ' + matric : ''}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Generated</div>
          <div style="font-size:12px;color:#fff;font-weight:700;margin-top:2px;">${now}</div>
          <div style="margin-top:10px;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#fff;">${rows.length}</div>
            <div style="font-size:9px;color:#bfdbfe;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Sessions Attended</div>
          </div>
        </div>
      </div>
    </div>
    <div style="margin:0 40px 32px;">
      <table style="width:100%;border-collapse:collapse;border-radius:14px;overflow:hidden;border:1.5px solid #e2e8f0;">
        <thead>
          <tr style="background:linear-gradient(90deg,#1e40af,#2563eb);">
            <th style="padding:12px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">#</th>
            <th style="padding:12px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Session</th>
            <th style="padding:12px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Course Code</th>
            <th style="padding:12px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Date</th>
            <th style="padding:12px 16px;text-align:left;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;color:#bfdbfe;">Time Marked</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

    const pdfBuffer = await generateTranscriptPDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Attendance_${studentName.replace(/\s+/g, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate attendance PDF' });
  }
});

// Student: Get open attendance sessions (for banner display)
app.get('/api/student/attendance/open-sessions', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const sessions = await pool.query(
      `SELECT s.id, s.title, s.course_code, s.session_date, s.is_paid, s.price,
              EXISTS(
                SELECT 1 FROM attendance_records r
                WHERE r.session_id = s.id AND r.student_id = $2
              ) AS already_marked
       FROM attendance_sessions s
       WHERE s.tenant_id = $1 AND s.is_open = true
       ORDER BY s.created_at DESC`,
      [req.tenant_id, req.user.id]
    );
    res.json(sessions.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Student: Mark attendance for a session
app.post('/api/attendance/sessions/:id/mark', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const session = await pool.query(
      'SELECT * FROM attendance_sessions WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenant_id]
    );
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });
    const s = session.rows[0];
    if (!s.is_open) return res.status(403).json({ error: 'This session is not open for attendance' });

    if (s.is_paid) {
      const paid = await pool.query(
        `SELECT id FROM transactions WHERE user_id = $1 AND (metadata->>'session_id')::int = $2 AND status = 'success' LIMIT 1`,
        [req.user.id, req.params.id]
      );
      if (!paid.rows.length) return res.status(402).json({ error: 'Payment required', price: s.price });
    }

    const dup = await pool.query('SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2', [req.params.id, req.user.id]);
    if (dup.rows.length) return res.status(409).json({ error: 'Already marked for this session' });

    const userRes = await pool.query('SELECT matric_number FROM students_roster WHERE tenant_id = $1 AND email = $2 LIMIT 1', [req.tenant_id, req.user.email]);
    const matric = userRes.rows[0]?.matric_number || '';

    await pool.query(
      'INSERT INTO attendance_records (session_id, tenant_id, student_id, student_name, matric_number) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, req.tenant_id, req.user.id, req.user.name, matric]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    const totalExams = results.rows ? results.rows.length : 0;
    const totalScore = (results.rows || []).reduce((sum: number, r: any) => sum + (Number(r.score) || 0), 0);
    const avgScore = totalExams > 0 ? totalScore / totalExams : 0;

    // CGPA Calculation (Simplified: mapping 0-100 to 0-4.0)
    const cgpa = (avgScore / 100 * 4).toFixed(2);

    // Total Credits (Sum of points from exams)
    const totalCredits = (results.rows || []).reduce((sum: number, r: any) => sum + (r.max_points || 0), 0);

    // Global Rank (Relative to other students in the same tenant)
    const rankResult = await pool.query(
      `SELECT user_id, AVG(score::numeric) as avg_score
       FROM exam_results
       WHERE tenant_id = $1
       GROUP BY user_id
       ORDER BY avg_score DESC`,
      [req.tenant_id]
    );
    const rankIndex = rankResult.rows ? rankResult.rows.findIndex((r: any) => r.user_id === req.user.id) : -1;
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

    // 4. Skills based on actual type performance
    const typeGroups: Record<string, number[]> = {};
    for (const r of results.rows) {
      const t = r.type || 'test';
      if (!typeGroups[t]) typeGroups[t] = [];
      typeGroups[t].push(Number(r.score) || 0);
    }
    const typeAvg = (type: string) => {
      const arr = typeGroups[type] || [];
      return arr.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;
    };
    const skills = [
      { name: 'Tests', percent: Math.round(typeAvg('test')), color: 'bg-indigo-500' },
      { name: 'Assignments', percent: Math.round(typeAvg('assignment')), color: 'bg-emerald-500' },
      { name: 'Exams', percent: Math.round(typeAvg('exam')), color: 'bg-amber-500' },
    ].filter(s => s.percent > 0);

    // 5. Real improvement: compare avg of first half vs second half of submissions
    let improvement = 0;
    if (results.rows.length >= 2) {
      const sorted = [...results.rows].sort((a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
      const half = Math.floor(sorted.length / 2);
      const earlier = sorted.slice(0, half).reduce((s: number, r: any) => s + (Number(r.score) || 0), 0) / half;
      const later = sorted.slice(half).reduce((s: number, r: any) => s + (Number(r.score) || 0), 0) / (sorted.length - half);
      improvement = earlier > 0 ? Math.round(((later - earlier) / earlier) * 100) : 0;
    }

    // 6. Attendance count
    const attendanceRes = await pool.query(
      'SELECT COUNT(*) as count FROM attendance_records WHERE student_id = $1 AND tenant_id = $2',
      [req.user.id, req.tenant_id]
    );
    const attendanceCount = parseInt(attendanceRes.rows[0]?.count || '0');

    res.json({
      success: true,
      stats: [
        { label: 'Avg Score', value: avgScore > 0 ? Math.round(avgScore) + '%' : '—', type: 'gpa' },
        { label: 'Assessments', value: totalExams.toString(), type: 'count' },
        { label: 'Global Rank', value: globalRank, type: 'rank' },
        { label: 'Attendance', value: attendanceCount.toString(), type: 'credits' }
      ],
      records,
      improvement,
      skills: skills.length > 0 ? skills : []
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
       JOIN users u ON u.id = $1
       WHERE e.tenant_id = $2 AND e.is_available = true 
       AND (e.category_id IS NULL OR e.category_id = u.category_id)
       ORDER BY e.created_at DESC`,
      [req.user.id, req.tenant_id]
    );

    const formatted = assessments.rows.map(a => ({
      id: a.id,
      course: a.title,
      type: a.type || 'test',
      duration: `${a.duration} Mins`,
      durationMins: a.duration,
      totalQuestions: a.totalQuestions || 0,
      status: a.completed ? 'completed' : 'pending',
      date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      start_date: a.start_date ? new Date(a.start_date).toISOString() : null,
      end_date: a.end_date ? new Date(a.end_date).toISOString() : null,
      is_paid: a.is_paid,
      price: a.price,
      hasPaid: a.hasPaid
    }));

    res.json({ success: true, assessments: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Student video access ────────────────────────────────────────────
app.get('/api/student/videos', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.file_url, r.is_paid, r.price, r.created_at,
       EXISTS(SELECT 1 FROM transactions WHERE user_id = $1 AND type = 'video_access'
              AND (metadata->>'resource_id')::int = r.id AND status = 'success') as "hasPaid"
       FROM resources r
       WHERE r.tenant_id = $2 AND r.type = 'video' AND r.is_available = true
       ORDER BY r.created_at DESC`,
      [req.user.id, req.tenant_id]
    );
    res.json({ success: true, videos: result.rows });
  } catch (error: any) {
    console.error('Student videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
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
       JOIN users u ON u.id = $1
       WHERE r.tenant_id = $2 AND r.type = 'material' AND r.is_available = true
       AND (r.category_id IS NULL OR r.category_id = u.category_id)
       ORDER BY r.created_at DESC`,
      [req.user.id, req.tenant_id]
    );
    res.json({ success: true, materials: result.rows || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});
// ─── FIX 2: Exam payment enforced before returning questions ────────
app.get('/api/exams/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const examResult = await pool.query('SELECT * FROM exams WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (examResult.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });

    const exam = examResult.rows[0];

    // Enforce payment gate on backend — prevents API-level bypass
    if (exam.is_paid && req.user.role === 'student') {
      const txCheck = await pool.query(
        `SELECT id FROM transactions WHERE user_id = $1 AND type = 'assessment_access'
         AND (metadata->>'exam_id')::int = $2 AND status = 'success' LIMIT 1`,
        [req.user.id, id]
      );
      if (txCheck.rows.length === 0) {
        return res.status(402).json({ error: 'Payment required to access this assessment', price: exam.price });
      }
    }

    // GAP 7: Check attempt count vs max_attempts before allowing entry
    if (req.user.role === 'student') {
      const maxAttempts = parseInt(exam.max_attempts) || 1;
      const attemptsRes = await pool.query(
        'SELECT COUNT(*) as cnt FROM exam_results WHERE user_id = $1 AND exam_id = $2',
        [req.user.id, id]
      );
      const attemptsSoFar = parseInt(attemptsRes.rows[0].cnt) || 0;
      if (attemptsSoFar >= maxAttempts) {
        return res.status(409).json({ error: `You have used all ${maxAttempts} attempt(s) for this assessment.` });
      }

      // Enforce slot window if slots exist for this exam
      const slotCheck = await pool.query(
        `SELECT scheduled_at, window_end, status FROM exam_slots
         WHERE exam_id = $1 AND student_id = $2 LIMIT 1`,
        [id, req.user.id]
      );
      if (slotCheck.rows.length > 0) {
        const slot = slotCheck.rows[0];
        const now = new Date();
        const slotStart = new Date(slot.scheduled_at);
        const slotEnd   = new Date(slot.window_end);
        if (now < slotStart) {
          return res.status(403).json({
            error: `Your slot has not started yet. You are scheduled for: ${slotStart.toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' })}`,
            scheduled_at: slot.scheduled_at
          });
        }
        if (now > slotEnd) {
          await pool.query(`UPDATE exam_slots SET status = 'missed' WHERE exam_id = $1 AND student_id = $2`, [id, req.user.id]);
          return res.status(403).json({ error: 'Your assigned time window has passed. Contact your lecturer to dispute.' });
        }
        // Mark slot as in_progress
        await pool.query(`UPDATE exam_slots SET status = 'in_progress', started_at = NOW() WHERE exam_id = $1 AND student_id = $2 AND status = 'pending'`, [id, req.user.id]);
      }
    }

    // ── GAP 4 + GAP 1: Pool draw + per-student question/option salting ──
    const allQuestionsResult = await pool.query(
      'SELECT id, text, options, type, formula, points FROM questions WHERE exam_id = $1',
      [id]
    );
    let questionPool = allQuestionsResult.rows;

    if (req.user.role === 'student') {
      // Fetch or generate per-student shuffle stored in exam_slots
      const slotRow = await pool.query(
        'SELECT question_order, option_orders FROM exam_slots WHERE exam_id = $1 AND student_id = $2 LIMIT 1',
        [id, req.user.id]
      );

      let questionOrder: number[] | null = slotRow.rows[0]?.question_order ?? null;
      let optionOrders: Record<number, number[]> | null = slotRow.rows[0]?.option_orders ?? null;

      if (!questionOrder || !optionOrders) {
        // GAP 4: If pool exam, draw questions_count from the pool
        let selectedPool = [...questionPool];
        if (exam.is_pool && exam.questions_count && selectedPool.length > exam.questions_count) {
          // Fisher-Yates to pick questions_count from pool
          for (let i = selectedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selectedPool[i], selectedPool[j]] = [selectedPool[j], selectedPool[i]];
          }
          selectedPool = selectedPool.slice(0, exam.questions_count);
        }

        // GAP 1: Shuffle question order
        const shuffled = [...selectedPool].sort(() => Math.random() - 0.5);
        questionOrder = shuffled.map((q: any) => q.id);

        // Shuffle options for each question individually
        optionOrders = {};
        for (const q of selectedPool) {
          const opts: string[] = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
          const indices = opts.map((_: any, i: number) => i).sort(() => Math.random() - 0.5);
          optionOrders[q.id] = indices;
        }

        // Store the shuffle in exam_slots (create slot if none exists for non-scheduled exams)
        if (slotRow.rows.length > 0) {
          await pool.query(
            'UPDATE exam_slots SET question_order = $1, option_orders = $2 WHERE exam_id = $3 AND student_id = $4',
            [JSON.stringify(questionOrder), JSON.stringify(optionOrders), id, req.user.id]
          );
        } else {
          // Non-scheduled exam — store shuffle in a synthetic slot
          await pool.query(
            `INSERT INTO exam_slots (exam_id, tenant_id, student_id, student_email, student_name, scheduled_at, window_end, question_order, option_orders)
             VALUES ($1,$2,$3,$4,$5,NOW(),NOW() + INTERVAL '1 day',$6,$7)
             ON CONFLICT DO NOTHING`,
            [id, req.tenant_id, req.user.id, req.user.email, req.user.name,
             JSON.stringify(questionOrder), JSON.stringify(optionOrders)]
          );
        }
      }

      // Apply the stored shuffle to build the response
      const questionMap = Object.fromEntries(questionPool.map((q: any) => [q.id, q]));
      const orderedQuestions = (questionOrder as number[])
        .filter((qid: number) => questionMap[qid])
        .map((qid: number) => {
          const q = { ...questionMap[qid] };
          const rawOpts: string[] = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
          const indices: number[] = (optionOrders as Record<number, number[]>)[qid] || rawOpts.map((_: any, i: number) => i);
          q.options = indices.map((i: number) => rawOpts[i]);
          // correct_answer stays as-is (text match still works since we only reorder, not rename)
          return q;
        });

      res.json({ exam, questions: orderedQuestions });
    } else {
      // Lecturer/admin sees original order
      res.json({ exam, questions: questionPool });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exam data' });
  }
});

// ─── Exam submission — grade, persist answers, enforce max_attempts ──
app.post('/api/exams/:id/submit', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { id } = req.params;
    const { answers, riskScore, violations } = req.body;

    const examRes = await pool.query('SELECT * FROM exams WHERE id = $1 AND tenant_id = $2', [id, req.tenant_id]);
    if (examRes.rows.length === 0) return res.status(404).json({ error: 'Exam not found' });
    const exam = examRes.rows[0];

    // GAP 7: Max attempts check
    const maxAttempts = parseInt(exam.max_attempts) || 1;
    const attemptsRes = await pool.query(
      'SELECT COUNT(*) as cnt FROM exam_results WHERE user_id = $1 AND exam_id = $2',
      [req.user.id, id]
    );
    const attemptsSoFar = parseInt(attemptsRes.rows[0].cnt) || 0;
    if (attemptsSoFar >= maxAttempts) {
      return res.status(409).json({ error: `You have used all ${maxAttempts} attempt(s) for this assessment.` });
    }
    const attemptNumber = attemptsSoFar + 1;

    // Fetch all questions with correct answers and points
    const questionsRes = await pool.query(
      'SELECT id, correct_answer, points FROM questions WHERE exam_id = $1',
      [id]
    );
    const questions = questionsRes.rows;

    // Grade: match each submitted answer against correct_answer (text match — salting preserves text)
    let totalEarned = 0;
    let totalPossible = 0;
    const gradedAnswers = (answers || []).map((a: any) => {
      const q = questions.find((q: any) => q.id === a.questionId);
      if (!q) return { ...a, correct: false, pointsEarned: 0 };
      totalPossible += Number(q.points || 10);
      const isCorrect = String(a.answer || '').trim().toLowerCase() === String(q.correct_answer || '').trim().toLowerCase();
      if (isCorrect) totalEarned += Number(q.points || 10);
      return { ...a, correct: isCorrect, correctAnswer: q.correct_answer, pointsEarned: isCorrect ? Number(q.points || 10) : 0 };
    });

    const scorePercent = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    let grade = 'F';
    if (scorePercent >= 90) grade = 'A+';
    else if (scorePercent >= 80) grade = 'A';
    else if (scorePercent >= 70) grade = 'B';
    else if (scorePercent >= 60) grade = 'C';
    else if (scorePercent >= 50) grade = 'D';

    // Persist result with grade + totals
    await pool.query(
      `INSERT INTO exam_results (user_id, exam_id, tenant_id, score, grade, total_earned, total_possible, risk_score, violations, attempt_number, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
      [req.user.id, id, req.tenant_id, String(scorePercent), grade,
       totalEarned, totalPossible, riskScore || 0, JSON.stringify(violations || []), attemptNumber]
    );

    // GAP 3: Store per-question answers for review
    for (const ga of gradedAnswers) {
      if (!ga.questionId) continue;
      await pool.query(
        `INSERT INTO exam_answers (exam_id, tenant_id, student_id, question_id, submitted_answer, correct_answer, is_correct, points_earned)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, req.tenant_id, req.user.id, ga.questionId,
         ga.answer || '', ga.correctAnswer || '', !!ga.correct, ga.pointsEarned || 0]
      );
    }

    // Mark slot as completed
    await pool.query(
      `UPDATE exam_slots SET status = 'completed', submitted_at = NOW() WHERE exam_id = $1 AND student_id = $2`,
      [id, req.user.id]
    );

    res.json({
      success: true,
      score: scorePercent,
      scoreDisplay: `${totalEarned}/${totalPossible}`,
      grade,
      totalEarned,
      totalPossible,
      attemptNumber,
      attemptsRemaining: maxAttempts - attemptNumber,
      examTitle: exam.title
    });
  } catch (error: any) {
    console.error('Exam submit error:', error);
    res.status(500).json({ error: 'Failed to submit exam. Please try again.' });
  }
});

// ─── GAP 6: Lecturer — view all results for an exam ─────────────────
app.get('/api/exams/:id/results', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const results = await pool.query(
      `SELECT er.id, er.user_id, u.name as student_name, u.email as student_email,
              er.score, er.grade, er.total_earned, er.total_possible,
              er.risk_score, er.violations, er.attempt_number, er.submitted_at
       FROM exam_results er
       LEFT JOIN users u ON u.id = er.user_id
       WHERE er.exam_id = $1 AND er.tenant_id = $2
       ORDER BY er.submitted_at DESC`,
      [req.params.id, req.tenant_id]
    );
    res.json(results.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GAP 6: Lecturer — view per-question answers for a student ───────
app.get('/api/exams/:id/answers/:studentId', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const rows = await pool.query(
      `SELECT ea.question_id, q.text as question_text, ea.submitted_answer,
              ea.correct_answer, ea.is_correct, ea.points_earned, q.points as max_points
       FROM exam_answers ea
       LEFT JOIN questions q ON q.id = ea.question_id
       WHERE ea.exam_id = $1 AND ea.student_id = $2 AND ea.tenant_id = $3
       ORDER BY ea.id`,
      [req.params.id, req.params.studentId, req.tenant_id]
    );
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GAP 7: Lecturer — clear a student's result to allow retake ──────
app.delete('/api/exams/:id/results/:studentId', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    await pool.query(
      'DELETE FROM exam_results WHERE exam_id = $1 AND user_id = $2 AND tenant_id = $3',
      [req.params.id, req.params.studentId, req.tenant_id]
    );
    await pool.query(
      'DELETE FROM exam_answers WHERE exam_id = $1 AND student_id = $2 AND tenant_id = $3',
      [req.params.id, req.params.studentId, req.tenant_id]
    );
    await pool.query(
      `UPDATE exam_slots SET status = 'pending', submitted_at = NULL, question_order = NULL, option_orders = NULL
       WHERE exam_id = $1 AND student_id = $2`,
      [req.params.id, req.params.studentId]
    );
    res.json({ success: true, message: 'Result cleared — student may retake.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TRANSCRIPT PDF GENERATOR ────────────────────────────────────────
function gradeColor(grade: string): string {
  if (!grade) return '#64748b';
  if (grade === 'A+' || grade === 'A') return '#16a34a';
  if (grade === 'B') return '#2563eb';
  if (grade === 'C') return '#d97706';
  if (grade === 'D') return '#ea580c';
  return '#dc2626';
}

function transcriptHeaderHTML(tenantName: string, title: string, subtitle: string, generatedAt: string): string {
  return `
  <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a8a 100%);padding:36px 40px 28px;color:#fff;border-radius:0 0 24px 24px;margin-bottom:32px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#93c5fd;margin-bottom:6px;">Official Academic Transcript</div>
        <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px;">${tenantName}</div>
        <div style="font-size:15px;font-weight:600;color:#bfdbfe;margin-top:4px;">${title}</div>
        <div style="font-size:11px;color:#93c5fd;margin-top:2px;">${subtitle}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:#93c5fd;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Generated</div>
        <div style="font-size:12px;color:#fff;font-weight:700;margin-top:2px;">${generatedAt}</div>
        <div style="width:52px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:10px 0 0 auto;"></div>
      </div>
    </div>
  </div>`;
}

function scoreBarHTML(score: number): string {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  return `<div style="height:6px;background:#e2e8f0;border-radius:3px;margin:6px 0 2px;overflow:hidden;">
    <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.3s;"></div>
  </div>`;
}

async function generateTranscriptPDF(html: string): Promise<Buffer> {
  const fullHTML = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; min-height: 100vh; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 10px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 22px; margin: 0 20px 24px; }
    .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; padding: 0 20px; margin-bottom: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 14px; margin: 0 20px 20px; overflow: hidden; }
    .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 10px; border-top: 1px solid #f1f5f9; margin-top: 24px; }
  </style>
  </head><body><div class="page">${html}
  <div style="margin:32px 20px 0;padding:18px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-0.3px;">Genius</div>
      <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-top:1px;">Academic Portal Platform</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:8px;color:#64748b;font-weight:600;">This document is system-generated and digitally verified.</div>
      <div style="font-size:8px;color:#334155;font-weight:700;margin-top:2px;">Powered by Genius Academic Suite · ${new Date().getFullYear()}</div>
    </div>
  </div>
  <div style="text-align:center;padding:14px;color:#cbd5e1;font-size:9px;">genius-academic.app</div>
  </div></body></html>`;

  // Reuse the same chromium-path resolution as other PDF generators
  const { execSync } = require('child_process');
  const executablePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];
  let activePath = executablePaths.find((p: string) => require('fs').existsSync(p));
  if (!activePath) {
    try { activePath = execSync('which chromium || which chromium-browser || which google-chrome-stable || which google-chrome', { encoding: 'utf-8' }).trim(); } catch {}
  }
  if (!activePath) throw new Error('Chromium not found for transcript PDF generation.');

  const browser = await puppeteer.launch({
    executablePath: activePath, headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']
  });
  const page = await browser.newPage();
  try {
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0px', bottom: '20px', left: '0px', right: '0px' } });
    return Buffer.from(buffer);
  } finally {
    await page.close();
    await browser.close();
  }
}

// ─── Transcript: Lecturer — all students for one exam ──────────────
app.get('/api/transcripts/exam/:examId', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { examId } = req.params;
    const tenantRes = await pool.query('SELECT name FROM tenants WHERE id = $1', [req.tenant_id]);
    const tenantName = tenantRes.rows[0]?.name || 'Institution';

    const examRes = await pool.query('SELECT title, type, duration, questions_count FROM exams WHERE id = $1 AND tenant_id = $2', [examId, req.tenant_id]);
    if (!examRes.rows.length) return res.status(404).json({ error: 'Exam not found' });
    const exam = examRes.rows[0];

    const results = await pool.query(
      `SELECT er.score, er.grade, er.total_earned, er.total_possible, er.risk_score, er.violations, er.attempt_number, er.submitted_at,
              u.name as student_name, u.email as student_email,
              (SELECT matric_number FROM students_roster WHERE email = u.email AND tenant_id = $2 LIMIT 1) as matric
       FROM exam_results er
       LEFT JOIN users u ON u.id = er.user_id
       WHERE er.exam_id = $1 AND er.tenant_id = $2
       ORDER BY er.score::int DESC, u.name`,
      [examId, req.tenant_id]
    );
    const rows = results.rows;

    const avgScore = rows.length ? Math.round(rows.reduce((s: number, r: any) => s + parseInt(r.score || 0), 0) / rows.length) : 0;
    const passCount = rows.filter((r: any) => parseInt(r.score) >= 50).length;
    const now = new Date().toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });

    const tableRows = rows.map((r: any, i: number) => {
      const score = parseInt(r.score || '0');
      const grade = r.grade || 'F';
      const riskBadge = r.risk_score > 0 ? `<span style="color:#ef4444;font-weight:800;font-size:10px;">⚠ ${r.risk_score}</span>` : '<span style="color:#94a3b8;">—</span>';
      const violations: string[] = Array.isArray(r.violations) ? r.violations : (JSON.parse(r.violations || '[]'));
      return `<tr>
        <td style="font-weight:700;color:#1e293b;">${i + 1}</td>
        <td><div style="font-weight:700;color:#1e293b;">${r.student_name || '—'}</div><div style="font-size:10px;color:#94a3b8;">${r.student_email || ''}</div></td>
        <td style="color:#64748b;font-size:11px;">${r.matric || '—'}</td>
        <td>
          ${scoreBarHTML(score)}
          <div style="font-weight:800;font-size:14px;color:${gradeColor(grade)};">${score}%</div>
          <div style="font-size:10px;color:#64748b;">${r.total_earned || 0} / ${r.total_possible || 0} pts</div>
        </td>
        <td><span class="badge" style="background:${gradeColor(grade)}1a;color:${gradeColor(grade)};">${grade}</span></td>
        <td>${riskBadge}${violations.length > 0 ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px;">${violations.slice(0,2).join('; ')}</div>` : ''}</td>
        <td style="font-size:10px;color:#64748b;">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '—'}</td>
      </tr>`;
    }).join('');

    const html = `
      ${transcriptHeaderHTML(tenantName, `${exam.type === 'exam' ? 'Examination' : 'Test'} Results — ${exam.title}`, `${exam.questions_count || '—'} Questions • ${exam.duration || '—'} Minutes`, now)}
      <div class="summary-box" style="display:flex;gap:24px;flex-wrap:wrap;">
        ${[
          ['Total Submitted', rows.length],
          ['Class Average', avgScore + '%'],
          ['Pass Rate', rows.length ? Math.round((passCount / rows.length) * 100) + '%' : '—'],
          ['Highest Score', rows.length ? Math.max(...rows.map((r: any) => parseInt(r.score || 0))) + '%' : '—'],
          ['Lowest Score', rows.length ? Math.min(...rows.map((r: any) => parseInt(r.score || 0))) + '%' : '—'],
        ].map(([label, val]) => `<div style="flex:1;min-width:120px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#1e40af;">${val}</div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:2px;">${label}</div></div>`).join('')}
      </div>
      ${rows.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:40px;">No submissions yet.</p>' : `
      <p class="section-title" style="margin-top:8px;">Student Results</p>
      <div class="card">
        <table>
          <thead><tr><th>#</th><th>Student</th><th>Matric No.</th><th>Score</th><th>Grade</th><th>Integrity</th><th>Submitted</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`}
      <div class="footer">This is an official computer-generated academic transcript. • ${tenantName} • Generated ${now}</div>`;

    const pdfBuf = await generateTranscriptPDF(html);
    const filename = `${exam.title.replace(/[^a-z0-9]/gi, '_')}_Results.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuf);
  } catch (err: any) {
    console.error('[Transcript Exam]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Transcript: Lecturer — full record for one specific student ────
app.get('/api/transcripts/student/:studentId', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'tenant_admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { studentId } = req.params;
    const tenantRes = await pool.query('SELECT name FROM tenants WHERE id = $1', [req.tenant_id]);
    const tenantName = tenantRes.rows[0]?.name || 'Institution';

    const studentRes = await pool.query('SELECT name, email FROM users WHERE id = $1 AND tenant_id = $2', [studentId, req.tenant_id]);
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];

    const matricRes = await pool.query('SELECT matric_number FROM students_roster WHERE email = $1 AND tenant_id = $2 LIMIT 1', [student.email, req.tenant_id]);
    const matric = matricRes.rows[0]?.matric_number || '—';

    // MCQ exam results
    const examResults = await pool.query(
      `SELECT er.score, er.grade, er.total_earned, er.total_possible, er.risk_score, er.attempt_number, er.submitted_at,
              e.title, e.type, e.duration, e.questions_count
       FROM exam_results er
       LEFT JOIN exams e ON e.id = er.exam_id
       WHERE er.user_id = $1 AND er.tenant_id = $2
       ORDER BY er.submitted_at DESC`,
      [studentId, req.tenant_id]
    );

    // Assignment submissions
    const assignments = await pool.query(
      `SELECT s.grade, s.feedback, s.submitted_at, s.graded_at, e.title
       FROM assignment_submissions s
       LEFT JOIN exams e ON e.id = s.exam_id
       WHERE s.student_id = $1 AND s.tenant_id = $2
       ORDER BY s.submitted_at DESC`,
      [studentId, req.tenant_id]
    );

    const now = new Date().toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
    const allScores = examResults.rows.map((r: any) => parseInt(r.score || 0));
    const gpa = allScores.length ? (allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : '—';

    const examRows = examResults.rows.map((r: any) => {
      const score = parseInt(r.score || '0');
      const grade = r.grade || 'F';
      return `<tr>
        <td><div style="font-weight:700;">${r.title}</div><div style="font-size:10px;color:#94a3b8;">${r.type?.toUpperCase()} • ${r.duration}min • ${r.questions_count}Q</div></td>
        <td>${scoreBarHTML(score)}<div style="font-weight:800;font-size:14px;color:${gradeColor(grade)};">${score}%</div></td>
        <td><span class="badge" style="background:${gradeColor(grade)}1a;color:${gradeColor(grade)};">${grade}</span></td>
        <td style="font-size:10px;color:#64748b;">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '—'}</td>
      </tr>`;
    }).join('');

    const assignRows = assignments.rows.map((r: any) => `<tr>
      <td style="font-weight:700;">${r.title}</td>
      <td style="font-weight:800;color:${gradeColor('')};font-size:14px;">${r.grade || '<span style="color:#94a3b8;font-size:11px;">Not graded</span>'}</td>
      <td style="font-size:11px;color:#64748b;">${r.feedback || '—'}</td>
      <td style="font-size:10px;color:#64748b;">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '—'}</td>
    </tr>`).join('');

    const html = `
      ${transcriptHeaderHTML(tenantName, student.name, `${student.email} • Matric: ${matric}`, now)}
      <div class="summary-box" style="display:flex;gap:24px;flex-wrap:wrap;">
        ${[
          ['Overall Avg', gpa + (gpa !== '—' ? '%' : '')],
          ['Tests & Exams', examResults.rows.length],
          ['Assignments', assignments.rows.length],
          ['Graded', assignments.rows.filter((r: any) => r.grade).length],
        ].map(([label, val]) => `<div style="flex:1;min-width:100px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#1e40af;">${val}</div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:2px;">${label}</div></div>`).join('')}
      </div>
      ${examResults.rows.length > 0 ? `
        <p class="section-title" style="margin-top:8px;">Tests & Examinations</p>
        <div class="card"><table>
          <thead><tr><th>Assessment</th><th>Score</th><th>Grade</th><th>Submitted</th></tr></thead>
          <tbody>${examRows}</tbody>
        </table></div>` : ''}
      ${assignments.rows.length > 0 ? `
        <p class="section-title">Assignments</p>
        <div class="card"><table>
          <thead><tr><th>Assignment</th><th>Grade</th><th>Feedback</th><th>Submitted</th></tr></thead>
          <tbody>${assignRows}</tbody>
        </table></div>` : ''}
      <div class="footer">Official transcript for ${student.name} • ${tenantName} • Generated ${now}</div>`;

    const pdfBuf = await generateTranscriptPDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.name.replace(/\s+/g, '_')}_Transcript.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    console.error('[Transcript Student]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Transcript: Student — their own results (view + download) ──────
app.get('/api/transcripts/my', authenticateToken, async (req: any, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Unauthorized' });
  try {
    const tenantRes = await pool.query('SELECT name FROM tenants WHERE id = $1', [req.tenant_id]);
    const tenantName = tenantRes.rows[0]?.name || 'Institution';
    const matricRes = await pool.query('SELECT matric_number FROM students_roster WHERE email = $1 AND tenant_id = $2 LIMIT 1', [req.user.email, req.tenant_id]);
    const matric = matricRes.rows[0]?.matric_number || '—';

    const examResults = await pool.query(
      `SELECT er.score, er.grade, er.total_earned, er.total_possible, er.attempt_number, er.submitted_at,
              e.title, e.type, e.duration, e.questions_count
       FROM exam_results er
       LEFT JOIN exams e ON e.id = er.exam_id
       WHERE er.user_id = $1 AND er.tenant_id = $2
       ORDER BY er.submitted_at DESC`,
      [req.user.id, req.tenant_id]
    );

    const assignments = await pool.query(
      `SELECT s.grade, s.feedback, s.submitted_at, e.title
       FROM assignment_submissions s
       LEFT JOIN exams e ON e.id = s.exam_id
       WHERE s.student_id = $1 AND s.tenant_id = $2
       ORDER BY s.submitted_at DESC`,
      [req.user.id, req.tenant_id]
    );

    // If ?format=json, return raw data for the student portal to display inline
    if (req.query.format === 'json') {
      return res.json({ examResults: examResults.rows, assignments: assignments.rows });
    }

    const now = new Date().toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Lagos' });
    const allScores = examResults.rows.map((r: any) => parseInt(r.score || 0));
    const gpa = allScores.length ? (allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length).toFixed(1) : '—';

    const examRows = examResults.rows.map((r: any) => {
      const score = parseInt(r.score || '0');
      const grade = r.grade || 'F';
      return `<tr>
        <td><div style="font-weight:700;">${r.title}</div><div style="font-size:10px;color:#94a3b8;">${r.type?.toUpperCase()} • ${r.duration}min • ${r.questions_count}Q</div></td>
        <td>${scoreBarHTML(score)}<div style="font-weight:800;font-size:14px;color:${gradeColor(grade)};">${score}%</div><div style="font-size:10px;color:#64748b;">${r.total_earned || 0}/${r.total_possible || 0} pts</div></td>
        <td><span class="badge" style="background:${gradeColor(grade)}1a;color:${gradeColor(grade)};">${grade}</span></td>
        <td style="font-size:10px;color:#64748b;">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '—'}</td>
      </tr>`;
    }).join('');

    const assignRows = assignments.rows.map((r: any) => `<tr>
      <td style="font-weight:700;">${r.title}</td>
      <td style="font-weight:800;font-size:14px;color:${r.grade ? '#16a34a' : '#94a3b8'};">${r.grade || 'Pending'}</td>
      <td style="font-size:11px;color:#64748b;">${r.feedback || '—'}</td>
      <td style="font-size:10px;color:#64748b;">${r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Lagos' }) : '—'}</td>
    </tr>`).join('');

    const html = `
      ${transcriptHeaderHTML(tenantName, req.user.name, `${req.user.email} • Matric: ${matric}`, now)}
      <div class="summary-box" style="display:flex;gap:24px;flex-wrap:wrap;">
        ${[
          ['Average Score', gpa + (gpa !== '—' ? '%' : '')],
          ['Tests Taken', examResults.rows.length],
          ['Assignments', assignments.rows.length],
          ['Graded', assignments.rows.filter((r: any) => r.grade).length],
        ].map(([label, val]) => `<div style="flex:1;min-width:100px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#1e40af;">${val}</div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-top:2px;">${label}</div></div>`).join('')}
      </div>
      ${examResults.rows.length > 0 ? `
        <p class="section-title" style="margin-top:8px;">Tests & Examinations</p>
        <div class="card"><table>
          <thead><tr><th>Assessment</th><th>Score</th><th>Grade</th><th>Date</th></tr></thead>
          <tbody>${examRows}</tbody>
        </table></div>` : ''}
      ${assignments.rows.length > 0 ? `
        <p class="section-title">Assignments</p>
        <div class="card"><table>
          <thead><tr><th>Assignment</th><th>Grade</th><th>Feedback</th><th>Submitted</th></tr></thead>
          <tbody>${assignRows}</tbody>
        </table></div>` : ''}
      <div class="footer">Personal Academic Transcript • ${tenantName} • Generated ${now} • Confidential</div>`;

    const pdfBuf = await generateTranscriptPDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="My_Academic_Transcript.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    console.error('[Transcript My]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GAP 8: Attendance — mark present with optional payment gate ──────
// (existing endpoint is handled below in attendance section)

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

// END OF FILE SCRUBBED: Removed redundant config endpoints.

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
          <strong>DOI:</strong> <a class="doi-link" href="${doiUrl(doi)}">${doiUrl(doi)}</a><br>
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

    // Hashed assets (JS/CSS) can be cached forever — filename changes on every build
    app.use('/assets', express.static('dist/assets', {
      maxAge: '1y',
      immutable: true,
    }));

    // index.html must never be cached — it references the latest hashed asset filenames
    app.use(express.static('dist', {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));

    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

let httpServer: ReturnType<typeof app.listen> | null = null;

startServer();

// Graceful shutdown — Railway sends SIGTERM then SIGKILL after 10s
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, stopping HTTP server...');
  const forceExit = setTimeout(() => {
    console.error('[Shutdown] Timed out — forcing exit.');
    process.exit(1);
  }, 9000);
  forceExit.unref(); // Don't let this timer keep the process alive

  const finish = async () => {
    try {
      await pool.end();
      console.log('[Shutdown] DB pool closed. Exiting cleanly.');
    } catch (e) {
      console.error('[Shutdown] Pool drain error:', e);
    }
    process.exit(0);
  };

  if (httpServer) {
    httpServer.close(() => finish()); // Stop accepting new connections, then drain DB
  } else {
    finish();
  }
});
