import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { createObjectStore, OBJECT_STORE } from './object-store';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORE,
      inject: [AppConfigService],
      useFactory: createObjectStore,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
