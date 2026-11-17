# Diário de Bordo — Ushuaia 2027 (app offline)

Aplicativo web (PWA) para usar no celular durante a viagem. Depois de aberto uma vez com internet, funciona **sem sinal**.

## Arquivos (publique todos juntos, mantendo a pasta `icons`)

```
index.html   style.css   data.js   core.js   app.js
manifest.webmanifest   sw.js   icons/ (4 PNG)
```

## Publicar no GitHub Pages

1. Crie uma conta em github.com e um repositório **novo**, ex.: `ushuaia2027` (pode ser público; o app não contém dados pessoais, eles ficam só no celular).
2. Na página do repositório: **Add file ▸ Upload files** e arraste **o conteúdo da pasta `app`** (os arquivos acima e a pasta `icons`, não a pasta `app` em si). Clique em **Commit changes**.
3. **Settings ▸ Pages ▸ Build and deployment**: Source = *Deploy from a branch*, Branch = `main` / `/ (root)` ▸ **Save**.
4. Em 1–2 minutos o endereço aparece: `https://SEU-USUARIO.github.io/ushuaia2027/`.

## Instalar no celular

- **Android (Chrome):** abra o endereço ▸ menu ⋮ ▸ **Instalar app** (ou use o botão em *Mais*).
- **iPhone (Safari):** abra o endereço ▸ Compartilhar ▸ **Adicionar à Tela de Início**. Use sempre o ícone instalado.
- Abra o app **uma vez com internet** e navegue pelas abas. Em *Mais* deve aparecer "✅ Pronto para uso offline".
- Em *Mais*, toque em **Proteger dados contra limpeza do navegador**.

## Atualizar o app depois

Troque os arquivos no GitHub e **aumente `VERSION` em `sw.js`** (ex.: `v1.0.1`). Os celulares mostram "Nova versão disponível ▸ Atualizar" quando abrirem com internet. Os dados da viagem não são apagados.

## Dados e backup

- Tudo é guardado no aparelho (IndexedDB). **Faça backup** em *Mais ▸ Exportar backup* quando tiver sinal (o app avisa se passar de 3 dias).
- Para juntar os dados do grupo: cada um exporta o seu arquivo e os outros usam *Importar ▸ Mesclar*.
- Fotos ficam só no aparelho e não entram no backup.
