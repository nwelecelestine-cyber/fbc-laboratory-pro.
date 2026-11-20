
const CELLS = [
  "Neutrophils",
  "Lymphocytes",
  "Monocytes",
  "Eosinophils",
  "Basophils"
];

const STORE = "fbcLabProRecords_v1";

let counts = {};
let sequence = [];
let currentResult = null;
let retrieved = null;
let hasAlerted = false;
let currentUtterance = null;

const $ = id => document.getElementById(id);

const num = id => {
  const v = $(id).value.trim();
  return v === "" ? null : Number(v);
};

/* IMMEDIATE SPOKEN AUDIO FEEDBACK */

function speak(message, onComplete = null) {
  if (!$("soundEnabled").checked) return;

  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported by this browser.");
    return;
  }

  try {
    // Interrupt previous speech so the latest click is prioritised.
    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(message);

    currentUtterance.lang = "en-GB";
    currentUtterance.rate = 1.5;
    currentUtterance.pitch = 1;
    currentUtterance.volume = 1;

    currentUtterance.onend = () => {
      currentUtterance = null;

      if (typeof onComplete === "function") {
        onComplete();
      }
    };

    currentUtterance.onerror = event => {
      currentUtterance = null;
      console.warn("Speech playback error:", event.error);
    };

    window.speechSynthesis.resume();
    window.speechSynthesis.speak(currentUtterance);

  } catch (e) {
    console.warn("Speech feedback unavailable:", e);
  }
}

/* SOUND CONTROL */

$("soundEnabled").addEventListener("change", () => {
  if (!$("soundEnabled").checked) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
});

/* RESET COUNTS */

function resetCounts() {
  counts = {};
  CELLS.forEach(c => counts[c] = 0);

  sequence = [];
  hasAlerted = false;
  currentResult = null;

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  $("resultsPanel").hidden = true;
  $("completionNotice").hidden = true;

  updateCounter();
}

/* COUNTING TARGET */

function target() {
  if ($("target").value === "custom") {
    const n = Number($("customTarget").value);
    return Number.isInteger(n) && n > 0 ? n : 100;
  }

  return Number($("target").value);
}

function total() {
  return CELLS.reduce((s, c) => s + counts[c], 0);
}

/* COUNTER DISPLAY */

function updateCounter() {
  const t = total();
  const goal = target();
  const pct = Math.min(100, t / goal * 100);

  $("progressText").textContent = `${t} / ${goal}`;
  $("progressPercent").textContent = `${pct.toFixed(0)}%`;
  $("progressFill").style.width = pct + "%";

  CELLS.forEach(c => {
    $(c).textContent = counts[c];
  });

  document.querySelectorAll(".counter").forEach(b => {
    b.disabled = t >= goal;
  });

  $("undoBtn").disabled = sequence.length === 0;
  $("calculateBtn").disabled = t === 0;

  if (t >= goal) {
    $("completionNotice").hidden = false;
  } else {
    $("completionNotice").hidden = true;
    hasAlerted = false;
  }
}

/* DIFFERENTIAL COUNT BUTTONS */

document.querySelectorAll(".counter").forEach(b => {
  b.addEventListener("click", () => {
    if (total() >= target()) return;

    const c = b.dataset.cell;

    if (!CELLS.includes(c)) {
      console.warn("Unknown differential cell:", c);
      return;
    }

    currentResult = null;
    $("resultsPanel").hidden = true;

    counts[c]++;
    sequence.push(c);

    const completed = total() >= target();

    // Speak the clicked cell immediately.
    // If this is the final count, announce completion afterwards.
    if (completed && !hasAlerted) {
      hasAlerted = true;

      speak(c, () => {
        if ($("soundEnabled").checked) {
          speak("Count completed");
        }
      });

    } else {
      speak(c);
    }

    updateCounter();
  });
});

/* UNDO LAST COUNT */

$("undoBtn").addEventListener("click", () => {
  const c = sequence.pop();

  if (!c) return;

  counts[c]--;

  currentResult = null;
  $("resultsPanel").hidden = true;

  updateCounter();
});

/* RESET COUNTER */

$("resetBtn").addEventListener("click", () => {
  if (confirm("Reset all five differential counts?")) {
    resetCounts();
  }
});

/* COUNTING TARGET */

$("target").addEventListener("change", () => {
  $("customTarget").disabled =
    $("target").value !== "custom";

  if (
    total() > target() &&
    !confirm("The current count exceeds the new target. Keep the current counts?")
  ) {
    $("target").value = "100";
  }

  updateCounter();
});

$("customTarget").addEventListener("input", updateCounter);

/* RED CELL INDICES AND PLATELET INDICES */

