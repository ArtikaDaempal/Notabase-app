#!/bin/bash
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
exec node node_modules/.bin/next dev -p 3000
