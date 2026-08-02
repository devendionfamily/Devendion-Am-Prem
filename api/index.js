const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

// ✅ CORS ALLOW ALL
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const CONFIG = {
    BASE_URL: 'https://www.alightpro.my.id',
    TIMEOUT: 60000
};

function generatePow(nonce) {
    const target = '0000';
    for (let i = 0; i < 1000000; i++) {
        const test = i.toString(16).padStart(8, '0');
        const hash = crypto.createHash('sha256').update(nonce + test).digest('hex');
        if (hash.startsWith(target)) return test;
    }
    return Date.now().toString(16);
}

async function getSession() {
    try {
        const response = await axios.get(`${CONFIG.BASE_URL}/api/session`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: CONFIG.TIMEOUT
        });
        return {
            success: true,
            token: response.data.token,
            nonce: response.data.nonce,
            sessionId: response.data.sessionId
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function alightMotion(email, rawLink = null) {
    try {
        if (!email) return { success: false, error: 'Email required' };
        
        const session = await getSession();
        if (!session.success) return { success: false, error: session.error };
        
        const pow = generatePow(session.nonce);
        
        if (rawLink) {
            const response = await axios.post(`${CONFIG.BASE_URL}/api/alight-motion`, {
                action: 'verify',
                email: email,
                link: rawLink
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Amprem-Token': session.token,
                    'X-Amprem-Nonce': session.nonce,
                    'X-Amprem-Pow': pow,
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: CONFIG.TIMEOUT
            });
            
            return {
                success: true,
                email: email,
                message: 'Account verified successfully',
                premium: true,
                duration: '1 Tahun',
                data: response.data.data || null
            };
        }
        
        const response = await axios.post(`${CONFIG.BASE_URL}/api/alight-motion`, {
            action: 'send',
            email: email
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Amprem-Token': session.token,
                'X-Amprem-Nonce': session.nonce,
                'X-Amprem-Pow': pow,
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: CONFIG.TIMEOUT
        });
        
        return {
            success: true,
            email: email,
            message: response.data.msg || 'Link sent successfully'
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message 
        };
    }
}

// ✅ API Routes
app.post('/api/send-link', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }
        const result = await alightMotion(email);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-link', async (req, res) => {
    try {
        const { email, link } = req.body;
        if (!email || !link) {
            return res.status(400).json({ error: 'Email and link required' });
        }
        const result = await alightMotion(email, link);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Handle OPTIONS preflight
app.options('/api/*', (req, res) => {
    res.status(200).end();
});

// ✅ Root
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

module.exports = app;
