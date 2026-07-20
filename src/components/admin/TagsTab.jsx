import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAdminAction } from '../../lib/adminApi';

const TagsTab = ({ user }) => {
  const [tags, setTags] = useState([]);
  
  const [newTagName, setNewTagName] = useState('');
  const [newGrantsAdmin, setNewGrantsAdmin] = useState(false);
  const [newGrantsSuperAdmin, setNewGrantsSuperAdmin] = useState(false);
  const [newIsGroup, setNewIsGroup] = useState(true);
  const [newIsExMember, setNewIsExMember] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingGrantsAdmin, setEditingGrantsAdmin] = useState(false);
  const [editingGrantsSuperAdmin, setEditingGrantsSuperAdmin] = useState(false);
  const [editingIsGroup, setEditingIsGroup] = useState(true);
  const [editingIsExMember, setEditingIsExMember] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'tags'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTags(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      await addDoc(collection(db, 'tags'), { 
        name: newTagName.trim(),
        grantsAdmin: newGrantsAdmin,
        grantsSuperAdmin: newGrantsSuperAdmin,
        isGroup: newIsGroup,
        isExMember: newIsExMember
      });
      await logAdminAction('tag_created', 'system', `Created tag: ${newTagName.trim()}`);
      
      setNewTagName('');
      setNewGrantsAdmin(false);
      setNewGrantsSuperAdmin(false);
      setNewIsGroup(true);
      setNewIsExMember(false);
    } catch (error) {
      console.error("Error adding tag:", error);
      alert("Failed to add tag");
    }
  };

  const handleDeleteTag = async (id, name) => {
    if (!window.confirm(`Delete tag "${name}"? This will not remove the tag from existing users who already have it, but it will remove it from the available tags list.`)) return;
    
    try {
      await deleteDoc(doc(db, 'tags', id));
      await logAdminAction('tag_deleted', 'system', `Deleted tag: ${name}`);
    } catch (error) {
      console.error("Error deleting tag:", error);
      alert("Failed to delete tag");
    }
  };

  const handleStartEdit = (tag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
    setEditingGrantsAdmin(tag.grantsAdmin || false);
    setEditingGrantsSuperAdmin(tag.grantsSuperAdmin || false);
    setEditingIsGroup(tag.isGroup !== undefined ? tag.isGroup : true);
    setEditingIsExMember(tag.isExMember || false);
  };

  const handleSaveEdit = async (id, oldName) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'tags', id), { 
        name: editingName.trim(),
        grantsAdmin: editingGrantsAdmin,
        grantsSuperAdmin: editingGrantsSuperAdmin,
        isGroup: editingIsGroup,
        isExMember: editingIsExMember
      });
      await logAdminAction('tag_updated', 'system', `Updated tag: ${editingName.trim()}`);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating tag:", error);
      alert("Failed to update tag");
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Create Tag</h2>
          <p className="panel-desc">Tags act as user groups or roles. They can grant admin privileges or serve as groups in the inventory.</p>
          <form onSubmit={handleAddTag} className="admin-form">
            <div className="form-group">
              <label>Tag Name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., Core Team"
                required
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={newIsGroup}
                onChange={e => setNewIsGroup(e.target.checked)}
              />
              <label style={{ margin: 0 }}>Acts as a group</label>
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={newGrantsAdmin}
                onChange={e => setNewGrantsAdmin(e.target.checked)}
              />
              <label style={{ margin: 0, color: 'var(--accent)' }}>Grants Admin Access</label>
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={newGrantsSuperAdmin}
                onChange={e => setNewGrantsSuperAdmin(e.target.checked)}
              />
              <label style={{ margin: 0, color: 'var(--danger, #ff4d4f)' }}>Grants Super Admin Access</label>
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                checked={newIsExMember}
                onChange={e => setNewIsExMember(e.target.checked)}
              />
              <label style={{ margin: 0, color: '#9ca3af' }}>Ex-Member Tag (Hides them from Inventory)</label>
            </div>
            <div className="form-actions" style={{ marginTop: '15px' }}>
              <button type="submit" className="admin-btn primary">Create Tag</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Existing Tags</h2>
          <div className="achievements-list">
            {tags.map(tag => (
              <div key={tag.id} className="admin-achievement-card admin-user-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                {editingId === tag.id ? (
                  <div style={{ width: '100%' }} className="admin-form">
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={e => setEditingName(e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', color: '#000', marginBottom: '10px' }}
                    />
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', fontSize: '0.85rem' }}>
                      <label style={{ display: 'flex', gap: '4px' }}>
                        <input type="checkbox" checked={editingIsGroup} onChange={e => setEditingIsGroup(e.target.checked)} /> Group
                      </label>
                      <label style={{ display: 'flex', gap: '4px', color: 'var(--accent)' }}>
                        <input type="checkbox" checked={editingGrantsAdmin} onChange={e => setEditingGrantsAdmin(e.target.checked)} /> Admin
                      </label>
                      <label style={{ display: 'flex', gap: '4px', color: '#ff4d4f' }}>
                        <input type="checkbox" checked={editingGrantsSuperAdmin} onChange={e => setEditingGrantsSuperAdmin(e.target.checked)} /> Super Admin
                      </label>
                      <label style={{ display: 'flex', gap: '4px', color: '#9ca3af' }}>
                        <input type="checkbox" checked={editingIsExMember} onChange={e => setEditingIsExMember(e.target.checked)} /> Ex-Member
                      </label>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handleSaveEdit(tag.id, tag.name)} className="admin-btn primary small">Save</button>
                      <button onClick={() => setEditingId(null)} className="admin-btn secondary small">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {tag.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        {tag.isGroup !== false && <span className="role-badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Group</span>}
                        {tag.grantsAdmin && <span className="role-badge admin">Admin</span>}
                        {tag.grantsSuperAdmin && <span className="role-badge super">Super Admin</span>}
                        {tag.isExMember && <span className="role-badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>Ex-Member</span>}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handleStartEdit(tag)} className="admin-btn edit small">Edit</button>
                      <button onClick={() => handleDeleteTag(tag.id, tag.name)} className="admin-btn delete small">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {tags.length === 0 && <p className="empty-state">No tags found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagsTab;
