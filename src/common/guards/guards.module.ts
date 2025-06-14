import { Module } from '@nestjs/common';
import { RoleGuard } from './role.guard';

/**
 * Модуль для централизованного управления гвардами
 * Предоставляет гварды для проверки прав доступа к API
 */
@Module({
  providers: [RoleGuard],
  exports: [RoleGuard],
})
export class GuardsModule {}
