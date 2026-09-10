import request from 'supertest';
import { app } from '../../../src/app';
import { emitirSesionCliente, emitirSesionEmpleado } from '../../../src/utils/security';

describe('Uploads Presign Routes', () => {
  const tokenEmpleado = emitirSesionEmpleado({ idEmp: 1 });
  const tokenCliente = emitirSesionCliente({ idCliente: 10 });

  it('debe rechazar sin autorización con 401', async () => {
    const res = await request(app).post('/uploads/presign').send({
      tipo: 'PRODUCTO',
      mimeType: 'image/jpeg',
    });
    expect(res.status).toBe(401);
  });

  it('debe rechazar token invalido con 401', async () => {
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', 'Bearer token_invalido')
      .send({
        tipo: 'PRODUCTO',
        mimeType: 'image/jpeg',
      });
    expect(res.status).toBe(401);
  });

  it('debe rechazar tipo de upload inválido con 400', async () => {
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({
        tipo: 'TIPO_INVALIDO',
        mimeType: 'image/jpeg',
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Tipo de upload no válido');
  });

  it('debe rechazar si un cliente intenta subir imagen de producto con 403', async () => {
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({
        tipo: 'PRODUCTO',
        mimeType: 'image/jpeg',
      });
    expect(res.status).toBe(403);
  });

  it('debe rechazar mimeType no permitido para COMPROBANTE y PRODUCTO', async () => {
    const resComp = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({
        tipo: 'COMPROBANTE',
        mimeType: 'audio/mp3',
      });
    expect(resComp.status).toBe(400);

    const resProd = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({
        tipo: 'PRODUCTO',
        mimeType: 'application/pdf',
      });
    expect(resProd.status).toBe(400);
  });

  it('debe generar presigned URL para comprobante con token de cliente', async () => {
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenCliente}`)
      .send({
        tipo: 'COMPROBANTE',
        mimeType: 'image/png',
        filename: 'comprobante_banco.png',
      });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.key).toContain('comprobantes/');
  });

  it('debe generar presigned URL para TIENDA con token de empleado', async () => {
    const res = await request(app)
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${tokenEmpleado}`)
      .send({
        tipo: 'TIENDA',
        mimeType: 'image/webp',
        extension: 'webp',
        nombre: 'logo.webp',
      });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.key).toContain('tienda/');
  });
});
