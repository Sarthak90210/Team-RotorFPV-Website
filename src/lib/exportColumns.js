// Centralized column definition for all exports and sync channels
export const EXPORT_COLUMNS = [
  { key: 'itemName', header: 'Item Name', width: 25 },
  { key: 'category', header: 'Category', width: 18 },
  { key: 'inventoryPathString', header: 'Sub Inventory Path', width: 35 },
  { key: 'quantity', header: 'Quantity', width: 12 },
  { key: 'holder', header: 'Holder', width: 22 },
  { key: 'previousHolder', header: 'Previous Holder', width: 22 },
  { key: 'lastModified', header: 'Last Modified', width: 22 },
  { key: 'modifiedBy', header: 'Modified By', width: 20 },
  { key: 'previousModified', header: 'Previous Modified', width: 22 },
  { key: 'previousModifiedBy', header: 'Previous Modified By', width: 20 }
];

/**
 * Converts array of snapshot item objects into a 2D array of rows using EXPORT_COLUMNS or custom column selection.
 */
export const convertSnapshotToRows = (items = [], columns = EXPORT_COLUMNS) => {
  return items.map(item => {
    return columns.map(col => {
      const val = item[col.key];
      return val !== undefined && val !== null ? val : '';
    });
  });
};
