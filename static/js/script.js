// ===== Mobile Viewport Height Fix =====
// Fixes 100vh issue on mobile browsers (address bar overlaps content)
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--real-vh', `${vh}px`);
}
setViewportHeight();
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => setTimeout(setViewportHeight, 150));

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const navItems = document.querySelectorAll('.nav-item');
    const loginBtn = document.getElementById('login-btn');
    const userInfoEl = document.getElementById('user-info');
    const sidebarUsername = document.getElementById('sidebar-username');
    const authModal = document.getElementById('auth-modal');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const logoutBtn = document.getElementById('logout-btn');
    const sidebar = document.getElementById('sidebar');
    const mainLayout = document.querySelector('.main-layout');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarShowBtn = document.getElementById('sidebar-show-btn');
    const headerToggleBtn = document.getElementById('header-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // --- State ---
    let currentUser = null;
    let currentSessionId = null;
    let isLoading = false;
    let sidebarCollapsed = false;

    // --- Init ---
    checkAuth();
    userInput.focus();

    // ===== Sidebar Toggle Logic =====
    function isMobile() {
        return window.innerWidth <= 640;
    }

    function toggleSidebar() {
        if (isMobile()) {
            toggleMobileSidebar();
        } else {
            toggleDesktopSidebar();
        }
    }

    function toggleDesktopSidebar() {
        sidebarCollapsed = !sidebarCollapsed;
        if (sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            mainLayout.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            mainLayout.classList.remove('sidebar-collapsed');
        }
    }

    function toggleMobileSidebar() {
        const isOpen = sidebar.classList.contains('mobile-open');
        if (isOpen) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    }

    function openMobileSidebar() {
        sidebar.classList.add('mobile-open');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileSidebar() {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Toggle buttons
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (sidebarShowBtn) sidebarShowBtn.addEventListener('click', toggleSidebar);
    if (headerToggleBtn) headerToggleBtn.addEventListener('click', toggleSidebar);

    // Overlay closes sidebar on mobile
    sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // Handle resize: if was mobile with sidebar open, close overlay on resize to desktop
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            closeMobileSidebar();
            // Re-apply collapsed state
            if (sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                mainLayout.classList.add('sidebar-collapsed');
            }
        }
    });

    // --- Auth ---
    async function checkAuth() {
        try {
            const res = await fetch('/api/me');
            const data = await res.json();
            currentUser = data.user;
            updateUIForAuth();
        } catch (e) {
            currentUser = null;
            updateUIForAuth();
        }
    }

    function updateUIForAuth() {
        if (currentUser) {
            loginBtn.style.display = 'none';
            userInfoEl.style.display = 'flex';
            sidebarUsername.textContent = currentUser.username;
            newChatBtn.style.display = 'inline-block';
            document.getElementById('settings-logged-in').style.display = 'block';
            document.getElementById('settings-logged-out').style.display = 'none';
            document.getElementById('settings-username').textContent = currentUser.username;
            document.getElementById('settings-email').textContent = currentUser.email;
            document.getElementById('history-login-prompt').style.display = 'none';
            document.getElementById('sessions-list').style.display = 'flex';
        } else {
            loginBtn.style.display = 'flex';
            userInfoEl.style.display = 'none';
            newChatBtn.style.display = 'none';
            document.getElementById('settings-logged-in').style.display = 'none';
            document.getElementById('settings-logged-out').style.display = 'block';
            document.getElementById('history-login-prompt').style.display = 'flex';
            document.getElementById('sessions-list').style.display = 'none';
            currentSessionId = null;
        }
    }

    // --- Modal ---
    window.openAuthModal = function() {
        authModal.style.display = 'flex';
        document.getElementById('login-error').textContent = '';
        document.getElementById('register-error').textContent = '';
        closeMobileSidebar();
    };

    window.closeAuthModal = function() {
        authModal.style.display = 'none';
    };

    window.switchAuthTab = function(tab) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const modalTitle = document.getElementById('modal-title');

        if (tab === 'login') {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            modalTitle.textContent = 'Login';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            tabLogin.classList.remove('active');
            tabRegister.classList.add('active');
            modalTitle.textContent = 'Register';
        }
    };

    // Close modal on overlay click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });

    // --- Login ---
    window.handleLogin = async function(e) {
        e.preventDefault();
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            errorEl.textContent = 'All fields required.';
            return;
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                currentUser = data.user;
                closeAuthModal();
                updateUIForAuth();
                startNewChat();
                loadSessions();
                document.getElementById('login-form').reset();
            } else {
                errorEl.textContent = data.error || 'Login failed.';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error.';
        }
    };

    // --- Register ---
    window.handleRegister = async function(e) {
        e.preventDefault();
        const errorEl = document.getElementById('register-error');
        errorEl.textContent = '';

        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;

        if (!username || !email || !password) {
            errorEl.textContent = 'All fields required.';
            return;
        }

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                currentUser = data.user;
                closeAuthModal();
                updateUIForAuth();
                startNewChat();
                loadSessions();
                document.getElementById('register-form').reset();
            } else {
                errorEl.textContent = data.error || 'Registration failed.';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error.';
        }
    };

    // --- Logout ---
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {}
        currentUser = null;
        currentSessionId = null;
        updateUIForAuth();
        clearChat();
        addBotWelcome();
        switchView('chat');
    });

    // --- Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
            if (isMobile()) closeMobileSidebar();
        });
    });

    function switchView(view) {
        navItems.forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

        const navEl = document.querySelector(`[data-view="${view}"]`);
        const panelEl = document.getElementById(`view-${view}`);
        if (navEl) navEl.classList.add('active');
        if (panelEl) panelEl.classList.add('active');

        if (view === 'history' && currentUser) {
            loadSessions();
        }
    }

    // --- Chat Sessions ---
    async function createSession() {
        if (!currentUser) return null;
        try {
            const res = await fetch('/api/sessions', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                currentSessionId = data.session.id;
                return data.session;
            }
        } catch (e) {}
        return null;
    }

    async function loadSessions() {
        if (!currentUser) return;
        const listEl = document.getElementById('sessions-list');
        try {
            const res = await fetch('/api/sessions');
            const data = await res.json();
            if (res.ok) {
                if (data.sessions.length === 0) {
                    listEl.innerHTML = '<div class="empty-history">No chat history yet.<br>Start a new conversation!</div>';
                    return;
                }
                listEl.innerHTML = data.sessions.map(s => `
                    <div class="session-item" data-id="${s.id}">
                        <div class="session-info" onclick="loadSession(${s.id})">
                            <div class="session-title">${escapeHtml(s.title)}</div>
                            <div class="session-date">${formatDate(s.updated_at)}</div>
                        </div>
                        <button class="session-delete" onclick="event.stopPropagation(); deleteSession(${s.id})" title="Delete">✕</button>
                    </div>
                `).join('');
            }
        } catch (e) {
            listEl.innerHTML = '<div class="empty-history">Failed to load history.</div>';
        }
    }

    window.loadSession = async function(sessionId) {
        if (!currentUser) return;
        currentSessionId = sessionId;

        try {
            const res = await fetch(`/api/sessions/${sessionId}/messages`);
            const data = await res.json();
            if (res.ok) {
                clearChat();
                if (data.messages.length === 0) {
                    addBotWelcome();
                } else {
                    data.messages.forEach(msg => {
                        addMessage(msg.sender, msg.content);
                    });
                }
                switchView('chat');

                // Update header title
                const sessRes = await fetch('/api/sessions');
                const sessData = await sessRes.json();
                if (sessRes.ok) {
                    const sess = sessData.sessions.find(s => s.id === sessionId);
                    if (sess) chatHeaderTitle.textContent = sess.title;
                }
            }
        } catch (e) {
            console.error('Failed to load session:', e);
        }
    };

    window.deleteSession = async function(sessionId) {
        if (!currentUser) return;
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
            if (res.ok) {
                if (currentSessionId === sessionId) {
                    currentSessionId = null;
                    startNewChat();
                }
                loadSessions();
            }
        } catch (e) {}
    };

    function startNewChat() {
        currentSessionId = null;
        clearChat();
        addBotWelcome();
        chatHeaderTitle.textContent = 'Welcome to RetroChat!';
        switchView('chat');
    }

    newChatBtn.addEventListener('click', startNewChat);

    // --- Chat Functions ---
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function clearChat() {
        chatMessages.innerHTML = '';
    }

    function addBotWelcome() {
        addMessage('bot', 'Hello there! 👋\nHow can I help you today?');
    }

    function addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar-wrapper', sender === 'bot' ? 'bot-avatar' : 'user-avatar');

        if (sender === 'bot') {
            avatarDiv.innerHTML = '<div class="pixel-avatar-bot"><div class="pab-screen"><span class="pab-eye">■</span><span class="pab-eye">■</span></div></div>';
        } else {
            avatarDiv.innerHTML = '<div class="pixel-avatar-user">👤</div>';
        }

        const bubbleDiv = document.createElement('div');
        bubbleDiv.classList.add('bubble', sender === 'bot' ? 'bot-bubble' : 'user-bubble');

        if (sender === 'bot') {
            try {
                bubbleDiv.innerHTML = marked.parse(text);
            } catch (e) {
                bubbleDiv.textContent = text;
            }
        } else {
            bubbleDiv.textContent = text;
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    function addLoadingMessage() {
        const id = 'loading-' + Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'bot');
        messageDiv.id = id;
        messageDiv.innerHTML = `
            <div class="avatar-wrapper bot-avatar">
                <div class="pixel-avatar-bot"><div class="pab-screen"><span class="pab-eye">■</span><span class="pab-eye">■</span></div></div>
            </div>
            <div class="bubble bot-bubble">
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return id;
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message || isLoading) return;
        isLoading = true;

        addMessage('user', message);
        userInput.value = '';
        userInput.focus();

        // Create session if logged in and no current session
        if (currentUser && !currentSessionId) {
            await createSession();
        }

        const loadingId = addLoadingMessage();

        try {
            const body = { message };
            if (currentSessionId) body.session_id = currentSessionId;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            if (response.ok) {
                addMessage('bot', data.reply);
                if (currentUser && chatHeaderTitle.textContent === 'Welcome to RetroChat!') {
                    chatHeaderTitle.textContent = message.length > 40 ? message.substring(0, 40) + '...' : message;
                }
            } else {
                addMessage('bot', `ERROR: ${data.error || 'SYSTEM FAILURE'}`);
            }
        } catch (error) {
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            addMessage('bot', 'CONNECTION ERROR. Please check your network.');
        }

        isLoading = false;
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // --- Utilities ---
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    }
});