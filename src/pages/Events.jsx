import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase';
import ShinyText from '../components/ShinyText';
import GlassSurface from '../components/GlassSurface';
import PixelCard from '../components/PixelCard';
import Seo from '../components/Seo';
import useEventNow from '../hooks/useEventNow';
import { getEventCallToAction, getEventGroups, getEventLifecycle } from '../lib/eventSchedule';
import './Events.css';

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}).format(new Date(`${value}T00:00:00Z`));

const formatEventSchedule = (event) => {
  const endDate = event.endDate || event.startDate;
  const dateRange = event.startDate === endDate
    ? formatDate(event.startDate)
    : `${formatDate(event.startDate)} – ${formatDate(endDate)}`;

  return event.startTime && event.endTime
    ? `${dateRange} · ${event.startTime} – ${event.endTime} IST`
    : `${dateRange} · All day`;
};

const lifecycleLabel = (lifecycle) => `${lifecycle[0].toUpperCase()}${lifecycle.slice(1)} Event`;

const EventCallToAction = ({ callToAction }) => callToAction && (
  <a className="event-cta" href={callToAction.url} target="_blank" rel="noopener noreferrer">
    {callToAction.label}
  </a>
);

const EventCard = ({ event, lifecycle, now, onClick, highlighted }) => {
  const callToAction = getEventCallToAction(event, now);

  return (
    <article id={`event-${event.id}`} className={`event-card ${highlighted ? 'event-card-highlighted' : ''}`}>
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
              <span className={`event-status-badge ${lifecycle}`}>{lifecycleLabel(lifecycle)}</span>
              <p className="event-schedule">{formatEventSchedule(event)}</p>
              {event.description && <p className="event-desc">{event.description}</p>}
            </div>
          </PixelCard>
        </GlassSurface>
      </button>
      <EventCallToAction callToAction={callToAction} />
    </article>
  );
};

const EventModal = ({ event, lifecycle, now, onClose }) => {
  const [index, setIndex] = useState(0);
  const images = [...new Set([event.image, ...(event.galleryImages || [])].filter(Boolean))];
  const longDesc = event.longDescription?.trim() ? event.longDescription : (event.description || '');
  const callToAction = getEventCallToAction(event, now);

  useEffect(() => {
    const onKey = (keyEvent) => {
      if (keyEvent.key === 'Escape') onClose();
      else if (keyEvent.key === 'ArrowRight') setIndex((current) => (current + 1) % images.length);
      else if (keyEvent.key === 'ArrowLeft') setIndex((current) => (current - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [images.length, onClose]);

  const go = (direction) => setIndex((current) => (current + direction + images.length) % images.length);

  return (
    <div className="event-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="event-modal" onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <button className="event-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="event-modal-gallery">
          {images.map((source, imageIndex) => (
            <img
              key={source}
              src={source}
              alt={`${event.name} ${imageIndex + 1}`}
              loading="lazy"
              decoding="async"
              className={`event-modal-image ${imageIndex === index ? 'active' : ''}`}
            />
          ))}
          {images.length > 1 && (
            <>
              <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
              <button className="gallery-nav next" onClick={() => go(1)} aria-label="Next image">›</button>
              <div className="gallery-dots">
                {images.map((_, imageIndex) => (
                  <button
                    key={imageIndex}
                    className={`gallery-dot ${imageIndex === index ? 'active' : ''}`}
                    onClick={() => setIndex(imageIndex)}
                    aria-label={`Go to image ${imageIndex + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="event-modal-body">
          <span className={`event-status-badge ${lifecycle}`}>{lifecycleLabel(lifecycle)}</span>
          <h3 className="event-modal-title">{event.name}</h3>
          <p className="event-schedule">{formatEventSchedule(event)}</p>
          {longDesc.split('\n').filter((line) => line.trim() !== '').map((line, lineIndex) => (
            <p key={lineIndex} className="event-modal-desc">{line}</p>
          ))}
          <EventCallToAction callToAction={callToAction} />
        </div>
      </div>
    </div>
  );
};

const EventGroup = ({ title, events, lifecycle, now, onSelect, highlightedEventId }) => events.length > 0 && (
  <section className="events-group" aria-labelledby={`${lifecycle}-events`}>
    <h3 id={`${lifecycle}-events`} className="events-subheading">{title}</h3>
    <div className="events-grid">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          lifecycle={lifecycle}
          now={now}
          onClick={() => onSelect(event)}
          highlighted={event.id === highlightedEventId}
        />
      ))}
    </div>
  </section>
);

const Events = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [highlightedEventId, setHighlightedEventId] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const now = useEventNow();
  const location = useLocation();
  const highlightTimerRef = useRef(null);
  const groups = getEventGroups(events, now);
  const selectedLifecycle = selectedEvent ? getEventLifecycle(selectedEvent, now) : null;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      setEvents(snapshot.docs.map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() })));
      setLoadError(false);
    }, (error) => {
      console.error('Error fetching events:', error);
      setLoadError(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const eventId = new URLSearchParams(location.search).get('event');
    if (!eventId || !events.some((event) => event.id === eventId)) return undefined;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`event-${eventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedEventId(eventId);
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setHighlightedEventId(null), 2400);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(highlightTimerRef.current);
    };
  }, [events, location.search]);

  const hasEvents = groups.ongoing.length + groups.upcoming.length + groups.past.length > 0;

  return (
    <div className="events-page">
      <Seo description="Ongoing, upcoming, and past events from Team RotorFPV — drone racing competitions, workshops, and showcases at VIT." />
      <div className="events-content">
        <h2 className="events-title"><ShinyText text="Events" speed={3} /></h2>
        <EventGroup title="Ongoing Events" events={groups.ongoing} lifecycle="ongoing" now={now} onSelect={setSelectedEvent} highlightedEventId={highlightedEventId} />
        <EventGroup title="Upcoming Events" events={groups.upcoming} lifecycle="upcoming" now={now} onSelect={setSelectedEvent} highlightedEventId={highlightedEventId} />
        <EventGroup title="Past Events" events={groups.past} lifecycle="past" now={now} onSelect={setSelectedEvent} highlightedEventId={highlightedEventId} />
        {loadError && !hasEvents && <p className="events-empty">Couldn't load events right now. Please refresh to try again.</p>}
        {!loadError && !hasEvents && <p className="events-empty">No events to show yet. Check back soon!</p>}
      </div>
      {selectedEvent && selectedLifecycle && <EventModal event={selectedEvent} lifecycle={selectedLifecycle} now={now} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
};

export default Events;
