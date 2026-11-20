# DiBordo — seu diário de bordo, com ou sem sinal (v1.2)

Marca: nome **DiBordo**, cores #253021 (verde-oliva), #E6A817 (âmbar), #F2F4F1; fontes sugeridas Montserrat/Outfit (títulos) e Inter (textos). Arquivos de referência da identidade visual em `marca/` (não precisam ir para o GitHub).

Ao atualizar: suba também `icons/` (4 ícones novos) e `manifest.webmanifest`. Quem já instalou o app antigo deve desinstalar e instalar de novo para ver o novo nome e ícone.

Aplicativo web (PWA) para usar no celular durante a viagem. Depois de aberto uma vez com internet, funciona **sem sinal**.

## Arquivos (publique todos juntos, mantendo a pasta `icons`)

```
index.html  style.css  data.js  core.js  app.js  modals.js  trips.js
license.js  routes.js  ocr.js  io.js  actions.js  boot.js
manifest.webmanifest  sw.js  icons/ (4 PNG)
```
Novos na v1.3: `license.js` (planos e ativação) e `routes.js` (roteiros prontos). A pasta `marca/` e a pasta `licencas/` (fora de `app`) **não** vão para o GitHub.

## Planos (v1.3)

- **Gratuito:** começa sem roteiro; 1 roteiro pronto (Estrada Real); até 3 viagens; grupo de até 5 pessoas; 5 leituras por foto por mês.
- **Pro (R$ 49,00 por ano):** 3 roteiros prontos (Ushuaia, Estrada Real, Jalapão), viagens e grupo sem limite, leitura por foto sem limite. Teste grátis de 14 dias.
- **Organizador:** o código existe e hoje libera o mesmo que o Pro; as vantagens próprias ainda serão definidas.
- Dados nunca são apagados quando o plano vence: só impede criar além do limite gratuito.

### Gerar códigos de ativação (só no seu computador)

Na pasta `licencas/` (fora do GitHub), em um PowerShell:

```
.\gerar-licenca.ps1 -Plano pro -Dias 365 -Nome "Maria"
```

O código sai em `licencas\codigo-XXXXXX.txt` e o registro em `emitidas.csv`. O cliente cola o código em *Mais ▸ Plano ▸ Ver planos e ativar código*; a conferência é feita no aparelho, sem internet.
**Guarde uma cópia segura de `licencas/chave-privada.txt`.** Quem a tiver emite códigos; se for perdida, não dá para emitir códigos que o app aceite, e trocar a chave exige publicar outra versão do app.
Para vender, preencha `BUY_URL` em `license.js` com o link de compra.

Novos na v1.1: `modals.js`, `trips.js`, `ocr.js`, `io.js`, `actions.js`, `boot.js`. Alterados: `index.html`, `style.css`, `data.js`, `core.js`, `app.js`, `sw.js`.

## Publicar / atualizar no GitHub Pages

1. No repositório: **Add file ▸ Upload files**, arraste o **conteúdo** da pasta `app` (não a pasta em si) e **Commit changes**.
2. **Settings ▸ Pages**: Source = *Deploy from a branch*, `main` / `/ (root)`.
3. Para atualizar, troque os arquivos e **aumente `VERSION` em `sw.js`**. Os celulares mostram "Nova versão disponível ▸ Atualizar". Os dados não são apagados.

## Instalar no celular

- **Android (Chrome):** menu ⋮ ▸ **Instalar app**. **iPhone (Safari):** Compartilhar ▸ **Adicionar à Tela de Início**.
- Abra uma vez com internet; em *Mais* deve aparecer "Pronto para uso offline". Toque em **Proteger dados contra limpeza**.

## Novidades da v1.1

- **Foto do cupom fiscal / painel da moto** (📷 no gasto): lê total, litros e odômetro; você sempre confirma tocando no valor sugerido. Funciona com internet; para funcionar **sem internet**, copie para `vendor/tesseract/` os arquivos `tesseract.min.js`, `worker.min.js`, `core/tesseract-core-simd-lstm.wasm.js`, `core/tesseract-core-lstm.wasm.js` e `lang/eng.traineddata.gz` (pacote tesseract.js 5.1.1 / tesseract.js-core 5 / dados "eng") e suba a pasta ao GitHub. Digitar à mão sempre funciona.
- **Modo da viagem** (Mais): moto, carro, a pé (passagens) ou bicicleta. Combustível e veículos só aparecem para moto/carro.
- **Troca de óleo e filtro**: no cadastro do veículo informe a cada quantos km e o km da última troca; o app alerta e indica o dia previsto.
- **Odômetro**: o fim do dia anterior já aparece no início do seguinte; ao registrar a chegada informe a cidade, que vira a saída do dia seguinte.
- **Abastecimento**: mostra na hora o consumo (km/L) do trecho (tanque cheio a tanque cheio).
- **🔀 Replanejar**: em qualquer dia, informe o novo caminho até o destino final, dia a dia (dá para desfazer).
- **Novas viagens** (toque no título): defina início, fim, datas, dias de permanência e atrações; o app monta os dias e abre a rota completa no Google Maps. Sem internet os km não são calculados: digite-os ou consulte o Maps.

## Dados e backup

- Tudo fica no aparelho. **Exporte backup** em *Mais* quando tiver sinal. Para juntar dados do grupo: *Importar ▸ Mesclar*. Fotos não entram no backup.
