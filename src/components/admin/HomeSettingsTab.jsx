import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage } from '../../lib/adminApi';

const EMPTY_SETTINGS = {
  backgroundVideoUrl: '',
  backgroundVideoPublicId: '',
  updatedAt: null,
  updatedBy: ''
};

const HomeSettingsTab = ({ user }) => {
  const [homeSettings, setHomeSettings] = useState(EMPTY_SETTINGS);
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const homeVideoInputRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'home'), (docSnap) => {
      if (docSnap.exists()) {
        setHomeSettings(docSnap.data());
        setHomeVideoUrl(docSnap.data().backgroundVideoUrl || '');
      } else {
        setHomeSettings(EMPTY_SETTINGS);
        setHomeVideoUrl('');
      }
    }, (error) => {
      console.error("Error fetching home settings:", error);
    });
    return () => unsub();
  }, []);

  const handleHomeVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large! Maximum size is 20MB. Please compress your video before uploading.");
      return;
    }

    setIsUploading(true);
    try {
      const { ok, data: uploadedMedia } = await uploadFile(file, "home");
      if (ok && uploadedMedia.secure_url) {
        setHomeVideoUrl(uploadedMedia.secure_url);
      } else {
        alert(uploadedMedia.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload video.");
    } finally {
      setIsUploading(false);
      if (homeVideoInputRef.current) homeVideoInputRef.current.value = "";
    }
  };

  const handleHomeVideoSubmit = async (e) => {
    e.preventDefault();
    if (!homeVideoUrl) {
      alert("Please provide a video URL or upload a file.");
      return;
    }
    try {
      if (homeSettings && homeSettings.backgroundVideoUrl && homeSettings.backgroundVideoUrl !== homeVideoUrl) {
        await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
      }

      await setDoc(doc(db, 'settings', 'home'), {
        backgroundVideoUrl: homeVideoUrl,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      alert("Home background video updated successfully!");
    } catch (error) {
      console.error("Error updating home video:", error);
      alert("Failed to update background video.");
    }
  };

  const handleRevertHomeVideo = async () => {
    if (!window.confirm("Are you sure you want to remove the custom background video and revert to the default?")) return;
    try {
      if (homeSettings && homeSettings.backgroundVideoUrl) {
        await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
      }
      await setDoc(doc(db, 'settings', 'home'), {
        backgroundVideoUrl: '',
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });
      setHomeVideoUrl('');
      if (homeVideoInputRef.current) homeVideoInputRef.current.value = '';
      alert("Reverted to default background video.");
    } catch (error) {
      console.error("Error reverting home video:", error);
      alert("Failed to revert video.");
    }
  };

  return (
    <div className="admin-single">
      <div className="admin-glass-panel form-panel">
        <h2>Home Page Settings</h2>

        <div className="settings-section">
          <h3 className="admin-subhead">Background Video</h3>
          <p className="field-hint">
            This video plays in the background of the main home page.
            Recommended size: &lt; 10MB. Maximum size: 20MB.
          </p>

          <form onSubmit={handleHomeVideoSubmit} className="admin-form">
            <div className="form-group">
              <label>Upload New Video</label>
              <div className="file-upload">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleHomeVideoUpload}
                  ref={homeVideoInputRef}
                  disabled={isUploading}
                />
                {isUploading && <span className="upload-status">Uploading…</span>}
              </div>
            </div>

            <div className="input-divider">or</div>

            <div className="form-group">
              <label>Video URL (Cloudinary)</label>
              <input
                type="text"
                value={homeVideoUrl}
                onChange={(e) => setHomeVideoUrl(e.target.value)}
                placeholder="Paste a direct video URL"
              />
            </div>

            <p className="field-hint stack-md">
              Preview ({homeVideoUrl ? 'Custom Video' : 'Default Video'}):
            </p>
            <div className="video-preview">
              <video
                key={homeVideoUrl || '/TRFPV_Assets/Teamvideo.mp4'}
                src={homeVideoUrl || '/TRFPV_Assets/Teamvideo.mp4'}
                autoPlay
                loop
                muted
                playsInline
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="admin-btn primary" disabled={isUploading || !homeVideoUrl}>
                Save Video Setting
              </button>
              {(homeSettings?.backgroundVideoUrl) && (
                <button type="button" onClick={handleRevertHomeVideo} className="admin-btn delete" disabled={isUploading}>
                  Revert to Default
                </button>
              )}
            </div>
          </form>

          {homeSettings?.updatedAt && (
            <p className="field-hint stack-md">
              Last updated: {homeSettings.updatedAt.toDate ? homeSettings.updatedAt.toDate().toLocaleString() : 'Recently'}
              {homeSettings.updatedBy && ` by ${homeSettings.updatedBy}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeSettingsTab;
