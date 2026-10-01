import ICAL from 'ical.js';

export const TZ = 'Europe/Prague';

const DAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const MONTH_GENITIVE = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
    'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];

const MAX_ITERATIONS = 50000;

const partsFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// Wall-clock fields of an instant in a given IANA zone.
function wallParts(ms, tz) {
    const fmt = tz === TZ ? partsFormat : new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const p = {};
    fmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = parseInt(x.value, 10); });
    return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
}

// Instant (ms) whose wall clock in `tz` equals the given fields.
function wallToInstant(f, tz) {
    const guess = Date.UTC(f.y, f.mo - 1, f.d, f.h, f.mi, f.s);
    // Two passes handle DST transitions.
    let ms = guess;
    for (let i = 0; i < 2; i++) {
        const w = wallParts(ms, tz);
        const back = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
        ms += guess - back;
    }
    return ms;
}

function isIana(tz) {
    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: tz });
        return true;
    } catch (e) {
        return false;
    }
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function dateKey(y, mo, d) {
    return y + '-' + pad(mo) + '-' + pad(d);
}

// Midnight Prague of (today + offset days), as instant, plus its date key.
function pragueDay(nowMs, offset) {
    const w = wallParts(nowMs, TZ);
    // Use UTC arithmetic on the calendar date only, then map back to an instant.
    const base = new Date(Date.UTC(w.y, w.mo - 1, w.d + offset));
    const f = { y: base.getUTCFullYear(), mo: base.getUTCMonth() + 1, d: base.getUTCDate(), h: 0, mi: 0, s: 0 };
    return {
        startMs: wallToInstant(f, TZ),
        key: dateKey(f.y, f.mo, f.d),
        label: DAY_NAMES[base.getUTCDay()] + ', ' + f.d + '. ' + MONTH_GENITIVE[f.mo - 1],
        y: f.y, mo: f.mo, d: f.d,
    };
}

function registerTimezones(root) {
    root.getAllSubcomponents('vtimezone').forEach((vtz) => {
        const tz = new ICAL.Timezone(vtz);
        if (!ICAL.TimezoneService.has(tz.tzid)) {
            ICAL.TimezoneService.register(tz.tzid, tz);
        }
    });
}

// Converts an ICAL.Time from the event to an instant in ms.
// `srcTzid` is the TZID parameter of the master DTSTART (if any).
function toInstant(time, srcTzid) {
    if (srcTzid && isIana(srcTzid) && !ICAL.TimezoneService.has(srcTzid)) {
        return wallToInstant(
            { y: time.year, mo: time.month, d: time.day, h: time.hour, mi: time.minute, s: time.second },
            srcTzid);
    }
    return time.toUnixTime() * 1000;
}

function allDayInfo(time) {
    return { y: time.year, mo: time.month, d: time.day };
}

/**
 * Collects occurrences overlapping [windowStart, windowEnd) from an ICS text.
 * Returns [{ title, allDay, startMs, endMs, allDayStart?, allDayEndExclusive? }]
 */
