import React, { useState, useEffect } from 'react';
import { fetchAdmins, apiPost } from '../../lib/adminApi';

const AdminsTab = ({ user }) => {
  const [adminList, setAdminList] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const refreshAdmins = async () => {
    try {
      setAdminList(await fetchAdmins());
    } catch (error) {
      console.error("Failed to fetch admin list:", error);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const admins = await fetchAdmins();
        if (active) setAdminList(admins);
      } catch (error) {
        console.error("Failed to fetch admin list:", error);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail) return;

    try {
      const { ok, data } = await apiPost('/api/setAdmin', { email: newAdminEmail });
      if (ok) {
        alert("Admin added successfully!");
        setNewAdminEmail('');
        refreshAdmins();
      } else {
        alert("Failed to add admin: " + data.error);
      }
    } catch (error) {
      console.error("Error adding admin:", error);
      alert("Failed to connect to backend server.");
    }
  };

  const handleRemoveAdmin = async (emailToRemove) => {
    if (emailToRemove === user.email) {
      alert("You cannot remove yourself!");
      return;
    }

    if (window.confirm(`Remove admin privileges from ${emailToRemove}?\n\nThis action cannot be undone automatically.`)) {
      try {
        const { ok, data } = await apiPost('/api/removeAdmin', { email: emailToRemove });
        if (ok) {
          alert("Admin access revoked successfully!");
          refreshAdmins();
        } else {
          alert("Failed to remove admin: " + data.error);
        }
      } catch (error) {
        console.error("Error removing admin:", error);
        alert("Failed to connect to backend server.");
      }
    }
  };

  const handlePromoteAdmin = async (emailToPromote) => {
    if (window.confirm(`Promote ${emailToPromote} to Super Admin?\n\nSuper Admins can manage admins, promote other users, and modify permissions.`)) {
      try {
        const { ok, data } = await apiPost('/api/setSuperAdmin', { email: emailToPromote });
        if (ok) {
          alert("Admin promoted successfully!");
          refreshAdmins();
        } else {
          alert("Failed to promote: " + data.error);
        }
      } catch (error) {
        console.error("Error promoting:", error);
        alert("Failed to connect to backend server.");
      }
    }
  };

  const handleDemoteAdmin = async (emailToDemote) => {
    if (emailToDemote === user.email) {
      alert("You cannot demote yourself!");
      return;
    }
    if (window.confirm(`Remove Super Admin privileges from ${emailToDemote}?\n\nThey will remain an Admin but lose permission management capabilities.`)) {
      try {
        const { ok, data } = await apiPost('/api/removeSuperAdmin', { email: emailToDemote });
        if (ok) {
          alert("Super Admin privileges revoked successfully!");
          refreshAdmins();
        } else {
          alert("Failed to demote: " + data.error);
        }
      } catch (error) {
        console.error("Error demoting:", error);
        alert("Failed to connect to backend server.");
      }
    }
  };

  return (
    <>
      <div className="admin-left-column">
        <div className="admin-glass-panel form-panel">
          <h2>Grant Admin Access</h2>
          <p className="panel-desc">
            User must sign in to the website at least once before they can be granted admin privileges.
          </p>
          <form onSubmit={handleAddAdmin} className="admin-form">
            <div className="form-group">
              <label>New Admin Email</label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="admin-btn primary">Grant Access</button>
            </div>
          </form>
        </div>
      </div>

      <div className="admin-right-column">
        <div className="admin-glass-panel list-panel">
          <h2>Current Admins</h2>
          <div className="achievements-list">
            {adminList.map(admin => (
              <div key={admin.email} className="admin-achievement-card admin-user-card">
                <div className="card-info">
                  <h3>{admin.email}</h3>
                  {admin.isRoot && (
                    <span className="role-badge root">Root Super Admin</span>
                  )}
                  {!admin.isRoot && admin.isSuperAdmin && (
                    <span className="role-badge super">Super Admin</span>
                  )}
                  {!admin.isSuperAdmin && !admin.isRoot && (
                    <span className="role-badge admin">Admin</span>
                  )}
                  {admin.email === user.email && (
                    <span className="role-badge you">You</span>
                  )}
                </div>
                <div className="card-actions">
                  {!admin.isRoot && admin.email !== user.email && !admin.isSuperAdmin && (
                    <button onClick={() => handlePromoteAdmin(admin.email)} className="admin-btn primary small">Promote</button>
                  )}
                  {!admin.isRoot && admin.email !== user.email && admin.isSuperAdmin && (
                    <button onClick={() => handleDemoteAdmin(admin.email)} className="admin-btn secondary small">Demote</button>
                  )}
                  {!admin.isRoot && admin.email !== user.email && (
                    <button onClick={() => handleRemoveAdmin(admin.email)} className="admin-btn delete small">Remove</button>
                  )}
                </div>
              </div>
            ))}
            {adminList.length === 0 && <p className="empty-state">No admins found.</p>}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminsTab;
