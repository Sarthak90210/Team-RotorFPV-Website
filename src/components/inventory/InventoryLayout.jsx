import React from 'react';
import { useInventory } from './InventoryContext';
import InventorySidebar from './InventorySidebar';
import InventoryMiddlePane from './InventoryMiddlePane';
import InventoryDetailsPane from './InventoryDetailsPane';
import DashboardSummary from './DashboardSummary';
import SpotlightSearch from './SpotlightSearch';
import { Search } from 'lucide-react';
import './Inventory.css';

const InventoryLayout = () => {
  const { isDetailsCollapsed, selectedList, selectedInventoryId, setIsSpotlightOpen, fullscreenPane } = useInventory();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex-between" style={{ marginBottom: '16px', padding: '0 4px' }}>
        <div>
          <h1 className="details-title" style={{ fontSize: '30px' }}>Inventory</h1>
          <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px' }}>
            {selectedList ? selectedList.name : 'All Lists'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setIsSpotlightOpen(true)}
            className="inv-btn secondary" 
            style={{ width: '220px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} /> Search...
            </span>
            <span style={{ color: '#6b7280', fontSize: '12px' }}>Ctrl+K</span>
          </button>
        </div>
      </div>

      <div className={`inventory-3col-layout ${(!fullscreenPane && isDetailsCollapsed) ? 'collapsed-details' : ''} ${fullscreenPane ? 'fullscreen-' + fullscreenPane : ''}`}>
        <InventorySidebar />
        <InventoryMiddlePane />
        {selectedInventoryId ? (
          <InventoryDetailsPane />
        ) : (
          <div className="inventory-details inv-panel empty-details-pane">
            <DashboardSummary />
          </div>
        )}
      </div>
      <SpotlightSearch />
    </div>
  );
};

export default InventoryLayout;
