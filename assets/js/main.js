/* ================================================
   BLOG — JavaScript
   Markdown parser + write-up language toggle
   Fixed: safe regex — no freezing on Arabic text
   ================================================ */

(function () {
  'use strict';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ─── Inline formatting ──────────────────────
     ALL regexes are safe for Arabic unicode.
     No lookbehind/lookahead on open-ended patterns.
     Italic capped at 200 chars to block backtracking.
  ─────────────────────────────────────────────── */
  function inline(s) {
    // Images
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
      var parts = alt.split('|');
      var a = esc(parts[0].trim());
      var cap = parts[1] ? parts[1].trim() : '';
      if (cap) return '<figure><img src="' + src + '" alt="' + a + '" /><figcaption>' + esc(cap) + '</figcaption></figure>';
      return '<img src="' + src + '" alt="' + a + '" />';
    });
    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener">' + esc(text) + '</a>';
    });
    // Bold — greedy but bounded by **
    s = s.replace(/\*\*([^*\r\n]+?)\*\*/g, '<strong>$1</strong>');
    // Italic — capped at 200 chars, no lookahead/lookbehind
    s = s.replace(/\*([^*\r\n]{1,200}?)\*/g, '<em>$1</em>');
    // Inline code
    s = s.replace(/`([^`\r\n]+?)`/g, '<code>$1</code>');
    return s;
  }

  /* ─── Markdown parser ─────────────────────── */
  function parseMarkdown(raw) {
    if (!raw) return '';
    var lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      // Fenced code block
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

      // Heading
      var hm = line.match(/^(#{1,3})\s+(.+)/);
      if (hm) {
        var lvl = hm[1].length;
        out.push('<h' + lvl + '>' + inline(esc(hm[2])) + '</h' + lvl + '>');
        i++; continue;
      }

      // HR
      if (/^-{3,}$/.test(line.trim())) {
        out.push('<hr />');
        i++; continue;
      }

      // Blockquote
      if (/^>\s?/.test(line)) {
        var bq = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          bq.push(inline(esc(lines[i].replace(/^>\s?/, ''))));
          i++;
        }
        out.push('<blockquote>' + bq.join('<br />') + '</blockquote>');
        continue;
      }

      // Unordered list
      if (/^[-*]\s/.test(line)) {
        var ul = [];
        while (i < lines.length && /^[-*]\s/.test(lines[i])) {
          ul.push('<li>' + inline(esc(lines[i].replace(/^[-*]\s/, ''))) + '</li>');
          i++;
        }
        out.push('<ul>' + ul.join('') + '</ul>');
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          ol.push('<li>' + inline(esc(lines[i].replace(/^\d+\.\s/, ''))) + '</li>');
          i++;
        }
        out.push('<ol>' + ol.join('') + '</ol>');
        continue;
      }

      // Table
      if (/^\|/.test(line)) {
        var trows = [];
        while (i < lines.length && /^\|/.test(lines[i])) {
          trows.push(lines[i]);
          i++;
        }
        var dataRows = trows.filter(function(r) { return !/^[\s|:\-]+$/.test(r); });
        if (dataRows.length > 0) {
          var splitRow = function(r) {
            return r.split('|').filter(function(_, idx, arr) { return idx > 0 && idx < arr.length - 1; });
          };
          var tbl = '<table><thead><tr>';
          splitRow(dataRows[0]).forEach(function(c) { tbl += '<th>' + inline(esc(c.trim())) + '</th>'; });
          tbl += '</tr></thead><tbody>';
          dataRows.slice(1).forEach(function(row) {
            tbl += '<tr>';
            splitRow(row).forEach(function(c) { tbl += '<td>' + inline(esc(c.trim())) + '</td>'; });
            tbl += '</tr>';
          });
          tbl += '</tbody></table>';
          out.push(tbl);
        }
        continue;
      }

      // Blank line
      if (line.trim() === '') { i++; continue; }

      // Paragraph — collect until blank or block-level element
      var para = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^#{1,3}\s/.test(lines[i]) &&
        !/^>\s?/.test(lines[i]) &&
        !/^\|/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^[-*]\s/.test(lines[i]) &&
        !/^\d+\.\s/.test(lines[i]) &&
        !/^-{3,}$/.test(lines[i].trim())
      ) {
        para.push(inline(esc(lines[i])));
        i++;
      }
      if (para.length) out.push('<p>' + para.join(' ') + '</p>');
    }

    return out.join('\n');
  }

  /* ─── Render .markdown blocks async ──────────
     Uses setTimeout(0) between each block so the
     browser never freezes — even on large Arabic.
  ─────────────────────────────────────────────── */
  function renderAll() {
    var blocks = Array.prototype.slice.call(document.querySelectorAll('.markdown'));

    function next(idx) {
      if (idx >= blocks.length) return;
      var el  = blocks[idx];
      var raw = el.textContent || el.innerText || '';
      var isAr = el.dataset.lang === 'ar';

      var wrapper = document.createElement('div');
      wrapper.className = 'md-out' + (isAr ? ' ar-text' : '');
      wrapper.innerHTML = parseMarkdown(raw);
      el.parentNode.replaceChild(wrapper, el);

      setTimeout(function() { next(idx + 1); }, 0);
    }

    next(0);
  }

  /* ─── Language toggle (write-up pages only) ── */
  function initLangToggle() {
    var btnEn   = document.getElementById('btn-en');
    var btnAr   = document.getElementById('btn-ar');
    var blockEn = document.getElementById('content-en');
    var blockAr = document.getElementById('content-ar');

    if (!btnEn || !btnAr || !blockEn) return;

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

  /* ─── Active nav ─────────────────────────── */
  function setActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function(link) {
      var href = (link.getAttribute('href') || '').split('/').pop();
      if (href === page) link.classList.add('active');
    });
  }

  /* ─── Logo glitch ────────────────────────── */
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

  /* ─── 404 typewriter ─────────────────────── */
  function initTypewriter() {
    var el = document.getElementById('nf-typeout');
    if (!el) return;
    var text = el.dataset.text || window.location.pathname;
    var i = 0;
    el.textContent = '';
    var iv = setInterval(function() {
      el.textContent += text[i];
      i++;
      if (i >= text.length) clearInterval(iv);
    }, 38);
  }

  /* ─── Init ───────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function() {
    renderAll();
    initLangToggle();
    setActiveNav();
    initGlitch();
    initTypewriter();
  });

})();
