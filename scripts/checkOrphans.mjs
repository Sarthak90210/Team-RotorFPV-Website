import https from 'https';

const projectId = 'teamrotor-fpv-website';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function fetchCollection(collectionId) {
  return new Promise((resolve, reject) => {
    let allDocuments = [];
    
    function fetchPage(pageToken) {
      let url = `${baseUrl}/${collectionId}?pageSize=1000&key=AIzaSyA2bFhkzVxPsqXJmHDZHW0N2uQoAp0-IAo`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.documents) {
              allDocuments = allDocuments.concat(json.documents.map(d => {
                const id = d.name.split('/').pop();
                const fields = {};
                for (const key in d.fields) {
                  fields[key] = d.fields[key].stringValue !== undefined ? d.fields[key].stringValue : null; // simplified
                }
                return { id, ...fields };
              }));
            } else if (json.error) {
              console.error("API Error:", json.error);
            }
            if (json.nextPageToken) {
              fetchPage(json.nextPageToken);
            } else {
              resolve(allDocuments);
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    }
    
    fetchPage();
  });
}

async function run() {
  try {
    const lists = await fetchCollection('inventory_lists');
    const inventories = await fetchCollection('inventories');
    
    console.log(`Fetched ${lists.length} lists and ${inventories.length} inventories.`);
    
    const listMap = new Set(lists.map(l => l.id));
    const invMap = new Set(inventories.map(i => i.id));
    
    const orphanedInvs = [];
    
    for (const inv of inventories) {
      if (!listMap.has(inv.listId)) {
        orphanedInvs.push({ id: inv.id, name: inv.name, reason: 'Missing list: ' + inv.listId });
        continue;
      }
      
      if (inv.parentInventoryId && inv.parentInventoryId !== 'null' && inv.parentInventoryId !== '') {
        if (!invMap.has(inv.parentInventoryId)) {
          orphanedInvs.push({ id: inv.id, name: inv.name, reason: 'Missing parent inventory: ' + inv.parentInventoryId });
        }
      }
    }
    
    console.log('\nOrphaned Inventories:');
    console.log(JSON.stringify(orphanedInvs, null, 2));
    
  } catch(e) {
    console.error(e);
  }
}

run();
