import { auth, db } from "./firebase-config.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    orderBy, 
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Global Variables
let currentLeaderUid = null;
let currentFilter = "today";
let unsubscribe = null;
let charts = {
    repeat: null,
    category: null,
    trend: null
};

// DOM Elements
const elements = {
    totalViolations: document.getElementById("total-violations"),
    topCategory: document.getElementById("top-category"),
    veryFrequentRatio: document.getElementById("very-frequent-ratio"),
    uniqueStudents: document.getElementById("unique-students"),
    dateFilters: document.getElementById("date-filters"),
    customDateContainer: document.getElementById("custom-date-container"),
    startDate: document.getElementById("start-date"),
    endDate: document.getElementById("end-date"),
    emptyState: document.getElementById("empty-state"),
    analyticsContent: document.getElementById("analytics-content"),
    userName: document.getElementById("user-display-name"),
    userAvatar: document.getElementById("user-avatar")
};

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentLeaderUid = user.uid;
        elements.userName.textContent = user.displayName || "القائد";
        elements.userAvatar.textContent = (user.displayName || "ق").charAt(0);
        initDashboard();
    } else {
        window.location.href = "index.html";
    }
});

// 2. Initialize Dashboard
function initDashboard() {
    setupEventListeners();
    applyFilter("today");
}

function setupEventListeners() {
    // Filter Buttons
    elements.dateFilters.addEventListener("click", (e) => {
        const btn = e.target.closest(".filter-btn");
        if (!btn) return;

        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filter = btn.dataset.filter;
        currentFilter = filter;

        if (filter === "custom") {
            elements.customDateContainer.style.display = "flex";
        } else {
            elements.customDateContainer.style.display = "none";
            applyFilter(filter);
        }
    });

    // Custom Date Change
    elements.startDate.addEventListener("change", checkCustomDates);
    elements.endDate.addEventListener("change", checkCustomDates);
}

function checkCustomDates() {
    if (elements.startDate.value && elements.endDate.value) {
        applyFilter("custom");
    }
}

// 3. Data Fetching
function applyFilter(filter) {
    if (unsubscribe) unsubscribe();

    let start, end;
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    if (filter === "today") {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
    } else if (filter === "yesterday") {
        start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
    } else if (filter === "7days") {
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
    } else if (filter === "30days") {
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
    } else if (filter === "custom") {
        start = new Date(elements.startDate.value);
        start.setHours(0, 0, 0, 0);
        end = new Date(elements.endDate.value);
        end.setHours(23, 59, 59, 999);
    }

    const q = query(
        collection(db, "violations"),
        where("leaderUid", "==", currentLeaderUid),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end)),
        orderBy("timestamp", "desc")
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateUI(data, start, end);
    });
}

// 4. UI Update
function updateUI(data, start, end) {
    if (data.length === 0) {
        elements.analyticsContent.style.display = "none";
        elements.emptyState.style.display = "flex";
        return;
    }

    elements.analyticsContent.style.display = "flex";
    elements.emptyState.style.display = "none";

    // KPIs
    const total = data.length;
    elements.totalViolations.textContent = total;

    // Unique Students
    const uniqueStudents = new Set(data.map(v => v.studentName)).size;
    elements.uniqueStudents.textContent = uniqueStudents;

    // Very Frequent Ratio
    const veryFrequentCount = data.filter(v => v.repeatCount === "متكرر جداً").length;
    const ratio = total > 0 ? ((veryFrequentCount / total) * 100).toFixed(1) : 0;
    elements.veryFrequentRatio.textContent = `${ratio}%`;

    // Top Category
    const categories = data.reduce((acc, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + 1;
        return acc;
    }, {});
    const sortedCategories = Object.entries(categories).sort((a,b) => b[1] - a[1]);
    elements.topCategory.textContent = sortedCategories.length > 0 ? sortedCategories[0][0] : "—";

    // Charts
    updateCharts(data, sortedCategories, start, end);
}

// 5. Charts Logic
function updateCharts(data, sortedCategories, start, end) {
    // 1. Repeat Chart (Donut)
    const repeatData = {
        "غير متكرر": data.filter(v => v.repeatCount === "غير متكرر").length,
        "متكرر": data.filter(v => v.repeatCount === "متكرر").length,
        "متكرر جداً": data.filter(v => v.repeatCount === "متكرر جداً").length
    };

    renderRepeatChart(repeatData);

    // 2. Category Chart (Horizontal Bar)
    renderCategoryChart(sortedCategories.slice(0, 10));

    // 3. Trend Chart (Line)
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const lineChartCard = document.getElementById("line-chart-card");
    
    if (diffDays > 1) {
        lineChartCard.style.display = "flex";
        renderTrendChart(data, start, end);
    } else {
        lineChartCard.style.display = "none";
    }
}

function renderRepeatChart(repeatData) {
    const ctx = document.getElementById('repeatChart').getContext('2d');
    if (charts.repeat) charts.repeat.destroy();

    charts.repeat = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(repeatData),
            datasets: [{
                data: Object.values(repeatData),
                backgroundColor: ['#00e676', '#ff9100', '#ff4d6d'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#e8f4fd', font: { family: 'Cairo' } } }
            }
        }
    });
}

function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (charts.category) charts.category.destroy();

    charts.category = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories.map(c => c[0]),
            datasets: [{
                label: 'عدد المخالفات',
                data: categories.map(c => c[1]),
                backgroundColor: '#00c6ff',
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(232, 244, 253, 0.05)' }, border: { display: false }, ticks: { color: '#5a7a96', font: { family: 'Cairo' } } },
                y: { grid: { display: false }, border: { display: false }, ticks: { color: '#e8f4fd', font: { family: 'Cairo' } } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTrendChart(data, start, end) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    if (charts.trend) charts.trend.destroy();

    // Group by day
    const days = {};
    let current = new Date(start);
    while (current <= end) {
        const dayKey = current.toLocaleDateString('en-GB');
        days[dayKey] = 0;
        current.setDate(current.getDate() + 1);
    }

    data.forEach(v => {
        if (v.timestamp) {
            const date = v.timestamp.toDate();
            const dayKey = date.toLocaleDateString('en-GB');
            if (days[dayKey] !== undefined) days[dayKey]++;
        }
    });

    const labels = Object.keys(days);
    const chartData = Object.values(days);

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'المخالفات',
                data: chartData,
                borderColor: '#00c6ff',
                backgroundColor: 'rgba(0, 198, 255, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#00c6ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#5a7a96', font: { family: 'Cairo' } } },
                y: { grid: { color: 'rgba(232, 244, 253, 0.05)' }, ticks: { color: '#e8f4fd', font: { family: 'Cairo' }, stepSize: 1 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}
