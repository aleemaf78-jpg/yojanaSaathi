const API_URL = "http://127.0.0.1:8000";
const chat = document.getElementById("chatMessages");
const input = document.getElementById("userMessage");
const languageSelect = document.getElementById("languageSelect");
const siteLanguageSelect = document.getElementById("siteLanguageSelect");
const micButton = document.getElementById("micButton");
const stopButton = document.getElementById("stopButton");
const statusText = document.getElementById("statusText");
const voiceStatus = document.getElementById("voiceStatus");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let speakReplies = true;
let shouldRestart = false;
let statusRequestId = 0;
let voiceList = [];
const translationCache = new Map();

// Keep the language selector simple: English, Hindi and Urdu only.
const LANGUAGES = [
  { name: "English", native: "English", code: "en-IN", greeting: "Welcome to YojanaSaathi! How may I help you?" },
  { name: "Hindi", native: "हिन्दी", code: "hi-IN", greeting: "योजना साथी में आपका स्वागत है! मैं आपकी कैसे मदद कर सकता हूँ?" },
  { name: "Urdu", native: "اردو", code: "ur-IN", greeting: "یوجنا ساتھی میں خوش آمدید! میں آپ کی کیا مدد کر سکتا ہوں؟" }
];
let userProfile = JSON.parse(localStorage.getItem("yojanaProfile") || "{}");

function populateLanguageOptions(select) {
  select.replaceChildren();
  LANGUAGES.forEach(language => {
    const option = document.createElement("option");
    option.value = language.code;
    option.textContent = `${language.native} — ${language.name}`;
    select.appendChild(option);
  });
}

const staticTextNodes = [];
const translatableAttributes = [];
const translatableOptions = [];

function collectStaticText() {
  if (staticTextNodes.length) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue.trim() || parent.closest("script,style,option,svg,.brand,.footer-brand,.welcome-card h1,.chat-title b")) continue;
    staticTextNodes.push({ node, original: node.nodeValue });
  }
  document.querySelectorAll("#profileOccupation option, #profilePurpose option").forEach(option => {
    translatableOptions.push({ option, original: option.textContent });
  });
  document.querySelectorAll("input[placeholder],button[title],[aria-label]").forEach(element => {
    if (element.tagName === "SELECT" || element.closest("option")) return;
    ["placeholder", "title", "aria-label"].forEach(attribute => {
      if (element.hasAttribute(attribute)) translatableAttributes.push({ element, attribute, original: element.getAttribute(attribute) });
    });
  });
}

let websiteTranslationRun = 0;

async function translateBatch(items, language) {
  if (language === "en-IN") return items;
  const output = [];
  let batch = [];
  let size = 0;
  const batches = [];
  for (const item of items) {
    const value = String(item);
    if (batch.length && (batch.length >= 20 || size + value.length > 3500)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(value);
    size += value.length;
  }
  if (batch.length) batches.push(batch);
  for (const part of batches) {
    const response = await fetch(`${API_URL}/translate-batch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: part, language })
    });
    if (!response.ok) throw new Error(`Translation request failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.translations) || data.translations.length !== part.length) {
      throw new Error("Translation response was incomplete");
    }
    output.push(...data.translations);
  }
  return output;
}

async function translateWebsite(language) {
  const run = ++websiteTranslationRun;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ur-IN" ? "rtl" : "ltr";
  staticTextNodes.forEach(item => item.node.nodeValue = item.original);
  translatableAttributes.forEach(item => item.element.setAttribute(item.attribute, item.original));
  translatableOptions.forEach(item => item.option.textContent = item.original);
  document.title = "YojanaSaathi | Government Scheme Assistant";
  if (language === "en-IN") return;

  const entries = [
    ...staticTextNodes.map(item => item.original),
    ...translatableAttributes.map(item => item.original),
    ...translatableOptions.map(item => item.original),
    "YojanaSaathi | Government Scheme Assistant"
  ];
  try {
    const translated = await translateBatch(entries, language);
    if (run !== websiteTranslationRun) return;
    let index = 0;
    staticTextNodes.forEach(item => { item.node.nodeValue = translated[index++]; });
    translatableAttributes.forEach(item => item.element.setAttribute(item.attribute, translated[index++]));
    translatableOptions.forEach(item => { item.option.textContent = translated[index++]; });
    document.title = translated[index];
  } catch (error) {
    if (run === websiteTranslationRun) {
      setVoiceStatus("Website translation could not be completed. Check your internet connection and try selecting the language again.");
    }
  }
}
function selectedLanguage() {
  return LANGUAGES.find(language => language.code === languageSelect.value) || LANGUAGES[0];
}

