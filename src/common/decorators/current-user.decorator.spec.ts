import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

// createParamDecorator factories are not directly callable; this resolves the
// underlying factory the same way Nest does at runtime.
function getDecoratorFactory(): (data: unknown, context: ExecutionContext) => unknown {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@CurrentUser() _user: unknown): void {}
  }
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler');
  return metadata[Object.keys(metadata)[0]].factory;
}

describe('CurrentUser decorator', () => {
  it('extracts the user attached to the request by the JWT strategy', () => {
    const user = { userId: 'user-1', email: 'jane@example.com' };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    expect(getDecoratorFactory()(undefined, context)).toEqual(user);
  });
});
