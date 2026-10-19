
const API_URL = 'http://127.0.0.1:8000';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const buttonText = document.getElementById('buttonText');
const message = document.getElementById('loginMessage');
const togglePassword = document.getElementById('togglePassword');

function showMessage(text, type = 'error') {
    message.textContent = text;
    message.classList.remove('hidden', 'success');

    if (type === 'success') {
        message.classList.add('success');
    }
}

togglePassword.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';

    passwordInput.type = showing ? 'password' : 'text';
    togglePassword.textContent = showing ? 'Show' : 'Hide';
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    message.classList.add('hidden');
    loginButton.disabled = true;
    buttonText.textContent = 'Signing in…';

    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || `Login failed (${response.status}).`
            );
        }

        if (!data.access_token) {
            throw new Error('The server did not return an access token.');
        }

        const token = data.access_token;

        const profileResponse = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const profile = await profileResponse.json().catch(() => ({}));

        if (!profileResponse.ok) {
            throw new Error(
                profile.detail || 'Could not verify your staff account.'
            );
        }

        if (!profile.is_active) {
            throw new Error('This staff account is inactive.');
        }

        localStorage.setItem('mokko_token', token);
        localStorage.setItem('mokko_staff', JSON.stringify(profile));

        showMessage('Login successful. Opening your workspace…', 'success');
        buttonText.textContent = 'Welcome to MOKKO';

        // Route to role-specific dashboard
        const rolePages = {
            admin:   'admin.html',
            manager: 'manager.html',
            waiter:  'staff.html',
            cashier: 'staff.html',
            chef:    'staff.html',
            customer:'customer.html',
        };
        const dest = rolePages[profile.role] || 'staff.html';

        window.setTimeout(() => {
            window.location.href = dest;
        }, 500);

    } catch (error) {
        showMessage(
            error.message === 'Failed to fetch'
                ? 'Cannot connect to MOKKO. Check that FastAPI is running and CORS is configured.'
                : error.message || 'Something went wrong. Please try again.'
        );

        loginButton.disabled = false;
        buttonText.textContent = 'Sign in to MOKKO';
    }
});
