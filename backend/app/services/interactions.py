"""Rule-based drug interaction checker ("Second Doctor" clash checker).

Deterministic on purpose: no AI/LLM is involved, so the same medicines always give the same
warning and every warning can be traced to a rule in interaction_data.py.
"""
import re
from itertools import combinations
from typing import Any

from app.services.interaction_data import (
    BRAND_ALIASES,
    CLASS_MEMBERS,
    EXTRA_INGREDIENTS,
    RISK_TEXT,
    RULES,
)
from app.services.voice import clash_sentence

SEVERITY_RANK = {"moderate": 1, "major": 2, "critical": 3}

DISCLAIMER = (
    "This check uses a limited, curated interaction list and does not replace a doctor or pharmacist. "
    "Never stop or change a medicine without asking your doctor."
)

# ingredient -> classes
_CLASSES_OF: dict[str, set[str]] = {}
for _cls, _members in CLASS_MEMBERS.items():
    for _m in _members:
        _CLASSES_OF.setdefault(_m, set()).add(_cls)

_VOCAB: set[str] = set(_CLASSES_OF) | set(EXTRA_INGREDIENTS)
for _rule in RULES:
    for _side in (_rule["a"], _rule["b"]):
        if not _side.startswith("class:"):
            _VOCAB.add(_side)

_NOISE = re.compile(
    r"\b\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|%)?\b|\b(tablet|tablets|tab|cap|capsule|capsules|syrup|inj|"
    r"injection|sr|er|xl|cr|ip|bp|hcl|hydrochloride|sodium|besylate|tartrate|succinate)\b\.?",
    re.IGNORECASE,
)


