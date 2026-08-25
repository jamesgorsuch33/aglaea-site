/* ============================================================
   AGLAEA OPS OVERVIEW LOGIC
   ============================================================ */

const ADMIN_EMAIL = 'james@aglaea.co.uk';

let allSnapshots = []; // chronological, oldest first
let charts = {}; // keyed by canvas id, so re-rendering can destroy old instances

// ============================================================
// AUTH GATE
// Client-side check for UX only (redirect non-admins away
// immediately, rather than showing a blank/error page) — the real
// enforcement is the Firestore Security Rule on adminStats, which
// blocks the read entirely at the database level regardless of
// what this page's JS does.
// ============================================================
firebase.auth().onAuthStateChanged((user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
        window.location.href = 'index.html';
        return;
    }
    document.getElementById('opsContent').classList.remove('hidden');
    loadOpsData();
});

document.getElementById('signOutLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await firebase.auth().signOut();
    window.location.href = 'index.html';
});

// ============================================================
// DATA LOADING
// ============================================================
async function loadOpsData() {
    const loadingEl = document.getElementById('opsLoading');
    const errorEl = document.getElementById('opsError');
    const mainEl = document.getElementById('opsMain');

    try {
        await fetchSnapshots(parseInt(document.getElementById('trendRange').value, 10));

        if (allSnapshots.length === 0) {
            loadingEl.textContent = 'No business data recorded yet — the first snapshot is written at 7am UK time by the scheduled reminders function. Check back after tomorrow\'s run.';
            return;
        }

        renderKpis(allSnapshots[allSnapshots.length - 1]);
        renderCharts(allSnapshots);

        loadingEl.classList.add('hidden');
        mainEl.classList.remove('hidden');

        const latest = allSnapshots[allSnapshots.length - 1];
        document.getElementById('lastUpdated').textContent = `Latest data: ${latest.date}`;
    } catch (error) {
        console.error('Error loading ops data:', error);
        loadingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
    }
}

async function fetchSnapshots(limitDays) {
    const snapshot = await firebase.firestore()
        .collection('adminStats')
        .orderBy('date', 'desc')
        .limit(limitDays)
        .get();

    // Firestore gives us newest-first (matching the query); reverse so
    // charts read chronologically left-to-right.
    allSnapshots = snapshot.docs.map(doc => doc.data()).reverse();
}

document.getElementById('trendRange').addEventListener('change', async () => {
    try {
        await fetchSnapshots(parseInt(document.getElementById('trendRange').value, 10));
        renderCharts(allSnapshots);
    } catch (error) {
        console.error('Error reloading data for new range:', error);
    }
});

// ============================================================
// KPI CARDS — always reflect the single most recent snapshot
// ============================================================
function renderKpis(latest) {
    const gbp = (n) => `£${(n || 0).toFixed(2)}`;

    document.getElementById('kpiTotalUsers').textContent = latest.totalUsers ?? 0;
    document.getElementById('kpiDiscoverUsers').textContent = latest.discoverUsers ?? 0;
    document.getElementById('kpiCurateUsers').textContent = latest.curateUsers ?? 0;
    document.getElementById('kpiCurateMonthly').textContent = latest.curateMonthlyCount ?? 0;
    document.getElementById('kpiCurateAnnual').textContent = latest.curateAnnualCount ?? 0;
    document.getElementById('kpiMRR').textContent = gbp(latest.estimatedMonthlyRevenue);

    document.getElementById('kpiTotalReminders').textContent = latest.totalReminders ?? 0;
    document.getElementById('kpiDateBasedReminders').textContent = latest.dateBasedReminders ?? 0;
    document.getElementById('kpiJustBecauseReminders').textContent = latest.justBecauseReminders ?? 0;
    document.getElementById('kpiPausedReminders').textContent = latest.pausedReminders ?? 0;

    document.getElementById('kpiEmailsSent').textContent = latest.emailsSentToday ?? 0;
    document.getElementById('kpiEmailsFailed').textContent = latest.emailsFailedToday ?? 0;
    document.getElementById('kpiSmsSent').textContent = latest.smsSentToday ?? 0;
    document.getElementById('kpiSmsFailed').textContent = latest.smsFailedToday ?? 0;
    document.getElementById('kpiSmsCost').textContent = gbp(latest.smsCostTodayGbp);
    document.getElementById('kpiJustBecauseSent').textContent = latest.justBecauseSentToday ?? 0;
}

// ============================================================
// CHARTS
// ============================================================
const CHART_COLORS = {
    gold: '#c9a870',
    blue: '#5b8def',
    green: '#4ade80',
    red: '#f87171',
    grey: '#8b8f9a'
};

