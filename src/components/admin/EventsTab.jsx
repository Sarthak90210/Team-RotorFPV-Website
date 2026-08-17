import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import useEventNow from '../../hooks/useEventNow';
import { getEventGroups, isExternalEventUrl, validateEventSchedule } from '../../lib/eventSchedule';
import { deleteCloudinaryImage, logAdminAction, moveCloudinaryImage, uploadFile } from '../../lib/adminApi';

const EMPTY_EVENT_FORM = {
  name: '',
  description: '',
  longDescription: '',
  image: '',
  galleryImages: [],
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  ctaUrl: '',
  ctaLabel: 'register',
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
  const now = useEventNow();
  const groups = getEventGroups(events, now, { includeInactive: true });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      setEvents(snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() })));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching events:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEventInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEventFormData((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const eventFolder = () => `events/${eventFormData.name.trim().replace(/\s+/g, '-')}`;

  const uploadImages = async (files, isGallery) => {
    if (!eventFormData.name) {
      alert('Please enter the event name before uploading images.');
      return;
    }

    setIsUploading(true);
    try {
      const folder = isGallery ? `${eventFolder()}/gallery` : eventFolder();
      const uploadedUrls = [];
      for (const file of files) {
        const { ok, data } = await uploadFile(file, folder);
        if (ok && data.secure_url) uploadedUrls.push(data.secure_url);
        else alert(data.error || `Failed to upload ${file.name}.`);
      }
      if (isGallery) {
        setEventFormData((current) => ({ ...current, galleryImages: [...current.galleryImages, ...uploadedUrls] }));
      } else if (uploadedUrls[0]) {
        setEventFormData((current) => ({ ...current, image: uploadedUrls[0] }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading image.');
    } finally {
      setIsUploading(false);
      if (eventFileInputRef.current) eventFileInputRef.current.value = '';
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const resetEventForm = () => {
    setEventFormData(EMPTY_EVENT_FORM);
    setEditingEventId(null);
  };

  const handleEventEdit = (event) => {
    setEditingEventId(event.id);
    setEventFormData({
      name: event.name || '',
      description: event.description || '',
      longDescription: event.longDescription || '',
      image: event.image || '',
      galleryImages: event.galleryImages || [],
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      ctaUrl: event.ctaUrl || '',
      ctaLabel: event.ctaLabel || 'register',
      isActive: event.isActive !== false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEventDelete = async (event) => {
    if (!window.confirm(`Delete ${event.name}? This also removes its Cloudinary images.`)) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      await deleteCloudinaryImage(event.image);
      for (const url of event.galleryImages || []) await deleteCloudinaryImage(url);
      await logAdminAction('DELETE', 'Event', `Deleted event: ${event.name}`);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete event.');
    }
  };

  const handleRemoveGalleryImage = async (url) => {
    setEventFormData((current) => ({ ...current, galleryImages: current.galleryImages.filter((image) => image !== url) }));
    await deleteCloudinaryImage(url);
  };

  const handleEventSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!eventFormData.name || !eventFormData.image) {
      alert('Name and cover image are required.');
      return;
    }

    const data = { ...eventFormData };
    if (!data.endDate) {
      if (!window.confirm("Are you sure you don't want to have an end date? It will be a one-day event.")) return;
      data.endDate = data.startDate;
    }

    const scheduleError = validateEventSchedule(data);
    if (scheduleError) {
      alert(scheduleError);
      return;
    }
    if (data.ctaUrl && !isExternalEventUrl(data.ctaUrl)) {
      alert('Event links must begin with http:// or https://.');
      return;
    }

    const dataToSave = {
      ...data,
      ctaUrl: data.ctaUrl.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: user.email
    };

    try {
      if (editingEventId) {
        const oldEvent = events.find((event) => event.id === editingEventId);
        if (oldEvent?.image && oldEvent.image !== dataToSave.image) {
          await deleteCloudinaryImage(oldEvent.image);
        } else if (oldEvent?.image) {
          dataToSave.image = await moveCloudinaryImage(dataToSave.image, eventFolder());
        }
        await updateDoc(doc(db, 'events', editingEventId), dataToSave);
        await logAdminAction('UPDATE', 'Event', `Updated event: ${dataToSave.name}`);
      } else {
        dataToSave.createdAt = serverTimestamp();
        dataToSave.createdBy = user.email;
        await addDoc(collection(db, 'events'), dataToSave);
        await logAdminAction('CREATE', 'Event', `Created event: ${dataToSave.name}`);
      }
      resetEventForm();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save event.');
    }
  };

  const renderEventList = (eventsInGroup, title) => (
    <div className="team-category-section">
      <h3 className="category-title">{title}</h3>
      <div className="achievements-list">
        {eventsInGroup.map((event) => (
          <div key={event.id} className={`admin-achievement-card ${!event.isActive ? 'inactive-member' : ''}`}>
            <div className="card-info">
              <h3>{event.name} <span className={`status-badge ${event.isActive ? 'active' : 'inactive'}`}>{event.isActive ? 'Active' : 'Inactive'}</span></h3>
              <p className="card-desc">{event.startDate} to {event.endDate || event.startDate}</p>
              {event.description && <p className="card-desc">{event.description}</p>}
            </div>
            <div className="card-actions">
              <button onClick={() => handleEventEdit(event)} className="admin-btn edit small">Edit</button>
              <button onClick={() => handleEventDelete(event)} className="admin-btn delete small">Delete</button>
            </div>
          </div>
        ))}
        {!loading && eventsInGroup.length === 0 && <p className="empty-state">No {title.toLowerCase()} yet.</p>}
      </div>
    </div>
  );

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>{editingEventId ? 'Edit Event' : 'Add New Event'}</h2>
          <form onSubmit={handleEventSubmit} className="admin-form">
            <div className="form-row">
              <div className="form-group"><label>Name</label><input type="text" name="name" value={eventFormData.name} onChange={handleEventInputChange} required placeholder="e.g. VIT Gravitas Drone Race" /></div>
              <div className="form-group"><label>Start Date</label><input type="date" name="startDate" value={eventFormData.startDate} onChange={handleEventInputChange} required /></div>
              <div className="form-group"><label>End Date (optional)</label><input type="date" name="endDate" value={eventFormData.endDate} onChange={handleEventInputChange} min={eventFormData.startDate || undefined} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Start Time (optional)</label><input type="time" name="startTime" value={eventFormData.startTime} onChange={handleEventInputChange} /></div>
              <div className="form-group"><label>End Time (optional)</label><input type="time" name="endTime" value={eventFormData.endTime} onChange={handleEventInputChange} /></div>
            </div>
            <p className="form-hint">Leave both times blank for an all-day Event. If you add one time, you must add both. All dates and times use India time.</p>
            <div className="form-group"><label>Short Description (shown on the card)</label><textarea name="description" value={eventFormData.description} onChange={handleEventInputChange} rows="3" /></div>
            <div className="form-group"><label>Long Description (shown in the detail popup)</label><textarea name="longDescription" value={eventFormData.longDescription} onChange={handleEventInputChange} rows="6" placeholder="Use a blank line to separate paragraphs." /></div>
            <div className="form-row">
              <div className="form-group"><label>Event Link (optional)</label><input type="url" name="ctaUrl" value={eventFormData.ctaUrl} onChange={handleEventInputChange} placeholder="https://example.com/register" /></div>
              <div className="form-group"><label>Link label</label><select name="ctaLabel" value={eventFormData.ctaLabel} onChange={handleEventInputChange} disabled={!eventFormData.ctaUrl}><option value="register">Register</option><option value="explore">Explore</option></select></div>
            </div>
            <div className="form-group">
              <label>Cover Image (shown on the card)</label>
              <div className="file-upload"><input type="file" accept="image/*,.heic,.heif" ref={eventFileInputRef} onChange={(event) => uploadImages(Array.from(event.target.files || []), false)} disabled={isUploading} />{isUploading && <span className="upload-status">Uploading…</span>}</div>
              <div className="input-divider">or</div>
              <input type="text" name="image" value={eventFormData.image} onChange={handleEventInputChange} placeholder="Paste an image URL directly" required />
              {eventFormData.image && <div className="image-preview achievement"><img src={eventFormData.image} alt="Preview" /></div>}
            </div>
            <div className="form-group">
              <label>Gallery Images (shown in the detail popup — you can pick multiple)</label>
              <div className="file-upload"><input type="file" accept="image/*,.heic,.heif" multiple ref={galleryFileInputRef} onChange={(event) => uploadImages(Array.from(event.target.files || []), true)} disabled={isUploading} /></div>
              {eventFormData.galleryImages.length > 0 && <div className="event-gallery-thumbs">{eventFormData.galleryImages.map((url) => <div key={url} className="event-gallery-thumb"><img src={url} alt="Gallery" /><button type="button" className="event-gallery-remove" onClick={() => handleRemoveGalleryImage(url)} aria-label="Remove image">×</button></div>)}</div>}
            </div>
            <div className="form-group checkbox-group"><label><input type="checkbox" name="isActive" checked={eventFormData.isActive} onChange={handleEventInputChange} /> Active (visible on website)</label></div>
            <div className="form-actions">{editingEventId && <button type="button" onClick={resetEventForm} className="admin-btn cancel">Cancel</button>}<button type="submit" className="admin-btn primary">{editingEventId ? 'Update Event' : 'Add Event'}</button></div>
          </form>
        </div>
      </div>
      <div className="admin-right-column"><div className="admin-glass-panel list-panel"><h2>Current Events</h2>{renderEventList(groups.ongoing, 'Ongoing Events')}{renderEventList(groups.upcoming, 'Upcoming Events')}{renderEventList(groups.past, 'Past Events')}</div></div>
    </div>
  );
};

export default EventsTab;
