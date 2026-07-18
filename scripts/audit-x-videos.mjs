import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const handles = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['trycua', 'francedot'];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const framesRoot = resolve(repoRoot, 'public/audits/x-videos/frames');
const dataPath = resolve(repoRoot, 'public/audits/x-videos/data.json');
const auditPath = resolve(repoRoot, 'VIDEO_AUDIT.md');
const maxPages = 80;
const nitterInstances = [
  'https://nitter.kareem.one',
  'https://xcancel.com',
  'https://nitter.poast.org',
];
const browserUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  'Chrome/124.0.0.0 Safari/537.36';

mkdirSync(framesRoot, { recursive: true });

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    ...options,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return body;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    ...options,
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  }
  return JSON.parse(body);
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function selectNitterInstance(handle) {
  const failures = [];
  for (const instance of nitterInstances) {
    const url = `${instance}/${handle}/media`;
    try {
      const html = await fetchText(url, { headers: { 'user-agent': browserUserAgent } });
      if (html.includes('timeline-item') && html.includes(`/${handle}/status/`)) {
        return { instance, firstPage: html };
      }
      failures.push(`${instance}: no timeline entries`);
    } catch (error) {
      failures.push(`${instance}: ${error.message}`);
    }
  }
  throw new Error(`No public Nitter media timeline worked for @${handle}: ${failures.join('; ')}`);
}

function timelineItems(html) {
  const starts = [...html.matchAll(/<div class="timeline-item[^>]*>/g)];
  return starts.map((match, index) => html.slice(match.index, starts[index + 1]?.index ?? html.length));
}

function nextTimelineUrl(html, baseUrl) {
  const links = [...html.matchAll(/class="show-more"><a href="([^"]+)"/g)].map((match) =>
    match[1].replaceAll('&amp;', '&'),
  );
  return links.length > 0 ? new URL(links.at(-1), baseUrl).toString() : null;
}

async function crawlMediaTimeline(handle) {
  const { instance, firstPage } = await selectNitterInstance(handle);
  const baseUrl = `${instance}/${handle}/media`;
  const allMediaPostIds = new Set();
  const videoPostIds = new Set();
  let html = firstPage;
  let pageUrl = baseUrl;
  let stopReason = 'page-limit';
  const seenPageUrls = new Set();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    if (seenPageUrls.has(pageUrl)) {
      stopReason = 'repeated-cursor';
      break;
    }
    seenPageUrls.add(pageUrl);

    for (const item of timelineItems(html)) {
      const postId = item.match(new RegExp(`/${handle}/status/(\\d+)`))?.[1];
      if (!postId) continue;
      allMediaPostIds.add(postId);
      if (item.includes('video-download') || item.includes('<video')) videoPostIds.add(postId);
    }

    log(
      `@${handle}: media page ${pageNumber}, ${allMediaPostIds.size} media posts, ` +
        `${videoPostIds.size} video candidates`,
    );

    const nextUrl = nextTimelineUrl(html, baseUrl);
    if (!nextUrl) {
      stopReason = 'end-of-public-media-timeline';
      break;
    }
    pageUrl = nextUrl;
    await sleep(200);
    html = await fetchText(pageUrl, { headers: { 'user-agent': browserUserAgent } });
  }

  return {
    handle,
    source: `${instance}/${handle}/media`,
    mediaPostsSeen: allMediaPostIds.size,
    videoPostIds: [...videoPostIds],
    stopReason,
  };
}

function syndicationToken(postId) {
  return ((Number(postId) / 1e15) * Math.PI).toString(36).replaceAll('0', '').replaceAll('.', '') || 'x';
}

