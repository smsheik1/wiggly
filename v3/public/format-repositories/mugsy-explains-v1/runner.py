from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFont, ImageOps
except ModuleNotFoundError as error:
    raise SystemExit("Missing Python packages. Run: python3 -m pip install -r requirements.txt") from error


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
RUN = ROOT / "run"
CONTENT_PATH = ROOT / "content.json"
ROLES = ("a", "b", "question", "explain_a", "explain_b")
FONT_PATH = ROOT / "assets" / "fonts" / "PatrickHand-Regular.ttf"

sys.path.insert(0, str(RUNTIME))
try:
    import build_proof as engine  # noqa: E402
except ModuleNotFoundError as error:
    raise SystemExit("Missing Python packages. Run: python3 -m pip install -r requirements.txt") from error


def fail(message: str) -> None:
    raise SystemExit(message)


def load_json(path: Path):
    return json.loads(path.read_text())


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_content() -> dict:
    engine.NOTES_FONT = str(FONT_PATH)
    content = load_json(CONTENT_PATH)
    lessons = content.get("lessons")
    if not isinstance(lessons, list) or len(lessons) != 3:
        fail("content.json must contain exactly three lessons.")
    for lesson_index, lesson in enumerate(lessons, start=1):
        for field in ("leftLabel", "rightLabel", "leftImage", "rightImage", "sentences"):
            if not lesson.get(field):
                fail(f"Lesson {lesson_index} is missing {field}.")
        for field in ("leftImage", "rightImage"):
            image_path = ROOT / lesson[field]
            if not image_path.is_file():
                fail(f"Lesson {lesson_index} references a missing image: {lesson[field]}")
            try:
                with Image.open(image_path) as image:
                    if image.width < 400 or image.height < 200:
                        fail(
                            f"Lesson {lesson_index} proof image is too small for phone-size evidence: "
                            f"{lesson[field]} ({image.width}x{image.height}; minimum 400x200)."
                        )
                    image.verify()
            except Exception as error:
                fail(f"Lesson {lesson_index} has an unreadable image: {lesson[field]} ({error})")
        sentences = lesson["sentences"]
        if len(sentences) != 5 or tuple(item.get("role") for item in sentences) != ROLES:
            fail(f"Lesson {lesson_index} must use roles {ROLES} in order.")
        if not sentences[0].get("text", "").startswith("This is "):
            fail(f"Lesson {lesson_index} first sentence must start with 'This is '.")
        if not sentences[1].get("text", "").startswith("This is "):
            fail(f"Lesson {lesson_index} second sentence must start with 'This is '.")
        if sentences[2].get("text") != "What's the difference?":
            fail(f"Lesson {lesson_index} question must be exactly: What's the difference?")
        for sentence in sentences:
            if not sentence.get("text") or not sentence.get("chunks"):
                fail(f"Lesson {lesson_index} has an empty sentence or caption chunk.")
            if any(len(chunk) > 42 for chunk in sentence["chunks"]):
                fail(f"Lesson {lesson_index} has a caption chunk over 42 characters.")
    if not FONT_PATH.is_file():
        fail("Missing bundled Patrick Hand font.")
    label_font = ImageFont.truetype(str(FONT_PATH), 53)
    for lesson_index, lesson in enumerate(lessons, start=1):
        for label in (lesson["leftLabel"], lesson["rightLabel"]):
            box = label_font.getbbox(label.title())
            if box[2] - box[0] > 400:
                fail(f"Lesson {lesson_index} label is too wide for its proof column: {label}")
        for sentence in lesson["sentences"]:
            for chunk in sentence["chunks"]:
                fitted = engine.fit_font(chunk, 940, 100, 58)
                box = fitted.getbbox(chunk)
                if box[2] - box[0] > 940:
                    fail(f"Lesson {lesson_index} caption cannot fit safely: {chunk}")
    for pose in ("point-left.png", "point-right.png", "question.png", "coffee-explain.png", "raise-hand.png"):
        pose_path = ROOT / "assets" / "poses" / pose
        if not pose_path.is_file():
            fail(f"Missing fixed pose asset: {pose}")
        expected_hash = load_json(ROOT / "assets" / "pose-hashes.json").get(pose)
        actual_hash = hashlib.sha256(pose_path.read_bytes()).hexdigest()
        if not expected_hash or actual_hash != expected_hash:
            fail(f"Fixed pose asset changed or failed provenance: {pose}")
        try:
            with Image.open(pose_path) as image:
                rgba = image.convert("RGBA")
                if not rgba.getchannel("A").getbbox():
                    fail(f"Fixed pose has no visible pixels: {pose}")
        except Exception as error:
            fail(f"Fixed pose is unreadable: {pose} ({error})")
    word_count = sum(len(sentence["text"].split()) for lesson in lessons for sentence in lesson["sentences"])
    if not 55 <= word_count <= 100:
        fail(f"Narration must contain 55-100 words for the 25-35 second contract; found {word_count}.")
    return content


