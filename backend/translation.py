from functools import lru_cache

# Google Translate language identifiers for the Indian languages supported by the service.
TARGETS = {
    "en-IN": "en", "hi-IN": "hi", "ur-IN": "ur"
}

@lru_cache(maxsize=3000)
def translate_text(text, language):
    if not text or language == "en-IN":
        return text
    target = TARGETS.get(language)
    if not target:
        return text
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="auto", target=target).translate(text) or text
    except Exception:
        return text

def translate_record(record, language):
    return {key: translate_text(value, language) if isinstance(value, str) and key not in {"id", "official_url", "keywords"} else value for key, value in record.items()}


def translate_many(items, language):
    """Translate each UI string separately so separators/HTML fragments are not lost."""
    if language == "en-IN":
        return items
    target = TARGETS.get(language)
    if not target:
        return items
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="auto", target=target)
        # translate_batch preserves one output per input and avoids the old
        # combined-text marker being altered or removed by the translation service.
        translated = translator.translate_batch([str(item) for item in items])
        if isinstance(translated, list) and len(translated) == len(items):
            return [value if value else str(items[i]) for i, value in enumerate(translated)]
    except Exception:
        pass
    return [translate_text(str(item), language) for item in items]


def to_english(text):
    try:
        from deep_translator import GoogleTranslator
        return GoogleTranslator(source="auto", target="en").translate(text) or text
    except Exception:
        return text
