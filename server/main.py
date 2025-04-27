from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import requests
import jwt
import datetime
from functools import wraps
import io
from fpdf import FPDF
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key'  # Change this!
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///dreams.db'
db = SQLAlchemy(app)

SONAR_API_URL = "https://api.perplexity.ai/sonar"
SONAR_API_KEY = "your_sonar_api_key_here"

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(200))
    caregiver = db.Column(db.Boolean, default=False)

class Dream(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100))
    dream_text = db.Column(db.Text)
    sonar_analysis = db.Column(db.Text)
    memory_score = db.Column(db.Float)
    anxiety_score = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class DreamMetadata(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    dream_id = db.Column(db.Integer, db.ForeignKey('dream.id'))
    people = db.Column(db.Text)
    places = db.Column(db.Text)
    emotions = db.Column(db.Text)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.filter_by(user_id=data['user_id']).first()
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def call_sonar(prompt):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "query": prompt,
        "options": {"citations": True}
    }
    response = requests.post(SONAR_API_URL, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        return None

def extract_tags(text):
    sonar_tags = call_sonar(f"Extract people, places, and emotions from this dream: {text}")
    if sonar_tags:
        return {
            'people': sonar_tags.get('people', ''),
            'places': sonar_tags.get('places', ''),
            'emotions': sonar_tags.get('emotions', '')
        }
    else:
        return {'people': '', 'places': '', 'emotions': ''}

def generate_pdf(dreams):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    
    for dream in dreams:
        pdf.cell(200, 10, txt=f"Date: {dream.created_at.strftime('%Y-%m-%d')}", ln=True)
        pdf.multi_cell(0, 10, f"Dream: {dream.dream_text}")
        pdf.multi_cell(0, 10, f"Analysis: {dream.sonar_analysis}")
        pdf.cell(0, 10, "-" * 100, ln=True)
    
    pdf_output = io.BytesIO()
    pdf.output(pdf_output)
    pdf_output.seek(0)
    return pdf_output

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    user_id = data.get('user_id')
    password = data.get('password')
    caregiver = data.get('caregiver', False)

    if not user_id or not password:
        return jsonify({'error': 'Missing credentials'}), 400

    hashed_password = generate_password_hash(password)
    new_user = User(user_id=user_id, password_hash=hashed_password, caregiver=caregiver)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user_id = data.get('user_id')
    password = data.get('password')

    user = User.query.filter_by(user_id=user_id).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = jwt.encode(
        {'user_id': user.user_id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)},
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )
    return jsonify({'token': token}), 200

@app.route('/api/dream/analyze', methods=['POST'])
@token_required
def analyze_dream(current_user):
    data = request.get_json()
    dream_text = data.get('dream_text')

    if not dream_text:
        return jsonify({'error': 'Dream text is required'}), 400

    analysis = call_sonar(f"Analyze cognitive health impacts for dream: {dream_text}")
    if not analysis:
        return jsonify({'error': 'Sonar analysis failed'}), 500

    tags = extract_tags(dream_text)

    memory_score = min(1.0, len(dream_text) / 500)
    anxiety_score = 1.0 - memory_score

    new_dream = Dream(
        user_id=current_user.user_id,
        dream_text=dream_text,
        sonar_analysis=str(analysis),
        memory_score=memory_score,
        anxiety_score=anxiety_score
    )
    db.session.add(new_dream)
    db.session.commit()

    metadata = DreamMetadata(
        dream_id=new_dream.id,
        people=tags['people'],
        places=tags['places'],
        emotions=tags['emotions']
    )
    db.session.add(metadata)
    db.session.commit()

    return jsonify({'analysis': analysis, 'tags': tags}), 200

@app.route('/api/dream/history', methods=['GET'])
@token_required
def get_dream_history(current_user):
    dreams = Dream.query.filter_by(user_id=current_user.user_id).order_by(Dream.created_at.desc()).all()
    output = []
    for dream in dreams:
        metadata = DreamMetadata.query.filter_by(dream_id=dream.id).first()
        output.append({
            'dream_text': dream.dream_text,
            'sonar_analysis': dream.sonar_analysis,
            'created_at': dream.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            'memory_score': dream.memory_score,
            'anxiety_score': dream.anxiety_score,
            'tags': {
                'people': metadata.people if metadata else '',
                'places': metadata.places if metadata else '',
                'emotions': metadata.emotions if metadata else ''
            }
        })
    return jsonify(output), 200

@app.route('/api/dream/export/pdf', methods=['GET'])
@token_required
def export_pdf(current_user):
    dreams = Dream.query.filter_by(user_id=current_user.user_id).order_by(Dream.created_at.desc()).all()
    pdf_file = generate_pdf(dreams)
    return send_file(pdf_file, as_attachment=True, download_name='dreams_report.pdf')

@app.route('/api/caregiver/summary', methods=['GET'])
@token_required
def caregiver_summary(current_user):
    if not current_user.caregiver:
        return jsonify({'error': 'Unauthorized'}), 403

    dreams = Dream.query.order_by(Dream.created_at.desc()).limit(10).all()
    output = []
    for dream in dreams:
        output.append({
            'user_id': dream.user_id,
            'dream_summary': dream.sonar_analysis,
            'date': dream.created_at.strftime("%Y-%m-%d")
        })
    return jsonify(output), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
