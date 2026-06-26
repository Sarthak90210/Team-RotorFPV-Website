// Auth middleware + request helpers, extracted from index.js so they can be
// unit-tested in isolation (importing this module does NOT initialize Firebase
// Admin or start the server). getAuth() is only invoked when a token is actually
// present, so the no-token / bad-scheme guard paths are fully testable offline.
import { getAuth } from 'firebase-admin/auth';

// Normalize an IPv6-mapped IPv4 address (::ffff:1.2.3.4 -> 1.2.3.4).
export const normalizeIp = (ip) => (ip || '').replace(/^::ffff:/, '').trim();

// Private / loopback / link-local ranges that are never a real public visitor.
export const PRIVATE_IP_RE = /^(?:10\.|127\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd])/i;

// Resolve the real client IP. Cloud platforms often chain SEVERAL internal
// proxies, so X-Forwarded-For looks like:
//   "<real client public IP>, 10.x.x.x, 10.x.x.x"
// and the count of internal hops varies per request — so a fixed `trust proxy`
// hop number can't reliably point at the visitor.
export function getClientIp(req) {
  // 1) Platform-specific "real client" headers win — they carry the original
  //    visitor IP even when X-Forwarded-For is full of internal hops.
  const directHeaders = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'fly-client-ip'];
  for (const header of directHeaders) {
    const value = normalizeIp(req.headers[header]);
    if (value && !PRIVATE_IP_RE.test(value)) return value;
  }

  // 2) Otherwise scan the X-Forwarded-For chain for the first PUBLIC address,
  //    which is the original visitor regardless of how many private hops follow.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const chain = xff.split(',').map(normalizeIp).filter(Boolean);
    const publicIp = chain.find((ip) => !PRIVATE_IP_RE.test(ip));
    if (publicIp) return publicIp;
    if (chain.length > 0) return chain[0];
  }

  // 3) Last resort: the socket address Express resolved.
  return normalizeIp(req.ip);
}

// Derive a Cloudinary public_id from a delivery URL.
// Handles our optimized URLs that include a transformation + version segment, e.g.
//   https://res.cloudinary.com/<cloud>/image/upload/c_limit,w_1200,f_auto,q_auto/v1700000000/team-rotor/abc.jpg
//   -> team-rotor/abc
export function getPublicIdFromUrl(url) {
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

// Middleware to verify if the requester is an admin
export const verifyAdmin = async (req, res, next) => {
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
export const verifySuperAdmin = async (req, res, next) => {
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
