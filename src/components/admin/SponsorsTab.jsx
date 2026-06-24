import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage } from '../../lib/adminApi';

const EMPTY_SPONSOR_FORM = { name: '', website: '', logo: '', order: 0, isActive: true };

const DEFAULT_PAGE_SETTINGS = {
  title: 'Sponsor Us',
  description: '',
  teamImage: { url: '', publicId: '' },
  brochure: { url: '', publicId: '', name: '' },
  whySponsorUs: ''
};

const SponsorsTab = ({ user }) => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sponsorFormData, setSponsorFormData] = useState(EMPTY_SPONSOR_FORM);
  const [sponsorPageSettings, setSponsorPageSettings] = useState(DEFAULT_PAGE_SETTINGS);
  const sponsorFileInputRef = useRef(null);
  const sponsorSettingsTeamImageRef = useRef(null);
  const sponsorSettingsBrochureRef = useRef(null);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'sponsors'), (docSnap) => {
      if (docSnap.exists()) {
        setSponsorPageSettings({
          title: docSnap.data().title || 'Sponsor Us',
          description: docSnap.data().description || '',
          teamImage: docSnap.data().teamImage || { url: '', publicId: '' },
          brochure: docSnap.data().brochure || { url: '', publicId: '', name: '' },
          whySponsorUs: docSnap.data().whySponsorUs || ''
        });
      }
    }, (error) => {
      console.error("Error fetching sponsor settings:", error);
    });

    const qSponsors = query(collection(db, 'sponsors'), orderBy('order', 'asc'));
    const unsubSponsors = onSnapshot(qSponsors, (snapshot) => {
      setSponsors(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin sponsors:", error);
      setLoading(false);
    });

    return () => {
      unsubSettings();
      unsubSponsors();
    };
  }, []);

  const handleSponsorInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSponsorFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSponsorImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!sponsorFormData.name) {
      alert("Please enter the sponsor's name before uploading their logo.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const folder = `sponsor-us/${sponsorFormData.name.trim().replace(/\s+/g, '-')}`;
      const { ok, data: uploadedImage } = await uploadFile(file, folder);
      if (ok && uploadedImage.secure_url) {
        setSponsorFormData(prev => ({ ...prev, logo: uploadedImage.secure_url }));
      } else {
        alert(uploadedImage.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (sponsorFileInputRef.current) sponsorFileInputRef.current.value = '';
    }
  };

  const resetSponsorForm = () => {
    setSponsorFormData(EMPTY_SPONSOR_FORM);
    setEditingSponsorId(null);
  };

  const handleSponsorEdit = (item) => {
    setEditingSponsorId(item.id);
    setSponsorFormData({
      name: item.name || '',
      website: item.website || '',
      logo: item.logo || '',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSponsorDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this sponsor?")) {
      try {
        await deleteDoc(doc(db, 'sponsors', item.id));
        await deleteCloudinaryImage(item.logo);
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete sponsor.");
      }
    }
  };

  const handleSponsorSubmit = async (e) => {
    e.preventDefault();
    if (!sponsorFormData.name || !sponsorFormData.logo) {
      alert("Name and Logo are required.");
      return;
    }
    const dataToSave = {
      name: sponsorFormData.name,
      website: sponsorFormData.website,
      logo: sponsorFormData.logo,
      order: Number(sponsorFormData.order),
      isActive: sponsorFormData.isActive,
      updatedAt: serverTimestamp(),
      updatedBy: user.email
    };

    try {
      if (editingSponsorId) {
        const oldItem = sponsors.find(s => s.id === editingSponsorId);
        if (oldItem && oldItem.logo && oldItem.logo !== sponsorFormData.logo) {
          await deleteCloudinaryImage(oldItem.logo);
        }
        await updateDoc(doc(db, 'sponsors', editingSponsorId), dataToSave);
      } else {
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdBy = user.email;
        await addDoc(collection(db, 'sponsors'), dataToSave);
      }
      resetSponsorForm();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save sponsor.");
    }
  };

  const handleSponsorSettingsChange = (e) => {
    const { name, value } = e.target;
    setSponsorPageSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSponsorSettingsUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large! Maximum size is 20MB.");
      return;
    }

    setIsUploading(true);
    const folder = type === 'teamImage' ? 'sponsor-us/team-image' : 'sponsor-us';

    try {
      const { ok, data: uploadedMedia } = await uploadFile(file, folder);
      if (ok && uploadedMedia.secure_url) {
        if (type === 'teamImage') {
          if (sponsorPageSettings.teamImage?.url) {
            await deleteCloudinaryImage(sponsorPageSettings.teamImage.url);
          }
          setSponsorPageSettings(prev => ({
            ...prev,
            teamImage: { url: uploadedMedia.secure_url, publicId: uploadedMedia.public_id || '' }
          }));
        } else if (type === 'brochure') {
          if (sponsorPageSettings.brochure?.url) {
            await deleteCloudinaryImage(sponsorPageSettings.brochure.url);
          }
          setSponsorPageSettings(prev => ({
            ...prev,
            brochure: { url: uploadedMedia.secure_url, publicId: uploadedMedia.public_id || '', name: file.name }
          }));
        }
      } else {
        alert(uploadedMedia.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading file.");
    } finally {
      setIsUploading(false);
      if (type === 'teamImage' && sponsorSettingsTeamImageRef.current) sponsorSettingsTeamImageRef.current.value = '';
      if (type === 'brochure' && sponsorSettingsBrochureRef.current) sponsorSettingsBrochureRef.current.value = '';
    }
  };

  const handleSponsorSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'sponsors'), {
        ...sponsorPageSettings,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      alert("Sponsors Page Settings updated successfully!");
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save Sponsor Page Settings.");
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-span-full">
        <div className="admin-glass-panel form-panel">
          <h2>Sponsors Page Settings</h2>
          <form onSubmit={handleSponsorSettingsSubmit} className="admin-form">
            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={sponsorPageSettings.description}
                onChange={handleSponsorSettingsChange}
                rows="3"
                placeholder="e.g. Partnering with Team Rotor FPV provides..."
              ></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Team Image</label>
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={sponsorSettingsTeamImageRef}
                  onChange={(e) => handleSponsorSettingsUpload(e, 'teamImage')}
                  disabled={isUploading}
                />
                {sponsorPageSettings.teamImage?.url && (
                  <div className="image-preview achievement stack-sm">
                    <img src={sponsorPageSettings.teamImage.url} alt="Team" />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Brochure PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  ref={sponsorSettingsBrochureRef}
                  onChange={(e) => handleSponsorSettingsUpload(e, 'brochure')}
                  disabled={isUploading}
                />
                {sponsorPageSettings.brochure?.url && (
                  <div className="stack-sm">
                    <p className="field-hint">Current: {sponsorPageSettings.brochure.name || 'Brochure PDF'}</p>
                    <a href={sponsorPageSettings.brochure.url} target="_blank" rel="noreferrer" className="file-link">Preview PDF</a>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Why Sponsor Us</label>
              <textarea
                name="whySponsorUs"
                value={sponsorPageSettings.whySponsorUs}
                onChange={handleSponsorSettingsChange}
                rows="3"
                placeholder="e.g. By sponsoring us, you gain valuable brand visibility..."
              ></textarea>
            </div>

            <div className="form-actions">
              <button type="submit" className="admin-btn primary" disabled={isUploading}>Save Settings</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>{editingSponsorId ? 'Edit Sponsor' : 'Add New Sponsor'}</h2>
          <form onSubmit={handleSponsorSubmit} className="admin-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={sponsorFormData.name}
                onChange={handleSponsorInputChange}
                required
                placeholder="e.g. DJI"
              />
            </div>

            <div className="form-group">
              <label>Website URL</label>
              <input
                type="url"
                name="website"
                value={sponsorFormData.website}
                onChange={handleSponsorInputChange}
                required
                placeholder="https://www.dji.com"
              />
            </div>

            <div className="form-group">
              <label>Order</label>
              <input
                type="number"
                name="order"
                value={sponsorFormData.order}
                onChange={handleSponsorInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Logo</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={sponsorFileInputRef}
                  onChange={handleSponsorImageUpload}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
              <div className="input-divider">or</div>
              <input
                type="text"
                name="logo"
                value={sponsorFormData.logo}
                onChange={handleSponsorInputChange}
                placeholder="Paste an image URL directly"
                required
              />
              {sponsorFormData.logo && (
                <div className="image-preview achievement contain">
                  <img src={sponsorFormData.logo} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={sponsorFormData.isActive}
                  onChange={handleSponsorInputChange}
                />
                Active (visible on website)
              </label>
            </div>

            <div className="form-actions">
              {editingSponsorId && (
                <button type="button" onClick={resetSponsorForm} className="admin-btn cancel">
                  Cancel
                </button>
              )}
              <button type="submit" className="admin-btn primary">
                {editingSponsorId ? 'Update Sponsor' : 'Add Sponsor'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Sponsors</h2>
          <div className="achievements-list">
            {sponsors.map((item) => (
              <div key={item.id} className={`admin-achievement-card ${!item.isActive ? 'inactive-member' : ''}`}>
                <div className="card-info">
                  <h3>{item.name} <span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></h3>
                  <span className="order-badge">Order: {item.order}</span>
                  <p className="card-desc"><a href={item.website} target="_blank" rel="noopener noreferrer" className="link-inherit">{item.website}</a></p>
                </div>
                <div className="card-actions">
                  <button onClick={() => handleSponsorEdit(item)} className="admin-btn edit small">Edit</button>
                  <button onClick={() => handleSponsorDelete(item)} className="admin-btn delete small">Delete</button>
                </div>
              </div>
            ))}
            {!loading && sponsors.length === 0 && <p className="empty-state">No sponsors yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorsTab;
