#!/bin/sh
PIDFILE=/tmp/calendar-keepawake.pid
if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
fi
lipc-set-prop com.lab126.powerd preventScreenSaver 0
