/**
 * CSV 匯出工具（零相依套件）。
 *
 * 產出的檔案開頭帶 UTF-8 BOM、換行用 \r\n，
 * 直接用 Excel／Numbers／Google 試算表開啟都不會亂碼。
 */

export type CsvCell = string | number | null | undefined;
export type CsvRow = CsvCell[];

/** 檔名不能有 \ / : * ? " < > | 這些字元，一律換成底線。 */
export const safeFileName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, "_").trim();

const escapeCell = (value: CsvCell): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: CsvRow[]): string =>
  rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");

/** 讓瀏覽器下載一份 CSV 檔。 */
export const downloadCsv = (fileName: string, rows: CsvRow[]): void => {
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
