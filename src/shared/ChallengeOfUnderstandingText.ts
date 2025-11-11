import { GlossDTO } from "./dto/GlossDTO";
import { LanguageCode } from "./Language";

export interface ChallengeOfUnderstandingText {
    glosses: GlossDTO[]
    text: string
    language: LanguageCode
}