function updateIndices() {
  const hb = num("hb");
  const pcv = num("pcv");
  const rbc = num("rbc");

  const platelets = num("platelets");
  const mpv = num("mpv");

  $("mcv").textContent =
    pcv !== null && rbc !== null && rbc > 0
      ? (pcv * 10 / rbc).toFixed(1)
      : "—";

  $("mch").textContent =
    hb !== null && rbc !== null && rbc > 0
      ? (hb * 10 / rbc).toFixed(1)
      : "—";

  $("mchc").textContent =
    hb !== null && pcv !== null && pcv > 0
      ? (hb * 100 / pcv).toFixed(1)
      : "—";

  // PCT (%) = Platelet count × MPV / 10,000

  if (
    platelets !== null &&
    mpv !== null &&
    Number.isFinite(platelets) &&
    Number.isFinite(mpv) &&
    platelets >= 0 &&
    mpv >= 0
  ) {
    $("pct").textContent =
      ((platelets * mpv) / 10000).toFixed(3);
  } else {
    $("pct").textContent = "—";
  }
}

["hb", "pcv", "rbc", "platelets", "mpv"].forEach(id => {
  $(id).addEventListener("input", updateIndices);
});

/* PATIENT INFORMATION VALIDATION */

function patientData() {
  const name = $("patientName").value.trim();
  const lab = $("labNumber").value.trim();
  const wbc = num("wbc");

  if (!name || !lab) {
    alert("Patient name and laboratory number are required.");
    return null;
  }

  if (wbc === null || !Number.isFinite(wbc) || wbc <= 0) {
    alert("Enter a valid total WBC greater than zero to calculate absolute differential counts.");
    return null;
  }

  const age = num("age");

  if (age !== null && (!Number.isFinite(age) || age < 0 || age > 130)) {
    alert("Check the patient age.");
    return null;
  }

  const values = {
    hb: num("hb"),
    pcv: num("pcv"),
    rbc: num("rbc"),
    wbc,
    platelets: num("platelets"),
    mpv: num("mpv"),
    rdw: num("rdw")
  };

  for (const [k, v] of Object.entries(values)) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      alert("Check the entered numeric FBC values.");
      return null;
    }
  }

  if (values.pcv !== null && values.pcv > 100) {
    alert("PCV should not exceed 100%.");
    return null;
  }

  return {
    name,
    lab,
    age,
    ageUnit: $("ageUnit").value,
    sex: $("sex").value,
    specimen: $("specimen").value,
    collectionDate: $("collectionDate").value,
    clinician: $("clinician").value.trim(),
    ...values
  };
}

/* CALCULATE FBC AND PLATELET PARAMETERS */

function makeCBC(p) {
  const mcv =
    p.pcv !== null && p.rbc > 0
      ? p.pcv * 10 / p.rbc
      : null;

  const mch =
    p.hb !== null && p.rbc > 0
      ? p.hb * 10 / p.rbc
      : null;

  const mchc =
    p.hb !== null && p.pcv > 0
      ? p.hb * 100 / p.pcv
      : null;

  const pct =
    p.platelets !== null && p.mpv !== null
      ? (p.platelets * p.mpv) / 10000
      : null;

  return [
    ["Haemoglobin", p.hb, "g/dL", "Measured"],
    ["PCV / Haematocrit", p.pcv, "%", "Measured"],
    ["RBC count", p.rbc, "×10¹²/L", "Measured"],
    ["MCV", mcv, "fL", "Calculated"],
    ["MCH", mch, "pg", "Calculated"],
    ["MCHC", mchc, "g/dL", "Calculated"],
    ["RDW-CV", p.rdw, "%", "Measured"],
    ["Total WBC", p.wbc, "×10⁹/L", "Measured"],
    ["Platelet count (PLT)", p.platelets, "×10⁹/L", "Measured"],
    ["Mean Platelet Volume (MPV)", p.mpv, "fL", "Measured"],
    ["Plateletcrit (PCT)", pct, "%", "Calculated"]
  ];
}

/* CALCULATE DIFFERENTIAL RESULTS */

function calculate() {
  const p = patientData();

  if (!p) return;

  const n = total();

  if (!n) {
    alert("Count at least one white blood cell.");
    return;
  }

  if (
    n < target() &&
    !confirm(
      `Only ${n} of ${target()} target cells have been counted. Calculate anyway?`
    )
  ) {
    return;
  }

  const differential = CELLS.map(cell => {
    const count = counts[cell];
    const percentage = count / n * 100;

    return {
      cell,
      count,
      percentage: Number(percentage.toFixed(2)),
      absolute: Number(
        (p.wbc * percentage / 100).toFixed(3)
      )
    };
  });

  currentResult = {
    id: null,
    savedAt: null,
    patient: p,
    totalCount: n,
    target: target(),
    differential,
    cbc: makeCBC(p)
  };

  renderReport(
    currentResult,
    "reportMeta",
    "cbcResultBody",
    "diffResultBody"
  );

  $("resultsPanel").hidden = false;

  $("resultsPanel").scrollIntoView({
    behavior: "smooth"
  });
}

