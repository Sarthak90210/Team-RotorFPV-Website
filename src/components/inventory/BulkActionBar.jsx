import React from 'react';

const BulkActionBar = ({ selectedCount, onMove, onCancel, itemName = 'items' }) => {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      zIndex: 1000,
      color: '#e5e7eb',
      fontWeight: 500
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✓</div>
        <span>{selectedCount} {itemName} selected</span>
      </div>
      <div style={{ width: '1px', height: '24px', background: '#374151' }}></div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="inv-btn secondary" onClick={onMove}>Move</button>
        <button className="inv-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default BulkActionBar;
