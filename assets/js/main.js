/* ================================================
   BLOG — JavaScript
   Markdown parser + write-up language toggle
   ================================================ */

(function () {
  'use strict';

  /* ─── Markdown parser ──────────────────────────
     Supports:
     ## headings, **bold**, *italic*
     `code` and ```fenced blocks``` → green
     ![alt|caption](src) images
     [text](url) links
     > blockquotes
     - lists  /  1. ordered
     | tables |
     --- horizontal rule
  ─────────────────────────────────────────────── */
  function esc(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inline(s) {
    /* Images: ![alt|caption](src) */
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
      var parts = alt.split('|');
      var a = esc(parts[0].trim());
      var cap = parts[1] ? parts[1].trim() : '';
      if (cap) return '<figure><img src="' + src + '" alt="' + a + '" /><figcaption>' + esc(cap) + '</figcaption></figure>';
      return '<img src="' + src + '" alt="' + a + '" />';
    });
    /* Links */
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
    });
    /* Bold */
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    /* Italic */
    s = s.replace(/(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    /* Inline code */
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }

  function parseMarkdown(raw) {
    if (!raw) return '';
    var lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      /* Fenced code block */
      if (/^```/.test(line)) {
        var lang = line.slice(3).trim();
        var code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(esc(lines[i]));
          i++;
        }
        out.push('<pre><code class="lang-' + (lang || 'text') + '">' + code.join('\n') + '</code></pre>');
        i++;
        continue;
      }

      /* Heading */
      var hm = line.match(/^(#{1,3})\s+(.+)/);
      if (hm) {
        var lvl = hm[1].length;
        out.push('<h' + lvl + '>' + inline(esc(hm[2])) + '</h' + lvl + '>');
        i++; continue;
      }

      /* HR */
      if (/^---+$/.test(line.trim())) {
        out.push('<hr />');
        i++; continue;
      }

      /* Blockquote */
      if (/^>\s?/.test(line)) {
        var bq = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          bq.push(inline(esc(lines[i].replace(/^>\s?/, ''))));
          i++;
        }
        out.push('<blockquote>' + bq.join('<br />') + '</blockquote>');
        continue;
      }

      /* Unordered list */
      if (/^[-*]\s/.test(line)) {
        var ul = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          ul.push('<li>' + inline(esc(lines[i].replace(/^[-*]\s/, ''))) + '</li>');
          i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }

      /* Ordered list */
      if (/^\d+\.\s/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          ol.push('<li>' + inline(esc(lines[i].replace(/^\d+\.\s/, ''))) + '</li>');
          i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }

      /* Table */
      if (/^\|/.test(line)) {
        var trows = [];
        while (i < lines.length && /^\|/.test(lines[i])) {
          trows.push(lines[i]);
          i++;
        }
        var dataRows = trows.filter(function(r) { return !/^[\s|:-]+$/.test(r); });
        if (dataRows.length) {
          var hcells = dataRows[0].split('|').filter(function(_, idx, a) { return idx > 0 && idx < a.length - 1; });
          var tbl = '<table><thead><tr>';
          hcells.forEach(function(c) { tbl += '<th>' + inline(esc(c.trim())) + '</th>'; });
          tbl += '</tr></thead><tbody>';
          dataRows.slice(1).forEach(function(row) {
            var cells = row.split('|').filter(function(_, idx, a) { return idx > 0 && idx < a.length - 1; });
            tbl += '<tr>';
            cells.forEach(function(c) { tbl += '<td>' + inline(esc(c.trim())) + '</td>'; });
            tbl += '</tr>';
          });
          tbl += '</tbody></table>';
          out.push(tbl);
        }
        continue;
      }

      /* Blank line */
      if (line.trim() === '') { i++; continue; }

      /* Paragraph */
      var para = [];
      while (i < lines.length && lines[i].trim() !== '' &&
             !/^[#>|`\-*]/.test(lines[i]) &&
             !/^\d+\./.test(lines[i]) &&
             !/^---/.test(lines[i])) {
        para.push(inline(esc(lines[i])));
        i++;
      }
      if (para.length) out.push('<p>' + para.join(' ') + '</p>');
    }

    return out.join('\n');
  }

  /* ─── Render all .markdown blocks ────────────── */
  function renderAll() {
    document.querySelectorAll('.markdown').forEach(function(el) {
      var raw = el.textContent || el.innerText;
      var wrapper = document.createElement('div');
      wrapper.className = 'md-out' + (el.dataset.lang === 'ar' ? ' ar-text' : '');
      wrapper.innerHTML = parseMarkdown(raw);
      el.parentNode.replaceChild(wrapper, el);
    });
  }

  /* ─── Write-up language toggle ────────────────── */
  function initLangToggle() {
    var btnEn = document.getElementById('btn-en');
    var btnAr = document.getElementById('btn-ar');
    var blockEn = document.getElementById('content-en');
    var blockAr = document.getElementById('content-ar');

    if (!btnEn || !btnAr || !blockEn) return;

    /* Default: show EN */
    function showEn() {
      blockEn.style.display = '';
      if (blockAr) blockAr.style.display = 'none';
      btnEn.classList.add('active');
      btnAr.classList.remove('active');
    }
    function showAr() {
      blockEn.style.display = 'none';
      if (blockAr) blockAr.style.display = '';
      btnEn.classList.remove('active');
      btnAr.classList.add('active');
    }

    showEn();
    btnEn.addEventListener('click', showEn);
    btnAr.addEventListener('click', showAr);
  }

  /* ─── Nav active state ────────────────────────── */
  function setActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function(link) {
      var href = (link.getAttribute('href') || '').split('/').pop();
      if (href === page) link.classList.add('active');
    });
  }

  /* ─── Subtle logo glitch ──────────────────────── */
  function initGlitch() {
    var img = document.querySelector('.logo-img');
    if (!img) return;
    setInterval(function() {
      if (Math.random() > 0.96) {
        img.style.filter = 'brightness(1.4) hue-rotate(80deg) saturate(2)';
        setTimeout(function() { img.style.filter = ''; }, 70);
      }
    }, 2800);
  }

  /* ─── 404 typewriter ──────────────────────────── */
  function initTypewriter() {
    var el = document.getElementById('nf-typeout');
    if (!el) return;
    var text = el.dataset.text || '';
    var i = 0;
    el.textContent = '';
    var iv = setInterval(function() {
      el.textContent += text[i];
      i++;
      if (i >= text.length) clearInterval(iv);
    }, 38);
  }

  /* ─── Init ────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function() {
    renderAll();
    initLangToggle();
    setActiveNav();
    initGlitch();
    initTypewriter();
  });

})();
