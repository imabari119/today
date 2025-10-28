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
          <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
            <p class="text-red-600 dark:text-red-400 font-medium">データの読み込みに失敗しました。</p>
            <p class="text-sm mt-2 text-red-600 dark:text-red-400">data.json が同じディレクトリにあるか確認してください。</p>
            <p class="text-sm mt-1 text-red-600 dark:text-red-400">ローカル環境では Webサーバーを使用する必要があります。</p>
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
    hospitalList.innerHTML = `<p class="text-center text-text-secondary-light dark:text-text-secondary-dark">この日の救急病院情報はありません。</p>`;
    return;
  }

  dateDisplay.textContent = data.date_week;
  hospitalList.innerHTML = data.hospitals
    .map(
      (h) => `
          <div class="flex flex-col rounded-xl bg-card-light dark:bg-card-dark p-4 shadow-sm">
            <h2 class="text-text-primary-light dark:text-text-primary-dark text-xl font-bold">
              <a href="${h.link}" target="_blank" rel="noopener noreferrer" class="hover:underline text-primary">${h.name}</a>
            </h2>
            <div class="flex flex-col gap-3 pt-4">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">medical_services</span>
                <p class="flex-1 text-text-secondary-light dark:text-text-secondary-dark">診療: ${h.medical}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">schedule</span>
                <p class="flex-1 text-text-secondary-light dark:text-text-secondary-dark">時間: ${h.time}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">location_on</span>
                <p class="flex-1 text-text-secondary-light dark:text-text-secondary-dark">住所: ${h.address}</p>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">call</span>
                <p class="flex-1 text-text-secondary-light dark:text-text-secondary-dark">電話: ${h.daytime}</p>
              </div>
            
              <!-- ボタン -->
              <div class="flex items-center gap-3 pt-2 mt-1 border-t border-background-light dark:border-background-dark">
                <a href="tel:${h.daytime}" class="flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary text-text-on-primary text-base font-medium leading-normal gap-2">
                  <span class="material-symbols-outlined">call</span>
                  <span class="truncate">電話をかける</span>
                </a>
                <a href="${h.navi}" target="_blank" rel="noopener noreferrer" class="flex flex-1 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary/20 dark:bg-primary/30 text-primary text-base font-medium leading-normal gap-2">
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

// === 初期読み込み ===
loadHospitalData();
