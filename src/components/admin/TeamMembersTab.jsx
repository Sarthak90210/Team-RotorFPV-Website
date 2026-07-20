import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAdminAction, fetchAdmins, apiPost, uploadFile, syncUserPermissions } from '../../lib/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import TagsTab from './TagsTab';
import CustomFieldsTab from './CustomFieldsTab';
import PillNav from '../PillNav';

const TeamMembersTab = ({ user }) => {
  const [subTab, setSubTab] = useState('members');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [admins, setAdmins] = useState([]); 
  
  const [editingEmail, setEditingEmail] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roomNumber: '',
    jobTitle: '',
    linkedin: '',
    github: '',
    image: '',
    tags: [],
    customFields: {}
  });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  const refreshAdmins = async () => {
    try {
      setAdmins(await fetchAdmins());
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const unsubFields = onSnapshot(query(collection(db, 'custom_fields'), orderBy('name', 'asc')), (snap) => {
      setCustomFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubTags = onSnapshot(query(collection(db, 'tags'), orderBy('name', 'asc')), (snap) => {
      setTags(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    refreshAdmins();

    return () => {
      unsubFields();
      unsubTags();
      unsubUsers();
    };
  }, []);

  const handleStartAdd = () => {
    setEditingEmail('__new__');
    setFormData({ name: '', email: '', roomNumber: '', jobTitle: '', linkedin: '', github: '', image: '', tags: [], customFields: {} });
  };

  const handleStartEdit = (usr) => {
    setEditingEmail(usr.email);
    setFormData({
      name: usr.name || '',
      email: usr.email || '',
      roomNumber: usr.roomNumber || '',
      jobTitle: usr.jobTitle || '',
      linkedin: usr.linkedin || '',
      github: usr.github || '',
      image: usr.image || '',
      tags: usr.tags || [],
      customFields: usr.customFields || {}
    });
  };

  const handleCancelEdit = () => {
    setEditingEmail(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    try {
      const email = formData.email.trim().toLowerCase();
      
      const payload = {
        email,
        name: formData.name.trim(),
        roomNumber: formData.roomNumber.trim(),
        jobTitle: formData.jobTitle?.trim() || '',
        linkedin: formData.linkedin?.trim() || '',
        github: formData.github?.trim() || '',
        image: formData.image?.trim() || '',
        tags: expandTagIds(formData.tags, tags),
        customFields: formData.customFields,
      };

      const isNew = editingEmail === '__new__';
      
      await setDoc(doc(db, 'users', email), payload, { merge: true });
      await syncUserPermissions(email, payload.tags, tags, admins);
      await refreshAdmins();
      
      if (isNew) {
        await logAdminAction('team_member_created', 'system', `Created team member: ${email}`);
      } else {
        await logAdminAction('team_member_updated', 'system', `Updated team member: ${email}`);
      }

      setEditingEmail(null);
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Failed to save user");
    }
  };

  const handleDelete = async (email) => {
    if (email === user.email) {
      alert("You cannot delete your own profile.");
      return;
    }
    const currentAdminRec = admins.find(a => a.email === email);
    if (currentAdminRec?.isRoot) {
      alert("You cannot delete the Root Super Admin.");
      return;
    }

    if (!window.confirm(`Delete profile for ${email}? This will completely remove them and their permissions.`)) return;
    try {
      // Instead of hard deleting, we just remove permissions and mark inactive if they might be on a board.
      // We'll soft-delete by un-tagging and adding an archived flag.
      await syncUserPermissions(email, [], tags, admins);
      await setDoc(doc(db, 'users', email), { isActive: false, isArchived: true, tags: [] }, { merge: true });
      await logAdminAction('team_member_archived', 'system', `Archived team member: ${email}`);
    } catch (error) {
      console.error("Error archiving user:", error);
      alert("Failed to archive user");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folder = `users/${formData.email || 'new'}`;
      const { ok, data: uploadedImage } = await uploadFile(file, folder);
      if (ok && uploadedImage.secure_url) {
        setFormData(prev => ({ ...prev, image: uploadedImage.secure_url }));
      } else {
        alert(uploadedImage.error || "Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => {
      const current = prev.tags || [];
      if (current.includes(tagId)) {
        return { ...prev, tags: current.filter(id => id !== tagId) };
      } else {
        const tag = tags.find(t => t.id === tagId);
        const granted = getGrantedTagIds(tag, tags);
        const toAdd = [tagId, ...granted].filter(id => !current.includes(id));
        return { ...prev, tags: [...current, ...toAdd] };
      }
    });
  };

  const handleCustomFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [fieldId]: value
      }
    }));
  };

  // Check roles from adminApi
  const getRoleBadges = (email) => {
    const adminRec = admins.find(a => a.email === email);
    if (!adminRec) return null;
    return (
      <>
        {adminRec.isRoot && <span className="role-badge root">Root</span>}
      </>
    );
  };

  if (subTab === 'tags') {
    return (
      <div style={{ marginTop: '-1rem' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button className={`admin-btn ${subTab === 'members' ? 'primary' : 'secondary'}`} onClick={() => setSubTab('members')}>Back to Members</button>
        </div>
        <TagsTab user={user} />
      </div>
    );
  }

  if (subTab === 'fields') {
    return (
      <div style={{ marginTop: '-1rem' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button className={`admin-btn ${subTab === 'members' ? 'primary' : 'secondary'}`} onClick={() => setSubTab('members')}>Back to Members</button>
        </div>
        <CustomFieldsTab user={user} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className={`admin-btn ${subTab === 'tags' ? 'primary' : 'secondary'}`} onClick={() => setSubTab('tags')}>Manage Tags & Permissions</button>
        <button className={`admin-btn ${subTab === 'fields' ? 'primary' : 'secondary'}`} onClick={() => setSubTab('fields')}>Manage Dynamic Fields</button>
      </div>
      
      <div className="admin-grid">
        <div className="admin-left-column">
        {editingEmail ? (
          <div className="admin-glass-panel form-panel">
            <h2>{editingEmail === '__new__' ? 'Create Team Member' : `Edit Member: ${editingEmail}`}</h2>
            <form onSubmit={handleSave} className="admin-form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  disabled={editingEmail !== '__new__'}
                  required
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Room Number</label>
                <input
                  type="text"
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                  placeholder="e.g. A-102"
                />
              </div>

              <div className="form-group">
                <label>Job Title / Current Status</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                  placeholder="e.g. Software Engineer at Google"
                />
              </div>

              <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>LinkedIn URL</label>
                  <input
                    type="url"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>GitHub URL</label>
                  <input
                    type="url"
                    value={formData.github}
                    onChange={(e) => setFormData({...formData, github: e.target.value})}
                    placeholder="https://github.com/..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Profile Image</label>
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
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData({...formData, image: e.target.value})}
                  placeholder="Paste an image URL directly"
                />
                {formData.image && (
                  <div className="image-preview achievement" style={{ marginTop: '10px' }}>
                    <img src={formData.image} alt="Profile Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>

              {customFields.length > 0 && (
                <>
                  <h3 style={{ fontSize: '0.95rem', margin: '20px 0 10px' }}>Dynamic Fields</h3>
                  {customFields.map(field => (
                    <div className="form-group" key={field.id}>
                      <label>{field.name}</label>
                      <input
                        type="text"
                        value={formData.customFields?.[field.id] || ''}
                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                      />
                    </div>
                  ))}
                </>
              )}

              {tags.length > 0 ? (
                <>
                  <h3 style={{ fontSize: '0.95rem', margin: '20px 0 10px' }}>Tags & Permissions</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {tags.map(tag => (
                      <label key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={(formData.tags || []).includes(tag.id)}
                          onChange={() => handleTagToggle(tag.id)}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '0.95rem', margin: '20px 0 10px' }}>Tags & Permissions</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No tags have been created yet. Click "Manage Tags & Permissions" at the top to create tags.</p>
                </>
              )}

              <div className="form-actions">
                <button type="submit" className="admin-btn primary">Save Member</button>
                <button type="button" onClick={handleCancelEdit} className="admin-btn secondary">Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="admin-glass-panel">
            <h2>Team Members</h2>
            <p className="panel-desc">Manage your entire team, their tags, and permissions. Assigning Admin/Super Admin tags will automatically sync their backend privileges.</p>
            <button onClick={handleStartAdd} className="admin-btn primary">Add New Team Member</button>
          </div>
        )}
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <div style={{ width: '100%', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center' }}>
            <label style={{ color: '#64ffda', fontWeight: 'bold' }}>Filter by Group:</label>
            <select 
              value={selectedTagFilter} 
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(100, 255, 218, 0.3)',
                background: 'rgba(10, 25, 47, 0.8)',
                color: '#e6f1ff',
                outline: 'none',
                minWidth: '200px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Members</option>
              {tags.filter(t => t.isGroup !== false).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="achievements-list">
            {(() => {
              // Merge users and admins so that existing admins without profiles are visible
              const mergedMembers = [...users];
              admins.forEach(admin => {
                if (!mergedMembers.find(u => u.email === admin.email)) {
                  mergedMembers.push({ email: admin.email, name: 'Incomplete Profile', isOrphanedAdmin: true, tags: [] });
                }
              });

              if (mergedMembers.length === 0) {
                return <p className="empty-state">No team members found.</p>;
              }

              const renderMemberCard = (usr) => (
                <div key={usr.email} className="admin-achievement-card admin-user-card" style={{ flexDirection: 'column', alignItems: 'flex-start', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <h3 style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {usr.image && <img src={usr.image} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                        {usr.name || 'Unnamed'} 
                        {usr.isArchived && <span className="role-badge" style={{ background: '#ff4d4f44', color: '#ff4d4f' }}>Archived</span>}
                      </h3>
                      {usr.isOrphanedAdmin && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--warning, #faad14)', marginTop: '4px' }}>
                          This admin doesn't have a full profile yet. Click Edit to create one.
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {getRoleBadges(usr.email)}
                        {(usr.tags || []).map(tid => {
                          const t = tags.find(x => x.id === tid);
                          return t ? <span key={tid} className="role-badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{t.name}</span> : null;
                        })}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handleStartEdit(usr)} className="admin-btn edit small">Edit</button>
                      <button onClick={() => handleDelete(usr.email)} className="admin-btn delete small">Delete</button>
                    </div>
                  </div>
                </div>
              );

              const groups = [];
              tags.forEach(tag => {
                // If filtering by a specific group, skip others
                if (selectedTagFilter !== 'all' && tag.id !== selectedTagFilter) return;

                const membersInTag = mergedMembers.filter(m => (m.tags || []).includes(tag.id));
                
                // Show the group if it has members OR if it was explicitly selected (even if empty)
                if (membersInTag.length > 0 || selectedTagFilter === tag.id) {
                  groups.push({ tag, members: membersInTag });
                }
              });

              // Only show untagged members in "All" view
              // A member is untagged if they have no tags, or all their tags are deleted
              const validTagIds = new Set(tags.map(t => t.id));
              const untaggedMembers = selectedTagFilter === 'all' 
                ? mergedMembers.filter(m => {
                    const validUserTags = (m.tags || []).filter(tid => validTagIds.has(tid));
                    return validUserTags.length === 0;
                  }) 
                : [];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                  {groups.map(group => (
                    <div key={group.tag.id}>
                      <h3 style={{ color: 'var(--accent)', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px' }}>
                        {group.tag.name}
                      </h3>
                      {group.members.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {group.members.map(usr => renderMemberCard(usr))}
                        </div>
                      ) : (
                        <p className="empty-state">No members in this group.</p>
                      )}
                    </div>
                  ))}
                  
                  {untaggedMembers.length > 0 && (
                    <div key="untagged">
                      <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px' }}>
                        Untagged Members
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {untaggedMembers.map(usr => renderMemberCard(usr))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default TeamMembersTab;
