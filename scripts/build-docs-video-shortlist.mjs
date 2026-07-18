import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../public/audits/x-videos/data.json', import.meta.url)));
const outputUrl = new URL('../DOCS_VIDEO_SHORTLIST.md', import.meta.url);
const videos = new Map(
  data.profiles.flatMap((profile) => profile.videos.map((video) => [video.postId, video])),
);

const recommended = [
  {
    postId: '2067639342944985586',
    title: 'Calculator build and QA loop on Linux',
    product: 'Cua Driver',
    role: 'Tutorial',
    placement: '[Drive your first app](https://cua.ai/docs/tutorials/drive-your-first-app)',
    decision:
      'Replace the piano preview. This recording matches the calculator task and shows the agent terminal staying in front.',
  },
  {
    postId: '2047383209244287350',
    title: 'Chrome playback without foregrounding the browser',
    product: 'Cua Driver',
    role: 'How-to guide',
    placement: '[Drive a web page](https://cua.ai/docs/how-to-guides/driver/drive-a-web-page)',
    decision: 'Keep. The recording proves the page-specific claim in 13 seconds.',
  },
  {
    postId: '2047383207612645426',
    title: 'Record and render a zoom-on-click trajectory',
    product: 'Cua Driver',
    role: 'How-to guide',
    placement:
      '[Record and render a trajectory](https://cua.ai/docs/how-to-guides/driver/record-and-render-a-trajectory)',
    decision: 'Keep. It shows the exact output that the guide teaches users to produce.',
  },
  {
    postId: '2067639346719826213',
    title: 'Build a spreadsheet over SSH on headless Linux',
    product: 'Cua Driver',
    role: 'How-to guide',
    placement: 'A new Linux-over-SSH guide or the docs overview',
    decision:
      'Use. The task, remote environment, and finished spreadsheet are clear, and the 35-second length works in docs.',
  },
  {
    postId: '2059688966085853245',
    title: 'Build, inspect, fix, and QA a WPF app',
    product: 'Cua Driver',
    role: 'How-to guide',
    placement: 'A Windows coding-agent recipe or the docs overview',
    decision:
      'Use when the page explains the full coding-agent loop. The recording is too long for a first-run tutorial.',
  },
  {
    postId: '2047383205444251889',
    title: 'Fix and QA an app while the terminal stays in front',
    product: 'Cua Driver',
    role: 'Explanation',
    placement:
      '[Best-effort background](https://cua.ai/docs/concepts/the-no-foreground-contract)',
    decision:
      'Use as the practical proof for the background-delivery explanation. Keep it below the concise pointer clips.',
  },
  {
    postId: '2061706670208897279',
    title: 'Four Hermes agents drive four Windows app windows',
    product: 'Cua Driver',
    role: 'Explanation',
    placement: 'A new agent-cursors section in the process-model or background-delivery docs',
    decision:
      'Use. Four scoped cursors and four windows make session ownership understandable at a glance.',
  },
  {
    postId: '2067639340738761015',
    title: 'Several synthetic pointers on XFCE',
    product: 'Cua Driver',
    role: 'Explanation',
    placement:
      '[Best-effort background](https://cua.ai/docs/concepts/the-no-foreground-contract)',
    decision: 'Keep. It is the shortest clear proof that agent cursors do not move the user pointer.',
  },
  {
    postId: '2067639344698179789',
    title: 'Sixteen independent cursors on Wayland',
    product: 'Cua Driver',
    role: 'Explanation',
    placement:
      '[Best-effort background](https://cua.ai/docs/concepts/the-no-foreground-contract)',
    decision: 'Keep next to the XFCE clip as platform and concurrency evidence.',
  },
  {
    postId: '2059693301276565841',
    title: 'Automate a legacy Windows postal app',
    product: 'Cua Driver',
    role: 'How-to guide',
    placement:
      '[Automate a legacy Windows app behind a VPN](https://cua.ai/docs/how-to-guides/recipes/automate-a-legacy-windows-app-behind-a-vpn)',
    decision:
      'Keep on this exact recipe. The edited version is clearer than the shorter original, though its five-minute length limits reuse.',
  },
  {
    postId: '2014406820887183512',
    title: 'Open-source Cua-Bench task registry and runner',
    product: 'Cua-Bench',
    role: 'Explanation',
    placement: 'A future Cua-Bench overview page',
    decision:
      'Use as the main Cua-Bench explainer. It covers tasks, variations, adapters, the CLI, and self-hosting.',
  },
  {
    postId: '2066597808132776150',
    title: 'Cua-Bench KiCad launch animation',
    product: 'Cua-Bench',
    role: 'Overview',
    placement: 'The top of a future Cua-Bench overview page',
    decision:
      'Use as a short product identifier beside concrete benchmark text. It is an animation, so it should not stand in for a workflow demo.',
  },
  {
    postId: '2069827307490172981',
    title: 'Gemini 3.5 Flash Cua-Bench result card',
    product: 'Cua-Bench',
    role: 'Reference or results note',
    placement: 'A Cua-Bench results page or model-evaluation example',
    decision:
      'Use only with the dated score and test-suite context. The clip communicates the result rather than the benchmark procedure.',
  },
  {
    postId: '1991598760020045950',
    title: 'Prompt an agent in a Cua cloud sandbox',
    product: 'Cua',
    role: 'Tutorial',
    placement: '[Your first cloud sandbox](https://cua.ai/docs/tutorials/your-first-cloud-sandbox)',
    decision:
      'Use if the current dashboard still matches the recording. It shows the prompt, desktop, and tool-call view together.',
  },
];

