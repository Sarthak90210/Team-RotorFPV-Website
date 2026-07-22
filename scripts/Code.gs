const SECRET_KEY = "REPLACE_WITH_YOUR_SECRET_KEY"; // Must match frontend config

function doPost(e) {
  // 1. Parse payload
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid JSON" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Authenticate
  if (data.syncKey !== SECRET_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Unauthorized" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Acquire Lock (prevents concurrent syncs)
  const lock = LockService.getScriptLock();
  try {
    // Wait for up to 30 seconds for other processes to finish.
    lock.waitLock(30000);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Could not obtain lock after 30 seconds." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 4. Process Sync
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const listsData = data.lists || {}; // Format: { "List Name": [ { name, quantity, subInventory, holder, previousHolder, lastModified, modifiedBy } ] }
    const listNames = Object.keys(listsData);
    
    // Sort lists alphabetically (optional)
    listNames.sort();

    // 5. Update each sheet
    for (const listName of listNames) {
      let sheet = spreadsheet.getSheetByName(listName);
      
      if (!sheet) {
        // Create it if it doesn't exist
        sheet = spreadsheet.insertSheet(listName);
      }
      
      const items = listsData[listName] || [];
      
      // Sort items alphabetically
      items.sort((a, b) => a.name.localeCompare(b.name));

      // Build data grid
      const timestamp = new Date().toLocaleString();
      const metaRows = [
        [`Last Sync: ${timestamp}`, `Total Items: ${items.length}`, '', '', '', '', '', ''],
        ['Generated automatically. Do not edit manually.', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''] // Empty spacer
      ];
      
      const headerRow = [
        'Item Name', 
        'Category', 
        'Sub Inventory', 
        'Quantity', 
        'Holder', 
        'Previous Holder', 
        'Last Modified', 
        'Modified By'
      ];
      
      const itemRows = items.map(item => [
        item.name || '',
        item.category || '',
        item.subInventory || '',
        item.quantity || 0,
        item.holder || '',
        item.previousHolder || '',
        item.lastModified || '',
        item.modifiedBy || ''
      ]);
      
      const finalData = [...metaRows, headerRow, ...itemRows];
      
      // Clear sheet completely
      sheet.clear();
      
      // Write new data
      if (finalData.length > 0) {
        sheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
      }
      
      // Formatting
      
      // Freeze top 4 rows (3 meta + 1 header)
      sheet.setFrozenRows(4);
      
      // Bold the header row
      sheet.getRange(4, 1, 1, finalData[0].length).setFontWeight("bold");
      
      // Style the meta rows
      sheet.getRange(1, 1, 2, finalData[0].length)
        .setFontStyle("italic")
        .setBackground("#f3f4f6");
        
      // Auto resize columns
      for (let i = 1; i <= finalData[0].length; i++) {
        sheet.autoResizeColumn(i);
      }
    }
    
    // Return success
    return ContentService.createTextOutput(JSON.stringify({ success: true, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    // Release the lock
    lock.releaseLock();
  }
}

// Handle GET requests gracefully (e.g. if opened in browser by mistake)
function doGet(e) {
  return ContentService.createTextOutput("Team Rotor FPV Inventory Sync Webhook is active.")
    .setMimeType(ContentService.MimeType.TEXT);
}
