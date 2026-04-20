import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# Resolve serviceAccountKey.json relative to project root (one level up from ai_engine/)
_KEY_PATH = Path(__file__).resolve().parent.parent / "serviceAccountKey.json"

_db: firestore.Client | None = None


def _get_db() -> firestore.Client:
    """Return a Firestore client, initialising Firebase Admin on first call."""
    global _db
    if _db is not None:
        return _db

    if not _KEY_PATH.exists():
        print(f"[data_coordinator] LỖI: Không tìm thấy {_KEY_PATH}")
        sys.exit(1)

    # Guard against double-init when vision_agent is re-imported in tests
    if not firebase_admin._apps:
        cred = credentials.Certificate(str(_KEY_PATH))
        firebase_admin.initialize_app(cred)

    _db = firestore.client()
    return _db


def update_child_behavior(child_id: str, stimming_score: float) -> bool:
    """
    Cập nhật điểm stimming và flag can thiệp cho trẻ vào Firestore.

    Args:
        child_id:       Document ID trong collection 'children'.
        stimming_score: Tỉ lệ frame có chuyển động mạnh (0.0 – 1.0).

    Returns:
        True nếu ghi thành công, False nếu có lỗi (không raise để tránh crash pipeline).
    """
    try:
        db = _get_db()
        ref = db.collection("children").document(child_id)

        payload = {
            "last_stimming_score": round(stimming_score, 4),
            # Cảnh báo can thiệp khi hơn 50% frame có chuyển động mạnh
            "needs_intervention": stimming_score > 0.5,
            "stimming_updated_at": firestore.SERVER_TIMESTAMP,
        }

        ref.update(payload)
        print(
            f"  [Firestore] {child_id} → score={stimming_score:.4f}  "
            f"needs_intervention={payload['needs_intervention']}"
        )
        return True

    except Exception as e:
        # Không raise — tránh crash toàn bộ pipeline nếu Firestore mất kết nối
        print(f"  [data_coordinator] LỖI khi cập nhật '{child_id}': {e}")
        return False
