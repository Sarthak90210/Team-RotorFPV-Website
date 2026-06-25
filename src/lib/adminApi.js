import { auth } from '../firebase';

// Single source of truth for the backend base URL.
// Previously this line was copy-pasted ~13 times across the admin UI.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getIdToken = () => auth.currentUser.getIdToken();

// POST JSON to the admin backend with the caller's Firebase ID token.
// Returns { ok, data }. Never throws on HTTP status — only on network failure.
export async function apiPost(path, body) {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Upload a single file (image/video/pdf) to Cloudinary via the backend.
// Returns { ok, data } where data is the parsed server response.
export async function uploadFile(file, folder) {
  const idToken = await getIdToken();
  const form = new FormData();
  form.append('image', file);
  if (folder) form.append('folder', folder);
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Best-effort removal of an uploaded asset from Cloudinary.
// No-ops for externally pasted (non-Cloudinary) URLs; never throws.
export async function deleteCloudinaryImage(url) {
  if (!url || !url.includes('res.cloudinary.com')) return;
  try {
    const { ok, data } = await apiPost('/api/delete-asset', { url });
    if (!ok) {
      throw new Error(data.error || 'Cloudinary delete failed');
    }
  } catch (error) {
    console.error({
      action: 'cloudinary_delete_failed',
      url,
      error: error.message || error,
      timestamp: new Date().toISOString(),
    });
  }
}

// Move a Cloudinary asset into a different folder (e.g. when switching an event
// between Upcoming/Past). Returns the new optimized URL, or the original URL
// unchanged for non-Cloudinary links or on failure (best-effort, never throws).
export async function moveCloudinaryImage(url, toFolder) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  try {
    const { ok, data } = await apiPost('/api/move-asset', { url, toFolder });
    if (ok && data.secure_url) return data.secure_url;
    return url;
  } catch (error) {
    console.error({
      action: 'cloudinary_move_failed',
      url,
      toFolder,
      error: error.message || error,
      timestamp: new Date().toISOString(),
    });
    return url;
  }
}

// GET JSON from the admin backend with the caller's Firebase ID token.
// Returns { ok, data }. Never throws on HTTP status — only on network failure.
export async function apiGet(path) {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Fetch the visitor-analytics summary for the Traffic tab.
export async function fetchAnalytics() {
  const { ok, data } = await apiGet('/api/analytics');
  if (!ok) throw new Error(data.error || 'Failed to load analytics');
  return data;
}

// Fetch the list of admins. Returns an array (empty on failure).
export async function fetchAdmins() {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}/api/admins`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.admins || [];
}
