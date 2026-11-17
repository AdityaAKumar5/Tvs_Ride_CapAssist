// Export helpers: CSV tables and chart images.

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((c) => {
    const s = c === null ? '' : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

export function downloadCsv(name: string, rows: (string | number | null)[][]): void {
  download(name, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

function serialise(svg: SVGSVGElement): { text: string; w: number; h: number } {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const box = svg.getBoundingClientRect();
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(box.width)); clone.setAttribute('height', String(box.height));
  const bg = getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#ffffff';
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%'); rect.setAttribute('fill', bg);
  clone.insertBefore(rect, clone.firstChild);
  return { text: new XMLSerializer().serializeToString(clone), w: box.width, h: box.height };
}

/** Save the first SVG chart inside a container as SVG or PNG. Returns false if there is no chart. */
export function exportChart(container: HTMLElement | null, name: string, kind: 'svg' | 'png'): boolean {
  const svg = container?.querySelector('svg');
  if (!svg) return false;
  const { text, w, h } = serialise(svg as SVGSVGElement);
  if (kind === 'svg') { download(`${name}.svg`, new Blob([text], { type: 'image/svg+xml' })); return true; }
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => { if (b) download(`${name}.png`, b); }, 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
  return true;
}
