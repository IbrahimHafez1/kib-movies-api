import { AppController } from './app.controller';

describe('AppController', () => {
  it('returns service information', () => {
    const controller = new AppController();
    expect(controller.getInfo()).toEqual({
      name: 'Movies API',
      docs: '/docs',
      health: '/health',
    });
  });
});
