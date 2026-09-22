# Over-The-Shoulder (OTS) Graphic Safe Zone Calibration Proof

## Purpose

This document records the exact spatial geometry, broadcast safe-zone math, and layering architecture for Over-The-Shoulder (OTS) supporting imagery on `talk-to-camera` shots in `shaz-puppet-runtime-v1`.

## Spatial Geometry & Safe Zone Calibration

In broadcast news and YouTube video essays, anchors sit off-center to allow graphics, headlines, and screenshots to appear over the shoulder without cluttering the screen.

In `shaz-puppet-runtime-v1`, Shaz is staged using `PERFORMANCE_STAGE_VIEW = { scale: 1.33, offset: [0.12, 0.142] }`, intentionally positioning him on the right side of the screen (`x: ~540` to `1240`).

The left half of the 1280×720 canvas provides an open negative space. The calibrated safe zone is:

| Parameter | Value | Constraint / Standard |
| :--- | :--- | :--- |
| **Canvas Width** | `1280px` | 16:9 720p base resolution |
| **Canvas Height** | `720px` | 16:9 720p base resolution |
| **Action Safe Margin (90%)** | `64px` (X), `36px` (Y) | SMPTE ST 2046-1 Broadcast Action Safe |
| **OTS Zone Left** | `80px` | $\ge 64\text{px}$ (16px inward from Action Safe) |
| **OTS Zone Top** | `90px` | $\ge 36\text{px}$ (54px inward from Action Safe) |
| **OTS Zone Width** | `440px` | Standard 1:1 or 4:3 card box |
| **OTS Zone Height** | `440px` | Fits within top margin and floor boundary |
| **OTS Zone Right Edge** | `520px` | $80 + 440 = 520\text{px}$ |
| **Shaz Silhouette Anchor** | `~640px` (center `820px`) | Shaz hoodie left boundary starts $\approx 540\text{px}$ |
| **Comfort Margin** | `~120px` | Separation between card center-right edge and Shaz body |

## Layering Architecture (Z-Index Depth)

To ensure broadcast-quality immersion, compositing follows strict 3-layer depth:

1. **Layer 1 (Base)**: Fixed room background (`sisters-room`, `living-room`, `pure-white`).
2. **Layer 2 (Middle)**: OTS Graphic card with soft drop-shadow (`dy: 12px, stdDeviation: 16px, opacity: 0.25..0.35`).
3. **Layer 3 (Foreground)**: Shaz Puppet Rig rendered with transparent background.

### Why Layer 3 (Shaz in Front) Is Mandatory
When Shaz enters an expressive stance—such as pointing toward the card (`point`), presenting it (`present`), or resting his elbow in the smug chin-stroke (`chin-stroke`)—his sleeve, elbow, or fingers naturally layer *over* the right shadow/edge of the card. This establishes genuine 3D studio depth rather than looking like an ungrounded digital sticker.

## Pose Synergy & Expressive Pairings

The OTS Graphic Zone is calibrated against the verified performance poses:
* **`neutral-listening`**: Calm dialogue; card sits on the left with 120px clean separation.
* **`chin-stroke`**: Smug reflection; right elbow points inward toward card margin with 0 visual collision.
* **`point`**: Direct finger extension directing viewer focus directly to the card.
* **`present`**: Open palm offering the graphic to the viewer.

## Automated Verification

The spatial boundary is verified via `tests/multi-shot.test.mjs`:
* Asserts OTS zone lies strictly within 90% Action Safe boundaries.
* Asserts $\ge 100\text{px}$ clearance between card boundary and Shaz center axis.
* Asserts consistency with `composition-contract.json`.
