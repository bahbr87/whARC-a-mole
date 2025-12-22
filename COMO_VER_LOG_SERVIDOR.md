# 📋 Como Verificar os Logs do Servidor Enquanto Joga

Este guia explica como ver os logs do servidor Next.js para verificar se as transações estão sendo geradas.

## 🖥️ Onde Estão os Logs

Os logs do servidor aparecem no **terminal/console onde você executou `npm run dev`**.

## 📍 Passo a Passo

### 1. Encontre a Janela do Terminal

O servidor Next.js está rodando em uma janela do terminal. Procure por:

- **Terminal do PowerShell** (Windows)
- **Terminal do CMD** (Windows)
- **Terminal integrado do VS Code**
- **Janela do terminal onde você digitou `npm run dev`**

### 2. O Que Você Verá nos Logs

Quando o servidor está rodando, você verá algo como:

```
▲ Next.js 16.0.10
- Local:        http://localhost:3000
- Ready in 2.3s
```

### 3. Quando Você Clicar em um Animal

Ao clicar em um animal no jogo, você verá logs como:

```
📋 Processing click - GameCredits: 0xB6EF..., RPC: https://..., Chain: 5042002
🔐 Relayer address: 0xA6338636D92e024dBC3541524E332F68c5c811a2
🎮 Processing click - Player: 0x..., Clicks: 1
🔍 Authorization check:
   Contract Owner: 0xA633...
   Relayer is Owner: true
   Relayer is Authorized Consumer: true
💰 Balance check - Player: 0x...
   Current credits: 1000
   Required: 1
📤 Sending transaction to blockchain...
⏳ Transaction sent: 0x1234567890abcdef...
   Waiting for confirmation...
✅ TRANSACTION CONFIRMED
   Hash: 0x1234567890abcdef...
   Block: 12345
   Gas used: 50000
```

## 🔍 Se Você Não Encontrar a Janela do Terminal

### Opção 1: Verificar Processos em Execução

No Windows, você pode verificar se o servidor está rodando:

1. Abra o **Gerenciador de Tarefas** (Ctrl + Shift + Esc)
2. Procure por processos chamados `node.exe`
3. Se encontrar, o servidor está rodando

### Opção 2: Reiniciar o Servidor

Se você não encontrar a janela do terminal:

1. **Pare o servidor atual** (se estiver rodando em background)
2. **Abra um novo terminal** na pasta do projeto
3. **Execute**: `npm run dev`
4. **Mantenha essa janela visível** enquanto joga

## 💡 Dica: Usar Dois Monitores ou Janelas

Para facilitar:

1. **Deixe o terminal visível** em uma tela/janela
2. **Jogue na outra tela/janela do navegador**
3. **Observe os logs em tempo real** enquanto joga

## 🎯 O Que Procurar

### ✅ Se Está Funcionando (Transações Reais)

Você verá:
```
✅ TRANSACTION CONFIRMED
   Hash: 0x1234567890abcdef...
   Block: 12345
```

### ⚠️ Se NÃO Está Funcionando (Modo Dev)

Você verá:
```
⚠️  DEV MODE: Simulating credit consumption
```

### ❌ Se Há Erro de Configuração

Você verá:
```
❌ RELAYER ERROR: RELAYER_PRIVATE_KEY not configured
```

ou

```
❌ RELAYER AUTHORIZATION ERROR: Relayer is not authorized
```

## 📸 Exemplo Visual

```
Terminal do Servidor (npm run dev)
┌─────────────────────────────────────────┐
│ ▲ Next.js 16.0.10                       │
│ - Local: http://localhost:3000          │
│                                          │
│ [Quando você clica em um animal:]       │
│                                          │
│ 📋 Processing click...                  │
│ 🔐 Relayer address: 0xA633...           │
│ 📤 Sending transaction...               │
│ ✅ TRANSACTION CONFIRMED                │
│    Hash: 0x1234...                      │
│    Block: 12345                         │
└─────────────────────────────────────────┘
```

## 🚀 Como Testar Agora

1. **Certifique-se de que o servidor está rodando**
   - Se não estiver, execute: `npm run dev`

2. **Mantenha a janela do terminal visível**

3. **Abra o jogo** no navegador: http://localhost:3000

4. **Conecte sua wallet e jogue**

5. **Observe o terminal** - você verá os logs em tempo real

6. **Procure por "✅ TRANSACTION CONFIRMED"** - isso confirma que está funcionando!

## 🔧 Se o Servidor Está Rodando em Background

Se você iniciou o servidor em background e não vê os logs:

1. **Pare o servidor** (se necessário)
2. **Execute novamente** em um terminal visível:
   ```bash
   npm run dev
   ```
3. **Não minimize a janela** - deixe-a visível

## 📝 Resumo

- **Logs aparecem no terminal onde você executou `npm run dev`**
- **Mantenha essa janela visível enquanto joga**
- **Procure por "✅ TRANSACTION CONFIRMED"** para confirmar que está funcionando
- **Cada clique deve gerar uma nova linha de log com o hash da transação**

