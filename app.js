"use strict";

/* =========================================================================
 * The More — 환율/합산 계산기 (SwiftUI dm_cal 웹 이식)
 * 저장은 localStorage (iOS @AppStorage 대체). 서버/네트워크 의존 없음.
 * ===================================================================== */

// ----- 저장소 (AppStorage 키 그대로 미러링) -----
const Store = {
  getNum(key, fallback = 0) {
    const v = localStorage.getItem(key);
    return v === null || v === "" ? fallback : Number(v);
  },
  setNum(key, val) { localStorage.setItem(key, String(val)); },
  getStr(key, fallback = "") {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  },
  setStr(key, val) { localStorage.setItem(key, val); },
};

const KEY_RATE = "savedResultValue";       // 저장된 환율 (원/엔)
const KEY_TS = "savedDateTimestamp";       // 저장 시각 (ms)
const KEY_SOURCE = "savedRateSource";      // "수동" | "실시간"
const KEY_NUMBERS = "sumNumbersStorage";   // 합산 숫자 목록 (쉼표 구분)

const $ = (sel) => document.querySelector(sel);

// ----- 라우팅 -----
const views = {
  home: $("#view-home"),
  exchange: $("#view-exchange"),
  sum: $("#view-sum"),
};

function routeFromHash() {
  const h = location.hash;
  if (h.startsWith("#/exchange")) return "exchange";
  if (h.startsWith("#/sum")) return "sum";
  return "home";
}

