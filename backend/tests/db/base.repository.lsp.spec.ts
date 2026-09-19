import { BaseDynamoRepository } from '../../src/db/base.repository';
import { docClient } from '../../src/db/dynamo.client';

interface TestEntity {
  id: number;
  nombre: string;
}

class TestItemRepository extends BaseDynamoRepository<TestEntity> {
  constructor() {
    super('test-table');
  }

  async obtenerItem(id: number): Promise<TestEntity | null> {
    return this.getByKey({ PK: `ITEM#${id}`, SK: 'METADATA' });
  }

  async listarItems(): Promise<TestEntity[]> {
    return this.queryItems('PK = :pk', { ':pk': 'ITEMS' });
  }

  async guardarItem(item: TestEntity): Promise<void> {
    await this.putItem(item);
  }

  async eliminarItem(id: number): Promise<void> {
    await this.deleteByKey({ PK: `ITEM#${id}` });
  }

  async transaccionCustom(items: any[], errorMsg?: string): Promise<void> {
    await this.executeTransaction(items, errorMsg);
  }
}

describe('Liskov Substitution Principle (LSP) - BaseDynamoRepository', () => {
  let repo: TestItemRepository;

  beforeEach(() => {
    repo = new TestItemRepository();
    jest.clearAllMocks();
  });

  it('debe obtener y consultar items correctamente delegando al cliente DynamoDB', async () => {
    jest.spyOn(docClient as any, 'send').mockResolvedValueOnce({
      Item: { id: 1, nombre: 'Producto Test' },
    });

    const item = await repo.obtenerItem(1);
    expect(item).toEqual({ id: 1, nombre: 'Producto Test' });

    jest.spyOn(docClient as any, 'send').mockResolvedValueOnce({
      Items: [{ id: 1, nombre: 'Producto Test' }],
    });

    const items = await repo.listarItems();
    expect(items.length).toBe(1);
  });

  it('debe normalizar TransactionCanceledException a error 409 consistente (LSP Postcondición)', async () => {
    const cancelError = new Error('Transaction cancelled');
    cancelError.name = 'TransactionCanceledException';

    jest.spyOn(docClient as any, 'send').mockRejectedValueOnce(cancelError);

    await expect(repo.transaccionCustom([], 'Conflicto de prueba')).rejects.toMatchObject({
      status: 409,
      message: 'Conflicto de prueba',
    });
  });

  it('debe propagar otros errores sin alterar la excepción', async () => {
    const netError = new Error('Network timeout');
    jest.spyOn(docClient as any, 'send').mockRejectedValueOnce(netError);

    await expect(repo.transaccionCustom([])).rejects.toThrow('Network timeout');
  });
});
