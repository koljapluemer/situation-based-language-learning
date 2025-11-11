import { ChallengeOfExpression } from "../ChallengeOfExpression"
import { ChallengeOfUnderstandingText } from "../ChallengeOfUnderstandingText"
import { LanguageCode } from "../Language"
import { LocalizedString } from "../LocalizedString"

export interface SituationDTO {
    language: LanguageCode
    identifier: string
    descriptions: LocalizedString[]

    challengesOfUnderstandingText: ChallengeOfUnderstandingText[]
    challengesOfExpression: ChallengeOfExpression[]
}