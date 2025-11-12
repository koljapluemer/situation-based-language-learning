import { ChallengeOfExpression } from "../ChallengeOfExpression"
import { ChallengeOfUnderstandingText } from "../ChallengeOfUnderstandingText"
import { LocalizedString } from "../LocalizedString"
import { LanguageCode } from "../Language"

export interface SituationDTO {
    identifier: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode

    challengesOfUnderstandingText: ChallengeOfUnderstandingText[]
    challengesOfExpression: ChallengeOfExpression[]
}