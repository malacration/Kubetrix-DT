import { queryExecutionClient, QueryResult, ResultRecord } from '@dynatrace-sdk/client-query';
import { Timeframe } from '@dynatrace/strato-components-preview/core';


export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// export interface QueryResult {
//   data?: any;
//   error?: string;
// }

export function GrailDqlQuery(
  dql: string,
  timeFrame?: Timeframe,
  maxRetries = 10,
  retryDelay = 200,
): Promise<QueryResult | { error: string; }> {
  try {
    //TODO colocar variavel de ambiente para ligar e desligar debug
    // console.log(dql)
    const query = {
      query: dql,
      defaultTimeframeStart: timeFrame?.from.absoluteDate,
      defaultTimeframeEnd: timeFrame?.to.absoluteDate,
    };

    return queryExecutionClient.queryExecute({ body: query }).then(execution =>
      // @ts-expect-error o framework garante a tipagem
      pollUntilDone(execution.requestToken, maxRetries),
    );
  } catch (err: any) {
    console.error('Erro ao executar query:', err);
    return Promise.resolve({ error: err.message || 'Erro desconhecido.' });
  }

  function pollUntilDone(
    requestToken: string,
    retriesLeft: number,
  ): Promise<QueryResult | { error: string; }> {
    return queryExecutionClient
      .queryPoll({ requestToken })
      .then(pollResult => {
        
        if (pollResult.state === 'SUCCEEDED' && pollResult.result != undefined) {
          return pollResult.result;
        }

        if (pollResult.state === 'FAILED') {
          return { error: 'Query falhou ao executar.' };
        }

        if (retriesLeft <= 0) {
          return { error: 'Tempo limite excedido ao aguardar o resultado da query.' };
        }
        return delay(retryDelay).then(() =>
          pollUntilDone(requestToken, retriesLeft - 1),
        );
      })
      .catch(err => {
        console.error('Erro no polling:', err);
        return { error: err.message || 'Erro desconhecido.' };
      });
  }
}