/* =========================================================================*
   AETHERWEAVE — Database System (Firebase Firestore + LocalStorage fallback)
   Manages user accounts, posts, follows, comments, and votes synced across
   devices using Firebase Firestore.
   ========================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  getDocFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { checkProfanity } from './moderation.js';

// Firebase Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyA-7MrQUJDDdV8YvxeEKCFcsBBs8X2k2Js",
  authDomain: "website-6ea2e.firebaseapp.com",
  projectId: "website-6ea2e",
  storageBucket: "website-6ea2e.firebasestorage.app",
  messagingSenderId: "525929363503",
  appId: "1:525929363503:web:a760e57f9d51d30b2aeeda",
  measurementId: "G-P269LJQC3S"
};

// Helper for safely stringifying objects containing circular references or Firestore objects
function safeJSONStringify(obj, indent) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);

      if (typeof value.toDate === 'function') {
        try {
          return value.toDate().toISOString();
        } catch (e) {
          return value.seconds ? new Date(value.seconds * 1000).toISOString() : String(value);
        }
      }

      if (typeof Element !== 'undefined' && value instanceof Element) {
        return undefined;
      }

      if (value instanceof Error) {
        return { message: value.message, name: value.name };
      }
    }
    return value;
  }, indent);
}

// Deeply sanitize doc data from Firestore to turn custom Firestore classes into plain objects/strings
function sanitizeDocData(data) {
  if (!data || typeof data !== 'object') return data;
  
  if (typeof data.toDate === 'function') {
    try {
      return data.toDate().toISOString();
    } catch (e) {
      return data.seconds ? new Date(data.seconds * 1000).toISOString() : String(data);
    }
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeDocData);
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'function') continue;
    if (typeof Element !== 'undefined' && value instanceof Element) continue;
    if (value && typeof value === 'object') {
      if (typeof value.toDate === 'function') {
        try {
          clean[key] = value.toDate().toISOString();
        } catch (e) {
          clean[key] = value.seconds ? new Date(value.seconds * 1000).toISOString() : String(value);
        }
      } else {
        clean[key] = sanitizeDocData(value);
      }
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const handleFirestoreError = (error, operationType, path) => {
  const errMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : (error?.message || String(error)));
  if (errMsg.includes('permissions') || errMsg.includes('permission-denied')) {
    console.warn(`[Firestore Permission Warning] Access restricted on collection '${path}'. Using local storage fallback.`);
    return;
  }
  const errInfo = {
    error: errMsg,
    operationType,
    path
  };
  console.error('Firestore Error: ', safeJSONStringify(errInfo));
};

class AetherweaveDatabase {
  constructor() {
    this.users = JSON.parse(localStorage.getItem('agora_users')) || [];
    this.posts = JSON.parse(localStorage.getItem('agora_posts')) || [];
    this.follows = JSON.parse(localStorage.getItem('agora_follows')) || [];
    this.currentUser = JSON.parse(localStorage.getItem('agora_current_user')) || null;
    this.isFirebaseReady = false;

    try {
      this.app = initializeApp(firebaseConfig);
      this.firestore = getFirestore(this.app);
      this.initFirebase();
    } catch (err) {
      console.warn("Firebase initialization warning:", err);
    }
  }

  async initFirebase() {
    if (!this.firestore) return;

    // Check connection to Firestore
    try {
      await getDocFromServer(doc(this.firestore, 'test', 'connection'));
    } catch (error) {
      // Ignore initial test doc missing/permission error gracefully
    }

    // Real-time listener for Posts collection
    onSnapshot(collection(this.firestore, "posts"), (snapshot) => {
      if (snapshot.empty && this.posts.length === 0) {
        // Seed initial posts to Firestore if completely empty
        this.seedFirestoreInitialPosts();
        return;
      }

      if (!snapshot.empty) {
        const remotePosts = [];
        snapshot.forEach(docSnap => {
          const data = sanitizeDocData(docSnap.data());
          remotePosts.push({
            id: isNaN(docSnap.id) ? docSnap.id : Number(docSnap.id),
            ...data
          });
        });

        // Sort posts descending by timestamp
        remotePosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.posts = remotePosts;
        this.saveLocal();
        window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
      }
      this.isFirebaseReady = true;
    }, (error) => {
      handleFirestoreError(error, 'list', 'posts');
    });

    // Real-time listener for Users collection
    onSnapshot(collection(this.firestore, "users"), (snapshot) => {
      if (!snapshot.empty) {
        const remoteUsers = [];
        snapshot.forEach(docSnap => {
          const data = sanitizeDocData(docSnap.data());
          remoteUsers.push({
            id: isNaN(docSnap.id) ? docSnap.id : Number(docSnap.id),
            ...data
          });
        });
        this.users = remoteUsers;
        this.saveLocal();
      }
    }, (error) => {
      handleFirestoreError(error, 'list', 'users');
    });
  }

  async seedFirestoreInitialPosts() {
    if (typeof SAMPLE_POSTS === 'undefined' || !SAMPLE_POSTS.length) return;
    try {
      for (let i = 0; i < SAMPLE_POSTS.length; i++) {
        const p = SAMPLE_POSTS[i];
        const postId = Date.now() + i;
        const post = {
          id: postId,
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
        };
        await setDoc(doc(this.firestore, "posts", String(postId)), post);
      }
    } catch (err) {
      handleFirestoreError(err, 'write', 'posts');
    }
  }

  // ===== USER MANAGEMENT =====
  registerUser(username, email, password) {
    if (this.users.find(u => u.email === email || u.username === username)) {
      throw new Error('User already exists');
    }

    const userId = Date.now();
    const user = {
      id: userId,
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
    this.saveLocal();

    // Sync to Firestore
    if (this.firestore) {
      setDoc(doc(this.firestore, "users", String(userId)), user).catch(err => {
        handleFirestoreError(err, 'write', `users/${userId}`);
      });
    }

    return user;
  }

  loginUser(email, password) {
    const user = this.users.find(u => u.email === email);
    if (!user || user.password !== this.hashPassword(password)) {
      throw new Error('Invalid email or password');
    }

    this.currentUser = { id: user.id, username: user.username, email: user.email, avatar: user.avatar };
    localStorage.setItem('agora_current_user', safeJSONStringify(this.currentUser));
    return user;
  }

  loginGuest() {
    this.currentUser = {
      id: 'guest',
      username: 'Guest User',
      email: 'guest@aetherweave.com',
      avatar: 'G',
      isGuest: true
    };
    localStorage.setItem('agora_current_user', safeJSONStringify(this.currentUser));
    return this.currentUser;
  }

  logoutUser() {
    this.currentUser = null;
    localStorage.removeItem('agora_current_user');
  }

  getCurrentUser() {
    if (!this.currentUser) return null;
    if (this.currentUser.isGuest || this.currentUser.id === 'guest') {
      return {
        id: 'guest',
        username: 'Guest User',
        email: 'guest@aetherweave.com',
        avatar: 'G',
        isGuest: true,
        bio: 'Browsing as Guest (Read-Only)',
        following: [],
        followers: [],
        savedPosts: [],
        createdAt: new Date().toISOString()
      };
    }
    return this.users.find(u => u.id === this.currentUser.id);
  }

  updateUserBio(userId, newBio) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    user.bio = (newBio || '').trim();
    this.saveLocal();
    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(user.id)), {
        bio: user.bio
      }).catch(err => handleFirestoreError(err, 'update', `users/${user.id}`));
    }
    return user;
  }

  toggleFollowUser(targetUserId) {
    const current = this.getCurrentUser();
    if (!current || current.isGuest) throw new Error('Guests cannot follow users');
    if (current.id === targetUserId) throw new Error('You cannot follow yourself');

    const targetUser = this.users.find(u => u.id === targetUserId);
    if (!targetUser) throw new Error('User not found');

    if (!current.following) current.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    const isFollowing = current.following.includes(targetUserId);
    if (isFollowing) {
      current.following = current.following.filter(id => id !== targetUserId);
      targetUser.followers = targetUser.followers.filter(id => id !== current.id);
    } else {
      current.following.push(targetUserId);
      targetUser.followers.push(current.id);
    }

    this.saveLocal();
    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(current.id)), { following: current.following })
        .catch(err => handleFirestoreError(err, 'update', `users/${current.id}`));
      updateDoc(doc(this.firestore, "users", String(targetUser.id)), { followers: targetUser.followers })
        .catch(err => handleFirestoreError(err, 'update', `users/${targetUser.id}`));
    }
    return !isFollowing;
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

    const nameCheck = checkProfanity(newUsername);
    if (nameCheck.hasBadWords) {
      throw new Error(`Username Rejected: Profanity or inappropriate word detected ("${nameCheck.foundWord}"). Please pick a respectful name.`);
    }

    const taken = this.users.find(
      u => u.id !== this.currentUser.id && u.username.toLowerCase() === newUsername.toLowerCase()
    );
    if (taken) throw new Error('That username is already taken');

    const user = this.getCurrentUser();
    const oldUsername = user.username;
    const newAvatar = newUsername[0].toUpperCase();

    user.username = newUsername;
    user.avatar = newAvatar;

    // Sync user profile update to Firestore
    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(user.id)), {
        username: newUsername,
        avatar: newAvatar
      }).catch(err => handleFirestoreError(err, 'update', `users/${user.id}`));
    }

    // Sync authored content
    this.posts.forEach(p => {
      if (p.authorId === user.id) {
        p.author = newUsername;
        p.avatar = newAvatar;
        p.handle = `@${newUsername}`;
        if (this.firestore) {
          updateDoc(doc(this.firestore, "posts", String(p.id)), {
            author: newUsername,
            avatar: newAvatar,
            handle: `@${newUsername}`
          }).catch(err => handleFirestoreError(err, 'update', `posts/${p.id}`));
        }
      }
      (p.comments || []).forEach(c => {
        if (c.authorId === user.id) {
          c.author = newUsername;
          c.avatar = newAvatar;
        }
      });
    });

    this.currentUser = { ...this.currentUser, username: newUsername, avatar: newAvatar };
    localStorage.setItem('agora_current_user', safeJSONStringify(this.currentUser));

    this.saveLocal();
    return user;
  }

  // ===== APP SETTINGS =====
  getSettings() {
    const defaults = { theme: 'dark', accent: 'amber', notifications: true, compactMode: false };
    const stored = JSON.parse(localStorage.getItem('agora_settings')) || {};
    return { ...defaults, ...stored };
  }

  updateSettings(partial) {
    const updated = { ...this.getSettings(), ...partial };
    localStorage.setItem('agora_settings', safeJSONStringify(updated));
    return updated;
  }

  // ===== POST MANAGEMENT =====
  createPost(title, body, space, images, flair) {
    if (!this.currentUser) throw new Error('Not logged in');

    const titleCheck = checkProfanity(title);
    if (titleCheck.hasBadWords) {
      throw new Error(`Post Not Approved: Inappropriate or profane language detected in the title ("${titleCheck.foundWord}"). Please revise before posting.`);
    }

    const bodyCheck = checkProfanity(body);
    if (bodyCheck.hasBadWords) {
      throw new Error(`Post Not Approved: Inappropriate or profane language detected in the content ("${bodyCheck.foundWord}"). Please revise before posting.`);
    }

    const postId = Date.now();
    const post = {
      id: postId,
      authorId: this.currentUser.id,
      author: this.currentUser.username,
      handle: `@${this.currentUser.username}`,
      avatar: this.currentUser.avatar,
      title,
      body,
      space,
      flair: flair || 'Discussion',
      images: images || [],
      votes: 0,
      upvoters: [],
      downvoters: [],
      comments: [],
      saved: [],
      timestamp: new Date().toISOString()
    };

    this.posts.unshift(post);
    this.saveLocal();

    // Sync new post to Firebase Firestore so other devices see it live
    if (this.firestore) {
      setDoc(doc(this.firestore, "posts", String(postId)), post).catch(err => {
        handleFirestoreError(err, 'write', `posts/${postId}`);
      });
    }

    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
    return post;
  }

  getPosts(sort = 'trending') {
    let posts = [];
    try {
      posts = JSON.parse(safeJSONStringify(this.posts));
    } catch (e) {
      posts = this.posts.map(p => ({ ...p }));
    }

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
        return posts.sort((a, b) => (b.votes + (a.comments ? a.comments.length : 0)) - (a.votes + (b.comments ? b.comments.length : 0)));
    }
  }

  // ===== VOTING SYSTEM =====
  voteOnPost(postId, voteType) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = this.posts.find(p => String(p.id) === String(postId));
    if (!post) throw new Error('Post not found');

    const userId = this.currentUser.id;

    if (voteType === 'up') {
      post.downvoters = (post.downvoters || []).filter(id => id !== userId);
      if ((post.upvoters || []).includes(userId)) {
        post.upvoters = post.upvoters.filter(id => id !== userId);
        post.votes--;
      } else {
        post.upvoters = post.upvoters || [];
        post.upvoters.push(userId);
        post.votes++;
      }
    } else if (voteType === 'down') {
      post.upvoters = (post.upvoters || []).filter(id => id !== userId);
      if ((post.downvoters || []).includes(userId)) {
        post.downvoters = post.downvoters.filter(id => id !== userId);
        post.votes++;
      } else {
        post.downvoters = post.downvoters || [];
        post.downvoters.push(userId);
        post.votes--;
      }
    }

    this.saveLocal();

    // Sync vote changes to Firestore
    if (this.firestore) {
      updateDoc(doc(this.firestore, "posts", String(postId)), {
        votes: post.votes,
        upvoters: post.upvoters,
        downvoters: post.downvoters
      }).catch(err => handleFirestoreError(err, 'update', `posts/${postId}`));
    }

    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
    return post;
  }

  // ===== COMMENTS =====
  addComment(postId, text) {
    if (!this.currentUser) throw new Error('Not logged in');

    const commentCheck = checkProfanity(text);
    if (commentCheck.hasBadWords) {
      throw new Error(`Comment Not Approved: Inappropriate or profane language detected ("${commentCheck.foundWord}"). Please keep discussions clean and respectful.`);
    }

    const post = this.posts.find(p => String(p.id) === String(postId));
    if (!post) throw new Error('Post not found');

    const comment = {
      id: Date.now(),
      authorId: this.currentUser.id,
      author: this.currentUser.username,
      avatar: this.currentUser.avatar,
      text,
      timestamp: new Date().toISOString()
    };

    post.comments = post.comments || [];
    post.comments.push(comment);
    this.saveLocal();

    // Sync comment to Firestore
    if (this.firestore) {
      updateDoc(doc(this.firestore, "posts", String(postId)), {
        comments: post.comments
      }).catch(err => handleFirestoreError(err, 'update', `posts/${postId}`));
    }

    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
    return comment;
  }

  // ===== SAVE/BOOKMARK =====
  savePost(postId) {
    if (!this.currentUser) throw new Error('Not logged in');

    const post = this.posts.find(p => String(p.id) === String(postId));
    if (!post) throw new Error('Post not found');

    const userId = this.currentUser.id;
    post.saved = post.saved || [];

    if (post.saved.includes(userId)) {
      post.saved = post.saved.filter(id => id !== userId);
    } else {
      post.saved.push(userId);
    }

    this.saveLocal();

    if (this.firestore) {
      updateDoc(doc(this.firestore, "posts", String(postId)), {
        saved: post.saved
      }).catch(err => handleFirestoreError(err, 'update', `posts/${postId}`));
    }

    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
    return post;
  }

  getSavedPosts() {
    if (!this.currentUser) return [];
    const userId = this.currentUser.id;
    return this.posts.filter(p => p.saved && p.saved.includes(userId));
  }

  // ===== REPORT SYSTEM =====
  reportPost(postId, reason, details = '') {
    const post = this.posts.find(p => String(p.id) === String(postId));
    if (!post) throw new Error('Post not found');

    post.reports = post.reports || [];
    const report = {
      id: Date.now(),
      reporter: this.currentUser ? this.currentUser.username : 'Guest User',
      reason,
      details,
      timestamp: new Date().toISOString()
    };

    post.reports.push(report);
    this.saveLocal();

    if (this.firestore) {
      updateDoc(doc(this.firestore, "posts", String(postId)), {
        reports: post.reports
      }).catch(err => handleFirestoreError(err, 'update', `posts/${postId}`));
    }

    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
    return report;
  }

  // ===== USER PROFILE: POSTS BY AUTHOR =====
  getUserPosts(userId) {
    return this.posts
      .filter(p => String(p.authorId) === String(userId))
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

    currentUser.following = currentUser.following || [];
    targetUser.followers = targetUser.followers || [];

    if (!currentUser.following.includes(targetUserId)) {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(this.currentUser.id);
    }

    this.saveLocal();

    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(currentUser.id)), { following: currentUser.following }).catch(err => handleFirestoreError(err, 'update', `users/${currentUser.id}`));
      updateDoc(doc(this.firestore, "users", String(targetUser.id)), { followers: targetUser.followers }).catch(err => handleFirestoreError(err, 'update', `users/${targetUser.id}`));
    }
  }

  unfollowUser(targetUserId) {
    if (!this.currentUser) throw new Error('Not logged in');

    const currentUser = this.getCurrentUser();
    const targetUser = this.getUserById(targetUserId);

    if (!targetUser) throw new Error('User not found');

    currentUser.following = (currentUser.following || []).filter(id => id !== targetUserId);
    targetUser.followers = (targetUser.followers || []).filter(id => id !== this.currentUser.id);

    this.saveLocal();

    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(currentUser.id)), { following: currentUser.following }).catch(err => handleFirestoreError(err, 'update', `users/${currentUser.id}`));
      updateDoc(doc(this.firestore, "users", String(targetUser.id)), { followers: targetUser.followers }).catch(err => handleFirestoreError(err, 'update', `users/${targetUser.id}`));
    }
  }

  toggleFollowUser(targetUserId) {
    if (this.isFollowing(targetUserId)) {
      this.unfollowUser(targetUserId);
      return false;
    } else {
      this.followUser(targetUserId);
      return true;
    }
  }

  isFollowing(targetUserId) {
    if (!this.currentUser) return false;
    const currentUser = this.getCurrentUser();
    return currentUser && currentUser.following ? currentUser.following.includes(targetUserId) : false;
  }

  getFollowing() {
    if (!this.currentUser) return [];
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.following) return [];
    return currentUser.following.map(id => this.getUserById(id)).filter(u => u);
  }

  getFollowers() {
    if (!this.currentUser) return [];
    const currentUser = this.getCurrentUser();
    if (!currentUser || !currentUser.followers) return [];
    return currentUser.followers.map(id => this.getUserById(id)).filter(u => u);
  }

  // ===== PROFILE =====
  updateProfile(bio) {
    if (!this.currentUser) throw new Error('Not logged in');
    const user = this.getCurrentUser();
    user.bio = bio;
    this.saveLocal();

    if (this.firestore) {
      updateDoc(doc(this.firestore, "users", String(user.id)), { bio }).catch(err => handleFirestoreError(err, 'update', `users/${user.id}`));
    }
    return user;
  }

  updateUserBio(userId, bio) {
    const user = this.getUserById(userId);
    if (user) {
      user.bio = bio;
      this.saveLocal();
      if (this.firestore) {
        updateDoc(doc(this.firestore, "users", String(user.id)), { bio }).catch(err => handleFirestoreError(err, 'update', `users/${user.id}`));
      }
    }
    return user;
  }

  deletePost(postId) {
    this.posts = this.posts.filter(p => String(p.id) !== String(postId));
    this.saveLocal();
    if (this.firestore) {
      deleteDoc(doc(this.firestore, "posts", String(postId))).catch(err => handleFirestoreError(err, 'delete', `posts/${postId}`));
    }
    window.dispatchEvent(new CustomEvent('aetherweave:posts-updated'));
  }

  // ===== UTILITY =====
  hashPassword(password) {
    return btoa(password);
  }

  save() {
    this.saveLocal();
  }

  saveLocal() {
    try {
      localStorage.setItem('agora_users', safeJSONStringify(this.users));
      localStorage.setItem('agora_posts', safeJSONStringify(this.posts));
      localStorage.setItem('agora_follows', safeJSONStringify(this.follows));
      if (this.currentUser) {
        localStorage.setItem('agora_current_user', safeJSONStringify(this.currentUser));
      }
    } catch (e) {
      console.warn('[LocalStorage] Safe save error:', e);
    }
  }

  resetAll() {
    this.users = [];
    this.posts = [];
    this.follows = [];
    this.currentUser = null;
    localStorage.clear();
  }
}

// Instantiate and expose globally
const db = new AetherweaveDatabase();
window.db = db;
export { db };
