/*!
 * RomitCSV shared CSV engine
 * Browser-only parsing and serialization helpers.
 */
(function (global) {
  "use strict";

  const DELIMITERS = [",", ";", "\t", "|"];

  function normalizeText(text) {
    return String(text ?? "").replace(/^\uFEFF/, "");
  }

  function scoreDelimiter(line, delimiter) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === delimiter && !quoted) {
        count++;
      }
    }
    return count;
  }

  function detectDelimiter(text) {
    const clean = normalizeText(text);
    const lines = clean.split(/\r\n|\n|\r/).filter(line => line.trim());
    if (!lines.length) return ",";
    const sample = lines.slice(0, 8);
    let best = ",";
    let bestScore = -1;
    for (const delimiter of DELIMITERS) {
      const score = sample.reduce((sum, line) => sum + scoreDelimiter(line, delimiter), 0);
      if (score > bestScore) {
        best = delimiter;
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : ",";
  }

  function parseCSV(text, options = {}) {
    const input = normalizeText(text);
    const delimiter = options.delimiter && options.delimiter !== "auto"
      ? options.delimiter
      : detectDelimiter(input);

    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    let sawContent = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      const next = input[i + 1];

      if (ch === '"') {
        if (quoted && next === '"') {
          cell += '"';
          i++;
          sawContent = true;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (ch === delimiter && !quoted) {
        row.push(cell);
        cell = "";
        sawContent = true;
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some(value => String(value).trim() !== "") || sawContent) {
          rows.push(row);
        }
        row = [];
        sawContent = false;
        continue;
      }

      cell += ch;
      sawContent = true;
    }

    if (cell.length || row.length || sawContent) {
      row.push(cell);
      if (row.some(value => String(value).trim() !== "") || sawContent) rows.push(row);
    }

    const width = rows.reduce((max, current) => Math.max(max, current.length), 0);
    return {
      rows: rows.map(current => Array.from({ length: width }, (_, index) => current[index] ?? "")),
      delimiter
    };
  }

  function serializeCSV(rows, delimiter = ",") {
    const d = String(delimiter || ",");
    return rows.map(row => row.map(value => {
      const text = String(value ?? "");
      if (text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(d)) {
        return '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    }).join(d)).join("\r\n");
  }

  function isProbablyCSV(file) {
    if (!file) return false;
    return /\.(csv|tsv)$/i.test(file.name || "") ||
      ["text/csv", "text/tab-separated-values"].includes(file.type);
  }

  function formatBytes(bytes) {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0) + " " + units[index];
  }

  function download(name, data, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function getTheme() {
    try { return localStorage.getItem("romitcsv.theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  }

  function setTheme(theme) {
    try { localStorage.setItem("romitcsv.theme", theme); } catch {}
  }

  global.RomitCSV = {
    detectDelimiter,
    parseCSV,
    serializeCSV,
    isProbablyCSV,
    formatBytes,
    download,
    getTheme,
    setTheme
  };
})(window);
