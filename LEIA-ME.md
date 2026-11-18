# Diário de Bordo (app offline) — v1.1

Aplicativo web (PWA) para usar no celular durante a viagem. Depois de aberto uma vez com internet, funciona **sem sinal**.

## Arquivos (publique todos juntos, mantendo a pasta `icons`)

```
index.html  style.css  data.js  core.js  app.js  modals.js  trips.js
ocr.js  io.js  actions.js  boot.js  manifest.webmanifest  sw.js  icons/ (4 PNG)
```

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
