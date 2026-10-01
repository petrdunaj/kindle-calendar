#!/bin/sh
# Keeps the Kindle awake and opens /mnt/us/calendar.html in the browser.
DIR="$(dirname "$0")"
PIDFILE=/tmp/calendar-keepawake.pid

# Disable the screensaver / auto-sleep.
lipc-set-prop com.lab126.powerd preventScreenSaver 1

# Belt and braces: re-assert every 5 min in case powerd resets it
# (e.g. after Wi-Fi or power events).
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    :
else
    (
        while true; do
            sleep 300
            lipc-set-prop com.lab126.powerd preventScreenSaver 1
        done
    ) >/dev/null 2>&1 &
    echo $! > "$PIDFILE"
fi

# Open the page in the experimental browser.
lipc-set-prop com.lab126.appmgrd start "app://com.lab126.browser?view=file:///mnt/us/calendar.html"
