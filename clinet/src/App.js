import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Box, Typography, TextField, Button, Paper, CircularProgress, Grid, 
  Tabs, Tab, Card, CardContent, Chip, LinearProgress, AppBar, Toolbar, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton
} from '@mui/material';
import { styled } from '@mui/system';
import { 
  Nightlight, Psychology, Timeline, History, CloudDownload, Login, 
  PersonAdd, ExitToApp, MenuBook
} from '@mui/icons-material';

// Styled components with dream-themed aesthetics
const DreamBackground = styled('div')({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #111133 0%, #2c2c54 100%)',
  padding: '20px 0',
  color: '#fff'
});

const StyledBox = styled(Box)({
  backgroundColor: 'rgba(28, 28, 44, 0.8)',
  color: '#fff',
  borderRadius: '15px',
  padding: '30px',
  boxShadow: '0px 4px 20px rgba(90, 90, 255, 0.2)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(150, 150, 255, 0.2)',
});

const StyledButton = styled(Button)({
  backgroundColor: '#7e57c2',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(126, 87, 194, 0.3)',
  '&:hover': {
    backgroundColor: '#5e35b1',
  },
  transition: 'all 0.3s ease',
});

const DreamCard = styled(Card)({
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
});

const EmotionChip = styled(Chip)({
  margin: '4px',
  backgroundColor: 'rgba(126, 87, 194, 0.2)',
  color: '#bb86fc',
  border: '1px solid #bb86fc',
});

const PersonChip = styled(Chip)({
  margin: '4px',
  backgroundColor: 'rgba(3, 218, 198, 0.2)',
  color: '#03dac6',
  border: '1px solid #03dac6',
});

const PlaceChip = styled(Chip)({
  margin: '4px',
  backgroundColor: 'rgba(255, 215, 64, 0.2)',
  color: '#ffd740',
  border: '1px solid #ffd740',
});

const StyledTextField = styled(TextField)({
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
});

const App = () => {
  const [dreamText, setDreamText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  useEffect(() => {
    const savedToken = localStorage.getItem('dreamToken');
    if (savedToken) {
      setToken(savedToken);
      setIsLoggedIn(true);
      fetchDreamHistory(savedToken);
    }
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 1 && isLoggedIn) {
      fetchDreamHistory(token);
    }
    if (newValue === 2 && isLoggedIn && isCaregiver) {
      fetchCaregiverSummary(token);
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
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/auth/login', {
        user_id: userId,
        password: password
      });
      
      setToken(response.data.token);
      localStorage.setItem('dreamToken', response.data.token);
      setIsLoggedIn(true);
      setLoginDialogOpen(false);
      
      const user = await axios.get('http://127.0.0.1:5000/api/user/profile', {
        headers: { Authorization: `Bearer ${response.data.token}` }
      });
      if (user.data.caregiver) {
        setIsCaregiver(true);
      }
      
    } catch (error) {
      setError('Login failed. Check your credentials.');
    }
  };

  const handleRegister = async () => {
    setError('');
    try {
      await axios.post('http://127.0.0.1:5000/api/auth/register', {
        user_id: userId,
        password: password,
        caregiver: false
      });
      setRegisterDialogOpen(false);
      setLoginDialogOpen(true);
    } catch (error) {
      setError('Registration failed. User ID might already be taken.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dreamToken');
    setToken('');
    setIsLoggedIn(false);
    setUserId('');
    setPassword('');
    setDreamHistory([]);
    setSummaryData([]);
    setIsCaregiver(false);
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
            Dream Analyzer
          </Typography>
          {isLoggedIn ? (
            <>
              <Avatar sx={{ bgcolor: '#7e57c2', marginRight: '10px' }}>
                {userId.charAt(0).toUpperCase()}
              </Avatar>
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
              Monitor cognitive health patterns across users
            </Typography>
            
            {summaryData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 5 }}>
                <Typography variant="h6">No dream data available yet</Typography>
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
                          User: {item.user_id}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {item.dream_summary}
                        </Typography>
                      </CardContent>
                    </DreamCard>
                  </Grid>
                ))}
              </Grid>
            )}
          </StyledBox>
        )}
      </Container>

      <Dialog open={loginDialogOpen} onClose={() => setLoginDialogOpen(false)}>
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
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }} // Keep label dark if needed
          />
          <StyledTextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }} // Keep label dark if needed
          />
          {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoginDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <StyledButton onClick={handleLogin}>
            Login
          </StyledButton>
        </DialogActions>
      </Dialog>

      {/* Register Dialog */}
      <Dialog open={registerDialogOpen} onClose={() => setRegisterDialogOpen(false)}>
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
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }} // Keep label dark if needed
          />
          <StyledTextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputLabelProps={{ style: { color: 'rgba(0, 0, 0, 0.6)' } }} // Keep label dark if needed
          />
          {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegisterDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <StyledButton onClick={handleRegister}>
            Register
          </StyledButton>
        </DialogActions>
      </Dialog>
    </DreamBackground>
  );
};

export default App;