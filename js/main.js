/* =========================================================================*
   AETHERWEAVE — Main Application Logic
   Wires up: feed rendering, composer, voting/saving/comments, sidebar,
   search, profile dropdown, and the AI helper drawer.
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------------------
     0. STATE
     --------------------------------------------------------------------- */
  const state = {
    sort: 'trending',       // trending | new | top | following | saved
    spaceFilter: null,      // space name string or null
    searchQuery: '',
    joinedSpaces: new Set()
  };

  let pendingComposerImage = null; // { dataUrl } or null

  /* ---------------------------------------------------------------------
     1. DOM REFS
     --------------------------------------------------------------------- */
  const appShell = document.getElementById('appShell');
  const sidebar = document.getElementById('sidebar');
  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileOverlay = document.getElementById('mobileOverlay');
  const drawerOverlay = document.getElementById('drawerOverlay');

  const spacesNavList = document.getElementById('spacesNavList');
  const suggestedSpacesList = document.getElementById('suggestedSpacesList');
  const trendingList = document.getElementById('trendingList');
  const pulseActive = document.getElementById('pulseActive');
  const pulseCountries = document.getElementById('pulseCountries');
  const pulseBarFill = document.getElementById('pulseBarFill');
  const pulseBarPct = document.getElementById('pulseBarPct');

  const postsContainer = document.getElementById('postsContainer');
  const emptyState = document.getElementById('emptyState');
  const profileView = document.getElementById('profileView');
  const feedTabsBar = document.getElementById('feedTabsBar');
  const settingsBtn = document.getElementById('settingsBtn');

  const feedTabs = document.querySelectorAll('.feed-tab[data-sort]');
  const sidebarSortLinks = document.querySelectorAll('.nav-link[data-sort]');
  const exploreLink = document.querySelector('[data-explore]');

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');

  const profileTrigger = document.getElementById('profileTrigger');
  const profileDropdown = document.getElementById('profileDropdown');
  const savedPostsBtn = document.getElementById('savedPostsBtn');
  const notifBtn = document.getElementById('notifBtn');

  // Composer
  const composer = document.getElementById('composer');
  const composerTitle = document.getElementById('composerTitle');
  const composerBody = document.getElementById('composerBody');
  const composerToolbar = document.querySelector('.composer-toolbar');
  const composerSpaceSelect = document.getElementById('composerSpaceSelect');
  const composerCancelBtn = document.getElementById('composerCancelBtn');
  const composerPostBtn = document.getElementById('composerPostBtn');
  const charCount = document.getElementById('charCount');
  const imageToolbarBtn = document.getElementById('imageToolbarBtn');
  const imageInput = document.getElementById('imageInput');
  const imageDropZone = document.getElementById('imageDropZone');
  const imagePreviewGrid = document.getElementById('imagePreviewGrid');

  // AI Drawer
  const aiHelperBtn = document.getElementById('aiHelperBtn');
  const aiDrawer = document.getElementById('aiDrawer');
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  const chatResetBtn = document.getElementById('chatResetBtn');
  const aiMessages = document.getElementById('aiMessages');
  const aiSuggestions = document.getElementById('aiSuggestions');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');

  const toastContainer = document.getElementById('toastContainer');

  /* ---------------------------------------------------------------------
     2. UTILITIES
     --------------------------------------------------------------------- */
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  };

  const timeAgo = (isoString) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString();
  };

  const showToast = (message, type = 'default') => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${type === 'error'
          ? '<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/>'
          : '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'}
      </svg>
      <span></span>
    `;
    toast.querySelector('span').textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  };

  const spaceColor = (spaceName) => {
    const space = (typeof SPACES !== 'undefined' ? SPACES : []).find(s => s.name === spaceName);
    return space ? space.color : 'var(--accent)';
  };

  const requireLogin = () => {
    if (typeof db === 'undefined' || !db.getCurrentUser()) {
      showToast('Please sign up or log in first.', 'error');
      if (window.authSystem) window.authSystem.openAuthModal('signup');
      return false;
    }
    const user = db.getCurrentUser();
    if (user && (user.isGuest || user.id === 'guest')) {
      showToast('Guests cannot post or comment. Please sign up or log in.', 'error');
      if (window.authSystem) window.authSystem.openAuthModal('signup');
      return false;
    }
    return true;
  };

  /* ---------------------------------------------------------------------
     2b. THEME
     --------------------------------------------------------------------- */
  const resolveTheme = (theme) => {
    if (theme === 'system') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    return theme;
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolveTheme(theme) === 'light' ? '#f5f6f8' : '#090b10');
  };

  const applyAccent = (accent) => {
    if (accent && accent !== 'amber') {
      document.documentElement.setAttribute('data-accent', accent);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
  };

  const applyCompactMode = (isCompact) => {
    document.body.classList.toggle('compact-mode', !!isCompact);
  };

  if (typeof db !== 'undefined') {
    const savedSettings = db.getSettings();
    applyTheme(savedSettings.theme);
    applyAccent(savedSettings.accent);
    applyCompactMode(savedSettings.compactMode);
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (typeof db !== 'undefined' && db.getSettings().theme === 'system') {
        applyTheme('system');
      }
    });
  }

  /* ---------------------------------------------------------------------
     3. SEED SAMPLE DATA (first run only)
     --------------------------------------------------------------------- */
  const seedInitialPosts = () => {
    if (typeof db === 'undefined' || typeof SAMPLE_POSTS === 'undefined') return;
    if (db.posts && db.posts.length > 0) return;

    db.posts = SAMPLE_POSTS.map((p, i) => ({
      id: Date.now() + i,
      authorId: null,
      author: p.author,
      handle: p.handle,
      avatar: p.author ? p.author[0].toUpperCase() : '?',
      title: p.title,
      body: p.body,
      space: p.space,
      images: [],
      votes: p.votes || 0,
      upvoters: [],
      downvoters: [],
      comments: [],
      saved: [],
      timestamp: new Date(Date.now() - (i + 1) * 3600000).toISOString()
    }));
    db.saveLocal();
  };
  seedInitialPosts();

  /* ---------------------------------------------------------------------
     4. SIDEBAR / RIGHT PANEL RENDERING
     --------------------------------------------------------------------- */
  const renderSpacesNav = () => {
    if (!spacesNavList || typeof SPACES === 'undefined') return;
    spacesNavList.innerHTML = SPACES.map(space => {
      const isJoined = state.joinedSpaces.has(space.name);
      const isActive = state.spaceFilter === space.name;
      return `
      <li>
        <a href="#" class="nav-link ${isActive ? 'active' : ''}" data-space="${escapeHtml(space.name)}" data-nav-item>
          <span class="space-dot" style="background:${space.color}"></span>
          <span>${escapeHtml(space.name)}</span>
          ${isJoined ? '<span style="font-size:10px; padding:2px 6px; background:rgba(86,214,189,0.2); color:var(--teal); border-radius:10px; margin-left:auto; font-weight:700;">Joined</span>' : `<span class="count">${(space.members / 1000).toFixed(1)}k</span>`}
        </a>
      </li>
    `;
    }).join('');

    spacesNavList.querySelectorAll('[data-space]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        state.spaceFilter = link.dataset.space;
        state.sort = 'trending';
        setActiveNav(null);
        link.classList.add('active');
        closeMobileSidebar();
        renderPosts();
      });
    });
  };

  const renderSuggestedSpaces = () => {
    if (!suggestedSpacesList || typeof SPACES === 'undefined') return;
    suggestedSpacesList.innerHTML = SPACES.map(space => {
      const isJoined = state.joinedSpaces.has(space.name);
      return `
      <div class="suggest-space" data-space-group="${escapeHtml(space.name)}" title="Click to view s/${escapeHtml(space.name)} group discussions">
        <span class="space-dot" style="background:${space.color}">${escapeHtml(space.name[0])}</span>
        <div class="suggest-space-name">
          ${escapeHtml(space.name)}
          <span class="suggest-space-members">${space.members.toLocaleString()} members</span>
        </div>
        <button class="join-btn ${isJoined ? 'joined' : ''}" data-join="${escapeHtml(space.name)}" type="button">${isJoined ? 'Joined' : 'Join'}</button>
      </div>
    `;
    }).join('');

    suggestedSpacesList.querySelectorAll('[data-space-group]').forEach(item => {
      item.addEventListener('click', (e) => {
        const joinBtn = e.target.closest('[data-join]');
        if (joinBtn) {
          e.stopPropagation();
          const name = joinBtn.dataset.join;
          if (state.joinedSpaces.has(name)) {
            state.joinedSpaces.delete(name);
            joinBtn.classList.remove('joined');
            joinBtn.textContent = 'Join';
            showToast(`Left s/${name}`, 'info');
          } else {
            state.joinedSpaces.add(name);
            joinBtn.classList.add('joined');
            joinBtn.textContent = 'Joined';
            showToast(`Joined s/${name}`);
          }
          renderSpacesNav();
          return;
        }

        // View Group / Community Feed
        const groupName = item.dataset.spaceGroup;
        state.spaceFilter = groupName;
        state.sort = 'trending';
        setActiveNav(null);
        renderSpacesNav();
        renderPosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  };

  const renderTrendingList = () => {
    if (!trendingList || typeof TRENDING_TOPICS === 'undefined') return;
    trendingList.innerHTML = TRENDING_TOPICS.map(t => `
      <div class="trend-item" data-topic="${escapeHtml(t.name)}">
        <span class="trend-rank">${t.rank}</span>
        <div>
          <div class="trend-name">${escapeHtml(t.name)}</div>
          <div class="trend-desc">${t.discussions.toLocaleString()} discussions</div>
          <div class="trend-stat">${escapeHtml(t.change)}</div>
        </div>
      </div>
    `).join('');

    trendingList.querySelectorAll('[data-topic]').forEach(item => {
      item.addEventListener('click', () => {
        if (searchInput) searchInput.value = item.dataset.topic;
        state.searchQuery = item.dataset.topic;
        renderPosts();
      });
    });
  };

  const renderCommunityRules = () => {
    const rulesList = document.getElementById('communityRulesList');
    const rulesTitle = document.getElementById('rulesHeaderTitle');
    const rulesSub = document.getElementById('rulesHeaderSub');
    if (!rulesList || typeof COMMUNITY_RULES === 'undefined') return;

    const currentSpace = state.spaceFilter;
    const rules = (currentSpace && COMMUNITY_RULES[currentSpace])
      ? COMMUNITY_RULES[currentSpace]
      : COMMUNITY_RULES.default;

    if (rulesTitle) {
      rulesTitle.textContent = currentSpace ? `s/${currentSpace} Rules` : 'Community Rules';
    }
    if (rulesSub) {
      rulesSub.textContent = currentSpace ? `Guidelines for s/${currentSpace}` : 'Aetherweave platform guidelines';
    }

    rulesList.innerHTML = rules.map(r => `
      <div class="rule-item" data-rule-num="${r.num}">
        <div class="rule-header">
          <span class="rule-num">r/${r.num}</span>
          <span>${escapeHtml(r.title)}</span>
          <svg class="rule-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="rule-desc">${escapeHtml(r.desc)}</div>
      </div>
    `).join('');

    rulesList.querySelectorAll('.rule-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    });
  };

  const renderPulse = () => {
    if (typeof db === 'undefined') return;
    const activeCount = db.posts.length;
    const countries = Math.min(140, 12 + activeCount * 4);
    const pct = Math.min(100, Math.round((activeCount / 20) * 100));

    if (pulseActive) pulseActive.textContent = activeCount.toLocaleString();
    if (pulseCountries) pulseCountries.textContent = countries.toLocaleString();
    if (pulseBarFill) pulseBarFill.style.width = pct + '%';
    if (pulseBarPct) pulseBarPct.textContent = pct + '%';
  };

  const renderComposerSpaceOptions = () => {
    if (!composerSpaceSelect || typeof SPACES === 'undefined') return;
    composerSpaceSelect.innerHTML = SPACES.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
  };

  /* ---------------------------------------------------------------------
     5. NAV ACTIVE STATE
     --------------------------------------------------------------------- */
  const setActiveNav = (sort) => {
    document.querySelectorAll('.nav-link[data-sort], .nav-link[data-space]').forEach(l => l.classList.remove('active'));
    feedTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.sort === sort);
      t.setAttribute('aria-selected', t.dataset.sort === sort ? 'true' : 'false');
    });
    if (sort) {
      sidebarSortLinks.forEach(l => {
        if (l.dataset.sort === sort) l.classList.add('active');
      });
    }
  };

  /* ---------------------------------------------------------------------
     6. POSTS: FILTERING + RENDERING
     --------------------------------------------------------------------- */
  const getFilteredPosts = () => {
    if (typeof db === 'undefined') return [];

    let posts;
    if (state.sort === 'saved') {
      posts = db.getSavedPosts();
    } else if (state.sort === 'following') {
      const following = db.getFollowing().map(u => u.id);
      posts = db.getPosts('new').filter(p => following.includes(p.authorId));
    } else {
      posts = db.getPosts(state.sort);
    }

    if (state.spaceFilter) {
      posts = posts.filter(p => p.space === state.spaceFilter);
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.space.toLowerCase().includes(q) ||
        (p.author && p.author.toLowerCase().includes(q))
      );
    }

    return posts;
  };

  const createPostCardHTML = (post) => {
    const currentUser = typeof db !== 'undefined' ? db.getCurrentUser() : null;
    const isUp = currentUser && post.upvoters && post.upvoters.includes(currentUser.id);
    const isDown = currentUser && post.downvoters && post.downvoters.includes(currentUser.id);
    const isSaved = currentUser && post.saved && post.saved.includes(currentUser.id);
    const commentCount = post.comments ? post.comments.length : 0;
    const flair = post.flair || 'Discussion';

    return `
      <article class="post-card glass" data-post-id="${post.id}">
        <div class="vote-rail">
          <button class="vote-btn up ${isUp ? 'active' : ''}" data-vote="up" aria-label="Upvote">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <span class="vote-count ${isUp ? 'up-active' : ''} ${isDown ? 'down-active' : ''}">${post.votes}</span>
          <button class="vote-btn down ${isDown ? 'active' : ''}" data-vote="down" aria-label="Downvote">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </button>
        </div>
        <div class="post-main">
          <div class="post-meta">
            <span class="space-tag" style="background:${spaceColor(post.space)}22;color:${spaceColor(post.space)}; cursor:pointer;" data-space-click="${escapeHtml(post.space)}">
              <span class="space-dot" style="background:${spaceColor(post.space)}"></span>s/${escapeHtml(post.space)}
            </span>
            <span class="flair-badge">${escapeHtml(flair)}</span>
            <span class="dot">·</span>
            <button type="button" class="author-link" data-author-id="${post.authorId != null ? post.authorId : ''}" data-author-name="${escapeHtml(post.author)}">${escapeHtml(post.author)}</button>
            <span class="dot">·</span>
            <span class="time mono">${timeAgo(post.timestamp)}</span>
          </div>
          <h3 class="post-title">${escapeHtml(post.title)}</h3>
          <div class="post-body">${escapeHtml(post.body)}</div>
          ${post.images && post.images.length ? `<div class="post-media"><img src="${post.images[0]}" alt="" /></div>` : ''}
          <div class="post-footer">
            <button class="post-action" data-action="comment">
              ${Icons.comment()}
              <span>${commentCount} Comments</span>
            </button>
            <button class="post-action ${isSaved ? 'saved' : ''}" data-action="save">
              ${Icons.bookmark(isSaved)}
              <span>${isSaved ? 'Saved' : 'Save'}</span>
            </button>
            <button class="post-action" data-action="share">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span>Share</span>
            </button>
            <button class="post-action" data-action="report" title="Report post for moderation">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              <span>Report</span>
            </button>
            <span class="spacer"></span>
          </div>
        </div>
      </article>
    `;
  };

  const showReportModal = (post) => {
    let overlay = document.getElementById('reportOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'reportOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    overlay.innerHTML = `
      <div style="background:var(--bg-elevated-2);border:1px solid var(--glass-border-strong);border-radius:var(--r-lg);width:100%;max-width:440px;padding:24px;box-shadow:0 12px 32px rgba(0,0,0,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span style="color:#f0665f;">🚩</span> Report Content
          </h3>
          <button type="button" id="closeReportModalBtn" style="background:none;border:none;color:var(--text-tertiary);font-size:18px;cursor:pointer;">✕</button>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px;">
          Why are you reporting "${escapeHtml(post.title.substring(0, 45))}${post.title.length > 45 ? '...' : ''}"?
        </p>

        <form id="reportModalForm" style="display:flex;flex-direction:column;gap:10px;">
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 10px;background:var(--glass-fill);border-radius:var(--r-md);border:1px solid var(--glass-border);">
            <input type="radio" name="reportReason" value="Spam or Unsolicited Marketing" checked>
            <span>Spam or Unsolicited Promotion</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 10px;background:var(--glass-fill);border-radius:var(--r-md);border:1px solid var(--glass-border);">
            <input type="radio" name="reportReason" value="Harassment or Hate Speech">
            <span>Harassment, Bullying, or Hate Speech</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 10px;background:var(--glass-fill);border-radius:var(--r-md);border:1px solid var(--glass-border);">
            <input type="radio" name="reportReason" value="Misinformation or Fake News">
            <span>Misinformation or Fake News</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 10px;background:var(--glass-fill);border-radius:var(--r-md);border:1px solid var(--glass-border);">
            <input type="radio" name="reportReason" value="Violates Space Rules">
            <span>Violates Community Rules for s/${escapeHtml(post.space)}</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-primary);cursor:pointer;padding:8px 10px;background:var(--glass-fill);border-radius:var(--r-md);border:1px solid var(--glass-border);">
            <input type="radio" name="reportReason" value="Copyright or IP Theft">
            <span>Copyright or Intellectual Property Violation</span>
          </label>

          <textarea id="reportDetailsInput" placeholder="Additional details (optional)..." style="width:100%;height:64px;margin-top:4px;padding:10px;border-radius:var(--r-md);background:var(--bg-elevated);border:1px solid var(--glass-border-strong);color:var(--text-primary);font-size:13px;resize:none;"></textarea>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px;">
            <button type="button" id="cancelReportBtn" class="btn btn-ghost">Cancel</button>
            <button type="submit" class="btn btn-primary" style="background:#f0665f;border-color:#f0665f;color:#fff;">Submit Report</button>
          </div>
        </form>
      </div>
    `;

    const closeBtn = overlay.querySelector('#closeReportModalBtn');
    const cancelBtn = overlay.querySelector('#cancelReportBtn');
    const form = overlay.querySelector('#reportModalForm');

    const closeModal = () => { overlay.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const reasonEl = form.querySelector('input[name="reportReason"]:checked');
      const reason = reasonEl ? reasonEl.value : 'General Report';
      const details = form.querySelector('#reportDetailsInput').value.trim();

      try {
        db.reportPost(post.id, reason, details);
        closeModal();
        showToast('Report submitted. Thank you for keeping Aetherweave safe!');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  };

  const showShareModal = (post) => {
    const postUrl = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    let overlay = document.getElementById('shareOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shareOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';

    overlay.innerHTML = `
      <div style="background:var(--bg-elevated-2);border:1px solid var(--glass-border-strong);border-radius:var(--r-lg);width:100%;max-width:440px;padding:24px;box-shadow:0 12px 32px rgba(0,0,0,0.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--accent)" fill="none" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share Post
          </h3>
          <button type="button" id="closeShareModalBtn" style="background:none;border:none;color:var(--text-tertiary);font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div style="background:var(--glass-fill);padding:12px;border-radius:var(--r-md);border:1px solid var(--glass-border);margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:4px;">s/${escapeHtml(post.space)}</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${escapeHtml(post.title)}</div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" readonly value="${escapeHtml(postUrl)}" id="shareUrlInput" style="flex:1;background:var(--bg-elevated);border:1px solid var(--glass-border-strong);border-radius:var(--r-md);padding:8px 12px;font-size:12px;color:var(--text-secondary);font-family:var(--font-mono);" />
          <button type="button" id="copyShareUrlBtn" class="btn btn-primary btn-sm">Copy Link</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${navigator.share ? `<button type="button" id="nativeShareBtn" class="btn btn-ghost" style="justify-content:center;border:1px solid var(--glass-border-strong);">📲 Device Share</button>` : ''}
          <button type="button" id="crosspostBtn" class="btn btn-ghost" style="justify-content:center;border:1px solid var(--glass-border-strong);">🔁 Crosspost</button>
        </div>
      </div>
    `;

    const closeBtn = overlay.querySelector('#closeShareModalBtn');
    const copyBtn = overlay.querySelector('#copyShareUrlBtn');
    const shareInput = overlay.querySelector('#shareUrlInput');
    const nativeBtn = overlay.querySelector('#nativeShareBtn');
    const crosspostBtn = overlay.querySelector('#crosspostBtn');

    const closeModal = () => { overlay.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    copyBtn.addEventListener('click', () => {
      shareInput.select();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(postUrl);
      } else {
        document.execCommand('copy');
      }
      showToast('Post link copied to clipboard!');
      closeModal();
    });

    if (nativeBtn) {
      nativeBtn.addEventListener('click', () => {
        navigator.share({
          title: post.title,
          text: `${post.title} on Aetherweave s/${post.space}`,
          url: postUrl
        }).catch(() => {});
        closeModal();
      });
    }

    if (crosspostBtn) {
      crosspostBtn.addEventListener('click', () => {
        if (composerTitle) composerTitle.value = `[Crosspost] ${post.title}`;
        if (composerBody) composerBody.innerHTML = `Crossposted from s/${post.space} by ${post.author}:<br><br>${escapeHtml(post.body)}`;
        closeModal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (composerTitle) composerTitle.focus();
      });
    }
  };

  const renderPosts = () => {
    if (!postsContainer) return;
    const posts = getFilteredPosts();

    let bannerHtml = '';
    if (state.spaceFilter) {
      const spaceObj = typeof SPACES !== 'undefined' ? SPACES.find(s => s.name === state.spaceFilter) : null;
      const isJoined = spaceObj ? state.joinedSpaces.has(spaceObj.name) : false;
      bannerHtml = `
        <div class="community-banner glass" style="margin-bottom: 20px; padding: 20px; border-radius: var(--r-lg); border: 1px solid var(--glass-border-strong); background: linear-gradient(135deg, ${spaceObj ? spaceObj.color + '22' : 'rgba(233,169,77,0.15)'} 0%, var(--bg-elevated) 100%);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 16px;">
              <div style="width: 52px; height: 52px; border-radius: 14px; background: ${spaceObj ? spaceObj.color : 'var(--accent)'}; color: #000; font-weight: 800; font-size: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.3); font-family: var(--font-display);">
                ${state.spaceFilter[0].toUpperCase()}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: var(--text-primary); font-family: var(--font-display);">s/${escapeHtml(state.spaceFilter)}</h1>
                  <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.12); color: var(--text-secondary);">Community Group</span>
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                  ${spaceObj ? spaceObj.description : 'Group discussion channel'}
                </div>
                <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px; font-weight: 600;">
                  👥 ${spaceObj ? spaceObj.members.toLocaleString() : '1,200+'} members • ${posts.length} discussions
                </div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" id="groupCreatePostBtn" style="font-weight: 700;">
                ✏️ Post in s/${escapeHtml(state.spaceFilter)}
              </button>
              <button class="btn ${isJoined ? 'btn-ghost' : 'btn-primary'} btn-sm" id="groupJoinToggleBtn" style="border-radius: var(--r-full); border: 1px solid var(--glass-border-strong);">
                ${isJoined ? '✓ Joined' : '➕ Join Group'}
              </button>
              <button class="btn btn-ghost btn-sm" id="clearSpaceFilterBtn" style="color: var(--text-tertiary);" title="View all discussions">
                ✕ Exit Group
              </button>
            </div>
          </div>
        </div>
      `;
    }

    postsContainer.innerHTML = bannerHtml + posts.map(createPostCardHTML).join('');

    if (emptyState) emptyState.classList.toggle('visible', posts.length === 0);

    // Bind Group Banner event handlers
    const groupCreatePostBtn = postsContainer.querySelector('#groupCreatePostBtn');
    if (groupCreatePostBtn) {
      groupCreatePostBtn.addEventListener('click', () => {
        if (composerSpaceSelect) composerSpaceSelect.value = state.spaceFilter;
        if (composerTitle) composerTitle.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const groupJoinToggleBtn = postsContainer.querySelector('#groupJoinToggleBtn');
    if (groupJoinToggleBtn) {
      groupJoinToggleBtn.addEventListener('click', () => {
        const name = state.spaceFilter;
        if (state.joinedSpaces.has(name)) {
          state.joinedSpaces.delete(name);
          showToast(`Left s/${name}`, 'info');
        } else {
          state.joinedSpaces.add(name);
          showToast(`Joined s/${name}`);
        }
        renderSpacesNav();
        renderSuggestedSpaces();
        renderPosts();
      });
    }

    const clearSpaceFilterBtn = postsContainer.querySelector('#clearSpaceFilterBtn');
    if (clearSpaceFilterBtn) {
      clearSpaceFilterBtn.addEventListener('click', () => {
        state.spaceFilter = null;
        renderSpacesNav();
        renderPosts();
      });
    }

    renderCommunityRules();
    renderPulse();
  };

  /* ---------------------------------------------------------------------
     7. POST CARD INTERACTIONS (global event delegation)
     --------------------------------------------------------------------- */
  const handlePostCardInteraction = (e) => {
    const card = e.target.closest('.post-card');
    if (!card) return;
    const postId = Number(card.dataset.postId);
    if (!postId) return;

    const voteBtn = e.target.closest('[data-vote]');
    if (voteBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (!requireLogin()) return;
      const voteType = voteBtn.dataset.vote;
      try {
        db.voteOnPost(postId, voteType);
        renderPosts();
        if (profileView && profileView.style.display !== 'none') {
          const followBtn = profileView.querySelector('#profileFollowBtn');
          const userId = followBtn ? Number(followBtn.dataset.userId) : null;
          if (userId) renderUserProfile(userId);
        }
        const freshCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
        if (freshCard) {
          const freshBtn = freshCard.querySelector(`.vote-btn[data-vote="${voteType}"]`);
          const freshCount = freshCard.querySelector('.vote-count');
          if (freshBtn) {
            freshBtn.classList.add('vote-pulse');
            setTimeout(() => freshBtn.classList.remove('vote-pulse'), 380);
          }
          if (freshCount) {
            freshCount.classList.add('pop');
            setTimeout(() => freshCount.classList.remove('pop'), 280);
          }
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      if (action === 'save') {
        if (!requireLogin()) return;
        try {
          db.savePost(postId);
          renderPosts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      } else if (action === 'comment') {
        const post = db.posts.find(p => p.id === postId);
        if (post) showCommentsModal(post);
      } else if (action === 'share') {
        const post = db.posts.find(p => p.id === postId);
        if (post) showShareModal(post);
      } else if (action === 'report') {
        const post = db.posts.find(p => p.id === postId);
        if (post) showReportModal(post);
      }
      return;
    }

    const spaceTag = e.target.closest('.space-tag, [data-space-click]');
    if (spaceTag) {
      e.preventDefault();
      e.stopPropagation();
      const spaceName = spaceTag.dataset.spaceClick || (db.posts.find(p => p.id === postId) || {}).space;
      if (spaceName) {
        state.spaceFilter = spaceName;
        setActiveNav(null);
        renderSpacesNav();
        renderPosts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    const authorLink = e.target.closest('.author-link');
    if (authorLink) {
      e.preventDefault();
      e.stopPropagation();
      const authorId = authorLink.dataset.authorId ? Number(authorLink.dataset.authorId) : null;
      openUserProfile(authorId, authorLink.dataset.authorName);
      return;
    }

    const postTitle = e.target.closest('.post-title');
    const postBody = e.target.closest('.post-body');
    const postMedia = e.target.closest('.post-media');
    if (postTitle || postBody || postMedia) {
      e.preventDefault();
      e.stopPropagation();
      const post = db.posts.find(p => p.id === postId);
      if (post) showCommentsModal(post);
      return;
    }
  };

  document.addEventListener('click', handlePostCardInteraction);

  const showCommentsModal = (post) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px;';

    const currentUser = typeof db !== 'undefined' ? db.getCurrentUser() : null;
    const isRealUser = currentUser && !currentUser.isGuest && currentUser.id !== 'guest';
    const placeholderText = isRealUser
      ? 'Add a comment…'
      : (currentUser && (currentUser.isGuest || currentUser.id === 'guest') ? 'Sign up or log in to comment…' : 'Log in to comment');

    const commentsHtml = (post.comments || []).map(c => {
      const isOP = (c.authorId && c.authorId === post.authorId) || (c.author && c.author === post.author);
      return `
      <div style="padding:10px 0;border-bottom:1px solid var(--glass-border);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-weight:700;font-size:13px;color:var(--text-primary);">${escapeHtml(c.author)}</span>
          ${isOP ? '<span style="background:var(--accent); color:#000; font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px;">OP</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(c.text)}</div>
      </div>
    `;
    }).join('') || '<div style="color:var(--text-tertiary);font-size:13px;padding:10px 0;">No comments yet. Be the first.</div>';

    overlay.innerHTML = `
      <div style="background:var(--bg-elevated-2);border:1px solid var(--glass-border-strong);border-radius:var(--r-lg);width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;padding:20px;">
        <h2 style="color:var(--text-primary);font-size:16px;margin-bottom:12px;">${escapeHtml(post.title)}</h2>
        <div id="commentsListInner" style="overflow-y:auto;flex:1;margin-bottom:12px;">${commentsHtml}</div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="newCommentInput" placeholder="${placeholderText}" style="flex:1;padding:10px 12px;border-radius:var(--r-md);background:var(--glass-fill);border:1px solid var(--glass-border);color:var(--text-primary);font-size:13px;">
          <button class="btn btn-primary" id="submitCommentBtn">Send</button>
        </div>
        <button class="btn btn-ghost" id="closeCommentsBtn" style="margin-top:12px;">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#closeCommentsBtn').addEventListener('click', () => overlay.remove());

    const submitComment = () => {
      if (!requireLogin()) return;
      const input = overlay.querySelector('#newCommentInput');
      const text = input.value.trim();
      if (!text) return;
      try {
        db.addComment(post.id, text);
        overlay.remove();
        renderPosts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    const commentInput = overlay.querySelector('#newCommentInput');
    if (commentInput) {
      commentInput.addEventListener('focus', () => {
        if (!isRealUser) {
          requireLogin();
        }
      });
      commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitComment();
      });
    }

    overlay.querySelector('#submitCommentBtn').addEventListener('click', submitComment);
  };

  /* ---------------------------------------------------------------------
     7b. USER PROFILE VIEW
     --------------------------------------------------------------------- */
  const feedSurfaces = [composer, document.getElementById('feedTabsBar'), postsContainer, emptyState];

  const openUserProfile = (userId, fallbackName) => {
    if (typeof db === 'undefined' || !profileView) return;

    feedSurfaces.forEach(el => { if (el) el.style.display = 'none'; });
    profileView.style.display = 'flex';
    renderUserProfile(userId, fallbackName);
    profileView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeUserProfile = () => {
    if (!profileView) return;
    profileView.style.display = 'none';
    profileView.innerHTML = '';
    // Restore every surface openUserProfile hid — previously this only restored
    // the composer and tabs, leaving postsContainer (and emptyState) stuck at
    // display:none, so the whole feed looked "gone" after backing out of a profile.
    feedSurfaces.forEach(el => { if (el) el.style.display = ''; });
    renderPosts();
  };

  const renderUserProfile = (userId, fallbackName) => {
    const currentUser = db.getCurrentUser();
    const user = userId != null ? db.getUserById(userId) : null;

    const displayName = user ? user.username : (fallbackName || 'Unknown user');
    const handle = '@' + displayName;
    const bio = user ? user.bio : '';
    const posts = user ? db.getUserPosts(user.id) : db.getPostsByAuthorName(displayName);
    const followerCount = user ? user.followers.length : 0;
    const followingCount = user ? user.following.length : 0;
    const isOwnProfile = !!(currentUser && user && currentUser.id === user.id);
    const isFollowing = !!(currentUser && user && !isOwnProfile && db.isFollowing(user.id));
    const joined = user ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : null;

    let actionHtml = '';
    if (!user) {
      actionHtml = `<span class="profile-section-label" style="margin:0;">Demo author · no account</span>`;
    } else if (isOwnProfile) {
      actionHtml = `<span class="pill" style="background:rgba(var(--teal-rgb),0.15);color:var(--teal);">This is you</span>`;
    } else {
      actionHtml = `
        <button class="follow-btn ${isFollowing ? 'following' : ''}" id="profileFollowBtn" data-user-id="${user.id}">
          ${isFollowing ? Icons.userCheck() : Icons.userPlus()}
          <span>${isFollowing ? 'Following' : 'Follow'}</span>
        </button>
      `;
    }

    const postsHtml = posts.length
      ? posts.map(createPostCardHTML).join('')
      : `<div class="profile-empty glass">${escapeHtml(displayName)} hasn't posted anything yet.</div>`;

    profileView.innerHTML = `
      <button class="btn btn-ghost profile-back-btn" id="profileBackBtn">
        ${Icons.arrowLeft()}
        <span>Back to feed</span>
      </button>
      <div class="profile-header glass">
        <div class="profile-avatar-xl">${escapeHtml(displayName[0] ? displayName[0].toUpperCase() : '?')}</div>
        <div class="profile-info">
          <div class="profile-name">${escapeHtml(displayName)}</div>
          <div class="profile-handle">${escapeHtml(handle)}</div>
          ${bio ? `<p class="profile-bio">${escapeHtml(bio)}</p>` : ''}
          <div class="profile-stats">
            <div class="profile-stat"><span class="num">${posts.length}</span><span class="lbl">Posts</span></div>
            ${user ? `<div class="profile-stat"><span class="num">${followerCount}</span><span class="lbl">Followers</span></div>` : ''}
            ${user ? `<div class="profile-stat"><span class="num">${followingCount}</span><span class="lbl">Following</span></div>` : ''}
            ${joined ? `<div class="profile-stat"><span class="num mono">${escapeHtml(joined)}</span><span class="lbl">Joined</span></div>` : ''}
          </div>
        </div>
        <div class="profile-actions">${actionHtml}</div>
      </div>
      <div class="profile-section-label">Posts by ${escapeHtml(displayName)}</div>
      <div class="posts-list">${postsHtml}</div>
    `;

    const backBtn = profileView.querySelector('#profileBackBtn');
    if (backBtn) backBtn.addEventListener('click', closeUserProfile);

    const followBtn = profileView.querySelector('#profileFollowBtn');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        if (!requireLogin()) return;
        try {
          if (db.isFollowing(user.id)) {
            db.unfollowUser(user.id);
            showToast(`Unfollowed ${displayName}`);
          } else {
            db.followUser(user.id);
            showToast(`Following ${displayName}`);
          }
          renderUserProfile(userId, fallbackName);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Post cards rendered inside the profile view reuse the same vote/save/comment/author
    // interactions — wire them the same way the main feed does.
    const profilePostsList = profileView.querySelector('.posts-list');
    if (profilePostsList) {
      profilePostsList.addEventListener('click', (e) => {
        const card = e.target.closest('.post-card');
        if (!card) return;
        const postId = Number(card.dataset.postId);

        const voteBtn = e.target.closest('[data-vote]');
        if (voteBtn) {
          if (!requireLogin()) return;
          try {
            db.voteOnPost(postId, voteBtn.dataset.vote);
            renderUserProfile(userId, fallbackName);
          } catch (err) {
            showToast(err.message, 'error');
          }
          return;
        }

        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
          const action = actionBtn.dataset.action;
          if (action === 'save') {
            if (!requireLogin()) return;
            try {
              db.savePost(postId);
              renderUserProfile(userId, fallbackName);
            } catch (err) {
              showToast(err.message, 'error');
            }
          } else if (action === 'comment') {
            const post = db.posts.find(p => p.id === postId);
            if (post) showCommentsModal(post);
          }
        }
      });
    }
  };

  // Exposed so auth.js's "Your profile" link can open the same rich view.
  window.viewUserProfile = openUserProfile;

  /* ---------------------------------------------------------------------
     8. FEED TABS + SIDEBAR SORT LINKS
     --------------------------------------------------------------------- */
  const handleSortClick = (sort) => {
    state.sort = sort;
    state.spaceFilter = null;
    setActiveNav(sort);
    closeMobileSidebar();
    renderPosts();
  };

  feedTabs.forEach(tab => {
    tab.addEventListener('click', () => handleSortClick(tab.dataset.sort));
  });
  sidebarSortLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      handleSortClick(link.dataset.sort);
    });
  });

  if (exploreLink) {
    exploreLink.addEventListener('click', (e) => {
      e.preventDefault();
      state.spaceFilter = null;
      state.searchQuery = '';
      if (searchInput) searchInput.value = '';
      handleSortClick('trending');
      showToast('Showing everything happening on Aetherweave');
    });
  }

  if (savedPostsBtn) {
    savedPostsBtn.addEventListener('click', () => {
      if (!requireLogin()) return;
      state.sort = 'saved';
      state.spaceFilter = null;
      setActiveNav(null);
      renderPosts();
      if (profileDropdown) profileDropdown.classList.remove('open');
    });
  }

  /* ---------------------------------------------------------------------
     9. SEARCH
     --------------------------------------------------------------------- */
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.searchQuery = searchInput ? searchInput.value : '';
      renderPosts();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.searchQuery = searchInput.value;
      renderPosts();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  /* ---------------------------------------------------------------------
     10. SIDEBAR COLLAPSE / MOBILE MENU
     --------------------------------------------------------------------- */
  if (sidebarCollapseBtn && appShell) {
    sidebarCollapseBtn.addEventListener('click', () => {
      const collapsed = appShell.classList.toggle('sidebar-collapsed');
      sidebarCollapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  }

  const openMobileSidebar = () => {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (mobileOverlay) mobileOverlay.classList.add('visible');
  };

  const closeMobileSidebar = () => {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (mobileOverlay) mobileOverlay.classList.remove('visible');
  };

  const toggleMobileSidebar = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!sidebar) return;
    const isNowOpen = sidebar.classList.contains('mobile-open');
    if (isNowOpen) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  };

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
  }
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileSidebar);
  }

  // Handle brand links to return home cleanly
  document.querySelectorAll('a.brand').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      state.spaceFilter = null;
      renderPosts();
      closeMobileSidebar();
    });
  });

  /* ---------------------------------------------------------------------
     11. PROFILE DROPDOWN & TOP-NAV INTERACTIONS
     --------------------------------------------------------------------- */
  if (profileTrigger && profileDropdown) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown.classList.toggle('open');
      profileTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Global document click delegate for top-nav, dropdowns, and mobile drawers
  document.addEventListener('click', (e) => {
    // Close profile dropdown when clicking outside
    if (profileDropdown && profileTrigger) {
      if (!profileDropdown.contains(e.target) && !profileTrigger.contains(e.target)) {
        profileDropdown.classList.remove('open');
        profileTrigger.setAttribute('aria-expanded', 'false');
      }
    }

    // Auto-dismiss profile dropdown on clicking any dropdown item
    const dropdownItem = e.target.closest('.dropdown-item');
    if (dropdownItem && profileDropdown) {
      profileDropdown.classList.remove('open');
      if (profileTrigger) profileTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  if (notifBtn) {
    notifBtn.addEventListener('click', () => showToast("You're all caught up — no new notifications."));
  }

  /* ---------------------------------------------------------------------
     12. COMPOSER
     --------------------------------------------------------------------- */
  const updateComposerState = () => {
    const titleLen = composerTitle ? composerTitle.value.trim().length : 0;
    const bodyLen = composerBody ? composerBody.textContent.trim().length : 0;
    if (charCount) charCount.textContent = `${titleLen}/140`;
    if (composerPostBtn) composerPostBtn.disabled = !(titleLen > 0 && bodyLen > 0);
  };

  if (composerTitle) {
    composerTitle.addEventListener('focus', () => composer.classList.add('is-expanded'));
    composerTitle.addEventListener('input', updateComposerState);
  }
  if (composerBody) {
    composerBody.addEventListener('focus', () => composer.classList.add('is-expanded'));
    composerBody.addEventListener('input', updateComposerState);
  }

  if (composerToolbar) {
    composerToolbar.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        composerBody.focus();
        if (cmd === 'createLink') {
          const url = prompt('Enter a URL:');
          if (url) document.execCommand('createLink', false, url);
        } else if (cmd === 'blockquote') {
          document.execCommand('formatBlock', false, 'blockquote');
        } else {
          document.execCommand(cmd, false, null);
        }
        btn.classList.toggle('active');
        updateComposerState();
      });
    });
  }

  const resetComposer = () => {
    if (composerTitle) composerTitle.value = '';
    if (composerBody) composerBody.innerHTML = '';
    pendingComposerImage = null;
    if (imagePreviewGrid) {
      imagePreviewGrid.innerHTML = '';
      imagePreviewGrid.classList.remove('has-image');
    }
    if (composer) composer.classList.remove('is-expanded');
    updateComposerState();
  };

  if (composerCancelBtn) {
    composerCancelBtn.addEventListener('click', resetComposer);
  }

  // Image upload
  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingComposerImage = reader.result;
      if (imagePreviewGrid) {
        imagePreviewGrid.innerHTML = `
          <div class="image-preview">
            <img src="${reader.result}" alt="" />
            <button type="button" class="image-preview-remove" aria-label="Remove image">
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
        imagePreviewGrid.classList.add('has-image');
        imagePreviewGrid.querySelector('.image-preview-remove').addEventListener('click', () => {
          pendingComposerImage = null;
          imagePreviewGrid.innerHTML = '';
          imagePreviewGrid.classList.remove('has-image');
        });
      }
    };
    reader.readAsDataURL(file);
  };

  if (imageToolbarBtn && imageInput) {
    imageToolbarBtn.addEventListener('click', () => imageInput.click());
  }
  if (imageInput) {
    imageInput.addEventListener('change', () => {
      if (imageInput.files && imageInput.files[0]) handleImageFile(imageInput.files[0]);
    });
  }
  if (imageDropZone && imageInput) {
    imageDropZone.addEventListener('click', () => imageInput.click());
    imageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imageDropZone.classList.add('drag-over'); });
    imageDropZone.addEventListener('dragleave', () => imageDropZone.classList.remove('drag-over'));
    imageDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      imageDropZone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
    });
  }

  if (composer) {
    composer.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!requireLogin()) return;

      const title = composerTitle ? composerTitle.value.trim() : '';
      const body = composerBody ? composerBody.innerHTML.trim() : '';
      const bodyText = composerBody ? composerBody.textContent.trim() : '';
      const space = composerSpaceSelect ? composerSpaceSelect.value : 'General';
      const composerFlairSelect = document.getElementById('composerFlairSelect');
      const flair = composerFlairSelect ? composerFlairSelect.value : 'Discussion';

      if (!title || !bodyText) {
        showToast('Add a title and some content first.', 'error');
        return;
      }

      try {
        db.createPost(title, body, space, pendingComposerImage ? [pendingComposerImage] : [], flair);
        resetComposer();
        state.sort = 'new';
        state.spaceFilter = space;
        setActiveNav('new');
        renderSpacesNav();
        renderPosts();
        showToast(`Posted in s/${space}!`);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  /* ---------------------------------------------------------------------
     13. AI HELPER DRAWER (Aetherweave Computer Servicing AI)
     --------------------------------------------------------------------- */
  const formatMarkdown = (text) => {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: var(--bg-page); padding: 10px; border-radius: 8px; overflow-x: auto; font-family: monospace; border: 1px solid var(--glass-border); margin: 8px 0;"><code>$1</code></pre>');
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px; font-size: 14px; font-weight: 700; color: var(--accent);">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 6px; font-size: 15px; font-weight: 700; color: var(--accent);">$1</h3>');
    html = html.replace(/^\* (.*$)/gim, '• $1');
    html = html.replace(/^- (.*$)/gim, '• $1');
    html = html.replace(/\n/g, '<br>');
    return html;
  };

  const agoraChat = {
    history: [],
    formatMessage: (str) => formatMarkdown(str),
    sendMessage: async (userText) => {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: agoraChat.history })
      });
      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const errText = await res.text();
        console.error('[AI Chat Error] Non-JSON server response:', errText);
        throw new Error('AI service is re-initializing. Please try sending your message again in a moment.');
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Aetherweave AI is currently busy. Please try again.');
      }
      agoraChat.history.push({ role: 'user', text: userText });
      agoraChat.history.push({ role: 'model', text: data.reply });
      return data.reply;
    },
    clearHistory: () => {
      agoraChat.history = [];
    }
  };
  window.agoraChat = agoraChat;

  const openDrawer = () => {
    if (aiDrawer) {
      aiDrawer.classList.add('open');
      aiDrawer.setAttribute('aria-hidden', 'false');
    }
    if (drawerOverlay) drawerOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    if (chatInput) chatInput.focus();
  };
  const closeDrawer = () => {
    if (aiDrawer) {
      aiDrawer.classList.remove('open');
      aiDrawer.setAttribute('aria-hidden', 'true');
    }
    if (drawerOverlay) drawerOverlay.classList.remove('visible');
    document.body.style.overflow = '';
  };

  const aiFloatingBtn = document.getElementById('aiFloatingBtn');
  if (aiHelperBtn) aiHelperBtn.addEventListener('click', openDrawer);
  if (aiFloatingBtn) aiFloatingBtn.addEventListener('click', openDrawer);
  if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

  const appendChatBubble = (text, fromUser, isError = false) => {
    if (!aiMessages) return;
    const msg = document.createElement('div');
    msg.className = 'ai-msg' + (fromUser ? ' from-user' : '');
    const avatarLetter = fromUser
      ? ((typeof db !== 'undefined' && db.getCurrentUser()) ? db.getCurrentUser().username[0].toUpperCase() : '?')
      : '';
    msg.innerHTML = `
      <span class="ai-msg-avatar">${fromUser ? avatarLetter : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3c.7 4.1 2.9 6.3 7 7-4.1.7-6.3 2.9-7 7-.7-4.1-2.9-6.3-7-7 4.1-.7 6.3-2.9 7-7z"/></svg>'}</span>
      <div class="ai-msg-bubble ${isError ? 'error' : ''}"></div>
    `;
    const bubble = msg.querySelector('.ai-msg-bubble');
    if (fromUser) {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = agoraChat.formatMessage(text);
    }
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return msg;
  };

  const appendTypingIndicator = () => {
    if (!aiMessages) return null;
    const msg = document.createElement('div');
    msg.className = 'ai-msg';
    msg.innerHTML = `
      <span class="ai-msg-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3c.7 4.1 2.9 6.3 7 7-4.1.7-6.3 2.9-7 7-.7-4.1-2.9-6.3-7-7 4.1-.7 6.3-2.9 7-7z"/></svg></span>
      <div class="ai-msg-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>
    `;
    aiMessages.appendChild(msg);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return msg;
  };

  const sendChatMessage = async (text) => {
    if (!text || !text.trim()) return;
    if (aiSuggestions) aiSuggestions.style.display = 'none';

    appendChatBubble(text, true);
    if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
    if (chatSendBtn) chatSendBtn.disabled = true;

    const typingMsg = appendTypingIndicator();

    try {
      const response = await agoraChat.sendMessage(text);
      if (typingMsg) typingMsg.remove();
      appendChatBubble(response, false);
    } catch (err) {
      if (typingMsg) typingMsg.remove();
      appendChatBubble(err.message || 'Something went wrong. Please try again.', false, true);
    }
  };

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', () => sendChatMessage(chatInput.value));
  }
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatSendBtn.disabled = chatInput.value.trim().length === 0;
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatInput.value.trim()) sendChatMessage(chatInput.value);
      }
    });
  }

  if (aiSuggestions) {
    aiSuggestions.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => sendChatMessage(chip.textContent));
    });
  }

  const resetChatView = () => {
    agoraChat.clearHistory();
    if (aiMessages) {
      aiMessages.innerHTML = `
        <div class="ai-msg">
          <span class="ai-msg-avatar"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3c.7 4.1 2.9 6.3 7 7-4.1.7-6.3 2.9-7 7-.7-4.1-2.9-6.3-7-7 4.1-.7 6.3-2.9 7-7z"/></svg></span>
          <div class="ai-msg-bubble">
            👋 Hello! I am <strong>Aetherweave AI</strong>, your intelligent assistant for <strong>Computer Servicing, Programming, General Knowledge, & Tech Support</strong>.<br><br>
            Ask me anything! Here are a few things I can help you with:
            <ul>
              <li><strong>PC Servicing & Troubleshooting:</strong> No power, no display, BSoD, thermal paste, component upgrades</li>
              <li><strong>IT & Software:</strong> Windows 10/11 formatting, Linux, driver updates, network setup</li>
              <li><strong>Programming & Tech:</strong> HTML, JS, Python, API integrations, debugging</li>
              <li><strong>General Knowledge & Creative:</strong> Explanations, math, writing, everyday advice</li>
            </ul>
          </div>
        </div>
      `;
    }
    if (aiSuggestions) aiSuggestions.style.display = 'flex';
    showToast('Chat history cleared');
  };

  const chatClearAllBtn = document.getElementById('chatClearAllBtn');
  if (chatClearAllBtn) chatClearAllBtn.addEventListener('click', resetChatView);
  if (chatResetBtn) chatResetBtn.addEventListener('click', resetChatView);

  /* ---------------------------------------------------------------------
     13b. SETTINGS MODAL
     --------------------------------------------------------------------- */
  const settingsModal = document.getElementById('settingsModal');
  const settingsCloseBtn = document.getElementById('settingsCloseBtn');
  const themeSegmented = document.getElementById('themeSegmented');
  const accentSwatches = document.getElementById('accentSwatches');
  const compactModeToggle = document.getElementById('compactModeToggle');
  const notificationsToggle = document.getElementById('notificationsToggle');
  const settingsUsernameInput = document.getElementById('settingsUsernameInput');
  const settingsUsernameSaveBtn = document.getElementById('settingsUsernameSaveBtn');
  const settingsAccountHint = document.getElementById('settingsAccountHint');
  const settingsResetBtn = document.getElementById('settingsResetBtn');

  const refreshSettingsUI = () => {
    if (typeof db === 'undefined') return;
    const s = db.getSettings();

    if (themeSegmented) {
      themeSegmented.querySelectorAll('[data-theme-choice]').forEach(btn => {
        const active = btn.dataset.themeChoice === s.theme;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    if (accentSwatches) {
      accentSwatches.querySelectorAll('[data-accent-choice]').forEach(btn => {
        const active = btn.dataset.accentChoice === (s.accent || 'amber');
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }

    if (compactModeToggle) compactModeToggle.setAttribute('aria-checked', s.compactMode ? 'true' : 'false');
    if (notificationsToggle) notificationsToggle.setAttribute('aria-checked', s.notifications ? 'true' : 'false');

    const currentUser = db.getCurrentUser();
    if (settingsUsernameInput) {
      settingsUsernameInput.value = currentUser ? currentUser.username : '';
      settingsUsernameInput.disabled = !currentUser;
    }
    if (settingsUsernameSaveBtn) settingsUsernameSaveBtn.disabled = !currentUser;
    if (settingsAccountHint) {
      settingsAccountHint.textContent = currentUser
        ? 'Changing your username updates it everywhere, including past posts and comments.'
        : 'Log in to edit your account.';
    }
  };

  const openSettingsModal = () => {
    if (!settingsModal) return;
    refreshSettingsUI();
    settingsModal.classList.add('active');
  };

  const closeSettingsModal = () => {
    if (!settingsModal) return;
    settingsModal.classList.remove('active');
  };

  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSettingsModal();
    });
  }
  if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', closeSettingsModal);
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal && settingsModal.classList.contains('active')) closeSettingsModal();
  });

  if (themeSegmented) {
    themeSegmented.querySelectorAll('[data-theme-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof db === 'undefined') return;
        const theme = btn.dataset.themeChoice;
        db.updateSettings({ theme });
        applyTheme(theme);
        refreshSettingsUI();
      });
    });
  }

  if (accentSwatches) {
    accentSwatches.querySelectorAll('[data-accent-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof db === 'undefined') return;
        const accent = btn.dataset.accentChoice;
        db.updateSettings({ accent });
        applyAccent(accent);
        refreshSettingsUI();
      });
    });
  }

  if (compactModeToggle) {
    compactModeToggle.addEventListener('click', () => {
      if (typeof db === 'undefined') return;
      const next = compactModeToggle.getAttribute('aria-checked') !== 'true';
      db.updateSettings({ compactMode: next });
      applyCompactMode(next);
      refreshSettingsUI();
    });
  }

  if (notificationsToggle) {
    notificationsToggle.addEventListener('click', () => {
      if (typeof db === 'undefined') return;
      const next = notificationsToggle.getAttribute('aria-checked') !== 'true';
      db.updateSettings({ notifications: next });
      const badgeDot = notifBtn ? notifBtn.querySelector('.badge-dot') : null;
      if (badgeDot) badgeDot.style.display = next ? '' : 'none';
      refreshSettingsUI();
      showToast(next ? 'Notifications enabled' : 'Notifications disabled');
    });
  }

  if (settingsUsernameSaveBtn) {
    settingsUsernameSaveBtn.addEventListener('click', () => {
      if (typeof db === 'undefined' || !settingsUsernameInput) return;
      try {
        db.updateUsername(settingsUsernameInput.value);
        if (window.authSystem) window.authSystem.updateAuthUI();
        renderPosts();
        showToast('Username updated');
        refreshSettingsUI();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (settingsResetBtn) {
    settingsResetBtn.addEventListener('click', () => {
      if (typeof db === 'undefined') return;
      const confirmed = window.confirm('This will permanently delete every account, post, and preference stored in this browser. Continue?');
      if (!confirmed) return;
      db.resetAll();
      showToast('All data reset — reloading…');
      setTimeout(() => window.location.reload(), 600);
    });
  }

  // Apply the saved notifications preference to the bell on load.
  if (typeof db !== 'undefined' && notifBtn) {
    const badgeDot = notifBtn.querySelector('.badge-dot');
    if (badgeDot && !db.getSettings().notifications) badgeDot.style.display = 'none';
  }

  /* ---------------------------------------------------------------------
     14. INITIAL RENDER & REALTIME LISTENERS
     --------------------------------------------------------------------- */
  renderSpacesNav();
  renderSuggestedSpaces();
  renderTrendingList();
  renderComposerSpaceOptions();
  setActiveNav('trending');
  renderPosts();
  updateComposerState();

  // Entry splash loader animation
  const splashScreen = document.getElementById('entrySplashScreen');
  const progressBar = splashScreen ? splashScreen.querySelector('.entry-splash-progress') : null;
  if (splashScreen && progressBar) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 12;
      if (progress >= 100) {
        progress = 100;
        progressBar.style.width = '100%';
        clearInterval(interval);
        setTimeout(() => {
          splashScreen.classList.add('fade-out');
          if (appShell) appShell.classList.add('loaded');
          setTimeout(() => {
            splashScreen.remove();
          }, 600);
        }, 300);
      } else {
        progressBar.style.width = progress + '%';
      }
    }, 60);
  } else if (appShell) {
    appShell.classList.add('loaded');
  }

  window.addEventListener('aetherweave:posts-updated', () => {
    renderPosts();
    renderPulse();
  });
});
