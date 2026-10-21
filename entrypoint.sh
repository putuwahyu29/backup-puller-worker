#!/bin/bash
set -e

mkdir -p /app/runtime/temp /app/runtime/state
umask 0000

exec node src/index.js "$@"
