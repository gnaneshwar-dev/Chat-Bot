from flask import Flask, request, jsonify
import re
import spacy
import json
from datetime import datetime
import os
import uuid
from flask_cors import CORS
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask_sqlalchemy import SQLAlchemy


nlp = spacy.load('en_core_web_lg')

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app, resources={r"/get_answer": {"origins": "*", "methods": ["POST", "OPTIONS"]}})
with open('mcube.json', 'r') as f:
    responses = json.load(f)

app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:''@localhost/aichat'
#app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root:mcube%40admin123@10.0.0.124/AIchat'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class ChatConversation(db.Model):
    __tablename__ = 'chat_conversation'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), nullable=False)
    conversation = db.Column(db.Text, nullable=False)

    def __init__(self, user_id, conversation):
        self.user_id = user_id
        self.conversation = conversation

email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
awaiting_other_input = False
phoneverify = True
conversations = {}

def is_valid_email(email):
    """Check if the provided email is valid using regex."""
    return re.match(email_pattern, email)

def is_valid_phone(phone):
    """Check if the provided phone number is valid."""
    return phone.isdigit() and len(phone) in [10, 11]

def detect_intent(user_input):
    """Detect user intent based on the input using NLP."""
    doc = nlp(user_input.lower())
    intent = None

    if any(token.lemma_ in ['schedule'] for token in doc):
        intent = 'book_demo'
    elif any(token.lemma_ in ['talk',"expert"] for token in doc):
        intent = 'book_call'

    return intent

def send_mail(user_id,email_body):
    msg = MIMEMultipart()
    user_state = conversations[user_id] 
    recipient_email = "mailto:venkata.sudheer@mcube.com"
    msg['From'] = 'mailto:noreply@mcubemail.com'
    msg['To'] = recipient_email
    msg['Subject'] = 'Website Chatbot - MCUBE'

    email_body = f"""
    <p>Hi,{user_state['name']}</p>
    <p>Please find the details below:</p>
    <b>Email:</b> {user_state['email']}<br>
    <b>Phone:</b> {user_state['phone']}<br>
    <b>Details:</b>
    """
    
    for log in user_state['conversation_log']:
        email_body += f"""
        <p><strong>MCUBE System:</strong> {log['bot']}</p>
        <p><strong>{user_state['name']}:</strong> {log['user']}</p>
        <hr>
        """
    
    email_body += """
    """

    msg.attach(MIMEText(email_body, 'html'))

    try:
        smtp_host = 'email-smtp.us-east-1.amazonaws.com'
        smtp_port = 465
        smtp_user = 'AKIAUJVLLICOLBGNBZHV' 
        smtp_password = 'BNy8uBvRElGITJRVc/s6HWi9YEyj0v2DK1dhdQABKRkZ'  

        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_password) 
            server.send_message(msg)  

    except Exception as e:
        return {e}

    return True  

def handle_user_input(user_id, user_input):
    """Handles the user's input and determines the response."""
    global phoneverify
    user_state = conversations[user_id]
    intent = detect_intent(user_input)

    if intent == 'book_demo':
        response = responses['demo_booking'] + responses['goodbye']
        return response, False, False, "exit"
    elif intent == 'book_call':
        if user_state['phone'] is None:
            phoneverify = False
            response = "To connect with an expert, please provide your phone number"
            return response, False, False, False
        else:
            response = responses['demo_call'] + responses['goodbye']
            return response, False, False, "exit"
    elif user_state['name'] is None:
        user_state['name'] = user_input
        return responses['greeting'].format(name=user_state['name']), "Email,Phone Number", False, False
    elif user_state['email'] is None and user_state['phone'] is None:
        return handle_email_or_phone(user_id, user_input)
    elif not phoneverify:
        if is_valid_phone(user_input):
            response = responses['demo_call'] + responses['goodbye']
            return response, False, False, "exit"
        else:
            phoneverify = True
            return "Please provide your phone number.", False, False, False
    else:
        return handle_service_selection(user_input)    

