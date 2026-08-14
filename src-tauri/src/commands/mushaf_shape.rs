//! Shape mushaf words with HarfBuzz and hand back real glyph outlines.
//!
//! WHY THIS EXISTS
//!
//! WebKitGTK from 2.46 (the Skia rendering backend) does not apply HarfBuzz's
//! GPOS mark-attachment offsets for the KFGQPC faces. Shaping inside the engine
//! is correct — the glyph list carries every mark — but the marks are painted
//! at the baseline instead of above their letter, where they disappear into the
//! letterforms. The reader is left with bare consonants: an incomplete Qur'anic
//! text. Every surface inside that engine fails the same way (DOM, SVG text and
//! canvas alike), and no CSS property, font format or WEBKIT_* variable changes
//! it, so there is nothing to switch the mushaf onto *inside* the engine.
//!
//! So the shaping is done out here instead, where it is correct, and the engine
//! is handed outlines it only has to fill. This is the route CLAUDE.md already
//! sanctions for Arabic in graphics: real text, shaped by HarfBuzz from the real
//! font, emitted as outlines. Nothing is redrawn, restyled or traced — the
//! curves are the Complex's own, at the offsets the Complex's own GPOS asks for.
//!
//! The frontend only asks for this when its probe says the engine drops the
//! marks. On a healthy engine — every Windows build, and Linux before 2.46 —
//! the normal text path is used and none of this runs.
//!
//! WHY GLYPHS AND PLACEMENTS RATHER THAN ONE PATH PER WORD
//!
//! A path per word is the obvious shape and it does not fit: measured on this
//! corpus, whole-word paths come to ~19 MB for al-Baqarah alone and ~139 MB for
//! the whole Qur'an. Words share glyphs almost entirely, so each glyph's outline
//! is sent once and a word becomes a list of references to it. The total is then
//! bounded by the face — about 1400 glyphs — no matter how much is read.
//!
//! Coordinates stay in FONT UNITS, as integers. Ems with three decimals cost
//! roughly a third more bytes per number and buy nothing: the client divides by
//! `upem` once, in the viewBox.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use ttf_parser::OutlineBuilder;

/// The two riwayat's faces, compiled in. They are a little under 500 KB
/// together, and carrying them in the binary removes any way for the shaping to
/// disagree with what the webview paints: same bytes, one source.
static HAFS_TTF: &[u8] = include_bytes!("../../../src/assets/fonts/KFGQPC-Hafs-v18.ttf");
static WARSH_TTF: &[u8] = include_bytes!("../../../src/assets/fonts/KFGQPC-Warsh-v10.ttf");

/// One glyph's outline, in font units, already flipped into SVG's y-down space.
#[derive(Serialize, Clone, Debug)]
pub struct GlyphOutline {
    pub id: u16,
    pub d: String,
}

/// One glyph placed inside a word. `x`/`y` are font units in SVG space.
#[derive(Serialize, Clone, Debug)]
pub struct Placement {
    pub g: u16,
    pub x: i32,
    pub y: i32,
}

/// One shaped word. All measurements are font units; divide by `upem`.
#[derive(Serialize, Clone, Debug)]
pub struct ShapedWord {
    pub p: Vec<Placement>,
    pub width: i32,
    /// Ink above the baseline. Positive.
    pub ascent: i32,
    /// Ink below the baseline. Positive.
    pub descent: i32,
}

#[derive(Serialize, Clone, Debug)]
pub struct ShapeBatch {
    pub upem: u16,
    /// Only the glyphs this batch newly needs; the caller accumulates them.
    pub glyphs: Vec<GlyphOutline>,
    /// One entry per requested word, in the order asked. `None` means the face
    /// could not shape it, which the caller should treat as "keep the text".
    pub words: Vec<Option<ShapedWord>>,
}

struct PathWriter {
    d: String,
}