function getSpeechVoice(languageCode) {
  if (!("speechSynthesis" in window)) return null;
  const voices = voiceList.length ? voiceList : window.speechSynthesis.getVoices();
  const exact = voices.find(voice => voice.lang.toLowerCase() === languageCode.toLowerCase());
  if (exact) return exact;
  const base = languageCode.split("-")[0].toLowerCase();
  return voices.find(voice => voice.lang.toLowerCase().split("-")[0] === base) || null;
}

function speakText(text, languageCode, rate = 0.94) {
  if (!("speechSynthesis" in window)) return false;
  const voice = getSpeechVoice(languageCode);
  if (!voice) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = languageCode;
  utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

function speakWelcome(language) {
  if (!("speechSynthesis" in window)) return;
  const spoken = speakText(language.greeting, language.code, 0.9);
  if (!spoken) setVoiceStatus(`Your device does not have a speech voice installed for ${language.name}. The greeting is visible on screen; you can still use typing.`, true);
}

function addMessage(message, type) {
  const div = document.createElement("div");
  div.className = `message ${type}`;
  div.textContent = message;
  div.dir = "auto";
  div.dataset.originalText = message;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function translateOne(text, language) {
  if (language === "en-IN") return text;
  const cacheKey = `${language}::${text}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
  try {
    const response = await fetch(`${API_URL}/translate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language })
    });
    if (!response.ok) return text;
    const data = await response.json();
    const translated = data.translated || text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (error) { return text; }
}

async function translateChatHistory(language) {
  const messages = [...chat.querySelectorAll(".message")];
  await Promise.all(messages.map(async message => {
    if (!message.dataset.originalText) message.dataset.originalText = message.textContent;
    message.textContent = await translateOne(message.dataset.originalText, language);
  }));
}

async function setVoiceStatus(message, active = false) {
  const requestId = ++statusRequestId;
  voiceStatus.classList.toggle("active", active);
  const translated = await translateOne(message, languageSelect.value);
  if (requestId === statusRequestId) statusText.textContent = translated;
}

function speak(text) {
  if (!speakReplies || !("speechSynthesis" in window)) return;
  const voice = getSpeechVoice(languageSelect.value);
  if (!voice) {
    setVoiceStatus(`No installed speech voice was found for ${selectedLanguage().name}. Your answer is available as text; add this language's voice in your device settings to hear it.`, true);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = languageSelect.value;
  utterance.voice = voice;
  utterance.rate = 0.94;
  utterance.pitch = 1;
  utterance.onstart = () => setVoiceStatus("YojanaSaathi is speaking...", true);
  utterance.onend = () => setVoiceStatus("You can ask another question.");
  utterance.onerror = () => setVoiceStatus("Spoken reply was unavailable. You can read the answer above.");
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(messageFromVoice = "") {
  const message = (messageFromVoice || input.value).trim();
  if (!message) return;
  addMessage(message, "user-message");
  input.value = "";
  setVoiceStatus("Checking scheme information...", true);
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, language: languageSelect.value, profile: userProfile })
    });
    if (!response.ok) throw new Error("Assistant request failed");
    const data = await response.json();
    addMessage(data.reply, "bot-message");
    speak(data.reply);
    if (!speakReplies) setVoiceStatus("Answer received. Ask another question.");
  } catch (error) {
    const fallback = await translateOne("I cannot connect to the server right now. Please start the backend and try again.", languageSelect.value);
    addMessage(fallback, "bot-message");
    setVoiceStatus("Connection unavailable. Please check that the backend is running.");
    speak(fallback);
  }
}

function startListening() {
  if (!SpeechRecognition) {
    setVoiceStatus("Speech recognition is not supported in this browser. Please use Chrome or Edge, or type your question.");
    return;
  }
  if (isListening) return;
  window.speechSynthesis?.cancel();
  recognition = new SpeechRecognition();
  recognition.lang = languageSelect.value;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add("listening");
    translateOne("Listening...", languageSelect.value).then(value => { document.getElementById("micLabel").textContent = value; });
    stopButton.disabled = false;
    setVoiceStatus("I am listening. Speak your question now.", true);
  };
  recognition.onresult = event => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      else interimText += event.results[i][0].transcript;
    }
    if (interimText) setVoiceStatus(`Hearing: ${interimText}`, true);
    if (finalText.trim()) {
      input.value = finalText.trim();
      setVoiceStatus("I heard you. Preparing your answer...", true);
      sendMessage(finalText.trim());
    }
  };
  recognition.onerror = event => {
    const messages = {
      "not-allowed": "Microphone permission was blocked. Allow microphone access in your browser settings.",
      "no-speech": "No speech detected. Tap the microphone and try again.",
      "network": "Speech recognition needs an internet connection in this browser."
    };
    setVoiceStatus(messages[event.error] || `Voice input stopped: ${event.error}. You can type instead.`);
  };
  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove("listening");
    translateOne("Start voice chat", languageSelect.value).then(value => { document.getElementById("micLabel").textContent = value; });
    stopButton.disabled = true;
    if (!window.speechSynthesis?.speaking) setVoiceStatus("You can start another voice question.");
  };
  try { recognition.start(); }
  catch (error) { setVoiceStatus("Could not start the microphone. Please try again."); }
}

