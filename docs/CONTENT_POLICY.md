# Religious Content and Madhhab Policy

This policy is binding for every feature in Salafi Hub — present and future
(library categorization, Quran, radio, lecture catalogs, search, reminders).

## Methodology

The entire application remains clearly **Salafi** in methodology, content
selection, terminology, and source verification.

All scholars, lectures, radio stations, articles, explanations, tafsir,
aqeedah, manhaj, fiqh, and educational material must come from **trusted,
clearly attributed, and approved sources**. The app must never include:

- Anonymous religious content
- Sectarian propaganda
- Extremist material
- Political agitation
- Takfir-focused content
- Unverified social-media clips

## Fiqh across the four madhhabs

Fiqh content supports the four recognized Sunni madhhabs:

- **Hanbali** (application default)
- **Hanafi**
- **Maliki**
- **Shafi'i**

Users must always be able to filter and browse all four madhhabs (see the
category taxonomy in `src/utils/constants.ts` and the Arabic/English
auto-categorizer in `src-tauri/src/services/scanner.rs`).

Every fiqh item in future catalogs must clearly display:

- Madhhab
- Scholar
- Original source
- Language
- Topic
- Evidence or reference when available
- Verification status
- Whether the ruling is a madhhab position or a broader scholarly view

Conflicting rulings must never be merged into one answer. When legitimate
scholarly differences exist, present them respectfully, clearly label each
madhhab position, and never declare one view invalid without reliable
scholarly sourcing.

## Data-driven metadata

All religious metadata (approved scholars, madhhabs, topics, sources,
verification status) must be **data-driven** — updatable through catalogs and
configuration, never hard-coded into feature logic.

## AI boundaries

The app must **never generate its own fatwas** or present AI-generated
religious rulings as authoritative. AI-assisted features are limited to
search, transcription, translation, categorization, and navigation.
Religious answers must point users to verified source material and qualified
scholars.

## Current source attributions

- Quran text: Tanzil (Uthmani script), bundled verbatim with the notice in
  `src-tauri/resources/QURAN_TEXT_NOTICE.txt`.
- Quran audio, ayah timing, and radio catalogs: MP3Quran direct endpoints.
- Quran typeface: Amiri Quran (OFL, license bundled).
