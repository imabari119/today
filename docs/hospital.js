/**
 * 今治市救急病院情報システム
 * PC・スマホ最適化済み
 */

const state = {
    scheduleData: {},
    hospitalMaster: {},
    currentDate: null,
    isLoading: false
};

const CONFIG = {
    UPDATE_HOUR: 8,
    UPDATE_MINUTE: 30,
    CACHE_BUSTER: () => Date.now(),
    CSV_FILES: {
        SCHEDULE: 'schedule.csv',
        HOSPITAL: 'hospital.csv'
    },
    PAPAPARSE_PATH: './papaparse.min.js'
};

const SELECTORS = {
    DATE_DISPLAY: '#dateDisplay',
    HOSPITAL_LIST: '#hospitalList',
    PREV_BTN: '#prevBtn',
    NEXT_BTN: '#nextBtn'
};

const utils = {
    getJapanCurrentDate() {
        const now = new Date();
        const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        if (japanTime.getHours() < CONFIG.UPDATE_HOUR || 
            (japanTime.getHours() === CONFIG.UPDATE_HOUR && japanTime.getMinutes() < CONFIG.UPDATE_MINUTE)) {
            japanTime.setDate(japanTime.getDate() - 1);
        }
        return japanTime;
    },
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    formatDateDisplay(dateStr, week) {
        const formatted = dateStr.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, '$1年$2月$3日');
        return `${formatted} (${week})`;
    },
    showError(message, details = '') {
        const container = document.querySelector(SELECTORS.HOSPITAL_LIST);
        container.innerHTML = `
            <div class="bg-red-50 p-6 rounded-xl text-center border border-red-100 mx-2">
                <p class="text-red-600 font-bold text-lg">${message}</p>
                ${details ? `<p class="text-sm mt-2 text-red-500">${details}</p>` : ''}
            </div>
        `;
    },
    showLoading() {
        const container = document.querySelector(SELECTORS.HOSPITAL_LIST);
        container.innerHTML = `<div class="loading"><p class="text-text-secondary-light text-lg">読み込み中...</p></div>`;
    }
};

const initPapaParse = (() => {
    let initialized = false;
    return () => {
        if (initialized) return Promise.resolve();
        return new Promise((resolve, reject) => {
            if (typeof Papa !== 'undefined') { initialized = true; resolve(); return; }
            const script = document.createElement('script');
            script.src = CONFIG.PAPAPARSE_PATH;
            script.onload = () => { initialized = true; resolve(); };
            script.onerror = () => reject(new Error('PapaParseの読み込みに失敗しました'));
            document.head.appendChild(script);
        });
    };
})();

const csvHandler = {
    async parse(text) {
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true, skipEmptyLines: true,
                transformHeader: h => h.trim(), transform: v => v.trim(),
                complete: results => resolve(results.data), error: reject
            });
        });
    },
    async fetch(filename) {
        const url = `${filename}?v=${CONFIG.CACHE_BUSTER()}`;
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`${filename} が見つかりません`);
        return response.text();
    }
};

const dataProcessor = {
    createHospitalMaster(data) {
        const master = {};
        data.forEach(row => {
            if (!row.name) return;
            master[row.name] = {
                name: row.name, address: row.address || '-',
                tel: row.tel || '-', navi: row.navi || '#', link: row.link || '#'
            };
        });
        return master;
    },
    groupScheduleByDate(schedules, master) {
        const grouped = {};
        schedules.forEach(item => {
            if (!item.date || !item.name) return;
            const { date, name, week, medical, time } = item;
            const hospitalInfo = master[name] || { name, address: '-', tel: '-', navi: '#', link: '#' };
            if (!grouped[date]) grouped[date] = { date_week: utils.formatDateDisplay(date, week || ''), hospitals: [] };
            grouped[date].hospitals.push({ ...hospitalInfo, medical: medical || '指定なし', time: time || '-' });
        });
        return grouped;
    }
};