function stopVoice() {
  shouldRestart = false;
  recognition?.stop();
  window.speechSynthesis?.cancel();
  setVoiceStatus("Voice interaction stopped.");
}

async function loadSchemes(query = "") {
  const list = document.getElementById("schemeList");
  try {
    const response = await fetch(`${API_URL}/schemes?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(languageSelect.value)}`);
    if (!response.ok) throw new Error("Could not load schemes");
    const schemes = await response.json();
    if (!schemes.length) {
      list.innerHTML = "";
      const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = await translateOne("No schemes found. Try another search.", languageSelect.value); list.appendChild(empty);
      return;
    }
    list.replaceChildren();
    schemes.forEach(scheme => {
      const card = document.createElement("article");
      card.className = "scheme-card";
      const category = document.createElement("span");
      category.className = "scheme-category";
      category.textContent = scheme.category || "Government scheme";
      const title = document.createElement("h3");
      title.textContent = scheme.name;
      const description = document.createElement("p");
      description.textContent = scheme.description;
      const button = document.createElement("button");
      button.className = "details-btn";
      button.textContent = "View details →";
      translateOne("View details →", languageSelect.value).then(value => { button.textContent = value; });
      button.addEventListener("click", () => viewScheme(scheme.id));
      card.append(category, title, description, button);
      list.appendChild(card);
    });
  } catch (error) {
    list.innerHTML = "";
    const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = await translateOne("Unable to connect. Please start the backend server.", languageSelect.value); list.appendChild(empty);
  }
}

async function viewScheme(id) {
  try {
    const response = await fetch(`${API_URL}/schemes/${id}?lang=${encodeURIComponent(languageSelect.value)}`);
    if (!response.ok) throw new Error("Scheme not found");
    const scheme = await response.json();
    const details = `Here are the details for ${scheme.name}:\n${scheme.description}\nBenefits: ${scheme.benefits}\nEligibility: ${scheme.eligibility}\nDocuments: ${scheme.documents}\nHow to apply: ${scheme.application}`;
    const localizedDetails = await translateOne(details, languageSelect.value);
    addMessage(localizedDetails, "bot-message");
    chat.scrollTop = chat.scrollHeight;
    if (speakReplies) speak(localizedDetails);
  } catch (error) { addMessage("Unable to load scheme details. Please try again.", "bot-message"); }
}

document.getElementById("sendButton").addEventListener("click", () => sendMessage());
input.addEventListener("keydown", event => { if (event.key === "Enter") sendMessage(); });
document.getElementById("searchButton").addEventListener("click", () => loadSchemes(document.getElementById("searchInput").value.trim()));
document.getElementById("searchInput").addEventListener("keydown", event => { if (event.key === "Enter") loadSchemes(event.target.value.trim()); });
micButton.addEventListener("click", startListening);
stopButton.addEventListener("click", stopVoice);
const welcomeScreen = document.getElementById("welcomeScreen");
const welcomeLanguage = document.getElementById("welcomeLanguage");
const languageStep = document.getElementById("languageStep");
const modeStep = document.getElementById("modeStep");
populateLanguageOptions(welcomeLanguage);
populateLanguageOptions(languageSelect);
populateLanguageOptions(siteLanguageSelect);
collectStaticText();
chat.querySelectorAll(".message").forEach(message => { message.dataset.originalText = message.textContent; });
if ("speechSynthesis" in window) {
  voiceList = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { voiceList = window.speechSynthesis.getVoices(); };
}
const savedLanguage = localStorage.getItem("yojanaLanguage") || "en-IN";
welcomeLanguage.value = savedLanguage;
languageSelect.value = savedLanguage;
siteLanguageSelect.value = savedLanguage;

// Let the logo make its slow entrance before asking for a language.
window.setTimeout(() => {
  document.getElementById("welcomeLogo").classList.add("logo-settled");
  languageStep.hidden = false;
}, 1550);

