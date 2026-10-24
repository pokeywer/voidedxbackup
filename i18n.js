/* Shared, offline English / Brazilian Portuguese UI translations for VoidedX. */
(() => {
    'use strict';

    const STORAGE_KEY = 'voidedx-language';
    const translations = {
        'VoidedX Admin': 'Administração VoidedX',
        'Back to site': 'Voltar ao site',
        'Administrator sign in': 'Acesso do administrador',
        'Use the private admin credentials configured for this Vercel project.': 'Use as credenciais privadas de administrador configuradas para este projeto Vercel.',
        'USERNAME': 'USUÁRIO', 'PASSWORD': 'SENHA', 'Sign in': 'Entrar',
        'Login is rate-limited. Your password is checked on the server and is never stored in this page.': 'As tentativas de acesso são limitadas. Sua senha é verificada no servidor e nunca fica armazenada nesta página.',
        'CONTROL CENTER': 'PAINEL DE CONTROLE',
        'Manage announcements, review community ideas, and check site activity.': 'Gerencie avisos, revise ideias da comunidade e acompanhe a atividade do site.',
        'Refresh': 'Atualizar', 'Sign out': 'Sair', 'Total vaults': 'Cofres no total',
        'Tracked executions': 'Execuções registradas', 'Ideas submitted': 'Ideias enviadas',
        'SITE MESSAGE': 'AVISO DO SITE', 'Announcement': 'Aviso', 'No active message': 'Nenhum aviso ativo',
        'Publish a site-wide banner. It stays visible until you remove it, unless you enable visitor dismissal or set an expiry.': 'Publique um aviso para todo o site. Ele permanece visível até você removê-lo, a menos que permita que visitantes o fechem ou defina uma expiração.',
        'Publish one message banner at the top of the main page. Keep it short and useful.': 'Publique um aviso no topo da página principal. Seja breve e objetivo.',
        'TITLE': 'TÍTULO', 'Example: Maintenance tonight': 'Exemplo: manutenção hoje à noite',
        'MESSAGE': 'MENSAGEM', 'Write an update for VoidedX visitors': 'Escreva um aviso para quem visita o VoidedX',
        'STYLE': 'ESTILO', 'Information': 'Informação', 'Success': 'Sucesso', 'Warning': 'Atenção',
        'BUTTON LABEL': 'TEXTO DO BOTÃO', 'Learn more': 'Saiba mais', 'OPTIONAL LINK': 'LINK OPCIONAL',
        'Publish announcement': 'Publicar aviso', 'Publish': 'Publicar', 'Hide from library': 'Ocultar da biblioteca',
        'Remove': 'Remover', 'COMMUNITY': 'COMUNIDADE',
        'AUTO-EXPIRE (OPTIONAL)': 'EXPIRAÇÃO AUTOMÁTICA (OPCIONAL)', 'Leave blank to keep it live until you remove it.': 'Deixe em branco para mantê-lo ativo até removê-lo.',
        'Let visitors dismiss this banner': 'Permitir que visitantes fechem este aviso',
        'Off by default. If enabled, the close button appears and stays dismissed on that device.': 'Desativado por padrão. Se ativado, o botão de fechar aparece e o aviso fica fechado naquele dispositivo.',
        'LIVE PREVIEW': 'PRÉVIA AO VIVO', 'Updates as you type': 'Atualiza enquanto você digita',
        'Save your vault to prepare a rotating loader.': 'Salve o cofre para preparar um carregador rotativo.',
        'Preparing loader…': 'Preparando o carregador…', 'Refreshing loader…': 'Atualizando o carregador…',
        'Loader expired · refreshing now…': 'Carregador expirado · atualizando agora…',
        'Current loader expires in 1s · refreshing automatically': 'O carregador atual expira em 1s · atualização automática',
        'The displayed loader refreshes every 40 seconds, and each copy expires after 45 seconds. Copy the latest version before you run it.': 'O carregador exibido é atualizado a cada 40 segundos e cada cópia expira após 45 segundos. Copie a versão mais recente antes de executá-la.',
        'Your announcement title': 'Título do seu aviso', 'Your message will appear here.': 'Sua mensagem aparecerá aqui.',
        'Published · dismissible': 'Publicado · pode ser fechado', 'Published · persistent': 'Publicado · permanece visível', 'Expired': 'Expirado',
        'Feature ideas': 'Ideias de recursos', 'Loading…': 'Carregando…',
        'Review suggestions sent through the Share Your Ideas form.': 'Revise sugestões enviadas pelo formulário Compartilhe suas ideias.',
        'Loading ideas…': 'Carregando ideias…', 'SCRIPT LIBRARY': 'BIBLIOTECA DE SCRIPTS',
        'Community script review': 'Revisão de scripts da comunidade', 'Manage existing scripts': 'Gerenciar scripts existentes',
        'Search the latest community uploads, change their visibility, or restore hidden scripts.': 'Pesquise os envios recentes da comunidade, altere a visibilidade ou restaure scripts ocultos.',
        'Search by title, creator, game, or description': 'Pesquisar por título, criador, jogo ou descrição',
        'Filter scripts by status': 'Filtrar scripts por status', 'All statuses': 'Todos os status', 'Published': 'Publicado', 'Hidden': 'Oculto', 'Rejected': 'Rejeitado',
        'Loading scripts…': 'Carregando scripts…', 'No scripts match these filters.': 'Nenhum script corresponde a estes filtros.',
        'No published or hidden scripts found.': 'Nenhum script publicado ou oculto foi encontrado.',
        'Read the description and source before approving. Approved scripts appear in the public library. Reported scripts can be hidden from visitors.': 'Leia a descrição e o código antes de aprovar. Os scripts aprovados aparecem na biblioteca pública. Scripts denunciados podem ser ocultados dos visitantes.',
        'Waiting for review': 'Aguardando revisão', 'Loading submissions…': 'Carregando envios…',
        'Reported by users': 'Denunciados por usuários', 'Loading reports…': 'Carregando denúncias…',

        'VoidedX // Script Vault': 'VoidedX // Cofre de scripts',
        'VoidedX Script Vault': 'Cofre de scripts VoidedX',
        '— Fast, Free Roblox Script Hosting & Key System! Share your scripts safely.': '— Hospedagem gratuita e rápida de scripts Roblox com sistema de chaves! Compartilhe seus scripts com segurança.',
        '— Fast, Free & Secure Roblox Script Hosting & Key System! Share your scripts safely.': '— Hospedagem gratuita, rápida e segura de scripts Roblox com sistema de chaves! Compartilhe seus scripts com segurança.',
        'Share VoidedX': 'Compartilhar VoidedX', 'FREE': 'GRÁTIS', 'Community script library': 'Biblioteca de scripts da comunidade',
        'Script Library': 'Biblioteca de scripts', 'Leaderboard': 'Ranking', 'Share your ideas': 'Compartilhe suas ideias',
        'Share Your Ideas': 'Compartilhe suas ideias', 'Guest': 'Visitante', 'Login': 'Entrar', 'Log In': 'Entrar',
        'New Vault': 'Novo cofre', 'VAULT TITLE': 'TÍTULO DO COFRE', 'Hub / Script Name': 'Hub / Nome do script',
        'Vault settings': 'Configurações do cofre', 'VAULT OVERVIEW': 'RESUMO DO COFRE',
        'Your vault statistics': 'Estatísticas dos seus cofres', 'Vaults': 'Cofres', 'Executions': 'Execuções',
        'Key gated': 'Protegido por chave', 'MY VAULTS': 'MEUS COFRES', 'Recover old vault by ID': 'Recuperar cofre antigo por ID',
        'Search your vaults...': 'Pesquisar seus cofres...', 'Search your vaults': 'Pesquisar seus cofres',
        'Sort vaults': 'Ordenar cofres', 'Recently updated': 'Atualizados recentemente', 'Most executions': 'Mais execuções',
        'Title A–Z': 'Título A–Z', 'Filter vaults by key protection': 'Filtrar cofres por proteção de chave',
        'All vaults': 'Todos os cofres', 'Key protected': 'Protegidos por chave', 'Not key protected': 'Sem proteção por chave',
        'Log in to save and manage your script vaults cloud-wide.': 'Entre para salvar e gerenciar seus cofres de scripts na nuvem.',
        'OPTIONS': 'OPÇÕES', 'Key System Manager': 'Gerenciador do sistema de chaves', 'OFF': 'DESATIVADO',
        'VAULT PROTECTION': 'PROTEÇÃO DO COFRE', 'Key access gate': 'Acesso protegido por chave',
        'Lua obfuscation (very beta)': 'Ofuscação Lua (beta inicial)', 'Auto · Low / Medium / High': 'Automático · Baixo / Médio / Alto',
        'Strength': 'Intensidade', 'Auto (recommended)': 'Automático (recomendado)', 'Low': 'Baixa', 'Medium': 'Média',
        'High (slower)': 'Alta (mais lento)', 'Mild tamper check': 'Verificação básica contra alterações',
        'Stops after basic integrity edits; no debug traps': 'Detecta alterações básicas de integridade; sem armadilhas de depuração',
        'VM protection': 'Proteção VM',
        'Experimental: runs the VM pass alone; other protection options are disabled while it is on': 'Experimental: executa apenas a etapa VM; as outras opções de proteção ficam desativadas enquanto ela estiver ligada',
        'More string splitting': 'Divisão extra de textos',
        'Uses shorter chunks for larger output; skips very long strings': 'Usa partes menores para gerar mais saída; ignora textos muito longos',
        'Auto .txt Local Backup': 'Backup .txt local automático', 'Voidedx On Top!': 'VoidedX em primeiro lugar!',
        'Download backup now': 'Baixar backup agora',
        'Use the Key System Manager to gate access. Anyone who runs a client script can capture its delivered code; obfuscation only adds friction, so never include passwords or private API keys.': 'Use o Gerenciador do sistema de chaves para controlar o acesso. Quem executa um script no cliente pode capturar o código recebido; a ofuscação apenas dificulta isso, então nunca inclua senhas nem chaves privadas de API.',
        'Warning: A saved vault with 0 executions is deleted after 10 hours. Saving it again restarts the timer. If you close this page, cleanup runs when you return. Download a backup to keep an unused script.': 'Atenção: um cofre salvo com 0 execuções é excluído após 10 horas. Salvá-lo novamente reinicia o prazo. Se você fechar esta página, a limpeza ocorrerá quando voltar. Baixe um backup para guardar scripts sem uso.',
        'SAVE / UPDATE VAULT': 'SALVAR / ATUALIZAR COFRE', 'Tip: Press Ctrl+S or ⌘+S while editing to save.': 'Dica: pressione Ctrl+S ou ⌘+S durante a edição para salvar.',
        'DELETE VAULT': 'EXCLUIR COFRE', 'SCRIPT SOURCE': 'CÓDIGO-FONTE DO SCRIPT', 'All changes saved': 'Todas as alterações foram salvas',
        'Editing Existing Vault': 'Editando cofre existente', 'Script editor tools': 'Ferramentas do editor de scripts', 'LUAU': 'LUAU',
        'Syntax colors are a guide; large files use plain text to keep editing responsive.': 'As cores da sintaxe são apenas uma referência; arquivos grandes usam texto simples para manter o editor ágil.',
        'Check code': 'Verificar código', 'Paste Luau source here. A loaded vault’s saved script appears in this editor; it is separate from the website HTML.': 'Cole o código Luau aqui. O script salvo de um cofre carregado aparece neste editor; ele é separado do HTML do site.',
        'Luau script editor': 'Editor de scripts Luau', 'Code check results': 'Resultados da verificação', 'Code check': 'Verificação de código',
        'No check run yet': 'Nenhuma verificação executada', 'Close code check results': 'Fechar resultados da verificação',
        'These quick checks catch common issues; they are not a full Luau compiler.': 'Estas verificações rápidas detectam problemas comuns; elas não substituem um compilador Luau completo.',
        'VAULT SAVED!': 'COFRE SALVO!', 'COPY LOADSTRING': 'COPIAR LOADSTRING',
        'This is a small launcher that fetches your saved vault when run. To show the in-game key popup, add a key, turn on': 'Este é um carregador pequeno que busca o cofre salvo quando executado. Para mostrar a janela de chave no jogo, adicione uma chave e ative',
        'Key System': 'Sistema de chaves', 'and': 'e', 'In-Game Key GUI': 'Janela de chave no jogo', 'in Key System Manager, then click Apply Changes.': 'no Gerenciador do sistema de chaves e clique em Aplicar alterações.',
        'COPY GET-KEY LINK': 'COPIAR LINK PARA OBTER CHAVE', 'Welcome back': 'Boas-vindas de volta',
        'Log in to sync your vaults to the cloud.': 'Entre para sincronizar seus cofres com a nuvem.', 'Sign Up': 'Criar conta',
        'Continue with Google': 'Continuar com o Google', 'or continue with email': 'ou continue com seu e-mail', 'EMAIL': 'E-MAIL',
        'Show password': 'Mostrar senha', 'Use at least 6 characters.': 'Use pelo menos 6 caracteres.', 'Cancel': 'Cancelar',
        'Delete this vault?': 'Excluir este cofre?', 'This action can’t be undone.': 'Esta ação não pode ser desfeita.',
        "This action can't be undone.": 'Esta ação não pode ser desfeita.', 'Delete': 'Excluir',
        "Tell us what you'd like to see added to VoidedX next.": 'Conte o que você gostaria de ver no VoidedX.',
        'YOUR NAME (OPTIONAL)': 'SEU NOME (OPCIONAL)', 'Anonymous': 'Anônimo', 'YOUR IDEA': 'SUA IDEIA',
        'e.g. A public script browser, dark/light themes, Discord bot integration...': 'ex.: navegador público de scripts, temas claro/escuro, integração com bot do Discord...',
        'Send Idea': 'Enviar ideia',

        'VoidedX // Get Key': 'VoidedX // Obter chave', 'Create a Vault': 'Criar um cofre',
        "Looking up this vault's key page.": 'Procurando a página de chaves deste cofre.', 'Key Page Unavailable': 'Página de chaves indisponível',
        "This vault doesn't exist or doesn't use a key system.": 'Este cofre não existe ou não usa um sistema de chaves.',
        'Get Your Key': 'Obtenha sua chave', 'Pick a key below, then paste the loadstring into your executor.': 'Escolha uma chave abaixo e cole o loadstring no seu executor.',
        'Key': 'Chave', 'Open the owner’s custom link, finish their step, then return using the reward link. Your one-time ticket expires after 20 minutes.': 'Abra o link personalizado do proprietário, conclua a etapa e volte pelo link de recompensa. Seu ticket de uso único expira em 20 minutos.',
        'Open custom link': 'Abrir link personalizado', 'Get Key': 'Obter chave', 'Verifying…': 'Verificando…',
        'This key was issued for one custom-link return ticket. The ticket cannot be reused. Copy and save your key now.': 'Esta chave foi emitida para um ticket de retorno de uso único. O ticket não pode ser reutilizado. Copie e salve sua chave agora.',
        'Your Key:': 'Sua chave:', 'Copy': 'Copiar', 'Loadstring (paste into your executor):': 'Loadstring (cole no seu executor):',
        'Open Vault Page': 'Abrir página do cofre',

        'VoidedX // Key System': 'VoidedX // Sistema de chaves', 'Back to Dashboard': 'Voltar ao painel',
        'Loading vault…': 'Carregando cofre…', 'Vault not found.': 'Cofre não encontrado.',
        'Beginner guide — set up your key system': 'Guia para iniciantes — configure seu sistema de chaves',
        'Turn it on.': 'Ative-o.', 'Switch on': 'Ative', 'to show the key settings.': 'para mostrar as configurações de chave.',
        'Choose who gets keys.': 'Escolha quem receberá chaves.',
        'Add a Private Key for people you choose, or enable Public Key so visitors can request one from your Get-Key page.': 'Adicione uma chave privada para pessoas específicas ou ative a chave pública para que visitantes possam solicitá-la na página de obtenção de chave.',
        'Set the timer.': 'Defina a duração.',
        'Choose how long a key lasts and how many players may use it. Expired keys are rejected; the remaining time is shown in the in-game status badge.': 'Escolha por quanto tempo a chave vale e quantos jogadores podem usá-la. Chaves expiradas são recusadas; o tempo restante aparece no indicador do jogo.',
        'Set up the in-game popup.': 'Configure a janela no jogo.',
        'Turn on': 'Ative',
        'to ask players for a key in Roblox. Customize the title, colors, button, and background animation, then use the live-preview controls to replay the entrance, unlock, Get-Key, and close/open animations. After a key verifies, VoidedX saves it locally when the executor supports file saving, and checks it automatically next run.': 'para solicitar uma chave aos jogadores no Roblox. Personalize o título, as cores, o botão e a animação de fundo. Use a prévia para reproduzir as animações de entrada, desbloqueio, obtenção de chave e abrir/fechar. Depois da verificação, o VoidedX salva a chave localmente se o executor permitir e a verifica na próxima execução.',
        'Optional custom link.': 'Link personalizado opcional.',
        'Add your HTTPS unlock link below. Copy both links from the Get-Key Link tab: share the visitor link, then set the reward or return destination to the template that includes': 'Adicione abaixo seu link HTTPS de desbloqueio. Copie os dois links da aba Link para obter chave: compartilhe o link do visitante e defina o destino de recompensa ou retorno usando o modelo que inclui',
        '. Your link service must preserve that ticket and substitute it into the reward URL.': '. Seu serviço de links deve preservar esse ticket e inseri-lo na URL de recompensa.',
        'Save your settings.': 'Salve suas configurações.', 'Click': 'Clique em', 'Apply Changes': 'Aplicar alterações',
        'after editing. Share the Get-Key URL with players who need a public key.': 'após editar. Compartilhe a URL para obter chave com os jogadores que precisam de uma chave pública.',
        "Saved keys stay in the player's executor files on that device. The server still checks each key and expiration. Expiration blocks future runs; it cannot stop a script that is already running.": 'As chaves salvas ficam nos arquivos do executor naquele dispositivo. O servidor continua verificando cada chave e sua validade. A expiração bloqueia execuções futuras, mas não interrompe um script que já está em execução.',
        'Keys': 'Chaves', 'Security': 'Segurança', 'Get-Key Link': 'Link para obter chave', 'PUBLIC KEY': 'CHAVE PÚBLICA',
        'Enable Public Key': 'Ativar chave pública',
        'Auto-generated — visitors request it from the Get-Key page. The optional custom link uses a server-issued, single-use return ticket; the short wait is enforced by the server.': 'Gerada automaticamente — visitantes solicitam a chave na página de obtenção. O link personalizado opcional usa um ticket de retorno de uso único emitido pelo servidor; o servidor controla o breve tempo de espera.',
        'DURATION': 'DURAÇÃO', 'Permanent — never expires': 'Permanente — não expira', '1 Day': '1 dia', '3 Days': '3 dias',
        '7 Days': '7 dias', '14 Days': '14 dias', '30 Days': '30 dias', 'Custom…': 'Personalizado…', 'Number of days': 'Número de dias',
        'PLAYERS ALLOWED': 'JOGADORES PERMITIDOS', 'Unlimited': 'Ilimitado', 'CUSTOM UNLOCK LINK (OPTIONAL)': 'LINK DE DESBLOQUEIO PERSONALIZADO (OPCIONAL)',
        'Visitors click': 'Os visitantes clicam em', 'to open this link. Configure its reward/return destination with the template in the next tab, passing the incoming': 'para abrir este link. Configure o destino de recompensa/retorno com o modelo da próxima aba, incluindo o valor recebido',
        'value as the': 'como o parâmetro de consulta', 'query parameter. Each ticket is random, expires after 20 minutes, and can be redeemed once. Only HTTPS links are allowed; adult-content domains such as phub and known unsafe destinations are blocked.': 'Cada ticket é aleatório, expira em 20 minutos e só pode ser resgatado uma vez. Apenas links HTTPS são permitidos; domínios de conteúdo adulto, como phub, e destinos reconhecidamente inseguros são bloqueados.',
        'ACTIONS': 'AÇÕES', 'Force Regenerate': 'Forçar geração novamente', 'Terminate': 'Encerrar', 'PRIVATE / WHITELIST KEYS': 'CHAVES PRIVADAS / PERMITIDAS',
        'Add Private Key': 'Adicionar chave privada', 'DELIVERY METHOD': 'MÉTODO DE ENTREGA',
        'In-Game Key GUI (popup asks for the key)': 'Janela de chave no jogo (solicita a chave)',
        'On:': 'Ativado:', 'the loadstring has no key in it — a popup appears in-game (PC and mobile) asking the player to type their key.': 'o loadstring não contém a chave — uma janela aparece no jogo (PC e celular) e solicita que o jogador a digite.',
        'Off:': 'Desativado:', 'the key is baked into the loadstring URL itself.': 'a chave fica incluída na própria URL do loadstring.',
        'READY-MADE THEMES': 'TEMAS PRONTOS', 'Custom': 'Personalizado', '14 looks': '14 estilos',
        'Choose a ready-made theme with a matching background effect, then fine-tune its text, colors, and motion below.': 'Escolha um tema pronto com efeito de fundo correspondente e ajuste o texto, as cores e o movimento abaixo.',
        'In-game key system themes': 'Temas do sistema de chaves no jogo', 'Popup title': 'Título da janela', 'VoidedX Key System': 'Sistema de chaves VoidedX',
        'Subtitle': 'Subtítulo', 'Enter your key to continue': 'Digite sua chave para continuar', 'Button text': 'Texto do botão', 'Submit': 'Enviar',
        'Accent': 'Destaque', 'Popup accent color': 'Cor de destaque da janela', 'Glow': 'Brilho', 'Popup glow color': 'Cor do brilho da janela',
        'Panel': 'Painel', 'Popup panel color': 'Cor do painel da janela', 'Text': 'Texto', 'Popup text color': 'Cor do texto da janela',
        'Background animation': 'Animação de fundo', 'In-game background animation': 'Animação de fundo no jogo', 'Still': 'Parado',
        'Aurora drift': 'Movimento de aurora', 'Soft color drift': 'Movimento suave de cores', 'Orbiting gradient': 'Gradiente orbital',
        'Nebula clouds': 'Nuvens de nebulosa', 'Soft waves': 'Ondas suaves', 'Breathing glow': 'Brilho pulsante', 'Light sweep': 'Faixa de luz',
        'Starlight': 'Luz das estrelas', 'Prism shimmer': 'Brilho de prisma', 'Floating particles': 'Partículas flutuantes',
        'Ripple glow': 'Brilho ondulado', 'Comet sweep': 'Rastro de cometa', 'Circuit grid': 'Grade de circuitos', 'Corner glints': 'Brilhos nos cantos',
        'LIVE PREVIEW': 'PRÉVIA AO VIVO', 'Controls below are simulations': 'Os controles abaixo são simulações',
        'Close popup preview': 'Fechar prévia da janela', 'SECURE KEY ACCESS': 'ACESSO SEGURO POR CHAVE', 'Vault: --': 'Cofre: --',
        'ACCESS KEY': 'CHAVE DE ACESSO', 'Enter key here...': 'Digite a chave aqui...', '→': '→', '↗ Need a key? Get one here': '↗ Precisa de uma chave? Obtenha aqui',
        'KEY VERIFICATION · VOIDEDX': 'VERIFICAÇÃO DE CHAVE · VOIDEDX', 'KEY UNLOCKED': 'CHAVE DESBLOQUEADA',
        'Saved on this device': 'Salva neste dispositivo', 'Popup closed': 'Janela fechada', 'Tap to open it again.': 'Toque para abri-la novamente.',
        'Preview in-game GUI animations': 'Prévia das animações da janela no jogo', 'Replay intro': 'Repetir introdução', 'Unlock': 'Desbloquear',
        'Need a key': 'Preciso de uma chave', 'Close popup': 'Fechar janela',
        'Try the entrance, unlock, Get-Key, and close/open animations. This preview is visual only; it does not verify or copy a real key.': 'Experimente as animações de entrada, desbloqueio, obtenção de chave e abrir/fechar. Esta prévia é apenas visual; não verifica nem copia uma chave real.',
        'IP LOCK': 'BLOQUEIO POR IP', 'Lock Key to First IP': 'Vincular a chave ao primeiro IP',
        'Not bound to any IP yet — the next person to use this key locks it in.': 'Ainda não vinculada a um IP — a próxima pessoa a usar esta chave fará o vínculo.',
        'Reset Bound IP': 'Redefinir IP vinculado',
        'People on shared/mobile networks can have changing IPs, which can lock out a legitimate user by accident — use Reset if that happens. Applies across all keys on this vault.': 'Pessoas em redes compartilhadas ou móveis podem ter IPs variáveis, o que pode bloquear um usuário legítimo por engano. Use Redefinir se isso acontecer. Aplica-se a todas as chaves deste cofre.',
        'BANNED USERS': 'USUÁRIOS BLOQUEADOS', 'Banning blocks a Roblox account from using': 'O bloqueio impede que uma conta Roblox use',
        'any': 'qualquer', 'key on this vault. Only takes effect where the vault can see who’s playing (account-bound or in-game GUI keys).': 'chave deste cofre. Só funciona quando o cofre consegue identificar quem está jogando (chaves vinculadas à conta ou pela janela no jogo).',
        'key on this vault. Only takes effect where the vault can see who\'s playing (account-bound or in-game GUI keys).': 'chave deste cofre. Só funciona quando o cofre consegue identificar quem está jogando (chaves vinculadas à conta ou pela janela no jogo).',
        'Roblox UserId to ban': 'UserId Roblox para bloquear', 'Permanent': 'Permanente', 'Ban': 'Bloquear', 'GET-KEY LINK': 'LINK PARA OBTER CHAVE',
        'Save this vault to generate a link': 'Salve este cofre para gerar um link',
        'Share this visitor URL. When a custom link is set, visitors click its button and your link service should send them back through the one-time reward URL below. Private keys are never listed on these pages.': 'Compartilhe esta URL com os visitantes. Se houver um link personalizado, eles clicarão no botão e seu serviço deverá redirecioná-los pela URL de recompensa de uso único abaixo. Chaves privadas nunca são exibidas nessas páginas.',
        'ONE-TIME REWARD / RETURN URL': 'URL DE RECOMPENSA / RETORNO DE USO ÚNICO',
        'Set this as the reward destination and replace': 'Defina este endereço como destino da recompensa e substitua',
        'with the ticket passed to your custom link. A generic URL cannot confirm that an external task was completed; your link service must support passing through a per-visit value and redirecting back here.': 'pelo ticket enviado ao seu link personalizado. Uma URL genérica não pode confirmar a conclusão de uma tarefa externa; seu serviço de links precisa encaminhar um valor por visita e redirecionar de volta para cá.',
        'Priority (1 = shown first)': 'Prioridade (1 = exibido primeiro)', 'Key label (e.g. Free, VIP)': 'Nome da chave (ex.: Grátis, VIP)',
        'Delete this key': 'Excluir esta chave', 'Generate a random key': 'Gerar uma chave aleatória', 'Extend Time': 'Prorrogar validade', 'Regenerate': 'Gerar novamente',

        'VoidedX // Leaderboard': 'VoidedX // Ranking', 'VoidedX Leaderboard': 'Ranking VoidedX',
        '— Discover the vaults with the most successful executions.': '— Descubra os cofres com mais execuções bem-sucedidas.',
        'Create a vault': 'Criar um cofre', 'LEADERBOARD': 'RANKING', 'Main navigation': 'Navegação principal', 'Home': 'Início',
        'Community stats': 'Estatísticas da comunidade', 'Execution Leaderboard': 'Ranking de execuções',
        'See which vaults are being run the most. Switch between today, this month, and all time.': 'Veja quais cofres são mais executados. Alterne entre hoje, este mês e todo o período.',
        'Refresh rankings': 'Atualizar ranking', 'VoidedX usage today': 'Uso do VoidedX hoje', 'Active users today': 'Usuários ativos hoje',
        'Unique player IDs seen by a successful loader': 'IDs únicos de jogadores vistos por um carregador bem-sucedido',
        'Script loads today': 'Scripts carregados hoje', 'Vault code delivered after loader checks': 'Código do cofre entregue após as verificações do carregador',
        'Vaults used today': 'Cofres usados hoje', 'Different vaults with a successful run': 'Cofres diferentes com execução bem-sucedida',
        'How today’s activity is counted': 'Como a atividade de hoje é contabilizada',
        '“Active users” counts distinct Roblox UserIds reported by loader requests today. IDs are supplied by the client and are not independently verified, so this is a usage estimate—not proof of unique people. Load counts mean code was delivered after loader checks; they cannot confirm that code finished running in Roblox. Tracking starts after deployment, and older keyless loadstrings may need to be copied again to report a player ID.': '“Usuários ativos” conta os UserIds Roblox distintos informados pelas solicitações de carregamento de hoje. Os IDs vêm do cliente e não são verificados de forma independente, então isto é uma estimativa de uso, não uma confirmação de pessoas únicas. A contagem de carregamentos indica que o código foi entregue após as verificações; não confirma que terminou de executar no Roblox. O rastreamento começa após a publicação, e loadstrings antigos sem chave talvez precisem ser copiados novamente para informar o ID do jogador.',
        'Top vault highlights': 'Destaques dos cofres', 'All-time leader': 'Líder de todos os períodos', 'This month’s leader': 'Líder deste mês', 'Today’s leader': 'Líder de hoje',
        'Execution rankings': 'Ranking de execuções', 'Leaderboard period': 'Período do ranking', 'Today': 'Hoje', 'This month': 'Este mês',
        'All time': 'Todo o período', 'All-time rankings': 'Ranking geral', 'Lifetime execution totals': 'Total histórico de execuções',
        'Loading rankings…': 'Carregando ranking…',
        'Only vaults with more than zero executions are shown. Today and monthly counts use UTC and start from the moment leaderboard tracking is deployed. All-time ranks use each vault’s saved execution total.': 'Apenas cofres com mais de zero execuções são exibidos. As contagens de hoje e do mês usam UTC e começam quando o rastreamento do ranking é publicado. O ranking geral usa o total de execuções salvo em cada cofre.',

        'Community Scripts | VoidedX': 'Scripts da comunidade | VoidedX', 'COMMUNITY': 'COMUNIDADE', 'Explore': 'Explorar', 'Script Builder': 'Criador de scripts',
        'Sign in': 'Entrar', 'THE VOIDEDX COMMUNITY': 'A COMUNIDADE VOIDEDX', 'Scripts made': 'Scripts criados', 'by the community.': 'pela comunidade.',
        'Find useful scripts, save the ones you like, and share your own work with other creators.': 'Encontre scripts úteis, salve seus favoritos e compartilhe seu trabalho com outros criadores.',
        'Share a script': 'Compartilhar um script', 'Browse scripts': 'Explorar scripts', 'community.lua': 'community.lua',
        'Creator community': 'Comunidade de criadores', 'Made to share': 'Feito para compartilhar', 'Community statistics': 'Estatísticas da comunidade',
        'community scripts': 'scripts da comunidade', 'community likes': 'curtidas da comunidade', 'script views': 'visualizações de scripts',
        'Uploads are reviewed before they appear publicly.': 'Os envios são revisados antes de aparecerem publicamente.',
        'FIND YOUR NEXT FAVORITE': 'ENCONTRE SEU PRÓXIMO FAVORITO', 'Script library': 'Biblioteca de scripts',
        'Search community uploads by name, game, or tag.': 'Pesquise envios da comunidade por nome, jogo ou etiqueta.', 'Upload script': 'Enviar script',
        'Search scripts, games, or tags…': 'Pesquisar scripts, jogos ou etiquetas…', 'Filter by category': 'Filtrar por categoria', 'All categories': 'Todas as categorias',
        'Universal': 'Universal', 'Simulator': 'Simulador', 'Combat': 'Combate', 'Utility': 'Utilitário', 'Other': 'Outro',
        'Sort scripts': 'Ordenar scripts', 'Most liked': 'Mais curtidos', 'Recently added': 'Adicionados recentemente',
        'Most viewed': 'Mais visualizados', 'Most downloaded': 'Mais baixados', 'Script collections': 'Coleções de scripts', 'Saved': 'Salvos', 'My uploads': 'Meus envios',
        'Loading community scripts…': 'Carregando scripts da comunidade…', 'No scripts found': 'Nenhum script encontrado',
        'Try another search, or share the first script in this category.': 'Tente outra pesquisa ou compartilhe o primeiro script desta categoria.',
        'Upload a script': 'Enviar um script', 'Keep the community useful and safe': 'Ajude a manter a comunidade útil e segura',
        'Only share work you have permission to post. Uploads are reviewed. Malware, credential theft, doxxing, and harmful content are not allowed. Scripts are displayed as code for people to review; VoidedX does not run community uploads.': 'Compartilhe apenas trabalhos que você tem permissão para publicar. Os envios são revisados. Malware, roubo de credenciais, exposição de dados pessoais e conteúdo nocivo não são permitidos. Os scripts são exibidos como código para avaliação; o VoidedX não executa envios da comunidade.',
        'Read upload rules': 'Ler as regras de envio', 'Built for creators who share.': 'Feito para criadores que compartilham.', 'View leaderboard': 'Ver ranking',
        'Welcome to VoidedX': 'Boas-vindas ao VoidedX', 'Sign in to like, save, and upload scripts.': 'Entre para curtir, salvar e enviar scripts.',
        'Create account': 'Criar conta', 'At least 6 characters': 'Pelo menos 6 caracteres', 'Share your script': 'Compartilhe seu script',
        'Your upload will be checked by a moderator before it goes live.': 'Um moderador revisará seu envio antes da publicação.',
        'SCRIPT NAME': 'NOME DO SCRIPT', 'Example: Inventory helper': 'Exemplo: auxiliar de inventário', 'CATEGORY': 'CATEGORIA', 'Choose a category': 'Escolha uma categoria',
        'CREATOR NAME (OPTIONAL)': 'NOME DO CRIADOR (OPCIONAL)', 'Community member': 'Membro da comunidade', 'GAME (OPTIONAL)': 'JOGO (OPCIONAL)',
        'Any game': 'Qualquer jogo', 'TAGS (OPTIONAL)': 'ETIQUETAS (OPCIONAL)', 'ui, helper, movement': 'interface, auxiliar, movimento',
        'DESCRIPTION': 'DESCRIÇÃO', 'What does it do? Add a clear, helpful description.': 'O que ele faz? Escreva uma descrição clara e útil.',
        'SCRIPT CODE': 'CÓDIGO DO SCRIPT', 'Paste the script code here…': 'Cole o código do script aqui…',
        'I have permission to share this work. It does not contain malware, credential theft, doxxing, or harmful content. I understand it will be reviewed before publishing.': 'Tenho permissão para compartilhar este trabalho. Ele não contém malware, roubo de credenciais, exposição de dados pessoais ou conteúdo nocivo. Entendo que será revisado antes da publicação.',
        'Send for review': 'Enviar para revisão', 'You can submit up to 5 scripts per day. Maximum code size: 40 KB.': 'Você pode enviar até 5 scripts por dia. Tamanho máximo do código: 40 KB.',
        'Loading script…': 'Carregando script…', 'Script source': 'Código-fonte do script', 'Review the code before using it.': 'Revise o código antes de usá-lo.',
        'Script source code': 'Código-fonte do script', 'Copy script': 'Copiar script', 'Download .txt': 'Baixar .txt', 'Share': 'Compartilhar', 'Like': 'Curtir',
        'Save': 'Salvar', 'Report this script': 'Denunciar este script', 'Why should a moderator review this?': 'Por que um moderador deve revisar isto?',
        'Describe the issue': 'Descreva o problema', 'Send report': 'Enviar denúncia',

        'VoidedX // SECURED': 'VoidedX // PROTEGIDO', 'Checking vault…': 'Verificando cofre…', 'Verifying this link against VoidedX Cloud.': 'Verificando este link na nuvem VoidedX.',
        'Vault Not Found': 'Cofre não encontrado', 'This vault ID doesn’t exist or may have been deleted.': 'Este ID de cofre não existe ou pode ter sido excluído.',
        "This vault ID doesn't exist or may have been deleted.": 'Este ID de cofre não existe ou pode ter sido excluído.',
        'Key Required': 'Chave necessária', 'This vault is protected by a key.': 'Este cofre é protegido por uma chave.', 'ENTER KEY': 'DIGITE A CHAVE',
        'Enter access key': 'Digite a chave de acesso', 'Unlock': 'Desbloquear', 'Don’t have a key? Get one here': 'Não tem uma chave? Obtenha aqui',
        "Don't have a key? Get one here": 'Não tem uma chave? Obtenha aqui', 'SECURED!': 'PROTEGIDO!', 'This script is protected by': 'Este script é protegido pelo',
        'VoidedX Vault': 'Cofre VoidedX', 'Source Hidden': 'Código oculto', 'Vault': 'Cofre', 'Key Verified': 'Chave verificada', 'Copy Loadstring:': 'Copiar Loadstring:',

        'Language': 'Idioma', 'English': 'English', 'Português (Brasil)': 'Português (Brasil)',
        'Dismiss announcement': 'Dispensar aviso', 'Close': 'Fechar', 'Open popup': 'Abrir janela', 'Off:': 'Desativado:',
        'VoidedX update': 'Atualização do VoidedX', 'Untitled Vault': 'Cofre sem título', 'Main Key': 'Chave principal',
        'This key has expired.': 'Esta chave expirou.', 'Permanent — never expires on its own.': 'Permanente — não expira automaticamente.',
        'TERMINATED — this key no longer works until reactivated.': 'ENCERRADA — esta chave não funciona até ser reativada.',
        'TERMINATED — this key no longer works until regenerated.': 'ENCERRADA — esta chave não funciona até ser gerada novamente.',
        'No key generated yet — the first visitor to use the Get-Key link creates one.': 'Nenhuma chave foi gerada — o primeiro visitante do link para obter chave criará uma.',
        'Current key is permanent — never expires on its own.': 'A chave atual é permanente — não expira automaticamente.',
        'Enable Public Key': 'Ativar chave pública', 'Custom link enabled: each valid one-time return ticket issues a separate key. Your link service must preserve the ticket and redirect it to the reward URL template; the ticket prevents replay but cannot independently prove an external task was completed.': 'Link personalizado ativado: cada ticket válido de retorno de uso único emite uma chave separada. Seu serviço de links deve preservar o ticket e redirecioná-lo para o modelo de URL de recompensa; o ticket impede a repetição, mas não comprova por si só a conclusão de uma tarefa externa.',
        'No vault ID was given in the link.': 'O link não contém um ID de cofre.', 'Force regenerate the public key?': 'Gerar novamente a chave pública?',
        'The current public key stops working immediately. The next visitor gets a new one.': 'A chave pública atual para de funcionar imediatamente. O próximo visitante receberá uma nova.',
        'Regenerate this key?': 'Gerar esta chave novamente?', 'The old key stops working once you Apply.': 'A chave antiga para de funcionar quando você aplicar as alterações.',
        'Terminate this key?': 'Encerrar esta chave?', 'Delete this key?': 'Excluir esta chave?', 'Terminate': 'Encerrar',
        'Your upload will be checked by a moderator before it goes live.': 'Um moderador revisará seu envio antes da publicação.',
        'Get-Key link copied.': 'Link para obter chave copiado.', 'One-time reward URL template copied.': 'Modelo de URL de recompensa de uso único copiado.',
        'You have unsaved changes. Discard them and open this vault?': 'Há alterações não salvas. Descartá-las e abrir este cofre?',
        'Could not open this vault source:': 'Não foi possível abrir o código-fonte deste cofre:',
        'This vault has an older Luau obfuscation copy. Save it again to regenerate with the current profile.': 'Este cofre tem uma versão antiga do código Luau ofuscado. Salve novamente para gerar uma versão com o perfil atual.',
        'This unused vault reached its 10-hour limit. Save your edits or download a backup before leaving it.': 'Este cofre sem uso atingiu o limite de 10 horas. Salve suas alterações ou baixe um backup antes de sair.',
        'Click': 'Clique em', 'Main navigation': 'Navegação principal',
        'Invalid email or password.': 'E-mail ou senha inválidos.', 'Something went wrong. Please try again.': 'Algo deu errado. Tente novamente.',
        'Saved successfully.': 'Salvo com sucesso.', 'Copied to clipboard.': 'Copiado para a área de transferência.',
        'Failed to copy.': 'Não foi possível copiar.', 'Please try again.': 'Tente novamente.', 'No results found.': 'Nenhum resultado encontrado.',
        'Network error. Please try again.': 'Erro de conexão. Tente novamente.', 'Please enter a valid email address.': 'Digite um endereço de e-mail válido.',
        'Please enter your password.': 'Digite sua senha.', 'Password must be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
        'Session expired. Please sign in again.': 'Sua sessão expirou. Entre novamente.', 'Changes saved.': 'Alterações salvas.',
        'Failed to save changes.': 'Não foi possível salvar as alterações.', 'Are you sure?': 'Tem certeza?', 'Copied!': 'Copiado!',
        'Saved!': 'Salvo!', 'Loading…': 'Carregando…', 'Please wait…': 'Aguarde…', 'Unknown error': 'Erro desconhecido',
        'No vaults found. Create one!': 'Nenhum cofre encontrado. Crie um!', 'No vaults match that search.': 'Nenhum cofre corresponde à pesquisa.',
        'Loading vaults...': 'Carregando cofres...', 'Community shared script.': 'Script compartilhado pela comunidade.',
        'Log out': 'Sair', 'Logout': 'Sair', 'Logged out.': 'Sessão encerrada.', 'Signed in with Google. If you have guest vaults from before, recover them with their vault ID.': 'Você entrou com o Google. Se tiver cofres de visitante antigos, recupere-os usando o ID do cofre.',
        'You’re signed in with Google.': 'Você entrou com o Google.', 'Account created — you’re logged in!': 'Conta criada — você entrou!',
        'Account created. Welcome to the community!': 'Conta criada. Boas-vindas à comunidade!', 'You are signed in.': 'Você entrou.',
        'You are signed out.': 'Você saiu.', 'This email already has an account. You are on Log In now—use the same sign-in method you used before.': 'Este e-mail já tem uma conta. Você está na tela de acesso — use o mesmo método de entrada de antes.',
        'Could not sign in. Check your connection and try again.': 'Não foi possível entrar. Verifique sua conexão e tente novamente.',
        'Enter a valid email address.': 'Digite um endereço de e-mail válido.', 'Use a password with at least 6 characters.': 'Use uma senha com pelo menos 6 caracteres.',
        'Enter your password.': 'Digite sua senha.', 'Sign in with an account to continue.': 'Entre com uma conta para continuar.',
        'Create your account': 'Crie sua conta', 'Create an account to share with the community.': 'Crie uma conta para compartilhar com a comunidade.',
        'Opening Google…': 'Abrindo o Google…', 'Unsaved changes': 'Alterações não salvas', 'ON': 'ATIVADO',
        'OFF · Disabled': 'DESATIVADO', 'You have unsaved changes. Discard them and open this vault?': 'Há alterações não salvas. Descartá-las e abrir este cofre?',
        'This unused vault reached its 10-hour limit. Save your edits or download a backup before leaving it.': 'Este cofre sem uso atingiu o limite de 10 horas. Salve suas alterações ou baixe um backup antes de sair.',
        'No keys yet — add one below.': 'Ainda não há chaves — adicione uma abaixo.', 'No one has used this key yet.': 'Ninguém usou esta chave ainda.',
        'No one is banned from this vault.': 'Ninguém está bloqueado neste cofre.', 'Random key generated.': 'Chave aleatória gerada.',
        'Timer restarted from now — click "Apply Changes" to confirm.': 'O prazo foi reiniciado — clique em "Aplicar alterações" para confirmar.',
        'New key generated — click "Apply Changes" to confirm it.': 'Nova chave gerada — clique em "Aplicar alterações" para confirmá-la.',
        'Key reactivated — click "Apply Changes" to confirm.': 'Chave reativada — clique em "Aplicar alterações" para confirmar.',
        'Key terminated — click "Apply Changes" to confirm.': 'Chave encerrada — clique em "Aplicar alterações" para confirmar.',
        'Key removed — click "Apply Changes" to confirm.': 'Chave removida — clique em "Aplicar alterações" para confirmar.',
        'Public key cleared — a new one will be generated on next visit.': 'Chave pública removida — uma nova será gerada na próxima visita.',
        'No public key exists yet to terminate.': 'Ainda não há chave pública para encerrar.', 'Public key terminated.': 'Chave pública encerrada.',
        'Public key reactivated.': 'Chave pública reativada.', 'Enter a Roblox UserId to ban.': 'Digite um UserId Roblox para bloquear.',
        'User banned.': 'Usuário bloqueado.', 'User unbanned.': 'Bloqueio do usuário removido.', 'Bound IP reset.': 'IP vinculado redefinido.',
        'Get-Key link copied.': 'Link para obter chave copiado.', 'One-time reward URL template copied.': 'Modelo de URL de recompensa de uso único copiado.',
        'Key settings updated!': 'Configurações de chave atualizadas!', 'Add a private key or enable the Public Key, or turn the key system off.': 'Adicione uma chave privada, ative a chave pública ou desative o sistema de chaves.',
        'One of your keys is empty — fill it in or delete that key.': 'Uma das suas chaves está vazia — preencha-a ou exclua-a.',
        'Use a safe HTTPS custom link. Local, unsafe, adult-content, and blocked domains are not allowed.': 'Use um link HTTPS seguro. Links locais, inseguros, de conteúdo adulto ou de domínios bloqueados não são permitidos.',
        'No vault ID was given in the link.': 'O link não contém um ID de cofre.', 'Access denied — this vault belongs to a different account.': 'Acesso negado — este cofre pertence a outra conta.',
        'Apply Changes': 'Aplicar alterações', 'Applying...': 'Aplicando...', 'Failed to update key settings:': 'Falha ao atualizar as configurações de chave:',
        'This upload is still being reviewed.': 'Este envio ainda está em revisão.', 'Script submitted. It will appear after a moderator approves it.': 'Script enviado. Ele aparecerá quando um moderador o aprovar.',
        'Added to your saved scripts.': 'Adicionado aos seus scripts salvos.', 'Removed from your saved scripts.': 'Removido dos seus scripts salvos.',
        'This script is not available right now.': 'Este script não está disponível no momento.', 'Script copied to clipboard.': 'Script copiado para a área de transferência.',
        'Press Ctrl+C to copy the selected script.': 'Pressione Ctrl+C para copiar o script selecionado.', 'Script downloaded as a text file.': 'Script baixado como arquivo de texto.',
        'Script link copied to clipboard.': 'Link do script copiado.', 'Could not share the link. You can copy it from the browser address bar.': 'Não foi possível compartilhar o link. Você pode copiá-lo pela barra de endereço do navegador.',
        'Your upload was removed.': 'Seu envio foi removido.', 'This vault doesn’t exist or may have been deleted.': 'Este cofre não existe ou pode ter sido excluído.',
        'This vault doesn\'t exist or may have been deleted.': 'Este cofre não existe ou pode ter sido excluído.', 'Failed to copy': 'Falha ao copiar',
        'Live': 'Publicado', 'Not approved': 'Não aprovado', 'Hidden by moderator': 'Oculto pelo moderador', 'In review': 'Em revisão',
        'View script': 'Ver script', 'Remove saved script': 'Remover dos salvos', 'Save script': 'Salvar script', 'Remove upload': 'Remover envio', 'Like script': 'Curtir script',
        'Dismiss': 'Dispensar', 'Likes': 'Curtidas', 'Views': 'Visualizações', 'Downloads': 'Downloads', 'Reactivate': 'Reativar',
        'No vaults match that search.': 'Nenhum cofre corresponde à pesquisa.', 'Create one!': 'Crie um!',
        'This vault is not available.': 'Este cofre não está disponível.', 'Vault saved!': 'Cofre salvo!', 'Could not save the vault.': 'Não foi possível salvar o cofre.',
        'No vault ID was provided in the link.': 'O link não contém um ID de cofre.', 'This vault could not be loaded.': 'Não foi possível carregar este cofre.',
        'Something went wrong loading this vault.': 'Algo deu errado ao carregar este cofre.',
        "This vault doesn't use a key system — no key is needed to run it.": 'Este cofre não usa um sistema de chaves — não é necessária uma chave para executá-lo.',
        "This vault's keys are private/whitelist-only. Contact the owner directly.": 'As chaves deste cofre são privadas ou permitidas por lista. Entre em contato diretamente com o proprietário.',
        'This key has been terminated by the owner.': 'Esta chave foi encerrada pelo proprietário.', 'Enter the access key.': 'Digite a chave de acesso.',
        'Custom link opened. Finish it and return here using its reward URL.': 'Link personalizado aberto. Conclua a etapa e volte usando a URL de recompensa.',
        'Complete the custom link, then return through its one-time reward URL. The ticket expires after 20 minutes.': 'Conclua o link personalizado e volte pela URL de recompensa de uso único. O ticket expira em 20 minutos.',
        'The owner’s custom link is blocked or invalid. Please contact the owner.': 'O link personalizado do proprietário foi bloqueado ou é inválido. Entre em contato com o proprietário.',
        'The owner\'s custom link is blocked or invalid. Please contact the owner.': 'O link personalizado do proprietário foi bloqueado ou é inválido. Entre em contato com o proprietário.',
        'Checking one-time ticket…': 'Verificando ticket de uso único…', 'Getting your key…': 'Obtendo sua chave…', 'Almost there…': 'Quase lá…',
        'Public Key': 'Chave pública', 'Get Your Key —': 'Obtenha sua chave —', ' is protected by a key.': ' é protegido por uma chave.', ' is protected by ': ' é protegido por ',
        'Loadstring copied to clipboard.': 'Loadstring copiado para a área de transferência.', 'Key copied to clipboard.': 'Chave copiada para a área de transferência.',
        'Quick check skipped': 'Verificação rápida ignorada', 'Quick checks are limited to 100 KiB so large files stay responsive.': 'As verificações rápidas são limitadas a 100 KiB para manter arquivos grandes responsivos.',
        'The script is still available to save and obfuscate.': 'O script continua disponível para salvar e ofuscar.',
        'Code changed since the last check. Select “Check code” to refresh these results.': 'O código mudou desde a última verificação. Selecione “Verificar código” para atualizar os resultados.',
        'PREPARING...': 'PREPARANDO...', 'SAVING...': 'SALVANDO...', 'DELETING...': 'EXCLUINDO...', 'SENDING...': 'ENVIANDO...', 'OBFUSCATING': 'OFUSCANDO',
        'There are no reported public scripts.': 'Não há scripts públicos denunciados.', 'There are no scripts waiting for review.': 'Não há scripts aguardando revisão.',
        'Published': 'Publicado', 'Reviewed': 'Revisado', 'New': 'Novo', 'Reopen': 'Reabrir', 'Mark reviewed': 'Marcar como revisado',
        'Approve': 'Aprovar', 'Reject': 'Rejeitar', 'Hide from library': 'Ocultar da biblioteca', 'Review source code': 'Revisar código-fonte',
        'No description': 'Sem descrição', '(No description)': '(Sem descrição)', '(Empty suggestion)': '(Sugestão vazia)', '(No source code)': '(Sem código-fonte)',
        'Untitled Vault': 'Cofre sem título',
        '1 error': '1 erro', 'errors': 'erros', 'warning': 'aviso', 'warnings': 'avisos', 'report': 'denúncia', 'reports': 'denúncias'
    };

    let language = 'en';
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'pt-BR') language = saved;
    } catch (_) { /* Storage may be disabled; the page still works in English. */ }

    const originalText = new WeakMap();
    const lastText = new WeakMap();
    const originalAttrs = new WeakMap();
    const lastAttrs = new WeakMap();
    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'PRE', 'CODE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SVG', 'CANVAS']);
    const ignoredContentSelector = '#site-announcement-title, #site-announcement-message, #announcement-preview-title, #announcement-preview-message, .vault-item-title, .script-card h3, .script-card-description, .script-card-game, .script-card-author, .script-author-copy, #detail-title, #detail-description, #detail-author, #detail-game, #ks-vault-title, #gui-preview-vault-name, #keyprompt-title strong, #getkey-title span, #secured-title strong:first-child, .admin-idea-header, .admin-idea-card > p, .admin-script-review-heading, .admin-script-review-item > p, .manage-user-name, .manage-user-meta';

    function normalize(value) { return String(value).replace(/\s+/g, ' ').trim(); }
    function translated(value) {
        if (language !== 'pt-BR') return value;
        const parts = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
        const leading = parts ? parts[1] : '';
        const source = parts ? parts[2] : String(value);
        const trailing = parts ? parts[3] : '';
        const key = normalize(source);
        if (Object.prototype.hasOwnProperty.call(translations, key)) return leading + translations[key] + trailing;
        let match = key.match(/^(\d+)\s+(error|errors|warning|warnings|report|reports)$/i);
        if (match) {
            const n = Number(match[1]);
            const word = /error/i.test(match[2]) ? (n === 1 ? 'erro' : 'erros') : /warning/i.test(match[2]) ? (n === 1 ? 'aviso' : 'avisos') : (n === 1 ? 'denúncia' : 'denúncias');
            return `${leading}${match[1]} ${word}${trailing}`;
        }
        match = key.match(/^Please wait (\d+)s…$/);
        if (match) return `${leading}Aguarde ${match[1]}s…${trailing}`;
        match = key.match(/^Expires in (.+)\.$/);
        if (match) return `${leading}Expira em ${match[1]}.${trailing}`;
        match = key.match(/^Current key expires in (.+)\.$/);
        if (match) return `${leading}A chave atual expira em ${match[1]}.${trailing}`;
        match = key.match(/^Current loader expires in (\d+)s · refreshing automatically$/);
        if (match) return `${leading}O carregador atual expira em ${match[1]}s · atualização automática${trailing}`;
        match = key.match(/^Locked to IP: (.+)$/);
        if (match) return `${leading}Vinculada ao IP: ${match[1]}${trailing}`;
        match = key.match(/^Vault: (.+)$/);
        if (match) return `${leading}Cofre: ${match[1]}${trailing}`;
        match = key.match(/^(\d+) looks$/);
        if (match) return `${leading}${match[1]} estilos${trailing}`;
        match = key.match(/^ON · (\d+) keys?$/);
        if (match) return `${leading}ATIVADO · ${match[1]} ${Number(match[1]) === 1 ? 'chave' : 'chaves'}${trailing}`;
        match = key.match(/^(\d+) errors?(?: · (\d+) warnings?)?(?: · (\d+) suggestions?)?$/i);
        if (match) {
            const parts = [`${match[1]} ${Number(match[1]) === 1 ? 'erro' : 'erros'}`];
            if (match[2]) parts.push(`${match[2]} ${Number(match[2]) === 1 ? 'aviso' : 'avisos'}`);
            if (match[3]) parts.push(`${match[3]} ${Number(match[3]) === 1 ? 'sugestão' : 'sugestões'}`);
            return `${leading}${parts.join(' · ')}${trailing}`;
        }
        match = key.match(/^Showing “(.+)” from your vault\. This is the saved Luau source, not the website’s index\.html\.$/);
        if (match) return `${leading}Exibindo “${match[1]}” do seu cofre. Este é o código-fonte Luau salvo, não o index.html do site.${trailing}`;
        match = key.match(/^Loaded "(.+)" into the editor\.$/);
        if (match) return `${leading}“${match[1]}” carregado no editor.${trailing}`;
        match = key.match(/^Error loading vaults: (.+)$/);
        if (match) return `${leading}Erro ao carregar cofres: ${match[1]}${trailing}`;
        return value;
    }
    function isIgnored(node) {
        for (let el = node.parentElement; el; el = el.parentElement) {
            if (ignoredTags.has(el.tagName) || el.isContentEditable || el.hasAttribute('data-no-translate') || el.matches(ignoredContentSelector)) return true;
        }
        return false;
    }
    function applyText(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE || isIgnored(node)) return;
        const current = node.nodeValue;
        const previousApplied = lastText.get(node);
        if (!originalText.has(node) || (previousApplied !== undefined && current !== previousApplied)) originalText.set(node, current);
        const source = originalText.get(node);
        const replacement = translated(source);
        if (replacement !== current) {
            node.nodeValue = replacement;
            lastText.set(node, replacement);
        } else lastText.set(node, current);
    }
    function applyAttribute(element, name) {
        if (element.hasAttribute('data-no-translate')) return;
        const current = element.getAttribute(name);
        if (current === null) return;
        let originals = originalAttrs.get(element);
        let applied = lastAttrs.get(element);
        if (!originals) { originals = new Map(); originalAttrs.set(element, originals); }
        if (!applied) { applied = new Map(); lastAttrs.set(element, applied); }
        if (!originals.has(name) || (applied.has(name) && current !== applied.get(name))) originals.set(name, current);
        const replacement = translated(originals.get(name));
        if (replacement !== current) element.setAttribute(name, replacement);
        applied.set(name, replacement);
    }
    function visit(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) { applyText(root); return; }
        if (root.nodeType === Node.ELEMENT_NODE) {
            if (ignoredTags.has(root.tagName) || root.hasAttribute('data-no-translate') || root.isContentEditable || root.matches(ignoredContentSelector)) return;
            for (const name of ['placeholder', 'title', 'aria-label', 'alt']) applyAttribute(root, name);
            if (root.tagName === 'META' && root.getAttribute('name') === 'description') applyAttribute(root, 'content');
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let textNode;
        while ((textNode = walker.nextNode())) applyText(textNode);
        if (root.querySelectorAll) {
            root.querySelectorAll('[placeholder], [title], [aria-label], [alt], meta[name="description"]').forEach(el => {
                if (ignoredTags.has(el.tagName) || el.hasAttribute('data-no-translate') || el.matches(ignoredContentSelector)) return;
                for (const name of ['placeholder', 'title', 'aria-label', 'alt']) applyAttribute(el, name);
                if (el.tagName === 'META' && el.getAttribute('name') === 'description') applyAttribute(el, 'content');
            });
        }
    }
    function buildSwitcher() {
        if (document.querySelector('.site-language-control')) return;
        const control = document.createElement('label');
        control.className = 'site-language-control';
        control.setAttribute('data-no-translate', '');
        control.innerHTML = '<span class="site-language-label">Language</span><select class="site-language-select" aria-label="Language"><option value="en">English</option><option value="pt-BR">Português (Brasil)</option></select>';
        const select = control.querySelector('select');
        select.value = language;
        select.addEventListener('change', () => {
            language = select.value === 'pt-BR' ? 'pt-BR' : 'en';
            try { localStorage.setItem(STORAGE_KEY, language); } catch (_) { /* Keep this choice for the current page. */ }
            updateLanguage();
        });

        const header = document.querySelector('.top-nav, .admin-topbar');
        if (!header) { document.body.prepend(control); return; }
        const actionGroup = header.querySelector('.nav-user, .leaderboard-nav, .scripts-account-actions') || header.querySelector('.scripts-nav-links');
        if (actionGroup) { actionGroup.append(control); return; }
        const backLink = header.querySelector('.admin-back-link, .ks-back-link');
        if (backLink) {
            const actions = document.createElement('div');
            actions.className = 'site-header-actions';
            backLink.replaceWith(actions);
            actions.append(backLink, control);
            return;
        }
        header.append(control);
    }
    function updateLanguage() {
        document.documentElement.lang = language;
        const label = document.querySelector('.site-language-label');
        if (label) label.textContent = language === 'pt-BR' ? 'Idioma' : 'Language';
        if (document.title) {
            if (!document.documentElement.dataset.originalTitle) document.documentElement.dataset.originalTitle = document.title;
            document.title = translated(document.documentElement.dataset.originalTitle);
        }
        visit(document.body);
        document.dispatchEvent(new CustomEvent('voidedx:languagechange', { detail: { language } }));
    }

    function start() {
        buildSwitcher();
        updateLanguage();
        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === 'characterData') applyText(record.target);
                else if (record.type === 'attributes') applyAttribute(record.target, record.attributeName);
                else for (const node of record.addedNodes) visit(node);
            }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt', 'content'] });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
