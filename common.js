// Common functions used across all pages
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

        // Clear user data
        localStorage.removeItem('user_id');

        // Redirect to login page
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
}

// Add this to make the function available globally
window.logoutUser = logoutUser;