document.getElementById("languageContinue").addEventListener("click", () => {
  languageSelect.value = welcomeLanguage.value;
  siteLanguageSelect.value = welcomeLanguage.value;
  localStorage.setItem("yojanaLanguage", welcomeLanguage.value);
  const language = selectedLanguage();
  translateWebsite(language.code);
  loadSchemes(document.getElementById("searchInput").value.trim());
  const greeting = document.getElementById("welcomeGreeting");
  greeting.textContent = language.greeting;
  document.getElementById("languagePrompt").textContent = `Selected: ${language.native} (${language.name})`;
  languageStep.hidden = true;
  modeStep.hidden = false;
  speakWelcome(language);
});

document.getElementById("welcomeVoice").addEventListener("click", () => {
  welcomeScreen.classList.add("hidden");
  document.getElementById("assistant").scrollIntoView({ behavior: "smooth" });
  window.speechSynthesis?.cancel();
  startListening();
});
document.getElementById("welcomeType").addEventListener("click", () => {
  welcomeScreen.classList.add("hidden");
  document.getElementById("assistant").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => input.focus(), 450);
});
document.getElementById("soundToggle").addEventListener("click", event => {
  speakReplies = !speakReplies;
  event.currentTarget.textContent = speakReplies ? "🔊" : "🔇";
  event.currentTarget.setAttribute("aria-pressed", String(speakReplies));
  if (!speakReplies) window.speechSynthesis?.cancel();
});
siteLanguageSelect.addEventListener("change", () => {
  languageSelect.value = siteLanguageSelect.value;
  welcomeLanguage.value = siteLanguageSelect.value;
  localStorage.setItem("yojanaLanguage", siteLanguageSelect.value);
  translateWebsite(siteLanguageSelect.value);
  translateChatHistory(siteLanguageSelect.value);
  loadSchemes(document.getElementById("searchInput").value.trim());
  const language = selectedLanguage();
  setVoiceStatus(`${language.name} selected for the website and assistant.`);
});
languageSelect.addEventListener("change", () => {
  siteLanguageSelect.value = languageSelect.value;
  welcomeLanguage.value = languageSelect.value;
  localStorage.setItem("yojanaLanguage", languageSelect.value);
  translateWebsite(languageSelect.value);
  translateChatHistory(languageSelect.value);
  loadSchemes(document.getElementById("searchInput").value.trim());
  if (recognition && isListening) recognition.stop();
  const language = selectedLanguage();
  setVoiceStatus(`${language.name} voice input selected. Voice support depends on your browser and device.`);
});
document.getElementById("menuToggle").addEventListener("click", () => document.getElementById("navLinks").classList.toggle("open"));
document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", () => document.getElementById("navLinks").classList.remove("open")));

if (!SpeechRecognition) {
  micButton.title = "Speech recognition is not supported in this browser";
}

// Restore the basic profile and let the user request a purpose-based scheme shortlist.
["profileAge", "profileState", "profileIncome", "profileOccupation", "profilePurpose"].forEach(id => {
  const el = document.getElementById(id);
  if (el && userProfile[id.replace("profile", "").toLowerCase()]) el.value = userProfile[id.replace("profile", "").toLowerCase()];
});
document.getElementById("profileForm").addEventListener("submit", event => {
  event.preventDefault();
  userProfile = {
    age: document.getElementById("profileAge").value,
    state: document.getElementById("profileState").value.trim(),
    income: document.getElementById("profileIncome").value,
    occupation: document.getElementById("profileOccupation").value,
    purpose: document.getElementById("profilePurpose").value
  };
  localStorage.setItem("yojanaProfile", JSON.stringify(userProfile));
  const purposeLabels = {
    farming: "I need help with farming. Show me all agriculture schemes.",
    scholarship: "I need scholarship and education support. Show me all related schemes.",
    health: "I need health and medical support. Show me all related schemes.",
    housing: "I need housing support. Show me all related schemes.",
    business: "I need business, loan or employment support. Show me all related schemes.",
    pension: "I need pension and social security support. Show me all related schemes.",
    women: "I need women and household support schemes.",
    ration: "I need ration and food security schemes.",
    water: "I need water and sanitation schemes.",
    all: "Show me all available government schemes."
  };
  const query = purposeLabels[userProfile.purpose] || "Show me relevant government schemes.";
  document.getElementById("assistant").scrollIntoView({ behavior: "smooth" });
  sendMessage(query);
});
loadSchemes();


// Keep the visible chat greeting in the language already selected by the user.
if (savedLanguage !== "en-IN") translateChatHistory(savedLanguage);
