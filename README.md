# QE-Challenge

> Banking dashboard and transfer platform with LLM integration

## Sobre

Este projeto é um dashboard bancário moderno, com funcionalidades de transferência entre usuários, histórico de transações, integração com métodos de pagamento (PIX, POS, Link, Cartão) e comprovante em PDF. O sistema é integrado a LLM para automação e respostas inteligentes.

## Funcionalidades

- Login de usuário
- Dashboard com saldo e histórico de transações
- Transferência de valores entre contas (PIX, POS, Link, Cartão)
- Geração de comprovante em PDF
- Atualização em tempo real do histórico para pagador e destinatário
- Interface moderna com React, Next.js e TailwindCSS

## Como rodar localmente

```bash
# Instale as dependências
npm install

# Rode o projeto em modo desenvolvimento
npm run dev
```

Acesse em [http://localhost:3000](http://localhost:3000)

## Estrutura de Pastas

```
src/
  app/
    dashboard/      # Página principal do dashboard
    login/          # Página de login
    transfer/       # Página de transferência
    globals.css     # Estilos globais
  services/         # Serviços de API e banco local
  data/             # Dados de usuários (mock)
public/             # Assets, vídeos, imagens, PDF de comprovante
```

## Limpeza e organização

- Arquivos de sistema como `.DS_Store` e pastas vazias foram removidos.
- Não há arquivos duplicados ou não utilizados no repositório.

## Licença

MIT

---

> Feito para o desafio de Engenharia de Qualidade da CloudWalk.
