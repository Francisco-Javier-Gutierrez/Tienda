import { idempotencyRepository, IdempotencyRepository } from '../../src/db/repositories/idempotency.repository';
import { docClient } from '../../src/db/dynamo.client';

describe('IdempotencyRepository', () => {
  let repo: IdempotencyRepository;

  beforeEach(() => {
    repo = new IdempotencyRepository();
    jest.clearAllMocks();
  });

  it('debe retornar null si uuid es vacio', async () => {
    const result = await repo.getRecord('', 'VENTA');
    expect(result).toBeNull();
  });

  it('debe consultar GetCommand con la clave de idempotencia', async () => {
    const mockRecord = {
      PK: 'IDEMP#11111111-1111-4111-8111-111111111111',
      SK: 'VENTA',
      uuid: '11111111-1111-4111-8111-111111111111',
      operation: 'VENTA' as const,
      targetId: 10,
      createdAt: new Date().toISOString(),
    };

    jest.spyOn(docClient as any, 'send').mockResolvedValueOnce({
      Item: mockRecord,
    });

    const res = await repo.getRecord('11111111-1111-4111-8111-111111111111', 'VENTA');
    expect(res).toEqual(mockRecord);
  });

  it('debe construir un TransactItem con condition expression attribute_not_exists(PK)', () => {
    const item = repo.buildTransactItem('11111111-1111-4111-8111-111111111111', 'VENTA', 50, {
      idSuc: 1,
      idEmp: 2,
    });

    expect(item).toBeDefined();
    expect(item.Put).toBeDefined();
    expect(item.Put.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(item.Put.Item.PK).toBe('IDEMP#11111111-1111-4111-8111-111111111111');
    expect(item.Put.Item.SK).toBe('VENTA');
    expect(item.Put.Item.targetId).toBe(50);
    expect(item.Put.Item.idSuc).toBe(1);
    expect(item.Put.Item.idEmp).toBe(2);
    expect(item.Put.Item.ttl).toBeGreaterThan(0);
  });
});
