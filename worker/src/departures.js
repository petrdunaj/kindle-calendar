// Wiener Linien open real-time API ("monitor"), see
// https://www.wienerlinien.at/ogd_realtime/doku/
const MONITOR_URL = 'https://www.wienerlinien.at/ogd_realtime/monitor';
const MAX_DEPARTURES = 4;

export function monitorUrl(divas) {
    const ids = divas.filter((d) => /^\d{1,10}$/.test(d));
    if (!ids.length) throw new Error('no valid DIVA numbers configured');
    return MONITOR_URL + '?' + ids.map((d) => 'diva=' + d).join('&');
}

/**
 * Compacts the monitor response to one entry per line + direction:
 * [{ line: '18', towards: 'Stadion U', dir: 1, type: 'ptTram', mins: [2, 10, 20] }]
 * `dir` is Wiener Linien's richtungsId (1/2). Unlike `towards` it is stable: tram 71
 * towards the city ends at Schottenring U or short-turns at Schwarzenbergplatz.
 * `mins` are minutes until departure (real-time where available), ascending.
 */
export function parseMonitor(json) {
    const byKey = {};
    const order = [];
    ((json.data && json.data.monitors) || []).forEach((m) => {
        (m.lines || []).forEach((l) => {
            const key = l.name + '|' + l.towards;
            if (!byKey[key]) {
                byKey[key] = { line: l.name, towards: l.towards, dir: Number(l.richtungsId) || 0, type: l.type, mins: [] };
                order.push(key);
            }
            ((l.departures && l.departures.departure) || []).forEach((d) => {
                const c = d.departureTime && d.departureTime.countdown;
                if (typeof c === 'number' && byKey[key].mins.indexOf(c) === -1) byKey[key].mins.push(c);
            });
        });
    });
    return order.map((k) => {
        const e = byKey[k];
        e.mins.sort((a, b) => a - b);
        e.mins = e.mins.slice(0, MAX_DEPARTURES);
        return e;
    });
}
