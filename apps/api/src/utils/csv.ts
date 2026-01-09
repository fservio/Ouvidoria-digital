export const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: unknown) => {
    const str = value === null || value === undefined ? '' : String(value);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeValue(row[header])).join(','));
  }

  return lines.join('\n');
};
