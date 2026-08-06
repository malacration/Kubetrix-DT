import { problemsClient } from '@dynatrace-sdk/client-classic-environment-v2';
import type { Comment } from '@dynatrace-sdk/client-classic-environment-v2';

export type { Comment };

/** Lê os comentários de um problema (sob demanda). */
export async function getProblemComments(problemId: string): Promise<Comment[]> {
  const res = await problemsClient.getComments({ problemId, pageSize: 100 });
  return res.comments ?? [];
}

/** Adiciona um comentário a um problema. */
export async function addProblemComment(problemId: string, message: string): Promise<void> {
  await problemsClient.createComment({ problemId, body: { message } });
}

/** Encerra um problema. O Dynatrace exige um comentário de encerramento. */
export async function closeProblem(problemId: string, message: string): Promise<void> {
  await problemsClient.closeProblem({ problemId, body: { message } });
}
