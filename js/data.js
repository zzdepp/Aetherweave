/* =========================================================================*
   AETHERWEAVE — Data Module
   Contains mock data, sample posts, spaces, and trending topics.
   ========================================================================= */

const SPACES = [
  { id: 1, name: 'Hardware', color: '#e9a94d', members: 14200, description: 'Discuss PC builds, GPU benchmarks, hardware mods, and tech gear.' },
  { id: 2, name: 'Software Development', color: '#56d6bd', members: 38900, description: 'Everything about web development, frameworks, architecture, and engineering.' },
  { id: 3, name: 'Computer Science', color: '#f0665f', members: 21500, description: 'Algorithms, data structures, theoretical CS, and quantum computing.' },
  { id: 4, name: 'Troubleshooting', color: '#ffc773', members: 9800, description: 'Get community help with tech bugs, hardware glitches, and setup issues.' },
  { id: 5, name: 'Information Technology', color: '#979dac', members: 16400, description: 'Sysadmin, networking, cloud infrastructure, DevOps, and cybersecurity.' },
  { id: 6, name: 'AI & Technology', color: '#a78bfa', members: 45200, description: 'Generative AI, neural networks, automation, and tech breakthroughs.' }
];

const TRENDING_TOPICS = [
  { rank: 1, name: 'Web Design', discussions: 2300, change: '↑ 18%' },
  { rank: 2, name: 'AI & Machine Learning', discussions: 5100, change: '↑ 34%' },
  { rank: 3, name: 'JavaScript', discussions: 1800, change: '↑ 12%' },
  { rank: 4, name: 'UX Research', discussions: 1200, change: '↑ 8%' },
  { rank: 5, name: 'React.js', discussions: 2100, change: '↑ 22%' }
];

const SAMPLE_POSTS = [
  {
    id: 1,
    title: 'The Future of Web Design in 2026',
    body: 'Exploring modern trends in UI/UX and how they shape user experience across platforms. From glassmorphism to dark mode conventions, speed and micro-interactions dominate.',
    author: 'Juan Dela Cruz',
    handle: '@Juan.Css',
    space: 'Software Development',
    flair: 'Discussion',
    votes: 42,
    comments: 5,
    saved: []
  },
  {
    id: 2,
    title: 'NVIDIA RTX 5090 Benchmark & Thermal Analysis',
    body: 'Tested under full synthetic loads and heavy compute workloads at 4K max settings. Thermal dissipation is remarkably stable with the new vapor chamber design.',
    author: 'Zach Reyes',
    handle: '@Zch.reyes',
    space: 'Hardware',
    flair: 'Review',
    votes: 128,
    comments: 14,
    saved: []
  },
  {
    id: 3,
    title: 'Understanding P vs NP: Simple Visual Intuition',
    body: 'A beginner-friendly walkthrough of polynomial time verification vs creation. Why this fundamental computer science problem matters for encryption and AI.',
    author: 'Elena Rostova',
    handle: '@elena_algo',
    space: 'Computer Science',
    flair: 'Guide',
    votes: 89,
    comments: 8,
    saved: []
  },
  {
    id: 4,
    title: 'Help! PC turning on but no display signal or POST beep',
    body: 'Rebuilt my rig yesterday. The RGB fans spin up, RAM lights turn on, but monitors say "No Signal". I have tried re-seating the GPU and clear CMOS.',
    author: 'Mark Techie',
    handle: '@mark_fix',
    space: 'Troubleshooting',
    flair: 'Question',
    votes: 19,
    comments: 6,
    saved: []
  },
  {
    id: 5,
    title: 'Best practices for Zero Trust Network Architecture in 2026',
    body: 'With remote workers and hybrid cloud infrastructure, implicit trust inside perimeter firewalls is obsolete. Here is our setup with identity-aware proxies.',
    author: 'DevOps Dave',
    handle: '@dave_sys',
    space: 'Information Technology',
    flair: 'Guide',
    votes: 64,
    comments: 11,
    saved: []
  },
  {
    id: 6,
    title: 'AI Breakthroughs This Week: Multimodal Agents',
    body: 'A roundup of the most exciting developments in artificial intelligence. Autonomous multi-agent coordination is proving game-changing for complex engineering workflows.',
    author: 'Zach Reyes',
    handle: '@Zch.reyes',
    space: 'AI & Technology',
    flair: 'News',
    votes: 156,
    comments: 18,
    saved: []
  }
];

const COMMUNITY_RULES = {
  default: [
    { num: 1, title: 'Be Respectful & Constructive', desc: 'No personal attacks, hate speech, toxic behavior, or harassment.' },
    { num: 2, title: 'No Spam or Self-Promotion', desc: 'Keep self-promotion relevant and minimal. Unsolicited marketing links are removed.' },
    { num: 3, title: 'Use Descriptive Titles & Flairs', desc: 'Ensure your post title accurately summarizes your thread content.' },
    { num: 4, title: 'Original & Quality Content', desc: 'Avoid reposting duplicate discussions or low-effort meme spam.' },
    { num: 5, title: 'Respect Privacy & Credit Sources', desc: 'Do not share confidential personal information or uncredited work.' }
  ],
  'Hardware': [
    { num: 1, title: 'Include Hardware Specs', desc: 'Post full specs (CPU, GPU, PSU, RAM) when asking troubleshooting questions.' },
    { num: 2, title: 'No Counterfeit / Illegal Hardware', desc: 'Discussions must focus on legitimate, safe tech components.' },
    { num: 3, title: 'Benchmarking Standards', desc: 'Share ambient temperatures and testing methodology alongside benchmarks.' }
  ],
  'Software Development': [
    { num: 1, title: 'Format Code Blocks', desc: 'Use proper code formatting tags when sharing code snippets.' },
    { num: 2, title: 'No Solicitations for Free Work', desc: 'Use dedicated job boards or freelance channels for hiring requests.' },
    { num: 3, title: 'Provide Error Logs', desc: 'Include framework versions, stack traces, and reproduction steps.' }
  ],
  'Computer Science': [
    { num: 1, title: 'Academic Integrity', desc: 'Do not post direct homework assignment solutions for others to copy.' },
    { num: 2, title: 'Cite Papers & Resources', desc: 'Link to whitepapers, research journals, or reliable documentation.' }
  ],
  'Troubleshooting': [
    { num: 1, title: 'Describe Attempted Fixes', desc: 'List steps you have already tried before asking for help.' },
    { num: 2, title: 'Mark Solved Threads', desc: 'Update your post with [SOLVED] once a fix is confirmed.' }
  ],
  'Information Technology': [
    { num: 1, title: 'Redact Internal Credentials', desc: 'Never expose API keys, internal IPs, server secrets, or passwords.' },
    { num: 2, title: 'Enterprise & Sysadmin Focus', desc: 'Keep threads focused on enterprise tech, cloud, and security.' }
  ],
  'AI & Technology': [
    { num: 1, title: 'Tag AI-Generated Content', desc: 'Disclose if a post or illustration was created by AI tools.' },
    { num: 2, title: 'Ethical AI Discussions', desc: 'Keep debates civil regarding safety, alignment, and tech impacts.' }
  ]
};
