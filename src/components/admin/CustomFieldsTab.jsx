import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAdminAction } from '../../lib/adminApi';

const CustomFieldsTab = ({ user }) => {
  const [fields, setFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'custom_fields'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFields(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleAddField = async (e) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;

    try {
      await addDoc(collection(db, 'custom_fields'), { name: newFieldName.trim() });
      await logAdminAction('custom_field_created', 'system', `Created dynamic field: ${newFieldName.trim()}`);
      setNewFieldName('');
    } catch (error) {
      console.error("Error adding field:", error);
      alert("Failed to add field");
    }
  };

  const handleDeleteField = async (id, name) => {
    if (!window.confirm(`Delete field "${name}"? This will not remove the data from existing users, but it will no longer show up as a standard field.`)) return;
    
    try {
      await deleteDoc(doc(db, 'custom_fields', id));
      await logAdminAction('custom_field_deleted', 'system', `Deleted dynamic field: ${name}`);
    } catch (error) {
      console.error("Error deleting field:", error);
      alert("Failed to delete field");
    }
  };

  const handleStartEdit = (field) => {
    setEditingId(field.id);
    setEditingName(field.name);
  };

  const handleSaveEdit = async (id, oldName) => {
    if (!editingName.trim()) return;
    try {
      await updateDoc(doc(db, 'custom_fields', id), { name: editingName.trim() });
      await logAdminAction('custom_field_updated', 'system', `Renamed field from ${oldName} to ${editingName.trim()}`);
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error("Error updating field:", error);
      alert("Failed to update field");
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Add Dynamic Field</h2>
          <p className="panel-desc">Create custom profile fields (e.g., Phone, Batch, Specialization) that will appear for all users.</p>
          <form onSubmit={handleAddField} className="admin-form">
            <div className="form-group">
              <label>Field Name</label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g., Department"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="admin-btn primary">Create Field</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Existing Fields</h2>
          <div className="achievements-list">
            {fields.map(field => (
              <div key={field.id} className="admin-achievement-card admin-user-card">
                <div className="card-info">
                  {editingId === field.id ? (
                    <input 
                      type="text" 
                      value={editingName} 
                      onChange={e => setEditingName(e.target.value)}
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', color: '#000' }}
                    />
                  ) : (
                    <h3>{field.name}</h3>
                  )}
                </div>
                <div className="card-actions">
                  {editingId === field.id ? (
                    <>
                      <button onClick={() => handleSaveEdit(field.id, field.name)} className="admin-btn primary small">Save</button>
                      <button onClick={() => setEditingId(null)} className="admin-btn secondary small">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleStartEdit(field)} className="admin-btn edit small">Edit</button>
                      <button onClick={() => handleDeleteField(field.id, field.name)} className="admin-btn delete small">Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {fields.length === 0 && <p className="empty-state">No dynamic fields found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomFieldsTab;
