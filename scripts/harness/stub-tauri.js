/**
 * A stubbed Tauri host, injected before the app bundle runs.
 *
 * The app talks to Rust through exactly one door — `window.__TAURI_INTERNALS__`
 * — so standing that object up in a plain browser is enough to mount the whole
 * React tree without a Rust build. Plugin calls (dialog, notification, updater,
 * process, window, event) arrive through the same door as `plugin:name|method`,
 * so they are handled by prefix rather than enumerated.
 *
 * Written as a classic script, not a module: it must finish executing before
 * the app's first import runs.
 */
(function () {
  var F = window.__HARNESS_FIXTURES__ || {};
  var seen = Object.create(null);

  function clone(v) {
    return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  }

  var handlers = {
    get_settings: function () {
      return Object.assign({}, F.settings, window.__HARNESS_SETTINGS__ || {});
    },
    update_settings: function (a) { return Object.assign({}, F.settings, a && a.settings); },
    get_all_videos: function () { return F.videos; },
    get_video: function (a) { return F.videos.find(function (v) { return v.id === (a && a.videoId); }) || null; },
    get_videos_by_ids: function (a) {
      var ids = (a && a.videoIds) || [];
      return F.videos.filter(function (v) { return ids.indexOf(v.id) !== -1; });
    },
    get_videos_by_playlist: function (a) {
      var pl = F.playlists.find(function (p) { return p.id === (a && a.playlistId); });
      if (!pl) return [];
      return pl.videoIds.map(function (id) { return F.videos.find(function (v) { return v.id === id; }); }).filter(Boolean);
    },
    search_videos: function (a) {
      var q = ((a && a.query) || '').toLowerCase();
      if (!q) return F.videos;
      return F.videos.filter(function (v) { return v.title.toLowerCase().indexOf(q) !== -1; });
    },
    get_all_playlists: function () { return F.playlists; },
    get_playlist: function (a) { return F.playlists.find(function (p) { return p.id === (a && a.playlistId); }) || null; },
    get_playlist_stats: function () { return F.stats; },
    get_continue_watching: function () {
      return F.videos
        .filter(function (v) { return v.progressSeconds > 0 && !v.completed; })
        .slice(0, 12)
        .map(function (v) {
          return { video: v, playlist: F.playlists.find(function (p) { return p.videoIds.indexOf(v.id) !== -1; }) || null };
        });
    },
    get_recently_added: function () { return F.videos.slice(0, 12); },
    get_all_reminders: function () { return F.reminders; },
    get_radio_stations: function () { return { stations: F.stations, fromCache: false, fetchedAt: F.now }; },
    get_quran_surahs: function () { return F.surahMeta; },
    get_quran_surah: function (a) {
      var id = (a && a.surahId) || 1;
      return F.surahPayloads[id] || F.surahPayloads[1];
    },
    get_quran_reciters: function () { return F.reciters; },
    youtube_channel_catalog: function (a) {
      // The store asks for QUICK_LIMIT (90) on a routine refresh and 0 for
      // the whole channel; serving exactly the cap makes the truncation
      // banner and the "90+" count real in screenshots.
      var limit = a && typeof a.limit === 'number' ? a.limit : 90;
      var count = limit === 0 ? 240 : Math.max(limit, 12);
      var vids = [];
      for (var i = 1; i <= count; i += 1) {
        vids.push({
          id: 'ch-' + i,
          title: i % 5 === 0
            ? 'فوائد شرح منظومة الآداب الشرعية لفضيلة الشيخ — الدرس ' + i + ' — باب ما يقال عند دخول المسجد وآدابه'
            : 'شرح كتاب التوحيد — الدرس ' + i,
          channel: 'قناة الشيخ',
          durationSeconds: 1800 + i * 60,
          thumbnail: 'asset://localhost/thumb-' + i,
          url: 'https://www.youtube.com/watch?v=ch-' + i,
          viewCount: 1000 + i,
        });
      }
      // Geometric avatar only — an octagram on a plain field, never a face
      // or silhouette (manhaj: no animate beings, harness art included).
      var avatar = 'data:image/svg+xml;utf8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
        '<circle cx="48" cy="48" r="48" fill="#10233d"/>' +
        '<path d="M48 14 L56.5 39.5 L82 48 L56.5 56.5 L48 82 L39.5 56.5 L14 48 L39.5 39.5 Z" fill="#c9a227"/>' +
        '</svg>'
      );
      return {
        channel: 'قناة الشيخ صالح',
        channelUrl: (a && a.channelUrl) || '',
        channelAvatar: avatar,
        channelHandle: '@shaykh-salih',
        subscriberCount: 231000,
        videos: vids,
      };
    },
    /* One synced reciter, so the Read tab's whole transport cluster — play,
       repeat, times, speed — actually renders in the harness. It returned []
       for months, which silently excluded every one of those controls from
       every probe and screenshot. */
    get_quran_word_timing_reads: function () {
      return [{ id: 7, name: 'Mishari Rashid al-Afasy', nameAr: 'مشاري راشد العفاسي', timingLevel: 'word', folderUrl: 'https://example.invalid/afasy/' }];
    },
    get_quran_synced_audio: function (a) {
      // Deterministic 4s-per-ayah timings for whatever surah is asked for.
      var surah = (F.surahMeta || []).find(function (s) { return s.id === (a && a.surahId); });
      var verses = surah ? surah.totalVerses : 7;
      var ayahTimings = [];
      var wordTimings = [];
      var wordsByAyah = [];
      for (var v = 1; v <= verses; v += 1) {
        var start = (v - 1) * 4000;
        ayahTimings.push({ ayah: v, startMs: start, endMs: start + 3900 });
        var words = ['كلمة', 'كلمة', 'كلمة'];
        wordsByAyah.push({ ayah: v, words: words });
        for (var w = 1; w <= words.length; w += 1) {
          wordTimings.push({ ayah: v, wordIndex: w, startMs: start + (w - 1) * 1200, endMs: start + w * 1200 });
        }
      }
      return { audioUrl: 'https://example.invalid/afasy/' + (a && a.surahId) + '.mp3', ayahTimings: ayahTimings, wordTimings: wordTimings, wordsByAyah: wordsByAyah };
    },
    // The full-catalog disk cache always misses in the harness — write and
    // remove fall through to the silent-success default below.
    shuyukh_catalog_cache_read: function () { return null; },
    /* The browser cannot shape, so the outline fallback is served from a
       fixture dumped by the Rust shaper. Only surah 1 is covered; any other
       word simply comes back null and keeps its text, which is exactly what
       the real command does when a word cannot be shaped. */
    shape_mushaf_words: function (a) {
      var fx = (F && F.mushafShape) || { upem: 0, glyphs: [], words: {} };
      var known = {};
      (a.knownGlyphs || []).forEach(function (id) { known[id] = true; });
      var words = (a.words || []).map(function (w) { return fx.words[w] || null; });
      var need = {};
      words.forEach(function (w) {
        if (!w) return;
        w.p.forEach(function (p) { if (!known[p.g]) need[p.g] = true; });
      });
      return {
        upem: fx.upem,
        glyphs: (fx.glyphs || []).filter(function (g) { return need[g.id]; }),
        words: words,
      };
    },
    // The ad-free stream resolver, so the inline player on the Shuyukh page
    // (and the Watch player) mounts in the harness. The media URL is dead —
    // the player chrome renders; playback itself is not the harness's job.
    youtube_resolve: function (a) {
      return {
        videoId: 'stub-video',
        videoUrl: 'https://example.invalid/stream.mp4',
        title: 'شرح كتاب التوحيد — الدرس الأول',
        channel: 'قناة الشيخ صالح',
        durationSeconds: 1930,
        thumbnail: 'asset://localhost/thumb-1',
        sourceUrl: (a && a.url) || '',
        height: 720,
      };
    },
    get_ffmpeg_status: function () { return { status: 'bundled', ffmpegPath: null, ffprobePath: null }; },
    get_diagnostics: function () {
      return {
        appVersion: '1.21.0', databasePath: 'C:\\Users\\osman\\AppData\\Roaming\\salafi-video-hub\\library.db',
        videoCount: F.videos.length, playlistCount: F.playlists.length,
        orphanedEntries: 0, thumbnailCacheBytes: 41_222_144,
      };
    },
    check_file_exists: function () { return true; },
    allow_video_asset_path: function () { return null; },
    allow_reminder_sound_path: function () { return null; },
    save_progress: function () { return null; },
  };

  function respond(cmd, args) {
    seen[cmd] = (seen[cmd] || 0) + 1;

    if (handlers[cmd]) return clone(handlers[cmd](args));

    // Plugin traffic. Nothing here should ever open a real dialog or fire a
    // real notification during a screenshot run.
    if (cmd.indexOf('plugin:') === 0) {
      if (cmd.indexOf('plugin:event|listen') === 0) return 0;
      if (cmd.indexOf('plugin:event|unlisten') === 0) return null;
      if (cmd.indexOf('plugin:app|version') === 0) return '1.21.0';
      if (cmd.indexOf('plugin:os|') === 0) return 'windows';
      if (cmd.indexOf('plugin:updater|check') === 0) return null;
      if (cmd.indexOf('plugin:dialog|') === 0) return null;
      if (cmd.indexOf('plugin:notification|is_permission_granted') === 0) return true;
      return null;
    }

    // Mutations and fire-and-forget commands: succeed silently rather than
    // reject, so one unstubbed call cannot blank a route behind an error state.
    return null;
  }

  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
    plugins: {},
    convertFileSrc: function (path) { return 'asset://localhost/' + encodeURIComponent(String(path)); },
    transformCallback: function (cb) {
      var id = Math.floor(Math.random() * 1e9);
      window['_' + id] = cb || function () {};
      return id;
    },
    invoke: function (cmd, args) {
      try {
        return Promise.resolve(respond(cmd, args));
      } catch (e) {
        return Promise.resolve(null);
      }
    },
  };
  window.__TAURI__ = window.__TAURI_INTERNALS__;
  window.__HARNESS_CALLS__ = seen;

  // One seeded shaykh profile, so the Shuyukh route shows a live card rather
  // than its empty state in every harness consumer. lastSeenVideoId points a
  // few entries into the stub catalog, which makes the "new" badge real.
  try {
    if (!localStorage.getItem('salafi-hub.shuyukh.v1')) {
      localStorage.setItem('salafi-hub.shuyukh.v1', JSON.stringify([{
        id: 'sh-fixture-1',
        name: 'الشيخ عبد الرزاق البدر',
        channelUrl: 'https://www.youtube.com/@sheikhalbadr',
        channelName: null,
        channelAvatar: null,
        channelHandle: null,
        subscriberCount: null,
        lastSeenVideoId: 'ch-4',
        newCount: 0,
        lastCheckedAt: null,
      }]));
    }
  } catch (e) { /* storage is best-effort in the harness */ }

  // The app is Windows-only and draws its own title bar; without this the
  // OS-detection path can take a branch the real build never takes.
  Object.defineProperty(navigator, 'userAgent', {
    get: function () { return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SalafiHubHarness/1.0'; },
    configurable: true,
  });
})();
