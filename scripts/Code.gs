/**
 * Team Rotor FPV - Google Sheets Inventory Mirror Webhook (Version 2)
 * Place this code into your Google Apps Script editor bound to your Google Spreadsheet.
 */

const SECRET_KEY = "YOUR_SECRET_KEY_HERE"; // Must match Secret Sync Key in Admin configuration

function doPost(e) {
  // 1. Parse payload
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid JSON payload" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Authenticate
  if (data.syncKey !== SECRET_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized: Invalid Sync Key" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Acquire Script Lock (prevents concurrent sync execution)
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // 30-second lock window
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Script lock timeout after 30 seconds" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const listsData = data.lists || {};
    const summary = data.summary || {};
    const columns = data.columns || [
      { key: 'itemName', header: 'Item Name' },
      { key: 'category', header: 'Category' },
      { key: 'inventoryPathString', header: 'Sub Inventory Path' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'holder', header: 'Holder' },
      { key: 'previousHolder', header: 'Previous Holder' },
      { key: 'lastModified', header: 'Last Modified' },
      { key: 'modifiedBy', header: 'Modified By' },
      { key: 'previousModified', header: 'Previous Modified' },
      { key: 'previousModifiedBy', header: 'Previous Modified By' }
    ];

    const listNames = Object.keys(listsData).sort();

    // 4. Update / Create "📊 Overview" Health Dashboard Sheet
    let overviewSheet = spreadsheet.getSheetByName("📊 Inventory Overview");
    if (!overviewSheet) {
      overviewSheet = spreadsheet.insertSheet("📊 Inventory Overview", 0);
    }
    overviewSheet.clear();

    const timestamp = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : new Date().toLocaleString();
    const overviewGrid = [
      ["TEAM ROTOR FPV - INVENTORY SYSTEM OVERVIEW", ""],
      [`Last Sync: ${timestamp}`, `Payload Version: ${data.version || 2}`],
      ["", ""],
      ["SYSTEM HEALTH METRIC", "VALUE"],
      ["Total Inventory Lists", summary.totalLists || listNames.length],
      ["Total Main Inventories", summary.totalInventories || 0],
      ["Total Sub-Inventories", summary.totalSubInventories || 0],
      ["Total Items Count (Quantity)", summary.totalItems || 0],
      ["Unique Asset Records", summary.uniqueItemRecords || 0],
      ["Assigned Items", summary.assignedItems || 0],
      ["Unassigned / Available Items", summary.unassignedItems || 0],
      ["Active Unique Holders", summary.uniqueHolders || 0],
      ["", ""],
      ["INVENTORY LISTS INDEX", "ITEM COUNT"],
      ...listNames.map(name => [name, (listsData[name] || []).reduce((acc, curr) => acc + (parseInt(curr.quantity, 10) || 1), 0)])
    ];

    overviewSheet.getRange(1, 1, overviewGrid.length, 2).setValues(overviewGrid);
    overviewSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setFontSize(14).setBackground("#1f2937").setFontColor("#ffffff");
    overviewSheet.getRange(4, 1, 1, 2).setFontWeight("bold").setBackground("#374151").setFontColor("#ffffff");
    overviewSheet.getRange(14, 1, 1, 2).setFontWeight("bold").setBackground("#374151").setFontColor("#ffffff");
    overviewSheet.setFrozenRows(4);
    overviewSheet.autoResizeColumn(1);
    overviewSheet.autoResizeColumn(2);

    // 5. Update Each Inventory List Sheet
    for (const listName of listNames) {
      let sheet = spreadsheet.getSheetByName(listName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(listName);
      }

      const items = listsData[listName] || [];
      items.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));

      const listTotalQty = items.reduce((acc, curr) => acc + (parseInt(curr.quantity, 10) || 1), 0);

      const metaRows = [
        [`List: ${listName}`, `Total Items Count: ${listTotalQty} (Asset Records: ${items.length})`, `Last Sync: ${timestamp}`, ...Array(columns.length - 3).fill('')],
        ['System generated read-only mirror. Changes made here will be overwritten on next sync.', ...Array(columns.length - 1).fill('')],
        [...Array(columns.length).fill('')] // Spacer
      ];

      const headerRow = columns.map(c => c.header);
      const dataRows = items.map(item => {
        return columns.map(c => {
          const val = item[c.key];
          return val !== undefined && val !== null ? val : '';
        });
      });

      const finalGrid = [...metaRows, headerRow, ...dataRows];
      sheet.clear();

      if (finalGrid.length > 0) {
        sheet.getRange(1, 1, finalGrid.length, columns.length).setValues(finalGrid);
      }

      // Formatting
      sheet.setFrozenRows(4);

      // Meta Rows styling
      sheet.getRange(1, 1, 2, columns.length)
        .setFontStyle("italic")
        .setBackground("#f3f4f6")
        .setFontColor("#374151");

      // Header Row styling
      sheet.getRange(4, 1, 1, columns.length)
        .setFontWeight("bold")
        .setBackground("#1f2937")
        .setFontColor("#ffffff");

      // Alternating Zebra Striping on Data Rows
      if (dataRows.length > 0) {
        for (let r = 5; r <= finalGrid.length; r++) {
          if (r % 2 === 0) {
            sheet.getRange(r, 1, 1, columns.length).setBackground("#f9fafb");
          }
        }
      }

      // Auto-resize columns
      for (let i = 1; i <= columns.length; i++) {
        sheet.autoResizeColumn(i);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      success: true, 
      version: 2,
      timestamp: new Date().toISOString() 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Team Rotor FPV Inventory Sync Webhook v2 is active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
