/**
 * Regression test for the news relevance filter.
 *
 * The press wire kept publishing stories about schools in other conferences
 * because stripping " High School" off a member name leaves a bare word that
 * matches schools all over the state: "Central High School" (Newark, a real
 * SEC member) becomes "Central", which then matches Hunterdon Central and
 * Central Regional.
 *
 * Run: node scripts/test-news-relevance.js
 */
const { matchRelevance, relevanceText } = require('./build-news.js');

// [ headline, shouldBeRelevant, why ]
const CASES = [
    // ---- the two that shipped to the live site and should not have ----
    ['Central Regional field hockey shakes off slow start, rallies past Toms River South',
        false, 'Central Regional + Toms River South are Shore Conference'],
    ['Townsend nets 7th goal as Hunterdon Central boys soccer defeats Westfield',
        false, 'Hunterdon Central is Skyland, Westfield is Union County'],

    // ---- real SEC stories that must keep flowing ----
    ['Ross nets 10th goal to lift Verona girls soccer past Montclair',
        true, 'Verona and Montclair are both SEC'],
    ['No. 2 West Orange boys soccer shuts out Plainfield',
        true, 'West Orange is SEC'],
    ['Pair of multi-goal efforts spark Columbia field hockey to victory against Millburn',
        true, 'Columbia and Millburn are both SEC'],
    ['Conforti’s hat trick powers No. 2 West Essex field hockey to victory over Glen Ridge',
        true, 'West Essex and Glen Ridge are both SEC'],
    ['Hat trick leads undefeated East Orange boys soccer to sixth win, Jaguars roll past College Achieve',
        true, 'East Orange Campus is SEC, matched via the bare word Orange'],

    // ---- other-conference collisions on generic bare aliases ----
    ['Central Jersey football rankings shuffle after Week 3',
        false, 'Central Jersey is a region, not our Central High School'],
    ['Montclair State University soccer lands three recruits',
        false, 'Montclair State is a university, not Montclair High'],
    ['Rutgers University athletics announces new athletic director',
        false, 'University must not match Rutgers University'],
    ['Bloomfield College basketball opens its season at home',
        false, 'Bloomfield College is not Bloomfield High School'],
    ['Columbia University tennis sweeps the Ivy League opener',
        false, 'Columbia University is not Columbia High School'],
    ['Toms River North wins the Shore Conference wrestling title',
        false, 'no SEC school named at all'],
    ['Delran field hockey tops Moorestown in South Jersey', false, 'no SEC school'],

    // ---- generic alias WITH local context should still count ----
    ['Newark Central basketball wins the Essex County tournament opener',
        true, 'Central plus Newark and Essex context'],
    ['Central High School soccer advances in Newark',
        true, 'full registered name is spelled out'],

    // ---- conference named outright ----
    ['Super Essex Conference announces realignment for the fall season',
        true, 'conference named in full'],
    ['Southeastern Conference expands its football playoff format',
        false, 'SEC here is the Southeastern Conference'],

    // ---- distinctive SEC names standing alone ----
    ['Weequahic football rolls to a third straight win', true, 'Weequahic is unmistakable'],
    ['Seton Hall Prep swimming sets a pool record', true, 'Seton Hall Prep is SEC'],
    ['Glen Ridge cross country sweeps the county meet', true, 'Glen Ridge is SEC'],
    ['Nutley volleyball drops a five-set thriller', true, 'Nutley is SEC'],
];

// Headline + summary pairs. The summary's first word must not glue onto the
// headline's last word and invent a school nobody has.
// [ title, excerpt, shouldBeRelevant, why ]
const PAIR_CASES = [
    ['Pair of multi-goal efforts spark Columbia field hockey to victory against Millburn',
        'Only two different players found the back of the net for Columbia, but five goals between those two players was more than enough to secure a win',
        true, 'Millburn is SEC; "Only" starting the summary must not form "Millburn Only"'],
    ['Ross nets 10th goal to lift Verona girls soccer past Montclair',
        'Three second-half goals sealed it for the Hillbillies',
        true, 'Verona and Montclair are SEC'],
    ['Townsend nets 7th goal as Hunterdon Central boys soccer defeats Westfield',
        'Hunterdon Central posts fifth straight win',
        false, 'still nobody from the SEC'],
    ['Central Regional field hockey shakes off slow start, rallies past Toms River South',
        'It took a half’s worth of action for Central Regional to get into gear',
        false, 'still nobody from the SEC'],
];

let pass = 0, fail = 0;
const failures = [];

for (const [title, excerpt, want, why] of PAIR_CASES) {
    const { confHit, schoolName } = matchRelevance(relevanceText(title, excerpt));
    const got = confHit || schoolName !== null;
    if (got === want) {
        pass++;
        console.log(`  ok    ${want ? 'KEEP  ' : 'REJECT'}  [+summary] ${title.slice(0, 50)}`);
    } else {
        fail++;
        failures.push({ headline: title + '  ||  ' + excerpt, want, got, why, schoolName });
        console.log(`  FAIL  want ${want ? 'KEEP' : 'REJECT'}, got ${got ? 'KEEP' : 'REJECT'}  [+summary] ${title.slice(0, 44)}`);
    }
}

for (const [headline, want, why] of CASES) {
    const { confHit, schoolName } = matchRelevance(headline);
    const got = confHit || schoolName !== null;
    if (got === want) {
        pass++;
        console.log(`  ok    ${want ? 'KEEP  ' : 'REJECT'}  ${headline.slice(0, 62)}`);
    } else {
        fail++;
        failures.push({ headline, want, got, why, schoolName });
        console.log(`  FAIL  want ${want ? 'KEEP' : 'REJECT'}, got ${got ? 'KEEP' : 'REJECT'}  ${headline.slice(0, 55)}`);
    }
}

console.log(`\n${pass} passed, ${fail} failed, ${CASES.length + PAIR_CASES.length} total`);
if (fail) {
    console.log('\nFailures:');
    for (const f of failures)
        console.log(`  - ${f.headline}\n      reason: ${f.why}\n      matched school: ${f.schoolName || '(none)'}`);
    process.exit(1);
}
console.log('All relevance cases pass.');
