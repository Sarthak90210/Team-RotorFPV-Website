import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile, deleteCloudinaryImage } from '../../lib/adminApi';

const formatBoardYear = (year) => {
  if (typeof year === 'string' && year.length === 4 && !isNaN(parseInt(year))) {
    return `${year}-${parseInt(year) + 1}`;
  }
  return year;
};

const EMPTY_MEMBER_FORM = {
  name: '',
  role: '',
  jobTitle: '',
  image: '',
  linkedin: '',
  github: '',
  category: 'leaders',
  order: 0,
  isActive: true
};

const TeamTab = () => {
  const [teamYears, setTeamYears] = useState([]);
  const [teamYearsData, setTeamYearsData] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamYear, setSelectedTeamYear] = useState('');
  const [newTeamYear, setNewTeamYear] = useState('');
  const [editingTeamMemberId, setEditingTeamMemberId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [teamMemberFormData, setTeamMemberFormData] = useState(EMPTY_MEMBER_FORM);
  const teamMemberFileInputRef = useRef(null);
  const seniorCoreFileInputRef = useRef(null);

  useEffect(() => {
    const qTeamYears = query(collection(db, 'team_years'), orderBy('year', 'desc'));
    const unsubYears = onSnapshot(qTeamYears, (snapshot) => {
      const dataStrings = snapshot.docs.map(d => d.data().year);
      const dataObjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeamYears(dataStrings);
      setTeamYearsData(dataObjects);
      if (dataStrings.length > 0) {
        setSelectedTeamYear(prev => prev || dataStrings[0]);
      }
    }, (error) => {
      console.error("Error fetching team years:", error);
    });

    const qTeamMembers = query(collection(db, 'team_members'), orderBy('order', 'asc'));
    const unsubMembers = onSnapshot(qTeamMembers, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const member = d.data();
        if (member.category === 'miscellaneous') member.category = 'essential';
        return { id: d.id, ...member };
      });
      setTeamMembers(data);
    }, (error) => {
      console.error("Error fetching team members:", error);
    });

    return () => {
      unsubYears();
      unsubMembers();
    };
  }, []);

  const handleAddYear = async (e) => {
    e.preventDefault();
    const year = newTeamYear.trim();
    if (!year) return;
    // Year becomes the Firestore document ID, so enforce a strict 4-digit
    // format (e.g. "2025") — rejects free-text that would create junk doc IDs.
    if (!/^\d{4}$/.test(year)) {
      alert('Enter a valid 4-digit year, e.g. 2025.');
      return;
    }
    try {
      await setDoc(doc(db, 'team_years', year), {
        year,
        createdAt: serverTimestamp()
      });
      setNewTeamYear('');
      setSelectedTeamYear(year);
    } catch (error) {
      console.error("Add Year Error:", error);
      alert("Failed to add year. " + error.message);
    }
  };

  const handleDeleteYear = async (year) => {
    if (window.confirm(`Are you sure you want to delete the year ${year}? This does NOT delete the members in this year automatically.`)) {
      try {
        await deleteDoc(doc(db, 'team_years', year));
        if (selectedTeamYear === year) {
          setSelectedTeamYear(teamYears.filter(y => y !== year)[0] || '');
        }
      } catch (error) {
        console.error("Delete Year Error:", error);
        alert("Failed to delete year.");
      }
    }
  };

  const handleTeamMemberInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTeamMemberFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const resetTeamMemberForm = () => {
    setTeamMemberFormData(EMPTY_MEMBER_FORM);
    setEditingTeamMemberId(null);
  };

  const handleTeamMemberEdit = (item) => {
    setEditingTeamMemberId(item.id);
    setTeamMemberFormData({
      name: item.name || '',
      role: item.role || '',
      jobTitle: item.jobTitle || '',
      image: item.image || '',
      linkedin: item.linkedin || '',
      github: item.github || '',
      category: item.category || 'leaders',
      order: item.order || 0,
      isActive: item.isActive !== false // default to true if undefined
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTeamMemberDelete = async (member) => {
    if (window.confirm("Are you sure you want to delete this team member?")) {
      try {
        await deleteDoc(doc(db, 'team_members', member.id));
        await deleteCloudinaryImage(member.image);
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete team member.");
      }
    }
  };

  const handleTeamMemberSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamYear) {
      alert("Please select a year first.");
      return;
    }
    const dataToSave = {
      year: selectedTeamYear,
      name: teamMemberFormData.name,
      role: teamMemberFormData.role,
      jobTitle: teamMemberFormData.jobTitle,
      image: teamMemberFormData.image,
      linkedin: teamMemberFormData.linkedin,
      github: teamMemberFormData.github,
      category: teamMemberFormData.category,
      order: Number(teamMemberFormData.order),
      isActive: teamMemberFormData.isActive,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingTeamMemberId) {
        const oldItem = teamMembers.find(t => t.id === editingTeamMemberId);
        if (oldItem && oldItem.image && oldItem.image !== teamMemberFormData.image) {
          await deleteCloudinaryImage(oldItem.image);
        }
        await updateDoc(doc(db, 'team_members', editingTeamMemberId), dataToSave);
      } else {
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, 'team_members'), dataToSave);
      }
      resetTeamMemberForm();
    } catch (error) {
      console.error("Save Error:", error);
      alert("Failed to save team member.");
    }
  };

  const handleSeniorCoreUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedTeamYear) return;

    setIsUploading(true);
    try {
      const { ok, data: uploadedImage } = await uploadFile(file, "board/senior-core");
      if (ok && uploadedImage.secure_url) {
        const yearDoc = teamYearsData.find(y => y.year === selectedTeamYear);
        if (yearDoc && yearDoc.seniorCorePhoto) {
          await deleteCloudinaryImage(yearDoc.seniorCorePhoto);
        }
        await setDoc(doc(db, 'team_years', selectedTeamYear), {
          seniorCorePhoto: uploadedImage.secure_url,
          updatedAt: serverTimestamp()
        }, { merge: true });
        alert("Senior Core Photo uploaded successfully!");
      } else {
        alert(uploadedImage.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (seniorCoreFileInputRef.current) seniorCoreFileInputRef.current.value = '';
    }
  };

  const handleDeleteSeniorCore = async () => {
    if (!selectedTeamYear) return;
    const yearDoc = teamYearsData.find(y => y.year === selectedTeamYear);
    if (!yearDoc || !yearDoc.seniorCorePhoto) return;

    if (window.confirm("Are you sure you want to delete the Senior Core photo for this year?")) {
      try {
        await deleteCloudinaryImage(yearDoc.seniorCorePhoto);
        await updateDoc(doc(db, 'team_years', selectedTeamYear), {
          seniorCorePhoto: null
        });
        alert("Senior Core Photo deleted.");
      } catch (error) {
        console.error("Delete Error:", error);
        alert("Failed to delete photo.");
      }
    }
  };

  const handleTeamMemberImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!teamMemberFormData.name) {
      alert("Please enter the team member's name before uploading their photo.");
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const folder = `board/${teamMemberFormData.name.trim().replace(/\s+/g, '-')}`;
      const { ok, data: uploadedImage } = await uploadFile(file, folder);
      if (ok && uploadedImage.secure_url) {
        setTeamMemberFormData(prev => ({ ...prev, image: uploadedImage.secure_url }));
      } else {
        alert(uploadedImage.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (teamMemberFileInputRef.current) teamMemberFileInputRef.current.value = '';
    }
  };

  const selectedYearDoc = teamYearsData.find(y => y.year === selectedTeamYear);

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Manage Years</h2>
          <form onSubmit={handleAddYear} className="admin-form inline-form">
            <input
              type="text"
              value={newTeamYear}
              onChange={(e) => setNewTeamYear(e.target.value)}
              placeholder="e.g. 2026 or 2026-2027"
              required
            />
            <button type="submit" className="admin-btn primary small">Add Year</button>
          </form>
          <div className="year-pills">
            {teamYears.map(year => (
              <div key={year} className={`year-pill ${selectedTeamYear === year ? 'active' : ''}`}>
                <span onClick={() => { setSelectedTeamYear(year); resetTeamMemberForm(); }}>{formatBoardYear(year)}</span>
                <button onClick={() => handleDeleteYear(year)} className="delete-year-btn">×</button>
              </div>
            ))}
            {teamYears.length === 0 && <span className="empty-text">No years created yet.</span>}
          </div>
        </div>

        {selectedTeamYear && (
          <>
            <div className="admin-glass-panel form-panel">
              <h2>Senior Core Photo ({formatBoardYear(selectedTeamYear)})</h2>
              {selectedYearDoc?.seniorCorePhoto ? (
                <div className="image-preview achievement">
                  <img src={selectedYearDoc.seniorCorePhoto} alt="Senior Core" />
                  <div className="stack-sm">
                    <button type="button" onClick={handleDeleteSeniorCore} className="admin-btn delete small">Delete Photo</button>
                  </div>
                </div>
              ) : (
                <p className="empty-text">No Senior Core photo uploaded for this year.</p>
              )}
              <div className="form-group stack-md">
                <label>Upload New Photo</label>
                <div className="file-upload">
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    ref={seniorCoreFileInputRef}
                    onChange={handleSeniorCoreUpload}
                    disabled={isUploading}
                  />
                  {isUploading && <span className="upload-status">Uploading…</span>}
                </div>
              </div>
            </div>

            <div className="admin-glass-panel form-panel">
              <h2>{editingTeamMemberId ? `Edit Member (${formatBoardYear(selectedTeamYear)})` : `Add Member (${formatBoardYear(selectedTeamYear)})`}</h2>
              <form onSubmit={handleTeamMemberSubmit} className="admin-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={teamMemberFormData.name}
                      onChange={handleTeamMemberInputChange}
                      required
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      name="category"
                      value={teamMemberFormData.category}
                      onChange={handleTeamMemberInputChange}
                      required
                    >
                      <option value="leaders">Leaders</option>
                      <option value="technical">Technical</option>
                      <option value="essential">Essential</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <input
                      type="text"
                      name="role"
                      value={teamMemberFormData.role}
                      onChange={handleTeamMemberInputChange}
                      required
                      placeholder="e.g. CAPTAIN"
                    />
                  </div>
                  <div className="form-group">
                    <label>Order</label>
                    <input
                      type="number"
                      name="order"
                      value={teamMemberFormData.order}
                      onChange={handleTeamMemberInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Job Title (optional)</label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={teamMemberFormData.jobTitle}
                    onChange={handleTeamMemberInputChange}
                    placeholder="e.g. Working at Honda"
                  />
                </div>

                <div className="form-group">
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    name="linkedin"
                    value={teamMemberFormData.linkedin}
                    onChange={handleTeamMemberInputChange}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>

                <div className="form-group">
                  <label>GitHub URL (optional)</label>
                  <input
                    type="url"
                    name="github"
                    value={teamMemberFormData.github}
                    onChange={handleTeamMemberInputChange}
                    placeholder="https://github.com/..."
                  />
                </div>

                <div className="form-group">
                  <label>Image</label>
                  <div className="file-upload">
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      ref={teamMemberFileInputRef}
                      onChange={handleTeamMemberImageUpload}
                      disabled={isUploading}
                    />
                    {isUploading && <span className="upload-status">Uploading…</span>}
                  </div>
                  <div className="input-divider">or</div>
                  <input
                    type="text"
                    name="image"
                    value={teamMemberFormData.image}
                    onChange={handleTeamMemberInputChange}
                    placeholder="Paste an image URL directly"
                    required
                  />
                  {teamMemberFormData.image && (
                    <div className="image-preview achievement">
                      <img src={teamMemberFormData.image} alt="Preview" />
                    </div>
                  )}
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={teamMemberFormData.isActive}
                      onChange={handleTeamMemberInputChange}
                    />
                    Active (visible on website)
                  </label>
                </div>

                <div className="form-actions">
                  {editingTeamMemberId && (
                    <button type="button" onClick={resetTeamMemberForm} className="admin-btn cancel">
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="admin-btn primary">
                    {editingTeamMemberId ? 'Update Member' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Members in {selectedTeamYear ? formatBoardYear(selectedTeamYear) : '...'}</h2>
          {['leaders', 'technical', 'essential'].map(category => {
            const categoryMembers = teamMembers.filter(m => m.year === selectedTeamYear && m.category === category);
            if (categoryMembers.length === 0) return null;

            return (
              <div key={category} className="team-category-section">
                <h3 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                <div className="achievements-list">
                  {categoryMembers.map(member => (
                    <div key={member.id} className={`admin-achievement-card ${!member.isActive ? 'inactive-member' : ''}`}>
                      <div className="card-info">
                        <h3>{member.name} <span className={`status-badge ${member.isActive ? 'active' : 'inactive'}`}>{member.isActive ? 'Active' : 'Inactive'}</span></h3>
                        <span className="order-badge">Role: {member.role} | Order: {member.order}</span>
                      </div>
                      <div className="card-actions">
                        <button onClick={() => handleTeamMemberEdit(member)} className="admin-btn edit small">Edit</button>
                        <button onClick={() => handleTeamMemberDelete(member)} className="admin-btn delete small">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {selectedTeamYear && teamMembers.filter(m => m.year === selectedTeamYear).length === 0 && (
            <p className="empty-state">No members found for this year.</p>
          )}
          {!selectedTeamYear && (
            <p className="empty-state">Select a year to view members.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamTab;
