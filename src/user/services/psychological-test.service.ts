import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PsychologicalTest, PersonalityType } from '../entities/psychological-test.entity';
import { User } from '../entities/user.entity';

interface PsychologicalQuestion {
  id: number;
  text: string;
  factor: string;
  weight: number;
}

@Injectable()
export class PsychologicalTestService {
  private readonly logger = new Logger(PsychologicalTestService.name);
  private readonly questions: PsychologicalQuestion[] = [
    {
      id: 1,
      text: 'Я предпочитаю логические решения эмоциональным',
      factor: 'analytical',
      weight: 1,
    },
    {
      id: 2,
      text: 'Мне нравится анализировать проблемы и находить их глубинные причины',
      factor: 'analytical',
      weight: 1,
    },
    {
      id: 3,
      text: 'Я часто доверяю своей интуиции при принятии решений',
      factor: 'emotional',
      weight: 1,
    },
    {
      id: 4,
      text: 'Я легко понимаю, что чувствуют другие люди',
      factor: 'emotional',
      weight: 1,
    },
    {
      id: 5,
      text: 'Мне нравится быть в центре внимания',
      factor: 'social',
      weight: 1,
    },
    {
      id: 6,
      text: 'Я легко завожу новые знакомства и друзей',
      factor: 'social',
      weight: 1,
    },
    {
      id: 7,
      text: 'Я часто придумываю нестандартные решения проблем',
      factor: 'creative',
      weight: 1,
    },
    {
      id: 8,
      text: 'Я ценю красоту и искусство',
      factor: 'creative',
      weight: 1,
    },
    {
      id: 9,
      text: 'Я предпочитаю конкретные факты теориям',
      factor: 'practical',
      weight: 1,
    },
    {
      id: 10,
      text: 'Мне важно видеть практическую пользу от моих действий',
      factor: 'practical',
      weight: 1,
    },
    {
      id: 11,
      text: 'Я уверен в своих силах и способностях',
      factor: 'confident',
      weight: 1,
    },
    {
      id: 12,
      text: 'Я легко принимаю решения и беру на себя ответственность',
      factor: 'confident',
      weight: 1,
    },
    {
      id: 13,
      text: 'Я предпочитаю тщательно обдумывать свои слова и действия',
      factor: 'reserved',
      weight: 1,
    },
    {
      id: 14,
      text: 'Мне комфортнее в небольшой компании близких людей',
      factor: 'reserved',
      weight: 1,
    },
    {
      id: 15,
      text: 'Я часто думаю о глубоких философских вопросах',
      factor: 'analytical',
      weight: 1,
    },
    {
      id: 16,
      text: 'Я предпочитаю глубокие эмоциональные отношения поверхностному общению',
      factor: 'emotional',
      weight: 1,
    },
    {
      id: 17,
      text: 'Мне важно, что думают обо мне другие люди',
      factor: 'social',
      weight: 1,
    },
    {
      id: 18,
      text: 'Я люблю создавать что-то новое и оригинальное',
      factor: 'creative',
      weight: 1,
    },
    {
      id: 19,
      text: 'Я предпочитаю действовать по заранее составленному плану',
      factor: 'practical',
      weight: 1,
    },
    {
      id: 20,
      text: 'Я часто проявляю инициативу в новых ситуациях',
      factor: 'confident',
      weight: 1,
    },
  ];

  constructor(
    @InjectRepository(PsychologicalTest)
    private testRepository: Repository<PsychologicalTest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  getQuestions(): PsychologicalQuestion[] {
    return this.questions;
  }

  getQuestionById(id: number): PsychologicalQuestion | undefined {
    return this.questions.find(q => q.id === id);
  }

  async saveTestResults(
    userId: number,
    answers: Record<number, number>,
  ): Promise<PsychologicalTest> {
    try {
      // Рассчитываем баллы по факторам
      const scores = this.calculateScores(answers);

      // Определяем доминирующий тип личности
      const personalityType = this.determinePersonalityType(scores);

      // Создаем запись о тесте
      const test = this.testRepository.create({
        userId,
        answers,
        scores,
        personalityType,
      });

      // Обновляем статус прохождения теста у пользователя
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        user.hasCompletedTest = true;
        await this.userRepository.save(user);
      }

      return this.testRepository.save(test);
    } catch (error) {
      this.logger.error(`Ошибка при сохранении результатов теста: ${error.message}`);
      throw error;
    }
  }

