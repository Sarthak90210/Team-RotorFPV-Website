const INDIA_TIME_ZONE = 'Asia/Kolkata';

const formatIndiaDateTime = (now) => {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
};

const getScheduleBoundary = (event, boundary) => {
  const isStart = boundary === 'start';
  const date = isStart ? event.startDate : (event.endDate || event.startDate);
  const time = isStart ? (event.startTime || '00:00') : (event.endTime || '23:59');
  const hasCustomTime = Boolean(isStart ? event.startTime : event.endTime);
  const seconds = hasCustomTime || isStart ? '00' : '59';

  return `${date}T${time}:${seconds}`;
};

const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const isTime = (value) => /^\d{2}:\d{2}$/.test(value || '');

export const isExternalEventUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateEventSchedule = (event) => {
  if (!isDate(event?.startDate)) return 'Enter an Event start date.';

  const endDate = event.endDate || event.startDate;
  if (!isDate(endDate)) return 'Enter a valid Event end date.';

  const hasStartTime = Boolean(event.startTime);
  const hasEndTime = Boolean(event.endTime);
  if (hasStartTime !== hasEndTime) return 'Enter both a start time and an end time.';
  if ((hasStartTime && !isTime(event.startTime)) || (hasEndTime && !isTime(event.endTime))) {
    return 'Enter valid Event times.';
  }

  if (getScheduleBoundary({ ...event, endDate }, 'end') < getScheduleBoundary(event, 'start')) {
    return 'The end of an Event Schedule cannot be before its start.';
  }

  return null;
};

export const getEventLifecycle = (event, now = new Date()) => {
  if (validateEventSchedule(event)) return null;

  const current = formatIndiaDateTime(now);
  if (current < getScheduleBoundary(event, 'start')) return 'upcoming';
  if (current > getScheduleBoundary(event, 'end')) return 'past';
  return 'ongoing';
};

export const getEventCallToAction = (event, now = new Date()) => {
  if (event?.isActive === false || getEventLifecycle(event, now) !== 'upcoming' || !isExternalEventUrl(event?.ctaUrl)) {
    return null;
  }

  return {
    url: event.ctaUrl,
    label: event.ctaLabel === 'explore' ? 'Explore' : 'Register'
  };
};

const compareByBoundary = (boundary, direction = 'ascending') => (first, second) => {
  const comparison = getScheduleBoundary(first, boundary).localeCompare(getScheduleBoundary(second, boundary));
  return direction === 'descending' ? -comparison : comparison;
};

export const getEventGroups = (events, now = new Date(), { includeInactive = false } = {}) => {
  const groups = { ongoing: [], upcoming: [], past: [] };

  events.forEach((event) => {
    if (!includeInactive && event?.isActive === false) return;

    const lifecycle = getEventLifecycle(event, now);
    if (lifecycle) groups[lifecycle].push(event);
  });

  groups.ongoing.sort(compareByBoundary('end'));
  groups.upcoming.sort(compareByBoundary('start'));
  groups.past.sort(compareByBoundary('end', 'descending'));
  return groups;
};

export const getHomepageEventAnnouncements = (events, now = new Date()) => {
  const groups = getEventGroups(events, now);
  const ongoing = groups.ongoing.map((event) => ({ type: 'ongoing', event }));
  const upcoming = groups.upcoming.flatMap((event) => {
    const callToAction = getEventCallToAction(event, now);
    return callToAction ? [{ type: 'cta', event, callToAction }] : [];
  });

  return [...ongoing, ...upcoming];
};