function render() {
  const route = routeFromHash();
  for (const [name, el] of Object.entries(views)) {
    el.hidden = name !== route;
  }
  if (route === "exchange") Exchange.onShow();
  if (route === "sum") Sum.onShow();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", render);

/* =========================================================================
 * 환율 계산
 * ===================================================================== */
const Exchange = {
  el: {
    payment: $("#ex-payment"),
    amountA: $("#ex-amountA"),
    amountB: $("#ex-amountB"),
    resultNum: $("#ex-result-num"),
    resultUnit: $("#ex-result-unit"),
    save: $("#ex-save"),
    saved: $("#ex-saved"),
    savedValue: $("#ex-saved-value"),
    savedMeta: $("#ex-saved-meta"),
    liveValue: $("#ex-live-value"),
    liveFetch: $("#ex-live-fetch"),
    liveSave: $("#ex-live-save"),
    liveMsg: $("#ex-live-msg"),
  },
  liveRate: null,

  // result = (A - B) / payment, 단 payment != 0
  compute() {
    const p = parseFloat(this.el.payment.value);
    const a = parseFloat(this.el.amountA.value);
    const b = parseFloat(this.el.amountB.value);
    if (!isFinite(p) || !isFinite(a) || !isFinite(b) || p === 0) return null;
    return (a - b) / p;
  },

  refreshResult() {
    const res = this.compute();
    if (res === null) {
      this.el.resultNum.textContent = "입력하슈";
      this.el.resultNum.classList.add("placeholder");
      this.el.resultUnit.hidden = true;
      this.el.save.disabled = true;
    } else {
      this.el.resultNum.textContent = res.toFixed(4);
      this.el.resultNum.classList.remove("placeholder");
      this.el.resultUnit.hidden = false;
      this.el.save.disabled = false;
    }
  },

  saveRate(value, source) {
    Store.setNum(KEY_RATE, value);
    Store.setNum(KEY_TS, Date.now());
    Store.setStr(KEY_SOURCE, source);
    this.refreshSaved();
    flashToast(`저장됨 (${source})`);
  },

  refreshSaved() {
    const ts = Store.getNum(KEY_TS, 0);
    if (ts <= 0) { this.el.saved.hidden = true; return; }
    const rate = Store.getNum(KEY_RATE, 0);
    const source = Store.getStr(KEY_SOURCE, "");
    this.el.saved.hidden = false;
    this.el.savedValue.textContent = `${rate.toFixed(4)} ¥/₩`;
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString("ko-KR") + " " +
      d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    this.el.savedMeta.textContent = source ? `${dateStr} · ${source}` : dateStr;
  },

  async fetchLive() {
    this.el.liveMsg.classList.remove("error");
    this.el.liveMsg.textContent = "불러오는 중…";
    this.el.liveFetch.disabled = true;
    try {
      // 무료·키 불필요·CORS 허용 (ExchangeRate-API open endpoint)
      const res = await fetch("https://open.er-api.com/v6/latest/JPY", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const krw = data && data.rates && data.rates.KRW;
      if (!krw) throw new Error("KRW 환율 없음");
      this.liveRate = krw;
      this.el.liveValue.textContent = `${krw.toFixed(4)} 원/엔`;
      this.el.liveSave.disabled = false;
      const upd = data.time_last_update_utc ? ` · ${data.time_last_update_utc}` : "";
      this.el.liveMsg.textContent = "1엔 = " + krw.toFixed(4) + "원" + upd;
    } catch (e) {
      this.el.liveMsg.classList.add("error");
      this.el.liveMsg.textContent = "환율을 불러오지 못했어요 (인터넷 연결 확인): " + e.message;
    } finally {
      this.el.liveFetch.disabled = false;
    }
  },

  onShow() {
    this.refreshResult();
    this.refreshSaved();
  },

  init() {
    for (const f of [this.el.payment, this.el.amountA, this.el.amountB]) {
      f.addEventListener("input", () => this.refreshResult());
    }
    this.el.save.addEventListener("click", () => {
      const res = this.compute();
      if (res !== null) this.saveRate(res, "수동");
    });
    this.el.liveFetch.addEventListener("click", () => this.fetchLive());
    this.el.liveSave.addEventListener("click", () => {
      if (this.liveRate !== null) this.saveRate(this.liveRate, "실시간");
    });
  },
};

/* =========================================================================
 * 합산 계산
 * ===================================================================== */
const Sum = {
  el: {
    body: $("#view-sum .sum-body"),
    total: $("#sum-total"),
    chips: $("#sum-chips"),
    thresholds: $("#sum-thresholds"),
    input: $("#sum-input"),
    keypad: $("#sum-keypad"),
  },
  numbers: [],
  current: "",

  load() {
    const raw = Store.getStr(KEY_NUMBERS, "");
    this.numbers = raw
      ? raw.split(",").map((s) => parseFloat(s)).filter((n) => isFinite(n))
      : [];
  },
  persist() {
    Store.setStr(KEY_NUMBERS, this.numbers.map((n) => String(n)).join(","));
  },

  get savedRate() { return Store.getNum(KEY_RATE, 0); },
  get total() { return this.numbers.reduce((a, b) => a + b, 0); },

  // SwiftUI thresholdDisplay 로직 그대로
  thresholdDisplay() {
    if (this.numbers.length === 0 || this.savedRate <= 0) return null;
    const totalWon = this.total * this.savedRate;
    let baseStart;
    if (totalWon <= 6000) {
      baseStart = 5999;
    } else {
      const base = Math.floor(Math.trunc(totalWon) / 1000) * 1000;
      baseStart = base + 999;
    }
    return [0, 1, 2, 3].map((k) => {
      const target = baseStart + k * 1000;
      const diff = target - totalWon;
      const yen = diff / this.savedRate;
      const sign = yen >= 0 ? "+" : "";
      return { target: Math.trunc(target), yen: `${sign}${yen.toFixed(2)}¥` };
    });
  },

  renderTotal() {
    this.el.total.textContent = (this.total * this.savedRate).toFixed(2) + "원";
  },

  renderChips() {
    this.el.chips.innerHTML = "";
    this.numbers.forEach((n, idx) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      const label = document.createElement("span");
      label.textContent = Math.round(n).toString();
      const x = document.createElement("button");
      x.className = "chip__x";
      x.type = "button";
      x.textContent = "✕";
      x.addEventListener("click", () => this.removeAt(idx));
      chip.append(label, x);
      this.el.chips.appendChild(chip);
    });
  },

  renderThresholds() {
    const data = this.thresholdDisplay();
    if (!data) { this.el.thresholds.hidden = true; return; }
    this.el.thresholds.hidden = false;
    this.el.thresholds.innerHTML = "";
    for (const item of data) {
      const cell = document.createElement("div");
      const t = document.createElement("div");
      t.className = "t-target";
      t.textContent = `${item.target}원`;
      const y = document.createElement("div");
      y.className = "t-yen";
      y.textContent = item.yen;
      cell.append(t, y);
      this.el.thresholds.appendChild(cell);
    }
  },

  renderInput() { this.el.input.textContent = this.current; },

  renderAll() {
    this.renderTotal();
    this.renderChips();
    this.renderThresholds();
    this.renderInput();
    // 항목 5개 이상이면 가운데 영역(칩·추천) 축소
    this.el.body.classList.toggle("compact", this.numbers.length >= 5);
  },

  removeAt(idx) {
    this.numbers.splice(idx, 1);
    this.persist();
    this.renderAll();
  },
  add() {
    const v = parseFloat(this.current);
    if (isFinite(v)) {
      this.numbers.push(v);
      this.current = "";
      this.persist();
      this.renderAll();
    }
  },
  del() {
    if (this.current.length > 0) {
      this.current = this.current.slice(0, -1);
      this.renderInput();
    }
  },
  tap(ch) { this.current += ch; this.renderInput(); },
  clearAll() {
    this.numbers = [];
    this.persist();
    this.renderAll();
  },

  buildKeypad() {
    // 4열 그리드. "add"는 CSS로 3~4행 세로 스팬, 이후 키는 4행으로 자동 배치.
    const keys = [
      "1", "2", "3", "clear",
      "4", "5", "6", "del",
      "7", "8", "9", "add",
      "", "0", ".",
    ];
    this.el.keypad.innerHTML = "";
    for (const item of keys) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (item === "") {
        btn.className = "key key--empty";
        btn.tabIndex = -1;
      } else if (item === "del") {
        btn.className = "key key--del";
        btn.textContent = "⌫";
        btn.addEventListener("click", () => this.del());
      } else if (item === "add") {
        btn.className = "key key--add";
        btn.textContent = "+";
        btn.addEventListener("click", () => this.add());
      } else if (item === "clear") {
        btn.className = "key key--clear";
        btn.textContent = "C";
        this.bindLongPressClear(btn);
      } else {
        btn.className = "key key--num";
        btn.textContent = item;
        btn.addEventListener("click", () => this.tap(item));
      }
      this.el.keypad.appendChild(btn);
    }
  },

  // C는 오터치로 전체삭제되지 않도록 길게(600ms) 눌러야 동작
  bindLongPressClear(btn) {
    let timer = null;
    let fired = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    btn.addEventListener("pointerdown", () => {
      fired = false;
      timer = setTimeout(() => {
        fired = true;
        this.clearAll();
        flashToast("전체 삭제됨");
      }, 600);
    });
    btn.addEventListener("pointerup", () => {
      cancel();
      if (!fired) flashToast("길게 누르면 전체 삭제");
    });
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("pointercancel", cancel);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  },

  onShow() {
    this.load();
    this.renderAll();
  },

  init() {
    this.buildKeypad();
  },
};

/* ===== 간단 토스트 ===== */
let toastTimer = null;
function flashToast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText =
      "position:fixed;left:50%;bottom:calc(40px + env(safe-area-inset-bottom,0px));" +
      "transform:translateX(-50%);background:rgba(0,0,0,.82);color:#fff;" +
      "padding:10px 18px;border-radius:18px;font-size:15px;z-index:99;opacity:0;" +
      "transition:opacity .2s;pointer-events:none;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = "1"; });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = "0"; }, 1800);
}

/* ===== 부팅 ===== */
Exchange.init();
Sum.init();
render();

// 서비스워커 등록 (오프라인 동작)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
