# Team RotorFPV Website

The public and administrative website for Team RotorFPV. It presents the team’s activities and lets authorised team members manage published content.

## Events

**Event**:
A published Team RotorFPV activity with a scheduled date range, a cover image, optional gallery, and descriptive content.

**Event Schedule**:
The India-local start and end date-times for an Event. Its start date is required; its end date defaults to the same date after an explicit one-day confirmation. An all-day schedule starts at 12:00 AM on its start date and ends at 11:59 PM on its end date; specifying either time requires both.
_Avoid_: Event status

**Upcoming Event**:
An Event whose Event Schedule has not yet started. It may publish an Event Call to Action.

**Ongoing Event**:
An Event whose Event Schedule has started but has not yet finished. It is not open for event calls to action.
_Avoid_: Current event

**Past Event**:
An Event whose Event Schedule has finished.

**Event Call to Action**:
An optional outbound HTTP or HTTPS link published for an Upcoming Event, labelled either Register or Explore.
_Avoid_: Registration link

**Homepage Event Ticker**:
A right-to-left strip immediately below the navigation bar. It scrolls upward with the homepage hero and fades on the same timeline as the hero quote. It contains Homepage Event Announcements.
_Avoid_: Tracker

**Homepage Event Announcement**:
An item in the Homepage Event Ticker. It either opens an Upcoming Event's Event Call to Action in a new tab or navigates to and highlights an Ongoing Event on the Events page.

## Board

**Public Board Profile**:
The public identity of a Board member, limited to name, image, Board role, LinkedIn, and GitHub. It is separate from the private User record.
_Avoid_: User profile, Board user
