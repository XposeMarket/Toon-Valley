#!/bin/bash
cd "$(dirname "$0")"
PORT=8080
printf '\nStarting Toon Valley at http://localhost:%s\n\n' "$PORT"
python3 -m http.server "$PORT" &
SERVER_PID=$!
sleep 1
open "http://localhost:$PORT"
wait "$SERVER_PID"
