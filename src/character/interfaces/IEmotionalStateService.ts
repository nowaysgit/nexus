import { EmotionalState, EmotionalUpdate } from '../entities/emotional-state';
import { MessageAnalysis } from './analysis.interfaces';
import { INeed } from './needs.interfaces';

/**
 * Интерфейс для сервиса, управляющего эмоциональным состоянием персонажа.
 */
export interface IEmotionalStateService {
  /**
   * Получает текущее эмоциональное состояние персонажа.
   * @param characterId - ID персонажа.
   * @returns Текущее эмоциональное состояние.
   */
  getEmotionalState(characterId: number): Promise<EmotionalState>;

  /**
   * Обновляет эмоциональное состояние персонажа на основе анализа сообщения или прямого обновления.
   * @param characterId - ID персонажа.
   * @param analysisOrUpdate - Контекст для обновления.
   * @returns Обновленное эмоциональное состояние.
   */
  updateEmotionalState(
    characterId: number,
    analysisOrUpdate: MessageAnalysis | EmotionalUpdate,
  ): Promise<EmotionalState>;

  /**
   * Обновляет эмоциональное состояние на основе текущих потребностей.
   * @param characterId ID персонажа
   * @param needs Список потребностей
   */
  updateEmotionalStateFromNeeds(characterId: number, needs: INeed[]): Promise<EmotionalState>;
}
