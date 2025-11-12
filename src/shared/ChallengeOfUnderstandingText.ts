import { GlossDTO } from "./dto/GlossDTO";
import { LanguageCode } from "./Language";

export interface ChallengeOfUnderstandingText {
    text: string;
    language: LanguageCode;
    glosses: GlossDTO[];
}

export interface ChallengeOfUnderstandingTextWriteInput {
    text: string;
    language: LanguageCode;
    glossIds: string[];
}
