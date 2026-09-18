# Crescimento e Capacidade — previsão automática

Acesse **Dashboards → Crescimento e Capacidade** e selecione um cluster Kubernetes,
OpenShift ou EKS. A página sempre consulta os últimos **12 meses de calendário**,
encerrando antes do dia UTC em andamento. Filtros globais de período, resolução,
namespace, workload e auto-refresh não alteram esta janela.

Não há taxa de crescimento, horizonte ou coeficientes para o usuário informar.
As previsões são diárias para **90 dias**, com resumos em **30/60/90 dias**.
A atualização é feita ao selecionar outro cluster ou clicar em Atualizar análise.

## Modelos pesquisados e decisão

| Modelo | Característica | Adequação à implementação |
| --- | --- | --- |
| Holt-Winters / ETS | Modela nível, tendência e sazonalidade com suavização exponencial. | Alternativa estabelecida; exigiria implementar ou operar um motor estatístico adicional. |
| Prophet | Modela tendência e sazonalidades, com diagnóstico por cortes temporais. | Útil para incorporar eventos e regressores; exigiria um serviço Python/R para este app. |
| Forecast nativo Dynatrace | Escolha automática entre previsão sazonal por amostragem e extrapolação linear; fornece limites de previsão. | Selecionado: disponível no tenant e acessível pelo SDK já presente. |

Fontes primárias consultadas:

- [Dynatrace: metodologia de previsão](https://docs.dynatrace.com/docs/dynatrace-intelligence/reference/ai-models/forecast-analysis)
- [Hyndman e Athanasopoulos: Holt-Winters](https://otexts.com/fpp3/holt-winters.html)
- [Prophet: diagnósticos e validação](https://facebook.github.io/prophet/docs/diagnostics.html)
- [Validação temporal com origens móveis](https://otexts.com/fpp3/tscv.html)
- [SDK do analisador](https://developer.dynatrace.com/develop/sdks/client-davis-analyzers/)

O app usa `dt.statistics.GenericForecastAnalyzer`, 200 trajetórias, cobertura-alvo
90%, horizonte 90 e offset zero (dias parciais já foram removidos). A escolha
interna do modelo é automática. Não se afirma que o modelo escolhido foi ETS ou
Prophet; esses foram alternativas pesquisadas.

## Dados e escopo

- Throughput: `sum(dt.service.request.count, rate: 1s)` filtrado por `k8s.cluster.name`.
  São chamadas a serviços, incluindo internas; não usuários únicos/acessos externos.
- Resposta: `avg(dt.service.request.response_time)` no mesmo cluster, de µs para ms.
- CPU e memória: reutilizam `clusterCpuCapacity` e `clusterMemoryCapacity`.
  Uso vem de `dt.containers.*`; alocável e requests de `builtin:kubernetes.node.*`
  via Classic. CPU em millicores; memória é RSS em bytes.
- Histórico e treinamento recebem os mesmos dados diários. A série completa é
  enviada ao analisador como `data record` DQL, sem uma nova busca de métricas.
- CPU, memória, throughput e resposta são previstos **independentemente**. Ausência
  de um sinal de serviço não impede prever recursos disponíveis.

O histórico permanece anual mesmo se houver retenção insuficiente. Lacunas são
`null`, não zero. Cada sinal exige cobertura de 80%, pelo menos 180 observações,
dados no primeiro mês, 24 observações nos últimos 30 dias e o último dia completo.
Se não atender, a página informa a cobertura e o motivo, sem reduzir silenciosamente
a janela. A variação anual compara as médias dos primeiros e últimos 30 dias,
exigindo 24 observações em cada janela.

## Validação e capacidade

Uma execução adicional de cada sinal reserva os últimos 28 dias como teste.
O modelo recebe somente os dias anteriores e prevê esse período. A página mostra:

- WAPE: soma dos erros absolutos / soma dos valores reais × 100.
- Cobertura empírica: proporção dos dias reais dentro da faixa de previsão.
- MAE é calculado; WAPE fica indefinido se todos os valores reais forem zero.

É um teste temporal com uma origem, não uma validação cruzada de múltiplas origens.
A qualidade em 28 dias não garante precisão em 90 dias. WAPE acima de 30% ou
cobertura abaixo de 70% geram aviso. Falhas no teste são explícitas e não invalidam
silenciosamente a previsão principal. Saída `INVALID`, incompleta ou desalinhada
do analisador não é usada para calcular capacidade.

A previsão de uso absoluto é comparada à capacidade alocável do último dia
completo. Essa capacidade fica **fixa**, para responder quando a infraestrutura
atual pode ficar insuficiente. São mostradas as primeiras datas de cruzamento:

- 80%: margem fixa de planejamento, sem campo de configuração.
- 100%: capacidade alocável, pela previsão central.
- 100% pela faixa superior: risco possível, separado da previsão central.

Capacidade ausente/zero não vira folga infinita. Limite já ultrapassado aparece
como atingido na base atual. Não se extrapola uma data além dos 90 dias.

## Limitações

A agregação diária não dimensiona picos intradiários. Memória não é presumida
proporcional ao tráfego. O forecast não modela HPA, novos nodes, alterações de
aplicação, fragmentação ou limites por pod. A análise de latência é univariada,
sem afirmar causalidade entre capacidade e resposta. Um ano de histórico não basta
para validar repetição anual. Requests são reservas, não consumo.

## Integração e verificação

O app declara `davis:analyzers:execute` e depende diretamente da versão 1.9.4 de
`@dynatrace-sdk/client-davis-analyzers`, já instalada no projeto. A nova permissão
precisa estar presente na versão implantada. Não houve deploy nesta implementação.

Execuções longas usam polling limitado e cancelamento ao trocar de cluster/sair
da página. Há dois workers; falhas de sinais são independentes.

- `npm run test:growth`: datas/leap year, cobertura, lacunas, fontes anuais, contrato
  real do analisador, isolamento do período de teste e cruzamentos de capacidade.
- `npm run build`: pacote local do app.
- Validação no tenant em 2026-09-17: histórico de 365 dias para throughput, CPU e
  memória de um cluster; previsões nativas com status `OK` e qualidade `VALID`.
