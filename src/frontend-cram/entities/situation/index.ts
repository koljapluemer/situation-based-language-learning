export type {
  SituationEntity,
} from './types';
export {
  fromDTO,
  fromSummaryDTO,
  upsertSituation,
  upsertSituations,
  upsertSituationSummary,
  getSituation,
  getSituationsByLanguage,
  getAllSituations,
  deleteSituation,
  clearAllSituations,
  situationExists,
  resolveGlossesForChallenge,
} from './model';
