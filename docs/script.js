const getDateFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  const d = params.get("date");
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};

const isoDateWithOffset = (msOffset = 0) => {
  const d = new Date(Date.now() + msOffset);
  return d.toISOString().slice(0, 10);
};

const fetchHospitalData = async () => {
  try {
    const res = await fetch("data.json", { cache: "default" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("fetchHospitalData error:", err);
    return {};
  }
};

const sanitizeUrl = (url) => {
  try {
    // create absolute URL, allow relative links
    return new URL(url, location.href).href;
  } catch (e) {
    return "#";
  }
};

const createHospitalCard = (h) => {
  const link = sanitizeUrl(h.link || "#");
  const navi = sanitizeUrl(h.navi || "#");
  const name = h.name || "";
  const medical = h.medical || "";
  const time = h.time || "";
  const address = h.address || "";
  const daytime = h.daytime || "";

  return `
    <div class="column is-12-tablet is-8-desktop is-offset-2-desktop">
      <div class="card">
        <div class="card-content">
          <h3 class="subtitle is-5">
            <a href="${link}" target="_blank" rel="noopener noreferrer">${name}</a>
          </h3>
          <div class="content">
            <p><span class="tag is-danger"><i class="fas fa-medkit"></i>診療</span><span class="text">${medical}</span></p>
            <p><span class="tag is-danger"><i class="fas fa-clock"></i>時間</span><span class="text">${time}</span></p>
            <p><span class="tag is-danger"><i class="fas fa-map-marker-alt"></i>住所</span><span class="text"><a href="${navi}" target="_blank" rel="noopener noreferrer">${address}</a></span></p>
            <p><span class="tag is-danger"><i class="fas fa-phone"></i>電話</span><span class="text"><a href="tel:${daytime}">${daytime}</a></span></p>
          </div>
        </div>
      </div>
    </div>`;
};

const renderHospitals = (hospitalData = {}, dates = []) => {
  const container = document.getElementById("hospitalList");
  if (!container) {
    console.warn("No #hospitalList element found");
    return;
  }

  container.style.minHeight = "";
  const parts = [];
  dates.forEach((date) => {
    const dayData = hospitalData[date];
    if (dayData && Array.isArray(dayData.hospitals) && dayData.hospitals.length) {
      parts.push(`<h2 class="title is-4 has-text-centered">${dayData.date_week || date}</h2>`);
      parts.push('<div class="columns is-multiline">');
      parts.push(dayData.hospitals.map(createHospitalCard).join(""));
      parts.push('</div>');
    } else {
      parts.push(`<h2 class="title is-4 has-text-centered">エラー</h2>`);
      parts.push(`
        <div class="columns is-multiline">
          <div class="column is-12-tablet is-8-desktop is-offset-2-desktop">
            <div class="card is-warning">
              <div class="card-content">
                <h3 class="subtitle is-5">当番医情報が見つかりません</h3>
                <div class="content">
                  <p><span class="tag is-danger"><i class="fas fa-calendar-days"></i> 日付</span><span>${date}</span></p>
                  <p><span class="tag is-danger"><i class="fas fa-hand-pointer"></i> 操作</span><span class="text"><a href="#search">救急病院を調べる</a>からご確認ください</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `);
    }
  });

  container.innerHTML = parts.join("\n");
};

const initPage = async () => {
  const specifiedDate = getDateFromURL();
  const todayDate = isoDateWithOffset(30 * 60 * 1000); // now +30 minutes
  const tomorrowDate = isoDateWithOffset(16 * 60 * 60 * 1000); // now +16 hours

  const hospitalData = await fetchHospitalData();

  if (specifiedDate) {
    renderHospitals(hospitalData, [specifiedDate]);
  } else if (todayDate === tomorrowDate) {
    renderHospitals(hospitalData, [todayDate]);
  } else {
    renderHospitals(hospitalData, [todayDate, tomorrowDate]);
  }
};

document.addEventListener("DOMContentLoaded", initPage);
