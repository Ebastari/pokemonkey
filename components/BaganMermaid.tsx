import React, { useEffect, useRef, useState } from 'react';

/**
 * Bagan Mermaid bergaya dokumen "Alur Notifikasi": simpul krem berbingkai
 * cokelat, garis melengkung, huruf aplikasi. Pustaka Mermaid dimuat hanya saat
 * bagan pertama tampil (buku panduan), jadi tidak membebani layar lain.
 *
 * Label digambar sebagai teks SVG (bukan HTML) supaya ikut terekam saat
 * Export PDF.
 */

type ModulMermaid = typeof import('mermaid')['default'];
let siap: Promise<ModulMermaid> | null = null;
let nomor = 0;

function muatMermaid(): Promise<ModulMermaid> {
  if (!siap) {
    siap = (async () => {
      const { default: mermaid } = await import('mermaid');
      await document.fonts?.ready;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        htmlLabels: false,
        flowchart: { htmlLabels: false, useMaxWidth: false, curve: 'basis', padding: 12, nodeSpacing: 36, rankSpacing: 44 },
        themeVariables: {
          background: '#ffffff',
          mainBkg: '#f4efe4',
          primaryColor: '#f4efe4',
          primaryTextColor: '#42392e',
          primaryBorderColor: '#7a6c52',
          nodeBorder: '#7a6c52',
          lineColor: '#8a7f6d',
          edgeLabelBackground: '#ffffff',
          clusterBkg: 'rgba(127,127,127,0.07)',
          clusterBorder: '#7a6c52',
          titleColor: '#42392e',
          fontFamily: "'Pixelify Sans', 'Segoe UI', system-ui, sans-serif",
          fontSize: '15px',
        },
        themeCSS: '.node rect, .node circle, .node polygon, .node path { stroke-width: 2px; } .edgeLabel { font-size: 13px; }',
      });
      return mermaid;
    })();
  }
  return siap;
}

export const BaganMermaid: React.FC<{ kode: string; label: string }> = ({ kode, label }) => {
  const wadah = useRef<HTMLDivElement>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let batal = false;
    muatMermaid()
      .then((mermaid) => mermaid.render(`bagan-panduan-${++nomor}`, kode.trim()))
      .then(({ svg }) => {
        if (!batal && wadah.current) wadah.current.innerHTML = svg;
      })
      .catch(() => { if (!batal) setGagal(true); });
    return () => { batal = true; };
  }, [kode]);

  return (
    <div className="pg-kotak pg-bagan" role="img" aria-label={label}>
      {gagal ? <pre className="pg-bagan-cadangan">{kode.trim()}</pre> : <div ref={wadah} className="pg-bagan-isi"><span className="pg-muted text-[13px]">Menggambar bagan…</span></div>}
    </div>
  );
};
