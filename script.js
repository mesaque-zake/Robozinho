const bookmarkletFunction = function() {
    // ESTE É O CÓDIGO QUE RODARÁ DENTRO DO SITE DO SESC
    // =====================================================================
    // CONFIGURAÇÕES EDITÁVEIS (valor base, doadores e instituições)
    // =====================================================================

    // Valor base do reembolso de jantar (o Intermunicipal usa 50% disso).
    // Quando o valor mudar no ano novo, altere só este número.
    const VALOR_BASE = 41.00;

    // Estado que aparece depois do município no texto (ex.: Guarulhos/SP)
    const UF = 'SP';

    // Doadores: a ORDEM desta lista é a ordem em que os nomes aparecem no texto.
    // Para incluir um novo, copie uma linha e altere os dados.
    const DOADORES = [
        { nome: 'Sonda',      municipio: 'Guarulhos' },
        { nome: 'Atacadão',   municipio: 'Guarulhos' },
        { nome: 'Santa Lídia', municipio: 'Santo André' },
        { nome: 'Bimbo',      municipio: 'Osasco' },
        { nome: 'Poupaki',    municipio: 'Guarulhos' }
    ];

    // Instituições: o código fica só para organização e não aparece no texto.
    const INSTITUICOES = [
        { codigo: '20',  nome: 'Recanto dos Avós',          municipio: 'Guarulhos' },
        { codigo: '59',  nome: 'Lar Madre Regina',          municipio: 'Guarulhos' },
        { codigo: '123', nome: 'Circo Escola Cidade Serídio', municipio: 'Guarulhos' },
        { codigo: '181', nome: 'Coop-Reciclável',           municipio: 'Guarulhos' }
    ];

    // =====================================================================
    // LÓGICA DE TEXTO E VALORES (não mexe na tela)
    // =====================================================================

    // Formata centavos no padrão brasileiro: 12300 -> "123,00"
    function formatarCentavos(centavos) {
        return (centavos / 100).toFixed(2).replace('.', ',');
    }

    // Valor de cada dia em centavos. Jantar = valor cheio; Intermunicipal = 50%.
    function valorDiaCentavos(tipo, valorBase) {
        let base = Math.round(valorBase * 100);
        return tipo === 'jantar' ? base : Math.round(base / 2);
    }

    // Junta nomes: A | A e B | A, B e C
    function juntarNomes(lista) {
        if (lista.length <= 1) return lista.join('');
        return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
    }

    // Junta dias SEM espaço depois da vírgula: 05,12 e 20
    function juntarDias(dias) {
        if (dias.length <= 1) return dias.join('');
        return dias.slice(0, -1).join(',') + ' e ' + dias[dias.length - 1];
    }

    // Gera o texto do relatório (jantar ou intermunicipal)
    function gerarTexto(tipo, mes, dias, doadores, instituicoes) {
        if (!mes || dias.length === 0) return '';
        let [ano, mm] = mes.split('-');
        let quando = (dias.length === 1 ? 'no dia ' : 'nos dias ') + juntarDias(dias) + '/' + mm + '/' + ano;

        if (tipo === 'jantar') {
            return 'Reembolso de refeição (jantar), quando em serviço extraordinário ' + quando +
                   ', ocorreu por conta do roteiro extenso e do trânsito, causando a realização de horas extras.';
        }

        if (doadores.length === 0 && instituicoes.length === 0) return '';

        let partes = [];
        if (doadores.length > 0) {
            partes.push(doadores.length === 1
                ? 'Retirada de doação na empresa ' + doadores[0].nome
                : 'Retirada de doações nas empresas ' + juntarNomes(doadores.map(d => d.nome)));
        }
        if (instituicoes.length > 0) {
            let entrega = instituicoes.length === 1
                ? 'entrega de doação na instituição ' + instituicoes[0].nome
                : 'entrega de doações nas instituições ' + juntarNomes(instituicoes.map(i => i.nome));
            partes.push(doadores.length > 0 ? 'E ' + entrega : entrega.charAt(0).toUpperCase() + entrega.slice(1));
        }

        // Municípios sem repetir, aparecem uma única vez
        let lugares = doadores.concat(instituicoes);
        let municipios = [];
        lugares.forEach(l => {
            let m = l.municipio + '/' + UF;
            if (!municipios.includes(m)) municipios.push(m);
        });
        let onde = (municipios.length === 1 ? 'no município de ' : 'nos municípios de ') + juntarNomes(municipios);
        let localizada = lugares.length === 1 ? 'localizada' : 'localizadas';

        return 'Reembolso de refeição adicional 50% - ' + partes.join('. ') + ', ' + localizada + ' ' + onde + ', ' + quando +
               '. Conforme Resolução N°336/2023 de 27/06/2023, artigo 5°.';
    }

    // 1. FUNÇÕES AUXILIARES PARA LIDAR COM SISTEMAS EM FRAMES
    function getDocForUI() {
        let targetDoc = document;
        // Se a página principal não for um frameset, usa ela mesma
        if (document.body && document.body.tagName.toLowerCase() !== 'frameset') {
            return document;
        }
        // Procura o frame com a maior altura (a área branca do sistema)
        let maxHeight = 0;
        for (let i = 0; i < window.frames.length; i++) {
            try {
                let f = window.frames[i];
                if (f.innerHeight > maxHeight && f.document.body && f.document.body.tagName.toLowerCase() !== 'frameset') {
                    maxHeight = f.innerHeight;
                    targetDoc = f.document;
                }
            } catch(e) {}
        }
        return targetDoc;
    }

    function getDocForStatus() {
        // Tenta injetar na barra azul superior. No SAPC geralmente é o menor frame.
        let minHeight = 9999;
        let targetDoc = null;
        try {
            for (let i = 0; i < window.frames.length; i++) {
                let f = window.frames[i];
                if (f.innerHeight < minHeight && f.document.body && f.document.body.tagName.toLowerCase() !== 'frameset') {
                    minHeight = f.innerHeight;
                    targetDoc = f.document;
                }
            }
        } catch(e) {}
        
        return targetDoc || getDocForUI();
    }
    
    // Função para verificar se um elemento está visível na tela
    function isElementVisible(el) {
        if (!el) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
    
    // getEl busca apenas dentro do frame ativo atual e ignora elementos ocultos
    function getEl(seletor, textoExato = null) {
        let uiDoc = getDocForUI();
        if (!uiDoc) return null;
        
        function scanAtivo(win, docsArray) {
            try {
                if (win.document) docsArray.push(win.document);
            } catch(e){}
            try {
                for (let i = 0; i < win.frames.length; i++) {
                    scanAtivo(win.frames[i], docsArray);
                }
            } catch(e){}
            return docsArray;
        }
        
        let activeWin = uiDoc.defaultView || window;
        let docs = scanAtivo(activeWin, []);
        
        for(let doc of docs) {
            if(!doc) continue;
            try {
                let elementos = doc.querySelectorAll(seletor);
                for(let el of elementos) {
                    // Validação física de visibilidade para evitar interagir com frames/campos invisíveis
                    if (!isElementVisible(el)) {
                        continue;
                    }
                    
                    if(textoExato) {
                        let txt = (el.innerText || "").toUpperCase();
                        let val = (el.value || "").toUpperCase();
                        let alvo = textoExato.toUpperCase();
                        if(txt.includes(alvo) || val.includes(alvo)) {
                            return el;
                        }
                    } else {
                        return el;
                    }
                }
            } catch(e) {}
        }
        return null;
    }

    let uiDoc = getDocForUI();
    
    // Injeta o Tailwind se não existir
    if(!uiDoc.getElementById('robo-tw')) {
        let script = uiDoc.createElement('script');
        script.id = 'robo-tw';
        script.src = 'https://cdn.tailwindcss.com';
        uiDoc.head.appendChild(script);
    }

    // Injeta a Fonte
    if(!uiDoc.getElementById('robo-font')) {
        let font = uiDoc.createElement('link');
        font.id = 'robo-font';
        font.rel = 'stylesheet';
        font.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
        uiDoc.head.appendChild(font);
    }

    // Se já existir um modal aberto, não abre outro
    if(uiDoc.getElementById('robo-modal')) return;

    // =====================================================================
    // VISUAL: CSS, ROBOZINHO E PAINEL
    // =====================================================================

    // CSS do painel e do robozinho (tudo começa com #robo-modal ou #robo-pet para não afetar o SAPC)
    const CSS_ROBO = `
    @keyframes robo-entra { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:none; } }
    @keyframes robo-surge { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
    @keyframes robo-pulo { 0% { transform:scale(1); } 50% { transform:scale(1.22); } 100% { transform:scale(1); } }
    @keyframes robo-tremer { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-5px); } 40%,80% { transform:translateX(5px); } }
    @keyframes robo-led { 50% { opacity:.35; } }
    @keyframes robo-fl { to { transform:translateY(-7px); } }
    @keyframes robo-hop { to { transform:translateY(-14px); } }
    @keyframes robo-jp { 0% { transform:translateY(0); } 35% { transform:translateY(-26px); } 70% { transform:translateY(0); } 85% { transform:translateY(-6px); } 100% { transform:translateY(0); } }
    @keyframes robo-pl { 50% { transform:scale(1.35); opacity:.6; } }
    @keyframes robo-sc { from { transform:translateX(-22px); } to { transform:translateX(22px); } }
    @keyframes robo-pp { to { transform:scale(1.18); } }
    @keyframes robo-sh { to { transform:scale(.85); } }
    @keyframes robo-blink { 0%,93%,100% { transform:scaleY(1); } 96% { transform:scaleY(.1); } }
    @keyframes robo-bang { 0% { transform:translate(0,0) scale(.2) rotate(0); opacity:0; } 12% { opacity:1; } 100% { transform:translate(var(--dx),var(--dy)) scale(1.15) rotate(var(--r)); opacity:0; } }

    #robo-modal, #robo-pet { --a:#ea580c; --ad:#c2410c; --al:#fdba74; --at:rgba(234,88,12,0.14); }
    #robo-modal[data-tema="azul"], #robo-pet[data-tema="azul"] { --a:#1d4ed8; --ad:#1e40af; --al:#93c5fd; --at:rgba(29,78,216,0.14); }

    #robo-modal { position:fixed; top:20px; right:20px; width:380px; max-height:calc(100vh - 40px); display:flex; flex-direction:column; background:#f8fafc; border-radius:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); z-index:9999999; font-family:"Plus Jakarta Sans", sans-serif; font-size:14px; line-height:1.4; color:#1e293b; overflow:hidden; border:1px solid #e2e8f0; animation:robo-entra .35s ease-out; }
    #robo-modal * { box-sizing:border-box; font-family:inherit; }
    #robo-modal .rb-topo { position:relative; background-color:var(--a); background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M0 30h18l6-6h14l6 6h16M30 0v12l6 6M30 60V44l-6-6' fill='none' stroke='white' stroke-opacity='.16' stroke-width='1'/%3E%3Ccircle cx='24' cy='24' r='2' fill='white' fill-opacity='.2'/%3E%3Ccircle cx='36' cy='36' r='2' fill='white' fill-opacity='.2'/%3E%3C/svg%3E"); padding:14px 16px; color:#fff; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; transition:background-color .4s; }
    #robo-modal .rb-topo::after { content:""; position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--al); box-shadow:0 0 10px 1px var(--al); transition:background-color .4s, box-shadow .4s; }
    #robo-modal .rb-titulo { display:flex; flex-direction:column; gap:3px; }
    #robo-modal .rb-topo h2 { margin:0; font-weight:700; font-size:16px; color:#fff; display:flex; align-items:center; gap:8px; }
    #robo-modal .rb-status { display:flex; align-items:center; gap:6px; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:11px; color:rgba(255,255,255,0.9); }
    #robo-modal .rb-led { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 6px #4ade80; animation:robo-led 2s ease-in-out infinite; }
    #robo-modal .rb-fechar { background:none; border:none; color:#fff; cursor:pointer; font-size:22px; line-height:1; padding:0 4px; }
    #robo-modal .rb-corpo { padding:20px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
    #robo-modal .rb-rotulo { font-weight:600; margin:0 0 8px; display:block; color:#1e293b; }
    #robo-modal .rb-sec { display:flex; flex-direction:column; gap:10px; animation:robo-surge .3s ease-out; }
    #robo-modal #bloco-inter { gap:0; }

    #robo-modal .rb-seg { position:relative; display:flex; background:#e2e8f0; border-radius:10px; padding:3px; }
    #robo-modal .rb-seg input { position:absolute; opacity:0; pointer-events:none; }
    #robo-modal .rb-seg label { flex:1; position:relative; z-index:1; text-align:center; padding:8px 0; margin:0; cursor:pointer; font-weight:600; color:#64748b; transition:color .25s; }
    #robo-modal .rb-marca { position:absolute; top:3px; bottom:3px; left:3px; width:calc(50% - 3px); background:var(--a); border-radius:8px; box-shadow:0 2px 8px var(--at); transition:transform .3s cubic-bezier(.4,0,.2,1), background-color .4s; }
    #robo-modal .rb-seg input:nth-of-type(2):checked ~ .rb-marca { transform:translateX(100%); }
    #robo-modal .rb-seg input:nth-of-type(1):checked ~ label:nth-of-type(1),
    #robo-modal .rb-seg input:nth-of-type(2):checked ~ label:nth-of-type(2) { color:#fff; }

    #robo-modal .rb-campo { width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; outline:none; background:#fff; color:#1e293b; font-size:14px; transition:border-color .2s, box-shadow .2s; }
    #robo-modal .rb-campo:focus { border-color:var(--a); box-shadow:0 0 0 3px var(--at); }
    #robo-modal .rb-campo[readonly] { background:#f1f5f9; color:#475569; }
    #robo-modal textarea.rb-campo { resize:none; }
    #robo-modal .rb-linha { display:flex; gap:6px; align-items:flex-start; }
    #robo-modal .rb-btns { display:flex; flex-direction:column; gap:4px; }
    #robo-modal .rb-ico { width:34px; height:34px; display:flex; align-items:center; justify-content:center; background:#fff; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; color:#475569; padding:0; transition:all .2s; }
    #robo-modal .rb-ico:hover { border-color:var(--a); color:var(--a); }
    #robo-modal .rb-ico.ativo { background:var(--a); border-color:var(--a); color:#fff; }
    #robo-modal .rb-ico svg { width:16px; height:16px; }
    #robo-modal .rb-vb { display:flex; align-items:center; gap:8px; font-weight:600; }
    #robo-modal .rb-vb .rb-campo { width:90px; font-family:ui-monospace, Menlo, Consolas, monospace; }

    #robo-modal .rb-cal { position:relative; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; }
    #robo-modal .rb-cal::before, #robo-modal .rb-cal::after { content:""; position:absolute; width:12px; height:12px; border:2px solid var(--a); pointer-events:none; transition:border-color .4s; }
    #robo-modal .rb-cal::before { top:-1px; left:-1px; border-right:0; border-bottom:0; border-top-left-radius:6px; }
    #robo-modal .rb-cal::after { bottom:-1px; right:-1px; border-left:0; border-top:0; border-bottom-right-radius:6px; }
    #robo-modal .rb-cal-grade { display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; }
    #robo-modal .rb-cal-sem { font-size:11px; font-weight:700; color:#94a3b8; text-align:center; padding-bottom:2px; }
    #robo-modal .rb-dia { border:none; background:#f1f5f9; color:#1e293b; border-radius:8px; padding:7px 0; font-size:12px; font-weight:600; cursor:pointer; transition:background-color .2s, color .2s; }
    #robo-modal .rb-dia:hover { background:var(--at); }
    #robo-modal .rb-dia.fds { background:#f8fafc; color:#94a3b8; }
    #robo-modal .rb-dia.fds:hover { background:var(--at); }
    #robo-modal .rb-dia.on, #robo-modal .rb-dia.on:hover { background:var(--a); color:#fff; animation:robo-pulo .3s ease-out; }
    #robo-modal .rb-vazio { color:#64748b; font-size:12px; }
    #robo-modal .rb-resumo { margin-top:8px; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12px; font-weight:700; color:var(--a); text-align:center; transition:color .4s; }

    #robo-modal .rb-abas { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    #robo-modal .rb-aba { display:flex; justify-content:space-between; align-items:center; gap:6px; padding:9px 12px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; font-weight:600; color:#1e293b; cursor:pointer; text-align:left; transition:border-color .2s, background-color .2s; }
    #robo-modal .rb-aba:hover { border-color:var(--a); }
    #robo-modal .rb-aba.ativa { border-color:var(--a); background:var(--at); }
    #robo-modal .rb-seta { font-size:10px; color:var(--a); transition:transform .3s; }
    #robo-modal .rb-aba.ativa .rb-seta { transform:rotate(180deg); }
    #robo-modal .rb-sanf-corpo { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s ease; }
    #robo-modal .rb-sanf-corpo.aberta { grid-template-rows:1fr; }
    #robo-modal .rb-sanf-int { overflow:hidden; min-height:0; }
    #robo-modal .rb-lista { margin-top:8px; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; display:flex; flex-direction:column; gap:7px; max-height:150px; overflow-y:auto; }
    #robo-modal .rb-item { display:flex; align-items:center; gap:8px; cursor:pointer; margin:0; }
    #robo-modal .rb-item small { color:#64748b; font-size:11px; }
    #robo-modal input[type="checkbox"] { accent-color:var(--a); }
    #robo-modal .rb-oculto { display:none; }

    #robo-modal .rb-erro { background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; border-radius:8px; padding:8px 12px; font-size:13px; font-weight:600; }
    #robo-modal .rb-erro.tremer { animation:robo-tremer .4s ease-in-out; }
    #robo-modal .rb-iniciar { width:100%; background:var(--a); color:#fff; font-weight:700; font-size:14px; padding:12px; border-radius:8px; border:none; cursor:pointer; transition:background-color .3s, transform .2s; }
    #robo-modal .rb-iniciar:hover { background:var(--ad); transform:translateY(-1px); }

    #robo-pet { position:fixed; inset:auto; top:20px; right:408px; width:230px; height:auto; margin:0; padding:0; border:0; background:transparent; overflow:visible; color:inherit; z-index:9999998; display:flex; flex-direction:column; align-items:center; pointer-events:none; font-family:"Plus Jakarta Sans", sans-serif; transition:right .7s cubic-bezier(.4,0,.2,1); animation:robo-entra .35s ease-out; }
    #robo-pet.canto { right:20px; animation:none; }
    #robo-pet * { box-sizing:border-box; font-family:inherit; }
    #robo-pet .rb-fala { pointer-events:auto; position:relative; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:8px 12px; font-size:13px; line-height:1.35; color:#1e293b; text-align:center; max-width:220px; box-shadow:0 8px 20px -6px rgba(0,0,0,0.18); transition:border-color .4s; }
    #robo-pet .rb-fala::after { content:""; position:absolute; left:50%; bottom:-6px; width:10px; height:10px; background:#fff; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; transform:translateX(-50%) rotate(45deg); }
    #robo-pet .rb-fala-x { display:none; position:absolute; top:4px; right:6px; background:none; border:none; color:#64748b; font-size:18px; line-height:1; cursor:pointer; padding:0 2px; }
    #robo-pet .rb-fala.toast { padding-right:26px; border-color:var(--a); font-weight:600; }
    #robo-pet .rb-fala.toast .rb-fala-x { display:block; }
    #robo-pet svg { pointer-events:auto; cursor:pointer; overflow:visible; margin-top:8px; }
    #robo-pet .rb-parar { pointer-events:auto; display:none; margin-top:2px; background:var(--a); color:#fff; border:none; border-radius:20px; padding:5px 16px; font-size:12px; font-weight:700; cursor:pointer; transition:background-color .3s; }
    #robo-pet .rb-parar:hover { background:var(--ad); }
    #robo-pet.trab .rb-parar { display:block; }

    #robo-pet .pa { fill:var(--a); transition:fill .4s; }
    #robo-pet .pal { fill:var(--al); transition:fill .4s; }
    #robo-pet .pas { stroke:var(--al); fill:none; stroke-width:5; stroke-linecap:round; }
    #robo-pet .pbot { animation:robo-fl 3s ease-in-out infinite alternate; }
    #robo-pet.m-rico .pbot { animation:robo-hop .6s ease-in-out infinite alternate; }
    #robo-pet .pbot.jump { animation:robo-jp .5s ease-out; }
    #robo-pet .psh { transform-box:fill-box; transform-origin:center; animation:robo-sh 3s ease-in-out infinite alternate; }
    #robo-pet .pant, #robo-pet .pchest { transform-box:fill-box; transform-origin:center; animation:robo-pl 1.6s ease-in-out infinite; }
    #robo-pet.m-trab .pant, #robo-pet.m-trab .pchest { animation-duration:.5s; }
    #robo-pet .pe, #robo-pet .pm { display:none; }
    #robo-pet.m-normal .e-n, #robo-pet.m-feliz .e-f, #robo-pet.m-pensando .e-p, #robo-pet.m-trab .e-t, #robo-pet.m-rico .e-r { display:block; }
    #robo-pet.m-normal .mo-n, #robo-pet.m-trab .mo-n, #robo-pet.m-feliz .mo-f, #robo-pet.m-pensando .mo-p, #robo-pet.m-rico .mo-r { display:block; }
    #robo-pet .e-n { transform-box:fill-box; transform-origin:center; animation:robo-blink 4s infinite; }
    #robo-pet .pscan { animation:robo-sc 1s ease-in-out infinite alternate; }
    #robo-pet .e-r text { animation:robo-pp .5s ease-in-out infinite alternate; transform-box:fill-box; transform-origin:center; }
    #robo-pet .pcoin { opacity:0; transform-box:fill-box; transform-origin:center; font-weight:500; }
    #robo-pet.m-rico .pcoin { animation:robo-bang 2.4s ease-out infinite; }
    #robo-pet.m-rico .rb-fala { border-color:var(--a); font-weight:600; }

    #robo-modal .rb-pix { font-family:'Press Start 2P', monospace; font-weight:400; }
    #robo-modal .rb-topo h2.rb-pix { font-size:15px; letter-spacing:0; text-shadow:2px 2px 0 rgba(0,0,0,0.18); }
    #robo-modal .rb-powered { text-align:center; font-size:11px; color:#94a3b8; margin-top:-2px; }
    #robo-modal .rb-powered .rb-pix { font-size:9px; color:#64748b; }
    `;

    function garantirCss(doc) {
        if (doc.getElementById('robo-css')) return;
        let css = doc.createElement('style');
        css.id = 'robo-css';
        css.textContent = CSS_ROBO;
        (doc.head || doc.documentElement).appendChild(css);
        if (!doc.getElementById('robo-font')) {
            let font = doc.createElement('link');
            font.id = 'robo-font';
            font.rel = 'stylesheet';
            font.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
            (doc.head || doc.documentElement).appendChild(font);
        }
        if (!doc.getElementById('robo-font-px')) {
            let fontPx = doc.createElement('link');
            fontPx.id = 'robo-font-px';
            fontPx.rel = 'stylesheet';
            fontPx.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
            (doc.head || doc.documentElement).appendChild(fontPx);
        }
    }

    // ---------------------------------------------------------------
    // ROBOZINHO (aparece ao lado do painel, depois no canto, trabalhando)
    // ---------------------------------------------------------------
    function htmlPet() {
        return `
        <div class="rb-fala" id="robo-fala"><span id="robo-fala-txt">Bora lá! Comece escolhendo o mês.</span><button type="button" id="robo-fala-x" class="rb-fala-x" title="Fechar">&times;</button></div>
        <svg id="robo-pet-svg" width="230" viewBox="0 0 360 290" role="img">
            <g style="font-family:'Plus Jakarta Sans',sans-serif">
                <text class="pcoin" x="180" y="150" font-size="30" fill="#22c55e" text-anchor="middle" style="--dx:-140px;--dy:-100px;--r:-25deg;animation-delay:0s">$</text>
                <text class="pcoin" x="180" y="150" font-size="24" fill="#facc15" text-anchor="middle" style="--dx:130px;--dy:-110px;--r:30deg;animation-delay:.15s">$</text>
                <text class="pcoin" x="180" y="150" font-size="34" fill="#16a34a" text-anchor="middle" style="--dx:-60px;--dy:-135px;--r:15deg;animation-delay:.3s">$</text>
                <text class="pcoin" x="180" y="150" font-size="26" fill="#eab308" text-anchor="middle" style="--dx:70px;--dy:-130px;--r:-20deg;animation-delay:.45s">$</text>
                <text class="pcoin" x="180" y="150" font-size="28" fill="#22c55e" text-anchor="middle" style="--dx:-155px;--dy:-10px;--r:40deg;animation-delay:.6s">$</text>
                <text class="pcoin" x="180" y="150" font-size="30" fill="#facc15" text-anchor="middle" style="--dx:150px;--dy:-20px;--r:-35deg;animation-delay:.75s">$</text>
                <text class="pcoin" x="180" y="150" font-size="22" fill="#16a34a" text-anchor="middle" style="--dx:-110px;--dy:60px;--r:-15deg;animation-delay:.9s">$</text>
                <text class="pcoin" x="180" y="150" font-size="24" fill="#22c55e" text-anchor="middle" style="--dx:115px;--dy:55px;--r:20deg;animation-delay:1.05s">$</text>
                <text class="pcoin" x="180" y="150" font-size="32" fill="#eab308" text-anchor="middle" style="--dx:0px;--dy:-150px;--r:10deg;animation-delay:1.2s">$</text>
                <text class="pcoin" x="180" y="150" font-size="22" fill="#facc15" text-anchor="middle" style="--dx:-30px;--dy:-95px;--r:-40deg;animation-delay:1.35s">$</text>
            </g>
            <ellipse class="psh" cx="180" cy="274" rx="46" ry="7" fill="#94a3b8" opacity=".3"/>
            <g transform="translate(60,10)"><g id="robo-bot" class="pbot">
                <line x1="120" y1="62" x2="120" y2="38" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
                <circle class="pa pant" cx="120" cy="32" r="8"/>
                <rect class="pa" x="38" y="98" width="16" height="40" rx="8"/>
                <rect class="pa" x="186" y="98" width="16" height="40" rx="8"/>
                <rect x="50" y="60" width="140" height="104" rx="38" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
                <rect x="64" y="74" width="112" height="60" rx="24" fill="#0f172a"/>
                <g id="robo-eyes">
                    <g class="pe e-n"><rect class="pal" x="88" y="90" width="16" height="26" rx="8"/><rect class="pal" x="136" y="90" width="16" height="26" rx="8"/></g>
                    <g class="pe e-f"><path class="pas" d="M86 108 Q96 90 106 108"/><path class="pas" d="M134 108 Q144 90 154 108"/></g>
                    <g class="pe e-p"><rect class="pal" x="88" y="92" width="16" height="16" rx="8"/><rect class="pal" x="136" y="86" width="16" height="22" rx="8"/></g>
                    <g class="pe e-t"><rect class="pal" x="86" y="98" width="68" height="8" rx="4" opacity=".25"/><rect class="pal pscan" x="108" y="94" width="24" height="16" rx="8"/></g>
                    <g class="pe e-r" style="font-weight:500"><text x="96" y="114" font-size="34" fill="#facc15" text-anchor="middle">$</text><text x="144" y="114" font-size="34" fill="#facc15" text-anchor="middle">$</text></g>
                </g>
                <path class="pm mo-n" d="M108 150 Q120 156 132 150" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round"/>
                <path class="pm mo-f" d="M102 148 Q120 164 138 148" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round"/>
                <path class="pm mo-p" d="M110 152 L130 152" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round"/>
                <path class="pm mo-r" d="M100 146 Q120 168 140 146" stroke="#94a3b8" stroke-width="4" fill="none" stroke-linecap="round"/>
                <rect x="76" y="170" width="88" height="68" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
                <circle cx="120" cy="204" r="16" fill="#0f172a"/><circle class="pa pchest" cx="120" cy="204" r="8"/>
                <rect x="58" y="180" width="14" height="40" rx="7" fill="#cbd5e1"/><rect x="168" y="180" width="14" height="40" rx="7" fill="#cbd5e1"/>
                <rect x="92" y="238" width="18" height="12" rx="5" fill="#94a3b8"/><rect x="130" y="238" width="18" height="12" rx="5" fill="#94a3b8"/>
            </g></g>
        </svg>
        <button type="button" id="robo-parar" class="rb-parar">Parar</button>`;
    }

    // Cria o robozinho no frame (se ainda não existir) e devolve o elemento
    function garantirPet(doc, opc) {
        if (!doc || !doc.body) return null;
        garantirCss(doc);
        let pet = doc.getElementById('robo-pet');
        if (!pet) {
            let largura = (doc.defaultView || window).innerWidth;
            if (opc.modo === 'painel' && largura < 660) return null; // janela estreita: ele só aparece depois do Iniciar
            pet = doc.createElement('div');
            pet.id = 'robo-pet';
            pet.className = 'm-normal' + (opc.modo === 'canto' ? ' canto' : '');
            pet.innerHTML = htmlPet();
            doc.body.appendChild(pet);
            // Põe o robozinho na "camada superior" do navegador, acima de tudo (inclusive de um documento aberto na tela)
            try {
                pet.setAttribute('popover', 'manual');
                if (pet.showPopover) pet.showPopover();
            } catch(e) {
                pet.removeAttribute('popover'); // se não der, ele continua visível do jeito de antes
            }
            ligarPet(doc);
        }
        pet.setAttribute('data-tema', opc.tema || 'laranja');
        return pet;
    }

    function ligarPet(doc) {
        doc.getElementById('robo-pet-svg').onclick = () => {
            let b = doc.getElementById('robo-bot');
            b.classList.remove('jump');
            void b.getBoundingClientRect();
            b.classList.add('jump');
            setTimeout(() => b.classList.remove('jump'), 600);
            let rodando = localStorage.getItem('robo_running') === 'true';
            petHumor(doc, rodando ? 'trabalhando' : 'feliz', rodando ? 'Já já eu termino!' : 'Já estou preparado!');
        };
        doc.getElementById('robo-parar').onclick = () => pararRobo();
        doc.getElementById('robo-fala-x').onclick = () => {
            localStorage.removeItem('robo_fim');
            removerPet(doc);
        };
        // Os olhos seguem o mouse (só nos humores normal e feliz)
        if (!doc.__roboMouse) {
            doc.__roboMouse = true;
            doc.addEventListener('mousemove', (e) => {
                let p = doc.getElementById('robo-pet');
                if (!p || !(p.classList.contains('m-normal') || p.classList.contains('m-feliz'))) return;
                let r = doc.getElementById('robo-pet-svg').getBoundingClientRect();
                let dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 300));
                let dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.4)) / 300));
                doc.getElementById('robo-eyes').style.transform = 'translate(' + Math.round(dx * 7) + 'px,' + Math.round(dy * 5) + 'px)';
            });
        }
    }

    // Muda o humor e a fala do robozinho (humor: normal, feliz, pensando, trabalhando, rico)
    function petHumor(doc, humor, fala, toast) {
        let pet = doc && doc.getElementById('robo-pet');
        if (!pet) return;
        let cls = 'm-' + (humor === 'trabalhando' ? 'trab' : humor);
        if (!pet.classList.contains(cls)) {
            pet.classList.remove('m-normal', 'm-feliz', 'm-pensando', 'm-trab', 'm-rico');
            pet.classList.add(cls);
            if (humor !== 'normal' && humor !== 'feliz') doc.getElementById('robo-eyes').style.transform = '';
        }
        let txt = doc.getElementById('robo-fala-txt');
        if (fala !== undefined && txt.textContent !== fala) txt.textContent = fala;
        doc.getElementById('robo-fala').classList.toggle('toast', !!toast);
    }

    function removerPet(doc) {
        let p = doc && doc.getElementById('robo-pet');
        if (p) p.remove();
    }

    // ---------------------------------------------------------------
    // PAINEL
    // ---------------------------------------------------------------
    garantirCss(uiDoc);

    let modal = uiDoc.createElement('div');
    modal.id = 'robo-modal';
    modal.setAttribute('data-tema', 'laranja');

    const ICO_LAPIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"></path><path d="M13.5 6.5l4 4"></path></svg>';
    const ICO_REFAZER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"></path><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"></path></svg>';

    modal.innerHTML = `
        <div class="rb-topo">
            <div class="rb-titulo">
                <h2 class="rb-pix">Robozinho</h2>
                <div class="rb-status"><span class="rb-led"></span>Online · v2.0</div>
            </div>
            <button type="button" id="robo-close" class="rb-fechar" title="Fechar">&times;</button>
        </div>
        <div class="rb-corpo">

            <div>
                <span class="rb-rotulo">Olá! Qual reembolso faremos?</span>
                <div class="rb-seg">
                    <input type="radio" name="robo-tipo" id="robo-tipo-i" value="intermunicipal" checked>
                    <input type="radio" name="robo-tipo" id="robo-tipo-j" value="jantar">
                    <span class="rb-marca"></span>
                    <label for="robo-tipo-i">Intermunicipal</label>
                    <label for="robo-tipo-j">Jantar</label>
                </div>
            </div>

            <div>
                <span class="rb-rotulo">Valor disponibilizado no:</span>
                <div class="rb-seg">
                    <input type="radio" name="robo-pagamento" id="robo-pag-c" value="C" checked>
                    <input type="radio" name="robo-pagamento" id="robo-pag-b" value="B">
                    <span class="rb-marca"></span>
                    <label for="robo-pag-c">Caixa</label>
                    <label for="robo-pag-b">Banco</label>
                </div>
            </div>

            <div>
                <label class="rb-rotulo" for="robo-mes">Mês e Ano de Referência</label>
                <input type="month" id="robo-mes" class="rb-campo">
            </div>

            <div>
                <span class="rb-rotulo">Dias do serviço</span>
                <div class="rb-cal">
                    <div id="robo-calendario"><span class="rb-vazio">Selecione um mês primeiro.</span></div>
                    <div id="robo-resumo" class="rb-resumo">0 dias · R$ 0,00</div>
                </div>
            </div>

            <div class="rb-vb">
                <span>Valor base: R$</span>
                <input type="text" id="robo-vb" class="rb-campo" readonly>
                <button type="button" id="robo-vb-edit" class="rb-ico" title="Editar valor base">${ICO_LAPIS}</button>
            </div>

            <div id="bloco-inter" class="rb-sec">
                <div class="rb-abas">
                    <button type="button" class="rb-aba" id="aba-doadores"><span id="titulo-doadores">Doadores</span><span class="rb-seta">▼</span></button>
                    <button type="button" class="rb-aba" id="aba-instituicoes"><span id="titulo-instituicoes">Instituições</span><span class="rb-seta">▼</span></button>
                </div>
                <div class="rb-sanf-corpo" id="sanf-corpo"><div class="rb-sanf-int">
                    <div class="rb-lista" id="lista-doadores"></div>
                    <div class="rb-lista rb-oculto" id="lista-instituicoes"></div>
                </div></div>
            </div>

            <div>
                <label class="rb-rotulo" for="robo-texto">Texto do Relatório / Histórico</label>
                <div class="rb-linha">
                    <textarea id="robo-texto" class="rb-campo" rows="6" readonly placeholder="O texto aparece aqui depois que você escolher o mês e os dias."></textarea>
                    <div class="rb-btns">
                        <button type="button" id="robo-texto-edit" class="rb-ico" title="Editar o texto">${ICO_LAPIS}</button>
                        <button type="button" id="robo-texto-refaz" class="rb-ico" title="Refazer o texto automático">${ICO_REFAZER}</button>
                    </div>
                </div>
            </div>

            <div id="bloco-valor" class="rb-sec">
                <label class="rb-rotulo" for="robo-valor" style="margin:0;">Valor Total (R$)</label>
                <div class="rb-linha">
                    <input type="text" id="robo-valor" class="rb-campo" readonly placeholder="Calculado automaticamente">
                    <button type="button" id="robo-valor-edit" class="rb-ico" title="Editar o valor">${ICO_LAPIS}</button>
                    <button type="button" id="robo-valor-refaz" class="rb-ico" title="Refazer o valor automático">${ICO_REFAZER}</button>
                </div>
            </div>

            <div id="robo-erro" class="rb-erro rb-oculto" role="alert"></div>
            <button type="button" id="robo-start" class="rb-iniciar">Iniciar</button>
            <div class="rb-powered">Powered with <span style="color: #e80523;">&#10084;</span> by <span class="rb-pix">Mesaque</span></div>
        </div>
    `;

    uiDoc.body.appendChild(modal);
    garantirPet(uiDoc, { modo: 'painel', tema: 'laranja' });

    // ---------------------------------------------------------------
    // ESTADO E FUNÇÕES DO PAINEL
    // ---------------------------------------------------------------
    const $ = (id) => uiDoc.getElementById(id);
    let valorBase = VALOR_BASE;
    let textoLiberado = false;
    let valorLiberado = false;
    let timerHumor = null;

    function tipoAtual() {
        return uiDoc.querySelector('input[name="robo-tipo"]:checked').value;
    }
    function diasMarcados() {
        return Array.from(uiDoc.querySelectorAll('#robo-modal .rb-dia.on')).map(b => b.getAttribute('data-dia'));
    }
    function doadoresMarcados() {
        return Array.from(uiDoc.querySelectorAll('#robo-modal .robo-doa-chk:checked')).map(c => DOADORES[parseInt(c.value, 10)]);
    }
    function instituicoesMarcadas() {
        return Array.from(uiDoc.querySelectorAll('#robo-modal .robo-ins-chk:checked')).map(c => INSTITUICOES[parseInt(c.value, 10)]);
    }

    // Fala padrão do robozinho, conforme o que já foi preenchido
    function falaPadrao() {
        if (!$('robo-mes').value) return 'Bora lá! Comece escolhendo o mês.';
        if (diasMarcados().length === 0) return 'Agora marque os dias do serviço.';
        if (tipoAtual() === 'intermunicipal' && doadoresMarcados().length + instituicoesMarcadas().length === 0) return 'Falta escolher doadores ou instituições.';
        return 'Tudo certo? É só clicar em Iniciar!';
    }

    // Robozinho reage a uma ação e volta ao normal depois
    function reagir(humor, fala, ms) {
        petHumor(uiDoc, humor, fala);
        clearTimeout(timerHumor);
        timerHumor = setTimeout(() => petHumor(uiDoc, 'normal', falaPadrao()), ms || 3000);
    }

    function aplicarTema(tema) {
        modal.setAttribute('data-tema', tema);
        let pet = uiDoc.getElementById('robo-pet');
        if (pet) pet.setAttribute('data-tema', tema);
    }

    function mostrarErro(msg) {
        let e = $('robo-erro');
        e.textContent = msg;
        e.classList.remove('rb-oculto', 'tremer');
        void e.getBoundingClientRect();
        e.classList.add('tremer');
        clearTimeout(timerHumor);
        petHumor(uiDoc, 'pensando', msg);
    }

    // Recalcula contador, títulos das abas, texto e valor
    function atualizar() {
        let tipo = tipoAtual();
        let dias = diasMarcados();
        let doa = doadoresMarcados();
        let ins = instituicoesMarcadas();
        let totalCent = dias.length * valorDiaCentavos(tipo, valorBase);

        $('robo-erro').classList.add('rb-oculto');
        $('robo-resumo').textContent = dias.length + (dias.length === 1 ? ' dia' : ' dias') + ' · R$ ' + formatarCentavos(totalCent);
        $('titulo-doadores').textContent = 'Doadores' + (doa.length ? ' (' + doa.length + ')' : '');
        $('titulo-instituicoes').textContent = 'Instituições' + (ins.length ? ' (' + ins.length + ')' : '');

        if (!textoLiberado) {
            $('robo-texto').value = gerarTexto(tipo, $('robo-mes').value, dias, doa, ins);
        }
        if (!valorLiberado) {
            $('robo-valor').value = (tipo === 'intermunicipal' && dias.length) ? formatarCentavos(totalCent) : '';
        }
    }

    // Monta a grade do calendário do mês escolhido
    function montarCalendario() {
        let mes = $('robo-mes').value;
        let cal = $('robo-calendario');
        if (!mes) {
            cal.innerHTML = '<span class="rb-vazio">Selecione um mês primeiro.</span>';
            atualizar();
            return;
        }
        let [ano, mm] = mes.split('-').map(Number);
        let total = new Date(ano, mm, 0).getDate();
        let offset = new Date(ano, mm - 1, 1).getDay(); // 0 = domingo
        let html = '<div class="rb-cal-grade">';
        ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(s => { html += '<div class="rb-cal-sem">' + s + '</div>'; });
        for (let i = 0; i < offset; i++) html += '<div></div>';
        for (let d = 1; d <= total; d++) {
            let dd = String(d).padStart(2, '0');
            let diaSemana = (offset + d - 1) % 7;
            let fds = (diaSemana === 0 || diaSemana === 6) ? ' fds' : '';
            html += '<button type="button" class="rb-dia' + fds + '" data-dia="' + dd + '">' + dd + '</button>';
        }
        html += '</div>';
        cal.innerHTML = html;
        atualizar();
    }

    // Monta as listas de checkboxes (na ordem do código)
    function montarLista(idLista, itens, classe) {
        $(idLista).innerHTML = itens.map((it, i) =>
            '<label class="rb-item"><input type="checkbox" class="' + classe + '" value="' + i + '"> ' + it.nome + ' <small>· ' + it.municipio + '</small></label>'
        ).join('');
        $(idLista).addEventListener('change', () => {
            atualizar();
            reagir('feliz', 'Anotado!', 2000);
        });
    }
    montarLista('lista-doadores', DOADORES, 'robo-doa-chk');
    montarLista('lista-instituicoes', INSTITUICOES, 'robo-ins-chk');

    // Abas lado a lado: abrir uma fecha a outra; clicar na aberta recolhe
    function abrirLista(qual) {
        let corpo = $('sanf-corpo');
        let atual = corpo.getAttribute('data-aberta') || '';
        let novo = (atual === qual) ? '' : qual;
        corpo.setAttribute('data-aberta', novo);
        corpo.classList.toggle('aberta', novo !== '');
        $('aba-doadores').classList.toggle('ativa', novo === 'doadores');
        $('aba-instituicoes').classList.toggle('ativa', novo === 'instituicoes');
        if (novo !== '') {
            $('lista-doadores').classList.toggle('rb-oculto', novo !== 'doadores');
            $('lista-instituicoes').classList.toggle('rb-oculto', novo !== 'instituicoes');
        }
    }
    $('aba-doadores').onclick = () => abrirLista('doadores');
    $('aba-instituicoes').onclick = () => abrirLista('instituicoes');

    // Fechar painel (e o robozinho junto)
    $('robo-close').onclick = () => {
        clearTimeout(timerHumor);
        modal.remove();
        removerPet(uiDoc);
    };

    // Trocar o tipo: muda a cor, mostra/esconde o que é só do Intermunicipal
    uiDoc.querySelectorAll('input[name="robo-tipo"]').forEach(r => r.addEventListener('change', () => {
        let inter = tipoAtual() === 'intermunicipal';
        $('bloco-inter').classList.toggle('rb-oculto', !inter);
        $('bloco-valor').classList.toggle('rb-oculto', !inter);
        aplicarTema(inter ? 'laranja' : 'azul');
        atualizar();
        reagir('normal', inter ? 'Modo intermunicipal. De volta ao laranja!' : 'Modo jantar ligado. Vamos de azul!', 3500);
    }));

    // Trocar o mês: refaz o calendário (os dias marcados são limpos)
    $('robo-mes').addEventListener('change', () => {
        montarCalendario();
        reagir('pensando', 'Hmm, deixa eu ver o mês...', 1200);
    });

    // Clique nos dias (um único ouvinte para o calendário todo)
    $('robo-calendario').addEventListener('click', (e) => {
        let b = e.target.closest ? e.target.closest('.rb-dia') : null;
        if (!b) return;
        b.classList.toggle('on');
        atualizar();
        reagir('feliz', 'Boa! ' + $('robo-resumo').textContent, 2500);
    });

    // Lápis e refazer: TEXTO
    $('robo-texto-edit').onclick = () => {
        textoLiberado = true;
        $('robo-texto').readOnly = false;
        $('robo-texto-edit').classList.add('ativo');
        $('robo-texto').focus();
    };
    $('robo-texto-refaz').onclick = () => {
        textoLiberado = false;
        $('robo-texto').readOnly = true;
        $('robo-texto-edit').classList.remove('ativo');
        atualizar();
    };

    // Lápis e refazer: VALOR TOTAL
    $('robo-valor-edit').onclick = () => {
        valorLiberado = true;
        $('robo-valor').readOnly = false;
        $('robo-valor-edit').classList.add('ativo');
        $('robo-valor').focus();
    };
    $('robo-valor-refaz').onclick = () => {
        valorLiberado = false;
        $('robo-valor').readOnly = true;
        $('robo-valor-edit').classList.remove('ativo');
        atualizar();
    };

    // Lápis: VALOR BASE (vale só enquanto o painel estiver aberto)
    function lerValor(txt) {
        let n = parseFloat(String(txt).replace(/[^\d,.]/g, '').replace(',', '.'));
        return (isNaN(n) || n <= 0) ? null : n;
    }
    function travarValorBase() {
        $('robo-vb').value = formatarCentavos(Math.round(valorBase * 100));
        $('robo-vb').readOnly = true;
        $('robo-vb-edit').classList.remove('ativo');
    }
    $('robo-vb').value = formatarCentavos(Math.round(valorBase * 100));
    $('robo-vb-edit').onclick = () => {
        $('robo-vb').readOnly = false;
        $('robo-vb-edit').classList.add('ativo');
        $('robo-vb').focus();
        $('robo-vb').select();
    };
    $('robo-vb').addEventListener('input', () => {
        let v = lerValor($('robo-vb').value);
        if (v !== null) { valorBase = v; atualizar(); }
    });
    $('robo-vb').addEventListener('blur', travarValorBase);
    $('robo-vb').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('robo-vb').blur(); });

    atualizar();

    // ---------------------------------------------------------------
    // BOTÃO INICIAR: validação e gravação das preferências
    // ---------------------------------------------------------------
    $('robo-start').onclick = () => {
        let tipo = tipoAtual();
        let pagamento = uiDoc.querySelector('input[name="robo-pagamento"]:checked').value;
        let mes = $('robo-mes').value;
        let texto = $('robo-texto').value.trim();
        let valor = $('robo-valor').value;
        let dias = diasMarcados();

        if(!mes) { mostrarErro('Selecione o Mês e Ano de referência.'); return; }
        if(dias.length === 0) { mostrarErro('Selecione pelo menos um dia no calendário.'); return; }
        if(tipo === 'intermunicipal' && doadoresMarcados().length + instituicoesMarcadas().length === 0) {
            mostrarErro('Selecione pelo menos um doador ou uma instituição.');
            return;
        }
        if(!texto) { mostrarErro('O texto do relatório está vazio.'); return; }
        if(tipo === 'intermunicipal' && !valor.trim()) { mostrarErro('O valor total está vazio.'); return; }

        let [year, month] = mes.split('-');
        let firstDay = `01/${month}/${year}`;
        let lastDayNum = new Date(year, month, 0).getDate();
        let lastDay = `${lastDayNum}/${month}/${year}`;

        let stringJantar = "";
        if(tipo === 'jantar') {
            // Formato de ano com 2 dígitos
            let anoReduzido = year.substring(2);
            stringJantar = `${month}/${anoReduzido}(${dias.join(',')})`;
        }

        // Formatação de valor
        let valorFormatado = (tipo === 'intermunicipal' ? valor : "").replace('R$', '').trim();
        if(valorFormatado) {
            if(!valorFormatado.includes(',')) {
                if(valorFormatado.includes('.')) {
                    valorFormatado = valorFormatado.replace('.', ',');
                } else {
                    valorFormatado = valorFormatado + ',00';
                }
            }
        }

        // Salva na memória do navegador as preferências
        localStorage.setItem('robo_config', JSON.stringify({
            tipo, pagamento, texto, valorFormatado, firstDay, lastDay, stringJantar
        }));
        localStorage.setItem('robo_running', 'true');
        localStorage.setItem('robo_passo_atual', 'inicio_datas'); // Define o estado inicial rígido
        localStorage.removeItem('robo_espera_concluir');
        localStorage.removeItem('robo_fim');
        localStorage.removeItem('robo_festa');

        clearTimeout(timerHumor);
        modal.remove();
        mostrarStatusFlutuante(); // o robozinho vai para o canto e começa a trabalhar

        // Inicia o motor
        setInterval(processarPasso, 1500);
    };
    
    // Falas do robozinho conforme a etapa do robô
    const FALAS_PASSO = {
        inicio_datas: 'Preenchendo as datas...',
        inicio_historico: 'Escrevendo o histórico...',
        menu_opcoes: 'Abrindo as despesas...',
        preenchendo: 'Preenchendo a despesa...',
        calculando: 'Calculando...',
        gravando: 'Gravando...',
        concluido: 'Quase lá...',
        rateio: 'Conferindo o rateio...'
    };

    // Robozinho trabalhando no canto (recolocado a cada ciclo, pois o SAPC recarrega as telas)
    function mostrarStatusFlutuante() {
        if (localStorage.getItem('robo_festa')) return; // durante a festa final, quem manda no robozinho é a festa
        let doc = getDocForUI();
        let conf = JSON.parse(localStorage.getItem('robo_config') || '{}');
        let passo = localStorage.getItem('robo_passo_atual') || '';
        let pet = garantirPet(doc, { modo: 'canto', tema: conf.tipo === 'jantar' ? 'azul' : 'laranja' });
        if (!pet) return;
        pet.classList.add('canto', 'trab');
        petHumor(doc, 'trabalhando', FALAS_PASSO[passo] || 'Trabalhando...');
    }

    // Festa de fim: $ nos olhos, cifrões explodindo e o toast
    function mostrarFesta() {
        let raw = localStorage.getItem('robo_fim');
        if (!raw) return;
        let fim = {};
        try { fim = JSON.parse(raw); } catch(e) {}
        let doc = getDocForUI();
        if (new Date().getTime() - (fim.t || 0) > 9000) {
            localStorage.removeItem('robo_fim');
            removerPet(doc);
            return;
        }
        let pet = garantirPet(doc, { modo: 'canto', tema: fim.tipo === 'jantar' ? 'azul' : 'laranja' });
        if (!pet) return;
        pet.classList.remove('trab');
        petHumor(doc, 'rico', 'Pronto! Reembolso gerado. Confira e finalize no SAPC.', true);
    }

    // Botão Parar do robozinho
    function pararRobo() {
        localStorage.removeItem('robo_running');
        localStorage.removeItem('robo_passo_atual');
        localStorage.removeItem('robo_espera_concluir');
        localStorage.removeItem('robo_festa');
        let doc = getDocForUI();
        let pet = doc.getElementById('robo-pet');
        if (pet) pet.classList.remove('trab');
        petHumor(doc, 'normal', 'Robô desligado. É só me chamar de novo!', true);
        setTimeout(() => removerPet(getDocForUI()), 4000);
    }

    // Festa final: $ nos olhos, cifrões e a mensagem, enquanto o documento ainda não abriu
    function festaFinal() {
        let doc = getDocForUI();
        let conf = JSON.parse(localStorage.getItem('robo_config') || '{}');
        let pet = garantirPet(doc, { modo: 'canto', tema: conf.tipo === 'jantar' ? 'azul' : 'laranja' });
        if (!pet) return;
        pet.classList.remove('trab');
        petHumor(doc, 'rico', 'Pronto! Gerando o documento...', false);
    }

    let isProcessing = false;

    function processarPasso() {
        if(localStorage.getItem('robo_running') === 'true') {
            mostrarStatusFlutuante();
        } else {
            mostrarFesta();
            return;
        }

        if(isProcessing) return;
        isProcessing = true; // Trava contra cliques paralelos em um mesmo ciclo

        try {
            // Função auxiliar de preenchimento
            function preencher(seletor, valorNovo) {
                let el = getEl(seletor);
                if(el) {
                    try {
                        el.removeAttribute('onblur');
                        el.removeAttribute('onchange');
                    } catch(e) {}
                    
                    if(el.value !== valorNovo) {
                        try {
                            el.value = ''; 
                            el.value = valorNovo; 
                            el.dispatchEvent(new Event('change', {bubbles: true}));
                            el.dispatchEvent(new Event('blur', {bubbles: true}));
                        } catch(e) {}
                    }
                }
            }

            // Função de clique
            function clicar(btn) {
                if(!btn) return;
                try {
                    btn.click();
                } catch(e) {}
            }

            // Mapeamento Geral de Seletores Ativos/Visíveis
            let inpDataIni = getEl('input[name="pres_dat_inicio"]') || getEl('#pres_dat_inicio');
            let txtHist = getEl('textarea[name="pres_cmp_histo"]');
            let linkOutras = getEl('a', 'Outras Despesas');
            let linkJantar = getEl('a', 'Despesas com Refeições');
            let chkJantar = getEl('input[name="gast_flg_extra_check"]');
            let inpValorOutras = getEl('input[name="gast_val"]') || getEl('#gast_val');
            let selServ = getEl('select[name="serv_id"]');
            
            let btnConcluir = getEl('input[name="Sair"]') || getEl('input[value="Concluir"]') || getEl('input', 'Concluir');
            let btnProsseguir = getEl('input[name="Prosseguir"]') || getEl('input[value="Prosseguir"]') || getEl('input', 'Prosseguir');
            let btnGravar = getEl('input[name="GRAVAR"]') || getEl('input[name="Gravar"]') || getEl('input[value="Gravar Registro"]') || getEl('input', 'Gravar');
            let btnCalcule = getEl('input[name="calcule"]') || getEl('input[value="Calcule"]') || getEl('input', 'Calcule');
            
            // Textos para identificar as telas de navegação principais/finais
            let linkSis = getEl('a', 'Sistema de Adiantamento e Prestação de Contas');
            let linkReembolso = getEl('a', 'Reembolso de Despesas');
            let containerRateio = getEl('body', 'Este Reembolso:');

            let conf = JSON.parse(localStorage.getItem('robo_config') || '{}');
            let passo = localStorage.getItem('robo_passo_atual') || '';

            // -----------------------------------------------------------------
            // MÁQUINA DE ESTADOS DO FLUXO PRINCIPAL
            // -----------------------------------------------------------------

            // TELA 1: Inicial de datas (Preenchimento das datas e forma de pagamento)
            if (inpDataIni && (passo === 'inicio_datas' || passo === '')) {
                preencher('#pres_dat_inicio', conf.firstDay);
                let inpDataFim = getEl('#pres_dat_fim');
                if (inpDataFim) preencher('#pres_dat_fim', conf.lastDay);
                
                // Marca Caixa ou Banco
                let targetRadio = getEl(`input[name="tip_pag"][value="${conf.pagamento}" i]`);
                if (targetRadio && !targetRadio.checked) {
                    targetRadio.checked = true;
                    try { targetRadio.dispatchEvent(new Event('change', {bubbles: true})); } catch(e){}
                }

                localStorage.setItem('robo_passo_atual', 'inicio_historico');
                if (btnProsseguir) { clicar(btnProsseguir); return; }
            }
            
            // TELA 2: Histórico (Preenchimento do campo complemento de histórico)
            else if (txtHist && passo === 'inicio_historico') {
                preencher('textarea[name="pres_cmp_histo"]', conf.texto);
                localStorage.setItem('robo_passo_atual', 'menu_opcoes');
                if (btnProsseguir) { clicar(btnProsseguir); return; }
            }
            
            // TELA 3: Menu Intermediário (Defina suas despesas... - Primeira entrada)
            else if ((linkOutras || linkJantar) && passo === 'menu_opcoes') {
                localStorage.setItem('robo_passo_atual', 'preenchendo');
                if (conf.tipo === 'jantar' && linkJantar) {
                    clicar(linkJantar);
                } else if (conf.tipo === 'intermunicipal' && linkOutras) {
                    clicar(linkOutras);
                }
                return;
            }
            
            // TELA 4 (CAMINHO A): Sub-tela de Jantar (Despesas com Refeições)
            else if (chkJantar && (passo === 'preenchendo' || passo === 'calculando' || passo === 'gravando')) {
                
                if (passo === 'preenchendo') {
                    if(!chkJantar.checked) {
                        chkJantar.checked = true;
                        try { chkJantar.dispatchEvent(new Event('change', {bubbles: true})); } catch(e){}
                        return; 
                    }
                    preencher('textarea[name="gast_per_datas"]', conf.stringJantar);
                    preencher('textarea[name="gast_ser_executado"]', conf.texto);
                    
                    if (btnCalcule) {
                        localStorage.setItem('robo_passo_atual', 'calculando');
                        clicar(btnCalcule);
                    }
                    return;
                }
                
                else if (passo === 'calculando') {
                    if (btnGravar) {
                        localStorage.setItem('robo_passo_atual', 'gravando');
                        clicar(btnGravar);
                    }
                    return;
                }
                
                else if (passo === 'gravando') {
                    // Temporizador síncrono integrado ao ciclo do motor para evitar double-clicks
                    let tempoIniciado = parseInt(localStorage.getItem('robo_espera_concluir') || '0');
                    let agora = new Date().getTime();
                    
                    if (tempoIniciado === 0) {
                        localStorage.setItem('robo_espera_concluir', agora.toString());
                        return;
                    } else if (agora - tempoIniciado >= 2000) {
                        localStorage.removeItem('robo_espera_concluir');
                        localStorage.setItem('robo_passo_atual', 'concluido');
                        if (btnConcluir) clicar(btnConcluir);
                        return;
                    } else {
                        return; // Aguarda o ciclo
                    }
                }
            }
            
            // TELA 4 (CAMINHO B): Sub-tela de Intermunicipal (Outras Despesas)
            else if ((inpValorOutras || selServ) && (passo === 'preenchendo' || passo === 'gravando')) {
                
                if (passo === 'preenchendo') {
                    if (selServ) {
                        let optCorreta = Array.from(selServ.options).find(o => o.value === "160" || (o.text && o.text.includes("Refeiçoes Extra")));
                        let alvo = optCorreta ? optCorreta.value : (selServ.options.length > 1 ? selServ.options[1].value : "");
                        
                        if (selServ.value !== alvo) {
                            selServ.value = alvo;
                            try { selServ.dispatchEvent(new Event('change', {bubbles: true})); } catch(e){}
                            return; 
                        }
                    }
                    
                    preencher('input[name="gast_dat_servi"]', conf.firstDay) || preencher('#gast_dat_servi', conf.firstDay);
                    preencher('input[name="gast_val"]', conf.valorFormatado) || preencher('#gast_val', conf.valorFormatado);
                    preencher('textarea[name="gast_ser_executado"]', conf.texto);
                    
                    if (btnGravar) {
                        localStorage.setItem('robo_passo_atual', 'gravando');
                        clicar(btnGravar);
                    }
                    return;
                }
                
                else if (passo === 'gravando') {
                    // Temporizador síncrono integrado para evitar double-clicks no gravar
                    let tempoIniciado = parseInt(localStorage.getItem('robo_espera_concluir') || '0');
                    let agora = new Date().getTime();
                    
                    if (tempoIniciado === 0) {
                        localStorage.setItem('robo_espera_concluir', agora.toString());
                        return;
                    } else if (agora - tempoIniciado >= 2000) {
                        localStorage.removeItem('robo_espera_concluir');
                        localStorage.setItem('robo_passo_atual', 'concluido');
                        if (btnConcluir) clicar(btnConcluir);
                        return;
                    } else {
                        return; // Aguarda o ciclo
                    }
                }
            }
            
            // TELA 5: Retorno ao Menu Intermediário (Após gravar/concluir a despesa)
            else if ((linkOutras || linkJantar) && passo === 'concluido') {
                localStorage.setItem('robo_passo_atual', 'rateio');
                if (btnProsseguir) { clicar(btnProsseguir); return; }
            }
            
            // TELA 6: Tela Final de Rateio (comemora por 4 segundos e então clica no último prosseguir)
            else if (containerRateio && passo === 'rateio') {
                if (btnProsseguir) {
                    if (!localStorage.getItem('robo_festa')) {
                        // Primeira vez nesta tela: começa a festa e agenda o clique final
                        localStorage.setItem('robo_festa', new Date().getTime().toString());
                        festaFinal();
                        setTimeout(() => {
                            // Se você apertou Parar nesse meio tempo, não clica
                            if (localStorage.getItem('robo_running') !== 'true') return;
                            let btnFinal = getEl('input[name="Prosseguir"]') || getEl('input[value="Prosseguir"]') || getEl('input', 'Prosseguir') || btnProsseguir;

                            // Finaliza tudo limpando a memória e tirando o robozinho de cena
                            localStorage.removeItem('robo_running');
                            localStorage.removeItem('robo_passo_atual');
                            localStorage.removeItem('robo_config');
                            localStorage.removeItem('robo_espera_concluir');
                            localStorage.removeItem('robo_festa');
                            removerPet(getDocForUI());

                            clicar(btnFinal);
                        }, 4000);
                    } else {
                        festaFinal();
                    }
                    return;
                }
            }
            
            // NAVEGAÇÃO INICIAL: Fora do fluxo de preenchimento (Apenas para entrar no sistema)
            else {
                if (linkSis) { 
                    clicar(linkSis); 
                    return;
                }
                if (linkReembolso) { 
                    clicar(linkReembolso); 
                    return;
                }
            }

        } catch (erroGeral) {
            console.log("Erro abafado:", erroGeral);
        } finally {
            // Solta a trava de execução após 2 segundos
            setTimeout(() => { isProcessing = false; }, 2000);
        }
    }
};

