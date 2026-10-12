// Resolve a school name - either our canonical name or the way an opponent
// feed spells it - to its logo slug, or null if it is not a Super Essex school.
// Used by split-schedule.js to tag each served game with the crest(s) the
// calendar should show: the reporting school always, and the opponent too when
// the opponent is also a conference school.
//
// Deliberately conservative: a wrong crest is worse than a missing one, so a
// name that does not clearly resolve returns null and simply shows no crest.

const path = require('path');
const schools = require(path.join(__dirname, '..', 'data', 'schools.json'));
const LIST = Array.isArray(schools) ? schools : (schools.schools || schools);

function norm(s) {
    return String(s || '').toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/\bsaint\b/g, 'st')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(high|school|schools|regional|senior|hs|the|charter)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

// canonical name -> slug
const BY_KEY = new Map();
for (const s of LIST) BY_KEY.set(norm(s.name), s.slug);

// Spellings this conference’s own feeds use that the canonical
// normalisation misses. Read off data/schedule.json and checked against the
// roster one at a time.
//
// Deliberately conservative - a wrong crest is worse than a missing one. A
// name that could mean more than one school is left showing no crest rather
// than guessed at, however often it appears.
const ALIASES = {
    'caldwell': 'james-caldwell',
    'east side newark': 'east-side',
    'essex county newark tech': 'newark-tech',
    'essex county payne tech': 'payne-tech',
    'seton hall preparatory': 'seton-hall-prep',
    'st benedict s preparatory': 'st-benedicts',
    'technology newark': 'technology',
};

function logoSlug(name) {
    const k = norm(name);
    if (!k) return null;
    if (BY_KEY.has(k)) return BY_KEY.get(k);
    if (ALIASES[k]) return ALIASES[k];
    return null;
}

module.exports = { logoSlug, norm };
