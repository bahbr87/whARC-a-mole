/**
 * Script de Diagnóstico para Problemas no Ranking
 * 
 * Este script analisa todos os pontos críticos do sistema de ranking:
 * 1. Layout da tabela
 * 2. Lógica do botão de claim
 * 3. Fluxo de dados da API
 * 4. Estados do componente
 */

interface DiagnosticResult {
  section: string
  issue: string
  severity: 'critical' | 'warning' | 'info'
  details: string
  solution?: string
}

const diagnostics: DiagnosticResult[] = []

// 1. Verificar estrutura da tabela
diagnostics.push({
  section: 'Layout da Tabela',
  issue: 'Estrutura HTML da tabela',
  severity: 'info',
  details: `
    A tabela deve ter:
    - <table className="w-full"> (OK)
    - <thead> com <tr> e <th> (OK)
    - <tbody> com <tr> e <td> (OK)
    - Classes CSS: px-4 py-3 para padding (OK)
    - Classes CSS: text-left, text-right, text-center para alinhamento (OK)
    
    PROBLEMA POTENCIAL:
    - Se o layout está bagunçado, pode ser:
      1. CSS não está sendo aplicado corretamente
      2. Overflow horizontal não está sendo tratado
      3. Classes do Tailwind não estão sendo compiladas
      4. Conflito com outros estilos CSS
  `,
  solution: `
    1. Verificar se o container tem overflow-x-auto
    2. Verificar se as classes Tailwind estão sendo compiladas
    3. Adicionar min-width nas colunas se necessário
    4. Verificar se há CSS global conflitante
  `
})

// 2. Verificar lógica do canClaim
diagnostics.push({
  section: 'Lógica do Claim Button',
  issue: 'Função canClaim não está retornando true quando deveria',
  severity: 'critical',
  details: `
    A função canClaim verifica:
    1. isPastDay: selectedDay < todayDay
    2. currentPlayerLower !== ''
    3. rowPlayerLower !== ''
    4. rowPlayerLower === currentPlayerLower
    5. rank <= 3
    6. !claimedRanks.includes(rank)
    
    PROBLEMAS POTENCIAIS:
    - currentPlayer pode estar undefined ou vazio
    - rowPlayer pode não corresponder ao currentPlayer (case sensitivity)
    - selectedDay pode não estar sendo calculado corretamente
    - claimedRanks pode estar incluindo o rank incorretamente
    - rank pode estar sendo calculado incorretamente (paginação)
  `,
  solution: `
    1. Adicionar logs detalhados em cada verificação
    2. Verificar se currentPlayer está sendo passado corretamente
    3. Garantir que ambos os endereços estão em lowercase
    4. Verificar cálculo do selectedDay
    5. Verificar cálculo do rank com paginação
  `
})

// 3. Verificar fluxo de dados
diagnostics.push({
  section: 'Fluxo de Dados',
  issue: 'Dados podem não estar chegando corretamente da API',
  severity: 'warning',
  details: `
    Fluxo esperado:
    1. loadRanking(date) é chamado
    2. Fetch para /api/rankings?day=${selectedDay}
    3. setRanking(data.ranking || [])
    4. Fetch para /api/claimPrize?day=${selectedDay}
    5. setClaims(claimsData.claims || [])
    6. setClaimedRanks(claimsData.claims.map(c => c.rank))
    
    PROBLEMAS POTENCIAIS:
    - API pode retornar estrutura diferente
    - data.ranking pode ser undefined
    - claimsData.claims pode não ter o formato esperado
    - claimedRanks pode não estar sendo atualizado corretamente
  `,
  solution: `
    1. Adicionar logs em cada etapa do fetch
    2. Verificar estrutura da resposta da API
    3. Validar dados antes de setar no estado
    4. Adicionar tratamento de erro mais robusto
  `
})

// 4. Verificar estados do componente
diagnostics.push({
  section: 'Estados do Componente',
  issue: 'Estados podem não estar sincronizados',
  severity: 'warning',
  details: `
    Estados críticos:
    - ranking: RankingEntry[]
    - claims: ClaimData[]
    - claimedRanks: number[]
    - displayDate: string
    - currentPlayer: string
    
    PROBLEMAS POTENCIAIS:
    - displayDate pode não estar atualizado quando canClaim é chamado
    - claimedRanks pode não estar sincronizado com claims
    - currentPlayer pode estar undefined
    - ranking pode estar vazio mesmo com dados na API
  `,
  solution: `
    1. Adicionar logs quando estados mudam
    2. Verificar dependências dos useCallback
    3. Garantir que estados são atualizados na ordem correta
    4. Adicionar validação de estados antes de usar
  `
})

console.log('=== DIAGNÓSTICO DE PROBLEMAS NO RANKING ===\n')
diagnostics.forEach((diag, index) => {
  console.log(`${index + 1}. [${diag.severity.toUpperCase()}] ${diag.section}: ${diag.issue}`)
  console.log(`   Detalhes: ${diag.details}`)
  if (diag.solution) {
    console.log(`   Solução: ${diag.solution}`)
  }
  console.log('')
})

export default diagnostics

