# Task Planning Assistant

A simple web app where the UI controls what the AI agent can do. The agent can't just chat freely - it has to follow specific rules set by the interface.

## How to Run

```bash
npm install
npm start
# Go to http://localhost:3000
```

## System Design: UI vs Agent vs Memory

I split the system into three parts:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│       UI        │    │      Agent       │    │     Memory      │
│                 │    │                  │    │                 │
│ • Input Forms   │◄──►│ • Task Logic     │◄──►│ • Task List     │
│ • Action Buttons│    │ • Response Gen   │    │ • Current State │
│ • Status Display│    │ • Confidence     │    │ • Confidence    │
│ • Constraints   │    │ • State Updates  │    │ • Session Data  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**UI**: Controls everything the agent can do - limits responses to 120 characters, only shows specific buttons
**Agent**: Handles the task logic and decides what to respond, but can't break UI rules
**Memory**: Keeps track of all tasks, completion status, and how confident the agent is

This separation means the agent can't go rogue - the UI always stays in control.

## Error Handling Example

**What happens when something goes wrong:**

If a user tries to create an empty task:
1. Agent catches the bad input
2. Confidence drops to 20% (shows uncertainty)
3. Shows "Task too short" message (under 120 chars)
4. UI turns red to signal error
5. "Retry" button appears
6. User can fix it without losing their other tasks

The system doesn't crash or lose data - it just guides the user to fix the problem.

## Why This Can't Work as Regular Chat

### 1. **No Length Control**
Regular chat lets AI write paragraphs. My system cuts off at exactly 120 characters, forcing short, clear responses.

### 2. **No Structure**
Chat is just text back and forth. My system uses:
- Forms that prevent bad input
- Buttons that eliminate confusion
- Visual indicators for immediate feedback

### 3. **No Visual State**
Chat can't show:
- How confident the AI is right now
- Task progress at a glance
- System status with colors
- Error states visually

### 4. **Fake Confidence**
Most chat AI acts confident even when it shouldn't. My system:
- Shows uncertainty with a confidence meter
- Drops confidence when tasks get complex
- Asks for human help instead of guessing
- Explains why confidence changed

Basically, chat would remove all the safety controls I built in.