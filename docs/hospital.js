let hospitalData = {};
let currentDate = null;

// === 日本時間の日付取得（8:30以前なら前日） ===
const getJapanCurrentDate = () => {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    if (japanTime.getHours() < 8 || (japanTime.getHours() === 8 && japanTime.getMinutes() < 30)) {
        japanTime.setDate(japanTime.getDate() - 1);
    }
    return japanTime;
};

// === 日付フォーマット ===
const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// === データ読み込み（最適化＋キャッシュバスティング対応） ===
const loadHospitalData = async () => {
    try {
        const timestamp = new Date().toISOString().split("T")[0];
        const url = `data.json?v=${timestamp}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            cache: "no-cache",
            signal: controller.signal,
            headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" },
        });

        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);

        hospitalData = await response.json();
        currentDate = getJapanCurrentDate();
        renderHospitals();
        scheduleNextUpdate();
    } catch (err) {
        console.error("データ読み込み失敗:", err);
        document.getElementById("hospitalList").innerHTML = `
          <div class="bg-red-50 p-4 rounded-lg text-center">
            <p class="text-red-600 font-medium">データの読み込みに失敗しました。</p>
            <p class="text-sm mt-2 text-red-600">data.json が同じディレクトリにあるか確認してください。</p>
            <p class="text-sm mt-1 text-red-600">ローカル環境では Webサーバーを使用する必要があります。</p>
          </div>`;
    }
};

// === 次の更新（日本時間8:30）を予約 ===
const scheduleNextUpdate = () => {
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const nextUpdate = new Date(japanTime);
    nextUpdate.setHours(8, 30, 0, 0);
    if (japanTime >= nextUpdate) nextUpdate.setDate(nextUpdate.getDate() + 1);
    setTimeout(() => {
        currentDate = getJapanCurrentDate();
        renderHospitals();
        scheduleNextUpdate();
    }, nextUpdate - japanTime);
};

// === 病院データ描画 ===
const renderHospitals = () => {
    const dateKey = formatDate(currentDate);
    const data = hospitalData[dateKey];
    const dateDisplay = document.getElementById("dateDisplay");
    const hospitalList = document.getElementById("hospitalList");

    if (!data) {
        dateDisplay.textContent = formatDate(currentDate);
        hospitalList.innerHTML = `<p class="text-center text-text-secondary-light">この日の救急病院情報はありません。</p>`;
        return;
    }

    dateDisplay.textContent = data.date_week;
    hospitalList.innerHTML = data.hospitals
        .map(
            (h) => `
          <div class="flex flex-col rounded-xl bg-card-light p-4 shadow-sm">
            <h2 class="text-text-primary-light text-xl font-bold">
              <a href="${h.link}" target="_blank" rel="noopener noreferrer" class="hover:underline text-primary">${h.name}</a>
            </h2>
            <div class="flex flex-col gap-3 pt-4">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light">medical_services</span>
                <p class="flex-1 text-text-secondary-light">診療: ${h.medical}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light">schedule</span>
                <p class="flex-1 text-text-secondary-light">時間: ${h.time}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light">location_on</span>
                <p class="flex-1 text-text-secondary-light">住所: ${h.address}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light">call</span>
                <p class="flex-1 text-text-secondary-light">電話: ${h.daytime}</p>
              </div>
            
              <!-- ボタン -->
              <div class="flex items-center gap-3 pt-2 mt-1 border-t border-background-light">
                <a href="tel:${h.daytime}" class="flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary text-text-on-primary text-base font-medium leading-normal gap-2">
                  <span class="material-symbols-outlined">call</span>
                  <span class="truncate">電話をかける</span>
                </a>
                <a href="${h.navi}" target="_blank" rel="noopener noreferrer" class="flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary/20 text-primary text-base font-medium leading-normal gap-2">
                  <span class="material-symbols-outlined">map</span>
                  <span class="truncate">地図を見る</span>
                </a>
              </div>
            </div>
          </div>`
        )
        .join("");
};

// === 日付ナビゲーション ===
document.getElementById("prevBtn").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderHospitals();
});
document.getElementById("nextBtn").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 1);
    renderHospitals();
});

// === 画面タッチ/クリックでの日付変更 ===
document.body.addEventListener("click", (e) => {
    // ボタンやリンクのクリックは無視
    if (e.target.closest("button, a")) return;

    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    // スマホ(768px未満)は1/5、タブレット・PCは1/10
    const ratio = screenWidth < 768 ? 5 : 10;
    const leftThreshold = screenWidth / ratio;
    const rightThreshold = screenWidth * (ratio - 1) / ratio;

    if (clickX < leftThreshold) {
        // 左1/5をクリック → 前の日
        currentDate.setDate(currentDate.getDate() - 1);
        renderHospitals();
    } else if (clickX > rightThreshold) {
        // 右1/5をクリック → 次の日
        currentDate.setDate(currentDate.getDate() + 1);
        renderHospitals();
    }
});

// === 初期読み込み ===
loadHospitalData();
