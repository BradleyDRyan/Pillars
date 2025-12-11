#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
export $(grep -v '^#' .env | xargs)
python bot.py

