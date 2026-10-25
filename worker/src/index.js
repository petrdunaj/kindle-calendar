import { buildDays } from './events.js';
import { monitorUrl, parseMonitor } from './departures.js';

const DAY_COUNT = 3;
const CACHE_SECONDS = 300;
const DEPARTURES_CACHE_SECONDS = 20;
const DEFAULT_DIVAS = '60201425,60200763'; // St. Marx, St. Marx/Leberstraße
const CALLBACK_RE = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

function js(body, status) {
    return new Response(body, {
        status: status || 200,
        headers: {
            'content-type': 'application/javascript; charset=utf-8',
            'cache-control': 'no-store',
        },
    });
}

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function fetchIcs(url, ctx) {
    const cache = caches.default;
    const cacheKey = new Request('https://ics-cache.invalid/' + encodeURIComponent(url));
    let res = await cache.match(cacheKey);
    if (!res) {
        const upstream = await fetch(url, { headers: { accept: 'text/calendar' } });
        if (!upstream.ok) throw new Error('HTTP ' + upstream.status);
        res = new Response(await upstream.text(), {
            headers: { 'cache-control': 'max-age=' + CACHE_SECONDS },
        });
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    return res.text();
}

async function departures(env, cb) {
    try {
        const divas = (env.DEPARTURE_DIVAS || DEFAULT_DIVAS).split(',').map((d) => d.trim());
        const upstream = await fetch(monitorUrl(divas), {
            cf: { cacheTtl: DEPARTURES_CACHE_SECONDS, cacheEverything: true },
        });
        if (!upstream.ok) throw new Error('HTTP ' + upstream.status);
        const lines = parseMonitor(await upstream.json());
        return js(cb + '(' + JSON.stringify({ generated: Date.now(), lines }) + ');');
    } catch (e) {
        return js('/* upstream error: ' + String(e.message).replace(/\*\//g, '') + ' */', 502);
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname !== '/events.js' && url.pathname !== '/departures.js') {
            return js('/* not found */', 404);
        }

        if (!env.ACCESS_TOKEN || !safeEqual(url.searchParams.get('token') || '', env.ACCESS_TOKEN)) {
            return js('/* forbidden */', 403);
        }

        const isDepartures = url.pathname === '/departures.js';
        const cb = url.searchParams.get('cb') || (isDepartures ? 'renderDepartures' : 'renderEvents');
        if (!CALLBACK_RE.test(cb)) return js('/* bad callback */', 400);

        if (isDepartures) return departures(env, cb);

        const configured = [
            { label: env.GOOGLE_LABEL || 'G', url: env.GOOGLE_ICS_URL },
            { label: env.OUTLOOK_LABEL || 'O', url: env.OUTLOOK_ICS_URL },
        ].filter((s) => s.url);

        const errors = [];
        const sources = [];
        await Promise.all(configured.map(async (s) => {
            try {
                sources.push({ label: s.label, ics: await fetchIcs(s.url, ctx) });
            } catch (e) {
                errors.push(s.label + ': ' + e.message);
            }
        }));

        let data;
        try {
            data = buildDays(sources, Date.now(), DAY_COUNT);
        } catch (e) {
            return js('/* parse error: ' + String(e.message).replace(/\*\//g, '') + ' */', 500);
        }
        data.errors = errors;

        return js(cb + '(' + JSON.stringify(data) + ');');
    },
};
