import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventCallToAction, getEventGroups, getHomepageEventAnnouncements, getEventLifecycle, validateEventSchedule } from './eventSchedule.js';

const allDayEvent = {
  startDate: '2026-08-18',
  endDate: '2026-08-21'
};

test('all-day Event Schedule follows inclusive India-local dates', () => {
  assert.equal(getEventLifecycle(allDayEvent, new Date('2026-08-17T18:29:00.000Z')), 'upcoming');
  assert.equal(getEventLifecycle(allDayEvent, new Date('2026-08-18T18:30:00.000Z')), 'ongoing');
  assert.equal(getEventLifecycle(allDayEvent, new Date('2026-08-21T18:29:00.000Z')), 'ongoing');
  assert.equal(getEventLifecycle(allDayEvent, new Date('2026-08-21T18:30:00.000Z')), 'past');
});

test('custom Event Schedule times must be paired and must not reverse the schedule', () => {
  assert.equal(validateEventSchedule({ startDate: '2026-08-18', startTime: '10:00' }), 'Enter both a start time and an end time.');
  assert.equal(validateEventSchedule({ startDate: '2026-08-18', endDate: '2026-08-17' }), 'The end of an Event Schedule cannot be before its start.');
  assert.equal(validateEventSchedule({ startDate: '2026-08-18', endDate: '2026-08-18', startTime: '10:00', endTime: '12:00' }), null);
});

test('custom Event Schedule changes state at the exact India-local second', () => {
  const event = { startDate: '2026-08-18', endDate: '2026-08-18', startTime: '10:00', endTime: '12:00' };
  assert.equal(getEventLifecycle(event, new Date('2026-08-18T04:29:59.000Z')), 'upcoming');
  assert.equal(getEventLifecycle(event, new Date('2026-08-18T04:30:00.000Z')), 'ongoing');
  assert.equal(getEventLifecycle(event, new Date('2026-08-18T06:30:01.000Z')), 'past');
});

test('Event Call to Action is available only for an active Upcoming Event', () => {
  const event = {
    ...allDayEvent,
    isActive: true,
    ctaUrl: 'http://example.com/register',
    ctaLabel: 'register'
  };

  assert.deepEqual(getEventCallToAction(event, new Date('2026-08-17T18:29:00.000Z')), {
    url: 'http://example.com/register',
    label: 'Register'
  });
  assert.equal(getEventCallToAction(event, new Date('2026-08-18T18:30:00.000Z')), null);
  assert.equal(getEventCallToAction({ ...event, isActive: false }, new Date('2026-08-17T18:29:00.000Z')), null);
});

test('Event Schedule groups and ticker announcements follow lifecycle ordering', () => {
  const now = new Date('2026-08-19T06:00:00.000Z');
  const events = [
    { id: 'past', name: 'Past', startDate: '2026-08-10', endDate: '2026-08-11' },
    { id: 'later', name: 'Later', startDate: '2026-08-25', endDate: '2026-08-25', ctaUrl: 'https://example.com/later', ctaLabel: 'explore' },
    { id: 'ongoing-later', name: 'Ongoing Later', startDate: '2026-08-18', endDate: '2026-08-22' },
    { id: 'next', name: 'Next', startDate: '2026-08-20', endDate: '2026-08-20', ctaUrl: 'https://example.com/next', ctaLabel: 'register' },
    { id: 'ongoing-soon', name: 'Ongoing Soon', startDate: '2026-08-18', endDate: '2026-08-20' },
    { id: 'inactive', name: 'Inactive', startDate: '2026-08-20', endDate: '2026-08-20', isActive: false, ctaUrl: 'https://example.com/inactive' }
  ];

  const groups = getEventGroups(events, now);
  assert.deepEqual(groups.ongoing.map((event) => event.id), ['ongoing-soon', 'ongoing-later']);
  assert.deepEqual(groups.upcoming.map((event) => event.id), ['next', 'later']);
  assert.deepEqual(groups.past.map((event) => event.id), ['past']);
  assert.deepEqual(getHomepageEventAnnouncements(events, now).map((item) => `${item.type}:${item.event.id}`), [
    'ongoing:ongoing-soon',
    'ongoing:ongoing-later',
    'cta:next',
    'cta:later'
  ]);
});
