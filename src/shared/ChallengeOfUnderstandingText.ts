import { GlossIdentfier } from "./LocalizedString";
import { LanguageCode } from "./Language";

export interface ChallengeOfUnderstandingText {
    glosses: GlossIdentfier[]
    text: string
    language: LanguageCode
}