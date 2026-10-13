import { Prisma } from '@prisma/client';

type Entity = 'Question' | 'Priority' | 'TopCode';
const fields: Record<Entity, string[]> = {
  Question: ['id', 'content', 'type', 'dimension'],
  Priority: ['id', 'type', 'priority'],
  TopCode: [
    'code',
    'title',
    'personality',
    'strengths',
    'weaknesses',
    'careers',
    'description',
  ],
};

function publicData(
  entity: Entity,
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  if (Array.isArray(value))
    return value.map((item) =>
      publicData(entity, item),
    ) as Prisma.InputJsonValue;
  const record = value as Record<string, unknown>;
  return JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        fields[entity]
          .filter((key) => record[key] !== undefined)
          .map((key) => [key, record[key]]),
      ),
    ),
  );
}

// HTTP admin mutations pass their authenticated actor; bootstrap/seed is separate.
export async function recordAdminAudit(
  tx: Prisma.TransactionClient,
  actorId: number | undefined,
  entity: Entity,
  action: string,
  targetId: string,
  before: unknown,
  after: unknown,
) {
  if (actorId === undefined) return;
  await tx.adminAuditLog.create({
    data: {
      actorId,
      entity,
      action,
      targetId,
      before: publicData(entity, before),
      after: publicData(entity, after),
    },
  });
}