  calculateScores(answers: Record<number, number>): Record<string, number> {
    const scores: Record<string, number> = {
      analytical: 0,
      emotional: 0,
      social: 0,
      creative: 0,
      practical: 0,
      confident: 0,
      reserved: 0,
    };

    // Вычисляем суммарный балл по каждому фактору
    for (const [questionId, answer] of Object.entries(answers)) {
      const id = parseInt(questionId);
      const question = this.getQuestionById(id);

      if (question) {
        scores[question.factor] += answer * question.weight;
      }
    }

    // Нормализуем баллы (приводим к шкале от 0 до 100)
    const factorQuestionCounts: Record<string, number> = {};

    // Подсчитываем количество вопросов для каждого фактора
    for (const question of this.questions) {
      factorQuestionCounts[question.factor] = (factorQuestionCounts[question.factor] || 0) + 1;
    }

    // Нормализуем баллы
    for (const factor in scores) {
      const maxPossible = factorQuestionCounts[factor] * 5; // 5 - максимальная оценка
      scores[factor] = Math.round((scores[factor] / maxPossible) * 100);
    }

    return scores;
  }

  determinePersonalityType(scores: Record<string, number>): PersonalityType {
    let maxScore = 0;
    let dominantType: PersonalityType = PersonalityType.ANALYTICAL;

    for (const [factor, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantType = factor as PersonalityType;
      }
    }

    return dominantType;
  }

  getPersonalityTypeDescription(type: PersonalityType): string {
    const descriptions: Record<PersonalityType, string> = {
      [PersonalityType.ANALYTICAL]:
        'Вы логичны, любите анализировать и искать глубинные причины явлений.',
      [PersonalityType.EMOTIONAL]: 'Вы эмоциональны, чувствительны и интуитивны.',
      [PersonalityType.SOCIAL]:
        'Вы общительны, любите находиться среди людей и заводить новые знакомства.',
      [PersonalityType.CREATIVE]:
        'Вы творческая личность, цените оригинальность и нестандартные решения.',
      [PersonalityType.PRACTICAL]: 'Вы практичны, цените конкретные факты и результаты.',
      [PersonalityType.CONFIDENT]: 'Вы уверены в себе, решительны и инициативны.',
      [PersonalityType.RESERVED]: 'Вы сдержанны, предпочитаете тщательно обдумывать свои действия.',
    };

    return descriptions[type];
  }

  getCompatibleCharacterArchetype(personalityType: PersonalityType): string {
    // Здесь определяем, какой архетип персонажа лучше всего подойдет для данного типа личности
    const compatibilityMap: Record<PersonalityType, string> = {
      [PersonalityType.ANALYTICAL]: 'intellectual', // Интеллектуалка для аналитиков
      [PersonalityType.EMOTIONAL]: 'nurturing', // Заботливая для эмоциональных
      [PersonalityType.SOCIAL]: 'adventurous', // Авантюристка для социальных
      [PersonalityType.CREATIVE]: 'mysterious', // Загадочная для креативных
      [PersonalityType.PRACTICAL]: 'gentle', // Нежная для практичных
      [PersonalityType.CONFIDENT]: 'femme_fatale', // Роковая для уверенных
      [PersonalityType.RESERVED]: 'romantic', // Романтичная для сдержанных
    };

    return compatibilityMap[personalityType];
  }

  async getUserLatestTest(userId: number): Promise<PsychologicalTest | null> {
    return this.testRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
