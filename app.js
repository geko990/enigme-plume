'use strict';
/* L'Énigme de la Plume — PWA del plico Cyrano.
   Nessun dato esce dal telefono: lo stato vive solo in localStorage. */

const KEY = 'enigme-plume-v1';
const PASSWORDS = ['ombre', 'lombre', 'ombres'];

function defaults() {
  return { seen: false, done: [], clues: [null, null, null, null, null], hyp: '', pred: null, bonus: false, revealed: false, letter: '' };
}
function load() {
  try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return defaults(); }
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible : on continue en mémoire */ } }

/* ---------- petits outils ---------- */
function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const app = document.getElementById('app');
function clear() { app.innerHTML = ''; window.scrollTo(0, 0); }
const deacc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = s => (s.trim().match(/[\p{L}\p{N}'’-]+/gu) || []);
const hasEmoji = s => /\p{Extended_Pictographic}/u.test(s);
const FORBID = /\b(etoiles?|soleils?|roses?)\b/;
const forbidden = s => FORBID.test(deacc(s));
function ending(line) {
  const w = words(line);
  if (!w.length) return '';
  let x = deacc(w[w.length - 1]).replace(/[^a-z]/g, '').replace(/(s|x)$/, '');
  if (x.length > 3) x = x.replace(/e$/, '');
  return x.slice(-2);
}
function rhymes(a, b) {
  const ea = ending(a), eb = ending(b);
  if (!ea || ea !== eb) return false;
  const wa = words(a), wb = words(b);
  return deacc(wa[wa.length - 1]) !== deacc(wb[wb.length - 1]);
}
function toast(t) {
  const d = el('div', { class: 'toast', role: 'status' }, t);
  document.body.append(d);
  setTimeout(() => d.remove(), 2600);
}

const FEATHER = (fill = 'currentColor', w = 12, h = 30) =>
  `<svg aria-hidden="true" viewBox="0 0 120 300" style="width:${w}px;height:${h}px;transform:rotate(28deg)"><path d="M62 6 C 102 60, 108 160, 64 236 C 22 168, 20 70, 62 6 Z" fill="${fill}"/><path d="M62 10 L 58 296" stroke="#B8432F" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`;

/* Note d'E.R. : les lignes apparaissent une à une */
function er(lines, opts = {}) {
  const sign = opts.sign || (S.revealed ? 'R.AI' : 'E.R.');
  const box = el('div', { class: 'er' + (opts.ink ? ' ink' : '') + (opts.paper ? ' paper-note' : ''), role: 'note' });
  [].concat(lines).forEach((l, i) => box.append(el('div', { class: 'ln', style: `animation-delay:${i * 0.55}s` }, l)));
  const n = [].concat(lines).length;
  box.append(el('div', { class: 'sig ln', style: `animation-delay:${n * 0.55}s`, html: `— ${sign} ${S.revealed ? '' : FEATHER()}` }));
  return box;
}
function setER(slot, lines, opts) { slot.innerHTML = ''; slot.append(er(lines, opts)); }

const HOUSE = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>';
function bar(label, back = true) {
  return el('div', { class: 'bar' },
    back ? el('button', { class: 'iconbtn homebtn', onclick: goHome, 'aria-label': 'Retour au cahier', html: HOUSE + '<span>Cahier</span>' }) : null,
    el('div', { class: 'label' }, label),
    el('button', { class: 'iconbtn info', onclick: infoSheet, 'aria-label': 'Infos : installer l\'app' }, 'i'));
}
function head(box, title, instr, it) {
  box.append(el('h2', null, title));
  if (instr) box.append(el('p', { class: 'muted' }, instr));
  if (it) {
    const help = el('div', { class: 'help' }, '🇮🇹 ', it);
    box.append(el('button', { class: 'helpbtn', onclick: () => help.classList.toggle('open') }, 'Aide (in italiano)'), help);
  }
}
function cont(box, next, label = 'Continuer', cls = 'btn') {
  const b = el('button', { class: cls }, label);
  const a = el('div', { class: 'actions' }, b);
  b.addEventListener('click', () => { a.remove(); next(); });
  box.append(a);
  return a;
}
function runSteps(root, steps) {
  let i = 0;
  function go() {
    if (i >= steps.length) return;
    const box = el('section');
    root.append(box);
    const f = steps[i++];
    f(box, go);
    if (i > 1) setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  go();
}
function choiceQ(box, text, options, correct, onAnswer, cls = 'opts') {
  const q = el('div', { class: 'q' }, el('div', { class: 't' }, text));
  const wrap = el('div', { class: cls });
  let answered = false;
  options.forEach((o, i) => {
    const b = el('button', { class: 'opt' }, o);
    b.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const ok = Array.isArray(correct) ? correct.includes(i) : (correct === null || i === correct);
      b.classList.add(ok ? 'good' : 'bad');
      if (!ok && correct !== null) wrap.children[Array.isArray(correct) ? correct[0] : correct].classList.add('good');
      onAnswer(ok, i, q);
    });
    wrap.append(b);
  });
  q.append(wrap);
  box.append(q);
  return q;
}
function sealedIndice(box, n, text, gameId) {
  head(box, `Indice ${n}`, "E.R. a laissé une enveloppe pour toi.", "Tocca la busta per aprirla: l'indizio finisce nel tuo carnet.");
  const card = el('div', { class: 'indice' });
  const seal = el('button', { class: 'seal', 'aria-label': "Ouvrir l'enveloppe" });
  card.append(el('div', { class: 'k' }, 'INDICE'), el('div', { class: 'num' }, n), seal);
  seal.addEventListener('click', () => {
    seal.remove();
    card.append(el('div', { class: 'txt' }, text));
    S.clues[n - 1] = text;
    if (!S.done.includes(gameId)) S.done.push(gameId);
    save();
    card.after(el('div', { class: 'actions' },
      el('button', { class: 'btn', onclick: goHome }, 'Retour au cahier')));
  });
  box.append(card);
}

/* ---------- avatars & images ---------- */
const AVA = {
  christian: `<svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#1D2340" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.5-4 4.5-5.5 7.5-5.5s6 1.5 7.5 5.5"/></svg>`,
  cyrano: `<svg aria-hidden="true" viewBox="0 0 100 100" width="58" height="58"><path d="M22 100 C 16 80, 14 60, 22 44 C 30 28, 48 22, 60 30 C 66 34, 68 40, 68 46 L 92 58 C 94 60, 92 62, 88 62 L 68 62 C 70 66, 68 70, 66 72 C 68 76, 64 80, 60 80 L 58 100 Z" fill="#1D2340"/><path d="M14 36 C 30 26, 60 20, 80 26 L 76 30 C 56 26, 34 30, 18 40 Z" fill="#1D2340"/><path d="M60 24 C 70 8, 86 4, 96 8 C 86 12, 74 18, 64 28 Z" fill="#B8432F"/></svg>`,
  roxane: `<svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z"/><path d="M12 6v13"/></svg>`
};
const PERSON_BIG = `<svg aria-hidden="true" viewBox="0 0 24 24" width="40%" fill="none" stroke="#1D2340" stroke-width="1.2"><circle cx="12" cy="9" r="4"/><path d="M4.5 20c1.5-4 4.5-5.5 7.5-5.5s6 1.5 7.5 5.5"/></svg>`;
const ENVELOPE = `<svg aria-hidden="true" viewBox="0 0 24 24" width="36%" fill="none" stroke="#F6F1E7" stroke-width="1.1"><path d="M4 6h16v12H4z"/><path d="M4 6l8 7 8-7"/></svg>`;
const BLOT = `<svg class="blot" aria-hidden="true" viewBox="0 0 600 600"><path d="M300 70 C 380 60, 470 120, 480 210 C 540 230, 560 300, 500 340 C 520 420, 450 500, 360 480 C 320 540, 220 540, 190 470 C 110 490, 50 420, 90 350 C 30 300, 60 210, 140 200 C 150 120, 230 60, 300 70 Z" fill="#1D2340"/><circle cx="520" cy="150" r="18" fill="#1D2340"/><circle cx="70" cy="470" r="14" fill="#1D2340"/><g transform="translate(250 130) rotate(28 60 150)"><path d="M62 6 C 102 60, 108 160, 64 236 C 22 168, 20 70, 62 6 Z" fill="#F6F1E7"/><path d="M62 10 L 58 296" stroke="#B8432F" stroke-width="5" fill="none"/></g></svg>`;

/* =====================================================================
   JEU 1 – Plumagram
   ===================================================================== */
function game1(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, 'Trois profils sur Plumagram'));
      box.append(el('p', null, "Paris, aujourd'hui. Trois personnes, trois profils. Regarde bien : un profil dit beaucoup… même quand il ne dit rien."));
      const help = el('div', { class: 'help' }, "🇮🇹 Guarda i tre profili (tocca i nomi in alto). Poi rispondi alle domande.");
      box.append(el('button', { class: 'helpbtn', onclick: () => help.classList.toggle('open') }, 'Aide (in italiano)'), help);
      const tabs = el('div', { class: 'tabs', role: 'tablist' });
      const view = el('div');
      const P = {
        christian: () => el('div', { class: 'phone' },
          el('div', { class: 'top', html: FEATHER('#1D2340', 9, 22) + ' Plumagram' }),
          el('div', { class: 'prof' }, el('div', { class: 'ava', style: 'background:#F2C14E', html: AVA.christian }),
            el('div', null, el('b', null, '@christian.nvx'), el('div', { class: 'muted' }, 'Nouveau à Paris.'))),
          el('div', { class: 'counts', html: '<b>58</b> posts · <b>2 431</b> abonnés · <b>312</b> abonnements' }),
          el('div', { class: 'post' }, el('div', { class: 'img', style: 'background:#F2C14E', html: PERSON_BIG }),
            el('div', { class: 'cap', html: "<b>Moi.</b> <span class='muted'>· 312 j'aime · trop beau · grave</span>" })),
          el('div', { class: 'post' }, el('div', { class: 'img', style: 'background:#E8A33D', html: PERSON_BIG }),
            el('div', { class: 'cap', html: "<b>Moi. Encore moi.</b> <span class='muted'>· 287 j'aime</span>" })),
          el('div', { class: 'comment', html: "<span class='muted'>STORY</span><br><b>Quelqu'un connaît une Roxane ?</b><br><span class='muted'>0 réponse</span>" }),
          er(['Trois mots par photo.', "Vous faites des économies pour l'hiver ?"])),
        cyrano: () => el('div', { class: 'phone' },
          el('div', { class: 'top', html: FEATHER('#1D2340', 9, 22) + ' Plumagram' }),
          el('div', { class: 'prof' }, el('div', { class: 'ava', style: 'background:#E4DED0', html: AVA.cyrano }), el('b', null, '@cyrano.debergerac')),
          el('p', { class: 'small', style: 'margin-top:8px' }, "Quelqu'un m'a créé ce compte. Je ne sais pas à quoi il sert. Alors j'y laisse des pages."),
          el('div', { class: 'counts', html: '<b>12</b> posts · <b>87</b> abonnés · <b>0</b> abonnement' }),
          el('div', { class: 'post' }, el('div', { class: 'img', style: 'background:#FFFDF7;border:1px solid #D9D4C7', html: '<div class="lines"><div></div><div style="width:80%"></div><div style="width:90%"></div><div style="width:65%"></div><div style="width:85%"></div><div style="width:72%"></div></div>' }),
            el('div', { class: 'cap', html: "<b>Ce soir, la lune a l'air d'une pièce de monnaie que personne n'ose dépenser.</b>" })),
          el('div', { class: 'post' }, el('div', { class: 'img', style: 'background:#3A4166', html: ENVELOPE }),
            el('div', { class: 'cap', html: "<b>Certaines lettres ne partent jamais.</b> <span class='muted'>· pour qui ??</span>" })),
          el('div', { class: 'comment', html: "<span class='muted'>un abonné :</span> Montre ton visage !<br><b>@cyrano.debergerac :</b> Mon nez arrive toujours avant moi. Laissons-lui la surprise." }),
          er(['Enfin une plume !'])),
        roxane: () => {
          const follow = el('button', { class: 'btn', style: 'margin:10px auto;display:flex' }, 'Suivre');
          const slot = el('div');
          follow.addEventListener('click', () => {
            follow.textContent = 'Demande envoyée…';
            follow.disabled = true;
            setER(slot, ['Privé. Enfin quelqu\'un qui ne se donne pas au premier venu.']);
          });
          return el('div', { class: 'phone' },
            el('div', { class: 'top', html: FEATHER('#1D2340', 9, 22) + ' Plumagram' }),
            el('div', { class: 'prof' }, el('div', { class: 'ava', style: 'background:#B8432F', html: AVA.roxane }), el('b', null, '@roxane')),
            el('p', { style: "font-family:var(--serif);font-style:italic;margin-top:8px" }, 'J\'aime les mots qui restent.'),
            el('div', { class: 'counts', html: '<b>?</b> posts · <b>?</b> abonnés · <b>?</b> abonnements' }),
            el('div', { style: 'text-align:center;padding:24px 0;border-top:1px solid #D9D4C7' },
              el('div', { style: 'font-size:40px', 'aria-hidden': 'true' }, '🔒'),
              el('b', null, 'Ce compte est privé.'),
              el('p', { class: 'muted' }, 'Seules les personnes acceptées voient ses publications.'),
              el('p', { class: 'small' }, 'Demande de @christian.nvx : en attente…'), follow), slot);
        }
      };
      const names = [['christian', 'Christian'], ['cyrano', 'Cyrano'], ['roxane', 'Roxane']];
      function show(k) {
        [...tabs.children].forEach(c => c.classList.toggle('on', c.dataset.k === k));
        view.innerHTML = '';
        view.append(P[k]());
      }
      names.forEach(([k, n]) => tabs.append(el('button', { class: 'chip', 'data-k': k, role: 'tab', onclick: () => show(k) }, n)));
      box.append(tabs, view);
      show('christian');
      cont(box, next, 'Aux questions');
    },
    (box, next) => {
      head(box, 'A. Vrai, faux… ou on ne sait pas encore ?', 'Attention : parfois, la bonne réponse est « on ne sait pas encore ».', "Vero, falso o «non si sa ancora»? Se serve, torna su a guardare i profili.");
      const Q = [
        ['Christian est nouveau à Paris.', 0, 'Regarde sa bio : « Nouveau à Paris. »'],
        ['Cyrano publie beaucoup de selfies.', 1, 'Cyrano ne montre jamais son visage.'],
        ["Christian cherche une fille qui s'appelle Roxane.", 0, 'Sa story : « Quelqu\'un connaît une Roxane ? »'],
        ['Cyrano écrit à la main.', 0, 'Ses posts sont des pages écrites à la main.'],
        ['Roxane accepte tout le monde sur son profil.', 1, 'Son compte est privé : elle choisit.'],
        ["L'enveloppe de Cyrano est pour Roxane.", 2, '« Pour qui ?? » Personne ne le sait… encore.'],
        ['Christian aime les phrases longues.', 1, '« Moi. » « Moi. Encore moi. » Pas très long.']];
      let n = 0, good = 0;
      const PRAISE = ['Bien vu.', 'Exact.', 'Tu lis entre les lignes.', 'Oui.'];
      const out = el('div');
      Q.forEach(([t, c, hint], i) => choiceQ(box, `${i + 1}. ${t}`, ['Vrai', 'Faux', 'On ne sait pas encore'], c, (ok, _, q) => {
        n++; if (ok) good++;
        q.append(el('div', { class: 'small', style: `margin-top:6px;color:${ok ? 'var(--ok)' : 'var(--red)'}` }, ok ? PRAISE[i % PRAISE.length] : hint));
        if (n === Q.length) {
          setER(out, good >= 6 ? ["Tu as l'œil. Et peut-être une plume."] : ['Pas mal. Relis les profils :', 'ils parlent à voix basse.']);
          cont(box, next);
        }
      }, 'row3'));
      box.append(out);
    },
    (box, next) => {
      head(box, 'B. Qui pourrait dire ça ?', 'Choisis un profil pour chaque phrase.', 'Chi potrebbe dire questa frase? Scegli il profilo.');
      const Q = [["« Un message, c'est plus simple, non ? »", 0], ['« Je préfère une lettre. Une vraie. Avec de vrais mots. »', 2],
        ['« Je ris de mon nez. Mais seulement moi. »', 1], ['« Pourquoi écrire beaucoup ? Une photo suffit. »', 0],
        ["« La nuit, j'ose dire ce que le jour me cache. »", 1]];
      let n = 0;
      Q.forEach(([t, c]) => choiceQ(box, t, ['Christian', 'Cyrano', 'Roxane'], c, () => {
        if (++n === Q.length) cont(box, next);
      }, 'row3'));
    },
    (box, next) => {
      head(box, "C. À toi d'écrire", "Christian attend. Roxane n'a pas encore accepté. Écris le petit message qui accompagne sa demande d'abonnement. Quelque chose qui donne envie de dire « oui ».", 'Scrivi il messaggio che accompagna la richiesta di Christian (due righe al massimo).');
      const ta = el('textarea', { 'aria-label': 'Ton message', maxlength: '220' });
      const slot = el('div');
      const b = el('button', { class: 'btn' }, 'Envoyer la demande');
      b.addEventListener('click', () => {
        const t = ta.value, w = words(t).length;
        if (!t.trim()) return toast('Écris quelque chose !');
        let r;
        if (/\b(slt|cc|bjr|stp)\b/i.test(t)) r = ['Si tu as écrit « slt »,', 'je fais semblant de ne pas avoir lu.'];
        else if (w < 4) r = [`${w === 1 ? 'Un mot' : w + ' mots'} ?`, 'Roxane ne va même pas lever les yeux.'];
        else if (w >= 12) r = ['Roxane va hésiter.', "C'est déjà beaucoup."];
        else r = ["Pas mal. Il y a quelqu'un", 'derrière ces mots.'];
        setER(slot, r);
        if (!box.querySelector('.actions.n')) cont(box, next).classList.add('n');
      });
      box.append(ta, el('div', { class: 'actions' }, b), slot);
    },
    (box) => sealedIndice(box, 1, "Je ne poste jamais de selfie. Moi, j'écris en vers.", 1)
  ]);
}

/* =====================================================================
   JEU 2 – Trois jeux très faciles
   ===================================================================== */
function game2(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, 'Trois jeux très faciles (trop faciles ?)'));
      head(box, 'A. Le meilleur emoji pour dire « je t\'aime »', 'Touche ton emoji préféré.', "Scegli l'emoji migliore per dire «ti amo» e leggi la risposta di E.R.");
      const R = {
        '❤️': ['Le cœur rouge. Classique.', 'Comme une rose au supermarché.'],
        '💛': ["Un petit cœur jaune ? C'est tout ?"],
        '😍': ['Des yeux en forme de cœur.', 'Et la bouche, elle dit quoi ?'],
        '🔥': ['Le feu ! Bien.', "Mais le feu, il faut l'écrire, pas le dessiner."],
        '😘': ['Un bisou envoyé par la poste.', 'Il arrivera froid.'],
        '💌': ['Une lettre ! Ah… tu commences à me plaire.', 'Mais elle est vide.']
      };
      const slot = el('div');
      const chips = el('div', { class: 'chips', style: 'justify-content:space-between' });
      let first = true;
      Object.keys(R).forEach(e => chips.append(el('button', { class: 'chip', style: 'font-size:28px;min-width:52px', 'aria-label': 'emoji ' + e, onclick: (ev) => {
        [...chips.children].forEach(c => c.classList.remove('on'));
        ev.currentTarget.classList.add('on');
        setER(slot, R[e]);
        if (first) { first = false; cont(box, next); }
      } }, e)));
      box.append(chips, slot);
    },
    (box, next) => {
      head(box, 'Maintenant, sans emoji', 'Dis « je t\'aime » en 5 mots maximum, sans les mots aimer et cœur.', 'Di\' «ti amo» in massimo 5 parole, senza usare «aimer» e «cœur» e senza emoji.');
      const inp = el('input', { type: 'text', 'aria-label': 'Ta phrase', maxlength: '80' });
      const slot = el('div');
      let shown = false;
      const b = el('button', { class: 'btn' }, 'Montrer à E.R.');
      b.addEventListener('click', () => {
        const t = inp.value, d = deacc(t), w = words(t).length;
        if (!t.trim()) return toast('Écris quelque chose !');
        let r;
        if (hasEmoji(t)) r = ["J'ai dit : sans emoji.", 'Je t\'ai vu.'];
        else if (/\b(aim|coeur)/.test(d) || /\bt'?aime/.test(d)) r = ['Tu as triché :', "j'ai vu le mot interdit."];
        else if (w > 5) r = ['Cinq mots maximum.', 'Les plus belles phrases sont courtes.'];
        else r = ['Là.', 'Là, je t\'écoute.'];
        setER(slot, r);
        if (!shown) { shown = true; cont(box, next); }
      });
      box.append(inp, el('div', { class: 'actions' }, b), slot);
    },
    (box, next) => {
      head(box, 'B. La légende parfaite pour un selfie', "Christian a besoin d'une légende pour sa photo. Choisis.", 'Scegli la didascalia per il selfie di Christian, oppure scrivine una tu.');
      box.append(el('div', { class: 'post' }, el('div', { class: 'img', style: 'background:#F2C14E;max-width:240px;margin:0 auto', html: PERSON_BIG })));
      const slot = el('div');
      const custom = el('input', { type: 'text', placeholder: 'D. À toi…', 'aria-label': 'Ta légende', maxlength: '80' });
      let shown = false;
      function react(first) {
        setER(slot, first.concat(['Moi, moi, moi…', 'La lune bâille, et moi aussi.', "Un visage, c'est joli.", "Mais une phrase, c'est infini."]));
        if (!shown) { shown = true; cont(box, next); }
      }
      const opts = el('div', { class: 'opts' });
      [['A. Moi.', ['« Moi. » Encore ?']], ['B. Lundi 🔥', ['Lundi. Le feu. Et alors ?']], ["C. Le soleil m'a pris en photo.", ['Tiens… une image.', 'Je bâille un peu moins.']]].forEach(([t, r]) =>
        opts.append(el('button', { class: 'opt', onclick: (e) => { [...opts.children].forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); react(r); } }, t)));
      const go = el('button', { class: 'btn ghost' }, 'Valider ma légende');
      go.addEventListener('click', () => {
        const w = words(custom.value).length;
        if (!w) return toast('Écris ta légende !');
        react(w < 4 ? ['Court. Comme un selfie.'] : ['Tiens, une vraie phrase.']);
      });
      box.append(opts, custom, el('div', { class: 'actions' }, go), slot);
    },
    (box, next) => {
      head(box, 'C. Le grand test : quel amoureux, quelle amoureuse es-tu ?', 'Une réponse pour chaque question.', 'Il test da rivista: scegli una risposta per ogni domanda e scopri il risultato.');
      const Q = [["Tu vois quelqu'un qui te plaît. Tu…", ['vas lui parler tout de suite.', "écris quelque chose, mais tu ne l'envoies pas.", "attends qu'il ou elle trouve les bons mots."]],
        ["Pour toi, le plus important chez quelqu'un, c'est…", ['le style.', "l'humour.", 'la façon de parler.']],
        ["Un message parfait, c'est…", ['court. « On se voit ? »', 'long : tu le réécris dix fois.', "un message qu'on a envie de relire."]],
        ['Le soir, tu préfères…', ['sortir avec les amis.', 'regarder les toits et penser.', 'lire, écouter de la musique, rêver.']],
        ['Ta plus grande peur en amour ?', ['ne pas savoir quoi dire.', 'être regardé(e).', 'être déçu(e).']]];
      const SYM = ['💪', '✒️', '🌙'];
      const count = [0, 0, 0];
      let n = 0;
      const slot = el('div');
      Q.forEach(([t, o], qi) => choiceQ(box, `${qi + 1}. ${t}`, o.map((x, i) => `${SYM[i]}  ${x}`), null, (ok, i) => {
        count[i]++;
        if (++n === Q.length) {
          const m = count.indexOf(Math.max(...count));
          const RES = [['Plus de 💪 : tu fonces, comme Christian.', 'Tu as du courage. Les mots ? Ils viendront… peut-être.'],
            ['Plus de ✒️ : tu écris, comme Cyrano.', "Tu sais tout dire. Sauf l'essentiel."],
            ['Plus de 🌙 : tu écoutes, comme Roxane.', 'Tu veux des mots vrais. Attention : les mots aussi peuvent se déguiser.']];
          slot.append(el('div', { class: 'card' }, el('b', null, RES[m][0]), el('p', { style: 'margin:6px 0 0' }, RES[m][1])),
            er(['Un test avec des points pour savoir comment on aime ?', 'Le cœur ne sait pas compter. Heureusement.']));
          cont(box, next);
        }
      }));
      box.append(slot);
    },
    (box) => sealedIndice(box, 2, 'Je suis né à Marseille, en 1868. Oui : je suis très, très vieux.', 2)
  ]);
}

/* =====================================================================
   JEU 3 – Le nez
   ===================================================================== */
function seqChips(box, items, bank, onEnd, opts = {}) {
  // items : [[phrase avec ___, [réponses acceptées]]]
  let i = 0;
  const line = el('div', { class: 'q' });
  const fb = el('div', { class: 'small', style: 'min-height:22px;margin-top:6px' });
  const chips = el('div', { class: 'chips' });
  const used = new Set();
  function render() {
    line.innerHTML = '';
    if (i >= items.length) { line.remove(); fb.remove(); chips.remove(); onEnd(bank.filter(b => !used.has(b))); return; }
    const [t] = items[i];
    const parts = t.split('___');
    line.append(el('div', { class: 'muted small' }, `${i + 1} / ${items.length}`), el('div', { class: 'sentence' }, parts[0], el('span', { class: 'blank' }, ' '), parts[1] || ''));
  }
  bank.forEach(w => {
    const c = el('button', { class: 'chip' }, w);
    c.addEventListener('click', () => {
      if (i >= items.length || (opts.consume !== false && used.has(w))) return;
      const ok = items[i][1].includes(w);
      if (ok) {
        if (opts.consume !== false) { used.add(w); c.classList.add('used'); }
        fb.style.color = 'var(--ok)';
        fb.textContent = (opts.onGood && opts.onGood(i, w)) || '✓ ' + items[i][0].replace('___', w);
        if (opts.after) opts.after(i, w);
        i++;
        setTimeout(render, 700);
      } else {
        c.classList.add('bad');
        setTimeout(() => c.classList.remove('bad'), 600);
        fb.style.color = 'var(--red)';
        fb.textContent = 'Hmm… non. Essaie encore.';
      }
    });
    chips.append(c);
  });
  box.append(line, fb, chips);
  render();
}
function game3(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, 'Le nez le plus célèbre de Paris'));
      box.append(el('p', null, 'À Paris, tout le monde parle du nez de Cyrano. Mais attention, il y a des règles :'));
      box.append(el('ol', null,
        el('li', { html: 'Cyrano rit de son nez <b>le premier</b>. C\'est son droit.' }),
        el('li', { html: 'Une blague banale le met en colère. Une blague <b>poétique</b>, il l\'écoute.' }),
        el('li', { html: 'On rit du nez du poète. <b>Jamais</b> du visage ou du corps de quelqu\'un de vrai.' })));
      box.append(el('div', { class: 'nosebox', html: AVA.cyrano.replace('width="58" height="58"', 'width="160" height="160"').replace(/#1D2340/g, '#F6F1E7') }));
      box.append(er(["Les insultes sont paresseuses.", "L'imagination, jamais."]));
      cont(box, next, "C'est compris");
    },
    (box, next) => {
      head(box, 'A. Son nez est comme…', 'Touche le bon mot. Attention : il y a plus de mots que de phrases.', 'Completa ogni frase toccando la parola giusta.');
      const items = [['Quand il pleut, son nez le protège. C\'est un ___.', ['parapluie']],
        ['Il est orange et les lapins l\'adorent. C\'est une ___.', ['carotte']],
        ['Un petit animal fait son nid dessus. C\'est pour un ___.', ['oiseau']],
        ['Les enfants montent dessus et glissent. C\'est un ___.', ['toboggan']],
        ['Quand il éternue, toute la rue l\'entend. C\'est une ___.', ['trompette']],
        ['La nuit, les bateaux le voient de loin. C\'est un ___.', ['phare']],
        ['Il part pour la lune : trois, deux, un… C\'est une ___.', ['fusée']],
        ['Il écrit tout seul sur le papier. C\'est un ___.', ['crayon']]];
      const bank = ['éléphant', 'banane', 'parapluie', 'montagne', 'oiseau', 'fusée', 'carotte', 'toboggan', 'trompette', 'phare', 'crayon', 'pont'];
      seqChips(box, items, bank, (left) => {
        box.append(el('p', { html: `<b>Il reste quatre mots :</b> ${left.join(', ')}. Choisis-en un et invente ta phrase.` }));
        const inp = el('input', { type: 'text', value: '', placeholder: 'Son nez est comme…', 'aria-label': 'Ta phrase', maxlength: '140' });
        const slot = el('div');
        let shown = false;
        const b = el('button', { class: 'btn' }, 'Montrer à E.R.');
        b.addEventListener('click', () => {
          const w = words(inp.value).length;
          if (!w) return toast('Écris ta phrase !');
          setER(slot, w < 6 ? ['Ah ! non ! c\'est un peu court, jeune homme !'] : ['Bravo, poète.', 'Le nez te remercie.']);
          if (!shown) { shown = true; cont(box, next); }
        });
        box.append(inp, el('div', { class: 'actions' }, b), slot);
      });
    },
    (box, next) => {
      head(box, 'B. La chasse aux rimes', 'Un poète qui se moque d\'un nez parle en rimes. Trouve la rime.', 'Trova la parola che fa rima.');
      const items = [['oiseau → ___', ['chapeau', 'bateau']], ['carotte → ___', ['marmotte']], ['pluie → ___', ['parapluie']],
        ['grand → ___', ['vent', 'dent', 'éléphant']], ['moustache → ___', ['panache']], ['prune → ___', ['lune']]];
      const bank = ['chapeau', 'marmotte', 'parapluie', 'vent', 'dent', 'éléphant', 'panache', 'bateau', 'lune'];
      const slot = el('div');
      seqChips(box, items, bank, () => {
        box.append(el('div', { class: 'card' },
          el('div', { class: 'small', style: 'letter-spacing:2px;font-weight:700;color:var(--red)' }, 'UN MOT À GARDER'),
          el('div', { style: 'font-family:var(--serif);font-weight:900;font-size:40px;line-height:1.1' }, 'panache'),
          el('p', { style: 'margin:6px 0 0' }, "C'est la plume sur le chapeau d'un mousquetaire. Mais c'est aussi une façon d'être : avoir du courage, avec élégance, même quand on perd.")),
          er(['Garde ce mot dans ta poche.', 'Il pourrait servir.']));
        cont(box, next);
      }, { consume: false, after: (i) => { if (i === 2) setER(slot, ['« Pluie » et « parapluie » ?', "C'est un peu facile. Mais je te pardonne."]); } });
      box.append(slot);
    },
    (box, next) => {
      head(box, 'C. Le vrai Cyrano, en 1897 (défi)', 'Dans la pièce originale, un homme dit seulement à Cyrano : « Vous avez un nez… très grand. » Cyrano répond :', 'Sfida facoltativa: il testo originale di Rostand. Abbina ogni frase al suo «tono». Puoi anche saltarla.');
      box.append(el('p', { style: 'font-family:var(--serif);font-weight:900;font-size:24px;color:var(--red);text-align:center' }, '« Ah ! non ! c\'est un peu court, jeune homme ! »'));
      box.append(el('p', { html: "Et il lui montre toutes les blagues qu'il aurait pu faire, en changeant de <b>ton</b>. Quel est le ton de chaque phrase ?" }));
      const skip = el('div', { class: 'actions' }, el('button', { class: 'btn ghost', onclick: () => { skip.remove(); next(); } }, 'Passer le défi'));
      box.append(skip);
      const T = ['Agressif', 'Descriptif', 'Gracieux', 'Tendre', 'Naïf'];
      const Q = [["« C'est un roc !… c'est un pic !… c'est un cap ! Que dis-je, c'est un cap ?… C'est une péninsule ! »", 1],
        ['« Faites-lui faire un petit parasol de peur que sa couleur au soleil ne se fane ! »', 3],
        ["« Moi, monsieur, si j'avais un tel nez, il faudrait sur-le-champ que je me l'amputasse ! »", 0],
        ['« Aimez-vous à ce point les oiseaux que paternellement vous vous préoccupâtes de tendre ce perchoir à leurs petites pattes ? »', 2],
        ['« Ce monument, quand le visite-t-on ? »', 4]];
      let n = 0;
      Q.forEach(([t, c]) => choiceQ(box, t, T, c, () => {
        if (++n === Q.length) {
          skip.remove();
          box.append(el('p', { class: 'muted small' }, 'Petit dictionnaire : amputer = couper · un roc, un pic = une grosse pierre, une montagne · un cap, une péninsule = une terre qui avance dans la mer · un perchoir = un bâton pour les oiseaux · se faner = perdre sa couleur.'));
          box.append(er(['Bravo. Maintenant, tu as le droit de rire d\'un nez.', 'Seulement de celui-là.']));
          cont(box, next);
        }
      }, 'chips'));
    },
    (box) => sealedIndice(box, 3, 'Mon personnage le plus célèbre a un très grand nez. Tu viens de jouer avec.', 3)
  ]);
}

/* =====================================================================
   JEU 4 – L'atelier de la lettre
   ===================================================================== */
function markedText(t) {
  // texte de l'élève → nœuds sûrs, mots interdits barrés
  const frag = document.createDocumentFragment();
  t.split(/(\p{L}+)/u).forEach(part => {
    if (/^\p{L}+$/u.test(part) && FORBID.test(deacc(part))) frag.append(el('mark', { class: 'bad' }, part));
    else frag.append(document.createTextNode(part));
  });
  return frag;
}
function letterReaction(t) {
  const w = words(t).length;
  const lines = t.split(/[\n.!?]+/).map(s => s.trim()).filter(Boolean);
  const r = [];
  r.push(w < 10 ? 'Dix mots ? Même mon grille-pain fait mieux.' : w <= 30 ? "Pas mal. Il y a quelqu'un, derrière ces mots." : 'Ah ! Enfin une plume !');
  for (let i = 1; i < lines.length; i++) if (rhymes(lines[i - 1], lines[i])) { r.push('Une rime ! Tu me fais rougir.'); break; }
  if (forbidden(t)) r.push("J'ai vu une étoile. Je n'ai rien dit. Mais j'ai vu.");
  return r;
}
function game4(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, "L'atelier de la lettre"));
      box.append(el('p', { html: 'Roxane ne veut pas un message. Elle veut <b>une lettre. Une vraie. Avec de vrais mots.</b> Christian, lui, a déjà écrit son DM :' }));
      box.append(el('div', { class: 'phone', style: 'display:flex;flex-direction:column;gap:6px' },
        el('div', { class: 'muted small', style: 'text-align:center' }, 'Message à @roxane'),
        el('div', { class: 'dm' }, 'slt t bel 😍 on se voit ?'),
        el('div', { class: 'muted small', style: 'text-align:right' }, 'envoyé · non lu')));
      box.append(er(['Six mots.', "Dont un qui n'existe pas."]));
      cont(box, next);
    },
    (box, next) => {
      head(box, 'A. Message ou lettre ?', null, 'Completa la frase con il verbo giusto.');
      const R = { relit: ['Oui. On la relit.', 'Et on la garde.'], efface: ['Effacer ? Jamais une lettre !'], like: ['On ne « like » pas une lettre.', 'On la…'] };
      choiceQ(box, 'Un message, on le lit. Une lettre, on la…', ['relit', 'efface', 'like'], 0, (ok, i, q) => {
        q.append(er(R[['relit', 'efface', 'like'][i]]));
        cont(box, next);
      }, 'chips');
    },
    (box, next) => {
      head(box, 'B. Trois mots interdits', "Ce sont les mots les plus utilisés du monde dans les poèmes d'amour. Interdiction de les écrire !", 'Tre parole vietate: étoile (stella), soleil (sole), rose (rosa).');
      box.append(el('p', { style: 'text-align:center' }, el('span', { class: 'forbid' }, 'étoile'), el('span', { class: 'forbid' }, 'soleil'), el('span', { class: 'forbid' }, 'rose')));
      box.append(er(['Si je lis encore une étoile, je m\'éteins.']));
      cont(box, next);
    },
    (box, next) => {
      head(box, 'C. Transforme le DM en lettre', 'Aide Christian, étape par étape.', 'Quattro passi: un dettaglio vero, un paragone con «comme», quello che provi, una domanda finale.');
      const steps = [['Un détail vrai.', 'Pas « tu es belle » : quelque chose que toi seul(e) as remarqué.', 'Tu ris avant la fin de mes phrases.'],
        ['Une comparaison.', 'Avec « comme ». Et sans les mots interdits !', 'Ta voix est comme une fenêtre ouverte en hiver.'],
        ['Ce que tu ressens.', 'Une phrase courte. Les phrases courtes sont les plus fortes.', 'Quand tu pars, la rue est trop grande.'],
        ['Une question pour finir.', 'Mais pas « on se voit ? »', 'Tu veux bien me répondre avec ta plus belle écriture ?']];
      const inputs = steps.map(([a, b, c], i) => {
        const inp = el('input', { type: 'text', 'aria-label': a, maxlength: '160', placeholder: 'Exemple : ' + c });
        const warn = el('div', { class: 'small', style: 'color:var(--red);min-height:18px' });
        inp.addEventListener('input', () => { warn.textContent = forbidden(inp.value) ? 'Attention : mot interdit !' : ''; });
        box.append(el('label', { class: 'field' }, `${i + 1}. ${a} `, el('span', { style: 'font-weight:400', class: 'muted' }, b)), inp, warn);
        return inp;
      });
      box.append(el('p', { class: 'muted small' }, "Boîte à mots : quand je te vois… · j'ai remarqué que… · je n'ose pas te dire que… · la nuit, je pense à… · ta façon de… · ta voix · tes mains · ton rire · le silence · la pluie · une porte · un secret"));
      const out = el('div');
      const b = el('button', { class: 'btn' }, 'Assembler ma lettre');
      let shown = false;
      b.addEventListener('click', () => {
        const parts = inputs.map(x => x.value.trim()).filter(Boolean);
        if (parts.length < 2) return toast('Écris au moins deux étapes !');
        const t = parts.map(p => /[.!?…]$/.test(p) ? p : p + '.').join('\n');
        S.letter = t; save();
        out.innerHTML = '';
        out.append(el('div', { class: 'lettre' }, 'Roxane,\n', markedText(t)));
        head(out, 'D. Ce que dit E.R. de ta lettre', null, null);
        out.append(er(letterReaction(t)));
        if (!shown) { shown = true; cont(box, next); }
      });
      box.append(el('div', { class: 'actions' }, b), out);
    },
    (box, next) => {
      head(box, 'Défi : quatre lignes qui riment', 'Quatre lignes qui riment deux par deux (AABB). Tu peux l\'écrire pour quelqu\'un qui n\'existe pas.', 'Sfida facoltativa: quattro versi, il primo fa rima con il secondo, il terzo con il quarto.');
      const ls = ['A', 'A', 'B', 'B'].map((r, i) => {
        const inp = el('input', { type: 'text', 'aria-label': `Ligne ${i + 1}`, maxlength: '100', placeholder: `Ligne ${i + 1} (${r})` });
        box.append(inp, el('div', { style: 'height:8px' }));
        return inp;
      });
      const slot = el('div');
      const skip = el('button', { class: 'btn ghost' }, 'Passer');
      const b = el('button', { class: 'btn' }, 'Montrer à E.R.');
      const act = el('div', { class: 'actions' }, b, skip);
      skip.addEventListener('click', () => { act.remove(); next(); });
      b.addEventListener('click', () => {
        const v = ls.map(x => x.value);
        if (v.some(x => !x.trim())) return toast('Il faut quatre lignes !');
        const r1 = rhymes(v[0], v[1]), r2 = rhymes(v[2], v[3]);
        const r = r1 && r2 ? ['Deux rimes !', 'Tu me fais rougir.'] : (r1 || r2) ? ['Une rime sur deux.', "C'est un début. Un beau début."] : ['Les rimes se cachent.', 'Écoute la fin de tes mots.'];
        if (v.some(forbidden)) r.push("J'ai vu une étoile. Je n'ai rien dit. Mais j'ai vu.");
        setER(slot, r);
        skip.textContent = 'Continuer';
      });
      box.append(act, slot);
    },
    (box) => sealedIndice(box, 4, 'Ma pièce la plus célèbre a été jouée pour la première fois à Paris, en décembre 1897. Elle se joue encore partout dans le monde.', 4)
  ]);
}

