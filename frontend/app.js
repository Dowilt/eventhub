const API = '/api';

const CATEGORIES = [
    { name: 'Учёба', icon: 'school', color: '#2196F3' },
    { name: 'Спорт', icon: 'sports_soccer', color: '#4CAF50' },
    { name: 'Развлечения', icon: 'celebration', color: '#FF9800' },
    { name: 'Работа', icon: 'work', color: '#F44336' },
    { name: 'Личное', icon: 'favorite', color: '#E91E63' },
];

let events = [];
let selectedCategory = 'Все';
let searchQuery = '';
let currentEventId = null;
let snackbarTimer = null;
let deletedEvent = null;

// DOM elements
const eventsGrid = document.getElementById('events-grid');
const emptyState = document.getElementById('empty-state');
const chipsContainer = document.getElementById('chips-container');
const statsBar = document.getElementById('stats-bar');
const overlay = document.getElementById('overlay');
const bottomSheet = document.getElementById('bottom-sheet');
const eventForm = document.getElementById('event-form');
const snackbar = document.getElementById('snackbar');
const snackbarText = document.getElementById('snackbar-text');
const snackbarAction = document.getElementById('snackbar-action');
const sortPopup = document.getElementById('sort-popup');

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    renderChips();
    setupEventListeners();
});

// API calls
async function loadEvents() {
    try {
        const res = await fetch(`${API}/events`);
        events = await res.json();
        renderEvents();
    } catch (e) {
        console.error('Failed to load events:', e);
    }
}

