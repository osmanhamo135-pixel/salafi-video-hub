# Auditor findings against the design plan

281 findings from 15 independent auditors (66 blocking, 139 major, 76 minor).

Each spec was reviewed by three auditors with different lenses — manhaj,
performance/feasibility, and accessibility/RTL — so that each catches what the
others structurally cannot. A finding here invalidates the spec section it names.

Spot-verified against source: the CSP `img-src` has no `data:` source; `AppShell.tsx`
sets `bg-background` at the call site; `.quran-reading-frame` declares no background
at all. All three were reported correctly.


---

## BLOCKING

### Manhaj 10 (Basmala never clipped) + Manhaj 2; contradicts the spec's own §3 and §11.5

**Where.** §6.3 CSS: `.hero-ambient { position: relative; display: grid; place-items: center; min-height: 100%; isolation: isolate; border-radius: var(--r-lg); overflow: hidden; }`

**Why.** `.hero-ambient` is an ancestor of `.hero-basmala` (`.hero-ambient` > `.hero-ambient-inner` > BasmalaPlate). §3 states in the same document: "No ancestor of `.hero-basmala` may set `overflow: hidden`, `clip-path`, `mask`, `text-overflow` or a fixed `height`", and §11.5 asserts "`.hero-basmala` and its ancestors: computed `overflow` ∈ {visible}". The spec establishes a clipping ancestor and then writes an acceptance test that its own CSS fails. `border-radius: var(--r-lg)` on the same element compounds it — a rounded clip on a full-bleed grid whose centred child is the Basmala. Note also that `.page-container` (index.css:1834, `@apply … overflow-y-auto overflow-x-hidden`) is already a clipping ancestor of both HeroAmbient and the Dashboard mark band, so §11.5 is unsatisfiable twice over.

**Fix.** Move the clip off the Basmala's chain: put `overflow: hidden` + `border-radius` on `.hero-ambient-ground` (the only layer that needs clipping) and leave `.hero-ambient` with `overflow: visible`. Then relax §11.5 to name the real requirement — that no ancestor's padding box crops `.hero-basmala`'s border box — and check it as geometry (`basmalaRect` fully contained in every ancestor's client rect) rather than as a computed-style equality that `.page-container` can never satisfy.

### Manhaj 2 (Qur'anic text is never behind/under decoration) + Manhaj 10 (Basmala never behind a control, no overlapping ornament)

**Where.** §6.3: "`.jadwal-frame` is inset `1.25rem` inside `.hero-ambient-inner` and does not overlap the Basmala's box: `.hero-ambient-inner` has `padding: var(--s7) var(--s6)` = 56px/36px, and the frame sits at 20px, so there is 36px of clearance vertically and 16px horizontally between the frame's inner rule and the mark."

**Why.** The arithmetic measures to the frame element's OUTER inset, not to its inner rule. The jadwal construction the spec is copying (index.css:876-909 for the band, :852-859 for the rules) puts, inside that inset: 20×20px khatam corner tiles (`mask-size: … 20px 20px`), 40×10px band tiles, and the inner hairline at `inset: clamp(1.72rem, 2.3vw, 2.05rem)` — i.e. a further 27.5–32.8px inward. With `--s6: 36px` (index.css:387) the content box starts 36px from the inner's edge while the frame's inner rule lands at 20 + ~29 = ~49px and the corner tile spans 20→40px. The ornament therefore crosses ~4–13px into the Basmala's box on both inline edges. Worse, `.jadwal-frame` is the first child, absolutely positioned, with no `z-index` given, among otherwise static siblings — so it paints in the positioned-descendant layer, ABOVE the glyphs. The result is a gold ornamental band drawn across Qur'anic text. §11.4 cannot catch it: the frame is `pointer-events: none` and is not a `button`/`a`/`input`/`[role=button]`.

**Fix.** Either (a) drop `.jadwal-frame` from HeroAmbient entirely — §2's whole argument is that the jadwal's scarcity is what makes it a signature, and the Basmala needs no frame to be the subject — or (b) inset the frame to `0` and raise `.hero-ambient-inner`'s padding to `calc(var(--s7) + 2.05rem)` inline as well as block, so the inner rule clears the content box, and give `.jadwal-frame` `z-index: -1` inside the isolated stacking context. Either way add the §11 assertion §6.3 promises but never writes: `.hero-basmala`'s rect intersects no `.jadwal-frame`, `.jadwal-mount`, `.hero-arch`, or any element with a non-transparent background or a `mask-image`.

### Manhaj 2 (Qur'anic text is never faded in) + Manhaj 10 (the Basmala is never animated)

**Where.** §3: "**Static.** No `transition`, no `animation`, no `transform` on `.hero-basmala` or any ancestor. Not covered by `page-enter` — `.page-container`'s fade is on the container, which is correct (opacity on an ancestor is not an animation of the glyph)"

**Why.** This is a rationalisation, not an exemption. `.page-container { animation: page-enter var(--dur-normal) var(--ease-out) both }` (index.css:1834-1835) is a 0→1 opacity keyframe, and `Dashboard.tsx:92` wraps everything in `.page-container`. Both the new `basmala-band` and HeroAmbient sit inside it, so the Basmala visibly fades in on every entry to `/`. "Opacity on an ancestor" is precisely how a fade-in is implemented; the rendered result is the glyph fading in, which Manhaj 2 forbids in terms and Manhaj 10 forbids again. The spec makes this worse than today: `Hero.tsx` was one object on one screen, whereas the new Dashboard is the app's return destination and the mark band re-fades on every navigation back. §11.5's own assertion (`animation-name = none` on all ancestors) again fails against it.

**Fix.** Take the Basmala out of the fading container: render `<BasmalaPlate>`/`<HeroAmbient>` as a sibling of `.page-container` inside the route root, or add `.page-container:has(.hero-basmala) { animation: none }`. Then §11.5's `animation-name = none` on all ancestors becomes true and testable instead of aspirational.

### Perf/feasibility — measured height budget §7.2, §9.7, §11.1 ("the band is 180 regardless", "verified at both languages")

**Where.** .hero-lesson { height: var(--hero-continue-h); overflow: hidden } + .hero-lesson-title { line-height: 1.28; -webkit-line-clamp: 2 } in Arabic

**Why.** MEASURED in Chromium at the real token values: at 1280x800 data-language='ar' the .hero-lesson-actions row bottoms at y=452 while .hero-lesson bottoms at y=438.7 — 13.3px of the primary action is clipped. At 900x600 (the stated minimum window) it is 452 vs 417.5 — 34.5px clipped, i.e. the entire 'متابعة' button is below the overflow:hidden edge and unreachable. Cause: html[data-language='ar'] h1 { line-height: var(--lh-arabic) } at index.css:625-632 has specificity (0,1,1) and beats .hero-lesson-title (0,1,0), so the title grows 69.1px -> 99.9px. -webkit-line-clamp:2 clamps LINES, not pixels, so it does not cap the growth. Worse, it is width-dependent: at 1920x1080 the same Arabic string fits on one line (49.9px) and the hero passes — a screenshot sweep will go green at one viewport and ship a clipped primary action at another.

**Fix.** Make .hero-lesson `min-height`, not `height`, and drop `overflow: hidden` from the outer box (move it to .hero-lesson-art where it is actually needed). If the fixed band is non-negotiable, raise the title rule's specificity (`html[data-language='ar'] .hero-lesson-title { line-height: 1.28 }`) and clamp to 1 line under Arabic. Add to assert-heroes.mjs: for every hero, assert every focusable descendant's rect is fully contained by the hero's rect, run at all 3 viewports x 2 languages — the current assertion list has no containment check and no language dimension.

### Perf/feasibility — §11.1 budget table and §7.2 vertical accounting

**Where.** .hero-compact { min-height: var(--hero-compact-h) } and the '24+17+12+43+10+24+20+1+12+17 = 180' accounting

**Why.** MEASURED: .hero-compact is 209.5px under data-language='ar' at all three viewports (1280x800, 1920x1080, 900x600), not 180px — +16%. Same cascade cause as above (h1 43px -> 68.5px, plus the <p> eyebrow and subtitle). §11.1's table has no language column, and §9.7's claim that 'Every hero's height budget in §11 is verified at both languages' is not supported by anything in §11. Separately, the English accounting does not reconcile against the real tokens either: `margin-top: var(--s5)` is 24px (index.css:387) but the accounting uses 20; the eyebrow comes from useEyebrowClass's `text-[11px]` (ContinueWatching.tsx:19-24), an arbitrary Tailwind value that sets font-size only, so its line box is `normal` ~13px, not 17; and 17px is one line's worth for a <dt>+<dd> pair. The band only lands on 180 because min-height forces it, not because the parts add up.

**Fix.** Either accept a per-language band height and state both numbers, or pin the hero type explicitly (`html[data-language='ar'] .hero-compact-title, .hero-compact-sub, .hero-compact .eyebrow { line-height: <declared> }`). Re-derive the accounting from --s5=24/--s3=12/--fs-2xl=37 and publish a per-language, per-viewport table. Add assertion: `.hero-compact` height === --hero-compact-h within 1px, across 10 themes x 2 languages.

### "Flag anything the spec asserts but cannot measure" — §11.3 assertion 8 (CLS = 0), §1.4 ("This is asserted, not assumed")

**Where.** assert-heroes.mjs assertion 8: 'measure each hero's getBoundingClientRect().height in the loading phase and again in ready; assert equal within 1px'

**Why.** The assertion cannot execute. scripts/harness/stub-tauri.js:112 answers every invoke with `Promise.resolve(respond(cmd, args))` — synchronous, resolved on the next microtask. The `loading` phase never survives a paint, so Playwright has no frame in which to sample the skeleton's rect. The test will either sample `ready` twice (passing vacuously) or throw on a missing selector. Height parity is also not CLS: it proves the outer box does not move, not that nothing inside shifted.

**Fix.** Add a latency gate to the stub (`window.__HARNESS_LATENCY_MS__`, honoured per-command, seeded from the context init script) so the loading phase is observable; then assert rect parity AND install a `PerformanceObserver({type:'layout-shift', buffered:true})` over the mount window, asserting a cumulative score of 0 with `hadRecentInput` excluded. Report the score, do not assert a proxy for it.

### Part II ambient contract — tier resolution, 'ambient never restarts on route change', 'Quran reading pane forces Tier 0/1 in ALL themes, verified by test not by eye'

**Where.** §5.4: "routeCeiling is read from the nearest [data-ambient-ceiling] ancestor"; assertion 7

**Why.** Architecturally impossible as specified, and the assertion does not measure what it claims. <AmbientLayer/> sits at z-index 0 behind everything, i.e. as a child of `.app-container` alongside <TitleBar/> and <AppShell/> (App.tsx:59-77) — it is a SIBLING of the route tree, so it has no [data-ambient-ceiling] ancestor to read. It must poll or MutationObserve the document instead, and doing that on route entry is precisely the tear-down/restart the contract forbids: entering /quran drops the ceiling 3->1 and destroys a canvas; leaving it recreates one. Second, publishing `0` on the reading pane and `1` on the route is incoherent for a single full-viewport layer — one layer cannot be Tier 1 in one region and Tier 0 in another. Third, assertion 7 only reads the attribute value off the DOM; it never checks that the layer resolved to that tier. A ceiling attribute nobody honours passes the test.

**Fix.** Replace the ancestor read with an explicit publish: a Zustand slice (`ambientCeiling`) the route sets on mount and clears on unmount, which AmbientLayer subscribes to — no DOM walk, no MutationObserver, and the layer can diff old/new tier and keep its canvas alive when the tier is unchanged. Collapse to ONE ceiling per route (/quran publishes 0 or 1, not both). Then assert the outcome, not the attribute: on /quran, `layerEl.dataset.tier <= '1'`, `layerEl.querySelector('canvas') === null`, and a rAF counter installed before navigation records zero ambient frames while /quran is mounted. Also assert that navigating /quran -> / -> /quran does not increment a layer-instantiation counter.

### WCAG 1.4.4 Resize Text (AA) / 2.4.11 Focus Not Obscured (AA) / brief: "Arabic line-height needs 1.6-1.85 … Tailwind text-* utilities re-pin a Latin line-height"

**Where.** §4.3 `.hero-lesson { height: var(--hero-continue-h); overflow: hidden }` with `.hero-lesson-title { line-height: 1.28 }`; §5.4 `.hero-mushaf { height: var(--hero-mushaf-h) }` with `.hero-mushaf-title`; §7.2 `.hero-compact-title { line-height: 1.14 }`; §9.7's claim that `-webkit-line-clamp: 2` "holds it regardless"

**Why.** All three title classes are `<h1>`. `src/index.css:625-632` declares `html[data-language='ar'] h1 { line-height: var(--lh-arabic) }` — specificity (0,1,2) — which beats `.hero-lesson-title` (0,1,0). The authored 1.28/1.14 are dead in Arabic and 1.85 applies. `--fs-xl` is 27px, so a 2-line clamped title is 100px in Arabic vs 69px in English (+31px); `--fs-2xl` is 37px, so HeroCompact's title is 68.5px vs 42px (+26.5px). `.hero-lesson` uses fixed `height` plus `overflow: hidden`, so at the stated 900x600 minimum (208px band, 168px content box) the Arabic stack — eyebrow ~20 + title 100 + meta ~25 + meter 3 + figures ~25 + actions 43 — clips the action row entirely. A `<button>` clipped by `overflow:hidden` is still focusable and still in the tab order: keyboard focus lands on an invisible control. `.hero-mushaf` has fixed `height` and no `overflow`, so it spills over the surah tabs instead. The same fixed heights fail 1.4.4 at 200% text zoom in *both* languages, since `--hero-continue-h`'s vh terms don't scale with root font-size. §9.7 asserts the budget was "verified at both languages"; the arithmetic in §11.1 is Latin-only. `line-clamp` bounds the line count, not the height.

**Fix.** Change `height` to `min-height` on `.hero-lesson`, `.hero-mushaf` and keep `min-height` on `.hero-compact`; drop `overflow: hidden` from `.hero-lesson` (or move it to `.hero-lesson-art`, which is what actually needs it). Do not author `line-height` on the hero `<h1>`s at all — inherit, or set it via a token that has an Arabic arm (`--lh-hero-title`) declared in the same `html[data-language='ar']` block so specificity is equal and the Arabic value is intentional. Re-derive every row of §11.1 at `data-language='ar'` and add a harness assertion that no hero's `scrollHeight > clientHeight` and no focusable descendant's rect falls outside the hero's rect, at 900x600 and at 200% root font-size, in both languages.

### WCAG 1.4.3 Contrast (Minimum) AA, 4.5:1 body text — in all ten themes

**Where.** §4.2 `.hero-lesson-figures` `<span dir="ltr" class="tabular-nums text-text-faint">{formatTime(a)} / {formatTime(b)}</span>` and the `+N` slot `<span class="text-text-faint">`; §6.3 `.hero-ambient-source { color: rgb(var(--text-faint-rgb)) }`; §5.2/§5.3 `.hero-mushaf-read-off` in `text-text-faint`

**Why.** `--text-faint-rgb` measured against the surfaces these sit on: default/noor theme `83 96 120` on `--bg-card 13 20 16` = **2.98:1**; Pearl `122 137 151` on `--bg-card 255 255 255` = **3.6:1**. Both are below 4.5:1, and the noor figure is below even the 3:1 large-text floor. This is not decorative text in any of the four sites: (a) §10 explicitly designates the figures row as *the accessible value* for the meter, since the meter is `role="presentation"` — so the app's only exposed progress value is rendered at 2.98:1; (b) `.hero-ambient-source` carries the manhaj-mandated hadith/athar attribution (constraint 6), i.e. the one string the manhaj says must be present is placed in the least legible token in the system; (c) `.hero-mushaf-read-off` carries `quranWarshNoTiming` — the functional explanation of why word-sync is absent under Warsh.

**Fix.** Use `--text-muted-rgb` (measured 5.4:1 on noor bg-card, 5.6:1 on Pearl) for all four sites. Reserve `--text-faint-rgb` for genuinely non-informational glyphs (separators, disabled affordance shading). Add a harness assertion to §11.3 that computes the effective foreground/background pair for every text node inside `src/components/hero/**` across all 10 themes and fails under 4.5:1 (3:1 for >=24px or >=18.66px bold) — the brief asks for AA in all ten themes and §11.3 currently contains no contrast check at all.

### Brief: "U+2067 RLI not U+2066 LRI (formatDuration once shipped '1س 0د' as '1د0 س' through this exact bug)" / §9.4-9.5 of the spec itself

**Where.** §5.3 `<span dir="ltr" class="tabular-nums">{t('quranAyah')} {lastRead.verseId}</span>`

**Why.** `quranAyah` is `'الآية'` in Arabic (`src/i18n.ts:590`). The spec forces a strong-RTL Arabic word plus its numeral into an explicit LTR embedding — `dir="ltr"` is the element-level equivalent of U+2066 LRI, which is precisely the operation the codebase's own comment at `src/utils/formatTime.ts:23-25` names as the cause of the `1س 0د` -> `1د0 س` regression. The label and its number are reordered relative to how an Arabic reader expects them, in the one place where getting an ayah reference wrong is a correctness problem rather than a cosmetic one. The `dir="ltr"` here is doing the job of a bidi *isolate*, but LTR isolation is only correct for Latin content; `formatTime`'s pair one line below is correctly `dir="ltr"` because `mm:ss` really is Latin.

**Fix.** Wrap the whole reference in `<bdi>` and let it take the paragraph's own direction: `<bdi>{t('quranAyah')} {lastRead.verseId}</bdi>`. Reserve `dir="ltr"` for runs whose content is entirely Latin/digits. Add a §11.3 assertion that no element inside `src/components/hero/**` carries `dir="ltr"` while its text content matches `/[؀-ۿ]/`.

### Brief: "no Arabic text below 12px (dots and marks stop resolving)"

**Where.** §5.4 `.hero-mushaf-badge { font-size: var(--fs-cap) }` rendering `t('quranRiwayahHafs')`/`t('quranRiwayahWarsh')`; §5.3's `.segmented` reuse (`src/index.css:1175` `.segmented button { font-size: var(--fs-cap) }`) for the same two labels; §6.3 `.hero-ambient-source { font-size: var(--fs-cap) }`; the `--fs-cap`-sized metric labels implied by §7.2's 17px row

**Why.** `--fs-cap` is `11.5px` (`src/index.css:421`) — below the 12px Arabic floor. The strings are `'حفص'` and `'ورش'` (`src/i18n.ts:595-596`). These two words are distinguished from each other and from near-neighbours almost entirely by i'jam placement, and 11.5px in Plex Arabic on a 1x Windows display is where those dots stop resolving. `.hero-ambient-source` at 11.5px is the manhaj-required attribution. The spec adds three new `--fs-cap` Arabic sites and its §9 RTL section, which enumerates seven RTL rules, does not mention the size floor at all.

**Fix.** Add `html[data-language='ar'] { --fs-cap: 12.5px }` (or a dedicated `--fs-cap-ar`) so every existing and new caption site lifts at once, and reference it from `.hero-mushaf-badge`, `.hero-ambient-source` and `.hero-compact-metrics`. Add §11.3 assertion: no element inside `src/components/hero/**` whose text matches `/[؀-ۿ]/` has a computed `font-size < 12px`, run at `data-language='ar'`.

### Brief: "no Arabic text below 12px" + "no letter-spacing on Arabic … a Tailwind utility on the element still wins"

**Where.** §0 `src/hooks/useEyebrowClass.ts` — "Moved **verbatim** out of `ContinueWatching.tsx:19-24`"; §9.6 "All four heroes take the eyebrow from the single `useEyebrowClass()` hook … and never re-derive it inline"

**Why.** The hook's Arabic arm is `'text-[11px] font-medium text-muted-text'` (`src/components/dashboard/ContinueWatching.tsx:21`) — an **11px** hard-coded arbitrary Tailwind size, below the Arabic floor. The spec mandates this hook as the single eyebrow source for all four heroes and all six HeroCompact call sites, so "verbatim" multiplies one existing 11px-Arabic defect across every route in the app. Two secondary problems compound it: `text-[11px]` is one of the 160 arbitrary-px classes the Phase-0 audit flagged, and it escapes both §11.3 grep gates, which scope only `src/components/hero/**` and `src/components/marks/**` — the hook is being deliberately moved to `src/hooks/`, i.e. outside the gate. The extraction is the one moment where this is a one-line fix.

**Fix.** Do not move it verbatim. Arabic arm: `'text-xs font-medium text-muted-text'` (resolves to `--fs-cap`, which the previous finding lifts to >=12px under `data-language='ar'`). Latin arm keeps `uppercase tracking-[0.16em]` but takes `text-xs` too. Extend the §11.3.9/10 grep gates to include `src/hooks/useEyebrowClass.ts` and add `text-\[` (arbitrary font sizes) to the forbidden-pattern list for hero code.

### WCAG 1.4.3 Contrast (Minimum) AA

**Where.** §1.3 "`trailing` renders as `<span dir="ltr" className="tabular-nums opacity-60">`"

**Why.** `trailing` carries real information — §4.2 uses it for `formatDuration(remaining)`, the time left in the lesson, on the primary Resume button. `.btn-primary` is `text-background` on an `--accent-gold` fill (`src/index.css:2028`). Composited at 60% opacity: noor, `bg-main 3 4 4` over gold `236 195 102` gives an effective `96 80 43` against the gold = **4.37:1**, already under 4.5. Pearl is far worse: the base pair `bg-main 243 246 247` on `accent-gold 175 123 45` is **3.39:1** *before* the opacity, so at 60% the trailing text is roughly **1.6:1** — illegible. `opacity` on a text node is not a token-derived colour choice; it silently multiplies whatever the theme resolved.

**Fix.** Delete `opacity-60`. If the trailing needs to recede, do it with a token that was contrast-checked against the primary fill (e.g. a `--on-accent-soft` declared once per surface profile), not with alpha. Separately, Pearl's `.btn-primary` label at 3.39:1 needs its own fix — `html[data-surface='light']` should darken `--accent-gold-rgb` for the button fill or switch the label to `--text-main-rgb`; §8.2's Pearl row currently addresses shadows and the badge but not the primary button's own label.

### WCAG 1.3.1 Info and Relationships / 4.1.2 Name, Role, Value — icon-and-number-only content with no accessible name

**Where.** §4.2 `<p class="hero-lesson-figures"><span class="tabular-nums"><bdi>{round(percent)}%</bdi></span><span dir="ltr">{formatTime(p)} / {formatTime(d)}</span></p>` and `<bdi class="tabular-nums">+{n}</bdi>`, together with §10 "The progress meter is `role="presentation"`; the figures beneath it are the accessible value"

**Why.** §10 makes an explicit, defensible decision (no `role="progressbar"` on a resume rail) and then never supplies the label that decision requires. A screen reader reaching this reads `"42%"`, then `"12:34 slash 45:10"` — two bare number runs with no indication that one is completion and the other is elapsed-of-total. `formatTime` emits `m:ss`/`h:mm:ss` (`src/utils/formatTime.ts:1-12`), which most SRs voice as a clock time. The `+N` sibling count is worse: `"plus 3"` in isolation is meaningless, and §4.1's own comment says it "Renders as '+N', never a list" — so the count is the *only* representation of that information.

**Fix.** Give the figures row an `aria-label` composed from i18n keys, e.g. `aria-label={t('heroProgressLabel', { percent, elapsed: formatDurationLong(p, language), total: formatDurationLong(d, language) })}` with the visible spans `aria-hidden`. `formatDurationLong` already exists (`src/utils/formatTime.ts:44`) and produces speech-friendly Arabic and English. Give `+N` an `aria-label` from a new key (`heroMoreInCollection`). Add both keys to §12.

### Load-bearing invariant — the mushaf frame/jadwal; §7.2's own claim that 'the mask and the two pseudo-element rules still frame the visible page'

**Where.** §7.2: '.quran-reading-viewport also gains .overlay-scroll', combined with §1.7's '.overlay-scroll { scrollbar-gutter: stable; margin-inline-end: calc(-1 * var(--scroll-gutter)); padding-inline-end: var(--scroll-gutter); }'

**Why.** Verified at src/index.css:827-840 — .quran-reading-frame is `position:relative; isolation:isolate; overflow:hidden` with no padding, so its content box equals its border box. .overlay-scroll's `margin-inline-end: -8px` therefore extends the viewport's border box 8px past the frame's edge, and the frame clips it. The reserved 8px scrollbar gutter sits at exactly that inline-end edge, so the mushaf viewport renders NO visible scrollbar at all — on the one surface in the app that scrolls 36,000px (per the comment at Quran.tsx:1199-1216). Separately, `scrollbar-gutter: stable` reserves 8px inside the viewport, shifting the reading column 8px toward the inline-start relative to the frame. The jadwal is positioned against the frame at `inset: clamp(0.85rem,1.35vw,1.1rem)` and its inner rule at `clamp(1.72rem,2.3vw,2.05rem)`, both symmetric; the ayah column inside them is no longer centred. A printed mushaf page has equal margins inside its jadwal — this makes them differ by 8px, in both LTR and RTL, since margin-inline-end is the scrollbar side in both.

**Fix.** Do not apply .overlay-scroll to .quran-reading-viewport. Give the viewport its own rule that omits both the negative margin and the gutter reservation — it needs only the transparent-until-hovered thumb: `.quran-reading-viewport::-webkit-scrollbar-thumb { background: transparent }` plus `:hover`/`:focus-within` variants at `rgb(var(--hair-rgb) / 0.22)`. If the reclaim behaviour is wanted elsewhere, split the class into `.overlay-scroll` (thumb only) and `.overlay-scroll-reclaim` (margin + gutter) and use the former on the mushaf. Add a §12 assertion: the reading surface's inline-start and inline-end offsets inside .quran-reading-frame agree within 1px, in both dir values, and the viewport's scrollbar thumb is within the frame's clip rect.

### Manhaj constraint 5 — Hafs and Warsh are NEVER mixed, in a view, cache key or storage key; which riwayah is on screen is a correctness question

**Where.** §11 call sites: "Quran's riwayah selector (mode=\"single\", exactly two chips, and the two must never be simultaneously selectable — `single` mode guarantees it)"

**Why.** The guarantee does not exist. ChipRow is fully controlled: `selectedIds: readonly string[]` and `onToggle: (id: string) => void` are both supplied by the caller, and `mode` only describes what the caller is expected to do in its own handler. Nothing in ChipRow rejects a two-element selectedIds, an empty selectedIds, or a caller that toggles rather than sets. The props also expose `onClear?: () => void` and `clearLabel?`, which by construction produce a zero-riwayah state, and `disabled?: boolean` on ChipModel, which could disable the active riwayah. Separately this is an affordance downgrade: the shipping control at src/pages/Quran.tsx:1098-1106 is `.segmented` with two aria-pressed buttons whose active segment is a filled surface (index.css:1214-1220), carrying the comment 'both readings stay legible at all times — which riwayah is on screen is a correctness question, never a hidden setting'. A .chip unselected is `background: transparent` with a `--edge-1` hairline; the selected/unselected delta is far quieter, on the one control where legibility is a manhaj requirement.

**Fix.** Do not migrate the riwayah selector to ChipRow. Leave it on `.segmented`, or give it a dedicated `RiwayahSelect` block whose type makes the invariant unrepresentable: `{ value: QuranRiwayah; onChange: (r: QuranRiwayah) => void }` — one required value, no array, no toggle, no clear. If ChipRow must be reused, add a discriminated variant `{ mode: 'exclusive'; selectedId: string; onSelect: (id: string) => void }` with `onClear` structurally excluded. Add a §12 assertion: on /quran, exactly one riwayah control carries aria-pressed="true" at all times, across 5 themes x 2 languages, after clicking each option twice.

### Perf budget — zero contribution to input latency; §7 SplitPane 'Resizing changes a grid track. It never applies a transform'

**Where.** §7 `--split-start` is written as a px value on the element's style by the resize logic; §7.1 applies SplitPane fill to `/quran` with `id="quran-read"`

**Why.** The spec correctly forbids `transform` on a pane (it would desync the cue), but the consequence is that every `pointermove` during a drag rewrites a grid track and forces a full relayout of both panes. On `/quran` the end pane contains the entire surah: `Quran.tsx:617` renders one `<span id={`quran-word-${surahId}-${ayah}-${index+1}`}>` per word, and §7.4 forbids virtualizing inside `.quran-reading-surface`. Al-Baqarah is ~6,200 ayah-words in the DOM (the index.css:826 comment records the column at 36,000px in a 900px window). Reflowing a shaped RTL text column of that size is tens of milliseconds per move event. `.quran-reading-frame`'s `overflow:hidden` bounds *painting*, not *layout*. The drag will run at 12–30fps on the one route where the invariants matter most, and 'zero contribution to input latency' is asserted, never measured.

**Fix.** Two changes. (1) rAF-coalesce `pointermove` so at most one track write happens per frame. (2) On `/quran` specifically, drag a 1px ghost rule (absolutely positioned, `transform`-animated inside the SplitPane shell only — never on a pane) and commit `--split-start` once on `pointerup`; that turns N reflows into 1. Measurement to add: Performance-panel recording of a 1s drag on `/quran` with Al-Baqarah open — assert p95 `Layout` duration per frame < 8ms and no frame > 32ms; today the spec has no such probe.

### §12 assertion 3 — 'Radio is virtualized: /radio scroller scrollHeight under 3000px at 1280×800 with the 175-station fixture'

**Where.** §8 'Radio's 175 stations plus ~20 headers is 195 rows — virtualized, ~15 in the DOM. estimatedRowHeight={68}' + §12.3

**Why.** Virtualization does not reduce `scrollHeight`. @tanstack/react-virtual sets the container's height to `totalSize` precisely so the scrollbar stays honest — the assertion is unsatisfiable by construction. Worse, it is a regression: the measured 6,431px came from `Radio.tsx:217`'s two-column grid (`grid-cols-1 gap-x-10 lg:grid-cols-2`), and `ListGrouped` has no column concept, so 175 rows × 68px + ~20 headers × 34px ≈ 12,580px — roughly double the number the spec claims to fix. §13's 'fixes 6431px' is false as written.

**Fix.** Give `ListGrouped` a `columns?: 1 | 2` prop that flattens each group into rows of N (headers always span), preserving Radio's two-column layout and the `Radio.tsx:213-215` dangling-hairline rationale. Then restate the assertion as what virtualization actually buys: `document.querySelectorAll('#radio-catalogue .rule-row').length < 40`, plus a scripted 4000px scroll asserting p95 main-thread frame time < 8ms. Delete the scrollHeight clause.

### §8 sticky headers + §8 defaults (`stickyHeaders` default true, `height` default 'auto')

**Where.** `.list-grouped-pinned { position: absolute; inset-block-start: 0 }` inside `.list-grouped-shell { position: relative }`

**Why.** `position: absolute; top: 0` pins the header to the top of the *shell*, not the top of the scroll container. With `height='auto'` (the default) the shell is not a scroller — `useScrollParent` resolves to `.page-container` — so the shell and its 'pinned' header scroll off the top of the window with the page. The pinned header only works when `height='fill'`, which is not the default and is not what Radio uses today. The default configuration ships a header that does not stick.

**Fix.** Either make `height='fill'` a precondition (`if (import.meta.env.DEV && stickyHeaders && height !== 'fill') throw`), or render the pinned header as `position: sticky; inset-block-start: 0` as a first child *inside* the scroll container so it works in both modes. Add a probe: scroll `/radio` by 600px and assert the pinned header's `getBoundingClientRect().top` is within 2px of the scroller's top.

### §12 assertion 6 — 'The cue tracks a resize'; 'Everything below is checked by rendering, through the harness already at scripts/harness/'

**Where.** 'Drive the #quran-read split handle from 320px to 420px, then assert the .quran-word-cue's bounding box still intersects the .quran-word-active element's box by ≥80% of the cue's area.'

**Why.** The harness cannot produce a `.quran-word-active` element. `scripts/harness/stub-tauri.js:63` returns `get_quran_synced_audio: function () { return null; }` and `:62` returns `get_quran_word_timing_reads: () => []`, so `synced` is null, `useWordSync` (`Quran.tsx:492`) returns before scheduling its rAF loop, and no word is ever classed active. There is additionally no playing `<audio>` element in headless Chromium for `audioElementHolder.current.currentTime` to read. This is the single most important assertion in §12 — it is the one guarding the load-bearing cue invariant — and it is the one that cannot run.

**Fix.** Add a `syncedAudio` fixture to `scripts/harness/fixtures.mjs` with 2–3 ayat of fabricated `ayahTimings`/`wordTimings`, return it from `get_quran_synced_audio`, and have `stub-tauri.js` install a fake audio element on `audioElementHolder` exposing `{ paused: false, duration, currentTime }` that the probe advances manually. Then the probe sets `currentTime`, waits a frame, drags the handle, waits for the 160ms cue transition to settle, and compares rects. Without this the assertion should be struck rather than left in as a claim.

### Load-bearing invariant — the mushaf reading pane; §7.2 '`.quran-reading-viewport` also gains `.overlay-scroll`'

**Where.** §1.7 `.overlay-scroll { margin-inline-end: calc(-1 * var(--scroll-gutter)); padding-inline-end: var(--scroll-gutter); scrollbar-gutter: stable }` applied to `.quran-reading-viewport`

**Why.** Two defects from one class. (a) `.quran-reading-viewport`'s parent `.quran-reading-frame` is `overflow: hidden` (index.css:830-832). The -8px inline-end margin pushes the viewport's inline-end border edge — where the scrollbar is painted — 8px outside the frame's clip, so the mushaf scroller loses its scrollbar entirely. (b) `scrollbar-gutter: stable` (8px) plus `padding-inline-end: 8px` puts 16px of inset on the viewport's inline-end content edge and 0 on the inline-start. `.quran-reading-surface` fills that box, so the mushaf text column sits 16px off-centre inside a jadwal that is drawn symmetrically on the frame (`.quran-jadwal { inset: clamp(0.85rem, 1.35vw, 1.1rem) }`, index.css:876). A printed page frame with the text block visibly off-centre is exactly the class of defect the 5-theme × 2-language sweep exists to catch. The spec's only comment on this is 'It already has overscroll-behavior: contain; the class re-declares it identically, which is harmless' — it audits the one harmless declaration and not the two harmful ones.

**Fix.** Do not apply `.overlay-scroll` to `.quran-reading-viewport`. Split the class: `.overlay-scroll` keeps the thumb styling and `overscroll-behavior` only; a separate `.overlay-scroll-bleed` adds the negative-margin/padding pair, and is used only on panes whose parent does not clip. If the gutter is wanted on the mushaf, pad *both* inline sides equally so the column stays centred in its frame. Add a probe: assert `.quran-reading-surface`'s centre x is within 1px of `.quran-reading-frame`'s centre x, in both `ltr` and `rtl`.

### Manhaj constraint 1 — no depiction of animate beings anywhere (and §2 ANIMATE_ICON_DENYLIST / §7.4 check-manhaj.mjs, the spec's own stated enforcement for it)

**Where.** §2 `ANIMATE_ICON_DENYLIST` — the 50-name exact-match list, enforced by `scripts/check-manhaj.mjs` "against every `lucide-react` import across `src/`"

**Why.** The list is an exact-name denylist checked against a library that ships 3450 icon files (`node_modules/lucide-react/dist/esm/icons/`). It fails open on at minimum 40+ icons that depict humans, human faces, hands or animals and that a future contributor can import with zero friction: User2, UserCheck, UserCheck2, UserCircle2, UserCog, UserCog2, UserMinus, UserMinus2, UserPen, UserPlus, UserPlus2, UserRoundCheck, UserRoundCog, UserRoundMinus, UserRoundPen, UserRoundPlus, UserRoundSearch, UserRoundX, UserSearch, UserSquare, UserSquare2, UserX, UserX2, Users2, Contact2, Bot, BotOff, BotMessageSquare, ScanFace, ScanEye, FishOff, Handshake, HandCoins, HandHeart, HandHelping, HandPlatter, HeartHandshake, Heart, HeartCrack, HeartPulse, HeartOff, Beef, Ham, Drumstick. `Bot` and `BotMessageSquare` are literal faces with eyes; `ScanFace` is a face; the 24 unlisted `User*` variants are the same human figure as the listed `User`. The list also contains a phantom (`Panda` does not exist in this lucide version) and two duplicates (`Squirrel`, `Baby`) — evidence it was hand-written, not generated, which is exactly why it is incomplete. A constraint stated as absolute cannot be enforced by a hand-maintained blocklist against a 3450-icon surface.

**Fix.** Invert the mechanism to an allowlist: `check-manhaj.mjs` fails on any `lucide-react` import specifier not present in an explicit, reviewed `APPROVED_ICONS` set (seed it with the 51 icons actually in use today, all of which are objects or abstractions). Keep the denylist only as a documentation aid. Additionally the checker must parse real import specifiers including aliases — this repo already contains `Library as LibraryIcon`, and `import { User as PersonIcon }` must fail. Also add a repo-wide regex backstop on normalized icon names matching /^(user|users|contact|bot|hand|heart|face|scan-(face|eye)|person|baby|paw|foot|fish|bird|cat|dog|rabbit|rat|bug|snail|turtle|worm|squirrel|shell|feather|egg|bone|skull|ghost|brain|ear|eye|smile|frown|laugh|meh|angry|annoyed|drama|venetian|beef|ham|drumstick)/.

### Manhaj constraint 5 — Hafs and Warsh are NEVER mixed, not in a view, component, cache key or localStorage key; recitation timing data is Hafs-only

**Where.** §4 E6 `networkOffline`, scope `reciters` — `errOfflineRecitersCause`: en "Reading the mushaf works offline in both riwayat. Only the recitation audio is fetched over the network." / ar "قراءة المصحف تعمل دون اتصال في كلتا الروايتين. الصوت وحده هو ما يُجلب عبر الشبكة."

**Why.** The sentence tells the user that the ONLY thing distinguishing the two riwayat with respect to recitation is the network — i.e. that recitation audio is a feature of both, merely online-gated. It is not. Timing data is Hafs-only, and the store confirms the Listen surface is riwayah-blind: `syncedAudio` is keyed `${readId}:${surahId}` with no riwayah component (`quranStore.ts:103`), and `RECITER_KEY = 'salafi-hub.quran-reciter.v1'` (`quranStore.ts:130`) is not riwayah-tagged, unlike `lastReadKey`/`bookmarksKey` which correctly are (`quranStore.ts:124-127`). The spec compounds this by adding three new state blocks to that same riwayah-blind Listen surface (`quranReciterFilter`, the `reciters` error scope replacing `Quran.tsx:1538-1554`, and the strip at `:100-105`) — it expands a mixing surface while writing copy that denies the restriction exists.

**Fix.** Rewrite the cause to state the restriction rather than deny it: en "Reading the mushaf works offline. The reciter list and the recitation audio are fetched over the network, and recitation is available for Hafs." / ar equivalent naming حفص. Additionally: this variant, `quranReciterFilter`, and `radio`/`reciters` scope selection must read `quranStore.riwayah` and the Listen surface must not offer word-synced recitation while `riwayah === 'warsh'`. If that gating is genuinely out of scope under constraint 11, the copy still must not assert equivalence — delete the phrase "in both riwayat" / "في كلتا الروايتين".

### Load-bearing invariant — a CSS mask applies to an element's whole subtree, which is why the jadwal's hairlines live on `.quran-reading-frame`'s pseudo-elements and not inside the masked `.quran-jadwal` (also collides with the spec's own §7.3 assertion 6)

**Where.** §5 `<LoadingState>`, `readingPane` variant: "It renders `mistara` ruled lines inside the jadwal frame with `pulse={false}`"

**Why.** "Inside the jadwal frame" is ambiguous in exactly the way the invariant warns about. `.quran-jadwal` (`index.css:876-908`) carries eight `mask-image` layers; any ruled line rendered as its descendant is clipped to the ornamental band's silhouette and mostly disappears — the documented failure verbatim. It also carries `animation: jadwal-in 620ms var(--ease-out) both` (`index.css:908`), so if readingPane renders inside it, the spec's own probe assertion 6 ("no descendant with a non-`none` computed `animation-name`") fails against the app's existing CSS. Compounding this, the surface readingPane replaces (`Quran.tsx:299-303`) is not inside `.quran-reading-frame` at all — it is a sibling in `<section className="min-h-[50vh]">`, and `.quran-reading-frame`/`.quran-jadwal`/`.quran-reading-surface` only exist inside `SurahReader`. So the sentence describes a DOM position that does not exist and, if implemented literally, breaks two documented things.

**Fix.** State the placement explicitly and negatively: readingPane renders as a sibling in `Quran.tsx`'s `<section>`, exactly where `ReaderPlaceholder` (`Quran.tsx:326-333`) renders today, drawing its own square-cornered nested borders on its own elements. It is never a child of `.quran-jadwal` (masked subtree), never a child of `.quran-reading-frame`, and never a child of `.quran-reading-surface`. Add a probe assertion that `[data-state-block]` has zero ancestors matching `.quran-jadwal, .quran-reading-surface`.

### WCAG 2.4.7 / 2.4.11 — visible focus; §1.7 .overlay-scroll, §3 .rail-scroller, §9 .rule-list[data-virtual]

**Where.** `.rail-scroller { overflow-x: auto; overflow-y: hidden; padding-inline: var(--rail-pad); padding-block-end: var(--s2); }` and `.overlay-scroll { overflow-y: auto; padding-inline-end: var(--scroll-gutter); }`

**Why.** `--ring-focus` (src/index.css:586) is a box-shadow that paints 4px OUTSIDE the element's border box: `0 0 0 2px rgb(var(--bg-main-rgb)), 0 0 0 4px rgb(var(--accent-gold-rgb)/0.95)`. Every new scroll container the spec introduces clips it. `.rail-scroller` sets `overflow-y: hidden` with `padding-block-start: 0`, so the top 4px of every card's ring is cut off (only the bottom is padded, and that padding is for the lift shadow). `.overlay-scroll` has zero block padding and zero inline-START padding, and `.rule-row` carries only `0.125rem` (2px) inline padding — so on every list in the app (Quran surah index, Quran reciter list, Radio catalogue, ListCompact, ListGrouped) the row focus ring is clipped on three sides, and the first and last rows lose it almost entirely. `overflow-y: auto` also forces `overflow-x` to `auto`, so the inline edges clip too. The spec explicitly sized `--rail-pad: 5px` to "clear --ring-focus (4px) at the rail's start edge" — it did the arithmetic on one axis of one component and skipped every other case.

**Fix.** Either (a) reserve ring space on every axis of every new scroller: add `padding-block: 5px` to `.rail-scroller`, `padding: 5px` (not just `padding-inline-end`) to `.overlay-scroll` with the negative-margin trick extended to all four logical sides, and raise `.rule-row`'s inline padding from `0.125rem` to `5px`; or (b) add a `--ring-focus-inset` variant (`inset 0 0 0 2px ground, inset 0 0 0 4px accent`) and make the block components apply it instead, so the ring paints inside the border box and cannot be clipped. Add a harness assertion to §12: focus each first/last row and card on every route and assert the focused element's `getBoundingClientRect()` inflated by 4px is fully contained by its scroll container's client rect.

### WCAG 2.4.7 / 2.4.11 — visible focus; §3 edge fades

**Where.** `.rail-scroller` mask + `scroll-padding-inline-start: var(--rail-pad)` (5px only), with `--rail-edge: 2.5rem` fade and `scrollIntoView({ block:'nearest', inline:'nearest' })` in §1.6

**Why.** The mask fades the inline-end 40px of the rail to transparent whenever `atEnd` is false. Arrow-key navigation calls `scrollIntoView({ inline: 'nearest' })`, which parks the newly focused card flush against that edge — directly inside the 40px fade. The focused card and its ring are progressively erased to 0% opacity. There is no `scroll-padding-inline-end`, and the fade is toggled by scroll position, never by focus. The spec's own reasoning covers only the start edge ("Because the start fade is 0px while atStart, a focus ring on the first card is never clipped") and never addresses the end edge, which is the one keyboard traversal actually lands on. The same defect applies to `ChipRow overflow="scroll"`, which §11 says reuses this scroller verbatim.

**Fix.** Set `scroll-padding-inline: var(--rail-edge)` on `.rail-scroller` so a keyboard-scrolled card always lands clear of both fades, and add `.rail-scroller:focus-within { --fade-left: 0px; --fade-right: 0px; }` so the mask is suppressed entirely while a card inside holds focus (the fade is decoration; focus is not). Add §12 assertion 7b: with the rail keyboard-paged to the middle, assert the focused card's box does not intersect either fade band.

### WCAG 1.4.11 non-text contrast + 1.4.1 use of colour; manhaj constraint 5 (Hafs/Warsh never mixed); §11 .chip

**Where.** `.chip[aria-pressed='true'] { background: linear-gradient(177deg, rgb(var(--accent-gold-rgb)/0.13), rgb(var(--accent-gold-rgb)/0.05)) padding-box, var(--edge-accent) border-box; color: rgb(var(--text-main-rgb)); }` and §11 "Quran's riwayah selector (mode=\"single\", exactly two chips)"

**Why.** I computed the selected chip's rendered fill against the ground in all ten themes: 1.15, 1.16, 1.15, 1.17, 1.24, 1.24, 1.20, 1.32, 1.26, 1.30 : 1. Against a HOVERED unselected chip (`--wash-hover` is the same gold at 0.10) it is 1.03–1.08 : 1 in every theme, and both states set `color: rgb(var(--text-main-rgb))` — so a hovered unselected chip and a selected chip are visually identical. Selection state fails 1.4.11 (3:1) by a factor of ~2.5. This is not a hypothetical: §11 routes the Quran riwayah selector through it. The control that keeps Hafs and Warsh apart would ship with a state indicator no user can see. It is also a straight regression — the riwayah selector today is `.segmented` (src/index.css:1214-1222), whose selected state is a full-opacity 1.5px `rgb(var(--accent-gold-rgb))` underline measuring 3.18–11.71 : 1 against the ground in the ten themes. The spec replaces a compliant indicator with a non-compliant one.

**Fix.** Give `.chip[aria-pressed='true']` a state cue that does not rely on a low-alpha tint: a full-opacity 1px accent border (`border-color: rgb(var(--accent-gold-rgb))`, measured 3.18–11.71:1) plus `color: rgb(var(--accent-gold-rgb))` and `font-weight: 600` — and keep hover to the wash only, so hover and selected are structurally different, not two alphas of the same gold. Then EXCLUDE the riwayah selector from the ChipRow migration entirely: leave it on `.segmented`, which already passes, and note the exclusion in the §13 migration map. Add a §12 assertion computing selected-vs-unselected and selected-vs-hover contrast for `.chip` in all ten themes with a 3:1 floor.

### WCAG 2.1.1 keyboard / 2.4.3 focus order; §7 SplitPane collapse

**Where.** "`collapsibleStart` puts a `.quiet-action` in the start pane's header slot labelled `t('collapsePanel')` / `t('expandPanel')`" + "Collapsed sets `--split-start: 0px` and `visibility: hidden` on `.split-start` (kept mounted…)"

**Why.** The expand button lives inside `.split-start`. Collapsing sets `visibility: hidden` on `.split-start`, which removes the whole subtree — including that button — from the accessibility tree and the tab order. So the control labelled `expandPanel` can never be reached in its expanded-label state; it is hidden the instant it becomes relevant. Worse, the user activated it with focus ON it, so at the moment of collapse `document.activeElement` becomes `visibility: hidden` and focus is dropped to `<body>` — the keyboard user loses their place entirely, on `/quran` and `/downloads` and `/dashboard`. The spec's stated recovery paths (double-click the handle, Enter/Space on the handle) are both unreachable without first re-acquiring focus by Tabbing from the top of the page, and one of them is pointer-only.

**Fix.** Move the collapse toggle OUT of `.split-start` — put it on the handle itself, or in the SplitPane's own header row that is a sibling of both panes. On collapse, explicitly `handleRef.current.focus()` before applying `visibility: hidden`, and on expand restore focus to the element recorded at collapse time. Keep the handle mounted and focusable in the collapsed state (it already is). Add a §12 assertion: collapse via keyboard, then assert `document.activeElement !== document.body` and that a subsequent `Enter` re-expands.

### WCAG 2.4.11 Focus Not Obscured (Minimum); §8 sticky headers, §2 SectionHeader sticky

**Where.** `.list-grouped-pinned { position: absolute; inset-block-start: 0; z-index: 2; block-size: var(--group-head-h); background: var(--bg-main); }` and `.section-header-sticky { position: sticky; inset-block-start: 0; z-index: 2; background: var(--bg-main); }`

**Why.** Both paint an opaque 34px+ band over the top of the scroll container. §1.6 moves keyboard focus with `virtual.scrollToIndex(next, 'auto')`, and `'auto'` scrolls the target to the nearest edge — for upward navigation that is the TOP edge, i.e. underneath the pinned header. No `scroll-padding-block-start` is specified on the scroller, so arrowing up through a grouped list (Radio's 175 stations is the headline case) repeatedly parks the focused row completely hidden behind an opaque band. That is a direct WCAG 2.2 AA failure, and it is invisible to §12's assertions because none of them touch focus.

**Fix.** Add `scroll-padding-block-start: var(--group-head-h)` to the `ListGrouped` scroller and `scroll-padding-block-start: calc(var(--group-head-h) + var(--s2))` to any scroller hosting a `SectionHeader sticky`. Since `pushY` already tracks the pinned header's live offset, drive the scroll padding from the same value rather than a second constant. Add a §12 assertion: keyboard-navigate up through a grouped list and assert the focused row's top edge is >= the pinned header's bottom edge at every step.

### WCAG 1.4.3 contrast (4.5:1 body); §1.1 MetaLine, §2 SectionHeader count, §8 alpha index

**Where.** `<span className="shrink-0 text-[11px] tabular-nums text-text-faint">`, the alpha index rail's "one 11.5px tabular-nums letter per bucket in `text-text-faint`", and `MediaCardModel.meta` rendered via MetaLine

**Why.** I computed `--text-faint-rgb` against `--bg-main-rgb` for all ten themes: noor 3.24, emerald 3.59, pearl 3.30, mushaf 3.34, blue 3.43, red 3.82, onyx 3.15, mushaf-gold 3.30, maktabah 3.13, samaa 3.13. Not one theme reaches 4.5:1, and every one of these uses is small text (11–13.5px), so 4.5:1 is the applicable threshold, not 3:1. The spec expands `--text-faint` into three new roles: the card meta line (the third line of EVERY poster and wide card, which is now the only place duration/date survives after paths are stripped), the count on every section header, and the alpha index — which is an interactive control, so its resting state also fails 1.4.11's 3:1 for the non-selected buckets. `--text-muted` measures 4.65–7.07 and passes everywhere; the spec had a compliant token available and chose the failing one.

**Fix.** Route all three uses to `text-muted-text` (`--text-muted-rgb`, verified 4.65–7.07 across all ten themes). Reserve `--text-faint` for non-informational rules and separators only, and state that restriction in the token comment. If a visual step below muted is genuinely wanted for the meta line, add a new `--text-quiet-rgb` seed per theme tuned to land at 4.5–5:1 rather than reusing faint. Add a §12 assertion computing rendered contrast for every `.card-meta`, `.section-header-count` and alpha-index letter across all ten themes against a 4.5:1 floor.

### Perf budget — zero contribution to input latency (new backend command, §1.5)

**Where.** §1.5 `count_orphaned_entries` declared `#[tauri::command] pub fn` (sync), called by `healthStore.checkDatabase()` on app mount and on every window focus

**Why.** A sync Tauri command runs on the main thread, not the async runtime. This one calls `get_all_videos` (full table, no LIMIT) then does one `Path::exists()` syscall per row. The repo already treats exactly this as main-thread-hostile: `src-tauri/src/commands/file_ops.rs:128-132` wraps a single `Path::exists()` in `tauri::async_runtime::spawn_blocking`. Spec's version does N of them on the main thread. On a disconnected SMB/USB path each stat blocks on the OS timeout, so the window message pump stalls for seconds and Windows paints the ghost 'not responding' frame — with no user action having been taken.

**Fix.** Declare it `pub async fn ... -> Result<usize,String>` and wrap the body in `tauri::async_runtime::spawn_blocking`, mirroring `file_ops.rs:128`. Add an early-exit cap (stop counting at 50, return `>=50`) so cost is bounded. Run it once on mount only, never on focus. Measurement to gate it: time the command with N=1k / 10k rows on local SSD, on a spun-down USB HDD, and with the volume unplugged; budget p95 < 150 ms local, and the unplugged case must not block the main thread at all.

### Perf budget — zero contribution to input latency; measure don't estimate (§4.3 detection)

**Where.** §4.3 `healthStore.checkDatabase()` → `invoke('repair_database')` on app mount and after `import_finished`; §4.2 E5 calls it 'a read-only PRAGMA integrity_check'

**Why.** Read-only is true; cheap is not. `settings.rs:251-263` takes `db.lock()` — the app's single `Mutex<Connection>` — and holds it for the whole of `PRAGMA integrity_check`, which reads and verifies every page of the database. It is also a sync command (main thread). Every other DB call queues behind it, including the `save_progress` writes `playerStore.ts:283/454/489/503/569/591` issues during playback. Turning a user-initiated maintenance button into an automatic mount+focus probe means a full-database page scan competing with playback I/O at launch.

**Fix.** Use `PRAGMA quick_check` for detection (same signal for corruption, orders of magnitude cheaper) and keep `integrity_check` behind the user-pressed `repairDatabase` recovery button. Make the probe `async` + `spawn_blocking`. Run it at most once per session, never on focus, and never while any `<audio>`/`<video>` element is playing. Measurement: wall-clock `quick_check` vs `integrity_check` on 50 MB / 200 MB / 500 MB DBs, and p95 `save_progress` latency with and without the probe running.

### Perf budget — ambient/background work must not run while media plays; offline-first product constraint

**Where.** §4.3 `checkNetwork()` → `runDiagnostics` described as 'the authoritative network probe', and §4.1 `runDiagnostics` listed as a secondary action on E2/E6/E7

**Why.** `get_diagnostics` (`src-tauri/src/commands/diagnostics.rs:14-57`) is not a probe, it is a full system sweep: it spawns `curl` twice (`--connect-timeout 8 --max-time 15`, so up to 30 s of blocking-thread time), spawns `detect_ffmpeg_for_app`, and spawns `yt-dlp --version`. Four subprocesses per call. Wiring it into an automatic mount/focus health check means an offline-first study app makes an unsolicited outbound HTTPS request to github.com every time it launches or is alt-tabbed back to, and holds a blocking thread for up to 30 s.

**Fix.** Keep `runDiagnostics` strictly user-initiated (button only), exactly as it is today. For automatic detection use tier 1 (`navigator.onLine`) plus tier 2 (a command that already failed) and stop there — 'suspected' is the honest state and the spec already defines copy for it. If an automatic probe is wanted, add a separate command that does one HEAD with a 3 s timeout and nothing else. Measurement: count process spawns and total blocking-thread seconds per app launch; budget zero spawns from automatic paths.

### Constraint 11 (do not disturb the Qur'an audio/word-sync path); Invariant — word-sync reads the shared audio clock every frame

**Where.** §4.2 E2 `radioOffline`, scope `stream`, bound to `radioStore.playbackError` and mounted as a `strip` inside `RadioMiniPlayer.tsx:211-219`; recovery action `retryRadioStream` → `radioStore.retry()`

**Why.** The radio store is not radio-only. Qur'an recitation is played through it: `Quran.tsx:1497` calls `radioStore.play({ url: surahAudioUrl(...) })`, and `audioElementHolder` (`radioStore.ts:23`) is the same element `useWordSync` reads `currentTime` from every animation frame (`Quran.tsx:526-536`). `markPlaybackError` therefore fires for a stalled *recitation*, and `RadioMiniPlayer` is a global fixed element visible on `/quran`. Result: a recitation stall renders a strip captioned 'This station is not responding' beside the mushaf, offering 'Reload the station list'. Worse, `retry()` (`radioStore.ts:150-159`) re-sets `current` under a new identity to force the element to reload — pressing it during recitation restarts the audio at 0, so the word cue jumps to the start of the surah mid-ayah.

**Fix.** Discriminate the source before rendering E2: add a `kind: 'station' | 'recitation'` field to `radioStore.current` (or check the url against `surahAudioUrl`) and render the radio strip only when `kind === 'station'`. Give recitation failures their own variant/copy and a retry that seeks back to the ayah start rather than reloading from 0. Verification: a harness case that starts recitation, forces `markPlaybackError`, and asserts no `[data-state-block="error"][data-variant="radioOffline"]` exists on `/quran`.

### Verification — 'visual changes are checked by rendering'; §7.3 assertion 6

**Where.** §7.3.6 'In fixture `loading` on /quran, readingPane has no descendant with a non-`none` computed `animation-name`'

**Why.** Both harness entry points create their contexts with `reducedMotion: 'reduce'` (`scripts/harness/shoot.mjs:84`, `scripts/harness/probe.mjs:47`). Every skeleton in the repo is written `motion-safe:animate-pulse`, which compiles inside `@media (prefers-reduced-motion: no-preference)`. Under the harness that media query never matches, so computed `animation-name` is `none` on every skeleton in every variant. The assertion passes identically whether `readingPane` sets `pulse={false}` or `pulse={true}` — it measures nothing. This is the spec's single most important manhaj assertion (nothing may animate where the mushaf is about to appear) and it is unmeasurable as written.

**Fix.** Run the state-block assertions in a second context created with `reducedMotion: 'no-preference'`, and assert two things there: (a) `readingPane` has zero descendants with a computed `animation-name !== 'none'`, and (b) at least one *other* variant does — otherwise a globally broken pulse silently satisfies (a). Keep `reducedMotion: 'reduce'` for the screenshot pass only.

### RTL — U+2067 RLI isolation; spec §1.1 / §1.2 rule 2 / §4 E3

**Where.** §1.1 `interpolate()` + §1.2 Rule 2 ("The whole Arabic string is RLI-wrapped by `interpolate`/`<bdi dir="auto">`") + §4 E3's note ("the whole string is RLI-isolated ... bidi places it correctly")

**Why.** `interpolate` as written never wraps the template. `if (!vars) return template` returns the raw string, and `template.replace(/\{(\w+)\}/g, …)` only isolates SUBSTITUTED VALUES. No RLI is ever applied to the Arabic sentence itself. Every justification in §1.2 rule 2 and §4 E3 — the reason `ffmpeg`, `SQLite`, `YouTube` are deliberately NOT hand-wrapped — rests on a mechanism the code does not implement. Strings with no placeholders (which is most of the dictionary: `errFfmpegMissingTitle`, `errRadioStreamTitle`, `firstRunTitle`, every `*Body` key) get no isolation at all, and `App.tsx:44` pins `root.dir = 'ltr'` in both languages, so those strings render inside an LTR paragraph exactly as the spec says must not happen.

**Fix.** Make the RLI wrap real, not implied. Either (a) have `getTranslation` wrap the whole resolved string in `rli()` when `language === 'ar'` before interpolation, and drop the per-value `rli()` branch (nesting RLI inside RLI is a no-op); or (b) delete the §1.2 rule-2 / §4 E3 claim and set an explicit `dir` on the container instead (see next finding), which is the more robust route. Do not ship the current text, which tells the implementer that isolation is handled when it is not.

### RTL — Arabic must render in an RTL paragraph

**Where.** §1.2 Rule 1: "Every text node in a state block renders inside `<bdi dir="auto">`. Non-negotiable." Applied to `errFfmpegMissingTitle` ar = `ffmpeg غير مثبَّت`

**Why.** `dir="auto"` uses the first strong character (UBA P2/P3, skipping isolate runs). `ffmpeg غير مثبَّت` begins with `f` — type L — so the paragraph resolves to LTR. The Arabic run shapes correctly but is positioned and aligned as an LTR paragraph: left-aligned, with the trailing neutral at the wrong end. This is the same class of bug as `formatDuration`'s `1س 0د` → `1د0 س`, arrived at through a different door. `dir="auto"` is a heuristic, and this spec hands it a string engineered to defeat it. §7.3 assertion 5 explicitly PASSES this case ("sits inside an element with dir=\"auto\""), so the harness certifies the broken render.

**Fix.** Do not use `dir="auto"` for dictionary strings whose direction is already known. Set `dir={language === 'ar' ? 'rtl' : 'ltr'}` on the block element (title, cause, body) from `useI18n().language`. Reserve `<bdi dir="auto">` for genuinely unknown-direction runtime values — backend `detail`, `{path}`, `{query}`, playlist and file names — which is what `bdi` is for. Rewrite §7.3 assertion 5 to assert the RESOLVED direction (`getComputedStyle(el).direction === 'rtl'` under `--langs ar`) rather than the presence of an attribute.

### Correctness — new Rust command blocks the UI thread; contradicts the spec's own `isPlayerBusy()` reasoning

**Where.** §1.5 `pub fn count_orphaned_entries(db: State<'_, DbState>) -> Result<usize, String>` — a synchronous `#[tauri::command]` that calls `get_all_videos` then `std::path::Path::new(&v.file_path).exists()` once per row

**Why.** Tauri v2 runs a non-`async` command on the main thread. `Path::exists()` is a blocking `stat`. On a disconnected network share or a spun-down external drive a single `stat` can block for seconds; across a library of thousands of rows the app hangs with no frame. That is precisely the condition E5/E1 exist to detect, so the health check freezes the app exactly when the user needs it most. The codebase already solved this: `src-tauri/src/commands/file_ops.rs:128-132` makes `check_file_exists` an `async fn` wrapping `spawn_blocking` for this exact reason. The new command copies the wrong pattern, and §4.3 wires it to run on mount and on every window focus.

**Fix.** Mirror `check_file_exists`: `pub async fn count_orphaned_entries(...)` with the path loop inside `tauri::async_runtime::spawn_blocking`. Collect the paths under the lock first, release the lock, then stat off-thread. Add a per-path timeout or cap the scan, and keep the `isPlayerBusy()` guard.

### Focus visibility — visible focus ring on every interactive element

**Where.** §4 ErrorState: "it is `detail`, rendered in a collapsed `<bdi dir="auto">` under a 'Details' disclosure"

**Why.** A `<summary>` element is keyboard-focusable and Space/Enter-activatable, but it matches NEITHER focus-ring selector list in `index.css`. The global rule at `index.css:682-689` lists only `button, input, select, textarea, a, [tabindex]`. The two-tone `--ring-focus` rule at `index.css:1379-1385` lists only `.rule-row, .segmented button, .icon-btn, .quiet-action, .field-quiet`, and `:2126-2128` adds the three `.btn-*` classes. A bare `<summary>` gets the UA default outline, which this app suppresses on its ancestors and which is a single hairline that disappears on several of the ten grounds. A keyboard user tabbing an ErrorState hits an invisible stop.

**Fix.** Either render the disclosure as a `<button aria-expanded>` controlling a region (which picks up `.quiet-action` and the two-tone ring for free, and gives you the expanded/collapsed announcement `<summary>` only partly provides), or add `summary` to the `--ring-focus` selector list at `index.css:1379`. Also add `summary` to the global `:focus-visible` list so nothing else regresses. Then add a §7.3 assertion: tab through every `[data-state-block]` and require a non-`none` computed `box-shadow` or `outline-width > 0` on each `:focus-visible` stop, in all ten themes.

### Screen reader — asynchronous state change must be announced (WCAG 4.1.3 Status Messages)

**Where.** §4.1 `RecoveryResult { ok, message, tone }` reaching the caller only via `onResult?: (result: RecoveryResult) => void`; and §4.3 `healthStore` conditions inserted by `checkFolders()` / `checkNetwork()` on window focus

**Why.** `grep -rn "aria-live" src/ --include=*.tsx` returns ZERO hits repo-wide. Nothing in this spec adds one except `LoadingState`'s label. So: a screen-reader user presses "Repair database", the button sets `aria-busy` and spins, the promise resolves, `RecoveryResult.message` is handed to `onResult` — and nothing is spoken. Worse, `healthStore` inserts an ErrorState strip on window focus with no `role="alert"` and no live region: a blind user alt-tabs back and a folder-missing error silently materialises above the content they are reading. The spec calls `message` "already localised, already isolated" but never says where it goes.

**Fix.** (1) Add a single persistent app-level `<div role="status" aria-live="polite" className="sr-only">` mounted in `App.tsx` (it must exist BEFORE the text changes — a live region injected at the same tick as its content is not reliably announced), and have `RecoveryButton` push `RecoveryResult.message` into it. (2) Give `<ErrorState>` `role="alert"` when it appears in response to a user action, and `role="status"` when inserted by a background detector, so a focus-return error interrupts and a passive one queues. (3) Add a §7.3 assertion that every `[data-state-block="error"]` carries `role="alert"` or `role="status"`.

### Contrast / visible status — §5 skeleton fill token map

**Where.** §5: `--skeleton-on-page: rgb(var(--bg-panel-rgb));` plus the claim "Every theme's ladder already separates these three (verified on Onyx: 14/21/30; on Pearl: 249/255/238)", and the migration `<LoadingState variant="statStrip" on="page" />`

**Why.** The cited verification covers panel/card/card-hover — i.e. `on="panel"` and `on="card"` — and silently skips `on="page"`, which is bg-panel over bg-main. I computed both ends of the range: Pearl bg-panel `249 251 251` on bg-main `243 246 247` = **1.05:1**. Onyx bg-panel `14 14 17` on bg-main `2 2 3` = **1.08:1**. An `on="page"` skeleton bar is invisible on the lightest and the darkest theme. This compounds with the second half of §5: the only motion is `motion-safe:animate-pulse`, so under `prefers-reduced-motion` the pulse is gone too. A reduced-motion user on Pearl or Onyx gets a blank region, no motion, no visible bar — and (because the existing skeletons are `aria-hidden="true"` and the spec does not say otherwise) no announcement either.

**Fix.** Do not derive skeleton fill from the elevation ladder alone — the ladder's job is depth, not legibility. Define the fill as a token blended toward the theme's text colour, e.g. `--skeleton-on-page: color-mix(in srgb, rgb(var(--bg-panel-rgb)) 88%, rgb(var(--text-main-rgb)))`, tuned to hold ≥ 1.5:1 against its host on all ten themes, and add a §7.3 assertion that measures it per theme. Separately, under `prefers-reduced-motion` substitute a static but clearly visible treatment (a hairline-bordered bar) rather than removing the only signal, and expose `aria-busy="true"` on the container so the state is announced regardless of whether the pulse renders.

### Manhaj 2 & 3 (Qur'anic text never faded/animated/clipped); reduced-motion coverage

**Where.** §5.3 Dock ↔ expanded transition: `const run = (mutate) => { ... document.startViewTransition(mutate); }` with the stated "hard boundary: no view-transition-name ... may be applied to src/pages/Quran.tsx, .quran-reading-surface, .quran-reading-viewport or .quran-reading-frame"

**Why.** The hard boundary does not do what the spec claims. `document.startViewTransition` captures the WHOLE document under the implicit `root` name; elements without an explicit `view-transition-name` are not excluded, they are captured INTO the root snapshot, which Chromium cross-fades (and can transform) for the transition's duration. There is no way to opt an element out of the root capture. Because `Ctrl+Shift+P` (expand ↔ dock) is registered at scope `dock` and is active "whenever lane !== null" (§4.5), the common case is a user reading the mushaf on /quran with recitation docked: pressing it cross-fades the entire reading surface, Qur'anic text included. That is a fade and a compositor transform applied to the ayah body. Two aggravations: (a) the global reduced-motion block at src/index.css:2331-2361 matches `*, *::before, *::after`, which does NOT match `::view-transition-*` pseudo-elements, so the CSS safety net that catches every other animation in this app does not catch this one — only the JS `prefersReducedMotion()` guard does; (b) during the transition the live DOM's rendering is suppressed while `useWordSync`'s rAF tick keeps advancing, so the cue freezes against a static snapshot and jumps on completion.

**Fix.** Gate the transition on route, not on names: `if (prefersReducedMotion() || !document.startViewTransition || location.pathname === '/quran' || nextPath === '/quran') return mutate();`. Add to §10's automated set: assert `document.startViewTransition` is never invoked while `document.querySelector('.quran-reading-surface')` is non-null. Delete the sentence claiming the name boundary is sufficient — it is the kind of claim that gets copied into a code comment and trusted.

### Manhaj 5 (Hafs/Warsh never mixed — not in a view, component, cache key or localStorage key); CLAUDE.md "their localStorage keys are all tagged by riwayah"

**Where.** §6.5.6: "Persisted recents. `localStorage['salafi-hub.palette-recent.v1']` stores surah entries as `{ kind:'surah', surahId, riwayah }` and **filters on read** to the active riwayah."

**Why.** One untagged key holding entries from both riwayat is exactly the prohibited shape. The codebase precedent is unambiguous and the spec contradicts it: src/store/quranStore.ts:125 and :127 derive the key itself from the riwayah — `riwayah === 'warsh' ? 'salafi-hub.quran-last-read.warsh.v1' : 'salafi-hub.quran-last-read.v1'`, and the same for `quran-bookmarks`. Filter-on-read is a runtime guard, not separation: a missing or inverted filter, a migration that drops the field, or an entry written before the field existed leaks a Warsh position into a Hafs session. The section is also internally inconsistent — §6.5.2 keys the surah index correctly as `surah-index:${riwayah}` two paragraphs earlier.

**Fix.** Key by riwayah, mirroring quranStore's helper exactly: `const PALETTE_RECENT_KEY = (r: Riwayah) => r === 'warsh' ? 'salafi-hub.palette-recent.warsh.v1' : 'salafi-hub.palette-recent.v1'`. Remove the `riwayah` field from the stored entry — the key carries it — and delete the filter-on-read step so there is one mechanism, not two.

### Perf budget — backdrop-filter only on transient/chrome, not large anchored content; ambient idle CPU < 3% at Tier 3

**Where.** §2.1 change 3: `.app-sidebar` gains `background: rgb(var(--bg-sidebar-rgb) / 0.72); backdrop-filter: blur(20px) saturate(1.2)` under `cool`, `/0.82` + `blur(14px)` under `warm`

**Why.** Per the §1.3 profile map this lands on 8 of 10 themes (cool = noor|blue|samaa|mushaf|red, warm = maktabah|mushaf-gold|emerald). It is a 240px x full-window-height, permanently mounted backdrop-filter. Its backdrop is everything painted below it — which, per the Part II contract, is `AmbientLayer` at `--z-ground: 0`. Any Tier 2 drift or Tier 3 canvas frame invalidates the sidebar's entire backdrop region, forcing a full-height blur(20px)+saturate recomposite every single frame. The spec's own §4.1 rationale for banning backdrop-filter on the dock ("forces a per-frame readback") applies here with a far larger region and no dismissal. The ambient budget and the sidebar glass were costed independently and never composed. §2.1's justification ("persistent chrome, static backdrop") is false the moment AmbientLayer ships at Tier 2 or 3.

**Fix.** Tier-gate the glass: `:root[data-ambient-tier='0'] .app-sidebar, :root[data-ambient-tier='1'] .app-sidebar { backdrop-filter: ... }` and an opaque `--bg-sidebar` fill at Tier 2/3. Measure on Windows/WebView2, not the harness: `msedgewebview2.exe` GPU-process CPU% and compositor frame time with the sidebar glass on vs off while the ambient layer animates. Add the tier gate to the §10 test 7 assertion.

### Shell contract §0.3 vs §7.4/§8.4 — dock height subtracted twice

**Where.** §7.4 `bottom: calc(var(--dock-h) + 12px)` and §8.4 `height: calc(100% - var(--dock-h))`, both inside `#overlay-root`

**Why.** §0.3 places `#overlay-root` as `absolute; inset: 0` *inside the row that holds `#app-shell`*. That row is row 2 of a three-row column whose row 3 is `PlayerDocked` — so the row's box already excludes the dock. Subtracting `--dock-h` again inside it offsets toasts by 64px (bar) or 44px (strip) of dead gap above the dock, and leaves the settings sheet 64px short of the bottom of its own container.

**Fix.** Inside `#overlay-root`, use `bottom: 12px` and `height: 100%`; `--dock-h` is only meaningful to a consumer that is a sibling of the dock, and after §0.2 there are none. Assert in the harness that the newest toast's bottom edge is 12px above `#app-shell`'s bottom edge in both dock states.

### Perf — zero contribution to input latency; no layout thrash

**Where.** §0.2: "`--dock-h` lives on `:root` and is written by `PlayerDocked` only"

**Why.** Writing an inherited custom property on `document.documentElement` invalidates the computed style of the whole document, and because the value is consumed inside `calc()` for layout-affecting properties (§8.4 `height`, §7.4 `bottom`) Chromium cannot take the independent-custom-property fast path — it is a full style recalc plus layout. It fires on every lane start, every lane stop, and every dock collapse. On `/quran` with Al-Baqarah mounted that restyles 6,000+ `.quran-word` spans plus the jadwal pseudo-elements in one synchronous pass, on the same main thread as the word-sync rAF.

**Fix.** Write `--dock-h` on the `#app-shell` row element (or on `.app-container`), scoped to the subtree that actually reads it. Better: after fix #2 nothing outside the dock needs the variable at all — the dock is in flow, so the shell's height already accounts for it. Measurement: Performance panel, count and duration of "Recalculate Style" + "Layout" on a dock collapse with surah 2 open; budget one frame.

### INV-6 (the only sanctioned chrome↔reading-surface coupling) — asserted but the stated failure cannot occur, while the real one is not covered

**Where.** §3.1 INV-6: "Any write to `--dock-h` is followed by `window.dispatchEvent(new Event('salafi:layout-reflow'))` … Without it, collapsing the dock mid-recitation leaves the cue up to ~500ms stale"

**Why.** Two errors. (a) False positive: `positionWordCue` (Quran.tsx:458-472) sets the cue transform from `wordRect.left - containerRect.left` and `wordRect.top - containerRect.top`. A dock height change translates the entire reading column vertically; both rects move by the same amount and the delta — hence the cue transform — is unchanged. The claimed staleness does not exist, so the spec mandates a new permanent listener inside the one hook it says nothing may disturb, to fix nothing. (b) False negative: what actually invalidates the cue is a **width** change, because Arabic text rewraps and every word rect moves. This spec introduces exactly that and does not cover it — §2.3's 240px↔64px rail (`Ctrl+B`, reachable from `/quran` for the first time, since §2.1 kills the `w-0` collapse) and §5.1's `forceCollapsed` both change width without touching `--dock-h`, so no reflow event fires and the cue is genuinely stale for up to 500ms (Quran.tsx:584, `frameCount % 30`). Window resize is uncovered today and stays uncovered.

**Fix.** Delete the `salafi:layout-reflow` event. Inside `useWordSync`, put a `ResizeObserver` on `.quran-reading-viewport` and re-anchor via `positionWordCue(cue, activeWordElementRef.current)` in a rAF only when `contentRect.width` changes. Rewrite §10 test 4 to toggle the **rail**, not the dock — as written it asserts an invariant that holds trivially.

### Perf — no per-frame layout; animating a layout property

**Where.** §2.3: "Width transition: `width var(--dur-normal) var(--ease-standard)`"

**Why.** `width` is not compositor-only. The sidebar is a flex sibling of `<main>`, so 200ms of animated width is ~12 full-document relayouts, each rewrapping the mushaf. Today `Sidebar.tsx:52` already has `transition-all duration-200`, but it only fires on entering `/player`, where `Quran` is unmounted — this spec makes the rail toggleable from `/quran` mid-recitation, which is a new regression path, not existing behaviour. Every one of those relayouts moves every word rect the rAF `tick` is reading. Separately, `transition-all` will now also interpolate the `backdrop-filter` added in §2.1, which is among the most expensive properties to animate.

**Fix.** Replace `transition-all` with `transition-property: width` explicitly. Then either snap the width discretely (no transition) while `/quran` is the active route, or drive the collapse as a `transform: translateX` on the sidebar's contents over a `grid-template-columns` step. Measure Layout duration during a `Ctrl+B` on `/quran` with surah 2 open against the 16.7ms frame.

### Virtualization actually applied where the audit measured 6431px of unvirtualized rows; bundle size regression

**Where.** §6.4 rule 4: "Expanding past 200 rows switches that group to `@tanstack/react-virtual` (the one dependency the library evaluation recommends adopting, already scoped for `Radio.tsx`); below 200 no virtualization"

**Why.** `@tanstack/react-virtual` is not in `package.json` today — this adds a dependency (~5KB gzip) whose stated trigger is unreachable. Every corpus in §6.1 is under 200: 114 surahs, 175 stations, ~163 videos, 10 playlists, 8 jump, ~10 actions, ~14 settings. The threshold can never fire, so the dependency ships as dead code. Meanwhile the thing the audit actually measured — `Radio.tsx:218` mapping 175 stations into a 6431px scrollHeight — is not touched by this spec at all, and the parenthetical "already scoped for Radio.tsx" points at work that appears nowhere in Part II.

**Fix.** Either drop the dependency from this part and state plainly that the Radio virtualization is out of scope, or lower the threshold to something reachable (e.g. 60) and land the `Radio.tsx` list in the same change so the dependency earns its bytes. Assert the built bundle delta in CI.

### Icon-only controls must have accessible names (WCAG 4.1.2 / brief: "does every icon-only control have an accessible name?")

**Where.** §4.2 TransportGroupProps, VolumeControlProps; §4.1 dock slot list ([transport][volume][expand][close]); §7.5 toast dismiss .icon-btn; §8.2 SheetProps

**Why.** PlayerDocked is 100% icon-only (play/pause, prev, back10, fwd10, next, mute, expand, collapse, close, speed, repeat, sleep timer) and not one of them is given a name. Of the four exported prop interfaces only SeekBarProps carries `ariaLabel`. §1.1 correctly adds aria-labels for the three window buttons and §2.4 adds them for rail items, which makes the omission in the dock look like an oversight rather than a decision. A screen-reader user gets ten buttons announced as "button". The play/pause control additionally needs its name to change with state ("Play" / "Pause"), not a static name plus aria-pressed, because it is a state-changing action not a toggle of a persistent property.

**Fix.** Add to TransportGroupProps and VolumeControlProps the same `ariaLabel`-shaped contract SeekBarProps already has — better, require a `labels: { play, pause, next, previous, back10, forward10, mute, unmute, expand, collapse, close, ... }` object resolved from TranslationKeys at the PlayerDocked/PlayerExpanded boundary so both consumers share one table. Mark every lucide glyph `aria-hidden="true"`. Add to §10 an automated gate: query every `button, [role="button"], input` inside PlayerDocked/PlayerExpanded/ToastStack/SheetSettings and assert a non-empty computed accessible name.

### §0.3 Overlay root — internal contradiction, and the stated Windows-closability guarantee does not hold as specified

**Where.** §0.2 skeleton places `<div id="overlay-root" />` as a sibling of the `#app-shell` row inside `.app-container`; §0.3 prose says it is "positioned absolute; inset: 0; inside the row that holds #app-shell"

**Why.** Three problems compound. (a) The two placements are different elements and only one can be built. (b) `.app-container` is `@apply flex w-full h-full` at src/index.css:712 with no `position: relative`, so an `absolute; inset:0` child resolves against the initial containing block — i.e. the whole viewport, TitleBar included. The scrim then covers the window controls and reinstates exactly the ReminderAlarm.tsx:215 trap §0.3 claims to fix. (c) If overlay-root were instead placed *inside* `#app-shell` as the prose reads, `useFocusTrap`'s `inertBackground` (§0.4 inerts `#app-shell`) would inert the overlay itself.

**Fix.** Introduce an explicit positioned row: `.app-container > <div class="relative min-h-0 flex-1"> <div id="app-shell">…</div> <div id="overlay-root" class="absolute inset-0" /> </div>`. State that this wrapper — not `.app-container`, not `#app-shell` — is the containing block, and that `position: relative` on it is load-bearing. Add a §10 gate asserting `document.getElementById('overlay-root').getBoundingClientRect().top === titleBarEl.getBoundingClientRect().bottom` while a modal is open.

### Tab order — §1.5 and §4.6 both assert an ordering that §0.2's DOM makes impossible

**Where.** §0.2 puts `<TitleBar />` as row 1; §1.5 "they are last in DOM order because the drag region precedes them"; §4.6 "in the tab order after `<main>` and before the TitleBar buttons"

**Why.** "Last in DOM order" is true only *within* the header. The header itself is the first child of `.app-container`, so once §1.1 defect #3 removes `tabIndex={-1}`, minimize / maximize / close become the first three tab stops of the entire application. Every keyboard user tabs past three window-management buttons before reaching navigation, on every fresh focus. §4.6's ordering claim cannot be satisfied without `tabindex > 0`, which is itself a defect.

**Fix.** Pick one and state it. Either (a) keep the three buttons out of the sequential tab order and give the window an explicit `Alt+Space`-equivalent "window menu" binding registered in `useGlobalKeymap` at scope `base` — note that with `decorations:false` the OS will not supply Alt+Space itself, so this must be implemented; or (b) accept them as the first stops and say so explicitly, deleting §4.6's "before the TitleBar buttons" clause. Option (a) matches Windows, where caption buttons are not in the client tab loop.

### §0.5 Global keymap — combo normalisation on `event.key` breaks under an Arabic keyboard layout and for shifted punctuation

**Where.** §0.5 KeyBinding.combo: "Normalised: 'Ctrl+K', 'Shift+/', 'Space', 'ArrowRight'"; §4.5 `Ctrl+Shift+.`; §6.8 `Ctrl+K` / `Ctrl+P`; §8.5 `Ctrl+,`

**Why.** This is an Arabic-first application. With a Windows Arabic (101) layout active, the physical K key reports `event.key === 'ن'`, so `Ctrl+K` never opens the palette for exactly the users the app is built for. Independently, the spec's own examples are self-refuting: `Shift+/` produces `event.key === '?'` and `Ctrl+Shift+.` produces `'>'` on a US layout, so neither binding as written can ever match. `Ctrl+,` is layout-dependent too.

**Fix.** Normalise letter and punctuation bindings off `event.code` (`KeyK`, `KeyP`, `KeyB`, `Period`, `Comma`, `Slash`, `Digit1`…`Digit8`) and reserve `event.key` for named keys (`Escape`, `Tab`, `Enter`, `ArrowUp`, `Home`, `PageDown`). Document the rule in the `combo` doc comment. Add a §10 gate that dispatches KeyboardEvents with `key` set to Arabic letters and `code` set to the Latin physical key, and asserts the palette still opens.

### Manhaj constraint 3 + 10 (Qur'anic text never restyled/animated; Basmala never animated)

**Where.** §6 Theme switch — `html[data-theme-switching] *:not(.quran-script):not(.quran-flow):not(.quran-reading-surface)\n  :not(.hero-basmala):not(.hero-mark):not(.quran-jadwal) { transition: ... color ... !important }`

**Why.** The rule reaches Qur'anic glyphs two independent ways.
(a) There is whitespace (a newline) between `:not(.quran-reading-surface)` and `:not(.hero-basmala)`. In CSS that is a DESCENDANT COMBINATOR, not a continuation of the compound. The selector parses as "any element that is not .hero-basmala/.hero-mark/.quran-jadwal, descended from any element that is not .quran-script/.quran-flow/.quran-reading-surface". `body` satisfies the ancestor half, so `.quran-script` itself matches. The exclusion list is entirely inert as written.
(b) Even collapsed onto one line, `:not()` on an element does not protect its descendants. Verified in source: `src/pages/Quran.tsx:604-628` renders every Qur'anic word as `<span class="quran-word">`, and `src/index.css:1057-1066` gives `.quran-word { color: inherit; transition: color 120ms ease }` / `.quran-word-active { color: rgb(var(--quran-green-rgb)) }`. `.quran-basmala-calligraphy` (`Quran.tsx:1241-1250`, `index.css:990-999`), `.quran-surah-title` (`index.css:952-959`), `.quran-ayah-inline` and `.quran-ayah-marker` are likewise descendants carrying their own `color`. All match `*`. The declaration is `!important`, so it also overrides `.quran-word`'s 120ms recitation transition and the `prefers-reduced-motion` block at `index.css:1112-1122` that deliberately zeroes it.
Net effect: on every theme change, each Qur'anic word and the surah-opening Basmala colour-animate over `--dur-normal`, and the word-sync cue's own timing is clobbered. The spec's stated intent ("Qur'anic text and the Basmala are excluded by name") is not what the CSS does.

**Fix.** Do not use a `*` rule at all. Either (i) allowlist: apply the transition to an explicit set of chrome classes (`.surface-1/2/3`, `.rule-row`, `.app-sidebar`, `.btn-*`, `.chip`, …), or (ii) if a wildcard is kept, exclude by ancestor and by self on one compound, with no whitespace: `html[data-theme-switching] *:not(:is(.quran-script,.quran-flow,.quran-reading-frame,.hero-basmala,.hero-mark) *):not(:is(.quran-script,.quran-flow,.quran-reading-surface,.quran-reading-frame,.quran-jadwal,.hero-basmala,.hero-mark))`. Add to §9 a harness assertion that during `data-theme-switching`, `getComputedStyle('.quran-word').transitionProperty` and `getComputedStyle('.quran-basmala-calligraphy').transitionProperty` contain neither `color` nor `all`, in all ten themes.

### Ambient contract HARD RULE ("never behind mushaf text") + manhaj constraint 2

**Where.** §5.3 — AmbientLayer mounted `position: fixed; inset: 0; z-index: 0`, `.app-shell`/`<main>` set to `background: transparent`, `.app-ground` deleted and `body` flattened; combined with §5.2 `routeCap: 1 on '/quran'`

**Why.** The Qur'an reading pane has no opaque backdrop of its own. Verified: `.quran-reading-frame` (`index.css:827-832`) declares `position/isolation/overflow/border-radius` and no background; `.quran-reading-viewport` (`:834-839`) declares no background; `.quran-reading-surface` (`:780-802`) declares `background: radial-gradient(118% 74% at 50% 0%, rgb(var(--mushaf-gold-rgb) / 0.035), transparent 64%)` — 3.5% alpha at the top and fully transparent past 64%. `.app-container` (`:712-714`) and `.app-shell` (`:716-718`) declare no background. The only opaque ground in the app today is `body`'s gradient (`:613-618`) and `.app-ground` (`:1936-1945`) — and this spec deletes both.
With Tier capped at 1 (not 0) on `/quran`, `.ambient-still` still paints: the girih field (mushaf), the feTurbulence paper grain (pearl), the keylight pool (onyx), and — for `mushaf-gold` and `maktabah` — the blurred photographic plate. All of it becomes directly visible behind the ayat, in all ten themes.
Compounding this, `.ambient-root { opacity: var(--ambient-a) }` with `--ambient-a: 0.7` (pure-black) and `0.5` (light) means `.ambient-flat`, described in the same section as "always painted, opaque, tier 0", is not opaque either.

**Fix.** Two changes. (1) Give the frame — not the surface, whose `border: none` / `overflow: visible` invariant must not be touched — an opaque ground: `.quran-reading-frame { background-color: rgb(var(--bg-main-rgb)); }`. This is safe for the recitation cue: `.quran-word-cue` (`index.css:1071-1092`) sits at `z-index: -1` inside the frame's `isolation: isolate` stacking context, and negative-z descendants paint after their stacking-context ancestor's background, so the cue is not swallowed. (2) Move `--ambient-a` off `.ambient-root` onto `.ambient-still`/`.ambient-drift` so `.ambient-flat` stays genuinely opaque. Alternatively set `routeCap` to 0 on `/quran`, which satisfies the contract's "Tier 0/1" by taking the safe end.

### Manhaj constraint 10 (Basmala complete, never degraded) + constraint 9 (token-derived colour)

**Where.** §1.1 "`--accent-teal-rgb`, `--accent-turquoise-rgb`, `--accent-emerald-rgb`, `--accent-blue-rgb` and `--accent-gold-rgb` become: `--accent-rgb` / `--accent-2-rgb`", and §10's index.css edit list, which repoints only `--hair-rgb`, `--ring-focus`, `--edge-*` and `--wash-*`

**Why.** §1.2 supplies deprecated aliases in `tailwind.config.js` but no alias for the CSS custom property itself. `src/index.css` contains **74** live `var(--accent-gold-rgb)` references, only a handful of which are `--edge-*`/`--wash-*`/`--ring-focus`. The one that matters most for manhaj is `src/index.css:1694-1699`:
  `.basmala-harakat, .mark-ijam { fill: rgb(var(--accent-gold-rgb)); }`
An undefined custom property makes `rgb()` invalid-at-computed-value-time, and `fill` then resolves to its inherited/initial value — **black**. The Basmala's harakat go black on a black ground while `.basmala-stroke` (`fill: rgb(var(--text-main-rgb))`, unaffected) stays white: the Basmala renders incomplete. This is the exact SVG-default-black failure mode CLAUDE.md already documents for the marks.
Also silently dropped by the same deletion, all outside the §10 edit list: `:688` focus outline, `:702`/`:707` selection, `:1016`, `:1039`/`:1045` underlines, `:1145`/`:1157` inset active markers, `:1196`/`:1206`/`:1220`, `:1265`/`:1280-1282`, `:1304` meter fill.

**Fix.** Keep `--accent-gold-rgb: var(--accent-rgb)` (plus `--accent-teal-rgb`, `--accent-emerald-rgb`, `--accent-turquoise-rgb`, `--accent-blue-rgb`) as deprecated CSS aliases in the derived `:root` in the *same* commit that adds the Tailwind aliases. Delete the aliases only in a later commit, after all 74 call sites are repointed. Add a harness assertion to §9 that `getComputedStyle('.basmala-harakat').fill` and `.mark-ijam` resolve to a non-`rgb(0, 0, 0)` value in all ten themes.

### Feasibility — ambient layer never renders (AppShell.tsx omitted from edit list)

**Where.** §5.3 "`.app-shell` and `<main>` become `position: relative; z-index: 1; background: transparent`" + §10 Edited list (AppShell.tsx absent)

**Why.** `src/components/layout/AppShell.tsx:9` sets the shell fill with a Tailwind utility at the call site: `className="app-shell flex h-full w-full bg-background text-text-primary"`. `bg-background` resolves to `rgb(var(--bg-main-rgb) / 1)` — fully opaque — and it lives in Tailwind's utilities layer, which is emitted after `@layer components`. A `.app-shell { background: transparent }` rule in index.css therefore loses the cascade and the ambient layer is invisible in every theme. This is the exact failure the codebase already documents at `src/index.css:2325`: "Only box-shadow, deliberately: the sidebar's fill is set by a utility at the call site and a `background` here would lose to it."

**Fix.** Add `src/components/layout/AppShell.tsx` to the Edited list and remove `bg-background` from the shell div (and `app-ground` from `<main>`). Add a harness assertion that `getComputedStyle(document.querySelector('.app-shell')).backgroundColor` is `rgba(0, 0, 0, 0)` in all ten themes, so a future utility cannot silently re-opaque it.

### Feasibility — fixed z-index:0 layer paints over the custom title bar

**Where.** §5.3 "Mounted once, as the first child of `.app-container` in `App.tsx` (before `<TitleBar/>`), `position: fixed; inset: 0; z-index: 0`"

**Why.** `src/components/layout/TitleBar.tsx:13-16` renders `<header data-tauri-drag-region className="flex h-9 w-full shrink-0 ... bg-sidebar">` — statically positioned, no z-index. A positioned element with `z-index: 0` paints above all non-positioned in-flow content, and `.ambient-flat` is specified as "always painted, opaque". The title bar, its drag region and the minimise/maximise/close buttons are covered by an opaque plane. `pointer-events: none` keeps the buttons clickable but invisible, which is worse than a hard break because it passes a smoke test. `.app-container` is `@apply flex w-full h-full` (index.css:712) with no stacking context of its own, so nothing rescues this.

**Fix.** Give TitleBar `relative z-10` (and confirm `RadioMiniPlayer`, `ReminderAlarm`, `UpdateManager` sit above z-index 0). Add to the theme-matrix harness: assert `document.elementFromPoint(x, 18)` inside the title bar returns the header or one of its buttons, not `.ambient-root`, in all ten themes.

### Feasibility — CSP blocks the Pearl/Samaa grain data: URI; spec asserts the opposite

**Where.** §4.2 "CSP `img-src 'self'` already covers bundled assets (`tauri.conf.json:28`); nothing in the security config changes." and §3.2 item 3 "a static inline `feTurbulence` grain as a `data:` URI" (also "the shared static grain" in Samaa, §4.4 "grain (inline `data:`)")

**Why.** The actual CSP at `src-tauri/tauri.conf.json` is `img-src 'self' asset: http://asset.localhost https://asset.localhost https://i.ytimg.com https://*.ytimg.com`. There is no `data:` source. A CSS `background-image: url("data:image/svg+xml,...")` is governed by `img-src`, so the grain is blocked at runtime in Pearl and Samaa. The spec's claim that nothing in the security config changes is false, and the failure is silent (blocked image, no layout change) so it will not be caught by the visual sweep.

**Fix.** Either ship the grain as a real file (`src/assets/marks/grain.svg`, referenced by `url()` — covered by `'self'`, and it also gets content-hashed and cached), or add `data:` to `img-src` and state that as an explicit security-config change requiring review. Prefer the file: it keeps the CSP unchanged. Measurement: run the harness with `page.on('console')` capturing CSP violation reports, assert zero on `/` and `/settings` in Pearl and Samaa.

### Perf budget — GPU memory for the ambient layer < 40MB

**Where.** §5.5 "Tier 3 is 2D canvas at 30 fps with ≤ 220 points and no WebGL context, so there is no backbuffer to account for and the < 40 MB GPU line is trivially met."

**Why.** The budget is argued only against Tier 3 and ignores Tier 2, which is where the memory actually goes. §5.3 declares `.ambient-drift i { position: absolute; inset: -20%; will-change: transform }` — three elements, each 140% x 140% of a fullscreen fixed root, each force-promoted to its own compositor layer. At 1920x1080 that is 2688x1512 px = 16.3 MB per layer as RGBA; the keyframe's `scale(1.10)` raises Chromium's chosen raster scale, so ~19.7 MB each, ~59 MB for the three. Even assuming Chromium clips raster to the viewport (`contain: strict` gives paint containment), it is ~10 MB x 3 = 30 MB before anything else. On a 2560x1440 or 4K panel it is 1.8x-4x that. Separately, an accelerated 2D canvas in Chromium *does* hold a GPU texture (fullscreen at DPR 1 is 8.3 MB, double-buffered ~16.6 MB; at DPR 2 it is ~66 MB) — "no backbuffer" is factually wrong. Add the `.ambient-still` plate texture and the backdrop-filter intermediate surfaces from §2.3 and 40 MB is exceeded on a default display, not an edge case.

**Fix.** (a) Drop `will-change: transform` and let Chromium promote on demand, or scope it via `.ambient-root[data-tier='2'] .ambient-drift i { will-change: transform }` so paused/hidden tiers hold no texture. (b) Cut to two drift elements and size them to the viewport, not `inset: -20%` + `scale(1.10)`; achieve the same coverage with `background-position` offsets inside a viewport-sized box. (c) Cap the starfield backing store: `canvas.width = Math.round(innerWidth * Math.min(devicePixelRatio, 1))` and CSS-scale up — a starfield does not need DPR 2. Measurement (runnable in the existing Playwright harness): CDP `LayerTree.enable`, collect `layerPainted`/`layerTreeDidChange`, sum `w * h * 4 * rasterScale²` over promoted layers; assert < 40 * 1024 * 1024 at every tier on 1280x800, 1920x1080 and 2560x1440. Cross-check once on Windows with a `memory-infra` trace dump reading `gpu/gl/textures` and `cc/tile_memory`.

### Ambient contract — must pause in Performance Mode; resolveTier has no term for it

**Where.** §5.2 `TierInputs` / `resolveTier` — fields are motionPref, reducedMotion, deviceCap, routeCap, videoPlaying, windowFocused, batteryLow

**Why.** The Part II contract lists Performance Mode as a Tier-0 trigger, and the setting already exists and is already wired: `src/types/index.ts:82` `performanceMode: boolean`, surfaced at `src/pages/Settings.tsx:613-614` and consumed at `src/store/playerStore.ts:84-85`. Its own description is "Pause background jobs while a video is playing to reduce CPU usage" — an animated ambient layer is precisely a background job. `resolveTier` is presented as "every hard rule from the contract is one term", and one rule has no term. Because the function is a pure `min`, the omission is invisible until someone reads the contract next to the code.

**Fix.** Add `performanceMode: boolean` to `TierInputs`, sourced from `useSettingsStore.getState().settings?.performanceMode ?? true`, and include it in the runtime clamp: `const runtime = (i.performanceMode || i.videoPlaying || !i.windowFocused || i.batteryLow) ? 1 : 3` — or 0 if the intent is a full stop. Add a unit test per contract clause so the test file has exactly one case per hard rule and a missing rule fails at review.

### Internal contradiction — §9.3's opaque-paint-path assertion cannot pass after §5.3's deletions

**Where.** §9.3 "assert ... every element on the paint path between `.ambient-root` and `.quran-script` computes `opacity: 1` with a non-transparent `background-color`" vs §5.3 "Two existing gradient stacks are deleted ... `body`'s three-layer background ... and `.app-ground`" and §10 "`.app-ground` ... deleted"

**Why.** After the deletions nothing on that path is opaque. `<main>` loses `.app-ground` (its only fill, `src/index.css:1936-1945`), `.app-shell` is specified transparent, `.quran-reading-frame` (`index.css:827-832`) declares only `position/isolation/overflow/border-radius` — no background — and `.quran-reading-surface` (`index.css:797-801`) is a single low-alpha radial gradient: `radial-gradient(118% 74% at 50% 0%, rgb(var(--mushaf-gold-rgb) / 0.035), transparent 64%)`. So the Tier-1 girih field, the AVIF plate and the grain will show through directly behind Qur'anic text, and the spec's own test asserts that must not happen. The obvious patch — an opaque background on `.quran-reading-surface` — is explicitly foreclosed by the comment at `index.css:812-816`: "a negative-z child inside this element's `isolation: isolate` sits behind the element's own background, and only survived because that background is a low-alpha gradient. Any future opaque background would have silently erased the frame."

**Fix.** Put the opaque fill on `.quran-reading-frame`, not the surface: the frame already carries `isolation: isolate` and `overflow: hidden`, and the jadwal pseudo-elements are its children at z-index 0, so `background-color: rgb(var(--bg-main-rgb))` on the frame paints below them and erases nothing. Keep `.quran-reading-surface` exactly as it is (`overflow: visible`, `border: none`, low-alpha gradient) so `positionWordCue` is untouched. Then §9.3 can assert the frame's computed `background-color` alpha is 1 in all ten themes.

### Manhaj constraint 2 (Qur'anic text never a watermark / behind anything) + AmbientLayer contract 'never behind mushaf text' + §9.3

**Where.** §5.3 'Two existing gradient stacks are deleted... body's three-layer background (index.css:614-617, which becomes a flat var(--bg-main)) and .app-ground (index.css:1936-1945)' + '.app-shell and <main> become position: relative; z-index: 1; background: transparent'

**Why.** The two elements the spec makes transparent are the only opaque planes between the ambient layer and the mushaf. `.quran-reading-surface` (index.css:780) sets `background: radial-gradient(118% 74% at 50% 0%, rgb(var(--mushaf-gold-rgb) / 0.035), transparent 64%)` — its background-color is rgba(0,0,0,0). `.quran-reading-frame` (:827) and `.quran-reading-viewport` (:834) set no background at all, and Quran.tsx:1218-1224 confirms the frame is a bare div, not wrapped in `.surface-*`/`.premium-*`. So at Tier 1 — the ceiling the spec imposes on /quran, not a floor — the maktabah bookshelf plate, the mushaf-gold stacked-volumes plate, the mushaf girih strapwork and the pearl feTurbulence grain all render behind ayah text. That is Qur'anic text over an image, and an unmeasured contrast loss on the one surface where legibility matters most. The mirror-image failure is equally live: §10's Edited list omits src/components/layout/AppShell.tsx, which is where `className="app-shell ... bg-background"` (AppShell.tsx:10) and `<main className="app-ground">` (:12) actually are — leave that file alone and `bg-background` stays opaque and the ambient layer is invisible app-wide.

**Fix.** Give `.quran-reading-frame` an explicit fully-opaque `background: var(--fill-2)` (or `rgb(var(--bg-main-rgb))`) so the reading pane is a sealed plane regardless of tier, theme or profile — correct because it does not depend on the ambient layer behaving. Add src/components/layout/AppShell.tsx to §10 Edited, stating `bg-background` is removed from `.app-shell` and `app-ground` from `<main>`. Rewrite the §9.3 assertion to test alpha, not merely 'non-transparent'.

### WCAG 2.4.7 Focus Visible; audit brief 'visible focus rings on every interactive element at every surface level'

**Where.** §1.2 'In src/index.css, --hair-rgb: var(--accent-gold-rgb) at :436 becomes a per-theme seed; --ring-focus at :586 and every --wash-*/--edge-* swap --accent-gold-rgb → --accent-rgb.'

**Why.** That enumeration is not exhaustive. index.css still contains ~45 live `var(--accent-gold-rgb)`/`var(--accent-teal-rgb)` references outside the listed tokens, and the Tailwind alias map in §1.2 cannot reach any of them because they are raw custom-property references in CSS, not utility class names. The focus-critical ones: `:688` `button/input/select/textarea/a/[tabindex]:focus-visible { outline: 2px solid rgb(var(--accent-gold-rgb)); }` — the default focus indicator for the entire app; `:1336` `.range-quiet:focus-visible`; `:2287` `.surface-input` focus ring; `:1145`/`:1157` `.rule-row-active` inset marker; `:1196`/`:1220`/`:1304-1332` meter fills and range thumbs; `:2037-2072` `.btn-primary`; `:702`/`:707` scrollbar thumb; `:675` `select option:checked`. If `--accent-gold-rgb` is deleted per §1.1, `rgb(var(--accent-gold-rgb))` is invalid at computed-value time; `outline` is a non-inherited shorthand, so every longhand takes its initial value and `outline-style` becomes `none`. Every button, input, select, textarea, link and `[tabindex]` loses its visible focus ring in all ten themes with no fallback. If the seed is instead silently kept, six themes render a focus ring in a hue no other element uses.

**Fix.** Add to §1.2 an explicit shim in the derived `:root` — `--accent-gold-rgb: var(--accent-rgb); --accent-teal-rgb: var(--accent-rgb);` — and list all ~45 index.css call sites for mechanical repointing in a follow-up commit. Add a §9.4 grep gate: zero occurrences of `accent-(gold|teal|turquoise|emerald|blue)-rgb` in src/index.css once the shim is removed. Add a harness assertion that every focusable element in a fixed selector set computes `outline-style !== 'none'` OR a non-`none` box-shadow under `:focus-visible`, in all ten themes.

### Correctness — §8.1 'every token ... resolves inside it exactly as it would on <html>. There is no second source of truth and no drift is possible'

**Where.** §8.1 and §2.2: '<div data-theme="samaa" data-surface="cool"> inside Settings resolve a complete token set'

**Why.** False for every derived token, and derived tokens are what the preview shows. `--fill-1/2/3`, `--edge-1/2/3`, `--edge-accent`, `--wash-hover(-rtl)`, `--wash-active(-rtl)`, `--wash-btn(-strong)`, `--hair`/`--hair-faint`/`--hair-strong`, `--elev-1/2/3`, `--elev-press`, `--ring-focus` and the new `--surf-1/2/3` are declared exactly once, in the derived `:root` at index.css:378+, which matches `<html>` only. Per CSS Variables, `var()` inside a custom property's value is substituted at computed-value time on the element where the property is declared, so `--fill-2` computes on `<html>` against the ACTIVE theme's `--bg-card-rgb` and that fully-substituted value inherits into the preview div unchanged; the preview's own seed override arrives too late. All ten previews therefore draw `.surface-2` cards, `.rule-row` washes, hairlines and elevation from whatever theme is currently applied — only values redeclared inside the `[data-surface]` blocks vary (and `warm`/`cool` inherit the base `--elev-*` ladder, so their elevation is wrong too). The picker becomes systematically misleading about the choice it exists to present, which is an accessibility problem: §7 has already deleted the swatches that were the only honest signal.

**Fix.** Change the derived block's selector from `:root` to `:root, [data-theme]` so every theme-carrying element re-declares and re-substitutes derived tokens against its own seeds. Add to §9.2: read computed `--fill-2`, `--edge-2`, `--elev-2`, `--wash-active` inside a mounted ThemePreview for theme X while the document is on theme Y, and assert they equal the values those tokens take when X is the document theme.

### WCAG 1.4.3 Contrast (Minimum) — 4.5:1 body; audit brief 'WCAG AA contrast in all ten themes'

**Where.** §1.2 blanket alias `'primary-blue': 'rgb(var(--accent-rgb) / <alpha-value>)'` combined with §1.2's claim of '~6 stray dead-accent sites (QueuePanel.tsx:86,92,145,151, PlayerHeader.tsx:41,45)'

**Why.** The actual count is ~30 `primary-blue` sites across nine files (PlayerControls, ProgressBar, RadioMiniPlayer, UpdateManager, ReminderAlarm, QueuePanel, PlayerHeader, PlayerPage, VideoPlayer), and two pair the alias with a literal white foreground: RadioMiniPlayer.tsx:151 and :192, `bg-primary-blue text-white`. `primary-blue` currently resolves to `--accent-teal-rgb`; after the alias it becomes `--accent-rgb`, which §1.4 deliberately pushes bright for legibility on dark grounds. White on Mushaf Gold's `240 210 150` is 1.24:1; white on Mushaf Night's `126 196 96`, Sakinah's `125 185 255`, Noor's `38 198 196`, Emerald's `72 208 122` and Samaa's `79 195 247` lands roughly 1.6:1–2.4:1. Six of ten themes ship an illegible play button. §9.4 does grep `text-white` and require zero, but §10 assigns that work to nobody — RadioMiniPlayer is deferred to 'being rewritten as PlayerDocked anyway', a different spec, so the alias lands before the fix does.

**Fix.** Correct the §1.2 site count to ~30 across nine files and list them. Sequence the migration so the `text-white`/`bg-black` removal lands before or with the alias commit. Add to §9.6 a foreground-on-accent check: for every element whose computed background resolves to `rgb(var(--accent-rgb))`, assert its computed color is ≥4.5:1 against it, in all ten themes.


---

## MAJOR

### Manhaj 10 ("complete, static, full size") + Manhaj 2 (never decoration)

**Where.** §3: "'mark' — Dashboard, top-aligned, in a band of its own. Smaller, still complete, still the only thing on its line." with §1.1 `--basmala-mark-w: clamp(13rem, 17vw, 19.5rem)` and §11.1 "Basmala band (`mark`) | 50px … 46px"

**Why.** 208–312px wide at the mark's fixed 6.823:1 ratio makes the whole verse 30.5–45.7px tall. At that scale the harakat — which this very spec colours separately as a deliberate feature — are 1–2px specks; the codebase already documents this exact failure mode for the ۞ ornaments at 0.42em (index.css:935: "rendered as illegible specks"). More importantly, in that band the Basmala is not the subject of the screen: it is a 50px letterhead sitting above a 240–296px video-resume hero that is 31% of the frame. That is the Basmala functioning as branding on a media dashboard, which is what Manhaj 10 exists to prevent, and "full size" is not satisfied by "complete but shrunk to a sixth".

**Fix.** Restrict `BasmalaPlate` to `size='plate'` and to HeroAmbient, where it genuinely is the subject and nothing competes with it. Delete the `mark` size, `--basmala-mark-w`, `.basmala-band` and `.hero-basmala-mark`, and let the Dashboard open on `HeroContinue`. If a Basmala on the Dashboard is wanted, it must be at signature scale with the hero below the fold, not a 50px band above it.

### Manhaj 3 (Qur'anic text is never restyled) + Manhaj 9, and inconsistent with the spec's own §2.2 rule 10

**Where.** §3: "`.basmala-harakat { fill: rgb(var(--hero-accent-rgb)) }` … the harakat move from `--accent-gold-rgb` to the hero seed", combined with §8.3: "A later phase differentiates by adding one line per theme: `html[data-theme='blue'] { --hero-accent-rgb: var(--accent-blue-rgb); }`"

**Why.** `--hero-accent-rgb` is defined in §1.1 as "One seed for every hero's interactive colour" — the buttons, the meter fill, the ground glow. Binding the Basmala's harakat to it means that the moment §8.3's planned per-theme line lands, the Qur'anic glyph's marks are recoloured to whatever the app's button colour is, in ten themes, as a side effect of a UI decision. The spec argues the opposite case for the ornament: §2.2 rule 10 keeps the jadwal on the theme-fixed `--mushaf-gold-rgb` (224 190 116 at index.css:82, Pearl's bronze 158 118 40 at :155) precisely "so the frame never turns cyan in Samaa". Qur'anic text cannot have weaker protection than the frame around it. The reference plates varying harakat colour is not a licence either — those are three authored plates, not a token wired to a button.

**Fix.** Leave `.basmala-harakat` on a Qur'an-scoped, theme-fixed seed: `.basmala-harakat { fill: rgb(var(--mushaf-gold-rgb)) }`, same reasoning and same comment as §2.2 rule 10. `.mark-ijam` (the نور mark — not Qur'anic) may take `--hero-accent-rgb`; split the currently-shared rule at index.css:1694-1697 so the two no longer move together.

### Load-bearing invariant: bidi isolates — U+2067 (RLI) for Arabic, U+2066 (LRI) reverses them

**Where.** §5.3 DOM: `<span dir="ltr" class="tabular-nums">{t('quranAyah')} {lastRead.verseId}</span>`

**Why.** `quranAyah` is `'الآية'` in Arabic (i18n.ts:590), not a digit run. Forcing `dir="ltr"` on a mixed Arabic-label + numeral string is the LTR-isolate mistake the invariant names — under an LTR base the Arabic word is placed to the LEFT of the numeral, so an Arabic reader reading right-to-left encounters "١٢ الآية". This is the same class of bug that shipped `1س 0د` as `1د0 س`. It is also a regression: the existing code renders exactly this pair correctly with `<bdi>{t('quranAyah')} {lastRead.verseId}</bdi>` at Quran.tsx:280-284, and the spec replaces working code with the broken form.

**Fix.** `<bdi className="tabular-nums">{t('quranAyah')} {lastRead.verseId}</bdi>`. Reserve `dir="ltr"` for runs that are digits and neutrals only — §9.5's time pair `{formatTime(a)} / {formatTime(b)}` is the correct use of it; a translated label never is.

### Load-bearing invariant: .quran-jadwal / .quran-reading-frame — the acceptance test contradicts code §2.1 says not to touch

**Where.** §11.3 assertion 7: "no descendant of `.quran-reading-frame` has a `transform` other than `none`"

**Why.** `.quran-jadwal` IS a descendant of `.quran-reading-frame` — Quran.tsx:1218-1222 puts it as the frame's first child, sibling of `.quran-reading-viewport` — and it carries `animation: jadwal-in 620ms var(--ease-out) both` (index.css:909) whose from-keyframe is `transform: scale(1.014)` (index.css:915-927). With `both` fill the from-state is applied before the animation starts, so the assertion fails against untouched, correct code. A CI gate that red-lights existing behaviour will be "fixed" by deleting `jadwal-in` — which §2.1 explicitly preserves — or by muting the assertion, which loses the protection it was written for.

**Fix.** Scope the assertion to what `positionWordCue` actually measures (Quran.tsx:458-473: the cue's `offsetParent`, i.e. `.quran-reading-surface`, and the chain up to and including `.quran-reading-viewport`): assert `transform === 'none'` on `.quran-reading-surface`, `.quran-reading-viewport` and their ancestors, and exclude `.quran-jadwal` by selector with a comment saying why (it is `pointer-events: none`, out of flow, and measured by nothing).

### Acceptance test cannot fail — §11.3 assertion 6 targets the wrong selector

**Where.** §11.3 assertion 6: "`getComputedStyle('.quran-reading-frame').animationName === 'none'` under `reducedMotion: 'reduce'`"

**Why.** The animation §2.1 adds reduced-motion coverage for lives on `.quran-jadwal` (index.css:909), not on `.quran-reading-frame`, which has no `animation` declaration at all (index.css:827-832). The assertion therefore passes identically whether or not the new `@media (prefers-reduced-motion: reduce) { .quran-jadwal { animation: none } }` block was ever added. The one genuinely new reduced-motion fix in the spec ships untested.

**Fix.** Assert on `.quran-jadwal`: `getComputedStyle(document.querySelector('.quran-jadwal')).animationName === 'none'` under `reducedMotion: 'reduce'`, and additionally assert it is `'jadwal-in'` without the emulation, so the test proves the media query is what is doing the work.

### Ambient contract HARD RULE ("never behind mushaf text … verified by test not by eye") — mechanism is unenforceable as specified

**Where.** §5.4: "`/quran` publishes `0` on the reading pane's own container and `1` on the route" with §11.3 assertion 7: "`/quran` route root and `.hero-mushaf` both carry `data-ambient-ceiling` ≤ 1"

**Why.** The Part II contract specifies ONE `<AmbientLayer />` at z-index 0 behind everything. A single global layer resolves its tier once; an attribute published on a nested container cannot change what that one layer paints behind that sub-region — the pixels behind the reading pane are the same pixels as behind the rest of the route, which publishes `1`. So a Tier-1 generated pattern would sit behind the mushaf text with nothing preventing it. And the assertion written to guard this only checks `≤ 1` on the route root and the hero; it never checks that the reading pane resolves to `0`, so the rule the contract says must be "verified by test not by eye" is verified by neither.

**Fix.** Make it true by construction rather than by attribute: give `.quran-reading-frame` an opaque ground (`background: var(--bg-card)`, no alpha) so nothing can show through behind Qur'anic text in any tier or theme, and assert it — `getComputedStyle('.quran-reading-frame').backgroundColor` has alpha 1 in all ten themes. Keep `data-ambient-ceiling="0"` on the reading pane as documentation, but do not let the hard rule depend on it.

### Manhaj 1 (animate beings) + the spec's own §2.2 rules 4 and 5

**Where.** §2.1 table: "`HeroContinue`'s art plate | **Corners only** — 4 khatam, no bands, no rules | `.jadwal-mount`", and §2.2 rule 4: "Never around a video thumbnail other than HeroContinue's single art plate"

**Why.** §2.2 rule 4 forbids the jadwal around video thumbnails and rule 5 forbids it around video surfaces, then rule 4 carves out the single case that matters most — the largest media still in the app. What goes inside that plate is an ffmpeg-extracted frame from the user's local lecture video (src-tauri/src/commands/ffmpeg.rs:41-108, `LocalThumbnail` → `convertFileSrc`), which in this library's actual content is routinely a photograph of a speaker. The spec takes the mushaf's khatam — the corner star of the printed Qur'an page — and sets it around that still, then makes the still the single largest visual on the Dashboard at 355–455px wide. The self-granted exception dissolves the scarcity argument §2 is built on, and it applies a mushaf ornament to a photographic surface whose subject is habitually animate.

**Fix.** Drop `.jadwal-mount` and the `--jadwal-corner` token. Give `.hero-lesson-art` the ordinary media edge every other thumbnail gets — `border: 1px solid transparent; background: var(--fill-well) padding-box, var(--edge-2) border-box` — and let §2.2 rules 4 and 5 stand without an exception. Separately, since the plate is now the Dashboard's largest element, state the fallback policy explicitly: when `thumbnailStatus !== 'ready'` the plate renders the seeded `PlaylistArt` geometry (as §4.4 already specifies for the empty phase), never `LocalThumbnail`'s medallion.

### Perf/feasibility — §5.5, and the harness rule 'visual changes are checked by rendering'

**Where.** .quran-reading-viewport { max-height: min(70vh, calc(100vh - 22rem)) }

**Why.** 22rem is a constant standing in for chrome that contains a vh-clamped variable, so it is only correct at the one viewport the spec did arithmetic for. --hero-mushaf-h is clamp(8.25rem, 17vh, 10.5rem) = 136px at 800 but 168px at 1080. At 1920x1080 the spec's own accounting gives chrome-above = 24+168+20+41+20 = 273; frame = 1044; bottom padding = 64 (page-container p-6 bottom 24 + content-max-width pb-10 40, index.css:1844/1886); available = 707. The formula yields min(70vh=756, 1080-352=728) = 728 — a 21px overflow at the spec's second reference viewport, which is the exact failure the change exists to prevent. At 1280x800 it is fine (448 vs ~459 available) but 11px over-conservative, which costs ink in a pane the Phase 0 audit already measured at 98.6% empty. At 900x600 `min-height: 19rem` (304px) wins over the computed max-height (248px) and the declaration is inert.

**Fix.** Derive it from the token instead of a magic constant: `max-height: min(70vh, calc(100vh - 36px - var(--hero-mushaf-h) - 13.5rem))`. Assert, per viewport and per theme, that `.quran-reading-frame`'s bottom <= `main`'s bottom and that `.quran-reading-viewport` scrollHeight > clientHeight for Al-Baqarah (i.e. it is still the scroller). Note the spec's reasoning about NOT moving the scroller and NOT adding a border is correct and I verified it against positionWordCue (Quran.tsx:458-473, which reads cue.offsetParent) — only the constant is wrong.

### Perf/feasibility — §2.1 factual claim, §11.3 assertion 6, and reduced-motion coverage

**Where.** "it is currently the only animation in the file with no reduced-motion coverage" + the proposed `@media (prefers-reduced-motion: reduce) { .quran-jadwal { animation: none } }`

**Why.** The claim is false. index.css:2351 is a global, deliberately-unlayered `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; ... } }` — jadwal-in is already covered, and the file has only two @keyframes total (jadwal-in:915, page-enter:1821), both covered. The proposed rule also contradicts that block's documented policy at index.css:2344-2350 ('Animations are collapsed rather than set to `none`'), and it is added solely so assertion 6 (`animationName === 'none'`) can pass — the test is being written to the fix rather than to the behaviour. Separately and more seriously: shoot.mjs:88 creates every context with `reducedMotion: 'reduce'`, so the entire mandated sweep runs with motion off. Nothing in the harness ever exercises the motion-on path — .segmented button::after's scaleX transition, `busy`'s motion-safe:animate-spin, or any Tier 2/3 ambient.

**Fix.** Drop the redundant rule, or justify the policy exception in a comment at the site. Change assertion 6 to test behaviour: under reduce, `getComputedStyle('.quran-jadwal').animationDuration` parses to <= 0.01ms. Add a second harness axis, `reducedMotion: 'no-preference'`, at least for the Dashboard and /quran, or the sweep cannot see the motion the ambient spec is about to add.

### Perf/feasibility — 'check virtualization actually applied where the audit measured 6431px of unvirtualized rows'

**Where.** §7.3 mounts HeroCompact on /radio; Radio.tsx:218 `stations.map((station) => ...)`

**Why.** No. Part II virtualizes nothing and makes /radio marginally worse: it adds a 180px (209.5px in Arabic) fixed band above a 6431px, 175-row unvirtualized list, pushing the first station further down and adding to first-paint cost on the heaviest route in the app. This is also a CI cost the spec does not budget: shoot.mjs takes `fullPage: true` screenshots (line 113) with a `waitForTimeout(700)` per route; the mandated 40 combinations x 8 routes = 320 route visits, of which 40 are full-page captures of a 6431px document. Expect 10-15 minutes per assert-heroes.mjs run.

**Fix.** Either state explicitly that virtualization is out of Part II's scope and carry the 6431px forward as a tracked debt with a named owner, or cap /radio's list. For the harness, gate `fullPage` behind a flag and skip it for assert-heroes.mjs — the assertions are all rect/computed-style reads and need no screenshots. Measure the actual wall-clock of one 40-combination run before making it a merge gate.

### "Flag anything the spec asserts but cannot measure" — §11.3 assertions 4 and 5, and §3's Basmala rules

**Where.** Assertion 4 ('.hero-basmala box intersects no element with non-none pointer-events'); assertion 5 ('.hero-basmala and its ancestors: computed overflow ∈ {visible}')

**Why.** Both fail by construction on every run. Assertion 4: every ancestor of .hero-basmala — .hero-ambient-inner, .content-max-width, .page-container — has default `pointer-events: auto` and a rect that necessarily contains the Basmala's, so the intersection test trips immediately unless ancestors are excluded, which the assertion does not say. Assertion 5: `.page-container` is `@apply ... overflow-y-auto overflow-x-hidden` (index.css:1844), so a Basmala ancestor's computed overflow is never `visible` — and worse, §6.3 of this very spec declares `.hero-ambient { overflow: hidden }`, which is a direct ancestor of the plate-size Basmala and is exactly what §3 forbids ('No ancestor of .hero-basmala may set overflow: hidden'). The spec contradicts itself and then writes a test that catches the contradiction.

**Fix.** Assertion 4: restrict to elements that are NOT ancestors of .hero-basmala, and use `document.elementsFromPoint` at the mark's corners and centre, asserting the topmost hit is the mark's own wrapper. Assertion 5: replace the ancestor-overflow walk with the property that actually matters — the mark's own rect must be fully contained by every scroll-clipping ancestor's client rect (i.e. nothing is visually cut), asserted per theme. And resolve §6.3 vs §3: drop `overflow: hidden` from .hero-ambient (nothing in it needs clipping now that .hero-scene/.hero-girih are deleted) or move the clip to .hero-ambient-ground.

### Perf/feasibility — §4.3's falsifiable claim

**Where.** "at --hero-continue-h: 240px the track is (240-40)x16/9 = 355.6px … Exactly 16:9, no letterbox, no magic number"

**Why.** MEASURED: the art plate is 355.55 x 198 = 1.7957, not 1.7778. `.hero-lesson` carries `border: 1px solid transparent` under the global `* { box-sizing: border-box }` (index.css:601), so the content box is (240 - 40 - 2) = 198px tall while the column formula only subtracts the padding. `object-fit: cover` therefore crops ~1% horizontally on every thumbnail. The error is small; the claim of exactness is what is wrong, and this is the only number in the spec presented as derived-not-authored.

**Fix.** `grid-template-columns: calc((var(--hero-continue-h) - 2 * var(--hero-plate-inset) - 2px) * 16 / 9) minmax(0, 1fr)`, or move the 1px border to an inset box-shadow ring so the box math stays clean. Assert: `art.width / art.height` within 0.005 of 16/9.

### Perf budget — 'no filter:blur() on a large animated element'; backdrop-filter only on transient/chrome surfaces

**Where.** §8.1: `html[data-surface='cool'] { /* glass opacity + backdrop prominence live here */ }` — an empty block; §8.2's 'higher glass opacity, backdrop-filter more prominent' for Samaa, Sakinah, Noor Teal

**Why.** The single highest-risk perf item in the surface-profile scheme is specified as a comment. Today the only backdrop-filter in the app is `.surface-3 { backdrop-filter: blur(22px) saturate(1.35) }` (index.css:1930), correctly scoped to overlays — menus and the floating player. 'More prominent' is undefined: if it means raising the radius, or extending backdrop-filter to .surface-2/.surface-1, that puts a blur behind large anchored content on 3 of 10 themes, and .surface-2 is exactly what §4.3 gives HeroContinue. In WebView2 a backdrop-filter forces a backdrop snapshot and re-blur whenever anything beneath it repaints; on /radio and /library that is every scroll frame. There is no number, no ceiling, and no test.

**Fix.** State the constraint instead of leaving a placeholder: `data-surface='cool'` may adjust `--fill-*` and `--edge-*` alpha only, and MUST NOT introduce a backdrop-filter selector. Add grep gate 12 to §11.3: zero occurrences of `backdrop-filter`/`backdrop-blur` outside `.surface-3` and elements with `position: fixed`. If a cool-theme backdrop is genuinely wanted, measure it first — Chrome tracing, paint time per scroll frame on /radio at 1920x1080, before and after — and publish the number.

### Manhaj/jadwal §2.2 rule 9 ('never given border-radius … rounding it turns it back into a card with a doubled border') vs §8.1's warm profile

**Where.** .jadwal-mount { inset: 6px } inside .hero-lesson-art { border-radius: var(--r-md); overflow: hidden }, with html[data-surface='warm'] { --r-md: 8px }

**Why.** The mount is inset 6px inside a parent that clips at an 8px radius on the five warm themes (maktabah, mushaf-gold, emerald, mushaf, red). The khatam corners — square by construction, 14px per --jadwal-corner — are therefore cut by the parent's rounded clip on half the themes. The rule forbids rounding the jadwal; the parent's radius rounds it anyway, and no assertion covers it (assertions 2 and 3 only count instances and check which routes they appear on).

**Fix.** Set `.jadwal-mount { inset: max(6px, var(--r-md)) }` or drop the radius from .hero-lesson-art and let the outer .hero-lesson radius do the clipping. Add an assertion: for each of the 4 corner mask positions, the mount's rect corner must lie outside the parent's rounded-corner arc — or, cheaply, screenshot-diff one corner crop between `noor` and `maktabah` and assert the corner ornament's opaque pixel count is equal.

### Perf/feasibility — §11.3 as a CI gate

**Where.** "Add scripts/harness/assert-heroes.mjs … npm run build && node scripts/harness/assert-heroes.mjs"; "Grep gate (CI, not Playwright)"

**Why.** Playwright is not a declared dependency. scripts/harness/README.md says so explicitly ('Playwright is not a dependency of the app. Install it when you need the…'), and it is absent from package.json devDependencies. `npm ci` in CI will not install it, and shoot.mjs hardcodes `executablePath: '/opt/pw-browsers/chromium'`, which is this container's path. The two grep gates (assertions 9 and 10) are the only parts of §11.3 that can run in CI today.

**Fix.** Add `playwright` to devDependencies with a pinned version, add a `test:heroes` npm script, and make the executablePath fall back to Playwright's own resolution when the /opt path is absent. Alternatively state plainly that assertions 1-8 and 11 are a local pre-merge check and only 9-10 gate CI — but then say which human runs them and when.

### "Flag anything the spec asserts but cannot measure" — every px in §7.2 and §11.1

**Where.** The whole measured height budget, expressed in px derived from --fs-2xl: 37px, --fs-xl: 27px, --fs-base: 15px and authored line-heights

**Why.** The Latin face those metrics were authored against is not bundled. index.css:613 declares `font-family: 'Inter', system-ui, ...` and the only @font-face families in the file are Amiri Quran, Aref Ruqaa, KFGQPC Hafs, KFGQPC Warsh and Plex Arabic. Latin falls through to Segoe UI in the shipped Windows app and to whatever `system-ui` resolves to on the CI/harness runner (Linux). Cap-height, x-height and the `normal` line box all differ, so the harness measures one set of numbers and the product renders another. My own measurements above are Linux system-ui numbers for exactly this reason. Every '43px title', '17px eyebrow', '24px subtitle' in the spec is unverifiable across the two environments as written.

**Fix.** Out of Part II's scope to fix the missing font, but in scope to stop depending on it: pin the harness's Latin stack to the same fallback Windows uses, or state the budget with an explicit tolerance (±8%) and assert with that tolerance. Flag to whoever owns Part I that docs/DESIGN_SYSTEM.md:46's 'Inter (already bundled)' is false and that either Inter ships or the type scale is retuned for Segoe UI.

### WCAG 3.1.2 Language of Parts (AA)

**Where.** §3 `BasmalaPlateProps.label` "Defaults to `BASMALA_TEXT + t('heroBasmalaMeaning')`"; §5.3 `<bdi>{language === 'ar' ? surah.name : surah.transliteration}</bdi>`; §5.3 `.hero-mushaf-badge` `{t('quranRiwayahHafs')}`; §6.3 `'سلفي هَب'`

**Why.** `App.tsx:42` sets `root.lang = language` and nothing else in the tree carries a `lang`. In an English UI (`lang="en"`) the Basmala's `aria-label` begins with the full Arabic `بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ` — a Latin TTS voice will either skip it or produce noise, so the one string the manhaj most requires be announced correctly is announced worst. The same applies to `surah.name`, `quranRiwayahHafs`/`Warsh` and the Arabic wordmark whenever they appear in an otherwise-English UI. The spec is adding `<bdi>` wrappers to exactly these nodes, so the `lang` attribute costs one extra prop.

**Fix.** Emit `lang="ar"` alongside every `<bdi>` that is known-Arabic by construction (the Basmala label carrier, `surah.name`, the riwayah badge, the Arabic wordmark) and on any `<bdi>` around user data detected as Arabic. Extend §9.3 from "every user-data string is in `<bdi>`" to "every known-Arabic string is in `<bdi lang="ar">`".

### WAI-ARIA APG — `role="group"` + `aria-pressed` is not a composite widget; keyboard contract must not diverge between two instances of the same control

**Where.** §10 "The `.segmented` group is a roving-tabindex composite: the pressed button has `tabIndex={0}`, the other `-1`; `ArrowLeft`/`ArrowRight`/`Home`/`End` move focus **and** activate"

**Why.** Three problems. (1) The existing riwayah control at `src/pages/Quran.tsx:1100-1107` is the *same* `.segmented` primitive with the *same* `role="group"` + `aria-pressed`, and both of its buttons are natively tabbable with no arrow handling. The spec puts a second copy of that control on the same route with an incompatible keyboard model — the user learns one contract in the hero and it fails in the toolbar 200px below. (2) `role="group"` carries no composite semantics: AT will not announce "1 of 2" or set up arrow-key expectations, so a roving tabindex there is an undiscoverable trap where Tab appears to skip a visible button. Roving tabindex is defined for `radiogroup`/`tablist`/`toolbar`, not `group`+`aria-pressed`. (3) Follow-focus activation makes ArrowRight *switch the entire riwayah* — re-keying `lastRead` off `lastReadKey(riwayah)` (`quranStore.ts:217`), changing the verse numbering, and dropping the timing read — as a side effect of moving focus, with no AT warning that the composite auto-activates.

**Fix.** Drop the roving tabindex and the arrow handling entirely; render the hero's riwayah control exactly as `Quran.tsx:1100-1107` already does — two tabbable `aria-pressed` buttons inside `role="group" aria-label={t('quranRiwayah')}`. §10's tab-stop table becomes "Resume -> Hafs -> Warsh" (three stops). If a single stop is genuinely wanted, convert *both* instances to `role="radiogroup"`/`role="radio"` + `aria-checked` in the same change, so one contract exists app-wide.

### WCAG 4.1.2 Name, Role, Value / 3.3.1 Error Identification; spec's own §10 guarantee "tab order does not change with phase"

**Where.** §5.6 "`lastRead` present but `lastReadSurah === null` … keep the primary **disabled**"

**Why.** The spec guarantees phase-invariant tab order for HeroContinue ("Same count, same order") and then breaks it for HeroMushaf. A native `disabled` button is removed from the tab order and from the accessibility tree's focus path, so a keyboard user tabbing during index load lands past the hero and, when the index resolves a moment later, focus context has silently shifted. Worse, `disabled` announces nothing: the user is told neither that the control exists nor why it is unavailable, while the adjacent explanation is a `.skeleton` bar with no text at all. The condition is transient and asynchronous, which is exactly the case where a silent, unfocusable control is most confusing.

**Fix.** Use `aria-disabled="true"` with a no-op `onSelect`, keeping the button focusable and in the tab order. Point `aria-describedby` at a visually-hidden node carrying a new i18n key (`heroMushafLoadingIndex`) and give the skeleton row `aria-hidden="true"` plus an `aria-live="polite"` region that announces the resolved surah name once. Add `HeroActionButton` support for `aria-disabled` distinct from `disabled` and state the tab-order-invariance guarantee for HeroMushaf in §10 as it is stated for HeroContinue.

### WCAG 1.3.1 / 4.1.2 — dangling `aria-labelledby`; spec's own §10 "Exactly one `<h1>` per route, and it is the hero's"

**Where.** §4.2 `<section class="hero-lesson" aria-labelledby="hero-lesson-title">` combined with §4.5 (loading phase renders `<HeroSkeleton shape="continue" />`, no `<h1 id="hero-lesson-title">`) and §10's "the section carries `aria-busy="true"`"; §6.4 (`HeroSkeleton shape="continue"` also stands in for HeroAmbient before settings resolve)

**Why.** During the loading phase the `id` referenced by `aria-labelledby` does not exist, so the section resolves to no accessible name — an unnamed region, and an automated 4.1.2 failure that axe/Lighthouse will flag. Independently, `<h1>` exists in no phase but `ready`/`empty`: a screen-reader user who lands on `/` while `get_continue_watching` is in flight finds a page with zero headings, which breaks heading navigation and violates the spec's own "exactly one `<h1>` per route". §0 deletes the masthead that previously supplied the `<h1>` unconditionally, so nothing else covers it.

**Fix.** Render the `<h1>` in every phase. In `loading` it carries a route-level i18n title (`t('heroContinueEyebrow')`-adjacent, e.g. a new `heroLessonSectionTitle`) inside a visually-hidden span; the `.skeleton` bars sit beside it with `aria-hidden`. Same for HeroAmbient's pre-settings skeleton. Add a §11.3 assertion: every route, every phase, `document.querySelectorAll('h1').length === 1`, and every `aria-labelledby` IDREF in `src/components/hero/**` resolves.

### Internal contradiction (§6.3 vs §10) + WCAG 3.2.5 Change on Request / 2.4.3 Focus Order

**Where.** §6.3 `<section class="hero-ambient">` with `<h1 class="hero-wordmark">` and no `id`; §10 "`HeroContinue`/`HeroMushaf`/`HeroAmbient` are `<section aria-labelledby>` pointing at their `h1`"; §10 "On mount, `if (document.activeElement === document.body) ref.current?.focus({ preventScroll: true })`"

**Why.** Two defects. (1) §10 states HeroAmbient is `<section aria-labelledby>`; §6.3's DOM has neither the attribute nor an `id` on the `<h1>`. As written the section is unnamed. (2) The autofocus fires on *mount*, and per §6.2 `firstRun` depends on `settings !== null && importedFolders.length === 0 && (stats?.totalVideos ?? 0) === 0` — both `settings` and `stats` arrive asynchronously, and §6.4 says a `HeroSkeleton` renders until then. So HeroAmbient mounts an indeterminate time after page load and moves focus at that moment. The `activeElement === document.body` guard covers a user who has already tabbed, but not a user who has done nothing and is reading with a screen reader in browse mode — focus jumps and the virtual cursor is yanked to a button, with no live-region announcement of why the screen changed. `preventScroll: true` additionally means the focus ring may be off-screen.

**Fix.** Add `id="hero-ambient-title"` to the `<h1>` and `aria-labelledby` to the section. Delete the autofocus: first run has exactly one action and a `<h1>` at the top of a `<main>` — Tab reaches it in one press. If a focus target is genuinely required, set it once on the *route* container with `tabIndex={-1}` and announce the transition via a polite live region, rather than focusing a button after an async state change.

### Spec's own §8.3 stated goal: "Every hero's interactive colour goes through `--hero-accent-rgb`, declared once"

**Where.** §1.1 `--hero-accent-rgb: var(--accent-gold-rgb)`; §1.3 "`rank: 'primary'` -> `.btn-primary`"; §8.3 "A later phase differentiates by adding one line per theme: `html[data-theme='blue'] { --hero-accent-rgb: var(--accent-blue-rgb) }` … No hero component changes."

**Why.** `.btn-primary` (`src/index.css:2027-2047`) reads `--accent-gold-rgb` directly in five places — the fill gradient, the border gradient and the ambient shadow — and `--ring-focus` (`src/index.css:586-588`) reads it too. `HeroActionButton` maps `rank: 'primary'` onto that class, so the hero's *only genuinely interactive* colour never passes through `--hero-accent-rgb`. The token as specified reaches only `.hero-lesson-meter > div`, `.hero-lesson-wash`, `.hero-ambient-ground` and `.basmala-harakat` — decoration. The one-line-per-theme migration in §8.3 would therefore produce a hero with a blue meter, a blue ground wash and a **gold** primary button plus a gold focus ring: two accents in one band, which is the exact failure mode the Phase-0 audit is trying to escape. The spec's structural claim is not delivered by the structure it specifies.

**Fix.** Either (a) parameterise `.btn-primary` and `--ring-focus` on a new `--btn-accent-rgb` that defaults to `--accent-gold-rgb`, and set `--btn-accent-rgb: var(--hero-accent-rgb)` on the hero containers; or (b) give `HeroActionButton` its own `.hero-btn-primary` class built from `--hero-accent-rgb` with the same material as `.btn-primary`, and add a §11.3 assertion that the computed `background-color` of `[data-testid^="hero-"][data-rank="primary"]` tracks `--hero-accent-rgb` across all ten themes. Note that whichever route is taken, the two-tone ring must be re-verified against the new fill in all ten themes — the brief's own example is a single-hue ring failing on a same-hue surface.

### prefers-reduced-motion — false premise and a test that cannot fail

**Where.** §2.1 "[`jadwal-in`] must be added to a `prefers-reduced-motion` block (it is currently the only animation in the file with no reduced-motion coverage)"; §11.3 assertion 6 `getComputedStyle('.quran-reading-frame').animationName === 'none'`

**Why.** Two errors. (1) The premise is false: `src/index.css:2351-2360` is a global, deliberately un-layered `@media (prefers-reduced-motion: reduce)` block applying `animation-duration: 0.01ms !important` to `*, *::before, *::after`, which already covers `jadwal-in`. The file's own comment at `:2347-2350` explains that animations are collapsed rather than nulled *on purpose*, so the spec's proposed `animation: none` contradicts a documented decision without arguing against it. (2) The assertion targets the wrong element. `jadwal-in` is declared on `.quran-jadwal` (`src/index.css:909`), not `.quran-reading-frame` (`:827-833`, which has no `animation` at all). The assertion passes vacuously today and would keep passing if the reduced-motion rule were deleted — a test with no failure mode, guarding the app's single most manhaj-sensitive animation.

**Fix.** Drop the §2.1 claim and the redundant rule, or argue explicitly why `jadwal-in` should be nulled rather than collapsed. Fix assertion 6 to `getComputedStyle(document.querySelector('.quran-jadwal')).animationName`, and additionally assert `animationDuration <= 0.01ms` so the global rule is what is actually being verified. Add the missing reduced-motion assertions the brief asks for: `.page-container` `animationName === 'none'`, and no hero element with a non-`none` `transition-property` covering `transform`/`opacity` under `reducedMotion: 'reduce'`.

### Spec's own §9.2: "Heroes express directional gradients as one declaration plus a `[dir='rtl']` override in CSS"

**Where.** §4.3 `.hero-lesson-wash { background: linear-gradient(200deg, …) }`; §5.4 `.hero-mushaf { background: radial-gradient(78% 120% at 18% -20%, …) }`; §6.3 `.hero-ambient-ground` `radial-gradient(… at 42% 30% …)`, `radial-gradient(… at 34% 20% …)`, `linear-gradient(168deg, …)`

**Why.** §9.2 sets a rule and every gradient the spec writes breaks it: five physical angles/origins, no `[dir='rtl']` counterpart anywhere. The rule also cites `.rule-row:hover` / `[dir='rtl'] .rule-row:hover` (`src/index.css:1796-1804`) as the pattern to follow, but `App.tsx:44` pins `root.dir = 'ltr'` unconditionally, so *that* precedent is itself dead code and copying it produces more dead code. The result is that §9.2 gives false assurance: a future maintainer lifting the `dir` pin will find the heroes' key light landing on the wrong side with nothing to flip.

**Fix.** Pick one and state it. Either (a) delete §9.2 and replace it with an explicit note that hero grounds use physical gradient geometry, that this is deliberate because `dir` is pinned, and that lifting the pin requires auditing five named declarations — list them; or (b) express the origins in logical terms via a `--hero-light-x` custom property flipped in a single `[dir='rtl']` block, and write all five gradients against it. (a) is cheaper and honest; (b) is what §9.2 currently promises. Do not leave the promise and the code in disagreement.

### Correctness — non-existent i18n key, missing key, and content dropped with no replacement slot

**Where.** §7.3 call-site table: `/settings` titleKey `settings`; `/radio`, `/downloads`, `/settings` eyebrowKey "existing pill key"; §0 deletion of `Radio.tsx:83-95` and `Downloads.tsx:136-146`

**Why.** (1) `settings` is not a `TranslationKey` — `src/i18n.ts` has `navSettings` (`:14`) and `settingsTitle` (`:117`), no `settings`. `TranslationKey = keyof typeof dictionaries.en`, so this is a `tsc --noEmit` failure at the call site, and §11's "`npx tsc --noEmit` … gate as usual" would catch it only after the work is done. (2) `/settings` has no pill: `Settings.tsx:412-415` is `<div class="mb-6">` + `<h1>` + `<p>` with no `premium-pill` at all, contradicting §0's description and leaving §7.3's "existing pill key" with nothing to resolve to — while `HeroCompactProps.eyebrowKey` is non-optional. (3) Both deleted blocks carry a fourth line HeroCompact has no slot for: `Radio.tsx:90-93` renders `t('radioOnlineNote')` with a Wifi icon — functional information that this route needs a network, which the brief's own error-condition list ('no network — radio down, library fine') depends on — and `Downloads.tsx:145-146` renders a supported-platforms caption with a documented `<bdi>` decision. `subtitleKey` is a single line, so both are silently lost.

**Fix.** Use `settingsTitle`. Make `eyebrowKey` optional (`eyebrowKey?`) so `/settings` can omit it, and specify what the band's `1fr` lead row does with the freed 17px. Either add a `note?: { textKey; icon? }` slot to `HeroCompactProps` for the Radio/Downloads caption line, and re-derive §7.2's vertical accounting with it, or state explicitly in §0 where each of the two captions is relocated to. Verify all 17 keys in §12's "Reused unchanged" list against `src/i18n.ts` before implementation begins — the other 16 do resolve; only `settings` does not.

### WCAG 1.4.3 (AA) — Pearl Scholar, the only light theme

**Where.** §5.4 `.hero-mushaf-badge { color: rgb(var(--mushaf-gold-rgb)); border: 1px solid rgb(var(--mushaf-gold-rgb) / 0.38) }` under §8.2's Pearl row ("badge takes Pearl's bronze `158 118 40`")

**Why.** Pearl's `--mushaf-gold-rgb` is `158 118 40` (`src/index.css:155`) and `.hero-mushaf`'s ground is `linear-gradient(177deg, rgb(var(--bg-card-rgb)), rgb(var(--bg-panel-rgb)))` = `255 255 255` -> `249 251 251`. Measured contrast: **4.16:1** — under the 4.5:1 body floor at `--fs-cap` (11.5px). Pearl's bronze was chosen (per the comment at `src/index.css:149-154`) to make the ayah *medallion* — an ornament — hold on paper; §8.2 reuses it for *text* without re-checking. The badge names which riwayah is on screen, which the spec itself (§5.3) calls "a correctness question, never a hidden setting". The 0.38-alpha border is ~1.9:1 against white and fails 1.4.11 as a boundary, so it cannot compensate.

**Fix.** Under `html[data-surface='light']`, either darken the badge text to a bronze that clears 4.5:1 on white (roughly `126 92 26` or darker) via a `--mushaf-gold-text-rgb` companion token, or set the badge's colour to `--text-main-rgb` and keep the bronze for the border/fill only. Do not reuse a medallion ornament colour as text colour without a per-profile contrast check — and add the contrast assertion from finding 2, which would have caught this.

### Harness coverage — §11.3 does not test what the brief requires

**Where.** §11.3 assertions 1-11 and the grep gates 9-10

**Why.** The spec's assertion list is strong on the jadwal law and the Basmala, and empty on the three things the brief names as the audit's subject. There is (a) no contrast assertion in any theme, though §8 rewires elevation, hairlines and radii per surface profile and §11 runs 10 themes x 2 languages x 2 viewports already; (b) no focus-visibility assertion, though the brief's opening example is a ring that failed on a same-hue surface and §8.1's `pure-black` profile sets `--elev-*: none`, leaving the ring as the sole edge on Onyx; (c) no Arabic-language height assertion, though §9.7 claims the budget "is verified at both languages" and the arithmetic in §11.1 is Latin-only; (d) no tab-order or heading-count assertion, though §10 makes explicit guarantees about both. Grep gate 10 is also incomplete: it forbids `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r` but not `ml-`, `mr-`, `left-`, `right-`, `rounded-l`, `rounded-r`, `space-x-`, `divide-x-`, `origin-left`, `origin-right` or `bg-gradient-to-r/-l`, all of which are physical and all of which Tailwind offers.

**Fix.** Add to §11.3: (12) computed-contrast sweep over every text node in `src/components/hero/**`, 4.5:1 / 3:1, all 10 themes; (13) for each hero's focusable elements, focus it and assert the computed `box-shadow` differs from the unfocused value and that the outer ring colour clears 3:1 against both the element's own fill and the surface behind it, all 10 themes; (14) at `data-language='ar'`, assert `scrollHeight <= clientHeight` for every hero and that every focusable descendant's rect is contained by the hero's rect; (15) per route, `h1` count === 1 in every phase; (16) tab-order snapshot per hero per phase, asserted equal across phases. Extend gate 10's pattern list as above.

### Load-bearing invariant — html[data-language='ar'] zeroes letter-spacing globally; tracking breaks the joins in a cursive script

**Where.** §2: `.section-eyebrow { text-transform: uppercase; letter-spacing: 0.16em; }` with the only guard being `html[data-language='ar'] .section-eyebrow { text-transform: none; font-weight: 500; }`

**Why.** The global guard at src/index.css:597-599 is `html[data-language='ar'] *:not(.hero-wordmark-latin) { letter-spacing: 0 !important; }` — keyed to the UI language, not to the script of the content. .section-eyebrow is the class behind every `SectionHeader size="sub"`, which per §8 is what ListGrouped renders for each group label, and per §2's 18 migrations covers PlaylistGrid.tsx:75, Library.tsx:563/587/626, ContinueWatching.tsx:93/131, RecentlyAdded.tsx:92 and all eight Settings sections. Arabic content under an English UI is not hypothetical: the spec's own `bucketOrder(present, language)` in §8 explicitly appends ARABIC_ORDER as the secondary ladder when language==='en', which only makes sense because Arabic-labelled groups exist in English UI. Verified in-tree, Quran.tsx:1503 renders `<bdi>{surah.name}</bdi>` in Arabic irrespective of UI language, and playlist/category names come from user folder names. Any of those reaching a `sub` header gets 0.16em applied to a connected script. The deleted useEyebrowClass hook had the same bug, but this generalises it from 5 call sites to ~20 plus every ListGrouped header.

**Fix.** Guard on the content's script, not the chrome's language. Add `.section-eyebrow:lang(ar), .section-eyebrow *:lang(ar), .section-eyebrow bdi:lang(ar) { letter-spacing: 0; text-transform: none; font-weight: 500; }` after the existing rule, and require SectionHeader to stamp `lang` on the title node (a `titleLang?: 'ar' | 'en'` prop, or infer with a `\p{Script=Arabic}` test). Keep the html[data-language='ar'] rule as the belt. Extend §12 assertion 10 to run the tuple check on Arabic-labelled headers under data-language='en' and assert letterSpacing computes to 0px there.

### Load-bearing invariant — a CSS mask applies to an element's whole subtree (the reason the jadwal hairlines live on .quran-reading-frame's pseudo-elements)

**Where.** §3 `.rail-scroller { overflow-y: hidden; padding-inline: var(--rail-pad); padding-block-end: var(--s2); mask-image: linear-gradient(to right, ...); }`, and §11's `overflow="scroll"` which 'reuses rails/Rail.tsx's scroller, mask fades and paging arithmetic verbatim'

**Why.** The spec reasons about mask clipping on the inline axis only — 'Because the start fade is 0px while atStart, a focus ring on the first card is never clipped by the mask' — and adds `padding-block-end: var(--s2)` for the surface-lift shadow. It adds nothing at the block-start. The mask's painting area defaults to the element's border box, so everything a descendant paints above the scroller's top edge is masked out, and `overflow-y: hidden` clips it a second time. --ring-focus is verified at src/index.css:586-588 as `0 0 0 2px rgb(var(--bg-main-rgb)), 0 0 0 4px rgb(var(--accent-gold-rgb) / 0.95)` — 4px outside the element's box. A rail card sits flush against the scroller's top edge (only --rail-pad: 5px of inline padding is applied), so the top 4px of the focus ring on every RailPoster, RailWide, RailStation and scroll-mode ChipRow item is cut. §3 justifies --rail-pad: 5px as 'clears --ring-focus (4px) at the rail's start edge' — the same reasoning was simply never applied to the block axis. On a 28px .chip this removes most of the visible ring.

**Fix.** Add `padding-block-start: var(--rail-pad)` to `.rail-scroller` alongside the inline padding, and set `padding-block-end: max(var(--s2), var(--rail-pad))` so the lift shadow and the ring both clear. Add a §12 assertion: focus the first and a middle card in each rail on each route, read the focused element's rect against the scroller's rect, and assert the 4px halo is inside the scroller's padding box on all four sides, in both dir values.

### Manhaj constraint 11 (do not touch word timings / audio matching) and §7.3's own stated purpose — the cue must be re-seated whenever the surface's box changes

**Where.** §7.3: `useEffect(() => { const cue = document.getElementById(`quran-cue-${surahId}`); const surface = cue?.offsetParent as HTMLElement | null; if (!cue || !surface) return; ... }, [surahId]);`

**Why.** The dependency array is `[surahId]` alone and the cue is resolved imperatively at setup. Verified in-tree: the cue span is rendered by SurahReader at Quran.tsx:1226 (`id={`quran-cue-${surah.id}`}`), and SurahReader only mounts once `currentSurah` resolves from the async `get_quran_surah` invoke (quranStore.ts:296-305). On the ordinary path the store's surah id is set before the fetch resolves, so this effect fires while the cue is absent, takes the `if (!cue || !surface) return` branch, and — because surahId has not changed — never re-runs. The single guard the spec adds against cue drift across a split-pane drag or window resize is therefore silently absent in the common case. The pre-existing effect in useWordSync does the same lookup but with deps `[repeat, syncActive, synced, surahId]`, so it re-runs when `synced` lands; the new effect is strictly weaker. The captured `surface` reference is also never refreshed, so any remount of the reading tree leaves the observer on a detached node. §12 assertion 6 would not catch this — it drives the handle only after audio is already synced.

**Fix.** Key the effect on the cue element rather than on surahId: add `synced` and `currentSurah` to the deps, or hold the surface in a callback ref set by SurahReader when it renders `.quran-reading-surface` and drive the ResizeObserver off that ref's identity. Extend §12 assertion 6 to cover the cold path: load /quran, select a surah, drag the handle BEFORE starting audio, start audio, and assert the cue lands on .quran-word-active on the first spoken word.

### Manhaj constraint 9 — every colour token-derived; ten themes recolour with ZERO per-theme component code (and the Phase 0 CRITICAL finding that naming accent-gold is why ten themes look like one)

**Where.** §11 `.chip[aria-pressed='true'] { background: linear-gradient(177deg, rgb(var(--accent-gold-rgb) / 0.13), rgb(var(--accent-gold-rgb) / 0.05)) ... }`; §1.2 MediaFrame progress fill `bg-accent-gold`; §10 StatStrip meter fill `bg-accent-gold`; §8 alpha index current bucket `text-accent-gold`

**Why.** These are token references so they do not break rule 9's letter, but they name a SEED rather than a semantic role, and Part II is the layer 40+ call sites are funnelled through. The codebase already draws the distinction: --edge-1/--edge-2/--edge-3 (index.css:455-475) route through `--hair-rgb`, a single indirection point declared once at index.css:436 as `--hair-rgb: var(--accent-gold-rgb)`. Phase 0 measured the consequence of naming the seed: accent-gold 130 uses vs teal/emerald/turquoise 0 and blue 1, with 'blue' and 'red' resolving to the byte-identical '226 197 122'. Adding four more direct seed references in the shared block layer means a future theme wanting a non-gold accent must edit block CSS — exactly the per-theme component code rule 9 forbids. §12 has no assertion covering this at all; assertion 11 is a lint on text-white/bg-black and rgba( counts, not a render check.

**Fix.** Introduce one semantic alias in :root — `--accent-rgb: var(--accent-gold-rgb);` — overridable per theme, and point all four new sites at it (`rgb(var(--accent-rgb) / 0.13)`, plus a Tailwind colour `accent: 'rgb(var(--accent-rgb) / <alpha-value>)'` for the three utility uses). Where the value is a hairline or edge rather than a fill, use the existing `--hair-rgb` / `--edge-*`. Add a §12 assertion: a pressed chip, a MediaFrame progress fill, a StatStrip meter and an active alpha bucket resolve different computed colours in at least two of the ten themes.

### Manhaj constraint — KFGQPC and font licence notices stay intact and reachable in the app

**Where.** §7.1: `.page-container-fixed { display: flex; flex-direction: column; overflow: hidden; }` applied to /quran, with 'the masthead (:86-95), the tab rule (:97-100), the error strip (:102-107) and the attribution line (:110-112) all take shrink-0'

**Why.** Verified at src/pages/Quran.tsx:110-112, that last element renders `t(riwayah === 'warsh' ? 'quranAttributionWarsh' : 'quranAttribution')`, which i18n.ts:76-77 shows to be the KFGQPC and Tanzil source attribution — the reachable licence notice the manhaj requires. Under `.page-container-fixed` the container is `overflow: hidden` (not auto), so nothing on /quran can scroll. Four shrink-0 siblings plus a `flex-1 min-h-0` pane means that once the window is shorter than the sum of the shrink-0 children, the overflow is clipped with no scrollbar and no recovery. The attribution is last in DOM order, so it is the first casualty. It compounds with the conditional error strip at :102-107: the notice disappears precisely when a surah load has failed. There is no outer scroller to fall back on — body carries `overflow: hidden` at index.css:620.

**Fix.** Give .page-container-fixed a floor that guarantees the chrome fits: keep `overflow: hidden` but add `min-block-size: 12rem` to the flex-1 pane and fall back to `overflow-y: auto` on the container below a height media query; or move the attribution into the fill pane's own scroll context so it scrolls with the reader. Add a §12 assertion: at 1280x600 and 1024x560, /quran's attribution paragraph has a non-zero intersection with the viewport, in both languages.

### Manhaj constraint 8 — no equaliser bars (a form prohibition, listed separately from 'no audio-reactive visuals')

**Where.** §5: 'the existing station mark (its own initial in a hairline ring, or `SignalBars` while live)… The mark logic and the `SignalBars` component move from `Radio.tsx:19-45` into `rails/RailStation.tsx` unchanged', and 'SignalBars is a broadcast level meter driven by connection state, never by audio. It has three bars at fixed heights with staggered animation-delay'

**Why.** Verified at src/pages/Radio.tsx:35-45: three spans at heights 0.55/1/0.75 of the container, each `animate-pulse` with `animationDelay: index * 180ms`. That is the equaliser idiom — a triplet of unequal bars animating out of phase, displayed precisely while audio is playing. Constraint 8's clause 'no equaliser bars' is not qualified by what drives them, and a user cannot distinguish a connection-state meter from a VU meter when the two appear under identical conditions. The spec's defence addresses only the AnalyserNode question. Carrying it forward verbatim into a new shared block re-affirms it across every station card rather than the current single site.

**Fix.** Replace SignalBars with a non-equaliser live indicator carrying the same information: a single filled dot or hairline ring pulsing opacity on the station mark, or a static RadioTower/Wifi glyph (both already imported at Radio.tsx:2) shown only while connected. One element, one opacity animation, no bar triplet, no staggered delay. If a multi-element form is wanted, use a concentric-arc geometric mark rather than vertical bars. Keep the existing prefers-reduced-motion collapse. Add a §12 assertion: no element inside a station card has siblings differing only in height with staggered animation-delay.

### Manhaj constraint 8 — No music, instrumental stings, or melodic feedback

**Where.** §5: 'src/utils/reminderAudio.ts:86 constructs an AudioContext; a comment must be added at that site stating it must never be given an AnalyserNode for visual purposes.'

**Why.** The spec directs an edit to this exact file and attaches an audio-manhaj guarantee to it, but the guarantee covers only the visual question and passes over what the file plays. Verified at src/utils/reminderAudio.ts, playDefaultTone: a sine oscillator at 880 Hz starting at t=0 and stopping at t+0.45, then a triangle oscillator at 1320 Hz starting at t+0.16 and stopping at t+0.9, both through a shared decay envelope. 880 Hz and 1320 Hz are A5 and E6 — a perfect fifth, played as a two-note sequence. That is a pitched melodic interval, i.e. an instrumental sting / melodic feedback, which constraint 8 prohibits unconditionally. Pre-existing debt rather than something Part II introduces, but a specification that opens this file to add a manhaj comment about audio must not tacitly bless the larger audio violation in it.

**Fix.** Record it rather than pass over it. Add to §13's migration map as a tracked follow-up: replace playDefaultTone with a single unpitched alert (a short filtered-noise burst, or a single non-harmonic click envelope) carrying no interval and no second pitch, keeping the AnalyserNode prohibition comment. Until that lands, §5's sentence should read that the AudioContext must never be given an AnalyserNode AND that its current two-oscillator interval is a known constraint-8 violation pending replacement.

### §7.2 `.quran-reading-frame--fill { block-size: 100% }`

**Where.** `.quran-reading-frame--fill { display: flex; flex-direction: column; block-size: 100%; min-block-size: 0 }`

**Why.** The frame is not the pane's only child. `SurahReader` renders a toolbar block (riwayah segmented control, font-size popover, `Quran.tsx:1090-1185`), a conditional status line (`:1170-1184`) and a conditional `syncedAudioError` strip (`:1187-1192`) above `<div className="quran-reading-frame …">` at `:1217`. `block-size: 100%` resolves against the pane, so the frame overflows the bottom of the pane by the full height of everything above it — and the overflow *changes* the moment `syncedAudioError` appears or the status line toggles. §12 assertion 4 ('the surah index's scroller clientHeight is within 8px of window.innerHeight minus the masthead, tabs and attribution') only checks the start pane, so this passes verification while being visibly wrong.

**Fix.** `.quran-reading-frame--fill { flex: 1 1 auto; min-block-size: 0 }` and drop `block-size: 100%`; the pane is already `display:flex; flex-direction:column; overflow:hidden` per §7. Extend assertion 4 to the end pane: assert `.quran-reading-frame`'s `getBoundingClientRect().bottom` is within 4px of the pane's, with and without the error strip forced on.

### Load-bearing invariant — 'the cue can never point at a word that is not being recited' (index.css:686-691); §7.3

**Where.** §7.3's ResizeObserver: `const observer = new ResizeObserver(() => { const word = activeWordElementRef.current; if (word) positionWordCue(cue, word); })`

**Why.** `.quran-word-cue` carries `transition: transform 160ms cubic-bezier(...), width 160ms …` and `will-change: transform, width` (index.css:1087-1092). Firing `positionWordCue` from an RO during a live split-pane drag makes the cue chase the drag 160ms behind — for the whole gesture the pill sits over stale geometry, which after a reflow is a *different word*. The RO also fires on every intermediate width, so each write restarts the transition and the cue never catches up until the drag stops. The spec calls this effect 'additive' and 'idempotent' and does not consider the transition it is fighting.

**Fix.** Bracket the re-seat: set `data-reseating` on `.quran-reading-surface` before the write and clear it on the frame after the RO goes quiet, with `.quran-reading-surface[data-reseating] .quran-word-cue { transition: none }`. Combine with the ghost-rule drag from finding 1 and the RO fires once, at commit. Measurement: during a scripted drag, sample the cue's and the active word's rects every frame and assert intersection ≥80% on *every* frame, not only after settling.

### Perf budget — 'any per-frame work that touches React state'; §8 pinned-header push

**Where.** §8 `<div className="list-grouped-pinned" style={{ transform: `translateY(${pushY}px)` }}>` with `pushY` computed from `offset`, i.e. `VirtualRows.scrollOffset`

**Why.** `scrollOffset` is React state inside `useVirtualizer` — the virtualizer rerenders on every scroll notification. Deriving the pinned header's `transform` from it makes the header a render-path output: every scroll event re-renders `ListGrouped` and all ~15 mounted rows, and the header lags the scroll by one commit. On Radio that is a visible judder on precisely the surface this block exists to fix. This is the exact pattern the brief asks to flag.

**Fix.** Hold a ref to the pinned element and write `el.style.transform` from a passive, rAF-coalesced `scroll` listener on the scroller; keep `scrollOffset` out of JSX. Same for the alpha index's 'current bucket' highlight (`text-accent-gold`), which has the same shape — toggle a class imperatively rather than re-rendering the rail. Measurement: Performance panel, count React commits during a 1s inertial scroll of `/radio` — target ≤ the number of range changes (roughly 1 per ~10 rows), not 1 per scroll event.

### Perf budget — 'any per-frame work that touches React state'; §3 'The two paging buttons are always mounted and toggle disabled from atStart/atEnd'

**Where.** §1.5 `useRailScroll` computes `atStart`/`atEnd` on every scroll; §3 wires them to the paging buttons' `disabled`

**Why.** The spec is explicit and careful that `--fade-left`/`--fade-right` are written imperatively via `setProperty`, then silently routes `atStart`/`atEnd` into React-controlled `disabled` attributes. If those are state, every rail re-renders up to 24 card subtrees per scroll notification — 24 `MediaFrame`s, 24 `MetaLine`s, 24 `OverflowMenu` triggers. A rail flick would then be the most expensive interaction on the Dashboard.

**Fix.** State-set only on transition (`if (next !== prevRef.current) setAtStart(next)`), or set `button.disabled` imperatively alongside the fade vars and keep the whole scroll handler out of React entirely. Separately, guard the var write itself — `--fade-left` feeds a `linear-gradient()` inside `mask-image`, so writing it re-generates the mask; cache the last written string and skip identical writes. Measurement: 0 React commits during a mid-scroll flick, ≤2 per direction change.

### Perf budget — assertions that cannot be measured; §3 'The mask promotes the scroller to its own layer. That is why maxItems is 24'

**Where.** `.rail-scroller` with `-webkit-mask-image: linear-gradient(...)` + `scroll-snap-type: inline proximity` + `scroll-behavior: smooth`

**Why.** A layer-promotion claim is doing load-bearing work here (it is the stated justification for the `maxItems: 24` cap) and is asserted, not measured. In Chromium a mask on a scroll container is applied to the scrolling contents per frame, and the mask's own definition is parameterised by two custom properties the scroll handler mutates — so it is not a compositor-only property the way `opacity`/`transform` are. Stacked with proximity snapping and `scroll-behavior: smooth`, this is a plausible path off composited scrolling for every rail on the Dashboard, Library and Watch simultaneously.

**Fix.** Measure before shipping the cap: DevTools → Rendering → 'Scrolling performance issues' and the Layers panel on `/`, `/library`, `/watch` with the 24-card fixture, plus a `chrome://tracing` capture of a 1s flick. Pass criteria: the scroll is handled on the Compositor thread, no 'non-fast scrollable region' annotation on `.rail-scroller`, p95 main-thread frame time < 4ms. If it deopts, move the mask to a non-scrolling wrapper (`.rail-frame`) that clips the scroller, which keeps the fade and leaves the scroller unmasked.

### §0.2 'One dependency … 56,556 bytes unpacked, headless, zero styling, zero colour, zero motion. Nothing else is added. Pin the exact resolved version in package-lock.json'

**Where.** `@tanstack/react-virtual@3.14.8`

**Why.** It is not one dependency. `npm view @tanstack/react-virtual@3.14.8 dependencies` returns `{ '@tanstack/virtual-core': '3.17.6' }`, and `@tanstack/virtual-core@3.17.6` is **400,307 bytes unpacked**. Real installed footprint is ~457kB across two packages — about 8× the stated figure. The spec pins react-virtual and never names, pins, or budgets virtual-core, so nothing in the written spec covers the package that contains the actual engine. (Shipped bundle impact is small — roughly 12–15kB minified on top of the current `dist/assets/index-p0H6g_dU.js` at 532,988 B — so this is an accuracy and supply-chain-pinning defect, not a bundle-size defect.)

**Fix.** State both packages and both sizes; pin `@tanstack/virtual-core` explicitly in `package-lock.json` and record the resolved integrity hash. Add a build-size check to §12: capture `dist/assets/index-*.js` before and after and assert the delta is under 20kB, so the claim is measured rather than asserted.

### §12 assertion 10 — 'the set of distinct computed (fontSize, fontWeight, textTransform, letterSpacing, color) tuples across all h2/h3 section headings on all eight routes has cardinality ≤ 2'

**Where.** §12.10, against §2's own `html[data-language='ar'] .section-eyebrow { text-transform: none; font-weight: 500 }`

**Why.** The assertion contradicts the spec that precedes it. §2 deliberately gives Arabic a different `text-transform` and `font-weight`, and the CLAUDE.md invariant `html[data-language='ar']` zeroes `letter-spacing` globally — so the tuple set across the full 5-theme × 2-language sweep is 4, not 2, by design. Run as written the assertion fails on every `ar` cell, and whoever fixes it will be tempted to remove the Arabic override, which reintroduces the exact per-language divergence §2 exists to kill.

**Fix.** Restate as '≤2 distinct tuples per (theme, language) cell', and add a second assertion that the `en` and `ar` tuple sets differ in exactly `textTransform` and `fontWeight` and nothing else — that is the property actually worth locking.

### §7.3 verification — assertion 4 ("Arabic carries no tracking"), against `html[data-language='ar']` zeroing letter-spacing globally

**Where.** §7.3 assertion 4: "Under `--langs ar`, `getComputedStyle(el).letterSpacing === 'normal' || '0px'` for every text node inside `[data-state-block]`."

**Why.** `html[data-language='ar'] *:not(.hero-wordmark-latin) { letter-spacing: 0 !important; }` (`index.css:589-591`) already forces `0px` on every element in Arabic, with `!important`, which beats any Tailwind `tracking-*` utility. The assertion is therefore true by construction and can never fail — it cannot detect the thing it is specified to detect. The spec's §1.2 rule 3 correctly identifies the real harm ("it makes the English and Arabic renders different widths for no gain"), which by definition only manifests in the English render, where the assertion does not run.

**Fix.** Run the computed-style assertion under `--langs en`, where a `tracking-*` class actually resolves to a non-zero value. Keep the source-level `tracking-` grep in `check-manhaj.mjs` as the primary gate and stop describing assertion 4 as render-verification of the same rule.

### §7.3 verification — assertion 7 ("`.quran-reading-surface` is intact"), and the spec's claim that the reading-pane guard is "verified by test not by eye"

**Where.** §7.3 assertion 7: "`overflow === 'visible'` and `borderStyle === 'none'` on every theme, in every fixture mode"

**Why.** `.quran-reading-surface` is rendered only by `SurahReader`, i.e. only when a surah has loaded. In the two fixture modes this specification actually creates work for on `/quran` — `empty` (drives `quranReader`) and `loading` (drives `readingPane`) — the element does not exist in the DOM, so `querySelectorAll` returns an empty NodeList and the assertion passes vacuously. None of the seven listed fixture modes loads a surah. The guard the spec leans on hardest is therefore unenforced in precisely the states the spec introduces.

**Fix.** Add a `surah-loaded` fixture mode (`get_quran_surah` resolves with a seeded surah in both riwayat). Make assertion 7 fail when the element count is zero in that mode, so an absent element is a failure rather than a pass. Extend it to assert `.quran-reading-frame` keeps `overflow: hidden` and that `.quran-reading-viewport` is the scroller.

### Load-bearing invariant — Arabic strings wrapped for bidi need U+2067 (RLI); the spec's stated isolation mechanism does not exist in its own code

**Where.** §1.2 rule 2: "The whole Arabic string is RLI-wrapped by `interpolate`/`<bdi dir=\"auto\">`" — and §7.3 assertion 5's escape hatch "or its `textContent` starts with `⁧`"

**Why.** The `interpolate` implementation given in §1.1 wraps only the SUBSTITUTED VARIABLES (`ARABIC.test(raw) ? rli(raw) : lri(raw)` inside the `.replace()` callback). It never touches the template. No dictionary string is ever RLI-wrapped by `interpolate`, so the `⁧`-prefix branch of assertion 5 can never fire for dictionary copy, and the only real isolation is `<bdi dir="auto">`. The spec attributes a load-bearing bidi guarantee to a function that does not provide it — and rule 2 uses that false attribution to justify not hand-wrapping `ffmpeg`/`SQLite`/`YouTube` inside Arabic strings (E3's note repeats it). The conclusion happens to be right, but the stated reason is wrong, which is how the guarantee gets removed later by someone who checks.

**Fix.** Pick one mechanism and state it once. Either (a) `<bdi dir="auto">` is the sole isolation, drop the `interpolate` clause from rule 2 and from E3's note, and delete the `⁧`-prefix branch from assertion 5 as dead; or (b) have `getTranslation` RLI-wrap the whole string when `language === 'ar'` — but then the `<bdi dir="auto">` wrapper produces a redundant nested isolate and must be dropped. Do not ship both. The LRI-for-Latin / RLI-for-Arabic split on variables is correct as written and matches `formatTime.ts:23-26`; keep it.

### §7 verification scope — ten-theme guarantee (manhaj constraint 9) not actually swept, and assertion 8's threshold is unfailable against measured token values

**Where.** §7.2 ("8 routes × 5 themes × 2 languages × 7 fixture modes") versus §7.3 assertion 7 ("on every theme") and assertion 8 ("Screenshot `[data-state-block]` in all ten themes")

**Why.** Two defects. (1) The sweep is specified at 5 themes while two assertions require 10 — as written the assertions cannot execute over their stated domain. (2) Assertion 8's threshold is set below the noise floor of the existing tokens: `--accent-gold-rgb` resolves to 236 195 102 / 176 141 87 / 175 123 45 / 200 164 93 / 226 197 122 / 226 197 122 / 226 190 104 / 240 210 150 / 239 161 99 / 79 195 247 — 9 distinct values across 10 themes, with only `blue` and `red` colliding. "Differs between at least six of them" therefore passes even if four themes were hardcoded to an identical literal. The check advertised as catching "a hardcoded colour sneaking in" has four themes of slack.

**Fix.** Set the sweep to the ten `data-theme` values by name (noor, emerald, pearl, mushaf, blue, red, onyx, mushaf-gold, maktabah, samaa). Change assertion 8 to require exactly 9 distinct computed `border-color` values on the `accent`-tone plate, with the `blue`/`red` collision at `226 197 122` named in the test as the one documented exception, so any new collision fails. Assert the `danger` and `warning` tones separately, since §1.3 makes those theme-independent except on Pearl and they must therefore yield exactly 2 distinct values across the ten.

### Correctness — §1.4 "Focus rescue"

**Where.** "Every virtualized scroller carries `tabIndex={-1}` and an `onBlur` handler: if `event.relatedTarget === null` and the scroller still contains `document.activeElement === document.body`, call `scroller.focus({ preventScroll: true })`."

**Why.** `scroller.contains(document.body)` is false by construction — `<body>` is an ANCESTOR of the scroller, never a descendant — so `Node.contains` returns false in every possible state and the rescue never runs. The stated condition is dead code. The consequence is the exact bug the clause was written to prevent: on Radio (195 flattened rows, virtualized to ~15 in the DOM) a keyboard user arrows down, the row they came from unmounts, focus lands on `<body>`, and the next Tab restarts from the top of the document. Fixing the condition naively is also wrong: `relatedTarget === null` additionally fires when the WINDOW loses focus, so a corrected version would steal focus back to the scroller every time the user alt-tabs away — and the Part II ambient contract already pauses on window blur, so window-blur handling is a live code path here.

**Fix.** Replace the condition with a rAF-deferred check that does not use `contains(body)` and that ignores window blur: `onBlur={(e) => { if (e.relatedTarget !== null) return; if (!document.hasFocus()) return; requestAnimationFrame(() => { if (document.activeElement === document.body) scroller.focus({ preventScroll: true }); }); }}`. Better still, focus the nearest mounted row rather than the scroller so the roving index survives. Add a §12 assertion: focus a row, `scrollToIndex` far enough to unmount it, assert `document.activeElement !== document.body`.

### WCAG 4.1.2 name, role, value; §0.4 "no interpolation … No block may build a display string by concatenation"

**Where.** §5 RailStation's play control and favourite `icon-btn`; §3/§4 rails' overflow-menu buttons and play medallions; the existing pattern at src/pages/Radio.tsx:250,297 (`aria-label={t('favorite')}`, `aria-label={live ? t('pause') : t('play')}`)

**Why.** `t()` is `(key: TranslationKey) => string` with no interpolation (verified at src/i18n.ts:1150-1160), and §0.4 forbids blocks from building display strings by concatenation. Together those make a per-item accessible name impossible through the sanctioned API. The result — already shipping today and cemented by the spec, which moves Radio's mark and control logic "unchanged" — is a rail of 20 stations exposing 20 buttons all named "Favourite" and 20 named "Play", plus a grid of 60 cards with 60 identically-named overflow buttons. A screen-reader user tabbing or using a button/element list cannot tell which station or which card a control belongs to. §0.4's rule is about DISPLAY strings and bidi safety; it was never meant to govern accessible names, but as written it has no carve-out and the block inventory has no other mechanism.

**Fix.** Add an explicit exemption to §0.4: accessible names may be composed, because `aria-label` is not a rendered string and is not subject to bidi isolation. Then specify the mechanism in §1.6 so all four rails and both lists use one: give each card a stable id on its visible title element and set `aria-labelledby={`${cardId}-title ${verbId}`}` on the icon-only control, where `verbId` points at a visually-hidden `<span>` holding `t('play')` / `t('favorite')` / `t('moreActions')`. That yields "Play — Idhaa'at al-Qur'an al-Kareem" with zero concatenation and zero new i18n keys. Add a §12 assertion: on `/radio` and `/library`, assert the set of accessible names on icon-only controls has cardinality equal to the number of controls.

### RTL — no letter-spacing on Arabic (breaks cursive joins); §2 .section-eyebrow

**Where.** `.section-eyebrow { text-transform: uppercase; letter-spacing: 0.16em; }` guarded only by `html[data-language='ar'] .section-eyebrow { text-transform: none; font-weight: 500; }`, applied to `SectionHeader size="sub"` — which §8 uses for every `ListGrouped` group label

**Why.** The guard keys on the UI LANGUAGE attribute, not on the script of the content. `SectionHeader size="sub"` renders `title` through `.section-eyebrow`, and §8 pipes `ListGroup.label` straight into it — group labels are DATA: reciter names, radio station country/language groups, folder basenames, surah names. Those are routinely Arabic while the app runs in English. With `html[data-language='en']`, the global zeroing rule (src/index.css:596) does not apply and `letter-spacing: 0.16em` is applied to Arabic text, breaking the cursive joins — the precise defect CLAUDE.md documents as never a legitimate operation on the script. The pre-existing `useEyebrowClass` hook has the same hole, but it only ever received `t()` output; the spec is the change that starts feeding it user data.

**Fix.** Move the guard from the language attribute to the content: never apply tracking to a `SectionHeader` whose title is data. Either split the class (`.section-eyebrow` for `t()`-sourced labels, `.section-label` with no `text-transform` and no `letter-spacing` for `ListGrouped` group labels and any `title` that is a `ReactNode` rather than a translation key), or add `:lang(ar) { letter-spacing: 0 !important; text-transform: none; }` alongside the existing `html[data-language='ar']` rule and require callers to set `lang` on data-bearing headings. Add a §12 assertion in the `en` pass: assert no element whose `textContent` matches `/\p{Script=Arabic}/u` has a computed `letter-spacing` other than `normal`/`0px`.

### RTL — no Arabic text below 12px (dots and marks stop resolving)

**Where.** `.chip { font-size: var(--fs-cap); }` (11.5px), `.section-eyebrow { font-size: var(--fs-cap); }` (11.5px), §10 StatStrip label "`.section-eyebrow` at `text-[11px]`", §2 count `text-[11px]`, §8 alpha index "11.5px"

**Why.** `--fs-cap` is 11.5px (src/index.css:620). In the Arabic UI every one of these renders Arabic: chip labels are category names, `size="sub"` headings are the section title on Library, Dashboard and all eight Settings sections, StatStrip labels come from `t()`, and the alpha index rail renders Arabic bucket letters by construction (`ARABIC_ORDER`). Below 12px the i'jam dots and any tashkeel stop resolving on a 100% Windows scale factor. The spec had the opportunity to fix this while replacing `useEyebrowClass` — which already ships `text-[11px]` — and instead propagated it into five new surfaces and hard-coded two of them as arbitrary `text-[11px]` classes, which also contradicts the audit's own goal of retiring 160 arbitrary px utilities.

**Fix.** Add `--fs-cap-ar: 12.5px` and set `html[data-language='ar'] { --fs-cap: var(--fs-cap-ar); }` so every consumer lifts at once with no per-component code, and replace both `text-[11px]` literals with `text-[length:var(--fs-cap)]`. Give the alpha index its own `--alpha-index-fs: 13px` — it is a hit target as well as text and 11.5px Arabic letters are unreadable and untappable. Add a §12 assertion in the `ar` pass: assert no element with Arabic `textContent` has a computed `font-size` below 12px.

### RTL — Arabic line-height 1.6–1.85 vs Latin 1.4–1.6; §4 RailWide locked geometry

**Where.** "Body is a **fixed** `block-size: 4.75rem` (76px) holding a 2-line clamped title and one subtitle line — fixed, not `auto`" with the title at `text-[13px] leading-snug`; also §5 RailStation `block-size: 4.5rem`, §0.3 `--group-head-h: 34px`

**Why.** 76px is derived from Latin metrics. In Arabic the app applies `line-height: var(--lh-arabic)` = 1.85 (src/index.css:639-646). Two lines of a 13px title = 48.1px, plus one subtitle line at `--fs-cap` = 21.3px, is 69.4px before any card padding — any block padding at all overflows the fixed 76px and, because the height is fixed rather than `auto`, the overflow is clipped rather than growing the card. Clipped tashkeel and clipped descenders on every Arabic card in the Watch history rail. `--group-head-h: 34px` has the same shape of problem (11.5px Arabic at 1.85 = 21.3px plus the `.rule-head` `padding-bottom: var(--s3)` = 12px is 33.3px, i.e. 0.7px of headroom), and it is additionally duplicated as a magic `const headH = 34` in the `pushY` JS while `estimateSize` reads `parseFloat(--group-head-h)` — two sources that will drift.

**Fix.** Make the fixed heights language-aware from one place rather than removing them (the equal-height guarantee is worth keeping): `--rail-wide-body: 4.75rem; --group-head-h: 34px;` with `html[data-language='ar'] { --rail-wide-body: 6rem; --group-head-h: 42px; }`, and have RailWide/RailStation/the pinned header read the token. Delete `const headH = 34` and read the custom property once via `getComputedStyle` so there is a single source. Add a §12 assertion in the `ar` pass: for every rail card body and group header, assert `scrollHeight <= clientHeight`.

### WCAG 4.1.2 / 1.3.1 — role matches interaction; §1.4 ARIA + §6 GridMedia keyboard

**Where.** §1.4 "The scroller is `role="list"` … each virtual row is `role="listitem"` with `aria-setsize={count}` and `aria-posinset={index + 1}`" applied to §6's "Virtual rows render as `<div role="listitem">` … containing a nested grid of that row's `columns` cards"

**Why.** Three defects compound. (1) The unit of ARIA is the ROW but the unit of interaction is the CARD, so a screen reader announces "item 3 of 12" while the user is on card 9 of 60 — `aria-setsize`/`aria-posinset` report numbers that correspond to nothing the user can perceive, which is worse than omitting them. (2) §6's keyboard model is explicitly two-dimensional (ArrowLeft/Right ±1, ArrowUp/Down ±`columns`), which is the `grid` pattern, announced as a flat `list`; assistive tech will not offer row/column navigation and the arrow keys it does own are intercepted. (3) Below the 60-item threshold §6 says the container is "a plain CSS grid with no absolute positioning at all" — so the ARIA structure, and therefore the screen-reader experience, silently changes based on collection size. A user who learns the pattern on a 40-item library gets a different one at 61.

**Fix.** Pick one structure and use it at both sides of the threshold. Simplest correct option: keep `role="list"` on the scroller, make the CARD the `role="listitem"` carrying `aria-setsize={items.length}` / `aria-posinset={cardIndex + 1}`, and give the virtual row wrapper `role="presentation"` — ARIA 1.2 permits a presentational generic between a list and its items. Drop the 2D arrow mapping or promote the whole thing to `role="grid"`/`row`/`gridcell` with `aria-colcount`/`aria-rowcount`; do not ship list semantics over grid keyboard. State explicitly that the roles are identical above and below `virtualizeAfter`, and assert it in §12 with a 59-item and a 61-item fixture.

### WCAG 4.1.2 / APG composite widget pattern; §11 ChipRow keyboard

**Where.** "`role="group"` with `aria-label`; roving `tabIndex` across chips … In `single` mode each chip is `aria-pressed` and selecting one deselects the rest" and "selected chips sort ahead of the collapse boundary"

**Why.** `role="group"` is not a composite widget, so roving `tabIndex` and arrow-key handling inside it are unsanctioned: screen readers do not switch to forms/application mode for a `group`, the arrow keys the user expects to read the document are swallowed, and there is no mechanism by which "selecting one deselects the rest" is announced — `aria-pressed` toggles are semantically independent, so the SR reports "pressed" on the new chip and never reports that the previous one became unpressed. Mutually-exclusive selection is `radiogroup`/`radio` (or a single-select `listbox`). Separately, re-sorting selected chips ahead of the collapse boundary reorders the DOM at the moment of selection, so the roving index now addresses a different chip and focus lands somewhere the user did not choose — a focus-order defect (2.4.3) triggered by the primary interaction.

**Fix.** Split the roles by mode: `mode="single"` renders `role="radiogroup"` with `role="radio"` + `aria-checked` children; `mode="multi"` renders `role="toolbar"` with `aria-pressed` toggle buttons. Both are composite widgets where roving tabIndex and arrow keys are the defined pattern. For the collapse boundary, do not reorder on selection — compute the display order once from the INITIAL selection and keep it stable for the lifetime of the row, or pin selected chips by rendering them in a separate always-visible leading group. If reordering is unavoidable, re-point the roving index at the moved chip's new index and re-focus it in the same commit.

### WCAG 2.1.1 / 2.4.3 — nested interactive content breaks roving focus; §9 ListCompact, §3/§4 rails

**Where.** "`renderRow` supplies the row's inside only; the block owns the row shell, the density, the active state and the focus ring" combined with §1.6's roving `tabIndex` on the row and `Enter`/`Space` → `onActivate`

**Why.** Rows and cards contain their own real buttons — the `OverflowMenu` trigger, Watch's remove action (§4 turns it into an `OverflowAction`, but the trigger is still a button), RailStation's favourite `icon-btn`. Those are natural tab stops. So Tab into a `ListCompact` lands on the first row's inner BUTTON, not on the roving row shell, and the arrow-key model never engages; Tab then walks every inner control of every row instead of leaving the list in one stop — which is exactly the tab-order explosion the roving pattern exists to prevent. `Enter`/`Space` on the row shell also fires `onActivate` when the user meant to activate an inner control, and a click on an inner button bubbles to the row. §1.6 specifies the two-stop model for RAILS ("primary control and overflow menu button share the card's roving tabIndex") but §9 never states the equivalent for list rows, and neither section says inner controls must be removed from the tab order.

**Fix.** State once in §1.6, applying to every rail, list and grid: all interactive descendants of a roving item carry `tabIndex={-1}` and are reached with a documented in-item key (ArrowRight/ArrowLeft at the item's inline end, or a dedicated `F10`/`Shift+F10` for the overflow menu per the APG menu-button pattern); the item shell stops event propagation from inner controls before calling `onActivate`; and `useRovingIndex().getItemProps` returns props for BOTH the primary and the secondary control rather than one `tabIndex`. Add a §12 assertion: Tab from the element before a list to the element after it, and assert the number of intermediate stops equals the documented count (1 for ListCompact, 2 + 2 paging buttons for a rail) regardless of row count.

### WCAG 4.1.2 / 1.1.1 — accessible name and non-text content; §1.2 MediaFrame

**Where.** `label`: "Accessible name for the frame; the `<img>` itself carries `alt=\"\"`", rendered as `<div className="media-frame ratio-…">`; plus the progress rail `absolute inset-x-0 bottom-0 h-[3px]` with `bg-success-green`/`bg-accent-gold`

**Why.** Two names go missing. (1) `aria-label` on a `<div>` with no role maps to `role=generic`, and ARIA prohibits naming a generic element — Chromium/NVDA do not expose it. So `label` is dropped and the frame is an unnamed region; and since §3 binds `onPrimary` to "the media frame and the play medallion", the frame is ALSO the click target, meaning a nameless, roleless, un-keyboard-reachable `<div>` is a primary action. (2) Resume progress is conveyed by a 3px coloured bar and nothing else — no `role="progressbar"`, no `aria-valuenow`, no text. §1.1's table simultaneously strips the path/percentage meta line from card faces, so after this change a screen-reader user has no way at all to learn that a lecture is 40% watched or complete. Colour is also the only channel distinguishing complete (`bg-success-green`) from in-progress (`bg-accent-gold`), failing 1.4.1.

**Fix.** Make the frame's interactivity explicit: render the primary action as a real `<button className="media-frame-action">` wrapping or overlaying the frame, named via `aria-labelledby` pointing at the card's visible title (see the icon-name finding above), and leave the `<div className="media-frame">` purely presentational with `alt=""` on the img. Give the progress rail `role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}` plus an `aria-label` naming it, and add a visually-hidden `<span>` carrying `t('completed')` when `complete` so the state is not colour-only. Add a §12 assertion: every `.media-frame` that has a click handler resolves to a non-empty accessible name.

### WCAG 1.4.11 non-text contrast — UI component; §1.7 overlay scrollbars

**Where.** `.overlay-scroll::-webkit-scrollbar-thumb { background: transparent; }` with hover `rgb(var(--hair-rgb) / 0.22)` and thumb-hover `rgb(var(--hair-rgb) / 0.40)`

**Why.** At rest the thumb is fully transparent — the scroll-position indicator, which is the only cue that a pane has more content and where the user is within it, has 1.00:1 contrast and is simply absent. I computed the visible states against each theme's ground: at 0.22 the ratios are 1.53, 1.34, 1.26, 1.42, 1.56, 1.56, 1.48, 1.72, 1.55, 1.59; at 0.40 they are 2.62, 1.92, 1.55, 2.19, 2.66, 2.67, 2.52, 2.99, 2.39, 2.39. Not one theme reaches 3:1 in any state, and Pearl — the only light theme — tops out at 1.55:1. `--hair-rgb` resolves to `--accent-gold-rgb`, and a low-alpha gold is a hairline colour, not a control colour. Every `ListCompact`, `ListGrouped`, `GridMedia` and both Quran panes get this scrollbar.

**Fix.** Do not paint the thumb in `--hair-rgb`. Use the text ladder, which is already tuned for legibility against each ground: `background: rgb(var(--text-faint-rgb) / 0.9)` at rest (measures ~3.1–3.8:1, clearing the 3:1 floor in all ten themes) and `rgb(var(--text-muted-rgb))` on hover. Drop the transparent-at-rest behaviour entirely — a persistent low-contrast thumb is the accessible choice and the reserved gutter already prevents the reflow that motivated hiding it. Add a §12 assertion computing thumb-vs-track contrast in all ten themes against a 3:1 floor.

### Correctness — §8 alphaBucket / bucketOrder, self-contradicting §8's own '★' bucket

**Where.** `export const bucketOrder = (present, language) => ['#', ...primary, ...secondary].filter(b => present.has(b));` with `ARABIC_ORDER = [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي']` and `LATIN_ORDER = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']`

**Why.** `bucketOrder` is an allowlist: any bucket `alphaBucket` produces that is not literally in `ARABIC_ORDER`, `LATIN_ORDER` or `'#'` is silently dropped from the index rail while its group still renders in the list. The dropped set includes: `ء` (standalone hamza — `alphaBucket` returns it unchanged since it is Arabic script and absent from `ARABIC_FOLD`); `پ چ ژ گ` (Persian/Urdu letters, entirely plausible in reciter and radio-station names); non-decomposing accented Latin such as `Ø`, `Þ`, `Đ`; and — contradicting §8's own next paragraph — `'★'`, the favourites bucket the spec explicitly says "Radio returns `'★'` and the rail renders a `Star` glyph for it". The favourites group, the single most important group on `/radio`, is unreachable from the index the spec designed for it. For a keyboard user the alpha index is the only fast path into a 195-row virtualized list, so a missing bucket means a group reachable only by arrowing through it.

**Fix.** Invert the algorithm: never filter buckets out, only ORDER them. `bucketOrder` should return every member of `present`, sorted by index in `[...primary, ...secondary]` with unknown buckets appended in `Intl.Collator(language).compare` order, and `'#'` plus any caller-supplied non-letter bucket (`'★'`) pinned to the front. Add `ء` to `ARABIC_ORDER` (or fold it to `ا` in `ARABIC_FOLD`, matching the treatment of `أ`/`إ`/`آ`). Add a §12 assertion: for every group rendered by `ListGrouped index="alpha"`, assert a corresponding button exists in the index rail.

### Correctness / React semantics — §1.4 useScrollParent resolution

**Where.** "Resolved in `useLayoutEffect` on mount and re-resolved when `containerRef.current` changes identity" and "walks `parentElement` until `getComputedStyle(el).overflowY` is `auto` or `scroll`"

**Why.** A ref's `.current` changing is not observable — refs are mutable boxes, not reactive state, so no effect re-runs and no render occurs. The stated re-resolution never happens; the scroller is resolved exactly once at mount. That matters because §7's `stackBelow` breakpoint and §7.1's `page-container-fixed` both CHANGE which ancestor scrolls after mount: on `/quran` the spec makes `.page-container` `overflow: hidden`, so the walk finds no `auto|scroll` ancestor until it reaches `<body>` (also `overflow: hidden`, src/index.css:625) and falls off the top, and when a `SplitPane` crosses its `stackBelow` breakpoint on window resize the panes stop being independent scroll contexts. A stale or null scroll element means the virtualizer computes offsets against the wrong box: rows render at the wrong `translateY`, `scrollToIndex` scrolls nothing, and keyboard navigation silently stops moving the view — the row is focused off-screen, which is the same 2.4.11 failure as the sticky-header case but with no visible cause.

**Fix.** Use a callback ref instead of a `RefObject` so attachment is observable, and re-resolve on a `ResizeObserver` of the container plus a `matchMedia` listener for each `stackBelow` breakpoint. Make the walk fail loudly rather than silently: if no `auto|scroll` ancestor is found before `document.body`, throw in DEV naming the component and telling the caller to pass `scrollElementRef`. Since §7.1 makes `/quran` the known case, require `scrollElementRef` explicitly for every block inside a `page-container-fixed` route and assert it in §12 item 4.

### WCAG 1.3.1 info and relationships — heading levels; §13 migration map vs §12 assertion 10

**Where.** `size='section'` → `h2`, `size='sub'` → `h3`; migrations A (Library ×3), F (Dashboard ×6), G (all eight Settings `<Section>` heads) all map to `sub`; and §12 assertion 10 requires "the set of distinct computed tuples across all `h2`/`h3` section headings … has cardinality ≤ 2"

**Why.** Settings, Dashboard and Library each keep one `h1` (their page title) and then receive only `h3` section heads — the document outline jumps h1 → h3 with no h2 on those routes, so heading navigation reports a level that does not exist and the structure misrepresents the content hierarchy. The `as` escape hatch exists precisely for this and the migration map never uses it. Compounding it, §12's assertion 10 enforces at most two distinct visual tuples across all `h2` and `h3` elements, which structurally rewards collapsing everything to one level rather than fixing the outline — the verification actively works against the semantics.

**Fix.** Decouple level from size in the migration map: `size` selects the visual treatment, `as` selects the level, and every route's top-level sections take `as="h2"` regardless of whether they render at `section` or `sub` size. Update migrations A, F and G to pass `as="h2"`. Restate §12 assertion 10 as a check on the distinct set of `(size, computed tuple)` pairs rather than on `h2`/`h3` tag names, and ADD an assertion that on every one of the eight routes the sequence of heading levels never skips a level.

### WCAG 4.1.3 status messages; §11 ChipRow, §6/§9 empty branches, §8 type-ahead

**Where.** The default empty state `<p className="py-6 text-sm text-muted-text">{t('nothingToShow')}</p>`, and every filter/search path (`ChipRow.onToggle`, `SearchResults` → `ListCompact`, `Library.tsx:637-645` category rail)

**Why.** `grep -rn "aria-live" src/` returns nothing — the app has no live region anywhere today, and Part II introduces the interactions that need one. Toggling a category chip replaces a 60-card grid with a 3-card grid or with the `nothingToShow` strip, and a screen-reader user gets complete silence: no result count, no "no results". The same applies to `ListGrouped`'s type-ahead, which scrolls the list to a bucket with no announcement of where it landed. The default empty node is a plain `<p>` with no `role="status"`, so even when it does appear it is announced only if the user happens to navigate onto it.

**Fix.** Give every block that owns a filtered or virtualized collection a single polite live region: add `role="status" aria-live="polite" aria-atomic="true"` to the default empty node, and have `GridMedia`/`ListCompact`/`ListGrouped` render a visually-hidden `role="status"` that updates with the result count on every change to `items.length` (debounced ~150ms so a rapid multi-select does not queue five announcements). Because `t()` has no interpolation, expose the count as a separate `<bdi>` inside the region rather than an interpolated sentence. Have `ListGrouped`'s type-ahead announce the bucket it jumped to through the same region. Add a §12 assertion: toggle a chip and assert a `role="status"` element's `textContent` changed.

### RTL / i18n correctness — §10 StatStrip, §2 SectionHeader count

**Where.** `value: librarySummary.playlists.toLocaleString()` (three of the four Library stats) and `count` rendered as `<bdi>{count}</bdi>`

**Why.** `toLocaleString()` with no locale argument uses the HOST default, not the app's language setting. On a Windows machine configured for an Arabic locale the app renders Arabic-Indic digits (٠١٢٣) even when the user has chosen English in Settings, and on an English host it renders Western digits even when the user has chosen Arabic — in both directions the number system contradicts the rest of the UI. The app has an explicit `language` from `useI18n()` and `formatDuration` already takes it as a parameter; the counts are the only numerals that don't. `tabular-nums` also does not apply to Arabic-Indic digits in most faces, so §10's stated column alignment silently stops working. (The `<bdi>` wrapping is correct and `formatDuration`'s own U+2067 isolate makes the extra `<bdi>` around it harmless.)

**Fix.** Pass the locale explicitly everywhere a number is formatted: `value.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')` — or better, add `formatCount(n, language)` next to `formatDuration` in `src/utils/formatTime.ts` so there is one place, matching the pattern that already exists, and state in §10 and §2 that no block may call `toLocaleString()` without a locale. Decide and document whether Arabic uses Arabic-Indic or Western digits and pin the locale tag accordingly (`ar-EG` vs `ar-u-nu-latn`); the choice must be the same in `StatStrip`, `SectionHeader` count and `MetaLine` or the three will disagree on the same screen.

### WCAG 2.4.3 focus order; §1.6 keyboard model

**Where.** "move the roving index by 1, focus the new primary, and `scrollIntoView({ block: 'nearest', inline: 'nearest', behavior })`"

**Why.** `Element.scrollIntoView` scrolls EVERY scrollable ancestor, not just the rail. On seven of eight routes the rail sits inside `.page-container` (`overflow-y: auto`, src/index.css:1845), so arrowing horizontally through a rail also scrolls the PAGE vertically whenever the rail is not fully in view — the content the user was reading jumps out from under them on a keystroke that should only move sideways. `block: 'nearest'` reduces but does not eliminate this: if the rail is partially below the fold, 'nearest' still scrolls the page to bring the card's block edge into view. The same call is used by `ListCompact`/`GridMedia` for vertical movement, where the ancestor page scroll and the inner `.overlay-scroll` fight each other.

**Fix.** Do not use `scrollIntoView` for intra-widget navigation. Compute the target scroll offset against the widget's own scroller and call `scroller.scrollTo({ left/top, behavior })` — `useRailScroll` already has the signed `sign * el.scrollLeft` arithmetic and `itemPitch` needed to do this exactly. Where `scrollIntoView` is genuinely wanted, guard it with `scrollIntoViewIfNeeded`-equivalent manual bounds checking against the widget scroller only. Add a §12 assertion: record `.page-container.scrollTop`, arrow five times through a rail, assert it is unchanged.

### Verification coverage — §12

**Where.** §12's eleven assertions and "across 5 themes × 2 languages"

**Why.** Not one of the eleven assertions touches accessibility. There is no check that a focus ring is visible and unclipped, no contrast check in any theme, no check of accessible names, no check of heading order, no check that `prefers-reduced-motion` is honoured by the new CSS, no check of keyboard traversal or tab-stop counts, and no check that Arabic content never receives letter-spacing or a sub-12px size. Six of the findings above are invisible to the suite as specified. The sweep is also 5 of 10 themes without naming which five — and Pearl Scholar, the only light theme and the one where every gold-derived value I measured performs worst (scrollbar thumb 1.26/1.55:1, chip border 1.26:1, focus ring 3.18:1 against 11.03 on Noor), is the theme most likely to be omitted from a 5-theme subset.

**Fix.** Pin the sweep set explicitly and include Pearl and Onyx in it (the two polarity extremes), and run the contrast assertions across all ten themes — a colour check is a computation, not a render, so it costs nothing to run on all ten. Add assertions: (12) every focusable element's rect inflated by 4px is contained by its scroll container's client rect; (13) every text node's rendered contrast meets 4.5:1 (3:1 at >=18.66px bold / 24px), and every control boundary and state indicator meets 3:1, in all ten themes; (14) every element with a click handler resolves to a non-empty accessible name and names within one collection are unique; (15) heading levels on each route never skip; (16) under `prefers-reduced-motion: reduce`, no element in `src/components/blocks/` has a non-`none` computed `animation-name` or `transition-duration`; (17) in the `ar` pass, no element with Arabic textContent has `letter-spacing` != 0 or `font-size` < 12px, and no card body has `scrollHeight > clientHeight`.

### §7.3 assertion 1 — 'no spinner in a content slot'

**Where.** §7.3.1 `document.querySelectorAll('[data-state-block] .animate-spin')`

**Why.** `.animate-spin` matches the class token `animate-spin` only. The codebase's own spinner convention is `motion-safe:animate-spin` (`src/components/dashboard/QuickActions.tsx:78`), which is a different token and does not match. Any spinner written in the house style evades the check entirely.

**Fix.** Query `[data-state-block] [class*="animate-spin"]` (or assert on computed `animation-name` containing `spin` under a `no-preference` context), and exempt only descendants of `button[aria-busy="true"]`.

### §7.3 assertion 3 — 'every error state has a wired action'

**Where.** §7.3.3 'at least one `button[data-recovery-action]`, and its value is a key of `RECOVERY_ACTIONS`'

**Why.** The probe runs `page.evaluate` against the built bundle. `RECOVERY_ACTIONS` is a module-local const in `src/components/state/recoveryActions.ts`; after bundling it is not reachable from the page, so the membership half of the assertion cannot execute. As written the check will silently degrade to 'a button with the attribute exists', which any typo satisfies.

**Fix.** Emit the id list at build time (a generated `recovery-action-ids.json` the probe imports in Node and compares against the scraped attribute values), or attach `window.__RECOVERY_ACTION_IDS__` behind the harness flag. Do not read it from the DOM.

### Invariant — Arabic bidi isolation (U+2067 RLI); §1.2 rule 2 and §7.3 assertion 5

**Where.** §1.2 rule 2 ('the whole Arabic string is RLI-wrapped by `interpolate`/`<bdi dir="auto">`'), §4.2 E3 `errFfmpegMissingTitle` ar = `ffmpeg غير مثبَّت`, §7.3.5

**Why.** Two compounding errors. (a) `interpolate` as specified isolates only the *substituted values* and returns the template untouched when `vars` is undefined — which is the case for most keys — so nothing RLI-wraps a static Arabic string; the stated mechanism does not exist. (b) `<bdi dir="auto">` resolves direction from the first strong character. `ffmpeg غير مثبَّت` begins with Latin `f`, so `dir="auto"` resolves the whole title LTR and the Arabic renders in an LTR paragraph — precisely the class of defect `formatTime.ts:23-26` documents. Assertion 5 accepts `dir="auto"` as sufficient, so it passes on the broken render.

**Fix.** Either RLI-wrap dictionary values at the `getTranslation` boundary when the string contains Arabic (not only when vars are present), or hand-set `dir="rtl"` on state-block text when `language === 'ar'`. Change assertion 5 to measure the outcome rather than the attribute: for every element whose text is majority-Arabic, assert `el.matches(':dir(rtl)')` (Chromium supports `:dir()`) or `getComputedStyle(el).direction === 'rtl'`.

### §7.3 assertion 4 — 'Arabic carries no tracking'; invariant `html[data-language='ar']` zeroes letter-spacing

**Where.** §7.3.4, run under `--langs ar`

**Why.** `index.css` zeroes letter-spacing globally with `!important` under `html[data-language='ar']`. In Arabic every element computes `0px` regardless of whether a `tracking-*` class is present, so the assertion passes unconditionally and can never detect the thing it exists to detect. The class only has a visible effect in English — the exact case the spec says it wants to prevent ('makes the English and Arabic renders different widths').

**Fix.** Run the tracking assertion under `--langs en` and compare each state block's computed `letter-spacing` against the value the `fontSize` scale in `tailwind.config.js` prescribes for that step; flag any deviation. Keep the static `tracking-` lint in `check-manhaj.mjs` as the primary gate — it is the only one that actually works.

### §7.3 assertion 8 vs §1.3 token repair — self-contradiction

**Where.** §7.3.8 'assert the outer frame's computed border-color differs between at least six of [the ten themes]' applied to `[data-state-block]`, together with §1.3 which makes `--danger-rgb`/`--warning-rgb` deliberately theme-independent

**Why.** Measured from `src/index.css`: `--accent-gold-rgb` takes 9 distinct values across the 10 themes (blue and red are byte-identical at `226 197 122`), so a `tone="accent"` plate passes. But every `ErrorState` plate is `tone="warning"` or `tone="danger"`, and §1.3 sets those once in `:root` with a Pearl-only override — 9 of 10 themes resolve the identical colour by design. On any error fixture the assertion fails by construction, and the only way to 'fix' it is to undo §1.3.

**Fix.** Scope assertion 8 to `[data-state-block="empty"] [data-plate-tone="accent"]` and require ≥6 distinct border-colors there. For warning/danger, assert the opposite — that the colour is *identical* across the nine dark themes and differs only on Pearl — which is what §1.3 actually promises and is equally cheap to measure.

### Perf budget — measure, don't estimate (verification cost)

**Where.** §7.2 'sweep is 8 routes × 5 themes × 2 languages × 7 fixture modes at 1280×800 and 1920×1080'

**Why.** Measured on this machine, not estimated: `node scripts/harness/shoot.mjs --themes noor --langs en` takes 20.1 s and writes 32 PNGs / 11 MB for one (theme, language) unit covering both viewports. The proposed matrix is 70 such units → ~2,240 PNGs, ~770 MB, ~23.5 minutes of wall clock per sweep, single-browser and sequential. If assertion 8's ten themes are folded in it becomes 140 units → ~4,480 PNGs, ~1.5 GB, ~47 minutes. Most cells are meaningless (`db-corrupt` on `/radio`, `ffmpeg-missing` on `/quran`), and `/radio`'s full-page shot is of a 6,431 px document.

**Fix.** Declare a fixture→route relevance matrix (e.g. `drive-missing` → dashboard/library/settings; `offline` → radio/watch/quran/downloads/settings; `db-corrupt` → dashboard/library/reminders/settings) and sweep only those pairs; that lands around 90–120 units-worth of routes instead of 560. Run the full theme×language sweep on `empty` and `default` only, and run the other fixtures at one theme + both languages. State the resulting wall-clock budget in the spec so a regression is visible.

### §7.1 fixture design — the `loading` mode does not produce the render it claims

**Where.** §7.1 `loading`: 'every command returns a promise that never settles'

**Why.** If `get_settings` never settles, `settingsStore.settings` stays `null` and `App.tsx:38-46` falls back to `theme='noor'`, `language='en'`. Every theme and language cell in the `loading` fixture therefore renders identical noor/en screenshots — 18 of the 20 (theme,lang,viewport) units in that mode are duplicates. The same guard means `useFirstRun`'s `settings !== null` condition is false, so `FirstRun` never appears in the fixture built to exercise it.

**Fix.** Make `loading` settle `get_settings` (and only `get_settings`) so theme/language still apply, and hang the data commands. Screenshot `loading` at one theme per surface profile (pearl, onyx, maktabah, samaa) rather than all five. Exercise FirstRun from the `empty` fixture, where settings resolve, and add an explicit `first-run` fixture that also empties `localStorage['salafi-hub.first-run-dismissed']`.

### Constraint 9 (token-derived colour) / §5 'Fill token' — asserted but not measured

**Where.** §5 `--skeleton-on-page/-panel/-card` and the claim 'Every theme's ladder already separates these three … so one definition covers all ten with zero per-theme code'

**Why.** Numerically separate is not visibly separate. Computed from `src/index.css`: Onyx panel/card/card-hover = 14/21/30, Pearl = 249/255/238. The default `on='panel'` fill (bg-card) against a panel host gives a non-text contrast ratio of 1.056:1 on Onyx and 1.058:1 on Pearl. Today's `bg-panel-hover` fill gives 1.14:1 — so the proposed map roughly halves skeleton contrast on every theme. Because pulse is `motion-safe:`-gated, a reduced-motion user gets a static bar at ~1.06:1 and sees an empty page. The spec asserts the token map works and the verification section never measures it.

**Fix.** Fill one step higher than specified (`on='panel'` → `--bg-card-hover-rgb`) or express the fill as the host colour plus an alpha overlay in slash syntax, e.g. `rgb(var(--text-main-rgb) / 0.06)`, which self-scales on the light theme. Add a probe assertion: for each theme and each `on` value, compute the WCAG non-text contrast between the skeleton fill and its host `background-color` and fail below 1.25:1.

### Invariant — `rgb(var(--x-rgb) / alpha)` slash syntax; token architecture (no redundant seeds)

**Where.** §5 'Add one derived token in `:root` and one map: `--skeleton-on-page: rgb(var(--bg-panel-rgb));` …'

**Why.** These three are exact duplicates of tokens Tailwind already exposes: `tailwind.config.js:18-19` maps `panel-hover → --bg-card-hover-rgb` and `elevated-panel → --bg-card-rgb`, and `bg-panel` maps `--bg-panel-rgb`. Worse, they are declared as resolved `rgb()` colours rather than `-rgb` triplets, so a Tailwind entry built on them cannot carry `<alpha-value>` and `bg-skeleton-on-panel/40` silently produces no utility — the same failure mode as `border-faint` (`tailwind.config.js:26`, baked 0.07, no `<alpha-value>`).

**Fix.** Drop the three vars. Map `on` directly onto the existing tokens (`page → bg-panel`, `panel → elevated-panel`, `card → panel-hover`), or if a semantic alias is wanted, declare triplets (`--skeleton-on-panel-rgb: var(--bg-card-hover-rgb)`) and register them with `rgb(var(--…) / <alpha-value>)`.

### Perf budget — no work triggered on route/focus churn; §6 trigger correctness

**Where.** §6 `useFirstRun()` — 'show === true when ALL of: settings !== null && !settingsLoading, playlists.length === 0, (stats?.totalVideos ?? 0) === 0, …'

**Why.** `appStore` initialises `playlists: []` with `playlistsLoading: false` and `stats: null`, and `loadSettings` / `loadPlaylists` / `loadStats` all fire from mount in parallel. `get_settings` is a single-row read and resolves well before `get_all_playlists` on a real library, so there is a window on every cold start where settings are non-null, playlists are still `[]` and stats still `null` — all three conditions true. An existing user with 5,000 videos sees the FirstRun screen flash on `/` at every launch, and the Dashboard subtree mounts, unmounts and re-lays-out behind it.

**Fix.** Add `!playlistsLoading && playlistsLoadedAtLeastOnce && stats !== null` to the condition (the store needs a `playlistsLoadedOnce` flag; `playlistsLoading` alone is false before the first call starts). Measurement: instrument the delta between `get_settings` resolve and `get_all_playlists` resolve at 100 / 1k / 10k videos and assert FirstRun never mounts for a seeded library in the harness.

### Perf budget — background work must not run while media plays; §4.3 `useHealthMonitor`

**Where.** §4.3 'calls `refreshAll()` on mount, on `window` `focus` (debounced 5s) … Reuse [`isPlayerBusy()`]: skip `checkFolders` and `checkDatabase` while `isPlayerBusy()`'

**Why.** Two holes. (a) `isPlayerBusy()` (`useAppEvents.ts:29-32`) reads `usePlayerStore.status` only — it covers local video and nothing else. Radio and Qur'an recitation both run through `radioStore`, so a full folder-stat pass and a database probe will fire in the middle of a recitation with word-sync active. (b) Every recovery action that opens a native dialog (`importFolder`, `importVideo`, `setFfmpegPath`) blurs and then refocuses the window, so `refreshAll()` runs the instant the picker closes — concurrently with the import scan the user just started. Alt-tab does the same.

**Fix.** Extend the busy predicate to `isPlayerBusy() || useRadioStore.getState().playing || audioElementHolder.current?.paused === false`. Suppress the focus-triggered refresh for 30 s after any dialog-opening recovery action and while an import is in flight. Use a trailing-edge debounce and specify it as such. Prefer `visibilitychange` over `focus` — it does not fire for dialog round-trips.

### Invariant — `.quran-reading-surface` / `positionWordCue` (the cue is measured against this element)

**Where.** §3.1 'Reading-pane guard' and §5 `readingPane`: 'must not introduce a border, must not become a scroll container, and must not set `overflow`'

**Why.** The guard names the two properties CLAUDE.md documents and stops short of the ones that would actually break the mechanism. `positionWordCue` (`Quran.tsx:458-473`) resolves `cue.offsetParent` and subtracts that element's `getBoundingClientRect()`. Any `position` other than `static`, or a `transform`, `filter`, `backdrop-filter`, `will-change` or `contain: paint` on the surface or on a wrapper introduced between the surface and the cue, changes `offsetParent` or creates a new containing block — and the cue lands somewhere else entirely, with no border and no `overflow` in sight. Separately: `healthStore` can insert an `ErrorState` strip above `.quran-reading-viewport` at any moment (focus-triggered), which reflows the surface; the cue only re-anchors on a word change or every 30th frame (`Quran.tsx:585-589`), so it sits visibly off the spoken word for up to ~500 ms.

**Fix.** Extend the guard to `position`, `transform`, `filter`, `backdrop-filter`, `contain`, `content-visibility` and `will-change`, and replace the property-string assertion with the one that actually proves the invariant: with recitation active in the harness, assert `document.getElementById('quran-cue-'+id).offsetParent === document.querySelector('.quran-reading-surface')`. Forbid strips from being inserted into flow above `.quran-reading-viewport` while `syncActive`, or attach a `ResizeObserver` on the surface that calls `positionWordCue` on resize.

### Audit item — virtualization where 6,431 px of unvirtualized rows was measured

**Where.** §5 `stationGrid` variant ('`<LoadingState variant="stationGrid" rows={10} />`' replacing `Radio.tsx:173-178`) and §3.1 `radioCatalogueEmpty` / `radioFilterNoMatch`

**Why.** Re-measured today with the checked-in harness: `/radio` scrollHeight is still 6,431 px over 175 rows at both viewports, fully unvirtualized, with each `StationCard` holding 3–4 individual zustand subscriptions (~600 total). This spec touches the loading, empty and error surfaces of that route and leaves the 175 real rows untouched — so a ten-row skeleton resolves into a 6,431 px wall, which is a worse transition than the current spinner, and every fixture sweep pays a full-page screenshot of that document (a measurable share of the 770 MB above).

**Fix.** Either state explicitly that virtualization is out of scope for Part II and that `stationGrid` renders `rows={10}` only because the first viewport shows ~10 (so the skeleton is honest about what is above the fold), or land windowing for `StationSection` in the same change. If deferred, add a harness assertion that pins `/radio` scrollHeight so a future regression past 6,431 px is caught.

### Keyboard — focus must not be dropped to `<body>` on unmount (WCAG 2.4.3 Focus Order)

**Where.** §6 "On success `dismiss()` fires and the Dashboard renders normally"; §6 `firstRunSkip`; §4 `onDismiss?: () => void` on ErrorState strips; and every `EmptyState` action whose own container unmounts (e.g. `clearSearch` on `librarySearchNoResults`)

**Why.** Nothing in the spec restores focus. In every one of these flows the activated control is inside the element that unmounts: the user presses "Import a folder", FirstRun unmounts, and focus falls to `<body>`. A keyboard user's next Tab restarts at the top of the document (in this app, the TitleBar); a screen-reader user's virtual cursor is silently reset and the newly-populated Dashboard is never announced. The same applies to dismissing an error strip and to clearing a search from inside the no-results state.

**Fix.** Specify focus handoff for each unmount path as part of the contract, not as an implementation detail: FirstRun `dismiss()` moves focus to the Dashboard's `<h1>` (given `tabIndex={-1}`); ErrorState `onDismiss` moves focus to the next focusable sibling, falling back to the route heading; an EmptyState action that unmounts its own block moves focus to the control the user will use next (for `clearSearch`, the search input itself — which is also the correct behaviour by intent). Add a §7.3 assertion: after activating any `[data-state-block]` button, `document.activeElement !== document.body`.

### RTL — no Arabic text below 12px

**Where.** §4.1 `<RecoveryButton>`: "`.quiet-action` for `quiet`"; §6 band 2 "`.quiet-action` 'Import a single video'"; §6 `firstRunSkip` is "a `.quiet-action`"; §3 `emphasis?: 'primary' | 'secondary' | 'quiet'`

**Why.** `.quiet-action` sets `font-size: var(--fs-cap)` (`index.css:1347`), and `--fs-cap: 11.5px` (`index.css:421`). Every quiet-emphasis action in this spec therefore renders its Arabic label at 11.5px — below the 12px floor at which Arabic dots (i'jām) and tashkeel stop resolving on a 96dpi Windows display. The affected strings are not incidental: `firstRunSkip` = `تخطَّ الآن` (the only exit from the first-run screen), `firstRunImportVideo` = `استيراد مقطع واحد`, and every quiet-destructive recovery such as `removeImportedFolder`. Tailwind `text-xs` maps to the same `--fs-cap`, so any `text-xs` in a state block has the same defect.

**Fix.** Add an Arabic size floor as a token rule, not per-component: `html[data-language='ar'] { --fs-cap: 12.5px; }` in `index.css` beside the existing `html[data-language='ar']` block — it is the same shape as the letter-spacing zeroing already there and costs zero per-theme or per-component code. Then extend `scripts/check-manhaj.mjs` to fail on `text-\[(\d|1[01])px\]` inside `src/components/state/`, since arbitrary sizes bypass the scale entirely.

### RTL — Arabic line-height 1.6–1.85; Tailwind text-* re-pins a Latin line-height and clips tashkeel

**Where.** §1.2 Rule 1 (`<bdi dir="auto">` as the universal text container) and §1.2 Rule 3 ("Sizing comes only from the `fontSize` scale in `tailwind.config.js`")

**Why.** The Arabic leading restoration at `index.css:626-633` is scoped to `p, h1, h2, h3, label, li` ONLY. `span`, `div`, `button`, `summary`, `h4` and `bdi` are not covered, so they keep the Latin line-heights the `fontSize` scale pins (`tailwind.config.js:61-69`: 1.45 for `xs`, 1.5 `sm`, 1.55 `base`, and 1.28–1.06 for the display steps). The spec mandates `<bdi>` everywhere and never once names the element that wraps it — so a title rendered as `<div className="text-lg">` gets 1.45 against `--lh-arabic: 1.85` and clips the tashkeel, while the identical copy in a `<p>` renders correctly. The failure is invisible in English and invisible in the diff.

**Fix.** Make the element type part of the contract: EmptyState/ErrorState titles are `<h2>`/`<h3>`, cause and body are `<p>`, and no state-block copy renders in a bare `<div>` or `<span>`. Alternatively (and more robustly) extend the `index.css:626` selector list to cover the state blocks: `html[data-language='ar'] [data-state-block] :where(p,h1,h2,h3,h4,div,span,button,summary,li,label) { line-height: var(--lh-arabic); }`. Add a §7.3 assertion under `--langs ar` that every text-bearing descendant of `[data-state-block]` has computed `line-height / font-size >= 1.6`.

### WCAG 1.4.11 non-text contrast (3:1) and 1.4.3 body contrast (4.5:1) on Pearl Scholar

**Where.** §2 tone table: `accent` → mark/icon `text-accent-gold/70`; `quiet` → mark/icon `text-text-faint`, frames `border-accent-gold/25` and `border-accent-gold/15`

**Why.** The opacity ladder is a single set of values applied across nine dark themes and one light one. On Pearl (`--accent-gold-rgb: 175 123 45`, `--bg-card-rgb: 255 255 255`), gold at 70% composites to roughly `199 163 118` = **2.35:1** against white — it fails the 3:1 floor for a graphic that is the sole carrier of the state's meaning. `border-accent-gold/25` on white is ~1.2:1, effectively invisible, so the jadwal frame — the thing that makes the plate legible as a designed object — simply is not there on Pearl. For `tone="quiet"`, Pearl `--text-faint-rgb: 122 137 151` on white = **3.59:1**, which fails 4.5:1 if any body copy inherits it. `tone="quiet"` is assigned to seven of the twenty-two empty variants.

**Fix.** Do not encode the tone ladder as fixed alpha. Add per-surface-profile alpha tokens (`--plate-mark-alpha`, `--plate-frame-alpha`, `--plate-frame-inner-alpha`) defaulting in `:root` to the current dark-theme values and overridden once in the `html[data-theme='pearl']` block (mark ~0.95, frame ~0.55) — three declarations, still zero per-theme component code, the same pattern §1.3 already uses for `--danger-rgb`. Reserve `text-text-faint` for the mark only and give `quiet` bodies `text-text-muted`. Then replace §7.3 assertion 8 (which only checks that border colours DIFFER between themes) with an actual contrast measurement of mark-vs-ground and body-vs-ground across all ten.

### WCAG 1.4.3 — text tokens for title/body are never specified, so contrast is unverifiable

**Where.** §3 EmptyStateProps / EmptyEntry and §4 ErrorStateProps / ErrorEntry — every field is present except the colour of the title and body text

**Why.** The spec is exhaustive about plate marks, tones, densities, actions and copy, and completely silent about which token the headline and the direction line use. Existing precedent is inconsistent: `PlaylistGrid.tsx:130-131` uses `text-text-primary` + `text-muted-text`, `Quran.tsx:334` uses `text-text-soft`, `Quran.tsx:1550` uses `text-text-soft`. Whichever the implementer picks propagates to twenty-two surfaces across ten themes with no check. Pearl's `--text-muted-rgb: 91 105 120` on `--bg-card-hover-rgb: 238 245 245` is close enough to 4.5:1 that the choice matters. §7.3's eight assertions contain no contrast check of any kind.

**Fix.** Name the tokens in `EmptyEntry`/`ErrorEntry` or fix them in the component: title `text-text-primary`, cause/body `text-text-muted`, `detail` `text-text-faint` (permissible — it is supplementary, disclosed on demand, and duplicated in the cause). Add a §7.3 assertion that computes title-vs-ground and body-vs-ground contrast for every `[data-state-block]` in all ten themes and hard-fails below 4.5:1.

### Correctness / performance — `PRAGMA integrity_check` on mount and on every window focus

**Where.** §4.3 `checkDatabase()` "runs both probes on app mount and after `import_finished`" — one of which is `invoke<string>('repair_database')`; §4.3 also runs `refreshAll()` "on `window` `focus` (debounced 5s)"

**Why.** The spec's claim that `repair_database` is read-only is CORRECT — `settings.rs:252-263` is a bare `PRAGMA integrity_check`, no mutation. But it takes `db.lock()` for the duration, and `integrity_check` is a full scan of every page in the database. Every other DB command in the app blocks behind that mutex while it runs. Firing it on mount and again on every window focus means alt-tabbing back into the app stalls playlist loads and playback-position writes on any non-trivial library. The `isPlayerBusy()` guard the spec reuses covers playback but not the general case. There is also a UX inconsistency worth resolving: `RECOVERY_ACTIONS.repairDatabase` gates the same call behind `confirmKey: 'repairDatabaseConfirm'` (mirroring `Settings.tsx:198`), so the UI presents as destructive-and-confirm-gated a command the health monitor runs silently on every focus.

**Fix.** Run the integrity probe on cold app start only, never on focus. Add `PRAGMA quick_check` (orders of magnitude cheaper) as the focus-time probe and escalate to the full `integrity_check` only on a non-`ok` result. Move it behind `spawn_blocking` so the lock is not held on the main thread. Separately, drop `confirmKey` from `repairDatabase` now that it is documented read-only, or rename the action — a confirm dialog on a non-mutating command trains users to click through confirms.

### Keyboard — `disabled` removes an element from the tab order and drops focus

**Where.** §6 `busy?: boolean; // disables every action, sets aria-busy`

**Why.** The declared behaviour is: user activates "Import a folder", the import begins, `busy` becomes true, and every action including the button that currently holds focus becomes `disabled`. A disabled element is removed from the tab order and loses focus, so focus falls to `<body>` at the exact moment a long-running operation starts — the point at which a screen-reader user most needs to be anchored to something that will report progress. The same pattern appears in `StateAction.disabled` and `<RecoveryButton>`'s busy state.

**Fix.** Use `aria-disabled="true"` plus a no-op click handler instead of the `disabled` attribute for the button the user just activated, so it stays focusable and stays announced. `disabled` is fine for the OTHER actions. Set `aria-busy` on the pressed button (the spec already does this for `RecoveryButton`) and route the eventual `RecoveryResult.message` into the app-level live region.

### Verification coverage — §7.3 omits every check the accessibility brief names

**Where.** §7.3 "probe.mjs assertions (each a hard failure)" — the eight listed assertions

**Why.** The eight assertions cover spinners, action presence, letter-spacing, isolation, reading-pane staticness, `.quran-reading-surface` integrity, and plate colour variance. Not one of them checks: visible focus indication, keyboard traversal order or reachability, text contrast, `prefers-reduced-motion` behaviour, layout shift on theme switch, accessible names on icon-only controls, or announcement of async state. Those are the seven things that actually break for a keyboard or screen-reader user, and this spec adds twenty-two empty surfaces, seven error surfaces and a first-run screen without a single gate on any of them. Assertion 4 also cannot run as written: `getComputedStyle` takes an Element; "every text node inside `[data-state-block]`" has no computed style.

**Fix.** Add to §7.3: (9) tab-traverse every `[data-state-block]` and assert each stop has a visible indicator (non-`none` `box-shadow` or `outline-width > 0`) in all ten themes; (10) assert every `button`/`a` inside a state block has a non-empty accessible name (text content, `aria-label`, or `aria-labelledby`); (11) compute title/body/mark contrast per theme against the actual composited ground; (12) run the whole sweep a second time under `page.emulateMedia({ reducedMotion: 'reduce' })` and assert no `animation-name` survives AND that loading states remain visible; (13) capture element box rects before and after a `data-theme` swap and assert zero geometry delta. Fix assertion 4 to iterate elements, not text nodes.

### RTL — logical properties are inert under a pinned `dir="ltr"`; Arabic paragraphs are left-aligned

**Where.** §4 `density`: "`strip` = a `border-s-2` bar above content that still works"

**Why.** `App.tsx:44` sets `root.dir = 'ltr'` in both languages by deliberate design (the comment there is explicit). Under a pinned LTR root, `border-s-2` resolves to `border-l-2` always — the logical property is real but inert, which is fine, though it should not be mistaken for RTL support. The consequence the spec misses is alignment: a strip's block container is LTR, so a multi-line Arabic cause like `errFolderMissingCause` (`تعذّر الوصول إلى {path}. قد يكون القرص مفصولًا…`, three lines at strip width) is laid out left-aligned with a ragged LEFT edge — backwards for Arabic. The `block` density escapes this only because `text-center` happens to be direction-neutral.

**Fix.** Set `dir` on the state block from `language` (see the `dir="auto"` finding — the same change fixes both), and use `text-start` on the strip's text column so alignment follows that `dir`. Keep the strip's accent bar on `border-s-2` so it flips with the block. Add a §7.3 assertion under `--langs ar` that every `[data-state-block]` has computed `direction: rtl` and `text-align` resolving to `right`.

### Focus trapping and restoration in modals

**Where.** §3.1 `dashReminders` action: "`createReminder` → `navigate('/reminders')` + `openCreateModal`"

**Why.** This spec routes new traffic from the Dashboard straight into `ReminderModal`, which I read at `src/components/reminders/ReminderModal.tsx:31-67` and which has: no focus trap (Tab escapes to the page behind), no focus restoration on close, no `aria-labelledby` (the `<h2 dir="auto">` at :51 exists but is not associated with the dialog), and `role="dialog" aria-modal="true"` placed on the full-screen click-to-close overlay rather than on the `premium-surface` panel — so the accessible dialog boundary encloses the backdrop and the entire page. A screen-reader user who follows this new path is dropped into a dialog they cannot be confined to and cannot exit cleanly. Escape works (`:21-27`) but returns focus nowhere.

**Fix.** Either fix `ReminderModal` as a prerequisite in §1 (move `role`/`aria-modal` to the panel, add `aria-labelledby` pointing at the `<h2>`, trap Tab within the panel, and restore focus to the opener on close), or drop the `openCreateModal` half of the `dashReminders` action and land the user on `/reminders` with focus on the visible "Create reminder" button. Do not add a new entry point to a dialog with no trap and no restore.

### Manhaj 2 (never behind a control) & 3 (never restyled — no drop shadow/effect on the glyph); §10.7's own guard

**Where.** §6.7: scrim `bg-[rgb(var(--shade-rgb)/0.55)] backdrop-blur-sm`, reused by §8.4 for SheetSettings; §10.7 asserts backdrop-filter appears "never on any ancestor of .quran-reading-surface"

**Why.** Opening the palette or the sheet while a surah is open applies `backdrop-filter: blur(4px)` to everything behind the scrim — which is the rendered Qur'anic glyphs. That is a purely aesthetic filter applied to the ayah body. Worse, §10.7's automated guard is scoped to *ancestors* of `.quran-reading-surface`; the scrim is a sibling subtree portalled to `#overlay-root`, so the test passes green while the mushaf is being blurred. The spec's own material argument does not survive here either: `.surface-3` (src/index.css:1921-1931) already carries `blur(22px) saturate(1.35)`, so the panel and the scrim blur the text twice. Transient panels over the mushaf are established practice in this app (see the comment at Quran.tsx:886), but blurring the glyphs is not.

**Fix.** Scrim is opacity-only: drop `backdrop-blur-sm`; `rgb(var(--shade-rgb) / 0.55)` alone gives sufficient separation, and it is the only form that is safe in Pearl where `--shade-rgb` is `15 26 38`. Add a rule that the `.surface-3` frosted material is not used for any overlay whose rect can intersect `.quran-reading-frame` — those get `--fill-2` opaque. Rewrite the §10.7 assertion to test composition, not ancestry: with a surah open and the palette open, assert no element with a computed `backdrop-filter` other than `none` has a bounding rect intersecting `.quran-reading-surface`'s.

### Manhaj 2 (Qur'anic text never behind a control); the spec's own §0.2 rationale

**Where.** §7.4: ToastStack "portalled to #overlay-root at z-toast, position: absolute, offset `inset-inline-end: 20px; bottom: calc(var(--dock-h) + 12px)`", width `min(380px, calc(100vw - 40px))`, up to 3 visible

**Why.** §0.2 removes the `fixed bottom-5 end-5` float precisely because it "sits over the last row of every list and over .quran-reading-viewport" — then §7.4 reinstates that exact geometry for a stack up to three toasts tall. Measured: at 1280×800 with the 240px sidebar, `<main>` is ~1040px, `.quran-reading-frame` is `mx-auto max-w-[68rem]` (1088px) so it fills the content width; a 380px panel at `inset-inline-end: 20px`, ~76px up, lands squarely on the mushaf page and its jadwal band. Toasts fire unprompted (import finished, thumbnails done, download finished — §7.3) so this happens to a reader who did nothing.

**Fix.** Make placement route-aware: when `/quran` is active with a surah open, `placement` resolves to `bottom-start`, where the reading frame's centred measure leaves clearance. Add to the §10 manual sweep, and ideally to the automated set: with a surah open, push 3 toasts and assert no toast rect intersects `.quran-reading-surface`'s.

### Manhaj 4 (mushaf face is for the mushaf); internally self-contradictory

**Where.** §5.1 reciter branch: "surah cartouche (transliteration + Arabic name in the surah-name treatment, **never the mushaf face**, never ayah text)"; and §4.3 dock line 1 `<bdi>{surahNameArabic}</bdi>` with `truncate`

**Why.** In this codebase the surah-name treatment IS the mushaf face — Quran.tsx:1230 renders the heading as `className="quran-surah-heading quran-script arabic-text"` with `.quran-surah-title` inside, and `.quran-script` (src/index.css:754) resolves to `'KFGQPC Uthmanic Script HAFS'`. So the instruction reads "use X, never X". An implementer resolving it the obvious way reaches for `.quran-script` and puts the KFGQPC face into persistent chrome; §4.3 then applies `truncate` to it, ellipsis-clipping text set in the Complex's face. Resolving it the other way silently substitutes a display face for a name the app sets in KFGQPC everywhere else. §4.3 does not name a face for `surahNameArabic` at all, so the dock inherits the same ambiguity.

**Fix.** Name the face explicitly in both blocks: `surahNameArabic` renders in the app's Arabic UI face (`Plex Arabic`, i.e. the default `arabic-text` treatment) — never `.quran-script`, never `font-mushaf`. State the rule once: the KFGQPC faces are reachable only from inside `.quran-reading-surface`; no chrome block may apply `.quran-script`. Add it to the §10.6 token lint as a grep for `quran-script` across the seven chrome files — zero hits.

### INV-4 (word-sync tick is the only per-frame reader of the media clock); Manhaj 11 (do not touch word timings)

**Where.** §5.1 reciter branch: "The ayah *number* may appear only when `identity.synced === true`, as `<bdi dir="ltr">{surahId}:{ayah}</bdi>`"

**Why.** There is no legal source for `{ayah}`. `activeAyah` is `useState` local to `useWordSync` inside Quran.tsx (:494, returned at :601) and never leaves that component. PlayerExpanded is the `/player` route, so `/quran` is unmounted and the hook's cleanup (Quran.tsx:593-598) has already torn the tick down and hidden the cue. Producing a live ayah number there requires either a second `requestAnimationFrame` reader of `audioElementHolder.current.currentTime` — which INV-4 names as forbidden, "the word-sync tick stays the only per-frame reader" — or lifting the timing engine into a shared store, which is the Quran timing layer that constraint 11 puts off limits. The spec asserts the feature without resolving either.

**Fix.** Drop the ayah readout from PlayerExpanded. If it must stay, respecify it as non-live: the last ayah observed while `/quran` was mounted, published once per ayah change from the existing `setActiveAyah` call site into `mediaStore` (a state write already happening, no new clock reader), and labelled as a last-known position rather than a playhead.

### Manhaj 5 (Hafs/Warsh never mixed — in a view or a component)

**Where.** §6.5.4: recitation results are "legal in both riwayat" and claim `{lane:'reciter', synced:false}` with `ReciterIdentity.riwayah: 'hafs'`; plus §5.1's "Open in the mushaf" action

**Why.** §6.1 sources the surah corpus from `get_quran_surahs { riwayah }`, so under Warsh the palette builds the recitation result from Warsh surah records (whose `totalVerses` differ) and stuffs them into a `ReciterIdentity` whose literal `riwayah: 'hafs'` exists — per the spec's own comment — to make "dock a Warsh recitation" unrepresentable. The type therefore lies about its own provenance. §5.1 then completes the mix: "Open in the mushaf" navigates to /quran and calls `openSurah` under whatever riwayah is active, putting Warsh text on screen with Hafs audio playing. The existing app has a narrower version of this at Quran.tsx:1494, but it is reached only from inside the Quran page; a global palette widens it to every route.

**Fix.** Build recitation results from a Hafs-canonical surah list held separately from `useQuranStore.surahs`, so the identity's `riwayah: 'hafs'` is true of its data as well as its audio. Suppress "Open in the mushaf" whenever `useQuranStore.riwayah !== identity.riwayah`; do not offer it and then diverge.

### Spec-internal contradiction with downstream geometry (INV-5 dock geometry, §8.5 focus containment)

**Where.** §0.2 places `<div id="overlay-root" />` as a child of `.app-container`, after `PlayerDocked`; §0.3 states it is "positioned `absolute; inset: 0;` **inside the row that holds `#app-shell`** — not inside `.app-container`"

**Why.** The two sections put the element in different boxes and every dependent offset is wrong under one of them. Under §0.2, `inset: 0` on a child of `.app-container` covers the TitleBar — defeating the entire stated purpose of §0.3 (window stays draggable and closable during a dialog, the ReminderAlarm.tsx:215 trap). Under §0.3, the overlay box ends at the top of the dock, so §7.4's `bottom: calc(var(--dock-h) + 12px)` double-counts the dock and floats the toast 64px too high, §8.4's `height: calc(100% - var(--dock-h))` double-subtracts it, and §8.5's requirement that the sheet's inerted background "includes PlayerDocked, so a sheet cannot be scrubbed behind" becomes unachievable because the scrim cannot reach the dock.

**Fix.** One box, stated once: `#overlay-root` is a child of `.app-container` with `position: absolute; inset-inline: 0; top: var(--titlebar-h); bottom: 0;` — below the title bar, over the dock. Then delete `var(--dock-h)` from §7.4's `bottom` (use a flat `12px`) and from §8.4's `height` (use `100%`).

### Perf budget: "NO filter:blur() on a large animated element"; "idle CPU at Tier 3 < 3%"

**Where.** §2.1 item 3: `.app-sidebar` gains `background: rgb(var(--bg-sidebar-rgb) / 0.72); backdrop-filter: blur(20px) saturate(1.2)` under `data-surface-profile='cool'`, `/0.82` + `blur(14px)` under `warm`

**Why.** The budget bans a blur on a large animated element; moving the blur to the backdrop side does not change the cost, it changes who pays it. A 240px × full-height `backdrop-filter` is permanent chrome that never closes, and what sits behind it at `--z-ground` is the AmbientLayer, which at Tier 2 drifts and at Tier 3 runs a canvas at 30fps. Every ambient frame forces a re-sample and re-blur of the sidebar's backdrop for the life of the session. Six of the ten themes take `cool` or `warm` under §1.3's map, so this is the default, not an edge case. §4.1 correctly refuses `backdrop-filter` on the dock for exactly this reason ("a per-frame readback of the decoded frame") and then does not apply the reasoning to the larger, always-present surface. `.surface-3`'s existing `blur(22px) saturate(1.35)` on a 380px full-height sheet compounds it.

**Fix.** Couple the sidebar's material to the resolved ambient tier, not to the surface profile: glass only when `tier <= 1` (static or flat ground, nothing to re-sample); at tier >= 2 the sidebar is opaque `--fill-2`. Replace the qualitative claim with a measured gate in §10: idle CPU with Tier 3 ambient + cool profile + dock playing, sampled over 60s, asserted under 3%.

### Qur'an word-sync engine must not be disturbed; ambient/per-frame work must pause during video playback

**Where.** §3.1 INV-2/INV-3 + §3.3: `radioStore.suspend()` "keeps `current` and clears `playing`", so "`syncActive` can be true while paused"

**Why.** `useWordSync`'s `tick` re-arms `requestAnimationFrame(tick)` unconditionally at Quran.tsx:596 — the `element && !element.paused` guard skips the work, not the loop. The loop is torn down only by the effect cleanup, which is keyed on `syncActive`. Today, playing anything else replaces `radioStore.current`, `syncActive` goes false by id inequality, and the frame is cancelled. Under §3.3 `reciter → video` calls `suspend()`, which deliberately preserves `current` — so `syncActive` stays true and, whenever the user sits on `/quran` with a lecture in the dock, a 60Hz rAF callback runs for the entire lecture alongside video decode. The spec introduces this and does not notice it.

**Fix.** Gate the effect on `syncPlaying` (already defined at Quran.tsx:894) rather than `syncActive`, or have `tick` return without re-arming when `element.paused` and restart the loop from the element's `play` event. Add it to §10 test 2: assert zero pending animation frames from `useWordSync` while `mediaStore.lane === 'video'`.

### backdrop-filter used only on transient surfaces and not over playing video

**Where.** §7.5 "`.surface-3` + `rounded-lg`" for toasts, combined with §7.2 "Errors never auto-dismiss (`durationMs: 0`)"

**Why.** `.surface-3` carries `backdrop-filter: blur(22px) saturate(1.35)` (index.css:1929-1931). An error toast is sticky by design, up to 3 are visible, and they are anchored just above the dock — directly over `MediaStage`'s fixed video layer at `--z-stage: 25`. That is up to three permanent per-frame backdrop readbacks of a decoding video: precisely the cost §4.1 refuses for the dock, reintroduced with a longer lifetime. §10 test 7 explicitly whitelists `.surface-3`, so the test passes while the regression exists. The same argument applies to §8.4's SheetSettings: a 380px x full-window-height `.surface-3` panel stacked on top of its own `backdrop-blur-sm` scrim is two full-height backdrop filters, which is "large anchored content" by the audit's own criterion.

**Fix.** Toasts use `.surface-2` (opaque) — they are small, tone-edged and already legible. Restrict `.surface-3` to genuinely transient, short-lived overlays (CommandPalette, PlaylistMenu). For the sheet, drop the scrim blur and keep only the panel's, or make the panel opaque. Rewrite §10 test 7 to assert *no* backdrop-filter is live while `mediaStore.lane === 'video' && state === 'playing'`, rather than whitelisting a class.

### No per-frame / high-frequency work touching React state; no layout thrash next to the word-sync rAF

**Where.** §3.5 `MediaTransport.positionSec` on the returned object, and §4.2 `SeekBarProps { positionSec, durationSec }` passed as props

**Why.** `useMediaTransport()` returns `positionSec`, so every `timeupdate` (~4Hz) re-renders the whole `PlayerDocked` subtree — permanently, app-wide, on every route including `/quran`. `playerStore.onTimeUpdate` (playerStore.ts:434-441) already throttles the *store write* to 250ms, so the store side is correct; the defect is the fan-out. Four React commits per second on the same main thread that the word-sync rAF is using for `getBoundingClientRect()` interleaves style/layout invalidation with forced synchronous layout. The spec even defines `mediaClock` as "a non-reactive clock mirror … read by anything that needs the playhead without a subscription" and then does not use it for the one consumer that needs it.

**Fix.** Split the hook: `useMediaTransport()` without the clock (identity, state, actions), plus a `useMediaPosition()` consumed only inside `SeekBar`. Better still, have `SeekBar` subscribe non-reactively to `mediaClock` and write `--fill` and the time label through refs — `.range-quiet` already takes its fill from a CSS variable (index.css:1296-1316), so no React state is needed at all.

### No layout thrash from measuring in a loop; fixed overlay must be clipped

**Where.** §3.6: "A `ResizeObserver` on the target plus a `window.resize` listener writes `left/top/width/height` directly to `layer.style`"

**Why.** Three problems. (a) `ResizeObserver` does not fire when a target *moves* without changing size, and `window.resize` does not cover it either — so scrolling `PlayerExpanded` detaches the video from its placeholder entirely, with no notification. (b) When RO *does* fire it fires every frame: §5.1's `forceCollapsed` animates the sidebar 240→64px, changing the target's width each frame, so each frame is a `getBoundingClientRect()` read followed immediately by an inline style write on a `position: fixed` layer — read-write-read thrash stacked on top of the sidebar's own per-frame relayout (see the width finding). (c) A `fixed` layer at `z-stage: 25` is clipped by nothing: `<main>`'s `overflow: hidden` (AppShell.tsx:12) does not contain it, and `.app-sidebar` has `z-index: auto`, so on any stale frame the video paints *over* the sidebar.

**Fix.** Add a capture-phase `scroll` listener; batch read-then-write inside a single rAF (read all rects, then write all styles); and give the layer a `clip-path: inset()` derived from the target's intersection with `#app-shell` so it can never spill over the sidebar, the dock or the title bar. Assert in the harness that the stage layer's rect is contained by `#app-shell`'s rect after a sidebar collapse and after a scroll.

### Asserted but not measured — the load-bearing justification for the docked-video design

**Where.** §3.6: "A hidden `<video>` keeps playing audio and Chromium skips the video decode, which is a battery win while listening"

**Why.** Chromium's background-video optimisation keys on *frame/page* visibility (`WebMediaPlayerImpl::UpdateBackgroundVideoOptimizationState`), not on an element's computed `display`. In a visible WebView2 window a `display: none` `<video>` will keep decoding frames. This claim is the entire justification for keeping video in a hidden fixed layer rather than pausing it, so it cannot be left as an assertion.

**Fix.** Measure before building on it: on Windows, `msedgewebview2.exe` renderer + GPU process CPU% (Task Manager → Details) and `chrome://media-internals` in the WebView2 devtools, with a 1080p local file docked vs expanded, over 60s. If decode does not stop, either drop the claim from the spec or change the mechanism (route audio through the `<audio>` element and genuinely pause the `<video>`).

### API feasibility — Tauri invoke has no cancellation

**Where.** §6.6 `CommandRegistry.searchRemote: (query: string, signal: AbortSignal) => Promise<CommandItem[]>`

**Why.** `@tauri-apps/api@2.10.1` defines `InvokeOptions` as `{ headers: HeadersInit }` and nothing else (node_modules/@tauri-apps/api/core.d.ts:109-111). There is no `signal`. The IPC round trip and the SQLite `LIKE` scan (`src-tauri/src/db/video.rs:185`) always run to completion; an `AbortSignal` can only cause the *result* to be discarded. A signature that implies cancellation will be read as backpressure that does not exist, and a fast typist's in-flight queries all land.

**Fix.** Keep the parameter but document it as discard-only, and implement supersession with the request-id pattern the codebase already uses (`stationsRequestId` in `radioStore.ts:78-85`). Debounce at 200ms so the number of in-flight queries is bounded regardless.

### Keymap correctness — punctuation combos and the Alt rule contradict themselves

**Where.** §0.5 combo examples `'Shift+/'`; §4.5 `Ctrl+Shift+.`; §1.5 "`useGlobalKeymap` never calls `preventDefault` on `Alt`- or `Meta`-modified events" vs §2.4 `Alt+1`…`Alt+8`

**Why.** For `Shift+/` and `Ctrl+Shift+.`, `KeyboardEvent.key` is `'?'` and `'>'` — Shift has already transformed the character — so a `key`-based matcher never matches either binding and both are silently dead. Separately, §2.4 registers `Alt+1`…`Alt+8` for nav jumps, which are useless without `preventDefault`, while §1.5 forbids `preventDefault` on any Alt-modified event. The two sections cannot both hold. (`Alt+1..8` are not OS-reserved on Windows; `Alt+F4`, `Alt+Tab` and `Alt+Space` are.)

**Fix.** Match punctuation on `event.code` (`Slash`, `Period`) and letters/digits on `event.key`; state which in the normalisation rule. Narrow §1.5 to "never `preventDefault` on Meta-modified events, nor on `Alt+F4`/`Alt+Tab`/`Alt+Space`".

### Ancestor containing-block hazard around .quran-reading-surface is under-specified

**Where.** §5.3 "Hard boundary: no `view-transition-name` and no view transition may be applied to `src/pages/Quran.tsx`, `.quran-reading-surface`, `.quran-reading-viewport` or `.quran-reading-frame`"

**Why.** `positionWordCue` resolves its container as `cue.offsetParent` (Quran.tsx:459), not by querying `.quran-reading-surface`. `offsetParent` walks *positioned* ancestors, but the actual containing block for an absolutely-positioned element is also established by any ancestor carrying `filter`, `backdrop-filter`, `transform`, `perspective`, `contain: paint/layout`, `content-visibility` or `will-change: transform`. Those two chains diverge in Chromium: the cue would be laid out against the transformed ancestor while `containerRect` still measures the surface, silently offsetting the cue by that ancestor's origin. §5.3 forbids only `view-transition-name`, and this spec is adding `backdrop-filter` to chrome in three places.

**Fix.** Widen the boundary to the full list above for every ancestor of `.quran-reading-surface` up to `<html>`, and make §10 test 7 walk `parentElement` from the surface to the root asserting all of them absent — not just `backdrop-filter`. Independently, harden the site: resolve the container as `cue.closest('.quran-reading-surface')` so the two chains cannot diverge.

### Disabled control has no visual state in the shipped token

**Where.** §4.5: the seek input "is `disabled` rather than hidden so the layout does not shift"

**Why.** `.range-quiet` (index.css:1296-1325) paints its own fill from `--fill` and ships no `:disabled` rule. A disabled live-radio seek bar therefore renders as a full-width gold-track at 0% — pixel-identical to an enabled, seekable bar sitting at position 0. Users will drag it. This is exactly the class of bug the audit notes appears in one theme or one direction and survives eyeballing.

**Fix.** Add `.range-quiet:disabled { opacity: 0.35; cursor: default; }` and hide the thumb, or reserve the space with a `visibility: hidden` wrapper. Add it to the 10-theme sweep checklist for the radio lane.

### Arabic line-height / clipped tashkeel — Tailwind text-* re-pins a Latin leading on the exact element types the chrome uses

**Where.** §4.3 Line 1/Line 2 (`text-sm font-medium` + `truncate`), §4.4 caption `text-xs`, §6.7 rows, §7.5 body `text-sm` / detail `text-xs`, §2.3 rail labels

**Why.** The existing restoration rule at src/index.css:626-633 covers only `p, h1, h2, h3, label, li`. Every string in the seven chrome blocks lives in a `<span>`, `<div>`, `<button>` or `<a>`, none of which it reaches. `tailwind.config.js:60-61` pins `text-sm → 1.5` and `text-xs → 1.45`, well under the `--lh-arabic: 1.85` the app declares at index.css:429. `truncate` then adds `overflow: hidden`, so Arabic marks are not merely tight — they are cut. Sidebar.tsx:132-133 already ships this bug (`truncate text-[11px]`, `truncate text-[10px]`); the spec propagates it into the dock title, the palette row, and the toast body without noticing.

**Fix.** Extend the `html[data-language='ar']` restoration to the element types actually used — add a `.ui-text` utility (or extend the selector list to `span, div, button, a, td, dt, dd`) setting `line-height: var(--lh-arabic)` — and forbid `truncate` on any element whose content can be Arabic; use `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-block: 1px` with the Arabic leading intact, or clamp by `max-inline-size` instead. Add a §10 gate that renders the dock with an Arabic station name and asserts `scrollHeight <= clientHeight` on the title element under `data-language='ar'`.

### No Arabic text below 12px (dots and diacritics stop resolving)

**Where.** §2.3 group label `text-[10px] uppercase tracking-[0.14em]`; §6.7 kbd hints `text-[10px]`; §4.4 time labels `text-[10px]`; §4.4 caption and §7.5 detail at `text-xs`

**Why.** `--fs-cap: 11.5px` (index.css:421), so `text-xs` is already under the 12px floor before any `text-[10px]` is written. §2.3's group labels and §6.7's group headers are translated strings — in Arabic they render Arabic script at 10px, where the i'jām dots on ب/ت/ث/ن and the tashkeel stop resolving. The time labels at 10px are digits only and are fine; the eyebrows and any kbd hint containing a translated word are not. §2.3 also applies `uppercase`, which the brief lists as forbidden on translated strings — it is a no-op in Arabic but it signals the eyebrow was designed as Latin-only.

**Fix.** Declare a hard floor: `html[data-language='ar'] { --fs-cap: 12.5px }` plus an explicit rule raising any `text-[10px]` chrome label to ≥12px under Arabic. Drop `uppercase` from the eyebrow and carry the hierarchy on weight and colour, which §6.9 already argues for on the letter-spacing grounds. Add a §10 gate: under `data-language='ar'`, assert no element containing Arabic codepoints has a computed `font-size < 12px`.

### WCAG AA contrast (4.5:1 body) — `text-text-faint` fails in every theme and the spec has no contrast gate

**Where.** §1.1 defect #4 (blurred glyphs → `text-text-faint`); §2.3 group label; §6.7 Search glyph and kbd hints; §10 verification list

**Why.** Measured from the theme seeds in src/index.css: Pearl `--text-faint-rgb: 122 137 151` on `--bg-main-rgb: 243 246 247` = 3.31:1. Noor `83 96 120` on `3 4 4` = 3.24:1. Onyx `96 93 84` on `2 2 3` = 3.15:1. All fail the 4.5:1 body threshold, and all of these uses are small text (10-11.5px), so the 3:1 large-text allowance does not apply. `--text-muted-rgb` by contrast measures 5.17:1 on Pearl and is safe. Separately, §10 lists eight automated gates — token lint, backdrop-filter audit, animation audit, cue-anchor, riwayah — and not one contrast, focus-visibility or tab-order assertion, despite the brief naming WCAG AA across ten themes as a requirement.

**Fix.** Restrict `text-text-faint` to non-text ornament (hairlines, disabled glyph fills) and use `text-muted-text` for every legible small label — kbd hints, group eyebrows, the Search glyph, the blurred-titlebar state. Add a §10 automated gate that walks the rendered chrome in all ten themes and asserts computed foreground/background contrast ≥4.5:1 for `font-size < 18.66px` and ≥3:1 above, and ≥3:1 for focus rings and selection markers (WCAG 1.4.11).

### ARIA listbox structure — non-option children inside role="listbox"

**Where.** §6.7 "Group headers: the SectionHeader primitive at size=\"eyebrow\" with .rule-head"; §6.8 "rows are role=\"option\" inside role=\"listbox\""

**Why.** `role="listbox"` permits only `option`, `group`, and presentational children. Interleaving seven SectionHeader elements as direct children makes the whole structure invalid; NVDA and Narrator on Windows either drop the headers or drop the option count, and `aria-activedescendant` navigation across a malformed listbox is unreliable. The combobox side is also under-specified: §6.8 gives `role="combobox"` + `aria-activedescendant` but never `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, or `aria-selected="true"` on the active option — all four are required by the ARIA 1.2 combobox pattern.

**Fix.** Wrap each group in `role="group" aria-labelledby="<headerId>"` and render the SectionHeader inside it with `role="presentation"` (its text still names the group via aria-labelledby). On the input: `role="combobox" aria-expanded aria-controls={listboxId} aria-autocomplete="list" aria-activedescendant`. On the active row: `aria-selected="true"`. Specify that changing selection calls `scrollIntoView({ block: 'nearest' })` on the active row — with aria-activedescendant, DOM focus never moves, so nothing scrolls the list by default and arrowing past row 5 currently moves the highlight off-screen.

### Virtualized list semantics (brief: "Are list semantics correct for a virtualized list?")

**Where.** §6.4 point 4 — "Expanding past 200 rows switches that group to @tanstack/react-virtual"

**Why.** A virtualized listbox renders a window of options, so the accessibility tree reports "option 3 of 12" when there are 800. `aria-setsize` and `aria-posinset` are the only fix and the spec never mentions them. The same applies to Radio.tsx's 175 unvirtualized rows once they are virtualized, which §6.4 explicitly scopes. There is also no statement about what the virtualizer's spacer divs are — an untagged sizing div inside a listbox is another invalid child.

**Fix.** Require `aria-setsize={group.total}` and `aria-posinset={index + 1}` on every rendered option in any virtualized group, and `role="presentation"` on the virtualizer's spacer/inner elements. Add a §10 gate: expand a group past 200, assert `aria-setsize` equals the group total on the first and last rendered option.

### Command palette does not announce results (brief asks this directly)

**Where.** §6.4 — per-group loading, late remote arrival, `Stations unavailable — Retry` row; §6.8 keyboard table

**Why.** `aria-activedescendant` announces the one active row and nothing else. Nothing announces the result count on typing, nothing announces "no results", nothing announces the Library group appearing 100-300ms later (§6.4's whole premise), and nothing announces the Stations failure row. A screen-reader user typing a query hears silence and then, on ArrowDown, a single row with no sense of how many there are. §6.4's careful anti-jump rules protect sighted users only.

**Fix.** Add a visually hidden `role="status" aria-live="polite" aria-atomic="true"` region inside the panel, debounced ~250ms, announcing a localized "N results" / "no results" / "Library results added" / "Stations unavailable". Keep it separate from the listbox so it is not a listbox child. Specify the strings as TranslationKeys.

### Toast live regions attached to dynamically inserted nodes

**Where.** §7.6 — "role=\"status\" aria-live=\"polite\" for success/info; role=\"alert\" aria-live=\"assertive\" for error"

**Why.** The roles are placed on the toast elements themselves, which are inserted into the DOM at the same moment their text appears. Screen readers only reliably announce mutations to a live region that was already present and monitored; a region created together with its content is frequently missed entirely on Windows/NVDA. This is the single most common reason toast systems ship silent. Secondarily, `role="alert"` is not a container role for interactive content, and §7.2 allows an `action` button plus a dismiss button inside it — those get re-announced on any re-render of the assertive region.

**Fix.** Mount two permanently-present, empty, visually hidden regions in `#overlay-root` at app start — one `aria-live="polite"`, one `aria-live="assertive"` — and have `push()` write the message text into the matching one. Render the visible toast card with no live role at all, keeping it a plain focusable region reachable by F6 (§7.6). Also raise the success default from 4000ms: a message removed before the polite queue drains is cut mid-announcement; 6000ms is the safe floor.

### WCAG 2.1.4 Character Key Shortcuts (Level A) — single-key bindings active route-wide

**Where.** §5.4 — "Inherits every dock binding without the Ctrl prefix … `Space`, `ArrowLeft`/`ArrowRight`, `ArrowUp`/`ArrowDown`, `M`, `N`, `P`, `R`, `F`, `Escape`"

**Why.** WCAG 2.1.4 requires that single-character shortcuts be turn-off-able, remappable, or active only while the relevant component has focus. §5.4 registers them at scope `stage`, which §0.5 defines as active for the whole route, not gated on focus. The §0.5 typing guard covers form fields but not speech-input users and not users of switch/dwell input, who are the population the criterion exists for. This is a Level A failure, the only one in the spec.

**Fix.** Gate the unprefixed bindings on `stageContainerRef.current.contains(document.activeElement)` — the "active only on focus" exception — and give the stage container `tabIndex={0}` with an `aria-label` so it is reachable. Keep the `Ctrl`-prefixed dock bindings global as specified; modified combos are outside 2.1.4.

### §0.5 Space guard — binding Space at `document.body` with preventDefault removes page scrolling

**Where.** §0.5 guard 2: "`Space` is only bound when the active element is `document.body` or lives inside PlayerDocked's transport group"; §4.5 `Space` row

**Why.** `document.body` is the active element for the majority of the app's lifetime — any time the user has scrolled a list without focusing a control. `KeyBinding.preventDefault` defaults to true, so the binding both toggles playback and kills the browser's Space/Shift+Space page scroll, which is a primary keyboard scrolling mechanism. A user reading a long Library or Radio list presses Space to page down and instead pauses a lecture.

**Fix.** Drop `document.body` from the Space guard: bind Space only when focus is inside PlayerDocked or the PlayerExpanded stage. For a global "toggle playback anywhere" affordance use `Ctrl+Space` or `K` (with the 2.1.4 gating above), not bare Space. Note this explicitly in the KeyBinding doc comment so it is not re-derived.

### Range inputs need aria-valuetext; mute needs a state-carrying name

**Where.** §4.2 SeekBarProps (has `ariaLabel`, no valuetext), VolumeControlProps (`muted`, `onToggleMute`, no labels)

**Why.** An `<input type="range">` whose value is seconds is announced by NVDA/Narrator as the raw number — "one hundred and fifty" — with no unit and no total. The volume slider is announced as "0.4". Both are unusable without `aria-valuetext`, and both strings must be localized: an Arabic user needs "٢:٣٠ من ١٠:٠٠" ordering handled, which is precisely the `formatDuration` U+2067 territory the brief flags. The mute button's accessible name must alternate Mute/Unmute; a static name plus `aria-pressed` is defensible but the spec specifies neither.

**Fix.** Add `ariaValueText: (positionSec, durationSec) => string` to SeekBarProps and `ariaValueText: (volume) => string` plus `labels: { mute, unmute }` to VolumeControlProps, resolved from TranslationKeys. Reuse `formatDuration`'s isolate discipline (U+2067 for Arabic) rather than re-implementing it — §4.7 already warns against double-wrapping, and aria-valuetext is a third place that mistake can land.

### INV-6 covers only --dock-h; the sidebar rail transition also moves .quran-reading-surface

**Where.** §3.1 INV-6; §2.3 "Width transition: `width var(--dur-normal) var(--ease-standard)`"

**Why.** §3.1 correctly identifies that any chrome change to the reading surface's geometry desynchronises the word cue, and mandates a `salafi:layout-reflow` dispatch on `--dock-h` writes. Collapsing the sidebar from 240px to 64px changes `.quran-reading-surface`'s inline position by 176px, over `--dur-normal`, and dispatches nothing. Quran.tsx:584 only re-anchors every 30 frames, so a `Ctrl+B` during recitation leaves the cue up to ~500ms and 176px off the spoken word — the exact failure INV-6 exists to prevent, through a door it left open. Animating `width` is also a layout-thrashing property, reflowing `<main>` every frame.

**Fix.** Extend INV-6 to "any write that changes the geometry of `<main>`" and name the two writers explicitly: `--dock-h` and the sidebar rail toggle. Dispatch `salafi:layout-reflow` on the sidebar's `transitionend` *and* on each frame of the transition (or skip the animation entirely — set the width instantly — whenever `/quran` is mounted with `syncPlaying`). Add the sidebar case to §10 gate 4 alongside the dock collapse.

### aria-modal + focus trap contradict §0.3's and §8.5's "the window stays operable" claim

**Where.** §0.3 rationale; §8.5 "Because the sheet does not `inert` the TitleBar, the window stays draggable and closable while it is open"; §8.5 `aria-modal="true"`

**Why.** Two separate failures of the same claim. (a) `aria-modal="true"` instructs assistive technology to hide everything outside the dialog — including the un-inerted TitleBar. For a screen-reader user the window controls vanish exactly as if they had been inerted. (b) `useFocusTrap` cycles Tab within the container, so for any keyboard user the three window buttons are unreachable while the palette or sheet is open. Alt+F4 still closes at OS level, but minimize and maximize become mouse-only. The section's stated purpose — that the user can always drag, minimise, maximise and close — holds only for pointer users.

**Fix.** Either scope the trap's tabbable set to `container ∪ TitleBar` and drop `aria-modal` in favour of `inert` alone (which §0.4 already prefers, and which the AT tree honours without the aria-modal side effect), or restate the guarantee honestly as pointer-only plus Alt+F4 and add explicit `Ctrl+Shift+M`-style bindings for minimize/restore registered at scope `overlay`.

### §0.5 typing guard selector is too broad — `input` matches checkbox, radio, range, and button

**Where.** §0.5 guard 1: "Ignore when `event.target` matches `input, textarea, select, [contenteditable=\"\"], [contenteditable=\"true\"]`"

**Why.** `input` matches every input type. With focus on the `.range-quiet` seek bar or on any settings checkbox, every global shortcut — `Ctrl+K`, `Ctrl+B`, `Ctrl+,`, `Alt+1`…`Alt+8` — is silently dead. The guard's purpose is to protect text entry, not to disable the app whenever a checkbox has focus. It also misses `role="textbox"` and `role="searchbox"` and, for a WebView2 target, does not use `event.composedPath()[0]`, so a target inside a shadow root reports as the host.

**Fix.** Narrow to text-entry: `textarea, select, [contenteditable=''], [contenteditable='true'], [role='textbox'], [role='searchbox'], input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=color])`. Resolve the target via `event.composedPath()[0] ?? event.target`. Keep a separate, narrower rule for `Space` (see the Space finding) since Space *is* meaningful on a checkbox.

### §6.3 normaliseArabic is incomplete for the corpus and for §6.5's own promise

**Where.** §6.3 — "Strips tashkīl (U+064B–U+0652, U+0670), tatweel (U+0640), and folds أ إ آ ٱ → ا, ى → ي, ؤ → و, ئ → ي"

**Why.** Two concrete gaps. (a) Taa marbuta ة is not folded to ه, so a user typing الفاتحه — the overwhelmingly common informal spelling — matches nothing against الفاتحة. Every surah name ending in ة (الفاتحة، البقرة، المائدة، التوبة، القيامة) is affected, which is a large fraction of a 114-item corpus. (b) Arabic-Indic digits are not folded, yet §6.5 point 3 explicitly promises that `٢:٢٥٥` is a recognised ayah reference. As written, an Arabic-keyboard user typing ٢:٢٥٥ gets nothing, because the reference parser sees no ASCII digits. Extended Arabic-Indic ۰-۹ (U+06F0–U+06F9) reaches the app too via pasted text.

**Fix.** Add to the fold table: ة → ه, and U+0660–U+0669 and U+06F0–U+06F9 → ASCII 0-9. Also strip bidi control characters (U+200E, U+200F, U+2066–U+2069) from pasted queries — `formatDuration` output pasted back into the palette would otherwise never match. Unit-test each fold; §6.2 already establishes rank.ts as pure and testable, so this belongs beside it.

### Riwayah tagging of the palette recents key (constraint 5: never mixed "in a view, component, cache key or localStorage key")

**Where.** §6.5 point 6 — `localStorage['salafi-hub.palette-recent.v1']` storing `{ kind:'surah', surahId, riwayah }` and filtering on read

**Why.** §6.5 point 2 correctly keys the surah index as `surah-index:${riwayah}`, then point 6 stores both riwayat in one localStorage key with a discriminator field and relies on a runtime read filter. The manhaj rule names localStorage keys specifically. Filter-on-read is one forgotten call site away from surfacing a Warsh position under Hafs, and the spec's own §10 gate 5 tests only the read path, not the storage shape — so a future direct read of the key passes the gate and still mixes.

**Fix.** Split the key: `salafi-hub.palette-recent.hafs.v1` and `salafi-hub.palette-recent.warsh.v1`, selected by the active riwayah at read and write. Then the entry needs no `riwayah` field and no filter, and mixing becomes unrepresentable rather than merely checked. Update §10 gate 5 to assert that the inactive riwayah's key is never read.

### WCAG 1.4.13 Content on Hover or Focus — rail tooltips

**Where.** §2.3 Rail row — "icon centred; label in a delayed tooltip (400ms)"

**Why.** The tooltip is specified as the sole visible carrier of the label in the rail, and only a hover trigger is described. 1.4.13 requires such content to be dismissible (Escape without moving the pointer), hoverable (the pointer can move onto it), and persistent. It must also appear on keyboard focus — a sighted keyboard user arrowing the rail with roving focus (§2.4) sees ten unlabeled icons. §2.4's `aria-label` solves the screen-reader case only.

**Fix.** Specify: the tooltip shows on `:hover` and on `:focus-visible`, dismisses on `Escape` without moving focus, remains while the pointer is over it, and is `aria-hidden` (already stated) with the name carried by `aria-label`. Add the 400ms delay to focus as 0ms — a keyboard user has already committed.

### Arrow-key conflict between TransportGroup roving focus and PlayerExpanded seek

**Where.** §4.5 "Inside the transport group, `ArrowLeft`/`ArrowRight` move roving focus between buttons"; §5.4 "`ArrowLeft`/`ArrowRight` (±10s)"

**Why.** In PlayerExpanded both rules are live and both apply to the same keys. With focus on a transport button — the most likely state after tabbing into the controls — it is undefined whether ArrowRight moves to the next button or seeks forward ten seconds. Whichever wins, the other becomes unreachable by keyboard.

**Fix.** State the precedence explicitly: when focus is inside the transport group, arrows are roving focus (APG toolbar) and seek is unavailable; when focus is on the stage container or the seek input, arrows seek. Document that this is why the stage container must be focusable (see the 2.1.4 finding). Add the resolved table to §5.4 rather than leaving it as an inheritance.

### Theme swatch grid has no roles and no accessible names

**Where.** §8.1 item 1 "all ten, as a 5×2 swatch grid"; §8.4 swatch styling; §8.5 "2D roving focus (5 columns × 2 rows)"

**Why.** §8.5 specifies 2D roving focus, Enter/Space to apply, and initial focus on the current theme's swatch — all of which imply a single-select widget — but assigns no role and no name. Rendered as bare buttons showing three colour bands, a screen reader announces ten unnamed buttons with no indication of which is current. §8.4 further rejects a check overlay, so the selected state is carried purely by a border and a 3px marker, which must itself meet 3:1 non-text contrast (WCAG 1.4.11) against both the adjacent swatch colour and the panel — unverified in any of the ten themes.

**Fix.** Use `role="radiogroup"` with `aria-labelledby` on the section header, `role="radio"` + `aria-checked` + `aria-label={t(themeNameKey)}` per swatch, roving tabindex as specified. Add the theme names to i18n (the swatch colour list in i18n.ts already enumerates the themes; extend it rather than adding a parallel table). Add the selection marker to the 3:1 non-text-contrast gate proposed in the contrast finding.

### Manhaj constraint 9 (ten themes recolour with zero per-theme code) + CLAUDE.md "sweep 5 themes x 2 languages"

**Where.** §1.1 deletion of `--accent-teal-rgb` and `--accent-emerald-rgb`; §10 index.css edit list

**Why.** Both seeds have live consumers the edit list does not cover. `src/index.css:735-737`:
  `html[dir='rtl'] .app-sidebar nav a[aria-current='page'] { box-shadow: inset -3px 0 0 rgb(var(--accent-teal-rgb) / 0.85); }`
and `src/index.css:2236-2239` `.gold-thread { background: linear-gradient(90deg, transparent, rgb(var(--accent-gold-rgb) / 0.5), rgb(var(--accent-emerald-rgb) / 0.24), transparent); }`.
Deleting the seeds drops both declarations. The first removes the sidebar's active-page marker **only in Arabic/RTL** — precisely the one-direction-only class of bug CLAUDE.md's two-language sweep exists to catch. None of §9.1 (rects), §9.2 (material tuple cardinality) or §9.4 (greps) detects a dropped `box-shadow`.

**Fix.** Covered by the alias in the previous finding; additionally repoint `:736` to `rgb(var(--accent-rgb) / 0.85)` and `:2238` to `--accent-2-rgb`, and add both selectors to the §9.1 harness sweep with a computed-`box-shadow`/`background-image` non-`none` assertion in ar and en.

### Manhaj constraint 2 (Qur'anic text never decoration, watermark, clipped, or behind a control)

**Where.** §4.2 pipeline step 1 and `scripts/audit-ambient.py`; ASSETS.md sign-off line

**Why.** The whole gate is scoped to constraint 1. Step 1 checks the crop rect against a single recorded `calligraphy` rectangle, and `audit-ambient.py` produces a contact sheet for a human to certify absence of animate beings. Nothing checks for **Qur'anic text** in the plate. Plate A is a stack of masahif and Plate C is a wall of bound Islamic volumes — gold-tooled spines, a framed ayah on the wall, or a visible open page all put Qur'anic text into a blurred, desaturated, level-compressed wallpaper that sits behind every control in the app, at build time and undetectably thereafter. The spec's own §4.1 correctly identifies the calligraphy band, then stops there — it treats the one violation the reviewer already knew about as the whole risk.

**Fix.** Generalise: replace the single `calligraphy` rect in ASSETS.md with a `rejected_regions` list, have step 1 fail on overlap with any of them, and rewrite the audit sheet's sign-off to certify two things by name — "no animate being at any legibility" AND "no Qur'anic text at any legibility" — with the reviewer's name and date recorded for both. Blur is not a remedy for either; the region must be cropped out of the source.

### Verification adequacy for the ambient hard rule + load-bearing invariant (positionWordCue)

**Where.** §9.3 — "assert that every element on the paint path between `.ambient-root` and `.quran-script` computes `opacity: 1` with a non-transparent `background-color`" and "assert `.ambient-root` is not an ancestor of `.quran-reading-frame`"

**Why.** Neither clause can fail. `.ambient-root` is a `position: fixed` first child of `.app-container` and `.quran-script` is inside `main` — they are siblings, so there are **no elements between them** and the first clause iterates an empty set and passes vacuously. That is why it does not catch the blocking finding above. "Non-transparent `background-color`" is also the wrong predicate: it would accept `--glass-a: 0.88`, and `.quran-reading-surface` uses a `background` *gradient* with `background-color: rgba(0,0,0,0)`, so a correct implementation would still read as transparent. The second clause is a tautology by construction and asserts nothing about `positionWordCue` — the real risk to that invariant is a new containing block or a new scroll container, not ancestry.

**Fix.** Rewrite as: walk `.quran-script`'s ancestor chain to `<html>` and assert at least one ancestor at or below `.quran-reading-frame` has a computed `background-color` with **alpha exactly 1**; separately assert `getComputedStyle('.quran-reading-surface')` gives `overflow: visible`, `border-width: 0px`, and that `.quran-reading-surface.offsetParent === .quran-reading-frame` (or whatever it is today) is unchanged from a baseline captured before the change.

### Perf — backdrop-filter on large anchored content, with no visible effect

**Where.** §2.3 `.surface-3` glass block and `html[data-video-playing] .app-sidebar { backdrop-filter: none }`, plus §2.1 profile axis `--glass-a / --glass-blur / --glass-sat` (cool = blur 26px, sat 1.42)

**Why.** Two problems. (1) `.app-sidebar` is 240px x full height — permanently visible anchored chrome, not a transient overlay — and at Tier 2 the ambient drifts *behind* it, so Chromium must re-read the backdrop and re-blur the sidebar region every single frame the ambient moves. The spec's "Tier 2 ... compositor-only, zero layout, zero paint" is true of the ambient element and false of everything with a backdrop-filter above it. (2) The blur is invisible anyway: `src/components/layout/Sidebar.tsx:51` sets the fill with `bg-[linear-gradient(180deg,var(--bg-sidebar)_0%,var(--bg-main)_100%)]` — a fully opaque background-image utility. Nothing shows through, so the per-frame readback buys nothing. Meanwhile `.surface-3`, the class that legitimately wants glass, is declared at `index.css:1921` and used **zero** times in any `.tsx` (`grep -ro "surface-3" src --include=*.tsx` returns 0). So the entire glass axis — one of the four axes whose cardinality §9.2 asserts — currently has no consumer at all.

**Fix.** Do not add backdrop-filter to `.app-sidebar`. Either give the sidebar a semi-transparent fill so the glass is real (and accept the per-frame cost, measured), or drop glass from the sidebar and let the profile's glass tokens apply only to genuinely transient surfaces (`PlayerExpanded`, `CommandPalette`, `SheetSettings`, `ToastStack`). Land a consumer for `.surface-3` in the same change or the token is untestable. Measurement: CDP tracing category `cc,viz`, 10s at Tier 2 on `/`, compare mean `PipelineReporter` duration with `--glass-blur: 0px` vs `26px`; also `Performance.getMetrics` delta on `LayoutDuration`/`RecalcStyleDuration`.

### Perf — universal !important transition on theme switch, whole-tree, non-compositable properties

**Where.** §6 `html[data-theme-switching] *:not(...) { transition: background-color, background-image, border-color, color, box-shadow ... !important }`

**Why.** This starts five transitions on every element in the document for 260 ms. Two of the five are among the most expensive properties to animate: `background-image` on a gradient re-rasterizes the gradient every frame for every element that has one (that is every `.surface-1/2/3` and every `--edge-*` border-box gradient), and `box-shadow` is a per-frame paint. The worst routes are exactly the ones Phase 0 already flagged: Radio has 175 unvirtualized rows at 6431px scrollHeight (`src/pages/Radio.tsx:218` maps every station, and `VIRTUAL_LIST_ITEM_HEIGHT`/`VIRTUAL_LIST_OVERSCAN` in `src/utils/constants.ts:56,58` are declared but referenced nowhere), and `/quran` renders one `<span class="quran-word">` per word (`Quran.tsx:604-619`) — thousands for a long surah. Applying a transition declaration to all of them is a full style recalc plus thousands of transition starts, and on `/quran` it lands inside the word-sync rAF loop, whose `positionWordCue` (`Quran.tsx:458-474`) calls `getBoundingClientRect()` on both the word and the container — a forced synchronous layout immediately after a whole-document style invalidation.

**Fix.** Scope the transition to the small set of elements that actually need to cross-fade: `.app-shell, .app-sidebar, main, .surface-1, .surface-2, .surface-3, .rule-head, .rule-row` — a class list, not `*`. Drop `background-image` from the property list (see the plate finding below) and drop `box-shadow`, or keep box-shadow only on the ladder classes. Measurement: `PerformanceObserver({type:'longtask'})` across the 260 ms window on `/radio` and `/quran` (Al-Baqarah loaded, audio playing) — assert zero tasks > 50 ms, and assert the word-sync rAF loop drops no more than one frame during the switch.

### Manhaj constraint 3 + spec self-contradiction — Qur'anic glyphs receive an animated colour transition

**Where.** §6 "**Qur'anic text and the Basmala are excluded by name**" — selector `*:not(.quran-script):not(.quran-flow):not(.quran-reading-surface):not(.hero-basmala):not(.hero-mark):not(.quran-jadwal)`

**Why.** `:not()` excludes only the elements that themselves carry those classes. It does not exclude their descendants. The ayah body is rendered as per-word `<span class="quran-word">` and `<span class="quran-ayah-text">` children inside the script container (`Quran.tsx:604-619`), and every one of them matches `*:not(.quran-script)...`. So each Qur'anic word gets `transition: color 260ms !important` and its colour animates on theme switch — a restyle-in-time, which is the exact category constraint 3 enumerates. The spec asserts the opposite in the same paragraph, so this will not be caught by review.

**Fix.** Change the guard to a descendant-aware exclusion: keep the `*` rule but add a resetting rule after it — `html[data-theme-switching] .quran-script, html[data-theme-switching] .quran-script *, html[data-theme-switching] .hero-basmala, html[data-theme-switching] .hero-basmala * { transition: none !important; }`. Better, combine with the scoping fix above so the universal selector disappears entirely. Add a harness assertion: during `data-theme-switching`, `getComputedStyle(document.querySelector('.quran-word')).transitionProperty === 'none'`.

### Feasibility — image-set() type() sets an unstated WebView2 floor, and the WebP fallback is inside the construct that requires it

**Where.** §4.2 "`image-set()` with `type()` is Chromium-native, so WebView2 picks AVIF and the WebP only fires on a pinned pre-85 runtime"

**Why.** `image-set()` with the `type()` function shipped in Chromium 113. AVIF decode shipped in 85. So on any runtime between 85 and 112 the whole `image-set(...)` value fails to parse and the entire `background-image` declaration is dropped — the WebP does not serve as a fallback, because it is nested inside the very syntax that is unsupported. There is no pre-113 path at all, which makes the ~236 KB of WebP files (half the §4.4 budget) dead weight. Separately, §2.3's `color-mix(in srgb, ...)` for `--surf-1/2/3` requires Chromium 111, and `--fill-1/2/3` are repointed at those, so a sub-111 runtime loses every surface fill. The app currently declares no WebView2 minimum (`tauri.conf.json` uses `downloadBootstrapper`, which installs Evergreen but does not stop a machine with a pinned fixed-version runtime). Autoprefixer 10.4.20 is in the PostCSS chain and may also emit a `-webkit-image-set(...)` copy, in which `type()` is invalid — verify the built CSS.

**Fix.** Drop the WebP derivatives entirely (saves ~236 KB, cutting §4.4 from 477 KB to ~241 KB) and use plain `background-image: url('...avif')` — one declaration, works from Chromium 85, no `type()` needed since only one format ships. State the WebView2 floor explicitly (≥ 111 for `color-mix`) in the release notes and add a one-line runtime guard that falls back to Tier 0 flat if `CSS.supports('color', 'color-mix(in srgb, red, blue)')` is false. Verify the emitted `dist/assets/*.css` after `npm run build` contains no `-webkit-image-set`.

### Perf — ten ThemePreviews put backdrop-filter inside a scaled subtree over an animating ambient

**Where.** §8.2 `.theme-preview-inner { transform: scale(0.5) }` + §8.3 "28 px sidebar rail, `.app-sidebar` glass" + "three `.surface-2` cards" + §8.4 "Ten previews are ten static DOM subtrees with no animation, no canvas and no rAF; the Settings route pays one layout for them and nothing thereafter."

**Why.** The "one layout and nothing thereafter" claim is false for two reasons. (1) backdrop-filter is not a layout cost, it is a per-composite cost: it re-reads and re-blurs its backdrop whenever anything behind it changes — and behind them, at Tier 2 on `/settings`, is the drifting ambient layer. Ten scaled preview subtrees each containing a glass sidebar rail and three glass-adjacent cards means up to ~10 extra backdrop readbacks per frame on the Settings route. (2) `transform: scale(0.5)` establishes a containing block and a new coordinate space; Chromium has long-standing correctness issues with backdrop-filter inside transformed subtrees (it samples the untransformed backdrop region), so the previews may blur the wrong pixels — which is a fidelity bug in the one surface whose entire job is to show the theme faithfully.

**Fix.** Force the previews to Tier 0/1 material: add `.theme-preview-inner [class*='surface-'], .theme-preview-inner .app-sidebar { backdrop-filter: none; -webkit-backdrop-filter: none; }` and give the preview root an opaque `background: rgb(var(--bg-main-rgb))` so it does not composite over the live ambient at all. Note this means glass is the one profile axis the preview cannot show — say so in §8.3 rather than implying all six vary visibly. Measurement: CDP tracing on `/settings` at Tier 2, 10s, compare frame time with and without the previews mounted; assert the delta is under 1 ms mean.

### Correctness — html[data-video-playing] has no unmount cleanup; a stuck attribute permanently caps ambient and kills glass

**Where.** §5.4 "`videoPlaying` is set from `VideoPlayer.tsx`'s `play`/`pause`/`ended` handlers and also stamps `html[data-video-playing]`"

**Why.** `src/components/player/VideoPlayer.tsx:391-400` wires `onPlaying`, `onPause` and `onEnded` as React element props. If the player unmounts while playing — navigating away from `/player`, closing the player, an unhandled error — the media element is torn down without emitting `pause`, so neither the store flag nor the DOM attribute is cleared. The result is a permanently-stuck `data-video-playing`: ambient clamped to Tier 1 forever and every backdrop-filter disabled for the rest of the session, with no user-visible cause. The store also becomes a second source of truth that can drift from the attribute.

**Fix.** Own the flag in a `useEffect` in VideoPlayer with a cleanup that unconditionally clears both the store flag and the attribute on unmount, and derive the attribute from the store in one place (a single `useEffect` in `App.tsx` on `videoPlaying`) rather than stamping it from an event handler. Also handle `waiting`/`stalled`/`emptied` so a buffering stall does not read as playing. Test: mount `/player`, start playback, navigate to `/`, assert `document.documentElement.hasAttribute('data-video-playing')` is false.

### Perf budget — §9 contains zero perf assertions; every number in the budget is asserted, none is measured

**Where.** §9 Verification (9.1 layout shift, 9.2 profile collapse, 9.3 Qur'an lock, 9.4 accent discipline, 9.5 asset budget, 9.6 contrast)

**Why.** The Part II contract states five numeric budgets — idle CPU at Tier 3 < 3%, GPU memory < 40 MB, zero contribution to input latency, 30 fps cap on Tier 3, assets < 1.5 MB — and §9 tests exactly one of them (assets, and see below for why even that measures the wrong thing). §5.5 argues the rest from first principles ("compositor-only", "trivially met", "satisfied by construction"), and the GPU-memory argument is demonstrably wrong. A budget with no measurement is a preference.

**Fix.** Add `scripts/harness/perf-matrix.mjs` with four assertions, all runnable against the existing Playwright/Chromium setup: (1) **fps/pacing** — count rAF callbacks over 10s at Tier 3, assert 28-32; (2) **main-thread cost** — CDP `Performance.getMetrics` before/after a 30s idle at each tier, assert `TaskDuration` delta < 0.9s (3% of 30s) and `RecalcStyleDuration` + `LayoutDuration` delta ≈ 0 at Tier 2; (3) **GPU memory** — CDP `LayerTree` promoted-layer sum as described above, assert < 40 MB; (4) **input latency** — `PerformanceObserver({type:'event', durationThreshold: 16})` while driving a synthetic click/scroll loop, assert p95 event duration at Tier 3 is within 2 ms of Tier 0. Real idle CPU % must additionally be spot-checked on Windows against the actual WebView2 processes (`Get-Counter '\Process(msedgewebview2*)\% Processor Time'`) since headless Chromium is not a valid proxy.

### Feasibility — deviceCap cannot detect the one case that matters (software compositing)

**Where.** §5.2 "`deviceCap: AmbientTier; // 3 normally; 1 when deviceMemory<=4 || hardwareConcurrency<=4`" against the contract's "low-end GPU"

**Why.** `navigator.deviceMemory` and `hardwareConcurrency` are CPU/RAM proxies and say nothing about the GPU. The realistic failure mode on Windows is WebView2 falling back to SwiftShader software rasterization because the GPU is on Chromium's blocklist or the driver is stale — common on the exact institutional/older machines an offline study app targets. In that state a machine with 16 GB and 8 cores reports `deviceCap: 3`, and Tier 2's three promoted full-bleed layers with an animated `scale()` are rasterized on the CPU every frame. That is the worst case, and the current heuristic actively selects it.

**Fix.** Replace the static heuristic with a runtime probe: run the drift animation at Tier 2 for ~1.5s after first paint, count rAF callbacks and measure the 95th-percentile inter-frame gap; if it exceeds ~24 ms, clamp `deviceCap` to 1 and persist the result in localStorage keyed by a cheap machine fingerprint so the probe runs once. This is the only capability signal that is actually causal, and it also covers integrated GPUs and remote-desktop sessions, which no navigator field reports.

### Perf — paused Tier-2 layers retain their GPU textures on the memory-sensitive route

**Where.** §5.3 "`.ambient-root[data-tier='1'] .ambient-drift { opacity: 0; animation-play-state: paused; }`" with `.ambient-drift i { will-change: transform }` always applied

**Why.** `will-change: transform` forces compositor promotion unconditionally. `opacity: 0` does not release the layer, and `animation-play-state: paused` does not either. So on `/quran` — where routeCap clamps to Tier 1, and where the app is simultaneously running the word-sync rAF loop, decoding recitation audio and holding the mushaf text — three fully-rasterized invisible layers (30-60 MB by the calculation above) stay resident for nothing. The spec keeps the elements mounted specifically so the timeline is preserved, which is correct; it just should not keep their textures.

**Fix.** Scope the hint: remove `will-change` from the base rule and add `.ambient-root[data-tier='2'] .ambient-drift i, .ambient-root[data-tier='3'] .ambient-drift i { will-change: transform; }`. Pair it with `visibility: hidden` at tier ≤ 1 (after the opacity transition completes, via `transitionend`) so the layers are dropped but the CSS animation timeline is untouched — `visibility` does not reset an animation's current time. Verify with the LayerTree measurement on `/quran`: assert promoted-layer bytes attributable to `.ambient-*` is under 5 MB.

### Scope gap — the measured 6431px unvirtualized Radio list is untouched and is made worse

**Where.** Absent from the spec; Phase 0 measured "Radio scrollHeight = 6431px, 175 rows, UNVIRTUALIZED"

**Why.** `src/pages/Radio.tsx:218` maps every station in `StationSection` with no windowing, and `VIRTUAL_LIST_ITEM_HEIGHT = 64` / `VIRTUAL_LIST_OVERSCAN = 5` in `src/utils/constants.ts:56,58` are declared but referenced nowhere in the tree — the constants exist, the implementation never landed. The spec adds two costs on top of this list without addressing it: `<main>` becomes transparent over an animating ambient layer (so 6431px of rows composite over a moving surface on every scroll frame), and §6's universal `!important` transition applies five properties to every row and every child of every row for 260 ms on each theme switch — which is exactly what a user does repeatedly while evaluating the new ThemePicker.

**Fix.** Either land windowing for `StationSection` using the constants that already exist (fixed 64px rows make this a ~40-line component), or — cheaper and enough for 175 rows — apply `content-visibility: auto; contain-intrinsic-size: 0 64px` to the row element, which skips rendering and style work for off-screen rows and composes correctly with the transparent-main change. Measure before/after with `Performance.getMetrics` `RecalcStyleDuration` across a theme switch on `/radio`, and scroll frame time over a 6000px programmatic scroll.

### WCAG 1.4.11 Non-text Contrast — 3:1 for boundaries that identify a UI component

**Where.** §2.3 measured hairline table: 'pure-black (onyx) 0.11 → 1.21:1; cool/warm 0.13/0.14 → 1.25:1; light (pearl) 0.20 → 1.40:1' and 'Pearl is set deliberately above perceptual parity: it has no shadow, so the hairline carries the hierarchy alone'

**Why.** The spec measures these and presents them as a considered decision without naming the 3:1 requirement they miss by 2–2.5x. This bites where the boundary is the sole identification of a control, and the `light` profile is constructed to make exactly that the case: `--elev-1: 0 0 0 1px rgb(var(--hair-rgb) / var(--hair-a-faint))` at 0.12 alpha, shadow policy '~0', 'hierarchy is the ring, not the shadow'. Text inputs (`.surface-input`, :2280), buttons with `border-border`, and `.surface-1/2/3` cards on Pearl are then identified by a 1.40:1 edge on a white page. `pure-black` fails differently: 1.21:1 hairline plus `--edge-gain: 0.5` and `--wash-gain: 0.5` halves hover and active washes too, so on Onyx and Mushaf Night both the boundary and the state change fall below threshold simultaneously — a low-vision user has no reliable affordance that a row is active or that a control is a control.

**Fix.** Introduce a fifth alpha `--hair-a-control`, measured at ≥3:1 against the theme's own card per profile, used on interactive boundaries (inputs, buttons, segmented controls) while the faint/base weights stay decorative — or state explicitly that interactive boundaries are identified by fill/value step and prove it. Add §9.7 asserting `--hair-a-control` vs `--bg-card-rgb` ≥3:1 in all ten themes, and reconsider halving `--wash-gain` on pure-black now that its hairline is already the weakest in the set.

### Correctness — §2.3/§3.1 present 'Glass α / blur / sat' as one of the four axes distinguishing the profiles

**Where.** §2.3 `.surface-3 { background: linear-gradient(177deg, color-mix(...) 0, var(--surf-3) 130px) padding-box, var(--edge-3) border-box; background-color: rgb(var(--bg-card-hover-rgb) / var(--glass-a)); ... backdrop-filter: blur(var(--glass-blur)) ... }`

**Why.** `--surf-3` is a `color-mix()` of two fully opaque colours, so the padding-box gradient is opaque and paints over the `background-color` beneath it. `--glass-a` therefore has zero rendered effect, and `backdrop-filter` has nothing to show through — an opaque element has no visible backdrop. The same is already true of the current `.surface-3` (index.css:1921-1932, opaque `--fill-3` over `backdrop-filter: blur(22px)`), so the frosting has never actually rendered; the spec inherits the bug and builds a documented per-theme axis on it. The `html[data-video-playing]` override is consequently a no-op too: it removes an invisible filter and sets an equally hidden background-color. §9.2's cardinality-of-4 test would pass on `--glass-a`/`--glass-blur` while neither changes a pixel, certifying a difference that does not exist.

**Fix.** Make the padding-box layer translucent where glass is intended — replace opaque stops with `color-mix(in srgb, transparent calc((1 - var(--glass-a)) * 100%), <stop>)`, or drop the gradient on `.surface-3` and let background-color + backdrop-filter do the work. Extend §9.2 to screenshot a `.surface-3` overlay over high-contrast content and assert the sampled pixel differs between the cool (0.76) and pure-black (1.00) profiles. Note this makes the §9.3 Qur'an assertion load-bearing rather than incidental.

### §9.3 Qur'an ambient lock — test adequacy

**Where.** §9.3 'assert ... every element on the paint path between .ambient-root and .quran-script computes opacity: 1 with a non-transparent background-color. ... and that .ambient-root is not an ancestor of .quran-reading-frame'

**Why.** Two problems. 'Non-transparent' is satisfied by any alpha > 0, so `--glass-a: 0.76` passes while three-quarters of the ambient shows through — and once the glass bug is fixed that is exactly what the cool themes ship. It must assert alpha === 1. Second, 'not an ancestor' is trivially true by construction: `.ambient-root` is `position: fixed` and mounted as a sibling in `.app-container`, so it can never be an ancestor of anything in `<main>`; the assertion passes unconditionally and tests nothing. The property that needs asserting — that no element from `.quran-reading-frame` up to `<body>` is translucent — is currently false at every link.

**Fix.** Rewrite as: walk from `.quran-script` to `<body>`; assert at least one ancestor has computed `background-color` alpha exactly 1 and no ancestor between it and `.quran-script` has `opacity < 1`. Separately assert `getComputedStyle(document.querySelector('.quran-reading-frame')).backgroundColor` has alpha 1. Keep the existing `.quran-reading-surface` overflow:visible / border-width:0px checks — those are correct.

### Part II ambient contract — 'Tier 0 Flat ... Used for reduced-motion, battery saver, Performance Mode, low-end GPU'

**Where.** §5.2 `TierInputs` and §5.4 `AmbientState` — neither has a `performanceMode` term

**Why.** `performanceMode` already exists as a shipped user setting (Settings.tsx:613, `SettingRow label={t('performanceMode')}`), and the contract names it as one of four Tier 0 triggers. `resolveTier` has terms for reducedMotion, motionPref, deviceCap, routeCap, videoPlaying, windowFocused and batteryLow but not for the one the user explicitly enabled to reduce work — so Performance Mode still yields a Tier 2 or 3 animated background. Related: `deviceCap` and `batteryLow` clamp to tier 1, not 0, so 'battery saver' and 'low-end GPU' never reach the contract's Tier 0 either; on a plate theme tier 1 still decodes and paints a 1280px AVIF.

**Fix.** Add `performanceMode: boolean` to `TierInputs`, sourced from the existing settings store, short-circuiting to 0 alongside `reducedMotion`. Change the runtime term so `batteryLow` and `deviceCap <= 1` clamp to 0, matching the contract — or amend the contract text to say tier 1 and justify the AVIF decode.

### WAI-ARIA radiogroup keyboard pattern; audit brief 'full keyboard traversal of ... lists, dialogs'

**Where.** §8.4 'ThemePicker ... keeps role="radiogroup", and adds roving arrow-key navigation (absent today)' and 'onChange calls applyTheme(theme) immediately ... and updateSettings({ theme }) for persistence, in that order'

**Why.** Under-specified in three ways that each break a keyboard user. (a) 'Roving arrow-key navigation' is named but roving `tabIndex` is not — without it the group stays ten tab stops and arrow keys fight Tab; Home/End and wrap behaviour are unspecified. (b) The ARIA radiogroup pattern is selection-follows-focus, so each arrow press fires `onChange`: re-themes the document, stamps `data-theme-switching` for 260ms, and fires `updateSettings` — a Tauri round-trip the spec itself notes can take 12s to time out (settingsStore withTimeout). Arrowing Noor→Samaa queues nine. (c) The visual result is nine full-app colour transitions in under a second, precisely the motion a vestibular-sensitive user is protected from; `applyTheme`'s reduced-motion guard suppresses the transition but not the repeated flip.

**Fix.** Specify roving tabIndex (single tab stop, `tabIndex={0}` on the checked radio, `-1` elsewhere), Home/End, and wrapping. Apply the visual theme on focus but debounce `updateSettings` ~400ms so persistence fires once when arrowing stops. Suppress `data-theme-switching` when the previous switch was under 300ms ago, so rapid traversal cuts rather than crossfades.

### Correctness — §5.3 'In app the theme is read from document.documentElement.dataset.theme'; §6 'On theme change only custom-property values change'

**Where.** §5.3 AmbientLayerProps and §6 'StarfieldCanvas ... re-reads its colour on the theme:changed event'

**Why.** `resolveTier` needs `THEME_CATALOG[i.theme]` for `defaultTier`, `maxTier` and `SURFACE_PROFILE_CEILING`, but in the 'app' variant the theme comes from a DOM attribute React does not observe, and `theme:changed` is wired only to StarfieldCanvas. Switching `mushaf` (maxTier 1) → `noor` (maxTier 3) never re-runs `resolveTier`, so `data-tier` stays 1 and the aurora never starts. The reverse is worse: `noor` at tier 3 → `pearl` (maxTier 1, profile ceiling 1, 'Tier 1, hard-locked') leaves StarfieldCanvas mounted with its rAF loop running on the one light theme specified never to animate. §6's claim that theme switching is safe because 'only custom-property values change' holds for the CSS but not for the tier state machine.

**Fix.** Have AmbientLayer subscribe to `theme:changed` and hold the theme in React state, or route the theme through the settings store rather than reading the DOM. Add to §9.2: switch across all ten themes on a single mount and assert `data-tier` matches `resolveTier` each time, and that StarfieldCanvas is unmounted whenever the resolved tier is < 3.

### RTL correctness; audit brief 'logical properties (ps/pe/ms/me) not left/right'

**Where.** §1.2/§2.3 preserve `--wash-hover-rtl` / `--wash-active-rtl`; §6 keeps 'the effect still owns lang, dir and data-language'; §3.2 adds new directional ambients (lamp pool 'at 26%/18%', beams with slow translateX)

**Why.** None of the RTL machinery the spec carries forward can execute. App.tsx:41 sets `root.dir = 'ltr'` unconditionally with the comment 'Keep the layout direction fixed in both languages'. Every `[dir='rtl']` rule in index.css (`.app-shell` :171, `.app-sidebar` :175/:2333, `.rule-row-active` :1155, the stale `--accent-teal-rgb` nav marker at :736) and every Tailwind `rtl:` variant (Sidebar.tsx:104) is dead code, as are `--wash-hover-rtl`/`--wash-active-rtl`. The spec's Arabic story is therefore: text renders RTL inside each label via `.arabic-text`, but the shell is LTR — sidebar left, active-row marker at the reading end, hero light on the wrong side. The spec does not surface this and adds new direction-blind assets on top: the emerald lamp pool at 26%/18%, the red beams translating one way, `--edge-2` at 146deg, all assuming a left-anchored light.

**Fix.** Either state in §6, next to the applyTheme snippet, that `dir` remains LTR by product decision and that all `-rtl` tokens and `[dir='rtl']` rules are dead and should be deleted alongside the other dead tokens in §0 — or make `dir` follow `language` and add mirrored forms for the new ambient gradients (`[dir='rtl']` overrides on `.amb-a/b/c` background-position and animation direction). Do not carry a half-live RTL layer forward silently. Delete `html[dir='rtl'] .app-sidebar nav a[aria-current='page']` at :736 regardless — it references `--accent-teal-rgb`, which §1.1 removes, and it outranks Sidebar.tsx:104's `rtl:` utility on specificity, so if dir ever did flip it would silently drop the active-page marker.


---

## MINOR

### §9.2 (directional gradients need a `[dir='rtl']` override) — spec violates its own rule

**Where.** `.hero-lesson-wash { background: linear-gradient(200deg, …), … }`, `.hero-ambient-ground { radial-gradient(… at 42% 30% …), radial-gradient(… at 34% 20% …), linear-gradient(168deg, …) }`, `.hero-mushaf { radial-gradient(78% 120% at 18% -20%, …), linear-gradient(177deg, …) }`

**Why.** §9.2 requires that "Heroes express directional gradients as one declaration plus a `[dir='rtl']` override in CSS, exactly as `.rule-row:hover` / `[dir='rtl'] .rule-row:hover` (index.css:1796-1804) already do". Every gradient the spec authors is directionally biased (200deg, 168deg, 177deg, key light at 18%/34%/42% from the inline start) and none is given the override. When the `dir='ltr'` pin at App.tsx:44-46 is lifted — which §9 exists to make a one-line change — all four heroes light from the wrong side.

**Fix.** Add the paired `[dir='rtl']` declarations alongside each: mirror the angle (`200deg` → `160deg`, `168deg` → `192deg`, `177deg` → `183deg`) and the horizontal position stops (`18%` → `82%`, `34%` → `66%`, `42%` → `58%`). Add a grep gate to §11.9's list: every `linear-gradient(<angle>` or `at <n>%` inside `.hero-*` has a matching `[dir='rtl']` rule.

### §11.9 grep gate does not cover the surface it is meant to protect (Manhaj 9)

**Where.** §11.3 assertion 9: "Grep gate (CI, not Playwright): zero occurrences of `text-white`, `bg-black`, `#`-hex, `rgba(` and `rgb(0 0 0` inside `src/components/hero/**` and `src/components/marks/**`"

**Why.** Every colour the spec introduces is authored in `src/index.css` — the tokens in §1.1, `.jadwal-mount`, `.hero-lesson-*`, `.hero-mushaf*`, `.hero-ambient*`, `.hero-compact*`, `.skeleton`, and the four `html[data-surface]` blocks. The gate reads two directories that will contain almost no colour at all, and does not read the file where the risk lives — the same file that already carries the 80 `rgba()` literals the Phase 0 audit counted. As written it is green on day one and proves nothing.

**Fix.** Extend the gate to the CSS the heroes add: zero `rgba(`, zero `#`-hex and zero `rgb(<n> <n> <n>` with literal channels within the `/* ── Heroes ── */` region and in every `.hero-*`, `.jadwal-mount`, `.basmala-*` and `html[data-surface=*]` block. The precise failure to catch is `rgba(var(--x-rgb), 0.16)`, which parses as invalid and drops the whole declaration silently.

### §5.5 height budget does not hold at the minimum supported window

**Where.** §5.5: "`max-height: min(70vh, calc(100vh - 22rem)); min-height: 19rem;`" with §11.1's 900×600 column

**Why.** At the 900×600 minimum the spec itself budgets against, `calc(100vh - 22rem)` = 600 − 352 = 248px, but `min-height: 19rem` = 304px still wins, so the new 22rem chrome allowance is inert exactly where it was needed and the reading frame is 304px inside ~327px of remaining space — before the frame's own `clamp(0.85rem, 1.35vw, 1.1rem)` jadwal inset and 10px radius. The stated relationship between the hero and the reading pane is not actually enforced at the bottom of the range.

**Fix.** State the resolved value at all three viewports in §11.1 (1280×800 → 448px, 1920×1080 → 728px clamped to 70vh = 756 → 728, 900×600 → 304px floored by `min-height`), and either lower `min-height` to `17rem` at `@media (max-height: 720px)` or reduce `--hero-mushaf-h` there as §1.1 already does for `--hero-continue-h` and `--hero-compact-h`.

### Spec-internal consistency: §11.11 and §1.2 require testIds the DOM does not carry

**Where.** §11.3 assertion 11: "assert `[data-testid="hero-mushaf-read"]` has no `onclick`, `tabindex` or `role`" versus §5.3's DOM: `<span class="hero-mushaf-read hero-mushaf-read-off">{t('quranWarshNoTiming')}</span>`

**Why.** §1.2 declares `testId` required on `HeroAction` ("Stable selector for the Playwright harness. Required."), but §5.3's riwayah `.segmented` buttons, §6.3's `<HeroActionButton rank="primary" {...action} />` and the `.hero-mushaf-read` span carry none. The Warsh guard in assertion 11 — the one test that proves timing data cannot reach a Warsh view — selects an element the spec never labels, so it fails to find its target and is trivially green or trivially red depending on the harness's missing-node behaviour.

**Fix.** Add `data-testid="hero-mushaf-read"` to both arms of the reciter slot in §5.3, `data-testid="hero-mushaf-riwayah-hafs"`/`-warsh"` to the segmented buttons, and require the harness to assert the node exists before asserting its attributes. Strengthen assertion 11 to also check that no `loadSyncedAudio` / `selectTimingRead` call is recorded by the stub after `onChangeRiwayah('warsh')`.

### Perf/feasibility — total ambient/mark asset accounting ('total ambient assets across all ten themes < 1.5MB')

**Where.** §2.1 `.jadwal-mount { --jadwal-c: url('./assets/marks/jadwal-corner.svg') }` repeated 4x in the mask list; §3's basmalaSvg raw import

**Why.** No accounting method is stated anywhere, so the 1.5MB budget cannot be checked. Concretely: jadwal-corner.svg is 315 bytes, below Vite's default 4096-byte assetsInlineLimit, so it is inlined as a base64 data URI once per occurrence — 4 in .jadwal-mount plus 4 in the existing .quran-jadwal, roughly 3.4KB of duplicated CSS. basmala.svg is 12,096 bytes raw-imported into the JS bundle (already the case in Hero.tsx, so no regression). Current bundle is index.js 533KB + index.css 93.6KB. The additions are small, but 'small' is an estimate, and the brief says measure.

**Fix.** Add a size gate alongside the grep gates: after `npm run build`, sum the bytes of dist/assets attributable to marks and ambient (SVG data URIs in CSS, raw-imported SVG strings in JS) and fail over a stated ceiling; print the before/after delta on every PR. Also consider raising assetsInlineLimit past jadwal-corner.svg or hoisting the data URI to a single custom property so it appears once.

### §9.1 'No hero uses a physical side' + §11.3 grep gate 10

**Where.** .hero-arch, kept verbatim per §2.3 (index.css:1604-1618): `top: 50%; left: 50%; transform: translate(-50%, -62%)`

**Why.** Grep gate 10 only scans src/components/hero/** for Tailwind class names (pl-, pr-, text-left, …). It cannot see CSS. The one ornament the spec explicitly preserves and mounts on HeroAmbient uses a physical `left`. Harmless while root.dir is pinned to ltr (App.tsx:44), which is exactly why it survives — but §9.1's stated purpose is that lifting the pin becomes a one-line change, and this is a second line.

**Fix.** Change to `inset-inline-start: 50%` and keep the translate (which is direction-neutral in a centred context), or extend gate 10 to scan index.css for `\b(left|right)\s*:` and `text-align:\s*(left|right)` inside the .hero* and .jadwal* selectors.

### §11.2 and §12 — factual accuracy

**Where.** "the first useful pixel — a lesson title with a resume button attached — moves from y=674 to y=74"; §12's removal list

**Why.** y=74 is 24 (page pad) + 50 (basmala band) — the hero's top EDGE, not its title. The title sits inside `.hero-lesson-body { justify-content: center }`, roughly 60-70px lower. The improvement is real and large; the number is overstated by ~65px. Separately, §12 lists `heroOpenMushaf` as both 'Removed with Hero.tsx' and re-added with the same name — it is only used at Hero.tsx:99, so nothing is removed, it is merely re-pointed. `heroPurpose`, `heroRadio`, `heroContinue` (Hero.tsx:94/107/117) and `premiumLibraryCommand`, `dashboardSubtitle` (Dashboard.tsx:111/118) are correctly removable — I verified there are no other call sites.

**Fix.** Quote the measured y of `#hero-lesson-title`, not the section top, and take it from the harness rather than from arithmetic. Delete `heroOpenMushaf` from the removal list.

### Screen-reader output quality / §4.1 "null renders no slot"

**Where.** §4.2 `<p class="hero-lesson-meta"><bdi>{speaker}</bdi><span aria-hidden="true"> · </span><bdi>{collection}</bdi>…</p>`

**Why.** Two small defects in one line. (1) §4.1 documents `speaker: string | null` as "null renders no slot", but the DOM sketch renders the ` · ` separator unconditionally, so a null speaker yields a leading middot. `collection` is likewise nullable. (2) Marking the separator `aria-hidden` is right visually but leaves the SR output as one unpunctuated run — "Ahmad al-Fulani Sharh as-Sunnah plus 3" — with no pause and no indication that three distinct facts are present.

**Fix.** Build the meta line as an array of present values joined at render, so no separator is emitted for an absent slot. Keep the visible middot `aria-hidden` but give the `<p>` an `aria-label` composed from labelled parts (`t('heroSpeaker')`, `t('heroCollection')`, and the `+N` label from finding 7), or emit a visually-hidden comma between slots so the SR gets prosodic breaks.

### Rendering correctness — square ornament inside a rounded clipping parent

**Where.** §2.1 `.jadwal-mount { inset: 6px; mask-size: var(--jadwal-corner) var(--jadwal-corner) }` (14px) inside §4.3 `.hero-lesson-art { border-radius: var(--r-md); overflow: hidden }`, with §8.1 `html[data-surface='warm'] { --r-md: 8px }`

**Why.** Rule 2.2.9 forbids `border-radius` on the mount because "it is square by construction", but its parent is rounded *and* clipping. At the default `--r-md: 6px` with `inset: 6px` the khatam corners are just inside the arc; under the `warm` profile `--r-md` rises to 8px while the inset stays 6px, so the arc cuts into the 14px khatam on all four corners in five of the ten themes (maktabah, mushaf-gold, emerald, mushaf, red). A shaved khatam is exactly the 'reads as clipping' failure rule 2.2.8 raises for the Basmala's mark size.

**Fix.** Derive the inset from the radius: `inset: calc(var(--r-md) + 2px)`, or drop `overflow: hidden` from `.hero-lesson-art` and clip the `<img>` itself. Add a §11.3 assertion that `.jadwal-mount`'s inset is >= its parent's computed `border-radius`, evaluated per surface profile.

### Maintainability / correctness — magic constant that does not track the token it derives from

**Where.** §5.5 `.quran-reading-viewport { max-height: min(70vh, calc(100vh - 22rem)) }`

**Why.** `22rem` (352px) is derived from the 1280x800 case where `--hero-mushaf-h` resolves to 136px. But `--hero-mushaf-h` is `clamp(8.25rem, 17vh, 10.5rem)` — 168px at 1080p and 132px at 600px height — so the constant is wrong at both other measured viewports, over-subtracting ~79px of reading pane at 1080p. It is also Latin-only: under `data-language='ar'` the hero's `<h1>` takes `--lh-arabic` (see finding 1) and the real chrome is taller than 22rem at every size. A hand-tuned constant that silently drifts from the token it was measured against is the class of thing that breaks a year later with no test.

**Fix.** Write it as `max-height: min(70vh, calc(100vh - var(--hero-mushaf-h) - 8.5rem))` so it tracks the clamp, and state the 8.5rem as page-padding + tabs + gaps with the components named. Assert in §11.3 that `.quran-reading-frame`'s bottom edge is within the `<main>` client rect at 900x600, 1280x800 and 1920x1080, in both languages.

### Specification completeness — height budget rests on type sizes that are never declared

**Where.** §5.3 `.hero-mushaf-title`, §4.2 `.hero-lesson-meta`, `.hero-lesson-figures`, §7.2 `.hero-compact-sub`, §5.3 `.hero-mushaf-read`, `.hero-mushaf-last`; §7.2's accounting "24 pad-top + 17 eyebrow + 12 + 43 title + 10 + 24 subtitle + 20 + 1 rule + 12 + 17 metrics = 180"

**Why.** Six classes carry no `font-size` in the spec, yet §7.2 and §11.1 quote their rendered heights to the pixel. Tailwind's preflight resets heading `font-size` to `inherit`, so an undeclared `.hero-mushaf-title` `<h1>` renders at `--fs-base` (15px), not the ~43px the 136px band budget implies — the band would look broken and the budget would still 'pass' any assertion that only checks the container height. The 17px eyebrow figure also assumes `--fs-cap` at Tailwind's 1.45 leading, which the Arabic override replaces with 1.85 (finding 1).

**Fix.** Declare `font-size` (and, where it matters, the Arabic arm) for all six classes in the spec, and re-derive §7.2's accounting and the §11.1 table from the declared values in both languages. Add a §11.3 assertion pinning each hero title's computed `font-size` to the intended `--fs-*` token, so a preflight reset cannot silently swallow it.

### Token discipline — hard-coded alpha bypasses the surface-profile override

**Where.** §7.2 `.hero-compact-metrics { border-top: 1px solid rgb(var(--hair-rgb) / 0.13) }` and `> div + div { border-inline-start: 1px solid rgb(var(--hair-rgb) / 0.13) }`, against §8.1 `html[data-surface='pure-black'] { --hair: rgb(var(--hair-rgb) / 0.10); --hair-faint: rgb(var(--hair-rgb) / 0.05) }`

**Why.** `--hair` already exists at exactly 0.13 (`src/index.css:438`) and §8.1's `pure-black` profile lowers it to 0.10 precisely so hairlines recede on Onyx. Re-writing the 0.13 literal in the metrics rule means the one route-level rule the profile was written to retune is the one it cannot reach, and §8.2's Onyx row ("hairlines drop to 0.10/0.05") is untrue for HeroCompact. §8.2 also states "metric rules carry the hierarchy" for Pearl, where a 0.13-alpha bronze on white is roughly 1.3:1 and effectively invisible — the profile override is the mechanism that was supposed to fix that.

**Fix.** Use `var(--hair)` in both declarations. Add a `light` arm to §8.1 raising `--hair` for Pearl (the metric rules are load-bearing hierarchy there per §8.2), and add a grep gate to §11.3 forbidding `var(--hair-rgb) /` inside `src/components/hero/**` — the composed tokens are the interface.

### Robustness — throwing in render on a data-shape violation

**Where.** §7.1 "`metrics.length > 3` throws in DEV"; §5.2 `if (import.meta.env.DEV && riwayah === 'warsh' && timingRead !== null) throw new Error(...)`

**Why.** The Warsh assertion is correct and should stay — a Hafs timing read under Warsh is a manhaj-level correctness failure and a hard stop in DEV is the right response. `metrics.length > 3` is not in that category: it is a layout preference, and throwing from render unmounts the route behind an error boundary (or blanks the app if none is installed) for a cosmetic overflow. There is no `ErrorBoundary` in `App.tsx`, so this blanks the window.

**Fix.** Keep the Warsh throw. Replace the metrics throw with a `console.error` plus `metrics.slice(0, 3)`, so a fourth metric degrades to three rather than taking the route down. Separately, note that neither DEV assertion runs in the production build, so §11.3.11's runtime check of the Warsh resume payload is the only real guard — keep it.

### §1.2's own claim — 'reuse the existing export from src/components/playlist/PlaylistCard.tsx:92, which already fills absolute inset-0 and is therefore ratio-agnostic'

**Where.** §1.2 MediaFrame: 'On `onError` it falls back to `<PlaylistArt seed name />`'

**Why.** PlaylistArt is not ratio-agnostic, and the existing code knows it — verified at PlaylistCard.tsx:85-90 it takes a `dense` prop documented as 'Row-sized: drop the initial and the inner rule, the mark alone reads.' At PlaylistCard.tsx:126-128 the non-dense branch draws two jadwal rules at `inset-3` (12px) and `inset-[0.9rem]` (14.4px). §1.2 invokes it with no `dense` prop, ever. In a ListCompact row frame (§9 specifies `MediaFrame ratio="16/9" className="w-[104px]"`, so 104x58.5px) the two rules end up 2.4px apart with ~29px of clear height between them — precisely the 'rounded double border is a web card' failure the source comment at PlaylistCard.tsx:124-125 warns against, and the same in the 180x101 RailPoster media band.

**Fix.** Give MediaFrame a derived dense signal rather than dropping the prop: accept `dense?: boolean` (passed by ListCompact and the rails) or compute it from the frame's measured block size, and forward it as `<PlaylistArt seed={seed} name={label} dense={dense} />`. A threshold around 120px of frame height matches the existing call sites' intent. Extend §12 assertion 2: within any one GridMedia or rail, all PlaylistArt fallbacks resolve the same dense value.

### Manhaj constraint 9 / material consistency — a surface must sit correctly on its ground

**Where.** §2 `.section-header-sticky { position: sticky; inset-block-start: 0; z-index: 2; background: var(--bg-main); padding-block-start: var(--s2); }` and §8 `.list-grouped-pinned { ... background: var(--bg-main); }`

**Why.** Both paint a flat `var(--bg-main)` backstop, but the ground is not flat. Verified at src/index.css:1844-1870, .page-container layers a vignette radial and two accent radials over var(--bg-main) — `radial-gradient(96% 62% at 22% -8%, rgb(var(--accent-gold-rgb) / 0.085), transparent 68%)` and a second at 0.035 — with a mirrored [dir='rtl'] variant at :1872. A sticky header filled with the flat base colour reads as a lighter or darker rectangle sliding over the page's directional falloff, and the seam moves as the user scrolls. It is worst at the top-inline-start corner, which is exactly where a sticky header sits in LTR.

**Fix.** Do not repaint the ground. Use a backdrop instead: `backdrop-filter: blur(10px) saturate(1.1); background: rgb(var(--bg-main-rgb) / 0.72);` on both classes (the cool/warm surface profiles already call for backdrop-filter), or have the backstop copy .page-container's gradients with `background-attachment: local`. Add a §12 assertion: sample the computed colour immediately above and below a pinned header's top edge on /radio at scroll offsets 0 and 400 and assert the delta is under a small threshold, in both dir values.

### Verifying (CLAUDE.md) — visual changes are checked by rendering; the ten-theme and riwayah guarantees are the spec's own load-bearing claims

**Where.** §12: 'Everything below is checked by rendering, through the harness already at scripts/harness/, across 5 themes × 2 languages' — 11 assertions

**Why.** Three gaps. (a) The sweep is 5 of the 10 themes, but Part I defines four SURFACE PROFILES — light (Pearl), pure-black (Onyx), warm (Maktabah / Mushaf Gold / Emerald Majlis), cool (Samaa / Sakinah / Noor Teal) — and nothing in §12 requires the 5 chosen themes to cover all four. Pearl is the only light theme and Onyx the only no-shadow theme; missing either leaves §1.2's inset shadow and §1.7's thumb alpha unverified in the polarity where they most likely fail. (b) There is no assertion for the riwayah selector despite §11 migrating it — the one control where the spec makes an explicit exclusivity claim. (c) There is no assertion that any new block re-colours across themes, so the accent-seed finding above would ship unnoticed; assertion 11 is a source-text lint, not a render check.

**Fix.** Name the five themes and require one per surface profile plus a control: pearl (light), onyx (pure-black), maktabah (warm), samaa (cool), mushaf (baseline dark). Add assertion 12 (riwayah exclusivity), assertion 13 (a pressed chip, a MediaFrame meter fill, a StatStrip meter and an active alpha bucket resolve different computed colours in at least two themes), and assertion 14 (the mushaf reading column is centred within .quran-reading-frame to within 1px).

### CSS cascade correctness — §0.1 'CSS additions all go in src/index.css inside the existing @layer components'

**Where.** §7.1 `.page-container-fixed { display: flex; flex-direction: column; overflow: hidden; }` overriding `.page-container`

**Why.** Verified at src/index.css:1844: `.page-container { @apply relative h-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6; ... }`. `.page-container-fixed` has identical specificity (0,1,0), so the override is decided purely by source order within the layer — and the class order in Quran.tsx's `className="page-container page-container-fixed"` has no effect on it. There are also two separate `.page-container` blocks (the animation one at :1834 and the @apply one at :1844), so 'append to @layer components' is not precise enough. The failure is silent: /quran keeps `overflow-y: auto`, the fill never engages, and §12 assertion 4 catches it only if the harness runs at exactly 1920x1080 as specified.

**Fix.** State the insertion point explicitly: `.page-container-fixed` and its `> .content-max-width` rule are declared immediately after the `.page-container` @apply block at index.css:1844 and before the `[dir='rtl'] .page-container` rule at :1872. Or write the override as `.page-container.page-container-fixed` (0,2,0) so it wins regardless of position and survives future reordering.

### Single source of truth for a token — the spec's own '--scroll-gutter MUST equal ::-webkit-scrollbar width' discipline

**Where.** §8: `const headH = 34;  // == --group-head-h`, and §1.7's `--scroll-gutter: 8px; /* MUST equal ::-webkit-scrollbar width (index.css:693) */`

**Why.** Both duplicate a CSS token's value into a second location with only a comment holding them together. The --group-head-h case is worse because the duplicate lives in JavaScript and drives geometry: `pushY = Math.min(0, start(nextIdx) - offset - headH)` computes the pinned header's push-off. If --group-head-h changes (the warm surface profile calls for metrics +1 step), the pinned header pushes at the wrong offset and either overlaps the incoming group header or leaves a gap — nothing fails, it just renders wrong, and §12 has no assertion on it. The --scroll-gutter case is verified correct today (index.css:692-694 is `width: 8px; height: 8px`) but has the same shape.

**Fix.** Read the token at runtime: `const headH = parseFloat(getComputedStyle(shellRef.current).getPropertyValue('--group-head-h')) || 34;` recomputed on the ResizeObserver tick that already fires for the scroller. For --scroll-gutter, note that if ::-webkit-scrollbar's width changes the token must move with it, and add a §12 assertion: the computed --scroll-gutter equals the measured (offsetWidth - clientWidth) of a known .overlay-scroll pane in its scrolling state.

### §1.7 'hiding the scrollbar removes the affordance'

**Where.** `.overlay-scroll::-webkit-scrollbar-thumb { background: transparent }` with the thumb only revealed on `:hover` / `:focus-within`

**Why.** The section's stated rationale for not using `overflow: overlay` is that hiding the scrollbar removes the affordance — and then the implementation hides the thumb until the pane is pointed at or focused. A user scrolling by keyboard, or scanning a page to judge how long a list is, gets no position indicator. It also silently overrides the global `::-webkit-scrollbar-thumb` at index.css:701 (`rgb(var(--accent-gold-rgb) / 0.18)`), so the app ships two different scrollbar behaviours with no rule for which surface gets which.

**Fix.** Keep the thumb visible at the global 0.18 alpha and only *strengthen* it on hover, or state explicitly which surfaces are 'quiet' (transient panels) versus 'honest' (long content lists) and apply `.overlay-scroll` only to the former. Radio's 175-row catalogue and the mushaf are honest surfaces.

### §6 GridMedia virtualization strategy, steps 1–6 + §1.4 'Compute it in useLayoutEffect and on every ResizeObserver tick of the scroller'

**Where.** `useElementSize(containerRef)` → `columns` → `estimateSize` → `useVirtualRows` with `measureElement` always wired

**Why.** Two ResizeObserver→setState paths feed each other. On a window resize: RO(container) fires → `setState(width)` → re-render → new `estimateSize` → virtualizer invalidates measurements → per-row `measureElement` ROs fire → `setState` → re-render. Simultaneously the scrollMargin recompute reads `getBoundingClientRect()` on two elements *inside* an RO callback and then sets state — a forced reflow per tick while the user drags the window edge. The spec dismisses this with 'measureElement corrects it'. That is a correctness statement, not a cost statement.

**Fix.** Debounce the container-width RO to one commit per animation frame; skip the `estimateSize` identity change when `columns` is unchanged (only `colWidth` moved); recompute `scrollMargin` from cached values in a `requestAnimationFrame` rather than inside the RO callback. Measurement: drag-resize the window from 1280 to 1920 over 1s on `/library` with a 120-card fixture and assert total `Layout` time < 150ms and fewer than 20 React commits.

### §1.4 'The default scroller is resolved by useScrollParent(containerRef) … On seven of eight routes that is .page-container'

**Where.** §7.1 makes `/quran` use `.page-container-fixed { overflow: hidden }`; §8/§13 route `Quran.tsx:1487`'s surah list to `ListGrouped` with no `scrollElementRef`

**Why.** `.page-container-fixed` is `overflow: hidden`, so `useScrollParent`'s walk for `overflowY: auto|scroll` finds nothing on `/quran` and reaches the document element. The one `ListGrouped` the spec places on that route is given `index="none"` and no explicit scroller, so it will virtualize against the wrong element and render the wrong window. The '/quran is the eighth route' exception is stated in §1.4 but never carried into §7.1 or §13.

**Fix.** Pass `scrollElementRef` explicitly for both Quran `ListGrouped` instances (the ListenTab pane's own `.overlay-scroll` element), and make `useScrollParent` throw in DEV when the walk terminates at `<html>` rather than silently using it.

### §7 'usePersistentNumber reads and writes localStorage['salafi-hub.split.<id>']'

**Where.** The key `salafi-hub.split.quran-read` and its `{"f":0.26,"c":false}` payload

**Why.** Every other persisted key in the app carries a schema version: `salafi-hub.watch-history.v1` (watchStore.ts:36), `salafi-hub.radio-favorites.v1` / `salafi-hub.radio-volume.v1` (radioStore.ts:55-56), `salafi-hub.quran-riwayah.v1` (quranStore.ts:123). The split key has none, so the abbreviated `{f,c}` payload has no migration path. The spec's own §7 note is careful to explain why the key is *not* riwayah-tagged but says nothing about versioning.

**Fix.** `salafi-hub.split.<id>.v1`. Also note that §12 assertion 9 ('reload the harness page') has to account for `MemoryRouter` — a reload lands on `/`, so the probe must re-click the sidebar before reading the track — and must await a tick after `mouse.up()` since the write happens on `pointerup`.

### §0.3 '--scroll-gutter: 8px; /* MUST equal ::-webkit-scrollbar width (index.css:693) */'

**Where.** The token and the `::-webkit-scrollbar { width: 8px; height: 8px }` rule at index.css:692-695

**Why.** Verified correct today, but the coupling is enforced only by a comment. Two numbers in two places that must agree, where disagreement produces a silent 1–8px misalignment on every `.overlay-scroll` pane in the app, is the same shape as the invariants CLAUDE.md indexes — and unlike those, it has no test.

**Fix.** Add to §12: mount a probe element with `.overlay-scroll` and overflowing content, and assert `offsetWidth - clientWidth === parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scroll-gutter'))`. Cheap, and it fails loudly the day someone retunes the scrollbar.

### Ambient/motion pause contract — 'Performance Mode' is one of the five documented pause conditions

**Where.** §1.3 `.skeleton { animation: skeleton-pulse 1.6s var(--ease-standard) infinite }` under `prefers-reduced-motion: no-preference`

**Why.** `prefers-reduced-motion` is honoured, but the app's own `performanceMode` setting (present in the settings store — it appears in `scripts/harness/fixtures.mjs:165`) is not. With `skeletonRows` defaulting to 6–8 and `skeletonCount` to `minColumns * 2`, a cold `/library` or `/radio` runs a screenful of independently-phased infinite opacity animations, which is exactly what Performance Mode exists to suppress.

**Fix.** Gate on both: `html:not([data-performance-mode]) .skeleton { animation: … }`, matching whatever attribute the settings store already stamps. If it stamps none, this is the block that should establish it, since Part III's ambient tiers will need the same hook.

### Manhaj constraint 9 — every colour token-derived, consumable through the existing `rgb(var(--x-rgb) / <alpha-value>)` Tailwind pattern

**Where.** §5 "Fill token" — `--skeleton-on-page: rgb(var(--bg-panel-rgb));` / `--skeleton-on-panel: rgb(var(--bg-card-rgb));` / `--skeleton-on-card: rgb(var(--bg-card-hover-rgb));`

**Why.** These are composed colour values, not the `-rgb` channel triplets every other token in this codebase uses. `tailwind.config.js` exposes colours exclusively as `rgb(var(--x-rgb) / <alpha-value>)` (e.g. `'panel-hover': 'rgb(var(--bg-card-hover-rgb) / <alpha-value>)'`, line 18), so these three cannot become Tailwind colour utilities and force arbitrary-bracket classes such as `bg-[var(--skeleton-on-panel)]` throughout `src/components/state/` — reintroducing the arbitrary-class pattern this redesign exists to remove, and forfeiting alpha support on the one element type most likely to need it. The spec never states how a component consumes them.

**Fix.** Declare them as triplets — `--skeleton-on-page-rgb: var(--bg-panel-rgb);` etc. — and add `'skeleton-page' | 'skeleton-panel' | 'skeleton-card'` to `tailwind.config.js` colors using the standard `rgb(var(--x-rgb) / <alpha-value>)` form, so `<Skeleton>` uses `bg-skeleton-panel` and `check-manhaj.mjs` can additionally fail on `bg-[` inside `src/components/state/`.

### Spec accuracy — cited APIs that do not exist as named (affects whether the listed wiring compiles)

**Where.** §3 `quranSurahFilter` and `quranReciterFilter`: "`clearSearch` → `setSurahQuery('')`"; §2: "Icons in use today (… `Youtube`, `HardDriveIcon`, `Database`, `WifiOff` …) are all objects or abstractions and all pass"

**Why.** `setSurahQuery` does not exist. The surah filter is local component state — `const [query, setQuery] = useState('')` at `Quran.tsx:151` (the reciter one is `setReciterQuery` at `:1376` and is correct). And the complete set of lucide imports across `src/` is: AlertCircle, AlertTriangle, ArrowLeft, Bell, BellOff, BookOpen, CalendarDays, Check, CheckCircle2, Clock, Download, ExternalLink, FileVideo, Film, FolderClosed, FolderOpen, FolderPlus, Headphones, History, Image, Info, LayoutDashboard, Library, ListMusic, ListVideo, Loader2, Minus, MonitorPlay, MoreVertical, Pause, Pencil, Play, PlayCircle, Plus, Radio, RadioTower, RefreshCw, Repeat, Search, SearchX, Settings, Sparkles, Square, Star, TimerReset, Trash2, Video, Volume1, Volume2, VolumeX, Wifi, X. `Youtube`, `HardDriveIcon`, `Database` and `WifiOff` are new imports, not ports of existing usage. Each is individually harmless (all are objects and do pass constraint 1), but the spec presents them as already-verified, which is how an unverified icon gets waved through.

**Fix.** Correct `setSurahQuery` to `setQuery` (or promote the surah query to the store if the empty state needs it from outside the component). Split the icon list into "in use today, verified" and "newly introduced by this spec, requires allowlist entry", and require the latter to be added to the `APPROVED_ICONS` set from finding 1 as part of the same change.

### Copy accuracy in the app's most prominent surface (adjacent to the spec's own E6 rule that copy must state what actually works)

**Where.** §6 `firstRunBody`: en "Everything stays on this computer. Choose a folder of videos and it is scanned, catalogued and kept in sync — nothing is uploaded, nothing is tracked."

**Why.** Band 3 of the same screen offers "Listen to Quran radio" (a network stream) and "Read the mushaf" (whose Listen tab fetches the reciter list over the network); the updater polls a release endpoint; `/watch` queries YouTube; `get_radio_stations` fetches a catalogue. "Nothing is uploaded, nothing is tracked" is an unqualified privacy claim made on the first screen a user ever sees, and it is only true of the import pipeline. The spec elsewhere (E6) makes truthfulness about what does and does not touch the network a named copy rule; this line breaks that rule at the highest-stakes location.

**Fix.** Scope the claim to what it is true of: en "Your lessons stay on this computer. Choose a folder of videos and it is scanned, catalogued and kept in sync — your library is never uploaded." Adjust the Arabic to match ("تبقى دروسك على هذا الجهاز … ولا تُرفع مكتبتك أبدًا").

### WCAG 4.1.2 value; §7 SplitPane separator semantics

**Where.** `aria-valuenow={Math.round(fraction*100)}`, `aria-valuemin`, `aria-valuemax`, `aria-controls` pointing at the start pane's id; `startLabel` / `endLabel` props

**Why.** Three smaller correctness gaps in one control. (1) `aria-valuenow` is a percentage of the container while the real range is clamped in PIXELS to `[minStartPx, min(maxStartPx, width*0.6)]`, so the announced min and max do not correspond to the reachable range — at 1280px wide with the Quran defaults the user hears "26%, min 0, max 100" when the actual range is 20%–33%, and Arrow keys stop moving at values the announcement says are still available. (2) `endLabel` is declared in the props but never appears anywhere in the described markup — neither pane is given `role="region"` or an accessible name, so `aria-controls` points at an unnamed element and a screen-reader user has no way to know which panel the separator resizes. (3) There is no `aria-valuetext`, so the announcement is a bare percentage with no unit or meaning.

**Fix.** Derive `aria-valuemin`/`aria-valuemax` from the same clamp the drag uses, recomputed on container resize: `valuemin = minStartPx / width * 100`, `valuemax = Math.min(maxStartPx, width*0.6) / width * 100`. Wrap both panes in `<section role="region">` (or `aria-label` on a `<div role="group">`) named by `startLabel` and `endLabel`, give the start pane the id `aria-controls` targets, and set `aria-valuetext` to the start pane's label plus its rendered width so the announcement is meaningful. Also promote `Escape`-aborts-drag from a keyboard note to a `setPointerCapture` + document-level `keydown` listener, since a pointer drag never moves focus to the handle and the handler as described would not receive the key.

### WCAG 4.1.2 — duplicate announcement; §8 sticky header implementation

**Where.** `.list-grouped-pinned` renders `<SectionHeader size="sub" title={pinned.label} count={pinned.count} rule="gradient" />` as a sibling overlay while the same header also exists as a `listitem` inside the virtualized scroller

**Why.** The pinned header is a visual duplicate of a header that is still present in the list's accessibility tree. `pointer-events: none` hides it from the mouse but not from assistive technology, so every group heading is exposed twice — once in the pinned overlay and once in the flow — and heading navigation lands on a phantom h3 that is not in the list. It also inflates the `aria-setsize` bookkeeping, since §1.4 counts flattened rows including headers but the pinned clone is outside that count.

**Fix.** Add `aria-hidden="true"` to `.list-grouped-pinned` — it is a purely visual affordance and the real heading remains in the list for navigation. State this explicitly in §8 alongside the `pointer-events: none` declaration, since the two exist for the same reason. Add a §12 assertion: assert the number of elements matching `h3` inside `/radio`'s list region equals the number of groups, not groups + 1.

### Correctness / robustness — §7.3 cue re-seating effect; load-bearing invariant (positionWordCue)

**Where.** `const surface = cue?.offsetParent as HTMLElement | null; … observer.observe(surface);` with dependency array `[surahId]`

**Why.** `offsetParent` returns `null` whenever the element or any ancestor has `display: none`. `/quran` has a Read/Listen tab switch, so on the first render after mounting into a hidden tab — or any time the effect re-runs while the tab is inactive — `surface` is `null`, the effect returns early, and because the dep array is only `[surahId]` it never re-runs once the tab becomes visible. The ResizeObserver is then silently absent for the rest of the session and the cue drift the section exists to fix returns, with no visible cause. `offsetParent` also resolves to the nearest POSITIONED ancestor, and §7.2 keeps `position: relative` on `.quran-reading-frame` as well as on `.quran-reading-surface` — so the resolution depends on which of the two is nearer, which is exactly the kind of implicit coupling the CLAUDE.md invariant warns about. Additionally `ResizeObserver` defaults to the content box, so a padding change on the surface would not fire.

**Fix.** Do not discover the surface via `offsetParent`. Hold a direct ref to `.quran-reading-surface` (the component that renders it already has one available) and observe that, with `{ box: 'border-box' }` to match the box `positionWordCue` actually measures against. Guard the early return with a retry: include the tab's active state in the dep array so the observer attaches when the tab becomes visible. Note in the §7.4 invariant list that this effect must observe the surface and never the frame, since the two boxes differ by the frame's padding and the cue arithmetic depends on the surface's padding box.

### Bundle size regression — no route-level code splitting

**Where.** §0 file table + §8 'New runtime dependencies: 0'

**Why.** Zero new dependencies is true and worth keeping, but it is not the whole cost. Measured now: `dist/assets/index-*.js` is 532,988 B raw / 149,222 B gzip in one chunk, because `App.tsx` imports all nine pages eagerly — there is no lazy boundary. `EMPTY_REGISTRY` (22 entries), `ERROR_REGISTRY` (7 × 3 scopes) and `RECOVERY_ACTIONS` (17 entries) each statically reference lucide components and plate marks, so every icon and every mark is pulled onto the first-paint critical path even for a user who never sees an error. Add ~110 new keys × 2 languages to `src/i18n.ts` (already 1,170 lines) on top.

**Fix.** Set an explicit budget in the spec — e.g. entry chunk ≤ 165 KB gzip after this lands — and record the before/after `npm run build` gzip figures in the PR. Cheap wins if it overruns: lazy-import `ERROR_REGISTRY` behind the first `healthStore` condition, and reference icons by id resolved through a small map rather than by static import in the registry literal.

### §7.1 fixture `offline` — stated stub is not implementable as written

**Where.** §7.1 `offline`: '`navigator.onLine` stubbed false'

**Why.** `navigator.onLine` is an accessor on `Navigator.prototype` with no setter; a plain assignment in `stub-tauri.js` (a non-strict classic script) fails silently and the fixture reports `true`, so the tier-1 detection branch in §4.2 E6 is never exercised. The `online`/`offline` events also never fire, so the listeners registered in `useHealthMonitor` are untested.

**Fix.** In an `addInitScript`, `Object.defineProperty(window.navigator, 'onLine', { get: () => false, configurable: true })` and dispatch `new Event('offline')` on `window` after mount — or use Playwright's `context.setOffline(true)`, which drives both. Assert in the probe that `navigator.onLine === false` before taking the shot.

### §7.1 fixture fidelity — stub shape does not match the real command

**Where.** §4.3 `checkNetwork()` reading `internetOk` from `runDiagnostics`, against `scripts/harness/stub-tauri.js:66-72`

**Why.** The stub's `get_diagnostics` returns `{ appVersion, databasePath, videoCount, playlistCount, orphanedEntries, thumbnailCacheBytes }`. The real command (`diagnostics.rs:41-53`) returns `{ …, ffmpegStatus, ffmpegVersion, ffmpegPath, ytdlpVersion, internetOk, updateEndpointOk }` — the stub has neither `internetOk` nor `updateEndpointOk`, and invents `orphanedEntries`/`databasePath` which the real command does not emit. If `healthStore` writes `internetOk` into its state as specified, every harness screenshot records `undefined` and would show a false 'connection is not responding' state.

**Fix.** Bring the stub to the real shape before adding any fixture that depends on it, and add a build-time or test-time check that the stub's returned keys are a superset of what the frontend reads for each command. This is a prerequisite for §7, not a detail of it.

### Layout budget — strips are anchored content, and precedence is declared for only one pair

**Where.** §4.2 placement lists: E1 strip on `/`, E3 strip on `/`, E5 strip (`integrity`) on `/`, E7 strip global via `UpdateManager`; only E3-over-E4 precedence is stated

**Why.** On a genuinely bad day (drive unplugged, ffmpeg missing, integrity failure, update endpoint down) four strips stack above the Dashboard hero, which the Phase 0 audit already measured at 416 px of a 764 px frame. Nothing in the spec caps how many render, and none of the placements is measured. Separately, the E2 strip is specified to live *inside* `RadioMiniPlayer.tsx:187`, a fixed element already carrying `backdrop-blur-xl` — growing that element vertically enlarges an always-composited backdrop-filter surface that is live while audio plays.

**Fix.** Declare a single global strip host with a hard cap (one strip visible, ranked by severity: integrity > folderMissing > ffmpegMissing > thumbnailsFailed > updateCheckFailed) and a 'N more issues' affordance into `/settings`. Render the radio strip as a sibling *outside* the mini-player's blurred container. Add a harness metric asserting `[data-state-block="error"][data-density="strip"]` count ≤ 1 per route in the worst-case combined fixture, and re-measure the Dashboard hero share with a strip present.

### WCAG 1.4.1 use of colour + decorative graphics must be hidden from AT

**Where.** §2 `PlateProps` — no `aria-hidden`; §2 tone table, where `tone` is expressed exclusively as colour

**Why.** Two problems in one component. (1) `<Plate>` is decorative and the spec never marks it `aria-hidden="true"` — a regression against existing correct code, which does mark it (`Quran.tsx:326`, `Quran.tsx:1541`, `PlaylistGrid.tsx` skeleton). Without it, screen readers announce a bare `<svg>` or the lucide glyph's default name before every state block's real content. (2) `tone` (`accent` / `quiet` / `warning` / `danger`) is conveyed by colour alone. `girihBreak` is the mark for ALL seven error variants regardless of tone, so a warning and a danger error are geometrically identical and differ only in hue — and the spec explicitly chose `girihBreak` over an alarm triangle, removing the one non-colour cue that shape would have provided.

**Fix.** Add `aria-hidden="true"` to `<Plate>`'s root as a non-optional part of the contract, and add a `check-manhaj.mjs` rule that fails on a `<Plate>` render without it. For tone: the title text already distinguishes the conditions semantically, so the colour is supplementary rather than sole — but make that explicit by requiring `role="alert"` on `danger`-toned blocks and `role="status"` on `warning`-toned ones, which encodes the severity difference programmatically.

### Internal contradiction — §3.1 "port, don't redesign" vs §7.4 `tracking-` ban

**Where.** §3.1 `libraryNoPlaylists`: "replaces `LibraryEmptyState` `PlaylistGrid.tsx:122-140` — the best state in the app; port, don't redesign" against §7.4: "fails on … `tracking-` … within `src/components/state/`"

**Why.** `LibraryEmptyState`'s headline is `<h3 className="mt-6 text-lg font-semibold tracking-[-0.01em] text-text-primary">` (`PlaylistGrid.tsx:130`). Porting it verbatim into `src/components/state/EmptyState.tsx` fails the new `check-manhaj.mjs` gate on the first run. The instruction to port unchanged and the lint that rejects the ported code cannot both be satisfied.

**Fix.** State explicitly that the port drops `tracking-[-0.01em]` — the `text-lg` step already carries `letterSpacing: var(--tr-md)` from `tailwind.config.js:64`, so the hand-written value is redundant in English and zeroed in Arabic anyway. This is the §1.2 rule-3 argument applied to the one file the spec exempted by implication. Also consider adding `uppercase` to the §7.4 denylist for the state directory: `SectionHeader` at `PlaylistGrid.tsx:106` uses `uppercase tracking-[0.16em]`, and `text-transform` on a translated string is meaningless in Arabic and hostile in Turkish-style locales.

### Accessible name / programmatic association

**Where.** §3 `noActionReason?: string` — "Emitted as `data-no-action-reason` and asserted by the harness", used by `downloadsNoHistory` with the value `"downloads.urlField"`

**Why.** A `data-` attribute is invisible to assistive technology. The mechanism satisfies §7.3 assertion 2 and tells the harness that an action is redundant, but it tells the USER nothing — a screen-reader user on `/downloads` hears "No downloads this session. Finished downloads are listed here with their file location." and gets no pointer to the URL field that is the actual affordance. The spec's own reasoning ("names the visible control that makes an action redundant") is sound; the delivery mechanism does not reach anyone.

**Fix.** Keep `data-no-action-reason` for the harness, and additionally make the referenced control programmatically reachable: accept an element id and emit `aria-describedby` on the state block pointing at it, or require the `bodyKey` copy to name the control in prose ("Paste a link in the field above"). The second is simpler and works for sighted keyboard users too.

### Keyboard / RTL — native `confirm()` as the destructive-action gate

**Where.** §4.1 `confirmKey?: TranslationKey;  /** confirm() gate. Mirrors Settings.tsx:198 and :211. */`

**Why.** `Settings.tsx:174/198/211/225` do use `window.confirm`, so the spec is accurately mirroring precedent — but this spec promotes that gate from one settings screen to nine sites across the app, including destructive `removeImportedFolder` and `removeOrphanedEntries` reachable from `/library`, `/reminders` and `/`. In WebView2 the native dialog renders in the SYSTEM locale and system direction: an Arabic message body sits in an LTR dialog whose OK/Cancel buttons are untranslated English (or the OS language, which need not match the app's). It also steals focus and returns it to the document body rather than the invoking button.

**Fix.** Out of scope to fix everywhere, but do not multiply it. Note the limitation in §4.1 and route the new sites through an in-app confirm built on the (repaired) modal, so the confirmation inherits the app's language, direction, theme, focus trap and focus restoration. If native `confirm()` stays for this phase, add an explicit `element.focus()` on the invoking button in the cancel path.

### Icon denylist precision

**Where.** §2 `ANIMATE_ICON_DENYLIST`

**Why.** Verified against the repo: `grep -rnoE` for all listed names across `src/**/*.{ts,tsx}` returns ZERO hits, so the repo-wide lint will not break the build today — good. Two quality issues remain. The list duplicates `Squirrel` and `Baby`. And it bans several lucide icons that depict no animate being: `Accessibility` (a wheelchair pictogram — arguably a person, defensible either way), `Contact`/`ContactRound` (a contact card), `Pointer`/`Grab` (cursor glyphs), `Shell` (a spiral shell — a mineral form), `Feather` (a quill), `Egg`, `Bone`, `Origami`. Banning `Eye`/`EyeOff` repo-wide forecloses the standard password-reveal control with no alternative named.

**Fix.** De-duplicate. Split the list into `ANIMATE_ICON_DENYLIST` (unambiguous depictions of humans and animals — the manhaj constraint) and a shorter `REVIEW_LIST` that warns rather than fails, so a borderline glyph gets a decision rather than a silent block. If `Eye`/`EyeOff` stays banned, name the replacement for the reveal control in the spec.

### Manhaj 8 (no music, no audio-reactive visuals) — assertion is mis-scoped

**Where.** §10.8: "assert no element inside `PlayerDocked` or `PlayerExpanded` carries `animate-*`"

**Why.** The constraint bans music, audio-reactive visuals, waveforms, meters and equaliser bars — not motion as such. As written the assertion bans `motion-safe:animate-spin` on a `Loader2`, which is this codebase's standard loading idiom (UpdateManager.tsx:66,134,141; QuickActions.tsx:78) and collides with §3.5's own `state: 'buffering'`, leaving the dock able to declare buffering but not show it. Meanwhile the assertion does not catch what actually matters: a status dot whose `scale` or `opacity` is written from a media value would pass a grep for `animate-*` cleanly.

**Fix.** Narrow and sharpen: (a) no `animate-pulse` in either player block (this is the real §4.3 target — the RadioMiniPlayer.tsx:224 live dot); (b) no CSS custom property, inline style or class in either block is written from an audio-derived value — assert by instrumenting the transport and checking no style mutation follows a `timeupdate`; (c) no `AnalyserNode` / `createAnalyser` / `getByteFrequencyData` anywhere in `src/`. Keep `motion-safe:animate-spin` legal.

### INV-6 (the only sanctioned coupling between chrome and the reading surface) — aimed at the wrong event

**Where.** §3.1 INV-6: "Any write to `--dock-h` is followed by `window.dispatchEvent(new Event('salafi:layout-reflow'))` ... (Without it, collapsing the dock mid-recitation leaves the cue up to ~500ms stale)"

**Why.** The stated failure mode does not occur, and the real one is not covered. `positionWordCue` (Quran.tsx:458-473) derives the cue's transform from the delta between two `getBoundingClientRect()` calls taken in the same frame — the word's and the container's. A dock height change translates both rects identically, so the delta is unchanged and the cue is not stale. What DOES stale the cue is a change to the reading *measure*: §2.4's `Ctrl+B` rail toggle takes the sidebar 240px → 64px, widening `<main>`; below the frame's `max-w-[68rem]` cap that rewraps the justified `.quran-flow` (`max-width: 33em`), moving every word rect — and the only recovery is the every-30-frames re-anchor at Quran.tsx:584, i.e. up to ~500ms on the wrong word. Window resize has the same shape and is likewise uncovered. The listener as specified also calls `positionWordCue(cue, activeWordElementRef.current)` with no null guard; that ref is null between words and during the pauses in `hideCue`.

**Fix.** Rescope the invariant to "any chrome change that can alter the reading measure or the surface's box" and fire `salafi:layout-reflow` from the rail toggle, the dock height write, and a debounced `window.resize`. Guard the listener: `const w = activeWordElementRef.current; if (!w) return;`. Keep the §10.4 cue-anchor test but drive it with the rail toggle, which is the case that can actually fail.

### Verification — §10 automated tests cannot run in the checked-in harness

**Where.** §10 tests 1 and 4

**Why.** `scripts/harness/` drives headless Chromium against the built `dist/` bundle (README + probe.mjs), so (a) test 1's `audioElementHolder.current instanceof HTMLAudioElement` reaches for a module internal the production bundle does not expose — there is no way to write the assertion without a compiled-in test hook; and (b) test 4 requires the audio element to actually be un-paused with a finite `duration`, because `detectClockScale` (Quran.tsx:483) returns 0 until `element.duration` is finite and `tick` then returns early forever. The fixtures seed no audio and Chromium's autoplay policy blocks playback.

**Fix.** Add an explicit `window.__SALAFI_TEST__ = { audioElementHolder, mediaStore, mediaClock }` export behind an `import.meta.env` flag, and specify the fixture: a silent WAV data-URI of known duration plus `--autoplay-policy=no-user-gesture-required` on the Chromium launch. Tests 2, 3, 5, 6, 7 and 8 are implementable as written.

### Perf budget items stated but not observable by any tool this project has

**Where.** Part II budget carried into this part: "idle CPU at Tier 3 < 3%; GPU memory for the layer < 40MB; zero contribution to input latency"

**Why.** The only measurement rig in the repo is Playwright + headless Chromium on Linux (`/opt/pw-browsers/chromium`), with no GPU process and software rasterisation. None of those three numbers is observable there, and `cargo test` cannot run in this container either (gdk-3.0 missing). As written the budgets cannot fail, which means they will not be enforced.

**Fix.** Name the Windows procedure per budget: CPU% from the `msedgewebview2.exe` renderer and GPU processes in Task Manager → Details over a 60s idle sample; GPU memory from `chrome://gpu` in the WebView2 devtools; input latency as the delta from `event.timeStamp` to the next `requestAnimationFrame` callback, sampled over 200 keystrokes, compared against the same build with the ambient layer removed. Otherwise state that the budgets are advisory and unenforced.

### Cross-cutting deletions §9 — the stated grep reports false success and the site list is incomplete

**Where.** §9 row: "`window.confirm` | `Settings.tsx:174,198,211,225`"

**Why.** The actual call form at all four lines is a bare `confirm(...)`, not `window.confirm(...)` — a grep for `window.confirm` returns zero hits today and would mark the deletion complete before any work is done. There are also six sites, not four: `Library.tsx:266` and `Reminders.tsx:124` are equally native, equally unthemeable, and equally escape the focus trap the spec is introducing.

**Fix.** Grep for `\bconfirm\(` and list all six. Same class of problem in §10 test 6: `z-[0-9]` will match nothing once the Tailwind `z-*` keys from §0.1 exist, so the token lint passes trivially — assert instead that the only `z-` classes in the seven chrome files are drawn from the nine named scale keys.

### Stacking contract is one property away from inverting

**Where.** §0.1 assigns CommandPalette/SheetSettings `--z-overlay: 50`, ToastStack `--z-toast: 60`, TitleBar `--z-titlebar: 80`; §6.7 and §7.4 both portal into `#overlay-root`

**Why.** The ordering only works while `#overlay-root` has `z-index: auto` and no stacking context. Any future `z-index`, `transform`, `filter`, `opacity < 1` or `backdrop-filter` on that element traps all nine z values inside it, and the TitleBar at 80 lands *below* the palette — which silently reintroduces the exact `ReminderAlarm.tsx:215` trap (`fixed inset-0 z-50`, unclosable window) that §0.3 exists to fix.

**Fix.** Declare `#overlay-root { position: absolute; inset: 0; z-index: auto; }` with a comment naming the consequence, and add a §10 assertion that `getComputedStyle('#overlay-root')` reports `zIndex: 'auto'` and no transform/filter/opacity.

### Ambient contract hard rule "pause on video playback" has no signal in this spec

**Where.** §3 (whole section) — `mediaStore` is defined with no ambient consumer

**Why.** Part II requires the ambient layer to pause during video playback and never to animate or restart on route change. Before this spec, video only played on `/player`; after it, video plays on every route via `PlayerDocked`, so the condition becomes `mediaStore.lane === 'video' && state === 'playing'` — and §3 never wires it. If `AmbientLayer` reads that via a React subscription it re-renders on every lane change, which is how "never restart on route change" quietly becomes "restarts whenever the lane changes".

**Fix.** Specify a non-reactive `useMediaStore.subscribe((s, p) => …)` inside the ambient rAF owner that starts/stops the loop without re-rendering the component, and add an assertion that the ambient canvas has zero pending animation frames while the video lane is playing.

### Clock precision — resume point read from a 4Hz mirror

**Where.** §3.3: `{reciter, resumeAtSec: mediaClock.positionSec}`

**Why.** §3.2 defines `mediaClock` as written on `timeupdate`, which Chromium fires at roughly 4Hz. The recorded resume point is therefore up to 250ms stale at the moment of the claim, and recitation resumes mid-word.

**Fix.** Read `audioElementHolder.current?.currentTime` directly inside `claim()`. It is exact, costs nothing, and does not violate INV-4 — INV-4 forbids reading the clock *per animation frame*, not once per lane transition.

### Corpus rebuild churn from an over-broad store subscription

**Where.** §6.6 `CommandRegistry.localItems: (t: Translate) => CommandItem[]`, described in §6.1 as "local corpora, recomputed when their stores change"

**Why.** If `localItems` subscribes to `useRadioStore` as a whole it rebuilds all ~462 `CommandItem` objects — each with a `run` closure and a `fields` array — on every `playing`/`volume`/`playbackError` write, i.e. several times per second during playback, even while the palette is closed.

**Fix.** Select `stations`, `surahs` and `playlists` individually with `useStore(s => s.field)` and memo on those references only. Note it explicitly, since the natural first implementation is the wrong one.

### Feature floor asserted, not pinned

**Where.** §0.4 "WebView2 is Evergreen Chromium; `inert` is supported"; §2.3, §7.5, §8.4 rely on `@starting-style` and `transition-behavior: allow-discrete`; §5.3 on `document.startViewTransition`

**Why.** `webviewInstallMode: downloadBootstrapper` (tauri.conf.json) does give Evergreen, so the assertion is directionally right, but the spec never states the floor: `startViewTransition` is Chromium 111, `inert` 112, `@starting-style` and `transition-behavior` 117. All degrade gracefully except §8.4's sheet exit, which becomes a hard cut. The harness Chromium is far newer than any user's runtime, so the "checked by rendering" sweep cannot catch it.

**Fix.** State the floor (Chromium 117) in §0, and either add an `@supports (transition-behavior: allow-discrete)` fallback for the sheet exit or accept and document the hard cut.

### View transition captures the document root, including the mushaf

**Where.** §5.3 "Hard boundary: no `view-transition-name` … may be applied to `src/pages/Quran.tsx` …" combined with §5.4 "`Escape` … collapses to the dock and returns to the previous route"

**Why.** Chromium implicitly assigns `view-transition-name: root` to the document element for every `startViewTransition`, so the whole document — mushaf included — is snapshotted and cross-faded regardless of what §5.3 forbids on individual elements, and live rendering is suppressed for the transition's duration. §5.4 makes the destination route the *previous* route, which is frequently `/quran`. If recitation is playing, the cue keeps advancing in the live DOM behind a frozen snapshot, and the first live frame shows it several words further on.

**Fix.** Either opt the root out (`:root { view-transition-name: none }` and name only the art element, so only that element is captured), or skip the transition entirely when the destination route is `/quran`. Assert in the harness that no `::view-transition` pseudo-element is generated on a transition whose destination is `/quran`.

### Focus ring mechanism — the global outline and the two-tone token collide, and the token's inner stroke is the wrong ground

**Where.** §1.2 "`--ring-focus` for `:focus-visible`"; §4.4 tokens table; index.css:682-689 vs 586-588 and 1379-1385

**Why.** Three distinct problems. (a) index.css:682-689 applies `outline: 2px solid rgb(var(--accent-gold-rgb))` to every bare `button`/`a`/`[tabindex]`. Component classes neutralise it with `outline: none` before applying `box-shadow: var(--ring-focus)` (1379-1385). The spec's TitleBar buttons are bare `<button>`s with utility classes, so they get the *single-tone* ring the audit brief specifically calls out as failing — and if `--ring-focus` is also applied, both paint. (b) `--ring-focus`'s inner stroke is `rgb(var(--bg-main-rgb))`, the app ground — but the TitleBar sits on `bg-sidebar`, the dock on `.surface-2`, the palette on `.surface-3`. The separator ring is the wrong colour at three of the four surface levels the brief asks about. (c) `box-shadow: var(--ring-focus)` *replaces* `--elev-2`/`--elev-3` on `.surface-2`/`.surface-3` elements, so a focused overlay control loses its elevation.

**Fix.** State the mechanism once: every focusable chrome control uses `.icon-btn`/`.rule-row`/`.btn-*` (which already set `outline: none` + `--ring-focus`) or explicitly sets `outline: none` itself. Make the inner stroke surface-aware — `--ring-focus` should read a `--ring-ground` custom property that `.surface-2`/`.surface-3`/`.app-titlebar` each set to their own fill, defaulting to `--bg-main`. Where the ring must coexist with elevation, compose: `box-shadow: var(--ring-focus), var(--elev-3)`. Add a §10 gate that focuses every chrome control in all ten themes and asserts a computed ring with ≥3:1 against the element's own background.

### §1.5 RTL rationale is factually wrong for a decorations:false window

**Where.** §1.5 RTL — "On Windows the top-right 3×46px region is the snap-layouts hover zone and the OS close affordance; mirroring it is a bug, not localisation"

**Why.** With `decorations: false` (already set in tauri.conf.json, as §1.1 notes) Windows does not provide a snap-layouts flyout at all — the flyout is driven by the window procedure returning `HTMAXBUTTON` from `WM_NCHITTEST`, which nothing in this app does. So the cited hover zone does not exist. Separately, on an Arabic Windows install the OS *does* mirror the caption buttons to the top-left, so "mirroring is a bug" is the opposite of the platform convention. The conclusion — keep the buttons physically right — happens to be correct, but only because `App.tsx:45` pins `root.dir = 'ltr'` unconditionally. Basing a documented exception to the app's logical-property rule on a false premise means it will be re-litigated wrongly the next time someone considers lifting the dir pin.

**Fix.** Restate the rule as: "window buttons stay physically right because `html.dir` is pinned to `ltr` (App.tsx:45) and the frame therefore never mirrors. If the pin is ever lifted, mirror them — RTL Windows puts caption buttons at the top-left." Note separately that snap-layouts support requires a Rust-side `WM_NCHITTEST` handler and is currently absent, so it is not an argument either way.

### Scrim colour is a hardcoded alpha that the spec's own token lint does not catch

**Where.** §6.7 `bg-[rgb(var(--shade-rgb)/0.55)] backdrop-blur-sm`; §8.4 "Scrim as in §6.7"; §9 replacement `bg-[rgb(var(--shade-rgb))]`; §10 gate 6

**Why.** §10 gate 6 greps for `#[0-9a-f]{3,6}`, `rgba(`, `text-white`, `bg-black`, `primary-blue`, `z-[0-9]` — it does not match `rgb(`, so the arbitrary 0.55 alpha passes its own lint. The value is then duplicated across the palette and the sheet with no single source, which is exactly the six-hand-written-composed-values problem the Phase 0 audit found in the theme blocks. It also has real per-theme consequence: 0.55 of `--shade` over Pearl (the only light theme, `--bg-main-rgb: 243 246 247`) is a much heavier visual event than over Onyx, and §8.1's "instant, reversible" quick-settings drawer should not black out a light UI.

**Fix.** Declare `--scrim: rgb(var(--shade-rgb) / 0.55)` in the shared `:root` block with a `:root[data-surface-profile='light']` override at a lower alpha, expose it as a Tailwind `bg-scrim` key, and use that at both call sites. Extend §10 gate 6's pattern to `rgb\(` as well as `rgba\(`, allowing only the token definitions in index.css.

### Dock error state is not announced

**Where.** §4.4 "Error line: `text-warning-orange` for `stream`, `text-danger-red` for `file`"; §3.5 `errorKind`

**Why.** The dock's error line appears silently and is distinguished from the non-error state by colour alone — colour is the only signal named in the tokens table. A screen-reader user listening to a radio stream that drops learns nothing; a colour-blind user cannot distinguish `stream` (retryable) from `file` (not). §7.3's "any action failure" toast covers explicit user actions, not a stream that dies mid-listen.

**Fix.** Route lane errors through the toast store's assertive region (per the toast fix) or give the dock error line its own persistent polite region. Pair the colour with a glyph (`AlertCircle` / `FileX`) and a text label so the distinction is not colour-only (WCAG 1.4.1). The `retry()` action already exists on MediaTransport — surface it as a named button, not just a colour change.

### F6-to-toast conflicts with an active focus trap

**Where.** §7.6 "`F6` moves focus into the newest toast"; §0.4 useFocusTrap

**Why.** Toasts live in `#overlay-root`, which the trap never inerts, but the trap's focus-retention handler will pull focus straight back when F6 moves it out of the palette or sheet. The result is an inert-looking key. Conversely, if the trap ignores it, the user is now outside a modal that is still visually blocking.

**Fix.** Define the precedence: while an `overlay`-scope trap is active, F6 is a no-op and new toasts are announced via the live region only; the F6 hand-off resumes when the overlay closes. State it in §0.4's contract so `useFocusTrap` owns the rule rather than each consumer.

### Two-step destructive confirm is defeatable by key repeat

**Where.** §6.6 "`repair_database` and `remove_orphaned_entries` set `destructive: true` and render an inline two-step confirm"

**Why.** Replacing `window.confirm` is right — it escapes the trap and is unthemeable. But if step two is confirmed by the same `Enter` that triggered step one, a held or double-tapped Enter repairs the database with no intervening decision, which is worse than the native dialog it replaces. Nothing announces the state change to a screen reader either.

**Fix.** Require the confirm step to (a) move `aria-activedescendant` to a distinct confirm row, (b) ignore `Enter` for ~400ms after entering the confirm state, and (c) announce the pending confirmation through the palette's polite region. `Escape` cancels the confirm without closing the palette.

### Missing accessible names and TranslationKeys the spec assumes exist

**Where.** §2.4 `t('navigation')`; §4.6 `t('nowPlaying')`; §1.1 `windowMinimize`/`windowMaximize`/`windowRestore`/`windowClose`; §6.4 `+N more`; §7.2 `action.labelKey`

**Why.** Grepped src/i18n.ts: none of `navigation`, `nowPlaying`, `windowMinimize` exist. That is expected new work, but the spec should say so, because the Arabic side is the part that gets skipped — and `+N more` is specified as a bare count with no group context, so it announces as "12 more button" with no indication of what. `aria-valuetext` strings (see that finding) are a further set.

**Fix.** Add an explicit checklist of new TranslationKeys to §9 or a new subsection, en and ar both, covering: nav landmark, dock region, four window-control labels, transport labels, seek/volume valuetext templates, per-group `+N more` ("Show {n} more stations"), toast action labels, and the ten theme names. Gate it: assert every `TranslationKey` referenced in the seven chrome files resolves in both locales.

### §9 sans-stack replacement drops the bundled Arabic face for any element carrying font-sans

**Where.** §9 — "`['Segoe UI Variable Text', 'system-ui', 'sans-serif']`"

**Why.** The Arabic face is applied at `html[data-language='ar'] body` (index.css:646) as `'Plex Arabic', 'Segoe UI', Tahoma, …`. Because that rule targets `body` rather than the root, any descendant that re-applies Tailwind's `font-sans` utility overrides it and falls back to Segoe UI for Arabic — the bundled face silently stops being used. Replacing the unbundled `'Inter'` with a Segoe stack (which is otherwise correct for a Windows-only target) does not fix this and makes it harder to notice, since both stacks now resolve to something that renders.

**Fix.** Put `'Plex Arabic'` at the head of the Tailwind `sans` stack — `['Plex Arabic', 'Segoe UI Variable Text', 'system-ui', 'sans-serif']`. Plex Arabic has no Latin coverage conflict worth worrying about at the head of the stack for a Windows target; if it does, add a `font-arabic` family and forbid bare `font-sans` on Arabic content. Also note that Segoe UI Variable Text is Windows 11 only and is optically wrong below 12px — pair it with Segoe UI Variable Small for caption sizes, or accept the Windows 10 fallback.

### §10 verification has no accessibility gate

**Where.** §10 "Automated, must fail the build" — eight gates, none of them a11y

**Why.** The eight gates are excellent on the media/riwayah/token axes and cover zero of the axes this audit was asked about. There is no contrast assertion, no accessible-name assertion, no tab-order assertion, no focus-ring-visibility assertion, no ARIA-validity assertion, and no reduced-motion assertion — despite the manual sweep (10 themes × 2 languages) being explicitly justified by "several bugs appeared in exactly one theme or one direction", which is precisely the class of bug an automated sweep catches and a human sweep misses on the tenth repetition.

**Fix.** Add gates 9-13 running inside the existing `scripts/harness/` Playwright loop, across all ten themes and both languages: (9) axe-core with the `wcag2a`/`wcag2aa` tagsets on each route with the palette, sheet and dock open; (10) computed-contrast assertion per the contrast finding; (11) accessible-name assertion on every focusable chrome control; (12) tab-order snapshot asserting the sequence and that no trap leaks; (13) with `prefers-reduced-motion` emulated, assert no element has a computed `transition-duration > 0.02ms` and `document.startViewTransition` is never called.

### Perf budget ("Tier 0 Flat — zero cost"; idle CPU at rest)

**Where.** §5.3 CSS — `.ambient-root[data-tier='0'] .ambient-still, .ambient-root[data-tier='0'] .ambient-drift { opacity: 0; }` vs `.ambient-root[data-tier='1'] .ambient-drift { opacity: 0; animation-play-state: paused; }`

**Why.** `animation-play-state: paused` is applied at tier 1 only. Tier 0 sets `opacity: 0` and leaves the `amb-drift` keyframes running on three absolutely positioned `<i>` elements that carry `will-change: transform`. `prefers-reduced-motion` is covered by the `display: none` media query, but `motionPref === 'off'` and Performance Mode both resolve to tier 0 through `resolveTier` without that media query matching — so a user who explicitly turned background motion **off** still pays a permanently composited animation. Directly contradicts the tier-0 definition in the same document.

**Fix.** Change the selector to `.ambient-root[data-tier='0'] .ambient-drift, .ambient-root[data-tier='1'] .ambient-drift { opacity: 0; animation-play-state: paused; }` and gate `will-change: transform` behind `.ambient-root[data-tier='2'] .ambient-drift i` / `[data-tier='3']` so it is not standing on tiers that never move.

### Internal consistency of a spec that presents itself as measured

**Where.** §1.4 — "Six themes change accent"; §6 `setTimeout(() => delete root.dataset.themeSwitching, 260)`

**Why.** Two small factual slips in a document whose authority rests on being measured. (1) Comparing §1.4 against the current values in `src/index.css` — noor `236 195 102`→`38 198 196`, emerald `176 141 87`→`72 208 122` (:134), pearl `175 123 45`→`13 105 98` (:178), mushaf `200 164 93`→`126 196 96` (:203), blue `226 197 122`→`125 185 255` (:228), red `226 197 122`→`236 105 110` (:253), onyx `226 190 104`→`212 168 60` (:283) — that is **seven**, not six. mushaf-gold (:312), maktabah (:337) and samaa (:362) are unchanged. (2) The 260 ms teardown is a bare literal measured against `--dur-normal: 200ms` (`index.css:400`); it happens to clear it today, but raising the token silently cuts the transition mid-flight.

**Fix.** Correct the count to seven. Replace the hardcoded 260 with a read of `--dur-normal` plus a small margin, or clear the attribute on `transitionend`.

### Untestable assertion — battery and reduced-motion clamps have no measurement path in the harness

**Where.** §5.2 `batteryLow` / §5.4 "`batteryLow` from `navigator.getBattery()` behind a feature check"; §9 has no test for either

**Why.** Headless Chromium under Playwright exposes no battery, and there is no CDP domain to emulate one, so "pause under 20% battery" can never be exercised — it will ship untested and stay untested. `navigator.getBattery()` is additionally restricted to top-level secure contexts and can reject with `NotAllowedError` rather than being absent, which the stated feature check (presence only) does not handle; an unhandled rejection there would surface as a console error the harness already fails on (`shoot.mjs:168`).

**Fix.** Test the pure function, not the browser: `resolveTier` is already pure, so unit-test all 7 inputs exhaustively (3 motionPrefs x 10 themes x the boolean clamps) and assert one case per contract clause. For the integration path, inject the battery predicate — `ambientStore` takes a `batterySource: () => Promise<boolean>` defaulting to the real API — so the harness can drive it. Wrap the `getBattery()` call in try/catch and treat rejection identically to absence.

### Measurement targets the wrong artifact — §9.5 checks source, not shipped payload

**Where.** §9.5 "`du -b src/assets/ambient` ≤ 1 500 000" and §4.4 "Headroom 1023 KB. For calibration, `dist/assets/app-icon-CElKQprs.png` is 378 KB on its own."

**Why.** The current `dist/` is 1.5 MB total (`index-p0H6g_dU.js` 533 KB, `index-pyV75xKX.css` 94 KB, fonts ~487 KB, app-icon 378 KB). Adding 477 KB of ambient assets is a **32% increase in the entire web payload**, which the framing of "477 of 1500, headroom 1023" obscures — the budget number happens to equal the size of the whole existing app. And `du -b src/assets/ambient` measures the source directory, not `dist/`: it misses the CSS growth from four profile blocks plus ten rewritten theme blocks, the new JS (catalog, tier, applyTheme, AmbientLayer, StarfieldCanvas, ThemePreview, ThemePicker, ambientStore), and any Vite inlining decisions.

**Fix.** Assert on the build output instead: after `npm run build`, sum `dist/assets/*` and assert total ≤ a stated ceiling, plus a separate per-artifact assertion that `dist/assets/index-*.js` grows by less than 15 KB gzipped and `index-*.css` by less than 8 KB gzipped. Dropping the WebP derivatives (see the image-set finding) brings the ambient contribution to ~241 KB, about 16% rather than 32%.

### Reduced-motion guarantee is JS-only and out-specifies the existing CSS backstop

**Where.** §6 `html[data-theme-switching] *:not(...) { transition: ... !important }` guarded only by `applyTheme`'s `matchMedia` check

**Why.** `src/index.css:2351-2362` is a deliberate global backstop — `*, *::before, *::after { transition-duration: 0.01ms !important; ... }` inside `@media (prefers-reduced-motion: reduce)`, documented as "deliberately outside @layer and uses !important so it wins over utilities regardless of source order." The new rule's selector specificity is roughly (0,7,1) versus the backstop's (0,0,0), and both are `!important` in the author origin, so the new rule wins and the backstop no longer protects the theme switch. The only defence left is the JS guard in `applyTheme`, which means any other code path that sets `data-theme-switching` — a future preview, a test, a hot-reload — reintroduces motion for reduced-motion users.

**Fix.** Wrap the rule in `@media (prefers-reduced-motion: no-preference) { ... }` so the guarantee is structural, and keep the JS check as belt-and-braces. Add a harness case: `page.emulateMedia({ reducedMotion: 'reduce' })`, switch theme, assert `getComputedStyle(document.querySelector('.surface-2')).transitionDuration` is ≤ 0.01s.

### Incorrect claim about background-image interpolation, plus a main-thread AVIF decode during the switch

**Where.** §6 "`background-image` interpolates because our fills are the same gradient shape with different stops" + "The plate themes swap `background-image` via `[data-theme]` — no remount, no reflow."

**Why.** The claim holds only for gradient-to-gradient with matching stop structure. `.ambient-still` on the two plate themes carries an `image-set()` of a raster AVIF; switching from Mushaf Gold to Maktabah transitions between two different images, which CSS cannot interpolate — Chromium falls back to a discrete swap at the 50% mark, so a 260 ms transition produces a hard cut halfway through, which reads as a glitch rather than a cut. Worse, the transition forces the incoming 1280px AVIF to decode during the switch; a first-time decode of a ~96 KB AVIF at 1280px is main-thread work landing inside the same 260 ms window that is already doing a whole-tree style recalc.

**Fix.** Exclude `.ambient-still` and `.ambient-flat` from the transition property list and cross-fade the ambient explicitly instead: two stacked `.ambient-still` elements, fade `opacity` (compositor-only) between them. Preload the incoming plate before flipping `data-theme` — `await new Image().decode()` on the AVIF, then apply — so the decode happens off the critical window. Both plates together are under 200 KB, so eagerly decoding both at app start is also defensible.

### Contract conflict — tier change on route entry is itself an animation on route change

**Where.** §5.3 "`.ambient-still, .ambient-drift { transition: opacity var(--dur-slow) var(--ease-out) }`" + §5.4 routeCap effect, against the contract's "NEVER animate/restart on route change"

**Why.** Entering `/quran` drops tier 2→1 and fades `.ambient-drift` out over `--dur-slow`; leaving fades it back in. The animation timeline is correctly preserved (the spec's core insight — pausing rather than unmounting — is right), but an opacity fade is still literally an animation triggered by a route change, which is the clause the contract writes in capitals. It is probably the desired behaviour, but the spec should not claim compliance while doing it.

**Fix.** State the exception explicitly: "the drift timeline never restarts on route change; the layer's opacity crossfades over --dur-slow." Then have §9 assert the part that actually matters — capture `getAnimations()[0].currentTime` on `.ambient-drift i` before navigating to `/quran` and after navigating back, and assert it advanced monotonically and did not reset to 0.

### Spec incompleteness — the preview variant conflicts with the CSS the spec writes

**Where.** §5.3 "`.ambient-root { position: fixed; inset: 0; ... contain: strict; }`" vs §5.1 "'preview' fills its positioned parent"

**Why.** There is one `.ambient-root` rule and it is unconditionally `position: fixed` with `contain: strict`. A preview instance would escape its 400x260 parent (or be accidentally contained only because `.theme-preview-inner`'s `transform: scale(0.5)` happens to create a containing block for fixed descendants — a coincidence, not a design, and it breaks the moment the scale technique changes). `contain: strict` also implies size containment, which is fine for `inset: 0` but not for an auto-sized preview root.

**Fix.** Add the variant rule: `.ambient-root[data-variant='preview'] { position: absolute; contain: layout paint; }` and have the component set `data-variant`. Assert in the harness that `.theme-preview .ambient-root` computes `position: absolute` and that its `getBoundingClientRect()` is contained within its parent's.

### Undercounted migration — the alpha-modifier offenders are five files, not one

**Where.** §1.2 "A grep test forbids `border-border/`, `border-strong/`, `border-faint/` (one current offender, `RadioMiniPlayer.tsx:187`, which is being rewritten as `PlayerDocked` anyway)."

**Why.** There are at least five, in files the spec does not list as edited: `src/components/reminders/ReminderCard.tsx:44` (`border-border-strong/60 bg-border-strong/30 hover:border-border-strong`), `src/pages/Watch.tsx:201`, `src/pages/Radio.tsx:254`, `src/pages/Settings.tsx:66`, `src/pages/Downloads.tsx:465`. Two of them use `bg-border-strong/30`, a background modifier the prose does not mention. The behaviour is pre-existing (today's `tailwind.config.js:25` already defines `'border-strong': 'rgb(var(--hair-rgb) / 0.26)'` with no `<alpha-value>`, so the `/60` and `/30` modifiers are already silently dropped), so this is not a regression the spec introduces — but §9.4's grep test will fail on day one against five files across four pages, and the migration effort is understated. Separately, the prose claim "`--border-strong` 0 uses" is true of the CSS custom property but sits one line from a Tailwind colour of nearly the same name that *is* used; worth disambiguating so a reader does not delete the wrong thing.

**Fix.** List all five files in §10 Edited, and specify the intended replacement per site (they read as "a filled chip at strong hairline alpha", which now wants a `--wash-*` token, not a border colour at 30% of an already-alpha'd colour). Word the §9.4 grep to catch the `bg-` form too, and rename either the CSS var or the Tailwind colour so `--border-strong` and `border-strong` are not two different things.

### Untestable assertion — §9.2's cardinality test can pass while nothing renders differently

**Where.** §9.2 "Assert the set of **distinct** tuples has cardinality exactly **4**. This is the test that stops ten themes becoming ten design systems"

**Why.** The test reads resolved custom-property values off `:root`. It proves the token layer collapses to four; it does not prove any of those four tokens reaches a pixel. Two of the five properties it samples (`--glass-a`, `--glass-blur`) currently have no rendering consumer at all — `.surface-3` is used zero times in `.tsx`, and `.app-sidebar`'s fill is an opaque call-site utility. So the headline test would report a clean four-way collapse for an axis that is invisible in the shipped app, which is precisely the kind of green test that lets a real regression through.

**Fix.** Pair the token test with a rendered test: screenshot one representative surface per profile at a fixed viewport and assert the four images are pairwise different by more than a pixel-diff threshold, and that themes sharing a profile are pairwise identical apart from hue. That measures the claim the spec is actually making — "four distinct materials" — rather than "four distinct variable tuples".

### Unspecified mechanism — the 30fps cap on Tier 3

**Where.** §3.2 item 5 "Tier 3 adds a 2D-canvas starfield, ≤ 220 points, 30 fps cap" and §5.5 "Tier 3 is 2D canvas at 30 fps"

**Why.** No implementation is given, and the naive one (skip every other rAF) still schedules a callback at the display refresh rate — on a 120 Hz or 144 Hz laptop panel, "every other frame" is 60-72 fps, not 30, and the main thread still wakes at full refresh either way. The cap is stated as a budget line but is neither specified nor measured.

**Fix.** Specify accumulator pacing against `performance.now()` with a 33.33 ms target and an explicit last-draw timestamp, so the rate is display-independent; the rAF wake itself is cheap if the callback early-returns. Assert it: count actual canvas draw calls (not rAF callbacks) over 10s and require 295-305, on both a 60 Hz and an emulated high-refresh context.

### Audit brief 'no Arabic text below 12px (dots and marks stop resolving)'

**Where.** §8.2 'At a native 200 px the 11.5 px caption step and the 1 px hairlines render as sub-pixel mud'; §8.4 ThemePicker 'keeps the label + description text'

**Why.** `--fs-cap: 11.5px` (index.css:421) is `text-xs`, and there are 68 further `text-[11px]`/`text-[10px]` sites across components and pages. Settings.tsx:463 uses `text-[11px]` for the theme section caption and the per-theme description is `text-xs`. At 11.5px Arabic tashkeel and i'jam stop resolving on a 1x Windows display, and the spec reaffirms the 11.5px caption step as a design element rather than flagging it. The 2x-then-scale(0.5) technique in §8.2 fixes the preview's hairlines but the caption text around it is real UI text at the real size.

**Fix.** Add a floor under `html[data-language='ar']`: `--fs-cap: 12.5px`, and clamp the `text-[10px]`/`text-[11px]` arbitraries. Add a harness assertion (§9.7) that no element containing Arabic text computes a font-size below 12px, swept in the ar direction across all eight routes — the harness already iterates both languages.

### Accessible name computation; audit brief 'does every icon-only control have an accessible name?'

**Where.** §8.4 'keeps the label + description text and the Check mark already at Settings.tsx:492-495'

**Why.** Settings.tsx:494 is `<Check className="h-4 w-4 text-accent-gold" aria-label={t('applied')} />` inside a `role="radio"` button. `aria-label` on an `<svg>` without `role="img"` is not reliably exposed by Narrator/NVDA, and where it is exposed it concatenates into the radio's name-from-contents, so the checked option announces as 'Noor Teal, deep teal ink…, Applied, radio button, checked' — duplicating `aria-checked` and lengthening every announcement. Once §7 removes the swatches and §8 makes the preview aria-hidden, this icon is the only remaining non-text child, so it is worth fixing in the same edit.

**Fix.** Make the Check `aria-hidden="true"` and let `aria-checked` carry the state, which it already does. If a visible text affordance is wanted for the checked row, put it in the label, not in an icon attribute.

### Correctness — containing block for position:fixed

**Where.** §2.3 `html[data-video-playing] .surface-3, html[data-video-playing] .app-sidebar { -webkit-backdrop-filter: none; backdrop-filter: none; }`

**Why.** A non-`none` `backdrop-filter` establishes a containing block for `position: fixed` descendants, so toggling it to `none` and back at runtime re-parents any fixed-position descendant's coordinate system mid-session. PlaylistMenu.tsx:90 is `fixed z-[9999]` positioned from a measured trigger rect; UpdateManager.tsx:58 is `fixed bottom-5 right-5`. If either is open inside a `.surface-3` or `.app-sidebar` subtree when video playback starts or stops, it jumps — the kind of bug that only appears in one interaction order and is hard to attribute later.

**Fix.** Keep `backdrop-filter` declared at all times and vary only the blur radius — `blur(0px)` still establishes the containing block, so semantics stay constant — or move the video-playing fallback onto a wrapper with no fixed-position descendants. The same reasoning is why `--glass-blur: 0px` on the pure-black profile is fine: it keeps the property present.

### prefers-reduced-motion honoured; cascade correctness

**Where.** §6 `html[data-theme-switching] *:not(...) { transition: ... !important; }` and `applyTheme`'s `!matchMedia('(prefers-reduced-motion: reduce)').matches` guard

**Why.** Three issues. (a) The rule's position in the file is unspecified; index.css ends with a deliberately-outside-@layer `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; } }` at :2351. Two `!important` declarations of equal specificity resolve by source order, so if the theme-switching rule lands after it, reduced-motion users get 200ms transitions whenever the JS guard is bypassed. (b) It is the `transition` shorthand with `!important`, so it replaces `.ambient-still`/`.ambient-drift`'s own `transition: opacity var(--dur-slow)` from §5.3 — the spec's own ambient crossfade is overridden by the spec's own rule. (c) `matchMedia(...).matches` is read once per `applyTheme` call with no `change` listener, so enabling Reduce Motion in Windows mid-session has no effect until the next call; the same single-read pattern appears in `TierInputs.reducedMotion` with no listener specified.

**Fix.** State that the theme-switching rule is placed before the final reduced-motion block, or scope it inside `@media (prefers-reduced-motion: no-preference)`. Use transition longhands (`transition-property`/`-duration`/`-timing-function`) so the ambient layer's own transition survives. Specify a `change` listener on the reduced-motion MediaQueryList feeding both `applyTheme` and the ambient store.

### WCAG 1.4.3 — §9.6 test coverage

**Where.** §9.6 'Port the accent table of §1.4 into a script asserting --accent-rgb vs --bg-main-rgb ≥ 4.5:1 and vs --bg-card-rgb ≥ 4.5:1 in all ten themes.'

**Why.** This tests one token against two grounds and calls the theme AA-clean. It does not test the four text steps, which already fail and which the spec then perturbs: Samaa's `--text-faint-rgb: 92 118 135` on `--bg-card-hover-rgb: 52 72 93` computes to 2.05:1 (recomputed), and text-faint is what inactive nav icons and card metadata use (Sidebar.tsx:112). §1.3 also changes two grounds — noor `3 4 4` → `4 12 13` with its whole ladder, mushaf `5 7 6` → `3 4 3` — without re-verifying any text step against them, and the warm/cool profiles tint every surface by `--fill-tint-pct` (2–3% accent or accent-2), shifting the actual background text sits on away from the raw `--bg-*-rgb` §9.6 measures.

**Fix.** Extend §9.6 to a matrix: `--text-main-rgb`, `--text-soft-rgb`, `--text-muted-rgb` at ≥4.5:1 and `--text-faint-rgb` at ≥3:1 (or reclassify it as decorative and prove it carries no information), each against the resolved `--surf-1/2/3` rather than raw `--bg-*-rgb`, in all ten themes. Fix the samaa/text-faint pair and any siblings in the same commit as the §1.3 ground corrections.

### Factual accuracy of the spec's own audit claims

**Where.** §1.2 'The three border-* entries lose <alpha-value> on purpose'; §1.2 'the ~6 stray dead-accent sites (QueuePanel.tsx:86,92,145,151, PlayerHeader.tsx:41,45)'

**Why.** Neither matches the tree. tailwind.config.js:24-26 already declares `border: 'rgb(var(--hair-rgb) / 0.13)'`, `'border-strong': ... / 0.26`, `'border-faint': ... / 0.07` — none carries `<alpha-value>` today, so nothing is lost and the sentence will confuse whoever implements it. The dead-accent count is off by 5x: `primary-blue` alone appears ~30 times across ReminderAlarm, UpdateManager, ProgressBar, VideoPlayer, PlayerHeader, PlayerControls, QueuePanel, RadioMiniPlayer and PlayerPage. This matters because the migration risk in the text-white finding scales with that count, and the schedule was written against six.

**Fix.** Correct both claims. Enumerate the ~30 `primary-blue` sites in §10 as Edited files (PlayerControls.tsx, ProgressBar.tsx, UpdateManager.tsx, ReminderAlarm.tsx, VideoPlayer.tsx, PlayerPage.tsx in addition to the two already listed), or state explicitly that the deprecated alias is load-bearing until a named follow-up removes it.
