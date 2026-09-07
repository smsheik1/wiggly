# Character Gameplay Conversations — public release

User request: “make this a public repo,” after the 16.76-second Batman/SpongeBob example was presented. This authorizes publication of the format and its selected finished preview; it is not a fabricated direct audiovisual review score.

## Music revision — 0.1.4 release checkpoint

The user requested background music, received the playable 17-second music preview, and said “cool looks good to me,” then asked to finish the goal. Version 0.1.4 adds optional authorized local music to the one official compositor. The mix trims without looping, lowers, ducks and fades the bed, limits clipping, and retains attribution in the receipt and MP4 comment. Gameplay, six voice clips, captions, layout and duration are unchanged. No provider or paid call occurred.

- The bundled alternative is “Dark Fog” by Kevin MacLeod, licensed CC BY 4.0. `MUSIC-CREDITS.md` records the official source, license, changes and visible-publishing credit. It is explicitly not claimed as the original reference song.
- Runtime SHA-256: `bb19667f291641111eb07388aab9be887ef365a4a84c0d0543d60b65f4b396b1`.
- Accepted preview SHA-256: `becf9b97e74e3fdc725a14fcf9f9350159d200bb8f05d6b3c005b37dae18c767`. Release preview SHA-256: `a0082108fa53e6be6cc6494fff070a87846d6d832708c09ae35be32df0a900de`; 16.76 seconds, 1080×1920, square pixels, 25fps H.264/48kHz mono AAC. Video decodes identically; tiny AAC tail differences from added metadata/re-encode are quantified in `BENCHMARK.md` rather than mislabeled byte-identical.
- ZIP: `character-gameplay-conversations-0.1.4.zip`, 6,988,745 bytes, 41 files, SHA-256 `03788884fdbf18ed052a6ddfe4d71528e9f6cd7f0e0232bf0aa1168f4f3a05ab`.
- Source and clean extraction both pass all 23 tests. The actual ZIP installs offline from existing cache and passes its two-input smoke. The previous no-music proofs retain their exact video/audio output hashes through the new optional runtime path.
- Page/package parity, all 53 Repo presentation contracts, Discovery, handoff, Repo Builder page, typecheck and production build passed. The production build retains the existing seven broad-file-tracing warnings.
- Local Chrome verification passed the actual preview playback/native dimensions, visible expanded music credit, all standard sections, desktop/mobile layout, version-pinned clipboard handoff, downloaded ZIP checksum, readable `MUSIC-CREDITS.md`, and share navigation. Screenshots were directly inspected at `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/wiggly-character-page-8fwxNk`.

This checkpoint is not live until PR/CI/deployment and the same production browser verification pass. The user’s qualitative acceptance resolves the former baseline-review decision without creating an agent direct-hearing claim or retroactively relabeling historical blind runs.

## Shorts revision — 0.1.3 release checkpoint

The user clarified that the Batman video is for Shorts and that the old frame looked short. The corrected orientation is 9:16 vertical, not 16:9 widescreen. The single official compositor now uses a 1080×1920 canvas, a 306-pixel header, proportionally scaled/center-cropped gameplay and measured text within 90-pixel side margins. Captions leave at least 300 pixels clear at the bottom. There is no stretched 3:4 video, new renderer, new provider or new media generation.

- ZIP: `character-gameplay-conversations-0.1.3.zip`, 5,790,574 bytes, 38 files, SHA-256 `56ccc078a79463d1e7dd20248091a434c9085840bc9d13fd33edc4aaf9e3a5d2`.
- Runtime SHA-256: `dd9e6571260b719b3088b9508ae16296bb07476796eed72f184b54acb1145fa6`.
- New preview: `examples/batman-spongebob-shorts.mp4`, 16.76 seconds, 1080×1920, square pixels, 25 fps H.264/AAC. SHA-256 `5f3e53171e9b6e5dc079917e605b101c142aa179628ccb58b9ea05b0054ba812`.
- The original input, gameplay, all six voice clips and duration have unchanged hashes/values. Historical ZIP 0.1.2 and the original 3:4 example remain untouched.
- Twelve contract tests passed. Both distinct 9:16 proofs passed stream, square-pixel, caption and supplied-tone checks. A clean ZIP extraction installed from existing cache, passed all twelve tests, reproduced both smoke outputs and reproduced the real Shorts episode byte-for-byte without package edits. Workspace: `/private/tmp/wiggly-character-shorts.IuL5ln/release-check`.
- The real episode fully decoded. Sixteen sampled frames were inspected for the crop, header, captions and clipping. This is sampled-frame review, not hearing voices or certifying motion/synchronization.
- Page/ZIP parity, all 53 presentation contracts, Discover and handoff tests, typecheck and production build passed. Existing broad-file-tracing warnings remain unchanged in class.
- Local browser QA passed the actual 1080×1920 playback, Discover search, 9:16 geometry on card/page/share, seven standard sections, version-pinned copied launcher, actual ZIP checksum, readable files and desktop/mobile overflow. In-app browser displayed the updated 0.1.3 page. Screenshots directly inspected: `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/wiggly-character-page-KHTxKa`.
- Required complexity review kept one layout definition shared by compositor and inspection; removed unused browser style measurements. No dependency or framework added.

