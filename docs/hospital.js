/**
 * 今治市救急病院情報システム
 * CSV読み込み・表示・日付ナビゲーション
 */

// ===== 状態管理 =====
const state = {
    scheduleData: {},
    hospitalMaster: {},
    currentDate: null,
    isLoading: false
};

// ===== 定数 =====
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

// ===== ユーティリティ関数 =====
const utils = {
    // 日本時間の現在日付を取得（8:30以前なら前日）
    getJapanCurrentDate() {
        const now = new Date();
        const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        
        if (japanTime.getHours() < CONFIG.UPDATE_HOUR || 
            (japanTime.getHours() === CONFIG.UPDATE_HOUR && japanTime.getMinutes() < CONFIG.UPDATE_MINUTE)) {
            japanTime.setDate(japanTime.getDate() - 1);
        }
        
        return japanTime;
    },

    // 日付を YYYY-MM-DD 形式にフォーマット
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 日付文字列を表示用にフォーマット
    formatDateDisplay(dateStr, week) {
        const formatted = dateStr
            .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, '$1年$2月$3日');
        return `${formatted} ${week}`;
    },

    // エラーメッセージを表示
    showError(message, details = '') {
        const container = document.querySelector(SELECTORS.HOSPITAL_LIST);
        container.innerHTML = `
            <div class="bg-red-50 p-4 rounded-lg text-center">
                <p class="text-red-600 font-medium">${message}</p>
                ${details ? `<p class="text-sm mt-2 text-red-600">${details}</p>` : ''}
            </div>
        `;
    },

    // ローディング表示
    showLoading() {
        const container = document.querySelector(SELECTORS.HOSPITAL_LIST);
        container.innerHTML = `
            <div class="loading">
                <p class="text-text-secondary-light">読み込み中...</p>
            </div>
        `;
    }
};

// ===== PapaParse 初期化 =====
const initPapaParse = (() => {
    let initialized = false;
    
    return () => {
        if (initialized) return Promise.resolve();
        
        return new Promise((resolve, reject) => {
            if (typeof Papa !== 'undefined') {
                initialized = true;
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = CONFIG.PAPAPARSE_PATH;
            script.onload = () => {
                initialized = true;
                resolve();
            };
            script.onerror = () => reject(new Error('PapaParse読み込み失敗: papaparse.min.js が見つかりません'));
            document.head.appendChild(script);
        });
    };
})();

// ===== CSV処理 =====
const csvHandler = {
    // CSVをパース
    async parse(text) {
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: header => header.trim(),
                transform: value => value.trim(),
                complete: results => {
                    if (results.errors.length > 0) {
                        console.warn('CSV解析警告:', results.errors);
                    }
                    resolve(results.data);
                },
                error: reject
            });
        });
    },

    // CSVファイルを取得
    async fetch(filename) {
        const url = `${filename}?v=${CONFIG.CACHE_BUSTER()}`;
        const response = await fetch(url, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            throw new Error(`${filename} の読み込みに失敗しました (${response.status})`);
        }
        
        return response.text();
    }
};

// ===== データ処理 =====
const dataProcessor = {
    // 病院マスタを作成
    createHospitalMaster(data) {
        const master = {};
        
        data.forEach(row => {
            if (!row.name) return;
            
            master[row.name] = {
                name: row.name,
                address: row.address || '-',
                tel: row.tel || '-',
                navi: row.navi || '#',
                link: row.link || '#'
            };
        });
        
        return master;
    },

    // スケジュールを日付ごとにグループ化
    groupScheduleByDate(schedules, master) {
        const grouped = {};
        
        schedules.forEach(item => {
            if (!item.date || !item.name) return;
            
            const { date, name, week, medical, time } = item;
            const hospitalInfo = master[name] || {
                name,
                address: '-',
                tel: '-',
                navi: '#',
                link: '#'
            };
            
            if (!grouped[date]) {
                grouped[date] = {
                    date_week: utils.formatDateDisplay(date, week || ''),
                    hospitals: []
                };
            }
            
            grouped[date].hospitals.push({
                ...hospitalInfo,
                medical: medical || '指定なし',
                time: time || '-'
            });
        });
        
        return grouped;
    }
};