async function loadData() {
    if (state.isLoading) return;
    state.isLoading = true;
    utils.showLoading();
    try {
        await initPapaParse();
        const [sText, hText] = await Promise.all([csvHandler.fetch(CONFIG.CSV_FILES.SCHEDULE), csvHandler.fetch(CONFIG.CSV_FILES.HOSPITAL)]);
        const [schedules, hospitals] = await Promise.all([csvHandler.parse(sText), csvHandler.parse(hText)]);
        state.hospitalMaster = dataProcessor.createHospitalMaster(hospitals);
        state.scheduleData = dataProcessor.groupScheduleByDate(schedules, state.hospitalMaster);
        state.currentDate = utils.getJapanCurrentDate();
        renderHospitals();
        scheduleNextUpdate();
    } catch (e) {
        utils.showError('データの読み込みに失敗しました', e.message);
    } finally {
        state.isLoading = false;
    }
}

function renderHospitals() {
    const dateKey = utils.formatDate(state.currentDate);
    const data = state.scheduleData[dateKey];
    document.querySelector(SELECTORS.DATE_DISPLAY).textContent = data ? data.date_week : dateKey;
    const list = document.querySelector(SELECTORS.HOSPITAL_LIST);
    if (!data || data.hospitals.length === 0) {
        list.innerHTML = `<p class="text-center py-20 text-text-secondary-light text-lg">この日の救急病院情報はありません。</p>`;
        return;
    }
    list.innerHTML = data.hospitals.map(createHospitalCard).join('');
}

function createHospitalCard(h) {
    return `
        <div class="flex flex-col rounded-2xl bg-card-light p-5 shadow-sm border border-black/5">
            <h2 class="text-text-primary-light text-xl font-bold">
                <a href="${h.link}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline decoration-2 underline-offset-4">${h.name}</a>
            </h2>
            <div class="flex flex-col gap-4 pt-4">
                ${createInfoRow('medical_services', '診療', h.medical)}
                ${createInfoRow('schedule', '時間', h.time)}
                ${createInfoRow('location_on', '住所', h.address)}
                ${createInfoRow('call', '電話', h.tel)}
                <div class="flex items-center gap-3 pt-4 mt-2 border-t border-background-light">
                    ${createButton('call', 'tel:' + h.tel, '電話する', true)}
                    ${createButton('map', h.navi, '地図', false)}
                </div>
            </div>
        </div>
    `;
}

function createInfoRow(icon, label, value) {
    return `
        <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-text-secondary-light text-xl">${icon}</span>
            <p class="flex-1 text-text-secondary-light leading-snug">${label}: ${value}</p>
        </div>
    `;
}

function createButton(icon, href, text, isPrimary) {
    const bgClass = isPrimary ? 'bg-primary text-text-on-primary shadow-md active:opacity-90' : 'bg-primary/20 text-primary active:bg-primary/30';
    return `
        <a href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}
           class="flex flex-1 items-center justify-center rounded-xl h-14 px-4 ${bgClass} text-lg font-bold transition-all gap-2">
            <span class="material-symbols-outlined text-2xl">${icon}</span>
            <span class="truncate">${text}</span>
        </a>
    `;
}

function scheduleNextUpdate() {
    const now = new Date();
    const jTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const next = new Date(jTime);
    next.setHours(CONFIG.UPDATE_HOUR, CONFIG.UPDATE_MINUTE, 0, 0);
    if (jTime >= next) next.setDate(next.getDate() + 1);
    setTimeout(() => { state.currentDate = utils.getJapanCurrentDate(); renderHospitals(); scheduleNextUpdate(); }, next - jTime);
}

function changeDate(days) {
    state.currentDate.setDate(state.currentDate.getDate() + days);
    renderHospitals();
}

function initEventListeners() {
    document.querySelector(SELECTORS.PREV_BTN)?.addEventListener('click', () => changeDate(-1));
    document.querySelector(SELECTORS.NEXT_BTN)?.addEventListener('click', () => changeDate(1));
}

(function init() {
    initEventListeners();
    loadData();
})();