This is a verified local release checkpoint. Version 0.1.3 still requires passing CI, production deployment and the same live browser check before it is called live. Detailed audiovisual review remains unrecorded; the original 0.1.1 blind execution must not be mislabeled as a fresh blind run of this layout revision.

## Release scope

- Public package: `character-gameplay-conversations-0.1.2.zip`, 2,384,255 bytes, 38 files.
- ZIP SHA-256: `f4732bec6e967a0d52c41fee04a714b76344a05525ec056871c6ee5449f82a26`.
- Official runtime SHA-256: `23a39095a50150d67930b5d8b318481f422fdc772dc41e38e12971aceb30f929`, unchanged from the independently tested 0.1.1 child.
- Finished preview SHA-256: `63de842509644808f9e519818ad9bba7a483cdef7d33e2a8c951fd2d796d5dff`, 16.76 seconds, 480 × 640, 25 fps, H.264/AAC.
- The page and Discover contain one example of one Repo. Gameplay acquisition, voice generation and automatic transcription are not implemented in this release; users supply authorized gameplay and one voice clip per turn.
- Original diagnostic media and two smoke proofs ship in the ZIP. The finished preview is served separately; raw footage, separate real voice clips, private inputs and provider receipts do not ship.
- No paid or free media generation was performed for publication.

## Verification before publication

- Clean ZIP extraction installed pinned dependencies from the local npm cache; all 11 contract tests passed, then the one-command smoke reproduced the two diagnostic outputs through the unchanged runtime.
- The page regression checks all 37 inventoried source files against the ZIP, version consistency, the finished preview hash, provider-free scope and publication-versus-review distinction.
- Discovery, proof, handoff and all 53 Repo presentation checks passed (51 downloads and two reference-only collections).
- Production build and typecheck passed. Existing broad-file-tracing build warnings were not treated as new release blockers.
- In-app browser displayed the complete standard page. Chrome browser QA passed Discover search, the real playback control, measured 16.76-second media, uncropped 3:4 video, all standard sections, actual clipboard content, ZIP checksum, README expansion, mobile overflow and share-to-Repo navigation.
- The default headless test browser was absent; the existing Chrome installation was used without downloading a browser. A direct component import in the Node assertion test encountered a CSS-module loader limitation; source-contract assertions plus real-browser geometry cover that behavior instead.
- Corrected a real integration issue: default 9:16 cover framing cropped this 3:4 format. The same shared media component and Discover card now honor the explicit 3:4 declaration. Regression checks protect both surfaces.
- Required ponytail complexity review: lean already. Existing page components and archive machinery are reused; no second renderer, provider framework or app state was introduced.

The source reference analysis remains user-assisted. The independent child consumer established supplied-media execution, not unaided understanding, voice recognition or creative acceptance. Historical benchmark metadata stays explicitly historical; detailed audiovisual review remains unrecorded.

## Verified public release — 2026-09-07 UTC

- Page: https://wiggly.agentenamel.com/formats/character-gameplay-conversations
- Discover: https://wiggly.agentenamel.com/discover#shelf-character-gameplay-conversations
- PR https://github.com/smsheik1/wiggly/pull/478 merged as `5a2072b3551ab4c4ef1a1ac217464970b6366d2f` after all four CI jobs passed: https://github.com/smsheik1/wiggly/actions/runs/34085345200.
- Production deployment succeeded: https://github.com/smsheik1/wiggly/actions/runs/34085956523.
- The production browser check passed Discover search and 3:4 framing, actual unmuted playback of the 16.76-second example, all standard sections, desktop/mobile layout, actual copied version-pinned public handoff, downloaded ZIP checksum, README expansion and share-to-Repo navigation. The downloaded ZIP matched the SHA-256 above.
- Live desktop/mobile screenshots were directly inspected at `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/wiggly-character-page-sW42lZ`. The in-app browser displayed the live 0.1.2 page.
- The initial production test typed into the server-rendered search input before client initialization and timed out. Waiting for the cold page to finish loading resolved that test timing issue; the diagnostic browser reported one matching entry and no page errors. No product or package changes were needed.

Publication is complete for the supplied-media baseline. Technical browser playback checks do not claim direct audiovisual creative review.
