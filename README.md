# Somnus - Perplexity for Dreams

Somnus is a web application designed to analyze dreams and provide insights into cognitive health, emotional well being, and memory patterns. It uses AI analysis to extract key features from user dreams and offers features for caregivers to monitor and assess the mental health of their patients.

## Features

### User Features
 - **Dream Analysis** - Users can submit their dreams and receive detailes analyses including memory and anxiety scores, key entities extracted from the dreams, and AI insights into cognitive health and emotional patterns.
 - **Dream History** - Users are able to view a history of their analyzed dreams with trends in memory and anxiety scores over time
 - **PDF Export** - Users are able to export their dream history and analysis into a sleek PDF file

### Caregiver Features
 - **Caregiver Access** - Caregivers can request access to monitor the dreams of other users
 - **Patient Dashboard** - Caregivers can view recent dream analyses and trends for their patients
 - **Patient Summary** - Caregivers can generate a clinical summary of a patient's recent dream patterns, including repetitive themes, emotions, and cognitive health indicators

### Additional Features
 - **Gen Z Mode** - Analyze dreams with fun Gen Z sland
 - **Authentication** - User authentication with JWT tokens

## Technologies Used

### Frontend
 - **React** for building the user interface
 - **Material-UI** for modern and responsive UI
 - **Recharts** for visualizing trends
 - **Axios** for making API requests

### Backend
 - **Flask** for building the API
 - **Flask-SQLAlchemy** for database management
 - **Flask-CORS** for cross-origin requests
 - **FPDF** for PDF exports
 - **PyJWT** for secure authentication
 - **Perplexity's Sonar** for dream analysis

### Database
 - **SQLite** for creating a lightweight database to store user data

## Setup and Installigation

### Prereqs
 - Node.js and npm
 - Python 3.8+

### Frontend setup
1. Navigate to `client` directory
2. Install dependencies
3. Start the development server

### Backend setup
1. Navigate to `server` directory
2. Create a virtual environment
3. Activate virtual environment
4. Install dependencies
5. Start the server

## Usage
### Dream Analysis
1. Login or register a new account
2. Navigate to the "Analyze Dream" tab
3. Enter your dream and click "Analyze Dream"
4. View the analysis results
5. Check out your dream history to view trends and export as a pdf

### Caregiver Features
1. Request access to monitor a patient from the "Settings and Requests" tab
2. Once approved, view patient data in the "Caregiver View" tab

Have fun!! 
> "Dream big dreams!" - Buster Moon from Sing