// Empacotamento Seguro (Com bloqueio de recarregamento)
let jsCode = `void((${bookmarkletFunction.toString()})());`;
let finalHref = 'javascript:' + encodeURIComponent(jsCode);
document.getElementById('btn-arrastar').href = finalHref;


// =====================================================================
// TELA DE INSTALAÇÃO: mascote, teclas e imagens
// =====================================================================
(function () {
    const link = document.getElementById('btn-arrastar');
    const pet = document.getElementById('ins-pet');
    const bot = document.getElementById('ins-bot');
    const eyes = document.getElementById('ins-eyes');
    const fala = document.getElementById('ins-fala-txt');
    const FALA_PADRAO = 'Me arraste para sua barra de favoritos!';
    let timer = null;

    // Muda a fala (e o humor) do mascote e volta ao padrão depois de um tempo
    function dizer(texto, feliz, ms) {
        fala.textContent = texto;
        pet.classList.toggle('feliz', !!feliz);
        clearTimeout(timer);
        if (ms) {
            timer = setTimeout(() => {
                fala.textContent = FALA_PADRAO;
                pet.classList.remove('feliz');
            }, ms);
        }
    }

    // Clicar não faz nada: o robô só funciona a partir da barra de favoritos
    link.addEventListener('click', (e) => {
        e.preventDefault();
        bot.classList.remove('pula');
        void bot.getBoundingClientRect();
        bot.classList.add('pula');
        setTimeout(() => bot.classList.remove('pula'), 600);
        dizer('Não precisa clicar! Arraste-me até a barra de favoritos.', true, 3500);
    });

    link.addEventListener('mouseenter', () => { pet.classList.add('feliz'); });
    link.addEventListener('mouseleave', () => { if (!timer) pet.classList.remove('feliz'); });
    link.addEventListener('dragstart', () => dizer('Isso! Agora é só soltar na barra de favoritos.', true));
    link.addEventListener('dragend', () => dizer('Pronto! Agora siga os passos ao lado.', true, 6000));

    // Os olhos seguem o mouse
    document.addEventListener('mousemove', (e) => {
        const r = pet.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 300));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.4)) / 300));
        eyes.style.transform = 'translate(' + Math.round(dx * 7) + 'px,' + Math.round(dy * 5) + 'px)';
    });

    // No Mac, o atalho usa a tecla Command
    const plataforma = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    if (plataforma.indexOf('mac') !== -1) {
        const ctrl = document.getElementById('ins-key-ctrl');
        ctrl.textContent = '\u2318';
        ctrl.classList.add('sym');
    }

    // Clique nas imagens: amplia; clique de novo (ou Esc) fecha
    function ampliar(src, alt) {
        const fundo = document.createElement('div');
        fundo.className = 'ins-lightbox';
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || '';
        fundo.appendChild(img);
        const fechar = () => { fundo.remove(); document.removeEventListener('keydown', aoTeclar); };
        const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
        fundo.addEventListener('click', fechar);
        document.addEventListener('keydown', aoTeclar);
        document.body.appendChild(fundo);
    }
    document.querySelectorAll('.ins-moldura').forEach((fig) => {
        const abrir = () => ampliar(fig.getAttribute('data-zoom'), fig.querySelector('img').alt);
        fig.addEventListener('click', abrir);
        fig.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    });
})();
