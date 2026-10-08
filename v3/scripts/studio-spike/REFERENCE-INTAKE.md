# Reference intake

The rehearsal worker exposes `inspect_reference_photo` and `ask_reference_identities` when the producer binds unresolved uploads through `referencePhotos` or the SQLite assignment packet's `reference_photos` field. Each upload includes id, path, SHA-256, width, height and JPEG/PNG MIME type. Never put private photos in Git.

The first tool verifies and supplies actual image bytes to the worker model through the existing multimodal adapter. The model locates all people and proposes letter labels and approximate source-pixel regions. It cannot infer names, relationships or ages. The second tool rechecks source bytes, validates regions, creates an SVG preview preserving the original image, and returns a question plus `display_markdown` for the operator host to show inline. It terminates the author run and persists a `DIRECTOR_CLARIFICATION` blocker in SQLite. The host must present that preview and question, not merely describe the photo.

Unresolved uploads prevent candidate inspection/publication in this worker. A clarification proposal grants no identity confirmation, crop selection or spending approval. A subsequent character assignment must be prepared from the director's actual response and confirmed reference selections; do not clear the blocker from worker output or upload the original group photo as a selected character reference.

Tests use isolated scripted model responses to verify transport, previews, termination and blocking. They do not prove live model detection quality. No paid intake trial has been run by this checkpoint.
