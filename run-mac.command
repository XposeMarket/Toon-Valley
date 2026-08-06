#!/bin/bash
cd "$(dirname "$0")" || exit 1
PORT=8080
printf '\nStarting Toon Valley at http://localhost:%s\n' "$PORT"
printf 'Keep this window open while playing. Press Control-C to stop.\n\n'
python3 -m http.server "$PORT" &
SERVER_PID=$!
sleep 1
open "http://localhost:$PORT"
wait "$SERVER_PID"