function resolutionFromUrl(url, fallback = {}) {
  const match = url.match(/\/(\d+)x(\d+)\//);
  return match
    ? { width: Number(match[1]), height: Number(match[2]) }
    : { width: fallback.width ?? null, height: fallback.height ?? null };
}

function highestMp4(variants, fallback = {}) {
  return variants
    .filter((variant) => (variant.content_type ?? variant.type) === 'video/mp4' && (variant.url ?? variant.src))
    .map((variant) => ({ ...variant, url: variant.url ?? variant.src }))
    .sort((left, right) => {
      const leftResolution = resolutionFromUrl(left.url, fallback);
      const rightResolution = resolutionFromUrl(right.url, fallback);
      const areaDifference =
        rightResolution.width * rightResolution.height - leftResolution.width * leftResolution.height;
      return areaDifference || (right.bitrate ?? 0) - (left.bitrate ?? 0);
    })[0];
}

async function fetchSyndicationPost(handle, postId) {
  const token = syndicationToken(postId);
  const url =
    `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(postId)}` +
    `&token=${encodeURIComponent(token)}&lang=en`;
  const post = await fetchJson(url, { headers: { 'user-agent': browserUserAgent } });
  if (!post.id_str || post.user?.screen_name?.toLowerCase() !== handle.toLowerCase()) return [];

  const directMedia = post.mediaDetails ?? [];
  const text = post.text ?? '';
  if (/^RT\s+@/i.test(text)) return [];

  const videos = directMedia.flatMap((media, index) => {
    if (!['video', 'animated_gif'].includes(media.type) || !media.video_info) return [];
    const variant = highestMp4(media.video_info.variants ?? [], media.original_info);
    if (!variant) return [];
    const resolution = resolutionFromUrl(variant.url, media.original_info);
    return [
      {
        handle,
        postId,
        postUrl: `https://x.com/${handle}/status/${postId}`,
        createdAt: new Date(post.created_at).toISOString(),
        text,
        isReply: Boolean(post.in_reply_to_status_id_str),
        replyToPostId: post.in_reply_to_status_id_str ?? null,
        mediaIndex: index + 1,
        mediaType: media.type,
        posterUrl: media.media_url_https ?? null,
        videoUrl: variant.url,
        width: resolution.width,
        height: resolution.height,
        durationMs: media.video_info.duration_millis ?? null,
        bitrate: variant.bitrate ?? null,
      },
    ];
  });

  if (videos.length > 0 || directMedia.length > 0 || !post.video) return videos;

  const variant = highestMp4(post.video.variants ?? []);
  if (!variant) return [];
  const resolution = resolutionFromUrl(variant.url);
  return [
    {
      handle,
      postId,
      postUrl: `https://x.com/${handle}/status/${postId}`,
      createdAt: new Date(post.created_at).toISOString(),
      text,
      isReply: Boolean(post.in_reply_to_status_id_str),
      replyToPostId: post.in_reply_to_status_id_str ?? null,
      mediaIndex: 1,
      mediaType: 'video',
      posterUrl: post.video.poster ?? null,
      videoUrl: variant.url,
      width: resolution.width,
      height: resolution.height,
      durationMs: post.video.durationMs ?? null,
      bitrate: variant.bitrate ?? null,
    },
  ];
}

async function resolveVideoPosts(profile) {
  const videos = [];
  const unresolvedPostIds = [];
  const batchSize = 8;

  for (let offset = 0; offset < profile.videoPostIds.length; offset += batchSize) {
    const batch = profile.videoPostIds.slice(offset, offset + batchSize);
    const results = await Promise.all(
      batch.map(async (postId) => {
        try {
          return { postId, videos: await fetchSyndicationPost(profile.handle, postId) };
        } catch (error) {
          return { postId, error: error.message };
        }
      }),
    );
    for (const result of results) {
      if (result.error) {
        unresolvedPostIds.push({ postId: result.postId, error: result.error });
      } else {
        videos.push(...result.videos);
      }
    }
    log(
      `@${profile.handle}: resolved ${Math.min(offset + batch.length, profile.videoPostIds.length)}/` +
        `${profile.videoPostIds.length} video candidates`,
    );
    await sleep(100);
  }

  return { ...profile, videos, unresolvedPostIds };
}

function probeDuration(videoUrl) {
  const output = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoUrl],
    { encoding: 'utf8' },
  ).trim();
  return Number(output) * 1000;
}

function createMidpointFrame(video) {
  const profileFrames = resolve(framesRoot, video.handle);
  mkdirSync(profileFrames, { recursive: true });
  const frameName = `${video.postId}-${video.mediaIndex}.jpg`;
  const framePath = resolve(profileFrames, frameName);
  const durationMs = video.durationMs ?? probeDuration(video.videoUrl);
  const midpointSeconds = Math.max(0, durationMs / 2000);

  if (!existsSync(framePath) || statSync(framePath).size === 0) {
    execFileSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        midpointSeconds.toFixed(3),
        '-i',
        video.videoUrl,
        '-frames:v',
        '1',
        '-vf',
        'scale=min(960\\,iw):-2',
        '-q:v',
        '2',
        '-y',
        framePath,
      ],
      { stdio: 'inherit' },
    );
  }

  return {
    ...video,
    durationMs,
    framePath: `public/audits/x-videos/frames/${video.handle}/${frameName}`,
    frameUrl: `https://trycua.github.io/assets/audits/x-videos/frames/${video.handle}/${frameName}`,
  };
}

