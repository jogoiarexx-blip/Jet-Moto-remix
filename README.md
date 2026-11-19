# Jet Rush · Copa Maré Viva

Corra na Praia dos Ventos, atravesse o Corredor do Coral e dispute a última etapa no Mangue das Engrenagens. A copa soma os pontos das três corridas. Você pode sair entre etapas e retomar no mesmo navegador. Para escolher uma pista diretamente, selecione Corrida rápida, Contra o relógio ou Treino guiado.

## Publicar no GitHub Pages

1. Extraia o ZIP. Envie o conteúdo para a branch `main` do seu repositório. O arquivo `index.html` deve ficar na raiz, ao lado das pastas `css`, `js` e `vendor`.
2. No repositório, abra **Settings → Pages**. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Selecione **main** e **/(root)**. Clique em **Save** e aguarde a publicação. O endereço do jogo aparecerá nessa mesma página.

## Executar no computador

Abra o `index.html` após extrair o pacote. Para testar com um servidor local, execute `python -m http.server 8000` na pasta do arquivo e abra `http://localhost:8000/`. O jogo precisa de WebGL e inclui o Three.js e os recursos gráficos no próprio pacote.

## Controles

Use **W** para acelerar, **S** para frear ou dar ré e **A/D** para virar. As setas também funcionam. Segure **Espaço** nas curvas para fazer drift, use **E** no poste magnético, **F** para uma acrobacia no salto e **Q** para usar um item. **Esc** pausa. No celular, use os controles de toque.

## Estrutura do projeto

| Arquivo | Função |
| --- | --- |
| `index.html` | Garagem, configurações, painel da corrida e diálogos |
| `css/jogo.css` | Layout e estilos de computador e celular |
| `js/circuitos.js` | Traçados, setores, cores e descrições das pistas |
| `js/motos.js` | Modelos das motos, materiais e efeitos gráficos |
| `js/cenarios.js` | Construção das pistas, cenários, iluminação e água |
| `js/corrida.js` | Pilotagem, adversários, itens, tempos e câmeras |
| `js/copa.js` | Pontuação, classificação e progresso do campeonato |
| `js/interface.js` | Menus, teclado, toque e ciclo de renderização |
| `vendor/three.min.js` | Three.js r128 distribuído sob a licença MIT |
