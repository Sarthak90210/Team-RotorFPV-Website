import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAdminAction, fetchAdmins, apiPost } from '../../lib/adminApi';
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
    tags: [],
    customFields: {}
  });

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
    setFormData({ name: '', email: '', roomNumber: '', tags: [], customFields: {} });
  };

  const handleStartEdit = (usr) => {
    setEditingEmail(usr.email);
    setFormData({
      name: usr.name || '',
      email: usr.email || '',
      roomNumber: usr.roomNumber || '',
      tags: usr.tags || [],
      customFields: usr.customFields || {}
    });
  };

  const handleCancelEdit = () => {
    setEditingEmail(null);
  };

  const syncPermissions = async (email, selectedTagIds) => {
    let targetIsAdmin = false;
    let targetIsSuperAdmin = false;

    // Calculate desired permissions from tags
    for (const tagId of selectedTagIds) {
      const tag = tags.find(t => t.id === tagId);
      if (tag?.grantsAdmin) targetIsAdmin = true;
      if (tag?.grantsSuperAdmin) {
        targetIsAdmin = true; // Super admin implies admin
        targetIsSuperAdmin = true;
      }
    }

    const currentAdminRec = admins.find(a => a.email === email);
    
    // Safety check: Never demote root through this UI
    if (currentAdminRec?.isRoot) {
      return;
    }

    const currentIsAdmin = !!currentAdminRec;
    const currentIsSuperAdmin = currentAdminRec?.isSuperAdmin || false;

    // Handle Admin Promotion/Demotion
    if (targetIsAdmin && !currentIsAdmin) {
      await apiPost('/api/setAdmin', { email });
    } else if (!targetIsAdmin && currentIsAdmin) {
      await apiPost('/api/removeAdmin', { email });
    }

    // Handle Super Admin Promotion/Demotion
    if (targetIsSuperAdmin && !currentIsSuperAdmin) {
      await apiPost('/api/setSuperAdmin', { email });
    } else if (!targetIsSuperAdmin && currentIsSuperAdmin) {
      await apiPost('/api/removeSuperAdmin', { email });
    }

    if (targetIsAdmin !== currentIsAdmin || targetIsSuperAdmin !== currentIsSuperAdmin) {
      await refreshAdmins();
    }
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
        tags: formData.tags,
        customFields: formData.customFields,
      };

      const isNew = editingEmail === '__new__';
      
      await setDoc(doc(db, 'users', email), payload, { merge: true });
      await syncPermissions(email, formData.tags);
      
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
      // Sync permissions with empty tags to remove admin rights
      await syncPermissions(email, []);
      await deleteDoc(doc(db, 'users', email));
      await logAdminAction('team_member_deleted', 'system', `Deleted team member: ${email}`);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => {
      const current = prev.tags || [];
      if (current.includes(tagId)) {
        return { ...prev, tags: current.filter(id => id !== tagId) };
      } else {
        return { ...prev, tags: [...current, tagId] };
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
          <div style={{ width: '100%', marginBottom: '20px' }}>
            <PillNav 
              items={[
                { key: 'all', label: 'All' },
                ...tags.filter(t => t.isGroup !== false).map(t => ({ key: t.id, label: t.name }))
              ]}
              activeKey={selectedTagFilter}
              onItemClick={setSelectedTagFilter}
            />
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
                        {usr.name || 'Unnamed'} 
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
              const untaggedMembers = selectedTagFilter === 'all' ? mergedMembers.filter(m => !(m.tags || []).length) : [];

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