function markdownEscape(text) {
  return text.replaceAll('\\', '\\\\').replaceAll('|', '\\|');
}

function formatDuration(durationMs) {
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function buildMarkdown(profiles, generatedAt) {
  const totalVideos = profiles.reduce((sum, profile) => sum + profile.videos.length, 0);
  const totalReplies = profiles.reduce(
    (sum, profile) => sum + profile.videos.filter((video) => video.isReply).length,
    0,
  );
  const totalUnresolved = profiles.reduce((sum, profile) => sum + profile.unresolvedPostIds.length, 0);
  const lines = [
    '# X video audit',
    '',
    `Generated ${generatedAt}.`,
    '',
    '## Coverage',
    '',
    '- Profiles: `@trycua` and `@francedot`.',
    '- Source: each public X media timeline (including replies), enumerated through Nitter and resolved through X’s public syndication endpoint.',
    '- Included: original posts and replies with directly attached video or animated-GIF media.',
    '- Excluded: reposts, photos, and videos that appear only inside quoted posts.',
    '- Deleted, protected, or otherwise non-public posts cannot be audited.',
    `- Total video media items: ${totalVideos}, including ${totalReplies} posted as replies.`,
    `- Unresolved public video candidates: ${totalUnresolved}.`,
    '- Click a midpoint frame to open the highest-resolution MP4 on X’s CDN.',
    '',
    '| Profile | Media posts inspected | Video posts | Video media | Reply media | Stop reason |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const profile of profiles) {
    lines.push(
      `| @${profile.handle} | ${profile.mediaPostsSeen} | ${new Set(profile.videos.map((video) => video.postId)).size} | ${profile.videos.length} | ${profile.videos.filter((video) => video.isReply).length} | ${profile.stopReason} |`,
    );
  }

  for (const profile of profiles) {
    lines.push('', `## @${profile.handle}`, '', `[Public media timeline used for discovery](${profile.source})`, '');
    if (profile.unresolvedPostIds.length > 0) {
      lines.push('### Unresolved candidates', '');
      for (const candidate of profile.unresolvedPostIds) {
        lines.push(
          `- [Post ${candidate.postId}](https://x.com/${profile.handle}/status/${candidate.postId}): ${candidate.error}`,
        );
      }
      lines.push('');
    }

    const videosByPost = Map.groupBy(profile.videos, (video) => video.postId);
    for (const [postId, videos] of videosByPost) {
      const first = videos[0];
      const replyLabel = first.isReply ? ' · reply' : '';
      lines.push(
        `### ${first.createdAt.slice(0, 10)}${replyLabel} · [Post ${postId}](${first.postUrl})`,
        '',
        `> ${markdownEscape(first.text).replaceAll('\n', '<br>')}`,
        '',
      );
      for (const video of videos) {
        lines.push(
          `[![Midpoint frame from post ${postId}](${video.framePath})](${video.videoUrl})`,
          '',
          `- Media ${video.mediaIndex}: [highest-resolution MP4](${video.videoUrl})`,
          `- Resolution: ${video.width ?? '?'}×${video.height ?? '?'} · Duration: ${formatDuration(video.durationMs)} · Type: ${video.mediaType}`,
          video.posterUrl ? `- [Original X poster](${video.posterUrl})` : '- Original X poster: unavailable',
          '',
        );
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

const profiles = [];
for (const handle of handles) {
  const crawled = await crawlMediaTimeline(handle);
  profiles.push(await resolveVideoPosts(crawled));
}

for (const profile of profiles) {
  profile.videos.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  profile.videos = profile.videos.map((video, index) => {
    log(`@${profile.handle}: frame ${index + 1}/${profile.videos.length}, post ${video.postId}`);
    return createMidpointFrame(video);
  });
}

const generatedAt = new Date().toISOString();
writeFileSync(dataPath, `${JSON.stringify({ generatedAt, profiles }, null, 2)}\n`);
writeFileSync(auditPath, buildMarkdown(profiles, generatedAt));
log(`Wrote ${auditPath}`);
