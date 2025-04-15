document.addEventListener('DOMContentLoaded', function () {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    // DOM elements
    const metricsList = document.getElementById('metrics-list');
    const metricForm = document.getElementById('metric-form');
    const metricModal = document.getElementById('metric-modal');
    const addMetricBtn = document.getElementById('add-metric');
    const closeModalBtn = document.querySelector('.close');
    const cancelModalBtn = document.getElementById('cancel-metric');
    const applyFiltersBtn = document.getElementById('apply-filters');

    // Initialize date filters
    initDateFilters();

    // Load metrics with default filters
    loadMetrics();
    setupEventListeners();

    function initDateFilters() {
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        document.getElementById('date-from').valueAsDate = oneMonthAgo;
        document.getElementById('date-to').valueAsDate = today;
    }

    function setupEventListeners() {
        // Modal controls
        addMetricBtn?.addEventListener('click', showAddMetricModal);
        closeModalBtn?.addEventListener('click', closeModal);
        cancelModalBtn?.addEventListener('click', closeModal);

        // Form submission
        metricForm?.addEventListener('submit', handleMetricSubmit);

        // Filter controls
        applyFiltersBtn?.addEventListener('click', loadMetrics);
        document.getElementById('metric-type')?.addEventListener('change', updateSummary);

        // Logout button
        document.getElementById('logout')?.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('user_id');
            window.location.href = 'index.html';
        });
    }

    function loadMetrics() {
        showLoading();

        const params = new URLSearchParams();
        params.append('type', document.getElementById('metric-type').value);
        params.append('start_date', document.getElementById('date-from').value);
        params.append('end_date', document.getElementById('date-to').value);
        params.append('sort', document.getElementById('sort').value);

        fetch(`/metrics?${params.toString()}`, {
            headers: { 'X-User-ID': localStorage.getItem('user_id') }
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.length === 0) {
                    metricsList.innerHTML = `
                        <div class="no-data">
                            <i class="fas fa-database"></i>
                            <p>No metrics found matching your filters</p>
                        </div>
                    `;
                } else {
                    renderMetrics(data);
                }
            })
            .catch(error => {
                console.error('Error loading metrics:', error);
                metricsList.innerHTML = `
                    <div class="error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load metrics. Please try again.</p>
                    </div>
                `;
            })
            .finally(() => {
                updateSummary();
            });
    }

    function renderMetrics(metrics) {
        metricsList.innerHTML = metrics.map(metric => `
            <div class="metric-item" data-id="${metric.id}">
                <div class="metric-info">
                    <div class="metric-type">
                        <i class="${getMetricIcon(metric.metric_type)}"></i> ${metric.metric_type}
                    </div>
                    <div class="metric-value">${metric.value} ${metric.unit}</div>
                    <div class="metric-date">${formatDateTime(metric.recorded_at)}</div>
                    ${metric.notes ? `<div class="metric-notes">${metric.notes}</div>` : ''}
                </div>
                <div class="metric-actions">
                    <button class="edit-btn" data-id="${metric.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="delete-btn" data-id="${metric.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editMetric(btn.dataset.id));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteMetric(btn.dataset.id));
        });
    }

    async function updateSummary() {
        const metricType = document.getElementById('metric-type').value;
        if (!metricType) return;

        const summaryTitle = document.getElementById('summary-title');
        const summaryValue = document.getElementById('summary-value');

        summaryTitle.innerHTML = `<i class="${getMetricIcon(metricType)}"></i> Latest ${metricType}`;
        summaryValue.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        try {
            const response = await fetch(`/metrics/summary?type=${metricType}`, {
                headers: { 'X-User-ID': localStorage.getItem('user_id') }
            });

            if (!response.ok) throw new Error('Failed to fetch summary');

            const data = await response.json();

            if (data.message === 'No readings found') {
                summaryValue.textContent = 'No readings yet';
            } else {
                summaryValue.innerHTML = `
                    ${data.value} ${data.unit}
                    <span class="summary-date">(${new Date(data.recorded_at).toLocaleString()})</span>
                `;
            }
        } catch (error) {
            console.error('Summary update failed:', error);
            summaryValue.innerHTML = '<span class="error"><i class="fas fa-exclamation-triangle"></i> Update failed</span>';
        }
    }

    function showAddMetricModal() {
        document.getElementById('modal-title').innerHTML = '<i class="fas fa-plus"></i> Add New Reading';
        metricForm.reset();
        document.getElementById('metric-id').value = '';
        document.getElementById('form-recorded-at').value = new Date().toISOString().slice(0, 16);
        metricModal.classList.add('active');
    }

    function showEditModal(metricId) {
        fetch(`/metrics`, {
            headers: { 'X-User-ID': userId }
        })
            .then(response => response.json())
            .then(metrics => {
                const metric = metrics.find(m => m.id == metricId);
                if (metric) {
                    document.getElementById('modal-title').innerHTML = '<i class="fas fa-edit"></i> Edit Reading';
                    document.getElementById('metric-id').value = metric.id;
                    document.getElementById('form-metric-type').value = metric.metric_type;
                    document.getElementById('form-value').value = metric.value;
                    document.getElementById('form-unit').value = metric.unit;

                    // Convert recorded_at to local datetime string
                    const recordedAt = new Date(metric.recorded_at);
                    const offset = recordedAt.getTimezoneOffset() * 60000;
                    const localISOTime = new Date(recordedAt - offset).toISOString().slice(0, 16);
                    document.getElementById('form-recorded-at').value = localISOTime;

                    document.getElementById('form-notes').value = metric.notes || '';
                    metricModal.classList.add('active');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error loading metric data', 'error');
            });
    }

    async function handleMetricSubmit(e) {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitBtn.disabled = true;

        try {
            const formData = {
                metric_type: document.getElementById('form-metric-type').value,
                value: parseFloat(document.getElementById('form-value').value),
                unit: document.getElementById('form-unit').value,
                recorded_at: document.getElementById('form-recorded-at').value,
                notes: document.getElementById('form-notes').value || ''
            };

            const isEdit = document.getElementById('metric-id').value;
            const url = isEdit
                ? `/metrics/${document.getElementById('metric-id').value}`
                : '/metrics';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': localStorage.getItem('user_id')
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save metric');
            }

            closeModal();
            await loadMetrics();
            await updateSummary();
            showNotification('Metric saved successfully!', 'success');

        } catch (error) {
            console.error('Save failed:', error);
            showNotification(error.message || 'Failed to save metric', 'error');
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }

    function editMetric(metricId) {
        showEditModal(metricId);
    }

    function deleteMetric(metricId) {
        if (!confirm('Are you sure you want to delete this metric?')) return;

        fetch(`/metrics/${metricId}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': userId }
        })
            .then(response => {
                if (!response.ok) throw new Error('Network error');
                return response.json();
            })
            .then(() => {
                loadMetrics();
                updateSummary();
                showNotification('Metric deleted successfully', 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Failed to delete metric', 'error');
            });
    }

    function closeModal() {
        metricModal.classList.remove('active');
    }

    function showLoading() {
        metricsList.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading your health metrics...</p>
            </div>
        `;
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function getMetricIcon(metricType) {
        const icons = {
            'Weight': 'fa-weight',
            'Blood Pressure': 'fa-heartbeat',
            'Blood Sugar': 'fa-tint',
            'Heart Rate': 'fa-heart'
        };
        return `fas ${icons[metricType] || 'fa-chart-line'}`;
    }

    function formatDateTime(dateString) {
        return new Date(dateString).toLocaleString();
    }

    // Check URL for add new parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('add')) {
        addMetricBtn.click();
    }
});