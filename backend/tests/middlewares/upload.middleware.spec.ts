import { uploadImagen, uploadLogo, uploadComprobante } from '../../src/middlewares/upload.middleware';

describe('Upload Middleware', () => {
  it('debe filtrar archivos de imagen según mimetype permitido', () => {
    const fileValido = { mimetype: 'image/jpeg' } as any;
    const fileInvalido = { mimetype: 'application/pdf' } as any;

    const filter = (uploadImagen as any).fileFilter;
    const cb1 = jest.fn();
    filter({} as any, fileValido, cb1);
    expect(cb1).toHaveBeenCalledWith(null, true);

    const cb2 = jest.fn();
    filter({} as any, fileInvalido, cb2);
    expect(cb2).toHaveBeenCalledWith(expect.any(Error));
  });

  it('debe filtrar archivos de comprobante según mimetype permitido', () => {
    const filePdf = { mimetype: 'application/pdf' } as any;
    const fileTxt = { mimetype: 'text/plain' } as any;

    const filter = (uploadComprobante as any).fileFilter;
    const cb1 = jest.fn();
    filter({} as any, filePdf, cb1);
    expect(cb1).toHaveBeenCalledWith(null, true);

    const cb2 = jest.fn();
    filter({} as any, fileTxt, cb2);
    expect(cb2).toHaveBeenCalledWith(expect.any(Error));
  });

  it('debe generar nombres aleatorios para imágenes y comprobantes con y sin extensión reconocida', (done) => {
    const storageImg = (uploadImagen as any).storage;
    storageImg.getFilename({} as any, { mimetype: 'image/png' }, (_err: any, filename: string) => {
      expect(filename).toContain('.png');

      storageImg.getFilename({} as any, { mimetype: 'unknown/mime' }, (_err2: any, filenameNoExt: string) => {
        expect(filenameNoExt).toBeDefined();

        const storageComp = (uploadComprobante as any).storage;
        storageComp.getFilename({} as any, { mimetype: 'application/pdf' }, (_errComp: any, filenameComp: string) => {
          expect(filenameComp).toContain('.pdf');

          storageComp.getFilename({} as any, { mimetype: 'unknown/mime' }, (_errComp2: any, filenameCompNoExt: string) => {
            expect(filenameCompNoExt).toBeDefined();
            done();
          });
        });
      });
    });
  });
});
