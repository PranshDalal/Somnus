from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import requests
import jwt
import datetime
from datetime import timezone
from functools import wraps
import io
from fpdf import FPDF
import re
from werkzeug.security import generate_password_hash, check_password_hash
import enum
import json
import os

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///dreams.db'
db = SQLAlchemy(app)


SONAR_API_URL = "https://api.perplexity.ai/chat/completions"
SONAR_API_KEY = os.getenv('SONAR_API_KEY')

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

def call_sonar(prompt, is_gen_z_mode=False):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }
    
    if is_gen_z_mode:
        system_content = "You are a helpful assistant who analyzes dreams. Respond in a Gen Z slang format, keeping it chill and maybe a bit ironic. Analyze the cognitive health impacts, key entities (people, places, objects), and associated emotions, but make it sound like you're explaining it to a friend using current internet slang. Keep it concise and vibey, like low-key helpful but also kinda funny. Bet."
    else:
        system_content = "Provide a detailed cognitive health analysis of the dream, including key entities (people, places, objects) and associated emotions."

    payload = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt}
        ]
    }
    try:
        response = requests.post(SONAR_API_URL, json=payload, headers=headers, timeout=60)
        if response.status_code == 200:
            response_data = response.json()
            if response_data and 'choices' in response_data and len(response_data['choices']) > 0:
                message_content = response_data['choices'][0].get('message', {}).get('content')
                if message_content:
                    return message_content
                else:
                    print("Sonar response message content is empty.")
                    return None
            else:
                print(f"Unexpected Sonar API response structure: {response_data}")
                return None
        else:
            print(f"Sonar API call failed with status code: {response.status_code}")
            try:
                print(f"Sonar API response body: {response.text}")
            except Exception as e:
                print(f"Could not read Sonar API response body: {e}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error calling Sonar API: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding Sonar API JSON response: {e}")
        try:
            print(f"Raw response text: {response.text}")
        except:
             print("Raw response text could not be read.")
        return None

def extract_tags(text):
    sonar_tags_response = call_sonar(f"Extract people, places, and emotions from this dream: {text}")
    if sonar_tags_response and isinstance(sonar_tags_response, dict):
        people = sonar_tags_response.get('people', '') or ''
        places = sonar_tags_response.get('places', '') or ''
        emotions = sonar_tags_response.get('emotions', '') or ''
        return {
            'people': people,
            'places': places,
            'emotions': emotions
        }
    else:
        print(f"Failed to extract tags or received unexpected response: {sonar_tags_response}")
        return {'people': '', 'places': '', 'emotions': ''}

