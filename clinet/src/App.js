import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Box, Typography, TextField, Button, Paper, CircularProgress, Grid, 
  Tabs, Tab, Card, CardContent, Chip, LinearProgress, AppBar, Toolbar, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, List, ListItem,
  ListItemText, ListItemSecondaryAction, Divider, Alert
} from '@mui/material';
import { styled } from '@mui/system';
import { 
  Nightlight, Psychology, Timeline, History, CloudDownload, Login, 
  PersonAdd, ExitToApp, MenuBook, Settings, Notifications, CheckCircle, Cancel
} from '@mui/icons-material';

const DreamBackground = styled('div')({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #111133 0%, #2c2c54 100%)',
  padding: '20px 0',
  color: '#fff'
});

const StyledBox = styled(Box)(({
  backgroundColor: 'rgba(28, 28, 44, 0.8)',
  color: '#fff',
  borderRadius: '15px',
  padding: '30px',
  boxShadow: '0px 4px 20px rgba(90, 90, 255, 0.2)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(150, 150, 255, 0.2)',
}));

const StyledButton = styled(Button)(({
  backgroundColor: '#7e57c2',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(126, 87, 194, 0.3)',
  '&:hover': {
    backgroundColor: '#5e35b1',
  },
  transition: 'all 0.3s ease',
}));

const DreamCard = styled(Card)(({
  backgroundColor: 'rgba(40, 40, 80, 0.9)',
  color: '#fff',
  boxShadow: '0px 6px 16px rgba(80, 64, 170, 0.3)',
  marginBottom: '20px',
  borderRadius: '12px',
  border: '1px solid rgba(150, 150, 255, 0.2)',
  transition: 'transform 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
  }
}));

const EmotionChip = styled(Chip)(({
  margin: '4px',
  backgroundColor: 'rgba(126, 87, 194, 0.2)',
  color: '#bb86fc',
  border: '1px solid #bb86fc',
}));

const PersonChip = styled(Chip)(({
  margin: '4px',
  backgroundColor: 'rgba(3, 218, 198, 0.2)',
  color: '#03dac6',
  border: '1px solid #03dac6',
}));

const PlaceChip = styled(Chip)(({
  margin: '4px',
  backgroundColor: 'rgba(255, 215, 64, 0.2)',
  color: '#ffd740',
  border: '1px solid #ffd740',
}));

const StyledTextField = styled(TextField)(({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(150, 150, 255, 0.5)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(150, 150, 255, 0.8)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#7e57c2',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
}));

