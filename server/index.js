import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';
import geoip from 'geoip-lite';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
// The service account key should be downloaded from Firebase Console -> Project Settings -> Service Accounts
// Save it as serviceAccountKey.json in the server folder (make sure to add to .gitignore)
import { readFileSync } from 'fs';

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Use environment variable in production (Render, Railway, etc.)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Use local file for development
  serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const app = express();

// Behind a reverse proxy (Render/Railway/Vercel), the real client IP arrives in
// the X-Forwarded-For header — the raw socket address is the proxy's. Trust one
// hop so req.ip resolves to the actual visitor. Without this, every request keys
// to the proxy IP: rate limiters share a single bucket and visit logs are useless.
// '1' (one hop) is deliberate — `true` would trust a spoofable client-set header.
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://teamrotorfpv.com',
  'https://www.teamrotorfpv.com',
  process.env.FRONTEND_URL
].filter(Boolean);

// Vercel preview URLs for THIS project only.
// Pattern: https://team-rotor-fpv-website-<hash>-<team>.vercel.app
// Set VERCEL_PROJECT_NAME in server/.env to your Vercel project slug (e.g. "team-rotor-fpv-website").
const VERCEL_PROJECT_NAME = process.env.VERCEL_PROJECT_NAME || '';

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Vercel preview deployments scoped to this project only.
    // Requires VERCEL_PROJECT_NAME to be set; otherwise this check is skipped.
    if (
      VERCEL_PROJECT_NAME &&
      /^https:\/\//.test(origin) &&
      origin.endsWith('.vercel.app') &&
      origin.toLowerCase().includes(VERCEL_PROJECT_NAME.toLowerCase())
    ) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json());

// ── Cloudinary configuration ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer configuration (memory storage, media up to 20 MB) ──
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/octet-stream', '', 'application/pdf'
];
const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'mp4', 'webm', 'mov', 'pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname ? file.originalname.split('.').pop().toLowerCase() : '';
    
    // Browsers often don't have a registered MIME type for HEIC files 
    // and send them as application/octet-stream or empty string.
    // We check both the mime type and the file extension for safety.
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isValidExt = ALLOWED_EXTS.includes(ext);

    if (!(isValidMime && isValidExt)) {
      return cb(new Error('Only JPEG, PNG, WebP, GIF, HEIC, AVIF images, MP4/WebM/MOV videos, and PDF files are allowed.'));
    }
    cb(null, true);
  },
});

