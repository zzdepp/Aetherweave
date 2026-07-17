/* =========================================================================*
   AETHERWEAVE — Database System (LocalStorage)
   Manages user accounts, posts, follows, and saved data
   ========================================================================= */

class AetherweaveDatabase {
  constructor() {
    this.users = JSON.parse(localStorage.getItem('agora_users')) || [];
    this.posts = JSON.parse(localStorage.getItem('agora_posts')) || [];
    this.follows = JSON.parse(localStorage.getItem('agora_follows')) || [];
    this.currentUser = JSON.parse(localStorage.getItem('agora_current_user')) || null;
  }

  // ===== USER MANAGEMENT =====
  registerUser(username, email, password) {
    if (this.users.find(u => u.email === email || u.username === username)) {
      throw new Error('User already exists');
    }

    const user = {
      id: Date.now(),
      username,
      email,
      password: this.hashPassword(password),
      avatar: username[0].toUpperCase(),
      bio: '',
      following: [],
      followers: [],
      savedPosts: [],
      createdAt: new Date().toISOString()
    };

    this.users.push(user);
    this.save();
    return user;
  }

  loginUser(email, password) {
    const user = this.users.find(u => u.email === email);
    if (!user || user.password !== this.hashPassword(password)) {
      throw new Error('Invalid email or password');
    }

    this.currentUser = { id: user.id, username: user.username, email: user.email, avatar: user.avatar };
    localStorage.setItem('agora_current_user', JSON.stringify(this.currentUser));
    return user;
  }

  logoutUser() {
    this.currentUser = null;
    localStorage.removeItem('agora_current_user');
  }

  getCurrentUser() {
    if (!this.currentUser) return null;
    return this.users.find(u => u.id === this.currentUser.id);
  }

  getUserById(userId) {
    return this.users.find(u => u.id === userId);
  }

  // ===== ACCOUNT SETTINGS =====
  updateUsername(newUsername) {
    if (!this.currentUser) throw new Error('Not logged in');
    newUsername = (newUsername || '').trim();

    if (!newUsername) throw new Error('Username cannot be empty');
    if (newUsername.length < 2) throw new Error('Username must be at least 2 characters');
    if (newUsername.length > 24) throw new Error('Username must be 24 characters or fewer');
    if (!/^[a-zA-Z0-9_.\s]+$/.test(newUsername)) throw new Error('Username can only contain letters, numbers, spaces, "_" and "."');

    const taken = this.users.find(
      u => u.id !== this.currentUser.id && u.username.toLowerCase() === newUsername.toLowerCase()
    );
    if (taken) throw new Error('That username is already taken');

    const user = this.getCurrentUser();
    const oldUsername = user.username;
    const newAvatar = newUsername[0].toUpperCase();

    user.username = newUsername;
    user.avatar = newAvatar;

    // Keep authored content in sync so old posts/comments show the new name
    this.posts.forEach(p => {
      if (p.authorId === user.id) {
        p.author = newUsername;
        p.avatar = newAvatar;
        p.handle = `@${newUsername}`;
      }
      (p.comments || []).forEach(c => {
        if (c.authorId === user.id) {
          c.author = newUsername;
          c.avatar = newAvatar;
        }
      });
    });

    this.currentUser = { ...this.currentUser, username: newUsername, avatar: newAvatar };
    localStorage.setItem('agora_current_user', JSON.stringify(this.currentUser));

    this.save();
    return user;
  }

  // ===== APP SETTINGS (theme, notifications, etc — stored per browser) =====
  getSettings() {
    const defaults = { theme: 'dark', accent: 'amber', notifications: true, compactMode: false };
    const stored = JSON.parse(localStorage.getItem('agora_settings')) || {};
    return { ...defaults, ...stored };
  }

  updateSettings(partial) {
    const updated = { ...this.getSettings(), ...partial };
    localStorage.setItem('agora_settings', JSON.stringify(updated));
    return updated;
  }

  // ===== POST MANAGEMENT =====
  createPost(title, body, space, images) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = {
      id: Date.now(),
      authorId: this.currentUser.id,
      author: this.currentUser.username,
      handle: `@${this.currentUser.username}`,
      avatar: this.currentUser.avatar,
      title,
      body,
      space,
      images,
      votes: 0,
      upvoters: [],
      downvoters: [],
      comments: [],
      saved: [],
      timestamp: new Date().toISOString()
    };

