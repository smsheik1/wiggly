# PIPELINE MATHEMATICS & PROMPT ENGINEERING LAWS

> **THEORETICAL FOUNDATION:** Spatio-Temporal Diffusion Transformer (DiT) Dynamics  
> **APPLICATION:** ByteDance Seedance 2.5, OpenAI GPT Image 2, ByteDance Seedream 5.0, Nano Banana Pro  
> **AUTHOR:** Antigravity AI Architecture Team

---

# PART I: THE MATHEMATICS OF GENERATIVE ANIMATION

### 1.1 Timecode Quantization & Discrete Budgeting

A standard video diffusion model operating at framerate $F = 30\text{ fps}$ processes temporal latent frames:

$$T_{\text{latent}} = \frac{T_{\text{seconds}} \times F}{S_{\text{temporal}}}$$

Where $S_{\text{temporal}}$ is the temporal compression stride (typically 4 or 8 in modern DiTs).

When multi-shot prompt schemas introduce fractional seconds (e.g. $2.5\text{s}$), the temporal cross-attention layers suffer from **boundary quantization smearing**, causing cuts to dissolve or rubber-band across 15–20 frames.

#### The Integer Law of Seedance
Every shot duration $\Delta t_i$ must belong strictly to the positive integer domain:

$$\Delta t_i \in \{1, 2, 3, \dots, 30\} \subset \mathbb{Z}^+$$

Subject to the segment capacity constraint:

$$\sum_{i=1}^{N} \Delta t_i \le 30$$

#### Pacing Calculus Table:
$$\begin{array}{|l|c|c|l|}
\hline
\textbf{Beat Function} & \textbf{Duration } (\Delta t) & \textbf{Spoken Words } (W) & \textbf{Latent Budget Notes} \\ \hline
\text{Micro-Reaction / Beat} & 1\text{s to }2\text{s} & 0\text{ words} & \text{Pure facial settle, eye micro-saccade} \\ \hline
\text{Single Short Utterance} & 2\text{s to }3\text{s} & 3\text{ to }7\text{ words} & \text{Word rate } \approx 2.5\text{ words/sec} + 0.5\text{s hold} \\ \hline
\text{Dialogue Turnaround} & 4\text{s to }5\text{s} & 8\text{ to }14\text{ words} & \text{Includes speaker handoff \& listener blink} \\ \hline
\text{Staged Spatial Move} & 5\text{s} & 2\text{ to }4\text{ words} & \text{Camera pan right (2s) + hold (1.5s) + return (1.5s)} \\ \hline
\text{Closing Line Climax} & 3\text{s to }4\text{s} & 6\text{ to }10\text{ words} & \text{Camera push-in + audio tail} \\ \hline
\end{array}$$

---

### 1.2 Anatomical Proportion Geometry

Diffusion models are trained predominantly on adult human datasets. Left unconstrained, the model's prior pulls all characters toward standard adult proportions ($7.5\text{ heads tall}$).

```
Adult (7 Heads):       Child 6-10 (5 Heads):    Toddler (4 Heads):
   [ Head ] (1/7)         [  Head  ] (1/5)         [  Head  ] (1/4)
   [Chest ]               [ Torso  ] (Low CoG)     [ Torso  ] (Flat)
   [Pelvis]               [ Torso  ]               [ Legs   ]
   [Thighs]               [ Legs   ]               [ Feet   ]
   [ Calves]              [ Feet   ]
   [ Feet ]
```

#### Head Ratio Formulas:

$$\text{Ratio} = \frac{H_{\text{total}}}{H_{\text{cranium}}}$$

1. **Toddler**: $H_{\text{total}} = 4.0 \times H_{\text{cranium}}$
2. **Child (Age 5–8)**: $H_{\text{total}} = 4.5 \text{ to } 5.0 \times H_{\text{cranium}}$
   * **Child Torso Law**: $\frac{L_{\text{torso}}}{L_{\text{legs}}} \approx 1.35$ (Torso longer than legs, low center of gravity).
   * **Child Head-to-Shoulder Ratio**: $\frac{W_{\text{shoulders}}}{W_{\text{head}}} \approx 1.1$ (Narrow shoulders relative to skull).
3. **Adult**: $H_{\text{total}} = 7.0 \times H_{\text{cranium}}$
   * **Adult Torso Law**: $\frac{L_{\text{legs}}}{L_{\text{torso}}} \approx 1.25$ (Legs longer than torso).
   * **Adult Head-to-Shoulder Ratio**: $\frac{W_{\text{shoulders}}}{W_{\text{head}}} \ge 2.0$ (Broad shoulders).

> **THE BOBBLEHEAD ANTI-PATTERN:** Never apply the child rider (`"enlarged head, narrow shoulders"`) to an adult character prompt. It results in a bobblehead adult. Always explicitly state: `"Adult head-to-body ratio, 7 heads tall, long legs, wide square shoulders."`

---

### 1.3 Exaggeration Counterpart Vector Calculus