export function occurrencesFromIcs(icsText, windowStartMs, windowEndMs) {
    const out = [];
    const root = new ICAL.Component(ICAL.parse(icsText));
    registerTimezones(root);

    const masters = {};
    const exceptions = [];
    root.getAllSubcomponents('vevent').forEach((vevent) => {
        if (vevent.hasProperty('recurrence-id')) {
            exceptions.push(vevent);
        } else {
            masters[vevent.getFirstPropertyValue('uid')] = vevent;
        }
    });

    const events = {};
    Object.keys(masters).forEach((uid) => { events[uid] = new ICAL.Event(masters[uid]); });
    exceptions.forEach((vevent) => {
        const master = events[vevent.getFirstPropertyValue('uid')];
        if (master) master.relateException(new ICAL.Event(vevent));
    });

    Object.keys(events).forEach((uid) => {
        const ev = events[uid];
        const status = (ev.component.getFirstPropertyValue('status') || '').toString().toUpperCase();
        if (status === 'CANCELLED') return;
        if (!ev.startDate) return;

        const dtstartProp = ev.component.getFirstProperty('dtstart');
        const srcTzid = dtstartProp ? dtstartProp.getParameter('tzid') : null;

        const consider = (details) => {
            const item = details.item;
            if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
            const start = details.startDate;
            const end = details.endDate;
            const title = item.summary || '(bez názvu)';

            if (start.isDate) {
                const s = allDayInfo(start);
                const e = allDayInfo(end);
                const startMs = wallToInstant({ ...s, h: 0, mi: 0, s: 0 }, TZ);
                const endMs = wallToInstant({ ...e, h: 0, mi: 0, s: 0 }, TZ);
                if (endMs > windowStartMs && startMs < windowEndMs) {
                    out.push({ title, allDay: true, startMs, endMs });
                }
            } else {
                const startMs = toInstant(start, srcTzid);
                let endMs = toInstant(end, srcTzid);
                if (endMs < startMs) endMs = startMs;
                const overlaps = endMs > startMs
                    ? endMs > windowStartMs && startMs < windowEndMs
                    : startMs >= windowStartMs && startMs < windowEndMs;
                if (overlaps) out.push({ title, allDay: false, startMs, endMs });
            }
        };

        if (!ev.isRecurring()) {
            consider(ev.getOccurrenceDetails(ev.startDate));
            return;
        }

        // The iterator must start at the real series start (passing another start
        // time would redefine DTSTART). Skip cheaply until near the window; the
        // margins cover multi-day events and wall-clock vs zone error.
        const iter = ev.iterator();
        const skipBefore = windowStartMs - 14 * 86400000;
        const stopAfter = windowEndMs + 2 * 86400000;
        let next;
        let n = 0;
        while ((next = iter.next()) && n++ < MAX_ITERATIONS) {
            const approx = Date.UTC(next.year, next.month - 1, next.day, next.hour, next.minute, next.second);
            if (approx > stopAfter) break;
            if (approx < skipBefore) continue;
            consider(ev.getOccurrenceDetails(next));
        }
    });

    return out;
}

function hhmm(ms) {
    const w = wallParts(ms, TZ);
    return pad(w.h) + ':' + pad(w.mi);
}

/**
 * sources: [{ label, ics }]
 * Returns { now, days: [{ date, label, events: [...] }] }
 */
export function buildDays(sources, nowMs, dayCount) {
    const days = [];
    for (let i = 0; i < dayCount; i++) days.push(pragueDay(nowMs, i));
    const windowStart = days[0].startMs;
    const windowEnd = pragueDay(nowMs, dayCount).startMs;

    const result = days.map((d) => ({ date: d.key, label: d.label, events: [] }));

    sources.forEach((src) => {
        occurrencesFromIcs(src.ics, windowStart, windowEnd).forEach((o) => {
            days.forEach((day, idx) => {
                const dayEnd = idx + 1 < days.length ? days[idx + 1].startMs : windowEnd;
                const inDay = o.endMs > o.startMs
                    ? o.endMs > day.startMs && o.startMs < dayEnd
                    : o.startMs >= day.startMs && o.startMs < dayEnd;
                if (!inDay) return;
                const startsToday = o.startMs >= day.startMs;
                const endsToday = o.endMs <= dayEnd;
                result[idx].events.push({
                    src: src.label,
                    title: o.title,
                    allDay: o.allDay,
                    start: o.allDay || !startsToday ? null : hhmm(o.startMs),
                    end: o.allDay || !endsToday || o.endMs === o.startMs ? null : hhmm(o.endMs),
                    sortKey: o.allDay ? -1 : (startsToday ? o.startMs : day.startMs),
                });
            });
        });
    });

    result.forEach((day) => {
        day.events.sort((a, b) => a.sortKey - b.sortKey || a.title.localeCompare(b.title, 'cs'));
        day.events.forEach((e) => { delete e.sortKey; });
    });

    const w = wallParts(nowMs, TZ);
    return {
        now: { y: w.y, mo: w.mo, d: w.d, h: w.h, mi: w.mi, wd: new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay() },
        days: result,
    };
}