    this.posts.unshift(post);
    this.save();
    return post;
  }

  getPosts(sort = 'trending') {
    const posts = JSON.parse(JSON.stringify(this.posts)); // deep copy

    switch (sort) {
      case 'new':
        return posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      case 'top':
        return posts.sort((a, b) => b.votes - a.votes);
      case 'following': {
        const followingIds = this.getFollowing().map(u => u.id);
        return posts
          .filter(p => followingIds.includes(p.authorId))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }
      case 'trending':
      default:
        return posts.sort((a, b) => (b.votes + b.comments.length) - (a.votes + a.comments.length));
    }
  }

  // ===== VOTING SYSTEM =====
  voteOnPost(postId, voteType) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = this.posts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');

    const userId = this.currentUser.id;

    if (voteType === 'up') {
      post.downvoters = post.downvoters.filter(id => id !== userId);
      if (post.upvoters.includes(userId)) {
        post.upvoters = post.upvoters.filter(id => id !== userId);
        post.votes--;
      } else {
        post.upvoters.push(userId);
        post.votes++;
      }
    } else if (voteType === 'down') {
      post.upvoters = post.upvoters.filter(id => id !== userId);
      if (post.downvoters.includes(userId)) {
        post.downvoters = post.downvoters.filter(id => id !== userId);
        post.votes++;
      } else {
        post.downvoters.push(userId);
        post.votes--;
      }
    }

    this.save();
    return post;
  }

  // ===== COMMENTS =====
  addComment(postId, text) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = this.posts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');

    const comment = {
      id: Date.now(),
      authorId: this.currentUser.id,
      author: this.currentUser.username,
      avatar: this.currentUser.avatar,
      text,
      timestamp: new Date().toISOString()
    };

    post.comments.push(comment);
    this.save();
    return comment;
  }

  // ===== SAVE/BOOKMARK =====
  savePost(postId) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = this.posts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');

    const userId = this.currentUser.id;

    if (post.saved.includes(userId)) {
      post.saved = post.saved.filter(id => id !== userId);
    } else {
      post.saved.push(userId);
    }

    this.save();
    return post;
  }

  getSavedPosts() {
    if (!this.currentUser) return [];
    const userId = this.currentUser.id;
    return this.posts.filter(p => p.saved.includes(userId));
  }

  // ===== USER PROFILE: POSTS BY AUTHOR =====
  getUserPosts(userId) {
    return this.posts
      .filter(p => p.authorId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getPostsByAuthorName(authorName) {
    return this.posts
      .filter(p => p.author === authorName)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // ===== FOLLOW SYSTEM =====
  followUser(targetUserId) {
    if (!this.currentUser) throw new Error('Not logged in');

    const currentUser = this.getCurrentUser();
    const targetUser = this.getUserById(targetUserId);

    if (!targetUser) throw new Error('User not found');
    if (targetUserId === this.currentUser.id) throw new Error('Cannot follow yourself');

    if (!currentUser.following.includes(targetUserId)) {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(this.currentUser.id);
    }

    this.save();
  }

  unfollowUser(targetUserId) {
    if (!this.currentUser) throw new Error('Not logged in');

    const currentUser = this.getCurrentUser();
    const targetUser = this.getUserById(targetUserId);

    if (!targetUser) throw new Error('User not found');

    currentUser.following = currentUser.following.filter(id => id !== targetUserId);
    targetUser.followers = targetUser.followers.filter(id => id !== this.currentUser.id);

    this.save();
  }

  isFollowing(targetUserId) {
    if (!this.currentUser) return false;
    const currentUser = this.getCurrentUser();
    return currentUser.following.includes(targetUserId);
  }

  getFollowing() {
    if (!this.currentUser) return [];
    const currentUser = this.getCurrentUser();
    return currentUser.following.map(id => this.getUserById(id)).filter(u => u);
  }

  getFollowers() {
    if (!this.currentUser) return [];
    const currentUser = this.getCurrentUser();
    return currentUser.followers.map(id => this.getUserById(id)).filter(u => u);
  }

  // ===== PROFILE =====
  updateProfile(bio) {
    if (!this.currentUser) throw new Error('Not logged in');
    const user = this.getCurrentUser();
    user.bio = bio;
    this.save();
    return user;
  }

  // ===== UTILITY =====
  hashPassword(password) {
    // NOTE: base64 is NOT real hashing — it's trivially reversible.
    // Fine for a local demo; use a real hash (e.g. bcrypt) server-side
    // before this ever touches real user passwords.
    return btoa(password);
  }

  save() {
    localStorage.setItem('agora_users', JSON.stringify(this.users));
    localStorage.setItem('agora_posts', JSON.stringify(this.posts));
    localStorage.setItem('agora_follows', JSON.stringify(this.follows));
  }

  // Reset all data (for testing)
  resetAll() {
    this.users = [];
    this.posts = [];
    this.follows = [];
    this.currentUser = null;
    localStorage.clear();
  }
}

// Global database instance
const db = new AetherweaveDatabase();
