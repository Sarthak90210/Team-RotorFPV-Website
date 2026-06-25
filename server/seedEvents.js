// One-off seed script: adds demo events (6 upcoming + 6 past) to Firestore,
// each with a cover image, short + long description, and a gallery.
// Run from the server/ directory:  node seedEvents.js
// Uses the Admin SDK (service account), so it bypasses security rules.
// Re-running first removes events created by this script (createdBy: 'seed-script'),
// so it refreshes the demo set without duplicating or touching manually-added events.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Demo image — 16:9 placeholder, varied by seed so each looks distinct.
const img = (seed) => `https://picsum.photos/seed/${seed}/800/450`;
// A small gallery of distinct placeholder shots for the detail popup.
const gallery = (seed) => [1, 2, 3, 4].map((n) => img(`${seed}-${n}`));

const longText = (name) =>
  `${name} is one of the highlights of the Team Rotor FPV calendar, bringing together pilots, builders, and curious newcomers for a full day of first-person-view flying.\n` +
  `Across the event you'll find qualifying heats, hands-on build help, and plenty of crashes-and-repairs that are all part of the FPV journey. Our members are on hand throughout to walk visitors through goggles, transmitters, and the engineering behind a racing quad.\n` +
  `Whether you're here to compete, learn, or just watch the drones rip around the track, there's something for everyone. Come say hi at the pits and see what we've been building.`;

const upcoming = [
  { name: 'VIT Gravitas Drone Race 2026', description: 'Our flagship FPV racing showdown returning to Gravitas with a redesigned high-speed track.' },
  { name: 'Freestyle FPV Workshop', description: 'A hands-on session covering acro mode, power loops, and dive lines for newcomers.' },
  { name: 'Inter-College Drone Hackathon', description: 'A 24-hour build sprint where teams design, assemble, and tune a racing quad.' },
  { name: 'Night FPV Light Show', description: 'An after-dark exhibition of LED-equipped drones flying choreographed routines.' },
  { name: 'Long-Range Cinematic Meetup', description: 'A scenic long-range flying day focused on cinematic capture and battery safety.' },
  { name: 'Beginner Simulator Bootcamp', description: 'Learn stick control and muscle memory on the sim before risking a real airframe.' },
];

const past = [
  { name: 'Gravitas Drone Race 2025', description: 'Last year’s championship saw record lap times and a packed crowd of 32 pilots.' },
  { name: 'Republic Day Aerial Display', description: 'A formation flight that opened the campus Republic Day celebrations.' },
  { name: 'Soldering & Build Clinic', description: 'A repair-focused clinic rebuilding crashed frames and learning clean soldering.' },
  { name: 'Micro Whoop Indoor Cup', description: 'A tight indoor course flown on tiny whoops, testing precision over raw speed.' },
  { name: 'Tech Fest Exhibition Booth', description: 'Our interactive booth introduced hundreds of visitors to FPV goggles and demos.' },
  { name: 'Endurance & Telemetry Trials', description: 'A data-driven session logging flight time, voltage sag, and signal range.' },
];

async function clearPreviousSeed() {
  const snap = await db.collection('events').where('createdBy', '==', 'seed-script').get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function seed() {
  const removed = await clearPreviousSeed();
  if (removed) console.log(`Removed ${removed} previous demo event(s).`);

  const batch = db.batch();
  const col = db.collection('events');
  let order = 0;

  const add = (ev, status, seedKey) => {
    const ref = col.doc();
    batch.set(ref, {
      name: ev.name,
      description: ev.description,
      longDescription: longText(ev.name),
      image: img(seedKey),
      galleryImages: gallery(seedKey),
      status,
      order: order++,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
    });
  };

  upcoming.forEach((ev, i) => add(ev, 'upcoming', `rotor-up-${i}`));
  past.forEach((ev, i) => add(ev, 'past', `rotor-past-${i}`));

  await batch.commit();
  console.log(`Seeded ${upcoming.length} upcoming + ${past.length} past events (with galleries + long descriptions).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
