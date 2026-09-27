/* Drives the 3D board with a day's departure schedule, sliced by the time of day at the airport.
   Usage: DEPARTURES.init(boardApi, { url: '/assets/data/ewr-departures.json' })
   Time override for testing: ?t=HH:MM, ?t=2026-09-09T18:30, or ?t=<unix seconds>; ?speed=N multiplies the clock. */
(function () {
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fit(str, n, right) { str = String(str || ''); if (str.length > n) str = str.slice(0, n); while (str.length < n) str = right ? ' ' + str : str + ' '; return str; }

  // seconds since local midnight at the airport for a given instant
  function secondsOfDay(date, tz) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date);
    var h = 0, m = 0, s = 0;
    parts.forEach(function (p) { if (p.type === 'hour') h = +p.value % 24; if (p.type === 'minute') m = +p.value; if (p.type === 'second') s = +p.value; });
    return h * 3600 + m * 60 + s;
  }

  function parseOverride(v, tz) {
    if (!v) return null;
    var m = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60;
    if (/^\d{9,}$/.test(v)) return secondsOfDay(new Date(+v * 1000), tz);
    m = /T(\d{1,2}):(\d{2})/.exec(v);
    if (m) return (+m[1]) * 3600 + (+m[2]) * 60;
    return null;
  }

  function init(board, opts) {
    if (!board) return;
    opts = opts || {};
    var q = new URLSearchParams(location.search);
    var speed = Math.max(0, parseFloat(q.get('speed') || '1')) || 1;

    fetch(opts.url).then(function (r) { return r.json(); }).then(function (data) {
      var tz = data.tz || 'America/New_York';
      var dayStart = data.rows.length ? data.rows[0][0] - secondsOfDay(new Date(data.rows[0][0] * 1000), tz) : 0;
      var flights = data.rows.map(function (r) {
        return { sched: r[0] - dayStart, est: r[1] ? r[1] - dayStart : null, flight: r[2], airline: r[3], city: r[4], iata: r[5], gate: r[6] };
      }).sort(function (a, b) { return a.sched - b.sched; });

      var override = parseOverride(q.get('t'), tz);
      var startReal = Date.now();
      var startClock = override != null ? override : secondsOfDay(new Date(), tz);
      function now() { return (startClock + (Date.now() - startReal) / 1000 * speed) % 86400; }

      var HEADER = '        EWR DEPARTURES', PER_PAGE = board.rows - 1, PAGE_SECONDS = 14, page = 0, lastKey = '';

      function status(f, t) {
        var dep = f.est || f.sched;
        if (dep <= t - 60) return 'DEPARTED';
        if (f.est && f.est - f.sched >= 600) return dep - t <= 20 * 60 ? 'BOARDING' : 'DELAYED';
        if (dep - t <= 8 * 60) return 'FINAL CALL';
        if (dep - t <= 35 * 60) return 'BOARDING';
        return 'ON TIME';
      }
      function line(f, t) {
        var h = Math.floor(f.sched / 3600) % 24, m = Math.floor(f.sched / 60) % 60;
        // 54 columns: 2 blank, time 5, flight 7, destination 16, code 3, gate 5, status 11, with single spaces between
        return '  ' + fit(pad2(h) + ':' + pad2(m), 5) + ' ' + fit(f.flight, 7) + ' ' + fit(f.city, 16) + ' ' + fit(f.iata, 3) + ' ' + fit(f.gate, 5) + ' ' + fit(status(f, t), 11);
      }
      function upcoming(t) {
        // show flights from roughly 20 minutes ago onward; wrap to the start of the day when the evening runs out
        var cut = t - 20 * 60, i = 0;
        while (i < flights.length && (flights[i].est || flights[i].sched) < cut) i++;
        var out = [];
        for (var k = 0; k < PER_PAGE * 2; k++) out.push(flights[(i + k) % flights.length]);
        return out;
      }
      function render(force) {
        var t = now(), list = upcoming(t), slice = list.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
        var lines = [HEADER].concat(slice.map(function (f) { return line(f, t); }));
        var key = lines.join('|');
        if (key !== lastKey || force) { board.setLines(lines, true); lastKey = key; }
      }
      render(true);
      if (board.still) { setInterval(function () { render(false); }, 60000); }
      else { setInterval(function () { page = 1 - page; render(true); }, PAGE_SECONDS * 1000); setInterval(function () { render(false); }, 5000); }
      window.DEPARTURES.state = { now: now, flights: flights, override: override, speed: speed };
    }).catch(function (e) { console.warn('departures: schedule unavailable, board stays in demo mode', e); });
  }
  window.DEPARTURES = { init: init };
})();