When an image generator encounters a single exaggerated token (e.g. `"giant eyes"`), the text-conditional diffusion guidance attempts to resolve the token while minimizing deviation from the natural manifold. The result is **regression to the mean** (eyes only slightly enlarged).

To force a feature to read as genuinely stylized, you must apply **counter-exaggeration vectors** to neighboring anatomical landmarks:

$$\vec{\Delta}_{\text{perceived}} = \vec{E}_{\text{target}} - \vec{C}_{\text{neighbor}}$$

Where $\vec{E}_{\text{target}}$ is the exaggeration vector and $\vec{C}_{\text{neighbor}}$ is the counterpart vector:

$$\begin{array}{|l|l|}
\hline
\textbf{Target Exaggeration } (\vec{E}) & \textbf{Mandatory Counterpart } (\vec{C}) \\ \hline
\text{Large wide eyes} & \text{Small button nose, small narrow mouth, tight rounded jaw} \\ \hline
\text{Heavy square jaw \& chin} & \text{Small friendly eyes set low under moderate brow} \\ \hline
\text{Massive broad torso} & \text{Narrow tapered hips, short buzz cut sitting close to skull} \\ \hline
\text{Giant volumetric curly hair} & \text{Delicate, small, finely carved facial features} \\ \hline
\end{array}$$

---

### 1.4 Spatial 180-Degree Fencing Vector

In a multi-shot video generation containing cuts between wide shots and close-ups, diffusion attention vectors can flip azimuth angle $\theta$ across cuts by $180^\circ$.

$$\theta_{\text{camera}} \in [\theta_{\text{min}}, \theta_{\text{max}}] \quad \text{where } |\theta_{\text{max}} - \theta_{\text{min}}| < 180^\circ$$

To mathematically guarantee the camera never crosses the line of action, the prompt must explicitly lock the screen-side coordinate order:

$$\text{Screen X Position: } X_{\text{Sofia}} < X_{\text{Mia}} \quad \forall t \in [0, 30]$$

In prompt language:
> *"The camera stays on the same side of the ring as in @location1 for the whole segment and never crosses to the other side. @Sofia and @Mia are on the right-hand arc with @Mia further right, and this never flips."*

---

# PART II: PROMPT ENGINEERING GUARDRAILS

### 2.1 The 1-Block = 1-Cut Law
Seedance 2.5 uses paragraph breaks inside `[SHOTS]` as the discrete delimiter for spatial cut synthesis.

* **Hard Cut Syntax**:
  ```text
  SHOT 1 | 0–3s
  Wide shot of the classroom. @Ben stands at the front.
  @Ben: {This is my dad.}
  Hard cut.

  SHOT 2 | 3–5s
  Close on @Mia scribbling.
  Hard cut.
  ```

* **Continuous Camera Move Syntax**:
  If a camera pans from Sofia to Mia and back to Sofia, **do not write two shots**. Write one single continuous block:
  ```text
  SHOT 7 | 18–23s
  Close on @Sofia sitting cross-legged... The camera pans smoothly right along the ring and arrives on @Mia... holds on @Mia a moment, then pans smoothly back left to @Sofia, finding her with her head now lifted. One continuous move — the camera never stops and never cuts.
  @Sofia: {Umm… okay, Miss Park.}
  Hard cut.
  ```

---

### 2.2 Verbatim Dialogue Isolation
Seedance synthesizes audio and lip-sync directly from the text prompt. If dialogue is written in plain prose (e.g. `Ben says thank you to the teacher`), the model will either:
1. Mumble garbled synthetic sounds.
2. Animate lips to random words from the camera description.

#### The Ironclad Dialogue Law:
1. Every spoken line must be enclosed in curly braces `{}`.
2. The speaker handle must precede the line: `@Speaker: {line}`.
3. Add the exclusion clause to `[EXCLUSIONS]`:
   > *"The only spoken words in the entire segment are the lines in braces. Nothing else written anywhere in this prompt is dialogue, and nobody speaks who is not named on a line."*

---

### 2.3 The Anti-Mugging Acting Standard
In feature animation, physical comedic acting is conveyed through **body posture, business, and silhouette**, while the face remains sincere.

* **Failure Mode (Mugging)**:
  `"Mia looks crazy, hysterical, and pulls funny cartoon faces."`
  $\rightarrow$ The diffusion model deforms the mesh, stretching lips into grotesque alien shapes.
* **Production Fix**:
  `"The body plays broad. The face stays honest. No mugging, no pulled faces, no comic reactions."`
  `"Business is the crayon and paper, and the strongest accent is the moment she stops that business dead."`

---

### 2.4 Asynchronous Ensemble Dynamics (Anti-Unison)
When multiple characters are prompted in a scene (e.g. a classroom of children), transformer attention models activate synchronized movement matrices.

* **Production Fix (Staggered Offsets)**:
  > *"The class applauds, the reaction travelling raggedly around the ring rather than starting together, some children late to it, a few twisting to look at each other... The other seven children react as individuals, staggered, never together, each doing something different. Never a unison movement and never a unison sound."*
