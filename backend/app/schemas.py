import re
from datetime import date
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

# Used when the AI (or the user) only says "N times a day" and gives no clock times
DEFAULT_TIMES: dict[int, list[str]] = {
    1: ["09:00"],
    2: ["09:00", "21:00"],
    3: ["08:00", "14:00", "20:00"],
    4: ["06:00", "12:00", "18:00", "22:00"],
    5: ["06:00", "10:00", "14:00", "18:00", "22:00"],
    6: ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"],
}


# ---------------------------------------------------------------- patients
class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    age: int | None = Field(default=None, ge=0, le=130)
    email: str | None = None
    phone: str | None = None
    timezone: str = "UTC"  # IANA name, e.g. "Asia/Kolkata"

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be empty")
        return v

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("Invalid IANA timezone, e.g. 'Asia/Kolkata' or 'UTC'")
        return v


# ------------------------------------------------------------- medications
class MedicationBase(BaseModel):
    """Exactly what Gemini (Member 1) should extract for each medicine."""

    name: str = Field(min_length=1, max_length=200)
    dosage: str | None = None  # "500 mg"
    form: str | None = None  # tablet / capsule / syrup ...
    frequency_per_day: int = Field(default=1, ge=1, le=6)
    times: list[str] | None = None  # ["08:00", "20:00"]; optional
    pills_per_dose: int = Field(default=1, ge=1, le=10)
    duration_days: int | None = Field(default=None, ge=1, le=365)
    start_date: date | None = None  # defaults to today in the patient's timezone
    instructions: str | None = None  # "after food"
    pills_remaining: int | None = Field(default=None, ge=0)
    refill_threshold_days: int = Field(default=3, ge=0, le=30)
    # --- used by the interaction checker and the audio player ---
    generic_name: str | None = None  # active ingredient(s), e.g. "diclofenac" or "ibuprofen + paracetamol"
    meal_timing: Literal["before_food", "after_food", "with_food", "empty_stomach"] | None = None
    avoid_with: list[Literal["painkillers", "alcohol", "antacids", "dairy", "grapefruit", "drowsy"]] | None = None
    brand_price_inr: float | None = Field(default=None, ge=0)  # price of the prescribed brand
    jan_aushadhi_price_inr: float | None = Field(default=None, ge=0)  # price of the generic at Jan Aushadhi

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v

    @model_validator(mode="after")
    def normalise_times(self):
        if self.times:
            for t in self.times:
                if not TIME_RE.match(t):
                    raise ValueError(f"Invalid time '{t}'. Use 24-hour HH:MM, e.g. '08:00'")
            unique = sorted(set(self.times))
            if len(unique) > 6:
                raise ValueError("At most 6 dose times per day")
            self.times = unique
            self.frequency_per_day = len(unique)
        else:
            self.times = list(DEFAULT_TIMES[self.frequency_per_day])
        return self


class MedicationCreate(MedicationBase):
    patient_id: UUID
    prescription_id: UUID | None = None


class MedicationUpdate(BaseModel):
    pills_remaining: int | None = Field(default=None, ge=0)
    refill_threshold_days: int | None = Field(default=None, ge=0, le=30)
    instructions: str | None = None
    active: bool | None = None
    generic_name: str | None = None
    meal_timing: Literal["before_food", "after_food", "with_food", "empty_stomach"] | None = None
    avoid_with: list[Literal["painkillers", "alcohol", "antacids", "dairy", "grapefruit", "drowsy"]] | None = None
    brand_price_inr: float | None = Field(default=None, ge=0)
    jan_aushadhi_price_inr: float | None = Field(default=None, ge=0)


class RefillRequest(BaseModel):
    pills_added: int = Field(gt=0, le=10000)


# ----------------------------------------------------------- prescriptions
class PrescriptionCreate(BaseModel):
    patient_id: UUID
    doctor_name: str | None = None
    image_url: str | None = None
    raw_text: str | None = None
    medications: list[MedicationBase] = Field(min_length=1)


# -------------------------------------------------------------- caregivers
class CaregiverCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    relationship: str | None = None
    email: str | None = None
    phone: str | None = None
    telegram_chat_id: str | None = None


class ConsentUpdate(BaseModel):
    consent_given: bool


# ------------------------------------------------------------------ alerts
class AlertCreate(BaseModel):
    patient_id: UUID
    medication_id: UUID | None = None
    alert_type: Literal["missed_dose", "low_refill", "custom"] = "custom"
    message: str = Field(min_length=1, max_length=1000)


class AlertUpdate(BaseModel):
    status: Literal["sent", "failed"]


# ------------------------------------------------------- interaction checker
class CheckMedication(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    generic_name: str | None = None
    dosage: str | None = None


class PrescriptionGroup(BaseModel):
    label: str = Field(default="Prescription", max_length=100)  # e.g. "Dr. Sharma (Orthopedic)"
    medications: list[CheckMedication] = Field(min_length=1)


class InteractionCheckRequest(BaseModel):
    prescriptions: list[PrescriptionGroup] = Field(min_length=1, max_length=10)
    cross_only: bool = True  # True: compare medicines of DIFFERENT prescriptions only
