from typing import Any
from uuid import UUID

from fastapi import HTTPException
from supabase import Client, create_client

from app.config import SUPABASE_KEY, SUPABASE_URL

_client: Client | None = None


def get_db() -> Client:
    """FastAPI dependency that returns one shared Supabase client."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(
                status_code=500,
                detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env",
            )
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def fetch_one(db: Client, table: str, row_id: UUID | str, label: str | None = None) -> dict[str, Any]:
    """Return one row by id or raise a clean 404."""
    res = db.table(table).select("*").eq("id", str(row_id)).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"{label or table} not found")
    return res.data[0]


def fetch_all(build_query, page_size: int = 1000) -> list[dict[str, Any]]:
    """Read every row of a query (Supabase returns max 1000 rows per request).

    `build_query` must be a function returning a fresh, ordered query each call.
    """
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        batch = build_query().range(start, start + page_size - 1).execute().data
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows
