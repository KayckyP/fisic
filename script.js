(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const fmt = (n, digits = 2) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: digits });
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Canvas helper: redraws at device pixel ratio and adapts to its CSS size.
  function canvas(id, draw) {
    const el = document.getElementById(id);
    if (!el) return { redraw() {}, element: null };
    let width = 0, height = 0;
    const redraw = () => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      width = rect.width; height = rect.height;
      const ctx = el.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, width, height);
    };
    new ResizeObserver(redraw).observe(el);
    return { redraw, element: el };
  }
  const line = (ctx, x1, y1, x2, y2, color, dash = []) => {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  };
  const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  const drawWave = (ctx, w, h, { amplitude = 1, wavelength = 3, phase = 0, color = css('--cyan'), equilibrium = h * .52, grid = true, cycles = null, labels = false } = {}) => {
    ctx.clearRect(0, 0, w, h);
    if (grid) {
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 48) line(ctx, x, 0, x, h, '#172a3b');
      for (let y = 0; y <= h; y += 36) line(ctx, 0, y, w, y, '#172a3b');
    }
    line(ctx, 0, equilibrium, w, equilibrium, '#7b8fa344', [4, 6]);
    const pxPerM = w / (cycles ? cycles : 2.4);
    const visualLambda = cycles ? w / cycles : wavelength / 3 * pxPerM;
    const amp = Math.min(h * .39, amplitude / 1.8 * h * .43);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = equilibrium - amp * Math.sin((2 * Math.PI * x / visualLambda) + phase);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 9; ctx.stroke(); ctx.shadowBlur = 0;
    if (labels) {
      // Mark one crest, one trough, amplitude, and one spatial period.
      const crestX = visualLambda / 4;
      const troughX = visualLambda * .75;
      const crestY = equilibrium - amp;
      ctx.fillStyle = css('--yellow'); ctx.beginPath(); ctx.arc(crestX, crestY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(troughX, equilibrium + amp, 4, 0, Math.PI * 2); ctx.fill();
      line(ctx, crestX, equilibrium, crestX, crestY, css('--yellow'), [3, 3]);
      line(ctx, crestX, equilibrium + 14, crestX + visualLambda, equilibrium + 14, '#f3cb68');
      line(ctx, crestX, equilibrium + 9, crestX, equilibrium + 19, '#f3cb68');
      line(ctx, crestX + visualLambda, equilibrium + 9, crestX + visualLambda, equilibrium + 19, '#f3cb68');
      ctx.fillStyle = '#f3cb68'; ctx.font = '10px monospace'; ctx.fillText('λ', crestX + visualLambda / 2 - 3, equilibrium + 28);
      ctx.fillText('A', crestX + 7, equilibrium - amp / 2);
    }
  };

  let waveState = { A: 1, lambda: 3, f: 2, phase: 0, paused: false };
  let particlePaused = false, lastTime = 0, audioContext = null, oscillator = null, gainNode = null;
  const motionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mainChart = canvas('mainWave', (ctx, w, h) => drawWave(ctx, w, h, { amplitude: waveState.A, wavelength: waveState.lambda, phase: waveState.phase, equilibrium: h * .51, labels: true }));
  const heroChart = canvas('heroWave', (ctx, w, h) => drawWave(ctx, w, h, { amplitude: .9, wavelength: 3.5, phase: waveState.phase * .45, equilibrium: h * .52, grid: false, cycles: 2.4 }));
  const lowChart = canvas('lowWave', (ctx, w, h) => drawWave(ctx, w, h, { amplitude: .75, phase: waveState.phase, equilibrium: h * .52, cycles: 1.15, grid: false }));
  const compareChart = canvas('highWave', (ctx, w, h) => drawWave(ctx, w, h, { amplitude: .75, phase: waveState.phase, equilibrium: h * .52, cycles: Number($('#compareSlider').value), grid: false }));
  const stringChart = canvas('stringWave', (ctx, w, h) => {
    drawWave(ctx, w, h, { amplitude: .8, wavelength: 3.5, phase: waveState.phase, equilibrium: h * .54, grid: false, cycles: 1.7 });
    ctx.fillStyle = '#63e2e3';
    for (let x = 15; x < w; x += 17) { const y = h * .54 - Math.min(h * .31, h * .3) * Math.sin(2 * Math.PI * x / (w / 1.7) + waveState.phase); ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f3cb68'; ctx.font = '10px monospace'; ctx.fillText('→', w - 20, 17);
  });
  let stringState = { tension: 4, length: 65 };
  const guitarChart = canvas('guitarString', (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const margin = Math.max(18, (w * (80 - stringState.length) / 120));
    const left = margin, right = w - margin, mid = h * .55;
    line(ctx, left, mid, right, mid, '#52697d', [4, 5]);
    // The visible first mode bows more as tension lowers; length changes the active segment.
    const amp = 9 + (9 - stringState.tension) * 2.2;
    ctx.beginPath();
    for (let x = left; x <= right; x += 2) {
      const t = (x - left) / (right - left), y = mid - Math.sin(Math.PI * t) * amp * Math.sin(waveState.phase * (1 + stringState.tension * .1));
      if (x === left) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = css('--yellow'); ctx.lineWidth = 2.5; ctx.shadowColor = css('--yellow'); ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    for (const x of [left, right]) { ctx.fillStyle = '#60788d'; roundRect(ctx, x - 4, mid - 19, 8, 38, 3); ctx.fill(); }
    ctx.fillStyle = '#91a6b8'; ctx.font = '9px monospace'; ctx.fillText('vibração fundamental', left + 8, 16);
  });
  const soundChart = canvas('soundGraph', (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x += 42) line(ctx, x, 0, x, h, '#172a3b');
    const mid = h * .5, amp = h * .29, f = Number($('#toneSlider').value);
    line(ctx, 0, mid, w, mid, '#7b8fa344', [4, 5]); ctx.beginPath();
    const cycles = 1 + f / 100;
    for (let x = 0; x <= w; x += 2) { const y = mid - amp * Math.sin(2 * Math.PI * x / (w / cycles) + waveState.phase); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.lineWidth = 2; ctx.strokeStyle = css('--purple'); ctx.shadowColor = css('--purple'); ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;
  });
  let graphMode = 'space';
  const readChart = canvas('readGraph', (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const left = 42, right = 16, top = 14, bottom = 28, pw = w - left - right, ph = h - top - bottom, mid = top + ph / 2;
    for (let i = 0; i <= 8; i++) line(ctx, left + pw * i / 8, top, left + pw * i / 8, top + ph, '#1b3044');
    for (let i = 0; i <= 4; i++) line(ctx, left, top + ph * i / 4, w - right, top + ph * i / 4, '#1b3044');
    line(ctx, left, mid, w - right, mid, '#8092a555');
    ctx.beginPath();
    const visualLambda = graphMode === 'space' ? pw / 2.4 * (waveState.lambda / 3) : pw / 2;
    for (let x = 0; x <= pw; x += 2) { const phase = graphMode === 'time' ? waveState.phase : 0; const y = mid - ph * .38 * Math.sin(2 * Math.PI * x / visualLambda + phase); if (x === 0) ctx.moveTo(left + x, y); else ctx.lineTo(left + x, y); }
    ctx.strokeStyle = css('--cyan'); ctx.lineWidth = 2.5; ctx.shadowColor = css('--cyan'); ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#8196aa'; ctx.font = '10px monospace';
    ctx.fillText('y (m)', 4, 14); ctx.fillText(`+${fmt(waveState.A, 1)}`, 3, top + ph * .14); ctx.fillText('0', 20, mid + 3); ctx.fillText(`−${fmt(waveState.A, 1)}`, 3, top + ph - 1);
    ctx.fillText(graphMode === 'space' ? 'distância (m) →' : 'tempo (s) →', Math.max(left, w - 117), h - 5);
    for (let i = 0; i <= 4; i++) {
      const x = left + pw * i / 4;
      const timeWindow = 2 / waveState.f;
      ctx.fillStyle = '#70869a'; ctx.fillText(graphMode === 'space' ? fmt((2.4 * waveState.lambda) * i / 4, 1) : fmt(timeWindow * i / 4, 2), x - 7, h - 14);
    }
    const crestX = left + visualLambda / 4;
    line(ctx, crestX, mid, crestX, top + ph * .12, css('--yellow'), [3, 4]);
    line(ctx, crestX, top + ph - 5, crestX + visualLambda, top + ph - 5, css('--yellow'));
    line(ctx, crestX, top + ph - 10, crestX, top + ph, css('--yellow'));
    line(ctx, crestX + visualLambda, top + ph - 10, crestX + visualLambda, top + ph, css('--yellow'));
  });
  const particleChart = canvas('particleWave', (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); const base = h * .53;
    line(ctx, 8, base, w - 8, base, '#32485d');
    const count = 26, dx = (w - 38) / (count - 1);
    for (let i = 0; i < count; i++) {
      const x0 = 19 + dx * i, envelope = Math.exp(-Math.pow((x0 - ((waveState.phase * 32 + w * .18) % (w * .9))) / (w * .18), 2));
      const y = base - Math.sin(i * .65 - waveState.phase * 1.5) * 30 * envelope;
      ctx.beginPath(); ctx.moveTo(x0, base + 13); ctx.lineTo(x0, y); ctx.strokeStyle = '#345368'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x0, y, 4, 0, Math.PI * 2); ctx.fillStyle = css('--cyan'); ctx.shadowColor = css('--cyan'); ctx.shadowBlur = 7; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#778da1'; ctx.font = '9px monospace'; ctx.fillText('pontos oscilam em torno do equilíbrio', 10, 15);
  });
  const spring = $('#springArea');
  if (spring) { spring.innerHTML = Array.from({ length: 34 }, () => '<i></i>').join(''); }
  function animate(time) {
    const dt = Math.min((time - (lastTime || time)) / 1000, .05); lastTime = time;
    if (!waveState.paused && !motionReduced) waveState.phase = (waveState.phase + dt * Math.min(waveState.f, 4) * 1.25) % (Math.PI * 2);
    mainChart.redraw(); heroChart.redraw(); lowChart.redraw(); compareChart.redraw(); stringChart.redraw(); guitarChart.redraw(); soundChart.redraw(); readChart.redraw();
    if (!particlePaused) particleChart.redraw();
    if (spring) { const dots = $$('i', spring); dots.forEach((dot, i) => { const compression = Math.sin(i * .29 - waveState.phase) * 2.5; dot.style.transform = `translateX(${compression}px)`; }); }
    if (!motionReduced) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  function updateWave() {
    waveState.A = Number($('#ampSlider').value); waveState.lambda = Number($('#lambdaSlider').value); waveState.f = Number($('#freqSlider').value);
    $('#ampOut').textContent = `${fmt(waveState.A, 1)} m`; $('#lambdaOut').textContent = `${fmt(waveState.lambda, 1)} m`; $('#freqOut').textContent = `${fmt(waveState.f, 1)} Hz`;
    $('#velocityOut').textContent = fmt(waveState.lambda * waveState.f, 1); $('#periodOut').textContent = fmt(1 / waveState.f, 2);
    $('#waveInsight').textContent = `A cada segundo, a onda completa ${fmt(waveState.f, 1)} oscilações. A distância entre cristas é ${fmt(waveState.lambda, 1)} m.`;
    for (const input of [$('#ampSlider'), $('#lambdaSlider'), $('#freqSlider')]) { const pct = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100; input.style.background = `linear-gradient(90deg,${css('--cyan')} ${pct}%,#274159 ${pct}%)`; }
    updateGraphMeasures();
    if (motionReduced) { mainChart.redraw(); heroChart.redraw(); stringChart.redraw(); guitarChart.redraw(); soundChart.redraw(); readChart.redraw(); }
    conceptViewed('anatomia');
  }
  ['ampSlider', 'lambdaSlider', 'freqSlider'].forEach(id => $('#' + id).addEventListener('input', updateWave));
  $('#pauseWave').addEventListener('click', e => { waveState.paused = !waveState.paused; e.currentTarget.textContent = waveState.paused ? '▶' : 'Ⅱ'; e.currentTarget.setAttribute('aria-label', waveState.paused ? 'Reproduzir onda' : 'Pausar onda'); });
  $('#resetWave').addEventListener('click', () => { $('#ampSlider').value = 1; $('#lambdaSlider').value = 3; $('#freqSlider').value = 2; waveState.paused = false; $('#pauseWave').textContent = 'Ⅱ'; updateWave(); });
  $('#particlePlay').addEventListener('click', e => { particlePaused = !particlePaused; e.currentTarget.textContent = particlePaused ? '▶' : 'Ⅱ'; e.currentTarget.setAttribute('aria-label', particlePaused ? 'Reproduzir animação' : 'Pausar animação'); });
  $('#visualExplain').addEventListener('click', e => {
    const open = e.currentTarget.dataset.open === '1'; e.currentTarget.dataset.open = open ? '0' : '1';
    e.currentTarget.textContent = open ? '✦ Explique visualmente' : '✦ Ver explicação física';
    $('#waveInsight').textContent = open ? `A cada segundo, a onda completa ${fmt(waveState.f, 1)} oscilações. A distância entre cristas é ${fmt(waveState.lambda, 1)} m.` : `Imagine uma fila fazendo uma ola: cada ponto sobe e desce no lugar. A forma avança ${fmt(waveState.lambda * waveState.f, 1)} metros a cada segundo.`;
  });

  function updateCompare() {
    const f = Number($('#compareSlider').value), period = 1 / f;
    $('#freqCompareOut').textContent = `${fmt(f, 1)} Hz`; $('#cycleCount').textContent = fmt(f, 1); $('#comparePeriod').textContent = fmt(period, 2);
    $('#freqInsight').textContent = `${fmt(f, 1)} ciclos por segundo: cada ciclo dura ${fmt(period, 2)} s.`;
    const input = $('#compareSlider'), pct = (f - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.background = `linear-gradient(90deg,${css('--cyan')} ${pct}%,#274159 ${pct}%)`;
    if (motionReduced) compareChart.redraw();
  }
  $('#compareSlider').addEventListener('input', updateCompare); updateCompare();
  function updateTone() {
    const f = Number($('#toneSlider').value); $('#toneOut').textContent = `${fmt(f, 0)} Hz`;
    const input = $('#toneSlider'), pct = (f - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100; input.style.background = `linear-gradient(90deg,${css('--purple')} ${pct}%,#274159 ${pct}%)`;
    if (oscillator && audioContext) oscillator.frequency.setTargetAtTime(f, audioContext.currentTime, .03);
    if (motionReduced) soundChart.redraw();
  }
  $('#toneSlider').addEventListener('input', updateTone); updateTone();
  function updateString() {
    stringState.tension = Number($('#tensionSlider').value); stringState.length = Number($('#stringLengthSlider').value);
    const relative = 220 * Math.sqrt(stringState.tension / 4) * (65 / stringState.length);
    const tensionWord = stringState.tension < 4 ? 'Baixa' : stringState.tension > 6 ? 'Alta' : 'Média';
    $('#tensionOut').textContent = tensionWord; $('#stringLengthOut').textContent = `${stringState.length} cm`; $('#stringLengthLabel').textContent = `L = ${stringState.length} cm`;
    $('#stringFrequency').textContent = `≈ ${fmt(relative, 0)} Hz`;
    $('#stringPitch').textContent = relative < 220 ? 'Frequência menor: som mais grave.' : relative > 220 ? 'Frequência maior: som mais agudo.' : 'Referência: altura intermediária.';
    if (motionReduced) guitarChart.redraw();
  }
  $('#tensionSlider').addEventListener('input', updateString); $('#stringLengthSlider').addEventListener('input', updateString); updateString();
  $('#listenTone').addEventListener('click', async e => {
    const btn = e.currentTarget;
    try {
      if (oscillator) { oscillator.stop(); oscillator = null; btn.innerHTML = '<span>▶</span> Ouvir frequência'; return; }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { btn.textContent = 'Áudio não disponível neste navegador'; return; }
      audioContext ||= new AudioCtx(); await audioContext.resume();
      oscillator = audioContext.createOscillator(); gainNode = audioContext.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = Number($('#toneSlider').value); gainNode.gain.setValueAtTime(.16, audioContext.currentTime); oscillator.connect(gainNode).connect(audioContext.destination); oscillator.start(); btn.innerHTML = '<span>■</span> Parar áudio';
      oscillator.onended = () => { oscillator = null; btn.innerHTML = '<span>▶</span> Ouvir frequência'; };
    } catch { btn.textContent = 'Áudio não disponível neste navegador'; }
  });

  // Electromagnetic spectrum ranges are illustrative and deliberately approximate.
  const spectrum = {
    radio: { icon: '⌁', title: 'ONDAS DE RÁDIO', desc: 'Ondas longas usadas para transmitir sinais a grandes distâncias.', f: '3 kHz – 300 MHz', l: '100 km – 1 m', e: 'Baixa', apps: 'Rádio · televisão · comunicação' },
    micro: { icon: '◉', title: 'MICRO-ONDAS', desc: 'Radiação usada em comunicação, radar e aquecimento de alimentos.', f: '300 MHz – 300 GHz', l: '1 m – 1 mm', e: 'Baixa a moderada', apps: 'Radar · satélites · forno de micro-ondas' },
    infra: { icon: '≈', title: 'INFRAVERMELHO', desc: 'Associado à radiação térmica e detectado por sensores.', f: '300 GHz – 430 THz', l: '1 mm – 700 nm', e: 'Moderada', apps: 'Sensores · controles remotos · termografia' },
    visible: { icon: '✺', title: 'LUZ VISÍVEL', desc: 'Faixa de radiação que nossos olhos conseguem detectar.', f: '≈ 430 – 750 THz', l: '≈ 700 – 400 nm', e: 'Moderada', apps: 'Visão · iluminação · fotografia' },
    uv: { icon: '☼', title: 'ULTRAVIOLETA', desc: 'Radiação solar de frequência maior que a luz visível; parte pode causar danos à pele.', f: '≈ 750 THz – 30 PHz', l: '≈ 400 – 10 nm', e: 'Alta', apps: 'Esterilização · análise de materiais · Sol' },
    xray: { icon: '⊗', title: 'RAIOS X', desc: 'Radiação penetrante usada em imagens médicas e inspeção de materiais.', f: '≈ 30 PHz – 30 EHz', l: '≈ 10 – 0,01 nm', e: 'Muito alta', apps: 'Radiografia · tomografia · inspeção' },
    gamma: { icon: '✳', title: 'RAIOS GAMA', desc: 'Radiação de frequência muito alta, emitida em processos nucleares e astrofísicos.', f: '> 30 EHz', l: '< 0,01 nm', e: 'Extremamente alta', apps: 'Medicina nuclear · radioterapia · astrofísica' }
  };
  $$('[data-spectrum]').forEach(button => button.addEventListener('click', () => {
    $$('[data-spectrum]').forEach(b => b.classList.toggle('active', b === button));
    const item = spectrum[button.dataset.spectrum];
    $('#specIcon').textContent = item.icon; $('#specTitle').textContent = item.title; $('#specDescription').textContent = item.desc;
    $('#specFrequency').textContent = item.f; $('#specLambda').textContent = item.l; $('#specEnergy').textContent = item.e; $('#specApplications').textContent = item.apps;
    conceptViewed('espectro');
  }));

  const applications = [
    { icon: '📡', title: 'Radiotelescópio', tag: 'ELETROMAGNÉTICA', phenomenon: 'Antenas captam ondas de rádio emitidas por objetos celestes.', type: 'Onda eletromagnética transversal.', how: 'A antena converte o campo eletromagnético recebido em um sinal que pode ser analisado.', concept: 'Frequência, comprimento de onda e telecomunicações.' },
    { icon: '🌊', title: 'Ondas na água', tag: 'MECÂNICA', phenomenon: 'Uma perturbação na superfície se espalha pela água.', type: 'Onda mecânica de superfície.', how: 'A forma avança; parcelas de água oscilam localmente, com movimento que pode combinar componentes verticais e horizontais.', concept: 'Propagação de energia, amplitude e comprimento de onda.' },
    { icon: '🙌', title: 'A ola no estádio', tag: 'PULSO', phenomenon: 'O movimento de levantar e sentar percorre a arquibancada.', type: 'Pulso mecânico transversal, em uma analogia simplificada.', how: 'Cada pessoa se move perto de seu lugar e desencadeia o movimento da pessoa seguinte.', concept: 'A perturbação se propaga sem transportar as pessoas pelo estádio.' },
    { icon: '🩻', title: 'Radiografia', tag: 'RAIOS X', phenomenon: 'Uma imagem registra diferenças na passagem de raios X pelo corpo.', type: 'Onda eletromagnética de alta frequência.', how: 'Tecidos absorvem a radiação de maneiras diferentes, produzindo contraste no detector.', concept: 'Espectro eletromagnético e interação da radiação com a matéria.' },
    { icon: '🌊', title: 'Tsunami', tag: 'ENERGIA NO OCEANO', phenomenon: 'Um grande deslocamento de água gera ondas que podem atravessar o oceano.', type: 'Onda mecânica de gravidade em água rasa quando chega à costa.', how: 'Terremotos submarinos são uma causa comum. Em mar aberto, o tsunami pode ter grande comprimento de onda e pequena altura; perto da costa, desacelera e pode crescer.', concept: 'Transporte de energia, comprimento de onda e efeito da profundidade.' },
    { icon: '🎸', title: 'Violão', tag: 'RESSONÂNCIA', phenomenon: 'A corda vibrante produz som e o corpo do instrumento o amplifica.', type: 'Onda transversal estacionária na corda; onda sonora no ar.', how: 'A corda vibra em modos permitidos. A frequência depende de tensão, comprimento e massa por unidade de comprimento.', concept: 'Frequência, harmônicos, tensão e ressonância.' },
    { icon: '〰️', title: 'Corda em movimento', tag: 'TRANSVERSAL', phenomenon: 'Um pulso percorre a corda depois de um movimento da mão.', type: 'Onda mecânica transversal.', how: 'Pontos da corda oscilam perpendicularmente à direção de propagação.', concept: 'Amplitude, velocidade da onda e direção de oscilação.' },
    { icon: '🔊', title: 'Alto-falante', tag: 'SOM', phenomenon: 'A membrana vibrante cria variações de pressão no ar.', type: 'Onda mecânica longitudinal no ar.', how: 'Compressões e rarefações se propagam até o ouvido.', concept: 'Frequência percebida como altura sonora e amplitude ligada à intensidade.' }
  ];
  const appGrid = $('#applicationGrid');
  applications.forEach((item, i) => {
    const button = document.createElement('button'); button.className = 'app-card'; button.type = 'button';
    button.innerHTML = `<span class="app-arrow">↗</span><span class="app-illustration" aria-hidden="true">${item.icon}</span><b>${item.title}</b><small>${item.tag}</small>`;
    button.addEventListener('click', () => {
      $$('.app-card').forEach(card => card.classList.remove('active')); button.classList.add('active');
      const tsunamiVisual = item.title === 'Tsunami' ? '<div class="tsunami-mini" aria-label="Animação de uma onda oceânica avançando em direção à costa"><span>MAR ABERTO</span><svg viewBox="0 0 500 70" preserveAspectRatio="none" aria-hidden="true"><path class="tsunami-line" d="M0 32 C40 25 70 40 110 32 S180 24 220 32 S290 40 330 32 S400 24 450 32 L500 28"/><path class="tsunami-fill" d="M0 34 C40 27 70 42 110 34 S180 26 220 34 S290 42 330 34 S400 26 450 34 L500 30 L500 70 L0 70Z"/></svg><span>COSTA · ÁGUA RASA</span><small>O comprimento de onda diminui e a altura pode crescer na aproximação da costa.</small></div>' : '';
      $('#applicationDetail').innerHTML = `<span class="detail-icon">${item.icon}</span><div><span class="eyebrow">${item.title.toUpperCase()} · ${item.tag}</span><h3>${item.phenomenon}</h3><p><b>Tipo:</b> ${item.type} <b>Como ocorre:</b> ${item.how} <b>Conceito:</b> ${item.concept}</p>${tsunamiVisual}</div>`;
      conceptViewed(`aplicacao-${i}`);
    }); appGrid.append(button);
  });

  $$('[data-graph]').forEach(button => button.addEventListener('click', () => {
    graphMode = button.dataset.graph; $$('[data-graph]').forEach(b => b.classList.toggle('active', b === button));
    $('#graphMeaning').textContent = graphMode === 'space' ? 'Um instantâneo da forma da onda no espaço.' : 'A oscilação observada em um ponto ao longo do tempo.';
    $('#graphMeasure').hidden = graphMode !== 'space'; $('#periodMeasure').hidden = graphMode !== 'time';
    updateGraphMeasures(); readChart.redraw(); conceptViewed('graficos');
  }));
  function updateGraphMeasures() {
    $('#graphMeasure').textContent = `↔ λ = ${fmt(waveState.lambda, 1)} m`;
    $('#periodMeasure').textContent = `↔ T = ${fmt(1 / waveState.f, 2)} s`;
  }

  const inputs = { v: $('#calcV'), f: $('#calcF'), T: $('#calcT'), l: $('#calcL') };
  function calculate() {
    const raw = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim() === '' ? null : Number(el.value)]));
    const invalid = Object.values(raw).some(value => value !== null && (!Number.isFinite(value) || value <= 0));
    if (invalid) {
      $('#calcAnswer').hidden = true; $('#calcPlaceholder').hidden = false;
      $('#calcPlaceholder').querySelector('p').textContent = 'Use valores positivos. Frequência, período, velocidade e comprimento de onda não podem ser zero.';
      $('#calcStatus').textContent = 'REVISE OS DADOS'; $('#calcStatus').classList.remove('ready'); return;
    }
    $('#calcPlaceholder').querySelector('p').textContent = 'Insira dois valores compatíveis para ver a resolução passo a passo.';
    const hasF = raw.f !== null || raw.T !== null;
    let f = raw.f, T = raw.T, v = raw.v, l = raw.l, steps = [];
    if ((f === null || f <= 0) && T !== null && T > 0) { f = 1 / T; steps.push(`f = 1/T = 1/${fmt(T, 4)} = ${fmt(f, 4)} Hz`); }
    if ((T === null || T <= 0) && f !== null && f > 0) { T = 1 / f; steps.push(`T = 1/f = 1/${fmt(f, 4)} = ${fmt(T, 4)} s`); }
    let valid = [raw.v, f, l].filter(x => x !== null && x > 0).length;
    if (valid < 2) {
      if (f !== null && f > 0) {
        $('#calcPlaceholder').hidden = true; $('#calcAnswer').hidden = false;
        $('#calcStatus').textContent = 'RELAÇÃO PARCIAL'; $('#calcStatus').classList.add('ready');
        $('#answerV').textContent = v === null ? '—' : `${fmt(v, 4)} m/s`; $('#answerF').textContent = `${fmt(f, 4)} Hz`;
        $('#answerT').textContent = T === null ? '—' : `${fmt(T, 4)} s`; $('#answerL').textContent = l === null ? '—' : `${fmt(l, 4)} m`;
        const mismatch = raw.f !== null && raw.T !== null && Math.abs(raw.f * raw.T - 1) > .02 ? '<br>Atenção: os valores informados de f e T não são recíprocos.' : '';
        $('#calcSteps').innerHTML = `<b>Relação possível</b><br>${steps.join('<br>')}${mismatch}<br>Para calcular a velocidade e o comprimento de onda, informe mais um dado independente: v ou λ.`;
      } else {
        $('#calcAnswer').hidden = true; $('#calcPlaceholder').hidden = false;
        $('#calcStatus').textContent = 'AGUARDANDO DADOS'; $('#calcStatus').classList.remove('ready');
      }
      return;
    }
    if (v === null && f !== null && l !== null) { v = l * f; steps.push(`v = λ · f = ${fmt(l, 4)} · ${fmt(f, 4)} = ${fmt(v, 4)} m/s`); }
    else if (l === null && v !== null && f !== null) { l = v / f; steps.push(`λ = v/f = ${fmt(v, 4)}/${fmt(f, 4)} = ${fmt(l, 4)} m`); }
    else if (f === null && v !== null && l !== null) { f = v / l; T = 1 / f; steps.push(`f = v/λ = ${fmt(v, 4)}/${fmt(l, 4)} = ${fmt(f, 4)} Hz`); steps.push(`T = 1/f = ${fmt(T, 4)} s`); }
    else if (hasF && v !== null && l !== null) {
      if (raw.f !== null && raw.T !== null && Math.abs(raw.f * raw.T - 1) > .02) steps.unshift('Atenção: os valores de f e T informados não são recíprocos; foi usado f para calcular v.');
      steps.push(`v = λ · f = ${fmt(l, 4)} · ${fmt(f, 4)} = ${fmt(v, 4)} m/s`);
    }
    if (T === null && f !== null) T = 1 / f;
    if (f === null && T !== null) f = 1 / T;
    $('#calcPlaceholder').hidden = true; $('#calcAnswer').hidden = false; $('#calcStatus').textContent = 'RESOLVIDO'; $('#calcStatus').classList.add('ready');
    $('#answerV').textContent = v === null ? '—' : `${fmt(v, 4)} m/s`; $('#answerF').textContent = f === null ? '—' : `${fmt(f, 4)} Hz`;
    $('#answerT').textContent = T === null ? '—' : `${fmt(T, 4)} s`; $('#answerL').textContent = l === null ? '—' : `${fmt(l, 4)} m`;
    $('#calcSteps').innerHTML = `<b>Resolução passo a passo</b><br>${steps.length ? steps.join('<br>') : 'Use v = λ · f e T = 1/f para relacionar as grandezas.'}`;
    conceptViewed('calculadora');
  }
  Object.values(inputs).forEach(el => el.addEventListener('input', calculate));
  $('#clearCalc').addEventListener('click', () => { Object.values(inputs).forEach(el => el.value = ''); calculate(); });
  $('#exampleCalc').addEventListener('click', () => { inputs.v.value = ''; inputs.T.value = ''; inputs.l.value = 2; inputs.f.value = 5; calculate(); });
  calculate();

  const questions = [
    { level: 1, type: 'CONCEITO', text: 'Em uma onda transversal, como se relacionam a oscilação das partículas e a propagação?', hint: 'Compare as setas vertical e horizontal nas cordas.', options: ['São perpendiculares.', 'São paralelas.', 'Não existe oscilação.', 'A matéria viaja junto com a onda.'], answer: 0, explanation: 'Na onda transversal, as partículas oscilam perpendicularmente à direção em que a perturbação avança.', trap: 'Confundir a direção do movimento local das partículas com a direção em que a onda se propaga.' },
    { level: 1, type: 'ANATOMIA', text: 'A amplitude de uma onda é medida entre quais pontos?', hint: 'Amplitude é o afastamento máximo em relação ao equilíbrio.', options: ['Da crista até o vale.', 'Do equilíbrio até a crista (ou o vale).', 'Entre duas cristas.', 'Entre a fonte e o observador.'], answer: 1, explanation: 'A amplitude é o deslocamento máximo a partir da posição de equilíbrio. Crista a vale mede 2A.', trap: 'Tomar a altura total da onda, crista a vale, como uma amplitude.' },
    { level: 1, type: 'CONCEITO', text: 'Em uma onda longitudinal, as partículas do meio oscilam…', hint: 'Pense nas compressões e rarefações do som no ar.', options: ['Perpendicularmente à propagação.', 'Paralelamente à propagação.', 'Em círculos perfeitos sempre.', 'Sem se mover.'], answer: 1, explanation: 'Nas ondas longitudinais, a oscilação ocorre paralelamente à direção de propagação, criando compressões e rarefações.', trap: 'O som no ar não é uma onda transversal: as regiões de pressão avançam na mesma direção da oscilação das moléculas.' },
    { level: 2, type: 'INTERPRETAÇÃO', text: 'Duas ondas percorrem o mesmo meio. Qual delas tem maior amplitude?', hint: 'Compare o afastamento máximo em relação à linha central.', visual: 'amplitude', options: ['Onda A, que se afasta 2 cm do equilíbrio.', 'Onda B, que se afasta 5 cm do equilíbrio.', 'As duas têm a mesma amplitude.', 'Não é possível comparar amplitude.'], answer: 1, explanation: 'A onda B atinge um deslocamento máximo de 5 cm, maior que os 2 cm da onda A.', trap: 'Amplitude não é o comprimento de onda, que é medido na horizontal.' },
    { level: 2, type: 'INTERPRETAÇÃO', text: 'No gráfico posição × distância, cristas sucessivas estão separadas por 4 m. Qual é o comprimento de onda?', hint: 'Comprimento de onda é uma distância entre pontos equivalentes consecutivos.', options: ['2 m', '4 m', '8 m', 'Não pode ser obtido de um gráfico espacial.'], answer: 1, explanation: 'A distância entre cristas consecutivas é um comprimento de onda, então λ = 4 m.', trap: 'Não dobre a distância crista a crista. O fator 2 só aparece para a distância crista a vale.' },
    { level: 3, type: 'CÁLCULO', text: 'Uma onda tem comprimento de onda 2 m e frequência 5 Hz. Qual é sua velocidade?', hint: 'Use v = λ · f e confira as unidades.', options: ['2,5 m/s', '7 m/s', '10 m/s', '0,4 m/s'], answer: 2, explanation: 'v = λf = 2 m × 5 s⁻¹ = 10 m/s.', trap: 'A frequência deve ser multiplicada pelo comprimento de onda, não dividida.' },
    { level: 3, type: 'CÁLCULO', text: 'Uma corda vibra com frequência de 4 Hz. Qual é o período de uma oscilação?', hint: 'O período é o inverso da frequência.', options: ['4 s', '2 s', '0,25 s', '0,04 s'], answer: 2, explanation: 'T = 1/f = 1/4 = 0,25 s por oscilação.', trap: '4 Hz significa quatro ciclos em um segundo; por isso, cada ciclo dura menos de um segundo.' },
    { level: 4, type: 'APLICAÇÃO · ENEM', text: 'Um sinal de rádio se propaga no vácuo. Se sua frequência aumenta, o que acontece com seu comprimento de onda?', hint: 'No vácuo, a velocidade da onda eletromagnética é constante.', options: ['O comprimento de onda aumenta.', 'O comprimento de onda diminui.', 'A velocidade aumenta junto com a frequência.', 'A frequência não afeta o comprimento de onda.'], answer: 1, explanation: 'Como v = λf e a velocidade da luz no vácuo é constante, aumentar f exige diminuir λ.', trap: 'Não suponha que a velocidade no vácuo varie com a frequência. Para ondas eletromagnéticas no vácuo, c é constante.' },
    { level: 1, type: 'ANATOMIA', text: 'Em uma onda desenhada, qual nome recebe o ponto mais alto em relação à linha de equilíbrio?', hint: 'O ponto mais baixo recebe o nome de vale.', options: ['Crista.', 'Vale.', 'Período.', 'Comprimento de onda.'], answer: 0, explanation: 'Crista é o ponto de máximo deslocamento acima da linha de equilíbrio. O ponto mais baixo é o vale.', trap: 'Amplitude é a distância vertical até a crista; crista é o ponto da onda.' },
    { level: 2, type: 'INTERPRETAÇÃO', text: 'Duas ondas se propagam no mesmo meio e têm a mesma velocidade. A onda X tem λ = 2 m; a onda Y tem λ = 4 m. Qual tem maior frequência?', hint: 'Use v = λf e mantenha v igual para as duas ondas.', options: ['X, com menor comprimento de onda.', 'Y, com maior comprimento de onda.', 'As frequências são iguais.', 'Não há relação entre λ e f.'], answer: 0, explanation: 'Como v é constante, f = v/λ. A onda X, com comprimento de onda menor, tem frequência maior.', trap: 'A relação é inversa quando a velocidade no meio é a mesma.' },
    { level: 3, type: 'CÁLCULO', text: 'Uma onda na água se desloca a 12 m/s e tem frequência 3 Hz. Qual é seu comprimento de onda?', hint: 'Isole λ na relação v = λ · f.', options: ['36 m', '15 m', '4 m', '0,25 m'], answer: 2, explanation: 'λ = v/f = 12/3 = 4 m.', trap: 'Para encontrar λ, divida a velocidade pela frequência.' },
    { level: 4, type: 'APLICAÇÃO · SOM', text: 'Uma nota musical passa de 220 Hz para 440 Hz. O que muda na percepção e no período?', hint: 'Frequência maior corresponde a som mais agudo e T = 1/f.', options: ['Fica mais grave e o período dobra.', 'Fica mais aguda e o período cai pela metade.', 'Fica mais intensa, mas mantém a altura.', 'A velocidade do som no ar dobra.'], answer: 1, explanation: 'A frequência dobra, então a nota fica mais aguda. O período cai de cerca de 4,5 ms para 2,3 ms.', trap: 'Frequência determina a altura (grave/agudo); intensidade está ligada à amplitude. A velocidade no ar não dobra por isso.' },
    { level: 4, type: 'APLICAÇÃO · INSTRUMENTO', text: 'Ao pressionar uma corda do violão, o comprimento que vibra diminui. Mantidas as outras propriedades, como fica o som?', hint: 'Para uma corda, f cresce quando o comprimento vibrante diminui.', options: ['Mais grave, frequência menor.', 'Mais agudo, frequência maior.', 'Mesma altura, apenas mais intenso.', 'O som deixa de se propagar no ar.'], answer: 1, explanation: 'Encurtar a parte vibrante aumenta a frequência natural da corda, produzindo uma nota mais aguda.', trap: 'Não confunda comprimento vibrante com amplitude: encurtar a corda altera a frequência.' },
    { level: 4, type: 'APLICAÇÃO · OCEANO', text: 'Por que um tsunami pode ter pouca altura em mar aberto e ainda assim transportar muita energia?', hint: 'Pense no tamanho espacial da onda e no deslocamento de água envolvido.', options: ['Porque tem comprimento de onda muito grande e mobiliza uma extensa coluna de água.', 'Porque é sempre uma onda sonora.', 'Porque só começa a existir quando quebra na praia.', 'Porque não transporta energia até a costa.'], answer: 0, explanation: 'Tsunamis têm comprimento de onda muito grande e envolvem movimento de água em profundidade. Ao chegar a águas rasas, desaceleram e podem aumentar de altura.', trap: 'Tsunami não é simplesmente uma onda gigante que aparece na praia; a energia se propaga pelo oceano desde o deslocamento inicial da água.' }
  ];
  let questionIndex = 0, selectedAnswer = null, answered = false, challengeFinished = false;
  const storageKey = 'wavelab-progress-v1';
  let progress = { done: 0, correct: 0, concepts: [], completedQuestions: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') progress = { ...progress, ...saved, concepts: Array.isArray(saved.concepts) ? saved.concepts : [], completedQuestions: Array.isArray(saved.completedQuestions) ? saved.completedQuestions : [] };
    progress.done = progress.completedQuestions.length;
    progress.correct = Math.min(progress.correct, progress.done);
  } catch { /* Private browsing may disable storage. */ }
  function persist() { try { localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* Continue without persistence if storage is unavailable. */ } }
  function renderProgress() {
    const pct = Math.min(100, Math.round(progress.done / questions.length * 100));
    $('#progressPercent').textContent = `${pct}%`; $('#ringPercent').textContent = `${pct}%`; $('#progressDone').textContent = progress.done; $('#progressCorrect').textContent = progress.correct; $('#conceptsCount').textContent = progress.concepts.length;
    $('#overallProgress').style.width = `${pct}%`; $('#progressRing').style.background = `conic-gradient(${css('--cyan')} ${pct * 3.6}deg,#20364b 0deg)`;
    $('#doneCount').textContent = progress.done; $('#correctCount').textContent = progress.correct;
  }
  function conceptViewed(key) { if (!progress.concepts.includes(key)) { progress.concepts.push(key); persist(); renderProgress(); } }
  function drawQuestionVisual(type) {
    const container = $('#questionVisual');
    if (type !== 'amplitude') { container.hidden = true; container.innerHTML = ''; return; }
    container.hidden = false; container.innerHTML = '<canvas aria-label="Comparação de duas amplitudes"></canvas>';
    const c = $('canvas', container); const dpr = Math.min(devicePixelRatio || 1, 2), rect = c.getBoundingClientRect(); c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); const w = rect.width, h = rect.height;
    line(ctx, 0, h * .5, w, h * .5, '#8495a555', [4, 4]);
    [[h * .2, '#63e2e3', 'A'], [h * .42, '#f3cb68', 'B']].forEach(([amp, color, label], idx) => {
      const y0 = idx === 0 ? h * .32 : h * .72; ctx.beginPath();
      for (let x = 0; x < w; x += 2) { const y = y0 - amp * Math.sin(2 * Math.PI * x / (w * .45)); if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = color; ctx.font = '10px monospace'; ctx.fillText(`Onda ${label}`, 10, idx ? h - 7 : 14);
    });
  }
  function showQuestion() {
    const q = questions[questionIndex]; selectedAnswer = null; answered = false;
    $('#questionNumber').textContent = String(questionIndex + 1).padStart(2, '0'); $('#questionTotal').textContent = questions.length; $('#questionLevel').textContent = `NÍVEL ${q.level} · ${['', 'RECONHECIMENTO', 'INTERPRETAÇÃO', 'CÁLCULO', 'APLICAÇÃO'][q.level]}`; $('#questionType').textContent = q.type;
    $('#questionText').textContent = q.text; $('#questionHint').textContent = `DICA: ${q.hint}`; $('#feedback').hidden = true; $('#feedback').className = 'feedback'; $('#nextQuestion').disabled = true;
    $('#nextQuestion').innerHTML = questionIndex === questions.length - 1 ? 'Concluir <span>✓</span>' : 'Responder <span>→</span>';
    $('#challengeProgress').style.width = `${(questionIndex / questions.length) * 100}%`;
    $$('.level').forEach(el => el.classList.toggle('active', Number(el.dataset.level) === q.level));
    drawQuestionVisual(q.visual);
    const answers = $('#answers'); answers.replaceChildren();
    q.options.forEach((text, i) => { const button = document.createElement('button'); button.className = 'answer-option'; button.type = 'button'; button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + i)}</span><span></span>`; $('span:last-child', button).textContent = text; button.addEventListener('click', () => { if (answered) return; selectedAnswer = i; $$('.answer-option').forEach(a => a.classList.toggle('selected', a === button)); $('#nextQuestion').disabled = false; }); answers.append(button); });
  }
  $('#nextQuestion').addEventListener('click', () => {
    if (challengeFinished) { challengeFinished = false; questionIndex = 0; showQuestion(); return; }
    if (!answered) {
      if (selectedAnswer === null) return;
      answered = true; const q = questions[questionIndex], correct = selectedAnswer === q.answer;
      if (!progress.completedQuestions.includes(questionIndex)) {
        progress.completedQuestions.push(questionIndex); progress.done = progress.completedQuestions.length; if (correct) progress.correct++;
        persist(); renderProgress();
      }
      conceptViewed('desafio');
      $$('.answer-option').forEach((button, i) => { button.disabled = true; if (i === q.answer) button.classList.add('correct'); else if (i === selectedAnswer) button.classList.add('wrong'); });
      const feedback = $('#feedback'); feedback.hidden = false; feedback.classList.add(correct ? 'good' : 'bad');
      feedback.innerHTML = `<b>${correct ? 'Resposta correta.' : 'Resposta: ' + String.fromCharCode(65 + q.answer) + '.'}</b> ${q.explanation}<br><b>Onde estava a pegadinha:</b> ${q.trap}`;
      $('#nextQuestion').innerHTML = questionIndex === questions.length - 1 ? 'Concluir <span>✓</span>' : 'Próxima questão <span>→</span>';
      $('#challengeProgress').style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
    } else if (questionIndex < questions.length - 1) { questionIndex++; showQuestion(); }
    else { challengeFinished = true; $('#questionLevel').textContent = 'PERCURSO CONCLUÍDO'; $('#questionType').textContent = 'RESULTADO'; $('#questionText').textContent = `Você respondeu às ${questions.length} questões. Acertos registrados: ${progress.correct}. Revise as explicações acima ou faça uma nova tentativa.`; $('#questionHint').textContent = 'Seu avanço e seus acertos ficam salvos neste navegador.'; $('#answers').replaceChildren(); $('#feedback').hidden = true; $('#challengeProgress').style.width = '100%'; $('#nextQuestion').disabled = false; $('#nextQuestion').innerHTML = 'Refazer desafios <span>↻</span>'; }
  });
  $('#resetProgress').addEventListener('click', () => { progress = { done: 0, correct: 0, concepts: [], completedQuestions: [] }; persist(); renderProgress(); challengeFinished = false; questionIndex = 0; showQuestion(); });
  renderProgress(); updateWave(); showQuestion();

  const menuButton = $('.menu-toggle'), nav = $('.nav');
  menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); menuButton.textContent = open ? '×' : '☰'; });
  $$('.nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.textContent = '☰'; }));
})();
