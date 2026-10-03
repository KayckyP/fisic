# WAVELAB — Física de Ondas

Um laboratório virtual interativo para estudar ondas por meio de animações, controles, gráficos e exercícios. O projeto é estático e funciona sem instalação, servidor ou backend.

## Arquivos

- `index.html` — conteúdo e estrutura semântica.
- `style.css` — identidade visual responsiva e acessível.
- `script.js` — simulações em Canvas, calculadora, áudio opcional e progresso local.

## Uso local

Abra `index.html` em um navegador moderno. Os recursos essenciais funcionam sem conexão. A fonte tipográfica pode usar Google Fonts quando houver internet; o navegador usa fontes alternativas se não houver conexão. O áudio é opcional e usa Web Audio API do próprio navegador após o usuário tocar no botão.

## Publicar no GitHub Pages

1. Criar um repositório no GitHub.
2. Enviar todos os arquivos.
3. Acessar **Settings → Pages**.
4. Selecionar a branch principal.
5. Selecionar a pasta `/root` (ou `/(root)`, conforme a interface do GitHub).
6. Salvar.

O arquivo `index.html` está na raiz e todos os caminhos entre os arquivos do projeto são relativos, então o site pode ser servido pelo GitHub Pages.

## Interações incluídas

- Simulações animadas de propagação, pontos do meio, corda e mola.
- Controles de amplitude, comprimento de onda e frequência, com `v = λ · f` e `T = 1/f`.
- Comparação de frequência, gráfico espacial/temporal e visualização da pressão sonora.
- Tom opcional sintetizado localmente pelo navegador.
- Regiões interativas do espectro eletromagnético e cartões de fenômenos cotidianos.
- Calculadora com resolução passo a passo e 14 questões progressivas.
- Progresso guardado no `localStorage` do navegador, sem conta.

## Precisão e limitações didáticas

Os valores do espectro são aproximados e os limites entre regiões dependem da convenção adotada. A velocidade `v = λf` é calculada no modelo de onda periódica mostrado; em um meio real, a velocidade pode depender das propriedades do meio. A representação das ondas na superfície da água é uma visualização simplificada.
