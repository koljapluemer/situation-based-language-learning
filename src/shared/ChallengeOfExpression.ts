import { GlossDTO } from "./dto/GlossDTO";
import { LocalizedString } from "./LocalizedString";

export interface ChallengeOfExpression {
  identifier: string;
  prompts: LocalizedString[];
  glosses: GlossDTO[];
}

export interface ChallengeOfExpressionWriteInput {
  identifier: string;
  prompts: LocalizedString[];
  glossIds: string[];
}
