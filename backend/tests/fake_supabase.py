"""Tiny in-memory stand-in for the supabase-py client, so tests run without internet."""
import uuid
from datetime import datetime, timezone


class FakeResponse:
    def __init__(self, data):
        self.data = data


DEFAULTS = {
    "patients": {"timezone": "UTC"},
    "medications": {"active": True},
    "dose_logs": {"status": "pending", "taken_at": None},
    "caregivers": {"consent_given": False, "consent_granted_at": None, "consent_revoked_at": None},
    "alerts": {"status": "pending", "sent_at": None},
}


class FakeQuery:
    def __init__(self, store, table):
        self.store, self.table = store, table
        self.op, self.payload = "select", None
        self.filters, self._order, self._limit, self._range = [], None, None, None

    # operations
    def select(self, *_a, **_k):
        self.op = "select"
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    # filters
    def eq(self, col, val):
        self.filters.append(lambda r: str(r.get(col)) == str(val))
        return self

    def in_(self, col, vals):
        vals = {str(v) for v in vals}
        self.filters.append(lambda r: str(r.get(col)) in vals)
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r[col] >= val)
        return self

    def lte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r[col] <= val)
        return self

    def lt(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r[col] < val)
        return self

    # modifiers
    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def execute(self):
        rows = self.store.setdefault(self.table, [])
        match = lambda r: all(f(r) for f in self.filters)

        if self.op == "insert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                row = {**DEFAULTS.get(self.table, {}), **item}
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                rows.append(row)
                out.append(dict(row))
            return FakeResponse(out)

        if self.op == "update":
            out = []
            for r in rows:
                if match(r):
                    r.update(self.payload)
                    out.append(dict(r))
            return FakeResponse(out)

        if self.op == "delete":
            gone = [dict(r) for r in rows if match(r)]
            self.store[self.table] = [r for r in rows if not match(r)]
            return FakeResponse(gone)

        out = [dict(r) for r in rows if match(r)]
        if self._order:
            col, desc = self._order
            out.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=desc)
        if self._range:
            out = out[self._range[0] : self._range[1] + 1]
        if self._limit is not None:
            out = out[: self._limit]
        return FakeResponse(out)


class FakeSupabase:
    def __init__(self):
        self.store = {}

    def table(self, name):
        return FakeQuery(self.store, name)