// Middleware to verify if the requester is an admin
const verifyAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    // verifyIdToken(token, checkRevoked) - passing true checks if the token was revoked
    const decodedToken = await getAuth().verifyIdToken(token, true);
    if (decodedToken.admin !== true) {
      return res.status(403).json({ error: 'Forbidden: Requires admin privileges' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Middleware to verify if the requester is a Super Admin
const verifySuperAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token, true);
    if (decodedToken.superAdmin !== true && decodedToken.email !== process.env.SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: Requires Super Admin privileges' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const logAudit = async (action, userEmail, targetEmail) => {
  const logMessage = `[ROLE CHANGE] ${userEmail} ${action} ${targetEmail}`;
  console.log(logMessage);
  try {
    await db.collection('audit_logs').add({
      action,
      userEmail,
      targetEmail,
      timestamp: new Date()
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
};

// Endpoint to grant admin access
app.post('/api/setAdmin', verifySuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const userRecord = await getAuth().getUserByEmail(email);
    const isSuper = userRecord.customClaims?.superAdmin === true;
    await getAuth().setCustomUserClaims(userRecord.uid, { admin: true, superAdmin: isSuper });
    await db.collection('admins').doc(email).set({ email, isSuperAdmin: isSuper, isRoot: email === process.env.SUPER_ADMIN_EMAIL }, { merge: true });
    await logAudit('granted admin to', req.user.email, email);
    res.json({ message: `Successfully granted admin privileges to ${email}` });
  } catch (error) {
    console.error('Error setting admin:', error);
    if (error.code === 'auth/user-not-found') return res.status(404).json({ error: 'User not found. They must sign in at least once first.' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to revoke admin access
app.post('/api/removeAdmin', verifySuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  if (email === process.env.SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'The root Super Admin cannot be modified.' });
  }
  if (req.user.email === email) {
    return res.status(400).json({ error: 'You cannot remove your own privileges.' });
  }

  try {
    const userRecord = await getAuth().getUserByEmail(email);
    if (userRecord.customClaims?.superAdmin === true) {
      const adminsSnapshot = await db.collection('admins').where('isSuperAdmin', '==', true).get();
      if (adminsSnapshot.size <= 1 && req.user.email !== process.env.SUPER_ADMIN_EMAIL) {
         return res.status(400).json({ error: 'At least one Super Admin must remain.' });
      }
    }

    await getAuth().setCustomUserClaims(userRecord.uid, { admin: false, superAdmin: false });
    await getAuth().revokeRefreshTokens(userRecord.uid);
    await db.collection('admins').doc(email).delete();
    await logAudit('revoked admin from', req.user.email, email);
    res.json({ message: `Successfully revoked admin privileges from ${email}` });
  } catch (error) {
    console.error('Error revoking admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to set super admin
app.post('/api/setSuperAdmin', verifySuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const userRecord = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(userRecord.uid, { admin: true, superAdmin: true });
    await db.collection('admins').doc(email).set({ email, isSuperAdmin: true, isRoot: email === process.env.SUPER_ADMIN_EMAIL }, { merge: true });
    await logAudit('promoted to super admin', req.user.email, email);
    res.json({ message: `Successfully promoted ${email} to Super Admin` });
  } catch (error) {
    console.error('Error setting super admin:', error);
    if (error.code === 'auth/user-not-found') return res.status(404).json({ error: 'User not found.' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to remove super admin
app.post('/api/removeSuperAdmin', verifySuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  if (email === process.env.SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'The root Super Admin cannot be modified.' });
  }
  if (req.user.email === email) {
    return res.status(400).json({ error: 'You cannot demote yourself.' });
  }

  try {
    const adminsSnapshot = await db.collection('admins').where('isSuperAdmin', '==', true).get();
    if (adminsSnapshot.size <= 1 && req.user.email !== process.env.SUPER_ADMIN_EMAIL) {
       return res.status(400).json({ error: 'At least one Super Admin must remain.' });
    }

    const userRecord = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(userRecord.uid, { admin: true, superAdmin: false });
    await getAuth().revokeRefreshTokens(userRecord.uid);
    await db.collection('admins').doc(email).set({ isSuperAdmin: false }, { merge: true });
    await logAudit('demoted from super admin', req.user.email, email);
    res.json({ message: `Successfully demoted ${email} to regular Admin` });
  } catch (error) {
    console.error('Error removing super admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to list all admins (optional utility)
app.get('/api/admins', verifyAdmin, async (req, res) => {
  try {
    const adminsSnapshot = await db.collection('admins').get();
    
    if (!adminsSnapshot.empty) {
      const admins = [];
      adminsSnapshot.forEach(doc => admins.push(doc.data()));
      return res.json({ admins });
    }

    // Fallback/Migration: If collection is empty, migrate from Firebase Auth
    const listUsersResult = await getAuth().listUsers(1000);
    const admins = listUsersResult.users
      .filter(user => user.customClaims && user.customClaims.admin === true)
      .map(user => ({
         email: user.email,
         isSuperAdmin: user.customClaims.superAdmin === true || user.email === process.env.SUPER_ADMIN_EMAIL,
         isRoot: user.email === process.env.SUPER_ADMIN_EMAIL
      }));
      
    // Populate the Firestore collection for future fast reads
    if (admins.length > 0) {
      const batch = db.batch();
      admins.forEach(admin => {
        const docRef = db.collection('admins').doc(admin.email);
        batch.set(docRef, admin);
      });
      await batch.commit();
    }
      
    res.json({ admins });
  } catch (error) {
    console.error('Error listing admins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Upload rate limiter: 20 uploads per 10 minutes per IP ──
// This caps memory pressure from concurrent large-file uploads.
// Placed before Multer so rate-limited requests are rejected before
// any file bytes are buffered into RAM.
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: { error: 'Too many uploads. Please wait before uploading more files.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Image upload endpoint (admin-only, signed Cloudinary upload) ──
app.post('/api/upload', verifyAdmin, uploadLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const targetFolder = req.body.folder ? `team-rotor/${req.body.folder}` : 'team-rotor';

    const isRaw = req.file.mimetype === 'application/pdf';
    const rType = isRaw ? 'raw' : 'auto';

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: targetFolder, resource_type: rType },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    let optimizedUrl = result.secure_url;
    
    // Cloudinary returns the resource_type it detected.
    if (result.resource_type === 'video') {
      // For videos: apply f_auto and q_auto:eco (to save massive bandwidth)
      const parts = result.secure_url.split('/upload/');
      optimizedUrl = `${parts[0]}/upload/f_auto,q_auto:eco/${parts[1]}`;
    } else if (result.resource_type === 'image') {
      // For images: handle format (e.g., HEIC -> WebP), quality, and resize to max width 1200px
      const parts = result.secure_url.split('/upload/');
      optimizedUrl = `${parts[0]}/upload/c_limit,w_1200,f_auto,q_auto/${parts[1]}`;
    }

    res.json({
      secure_url: optimizedUrl,
      width: result.width,
      height: result.height,
      public_id: result.public_id,
      resource_type: result.resource_type
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// Derive a Cloudinary public_id from a delivery URL.
// Handles our optimized URLs that include a transformation + version segment, e.g.
//   https://res.cloudinary.com/<cloud>/image/upload/c_limit,w_1200,f_auto,q_auto/v1700000000/team-rotor/abc.jpg
//   -> team-rotor/abc
function getPublicIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('res.cloudinary.com')) return null;
    const afterUpload = u.pathname.split('/upload/')[1];
    if (!afterUpload) return null;
    // Take everything after the version segment (vNNN/) if present; otherwise the whole path.
    const match = afterUpload.match(/v\d+\/(.+)$/);
    const path = match ? match[1] : afterUpload;
    // Strip the file extension to get the bare public_id and decode URI components (e.g., %20 to space).
    return decodeURIComponent(path.replace(/\.[^/.]+$/, ''));
  } catch {
    return null;
  }
}

// 🗑️ Delete a Cloudinary asset by its delivery URL or publicId (admin-only) 🗑️
app.post('/api/delete-asset', verifyAdmin, async (req, res) => {
  try {
    const { url, publicId: providedPublicId } = req.body;
    
    let publicId = providedPublicId;
    
    if (!publicId && url) {
      publicId = getPublicIdFromUrl(url);
    }
    
    if (!publicId) {
      if (url) return res.json({ result: 'skipped', message: 'No publicId provided and could not derive from URL' });
      return res.status(400).json({ error: 'publicId or url is required' });
    }

    console.log(`[Cloudinary Delete] Attempting to delete:`, { url, publicId });
    
    // Cloudinary destroy defaults to resource_type: 'image'. If not found, it might be a video or raw (PDF).
    let result = await cloudinary.uploader.destroy(publicId);
    if (result.result === 'not found') {
       result = await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }
    if (result.result === 'not found') {
       result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
    }
    
    console.log(`[Cloudinary Delete] Result:`, result);
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }
    
    res.json({ message: 'Asset deletion processed', result: result.result, publicId });
  } catch (error) {
    console.error('[Cloudinary Delete] Error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

// ── Contact Us Endpoint ──
const resend = new Resend(process.env.RESEND_API_KEY);

// Verified sender on the team's domain; override via env if the domain changes.
const CONTACT_FROM = process.env.CONTACT_FROM || 'Team RotorFPV <contact@teamrotorfpv.com>';
// Comma-separated list of recipients, e.g. "teamrotorfpv@vit.ac.in,backup@example.com".
const CONTACT_RECIPIENTS = (process.env.CONTACT_RECIPIENTS || '')
  .split(',')
  .map((addr) => addr.trim())
  .filter(Boolean);

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 contact requests per window
  message: { error: 'Too many requests, please try again later.' }
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, phone, organization, queryType, message, honeypot } = req.body;

    // Basic anti-spam honeypot field check
    if (honeypot) {
      // Spam detected, silently reject but return success to fool bots
      return res.status(200).json({ success: true, message: 'Message sent successfully.' });
    }

    // Required fields validation
    if (!name || !email || !message || !queryType) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // Message length limit
    if (message.length > 2000) {
      return res.status(400).json({ success: false, error: 'Message is too long (max 2000 characters)' });
    }

    const contactDoc = {
      name,
      email,
      phone: phone || '',
      organization: organization || '',
      queryType,
      message,
      createdAt: new Date(),
      status: 'unread',
      ipAddress: req.ip || req.connection?.remoteAddress || '',
      repliedAt: null
    };

    // Save to Firestore
    const docRef = await db.collection('contact_messages').add(contactDoc);

    // Format Email
    const submissionDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });
    const emailBody = `Name: ${name}
Email: ${email}
Phone: ${phone || 'N/A'}
Organization: ${organization || 'N/A'}
Query Type: ${queryType}

Message:
${message}

Submitted on:
${submissionDate} IST`;

    // Send notification email via Resend.
    // Best-effort only: the message is already persisted to Firestore above and is
    // visible in the admin dashboard, so an email failure must NOT fail the request
    // (that would make users resubmit and create duplicate entries).
    if (process.env.RESEND_API_KEY && CONTACT_RECIPIENTS.length > 0) {
      const { error } = await resend.emails.send({
        from: CONTACT_FROM,
        to: CONTACT_RECIPIENTS,
        subject: '[Team RotorFPV Website] New Contact Form Submission',
        text: emailBody
      });

      if (error) {
        console.error("Resend API Error:", error.message || error);
      } else {
        console.log(`Contact notification email sent to ${CONTACT_RECIPIENTS.length} recipient(s).`);
      }
    } else {
      console.warn("RESEND_API_KEY or CONTACT_RECIPIENTS not set; skipping email notification.");
    }

    res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error handling contact form:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Visitor Analytics ──
// Public endpoint the frontend pings on each page view. The real client IP comes
// from req.ip (correct because of `app.set('trust proxy', 1)` above); we resolve
// a coarse location offline with geoip-lite — no external API call, no API key.
// Writes go through the Admin SDK, so the 'visits' collection stays fully locked
// down by the default-deny Firestore rule (clients can neither read nor write it).
const trackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // cap pageview spam per IP
  standardHeaders: true,
  legacyHeaders: false,
  // Analytics is best-effort: swallow over-limit pings instead of erroring.
  handler: (req, res) => res.status(204).end(),
});

// Normalize an IPv6-mapped IPv4 address (::ffff:1.2.3.4 -> 1.2.3.4) for geo lookup.
const normalizeIp = (ip) => (ip || '').replace(/^::ffff:/, '');

app.post('/api/track', trackLimiter, async (req, res) => {
  try {
    const ua = (req.headers['user-agent'] || '').slice(0, 300);

    // Skip obvious bots/crawlers so the numbers reflect real humans.
    if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/i.test(ua)) {
      return res.status(204).end();
    }

    const ip = normalizeIp(req.ip);
    const path = typeof req.body?.path === 'string' ? req.body.path.slice(0, 200) : '/';
    const geo = geoip.lookup(ip) || null;

    await db.collection('visits').add({
      ip,
      path,
      userAgent: ua,
      country: geo?.country || null, // ISO-2 country code, e.g. "IN"
      region: geo?.region || null,
      city: geo?.city || null,
      ll: geo?.ll || null,           // [latitude, longitude]
      timestamp: new Date(),
    });

    res.status(204).end();
  } catch (error) {
    // Tracking must never break a page load — log and move on.
    console.error('Visit tracking error:', error.message || error);
    res.status(204).end();
  }
});

// Admin-only analytics summary for the dashboard Traffic tab.
// Accurate lifetime total comes from a cheap count() aggregation; the breakdowns
// (unique IPs, country split, recent feed) are computed over the most recent
// ANALYTICS_SCAN_LIMIT visits to keep per-request reads bounded.
const ANALYTICS_SCAN_LIMIT = 2000;

app.get('/api/analytics', verifyAdmin, async (req, res) => {
  try {
    const [countSnap, snap] = await Promise.all([
      db.collection('visits').count().get(),
      db.collection('visits').orderBy('timestamp', 'desc').limit(ANALYTICS_SCAN_LIMIT).get(),
    ]);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const uniqueIps = new Set();
    const countryCounts = {};
    const recent = [];
    let last24h = 0;
    let last7d = 0;

    snap.forEach((doc) => {
      const v = doc.data();
      const ts = v.timestamp?.toDate ? v.timestamp.toDate() : new Date(v.timestamp);
      const age = now - ts.getTime();

      if (v.ip) uniqueIps.add(v.ip);
      if (age <= DAY) last24h += 1;
      if (age <= 7 * DAY) last7d += 1;

      const country = v.country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;

      if (recent.length < 100) {
        recent.push({
          ip: v.ip || '',
          city: v.city || '',
          region: v.region || '',
          country,
          path: v.path || '',
          timestamp: ts.toISOString(),
        });
      }
    });

    const byCountry = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      totalVisits: countSnap.data().count,
      scannedWindow: snap.size,           // breakdowns below are over this many recent visits
      windowCapped: snap.size === ANALYTICS_SCAN_LIMIT,
      uniqueVisitors: uniqueIps.size,
      last24h,
      last7d,
      byCountry,
      recent,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Handle multer errors (file too large, wrong type)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 20 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('are allowed')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Admin backend server running on port ${PORT}`);
});
