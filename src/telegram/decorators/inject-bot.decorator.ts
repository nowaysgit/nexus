import { Inject } from '@nestjs/common';
import { TELEGRAF_TOKEN } from '../constants';

export const InjectBot = () => Inject(TELEGRAF_TOKEN);
