import { Injectable } from '@nestjs/common';
import { LogService } from '../../../logging/log.service';
import { BaseService } from '../../../common/base/base.service';
import { Character } from '../../entities/character.entity';
import { Dialog } from '../../../dialog/entities/dialog.entity';
import { Message } from '../../../dialog/entities/message.entity';
import { MessageAnalysis } from '../../interfaces/analysis.interfaces';
