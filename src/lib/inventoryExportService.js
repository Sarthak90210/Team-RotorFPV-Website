import * as XLSX from 'xlsx';
import { EXPORT_COLUMNS, convertSnapshotToRows } from './exportColumns';

/**
 * Downloads a styled Excel (.xlsx) file built from a canonical snapshot.
 */
export const exportToExcel = (snapshot, fileName = 'TRFPV_Inventory.xlsx') => {
  if (!snapshot || !snapshot.lists) return;

  const wb = XLSX.utils.book_new();

  // 1. Create Master Overview Sheet
  const overviewData = [
    ['Team Rotor FPV - Inventory Overview'],
    [`Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`],
    [''],
    ['Metric', 'Value'],
    ['Total Lists', snapshot.summary.totalLists],
    ['Total Inventories', snapshot.summary.totalInventories],
    ['Total Sub-Inventories', snapshot.summary.totalSubInventories],
    ['Total Items Count', snapshot.summary.totalItems],
    ['Assigned Items', snapshot.summary.assignedItems],
    ['Unassigned Items', snapshot.summary.unassignedItems],
    ['Unique Holders', snapshot.summary.uniqueHolders]
  ];

  const overviewWs = XLSX.utils.aoa_to_sheet(overviewData);
  overviewWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview');

  // 2. Create Sheet per Inventory List
  const listNames = Object.keys(snapshot.lists).sort();
  
  listNames.forEach(listName => {
    const items = snapshot.lists[listName] || [];
    
    // Sort items alphabetically
    const sortedItems = [...items].sort((a, b) => a.itemName.localeCompare(b.itemName));

    const metaRows = [
      [`List Name: ${listName}`, `Total Items: ${sortedItems.length}`, `Export Date: ${new Date().toLocaleDateString()}`],
      ['Generated automatically from Team Rotor FPV System.'],
      ['']
    ];

    const headerRow = EXPORT_COLUMNS.map(col => col.header);
    const dataRows = convertSnapshotToRows(sortedItems, EXPORT_COLUMNS);

    const sheetContent = [...metaRows, headerRow, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(sheetContent);

    // Apply column widths
    ws['!cols'] = EXPORT_COLUMNS.map(col => ({ wch: col.width || 20 }));

    // Clean sheet name for Excel (max 31 chars, no invalid chars)
    const cleanSheetName = listName.replace(/[\\/?*:[\]]/g, '').substring(0, 30);
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  });

  // 3. Write File
  XLSX.writeFile(wb, fileName);
};

/**
 * Downloads a CSV file built from a canonical snapshot.
 */
export const exportToCsv = (snapshot, fileName = 'TRFPV_Inventory.csv') => {
  if (!snapshot || !snapshot.allItems) return;

  const headerRow = EXPORT_COLUMNS.map(col => `"${col.header.replace(/"/g, '""')}"`).join(',');
  const dataRows = snapshot.allItems.map(item => {
    return EXPORT_COLUMNS.map(col => {
      const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