def visual_factory(path: Path):
    def load() -> Image.Image:
        return Image.open(path).convert("RGB")

    return load


def configure_engine() -> None:
    engine.NOTES_FONT = str(FONT_PATH)
    content = validate_content()
    engine.ROOT = ROOT
    engine.RUN = RUN
    engine.FRAMES = RUN / "frames"
    engine.AUDIO = RUN / "audio"
    engine.OUTPUT = RUN / "output"
    engine.CONTACT = RUN / "contact"
    engine.SOURCE_HOST = ROOT / "assets" / "poses"
    engine.LESSONS = tuple((lesson["leftLabel"], lesson["rightLabel"]) for lesson in content["lessons"])
    engine.SENTENCES = tuple(
        engine.Sentence(item["text"], tuple(item["chunks"]), lesson_index, item["role"])
        for lesson_index, lesson in enumerate(content["lessons"])
        for item in lesson["sentences"]
    )
    engine.VISUAL_BUILDERS = tuple(
        (visual_factory(ROOT / lesson["leftImage"]), visual_factory(ROOT / lesson["rightImage"]))
        for lesson in content["lessons"]
    )

    reference_rows = load_json(ROOT / "voice-references.json")
    engine.VOICE_REFERENCE_SIGNATURE = hashlib.sha256(
        b"".join((ROOT / item["file"]).read_bytes() + item["text"].encode("utf-8") for item in reference_rows)
    ).hexdigest()

    def voice_references():
        return [
            {"audio": (ROOT / item["file"]).read_bytes(), "text": item["text"]}
            for item in reference_rows
        ]

    engine.build_source_voice_references = voice_references


