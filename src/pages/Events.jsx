import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import ShinyText from '../components/ShinyText';
import GlassSurface from '../components/GlassSurface';
import PixelCard from '../components/PixelCard';
import Seo from '../components/Seo';
import './Events.css';

const EventCard = ({ event, onClick }) => (
  <button type="button" className="event-card-button" onClick={onClick} aria-label={`Explore ${event.name}`}>
    <GlassSurface
      className="event-card-glass"
      width="100%"
      height="340px"
      borderRadius={15}
      brightness={40}
      opacity={0.8}
      blur={10}
      backgroundOpacity={0.1}
      useFallback={true}
    >
      <PixelCard variant="blue" className="event-card-inner">
        <div className="event-image-wrap">
          <img src={event.image} alt={event.name} className="event-image" loading="lazy" />
          <div className="event-name-overlay">{event.name}</div>
        </div>
        <div className="event-info">
          <h4 className="event-name">{event.name}</h4>
          {event.description && <p className="event-desc">{event.description}</p>}
        </div>
      </PixelCard>
    </GlassSurface>
  </button>
);

const EventModal = ({ event, onClose }) => {
  const [index, setIndex] = useState(0);

  // Build the picture set: cover first, then any gallery images (de-duplicated).
  const images = [...new Set([event.image, ...(event.galleryImages || [])].filter(Boolean))];
  const longDesc = event.longDescription?.trim() ? event.longDescription : (event.description || '');

  // Only fetch the current image and its immediate neighbours (plus anything
  // already viewed). Avoids downloading an entire 20+ image gallery on open,
  // while keeping arrow/dot navigation instant once a slide has loaded.
  const [loaded, setLoaded] = useState(() => new Set([0]));
  useEffect(() => {
    setLoaded((prev) => {
      const next = new Set(prev);
      next.add(index);
      next.add((index + 1) % images.length);
      next.add((index - 1 + images.length) % images.length);
      return next;
    });
  }, [index, images.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  const go = (dir) => setIndex((i) => (i + dir + images.length) % images.length);

  return (
    <div className="event-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="event-modal" onClick={(e) => e.stopPropagation()}>
        <button className="event-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="event-modal-gallery">
          {/* Render every image stacked so they're all loaded up-front — switching
              is then instant (just a crossfade) instead of fetching on each click. */}
          {images.map((src, i) => (
            <img
              key={src}
              src={loaded.has(i) ? src : undefined}
              alt={`${event.name} ${i + 1}`}
              loading="lazy"
              decoding="async"
              className={`event-modal-image ${i === index ? 'active' : ''}`}
            />
          ))}
          {images.length > 1 && (
            <>
              <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
              <button className="gallery-nav next" onClick={() => go(1)} aria-label="Next image">›</button>
              <div className="gallery-dots">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={`gallery-dot ${i === index ? 'active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="event-modal-body">
          <span className={`event-status-badge ${event.status === 'past' ? 'past' : 'upcoming'}`}>
            {event.status === 'past' ? 'Past Event' : 'Upcoming Event'}
          </span>
          <h3 className="event-modal-title">{event.name}</h3>
          {longDesc
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, i) => (
              <p key={i} className="event-modal-desc">{line}</p>
            ))}
        </div>
      </div>
    </div>
  );
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const qEvents = query(collection(db, 'events'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qEvents, (snapshot) => {
      const all = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((ev) => ev.isActive !== false);
      setEvents(all);
      setLoadError(false);
    }, (error) => {
      console.error('Error fetching events:', error);
      setLoadError(true);
    });
    return () => unsub();
  }, []);

  const upcomingEvents = events.filter((ev) => (ev.status || 'upcoming') === 'upcoming');
  const pastEvents = events.filter((ev) => ev.status === 'past');

  return (
    <div className="events-page">
      <Seo description="Upcoming and past events from Team RotorFPV — drone racing competitions, workshops, and showcases at VIT." />
      <div className="events-content">
        <h2 className="events-title">
          <ShinyText text="Events" speed={3} />
        </h2>

        {upcomingEvents.length > 0 && (
          <div className="events-group">
            <h3 className="events-subheading">Upcoming Events</h3>
            <div className="events-grid">
              {upcomingEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
              ))}
            </div>
          </div>
        )}

        {pastEvents.length > 0 && (
          <div className="events-group">
            <h3 className="events-subheading">Past Events</h3>
            <div className="events-grid">
              {pastEvents.map((ev) => (
                <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
              ))}
            </div>
          </div>
        )}

        {loadError && events.length === 0 && (
          <p className="events-empty">Couldn't load events right now. Please refresh to try again.</p>
        )}
        {!loadError && events.length === 0 && (
          <p className="events-empty">No events to show yet. Check back soon!</p>
        )}
      </div>

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
};

export default Events;
