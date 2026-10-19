
const API_URL = 'http://127.0.0.1:8000';

const token = localStorage.getItem('mokko_token');
const staff = JSON.parse(localStorage.getItem('mokko_staff') || '{}');

const pages = {
    dashboard: {
        title: `Good evening, ${staff.name || 'Manager'}`,
        description: "Here's what's happening at your cafe today."
    },
    menu: {
        title: 'Menu management',
        description: 'Manage your cafe categories and food items.'
    },
    tables: {
        title: 'Table management',
        description: 'Keep track of seating and table availability.'
    },
    orders: {
        title: 'Orders',
        description: 'Track customer orders from placement to service.'
    },
    kitchen: {
        title: 'Kitchen display',
        description: 'Manage preparation and ready orders.'
    },
    billing: {
        title: 'Billing & payments',
        description: 'Review bills and record customer payments.'
    }
};

const $ = (id) => document.getElementById(id);

function formatMoney(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(Number(value || 0));
}

function setNotice(message) {
    const notice = $('notice');
    notice.textContent = message;
    notice.classList.remove('hidden');
}

function hideNotice() {
    $('notice').classList.add('hidden');
}

// Redirect users who are not logged in.
if (!token) {
    window.location.replace('login.html');
} else {
    // Display the logged-in staff member.
    if ($('staff-name')) {
        $('staff-name').textContent = staff.name || 'Manager';
    }

    if ($('staff-avatar')) {
        $('staff-avatar').textContent =
            staff.name?.charAt(0).toUpperCase() || 'M';
    }

    // Logout.
    if ($('logout-btn')) {
        $('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('mokko_token');
            localStorage.removeItem('mokko_staff');
            window.location.replace('login.html');
        });
    }

    function showPage(page) {
        const info = pages[page] || pages.dashboard;

        document.querySelectorAll('.nav-item').forEach((button) => {
            button.classList.toggle(
                'active',
                button.dataset.page === page
            );
        });

        $('dashboardPage').classList.toggle(
            'hidden',
            page !== 'dashboard'
        );

        $('otherPage').classList.toggle(
            'hidden',
            page === 'dashboard'
        );

        $('pageTitle').textContent = info.title;
        $('pageDescription').textContent = info.description;

        if (page !== 'dashboard') {
            $('placeholderTitle').textContent = info.title;
            $('placeholderDescription').textContent =
                `${info.description} This screen is the next module to connect to your backend.`;
        }

        if (page === 'dashboard') {
            loadDashboard();
        }
    }

    async function loadDashboard() {
        $('apiStatus').textContent = 'Connecting…';
        hideNotice();

        try {
            const response = await fetch(
                `${API_URL}/api/reports/dashboard`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (response.status === 401) {
                localStorage.removeItem('mokko_token');
                localStorage.removeItem('mokko_staff');
                window.location.replace('login.html');
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    'Manager or admin access is required for reports.'
                );
            }

            if (!response.ok) {
                throw new Error(
                    `Dashboard request failed (${response.status}).`
                );
            }

            const data = await response.json();

            $('salesValue').textContent = formatMoney(data.sales);
            $('billsValue').textContent = data.paid_bills ?? 0;
            $('ordersValue').textContent = data.orders_today ?? 0;
            $('pendingValue').textContent = data.pending_orders ?? 0;

            $('kitchenPending').textContent = data.pending_orders ?? 0;
            $('kitchenPreparing').textContent =
                data.preparing_orders ?? 0;
            $('kitchenReady').textContent = data.ready_orders ?? 0;

            $('reportDate').textContent = data.date || '—';
            $('apiStatus').textContent = 'Connected';
            $('apiStatus').classList.add('status-text');
        } catch (error) {
            $('apiStatus').textContent = 'Unavailable';
            setNotice(
                error.message ||
                'Unable to connect to the MOKKO backend.'
            );
        }
    }

    document.querySelectorAll('.nav-item').forEach((button) => {
        button.addEventListener('click', () => {
            showPage(button.dataset.page);
        });
    });

    $('refreshButton').addEventListener('click', loadDashboard);

    $('todayDate').textContent = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(new Date());

    loadDashboard();
}
