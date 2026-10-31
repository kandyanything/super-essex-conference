#!/usr/bin/env node
/*
 * Refresh the Instagram tab of the social wall from the conference's own account.
 *
 *   META_PAGE_TOKEN=... node scripts/build-instagram.js
 *
 * META_PAGE_TOKEN is a Facebook PAGE access token for the Super Essex Conference
 * Page, made from a long-lived user token, so it does not expire. It lives ONLY in
 * the repo's GitHub secrets - never in the repo, a log or a chat. The Page's linked
 * Instagram Business account is found through it.
 *
 * Writes the newest posts' permalinks into data/social.json (the wall embeds each
 * one with Instagram's public single-post embed) and switches the Instagram tab on
 * once there is something to show. Any failure leaves social.json exactly as it was
 * and exits 0, so a Meta outage never stops the schedule from publishing.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'social.json');
const API = 'https://graph.facebook.com/v26.0';
const IG_FALLBACK = '17841471216972056';   // @superessexconferencenj, linked to Page 1254509461089507
const MAX_POSTS = 6;

/* tolerate the usual copy slips (quotes, spaces, newlines, the "access_token": label, a comma):
   a Meta token is one run of letters and digits starting EAA, so take exactly that */
const rawToken = String(process.env.META_PAGE_TOKEN || '');
const token = (rawToken.match(/EAA[A-Za-z0-9]+/) || [rawToken.trim()])[0];
/* never let the token reach a log, even inside an error from Meta */
const clean = s => String(s || '').split(token).join('[token]').replace(/access_token=[^&\s"]+/g, 'access_token=[token]');

async function get(url) {
    const r = await fetch(url, { headers: { 'User-Agent': 'sec-social-bot' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(`${r.status} ${j.error ? j.error.message : 'bad response'}`);
    return j;
}

async function main() {
    if (!token) { console.log('META_PAGE_TOKEN is not set - leaving the Instagram tab as it is'); return; }
    /* the secret's shape, never its value */
    console.log(`Token: ${/^EAA[A-Za-z0-9]+$/.test(token) ? 'looks like a Meta token' : 'does NOT look like a Meta token'}, ${token.length} characters${rawToken.trim() !== token ? ' (extra characters around it were ignored)' : ''}`);
    const social = JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, ''));
    const ig = (social.platforms || []).find(p => p.id === 'instagram');
    if (!ig) { console.log('social.json has no instagram platform - nothing to do'); return; }

    const page = await get(`${API}/me?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`);
    const igId = page.instagram_business_account ? page.instagram_business_account.id : IG_FALLBACK;
    console.log(`Page: ${page.name} | Instagram: @${page.instagram_business_account ? page.instagram_business_account.username : '(not returned, using the known id)'}`);

    const media = await get(`${API}/${igId}/media?fields=id,permalink,media_type,timestamp&limit=${MAX_POSTS * 2}&access_token=${encodeURIComponent(token)}`);
    const posts = (media.data || [])
        .filter(m => m.permalink)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, MAX_POSTS)
        .map(m => m.permalink);
    console.log(`Instagram posts found: ${(media.data || []).length}, showing ${posts.length}`);

    const before = JSON.stringify(ig);
    ig.posts = posts;
    ig.enabled = posts.length > 0;          // an empty account keeps the tab hidden
    ig.source = 'Graph API, refreshed by scripts/build-instagram.js';
    if (ig.enabled && /Facebook\.?$/.test(social.note || '')) social.note = 'Follow the conference on Facebook and Instagram.';
    if (JSON.stringify(ig) === before) { console.log('No change to the Instagram tab'); return; }
    ig.refreshed = new Date().toISOString();
    fs.writeFileSync(FILE, JSON.stringify(social, null, 2) + '\n');   /* UTF-8, no BOM */
    console.log(`social.json updated: Instagram tab ${ig.enabled ? 'ON' : 'off'} with ${posts.length} post(s)`);
}

main().catch(e => { console.log('Instagram refresh skipped: ' + clean(e.message)); process.exitCode = 0; });
