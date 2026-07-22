import React, { useState } from 'react';
import { getInventorySnapshot } from '../../lib/inventorySnapshotService';
import { exportToExcel, exportToCsv } from '../../lib/inventoryExportService';
import { FileSpreadsheet, Download, X, Check, Loader2 } from 'lucide-react';

const ExportModal = ({ isOpen, onClose, currentList, currentInventory }) => {
  const [exportScope, setExportScope] = useState('list'); // 'list', 'full', 'inventory'
  const [exportFormat, setExportFormat] = useState('xlsx'); // 'xlsx', 'csv'
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      let filter = {};
      let filenamePrefix = 'TRFPV_Full_Inventory';

      if (exportScope === 'list' && currentList) {
        filter = { listId: currentList.id };
        filenamePrefix = `TRFPV_${currentList.name.replace(/\s+/g, '_')}`;
      } else if (exportScope === 'inventory' && currentInventory) {
        filter = { inventoryId: currentInventory.id };
        filenamePrefix = `TRFPV_${currentInventory.name.replace(/\s+/g, '_')}`;
      }

      // Obtain canonical snapshot
      const snapshot = await getInventorySnapshot(filter);

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${filenamePrefix}_${dateStr}.${exportFormat}`;

      if (exportFormat === 'xlsx') {
        exportToExcel(snapshot, filename);
      } else {
        exportToCsv(snapshot, filename);
      }

      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '480px',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        color: '#f3f4f6'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet color="#3b82f6" size={24} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Export Inventory Data</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scope Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}>
            EXPORT SCOPE
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentList && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: exportScope === 'list' ? '1px solid #3b82f6' : '1px solid #1f2937',
                backgroundColor: exportScope === 'list' ? 'rgba(59, 130, 246, 0.1)' : '#1f2937',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input 
                  type="radio" 
                  name="scope" 
                  checked={exportScope === 'list'} 
                  onChange={() => setExportScope('list')} 
                />
                <span>Active List: <strong>{currentList.name}</strong></span>
              </label>
            )}

            {currentInventory && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                border: exportScope === 'inventory' ? '1px solid #3b82f6' : '1px solid #1f2937',
                backgroundColor: exportScope === 'inventory' ? 'rgba(59, 130, 246, 0.1)' : '#1f2937',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
                <input 
                  type="radio" 
                  name="scope" 
                  checked={exportScope === 'inventory'} 
                  onChange={() => setExportScope('inventory')} 
                />
                <span>Selected Sub-Inventory: <strong>{currentInventory.name}</strong></span>
              </label>
            )}

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: exportScope === 'full' ? '1px solid #3b82f6' : '1px solid #1f2937',
              backgroundColor: exportScope === 'full' ? 'rgba(59, 130, 246, 0.1)' : '#1f2937',
              cursor: 'pointer',
              fontSize: '14px'
            }}>
              <input 
                type="radio" 
                name="scope" 
                checked={exportScope === 'full'} 
                onChange={() => setExportScope('full')} 
              />
              <span>Full Database (All Lists & Sub-Inventories)</span>
            </label>
          </div>
        </div>

        {/* Format Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}>
            FILE FORMAT
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setExportFormat('xlsx')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: exportFormat === 'xlsx' ? '2px solid #22c55e' : '1px solid #1f2937',
                backgroundColor: exportFormat === 'xlsx' ? 'rgba(34, 197, 94, 0.1)' : '#1f2937',
                color: exportFormat === 'xlsx' ? '#22c55e' : '#9ca3af',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              Excel (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => setExportFormat('csv')}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: exportFormat === 'csv' ? '2px solid #3b82f6' : '1px solid #1f2937',
                backgroundColor: exportFormat === 'csv' ? 'rgba(59, 130, 246, 0.1)' : '#1f2937',
                color: exportFormat === 'csv' ? '#3b82f6' : '#9ca3af',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              CSV (.csv)
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            type="button" 
            className="inv-btn secondary"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="inv-btn primary"
            onClick={handleDownload}
            disabled={isExporting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#3b82f6', color: 'white' }}
          >
            {isExporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {isExporting ? 'Generating...' : `Download ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
