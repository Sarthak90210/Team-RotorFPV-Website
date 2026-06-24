import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage } from '../../lib/adminApi';

const EMPTY_FORM = { imgUrl: '', order: 0, originalWidth: null, originalHeight: null };

const getImageDimensions = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const GalleryTab = () => {
  const [galleryItems, setGalleryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [galleryHeroUrl, setGalleryHeroUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingHero, setIsUploadingHero] = useState(false);
  const [editingGalleryId, setEditingGalleryId] = useState(null);
  const [galleryFormData, setGalleryFormData] = useState(EMPTY_FORM);
  const galleryFileInputRef = useRef(null);
  const heroFileInputRef = useRef(null);

  useEffect(() => {
    const qGallery = query(collection(db, 'gallery'), orderBy('order', 'desc'));
    const unsubGallery = onSnapshot(qGallery, (snapshot) => {
      setGalleryItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin gallery:", error);
      setLoading(false);
    });

    const unsubHero = onSnapshot(doc(db, 'settings', 'gallery'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().heroImageUrl) {
        setGalleryHeroUrl(docSnap.data().heroImageUrl);
      }
    });

    return () => {
      unsubGallery();
      unsubHero();
    };
  }, []);

  const handleHeroImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingHero(true);
    try {
      const { ok, data: uploadedImage } = await uploadFile(file, "gallery");
      if (ok && uploadedImage.secure_url) {
        if (galleryHeroUrl) {
          await deleteCloudinaryImage(galleryHeroUrl);
        }
        await setDoc(doc(db, 'settings', 'gallery'), { heroImageUrl: uploadedImage.secure_url }, { merge: true });
        alert("Gallery Hero Image updated successfully!");
      } else {
        alert(uploadedImage.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploadingHero(false);
      if (heroFileInputRef.current) heroFileInputRef.current.value = '';
    }
  };

  const handleGalleryInputChange = (e) => {
    const { name, value } = e.target;
    setGalleryFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGalleryImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsUploading(true);

    try {
      for (const file of files) {
        const { ok, data: uploadedImage } = await uploadFile(file, "gallery");

        if (ok && uploadedImage.secure_url) {
          if (files.length > 1) {
            // If multiple files, auto-add them because the form can only hold one
            await addDoc(collection(db, 'gallery'), {
              img: uploadedImage.secure_url,
              order: Number(galleryFormData.order),
              originalWidth: uploadedImage.width || 600,
              originalHeight: uploadedImage.height || 400,
              url: ""
            });
          } else {
            // For a single file, just populate the form so the user can submit manually
            setGalleryFormData(prev => ({
              ...prev,
              imgUrl: uploadedImage.secure_url,
              originalWidth: uploadedImage.width,
              originalHeight: uploadedImage.height
            }));
          }
        } else {
          alert(`Upload failed for ${file.name}: ${uploadedImage.error || "Please try again."}`);
        }
      }

      if (files.length > 1) {
        alert(`Successfully uploaded ${files.length} images!`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image(s).");
    } finally {
      setIsUploading(false);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = ''; // Reset input
      }
    }
  };

  const resetGalleryForm = () => {
    setGalleryFormData(EMPTY_FORM);
    setEditingGalleryId(null);
  };

  const handleGalleryEdit = (item) => {
    setEditingGalleryId(item.id);
    setGalleryFormData({
      imgUrl: item.img || '',
      order: item.order || 0,
      originalWidth: item.originalWidth || null,
      originalHeight: item.originalHeight || null
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGalleryDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this gallery image?")) {
      try {
        await deleteDoc(doc(db, 'gallery', item.id));
        await deleteCloudinaryImage(item.img);
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete. You might not have permission.");
      }
    }
  };

  const handleGallerySubmit = async (e) => {
    e.preventDefault();
    if (!galleryFormData.imgUrl) {
      alert("Please provide an image URL or upload an image.");
      return;
    }

    // Auto-detect dimensions if not already fetched
    let width = galleryFormData.originalWidth;
    let height = galleryFormData.originalHeight;

    if (!width || !height) {
      const dims = await getImageDimensions(galleryFormData.imgUrl);
      if (dims) {
        width = dims.width;
        height = dims.height;
      }
    }

    const dataToSave = {
      img: galleryFormData.imgUrl,
      order: Number(galleryFormData.order),
      originalWidth: width || 600,
      originalHeight: height || 400,
      url: ""
    };

    try {
      if (editingGalleryId) {
        const oldItem = galleryItems.find(g => g.id === editingGalleryId);
        if (oldItem && oldItem.img && oldItem.img !== galleryFormData.imgUrl) {
          await deleteCloudinaryImage(oldItem.img);
        }
        await updateDoc(doc(db, 'gallery', editingGalleryId), dataToSave);
      } else {
        await addDoc(collection(db, 'gallery'), dataToSave);
      }
      resetGalleryForm();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save gallery image. You might not have permission.");
    }
  };

  return (
    <>
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Gallery Scroll Animation Image</h2>
          <div className="hero-image-manager">
            <span className="field-label">Current Image</span>
            {galleryHeroUrl ? (
              <div className="image-preview hero block">
                <img src={galleryHeroUrl} alt="Gallery Hero" />
              </div>
            ) : (
              <div className="image-preview-placeholder">Using default image</div>
            )}

            <div className="hero-upload">
              <span className="field-label">Upload New Image</span>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={heroFileInputRef}
                  onChange={handleHeroImageUpload}
                  disabled={isUploadingHero}
                />
                {isUploadingHero && <span className="upload-status">Uploading…</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-glass-panel form-panel">
          <h2>{editingGalleryId ? 'Edit Gallery Image' : 'Add New Gallery Image'}</h2>
          <form onSubmit={handleGallerySubmit} className="admin-form">

            <div className="form-group">
              <label>Order (Higher numbers appear first)</label>
              <input
                type="number"
                name="order"
                value={galleryFormData.order}
                onChange={handleGalleryInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Image</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  ref={galleryFileInputRef}
                  onChange={handleGalleryImageUpload}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
              <p className="field-hint">Tip: select multiple files to upload them all at once.</p>
              <div className="input-divider">or</div>
              <input
                type="text"
                name="imgUrl"
                value={galleryFormData.imgUrl}
                onChange={handleGalleryInputChange}
                placeholder="Paste an image URL directly"
              />
              {galleryFormData.imgUrl && (
                <div className="image-preview gallery">
                  <img src={galleryFormData.imgUrl} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-actions">
              {editingGalleryId && (
                <button type="button" onClick={resetGalleryForm} className="admin-btn cancel">
                  Cancel
                </button>
              )}
              <button type="submit" className="admin-btn primary">
                {editingGalleryId ? 'Update Image' : 'Add Image'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Gallery</h2>
          <div className="achievements-list gallery-grid">
            {galleryItems.map((item) => (
              <div key={item.id} className="admin-achievement-card">
                <img src={item.img} alt="Gallery" className="card-thumb" />
                <div className="card-info">
                  <span className="order-badge">Order: {item.order}</span>
                  {item.originalWidth && item.originalHeight ? (
                    <p className="card-desc">{item.originalWidth} × {item.originalHeight}</p>
                  ) : (
                    <p className="card-desc">Legacy height: {item.height}px</p>
                  )}
                </div>
                <div className="card-actions">
                  <button onClick={() => handleGalleryEdit(item)} className="admin-btn edit small">Edit</button>
                  <button onClick={() => handleGalleryDelete(item)} className="admin-btn delete small">Delete</button>
                </div>
              </div>
            ))}
            {!loading && galleryItems.length === 0 && <p className="empty-state">No gallery images yet.</p>}
          </div>
        </div>
      </div>
    </>
  );
};

export default GalleryTab;
