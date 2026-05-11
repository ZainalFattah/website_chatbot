import os
from flask import Flask, request, jsonify, render_template
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Configure Gemini API
# Make sure to set GEMINI_API_KEY in your .env file
gemini_api_key = os.getenv("GEMINI_API_KEY")

if gemini_api_key:
    genai.configure(api_key=gemini_api_key)
    # Use a lightweight model. For text, gemini-pro is standard,
    # but gemini-1.5-flash is newer and very fast/light.
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None
    print("Warning: GEMINI_API_KEY is not set.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    if not model:
         return jsonify({"error": "Gemini API key is missing on the server."}), 500

    data = request.json
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided."}), 400

    user_message = data['message']

    try:
        # Generate response without keeping history (stateless)
        response = model.generate_content(user_message)
        bot_reply = response.text
        return jsonify({"reply": bot_reply})
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return jsonify({"error": "Failed to generate response."}), 500

if __name__ == '__main__':
    # Run the app locally on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
