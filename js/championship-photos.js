// Championship Photos (championship-photos.html): the photos in
// data/championship-photos.json, in order, as a grid. Each card shows the
// photo, its number, and its title and caption - or "Photo N" until a title is
// written, so photos can be referred to by number. Clicking one opens it full
// size in a viewer with previous/next (arrow keys too) and Esc to close.
// championship-photos.html#photo-3 opens straight to photo 3.
document.addEventListener('DOMContentLoaded', function () {
    var root = document.querySelector('.champ-photos');
    if (!root) return;

    var viewer = document.querySelector('.champ-viewer');
    var vImg = viewer ? viewer.querySelector('img') : null;
    var vCap = viewer ? viewer.querySelector('figcaption') : null;
    var photos = [];
    var at = 0;

    fetch('data/championship-photos.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
            photos = (data.photos || []).filter(function (p) { return p && p.src; });
            if (!photos.length) return;              // keep the "will be posted" line
            root.innerHTML = '';
            if (data.season) {
                var tag = document.createElement('p');
                tag.className = 'champ-season';
                tag.textContent = data.season + ' Champions';
                root.appendChild(tag);
            }
            var grid = document.createElement('ul');
            grid.className = 'champ-grid';
            photos.forEach(function (p, i) { grid.appendChild(card(p, i)); });
            root.appendChild(grid);
            openFromHash();
        })
        .catch(function () { /* the placeholder line stays */ });

    window.addEventListener('hashchange', openFromHash);

    function label(p, i) { return p.title || ('Photo ' + (i + 1)); }

    function card(p, i) {
        var li = document.createElement('li');
        li.id = 'photo-' + (i + 1);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'champ-card';
        btn.setAttribute('aria-label', 'View ' + label(p, i) + (p.caption ? ', ' + p.caption : ''));

        var frame = document.createElement('span');
        frame.className = 'champ-frame';
        var img = document.createElement('img');
        img.src = p.thumb || p.src;
        img.alt = p.alt || '';
        img.loading = i < 3 ? 'eager' : 'lazy';
        img.decoding = 'async';
        frame.appendChild(img);
        var num = document.createElement('span');
        num.className = 'champ-num';
        num.setAttribute('aria-hidden', 'true');
        num.textContent = i + 1;
        frame.appendChild(num);
        btn.appendChild(frame);

        var text = document.createElement('span');
        text.className = 'champ-text';
        var t = document.createElement('strong');
        t.textContent = label(p, i);
        text.appendChild(t);
        if (p.caption) {
            var c = document.createElement('small');
            c.textContent = p.caption;
            text.appendChild(c);
        }
        btn.appendChild(text);

        btn.addEventListener('click', function () { open(i); });
        li.appendChild(btn);
        return li;
    }

    function openFromHash() {
        var m = /^#photo-(\d+)$/.exec(location.hash);
        if (m && photos.length) open(Math.min(photos.length, Math.max(1, +m[1])) - 1);
    }

    // ---- full-size viewer ----------------------------------------------------
    function open(i) {
        if (!viewer || typeof viewer.showModal !== 'function') { window.open(photos[i].src, '_blank', 'noopener'); return; }
        at = i;
        show();
        if (!viewer.open) viewer.showModal();
    }

    function show() {
        var p = photos[at];
        vImg.src = p.src;
        vImg.alt = p.alt || label(p, at);
        vCap.textContent = label(p, at) + (p.caption ? ' — ' + p.caption : '') + '   ·   ' + (at + 1) + ' of ' + photos.length;
        var many = photos.length > 1;
        viewer.querySelector('.champ-v-prev').hidden = !many;
        viewer.querySelector('.champ-v-next').hidden = !many;
    }

    function step(by) {
        if (photos.length < 2) return;
        at = (at + by + photos.length) % photos.length;
        show();
    }

    if (viewer) {
        viewer.querySelector('.champ-v-close').addEventListener('click', function () { viewer.close(); });
        viewer.querySelector('.champ-v-prev').addEventListener('click', function () { step(-1); });
        viewer.querySelector('.champ-v-next').addEventListener('click', function () { step(1); });
        viewer.addEventListener('click', function (e) { if (e.target === viewer) viewer.close(); });
        viewer.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        });
        viewer.addEventListener('close', function () {
            vImg.removeAttribute('src');
            if (/^#photo-\d+$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
        });
    }
});