def smoke() -> None:
    configure_engine()
    smoke_dir = RUN / "smoke"
    smoke_dir.mkdir(parents=True, exist_ok=True)
    directed_plan = engine.load_directed_plan()
    frames = []
    for sentence_idx, sentence in enumerate(engine.SENTENCES):
        beat_plan = directed_plan.get(sentence_idx)
        pose_override = beat_plan.get("mugsyPose") if beat_plan else None
        for chunk in sentence.chunks:
            frames.append(
                engine.frame_image(
                    sentence.lesson,
                    sentence.role,
                    chunk,
                    len(frames),
                    pose_override=pose_override,
                )
            )
    sheet = Image.new("RGB", (540, ((len(frames) + 2) // 3) * 320), "white")
    for index, frame in enumerate(frames):
        thumb = ImageOps.fit(frame, (180, 320), method=Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((index % 3) * 180, (index // 3) * 320))
    path = smoke_dir / "pose-and-layout-smoke.jpg"
    sheet.save(path, quality=92)
    print(json.dumps({"status": "pass", "providerCalls": 0, "artifact": str(path)}, indent=2))


def validate() -> None:
    content = validate_content()
    missing_tools = [tool for tool in ("ffmpeg", "ffprobe") if not shutil.which(tool)]
    if missing_tools:
        fail("Missing local tools: " + ", ".join(missing_tools))
    print(json.dumps({"status": "pass", "lessons": len(content["lessons"]), "providerCalls": 0}, indent=2))


def render() -> None:
    configure_engine()
    engine.main()
    video = sorted((RUN / "output").glob("*.mp4"), key=lambda path: path.stat().st_mtime)[-1]
    contacts = sorted((RUN / "contact").glob("*.jpg"), key=lambda path: path.stat().st_mtime)
    manifest = {
        "inputHash": input_hash(),
        "video": str(video),
        "videoSha256": file_hash(video),
        "voiceSha256": file_hash(RUN / "audio" / "voice.m4a"),
        "contactSheet": str(contacts[-1]) if contacts else None,
    }
    (RUN / "render-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def input_hash() -> str:
    content = load_json(CONTENT_PATH)
    paths = [CONTENT_PATH, ROOT / "voice-references.json", FONT_PATH]
    paths.extend(ROOT / lesson[field] for lesson in content["lessons"] for field in ("leftImage", "rightImage"))
    paths.extend(sorted((ROOT / "assets" / "poses").glob("*.png")))
    paths.extend(ROOT / item["file"] for item in load_json(ROOT / "voice-references.json"))
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(ROOT).as_posix().encode("utf-8"))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def latest_video() -> Path:
    manifest_path = RUN / "render-manifest.json"
    if manifest_path.exists():
        manifested = Path(load_json(manifest_path)["video"])
        if manifested.is_file():
            return manifested
    videos = sorted((RUN / "output").glob("*.mp4"), key=lambda path: path.stat().st_mtime)
    if not videos:
        fail("No rendered MP4 exists. Run render first.")
    return videos[-1]


def inspect() -> dict:
    video = latest_video()
    manifest_path = RUN / "render-manifest.json"
    if not manifest_path.exists():
        fail("Missing render manifest. Render through the official runner first.")
    manifest = load_json(manifest_path)
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(video),
    ], text=True))
    video_stream = next((item for item in probe["streams"] if item.get("codec_type") == "video"), {})
    audio_streams = [item for item in probe["streams"] if item.get("codec_type") == "audio"]
    duration = float(probe["format"]["duration"])
    silence_scan = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(video), "-af",
        "silencedetect=noise=-42dB:d=0.251", "-f", "null", "-",
    ], capture_output=True, text=True, check=False)
    checks = {
        "size": (video_stream.get("width"), video_stream.get("height")) == (1080, 1920),
        "fps": video_stream.get("r_frame_rate") == "30/1",
        "duration": 25 <= duration <= 35,
        "oneAudioStream": len(audio_streams) == 1,
        "noSilenceGapOver250ms": "silence_duration:" not in silence_scan.stderr,
        "currentInputs": manifest.get("inputHash") == input_hash(),
        "manifestedVideo": Path(manifest.get("video", "")) == video,
        "manifestedVideoHash": manifest.get("videoSha256") == file_hash(video),
        "manifestedVoiceHash": manifest.get("voiceSha256") == file_hash(RUN / "audio" / "voice.m4a"),
    }
    timeline = load_json(RUN / "timeline.json")
    inspection_frames = RUN / "inspection-frames"
    if inspection_frames.exists():
        shutil.rmtree(inspection_frames)
    inspection_frames.mkdir(parents=True)
    contact = Image.new("RGB", (540, ((len(timeline) + 2) // 3) * 320), "white")
    for index, item in enumerate(timeline):
        frame_path = inspection_frames / f"frame-{index:03d}.png"
        midpoint = float(item["start"]) + float(item["duration"]) / 2
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{midpoint:.3f}",
            "-i", str(video), "-frames:v", "1", str(frame_path),
        ], check=True)
        with Image.open(frame_path) as frame:
            thumb = ImageOps.fit(frame.convert("RGB"), (180, 320), method=Image.Resampling.LANCZOS)
        contact.paste(thumb, ((index % 3) * 180, (index // 3) * 320))
    contact_path = RUN / "contact" / "inspection-contact.jpg"
    contact_path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(contact_path, quality=92)
    report = {
        "status": "pass" if all(checks.values()) else "fail",
        "video": str(video),
        "contactSheet": str(contact_path),
        "duration": duration,
        "inputHash": manifest.get("inputHash"),
        "checks": checks,
    }
    report_path = RUN / "inspection.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if report["status"] != "pass":
        raise SystemExit(1)
    return report


def finalize(human_review: str) -> None:
    if human_review != "pass":
        fail("Finalization requires --human-review pass after watching the MP4 and checking the voice.")
    report = inspect()
    final_dir = ROOT / "final"
    final_dir.mkdir(parents=True, exist_ok=True)
    destination = final_dir / "mugsy-explains.mp4"
    shutil.copy2(report["video"], destination)
    receipt = {
        "status": "final",
        "video": destination.name,
        "videoSha256": file_hash(destination),
        "inputHash": report["inputHash"],
        "checks": report["checks"],
        "humanReview": human_review,
    }
    (final_dir / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({"status": "final", "video": str(destination)}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("smoke", "validate", "render", "inspect", "finalize"))
    parser.add_argument("--human-review", choices=("pass", "fail"), default="fail")
    args = parser.parse_args()
    if args.command == "smoke":
        smoke()
    elif args.command == "validate":
        validate()
    elif args.command == "render":
        render()
    elif args.command == "inspect":
        inspect()
    else:
        finalize(args.human_review)


if __name__ == "__main__":
    main()