$("calculateBtn").addEventListener("click", calculate);

/* REPORT DISPLAY */

function addMeta(container, label, value) {
  const d = document.createElement("div");
  d.className = "meta-item";

  const s = document.createElement("span");
  s.textContent = label;

  const b = document.createElement("strong");
  b.textContent = value || "—";

  d.append(s, b);
  container.append(d);
}

function renderReport(record, metaId, cbcId, diffId) {
  const meta = $(metaId);
  meta.innerHTML = "";

  addMeta(meta, "Patient", record.patient.name);
  addMeta(meta, "Laboratory number", record.patient.lab);

  addMeta(
    meta,
    "Age / sex",
    `${record.patient.age ?? "—"} ${record.patient.ageUnit || ""} / ${record.patient.sex || "—"}`
  );

  addMeta(meta, "Specimen", record.patient.specimen);

  addMeta(
    meta,
    "Collection date",
    record.patient.collectionDate || "—"
  );

  addMeta(
    meta,
    "Total WBC",
    record.patient.wbc + " ×10⁹/L"
  );

  const cb = $(cbcId);
  cb.innerHTML = "";

  record.cbc.forEach(([name, value, unit, type]) => {
    if (value === null || value === undefined) return;

    const tr = document.createElement("tr");

    [name, Number(value).toFixed(3), unit, type].forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(td);
    });

    cb.append(tr);
  });

  const db = $(diffId);
  db.innerHTML = "";

  record.differential.forEach(x => {
    const tr = document.createElement("tr");

    [
      x.cell,
      x.count,
      x.percentage.toFixed(2) + "%",
      x.absolute.toFixed(3)
    ].forEach(v => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(td);
    });

    db.append(tr);
  });
}

/* LOCAL PATIENT RECORD STORAGE */

function records() {
  try {
    const r = JSON.parse(
      localStorage.getItem(STORE) || "[]"
    );

    return Array.isArray(r) ? r : [];

  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
    return true;

  } catch (e) {
    alert("Could not save. Browser storage may be full.");
    return false;
  }
}

/* SAVE PATIENT RESULT */

$("saveBtn").addEventListener("click", () => {
  if (!currentResult) {
    alert("Calculate the results first.");
    return;
  }

  const list = records();

  if (
    currentResult.id &&
    list.some(r => r.id === currentResult.id)
  ) {
    alert("This result is already saved.");
    return;
  }

  const rec = {
    ...currentResult,
    id: (
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random()
    ),
    savedAt: new Date().toISOString()
  };

  list.unshift(rec);

  if (persist(list)) {
    currentResult = rec;
    renderHistory();
    alert("Patient result saved in this browser.");
  }
});

/* PATIENT HISTORY DISPLAY */

function renderHistory() {
  const all = records();

  const q = $("historySearch").value.trim().toLowerCase();

  const list = all.filter(r =>
    r.patient.name.toLowerCase().includes(q) ||
    r.patient.lab.toLowerCase().includes(q)
  );

  $("recordCount").textContent =
    `${all.length} record${all.length === 1 ? "" : "s"}`;

  $("historyBadge").textContent = all.length;
  $("emptyHistory").hidden = list.length > 0;

  const body = $("historyBody");
  body.innerHTML = "";

  list.forEach(r => {
    const tr = document.createElement("tr");

    const vals = [
      r.patient.name,
      r.patient.lab,
      r.patient.collectionDate || "—",
      r.patient.wbc,
      r.savedAt
        ? new Date(r.savedAt).toLocaleString()
        : "—"
    ];

    vals.forEach(v => {
      const td = document.createElement("td");
      td.textContent = v ?? "—";
      tr.append(td);
    });

    const action = document.createElement("td");
    action.className = "action-cell";

    const view = document.createElement("button");
    view.className = "small-btn view-btn";
    view.textContent = "View";
    view.onclick = () => viewRecord(r.id);

    const del = document.createElement("button");
    del.className = "small-btn delete-btn";
    del.textContent = "Delete";
    del.onclick = () => deleteRecord(r.id);

    action.append(view, del);
    tr.append(action);
    body.append(tr);
  });
}

/* RETRIEVE SAVED PATIENT REPORT */

function viewRecord(id) {
  const r = records().find(x => x.id === id);
  if (!r) return;

  retrieved = r;

  const box = $("historyReport");
  box.innerHTML = "";

  const holder = document.createElement("div");

  holder.innerHTML = `
    <div id="historyReportMeta" class="report-meta"></div>

    <h3 class="subheading">Full blood count</h3>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Result</th>
            <th>Unit</th>
            <th>Result type</th>
          </tr>
        </thead>
        <tbody id="savedCBC"></tbody>
      </table>
    </div>

    <h3 class="subheading">White cell differential</h3>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cell type</th>
            <th>Count</th>
            <th>Relative (%)</th>
            <th>Absolute (×10⁹/L)</th>
          </tr>
        </thead>
        <tbody id="savedDiff"></tbody>
      </table>
    </div>
  `;

  box.append(holder);

  renderReport(r, "historyReportMeta", "savedCBC", "savedDiff");

  $("historyDetail").hidden = false;

  $("historyDetail").scrollIntoView({
    behavior: "smooth"
  });
}