/// Font units are y-up and SVG is y-down, so every y is negated as it is
/// written rather than wrapped in a transform — a transform on the path would
/// also have to be undone by anything that later measures the box.
impl OutlineBuilder for PathWriter {
    fn move_to(&mut self, x: f32, y: f32) {
        self.d.push_str(&format!("M{} {}", r(x), r(-y)));
    }
    fn line_to(&mut self, x: f32, y: f32) {
        self.d.push_str(&format!("L{} {}", r(x), r(-y)));
    }
    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        self.d
            .push_str(&format!("Q{} {} {} {}", r(x1), r(-y1), r(x), r(-y)));
    }
    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        self.d.push_str(&format!(
            "C{} {} {} {} {} {}",
            r(x1),
            r(-y1),
            r(x2),
            r(-y2),
            r(x),
            r(-y)
        ));
    }
    fn close(&mut self) {
        self.d.push('Z');
    }
}

/// One font unit is 1/2048 em — well under a tenth of a pixel at any size this
/// app sets — so rounding to whole units is invisible and keeps numbers short.
fn r(v: f32) -> i32 {
    v.round() as i32
}

fn face_bytes(warsh: bool) -> &'static [u8] {
    if warsh {
        WARSH_TTF
    } else {
        HAFS_TTF
    }
}

struct RiwayahCache {
    glyphs: HashMap<u16, String>,
    words: HashMap<String, Option<ShapedWord>>,
}

impl RiwayahCache {
    fn new() -> Self {
        Self {
            glyphs: HashMap::new(),
            words: HashMap::new(),
        }
    }
}

static CACHE: Mutex<Option<(RiwayahCache, RiwayahCache)>> = Mutex::new(None);

/// Shape one word into glyph placements.
///
/// The word is shaped whole. It must never be split further: a mark separated
/// from its base becomes its own shaping run, which is how a dotted circle gets
/// stamped onto Qur'anic text.
fn shape_one(face: &rustybuzz::Face<'_>, word: &str) -> Option<ShapedWord> {
    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(word);
    buffer.guess_segment_properties();
    let shaped = rustybuzz::shape(face, &[], buffer);

    let infos = shaped.glyph_infos();
    let positions = shaped.glyph_positions();

    let mut placements = Vec::with_capacity(infos.len());
    let mut pen_x: i32 = 0;
    let mut min_y = i32::MAX;
    let mut max_y = i32::MIN;

    for (info, pos) in infos.iter().zip(positions.iter()) {
        let gid = ttf_parser::GlyphId(info.glyph_id as u16);
        let x = pen_x + pos.x_offset;
        let y = pos.y_offset;

        // A glyph with no bounding box has no contours — a space, or a mark the
        // face composes into its base. It still owns its advance.
        if let Some(bbox) = face.glyph_bounding_box(gid) {
            min_y = min_y.min(y + bbox.y_min as i32);
            max_y = max_y.max(y + bbox.y_max as i32);
            placements.push(Placement {
                g: gid.0,
                x,
                // SVG y grows downward and the outline was written negated, so
                // the translation must be too, or every mark that GPOS lifts
                // lands *below* its letter — the very defect being worked
                // around, reintroduced by a sign.
                y: -y,
            });
        }
        pen_x += pos.x_advance;
    }

    Some(ShapedWord {
        p: placements,
        width: pen_x,
        ascent: if max_y == i32::MIN { 0 } else { max_y.max(0) },
        descent: if min_y == i32::MAX { 0 } else { (-min_y).max(0) },
    })
}

