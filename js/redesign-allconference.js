// SEC All-Conference. One page, two views:
//   all-conference.html                    every sport with honorees, A-Z, each
//                                          linking to its own page;
//   all-conference.html?sport=boys-soccer  one sport's honorees for a year,
//                                          grouped by division (American,
//                                          Liberty, ...) when the selections
//                                          name one, then by team.
// The top menu's All-Conference dropdown (js/nav-render.js) lists the same
// sports with the same links, so adding a sport's names to
// all-conference.json is all it takes for it to appear in both places.
// Shows a "posted after each season" line while all-conference.json has no
// selections, so the page never looks broken while it is waiting on data.
// A school's crest comes from directory.json when the school's name matches
// an entry there; otherwise the name is shown as plain text.
document.addEventListener('DOMContentLoaded', function () {
    var section = document.querySelector('.njac-allconference');
    if (!section) return;

    var intro = section.querySelector('.allconf-intro');
    var back = section.querySelector('.allconf-back');
    var controls = section.querySelector('.allconf-controls');
    var yearSel = section.querySelector('#allconf-year');
    var divisionSel = section.querySelector('#allconf-division');
    var divisionField = divisionSel ? divisionSel.closest('.allconf-field') : null;
    var results = section.querySelector('.allconf-results');
    var empty = section.querySelector('.allconf-empty');
    if (!controls || !yearSel || !results || !empty) return;

    var TEAM_ORDER = ['first team', 'second team', 'third team', 'honorable mention'];
    var wanted = new URLSearchParams(location.search).get('sport');

    var selections = [];          // the chosen sport's honorees, every year
    var crests = {};
    var divisionOrder = [];

    function getJson(path) {
        return fetch(path).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
    }

    Promise.all([
        getJson('data/all-conference.json'),
        // The directory only supplies crests, so its failure must not stop the page.
        getJson('data/directory.json').catch(function () { return {}; })
    ]).then(function (loaded) {
        var data = loaded[0];

        (loaded[1].directory || []).forEach(function (d) {
            if (d && d.school && d.logo) crests[schoolKey(d.school)] = d.logo;
        });

        var all = (data.selections || []).filter(function (s) {
            return s && s.name && s.school && s.sport && s.year;
        });
        if (!all.length) return;     // leave the empty-state line showing
        empty.hidden = true;
        divisionOrder = (data.divisionOrder || []).map(function (d) { return String(d).toLowerCase(); });

        if (!wanted) {
            if (data.intro && intro) {
                intro.textContent = data.intro;
                intro.hidden = false;
            }
            showSports(all);
            return;
        }

        if (back) back.hidden = false;
        selections = all.filter(function (s) { return sportSlug(s.sport) === wanted; });
        if (!selections.length) {
            message('No All-Conference selections are listed for this sport yet.');
            return;
        }
        nameThePage(selections[0].sport);
        controls.hidden = false;
        buildYears();
        buildDivisions();
        render();
    }).catch(function () { /* the empty-state line stays */ });

    yearSel.addEventListener('change', function () { buildDivisions(); render(); });
    if (divisionSel) divisionSel.addEventListener('change', render);

    // Must match sportSlug() in js/nav-render.js, which builds the menu links.
    function sportSlug(name) {
        return String(name || '').toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // "St. Benedict's Prep" and "Saint Benedict's Prep" are the same school, and
    // an editor will not always type "High School" - so compare on a stripped key.
    function schoolKey(name) {
        return String(name || '').toLowerCase()
            .replace(/\bst\.?(?=\s)/g, 'saint')
            .replace(/&/g, 'and')
            .replace(/\bhigh school\b/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function option(value, label) {
        var o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        return o;
    }

    function message(text) {
        results.innerHTML = '';
        var p = document.createElement('p');
        p.className = 'allconf-none';
        p.textContent = text;
        results.appendChild(p);
    }

    function newestFirst(a, b) {
        return (parseInt(b, 10) - parseInt(a, 10)) || (a < b ? 1 : a > b ? -1 : 0);
    }

    // ---- The sports list (no ?sport=) ---------------------------------------

    function showSports(all) {
        var sports = {};
        var order = [];
        all.forEach(function (s) {
            var slug = sportSlug(s.sport);
            if (!sports[slug]) { sports[slug] = { name: s.sport, season: s.season, years: [] }; order.push(slug); }
            if (sports[slug].years.indexOf(s.year) === -1) sports[slug].years.push(s.year);
        });
        order.sort(function (a, b) {
            return sports[a].name.localeCompare(sports[b].name, undefined, { sensitivity: 'base' });
        });

        var ul = document.createElement('ul');
        ul.className = 'allconf-sports';
        order.forEach(function (slug) {
            var sport = sports[slug];
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = 'all-conference.html?sport=' + slug;

            var name = document.createElement('span');
            name.className = 'allconf-sport-name';
            name.textContent = sport.name;
            a.appendChild(name);

            var meta = document.createElement('span');
            meta.className = 'allconf-sport-meta';
            meta.textContent = [sport.season, sport.years.sort(newestFirst)[0]].filter(Boolean).join(' · ');
            a.appendChild(meta);

            li.appendChild(a);
            ul.appendChild(li);
        });
        results.innerHTML = '';
        results.appendChild(ul);
    }

    // ---- One sport's page (?sport=...) --------------------------------------

    function nameThePage(sport) {
        var h1 = document.querySelector('.page-head h1');
        var sub = document.querySelector('.page-head p');
        if (h1) h1.textContent = sport + ' All-Conference';
        if (sub) sub.textContent = 'Student-athletes recognized by the Super Essex Conference in ' + sport + '.';
        document.title = sport + ' All-Conference | SEC';
    }

    // Newest year first, and the newest is the default.
    function buildYears() {
        var years = [];
        selections.forEach(function (s) { if (years.indexOf(s.year) === -1) years.push(s.year); });
        years.sort(newestFirst);
        yearSel.innerHTML = '';
        years.forEach(function (y) { yearSel.appendChild(option(y, y)); });
        yearSel.value = years[0];
    }

    // The Division picker only appears when the chosen year has selections
    // listed by division; otherwise every name shows.
    function buildDivisions() {
        if (!divisionSel) return;
        var keep = divisionSel.value || 'all';
        var present = [];
        selections.forEach(function (s) {
            if (s.division && s.year === yearSel.value && present.indexOf(s.division) === -1) present.push(s.division);
        });
        present.sort(byDivision);
        divisionSel.innerHTML = '';
        divisionSel.appendChild(option('all', 'All divisions'));
        present.forEach(function (d) { divisionSel.appendChild(option(d, d)); });
        divisionSel.value = (keep === 'all' || present.indexOf(keep) !== -1) ? keep : 'all';
        if (divisionField) divisionField.hidden = !present.length;
    }

    // Divisions in the order all-conference.json gives, then anything else A-Z.
    function byDivision(a, b) {
        var ra = divisionOrder.indexOf(String(a).toLowerCase());
        var rb = divisionOrder.indexOf(String(b).toLowerCase());
        if (ra === -1) ra = divisionOrder.length;
        if (rb === -1) rb = divisionOrder.length;
        return (ra - rb) || (a < b ? -1 : a > b ? 1 : 0);
    }

    function teamRank(team) {
        var i = TEAM_ORDER.indexOf(String(team || '').toLowerCase());
        return i === -1 ? TEAM_ORDER.length : i;
    }

    function render() {
        var division = divisionSel ? divisionSel.value : 'all';
        var rows = selections.filter(function (s) {
            return s.year === yearSel.value && (division === 'all' || s.division === division);
        });
        if (!rows.length) {
            message('No selections are listed for this year and division.');
            return;
        }
        results.innerHTML = '';

        // A sport picked conference-wide has no division, so its teams sit
        // straight under the page heading.
        var divisions = {};
        var order = [];
        rows.forEach(function (s) {
            var k = s.division || '';
            if (!divisions[k]) { divisions[k] = []; order.push(k); }
            divisions[k].push(s);
        });
        order.sort(function (a, b) {
            if (!a || !b) return a ? 1 : b ? -1 : 0;
            return byDivision(a, b);
        });

        order.forEach(function (k) {
            if (k) {
                var h2 = document.createElement('h2');
                h2.className = 'allconf-division';
                h2.textContent = k + ' Division';
                results.appendChild(h2);
            }
            appendTeams(divisions[k], k ? 'h3' : 'h2');
        });
    }

    function appendTeams(rows, headingTag) {
        // Team headings in a fixed order (First, Second, Third, Honorable Mention,
        // then anything else A-Z). Teams are grouped without regard to case so
        // "First team" and "First Team" do not become two headings.
        var teams = {};
        var teamOrder = [];
        rows.forEach(function (s) {
            var label = s.team || 'Selections';
            var k = label.toLowerCase();
            if (!teams[k]) { teams[k] = { label: label, rows: [] }; teamOrder.push(k); }
            teams[k].rows.push(s);
        });
        teamOrder.sort(function (a, b) {
            return (teamRank(a) - teamRank(b)) || (a < b ? -1 : a > b ? 1 : 0);
        });

        teamOrder.forEach(function (k) {
            var heading = document.createElement(headingTag);
            heading.className = 'allconf-team';
            heading.textContent = teams[k].label;
            results.appendChild(heading);

            var ul = document.createElement('ul');
            ul.className = 'allconf-list';
            teams[k].rows.slice().sort(function (a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            }).forEach(function (s) { ul.appendChild(buildRow(s)); });
            results.appendChild(ul);
        });
    }

    function buildRow(s) {
        var li = document.createElement('li');

        var name = document.createElement('span');
        name.className = 'allconf-name';
        name.textContent = s.name;
        li.appendChild(name);

        var school = document.createElement('span');
        school.className = 'allconf-school';
        var logo = crests[schoolKey(s.school)];
        if (logo) {
            var img = document.createElement('img');
            img.className = 'allconf-crest';
            img.src = 'images/logos/optimized/' + logo;
            img.alt = '';
            img.loading = 'lazy';
            img.onerror = function () { this.style.display = 'none'; };
            school.appendChild(img);
        }
        school.appendChild(document.createTextNode(s.school));
        li.appendChild(school);

        if (s.position) {
            var pos = document.createElement('span');
            pos.className = 'allconf-pos';
            pos.textContent = s.position;
            li.appendChild(pos);
        }
        return li;
    }
});
