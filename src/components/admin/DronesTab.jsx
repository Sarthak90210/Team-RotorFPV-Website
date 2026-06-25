import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage, uploadModel, deleteModel } from '../../lib/adminApi';

const EMPTY_DRONE_FORM = {
  name: '',
  description: '',
  image: '',
  modelUrl: '',
  modelPath: '',
  modelName: '',
  order: 0,
  isActive: true,
};

const DronesTab = ({ user }) => {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingModel, setIsUploadingModel] = useState(false);
  const [formData, setFormData] = useState(EMPTY_DRONE_FORM);
  const imageInputRef = useRef(null);
  const modelInputRef = useRef(null);

  useEffect(() => {
    const qDrones = query(collection(db, 'drones'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qDrones, (snapshot) => {
      setDrones(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching drones:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const safeName = () => formData.name.trim().replace(/\s+/g, '-');

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!formData.name) {
      alert('Please enter the drone name before uploading its image.');
      e.target.value = '';
      return;
    }
    setIsUploadingImage(true);
    try {
      const { ok, data } = await uploadFile(file, `drones/${safeName()}`);
      if (ok && data.secure_url) {
        setFormData((prev) => ({ ...prev, image: data.secure_url }));
      } else {
        alert(data.error || 'Image upload failed.');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Error uploading image.');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleModelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!formData.name) {
      alert('Please enter the drone name before uploading its model.');
      e.target.value = '';
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'glb' && ext !== 'gltf') {
      alert('Please upload a .glb or .gltf 3D model file.');
      e.target.value = '';
      return;
    }
    setIsUploadingModel(true);
    try {
      const { ok, data } = await uploadModel(file, `drones/${safeName()}`);
      if (ok && data.url) {
        setFormData((prev) => ({ ...prev, modelUrl: data.url, modelPath: data.path, modelName: file.name }));
      } else {
        alert(data.error || 'Model upload failed.');
      }
    } catch (error) {
      console.error('Model upload error:', error);
      alert('Error uploading model.');
    } finally {
      setIsUploadingModel(false);
      if (modelInputRef.current) modelInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_DRONE_FORM);
    setEditingId(null);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      image: item.image || '',
      modelUrl: item.modelUrl || '',
      modelPath: item.modelPath || '',
      modelName: item.modelName || '',
      order: item.order || 0,
      isActive: item.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? This removes its image and 3D model too.`)) return;
    try {
      await deleteDoc(doc(db, 'drones', item.id));
      await deleteCloudinaryImage(item.image);
      await deleteModel(item.modelPath);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete drone.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.image || !formData.modelUrl) {
      alert('Name, card image, and 3D model are all required.');
      return;
    }
    const dataToSave = {
      name: formData.name,
      description: formData.description,
      image: formData.image,
      modelUrl: formData.modelUrl,
      modelPath: formData.modelPath,
      modelName: formData.modelName,
      order: Number(formData.order),
      isActive: formData.isActive,
      updatedAt: serverTimestamp(),
      updatedBy: user.email,
    };

    try {
      if (editingId) {
        const old = drones.find((d) => d.id === editingId);
        // Clean up replaced assets.
        if (old?.image && old.image !== formData.image) await deleteCloudinaryImage(old.image);
        if (old?.modelPath && old.modelPath !== formData.modelPath) await deleteModel(old.modelPath);
        await updateDoc(doc(db, 'drones', editingId), dataToSave);
      } else {
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdBy = user.email;
        await addDoc(collection(db, 'drones'), dataToSave);
      }
      resetForm();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save drone.');
    }
  };

  const busy = isUploadingImage || isUploadingModel;

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>{editingId ? 'Edit Drone' : 'Add New Drone'}</h2>
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g. Swaayatt"
              />
            </div>

            <div className="form-group">
              <label>Description (shown on the card)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                placeholder="A short one-or-two line summary for the card…"
              ></textarea>
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

            <div className="form-group">
              <label>Card Image</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  disabled={busy}
                />
                {isUploadingImage && <span className="upload-status">Uploading…</span>}
              </div>
              <div className="input-divider">or</div>
              <input
                type="text"
                name="image"
                value={formData.image}
                onChange={handleInputChange}
                placeholder="Paste an image URL directly"
              />
              {formData.image && (
                <div className="image-preview achievement">
                  <img src={formData.image} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>3D Model (.glb / .gltf — up to 50 MB)</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
                  ref={modelInputRef}
                  onChange={handleModelUpload}
                  disabled={busy}
                />
                {isUploadingModel && <span className="upload-status">Uploading model…</span>}
              </div>
              {formData.modelUrl && (
                <p className="card-desc" style={{ marginTop: 8 }}>
                  ✓ Model uploaded{formData.modelName ? `: ${formData.modelName}` : ''}
                </p>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Active (visible on website)
              </label>
            </div>

            <div className="form-actions">
              {editingId && (
                <button type="button" onClick={resetForm} className="admin-btn cancel">
                  Cancel
                </button>
              )}
              <button type="submit" className="admin-btn primary" disabled={busy}>
                {editingId ? 'Update Drone' : 'Add Drone'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Drones</h2>
          <div className="achievements-list">
            {drones.map((item) => (
              <div key={item.id} className={`admin-achievement-card ${!item.isActive ? 'inactive-member' : ''}`}>
                <div className="card-info">
                  <h3>
                    {item.name}{' '}
                    <span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </h3>
                  <span className="order-badge">Order: {item.order}</span>
                  {item.description && <p className="card-desc">{item.description}</p>}
                  <p className="card-desc">{item.modelUrl ? '✓ 3D model attached' : '⚠ No model'}</p>
                </div>
                <div className="card-actions">
                  <button onClick={() => handleEdit(item)} className="admin-btn edit small">Edit</button>
                  <button onClick={() => handleDelete(item)} className="admin-btn delete small">Delete</button>
                </div>
              </div>
            ))}
            {!loading && drones.length === 0 && <p className="empty-state">No drones yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DronesTab;
