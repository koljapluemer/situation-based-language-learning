export type { GlossEntity } from './types';
export {
  fromDTO,
  upsertGloss,
  upsertGlosses,
  getGloss,
  getGlossesByIds,
  findByLanguageContent,
  getGlossesByLanguage,
  deleteGloss,
  clearAllGlosses,
} from './model';
