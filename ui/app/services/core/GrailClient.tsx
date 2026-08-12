import { queryExecutionClient, QueryResult } from '@dynatrace-sdk/client-query';
import { Timeframe } from '@dynatrace/strato-components-preview/core';


export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// export interface QueryResult {
//   data?: any;
//   error?: string;
// }

export function GrailDqlQuery(
  dql: string,
  timeFrame?: Timeframe,
  maxRetries = 60,
  retryDelay = 500,
): Promise<QueryResult | { error: string; }> {
  const execute = async (): Promise<QueryResult | { error: string }> => {
    try {
      //TODO colocar variavel de ambiente para ligar e desligar debug
      // console.log(dql)
      const query = {
        query: dql,
        defaultTimeframeStart: timeFrame?.from.absoluteDate,
        defaultTimeframeEnd: timeFrame?.to.absoluteDate,
      };

      const execution = await queryExecutionClient.queryExecute({ body: query });

      // Consultas pequenas podem terminar já no queryExecute. Antes esse resultado
      // era ignorado e o código tentava fazer poll com um token opcional/inexistente.
      if (execution.state === 'SUCCEEDED' && execution.result) {
        return execution.result;
      }
      if (execution.state === 'FAILED' || execution.state === 'CANCELLED') {
        return { error: `Query ${execution.state.toLowerCase()} ao iniciar.` };
      }
      if (!execution.requestToken) {
        return { error: 'A consulta não retornou resultado nem token para acompanhamento.' };
      }

      return pollUntilDone(execution.requestToken, maxRetries);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';
      console.error('Erro ao executar query:', err);
      return { error: message };
    }
  };

  function pollUntilDone(
    requestToken: string,
    retriesLeft: number,
  ): Promise<QueryResult | { error: string; }> {
    return queryExecutionClient
      // Long polling reduz requests e dá tempo para consultas com alta cardinalidade
      // (como séries separadas por pod) concluírem.
      .queryPoll({ requestToken, requestTimeoutMilliseconds: 1_000 })
      .then(pollResult => {
        
        if (pollResult.state === 'SUCCEEDED' && pollResult.result != undefined) {
          return pollResult.result;
        }

        if (pollResult.state === 'FAILED' || pollResult.state === 'CANCELLED') {
          return { error: `Query ${pollResult.state.toLowerCase()} durante a execução.` };
        }

        if (pollResult.state === 'RESULT_GONE') {
          return { error: 'O resultado da consulta expirou antes de ser recuperado.' };
        }

        if (retriesLeft <= 0) {
          return { error: 'Tempo limite excedido ao aguardar o resultado da query.' };
        }
        return delay(retryDelay).then(() =>
          pollUntilDone(requestToken, retriesLeft - 1),
        );
      })
      .catch((err: unknown) => {
        console.error('Erro no polling:', err);
        return { error: err instanceof Error ? err.message : 'Erro desconhecido.' };
      });
  }

  return execute();
}
