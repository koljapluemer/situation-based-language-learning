import { ChallengeOfExpression } from "../ChallengeOfExpression"
import { ChallengeOfUnderstandingText } from "../ChallengeOfUnderstandingText"
import { LocalizedString } from "../LocalizedString"

export interface SituationDTO {
    identifier: string
    descriptions: LocalizedString[]

    challengesOfUnderstandingText: ChallengeOfUnderstandingText[]
    challengesOfExpression: ChallengeOfExpression[]
}