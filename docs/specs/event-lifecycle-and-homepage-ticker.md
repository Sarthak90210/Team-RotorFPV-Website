# Events: lifecycle, calls to action, and homepage ticker

## Problem Statement

Visitors cannot tell which Team RotorFPV events are currently happening, which are still open for registration or exploration, or which have already finished. Event visibility is manually categorised and manually ordered, so it can become inaccurate over time. The homepage has no timely, scroll-aware event announcements, and event links cannot be managed consistently across cards, details, and the homepage.

## Solution

Manage each Event with an India-local Event Schedule and automatically classify it as an Upcoming Event, Ongoing Event, or Past Event. Display the three lifecycle groups on the Events page in relevance order. Allow an Upcoming Event to publish an optional Event Call to Action labelled Register or Explore. Publish qualifying Upcoming Events and every Ongoing Event through a Homepage Event Ticker beneath the navigation bar, using the sponsor loop’s right-to-left interaction pattern while scrolling and fading with the homepage hero quote.

## User Stories

1. As a visitor, I want Events grouped into Ongoing, Upcoming, and Past sections, so that I immediately understand each Event’s current lifecycle state.
2. As a visitor, I want Ongoing Events to appear before Upcoming and Past Events, so that live activities are most prominent.
3. As a visitor, I want Upcoming Events ordered by their nearest start date, so that I see the next opportunity first.
4. As a visitor, I want Ongoing Events ordered by the soonest end date, so that events nearing completion are easy to identify.
5. As a visitor, I want Past Events ordered by their most recent end date, so that recent activity is easy to discover.
6. As a visitor, I want an Event’s visible state to update automatically from its Event Schedule, so that no administrator has to move it between sections manually.
7. As a visitor, I want all Event times interpreted in India time, so that the displayed lifecycle is consistent regardless of where I open the site.
8. As a visitor, I want an all-day Event to remain Ongoing through its selected end date, so that a multi-day event does not become Past at the beginning of its final day.
9. As a visitor, I want a Register call to action on an Upcoming Event card when registration is available, so that I can begin registration immediately.
10. As a visitor, I want an Explore call to action on an Upcoming Event card when additional event information is available elsewhere, so that I can continue learning about the Event.
11. As a visitor, I want the same Event Call to Action in the Event detail popup, so that I can read the Event description and then continue to its destination.
12. As a visitor, I want Event Call to Action links to open in a new tab, so that I do not lose my place on the Team RotorFPV website.
13. As a visitor, I want Ongoing Events to have no Register or Explore call to action, so that I am not sent to a registration or exploration destination after the Event has started.
14. As a visitor, I want the Homepage Event Ticker to advertise Upcoming Events only when they have an Event Call to Action, so that every Upcoming announcement is actionable.
15. As a visitor, I want the Homepage Event Ticker to announce Ongoing Events, so that I know when Team RotorFPV is active right now.
16. As a visitor, I want clicking an Ongoing Event announcement to take me to and briefly highlight its Event card, so that I can find the corresponding Event on the Events page.
17. As a visitor, I want the Homepage Event Ticker to move right-to-left and pause with the same interaction behaviour as the sponsor loop, so that announcements are readable and usable.
18. As a visitor, I want the Homepage Event Ticker to move upward and fade away with the hero quote as I scroll, so that it does not intrude on the rest of the homepage.
19. As an administrator, I want to enter a required Event start date, so that every new Event has an automatic lifecycle.
20. As an administrator, I want the Event end date to default to the start date only after a one-day-event warning, so that I do not accidentally publish a multi-day Event as a one-day Event.
21. As an administrator, I want to enter both start and end times when an Event has custom times, so that its boundaries are unambiguous.
22. As an administrator, I want all-day Events to default to 12:00 AM on the start date through 11:59 PM on the end date in India time, so that a date range has predictable behaviour.
23. As an administrator, I want to choose Register or Explore when adding an Event Call to Action, so that visitors understand the purpose of the link.
24. As an administrator, I want to enter any external HTTP or HTTPS destination for an Event Call to Action, so that I can use registration forms, event sites, short links, and other campaign pages.
25. As an administrator, I want manual status and manual ordering removed from the Event workflow, so that schedules are the single source of truth.
26. As an administrator, I want inactive Events excluded from public Events and Homepage Event Ticker views, so that unpublished content remains private.
27. As an administrator, I want all existing Firestore Event documents removed before I begin adding scheduled Events, so that the new workflow starts without legacy records.

