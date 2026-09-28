from __future__ import annotations

import json
import hashlib
import os
import shutil
import subprocess
import urllib.error
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "tmp" / "pocket-explainer-proof"
FRAMES = RUN / "frames"
AUDIO = RUN / "audio"
OUTPUT = RUN / "output"
CONTACT = RUN / "contact"

WIDTH = 1080
HEIGHT = 1920
FPS = 30

SOURCE_HOST = RUN / "source-host"

NOTES_FONT = ""
VOICE_REFERENCE_SIGNATURE = ""
FISH_TTS_URL = "https://api.fish.audio/v1/tts"
FISH_MODEL = "s2.1-pro-free"


@dataclass(frozen=True)
class Sentence:
    text: str
    chunks: tuple[str, ...]
    lesson: int
    role: str


SENTENCES: tuple[Sentence, ...] = ()
LESSONS: tuple[tuple[str, str], ...] = ()
VISUAL_BUILDERS: tuple[tuple[object, object], ...] = ()


def run(*args: str, quiet: bool = False) -> None:
    kwargs = {"check": True}
    if quiet:
        kwargs.update(stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(list(args), **kwargs)


def output(*args: str) -> str:
    return subprocess.check_output(list(args), text=True).strip()


def trim_wave_edges(source: Path, destination: Path) -> None:
    with wave.open(str(source), "rb") as reader:
        channels = reader.getnchannels()
        sample_width = reader.getsampwidth()
        sample_rate = reader.getframerate()
        frames = reader.readframes(reader.getnframes())
    if sample_width != 2:
        raise ValueError(f"Expected 16-bit PCM, got {sample_width * 8}-bit audio.")
    samples = np.frombuffer(frames, dtype="<i2").reshape(-1, channels)
    amplitude = np.max(np.abs(samples.astype(np.int32)), axis=1)
    audible = np.flatnonzero(amplitude >= 260)
    if audible.size == 0:
        raise ValueError(f"No audible speech found in {source}.")
    start = max(0, int(audible[0]) - int(sample_rate * 0.025))
    end = min(len(samples), int(audible[-1]) + int(sample_rate * 0.12))
    trimmed = samples[start:end].astype("<i2").tobytes()
    with wave.open(str(destination), "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(sample_width)
        writer.setframerate(sample_rate)
        writer.writeframes(trimmed)


def build_source_voice_references() -> list[dict[str, bytes | str]]:
    raise RuntimeError("The official runner must configure the bundled voice references.")


def generate_fish_sentence(
    *,
    api_key: str,
    destination: Path,
    references: list[dict[str, bytes | str]],
    text: str,
) -> None:
    try:
        import ormsgpack
    except ModuleNotFoundError as error:
        raise RuntimeError("Missing ormsgpack. Install the package requirements before Fish generation.") from error
    request = urllib.request.Request(
        FISH_TTS_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/msgpack",
            "model": FISH_MODEL,
        },
        data=ormsgpack.packb({
            "text": text,
            "references": references,
            "temperature": 0.35,
            "top_p": 0.55,
            "format": "wav",
            "sample_rate": 44100,
            "normalize": True,
            "latency": "normal",
            "chunk_length": 100,
            "max_new_tokens": 1024,
            "repetition_penalty": 1.2,
            "condition_on_previous_chunks": False,
            "prosody": {"speed": 1.18, "volume": 0, "normalize_loudness": True},
        }),
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            audio = response.read()
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Fish Audio failed with {error.code}: {details}") from error
    if len(audio) < 10_000:
        raise RuntimeError("Fish Audio returned an unexpectedly small voice clip.")
    destination.write_bytes(audio)


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=0)


def fit_font(text: str, max_width: int, start_size: int, minimum: int = 44) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > minimum:
        candidate = font(NOTES_FONT, size, 1)
        box = candidate.getbbox(text)
        if box[2] - box[0] <= max_width:
            return candidate
        size -= 2
    return font(NOTES_FONT, minimum, 1)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def place_card(canvas: Image.Image, visual: Image.Image, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    fitted = ImageOps.pad(
        visual.convert("RGB"),
        (x2 - x1, y2 - y1),
        method=Image.Resampling.LANCZOS,
        color="white",
    )
    canvas.paste(fitted, (x1, y1), rounded_mask(fitted.size, 34))


def load_directed_plan() -> dict[int, dict]:
    plan_file = RUN / "directed-plan.json"
    if not plan_file.exists():
        plan_file = ROOT / "directed-plan.json"
    if not plan_file.exists():
        return {}
    try:
        data = json.loads(plan_file.read_text())
        beats = data.get("beats", [])
        if isinstance(beats, list):
            return {b.get("beatIndex", idx): b for idx, b in enumerate(beats)}
    except Exception:
        pass
    return {}


def build_host(role: str, pose_override: str | None = None) -> Image.Image:
    if pose_override:
        pose_name = f"{pose_override}.png" if not pose_override.endswith(".png") else pose_override
        if not (SOURCE_HOST / pose_name).is_file():
            pose_name = {
                "a": "point-left.png",
                "b": "point-right.png",
                "question": "question.png",
                "explain_a": "coffee-explain.png",
                "explain_b": "raise-hand.png",
            }.get(role, "question.png")
    else:
        pose_name = {
            "a": "point-left.png",
            "b": "point-right.png",
            "question": "question.png",
            "explain_a": "coffee-explain.png",
            "explain_b": "raise-hand.png",
        }.get(role, "question.png")
    host = Image.open(SOURCE_HOST / pose_name).convert("RGBA")
    alpha_box = host.getchannel("A").getbbox()
    if not alpha_box:
        raise ValueError(f"Source host pose has no visible pixels: {pose_name}")
    host = host.crop(alpha_box)
    host = host.resize(
        (round(host.width * 1.5), round(host.height * 1.5)),
        Image.Resampling.LANCZOS,
    )
    host.thumbnail((1020, 1020), Image.Resampling.LANCZOS)
    return host


def frame_image(
    lesson: int,
    role: str,
    chunk: str,
    sequence_index: int,
    pose_override: str | None = None,
) -> Image.Image:
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (255, 255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    left_visual = VISUAL_BUILDERS[lesson][0]()
    right_visual = VISUAL_BUILDERS[lesson][1]()
    label_font = font(NOTES_FONT, 53, 1)
    if role == "a":
        draw.text((540, 80), LESSONS[lesson][0].title(), anchor="ma", font=label_font, fill=(12, 12, 24))
        place_card(canvas, left_visual, (330, 155, 750, 575))
    elif role == "b":
        draw.text((540, 80), LESSONS[lesson][1].title(), anchor="ma", font=label_font, fill=(12, 12, 24))
        place_card(canvas, right_visual, (330, 155, 750, 575))
    else:
        draw.text((285, 72), LESSONS[lesson][0].title(), anchor="ma", font=label_font, fill=(12, 12, 24))
        draw.text((795, 72), LESSONS[lesson][1].title(), anchor="ma", font=label_font, fill=(12, 12, 24))
        place_card(canvas, left_visual, (80, 145, 490, 555))
        place_card(canvas, right_visual, (590, 145, 1000, 555))

    caption_font = fit_font(chunk, 940, 100, 58)
    draw.text((540, 630), chunk, anchor="ma", font=caption_font, fill=(12, 12, 24))

    host = build_host(role, pose_override=pose_override)
    host_x = (WIDTH - host.width) // 2
    is_question_pose = pose_override == "question" if pose_override else (role == "question")
    host_y = 825 if is_question_pose else 850
    canvas.alpha_composite(host, (host_x, host_y))
    return canvas.convert("RGB")


def build_audio() -> list[float]:
    sentence_dir = AUDIO / "sentences"
    signature = hashlib.sha256(
        (VOICE_REFERENCE_SIGNATURE + "\n" + "\n".join(sentence.text for sentence in SENTENCES)).encode("utf-8")
    ).hexdigest()
    signature_path = sentence_dir / "content-signature.txt"
    hashes_path = sentence_dir / "clip-hashes.json"
    api_key = os.environ.get("FISH_STUDIO_APIKEY") or os.environ.get("FISH_API_KEY")
    cache_matches = signature_path.exists() and signature_path.read_text().strip() == signature
    if not cache_matches:
        if not api_key:
            raise RuntimeError(
                "Fish Audio is required because the narration cache does not match this script. "
                "Set FISH_STUDIO_APIKEY or FISH_API_KEY; the existing cache was left untouched."
            )
        if sentence_dir.exists():
            shutil.rmtree(sentence_dir)
    sentence_dir.mkdir(parents=True, exist_ok=True)
    signature_path.write_text(signature + "\n")
    clip_hashes = json.loads(hashes_path.read_text()) if hashes_path.exists() else {}

    def valid_audio_clip(path: Path, text: str) -> bool:
        if not path.is_file():
            return False
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", str(path)],
            capture_output=True,
            text=True,
            check=False,
        )
        try:
            duration = float(probe.stdout.strip())
        except ValueError:
            return False
        decode = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return decode.returncode == 0 and duration >= max(0.6, len(text.split()) * 0.18)

    def valid_cached_clip(index: int, sentence: Sentence) -> bool:
        path = sentence_dir / f"{index:02d}-fish.wav"
        expected_hash = clip_hashes.get(path.name)
        return bool(
            expected_hash
            and hashlib.sha256(path.read_bytes()).hexdigest() == expected_hash
            and valid_audio_clip(path, sentence.text)
        )

    needs_generation = any(
        not valid_cached_clip(index, sentence) for index, sentence in enumerate(SENTENCES)
    )
    if needs_generation and not api_key:
        raise RuntimeError(
            "Fish Audio is required for the fidelity rebuild. Set FISH_STUDIO_APIKEY or FISH_API_KEY; "
            "the Mac system voice is intentionally not used as a fallback."
        )
    references = build_source_voice_references() if needs_generation else []
    sentence_gap = 0.055
    silence_wav = sentence_dir / "sentence-gap.wav"
    run(
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-t", f"{sentence_gap:.3f}", "-c:a", "pcm_s16le", str(silence_wav), quiet=True,
    )
    durations = []
    concat_lines = []
    for index, sentence in enumerate(SENTENCES):
        fish_wav = sentence_dir / f"{index:02d}-fish.wav"
        raw_wav = sentence_dir / f"{index:02d}-raw.wav"
        wav = sentence_dir / f"{index:02d}.wav"
        if not valid_cached_clip(index, sentence):
            temporary_fish = sentence_dir / f"{index:02d}-fish.tmp.wav"
            temporary_fish.unlink(missing_ok=True)
            try:
                generate_fish_sentence(
                    api_key=api_key,
                    destination=temporary_fish,
                    references=references,
                    text=sentence.text,
                )
                if not valid_audio_clip(temporary_fish, sentence.text):
                    raise RuntimeError(f"Fish Audio returned an invalid clip for sentence {index + 1}.")
                temporary_fish.replace(fish_wav)
                clip_hashes[fish_wav.name] = hashlib.sha256(fish_wav.read_bytes()).hexdigest()
                temporary_hashes = hashes_path.with_suffix(".tmp")
                temporary_hashes.write_text(json.dumps(clip_hashes, indent=2) + "\n")
                temporary_hashes.replace(hashes_path)
            finally:
                temporary_fish.unlink(missing_ok=True)
        run(
            "ffmpeg", "-y", "-i", str(fish_wav), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(raw_wav), quiet=True
        )
        trim_wave_edges(raw_wav, wav)
        duration = float(output("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", str(wav)))
        durations.append(duration + (sentence_gap if index < len(SENTENCES) - 1 else 0))
        concat_lines.append(f"file '{wav.as_posix()}'")
        if index < len(SENTENCES) - 1:
            concat_lines.append(f"file '{silence_wav.as_posix()}'")
    concat_file = sentence_dir / "concat.txt"
    concat_file.write_text("\n".join(concat_lines) + "\n")
    joined = AUDIO / "voice-joined.wav"
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c:a", "pcm_s16le", str(joined), quiet=True)
    run(
        "ffmpeg", "-y", "-i", str(joined), "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", str(AUDIO / "voice.m4a"), quiet=True
    )
    total_duration = sum(durations)
    if not 25 <= total_duration <= 35:
        raise ValueError(f"Narration duration {total_duration:.2f}s is outside the 25-35s proof contract.")
    return durations


def build_frames(sentence_durations: list[float]) -> list[dict[str, object]]:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    directed_plan = load_directed_plan()
    timeline: list[dict[str, object]] = []
    cursor = 0.0
    frame_index = 0
    if len(SENTENCES) != len(sentence_durations):
        raise ValueError("Every sentence must have one measured audio duration.")
    for sentence_idx, (sentence, sentence_duration) in enumerate(zip(SENTENCES, sentence_durations)):
        beat_plan = directed_plan.get(sentence_idx)
        pose_override = beat_plan.get("mugsyPose") if beat_plan else None
        chunk_duration = sentence_duration / len(sentence.chunks)
        for chunk in sentence.chunks:
            frame = frame_image(
                sentence.lesson,
                sentence.role,
                chunk,
                frame_index,
                pose_override=pose_override,
            )
            frame_path = FRAMES / f"frame-{frame_index:03d}.png"
            frame.save(frame_path, quality=96)
            timeline.append(
                {
                    "index": frame_index,
                    "start": round(cursor, 3),
                    "duration": round(chunk_duration, 3),
                    "caption": chunk,
                    "sentence": sentence.text,
                    "lesson": sentence.lesson + 1,
                    "role": sentence.role,
                    "pose": pose_override or sentence.role,
                    "camera": beat_plan.get("cameraMotion", "static") if beat_plan else "static",
                    "badge": beat_plan.get("badge", "HEAD TO HEAD") if beat_plan else "HEAD TO HEAD",
                    "path": frame_path.as_posix(),
                }
            )
            cursor += chunk_duration
            frame_index += 1
    (RUN / "timeline.json").write_text(json.dumps(timeline, indent=2) + "\n")
    return timeline


def render_video(timeline: list[dict[str, object]], attempt: int) -> Path:
    concat = RUN / "frames.txt"
    lines = []
    for item in timeline:
        lines.append(f"file '{item['path']}'")
        lines.append(f"duration {item['duration']}")
    lines.append(f"file '{timeline[-1]['path']}'")
    concat.write_text("\n".join(lines) + "\n")
    out = OUTPUT / f"wiggly-pocket-explainer-attempt-{attempt}.mp4"
    run(
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", str(AUDIO / "voice.m4a"),
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS), "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out), quiet=True
    )
    return out


def build_contact_sheet(video: Path, attempt: int) -> Path:
    sheet = CONTACT / f"attempt-{attempt}.jpg"
    run(
        "ffmpeg", "-y", "-i", str(video), "-vf", "fps=1/5,scale=360:640,tile=3x2", "-frames:v", "1", str(sheet), quiet=True
    )
    return sheet


def main() -> None:
    attempt = int(os.environ.get("ATTEMPT", "1"))
    for directory in (FRAMES, AUDIO, OUTPUT, CONTACT):
        directory.mkdir(parents=True, exist_ok=True)
    durations = build_audio()
    timeline = build_frames(durations)
    video = render_video(timeline, attempt=attempt)
    sheet = build_contact_sheet(video, attempt=attempt)
    report = {
        "sentences": len(SENTENCES),
        "cards": len(timeline),
        "timelineDuration": round(sum(float(item["duration"]) for item in timeline), 3),
        "audioDuration": float(output("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", str(AUDIO / "voice.m4a"))),
        "video": video.as_posix(),
        "contactSheet": sheet.as_posix(),
    }
    (RUN / f"attempt-{attempt}-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
