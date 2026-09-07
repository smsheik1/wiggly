# Character Gameplay Conversations — evidence and history

## Background music and user acceptance — 0.1.4

After requesting background music and receiving the playable 17-second music preview, the user said “cool looks good to me,” then explicitly asked to finish this goal. This records qualitative acceptance of the refined baseline. It does not invent a detailed per-channel rubric, direct hearing by the agent, or independent identification of the source song.

The same official compositor now accepts optional authorized local music, validates its duration and gain, lowers/ducks it beneath speech, fades the ends, limits clipping and carries attribution in the receipt and MP4 metadata. No new dependency, alternate renderer, voice generation or paid call. The bundled alternative is “Dark Fog” by Kevin MacLeod, CC BY 4.0; see MUSIC-CREDITS.md. The user was told it is not the identified original track.

All 23 contract/music tests passed. Both no-music diagnostic proofs retain their exact 0.1.3 output hashes, proving the optional feature does not alter that path. The music integration test independently measures the quiet bed, preserved dialogue gain, ducking, ending fade, clipping protection and credit. Runtime SHA-256: `bb19667f291641111eb07388aab9be887ef365a4a84c0d0543d60b65f4b396b1`.

Accepted preview SHA-256: `becf9b97e74e3fdc725a14fcf9f9350159d200bb8f05d6b3c005b37dae18c767`. Release SHA-256: `a0082108fa53e6be6cc6494fff070a87846d6d832708c09ae35be32df0a900de`, 16.76 seconds, 1080×1920. The release adds MP4 credit metadata and uses the exact same sources/settings. Decoded video matches exactly (`026759f69d65e02e361c3cc451e161cb3886ccf9e68008084b7ab4c9ee395a34`); audio is sample-identical until 16.704 seconds. Tiny final AAC-tail differences yield 87.18 dB signal-to-error ratio, maximum absolute sample difference 0.000507 and RMS error 0.000002045. This is not falsely recorded as byte-identical audio. No additional creative generation or substitution occurred.

The older records below retain their then-pending review status as history; user acceptance above supersedes that pending baseline decision. Fresh-agent proof claims remain tied to their actual historical versions, not relabeled as new 0.1.4 blind runs.

## Shorts layout update — 0.1.3

The user clarified that this is for Shorts. The same official FFmpeg/Sharp compositor now renders a 1080×1920 (9:16) canvas with proportionally scaled, center-cropped gameplay and repositioned text. This changes layout, not the footage, dialogue, timing or voice assets. Runtime SHA-256: `dd9e6571260b719b3088b9508ae16296bb07476796eed72f184b54acb1145fa6`.

All 12 contract tests passed. Both distinct diagnostic inputs rendered at 1080×1920 with square pixels and passed numerical caption/audio checks. Their output hashes are `e38117ce661ba51d0786388d1fded4e9174a54cd1a989da64330e050aed73411` (same-universe, 8 seconds) and `ea9ac93ea4cd4db86f877c7c661c51a854b075da6ef4e29c67678e9f5df713ae` (crossover, 6 seconds). Current receipts and technical inspections ship beside these two 0.1.3 proofs.

The maintainer re-rendered the real Batman/SpongeBob episode through this layout: 16.76 seconds, 1080×1920, 25 fps, H.264/AAC, SHA-256 `5f3e53171e9b6e5dc079917e605b101c142aa179628ccb58b9ea05b0054ba812`. Its input, gameplay, six voice-clip hashes and duration exactly match the original blind-consumer run. Full decoding passed, and 16 sampled frames were inspected for framing and readable text. No media generation occurred. This layout revision is not a new blind-agent run or a direct audiovisual creative pass.

Historical 0.1.1 and 0.1.2 archives and the original displayed 3:4 output are preserved. The records below describe those versions, not the current 9:16 geometry.

## Public baseline update — 0.1.2

The user requested publication after being shown the 16.76-second Batman/SpongeBob example. Version 0.1.2 adds public-page contracts, agent/version entrypoints and a one-command smoke wrapper; the official runtime remains byte-for-byte unchanged from 0.1.1. This request authorizes publication, not an invented direct audiovisual score. Detailed voice, pacing and caption synchronization review remains unrecorded.

The completed independent consumer used the frozen 0.1.1 ZIP, a new brief, independent Arkham footage and six supplied dialogue clips. It rendered successfully on its first attempt without coaching or package edits. All 11 tests, two diagnostic proofs, full output decoding and 18 sampled caption frames passed. Output: 16.76 seconds, 480 × 640, 25 fps H.264/AAC; SHA-256 `63de842509644808f9e519818ad9bba7a483cdef7d33e2a8c951fd2d796d5dff`. Twelve total free-model voice clips were prepared across the two real episodes; no generation was needed for publication.