## Implementation Decisions

- An Event Schedule is the source of truth for all public Event lifecycle decisions. It has a required start date, an end date that may be confirmed as the same date, and optional custom start and end times.
- Event lifecycle is derived in India time: an Event is Upcoming before its schedule starts, Ongoing from its start through its end, and Past after its end. All-day schedules begin at 12:00 AM on their start date and end at 11:59 PM on their end date.
- If a custom time is supplied, both start and end times are required. End date-time must not precede start date-time.
- The persisted Event data removes manual lifecycle status and manual order. Existing cover image, gallery, short description, long description, and active visibility concepts remain.
- An Event Call to Action is optional and consists of a destination URL plus a required Register or Explore label. It is public only while its Event is Upcoming and active.
- Event Call to Action destinations accept external HTTP and HTTPS URLs and open in a new tab with protections against opener access.
- The public Events experience derives one of three groups: Ongoing, Upcoming, and Past. Empty groups are omitted. Ongoing appears first, followed by Upcoming and then Past.
- Ongoing Events sort by earliest end date-time, Upcoming Events by earliest start date-time, and Past Events by most recent end date-time.
- Upcoming Event cards and Event detail popups show their Event Call to Action. Ongoing and Past Event cards and popups do not show an Event Call to Action.
- The Homepage Event Ticker contains active Ongoing Events and active Upcoming Events with an Event Call to Action. Ongoing announcements navigate internally to the corresponding Event card and briefly highlight it; Upcoming announcements open their Call to Action destination in a new tab.
- The Homepage Event Ticker sits immediately below the navigation bar during the homepage hero. It moves right-to-left, inherits the sponsor loop’s pause interaction behaviour, and follows the hero quote’s upward movement and fade progression while the visitor scrolls.
- A single event-schedule domain seam determines lifecycle state, group ordering, Event Call to Action eligibility, and Homepage Event Ticker eligibility from Event data and the current India-local time. Public and admin consumers use this seam rather than independently reimplementing date logic.
- Before release, delete every document in the Firestore `events` collection. Do not delete Cloudinary assets as part of this reset.
- The homepage title, description, and accessibility text are updated to include the Ongoing lifecycle and Homepage Event Ticker behaviour.

## Testing Decisions

- Tests assert externally observable lifecycle outcomes rather than component internals or CSS implementation details.
- The event-schedule domain seam receives Event data and an explicit India-local current time, allowing deterministic tests at start, end, date-only, and custom-time boundaries.
- Tests cover all-day one-day Events, all-day multi-day Events, custom-time Events, invalid reversed schedules, India-time rollover, and the transitions between Upcoming, Ongoing, and Past.
- Tests cover eligibility for Event Call to Actions and Homepage Event Announcements, including inactive Events, missing links, Register labels, Explore labels, Ongoing internal navigation, and Past Event exclusion.
- Tests cover automatic ordering for each lifecycle group, including ties and Events that cross date boundaries.
- UI-level tests verify visible section order, visible call-to-action behaviour, ticker item destinations, new-tab external links, and the Ongoing Event card highlight destination.
- Animation tests verify the intended public behaviour only: ticker announcements pause when interacted with and share the hero quote’s scroll-fade progression. They do not assert internal animation implementation details.
- The repository currently has backend test precedent but no frontend Event test suite. This feature introduces focused tests at the event-schedule seam and targeted public UI behaviour tests.

## Out of Scope

- Building a registration form or event-information site.
- Collecting registrations, payments, attendance, capacity, waitlists, or registration analytics.
- Editing Cloudinary assets during the Firestore Event reset.
- Migrating existing Event documents to the new Event Schedule model.
- Changing sponsor-loop behaviour outside of reusing its interaction pattern for the Homepage Event Ticker.
- Adding Event notifications outside the homepage, such as email, push notifications, or social-media posting.

## Further Notes

- The existing Event records are intentionally discarded rather than migrated. Administrators will recreate any required Event with a complete Event Schedule.
- The Homepage Event Ticker is not a generic notice system. It is limited to active Ongoing Events and active Upcoming Events that have a Register or Explore Event Call to Action.
- The Event Call to Action label communicates intent only; both labels can point to any externally managed HTTP or HTTPS page.
