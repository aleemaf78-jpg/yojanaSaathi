# 🌱 YojanaSaathi

### Your Smart Companion for Government Schemes

YojanaSaathi is an AI-powered government scheme assistance platform designed to help farmers and rural citizens discover government schemes and understand their benefits, eligibility criteria, required documents, and application procedures.

## 🎯 Project Objective

The main objective of YojanaSaathi is to make government schemes easier to understand and accessible to everyone, especially people living in rural areas.

## ✨ Key Features

- Government scheme search
- Simple explanations of government schemes
- Eligibility information
- Benefits and required documents
- Step-by-step application guidance
- English, Hindi and Urdu website and assistant translation
- Browser-based voice input (speech-to-text)
- Spoken assistant replies (text-to-speech)
- Voice and typing modes with listening / processing status
- Scheme search and scheme details

## 🛠️ Technologies Used

**Frontend**
- HTML5
- CSS3
- JavaScript

**Backend**
- Python
- FastAPI

**Database**
- SQLite

**Tools**
- Visual Studio Code
- Git and GitHub

## 📂 Project Structure

```text
YojanaSaathi/
│
├── README.md
├── .gitignore
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
│
└── backend/
    ├── main.py
    ├── database.py
    ├── schemes.py
    └── requirements.txt
```

## 🚀 Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the Project

```bash
cd YojanaSaathi
```

### 3. Create a Virtual Environment

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

### 4. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 5. Run the Backend

```bash
uvicorn main:app --reload
```

The backend will run at:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 6. Run the Frontend

Open `YOJANA.html` using the VS Code Live Server extension. Keep the backend running at `http://127.0.0.1:8000`.

## 🌾 Initial Government Schemes

The initial project database will include:

1. PM-KISAN
2. Ayushman Bharat
3. Pradhan Mantri Awas Yojana
4. Pradhan Mantri Ujjwala Yojana

More schemes will be added in future updates.

## 🎙️ Voice Assistant Notes

The voice interface uses the browser Web Speech APIs: SpeechRecognition (where supported) for microphone input and SpeechSynthesis for spoken replies. It works best in a current version of Google Chrome or Microsoft Edge. Allow microphone permission when prompted. Speech recognition may require an internet connection and browser support varies. The current backend assistant uses multilingual query normalization, category and scheme matching against the local scheme directory. A hosted generative AI model is not connected yet.

## 🔮 Future Improvements

- Connect a generative AI model securely through the backend
- AI-based scheme recommendations
- More verified government schemes
- Improved eligibility matching
- Mobile-friendly interface

## 👩‍💻 Project Status

Currently under development.

---

**YojanaSaathi – Making Government Schemes Accessible to Everyone.**

## Welcome screen and Indian language selection

The first screen animates the existing YojanaSaathi sprout mark, then asks the visitor to choose English, Hindi or Urdu. After selection, the entire website is translated into the chosen language, the browser speaks a localized welcome greeting and offers voice or typing mode. Speech recognition and speech synthesis depend on the voices and language packs available in the visitor's browser/device; typing remains available if a language is not supported.

**Current response-language limitation:** the existing FastAPI scheme chatbot currently generates its scheme guidance in Hindi or English only. The language selector, localized welcome greeting, and browser voice locale are available for the 22 Scheduled Languages, but full translation of every scheme answer into all 22 languages still requires a multilingual AI/translation service to be connected.


## Latest update: multilingual website and expanded scheme directory

- The same shared logo asset (`assets/yojana-logo.svg`) is used in the welcome screen, header, assistant panel, chat header and footer.
- The language selector includes only English, Hindi and Urdu, as requested. The selected language is remembered in the browser and can be changed from the website header or assistant panel.
- Website text, scheme cards, scheme details and assistant replies are translated through the `deep-translator` Google Translate connector when that language is supported and an internet connection is available. If translation is unavailable, the original text is shown; check important legal/eligibility details with the official department.
- The scheme directory now contains 27 entries across agriculture, health, housing, education, pension, women and child welfare, business/livelihood, food security, water and sanitation, and skill/employment.
- The assistant matches scheme names and common keywords, and can explain benefits, eligibility, documents and application steps. It is a rule/keyword-based guide, not a generative AI model or an official eligibility decision system.
- Search and chat queries in supported non-English languages are translated to English for matching, and the response is translated back to the selected language.

### Install and run

Open a terminal in the `backend` folder and run:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `YOJANA.html` with VS Code Live Server. Translation needs internet access. Microphone input and spoken output depend on browser/device language support; Chrome or Edge on localhost is recommended.

Always verify scheme eligibility, amounts, deadlines and application steps on the official scheme portal linked in each scheme record. The scheme information is general guidance and may change.

## Multilingual text and voice assistant

- The language selector supports English, Hindi and Urdu.
- Website text, navigation, profile labels and options, scheme cards, scheme details, assistant chat history, placeholders, page title and voice-status messages follow the selected language using size-limited translation batches. Urdu also switches the page direction to right-to-left.
- Speech recognition uses the selected language code. Spoken replies select an installed browser/device voice matching that language.
- Voice availability is controlled by the browser and installed operating-system voices. If a matching voice is unavailable, the assistant keeps the translated text visible and explains that a matching voice must be installed.
- Translation requires an internet connection and the backend translation dependency.


## Profile-based scheme discovery update

- The homepage now includes a short profile form for age, state, approximate monthly family income, occupation and purpose (farming, scholarship/education, health, housing, business, pension, women/household, ration, water or all schemes).
- Submitting the form opens the assistant and returns the schemes in the selected purpose category.
- The assistant understands common Hindi, Urdu and Roman-Hindi terms for supported categories and returns all matching schemes for a category request, rather than stopping at one PM-KISAN result.
- The profile is kept in browser local storage and is sent with chat requests; it is not saved to the scheme database. Profile details do not establish eligibility. Users must verify current rules with the official scheme department.
- Website labels, navigation, profile fields/options, scheme cards and assistant replies follow the selected English, Hindi or Urdu language. Translation uses the configured online translation service and requires internet access.

**AI transparency:** Scheme matching is currently rule/keyword and category based. It is not a connected generative AI model and does not make official eligibility decisions.


### Website translation reliability fix

- Website translation requests are split into smaller batches so the backend's request-size limit is not exceeded.
- Each text item is translated independently as a batch item, avoiding the previous combined-marker approach that could lose item boundaries.
- Changing the language restores the original English strings before applying the new translation, preventing repeated translation of already-translated text.
- Online translation still requires an active internet connection; if the translation service is unavailable, the page keeps its original text rather than displaying a partial or corrupted translation.
