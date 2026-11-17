// SEC All-Conference: the honorees for one year at a time, grouped by sport,
// then by division (American, Liberty, ...) when the selections name one.
// Shows a "posted after each season" line while all-conference.json has no
// selections, so the page never looks broken while it is waiting on data.
// A school's crest comes from directory.json when the school's name matches
// an entry there; otherwise the name is shown as plain text.
document.addEventListener('DOMContentLoaded', function () {
    var section = document.querySelector('.njac-allconference');
    if (!section) return;

    var intro = section.querySelector('.allconf-intro');
    var controls = section.querySelector('.allconf-controls');
    var yearSel = section.querySelector('#allconf-year');
    var seasonSel = section.querySelector('#allconf-season');
    var divisionSel = section.querySelector('#allconf-division');
    var divisionField = divisionSel ? divisionSel.closest('.allconf-field') : null;
    var results = section.querySelector('.allconf-results');
    var empty = section.querySelector('.allconf-empty');
    if (!controls || !yearSel || !seasonSel || !results || !empty) return;

    var SEASONS = ['Fall', 'Winter', 'Spring'];
    var TEAM_ORDER = ['first team', 'second team', 'third team', 'honorable mention'];

    var selections = [];
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

        selections = (data.selections || []).filter(function (s) {
            return s && s.name && s.school && s.sport && s.year;
        });
        if (!selections.length) return;     // leave the empty-state line showing
        divisionOrder = (data.divisionOrder || []).map(function (d) { return String(d).toLowerCase(); });

        if (data.intro && intro) {
            intro.textContent = data.intro;
            intro.hidden = false;
        }
        empty.hidden = true;
        controls.hidden = false;
        buildYears();
        buildSeasons();
        buildDivisions();
        render();
    }).catch(function () { /* the empty-state line stays */ });

    yearSel.addEventListener('change', function () { buildSeasons(); buildDivisions(); render(); });
    seasonSel.addEventListener('change', function () { buildDivisions(); render(); });
    if (divisionSel) divisionSel.addEventListener('change', render);

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

    // Newest year first, and the newest is the default.
    function buildYears() {
        var years = [];
        selections.forEach(function (s) { if (years.indexOf(s.year) === -1) years.push(s.year); });
        years.sort(function (a, b) {
            return (parseInt(b, 10) - parseInt(a, 10)) || (a < b ? 1 : a > b ? -1 : 0);
        });
        yearSel.innerHTML = '';
        years.forEach(function (y) { yearSel.appendChild(option(y, y)); });
        yearSel.value = years[0];
    }

    // Only the seasons that have names in the chosen year are offered.
    function buildSeasons() {
        var keep = seasonSel.value || 'all';
        var present = SEASONS.filter(function (season) {
            return selections.some(function (s) { return s.year === yearSel.value && s.season === season; });
        });
        seasonSel.innerHTML = '';
        seasonSel.appendChild(option('all', 'All seasons'));
        present.forEach(function (season) { seasonSel.appendChild(option(season, season)); });
        seasonSel.value = (keep === 'all' || present.indexOf(keep) !== -1) ? keep : 'all';
    }

    function inYearAndSeason(s) {
        return s.year === yearSel.value && (seasonSel.value === 'all' || s.season === seasonSel.value);
    }

    // The Division picker only appears when the chosen year and season have
    // selections listed by division; otherwise every name shows.
    function buildDivisions() {
        if (!divisionSel) return;
        var keep = divisionSel.value || 'all';
        var present = [];
        selections.forEach(function (s) {
            if (s.division && inYearAndSeason(s) && present.indexOf(s.division) === -1) present.push(s.division);
        });
        present.sort(function (a, b) {
            return (divisionRank(a) - divisionRank(b)) || (a < b ? -1 : a > b ? 1 : 0);
        });
        divisionSel.innerHTML = '';
        divisionSel.appendChild(option('all', 'All divisions'));
        present.forEach(function (d) { divisionSel.appendChild(option(d, d)); });
        divisionSel.value = (keep === 'all' || present.indexOf(keep) !== -1) ? keep : 'all';
        if (divisionField) divisionField.hidden = !present.length;
    }

    function divisionRank(division) {
        var i = divisionOrder.indexOf(String(division || '').toLowerCase());
        return i === -1 ? divisionOrder.length : i;
    }

    function seasonRank(season) {
        var i = SEASONS.indexOf(season);
        return i === -1 ? SEASONS.length : i;
    }

    function teamRank(team) {
        var i = TEAM_ORDER.indexOf(String(team || '').toLowerCase());
        return i === -1 ? TEAM_ORDER.length : i;
    }

    function render() {
        var division = divisionSel ? divisionSel.value : 'all';
        var rows = selections.filter(function (s) {
            return inYearAndSeason(s) && (division === 'all' || s.division === division);
        });
        results.innerHTML = '';

        if (!rows.length) {
            var none = document.createElement('p');
            none.className = 'allconf-none';
            none.textContent = 'No selections are listed for this year, season and division.';
            results.appendChild(none);
            return;
        }

        var sports = {};
        var order = [];
        rows.forEach(function (s) {
            if (!sports[s.sport]) { sports[s.sport] = { name: s.sport, season: s.season, rows: [] }; order.push(s.sport); }
            sports[s.sport].rows.push(s);
        });
        order.sort(function (a, b) {
            return (seasonRank(sports[a].season) - seasonRank(sports[b].season)) || (a < b ? -1 : a > b ? 1 : 0);
        });

        order.forEach(function (key) {
            results.appendChild(buildSport(sports[key]));
        });
    }

    function buildSport(sport) {
        var block = document.createElement('div');
        block.className = 'allconf-sport';

        var h3 = document.createElement('h3');
        h3.textContent = sport.name;
        if (seasonSel.value === 'all' && sport.season) {
            var tag = document.createElement('span');
            tag.className = 'allconf-season';
            tag.textContent = sport.season;
            h3.appendChild(tag);
        }
        block.appendChild(h3);

        // Divisions in the order all-conference.json gives. A sport picked
        // conference-wide has no division, so its teams sit straight under it.
        var divisions = {};
        var divOrder = [];
        sport.rows.forEach(function (s) {
            var k = s.division || '';
            if (!divisions[k]) { divisions[k] = []; divOrder.push(k); }
            divisions[k].push(s);
        });
        divOrder.sort(function (a, b) {
            if (!a || !b) return a ? 1 : b ? -1 : 0;
            return (divisionRank(a) - divisionRank(b)) || (a < b ? -1 : a > b ? 1 : 0);
        });

        divOrder.forEach(function (k) {
            if (k) {
                var h4 = document.createElement('h4');
                h4.className = 'allconf-division';
                h4.textContent = k + ' Division';
                block.appendChild(h4);
            }
            appendTeams(block, divisions[k], k ? 'h5' : 'h4');
        });
        return block;
    }

    function appendTeams(block, rows, headingTag) {
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
            block.appendChild(heading);

            var ul = document.createElement('ul');
            ul.className = 'allconf-list';
            teams[k].rows.slice().sort(function (a, b) {
                return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
            }).forEach(function (s) { ul.appendChild(buildRow(s)); });
            block.appendChild(ul);
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
