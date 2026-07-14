import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage, logAdminAction } from '../../lib/adminApi';

const EMPTY_FORM = { title: '', year: '', description: '', imageUrl: '', order: 0 };

const AchievementsTab = () => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'achievements'), orderBy('order', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setAchievements(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin achievements:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!formData.title) {
      alert("Please enter the achievement title before uploading the image.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const folder = `achievements/${formData.title.trim().replace(/\s+/g, '-')}`;
      const { ok, data: uploadedImage } = await uploadFile(file, folder);
      if (ok && uploadedImage.secure_url) {
        setFormData(prev => ({ ...prev, imageUrl: uploadedImage.secure_url }));
      } else {
        alert(uploadedImage.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input to allow re-selecting same file
      }
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      title: item.title || '',
      year: item.year || '',
      description: item.description || '',
      imageUrl: item.images?.[0] || '',
      order: item.order || 0
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this achievement?")) {
      try {
        await deleteDoc(doc(db, 'achievements', item.id));
        for (const url of item.images || []) {
          await deleteCloudinaryImage(url);
        }
        await logAdminAction('DELETE', 'Achievement', `Deleted achievement: ${item.title}`);
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete. You might not have permission.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dataToSave = {
      title: formData.title,
      year: formData.year,
      description: formData.description,
      order: Number(formData.order),
      images: formData.imageUrl ? [formData.imageUrl] : []
    };

    try {
      if (editingId) {
        const oldItem = achievements.find(a => a.id === editingId);
        if (oldItem && oldItem.images && oldItem.images.length > 0) {
          const oldUrl = oldItem.images[0];
          if (oldUrl && oldUrl !== formData.imageUrl) {
            await deleteCloudinaryImage(oldUrl);
          }
        }
        await updateDoc(doc(db, 'achievements', editingId), dataToSave);
        await logAdminAction('UPDATE', 'Achievement', `Updated achievement: ${dataToSave.title}`);
      } else {
        await addDoc(collection(db, 'achievements'), dataToSave);
        await logAdminAction('CREATE', 'Achievement', `Created achievement: ${dataToSave.title}`);
      }
      resetForm();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save achievement. You might not have permission.");
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>{editingId ? 'Edit Achievement' : 'Add New Achievement'}</h2>
          <form onSubmit={handleSubmit} className="admin-form">

            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="e.g. Aerothon 2024"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <input
                  type="text"
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. 2024"
                />
              </div>
              <div className="form-group">
                <label>Order</label>
                <input
                  type="number"
                  name="order"
                  value={formData.order}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Image (Optional)</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
              <div className="input-divider">or</div>
              <input
                type="text"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleInputChange}
                placeholder="Paste an image URL directly"
              />
              {formData.imageUrl && (
                <div className="image-preview achievement">
                  <img src={formData.imageUrl} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="4"
                placeholder="Detailed description of the achievement…"
              ></textarea>
            </div>

            <div className="form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="admin-btn cancel">
                  Cancel
                </button>
              )}
              <button type="submit" className="admin-btn primary">
                {editingId ? 'Update Achievement' : 'Add Achievement'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Achievements</h2>
          <div className="achievements-list">
            {achievements.map((item) => (
              <div key={item.id} className="admin-achievement-card">
                <div className="card-info">
                  <h3>{item.title} <span className="year">({item.year})</span></h3>
                  <span className="order-badge">Order: {item.order}</span>
                  <p className="card-desc">{item.description}</p>
                </div>
                <div className="card-actions">
                  <button onClick={() => handleEdit(item)} className="admin-btn edit small">Edit</button>
                  <button onClick={() => handleDelete(item)} className="admin-btn delete small">Delete</button>
                </div>
              </div>
            ))}
            {!loading && achievements.length === 0 && <p className="empty-state">No achievements yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementsTab;
