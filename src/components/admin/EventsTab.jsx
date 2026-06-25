import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage, moveCloudinaryImage } from '../../lib/adminApi';

const EMPTY_EVENT_FORM = {
  name: '',
  description: '',
  longDescription: '',
  image: '',
  galleryImages: [],
  status: 'upcoming',
  order: 0,
  isActive: true
};

const EventsTab = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [eventFormData, setEventFormData] = useState(EMPTY_EVENT_FORM);
  const eventFileInputRef = useRef(null);
  const galleryFileInputRef = useRef(null);

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleEventInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEventFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEventImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!eventFormData.name) {
      alert("Please enter the event name before uploading its image.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      // Mirror the rest of the app's Cloudinary layout, with an extra
      // status sub-folder: events/<upcoming|past>/<event-name>
      const safeName = eventFormData.name.trim().replace(/\s+/g, '-');
      const folder = `events/${eventFormData.status}/${safeName}`;
      const { ok, data: uploadedImage } = await uploadFile(file, folder);
      if (ok && uploadedImage.secure_url) {
        setEventFormData(prev => ({ ...prev, image: uploadedImage.secure_url }));
      } else {
        alert(uploadedImage.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (eventFileInputRef.current) eventFileInputRef.current.value = '';
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!eventFormData.name) {
      alert("Please enter the event name before uploading gallery images.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const safeName = eventFormData.name.trim().replace(/\s+/g, '-');
      const folder = `events/${eventFormData.status}/${safeName}/gallery`;
      const uploadedUrls = [];
      for (const file of files) {
        const { ok, data } = await uploadFile(file, folder);
        if (ok && data.secure_url) {
          uploadedUrls.push(data.secure_url);
        } else {
          alert(data.error || `Failed to upload ${file.name}.`);
        }
      }
      if (uploadedUrls.length > 0) {
        setEventFormData(prev => ({ ...prev, galleryImages: [...(prev.galleryImages || []), ...uploadedUrls] }));
      }
    } catch (error) {
      console.error("Gallery upload error:", error);
      alert("Error uploading gallery images.");
    } finally {
      setIsUploading(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const handleRemoveGalleryImage = async (url) => {
    setEventFormData(prev => ({
      ...prev,
      galleryImages: (prev.galleryImages || []).filter(u => u !== url)
    }));
    await deleteCloudinaryImage(url);
  };

  const resetEventForm = () => {
    setEventFormData(EMPTY_EVENT_FORM);
    setEditingEventId(null);
  };

  const handleEventEdit = (item) => {
    setEditingEventId(item.id);
    setEventFormData({
      name: item.name || '',
      description: item.description || '',
      longDescription: item.longDescription || '',
      image: item.image || '',
      galleryImages: item.galleryImages || [],
      status: item.status || 'upcoming',
      order: item.order || 0,
      isActive: item.isActive !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      try {
        await deleteDoc(doc(db, 'events', item.id));
        await deleteCloudinaryImage(item.image);
        // Remove every gallery image from Cloudinary as well.
        for (const url of item.galleryImages || []) {
          await deleteCloudinaryImage(url);
        }
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete event.");
      }
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventFormData.name || !eventFormData.image) {
      alert("Name and Image are required.");
      return;
    }
    const dataToSave = {
      name: eventFormData.name,
      description: eventFormData.description,
      longDescription: eventFormData.longDescription,
      image: eventFormData.image,
      galleryImages: eventFormData.galleryImages || [],
      status: eventFormData.status,
      order: Number(eventFormData.order),
      isActive: eventFormData.isActive,
      updatedAt: serverTimestamp(),
      updatedBy: user.email
    };

    try {
      if (editingEventId) {
        const oldItem = events.find(s => s.id === editingEventId);
        const imageChanged = !oldItem || oldItem.image !== eventFormData.image;
        if (oldItem && oldItem.image && imageChanged) {
          // Image replaced — remove the old asset from Cloudinary.
          await deleteCloudinaryImage(oldItem.image);
        } else if (!imageChanged) {
          // Image kept — keep its Cloudinary folder in sync with the current
          // name/status (this is what physically moves the file when an event
          // is switched between Upcoming and Past). No-ops if already in place.
          const safeName = eventFormData.name.trim().replace(/\s+/g, '-');
          dataToSave.image = await moveCloudinaryImage(
            eventFormData.image,
            `events/${eventFormData.status}/${safeName}`
          );
        }
        await updateDoc(doc(db, 'events', editingEventId), dataToSave);
      } else {
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdBy = user.email;
        await addDoc(collection(db, 'events'), dataToSave);
      }
      resetEventForm();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save event.");
    }
  };

  const renderEventList = (status, title) => {
    const list = events.filter(ev => (ev.status || 'upcoming') === status);
    return (
      <div className="team-category-section">
        <h3 className="category-title">{title}</h3>
        <div className="achievements-list">
          {list.map((item) => (
            <div key={item.id} className={`admin-achievement-card ${!item.isActive ? 'inactive-member' : ''}`}>
              <div className="card-info">
                <h3>{item.name} <span className={`status-badge ${item.isActive ? 'active' : 'inactive'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></h3>
                <span className="order-badge">Order: {item.order}</span>
                {item.description && <p className="card-desc">{item.description}</p>}
              </div>
              <div className="card-actions">
                <button onClick={() => handleEventEdit(item)} className="admin-btn edit small">Edit</button>
                <button onClick={() => handleEventDelete(item)} className="admin-btn delete small">Delete</button>
              </div>
            </div>
          ))}
          {!loading && list.length === 0 && <p className="empty-state">No {title.toLowerCase()} yet.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>{editingEventId ? 'Edit Event' : 'Add New Event'}</h2>
          <form onSubmit={handleEventSubmit} className="admin-form">
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  value={eventFormData.name}
                  onChange={handleEventInputChange}
                  required
                  placeholder="e.g. VIT Gravitas Drone Race"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={eventFormData.status}
                  onChange={handleEventInputChange}
                  required
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Short Description (shown on the card)</label>
              <textarea
                name="description"
                value={eventFormData.description}
                onChange={handleEventInputChange}
                rows="3"
                placeholder="A short one-or-two line summary for the card…"
              ></textarea>
            </div>

            <div className="form-group">
              <label>Long Description (shown in the detail popup)</label>
              <textarea
                name="longDescription"
                value={eventFormData.longDescription}
                onChange={handleEventInputChange}
                rows="6"
                placeholder="The full event write-up. Use a blank line to separate paragraphs. Leave empty to reuse the short description."
              ></textarea>
            </div>

            <div className="form-group">
              <label>Order</label>
              <input
                type="number"
                name="order"
                value={eventFormData.order}
                onChange={handleEventInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Cover Image (shown on the card)</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  ref={eventFileInputRef}
                  onChange={handleEventImageUpload}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
              <div className="input-divider">or</div>
              <input
                type="text"
                name="image"
                value={eventFormData.image}
                onChange={handleEventInputChange}
                placeholder="Paste an image URL directly"
                required
              />
              {eventFormData.image && (
                <div className="image-preview achievement">
                  <img src={eventFormData.image} alt="Preview" />
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Gallery Images (shown in the detail popup — you can pick multiple)</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  multiple
                  ref={galleryFileInputRef}
                  onChange={handleGalleryUpload}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
              {eventFormData.galleryImages && eventFormData.galleryImages.length > 0 && (
                <div className="event-gallery-thumbs">
                  {eventFormData.galleryImages.map((url) => (
                    <div key={url} className="event-gallery-thumb">
                      <img src={url} alt="Gallery" />
                      <button
                        type="button"
                        className="event-gallery-remove"
                        onClick={() => handleRemoveGalleryImage(url)}
                        aria-label="Remove image"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={eventFormData.isActive}
                  onChange={handleEventInputChange}
                />
                Active (visible on website)
              </label>
            </div>

            <div className="form-actions">
              {editingEventId && (
                <button type="button" onClick={resetEventForm} className="admin-btn cancel">
                  Cancel
                </button>
              )}
              <button type="submit" className="admin-btn primary">
                {editingEventId ? 'Update Event' : 'Add Event'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Events</h2>
          {renderEventList('upcoming', 'Upcoming Events')}
          {renderEventList('past', 'Past Events')}
        </div>
      </div>
    </div>
  );
};

export default EventsTab;