async function createEvent(data) {
    const res = await fetch(`${API}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
}

async function updateEvent(id, data) {
    const res = await fetch(`${API}/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
}

async function deleteEvent(id) {
    await fetch(`${API}/events/${id}`, { method: 'DELETE' });
}

// Helpers
function getCategoryInfo(name) {
    return CATEGORIES.find(c => c.name === name) || { name, icon: 'event', color: '#9E9E9E' };
}

function formatDate(dateStr) {
    const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth() + 1]}`;
}

function formatFullDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function getFilteredEvents() {
    let filtered = events;
    if (selectedCategory !== 'Все') {
        filtered = filtered.filter(e => e.category === selectedCategory);
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(e => e.title.toLowerCase().includes(q));
    }
    return filtered;
}

// Rendering
function renderChips() {
    const allChip = `<button class="chip ${selectedCategory === 'Все' ? 'selected' : ''}" data-category="Все">
        <span class="material-icons">apps</span>Все
    </button>`;
    const catChips = CATEGORIES.map(c =>
        `<button class="chip ${selectedCategory === c.name ? 'selected' : ''}" data-category="${c.name}">
            <span class="material-icons">${c.icon}</span>${c.name}
        </button>`
    ).join('');
    chipsContainer.innerHTML = allChip + catChips;

    chipsContainer.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.dataset.category;
            selectedCategory = (selectedCategory === cat && cat !== 'Все') ? 'Все' : cat;
            renderChips();
            renderEvents();
        });
    });
}

function renderStatsBar() {
    const filtered = getFilteredEvents();
    const icon = '<span class="material-icons">event_note</span>';
    if (selectedCategory === 'Все') {
        statsBar.innerHTML = `${icon} Всего событий: ${events.length}`;
    } else {
        statsBar.innerHTML = `${icon} ${selectedCategory}: ${filtered.length} из ${events.length}`;
    }
}

function renderEvents() {
    const filtered = getFilteredEvents();
    renderStatsBar();

    if (filtered.length === 0) {
        eventsGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    eventsGrid.innerHTML = filtered.map(event => {
        const cat = getCategoryInfo(event.category);
        return `<div class="event-card" data-id="${event.id}">
            <button class="card-delete" data-id="${event.id}" title="Удалить">
                <span class="material-icons">close</span>
            </button>
            <div class="card-header" style="background: linear-gradient(135deg, ${cat.color}B3, ${cat.color}66)">
                <div class="card-emoji">${event.emoji}</div>
                <div class="card-title">${escapeHtml(event.title)}</div>
            </div>
            <div class="card-info">
                <div class="card-info-row">
                    <span class="material-icons">calendar_today</span>
                    <span class="text">${formatDate(event.date)}</span>
                    <span class="material-icons" style="margin-left:4px">access_time</span>
                    <span class="text">${event.time}</span>
                </div>
                <div class="card-info-row">
                    <span class="material-icons">location_on</span>
                    <span class="text">${escapeHtml(event.location || 'Не указано')}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    // Card click -> detail
    eventsGrid.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-delete')) return;
            const id = parseInt(card.dataset.id);
            openDetail(id);
        });
    });

    // Delete buttons
    eventsGrid.querySelectorAll('.card-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            handleDelete(id);
        });
    });

    // Touch swipe support
    eventsGrid.querySelectorAll('.event-card').forEach(card => {
        let startX = 0;
        let currentX = 0;
        let swiping = false;

        card.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            swiping = true;
        });
        card.addEventListener('touchmove', (e) => {
            if (!swiping) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            if (diff < -20) {
                card.style.transform = `translateX(${diff}px)`;
            }
        });
        card.addEventListener('touchend', () => {
            const diff = currentX - startX;
            if (diff < -100) {
                card.classList.add('dismissed');
                setTimeout(() => {
                    const id = parseInt(card.dataset.id);
                    handleDelete(id);
                }, 300);
            } else {
                card.style.transform = '';
            }
            swiping = false;
            currentX = 0;
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleDelete(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    deletedEvent = { ...event };
    events = events.filter(e => e.id !== id);
    renderEvents();

    await deleteEvent(id);
    showSnackbar(`${event.title} удалено`, async () => {
        // Undo - recreate event
        const restored = await createEvent({
            title: deletedEvent.title,
            description: deletedEvent.description,
            location: deletedEvent.location,
            category: deletedEvent.category,
            date: deletedEvent.date,
            time: deletedEvent.time,
            participants: deletedEvent.participants,
            emoji: deletedEvent.emoji,
        });
        events.push(restored);
        renderEvents();
        deletedEvent = null;
    });
}

function showSnackbar(text, onUndo) {
    if (snackbarTimer) clearTimeout(snackbarTimer);
    snackbarText.textContent = text;
    snackbar.classList.remove('hidden');

    snackbarAction.onclick = () => {
        snackbar.classList.add('hidden');
        if (onUndo) onUndo();
    };

    snackbarTimer = setTimeout(() => {
        snackbar.classList.add('hidden');
    }, 5000);
}

// Detail screen
function openDetail(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;
    currentEventId = id;

    const cat = getCategoryInfo(event.category);
    const detailBar = document.getElementById('detail-bar');
    detailBar.style.background = `${cat.color}4D`;
    document.getElementById('detail-title').textContent = event.title;

    const participants = event.participants ? event.participants.split(',').filter(p => p.trim()) : [];

    document.getElementById('detail-content').innerHTML = `
        <div class="detail-banner" style="background: linear-gradient(135deg, ${cat.color}99, ${cat.color}33)">
            <span class="banner-emoji">${event.emoji}</span>
            <div class="banner-content">
                <div class="category-badge">
                    <span class="material-icons">${cat.icon}</span>
                    ${cat.name}
                </div>
                <div class="banner-title">${escapeHtml(event.title)}</div>
            </div>
        </div>

        <div class="info-card">
            <div class="info-row">
                <span class="material-icons" style="color:${cat.color}">calendar_today</span>
                <div>
                    <div class="info-label">Дата</div>
                    <div class="info-value">${formatFullDate(event.date)}</div>
                </div>
            </div>
            <hr class="info-divider">
            <div class="info-row">
                <span class="material-icons" style="color:${cat.color}">access_time</span>
                <div>
                    <div class="info-label">Время</div>
                    <div class="info-value">${event.time}</div>
                </div>
            </div>
            <hr class="info-divider">
            <div class="info-row">
                <span class="material-icons" style="color:${cat.color}">location_on</span>
                <div>
                    <div class="info-label">Место</div>
                    <div class="info-value">${escapeHtml(event.location || 'Не указано')}</div>
                </div>
            </div>
        </div>

        <div class="expansion-tile">
            <div class="expansion-header expanded" data-target="desc-body">
                <span class="material-icons" style="color:${cat.color}">description</span>
                <span class="exp-title">Описание</span>
                <span class="material-icons arrow">expand_more</span>
            </div>
            <div class="expansion-body open" id="desc-body">
                <div class="expansion-body-inner">
                    <p>${escapeHtml(event.description || 'Без описания')}</p>
                </div>
            </div>
        </div>

        <div class="expansion-tile">
            <div class="expansion-header" data-target="part-body">
                <span class="material-icons" style="color:${cat.color}">people</span>
                <span class="exp-title">Участники (${participants.length})</span>
                <span class="material-icons arrow">expand_more</span>
            </div>
            <div class="expansion-body" id="part-body">
                <div class="expansion-body-inner">
                    ${participants.length > 0 ? participants.map(name => `
                        <div class="participant-item">
                            <div class="participant-avatar" style="background:${cat.color}33;color:${cat.color}">
                                ${escapeHtml(name.trim()[0] || '?')}
                            </div>
                            <span>${escapeHtml(name.trim())}</span>
                        </div>
                    `).join('') : '<p style="color:#999;padding:8px 0">Нет участников</p>'}
                </div>
            </div>
        </div>
    `;

    // Expansion tile toggles
    document.querySelectorAll('.expansion-header').forEach(header => {
        header.addEventListener('click', () => {
            const target = document.getElementById(header.dataset.target);
            header.classList.toggle('expanded');
            target.classList.toggle('open');
        });
    });

    showScreen('detail-screen');
}

// Statistics screen
async function openStats() {
    try {
        const res = await fetch(`${API}/stats`);
        const stats = await res.json();
        renderStats(stats);
        showScreen('stats-screen');
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

function renderStats(stats) {
    const content = document.getElementById('stats-content');
    const total = stats.total || 0;

    let nearestHtml = '';
    if (stats.nearest) {
        nearestHtml = `<div class="stats-nearest">
            Ближайшее: <strong>${escapeHtml(stats.nearest.title)}</strong> — ${formatDate(stats.nearest.date)}, ${stats.nearest.time}
        </div>`;
    }

    const catCards = CATEGORIES.map(cat => {
        const count = stats.by_category[cat.name] || 0;
        const fraction = total > 0 ? count / total : 0;
        const dashOffset = 150.8 * (1 - fraction);
        return `<div class="stat-card">
            <div class="stat-progress">
                <svg viewBox="0 0 60 60">
                    <circle class="bg" cx="30" cy="30" r="24"/>
                    <circle class="fg" cx="30" cy="30" r="24" stroke="${cat.color}" stroke-dashoffset="${dashOffset}"/>
                </svg>
                <span class="stat-num">${count}</span>
            </div>
            <div class="stat-info">
                <div class="stat-name">${cat.name}</div>
                <div class="stat-bar">
                    <div class="stat-bar-fill" style="width:${fraction * 100}%;background:${cat.color}"></div>
                </div>
            </div>
        </div>`;
    }).join('');

    let upcomingHtml = '';
    if (stats.upcoming && stats.upcoming.length > 0) {
        upcomingHtml = stats.upcoming.map((event, i) => {
            const cat = getCategoryInfo(event.category);
            return `<div class="expansion-tile">
                <div class="expansion-header" data-target="upcoming-${i}">
                    <span class="material-icons" style="color:${cat.color}">${cat.icon}</span>
                    <span class="exp-title">${escapeHtml(event.title)}</span>
                    <span class="material-icons arrow">expand_more</span>
                </div>
                <div class="expansion-body" id="upcoming-${i}">
                    <div class="expansion-body-inner">
                        <p><strong>Дата:</strong> ${formatFullDate(event.date)}, ${event.time}</p>
                        <p><strong>Место:</strong> ${escapeHtml(event.location || 'Не указано')}</p>
                        <p><strong>Описание:</strong> ${escapeHtml(event.description || 'Без описания')}</p>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    content.innerHTML = `
        <div class="stats-summary">
            <div class="stats-total">${total}</div>
            <div class="stats-total-label">Всего событий</div>
            ${nearestHtml}
        </div>
        <div class="stats-categories">${catCards}</div>
        <div class="stats-section-title">Ближайшие 3 события</div>
        ${upcomingHtml || '<p style="color:#999;text-align:center">Нет предстоящих событий</p>'}
    `;

    // Expansion tiles in stats
    content.querySelectorAll('.expansion-header').forEach(header => {
        header.addEventListener('click', () => {
            const target = document.getElementById(header.dataset.target);
            header.classList.toggle('expanded');
            target.classList.toggle('open');
        });
    });
}

// Screen navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Bottom Sheet
function openSheet(editEvent = null) {
    document.getElementById('form-event-id').value = editEvent ? editEvent.id : '';
    document.getElementById('form-title').value = editEvent ? editEvent.title : '';
    document.getElementById('form-description').value = editEvent ? editEvent.description : '';
    document.getElementById('form-location').value = editEvent ? editEvent.location : '';
    document.getElementById('form-date').value = editEvent ? editEvent.date : new Date().toISOString().split('T')[0];
    document.getElementById('form-time').value = editEvent ? editEvent.time : '12:00';
    document.getElementById('form-participants').value = editEvent ? editEvent.participants : '';

    // Populate category dropdown
    const catSelect = document.getElementById('form-category');
    catSelect.innerHTML = CATEGORIES.map(c =>
        `<option value="${c.name}" ${editEvent && editEvent.category === c.name ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    document.getElementById('sheet-title').textContent = editEvent ? 'Редактировать событие' : 'Новое событие';
    document.getElementById('btn-submit-text').textContent = editEvent ? 'Сохранить' : 'Создать событие';

    overlay.classList.remove('hidden');
    // Small delay for animation
    requestAnimationFrame(() => {
        bottomSheet.classList.remove('hidden');
    });
}

function closeSheet() {
    bottomSheet.classList.add('hidden');
    overlay.classList.add('hidden');
    eventForm.reset();
}

// Event listeners
function setupEventListeners() {
    // FAB
    document.getElementById('btn-add').addEventListener('click', () => openSheet());

    // Close sheet
    document.getElementById('btn-sheet-close').addEventListener('click', closeSheet);
    overlay.addEventListener('click', closeSheet);

    // Form submit
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('form-event-id').value;
        const data = {
            title: document.getElementById('form-title').value,
            description: document.getElementById('form-description').value || 'Без описания',
            location: document.getElementById('form-location').value || 'Не указано',
            category: document.getElementById('form-category').value,
            date: document.getElementById('form-date').value,
            time: document.getElementById('form-time').value,
            participants: document.getElementById('form-participants').value,
            emoji: getEmojiForCategory(document.getElementById('form-category').value),
        };

        if (id) {
            const updated = await updateEvent(parseInt(id), data);
            const idx = events.findIndex(ev => ev.id === parseInt(id));
            if (idx !== -1) events[idx] = updated;
        } else {
            const created = await createEvent(data);
            events.push(created);
        }

        closeSheet();
        renderEvents();

        // If on detail screen, refresh it
        if (id && document.getElementById('detail-screen').classList.contains('active')) {
            openDetail(parseInt(id));
        }
    });

    // Back from detail
    document.getElementById('btn-back').addEventListener('click', () => {
        showScreen('main-screen');
        loadEvents(); // Refresh
    });

    // Edit button on detail
    document.getElementById('btn-edit').addEventListener('click', () => {
        const event = events.find(e => e.id === currentEventId);
        if (event) openSheet(event);
    });

    // Search
    document.getElementById('btn-search').addEventListener('click', () => {
        document.getElementById('app-bar-normal').classList.add('hidden');
        document.getElementById('app-bar-search').classList.remove('hidden');
        document.getElementById('search-input').focus();
    });
    document.getElementById('btn-search-back').addEventListener('click', () => {
        searchQuery = '';
        document.getElementById('search-input').value = '';
        document.getElementById('app-bar-search').classList.add('hidden');
        document.getElementById('app-bar-normal').classList.remove('hidden');
        renderEvents();
    });
    document.getElementById('btn-search-clear').addEventListener('click', () => {
        searchQuery = '';
        document.getElementById('search-input').value = '';
        document.getElementById('search-input').focus();
        renderEvents();
    });
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderEvents();
    });

    // Sort
    document.getElementById('btn-sort').addEventListener('click', (e) => {
        e.stopPropagation();
        sortPopup.classList.toggle('hidden');
    });
    document.addEventListener('click', () => sortPopup.classList.add('hidden'));

    document.querySelectorAll('.sort-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const sortBy = opt.dataset.sort;
            if (sortBy === 'date') {
                events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
            } else if (sortBy === 'title') {
                events.sort((a, b) => a.title.localeCompare(b.title));
            } else if (sortBy === 'category') {
                events.sort((a, b) => a.category.localeCompare(b.category));
            }
            sortPopup.classList.add('hidden');
            renderEvents();
        });
    });

    // Stats
    document.getElementById('btn-stats').addEventListener('click', () => openStats());
    document.getElementById('btn-stats-back').addEventListener('click', () => {
        showScreen('main-screen');
    });
}

function getEmojiForCategory(category) {
    const map = {
        'Учёба': '📚',
        'Спорт': '⚽',
        'Развлечения': '🎬',
        'Работа': '💻',
        'Личное': '🎂',
    };
    return map[category] || '📌';
}
