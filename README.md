# React + TypeScript + Vite

## Locacao Metrics Integrations (Backend)

Para o endpoint `/api/locacao/metrics`, a autenticacao no Imoview e feita automaticamente no backend.

Configure no arquivo `.env`:

```env
IMOVIEW_BASE_URL=https://api.imoview.com.br
IMOVIEW_EMAIL=seu-email
IMOVIEW_SENHA=sua-senha
IMOVIEW_CHAVE=sua-chave-header
```

Notas:

- O backend chama `GET /Usuario/App_ValidarAcesso` e guarda o `codigoacesso` em cache na memoria do processo.
- Se as variaveis nao estiverem configuradas ou a autenticacao falhar, o endpoint retorna as metricas atuais com aviso em `warnings`.

## Deploy no Google Cloud Run com Docker

Este projeto pode ser publicado como um unico servico Cloud Run:

- Frontend React (build Vite) servido pelo FastAPI.
- Backend FastAPI nas rotas `/api/*`.

### 1) Build local da imagem (opcional)

```bash
docker build -t dashboard-metricas-stylus .
docker run --rm -p 8080:8080 dashboard-metricas-stylus
```

### 2) Build da imagem no Google Cloud Build

```bash
gcloud config set project SEU_PROJECT_ID
gcloud builds submit --tag gcr.io/SEU_PROJECT_ID/dashboard-metricas-stylus
```

### 3) Deploy no Cloud Run

```bash
gcloud run deploy dashboard-metricas-stylus \
  --image gcr.io/SEU_PROJECT_ID/dashboard-metricas-stylus \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars IMOVIEW_BASE_URL=https://api.imoview.com.br,IMOVIEW_EMAIL=seu-email,IMOVIEW_SENHA=sua-senha,IMOVIEW_CHAVE=sua-chave-header
```

Observacoes:

- O Cloud Run injeta a variavel `PORT` automaticamente e o container ja respeita isso.
- O frontend usa mesma origem por padrao (sem necessidade de `VITE_API_BASE_URL` em producao).
- Se quiser restringir acesso, remova `--allow-unauthenticated`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
