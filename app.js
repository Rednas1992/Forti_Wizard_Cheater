'use strict';

(function(){
  const fileInput     = document.getElementById('fileInput');
  const startBtn      = document.getElementById('startBtn');
  const matchesEl     = document.getElementById('matches');
  const summaryEl     = document.getElementById('summary');
  const cliOut        = document.getElementById('cliOut');
  const copyBtn       = document.getElementById('copyBtn');
  const downloadBtn   = document.getElementById('downloadBtn');

  // Controls
  const cbWizard      = document.getElementById('cbWizard');
  const cbWildcard    = document.getElementById('cbWildcard');
  const wildcardInput = document.getElementById('wildcardInput');

  let lastText = '';

  // --- mutual exclusivity (radio-like) + enable/disable input ---
  function refreshControls(changed){
    if (changed === 'wizard' && cbWizard.checked) {
      cbWildcard.checked = false;
    }
    if (changed === 'wildcard' && cbWildcard.checked) {
      cbWizard.checked = false;
    }
    wildcardInput.disabled = !cbWildcard.checked;
  }

  cbWizard.addEventListener('change', () => {
    refreshControls('wizard');
    if (lastText) summaryEl.textContent = 'Search mode changed — press Start analysis again.';
  });
  cbWildcard.addEventListener('change', () => {
    refreshControls('wildcard');
    if (lastText) summaryEl.textContent = 'Search mode changed — press Start analysis again.';
  });
  wildcardInput.addEventListener('input', () => {
    if (lastText) summaryEl.textContent = 'Wildcard changed — press Start analysis again.';
  });

  // --- helpers ---
  function readFile(file){
    return new Promise((resolve,reject)=>{
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsText(file);
    });
  }

  function escHtml(s){
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Convert wildcard (* ?) to regex (case-insensitive). Plain text works as substring.
  function wildcardToRegExp(pattern){
    if (!pattern) return null;
    const esc = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials except * ?
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(esc, 'i');
  }

  // --- parse config: capture every comment + breadcrumb path ---
  function extractComments(text){
    const configs = [];
    const edits   = [];
    const out     = [];

    const lines = text.split(/\r?\n/);

    const reCfg  = /^\s*config\s+(.+?)\s*$/i;
    const reEdit = /^\s*edit\s+(.+?)\s*$/i;
    const reNext = /^\s*next\s*$/i;
    const reEnd  = /^\s*end\s*$/i;
    const reCmt  = /^\s*set\s+comments?\s+"([^"]*)"\s*$/i; // matches comment + comments

    for (let i = 0; i < lines.length; i++){
      const raw = lines[i];

      let m;
      if ((m = raw.match(reCfg))){
        configs.push(m[1]);
        while (edits.length > configs.length) edits.pop();
        continue;
      }
      if ((m = raw.match(reEnd))){
        if (configs.length) configs.pop();
        while (edits.length > configs.length) edits.pop();
        continue;
      }
      if ((m = raw.match(reEdit))){
        edits.push(m[1]);
        continue;
      }
      if (reNext.test(raw)){
        if (edits.length) edits.pop();
        continue;
      }
      if ((m = raw.match(reCmt))){
        out.push({
          lineNo: i + 1,
          comment: m[1],
          configs: configs.slice(),
          edits: edits.slice()
        });
      }
    }
    return out;
  }

  // --- filtering according to the 3 modes ---
  const reWizard = /created\s+by.*wizard/i;

  function filterComments(items){
    // No checkbox: return everything
    if (!cbWizard.checked && !cbWildcard.checked) return items;

    // Wizard-only
    if (cbWizard.checked) {
      return items.filter(x => reWizard.test(x.comment));
    }

    // Wildcard mode
    const pat = wildcardToRegExp(wildcardInput.value.trim());
    if (!pat) return items; // empty field => all
    return items.filter(x => pat.test(x.comment));
  }

  // --- pretty breadcrumb for UI ---
  function breadcrumbString(cfgs, eds){
    const parts = [];
    const hasVdom = cfgs[0] === 'vdom' && eds[0];
    if (hasVdom){
      parts.push('config vdom', `edit ${eds[0]}`);
    }
    const start = hasVdom ? 1 : 0;
    for (let i = start; i < cfgs.length; i++){
      parts.push(`config ${cfgs[i]}`);
      if (eds[i]) parts.push(`edit ${eds[i]}`);
    }
    return parts.join(' → ');
  }

  // --- CLI generator per match ---
  function generateCli(items){
    const blocks = items.map(x => {
      const out = [];
      const cfgs = x.configs;
      const eds  = x.edits;

      const hasVdom = cfgs[0] === 'vdom' && eds[0];
      const start   = hasVdom ? 1 : 0;

      if (hasVdom){
        out.push('config vdom', `edit ${eds[0]}`);
      }

      for (let i = start; i < cfgs.length; i++){
        out.push(`config ${cfgs[i]}`);
        if (eds[i]) out.push(`edit ${eds[i]}`);
      }

      out.push('unset comment');
      out.push('next');

      // close nested configs
      const levelsToClose = cfgs.length - start;
      for (let i = 0; i < levelsToClose; i++) out.push('end');
      if (hasVdom) out.push('end');

      return out.join('\n');
    });

    // Deduplicate identical blocks
    return Array.from(new Set(blocks)).join('\n\n');
  }

  // --- render results to UI ---
  function render(items){
    matchesEl.innerHTML = '';
    if (!items.length){
      summaryEl.textContent = '0 comments found.';
      cliOut.value = '';
      return;
    }
    summaryEl.innerHTML = `<strong>${items.length}</strong> comment(s) found.`;

    const frag = document.createDocumentFragment();
    for (const it of items){
      const card = document.createElement('div');
      card.className = 'match';
      card.innerHTML = `
        <div class="path">Line ${it.lineNo}</div>
        <div class="path">${escHtml(breadcrumbString(it.configs, it.edits))}</div>
        <code>set comment "${escHtml(it.comment)}"</code>
      `;
      frag.appendChild(card);
    }
    matchesEl.appendChild(frag);

    cliOut.value = generateCli(items);
  }

  // --- main flow ---
  fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    lastText = await readFile(file);
    startBtn.disabled = false;
    summaryEl.textContent = 'File loaded — click “Start analysis”.';
    matchesEl.innerHTML = '';
    cliOut.value = '';
  });

  startBtn.addEventListener('click', ()=>{
    if (!lastText){
      summaryEl.textContent = 'Please choose a file first.';
      return;
    }
    const all = extractComments(lastText);
    const filtered = filterComments(all);
    render(filtered);
  });

  // copy & download
  copyBtn.addEventListener('click', async ()=>{
    if (!cliOut.value) return;
    try{
      await navigator.clipboard.writeText(cliOut.value);
      copyBtn.textContent = 'Copied!';
      setTimeout(()=> copyBtn.textContent = 'Copy CLI', 1200);
    }catch{}
  });

  downloadBtn.addEventListener('click', ()=>{
    if (!cliOut.value) return;
    const blob = new Blob([cliOut.value + '\n'], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remove-comments.cli';
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 500);
  });
})();
