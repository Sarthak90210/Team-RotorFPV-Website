import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const JoinRequestForm = ({ onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    registrationNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'join_requests'), {
        ...formData,
        email: formData.email.trim().toLowerCase(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      onSuccess();
    } catch (err) {
      console.error('Error submitting join request:', err);
      setError('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-glass-panel form-panel" style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ marginBottom: '20px' }}>Request Team Access</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
        Fill out this form to request access to the team dashboard. Once approved by a Super Admin, you will receive a verification email to activate your account.
      </p>

      {error && <div style={{ color: '#ff4d4f', marginBottom: '15px', fontSize: '0.9rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="Your email address"
          />
        </div>

        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div className="form-group">
          <label>Registration Number</label>
          <input
            type="text"
            required
            value={formData.registrationNumber}
            onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
            placeholder="e.g. 21BCE0000"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="admin-btn primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
          <button type="button" onClick={onCancel} className="admin-btn cancel" disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default JoinRequestForm;