/* =====================================================================
   JEU 5 – Le balcon
   ===================================================================== */
function game5(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, 'Une nuit, sous un balcon'));
      box.append(el('p', { html: "Voici un vrai morceau d'une pièce de théâtre. Elle a plus de 125 ans. Son auteur ? Une tache d'encre cache son nom : <b>E. R■■■■■■</b>." }));
      box.append(el('p', null, "C'est la nuit. Roxane est sur son balcon. En bas, Christian veut lui parler. Mais Christian ne trouve pas les mots… Alors, dans l'ombre, quelqu'un les lui souffle. Puis quelqu'un prend sa place."));
      const G = { 'hésitants': "hésitant = qui n'est pas sûr", 'à mi-voix': 'à mi-voix = pas fort', 'à tâtons': 'à tâtons = en cherchant avec les mains, dans le noir', 'vivement': 'vivement = très vite' };
      const gb = el('div', { class: 'glossbox hidden', role: 'status' });
      const g = w => el('button', { class: 'gloss', onclick: () => { gb.textContent = G[w]; gb.classList.remove('hidden'); } }, w);
      const who = (n, d) => [el('span', { class: 'who' }, n), d ? el('span', { class: 'did' }, ' ', d) : null, ' '];
      box.append(el('div', { class: 'night' },
        el('div', null, ...who('ROXANE.'), 'Vos mots sont ', g('hésitants'), '. Pourquoi ?'),
        el('div', null, el('span', { class: 'who' }, 'CYRANO, '), el('span', { class: 'did' }, 'parlant ', g('à mi-voix'), ', comme Christian. '), "C'est qu'il fait nuit,"),
        el('div', null, 'Dans cette ombre, ', g('à tâtons'), ', ils cherchent votre oreille.'),
        el('div', { style: 'opacity:.55' }, '[…]'),
        el('div', null, ...who('ROXANE.'), 'Je descends !'),
        el('div', null, el('span', { class: 'who' }, 'CYRANO, '), el('span', { class: 'did' }, g('vivement'), '. '), 'Non !'),
        el('div', { style: 'opacity:.55' }, '[…]'),
        el('div', null, ...who('CYRANO.'), "Laissez un peu que l'on profite…"),
        el('div', null, "De cette occasion qui s'offre… de pouvoir"),
        el('div', null, 'Se parler doucement, sans se voir.'),
        gb));
      box.append(el('p', { class: 'muted small' }, 'Touche les mots soulignés pour les comprendre.'));
      box.append(er(['Ces mots-là, je les connais par cœur.', 'Je me demande bien pourquoi.']));
      cont(box, next);
    },
    (box, next) => {
      head(box, 'A. Tu as compris ?', null, 'Domande sul testo. La 3 è libera.');
      let n = 0;
      const done = () => { if (++n === 2) third(); };
      choiceQ(box, '1. Qui parle vraiment à Roxane, à la fin ?', ['Christian', 'Cyrano', 'On ne sait pas encore'], 1, (ok, i, q) => {
        q.append(el('div', { class: 'small', style: 'margin-top:6px' }, ok ? 'Oui. Dans le noir, la voix a changé de bouche.' : 'Relis : « parlant à mi-voix, comme Christian ».'));
        done();
      }, 'row3');
      choiceQ(box, '2. Est-ce que Roxane sait qui parle ?', ['Oui', 'Non', 'On ne sait pas encore'], [1, 2], (ok, i, q) => {
        q.append(el('div', { class: 'small', style: 'margin-top:6px' }, i === 1 ? 'Non. Pas ce soir-là.' : i === 2 ? 'Dans ce texte, non. Plus tard… qui sait ?' : 'Tu crois ? Elle pense parler à Christian.'));
        done();
      }, 'row3');
      function third() {
        box.append(el('label', { class: 'field' }, '3. Roxane veut descendre. Cyrano dit « Non ! ». Pourquoi, à ton avis ?'));
        const ta = el('textarea', { 'aria-label': 'Ta réponse', maxlength: '300' });
        const slot = el('div');
        let shown = false;
        const b = el('button', { class: 'btn' }, 'Répondre');
        b.addEventListener('click', () => {
          const w = words(ta.value).length;
          if (!w) return toast('Écris ta réponse !');
          setER(slot, w < 4 ? ['Dis-m\'en un peu plus.'] : ['Je crois que tu as compris', "quelque chose d'important."]);
          if (!shown) { shown = true; cont(box, next); }
        });
        box.append(ta, el('div', { class: 'actions' }, b), slot);
      }
    },
    (box, next) => {
      head(box, "B. Dans le noir, c'est plus facile ?", 'Coche ce qui est vrai pour toi. Rien n\'est enregistré, personne ne corrige.', 'Spunta ciò che vale per te. Non viene salvato niente.');
      ["J'écris plus facilement que je ne parle.", 'Je dis des choses dans un message que je ne dirais pas en face.', 'La nuit, je pense à des choses que je ne dis pas le jour.', "Parfois, j'aide un ami ou une amie à écrire un message."].forEach(t =>
        box.append(el('label', { class: 'opt', style: 'cursor:pointer' }, el('input', { type: 'checkbox', style: 'width:20px;height:20px' }), t)));
      const slot = el('div');
      const b = el('button', { class: 'btn' }, "C'est noté");
      b.addEventListener('click', () => { b.parentNode.remove(); setER(slot, ['Merci. Je garde ça pour moi.', 'Promis.']); cont(box, next); });
      box.append(el('div', { class: 'actions' }, b), slot);
    },
    (box, next) => {
      head(box, "C. Et aujourd'hui, le balcon, ce serait…", "En 1897, il y avait un balcon. Et aujourd'hui ?", 'Oggi, che cosa sarebbe il balcone? Scegli o inventa.');
      const slot = el('div');
      let shown = false;
      const react = c => { setER(slot, [`« ${c} »… Pourquoi pas.`, 'La nuit, elle, reste la même.']); if (!shown) { shown = true; cont(box, next); } };
      const chips = el('div', { class: 'chips' });
      ['un appel vidéo, caméra éteinte', 'un message vocal à minuit', 'une fenêtre de chat', 'un balcon (oui, encore !)'].forEach(c =>
        chips.append(el('button', { class: 'chip', onclick: () => react(c) }, c)));
      const inp = el('input', { type: 'text', placeholder: 'À toi…', 'aria-label': 'Ton idée', maxlength: '80' });
      box.append(chips, inp, el('div', { class: 'actions' }, el('button', { class: 'btn ghost', onclick: () => { if (inp.value.trim()) react(inp.value.trim()); else toast('Écris ton idée !'); } }, 'Valider')), slot);
    },
    (box) => sealedIndice(box, 5, "Ce texte, je l'ai écrit. Mais je suis mort à Paris, en 1918… Et pourtant, je t'écris. Comment est-ce possible ?", 5)
  ]);
}

