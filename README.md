# PI Triage System

Personal Intelligence (PI) Triage System for Sajith Pai - An AI-powered gatekeeper to filter inbound requests.

## Overview

This system acts as a first line of defense to filter 85-90% of inbound meeting requests, allowing only high-quality conversations to reach Sajith Pai.

### Key Features

- **5-Layer AI Detection**: Detects AI-generated or AI-polished content
- **Behavioral Probes**: Asymmetric questions to test authenticity
- **Signal Extraction**: Automatically extracts traction and credential signals
- **Archetype Detection**: Identifies low-signal patterns (AI for X, Uber for Y)
- **Dual-Axis Scoring**: Separate authenticity and quality scores
- **Harsh PI Persona**: Direct, skeptical, time-protective

## Project Structure

```
pi-triage/
├── api/                      # Vercel serverless functions
│   ├── health.py             # Health check endpoint
│   ├── intake.py             # Contact intake endpoint
│   └── chat.py               # Main chat endpoint
├── lib/                      # Core Python modules
│   ├── ai_detection.py       # 5-layer AI detection
│   ├── behavioral_probes.py  # Authenticity probes
│   ├── signal_extraction.py  # Traction/credential extraction
│   ├── archetype_similarity.py # Pattern detection
│   ├── scoring.py            # Dual-axis scoring
│   ├── evaluation.py         # LLM evaluation
│   ├── conversation.py       # State management
│   ├── classification.py     # Email/role classification
│   ├── prompts.py            # PI persona prompts
│   └── config.py             # Configuration
├── data/                     # Knowledge base files
├── static/                   # Frontend files
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── tests/                    # Test suite
└── vercel.json               # Vercel configuration
```

## Setup

### Prerequisites

- Python 3.8+
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   cd ~/pi-triage
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Add your knowledge base files to `data/`:
   - `personal_background.json`
   - `startup_advice.json`
   - `india_ecosystem.json`
   - `portfolio_investments.json`
   - `pitching_guide.json`

### Local Development

Run the local development server:

```bash
python run_local.py
```

Open http://localhost:3000 in your browser.

### Testing

Run the test suite:

```bash
pytest tests/ -v
```

Target: 90%+ accuracy on synthetic test cases.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. The system uses BYOK (Bring Your Own Key) mode - users provide their OpenAI API key.

## API Endpoints

### GET /api/health

Health check endpoint.

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "system": "Personal Intelligence Triage",
  "mode": "byok"
}
```

### POST /api/intake

Contact intake and classification.

Request:
```json
{
  "name": "John Doe",
  "email": "john@startup.com",
  "current_work": "Building fintech for SMBs"
}
```

Response:
```json
{
  "conversation_id": "uuid",
  "classification": "founder",
  "country_hint": "India",
  "message": "Contact information recorded."
}
```

### POST /api/chat

Main triage conversation endpoint.

Headers:
- `X-API-Key`: Your OpenAI API key

Request:
```json
{
  "message": "User message",
  "conversation_id": "uuid"
}
```

Response:
```json
{
  "id": "message-uuid",
  "message": "PI response",
  "turn_count": 1,
  "evaluation_complete": false,
  "ai_detection_this_turn": {
    "score": 0.1,
    "flags": []
  }
}
```

## Configuration

Key thresholds in `lib/config.py`:

- **AI Detection**:
  - `>= 0.7`: Immediate rejection
  - `>= 0.5`: Cap score at 2
  - `>= 0.6` + no signals: Reject

- **Scoring**:
  - 0-4: Do not recommend
  - 5-6: Refer out
  - 7: Recommend if bandwidth
  - 8-10: Recommend meeting

## Philosophy

This system is designed to be **harsh**, not helpful:

- **DO**: Be direct, skeptical, demand specifics
- **DON'T**: Be encouraging, offer mentorship, say "interesting!"

The goal is to protect Sajith's time by filtering out low-signal requests.

## License

Private - Not for redistribution.
