document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard initialization started');

    try {
        // Verify authentication
        const userId = localStorage.getItem('user_id');
        if (!userId) {
            window.location.href = 'index.html';
            return;
        }

        // Load and display data
        await loadAndDisplayHealthData();

        // Set up chart controls
        document.getElementById('chart-metric')?.addEventListener('change', () => {
            fetchHealthMetrics().then(initializeHealthChart);
        });

        document.getElementById('chart-period')?.addEventListener('change', () => {
            fetchHealthMetrics().then(initializeHealthChart);
        });

        // Logout button
        // In dashboard.js and metrics.js
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
    } catch (error) {
        console.error('Dashboard initialization failed:', error);
        showErrorState('Failed to initialize dashboard');
    }
});

let healthChart = null;

async function loadAndDisplayHealthData() {
    showLoadingState(true);

    try {
        const metrics = await fetchHealthMetrics();

        if (!metrics?.length) {
            showNoDataState();
            return;
        }

        updateSummaryCards(metrics);
        initializeHealthChart(metrics);

    } catch (error) {
        console.error('Data loading failed:', error);
        showErrorState('Failed to load health data');
    } finally {
        showLoadingState(false);
    }
}

async function fetchHealthMetrics() {
    try {
        const response = await fetch('/metrics', {
            headers: { 'X-User-ID': localStorage.getItem('user_id') }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('Invalid metrics data format');
        }

        return data;
    } catch (error) {
        console.error('Error fetching metrics:', error);
        throw error;
    }
}

function updateSummaryCards(metrics) {
    try {
        // Update weight summary
        const weightMetrics = metrics.filter(m => m.metric_type === 'Weight');
        updateSummaryCard('weight-summary', 'weight-trend', weightMetrics);

        // Update blood pressure summary
        const bpMetrics = metrics.filter(m => m.metric_type === 'Blood Pressure');
        updateSummaryCard('bp-summary', 'bp-trend', bpMetrics);

        // Update blood sugar summary
        const sugarMetrics = metrics.filter(m => m.metric_type === 'Blood Sugar');
        updateSummaryCard('sugar-summary', 'sugar-trend', sugarMetrics);
    } catch (error) {
        console.error('Error updating summary cards:', error);
        throw error;
    }
}

function updateSummaryCard(valueId, trendId, metrics) {
    const valueElement = document.getElementById(valueId);
    const trendElement = document.getElementById(trendId);

    if (!valueElement || !trendElement) return;

    if (!metrics.length) {
        valueElement.textContent = 'No data';
        trendElement.innerHTML = '<span class="neutral"><i class="fas fa-minus"></i></span>';
        return;
    }

    // Get latest reading
    const latest = metrics[0];
    valueElement.innerHTML = `
        <span class="value">${latest.value} ${latest.unit}</span>
        <span class="date">${new Date(latest.recorded_at).toLocaleDateString()}</span>
    `;

    // Calculate trend if we have previous data
    if (metrics.length > 1) {
        const previous = metrics[1];
        const currentValue = typeof latest.value === 'string' ? parseFloat(latest.value.split('/')[0]) : latest.value;
        const previousValue = typeof previous.value === 'string' ? parseFloat(previous.value.split('/')[0]) : previous.value;

        const diff = ((currentValue - previousValue) / previousValue) * 100;
        const trendClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';

        trendElement.innerHTML = `
            <span class="${trendClass}">
                <i class="fas fa-arrow-${trendClass}"></i> ${Math.abs(diff).toFixed(1)}%
            </span>
        `;
    }
}

// Replace your existing initializeHealthChart function with this:

async function initializeHealthChart() {
    try {
        const ctx = document.getElementById('health-trend-chart');
        if (!ctx) return;

        // Destroy previous chart if exists
        if (window.healthChart) {
            window.healthChart.destroy();
        }

        // Show loading state
        document.getElementById('chart-trend-value').textContent = 'Loading data...';

        // Get selected filters
        const metricType = document.getElementById('chart-metric').value;
        const days = parseInt(document.getElementById('chart-period').value);

        // Fetch metrics data
        const metrics = await fetchHealthMetrics();
        const filteredMetrics = metrics.filter(m => m.metric_type === metricType);

        if (filteredMetrics.length === 0) {
            document.getElementById('chart-trend-value').textContent = 'No data available';
            return;
        }

        // Process data for chart
        const { labels, values } = processChartData(filteredMetrics, days);

        // Create the chart
        window.healthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${metricType} Trend`,
                    data: values,
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });

        // Update trend indicator
        document.getElementById('chart-trend-value').textContent =
            `Showing ${filteredMetrics.length} records`;

    } catch (error) {
        console.error('Chart error:', error);
        document.getElementById('chart-trend-value').textContent =
            'Error loading chart data';
    }
}

function processChartData(metrics, days) {
    const labels = [];
    const values = [];
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - days);

    // Create empty data points for all dates in range
    const dateMap = {};
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dateMap[dateStr] = null;
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    // Fill with actual data
    metrics.forEach(metric => {
        const date = new Date(metric.recorded_at);
        const dateStr = date.toISOString().split('T')[0];

        if (dateMap[dateStr] !== undefined) {
            // Handle different metric types
            let value;
            if (metric.metric_type === 'Blood Pressure') {
                value = parseFloat(metric.value.split('/')[0]); // Use systolic value
            } else {
                value = parseFloat(metric.value);
            }

            if (!isNaN(value)) {
                dateMap[dateStr] = value;
            }
        }
    });

    // Convert to array
    for (const date in dateMap) {
        values.push(dateMap[date]);
    }

    return { labels, values };
}

// Helper functions
function getMetricColor(metricType) {
    const colors = {
        'Weight': '#4361ee',
        'Blood Pressure': '#f72585',
        'Blood Sugar': '#4cc9f0'
    };
    return colors[metricType] || '#4361ee';
}

function getMetricBackgroundColor(metricType) {
    const colors = {
        'Weight': 'rgba(67, 97, 238, 0.2)',
        'Blood Pressure': 'rgba(247, 37, 133, 0.2)',
        'Blood Sugar': 'rgba(76, 201, 240, 0.2)'
    };
    return colors[metricType] || 'rgba(67, 97, 238, 0.2)';
}

function getMetricUnit(metricType) {
    const units = {
        'Weight': 'kg',
        'Blood Pressure': 'mmHg',
        'Blood Sugar': 'mg/dL'
    };
    return units[metricType] || '';
}

// UI State Management
function showLoadingState(show) {
    const overlay = document.getElementById('loading-overlay');
    const content = document.getElementById('dashboard-content');

    if (overlay) overlay.style.display = show ? 'flex' : 'none';
    if (content) content.style.display = show ? 'none' : 'block';
}

function showNoDataState() {
    const container = document.getElementById('health-trend-chart-container');
    if (container) {
        container.innerHTML = `
            <div class="no-data-message">
                <i class="fas fa-info-circle"></i>
                No health metrics found. Please add data.
            </div>
        `;
    }
}

function showErrorState(message) {
    const errorElem = document.getElementById('error-message');
    if (errorElem) {
        errorElem.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message || 'Error loading dashboard'}
        `;
        errorElem.style.display = 'block';
    }
}