/* =====================================================================
   JEU 6 – Le code
   ===================================================================== */
function game6(root) {
  runSteps(root, [
    (box, next) => {
      box.append(el('h1', null, 'Le code de la plume'));
      box.append(el('p', null, "Tu as cinq indices. Relis-les. Puis déchiffre le dernier message d'E.R. Chaque nombre est une lettre : A = 1, B = 2, C = 3…"));
      const ul = el('ol', { class: 'small' });
      S.clues.forEach(c => ul.append(el('li', { style: 'font-family:var(--hand);font-size:20px' }, c || '…')));
      box.append(ul);
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      [L.slice(0, 13), L.slice(13)].forEach(part => {
        const k = el('div', { class: 'key', style: 'margin:6px 0' });
        [...part].forEach(c => k.append(el('div', null, el('b', null, c), L.indexOf(c) + 1)));
        box.append(k);
      });
      const MSG = ['JE', 'SUIS', 'ROSTAND', 'AI', 'ON', 'SE', 'VOIT', 'AU', 'THEATRE'];
      const code = el('div', { class: 'code' });
      const cells = [];
      MSG.forEach(w => {
        const wd = el('div', { class: 'word' });
        [...w].forEach(ch => {
          const inp = el('input', { type: 'text', maxlength: '1', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': `lettre numéro ${L.indexOf(ch) + 1}` });
          inp.dataset.a = ch;
          cells.push(inp);
          wd.append(el('div', { class: 'cell' }, el('span', { class: 'nb' }, L.indexOf(ch) + 1), inp));
        });
        code.append(wd);
      });
      const slot = el('div');
      let finished = false;
      cells.forEach((inp, i) => inp.addEventListener('input', () => {
        const v = deacc(inp.value).toUpperCase().slice(-1);
        inp.value = v;
        const ok = v === inp.dataset.a;
        inp.classList.toggle('good', ok);
        if (ok) { const nx = cells.slice(i + 1).find(c => !c.classList.contains('good')); if (nx) nx.focus(); }
        if (!finished && cells.every(c => c.classList.contains('good'))) {
          finished = true;
          setER(slot, ['Tu as trouvé.', 'Maintenant, regarde-moi bien.'], { ink: true });
          cont(box, next, 'Révéler E.R.', 'btn red');
        }
      }));
      box.append(code, slot);
    },
    (box, next) => {
      S.revealed = true; save();
      document.body.classList.add('digital');
      box.append(el('h2', null, 'La plume se présente'));
      const lines = ['Bonjour. Je suis Rostand AI.', "J'ai lu tous les vers d'Edmond Rostand, l'homme qui a écrit Cyrano de Bergerac. Je les connais par cœur.",
        'Je suis très gentille avec ceux qui me donnent un peu de leur cœur.', 'Avec les paresseux… je suis seulement polie.',
        "Au théâtre, quelqu'un va m'appeler. Écoute bien. Tu me reconnaîtras.", '— R.AI'];
      const sc = el('div', { class: 'screen' });
      lines.forEach((l, i) => sc.append(el('div', { class: 'l', style: `animation-delay:${i * 0.9}s` }, l)));
      box.append(sc);
      box.append(el('h2', null, 'Qui était le vrai E.R. ?'));
      box.append(el('p', { html: "<b>Edmond Rostand</b> est né à Marseille en 1868 et il est mort à Paris en 1918. Il écrivait du théâtre en vers. Le 28 décembre 1897, à Paris, le public voit <i>Cyrano de Bergerac</i> pour la première fois. On raconte que le public a applaudi pendant vingt minutes." }));
      box.append(el('h2', null, 'Et Cyrano ?'));
      box.append(el('p', { html: "<b>Il a vraiment existé.</b> Savinien de Cyrano de Bergerac (1619-1655) était un soldat et un écrivain. Il a écrit un livre sur un voyage… dans la Lune. Et oui, on dit qu'il avait un très grand nez." }));
      cont(box, next, 'Petit quiz');
    },
    (box, next) => {
      head(box, 'Petit quiz', null, 'Quattro domande su Rostand e su Cyrano.');
      const Q = [['Rostand a écrit Cyrano de Bergerac en…', ['1789', '1897', '1968', '2025'], 1],
        ['Le vrai Cyrano a écrit un voyage…', ['en Amérique', 'au fond de la mer', 'dans la Lune', 'en Italie'], 2],
        ['La pièce de Rostand est écrite…', ['en vers', 'en emojis', 'en anglais', 'sans paroles'], 0],
        ['Rostand AI est gentille avec…', ['ceux qui écrivent vite', "ceux qui mettent beaucoup d'emojis", 'ceux qui donnent un peu de leur cœur', 'tout le monde, toujours'], 2]];
      let n = 0;
      Q.forEach(([t, o, c], qi) => choiceQ(box, `${qi + 1}. ${t}`, o, c, () => {
        if (++n === Q.length) {
          box.append(er(['Pour la question 4, je ne te donnais pas la réponse.', 'Tu la connaissais.']));
          if (!S.done.includes(6)) S.done.push(6);
          save();
          box.append(el('div', { class: 'actions' }, el('button', { class: 'btn red', onclick: prediction }, 'Mon billet de prédiction'), el('button', { class: 'btn ghost', onclick: goHome }, 'Retour au cahier')));
        }
      }));
    }
  ]);
}

/* =====================================================================
   Billet de prédiction & bonus
   ===================================================================== */
function prediction() {
  enterSub();
  clear();
  app.append(bar('Dernière page'));
  const box = el('section');
  app.append(box);
  box.append(el('h1', null, 'Billet de prédiction'));
  box.append(el('p', null, 'Tu connais maintenant trois personnes : un garçon qui a un grand nez et beaucoup de mots, un garçon qui a un beau visage et peu de mots, une fille qui aime les mots qui restent. Le spectacle commence par une question. La voici, en avance :'));
  box.append(el('p', { style: 'font-family:var(--serif);font-weight:900;font-size:28px;line-height:1.1;text-align:center' }, 'Cyrano va-t-il faire la paix avec son nez ?'));
  const P = Object.assign({ r: '', why: '', rox: '', let: '', pan: '' }, S.pred || {});
  function group(key, opts) {
    const c = el('div', { class: 'chips' });
    opts.forEach(o => {
      const b = el('button', { class: 'chip' + (P[key] === o ? ' on' : '') }, o);
      b.addEventListener('click', () => { P[key] = o; [...c.children].forEach(x => x.classList.toggle('on', x === b)); });
      c.append(b);
    });
    return c;
  }
  box.append(group('r', ['Oui', 'Non', 'Un peu', 'Je ne sais pas']));
  const why = el('textarea', { 'aria-label': 'Parce que', placeholder: 'Parce que…', maxlength: '300' });
  why.value = P.why;
  box.append(why);
  box.append(el('h2', null, 'Mes autres paris'));
  box.append(el('p', null, 'Roxane va tomber amoureuse de…'), group('rox', ['Christian', 'Cyrano', 'des mots', '?']));
  box.append(el('p', null, 'Qui va écrire les lettres de Christian ?'), group('let', ['Christian', 'Cyrano', 'Rostand AI', '?']));
  box.append(el('p', { html: 'Le mot <i>panache</i> va servir.' }), group('pan', ['Oui', 'Non']));
  box.append(el('h2', null, 'Et toi ?'));
  box.append(el('p', null, "Tout le monde a quelque chose avec quoi il a du mal à faire la paix. Tu n'es pas obligé(e) de l'écrire. Tu peux juste y penser une seconde."));
  box.append(el('textarea', { 'aria-label': 'Et toi', placeholder: '(Ce champ n\'est jamais enregistré.)', maxlength: '300' }));
  const slot = el('div');
  const b = el('button', { class: 'btn red' }, 'Garder mon billet');
  b.addEventListener('click', () => {
    if (!P.r) return toast('Réponds d\'abord à la grande question !');
    P.why = why.value.trim();
    S.pred = P; save();
    setER(slot, ['Garde ce billet. Montre-le au théâtre.', 'À la fin, compare avec ce que tu as vu.', 'Moi, je ne dis rien. Une plume sait se taire.'], { sign: 'R.AI' });
    slot.append(el('div', { class: 'actions' }, el('button', { class: 'btn', onclick: goHome }, 'Retour au cahier')));
  });
  box.append(el('div', { class: 'actions' }, b), slot);
}

function bonus() {
  enterSub();
  clear();
  document.body.classList.add('digital');
  app.append(bar('Après le spectacle'));
  const box = el('section');
  app.append(box);
  box.append(el('h1', null, 'Entre deux lignes'));
  const sc = el('div', { class: 'screen' });
  ["Tu étais là. Tu as vu l'ombre sur le mur.", 'Tu as entendu une voix qui parlait pour un autre.', 'Je ne te dirai pas ce que tu dois en penser.', "Je te montre seulement ce que tu avais écrit, avant."]
    .forEach((l, i) => sc.append(el('div', { class: 'l', style: `animation-delay:${i * 1}s` }, l)));
  box.append(sc);
  if (S.pred) {
    box.append(el('div', { class: 'card' },
      el('div', { class: 'small', style: 'letter-spacing:2px;font-weight:700;color:var(--red)' }, 'TON BILLET'),
      el('p', { style: 'margin:6px 0' }, 'Cyrano va-t-il faire la paix avec son nez ? Tu avais répondu : ', el('b', null, `« ${S.pred.r} »`)),
      S.pred.why ? el('p', { style: 'margin:0', class: 'small' }, 'Parce que… ', S.pred.why) : null));
  } else {
    box.append(el('p', { class: 'muted' }, "Tu n'avais pas rempli ton billet. Ce n'est pas grave."));
  }
  box.append(el('p', { style: 'font-family:var(--serif);font-weight:700;font-size:22px' }, 'Et maintenant ?'));
  const slot = el('div');
  const c = el('div', { class: 'chips' });
  ['Oui', 'Non', 'Un peu', 'Je ne sais pas'].forEach(o => c.append(el('button', { class: 'chip', onclick: (e) => {
    [...c.children].forEach(x => x.classList.toggle('on', x === e.currentTarget));
    setER(slot, ['Garde ta réponse.', 'Elle est à toi.'], { sign: 'R.AI' });
    if (!box.querySelector('.last')) last();
  } }, o)));
  box.append(c, slot);
  function last() {
    const l = el('section', { class: 'last' });
    l.append(el('h2', null, 'Un dernier jeu. Le dernier, promis.'));
    l.append(el('p', null, "Écris une phrase pour quelqu'un. Une vraie. Avec de vrais mots. Tu n'es pas obligé(e) de l'envoyer."));
    const ta = el('textarea', { 'aria-label': 'Ta phrase', maxlength: '400' });
    const s2 = el('div');
    const b = el('button', { class: 'btn' }, 'Montrer à R.AI');
    b.addEventListener('click', () => {
      if (!words(ta.value).length) return toast('Écris ta phrase !');
      setER(s2, letterReaction(ta.value).concat(['Si un jour tu l\'envoies…', 'signe-la de ton nom.', 'On se retrouvera entre deux lignes.']), { sign: 'R.AI' });
    });
    l.append(ta, el('div', { class: 'actions' }, b), s2);
    box.append(l);
    setTimeout(() => l.scrollIntoView({ behavior: 'smooth' }), 60);
  }
}

/* =====================================================================
   Cahier (accueil) & intro
   ===================================================================== */
const GAMES = [
  [1, 'Trois profils sur Plumagram', game1],
  [2, 'Trois jeux très faciles (trop faciles ?)', game2],
  [3, 'Le nez le plus célèbre de Paris', game3],
  [4, "L'atelier de la lettre", game4],
  [5, 'Une nuit, sous un balcon', game5],
  [6, 'Le code de la plume', game6]];
const unlocked = id => id === 1 || S.done.includes(id - 1);

function enterSub() { if (!(history.state && history.state.sub)) history.pushState({ sub: 1 }, ''); }
function goHome() { if (history.state && history.state.sub) history.back(); else home(); }
window.addEventListener('popstate', () => home());

function openGame(id) {
  const g = GAMES.find(x => x[0] === id);
  enterSub();
  clear();
  document.body.classList.toggle('digital', id === 6 && S.revealed);
  app.append(bar('Jeu ' + id));
  const root = el('div');
  app.append(root);
  g[2](root);
}

/* ---------- installation ---------- */
let deferredPrompt = null;
const installWatchers = new Set();
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; installWatchers.forEach(f => f()); });
window.addEventListener('appinstalled', () => {
  deferredPrompt = null; S.installed = true; save();
  toast("C'est fait ! La plume est sur ton écran d'accueil.");
  installWatchers.forEach(f => f());
});
async function nativeInstall() {
  if (!deferredPrompt) return infoSheet();
  const p = deferredPrompt; deferredPrompt = null;
  p.prompt();
  try { await p.userChoice; } catch (e) { /* rien */ }
  installWatchers.forEach(f => f());
}
const SHARE_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#1D2340" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/></svg>';
const STEPS = {
  ios: { title: 'Sur iPhone ou iPad', steps: ['Ouvre cette page avec <b>Safari</b>.', `Touche le bouton <b>Partager</b> ${SHARE_ICON} (en bas de l'écran, en haut sur iPad).`, 'Fais défiler et choisis <b>« Sur l\'écran d\'accueil »</b>.', 'Touche <b>« Ajouter »</b>. La plume apparaît sur ton écran !'],
    it: "Su iPhone: apri la pagina con Safari, tocca il tasto Condividi (il quadrato con la freccia), scegli «Aggiungi alla schermata Home» e poi «Aggiungi»." },
  android: { title: 'Sur Android', steps: ['Ouvre cette page avec <b>Chrome</b>.', 'Touche le menu <b>⋮</b> en haut à droite.', 'Choisis <b>« Installer l\'application »</b> ou <b>« Ajouter à l\'écran d\'accueil »</b>.', 'Confirme. La plume apparaît sur ton écran !'],
    it: "Su Android: apri la pagina con Chrome, tocca il menu ⋮ in alto a destra, scegli «Installa app» o «Aggiungi a schermata Home» e conferma." }
};
function stepsBlock(k) {
  const d = STEPS[k];
  const help = el('div', { class: 'help' }, '🇮🇹 ', d.it);
  return el('div', { class: 'stepsbox' }, el('b', null, d.title),
    el('ol', { class: 'steps' }, ...d.steps.map(t => el('li', { html: t }))),
    el('button', { class: 'helpbtn', onclick: () => help.classList.toggle('open') }, 'Aide (in italiano)'), help);
}
function infoSheet() {
  if (document.querySelector('.sheet-back')) return;
  const prev = document.activeElement;
  const back = el('div', { class: 'sheet-back' });
  const close = () => { back.remove(); document.removeEventListener('keydown', esc); if (prev && prev.focus) prev.focus(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const x = el('button', { class: 'iconbtn', style: 'margin-left:auto', 'aria-label': 'Fermer', onclick: close }, '✕');
  const panel = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': "Installer l'app" });
  panel.append(el('div', { style: 'display:flex;align-items:center;gap:10px' }, el('h2', { style: 'margin:0' }, "Garde le cahier sur ton téléphone"), x));
  if (isStandalone() || S.installed) {
    panel.append(el('p', { style: 'margin-top:12px' }, "L'app est déjà installée. Tu la trouves sur ton écran d'accueil, avec la plume."));
  } else {
    panel.append(el('p', { style: 'margin-top:12px' }, "Comme une vraie app : une icône sur ton écran, et le cahier marche même sans internet."));
    if (deferredPrompt) panel.append(el('div', { class: 'actions' }, el('button', { class: 'btn red', onclick: () => { close(); nativeInstall(); } }, "Installer l'app")));
    const first = isIOS ? 'ios' : 'android', other = isIOS ? 'android' : 'ios';
    panel.append(stepsBlock(first));
    panel.append(el('details', { class: 'small' }, el('summary', null, 'Un autre téléphone ?'), stepsBlock(other)));
  }
  panel.append(el('h2', null, 'À propos'));
  panel.append(el('p', { class: 'small' }, "Un cahier de jeux pour le spectacle Cyrano, librement adapté de Cyrano de Bergerac d'Edmond Rostand."));
  panel.append(el('p', { class: 'small' }, "Rien de ce que tu écris ne quitte ce téléphone : pas de compte, pas de données envoyées."));
  back.append(panel);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(back);
  x.focus();
}
function installCard(dismissable) {
  const card = el('div', { class: 'card installcard' });
  function render() {
    card.innerHTML = '';
    if (isStandalone() || S.installed || (dismissable && S.hideInstall)) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    card.append(el('div', { style: 'display:flex;gap:12px;align-items:center' },
      el('img', { src: 'icons/icon-192.png', alt: '', width: '48', height: '48', style: 'border-radius:12px;flex-shrink:0' }),
      el('div', null, el('b', null, 'Garde le cahier sur ton téléphone'), el('div', { class: 'small muted' }, 'Une icône, et ça marche même sans internet.'))));
    const acts = el('div', { class: 'actions', style: 'margin:12px 0 0' });
    if (deferredPrompt) acts.append(el('button', { class: 'btn red', onclick: nativeInstall }, "Installer l'app"));
    else acts.append(el('button', { class: 'btn', onclick: infoSheet }, 'Comment faire ?'));
    if (dismissable) acts.append(el('button', { class: 'btn ghost', onclick: () => { S.hideInstall = true; save(); render(); } }, 'Plus tard'));
    card.append(acts);
  }
  installWatchers.add(render);
  render();
  return card;
}

function home() {
  clear();
  document.body.classList.toggle('digital', false);
  app.append(bar('Le cahier', false));
  app.append(el('h1', null, "L'Énigme de la Plume"));
  app.append(installCard(true));
  if (!S.done.length) app.append(er(['Joue. Écris. Je lis tout.', 'Et peut-être, à la fin, tu sauras qui je suis.']));
  const list = el('div', { class: 'games' });
  GAMES.forEach(([id, t]) => {
    const open = unlocked(id), done = S.done.includes(id);
    const b = el('button', { class: 'game' + (open ? '' : ' locked') + (done ? ' done' : ''), disabled: !open },
      el('span', { class: 'n' }, done ? '✓' : id),
      el('span', null, el('div', { class: 'tt' }, t), el('div', { class: 'st' }, done ? 'Terminé · tu peux rejouer' : open ? 'À toi de jouer' : 'Fermé : termine le jeu précédent')));
    if (open) b.addEventListener('click', () => openGame(id));
    list.append(b);
  });
  app.append(list);

  app.append(el('h2', null, 'Mon carnet d\'indices'));
  const ct = el('div', { class: 'cluetext' });
  const cl = el('div', { class: 'clues' });
  S.clues.forEach((c, i) => cl.append(el('button', { class: 'clue' + (c ? '' : ' empty'), disabled: !c, 'aria-label': `Indice ${i + 1}`, onclick: () => { ct.textContent = c; } }, i + 1)));
  app.append(cl, ct);
  app.append(el('label', { class: 'field', for: 'hyp' }, 'Mon hypothèse maintenant : E.R., c\'est…'));
  const hyp = el('input', { type: 'text', id: 'hyp', maxlength: '80' });
  hyp.value = S.hyp;
  hyp.addEventListener('input', () => { S.hyp = hyp.value; save(); });
  app.append(hyp);

  if (S.done.includes(6) || S.pred) {
    app.append(el('div', { class: 'card' },
      el('b', null, 'Billet de prédiction'),
      el('p', { class: 'small', style: 'margin:4px 0 10px' }, S.pred ? `Ta réponse : « ${S.pred.r} ». Montre-le au théâtre !` : 'À remplir avant le spectacle.'),
      el('button', { class: 'btn ghost', onclick: prediction }, S.pred ? 'Revoir mon billet' : 'Remplir mon billet')));
  }

  const bb = el('div', { class: 'card', style: 'border:2px dashed var(--ink);box-shadow:none' });
  bb.append(el('b', null, '🔒 Après le spectacle'));
  if (S.bonus) {
    bb.append(el('p', { class: 'small', style: 'margin:4px 0 10px' }, 'Ouvert.'), el('button', { class: 'btn', onclick: bonus }, 'Entrer'));
  } else {
    bb.append(el('p', { class: 'small', style: 'margin:4px 0 10px' }, "Cette page est fermée. À la fin du spectacle, écoute bien : un mot l'ouvrira."));
    const pw = el('input', { type: 'text', placeholder: 'Le mot…', 'aria-label': 'Le mot secret', maxlength: '30', autocomplete: 'off' });
    const msg = el('div', { class: 'small', style: 'min-height:20px;margin-top:6px;font-family:var(--hand);font-size:20px;color:var(--red)' });
    const WRONG = ["Non. Mais j'aime que tu essaies.", "Ce n'est pas ce mot-là.", 'Presque… ou pas du tout. Je ne dirai rien.', 'Écoute bien, à la fin.'];
    let tries = 0;
    const go = el('button', { class: 'btn', style: 'margin-top:10px' }, 'Ouvrir');
    go.addEventListener('click', () => {
      const v = deacc(pw.value).replace(/[^a-z]/g, '');
      if (!v) return;
      if (PASSWORDS.includes(v)) { S.bonus = true; save(); bonus(); }
      else msg.textContent = WRONG[tries++ % WRONG.length];
    });
    bb.append(pw, go, msg);
  }
  app.append(bb);

  const foot = el('div', { class: 'small muted', style: 'margin-top:28px;display:flex;flex-direction:column;gap:10px' });
  foot.append(el('button', { class: 'btn ghost', onclick: infoSheet }, "Installer l'app sur mon téléphone"));
  foot.append(el('div', null, 'Rien de ce que tu écris ne quitte ce téléphone.'));
  let armed = false;
  const reset = el('button', { class: 'helpbtn' }, 'Tout recommencer');
  reset.addEventListener('click', () => {
    if (!armed) { armed = true; reset.textContent = 'Sûr ? Touche encore pour tout effacer.'; return; }
    S = defaults(); S.seen = true; save(); home();
  });
  foot.append(reset);
  app.append(foot);
}

function intro() {
  clear();
  const box = el('div', { class: 'intro' });
  box.append(el('div', { html: BLOT }));
  box.append(el('div', { class: 'title-big' }, "L'Énigme", el('br'), 'de la Plume'));
  box.append(el('p', { style: 'text-align:center' }, "Ce cahier devait être vide. Mais quelqu'un a déjà écrit dedans."));
  box.append(er(['Bonjour, toi.', 'Tu ne me connais pas. Pas encore.', "J'aime les mots qui ont du cœur.", 'Les mots paresseux… un peu moins.'], { paper: true }));
  box.append(el('div', { class: 'actions', style: 'justify-content:center' }, el('button', { class: 'btn red', onclick: () => { S.seen = true; save(); home(); } }, 'Ouvrir le cahier')));
  box.append(installCard(false));
  app.append(box);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
S.seen ? home() : intro();
