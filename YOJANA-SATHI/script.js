const API_URL = "http://127.0.0.1:8000";
let activeFilter = "all";
let cachedSchemes = [];
let recognition = null;
let voiceReplies = true;
let isListening = false;
let inputLanguage = "hi-IN";

const $ = id => document.getElementById(id);

async function loadSchemes(query = "") {
  const list = $("schemeList");
  list.innerHTML = '<div class="loading-card">Finding useful schemes for you…</div>';
  try {
    const response = await fetch(`${API_URL}/schemes?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Could not load schemes");
    cachedSchemes = await response.json();
    renderSchemes();
  } catch (error) {
    list.innerHTML = '<div class="loading-card">Could not connect to YojanaSaathi. Please start the FastAPI backend and refresh this page.</div>';
    $("schemeCount").textContent = "Server not connected";
  }
}

function renderSchemes() {
  const list = $("schemeList");
  const filtered = activeFilter === "all" ? cachedSchemes : cachedSchemes.filter(s => (s.category || "").toLowerCase().includes(activeFilter));
  $("schemeCount").textContent = `${filtered.length} schemes to explore`;
  if (!filtered.length) {
    list.innerHTML = '<div class="loading-card">No matching schemes found. Try another search or category.</div>';
    return;
  }
  list.innerHTML = filtered.map(s => `
    <article class="scheme-card">
      <div class="scheme-card-top"><span class="scheme-emoji">${escapeHtml(s.icon || "🌿")}</span><span class="scheme-category">${escapeHtml(s.category || "General")}</span></div>
      <h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p>
      <button type="button" data-scheme-id="${s.id}">Explore details <span>→</span></button>
    </article>`).join("");
  list.querySelectorAll("[data-scheme-id]").forEach(button => button.addEventListener("click", () => viewScheme(button.dataset.schemeId)));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

async function viewScheme(id) {
  try {
    const response = await fetch(`${API_URL}/schemes/${id}`);
    if (!response.ok) throw new Error("Scheme not found");
    const s = await response.json();
    $("modalTitle").textContent = s.name;
    $("modalDescription").textContent = s.description;
    $("modalBenefits").textContent = s.benefits;
    $("modalEligibility").textContent = s.eligibility;
    $("modalDocuments").textContent = s.documents;
    $("modalApplication").textContent = s.application;
    $("schemeModal").classList.add("open");
    $("schemeModal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  } catch (error) { setVoiceStatus("Could not load scheme details."); }
}

function closeModal() {
  $("schemeModal").classList.remove("open");
  $("schemeModal").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function addMessage(message, type) {
  const chat = $("chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${type === "user" ? "user-bubble" : "bot-bubble"}`;
  bubble.textContent = message;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function setVoiceStatus(message) { $("voiceStatus").textContent = message; }

async function sendMessage(messageOverride) {
  const input = $("userMessage");
  const message = (messageOverride || input.value).trim();
  if (!message) return;
  addMessage(message, "user");
  input.value = "";
  setVoiceStatus("YojanaSaathi is preparing an answer…");
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({message})
    });
    if (!response.ok) throw new Error("Assistant request failed");
    const data = await response.json();
    addMessage(data.reply, "bot");
    setVoiceStatus("Answer ready");
    if (voiceReplies) speak(data.reply, data.language || detectLanguage(message));
  } catch (error) {
    const reply = "I cannot reach the server right now. Please check that the YojanaSaathi backend is running.";
    addMessage(reply, "bot");
    setVoiceStatus("Connection problem");
  }
}

function detectLanguage(text) {
  return /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";
}

function speak(text, language = "en-IN") {
  if (!("speechSynthesis" in window)) { setVoiceStatus("Voice replies are not supported in this browser."); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = 0.94;
  utterance.onstart = () => setVoiceStatus("Speaking your answer…");
  utterance.onend = () => setVoiceStatus("Your assistant is ready");
  utterance.onerror = () => setVoiceStatus("Could not play the voice reply");
  window.speechSynthesis.speak(utterance);
}

function setupVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("micButton").disabled = true;
    $("micButton").title = "Voice input is not supported in this browser";
    setVoiceStatus("Voice input needs a supported browser such as Chrome or Edge.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    isListening = true;
    $("micButton").classList.add("listening");
    $("micButton").setAttribute("aria-label", "Stop voice input");
    setVoiceStatus("Listening… Speak now in Hindi or English.");
  };
  recognition.onresult = event => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      else interimText += event.results[i][0].transcript;
    }
    if (finalText) { $("userMessage").value = finalText; setVoiceStatus("Got it. Sending your question…"); sendMessage(finalText); }
    else if (interimText) setVoiceStatus(`Hearing: ${interimText}`);
  };
  recognition.onerror = event => setVoiceStatus(event.error === "not-allowed" ? "Microphone permission was denied. Allow it in your browser settings." : `Voice input issue: ${event.error}`);
  recognition.onend = () => {
    isListening = false;
    $("micButton").classList.remove("listening");
    $("micButton").setAttribute("aria-label", "Start voice input");
  };
}

$("chatForm").addEventListener("submit", event => { event.preventDefault(); sendMessage(); });
$("micButton").addEventListener("click", () => {
  if (!recognition) { setupVoiceInput(); if (!recognition) return; }
  if (isListening) recognition.stop(); else {
    recognition.lang = inputLanguage;
    try { recognition.start(); } catch (error) { setVoiceStatus("Please wait a moment and try the microphone again."); }
  }
});
$("languageToggle").addEventListener("click", () => {
  inputLanguage = inputLanguage === "hi-IN" ? "en-IN" : "hi-IN";
  $("languageToggle").textContent = inputLanguage === "hi-IN" ? "हिंदी · EN" : "EN · हिंदी";
  setVoiceStatus(inputLanguage === "hi-IN" ? "Voice input language: Hindi" : "Voice input language: English");
});
$("speakToggle").addEventListener("click", () => {
  voiceReplies = !voiceReplies;
  $("speakToggle").textContent = voiceReplies ? "🔊 Voice replies on" : "🔇 Voice replies off";
  $("speakToggle").setAttribute("aria-pressed", String(voiceReplies));
  if (!voiceReplies && "speechSynthesis" in window) window.speechSynthesis.cancel();
});
$("searchButton").addEventListener("click", () => loadSchemes($("searchInput").value.trim()));
$("searchInput").addEventListener("keydown", event => { if (event.key === "Enter") loadSchemes(event.target.value.trim()); });
$("filterRow").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  $("filterRow").querySelectorAll("button").forEach(b => b.classList.toggle("active", b === button));
  renderSchemes();
});
$("schemeList").addEventListener("click", event => { if (event.target.closest("[data-scheme-id]")) return; });
$("modalClose").addEventListener("click", closeModal);
$("schemeModal").addEventListener("click", event => { if (event.target.dataset.close) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
$("menuToggle").addEventListener("click", () => $("navLinks").classList.toggle("open"));
$("navLinks").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("navLinks").classList.remove("open")));
document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => sendMessage(button.dataset.prompt)));
setupVoiceInput();
loadSchemes();
