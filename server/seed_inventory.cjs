const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const demoData = [
  {
    listName: 'Drone Fleet Alpha',
    inventories: [
      { name: 'Quadcopter Frame A', items: [{ name: 'Carbon Fiber Arm', qty: 4 }, { name: 'Titanium Screws', qty: 16 }] },
      { name: 'Flight Controller Stack 1', items: [{ name: 'F7 FC', qty: 1 }, { name: '50A ESC', qty: 1 }] },
      { name: 'VTX System 1', items: [{ name: 'Analog VTX 800mW', qty: 1 }, { name: 'Antenna RHCP', qty: 1 }] }
    ]
  },
  {
    listName: 'Workshop Tools',
    inventories: [
      { name: 'Soldering Station', items: [{ name: 'TS100 Iron', qty: 1 }, { name: 'Solder Wire 63/37', qty: 2 }] },
      { name: 'Hand Tools', items: [{ name: 'Hex Drivers Set', qty: 1 }, { name: 'Wire Cutters', qty: 2 }] },
      { name: 'Multimeter Kit', items: [{ name: 'Digital Multimeter', qty: 1 }, { name: 'Test Probes', qty: 2 }] }
    ]
  },
  {
    listName: 'Battery Storage Room',
    inventories: [
      { name: '6S LiPo Batteries', items: [{ name: '1300mAh 120C', qty: 10 }, { name: '1500mAh 100C', qty: 5 }] },
      { name: '4S LiPo Batteries', items: [{ name: '1500mAh 80C', qty: 8 }, { name: '850mAh 100C', qty: 4 }] },
      { name: 'Chargers', items: [{ name: 'ISDT Q8', qty: 2 }, { name: 'Parallel Charging Board', qty: 2 }] }
    ]
  },
  {
    listName: 'Camera & Optics',
    inventories: [
      { name: 'GoPro Action Cams', items: [{ name: 'GoPro Hero 11', qty: 2 }, { name: 'ND Filter Set', qty: 1 }] },
      { name: 'FPV Goggles', items: [{ name: 'FatShark HDO2', qty: 2 }, { name: 'DJI Goggles V2', qty: 1 }] },
      { name: 'Goggle Antennas', items: [{ name: 'Patch Antenna', qty: 4 }, { name: 'Omni Antenna', qty: 4 }] }
    ]
  },
  {
    listName: 'Event Operations Gear',
    inventories: [
      { name: 'Ground Station', items: [{ name: 'Field Monitor 7"', qty: 1 }, { name: 'Tripod', qty: 1 }] },
      { name: 'Safety Equipment', items: [{ name: 'Fire Extinguisher', qty: 2 }, { name: 'First Aid Kit', qty: 1 }] },
      { name: 'Race Track Gates', items: [{ name: 'LED Gate', qty: 10 }, { name: 'Race Flags', qty: 15 }] }
    ]
  }
];

async function seed() {
  console.log('Starting seed...');
  let listCount = 0;
  let invCount = 0;
  let itemCount = 0;

  for (const listData of demoData) {
    const listRef = await db.collection('inventory_lists').add({
      name: listData.listName,
      createdAt: new Date().toISOString(),
      createdBy: 'sarthakkhubchandanik@gmail.com'
    });
    listCount++;
    console.log(`Created list: ${listData.listName}`);

    for (const invData of listData.inventories) {
      const invRef = await db.collection('inventories').add({
        listId: listRef.id,
        name: invData.name,
        createdAt: new Date().toISOString(),
        createdBy: 'sarthakkhubchandanik@gmail.com',
        currentHolder: null,
        currentRoom: null,
        currentAssignedDate: null,
        previousHolder: null,
        previousRoom: null,
        previousAssignedDate: null
      });
      invCount++;
      
      for (const itemData of invData.items) {
        await db.collection('items').add({
          inventoryId: invRef.id,
          name: itemData.name,
          quantity: itemData.qty,
          createdAt: new Date().toISOString(),
          createdBy: 'sarthakkhubchandanik@gmail.com'
        });
        itemCount++;
      }
    }
  }

  console.log(`Seed complete! Created ${listCount} lists, ${invCount} inventories, and ${itemCount} items.`);
  process.exit(0);
}

seed().catch(console.error);
