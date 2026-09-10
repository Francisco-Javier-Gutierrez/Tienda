import {
  catalogosService,
  validarSucursal,
} from '../../../src/modules/catalogos/catalogos.service';
import { prisma } from '../../../src/config/prisma';

describe('CatalogosService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Marcas', () => {
    it('debe listar marcas ordenadas alfabéticamente', async () => {
      jest.spyOn(prisma.marca, 'findMany').mockResolvedValue([
        { idMarca: 1, nombreMarca: 'Bimbo', descripMarca: 'Panadería' },
        { idMarca: 2, nombreMarca: 'Coca Cola', descripMarca: 'Refrescos' },
      ]);

      const marcas = await catalogosService.listarMarcas();
      expect(marcas.length).toBe(2);
      expect(marcas[0]?.nombre).toBe('Bimbo');
    });

    it('crearMarca debe crear correctamente', async () => {
      jest.spyOn(prisma.marca, 'create').mockResolvedValue({
        idMarca: 1,
        nombreMarca: 'Pepsi',
        descripMarca: 'Bebidas',
      });
      const marca = await catalogosService.crearMarca('Pepsi', 'Bebidas');
      expect(marca?.id).toBeDefined();
    });

    it('crearMarca debe rechazar nombre vacío', async () => {
      await expect(catalogosService.crearMarca('')).rejects.toMatchObject({
        status: 400,
        message: 'El nombre de la marca es obligatorio',
      });
    });

    it('actualizarMarca debe actualizar correctamente', async () => {
      jest.spyOn(prisma.marca, 'update').mockResolvedValue({
        idMarca: 1,
        nombreMarca: 'Pepsi Co',
        descripMarca: null,
      });
      const res = await catalogosService.actualizarMarca(1, 'Pepsi Co');
      expect(res?.nombre).toBe('Pepsi Co');
    });

    it('actualizarMarca debe rechazar nombre vacío', async () => {
      await expect(catalogosService.actualizarMarca(1, '   ')).rejects.toMatchObject({
        status: 400,
        message: 'El nombre de la marca es obligatorio',
      });
    });

    it('eliminarMarca debe eliminar si no tiene productos', async () => {
      jest.spyOn(prisma.producto, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.marca, 'delete').mockResolvedValue({ idMarca: 1 } as any);
      const res = await catalogosService.eliminarMarca(1);
      expect(res.message).toBe('Marca eliminada correctamente');
    });

    it('eliminarMarca debe rechazar si tiene productos', async () => {
      jest.spyOn(prisma.producto, 'count').mockResolvedValue(4);
      await expect(catalogosService.eliminarMarca(1)).rejects.toMatchObject({
        status: 409,
        message: 'No se puede eliminar la marca porque tiene productos asociados',
      });
    });
  });

  describe('Categorías', () => {
    it('debe listar y crear categorías', async () => {
      jest.spyOn(prisma.categoria, 'findMany').mockResolvedValue([
        { idCat: 1, nombreCat: 'Bebidas', descripCat: 'Refrescos y jugos' },
      ]);

      const cats = await catalogosService.listarCategorias();
      expect(cats[0]?.nombre).toBe('Bebidas');

      jest.spyOn(prisma.categoria, 'create').mockResolvedValue({
        idCat: 2,
        nombreCat: 'Snacks',
        descripCat: null,
      });

      const nueva = await catalogosService.crearCategoria('Snacks');
      expect(nueva?.nombre).toBe('Snacks');
    });

    it('crearCategoria debe rechazar nombre vacío', async () => {
      await expect(catalogosService.crearCategoria(' ')).rejects.toMatchObject({
        status: 400,
        message: 'El nombre de la categoría es obligatorio',
      });
    });

    it('actualizarCategoria debe actualizar o rechazar', async () => {
      jest.spyOn(prisma.categoria, 'update').mockResolvedValue({
        idCat: 1,
        nombreCat: 'Lácteos',
        descripCat: 'Leches',
      });
      const res = await catalogosService.actualizarCategoria(1, 'Lácteos', 'Leches');
      expect(res?.nombre).toBe('Lácteos');

      await expect(catalogosService.actualizarCategoria(1, '')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('eliminarCategoria debe eliminar si no tiene productos', async () => {
      jest.spyOn(prisma.producto, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.categoria, 'delete').mockResolvedValue({ idCat: 1 } as any);
      const res = await catalogosService.eliminarCategoria(1);
      expect(res.message).toBe('Categoría eliminada correctamente');
    });

    it('eliminarCategoria debe rechazar si tiene productos asociados', async () => {
      jest.spyOn(prisma.producto, 'count').mockResolvedValue(2);
      await expect(catalogosService.eliminarCategoria(1)).rejects.toMatchObject({
        status: 409,
      });
    });
  });

  describe('Sucursales y Tienda Pública', () => {
    it('validarSucursal debe verificar campos y formato de correo/web/limites', () => {
      expect(validarSucursal({ nombreSuc: '' })).toBe('El nombre de la sucursal es obligatorio');
      expect(
        validarSucursal({
          nombreSuc: 'a'.repeat(105),
        }),
      ).toBe('El campo nombreSuc no puede superar 100 caracteres');
      expect(validarSucursal({ nombreSuc: 'Central', correoSuc: 'correo-invalido' })).toBe(
        'El correo no tiene un formato válido',
      );
      expect(
        validarSucursal({ nombreSuc: 'Central', paginaWebSuc: 'ftp://invalido.com' }),
      ).toBe('La página web debe usar http o https');
      expect(
        validarSucursal({ nombreSuc: 'Central', paginaWebSuc: 'no-es-url' }),
      ).toBe('La página web no es una URL válida');
      expect(
        validarSucursal({
          nombreSuc: 'Central',
          correoSuc: 'test@example.com',
          paginaWebSuc: 'https://example.com',
        }),
      ).toBeNull();
    });

    it('obtenerSucursal y listarSucursales con y sin direccion', async () => {
      jest.spyOn(prisma.sucursal, 'findUnique').mockResolvedValue({
        idSuc: 1,
        nombreSuc: 'Matriz',
        descripcionSuc: 'Principal',
        telefonoSuc: '1234567890',
        correoSuc: 'matriz@tienda.com',
        paginaWebSuc: 'https://tienda.com',
        redSocialSuc: '@tienda',
        logoSuc: '/uploads/tienda/logo.png',
        idDir: 1,
        direccion: {
          calle: 'Av. Principal',
          noExt: '100',
          noInt: 'A',
          colonia: 'Centro',
          municipio: 'Puebla',
          estado: 'Puebla',
          codPostal: '72000',
          pais: 'México',
        } as any,
      } as any);

      const suc = await catalogosService.obtenerSucursal(1);
      expect(suc).toBeDefined();
      expect(suc?.nombre).toBe('Matriz');
      expect(suc?.direccion).toContain('Av. Principal');

      jest.spyOn(prisma.sucursal, 'findUnique').mockResolvedValue(null);
      expect(await catalogosService.obtenerSucursal(999)).toBeNull();

      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([
        {
          idSuc: 1,
          nombreSuc: 'Matriz',
          descripcionSuc: null,
          telefonoSuc: null,
          correoSuc: null,
          paginaWebSuc: null,
          redSocialSuc: null,
          logoSuc: null,
          idDir: null,
          direccion: null,
        } as any,
      ]);

      const lista = await catalogosService.listarSucursales();
      expect(lista.length).toBe(1);
      expect(lista[0]?.direccion).toBeNull();
    });

    it('crearSucursal y actualizarSucursal', async () => {
      jest.spyOn(prisma.sucursal, 'create').mockResolvedValue({ idSuc: 1 } as any);
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValue({ id: 'enc1', idSuc: 1, nombreSuc: 'Suc 1' } as any);

      const creada = await catalogosService.crearSucursal({ nombreSuc: 'Suc 1' });
      expect(creada?.id).toBeDefined();

      await expect(catalogosService.crearSucursal({ nombreSuc: '' })).rejects.toMatchObject({
        status: 400,
      });

      jest.spyOn(prisma.sucursal, 'update').mockResolvedValue({ idSuc: 1 } as any);
      const act = await catalogosService.actualizarSucursal(1, { nombreSuc: 'Suc 1 Modificada' });
      expect(act?.id).toBeDefined();

      await expect(catalogosService.actualizarSucursal(1, { nombreSuc: '' })).rejects.toMatchObject({
        status: 400,
      });
    });

    it('presignLogo debe generar presigned url o rechazar si sucursal no existe', async () => {
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce(null);
      await expect(catalogosService.presignLogo(1, 'image/png')).rejects.toMatchObject({
        status: 404,
      });

      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce({ idSuc: 1, nombreSuc: 'Suc 1' } as any);
      const res = await catalogosService.presignLogo(1, 'image/png', 'logo.png');
      expect(res.idSuc).toBe(1);
      expect(res.uploadUrl).toBeDefined();
    });

    it('confirmarLogo debe guardar logo y eliminar anterior si aplica', async () => {
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce(null);
      await expect(catalogosService.confirmarLogo(1, 'logo.png')).rejects.toMatchObject({
        status: 404,
      });

      jest.spyOn(catalogosService, 'obtenerSucursal')
        .mockResolvedValueOnce({ idSuc: 1, logoSuc: '/uploads/tienda/old.png' } as any)
        .mockResolvedValueOnce({ id: 'enc1', idSuc: 1, logoSuc: 'https://example.com/logo.png' } as any);

      jest.spyOn(prisma.sucursal, 'update').mockResolvedValue({ idSuc: 1 } as any);

      const res = await catalogosService.confirmarLogo(1, 'https://example.com/logo.png');
      expect(res?.id).toBeDefined();

      // Confirmar con key s3
      jest.spyOn(catalogosService, 'obtenerSucursal')
        .mockResolvedValueOnce({ idSuc: 1, logoSuc: null } as any)
        .mockResolvedValueOnce({ id: 'enc1', idSuc: 1, logo: 'https://bucket.s3.region.amazonaws.com/tienda/key.png' } as any);

      const res2 = await catalogosService.confirmarLogo(1, 'tienda/key.png');
      expect(res2?.id).toBeDefined();
    });

    it('eliminarLogo debe poner logo en null', async () => {
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce(null);
      await expect(catalogosService.eliminarLogo(1)).rejects.toMatchObject({
        status: 404,
      });

      jest.spyOn(catalogosService, 'obtenerSucursal')
        .mockResolvedValueOnce({ idSuc: 1, logoSuc: '/uploads/tienda/logo.png' } as any)
        .mockResolvedValueOnce({ idSuc: 1, logo: null } as any);

      jest.spyOn(prisma.sucursal, 'update').mockResolvedValue({ idSuc: 1 } as any);

      const res = await catalogosService.eliminarLogo(1);
      expect(res?.logo).toBeNull();
    });

    it('listarCargos debe retornar cargos permitidos', async () => {
      jest.spyOn(prisma.cargo, 'findMany').mockResolvedValue([
        { idCargo: 1, nombreCargo: 'ADMINISTRADOR', idSuc: 1, descripcionCargo: null } as any,
        { idCargo: 2, nombreCargo: 'CAJERO', idSuc: 1, descripcionCargo: null } as any,
      ]);

      const cargos = await catalogosService.listarCargos();
      expect(cargos.length).toBe(2);
    });

    it('listarTiendaPublica debe retornar sucursales públicas', async () => {
      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([
        { idSuc: 1, nombreSuc: 'Matriz', descripcionSuc: 'Tienda principal', logoSuc: null } as any,
      ]);

      const tiendas = await catalogosService.listarTiendaPublica();
      expect(tiendas.length).toBe(1);
      expect(tiendas[0].nombreSuc).toBe('Matriz');
    });
  });
});