// ===== データ読み込み =====
async function loadData() {
    if (state.isLoading) return;
    
    state.isLoading = true;
    utils.showLoading();
    
    try {
        // PapaParse初期化
        await initPapaParse();
        
        // CSV読み込み（並列処理）
        const [scheduleText, hospitalText] = await Promise.all([
            csvHandler.fetch(CONFIG.CSV_FILES.SCHEDULE),
            csvHandler.fetch(CONFIG.CSV_FILES.HOSPITAL)
        ]);
        
        // CSVパース（並列処理）
        const [schedules, hospitals] = await Promise.all([
            csvHandler.parse(scheduleText),
            csvHandler.parse(hospitalText)
        ]);
        
        // データ統合
        state.hospitalMaster = dataProcessor.createHospitalMaster(hospitals);
        state.scheduleData = dataProcessor.groupScheduleByDate(schedules, state.hospitalMaster);
        
        // 初期表示
        state.currentDate = utils.getJapanCurrentDate();
        renderHospitals();
        scheduleNextUpdate();
        
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        utils.showError(
            'データの読み込みに失敗しました。',
            `${error.message}<br>latest.csv と hospital.csv が同じディレクトリにあるか確認してください。`
        );
    } finally {
        state.isLoading = false;
    }
}

// ===== UI描画 =====
function renderHospitals() {
    const dateKey = utils.formatDate(state.currentDate);
    const data = state.scheduleData[dateKey];
    
    const dateDisplay = document.querySelector(SELECTORS.DATE_DISPLAY);
    const hospitalList = document.querySelector(SELECTORS.HOSPITAL_LIST);
    
    // 日付表示
    dateDisplay.textContent = data ? data.date_week : dateKey;
    
    // 病院リスト
    if (!data || data.hospitals.length === 0) {
        hospitalList.innerHTML = `
            <p class="text-center text-text-secondary-light">この日の救急病院情報はありません。</p>
        `;
        return;
    }
    
    hospitalList.innerHTML = data.hospitals.map(createHospitalCard).join('');
}

// 病院カードのHTML生成
function createHospitalCard(hospital) {
    const { name, link, medical, time, address, tel, navi } = hospital;
    
    return `
        <div class="flex flex-col rounded-xl bg-card-light p-4 shadow-sm">
            <h2 class="text-text-primary-light text-xl font-bold">
                <a href="${link}" target="_blank" rel="noopener noreferrer" 
                   class="hover:underline text-primary">${name}</a>
            </h2>
            <div class="flex flex-col gap-3 pt-4">
                ${createInfoRow('medical_services', '診療', medical)}
                ${createInfoRow('schedule', '時間', time)}
                ${createInfoRow('location_on', '住所', address)}
                ${createInfoRow('call', '電話', tel)}
                
                <div class="flex items-center gap-3 pt-2 mt-1 border-t border-background-light">
                    ${createButton('call', 'tel:' + tel, '電話をかける', true)}
                    ${createButton('map', navi, '地図を見る', false)}
                </div>
            </div>
        </div>
    `;
}

// 情報行のHTML生成
function createInfoRow(icon, label, value) {
    return `
        <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-text-secondary-light">${icon}</span>
            <p class="flex-1 text-text-secondary-light">${label}: ${value}</p>
        </div>
    `;
}

// ボタンのHTML生成
function createButton(icon, href, text, isPrimary) {
    const bgClass = isPrimary 
        ? 'bg-primary text-text-on-primary' 
        : 'bg-primary/20 text-primary';
    
    return `
        <a href="${href}" 
           ${href.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}
           class="flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 ${bgClass} text-base font-medium leading-normal gap-2">
            <span class="material-symbols-outlined">${icon}</span>
            <span class="truncate">${text}</span>
        </a>
    `;
}

// ===== 自動更新スケジューリング =====
function scheduleNextUpdate() {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    
    const nextUpdate = new Date(japanTime);
    nextUpdate.setHours(CONFIG.UPDATE_HOUR, CONFIG.UPDATE_MINUTE, 0, 0);
    
    if (japanTime >= nextUpdate) {
        nextUpdate.setDate(nextUpdate.getDate() + 1);
    }
    
    const delay = nextUpdate - japanTime;
    
    setTimeout(() => {
        state.currentDate = utils.getJapanCurrentDate();
        renderHospitals();
        scheduleNextUpdate();
    }, delay);
}

// ===== 日付ナビゲーション =====
function changeDate(days) {
    state.currentDate.setDate(state.currentDate.getDate() + days);
    renderHospitals();
}

// ===== イベントリスナー =====
function initEventListeners() {
    // 日付ナビゲーションボタン
    document.querySelector(SELECTORS.PREV_BTN)?.addEventListener('click', () => changeDate(-1));
    document.querySelector(SELECTORS.NEXT_BTN)?.addEventListener('click', () => changeDate(1));
}

// ===== 初期化 =====
(function init() {
    initEventListeners();
    loadData();
})();
