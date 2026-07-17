/* =========================================================================*
   AETHERWEAVE — Data Module
   Contains mock data, sample posts, spaces, and trending topics.
   ========================================================================= */

const SPACES = [
  { id: 1, name: 'Hardware', color: '#e9a94d', members: 0 },
  { id: 2, name: 'Software Development', color: '#56d6bd', members: 0 },
  { id: 3, name: 'Computer Science', color: '#f0665f', members: 0 },
  { id: 4, name: 'Troubleshooting', color: '#ffc773', members: 0 },
  { id: 5, name: 'Information Technology', color: '#979dac', members: 0 }
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
    title: 'The Future of Web Design',
    body: 'Exploring modern trends in UI/UX and how they shape user experience across platforms. From glassmorphism to dark mode conventions.',
    author: 'Juan Dela Cruz',
    handle: '@Juan.Css',
    space: 'Software Development',
    votes: 0,
    comments: 0,
    saved: false
  },
  {
    id: 2,
    title: 'AI Breakthroughs This Week',
    body: 'A roundup of the most exciting developments in artificial intelligence and machine learning. Including the latest transformer models.',
    author: 'Zach Reyes',
    handle: '@Zch.reyes',
    space: 'Science',
    votes: 2,
    comments: 0,
    saved: false
  }
];