/* DELETE PATIENT RECORD */

function deleteRecord(id) {
  if (!confirm("Delete this saved patient record permanently?")) {
    return;
  }

  persist(records().filter(r => r.id !== id));

  if (retrieved?.id === id) {
    retrieved = null;
    $("historyDetail").hidden = true;
  }

  renderHistory();
}

/* HISTORY SEARCH */

$("historySearch").addEventListener("input", renderHistory);

/* CLOSE RETRIEVED REPORT */

$("closeDetail").addEventListener("click", () => {
  $("historyDetail").hidden = true;
  retrieved = null;
});

/* PRINT REPORTS */

$("printBtn").addEventListener("click", () => {
  if (currentResult) window.print();
});

$("printHistoryBtn").addEventListener("click", () => {
  if (retrieved) window.print();
});

/* NAVIGATION TABS */

document.querySelectorAll(".tab").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => {
      x.classList.toggle("active", x === b);
    });

    document.querySelectorAll(".view").forEach(v => {
      v.hidden = v.id !== b.dataset.view;
    });

    if (b.dataset.view === "historyView") {
      renderHistory();
    }
  });
});

/* EXPORT PATIENT RECORDS TO CSV */

$("exportBtn").addEventListener("click", () => {
  const list = records();

  if (!list.length) {
    alert("There are no records to export.");
    return;
  }

  const rows = [
    [
      "Patient",
      "Lab number",
      "Age",
      "Age unit",
      "Sex",
      "Specimen",
      "Collection date",
      "Hb g/dL",
      "PCV %",
      "RBC x10^12/L",
      "MCV fL",
      "MCH pg",
      "MCHC g/dL",
      "RDW-CV %",
      "WBC x10^9/L",
      "Platelets x10^9/L",
      "MPV fL",
      "PCT %",
      "Cells counted",
      ...CELLS.flatMap(c => [
        c + " count",
        c + " %",
        c + " absolute x10^9/L"
      ])
    ]
  ];

  list.forEach(r => {
    const m = Object.fromEntries(
      (r.cbc || []).map(x => [x[0], x[1]])
    );

    const d = Object.fromEntries(
      (r.differential || []).map(x => [x.cell, x])
    );

    rows.push([
      r.patient.name,
      r.patient.lab,
      r.patient.age ?? "",
      r.patient.ageUnit || "",
      r.patient.sex || "",
      r.patient.specimen || "",
      r.patient.collectionDate || "",
      m["Haemoglobin"] ?? "",
      m["PCV / Haematocrit"] ?? "",
      m["RBC count"] ?? "",
      m.MCV ?? "",
      m.MCH ?? "",
      m.MCHC ?? "",
      m["RDW-CV"] ?? "",
      r.patient.wbc ?? "",
      m["Platelet count (PLT)"] ?? m["Platelet count"] ?? "",
      m["Mean Platelet Volume (MPV)"] ?? "",
      m["Plateletcrit (PCT)"] ?? "",
      r.totalCount ?? "",
      ...CELLS.flatMap(c => [
        d[c]?.count ?? "",
        d[c]?.percentage ?? "",
        d[c]?.absolute ?? ""
      ])
    ]);
  });

  const csv = rows
    .map(row =>
      row.map(v =>
        '"' + String(v ?? "").replace(/"/g, '""') + '"'
      ).join(",")
    )
    .join("\r\n");

  const blob = new Blob(
    ["\ufeff" + csv],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "FBC_patient_records.csv";
  a.click();

  URL.revokeObjectURL(url);
});

/* CLEAR OLD CALCULATED REPORT WHEN INPUTS CHANGE */

[
  "patientName",
  "labNumber",
  "age",
  "ageUnit",
  "sex",
  "specimen",
  "collectionDate",
  "clinician",
  "hb",
  "pcv",
  "rbc",
  "wbc",
  "platelets",
  "mpv",
  "rdw"
].forEach(id => {
  $(id).addEventListener("input", () => {
    currentResult = null;
    $("resultsPanel").hidden = true;
  });

  $(id).addEventListener("change", () => {
    currentResult = null;
    $("resultsPanel").hidden = true;
  });
});

/* INITIALISE APPLICATION */

$("collectionDate").value =
  new Date().toISOString().slice(0, 16);

resetCounts();
updateIndices();
renderHistory();
