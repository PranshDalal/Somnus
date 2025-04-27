# Backend (Flask API) - app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os

app = Flask(__name__)
CORS(app)

openai.api_key = os.getenv("OPENAI_API_KEY") 

@app.route('/analyze_dream', methods=['POST'])
def analyze_dream():
    data = request.get_json()
    dream_text = data.get("dream")

    if not dream_text:
        return jsonify({"error": "No dream text provided"}), 400

    prompt = f"""
    A patient recorded the following dream:
    "{dream_text}"
    
    Analyze the dream and connect it to possible cognitive or neurological factors, referencing recent scientific or psychological findings. Correlate it to memory loops, anxiety, REM pattern disruption, and list any medications that might influence such dreams. Include references if possible.
    
    Give the output in:
    - Dream Summary
    - Cognitive/Emotional Interpretation
    - Relevant Research/Studies
    - Medication/Health Insights
    """

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",  
            messages=[
                {"role": "system", "content": "You are a neuroscience-aware dream analyst."},
                {"role": "user", "content": prompt}
            ]
        )

        return jsonify({"analysis": response["choices"][0]["message"]["content"]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

