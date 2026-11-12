from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from database import initialize_database, get_all_schemes, get_scheme_by_id

app = FastAPI(title="YojanaSaathi API", version="2.0.0", description="Government scheme discovery and guidance API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    initialize_database()

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def home():
    return {"message": "Welcome to YojanaSaathi API", "version": "2.0.0", "schemes": len(get_all_schemes())}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/schemes")
def schemes_list(q: str = "", category: str = ""):
    results = get_all_schemes(q)
    if category:
        results = [s for s in results if category.lower() in (s.get("category") or "").lower()]
    return results

@app.get("/schemes/{scheme_id}")
def scheme_details(scheme_id: int):
    scheme = get_scheme_by_id(scheme_id)
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return scheme

@app.post("/chat")
def chatbot(request: ChatRequest):
    message = request.message.strip().lower()
    if not message:
        raise HTTPException(status_code=400, detail="Please enter a question")
    all_schemes = get_all_schemes()
    words = {
        "farmer": ["farmer", "kisan", "agriculture", "crop", "fasal", "खेती", "किसान", "फसल"],
        "health": ["health", "hospital", "medical", "ayushman", "बीमा", "इलाज", "स्वास्थ्य"],
        "housing": ["house", "home", "awas", "housing", " मकान", "घर", "आवास"],
        "women": ["woman", "women", "girl", "ujjwala", "maternity", "महिला", "बेटी", "गर्भवती"],
        "education": ["student", "school", "college", "scholarship", "study", "education", "छात्र", "पढ़ाई", "स्कॉलरशिप"],
        "finance": ["pension", "loan", "business", "vendor", "artisan", "finance", "पेंशन", "लोन", "दुकान"]
    }
    greetings = ["hello", "hi", "hey", "namaste", "नमस्ते", "हाय", "सलाम"]
    if any(re.search(rf"\b{re.escape(g)}\b", message) for g in greetings) or message.strip() in greetings:
        reply = "Namaste! 🙏 Main YojanaSaathi hoon. Aap farmer support, health, housing, women welfare, education ya pension/loan schemes ke baare mein pooch sakte hain. Aap Hindi ya English mein sawaal kar sakte hain."
        return {"reply": reply, "language": "hi-IN" if any("\u0900" <= c <= "\u097f" for c in request.message) else "en-IN", "schemes": []}

    ranked = []
    for scheme in all_schemes:
        text = " ".join([scheme.get("name", ""), scheme.get("description", ""), scheme.get("category", "")]).lower()
        score = sum(3 for term in [scheme.get("name", "").lower()] if term and term in message)
        score += sum(2 for term in words.get(scheme.get("category", ""), []) if term in message)
        stop_words = {"scheme", "yojana", "pradhan", "mantri", "national", "for", "the", "and", "under", "with"}
        score += sum(2 for term in scheme.get("name", "").lower().replace("–", " ").replace("-", " ").split() if len(term) > 3 and term not in stop_words and term in message)
        if score:
            ranked.append((score, scheme))
    ranked.sort(key=lambda item: item[0], reverse=True)
    matches = [item[1] for item in ranked[:3]]
    hindi = any("\u0900" <= c <= "\u097f" for c in request.message)
    if matches:
        names = ", ".join(s["name"] for s in matches)
        if hindi:
            reply = f"Aapke sawaal ke liye ye yojanayein relevant ho sakti hain: {names}. Inki eligibility, benefits aur documents alag-alag ho sakte hain. Details dekhne ke liye scheme card par 'Explore details' select karein. Aap apni age, state aur occupation batayenge toh main aur relevant options suggest kar sakta/sakti hoon."
        else:
            reply = f"These schemes may be relevant to your question: {names}. Eligibility and benefits vary by scheme. Open a scheme card to review its details. If you share your state, age group and occupation (no sensitive ID numbers), I can help narrow the options."
        return {"reply": reply, "language": "hi-IN" if hindi else "en-IN", "schemes": [{"id": s["id"], "name": s["name"]} for s in matches]}

    if hindi:
        reply = "Main aapki madad kar sakta/sakti hoon. Kripya batayein aapko kis cheez ki zaroorat hai — kheti, ilaaj, ghar, padhai, mahila kalyan, pension ya business loan? Main available scheme information ke aadhar par raasta bataunga/bataungi."
    else:
        reply = "I can help you explore available schemes. Are you looking for support with farming, healthcare, housing, education, women and family welfare, pension or a small business? Tell me your need in simple words."
    return {"reply": reply, "language": "hi-IN" if hindi else "en-IN", "schemes": []}
