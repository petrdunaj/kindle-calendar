import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDays } from '../src/events.js';

// Thursday 2026-10-01 10:00 Prague (CEST, UTC+2)
const NOW = Date.UTC(2026, 9, 1, 8, 0, 0);

const google = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a1
DTSTART:20261001T070000Z
DTEND:20261001T080000Z
SUMMARY:UTC standup
END:VEVENT
BEGIN:VEVENT
UID:a2
DTSTART;TZID=Europe/Prague:20261001T140000
DTEND;TZID=Europe/Prague:20261001T153000
SUMMARY:Prague tz meeting
END:VEVENT
BEGIN:VEVENT
UID:a3
DTSTART;VALUE=DATE:20261002
DTEND;VALUE=DATE:20261003
SUMMARY:All day thing
END:VEVENT
BEGIN:VEVENT
UID:a4
DTSTART;TZID=Europe/Prague:20260101T180000
DTEND;TZID=Europe/Prague:20260101T190000
RRULE:FREQ=WEEKLY;BYDAY=TH,FR
EXDATE;TZID=Europe/Prague:20261002T180000
SUMMARY:Yoga
END:VEVENT
BEGIN:VEVENT
UID:a5
DTSTART;TZID=Europe/Prague:20261001T230000
DTEND;TZID=Europe/Prague:20261002T010000
SUMMARY:Overnight
END:VEVENT
BEGIN:VEVENT
UID:a6
DTSTART;TZID=Europe/Prague:20261001T120000
DTEND;TZID=Europe/Prague:20261001T130000
STATUS:CANCELLED
SUMMARY:Cancelled
END:VEVENT
END:VCALENDAR`;

const outlook = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:W. Europe Standard Time
BEGIN:STANDARD
DTSTART:16010101T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010101T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
UID:o1
DTSTART;TZID=W. Europe Standard Time:20261001T090000
DTEND;TZID=W. Europe Standard Time:20261001T100000
SUMMARY:Outlook sync
END:VEVENT
BEGIN:VEVENT
UID:o2
DTSTART;TZID=W. Europe Standard Time:20260105T110000
DTEND;TZID=W. Europe Standard Time:20260105T113000
RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR
SUMMARY:Daily
END:VEVENT
BEGIN:VEVENT
UID:o2
RECURRENCE-ID;TZID=W. Europe Standard Time:20261002T110000
DTSTART;TZID=W. Europe Standard Time:20261002T160000
DTEND;TZID=W. Europe Standard Time:20261002T163000
SUMMARY:Daily (moved)
END:VEVENT
END:VCALENDAR`;

const show = (d) => d.events.map((e) => `${e.src} ${e.allDay ? 'ALLDAY' : (e.start || '..') + '-' + (e.end || '..')} ${e.title}`);
const both = [{ label: 'Z', ics: google }, { label: 'wh', ics: outlook }];

test('now and day labels are in Prague time', () => {
  const r = buildDays(both, NOW, 3);
  assert.deepEqual(r.now, { y: 2026, mo: 10, d: 1, h: 10, mi: 0, wd: 4 });
  assert.deepEqual(r.days.map((d) => d.label), ['Čtvrtek, 1. října', 'Pátek, 2. října', 'Sobota, 3. října']);
});

test('today: UTC, TZID, Windows TZID and recurring events are placed and sorted', () => {
  assert.deepEqual(show(buildDays(both, NOW, 3).days[0]), [
    'wh 09:00-10:00 Outlook sync',
    'Z 09:00-10:00 UTC standup',
    'wh 11:00-11:30 Daily',
    'Z 14:00-15:30 Prague tz meeting',
    'Z 18:00-19:00 Yoga',
    'Z 23:00-.. Overnight',
  ]);
});

test('tomorrow: all-day first, EXDATE dropped, moved instance used, overnight tail kept', () => {
  assert.deepEqual(show(buildDays(both, NOW, 3).days[1]), [
    'Z ALLDAY All day thing',
    'Z ..-01:00 Overnight',
    'wh 16:00-16:30 Daily (moved)',
  ]);
});

test('weekend day has no weekday-only events; cancelled events never appear', () => {
  const r = buildDays(both, NOW, 3);
  assert.deepEqual(r.days[2].events, []);
  assert.ok(!JSON.stringify(r).includes('Cancelled'));
});

test('DST switch day (2026-10-25) keeps wall-clock times', () => {
  const r = buildDays(both, Date.UTC(2026, 9, 25, 6, 0, 0), 1);
  // 25 Oct 2026 is a Sunday: Daily (Mon-Fri) must not appear, Yoga (Thu/Fri) neither.
  assert.deepEqual(show(r.days[0]), []);
});

test('sunday 2026-10-04 -> Monday 5th: Daily at 11:00 regardless of DST offset', () => {
  const r = buildDays(both, Date.UTC(2026, 9, 5, 6, 0, 0), 1);
  assert.deepEqual(show(r.days[0]), ['wh 11:00-11:30 Daily']);
});