def generate_pdf(dreams):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    pdf.set_font("Arial", 'B', 16)
    pdf.cell(0, 10, "Dream Analysis Report", 0, 1, 'C')
    pdf.ln(10)

    for dream in dreams:
        pdf.set_font("Arial", 'B', 12)
        pdf.cell(0, 10, f"Date: {dream.created_at.strftime('%Y-%m-%d')}", 0, 1)

        pdf.set_font("Arial", 'I', 11)
        dream_text_encoded = dream.dream_text.encode('latin-1', 'replace').decode('latin-1')
        pdf.multi_cell(0, 5, f"Dream: {dream_text_encoded}")
        pdf.ln(5)

        pdf.set_font("Arial", '', 10)
        analysis_text = str(dream.sonar_analysis) if dream.sonar_analysis else 'No analysis available.'
        analysis_text = analysis_text.replace('**', '').replace('###', '').replace('* ', '  - ')
        analysis_text = re.sub(r'\[\d+\]', '', analysis_text)
        analysis_text = re.sub(r'\|.*\|', '', analysis_text)
        analysis_text = re.sub(r'\n{2,}', '\n\n', analysis_text).strip()

        analysis_encoded = analysis_text.encode('latin-1', 'replace').decode('latin-1')
        pdf.set_font("Arial", 'B', 11)
        pdf.cell(0, 10, "Analysis:", 0, 1)
        pdf.set_font("Arial", '', 10)
        pdf.multi_cell(0, 5, analysis_encoded)
        pdf.ln(5)

        pdf.set_font("Arial", '', 10)
        pdf.cell(0, 8, f"Memory Score: {dream.memory_score*100:.0f}%", 0, 0)
        pdf.cell(0, 8, f"Anxiety Score: {dream.anxiety_score*100:.0f}%", 0, 1, 'R')
        pdf.ln(5)

        pdf.set_draw_color(180, 180, 220)
        pdf.line(pdf.get_x(), pdf.get_y(), pdf.get_x() + 190, pdf.get_y())
        pdf.ln(10)

    pdf_bytes = pdf.output(dest='S').encode('latin-1')
    pdf_output = io.BytesIO()
    pdf_output.write(pdf_bytes)
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
            'exp': datetime.datetime.now(timezone.utc) + datetime.timedelta(hours=12)
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
    try:
        data = request.get_json()
        dream_text = data.get('dream_text')
        is_gen_z_mode = data.get('is_gen_z_mode', False)

        if not dream_text:
            return jsonify({'error': 'Dream text is required'}), 400

        print(f"Analyzing dream for user {current_user.user_id} (Gen Z Mode: {is_gen_z_mode}): {dream_text[:50]}...")

        analysis_prompt = f"Analyze the cognitive health impacts of the following dream, identify key entities (people, places, objects), and associated emotions. Dream text: {dream_text}"

        raw_analysis_content = call_sonar(analysis_prompt, is_gen_z_mode=is_gen_z_mode)

        print(f"Sonar analysis raw response (Gen Z Mode: {is_gen_z_mode}): {raw_analysis_content}")

        if not raw_analysis_content:
            print("Sonar analysis failed or returned empty content.")
            return jsonify({'error': 'Analysis failed'}), 500


        analysis_text = raw_analysis_content
        people_tag = ''
        places_tag = ''
        emotions_list = []

        try:
            entity_section_match = re.search(r"(\*\*Key Entities\*\*|\*\*Scores\*\*|Key Entities:|Scores:|\| Category\s*\|)", raw_analysis_content, re.IGNORECASE)
            if entity_section_match:
                analysis_text = raw_analysis_content[:entity_section_match.start()].strip()
            elif re.search(r"^(?:People|Places|Emotions|Scores|Memory|Anxiety):", raw_analysis_content, re.MULTILINE | re.IGNORECASE):
                 first_marker_match = re.search(r"^(?:People|Places|Emotions|Scores|Memory|Anxiety):", raw_analysis_content, re.MULTILINE | re.IGNORECASE)
                 if first_marker_match:
                     analysis_text = raw_analysis_content[:first_marker_match.start()].strip()


            table_rows = re.findall(r"\|\s*(People|Places|Objects)\s*\|\s*(.*?)\s*\|(?:.*?\|)?", raw_analysis_content, re.IGNORECASE | re.DOTALL)
            if table_rows:
                for category, entities in table_rows:
                    entities = entities.strip()
                    if category.lower() == 'people': people_tag = entities
                    elif category.lower() == 'places': places_tag = entities
            else:
                people_match = re.search(r"^(?:People|Persons|Characters):\s*(.*?)$", raw_analysis_content, re.MULTILINE | re.IGNORECASE)
                if people_match: people_tag = people_match.group(1).strip()

                places_match = re.search(r"^(?:Places|Locations|Settings):\s*(.*?)$", raw_analysis_content, re.MULTILINE | re.IGNORECASE)
                if places_match: places_tag = places_match.group(1).strip()

            emotions_match = re.search(r"^(?:Emotions|Feelings|Vibes):\s*(.*?)$", raw_analysis_content, re.MULTILINE | re.IGNORECASE)
            if emotions_match:
                emotions_list = [e.strip() for e in re.split(r',|\band\b', emotions_match.group(1)) if e.strip()]

            emotions_tag = ', '.join(filter(None, emotions_list))

            memory_score_val = None
            anxiety_score_val = None
            memory_match = re.search(r"(?:Memory Score|Memory vibe|Recall level|Remembering):\s*(\d+)\s*/\s*10", raw_analysis_content, re.IGNORECASE)
            anxiety_match = re.search(r"(?:Anxiety Score|Stress level|Vibe check \(anxiety\)|Worry meter):\s*(\d+)\s*/\s*10", raw_analysis_content, re.IGNORECASE)
            if memory_match: memory_score_val = float(memory_match.group(1)) / 10.0
            if anxiety_match: anxiety_score_val = float(anxiety_match.group(1)) / 10.0

            if memory_score_val is None:
                memory_match_perc = re.search(r"(?:Memory Score|Memory vibe|Recall level|Remembering):\s*(\d+)%", raw_analysis_content, re.IGNORECASE)
                if memory_match_perc: memory_score_val = float(memory_match_perc.group(1)) / 100.0
            if anxiety_score_val is None:
                anxiety_match_perc = re.search(r"(?:Anxiety Score|Stress level|Vibe check \(anxiety\)|Worry meter):\s*(\d+)%", raw_analysis_content, re.IGNORECASE)
                if anxiety_match_perc: anxiety_score_val = float(anxiety_match_perc.group(1)) / 100.0

        except Exception as parse_error:
            print(f"Could not fully parse response structure: {parse_error}. Using raw analysis and default scores.")
            analysis_text = raw_analysis_content
            memory_score_val = None
            anxiety_score_val = None
            people_tag = ''
            places_tag = ''
            emotions_tag = ''


        if memory_score_val is None:
            memory_score_val = min(1.0, len(dream_text) / 500)
            print("Falling back to default memory score calculation.")
        if anxiety_score_val is None:
            anxiety_score_val = 1.0 - memory_score_val
            print("Falling back to default anxiety score calculation.")

        final_tags = {'people': people_tag, 'places': places_tag, 'emotions': emotions_tag}
        print(f"Extracted analysis (Gen Z Mode: {is_gen_z_mode}): {analysis_text[:100]}...")
        print(f"Extracted tags: {final_tags}")
        print(f"Extracted scores: Memory={memory_score_val}, Anxiety={anxiety_score_val}")

        new_dream = Dream(
            user_id=current_user.user_id,
            dream_text=dream_text,
            sonar_analysis=analysis_text,
            memory_score=memory_score_val,
            anxiety_score=anxiety_score_val
        )
        db.session.add(new_dream)
        db.session.flush()

        metadata = DreamMetadata(
            dream_id=new_dream.id,
            people=people_tag,
            places=places_tag,
            emotions=emotions_tag
        )
        db.session.add(metadata)
        db.session.commit()
        print(f"Dream and metadata saved successfully for dream ID {new_dream.id}")

        return jsonify({'analysis': {'analysis': analysis_text}, 'tags': final_tags, 'scores': {'memory': memory_score_val, 'anxiety': anxiety_score_val}}), 200

    except Exception as e:
        import traceback
        print(f"Error in /api/dream/analyze: {e}")
        print(traceback.format_exc())
        db.session.rollback()
        return jsonify({'error': 'An internal server error occurred during analysis processing'}), 500

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
    try:
        dreams = Dream.query.filter_by(user_id=current_user.user_id).order_by(Dream.created_at.desc()).all()
        if not dreams:
            return jsonify({"message": "No dreams to export"}), 404
        
        pdf_file = generate_pdf(dreams)
        return send_file(
            pdf_file, 
            as_attachment=True, 
            download_name='dreams_report.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        import traceback
        print(f"Error in /api/dream/export/pdf: {e}")
        print(traceback.format_exc())
        return jsonify({'error': 'Failed to generate PDF report'}), 500

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
