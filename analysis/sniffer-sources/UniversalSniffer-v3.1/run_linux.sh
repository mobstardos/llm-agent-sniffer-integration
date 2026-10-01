#!/bin/sh
# Universal Sniffer — запуск на Linux/macOS
cd "$(dirname "$0")"
exec python3 sniffer.py "$@"
