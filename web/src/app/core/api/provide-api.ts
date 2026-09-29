import type { Provider } from '@angular/core';
import { ChannelsApi, HttpChannelsApi } from './channels-api';
import { HttpNotificationsApi, NotificationsApi } from './notifications-api';
import { HttpRulesApi, RulesApi } from './rules-api';
import { HttpUsersApi, UsersApi } from './users-api';

/** Binds each abstract API to its HTTP implementation. Tests provide fakes for the abstract classes instead. */
export function provideHttpApi(): Provider[] {
  return [
    { provide: UsersApi, useClass: HttpUsersApi },
    { provide: ChannelsApi, useClass: HttpChannelsApi },
    { provide: RulesApi, useClass: HttpRulesApi },
    { provide: NotificationsApi, useClass: HttpNotificationsApi },
  ];
}
