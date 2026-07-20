import React from 'react';
import { PackageOpen } from 'lucide-react';

const DashboardSummary = () => {
  return (
    <div className="flex-col" style={{ alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.8 }}>
      <div className="dashboard-illustration">
        <PackageOpen size={48} strokeWidth={1.5} />
      </div>
      <h2 className="dashboard-title">Select an Inventory</h2>
      <p className="dashboard-desc">
        Choose an inventory from the list to view its contents, history, and current holder.
      </p>
    </div>
  );
};

export default DashboardSummary;
