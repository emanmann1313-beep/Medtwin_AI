import io
from functools import lru_cache
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.database import fetch_one, get_db
from app.services.interactions import check_interactions
from app.services.voice import TTS_CODES, build_summary

router = APIRouter(tags=["Audio Summary"])

Lang = Literal["en", "hi", "pa"]


def _summary_for(db, patient_id: UUID, lang: str, prescription_id: UUID | None):
    fetch_one(db, "patients", patient_id, "Patient")
    active = db.table("medications").select("*").eq("patient_id", str(patient_id)).eq("active", True).execute().data
    if prescription_id:
        chosen = [m for m in active if m.get("prescription_id") == str(prescription_id)]
    else:
        chosen = active
    if not chosen:
        raise HTTPException(status_code=404, detail="No active medicines found for this patient/prescription")

    # clash check against ALL active medicines, reporting pairs that involve the chosen ones
    for m in active:
        m["group"] = m.get("prescription_id")
    report = check_interactions(active, cross_only=True, focus_ids={str(m["id"]) for m in chosen})
    return build_summary(lang, chosen, report["interactions"]), report


@router.get("/patients/{patient_id}/audio-summary")
def audio_summary(
    patient_id: UUID,
    lang: Lang = "hi",
    prescription_id: UUID | None = None,
    db=Depends(get_db),
):
    """The voice-note script for the 'Play Audio Summary' button (text + sentences + language code).

    The frontend can speak `text` with the browser's speechSynthesis (set voice.lang = tts_lang_code),
    or play the MP3 from `audio_url`.
    """
    summary, report = _summary_for(db, patient_id, lang, prescription_id)
    query = f"?lang={lang}" + (f"&prescription_id={prescription_id}" if prescription_id else "")
    summary["audio_url"] = f"/patients/{patient_id}/audio-summary.mp3{query}"
    summary["alert_level"] = report["alert_level"]
    summary["available_languages"] = {"en": "English", "hi": "हिन्दी", "pa": "ਪੰਜਾਬੀ"}
    return summary


@lru_cache(maxsize=64)
def synthesize(text: str, lang: str) -> bytes:
    """Text -> MP3 bytes using gTTS (Google Translate voice). Cached so replays are instant."""
    from gtts import gTTS  # imported lazily so the API still starts if gTTS is not installed

    buffer = io.BytesIO()
    gTTS(text=text, lang=lang, slow=False).write_to_fp(buffer)
    return buffer.getvalue()


@router.get("/patients/{patient_id}/audio-summary.mp3")
def audio_summary_mp3(
    patient_id: UUID,
    lang: Lang = "hi",
    prescription_id: UUID | None = None,
    db=Depends(get_db),
):
    """The same voice note as an MP3 file (needs internet on the server for gTTS)."""
    summary, _ = _summary_for(db, patient_id, lang, prescription_id)
    try:
        audio = synthesize(summary["text"], lang)
    except ImportError:
        raise HTTPException(status_code=501, detail="Install gTTS: pip install gTTS") from None
    except Exception as exc:  # network down, rate limit, ...
        raise HTTPException(
            status_code=503,
            detail="Voice service unreachable. Use the text from /audio-summary with the browser voice instead.",
        ) from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=3600"})
