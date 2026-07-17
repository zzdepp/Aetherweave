/* =========================================================================*
   AETHERWEAVE — Authentication & UI Management System
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const authModal = document.getElementById('authModal');
  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authUsername = document.getElementById('authUsername');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authPasswordConfirm = document.getElementById('authPasswordConfirm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
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

  const resetAuthFormFields = () => {
    if (!authForm) return;
    if (typeof authForm.reset === 'function') {
      authForm.reset();
    } else {
      if (authUsername) authUsername.value = '';
      if (authEmail) authEmail.value = '';
      if (authPassword) authPassword.value = '';
      if (authPasswordConfirm) authPasswordConfirm.value = '';
    }
  };

  // ===== AUTH MODAL TOGGLE =====
  const openAuthModal = (mode = 'signup') => {
    isSignup = mode === 'signup';
    if (authModal) authModal.classList.add('active');

    resetAuthFormFields();

    if (isSignup) {
      if (authTitle) authTitle.textContent = 'Sign Up';
      if (authSubtitle) authSubtitle.textContent = 'Join Aetherweave and join the conversation';
      if (authSubmitBtn) authSubmitBtn.textContent = 'Sign Up';

      if (authPasswordConfirm) {
        authPasswordConfirm.style.display = 'block';
        authPasswordConfirm.required = true;
      }
      if (authUsername) {
        authUsername.style.display = 'block';
        authUsername.required = true;
      }
      if (authToggle) authToggle.innerHTML = 'Already have an account? <button id="toggleAuthBtn" type="button">Log In</button>';
    } else {
      if (authTitle) authTitle.textContent = 'Log In';
      if (authSubtitle) authSubtitle.textContent = 'Welcome back to Aetherweave';
      if (authSubmitBtn) authSubmitBtn.textContent = 'Log In';

      if (authPasswordConfirm) {
        authPasswordConfirm.style.display = 'none';
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

  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('signup');
    });
  }

  // ===== CORE SUBMIT HANDLER =====
  const handleAuthSubmit = (e) => {
    if (e) e.preventDefault();

    if (typeof db === 'undefined') {
      alert("System Error: 'db' object is missing. Make sure db.js loads before auth.js.");
      return;
    }

    try {
      if (isSignup) {
        const username = authUsername ? authUsername.value.trim() : '';
        const email = authEmail ? authEmail.value.trim() : '';
        const password = authPassword ? authPassword.value : '';
        const passwordConfirm = authPasswordConfirm ? authPasswordConfirm.value : '';

        if (!username || !email || !password) {
          alert('Please fill in all fields.');
          return;
        }
        if (password !== passwordConfirm) {
          alert('Passwords do not match.');
          return;
        }
        if (password.length < 6) {
          alert('Password must be at least 6 characters.');
          return;
        }

        db.registerUser(username, email, password);
        db.loginUser(email, password);

        alert('Account created! Welcome, ' + username + '! 🎉');
        closeAuthModal();
        updateAuthUI();
      } else {
        const email = authEmail ? authEmail.value.trim() : '';
        const password = authPassword ? authPassword.value : '';

        if (!email || !password) {
          alert('Please fill in all fields.');
          return;
        }

        db.loginUser(email, password);
        alert('Welcome back! 👋');
        closeAuthModal();
        updateAuthUI();
      }
    } catch (error) {
      alert('Validation Error: ' + error.message);
    }
  };

  if (authForm && authForm.tagName === 'FORM') {
    authForm.addEventListener('submit', handleAuthSubmit);
  } else if (authSubmitBtn) {
    authSubmitBtn.addEventListener('click', handleAuthSubmit);
  }

  // ===== LOGOUT =====
  const handleLogout = () => {
    if (typeof db !== 'undefined') {
      db.logoutUser();
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
    if (typeof db === 'undefined') return;
    const currentUser = db.getCurrentUser();

    if (currentUser) {
      if (authToggleBtn) authToggleBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'block';
      if (loggedInBadge) {
        loggedInBadge.style.display = 'inline-flex';
        loggedInBadge.textContent = '● Logged in as ' + currentUser.username;
      }

      const firstLetter = currentUser.username ? currentUser.username[0].toUpperCase() : '?';
      if (profileAvatar) profileAvatar.textContent = firstLetter;
      if (dropdownAvatar) dropdownAvatar.textContent = firstLetter;
      if (dropdownName) dropdownName.textContent = currentUser.username;
      if (dropdownHandle) dropdownHandle.textContent = '@' + currentUser.username;
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
      if (typeof db === 'undefined' || !db.getCurrentUser()) {
        alert('Please log in first.');
        return;
      }
      showProfileModal(db.getCurrentUser());
    });
  }

  updateAuthUI();

  window.authSystem = {
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    updateAuthUI: updateAuthUI,
    logout: handleLogout
  };
});

// ===== PROFILE MODAL =====
function showProfileModal(user) {
  if (!user) return;
  const modal = document.createElement('div');
  modal.innerHTML = '<div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; display: flex; align-items: center; justify-content: center;" id="profileModal"><div style="background: var(--bg-elevated-2); border-radius: var(--r-lg); width: 90%; max-width: 500px; padding: 24px; border: 1px solid var(--glass-border);"><h2 style="color: var(--text-primary); margin-bottom: 16px;">' + user.username + '</h2><div style="background: var(--glass-fill); padding: 16px; border-radius: var(--r-md); margin-bottom: 16px;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(145deg, var(--accent-bright), var(--teal)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 24px; color: var(--text-on-accent);">' + user.username[0].toUpperCase() + '</div><div><div style="color: var(--text-primary); font-weight: 700;">' + user.username + '</div><div style="color: var(--text-tertiary); font-size: 12px;">@' + user.username + '</div><div style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">Joined ' + new Date(user.createdAt).toLocaleDateString() + '</div></div></div></div><div style="display: flex; gap: 8px;"><button id="closeProfileBtn" style="flex: 1; padding: 10px; background: var(--glass-fill); color: var(--text-secondary); border: 1px solid var(--glass-border); border-radius: var(--r-md); cursor: pointer; font-weight: 700;">Close</button></div></div></div>';

  document.body.appendChild(modal);

  const profileModalDiv = document.getElementById('profileModal');
  const closeProfileBtn = document.getElementById('closeProfileBtn');

  if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => modal.remove());
  if (profileModalDiv) {
    profileModalDiv.addEventListener('click', (e) => {
      if (e.target === profileModalDiv) modal.remove();
    });
  }
}