def ingredients_of(med: dict[str, Any]) -> set[str]:
    """Work out the active ingredient(s) from generic_name and/or the brand/printed name."""
    found: set[str] = set()
    for source in (med.get("generic_name"), med.get("name")):
        if not source:
            continue
        text = _NOISE.sub(" ", source.lower())
        text = re.sub(r"[^a-z+/&,\s-]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        for brand, ingredients in BRAND_ALIASES.items():
            if re.search(rf"(?<![a-z]){re.escape(brand)}(?![a-z])", text):
                found.update(ingredients)
        for ingredient in _VOCAB:
            if re.search(rf"(?<![a-z]){re.escape(ingredient)}(?![a-z])", text):
                found.add(ingredient)
    return found


def _tokens(ingredients: set[str]) -> set[str]:
    tokens = set(ingredients)
    for ing in ingredients:
        tokens.update(f"class:{c}" for c in _CLASSES_OF.get(ing, ()))
    return tokens


def _brief(med: dict[str, Any]) -> dict[str, Any]:
    return {k: med.get(k) for k in ("id", "name", "dosage", "group")}


def _matching_rules(tok_a: set[str], tok_b: set[str]) -> list[dict]:
    hits = []
    for rule in RULES:
        if (rule["a"] in tok_a and rule["b"] in tok_b) or (rule["a"] in tok_b and rule["b"] in tok_a):
            hits.append(rule)
    return hits


def check_interactions(
    meds: list[dict[str, Any]],
    cross_only: bool = True,
    focus_ids: set[str] | None = None,
) -> dict[str, Any]:
    """Check every pair of medicines.

    meds: dicts with name, optional generic_name/dosage/id, and `group` (the prescription they came from).
    cross_only: only compare medicines from DIFFERENT prescriptions (the "second doctor" case).
    focus_ids: if given, only report pairs where at least one medicine id is in this set.
    """
    prepared = []
    unrecognised = []
    for m in meds:
        ings = ingredients_of(m)
        if not ings:
            unrecognised.append(m["name"])
        prepared.append((m, ings, _tokens(ings)))

    interactions: list[dict[str, Any]] = []
    for (m1, ing1, tok1), (m2, ing2, tok2) in combinations(prepared, 2):
        g1, g2 = m1.get("group"), m2.get("group")
        if cross_only and g1 is not None and g1 == g2:
            continue
        if focus_ids is not None and str(m1.get("id")) not in focus_ids and str(m2.get("id")) not in focus_ids:
            continue

        # same active ingredient twice (e.g. two doctors both prescribed paracetamol)
        shared = ing1 & ing2
        if shared:
            interactions.append(_build(m1, m2, {
                "severity": "major", "risk": "duplicate",
                "title": f"Same medicine twice: {', '.join(sorted(shared))}",
                "detail": f"Both prescriptions contain {', '.join(sorted(shared))}. Taking both adds up to a higher dose.",
                "advice": "Take it only once as per one doctor's advice and tell both doctors.",
            }))
            continue  # the duplicate rule already covers this pair

        for rule in _matching_rules(tok1, tok2):
            interactions.append(_build(m1, m2, rule))

    interactions.sort(key=lambda i: -SEVERITY_RANK[i["severity"]])
    top = max((SEVERITY_RANK[i["severity"]] for i in interactions), default=0)
    level = "danger" if top >= 2 else "caution" if top == 1 else "clear"

    return {
        "alert_level": level,
        "play_alarm": level == "danger",
        "interaction_count": len(interactions),
        "highest_severity": next((k for k, v in SEVERITY_RANK.items() if v == top), None),
        "banner": _banner(level, interactions),
        "interactions": interactions,
        "unrecognised": unrecognised,
        "disclaimer": DISCLAIMER,
    }


def _build(m1: dict, m2: dict, rule: dict) -> dict[str, Any]:
    risk = rule["risk"]
    return {
        "severity": rule["severity"],
        "risk": risk,
        "title": rule["title"],
        "detail": rule["detail"],
        "advice": rule["advice"],
        "medication_a": _brief(m1),
        "medication_b": _brief(m2),
        "speech": {
            lang: clash_sentence(lang, m1["name"], m2["name"], RISK_TEXT[risk][lang], rule["severity"])
            for lang in ("en", "hi", "pa")
        },
    }


_BANNERS = {
    "danger": {
        "en": "DANGER! These medicines can harm you if taken together. Do not take them until you speak to a doctor.",
        "hi": "ख़तरा! ये दवाइयाँ साथ लेने से नुकसान हो सकता है। डॉक्टर से बात किए बिना न लें।",
        "pa": "ਖ਼ਤਰਾ! ਇਹ ਦਵਾਈਆਂ ਇਕੱਠੀਆਂ ਲੈਣ ਨਾਲ ਨੁਕਸਾਨ ਹੋ ਸਕਦਾ ਹੈ। ਡਾਕਟਰ ਨਾਲ ਗੱਲ ਕੀਤੇ ਬਿਨਾਂ ਨਾ ਲਓ।",
    },
    "caution": {
        "en": "Caution: these medicines may interact. Please ask your doctor or pharmacist.",
        "hi": "सावधान: इन दवाइयों का आपस में असर हो सकता है। कृपया डॉक्टर या फार्मासिस्ट से पूछें।",
        "pa": "ਸਾਵਧਾਨ: ਇਨ੍ਹਾਂ ਦਵਾਈਆਂ ਦਾ ਆਪਸ ਵਿੱਚ ਅਸਰ ਹੋ ਸਕਦਾ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਡਾਕਟਰ ਜਾਂ ਫਾਰਮਾਸਿਸਟ ਨੂੰ ਪੁੱਛੋ।",
    },
    "clear": {
        "en": "No known dangerous interaction found in our list.",
        "hi": "हमारी सूची में कोई ख़तरनाक मेल नहीं मिला।",
        "pa": "ਸਾਡੀ ਸੂਚੀ ਵਿੱਚ ਕੋਈ ਖ਼ਤਰਨਾਕ ਮੇਲ ਨਹੀਂ ਮਿਲਿਆ।",
    },
}


def _banner(level: str, interactions: list[dict]) -> dict[str, str]:
    return dict(_BANNERS[level])
