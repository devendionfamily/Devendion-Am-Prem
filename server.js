const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Output directory
const OUTPUT_DIR = './alight-output';
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Configuration
const CONFIG = {
    BASE_URL: 'https://www.alightpro.my.id',
    TIMEOUT: 60000
};

// Helper Functions
function generatePow(nonce) {
    const target = '0000';
    let pow = '';
    let found = false;
    
    for (let i = 0; i < 1000000; i++) {
        const test = i.toString(16).padStart(8, '0');
        const hash = crypto.createHash('sha256')
            .update(nonce + test)
            .digest('hex');
        
        if (hash.startsWith(target)) {
            pow = test;
            found = true;
            break;
        }
    }
    
    if (!found) {
        pow = Date.now().toString(16);
    }
    
    return pow;
}

async function getSession() {
    try {
        const response = await axios.get(`${CONFIG.BASE_URL}/api/session`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: CONFIG.TIMEOUT
        });

        return {
            success: true,
            token: response.data.token,
            nonce: response.data.nonce,
            sessionId: response.data.sessionId,
            timestamp: response.data.timestamp
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}

async function alightMotion(email, rawLink = null) {
    try {
        if (!email) {
            return { success: false, error: 'Email wajib diisi' };
        }

        // Get session
        const session = await getSession();
        if (!session.success) {
            return { success: false, error: session.error };
        }

        // Generate PoW
        const pow = generatePow(session.nonce);

        // If rawLink provided, verify directly
        if (rawLink) {
            const verifyResponse = await axios.post(`${CONFIG.BASE_URL}/api/alight-motion`, {
                action: 'verify',
                email: email,
                link: rawLink
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Amprem-Token': session.token,
                    'X-Amprem-Nonce': session.nonce,
                    'X-Amprem-Pow': pow
                },
                timeout: CONFIG.TIMEOUT
            });

            const result = {
                success: true,
                email: email,
                message: 'Account verified successfully',
                premium: true,
                duration: '1 Tahun',
                data: verifyResponse.data.data || null
            };

            // Save to file
            const outputPath = path.join(OUTPUT_DIR, `alight_${Date.now()}.json`);
            fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

            return result;
        }

        // Send magic link
        const sendResponse = await axios.post(`${CONFIG.BASE_URL}/api/alight-motion`, {
            action: 'send',
            email: email
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Amprem-Token': session.token,
                'X-Amprem-Nonce': session.nonce,
                'X-Amprem-Pow': pow
            },
            timeout: CONFIG.TIMEOUT
        });

        return {
            success: true,
            email: email,
            message: sendResponse.data.msg || 'Link berhasil dikirim',
            instructions: [
                'Buka inbox email (cek folder Spam juga)',
                'Cari email dari "Alight Motion" / "Alight Creative"',
                'Tekan-tahan tombol "Login ke Alight Creative", pilih "Salin URL"',
                'Jangan klik langsung — copy link doang',
                'Panggil: alightMotion("email", "link_yang_dicopy")'
            ]
        };

    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message
        };
    }
}

// API Endpoints
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/send-link', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await alightMotion(email);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-link', async (req, res) => {
    const { email, link } = req.body;
    
    if (!email || !link) {
        return res.status(400).json({ error: 'Email and link are required' });
    }

    try {
        const result = await alightMotion(email, link);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', (req, res) => {
    try {
        const files = fs.readdirSync(OUTPUT_DIR);
        const history = files
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
                return {
                    file: f,
                    email: data.email,
                    timestamp: data.timestamp || new Date().toISOString(),
                    success: data.success
                };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);

        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Alight Motion Web Service running on http://localhost:${PORT}`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
});