The historical notes below predate this consumer result. Their then-pending blind execution status is superseded by this update; their direct-perception limits remain valid.

## Historical authoring record

The original 0.1.0 author worked only from the extracted Wiggly Repo Builder instructions, private reference evidence/transcript and user-supplied context. That initial synthetic proof used no provider, dependency install, or network call. Version 0.1.1 is a maintainer refinement after a separate real-media run, not a new unaided authoring claim. It adds pinned Sharp 0.34.5 for readable text through the same official renderer. Dependency installation and gameplay acquisition used network access; six new voice clips used the explicitly authorized free Fish model. No paid test generation occurred.

The initial analysis missed the fan-character/cloned-voice creative hook and over-constrained a comparison exchange into an abstract six-turn flight recipe. The user supplied the correct context. The blueprint was revised to disclose that attribution and tested under benchmark attestation only. The previous interpretation is not presented as a successful independent discovery.

The approved benchmark blueprint SHA-256 is bacd3948df9a2de105e61add25bff27707c983a9bf02abb5d8a500f0cb437a16. User approval is false and creative approval is false. Private evidence and approval history are excluded from this release.

Historical 0.1.1 official runtime SHA-256:
23a39095a50150d67930b5d8b318481f422fdc772dc41e38e12971aceb30f929

Original 0.1.0 runtime SHA-256, retained in historical evidence:
9c660fecfb0f8055bd2558c4b82a5de6eb5c7704a1a766392844898fb2acbe0b

Exact final author commands, from this Repo root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node runtime/render.mjs inputs/same-universe.json proofs/same-universe-0.1.1.mp4
node runtime/render.mjs inputs/crossover.json proofs/crossover-0.1.1.mp4
node --test tests/contract.test.mjs
node tests/verify-proofs.mjs proofs/same-universe-0.1.1.mp4 proofs/crossover-0.1.1.mp4
```

Both 0.1.1 renders succeeded with that identical runtime. The first output is 8 seconds; the second is 6 seconds. Both have 480x640 H.264 video at 25 fps and mono AAC audio at 48 kHz. Stream inspection receipts are packaged beside them. Eleven contract tests passed; the numerical integration checks found visible caption pixels and expected tone frequencies, within 2 Hz of each target. The text-margin test first rejected approximate width fitting; measuring rendered glyph bounds and fitting to a 436-pixel safe width fixed it.

A preliminary first proof was retained privately before the final media-protocol/time-limit hardening and argument-receipt correction. Both final proofs were rerun after those fixes. No FFmpeg render or technical-inspection failure occurred. An authoring apply_patch invocation was rejected because it attempted two operations on the same blueprint; it was corrected without changing evidence.

Original generated diagnostic video and tone assets exercise the actual supplied-file decoder/compositor path. They are not gameplay, speech, character voices, or evidence of successful voice cloning.

## Private real-media run, 2026-09-06

The maintainer supplied a new Batman/Sonic exchange about speed versus planning, six newly generated `s2.1-pro-free` clips from existing character presets, and gameplay from the user's independent Arkham source: https://www.youtube.com/watch?v=k-T-stiSYgw. The 40–70-second source excerpt was downloaded using a checksum-verified isolated yt-dlp 2026.08.19. The older 2026.07.04 client's media requests returned 403 on the user's Spider-Man link; the newer version succeeded for both Spider-Man and Batman links. No browser cookies or paid service were used for acquisition.

The original 18-second render used a cropped reference video and visibly crude bitmap text. Its typography-only rerender reused the exact input/audio with 0.1.1. A third render substituted independent gameplay through input data with no further renderer changes. The independent output SHA-256 is `7d216486452562520188633de5df6900615734c7cb47e18448628050d6b0a96a`; gameplay SHA-256 is `85bd549fe77b8f7760060fa7fab15b5ea1606efcf91e9c9c1baf90a0dec832eb`. It is 18 seconds, 480×640, 25fps H.264/AAC, using the current runtime checksum above.

Sampled frames show the persistent header, outlined captions, speaker labels and real gameplay. Automated full-file decoding completed, no one-second freeze was detected in the gameplay area at -50dB, and a 0.78025-second interval below -40dB was detected in the speech track at 15.610521–16.390771 seconds. That pause is not automatically a defect or a pacing pass; it needs listening review. Caption timing is estimated from phrase length, not forced-aligned speech. No direct moving-video/audio perception or voice-recognition judgment is claimed.

Private copyrighted gameplay and generated character clips are excluded from the release. This is stronger real-media integration evidence than synthetic fixtures, but not a blind-consumer or creative-fidelity pass. The independent real-media blind-agent run and direct audiovisual acceptance remain pending.
