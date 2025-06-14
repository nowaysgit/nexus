import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Markup } from 'telegraf';
import { Context } from '../interfaces/context.interface';
import { PsychologicalTest } from '../../psychological-test/entities/psychological-test.entity';
import { SessionService } from './session.service';

@Injectable()
export class PsychologicalTestService {
  private readonly logger = new Logger(PsychologicalTestService.name);

  // Вопросы психологического теста
  private readonly questions = [
    {
      text: 'Как вы предпочитаете проводить свободное время?',
      options: [
        { text: 'В компании друзей', value: 'extrovert' },
        { text: 'С близким человеком', value: 'romantic' },
        { text: 'За чтением книги или просмотром фильма', value: 'introvert' },
        { text: 'Занимаясь активным хобби', value: 'adventurous' },
      ],
    },
    {
      text: 'Что вас больше привлекает в людях?',
      options: [
        { text: 'Интеллект и эрудиция', value: 'intellectual' },
        { text: 'Загадочность и непредсказуемость', value: 'mysterious' },
        { text: 'Доброта и забота', value: 'nurturing' },
        { text: 'Страсть и эмоциональность', value: 'femme_fatale' },
      ],
    },
    {
      text: 'Как бы вы описали свой характер?',
      options: [
        { text: 'Спокойный и уравновешенный', value: 'gentle' },
        { text: 'Независимый и решительный', value: 'rebel' },
        { text: 'Творческий и мечтательный', value: 'romantic' },
        { text: 'Общительный и энергичный', value: 'adventurous' },
      ],
    },
    {
      text: 'Какой жанр фильмов/книг вам ближе?',
      options: [
        { text: 'Драма/Мелодрама', value: 'romantic' },
        { text: 'Детектив/Триллер', value: 'mysterious' },
        { text: 'Научная фантастика/Документалистика', value: 'intellectual' },
        { text: 'Приключения/Боевик', value: 'adventurous' },
      ],
    },
    {
      text: 'Что вы цените в отношениях больше всего?',
      options: [
        { text: 'Стабильность и надежность', value: 'nurturing' },
        { text: 'Страсть и интенсивность', value: 'femme_fatale' },
        { text: 'Интеллектуальную совместимость', value: 'intellectual' },
        { text: 'Свободу и независимость', value: 'rebel' },
      ],
    },
  ];

  // Соответствие количества баллов архетипам
  private readonly archetypeMap = {
    gentle: 'gentle',
    femme_fatale: 'femme_fatale',
    intellectual: 'intellectual',
    adventurous: 'adventurous',
    mysterious: 'mysterious',
    nurturing: 'nurturing',
    rebel: 'rebel',
    romantic: 'romantic',
    extrovert: 'adventurous',
    introvert: 'intellectual',
  };

  constructor(
    @InjectRepository(PsychologicalTest)
    private psychologicalTestRepository: Repository<PsychologicalTest>,
    private sessionService: SessionService,
  ) {}

  // Запуск психологического теста
  async startTest(ctx: Context): Promise<void> {
    try {
      // Инициализируем тест в сессии
      ctx.session.data = {
        ...ctx.session.data,
        test: {
          currentQuestion: 0,
          answers: [],
        },
      };

      // Отправляем первый вопрос
      await this.sendQuestion(ctx, 0);
    } catch (error) {
      this.logger.error(`Ошибка при запуске теста: ${error.message}`);
      await ctx.reply('Произошла ошибка при запуске теста. Попробуйте позже.');
    }
  }

  // Отправка вопроса теста
  async sendQuestion(ctx: Context, questionIndex: number): Promise<void> {
    const question = this.questions[questionIndex];

    const buttons = question.options.map(option => [
      Markup.button.callback(option.text, `test_answer_${option.value}`),
    ]);

    await ctx.reply(
      `Вопрос ${questionIndex + 1}/${this.questions.length}: ${question.text}`,
      Markup.inlineKeyboard(buttons),
    );
  }

  // Обработка ответа на вопрос теста
  async handleAnswer(ctx: Context, value: string): Promise<void> {
    try {
      // Получаем текущий индекс вопроса
      const currentQuestion = ctx.session.data.test.currentQuestion;

      // Сохраняем ответ
      ctx.session.data.test.answers.push(value);

      // Если это последний вопрос, завершаем тест
      if (currentQuestion >= this.questions.length - 1) {
        await this.finishTest(ctx);
        return;
      }

      // Иначе отправляем следующий вопрос
      ctx.session.data.test.currentQuestion++;
      await this.sendQuestion(ctx, ctx.session.data.test.currentQuestion);
    } catch (error) {
      this.logger.error(`Ошибка при обработке ответа: ${error.message}`);
      await ctx.reply('Произошла ошибка при обработке ответа. Попробуйте перезапустить тест.');
    }
  }

  // Завершение теста и определение результата
  async finishTest(ctx: Context): Promise<void> {
    try {
      const answers = ctx.session.data.test.answers;

      // Считаем количество ответов каждого типа
      const counts = {};
      answers.forEach(answer => {
        counts[answer] = (counts[answer] || 0) + 1;
      });

      // Определяем преобладающий тип
      let maxCount = 0;
      let dominantType = '';

      Object.keys(counts).forEach(key => {
        if (counts[key] > maxCount) {
          maxCount = counts[key];
          dominantType = key;
        }
      });

      // Определяем архетип по преобладающему типу
      const archetype = this.archetypeMap[dominantType] || 'gentle';

      // Сохраняем результаты теста в БД
      const telegramId = ctx.from.id.toString();
      const testResult = new PsychologicalTest();
      testResult.userId = telegramId;
      testResult.answers = answers;
      testResult.dominantType = dominantType;
      testResult.recommendedArchetype = archetype;

      await this.psychologicalTestRepository.save(testResult);

      // Сохраняем рекомендуемый архетип в сессии
      ctx.session.data = {
        ...ctx.session.data,
        recommendedArchetype: archetype,
      };

      // Отправляем результат теста
      await ctx.reply(
        `✅ Тест завершен!\n\nНа основе ваших ответов, мы рекомендуем вам персонажа архетипа: ${this.getArchetypeName(archetype)}\n\nВы можете выбрать этот архетип, или выбрать другой по вашему желанию.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              `✅ Выбрать ${this.getArchetypeName(archetype)}`,
              `archetype_${archetype}`,
            ),
          ],
          [Markup.button.callback('🔄 Выбрать другой архетип', 'show_archetypes')],
        ]),
      );
    } catch (error) {
      this.logger.error(`Ошибка при завершении теста: ${error.message}`);
      await ctx.reply('Произошла ошибка при обработке результатов теста. Попробуйте позже.');
    }
  }

  // Получение читаемого названия архетипа
  private getArchetypeName(archetype: string): string {
    const archetypeNames = {
      gentle: 'Нежная',
      femme_fatale: 'Роковая',
      intellectual: 'Интеллектуалка',
      adventurous: 'Авантюристка',
      mysterious: 'Загадочная',
      nurturing: 'Заботливая',
      rebel: 'Бунтарка',
      romantic: 'Романтичная',
    };

    return archetypeNames[archetype] || 'Неизвестный архетип';
  }
}
