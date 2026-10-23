// School Athletic Websites: the table is built from data/directory.json, the
// same file the home-page directory reads, so a website added there (or through
// the Athletic Directors editor) shows up here with nothing else to edit.
// A school with no website on file is listed as "Coming soon", not dropped.
document.addEventListener('DOMContentLoaded', function () {
    var body = document.querySelector('.websites-body');
    if (!body) return;

    fetch('data/directory.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
            var all = (data.directory || []).filter(function (d) { return d && d.school; });
            if (!all.length) { showMessage('The school list is not available right now.'); return; }
            all.forEach(function (d) { body.appendChild(buildRow(d)); });
        })
        .catch(function () { showMessage('The school list is not available right now.'); });

    function showMessage(text) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = 2;
        td.textContent = text;
        tr.appendChild(td);
        body.appendChild(tr);
    }

    // "https://www.cgschools.org/o/cgathletics/" -> "cgschools.org/o/cgathletics"
    function shortUrl(url) {
        return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    }

    function buildRow(d) {
        var tr = document.createElement('tr');

        var nameCell = document.createElement('td');
        var name = document.createElement('span');
        name.className = 'school-name';
        if (d.logo) {
            var img = document.createElement('img');
            img.className = 'school-crest';
            img.src = 'images/logos/optimized/' + d.logo;
            img.alt = '';
            img.loading = 'lazy';
            img.onerror = function () { this.style.display = 'none'; };
            name.appendChild(img);
        }
        name.appendChild(document.createTextNode(d.school));
        nameCell.appendChild(name);
        tr.appendChild(nameCell);

        var siteCell = document.createElement('td');
        if (d.website) {
            var a = document.createElement('a');
            a.href = d.website;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = shortUrl(d.website);
            siteCell.appendChild(a);
        } else {
            var soon = document.createElement('span');
            soon.style.color = 'var(--muted)';
            soon.textContent = 'Coming soon';
            siteCell.appendChild(soon);
        }
        tr.appendChild(siteCell);
        return tr;
    }
});
