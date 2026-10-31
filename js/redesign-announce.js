// Site-wide announcement pop-up. Reads data/announcement.json and, if it is
// active, shows a dismissible modal after the intro finishes. The admin picks
// how long it keeps showing via "mode":
//   "once"        - a single time per visitor (any close ends it). Default.
//   "acknowledge" - returns every visit until the visitor clicks the primary
//                   "don't show again" button; a casual close (X / Esc) only
//                   hides it for that browser session.
//   "untilDate"   - shows every session until "endDate" (YYYY-MM-DD) passes,
//                   then comes down on its own; a close hides it for the session.
// "id" keys the memory, so posting a new message (new id) re-shows it to
// everyone. Add ?announce to the URL to preview. Fully editable from the CMS.
//
// Running one message for a set time, then going back to another:
//   "until": "YYYY-MM-DD"  - after the end of that day this message is skipped...
//   "then":  { ... }       - ...and this one (a whole announcement) is used instead.
// So a 10-day message can sit in front of the usual welcome and step aside by itself.
//
// Champions: "champions": [{ "label": "Boys", "items": [{ "school", "division", "logo" }] }]
// shows the winners' logos in groups; "icon": "xc" puts a cross-country runner badge on top,
// and "iconLogo" (an image path) puts that logo in the circle with the runner badge under it.
// An item with "photo" is drawn as a large team-photo card (the team picture on top,
// the school and title under it); "icon": "trophy" puts a trophy badge on top.
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        fetch('data/announcement.json', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (a) {
                a = current(a);
                if (!a || !a.active || !a.title) return;
                var id = a.id || 'announcement';
                var mode = a.mode || (a.frequency === 'always' ? 'always' : 'once');
                var force = /[?&#]announce\b/i.test(location.search + location.hash);
                if (!force && !shouldShow(mode, id, a.endDate)) return;
                waitForIntro(function () { render(a, id, mode, force); });
            })
            .catch(function () { /* no announcement, no problem */ });
    });

    // The message in force today: skip any whose "until" date has passed.
    function current(a) {
        for (var i = 0; a && a.until && i < 10; i++) {
            var e = endOfDay(a.until);
            if (isNaN(e) || Date.now() <= e) break;
            a = a.then || null;
        }
        return a;
    }

    // ---- storage + gating ----------------------------------------------
    function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lset(k) { try { localStorage.setItem(k, '1'); } catch (e) {} }
    function sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function sset(k) { try { sessionStorage.setItem(k, '1'); } catch (e) {} }
    function endOfDay(d) { var t = new Date(String(d).slice(0, 10) + 'T23:59:59'); return isNaN(t.getTime()) ? NaN : t.getTime(); }

    function shouldShow(mode, id, endDate) {
        if (mode === 'always') return true;
        if (mode === 'untilDate') {
            var e = endDate ? endOfDay(endDate) : NaN;
            if (!isNaN(e) && Date.now() > e) return false;          // the date has passed - it comes down
            return !sget('annDismiss_' + id);                        // else once per session
        }
        if (mode === 'acknowledge') {
            if (lget('annAck_' + id)) return false;                  // already acknowledged for good
            return !sget('annDismiss_' + id);                        // else once per session until acknowledged
        }
        return !lget('annSeen_' + id);                               // "once": a single time ever
    }

    function remember(mode, id, acknowledged) {
        if (mode === 'once') lset('annSeen_' + id);
        else if (mode === 'acknowledge') { if (acknowledged) lset('annAck_' + id); else sset('annDismiss_' + id); }
        else if (mode === 'untilDate') sset('annDismiss_' + id);
        // "always" remembers nothing
    }

    // The intro veil owns the screen first; wait until it is gone.
    function waitForIntro(cb) {
        // Every intro veil in this family plus the Pink October canvas. The old
        // test named only two ids, so it could not tell that Pink October was
        // still playing and the modal opened on top of it.
        var INTRO_IDS = ['bnc-intro','njac-intro','sec-intro','UCIAC-intro','skyland-intro','ucc-intro','po-intro'];
        function gone() {
            for (var i = 0; i < INTRO_IDS.length; i++) {
                if (document.getElementById(INTRO_IDS[i])) return false;
            }
            return true;
        }
        if (gone()) { setTimeout(cb, 300); return; }
        var t0 = Date.now();
        var iv = setInterval(function () {
            if (gone() || Date.now() - t0 > 9000) { clearInterval(iv); setTimeout(cb, 250); }
        }, 200);
    }

    var CSS =
        '.ann-backdrop{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;' +
        'padding:20px;background:rgba(6,8,11,.62);opacity:0;transition:opacity .25s ease;}' +
        '.ann-backdrop.is-open{opacity:1;}' +
        '.ann-card{position:relative;width:100%;max-width:440px;background:#fff;border-radius:14px;overflow:hidden;' +
        'box-shadow:0 30px 80px rgba(0,0,0,.5);transform:translateY(14px) scale(.97);transition:transform .3s cubic-bezier(.2,.8,.3,1.2);' +
        'font-family:var(--font-body,system-ui,-apple-system,"Segoe UI",sans-serif);}' +
        '.ann-backdrop.is-open .ann-card{transform:none;}' +
        '.ann-bar{height:6px;background:var(--red,#c8102e);}' +
        '.ann-x{position:absolute;top:9px;right:12px;border:0;background:none;font-size:27px;line-height:1;color:#9aa2ad;cursor:pointer;padding:2px 7px;border-radius:6px;}' +
        '.ann-x:hover{color:#22262c;background:#f0f1f3;}' +
        '.ann-x:focus-visible{outline:2px solid var(--red,#c8102e);outline-offset:2px;}' +
        '.ann-eyebrow{margin:20px 26px 0;font-size:.7rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--red,#c8102e);}' +
        '.ann-title{font-family:var(--font-display,inherit);margin:6px 26px 8px;font-size:1.5rem;line-height:1.15;color:#14181c;text-transform:uppercase;letter-spacing:.01em;text-wrap:balance;}' +
        '.ann-body{margin:0 26px 20px;color:#48505b;font-size:1rem;line-height:1.55;}' +
        '.ann-actions{display:flex;gap:10px;flex-wrap:wrap;padding:0 26px 24px;}' +
        '.ann-btn{font:inherit;font-weight:600;font-size:.88rem;letter-spacing:.03em;padding:11px 20px;border-radius:8px;cursor:pointer;text-decoration:none;border:2px solid transparent;transition:all .15s;}' +
        '.ann-btn--primary{background:var(--red,#c8102e);color:#fff;}' +
        '.ann-btn--primary:hover{filter:brightness(1.1);}' +
        '.ann-btn--ghost{background:transparent;color:#48505b;border-color:#d6dadf;}' +
        '.ann-btn--ghost:hover{background:#f2f3f5;}' +
        '.ann-btn:focus-visible{outline:2px solid var(--red,#c8102e);outline-offset:2px;}' +
        '.ann-card--wide{max-width:540px;}' +
        '.ann-card--photos{max-width:820px;max-height:calc(100vh - 40px);overflow-y:auto;}' +
        '.ann-photos{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;margin:0 22px 20px;}' +
        '.ann-photo{border-radius:12px;overflow:hidden;background:#f3f4f6;border:1px solid #e3e6ea;}' +
        '.ann-photo img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;}' +
        '.ann-photo div{padding:10px 12px 12px;}' +
        '.ann-photo strong{display:block;font-family:var(--font-display,inherit);font-size:1.15rem;line-height:1.1;color:#14181c;text-transform:uppercase;}' +
        '.ann-photo small{display:block;color:#6b7380;font-size:.82rem;margin-top:3px;}' +
        '.ann-card--photos .ann-eyebrow,.ann-card--photos .ann-title,.ann-card--photos .ann-body{text-align:center;}' +
        '.ann-card--photos .ann-actions{justify-content:center;}' +
        '.ann-trophy{display:flex;justify-content:center;margin:22px 0 2px;}' +
        '.ann-trophy span{width:58px;height:58px;border-radius:50%;background:var(--red,#c8102e);color:#fff;display:grid;place-items:center;box-shadow:0 8px 20px rgba(0,0,0,.18);}' +
        '.ann-trophy svg{width:30px;height:30px;}' +
        '@media (max-width:560px){.ann-photos{grid-template-columns:1fr;}.ann-photo img{aspect-ratio:16/11;}}' +
        '.ann-mark{display:flex;flex-direction:column;align-items:center;gap:8px;margin:22px 0 2px;}' +
        '.ann-mark .ann-crest{width:84px;height:84px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 8px 22px rgba(0,0,0,.16);border:3px solid var(--red,#c8102e);overflow:hidden;}' +
        '.ann-mark .ann-crest img{width:76px;height:76px;object-fit:contain;}' +
        '.ann-mark .ann-run{display:inline-flex;align-items:center;gap:6px;background:var(--red,#c8102e);color:#fff;border-radius:999px;padding:5px 12px 5px 9px;font:800 .7rem/1 var(--font-display,system-ui);letter-spacing:.14em;}' +
        '.ann-mark .ann-run svg{width:18px;height:18px;}' +
        '.ann-icon{display:flex;justify-content:center;margin:22px 0 2px;}' +
        '.ann-icon span{width:64px;height:64px;border-radius:50%;background:var(--red,#c8102e);color:#fff;display:grid;place-items:center;position:relative;box-shadow:0 8px 20px rgba(0,0,0,.18);}' +
        '.ann-icon svg{width:36px;height:36px;}' +
        '.ann-icon b{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);background:#14181c;color:#fff;font:800 .62rem/1 var(--font-display,system-ui);letter-spacing:.12em;padding:4px 7px;border-radius:999px;}' +
        '.ann-card--wide .ann-eyebrow,.ann-card--wide .ann-title,.ann-card--wide .ann-body{text-align:center;}' +
        '.ann-champs{display:grid;gap:14px;margin:0 22px 22px;}' +
        '.ann-group h3{margin:0 0 8px;font:700 .72rem/1 var(--font-body,system-ui);letter-spacing:.16em;text-transform:uppercase;color:#6b7380;text-align:center;}' +
        '.ann-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}' +
        '.ann-champ{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e3e6ea;border-radius:12px;background:#fafbfc;}' +
        '.ann-champ img{width:46px;height:46px;object-fit:contain;flex:none;}' +
        '.ann-champ strong{display:block;font-family:var(--font-display,inherit);font-size:1.05rem;line-height:1.1;color:#14181c;text-transform:uppercase;}' +
        '.ann-champ small{display:block;color:#6b7380;font-size:.78rem;margin-top:2px;}' +
        '.ann-card--wide .ann-actions{justify-content:center;}' +
        '@media (prefers-reduced-motion:reduce){.ann-backdrop,.ann-card{transition:none;}}';
    /* a runner, for cross country (Material "directions_run", Apache 2.0) */
    var TROPHY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>';
    var RUNNER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>';

    function render(a, id, mode, force) {
        if (document.getElementById('sec-announce')) return;
        if (!document.getElementById('ann-css')) {
            var st = document.createElement('style'); st.id = 'ann-css'; st.textContent = CSS; document.head.appendChild(st);
        }

        var back = document.createElement('div');
        back.id = 'sec-announce'; back.className = 'ann-backdrop';
        back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-labelledby', 'ann-title');

        var card = document.createElement('div'); card.className = 'ann-card' + ((a.champions || []).some(function (g) { return (g.items || []).some(function (c) { return c.photo; }); }) ? ' ann-card--photos' : a.champions ? ' ann-card--wide' : '');
        var bar = document.createElement('div'); bar.className = 'ann-bar';
        var x = document.createElement('button'); x.className = 'ann-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
        card.appendChild(bar); card.appendChild(x);
        if (a.icon === 'trophy') {
            var tr = document.createElement('div'); tr.className = 'ann-trophy';
            tr.innerHTML = '<span>' + TROPHY + '</span>';
            card.appendChild(tr);
        } else if (a.icon === 'xc' && a.iconLogo) {
            var mk = document.createElement('div'); mk.className = 'ann-mark';
            var crest = document.createElement('span'); crest.className = 'ann-crest';
            var cim = document.createElement('img'); cim.src = a.iconLogo; cim.alt = ''; crest.appendChild(cim);
            var run = document.createElement('span'); run.className = 'ann-run'; run.innerHTML = RUNNER + 'XC';
            mk.appendChild(crest); mk.appendChild(run);
            card.appendChild(mk);
        } else if (a.icon === 'xc') {
            var ic = document.createElement('div'); ic.className = 'ann-icon';
            ic.innerHTML = '<span>' + RUNNER + '<b>XC</b></span>';
            card.appendChild(ic);
        }
        if (a.eyebrow) { var ey = document.createElement('div'); ey.className = 'ann-eyebrow'; ey.textContent = a.eyebrow; card.appendChild(ey); }
        var h = document.createElement('h2'); h.id = 'ann-title'; h.className = 'ann-title'; h.textContent = a.title; card.appendChild(h);
        if (a.body) { var p = document.createElement('p'); p.className = 'ann-body'; p.textContent = a.body; card.appendChild(p); }
        if (a.champions && a.champions.length) {
            var wrap = document.createElement('div'); wrap.className = 'ann-champs';
            a.champions.forEach(function (g) {
                var grp = document.createElement('div'); grp.className = 'ann-group';
                if (g.label) { var gh = document.createElement('h3'); gh.textContent = g.label; grp.appendChild(gh); }
                var row = document.createElement('div'); row.className = 'ann-row';
                (g.items || []).forEach(function (c) {
                    if (c.photo) {
                        if (!row.classList.contains('ann-photos')) row.className = 'ann-photos';
                        var ph = document.createElement('figure'); ph.className = 'ann-photo'; ph.style.margin = '0';
                        var pi = document.createElement('img'); pi.src = c.photo; pi.alt = c.alt || ((c.school || '') + ' ' + (c.division || '')); pi.loading = 'eager'; ph.appendChild(pi);
                        var pc = document.createElement('div');
                        var pn = document.createElement('strong'); pn.textContent = c.school || ''; pc.appendChild(pn);
                        if (c.division) { var pd = document.createElement('small'); pd.textContent = c.division; pc.appendChild(pd); }
                        ph.appendChild(pc); row.appendChild(ph);
                        return;
                    }
                    var el = document.createElement('div'); el.className = 'ann-champ';
                    if (c.logo) { var im = document.createElement('img'); im.src = c.logo; im.alt = ''; im.width = 46; im.height = 46; el.appendChild(im); }
                    var tx = document.createElement('div');
                    var nm = document.createElement('strong'); nm.textContent = c.school || ''; tx.appendChild(nm);
                    if (c.division) { var dv = document.createElement('small'); dv.textContent = c.division; tx.appendChild(dv); }
                    el.appendChild(tx); row.appendChild(el);
                });
                grp.appendChild(row); wrap.appendChild(grp);
            });
            card.appendChild(wrap);
        }

        var actions = document.createElement('div'); actions.className = 'ann-actions';
        if (a.linkUrl) {
            var link = document.createElement('a'); link.className = 'ann-btn ann-btn--primary';
            link.href = a.linkUrl; link.textContent = a.linkLabel || 'Learn More';
            if (/^https?:/i.test(a.linkUrl)) { link.target = '_blank'; link.rel = 'noopener'; }
            link.addEventListener('click', function () { dismiss(true); });   // engaging with the CTA counts as received
            actions.appendChild(link);
        }
        var got = document.createElement('button'); got.type = 'button'; got.className = 'ann-btn ann-btn--ghost';
        got.textContent = mode === 'acknowledge' ? "Don't show this again" : (a.linkUrl ? 'Dismiss' : 'Got it');
        actions.appendChild(got);
        card.appendChild(actions);

        back.appendChild(card);
        document.body.appendChild(back);
        requestAnimationFrame(function () { back.classList.add('is-open'); });
        setTimeout(function () { x.focus(); }, 60);

        function dismiss(acknowledged) {
            back.classList.remove('is-open');
            setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 260);
            document.removeEventListener('keydown', onKey);
            if (!force) remember(mode, id, acknowledged);
        }
        function onKey(e) {
            if (e.key === 'Escape') dismiss(false);
            if (e.key === 'Tab') {
                var f = back.querySelectorAll('button, a[href]');
                if (!f.length) return;
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        x.addEventListener('click', function () { dismiss(false); });
        got.addEventListener('click', function () { dismiss(true); });
        back.addEventListener('click', function (e) { if (e.target === back) dismiss(false); });
        document.addEventListener('keydown', onKey);
    }
})();