const CHART_BASE_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: {
            labels: { color: '#c8cad0', boxWidth: 12, font: { size: 11 } }
        }
    },
    scales: {
        x: {
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#1e222c' }
        },
        y: {
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#1e222c' },
            beginAtZero: true
        }
    }
};

function destroyChartIfExists(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

function renderCharts(snapshots) {
    const labels = snapshots.map(s => s.date);

    renderUsersChart(labels, snapshots);
    renderMrrChart(labels, snapshots);
    renderRemindersChart(labels, snapshots);
    renderSmsChart(labels, snapshots);
}

function renderUsersChart(labels, snapshots) {
    destroyChartIfExists('chartUsers');
    const ctx = document.getElementById('chartUsers').getContext('2d');
    charts.chartUsers = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Discover',
                    data: snapshots.map(s => s.discoverUsers ?? 0),
                    borderColor: CHART_COLORS.grey,
                    backgroundColor: CHART_COLORS.grey,
                    tension: 0.25
                },
                {
                    label: 'Curate',
                    data: snapshots.map(s => s.curateUsers ?? 0),
                    borderColor: CHART_COLORS.gold,
                    backgroundColor: CHART_COLORS.gold,
                    tension: 0.25
                }
            ]
        },
        options: CHART_BASE_OPTIONS
    });
}

function renderMrrChart(labels, snapshots) {
    destroyChartIfExists('chartMRR');
    const ctx = document.getElementById('chartMRR').getContext('2d');
    charts.chartMRR = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Estimated MRR (£)',
                data: snapshots.map(s => s.estimatedMonthlyRevenue ?? 0),
                borderColor: CHART_COLORS.gold,
                backgroundColor: 'rgba(201, 168, 112, 0.15)',
                fill: true,
                tension: 0.25
            }]
        },
        options: CHART_BASE_OPTIONS
    });
}

function renderRemindersChart(labels, snapshots) {
    destroyChartIfExists('chartReminders');
    const ctx = document.getElementById('chartReminders').getContext('2d');
    charts.chartReminders = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Date-Based',
                    data: snapshots.map(s => s.dateBasedReminders ?? 0),
                    borderColor: CHART_COLORS.blue,
                    backgroundColor: CHART_COLORS.blue,
                    tension: 0.25
                },
                {
                    label: 'Just Because',
                    data: snapshots.map(s => s.justBecauseReminders ?? 0),
                    borderColor: CHART_COLORS.gold,
                    backgroundColor: CHART_COLORS.gold,
                    tension: 0.25
                }
            ]
        },
        options: CHART_BASE_OPTIONS
    });
}

function renderSmsChart(labels, snapshots) {
    destroyChartIfExists('chartSms');

    // Cumulative SMS cost resets at the start of each calendar month —
    // this answers "how much have I spent so far THIS month" (what
    // actually matters for a pay-as-you-go balance), not an
    // ever-growing lifetime total that isn't directly actionable.
    let cumulativeCost = 0;
    let currentMonth = null;
    const cumulativeCosts = snapshots.map(s => {
        const monthKey = s.date ? s.date.slice(0, 7) : null; // 'YYYY-MM'
        if (monthKey !== currentMonth) {
            currentMonth = monthKey;
            cumulativeCost = 0;
        }
        cumulativeCost += s.smsCostTodayGbp ?? 0;
        return Math.round(cumulativeCost * 100) / 100;
    });

    const ctx = document.getElementById('chartSms').getContext('2d');
    charts.chartSms = new Chart(ctx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'SMS Sent',
                    data: snapshots.map(s => s.smsSentToday ?? 0),
                    backgroundColor: 'rgba(91, 141, 239, 0.5)',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Cumulative Cost This Month (£)',
                    data: cumulativeCosts,
                    borderColor: CHART_COLORS.gold,
                    backgroundColor: CHART_COLORS.gold,
                    tension: 0.25,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            ...CHART_BASE_OPTIONS,
            scales: {
                x: CHART_BASE_OPTIONS.scales.x,
                y: {
                    ...CHART_BASE_OPTIONS.scales.y,
                    position: 'left',
                    title: { display: true, text: 'Messages', color: '#6b7280', font: { size: 10 } }
                },
                y1: {
                    ...CHART_BASE_OPTIONS.scales.y,
                    position: 'right',
                    grid: { display: false },
                    title: { display: true, text: '£ this month', color: '#6b7280', font: { size: 10 } }
                }
            }
        }
    });
}
