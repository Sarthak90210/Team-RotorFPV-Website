import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logAdminAction } from '../lib/adminApi';
import './ContactMessagesAdmin.css';

const ContactMessagesAdmin = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, unread, read

  useEffect(() => {
    const q = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleMarkAsRead = async (msg) => {
    try {
      const newStatus = msg.status === 'unread' ? 'read' : 'unread';
      await updateDoc(doc(db, 'contact_messages', msg.id), {
        status: newStatus
      });
      await logAdminAction(
        newStatus === 'read' ? 'Marked as Read' : 'Marked as Unread',
        'Contact Message',
        `Message from ${msg.name} (${msg.email}) was marked as ${newStatus}`
      );
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleDelete = async (msg) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'contact_messages', msg.id));
        await logAdminAction(
          'Deleted',
          'Contact Message',
          `Deleted message from ${msg.name} (${msg.email})`
        );
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
      }
    }
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = (msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           msg.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           msg.message?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filterStatus === 'all') return matchesSearch;
    return matchesSearch && msg.status === filterStatus;
  });

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  if (loading) {
    return <div className="admin-loading">Loading messages...</div>;
  }

  return (
    <div className="contact-admin-container fade-in admin-full">
      <div className="contact-admin-header">
        <h2>Contact Messages {unreadCount > 0 && <span className="unread-badge">{unreadCount} New</span>}</h2>
        
        <div className="contact-admin-controls">
          <input 
            type="text" 
            placeholder="Search messages..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="contact-search"
          />
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="contact-filter"
          >
            <option value="all">All Messages</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      <div className="messages-list">
        {filteredMessages.length === 0 ? (
          <div className="no-messages">No messages found.</div>
        ) : (
          filteredMessages.map((msg) => (
            <div key={msg.id} className={`message-card ${msg.status === 'unread' ? 'unread' : ''}`}>
              <div className="message-header">
                <div className="message-sender">
                  <strong>{msg.name}</strong> 
                  <a href={`mailto:${msg.email}`}>({msg.email})</a>
                </div>
                <div className="message-date">
                  {msg.createdAt.toLocaleString()}
                </div>
              </div>
              
              <div className="message-meta">
                {msg.phone && <span className="meta-tag">📞 {msg.phone}</span>}
                {msg.organization && <span className="meta-tag">🏢 {msg.organization}</span>}
                <span className="meta-tag query-type">{msg.queryType}</span>
              </div>
              
              <div className="message-body">
                {msg.message}
              </div>
              
              <div className="message-actions">
                <button 
                  className={`btn-action ${msg.status === 'unread' ? 'btn-read' : 'btn-unread'}`}
                  onClick={() => handleMarkAsRead(msg)}
                >
                  {msg.status === 'unread' ? 'Mark as Read' : 'Mark as Unread'}
                </button>
                <a href={`mailto:${msg.email}?subject=Re: [Team RotorFPV] ${msg.queryType}`} className="btn-action btn-reply">
                  Reply via Email
                </a>
                <button className="btn-action btn-delete" onClick={() => handleDelete(msg)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactMessagesAdmin;
