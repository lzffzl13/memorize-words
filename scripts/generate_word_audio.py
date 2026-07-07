import argparse
import asyncio
import hashlib
import json
import re
from pathlib import Path

try:
    import edge_tts
except ImportError as exc:
    raise SystemExit(
        "edge-tts is required to generate audio. Install it with: "
        "python -m pip install edge-tts"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "vocabulary.json"
OVERRIDES_FILE = ROOT / "data" / "pronunciation_overrides.json"
OUT_DIR = ROOT / "static" / "audio" / "words"
MANIFEST_FILE = ROOT / "static" / "audio" / "manifest.json"


def normalize_key(text):
    return re.sub(r"\s+", " ", text.strip()).lower()


def slugify(text, used):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        slug = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    if slug in used and used[slug] != text:
        slug = f"{slug}-{hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]}"
    used[slug] = text
    return slug


def load_words():
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    seen = {}
    for word in data["words"]:
        english = word["english"].strip()
        key = normalize_key(english)
        if key not in seen:
            seen[key] = english
    return list(seen.values())


def load_overrides():
    if not OVERRIDES_FILE.exists():
        return {}
    data = json.loads(OVERRIDES_FILE.read_text(encoding="utf-8"))
    return {normalize_key(key): value for key, value in data.items()}


def default_spoken_text(term):
    if term.isupper() and len(term) <= 6:
        return " ".join(term)
    return term.replace("_", " ").replace("-", " ")


async def generate_one(term, spoken_text, path, voice, rate):
    path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(spoken_text, voice=voice, rate=rate)
    await communicate.save(str(path))


async def generate_all(args):
    words = load_words()
    overrides = load_overrides()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)

    used_slugs = {}
    manifest = {}
    tasks = []

    for term in words:
        key = normalize_key(term)
        slug = slugify(term, used_slugs)
        filename = f"{slug}.mp3"
        output_path = OUT_DIR / filename
        spoken_text = overrides.get(key, default_spoken_text(term))

        manifest[key] = {
            "file": f"words/{filename}",
            "text": term,
            "spoken_text": spoken_text,
        }

        if output_path.exists() and not args.force:
            continue
        tasks.append((term, spoken_text, output_path))

    if args.limit:
        tasks = tasks[: args.limit]

    semaphore = asyncio.Semaphore(args.concurrency)
    failed = []

    async def run_task(index, term, spoken_text, output_path):
        async with semaphore:
            print(f"[{index}/{len(tasks)}] {term} -> {spoken_text}")
            for attempt in range(1, args.retries + 1):
                try:
                    await generate_one(term, spoken_text, output_path, args.voice, args.rate)
                    if args.pause:
                        await asyncio.sleep(args.pause)
                    return
                except Exception as exc:
                    if output_path.exists():
                        output_path.unlink(missing_ok=True)
                    if attempt >= args.retries:
                        failed.append((term, str(exc)))
                        print(f"FAILED {term}: {exc}")
                    else:
                        await asyncio.sleep(args.retry_delay * attempt)

    await asyncio.gather(
        *[
            run_task(index, term, spoken_text, output_path)
            for index, (term, spoken_text, output_path) in enumerate(tasks, start=1)
        ]
    )

    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest written: {MANIFEST_FILE}")
    print(f"Audio files ready: {OUT_DIR}")
    if failed:
        print("Failed terms:")
        for term, error in failed:
            print(f"- {term}: {error}")
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate pronunciation MP3 files for the vocabulary.")
    parser.add_argument("--voice", default="en-US-JennyNeural", help="Edge TTS voice name.")
    parser.add_argument("--rate", default="-8%", help="Speech rate, for example -8% or +0%.")
    parser.add_argument("--pause", type=float, default=0.05, help="Pause between generation requests.")
    parser.add_argument("--concurrency", type=int, default=4, help="Concurrent generation requests.")
    parser.add_argument("--retries", type=int, default=3, help="Retries per audio file.")
    parser.add_argument("--retry-delay", type=float, default=1.5, help="Base delay between retries.")
    parser.add_argument("--limit", type=int, default=0, help="Generate only the first N missing files.")
    parser.add_argument("--force", action="store_true", help="Regenerate existing audio files.")
    args = parser.parse_args()
    asyncio.run(generate_all(args))


if __name__ == "__main__":
    main()
