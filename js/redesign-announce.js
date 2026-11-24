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
//
// Feature photo: "layout": "hero" with "hero": { "photo", "alt", "tag" } puts one
// big photo across the top (slow zoom, gold "tag" pill, "Photo Gallery" chip),
// "logo" on a badge where the photo meets the card, and the photo itself links to
// "linkUrl" like the main button. Under the button: "Maybe later" (this visit
// only) and "dismissLabel" ("Don't show again" - for good, with mode
// "acknowledge").
//
// Blueprint: "layout": "build" with "build": { "kicker": "SEC", "headline":
// "We Build Champions", "items": [{ "photo", "alt", "school", "sport", "note",
// "logo" }] } draws a blueprint-style card: the headline assembles letter by
// letter, each team photo "prints" into its frame one after another, then a
// gold spotlight moves from team to team while the line under the photos spells
// out that team's achievement ("note"). The photos link to "linkUrl".
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
                waitForIntro(function () { (a.layout === 'build' && a.build && (a.build.items || []).length ? renderBuild : render)(a, id, mode, force); });
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
        // ---- "hero" feature-photo layout ----
        '.ann-card--hero{max-width:520px;border-radius:18px;text-align:center;}' +
        '.ann-hero{position:relative;display:block;aspect-ratio:16/10;overflow:hidden;background:#0e2038;cursor:pointer;}' +
        '.ann-hero img{display:block;width:100%;height:100%;object-fit:cover;transform:scale(1.001);transition:transform 7s ease-out;}' +
        '.ann-backdrop.is-open .ann-hero img{transform:scale(1.07);}' +
        '.ann-hero::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(14,32,56,.35) 0%,rgba(14,32,56,0) 28%,rgba(14,32,56,0) 55%,rgba(14,32,56,.78) 100%);}' +
        '.ann-hero-line{position:absolute;left:0;right:0;bottom:0;height:4px;z-index:2;background:linear-gradient(90deg,#8a6204,#f3c75a 50%,#8a6204);}' +
        '.ann-tag{position:absolute;left:14px;top:14px;z-index:2;display:inline-flex;align-items:center;gap:7px;padding:7px 13px 7px 9px;border-radius:999px;' +
        'background:linear-gradient(135deg,#f6d27a,#c99212 55%,#a37204);color:#14181c;font:700 .74rem/1 var(--font-display,system-ui);letter-spacing:.14em;text-transform:uppercase;box-shadow:0 6px 16px rgba(0,0,0,.35);}' +
        '.ann-tag svg{width:16px;height:16px;}' +
        '.ann-chip{position:absolute;right:14px;bottom:18px;z-index:2;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;' +
        'background:rgba(255,255,255,.16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.35);color:#fff;font:600 .78rem/1 var(--font-body,system-ui);letter-spacing:.04em;}' +
        '.ann-chip svg{width:16px;height:16px;}' +
        '.ann-card--hero .ann-x{top:12px;right:12px;z-index:4;width:38px;height:38px;padding:0;display:grid;place-items:center;border-radius:50%;color:#fff;background:rgba(14,32,56,.5);font-size:26px;}' +
        '.ann-card--hero .ann-x:hover{background:rgba(14,32,56,.75);color:#fff;}' +
        '.ann-badge{position:relative;z-index:3;width:128px;height:68px;margin:-34px auto 0;padding:8px 14px;border-radius:14px;background:#fff;' +
        'box-shadow:0 0 0 3px #c99212,0 12px 26px rgba(14,32,56,.3);display:grid;place-items:center;}' +
        '.ann-badge img{max-width:100%;max-height:100%;object-fit:contain;}' +
        '.ann-card--hero .ann-eyebrow{margin:14px 26px 0;color:#9a6c04;}' +
        '.ann-card--hero .ann-title{margin:6px 28px 8px;font-size:1.75rem;color:#0e2038;}' +
        '.ann-card--hero .ann-body{margin:0 30px 20px;}' +
        '.ann-card--hero .ann-actions{flex-direction:column;align-items:stretch;gap:4px;padding:0 30px 24px;}' +
        '.ann-btn--gold{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;border:0;color:#14181c;' +
        'font-family:var(--font-display,inherit);font-weight:600;font-size:1.02rem;letter-spacing:.09em;text-transform:uppercase;' +
        'background:linear-gradient(135deg,#f6d27a,#c99212 55%,#a37204);box-shadow:0 8px 20px rgba(163,114,4,.35);}' +
        '.ann-btn--gold:hover{filter:brightness(1.06);transform:translateY(-1px);}' +
        '.ann-btn--gold svg{width:20px;height:20px;flex:none;}' +
        '.ann-sub{display:flex;justify-content:center;align-items:center;gap:4px;margin-top:6px;}' +
        '.ann-sub span{color:#c3c7ce;font-size:.8rem;}' +
        '.ann-btn--text{background:none;border:0;color:#666b74;font-size:.86rem;padding:8px;}' +
        '.ann-btn--text:hover{color:#0e2038;text-decoration:underline;}' +
        '@media (max-width:480px){.ann-card--hero .ann-title{font-size:1.45rem;margin:6px 20px 8px;}.ann-card--hero .ann-body{margin:0 22px 18px;}' +
        '.ann-card--hero .ann-actions{padding:0 22px 20px;}.ann-badge{width:112px;height:60px;margin-top:-30px;}.ann-chip{display:none;}}' +
        '@media (prefers-reduced-motion:reduce){.ann-backdrop,.ann-card{transition:none;}.ann-hero img{transition:none;}}';
    /* a runner, for cross country (Material "directions_run", Apache 2.0) */
    var TROPHY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>';
    var CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>';
    var GALLERY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="15" height="13" rx="2"/><path d="M3 15l4-4 4 4 3-3 4 4"/><path d="M21 8v11a2 2 0 0 1-2 2H7"/></svg>';
    var RUNNER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/></svg>';

    function render(a, id, mode, force) {
        if (document.getElementById('sec-announce')) return;
        if (!document.getElementById('ann-css')) {
            var st = document.createElement('style'); st.id = 'ann-css'; st.textContent = CSS; document.head.appendChild(st);
        }

        var back = document.createElement('div');
        back.id = 'sec-announce'; back.className = 'ann-backdrop';
        back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-labelledby', 'ann-title');

        var isHero = a.layout === 'hero' && a.hero && a.hero.photo;
        var card = document.createElement('div'); card.className = 'ann-card' + (isHero ? ' ann-card--hero' : (a.champions || []).some(function (g) { return (g.items || []).some(function (c) { return c.photo; }); }) ? ' ann-card--photos' : a.champions ? ' ann-card--wide' : '');
        var x = document.createElement('button'); x.className = 'ann-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
        var heroLink = null;
        if (isHero) {
            heroLink = document.createElement(a.linkUrl ? 'a' : 'div'); heroLink.className = 'ann-hero';
            if (a.linkUrl) {
                heroLink.href = a.linkUrl;
                if (/^https?:/i.test(a.linkUrl)) { heroLink.target = '_blank'; heroLink.rel = 'noopener'; }
                heroLink.setAttribute('aria-label', (a.linkLabel || 'View the photos') + ' - ' + a.title);
            }
            var hi = document.createElement('img'); hi.src = a.hero.photo; hi.alt = a.hero.alt || ''; heroLink.appendChild(hi);
            if (a.hero.tag) { var tg = document.createElement('span'); tg.className = 'ann-tag'; tg.innerHTML = TROPHY; tg.appendChild(document.createTextNode(a.hero.tag)); heroLink.appendChild(tg); }
            var chip = document.createElement('span'); chip.className = 'ann-chip'; chip.innerHTML = CAMERA; chip.appendChild(document.createTextNode(a.hero.chip || 'Photo Gallery')); heroLink.appendChild(chip);
            var line = document.createElement('span'); line.className = 'ann-hero-line'; heroLink.appendChild(line);
            card.appendChild(heroLink); card.appendChild(x);
            if (a.logo) { var bd = document.createElement('div'); bd.className = 'ann-badge'; var bi = document.createElement('img'); bi.src = a.logo; bi.alt = a.logoAlt || ''; bd.appendChild(bi); card.appendChild(bd); }
        } else {
            var bar = document.createElement('div'); bar.className = 'ann-bar';
            card.appendChild(bar); card.appendChild(x);
        }
        if (isHero) { /* no icon badge - the photo leads */ }
        else if (a.icon === 'trophy') {
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
            var link = document.createElement('a'); link.className = 'ann-btn ' + (isHero ? 'ann-btn--gold' : 'ann-btn--primary');
            link.href = a.linkUrl;
            if (isHero) link.innerHTML = GALLERY;
            link.appendChild(document.createTextNode(a.linkLabel || 'Learn More'));
            if (/^https?:/i.test(a.linkUrl)) { link.target = '_blank'; link.rel = 'noopener'; }
            link.addEventListener('click', function () { dismiss(true); });   // engaging with the CTA counts as received
            actions.appendChild(link);
        }
        var got = document.createElement('button'); got.type = 'button'; got.className = 'ann-btn ' + (isHero ? 'ann-btn--text' : 'ann-btn--ghost');
        got.textContent = a.dismissLabel || (mode === 'acknowledge' ? "Don't show this again" : (a.linkUrl ? 'Dismiss' : 'Got it'));
        var later = null;
        if (isHero) {
            var sub = document.createElement('div'); sub.className = 'ann-sub';
            later = document.createElement('button'); later.type = 'button'; later.className = 'ann-btn ann-btn--text';
            later.textContent = a.laterLabel || 'Maybe later';
            var dot = document.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.textContent = '\u2022';
            sub.appendChild(later); sub.appendChild(dot); sub.appendChild(got);
            actions.appendChild(sub);
        } else {
            actions.appendChild(got);
        }
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
        if (later) later.addEventListener('click', function () { dismiss(false); });
        if (heroLink && a.linkUrl) heroLink.addEventListener('click', function () { dismiss(true); });
        back.addEventListener('click', function (e) { if (e.target === back) dismiss(false); });
        document.addEventListener('keydown', onKey);
    }

    // ---- "build" blueprint layout -------------------------------------------
    var BUILD_CSS =
        '.annb{position:relative;width:100%;max-width:960px;max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;color:#fff;isolation:isolate;' +
        'display:grid;grid-template-columns:300px minmax(0,1fr);gap:30px;padding:34px 34px 30px;' +
        'background:radial-gradient(120% 90% at 0% 0%,rgba(243,199,90,.16),transparent 45%),linear-gradient(160deg,#0b1d36 0%,#0e2a50 60%,#0b1d36 100%);' +
        'box-shadow:0 0 0 1px rgba(160,195,255,.18),0 40px 90px rgba(0,0,0,.6);transform:translateY(16px) scale(.97);transition:transform .45s cubic-bezier(.2,.8,.3,1.15);' +
        'font-family:var(--font-body,system-ui,-apple-system,"Segoe UI",sans-serif);}' +
        '.ann-backdrop.is-open .annb{transform:none;}' +
        /* blueprint grid that draws itself in from the left */
        '.annb-grid{position:absolute;inset:0;z-index:-1;pointer-events:none;' +
        'background-image:linear-gradient(rgba(150,190,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(150,190,255,.13) 1px,transparent 1px),' +
        'linear-gradient(rgba(150,190,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(150,190,255,.06) 1px,transparent 1px);' +
        'background-size:120px 120px,120px 120px,24px 24px,24px 24px;background-position:-1px -1px;clip-path:inset(0 100% 0 0);}' +
        '.ann-backdrop.is-open .annb-grid{animation:annbWipe 1.1s cubic-bezier(.6,0,.2,1) .1s forwards;}' +
        '@keyframes annbWipe{to{clip-path:inset(0 0 0 0);}}' +
        '.annb-crop{position:absolute;width:22px;height:22px;border:2px solid #f3c75a;opacity:.85;pointer-events:none;}' +
        '.annb-crop.tl{top:12px;left:12px;border-right:0;border-bottom:0;}.annb-crop.tr{top:12px;right:12px;border-left:0;border-bottom:0;}' +
        '.annb-crop.bl{bottom:12px;left:12px;border-right:0;border-top:0;}.annb-crop.br{bottom:12px;right:12px;border-left:0;border-top:0;}' +
        '.annb-meta{position:absolute;right:42px;bottom:14px;font:600 .6rem/1 var(--font-display,system-ui);letter-spacing:.22em;color:rgba(160,195,255,.55);text-transform:uppercase;pointer-events:none;}' +
        '.annb-x{position:absolute;top:14px;right:16px;z-index:5;width:38px;height:38px;border:0;border-radius:50%;display:grid;place-items:center;' +
        'background:rgba(255,255,255,.1);color:#fff;font-size:26px;line-height:1;cursor:pointer;}' +
        '.annb-x:hover{background:rgba(255,255,255,.2);}.annb-x:focus-visible{outline:2px solid #f3c75a;outline-offset:2px;}' +
        /* left column */
        '.annb-side{display:flex;flex-direction:column;min-width:0;}' +
        '.annb-logo{width:86px;height:auto;margin:0 0 16px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.4));}' +
        '.annb-eyebrow{font:700 .72rem/1.2 var(--font-body,system-ui);letter-spacing:.18em;text-transform:uppercase;color:#f3c75a;margin:0 0 10px;}' +
        '.annb-title{margin:0 0 14px;font-family:var(--font-display,inherit);font-weight:700;text-transform:uppercase;line-height:.92;letter-spacing:.01em;}' +
        '.annb-title>span{display:block;}' +
        '.annb-kicker{font-size:4.6rem;letter-spacing:.03em;line-height:.95;}' +
        '.annb-kicker .annb-ch{background:linear-gradient(160deg,#fbe3a0,#f3c75a 40%,#c99212 75%,#a37204);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 12px rgba(243,199,90,.25));}' +
        '.annb-row{font-size:2.55rem;color:#fff;}' +
        '.annb-ch{display:inline-block;opacity:0;transform:translateY(-28px) rotate(-6deg);}' +
        '.ann-backdrop.is-open .annb-ch{animation:annbDrop .55s cubic-bezier(.2,.9,.3,1.35) calc(.35s + var(--i) * .045s) forwards;}' +
        '@keyframes annbDrop{to{opacity:1;transform:none;}}' +
        '.annb-build{position:relative;display:inline-block;color:#f3c75a;}' +
        '.annb-dim{position:absolute;left:0;bottom:-11px;width:100%;height:10px;overflow:visible;}' +
        '.annb-row+.annb-row{margin-top:14px;}' +
        '.annb-dim path{fill:none;stroke:#f3c75a;stroke-width:1.6;stroke-dasharray:240;stroke-dashoffset:240;}' +
        '.ann-backdrop.is-open .annb-dim path{animation:annbDraw .9s ease 1.1s forwards;}' +
        '@keyframes annbDraw{to{stroke-dashoffset:0;}}' +
        '.annb-body{margin:10px 0 22px;color:#c9d6ea;font-size:.95rem;line-height:1.55;}' +
        '.annb-actions{margin-top:auto;display:flex;flex-direction:column;gap:4px;}' +
        '.annb-cta{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border-radius:10px;text-decoration:none;color:#14181c;' +
        'font-family:var(--font-display,inherit);font-weight:600;font-size:1.02rem;letter-spacing:.09em;text-transform:uppercase;' +
        'background:linear-gradient(135deg,#f6d27a,#c99212 55%,#a37204);box-shadow:0 10px 24px rgba(163,114,4,.35);transition:filter .15s,transform .15s;}' +
        '.annb-cta:hover{filter:brightness(1.07);transform:translateY(-1px);}.annb-cta:focus-visible{outline:2px solid #fff;outline-offset:3px;}' +
        '.annb-cta svg{width:20px;height:20px;flex:none;}' +
        '.annb-sub{display:flex;justify-content:center;align-items:center;gap:2px;margin-top:4px;}' +
        '.annb-sub span{color:rgba(201,214,234,.5);font-size:.8rem;}' +
        '.annb-link{background:none;border:0;color:#c9d6ea;font:inherit;font-size:.86rem;padding:8px;cursor:pointer;border-radius:6px;}' +
        '.annb-link:hover{color:#fff;text-decoration:underline;}.annb-link:focus-visible{outline:2px solid #f3c75a;outline-offset:1px;}' +
        /* the board of four */
        '.annb-board{min-width:0;display:flex;flex-direction:column;justify-content:center;padding-top:22px;}' +
        '.annb-tiles{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:16px 18px;}' +
        '.annb-tile{margin:0;min-width:0;transition:opacity .45s ease,filter .45s ease;}' +
        '.annb-shot{position:relative;display:block;aspect-ratio:3/2;border-radius:8px;overflow:hidden;background:rgba(10,24,46,.6);' +
        'outline:1.5px dashed rgba(160,195,255,.45);outline-offset:-1px;transition:transform .45s cubic-bezier(.2,.8,.3,1.2),outline-color .4s;}' +
        '.annb-num{position:absolute;inset:0;display:grid;place-items:center;font:700 1.6rem/1 var(--font-display,system-ui);letter-spacing:.12em;color:rgba(160,195,255,.5);}' +
        '.annb-shot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;clip-path:inset(100% 0 0 0);}' +
        '.annb-scan{position:absolute;left:-2%;right:-2%;bottom:0;height:3px;background:#f3c75a;box-shadow:0 0 12px 3px rgba(243,199,90,.75),0 0 30px 8px rgba(243,199,90,.35);opacity:0;}' +
        '.ann-backdrop.is-open .annb-shot img{animation:annbPrint 1.15s cubic-bezier(.5,0,.25,1) calc(1s + var(--i) * .32s) forwards;}' +
        '.ann-backdrop.is-open .annb-scan{animation:annbScan 1.15s cubic-bezier(.5,0,.25,1) calc(1s + var(--i) * .32s) forwards;}' +
        '@keyframes annbPrint{to{clip-path:inset(0 0 0 0);}}' +
        '@keyframes annbScan{0%{bottom:0;opacity:1;}88%{bottom:calc(100% - 3px);opacity:1;}100%{bottom:calc(100% - 3px);opacity:0;}}' +
        '.annb-tile.is-built .annb-shot{outline-color:rgba(160,195,255,.18);outline-style:solid;}' +
        /* gold corner brackets on the team in the spotlight */
        '.annb-corners{position:absolute;inset:6px;pointer-events:none;opacity:0;transform:scale(1.08);transition:opacity .35s,transform .45s cubic-bezier(.2,.8,.3,1.3);' +
        'background:linear-gradient(#f3c75a,#f3c75a) 0 0/20px 3px no-repeat,linear-gradient(#f3c75a,#f3c75a) 0 0/3px 20px no-repeat,' +
        'linear-gradient(#f3c75a,#f3c75a) 100% 0/20px 3px no-repeat,linear-gradient(#f3c75a,#f3c75a) 100% 0/3px 20px no-repeat,' +
        'linear-gradient(#f3c75a,#f3c75a) 0 100%/20px 3px no-repeat,linear-gradient(#f3c75a,#f3c75a) 0 100%/3px 20px no-repeat,' +
        'linear-gradient(#f3c75a,#f3c75a) 100% 100%/20px 3px no-repeat,linear-gradient(#f3c75a,#f3c75a) 100% 100%/3px 20px no-repeat;' +
        'filter:drop-shadow(0 0 6px rgba(243,199,90,.7));}' +
        '.annb-tiles.is-cycling .annb-tile{opacity:.5;filter:saturate(.55);}' +
        '.annb-tiles.is-cycling .annb-tile.is-spot{opacity:1;filter:none;}' +
        '.annb-tile.is-spot .annb-shot{transform:scale(1.035);}' +
        '.annb-tile.is-spot .annb-corners{opacity:1;transform:none;}' +
        '.annb-shot:focus-visible{outline:3px solid #f3c75a;outline-offset:2px;}' +
        /* name tag under each photo */
        '.annb-tag{display:flex;align-items:center;gap:9px;margin-top:9px;min-width:0;opacity:0;transform:translateY(6px);}' +
        '.ann-backdrop.is-open .annb-tag{animation:annbTag .5s ease calc(1.9s + var(--i) * .32s) forwards;}' +
        '@keyframes annbTag{to{opacity:1;transform:none;}}' +
        '.annb-crest{width:34px;height:34px;flex:none;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px rgba(243,199,90,.8);}' +
        '.annb-crest img{width:28px;height:28px;object-fit:contain;}' +
        '.annb-tag strong{display:block;font-family:var(--font-display,inherit);font-weight:600;font-size:1.05rem;line-height:1.05;letter-spacing:.04em;text-transform:uppercase;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.annb-tag small{display:block;font-size:.74rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#f3c75a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.annb-tag span{min-width:0;}' +
        /* the spec line that spells out the team in the spotlight */
        '.annb-spec{display:flex;align-items:center;gap:12px;min-height:44px;margin-top:16px;padding:10px 14px;border-radius:8px;' +
        'border:1px solid rgba(160,195,255,.22);background:rgba(8,20,40,.55);font-size:.9rem;color:#e6edf8;opacity:0;}' +
        '.ann-backdrop.is-open .annb-spec{animation:annbTag .5s ease 3.2s forwards;}' +
        '.annb-spec-no{flex:none;font:700 .78rem/1 var(--font-display,system-ui);letter-spacing:.16em;color:#14181c;background:#f3c75a;border-radius:4px;padding:5px 7px;}' +
        '.annb-spec-text{min-width:0;}' +
        '.annb-spec-text.is-typing{animation:annbType .55s steps(24,end);}' +
        '@keyframes annbType{from{clip-path:inset(0 100% 0 0);}to{clip-path:inset(0 0 0 0);}}' +
        '@media (max-width:860px){' +
        '.annb{grid-template-columns:1fr;gap:18px;padding:26px 18px 22px;max-width:560px;text-align:center;}' +
        '.annb-side{align-items:center;}.annb-logo{display:none;}.annb-eyebrow{margin-bottom:8px;padding:0 40px;font-size:.66rem;}' +
        '.annb-kicker{font-size:3rem;}.annb-row{font-size:1.75rem;}.annb-row+.annb-row{margin-top:12px;}' +
        '.annb-body{margin:8px 0 0;font-size:.86rem;line-height:1.45;}' +
        '.annb-board{padding-top:0;order:2;}.annb-actions{order:3;width:100%;margin-top:4px;}' +
        '.annb-tiles{gap:12px 10px;}.annb-tag{gap:7px;text-align:left;}.annb-crest{width:28px;height:28px;}.annb-crest img{width:23px;height:23px;}' +
        '.annb-tag strong{font-size:.92rem;}.annb-tag small{font-size:.64rem;letter-spacing:.1em;}' +
        '.annb-spec{font-size:.82rem;text-align:left;}.annb-meta{display:none;}' +
        '.annb-side-actions{display:none;}' +
        '}' +
        '@media (min-width:861px){.annb-foot-actions{display:none;}}' +
        '@media (prefers-reduced-motion:reduce){' +
        '.annb,.annb-tile,.annb-shot,.annb-corners{transition:none;}' +
        '.annb-grid,.annb-ch,.annb-dim path,.annb-shot img,.annb-scan,.annb-tag,.annb-spec,.annb-spec-text.is-typing{animation:none !important;}' +
        '.annb-grid{clip-path:none;}.annb-ch,.annb-tag,.annb-spec{opacity:1;transform:none;}.annb-dim path{stroke-dashoffset:0;}' +
        '.annb-shot img{clip-path:none;}.annb-scan{display:none;}' +
        '}';

    function letters(text, start) {
        var out = document.createDocumentFragment();
        String(text).split('').forEach(function (c, k) {
            if (c === ' ') { out.appendChild(document.createTextNode(' ')); return; }
            var sp = document.createElement('span'); sp.className = 'annb-ch'; sp.style.setProperty('--i', start + k); sp.textContent = c;
            out.appendChild(sp);
        });
        return out;
    }

    function renderBuild(a, id, mode, force) {
        if (document.getElementById('sec-announce')) return;
        if (!document.getElementById('ann-css')) {
            var st = document.createElement('style'); st.id = 'ann-css'; st.textContent = CSS; document.head.appendChild(st);
        }
        if (!document.getElementById('ann-build-css')) {
            var st2 = document.createElement('style'); st2.id = 'ann-build-css'; st2.textContent = BUILD_CSS; document.head.appendChild(st2);
        }
        var b = a.build, items = (b.items || []).slice(0, 4);
        var kicker = b.kicker || 'SEC';
        var headline = b.headline || a.title || '';
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var back = document.createElement('div');
        back.id = 'sec-announce'; back.className = 'ann-backdrop';
        back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true'); back.setAttribute('aria-labelledby', 'ann-title');

        var card = document.createElement('div'); card.className = 'annb';
        card.innerHTML = '<div class="annb-grid" aria-hidden="true"></div>' +
            '<span class="annb-crop tl" aria-hidden="true"></span>' +
            '<span class="annb-crop bl" aria-hidden="true"></span><span class="annb-crop br" aria-hidden="true"></span>' +
            (b.meta ? '<span class="annb-meta" aria-hidden="true"></span>' : '');
        if (b.meta) card.querySelector('.annb-meta').textContent = b.meta;
        var x = document.createElement('button'); x.className = 'annb-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
        card.appendChild(x);

        // ---- left: logo, eyebrow, headline, body, buttons
        var side = document.createElement('div'); side.className = 'annb-side';
        if (a.logo) { var lg = document.createElement('img'); lg.className = 'annb-logo'; lg.src = a.logo; lg.alt = a.logoAlt || ''; side.appendChild(lg); }
        if (a.eyebrow) { var ey = document.createElement('div'); ey.className = 'annb-eyebrow'; ey.textContent = a.eyebrow; side.appendChild(ey); }
        var h = document.createElement('h2'); h.id = 'ann-title'; h.className = 'annb-title';
        h.setAttribute('aria-label', kicker + ' — ' + headline);
        var k1 = document.createElement('span'); k1.className = 'annb-kicker'; k1.setAttribute('aria-hidden', 'true'); k1.appendChild(letters(kicker, 0)); h.appendChild(k1);
        // the word "Build" gets the gold blueprint dimension line under it
        var words = headline.split(' '), n = kicker.length, rows = [[], []];
        var split = Math.max(1, words.length - 1);
        words.forEach(function (w, i) { rows[i < split ? 0 : 1].push(w); });
        rows.forEach(function (row) {
            if (!row.length) return;
            var r = document.createElement('span'); r.className = 'annb-row'; r.setAttribute('aria-hidden', 'true');
            row.forEach(function (w, j) {
                if (j) r.appendChild(document.createTextNode(' '));
                if (/^build$/i.test(w)) {
                    var bw = document.createElement('span'); bw.className = 'annb-build'; bw.appendChild(letters(w, n)); n += w.length;
                    bw.insertAdjacentHTML('beforeend', '<svg class="annb-dim" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="M1 1v10M99 1v10M1 6h98M1 6l5-3M1 6l5 3M99 6l-5-3M99 6l-5 3" vector-effect="non-scaling-stroke"/></svg>');
                    r.appendChild(bw);
                } else { r.appendChild(letters(w, n)); n += w.length; }
            });
            h.appendChild(r);
        });
        side.appendChild(h);
        if (a.body) { var p = document.createElement('p'); p.className = 'annb-body'; p.textContent = a.body; side.appendChild(p); }

        function actionsBlock(cls) {
            var box = document.createElement('div'); box.className = 'annb-actions ' + cls;
            if (a.linkUrl) {
                var link = document.createElement('a'); link.className = 'annb-cta'; link.href = a.linkUrl;
                link.innerHTML = GALLERY; link.appendChild(document.createTextNode(a.linkLabel || 'See the Champions'));
                box.appendChild(link);
            }
            var sub = document.createElement('div'); sub.className = 'annb-sub';
            var lt = document.createElement('button'); lt.type = 'button'; lt.className = 'annb-link annb-later'; lt.textContent = a.laterLabel || 'Maybe later';
            var dot = document.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.textContent = '•';
            var gt = document.createElement('button'); gt.type = 'button'; gt.className = 'annb-link annb-got'; gt.textContent = a.dismissLabel || "Don't show again";
            sub.appendChild(lt); sub.appendChild(dot); sub.appendChild(gt); box.appendChild(sub);
            return box;
        }
        // buttons sit under the headline on wide screens and under the photos on phones
        side.appendChild(actionsBlock('annb-side-actions'));
        card.appendChild(side);

        // ---- right: the four photos and the spec line
        var board = document.createElement('div'); board.className = 'annb-board';
        var ol = document.createElement('ol'); ol.className = 'annb-tiles';
        var tiles = [];
        items.forEach(function (it, i) {
            var li = document.createElement('li'); li.className = 'annb-tile'; li.style.setProperty('--i', i);
            var shot = document.createElement(a.linkUrl ? 'a' : 'div'); shot.className = 'annb-shot';
            if (a.linkUrl) { shot.href = a.linkUrl; shot.setAttribute('aria-label', [it.school, it.sport, it.note].filter(Boolean).join(', ') + ' - ' + (a.linkLabel || 'See the photos')); }
            var num = document.createElement('span'); num.className = 'annb-num'; num.setAttribute('aria-hidden', 'true'); num.textContent = ('0' + (i + 1)).slice(-2); shot.appendChild(num);
            var img = document.createElement('img'); img.src = it.photo; img.alt = it.alt || ''; img.loading = 'eager'; img.decoding = 'async'; shot.appendChild(img);
            var scan = document.createElement('span'); scan.className = 'annb-scan'; scan.setAttribute('aria-hidden', 'true'); shot.appendChild(scan);
            var cor = document.createElement('span'); cor.className = 'annb-corners'; cor.setAttribute('aria-hidden', 'true'); shot.appendChild(cor);
            li.appendChild(shot);
            var tag = document.createElement('div'); tag.className = 'annb-tag';
            if (it.logo) { var cr = document.createElement('span'); cr.className = 'annb-crest'; var ci = document.createElement('img'); ci.src = it.logo; ci.alt = ''; cr.appendChild(ci); tag.appendChild(cr); }
            var tx = document.createElement('span');
            var sn = document.createElement('strong'); sn.textContent = it.school || ''; tx.appendChild(sn);
            var sp = document.createElement('small'); sp.textContent = it.sport || ''; tx.appendChild(sp);
            tag.appendChild(tx); li.appendChild(tag);
            ol.appendChild(li); tiles.push(li);
        });
        board.appendChild(ol);
        var spec = document.createElement('div'); spec.className = 'annb-spec'; spec.setAttribute('aria-hidden', 'true');
        var specNo = document.createElement('span'); specNo.className = 'annb-spec-no';
        var specText = document.createElement('span'); specText.className = 'annb-spec-text';
        spec.appendChild(specNo); spec.appendChild(specText); board.appendChild(spec);
        board.appendChild(actionsBlock('annb-foot-actions'));
        card.appendChild(board);

        back.appendChild(card);
        document.body.appendChild(back);
        requestAnimationFrame(function () { back.classList.add('is-open'); });
        setTimeout(function () { x.focus(); }, 60);

        // ---- spotlight: once every photo is built, move from team to team
        var spot = -1, timer = null, hold = false;
        function show(i) {
            spot = (i + tiles.length) % tiles.length;
            tiles.forEach(function (t, k) { t.classList.toggle('is-spot', k === spot); });
            var it = items[spot];
            specNo.textContent = 'No. ' + ('0' + (spot + 1)).slice(-2);
            specText.textContent = [it.school, it.sport].filter(Boolean).join(' ') + (it.note ? ' — ' + it.note : '');
            specText.classList.remove('is-typing'); void specText.offsetWidth; specText.classList.add('is-typing');
        }
        function tick() { if (!hold) show(spot + 1); }
        var buildDone = reduced ? 0 : 1000 + (tiles.length - 1) * 320 + 1200;
        setTimeout(function () { tiles.forEach(function (t) { t.classList.add('is-built'); }); }, buildDone);
        var startT = setTimeout(function () {
            ol.classList.add('is-cycling'); show(0);
            if (!reduced) timer = setInterval(tick, 3200);
        }, reduced ? 0 : buildDone + 300);
        tiles.forEach(function (t, k) {
            var s = t.querySelector('.annb-shot');
            function on() { hold = true; if (ol.classList.contains('is-cycling')) show(k); }
            function off() { hold = false; }
            s.addEventListener('mouseenter', on); s.addEventListener('focus', on);
            s.addEventListener('mouseleave', off); s.addEventListener('blur', off);
        });

        function dismiss(acknowledged) {
            clearTimeout(startT); clearInterval(timer);
            back.classList.remove('is-open');
            setTimeout(function () { if (back.parentNode) back.parentNode.removeChild(back); }, 260);
            document.removeEventListener('keydown', onKey);
            if (!force) remember(mode, id, acknowledged);
        }
        function onKey(e) {
            if (e.key === 'Escape') dismiss(false);
            if (e.key === 'Tab') {
                var f = [].filter.call(back.querySelectorAll('button, a[href]'), function (el) { return el.offsetParent !== null; });
                if (!f.length) return;
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        x.addEventListener('click', function () { dismiss(false); });
        [].forEach.call(card.querySelectorAll('.annb-later'), function (el) { el.addEventListener('click', function () { dismiss(false); }); });
        [].forEach.call(card.querySelectorAll('.annb-got'), function (el) { el.addEventListener('click', function () { dismiss(true); }); });
        // going to the photos counts as having seen it
        [].forEach.call(card.querySelectorAll('.annb-cta, a.annb-shot'), function (el) { el.addEventListener('click', function () { dismiss(true); }); });
        back.addEventListener('click', function (e) { if (e.target === back) dismiss(false); });
        document.addEventListener('keydown', onKey);
    }
})();
