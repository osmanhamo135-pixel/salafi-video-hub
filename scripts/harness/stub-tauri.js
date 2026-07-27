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
      var verses = surah ? surah.total_verses : 7;
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
    get_quran_synced_audio: function () { return null; },
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

  // The app is Windows-only and draws its own title bar; without this the
  // OS-detection path can take a branch the real build never takes.
  Object.defineProperty(navigator, 'userAgent', {
    get: function () { return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SalafiHubHarness/1.0'; },
    configurable: true,
  });
})();
