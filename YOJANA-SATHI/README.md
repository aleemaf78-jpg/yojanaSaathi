# YojanaSaathi

YojanaSaathi is a local-first government scheme discovery and guidance website for citizens, farmers and families in India.

## What's included in this update

- Responsive frontend with a white, green and saffron visual theme.
- Searchable scheme cards, category filters and a detailed scheme modal.
- Hindi/English voice input using the browser Web Speech API (Chrome/Edge support varies by device).
- Spoken assistant replies using browser text-to-speech, with an on/off control.
- FastAPI backend with scheme search, details, health and chat endpoints.
- SQLite database seeded with 24 scheme information records.
- Simple keyword/category matching to suggest relevant schemes from the local database.

**Important:** Voice input/output is implemented in the browser. The current assistant uses database-backed matching and prepared guidance; it is not connected to a hosted large language model. No paid AI API key is required for this local version. Scheme information is general guidance, not an eligibility decision. Always verify current rules, dates and benefits with the official department or portal.

## Project structure

```text
YOJANA-SATHI/
├── YOJANA.html
├── style.css
├── script.js
├── README.md
└── backend/
    ├── main.py
    ├── database.py
    ├── schemes.py
    ├── requirements.txt
    └── yojana.db (created/updated automatically)
```

## Run on Windows

1. Open the `YOJANA-SATHI` folder in VS Code.
2. Open Terminal and run:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

3. Keep that terminal open. The API runs at `http://127.0.0.1:8000`.
4. Open a second VS Code terminal, go to the project root and start the frontend with the VS Code Live Server extension by right-clicking `YOJANA.html` and choosing **Open with Live Server**.
5. Visit `http://127.0.0.1:8000/docs` to inspect the API endpoints.

The first backend start creates or updates `backend/yojana.db` and seeds the scheme records. Existing database rows are updated by scheme name; the database file is not deleted.

## Voice assistant notes

- Use a supported browser such as recent Chrome or Edge.
- Allow microphone access when the browser asks.
- Use the Hindi/English toggle in the chat header to choose the voice recognition language.
- Browser speech recognition may require an internet connection and may not work in every browser/device.
- Use the speaker toggle to enable or disable spoken answers.

## API endpoints

- `GET /` – API welcome and scheme count
- `GET /health` – health check
- `GET /schemes?q=farmer` – search schemes
- `GET /schemes/{id}` – scheme details
- `POST /chat` – database-backed assistant response

Example chat body:

```json
{"message":"Tell me about farmer schemes"}
```

## Notes for GitHub

Do not commit `venv/`, `.venv/`, `__pycache__/`, `.env` or local secrets. Keep `requirements.txt` so the environment can be recreated. Review official scheme notifications periodically because eligibility, benefit amounts and application windows can change.
