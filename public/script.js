document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    const magicLinkInput = document.getElementById('magicLink');
    const sendBtn = document.getElementById('sendLinkBtn');
    const verifyBtn = document.getElementById('verifyBtn');
    const backBtn = document.getElementById('backBtn');
    const resetBtn = document.getElementById('resetBtn');
    const resultContainer = document.getElementById('resultContainer');
    const historyList = document.getElementById('historyList');

    let currentEmail = '';

    // Step management
    function showStep(step) {
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
        
        document.getElementById(`step${step}`).classList.add('active');
        document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
        
        if (step === 1) {
            document.querySelector(`.step[data-step="2"]`).classList.remove('completed');
            document.querySelector(`.step[data-step="3"]`).classList.remove('completed');
        }
    }

    function showResult(data, success) {
        const step3 = document.getElementById('step3');
        const container = document.getElementById('resultContainer');
        
        if (success) {
            container.innerHTML = `
                <div class="result-box success">
                    <div class="title">✓ ${data.message || 'Premium Activated!'}</div>
                    <div class="detail">Email: ${data.email}</div>
                    <div class="detail">Status: Premium Active</div>
                    <div class="detail">Duration: ${data.duration || '1 Tahun'}</div>
                    ${data.data ? `<div class="detail">Data: ${JSON.stringify(data.data, null, 2)}</div>` : ''}
                    <span class="badge badge-premium">PREMIUM</span>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="result-box error">
                    <div class="title">✗ ${data.error || 'Verification Failed'}</div>
                    <div class="detail">Please try again or check your link</div>
                </div>
            `;
        }
        
        showStep(3);
        document.querySelector(`.step[data-step="2"]`).classList.add('completed');
        document.querySelector(`.step[data-step="3"]`).classList.add('completed');
    }

    // Send magic link
    sendBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        
        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }

        currentEmail = email;
        sendBtn.disabled = true;
        sendBtn.querySelector('.spinner').classList.remove('hidden');
        sendBtn.querySelector('span').textContent = 'Sending...';

        try {
            const response = await fetch('/api/send-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                showStep(2);
                document.querySelector(`.step[data-step="1"]`).classList.add('completed');
                
                // Show instructions in result
                const instructions = data.instructions || [];
                resultContainer.innerHTML = `
                    <div class="info-box" style="margin-bottom:16px;">
                        <div>
                            <strong>✅ Link sent to ${email}</strong>
                            <ol class="instructions">
                                ${instructions.map(step => `<li>${step}</li>`).join('')}
                            </ol>
                        </div>
                    </div>
                `;
            } else {
                alert(data.error || 'Failed to send link');
            }
        } catch (error) {
            alert('Network error: ' + error.message);
        } finally {
            sendBtn.disabled = false;
            sendBtn.querySelector('.spinner').classList.add('hidden');
            sendBtn.querySelector('span').textContent = 'Send Magic Link';
        }
    });

    // Verify link
    verifyBtn.addEventListener('click', async () => {
        const link = magicLinkInput.value.trim();
        
        if (!link || !link.startsWith('http')) {
            alert('Please paste a valid magic link');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.querySelector('.spinner').classList.remove('hidden');
        verifyBtn.querySelector('span').textContent = 'Verifying...';

        try {
            const response = await fetch('/api/verify-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: currentEmail, 
                    link: link 
                })
            });

            const data = await response.json();
            showResult(data, data.success);
            
            // Refresh history
            loadHistory();
        } catch (error) {
            showResult({ error: error.message }, false);
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.querySelector('.spinner').classList.add('hidden');
            verifyBtn.querySelector('span').textContent = 'Verify & Activate';
        }
    });

    // Back button
    backBtn.addEventListener('click', () => {
        showStep(1);
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        emailInput.value = '';
        magicLinkInput.value = '';
        currentEmail = '';
        showStep(1);
        document.querySelectorAll('.step').forEach(el => {
            el.classList.remove('completed');
        });
    });

    // Load history
    async function loadHistory() {
        try {
            const response = await fetch('/api/history');
            const data = await response.json();
            
            if (data.success && data.data.length > 0) {
                historyList.innerHTML = data.data.map(item => `
                    <div class="history-item">
                        <div>
                            <div class="email">${item.email}</div>
                            <div class="time">${new Date(item.timestamp).toLocaleString()}</div>
                        </div>
                        <span class="status ${item.success ? 'status-success' : 'status-error'}">
                            ${item.success ? '✓ Success' : '✗ Failed'}
                        </span>
                    </div>
                `).join('');
            } else {
                historyList.innerHTML = '<p class="empty-state">No activity yet</p>';
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    // Load history on startup
    loadHistory();
    // Refresh history every 30 seconds
    setInterval(loadHistory, 30000);

    // Enter key support
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });
    
    magicLinkInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyBtn.click();
    });
});