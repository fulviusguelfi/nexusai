/**
 * PoC: Testa se a Web Speech API funciona no webview do VS Code NexusAI.
 *
 * CONTEXTO:
 * A extensão já registra handlers Electron para conceder permissões de mic/media
 * no activation (extension.ts, ~linha 95). Então há chances reais de funcionar.
 *
 * COMO REGISTRAR (temporariamente em src/extension.ts):
 *
 *   // No topo do arquivo, adicione:
 *   import { openSttPocWebview } from "../poc/SttWebviewCommand"
 *
 *   // Dentro do activate(), após os outros registerCommand():
 *   context.subscriptions.push(
 *     vscode.commands.registerCommand("nexusai.testSttWebview", () =>
 *       openSttPocWebview(context)
 *     ),
 *   )
 *
 * COMO EXECUTAR:
 *   1. F5 → "Run Extension" (ou "Extension Tests" se estiver em debug)
 *   2. Ctrl+Shift+P → "NexusAI: Testar STT WebView"
 *
 * COMO INTERPRETAR O RESULTADO:
 *   - "✅ disponível" + sem erro → Web Speech API funciona, podemos usá-la!
 *   - "not-allowed" → permissão bloqueada (OS ou VS Code sandbox)
 *   - "no-speech" → API disponível mas não detectou fala
 *   - "❌ NÃO disponível" → API inexistente no Electron desta versão
 *
 * Se funcionar → substitui Vosk por Web Speech API (multilingual, tempo-real, zero overhead).
 * Se falhar com "not-allowed" → seguimos com CLI bridge + RealtimeSTT (multilingual alternativo).
 */

import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

export function openSttPocWebview(context: vscode.ExtensionContext): void {
	// biome-ignore lint: PoC file — direct webview creation is intentional
	const panel = vscode.window.createWebviewPanel("nexusaiSttPoc", "NexusAI STT PoC", vscode.ViewColumn.One, {
		enableScripts: true,
		// Permite acesso local ao diretório poc/ para carregar o HTML estático
		localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "poc"))],
		// Sem retainContext — é apenas um teste descartável
		retainContextWhenHidden: false,
	})

	// Tenta ler o HTML externo primeiro; se não encontrado, usa HTML inline.
	const htmlPath = path.join(context.extensionPath, "poc", "stt-test.html")
	let htmlContent: string

	try {
		htmlContent = fs.readFileSync(htmlPath, "utf-8")
		// Converte caminhos relativos a recursos locais para URIs do webview
		// (não necessário aqui pois o HTML só usa inline scripts/styles, mas boa prática)
	} catch {
		// Fallback: HTML mínimo inline caso o arquivo não seja encontrado
		htmlContent = getInlineHtml()
	}

	panel.webview.html = htmlContent

	// Recebe mensagens do webview (opcional, para logging no host)
	panel.webview.onDidReceiveMessage(
		(msg) => {
			if (msg.type === "log") {
				// biome-ignore lint: PoC — console is fine here
				console.log("[SttPoc]", msg.text)
			}
		},
		undefined,
		context.subscriptions,
	)
}

/**
 * HTML mínimo inline para o caso de poc/stt-test.html não ser encontrado.
 * Replica o essencial do teste.
 */
function getInlineHtml(): string {
	return /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src *; connect-src *;" />
  <title>STT PoC</title>
  <style>
    body { font-family: monospace; background:#1e1e1e; color:#d4d4d4; padding:24px; }
    h1 { color:#569cd6; }
    button { background:#0e639c; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; margin-right:8px; }
    button.stop { background:#c53030; }
    button:disabled { background:#3c3c3c; color:#808080; }
    #status { padding:8px 12px; background:#252526; color:#9cdcfe; margin:12px 0 8px; border-radius:4px; }
    #status.error { color:#f48771; background:#3c1f1f; }
    #status.ok { color:#73c991; background:#1e3a1f; }
    #interim { min-height:40px; padding:8px 12px; background:#252526; border-left:3px solid #569cd6;
      color:#808080; font-style:italic; margin-bottom:8px; white-space:pre-wrap; }
    #transcript { min-height:100px; padding:8px 12px; background:#1e1e1e;
      border:1px solid #3c3c3c; border-radius:4px; white-space:pre-wrap; }
    #diag { margin-top:16px; padding:12px; background:#252526; font-size:0.8em; color:#808080; border-radius:4px; }
  </style>
</head>
<body>
  <h1>STT PoC — Web Speech API</h1>
  <p style="color:#808080;font-size:.85em">
    Diagnóstico: SE "disponível" e sem erro "not-allowed" → <b style="color:#73c991">Web Speech API funciona no webview!</b><br>
    Fale misturando pt-BR e inglês para testar multilingual.
  </p>

  <button id="btnStart">▶ Iniciar escuta</button>
  <button id="btnStop" class="stop" disabled>■ Parar</button>

  <div id="status">Aguardando...</div>
  <div style="color:#608b4e;font-size:.8em;text-transform:uppercase;letter-spacing:1px;margin-top:12px">Interim (ao vivo)</div>
  <div id="interim">&nbsp;</div>
  <div style="color:#608b4e;font-size:.8em;text-transform:uppercase;letter-spacing:1px;margin-top:8px">Final acumulado</div>
  <div id="transcript"></div>
  <div id="diag"></div>

  <script>
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const diag = document.getElementById('diag');
    const status = document.getElementById('status');
    const interim = document.getElementById('interim');
    const transcript = document.getElementById('transcript');
    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');

    const isElectron = navigator.userAgent.includes('Electron');
    diag.innerHTML =
      '<b>Diagnósticos:</b><br>' +
      'SpeechRecognition: ' + (SR ? '✅ disponível' : '❌ NÃO disponível') + '<br>' +
      'Ambiente: ' + (isElectron ? '⚡ Electron/VS Code' : '🌐 Browser') + '<br>' +
      'UA: ' + navigator.userAgent.substring(0, 120);

    if (!SR) {
      status.textContent = '❌ API SpeechRecognition não encontrada.';
      status.className = 'error';
      btnStart.disabled = true;
    }

    let recog = null;
    let finalText = '';

    btnStart.addEventListener('click', () => {
      finalText = '';
      transcript.textContent = '';
      interim.textContent = '\u00a0';

      recog = new SR();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = 'pt-BR';

      recog.onstart = () => {
        status.textContent = '🎤 Escutando... fale agora (misture pt e en)';
        status.className = 'ok';
        btnStart.disabled = true;
        btnStop.disabled = false;
        diag.innerHTML += '<br>✅ onstart disparado';
      };

      recog.onresult = (e) => {
        let itr = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t + '\\n';
          else itr += t;
        }
        interim.textContent = itr || '\u00a0';
        transcript.textContent = finalText;
      };

      recog.onerror = (e) => {
        status.textContent = '❌ Erro: ' + e.error + (e.message ? ' — ' + e.message : '');
        status.className = 'error';
        diag.innerHTML += '<br><b style="color:#f48771">onerror: ' + e.error + '</b>';
        btnStart.disabled = false;
        btnStop.disabled = true;
      };

      recog.onend = () => {
        if (!btnStop.disabled) recog.start(); // auto-reinicia
        else { status.textContent = 'Parado.'; status.className = ''; }
      };

      try { recog.start(); }
      catch(ex) {
        status.textContent = '❌ Exceção: ' + ex.message;
        status.className = 'error';
      }
    });

    btnStop.addEventListener('click', () => {
      btnStop.disabled = true;
      if (recog) recog.stop();
    });
  </script>
</body>
</html>`
}
