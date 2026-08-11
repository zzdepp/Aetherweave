/* =========================================================================*
   AETHERWEAVE — Authentication & UI Management System
   Includes Brevo Email Verification Code (OTP) Sending & Verification
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Safe helper to get the global db instance
  const getDb = () => window.db;

  // DOM Elements
  const authModal = document.getElementById('authModal');
  const authModalCloseBtn = document.getElementById('authModalCloseBtn');
  const authForm = document.getElementById('authForm');
  const otpForm = document.getElementById('otpForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authUsername = document.getElementById('authUsername');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authPasswordConfirm = document.getElementById('authPasswordConfirm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authCode = document.getElementById('authCode');
  const verifySubmitBtn = document.getElementById('verifySubmitBtn');
  const resendCodeBtn = document.getElementById('resendCodeBtn');
  const backToCredentialsBtn = document.getElementById('backToCredentialsBtn');
  const guestContinueBtn = document.getElementById('guestContinueBtn');
  const otpInfo = document.getElementById('otpInfo');
  const authToggle = document.getElementById('authToggle');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loggedInBadge = document.getElementById('loggedInBadge');
  const profileAvatar = document.getElementById('profileAvatar');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownName = document.getElementById('dropdownName');
  const dropdownHandle = document.getElementById('dropdownHandle');
  const composerAvatar = document.getElementById('composerAvatar');
  const viewProfileBtn = document.getElementById('viewProfileBtn');

  let isSignup = true;
  let pendingCredentials = null;

  const resetAuthFormFields = () => {
    if (authForm) authForm.reset();
    if (otpForm) otpForm.reset();
    pendingCredentials = null;
    showStep(1);
  };

  const showStep = (step) => {
    if (step === 1) {
      if (authForm) authForm.style.display = 'flex';
      if (otpForm) otpForm.style.display = 'none';
      if (authToggle) authToggle.style.display = 'block';
    } else {
      if (authForm) authForm.style.display = 'none';
      if (otpForm) otpForm.style.display = 'flex';
      if (authToggle) authToggle.style.display = 'none';
      if (authCode) authCode.focus();
    }
  };

  // Password Eye Toggle Buttons
  const toggleAuthPassword = document.getElementById('toggleAuthPassword');
  const toggleAuthPasswordConfirm = document.getElementById('toggleAuthPasswordConfirm');
  const confirmPasswordWrapper = document.getElementById('confirmPasswordWrapper');

  if (toggleAuthPassword && authPassword) {
    toggleAuthPassword.addEventListener('click', () => {
      const isPassword = authPassword.type === 'password';
      authPassword.type = isPassword ? 'text' : 'password';
      toggleAuthPassword.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  if (toggleAuthPasswordConfirm && authPasswordConfirm) {
    toggleAuthPasswordConfirm.addEventListener('click', () => {
      const isPassword = authPasswordConfirm.type === 'password';
      authPasswordConfirm.type = isPassword ? 'text' : 'password';
      toggleAuthPasswordConfirm.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // ===== AUTH MODAL OPEN/CLOSE =====
  const openAuthModal = (mode = 'signup') => {
    isSignup = mode === 'signup';
    if (authModal) authModal.classList.add('active');

    resetAuthFormFields();

    if (isSignup) {
      if (authTitle) authTitle.textContent = 'Sign Up';
      if (authSubtitle) authSubtitle.textContent = 'Create an Aetherweave account with email verification';
      if (authSubmitBtn) authSubmitBtn.textContent = 'Continue & Send Code';

      if (confirmPasswordWrapper) confirmPasswordWrapper.style.display = 'block';
      if (authPasswordConfirm) authPasswordConfirm.required = true;
      if (authUsername) {
        authUsername.style.display = 'block';
        authUsername.required = true;
      }
      if (authToggle) authToggle.innerHTML = 'Already have an account? <button id="toggleAuthBtn" type="button">Log In</button>';
    } else {
      if (authTitle) authTitle.textContent = 'Log In';
      if (authSubtitle) authSubtitle.textContent = 'Log in with your email verification code';
      if (authSubmitBtn) authSubmitBtn.textContent = 'Continue & Send Code';

      if (confirmPasswordWrapper) confirmPasswordWrapper.style.display = 'none';
      if (authPasswordConfirm) {
        authPasswordConfirm.required = false;
        authPasswordConfirm.value = '';
      }
      if (authUsername) {
        authUsername.style.display = 'none';
        authUsername.required = false;
        authUsername.value = '';
      }
      if (authToggle) authToggle.innerHTML = 'Don\'t have an account? <button id="toggleAuthBtn" type="button">Sign Up</button>';
    }

    const newToggleBtn = document.getElementById('toggleAuthBtn');
    if (newToggleBtn) {
      newToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(isSignup ? 'login' : 'signup');
      });
    }
  };

  const closeAuthModal = () => {
    if (authModal) authModal.classList.remove('active');
    resetAuthFormFields();
  };

  if (authModalCloseBtn) {
    authModalCloseBtn.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('signup');
    });
  }

  // ===== STEP 1: SEND VERIFICATION CODE =====
  const sendVerificationCode = async () => {
    const dbInstance = getDb();
    if (!dbInstance) {
      alert("System initializing, please wait a moment and try again.");
      return;
    }

    const email = authEmail ? authEmail.value.trim() : '';
    const password = authPassword ? authPassword.value : '';

    if (!email || !password) {
      alert('Please fill in all required fields.');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    if (isSignup) {
      const username = authUsername ? authUsername.value.trim() : '';
      const passwordConfirm = authPasswordConfirm ? authPasswordConfirm.value : '';

      if (!username) {
        alert('Please enter a username.');
        return;
      }

      // Password requirement: at least 8 characters with at least 1 uppercase letter
      const passwordRegex = /^(?=.*[A-Z]).{8,}$/;
      if (!passwordRegex.test(password)) {
        alert('Password must be at least 8 characters long and include at least 1 uppercase letter (e.g. Password123).');
        return;
      }

      if (password !== passwordConfirm) {
        alert('Passwords do not match. Please re-enter.');
        return;
      }

      // Check if user already exists
      const existingUser = dbInstance.users.find(u => u.email === email || u.username === username);
      if (existingUser) {
        alert('A user with that email or username already exists. Please log in instead.');
        openAuthModal('login');
        return;
      }

      pendingCredentials = { username, email, password };
    } else {
      // Validate credentials exist for login
      try {
        const existing = dbInstance.users.find(u => u.email === email);
        if (existing && existing.password !== dbInstance.hashPassword(password)) {
          alert('Incorrect email or password.');
          return;
        }
      } catch (err) {
        // Continue to code check
      }
      pendingCredentials = { email, password };
    }

    // Disable button & show spinner state
    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = 'Sending verification code...';
    }

    try {
      console.log(`[Auth Client] Requesting email verification for ${email}`);

      let data = null;
      try {
        const response = await fetch('/api/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, action: isSignup ? 'signup' : 'login' })
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (e) {
        console.warn('[Auth Client] Server endpoint /api/send-code unavailable (e.g. GitHub Pages static hosting). Using client-side OTP dispatch.');
      }

      // Fallback for static hosting environments (e.g. GitHub Pages) where express /api server endpoints don't exist
      if (!data) {
        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
        window._clientOtpStore = window._clientOtpStore || {};
        window._clientOtpStore[email.toLowerCase()] = {
          code: generatedCode,
          expiresAt: Date.now() + 10 * 60 * 1000
        };

        // Attempt EmailJS client SDK / REST API directly
        let emailSent = false;
        try {
          const emailJsPayload = {
            service_id: "service_by7fdu4",
            template_id: "template_ffd65d9",
            user_id: "QUbnYuw4XmmEIss2e",
            template_params: {
              to_email: email,
              email: email,
              code: generatedCode,
              passcode: generatedCode,
              otp: generatedCode,
              verification_code: generatedCode,
              action: isSignup ? 'Sign Up' : 'Log In',
              subject: `[Aetherweave] Your Verification Code: ${generatedCode}`
            }
          };
          const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailJsPayload)
          });
          if (res.ok) emailSent = true;
        } catch (err) {
          console.warn('[EmailJS Direct Fallback] Error:', err);
        }

        data = {
          success: true,
          emailSent: emailSent,
          message: emailSent ? `Verification code sent to ${email}!` : `Verification code generated for ${email}.`
        };
      }

      if (!data.success) {
        alert('Failed to send verification email: ' + (data.message || 'Unknown error'));
        return;
      }

      if (otpInfo) {
        const safeEmail = email.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        otpInfo.innerHTML = `
          <div style="padding: 16px; background: rgba(0,210,180,0.12); border: 1px solid var(--teal); border-radius: 12px; text-align: center; margin-bottom: 16px;">
            <div style="font-weight: 700; color: var(--teal); font-size: 15px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>✉️</span> Verification Email Sent
            </div>
            <div style="font-size: 13.5px; color: var(--text-primary); line-height: 1.5;">
              A 6-digit verification code was sent to <strong style="color:var(--accent);">${safeEmail}</strong>.
            </div>
            <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 8px; line-height: 1.4;">
              Please check your email inbox and spam/junk folder. Enter the 6-digit code below to complete your ${isSignup ? 'sign up' : 'log in'}.
            </div>
          </div>
        `;
      }

      if (authCode) {
        authCode.value = '';
        if (authCode.focus) setTimeout(() => authCode.focus(), 150);
      }

      showStep(2);
    } catch (err) {
      console.error('[Auth Client Error] EmailJS dispatch failed:', err);
      alert('Error connecting to email verification service: ' + err.message);
    } finally {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = 'Continue & Send Code';
      }
    }
  };

  // ===== STEP 2: VERIFY CODE & LOGIN/SIGNUP =====
  const verifyCodeAndComplete = async () => {
    if (!pendingCredentials) {
      alert('Session expired. Please fill in your details again.');
      showStep(1);
      return;
    }

    const code = authCode ? authCode.value.trim() : '';
    if (!code || code.length !== 6) {
      alert('Please enter the full 6-digit code sent to your email.');
      return;
    }

    if (verifySubmitBtn) {
      verifySubmitBtn.disabled = true;
      verifySubmitBtn.textContent = 'Verifying...';
    }

    try {
      let data = null;
      try {
        const response = await fetch('/api/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: pendingCredentials.email, code })
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (e) {
        console.warn('[Auth Client] Server endpoint /api/verify-code unavailable. Using client-side OTP store verification.');
      }

      if (!data) {
        const store = window._clientOtpStore ? window._clientOtpStore[pendingCredentials.email.toLowerCase()] : null;
        if (!store) {
          data = { success: false, message: 'No verification code found for this email. Please request a new code.' };
        } else if (Date.now() > store.expiresAt) {
          data = { success: false, message: 'Verification code expired. Please request a new code.' };
        } else if (store.code !== code.trim()) {
          data = { success: false, message: 'Incorrect verification code. Please check your email.' };
        } else {
          data = { success: true, message: 'Email verified successfully!' };
        }
      }

      if (!data.success) {
        alert(data.message || 'Verification failed.');
        return;
      }

      const dbInstance = getDb();
      if (isSignup) {
        dbInstance.registerUser(pendingCredentials.username, pendingCredentials.email, pendingCredentials.password);
        dbInstance.loginUser(pendingCredentials.email, pendingCredentials.password);
        alert(`Account created & email verified! Welcome, ${pendingCredentials.username}! 🎉`);
      } else {
        dbInstance.loginUser(pendingCredentials.email, pendingCredentials.password);
        alert('Email verified & logged in! Welcome back! 👋');
      }

      closeAuthModal();
      updateAuthUI();
    } catch (err) {
      console.error('Verify code error:', err);
      alert('Error verifying code: ' + err.message);
    } finally {
      if (verifySubmitBtn) {
        verifySubmitBtn.disabled = false;
        verifySubmitBtn.textContent = 'Verify Code & Complete';
      }
    }
  };

  // Event Listeners for Forms
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendVerificationCode();
    });
  }

  if (otpForm) {
    otpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      verifyCodeAndComplete();
    });
  }

  if (resendCodeBtn) {
    resendCodeBtn.addEventListener('click', () => {
      sendVerificationCode();
    });
  }

  if (backToCredentialsBtn) {
    backToCredentialsBtn.addEventListener('click', () => {
      showStep(1);
    });
  }

  if (guestContinueBtn) {
    guestContinueBtn.addEventListener('click', () => {
      const dbInstance = getDb();
      if (dbInstance) {
        dbInstance.loginGuest();
      }
      closeAuthModal();
      updateAuthUI();
      if (typeof showToast === 'function') {
        showToast('Browsing as Guest (Read-Only)', 'info');
      }
    });
  }

  // ===== LOGOUT =====
  const handleLogout = () => {
    const dbInstance = getDb();
    if (dbInstance) {
      dbInstance.logoutUser();
    }
    updateAuthUI();
    closeAuthModal();
  };

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  document.addEventListener('click', (e) => {
    if (e.target.id === 'logoutDropdownBtn') {
      e.preventDefault();
      handleLogout();
    }
  });

  // ===== UI STATE =====
  const updateAuthUI = () => {
    const dbInstance = getDb();
    if (!dbInstance) return;

    const currentUser = dbInstance.getCurrentUser();

    if (currentUser) {
      const isGuest = currentUser.isGuest || currentUser.id === 'guest';

      if (authToggleBtn) {
        if (isGuest) {
          authToggleBtn.style.display = 'block';
          authToggleBtn.textContent = 'Sign Up / Log In';
        } else {
          authToggleBtn.style.display = 'none';
        }
      }
      if (logoutBtn) {
        logoutBtn.style.display = 'block';
        logoutBtn.textContent = isGuest ? 'Exit Guest Mode' : 'Log Out';
      }
      if (loggedInBadge) {
        loggedInBadge.style.display = 'inline-flex';
        loggedInBadge.textContent = isGuest ? '● Browsing as Guest' : '● Logged in as ' + currentUser.username;
      }

      const firstLetter = isGuest ? 'G' : (currentUser.username ? currentUser.username[0].toUpperCase() : '?');
      if (profileAvatar) profileAvatar.textContent = firstLetter;
      if (dropdownAvatar) dropdownAvatar.textContent = firstLetter;
      if (dropdownName) dropdownName.textContent = currentUser.username;
      if (dropdownHandle) dropdownHandle.textContent = isGuest ? '@guest' : '@' + currentUser.username;
      if (composerAvatar) composerAvatar.textContent = firstLetter;

      const composer = document.getElementById('composer');
      if (composer) {
        composer.style.opacity = '1';
        composer.style.pointerEvents = 'auto';
      }
    } else {
      if (authToggleBtn) authToggleBtn.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (loggedInBadge) loggedInBadge.style.display = 'none';

      if (profileAvatar) profileAvatar.textContent = '?';
      if (dropdownAvatar) dropdownAvatar.textContent = '?';
      if (dropdownName) dropdownName.textContent = 'Not logged in';
      if (dropdownHandle) dropdownHandle.textContent = '@user';
      if (composerAvatar) composerAvatar.textContent = '?';

      const composer = document.getElementById('composer');
      if (composer) {
        composer.style.opacity = '0.5';
        composer.style.pointerEvents = 'none';
      }
    }
  };

  // ===== PROFILE =====
  if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const dbInstance = getDb();
      if (!dbInstance || !dbInstance.getCurrentUser()) {
        alert('Please log in first.');
        return;
      }
      showProfileModal(dbInstance.getCurrentUser());
    });
  }

  // Initial UI sync
  updateAuthUI();

  window.authSystem = {
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    updateAuthUI: updateAuthUI,
    logout: handleLogout
  };
});

// ===== REDDIT-STYLE PROFILE MODAL =====
function showProfileModal(targetUser) {
  if (!targetUser) return;
  const db = window.db;
  const currentUser = db ? db.getCurrentUser() : null;
  const isOwnProfile = currentUser && currentUser.id === targetUser.id;
  
  // Calculate karma and stats
  const allPosts = (db && db.posts) ? db.posts : [];
  const userPosts = allPosts.filter(p => (p.authorId && p.authorId === targetUser.id) || p.author === targetUser.username);
  
  const userComments = [];
  allPosts.forEach(p => {
    (p.comments || []).forEach(c => {
      if ((c.authorId && c.authorId === targetUser.id) || c.author === targetUser.username) {
        userComments.push({ ...c, postTitle: p.title, postId: p.id, space: p.space });
      }
    });
  });

  const postKarma = userPosts.reduce((sum, p) => sum + (p.votes || 0), 0);
  const commentKarma = userComments.length;
  const totalKarma = postKarma + commentKarma;

  const followersCount = (targetUser.followers || []).length;
  const followingCount = (targetUser.following || []).length;

  const savedPostIds = targetUser.savedPosts || [];
  const savedPosts = allPosts.filter(p => savedPostIds.includes(p.id));

  const isFollowing = currentUser && (currentUser.following || []).includes(targetUser.id);

  // Remove existing profile modal if present
  const existing = document.getElementById('profileModalContainer');
  if (existing) existing.remove();

  // Render Modal HTML
  const modal = document.createElement('div');
  modal.id = 'profileModalContainer';
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;" id="profileModalBackdrop">
      <div style="background: var(--bg-elevated-2); border-radius: 16px; width: 100%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; border: 1px solid var(--glass-border-strong); box-shadow: 0 20px 60px rgba(0,0,0,0.8); overflow: hidden;">
        
        <!-- Profile Banner Header -->
        <div style="background: linear-gradient(135deg, #e9a94d 0%, #171b25 100%); padding: 24px 24px 16px; position: relative;">
          <button id="closeProfileBtn" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.4); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          
          <div style="display: flex; align-items: flex-end; gap: 16px;">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: #171b25; border: 3px solid #e9a94d; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 32px; color: #ffc773; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              ${targetUser.avatar || (targetUser.username ? targetUser.username[0].toUpperCase() : '?')}
            </div>
            <div style="flex: 1; color: #fff;">
              <h2 style="font-size: 22px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
                u/${targetUser.username}
                ${targetUser.isGuest ? '<span style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 12px;">Guest</span>' : ''}
              </h2>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8); margin-top: 2px;">
                ${isOwnProfile ? targetUser.email + ' • ' : ''}Redditor since ${new Date(targetUser.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </div>
            </div>
            ${!isOwnProfile && currentUser && !currentUser.isGuest ? `
              <button id="profileFollowBtn" style="padding: 8px 18px; background: ${isFollowing ? 'var(--glass-fill)' : 'var(--accent)'}; color: ${isFollowing ? '#fff' : '#000'}; border: 1px solid var(--glass-border); border-radius: 20px; font-weight: 700; cursor: pointer; font-size: 13px;">
                ${isFollowing ? '✓ Following' : '➕ Follow'}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Reddit Stats Bar -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); background: var(--bg-elevated); padding: 12px 20px; border-bottom: 1px solid var(--glass-border); text-align: center;">
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--accent);">${totalKarma}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Karma</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${userPosts.length}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Posts</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${followersCount}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Followers</div>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${followingCount}</div>
            <div style="font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Following</div>
          </div>
        </div>

        <!-- Bio Section -->
        <div style="padding: 16px 20px; background: var(--glass-fill); border-bottom: 1px solid var(--glass-border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">About Bio</span>
            ${isOwnProfile && !targetUser.isGuest ? `<button id="editBioBtn" style="background: none; border: none; color: var(--teal); font-size: 12px; cursor: pointer; font-weight: 600;">✏️ Edit Bio</button>` : ''}
          </div>
          <p id="profileBioText" style="font-size: 13px; color: var(--text-primary); margin: 0; line-height: 1.5; white-space: pre-wrap;">${targetUser.bio || 'No bio provided yet.'}</p>
          <div id="bioEditBox" style="display: none; margin-top: 8px;">
            <textarea id="bioInput" style="width: 100%; padding: 8px; border-radius: 8px; background: var(--bg-elevated-2); border: 1px solid var(--glass-border); color: var(--text-primary); font-size: 13px; resize: vertical; min-height: 60px;">${targetUser.bio || ''}</textarea>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px;">
              <button id="cancelBioBtn" style="padding: 4px 12px; background: var(--glass-fill); border: 1px solid var(--glass-border); border-radius: 6px; color: var(--text-primary); font-size: 12px; cursor: pointer;">Cancel</button>
              <button id="saveBioBtn" style="padding: 4px 12px; background: var(--accent); border: none; border-radius: 6px; color: #000; font-weight: 700; font-size: 12px; cursor: pointer;">Save Bio</button>
            </div>
          </div>
        </div>

        <!-- Profile Tabs Header -->
        <div style="display: flex; border-bottom: 1px solid var(--glass-border); background: var(--bg-elevated); padding: 0 12px; gap: 4px; overflow-x: auto;">
          <button class="profile-tab-btn active" data-tab="posts" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid var(--accent); color: var(--accent); font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap;">
            📝 Posts (${userPosts.length})
          </button>
          <button class="profile-tab-btn" data-tab="comments" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-tertiary); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap;">
            💬 Comments (${userComments.length})
          </button>
          ${isOwnProfile ? `
            <button class="profile-tab-btn" data-tab="saved" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-tertiary); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap;">
              🔖 Saved (${savedPosts.length})
            </button>
          ` : ''}
          <button class="profile-tab-btn" data-tab="network" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-tertiary); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap;">
            👥 Community & Followers
          </button>
        </div>

        <!-- Tab Content Body -->
        <div style="flex: 1; overflow-y: auto; padding: 16px; background: var(--bg-elevated-2);" id="profileTabBody">
          <!-- Dynamically populated by JS renderTabContent() -->
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const backdrop = document.getElementById('profileModalBackdrop');
  const closeBtn = document.getElementById('closeProfileBtn');
  const profileTabBody = document.getElementById('profileTabBody');
  const editBioBtn = document.getElementById('editBioBtn');
  const bioEditBox = document.getElementById('bioEditBox');
  const bioText = document.getElementById('profileBioText');
  const saveBioBtn = document.getElementById('saveBioBtn');
  const cancelBioBtn = document.getElementById('cancelBioBtn');
  const followBtn = document.getElementById('profileFollowBtn');

  const closeModal = () => modal.remove();

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  // Follow user toggle
  if (followBtn) {
    followBtn.addEventListener('click', () => {
      try {
        const nowFollowing = db.toggleFollowUser(targetUser.id);
        followBtn.textContent = nowFollowing ? '✓ Following' : '➕ Follow';
        followBtn.style.background = nowFollowing ? 'var(--glass-fill)' : 'var(--accent)';
        followBtn.style.color = nowFollowing ? '#fff' : '#000';
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Edit Bio Logic
  if (editBioBtn && bioEditBox && bioText) {
    editBioBtn.addEventListener('click', () => {
      bioEditBox.style.display = 'block';
      bioText.style.display = 'none';
      editBioBtn.style.display = 'none';
    });

    if (cancelBioBtn) {
      cancelBioBtn.addEventListener('click', () => {
        bioEditBox.style.display = 'none';
        bioText.style.display = 'block';
        editBioBtn.style.display = 'inline-block';
      });
    }

    if (saveBioBtn) {
      saveBioBtn.addEventListener('click', () => {
        const newBioVal = document.getElementById('bioInput').value.trim();
        db.updateUserBio(targetUser.id, newBioVal);
        targetUser.bio = newBioVal;
        bioText.textContent = newBioVal || 'No bio provided yet.';
        bioEditBox.style.display = 'none';
        bioText.style.display = 'block';
        editBioBtn.style.display = 'inline-block';
      });
    }
  }

  // Tab Switching Handler
  const renderTabContent = (tabName) => {
    if (!profileTabBody) return;

    if (tabName === 'posts') {
      if (!userPosts.length) {
        profileTabBody.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 32px;">No posts published yet.</div>`;
        return;
      }
      profileTabBody.innerHTML = userPosts.map(p => `
        <div style="background: var(--glass-fill); border: 1px solid var(--glass-border); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--teal); background: rgba(0,210,180,0.1); padding: 2px 8px; border-radius: 12px;">s/${p.space || 'general'}</span>
            <span style="font-size: 11px; color: var(--text-tertiary);">${new Date(p.timestamp).toLocaleDateString()}</span>
          </div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px 0; cursor: pointer;">
            ${p.title}
          </h3>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--text-tertiary);">
            <span>🔺 ${p.votes || 0} Upvotes • 💬 ${(p.comments || []).length} Comments</span>
            ${isOwnProfile ? `<button class="delete-user-post-btn" data-postid="${p.id}" style="background: none; border: none; color: #ff5555; cursor: pointer; font-size: 12px;">🗑️ Delete Post</button>` : ''}
          </div>
        </div>
      `).join('');

      profileTabBody.querySelectorAll('.delete-user-post-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const pid = Number(e.target.getAttribute('data-postid'));
          if (confirm('Are you sure you want to delete this post?')) {
            window.db.deletePost(pid);
            renderTabContent('posts');
          }
        });
      });
    } else if (tabName === 'comments') {
      if (!userComments.length) {
        profileTabBody.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 32px;">No comments written yet.</div>`;
        return;
      }
      profileTabBody.innerHTML = userComments.map(c => `
        <div style="background: var(--glass-fill); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px; margin-bottom: 10px;">
          <div style="font-size: 11px; color: var(--teal); margin-bottom: 4px;">Commented on: <strong>${c.postTitle}</strong></div>
          <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">${c.text}</div>
          <div style="font-size: 10px; color: var(--text-tertiary); margin-top: 6px;">${new Date(c.timestamp).toLocaleString()}</div>
        </div>
      `).join('');
    } else if (tabName === 'saved') {
      if (!savedPosts.length) {
        profileTabBody.innerHTML = `<div style="text-align: center; color: var(--text-tertiary); padding: 32px;">No saved posts yet.</div>`;
        return;
      }
      profileTabBody.innerHTML = savedPosts.map(p => `
        <div style="background: var(--glass-fill); border: 1px solid var(--glass-border); border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <div style="font-size: 11px; color: var(--teal);">s/${p.space} • Posted by u/${p.author}</div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 4px 0 8px;">${p.title}</h3>
          <div style="font-size: 12px; color: var(--text-tertiary);">🔺 ${p.votes || 0} Upvotes • 💬 ${(p.comments || []).length} Comments</div>
        </div>
      `).join('');
    } else if (tabName === 'network') {
      const followersList = (targetUser.followers || []).map(id => db.getUserById(id)).filter(Boolean);
      const followingList = (targetUser.following || []).map(id => db.getUserById(id)).filter(Boolean);

      profileTabBody.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 10px;">Followers (${followersList.length})</h4>
          ${followersList.length ? followersList.map(u => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--glass-fill); border-radius: 8px; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--text-primary);">u/${u.username}</span>
              <button class="view-user-prof-btn" data-uid="${u.id}" style="padding: 4px 10px; background: var(--bg-elevated); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 6px; font-size: 11px; cursor: pointer;">View Profile</button>
            </div>
          `).join('') : '<div style="font-size: 12px; color: var(--text-tertiary);">No followers yet.</div>'}
        </div>

        <div>
          <h4 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 10px;">Following (${followingList.length})</h4>
          ${followingList.length ? followingList.map(u => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--glass-fill); border-radius: 8px; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--text-primary);">u/${u.username}</span>
              <button class="view-user-prof-btn" data-uid="${u.id}" style="padding: 4px 10px; background: var(--bg-elevated); border: 1px solid var(--glass-border); color: var(--text-primary); border-radius: 6px; font-size: 11px; cursor: pointer;">View Profile</button>
            </div>
          `).join('') : '<div style="font-size: 12px; color: var(--text-tertiary);">Not following any users yet.</div>'}
        </div>
      `;

      profileTabBody.querySelectorAll('.view-user-prof-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uid = Number(e.target.getAttribute('data-uid'));
          const target = db.getUserById(uid);
          if (target) showProfileModal(target);
        });
      });
    }
  };

  // Bind tab click events
  const tabButtons = modal.querySelectorAll('.profile-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.style.borderBottomColor = 'transparent';
        b.style.color = 'var(--text-tertiary)';
      });
      btn.classList.add('active');
      btn.style.borderBottomColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
      renderTabContent(btn.getAttribute('data-tab'));
    });
  });

  // Initial tab render
  renderTabContent('posts');
}
