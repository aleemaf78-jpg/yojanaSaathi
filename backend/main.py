from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import initialize_database, get_all_schemes, get_scheme_by_id
from translation import translate_text, translate_record, translate_many, to_english

app = FastAPI(title="YojanaSaathi API", description="Multilingual government scheme information assistant")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    initialize_database()

class ChatRequest(BaseModel):
    message: str
    language: str = "en-IN"
    profile: dict = {}

@app.get("/")
def home():
    return {"message": "Welcome to YojanaSaathi API", "status": "running"}

@app.get("/schemes")
def schemes_list(q: str = "", lang: str = "en-IN"):
    search_query = to_english(q) if q else q
    return [translate_record(item, lang) for item in get_all_schemes(search_query)]

@app.get("/schemes/{scheme_id}")
def scheme_details(scheme_id: int, lang: str = "en-IN"):
    scheme = get_scheme_by_id(scheme_id)
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return translate_record(scheme, lang)

@app.post("/translate")
def translate_api(payload: dict):
    text = str(payload.get("text", ""))
    language = str(payload.get("language", "en-IN"))
    if len(text) > 4500:
        raise HTTPException(status_code=413, detail="Text is too long to translate")
    return {"translated": translate_text(text, language), "language": language}

@app.post("/translate-batch")
def translate_batch(payload: dict):
    items = payload.get("items", [])
    language = str(payload.get("language", "en-IN"))
    if not isinstance(items, list) or len(items) > 120 or sum(len(str(x)) for x in items) > 4500:
        raise HTTPException(status_code=413, detail="Translation batch is too large")
    return {"translations": translate_many([str(x) for x in items], language), "language": language}

CATEGORY_TERMS = {
    "Agriculture": ["farmer", "farming", "agriculture", "crop", "kisan", "kheti", "fasal", " खेती", "किसान", "खेती", "فصل", "کسان", "کاشتکاری"],
    "Health": ["health", "medical", "hospital", "treatment", "medicine", "swasthya", "इलाज", "स्वास्थ्य", "علاج", "صحت"],
    "Housing": ["housing", "house", "home", "makan", "awas", "ghar", "घर", "मकान", "گھر", "مکان"],
    "Education": ["student", "scholarship", "education", "school", "college", "padhai", "छात्र", "पढ़ाई", "छात्रवृत्ति", "تعلیم", "وظیفہ", "اسکالرشپ"],
    "Business & Livelihood": ["business", "shop", "vendor", "loan", "employment", "rozgar", "व्यापार", "दुकान", "रोजगार", "کاروبار", "روزگار", "قرض"],
    "Pension & Social Security": ["pension", "old age", "widow", "divyang", "बुढ़ापा", "विधवा", "पेंशन", "پنشن", "بیوہ"],
    "Women & Household": ["women", "woman", "gas connection", "ujjwala", "महिला", "गैस", "خواتین", "گیس"],
    "Food Security": ["ration", "food grain", "ration card", "राशन", "راشن"],
    "Water & Sanitation": ["water", "toilet", "sanitation", "पानी", "शौचालय", "پانی", "صفائی"],
}


def detect_category(text):
    lowered = text.casefold()
    for category, terms in CATEGORY_TERMS.items():
        if any(term.casefold() in lowered for term in terms):
            return category
    return None


@app.post("/chat")
def chatbot(request: ChatRequest):
    message = request.message.strip()
    language = request.language if request.language in {"en-IN", "hi-IN", "ur-IN"} else "en-IN"
    if not message:
        return {"reply": translate_text("Please type or say your question.", language), "language": language, "schemes": []}

    # Always normalize the user's message, even if the website language is English.
    # This allows Hindi, Urdu and common Roman-Hindi/Hinglish questions to be understood.
    normalized = to_english(message).casefold()
    all_schemes = get_all_schemes()
    profile = request.profile or {}
    purpose = str(profile.get("purpose", "")).strip()
    profile_category = detect_category(purpose)
    category = detect_category(normalized) or profile_category

    # A category/purpose request should return every scheme in that category,
    # not only the first keyword match.
    wants_category_list = bool(category and (
        any(term in normalized for term in ["scheme", "yojana", "support", "help", "benefit", "options", "all", "which", "what", "show", "list", "for me"])
        or len(normalized.split()) <= 7
        or not message
    ))

    if purpose.casefold() == "all" or (not category and any(term in normalized for term in ["all schemes", "all government schemes", "sabhi yojana", "saari yojana", "सभी योजनाएं", "تمام اسکیمیں"])):
        matched = all_schemes
        body = "Here are all schemes currently available in the YojanaSaathi directory:\n\n" + "\n\n".join(
            f"{item['name']} ({item['category']}) — {item['description']} Benefits: {item['benefits']} Eligibility: {item['eligibility']} How to apply: {item['application']} Official information: {item['official_url']}"
            for item in matched
        )
    elif wants_category_list:
        matched = [item for item in all_schemes if item["category"] == category]
        if not matched:
            matched = [item for item in all_schemes if category.casefold() in item["category"].casefold()]
        lines = [f"Here are the schemes related to {category}:"]
        for item in matched:
            lines.append(f"• {item['name']} — {item['description']} Benefits: {item['benefits']} Eligibility: {item['eligibility']} Documents: {item['documents']} How to apply: {item['application']} Official information: {item['official_url']}")
        body = "\n\n".join(lines) if matched else f"I could not find schemes under {category} in the current directory."
    else:
        # Score exact scheme names and keyword phrases, avoiding weak one-word matches.
        scored = []
        for item in all_schemes:
            phrases = [item["name"].casefold()] + [x.strip().casefold() for x in item.get("keywords", "").split(",") if len(x.strip()) > 2]
            score = max((4 if phrase in normalized else 0 for phrase in phrases), default=0)
            if score:
                scored.append((score, item))
        matched = [item for _, item in sorted(scored, key=lambda pair: pair[0], reverse=True)]
        if not matched and category:
            matched = [item for item in all_schemes if item["category"] == category]
        if matched:
            item = matched[0]
            body = (f"{item['name']} ({item['category']})\n{item['description']}\nBenefits: {item['benefits']}\nEligibility: {item['eligibility']}\nDocuments: {item['documents']}\nHow to apply: {item['application']}\nOfficial information: {item['official_url']}")
        elif any(word in normalized for word in ["hello", "hi", "namaste", "salaam", "नमस्ते", "السلام"]):
            body = "Welcome to YojanaSaathi! Tell me what you need help with: farming, scholarship or education, health, housing, business, pension, ration or another purpose. I can show you the related schemes."
        else:
            categories = sorted({item["category"] for item in all_schemes})
            body = f"I can help you explore {len(all_schemes)} schemes across these areas: {', '.join(categories)}. Tell me your purpose, for example farming, scholarship, health, housing, business or pension, and I will show the related schemes."

    reply = translate_text(body, language)
    return {
        "reply": reply,
        "language": language,
        "matched_scheme": matched[0]["name"] if matched else None,
        "matched_count": len(matched),
        "matched_schemes": [item["name"] for item in matched],
        "source": "YojanaSaathi scheme directory",
        "note": translate_text("General guidance only. Confirm current eligibility, deadlines and documents on the official portal or with the relevant department.", language)
    }
