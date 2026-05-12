import os
import sqlite3
import bcrypt
from flask import Flask, request, jsonify, render_template, session, g
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "retrochat-secret-key-change-me")

# Configure Gemini API
gemini_api_key = os.getenv("GEMINI_API_KEY")

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel('gemini-2.0-flash')
else:
    model = None
    print("Warning: GEMINI_API_KEY is not set.")

# --- Database Setup ---
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'retrochat.db')

def get_db():
    """Get database connection for current request."""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """Close database connection at end of request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Initialize database tables."""
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT 'New Chat',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            sender TEXT NOT NULL CHECK(sender IN ('user', 'bot')),
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        );
    ''')
    db.commit()
    db.close()

# Initialize DB on startup
init_db()

def get_current_user():
    """Get current logged-in user from session."""
    user_id = session.get('user_id')
    if user_id is None:
        return None
    db = get_db()
    user = db.execute('SELECT id, username, email FROM users WHERE id = ?', (user_id,)).fetchone()
    return user

# --- Routes ---

@app.route('/')
def index():
    return render_template('index.html')

# --- Auth API ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided."}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({"error": "All fields are required."}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    if '@' not in email or '.' not in email:
        return jsonify({"error": "Invalid email format."}), 400

    # Hash password
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    db = get_db()
    try:
        db.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        db.commit()

        # Get the new user
        user = db.execute('SELECT id, username, email FROM users WHERE username = ?', (username,)).fetchone()

        # Auto-login after register
        session['user_id'] = user['id']

        return jsonify({
            "message": "Registration successful!",
            "user": {"id": user['id'], "username": user['username'], "email": user['email']}
        }), 201

    except sqlite3.IntegrityError as e:
        error_msg = str(e)
        if 'username' in error_msg:
            return jsonify({"error": "Username already taken."}), 409
        elif 'email' in error_msg:
            return jsonify({"error": "Email already registered."}), 409
        return jsonify({"error": "Registration failed."}), 409


@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided."}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

    if user is None:
        return jsonify({"error": "Invalid username or password."}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({"error": "Invalid username or password."}), 401

    session['user_id'] = user['id']
    return jsonify({
        "message": "Login successful!",
        "user": {"id": user['id'], "username": user['username'], "email": user['email']}
    })


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({"message": "Logged out successfully."})


@app.route('/api/me', methods=['GET'])
def me():
    user = get_current_user()
    if user is None:
        return jsonify({"user": None})
    return jsonify({
        "user": {"id": user['id'], "username": user['username'], "email": user['email']}
    })

# --- Chat Sessions API ---

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    user = get_current_user()
    if user is None:
        return jsonify({"error": "Login required."}), 401

    db = get_db()
    sessions = db.execute(
        'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
        (user['id'],)
    ).fetchall()

    return jsonify({
        "sessions": [dict(s) for s in sessions]
    })


@app.route('/api/sessions', methods=['POST'])
def create_session():
    user = get_current_user()
    if user is None:
        return jsonify({"error": "Login required."}), 401

    db = get_db()
    cursor = db.execute(
        'INSERT INTO chat_sessions (user_id) VALUES (?)',
        (user['id'],)
    )
    db.commit()

    new_session = db.execute(
        'SELECT id, title, created_at, updated_at FROM chat_sessions WHERE id = ?',
        (cursor.lastrowid,)
    ).fetchone()

    return jsonify({"session": dict(new_session)}), 201


@app.route('/api/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    user = get_current_user()
    if user is None:
        return jsonify({"error": "Login required."}), 401

    db = get_db()
    # Verify ownership
    s = db.execute(
        'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
        (session_id, user['id'])
    ).fetchone()

    if s is None:
        return jsonify({"error": "Session not found."}), 404

    db.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
    db.commit()

    return jsonify({"message": "Session deleted."})


@app.route('/api/sessions/<int:session_id>/messages', methods=['GET'])
def get_messages(session_id):
    user = get_current_user()
    if user is None:
        return jsonify({"error": "Login required."}), 401

    db = get_db()
    # Verify ownership
    s = db.execute(
        'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
        (session_id, user['id'])
    ).fetchone()

    if s is None:
        return jsonify({"error": "Session not found."}), 404

    messages = db.execute(
        'SELECT id, sender, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC',
        (session_id,)
    ).fetchall()

    return jsonify({
        "messages": [dict(m) for m in messages]
    })


# --- Chat API ---

@app.route('/api/chat', methods=['POST'])
def chat():
    if not model:
        return jsonify({"error": "Gemini API key is missing on the server."}), 500

    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data['message']
    session_id = data.get('session_id')

    user = get_current_user()
    db = get_db()

    # If logged in and session_id provided, load conversation history for context
    conversation_history = []
    if user and session_id:
        # Verify session ownership
        s = db.execute(
            'SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
            (session_id, user['id'])
        ).fetchone()

        if s:
            # Load recent messages for context (last 20 messages)
            recent_msgs = db.execute(
                'SELECT sender, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 20',
                (session_id,)
            ).fetchall()
            recent_msgs = list(reversed(recent_msgs))

            for msg in recent_msgs:
                role = 'user' if msg['sender'] == 'user' else 'model'
                conversation_history.append({
                    'role': role,
                    'parts': [msg['content']]
                })

    try:
        if conversation_history:
            # Use chat with history for context-aware responses
            chat_instance = model.start_chat(history=conversation_history)
            response = chat_instance.send_message(user_message)
        else:
            # Stateless for guests
            response = model.generate_content(user_message)

        bot_reply = response.text

        # Save messages if logged in
        if user and session_id:
            s = db.execute(
                'SELECT id, title FROM chat_sessions WHERE id = ? AND user_id = ?',
                (session_id, user['id'])
            ).fetchone()

            if s:
                # Save user message
                db.execute(
                    'INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)',
                    (session_id, 'user', user_message)
                )
                # Save bot reply
                db.execute(
                    'INSERT INTO messages (session_id, sender, content) VALUES (?, ?, ?)',
                    (session_id, 'bot', bot_reply)
                )

                # Auto-update title from first message if still default
                if s['title'] == 'New Chat':
                    title = user_message[:50]
                    if len(user_message) > 50:
                        title += '...'
                    db.execute(
                        'UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        (title, session_id)
                    )
                else:
                    db.execute(
                        'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        (session_id,)
                    )

                db.commit()

        return jsonify({"reply": bot_reply})

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return jsonify({"error": "Failed to generate response."}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
