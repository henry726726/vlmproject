const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = 5001;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
    console.log('Register request body:', req.body);
    const { nickname, email, password } = req.body;

    if (!nickname || !email || !password) {
        console.log('Registration failed: missing fields');
        return res.status(400).json({ message: 'All fields are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.log('Registration failed: invalid email format:', email);
        return res.status(400).json({ message: 'Invalid email format' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Check if user already exists
        const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            console.log('User already exists:', email);
            return res.status(400).json({ message: 'User already exists' });
        }
        // Insert new user
        const [result] = await pool.query(
            'INSERT INTO users (nickname, email, password) VALUES (?, ?, ?)',
            [nickname, email, hashedPassword]
        );
        console.log('User registered successfully with ID:', result.insertId);
        // Fetch the created user
        const [userRows] = await pool.query(
            'SELECT id, nickname, email FROM users WHERE id = ?',
            [result.insertId]
        );
        const user = userRows[0];
        console.log('Fetched new user:', user);
        req.session.userId = user.id;
        res.json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Server error during registration:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        req.session.userId = user.id;
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Server error during login:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Check if user is authenticated
app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        console.log('Not authenticated: no session userId');
        return res.status(401).json({ message: 'Not authenticated' });
    }
    try {
        const [rows] = await pool.query('SELECT id, nickname, email FROM users WHERE id = ?', [req.session.userId]);
        const user = rows[0];
        if (!user) {
            console.log('User not found for session userId:', req.session.userId);
            return res.status(404).json({ message: 'User not found' });
        }
        console.log('Fetched user for /api/me:', user);
        res.json({ user });
    } catch (error) {
        console.error('DB error fetching user in /api/me:', error);
        res.status(500).json({ message: 'Database error' });
    }
});

// Update user profile
app.put('/api/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }
    const { nickname, email } = req.body;
    try {
        await pool.query('UPDATE users SET nickname = ?, email = ? WHERE id = ?', [nickname, email, req.session.userId]);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Reset password endpoint
app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await pool.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 