#!/usr/bin/env node
/*
 * Refresh the social wall from the conference's own Facebook Page and Instagram.
 *
 *   META_PAGE_TOKEN=... node scripts/build-social.js
 *
 * META_PAGE_TOKEN is a Facebook PAGE access token for the conference's Page, made from
 * a long-lived user token, so it does not expire. It lives ONLY in the repo's GitHub
 * secrets - never in the repo, a log or a chat.
 *
 * Facebook: the newest Page posts (text, picture, date, link) go into data/social.json
 *   as `items`, which the wall draws as its own cards. Facebook's Page Plugin often shows
 *   no posts at all for newer Pages, so the cards replace it once there are posts.
 * Instagram: the newest posts' links go into `posts`; the wall embeds each one.
 *
 * Each platform refreshes on its own: one failing leaves that platform exactly as it
 * was, and whatever did refresh is still written. If either platform could not be
 * refreshed (most often an expired or revoked META_PAGE_TOKEN), the script prints a
 * GitHub ::error and exits 1. The workflows run this step with continue-on-error and
 * commit first, so the schedule still publishes, then turn the run red - a broken
 * token shows up the same day instead of the social wall quietly freezing.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'social.json');
const API = 'https://graph.facebook.com/v26.0';
const MAX_POSTS = 6;

/* a Meta token is one run of letters and digits starting EAA: take exactly that, so
   stray quotes, spaces or an "access_token": label pasted with it don't matter */
const rawToken = String(process.env.META_PAGE_TOKEN || '');
const token = (rawToken.match(/EAA[A-Za-z0-9]+/) || [rawToken.trim()])[0];
/* never let the token reach a log, even inside an error from Meta */
const clean = s => String(s || '').split(token || '\u0000').join('[token]').replace(/access_token=[^&\s"]+/g, 'access_token=[token]');

/* problems found this run; any at all turns the run red (see report()) */
const problems = [];
const sleep = ms => new Promise(res => setTimeout(res, ms));

/* one retry for a network blip or a Meta 5xx, so a momentary outage doesn't raise a
   false alarm; a 4xx (bad or revoked token, missing permission) fails straight away */
async function get(url) {
    for (let attempt = 1; ; attempt++) {
        let r, j;
        try {
            r = await fetch(url + (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token), { headers: { 'User-Agent': 'conference-social-bot' } });
            j = await r.json().catch(() => ({}));
        } catch (e) {
            if (attempt < 2) { await sleep(5000); continue; }
            throw new Error('could not reach Meta: ' + (e.cause && e.cause.message || e.message));
        }
        if (r.status >= 500 && attempt < 2) { await sleep(5000); continue; }
        if (!r.ok || j.error) throw new Error(`${r.status} ${j.error ? j.error.message : 'bad response'}`);
        return j;
    }
}
const trim = (s, n) => { s = String(s || '').replace(/\s+\n/g, '\n').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };

async function facebook(fb, pageId) {
    const res = await get(`${API}/${pageId}/posts?fields=message,story,full_picture,permalink_url,created_time,attachments{media_type,title}&limit=${MAX_POSTS * 2}`);
    const items = (res.data || [])
        .filter(p => p.permalink_url && (p.message || p.full_picture))
        .slice(0, MAX_POSTS)
        .map(p => ({
            text: trim(p.message || (p.attachments && p.attachments.data && p.attachments.data[0] && p.attachments.data[0].title) || '', 280),
            image: p.full_picture || '',
            url: p.permalink_url,
            time: p.created_time,
            video: !!(p.attachments && p.attachments.data && /video/i.test(p.attachments.data[0] && p.attachments.data[0].media_type || '')),
        }));
    console.log(`Facebook posts found: ${(res.data || []).length}, showing ${items.length}`);
    fb.items = items;
    if (items.length) fb.enabled = true;
}

async function instagram(ig, igId) {
    const res = await get(`${API}/${igId}/media?fields=id,permalink,timestamp&limit=${MAX_POSTS * 2}`);
    const posts = (res.data || []).filter(m => m.permalink)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, MAX_POSTS).map(m => m.permalink);
    console.log(`Instagram posts found: ${(res.data || []).length}, showing ${posts.length}`);
    ig.posts = posts;
    ig.enabled = posts.length > 0;          // an empty account keeps the tab hidden
}

async function main() {
    if (!token) { problems.push('META_PAGE_TOKEN is not set, so the social wall cannot refresh'); return; }
    /* the secret's shape, never its value */
    console.log(`Token: ${/^EAA[A-Za-z0-9]+$/.test(token) ? 'looks like a Meta token' : 'does NOT look like a Meta token'}, ${token.length} characters${rawToken.trim() !== token ? ' (extra characters around it were ignored)' : ''}`);
    const social = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));
    const before = JSON.stringify(social.platforms);
    const fb = (social.platforms || []).find(p => p.id === 'facebook');
    const ig = (social.platforms || []).find(p => p.id === 'instagram');

    const page = await get(`${API}/me?fields=id,name,link,instagram_business_account{id,username}`);
    const igAcct = page.instagram_business_account;
    console.log(`Page: ${page.name} | Instagram: ${igAcct ? '@' + igAcct.username : '(none linked)'}`);

    if (fb) {
        if (!fb.url && page.link) fb.url = page.link;
        await facebook(fb, page.id).catch(e => problems.push('Facebook refresh failed: ' + e.message));
    }
    if (ig && igAcct) {
        if (!ig.url && igAcct.username) { ig.url = `https://www.instagram.com/${igAcct.username}/`; ig.handle = ig.handle || '@' + igAcct.username; }
        await instagram(ig, igAcct.id).catch(e => problems.push('Instagram refresh failed: ' + e.message));
    } else if (ig && ig.enabled) {
        problems.push('No Instagram account is linked to the Facebook Page any more, so Instagram cannot refresh');
    }
    const on = (social.platforms || []).filter(p => p.enabled).map(p => p.label || p.id);
    if (on.length) social.note = `Follow the conference on ${on.join(' and ')}.`;
    if (JSON.stringify(social.platforms) === before) { console.log('No change to the social wall'); return; }
    social.refreshed = new Date().toISOString();
    fs.writeFileSync(FILE, JSON.stringify(social, null, 2) + '\n');   /* UTF-8, no BOM */
    console.log(`social.json updated: ${on.join(', ') || 'nothing'} on`);
}

function report() {
    if (!problems.length) { console.log('Social wall: refresh OK'); return; }
    for (const p of problems) console.log(`::error title=Social posts are not updating::${clean(p).replace(/\r?\n/g, ' ')}`);
    console.log('The site keeps showing the last posts it fetched until this is fixed. If Meta says it "cannot call API" '
        + 'or the token is invalid or expired, make a new Page token and update the META_PAGE_TOKEN secret - see "Social wall" in README.md.');
    process.exitCode = 1;
}

main().catch(e => problems.push('Social refresh failed: ' + e.message)).finally(report);