const reserve = [
  {
    postId: '2062231318294131130',
    reason:
      'Strong landing-page spectacle, but the piano task does not match the calculator tutorial and teaches no repeatable workflow.',
  },
  {
    postId: '2047383211026886709',
    reason:
      'Good proof of background Messages automation, but the two-minute personal-assistant scenario lacks a dedicated docs page.',
  },
  {
    postId: '2061706672377397735',
    reason:
      'Detailed agent-cursors explanation, but the 2:36 runtime repeats the clearer 21-second four-window clip.',
  },
  {
    postId: '2000972986090709370',
    reason:
      'Useful historical Cua-Bench explanation. Prefer the newer open-source overview for current docs.',
  },
  {
    postId: '1973799068263723050',
    reason:
      'A clear benchmark comparison that can support a page about reading results, but it uses an older model comparison.',
  },
  {
    postId: '1961443982350635182',
    reason:
      'The human-in-the-loop UI is clear. Hold until the current product has a matching handoff guide.',
  },
  {
    postId: '1952774028726272477',
    reason:
      'The TypeScript and cloud-desktop flow is clear, but the older Playground UI and API need a currentness check.',
  },
];

const approved = recommended.slice(0, 11);
const needsReview = recommended.slice(11);

function getVideo(postId) {
  const video = videos.get(postId);
  if (!video) throw new Error(`Video post ${postId} is missing from the audit data.`);
  return video;
}

function formatDuration(durationMs) {
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderVideo(entry, index) {
  const video = getVideo(entry.postId);
  return [
    `### ${index + 1}. ${entry.title}`,
    '',
    `[![Midpoint frame from ${entry.title}](${video.framePath})](${video.videoUrl})`,
    '',
    `- Product: ${entry.product}`,
    `- Docs role: ${entry.role}`,
    `- Best placement: ${entry.placement}`,
    `- Decision: ${entry.decision}`,
    `- Recording: ${formatDuration(video.durationMs)}, ${video.width}×${video.height}`,
    `- Source: [@${video.handle} post ${video.postId}](${video.postUrl})`,
    '',
  ];
}

const selectedIds = new Set([...recommended, ...reserve].map((entry) => entry.postId));
const lines = [
  '# Docs video shortlist',
  '',
  `Generated from the [full X video audit](VIDEO_AUDIT.md), which contains ${videos.size} public video posts.`,
  '',
  '## Recommendation',
  '',
  `Videos 1–${approved.length} are approved for docs. Videos ${approved.length + 1}–${recommended.length} still need review. Keep ${reserve.length} as reserves, and leave the remaining ${videos.size - selectedIds.size} out of the docs.`,
  '',
  '- Put task-matched recordings in tutorials and how-to guides.',
  '- Put capability proofs and product animations in explanation or overview pages.',
  '- Avoid reaction GIFs, launch teasers, unrelated personal posts, and older product surfaces unless a page needs historical context.',
  '- Keep one strong recording per claim. Repeating the same clip on the docs index and a task page makes both pages heavier.',
  '',
  'The clearest immediate change is to replace the Windows piano video in **Drive your first app** with the Linux calculator QA loop. The tutorial asks the user to drive a calculator, so its preview should show that task.',
  '',
  'The current Fumadocs content tree has no Cua-Bench MDX page. Add an overview page before embedding Cua-Bench launch or results clips.',
  '',
  '## Approved for docs',
  '',
  ...approved.flatMap(renderVideo),
  '## Needs review',
  '',
  ...needsReview.flatMap((entry, index) => renderVideo(entry, approved.length + index)),
  '## Reserve',
  '',
  '| Preview | Post | Why it is a reserve |',
  '| --- | --- | --- |',
];

for (const entry of reserve) {
  const video = getVideo(entry.postId);
  lines.push(
    `| [Midpoint frame](${video.framePath}) | [${video.postId}](${video.postUrl}) | ${entry.reason} |`,
  );
}

lines.push(
  '',
  '## Explicit rejection',
  '',
  '- [Post 2069827325244608881](https://x.com/trycua/status/2069827325244608881) says the agent drives a KiCad task, but the midpoint shows a Zone Lighting grid. Do not place it on a KiCad or Cua-Bench task page without checking the complete recording and correcting the caption.',
  '- Do not use the 3:37 “Don’t Stop Me Now” piano recording when the 44-second piano edit exists.',
  '- Leave low-resolution reactions and one-second reply GIFs in the full audit. They add no product instruction.',
  '',
);

writeFileSync(outputUrl, `${lines.join('\n').trimEnd()}\n`);