const App = () => {
  const [dreamText, setDreamText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [dreamHistory, setDreamHistory] = useState([]);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [isCaregiver, setIsCaregiver] = useState(false);
  const [summaryData, setSummaryData] = useState([]);
  const [caredForUsers, setCaredForUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [patientUserIdToRequest, setPatientUserIdToRequest] = useState('');

  const settingsTabIndex = isCaregiver ? 3 : 2;

  useEffect(() => {
    const savedToken = localStorage.getItem('dreamToken');
    const savedUserId = localStorage.getItem('dreamUserId');
    if (savedToken && savedUserId) {
      setToken(savedToken);
      setUserId(savedUserId);
      setIsLoggedIn(true);
      fetchUserProfile(savedToken);
      fetchPendingRequests(savedToken);
    }
  }, []);

  const handleTabChange = (event, newValue) => {
    console.log(`Tab changed. New value: ${newValue}, isLoggedIn: ${isLoggedIn}, isCaregiver: ${isCaregiver}, settingsTabIndex: ${settingsTabIndex}`);
    setTabValue(newValue);
    setError('');
    setSuccessMessage('');
    if (newValue === 1 && isLoggedIn) {
      console.log('Fetching dream history...');
      fetchDreamHistory(token);
    }
    if (newValue === 2 && isLoggedIn && isCaregiver) {
      console.log('Fetching caregiver summary...');
      fetchCaregiverSummary(token);
    }
    if (newValue === settingsTabIndex && isLoggedIn) {
      console.log('Fetching pending requests and user profile for settings tab...');
      fetchPendingRequests(token);
      fetchUserProfile(token);
    }
  };

  const fetchUserProfile = async (authToken) => {
    setError('');
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/caregiver/cared_for', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const currentlyCaredFor = response.data || [];
      setCaredForUsers(currentlyCaredFor);
      setIsCaregiver(currentlyCaredFor.length > 0);

      const loginData = JSON.parse(localStorage.getItem('dreamLoginData') || '{}');
      loginData.cared_for_users = currentlyCaredFor;
      localStorage.setItem('dreamLoginData', JSON.stringify(loginData));

    } catch (error) {
      console.error('Failed to fetch cared-for users', error);
      setError('Could not load the list of users you care for.');
      setCaredForUsers([]);
      setIsCaregiver(false);
    }
  };


  const handleSubmit = async () => {
    if (!dreamText) {
      setError('Please enter a dream!');
      return;
    }
    
    if (!isLoggedIn) {
      setError('Please log in to analyze your dream!');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/dream/analyze', 
        { dream_text: dreamText }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnalysis(response.data);
    } catch (error) {
      setError('Unable to analyze your dream. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setSuccessMessage('');
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/auth/login', {
        user_id: userId,
        password: password
      });
      
      const { token: newToken, user_id: loggedInUserId, cared_for_users, pending_requests } = response.data;

      setToken(newToken);
      setUserId(loggedInUserId);
      setIsLoggedIn(true);
      setCaredForUsers(cared_for_users || []);
      setPendingRequests(pending_requests || []);
      setIsCaregiver((cared_for_users || []).length > 0);

      localStorage.setItem('dreamToken', newToken);
      localStorage.setItem('dreamUserId', loggedInUserId);
      localStorage.setItem('dreamLoginData', JSON.stringify({ cared_for_users, pending_requests }));

      setLoginDialogOpen(false);
      setPassword('');
      setSuccessMessage('Login successful!');
      fetchDreamHistory(newToken);

    } catch (error) {
      setError('Login failed. Check your credentials.');
      console.error("Login error:", error.response?.data || error.message);
    }
  };

  const handleRegister = async () => {
    setError('');
    setSuccessMessage('');
    try {
      await axios.post('http://127.0.0.1:5000/api/auth/register', {
        user_id: userId,
        password: password,
      });
      setRegisterDialogOpen(false);
      setPassword('');
      setSuccessMessage('Registration successful! Please log in.');
      setLoginDialogOpen(true);
    } catch (error) {
      setError(error.response?.data?.error || 'Registration failed. User ID might already be taken.');
      console.error("Registration error:", error.response?.data || error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dreamToken');
    localStorage.removeItem('dreamUserId');
    localStorage.removeItem('dreamLoginData');
    setToken('');
    setIsLoggedIn(false);
    setUserId('');
    setPassword('');
    setDreamHistory([]);
    setSummaryData([]);
    setIsCaregiver(false);
    setCaredForUsers([]);
    setPendingRequests([]);
    setAnalysis(null);
    setError('');
    setSuccessMessage('');
    setTabValue(0);
  };

  const fetchDreamHistory = async (authToken) => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/dream/history', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setDreamHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch dream history', error);
    }
  };

 const fetchCaregiverSummary = async (authToken) => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/caregiver/summary', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setSummaryData(response.data);
    } catch (error) {
      console.error('Failed to fetch caregiver summary', error);
      setError('Could not load caregiver data.');
      setSummaryData([]);
    }
  };

  const fetchPendingRequests = async (authToken) => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/caregiver/requests/pending', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPendingRequests(response.data || []);
    } catch (error) {
      console.error('Failed to fetch pending requests', error);
      setError('Could not load pending caregiver requests.');
    }
  };

  const handleRequestAccess = async () => {
    if (!patientUserIdToRequest) {
      setError('Please enter the User ID of the person you wish to care for.');
      return;
    }
    setError('');
    setSuccessMessage('');
    try {
      await axios.post('http://127.0.0.1:5000/api/caregiver/request',
        { patient_user_id: patientUserIdToRequest },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMessage(`Request sent to ${patientUserIdToRequest}.`);
      setPatientUserIdToRequest('');
    } catch (error) {
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to send caregiver request.');
      console.error("Request access error:", error.response?.data || error.message);
    }
  };

  const handleRespondToRequest = async (requestId, action) => {
    setError('');
    setSuccessMessage('');
    try {
      await axios.post('http://127.0.0.1:5000/api/caregiver/requests/respond',
        { request_id: requestId, action: action }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccessMessage(`Request ${action}ed successfully.`);
      fetchPendingRequests(token);
      fetchUserProfile(token);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to respond to request.');
      console.error("Respond request error:", error.response?.data || error.message);
    }
  };


  const exportPDF = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/api/dream/export/pdf', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'dreams_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export PDF', error);
      setError('Failed to export PDF');
    }
  };

  return (
    <DreamBackground>
      <AppBar position="static" style={{ backgroundColor: 'rgba(28, 28, 44, 0.9)', marginBottom: '20px' }}>
        <Toolbar>
          <Nightlight style={{ marginRight: '10px' }} />
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Dream Analyzer {isCaregiver && '(Caregiver)'}
          </Typography>
          {isLoggedIn ? (
            <>
              <Avatar sx={{ bgcolor: '#7e57c2', marginRight: '10px' }}>
                {userId.charAt(0).toUpperCase()}
              </Avatar>
              <Typography sx={{ mr: 2 }}>{userId}</Typography>
              <Button color="inherit" onClick={handleLogout} startIcon={<ExitToApp />}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={() => setLoginDialogOpen(true)} startIcon={<Login />}>
                Login
              </Button>
              <Button color="inherit" onClick={() => setRegisterDialogOpen(true)} startIcon={<PersonAdd />}>
                Register
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: '#bb86fc' } }}
          sx={{ mb: 4, background: 'rgba(28, 28, 44, 0.6)', borderRadius: '10px' }}
        >
          <Tab icon={<Psychology />} label="Analyze Dream" />
          <Tab icon={<History />} label="Dream History" />
          {isCaregiver && <Tab icon={<MenuBook />} label="Caregiver View" />}
          {isLoggedIn && <Tab icon={<Settings />} label="Settings & Requests" />}
        </Tabs>

        {tabValue === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <StyledBox>
                <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 'bold', textShadow: '0 0 10px rgba(150, 150, 255, 0.5)' }}>
                  Dream Analyzer 
                </Typography>
                <Typography variant="body1" paragraph sx={{ opacity: 0.8, mb: 4 }}>
                  Record your dreams and gain insights into your cognitive health. Our AI analyzes your dreams for patterns related to memory, anxiety, and emotional well-being.
                </Typography>
                <StyledTextField
                  fullWidth
                  multiline
                  rows={6}
                  variant="outlined"
                  label="Enter Your Dream"
                  value={dreamText}
                  onChange={(e) => setDreamText(e.target.value)}
                  sx={{ mb: 3, input: { color: '#fff' } }}
                />
                {error && <Typography color="error" align="center" sx={{ mb: 2 }}>{error}</Typography>}
                <StyledButton 
                  fullWidth 
                  onClick={handleSubmit} 
                  disabled={loading}
                  size="large"
                  startIcon={<Psychology />}
                  sx={{ py: 1.5 }}
                >
                  {loading ? <CircularProgress color="inherit" size={24} /> : 'Analyze Dream'}
                </StyledButton>
              </StyledBox>
            </Grid>

            <Grid item xs={12} md={6}>
              {analysis ? (
                <StyledBox>
                  <Typography variant="h5" gutterBottom sx={{ color: '#bb86fc', fontWeight: 'bold' }}>
                    Dream Analysis Results 
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: '#03dac6' }}>
                      Memory Impact Score
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analysis.memory_score * 100} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5, 
                        backgroundColor: 'rgba(3, 218, 198, 0.2)',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#03dac6' }
                      }} 
                    />
                    <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
                      {Math.round(analysis.memory_score * 100)}%
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: '#cf6679' }}>
                      Anxiety Level
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={analysis.anxiety_score * 100} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5, 
                        backgroundColor: 'rgba(207, 102, 121, 0.2)',
                        '& .MuiLinearProgress-bar': { backgroundColor: '#cf6679' }
                      }} 
                    />
                    <Typography variant="body2" align="right" sx={{ mt: 0.5 }}>
                      {Math.round(analysis.anxiety_score * 100)}%
                    </Typography>
                  </Box>
                  
                  <Typography variant="h6" sx={{ color: '#bb86fc', mb: 1 }}>
                    Analysis:
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
                    {analysis.sonar_analysis}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: '#03dac6', mb: 1 }}>
                      People:
                    </Typography>
                    <Box>
                      {analysis.tags?.people?.split(',').map((person, index) => (
                        person.trim() && <PersonChip key={index} label={person.trim()} />
                      ))}
                    </Box>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ color: '#ffd740', mb: 1 }}>
                      Places:
                    </Typography>
                    <Box>
                      {analysis.tags?.places?.split(',').map((place, index) => (
                        place.trim() && <PlaceChip key={index} label={place.trim()} />
                      ))}
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: '#bb86fc', mb: 1 }}>
                      Emotions:
                    </Typography>
                    <Box>
                      {analysis.tags?.emotions?.split(',').map((emotion, index) => (
                        emotion.trim() && <EmotionChip key={index} label={emotion.trim()} />
                      ))}
                    </Box>
                  </Box>
                </StyledBox>
              ) : (
                <StyledBox sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Nightlight sx={{ fontSize: 80, opacity: 0.7, mb: 2 }} />
                    <Typography variant="h6">
                      Your dream analysis will appear here
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.7, mt: 1 }}>
                      Record your dream and click "Analyze Dream" to get started
                    </Typography>
                  </Box>
                </StyledBox>
              )}
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && (
          <StyledBox>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', textShadow: '0 0 10px rgba(150, 150, 255, 0.5)' }}>
                Your Dream History 📖
              </Typography>
              <StyledButton 
                startIcon={<CloudDownload />}
                onClick={exportPDF}
                disabled={!isLoggedIn || dreamHistory.length === 0}
              >
                Export PDF
              </StyledButton>
            </Box>
            
            {!isLoggedIn ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6">Please log in to view your dream history</Typography>
                <Button 
                  variant="outlined" 
                  sx={{ mt: 2, borderColor: '#7e57c2', color: '#bb86fc' }}
                  onClick={() => setLoginDialogOpen(true)}
                >
                  Login
                </Button>
              </Box>
            ) : dreamHistory.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6">No dreams recorded yet</Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mt: 1, mb: 2 }}>
                  Your analyzed dreams will appear here
                </Typography>
                <Button 
                  variant="outlined" 
                  sx={{ borderColor: '#7e57c2', color: '#bb86fc' }}
                  onClick={() => setTabValue(0)}
                >
                  Record a Dream
                </Button>
              </Box>
            ) : (
              <Box>
                {dreamHistory.map((dream, index) => (
                  <DreamCard key={index}>
                    <CardContent>
                      <Typography variant="subtitle2" color="#bb86fc" gutterBottom>
                        {new Date(dream.created_at).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </Typography>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Dream Entry
                      </Typography>
                      <Typography variant="body2" paragraph sx={{ opacity: 0.9 }}>
                        {dream.dream_text}
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" color="#03dac6">
                            Memory Score: {Math.round(dream.memory_score * 100)}%
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={dream.memory_score * 100} 
                            sx={{ 
                              height: 6, 
                              borderRadius: 3, 
                              mb: 2,
                              backgroundColor: 'rgba(3, 218, 198, 0.2)',
                              '& .MuiLinearProgress-bar': { backgroundColor: '#03dac6' }
                            }} 
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" color="#cf6679">
                            Anxiety Score: {Math.round(dream.anxiety_score * 100)}%
                          </Typography>
                          <LinearProgress 
                            variant="determinate" 
                            value={dream.anxiety_score * 100} 
                            sx={{ 
                              height: 6, 
                              borderRadius: 3, 
                              mb: 2,
                              backgroundColor: 'rgba(207, 102, 121, 0.2)',
                              '& .MuiLinearProgress-bar': { backgroundColor: '#cf6679' }
                            }} 
                          />
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2, mb: 1 }}>
                        <Typography variant="subtitle2">People:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {dream.tags?.people?.split(',').map((person, idx) => 
                            person.trim() && <PersonChip key={idx} size="small" label={person.trim()} />
                          )}
                        </Box>
                      </Box>
                      
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="subtitle2">Places:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {dream.tags?.places?.split(',').map((place, idx) => 
                            place.trim() && <PlaceChip key={idx} size="small" label={place.trim()} />
                          )}
                        </Box>
                      </Box>
                      
                      <Box>
                        <Typography variant="subtitle2">Emotions:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {dream.tags?.emotions?.split(',').map((emotion, idx) => 
                            emotion.trim() && <EmotionChip key={idx} size="small" label={emotion.trim()} />
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </DreamCard>
                ))}
              </Box>
            )}
          </StyledBox>
        )}

        {tabValue === 2 && isCaregiver && (
          <StyledBox>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', textShadow: '0 0 10px rgba(150, 150, 255, 0.5)' }}>
              Caregiver Dashboard
            </Typography>
            <Typography variant="body1" paragraph sx={{ opacity: 0.8, mb: 4 }}>
              Recent dream entries from users you care for.
            </Typography>
            
            {summaryData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6">No recent dream data available for the users you care for.</Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {summaryData.map((item, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <DreamCard>
                      <CardContent>
                        <Typography variant="subtitle2" color="#bb86fc" gutterBottom>
                          {item.date}
                        </Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                          Patient: {item.patient_user_id}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9, mb: 2, maxHeight: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Summary: {item.dream_summary}
                        </Typography>
                         <Grid container spacing={1}>
                           <Grid item xs={6}>
                              <Typography variant="caption" color="#03dac6">Memory</Typography>
                              <LinearProgress variant="determinate" value={item.memory_score * 100} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(3, 218, 198, 0.2)', '& .MuiLinearProgress-bar': { backgroundColor: '#03dac6' } }} />
                              <Typography variant="caption" align="right" display="block">{Math.round(item.memory_score * 100)}%</Typography>
                           </Grid>
                           <Grid item xs={6}>
                              <Typography variant="caption" color="#cf6679">Anxiety</Typography>
                              <LinearProgress variant="determinate" value={item.anxiety_score * 100} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(207, 102, 121, 0.2)', '& .MuiLinearProgress-bar': { backgroundColor: '#cf6679' } }} />
                              <Typography variant="caption" align="right" display="block">{Math.round(item.anxiety_score * 100)}%</Typography>
                           </Grid>
                         </Grid>
                      </CardContent>
                    </DreamCard>
                  </Grid>
                ))}
              </Grid>
            )}
          </StyledBox>
        )}

        {tabValue === settingsTabIndex && isLoggedIn && (
          <>
            {console.log('Rendering Settings Tab Content. isLoggedIn:', isLoggedIn, 'Pending:', pendingRequests.length, 'CaredFor:', caredForUsers.length)}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <StyledBox>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Request Caregiver Access
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
                    Enter the User ID of the person you want to request access to monitor.
                  </Typography>
                  <StyledTextField
                    fullWidth
                    label="Patient User ID"
                    variant="outlined"
                    value={patientUserIdToRequest}
                    onChange={(e) => setPatientUserIdToRequest(e.target.value)}
                    sx={{ mb: 2, input: { color: '#fff' } }}
                  />
                  <StyledButton
                    fullWidth
                    onClick={handleRequestAccess}
                    startIcon={<PersonAdd />}
                  >
                    Send Request
                  </StyledButton>
                </StyledBox>
              </Grid>

              <Grid item xs={12} md={6}>
                 <StyledBox>
                   <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                     Pending Caregiver Requests <Notifications sx={{ verticalAlign: 'middle', ml: 1, color: pendingRequests.length > 0 ? '#ffd740' : 'inherit' }} />
                   </Typography>
                   <Typography variant="body2" sx={{ opacity: 0.8, mb: 2 }}>
                    Review requests from users who want to monitor your dreams.
                  </Typography>
                  {pendingRequests.length === 0 ? (
                    <Typography sx={{ textAlign: 'center', opacity: 0.7, mt: 3 }}>
                      No pending requests.
                    </Typography>
                  ) : (
                    <List dense sx={{ background: 'rgba(40, 40, 80, 0.5)', borderRadius: '8px' }}>
                      {pendingRequests.map((req) => (
                        <React.Fragment key={req.request_id}>
                          <ListItem>
                            <ListItemText
                              primary={`Request from: ${req.caregiver_user_id}`}
                              primaryTypographyProps={{ color: '#fff' }}
                            />
                            <ListItemSecondaryAction>
                              <IconButton edge="end" aria-label="accept" sx={{ color: '#03dac6', mr: 0.5 }} onClick={() => handleRespondToRequest(req.request_id, 'accept')}>
                                <CheckCircle />
                              </IconButton>
                              <IconButton edge="end" aria-label="reject" sx={{ color: '#cf6679' }} onClick={() => handleRespondToRequest(req.request_id, 'reject')}>
                                <Cancel />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                          <Divider component="li" sx={{ borderColor: 'rgba(150, 150, 255, 0.2)' }} />
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                 </StyledBox>
              </Grid>

               <Grid item xs={12}>
                  <StyledBox>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Users You Care For
                    </Typography>
                    {caredForUsers.length === 0 ? (
                        <Typography sx={{ opacity: 0.7 }}>You are not currently a caregiver for any users.</Typography>
                    ) : (
                        <List dense>
                            {caredForUsers.map((user) => (
                                <ListItem key={user.id}>
                                    <ListItemText primary={user.user_id} primaryTypographyProps={{ color: '#fff' }} />
                                </ListItem>
                            ))}
                        </List>
                    )}
                  </StyledBox>
               </Grid>
            </Grid>
          </>
        )}

      </Container>

      <Dialog open={loginDialogOpen} onClose={() => { setLoginDialogOpen(false); setError(''); setPassword(''); }}>
        <DialogTitle>Login</DialogTitle>
        <DialogContent>
          <StyledTextField
            autoFocus
            margin="dense"
            label="User ID"
            type="text"
            fullWidth
            variant="outlined"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }}
          />
          <StyledTextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }}
          />
           {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setLoginDialogOpen(false); setError(''); setPassword(''); }}>Cancel</Button>
          <StyledButton onClick={handleLogin}>Login</StyledButton>
        </DialogActions>
      </Dialog>

      <Dialog open={registerDialogOpen} onClose={() => { setRegisterDialogOpen(false); setError(''); setPassword(''); }}>
        <DialogTitle>Register</DialogTitle>
        <DialogContent>
          <StyledTextField
            autoFocus
            margin="dense"
            label="User ID"
            type="text"
            fullWidth
            variant="outlined"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }}
          />
          <StyledTextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }}
          />
          {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRegisterDialogOpen(false); setError(''); setPassword(''); }}>Cancel</Button>
          <StyledButton onClick={handleRegister}>Register</StyledButton>
        </DialogActions>
      </Dialog>
    </DreamBackground>
  );
};

export default App;