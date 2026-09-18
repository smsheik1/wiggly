import test from "node:test";
import assert from "node:assert/strict";
import { parseRedditRss, createCandidateCard } from "../runtime/scout-trends.mjs";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>⛈️Discussion, News, and Request Thread - Week Beginning 09/07/26⛈️</title>
    <link href="https://www.reddit.com/r/GamingLeaksAndRumours/comments/1234/weekly/" />
    <updated>2026-09-18T12:00:00+00:00</updated>
    <content type="html">&lt;p&gt;Weekly megathread&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Jason Schreier: Grand Theft Auto VI delay rumors addressed by Rockstar staff</title>
    <link href="https://www.reddit.com/r/GamingLeaksAndRumours/comments/5678/gta6_schreier/" />
    <author><name>/u/LeakHunter99</name></author>
    <updated>2026-09-18T14:30:00+00:00</updated>
    <content type="html">&lt;p&gt;Multiple leads at Rockstar confirm the game is progressing smoothly towards 2026 window.&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Mark Gurman: Apple testing thinner chassis for iPhone 18 Pro with new vapor chamber</title>
    <link href="https://www.reddit.com/r/apple/comments/9012/iphone18_gurman/" />
    <author><name>/u/AppleInsiderFan</name></author>
    <updated>2026-09-18T15:00:00+00:00</updated>
    <content type="html">&lt;p&gt;Bloomberg Power On newsletter highlights thermal redesign.&lt;/p&gt;</content>
  </entry>
</feed>`;

test("parseRedditRss filters megathreads and extracts curator leaks correctly", () => {
  const entries = parseRedditRss(SAMPLE_RSS);

  assert.equal(entries.length, 2, "Should filter out the weekly megathread");

  const [gtaPost, applePost] = entries;

  assert.equal(gtaPost.title, "Jason Schreier: Grand Theft Auto VI delay rumors addressed by Rockstar staff");
  assert.equal(gtaPost.author, "LeakHunter99");
  assert.deepEqual(gtaPost.curators, ["Jason Schreier"]);
  assert.equal(gtaPost.isHighPriority, true);

  assert.equal(applePost.title, "Mark Gurman: Apple testing thinner chassis for iPhone 18 Pro with new vapor chamber");
  assert.deepEqual(applePost.curators, ["Mark Gurman"]);
  assert.equal(applePost.isHighPriority, true);
});

test("createCandidateCard structures candidate card with comments", () => {
  const post = {
    subreddit: "GamingLeaksAndRumours",
    title: "Jason Schreier: Grand Theft Auto VI delay rumors addressed by Rockstar staff",
    link: "https://www.reddit.com/r/GamingLeaksAndRumours/comments/5678/gta6_schreier/",
    snippet: "Multiple leads at Rockstar confirm progress.",
    curators: ["Jason Schreier"]
  };

  const comments = [
    "At this point my grandkids will be playing GTA 6 on their PS9 💀",
    "Notice how they never actually said a release date though."
  ];

  const card = createCandidateCard(post, comments);

  assert.equal(card.source, "reddit-radar");
  assert.equal(card.subreddit, "GamingLeaksAndRumours");
  assert.deepEqual(card.detectedCurators, ["Jason Schreier"]);
  assert.equal(card.communityRoastQuotes.length, 2);
  assert.equal(card.suggestedHook, "At this point my grandkids will be playing GTA 6 on their PS9 💀");
});
