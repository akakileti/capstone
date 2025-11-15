import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

DB_PATH = Path(__file__).with_name("app.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            create table if not exists projection_runs (
                id integer primary key autoincrement,
                payload text not null,
                result text not null,
                created_at text not null
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def save_projection_run(payload: Dict[str, Any], result: Any) -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            insert into projection_runs (payload, result, created_at)
            values (?, ?, ?)
            """,
            (
                json.dumps(payload),
                json.dumps(result),
                datetime.utcnow().isoformat(timespec="seconds"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def fetch_latest_projection() -> Optional[Dict[str, Any]]:
    conn = _connect()
    try:
        row = conn.execute(
            """
            select payload, result, created_at
            from projection_runs
            order by id desc
            limit 1
            """
        ).fetchone()
        if row is None:
            return None
        return {
            "payload": json.loads(row["payload"]),
            "result": json.loads(row["result"]),
            "createdAt": row["created_at"],
        }
    finally:
        conn.close()
