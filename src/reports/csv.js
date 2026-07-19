// Purely mechanical CSV helpers — escaping, joining, and triggering a
// browser download. Zero knowledge of what the rows represent. Whoever
// calls this decides the columns and how to turn a domain object (a
// transaction, a bill, whatever) into a row — that mapping is business
// logic and stays with the feature that owns it, not here.

export const rowsToCsvString = (rows) =>
  rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");

export const downloadCsvFile = (filename, csvString) => {
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
