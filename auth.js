document.addEventListener('DOMContentLoaded', function () {
    // Redirect if already logged in
    if (localStorage.getItem('user_id') && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Form toggling
    document.getElementById('show-register')?.addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login')?.addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });

    // Login form
    document.getElementById('login')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('user_id', data.user_id);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
            console.error('Login error:', error);
        }
    });

    // Registration form
    document.getElementById('register')?.addEventListener('submit', async function (e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Registration failed');

            alert('Registration successful! Please login.');
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
        } catch (error) {
            alert(error.message);
            console.error('Registration error:', error);
        }
    });
    // Add this to your auth.js file
    document.getElementById('logout')?.addEventListener('click', function (e) {
        e.preventDefault();
        logoutUser();
    });

    async function logoutUser() {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': localStorage.getItem('user_id')
                }
            });

            if (!response.ok) {
                throw new Error('Logout failed');
            }

            localStorage.removeItem('user_id');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to logout. Please try again.');
        }
    }
});