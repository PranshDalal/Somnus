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
import enum

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///dreams.db'
db = SQLAlchemy(app)

SONAR_API_URL = "https://api.perplexity.ai/sonar"
SONAR_API_KEY = "your_sonar_api_key_here"

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

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

class RelationshipStatus(enum.Enum):
    PENDING = 'pending'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'

class CaregiverRelationship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    caregiver_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    patient_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.Enum(RelationshipStatus), default=RelationshipStatus.PENDING, nullable=False)
    requested_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    responded_at = db.Column(db.DateTime, nullable=True)

    caregiver = db.relationship('User', foreign_keys=[caregiver_user_id], backref='caring_for_relationships')
    patient = db.relationship('User', foreign_keys=[patient_user_id], backref='caregivers_relationships')

    db.UniqueConstraint('caregiver_user_id', 'patient_user_id', name='uq_caregiver_patient')


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
            current_user = User.query.get(data['user_db_id'])
            if not current_user:
                 return jsonify({'message': 'User not found!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
             print(f"Token validation error: {e}")
             return jsonify({'message': 'Token validation failed!'}), 401
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
    user_id_str = data.get('user_id')
    password = data.get('password')

    if not user_id_str or not password:
        return jsonify({'error': 'Missing credentials'}), 400

    if User.query.filter_by(user_id=user_id_str).first():
        return jsonify({'error': 'User ID already exists'}), 409

    hashed_password = generate_password_hash(password)
    new_user = User(user_id=user_id_str, password_hash=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user_id_str = data.get('user_id')
    password = data.get('password')

    user = User.query.filter_by(user_id=user_id_str).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401

    cared_for_relationships = CaregiverRelationship.query.filter_by(
        caregiver_user_id=user.id, status=RelationshipStatus.ACCEPTED
    ).all()
    cared_for_users = [{'id': rel.patient.id, 'user_id': rel.patient.user_id} for rel in cared_for_relationships]

    pending_requests_to_user = CaregiverRelationship.query.filter_by(
        patient_user_id=user.id, status=RelationshipStatus.PENDING
    ).all()
    pending_requests = [{'request_id': req.id, 'caregiver_user_id': req.caregiver.user_id} for req in pending_requests_to_user]


    token = jwt.encode(
        {
            'user_db_id': user.id,
            'user_id': user.user_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=12)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )
    return jsonify({
        'token': token,
        'user_id': user.user_id,
        'cared_for_users': cared_for_users,
        'pending_requests': pending_requests
     }), 200

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


@app.route('/api/caregiver/request', methods=['POST'])
@token_required
def request_caregiver_access(current_user):
    data = request.get_json()
    patient_user_id_str = data.get('patient_user_id')

    if not patient_user_id_str:
        return jsonify({'error': 'Patient User ID is required'}), 400

    patient_user = User.query.filter_by(user_id=patient_user_id_str).first()

    if not patient_user:
        return jsonify({'error': 'Patient user not found'}), 404

    if patient_user.id == current_user.id:
        return jsonify({'error': 'Cannot request caregiver access for yourself'}), 400

    existing_request = CaregiverRelationship.query.filter_by(
        caregiver_user_id=current_user.id,
        patient_user_id=patient_user.id
    ).first()

    if existing_request:
        if existing_request.status == RelationshipStatus.PENDING:
             return jsonify({'message': 'Request already pending'}), 409
        elif existing_request.status == RelationshipStatus.ACCEPTED:
             return jsonify({'message': 'Caregiver access already granted'}), 409
        else:
             return jsonify({'message': 'A previous request was rejected'}), 409


    new_request = CaregiverRelationship(
        caregiver_user_id=current_user.id,
        patient_user_id=patient_user.id,
        status=RelationshipStatus.PENDING
    )
    db.session.add(new_request)
    db.session.commit()

    return jsonify({'message': 'Caregiver request sent successfully'}), 201


@app.route('/api/caregiver/requests/pending', methods=['GET'])
@token_required
def get_pending_requests(current_user):
    pending_requests_to_user = CaregiverRelationship.query.filter_by(
        patient_user_id=current_user.id,
        status=RelationshipStatus.PENDING
    ).join(User, CaregiverRelationship.caregiver_user_id == User.id)\
     .add_columns(User.user_id.label('caregiver_user_id_str'), CaregiverRelationship.id.label('request_id'))\
     .all()

    output = [{'request_id': req.request_id, 'caregiver_user_id': req.caregiver_user_id_str} for req in pending_requests_to_user]
    return jsonify(output), 200


@app.route('/api/caregiver/requests/respond', methods=['POST'])
@token_required
def respond_to_request(current_user):
    data = request.get_json()
    request_id = data.get('request_id')
    action = data.get('action')

    if not request_id or action not in ['accept', 'reject']:
        return jsonify({'error': 'Missing request_id or invalid action'}), 400

    relationship_request = CaregiverRelationship.query.filter_by(
        id=request_id,
        patient_user_id=current_user.id,
        status=RelationshipStatus.PENDING
    ).first()

    if not relationship_request:
        return jsonify({'error': 'Request not found or already responded to'}), 404

    if action == 'accept':
        relationship_request.status = RelationshipStatus.ACCEPTED
    else:
        relationship_request.status = RelationshipStatus.REJECTED

    relationship_request.responded_at = datetime.datetime.utcnow()
    db.session.commit()

    return jsonify({'message': f'Request {action}ed successfully'}), 200


@app.route('/api/caregiver/cared_for', methods=['GET'])
@token_required
def get_cared_for_users(current_user):
    cared_for_relationships = CaregiverRelationship.query.filter_by(
        caregiver_user_id=current_user.id, status=RelationshipStatus.ACCEPTED
    ).join(User, CaregiverRelationship.patient_user_id == User.id)\
     .add_columns(User.id.label('patient_db_id'), User.user_id.label('patient_user_id_str'))\
     .all()

    output = [{'id': rel.patient_db_id, 'user_id': rel.patient_user_id_str} for rel in cared_for_relationships]
    return jsonify(output), 200



@app.route('/api/caregiver/summary', methods=['GET'])
@token_required
def caregiver_summary(current_user):
    accepted_relationships = CaregiverRelationship.query.filter_by(
        caregiver_user_id=current_user.id,
        status=RelationshipStatus.ACCEPTED
    ).all()

    if not accepted_relationships:
        return jsonify([]), 200

    patient_ids = [rel.patient_user_id for rel in accepted_relationships]
    patient_user_map = {user.id: user.user_id for user in User.query.filter(User.id.in_(patient_ids)).all()}


    dreams = Dream.query.filter(Dream.user_id.in_(
         [patient_user_map[pid] for pid in patient_ids if pid in patient_user_map]
    )).order_by(Dream.created_at.desc()).limit(50).all()


    output = []
    for dream in dreams:
         patient_internal_id = next((pid for pid, uid_str in patient_user_map.items() if uid_str == dream.user_id), None)
         if patient_internal_id:
             output.append({
                 'patient_user_id': dream.user_id,
                 'dream_summary': dream.sonar_analysis,
                 'date': dream.created_at.strftime("%Y-%m-%d"),
                 'memory_score': dream.memory_score,
                 'anxiety_score': dream.anxiety_score
             })

    return jsonify(output), 200


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
