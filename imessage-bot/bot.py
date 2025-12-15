#!/usr/bin/env python3
"""
iMessage AI Bot - Self-hosted on your Mac
Monitors Messages.app and responds using Claude
"""

import sys
# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

import sqlite3
import subprocess
import time
import os
from datetime import datetime
from anthropic import Anthropic

# Config
MESSAGES_DB = os.path.expanduser("~/Library/Messages/chat.db")
POLL_INTERVAL = 2  # seconds
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

# Track processed messages
processed_messages = set()
conversations = {}  # phone -> message history

SYSTEM_PROMPT = """You are a thoughtful AI coach helping people build better habits and live more intentionally. 

Keep responses concise (1-3 sentences usually) since this is a text conversation. Be warm but direct. Ask good questions. Don't be preachy.

If someone is just saying hi or starting a conversation, greet them warmly and ask what's on their mind."""

def get_anthropic_client():
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")
    return Anthropic(api_key=ANTHROPIC_API_KEY)

def send_imessage(phone: str, message: str):
    """Send an iMessage using AppleScript"""
    # Escape quotes in message
    escaped_message = message.replace('"', '\\"').replace("'", "'\"'\"'")
    
    script = f'''
    tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "{phone}" of targetService
        send "{escaped_message}" to targetBuddy
    end tell
    '''
    
    try:
        subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
        print(f"✅ Sent to {phone}: {message[:50]}...")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to send: {e.stderr.decode()}")
        return False

def get_new_messages():
    """Read new incoming messages from Messages.app database"""
    conn = sqlite3.connect(MESSAGES_DB)
    cursor = conn.cursor()
    
    # Query for recent incoming messages (is_from_me = 0)
    query = """
    SELECT 
        message.ROWID,
        message.text,
        message.date,
        message.is_from_me,
        handle.id as phone
    FROM message
    JOIN handle ON message.handle_id = handle.ROWID
    WHERE message.is_from_me = 0
    AND message.text IS NOT NULL
    AND message.date > ?
    ORDER BY message.date DESC
    LIMIT 20
    """
    
    # Apple's date format: nanoseconds since 2001-01-01
    # Get messages from last 5 minutes
    five_min_ago = (time.time() - 978307200 - 300) * 1000000000
    
    cursor.execute(query, (five_min_ago,))
    messages = cursor.fetchall()
    conn.close()
    
    return messages

def get_ai_response(phone: str, message: str) -> str:
    """Get response from Claude"""
    client = get_anthropic_client()
    
    # Get or create conversation history
    if phone not in conversations:
        conversations[phone] = []
    
    # Add user message to history
    conversations[phone].append({"role": "user", "content": message})
    
    # Keep last 20 messages for context
    history = conversations[phone][-20:]
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=history
    )
    
    assistant_message = response.content[0].text
    
    # Add assistant response to history
    conversations[phone].append({"role": "assistant", "content": assistant_message})
    
    return assistant_message

def main():
    print("🚀 iMessage Bot Starting...")
    print(f"📱 Monitoring: {MESSAGES_DB}")
    print(f"⏱️  Poll interval: {POLL_INTERVAL}s")
    print("-" * 40)
    
    # Initial scan to mark existing messages as processed
    existing = get_new_messages()
    for msg in existing:
        processed_messages.add(msg[0])  # ROWID
    print(f"📨 Found {len(existing)} existing messages (skipping)")
    print("👀 Watching for new messages...\n")
    
    while True:
        try:
            messages = get_new_messages()
            
            for rowid, text, date, is_from_me, phone in messages:
                if rowid in processed_messages:
                    continue
                    
                processed_messages.add(rowid)
                
                print(f"📩 New message from {phone}: {text}")
                
                # Get AI response
                try:
                    response = get_ai_response(phone, text)
                    print(f"🤖 Response: {response}")
                    
                    # Send via iMessage
                    send_imessage(phone, response)
                    
                except Exception as e:
                    print(f"❌ Error getting AI response: {e}")
                    send_imessage(phone, "Sorry, I'm having trouble right now. Try again in a moment!")
                
                print()
                
        except Exception as e:
            print(f"❌ Error: {e}")
        
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()



