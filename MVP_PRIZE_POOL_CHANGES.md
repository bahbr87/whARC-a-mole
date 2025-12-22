# Mudanças para MVP - PrizePool com >= 1 Jogador

## Problema Resolvido
O contrato PrizePool exigia no mínimo 3 jogadores distintos por dia para registrar vencedores, mas o frontend permitia tentar fazer claim mesmo quando esse critério não era atendido.

## Solução Implementada (Opção Recomendada)

### 1. Contrato PrizePool.sol
- **Antes**: Exigia que `first`, `second` e `third` fossem todos endereços não-zero
- **Depois**: 
  - Apenas `first` é obrigatório (deve ser não-zero)
  - `second` e `third` podem ser endereços zero (`0x0000...`) se houver menos de 2 ou 3 jogadores
  - Adicionada validação no `claimPrize` para verificar se o vencedor não é zero address antes de permitir claim

### 2. API register-daily-winners
- **Antes**: Retornava `null` se houver menos de 3 jogadores
- **Depois**: 
  - Retorna vencedores mesmo com 1 ou 2 jogadores
  - Preenche posições faltantes com endereço zero
  - Mensagem de erro atualizada: "At least 1 player is required" (ao invés de "Need at least 3 players")

### 3. Frontend (DailyResultsScreen)
- **Antes**: Validação que exigia 3 jogadores para mostrar botão de registro
- **Depois**: 
  - Permite registro com >= 1 jogador
  - Mostra apenas os prêmios disponíveis baseado no número de jogadores
  - Botão de claim só aparece se o vencedor estiver registrado (não zero address)

## Comportamento Atual

### Cenário 1: 1 Jogador
- 1º lugar: Jogador registrado, pode fazer claim de $20 USDC
- 2º lugar: Zero address (não aparece no ranking)
- 3º lugar: Zero address (não aparece no ranking)

### Cenário 2: 2 Jogadores
- 1º lugar: Jogador registrado, pode fazer claim de $20 USDC
- 2º lugar: Jogador registrado, pode fazer claim de $10 USDC
- 3º lugar: Zero address (não aparece no ranking)

### Cenário 3: 3+ Jogadores
- 1º lugar: Jogador registrado, pode fazer claim de $20 USDC
- 2º lugar: Jogador registrado, pode fazer claim de $10 USDC
- 3º lugar: Jogador registrado, pode fazer claim de $5 USDC

## Validações Mantidas

1. **Contrato**: Ainda valida que primeiro lugar não pode ser zero
2. **Contrato**: Ainda valida que não pode fazer claim se o vencedor for zero address
3. **Frontend**: Ainda verifica se o vencedor está registrado antes de permitir claim
4. **API**: Ainda valida que pelo menos 1 jogador é necessário

## Próximos Passos

1. **Recompilar o contrato** (se necessário):
   ```bash
   npm run compile
   ```

2. **Redeploy do contrato** (se já estava em produção):
   - O contrato precisa ser redeployado com as novas mudanças
   - Ou fazer upgrade se tiver proxy

3. **Testar**:
   - Testar com 1 jogador
   - Testar com 2 jogadores
   - Testar com 3+ jogadores
   - Verificar que claims funcionam corretamente

## Notas

- Esta é uma mudança de regra de negócio, não apenas tratamento de erro
- A solução é adequada para MVP onde pode haver poucos jogadores
- Em produção futura, pode-se considerar manter a regra de 3 jogadores mínimos

