# Kindle smart calendar

Wall calendar for a Kindle 8 (Touch, FW 5.16.2.1.1) showing Google + Outlook events.

```
Google / Outlook  --ICS-->  Cloudflare Worker  --JSONP-->  calendar.html (Kindle browser)
```

## 1. Worker (free Cloudflare account)

1. Get private ICS links
   - Google: Calendar settings → your calendar → **Secret address in iCal format**
   - Outlook: Settings → Calendar → Shared calendars → **Publish a calendar** → ICS link
     (if your employer blocks publishing, this source needs Microsoft Graph instead)
2. Deploy:
   ```sh
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put GOOGLE_ICS_URL
   npx wrangler secret put OUTLOOK_ICS_URL
   npx wrangler secret put ACCESS_TOKEN     # any long random string
   npx wrangler deploy
   ```
   Source labels (the box left of each event) are `GOOGLE_LABEL` / `OUTLOOK_LABEL` in `worker/wrangler.toml`.
3. Check: `curl "https://kindle-cal.<you>.workers.dev/events.js?token=<ACCESS_TOKEN>"`
   (wrong token → 403).
4. Tests: `cd worker && npm test`

## 2. Page on the Kindle

1. `cp config.example.js config.js` and fill in the Worker URL and token (`config.js` is gitignored).
2. Copy `calendar.html` and `config.js` to the Kindle root (`/Volumes/Kindle/`), eject.
3. Wi-Fi on; open `file:///mnt/us/calendar.html` in the experimental browser.

Events refresh every 10 min without a full reload; a full reload happens once a night (~03:00).
The footer shows the last update time, or `OFFLINE` after 30 min without data.

## 3. Staying awake

The Kindle sleeps after idle time; page reloads do not count as activity.

**Try first (no risk):** wall charger on a smart plug, 1 min on / 4 min off. Not the laptop
(USB-drive mode hides the browser). Leave it 30+ min. Unverified that this resets the timer on 5.16.

**Reliable: jailbreak.** Firmware 5.16.2.1.1 is jailbreakable. Turn airplane mode on *now* so it can't
auto-update past the exploit, then follow <https://kindlemodding.org> (LanguageBreak / WinterBreak,
hotfix, KUAL). Then copy `kindle/extensions/calendar/` to `/Volumes/Kindle/extensions/calendar/` and run
**KUAL → Calendar → Start calendar (stay awake)**. It sets
`lipc-set-prop com.lab126.powerd preventScreenSaver 1` and opens the page.

Not tested on a device: the `appmgrd start app://com.lab126.browser?view=...` line in `bin/start.sh`
may need adjusting on 5.16; if the browser opens without the page, open `calendar.html` by hand once.