/// Shape a batch of words, returning their placements plus any glyph outline
/// the caller has not already been given.
#[tauri::command]
pub async fn shape_mushaf_words(
    warsh: bool,
    words: Vec<String>,
    known_glyphs: Option<Vec<u16>>,
) -> Result<ShapeBatch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let face = rustybuzz::Face::from_slice(face_bytes(warsh), 0)
            .ok_or_else(|| "mushaf face could not be parsed".to_string())?;
        // rustybuzz hands this back as i32; a face whose upem does not fit a
        // u16 is not a real font, and every coordinate below is scaled by it,
        // so refuse rather than truncate into a silently wrong page.
        let upem = u16::try_from(face.units_per_em())
            .map_err(|_| "mushaf face reports an impossible units-per-em".to_string())?;

        let mut guard = CACHE.lock().map_err(|_| "shape cache poisoned".to_string())?;
        let caches = guard.get_or_insert_with(|| (RiwayahCache::new(), RiwayahCache::new()));
        let cache = if warsh { &mut caches.1 } else { &mut caches.0 };

        let already: HashSet<u16> = known_glyphs.unwrap_or_default().into_iter().collect();
        let mut needed: Vec<u16> = Vec::new();
        let mut seen: HashSet<u16> = HashSet::new();
        let mut out_words = Vec::with_capacity(words.len());

        for word in words {
            if !cache.words.contains_key(&word) {
                let shaped = shape_one(&face, &word);
                cache.words.insert(word.clone(), shaped);
            }
            let entry = cache.words.get(&word).cloned().flatten();
            if let Some(shaped) = &entry {
                for placement in &shaped.p {
                    if !already.contains(&placement.g) && seen.insert(placement.g) {
                        needed.push(placement.g);
                    }
                }
            }
            out_words.push(entry);
        }

        let mut glyphs = Vec::with_capacity(needed.len());
        for gid in needed {
            let d = match cache.glyphs.get(&gid) {
                Some(existing) => existing.clone(),
                None => {
                    let mut writer = PathWriter { d: String::new() };
                    face.outline_glyph(ttf_parser::GlyphId(gid), &mut writer);
                    cache.glyphs.insert(gid, writer.d.clone());
                    writer.d
                }
            };
            if !d.is_empty() {
                glyphs.push(GlyphOutline { id: gid, d });
            }
        }

        Ok(ShapeBatch {
            upem,
            glyphs,
            words: out_words,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    // ٱلۡحَمۡدُ — the word that exposed the engine bug. Every mark in it is
    // positioned by GPOS, and a broken engine renders it as bare consonants.
    const ALHAMD: &str = "\u{0671}\u{0644}\u{06E1}\u{062D}\u{064E}\u{0645}\u{06E1}\u{062F}\u{064F}";

    fn face(warsh: bool) -> rustybuzz::Face<'static> {
        rustybuzz::Face::from_slice(face_bytes(warsh), 0).expect("face parses")
    }

    #[test]
    fn shapes_a_marked_word_into_placements() {
        let shaped = shape_one(&face(false), ALHAMD).expect("shapes");
        assert!(!shaped.p.is_empty(), "expected glyph placements");
        assert!(shaped.width > 0, "expected a positive advance");
        assert!(shaped.ascent > 0);
    }

    /// The whole point: the marks must sit ABOVE the letters, not on the
    /// baseline. Compare a word against the same letters with the marks
    /// stripped — the marked form has to reach measurably higher.
    ///
    /// The probe deliberately contains no tall letter. With an alef or a lam in
    /// it the ascent is set by that letter in BOTH forms and the difference
    /// vanishes — the same confound that made an earlier canvas probe read
    /// healthy on a broken engine.
    #[test]
    fn marks_are_placed_above_the_letters() {
        let f = face(false);
        // حَمۡدُ against حمد
        let marked = shape_one(&f, "\u{062D}\u{064E}\u{0645}\u{06E1}\u{062F}\u{064F}").unwrap();
        let plain = shape_one(&f, "\u{062D}\u{0645}\u{062F}").unwrap();
        assert!(
            marked.ascent > plain.ascent + 200,
            "marked ascent {} should clear bare ascent {}",
            marked.ascent,
            plain.ascent
        );
    }

    /// A raised mark must carry a NEGATIVE y in SVG space, because SVG's y grows
    /// downward. Getting this sign wrong reintroduces exactly the defect being
    /// worked around, and it would look plausible in a thumbnail.
    #[test]
    fn raised_marks_are_negative_in_svg_space() {
        let shaped = shape_one(&face(false), "\u{062D}\u{064E}").expect("shapes");
        assert!(
            shaped.p.iter().any(|p| p.y < 0),
            "expected a glyph raised above the baseline, got {:?}",
            shaped.p
        );
    }

    #[test]
    fn both_riwayat_shape() {
        for warsh in [false, true] {
            let shaped =
                shape_one(&face(warsh), "\u{0644}\u{0651}\u{064E}\u{0647}\u{0650}").expect("shapes");
            assert!(!shaped.p.is_empty());
        }
    }

    /// A face that composes a whole word into one glyph still has to come back
    /// with ink; this is the basmala, which KFGQPC ships as a single glyph.
    #[test]
    fn precomposed_words_still_produce_ink() {
        let shaped = shape_one(
            &face(false),
            "\u{0628}\u{0650}\u{0633}\u{06E1}\u{0645}\u{0650}",
        )
        .expect("shapes");
        assert!(!shaped.p.is_empty());
        assert!(shaped.width > 0);
    }

    /// Writes an HTML specimen built the same way the page builds it — one
    /// <defs> of glyph outlines, each word an <svg> of <use> references — so the
    /// result can be LOOKED AT in the engine that has the defect. Ignored by
    /// default because it writes a file:
    ///   SPECIMEN_OUT=/tmp/x.html cargo test render_specimen -- --ignored --nocapture
    #[test]
    #[ignore]
    fn render_specimen() {
        let ayat = [
            "\u{0628}\u{0650}\u{0633}\u{06E1}\u{0645}\u{0650} \u{0671}\u{0644}\u{0644}\u{0651}\u{064E}\u{0647}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064E}\u{062D}\u{06E1}\u{0645}\u{064E}\u{0670}\u{0646}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064E}\u{062D}\u{0650}\u{064A}\u{0645}\u{0650}",
            "\u{0671}\u{0644}\u{06E1}\u{062D}\u{064E}\u{0645}\u{06E1}\u{062F}\u{064F} \u{0644}\u{0650}\u{0644}\u{0651}\u{064E}\u{0647}\u{0650} \u{0631}\u{064E}\u{0628}\u{0651}\u{0650} \u{0671}\u{0644}\u{06E1}\u{0639}\u{064E}\u{0670}\u{0644}\u{064E}\u{0645}\u{0650}\u{064A}\u{0646}\u{064E}",
            "\u{0645}\u{064E}\u{0670}\u{0644}\u{0650}\u{0643}\u{0650} \u{064A}\u{064E}\u{0648}\u{06E1}\u{0645}\u{0650} \u{0671}\u{0644}\u{062F}\u{0651}\u{0650}\u{064A}\u{0646}\u{0650}",
            "\u{0625}\u{0650}\u{064A}\u{0651}\u{064E}\u{0627}\u{0643}\u{064E} \u{0646}\u{064E}\u{0639}\u{06E1}\u{0628}\u{064F}\u{062F}\u{064F} \u{0648}\u{064E}\u{0625}\u{0650}\u{064A}\u{0651}\u{064E}\u{0627}\u{0643}\u{064E} \u{0646}\u{064E}\u{0633}\u{06E1}\u{062A}\u{064E}\u{0639}\u{0650}\u{064A}\u{0646}\u{064F}",
        ];
        let f = face(false);
        let upem = face_bytes(false);
        let _ = upem;
        let upem = 2048.0f32;
        let mut glyph_ids: Vec<u16> = Vec::new();
        let mut body = String::new();

        for ayah in ayat {
            body.push_str("<p class=\"line\">");
            for word in ayah.split(' ').filter(|w| !w.is_empty()) {
                let shaped = shape_one(&f, word).expect("shapes");
                let height = shaped.ascent + shaped.descent;
                body.push_str(&format!(
                    "<span class=\"w\"><svg width=\"{}em\" height=\"{}em\" viewBox=\"0 {} {} {}\" style=\"vertical-align:{}em\">",
                    shaped.width as f32 / upem,
                    height as f32 / upem,
                    -shaped.ascent,
                    shaped.width,
                    height,
                    -(shaped.descent as f32) / upem
                ));
                for placement in &shaped.p {
                    if !glyph_ids.contains(&placement.g) {
                        glyph_ids.push(placement.g);
                    }
                    body.push_str(&format!(
                        "<use href=\"#svh-g{}\" x=\"{}\" y=\"{}\" fill=\"currentColor\"/>",
                        placement.g, placement.x, placement.y
                    ));
                }
                body.push_str("</svg></span> ");
            }
            body.push_str("</p>");
        }

        let mut defs = String::new();
        for gid in &glyph_ids {
            let mut writer = PathWriter { d: String::new() };
            f.outline_glyph(ttf_parser::GlyphId(*gid), &mut writer);
            if !writer.d.is_empty() {
                defs.push_str(&format!("<path id=\"svh-g{}\" d=\"{}\"/>", gid, writer.d));
            }
        }

        let doc = format!(
            "<!doctype html><meta charset=\"utf-8\"><style>body{{background:#12100c;color:#fff;margin:0;padding:24px;direction:rtl}}.line{{font-size:44px;line-height:2.1;text-align:center;margin:0 0 6px}}.w{{display:inline-block}}svg{{overflow:visible;fill:currentColor}}</style><svg width=\"0\" height=\"0\" style=\"position:absolute\"><defs>{}</defs></svg>{}",
            defs, body
        );
        let out = std::env::var("SPECIMEN_OUT").unwrap_or_else(|_| "/tmp/mushaf-specimen.html".into());
        std::fs::write(&out, doc).expect("write specimen");
        println!("wrote {} ({} glyphs)", out, glyph_ids.len());
    }

    /// Dumps a shaping fixture for the browser harness, which cannot shape:
    ///   FIXTURE_OUT=scripts/harness/mushaf-shape.json \
    ///     cargo test dump_harness_fixture -- --ignored --nocapture
    #[test]
    #[ignore]
    fn dump_harness_fixture() {
        let corpus = std::fs::read_to_string("resources/quran.json").expect("corpus");
        let value: serde_json::Value = serde_json::from_str(&corpus).expect("json");
        let f = face(false);

        let mut words_out = serde_json::Map::new();
        let mut glyph_ids: Vec<u16> = Vec::new();
        // Surah 1 only: enough to render a page, small enough to check in.
        for surah in value.as_array().expect("array") {
            if surah["id"].as_i64() != Some(1) {
                continue;
            }
            // The heading words, so the harness can show the shaped heading:
            // \u0633\u064F\u0648\u0631\u064E\u0629\u064F + the surah's own name.
            let heading = format!(
                "\u{0633}\u{064F}\u{0648}\u{0631}\u{064E}\u{0629}\u{064F} {}",
                surah["name"].as_str().unwrap_or("")
            );
            for word in heading.split(' ').filter(|w| !w.is_empty()) {
                if !words_out.contains_key(word) {
                    if let Some(shaped) = shape_one(&f, word) {
                        for placement in &shaped.p {
                            if !glyph_ids.contains(&placement.g) {
                                glyph_ids.push(placement.g);
                            }
                        }
                        words_out
                            .insert(word.to_string(), serde_json::to_value(&shaped).expect("word"));
                    }
                }
            }
            for verse in surah["verses"].as_array().expect("verses") {
                for word in verse["text"].as_str().unwrap_or("").split(' ') {
                    if word.is_empty() || words_out.contains_key(word) {
                        continue;
                    }
                    if let Some(shaped) = shape_one(&f, word) {
                        for placement in &shaped.p {
                            if !glyph_ids.contains(&placement.g) {
                                glyph_ids.push(placement.g);
                            }
                        }
                        words_out.insert(
                            word.to_string(),
                            serde_json::to_value(&shaped).expect("word"),
                        );
                    }
                }
            }
        }

        let glyphs: Vec<serde_json::Value> = glyph_ids
            .iter()
            .filter_map(|gid| {
                let mut writer = PathWriter { d: String::new() };
                f.outline_glyph(ttf_parser::GlyphId(*gid), &mut writer);
                if writer.d.is_empty() {
                    None
                } else {
                    Some(serde_json::json!({ "id": gid, "d": writer.d }))
                }
            })
            .collect();

        let doc = serde_json::json!({
            "upem": u16::try_from(f.units_per_em()).unwrap(),
            "glyphs": glyphs,
            "words": words_out,
        });
        let out =
            std::env::var("FIXTURE_OUT").unwrap_or_else(|_| "/tmp/mushaf-shape.json".to_string());
        std::fs::write(&out, serde_json::to_string(&doc).expect("serialize")).expect("write");
        println!("wrote {} ({} words, {} glyphs)", out, words_out.len(), glyphs.len());
    }

    /// Every glyph a word references must have an outline the client can draw,
    /// or the page renders gaps where letters should be.
    #[test]
    fn every_placed_glyph_has_an_outline() {
        let f = face(false);
        let shaped = shape_one(&f, ALHAMD).expect("shapes");
        for placement in &shaped.p {
            let mut writer = PathWriter { d: String::new() };
            f.outline_glyph(ttf_parser::GlyphId(placement.g), &mut writer);
            assert!(
                !writer.d.is_empty(),
                "glyph {} was placed but has no outline",
                placement.g
            );
        }
    }
}
