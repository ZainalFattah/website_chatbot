document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    // Configure marked to sanitize HTML to prevent XSS (basic)
    // In a real prod app you might use DOMPurify

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);

        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('avatar');
        avatarDiv.textContent = sender === 'user' ? 'YOU' : 'BOT';

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');

        if (sender === 'bot') {
            // Parse Markdown for bot responses
            contentDiv.innerHTML = marked.parse(text);
        } else {
            // Plain text for user
            contentDiv.textContent = text;
        }

        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);

        scrollToBottom();
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // 1. Show user message
        addMessage('user', message);
        userInput.value = '';
        userInput.focus();

        // 2. Show loading indicator
        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'bot');
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = `
            <div class="avatar">BOT</div>
            <div class="content">PROCESSING...</div>
        `;
        chatMessages.appendChild(loadingDiv);
        scrollToBottom();

        // 3. Call backend API
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            // Remove loading
            document.getElementById(loadingId).remove();

            if (response.ok) {
                addMessage('bot', data.reply);
            } else {
                addMessage('bot', `ERROR: ${data.error || 'SYSTEM FAILURE'}`);
            }
        } catch (error) {
            console.error('Error:', error);
            // Remove loading
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            addMessage('bot', 'CONNECTION ERROR. PLEASE CHECK YOUR NETWORK.');
        }
    }

    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Initial focus
    userInput.focus();
});
