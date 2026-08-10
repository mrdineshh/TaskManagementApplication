import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, MeController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthProvider } from './providers/google-auth.provider';
import { DevAuthProvider } from './providers/dev-auth.provider';
import { AUTH_PROVIDER_REGISTRY, type AuthProvider } from './providers/auth-provider.interface';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [ConfigModule, JwtModule.register({}), RbacModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    GoogleAuthProvider,
    DevAuthProvider,
    {
      provide: AUTH_PROVIDER_REGISTRY,
      inject: [ConfigService, GoogleAuthProvider, DevAuthProvider],
      useFactory: (
        config: ConfigService,
        google: GoogleAuthProvider,
        dev: DevAuthProvider,
      ): Map<string, AuthProvider> => {
        const enabled = (config.get<string>('AUTH_PROVIDERS') ?? 'google')
          .split(',')
          .map((s) => s.trim());
        const registry = new Map<string, AuthProvider>();
        if (enabled.includes('google')) registry.set('google', google);
        if (enabled.includes('dev')) registry.set('dev', dev);
        return registry;
      },
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
