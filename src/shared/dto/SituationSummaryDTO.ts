import { LocalizedString } from "../LocalizedString"
import { LanguageCode } from "../Language"

export interface SituationSummaryDTO {
    identifier: string
    descriptions: LocalizedString[]
    imageLink?: string
    targetLanguage: LanguageCode
    challengeCount: {
        expression: number
        understanding: number
    }
}
