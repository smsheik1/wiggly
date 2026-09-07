# Character Gameplay Conversations — public release

User request: “make this a public repo,” after the 16.76-second Batman/SpongeBob example was presented. This authorizes publication of the format and its selected finished preview; it is not a fabricated direct audiovisual review score.

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
