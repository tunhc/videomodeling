import os
import sys
import tempfile
import cv2
import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils
import requests
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from dotenv import load_dotenv
from pathlib import Path

# --- PHẦN 1: CẤU HÌNH ---
base_dir = Path(__file__).resolve().parent.parent
dotenv_path = base_dir / ".env.local"
load_dotenv(dotenv_path=dotenv_path)

CLOUD_NAME  = os.getenv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "")
API_KEY     = os.getenv("CLOUDINARY_API_KEY", "")
API_SECRET  = os.getenv("CLOUDINARY_API_SECRET", "")

# Kiểm tra credentials trước khi chạy
missing = [k for k, v in [
    ("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", CLOUD_NAME),
    ("CLOUDINARY_API_KEY", API_KEY),
    ("CLOUDINARY_API_SECRET", API_SECRET),
] if not v]

if missing:
    print(f"[LỖI] Thiếu biến môi trường: {', '.join(missing)}")
    print(f"      Đã tìm file .env.local tại: {dotenv_path}")
    sys.exit(1)

# Cấu hình global — KHÔNG truyền lại vào từng hàm SDK
cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
    secure=True,
)

FRAME_SKIP        = 5     # Chỉ phân tích 1/5 số frame → nhanh hơn 5x
WRIST_THRESHOLD   = 0.05  # Ngưỡng chuyển động tính là stimming
CHILDREN_FOLDER   = "AI4Autism/KBC-HCM/Children"
PROCESSED_FOLDER  = "AI4Autism/KBC-HCM/Processed"


# --- PHẦN 2: CÁC HÀM XỬ LÝ ---

def list_videos(prefix: str, max_results: int = 500) -> list[dict]:
    """Lấy toàn bộ video trong folder, hỗ trợ pagination."""
    videos: list[dict] = []
    next_cursor = None

    while True:
        kwargs = dict(
            type="upload",
            resource_type="video",
            prefix=prefix,
            max_results=min(max_results - len(videos), 100),
        )
        if next_cursor:
            kwargs["next_cursor"] = next_cursor

        result = cloudinary.api.resources(**kwargs)
        videos.extend(result.get("resources", []))
        next_cursor = result.get("next_cursor")

        if not next_cursor or len(videos) >= max_results:
            break

    return videos


def download_video(public_id: str) -> str | None:
    """Tải video từ Cloudinary về file tạm, trả về đường dẫn."""
    # Dùng api.resource() để lấy secure_url đúng (có version + format thực tế)
    try:
        meta = cloudinary.api.resource(public_id, resource_type="video")
        video_url = meta["secure_url"]
        fmt       = meta.get("format", "mp4")
    except Exception as e:
        print(f"  [LỖI] Không lấy được metadata: {e}")
        return None
    print(f"  Đang tải: {video_url}")

    try:
        response = requests.get(video_url, stream=True, timeout=60)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"  [LỖI] Không tải được video: {e}")
        return None

    suffix = f".{fmt}"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        for chunk in response.iter_content(chunk_size=65536):
            tmp.write(chunk)
        tmp.flush()
        return tmp.name
    finally:
        tmp.close()


_MODEL_PATH = Path(__file__).parent / "pose_landmarker_lite.task"
_MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)

def _ensure_model() -> str:
    """Tải model MediaPipe về thư mục ai_engine/ nếu chưa có."""
    if not _MODEL_PATH.exists():
        print(f"  Đang tải MediaPipe model lần đầu → {_MODEL_PATH.name} ...")
        import urllib.request
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        print("  Model đã sẵn sàng.")
    return str(_MODEL_PATH)


def analyze_motion_intensity(video_path: str) -> float:
    """
    Dùng MediaPipe PoseLandmarker (Tasks API) để đo stimming từ chuyển động cổ tay.
    Chỉ phân tích mỗi FRAME_SKIP frame để tối ưu tốc độ.
    Trả về tỷ lệ frame có chuyển động mạnh (0.0 – 1.0).
    """
    # LEFT_WRIST=15, RIGHT_WRIST=16 theo chuẩn BlazePose
    LEFT_WRIST  = 15
    RIGHT_WRIST = 16

    options = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=_ensure_model()),
        running_mode=mp_vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("  [LỖI] Không mở được file video.")
        return 0.0

    stimming_frames = 0
    sampled_frames  = 0
    prev_left_y  = 0.0
    prev_right_y = 0.0
    frame_idx    = 0

    with mp_vision.PoseLandmarker.create_from_options(options) as landmarker:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % FRAME_SKIP != 0:
                continue

            rgb      = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result   = landmarker.detect(mp_image)

            if result.pose_landmarks:
                lm      = result.pose_landmarks[0]
                left_y  = lm[LEFT_WRIST].y
                right_y = lm[RIGHT_WRIST].y

                if (
                    abs(left_y  - prev_left_y)  > WRIST_THRESHOLD or
                    abs(right_y - prev_right_y) > WRIST_THRESHOLD
                ):
                    stimming_frames += 1

                prev_left_y  = left_y
                prev_right_y = right_y

            sampled_frames += 1

    cap.release()
    return round(stimming_frames / sampled_frames, 4) if sampled_frames else 0.0


def move_to_processed(public_id: str) -> bool:
    """Đổi tên public_id để chuyển sang folder Processed."""
    filename = public_id.split("/")[-1]
    new_id = f"{PROCESSED_FOLDER}/{filename}"
    try:
        cloudinary.uploader.rename(public_id, new_id, resource_type="video")
        print(f"  Di chuyển: {public_id} → {new_id}")
        return True
    except Exception as e:
        print(f"  [LỖI] Không di chuyển được: {e}")
        return False


# --- PHẦN 3: PIPELINE ---
if __name__ == "__main__":
    print(f"Agent bắt đầu quét folder '{CHILDREN_FOLDER}' trên Cloudinary...")
    print(f"Cloud: {CLOUD_NAME}\n")

    try:
        all_videos = list_videos(prefix=f"{CHILDREN_FOLDER}/")
    except Exception as e:
        print(f"[LỖI] Không quét được video: {e}")
        sys.exit(1)

    # Lọc bỏ video đã xử lý
    pending = [v for v in all_videos if not v["public_id"].startswith(f"{PROCESSED_FOLDER}/")]
    print(f"Tìm thấy {len(all_videos)} video, cần xử lý: {len(pending)}\n")

    if not pending:
        print("Không có video nào cần xử lý.")
        sys.exit(0)

    results = []
    for i, video in enumerate(pending, 1):
        public_id = video["public_id"]
        print(f"[{i}/{len(pending)}] Phân tích: {public_id}")

        tmp_path = download_video(public_id)
        if not tmp_path:
            print("  Bỏ qua.\n")
            continue

        try:
            score = analyze_motion_intensity(tmp_path)
            print(f"  Điểm stimming: {score:.4f}")
            results.append({"public_id": public_id, "stimming_score": score})
            move_to_processed(public_id)
        finally:
            # Xóa file tạm dù có lỗi hay không
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        print()

    print("=" * 50)
    print(f"Hoàn thành! Đã xử lý {len(results)}/{len(pending)} video.")
    if results:
        avg = sum(r["stimming_score"] for r in results) / len(results)
        print(f"Điểm stimming trung bình: {avg:.4f}")
        high = [r for r in results if r["stimming_score"] > 0.3]
        if high:
            print(f"\nVideo có stimming cao (> 0.3):")
            for r in high:
                print(f"  {r['public_id']}: {r['stimming_score']:.4f}")