def handle_email_or_phone(user_id, user_input):
    """Handles email or phone number input from the user."""
    user_state = conversations[user_id]
    if user_input.lower() == 'email':
        return "Please provide your email.", False, False, False
    elif user_input.lower() == 'phone number':
        return "Please provide your phone number.", False, False, False
    elif is_valid_email(user_input):
        user_state['email'] = user_input
        return responses['thank_you_email'].format(email=user_state['email']), False ,["IVRS", "Autodialer", "Inbound", "Outbound", "SMS", "Whatsapp","Others"], False
    elif is_valid_phone(user_input):
        user_state['phone'] = user_input
        return responses['thank_you_phone'].format(phone=user_state['phone']), False, ["IVRS", "Autodialer", "Inbound", "Outbound", "SMS", "Whatsapp","Others"], False
    return responses['invalid_input'], "Email,Phone Number", False, False

def handle_service_selection(user_input):
    """Handles the selection of services based on user input."""
    options = {"ivrs", "autodialer", "inbound", "outbound", "sms", "whatsapp","others"}
    if not user_input.strip():
        return "Could you please specify a service?", False, False, False
    user_inputs = {option.strip().lower() for option in user_input.split(",")}
    selected_service = user_inputs.intersection(options)
    global awaiting_other_input 
    if "others" in selected_service and not awaiting_other_input:
        awaiting_other_input = True
        return "Please provide more details about the specific service you are interested in.", False, False, False
    
    if awaiting_other_input:
        selected_service = {"others: " + user_input.strip().capitalize()}
        return responses['service_selection'].format(service=', '.join(selected_service)), "Schedule Demo,Talk to an Expert", False, False
    
    if selected_service:
        return responses['service_selection'].format(service=', '.join(selected_service)), "Schedule Demo,Talk to an Expert", False, False

    if user_input.lower() in ["ok", "alright", "thanks", "thank you"]:
        return "You're welcome! Let me know if you need further assistance.", False, False ,False

    return "I'm not confident about that. Could you please rephrase?", False, False, False

def save_conversation_to_db(user_id, conversation_log):
    """Save the conversation log to the chat_conversation table."""
    conversation_text = json.dumps(conversation_log)  # Convert log to JSON format to store as text
    new_conversation = ChatConversation(user_id=user_id, conversation=conversation_text)
    db.session.add(new_conversation)
    db.session.commit()

@app.route('/get_answer', methods=['POST'])
def chat():
    global user_id
    if not request.is_json:
        return jsonify({"response": "Invalid content type. Expected JSON.", "options": False}), 400

    user_input = request.get_json().get('question')
    user_id = request.get_json().get('user_id')
#  restart = request.get_json().get('restart', False)
    
    initial_response = "Welcome! How can I assist you today? May I know your name?"


    if not user_id:
        user_id = str(uuid.uuid4())

    if not user_input:
        return jsonify({"response": "Input is required.", "options": False}), 400
    
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if user_id not in conversations:
        conversations[user_id] = {
            'name': None,
            'email': None,
            'phone': None,
            'conversation_log': [{
                "user": user_input,
                "bot": initial_response,
                "options": False,
                "dropdownOptions": False,
                "time": current_time
            }],
            'prev_response': initial_response
        }
        response, options, dropdownOptions, exit = handle_user_input(user_id, user_input)
    else:
        conversations[user_id]['conversation_log'].append({
            "user": user_input,
            "bot": None,
            "time": current_time
        })
        response, options, dropdownOptions, exit = handle_user_input(user_id, user_input)
        

    if len(conversations[user_id]['conversation_log']) > 1:
        conversations[user_id]['conversation_log'][len(conversations[user_id]['conversation_log'])-1]["bot"] = conversations[user_id]['prev_response']
    conversations[user_id]['prev_response'] = response

    if exit == "exit":
        #send_mail(user_id,conversations)
        # conversation_text = json.dumps(conversations[user_id]['conversation_log'], indent=2)
        # chat_record = ChatConversation(user_id=user_id, conversation=conversation_text)
        # db.session.add(chat_record)
        # db.session.commit()
        save_conversation_to_db(user_id, conversations[user_id]['conversation_log'])
        conversations.pop(user_id, None)
    print(user_id)
    return jsonify({"response": response, "options": options, "dropdownOptions": dropdownOptions, "exit": exit,"user_id":user_id})

if __name__ == '__main__':
    app.run(debug=True)
