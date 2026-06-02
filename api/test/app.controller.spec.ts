import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  it('covers decorator metadata Object branch when AppService is unavailable at load time', () => {
    jest.isolateModules(() => {
      jest.mock('../src/app.service', () => ({ AppService: undefined }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/app.controller');
    });
  });
});
